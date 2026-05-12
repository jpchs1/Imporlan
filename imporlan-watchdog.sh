#!/usr/bin/env bash
# ============================================
#  imporlan-watchdog.sh
# ============================================
#  Runs every minute via cron. Detects if imporlan.cl is serving
#  non-Imporlan content (typically: another site's deploy clobbered
#  ~/public_html/index.html) and auto-restores it from the staging
#  repo within ~60 seconds.
#
#  This is defence in depth -- the primary protection lives in
#  auto-deploy.sh and deploy-guard.sh, which prevent Imporlan's own
#  deploys from running on the wrong doc-root. The watchdog catches
#  the case where ANOTHER site's deploy (Tourevo, etc.) writes into
#  /public_html/ by mistake.
#
#  INSTALL
#    1. Place this file at /home/wwimpo/imporlan-watchdog.sh
#    2. chmod +x /home/wwimpo/imporlan-watchdog.sh
#    3. Add to crontab (crontab -e):
#         * * * * * /home/wwimpo/imporlan-watchdog.sh >/dev/null 2>&1
#
#  EXIT CODES
#    0  -> site is healthy, no action taken
#    0  -> pisado detected, auto-restored successfully (logged)
#    1  -> pisado detected, restore failed (logged + flag file written)
# ============================================
set -uo pipefail

PUBLIC_HTML="/home/wwimpo/public_html"
STAGING="/home/wwimpo/imporlan-staging"
LOG="/home/wwimpo/imporlan-watchdog.log"
FLAG="/home/wwimpo/.imporlan-watchdog-incident"
URL="https://www.imporlan.cl/"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() { echo "[$TIMESTAMP] $*" >> "$LOG"; }

# Fetch the live home, look for Imporlan-identifying markers.
# Timeout aggressively so we don't pile up under CDN slowdown.
BODY=$(curl -fsSL --max-time 12 -H 'Cache-Control: no-cache' \
              "${URL}?wd=$(date +%s)" 2>/dev/null || true)

# If curl fails outright (network blip, CF 522, etc.) just skip this tick;
# we'd rather miss a beat than restore based on a transient error.
if [ -z "$BODY" ]; then
  exit 0
fi

# Match a fairly tolerant set of Imporlan markers. We don't want false
# positives during a legitimate deploy (where the title may briefly be
# missing) so we require AT LEAST ONE of these to be present.
if echo "$BODY" | grep -qiE 'imporlan|Importaci[oó]n de Lanchas|/assets/imporlan-enhancements\.js'; then
  # Healthy. Clear any previous incident flag.
  [ -f "$FLAG" ] && {
    log "Recovery detected. Clearing incident flag."
    rm -f "$FLAG"
  }
  exit 0
fi

# ----- PISADO DETECTED -----
# Capture what's currently being served so we can identify the offending deploy.
FOREIGN_TITLE=$(echo "$BODY" | grep -oE '<title>[^<]+</title>' | head -1)
log "ALERT: imporlan.cl is NOT serving Imporlan content."
log "       Foreign title: $FOREIGN_TITLE"

# If we've already alerted in the last 10 min without recovery, don't keep restoring.
# Some other cron / human is probably doing manual recovery -- back off.
if [ -f "$FLAG" ]; then
  FLAG_AGE=$(( $(date +%s) - $(stat -c %Y "$FLAG" 2>/dev/null || echo 0) ))
  if [ "$FLAG_AGE" -lt 600 ]; then
    log "       Recent restore failed less than 10 min ago. Backing off."
    exit 1
  fi
fi

# Save a forensic copy of whatever is currently at index.html
FORENSIC_DIR="/home/wwimpo/backups/watchdog_pisado_$(date +%Y-%m-%d_%H%M%S)"
mkdir -p "$FORENSIC_DIR"
[ -f "$PUBLIC_HTML/index.html" ] && cp "$PUBLIC_HTML/index.html" "$FORENSIC_DIR/index.html.foreign"
log "       Forensic snapshot saved to $FORENSIC_DIR/"

# Make sure the staging repo has the latest main before we copy from it
if [ ! -d "$STAGING/.git" ]; then
  log "       ERROR: staging repo not found at $STAGING. Cannot restore."
  date > "$FLAG"
  exit 1
fi
( cd "$STAGING" && git fetch --depth=1 origin main >/dev/null 2>&1 && \
                   git reset --hard origin/main >/dev/null 2>&1 ) || {
  log "       WARNING: could not pull latest main, using whatever HEAD has."
}

# Restore index.html (the most common clobber target)
if [ -f "$STAGING/index.html" ]; then
  cp "$STAGING/index.html" "$PUBLIC_HTML/index.html"
  log "       Restored $PUBLIC_HTML/index.html from staging"
else
  log "       ERROR: $STAGING/index.html missing"
  date > "$FLAG"
  exit 1
fi

# Re-write the sentinel so other deploys' guard checks recognise this doc-root again
cat > "$PUBLIC_HTML/.imporlan_docroot" <<SENTINEL_EOF
Imporlan doc-root, auto-restored by watchdog at $TIMESTAMP
Foreign title that was clobbering: $FOREIGN_TITLE
Forensic snapshot: $FORENSIC_DIR
SENTINEL_EOF
chmod 644 "$PUBLIC_HTML/.imporlan_docroot"

# Verify the restore actually worked
sleep 3
BODY2=$(curl -fsSL --max-time 12 -H 'Cache-Control: no-cache' \
              "${URL}?wd_verify=$(date +%s)" 2>/dev/null || true)
if echo "$BODY2" | grep -qiE 'imporlan|Importaci[oó]n de Lanchas'; then
  log "       OK Restore verified: imporlan.cl is serving Imporlan again."
  rm -f "$FLAG"
else
  log "       ALERT: restore did not take effect (CDN cache? CF?). Manual review needed."
  date > "$FLAG"
  exit 1
fi

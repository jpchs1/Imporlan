#!/usr/bin/env bash
# ============================================
#  imporlan-watchdog.sh
# ============================================
#  Runs every minute via cron. Detects if imporlan.cl is serving
#  non-Imporlan content (typically: another site's deploy clobbered
#  ~/imporlan.cl/index.html) and auto-restores it from the staging
#  repo within ~60 seconds.
#
#  This is defence in depth -- the primary protection lives in
#  auto-deploy.sh and deploy-guard.sh, which prevent Imporlan's own
#  deploys from running on the wrong doc-root. The watchdog catches
#  the case where ANOTHER site's deploy (Tourevo, etc.) writes into
#  ~/imporlan.cl/ by mistake.
#
#  INSTALL
#    1. Place this file at /home/wwimpo/imporlan-watchdog.sh
#    2. chmod +x /home/wwimpo/imporlan-watchdog.sh
#    3. Add to crontab (crontab -e):
#         * * * * * /home/wwimpo/imporlan-watchdog.sh >/dev/null 2>&1
#
#  WATCHED PAGES
#    /          -> restored from STAGING/index.html
#    /pago/     -> restored from STAGING/pago/index.html
#
#  EXIT CODES
#    0  -> all watched pages healthy OR auto-restored successfully (logged)
#    1  -> at least one page is clobbered AND restore failed
#          (logged + per-page flag file written, 10-min backoff)
# ============================================
set -uo pipefail

PUBLIC_HTML="/home/wwimpo/imporlan.cl"
STAGING="/home/wwimpo/imporlan-staging"
LOG="/home/wwimpo/imporlan-watchdog.log"
FLAG_DIR="/home/wwimpo"
BASE_URL="https://www.imporlan.cl"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() { echo "[$TIMESTAMP] $*" >> "$LOG"; }

# --------------------------------------------------------------------
# Watched pages
# --------------------------------------------------------------------
#   path|file_inside_repo|markers_regex
# - path: URL path probed under $BASE_URL (must end in /)
# - file_inside_repo: file copied from $STAGING/<file> to $PUBLIC_HTML/<file>
#                     when the page is detected as clobbered
# - markers_regex: case-insensitive regex; if AT LEAST ONE marker is
#                  present in the live response, the page is healthy
#
# Tourevo (the other site on this shared hosting account) has clobbered
# /index.html in the past, and on 2026-05 it also clobbered /pago/index.html
# with its own Tourevo payment portal. Both need to be monitored.
# --------------------------------------------------------------------
WATCHED=(
  "/|index.html|imporlan|Importaci[oó]n de Lanchas|/assets/imporlan-enhancements\\.js"
  "/pago/|pago/index.html|imporlan|Pago Seguro \\| Imporlan|Importacion de Lanchas y Embarcaciones"
)

OVERALL_EXIT=0

for entry in "${WATCHED[@]}"; do
  IFS='|' read -r WPATH WFILE WMARKERS <<< "$entry"
  URL="${BASE_URL}${WPATH}"
  FLAG="${FLAG_DIR}/.imporlan-watchdog-incident$(echo "$WPATH" | tr '/' '_')"

  # Fetch the live page with cache-buster. Timeout aggressively so we
  # don't pile up under CDN slowdown.
  BODY=$(curl -fsSL --max-time 12 -H 'Cache-Control: no-cache' \
                "${URL}?wd=$(date +%s)" 2>/dev/null || true)

  # If curl fails outright (network blip, CF 522, etc.) just skip this
  # tick for this URL; we'd rather miss a beat than restore based on a
  # transient error.
  if [ -z "$BODY" ]; then
    continue
  fi

  if echo "$BODY" | grep -qiE "$WMARKERS"; then
    # Healthy. Clear any previous incident flag for this page.
    [ -f "$FLAG" ] && {
      log "Recovery detected for ${WPATH}. Clearing incident flag."
      rm -f "$FLAG"
    }
    continue
  fi

  # ----- PISADO DETECTED for $WPATH -----
  FOREIGN_TITLE=$(echo "$BODY" | grep -oE '<title>[^<]+</title>' | head -1)
  log "ALERT: ${URL} is NOT serving Imporlan content."
  log "       Foreign title: $FOREIGN_TITLE"

  # Back off if we've already failed a restore for THIS page in the last 10 min.
  if [ -f "$FLAG" ]; then
    FLAG_AGE=$(( $(date +%s) - $(stat -c %Y "$FLAG" 2>/dev/null || echo 0) ))
    if [ "$FLAG_AGE" -lt 600 ]; then
      log "       Recent restore failed less than 10 min ago for ${WPATH}. Backing off."
      OVERALL_EXIT=1
      continue
    fi
  fi

  # Forensic snapshot of whatever the offending file currently is
  FORENSIC_DIR="/home/wwimpo/backups/watchdog_pisado_$(date +%Y-%m-%d_%H%M%S)$(echo "$WPATH" | tr '/' '_')"
  mkdir -p "$FORENSIC_DIR"
  [ -f "$PUBLIC_HTML/$WFILE" ] && cp "$PUBLIC_HTML/$WFILE" "$FORENSIC_DIR/$(basename "$WFILE").foreign"
  log "       Forensic snapshot saved to $FORENSIC_DIR/"

  # Make sure the staging repo has the latest main before we copy from it
  if [ ! -d "$STAGING/.git" ]; then
    log "       ERROR: staging repo not found at $STAGING. Cannot restore ${WPATH}."
    date > "$FLAG"
    OVERALL_EXIT=1
    continue
  fi
  ( cd "$STAGING" && git fetch --depth=1 origin main >/dev/null 2>&1 && \
                     git reset --hard origin/main >/dev/null 2>&1 ) || {
    log "       WARNING: could not pull latest main, using whatever HEAD has."
  }

  if [ ! -f "$STAGING/$WFILE" ]; then
    log "       ERROR: $STAGING/$WFILE missing"
    date > "$FLAG"
    OVERALL_EXIT=1
    continue
  fi

  mkdir -p "$(dirname "$PUBLIC_HTML/$WFILE")"
  cp "$STAGING/$WFILE" "$PUBLIC_HTML/$WFILE"
  log "       Restored $PUBLIC_HTML/$WFILE from staging"

  # Re-write the sentinel only when restoring the home; per-subpath
  # clobbers don't invalidate the doc-root identity.
  if [ "$WPATH" = "/" ]; then
    cat > "$PUBLIC_HTML/.imporlan_docroot" <<SENTINEL_EOF
Imporlan doc-root, auto-restored by watchdog at $TIMESTAMP
Foreign title that was clobbering: $FOREIGN_TITLE
Forensic snapshot: $FORENSIC_DIR
SENTINEL_EOF
    chmod 644 "$PUBLIC_HTML/.imporlan_docroot"
  fi

  # Verify the restore actually worked
  sleep 3
  BODY2=$(curl -fsSL --max-time 12 -H 'Cache-Control: no-cache' \
                "${URL}?wd_verify=$(date +%s)" 2>/dev/null || true)
  if echo "$BODY2" | grep -qiE "$WMARKERS"; then
    log "       OK Restore verified: ${URL} is serving Imporlan again."
    rm -f "$FLAG"
  else
    log "       ALERT: restore of ${WPATH} did not take effect (CDN cache? CF?). Manual review needed."
    date > "$FLAG"
    OVERALL_EXIT=1
  fi
done

exit "$OVERALL_EXIT"

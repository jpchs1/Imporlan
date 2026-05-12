#!/usr/bin/env bash
# ============================================
#  migrate-imporlan-to-own-folder.sh
# ============================================
#  Stage Imporlan's content into its own ~/imporlan.cl/ directory in
#  preparation for banahosting changing the imporlan.cl Document Root
#  from /public_html to /imporlan.cl.
#
#  Until banahosting applies the change, ~/public_html/ remains the
#  live doc-root and this script does NOT touch it -- it only rsyncs
#  a COPY of the Imporlan files into ~/imporlan.cl/.
#
#  After banahosting confirms the docroot switch, the new ~/imporlan.cl/
#  takes over and ~/public_html/ becomes a parking placeholder.
#
#  USAGE
#    bash migrate-imporlan-to-own-folder.sh           # dry-run + analysis (DEFAULT)
#    bash migrate-imporlan-to-own-folder.sh --apply   # actually do the rsync
#
#  EXIT CODES
#    0  -> ok
#    1  -> source missing
#    2  -> source doesn't look like Imporlan (refusing to copy)
#    3  -> destination validation failed after rsync
#    4  -> destination index.html doesn't look like Imporlan after rsync
# ============================================
set -euo pipefail

SRC="/home/wwimpo/public_html"
DST="/home/wwimpo/imporlan.cl"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_DIR="/home/wwimpo/backups"
LOG="/home/wwimpo/imporlan-migration-$TIMESTAMP.log"

# Default mode is dry-run. Pass --apply to actually copy.
MODE="dry-run"
RSYNC_FLAG="-n"
if [ "${1:-}" = "--apply" ]; then
  MODE="apply"
  RSYNC_FLAG=""
fi

# Paths in ~/public_html/ that belong to OTHER sites (Tourevo stragglers from
# previous mis-targeted deploys) -- excluded from the copy so ~/imporlan.cl/
# stays clean. They remain at $SRC for the Tourevo team to clean up
# separately; they were never Imporlan's to begin with.
EXCLUDES=(
  # known Tourevo stragglers we've identified
  "tourevo/"
  "tours/"
  "fleet/"
  "photo-service/"
  "assets/tours/"
  "assets/fleet/"
  "assets/photo-service/"
  ".tourevo*"
  # server-managed / cPanel-managed -- leave at source
  ".user.ini"
  "cgi-bin/"
  ".cpanel/"
  ".trash/"
  "tmp/"
  ".well-known/acme-challenge/"
  # nothing in build artefacts should sneak in
  "node_modules/"
  ".git/"
)

echo "==============================================================="
echo "  IMPORLAN: stage migration to own doc-root"
echo "  $TIMESTAMP"
echo "==============================================================="
echo ""
echo "  Source:      $SRC"
echo "  Destination: $DST"
echo "  Mode:        $MODE"
echo "  Log:         $LOG"
echo ""
echo "  Excluded paths (Tourevo / cPanel / server-managed):"
for x in "${EXCLUDES[@]}"; do echo "    - $x"; done
echo ""

# -------- pre-flight: source must exist + look like Imporlan --------
if [ ! -d "$SRC" ]; then
  echo "ERROR: $SRC does not exist."
  exit 1
fi
if [ ! -f "$SRC/index.html" ] || ! grep -qiE 'imporlan|Importaci[oó]n de Lanchas' "$SRC/index.html"; then
  echo "ERROR: $SRC/index.html does not look like Imporlan."
  echo "       Refusing to copy -- the source may be in a bad state."
  echo "       Restore index.html first, then re-run."
  exit 2
fi
echo "[pre-flight] $SRC/index.html looks like Imporlan: OK"

# -------- analysis: how big? what Tourevo strays are in source? --------
SIZE_TOTAL=$(du -sh "$SRC" 2>/dev/null | awk '{print $1}')
echo "[pre-flight] $SRC total size: $SIZE_TOTAL"
echo ""
echo "[pre-flight] Tourevo strays currently present in $SRC (will be SKIPPED):"
for x in "${EXCLUDES[@]}"; do
  PATH_CHECK="${SRC%/}/${x%/}"
  if [ -e "$PATH_CHECK" ]; then
    SIZE=$(du -sh "$PATH_CHECK" 2>/dev/null | awk '{print $1}')
    echo "    - $x ($SIZE)"
  fi
done
echo ""

# -------- confirm if --apply --------
if [ "$MODE" = "apply" ]; then
  echo "About to rsync $SRC -> $DST"
  if [ -d "$DST" ]; then
    echo "WARNING: $DST already exists. It will be backed up first."
  fi
  read -p "Type 'yes' to proceed: " ANS
  [ "$ANS" = "yes" ] || { echo "Aborted by user."; exit 0; }

  # Backup any pre-existing imporlan.cl folder
  if [ -d "$DST" ]; then
    mkdir -p "$BACKUP_DIR"
    EXISTING_BACKUP="$BACKUP_DIR/imporlan.cl_pre_migration_$TIMESTAMP"
    echo "[1/4] Backing up existing $DST -> $EXISTING_BACKUP"
    mv "$DST" "$EXISTING_BACKUP"
  fi
  mkdir -p "$DST"
fi

# -------- copy: prefer rsync, fall back to tar --------
# Shared hosting often doesn't ship rsync; tar is universally available
# and supports --exclude patterns the same way.
echo ""
echo "[2/4] Copying files (mode: $MODE) ..."
echo "      Logging to $LOG"

if command -v rsync >/dev/null 2>&1; then
  echo "      Using rsync"
  EXCLUDE_ARGS=()
  for x in "${EXCLUDES[@]}"; do EXCLUDE_ARGS+=(--exclude="$x"); done
  rsync -av $RSYNC_FLAG \
    "${EXCLUDE_ARGS[@]}" \
    "$SRC/" "$DST/" 2>&1 | tee "$LOG" | tail -40
else
  echo "      rsync not available, using tar"
  TAR_EXCLUDES=()
  for x in "${EXCLUDES[@]}"; do
    # tar wants ./pattern relative to the source CWD and no trailing slash
    TAR_EXCLUDES+=(--exclude="./${x%/}")
  done
  if [ "$MODE" = "dry-run" ]; then
    # tar can't really dry-run a copy, but we can list what it WOULD
    # archive (excludes applied), which mirrors what would be copied.
    ( cd "$SRC" && tar -cvf /dev/null "${TAR_EXCLUDES[@]}" . ) 2>&1 \
      | tee "$LOG" | tail -40
    echo "      (dry-run: nothing was written to $DST)"
  else
    # Stream tar from SRC into tar -x at DST. Preserves perms + times.
    # Status is written to stderr; ignore non-fatal warnings about
    # the .htaccess file changing during read etc.
    ( cd "$SRC" && tar -cf - "${TAR_EXCLUDES[@]}" . ) \
      | ( cd "$DST" && tar -xf - ) 2>>"$LOG"
    echo "      tar copy complete (see $LOG for any warnings)"
  fi
fi
echo ""

# -------- post-copy validation (only when applied) --------
if [ "$MODE" = "apply" ]; then
  echo "[3/4] Validating $DST ..."
  if [ ! -f "$DST/index.html" ]; then
    echo "ERROR: $DST/index.html missing after rsync."
    exit 3
  fi
  if ! grep -qiE 'imporlan|Importaci[oó]n de Lanchas' "$DST/index.html"; then
    echo "ERROR: $DST/index.html doesn't look like Imporlan after rsync."
    exit 4
  fi
  echo "      OK index.html present and looks like Imporlan"

  # Sample of key directories
  for d in assets panel api images cotizar-importacion lanchas-usadas marketplace; do
    if [ -d "$DST/$d" ]; then
      COUNT=$(find "$DST/$d" -type f 2>/dev/null | wc -l)
      echo "      OK $d/ present ($COUNT files)"
    else
      echo "      MISSING $d/"
    fi
  done

  echo ""
  echo "[4/4] Writing sentinel to $DST/.imporlan_docroot ..."
  cat > "$DST/.imporlan_docroot" <<SENTINEL_EOF
Imporlan doc-root.
Staged via migrate-imporlan-to-own-folder.sh on $TIMESTAMP.
Origin: $SRC
DO NOT DELETE -- deploy scripts check for this sentinel before writing.
SENTINEL_EOF
  chmod 644 "$DST/.imporlan_docroot"
  echo "      OK sentinel written"
fi

echo ""
echo "==============================================================="
echo "  Done ($MODE)."
echo "==============================================================="

if [ "$MODE" = "dry-run" ]; then
  cat <<NEXT
  This was a DRY RUN. No files were copied.

  To apply for real:
    bash $0 --apply

NEXT
else
  cat <<NEXT
  Files were copied. $SRC is UNTOUCHED.

  NEXT STEPS (in this order):

  1. Spot-check $DST manually:
       ls $DST/
       diff -rq $SRC/ $DST/ | head -30   # should only show the EXCLUDED Tourevo paths

  2. Reply to banahosting confirming you have the content staged and
     ask them to apply the docroot switch:
        /home/wwimpo/public_html  ->  /home/wwimpo/imporlan.cl

  3. After banahosting confirms the switch:
       curl -sL https://www.imporlan.cl/ | grep -oE '<title>[^<]+</title>'
       # should still show the Imporlan title

  4. Update auto-deploy.sh:
       sed -i 's#PUBLIC_HTML="/home/wwimpo/public_html"#PUBLIC_HTML="/home/wwimpo/imporlan.cl"#' \\
         /home/wwimpo/auto-deploy.sh

  5. Once verified for ~24h, you can clean $SRC (or leave it as parking).

NEXT
fi

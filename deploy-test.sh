#!/usr/bin/env bash
set -euo pipefail

STAGING_REPO="/home/wwimpo/imporlan-staging"
PUBLIC_HTML="/home/wwimpo/public_html"
BACKUP_DIR="/home/wwimpo/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H%M)

echo "============================================"
echo " IMPORLAN - Deploy TEST environments"
echo " $(date)"
echo "============================================"

if [ ! -d "$STAGING_REPO/.git" ]; then
  echo "ERROR: Staging repo not found at $STAGING_REPO"
  exit 1
fi

echo ""
echo "[1/7] Pulling latest changes from GitHub (main)..."
cd "$STAGING_REPO"
git checkout main
git pull origin main
echo "  -> Pull complete."

echo ""
echo "[2/7] Creating backup directory..."
mkdir -p "$BACKUP_DIR"
echo "  -> Backup directory ready: $BACKUP_DIR"

echo ""
echo "[3/7] Backing up and deploying Panel Test..."
if [ -d "$PUBLIC_HTML/panel-test" ]; then
  echo "  -> Backing up panel-test to panel-test_backup_${TIMESTAMP}"
  cp -a "$PUBLIC_HTML/panel-test" "$BACKUP_DIR/panel-test_backup_${TIMESTAMP}"
  echo "  -> Backup saved."
else
  echo "  -> No existing panel-test to backup, skipping."
  mkdir -p "$PUBLIC_HTML/panel-test"
fi

if [ ! -d "$STAGING_REPO/panel-test" ]; then
  echo "ERROR: Source panel-test not found at $STAGING_REPO/panel-test"
  exit 1
fi

rsync -a "$STAGING_REPO/panel-test/" "$PUBLIC_HTML/panel-test/"
echo "  -> Panel Test deployed (overlay, server-only files preserved)."

echo ""
echo "[4/7] Backing up and deploying Web Test..."
if [ -d "$PUBLIC_HTML/test" ]; then
  echo "  -> Backing up test to test_backup_${TIMESTAMP}"
  cp -a "$PUBLIC_HTML/test" "$BACKUP_DIR/test_backup_${TIMESTAMP}"
  echo "  -> Backup saved."
else
  echo "  -> No existing /test directory, will create it."
  mkdir -p "$PUBLIC_HTML/test"
fi

if [ ! -d "$STAGING_REPO/test" ]; then
  echo "ERROR: Source test not found at $STAGING_REPO/test"
  exit 1
fi

rsync -a "$STAGING_REPO/test/" "$PUBLIC_HTML/test/"
echo "  -> Web Test deployed (overlay, server-only files preserved)."

echo ""
echo "[5/7] Setting permissions..."
find "$PUBLIC_HTML/panel-test" -type d -exec chmod 755 {} \;
find "$PUBLIC_HTML/panel-test" -type f -exec chmod 644 {} \;
find "$PUBLIC_HTML/test" -type d -exec chmod 755 {} \;
find "$PUBLIC_HTML/test" -type f -exec chmod 644 {} \;
echo "  -> Permissions set (dirs: 755, files: 644)."

echo ""
echo "[6/7] Validating deployment..."
VALID=true

if [ ! -f "$PUBLIC_HTML/panel-test/index.html" ]; then
  echo "  ERROR: Missing /home/wwimpo/public_html/panel-test/index.html"
  VALID=false
fi

if [ ! -f "$PUBLIC_HTML/panel-test/admin/index.html" ]; then
  echo "  ERROR: Missing /home/wwimpo/public_html/panel-test/admin/index.html"
  VALID=false
fi

if [ ! -f "$PUBLIC_HTML/test/index.html" ]; then
  echo "  ERROR: Missing /home/wwimpo/public_html/test/index.html"
  VALID=false
fi

if [ "$VALID" = false ]; then
  echo ""
  echo "DEPLOY FAILED: One or more index.html files are missing."
  exit 1
fi
echo "  -> All index.html files verified."

echo ""
echo "[7/7] Cleaning old backups (keeping last 5)..."
for PREFIX in panel-test_backup test_backup; do
  BACKUPS=()
  while IFS= read -r -d '' entry; do
    BACKUPS+=("$entry")
  done < <(find "$BACKUP_DIR" -maxdepth 1 -type d -name "${PREFIX}_*" -print0 2>/dev/null | sort -z)
  COUNT=${#BACKUPS[@]}
  if [ "$COUNT" -gt 5 ]; then
    REMOVE=$((COUNT - 5))
    for (( i=0; i<REMOVE; i++ )); do
      rm -rf "${BACKUPS[$i]}"
      echo "  -> Removed old backup: $(basename "${BACKUPS[$i]}")"
    done
  fi
done
echo "  -> Cleanup complete."

echo ""
echo "============================================"
echo " Deployment finished successfully! OK"
echo ""
echo " Panel Test:       https://www.imporlan.cl/panel-test/"
echo " Admin Panel Test: https://www.imporlan.cl/panel-test/admin/"
echo " Web Test:         https://www.imporlan.cl/test/"
echo " API Test:         https://www.imporlan.cl/test/api/"
echo " Backups:          $BACKUP_DIR"
echo "============================================"

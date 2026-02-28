#!/usr/bin/env bash
set -euo pipefail

STAGING_REPO="/home/wwimpo/imporlan-staging"
PUBLIC_HTML="/home/wwimpo/public_html"
BACKUP_DIR="/home/wwimpo/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H%M)

echo "============================================"
echo " IMPORLAN - Deploy PRODUCTION"
echo " $(date)"
echo "============================================"

if [ ! -d "$STAGING_REPO/.git" ]; then
  echo "ERROR: Staging repo not found at $STAGING_REPO"
  exit 1
fi

echo ""
echo "[1/9] Pulling latest changes from GitHub (main)..."
cd "$STAGING_REPO"
git checkout main
git pull origin main
echo "  -> Pull complete."

echo ""
echo "[2/9] Creating backup directory..."
mkdir -p "$BACKUP_DIR"
echo "  -> Backup directory ready: $BACKUP_DIR"

echo ""
echo "[3/9] Backing up production assets..."
if [ -d "$PUBLIC_HTML/assets" ]; then
  echo "  -> Backing up assets to assets_backup_${TIMESTAMP}"
  cp -a "$PUBLIC_HTML/assets" "$BACKUP_DIR/assets_backup_${TIMESTAMP}"
  echo "  -> Backup saved."
fi
echo "  -> Assets backup complete."

echo ""
echo "[4/9] Backing up production API..."
if [ -d "$PUBLIC_HTML/api" ]; then
  echo "  -> Backing up api to api_backup_${TIMESTAMP}"
  cp -a "$PUBLIC_HTML/api" "$BACKUP_DIR/api_backup_${TIMESTAMP}"
  echo "  -> Backup saved."
fi
echo "  -> API backup complete."

echo ""
echo "[5/9] Backing up production Panel..."
if [ -d "$PUBLIC_HTML/panel" ]; then
  echo "  -> Backing up panel to panel_backup_${TIMESTAMP}"
  cp -a "$PUBLIC_HTML/panel" "$BACKUP_DIR/panel_backup_${TIMESTAMP}"
  echo "  -> Backup saved."
fi
echo "  -> Panel backup complete."

echo ""
echo "[5.5/9] Backing up production index.html..."
if [ -f "$PUBLIC_HTML/index.html" ]; then
  cp "$PUBLIC_HTML/index.html" "$BACKUP_DIR/index_backup_${TIMESTAMP}.html"
  echo "  -> index.html backup saved."
fi

echo ""
echo "[6/9] Deploying production files..."

# Deploy index.html (homepage)
if [ -f "$STAGING_REPO/index.html" ]; then
  cp "$STAGING_REPO/index.html" "$PUBLIC_HTML/index.html"
  chmod 644 "$PUBLIC_HTML/index.html"
  echo "  -> index.html deployed."
fi

# Deploy assets (JS, CSS)
rsync -a "$STAGING_REPO/assets/" "$PUBLIC_HTML/assets/"
echo "  -> Assets deployed."

# Deploy API (preserve db_config.php and server-only files)
rsync -a --exclude='db_config.php' --exclude='marketplace_photos/' "$STAGING_REPO/api/" "$PUBLIC_HTML/api/"
echo "  -> API deployed (db_config.php and photos preserved)."

# Deploy marketplace HTML files
cp "$STAGING_REPO/marketplace.html" "$PUBLIC_HTML/marketplace.html"
echo "  -> marketplace.html deployed."

rsync -a "$STAGING_REPO/marketplace/" "$PUBLIC_HTML/marketplace/"
echo "  -> marketplace/ directory deployed."

# Deploy panel assets
rsync -a "$STAGING_REPO/panel/" "$PUBLIC_HTML/panel/"
echo "  -> Panel deployed."

echo ""
echo "[7/9] Setting permissions..."
find "$PUBLIC_HTML/assets" -type d -exec chmod 755 {} \;
find "$PUBLIC_HTML/assets" -type f -exec chmod 644 {} \;
find "$PUBLIC_HTML/api" -type d -exec chmod 755 {} \;
find "$PUBLIC_HTML/api" -type f -exec chmod 644 {} \;
find "$PUBLIC_HTML/panel" -type d -exec chmod 755 {} \;
find "$PUBLIC_HTML/panel" -type f -exec chmod 644 {} \;
find "$PUBLIC_HTML/marketplace" -type d -exec chmod 755 {} \;
find "$PUBLIC_HTML/marketplace" -type f -exec chmod 644 {} \;
chmod 644 "$PUBLIC_HTML/marketplace.html"
echo "  -> Permissions set (dirs: 755, files: 644)."

echo ""
echo "[8/9] Validating deployment..."
VALID=true

if [ ! -f "$PUBLIC_HTML/marketplace.html" ]; then
  echo "  ERROR: Missing $PUBLIC_HTML/marketplace.html"
  VALID=false
fi

if [ ! -f "$PUBLIC_HTML/marketplace/index.html" ]; then
  echo "  ERROR: Missing $PUBLIC_HTML/marketplace/index.html"
  VALID=false
fi

if [ ! -f "$PUBLIC_HTML/assets/marketplace-public.js" ]; then
  echo "  ERROR: Missing $PUBLIC_HTML/assets/marketplace-public.js"
  VALID=false
fi

if [ ! -f "$PUBLIC_HTML/assets/marketplace-public.css" ]; then
  echo "  ERROR: Missing $PUBLIC_HTML/assets/marketplace-public.css"
  VALID=false
fi

if [ ! -f "$PUBLIC_HTML/api/marketplace_api.php" ]; then
  echo "  ERROR: Missing $PUBLIC_HTML/api/marketplace_api.php"
  VALID=false
fi

if [ ! -f "$PUBLIC_HTML/panel/index.html" ]; then
  echo "  ERROR: Missing $PUBLIC_HTML/panel/index.html"
  VALID=false
fi

if [ ! -f "$PUBLIC_HTML/index.html" ]; then
  echo "  ERROR: Missing $PUBLIC_HTML/index.html"
  VALID=false
fi

if [ "$VALID" = false ]; then
  echo ""
  echo "DEPLOY FAILED: One or more critical files are missing."
  echo "Backups are available at: $BACKUP_DIR"
  exit 1
fi
echo "  -> All critical files verified."

echo ""
echo "[9/9] Cleaning old production backups (keeping last 5)..."
for PREFIX in assets_backup api_backup panel_backup; do
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
echo " PRODUCTION Deployment finished successfully!"
echo ""
echo " Marketplace:  https://www.imporlan.cl/marketplace/"
echo " Panel:        https://www.imporlan.cl/panel/"
echo " Admin:        https://www.imporlan.cl/admin/"
echo " API:          https://www.imporlan.cl/api/"
echo " Backups:      $BACKUP_DIR"
echo "============================================"

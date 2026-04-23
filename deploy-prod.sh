#!/usr/bin/env bash
set -euo pipefail

STAGING_REPO="/home/wwimpo/imporlan-staging"
PUBLIC_HTML="/home/wwimpo/public_html"
BACKUP_DIR="/home/wwimpo/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
SENTINEL="$PUBLIC_HTML/.imporlan_docroot"
FORCE="${FORCE:-0}"

echo "============================================"
echo " IMPORLAN - Deploy PRODUCTION"
echo " $(date)"
echo "============================================"

if [ ! -d "$STAGING_REPO/.git" ]; then
  echo "ERROR: Staging repo not found at $STAGING_REPO"
  exit 1
fi

# Safety check: verify $PUBLIC_HTML is an Imporlan doc-root before we deploy on top of it.
# This prevents wiping out an unrelated site if $PUBLIC_HTML was repointed or if the
# account's doc-root was overwritten by another deploy (see incident 2026-04-19 where
# the primary doc-root was replaced with content from another project).
echo ""
echo "[0/9] Verifying doc-root identity ($PUBLIC_HTML)..."
if [ ! -d "$PUBLIC_HTML" ]; then
  echo "ERROR: \$PUBLIC_HTML ($PUBLIC_HTML) does not exist. Aborting."
  exit 1
fi

IDENTITY_OK=0
# Primary signal: a sentinel file is created by this script after every successful deploy.
if [ -f "$SENTINEL" ]; then
  IDENTITY_OK=1
fi
# Fallback signal: known Imporlan markers in live index.html (for the very first deploy
# after this change, before the sentinel exists yet).
if [ "$IDENTITY_OK" -eq 0 ] && [ -f "$PUBLIC_HTML/index.html" ]; then
  if grep -qiE 'imporlan|Importaci[oó]n de Lanchas' "$PUBLIC_HTML/index.html"; then
    IDENTITY_OK=1
  fi
fi

if [ "$IDENTITY_OK" -eq 0 ]; then
  echo "ERROR: $PUBLIC_HTML does not look like an Imporlan doc-root."
  echo "       No sentinel ($SENTINEL) and index.html has no Imporlan markers."
  echo ""
  echo "       Deploying on top of this directory would wipe out an unrelated site."
  echo "       If you are *certain* this is the correct target, re-run with FORCE=1:"
  echo "         FORCE=1 bash $0"
  if [ "$FORCE" != "1" ]; then
    # Snapshot whatever is there right now so we never silently destroy someone else's site.
    UNKNOWN_SNAPSHOT="$BACKUP_DIR/unknown_docroot_snapshot_${TIMESTAMP}"
    echo ""
    echo "       Taking a defensive snapshot to $UNKNOWN_SNAPSHOT before exiting."
    mkdir -p "$BACKUP_DIR"
    cp -a "$PUBLIC_HTML" "$UNKNOWN_SNAPSHOT" || true
    exit 2
  fi
  echo "       FORCE=1 set — continuing despite unknown doc-root."
fi
echo "  -> Doc-root identity check passed."

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
cp -a "$STAGING_REPO/assets/." "$PUBLIC_HTML/assets/"
echo "  -> Assets deployed."

# Deploy API (preserve db_config.php and server-only files)
# Backup server-only files before overwrite
if [ -f "$PUBLIC_HTML/api/db_config.php" ]; then
  cp "$PUBLIC_HTML/api/db_config.php" "/tmp/db_config_bak_${TIMESTAMP}.php"
fi
cp -a "$STAGING_REPO/api/." "$PUBLIC_HTML/api/"
# Restore server-only files
if [ -f "/tmp/db_config_bak_${TIMESTAMP}.php" ]; then
  cp "/tmp/db_config_bak_${TIMESTAMP}.php" "$PUBLIC_HTML/api/db_config.php"
fi
echo "  -> API deployed (db_config.php preserved)."

# Deploy marketplace HTML files
cp "$STAGING_REPO/marketplace.html" "$PUBLIC_HTML/marketplace.html"
echo "  -> marketplace.html deployed."

cp -a "$STAGING_REPO/marketplace/." "$PUBLIC_HTML/marketplace/"
echo "  -> marketplace/ directory deployed."

# Deploy panel assets
cp -a "$STAGING_REPO/panel/." "$PUBLIC_HTML/panel/"
echo "  -> Panel deployed."

# Deploy pago (payment page)
mkdir -p "$PUBLIC_HTML/pago"
cp -a "$STAGING_REPO/pago/." "$PUBLIC_HTML/pago/"
echo "  -> Pago page deployed."

# Deploy cotizador-importacion
mkdir -p "$PUBLIC_HTML/cotizador-importacion"
cp -a "$STAGING_REPO/cotizador-importacion/." "$PUBLIC_HTML/cotizador-importacion/"
echo "  -> Cotizador importacion deployed."

# Deploy simulacion-cotizacion
mkdir -p "$PUBLIC_HTML/simulacion-cotizacion"
cp -a "$STAGING_REPO/simulacion-cotizacion/." "$PUBLIC_HTML/simulacion-cotizacion/"
echo "  -> Simulacion cotizacion deployed."

# Deploy SEO content pages (landing pages)
SEO_PAGES=(
  "lanchas-usadas"
  "lanchas"
  "lanchas-de-pesca-usadas"
  "lanchas-de-ski"
  "botes-de-pesca"
  "embarcaciones"
  "embarcaciones-usadas"
  "veleros-en-venta"
  "comprar-lanchas-usadas-en-chile-o-en-usa"
  "como-comprar-lancha-usada-chile"
  "como-vender-moto-de-agua-chile"
  "costo-mantener-lancha-chile"
  "cuanto-cuesta-importar-una-lancha-a-chile"
  "documentos-tramites-vender-embarcacion-chile"
  "importacion-embarcaciones-usa-chile"
  "importacion-lanchas-chile"
  "importacion-veleros-chile"
  "importar-embarcaciones-usa"
  "importar-motos-de-agua-desde-usa"
  "inspeccion-precompra-embarcaciones"
  "logistica-maritima-importacion"
  "preguntas-frecuentes-embarcaciones-usadas"
  "casos-de-importacion"
)
for PAGE in "${SEO_PAGES[@]}"; do
  if [ -d "$STAGING_REPO/$PAGE" ]; then
    mkdir -p "$PUBLIC_HTML/$PAGE"
    cp -a "$STAGING_REPO/$PAGE/." "$PUBLIC_HTML/$PAGE/"
    echo "  -> $PAGE/ deployed."
  fi
done
echo "  -> SEO content pages deployed."

# Deploy sitemap.xml
if [ -f "$STAGING_REPO/sitemap.xml" ]; then
  cp "$STAGING_REPO/sitemap.xml" "$PUBLIC_HTML/sitemap.xml"
  chmod 644 "$PUBLIC_HTML/sitemap.xml"
  echo "  -> sitemap.xml deployed."
fi
if [ -f "$STAGING_REPO/sitemap-seo.xml" ]; then
  cp "$STAGING_REPO/sitemap-seo.xml" "$PUBLIC_HTML/sitemap-seo.xml"
  chmod 644 "$PUBLIC_HTML/sitemap-seo.xml"
  echo "  -> sitemap-seo.xml deployed."
fi

# Deploy .htaccess
if [ -f "$STAGING_REPO/.htaccess" ]; then
  cp "$STAGING_REPO/.htaccess" "$PUBLIC_HTML/.htaccess"
  chmod 644 "$PUBLIC_HTML/.htaccess"
  echo "  -> .htaccess deployed."
fi

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
find "$PUBLIC_HTML/pago" -type d -exec chmod 755 {} \;
find "$PUBLIC_HTML/pago" -type f -exec chmod 644 {} \;
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

# Write/refresh the doc-root identity sentinel. Checked at the start of the next
# deploy (step [0/9]) to abort if someone has repointed or overwritten $PUBLIC_HTML.
cat > "$SENTINEL" <<SENTINEL_EOF
imporlan
last_deploy: ${TIMESTAMP}
repo: jpchs1/Imporlan
SENTINEL_EOF
chmod 644 "$SENTINEL"
echo "  -> Sentinel refreshed: $SENTINEL"

echo ""
echo "[9/9] Cleaning old production backups (keeping last 5)..."
for PREFIX in assets_backup api_backup panel_backup; do
  BACKUPS=()
  for entry in "$BACKUP_DIR"/${PREFIX}_*; do
    [ -d "$entry" ] && BACKUPS+=("$entry")
  done
  if [ "${#BACKUPS[@]}" -gt 0 ]; then
    IFS=$'\n' BACKUPS=($(printf '%s\n' "${BACKUPS[@]}" | sort)); unset IFS
  fi
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

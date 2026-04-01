#!/usr/bin/env bash
set -euo pipefail

# ============================================
#  IMPORLAN - Auto Deploy from GitHub
#  Runs via cron, pulls latest and deploys
# ============================================

REPO_DIR="/home/wwimpo/imporlan-staging"
PUBLIC_HTML="/home/wwimpo/public_html"
BACKUP_DIR="/home/wwimpo/backups"
LOGFILE="/home/wwimpo/auto-deploy.log"
LOCKFILE="/home/wwimpo/.deploy.lock"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)

# Prevent concurrent runs
if [ -f "$LOCKFILE" ]; then
  echo "[$TIMESTAMP] Deploy already running, skipping." >> "$LOGFILE"
  exit 0
fi
trap 'rm -f "$LOCKFILE"' EXIT
touch "$LOCKFILE"

# Clone repo if it doesn't exist yet
if [ ! -d "$REPO_DIR/.git" ]; then
  echo "[$TIMESTAMP] Cloning repository..." >> "$LOGFILE"
  git clone https://github.com/jpchs1/Imporlan.git "$REPO_DIR" >> "$LOGFILE" 2>&1
fi

# Pull latest changes
cd "$REPO_DIR"
git fetch origin main >> "$LOGFILE" 2>&1

# Check if there are new changes
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  # No changes, nothing to deploy
  exit 0
fi

echo "[$TIMESTAMP] New changes detected. Deploying..." >> "$LOGFILE"
echo "  Local:  $LOCAL" >> "$LOGFILE"
echo "  Remote: $REMOTE" >> "$LOGFILE"

git checkout main >> "$LOGFILE" 2>&1
git pull origin main >> "$LOGFILE" 2>&1

# --- Pre-deploy: backup server-only files ---
mkdir -p "$BACKUP_DIR/pre_deploy_$TIMESTAMP"
[ -f "$PUBLIC_HTML/api/db_config.php" ] && cp "$PUBLIC_HTML/api/db_config.php" "$BACKUP_DIR/pre_deploy_$TIMESTAMP/db_config.php"
[ -d "$PUBLIC_HTML/api/marketplace_photos" ] && cp -a "$PUBLIC_HTML/api/marketplace_photos" "$BACKUP_DIR/pre_deploy_$TIMESTAMP/marketplace_photos"

# --- Deploy root files ---
for f in index.html marketplace.html robots.txt sitemap.xml favicon.ico .htaccess; do
  [ -f "$REPO_DIR/$f" ] && cp "$REPO_DIR/$f" "$PUBLIC_HTML/"
done

# --- Deploy all directories ---
DIRS=(
  assets api admin panel marketplace pago images
  cotizador-importacion cotizar-importacion simulacion-cotizacion
  embarcaciones embarcaciones-usadas
  lanchas lanchas-usadas lanchas-usadas-en-chile-2 lanchas-de-pesca-usadas lanchas-de-ski
  veleros-usados veleros-usados-a-la-venta-en-chile-o-usa
  botes-de-pesca
  importacion-lanchas-chile importacion-veleros-chile importacion-embarcaciones-usa-chile
  importar-embarcaciones-usa importar-motos-de-agua-desde-usa importaciones
  requisitos-importar-embarcaciones-chile cuanto-cuesta-importar-una-lancha-a-chile
  comprar-lanchas-usadas-en-chile-o-en-usa como-comprar-lancha-usada-chile
  como-vender-moto-de-agua-chile costo-mantener-lancha-chile
  casos-de-importacion servicios servicios-importacion
  seguro-embarcaciones-chile inspeccion-precompra-embarcaciones
  logistica-maritima-importacion transporte-logistica-embarcaciones-chile
  documentos-tramites-vender-embarcacion-chile preguntas-frecuentes-embarcaciones-usadas
  tipos-de-lanchas-segun-uso
)

for dir in "${DIRS[@]}"; do
  [ -d "$REPO_DIR/$dir" ] && cp -Rf "$REPO_DIR/$dir" "$PUBLIC_HTML/"
done

# --- Post-deploy: restore server-only files ---
[ -f "$BACKUP_DIR/pre_deploy_$TIMESTAMP/db_config.php" ] && cp "$BACKUP_DIR/pre_deploy_$TIMESTAMP/db_config.php" "$PUBLIC_HTML/api/db_config.php"
[ -d "$BACKUP_DIR/pre_deploy_$TIMESTAMP/marketplace_photos" ] && cp -a "$BACKUP_DIR/pre_deploy_$TIMESTAMP/marketplace_photos" "$PUBLIC_HTML/api/marketplace_photos"

# --- Set permissions ---
find "$PUBLIC_HTML" -type d -exec chmod 755 {} +
find "$PUBLIC_HTML" -type f -exec chmod 644 {} +

# --- Cleanup old backups (keep last 10) ---
cd "$BACKUP_DIR" && ls -dt pre_deploy_* 2>/dev/null | tail -n +11 | xargs rm -rf 2>/dev/null || true

echo "[$TIMESTAMP] Deploy complete. Now at $(git rev-parse --short HEAD)" >> "$LOGFILE"

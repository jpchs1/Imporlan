#!/usr/bin/env bash
set -euo pipefail

# ============================================
#  IMPORLAN - Auto Deploy from GitHub
#  Runs via cron, pulls latest and deploys
#
#  Safety: this script REFUSES to deploy on top of $PUBLIC_HTML unless it
#  can confirm the target is an Imporlan doc-root (sentinel + index.html
#  marker fallback). The doc-root is shared with tourevo.cl on this hosting
#  account, so a blind cp -Rf could wipe out Tourevo content if the
#  identity check is skipped. See DEPLOY-SAFETY.md.
# ============================================

REPO_DIR="/home/wwimpo/imporlan-staging"
PUBLIC_HTML="/home/wwimpo/imporlan.cl"
BACKUP_DIR="/home/wwimpo/backups"
LOGFILE="/home/wwimpo/auto-deploy.log"
LOCKFILE="/home/wwimpo/.deploy.lock"
SENTINEL="$PUBLIC_HTML/.imporlan_docroot"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)

log() { echo "[$TIMESTAMP] $*" >> "$LOGFILE"; }

# Prevent concurrent runs
if [ -f "$LOCKFILE" ]; then
  log "Deploy already running, skipping."
  exit 0
fi
trap 'rm -f "$LOCKFILE"' EXIT
touch "$LOCKFILE"

# Clone repo if it doesn't exist yet
if [ ! -d "$REPO_DIR/.git" ]; then
  log "Cloning repository..."
  git clone https://github.com/jpchs1/Imporlan.git "$REPO_DIR" >> "$LOGFILE" 2>&1
fi

# Pull latest changes
cd "$REPO_DIR"
git fetch origin main >> "$LOGFILE" 2>&1

# Check if there are new changes
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

log "New changes detected. Deploying..."
log "  Local:  $LOCAL"
log "  Remote: $REMOTE"

# ---------------------------------------------------------------------------
# IDENTITY CHECK: confirm $PUBLIC_HTML is an Imporlan doc-root before writing.
# Refuses to deploy if it looks like another site's content is currently
# living there. See deploy-prod.sh for the manual override (FORCE=1).
# ---------------------------------------------------------------------------
IDENTITY_OK=0
if [ -f "$SENTINEL" ]; then
  IDENTITY_OK=1
elif [ -f "$PUBLIC_HTML/index.html" ] && \
     grep -qiE 'imporlan|Importaci[oó]n de Lanchas' "$PUBLIC_HTML/index.html"; then
  IDENTITY_OK=1
fi
if [ "$IDENTITY_OK" -eq 0 ]; then
  log "ABORT: $PUBLIC_HTML does not look like an Imporlan doc-root."
  log "       No sentinel ($SENTINEL) and index.html has no Imporlan markers."
  log "       Refusing to overwrite — would clobber another site."
  mkdir -p "$BACKUP_DIR"
  UNKNOWN_SNAPSHOT="$BACKUP_DIR/unknown_docroot_${TIMESTAMP}"
  cp -a "$PUBLIC_HTML" "$UNKNOWN_SNAPSHOT" 2>/dev/null && \
    log "       Defensive snapshot saved at $UNKNOWN_SNAPSHOT."
  exit 2
fi

git checkout main >> "$LOGFILE" 2>&1
git pull origin main >> "$LOGFILE" 2>&1

# --- Pre-deploy: backup server-only files ---
mkdir -p "$BACKUP_DIR/pre_deploy_$TIMESTAMP"
[ -f "$PUBLIC_HTML/api/db_config.php" ] && cp "$PUBLIC_HTML/api/db_config.php" "$BACKUP_DIR/pre_deploy_$TIMESTAMP/db_config.php"
[ -d "$PUBLIC_HTML/api/marketplace_photos" ] && cp -a "$PUBLIC_HTML/api/marketplace_photos" "$BACKUP_DIR/pre_deploy_$TIMESTAMP/marketplace_photos"

# --- Pre-deploy: snapshot current index.html for emergency rollback ---
[ -f "$PUBLIC_HTML/index.html" ] && cp "$PUBLIC_HTML/index.html" "$BACKUP_DIR/pre_deploy_$TIMESTAMP/index.html.before"

# --- Deploy root files ---
for f in index.html marketplace.html robots.txt sitemap.xml favicon.ico .htaccess; do
  [ -f "$REPO_DIR/$f" ] && cp "$REPO_DIR/$f" "$PUBLIC_HTML/"
done

# --- Deploy all directories ---
DIRS=(
  assets api panel marketplace pago images
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

# --- Refresh sentinel (timestamp + commit) ---
cat > "$SENTINEL" <<SENTINEL_EOF
This directory is the Imporlan production doc-root.
Last deploy: $TIMESTAMP
Commit:      $(git rev-parse HEAD)
Do not delete this file -- deploy scripts check for it before writing.
SENTINEL_EOF
chmod 644 "$SENTINEL"

# --- Set permissions ---
find "$PUBLIC_HTML" -type d -exec chmod 755 {} +
find "$PUBLIC_HTML" -type f -exec chmod 644 {} +

# --- Post-deploy verification (catches overwrites by other deploys) ---
# Probe https://www.imporlan.cl/ and require the response to contain an
# Imporlan-identifying string. If not, restore the previous index.html
# and exit with error -- so the cron logs scream instead of leaving the
# site silently broken.
sleep 2
LIVE_BODY=$(curl -fsSL --max-time 15 -H 'Cache-Control: no-cache' "https://www.imporlan.cl/?cb=$TIMESTAMP" 2>/dev/null || true)
if echo "$LIVE_BODY" | grep -qiE 'imporlan|Importaci[oó]n de Lanchas'; then
  log "Verification OK: imporlan.cl serves Imporlan content."
else
  log "ALERT: imporlan.cl did NOT return Imporlan content after deploy."
  if [ -f "$BACKUP_DIR/pre_deploy_$TIMESTAMP/index.html.before" ]; then
    cp "$BACKUP_DIR/pre_deploy_$TIMESTAMP/index.html.before" "$PUBLIC_HTML/index.html"
    log "       Restored previous index.html from snapshot."
  fi
  exit 3
fi

# --- Cleanup old backups (keep last 10) ---
cd "$BACKUP_DIR" && ls -dt pre_deploy_* 2>/dev/null | tail -n +11 | xargs rm -rf 2>/dev/null || true

log "Deploy complete. Now at $(git rev-parse --short HEAD)"

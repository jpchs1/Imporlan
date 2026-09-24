#!/usr/bin/env bash
# ============================================
#  IMPORLAN - Deploy automatico al mergear a main
#
#  Lo corre el cron de cPanel cada 5 minutos. Si origin/main tiene un commit
#  que todavia no esta publicado, ejecuta deploy-prod.sh (el mismo deploy
#  manual, con sus chequeos de doc-root, respaldos y validacion). Si no hay
#  nada nuevo, sale sin hacer nada.
#
#  Linea del cron (cPanel -> Cron Jobs), se actualiza sola desde main:
#  */5 * * * * cd /home/wwimpo/imporlan-staging && git fetch -q origin main && git show origin/main:cron-deploy.sh > /home/wwimpo/cron-deploy.sh && bash /home/wwimpo/cron-deploy.sh >> /home/wwimpo/cron-deploy.log 2>&1
#
#  Para verificar que se publico: https://www.imporlan.cl/.imporlan_docroot
#  muestra el commit desplegado.
# ============================================

# Todo dentro de { }: bash lo lee completo antes de ejecutar, asi el
# `git reset` de deploy-prod.sh no le cambia el archivo a medio camino.
{
set -uo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin

STAGING_REPO="/home/wwimpo/imporlan-staging"
STATE_FILE="/home/wwimpo/.imporlan_last_deployed"
LOCK_FILE="/home/wwimpo/.cron-deploy.lock"
RUN_COPY="/home/wwimpo/deploy-prod.run.sh"
FAIL_FILE="/home/wwimpo/.imporlan_deploy_failures"
MAX_TRIES=3

# Estado publico (sin datos sensibles) para verificar el cron desde fuera:
# https://www.imporlan.cl/.imporlan_deploy_status
STATUS_FILE="/home/wwimpo/imporlan.cl/.imporlan_deploy_status"
status() { echo "checked: $(date '+%F %T') | $*" > "$STATUS_FILE" 2>/dev/null; echo "[$(date '+%F %T')] $*"; }

if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  flock -n 9 || exit 0
fi

cd "$STAGING_REPO" || { status "ERROR: no existe $STAGING_REPO"; exit 1; }
git fetch -q origin main || { status "ERROR: git fetch fallo"; exit 1; }

TARGET=$(git rev-parse origin/main)
LAST=$(cat "$STATE_FILE" 2>/dev/null || true)
# Sin cambios: solo el archivo de estado, sin escribir en el log.
[ "$TARGET" = "$LAST" ] && { status "OK sin cambios | publicado: ${LAST:0:7}" > /dev/null; exit 0; }

# Un commit que falla se reintenta a lo mas MAX_TRIES veces (cada intento
# deja respaldos); despues espera al siguiente commit en main.
read -r FAIL_SHA FAIL_COUNT 2>/dev/null < "$FAIL_FILE" || true
if [ "${FAIL_SHA:-}" = "$TARGET" ] && [ "${FAIL_COUNT:-0}" -ge "$MAX_TRIES" ]; then
  status "BLOQUEADO: ${TARGET:0:7} fallo $MAX_TRIES veces | publicado: ${LAST:0:7}"
  exit 0
fi

status "DESPLEGANDO ${TARGET:0:7} (antes: ${LAST:0:7})"

# Copia fija del script de deploy de ese commit.
git show "$TARGET:deploy-prod.sh" > "$RUN_COPY" || exit 1

if bash "$RUN_COPY"; then
  echo "$TARGET" > "$STATE_FILE"
  rm -f "$FAIL_FILE"
  status "OK desplegado: ${TARGET:0:7}"
else
  CODE=$?
  [ "${FAIL_SHA:-}" = "$TARGET" ] && N=$(( ${FAIL_COUNT:-0} + 1 )) || N=1
  echo "$TARGET $N" > "$FAIL_FILE"
  status "FALLO (exit $CODE) en ${TARGET:0:7}, intento $N de $MAX_TRIES | publicado: ${LAST:0:7}"
  exit "$CODE"
fi
exit 0
}

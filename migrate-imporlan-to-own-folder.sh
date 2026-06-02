#!/usr/bin/env bash
# ============================================
#  migrate-imporlan-to-own-folder.sh
# ============================================
#  Stage Imporlan's content into ~/imporlan.cl/ in preparation for
#  banahosting changing the imporlan.cl Document Root from /public_html
#  to /imporlan.cl. Pre-populating ahead of time means the switch is
#  transparent to users (zero perceived downtime).
#
#  STRATEGY -- INCLUSION LIST, NOT EXCLUSION
#  ------------------------------------------
#  ~/public_html/ is currently a mixed bag: Imporlan content + Tourevo
#  stragglers + ambiguous shared stuff (favicons, llms.txt, etc.).
#
#  Instead of trying to enumerate everything we DON'T want, we
#  enumerate exactly what we DO want -- the Imporlan production
#  manifest (49 directories + 1 PDF lib + a handful of root files
#  that are present in the github.com/jpchs1/Imporlan repo).
#
#  Anything not on the list is left untouched at ~/public_html/.
#  This is safer than excludes because if Tourevo's deploys drop new
#  random directories in the future, they won't auto-leak into our
#  fresh imporlan.cl/ folder.
#
#  USAGE
#    bash migrate-imporlan-to-own-folder.sh           # dry-run + report (default)
#    bash migrate-imporlan-to-own-folder.sh --apply   # actually copy
# ============================================
set -euo pipefail

SRC="/home/wwimpo/public_html"
DST="/home/wwimpo/imporlan.cl"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_DIR="/home/wwimpo/backups"
LOG="/home/wwimpo/imporlan-migration-$TIMESTAMP.log"

MODE="dry-run"
if [ "${1:-}" = "--apply" ]; then MODE="apply"; fi

# --------------------------------------------------------------------
# Imporlan production manifest
# Source of truth: github.com/jpchs1/Imporlan main branch top-level
# directories (49) + lib/ (server-only, used by cotizador-importacion
# for dompdf PDF rendering) + the 5 root files the repo ships +
# .htaccess (managed by the Imporlan repo).
# --------------------------------------------------------------------
IMPORLAN_DIRS=(
  admin-react
  api
  assets
  botes-de-pesca
  casos-de-importacion
  como-comprar-lancha-usada-chile
  como-vender-moto-de-agua-chile
  comprar-lanchas-usadas-en-chile-o-en-usa
  costo-mantener-lancha-chile
  cotizador-importacion
  cotizar-importacion
  cuanto-cuesta-importar-una-lancha-a-chile
  documentos-tramites-vender-embarcacion-chile
  embarcaciones
  embarcaciones-usadas
  images
  importacion-de-lanchas
  importacion-embarcaciones-usa-chile
  importacion-lanchas-chile
  importacion-veleros-chile
  importaciones
  importar-embarcaciones-usa
  importar-motos-de-agua-desde-usa
  inspeccion-precompra-embarcaciones
  lanchas
  lanchas-de-pesca-usadas
  lanchas-de-ski
  lanchas-usadas
  lanchas-usadas-baratas-chile
  lanchas-usadas-en-chile-2
  lanchas-usadas-marcas
  lanchas-usadas-santiago
  lib
  logistica-maritima-importacion
  marketplace
  mejores-lanchas-usadas-chile
  pago
  panel
  panel-test
  precio-lanchas-usadas-chile
  preguntas-frecuentes-embarcaciones-usadas
  requisitos-importar-embarcaciones-chile
  seguro-embarcaciones-chile
  servicios
  servicios-importacion
  simulacion-cotizacion
  t
  test
  tipos-de-lanchas-segun-uso
  transporte-logistica-embarcaciones-chile
  veleros-usados
  veleros-usados-a-la-venta-en-chile-o-usa
  # Server-side runtime dirs (NOT in the github repo, but written by
  # Imporlan PHP at runtime and required for /panel/admin and the
  # cotizador image cache to keep working after the doc-root switch):
  #   .admin_profiles    - written by api/admin_profile.php + api/admin_avatar.php
  #                        (admin user profiles + avatar images)
  #   .admin_reset_tokens - written by api/admin_forgot_password.php +
  #                         api/admin_reset_password.php (password reset)
  #   uploads            - written by api/image_cache.php +
  #                        api/link_scraper.php (cached boat photos served
  #                        from https://www.imporlan.cl/uploads/order_images/)
  .admin_profiles
  .admin_reset_tokens
  uploads
)

IMPORLAN_FILES=(
  .htaccess
  favicon.ico
  index.html
  marketplace.html
  robots.txt
  sitemap.xml
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
echo "  Strategy: inclusion list (only Imporlan paths copied)."
echo "  Anything else at $SRC stays where it is."
echo ""

# --------------------------------------------------------------------
# Pre-flight: source must exist and look like Imporlan
# --------------------------------------------------------------------
if [ ! -d "$SRC" ]; then
  echo "ERROR: $SRC does not exist."
  exit 1
fi
if [ ! -f "$SRC/index.html" ] || ! grep -qiE 'imporlan|Importaci[oó]n de Lanchas' "$SRC/index.html"; then
  echo "ERROR: $SRC/index.html does not look like Imporlan."
  echo "       Refusing to copy."
  exit 2
fi
echo "[pre-flight] $SRC/index.html looks like Imporlan: OK"
echo "[pre-flight] $SRC total size: $(du -sh "$SRC" 2>/dev/null | awk '{print $1}')"
echo ""

# --------------------------------------------------------------------
# Verify each manifest entry exists at $SRC and report
# --------------------------------------------------------------------
echo "[manifest] Imporlan directories that will be copied:"
MISSING=()
TOTAL_SIZE=0
for d in "${IMPORLAN_DIRS[@]}"; do
  if [ -d "$SRC/$d" ]; then
    SIZE=$(du -sh "$SRC/$d" 2>/dev/null | awk '{print $1}')
    printf "    OK %-55s %s\n" "$d/" "$SIZE"
  else
    printf "    -- %-55s (not present, skipping)\n" "$d/"
    MISSING+=("$d")
  fi
done

echo ""
echo "[manifest] Imporlan root files that will be copied:"
for f in "${IMPORLAN_FILES[@]}"; do
  if [ -f "$SRC/$f" ]; then
    SIZE=$(du -h "$SRC/$f" 2>/dev/null | awk '{print $1}')
    printf "    OK %-55s %s\n" "$f" "$SIZE"
  else
    printf "    -- %-55s (not present, skipping)\n" "$f"
    MISSING+=("$f")
  fi
done

echo ""
echo "[manifest] Items at $SRC that will be LEFT BEHIND"
echo "           (not in the Imporlan manifest -- could be Tourevo or"
echo "            third-party files; we don't move what we don't own):"
( cd "$SRC" && ls -1A ) | while read item; do
  KNOWN=0
  for d in "${IMPORLAN_DIRS[@]}" "${IMPORLAN_FILES[@]}"; do
    if [ "$item" = "$d" ]; then KNOWN=1; break; fi
  done
  if [ "$KNOWN" -eq 0 ]; then
    if [ -d "$SRC/$item" ]; then
      SIZE=$(du -sh "$SRC/$item" 2>/dev/null | awk '{print $1}')
      printf "    -- %-55s %s\n" "$item/" "$SIZE"
    else
      printf "    -- %-55s (file)\n" "$item"
    fi
  fi
done

echo ""

# --------------------------------------------------------------------
# Confirm if --apply
# --------------------------------------------------------------------
if [ "$MODE" = "apply" ]; then
  echo "About to copy the Imporlan manifest items from $SRC into $DST"
  if [ -d "$DST" ]; then
    echo "WARNING: $DST already exists. It will be backed up first."
  fi
  read -p "Type 'yes' to proceed: " ANS
  [ "$ANS" = "yes" ] || { echo "Aborted by user."; exit 0; }

  if [ -d "$DST" ]; then
    mkdir -p "$BACKUP_DIR"
    EXISTING_BACKUP="$BACKUP_DIR/imporlan.cl_pre_migration_$TIMESTAMP"
    echo "[1/4] Backing up existing $DST -> $EXISTING_BACKUP"
    mv "$DST" "$EXISTING_BACKUP"
  fi
  mkdir -p "$DST"
fi

# --------------------------------------------------------------------
# Build the tar argument list (only items that exist at $SRC)
# --------------------------------------------------------------------
TAR_ARGS=()
for d in "${IMPORLAN_DIRS[@]}"; do
  [ -d "$SRC/$d" ] && TAR_ARGS+=("./$d")
done
for f in "${IMPORLAN_FILES[@]}"; do
  [ -f "$SRC/$f" ] && TAR_ARGS+=("./$f")
done

if [ ${#TAR_ARGS[@]} -eq 0 ]; then
  echo "ERROR: nothing to copy (no manifest items found at $SRC)."
  exit 4
fi

# --------------------------------------------------------------------
# Copy (prefer rsync, fall back to tar)
# --------------------------------------------------------------------
echo "[2/4] Copying ${#TAR_ARGS[@]} manifest items (mode: $MODE) ..."
echo "      Logging to $LOG"

if command -v rsync >/dev/null 2>&1; then
  echo "      Using rsync"
  RSYNC_FLAG=""
  [ "$MODE" = "dry-run" ] && RSYNC_FLAG="-n"
  RSYNC_PATHS=()
  for p in "${TAR_ARGS[@]}"; do RSYNC_PATHS+=("$SRC/${p#./}"); done
  rsync -av $RSYNC_FLAG "${RSYNC_PATHS[@]}" "$DST/" 2>&1 | tee "$LOG" | tail -40
else
  echo "      rsync not available, using tar"
  if [ "$MODE" = "dry-run" ]; then
    ( cd "$SRC" && tar -cvf /dev/null "${TAR_ARGS[@]}" ) 2>&1 | tee "$LOG" | tail -40
    echo "      (dry-run: nothing was written to $DST)"
  else
    ( cd "$SRC" && tar -cf - "${TAR_ARGS[@]}" ) \
      | ( cd "$DST" && tar -xf - ) 2>>"$LOG"
    echo "      tar copy complete (see $LOG for any warnings)"
  fi
fi
echo ""

# --------------------------------------------------------------------
# Post-copy validation (only when applied)
# --------------------------------------------------------------------
if [ "$MODE" = "apply" ]; then
  echo "[3/4] Validating $DST ..."
  if [ ! -f "$DST/index.html" ]; then
    echo "ERROR: $DST/index.html missing after copy."
    exit 3
  fi
  if ! grep -qiE 'imporlan|Importaci[oó]n de Lanchas' "$DST/index.html"; then
    echo "ERROR: $DST/index.html doesn't look like Imporlan after copy."
    exit 4
  fi
  echo "      OK index.html present and looks like Imporlan"
  for d in assets panel api images cotizar-importacion lanchas-usadas marketplace; do
    if [ -d "$DST/$d" ]; then
      COUNT=$(find "$DST/$d" -type f 2>/dev/null | wc -l)
      echo "      OK $d/ present ($COUNT files)"
    fi
  done

  echo ""
  echo "[4/4] Writing sentinel to $DST/.imporlan_docroot ..."
  cat > "$DST/.imporlan_docroot" <<SENTINEL_EOF
Imporlan doc-root.
Staged via migrate-imporlan-to-own-folder.sh on $TIMESTAMP.
Origin: $SRC (only Imporlan manifest items copied; rest left at origin).
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

  Review the "manifest" sections above:
    - "OK" lines under "Imporlan directories" / "root files" = will be copied
    - "--" lines under "LEFT BEHIND" = will stay at $SRC (untouched)

  To apply for real:
    bash $0 --apply
NEXT
else
  cat <<NEXT
  Imporlan files were copied to $DST.
  $SRC is UNTOUCHED -- non-Imporlan content remains there.

  NEXT STEPS:

  1. Sanity check $DST:
       ls $DST/
       du -sh $DST/

  2. Reply to banahosting asking them to apply the docroot switch:
        /home/wwimpo/public_html  ->  /home/wwimpo/imporlan.cl

  3. After banahosting confirms:
       curl -sL "https://www.imporlan.cl/?cb=\$(date +%s)" \\
         | grep -oE '<title>[^<]+</title>'

  4. Update auto-deploy.sh:
       sed -i 's#PUBLIC_HTML="/home/wwimpo/public_html"#PUBLIC_HTML="/home/wwimpo/imporlan.cl"#' \\
         /home/wwimpo/auto-deploy.sh

  5. Once verified for ~24h, you can decide what to do with the
     leftover content at $SRC (it stays there, untouched -- the new
     docroot ignores it).
NEXT
fi

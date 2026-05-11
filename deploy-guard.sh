#!/usr/bin/env bash
# ============================================
#  deploy-guard.sh
# ============================================
#  Sentinel-aware doc-root identity guard.
#
#  PURPOSE
#  -------
#  imporlan.cl and tourevo.cl share the same cPanel account
#  (/home/wwimpo/public_html). Any naive `cp -Rf` from a Tourevo build
#  into $PUBLIC_HTML will obliterate Imporlan content (this has happened).
#  Conversely a Tourevo-deployed `index.html` will replace Imporlan's.
#
#  This script must be sourced (or called) by every deploy script before
#  it writes a single byte into the target directory. It checks:
#
#    1. A `.<site>_docroot` sentinel file is present, OR
#    2. The existing `index.html` contains a site-identifying marker.
#
#  If neither is true the script refuses and exits non-zero so the deploy
#  aborts. The caller can override with FORCE=1.
#
#  USAGE (from any deploy script)
#  ------------------------------
#  Call directly:
#    bash /path/to/deploy-guard.sh \
#         --target /home/wwimpo/public_html \
#         --site imporlan \
#         --marker 'imporlan|Importaci[oó]n de Lanchas' \
#         --backup-dir /home/wwimpo/backups
#
#  Or source it for use as a function:
#    source /path/to/deploy-guard.sh
#    deploy_guard \
#      --target /home/wwimpo/tourevo \
#      --site tourevo \
#      --marker 'Tourevo|Tours Privados' \
#      --backup-dir /home/wwimpo/backups
#
#  EXIT CODES
#  ----------
#    0   -> doc-root identity matches, safe to deploy.
#    2   -> doc-root looks unrelated (different site or empty). Aborted.
#    3   -> target directory missing.
# ============================================

deploy_guard() {
  local TARGET="" SITE="" MARKER="" BACKUP_DIR=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --target)     TARGET="$2";     shift 2 ;;
      --site)       SITE="$2";       shift 2 ;;
      --marker)     MARKER="$2";     shift 2 ;;
      --backup-dir) BACKUP_DIR="$2"; shift 2 ;;
      *)            echo "deploy_guard: unknown arg $1" >&2; return 64 ;;
    esac
  done

  if [ -z "$TARGET" ] || [ -z "$SITE" ] || [ -z "$MARKER" ]; then
    echo "deploy_guard: --target, --site and --marker are required" >&2
    return 64
  fi

  if [ ! -d "$TARGET" ]; then
    echo "deploy_guard: target $TARGET does not exist" >&2
    return 3
  fi

  local SENTINEL="$TARGET/.${SITE}_docroot"
  local OK=0
  [ -f "$SENTINEL" ] && OK=1
  if [ "$OK" -eq 0 ] && [ -f "$TARGET/index.html" ]; then
    grep -qiE "$MARKER" "$TARGET/index.html" && OK=1
  fi

  if [ "$OK" -eq 1 ]; then
    return 0
  fi

  echo ""
  echo "================================================"
  echo "  deploy_guard REFUSED to deploy $SITE on top of"
  echo "  $TARGET"
  echo "  - sentinel $SENTINEL: $([ -f "$SENTINEL" ] && echo present || echo MISSING)"
  echo "  - index.html marker:  MISSING"
  echo "  This usually means another site is currently living"
  echo "  in this directory. Set FORCE=1 to override."
  echo "================================================"

  if [ "${FORCE:-0}" = "1" ]; then
    echo "  FORCE=1 set, continuing anyway."
    return 0
  fi

  if [ -n "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    local SNAP="$BACKUP_DIR/unknown_docroot_$(date +%Y-%m-%d_%H%M%S)"
    cp -a "$TARGET" "$SNAP" 2>/dev/null && \
      echo "  Defensive snapshot of current $TARGET saved at: $SNAP"
  fi
  return 2
}

# When called directly (not sourced), parse args and exit with the
# guard's return code.
if [ "${BASH_SOURCE[0]:-$0}" = "${0}" ]; then
  deploy_guard "$@"
  exit $?
fi

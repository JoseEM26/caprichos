#!/usr/bin/env bash
# ==============================================================================
# limpiar-imagenes.sh — Limpieza segura y automática de imágenes Docker viejas
# ==============================================================================
# Uso:
#   ./limpiar-imagenes.sh [TAG_ACTUAL] [TAG_PREVIA] [IMAGENES_CONSERVAR] [REPOSITORIOS...]
#
# Variables de entorno opcionales:
#   LIMPIEZA_SIMULACRO=1      Modo simulación: lista candidatos y espacio sin borrar nada.
#   IMAGENES_CONSERVAR=5      Cantidad de imágenes recientes a conservar por repo (defecto: 5).
#   TAG                       Etiqueta de la versión actual a proteger.
#   TAG_PREVIA                Etiqueta de la versión previa a proteger para rollback.
#
# Reglas de seguridad (estrictas):
# 1. Corre SOLO al final de un despliegue exitoso. NUNCA hace fallar el despliegue.
# 2. Solo toca repositorios de la aplicación: ghcr.io/<owner>/caprichos-api,
#    ghcr.io/<owner>/caprichos-web y locales caprichos-api / caprichos-web.
#    JAMÁS postgres, redis, traefik, ni otras aplicaciones ajenas.
# 3. Conserva:
#    - Imágenes de contenedores en ejecución (nombre o ID de imagen)
#    - TAG actual del despliegue
#    - TAG previa (para permitir rollback inmediato)
#    - Las últimas N etiquetas por repositorio ordenadas por fecha (IMAGENES_CONSERVAR, def. 5)
# 4. Elimina imágenes colgantes huérfanas (dangling) con docker image prune -f.
# 5. Modo simulación con LIMPIEZA_SIMULACRO=1 (solo lista candidatos y espacio).
# 6. Informa cantidad de imágenes eliminadas y espacio liberado (MB / GB).
# 7. No depende de plugins ni herramientas externas fuera de docker y bash estándar.
# ==============================================================================

set -uo pipefail

limpiar_imagenes_viejas() {
  local TAG_ACTUAL="${1:-${TAG:-}}"
  local TAG_ANTERIOR="${2:-${TAG_PREVIA:-}}"
  local CONSERVAR="${3:-${IMAGENES_CONSERVAR:-5}}"
  local SIMULACRO="${LIMPIEZA_SIMULACRO:-0}"
  shift 3 2>/dev/null || true
  local REPOS_FORZADOS=("$@")

  echo ""
  echo "========================================================================"
  if [[ "$SIMULACRO" == "1" || "$SIMULACRO" == "true" ]]; then
    echo "   [SIMULACRO] LIMPIEZA DE IMÁGENES DOCKER VIEJAS — CAPRICHOS"
  else
    echo "   LIMPIEZA AUTOMÁTICA DE IMÁGENES DOCKER VIEJAS — CAPRICHOS"
  fi
  echo "========================================================================"

  # 1. Recopilar imágenes en uso por contenedores activos (referencia e ID sha256)
  local IMGS_EN_USO=()
  while IFS= read -r linea; do
    [[ -n "$linea" ]] && IMGS_EN_USO+=("$linea")
  done < <(docker ps --format '{{.Image}}' 2>/dev/null || true)

  while IFS= read -r cid; do
    if [[ -n "$cid" ]]; then
      local iid
      iid=$(docker inspect --format '{{.Image}}' "$cid" 2>/dev/null || true)
      [[ -n "$iid" ]] && IMGS_EN_USO+=("$iid")
    fi
  done < <(docker ps -q 2>/dev/null || true)

  # 2. Identificar repositorios de la aplicación
  local REPOS_APP=()
  if [[ ${#REPOS_FORZADOS[@]} -gt 0 ]]; then
    for r in "${REPOS_FORZADOS[@]}"; do
      # Verificación de seguridad: solo repositorios que coincidan con caprichos-api o caprichos-web
      if [[ "$r" =~ (^|/)caprichos-(api|web)$ ]]; then
        REPOS_APP+=("$r")
      else
        echo "AVISO: Se omite repositorio ajeno '$r' por regla de seguridad." >&2
      fi
    done
  else
    local REPOS_TODOS
    REPOS_TODOS=$(docker images --format '{{.Repository}}' 2>/dev/null | sort -u || true)
    for repo in $REPOS_TODOS; do
      if [[ "$repo" =~ (^|/)caprichos-(api|web)$ ]]; then
        REPOS_APP+=("$repo")
      fi
    done
  fi

  if [[ ${#REPOS_APP[@]} -eq 0 ]]; then
    echo "==> No se encontraron repositorios de aplicación para evaluar."
    if [[ "$SIMULACRO" != "1" && "$SIMULACRO" != "true" ]]; then
      echo "==> Purgando imágenes colgantes huérfanas (dangling)..."
      docker image prune -f 2>&1 || true
    fi
    return 0
  fi

  echo "==> Repositorios evaluados: ${REPOS_APP[*]}"
  echo "==> Parámetros: Conservar últimas ${CONSERVAR} | TAG actual: '${TAG_ACTUAL:-ninguna}' | TAG previa: '${TAG_ANTERIOR:-ninguna}'"

  local TOTAL_CANDIDATOS=0
  local TOTAL_BYTES=0
  local IMAGENES_A_BORRAR=()

  # 3. Analizar cada repositorio
  for repo in "${REPOS_APP[@]}"; do
    echo "--- Repositorio: ${repo} ---"
    # Obtener todas las tags válidas ordenadas cronológicamente (más recientes primero)
    local TAGS_ORDENADAS=()
    while IFS=$'\t' read -r fecha tag; do
      [[ -n "$tag" && "$tag" != "<none>" ]] && TAGS_ORDENADAS+=("$tag")
    done < <(docker images "$repo" --format '{{.CreatedAt}}\t{{.Tag}}' 2>/dev/null | grep -v '<none>' | sort -r -k1,2 || true)

    # Deduplicar tags preservando orden cronológico
    local TAGS_UNICAS=()
    if [[ ${#TAGS_ORDENADAS[@]} -gt 0 ]]; then
      while IFS= read -r utag; do
        [[ -n "$utag" ]] && TAGS_UNICAS+=("$utag")
      done < <(printf "%s\n" "${TAGS_ORDENADAS[@]}" | awk '!seen[$0]++')
    fi

    # Identificar tags a conservar por regla de N más recientes
    local TAGS_PROTEGIDAS_RECIENTES=()
    local idx=0
    for t in "${TAGS_UNICAS[@]}"; do
      if [[ $idx -lt $CONSERVAR ]]; then
        TAGS_PROTEGIDAS_RECIENTES+=("$t")
        idx=$((idx + 1))
      fi
    done

    # Evaluar cada tag del repositorio
    for t in "${TAGS_UNICAS[@]}"; do
      local REF="${repo}:${t}"
      local PROTEGER=0
      local MOTIVOS=()

      # Regla A: Es la TAG actual
      if [[ -n "$TAG_ACTUAL" && "$t" == "$TAG_ACTUAL" ]]; then
        PROTEGER=1
        MOTIVOS+=("TAG actual")
      fi

      # Regla B: Es la TAG previa para rollback
      if [[ -n "$TAG_ANTERIOR" && "$TAG_ANTERIOR" != "inicial" && "$t" == "$TAG_ANTERIOR" ]]; then
        PROTEGER=1
        MOTIVOS+=("TAG previa")
      fi

      # Regla C: Está dentro de las N más recientes
      for pt in "${TAGS_PROTEGIDAS_RECIENTES[@]}"; do
        if [[ "$t" == "$pt" ]]; then
          PROTEGER=1
          MOTIVOS+=("Top ${CONSERVAR} reciente")
          break
        fi
      done

      # Regla D: Está en uso por un contenedor activo (por nombre o por ID sha256)
      local IID
      IID=$(docker inspect --format '{{.Id}}' "$REF" 2>/dev/null || true)
      for en_uso in "${IMGS_EN_USO[@]}"; do
        if [[ "$en_uso" == "$REF" || ( -n "$IID" && "$en_uso" == "$IID" ) ]]; then
          PROTEGER=1
          MOTIVOS+=("En uso por contenedor activo")
          break
        fi
      done

      if [[ $PROTEGER -eq 1 ]]; then
        local MOTIVO_STR
        MOTIVO_STR=$(IFS=", "; echo "${MOTIVOS[*]}")
        echo "    [CONSERVAR] ${REF} (${MOTIVO_STR})"
      else
        local BYTES
        BYTES=$(docker inspect --format '{{.Size}}' "$REF" 2>/dev/null || echo 0)
        TOTAL_BYTES=$((TOTAL_BYTES + BYTES))
        TOTAL_CANDIDATOS=$((TOTAL_CANDIDATOS + 1))
        IMAGENES_A_BORRAR+=("$REF")
        local MB_IMG
        MB_IMG=$(awk "BEGIN {printf \"%.2f\", $BYTES / 1024 / 1024}")
        echo "    [BORRAR]    ${REF} (${MB_IMG} MB)"
      fi
    done
  done

  # Convertir total de bytes a MB y GB legibles
  local MB_LIBERADOS
  local GB_LIBERADOS
  MB_LIBERADOS=$(awk "BEGIN {printf \"%.2f\", $TOTAL_BYTES / 1024 / 1024}")
  GB_LIBERADOS=$(awk "BEGIN {printf \"%.3f\", $TOTAL_BYTES / 1024 / 1024 / 1024}")

  # 4. Modo Simulación vs Ejecución Real
  if [[ "$SIMULACRO" == "1" || "$SIMULACRO" == "true" ]]; then
    echo "------------------------------------------------------------------------"
    echo "==> [SIMULACRO] Se identificaron ${TOTAL_CANDIDATOS} imágenes para eliminar."
    echo "==> [SIMULACRO] Espacio estimado a liberar: ${MB_LIBERADOS} MB (${GB_LIBERADOS} GB)."
    echo "==> [SIMULACRO] Ninguna imagen fue eliminada."
    echo "========================================================================"
    return 0
  fi

  # 5. Ejecución Real de Eliminación
  local BORRADAS_OK=0
  if [[ ${#IMAGENES_A_BORRAR[@]} -gt 0 ]]; then
    echo "------------------------------------------------------------------------"
    echo "==> Eliminando ${#IMAGENES_A_BORRAR[@]} imágenes antiguas de la aplicación..."
    for img in "${IMAGENES_A_BORRAR[@]}"; do
      if docker rmi "$img" >/dev/null 2>&1; then
        BORRADAS_OK=$((BORRADAS_OK + 1))
        echo "    ✓ Eliminada: ${img}"
      else
        echo "    ⚠ No se pudo eliminar (posible capa compartida o dependencia activa): ${img}" >&2
      fi
    done
  else
    echo "==> No se requirió eliminar imágenes de aplicación."
  fi

  # 6. Purgar imágenes colgantes (dangling)
  echo "==> Purgando imágenes colgantes huérfanas (docker image prune -f)..."
  local SALIDA_PRUNE
  SALIDA_PRUNE=$(docker image prune -f 2>&1 || true)
  local ESPACIO_PRUNE
  ESPACIO_PRUNE=$(echo "$SALIDA_PRUNE" | grep -i "reclaimed space" | sed 's/.*: //' || true)

  echo "------------------------------------------------------------------------"
  echo "==> RESULTADO DE LIMPIEZA:"
  echo "    - Imágenes de aplicación eliminadas: ${BORRADAS_OK} de ${TOTAL_CANDIDATOS}"
  echo "    - Espacio de aplicación recuperado: ${MB_LIBERADOS} MB (${GB_LIBERADOS} GB)"
  if [[ -n "$ESPACIO_PRUNE" ]]; then
    echo "    - Espacio recuperado por prune huérfano: ${ESPACIO_PRUNE}"
  fi
  echo "========================================================================"
  return 0
}

# Si el script se ejecuta directamente (no mediante source), ejecuta la función
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  limpiar_imagenes_viejas "$@"
fi

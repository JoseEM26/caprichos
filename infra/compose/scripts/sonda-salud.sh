#!/usr/bin/env bash
# ==============================================================================
# sonda-salud.sh — Sonda de Disponibilidad Continua y Monitoreo de Despliegue
# ==============================================================================
# Uso:
#   ./sonda-salud.sh [URL] [INTERVALO_SEGUNDOS] [DURACION_SEGUNDOS]
#
# Ejemplos:
#   # Monitorear la demo cada 1 segundo durante 400 segundos:
#   ./sonda-salud.sh https://207-244-232-127.sslip.io/api/salud 1 400
#
#   # Monitorear producción indefinidamente hasta presionar Ctrl+C:
#   ./sonda-salud.sh https://api.caprichos.pe/salud 1
#
#   # Monitorear prueba local en puerto 19080 cada 200ms:
#   ./sonda-salud.sh http://127.0.0.1:19080/api/salud 0.2 60
# ==============================================================================

set -u

URL="${1:-http://127.0.0.1:3000/api/salud}"
INTERVALO="${2:-1}"
DURACION="${3:-0}" # 0 = indefinido (hasta Ctrl+C)

TOTAL=0
EXITOS=0
FALLOS=0
INICIO_EPOCH=$(date +%s)

echo "========================================================================"
echo "   SONDA DE DISPONIBILIDAD CONTINUA — CAPRICHOS"
echo "   Objetivo:   ${URL}"
echo "   Intervalo:  ${INTERVALO}s"
if [ "$DURACION" -gt 0 ]; then
  echo "   Duración:   ${DURACION}s"
else
  echo "   Duración:   Indefinida (Ctrl+C para finalizar)"
fi
echo "   Inicio:     $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "========================================================================"

resumen_final() {
  FIN_EPOCH=$(date +%s)
  SEGUNDOS_TRANSCURRIDOS=$((FIN_EPOCH - INICIO_EPOCH))
  echo ""
  echo "========================================================================"
  echo "   RESUMEN DE LA SONDA DE DISPONIBILIDAD"
  echo "========================================================================"
  echo "   Tiempo transcurrido: ${SEGUNDOS_TRANSCURRIDOS} segundos"
  echo "   Total peticiones:   ${TOTAL}"
  echo "   Peticiones 200 OK:  ${EXITOS}"
  echo "   Peticiones fallidas:${FALLOS}"

  if [ "$TOTAL" -gt 0 ]; then
    UPTIME_PCT=$(awk -v ok="$EXITOS" -v tot="$TOTAL" 'BEGIN { printf "%.2f", (ok/tot)*100 }')
    echo "   Disponibilidad:     ${UPTIME_PCT}%"
  else
    echo "   Disponibilidad:     0%"
  fi

  if [ "$FALLOS" -eq 0 ] && [ "$TOTAL" -gt 0 ]; then
    echo "   Resultado:          DESPLIEGUE SIN CORTE CONFIRMADO (0 fallos)"
  elif [ "$TOTAL" -gt 0 ]; then
    echo "   Resultado:          ALERTA: Se detectaron ${FALLOS} caídas o errores HTTP"
  fi
  echo "========================================================================"
}

trap 'resumen_final; exit 0' INT TERM

while true; do
  AHORA=$(date +'%H:%M:%S.%3N')
  TOTAL=$((TOTAL + 1))

  # Ejecutar petición con timeout de 3 segundos
  HTTP_INFO=$(curl -s -S -o /tmp/sonda_body.txt -w "%{http_code} %{time_total}" --max-time 3 "$URL" 2>&1)
  CURL_EXIT=$?

  if [ $CURL_EXIT -ne 0 ]; then
    HTTP_CODE="ERR"
    TIME_TOTAL="0.000"
    BODY="curl error: ${HTTP_INFO}"
  else
    HTTP_CODE=$(echo "$HTTP_INFO" | awk '{print $1}')
    TIME_TOTAL=$(echo "$HTTP_INFO" | awk '{print $2}')
    BODY=$(head -c 80 /tmp/sonda_body.txt 2>/dev/null || echo "")
  fi

  if [ "$HTTP_CODE" = "200" ]; then
    EXITOS=$((EXITOS + 1))
    printf "[%s] #%-4d | HTTP %-3s | %-6ss | %s\n" "$AHORA" "$TOTAL" "$HTTP_CODE" "$TIME_TOTAL" "$BODY"
  else
    FALLOS=$((FALLOS + 1))
    printf "[%s] #%-4d | HTTP %-3s | %-6ss | FALLO: %s\n" "$AHORA" "$TOTAL" "$HTTP_CODE" "$TIME_TOTAL" "$BODY"
  fi

  if [ "$DURACION" -gt 0 ]; then
    ACTUAL_EPOCH=$(date +%s)
    if [ $((ACTUAL_EPOCH - INICIO_EPOCH)) -ge "$DURACION" ]; then
      resumen_final
      exit 0
    fi
  fi

  sleep "$INTERVALO"
done

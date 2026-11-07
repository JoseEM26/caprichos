# Funciones compartidas por probar-restauracion.sh y probar-restauracion-externa.sh (se cargan con `source`).
# Levantan un PostgreSQL temporal y aislado, restauran un volcado .sql.gz con ON_ERROR_STOP y cuentan filas.
# No imprimen datos, solo conteos.

# pg_temporal_iniciar <contenedor>: arranca postgres y espera a que acepte conexiones.
pg_temporal_iniciar() {
  docker run -d --name "$1" -e POSTGRES_PASSWORD=test_restore_pwd -e POSTGRES_DB=restore_test -e POSTGRES_USER=restore_test \
    postgres:16-alpine >/dev/null
  # La imagen arranca un servidor temporal para inicializar, lo apaga y arranca el definitivo:
  # se espera al SEGUNDO "ready to accept connections" (si no, falla con "shutting down").
  for _ in $(seq 1 60); do
    [[ "$(docker logs "$1" 2>&1 | grep -c 'ready to accept connections')" -ge 2 ]] \
      && docker exec "$1" pg_isready -U restore_test -d restore_test >/dev/null 2>&1 && break
    sleep 1
  done
}

# pg_temporal_restaurar <contenedor> <volcado.sql.gz>: crea los roles OWNER vacíos y restaura. Devuelve 1 si falla.
pg_temporal_restaurar() {
  local C="$1" DUMP="$2" ROL ERR
  # El volcado asigna dueños (OWNER TO <usuario>); en la base temporal esos usuarios no existen y la restauración
  # se detendría. Se crean vacíos, solo dentro del contenedor temporal.
  for ROL in $(gzip -dc "$DUMP" | grep -oE 'OWNER TO [A-Za-z0-9_]+' | awk '{print $3}' | sort -u); do
    [[ "$ROL" == "restore_test" ]] && continue
    docker exec "$C" psql -U restore_test -d restore_test -c "CREATE ROLE \"${ROL}\" SUPERUSER" >/dev/null 2>&1 || true
  done
  echo "==> Restaurando en la base temporal..."
  ERR="/tmp/restore-err-$$.txt"
  if ! gzip -dc "$DUMP" | docker exec -i "$C" psql -v ON_ERROR_STOP=1 -U restore_test -d restore_test >/dev/null 2>"$ERR"; then
    echo "FALLA: la restauración dio errores. Primeras líneas:" >&2
    head -5 "$ERR" >&2
    rm -f "$ERR"
    return 1
  fi
  rm -f "$ERR"
}

# pg_temporal_resumen <contenedor>: imprime tablas y filas de tablas clave.
pg_temporal_resumen() {
  local C="$1" t
  consulta() { docker exec "$C" psql -U restore_test -d restore_test -tA -c "$1" 2>/dev/null || echo "?"; }
  echo "Tablas en el esquema público: $(consulta "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
  for t in parametro categoria producto user_account pedido; do
    echo "Filas en ${t}: $(consulta "SELECT count(*) FROM ${t}")"
  done
}

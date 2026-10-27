---
id: RB-CAP-008
tipo: runbook
titulo: "Runbook: despliegue sin corte con docker-rollout y verificación continua con sonda"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-27
relacionados: [ADR-011, ADR-015, RB-CAP-005, PCN-CAP-001, INV-CAP-001]
tags: [runbook, despliegue-sin-corte, zero-downtime, docker-rollout, traefik, sonda, devops]
---

# RB-CAP-008 — Despliegue sin corte con docker-rollout y verificación continua con sonda

| Campo | Valor |
|---|---|
| Cuándo usarlo | Para realizar despliegues de nuevas versiones de la API y Web en Demo, Staging o Producción garantizando cero caída (zero-downtime), sin pérdida de webhooks de WhatsApp ni desconexión de clientes, o para revertir ante incidentes |
| Tiempo esperado | Despliegue completo: 2 a 4 minutos · Vuelta atrás: menos de 2 minutos |
| Quién lo ejecuta | GitHub Actions (automático) o el operador técnico mediante SSH |
| Riesgo | Bajo: arquitectura multi-instancia progresiva con reversión automática |
| Referencias | ADR-011, ADR-015, `infra/compose/scripts/desplegar.sh`, `infra/compose/scripts/docker-rollout` |

---

## 1. Arquitectura de despliegue sin corte

Para que un despliegue no corte ni pierda mensajes de WhatsApp, pedidos de la carta ni sesiones activas del personal, el sistema opera con los siguientes componentes integrados:

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 Traefik Reverse Proxy                   │
                  │   (providersThrottleDuration=0s, retry middleware x3)   │
                  └────────────┬───────────────────────────────┬────────────┘
                               │                               │
                [Tráfico activo]                 [En espera de /salud]
                               ▼                               ▼
                  ┌─────────────────────────┐     ┌─────────────────────────┐
                  │  Instancia N (Antigua)  │     │   Instancia N+1 (Nueva) │
                  │     API v0.3.0          │     │        API v0.3.1       │
                  │   Up (healthy)          │     │   Iniciando -> /salud   │
                  └────────────┬────────────┘     └────────────┬────────────┘
                               │                               │
                               ▼                               ▼
                 ┌──────────────────────────────────────────────────────────┐
                 │       Redis: BullMQ + Candado Distribuido + Socket.IO    │
                 │       PostgreSQL: Migraciones Aditivas (Expand/Contract) │
                 └──────────────────────────────────────────────────────────┘
```

### Componentes clave y funcionamiento

1. **Proxy inverso Traefik:**
   - Detecta contenedores mediante etiquetas dinámicas de Docker (`traefik.enable=true`, `traefik.http.services...`).
   - Verifica el estado de salud interno de cada contenedor mediante su healthcheck (`/salud`, intervalo de 1s).
   - Solo envía tráfico al contenedor nuevo cuando este responde HTTP 200 y pasa a estado `healthy`.
   - Incorpora middleware de reintentos (`retry`, 3 intentos) para mitigar cualquier corte en el milisegundo de conmutación.

2. **docker-rollout vendorizado:**
   - Ubicado en `infra/compose/scripts/docker-rollout` e `infra/demo/docker-rollout`.
   - Levanta el nuevo contenedor junto al contenedor viejo sin colisión de puertos ni de nombres (no se usa `container_name` fijo en Compose).
   - Espera que el nuevo contenedor esté sano y aplica una pausa de seguridad (`--wait-after-healthy 2`) para que Traefik actualice su tabla de enrutamiento antes de dar de baja la versión antigua.
   - Si la nueva versión no logra estar saludable dentro del tiempo límite (`-t 60`), el script detiene y elimina el contenedor defectuoso, conservando la versión previa intacta.

3. **Apagado ordenado (Graceful Shutdown):**
   - Configurado en `apps/api/src/main.ts` mediante `app.enableShutdownHooks()`.
   - En Docker Compose se define `stop_grace_period: 30s` para el servicio `api`.
   - Al recibir la señal `SIGTERM`, la API deja de aceptar peticiones nuevas, termina de procesar las solicitudes HTTP y trabajos de cola en curso, y cierra limpiamente las conexiones a PostgreSQL y Redis.

4. **Cola BullMQ para webhooks de WhatsApp:**
   - Implementada en `apps/api/src/modulos/chatbot/servicios/cola-webhook.service.ts`.
   - El endpoint `POST /whatsapp/webhook` valida la firma HMAC-SHA256 y encola inmediatamente el trabajo en Redis, respondiendo HTTP 200 a Meta en milisegundos.
   - El identificador del trabajo (`jobId`) se calcula mediante el hash SHA-256 del cuerpo recibido, deduplicando automáticamente cualquier reintento que Meta envíe durante el despliegue.
   - Un worker interno con concurrencia 5 procesa los eventos.
   - En caso de indisponibilidad temporal de Redis, el controlador conmuta a procesamiento en línea seguro para no perder ningún mensaje.
   - Al detenerse la instancia, el worker se cierra esperando la finalización de los trabajos activos.

5. **Candado distribuido en Redis para tareas programadas:**
   - Utilidad en `apps/api/src/comun/redis/candado.util.ts`.
   - Las tareas periódicas que se ejecutan cada 30 segundos (`ChatbotPlanificadorService` y `RecordatorioReservasTarea`) compiten por un candado atómico (`SET clave token NX PX ttlMs`).
   - Solo una instancia ejecuta la tarea en cada intervalo.
   - La liberación se realiza de forma segura mediante un script Lua que solo borra la clave si el token coincide con el propio, evitando liberar candados ajenos si la tarea demoró más del TTL.
   - Si Redis no responde, el sistema entra en modo de respaldo (*fallback*) y ejecuta la tarea localmente para garantizar continuidad operativa.

6. **Adaptador Redis de Socket.IO:**
   - Implementado en `apps/api/src/comun/socket/redis-io.adapter.ts` mediante `@socket.io/redis-adapter`.
   - Permite que las salas y mensajes de eventos en tiempo real (como pedidos de cocina, pagos de caja y campana de avisos) se propaguen entre múltiples instancias de la API.
   - Si Redis no está disponible, conmuta limpiamente a un adaptador en memoria.

7. **Resiliencia en el cliente navegador:**
   - En `apps/web/src/comun/api.ts`, el cliente HTTP reintenta automáticamente peticiones que reciban errores 502, 503, 504 o caídas de red. Los reintentos solo se aplican a peticiones de lectura (`GET`, `HEAD`) o a mutaciones seguras que cuenten con cabecera `Idempotency-Key`.
   - En `apps/web/src/comun/socket.ts`, Socket.IO está configurado con `transports: ['websocket']` puro para evitar desconexiones espurias ocasionadas por el sondeo HTTP (*long-polling*) entre servidores distintos.

8. **Migraciones con patrón Expand/Contract:**
   - Toda migración de base de datos (`prisma migrate deploy`) se ejecuta en un contenedor efímero aislado **antes** de iniciar el reemplazo de contenedores de aplicación.
   - Deben ser estrictamente aditivas (fase *Expand*): añadir columnas opcionales o con valores por defecto, crear tablas o añadir índices.
   - Nunca renombrar o eliminar columnas en la misma versión en que la versión antigua aún las consulta (fase *Contract* diferida a versiones posteriores).

---

## 2. Lección aprendida: invocación directa de docker-rollout

En las primeras pruebas automatizadas, el comando de comprobación:
```bash
if docker rollout --version &>/dev/null; then ...
```
producía un **falso positivo**, porque la CLI global de Docker consumía la bandera `--version` e imprimía la versión de Docker con código de salida 0, sin importar que el plugin `rollout` no estuviera instalado. Al intentar luego ejecutar `docker rollout -f ...`, Docker fallaba con el error:
```text
unknown shorthand flag: 'f' in -f
```

### Regla obligatoria
No se depende de plugins de usuario ni de `~/.docker/cli-plugins`. Todos los scripts invocan directamente el ejecutable empaquetado pasando el subcomando literal `rollout`:
```bash
"${SCRIPT_DIR}/docker-rollout" rollout -f "$COMPOSE_BASE" -f "$COMPOSE_ENV" --env-file "$ENV_FILE" -t "$TIMEOUT" --wait-after-healthy 2 "$SERVICIO"
```

---

## 3. Procedimiento de despliegue

### A. Despliegue automático (GitHub Actions)
1. Para Staging / Demo: realizar push o merge a la rama correspondiente (`ola-1` para demo, `main` para staging).
2. Para Producción: generar un tag de versión (`git tag -a v0.4.0 -m "release" && git push origin v0.4.0`), entrar a la pestaña **Actions** en GitHub y autorizar el despliegue en el entorno `production`.
3. El pipeline compila las imágenes, las sube a GHCR, conecta por SSH al VPS y ejecuta el despliegue progresivo.

### B. Despliegue manual en el servidor (Consola SSH)
Si se requiere operar directamente en el servidor:

```bash
# Conectar al servidor VPS
ssh -i ~/.ssh/id_ed25519_caprichos_vps deploy@207.244.232.127

# Ir a la carpeta de scripts de Compose
cd /opt/caprichos/scripts

# Iniciar el despliegue sin corte especificando el ambiente y la etiqueta
./desplegar.sh demo v0.4.0
```

El script ejecutará automáticamente:
1. Comprobación y respaldo de la versión actual (`TAG_PREVIA`).
2. Descarga previa de las imágenes (`docker pull`).
3. Comprobación de servicios base (PostgreSQL y Redis).
4. Ejecución de migraciones de Prisma en contenedor efímero.
5. Rolling rollout progresivo de la API (`docker-rollout ... api`).
6. Rolling rollout progresivo del frontend Web (`docker-rollout ... web`).
7. Verificación final de salud por ID dinámico.

---

## 4. Verificación continua con la sonda de salud

Para comprobar formalmente que un despliegue no presenta pérdida de paquetes ni errores HTTP 502, se utiliza el script de sonda ubicado en `docs/scripts/sonda-salud.sh` (y en `infra/compose/scripts/sonda-salud.sh`).

### Cómo ejecutar la sonda:

```bash
# En una terminal separada, apuntar al ambiente deseado:
# Sintaxis: ./sonda-salud.sh [URL] [INTERVALO_SEGUNDOS] [DURACION_SEGUNDOS]

# Ejemplo en la Demo durante 400 segundos (solicitudes cada 1 segundo):
./docs/scripts/sonda-salud.sh https://207-244-232-127.sslip.io/api/salud 1 400

# Ejemplo en Producción de monitoreo continuo (detener con Ctrl+C):
./docs/scripts/sonda-salud.sh https://api.caprichos.pe/salud 1 0

# Ejemplo en prueba local en puerto 19080 cada 200 ms:
./docs/scripts/sonda-salud.sh http://127.0.0.1:19080/api/salud 0.2 60
```

### Salida esperada en consola:
```text
========================================================================
   SONDA DE DISPONIBILIDAD CONTINUA — CAPRICHOS
   Objetivo:   https://207-244-232-127.sslip.io/api/salud
   Intervalo:  1s
   Duración:   400s
========================================================================
[02:30:01.120] #1    | HTTP 200 | 0.045s  | {"estado":"ok","version":"v0.3.0"}
[02:30:02.115] #2    | HTTP 200 | 0.042s  | {"estado":"ok","version":"v0.3.0"}
... [transición de despliegue en curso] ...
[02:32:15.890] #134  | HTTP 200 | 0.048s  | {"estado":"ok","version":"v0.3.1"}
[02:32:16.892] #135  | HTTP 200 | 0.044s  | {"estado":"ok","version":"v0.3.1"}
...
========================================================================
   RESUMEN DE LA SONDA DE DISPONIBILIDAD
========================================================================
   Tiempo transcurrido: 400 segundos
   Total peticiones:   400
   Peticiones 200 OK:  400
   Peticiones fallidas:0
   Disponibilidad:     100.00%
   Resultado:          DESPLIEGUE SIN CORTE CONFIRMADO (0 fallos)
========================================================================
```

> **Registro histórico de verificación:**
> - **Primer intento en Demo:** Falló debido al chequeo de `docker rollout --version`; el sistema ejecutó reversión automática preservando el servicio.
> - **Segundo intento (con invocación directa corregida):** Despliegue verificado con sonda continua de 400 segundos: **0 peticiones fallidas (100% de éxito)** durante la transición completa de `api` y `web`.

---

## 5. Procedimiento ante fallos y vuelta atrás (Rollback)

Si durante el despliegue o inmediatamente después se presenta una anomalía operativa:

### A. Reversión automática incorporada
Si el contenedor nuevo falla al arrancar o no responde al endpoint `/salud` en 60 segundos, `desplegar.sh` y `docker-rollout` lo descartan automáticamente e inician la vuelta atrás inmediata a `TAG_PREVIA` mediante rolling rollout, sin intervención humana.

### B. Vuelta atrás manual por consola SSH
Si la versión nueva arranca bien pero presenta un error lógico en la aplicación:

```bash
# En el VPS:
cd /opt/caprichos/scripts

# Sintaxis: ./volver-atras.sh <ambiente> [tag_anterior]
# Ejemplo volviendo a la versión previa:
./volver-atras.sh demo v0.3.0
```

1. El script `volver-atras.sh` invoca `docker-rollout` hacia la versión anterior garantizando que la vuelta atrás **tampoco tenga corte de servicio**.
2. **Las migraciones no se revierten:** al ser aditivas bajo el principio Expand/Contract, la versión anterior continúa funcionando sobre la base de datos actualizada.
3. Si el rollout de vuelta atrás fallara por causas externas, el script recurre a recreación de emergencia (`docker compose up -d --no-deps`) como último recurso de contingencia.

---

## 6. Comprobaciones posteriores al despliegue

| Comprobación | Comando | Resultado esperado |
|---|---|---|
| Estado de servicios | `./estado.sh <ambiente>` | Todos los servicios en `Up (healthy)` |
| Respuesta de salud | `curl -s https://<dominio>/api/salud` | HTTP 200 con JSON conteniendo la nueva versión |
| Cola de WhatsApp | `redis-cli ping` y logs del worker | Sin acumulación de jobs fallidos en cola |
| Socket en vivo | Abrir panel admin en navegador | Indicador de conexión en verde (sin reconexiones constantes) |

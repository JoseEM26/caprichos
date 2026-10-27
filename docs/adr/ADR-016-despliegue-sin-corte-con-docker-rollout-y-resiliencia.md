---
id: ADR-016
tipo: adr
titulo: "Despliegue sin corte con docker-rollout, Traefik y resiliencia en backend y cliente"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-27
relacionados: [ADR-001, ADR-006, ADR-007, ADR-011, ADR-015, RB-CAP-004, RB-CAP-005]
tags: [adr, infraestructura, despliegue-sin-corte, docker-rollout, traefik, bullmq, redis, socket-io]
---

# ADR-016: Despliegue sin corte con docker-rollout, Traefik y resiliencia en backend y cliente

- **Estado:** borrador (draft — la IA propone; aprueba y firma el líder técnico)
- **Amplía:** A **ADR-015** (Docker Compose y GitHub Actions por SSH) incorporando la estrategia de reemplazo progresivo de contenedores (*rolling rollout*), drenado de conexiones, encolamiento de webhooks y sincronización en tiempo real entre múltiples réplicas.
- **Fecha:** 2026-10-27

---

## 1. Contexto

En una cafetería con carta digital pública, pedidos en salón, módulos de cocina y caja en vivo, y un chatbot de WhatsApp que recibe solicitudes continuas, reiniciar los contenedores recreándolos de golpe (`docker compose up -d`) generaba interrupciones breves pero críticas (errores HTTP 502/503/504 Bad Gateway, desconexiones de pantallas de cocina y pérdida de webhooks entrantes de Meta).

Para alcanzar una operación continua sin corte de servicio (*zero-downtime*) en un único servidor VPS (Contabo 6 vCPU, 12 GB RAM) sin incurrir en la sobrecarga de un orquestador pesado, se requería:
1. Reemplazar los contenedores de `api` y `web` asegurando que la nueva versión esté completamente sana antes de desviar el tráfico.
2. Evitar la interrupción brusca de peticiones en curso y cerrar ordenadamente conexiones a base de datos y Redis.
3. Asegurar que los webhooks de WhatsApp no se descarten si llegan durante la conmutación de procesos.
4. Impedir que dos réplicas temporales ejecuten tareas programadas concurrentes repetidas (como alertas o cierres periódicos).
5. Garantizar que los clientes web y las pantallas en tiempo real toleren la rotación de réplicas sin requerir recargar la página.
6. Contar con un mecanismo de vuelta atrás inmediata si la nueva versión no supera las pruebas de salud.

---

## 2. Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
|---|---|---|
| **Elegida:** **Rolling rollout con `docker-rollout` vendorizado + Traefik v3 + colas BullMQ + candado distribuido Redis + reintentos en cliente** | — | Necesidad de clúster multiserver distribuido en múltiples centros de datos. |
| **Clúster Kubernetes (k3s / k8s)** | Sobrecarga de memoria excesiva (1,5 a 3 GB solo para el plano de control), complejidad operacional desproporcionada para un solo servidor. | Expansión a infraestructura multirregión con decenas de réplicas por nodo. |
| **Docker Swarm nativo** | Requiere modo Swarm activo en el host, complica el control estricto de redes puente y volúmenes locales con Compose puro (ADR-015). | Si Docker Swarm ofreciera mejor integración con volúmenes de PostgreSQL y scripts locales de mantenimiento. |
| **Blue/Green completo con duplicación de stack** | Requiere duplicar todos los servicios (incluyendo bases de datos o enrutamiento complejo de datos) consumiendo el doble de recursos de memoria en el VPS. | Presupuesto para dos o más servidores físicos independientes. |
| **Recreación directa (`docker compose up -d`) con ventana de mantenimiento** | Provoca caídas de 5 a 15 segundos en cada despliegue, inaceptable para atención continua y pedidos en vivo. | Si el sistema fuera exclusivamente de uso interno administrativo fuera de horario. |

---

## 3. Decisión

1. **Proxy Inverso Dinámico con Traefik v3 (`infra/compose/proxy/`):**
   - Traefik detecta automáticamente los contenedores mediante etiquetas de Docker (`traefik.http.routers...`).
   - Monitorea los healthchecks de Docker (`/salud`) y conmuta el balanceo hacia el nuevo contenedor únicamente cuando su estado pasa a `healthy`.

2. **Invocación Directa de `docker-rollout` Vendorizado:**
   - Se vendorizó el script `docker-rollout` en `infra/compose/scripts/docker-rollout` e `infra/demo/docker-rollout`.
   - **Lección aprendida:** El comando `docker rollout --version` reportaba falsos positivos o fallos si no estaba configurado como plugin de CLI. La ejecución se corrigió para invocar directamente al binario/script ejecutable (`${SCRIPT_DIR}/docker-rollout rollout -f ... -f ... --env-file ... -t <timeout> --wait-after-healthy 2 <servicio>`).
   - Se despliega progresivamente primero el servicio `api` (timeout 60 s) y posteriormente `web` (timeout 30 s).

3. **Apagado Ordenado (*Graceful Shutdown*):**
   - La API NestJS activa los ganchos de apagado (`app.enableShutdownHooks()`).
   - Los contenedores configuran `stop_grace_period: 30s` en Docker Compose, permitiendo finalizar peticiones HTTP activas y drenar tareas pendientes antes de la señal `SIGKILL`.

4. **Migraciones con Patrón Expand/Contract:**
   - Las migraciones de Prisma se ejecutan mediante un contenedor efímero (`compose run --rm api prisma migrate deploy`) **antes** de iniciar el reemplazo de los contenedores activos.
   - Toda migración debe ser compatible hacia atrás (solo adición de tablas, columnas opcionales o valores por defecto). Los contenedores de la versión anterior siguen atendiendo peticiones mientras la migración se aplica.

5. **Cola Asíncrona BullMQ para Webhooks de WhatsApp (`apps/api/src/modulos/chatbot/servicios/cola-webhook.service.ts`):**
   - Los webhooks entrantes de Meta no se procesan en el hilo HTTP directo; se encolan en la cola `whatsapp-webhooks`.
   - Deduplicación estricta mediante `jobId` derivado del hash SHA-256 del cuerpo crudo (`rawBody`).
   - Configuración de 5 reintentos con retroceso exponencial, concurrencia controlada de 5 trabajadores y degradación suave (*fallback*) a procesamiento en línea si Redis no estuviera disponible.

6. **Candado Distribuido en Redis para Tareas Periódicas (`apps/api/src/comun/redis/candado.util.ts`):**
   - Durante la ventana de convivencia de dos instancias de la API, las tareas `@Cron` utilizan un candado atómico (`SET clave token NX PX ttlMs`).
   - La liberación del candado se realiza mediante un script Lua que verifica que el token coincida exactamente con el de la instancia propietaria, evitando liberar bloqueos ajenos expirados.

7. **Adaptador Redis para Socket.IO (`apps/api/src/comun/socket/redis-io.adapter.ts`):**
   - Permite que las instancias concurrentes de la API compartan canales en tiempo real mediante Redis Pub/Sub, evitando pérdidas de eventos entre clientes conectados a réplicas distintas.

8. **Resiliencia en el Cliente Web (`apps/web/src/comun/`):**
   - **Reintentos HTTP transparentes (`api.ts`):** Ante respuestas de error transitorio (códigos HTTP 502, 503, 504 o caída de red), el cliente reintenta automáticamente con pausas de 600 ms, 1500 ms y 3000 ms. Solo se repiten peticiones seguras (lecturas GET/HEAD o peticiones con cabecera `Idempotency-Key`).
   - **Transporte solo WebSocket (`socket.ts`):** La conexión de Socket.IO fuerza `transports: ['websocket']`, descartando el sondeo HTTP (*long-polling*) para evitar rupturas por afinidad de sesión cuando conviven múltiples servidores. Se reconecta de forma indefinida utilizando el token JWT vigente.

9. **Vuelta Atrás Automática Sin Corte (`volver-atras.sh`):**
   - Si tras el rollout el nuevo contenedor no supera la verificación de salud (`/salud`), el script revierte automáticamente a `TAG_PREVIA` utilizando también `docker-rollout`, garantizando que el rollback tampoco interrumpa el servicio.

10. **Verificación Operativa con Sonda Continua:**
    - Se verifica el comportamiento mediante una sonda de peticiones concurrentes (`/api/salud` cada 1 segundo). Validado en pruebas con 0 peticiones fallidas a lo largo de 400 segundos durante la rotación de contenedores.

---

## 4. Consecuencias

### Positivas
- **Cero tiempo de inactividad:** Las actualizaciones de código en producción y demo no cortan la navegación de clientes ni el trabajo de mozos y cocineros.
- **Protección contra pérdida de datos:** Los avisos de WhatsApp y solicitudes de pedidos no se pierden en la conmutación de versiones.
- **Rollback automatizado:** Ante fallas de inicio en la nueva versión, el sistema regresa a la versión estable anterior sin intervención manual.

### Negativas / Mitigaciones
- **Consumo transitorio de memoria:** Durante el lapso de convivencia de la réplica saliente y la entrante, el servidor aloja temporalmente dos contenedores de API y dos de Web. *Mitigación:* Los límites de memoria estrictos en Compose (512 MB por API, 64 MB por Web) garantizan margen suficiente dentro de los 12 GB de RAM del VPS.
- **Disciplina en cambios de base de datos:** No se pueden aplicar cambios destructivos directos (renombrar o eliminar columnas) en una sola entrega. *Mitigación:* Se adopta de forma obligatoria el patrón Expand/Contract en dos fases consecutivas.

---

## 5. Datos (Gobierno de Datos - Puerta F4)

- **Entidades afectadas:** Ninguna entidad nueva de base de datos; utiliza colas transitorias en Redis (`whatsapp-webhooks`) y claves de bloqueo con expiración (`PX`).
- **Seguridad y aislamiento:**
  - Las conexiones de Redis y PostgreSQL se mantienen en la red interna de Docker (`internal: true`), inaccesibles desde internet.
  - El token de candado distribuido utiliza identificadores únicos UUIDv4 generados criptográficamente.
- **Retención:**
  - Los trabajos completados en la cola de BullMQ se purgan automáticamente tras su procesamiento exitoso para evitar saturación de memoria en Redis.

---

*Generado por IA: Borrador formal según especificación de docs-contrato.txt y directrices del proyecto Caprichos — Revisado por: (pendiente) — Aprueba: Technical Lead*

---
id: ADR-015
tipo: adr
titulo: "Docker Compose y GitHub Actions por SSH en lugar de Dokploy"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-24
relacionados: [ADR-011, ADR-012, RB-CAP-004, RB-CAP-005, RB-CAP-DEMO, INV-CAP-001]
tags: [adr, infraestructura, compose, traefik, github-actions, ssh, devops]
---

# ADR-015: Docker Compose y GitHub Actions por SSH en lugar de Dokploy

- **Estado:** borrador (draft — la IA propone; aprueba y firma el líder técnico)
- **Reemplaza:** A **ADR-011** exclusivamente en lo referente al uso de Dokploy como orquestador y panel de despliegue. Mantiene intactas las decisiones de Ansible, Cloudflare (DNS, WAF, Full Strict), copias con restic (ADR-012) y arquitectura de ambientes.
- **Fecha:** 2026-10-24

---

## 1. Contexto

En ADR-011 se había seleccionado Dokploy para gestionar los despliegues de la demo y los ambientes de staging y producción. No obstante, la experiencia operativa y la evaluación técnica demostraron:
1. **Consumo innecesario de recursos:** El panel y los servicios internos de Dokploy consumen memoria y ciclos de CPU en un VPS con recursos acotados (Contabo 6 vCPU, 12 GB RAM), compitiendo con la base de datos PostgreSQL, Redis y la API NestJS.
2. **Dependencia de Docker Swarm:** Dokploy exige inicializar Docker en modo Swarm para operar su proxy interno (`dokploy-traefik`) y servicios, agregando complejidad operacional a un despliegue mononodo.
3. **Punto único de falla y opacidad:** La gestión mediante interfaz web oculta el estado real de los contenedores y los archivos `.env`, complicando auditorías de configuración y control de versiones.
4. **Decisión del Dueño (Líder Técnico):** Dokploy no se utiliza más. Se adopta la solución más completa, robusta y estándar a largo plazo: **Docker Compose puro por ambiente** coordinado con **GitHub Actions mediante despliegue por SSH**.

---

## 2. Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
|---|---|---|
| **Elegida:** **Docker Compose nativo + Proxy Traefik autónomo + GitHub Actions por SSH** | — | Necesidad de clúster multiserver de alta disponibilidad (Kubernetes). |
| Continuar con **Dokploy** | Sobrecarga de memoria del panel, modo Swarm obligatorio, riesgo de desactualización del software de panel. | Si el equipo no tuviera operadores con habilidades de consola y requiriera UI web obligatoria. |
| **Coolify** | Consume aún más recursos (0,5 a 1,5 GB de RAM) y añade complejidad innecesaria. | Proyectos con múltiples aplicaciones heterogéneas sin CI/CD estándar. |
| **Kubernetes (k3s / k8s)** | Sobrecarga operacional masiva y consumo prohibitivo de recursos para un solo VPS de restaurante. | Expansión a infraestructura distribuida multirregión con decenas de microservicios. |

---

## 3. Decisión

1. **Proxy Inverso Autónomo (`infra/compose/proxy/`):**
   - Se despliega una instancia dedicada de **Traefik v3** (`caprichos-proxy-traefik`) administrada por Docker Compose.
   - Enruta el tráfico en los puertos 80 y 443 hacia la red puente externa `caprichos-proxy-net`.
   - Soporta certificados SSL automáticos con **Let's Encrypt** (desafío HTTP) para dominios dinámicos (`sslip.io`) y dominios oficiales (`caprichos.pe`), y admite Certificados de Origen de Cloudflare para modo Full (Strict).
   - Configura `trustedIPs` con los rangos oficiales IPv4 e IPv6 de Cloudflare para preservar la IP real de los clientes.
   - Integra middlewares perimetrales: rate limit en `/auth/ingresar` (10 req/s, ráfaga 20), rate limit general y cabeceras de seguridad (`sec-headers-prod` y `sec-headers-demo` con `X-Robots-Tag: noindex`).

2. **Compose por Ambiente (`infra/compose/`):**
   - **Base común (`docker-compose.base.yml`):** Define `postgres:16-alpine`, `redis:7-alpine`, `api` y `web`, con límites de memoria (PostgreSQL 1G, Redis 256M, API 512M, Web 64M), healthchecks formales y red interna aislada sin publicación de puertos de base de datos al host.
   - **Sobrescrituras por ambiente:**
     - `docker-compose.demo.yml`: Proyecto `caprichos-demo`, volúmenes `caprichos_demo_*`, cabecera `noindex`.
     - `docker-compose.staging.yml`: Proyecto `caprichos-staging`, volúmenes `caprichos_staging_*`, dominio `staging.caprichos.pe`, cabecera `noindex`.
     - `docker-compose.prod.yml`: Proyecto `caprichos-prod`, dominios `caprichos.pe`, `admin.caprichos.pe`, `api.caprichos.pe`, SEO habilitado (sin noindex), rate limit perimetral estricto, prohíbe el uso de `:latest` exigiendo etiquetas inmutables (`vX.Y.Z` o sha).

3. **Workflow de Despliegue por SSH (`.github/workflows/deploy.yml`):**
   - Reemplaza a `deploy-staging.yml` y `deploy-prod.yml`.
   - **Control de Acceso y Plan Free de GitHub:** Al tratarse de un repositorio privado bajo plan gratuito de GitHub, la API no admite 'Required reviewers' en environments (error HTTP 422). Por tanto, la protección de producción se implementa de manera manual y deliberada en el propio workflow mediante `workflow_dispatch`, exigiendo la palabra literal `PRODUCCION`, validando que el tag semántico exista y verificando que su commit esté formalmente integrado en la rama `main`. Si la organización escala a GitHub Team/Pro, se podrá reincorporar la exigencia de revisores obligatorios desde la interfaz de GitHub.
   - **Disparadores:**
     - Push a `ola-1` y `main`: Despliegue automático al ambiente Demo.
     - `workflow_dispatch`: Despliegue manual deliberado a Producción (`ambiente: prod`, tag `vX.Y.Z`, confirmación `PRODUCCION`) bajo el environment `prod` (sin reglas de protección de plan).
   - **Pasos:** Buildx con caché GHA -> Escaneo Trivy (falla ante vulnerabilidades críticas) -> Push a GHCR -> Conexión SSH segura mediante llave ed25519 dedicada y verificación de host fingerprint -> Ejecución en el VPS de `desplegar.sh <ambiente> <tag>`.

4. **Scripts Operativos en el VPS (`infra/compose/scripts/`):**
   - `desplegar.sh`: Descarga imágenes, corre `prisma migrate deploy` en contenedor efímero antes de conmutar la aplicación, recrea contenedores, evalúa healthchecks y ejecuta rollback automático si falla la salud.
   - `volver-atras.sh`: Rollback inmediato a versión previa.
   - `estado.sh`: Diagnóstico de contenedores, consumo de CPU/RAM, endpoint `/salud` y verificación de aislamiento de puertos (5432 y 6379 no publicados).
   - `logs.sh`: Consulta unificada de registros por ambiente o servicio.
   - `respaldar.sh`: Volcado `pg_dump` con gzip + empaquetado de uploads con rotación local de 7 días y soporte para restic a R2/B2 (ADR-012).
   - `restaurar.sh`: Restauración segura con bandera `--confirmar` y modo aislado `--prueba-local`.
   - `migrar-demo-actual.sh`: Migración de la demo en ejecución sin pérdida de datos ni de volúmenes.

5. **Ansible (`infra/ansible`):**
   - Se comenta el rol `dokploy` en `site.yml`.
   - Se agrega el rol `compose` para garantizar permisos de usuario `deploy`, pertenencia al grupo `docker`, estructura `/opt/caprichos` y opción de desactivar Docker Swarm.
   - Se condiciona UFW mediante `proxy_cloudflare` (true = solo Cloudflare, false = puertos 80/443 abiertos para demo/sslip.io).

---

## 4. Consecuencias

### Positivas
- **Ahorro de recursos:** Se libera la RAM y CPU que consumía Dokploy y su orquestador Swarm (~400 MB a 800 MB de RAM libres adicionales para la base de datos y Node.js).
- **Control total y declarativo:** Todo el estado de infraestructura reside en archivos de texto versionados en git.
- **Rollback automatizado y seguro:** Las migraciones de Prisma se verifican en contenedores efímeros antes de tocar la API activa, y cualquier fallo de arranque revierte la imagen inmediatamente sin intervención humana.
- **Transición suave:** Traefik autónomo utiliza la misma lógica de enrutamiento que ya venía funcionando en Dokploy.

### Negativas / Mitigaciones
- **Sin panel gráfico web:** Los operadores deben utilizar la terminal (`./estado.sh`, `./logs.sh`). Mitigación: Los scripts provistos proporcionan diagnósticos en un solo comando y el resumen del despliegue se publica automáticamente en GitHub Actions Job Summary.
- **Gestión manual de secretos en el VPS:** Requiere mantener el archivo `.env` en `/opt/caprichos/<ambiente>/.env`. Mitigación: El archivo se crea con permisos 600 y nunca se versiona en git ni se expone por red.

---

## 5. Datos (Gobierno de Datos - Puerta F4)

- **Entidades afectadas:** Ninguna entidad de negocio nueva.
- **Seguridad de datos:**
  - Los volcados de base de datos se generan con `umask 077` (solo legibles por el usuario de sistema).
  - Los puertos de PostgreSQL (5432) y Redis (6379) quedan estrictamente aislados en la red interna de Docker (`internal: true`), impidiendo cualquier acceso desde la red pública o escaneo de puertos.
- **Retención y respaldos:**
  - Retención local de 7 días.
  - Integración preparada con restic para réplica diaria cifrada fuera del VPS hacia Cloudflare R2 o Backblaze B2 (ADR-012).

---

*Generado por IA: Borrador formal según especificación de cd-tarea.txt y directrices del proyecto Caprichos — Revisado por: (pendiente) — Aprueba: Technical Lead*

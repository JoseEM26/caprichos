# Registro de Decisiones de Arquitectura (ADR) - Caprichos

Índice central de Decisiones de Arquitectura Técnica (*Architecture Decision Records*) del sistema Caprichos.

| ID | Título | Estado | Fecha | Descripción resumida |
|---|---|---|---|---|
| [ADR-001](ADR-001-plataforma-monolito-modular-nestjs-react.md) | Plataforma monolito modular NestJS React | draft | 2026-10-20 | Arquitectura de monolito modular con NestJS, React y pnpm workspaces. |
| [ADR-002](ADR-002-impresion-con-agente-local-esc-pos.md) | Impresión de comandas y etiquetas con un agente local ESC/POS | draft | 2026-10-20 | Agente local en PC de Caja para comandas térmicas por protocolo ESC/POS. |
| [ADR-003](ADR-003-postgresql-con-prisma.md) | PostgreSQL con Prisma ORM | draft | 2026-10-20 | Base de datos relacional PostgreSQL 16 con Prisma ORM y migraciones aditivas. |
| [ADR-004](ADR-004-modelo-de-personas-con-patron-party.md) | Modelo de personas con patrón Party simple | draft | 2026-10-20 | Entidad party única que unifica clientes, trabajadores y proveedores con roles. |
| [ADR-005](ADR-005-datos-personales-ley-29733.md) | Protección de datos personales Ley 29733 | draft | 2026-10-20 | Consentimiento informado, enmascaramiento y carpeta privada para comprobantes. |
| [ADR-006](ADR-006-tiempo-real-con-socket-io.md) | Tiempo real con Socket.IO | draft | 2026-10-20 | Comunicación bidireccional en vivo para pedidos, cocina y avisos de mesa. |
| [ADR-007](ADR-007-colas-y-bloqueos-con-redis-y-bullmq.md) | Colas y bloqueos con Redis y BullMQ | draft | 2026-10-20 | Procesamiento asíncrono en segundo plano, colas de trabajo y bloqueos atómicos. |
| [ADR-008](ADR-008-autenticacion-y-autorizacion-propias.md) | Autenticación y autorización propias | draft | 2026-10-20 | JWT en cookie httpOnly, RBAC con roles del sistema y contraseñas seguras con bcrypt. |
| [ADR-009](ADR-009-whatsapp-cloud-api-e-ia-del-bot.md) | WhatsApp Cloud API e IA del bot | draft | 2026-10-20 | Integración oficial con Meta Cloud API, plantillas y motor conversacional. |
| [ADR-010](ADR-010-mapas-busqueda-de-direcciones-y-zonas.md) | Mapas, búsqueda de direcciones y zonas | draft | 2026-10-20 | Geolocalización, cálculo de distancia por polígonos y tarifas de despacho. |
| [ADR-011](ADR-011-infraestructura-vps-dokploy-cloudflare-y-ci-cd.md) | Infraestructura: VPS con Dokploy, Ansible, Cloudflare y CI/CD | draft | 2026-10-20 | VPS único en Contabo, Ansible, Cloudflare y despliegues con GitHub Actions. |
| [ADR-012](ADR-012-archivos-copias-y-vigilancia.md) | Archivos, copias y vigilancia | draft | 2026-10-20 | Almacenamiento local de medios, respaldos diarios con pg_dump y restic a R2/B2. |
| [ADR-013](ADR-013-modo-sin-internet.md) | Modo sin internet | draft | 2026-10-20 | Mini servidor local en PC de Caja con SQLite para atención continua en contingencia. |
| [ADR-014](ADR-014-auditoria-de-acciones.md) | Auditoría de acciones | draft | 2026-10-20 | Tabla de auditoría append-only con huella encadenada SHA-256 para eventos sensibles. |
| [ADR-015](ADR-015-docker-compose-y-github-actions-por-ssh.md) | Docker Compose y GitHub Actions por SSH en lugar de Dokploy | draft | 2026-10-24 | Sustitución de Dokploy por Compose nativo, Traefik v3 autónomo y CI/CD por SSH. |
| [ADR-016](ADR-016-despliegue-sin-corte-con-docker-rollout-y-resiliencia.md) | Despliegue sin corte con docker-rollout, Traefik y resiliencia | draft | 2026-10-27 | Rolling rollout con script docker-rollout, drenado SIGTERM, BullMQ y Socket.IO Redis. |
| [ADR-017](ADR-017-verificacion-de-vouchers-con-ia-y-supervision-humana.md) | Verificación de comprobantes de pago digital con IA y supervisión humana | draft | 2026-10-27 | Visión artificial con OpenAI, semáforo determinista y validación humana obligatoria. |
| [ADR-018](ADR-018-asistente-ayuda-admin-grafo-memoria-manuales-markdown.md) | Asistente de ayuda Capri con grafo en memoria sobre manuales Markdown | draft | 2026-10-27 | Grafo relacional en memoria sin embeddings, aislamiento por rol e IA opcional concisa. |
| [ADR-019](ADR-019-mascota-capri-threejs-procedural-y-fallback-svg.md) | Mascota Capri con Three.js 3D procedural y respaldo accesible 2D SVG | draft | 2026-10-27 | Personaje 3D con Three.js lazy-loaded, 7 estados expresivos y SVG 2D automático. |
| [ADR-020](ADR-020-impresion-etiquetas-agente-local-tspl2.md) | Impresión de etiquetas de vasos y empaques con agente local y TSPL2 | draft | 2026-10-27 | Cola en base de datos print_job, agente en PC de Caja y protocolo TSPL2 para 4BARCODE. |

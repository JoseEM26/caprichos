# Documentacion de Caprichos

Paquete integral de documentacion de la plataforma digital de **Caprichos**, cafeteria artesanal en Lima. Cubre el diseno funcional, arquitectura de software, decisiones tecnicas (ADRs), runbooks de operacion (DevOps), manuales del sistema de ayuda administrativa y glosario para el dueno del negocio.

- **Cliente y dueno del negocio**: Kevin Rosales.
- **Desarrollo**: Jose Angel Espinoza.

---

## 1. Estructura del paquete de documentacion

| Carpeta / Documento | Contenido y proposito |
|---|---|
| [`GLOSARIO.md`](GLOSARIO.md) | Herramientas y conceptos tecnicos (Traefik, Nginx, GHCR, BullMQ, docker-rollout, GitHub Actions) en lenguaje sencillo para el dueno. |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Registro de cambios cronologico agrupado por fecha y tema a partir de la historia de confirmaciones. |
| [`adr/`](adr/) | Registro de decisiones arquitectonicas (ADR-001 a ADR-016). |
| [`operacion/`](operacion/) | Guias de operacion (DevOps): runbooks de despliegue, recuperacion, seguridad, costos e inventario. |
| [`ayuda/`](ayuda/) | Grafo de conocimiento de la ayuda administrativa (`grafo-ayuda.json` y `grafo-ayuda.md`) derivado de los manuales. |
| [`analisis/`](analisis/) | Intake, documento de requerimientos del negocio (BRD), registro de decisiones y plano del local. |
| [`roadmap/`](roadmap/) | Plan de fases, dependencias y matriz de riesgos. |
| [`epicas/`](epicas/) · [`features/`](features/) · [`historias/`](historias/) | Desglose formal de historias de usuario y requerimientos funcionales del marco Aybar. |
| [`arquitectura/`](arquitectura/) · [`datos/`](datos/) | Vista global de arquitectura, catalogo de API, modelos de entidad-relacion y contratos. |
| [`dor/`](dor/) · [`backlog/`](backlog/) · [`pruebas/`](pruebas/) | Criterios Definition of Ready, tareas por modulo y plan de pruebas. |
| [`recursos/`](recursos/) | Cartas, iconografia y recursos graficos de referencia del cliente. |

---

## 2. Decisiones tecnicas destacadas (ADR)

El sistema basa su diseno en las siguientes decisiones tecnicas registradas en [`docs/adr/`](adr/):

- **[ADR-001: Plataforma monolitica modular NestJS y React](adr/ADR-001-plataforma-monolito-modular-nestjs-react.md)**: Monolito modular con separacion clara de responsabilidades en lugar de microservicios prematuros.
- **[ADR-002: Impresion con agente local](adr/ADR-002-impresion-con-agente-local-esc-pos.md)**: Servicio local en la PC de Caja para comunicacion directa con la etiquetera fisica sin exponer la red interna.
- **[ADR-003: Base de datos relacional PostgreSQL](adr/ADR-003-postgresql-con-prisma.md)**: Motor PostgreSQL para consistencia transaccional y atomicidad en inventarios y cobros.
- **[ADR-006: Tiempo real con Socket.IO](adr/ADR-006-tiempo-real-con-socket-io.md)**: Comunicacion bidireccional mediante WebSocket exclusivo y adaptador de Redis para escalamiento horizontal.
- **[ADR-007: Colas y bloqueos con Redis y BullMQ](adr/ADR-007-colas-y-bloqueos-con-redis-y-bullmq.md)**: Procesamiento asincrono de webhooks de WhatsApp con control de concurrencia y deduplicacion sha256.
- **[ADR-008: Autenticacion y autorizacion propias](adr/ADR-008-autenticacion-y-autorizacion-propias.md)**: Control de acceso basado en roles (RBAC) y permisos granulares en cada endpoint.
- **[ADR-009: WhatsApp Cloud API e IA del chatbot](adr/ADR-009-whatsapp-cloud-api-e-ia-del-bot.md)**: Integracion oficial con la API en la nube de Meta y motor conversacional guiado.
- **[ADR-011: Infraestructura VPS y despliegue](adr/ADR-011-infraestructura-vps-dokploy-cloudflare-y-ci-cd.md)**: Evolucion de la arquitectura de alojamiento hacia servidores virtuales dedicados.
- **[ADR-015: Docker Compose y GitHub Actions por SSH](adr/ADR-015-docker-compose-y-github-actions-por-ssh.md)**: Sustitucion de paneles de terceros por orquestacion reproducible mediante Compose y despliegue automatizado por SSH.
- **[ADR-016: Despliegue sin corte con docker-rollout y resiliencia](adr/ADR-016-despliegue-sin-corte-con-docker-rollout-y-resiliencia.md)**: Relevo continuo de contenedores, ganchos de apagado ordenado y politicas de reintento idempotentes.
- **[ADR-017: Verificacion de vouchers con IA y supervision humana](adr/ADR-017-verificacion-de-vouchers-con-ia-y-supervision-humana.md)**: Analisis asistido por vision artificial con semaforos de confianza y decision humana obligatoria.
- **[ADR-018: Asistente de ayuda admin con grafo en memoria y manuales Markdown](adr/ADR-018-asistente-ayuda-admin-grafo-memoria-manuales-markdown.md)**: Estructura de manuales Markdown normalizados y recuperacion lexica por grafo.
- **[ADR-019: Mascota Capri en Three.js procedural y version vectorial 2D](adr/ADR-019-mascota-capri-threejs-procedural-y-fallback-svg.md)**: Modelo 3D procedural bajo carga diferida y version vectorial SVG de contingencia.
- **[ADR-020: Impresion de etiquetas con agente local y protocolo TSPL2](adr/ADR-020-impresion-etiquetas-agente-local-tspl2.md)**: Cola centralizada print_job y generador de comandos TSPL2 para la PC de Caja.

---

## 3. Guias y procedimientos de operacion (DevOps)

La carpeta [`docs/operacion/`](operacion/) reune los runbooks paso a paso para la administracion y continuidad del negocio:

- **[RB-CAP-001: Publicar y volver atras](operacion/RB-CAP-001-publicar-y-volver-atras.md)**: Flujo de release, verificacion post-despliegue y procedimiento de reversion.
- **[RB-CAP-002: Restaurar una copia de respaldo](operacion/RB-CAP-002-restaurar-una-copia.md)**: Procedimiento de restauracion de base de datos PostgreSQL y volumenes de archivos.
- **[RB-CAP-003: Atencion ante caida de un servicio](operacion/RB-CAP-003-un-servicio-se-cayo.md)**: Diagnostico rapido y recuperacion ante interrupciones de API, base de datos o proxy.
- **[RB-CAP-004: Preparacion de servidor nuevo](operacion/RB-CAP-004-preparar-un-servidor-nuevo.md)**: Pasos de aprovisionamiento de una VPS desde cero.
- **[RB-CAP-005: Desplegar, actualizar y volver atras con Compose](operacion/RB-CAP-005-desplegar-actualizar-y-volver-atras-con-compose.md)**: Ejecucion del despliegue en ambientes demo y produccion mediante scripts de operacion.
- **[RB-CAP-006: Codigo del supervisor (RETIRADO)](operacion/RB-CAP-006-codigo-del-supervisor.md)**: la aprobacion del supervisor se elimino; se conserva como historia.
- **[RB-CAP-007: Operacion del chatbot de WhatsApp](operacion/RB-CAP-007-chatbot-whatsapp.md)**: Supervision del bot de pedidos, reservas, atencion de vouchers y horario comercial.
- **[RB-CAP-008: Despliegue sin corte y verificacion con sonda](operacion/RB-CAP-008-despliegue-sin-corte-y-sonda.md)**: Procedimiento de despliegue con docker-rollout y monitoreo con sonda continua de salud.
- **[RB-CAP-009: Activar y operar la lectura de vouchers con IA](operacion/RB-CAP-009-activar-y-operar-vouchers-ia.md)**: Guia de operacion para la lectura de comprobantes con OpenAI y revision en cierre.
- **[RB-CAP-010: Operar el agente local de impresion de etiquetas](operacion/RB-CAP-010-operar-agente-impresion-etiquetas.md)**: Configuracion y monitoreo del agente de impresion local en la estacion de Caja.
- **[RB-CAP-011: Activar el asistente de ayuda Capri](operacion/RB-CAP-011-activar-ayuda-capri.md)**: Puesta en marcha del asistente Capri y control presupuestario de OpenAI.
- **[GUIA: Como hacer publico el bot de WhatsApp](operacion/GUIA-hacer-publico-el-bot-de-whatsapp.md)**: Pasos para pasar el bot de modo desarrollo a produccion publica en Meta.
- **[COS-CAP-001: Costos de operacion](operacion/COS-CAP-001-costos-de-operacion.md)**: Presupuesto operativo mensual (servidor VPS, dominios, consumo de IA con OpenAI y WhatsApp Cloud API).
- **[INV-CAP-001: Inventario de infraestructura](operacion/INV-CAP-001-inventario-de-infraestructura.md)**: Relacion de servidores, dominios, registros DNS, puertos y servicios.
- **[PCN-CAP-001: Plan de continuidad y respaldo](operacion/PCN-CAP-001-plan-de-continuidad-y-respaldo.md)**: Cronograma de copias de seguridad automatizadas y metas de tiempo de recuperacion (RTO / RPO).

---

## 4. Manuales y grafo del Asistente de Ayuda

El panel administrativo incluye a **Capri**, el asistente interactivo de ayuda contextuada:

- **Manuales fuente**: Almacenados en formato Markdown estandarizado dentro de `apps/api/src/modulos/ayuda-admin/manuales/`. Cubren los 34 modulos del sistema con frontmatter estructurado, tareas paso a paso, sugerencias frecuentes, relaciones intermodulares y control de roles.
- **Grafo de documentacion**: Generado en memoria por `AyudaGrafoService` y persistido en [`docs/ayuda/grafo-ayuda.json`](ayuda/grafo-ayuda.json) y [`docs/ayuda/grafo-ayuda.md`](ayuda/grafo-ayuda.md). Modela los nodos de modulos, tareas, roles y permisos, vinculados por aristas de navegacion sugerida.
- **Verificacion automatizada**: La consistencia de los manuales y la navegabilidad del grafo se validan en la suite de pruebas unitarias:
  ```bash
  # Regenerar grafo tras editar manuales
  pnpm --filter @caprichos/api ayuda:grafo

  # Validar formato y consistencia de relaciones
  pnpm --filter @caprichos/api exec jest src/modulos/ayuda-admin
  ```

---

## 5. Politicas de seguridad y privacidad

1. **Proteccion de secretos**: Nunca se versionan llaves SSH, tokens de acceso a APIs de pago o mensajeria, credenciales de base de datos ni archivos `.env`.
2. **Ley 29733 (Peru)**: Las consultas al asistente de ayuda y los reportes de auditoria aplican filtros de sanitizacion para evitar almacenar o transmitir numeros de identificacion (DNI), telefonos o datos personales innecesarios.
3. **Control de cambios**: Ningun cambio de infraestructura se publica sin documentar su respectivo registro en ADR o runbook de operacion.

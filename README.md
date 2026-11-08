# Caprichos

Plataforma digital integral de **Caprichos**, cafeteria artesanal en Lima. Centraliza la carta virtual para clientes, el chatbot interactivo de WhatsApp, el panel de gestion administrativa (pedidos, caja, cocina, repartos, compras y stock) y el agente local de impresion de etiquetas.

- **Cliente y dueno del negocio**: Kevin Rosales.
- **Desarrollo**: Jose Angel Espinoza.

---

## 1. Mapa del repositorio y aplicaciones

El proyecto esta organizado como un monorepositorio modular gestionado con `pnpm`:

```
caprichos/
├── apps/
│   ├── api/             # Servidor backend (NestJS Fastify, PostgreSQL, Redis, BullMQ, Socket.IO)
│   ├── web/             # Aplicacion web frontend (Vite, React, TypeScript, Nginx interno)
│   └── agente-local/    # Agente de impresion para la PC de Caja (Node.js, protocolo TSPL2)
├── packages/
│   └── comun/           # Tipos, validaciones y contratos compartidos entre aplicaciones
├── infra/
│   ├── docker/          # Dockerfiles optimizados para produccion y configuracion web
│   ├── compose/         # Orquestacion por ambiente (demo, staging, prod) y scripts de operacion
│   │   ├── proxy/       # Proxy perimetral Traefik v3 con TLS automatico
│   │   └── scripts/     # Scripts operativos (desplegar, volver atras, docker-rollout, respaldos)
│   └── ansible/         # Automatizacion para provisionamiento de servidores VPS
├── docs/                # Paquete de documentacion, arquitectura, operaciones y glosario
└── .github/workflows/   # Flujos de CI (pruebas y escaneo) y CD (despliegue por SSH a VPS)
```

---

## 2. Modulos del panel administrativo

El panel web (`apps/web`) cuenta con 34 modulos operativos agrupados en cinco areas funcionales segun `apps/web/src/admin/modulos.ts`:

### Operacion
- **Escritorio**: Resumen diario de ventas, ticket promedio, pedidos en curso y cifras clave.
- **Iniciativas**: Tablon colaborativo para propuestas, ideas y mejoras del equipo con adjuntos.
- **Pedidos y caja**: Recepcion, monitoreo y cobro de pedidos en mesa, mostrador y delivery.
- **Mensajes de WhatsApp**: Bandeja centralizada de chats con atencion humana, atencion de vouchers con IA y respuestas sugeridas.
- **Caja y cierres**: Arqueo ciego de efectivo, liquidacion de repartidores y auditoria de vouchers digitales.
- **Cocina**: KDS (Kitchen Display System) con pantallas por area de preparacion, alerta sonoro y mermas.
- **Repartos**: Despacho de pedidos, optimizacion de rutas en mapa interactivo y liquidacion.
- **Reservas**: Agenda de reservas de salon, confirmacion de franjas y asignacion de mesas.

### Clientes y ventas
- **Comprobantes**: Registro de boletas, facturas y notas de venta con busqueda avanzada.
- **Libro de reclamaciones**: Registro oficial de quejas y reclamos normativos segun ley peruana.
- **Clientes**: Historial de consumo, saldo de puntos de fidelizacion y notas de clientes.
- **Creditos del personal**: Control de consumos a cuenta y pagos pendientes del personal.
- **Productos**: Gestion del catalogo, nombres por envase, precios y activacion de productos.
- **Listas y categorias**: Jerarquia de categorias y agrupaciones visuales de la carta.
- **Ofertas y descuentos**: Constructor de combos en 4 pasos, promociones del dia y cupones.

### Compras y stock
- **Compras**: Registro formal de compras a proveedores e ingreso unico de mercaderia.
- **Almacen**: Inventario valorizado, movimientos internos, transferencias y cierres de almacen.
- **Stock y recetas**: Seguimiento de existencias criticas, alertas de desabastecimiento y preparacion diaria.
- **Recetas**: Escandallos tecnicos, calculo de costo por porcion y deduccion automatica por comanda.

### Analisis
- **Informes**: Reportes de ventas por canal, productos mas demandados y rentabilidad.
- **Mapa de entregas**: Analisis geografico de pedidos despachados y cobertura de entrega.
- **Indicadores**: Metricas operativas de tiempos de atencion, tiempos de cocina y conversion.

### Configuracion
- **Diseno de la carta**: Maquetacion visual de cabeceras, portadas y banners promocionales.
- **Novedades y publicidad**: Publicaciones informativas y lanzamientos destacados en la carta.
- **Destacadas de la carta**: Seleccion de productos estrella que aparecen en la portada.
- **Paleta de colores**: Ajuste de estilos visuales, tonalidades de marca y tipografias.
- **Configuracion del local**: Datos comerciales, horarios, cuentas de Yape/Plin y lectura de vouchers con IA.
- **Zonas de reparto**: Poligonos geograficos, radios de atencion y tarifas por kilometro.
- **Usuarios**: Administracion de cuentas, asignacion de roles y activacion de permisos.
- **Historial de acciones**: Registro de auditoria inmutable de transacciones y cambios sensibles.
- **Pantallas**: Configuracion de dispositivos de visualizacion para cocina, salon y sala de espera.
- **Plano del local**: Disenador de cuadricula en 2D de mesas por piso y cobro en mesa con foto de voucher.
- **Notificaciones**: Registro de alertas operativas del sistema y avisos prioritarios.

---

## 3. Infraestructura y despliegue

El sistema opera sobre una arquitectura en contenedores Docker disenada para disponibilidad continua:

- **Proxy perimetral**: Traefik v3 enruta el trafico web y gestiona certificados TLS gratuitos con Let's Encrypt.
- **Despliegue sin corte**: Utiliza la herramienta vendorizada `docker-rollout` (`infra/compose/scripts/docker-rollout`). Cada actualizacion arranca un contenedor nuevo, valida su estado en `/api/salud` y conmuta el trafico sin interrupcion.
- **Cola en segundo plano**: BullMQ sobre Redis procesa de forma asincrona e idempotente los eventos entrantes del webhook de WhatsApp.
- **Impresion local**: El paquete `apps/agente-local` consulta la cola `print_job` de la base de datos y se comunica mediante protocolo TSPL2 con la etiquetera fisica de Caja.
- **Automatizacion en GitHub Actions**:
  - `ci.yml`: Valida linteo, dependencias internas, compilacion, pruebas unitarias y escanea las imagenes con Trivy en busqueda de vulnerabilidades criticas.
  - `deploy.yml`: Compila una unica vez, publica imagenes en GHCR y despliega por conexion SSH segura ejecutando migraciones aditivas de base de datos antes del cambio de version.

---

## 4. Como correr el proyecto en entorno local

### Requisitos previos
- Node.js version 24 o superior.
- Gestor de paquetes `pnpm` (version 12 recomendada).
- Docker y Docker Compose para servicios de apoyo.

### Pasos de instalacion y ejecucion

1. **Clonar el repositorio e instalar dependencias**:
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd caprichos
   pnpm install
   ```

2. **Iniciar base de datos y memoria intermedia**:
   ```bash
   docker compose -f infra/compose/docker-compose.base.yml up -d
   ```
   Esto iniciara contenedores locales de PostgreSQL (puerto 5432) y Redis (puerto 6379).

3. **Configurar variables de entorno**:
   Copiar los archivos de ejemplo en cada aplicacion:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```
   *Nota: Nunca incluya credenciales reales ni suba archivos `.env` al repositorio.*

4. **Ejecutar migraciones de base de datos**:
   ```bash
   pnpm --filter @caprichos/api migration:run
   ```

5. **Iniciar en modo desarrollo**:
   ```bash
   # Iniciar todas las aplicaciones en paralelo (API y Web)
   pnpm dev
   ```
   - Carta y panel administrativo: `http://localhost:5173`
   - Servidor API backend: `http://localhost:3000`

6. **Ejecutar pruebas unitarias**:
   ```bash
   pnpm test
   ```

7. **Regenerar el grafo de conocimiento de la ayuda administrativa**:
   ```bash
   pnpm --filter @caprichos/api ayuda:grafo
   ```

---

## 5. Documentacion y enlaces de referencia

- **Registro de cambios**: [CHANGELOG.md](CHANGELOG.md) — Lista cronologica de cambios agrupados por fecha y tema.
- **Glosario tecnico**: [docs/GLOSARIO.md](docs/GLOSARIO.md) — Explicacion de herramientas e infraestructura en lenguaje sencillo para el dueno.
- **Indice general de documentacion**: [docs/README.md](docs/README.md) — Estructura completa de analisis, arquitectura y gestion.
- **Decisiones arquitectonicas (ADRs)**: [docs/adr/](docs/adr/)
  - [ADR-001: Plataforma monolitica modular NestJS y React](docs/adr/ADR-001-plataforma-monolito-modular-nestjs-react.md)
  - [ADR-002: Impresion con agente local](docs/adr/ADR-002-impresion-con-agente-local-esc-pos.md)
  - [ADR-003: Base de datos PostgreSQL con TypeORM/Prisma](docs/adr/ADR-003-postgresql-con-prisma.md)
  - [ADR-006: Tiempo real con Socket.IO](docs/adr/ADR-006-tiempo-real-con-socket-io.md)
  - [ADR-007: Colas y bloqueos con Redis y BullMQ](docs/adr/ADR-007-colas-y-bloqueos-con-redis-y-bullmq.md)
  - [ADR-008: Autenticacion y autorizacion propias con permisos](docs/adr/ADR-008-autenticacion-y-autorizacion-propias.md)
  - [ADR-009: WhatsApp Cloud API e IA conversacional](docs/adr/ADR-009-whatsapp-cloud-api-e-ia-del-bot.md)
  - [ADR-011: Infraestructura VPS, proxy y despliegue](docs/adr/ADR-011-infraestructura-vps-dokploy-cloudflare-y-ci-cd.md)
  - [ADR-015: Despliegue con Docker Compose y GitHub Actions por SSH](docs/adr/ADR-015-docker-compose-y-github-actions-por-ssh.md)
  - [ADR-016: Despliegue sin corte con docker-rollout y resiliencia](docs/adr/ADR-016-despliegue-sin-corte-con-docker-rollout-y-resiliencia.md)
  - [ADR-017: Verificacion de vouchers con IA y supervision humana](docs/adr/ADR-017-verificacion-de-vouchers-con-ia-y-supervision-humana.md)
  - [ADR-018: Asistente de ayuda admin con grafo en memoria y manuales Markdown](docs/adr/ADR-018-asistente-ayuda-admin-grafo-memoria-manuales-markdown.md)
  - [ADR-019: Mascota Capri en Three.js procedural y version vectorial 2D](docs/adr/ADR-019-mascota-capri-threejs-procedural-y-fallback-svg.md)
  - [ADR-020: Impresion de etiquetas con agente local y protocolo TSPL2](docs/adr/ADR-020-impresion-etiquetas-agente-local-tspl2.md)
- **Guias y runbooks de operacion**: [docs/operacion/](docs/operacion/)
  - [RB-CAP-001: Publicar y volver atras](docs/operacion/RB-CAP-001-publicar-y-volver-atras.md)
  - [RB-CAP-002: Restaurar una copia de respaldo](docs/operacion/RB-CAP-002-restaurar-una-copia.md)
  - [RB-CAP-003: Atencion ante caida de un servicio](docs/operacion/RB-CAP-003-un-servicio-se-cayo.md)
  - [RB-CAP-004: Preparacion de servidor nuevo](docs/operacion/RB-CAP-004-preparar-un-servidor-nuevo.md)
  - [RB-CAP-005: Desplegar, actualizar y volver atras con Compose](docs/operacion/RB-CAP-005-desplegar-actualizar-y-volver-atras-con-compose.md)
  - [RB-CAP-006: Codigo del supervisor (RETIRADO)](docs/operacion/RB-CAP-006-codigo-del-supervisor.md)
  - [RB-CAP-007: Operacion del chatbot de WhatsApp](docs/operacion/RB-CAP-007-chatbot-whatsapp.md)
  - [RB-CAP-008: Despliegue sin corte y verificacion con sonda](docs/operacion/RB-CAP-008-despliegue-sin-corte-y-sonda.md)
  - [RB-CAP-009: Activar y operar la lectura de vouchers con IA](docs/operacion/RB-CAP-009-activar-y-operar-vouchers-ia.md)
  - [RB-CAP-010: Operar el agente local de impresion de etiquetas](docs/operacion/RB-CAP-010-operar-agente-impresion-etiquetas.md)
  - [RB-CAP-011: Activar el asistente de ayuda Capri](docs/operacion/RB-CAP-011-activar-ayuda-capri.md)
  - [GUIA: Como hacer publico el bot de WhatsApp](docs/operacion/GUIA-hacer-publico-el-bot-de-whatsapp.md)
  - [COS-CAP-001: Estructura de costos de operacion](docs/operacion/COS-CAP-001-costos-de-operacion.md)
  - [INV-CAP-001: Inventario de infraestructura](docs/operacion/INV-CAP-001-inventario-de-infraestructura.md)
  - [PCN-CAP-001: Plan de continuidad y recuperacion ante desastres](docs/operacion/PCN-CAP-001-plan-de-continuidad-y-respaldo.md)

---

## 6. Seguridad y privacidad

- **Ley 29733 (Peru)**: El diseno protege los datos personales de clientes y personal; no se registran numeros telefonicos ni coordenadas exactas en interfaces no autorizadas.
- **Confidencialidad**: No se versionan archivos `.env`, llaves SSH, tokens de acceso ni copias de datos en produccion.

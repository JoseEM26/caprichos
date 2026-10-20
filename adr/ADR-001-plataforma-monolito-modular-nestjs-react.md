---
id: ADR-001
tipo: adr
titulo: "Plataforma: monolito modular en NestJS con front React y monorepo"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, D-12, DT-22, DT-23, DT-24, DT-36, DT-37, DEP-02, R-01]
tags: [adr, plataforma, nestjs, react, monorepo, g3]
---

# ADR-001: Plataforma: monolito modular en NestJS con front React y monorepo

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)

## Contexto

Caprichos tiene tres líneas de producto sobre los mismos datos: la carta virtual, el administrativo (con pantallas de cocina y el rol repartidor) y el chatbot de WhatsApp (DT-09). Hay **un solo desarrollador** (DT-07) y no hay fecha comprometida (DT-08).

El servidor es un VPS de 8 GB de RAM (DT-30). El marco Aybar usa por defecto el SDK en Java con Spring Boot, arquitectura hexagonal y microservicios; ese SDK está pensado para los servicios de Aybar Corp, no para un cliente externo de un solo local.

D-12 dejaba abiertos la plataforma, el lenguaje y el hosting. José Ángel eligió en formulario el 20/10/2026 (DT-22, DT-23, DT-24, DT-36, DT-37).

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Elegida:** monolito modular en **TypeScript con NestJS**, front **React + Vite** como PWA y monorepo con **pnpm workspaces**; cada módulo por dominio en hexagonal ligero | — | Que el volumen obligue a escalar un módulo por separado (por ejemplo, el bot) o que entre un segundo equipo. |
| Microservicios (uno por dominio, como en Aybar) | Multiplica despliegues, RAM y vigilancia para una sola persona y 8 GB. | Varios locales, varios equipos o un módulo con carga muy distinta. |
| Monolito con el bot como proceso aparte | Agrega un proceso y un canal entre los dos sin necesidad: el bot ya responde por la cola (ADR-007). | Que el bot sature la API en hora punta (se mide con la vigilancia, ADR-012). |
| Java con Spring Boot y el Aybar SDK | Consume 0,5 a 1 GB por proceso y es más lento de iterar para un solo desarrollador; obligaría a un segundo lenguaje para el front y el agente. | Que el proyecto pase a ser un servicio de Aybar Corp o lo mantenga un equipo Java. |
| Python con FastAPI | Tiempo real y procesos en segundo plano menos cómodos; dos lenguajes en el monorepo. | Que la IA del bot pase a ser el centro del sistema. |
| Next.js o Angular para el front | Next.js necesita otro proceso Node para el render en servidor; Angular es más pesado de iterar. | Que el posicionamiento en buscadores de la carta sea prioritario (Next.js). |

## Decisión

1. **Un solo backend NestJS** (`apps/api`) con un módulo por dominio: `carta`, `pedidos`, `caja`, `cocina`, `salon`, `reparto`, `stock`, `almacen`, `compras`, `ofertas`, `personas` (Party, ADR-004), `usuarios`, `bot`, `atencion`, `contenidos`, `configuracion`, `informes` y `notificaciones`.
2. **Hexagonal ligero por módulo** (DT-37): `dominio/` (entidades y reglas puras: precio, descuentos, stock, cupones), `aplicacion/` (casos de uso) e `infraestructura/` (Prisma, HTTP, WebSocket, colas). Las reglas de dominio se prueban sin base de datos. Un módulo solo usa otro a través de su servicio de aplicación exportado, nunca de sus tablas.
3. **Un solo front React + Vite** (`apps/web`) con tres entradas: carta (`caprichos.pe`), administrativo (`admin.caprichos.pe`) y pantallas de cocina y TV. Se instala como PWA en la PC de caja, las tablets y las pantallas (DT-29).
4. **Monorepo pnpm** (DT-36): `apps/api`, `apps/web`, `apps/agente-local` (ADR-002) y `packages/compartido` (tipos, cálculo de precio con opciones, descuentos, zonas y validaciones), que usan a la vez la API, el front y el bot, para que la carta, Nuevo pedido y el chatbot calculen igual (RN-CAP-005, RN-CAP-027).
5. **API REST bajo `/api/v1`** con errores en formato RFC 7807 y validación con `class-validator`; eventos en vivo por WebSocket (ADR-006). El catálogo de endpoints está en `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`.
6. **Desvío declarado del marco Aybar:** no se usan los starters del SDK Java, el CQRS con MongoDB ni Kafka. Se mantienen las prácticas del marco: gates, ADR, HU, Conventional Commits y PR revisados.

## Consecuencias

- Obliga a:
  - Mantener la regla de dependencias entre módulos con una prueba automática (dependency-cruiser) en el CI.
  - Poner todo cálculo de dinero en `packages/compartido`, con pruebas, para no duplicarlo en el front y el bot.
- Impide:
  - Desplegar un módulo por separado: todo se publica junto.
  - Usar componentes del SDK de Aybar en Java.
- Cuesta:
  - Un proceso Node de unos 300 a 500 MB de RAM.
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: ninguno adicional al VPS.

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: ninguna en este ADR (ver ADR-003 y ADR-004).
- Linaje: no aplica.
- Reglas de calidad: ninguna propia.

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (D-12, DT-22, DT-23, DT-24, DT-36, DT-37) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL

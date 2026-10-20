---
id: ADR-006
tipo: adr
titulo: "Tiempo real con WebSocket (Socket.IO) y salas por área, rol y mesa"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, DT-27, RNF-CAP-002, NEC-CAP-020, NEC-CAP-086]
tags: [adr, tiempo-real, websocket, g3]
---

# ADR-006: Tiempo real con WebSocket (Socket.IO) y salas por área, rol y mesa

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)

## Contexto

Cocina, caja, mesas, notificaciones, agotados y la consola de chats deben actualizarse sin recargar: un pedido debe verse en cocina en 3 segundos o menos (RNF-CAP-002). José eligió WebSocket con Socket.IO (DT-27).

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Elegida:** **Socket.IO** en la API NestJS, con el adaptador de Redis y salas por área, rol, mesa, pedido y dispositivo | — | Que un proxy o red bloquee WebSocket (Socket.IO cae a long-polling solo). |
| Server-Sent Events | Solo en un sentido; el agente de impresión y la TV necesitan confirmar. | Que el tiempo real se limite a avisos. |
| Consultar cada pocos segundos | No cumple RNF-CAP-002 en hora punta y gasta más. | Ninguno. |

## Decisión

1. Un **namespace por aplicación**: `/admin` (personal), `/carta` (estado de disponibilidad, horario y pausa, sin datos personales), `/dispositivo` (agente de impresión y TV de cocina).
2. Salas: `area:<id>` (pantallas de cocina), `rol:<rol>` (avisos por rol), `mesa:<id>`, `pedido:<id>` y `usuario:<id>` (avisos personales, como «tu pedido de mesa está listo»).
3. Eventos de dominio publicados por los casos de uso **después del commit** de la transacción: `pedido.creado`, `pedido.confirmado`, `comanda.estado`, `pedido.listo`, `agotado.cambio`, `altademanda.cambio`, `mesa.estado`, `reparto.tomado`, `chat.mensaje`, `notificacion.nueva` y `impresion.fallo`. La lista completa está en `arquitectura/ARQ-CAP-002`.
4. La conexión se autentica con el mismo token de acceso (ADR-008); las llaves de dispositivo, con su propia llave. Al reconectar, el cliente pide el estado actual por REST: los eventos avisan, el REST manda.
5. Funciona detrás del proxy de Cloudflare (ADR-011), con un latido cada 25 segundos.

## Consecuencias

- Obliga a:
  - Publicar eventos solo después del commit.
  - Que cada pantalla recargue su estado al reconectarse.
- Impide:
  - Usar el WebSocket como única fuente de verdad.
- Cuesta:
  - Pocos MB de RAM por conexión; un local tiene decenas de conexiones.
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: ninguno.

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: ninguna (los eventos no se guardan; las notificaciones sí, en `notificacion`, ADR-003).
- Linaje: los casos de uso publican y las pantallas consumen. El namespace `/carta` no lleva datos personales.
- Reglas de calidad: ninguna propia.

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (DT-27) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL

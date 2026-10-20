---
id: ADR-013
tipo: adr
titulo: "Modo sin internet con base local en el agente de caja (fase aparte)"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, D-11, DT-12, DT-29, R-06, RN-CAP-050, RNF-CAP-018]
tags: [adr, offline, sincronizacion, fase-aparte, g3]
---

# ADR-013: Modo sin internet con base local en el agente de caja (fase aparte)

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)

## Contexto

Kevin prefiere seguir operando sin internet (NEC-CAP-022). Es una fase aparte con cotización propia (DT-12, D-11). El agente local (ADR-002) ya corre en la PC de caja y llega a las ticketeras por la red local.

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Propuesta:** el agente local amplía su papel a **servidor de respaldo** con **SQLite**: caja, mozos y cocina se conectan a él por la red local cuando no hay internet, y al volver se sincroniza en orden con la API | — | Que las caídas sean raras y cortas (entonces, procedimiento manual de contingencia). |
| Base local en cada equipo (PWA con IndexedDB) | Varios equipos sin coordinar generan conflictos (misma mesa en dos tablets). | Un solo equipo en el local. |
| Procedimiento manual (papel y carga posterior) | Pierde los tiempos de cocina y duplica trabajo. | Si la fase no se aprueba. |

## Decisión

1. **Estado: propuesto, no entra en el piloto** (DT-12).
2. Cuando la PWA detecta que no llega a la API, cambia a la dirección local del agente (`http://caja.local`); el agente sirve los pedidos, cobros, comandas y mesas desde SQLite.
3. Cada registro creado sin internet lleva un identificador UUID generado en el local y un número de orden; al volver, el agente los envía en orden a la API, que los acepta de forma idempotente (RNF-CAP-018).
4. Conflictos: la mesa la decide el agente (es la única autoridad sin internet); el catálogo y los precios no se editan sin internet.
5. Sin internet no llegan pedidos de la carta ni de WhatsApp; la carta muestra que no se reciben pedidos.

## Consecuencias

- Obliga a:
  - Cotizar y aprobar la fase (D-11).
  - Relevar equipos del local, si la caja queda siempre encendida y la frecuencia de caídas.
- Impide:
  - Editar la carta, las ofertas o los usuarios sin internet.
- Cuesta:
  - Desarrollo de la sincronización y pruebas de corte.
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: ninguno de infraestructura.

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: `cola_sincronizacion` (en el agente) y copia local de pedidos, cobros, comandas y mesas.
- Linaje: local → agente (SQLite) → API al volver la conexión.
- Reglas de calidad: 0 registros perdidos o duplicados en una prueba de corte de 30 minutos (RNF-CAP-018).

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (D-11, DT-12, DT-29) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL

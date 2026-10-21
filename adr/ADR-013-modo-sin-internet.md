---
id: ADR-013
tipo: adr
titulo: "Modo sin internet con un mini servidor en la PC de caja"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-20
relacionados: [CAP-PENDIENTE, D-11, DT-12, DT-29, DT-52, R-06, RN-CAP-050, RNF-CAP-018]
tags: [adr, offline, sincronizacion, mini-servidor, g3]
---

# ADR-013: Modo sin internet con un mini servidor en la PC de caja

- Estado: propuesto
- Ticket: *(pendiente — R13, D-14)* - Fecha: 2026-10-20
- Compatibilidad con M0: (pendiente — no hay lineamiento M0 para este cliente; se pide dispensa porque Caprichos no es un servicio de Aybar Corp; la decide el TL, DT-48)

## Contexto

Kevin prefiere seguir operando sin internet (NEC-CAP-022). El agente local (ADR-002) ya corre en la PC de caja y llega a las ticketeras por la red local. El equipo decidió el 20/10/2026 **hacerlo** y construirlo **después de la primera meta** (la carta y el administrativo en línea, sin el agente local todavía) (DT-52).

Hoy hay **una sola tablet** (la del mozo), además de las computadoras de caja y cocina. La red del local (el router) sigue funcionando sin internet.

El equipo descartó el router con respaldo 4G (DT-52) y **aceptó el riesgo** de que, sin internet, no lleguen los pedidos de la carta ni de WhatsApp ni se mande información al delivery: lo que importa es el local.

## Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
| --- | --- | --- |
| **Elegida:** el agente local de la PC de caja crece a un **mini servidor** con **SQLite**: caja, mozo y cocina se conectan a él por la red del local cuando no hay internet, y al volver se sincroniza en orden con la API | — | Que las caídas sean raras y cortas, o que el costo de construirlo no se justifique frente al modo manual. |
| Router con respaldo 4G | Descartada por el equipo (DT-52): no les gustará la idea; es un equipo y un chip más que mantener. | Que las caídas sean largas y frecuentes. |
| Base local en cada equipo (PWA con IndexedDB) | La tablet y cocina no se pueden pasar pedidos entre sí sin un punto central; los conflictos de mesa se vuelven difíciles. | Un solo equipo en el local. |
| Procedimiento manual (papel y carga posterior) | Pierde los tiempos de cocina y duplica trabajo. Queda como respaldo mientras el mini servidor no exista (PCN-CAP-001). | Si el mini servidor no se construye. |

## Decisión

1. **Estado: decidido por el equipo (DT-52); se construye en la segunda meta**, después de la carta y el administrativo en línea. La cotización queda aparte (DT-12).
2. Cuando la PWA detecta que no llega a la API, cambia a la dirección local del mini servidor (`http://caja.local`, o una IP fija en la red del local); el mini servidor sirve los pedidos, cobros, comandas y mesas desde SQLite.
3. Cada registro creado sin internet lleva un identificador UUID generado en el local y un número de orden; al volver, el mini servidor los envía en orden a la API, que los acepta de forma idempotente (RNF-CAP-018).
4. Conflictos: la mesa la decide el mini servidor, que es la única autoridad sin internet; con una sola tablet los conflictos son pocos. El catálogo y los precios no se editan sin internet.
5. Sin internet no llegan pedidos de la carta ni de WhatsApp (riesgo aceptado); la carta muestra que no recibe pedidos.
6. Mientras el mini servidor no exista, el respaldo es el **modo manual** del plan de continuidad (PCN-CAP-001).

## Consecuencias

- Obliga a:
  - Mantener la PC de caja encendida en horario de atención y con la red del local estable.
  - Cotizar la fase con Kevin (queda pendiente solo el precio, DT-12).
  - Probar cortes reales de internet antes de darla por buena (RNF-CAP-018).
- Impide:
  - Editar la carta, las ofertas o los usuarios sin internet.
  - Recibir pedidos de la carta o de WhatsApp durante una caída.
- Cuesta:
  - Desarrollo de la sincronización y pruebas de corte; sin hardware nuevo (usa la PC de caja y el router que ya existen).
  - Costo cloud: no aplica la calculadora de Azure; el proyecto corre en un VPS de US$ 7,27 al mes (DT-30). Costo propio de esta decisión: ninguno de infraestructura.

## Datos (puerta F4 de Gobierno de Datos, si toca datos)

- Entidades nuevas: `cola_sincronizacion` (en el mini servidor) y copia local de pedidos, cobros, comandas y mesas.
- Linaje: local → mini servidor (SQLite) → API al volver la conexión.
- Reglas de calidad: 0 registros perdidos o duplicados en una prueba de corte de 30 minutos (RNF-CAP-018).

---

Generado por IA: ADR formalizado desde las elecciones del equipo en `analisis/decisiones.md` (D-11, DT-12, DT-29, DT-52) y los requerimientos del paquete — Revisado por: (pendiente) - Aprueba: TL

---
id: EP-CAP-006
tipo: spec
titulo: "EP-CAP-006 Cocina por áreas e impresión"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-013, NEC-CAP-020, NEC-CAP-021, NEC-CAP-037, NEC-CAP-060, NEC-CAP-072, NEC-CAP-073, NEC-CAP-074, NEC-CAP-101]
tags: [epica, plt-02, g1, cocina, debe-tener]
---

# EP-CAP-006 — Cocina por áreas e impresión

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-006 |
| NOMBRE | Cocina por áreas e impresión |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debe tener |
| HORIZONTE | Ahora |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Cocina y barra reciben los pedidos de forma desordenada y un combo no se reparte entre áreas: cada área no sabe qué parte le toca. La comanda se imprime a mano y, si la ticketera falla, el pedido se pierde. En hora punta no hay forma de avisar que el tiempo de entrega sube.

**Usuarios / segmentos**

- ACT-CAP-003: cocina y barra (bebidas, postres y salados)
- ACT-CAP-002: cajero/a, que reimprime si algo falla
- ACT-CAP-001: el dueño, que crea áreas propias

**Evidencia**

- NEC-CAP-020, NEC-CAP-037 y NEC-CAP-072: pantallas por área y avance por separado.
- NEC-CAP-013, NEC-CAP-021 y NEC-CAP-060: comandas y etiquetas.
- NEC-CAP-073, NEC-CAP-074 y NEC-CAP-103: agotado por hoy y alta demanda.
- `analisis/pantalla-cocina.md` e `analisis/impresion-tickets.md`.

**Alineamiento estratégico**

- OBJ-CAP-001 Entregar más rápido (al cliente se le dice de 25 a 35 minutos, V1; acta 03).
- NEC-CAP-001 El pedido llega a cocina sin reescribirse.

## 2 OBJETIVOS

**Objetivo de negocio**

Bajar el tiempo de entrega a la meta acordada (D-01) haciendo que cada área vea solo lo suyo y que la comanda salga sola.

**Objetivo del usuario**

Que el cocinero vea en su pantalla qué preparar, con opciones y notas, y lo avance con un toque.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Minutos desde que el pedido entra a cocina hasta que está listo | 20-25 min declarado (por medir) | la que permita entregar dentro de 25 a 35 minutos (OBJ-CAP-001, V1; se fija con la primera medición) | Registro de tiempos del sistema | Diaria |
| Comandas que no se imprimieron y no se reimprimieron | Por medir | Cero (propuesta) | Registro de impresión | Diaria |
| Pedidos con producto agotado que llegaron a cocina | Por medir | Cero (OBJ-CAP-002) | Registro de pedidos | Diaria |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Pantalla por área (bebidas, postres, salados) y vista general, sin desplazamiento (NEC-CAP-037).
- Cada área avanza su parte; el pedido queda listo cuando todas terminan (RN-CAP-084).
- TV de cocina de solo lectura con llave propia (RN-CAP-023).
- Comanda y etiquetas impresas al pasar a cocina, por área; alerta y reimpresión si falla (RN-CAP-019 a RN-CAP-021).
- Agotado por hoy desde cocina (NEC-CAP-073).
- Alta demanda: minutos extra y pausa de pedidos (NEC-CAP-103).
- Hasta cuatro áreas propias creadas por el dueño (NEC-CAP-101).

**Fuera de alcance (OUT)**

- El stock de insumos de cocina y sus mermas: EP-CAP-010.
- Pantalla o etiquetera de despacho dedicada (se evalúa después).
- Televisores para clientes (horizonte futuro).

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-COC-01 | Pantallas de cocina por área | Debe tener | Redactada en draft: [`FT-COC-01-pantallas-de-cocina-por-area.md`](../features/FT-COC-01-pantallas-de-cocina-por-area.md) |
| FT-COC-02 | Impresión de comandas y etiquetas | Debe tener | Redactada en draft: [`FT-COC-02-impresion-de-comandas-y-etiquetas.md`](../features/FT-COC-02-impresion-de-comandas-y-etiquetas.md) |
| FT-COC-03 | Agotado por hoy y alta demanda | Debe tener | Redactada en draft: [`FT-COC-03-agotado-por-hoy-y-alta-demanda.md`](../features/FT-COC-03-agotado-por-hoy-y-alta-demanda.md) |

**Supuestos**

- Hay 3 áreas de producción con computadora propia y una TV en cocina.
- Las ticketeras del local se pueden usar desde el sistema (D-13).

**Restricciones**

- La TV no se administra: solo muestra (A5).
- Cada área imprime solo lo suyo (RN-CAP-020).

**Dependencias y riesgos**

- DEP-03 Modelo y conexión de las ticketeras (D-13).
- R-08 Ticketeras incompatibles.
- R-06 Caída de internet.

**Criterios de éxito / salida**

- Un combo con bebida y postre aparece en cada pantalla solo con su parte.
- Al aceptar un pedido sale la comanda; si la ticketera está apagada, caja ve la alerta y reimprime.
- Un producto marcado agotado por hoy desaparece de la carta y del chatbot.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §4 y §5 (NEC-CAP-013, NEC-CAP-020, NEC-CAP-021, NEC-CAP-037, NEC-CAP-060, NEC-CAP-072 a NEC-CAP-074, NEC-CAP-101, RN-CAP-019 a RN-CAP-023, RN-CAP-084), `analisis/pantalla-cocina.md` e `analisis/impresion-tickets.md` — Revisado por: *(pendiente)*

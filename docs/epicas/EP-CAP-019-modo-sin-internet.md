---
id: EP-CAP-019
tipo: spec
titulo: "EP-CAP-019 Modo sin internet"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-022, RN-CAP-050]
tags: [epica, plt-02, g1, offline, no-esta-vez]
---

# EP-CAP-019 — Modo sin internet

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-019 |
| NOMBRE | Modo sin internet |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debe tener (segunda meta, DT-52) |
| HORIZONTE | Segunda meta: después de la carta y el administrativo en línea (cotización por definir) |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Si se cae internet en hora punta, el local no puede tomar pedidos, cobrar ni ver la cocina. Kevin prefiere tener un modo que siga funcionando y que se sincronice al volver.

**Usuarios / segmentos**

- ACT-CAP-002: cajero/a
- ACT-CAP-004: mozos
- ACT-CAP-003: cocina y barra

**Evidencia**

- NEC-CAP-022 y RN-CAP-050.
- BRD §4 «Propuesto como fase aparte» (acta 02, 15/10).
- Mockup: propuesta de modo sin internet (`Offline.dc.html`).

**Alineamiento estratégico**

- R-06 Caída de internet.
- DT-12 Fase aparte con cotización.

## 2 OBJETIVOS

**Objetivo de negocio**

No perder ventas cuando se cae internet.

**Objetivo del usuario**

Que caja, mozos y cocina sigan trabajando por la red del local sin internet.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Pedidos perdidos por caída de internet | Por medir | Cero (propuesta) | Registro de sincronización | Por incidente |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Base local en la computadora de caja que guarda pedidos, cobros y comandas.
- Caja, mozos y cocina operando por la red del local.
- Sincronización en orden al volver internet, sin perder ni duplicar.

**Fuera de alcance (OUT)**

- Pedidos de la carta y de WhatsApp durante la caída: no llegan sin internet. **Riesgo aceptado por el dueño** (DT-52).
- Información al delivery durante la caída: no se envía. También aceptado.
- Router con respaldo 4G: descartado (DT-52).

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-OFF-01 | Operación local y sincronización | Debe tener | Redactada en draft: [`FT-OFF-01-operacion-local-y-sincronizacion.md`](../features/FT-OFF-01-operacion-local-y-sincronizacion.md) |

**Supuestos**

- Hay red local estable entre caja, mozos y cocina, que sigue funcionando sin internet.
- Hoy hay **una sola tablet** (la del mozo).
- La PC de caja está encendida en horario de atención.

**Restricciones**

- Se construye **después de la primera meta** (carta y administrativo en línea, sin el agente local) y se cotiza aparte (DT-12, DT-52).

**Dependencias y riesgos**

- DT-52 Decisión: mini servidor en la caja, sin router 4G, riesgo aceptado. D-11 resuelta; falta su cotización.
- ADR del modo sin internet (bloque 4).

**Criterios de éxito / salida**

- Con internet cortado, un pedido del mozo llega a cocina y se cobra; al volver, se sincroniza sin duplicados.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §4 y §7 (NEC-CAP-022, RN-CAP-050) y la propuesta del acta 02 — Revisado por: *(pendiente)*

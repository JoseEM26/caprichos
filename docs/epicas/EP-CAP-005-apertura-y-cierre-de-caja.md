---
id: EP-CAP-005
tipo: spec
titulo: "EP-CAP-005 Apertura y cierre de caja"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-062, RN-CAP-077, RN-CAP-079, RN-CAP-080, RN-CAP-088, RN-CAP-097]
tags: [epica, plt-02, g1, caja, debe-tener]
---

# EP-CAP-005 — Apertura y cierre de caja

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-005 |
| NOMBRE | Apertura y cierre de caja |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debe tener |
| HORIZONTE | Ahora |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Al final del día hay que saber cuánto se vendió por cada medio y si el efectivo de la gaveta cuadra. Hoy no queda un historial confiable de cierres, y el efectivo que cobran los repartidores se mezcla con el de la caja.

**Usuarios / segmentos**

- ACT-CAP-002: cajero/a, que abre, registra movimientos y cierra
- ACT-CAP-001: el dueño, que revisa los cierres y las diferencias
- ACT-CAP-009: repartidores, que liquidan el efectivo cobrado

**Evidencia**

- NEC-CAP-062 y reunión del 18/10: cierre de caja del día.
- RN-CAP-077 a RN-CAP-080, RN-CAP-088 y RN-CAP-097.
- `analisis/cierre-de-caja.md`.
- Mockup: Caja, historial de cierres.

**Alineamiento estratégico**

- Control del dinero del negocio (BRD §2).
- NEC-CAP-062 Cierre de caja del día.

## 2 OBJETIVOS

**Objetivo de negocio**

Que cada día cierre con el efectivo cuadrado o con la diferencia registrada y explicada, y que el historial de cierres no se pueda borrar.

**Objetivo del usuario**

Que el cajero abra y cierre la caja en minutos, viendo lo que dice el sistema mientras cuenta.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Cierres con diferencia de efectivo | Por medir | Menos del 10 % de los cierres (propuesta) | Historial de cierres | Semanal |
| Diferencias registradas sin explicación | Por medir | Cero (RN-CAP-080) | Historial de cierres | Semanal |
| Minutos que toma cerrar la caja | Por medir | 10 minutos o menos (propuesta) | Registro de tiempos del sistema | Diaria |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Abrir la caja en cero o con un monto de apertura (RN-CAP-077).
- Ingresos y egresos durante el turno, con motivo.
- Ventas del turno por medio de pago.
- Liquidación del efectivo de cada repartidor (RN-CAP-088).
- Arqueo **ciego** con billetes y monedas: el cajero solo ve «Cuadra» o «No cuadra»; el efectivo esperado y la diferencia los ve la supervisora con su PIN (RN-CAP-079, RN-CAP-080, DT-61).
- Historial de cierres que no se borra.

**Fuera de alcance (OUT)**

- El cobro de cada pedido: EP-CAP-004.
- Informes de caja por período: EP-CAP-018.
- Conciliación bancaria de Yape, Plin y transferencias.

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-CIE-01 | Apertura, movimientos y liquidación de repartidores | Debe tener | Redactada en draft: [`FT-CIE-01-apertura-movimientos-y-liquidacion-de-repartidores.md`](../features/FT-CIE-01-apertura-movimientos-y-liquidacion-de-repartidores.md) |
| FT-CIE-02 | Arqueo ciego y cierre con historial | Debe tener | Redactada en draft: [`FT-CIE-02-arqueo-y-cierre-con-historial.md`](../features/FT-CIE-02-arqueo-y-cierre-con-historial.md) |

**Supuestos**

- Hay una sola caja abierta a la vez.
- El monto de apertura lo decide el dueño (D-15).

**Restricciones**

- No se cierra con pedidos sin cobrar o por confirmar (RN-CAP-079).
- No se cierra con efectivo de repartidores sin liquidar (RN-CAP-097).

**Dependencias y riesgos**

- D-15 Monto de apertura y medios de pago reales.
- R-01 Alcance amplio.

**Criterios de éxito / salida**

- Un día de prueba cierra con el efectivo esperado correcto y la diferencia registrada.
- La caja no se puede cerrar con un repartidor sin liquidar.
- El cierre queda en el historial y no se puede borrar.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §5 (NEC-CAP-062, RN-CAP-077 a RN-CAP-080, RN-CAP-088, RN-CAP-097), `analisis/cierre-de-caja.md` y el mockup de Caja — Revisado por: *(pendiente)*

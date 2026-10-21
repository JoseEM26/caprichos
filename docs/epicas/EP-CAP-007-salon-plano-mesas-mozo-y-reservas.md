---
id: EP-CAP-007
tipo: spec
titulo: "EP-CAP-007 Salón: plano, mesas, pedido del mozo y reservas"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-014, NEC-CAP-023, NEC-CAP-043, NEC-CAP-052, NEC-CAP-053, NEC-CAP-078, NEC-CAP-095, NEC-CAP-107]
tags: [epica, plt-02, g1, salon, debe-tener]
---

# EP-CAP-007 — Salón: plano, mesas, pedido del mozo y reservas

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-007 |
| NOMBRE | Salón: plano, mesas, pedido del mozo y reservas |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debe tener |
| HORIZONTE | Ahora |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

En el salón se mezclan pedidos de dos personas en la misma mesa y no se sabe qué mesas están libres o reservadas. El mozo anota en papel y el pedido se reescribe en caja. Las reservas llegan por WhatsApp sin un lugar donde verlas.

**Usuarios / segmentos**

- ACT-CAP-004: mozos, que toman pedidos en mesa con tablet
- ACT-CAP-002: cajero/a, que cobra y libera mesas
- ACT-CAP-001: el dueño, que dibuja el plano

**Evidencia**

- NEC-CAP-014 y NEC-CAP-052: plano por piso administrable.
- NEC-CAP-023, NEC-CAP-053 y NEC-CAP-078: mesas y pedido del mozo.
- NEC-CAP-095 y NEC-CAP-107: reservas como calendario.
- `analisis/plano-del-local.md` y el mockup del Plano y del Nuevo pedido.

**Alineamiento estratégico**

- OBJ-CAP-001 Entregar más rápido: el pedido del mozo va directo a cocina (DT-16).
- R-09 Evitar pedidos duplicados en una mesa.

## 2 OBJETIVOS

**Objetivo de negocio**

Que el salón trabaje sin papel: el pedido del mozo llega directo a cocina y ninguna mesa se usa dos veces.

**Objetivo del usuario**

Que el mozo elija la mesa en el plano o con botones de mesas libres y arme el pedido con las mismas opciones de la carta.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Mesas abiertas dos veces a la vez | Por medir | Cero (propuesta) | Registro de pedidos de mesa | Diaria |
| Pedidos de mesa escritos en papel | Por medir | Cero (propuesta) | Observación en el piloto | Semanal |
| Reservas anuladas por no asistencia sin aviso | Por medir | Por definir (propuesta) | Registro de reservas | Mensual |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Plano por piso con mesas, cocina, barra, caja, baños, paredes, escalera y entrada; girar, copiar y pegar el diseño (NEC-CAP-052).
- Pedido del mozo: mesa libre o plano, mismas opciones que la carta, directo a cocina (RN-CAP-027, RN-CAP-073).
- Una mesa ocupada no se abre otra vez; se agregan consumos como comanda adicional (RN-CAP-025, RN-CAP-090).
- Varias mesas juntas en un pedido (RN-CAP-108).
- Precuenta del mozo; el cajero cobra (RN-CAP-030).
- Reservas como solicitud aprobada por mozo o caja, con tolerancia y calendario del mes (RN-CAP-047, RN-CAP-107).

**Fuera de alcance (OUT)**

- Reservas desde la web (descartado, DT-13).
- Cobro en la mesa por el mozo (RN-CAP-030).
- Televisores para clientes.

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-SAL-01 | Plano del local | Debe tener | Redactada en draft: [`FT-SAL-01-plano-del-local.md`](../features/FT-SAL-01-plano-del-local.md) |
| FT-SAL-02 | Pedido del mozo y control de mesas | Debe tener | Redactada en draft: [`FT-SAL-02-pedido-del-mozo-y-control-de-mesas.md`](../features/FT-SAL-02-pedido-del-mozo-y-control-de-mesas.md) |
| FT-SAL-03 | Reservas | Debe tener | Redactada en draft: [`FT-SAL-03-reservas.md`](../features/FT-SAL-03-reservas.md) |

**Supuestos**

- Los mozos usan tablet o celular en el salón.
- Hoy hay un piso; el segundo está desactivado.

**Restricciones**

- El mozo no cobra (RN-CAP-030).
- Una mesa con pedido abierto o reserva activa no se elimina del plano (RN-CAP-068).

**Dependencias y riesgos**

- DEP-08 Plano real del local (D-16).
- R-09 Pedidos duplicados en una mesa.

**Criterios de éxito / salida**

- Una mesa ocupada no se puede abrir otra vez desde caja ni desde el mozo.
- Un pedido del mozo aparece en cocina sin pasar por caja.
- Una reserva de 8 personas con varias mesas suma los asientos y no deja guardar si faltan.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §4 y §5 (NEC-CAP-014, NEC-CAP-023, NEC-CAP-043, NEC-CAP-052, NEC-CAP-053, NEC-CAP-078, NEC-CAP-095, NEC-CAP-107, RN-CAP-025, RN-CAP-027, RN-CAP-030, RN-CAP-047, RN-CAP-068, RN-CAP-073, RN-CAP-090, RN-CAP-107, RN-CAP-108) y `analisis/plano-del-local.md` — Revisado por: *(pendiente)*

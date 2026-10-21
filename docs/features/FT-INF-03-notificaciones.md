---
id: FT-INF-03
tipo: spec
titulo: "Notificaciones"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-018, FT-PED-03, FT-COC-01, FT-STK-03, FT-DEL-03, FT-ATN-01, ADR-001, ADR-011, ADR-014, ADR-006, ADR-012, NEC-CAP-028, NEC-CAP-086]
tags: [informes, plt-03, ep-cap-018, ft-inf-03, deberia-tener]
---

# FT-INF-03 — Notificaciones

**PLT-03 · Feature · Catálogo de requerimientos** · Frente INFORMES · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-INF-03 | Notificaciones | EP-CAP-018 Informes, indicadores y notificaciones |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-028 · NEC-CAP-086) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Una **campanita** en el administrativo reúne los avisos de cada rol: pedido nuevo por confirmar, pedido listo, entrega fallida, pago por validar, cliente que pide una persona, stock bajo, impresión fallida, mensaje o queja de la carta. Cada aviso lleva a su pantalla con un toque. Hay una **página de Notificaciones** con filtros por tipo, estado (leídas, sin leer), búsqueda y fechas, agrupada por día. Los avisos importantes suenan. Cada rol solo recibe los avisos de su función.

**Beneficio esperado.** Que nada importante se pase por alto en hora punta. Hipótesis medible: **100 % de pedidos nuevos y fallos de impresión notificados**.

**Usuarios / roles.** ACT-CAP-002 Cajero/a (recibe avisos de caja) · ACT-CAP-004 Mozos (recibe avisos de mesa) · ACT-CAP-005 Almacén (recibe avisos de stock) · ACT-CAP-001 Kevin Rosales, dueño y administrador (recibe todos).

**Pantallas de referencia.** Administrativo ▸ campanita y página Notificaciones (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-INF-03-01 | La campanita muestra los avisos sin leer del rol y lleva a su pantalla con un toque. | Debería tener | NEC-CAP-086 | Dado un pedido nuevo, cuando el cajero toca su aviso, entonces se abre el pedido y el aviso queda leído. | Propuesto |
| RQ-INF-03-02 | Cada rol recibe solo los avisos de su función. | Debe tener | RN-CAP-013 | Dado un aviso de stock bajo, cuando entra un mozo, entonces no lo ve; almacén sí. | Propuesto |
| RQ-INF-03-03 | Los avisos importantes suenan. | Debería tener | NEC-CAP-028 | Dado un pedido nuevo o un urgente, cuando llega, entonces suena; un aviso de stock bajo no suena. | Propuesto |
| RQ-INF-03-04 | La página de Notificaciones filtra por tipo, estado, búsqueda y fechas, agrupando por día. | Debería tener | NEC-CAP-047 · NEC-CAP-050 | Dados avisos de una semana, cuando el administrador filtra «Impresión» sin leer, entonces ve solo esos agrupados por día. | Propuesto |
| RQ-INF-03-05 | Se marcan todos como leídos. | Podría tener | Mockup | Dados 12 avisos sin leer, cuando toca «Marcar todo leído», entonces la campanita queda en cero. | Propuesto |

Prioridad *Debería tener* por la épica; va en la fase Ahora porque caja necesita el aviso de pedido nuevo. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-002 | Tiempo real | Un pedido que pasa a cocina aparece en todas sus pantallas sin recargar. | Retardo ≤ 3 s (p95) · medición: registro de eventos (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-002 aplica: el aviso llega sin recargar.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-013 | Cada rol ve solo lo de su función. | Prototipo |
| RN-CAP-048 | Pedir una persona muestra un aviso hasta que se atienda. | Acta 02 |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-INF-03-01 | HU-CAP-166 | — | R-01 |
| RQ-INF-03-02 | HU-CAP-166 | FT-USR-02 | R-01 |
| RQ-INF-03-03 | HU-CAP-166 | — | R-01 |
| RQ-INF-03-04 | HU-CAP-167 | — | R-01 |
| RQ-INF-03-05 | HU-CAP-167 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-166 Recibir y abrir avisos en la campanita
- HU-CAP-167 Consultar la página de Notificaciones

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-006, ADR-012.

**Fuera de alcance**

- Avisos por correo y WhatsApp a gerencia: FT-CAR-03 y FT-ATN-03.
- Notificaciones push del navegador (propuesta para después).

**Preguntas abiertas**

1. **¿Avisos push al celular del mozo?** Propuesta: después del piloto.

---

Generado por IA: BRD (NEC-CAP-028, 047, 050, 086; RN-CAP-013, 048) y el mockup de Notificaciones — Revisado por: *(pendiente)*

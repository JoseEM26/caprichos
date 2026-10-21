---
id: FT-ALM-01
tipo: spec
titulo: "Movimientos de almacén"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-010, FT-STK-01, FT-ALM-03, FT-COM-03, ADR-001, ADR-011, ADR-014, ADR-003, NEC-CAP-026, NEC-CAP-102, RN-CAP-046, RN-CAP-114, RN-CAP-115, RN-CAP-127]
tags: [almacen, plt-03, ep-cap-010, ft-alm-01, deberia-tener]
---

# FT-ALM-01 — Movimientos de almacén

**PLT-03 · Feature · Catálogo de requerimientos** · Frente ALMACEN · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-ALM-01 | Movimientos de almacén | EP-CAP-010 Almacén y producción |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-026 · NEC-CAP-102) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Almacén registra **entradas, salidas, mermas y devoluciones** de los insumos con los que se prepara (RN-CAP-115). Hay un solo almacén (RN-CAP-046). Una **salida** a cocina o barra es un **traslado**: queda «por recibir» y el stock del área sube solo cuando el área confirma con «Recibí», con la cantidad real y anotando la diferencia (RN-CAP-127). Al registrar una salida, merma o devolución solo se ofrecen los insumos con stock mayor que cero, con un botón para ver los de stock cero; en una entrada se ofrecen todos (RN-CAP-114). La cantidad solo admite números y no puede pasar del stock. Una merma puede incluir varios insumos a la vez, cada uno con su cantidad, origen y destino (RN-CAP-116). El historial se filtra por tipo, origen, insumo y fechas, con filtros plegables (RN-CAP-118). Los tipos de movimiento y orígenes se gestionan desde el mismo módulo (NEC-CAP-016).

**Beneficio esperado.** Stock del almacén y de cada área que cuadra, con cada movimiento explicado. Hipótesis medible: **100 % de traslados confirmados por el área o con diferencia registrada**; **0 salidas mayores al stock**.

**Usuarios / roles.** ACT-CAP-005 Almacén (registra movimientos) · ACT-CAP-003 Cocina y barra (confirma lo recibido) · ACT-CAP-001 Kevin Rosales, dueño y administrador (todo).

**Pantallas de referencia.** Administrativo ▸ Almacén ▸ movimientos, traslados por recibir, historial con filtros (`Admin.dc.html`); `analisis/flujo-cocina-y-almacen.md` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-ALM-01-01 | Almacén registra entradas, salidas, mermas y devoluciones de insumos, con origen, cantidad y nota. | Debería tener | NEC-CAP-026 · RN-CAP-115 | Dada una entrada de 10 kg de harina, cuando almacén la registra con Sí/No, entonces el almacén sube 10 kg y queda el movimiento con autor y hora. | Propuesto |
| RQ-ALM-01-02 | En salida, merma o devolución solo se ofrecen insumos con stock; en entrada, todos. | Debería tener | RN-CAP-114 | Dado el azúcar en cero, cuando almacén registra una salida, entonces no aparece salvo que toque «Ver también sin stock». | Propuesto |
| RQ-ALM-01-03 | La cantidad solo admite números y no puede pasar del stock disponible. | Debe tener | RN-CAP-115 · RN-CAP-117 | Dados 5 kg de harina, cuando almacén registra una salida de 6 kg, entonces no se acepta y ve el máximo. | Propuesto |
| RQ-ALM-01-04 | Una salida a un área es un traslado «por recibir» y el área confirma con «Recibí». | Debería tener | RN-CAP-127 · RN-CAP-093 | Dada una salida de 6 L de leche a Barra, cuando se registra, entonces el almacén baja 6 L y Barra ve «Por recibir: 6 L»; al tocar «Recibí», Barra sube 6 L. | Propuesto |
| RQ-ALM-01-05 | Al recibir, el área anota la cantidad real y se registra la diferencia. | Debería tener | RN-CAP-127 | Dado un traslado de 6 L, cuando Barra confirma 5,5 L, entonces Barra sube 5,5 L y queda una diferencia de 0,5 L con su autor. | Propuesto |
| RQ-ALM-01-06 | Una merma puede incluir varios insumos, cada uno con cantidad, origen y destino. | Debería tener | RN-CAP-116 | Dada una merma de leche (1 L) y huevos (3 u) con destino «desecho» para ambos, cuando se registra, entonces queda un movimiento por insumo con el mismo destino. | Propuesto |
| RQ-ALM-01-07 | El historial se filtra por tipo, origen, insumo y fechas, con filtros plegables. | Debería tener | RN-CAP-118 · NEC-CAP-050 | Dados movimientos de un mes, cuando almacén filtra «Merma» de leche del 1 al 7, entonces solo ve esos. | Propuesto |
| RQ-ALM-01-08 | Los tipos de movimiento y orígenes se crean y desactivan desde el mismo módulo; por defecto entrada y salida. | Podría tener | NEC-CAP-016 · RN-CAP-026 | Dado el combo de origen, cuando almacén crea «Proveedor B», entonces queda disponible al instante; no se puede eliminar, solo desactivar. | Propuesto |
| RQ-ALM-01-09 | Un movimiento no se edita ni se borra: se anula con un movimiento inverso y motivo. | Debe tener | RN-CAP-014 · RNF-CAP-020 | Dada una entrada mal registrada, cuando almacén la anula con motivo, entonces se crea el movimiento inverso y ambos quedan en el historial. | Propuesto |

Prioridad *Debería tener* por la épica (fase Siguiente). RQ-ALM-01-03 y 09 son *Debe tener* porque protegen la integridad del stock. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-020 | Trazabilidad | Todo cambio de stock deja un movimiento con origen, cantidad, autor y fecha. | 100 % de cambios de stock con movimiento (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-006 aplica a la separación de pantallas: Almacén registra insumos y Cocina solo merma de sus productos (RN-CAP-115).

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-046 | Por ahora solo entrada, salida y merma; un solo almacén. | Acta 02 |
| RN-CAP-093 | Entregar insumos desde el almacén baja el stock central y deja la salida. | Almacén |
| RN-CAP-114 | En salida, merma o devolución solo insumos con stock; en entrada, todos. | Almacén |
| RN-CAP-115 | Movimientos divididos por pantalla; la cantidad no pasa del stock. | Cocina, Almacén |
| RN-CAP-116 | Merma de varios productos a la vez con origen y destino. | Cocina, Almacén |
| RN-CAP-118 | El historial se filtra por tipo, origen, insumo y fechas. | Stock, Almacén |
| RN-CAP-127 | Una salida del almacén es un traslado «por recibir»; el área confirma con «Recibí». | Stock |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-ALM-01-01 | HU-CAP-088 | — | R-01 |
| RQ-ALM-01-02 | HU-CAP-088 | — | R-01 |
| RQ-ALM-01-03 | HU-CAP-088 | — | R-01 |
| RQ-ALM-01-04 | HU-CAP-089 | — | R-01 |
| RQ-ALM-01-05 | HU-CAP-089 | — | R-01 |
| RQ-ALM-01-06 | HU-CAP-090 | FT-ALM-03 | R-01 |
| RQ-ALM-01-07 | HU-CAP-090 | — | R-01 |
| RQ-ALM-01-08 | HU-CAP-090 | — | R-01 |
| RQ-ALM-01-09 | HU-CAP-088 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-088 Registrar entradas, salidas, mermas y devoluciones
- HU-CAP-089 Trasladar insumos a un área y confirmar lo recibido
- HU-CAP-090 Consultar y filtrar el historial de movimientos

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003.

**Fuera de alcance**

- Compras a proveedores: FT-COM-03.
- Pedidos internos de cocina y cierre del día: FT-ALM-03.
- Transferencias entre almacenes (horizonte futuro).

**Preguntas abiertas**

1. **¿Quién puede confirmar «Recibí» en un área?** Propuesta: cocina y barra de esa área y el administrador.

---

Generado por IA: BRD (NEC-CAP-016, 026, 050, 102; RN-CAP-014, 026, 046, 093, 114 a 118, 127), `analisis/flujo-cocina-y-almacen.md` y el mockup de Almacén — Revisado por: *(pendiente)*

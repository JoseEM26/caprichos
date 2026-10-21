---
id: HU-CAP-088
tipo: hu
titulo: "Registrar entradas, salidas, mermas y devoluciones"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-010, FT-ALM-01, RQ-ALM-01-01, RQ-ALM-01-02, RQ-ALM-01-03, RQ-ALM-01-09, HU-CAP-089, HU-CAP-090, ADR-001, ADR-011, ADR-014, ADR-003, DEP-02, DEP-06, R-01]
tags: [hu, almacen, capa-a, ft-alm-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-088 | Título | Registrar entradas, salidas, mermas y devoluciones |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-010 · FT-ALM-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-005** Almacén | registrar entradas, salidas, mermas y devoluciones | que cada cambio del almacén quede explicado |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-ALM-01 «Movimientos de almacén» (Debería tener, épica EP-CAP-010). Cubre los requerimientos: **RQ-ALM-01-01** Almacén registra entradas, salidas, mermas y devoluciones de insumos, con origen, cantidad y nota. **RQ-ALM-01-02** En salida, merma o devolución solo se ofrecen insumos con stock; en entrada, todos. **RQ-ALM-01-03** La cantidad solo admite números y no puede pasar del stock disponible. **RQ-ALM-01-09** Un movimiento no se edita ni se borra: se anula con un movimiento inverso y motivo. | **Alcance.**<br>• Almacén registra entradas, salidas, mermas y devoluciones de insumos, con origen, cantidad y nota.<br>• En salida, merma o devolución solo se ofrecen insumos con stock; en entrada, todos.<br>• La cantidad solo admite números y no puede pasar del stock disponible.<br>• Un movimiento no se edita ni se borra: se anula con un movimiento inverso y motivo. |
| **Problema.** Stock del almacén y de cada área que cuadra, con cada movimiento explicado. | **Fuera de alcance.**<br>• HU-CAP-089: Trasladar insumos a un área y confirmar lo recibido.<br>• HU-CAP-090: Consultar y filtrar el historial de movimientos.<br>• Compras a proveedores: FT-COM-03.<br>• Pedidos internos de cocina y cierre del día: FT-ALM-03.<br>• Transferencias entre almacenes (horizonte futuro). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | una entrada de 10 kg de harina | almacén la registra con Sí/No | el almacén sube 10 kg y queda el movimiento con autor y hora (RQ-ALM-01-01) |
| CA-2 | el azúcar en cero | almacén registra una salida | no aparece salvo que toque «Ver también sin stock» (RQ-ALM-01-02) |
| CA-3 | 5 kg de harina | almacén registra una salida de 6 kg | no se acepta y ve el máximo (RQ-ALM-01-03) |
| CA-4 | una entrada mal registrada | almacén la anula con motivo | se crea el movimiento inverso y ambos quedan en el historial (RQ-ALM-01-09) |
| CA-5 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |
| CA-6 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-ALM-01 (RQ-ALM-01-01, RQ-ALM-01-02, RQ-ALM-01-03, RQ-ALM-01-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-114) En salida, merma o devolución solo insumos con stock; en entrada, todos.<br>**RB-02** (RN-CAP-115) Movimientos divididos por pantalla; la cantidad no pasa del stock.<br>**RNF aplicables:** RNF-CAP-020, RNF-CAP-014, RNF-CAP-012, RNF-CAP-006. | `MovimientoStock` (entrada, salida, merma, devolución, producción, traslado) · `Traslado` (por recibir, recibido, diferencia) · `Produccion` (receta, tandas, hora, anulada) · `PedidoInterno` · `Merma` (producto, cantidad, origen, destino) · `CierreDia` (contado, botado, diferencia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014). |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Almacén ▸ movimientos, traslados por recibir, historial con filtros (`Admin.dc.html`); `analisis/flujo-cocina-y-almacen.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-ALM-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-ALM-01 (requerimientos RQ-ALM-01-01, RQ-ALM-01-02, RQ-ALM-01-03, RQ-ALM-01-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

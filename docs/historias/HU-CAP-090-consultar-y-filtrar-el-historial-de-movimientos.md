---
id: HU-CAP-090
tipo: hu
titulo: "Consultar y filtrar el historial de movimientos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-010, FT-ALM-01, RQ-ALM-01-06, RQ-ALM-01-07, RQ-ALM-01-08, HU-CAP-088, HU-CAP-089, ADR-001, ADR-011, ADR-014, ADR-003, DEP-02, DEP-06, R-01]
tags: [hu, almacen, capa-a, ft-alm-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-090 | Título | Consultar y filtrar el historial de movimientos |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-010 · FT-ALM-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-005** Almacén | consultar y filtrar el historial de movimientos | encontrar rápido cualquier movimiento pasado |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-ALM-01 «Movimientos de almacén» (Debería tener, épica EP-CAP-010). Cubre los requerimientos: **RQ-ALM-01-06** Una merma puede incluir varios insumos, cada uno con cantidad, origen y destino. **RQ-ALM-01-07** El historial se filtra por tipo, origen, insumo y fechas, con filtros plegables. **RQ-ALM-01-08** Los tipos de movimiento y orígenes se crean y desactivan desde el mismo módulo; por defecto entrada y salida. | **Alcance.**<br>• Una merma puede incluir varios insumos, cada uno con cantidad, origen y destino.<br>• El historial se filtra por tipo, origen, insumo y fechas, con filtros plegables.<br>• Los tipos de movimiento y orígenes se crean y desactivan desde el mismo módulo; por defecto entrada y salida. |
| **Problema.** Stock del almacén y de cada área que cuadra, con cada movimiento explicado. | **Fuera de alcance.**<br>• HU-CAP-088: Registrar entradas, salidas, mermas y devoluciones.<br>• HU-CAP-089: Trasladar insumos a un área y confirmar lo recibido.<br>• Compras a proveedores: FT-COM-03.<br>• Pedidos internos de cocina y cierre del día: FT-ALM-03.<br>• Transferencias entre almacenes (horizonte futuro). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | una merma de leche (1 L) y huevos (3 u) con destino «desecho» para ambos | se registra | queda un movimiento por insumo con el mismo destino (RQ-ALM-01-06) |
| CA-2 | movimientos de un mes | almacén filtra «Merma» de leche del 1 al 7 | solo ve esos (RQ-ALM-01-07) |
| CA-3 | el combo de origen | almacén crea «Proveedor B» | queda disponible al instante; no se puede eliminar, solo desactivar (RQ-ALM-01-08) |
| CA-4 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-ALM-01 (RQ-ALM-01-06, RQ-ALM-01-07, RQ-ALM-01-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-116) Merma de varios productos a la vez con origen y destino.<br>**RB-02** (RN-CAP-118) El historial se filtra por tipo, origen, insumo y fechas.<br>**RNF aplicables:** RNF-CAP-020, RNF-CAP-014, RNF-CAP-012, RNF-CAP-006. | `MovimientoStock` (entrada, salida, merma, devolución, producción, traslado) · `Traslado` (por recibir, recibido, diferencia) · `Produccion` (receta, tandas, hora, anulada) · `PedidoInterno` · `Merma` (producto, cantidad, origen, destino) · `CierreDia` (contado, botado, diferencia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014). |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-089** (Trasladar insumos a un área y confirmar lo recibido) va antes, dentro de la misma feature.<br>• FT-ALM-03.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Almacén ▸ movimientos, traslados por recibir, historial con filtros (`Admin.dc.html`); `analisis/flujo-cocina-y-almacen.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-ALM-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-ALM-01 (requerimientos RQ-ALM-01-06, RQ-ALM-01-07, RQ-ALM-01-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

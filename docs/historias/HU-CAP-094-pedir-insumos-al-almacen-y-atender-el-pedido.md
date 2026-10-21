---
id: HU-CAP-094
tipo: hu
titulo: "Pedir insumos al almacén y atender el pedido"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-010, FT-ALM-03, RQ-ALM-03-01, RQ-ALM-03-02, HU-CAP-095, HU-CAP-096, ADR-001, ADR-011, ADR-014, ADR-003, DEP-02, DEP-06, R-01]
tags: [hu, almacen, capa-a, ft-alm-03, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-094 | Título | Pedir insumos al almacén y atender el pedido |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-010 · FT-ALM-03 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-003** Cocina y barra | pedir insumos al almacén y atender el pedido | pedir insumos al almacén sin hacerlo de palabra |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-ALM-03 «Pedidos internos, mermas y cierre del día» (Debería tener, épica EP-CAP-010). Cubre los requerimientos: **RQ-ALM-03-01** Cocina o barra piden insumos al almacén con cantidades. **RQ-ALM-03-02** Almacén marca un pedido interno como entregado y se crea el traslado por recibir. | **Alcance.**<br>• Cocina o barra piden insumos al almacén con cantidades.<br>• Almacén marca un pedido interno como entregado y se crea el traslado por recibir. |
| **Problema.** Saber cuánto se pierde cada día y por qué, y que cocina tenga lo que necesita sin pedir de palabra. | **Fuera de alcance.**<br>• HU-CAP-095: Registrar la merma de productos de cocina.<br>• HU-CAP-096: Hacer el cierre del día con conteo y destino.<br>• Movimientos de insumos del almacén: FT-ALM-01.<br>• Producción: FT-ALM-02. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | la barra | pide 6 L de leche y 1 kg de café | almacén ve el pedido interno con el área, autor y hora (RQ-ALM-03-01) |
| CA-2 | un pedido interno | almacén lo marca entregado | baja el stock central y el área ve el traslado por recibir (FT-ALM-01) (RQ-ALM-03-02) |

Origen: criterios de verificación de FT-ALM-03 (RQ-ALM-03-01, RQ-ALM-03-02); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-056) Las mermas las registran almacén, producción o el administrador.<br>**RB-02** (RN-CAP-115) En Cocina solo se registra merma de productos de cocina con stock.<br>**RB-03** (RN-CAP-116) Merma de varios productos a la vez, con origen y destino.<br>**RNF aplicables:** RNF-CAP-020, RNF-CAP-019, RNF-CAP-009. | `MovimientoStock` (entrada, salida, merma, devolución, producción, traslado) · `Traslado` (por recibir, recibido, diferencia) · `Produccion` (receta, tandas, hora, anulada) · `PedidoInterno` · `Merma` (producto, cantidad, origen, destino) · `CierreDia` (contado, botado, diferencia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-ALM-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Cocina ▸ Pedir insumos, Merma, Cierre del día; Almacén ▸ Pedidos internos (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-ALM-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-ALM-03 (requerimientos RQ-ALM-03-01, RQ-ALM-03-02, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

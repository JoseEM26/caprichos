---
id: HU-CAP-093
tipo: hu
titulo: "Ver la vida útil de lo producido"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-010, FT-ALM-02, RQ-ALM-02-05, RQ-ALM-02-06, HU-CAP-091, HU-CAP-092, ADR-001, ADR-011, ADR-014, ADR-003, DEP-02, DEP-06, R-01]
tags: [hu, almacen, capa-a, ft-alm-02, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-093 | Título | Ver la vida útil de lo producido |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-010 · FT-ALM-02 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-003** Cocina y barra | ver la vida útil de lo producido | no vender productos pasados de su vida útil |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-ALM-02 «Producción por tanda» (Debería tener, épica EP-CAP-010). Cubre los requerimientos: **RQ-ALM-02-05** Cada tanda guarda su hora de producción para la vida útil. **RQ-ALM-02-06** La vida útil es configurable por producto. | **Alcance.**<br>• Cada tanda guarda su hora de producción para la vida útil.<br>• La vida útil es configurable por producto. |
| **Problema.** Que lo producido cada mañana entre al stock con su costo y que no se vendan productos pasados de su vida útil. | **Fuera de alcance.**<br>• HU-CAP-091: Registrar una tanda de producción.<br>• HU-CAP-092: Tomar materia prima de cocina y del almacén con confirmación.<br>• Cierre del día y conteo: FT-ALM-03.<br>• Recetas de producción: FT-STK-02. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | una tanda de donas a las 07:00 | son las 17:00 | las donas de esa tanda avisan «10 horas»; a las 19:00 pasan a alerta alta (RQ-ALM-02-05) |
| CA-2 | el pan de molde | el administrador fija 48 horas | sus avisos usan ese valor (RQ-ALM-02-06) |

Origen: criterios de verificación de FT-ALM-02 (RQ-ALM-02-05, RQ-ALM-02-06); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-040) Lo que sobra y no se conserva es merma; la vida útil es configurable por producto.<br>**RB-02** (RN-CAP-092) Las donas avisan a las 10 horas y alerta alta a las 12.<br>**RNF aplicables:** RNF-CAP-020, RNF-CAP-019, RNF-CAP-012. | `MovimientoStock` (entrada, salida, merma, devolución, producción, traslado) · `Traslado` (por recibir, recibido, diferencia) · `Produccion` (receta, tandas, hora, anulada) · `PedidoInterno` · `Merma` (producto, cantidad, origen, destino) · `CierreDia` (contado, botado, diferencia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)* |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-092** (Tomar materia prima de cocina y del almacén con confirmación) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Producción del día ▸ «Registrar la producción», vida útil (`Admin.dc.html`); `analisis/flujo-cocina-y-almacen.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-ALM-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-ALM-02 (requerimientos RQ-ALM-02-05, RQ-ALM-02-06, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

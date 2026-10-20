---
id: HU-CAP-049
tipo: hu
titulo: "Ver la TV de cocina de solo lectura"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-006, FT-COC-01, RQ-COC-01-09, HU-CAP-047, HU-CAP-048, HU-CAP-050, ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007, DEP-02, DEP-03, DEP-06, R-01]
tags: [hu, cocina, capa-a, ft-coc-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-049 | Título | Ver la TV de cocina de solo lectura |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-006 · FT-COC-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-003** Cocina y barra | ver la TV de cocina de solo lectura | ver los pedidos en grande desde cualquier lugar de la cocina |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-COC-01 «Pantallas de cocina por área» (Debe tener, épica EP-CAP-006). Cubre el requerimiento: **RQ-COC-01-09** La TV de cocina se vincula una vez con una llave propia, solo muestra comandas y el administrador la desactiva. | **Alcance.**<br>• La TV de cocina se vincula una vez con una llave propia, solo muestra comandas y el administrador la desactiva. |
| **Problema.** Cada área sabe qué preparar sin gritos ni papeles, y el tiempo de cada pedido se ve y se mide. Contribuye a OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-047: Ver en mi pantalla solo las comandas de mi área.<br>• HU-CAP-048: Avanzar y deshacer el estado de mi parte.<br>• HU-CAP-050: Crear áreas de cocina y asignarles categorías.<br>• Impresión de comandas y etiquetas: FT-COC-02.<br>• Agotado por hoy y Alta demanda: FT-COC-03.<br>• Mermas y cierre del día de cocina: FT-ALM-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | una TV vinculada | muestra las comandas | no aparecen teléfono ni dirección; cuando el administrador desactiva su llave, la TV deja de ver pedidos (RQ-COC-01-09) |
| CA-2 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-COC-01 (RQ-COC-01-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-023) La TV se vincula con una llave propia, solo ve pedidos de cocina y se puede desactivar.<br>**RNF aplicables:** RNF-CAP-002, RNF-CAP-004, RNF-CAP-006, RNF-CAP-003. | `AreaCocina` (nombre, activa, propia, máximo 4 propias) · `Categoria.area` · `ComandaArea` (pedido, área, estado, horas) · `Agotado` (producto, sabor u opción, alcance hoy o indefinido, autor) · `AltaDemanda` (minutos, pausa) · `Impresion` (tipo, área, estado, intentos) · `LlaveTV`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)* |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-048** (Avanzar y deshacer el estado de mi parte) va antes, dentro de la misma feature.<br>• DEP-03 equipos del local.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Cocina por área, vista general, TV de cocina (`Admin.dc.html`); `analisis/pantalla-cocina.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-COC-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-COC-01 (requerimientos RQ-COC-01-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

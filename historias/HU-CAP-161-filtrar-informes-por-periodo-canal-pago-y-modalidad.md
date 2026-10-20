---
id: HU-CAP-161
tipo: hu
titulo: "Filtrar informes por período, canal, pago y modalidad"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-018, FT-INF-01, RQ-INF-01-01, RQ-INF-01-02, RQ-INF-01-07, HU-CAP-162, HU-CAP-163, ADR-001, ADR-011, ADR-014, ADR-006, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, informes, capa-a, ft-inf-01, baja, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-161 | Título | Filtrar informes por período, canal, pago y modalidad |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-018 · FT-INF-01 | **Sprint / Release** | H3 · 22/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Baja | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | filtrar informes por período, canal, pago y modalidad | ver solo el período y el canal que me interesa |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-INF-01 «Informes con período y filtros» (Podría tener, épica EP-CAP-018). Cubre los requerimientos: **RQ-INF-01-01** Los informes se filtran por período predefinido o fechas «de… a…» con calendario. **RQ-INF-01-02** Se filtran además por canal, medio de pago y modalidad. **RQ-INF-01-07** Cada informe se exporta a CSV. | **Alcance.**<br>• Los informes se filtran por período predefinido o fechas «de… a…» con calendario.<br>• Se filtran además por canal, medio de pago y modalidad.<br>• Cada informe se exporta a CSV. |
| **Problema.** Decidir con datos: qué se vende, cuándo, cuánto se gana y dónde se pierde. | **Fuera de alcance.**<br>• HU-CAP-162: Ver ventas, tiempos y márgenes.<br>• HU-CAP-163: Exportar un informe.<br>• Indicadores del escritorio y mapa de entregas: FT-INF-02.<br>• Herramientas externas de BI (no pedido). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el informe de ventas | el administrador elige del 01/10 al 15/10 | todos los gráficos usan ese rango (RQ-INF-01-01) |
| CA-2 | el rango | filtra canal «Carta» y pago «Yape» | solo cuenta esos pedidos (RQ-INF-01-02) |
| CA-3 | un informe filtrado | toca «Exportar» | descarga un CSV con las filas del filtro (RQ-INF-01-07) |
| CA-4 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-INF-01 (RQ-INF-01-01, RQ-INF-01-02, RQ-INF-01-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-013) Solo el administrador ve ventas e indicadores del negocio.<br>**RNF aplicables:** RNF-CAP-017, RNF-CAP-006, RNF-CAP-011. | Vistas de lectura sobre `Pedido`, `Cobro`, `CierreCaja`, `MovimientoStock`, `CuponEmitido` y `Entrega` · `Notificacion` (tipo, rol destino, leída, enlace).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Informes (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-INF-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-INF-01 (requerimientos RQ-INF-01-01, RQ-INF-01-02, RQ-INF-01-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

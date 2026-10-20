---
id: HU-CAP-164
tipo: hu
titulo: "Ver mi escritorio e indicadores"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-018, FT-INF-02, RQ-INF-02-01, RQ-INF-02-02, RQ-INF-02-06, HU-CAP-165, ADR-001, ADR-011, ADR-014, ADR-006, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, informes, capa-a, ft-inf-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-164 | Título | Ver mi escritorio e indicadores |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-018 · FT-INF-02 | **Sprint / Release** | H3 · 22/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | ver mi escritorio e indicadores | saber cómo va el negocio apenas entro |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-INF-02 «Indicadores y mapa de entregas» (Podría tener, épica EP-CAP-018). Cubre los requerimientos: **RQ-INF-02-01** El escritorio del administrador muestra ventas, pedidos, ticket promedio y tiempo de entrega del día. **RQ-INF-02-02** Indicadores se filtran por período, año, fechas y canal. **RQ-INF-02-06** Las cifras del escritorio coinciden con Informes. | **Alcance.**<br>• El escritorio del administrador muestra ventas, pedidos, ticket promedio y tiempo de entrega del día.<br>• Indicadores se filtran por período, año, fechas y canal.<br>• Las cifras del escritorio coinciden con Informes. |
| **Problema.** Ver de un vistazo cómo va el negocio y dónde están los clientes. | **Fuera de alcance.**<br>• HU-CAP-165: Ver el mapa de entregas.<br>• Informes detallados: FT-INF-01.<br>• Seguimiento del repartidor en tiempo real (fuera de alcance). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el día | el administrador entra | ve las cuatro cifras con su comparación con el día anterior (RQ-INF-02-01) |
| CA-2 | el año 2026 | filtra canal «Chatbot» | los gráficos solo cuentan ese canal (RQ-INF-02-02) |
| CA-3 | el mismo día | se comparan | son iguales (RQ-INF-02-06) |
| CA-4 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-INF-02 (RQ-INF-02-01, RQ-INF-02-02, RQ-INF-02-06); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-013) Solo el administrador ve ventas e indicadores.<br>**RNF aplicables:** RNF-CAP-017, RNF-CAP-006, RNF-CAP-008. | Vistas de lectura sobre `Pedido`, `Cobro`, `CierreCaja`, `MovimientoStock`, `CuponEmitido` y `Entrega` · `Notificacion` (tipo, rol destino, leída, enlace).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-INF-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Escritorio del administrador, Indicadores, Mapa de entregas (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-INF-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-INF-02 (requerimientos RQ-INF-02-01, RQ-INF-02-02, RQ-INF-02-06, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

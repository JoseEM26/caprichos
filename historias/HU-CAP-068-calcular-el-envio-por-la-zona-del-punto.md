---
id: HU-CAP-068
tipo: hu
titulo: "Calcular el envío por la zona del punto"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-008, FT-DEL-01, RQ-DEL-01-01, RQ-DEL-01-08, HU-CAP-069, HU-CAP-070, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010, D-03, DEP-02, DEP-07, R-01, R-03]
tags: [hu, delivery, capa-a, ft-del-01, alta]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-068 | Título | Calcular el envío por la zona del punto |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-008 · FT-DEL-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | que el costo de envío se calcule solo según la zona de mi punto de entrega | pagar el envío correcto según dónde vivo |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-DEL-01 «Zonas de reparto y tarifas» (Debe tener, épica EP-CAP-008). Cubre los requerimientos: **RQ-DEL-01-01** El sistema detecta la zona por el punto de entrega y aplica su tarifa. **RQ-DEL-01-08** Fuera de cobertura no se registra delivery y se ofrece recojo. | **Alcance.**<br>• El sistema detecta la zona por el punto de entrega y aplica su tarifa.<br>• Fuera de cobertura no se registra delivery y se ofrece recojo. |
| **Problema.** Un envío cobrado igual en todos los canales, calculado solo con el punto, sin que el cliente tenga que conocer las zonas. | **Fuera de alcance.**<br>• HU-CAP-069: Editar, apagar y tarifar las zonas.<br>• HU-CAP-070: Asignar una tarifa especial de envío a un cliente.<br>• Cómo el cliente da su ubicación: FT-PED-02.<br>• Mapa de calor de entregas: FT-INF-02.<br>• Crear zonas nuevas (excluido por NEC-CAP-100). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un punto dentro de Z4 (S/ 5) | se calcula el envío desde cualquier canal | es S/ 5,00 (RQ-DEL-01-01) |
| CA-2 | un punto fuera de todas las zonas activas | se intenta guardar el delivery | se avisa y se ofrece «Para recoger»; el intento se registra para el mapa de entregas (RQ-DEL-01-08) |

Origen: criterios de verificación de FT-DEL-01 (RQ-DEL-01-01, RQ-DEL-01-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-103) La zona y su costo salen solos del punto; un punto fuera de cobertura no se guarda.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-006, RNF-CAP-009. | `ZonaReparto` (código, polígono de puntos, tarifa, activa) · `TarifaEspecialCliente` (fijo o porcentaje) · `AsignacionReparto` (pedido, repartidor, hora de toma, salida, entrega) · `IncidenteEntrega` (motivo, intento, hora) · `Coordinacion` (estado, cierre, recargo).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • DEP-07 (D-03).<br>• FT-INF-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-03, R-01 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-03 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-DEL-01 (requerimientos RQ-DEL-01-01, RQ-DEL-01-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

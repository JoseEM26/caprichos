---
id: HU-CAP-186
tipo: hu
titulo: "Recibir un aviso en el celular si algo se cae"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-04, RQ-PLA-04-01, RQ-PLA-04-02, RQ-PLA-04-03, HU-CAP-187, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, R-01]
tags: [hu, plataforma, capa-a, ft-pla-04, alta]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-186 | Título | Recibir un aviso en el celular si algo se cae |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-021 · FT-PLA-04 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD)** | recibir un aviso en el celular cuando la carta, la API, el bot, la impresión o la copia fallen | enterarme de una caída antes que el cliente |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PLA-04 «Vigilancia y alertas» (Debe tener, épica EP-CAP-021). Cubre los requerimientos: **RQ-PLA-04-01** Uptime Kuma revisa cada minuto la carta, la API, el WebSocket, el webhook de WhatsApp, el agente de impresión y la copia del día. **RQ-PLA-04-02** Una caída llega como aviso al celular y la recuperación también. **RQ-PLA-04-03** Uptime Kuma mide la disponibilidad mensual en horario de atención. | **Alcance.**<br>• Uptime Kuma revisa cada minuto la carta, la API, el WebSocket, el webhook de WhatsApp, el agente de impresión y la copia del día.<br>• Una caída llega como aviso al celular y la recuperación también.<br>• Uptime Kuma mide la disponibilidad mensual en horario de atención. |
| **Problema.** Enterarse de una caída antes que el cliente y saber qué falló. | **Fuera de alcance.**<br>• HU-CAP-187: Capturar errores y revisar registros.<br>• Paneles de métricas con historial (después del piloto, DT-46). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | los 6 monitores | se apaga la API en pruebas | su monitor pasa a rojo en el minuto siguiente (RQ-PLA-04-01) |
| CA-2 | la API caída | pasan 2 minutos | llega el aviso al celular configurado; al volver, llega «recuperado» con la duración (RQ-PLA-04-02) |
| CA-3 | el fin de mes | se revisa el reporte | se ve el porcentaje de disponibilidad de la carta y de la API (RQ-PLA-04-03) |

Origen: criterios de verificación de FT-PLA-04 (RQ-PLA-04-01, RQ-PLA-04-02, RQ-PLA-04-03); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-44) Uptime Kuma con avisos al celular.<br>**RNF aplicables:** RNF-CAP-003, RNF-CAP-008. | Sin tablas de negocio. Archivos de infraestructura: `infra/ansible` (inventario y roles), `infra/docker` (compose de referencia), `.github/workflows` (ci, deploy-staging, deploy-prod), servicios de Dokploy por ambiente, repositorio de copias de restic, monitores de Uptime Kuma y proyectos de GlitchTip (ver `operacion/INV-CAP-001`).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PLA-04 (requerimientos RQ-PLA-04-01, RQ-PLA-04-02, RQ-PLA-04-03, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

---
id: HU-CAP-187
tipo: hu
titulo: "Capturar errores y revisar registros"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-04, RQ-PLA-04-04, RQ-PLA-04-05, RQ-PLA-04-06, HU-CAP-186, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, R-01]
tags: [hu, plataforma, capa-a, ft-pla-04, alta]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-187 | Título | Capturar errores y revisar registros |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-021 · FT-PLA-04 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD)** | capturar los errores en GlitchTip y revisar los registros por número de pedido | saber qué falló sin exponer datos personales |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PLA-04 «Vigilancia y alertas» (Debe tener, épica EP-CAP-021). Cubre los requerimientos: **RQ-PLA-04-04** Los errores de la API, el front y el bot llegan a GlitchTip sin DNI, teléfonos, contraseñas ni tokens. **RQ-PLA-04-05** Los registros JSON llevan el número de solicitud y de pedido y se rotan para no llenar el disco. **RQ-PLA-04-06** Qué hacer cuando un servicio se cae está escrito en RB-CAP-003. | **Alcance.**<br>• Los errores de la API, el front y el bot llegan a GlitchTip sin DNI, teléfonos, contraseñas ni tokens.<br>• Los registros JSON llevan el número de solicitud y de pedido y se rotan para no llenar el disco.<br>• Qué hacer cuando un servicio se cae está escrito en RB-CAP-003. |
| **Problema.** Enterarse de una caída antes que el cliente y saber qué falló. | **Fuera de alcance.**<br>• HU-CAP-186: Recibir un aviso en el celular si algo se cae.<br>• Paneles de métricas con historial (después del piloto, DT-46). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un error al cobrar con el DNI 00000012 en la solicitud | se revisa en GlitchTip | el DNI aparece enmascarado y no hay tokens (RQ-PLA-04-04) |
| CA-2 | un día de hora punta | se revisa el disco | los registros de Docker no superan el tamaño configurado y se puede buscar por número de pedido (RQ-PLA-04-05) |
| CA-3 | la API caída | se sigue RB-CAP-003 | se identifica la causa con los registros y se vuelve a levantar o se vuelve a la versión anterior (RQ-PLA-04-06) |

Origen: criterios de verificación de FT-PLA-04 (RQ-PLA-04-04, RQ-PLA-04-05, RQ-PLA-04-06); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-45) GlitchTip en el VPS, sin datos personales.<br>**RB-02** (DT-46) Grafana, Loki y Prometheus después del piloto.<br>**RNF aplicables:** RNF-CAP-003, RNF-CAP-008. | Sin tablas de negocio. Archivos de infraestructura: `infra/ansible` (inventario y roles), `infra/docker` (compose de referencia), `.github/workflows` (ci, deploy-staging, deploy-prod), servicios de Dokploy por ambiente, repositorio de copias de restic, monitores de Uptime Kuma y proyectos de GlitchTip (ver `operacion/INV-CAP-001`).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-186** (Recibir un aviso en el celular si algo se cae) va antes, dentro de la misma feature.<br>• operacion/RB-CAP-003.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PLA-04 (requerimientos RQ-PLA-04-04, RQ-PLA-04-05, RQ-PLA-04-06, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

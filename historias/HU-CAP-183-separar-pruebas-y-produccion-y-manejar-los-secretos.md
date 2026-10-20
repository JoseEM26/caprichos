---
id: HU-CAP-183
tipo: hu
titulo: "Separar pruebas y producción y manejar los secretos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-02, RQ-PLA-02-05, RQ-PLA-02-06, RQ-PLA-02-09, HU-CAP-181, HU-CAP-182, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, R-01, R-11]
tags: [hu, plataforma, capa-a, ft-pla-02, alta]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-183 | Título | Separar pruebas y producción y manejar los secretos |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-021 · FT-PLA-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD)** | separar pruebas y producción y guardar los secretos fuera del repositorio | probar sin tocar clientes reales y no filtrar claves |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PLA-02 «Servidor, red, ambientes y secretos» (Debe tener, épica EP-CAP-021). Cubre los requerimientos: **RQ-PLA-02-05** Pruebas y producción corren aislados en el mismo VPS: base, Redis, WhatsApp de prueba, impresión a PDF y datos ficticios. **RQ-PLA-02-06** Los secretos viven en Dokploy y GitHub Secrets; el repositorio solo tiene `.env.example` y un hook que bloquea commits con claves. **RQ-PLA-02-09** El ambiente de pruebas se puede apagar fuera de horario sin afectar a producción. | **Alcance.**<br>• Pruebas y producción corren aislados en el mismo VPS: base, Redis, WhatsApp de prueba, impresión a PDF y datos ficticios.<br>• Los secretos viven en Dokploy y GitHub Secrets; el repositorio solo tiene `.env.example` y un hook que bloquea commits con claves.<br>• El ambiente de pruebas se puede apagar fuera de horario sin afectar a producción. |
| **Problema.** Poder rehacer el servidor completo en otro VPS en menos de una hora y que pruebas nunca toque a clientes reales. | **Fuera de alcance.**<br>• HU-CAP-181: Preparar el VPS desde cero con Ansible.<br>• HU-CAP-182: Poner el dominio detrás de Cloudflare con HTTPS y firewall.<br>• Copias: FT-PLA-03.<br>• Vigilancia: FT-PLA-04.<br>• Alta disponibilidad con dos servidores (riesgo aceptado, ADR-011). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido de prueba en `staging.` | pasa a cocina | no aparece en producción, el mensaje sale por el número de prueba de Meta y la comanda se genera como PDF (RQ-PLA-02-05) |
| CA-2 | un commit que incluye una clave de OpenAI | se intenta | el hook lo rechaza; y `git grep` en el repositorio no encuentra claves reales (RQ-PLA-02-06) |
| CA-3 | pruebas encendido | se apaga desde Dokploy a las 23:00 | producción sigue respondiendo y la RAM libre del VPS sube cerca de 1 GB (RQ-PLA-02-09) |

Origen: criterios de verificación de FT-PLA-02 (RQ-PLA-02-05, RQ-PLA-02-06, RQ-PLA-02-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-39) Tres ambientes; pruebas aislado.<br>**RB-02** (DT-43) Secretos fuera del repositorio.<br>**RNF aplicables:** RNF-CAP-003, RNF-CAP-006, RNF-CAP-008. | Sin tablas de negocio. Archivos de infraestructura: `infra/ansible` (inventario y roles), `infra/docker` (compose de referencia), `.github/workflows` (ci, deploy-staging, deploy-prod), servicios de Dokploy por ambiente, repositorio de copias de restic, monitores de Uptime Kuma y proyectos de GlitchTip (ver `operacion/INV-CAP-001`).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-182** (Poner el dominio detrás de Cloudflare con HTTPS y firewall) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-01, R-11 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PLA-02 (requerimientos RQ-PLA-02-05, RQ-PLA-02-06, RQ-PLA-02-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

---
id: HU-CAP-188
tipo: hu
titulo: "Mantener el sistema parchado y las dependencias al día"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-05, RQ-PLA-05-01, RQ-PLA-05-02, RQ-PLA-05-03, HU-CAP-189, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, R-01]
tags: [hu, plataforma, capa-a, ft-pla-05, alta]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-188 | Título | Mantener el sistema parchado y las dependencias al día |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-021 · FT-PLA-05 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD)** | mantener el servidor parchado y las dependencias e imágenes al día | que una librería vieja no abra una puerta a los datos de clientes |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PLA-05 «Seguridad y mantenimiento» (Debe tener, épica EP-CAP-021). Cubre los requerimientos: **RQ-PLA-05-01** El servidor instala solo los parches de seguridad del sistema operativo. **RQ-PLA-05-02** Renovate abre PRs para actualizar dependencias e imágenes, y pasan por el mismo CI. **RQ-PLA-05-03** Trivy bloquea publicar una imagen con vulnerabilidades críticas. | **Alcance.**<br>• El servidor instala solo los parches de seguridad del sistema operativo.<br>• Renovate abre PRs para actualizar dependencias e imágenes, y pasan por el mismo CI.<br>• Trivy bloquea publicar una imagen con vulnerabilidades críticas. |
| **Problema.** Que una librería vieja o una clave filtrada no se convierta en un incidente con datos de clientes. | **Fuera de alcance.**<br>• HU-CAP-189: Revisar la seguridad antes de salir y responder a una filtración.<br>• Pruebas de penetración contratadas a terceros (no previstas en el piloto). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un parche de seguridad publicado | pasa un día | está instalado y queda en el registro de unattended-upgrades (RQ-PLA-05-01) |
| CA-2 | una versión nueva de NestJS | Renovate la detecta | abre un PR que corre todas las pruebas antes de unirse (RQ-PLA-05-02) |
| CA-3 | una imagen con una vulnerabilidad crítica conocida | corre el CI | falla y la imagen no se sube a GHCR (RQ-PLA-05-03) |

Origen: criterios de verificación de FT-PLA-05 (RQ-PLA-05-01, RQ-PLA-05-02, RQ-PLA-05-03); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-47) Parches, Renovate, Trivy y prueba de restauración.<br>**RNF aplicables:** RNF-CAP-006, RNF-CAP-007, RNF-CAP-008. | Sin tablas de negocio. Archivos de infraestructura: `infra/ansible` (inventario y roles), `infra/docker` (compose de referencia), `.github/workflows` (ci, deploy-staging, deploy-prod), servicios de Dokploy por ambiente, repositorio de copias de restic, monitores de Uptime Kuma y proyectos de GlitchTip (ver `operacion/INV-CAP-001`).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-PLA-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PLA-05 (requerimientos RQ-PLA-05-01, RQ-PLA-05-02, RQ-PLA-05-03, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

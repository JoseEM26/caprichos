---
id: HU-CAP-181
tipo: hu
titulo: "Preparar el VPS desde cero con Ansible"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-02, RQ-PLA-02-01, RQ-PLA-02-07, RQ-PLA-02-08, HU-CAP-182, HU-CAP-183, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, R-01]
tags: [hu, plataforma, capa-a, ft-pla-02, alta]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-181 | Título | Preparar el VPS desde cero con Ansible |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-021 · FT-PLA-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD)** | preparar el VPS desde cero con un playbook de Ansible | rehacer el servidor completo en otro VPS sin depender de la memoria |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PLA-02 «Servidor, red, ambientes y secretos» (Debe tener, épica EP-CAP-021). Cubre los requerimientos: **RQ-PLA-02-01** Un playbook de Ansible deja un VPS nuevo listo (usuario, SSH con llave, zona horaria, UFW, fail2ban, parches, Docker, Dokploy) y se puede correr dos veces sin romper nada. **RQ-PLA-02-07** El inventario de infraestructura (servicios, dominios, cuentas, puertos y costos) está al día en INV-CAP-001. **RQ-PLA-02-08** El playbook y sus variables viven en el repositorio y RB-CAP-004 explica cómo correrlo en un VPS nuevo. | **Alcance.**<br>• Un playbook de Ansible deja un VPS nuevo listo (usuario, SSH con llave, zona horaria, UFW, fail2ban, parches, Docker, Dokploy) y se puede correr dos veces sin romper nada.<br>• El inventario de infraestructura (servicios, dominios, cuentas, puertos y costos) está al día en INV-CAP-001.<br>• El playbook y sus variables viven en el repositorio y RB-CAP-004 explica cómo correrlo en un VPS nuevo. |
| **Problema.** Poder rehacer el servidor completo en otro VPS en menos de una hora y que pruebas nunca toque a clientes reales. | **Fuera de alcance.**<br>• HU-CAP-182: Poner el dominio detrás de Cloudflare con HTTPS y firewall.<br>• HU-CAP-183: Separar pruebas y producción y manejar los secretos.<br>• Copias: FT-PLA-03.<br>• Vigilancia: FT-PLA-04.<br>• Alta disponibilidad con dos servidores (riesgo aceptado, ADR-011). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un VPS recién creado | se corre `ansible-playbook site.yml` dos veces seguidas | la segunda corrida no cambia nada y el servidor no acepta SSH con contraseña ni como root (RQ-PLA-02-01) |
| CA-2 | un servicio nuevo en Dokploy | se publica | aparece en INV-CAP-001 con su ambiente, puerto interno y responsable (RQ-PLA-02-07) |
| CA-3 | RB-CAP-004 | lo sigue otra persona en un VPS nuevo | deja el servidor listo sin preguntar nada fuera del documento (RQ-PLA-02-08) |

Origen: criterios de verificación de FT-PLA-02 (RQ-PLA-02-01, RQ-PLA-02-07, RQ-PLA-02-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-40) Preparación con Ansible.<br>**RNF aplicables:** RNF-CAP-003, RNF-CAP-006, RNF-CAP-008. | Sin tablas de negocio. Archivos de infraestructura: `infra/ansible` (inventario y roles), `infra/docker` (compose de referencia), `.github/workflows` (ci, deploy-staging, deploy-prod), servicios de Dokploy por ambiente, repositorio de copias de restic, monitores de Uptime Kuma y proyectos de GlitchTip (ver `operacion/INV-CAP-001`).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • operacion/RB-CAP-004.<br>• operacion/INV-CAP-001.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PLA-02 (requerimientos RQ-PLA-02-01, RQ-PLA-02-07, RQ-PLA-02-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

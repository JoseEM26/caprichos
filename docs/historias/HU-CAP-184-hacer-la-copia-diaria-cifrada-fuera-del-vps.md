---
id: HU-CAP-184
tipo: hu
titulo: "Hacer la copia diaria cifrada fuera del VPS"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-03, RQ-PLA-03-01, RQ-PLA-03-02, RQ-PLA-03-03, RQ-PLA-03-04, HU-CAP-185, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, R-01, R-11]
tags: [hu, plataforma, capa-a, ft-pla-03, alta]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-184 | Título | Hacer la copia diaria cifrada fuera del VPS |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-021 · FT-PLA-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD)** | una copia diaria cifrada de la base y las carpetas fuera del VPS | no perder pedidos, cobros ni fotos aunque falle el proveedor |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PLA-03 «Copias y recuperación» (Debe tener, épica EP-CAP-021). Cubre los requerimientos: **RQ-PLA-03-01** Cada día a las 03:00 se copia, cifrado, la base de cada ambiente y las carpetas de fotos y comprobantes a un almacenamiento fuera del VPS. **RQ-PLA-03-02** Se guardan 30 copias diarias y 6 mensuales y las más viejas se eliminan solas. **RQ-PLA-03-03** Si la copia falla o no corre, llega un aviso al celular. **RQ-PLA-03-04** La clave de restic y el acceso al almacenamiento de copias se guardan fuera del VPS. | **Alcance.**<br>• Cada día a las 03:00 se copia, cifrado, la base de cada ambiente y las carpetas de fotos y comprobantes a un almacenamiento fuera del VPS.<br>• Se guardan 30 copias diarias y 6 mensuales y las más viejas se eliminan solas.<br>• Si la copia falla o no corre, llega un aviso al celular.<br>• La clave de restic y el acceso al almacenamiento de copias se guardan fuera del VPS. |
| **Problema.** No perder pedidos, cobros ni fotos aunque falle el proveedor o se borre algo por error. | **Fuera de alcance.**<br>• HU-CAP-185: Restaurar una copia y probarlo cada 3 meses.<br>• Snapshot y Auto Backup del proveedor (se suman, no reemplazan).<br>• Copia de los registros de vigilancia. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el día 21 | son las 03:10 | el repositorio de restic tiene una copia nueva con la base de producción, la de pruebas y las dos carpetas, y su contenido no se puede leer sin la clave (RQ-PLA-03-01) |
| CA-2 | 40 copias diarias | corre la limpieza | quedan las 30 últimas diarias y una por mes de los últimos 6 meses (RQ-PLA-03-02) |
| CA-3 | un día en que el almacenamiento externo no responde | la copia falla | Uptime Kuma marca el monitor de la copia en rojo y envía el aviso antes de las 04:00 (RQ-PLA-03-03) |
| CA-4 | el VPS perdido por completo | hay que restaurar | la clave y el acceso están en el gestor de contraseñas del responsable y no solo en el servidor (RQ-PLA-03-04) |

Origen: criterios de verificación de FT-PLA-03 (RQ-PLA-03-01, RQ-PLA-03-02, RQ-PLA-03-03, RQ-PLA-03-04); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-31) Copia diaria fuera del VPS con 30 días de historial.<br>**RNF aplicables:** RNF-CAP-003, RNF-CAP-008, RNF-CAP-014. | Sin tablas de negocio. Archivos de infraestructura: `infra/ansible` (inventario y roles), `infra/docker` (compose de referencia), `.github/workflows` (ci, deploy-staging, deploy-prod), servicios de Dokploy por ambiente, repositorio de copias de restic, monitores de Uptime Kuma y proyectos de GlitchTip (ver `operacion/INV-CAP-001`).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-PLA-04.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-01, R-11 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PLA-03 (requerimientos RQ-PLA-03-01, RQ-PLA-03-02, RQ-PLA-03-03, RQ-PLA-03-04, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

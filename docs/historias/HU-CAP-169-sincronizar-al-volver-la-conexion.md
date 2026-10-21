---
id: HU-CAP-169
tipo: hu
titulo: "Sincronizar al volver la conexión"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-019, FT-OFF-01, RQ-OFF-01-04, RQ-OFF-01-05, HU-CAP-168, ADR-001, ADR-011, ADR-014, ADR-002, ADR-013, DEP-02, R-01]
tags: [hu, offline, capa-a, ft-off-01, alta]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-169 | Título | Sincronizar al volver la conexión |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-019 · FT-OFF-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | sincronizar al volver la conexión | no perder ningún pedido ni cobro hecho sin internet |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-OFF-01 «Operación local y sincronización» (Debe tener, épica EP-CAP-019). Cubre los requerimientos: **RQ-OFF-01-04** Al volver la conexión, todo se sincroniza en orden sin perder ni duplicar. **RQ-OFF-01-05** Los conflictos (la misma mesa en dos equipos) los resuelve el mini servidor como única autoridad y se avisan. | **Alcance.**<br>• Al volver la conexión, todo se sincroniza en orden sin perder ni duplicar.<br>• Los conflictos (la misma mesa en dos equipos) los resuelve el mini servidor como única autoridad y se avisan. |
| **Problema.** No parar de vender en el local por una caída de internet (R-06). | **Fuera de alcance.**<br>• HU-CAP-168: Seguir operando sin internet.<br>• Pedidos de la web y del chatbot sin internet (no llegan; riesgo aceptado).<br>• Información al delivery sin internet.<br>• Todo lo que no sea caja, mozo y cocina. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | 20 pedidos sin internet | vuelve la conexión | los 20 llegan al sistema en línea en orden, sin duplicados (RQ-OFF-01-04) |
| CA-2 | la mesa 3 pedida desde la tablet y desde caja sin conexión al sistema en línea | se sincroniza | queda un solo pedido y se avisa a caja (RQ-OFF-01-05) |

Origen: criterios de verificación de FT-OFF-01 (RQ-OFF-01-04, RQ-OFF-01-05); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-050) Sin internet, la caja sigue con una base local y todo se sincroniza en orden.<br>**RNF aplicables:** RNF-CAP-018, RNF-CAP-010. | `ColaSincronizacion` (registro local, orden, estado) · copia local de `Pedido`, `Cobro`, `ComandaArea` y `Mesa`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-168** (Seguir operando sin internet) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-002, ADR-013. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-OFF-01 (requerimientos RQ-OFF-01-04, RQ-OFF-01-05, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

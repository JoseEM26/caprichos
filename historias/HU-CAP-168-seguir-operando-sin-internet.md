---
id: HU-CAP-168
tipo: hu
titulo: "Seguir operando sin internet"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-019, FT-OFF-01, RQ-OFF-01-01, RQ-OFF-01-02, RQ-OFF-01-05, HU-CAP-169, ADR-001, ADR-011, ADR-014, ADR-002, ADR-013, D-11, DEP-02, DEP-03, DEP-06, R-01, R-06]
tags: [hu, offline, capa-a, ft-off-01, fuera-de-esta-version-dt-12, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-168 | Título | Seguir operando sin internet |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-019 · FT-OFF-01 | **Sprint / Release** | Fase aparte, con cotización propia (DT-12, D-11) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Fuera de esta versión (DT-12) | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | seguir operando sin internet | seguir vendiendo cuando se cae internet |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-OFF-01 «Operación local y sincronización» (No esta vez, épica EP-CAP-019). Cubre los requerimientos: **RQ-OFF-01-01** Sin internet, caja, mozos y cocina siguen tomando pedidos, cobrando y viendo comandas por la red del local. **RQ-OFF-01-02** Todo se guarda en la base local de la computadora de caja. **RQ-OFF-01-05** El sistema muestra claramente cuándo se trabaja sin internet. | **Alcance.**<br>• Sin internet, caja, mozos y cocina siguen tomando pedidos, cobrando y viendo comandas por la red del local.<br>• Todo se guarda en la base local de la computadora de caja.<br>• El sistema muestra claramente cuándo se trabaja sin internet. |
| **Problema.** No perder ventas en hora punta por una caída de internet (R-06). | **Fuera de alcance.**<br>• HU-CAP-169: Sincronizar al volver la conexión.<br>• Pedidos de la web y del chatbot sin internet (no llegan).<br>• Todo lo que no sea caja, mozos y cocina. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | internet cortado | el mozo envía un pedido | llega a la pantalla de cocina por la red local y se imprime (RQ-OFF-01-01) |
| CA-2 | un cobro sin internet | se registra | queda en la base local con su hora (RQ-OFF-01-02) |
| CA-3 | internet cortado | cualquier usuario mira la cabecera | ve «Sin internet · los pedidos web no llegan» (RQ-OFF-01-05) |

Origen: criterios de verificación de FT-OFF-01 (RQ-OFF-01-01, RQ-OFF-01-02, RQ-OFF-01-05); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-050) Sin internet, la caja sigue con una base local y todo se sincroniza en orden.<br>**RNF aplicables:** RNF-CAP-018. | `ColaSincronizacion` (registro local, orden, estado) · copia local de `Pedido`, `Cobro`, `ComandaArea` y `Mesa`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)* |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • D-11 · DEP-03 equipos.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-06, R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Propuesta en el prototipo (sección Modo sin internet).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-OFF-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-002, ADR-013.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-11 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-OFF-01 (requerimientos RQ-OFF-01-01, RQ-OFF-01-02, RQ-OFF-01-05, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

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
relacionados: [EP-CAP-019, FT-OFF-01, RQ-OFF-01-01, RQ-OFF-01-02, RQ-OFF-01-03, RQ-OFF-01-06, RQ-OFF-01-07, HU-CAP-169, ADR-001, ADR-011, ADR-014, ADR-002, ADR-013, DEP-02, DEP-06, R-01, R-06]
tags: [hu, offline, capa-a, ft-off-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-168 | Título | Seguir operando sin internet |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-019 · FT-OFF-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | seguir operando sin internet | seguir vendiendo cuando se cae internet |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-OFF-01 «Operación local y sincronización» (Debe tener, épica EP-CAP-019). Cubre los requerimientos: **RQ-OFF-01-01** Sin internet, caja, mozo y cocina siguen tomando pedidos, cobrando y viendo comandas por la red del local, con un mini servidor en la PC de caja. **RQ-OFF-01-02** Todo se guarda en la base local de la PC de caja. **RQ-OFF-01-03** El mini servidor arranca solo con la PC de caja y la red del local alcanza sin internet para la tablet, la caja y cocina. **RQ-OFF-01-06** El sistema muestra claramente cuándo se trabaja sin internet y que los pedidos de la carta y de WhatsApp no llegan. **RQ-OFF-01-07** Sin internet no se edita la carta, las ofertas ni los usuarios. | **Alcance.**<br>• Sin internet, caja, mozo y cocina siguen tomando pedidos, cobrando y viendo comandas por la red del local, con un mini servidor en la PC de caja.<br>• Todo se guarda en la base local de la PC de caja.<br>• El mini servidor arranca solo con la PC de caja y la red del local alcanza sin internet para la tablet, la caja y cocina.<br>• El sistema muestra claramente cuándo se trabaja sin internet y que los pedidos de la carta y de WhatsApp no llegan.<br>• Sin internet no se edita la carta, las ofertas ni los usuarios. |
| **Problema.** No parar de vender en el local por una caída de internet (R-06). | **Fuera de alcance.**<br>• HU-CAP-169: Sincronizar al volver la conexión.<br>• Pedidos de la web y del chatbot sin internet (no llegan; riesgo aceptado).<br>• Información al delivery sin internet.<br>• Todo lo que no sea caja, mozo y cocina. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | internet cortado | el mozo envía un pedido desde su tablet | llega a la pantalla de cocina por la red local y la caja lo ve (RQ-OFF-01-01) |
| CA-2 | un cobro sin internet | se registra | queda en la base local con su hora y su número de orden (RQ-OFF-01-02) |
| CA-3 | la PC de caja recién encendida y el router sin internet | la tablet abre el administrativo | carga desde el mini servidor sin pedir internet (RQ-OFF-01-03) |
| CA-4 | internet cortado | cualquier usuario mira la cabecera | ve «Sin internet · los pedidos web no llegan», y la carta muestra que no recibe pedidos (RQ-OFF-01-06) |
| CA-5 | internet cortado | el administrador intenta cambiar un precio | ve «Esto se puede hacer cuando vuelva el internet» (RQ-OFF-01-07) |

Origen: criterios de verificación de FT-OFF-01 (RQ-OFF-01-01, RQ-OFF-01-02, RQ-OFF-01-03, RQ-OFF-01-06, RQ-OFF-01-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-050) Sin internet, la caja sigue con una base local y todo se sincroniza en orden.<br>**RB-02** (DT-52) Mini servidor en la caja; sin router 4G; riesgo aceptado; segunda meta.<br>**RB-03** (DT-29) PWA más agente local en la PC de caja; no es una aplicación de escritorio aparte.<br>**RNF aplicables:** RNF-CAP-018, RNF-CAP-010. | `ColaSincronizacion` (registro local, orden, estado) · copia local de `Pedido`, `Cobro`, `ComandaArea` y `Mesa`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • DT-52.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-06, R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Propuesta en el prototipo (sección Modo sin internet).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-OFF-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-002, ADR-013.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-OFF-01 (requerimientos RQ-OFF-01-01, RQ-OFF-01-02, RQ-OFF-01-03, RQ-OFF-01-06, RQ-OFF-01-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

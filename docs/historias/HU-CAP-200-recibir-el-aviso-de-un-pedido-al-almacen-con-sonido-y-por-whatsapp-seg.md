---
id: HU-CAP-200
tipo: hu
titulo: "Recibir el aviso de un pedido al almacén con sonido y por WhatsApp según el turno"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-010, FT-ALM-03, RQ-ALM-03-02, RQ-ALM-03-03, HU-CAP-094, HU-CAP-095, HU-CAP-096, ADR-001, ADR-011, ADR-014, ADR-003, D-30, DEP-02, DEP-06, DEP-12, R-01]
tags: [hu, almacen, capa-a, ft-alm-03, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-200 | Título | Recibir el aviso de un pedido al almacén con sonido y por WhatsApp según el turno |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-010 · FT-ALM-03 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-005** Almacén | recibir el aviso de un pedido al almacén con sonido hasta marcar «Recibido» y por WhatsApp cuando estoy de turno | enterarme de lo que pide cocina aunque no esté frente a la pantalla, también cuando cubro un descanso |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-ALM-03 «Pedidos internos, mermas y cierre del día» (Debería tener, épica EP-CAP-010). Cubre los requerimientos: **RQ-ALM-03-02** Un pedido interno suena en la pantalla del almacén hasta que alguien marca «Recibido». **RQ-ALM-03-03** El pedido interno llega por WhatsApp a la persona de almacén de turno según su horario, y al administrador si nadie está de turno. | **Alcance.**<br>• Un pedido interno suena en la pantalla del almacén hasta que alguien marca «Recibido».<br>• El pedido interno llega por WhatsApp a la persona de almacén de turno según su horario, y al administrador si nadie está de turno. |
| **Problema.** Saber cuánto se pierde cada día y por qué, y que cocina tenga lo que necesita sin pedir de palabra. | **Fuera de alcance.**<br>• HU-CAP-094: Pedir insumos al almacén y atender el pedido.<br>• HU-CAP-095: Registrar la merma de productos de cocina.<br>• HU-CAP-096: Hacer el cierre del día con conteo y destino.<br>• Movimientos de insumos del almacén: FT-ALM-01.<br>• Producción: FT-ALM-02. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | la pantalla del almacén abierta | barra pide 6 L de leche | suena un aviso que se repite y no se calla hasta que alguien toca «Recibido»; queda quién lo recibió y a qué hora (RQ-ALM-03-02) |
| CA-2 | Marvel de turno de lunes a miércoles y Jeffrey cubriendo el jueves | cocina pide harina un jueves a las 16:00 | el WhatsApp le llega a Jeffrey; a las 07:00, sin nadie de almacén de turno, le llega al administrador (RQ-ALM-03-03) |

Origen: criterios de verificación de FT-ALM-03 (RQ-ALM-03-02, RQ-ALM-03-03); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-64) Aviso del almacén con sonido hasta «Recibido» y por WhatsApp a quien está de turno; salidas con usuario propio.<br>**RNF aplicables:** RNF-CAP-020, RNF-CAP-019, RNF-CAP-009. | `MovimientoStock` (entrada, salida, merma, devolución, producción, traslado) · `Traslado` (por recibir, recibido, diferencia) · `Produccion` (receta, tandas, hora, anulada) · `PedidoInterno` · `Merma` (producto, cantidad, origen, destino) · `CierreDia` (contado, botado, diferencia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-096** (Hacer el cierre del día con conteo y destino) va antes, dentro de la misma feature.<br>• FT-USR-01 · DEP-12.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Cocina ▸ Pedir insumos, Merma, Cierre del día; Almacén ▸ Pedidos internos con aviso sonoro (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-ALM-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-30 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-ALM-03 (requerimientos RQ-ALM-03-02, RQ-ALM-03-03, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

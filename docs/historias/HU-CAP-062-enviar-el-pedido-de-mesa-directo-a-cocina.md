---
id: HU-CAP-062
tipo: hu
titulo: "Enviar el pedido de mesa directo a cocina"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-007, FT-SAL-02, RQ-SAL-02-03, RQ-SAL-02-04, HU-CAP-061, HU-CAP-063, HU-CAP-064, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, DEP-02, DEP-06, R-01]
tags: [hu, salon, capa-a, ft-sal-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-062 | Título | Enviar el pedido de mesa directo a cocina |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-007 · FT-SAL-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-004** Mozos | enviar el pedido de mesa directo a cocina | que cocina empiece apenas tomo el pedido |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-SAL-02 «Pedido del mozo y control de mesas» (Debe tener, épica EP-CAP-007). Cubre los requerimientos: **RQ-SAL-02-03** El pedido del mozo usa el mismo catálogo y reglas que la carta, con o sin imágenes. **RQ-SAL-02-04** El pedido del mozo va directo a cocina y se imprimen su comanda y etiquetas. | **Alcance.**<br>• El pedido del mozo usa el mismo catálogo y reglas que la carta, con o sin imágenes.<br>• El pedido del mozo va directo a cocina y se imprimen su comanda y etiquetas. |
| **Problema.** Pedidos de salón que llegan a cocina al instante y sin mezclar mesas. Contribuye a OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-061: Elegir la mesa y armar el pedido de mesa.<br>• HU-CAP-063: Agregar consumos a una mesa ocupada e imprimir la precuenta.<br>• HU-CAP-064: Recibir aviso de listo, entregar en mesa y liberar.<br>• Dibujar el plano: FT-SAL-01.<br>• Reservas: FT-SAL-03.<br>• El cobro: FT-CAJ-02.<br>• Dividir la cuenta de una mesa entre varias personas (no pedido en el BRD). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un producto con grupo obligatorio | el mozo lo agrega sin elegir | no puede; puede alternar la vista con o sin imágenes (RQ-SAL-02-03) |
| CA-2 | un pedido de mesa | el mozo lo envía con Sí/No | aparece en las pantallas de sus áreas y no en «Por confirmar» (RQ-SAL-02-04) |
| CA-3 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-SAL-02 (RQ-SAL-02-03, RQ-SAL-02-04); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-027) Mismo catálogo y reglas que la carta; varios productos.<br>**RB-02** (RN-CAP-073) El pedido del mozo en el local va directo a cocina.<br>**RNF aplicables:** RNF-CAP-010, RNF-CAP-002, RNF-CAP-004, RNF-CAP-005. | `Piso` (activo) · `ElementoPlano` (tipo, x, y, ancho, alto, giro) · `Mesa` (número, asientos, activa) · `PedidoMesa` (pedido ↔ varias mesas) · `Reserva` (nombre, teléfono, personas, hora, mesas, estado, tolerancia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-061** (Elegir la mesa y armar el pedido de mesa) va antes, dentro de la misma feature.<br>• FT-CAR-01.<br>• FT-COC-01 · FT-COC-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Nuevo pedido (mozo), Mesas, precuenta (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-SAL-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-SAL-02 (requerimientos RQ-SAL-02-03, RQ-SAL-02-04, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

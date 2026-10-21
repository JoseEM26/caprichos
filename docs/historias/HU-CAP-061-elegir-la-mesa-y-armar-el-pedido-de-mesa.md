---
id: HU-CAP-061
tipo: hu
titulo: "Elegir la mesa y armar el pedido de mesa"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-007, FT-SAL-02, RQ-SAL-02-01, RQ-SAL-02-02, RQ-SAL-02-06, RQ-SAL-02-08, HU-CAP-062, HU-CAP-063, HU-CAP-064, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, DEP-02, DEP-06, R-01, R-09]
tags: [hu, salon, capa-a, ft-sal-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-061 | Título | Elegir la mesa y armar el pedido de mesa |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-007 · FT-SAL-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-004** Mozos | elegir la mesa y armar el pedido de mesa | tomar el pedido de la mesa correcta sin equivocarme |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-SAL-02 «Pedido del mozo y control de mesas» (Debe tener, épica EP-CAP-007). Cubre los requerimientos: **RQ-SAL-02-01** El mozo elige la mesa con botones de mesas libres o en el plano, y la mesa queda visible con opción de cambiarla. **RQ-SAL-02-02** Una mesa ocupada no se puede abrir otra vez, aunque dos personas lo intenten a la vez. **RQ-SAL-02-06** Un pedido puede ocupar varias mesas juntas, que se muestran y liberan juntas. **RQ-SAL-02-08** «Para llevar» no usa mesa. | **Alcance.**<br>• El mozo elige la mesa con botones de mesas libres o en el plano, y la mesa queda visible con opción de cambiarla.<br>• Una mesa ocupada no se puede abrir otra vez, aunque dos personas lo intenten a la vez.<br>• Un pedido puede ocupar varias mesas juntas, que se muestran y liberan juntas.<br>• «Para llevar» no usa mesa. |
| **Problema.** Pedidos de salón que llegan a cocina al instante y sin mezclar mesas. Contribuye a OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-062: Enviar el pedido de mesa directo a cocina.<br>• HU-CAP-063: Agregar consumos a una mesa ocupada e imprimir la precuenta.<br>• HU-CAP-064: Recibir aviso de listo, entregar en mesa y liberar.<br>• Dibujar el plano: FT-SAL-01.<br>• Reservas: FT-SAL-03.<br>• El cobro: FT-CAJ-02.<br>• Dividir la cuenta de una mesa entre varias personas (no pedido en el BRD). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el pedido de mesa | el mozo abre Nuevo pedido | se le pregunta la mesa con las libres como botones y un acceso al plano; la mesa elegida se ve arriba con «Cambiar» (RQ-SAL-02-01) |
| CA-2 | dos mozos que eligen la mesa 3 al mismo tiempo | envían | solo uno abre el pedido y el otro ve «La mesa 3 ya está ocupada» (RQ-SAL-02-02) |
| CA-3 | un grupo de 8 | el mozo elige las mesas 4 y 5 | ambas quedan ocupadas por el mismo pedido y se liberan juntas al cobrar (RQ-SAL-02-06) |
| CA-4 | un pedido para llevar del mozo | lo arma | no se le pide mesa (RQ-SAL-02-08) |

Origen: criterios de verificación de FT-SAL-02 (RQ-SAL-02-01, RQ-SAL-02-02, RQ-SAL-02-06, RQ-SAL-02-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-025) El mozo solo abre pedido en mesas libres.<br>**RB-02** (RN-CAP-108) Un pedido puede ocupar varias mesas juntas, que se liberan juntas.<br>**RNF aplicables:** RNF-CAP-010, RNF-CAP-002, RNF-CAP-004, RNF-CAP-005. | `Piso` (activo) · `ElementoPlano` (tipo, x, y, ancho, alto, giro) · `Mesa` (número, asientos, activa) · `PedidoMesa` (pedido ↔ varias mesas) · `Reserva` (nombre, teléfono, personas, hora, mesas, estado, tolerancia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-SAL-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01, R-09 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Nuevo pedido (mozo), Mesas, precuenta (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-SAL-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-SAL-02 (requerimientos RQ-SAL-02-01, RQ-SAL-02-02, RQ-SAL-02-06, RQ-SAL-02-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

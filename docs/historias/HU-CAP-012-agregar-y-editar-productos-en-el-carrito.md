---
id: HU-CAP-012
tipo: hu
titulo: "Agregar y editar productos en el carrito"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-002, FT-PED-01, RQ-PED-01-01, RQ-PED-01-02, RQ-PED-01-03, HU-CAP-013, HU-CAP-014, HU-CAP-015, ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010, DEP-02, DEP-06, R-01]
tags: [hu, pedido, capa-a, ft-ped-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-012 | Título | Agregar y editar productos en el carrito |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-002 · FT-PED-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | agregar y editar productos en el carrito | reunir todo lo que quiero pedir y corregirlo antes de enviarlo |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PED-01 «Carrito, modalidad y datos mínimos» (Debe tener, épica EP-CAP-002). Cubre los requerimientos: **RQ-PED-01-01** El carrito guarda varios productos, cada uno con sus opciones, nota y cantidad. **RQ-PED-01-02** El cliente edita la cantidad, edita las opciones o quita un producto del carrito. **RQ-PED-01-03** La modalidad (delivery o para recoger) se elige en el carrito, no en la cabecera. | **Alcance.**<br>• El carrito guarda varios productos, cada uno con sus opciones, nota y cantidad.<br>• El cliente edita la cantidad, edita las opciones o quita un producto del carrito.<br>• La modalidad (delivery o para recoger) se elige en el carrito, no en la cabecera. |
| **Problema.** Menos pasos para pedir y pedidos completos en caja. Contribuye a NEC-CAP-001 y a OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-013: Dar mis datos mínimos al final.<br>• HU-CAP-014: Elegir cómo pagar sin pagar en la web.<br>• HU-CAP-015: Ver el resumen con descuentos, cupón y comprobante.<br>• Ubicación y costo de envío: FT-PED-02.<br>• Envío a caja y mensaje de WhatsApp: FT-PED-03.<br>• Cuenta del cliente y puntos: FT-CLI-01 y FT-CLI-02.<br>• Pago en línea con pasarela (DT-11).<br>• Pedidos programados para otro día (A1). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | dos productos con opciones distintas | el cliente los agrega | el carrito los muestra por separado con sus opciones, nota y subtotal (RQ-PED-01-01) |
| CA-2 | un producto en el carrito | el cliente cambia la cantidad a 3 | el subtotal y el total se recalculan; al quitarlo con Sí/No desaparece (RQ-PED-01-02) |
| CA-3 | el carrito | el cliente va a confirmar | elige entre «Delivery» y «Para recoger»; no aparece «En el local» (RQ-PED-01-03) |
| CA-4 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |
| CA-5 | un celular de 360 px de ancho | el cliente abre la pantalla de esta historia | todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) |

Origen: criterios de verificación de FT-PED-01 (RQ-PED-01-01, RQ-PED-01-02, RQ-PED-01-03); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-016) La modalidad se elige en el carrito; el cliente no puede pedir «en el local».<br>**RNF aplicables:** RNF-CAP-004, RNF-CAP-005, RNF-CAP-011, RNF-CAP-008. | `Pedido` (código único, canal, modalidad, estado «por confirmar», total) · `LineaPedido` (producto, tamaño, opciones, nota, cantidad, precio) · `ClienteContacto` (nombre, teléfono, aceptación) · `Entrega` (latitud, longitud, enlace, dirección, referencia, zona, envío) · `PagoPreferido` (medio, monto con que paga).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** montos en soles con dos decimales; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ carrito, modalidad, datos del cliente, medio de pago y resumen (`Main.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-PED-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PED-01 (requerimientos RQ-PED-01-01, RQ-PED-01-02, RQ-PED-01-03, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

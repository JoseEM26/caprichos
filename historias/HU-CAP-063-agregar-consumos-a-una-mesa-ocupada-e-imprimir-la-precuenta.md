---
id: HU-CAP-063
tipo: hu
titulo: "Agregar consumos a una mesa ocupada e imprimir la precuenta"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-007, FT-SAL-02, RQ-SAL-02-05, RQ-SAL-02-08, HU-CAP-061, HU-CAP-062, HU-CAP-064, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, DEP-02, DEP-06, R-01]
tags: [hu, salon, capa-a, ft-sal-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-063 | Título | Agregar consumos a una mesa ocupada e imprimir la precuenta |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-007 · FT-SAL-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-004** Mozos | agregar consumos a una mesa ocupada e imprimir la precuenta | sumar lo que pide la mesa después y darle su precuenta |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-SAL-02 «Pedido del mozo y control de mesas» (Debe tener, épica EP-CAP-007). Cubre los requerimientos: **RQ-SAL-02-05** A una mesa ocupada se le agregan consumos como comanda adicional. **RQ-SAL-02-08** El mozo imprime la precuenta de una mesa. | **Alcance.**<br>• A una mesa ocupada se le agregan consumos como comanda adicional.<br>• El mozo imprime la precuenta de una mesa. |
| **Problema.** Pedidos de salón que llegan a cocina al instante y sin mezclar mesas. Contribuye a OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-061: Elegir la mesa y armar el pedido de mesa.<br>• HU-CAP-062: Enviar el pedido de mesa directo a cocina.<br>• HU-CAP-064: Recibir aviso de listo, entregar en mesa y liberar.<br>• Dibujar el plano: FT-SAL-01.<br>• Reservas: FT-SAL-03.<br>• El cobro: FT-CAJ-02.<br>• Dividir la cuenta de una mesa entre varias personas (no pedido en el BRD). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | la mesa 3 ocupada | el mozo agrega dos cafés | cocina recibe una comanda adicional marcada «Adicional · Mesa 3» y la cuenta suma los cafés (RQ-SAL-02-05) |
| CA-2 | la mesa 3 con consumos | el mozo toca «Precuenta» | se imprime el detalle y el total, sin ser comprobante (RQ-SAL-02-08) |

Origen: criterios de verificación de FT-SAL-02 (RQ-SAL-02-05, RQ-SAL-02-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-030) El mozo no cobra: saca la precuenta.<br>**RB-02** (RN-CAP-090) Una mesa ocupada recibe consumos como comanda adicional.<br>**RNF aplicables:** RNF-CAP-010, RNF-CAP-002, RNF-CAP-004, RNF-CAP-005. | `Piso` (activo) · `ElementoPlano` (tipo, x, y, ancho, alto, giro) · `Mesa` (número, asientos, activa) · `PedidoMesa` (pedido ↔ varias mesas) · `Reserva` (nombre, teléfono, personas, hora, mesas, estado, tolerancia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-062** (Enviar el pedido de mesa directo a cocina) va antes, dentro de la misma feature.<br>• FT-COC-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Nuevo pedido (mozo), Mesas, precuenta (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-SAL-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-SAL-02 (requerimientos RQ-SAL-02-05, RQ-SAL-02-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

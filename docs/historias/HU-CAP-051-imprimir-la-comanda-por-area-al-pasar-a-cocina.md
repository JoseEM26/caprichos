---
id: HU-CAP-051
tipo: hu
titulo: "Imprimir la comanda por área al pasar a cocina"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-006, FT-COC-02, RQ-COC-02-01, RQ-COC-02-02, RQ-COC-02-10, HU-CAP-052, HU-CAP-053, HU-CAP-054, ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007, D-13, DEP-02, DEP-03, DEP-06, R-01, R-08]
tags: [hu, cocina, capa-a, ft-coc-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-051 | Título | Imprimir la comanda por área al pasar a cocina |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-006 · FT-COC-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-003** Cocina y barra | imprimir la comanda por área al pasar a cocina | tener la comanda en papel de mi área sin que nadie la escriba |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-COC-02 «Impresión de comandas y etiquetas» (Debe tener, épica EP-CAP-006). Cubre los requerimientos: **RQ-COC-02-01** Al pasar a cocina se imprime la comanda en la ticketera de cada área con solo lo suyo. **RQ-COC-02-02** Un pedido rechazado o que aún no pasa a cocina no se imprime; los de la carta se imprimen al enviarse. **RQ-COC-02-10** Las áreas propias no tienen etiqueta de impresión propia. | **Alcance.**<br>• Al pasar a cocina se imprime la comanda en la ticketera de cada área con solo lo suyo.<br>• Un pedido rechazado o que aún no pasa a cocina no se imprime; los de la carta se imprimen al enviarse.<br>• Las áreas propias no tienen etiqueta de impresión propia. |
| **Problema.** Comandas y etiquetas sin escribir a mano, que reducen errores de preparación y de despacho. | **Fuera de alcance.**<br>• HU-CAP-052: Imprimir las etiquetas general, por área y por bebida.<br>• HU-CAP-053: Activar o desactivar tipos de etiqueta.<br>• HU-CAP-054: Recibir la alerta de fallo y reimprimir.<br>• Pantallas de cocina: FT-COC-01.<br>• Comprobante y cupones impresos: FT-LEG-01 y FT-OFE-03.<br>• Elección técnica de la conexión: ADR-002 (Bloque 4). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido con bebida y salado | pasa a cocina | la ticketera de barra imprime la bebida y la de cocina el salado, cada una con ticket, hora, mozo o canal y notas (RQ-COC-02-01) |
| CA-2 | un pedido del chatbot todavía por confirmar | se revisan las ticketeras | no se imprimió nada; un pedido de la carta se imprime apenas el cliente lo envía (RQ-COC-02-02) |
| CA-3 | el área propia «Parrilla» | un pedido le llega | su parte se imprime en la ticketera de cocina asignada, sin etiquetera propia (RQ-COC-02-10) |

Origen: criterios de verificación de FT-COC-02 (RQ-COC-02-01, RQ-COC-02-02, RQ-COC-02-10); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-019) La comanda y las etiquetas se imprimen al pasar a cocina; un pedido rechazado no se imprime.<br>**RB-02** (RN-CAP-020) Cada área tiene su ticketera y solo imprime lo suyo.<br>**RB-03** (RN-CAP-123) Las áreas propias no tienen etiqueta propia.<br>**RNF aplicables:** RNF-CAP-013, RNF-CAP-003. | `AreaCocina` (nombre, activa, propia, máximo 4 propias) · `Categoria.area` · `ComandaArea` (pedido, área, estado, horas) · `Agotado` (producto, sabor u opción, alcance hoy o indefinido, autor) · `AltaDemanda` (minutos, pausa) · `Impresion` (tipo, área, estado, intentos) · `LlaveTV`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)* |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • DEP-03 · D-13 (ADR-002).<br>• FT-PED-03.<br>• FT-COC-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-08, R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Pedidos y caja (reimprimir), Configuración del local ▸ Impresión (`Admin.dc.html`); `analisis/impresion-tickets.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-COC-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-13 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-COC-02 (requerimientos RQ-COC-02-01, RQ-COC-02-02, RQ-COC-02-10, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

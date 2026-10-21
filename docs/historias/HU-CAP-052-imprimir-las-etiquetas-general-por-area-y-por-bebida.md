---
id: HU-CAP-052
tipo: hu
titulo: "Imprimir las etiquetas general, por área y por bebida"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-006, FT-COC-02, RQ-COC-02-03, RQ-COC-02-04, RQ-COC-02-05, HU-CAP-051, HU-CAP-053, HU-CAP-054, ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007, DEP-02, DEP-03, DEP-06, R-08]
tags: [hu, cocina, capa-a, ft-coc-02, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-052 | Título | Imprimir las etiquetas general, por área y por bebida |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-006 · FT-COC-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-003** Cocina y barra | imprimir las etiquetas general, por área y por bebida | pegar en cada bolsa, bandeja y vaso lo que lleva |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-COC-02 «Impresión de comandas y etiquetas» (Debe tener, épica EP-CAP-006). Cubre los requerimientos: **RQ-COC-02-03** Se imprime una etiqueta general del pedido. **RQ-COC-02-04** Se imprime una etiqueta por área en la etiquetera de esa área. **RQ-COC-02-05** Se imprime una etiqueta por bebida con el nombre de la persona como protagonista, luego la bebida y lo que contiene. | **Alcance.**<br>• Se imprime una etiqueta general del pedido.<br>• Se imprime una etiqueta por área en la etiquetera de esa área.<br>• Se imprime una etiqueta por bebida con el nombre de la persona como protagonista, luego la bebida y lo que contiene. |
| **Problema.** Comandas y etiquetas sin escribir a mano, que reducen errores de preparación y de despacho. | **Fuera de alcance.**<br>• HU-CAP-051: Imprimir la comanda por área al pasar a cocina.<br>• HU-CAP-053: Activar o desactivar tipos de etiqueta.<br>• HU-CAP-054: Recibir la alerta de fallo y reimprimir.<br>• Pantallas de cocina: FT-COC-01.<br>• Comprobante y cupones impresos: FT-LEG-01 y FT-OFE-03.<br>• Elección técnica de la conexión: ADR-002 (Bloque 4). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el tipo «general» activo | el pedido pasa a cocina | sale una etiqueta con ticket, cliente o mesa, modalidad y cantidad de productos (RQ-COC-02-03) |
| CA-2 | un pedido con productos de tres áreas | pasa a cocina | cada etiquetera imprime la etiqueta de su área (RQ-COC-02-04) |
| CA-3 | 2 capuchinos para «Lucía» y «Diego» | el pedido pasa a cocina | salen 2 etiquetas con «LUCÍA» y «DIEGO» en letra grande, debajo «Capuchino grande» y luego «Contiene: expreso, leche y espuma de leche» con leche, dulzor y toppings (RQ-COC-02-05) |

Origen: criterios de verificación de FT-COC-02 (RQ-COC-02-03, RQ-COC-02-04, RQ-COC-02-05); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-58) La etiqueta de bebida lleva el nombre de la persona como protagonista; despacho imprime el pedido completo.<br>**RNF aplicables:** RNF-CAP-013, RNF-CAP-003. | `AreaCocina` (nombre, activa, propia, máximo 4 propias) · `Categoria.area` · `ComandaArea` (pedido, área, estado, horas) · `Agotado` (producto, sabor u opción, alcance hoy o indefinido, autor) · `AltaDemanda` (minutos, pausa) · `Impresion` (tipo, área, estado, intentos) · `LlaveTV`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)* |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-051** (Imprimir la comanda por área al pasar a cocina) va antes, dentro de la misma feature.<br>• DEP-03.<br>• FT-CAR-01 (nombre por bebida) · DEP-03.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-08 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Pedidos y caja (reimprimir), Configuración del local ▸ Impresión (`Admin.dc.html`); `analisis/impresion-tickets.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-COC-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-COC-02 (requerimientos RQ-COC-02-03, RQ-COC-02-04, RQ-COC-02-05, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

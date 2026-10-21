---
id: HU-CAP-057
tipo: hu
titulo: "Activar Alta demanda y pausar pedidos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-006, FT-COC-03, RQ-COC-03-06, RQ-COC-03-07, RQ-COC-03-08, RQ-COC-03-09, RQ-COC-03-10, HU-CAP-055, HU-CAP-056, ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007, D-01, DEP-02, DEP-06, R-01]
tags: [hu, cocina, capa-a, ft-coc-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-057 | Título | Activar Alta demanda y pausar pedidos |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-006 · FT-COC-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-003** Cocina y barra | activar Alta demanda y pausar pedidos | prometer tiempos reales en hora punta o parar los pedidos |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-COC-03 «Agotado por hoy y alta demanda» (Debe tener, épica EP-CAP-006). Cubre los requerimientos: **RQ-COC-03-06** Alta demanda suma los minutos elegidos al tiempo prometido en la carta y el chatbot. **RQ-COC-03-07** Los minutos extra van de 5 a 180, con atajos de 5 a 60. **RQ-COC-03-08** La pausa de pedidos solo se puede activar con Alta demanda activa. **RQ-COC-03-09** Con la pausa, la carta y el chatbot no reciben pedidos nuevos y el bot pasa los chats a un asesor. **RQ-COC-03-10** Apagar Alta demanda quita los minutos extra y la pausa. | **Alcance.**<br>• Alta demanda suma los minutos elegidos al tiempo prometido en la carta y el chatbot.<br>• Los minutos extra van de 5 a 180, con atajos de 5 a 60.<br>• La pausa de pedidos solo se puede activar con Alta demanda activa.<br>• Con la pausa, la carta y el chatbot no reciben pedidos nuevos y el bot pasa los chats a un asesor.<br>• Apagar Alta demanda quita los minutos extra y la pausa. |
| **Problema.** Evita prometer lo que no hay y tiempos que no se cumplen en hora punta. | **Fuera de alcance.**<br>• HU-CAP-055: Marcar y reactivar un agotado por hoy.<br>• HU-CAP-056: Agotar un producto desde Productos.<br>• Agotado automático por stock: FT-STK-03.<br>• Cómo la carta muestra agotados y pausa: FT-CAR-02. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un tiempo prometido de 13 minutos | cocina activa Alta demanda con +20 | la carta y el bot dicen 33 minutos (RQ-COC-03-06) |
| CA-2 | el control de Alta demanda | cocina escribe 200 | no se acepta; con el atajo «30» se aplica 30 (RQ-COC-03-07) |
| CA-3 | Alta demanda apagada | cocina busca la pausa | está desactivada; con Alta demanda activa se puede pausar (RQ-COC-03-08) |
| CA-4 | la pausa activa | un cliente intenta pedir por la carta o el bot | ve el aviso de pausa y el bot ofrece hablar con una persona (RQ-COC-03-09) |
| CA-5 | Alta demanda con pausa | cocina la apaga con Sí/No | el tiempo vuelve a 13 minutos y la carta recibe pedidos (RQ-COC-03-10) |
| CA-6 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-COC-03 (RQ-COC-03-06, RQ-COC-03-07, RQ-COC-03-08, RQ-COC-03-09, RQ-COC-03-10); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-044) En alta demanda se puede pausar el bot o subir los tiempos.<br>**RB-02** (RN-CAP-113) Alta demanda suma de 5 a 180 minutos; la pausa solo vale con Alta demanda activa.<br>**RNF aplicables:** RNF-CAP-002, RNF-CAP-019, RNF-CAP-009, RNF-CAP-012. | `AreaCocina` (nombre, activa, propia, máximo 4 propias) · `Categoria.area` · `ComandaArea` (pedido, área, estado, horas) · `Agotado` (producto, sabor u opción, alcance hoy o indefinido, autor) · `AltaDemanda` (minutos, pausa) · `Impresion` (tipo, área, estado, intentos) · `LlaveTV`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-056** (Agotar un producto desde Productos) va antes, dentro de la misma feature.<br>• D-01.<br>• FT-CAR-02 · FT-BOT-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Cocina ▸ Agotados y Alta demanda; Productos ▸ agotado (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-COC-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-01 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-COC-03 (requerimientos RQ-COC-03-06, RQ-COC-03-07, RQ-COC-03-08, RQ-COC-03-09, RQ-COC-03-10, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

---
id: HU-CAP-047
tipo: hu
titulo: "Ver en mi pantalla solo las comandas de mi área"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-006, FT-COC-01, RQ-COC-01-01, RQ-COC-01-02, RQ-COC-01-03, RQ-COC-01-04, RQ-COC-01-08, RQ-COC-01-09, HU-CAP-048, HU-CAP-049, HU-CAP-050, HU-CAP-198, ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007, DEP-02, DEP-06, R-01]
tags: [hu, cocina, capa-a, ft-coc-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-047 | Título | Ver en mi pantalla solo las comandas de mi área |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-006 · FT-COC-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-003** Cocina y barra | ver en mi pantalla solo las comandas de mi área | preparar solo lo que me toca sin buscar entre todos los pedidos |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-COC-01 «Pantallas de cocina por área» (Debe tener, épica EP-CAP-006). Cubre los requerimientos: **RQ-COC-01-01** Un pedido que pasa a cocina aparece en la pantalla de cada área con solo sus productos. **RQ-COC-01-02** Las partes de un combo van cada una a su área. **RQ-COC-01-03** La comanda muestra ticket, mozo o canal, modalidad, cronómetro, productos con opciones y notas sin desplazar. **RQ-COC-01-04** Al llegar un pedido suena un aviso y el color cambia según el tiempo frente a la meta. **RQ-COC-01-08** Las comandas ocupan todo el ancho de la pantalla, sin columnas vacías. **RQ-COC-01-09** Hay una vista general opcional con todas las áreas. | **Alcance.**<br>• Un pedido que pasa a cocina aparece en la pantalla de cada área con solo sus productos.<br>• Las partes de un combo van cada una a su área.<br>• La comanda muestra ticket, mozo o canal, modalidad, cronómetro, productos con opciones y notas sin desplazar.<br>• Al llegar un pedido suena un aviso y el color cambia según el tiempo frente a la meta.<br>• Las comandas ocupan todo el ancho de la pantalla, sin columnas vacías.<br>• Hay una vista general opcional con todas las áreas. |
| **Problema.** Cada área sabe qué preparar sin gritos ni papeles, y el tiempo de cada pedido se ve y se mide. Contribuye a OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-048: Despejar mi parte y devolverla desde el historial.<br>• HU-CAP-049: Ver la TV de cocina de solo lectura.<br>• HU-CAP-050: Crear áreas de cocina y asignarles categorías.<br>• HU-CAP-198: Ver en despacho el pedido completo de todas las áreas.<br>• Impresión de comandas y etiquetas: FT-COC-02.<br>• Agotado por hoy y Alta demanda: FT-COC-03.<br>• Mermas y cierre del día de cocina: FT-ALM-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido con un frappé y un sándwich | pasa a cocina | Bebidas ve el frappé, Salados ve el sándwich y Postres no ve nada (RQ-COC-01-01) |
| CA-2 | un combo de bebida y postre | pasa a cocina | la bebida va a Bebidas y el postre a Postres, cada uno con el nombre del combo (RQ-COC-01-02) |
| CA-3 | un pedido con 6 productos | aparece en Bebidas | todo cabe en su tarjeta sin scroll, con las opciones y la nota resaltada (RQ-COC-01-03) |
| CA-4 | el tiempo desde que el cliente terminó su pedido | una comanda pasa los 35 y los 50 minutos | cambia a naranja y a rojo (RQ-COC-01-04) |
| CA-5 | 3 comandas en Bebidas | se ven en una pantalla de 1366 px | se reparten en todo el ancho, sin espacios en blanco por estado (RQ-COC-01-08) |
| CA-6 | un usuario de cocina | elige «Vista general» | ve todas las comandas con el estado de cada área (RQ-COC-01-09) |
| CA-7 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-COC-01 (RQ-COC-01-01, RQ-COC-01-02, RQ-COC-01-03, RQ-COC-01-04, RQ-COC-01-08, RQ-COC-01-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-002) Al confirmarse (o enviarse por el mozo) aparece en las pantallas de cocina y empiezan los tiempos.<br>**RB-02** (RN-CAP-022) La pantalla muestra el pedido completo, avisa con sonido y cambia de color según la meta.<br>**RB-03** (RN-CAP-035) Los productos de un combo van a la pantalla de su área.<br>**RB-04** (DT-58) Un solo botón «Despejar», comandas a todo el ancho, Historial para devolver y vista de Despacho con el pedido completo.<br>**RNF aplicables:** RNF-CAP-002, RNF-CAP-004, RNF-CAP-006, RNF-CAP-003. | `AreaCocina` (nombre, activa, propia, máximo 4 propias) · `Categoria.area` · `ComandaArea` (pedido, área, estado, horas) · `Agotado` (producto, sabor u opción, alcance hoy o indefinido, autor) · `AltaDemanda` (minutos, pausa) · `Impresion` (tipo, área, estado, intentos) · `LlaveTV`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)* |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-OFE-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Cocina por área (Despejar, Historial), Despacho, vista general, TV de cocina (`Admin.dc.html`); `analisis/pantalla-cocina.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-COC-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-COC-01 (requerimientos RQ-COC-01-01, RQ-COC-01-02, RQ-COC-01-03, RQ-COC-01-04, RQ-COC-01-08, RQ-COC-01-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

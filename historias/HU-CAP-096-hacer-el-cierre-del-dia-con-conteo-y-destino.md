---
id: HU-CAP-096
tipo: hu
titulo: "Hacer el cierre del día con conteo y destino"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-010, FT-ALM-03, RQ-ALM-03-05, RQ-ALM-03-06, RQ-ALM-03-07, RQ-ALM-03-09, HU-CAP-094, HU-CAP-095, ADR-001, ADR-011, ADR-014, ADR-003, DEP-02, DEP-06, R-01]
tags: [hu, almacen, capa-a, ft-alm-03, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-096 | Título | Hacer el cierre del día con conteo y destino |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-010 · FT-ALM-03 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Producción, encargada de la mañana (aún sin código ACT en el BRD)** | hacer el cierre del día con conteo y destino | cerrar el día con el stock real y la merma explicada |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-ALM-03 «Pedidos internos, mermas y cierre del día» (Debería tener, épica EP-CAP-010). Cubre los requerimientos: **RQ-ALM-03-05** El cierre del día lista todos los productos del día con stock para contarlos. **RQ-ALM-03-06** Por cada producto se anota lo contado, cuánto se bota y su destino. **RQ-ALM-03-07** Lo no botado sigue en stock y la diferencia queda como merma por diferencia de conteo. **RQ-ALM-03-09** La estación se cierra al terminar el cierre del día. | **Alcance.**<br>• El cierre del día lista todos los productos del día con stock para contarlos.<br>• Por cada producto se anota lo contado, cuánto se bota y su destino.<br>• Lo no botado sigue en stock y la diferencia queda como merma por diferencia de conteo.<br>• La estación se cierra al terminar el cierre del día. |
| **Problema.** Saber cuánto se pierde cada día y por qué, y que cocina tenga lo que necesita sin pedir de palabra. | **Fuera de alcance.**<br>• HU-CAP-094: Pedir insumos al almacén y atender el pedido.<br>• HU-CAP-095: Registrar la merma de productos de cocina.<br>• Movimientos de insumos del almacén: FT-ALM-01.<br>• Producción: FT-ALM-02. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | donas, galletas y gelatina con stock | producción abre el cierre del día | aparecen los tres con su stock del sistema (RQ-ALM-03-05) |
| CA-2 | 10 donas en sistema | se cuentan 9 y se botan 4 a donación | quedan 5 en stock, 4 de merma «donación» y 1 de «diferencia de conteo» (RQ-ALM-03-06) |
| CA-3 | el cierre anterior | se confirma con Sí/No | el stock final es 5 y el informe de merma muestra 1 por diferencia (RQ-ALM-03-07) |
| CA-4 | el cierre confirmado | el área cierra la estación | su pantalla muestra «Estación cerrada» hasta el día siguiente (RQ-ALM-03-09) |
| CA-5 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-ALM-03 (RQ-ALM-03-05, RQ-ALM-03-06, RQ-ALM-03-07, RQ-ALM-03-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-121) El cierre del día lista los productos; lo contado de menos queda como diferencia de conteo.<br>**RB-02** (RN-CAP-124) Destinos de merma: donación, personal, desecho, caída, error de comanda y calibración.<br>**RNF aplicables:** RNF-CAP-020, RNF-CAP-019, RNF-CAP-009. | `MovimientoStock` (entrada, salida, merma, devolución, producción, traslado) · `Traslado` (por recibir, recibido, diferencia) · `Produccion` (receta, tandas, hora, anulada) · `PedidoInterno` · `Merma` (producto, cantidad, origen, destino) · `CierreDia` (contado, botado, diferencia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-095** (Registrar la merma de productos de cocina) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Cocina ▸ Pedir insumos, Merma, Cierre del día; Almacén ▸ Pedidos internos (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-ALM-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-ALM-03 (requerimientos RQ-ALM-03-05, RQ-ALM-03-06, RQ-ALM-03-07, RQ-ALM-03-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

---
id: HU-CAP-075
tipo: hu
titulo: "Corregir la dirección y seguir los intentos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-008, FT-DEL-03, RQ-DEL-03-03, RQ-DEL-03-04, HU-CAP-074, HU-CAP-076, HU-CAP-077, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010, D-05, DEP-02, DEP-06, R-01]
tags: [hu, delivery, capa-a, ft-del-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-075 | Título | Corregir la dirección y seguir los intentos |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-008 · FT-DEL-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | corregir la dirección y seguir los intentos | que el repartidor llegue con la dirección corregida |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-DEL-03 «Entregas fallidas» (Debe tener, épica EP-CAP-008). Cubre los requerimientos: **RQ-DEL-03-03** Caja o call center corrigen la dirección y el punto, y el repartidor ve el cambio. **RQ-DEL-03-04** Se cuentan los intentos y, al pasar el tiempo o los intentos configurados, se recomienda volver a la tienda. | **Alcance.**<br>• Caja o call center corrigen la dirección y el punto, y el repartidor ve el cambio.<br>• Se cuentan los intentos y, al pasar el tiempo o los intentos configurados, se recomienda volver a la tienda. |
| **Problema.** Que una entrega fallida no se quede en el aire: alguien la atiende, se decide qué hacer y queda registrada. | **Fuera de alcance.**<br>• HU-CAP-074: Reportar que el cliente no contesta o no encuentro la dirección.<br>• HU-CAP-076: Cerrar la coordinación de un pedido devuelto.<br>• HU-CAP-077: Registrar la merma de lo no entregado y configurar entregas fallidas.<br>• Mensajes automáticos del bot para la coordinación (se hace a mano por WhatsApp en la primera versión).<br>• Merma de reparto en el stock: FT-ALM-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un «No encuentro la dirección» | caja corrige el punto | el repartidor ve la nueva ubicación y un aviso «Dirección corregida» (RQ-DEL-03-03) |
| CA-2 | 2 intentos y 10 minutos configurados | se llega al segundo intento o a los 10 minutos | el repartidor ve «Volver a la tienda» como recomendación (RQ-DEL-03-04) |

Origen: criterios de verificación de FT-DEL-03 (RQ-DEL-03-03, RQ-DEL-03-04); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-089) Cliente que no contesta o dirección no encontrada avisa a caja y al call center.<br>**RB-02** (RN-CAP-125) Un pedido devuelto queda en coordinación y nadie lo toma hasta concluir; anular por «Cliente no recibió» sigue las reglas de siempre.<br>**RB-03** (RN-CAP-126) Lo preparado y no entregado es merma informativa sin descontar stock otra vez.<br>**RNF aplicables:** RNF-CAP-002, RNF-CAP-009, RNF-CAP-010. | `ZonaReparto` (código, polígono de puntos, tarifa, activa) · `TarifaEspecialCliente` (fijo o porcentaje) · `AsignacionReparto` (pedido, repartidor, hora de toma, salida, entrega) · `IncidenteEntrega` (motivo, intento, hora) · `Coordinacion` (estado, cierre, recargo).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-074** (Reportar que el cliente no contesta o no encuentro la dirección) va antes, dentro de la misma feature.<br>• FT-DEL-01.<br>• D-05.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Repartos (reportar), Pedidos y caja ▸ «En coordinación», Configuración ▸ Entregas fallidas (`Admin.dc.html`); `analisis/flujo-entregas-fallidas.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-DEL-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-05 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-DEL-03 (requerimientos RQ-DEL-03-03, RQ-DEL-03-04, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

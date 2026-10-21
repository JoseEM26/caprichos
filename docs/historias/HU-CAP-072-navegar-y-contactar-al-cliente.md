---
id: HU-CAP-072
tipo: hu
titulo: "Navegar y contactar al cliente"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-008, FT-DEL-02, RQ-DEL-02-04, RQ-DEL-02-05, RQ-DEL-02-06, HU-CAP-071, HU-CAP-073, HU-CAP-196, HU-CAP-197, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010, DEP-02, DEP-06, R-01]
tags: [hu, delivery, capa-a, ft-del-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-072 | Título | Navegar y contactar al cliente |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-008 · FT-DEL-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-009** Repartidor (motorizado) | navegar y contactar al cliente | llegar al cliente sin copiar direcciones a mano |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-DEL-02 «Reparto: tomar, navegar y entregar» (Debe tener, épica EP-CAP-008). Cubre los requerimientos: **RQ-DEL-02-04** El repartidor abre la ubicación en su aplicación de mapas por coordenadas con un toque. **RQ-DEL-02-05** El repartidor llama o escribe por WhatsApp al cliente con un toque. **RQ-DEL-02-06** El repartidor ve cuánto cobrar y el vuelto que debe llevar. | **Alcance.**<br>• El repartidor abre la ubicación en su aplicación de mapas por coordenadas con un toque.<br>• El repartidor llama o escribe por WhatsApp al cliente con un toque.<br>• El repartidor ve cuánto cobrar y el vuelto que debe llevar. |
| **Problema.** El repartidor decide su ruta mirando una sola pantalla, sin entrar y salir de Google Maps por cada pedido; en hora punta sabe qué pedido lleva más retraso y qué puede llevar de pasada (problema de hoy con restaurant.pe, acta 03). Contribuye a OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-071: Ver y tomar un delivery listo.<br>• HU-CAP-073: Marcar en camino, he llegado y entregado con el cobro.<br>• HU-CAP-196: Ver los pedidos en el mapa con nombre, color de espera y orden sugerido.<br>• HU-CAP-197: Recibir por WhatsApp el aviso de que mi pedido sale y de que el repartidor llegó.<br>• Entregas fallidas: FT-DEL-03.<br>• Liquidación en caja: FT-CIE-01.<br>• Ubicación del repartidor en tiempo real (descartada por el costo de la API, DT-59).<br>• Asignación automática de repartidores (no pedida).<br>• Ruta calculada por calles con una API de pago: el orden sugerido usa distancia en línea recta. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido con punto | toca «Navegar» | se abre Google Maps, Waze u otra aplicación con esas coordenadas (RQ-DEL-02-04) |
| CA-2 | un pedido | toca «Llamar» o «WhatsApp» | se abre la llamada o el chat con el teléfono del cliente (RQ-DEL-02-05) |
| CA-3 | un delivery de S/ 37 en efectivo, «paga con S/ 50» | lo abre | ve «Cobrar S/ 37,00 · llevar vuelto S/ 13,00»; si ya está pagado con Yape, ve «Pagado» (RQ-DEL-02-06) |
| CA-4 | un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-DEL-02 (RQ-DEL-02-04, RQ-DEL-02-05, RQ-DEL-02-06); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-012) El repartidor ve solo los pedidos asignados, con ubicación, y la abre en una app de mapas.<br>**RB-02** (RN-CAP-024) Un delivery listo lo toma un solo repartidor; el otro ve un aviso.<br>**RB-03** (RN-CAP-033) El repartidor no toma pedidos.<br>**RNF aplicables:** RNF-CAP-010, RNF-CAP-004, RNF-CAP-006, RNF-CAP-008, RNF-CAP-002. | `ZonaReparto` (código, polígono de puntos, tarifa, activa) · `TarifaEspecialCliente` (fijo o porcentaje) · `AsignacionReparto` (pedido, repartidor, hora de toma, salida, entrega) · `IncidenteEntrega` (motivo, intento, hora) · `Coordinacion` (estado, cierre, recargo).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-071** (Ver y tomar un delivery listo) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Repartos (rol repartidor): mapa a pantalla completa, vista de lista, resumen al tocar un punto, botón de estado (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-DEL-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-DEL-02 (requerimientos RQ-DEL-02-04, RQ-DEL-02-05, RQ-DEL-02-06, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

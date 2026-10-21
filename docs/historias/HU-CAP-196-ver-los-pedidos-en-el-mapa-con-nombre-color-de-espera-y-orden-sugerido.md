---
id: HU-CAP-196
tipo: hu
titulo: "Ver los pedidos en el mapa con nombre, color de espera y orden sugerido"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-008, FT-DEL-02, RQ-DEL-02-10, RQ-DEL-02-11, RQ-DEL-02-12, RQ-DEL-02-13, RQ-DEL-02-14, RQ-DEL-02-15, HU-CAP-071, HU-CAP-072, HU-CAP-073, HU-CAP-197, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010, D-29, DEP-02, DEP-06, R-01]
tags: [hu, delivery, capa-a, ft-del-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-196 | Título | Ver los pedidos en el mapa con nombre, color de espera y orden sugerido |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-008 · FT-DEL-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-009** Repartidor (motorizado) | ver los pedidos listos en un mapa con el nombre del cliente, su color de espera y un orden sugerido | decidir rápido a quién entrego primero sin salir de una pantalla a otra |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-DEL-02 «Reparto: tomar, navegar y entregar» (Debe tener, épica EP-CAP-008). Cubre los requerimientos: **RQ-DEL-02-10** La pantalla principal es un mapa a pantalla completa con zoom automático que abarca los pedidos listos. **RQ-DEL-02-11** Cada punto muestra el nombre completo del cliente y debajo, en chico, el código del pedido. **RQ-DEL-02-12** El color de cada punto depende del tiempo desde que el cliente terminó su pedido: verde, naranja o rojo palpitando. **RQ-DEL-02-13** Los pedidos se agrupan por las zonas de reparto ya definidas, para saber qué se puede llevar en una misma ruta. **RQ-DEL-02-14** El sistema propone un orden sugerido por cercanía y tiempo para los pedidos que tomó, sin obligarlo. **RQ-DEL-02-15** Al tocar un punto, abajo aparece el resumen del pedido con Llamar, WhatsApp, Navegar, cobro y el botón de estado. | **Alcance.**<br>• La pantalla principal es un mapa a pantalla completa con zoom automático que abarca los pedidos listos.<br>• Cada punto muestra el nombre completo del cliente y debajo, en chico, el código del pedido.<br>• El color de cada punto depende del tiempo desde que el cliente terminó su pedido: verde, naranja o rojo palpitando.<br>• Los pedidos se agrupan por las zonas de reparto ya definidas, para saber qué se puede llevar en una misma ruta.<br>• El sistema propone un orden sugerido por cercanía y tiempo para los pedidos que tomó, sin obligarlo.<br>• Al tocar un punto, abajo aparece el resumen del pedido con Llamar, WhatsApp, Navegar, cobro y el botón de estado. |
| **Problema.** El repartidor decide su ruta mirando una sola pantalla, sin entrar y salir de Google Maps por cada pedido; en hora punta sabe qué pedido lleva más retraso y qué puede llevar de pasada (problema de hoy con restaurant.pe, acta 03). Contribuye a OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-071: Ver y tomar un delivery listo.<br>• HU-CAP-072: Navegar y contactar al cliente.<br>• HU-CAP-073: Marcar en camino, he llegado y entregado con el cobro.<br>• HU-CAP-197: Recibir por WhatsApp el aviso de que mi pedido sale y de que el repartidor llegó.<br>• Entregas fallidas: FT-DEL-03.<br>• Liquidación en caja: FT-CIE-01.<br>• Ubicación del repartidor en tiempo real (descartada por el costo de la API, DT-59).<br>• Asignación automática de repartidores (no pedida).<br>• Ruta calculada por calles con una API de pago: el orden sugerido usa distancia en línea recta. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | 2 pedidos a media cuadra entre sí | el repartidor abre Repartos | el mapa se acerca a esos dos puntos; con 10 pedidos en Campoy, Mangomarca y Huachipa, se aleja hasta mostrarlos todos (RQ-DEL-02-10) |
| CA-2 | dos pedidos de «Diego» | aparecen en el mapa | se leen «Diego Ramos · CP-0104» y «Diego Salas · CP-0107»; si el cliente dejó solo su nombre, el código los distingue (RQ-DEL-02-11) |
| CA-3 | umbrales de 35 y 50 minutos | un pedido lleva 20, 40 y 55 minutos | sus puntos se ven verde, naranja (palpita suave) y rojo (palpita fuerte); el administrador cambia los minutos en Configuración (RQ-DEL-02-12) |
| CA-4 | 3 pedidos en la zona Z4 y 1 en Z7 | el repartidor abre la lista | los ve agrupados «Z4 · 3 pedidos» y «Z7 · 1 pedido»; en el mapa, el filtro de zona muestra solo esa zona (RQ-DEL-02-13) |
| CA-5 | un repartidor con 3 pedidos tomados | abre el mapa | ve los números 1, 2 y 3 sobre sus puntos según la distancia desde el local y el tiempo de espera, sin ninguna pregunta; puede entregarlos en otro orden (RQ-DEL-02-14) |
| CA-6 | el mapa | el repartidor toca «Rosa Díaz» | ve abajo el código, el total, el vuelto, los botones Llamar, WhatsApp y Navegar, y el botón grande «Tomar pedido» (RQ-DEL-02-15) |
| CA-7 | un usuario con un rol sin permiso para esta acción (ACT-CAP-004 mozo) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-DEL-02 (RQ-DEL-02-10, RQ-DEL-02-11, RQ-DEL-02-12, RQ-DEL-02-13, RQ-DEL-02-14, RQ-DEL-02-15); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-59) Mapa a pantalla completa con nombres, código, colores por tiempo, zonas y orden sugerido; cuatro estados con un botón.<br>**RNF aplicables:** RNF-CAP-010, RNF-CAP-004, RNF-CAP-006, RNF-CAP-008, RNF-CAP-002. | `ZonaReparto` (código, polígono de puntos, tarifa, activa) · `TarifaEspecialCliente` (fijo o porcentaje) · `AsignacionReparto` (pedido, repartidor, hora de toma, salida, entrega) · `IncidenteEntrega` (motivo, intento, hora) · `Coordinacion` (estado, cierre, recargo).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-073** (Marcar en camino, he llegado y entregado con el cobro) va antes, dentro de la misma feature.<br>• ADR del mapa interno (Leaflet + OpenStreetMap).<br>• FT-CFG-02 · D-29.<br>• FT-DEL-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Repartos (rol repartidor): mapa a pantalla completa, vista de lista, resumen al tocar un punto, botón de estado (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-DEL-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-29 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-DEL-02 (requerimientos RQ-DEL-02-10, RQ-DEL-02-11, RQ-DEL-02-12, RQ-DEL-02-13, RQ-DEL-02-14, RQ-DEL-02-15, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

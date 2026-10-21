---
id: HU-CAP-197
tipo: hu
titulo: "Recibir por WhatsApp el aviso de que mi pedido sale y de que el repartidor llegó"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-008, FT-DEL-02, RQ-DEL-02-16, RQ-DEL-02-17, RQ-DEL-02-18, RQ-DEL-02-19, HU-CAP-071, HU-CAP-072, HU-CAP-073, HU-CAP-196, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010, D-08, D-27, DEP-02, DEP-12, R-01, R-04]
tags: [hu, delivery, capa-a, ft-del-02, media]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-197 | Título | Recibir por WhatsApp el aviso de que mi pedido sale y de que el repartidor llegó |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-008 · FT-DEL-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | recibir por WhatsApp un aviso cuando mi pedido sale y cuando el repartidor llega | estar atento a la llamada del repartidor y recibir mi pedido en buen estado |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-DEL-02 «Reparto: tomar, navegar y entregar» (Debe tener, épica EP-CAP-008). Cubre los requerimientos: **RQ-DEL-02-16** Al pulsar «En camino», el cliente recibe un mensaje automático por WhatsApp. **RQ-DEL-02-17** Al pulsar «He llegado» se envía el mensaje 2 y, si el cliente no responde en el tiempo configurado, el mensaje 3 con la espera máxima de 10 minutos. **RQ-DEL-02-18** Si el cliente responde por WhatsApp (con un botón o un texto), no se envían los mensajes siguientes. **RQ-DEL-02-19** Los textos de los mensajes de reparto y los minutos entre ellos los edita el administrador. | **Alcance.**<br>• Al pulsar «En camino», el cliente recibe un mensaje automático por WhatsApp.<br>• Al pulsar «He llegado» se envía el mensaje 2 y, si el cliente no responde en el tiempo configurado, el mensaje 3 con la espera máxima de 10 minutos.<br>• Si el cliente responde por WhatsApp (con un botón o un texto), no se envían los mensajes siguientes.<br>• Los textos de los mensajes de reparto y los minutos entre ellos los edita el administrador. |
| **Problema.** El repartidor decide su ruta mirando una sola pantalla, sin entrar y salir de Google Maps por cada pedido; en hora punta sabe qué pedido lleva más retraso y qué puede llevar de pasada (problema de hoy con restaurant.pe, acta 03). Contribuye a OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-071: Ver y tomar un delivery listo.<br>• HU-CAP-072: Navegar y contactar al cliente.<br>• HU-CAP-073: Marcar en camino, he llegado y entregado con el cobro.<br>• HU-CAP-196: Ver los pedidos en el mapa con nombre, color de espera y orden sugerido.<br>• Entregas fallidas: FT-DEL-03.<br>• Liquidación en caja: FT-CIE-01.<br>• Ubicación del repartidor en tiempo real (descartada por el costo de la API, DT-59).<br>• Asignación automática de repartidores (no pedida).<br>• Ruta calculada por calles con una API de pago: el orden sugerido usa distancia en línea recta. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido tomado | el repartidor pulsa «En camino» | el cliente recibe el mensaje 1 («Tu pedido está en camino, por favor atento a tu celular para recibir la llamada») en menos de un minuto (RQ-DEL-02-16) |
| CA-2 | un repartidor que pulsa «He llegado» | el cliente no responde en minuto y medio | recibe el mensaje 3 («Recuerda que el tiempo máximo de espera es de 10 minutos…; si no estás, el repartidor regresará al local con tu pedido») (RQ-DEL-02-17) |
| CA-3 | el mensaje 2 enviado | el cliente toca «Ya salgo» | no se envía el mensaje 3 y el repartidor ve «El cliente respondió» (RQ-DEL-02-18) |
| CA-4 | el mensaje 1 | el administrador cambia el texto en Configuración ▸ Mensajes con Sí/No | los siguientes envíos usan el nuevo texto (RQ-DEL-02-19) |
| CA-5 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-DEL-02 (RQ-DEL-02-16, RQ-DEL-02-17, RQ-DEL-02-18, RQ-DEL-02-19); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-60) Mensajes automáticos al cliente al salir y al llegar; se cortan si responde; textos editables.<br>**RNF aplicables:** RNF-CAP-010, RNF-CAP-004, RNF-CAP-006, RNF-CAP-008, RNF-CAP-002. | `ZonaReparto` (código, polígono de puntos, tarifa, activa) · `TarifaEspecialCliente` (fijo o porcentaje) · `AsignacionReparto` (pedido, repartidor, hora de toma, salida, entrega) · `IncidenteEntrega` (motivo, intento, hora) · `Coordinacion` (estado, cierre, recargo).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-196** (Ver los pedidos en el mapa con nombre, color de espera y orden sugerido) va antes, dentro de la misma feature.<br>• DEP-12 · D-08.<br>• D-27 · FT-DEL-03.<br>• DEP-12.<br>• FT-CFG-02 · plantilla de Kevin (acta 03).<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-04, R-01 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-08, D-27 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-DEL-02 (requerimientos RQ-DEL-02-16, RQ-DEL-02-17, RQ-DEL-02-18, RQ-DEL-02-19, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

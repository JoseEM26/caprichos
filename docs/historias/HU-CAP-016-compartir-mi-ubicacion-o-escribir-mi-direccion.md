---
id: HU-CAP-016
tipo: hu
titulo: "Compartir mi ubicación o escribir mi dirección"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-002, FT-PED-02, RQ-PED-02-01, RQ-PED-02-02, RQ-PED-02-03, RQ-PED-02-04, RQ-PED-02-05, RQ-PED-02-06, HU-CAP-017, HU-CAP-018, ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010, DEP-02, DEP-06, R-01]
tags: [hu, pedido, capa-a, ft-ped-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-016 | Título | Compartir mi ubicación o escribir mi dirección |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-002 · FT-PED-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | compartir mi ubicación o escribir mi dirección | que el repartidor llegue a mi puerta aunque no sepa explicar mi dirección |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PED-02 «Ubicación y costo de envío en la carta» (Debe tener, épica EP-CAP-002). Cubre los requerimientos: **RQ-PED-02-01** En delivery, la carta ofrece «Usar mi ubicación actual» y muestra el punto en un mapa con enlace a Google Maps. **RQ-PED-02-02** Si la ubicación falla, se avisa y se pide escribir la dirección, sin bloquear el pedido. **RQ-PED-02-03** Con ubicación compartida, la dirección escrita es opcional; sin ubicación, es obligatoria. **RQ-PED-02-04** Debajo del mapa el cliente confirma la ubicación con «Mi pedido llega aquí» antes de seguir. **RQ-PED-02-05** El cliente puede mover el pin y dejar una referencia. **RQ-PED-02-06** La carta no pide código Plus de Google Maps. | **Alcance.**<br>• En delivery, la carta ofrece «Usar mi ubicación actual» y muestra el punto en un mapa con enlace a Google Maps.<br>• Si la ubicación falla, se avisa y se pide escribir la dirección, sin bloquear el pedido.<br>• Con ubicación compartida, la dirección escrita es opcional; sin ubicación, es obligatoria.<br>• Debajo del mapa el cliente confirma la ubicación con «Mi pedido llega aquí» antes de seguir.<br>• El cliente puede mover el pin y dejar una referencia.<br>• La carta no pide código Plus de Google Maps. |
| **Problema.** Pedidos de delivery con un punto exacto que el repartidor abre en su app de mapas, y un costo de envío correcto sin preguntar zonas al cliente. Contribuye a OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-017: Ver el costo de envío o el aviso de fuera de cobertura.<br>• HU-CAP-018: Ver envío gratis y pedido mínimo.<br>• Cómo se editan zonas y tarifas: FT-DEL-01.<br>• Cómo el asesor ubica un pedido sin punto: FT-CAJ-01.<br>• Seguimiento del repartidor en un mapa en tiempo real (fuera de alcance, BRD §4). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un cliente que acepta el permiso | toca el botón | ve «Ubicación encontrada», el pin en el mapa y el enlace que abre ese punto (RQ-PED-02-01) |
| CA-2 | un cliente que niega el permiso | toca el botón | ve «No fue posible conseguir la ubicación» y puede terminar el pedido escribiendo la dirección (RQ-PED-02-02) |
| CA-3 | un pedido con punto | el cliente deja la dirección vacía | puede enviar; sin punto y con la dirección vacía, no puede (RQ-PED-02-03) |
| CA-4 | el pin puesto por el GPS | el cliente intenta seguir sin confirmar | ve «Revisa que el punto rojo sea donde recibirás tu pedido» y el botón «Mi pedido llega aquí»; al confirmar, se calcula el envío con ese punto (RQ-PED-02-04) |
| CA-5 | el pin en el mapa | el cliente lo arrastra a su puerta y escribe «casa verde, 2.º piso» | el pedido guarda el punto nuevo y la referencia (RQ-PED-02-05) |
| CA-6 | el paso de entrega | se revisa el formulario | no hay campo de código Plus (RQ-PED-02-06) |
| CA-7a | un cliente en delivery | elige «Escribir dirección» o «Marcar en el mapa» | puede pedir sin usar el GPS: escribe su calle (sin mapa) o mueve el punto hasta su puerta y lo confirma (RQ-PED-02-11) |
| CA-7 | un celular de 360 px de ancho | el cliente abre la pantalla de esta historia | todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) |

Origen: criterios de verificación de FT-PED-02 (RQ-PED-02-01, RQ-PED-02-02, RQ-PED-02-03, RQ-PED-02-04, RQ-PED-02-05, RQ-PED-02-06); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-065) Manda la ubicación actual; no se pide código Plus; si falla, se avisa y se escribe la dirección.<br>**RB-02** (DT-57) La ubicación se confirma bajo el mapa, no es obligatoria y los límites de las zonas no se muestran al cliente.<br>**RNF aplicables:** RNF-CAP-008, RNF-CAP-004, RNF-CAP-011. | `Pedido` (código único, canal, modalidad, estado «por confirmar», total) · `LineaPedido` (producto, tamaño, opciones, nota, cantidad, precio) · `ClienteContacto` (nombre, teléfono, aceptación) · `Entrega` (latitud, longitud, enlace, dirección, referencia, zona, envío) · `PagoPreferido` (medio, monto con que paga).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** montos en soles con dos decimales; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ paso de entrega con «Usar mi ubicación actual», mapa, dirección, referencia y costo de envío (`Main.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-PED-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PED-02 (requerimientos RQ-PED-02-01, RQ-PED-02-02, RQ-PED-02-03, RQ-PED-02-04, RQ-PED-02-05, RQ-PED-02-06, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

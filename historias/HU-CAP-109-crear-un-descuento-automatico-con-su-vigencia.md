---
id: HU-CAP-109
tipo: hu
titulo: "Crear un descuento automático con su vigencia"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-012, FT-OFE-02, RQ-OFE-02-01, RQ-OFE-02-04, RQ-OFE-02-07, HU-CAP-110, HU-CAP-111, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, DEP-02, DEP-06, R-01]
tags: [hu, ofertas, capa-a, ft-ofe-02, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-109 | Título | Crear un descuento automático con su vigencia |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-012 · FT-OFE-02 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | crear un descuento automático con su vigencia | hacer descuentos por horario, como un happy hour, sin códigos |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-OFE-02 «Descuentos automáticos y acumulación» (Debería tener, épica EP-CAP-012). Cubre los requerimientos: **RQ-OFE-02-01** El administrador crea un descuento automático por categoría o producto, en porcentaje o monto. **RQ-OFE-02-04** El descuento se aplica solo sobre las líneas a las que corresponde. **RQ-OFE-02-07** Los descuentos se aplican igual en la carta, Nuevo pedido y el chatbot. | **Alcance.**<br>• El administrador crea un descuento automático por categoría o producto, en porcentaje o monto.<br>• El descuento se aplica solo sobre las líneas a las que corresponde.<br>• Los descuentos se aplican igual en la carta, Nuevo pedido y el chatbot. |
| **Problema.** Promociones por horario (por ejemplo, «happy hour») que se aplican igual en todos los canales sin que nadie tenga que recordar el código. | **Fuera de alcance.**<br>• HU-CAP-110: Aplicar el mejor descuento en todos los canales.<br>• HU-CAP-111: Configurar las reglas de acumulación.<br>• Combos y promociones: FT-OFE-01.<br>• Cupones: FT-OFE-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | «20 % en Frappés» | se guarda activo | aplica a los productos de esa categoría (RQ-OFE-02-01) |
| CA-2 | un pedido con un frappé de S/ 12 y un sándwich de S/ 15 con 20 % en Frappés | se calcula | el descuento es S/ 2,40 (RQ-OFE-02-04) |
| CA-3 | un mismo carrito a la misma hora | se calcula en los tres canales permitidos | el descuento es el mismo (RQ-OFE-02-07) |

Origen: criterios de verificación de FT-OFE-02 (RQ-OFE-02-01, RQ-OFE-02-04, RQ-OFE-02-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-132) Hora desde inclusiva, hasta exclusiva; fechas inclusivas; canales, mínimo y líneas; solo el mejor.<br>**RNF aplicables:** RNF-CAP-019, RNF-CAP-011. | `Oferta` (tipo combo, lleva N paga M, descuento; vigencia: días, horas, fechas, canal, límite) · `DescuentoAutomatico` (alcance, porcentaje o monto, mínimo) · `ReglaAcumulacion` · `Cupon` (modo único o compartido, tope, por cliente) · `CuponEmitido` (código al azar, pedido, estado, vencimiento) · `IntentoCupon`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-BOT-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Ofertas y descuentos ▸ Descuentos automáticos y Reglas (`Admin.dc.html`); `analisis/descuentos-y-promociones.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-OFE-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-OFE-02 (requerimientos RQ-OFE-02-01, RQ-OFE-02-04, RQ-OFE-02-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

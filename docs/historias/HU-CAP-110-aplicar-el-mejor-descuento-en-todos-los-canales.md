---
id: HU-CAP-110
tipo: hu
titulo: "Aplicar el mejor descuento en todos los canales"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-012, FT-OFE-02, RQ-OFE-02-02, RQ-OFE-02-03, HU-CAP-109, HU-CAP-111, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, DEP-02, DEP-06, R-01]
tags: [hu, ofertas, capa-a, ft-ofe-02, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-110 | Título | Aplicar el mejor descuento en todos los canales |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-012 · FT-OFE-02 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | recibir el mejor descuento vigente en la carta, en caja o en el chatbot | recibir el mismo descuento sin importar por dónde pida |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-OFE-02 «Descuentos automáticos y acumulación» (Debería tener, épica EP-CAP-012). Cubre los requerimientos: **RQ-OFE-02-02** El descuento vale solo en sus días, horas y fechas, con hora desde inclusiva y hasta exclusiva. **RQ-OFE-02-03** El descuento vale solo en sus canales y con su compra mínima. | **Alcance.**<br>• El descuento vale solo en sus días, horas y fechas, con hora desde inclusiva y hasta exclusiva.<br>• El descuento vale solo en sus canales y con su compra mínima. |
| **Problema.** Promociones por horario (por ejemplo, «happy hour») que se aplican igual en todos los canales sin que nadie tenga que recordar el código. | **Fuera de alcance.**<br>• HU-CAP-109: Crear un descuento automático con su vigencia.<br>• HU-CAP-111: Configurar las reglas de acumulación.<br>• Combos y promociones: FT-OFE-01.<br>• Cupones: FT-OFE-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un descuento de 15:00 a 18:00 | el pedido se hace a las 15:00 | aplica; a las 18:00 ya no aplica (RQ-OFE-02-02) |
| CA-2 | un descuento solo en la carta con mínimo S/ 30 | el cliente pide S/ 28 en la carta o S/ 40 en el chatbot | no aplica (RQ-OFE-02-03) |

Origen: criterios de verificación de FT-OFE-02 (RQ-OFE-02-02, RQ-OFE-02-03); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-132) Hora desde inclusiva, hasta exclusiva; fechas inclusivas; canales, mínimo y líneas; solo el mejor.<br>**RNF aplicables:** RNF-CAP-019, RNF-CAP-011. | `Oferta` (tipo combo, lleva N paga M, descuento; vigencia: días, horas, fechas, canal, límite) · `DescuentoAutomatico` (alcance, porcentaje o monto, mínimo) · `ReglaAcumulacion` · `Cupon` (modo único o compartido, tope, por cliente) · `CuponEmitido` (código al azar, pedido, estado, vencimiento) · `IntentoCupon`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-109** (Crear un descuento automático con su vigencia) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Ofertas y descuentos ▸ Descuentos automáticos y Reglas (`Admin.dc.html`); `analisis/descuentos-y-promociones.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-OFE-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-OFE-02 (requerimientos RQ-OFE-02-02, RQ-OFE-02-03, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

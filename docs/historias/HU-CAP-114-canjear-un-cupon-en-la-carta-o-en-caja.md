---
id: HU-CAP-114
tipo: hu
titulo: "Canjear un cupón en la carta o en caja"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-012, FT-OFE-03, RQ-OFE-03-06, RQ-OFE-03-07, RQ-OFE-03-08, RQ-OFE-03-09, HU-CAP-112, HU-CAP-113, HU-CAP-115, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, DEP-02, DEP-06, R-01, R-11]
tags: [hu, ofertas, capa-a, ft-ofe-03, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-114 | Título | Canjear un cupón en la carta o en caja |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-012 · FT-OFE-03 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | canjear un cupón en la carta o en caja | usar mi cupón y ver el descuento al momento |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-OFE-03 «Cupones» (Debería tener, épica EP-CAP-012). Cubre los requerimientos: **RQ-OFE-03-06** Un pedido acepta un solo cupón, que no se junta con promociones ni con productos marcados «No suma puntos ni aplica cupones». **RQ-OFE-03-07** El cliente canjea el cupón escribiendo el código completo; el de código único vale una sola vez. **RQ-OFE-03-08** El cupón compartido respeta su tope de usos y el máximo por cliente con cuenta. **RQ-OFE-03-09** Tras 5 intentos fallidos, el campo de cupón se bloquea 5 minutos. | **Alcance.**<br>• Un pedido acepta un solo cupón, que no se junta con promociones ni con productos marcados «No suma puntos ni aplica cupones».<br>• El cliente canjea el cupón escribiendo el código completo; el de código único vale una sola vez.<br>• El cupón compartido respeta su tope de usos y el máximo por cliente con cuenta.<br>• Tras 5 intentos fallidos, el campo de cupón se bloquea 5 minutos. |
| **Problema.** Que el cliente vuelva (cupón en su comprobante) y que las campañas en redes tengan un tope de costo. | **Fuera de alcance.**<br>• HU-CAP-112: Crear y gestionar cupones de los dos modos.<br>• HU-CAP-113: Imprimir cupones sorteados en el comprobante.<br>• HU-CAP-115: Ver, vencer y anular cupones emitidos.<br>• Descuentos automáticos y acumulación: FT-OFE-02.<br>• Cupón de cumpleaños: FT-CLI-02 (usa esta feature). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido con un cupón aplicado | el cliente escribe otro | ve «Solo se puede usar un cupón por compra»; en una línea con promoción o marcada, el cupón no descuenta (RQ-OFE-03-06) |
| CA-2 | un código ya canjeado | otro cliente lo escribe | ve «Este cupón ya se usó» (RQ-OFE-03-07) |
| CA-3 | un tope de 100 usos con 100 canjes | alguien lo escribe | ve «Se agotaron los usos» (RQ-OFE-03-08) |
| CA-4 | 5 códigos inválidos seguidos | el cliente intenta un sexto | el campo queda bloqueado 5 minutos (RQ-OFE-03-09) |

Origen: criterios de verificación de FT-OFE-03 (RQ-OFE-03-06, RQ-OFE-03-07, RQ-OFE-03-08, RQ-OFE-03-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-133) Código único al azar, un solo uso, vence a los N días; estados de emisión; bloqueo 5 intentos / 5 minutos.<br>**RB-02** (RN-CAP-134) Dos modos: código único en el comprobante o código compartido con tope.<br>**RB-03** (V11) Bloqueo de 5 intentos fallidos durante 5 minutos.<br>**RB-04** (DT-56) Cupón impreso de 1 a 3 por ticket, 15 días, un uso, para quien traiga el código; cupón de campaña con tope; uno por compra, sin puntos ni promociones.<br>**RNF aplicables:** RNF-CAP-010, RNF-CAP-009, RNF-CAP-014, RNF-CAP-019. | `Oferta` (tipo combo, lleva N paga M, descuento; vigencia: días, horas, fechas, canal, límite) · `DescuentoAutomatico` (alcance, porcentaje o monto, mínimo) · `ReglaAcumulacion` · `Cupon` (modo único o compartido, tope, por cliente) · `CuponEmitido` (código al azar, pedido, estado, vencimiento) · `IntentoCupon`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-113** (Imprimir cupones sorteados en el comprobante) va antes, dentro de la misma feature.<br>• FT-OFE-02.<br>• FT-PED-01.<br>• FT-CLI-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01, R-11 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Ofertas y descuentos ▸ Cupones, Cupones emitidos, historial; carta ▸ campo de cupón (`Admin.dc.html`, `Main.dc.html`); `analisis/cupones.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-OFE-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-OFE-03 (requerimientos RQ-OFE-03-06, RQ-OFE-03-07, RQ-OFE-03-08, RQ-OFE-03-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

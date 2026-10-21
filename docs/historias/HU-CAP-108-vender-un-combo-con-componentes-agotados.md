---
id: HU-CAP-108
tipo: hu
titulo: "Vender un combo con componentes agotados"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-012, FT-OFE-01, RQ-OFE-01-08, RQ-OFE-01-09, RQ-OFE-01-10, HU-CAP-105, HU-CAP-106, HU-CAP-107, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, DEP-02, DEP-06, R-01]
tags: [hu, ofertas, capa-a, ft-ofe-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-108 | Título | Vender un combo con componentes agotados |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-012 · FT-OFE-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | pedir un combo aunque uno de sus componentes esté agotado, eligiendo otro | pedir el combo aunque falte uno de sus componentes |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-OFE-01 «Combos y promociones» (Debería tener, épica EP-CAP-012). Cubre los requerimientos: **RQ-OFE-01-08** Al venderse, se registra el combo y cada parte se descuenta y va a su área. **RQ-OFE-01-09** Las ofertas se desactivan, se ordenan y no se eliminan. **RQ-OFE-01-10** El administrador ve una vista previa de cómo se verá la oferta en la carta. | **Alcance.**<br>• Al venderse, se registra el combo y cada parte se descuenta y va a su área.<br>• Las ofertas se desactivan, se ordenan y no se eliminan.<br>• El administrador ve una vista previa de cómo se verá la oferta en la carta. |
| **Problema.** Promociones que el dueño crea solo, y que cocina, stock e informes cuentan por producto y por combo. | **Fuera de alcance.**<br>• HU-CAP-105: Crear un combo con sus partes y precio por tamaño.<br>• HU-CAP-106: Crear una promoción «lleva N, paga M».<br>• HU-CAP-107: Definir la vigencia de una oferta.<br>• Descuentos automáticos: FT-OFE-02.<br>• Cupones: FT-OFE-03.<br>• Cómo la carta muestra el precio tachado: FT-CAR-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un combo vendido | pasa a cocina | cada parte va a su área y se descuenta por separado (FT-STK-03), y el informe cuenta el combo (RQ-OFE-01-08) |
| CA-2 | una oferta | el administrador la desactiva con Sí/No | deja de mostrarse y conserva sus ventas (RQ-OFE-01-09) |
| CA-3 | un combo nuevo | toca «Vista previa» | lo ve como tarjeta y ficha de la carta antes de publicarlo (RQ-OFE-01-10) |
| CA-4 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-OFE-01 (RQ-OFE-01-08, RQ-OFE-01-09, RQ-OFE-01-10); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-035) Los productos de un combo van a su área.<br>**RB-02** (RN-CAP-085 (2.ª)) Se descuenta cada producto del combo y se registra el combo; el nombre no repite un producto (id repetido, O1).<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-019, RNF-CAP-014. | `Oferta` (tipo combo, lleva N paga M, descuento; vigencia: días, horas, fechas, canal, límite) · `DescuentoAutomatico` (alcance, porcentaje o monto, mínimo) · `ReglaAcumulacion` · `Cupon` (modo único o compartido, tope, por cliente) · `CuponEmitido` (código al azar, pedido, estado, vencimiento) · `IntentoCupon`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-107** (Definir la vigencia de una oferta) va antes, dentro de la misma feature.<br>• FT-COC-01 · FT-STK-03.<br>• FT-CON-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Ofertas y descuentos ▸ Nueva oferta (combo, lleva N paga M), vigencia (`Admin.dc.html`); `analisis/combos-y-opciones.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-OFE-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-OFE-01 (requerimientos RQ-OFE-01-08, RQ-OFE-01-09, RQ-OFE-01-10, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

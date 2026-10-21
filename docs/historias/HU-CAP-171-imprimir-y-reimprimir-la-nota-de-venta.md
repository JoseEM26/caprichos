---
id: HU-CAP-171
tipo: hu
titulo: "Imprimir y reimprimir la nota de venta"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-020, FT-LEG-01, RQ-LEG-01-03, HU-CAP-170, HU-CAP-172, ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, DEP-02, DEP-06, R-01]
tags: [hu, legal, capa-a, ft-leg-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-171 | Título | Imprimir y reimprimir la nota de venta |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-020 · FT-LEG-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | imprimir y reimprimir la nota de venta | entregar la nota de venta y una copia si se pierde |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-LEG-01 «Comprobantes: nota de venta y datos de boleta o factura» (Debe tener, épica EP-CAP-020). Cubre el requerimiento: **RQ-LEG-01-03** La nota de venta lleva datos del local, detalle, medio de pago y cupones. | **Alcance.**<br>• La nota de venta lleva datos del local, detalle, medio de pago y cupones. |
| **Problema.** Cumplir con lo que el cliente pide sin integrar todavía la facturación electrónica. | **Fuera de alcance.**<br>• HU-CAP-170: Elegir el comprobante y sus datos.<br>• HU-CAP-172: Ver los comprobantes por emitir en el facturador.<br>• Emisión electrónica ante SUNAT (DT-11; horizonte futuro).<br>• Notas de crédito electrónicas. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un cobro con Yape | se imprime | muestra nombre y RUC del local, productos, total, «Yape» y los cupones sorteados (RQ-LEG-01-03) |

Origen: criterios de verificación de FT-LEG-01 (RQ-LEG-01-03); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-037) Comprobante por defecto: nota de venta.<br>**RB-02** (RN-CAP-099) Pendiente: emisión real de boleta y factura; el mockup solo recoge los datos.<br>**RB-03** (DT-11) La facturación electrónica queda fuera.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-008, RNF-CAP-014. | `Comprobante` (tipo nota, boleta o factura, número, DNI o RUC, razón social, por emitir) · `Reclamo` (datos del consumidor, detalle, pedido, número, plazo, respuesta) · `Aceptacion` (titular, texto aceptado, versión, fecha).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); montos en soles con dos decimales; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-170** (Elegir el comprobante y sus datos) va antes, dentro de la misma feature.<br>• FT-CFG-01 · FT-OFE-03.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ resumen (pedir factura); administrativo ▸ Cobrar, reimprimir (`Main.dc.html`, `Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-LEG-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-005.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-LEG-01 (requerimientos RQ-LEG-01-03, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)

---
id: FT-LEG-01
tipo: spec
titulo: "Comprobantes: nota de venta y datos de boleta o factura"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-020, FT-CAJ-02, FT-PED-01, FT-OFE-03, ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, NEC-CAP-031, NEC-CAP-089, RN-CAP-037, RN-CAP-099]
tags: [legal, plt-03, ep-cap-020, ft-leg-01, debe-tener]
---

# FT-LEG-01 — Comprobantes: nota de venta y datos de boleta o factura

**PLT-03 · Feature · Catálogo de requerimientos** · Frente LEGAL · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-LEG-01 | Comprobantes: nota de venta y datos de boleta o factura | EP-CAP-020 Comprobantes y obligaciones legales |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-031 · NEC-CAP-089) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El comprobante por defecto es **nota de venta**; en la carta el cliente elige solo **Boleta o Factura** (sin la opción «Sin comprobante», DT-77); la nota de venta es lo que imprime el local (NEC-CAP-031, RN-CAP-037). El sistema **recoge los datos** (DNI para boleta, RUC y razón social para factura) en la carta, en Nuevo pedido y en el cobro, pero **no emite** el comprobante electrónico ante SUNAT: se mantiene con el facturador actual (DT-11, D-07). La nota de venta se imprime con los datos del local, el detalle, el medio de pago y, abajo, los cupones sorteados (FT-OFE-03). Se puede reimprimir.

**Beneficio esperado.** Cumplir con lo que el cliente pide sin integrar todavía la facturación electrónica. Hipótesis medible: **100 % de pedidos con boleta o factura con sus datos completos para el facturador**.

**Usuarios / roles.** ACT-CAP-002 Cajero/a (elige e imprime el comprobante) · ACT-CAP-006 Clientes (pide boleta o factura).

**Pantallas de referencia.** Carta ▸ resumen (pedir factura); administrativo ▸ Cobrar, reimprimir (`Main.dc.html`, `Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-LEG-01-01 | El comprobante por defecto es nota de venta. | Debe tener | RN-CAP-037 | Dado un cobro sin cambios, cuando se imprime, entonces sale «Nota de venta» con su número correlativo. | Propuesto |
| RQ-LEG-01-02 | Para boleta se pide DNI y para factura RUC y razón social. | Debe tener | NEC-CAP-089 | Dado «Factura», cuando el cajero escribe un RUC de 10 dígitos, entonces no se acepta. | Propuesto |
| RQ-LEG-01-03 | La nota de venta lleva datos del local, detalle, medio de pago y cupones. | Debe tener | RN-CAP-059 · RN-CAP-069 | Dado un cobro con Yape, cuando se imprime, entonces muestra nombre y RUC del local, productos, total, «Yape» y los cupones sorteados. | Propuesto |
| RQ-LEG-01-04 | Un pedido con boleta o factura queda marcado «por emitir en el facturador». | Debe tener | DT-11 · D-07 | Dado un pedido con factura, cuando se cobra, entonces aparece en la lista «Por emitir» con los datos para copiarlos al facturador. | Propuesto |
| RQ-LEG-01-05 | El comprobante se reimprime marcado como copia. | Debe tener | Propuesta | Dado un cobro, cuando el cajero reimprime, entonces sale con «COPIA» y los mismos cupones. | Propuesto |

Prioridad por NEC-CAP-031 (E1). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-008 aplica al DNI de la boleta.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-037 | Comprobante por defecto: nota de venta. | Acta 02 |
| RN-CAP-099 | Pendiente: emisión real de boleta y factura; el mockup solo recoge los datos. | Legal |
| DT-11 | La facturación electrónica queda fuera. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-LEG-01-01 | HU-CAP-170 | — | R-01 |
| RQ-LEG-01-02 | HU-CAP-170 | — | R-01 |
| RQ-LEG-01-03 | HU-CAP-171 | FT-CFG-01 · FT-OFE-03 | R-01 |
| RQ-LEG-01-04 | HU-CAP-172 | D-07 · DEP-13 | R-01 |
| RQ-LEG-01-05 | HU-CAP-170 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-170 Elegir el comprobante y sus datos
- HU-CAP-171 Imprimir y reimprimir la nota de venta
- HU-CAP-172 Ver los comprobantes por emitir en el facturador

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-004, ADR-005.

**Fuera de alcance**

- Emisión electrónica ante SUNAT (DT-11; horizonte futuro).
- Notas de crédito electrónicas.

**Preguntas abiertas**

1. **¿La nota de venta es válida para el negocio?** Revisión con el contador (D-07).

---

Generado por IA: BRD (NEC-CAP-031, 089; RN-CAP-037, 059, 069, 099), DT-11 y D-07 — Revisado por: *(pendiente)*

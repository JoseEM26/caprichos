---
id: EP-CAP-020
tipo: spec
titulo: "EP-CAP-020 Comprobantes y obligaciones legales"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-031, NEC-CAP-089, RN-CAP-037, RN-CAP-071, RN-CAP-099]
tags: [epica, plt-02, g1, legal, debe-tener]
---

# EP-CAP-020 — Comprobantes y obligaciones legales

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-020 |
| NOMBRE | Comprobantes y obligaciones legales |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debe tener |
| HORIZONTE | Ahora |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

La carta propia tiene que cumplir con lo que exige la ley a un comercio en Perú: Libro de Reclamaciones, términos y condiciones, y tratamiento de datos personales. Además, el cliente puede pedir boleta o factura y hay que registrar sus datos aunque el sistema no la emita.

**Usuarios / segmentos**

- ACT-CAP-006: clientes que reclaman o piden comprobante
- ACT-CAP-002: cajero/a, que emite la nota de venta
- ACT-CAP-001: el dueño, que responde los reclamos

**Evidencia**

- NEC-CAP-031 y RN-CAP-037: nota de venta por defecto.
- NEC-CAP-089 y RN-CAP-099: Libro de Reclamaciones y datos de boleta o factura.
- RN-CAP-071: DNI como dato personal.
- DT-11: la facturación electrónica queda fuera.

**Alineamiento estratégico**

- Cumplimiento legal del negocio.
- D-18 Datos personales (Ley 29733).

## 2 OBJETIVOS

**Objetivo de negocio**

Operar la carta propia cumpliendo la ley y sin perder ventas que piden comprobante.

**Objetivo del usuario**

Que el cliente deje un reclamo o pida su boleta o factura sin salir de la carta.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Reclamos respondidos dentro del plazo legal | Por medir | 100 % (propuesta, D-06) | Libro de Reclamaciones | Mensual |
| Pedidos con pedido de comprobante sin datos completos | Por medir | Cero (propuesta) | Registro de pedidos | Mensual |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Nota de venta por defecto; boleta o factura solo a pedido, con DNI o RUC registrados (RN-CAP-037).
- Libro de Reclamaciones en la carta con DNI, domicilio y respuesta en el plazo legal (NEC-CAP-089).
- Términos y condiciones y política de privacidad visibles en la carta.
- Consentimiento para guardar datos personales; DNI enmascarado en listas (RN-CAP-071).

**Fuera de alcance (OUT)**

- Emisión electrónica de boleta o factura ante SUNAT (DT-11, D-07).
- Pago en línea con pasarela (DT-11).

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-LEG-01 | Comprobantes: nota de venta y datos de boleta o factura | Debe tener | Redactada en draft: [`FT-LEG-01-comprobantes-nota-de-venta-y-datos-de-boleta-o-factura.md`](../features/FT-LEG-01-comprobantes-nota-de-venta-y-datos-de-boleta-o-factura.md) |
| FT-LEG-02 | Libro de Reclamaciones, términos y privacidad | Debe tener | Redactada en draft: [`FT-LEG-02-libro-de-reclamaciones-terminos-y-privacidad.md`](../features/FT-LEG-02-libro-de-reclamaciones-terminos-y-privacidad.md) |

**Supuestos**

- El negocio mantiene su facturador actual para boletas y facturas (D-07).

**Restricciones**

- Los textos legales necesitan revisión legal antes de publicarse (D-06).
- El DNI se guarda solo con aceptación (RN-CAP-071).

**Dependencias y riesgos**

- DEP-09 Textos legales con revisión (D-06, D-18).
- DEP-13 Facturador electrónico (D-07).
- R-11 Datos personales.

**Criterios de éxito / salida**

- Un cliente registra un reclamo desde la carta y queda con su fecha y plazo de respuesta.
- Un pedido con boleta guarda el DNI enmascarado y la nota de venta sale por defecto.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §4 y §5 (NEC-CAP-031, NEC-CAP-089, RN-CAP-037, RN-CAP-071, RN-CAP-099) y `analisis/decisiones.md` (DT-11, D-06, D-07, D-18) — Revisado por: *(pendiente)*

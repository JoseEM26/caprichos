---
id: EP-CAP-012
tipo: spec
titulo: "EP-CAP-012 Promociones, descuentos y cupones"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-034, NEC-CAP-035, NEC-CAP-054, NEC-CAP-056, NEC-CAP-066, NEC-CAP-109, NEC-CAP-110, NEC-CAP-111]
tags: [epica, plt-02, g1, ofertas, deberia-tener]
---

# EP-CAP-012 — Promociones, descuentos y cupones

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-012 |
| NOMBRE | Promociones, descuentos y cupones |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debería tener |
| HORIZONTE | Siguiente |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Las promociones (Dúo, 2x1, Domingos de waffles, Happy hour) se aplican a criterio de quien cobra, sin reglas de días, horas ni canal. Los cupones son simples y se pueden adivinar o reusar.

**Usuarios / segmentos**

- ACT-CAP-001: el dueño, que arma las ofertas
- ACT-CAP-002: cajero/a y mozos, que las aplican
- ACT-CAP-006: clientes que las usan

**Evidencia**

- NEC-CAP-034, NEC-CAP-056, NEC-CAP-066 y NEC-CAP-109: combos y promociones a medida.
- NEC-CAP-110: descuentos automáticos por día y hora.
- NEC-CAP-035, NEC-CAP-054 y NEC-CAP-111: cupones seguros.
- `analisis/descuentos-y-promociones.md` y `analisis/cupones.md`.

**Alineamiento estratégico**

- Más ventas con reglas claras (BRD §4 Siguiente).
- D-10 Acumulación de beneficios.

## 2 OBJETIVOS

**Objetivo de negocio**

Vender más con promociones que se aplican solas y bien, sin pérdidas por cupones copiados.

**Objetivo del usuario**

Que el cliente vea la promoción que le aplica y que el cajero no tenga que calcularla.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Promociones aplicadas fuera de su vigencia | Por medir | Cero (RN-CAP-070) | Pedidos con promoción | Semanal |
| Cupones canjeados más de una vez | Por medir | Cero (RN-CAP-133) | Registro de cupones | Mensual |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Combos armados por el dueño con partes a elección; cada producto se descuenta por separado (NEC-CAP-066).
- Promociones «lleva N, paga M» a medida con contenido limitado (NEC-CAP-109).
- Descuentos automáticos por día, hora, fecha y canal (RN-CAP-132).
- Regla de acumulación: si no acumula, se aplica solo el beneficio mayor (D-10).
- Cupones de código único al azar y de un solo uso en el comprobante, y cupones compartidos con tope (RN-CAP-133 a RN-CAP-135).
- Aviso de promoción aplicable en la carta, Nuevo pedido y chatbot.

**Fuera de alcance (OUT)**

- Programa de puntos: EP-CAP-003.
- Precios dinámicos por demanda.

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-OFE-01 | Combos y promociones | Debería tener | Redactada en draft: [`FT-OFE-01-combos-y-promociones.md`](../features/FT-OFE-01-combos-y-promociones.md) |
| FT-OFE-02 | Descuentos automáticos y acumulación | Debería tener | Redactada en draft: [`FT-OFE-02-descuentos-automaticos-y-acumulacion.md`](../features/FT-OFE-02-descuentos-automaticos-y-acumulacion.md) |
| FT-OFE-03 | Cupones | Debería tener | Redactada en draft: [`FT-OFE-03-cupones.md`](../features/FT-OFE-03-cupones.md) |

**Supuestos**

- Las promociones vigentes se confirman con el dueño (D-15).

**Restricciones**

- Las ofertas las edita solo el administrador (RN-CAP-094).
- Horario: desde inclusiva, hasta exclusiva; fechas inclusivas (RN-CAP-132).

**Dependencias y riesgos**

- D-10 Acumulación.
- D-15 Promociones vigentes.

**Criterios de éxito / salida**

- Un 2x1 se aplica solo en su día y hora, en la carta, en Nuevo pedido y en el chatbot.
- Un cupón de código único no se puede canjear dos veces.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §5 (NEC-CAP-034, NEC-CAP-035, NEC-CAP-054, NEC-CAP-056, NEC-CAP-066, NEC-CAP-109 a NEC-CAP-111, RN-CAP-070, RN-CAP-094, RN-CAP-132 a RN-CAP-135), `analisis/descuentos-y-promociones.md` y `analisis/cupones.md` — Revisado por: *(pendiente)*

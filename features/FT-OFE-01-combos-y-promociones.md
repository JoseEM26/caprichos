---
id: FT-OFE-01
tipo: spec
titulo: "Combos y promociones"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-012, FT-OFE-02, FT-OFE-03, FT-CAR-01, FT-COC-01, FT-STK-03, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, NEC-CAP-034, NEC-CAP-056, NEC-CAP-066, NEC-CAP-068, NEC-CAP-109, RN-CAP-034]
tags: [ofertas, plt-03, ep-cap-012, ft-ofe-01, deberia-tener]
---

# FT-OFE-01 — Combos y promociones

**PLT-03 · Feature · Catálogo de requerimientos** · Frente OFERTAS · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-OFE-01 | Combos y promociones | EP-CAP-012 Promociones, descuentos y cupones |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-034 · NEC-CAP-066 · NEC-CAP-068) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El administrador arma las ofertas desde **un solo botón** en Ofertas y descuentos (NEC-CAP-068), sin programador. Un **combo** tiene nombre, precio por tamaño y las **partes** que lleva: productos a elección de unas categorías, una opción entre varias o un producto fijo (NEC-CAP-066). Las promociones **«lleva N, paga M»** (2x1, 3x2, 5x4…) se arman a medida, con su contenido limitado, y se aplican como descuento (NEC-CAP-109). Todas comparten una **vigencia opcional**: días, horas, fechas, canal y límite; fuera de su vigencia no se ofrecen ni en la carta ni en Nuevo pedido (RN-CAP-070). Un combo **sigue a la venta aunque falte un componente**: se elige otro de la misma categoría (RN-CAP-034, RN-CAP-055). Al venderse, se registra el combo y se descuenta cada producto por separado (RN-CAP-085 2.ª); sus partes van a cada área de cocina (RN-CAP-035). El nombre de un combo no repite el de un producto.

**Beneficio esperado.** Promociones que el dueño crea solo, y que cocina, stock e informes cuentan por producto y por combo. Hipótesis medible: **100 % de los combos vendidos con cada parte descontada y enviada a su área**.

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (crea y edita ofertas) · ACT-CAP-006 Clientes (las ven y piden).

**Pantallas de referencia.** Administrativo ▸ Ofertas y descuentos ▸ Nueva oferta (combo, lleva N paga M), vigencia (`Admin.dc.html`); `analisis/combos-y-opciones.md` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-OFE-01-01 | El administrador crea un combo con nombre, precio por tamaño y partes. | Debería tener | NEC-CAP-066 | Dado el formulario, cuando crea «Dúo Frappé» con 2 frappés a elección y precio regular S/ 22 y grande S/ 26, entonces el combo queda guardado inactivo hasta publicarlo. | Propuesto |
| RQ-OFE-01-02 | Una parte puede ser productos a elección de categorías, una opción entre varias o un producto fijo. | Debería tener | NEC-CAP-066 | Dado un combo, cuando una parte es «1 postre de la categoría Postres» y otra «Americano fijo», entonces la carta pide elegir el postre y el Americano viene incluido. | Propuesto |
| RQ-OFE-01-03 | El nombre de un combo no puede repetir el de un producto. | Debería tener | RN-CAP-085 (2.ª) | Dado el producto «Frappé Oreo», cuando se intenta crear un combo con ese nombre, entonces no se acepta. | Propuesto |
| RQ-OFE-01-04 | Se crea una promoción «lleva N, paga M» con su contenido limitado. | Debería tener | NEC-CAP-109 | Dada una 3x2 en donas, cuando el cliente lleva 3 donas, entonces se descuenta la más barata; con 2 donas no aplica y se avisa «Lleva 1 más y paga 2». | Propuesto |
| RQ-OFE-01-05 | Las ofertas comparten una vigencia opcional: días, horas, fechas, canal y límite. | Debería tener | NEC-CAP-068 · RN-CAP-070 | Dado un combo vigente de lunes a viernes de 15:00 a 18:00 solo en la carta, cuando un cliente lo busca un sábado o en el chatbot, entonces no aparece. | Propuesto |
| RQ-OFE-01-06 | Un combo fuera de su vigencia no se ofrece en la carta ni en Nuevo pedido. | Debería tener | NEC-CAP-068 | Dado un combo cuya fecha terminó ayer, cuando el cajero abre Nuevo pedido, entonces no aparece. | Propuesto |
| RQ-OFE-01-07 | Un combo sigue a la venta si falta un componente: se elige otro de la misma categoría. | Debería tener | RN-CAP-034 · RN-CAP-055 | Dado un combo con el postre «Brownie» agotado, cuando el cliente lo arma, entonces el brownie aparece apagado y puede elegir otro postre de la categoría. | Propuesto |
| RQ-OFE-01-08 | Al venderse, se registra el combo y cada parte se descuenta y va a su área. | Debería tener | RN-CAP-085 (2.ª) · RN-CAP-035 | Dado un combo vendido, cuando pasa a cocina, entonces cada parte va a su área y se descuenta por separado (FT-STK-03), y el informe cuenta el combo. | Propuesto |
| RQ-OFE-01-09 | Las ofertas se desactivan, se ordenan y no se eliminan. | Debería tener | RN-CAP-014 | Dada una oferta, cuando el administrador la desactiva con Sí/No, entonces deja de mostrarse y conserva sus ventas. | Propuesto |
| RQ-OFE-01-10 | El administrador ve una vista previa de cómo se verá la oferta en la carta. | Podría tener | NEC-CAP-011 | Dado un combo nuevo, cuando toca «Vista previa», entonces lo ve como tarjeta y ficha de la carta antes de publicarlo. | Propuesto |

Prioridad *Debería tener* por la épica; los combos básicos de la carta oficial (Dúo) ya se muestran en la fase Ahora con FT-CAR-01. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-019 | Hora local | Horarios, vigencias, «agotado por hoy» y cierres usan la hora de Lima. | Zona America/Lima · 0 cambios de día fuera de las 00:00 locales (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-019 aplica a la vigencia por días y horas.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-034 | Un combo sigue a la venta aunque falte un complemento. | Acta 02 |
| RN-CAP-035 | Los productos de un combo van a su área. | Acta 02 |
| RN-CAP-055 | Si falta un componente, se elige otro de la misma categoría. | Acta 02 |
| RN-CAP-070 | Una promoción vale solo en sus días, horas, fechas y canales. | Pedido del 17/10 |
| RN-CAP-085 (2.ª) | Se descuenta cada producto del combo y se registra el combo; el nombre no repite un producto (id repetido, O1). | Reunión del 18/10 |
| RN-CAP-128 | En las promociones el nombre se sugiere a partir de sus componentes. | Productos, Ofertas |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-OFE-01-01 | HU-CAP-105 | — | R-01 |
| RQ-OFE-01-02 | HU-CAP-105 | — | R-01 |
| RQ-OFE-01-03 | HU-CAP-105 | — | R-01 |
| RQ-OFE-01-04 | HU-CAP-106 | — | R-01 |
| RQ-OFE-01-05 | HU-CAP-107 | — | R-01 |
| RQ-OFE-01-06 | HU-CAP-107 | — | R-01 |
| RQ-OFE-01-07 | HU-CAP-106 | FT-COC-03 | R-01 |
| RQ-OFE-01-08 | HU-CAP-108 | FT-COC-01 · FT-STK-03 | R-01 |
| RQ-OFE-01-09 | HU-CAP-108 | — | R-01 |
| RQ-OFE-01-10 | HU-CAP-108 | FT-CON-02 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-105 Crear un combo con sus partes y precio por tamaño
- HU-CAP-106 Crear una promoción «lleva N, paga M»
- HU-CAP-107 Definir la vigencia de una oferta
- HU-CAP-108 Vender un combo con componentes agotados

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.

**Fuera de alcance**

- Descuentos automáticos: FT-OFE-02.
- Cupones: FT-OFE-03.
- Cómo la carta muestra el precio tachado: FT-CAR-01.

**Preguntas abiertas**

1. **¿Una promoción se acumula con descuentos y cupones?** — D-10. Propuesta: no acumula por defecto.

---

Generado por IA: BRD (NEC-CAP-011, 034, 056, 066, 068, 109; RN-CAP-014, 034, 035, 055, 070, 085, 128), `analisis/combos-y-opciones.md` y el mockup de Ofertas — Revisado por: *(pendiente)*

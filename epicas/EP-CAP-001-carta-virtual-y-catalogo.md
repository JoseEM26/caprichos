---
id: EP-CAP-001
tipo: spec
titulo: "EP-CAP-001 Carta virtual y catálogo"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-006, NEC-CAP-032, NEC-CAP-033, NEC-CAP-039, NEC-CAP-084, NEC-CAP-085]
tags: [epica, plt-02, g1, carta, debe-tener]
---

# EP-CAP-001 — Carta virtual y catálogo

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-001 |
| NOMBRE | Carta virtual y catálogo |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debe tener |
| HORIZONTE | Ahora |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

La carta digital anterior (OlaClick) tiene el plan vencido, es de solo lectura y no se conecta con el stock ni con caja. Los clientes ven precios y productos que pueden no estar vigentes y no saben si el local está abierto. Caprichos necesita una carta propia, vigente, con sus promociones y con la disponibilidad real.

**Usuarios / segmentos**

- ACT-CAP-006: clientes que piden desde el celular o la computadora, incluidas personas mayores
- ACT-CAP-001: el dueño, que quiere mostrar la carta oficial con sus promociones

**Evidencia**

- BRD §1 y §4 «Carta virtual» (NEC-CAP-006, NEC-CAP-084, NEC-CAP-085).
- Acta 02: estrellas para los más comprados del mes (NEC-CAP-032) y página «Conócenos» (NEC-CAP-033).
- `recursos/carta-completa.md`: carta oficial con 64 productos.
- Mockup navegable: pantalla Carta (`Main.dc.html`).

**Alineamiento estratégico**

- OBJ-CAP-002 No vender lo que no hay (la carta solo ofrece lo disponible).
- NEC-CAP-006 Carta digital propia, vigente y con promociones.

## 2 OBJETIVOS

**Objetivo de negocio**

Tener un canal de venta propio, sin costo de plataforma de terceros, que muestre siempre la carta oficial y lo que hay disponible.

**Objetivo del usuario**

Que el cliente encuentre rápido lo que quiere, vea el precio final con sus opciones y sepa si el local está abierto.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Productos de la carta que coinciden con la carta oficial | Por medir | 100 % (propuesta) | Comparación contra `recursos/carta-completa.md` | En cada cambio de carta |
| Pedidos que incluyen un producto agotado | Por medir | Cero (OBJ-CAP-002) | Registro de pedidos y de disponibilidad | Diaria |
| Pedidos recibidos fuera de horario | Por medir | Cero (propuesta) | Registro de pedidos | Semanal |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Catálogo por categorías con buscador, sin filtros ni paginación (RN-CAP-051).
- Producto con tamaños y grupos de opciones con obligatorio, mínimo, máximo y precio extra (RN-CAP-004).
- Toppings secos a S/ 1 y aviso de hielo en los frappés (NEC-CAP-084).
- Precio anterior tachado y porcentaje de descuento en promociones (RN-CAP-007).
- Ocultar lo agotado y no recibir pedidos fuera de horario, en feriado cerrado o en pausa (NEC-CAP-085).
- Estrellas para los más comprados del mes, con historial mensual (NEC-CAP-032).
- Página «Conócenos» y formulario «¿Cómo te fue?» con pie de contacto (NEC-CAP-033, NEC-CAP-039).

**Fuera de alcance (OUT)**

- El carrito, la modalidad y el envío del pedido: EP-CAP-002.
- Cómo el administrador ordena y decora la carta: EP-CAP-016.
- Cuenta del cliente y puntos: EP-CAP-003.
- Filtros por rango de precio y reseñas públicas (descartados, DT-13).

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-CAR-01 | Catálogo por categorías con tamaños y opciones | Debe tener | Redactada en draft: [`FT-CAR-01-catalogo-por-categorias-con-tamanos-y-opciones.md`](../features/FT-CAR-01-catalogo-por-categorias-con-tamanos-y-opciones.md) |
| FT-CAR-02 | Disponibilidad en la carta: agotados, horario y pausa | Debe tener | Redactada en draft: [`FT-CAR-02-disponibilidad-en-la-carta-agotados-horario-y-pausa.md`](../features/FT-CAR-02-disponibilidad-en-la-carta-agotados-horario-y-pausa.md) |
| FT-CAR-03 | Más vendidos, Conócenos y opinión del cliente | Debería tener | Redactada en draft: [`FT-CAR-03-mas-vendidos-conocenos-y-opinion-del-cliente.md`](../features/FT-CAR-03-mas-vendidos-conocenos-y-opinion-del-cliente.md) |

**Supuestos**

- Los precios vigentes son los de la carta oficial (RN-CAP-006).
- La carta se usa sobre todo desde el celular.

**Restricciones**

- Moneda en soles y un solo local (RN-CAP-038).
- La carta no pide fecha: todo es para el mismo día (A1).

**Dependencias y riesgos**

- DEP-05 Carta validada y fotos (D-15).
- DEP-04 Horario real del local (D-04).
- R-03 Precios y reglas desactualizados.

**Criterios de éxito / salida**

- Un cliente encuentra cualquier producto en menos de tres toques y ve su precio final con las opciones elegidas.
- Un producto agotado o fuera de horario no se puede pedir.
- La carta coincide con la carta oficial en una revisión completa.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §4 y §5 (RN-CAP-004, RN-CAP-006, RN-CAP-007, RN-CAP-051), acta 02, `recursos/carta-completa.md` y el mockup de la carta — Revisado por: *(pendiente)*

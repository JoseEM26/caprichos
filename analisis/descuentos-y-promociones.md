---
id: FLU-CAP-006
tipo: analisis
titulo: Descuentos automáticos y promociones: cómo se aplican, cuándo valen y cómo se probaron
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza (desarrollo); validación pendiente de Kevin Rosales"
aprobadores: []
fecha: 2026-10-19
relacionados: [BRD-CAP-001, REG-CAP-001]
tags: [descuentos, promociones, horarios, happy-hour, mockup, v175]
---

# Descuentos automáticos y promociones

> Revisión del 19/10/2026 a pedido del dueño: comprobar que los descuentos (por ejemplo «Domingos de waffles» y «Happy hour») valgan **solo** en sus días y horas, y dejar la regla documentada. Qué se probó y qué se corrigió está al final.

## 1. Qué es cada cosa

| Pieza | Qué hace | Dónde se crea |
|---|---|---|
| **Descuento automático** | Un % o un monto que se resta solo, sin código, cuando el pedido cumple sus condiciones. | Ofertas y descuentos ▸ Descuentos |
| **Promoción «lleva N, paga M»** (2x1, 3x2, 5x4…) | Dos o más productos a un precio especial; se ofrece y el cliente o el personal la acepta. | Ofertas y descuentos ▸ Promociones |
| **Combo** | Un producto armado (varias partes) con su precio por tamaño. | Ofertas y descuentos ▸ Combos |
| **Cupón** | Un código que el cliente escribe; no se junta con lo demás por defecto. | Ofertas y descuentos ▸ Cupones |

## 2. Cuándo vale un descuento o una promoción

Un descuento vale **solo si cumple todo** lo siguiente al momento de armar el pedido:

| Condición | Regla |
|---|---|
| **Activo** | Está encendido (no «Desactivado»). |
| **Fechas** | «Vigente desde» y «Hasta» son **inclusivos**: el último día todavía vale. Vacío = sin límite. |
| **Días** | Solo los días marcados (lun a dom). Vacío = todos los días. |
| **Horas** | «Desde la hora» **inclusiva** y «Hasta la hora» **exclusiva**: 15:00 a 17:00 vale a las 15:00 y a las 16:59, **no** a las 17:00. Vacío = todo el día. Se piden las dos horas o ninguna, y la inicial debe ser antes de la final (un horario que cruza la medianoche, como 22:00 a 02:00, no se puede crear hoy). |
| **Canal** | Todos, carta web, en el local o WhatsApp. En Nuevo pedido, «en el local» es el canal local y «para llevar»/delivery cuenta como WhatsApp; en el chatbot es WhatsApp. |
| **Compra mínima** | El pedido debe llegar a ese monto (antes de descontar). |
| **A qué aplica** | Toda la carta, una categoría o un producto. El descuento se calcula **solo sobre las líneas que corresponden** (por ejemplo, «Domingos de waffles» solo descuenta los waffles, no el café que va en el mismo pedido). Un monto fijo nunca pasa del valor de esa base. |

Si hay varios descuentos vigentes, se aplica **solo el mejor** (el de mayor valor), no se suman entre sí.

## 3. Los dos ejemplos que trae la maqueta

| Descuento | Regla | Ejemplo |
|---|---|---|
| **Domingos de waffles** | 10 % en la categoría Waffles, solo domingos, del 01/10/2026 al 31/12/2026. | Domingo, WAFFLE OREO s/ 21 + FRAPPE OREO s/ 14.50: descuenta **s/ 2.10** (10 % del waffle); el frappé no cuenta. |
| **Happy hour de la tarde** | 15 % en toda la carta, lunes a viernes, de 15:00 a 17:00, mismas fechas. | Lunes 15:00, mismo pedido (s/ 35.50): descuenta **s/ 5.33**. A las 14:59 o a las 17:00, no. Sábado y domingo no. |

## 4. Dónde se aplican

| Canal | ¿Aplica descuentos automáticos? | ¿Ofrece promociones «lleva N, paga M»? |
|---|---|---|
| Carta virtual | Sí (canal web) | Sí, con aviso y botón |
| Nuevo pedido (mozo, caja, call center) | Sí | Sí, con aviso y botón |
| Chatbot de WhatsApp | **Sí (desde v175)** | Sí, con botones Sí / No |

- **Acumulación** (Ofertas ▸ Reglas «¿Se pueden juntar?»): con «No» (valor por defecto), entre la promoción, el descuento automático y el cupón se aplica solo el de mayor valor; con «Sí», se suman.
- Los **adicionales** (shots, siropes, helado) no se rebajan con una promoción «lleva N, paga M»: se descuenta la diferencia de los precios base y los adicionales se cobran aparte.
- Un **cupón** es solo de la carta y de Nuevo pedido; el chatbot no pide cupones (una persona confirma el pedido).

## 5. Cómo se probó (19/10/2026)

Con el reloj de la maqueta simulado en cada caso, sobre un pedido de WAFFLE s/ 21 + frappé s/ 14.50:

| Caso | Nuevo pedido | Carta | Chatbot |
|---|---|---|---|
| Domingo 18/10 12:00 | Domingos de waffles −2.10 | igual | igual |
| Lunes 12:00 | sin descuento | igual | igual |
| Lunes 14:59 | sin descuento | igual | igual |
| Lunes 15:00 | Happy hour −5.33 | igual | −4.95 (pedido de s/ 33) |
| Lunes 16:59 | Happy hour | igual | — |
| Lunes 17:00 | sin descuento | igual | igual |
| Sábado 15:30 | sin descuento | igual | igual |
| Domingo 15:30 | solo Domingos de waffles | igual | igual |
| Viernes 25/09 (antes de la vigencia) | sin descuento | igual | — |
| Jueves 31/12 16:00 (último día) | Happy hour | igual | — |
| Viernes 01/01/2027 (vencido) | sin descuento | igual | igual |

También en Nuevo pedido: descuento apagado, canal que no corresponde (web, local, WhatsApp), compra mínima (arriba y abajo del monto), por producto (y producto ausente), monto fijo (con tope), dos descuentos a la vez (gana el mayor) y días de la semana. En todos los casos el resultado fue el esperado.

## 6. Qué se corrigió en esta revisión

1. **El chatbot no aplicaba descuentos automáticos.** Un descuento configurado para WhatsApp (o para todos los canales) nunca llegaba a quien pedía por el bot. Ahora el resumen del bot lo incluye como una línea («Descuento Happy hour de la tarde — −s/ 4.95») y suma bien el total, respetando la regla de acumulación con las promociones.
2. **La fecha de un cupón en Nuevo pedido estaba fija** en 15/10/2026, mientras que la carta usa la fecha real; ahora ambas usan la fecha real.
3. El mensaje al guardar un descuento decía «solo en la carta»; ahora dice que vale en la carta, en Nuevo pedido y en el chatbot.

## 7. Limitaciones aceptadas (decisión del dueño, 19/10/2026)

Se aceptan tal como están para la maqueta; no se agregan ni el reloj de prueba ni los horarios nocturnos. Quedan documentadas para el sistema real:

- Un horario que cruza la medianoche (por ejemplo 22:00 a 02:00) no se puede crear: hay que usar dos descuentos o dejarlo para el sistema real.
- Solo un rango de horas por descuento (no «mañana y noche»).
- El reloj usado es el del equipo de quien abre la maqueta; no hay un reloj de prueba. Para ver «Domingos de waffles» o «Happy hour» en pantalla hay que abrirla en ese día y hora (se puede añadir un reloj de prueba si se necesita).
- El chatbot usa los mismos descuentos que se guardan en el administrativo, pero sus productos y precios son una copia aparte (ver el registro).

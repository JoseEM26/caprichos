---
id: ANA-CAP-027
tipo: analisis
titulo: "Compras, proveedores e insumos (almacén, v106)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-19
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, analisis]
---

# Compras, proveedores e insumos (almacén, v106)

Parte de la Prioridad 1 de `almacen-informes/README.md` y de la iniciativa del acta 02 "Catálogo de proveedores A, B, C" y "pedidos centrados en el insumo".

## Qué hace
- **Compras:** lista del historial (filtro por proveedor), detalle con líneas, lote y vencimiento. Estados: Pendiente, Recibida, Pagada, Anulada.
- **Registrar compra:** proveedor, fecha, comprobante, contado o crédito (días), insumos con cantidad en la unidad de compra o de almacén, costo, lote y vencimiento. Se confirma con Sí/No; al confirmar sube el stock, queda una entrada "Proveedor" en Almacén y el lote en la ficha del insumo.
- **Proveedores:** directorio (RUC de 11 dígitos opcional, WhatsApp, contacto, crédito, cuenta), historial de compras, últimos precios, qué insumos provee (A/B/C), por pagar. Se desactivan; no se eliminan.
- **Ficha del insumo** (botón en Stock): unidades y equivalencias, mínimo/intermedio/máximo, si vence, proveedores A/B/C del directorio, lotes y últimos precios. **Nuevo insumo** desde Stock.
- **Stock:** muestra el próximo vencimiento; la orden de compra usa el proveedor A y abre su WhatsApp.

## Reglas
RN-CAP-081, 082 y 083 del BRD (necesidades NEC-CAP-069 a 071).

## Qué no se probó / límites
- Nunca se abrió el artifact en un navegador; se probó la lógica con un arnés (registrar compra, validaciones, proveedor, ficha, orden de compra).
- Los datos de proveedores y compras son de ejemplo; los números de WhatsApp, inventados.
- Compras e insumos de restaurant.pe no se vieron en pantalla real (solo documentos).
- Pendientes: recetas editables, kardex con costo promedio, mermas valoradas, arqueo, requerimientos y recepción contra la orden, varios almacenes.
- Preguntas para Kevin: lote y vencimiento solo en perecibles o en todo; costo promedio o última compra; quién registra compras.

## Revisión y ajuste del 19/10/2026 (v180): del pedido al pago

**Decisión.** El pedido a proveedores vive en **Compras** (es una acción de compra), con atajos desde Almacén y Stock y recetas.

### El camino de una compra

1. **Pedir** (Compras ▸ «Pedir a proveedores»): se traen los insumos bajo el mínimo (opcionalmente también los «regular»), cada uno con el proveedor A asignado y la cantidad para llenar el almacén, redondeada a **cajas o sacos enteros**.
2. **Enviar**: un mensaje de WhatsApp **por proveedor**, con sus insumos y cantidades («• 2 × Caja 12 L de Leche sin lactosa (24 L)»). Al enviarlo se crea un pedido **«Por recibir»** en Compras (sin costo todavía).
3. **Recibir**: cuando llega, en el detalle del pedido se toca «Recibir y registrar costos»; se abre el registro de compra con el proveedor y las líneas ya puestas; se completan costos, vencimientos y comprobante. Al guardar, **sube el stock**, queda la **entrada en Almacén** y el pedido pasa a «Recibida» (no se duplica).
4. **Pagar**: si fue a crédito, «Marcar como pagada».

### Qué hace la lista de pedido (ajustada el mismo día)

- **Un proveedor a la vez en pantalla, sin lista interminable**: arriba hay una **fila de proveedores** (con cuántos insumos lleva cada uno) y se muestra **solo el pedido del proveedor elegido**, con sus insumos en una cuadrícula. Así la pantalla no crece sin límite aunque haya 8 proveedores.
- **Un insumo se pide a un solo proveedor por vez** (decisión del dueño, 19/10/2026): no se reparte «mitad y mitad». En cada línea, «Proveedor de este pedido» muestra los proveedores A, B y C del insumo; elegir otro **mueve** el insumo al pedido de ese proveedor (no se suma). Otro día, en otro pedido, se puede usar otro proveedor. Si el insumo ya tiene un pedido **«Por recibir»**, la línea avisa («ya hay un pedido por recibir de este insumo: espera a que llegue o anúlalo»).
- Al **enviar** a un proveedor, solo se quitan **sus** líneas de la lista; lo que falta pedirle a otros sigue ahí.


- **Traer lo que falta**; **agregar** cualquier otro insumo; **quitar** o **descartar un grupo**; **cambiar la cantidad** con − / +; **cambiar de proveedor** (A, B o C del insumo) por línea.
- Si un proveedor **no tiene WhatsApp** (Macro, Mercado de frutas, Productor local), se ofrece **Copiar mensaje** y «Ya lo pedí (registrar)».
- Si un insumo no tiene proveedor, se agrupa aparte («Sin proveedor asignado») para elegirlo.
- La lista se guarda (no se pierde al cambiar de pantalla).
- Desde **Almacén** (botón «Stock bajo (N) · pedir a proveedores») y **Stock y recetas** («Pedir lo que falta a los proveedores» y, por insumo, «Agregar a pedir a proveedores») se llena la lista y se abre esa pantalla.

### Hallazgos de la revisión y qué se corrigió

| Hallazgo | Corrección |
|---|---|
| El estado «Pendiente» (por recibir) existía en los datos de ejemplo pero **ningún flujo lo creaba ni lo cerraba**; el indicador «Compras por recibir» nunca podía cambiar. | Ahora el pedido por WhatsApp lo crea y «Recibir» lo cierra. |
| Cada compra nueva tenía **fecha fija 15/10**. | Usa la fecha de hoy. |
| Numeración mezclada (`OC-211` de ejemplo y `C-0009` las nuevas). | Todas siguen la serie `OC-nnn`. |
| El pedido por WhatsApp de Stock iba **solo a un insumo** y la orden «de todo lo bajo» juntaba proveedores en **un solo mensaje**. | Un mensaje por proveedor. |
| Errores de diseño: **estilos rotos** (faltaba un punto y coma en 6 lugares: espacios y alineación se perdían) y tarjetas de compras en una sola columna. | Corregidos; compras en cuadrícula y cifras arriba (por recibir, por pagar, comprado en el mes, lista para pedir). |
| Un pedido por recibir no se podía cancelar si tenía líneas. | Se puede anular (no llegó nada, el stock no cambia). |

### Límites y pendientes

- Los proveedores de ejemplo no tienen RUC.
- El pedido no calcula costo: el costo se conoce al recibir.
- No hay envío automático: el mensaje se abre en WhatsApp y la persona lo envía.
- «Compra directa» (mercado) sigue registrándose con «+ Registrar compra».

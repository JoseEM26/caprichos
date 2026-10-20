---
id: FLU-CAP-004
tipo: analisis
titulo: Flujos de cocina y almacén: movimientos, mermas, producción, cierre del día y stock
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza (desarrollo); validación pendiente de Kevin Rosales"
aprobadores: []
fecha: 2026-10-19
relacionados: [BRD-CAP-001, REG-CAP-001, FLU-CAP-002, FLU-CAP-003]
tags: [cocina, almacen, merma, produccion, stock, mockup, v137-v144]
---

# Flujos de cocina y almacén

> Documento de trabajo. Describe lo que hace hoy el **mockup** (v137 a v144) y lo que se propone para el sistema real. Todo se probó solo con pruebas automáticas del mockup, nunca abierto en un navegador real. Por validar con Kevin Rosales.

## 1. Idea central: dos pantallas, dos responsabilidades

**Cocina gestiona lo que se cocina; Almacén gestiona con lo que se cocina.** La separación es por **pantalla**, no por rol: un administrador que entra a Cocina ve lo de cocina, y si entra a Almacén ve lo de almacén.

| | Cocina | Almacén |
|---|---|---|
| Qué maneja | Productos de cocina: donas, galletas choco chips, pan pullman, gelatina (y empanadas u otros que se agreguen como producto de producción) | Insumos con los que se prepara: leche, azúcar, harina, huevos, pollo, café, etc. |
| Movimientos que registra | **Solo merma** | Entrada, Salida, Merma y Devolución |
| Origen posible | Cocina, Barra o Producción | Entrada: Proveedor · Salida: Almacén central · Merma: Almacén central, Cocina, Barra o Producción · Devolución: Cocina, Barra o Producción |
| Cantidad | Solo números; no puede pasar del stock | Igual |
| Qué lista | Solo productos que existen y **tienen stock** | Solo insumos que existen y **tienen stock** (Entrada ofrece todos) |

Ejemplos: las donas que sobran son merma de **Cocina**; el pollo que se malogró es merma de **Almacén**; una compra a un proveedor es entrada de **Almacén**.

**Limitación:** los insumos todavía no tienen un área asignada (cocina, barra, almacén). El criterio de cocina es «producto de producción del día». La merma de barra (por ejemplo calibrar café) quedaría en Almacén hasta que cada insumo tenga su área.

## 2. Registrar un movimiento (merma, entrada, salida, devolución)

1. Se elige el **tipo** (en Cocina solo Merma).
2. Se elige el **producto o insumo**: la lista muestra solo lo que tiene stock, con su stock actual (por ejemplo «Leche entera · 18 L»). El botón **«Mostrar también los de stock 0 (N)»** los muestra todos; otro botón los oculta. En una **Entrada** se muestran todos, porque lo que llega puede venir de stock cero.
3. Se escribe la **cantidad** (solo números; las letras se descartan; punto o coma decimal). No puede pasar del stock.
4. Se elige el **origen** según el tipo (tabla de arriba) y, en merma, el **destino**: Donación, Personal, Desecho, Caída, Error de comanda o Calibración.
5. Confirma con Sí: se descuenta o suma el stock y queda el movimiento con su documento (MER-, SAL-, DEV-, ENT-).

**Devolución:** solo en Almacén, para cuando regresa un sobrante y alguien decide anotarlo. El caso «pidió 10 huevos y usó 5» **no lo controla el sistema**: no tiene forma de verlo.

## 3. Merma de varios productos a la vez

Botón **«Merma de varios productos»** en Cocina y en Almacén (mismas reglas de pantalla):
- Una lista con todos los productos con stock. En cada línea: la **cantidad** (o **Todo**), el **origen** (se cambia con un toque) y el **destino** propio.
- Arriba se elige **qué se hace con todo** (por defecto Desecho); cada línea puede cambiarlo (se resalta).
- **Todo lo que hay** llena todas las líneas; **Limpiar** las vacía.
- Resumen («3 productos · 30 unidades») y confirmación; se registra **un movimiento de merma por línea** y se descuenta el stock. No deja botar más de lo que hay.

Ejemplo: todas las donas (24) a Donación, 5 galletas desde la Barra a Donación y 1 pan pullman a Personal en una sola operación.

## 4. Registrar la producción

1. Se elige qué se hizo (donas, galletas, pan pullman, gelatina) y las **tandas**.
2. El sistema calcula la **materia prima** que se descuenta y cuántas unidades entran al stock (se puede corregir el total que salió).
3. **Validación de stock:** si una receta pide más de lo que hay, esa línea sale en **rojo** con «FALTAN N», aparece un aviso con lo que falta y cuántas tandas **sí alcanzan**, y un botón **«Usar N tandas (lo máximo que alcanza)»**. **No se puede registrar** y el stock **nunca queda en negativo**.
4. Tandas y cantidad total solo aceptan números.
5. Al registrar: salen las materias primas de Almacén (movimientos de Salida PRD-) y entra el producto terminado.

## 5. Cerrar el día con conteo

Lista **todos los productos del día con stock** (donas primero, luego galletas, pan pullman, gelatina). Por cada uno:
- **Contado:** lo que se contó de verdad (por defecto, lo del sistema; no puede ser más que el sistema: si hay más, se registra una entrada).
- **Botar:** cuánto se bota (botón **Todo**). Las **donas** arrancan en «todo» porque duran un día; los demás arrancan en 0.
- **Destino:** Donación, Personal o Desecho (arriba se elige uno para todos; cada línea lo cambia).
- Una línea de resultado: «Se bota 10 (desecho) · queda en stock 10 · diferencia de conteo: 4».

Al confirmar: lo que se bota queda como merma con su destino; la **diferencia** entre el sistema y lo contado queda como merma «Diferencia de conteo»; **lo demás sigue en el stock**. El sistema no asigna culpables.

## 6. Stock y recetas

- Cada insumo muestra una **barra de qué tan lleno está** frente a su máximo, con marcas del **mínimo** (oscura) y del **medio**, el porcentaje y una palabra: **Agotado, Por acabarse, Poco, Bien, Lleno**.
- Cada insumo está ordenado así: nombre y estado, barra, cantidad («18 L de 40 L · 45 %»), vencimiento o vida útil, proveedor y botones (ficha y unidades, pedir por WhatsApp).
- Filtros con conteo: Todos, **Agotados**, Stock bajo, Regular, Suficiente.
- El stock baja solo con cada pedido aceptado según la receta; el margen sale del costo de los insumos.

## 7. Almacén: historial de movimientos

La lista de movimientos (fecha, tipo, insumo, cantidad, origen, destino, documento) se filtra desde el botón **Filtros** (plegado, igual que las demás pantallas; el botón muestra cuántos filtros hay y el resumen «Filtrando»):
- **Tipo** con conteo: Todos, Entradas, Salidas, Mermas, Devoluciones.
- **Fecha:** Todas, Hoy, Ayer, Últimos 7 días, y **Desde / Hasta** con calendario.
- **Origen** (Proveedor, Almacén central, Cocina, Barra, Producción) e **Insumo**.
- «Limpiar» borra todo, también las fechas.
- En el mockup las fechas no llevan año (se asume 2026) y «Hoy» es el 15/10.

## 8. Alta demanda (pantalla de cocina)

Interruptor para cuando hay muchísimos pedidos o una emergencia:
- **Activar alta demanda:** la carta y el chatbot avisan que la entrega tarda más: tiempo normal + los minutos elegidos (atajos +5, +10, +15, +20, +30, +45, +60 y un campo **Otro (min)** de 1 a 180). El mismo tiempo lo usa el bot al aprobar un pago.
- **Pausar pedidos:** además, la carta dice que se pausaron los pedidos y el chatbot pasa a un asesor. Solo vale mientras la alta demanda está activada.

## 8.1 Propuesta: stock por área (para evitar el doble descuento)

**El problema de hoy.** El mockup tiene **un solo stock**. Al **aceptar un pedido** descuenta los insumos según la receta (un frappé: leche 0.25 L, Oreo 0.5 paquete…). Pero una **Salida** de Almacén a Cocina también **resta** de ese mismo stock. Si se usan las dos, la leche se descuenta **dos veces**: cuando Almacén la entrega y cuando se vende el frappé.

**La solución: dos niveles de stock.**

| Dónde está | Sube con | Baja con |
|---|---|---|
| **Almacén central** | Entradas de proveedor, devoluciones | **Salidas** (entregas a Cocina o Barra) y mermas de almacén |
| **Cocina** y **Barra** | Salidas que reciben de Almacén | **Ventas por receta**, mermas de su área y el cierre del día |

- Una **Salida** deja de ser un consumo: es una **transferencia** (baja en Almacén y sube en Cocina o Barra, en el mismo movimiento). Nada se descuenta dos veces.
- La **venta** descuenta de donde se prepara: un frappé, de la Barra; un waffle, de Cocina.
- La **merma** baja del lugar donde ocurre.
- Lo que real y lo que dice el sistema puede diferir (derrames, errores): se ajusta con las mermas y con el **conteo** del cierre del día.

**Cualquier producto que se venda** (frappé, sándwich, dona) funciona igual: cada línea del pedido baja los insumos de su receta del stock del área que lo prepara.

**Promociones y combos.** Un combo (por ejemplo «Dúo: 2 bebidas + 1 complemento») se **expande en sus productos** y cada uno baja sus insumos, cada cual del área que lo prepara. Cada promoción vendida se registra aparte para las estadísticas. Un producto con descuento o 2x1 descuenta **lo que realmente se entrega** (si lleva dos, se descuentan dos recetas), no el precio.

**Cada venta es una transacción:** una sola operación que a la vez cobra, manda a cocina y descuenta los insumos de todas sus líneas (con el combo ya expandido). Si algo falla (por ejemplo falta stock de un insumo), no se hace a medias.

**Construido en el mockup (v148).** Cada insumo tiene un stock en el **almacén central** y otro en su **área** (Barra o Cocina; en el mockup, las leches, el café, la galleta Oreo, la chantilly, la pulpa de maracuyá y la Nutella son de la Barra y el resto de la Cocina; los productos de producción no se dividen). Al inicio el área tiene el 10 % de lo que había; el resto está en el almacén.

**Aclaración importante:** «Entregar desde el almacén» (una Salida a la Barra o a la Cocina) es un **movimiento físico**: un almacenero lleva la mercadería a la Barra o Cocina y lo registra. **No consume nada**: la leche solo cambia de lugar, así que el **total de la tienda no baja**. El total de un insumo solo baja cuando **se vende** (descuento automático por receta), **se pierde** (merma) o se corrige un conteo. La Entrada del proveedor y la Devolución al almacén también mueven, no consumen.

Cómo funciona, con el ejemplo de la leche (entre paréntesis, el total de la tienda):
1. **El proveedor entrega 40 L en el almacén** y el almacenero registra la **Entrada** → almacén 40 L (total 40 L).
2. **Cocina o Barra pide** 10 L («Pedir al almacén»).
3. **Un almacenero entrega físicamente** los 10 L a la Barra y lo registra («Entregar desde el almacén», o una Salida con destino Cocina o Barra) → el almacén baja a 30 L y la entrega queda **«por recibir»** (aviso a Cocina). La leche solo cambió de lugar: el total sigue en 40 L.
4. **Cocina o Barra: «Recibí»**: escribe lo que llegó de verdad (por defecto, todo). Almacén 30 L + Barra 10 L (total 40 L). Si llegaron 9, anota 9: la Barra sube 9 L y queda «recibido con diferencia»; ese litro faltante queda anotado para revisar.
5. **Venta (automática):** cada pedido baja los insumos de la receta **del área**; si el área no alcanza, toma el resto del almacén y lo avisa en el registro. **Aquí recién baja el total** (Barra 9.75 L, total 39.75 L).
6. **Merma** (se malogra o sobra) desde Barra o Cocina baja el stock de esa área y **también el total**, porque se pierde (se valida contra lo que hay allí). **Devolución** al almacén baja el área y sube el almacén: **no baja el total**.
Una Salida deja de restar dos veces. Un combo se descompone y cada producto baja su receta. Las entregas por recibir se ven en el stock de cada insumo («En Barra: 9 L · por recibir: 5 L») y como aviso a Cocina.

**Pendiente:** asignar el área a cada insumo desde el administrativo (hoy es una lista fija del mockup) y el control de sobrantes (el caso de los huevos).

## 9. No verificado y pendiente

- Nada se abrió en un navegador real.
- Falta asignar un **área** a cada insumo (cocina, barra, almacén) para que la merma de barra tenga su pantalla.
- No hay control de sobrantes de insumos entregados a cocina (el caso de los huevos).
- Empanadas: se mencionaron como producto de cocina, pero no existen en el stock de ejemplo; si se agregan como producción, aparecen solas en Cocina.
- Los plazos de vida útil y las recetas son de ejemplo; la encargada los ajusta.
- Decisiones de Kevin: si Devolución debe existir; si la merma de barra va a Cocina o a Almacén; qué destinos de merma usar.

> La pantalla **Workflows** del artifact reúne estos flujos y los de los demás módulos y de la carta virtual, por categorías (ver `registro-mockup.md`, v152).

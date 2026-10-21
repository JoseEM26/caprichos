---
id: ANA-CAP-006
tipo: analisis
titulo: "Informe de análisis funcional: Stock, recetas y gestión de insumos y productos (Rol Almacén)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, almacen-informes]
---

# Informe de análisis funcional: Stock, recetas y gestión de insumos y productos (Rol Almacén)

## 1 Lo que restaurant.pe tiene en este tema (separa EN VIVO de REFERENCIA)

### 1.1 Estado de la vista en vivo
NO SE PUDO VER EN VIVO: requiere que el usuario inicie sesion.
Al acceder a la URL oficial del sistema (https://restaurant.pe), la plataforma presenta su pantalla de autenticacion con inicio de sesion obligatorio mediante usuario, contrasena y codigo de local. Conforme a las reglas obligatorias de confidencialidad y no manipulacion de credenciales ni variables de entorno, la sesion no fue forzada. Por tanto, todo el analisis de restaurant.pe se fundamenta en los documentos tecnicos y funcionales de REFERENCIA obtenidos de la instancia de produccion de Caprichos (`almacen.md`, `productos.md`, `compras.md`, `informes.md`, `consolidado-reunion.md`).

---

### 1.2 Detalle funcional basado en documentos de REFERENCIA

En el sistema restaurant.pe, la gestion de stock, insumos, fichas tecnicas y recetas se encuentra distribuida entre tres grandes macro-modulos: **Almacen** (`#!/almacen`), **Productos y Catalogo** (`#!/productos`) e **Informes de Inventario** (`#!/informes/inventario`).

#### A. Pantallas y pestanas principales
1. **Monitor de Stock y Existencias (`#!/almacen/stock`)**:
   - Centraliza el inventario en tiempo real por cada local y almacen fisico.
   - Cuenta con filtros rapidos: `Articulos con stock bajo` (por debajo del stock minimo), `Articulos con stock por encima del maximo`, y `Solo con stock positivo`.
   - Incluye el boton `Generar orden compra`, que extrae de forma automatica todos los insumos bajo el umbral de seguridad y transfiere la lista de faltantes al modulo de compras prellenando solicitudes a los proveedores habituales.
   - Dispone de exportacion a Microsoft Excel (.xlsx) y CSV.

2. **Ficha Tecnica y Escandallo de Receta (`#!/productos/platos/editar-full/:idProductoGeneral`)**:
   - Cada producto general agrupa una o mas **Presentaciones** (variantes de tamano o formato, ej. 12 oz, 16 oz, 21 oz, Personal, Jarra).
   - En la pestana `Ficha Tecnica de Receta` (`presentacion.full.ingredientes.view.html`), cada presentacion tiene su propia formulacion independiente.
   - Permite agregar cinco tipos de componentes:
     * **(Insumo)**: Materia prima directa comprada (leche fresca, cafe en grano, azucar, harina).
     * **(Receta / Receta base)**: Preparaciones intermedias elaboradas internamente (jarabe de goma, salsa blanca, masa de queque, crema chantilly).
     * **(Porcionable)**: Insumos comprados a granel que se fraccionan en porciones fijas (bloque de queso cortado, pechuga fileteada).
     * **(Derivado)**: Subproductos de despiece.
     * **(Producto)**: Otro articulo terminado del catalogo que se consume como insumo.
   - Modos de descargo de inventario configurables:
     * **Modo 1 (Por preparacion en venta)**: Descuenta los insumos en tiempo real con cada comanda o cobro en el POS.
     * **Modo 0 (Por stock en almacen)**: Exige registrar previamente una orden de produccion (elaboracion por lotes, ej. 20 queques); la venta solo descuenta unidades terminadas ya producidas.

3. **Recetas de Modificadores y Adicionales (`#!/productos/modificadores`)**:
   - Permite vincular insumos a las opciones de personalizacion (ej. eleccion de leche de almendras, siropes adicionales, shots extras de cafe). Al seleccionarse la opcion en la comanda, se descuenta el insumo asociado.

4. **Descartables y Empaques para Llevar (`presentacion.full.productos.llevar.view.html`)**:
   - Permite asociar empaques (vasos termicos, tapas domo, servilletas, bolsas kraft) a cada producto, con activacion condicional segun el canal de venta: Salon, Venta Rapida, Delivery o Para Llevar.

5. **Combos y Ofertas Compuestas (`#!/productos/combos`)**:
   - Permite estructurar combos fijos y combos por equivalencias (donde el cliente elige 1 plato de un grupo, 1 bebida de otro y 1 postre).
   - El sistema realiza el desglose de cada producto componente para descontar los insumos de sus recetas correspondientes al facturarse el combo.

6. **Movimientos Internos, Requerimientos y Recepcion (`#!/almacen/requerimientomovimiento`)**:
   - Circuito formal dividido en cuatro etapas:
     * *Movimiento Interno*: Traslado entre almacenes (ej. Bodega Central a Barra). Opera mediante plantillas preconfiguradas y canje final.
     * *Requerimiento*: Pedido formal de abastecimiento entre sucursales o hacia cocina central.
     * *Recepcion*: Ingreso formal con conciliacion contra Guia Interna de Remision, permitiendo registrar faltantes o danos.
     * *Lista de Procesos*: Centro de auditoria de estados (Pendiente, Aprobado, Despachado, Recepcionado, Cancelado).

7. **Kardex de Almacen (`#!/almacen/kardex/individual`)**:
   - Trazabilidad cronologica de entradas, salidas, mermas y saldos valorizados.
   - Presenta un calculo asincrono o por lotes: en el encabezado avisa de ventas pendientes de procesar para el kardex (`pendienteProcesoStock`).

8. **Mermas de Almacen (`#!/almacen/merma`)**:
   - Registro de desperdicios y perdidas con motivo tipificado (vencimiento, caida, mal estado, merma de elaboracion) y valorizacion monetaria.

9. **Productos Agotados (`modalSelectorModoProductoAgotado.html`)**:
   - Permite marcar una presentacion como agotada con tres politicas de tiempo:
     * *Agotarlo solo por hoy* (se reactiva automaticamente al cerrar el turno o dia).
     * *Agotarlo por una semana*.
     * *Agotarlo para siempre / indefinido*.
   - Al marcarse, el producto se oculta de la comanda del mozo, de la carta web y de la carta QR.

#### B. Campos, filtros y columnas identificadas
- **Tabla de Stock**: Producto/Insumo, Tipo, Categoria, Almacenes, Stock total, Stock en Almacen Principal, Stock actual, Minimo requerido, Maximo requerido, Faltante calculado.
- **Formulario de Receta**: Cantidad, Unidad de Medida (con factor de conversion), Insumo/Producto, Almacen de descarga, Costo unitario, Costo total de receta, Costo sin impuestos.
- **Formulario de Insumo**: Nombre, Codigo, Unidad base (KG, LT, UNID, GR, ML), Merma porcentual (% de perdida util), Merma automatica al comprar, Proveedor habitual, Almacen por defecto.
- **Tabla de Mermas**: Fecha, Local, Almacen, Insumo, Cantidad, Motivo, Usuario responsable, Importe valorizado.

#### C. Permisos asociados (Seguridad)
En restaurant.pe los permisos estan sumamente atomizados:
- `ingredientes` / `productos.recetas`: Permite ingresar y alterar recetas y costos.
- `almacen.stock`: Permite ver existencias y generar compras.
- `almacen.movimientoalmacen`: Permite registrar traslados y mermas (la cuenta de auditoria carecia de este permiso, lo que restringia el modulo de mermas).
- `productos.modificadores`: Administracion de grupos y extras.
- `productos.combos`: Creacion de paquetes promocionales.

---

## 2 Lo que el mockup YA tiene para el rol almacen en este tema (con evidencia)

El rol evaluado en el mockup es **Almacen** (`almacen`), definido en el archivo principal `/tmp/claude-1000/almacen-agy/fuente/Admin.dc.html` (linea 2833) con usuario `alm01`, persona `Almacenero de ejemplo` y acceso restringido a las siguientes vistas:
`views: [ 'escritorio', 'compras', 'almacen', 'stock', 'informes', 'notificaciones' ]` (con `home: 'escritorio'` y `manage: false`).

A continuacion se detalla lo que el mockup tiene implementado, con citas exactas de codigo y lineas:

### 2.1 Escritorio del rol Almacen (`view === 'escritorio'`)
En las lineas 3192-3195 de `Admin.dc.html`, cuando el usuario activo tiene el rol `almacen`, la pantalla de inicio despliega:
- **Tarjetas de indicadores (KPIs)**:
  * `Insumos bajo el minimo`: Conteo dinamico de insumos cuya cantidad actual es menor al stock minimo (`lowSupplies.length`).
  * `Compras por recibir`: Compras en estado Pendiente (`TABLES.compras.rows.filter(r => r[6] === 'Pendiente').length`).
  * `Movimientos de hoy`: Cifra fija de ejemplo (`3`).
  * `Requerimientos pendientes`: Cifra fija de ejemplo (`1`).
- **Accesos directos a tareas pendientes (`dPending`)**:
  * Enlace a `stock` con contador de insumos criticos.
  * Enlace a `compras` con contador de ordenes pendientes.
  * Enlace a `almacen` para registrar traslados.
- **Lista de ultimos movimientos**: Muestra las ultimas 4 operaciones del historial de almacen con su fecha, insumo, cantidad, origen, destino y documento.
- **Monitor de stock bajo integrado (`dStock = true`)**: Muestra directamente en el escritorio el listado de alertas de stock para actuar sin cambiar de pantalla.

### 2.2 Modulo Stock y Recetas (`view === 'stock'`)
Renderizado en las lineas 807-862 y procesado en las lineas 3632-3650:
1. **Filtros por estado de stock (Chips semaforo)** (lineas 811, 3642):
   - Selector rapido entre: `Todos`, `Stock bajo` (rojo: cantidad menor al minimo), `Regular` (naranja: cantidad entre minimo y medio), y `Suficiente` (verde: cantidad sobre el nivel medio).
2. **Generador automatico de Orden de Compra por WhatsApp** (lineas 812, 817-825, 3643-3646):
   - El boton `Armar orden de compra con lo bajo` (`orderAll`) analiza todos los insumos en estado rojo o naranja, calcula la cantidad faltante para llegar al maximo (`x.max - stockOf(x)`), los agrupa automaticamente segun su Proveedor A principal (`PROVS`, linea 2307) y genera una ventana con el texto listo para enviar por WhatsApp (`ocLink`, via `https://wa.me/?text=...`).
3. **Cierre del dia y traspaso de perecibles a merma** (lineas 813, 3960-3963):
   - El boton `Cerrar el dia (sobrantes a merma)` (`closeDay`), accesible para el rol almacen (`canMove`, linea 3950), identifica los insumos o productos con vida util de un dia (`vida: 1`, como las donas artesanales en la linea 2313). Si queda saldo disponible, lo pasa automaticamente a merma con documento `MER-XXX`, genera el registro en el historial de almacen y pone el stock en cero.
4. **Alertas de stock por correo electronico** (lineas 814-815, 4163-4164):
   - Boton conmutador `Alertas por correo` (`toggleMail`) que activa o desactiva el envio de alertas al correo configurado del dueno (`info.correoDueno`) cuando un insumo cae bajo el minimo.
5. **Bitacora de descargos recientes (`hasStockLog`)** (lineas 826-829, 2928):
   - Muestra las ultimas 6 lineas de descargos automaticos generados por pedidos aceptados (ej. `CP-0101: Cafe en grano -0.018 kg · Leche entera -0.2 L`).
6. **Catalogo de Insumos con semaforo visual** (lineas 830-845, 3636-3641):
   - Despliega cada insumo de la lista `SUPPLIES` (lineas 2308-2314): Leche entera, Leche sin lactosa, Bebida de almendra, Cafe en grano, Galleta Oreo, Crema chantilly, Pulpa de maracuyá, Nutella, Pan de molde, Filete de pollo, Donas (produccion del dia).
   - Muestra nombre, indicador de estado (`STOCK BAJO`, `REGULAR`, `SUFICIENTE`), barra visual de progreso (`pct`), texto con stock actual, minimo, medio y maximo, texto con los tres proveedores alternativos (Proveedor A, B y C de `PROVS`), aviso de vida util y boton individual `Pedir por WhatsApp`.
7. **Visor de Ficha Tecnica, Costos y Margen de Utilidad** (lineas 846-862, 2325-2329, 3647-3650):
   - Incluye pestanas de tres recetas predefinidas (`recipeTabs`):
     * *Frappe Oreo 16 oz*: Costo insumos S/ 4.20, Precio S/ 16.50, Margen S/ 12.30 (75%). Desglosa leche, galleta oreo, chantilly, hielo/jarabe, vaso y sorbete.
     * *Capuccino 12 oz*: Costo insumos S/ 2.10, Precio S/ 9.50, Margen S/ 7.40 (78%). Desglosa cafe en grano, leche entera, vaso y tapa.
     * *Club Sandwich*: Costo insumos S/ 8.80, Precio S/ 27.00, Margen S/ 18.20 (67%). Desglosa pan de molde, pollo a la plancha, tocino/jamon, queso/verduras, papas nativas.
   - Calcula de forma inmediata el costo de insumos (`recipeCost`), precio de venta (`recipePrice`), margen bruto en soles y porcentaje de ganancia sobre el precio (`recipeMargin`).

### 2.3 Modulo de Movimientos de Almacen (`view === 'almacen'`)
Renderizado en las lineas 1057-1061 y procesado en las lineas 3950-3969:
1. **Acciones operativas para el rol Almacen (`canMove`)**:
   - `Registrar movimiento` (`openMov`): Abre la ventana modal `mvf` para asentar ingresos, salidas, transferencias y mermas.
   - `Registrar la producción del día` (`openProd`): Accion rapida que preconfigura una entrada de 24 unidades de Donas desde Produccion hacia Almacen central con documento `PRD-XXX`.
   - `Cerrar el día (sobrantes a merma)` (`closeDay`): Merma automatica de productos perecibles al final de la jornada.
2. **Formulario modal de registro de movimiento (`mvf`)** (lineas 3955-3959):
   - Selector de tipo: Entrada, Salida, Transferencia, Merma (`mvTipos`).
   - Selector de insumo: Lista desplegable de los insumos maestros (`mvInsumos`).
   - Campo de cantidad (`mvCant`) con validacion numerica mayor a cero.
   - Selector de origen: Proveedor, Almacen central, Cocina, Barra, Produccion (`mvOrigenes`).
   - Selector de destino o motivo de merma: Si es merma, ofrece los motivos Donacion, Personal o Desecho (`mvMotivos`). Si es movimiento, ofrece Almacen central, Cocina, Barra o Produccion (`mvDestinos`).
   - Al guardar (`mvSave`), solicita confirmacion de seguridad, actualiza la cantidad en `stock` de manera aritmetica inmediata (+ en entradas, - en salidas/mermas), asigna codigo de documento correlativo (`ENT-`, `SAL-`, `DEV-`, `MER-`) y anade la fila al inicio de la tabla.
3. **Tabla historica de movimientos (`TABLES.almacen`)** (lineas 2873-2877):
   - Columnas: Fecha, Tipo, Insumo, Cantidad, Origen, Destino, Documento.
   - Filtros funcionales: Tipo de movimiento (Entrada, Salida, Transferencia, Merma), Origen (Proveedor, Almacen central, Cocina, Barra) e Insumo.
   - Busqueda reactiva por nombre de insumo o codigo de documento.

### 2.4 Descuento automatico de stock por venta y combos
Implementado en el nucleo del sistema en las lineas 2919-2928 (`acceptEffects`) y lineas 2316-2324 (`usageOf`):
- **Al aceptar un pedido o confirmar su pago en caja**: El sistema ejecuta `acceptEffects(o)` antes de enviar la orden a cocina.
- **Explosion de receta en tiempo real**: La funcion `usageOf` inspecciona el nombre del producto y sus notas/opciones:
  * Si es cafe (Capuccino, Latte, Americano): descuenta 18 g (0.018 kg) de cafe en grano y 200 ml (0.2 L) de leche.
  * Si el cliente pidio variante de leche (sin lactosa o almendra): descuenta la leche especifica solicitada en lugar de leche entera.
  * Si es Frappe: descuenta leche (0.25 L), galletas Oreo (0.5 paquete si es de oreo), chantilly (0.05 L) y pulpa de maracuya (0.2 kg si es de maracuya).
  * Si es Waffle: descuenta Nutella y chantilly.
  * Si es Dona: descuenta unidades de Donas del dia.
  * Si es Sandwich: descuenta pan de molde (0.2 bolsa) y filete de pollo (1 unidad).
- **Descuento por combos**: En la linea 2923, si el producto vendido es un combo o promocion (`findPromo`), la funcion `expandPromo` desglosa el combo en sus articulos unitarios y ejecuta `usageOf` sobre cada uno, descargando el stock de cada insumo componente.

### 2.5 Gestion de productos agotados en el mockup
- **Mecanismo de agotado**: En el estado del sistema existe la estructura `s.avail = { [nombreProducto]: boolean }` (lineas 3470-3473).
- **Ocultamiento automatico**: Cuando un producto esta marcado como `s.avail[p.n] === false`, la funcion `moProdsBase` (linea 3544) lo excluye de la lista de productos disponibles para la toma de comandas del mozo y del catalogo de la carta digital y chatbot.
- **Quien lo administra en el mockup**: Actualmente, la accion interactiva `Marcar agotado / Marcar disponible` se ubica exclusivamente dentro de la vista `productos` (linea 3473). Como se evidencio en la linea 2833, el rol `almacen` **NO tiene acceso a la vista `productos`** (solo la tienen `admin` y `mozo`). En consecuencia, en el diseno actual del mockup el almacen no puede marcar un producto como agotado directamente.

---

## 3 Lo que FALTA o esta incompleto

A continuacion se presenta la matriz analitica de vacios tecnicos y funcionales detectados en el mockup frente a restaurant.pe y las necesidades de Caprichos:

| Que falta o esta incompleto | Donde lo tiene restaurant.pe | Por que importa a Caprichos | Gravedad | Esfuerzo |
| :--- | :--- | :--- | :---: | :---: |
| **Boton para marcar productos agotados desde Almacen**: El almacenero detecta quiebres de stock pero no tiene la vista `productos` ni un boton en `stock` para marcar platos agotados. | En `productos/platos` y en POS; cualquier operador autorizado marca agotado. | Si se termina el cafe en grano, almacen debe poder inhabilitar los cafes al instante sin depender del administrador o del mozo. | **Alta** | **S** |
| **Agotado temporal ("Solo por hoy")**: El mockup solo tiene un interruptor permanente Si/No; no tiene vigencia temporal. | Modal `modalSelectorModoProductoAgotado.html` con opciones: Por hoy, Por una semana, Para siempre. | En cafeteria, la mayoria de agotados son diarios (ej. se acabaron las fresas del turno); si no se reactiva solo, al dia siguiente el mozo olvida activarlo y se pierden ventas. | **Alta** | **M** |
| **Recetas dinamicas y editables**: Las recetas en el mockup estan fijas en codigo (`RECIPES`, 3 platos). No hay pantalla para crear, editar insumos ni actualizar costos. | Submodulo completo `productos.editar-full` y `presentacion.full.ingredientes.view.html`. | Caprichos tiene mas de 60 platos en su carta; si el precio del cafe o la leche sube, no se puede actualizar el costo ni crear nuevos platos. | **Alta** | **L** |
| **Recetas por tamano / presentacion**: En el mockup solo existe receta para 1 tamano fijo (Frappe 16 oz, Capuccino 12 oz). No contempla 12 oz ni 21 oz. | Cada `producto` (presentacion) dentro del `productogeneral` tiene su propia receta en restaurant.pe. | Una taza de 8 oz, 12 oz o un frappe de 21 oz consumen cantidades radicalmente diferentes de cafe, leche, hielo y jarabes. El stock se descuenta mal. | **Alta** | **M** |
| **Descuento de insumos por modificadores**: En el mockup, si el cliente pide "Shot extra de cafe" (+S/ 2.00) o "Bola de helado", el sistema cobra el dinero pero no descuenta cafe ni helado. | `modificadorseleccion` tiene tabla `seleccioninsumo` vinculada a recetas. | Los adicionales con costo representan alto volumen en cafeteria; no descontarlos genera desfases graves entre el stock teorico y el fisico. | **Media** | **M** |
| **Receta de descartables segun canal**: No se descuentan vasos, tapas ni bolsas para pedidos Delivery o Para Llevar. | Pantalla `presentacion.full.productos.llevar.view.html` con checkboxes por canal (Salon, Rapida, Delivery). | Los empaques descartables representan entre el 5% y 8% del costo de una bebida para llevar; no controlarlos genera mermas ocultas no detectadas. | **Media** | **M** |
| **Sub-recetas (Recetas base) y Porcionables**: No se pueden modelar preparaciones intermedias (jarabe de azucar, masa de queque, crema chantilly preparada). | Sub-tabs en `productos/insumos`: Insumos puros, Recetas base y Porcionables. | En cafeteria se preparan bases previas que se usan en multiples bebidas; no tenerlas obliga a duplicar insumos crudos en cada receta. | **Media** | **L** |
| **Conversion de Unidades de Medida**: El insumo se define en una sola unidad fija; no hay equivalencias (comprar saco de 50 kg y consumir en gramos). | Tabla `insumoequivalencia` con validacion de conversion (KG a G, L a ML, Botella a Oz). | Errores matematicos: hoy el mockup mezcla 0.018 kg de cafe en un campo numerico directo sin factor de conversion configurable. | **Media** | **M** |
| **Kardex formal de movimientos**: En el mockup el Kardex es solo un texto en una lista informativa; no hay pantalla de consulta cronologica por insumo. | `#!/almacen/kardex/individual` con saldo inicial, ingresos, salidas por venta, mermas y saldo final. | El almacenero y el dueno no pueden auditar descuadres de mercaderia ni saber en que pedido o turno se perdio un insumo. | **Alta** | **L** |
| **Mermas con valorizacion y motivos reales**: Solo hay merma automatica de donas y merma manual con 3 motivos genericos, sin calculo monetario de la perdida. | `#!/almacen/merma` con costo unitario, importe total de merma y motivos tributarios/operativos. | Impide calcular la fuga de dinero por alimentos vencidos, rotos o mal elaborados al final del mes. | **Media** | **M** |
| **Sustitucion automatica en combos agotados**: Si un componente de combo no tiene stock, no hay regla automatica para ofrecer un sustituto disponible. | Configuracion de combos por equivalencias y grupos dinamicos de sustitucion. | Segun RN-CAP-055, el combo debe poder venderse cambiando el complemento agotado por otro de la misma categoria. | **Media** | **S** |

---

## 4 Mejoras sobre restaurant.pe (que haria mejor nuestro sistema)

El sistema de referencia restaurant.pe adolece de una estructura fragmentada, interfaz web obsoleta (AngularJS / Bootstrap 3 de escritorio) y procesos burocraticos excesivos disenados para grandes cadenas de restaurantes, lo cual resulta ineficiente para una cafeteria de especialidad como Caprichos. Nuestro sistema propone:

1. **Pantalla unificada "Stock y Recetas" en un solo golpe de vista**:
   - *En restaurant.pe*: Para ver el stock hay que ir a `almacen/stock`, para ver la receta hay que ir a `productos/platos`, buscar el producto, entrar a edicion avanzada, abrir la variante y pulsar en ingredientes (7 pasos). Para comprar hay que ir a otro modulo.
   - *En Caprichos*: Panel dividido en dos columnas: a la izquierda, la lista viva de insumos con barras de estado semaforo (verde, naranja, rojo); a la derecha, la ficha tecnica con calculo de costo por plato, precio y margen en soles y porcentaje.

2. **Orden de compra express por WhatsApp en un solo clic**:
   - *En restaurant.pe*: Generar una compra exige crear un requerimiento, aprobarlo, convertirlo en orden de compra administrativa, ingresar series tributarias y enviarlo por correo tradicional.
   - *En Caprichos*: Un boton inteligente `Armar orden de compra con lo bajo` identifica que insumos estan bajo el minimo, calcula cuanto comprar para llegar al maximo, agrupa los pedidos por proveedor y genera el mensaje de WhatsApp preformateado para enviarlo directamente al celular del proveedor en menos de 10 segundos.

3. **Cierre del dia y merma automatica de perecibles sin papeleos**:
   - *En restaurant.pe*: Para registrar productos no vendidos al cierre del turno hay que ingresar a mermas manuales linea por linea o registrar una salida extraordinaria con justificacion contable.
   - *En Caprichos*: Boton `Cerrar el día (sobrantes a merma)` que identifica automaticamente los productos con vida util de un dia (donas, postres del dia), calcula los saldos remanentes, genera el documento de merma correspondiente y resetea el inventario a cero para la manana siguiente.

4. **Descuento de stock transaccional en tiempo real (sin colas batch)**:
   - *En restaurant.pe*: Las ventas no impactan el kardex de inmediato; el sistema acumula ventas pendientes en un proceso en cola (`pendienteProcesoStock`) que muestra advertencias en pantalla hasta que corre una tarea en segundo plano.
   - *En Caprichos*: El descargo de insumos ocurre en el momento exacto en que caja confirma el pedido (`acceptEffects`), asegurando que las existencias del semaforo sean 100% fidedignas en todo momento.

5. **Inactivacion en cascada inteligente de platos cuando se agota un insumo**:
   - *En restaurant.pe*: Si se acaba la leche sin lactosa o el cafe espresso, el sistema no avisa que platos dependen de ella; el administrador debe acordarse de buscar manualmente cada bebida y marcarla como agotada.
   - *En Caprichos*: Se propone que cuando un insumo llegue a stock cero en almacen, el sistema pregunte: *"Se agoto Cafe en grano. Deseas marcar como agotados los 8 cafes que dependen de este insumo?"*, permitiendo desactivarlos en bloque con una sola confirmacion.

---

## 5 Propuesta concreta de implementacion en el mockup, priorizada

Para transformar el mockup en una herramienta de gestion operativa robusta y ajustada a las necesidades de Caprichos, se define la siguiente hoja de ruta por fases:

### Fase 1: Inmediata (Ajustes indispensables para el rol Almacen)
1. **Permitir marcar agotados desde la vista `stock` para el rol Almacen**:
   - Agregar en cada tarjeta de insumo en estado critico (`lvOf(x) === 'rojo'`) un boton secundario: `Agotar platos vinculados`.
   - Al pulsarlo, desplegar un modal que liste los platos que consumen dicho insumo y permita marcarlos como `Agotados solo por hoy` en la carta del cliente y en el POS del mozo.
2. **Selector de temporalidad al marcar agotado**:
   - Sustituir el toggle simple de agotado por una confirmacion con dos alternativas:
     * *Agotado solo por hoy* (se restablece solo a las 00:00 o con el cierre de turno).
     * *Agotado indefinido* (requiere volver a marcar disponible manualmente).
3. **Incorporar desglose de recetas por tamano en la vista `stock`**:
   - Ampliar la estructura de `RECIPES` para incluir selectores de tamano:
     * Frappe Oreo: 12 oz (0.20 L leche, 0.35 paquete oreo), 16 oz (0.25 L leche, 0.5 paquete oreo), 21 oz (0.32 L leche, 0.75 paquete oreo).
     * Capuccino: 8 oz (0.014 kg cafe, 0.15 L leche), 12 oz (0.018 kg cafe, 0.20 L leche), 16 oz (0.022 kg cafe, 0.26 L leche).
   - El calculo de costo y margen debe actualizarse de manera reactiva segun el tamano seleccionado en las pestanas.

### Fase 2: Mediano plazo (Precision en costos y mermas)
1. **Formulario interactivo de creacion y edicion de recetas (Escandallo)**:
   - Crear una vista modal o pestana dentro de `stock` que permita al encargado de almacen o administrador:
     * Seleccionar un plato de la carta.
     * Agregar lineas de insumos eligiendo de la lista maestra, indicando cantidad y costo unitario.
     * Incorporar costo de descartables (vaso, tapa, bolsa) para pedidos de despacho.
     * Visualizar la suma de costo neto y el margen de ganancia proyectado.
2. **Descuento de insumos por modificadores en `acceptEffects`**:
   - Ajustar el motor de calculo para que evalue las opciones seleccionadas en el carrito (`mo.cfg.picks`): si el cliente anade "Shot de cafe extra", descontar 0.018 kg adicionales de cafe; si anade "Chantilly", descontar 0.05 L de chantilly.
3. **Mejora en el registro de Mermas**:
   - Ampliar el modal de merma (`mvIsMerma`) agregando campo de `Costo aproximado imputado` y lista de motivos especificos: *Vencimiento en vitrina*, *Error de preparacion en barra*, *Derrame / Rotura*, *Desecho tecnico*, *Donacion autorizada*.

### Fase 3: Avanzada (Trazabilidad y Kardex)
1. **Pantalla de Kardex operativo por insumo**:
   - En la vista `almacen` o dentro de `stock`, agregar un visor de movimientos cronologicos donde al tocar un insumo (ej. Cafe en grano) se despliegue: Saldo inicial, Entradas por compra, Salidas por ventas (agrupadas por turno o pedido), Mermas registradas y Saldo final en soles y unidades fisicas.
2. **Regla de sustitucion automatica de complementos en combos (RN-CAP-055)**:
   - En el configurador de combos del POS, si un postre o complemento no tiene stock, marcarlo visualmente como agotado y sugerir automaticamente los postres alternativos de la misma categoria disponibles en vitrina.

---

## 6 Preguntas para el dueno (Kevin)

Para cerrar el diseno definitivo con el cliente, se requiere respuesta a las siguientes decisiones operativas y de negocio:

1. **Permisos de agotado**: ¿El encargado de almacen debe tener autorizacion para marcar platos como agotados en la carta web cuando detecte que no hay stock, o esa decision debe ser exclusiva del administrador o personal de barra?
2. **Politica de agotado temporal**: ¿Prefiere que los productos marcados como agotados se reactiven solos cada manana al abrir el local ("Agotado solo por hoy"), o prefiere que un usuario deba reactivarlos obligatoriamente a mano para evitar vender algo que no ha llegado?
3. **Escandallo de cafe y barismo**: En la preparacion de cafes, ¿desean controlar el consumo al gramo por taza (ej. 18 g por shot doble de espresso) con descuento automatico en el sistema, o prefieren que el almacen descargue el cafe por bolsas cerradas de 1 kg entregadas a la estacion de barra?
4. **Destino de mermas al cierre**: Los productos elaborados que sobran al final del dia y no pueden guardarse (como las donas artesanales), ¿se destinan a donacion, consumo del personal o desecho fisico? ¿Requiere que el administrador autorice el registro antes de cerrar el dia?
5. **Manejo de descartables en el costeo**: ¿Los vasos termicos, tapas domo, servilletas y fajas de carton deben integrarse dentro del costo de la receta de cada bebida para llevar, o se auditan como inventario de suministros por conteo fisico semanal?
6. **Sub-recetas en pasteleria**: ¿En cocina preparan bases intermedias en volumen (ej. litros de crema chantilly, jarabes caseros, masas de galletas) que requieran registrarse como stock elaborado antes de armar los postres finales?
7. **Sustitucion en combos**: Si en un combo (como el Duo para compartir) se agota un sabor de dona o complemento, ¿el mozo o cajero puede ofrecer libremente cualquier otro postre del mismo valor comercial o debe existir una lista restringida de reemplazos?

---

## 7 NO VERIFICADO

Durante la ejecucion de la auditoria funcional, quedaron los siguientes puntos que no pudieron ser comprobados:
1. **NO SE PUDO VER EN VIVO**: La navegacion activa en https://restaurant.pe no pudo completarse debido a que la plataforma solicita inicio de sesion con credenciales de usuario y clave. Siguiendo estrictamente la regla 2 del cliente, no se ingresaron contrasenas ni se leyeron variables de entorno, procediendo con los documentos de referencia.
2. **Carga real de recetas en la cuenta de Caprichos**: En los documentos de referencia de restaurant.pe se evidencia que el sistema cuenta con toda la infraestructura de escandallo y fichas tecnicas, pero no se pudo verificar si Caprichos tenia registradas en produccion las recetas completas de sus 66 productos o si solo utilizaba el sistema para control global de existencias y facturacion (el BRD senala esto como riesgo: *"Datos de partida incompletos: puede que las recetas, insumos y costos no esten cargados o no esten ordenados"*).
3. **Modulo de mermas en produccion de restaurant.pe**: En la auditoria de produccion, la ruta `#!/almacen/merma` redirigia a `#!/accesorestringido` debido a que el usuario de auditoria `krosales` carecia del permiso `almacen.movimientoalmacen`. Su funcionamiento se dedujo del analisis estatico de plantillas (`merma.html` y `merma-nuevo.html`).
4. **Metodo fisico de pesaje en barra**: No se pudo verificar en el entorno fisico del local de Caprichos si la estacion de baristas cuenta con balanzas digitales de precision para dosificar los 18 g de cafe por espresso o si operan con molinos programados por tiempo de molienda automatica.

---
INFORME LISTO.

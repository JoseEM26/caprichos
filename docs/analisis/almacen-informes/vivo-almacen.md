---
id: ANA-CAP-008
tipo: analisis
titulo: "Analisis de Pantallas de Almacen de Restaurant.pe: Auditoria en Vivo de Plantillas AngularJS y Plan de Replica para Caprichos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, almacen-informes]
---

# Analisis de Pantallas de Almacen de Restaurant.pe: Auditoria en Vivo de Plantillas AngularJS y Plan de Replica para Caprichos

Informe tecnico y funcional de auditoria basado en la evidencia extraida de las plantillas reales (HTML de AngularJS) de Restaurant.pe en `/tmp/claude-1000/almacen-agy/vivo/almacen/`. Este documento describe campo por campo los formularios de inventario, contrasta la arquitectura con los informes documentales previos y el prototipo interactivo en `/tmp/claude-1000/almacen-agy/fuente/Admin.dc.html`, y define la propuesta de replica mejorada para la cafeteria Caprichos (Lima, Peru).

---

## 1 Pantallas encontradas (lista con nombre de plantilla y que hace)

En el directorio de plantillas extraidas de Restaurant.pe (`/tmp/claude-1000/almacen-agy/vivo/almacen/`), se identificaron 201 archivos HTML que comprenden modulos de almacen, informes de inventario, compras vinculadas, maestros de insumos y configuracion de produccion. A continuacion se detallan las plantillas especificas de la operativa de Almacen:

### 1.1 Indice y Navegacion Central de Almacen
- `scripts__restaurantpe__almacen__index.html`: Portal principal del modulo de Almacen. Despliega la cuadricula de accesos directos a los submoudulos: Kardex, Stock, Cuadre de stock manual, Movimiento entre almacenes, Merma, Preparacion receta, Porcionamiento insumos, Orden de produccion, Guias de Remision y Orden de Guias de Remision.
- `scripts__restaurantpe__almacen__almacen-breadcrumb.html`: Componente de migas de pan para la navegacion contextual de almacen.

### 1.2 Movimientos entre Almacenes (Entradas, Salidas y Transferencias)
- `scripts__restaurantpe__almacen__movimientoalmacen__movimientoalmacen.html`: Listado historico de transferencias entre bodegas. Permite filtrar por local, estado, texto y rango de fechas. Incluye botones para registrar nuevo movimiento, consultar borradores (avances), gestionar plantillas, generar informes impresos (PDF y Excel) y aprobar la recepcion fisica en el almacen de destino.
- `scripts__restaurantpe__almacen__movimientoalmacen__movimientoalmacen-nuevo.html`: Formulario de captura y edicion de movimientos entre almacenes. Soporta registro por lote de insumos o productos, verificacion de stock en tiempo real en almacen origen, vinculacion a guias de remision, guardado de borradores ("avances"), guardado como plantilla reutilizable y registro definitivo.
- `scripts__restaurantpe__almacen__movimientoalmacen__breadcrumb-movimientoalmacen.html` y `breadcrumb-movimientoalmacen-nuevo.html`: Barras de navegacion y retorno del submoudulo.
- `scripts__restaurantpe__almacen__modals__detallemovimientoalmacen-modal.html`: Modal de nota de movimiento. Despliega la cabecera, responsable, receptor, observacion y la tabla de articulos transferidos con costo y unidad de medida, con boton de aprobacion de recepcion.
- `scripts__restaurantpe__almacen__modals__avancesmovimiento.html`: Modal de gestion de borradores guardados para retomar transferencias incompletas.

### 1.3 Mermas y Bajas de Inventario
- `scripts__restaurantpe__almacen__merma__merma.html`: Bandeja historica de bajas por merma, rotura o vencimiento. Muestra importe valorizado, estado, opcion de ver anulados y acciones para consultar detalle, reimprimir boleta de salida y anular.
- `scripts__restaurantpe__almacen__merma__merma-nuevo.html`: Formulario de salida por merma. Permite asignar responsable (mozo o personal de salon), fecha, hora, clasificacion mediante categorias de salida, desglose de insumos/productos con calculo automatico de costo e importe, y justificacion textual obligatoria.
- `scripts__restaurantpe__almacen__merma__breadcrumb-merma.html` y `breadcrumb-merma-nuevo.html`: Navegacion migas de pan.
- `scripts__restaurantpe__almacen__modals__detallemerma-modal.html`: Modal de comprobante de merma con detalle de producto, cantidad, costo unitario e importe totalizado.
- `scripts__restaurantpe__almacen__modals__categoriasalida-modal.html`: Modal CRUD para definir categorias o motivos de baja (ej. Vencimiento, Rotura, Deterioro, Manipulacion, Cortesias internas).
- `scripts__restaurantpe__almacen__modals__mermaPorRequerimiento__modal.mermaporquerimiento.html`: Modal especializado para asentar mermas originadas durante el despacho de un requerimiento interno insatisfecho o danado.

### 1.4 Requerimientos Internos y Despachos
- `scripts__restaurantpe__almacen__requerimientosv2__requerimientos.view.html`: Interfaz dividida (split-view) de requerimientos. Panel izquierdo con lista de plantillas predefinidas y panel derecho con la composicion desagregada en Productos, Insumos y Recetas.
- `scripts__restaurantpe__almacen__requerimientosv2__modal-registrar-plantilla.view.html`: Modal para configurar una plantilla de pedido recurrente (nombre de plantilla, responsable, encargado y lista de articulos solicitados con cantidades base).
- `scripts__restaurantpe__almacen__requerimientosv2__modal-canjear-requerimiento.view.html`: Modal de emision real del requerimiento ("canje"). Permite ajustar las cantidades finales a pedir antes de transmitir el pedido al area de produccion o centro de distribucion.
- `scripts__restaurantpe__almacen__requerimientomovimiento__requerimientomovimiento.html`: Vista de administracion de requerimientos de la version clasica.
- `scripts__restaurantpe__almacen__requerimientomovimiento__requerimientomovimiento-nuevo.html`: Formulario directo de requerimiento libre de insumos entre centros operativos.
- `scripts__restaurantpe__almacen__requerimientomovimiento__generarmovimiento.html`: Interfaz para transformar un requerimiento aprobado en una transferencia fisica efectiva de stock.
- `scripts__restaurantpe__almacen__requerimientomovimiento__procesar__requerimientomovimiento-procesarlist.html` y `requerimientomovimiento-procesar.html`: Bandeja de picking y empaque de pedidos recibidos desde otras areas.
- `scripts__restaurantpe__almacen__requerimientomovimiento__procesar__detalleCalculos.html`: Panel auxiliar de metricas y cubicaje del pedido.
- `scripts__restaurantpe__almacen__requerimientomovimiento__revision__requerimientomovimiento-revision.html`: Pantalla de inspeccion y control de calidad antes del despacho.
- `scripts__restaurantpe__almacen__requerimientomovimiento__seleccion__requerimientomovimiento-seleccion.html` y `modal-resumen-seleccion.html`: Seleccion masiva y consolidacion de requerimientos para despacho unificado.
- `scripts__restaurantpe__almacen__modals__detallerequerimiento-modal.html`: Modal de nota de requerimiento con detalle de items solicitados y aprobados.
- `scripts__restaurantpe__almacen__modals__modal.plantillarequerimiento.html`: Modal rapido de seleccion de plantilla.
- `scripts__restaurantpe__almacen__modals__requerimientolibre-modal.html`: Modal para insercion rapida de requerimientos fuera de plantilla.

### 1.5 Recepcion de Mercaderia y Guias Internas
- `scripts__restaurantpe__almacen__recepcion__recepcion.view.html`: Interfaz split-view para registrar recepciones. Panel izquierdo con lista de guias internas en transito ("En camino") y panel derecho con el detalle clasificado en Productos, Insumos, Recetas y Derivados.
- `scripts__restaurantpe__almacen__recepcion__modal-canje-guia-remision-mov.view.html`: Modal de verificacion fisica y canje. Permite contrastar item por item la cantidad enviada frente a la cantidad recibida real y actualizar las existencias en el almacen de destino.

### 1.6 Movimiento Interno (Modulo Alternativo de Abastecimiento)
- `scripts__restaurantpe__almacen__movimientointerno__movimientointerno.html`: Pantalla split-view para movimientos internos rutinarios por plantilla.
- `scripts__restaurantpe__almacen__movimientointerno__modal-plantilla-movimiento.view.html`: Modal para creacion y mantenimiento de plantillas de movimiento.
- `scripts__restaurantpe__almacen__movimientointerno__modal-canje-movimiento-interno.view.html`: Modal de ejecucion del movimiento con validacion de cantidades.

### 1.7 Hub Unificado de Procesos Operativos
- `scripts__restaurantpe__almacen__lista-procesos__lista-de-procesos.view.html`: Tablero maestro multi-pestana que unifica el flujo operativo de suministros:
  - Pestana 0: Requerimientos (`tap-requerimiento.view.html`).
  - Pestana 1: Registros de recepcion (`tab-recepcion.view.html`).
  - Pestana 2: Movimientos internos (`tab-movimiento.view.html`).
- `scripts__restaurantpe__almacen__lista-procesos__proceso-detalle.view.html`: Detalle integral de auditoria de un requerimiento con historial de trazabilidad y desglose por grupos de productos.
- `scripts__restaurantpe__almacen__lista-procesos__movimiento-detalle.view.html`: Auditoria detallada de un traslado interno.
- `scripts__restaurantpe__almacen__lista-procesos__recepcion-detalle.view.html`: Auditoria detallada de un registro de recepcion.
- `scripts__restaurantpe__almacen__lista-procesos__modal-filtro-requerimiento.view.html`, `modal-filtro-movimiento.view.html`, `modal-filtro-recepcion.view.html`: Modales con selectores de fechas, locales, almacenes origen/destino y estados del proceso.

### 1.8 Arqueo de Inventario Fisico (Toma de Inventario y Control de Lotes)
- `scripts__restaurantpe__almacen__arqueoinventario__arqueoinventario.html`: Pantalla matricial para toma de inventario fisico periodico o rotativo. Permite ingresar cantidades fisicas por almacen, registrar notas justificativas por producto, lotizar insumos bajo costeo FIFO y guardar la seleccion como plantilla de conteo frecuente.
- `scripts__restaurantpe__almacen__arqueoinventario__breadcrumb-arqueoinventario.html` y `breadcrumb-listaarqueoinventario.html`: Migas de pan del submodulo.
- `scripts__restaurantpe__almacen__modals__arqueoinventario__modalArqueoinventario.view.html`: Modal para arqueo rapido de items seleccionados con captura directa de cantidades fisicas.
- `scripts__restaurantpe__almacen__modals__asignacionLoteArqueo__modal-asignacionlotearqueoinventario.html`: Modal de asignacion y despiece de lotes con captura obligatoria de codigo de lote, cantidad contada y fecha de vencimiento.
- `scripts__restaurantpe__almacen__modals__plantillasArqueoInventario__modal.plantillasarqueoinventario.html`: Modal para bautizar y guardar plantillas de arqueo rotativo (ej. conteo diario de carnes o lacteos).
- `scripts__restaurantpe__almacen__modals__notaArqueoInventario__modal-notaarqueoinventario.html`: Modal para ingresar la justificacion u observacion de descuadre en un item especifico del arqueo.

### 1.9 Cuadre de Stock Manual y Ajustes Contables
- `scripts__restaurantpe__almacen__regularstock__regularstock.html`: Matriz de regularizacion de stock manual y ajuste contable. Permite sobreescribir el stock fisico en cada almacen, calcular la variacion positiva o negativa en soles, modificar el costo base de reposicion unitario y documentar la razon del ajuste. Advierte transacciones pendientes de procesar.
- `scripts__restaurantpe__almacen__regularstock__breadcrumb-stock.html` y `breadcrumb-listastock.html`: Migas de pan de la seccion.
- `scripts__restaurantpe__almacen__modals__costoCuadreManual__modal-costobase.html`: Modal de confirmacion y captura de nuevo costo base por unidad de medida.
- `scripts__restaurantpe__almacen__modals__notaCuadreManual__modal-notacuadre.html` y `modal-arqueoinventario.html`: Modales para asentar observaciones puntuales en renglones de ajuste manual.

### 1.10 Regularizacion y Procesamiento Batch de Stock
- `scripts__restaurantpe__almacen__procesarstock__procesarstock.html`: Pantalla operativa para correr el proceso de recalculado y regularizacion por lotes de stock diferido (Compras, Guias, Recetas, Ventas y Mermas) en un rango de fechas (con restriccion de maximo 5 dias para transacciones de ventas).
- `scripts__restaurantpe__almacen__procesarstock__lista.html`: Resumen de transacciones historicas regularizadas, con indicadores acumulados de compras, guias, ventas y mermas procesadas.
- `scripts__restaurantpe__almacen__procesarstock__breadcrumb-procesarstock.html` y `breadcrumb-lista.html`: Migas de pan del submoudulo.

### 1.11 Monitor de Stock, Alertas y Reposicion Automatica
- `scripts__restaurantpe__almacen__stock__stock.html`: Tablero maestro de consulta de existencias por almacen. Visualiza existencias fisicas, stock minimo, stock maximo, stock faltante y stock consolidado. Dispone de filtros para aislar insumos por debajo del minimo o por encima del maximo, y un generador automatico de Ordenes de Compra por stock minimo o maximo.
- `scripts__restaurantpe__almacen__stock__breadcrumb-stock.html`: Migas de pan.

### 1.12 Kardex de Almacen (Trazabilidad y Costeo)
- `scripts__restaurantpe__almacen__kardex__kardex.html`: Estructura base del kardex con saldo actual e historial.
- `scripts__restaurantpe__almacen__kardex__individual.html`: Pantalla principal del Kardex por producto/insumo. Muestra tarjetas de resumen (stock inicial, entradas, salidas, stock final), grafica de lineas de evolucion temporal, matriz con fecha, vencimiento, lote, motivo con vinculo al documento de origen, entradas, salidas, saldo actual, lote restante (FIFO), costo unitario, costo promedio ponderado, costo de operacion y valorizacion de existencias. Incluye herramientas administrativas de correccion de item y almacen.
- `scripts__restaurantpe__almacen__kardex__general.html`: Kardex general de todos los productos del local.
- `scripts__restaurantpe__almacen__kardex__avanzado.html`: Vista avanzada con desglose tecnico de capas de inventario y costos.
- `scripts__restaurantpe__almacen__kardex__selector.html`: Barra de navegacion por pestanas para alternar entre Kardex Individual, General y Avanzado.
- `scripts__restaurantpe__almacen__kardex__breadcrumb-*.html`: Migas de pan correspondientes a cada variante.

### 1.13 Produccion, Recetas Base y Porcionamiento
- `scripts__restaurantpe__almacen__ordenproduccion__ordenproduccion.html`: Bandeja de ordenes de produccion. Administra los estados (Pendiente, En preparacion, Finalizado, Anulada), despliega subtablas expandibles con recetas a producir y permite generar ordenes de compra agrupadas por proveedor para abastecer la fabricacion.
- `scripts__restaurantpe__almacen__ordenproduccion__registrar__ordenproduccion-nueva.html`: Formulario para emitir una orden de produccion programada con fecha, hora, responsable y selector dinamico de recetas a fabricar con su cantidad estimada.
- `scripts__restaurantpe__almacen__ordenproduccion__prepararorden__ordenproduccion-preparar.html`: Pantalla de ejecucion de la orden en cocina/taller, donde se anota la cantidad real producida final.
- `scripts__restaurantpe__almacen__modals__ordenproduccion__modal-ordencompra-por-ordenproduccion.html`: Modal de calculo y generacion automatica de Ordenes de Compra hacia los proveedores de las materias primas faltantes para cumplir la orden de produccion.
- `scripts__restaurantpe__almacen__preparacionreceta__lista__receta.lista.view.html`: Catalogo de recetas base registradas con indicador de si descuentan insumos del stock.
- `scripts__restaurantpe__almacen__preparacionreceta__registrar__preparacionreceta-detalle-base.html`: Formulario de elaboracion de receta base en taller. Integra arbol jerarquico de ingredientes (`ui-tree`), calculo de costo por tanda, captura de fecha de caducidad para lotes FIFO, recalculo de costo por cantidad resultante y validacion de stock previo.
- `scripts__restaurantpe__almacen__preparacionreceta__registrar__recetas-nodo.html` y `recetas-detalle.html`: Fragmentos recursivos para desplegar el arbol de recetas e insumos anidados.
- `scripts__restaurantpe__almacen__preparacionreceta__historial__receta.historial.view.html`: Historial de batches preparados, comparando cantidades estimadas vs reales y stock previo vs resultante.
- `scripts__restaurantpe__almacen__modals__modal-detalledetallepreparacion.html`: Modal de desglose analitico de componentes de una preparacion.
- `scripts__restaurantpe__almacen__porcionamientoinsumo__lista__lista.view.html`: Lista maestra de insumos configurados como porcionables (ej. quesos en barra, jamones, carnes, tortas enteras).
- `scripts__restaurantpe__almacen__porcionamientoinsumo__registrar__porcionamiento-detalle.html`: Asistente en 3 pasos para registrar el fraccionamiento de un insumo madre a porciones hijas, midiendo stock actual, piezas generadas, sobrante no porcionado y conversion opcional de merma porcentual.
- `scripts__restaurantpe__almacen__porcionamientoinsumo__registrar__porcionamiento-nodo.html`: Componente de representacion visual del despiece.
- `scripts__restaurantpe__almacen__porcionamientoinsumo__historial__porcionamiento.historial.view.html`: Bitacora historica de porcionamientos ejecutados y bajas por merma de corte.

### 1.14 Guias de Remision y Ordenes de Despacho (SUNAT)
- `scripts__restaurantpe__almacen__guiaremision__guia-lista.html`: Bandeja de Guias de Remision emitidas. Muestra serie, numero correlativo, destinatario, estado fiscal, canje por comprobante de venta, estado de procesamiento de stock y opciones de impresion en PDF (formato estandar A4 o ticketera matricial).
- `scripts__restaurantpe__almacen__guiaremision__guia-form.html`: Formulario completo de emision de Guia de Remision electronica (traslado entre locales o hacia clientes). Integra serie, correlativo, fechas de emision y traslado con horas, cliente/destinatario con ubigeo y direccion, datos de transporte (transportista, motorizado, placa, brevete/licencia), motivo de traslado reglamentario, almacen origen, local destino y cuadricula de articulos con pesos y precios.
- `scripts__restaurantpe__almacen__guiaremision__guia-ver.html`: Vista de consulta e impresion de la guia de remision.
- `scripts__restaurantpe__almacen__guiaremision__observacionGuiaremision.html`: Fragmento para desplegar motivos de observacion o rechazo.
- `scripts__restaurantpe__almacen__ordenguiaremision__guia-lista.html` y `guia-form.html`: Formulario y bandeja para preparar "Ordenes de Guia de Remision", permitiendo planificar despachos logisticos antes de la emision fiscal formal.
- `scripts__restaurantpe__almacen__modals__ordenguiaremision-modal.html`: Modal para asociar una orden de despacho previa a la guia definitiva.
- `scripts__restaurantpe__almacen__modals__verGuiaremision.modal.html`: Modal de previsualizacion rapida de la guia.
- `scripts__restaurantpe__almacen__modals__motorizado__modal.motorizadoForm.html`: Modal de registro y asignacion de chofer o motorizado para el traslado.
- `scripts__restaurantpe__almacen__modals__alerta.impresion.matricial.modal.html`: Modal de configuracion para impresion fisica en impresoras de impacto matriciales.

---

## 2 Detalle de las pantallas clave

A continuacion se expone la anatomia tecnica de los formularios y pantallas operativas mas criticas de Almacen, detallando campos, modelos de AngularJS (`ng-model`), tipos, obligatoriedad, botones, filtros, columnas, estados del flujo y reglas de validacion.

### 2.1 Movimiento entre Almacenes (`movimientoalmacen-nuevo.html` y `movimientoalmacen.html`)

#### Cabecera del Formulario
- **Fecha de operacion**: Campo tipo fecha/hora (`rangoDeFechas.fechas.startDate`, picker modal). Obligatorio en creacion. En edicion se complementa con el checkbox `vm.movimientoalmacen.asignarFechaActual` ("Asignar fecha actual al movimiento").
- **Guia de remision ligada**: Checkbox (`vm.movimientoalmacen.conGuia`, valores `'1'` o `'0'`). Si se marca `'1'`, habilita el campo `vm.movimientoalmacen.numerodoc` (texto deshabilitado para lectura).
- **Encargado**: Input tipo texto (`vm.movimientoalmacen.movimiento_encargado`), requerido (`required`). Usuario responsable que autoriza la salida.
- **Receptor**: Input tipo texto (`vm.movimientoalmacen.movimiento_receptor`), opcional. Usuario que recibira fisicamente en destino.
- **Observacion**: Textarea (`vm.movimientoalmacen.movimiento_observacion`), requerido (`required`), 4 filas.

#### Renglon de Captura de Articulos (Fila Superior de la Tabla)
- **Busqueda de Insumo/Producto**: Selector `<ui-select>` (`vm.ingredienteInsumoSeleccionado`). Filtra asincronamente contra `vm.fnObtenerPorBusquedaIngredienteInsumoParaMovimiento`. Distingue visualmente con badges: azul `(Insumo)` o verde `(Producto)`.
- **Unidad de Medida (UM)**: Texto estatico de solo lectura (`vm.ingredienteinsumobusqueda.unidadmedida`).
- **Cantidad**: Input tipo texto (`vm.ingredienteinsumobusqueda.cantidad`), longitud maxima 5 caracteres, directiva `solo-numeros`.
- **Almacen Origen**: Selector `<ui-select>` (`vm.almacenOrigenSeleccionada`). Carga la lista `vm.almacenOrigenList` mostrando nombre de almacen y sucursal.
- **Almacen Destino**: Selector `<ui-select>` (`vm.almacenDestinoSeleccionada`). Carga la lista `vm.almacenList`.
- **Boton Agregar Linea**: Boton circular con icono `fa-plus-circle`, ejecuta `vm.fnAgregarDetallemovimientoalmacen()`. Se desactiva si no se ha completado la validacion (`!vm.fnValidarBusquedaIngredienteInsumo()`).

#### Tabla de Detalle de Movimientos Agregados
- **Columnas**:
  1. `Producto`: Etiqueta distintiva (Insumo o Producto) mas descripcion del item.
  2. `UM`: Sigla o descripcion de la unidad de medida (`unidadmedidainsumo_descripcion`).
  3. `Cantidad`: Input editable por linea (`detallemovimientoalmacen.detallemovimiento_cantidad`), obligatorio, mayor a cero, maximo 15 digitos con directiva `solo-numeros`.
  4. `Almacen origen`: Descripcion de la bodega de origen y local, mas texto en rojo si `stockActual < detallemovimiento_cantidad` advirtiendo quiebre de stock.
  5. `Almacen destino`: Descripcion de la bodega receptora y local.
  6. `Accion`: Boton rojo de papelera para remover la fila (`vm.movimientoalmacen.eliminarDeDetallemovimientoalmacen`).

#### Botones y Acciones de la Pantalla
- `Guardar avance`: Ejecuta `vm.fnGuardarAvanceMovimiento()`. Guarda un borrador para continuar luego sin alterar existencias.
- `Guardar como plantilla`: Ejecuta `vm.fnGuardarPlantilla()`. Permite nombrar este conjunto de traslados para repetirlo periodicamente.
- `Actualizar plantilla`: Ejecuta `vm.fnActualizarPlantilla()` (visible cuando se edita una plantilla existente).
- `Guardar movimiento`: Boton principal primario, ejecuta `vm.fnAgregar()`. Desactivado si el formulario es invalido (`form.$invalid`) o si hay cantidades menores o iguales a cero.
- `Editar movimiento`: Ejecuta `vm.fnEditarMovimiento()` cuando se abre en modo edicion.
- `Cancelar`: Retorna a la bandeja `almacen.movimientoalmacen`.

#### Bandeja de Movimientos (`movimientoalmacen.html`)
- **Filtros**: Local (`vm.localSeleccionado`), Estado (`vm.estadoSeleccionado`), Busqueda textual de insumo (`vm.productoFiltro`), Selector de periodo (`date-range-picker`).
- **Columnas**: C.U del movimiento (ID correlativo), Fecha y Hora, Local, Encargado, Receptor, Observacion, Acciones.
- **Acciones por Fila**:
  - `Aprobar recepcion en destino`: Boton con icono de advertencia (`fa-warning`) si `movimiento_recibido == NO`. Ejecuta `vm.fnRecibirMovimiento(id)`.
  - `Ver detalle`: Abre modal con la nota completa (`vm.obtenerDetallemovimientoPorMovimientoId`).
  - `Editar`: Lleva a `almacen.movimientoalmacen.editar` (restringido por permiso `almacen.movimientoalmacen.anularmovimiento`).
  - `Anular`: Abre modal de confirmacion de anulacion (`vm.obtenerDatosParaAnulacionMovimiento`).
  - `Descarga PDF`: Enlace directo al endpoint `/api/reports/report.php?page=movimientoalmacen_movimientoalmacen&type=pdf`.
  - `Descarga Excel`: Enlace al mismo reporte con `type=excel`.

---

### 2.2 Registro de Merma y Bajas de Stock (`merma-nuevo.html` y `merma.html`)

#### Cabecera del Formulario de Merma
- **Responsable de la merma**: Selector `<ui-select>` (`vm.mozoSeleccionado`), carga mozos y personal asignado al local (`vm.mozosPorLocalList`).
- **Fecha**: Input tipo texto (`vm.merma.merma_fecha`), requerido, picker `bs-datepicker`.
- **Hora**: Input tipo texto (`vm.hora_merma`), picker `lng-clockpicker` con icono de reloj.
- **Categoria de la salida o merma**: Selector `<ui-select>` (`vm.categoridaSeleccionada`), alimentado desde `vm.categoriaSalidaList`. Al lado cuenta con un boton de acceso rapido "Nueva categoria de salida" que abre el modal `vm.fnAbrirModalCategorias()` y un boton "Actualizar" (`fa-refresh`).
- **Imprimir boleta**: Checkbox (`vm.merma.imprimir`, 1 o 0). Dispara impresion fisica al terminar.

#### Captura de Items a Mermar
- **Renglon de Entrada**: Cantidad (maximo 5 caracteres, `solo-numeros`), Busqueda de Insumo/Producto (`ui-select`), Almacen de baja (`ui-select`), Unidad de medida (texto estatico) y boton de adicion `fa-plus-circle`.
- **Tabla de Detalle**:
  - `#`: Indice autoincremental.
  - `Cod.`: ID del insumo o producto.
  - `Cantidad`: Editable (`detallemerma.detallemerma_cantidad`), requerido, dispara recalculo de importe (`fnCalculaImporteDetallemerma`).
  - `Producto`: Descripcion e icono de tipo.
  - `Almacen`: Selector individual por linea (permite mermar articulos de bodegas distintas en una sola acta).
  - `UM`: Unidad de medida.
  - `Costo`: Costo unitario promedio o FIFO registrado en la base de datos.
  - `Importe`: Multiplicacion de Cantidad por Costo Unitario.
  - `Eliminar`: Boton rojo de papelera.
- **Razon de la salida (Justificacion)**: Textarea (`vm.merma.merma_razon`), requerido (`required`), con contador en tiempo real: `({{vm.merma.merma_razon.length || 0}}/300)` caracteres maximo.

#### Reglas y Validaciones
- Solo se permite registrar mermas con cantidades mayores a cero.
- La suma de importes se totaliza para afectar los informes de perdidas financieras en el cierre de turno y mes.
- Al anular una merma desde la bandeja, el sistema revierte el descuento y devuelve las existencias al almacen origen respectivo.

---

### 2.3 Cuadre de Stock Manual y Regularizacion (`regularstock.html`)

#### Proposito y Advertencias Operativas
Esta pantalla funciona como una hoja de calculo matricial de ajuste contable de existencias. Presenta una alerta superior destacada:
- *"Actualmente cuenta con (X) Ventas, (X) Compras, (X) Guias, (X) Preparacion de recetas, (X) Mermas pendientes de procesar stock. Puede hacerlo haciendo clic aqui (`almacen.procesarstock.procesar`)."*
Regla: No debe ejecutarse un cuadre manual si hay transacciones pendientes de consolidar en el proceso batch diferido.

#### Filtros Superiores
- `Categoria`: Selector de categoria de plato o familia de insumos.
- `Tipo`: Selector del tipo de existencias (`Insumo`, `Receta`, `Porcionable`, `Producto`).
- `Almacen`: Seleccion de un almacen especifico o consolidado.
- `Filtro de texto`: Busqueda rapida con boton "Buscar (ENTER)".
- `Fecha del cuadre manual`: Campo fecha obligatorio (`vm.cuadremanual_fecha`, `bs-datepicker`).
- `Hora`: Campo hora (`vm.cuadramanual_hora`, `lng-clockpicker`).
- `Actualizar costos`: Checkbox (`vm.actualizarCostos`). Si se activa, anade columnas para revaluar el costo unitario de reposicion base de los insumos.
- `Limitar coincidencias`: Checkbox para acotar a los primeros 30 registros y evitar sobrecarga del navegador.
- `Razon del cuadre`: Textarea libre para justificar el motivo del descuadre contable.

#### Estructura Matricial de la Tabla
- **Columnas Fijas**:
  - `Producto / Insumo`: Descripcion del item y presentacion.
  - `Tipo`: Badge amarillo (Insumo), verde (Receta), azul (Porcionable o Producto).
  - `Categoria`: Categoria a la que pertenece.
  - `Medida`: Unidad de medida principal.
- **Columnas Dinamicas por cada Almacen Activo**:
  - `Stock`: Input editable directo (`stockalmacen.inventario_cantidad`). Al lado cuenta con un boton de comentario (`fa-comment`) para abrir el modal `modal-notacuadre.html` y dejar una nota justificativa especifica para ese insumo.
  - `Costo UM base` (visible si `actualizarCostos` esta marcado): Input editable (`stockalmacen.costoNuevo`) con boton del simbolo de moneda (`S/`).
  - `Valorizacion`: Campo calculado automaticamente (`stockalmacen.cantidad2 * stockalmacen.costoNuevo`).
  - `Variacion`: Indicador visual dinamico. Muestra en verde con signo `+` si hubo aumento de stock, o en rojo si hubo disminucion respecto al saldo previo.
- **Pie de Pagina**: Boton de recalculo de valorizacion (`fa-refresh`) y monto total valorizado del stock: `Valorizacion: S/ {{vm.valorizacionStock}}`.

---

### 2.4 Regularizacion Diferida de Stock (`procesarstock.html`)

#### Logica de Operacion y Regla de los 5 Dias
Restaurant.pe no corre el costeo de salidas de venta de manera transaccional inmediata en todas las operaciones, sino que requiere un proceso de recalculado diferido.
- **Alerta de advertencia**: *"Esta por ejecutar un delicado proceso para regularizar el stock segun el tipo que haya seleccionado. A continuacion seleccione un rango de fechas (No puede ser mayor a 5 dias para ventas), luego presione el boton 'Procesar stock' para culminar."*
- **Campos del Proceso**:
  - Local: Selector `<ui-select>` de sucursales.
  - Tipo de transaccion a procesar: Selector entre `1: Compra`, `2: Guia`, `3: Preparacion receta`, `4: Venta`, `5: Merma`.
  - Cantidad por pagina: 10, 25, 50, 100.
  - Periodo: `date-range-picker`.
- **Previsualizacion**: Tabla con Fecha, Tipo (badges), Documento, Numero y Referencia.
- **Boton Procesar stock**: Ejecuta `vm.fnGuardarCambios()`, consolidando los saldos en las tablas de kardex.

---

### 2.5 Arqueo de Inventario Fisico (`arqueoinventario.html`)

#### Diseno de la Pantalla de Conteo Fisico
Diseñada para realizar auditorias fisicas periodicas (ciegas o guiadas) en estantes y congeladoras:
- **Cabecera**:
  - Selector de Almacen a auditar.
  - Selector de Tipo de item (Insumo, Receta, Porcionable, Producto).
  - Paginacion y filtro rapido de texto.
  - Textarea: Observacion global del arqueo (`vm.razon`).
  - Boton "Guardar cambios": Consolida el arqueo (`vm.fnGuardarCambios()`).
  - Boton "Guardar como plantilla": Abre `modal.plantillasarqueoinventario.html` para guardar la lista de items seleccionados como plantilla de conteo recurrente.
- **Cuadricula de Conteo**:
  - Datos del item: Producto/Insumo, Tipo, Categoria, Medida.
  - Columnas por Almacen:
    1. `Stock`: Input editable (`inventario_cantidad`) con boton de nota individual (`detallearqueoinventario_nota`).
    2. `Lotizar`: Boton "Asignar lote" que se activa si el item esta configurado con costeo `CONTROL_COSTO_FIFO` y la cantidad contada es mayor a cero. Abre el modal `modal-asignacionlotearqueoinventario.html`.
    3. `Agregar a plantilla`: Checkbox (`stockalmacen.agregarAPlantilla`) para seleccionar que articulos formaran parte de la plantilla rotativa.

#### Modal de Asignacion de Lotes en Arqueo (`modal-asignacionlotearqueoinventario.html`)
- Tabla de lotes con: `#`, Codigo de Lote, Cantidad contada (`lotedetallearqueoinventario_cantidadlote`) y Fecha de Vencimiento (`lotedetallearqueoinventario_fechavencimiento`).
- Botones para agregar multiples sub-lotes con distintas fechas de caducidad hasta completar la cantidad fisica total ingresada.

---

### 2.6 Tablero de Stock y Generacion de Compras (`stock.html`)

#### Filtros y Modos de Vista
- `Almacen`: Selector desplegable con opcion de ver un almacen puntual o todos los almacenes del local.
- `Tipo`: Insumo, Receta, Porcionable, Descartable, Producto terminado.
- `Categoria`: Categoria de platos o familia de insumos (cambia dinamicamente segun el tipo elegido).
- `Filtro de texto`: Busqueda rapida por nombre.
- `Ver solo por debajo del stock minimo`: Checkbox (`vm.debajoStock`). Filtra de inmediato los articulos en situacion de quiebre o alerta de reposicion.
- `Ver sobre stock maximo`: Checkbox (`vm.arribaStock`). Detecta articulos sobreabastecidos.
- `Mostrar por presentacion de compra`: Checkbox (`vm.porpresentacioncompra`). Convierte las unidades base (ej. gramos o mililitros) a empaques de compra (ej. sacos de 50 kg, botellas de 1 L o cajas de 24 und).

#### Columnas de la Matriz de Stock
1. `Producto / Insumo`: Nombre, presentacion y sigla de unidad de medida en superindice.
2. `Tipo`: Etiquetas a color identificando la naturaleza del articulo.
3. `Categoria`: Familia a la que pertenece.
4. `Almacenes`: Columnas repetidas por cada bodega activa con:
   - `Stock`: Existencia fisica actual (en rojo si es menor a cero).
   - `Minimo req.` (o `Maximo req.` si se activo sobre-stock).
   - `Faltante` (calculo matematico: `stockMaximo - inventario_cantidad`).
5. `Stock total`: Sumatoria consolidada de existencias en todas las bodegas del local.

#### Generacion Automatica de Ordenes de Compra
En la parte superior, si se ha seleccionado un almacen especifico, se habilita el menu desplegable "Generar orden compra":
- `Por stock minimo`: Abre modal `vm.fnAbrirModalGenerarOCPorStock(0)`. Calcula la cantidad requerida para que los insumos bajo el minimo alcancen su umbral de seguridad y genera los borradores de compra.
- `Por stock maximo`: Abre modal con parametro `(1)`. Calcula la reposicion hasta el techo maximo de capacidad de almacenamiento.
- `Exportar Excel`: Descarga la matriz completa formateada.

---

### 2.7 Kardex de Insumos (`individual.html`)

#### Parametros y Filtros de Cabecera
- Selector de tipo de kardex (`selector.html`): Individual, General, Avanzado.
- Checkbox `Kardex valorizado` (`vm.esKardexValorizado`): Muestra u oculta las columnas monetarias (sujeto a permiso de seguridad `almacen.vercostos`).
- Checkbox `Ver costo sin impuesto` (`vm.verCostoSinImpuesto`).
- Botones de mantenimiento de base de datos (visibles solo para usuarios con rol de sistema `esUsuarioDeSistema()`):
  - `Corregir Item`: Ejecuta `vm.fnCorregirProblemaEntradasKardex(false)`.
  - `Corregir Almacen`: Ejecuta con `true`. Resuelve inconsistencias de saldos historicos.
- Filtro de Insumo/Producto: Buscador `<ui-select>` con autocompletado y clasificacion visual de tipos.
- Motivo de movimiento: Selector para aislar compras, ventas, transferencias, recetas, ajustes o mermas.
- Almacen y Local.
- Rango de fechas con selector de calendario.

#### Bloque de Indicadores Clave (Tarjetas Superiores)
- **Stock inicial**: Saldo con el que inicio el periodo filtrado en su unidad de medida.
- **Cantidad de entradas**: Sumatoria total de ingresos en verde.
- **Cantidad de salidas**: Sumatoria de egresos en rojo.
- **Stock final**: Saldo restante a la fecha de corte.

#### Columnas del Kardex Detallado
1. `Fecha y Hora`: Registro cronologico exacto.
2. `Fecha Vencimiento`: Visible si el insumo opera bajo metodo `FIFO`.
3. `Codigo Lote`: Numero de lote asignado (en azul si es entrada, en naranja si es salida).
4. `Almacen`: Bodega donde ocurrio la transaccion (si se consultan todos los almacenes).
5. `Motivo`: Descripcion de la causa (Compra, Venta, Traslado, Preparacion, Merma, Ajuste). Incluye etiquetas de estado (`Con lote`, `Agotado`, `Anulado`) y enlace interactivo `Ver detalle` que abre la nota o documento origen que provoco el asiento.
6. `Unidad de medida`: UM del insumo.
7. `Entrada`: Cantidad positiva precedida de signo `+` en verde.
8. `Salida`: Cantidad negativa con signo `-` en rojo.
9. `Stock`: Saldo acumulativo continuo despues del movimiento.
10. `Lote restante` (FIFO): Cantidad no consumida que queda disponible en ese lote especifico.
11. `Costo unitario`: Valor de adquisicion del lote (solo visible si esta valorizado).
12. `Costo promedio`: Valor ponderado continuo (solo en metodo Promedio Ponderado).
13. `Costo operacion`: Importe monetario de la entrada o salida.
14. `Stock valorizado`: Monto total acumulado en soles de las existencias a ese momento.

---

### 2.8 Preparacion de Receta Base y Produccion Interna (`preparacionreceta-detalle-base.html`)

#### Estructura del Formulario de Cocina
Diseñado para registrar la preparacion de sub-recetas (ej. salsa de lomo, crema pastelera, masa de waffle, jarabe de cafe):
- **Cabecera**:
  - Titulo: "Preparar receta base: [Nombre del Insumo Elaborado]".
  - Alerta si el insumo base esta anulado con boton para reactivarlo.
  - Fecha (`vm.fechaPreparacionReceta`, obligatorio) y Hora (`vm.horaPreparacionReceta`).
  - Almacen de preparacion: Bodega donde se descontaran los ingredientes y donde ingresara el producto final.
- **Arbol Jerarquico de Insumos (`ui-tree`)**:
  - Despliega en cascada todos los insumos y sub-recetas anidadas requeridas.
  - Muestra por componente: Stock actual en bodega, Tipo, Medida, Cantidad teorica a descontar, Costo proporcional y checkbox `Recalcular` para ajustar la proporcion si se cambia el tamano del batch.
  - Advertencia critica en rojo: *"Existen insumos que no cuentan con el stock suficiente para preparar esta receta."*
- **Panel de Resumen y Rendimiento**:
  - `Cantidad resultante`: Input editable donde el cocinero coloca el rendimiento real obtenido (ej. la receta estandar rinde 2.0 kg pero salieron 1.85 kg).
  - `Stock actual`: Existencia previa en bodega.
  - `Costo receta base`: Costo monetario calculado en tiempo real segun los insumos consumidos.
  - `Fecha de vencimiento`: Requerido obligatoriamente si el sistema trabaja con costeo FIFO.
  - `Observacion`: Textarea para documentar desviaciones del proceso o variaciones organolepticas.
- **Accion**: Boton "Guardar y preparar receta base" (`vm.guardarPreparar()`). Genera simultaneamente las notas de salida de materias primas y la nota de entrada del producto procesado.

---

### 2.9 Porcionamiento de Insumos (`porcionamiento-detalle.html`)

#### Asistente de Despiece en 3 Pasos
- **Paso 01: Origen y Almacen**:
  - Seleccion del almacen de movimiento.
  - Visualizador gigante del stock actual disponible del insumo madre (ej. Pechuga de pollo entera o Bloque de queso Edam).
- **Paso 02: Rendimiento y Porciones Hijas**:
  - Arbol de componentes resultantes pre-configurados en la ficha tecnica del insumo porcionable.
- **Paso 03: Balance de Masa y Mermas**:
  - `Cantidad a porcionar`: Cantidad del insumo madre retirada para el corte.
  - `Resultado`: Sumatoria neta de las porciones obtenidas.
  - `Restante a porcionar`: Diferencia pendiente de fraccionar.
  - `Merma`: Desperdicio o merma inevitable del proceso (calculada en cantidad y porcentaje).
  - `Usar diferencia como merma`: Checkbox (`vm.insumo.generarMerma`). Si se marca, el sistema genera automaticamente un asiento de merma de corte para absorber la perdida sin alterar el costo del saldo restante.
  - `Observacion`: Textarea justificativo.
  - `Guardar y porcionar insumo`: Ejecuta la baja del insumo madre y el alta de los insumos porcionados derivados.

---

### 2.10 Orden de Produccion (`ordenproduccion.html` y `ordenproduccion-nueva.html`)

#### Ciclo de Vida y Estados
- `0: Pendiente` (Badge amarillo).
- `1: En preparacion` (Badge verde).
- `2: Finalizado` (Badge azul).
- `3: Anulada` (Badge rojo).

#### Emision de la Orden (`ordenproduccion-nueva.html`)
- Fecha de produccion (`bs-datepicker`, requerido), Hora (`lng-clockpicker`), Encargado.
- Buscador de recetas `<ui-select>` con adicion interactiva mediante `fa-plus`.
- Selector de Almacen.
- Tabla de recetas a programar: `#`, Cantidad estimada (`solo-numeros`), Unidad de medida, Nombre de receta y boton de eliminacion.

#### Explosion de Materiales y Compra Automatica (`modal-ordencompra-por-ordenproduccion.html`)
Desde la bandeja, cualquier orden de produccion pendiente cuenta con el boton "Orden de compra":
- Analiza la formula de todas las recetas incluidas en la orden frente al stock actual de los almacenes.
- Agrupa los insumos faltantes segun el proveedor habitual predeterminado.
- Presenta tabla con: Proveedor, Cantidad estimada y seleccion por casilla.
- Boton "Generar ordenes de compra": Crea de inmediato las OC correspondientes en el modulo de Compras para que administracion gestione el abastecimiento.

---

### 2.11 Guia de Remision Electronica de Almacen (`guia-form.html` y `guia-lista.html`)

#### Campos Reglamentarios SUNAT en el Formulario
- **Documento**: Serie (`guiaremision_serie`, ej. T001) y Correlativo (`guiaremision_correlativo`), ambos requeridos.
- **Fechas**: Fecha de emision y hora (`guiaremision_fechaemision`, `guiaremision_horaemision`), Fecha de inicio de traslado y hora (`guiaremision_fechatraslado`, `guiaremision_horatraslado`), requeridos.
- **Destinatario**: Cliente o Razon Social (`vm.cliente`), con boton integrado para registrar nuevo cliente sin abandonar el formulario.
- **Punto de Llegada**: Ubigeo de Destino (`vm.ubigeoPeruSeleccionado`, selector de departamentos/provincias/distritos del Peru) y Direccion Destino exacta (`guiaremision_destinonombre`).
- **Datos del Traslado y Transporte**:
  - Modalidad de transporte: Publico o Privado.
  - Transportista seleccionado (`vm.transportistaSeleccionado`).
  - Motorizado / Chofer (`vm.motorizadoSeleccionado`).
  - Licencia de conducir (`guiaremision_transportistalicencia`).
  - Placa del vehiculo (`guiaremision_transportistaplaca`).
- **Datos Logisticos Internos**:
  - Almacen Origen de salida (`vm.almacenSeleccionado`).
  - Local Destino (`guiaremision_localdestinoid`).
  - Motivo de traslado: Venta, Traslado entre establecimientos de la misma empresa, Compra, Devolucion, Traslado para transformacion.
  - Observaciones: Textarea libre.
- **Detalle de Bienes a Trasladar**:
  - Cantidad, Busqueda de Producto, Categoria, Almacen origen, Unidad de medida, Precio unitario, Peso total en kg e Importe.
- **Acciones y Validaciones**:
  - "Verificar Disponibilidad": Valida si hay stock suficiente en los almacenes antes de emitir la guia.
  - "Guardar guia de remision": Emite el documento electronico.
  - "Anular y Corregir": Proceso fiscal de emision de guia de anulacion o rectificatoria.
  - Impresion: Formato Base A4 y Formato Matricial de tickets.

---

## 3 Confirmaciones o correcciones a los informes previos

Al contrastar la evidencia "EN VIVO" de las plantillas HTML de AngularJS contra los informes previos almacenados en `/home/jose/JoseEM/caprichos/analisis/almacen-informes/` (`almacen.md`, `stock.md`, `informes.md`, `modulos.md`), se determinan las siguientes confirmaciones, rectificaciones y hallazgos clave:

### 3.1 Correccion al estado de la inspeccion en vivo
- **Lo que decian los informes previos (`almacen.md`, `informes.md`, `modulos.md`)**: Indicaban taxativamente *"NO SE PUDO VER EN VIVO: requiere que el usuario inicie sesion"*, explicando que al ingresar por navegador a `https://restaurant.pe` el sistema solicitaba credenciales y no se podia avanzar.
- **Correccion basada en evidencia**: Dicha limitacion ocurrio por intentar acceder al servidor web en linea sin credenciales. Las plantillas reales de AngularJS extraidas directamente del sistema en produccion se encuentran disponibles y completas en `/tmp/claude-1000/almacen-agy/vivo/almacen/` (201 archivos). Por tanto, la presente auditoria constituye la primera verificacion 100% fidedigna campo por campo de la interfaz viva de Restaurant.pe.

### 3.2 Confirmacion de la coexistencia de dos flujos de Abastecimiento
- **Confirmacion**: Se confirma lo expuesto en `almacen.md` sobre el flujo en dos fases de Requerimientos y Movimientos Internos (Plantilla predefinida -> Canje real). Las plantillas `requerimientov2__requerimientos.view.html`, `modal-registrar-plantilla.view.html`, `modal-canjear-requerimiento.view.html`, `movimientointerno.html` y `modal-canje-movimiento-interno.view.html` demuestran que Restaurant.pe creo una segunda version ("v2") para desacoplar la definicion del catalogo recurrente de pedidos respecto a la emision de la transferencia fisica.
- **Hallazgo adicional no documentado**: Se descubre la existencia del hub unificado `scripts__restaurantpe__almacen__lista-procesos__lista-de-procesos.view.html`, que agrupa en tres pestañas horizontales los Requerimientos, las Recepciones y los Movimientos Internos, permitiendo consultar el avance de cada transaccion a traves de 8 estados operativos (0: Pendiente, 1: En revision, 2: Aprobado, 3: Rechazado, 4: Despachado, 5: Recepcionado, 6 y 7: Variantes de transporte).

### 3.3 Confirmacion y Precision sobre el Arqueo de Inventario y Lotes FIFO
- **Confirmacion**: Se confirma que Restaurant.pe soporta toma fisica de inventario y regularizacion de stock.
- **Precision corregida**: Los informes previos trataban el "Cuadre de stock manual" y el "Arqueo de inventario" como sinonimos o terminos intercambiables. La evidencia en vivo demuestra que son dos submoudulos totalmente separados con logicas distintas:
  1. `regularstock.html` (Cuadre de stock manual): Es un ajuste contable directo donde se sobreescribe el stock y opcionalmente el costo de reposicion unitario de los insumos.
  2. `arqueoinventario.html` (Arqueo de inventario): Es una toma de inventario fisico por lote. Si el insumo esta configurado bajo costeo `CONTROL_COSTO_FIFO`, la plantilla obliga a abrir el modal `modal-asignacionlotearqueoinventario.html` para ingresar el codigo del lote fisico y la fecha de vencimiento. Ademas, permite guardar el arqueo como plantilla de auditoria rotativa (`modal.plantillasarqueoinventario.html`).

### 3.4 Confirmacion sobre el Proceso Batch "Procesar Stock"
- **Confirmacion**: El archivo `procesarstock.html` valida el hallazgo documental de que Restaurant.pe acumula ventas, compras, mermas y recetas sin procesar, y requiere que el usuario lance un proceso de calculo masivo periodico con un tope maximo de 5 dias para ventas.
- **Impacto para Caprichos**: Este comportamiento es una debilidad de diseno de Restaurant.pe (arquitectura heredada basada en jobs batch de PHP/MySQL). Para Caprichos se confirma como prioridad corregir esta brecha, implementando un karded transaccional atomico en tiempo real.

### 3.5 Hallazgo de Herramientas de Reparacion de Kardex
- **Hallazgo nuevo**: En `kardex/individual.html`, se comprueba la existencia de los botones `Corregir Item` y `Corregir Almacen` (`vm.fnCorregirProblemaEntradasKardex`), restringidos a superusuarios. Esto evidencia que el calculo de inventarios de Restaurant.pe sufre frecuentemente de corrupcion o desincronizacion de saldos entre compras y ventas, requiriendo rutinas de reparacion forzada.

### 3.6 Guia de Remision Electronica Integrada a SUNAT
- **Confirmacion**: La plantilla `guia-form.html` confirma que las guias de remision en Restaurant.pe no son simples notas de envio internas, sino documentos tributarios electronicos plenos que exigen Ubigeo de 6 digitos, licencia de conducir del chofer, placa del vehiculo y clasificacion del motivo de traslado segun tabla de SUNAT.

---

## 4 Lo que falta en el mockup, priorizado

Al auditar el prototipo funcional actual en `/tmp/claude-1000/almacen-agy/fuente/Admin.dc.html`, se constata que la seccion de Almacen (`isAlmacenView`, linea 1057) contiene unicamente una tabla generica de 7 columnas (`['Fecha', 'Tipo', 'Insumo', 'Cantidad', 'Origen', 'Destino', 'Documento']`) y un modal basico (`openMov`). Carece de todos los mecanismos de control, costeo, produccion y trazabilidad requeridos por una cafeteria operativa.

A continuacion se presenta la matriz de brechas priorizada:

| Falta identificada | Pantalla / Plantilla de referencia en Restaurant.pe | Gravedad | Esfuerzo (S/M/L) |
| :--- | :--- | :--- | :--- |
| **Kardex individual detallado con costeo (Promedio/FIFO)**: Falta la pantalla con balance inicial, entradas, salidas, saldo final, costo unitario, costo promedio, costo de operacion, valorizacion en soles y trazabilidad por lote y vencimiento. | `almacen__kardex__individual.html` y `selector.html` | Critica | L |
| **Flujo de Requerimientos y Despachos internos**: Falta el mecanismo de solicitud entre areas (ej. de Barra o Salon hacia Almacen Central o Produccion), aprobacion y seguimiento de estados. | `almacen__requerimientov2__requerimientos.view.html` y `lista-procesos__tap-requerimiento.view.html` | Critica | M |
| **Recepcion con corroboracion contra orden/guia**: Falta la interfaz que permite al receptor confrontar lo enviado contra lo recibido fisicamente y registrar faltantes o danos. | `almacen__recepcion__recepcion.view.html` y `modal-canje-guia-remision-mov.view.html` | Critica | M |
| **Modulo de Mermas con categorizacion y costo**: En el mockup la merma es solo una fila en una tabla; falta registrar responsable, hora, categoria de merma (vencimiento, rotura), calculo de perdida economica y justificacion obligatoria. | `almacen__merma__merma-nuevo.html` y `categoriasalida-modal.html` | Alta | S |
| **Arqueo de inventario fisico / Conteo rotativo**: Falta la pantalla para realizar auditorias fisicas periodicas, registrar notas por celda de descuadre y lotizar insumos perecibles. | `almacen__arqueoinventario__arqueoinventario.html` y `modal-asignacionlotearqueoinventario.html` | Alta | M |
| **Monitor de Stock con faltantes y reposicion automatica**: El mockup tiene una tabla basica de stock; falta calcular el faltante respecto al maximo y el boton disparador para generar la Orden de Compra por stock minimo o maximo. | `almacen__stock__stock.html` | Alta | M |
| **Preparacion de Recetas Base en taller/cocina**: Falta la orden de preparacion de recetas intermedias (cremas, masas, jarabes) con explosion de insumos requeridos, validacion de stock previo y registro de lote/vencimiento. | `almacen__preparacionreceta__registrar__preparacionreceta-detalle-base.html` | Alta | M |
| **Porcionamiento y despiece de insumos con control de merma**: Falta el asistente en 3 pasos para convertir insumos comprados enteros (bloques de queso, jamones, tortas) a porciones hijas absorbiendo la merma de corte. | `almacen__porcionamientoinsumo__registrar__porcionamiento-detalle.html` | Media | M |
| **Orden de Produccion con compra automatica agrupada**: Falta la programacion de fabricacion que analiza materias primas faltantes y crea ordenes de compra consolidadas por proveedor. | `almacen__ordenproduccion__ordenproduccion.html` y `modal-ordencompra-por-ordenproduccion.html` | Media | L |
| **Guia de Remision electronica (traslado SUNAT)**: Falta el formulario con ubigeo, chofer, placa de vehiculo y motivo reglamentario para transferencias entre locales o envios logisticos. | `almacen__guiaremision__guia-form.html` | Media | L |
| **Gestion de plantillas y borradores (avances)**: En transferencias rutinarias de cafeterias (ej. abastecer la barra todas las mananas), falta guardar borradores o plantillas predeterminadas para evitar reescribir 20 items cada dia. | `almacen__movimientoalmacen__movimientoalmacen-nuevo.html` | Baja | S |
| **Notas de movimiento imprimibles (PDF/Ticket)**: Falta generar el comprobante formal de movimiento con firmas de entregado y recibido para control interno fisico. | `almacen__modals__detallemovimientoalmacen-modal.html` | Baja | S |

---

## 5 Mejoras sobre restaurant.pe (menos tablas, todo en un solo lugar)

La auditoria revela que Restaurant.pe adolece de una fragmentacion excesiva producto de anos de desarrollo incremental en capas. Un almacenero en Restaurant.pe debe saltar entre 8 o 10 pantallas distintas para completar una rutina diaria sencilla, y el sistema obliga a correr procesos batch manuales para que los numeros cuadren.

Para Caprichos, proponemos una arquitectura limpia, unificada y reactiva bajo las siguientes premisas:

### 5.1 Eliminar el Proceso Batch "Procesar Stock": Karded Atomico en Tiempo Real
- **Problema en Restaurant.pe**: Obliga a ir a `procesarstock.html` para regularizar ventas, compras y recetas en bloques de hasta 5 dias. Si el usuario no lo corre, los reportes de stock y kardex muestran datos falsos y advertencias de desactualizacion.
- **Mejora para Caprichos**: Actualizacion transaccional atomica. Cada comanda cerrada en caja, cada recepcion de compra aprobada, cada preparacion de receta y cada merma confirmada descuenta o incrementa inmediatamente el saldo en el kardex y en el stock del almacen correspondiente. Cero procesos batch manuales.

### 5.2 Unificacion de Pantallas: Hub Operativo "Todo en Uno"
- **Problema en Restaurant.pe**: Existen pantallas paralelas y desconectadas: `movimientoalmacen.html` (movimientos), `movimientointerno.html` (movimiento por plantilla), `requerimientos.view.html` (pedidos), `recepcion.view.html` (recepcion) y `lista-de-procesos.view.html` (hub parcial).
- **Mejora para Caprichos**: Disenar una consola central de Almacen con 4 vistas integradas en la misma pantalla:
  1. **Tablero de Control**: Stock actual por almacen, alertas de stock bajo y faltantes con boton directo de "Reponer" (que genera la Orden de Compra o Requerimiento con un clic).
  2. **Movimientos y Despachos**: Historial y registro de entradas, salidas, transferencias y mermas en un solo modal unificado con pestana de seleccion rapida.
  3. **Requerimientos y Recepcion**: Solicitud interna entre barra/cocina y bodega central, con corroboracion en dos clics al recibir mercaderia.
  4. **Kardex y Trazabilidad**: Consulta dinamica por producto sin salir de la vista principal, integrando lote, vencimiento y costo en una sola tabla interactiva.

### 5.3 Simplificacion del Registro de Mermas y Ajustes
- **Problema en Restaurant.pe**: Para registrar una merma hay que abrir un formulario complejo de pantalla completa con 10 campos, seleccionar categorias en un modal secundario y luego confirmar.
- **Mejora para Caprichos**: Modal ligero de "Registrar Merma": seleccion del insumo, cantidad, motivo en una lista desplegable predefinida (Vencido, Rotura, Deterioro, Error de elaboracion), costo sugerido automatico y confirmacion inmediata con actualizacion del kardex.

### 5.4 Integracion Fluida de Produccion y Recetas
- **Problema en Restaurant.pe**: Para elaborar una masa o jarabe, el usuario debe navegar a `preparacionreceta`, buscar la receta base, abrir otra pantalla con un arbol anidado complejo y confirmar. Si quiere fraccionar un queso, debe ir a otro submoudulo distinto (`porcionamientoinsumo`).
- **Mejora para Caprichos**: Ficha de "Elaboracion / Transformacion":
  - Selector de operacion: "Preparar Receta" (ej. jarabe de goma, masa de queque) o "Fraccionar / Porcionar" (ej. cortar barra de queso o queque en porciones).
  - Al indicar la cantidad a producir, el sistema muestra los insumos que consumira y avisa en verde o rojo si hay stock suficiente en la estacion.
  - Al presionar "Registrar", da de baja los insumos y de alta el producto terminado o las porciones en un solo paso.

### 5.5 Supresion de Herramientas de Mantenimiento Redundantes
- Se eliminan por completo los botones tecnicos como "Corregir Item" o "Corregir Almacen" que delatan fallas en la base de datos de Restaurant.pe. La integridad referencial y el costeo matematico de Caprichos seran consistentes por diseno.

---

## 6 NO VERIFICADO

En apego riguroso a las normas de auditoria objetiva, se declaran los siguientes aspectos tecnicos y operativos que no pudieron verificarse unicamente a partir de las plantillas HTML de AngularJS analizadas:

1. **Procedimientos almacenados y triggers de base de datos (Backend)**: Los calculos matematicos internos ejecutados en el servidor PHP/MariaDB para la valorizacion de existencias bajo el metodo FIFO (consumo ordenado de capas de costos de compras anteriores) y Promedio Ponderado no estan visibles en el codigo HTML de las plantillas; solo se comprueban los filtros visuales y los modelos del cliente.
2. **Servicio web de comunicacion con SUNAT para Guias de Remision**: Los endpoints SOAP/REST que generan el archivo XML de la Guia de Remision Electronica, la firma digital y la recepcion del CDR (Constancia de Recepcion de SUNAT) residen en el backend y no pueden auditarse desde los archivos de interfaz.
3. **Impresion fisica por puerto serial/RAW en impresoras matriciales**: La directiva de AngularJS y el software intermediario (ej. PrintServer o agente local de impresion de Restaurant.pe) que interactua con el hardware de impresion de boletas de almacen no forman parte del arbol de plantillas HTML.
4. **Control de autorizaciones por permisos de usuario a nivel de API**: Si bien se observan las directivas `ng-if="Security.hasAccess(...)"` en los botones de edicion y anulacion, no es verificable en las plantillas si la API REST valida nuevamente estos permisos en el backend al recibir las peticiones HTTP.
5. **Comportamiento en condiciones de desconexion (Modo Offline)**: No se evidencia en las plantillas analizadas la existencia de Service Workers o mecanismos de almacenamiento local estructurado (IndexedDB) para operar el modulo de almacen sin conexion a internet; el diseno observado presupone conexion continua a la nube.

---

INFORME LISTO.

---
id: ANA-CAP-009
tipo: analisis
titulo: "Analisis Funcional EN VIVO: Informes de Inventario y Compras de restaurant.pe"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, almacen-informes]
---

# Analisis Funcional EN VIVO: Informes de Inventario y Compras de restaurant.pe

**Proyecto**: Caprichos - Cafeteria de Especialidad (Lima, Peru)  
**Rol Evaluado**: Almacen (`ROLES.almacen`)  
**Fuentes Analizadas (EN VIVO)**: Plantillas reales de AngularJS extraidas del sistema en funcionamiento ubicadas en `/tmp/claude-1000/almacen-agy/vivo/informes/` y `/tmp/claude-1000/almacen-agy/vivo/almacen/`.  
**Mockup de Referencia**: `/tmp/claude-1000/almacen-agy/fuente/Admin.dc.html`.  
**Informes Previos Contrastados**: `/home/jose/JoseEM/caprichos/analisis/almacen-informes/informes.md`, `stock.md`, `compras.md`, `almacen.md`, `modulos.md`, `vivo-almacen.md`.  
**Destino del Documento**: `/home/jose/JoseEM/caprichos/analisis/almacen-informes/vivo-informes.md`  

---

## 1 Pantallas encontradas (lista con nombre de plantilla y que hace)

A partir de la inspeccion exhaustiva de las plantillas HTML de AngularJS en `/tmp/claude-1000/almacen-agy/vivo/informes/` y los componentes relacionados en `vivo/almacen/`, se identifico la arquitectura completa del modulo de informes. El sistema restaurant.pe organiza los reportes desde un Hub central (`scripts__restaurantpe__informes__index.html`), estructurado en dos macro-areas operativas cruciales para Almacen: **Inventario** y **Compras**.

### 1.1 Informes de Inventario y Almacen

1. `scripts__restaurantpe__informes__inventario__stockvalorizado.html`: Pantalla principal de valorizacion de existencias. Presenta una matriz dinamica de productos e insumos desglosada por cada almacen fisico, calculando cantidades, costo unitario promedio y stock valorizado total. Protegida por el permiso de seguridad `almacen.vercostos`.
2. `scripts__restaurantpe__informes__inventario__stockvalorizado__stockvalorizadocomparativo.html`: Reporte de contraste de inventario valorizado por periodos. Muestra saldos iniciales, ingresos, salidas y saldos finales entre rangos de fechas.
3. `scripts__restaurantpe__informes__inventario__stockfechas.html`: Balance de existencias a una fecha de corte o entre fechas determinadas, comparando stock inicial, costo, valorizacion inicial contra stock final, costo y valorizacion final por almacen.
4. `scripts__restaurantpe__informes__inventario__consolidadostockporlocal__consolidadostockporlocal.html`: Matriz comparativa de stock fisico de insumos y productos distribuidos por locales comerciales, calculando totales, umbrales minimos, maximos y diferencias de abastecimiento.
5. `scripts__restaurantpe__informes__inventario__kardex.html`: Kardex fisico y valorizado individual de movimientos. Permite consultar el historico cronologico de entradas, salidas y saldos de un insumo o producto especifico, con cabecera de saldo actual.
6. `scripts__restaurantpe__informes__inventario__kardexvalorizado.html`: Variante del kardex individual enfocada especificamente en la valorizacion monetaria paso a paso, incorporando columnas obligatorias de observaciones de operacion, costo unitario, costo promedio ponderado y costo total de cada movimiento.
7. `scripts__restaurantpe__informes__inventario__kardexsunat.html`: Kardex tributario oficial ajustado al Formato 13.1 de SUNAT (Libro de Inventario Permanente Valorizado). Filtra operaciones bajo normatividad contable peruana (compras, guias, remisiones, ventas y transferencias).
8. `scripts__restaurantpe__informes__inventario__kardexconsolidadoporfechas__kardexconsolidadoporfechas.html`: Vista consolidada de movimientos de kardex en bloque para todos los articulos dentro de un periodo.
9. `scripts__restaurantpe__informes__inventario__productosporvencer.html`: Tablero de control preventivo de vencimientos basado en lotes de compra. Permite filtrar articulos que caducaran en un horizonte configurable de dias.
10. `scripts__restaurantpe__informes__inventario__informemerma__informemerma.html`: Informe maestro de mermas y salidas no comerciales. Dispone de dos vistas conmutables: cabecera (por comision o evento de salida) y detalle linea por linea de insumos o productos mermados.
11. `scripts__restaurantpe__informes__inventario__modals__modal-detallemerma.html`: Ventana modal emergente que desglosa los articulos, cantidades, unidad de medida, almacenes, costos unitarios e importes correspondientes a un registro de merma especifico.
12. `scripts__restaurantpe__informes__inventario__cuadrestockmanual.html`: Informe de regularizaciones y ajustes manuales de inventario fisico. Muestra el historial de cuadres ejecutados, el responsable, los montos monetarios de sobrevalorizacion o perdida, y el desglose de aumentos y disminuciones por insumo con opcion de anulacion.
13. `scripts__restaurantpe__informes__inventario__importarcuadremanual__importarcuadremanual.html`: Consola de integracion para inventarios masivos. Permite descargar la plantilla del catalogo en Excel (formatos V1, V2 o lotes paginados) y subir el archivo completado para regularizar stock masivamente.
14. `scripts__restaurantpe__informes__inventario__importarcuadremanual__modal-generarcuadremanual.html`: Modal auxiliar para fijar la fecha, hora de aplicacion y formato de separador decimal (coma o punto) del archivo Excel antes de procesar el cuadre manual.
15. `scripts__restaurantpe__informes__inventario__informearqueoinventario__arqueoinventario.html`: Informe de arqueos y tomas fisicas de inventario registrado mediante plantillas de conteo, sin generar necesariamente ajustes contables directos inmediatos.
16. `scripts__restaurantpe__informes__inventario__movimientoalmacen.html`: Informe transaccional detallado de transferencias internas entre almacenes origen y destino, registrando codigo unico, fecha, usuario responsable y observaciones.
17. `scripts__restaurantpe__informes__inventario__movimientoalmacenvalorizado__movimientoalmacenvalorizado.html`: Informe de transferencias entre almacenes con valorizacion monetaria (costo unitario e importe total trasladado).
18. `scripts__restaurantpe__informes__inventario__catalogoproductos.html`: Catalogo maestro tecnico exportable. Lista articulos, clasificacion (transformado o directo), recetas, subrecetas, componentes descartables, rendimientos y costos estimados.
19. `scripts__restaurantpe__informes__inventario__foodcost__foodcost.html`: Informe de costo de materia prima (Food Cost) por producto e insumo, comparando valorizacion inicial y final contra ventas.
20. `scripts__restaurantpe__informes__inventario__auditoriainventario__auditoriainventario.html`: Auditoria integral de inventario con balance de stock inicial, entradas agregadas, salidas agregadas y stock final resultante.
21. `scripts__restaurantpe__informes__inventario__paloteoinsumos.html`: Reporte de consumo de insumos por aplicacion o comanda de plato, calculando cantidad consumida y porcentaje de participacion en la carta.
22. `scripts__restaurantpe__informes__inventario__paloteoproductos.html`: Reporte de conteo rapido de despacho por producto terminado.
23. `scripts__restaurantpe__informes__inventario__informeproduccion__informeproduccion.html`: Consolidado de ordenes de produccion y transformacion interna de subrecetas, detallando fecha, centro de elaboracion, costo por preparacion y consumo de insumos.
24. `scripts__restaurantpe__informes__inventario__preparacionreceta__historialpreparacionrecetas.html`: Historial de ejecucion de recetas en cocina/barra con comparativa entre cantidad teorica estimada y cantidad real utilizada.
25. `scripts__restaurantpe__informes__inventario__consolidadosalidasproductoinsumo__consolidadosalidasproductoinsumo.html`: Matriz de salidas diarias por producto e insumo en un rango de fechas.
26. `scripts__restaurantpe__informes__inventario__historialcambioprecios.html`: Trazabilidad y auditoria de variaciones de costos de compra y precios de insumos en el tiempo.
27. `scripts__restaurantpe__informes__inventario__informemodificaciones.html`: Auditoria de cambios manuales en transacciones de inventario.
28. `scripts__restaurantpe__informes__inventario__informetiempodespacho__tiempodespacho.html`: Control de tiempos transcurridos en el despacho de productos desde produccion a sala.
29. `scripts__restaurantpe__informes__inventario__paralelaprecios__paralelaprecios.html`: Comparativa de precios de venta y costos entre sucursales.
30. `scripts__restaurantpe__informes__inventario__planificadorderivados__planificadorderivados.html`: Herramienta de proyeccion de compras segun formulaciones y derivados de materias primas.
31. `scripts__restaurantpe__informes__inventario__porcentajeconsumo.html`: Estadisticas de absorcion de existencias sobre las ventas totales.
32. `scripts__restaurantpe__informes__inventario__productosconprecioplp.html`: Listado de articulos con listas de precios preferenciales o pactadas.
33. `scripts__restaurantpe__informes__inventario__stockmenudeldia__stockmenudeldia.html`: Control de porciones y existencias para menus del dia.

### 1.2 Informes de Compras

34. `scripts__restaurantpe__informes__compras__producto.html`: Compras agrupadas por insumo o producto terminado. Muestra totales adquiridos, costo unitario promedio ponderado e importe total en el periodo seleccionado.
35. `scripts__restaurantpe__informes__compras__productosinsumos.html`: Consolidado clasificado en dos secciones independientes dentro de la misma pantalla: una tabla para Insumos y otra tabla para Productos, detallando afectaciones fiscales (afecto, inafecto, IGV).
36. `scripts__restaurantpe__informes__compras__consolidadocomprasinsumosproducto__consolidadocomprasinsumosproducto.html`: Detalle transaccional de compras linea por linea con visualizacion de equivalencias entre unidades de presentacion de compra y unidades de medida base del kardex.
37. `scripts__restaurantpe__informes__compras__proveedor.html`: Registro de adquisiciones agrupadas por proveedor. Lista comprobantes recibidos, notas de credito asociadas, estados (activa/anulada) y acceso a modal de detalle.
38. `scripts__restaurantpe__informes__compras__proveedorvsarticulos__proveedorvsarticulos.html`: Analisis comparativo de cotizaciones y variaciones de precios de cada insumo frente a los distintos proveedores del mercado.
39. `scripts__restaurantpe__informes__compras__comprascreditospagos__comprascreditospagos.html`: Informe integral de estado de compras y cuentas por pagar a proveedores. Contiene tres vistas: todas las compras, compras pagadas con historial de amortizaciones bancarias, y compras a credito pendientes con calculo de intereses y saldos.
40. `scripts__restaurantpe__informes__compras__todas.html`: Maestro general de compras con tarjetas KPI de resumen (subtotal, impuestos, notas de credito, compras netas, ticket promedio) y multiples formatos de exportacion.
41. `scripts__restaurantpe__informes__compras__comprasdelmes__comprasdelmes.html`: Consolidado mensual para liquidacion tributaria y contable, con desglose de moneda, cuentas contables y familias de compras.
42. `scripts__restaurantpe__informes__compras__comprasporformadepago__formasdepago.html`: Registro de cancelaciones de cuotas de credito agrupadas por medio de pago financiero.
43. `scripts__restaurantpe__informes__compras__serviciosadquiridos__informeserviciosadquiridos.html`: Comprobantes que incluyen compras de servicios no inventariables.
44. `scripts__restaurantpe__informes__compras__modal-detalle.html`: Modal de visualizacion del desglose de articulos de una compra, mostrando insumos, productos, servicios y guias de remision vinculadas.

---

## 2 Detalle de las pantallas clave (campos, tipos, obligatorios, botones, filtros, columnas, estados, validaciones, reglas)

A continuacion se presenta el desglose exhaustivo de los componentes declarados en las plantillas reales de AngularJS.

### 2.1 Informes Clave de Inventario

#### A. Stock Valorizado (`scripts__restaurantpe__informes__inventario__stockvalorizado.html`)
- **Filtros disponibles**:
  - `vm.almacenSeleccionado` (`<ui-select>`): Selector de almacen fisico especifico o consolidado (`almacen_descripcion`). Opcional.
  - `vm.tipoSeleccionado` (`<ui-select>`): Filtro por tipo de articulo (Insumo / Producto) (`descripcion`).
  - `vm.categoriasSeleccionadas` (`<div ng-dropdown-multiselect>`): Selector multiseleccion de categorias activas segun el tipo elegido.
  - `vm.busqueda` (`<input type="text">`): Campo de texto con icono de lupa para filtrar por nombre de producto en tiempo real.
  - `vm.cantidadRegistrosPorPagina` (`<ui-select>`): Tamano de pagina para paginacion en tabla.
  - `vm.tipoOrden` (`<ui-select>`): Selector de criterio de ordenacion de registros.
  - `vm.verCostoSinImpuesto` (`<input type="checkbox">`): Casilla para visualizar importes netos sin IGV. Visible unicamente si el usuario cuenta con el permiso `Security.hasAccess('almacen.vercostos')`.
  - `vm.verStockPorFecha` (`<input type="checkbox">`): Habilita corte de stock historico. Condicionado al permiso `almacen.vercostos`.
  - `fechaStock.fechas.startDate` (`<button date-range-picker>`): Selector de fecha y hora exacta de corte (`DD MMMM, YYYY - HH:mm A`). Se visualiza solo cuando `vm.verStockPorFecha == 1`.
  - `vm.excelPaginado` (`<input type="checkbox">`): Permite activar exportacion por segmentos. Despliega los campos numericos `vm.excelPagina` (`solo-numeros-sin-decimal`) y `vm.excelRegistros`.
- **Botones y Acciones**:
  - `Atras` (`ui-sref="informes.inventario"`): Retorno al Hub de Informes.
  - `Generar informe` (`ng-click="vm.fnActualizarReporteStockValorizado()"`): Botón verde con estado de carga `ladda="vm.btnCargando"`.
  - `Descargar` (Dropdown de exportaciones):
    - `Excel`: `vm.fnExportarStockValorizado('excel', 0)`.
    - `Excel desgregado`: `vm.fnExportarStockValorizado('excel', 1)`.
    - `Excel (BATCH)`: `vm.fnExportarStockValorizado('excel', 0, 1)`.
- **Estructura de Columnas (Matriz Multialmacen)**:
  - Cabecera fija: `Producto / Insumo`, `¿Afecto?` (etiquetas SI en azul / NO en rojo segun `afectoigv`), `Unidad de medida`, `Categoria`.
  - Bloques dinamicos por cada almacen seleccionado (`ng-repeat="almacen in vm.almacenesSeleccionados"`):
    - Subcolumna `Stock`: Cantidad fisica (`Utility.roundCantInventario(almacen.stockActual)`).
    - Subcolumna `Valor Promedio`: Costo unitario promedio ponderado (protegido por `almacen.vercostos`).
    - Subcolumna `Stock valorizado`: Monto total valorizado por almacen (protegido por `almacen.vercostos`).
  - Columna final: `Consolidado` (`Utility.getSimboloMoneda() {{v.consolidado}}`), suma valorizada total del articulo a traves de todos los almacenes.
- **Totales y Validaciones**:
  - Fila inferior de Totales (`ng-hide="vm.totalConsolidado==0"`): muestra el `totalConsolidadoPorAlmacen` para cada deposito y el gran total de la empresa `vm.totalConsolidado` con 4 decimales.
  - Regla de negocio critica: Si el usuario NO tiene el permiso `almacen.vercostos`, las columnas de costo unitario, valorizacion y consolidado se ocultan por completo en el DOM, restringiendo al operario a ver exclusivamente saldos en unidades fisicas.

#### B. Kardex Individual y Kardex Valorizado (`kardex.html` y `kardexvalorizado.html`)
- **Filtros**:
  - `vm.almacenSeleccionado` (`<ui-select>`): Almacen de consulta. Obligatorio.
  - `vm.productoSeleccionado` (`<ui-select>` con busqueda remota por servidor): Selector con autocompletado y delay de 100ms. Muestra badges distintivos `Insumo` (label-info) o `Producto` (label-primary).
  - `vm.rangoDeFechas.fechas` (`<button date-range-picker>`): Rango desde `DD MMMM, YYYY h:mm A` hasta fecha fin.
- **Botones**:
  - `Atras` (`ui-sref="informes.inventario"`).
  - `Generar informe` (`ng-click="vm.fnActualizarReporteKardexValorizado()"`).
  - `Descargar` -> `Excel` (`vm.fnExportar('excel')`).
- **Resumen en Cabecera**:
  - Tarjeta destacada `Stock actual`: Muestra en fuente gigante el saldo fisico resultante (`vm.saldo_actual`).
- **Columnas de la Tabla**:
  - `Fecha`: Fecha (`DD/MM/YYYY`) y hora (`h:mm A`) del movimiento.
  - `Almacén`: Descripcion de la bodega.
  - `Motivo`: Descripcion de la causa operativa (Venta, Compra, Merma, Cuadre manual, Produccion, Transferencia).
  - `Observacion`: Texto descriptivo ingresado en la operacion (presente en `kardexvalorizado.html`).
  - `Unidad de medida`: Descripcion de la unidad base.
  - `Entrada`: Cantidad que ingresa (en verde con signo `+`).
  - `Salida`: Cantidad que egresa (en rojo con signo `-`).
  - `Stock`: Saldo fisico acumulado. En rojo si es menor o igual a cero (`text-danger`).
  - `Costo unitario` / `Costo Operación`: Costo de la transaccion.
  - `Costo promedio`: Costo unitario promedio ponderado a la fecha de la operacion.
  - `Costo operación` / `Total`: Importe total del movimiento.
  - `Stock valorizado`: Saldo valorizado acumulado en soles (`text-primary`).

#### C. Kardex SUNAT Formato 13.1 (`kardexsunat.html`)
- **Filtros**:
  - `vm.localSeleccionado` (`<ui-select>`): Local tributario.
  - `vm.kardexSeleccionado` (`<ui-select>`): Tipo de kardex (Fisico o Valorizado).
  - `vm.productoSeleccionado` (`<ui-select>`): Insumo o producto especifico.
  - `vm.rangoDeFechas.fechas` (`<button date-range-picker>`): Periodo de declaracion.
  - `vm.filtroKardexSunatPorCategoria` (`<input type="checkbox">`): Habilita filtros jerarquicos por categoria de insumo o categoria de producto.
  - `vm.tipoInsumoProductoSeleccionado`, `vm.categoriaInsumoSeleccionada`, `vm.categoriaProductoSeleccionada`: Desplegables condicionales segun el tipo.
  - `vm.filtroCostosSinImpuestos` (`<input type="checkbox">`): Descuenta el IGV de los costos unitarios.
- **Regla Legal Visible (Alerta Informativa en plantilla)**:
  - Advierte explicitamente que el Kardex SUNAT **solo incluye un subconjunto de operaciones validas contablemente**:
    1. Ingresos por compras.
    2. Ingresos por guias de compra.
    3. Salidas por guias de remision.
    4. Salidas por ventas.
    5. Movimientos entre almacenes.
- **Estructura Oficial de Columnas (Formato SUNAT 13.1)**:
  - Documento de Traslado: `Fecha`, `Tipo` (codigo SUNAT), `Serie`, `Número`.
  - `Tipo Operación`: Codigo segun tabla SUNAT (ej. 01 Venta, 02 Compra).
  - Entradas: `Cantidad`, `Costo Unitario`, `Costo Total`.
  - Salidas: `Cantidad`, `Costo Unitario`, `Costo Total`.
  - Saldo Final: `Cantidad`, `Costo Unitario`, `Costo Total`.

#### D. Productos por Vencer (`productosporvencer.html`)
- **Filtros**:
  - `vm.tipoSeleccionado` (`<ui-select>`): Insumo o Producto.
  - `vm.diasParaVencer` (`<input type="text" solo-numeros-sin-decimal>`): Numero de dias umbral (ej. 7, 15, 30 dias para expirar).
- **Botones**: `Atras`, `Generar informe` (`vm.fnActualizarReporteProductosPorVencer()`), `Descargar Excel` (`vm.fnDescargarInformeInsumosProductosPorVencerExcel()`).
- **Columnas**:
  - `Codigo de proveedor` (visible si no es insumo).
  - `Codigo` (codigo de barras / SKU).
  - `Producto / Insumo`: Denominacion del articulo.
  - `Unidad de medida`.
  - `Almacen`.
  - `Stock`: Existencia remanente en almacén.
  - `Cantidad`: Cantidad original ingresada en el lote.
  - `Lote`: Identificador o codigo de lote (`movimientoalmaceninsumo_numlote`).
  - `Fecha vencimiento`: Fecha de caducidad registrada en la compra (`movimientoalmaceninsumo_fechacaducidad`).

#### E. Informe de Mermas y Salidas (`informemerma.html` y `modal-detallemerma.html`)
- **Filtros**:
  - `vm.localSeleccionado` (`<ui-select>`): Sucursal activa.
  - `vm.mozoSeleccionado` (`<ui-select>`): Usuario o mozo que reporto o autorizo la merma.
  - `vm.categoriaSalidaSeleccionada` (`<ui-select>`): Motivo o clasificacion de la salida.
  - `vm.listarPorDetalle` (`<input type="checkbox">`): Alterna entre vista de Cabecera (0) y vista Detalle (1).
  - `vm.costearUlimaCompra` (`<input type="checkbox">`): Valora la merma al ultimo costo de adquisicion en vez del promedio ponderado.
  - `vm.busqueda` / `vm.busquedaProducto`: Filtros de texto reactivos.
  - `vm.rangoDeFechas.fechas` (`<button date-range-picker>`).
- **Botones y Opciones de Exportacion**:
  - `Excel`, `Excel detallado`, `Excel V2`, `Excel detallado V2`, `Excel V2 (BATCH)`, `Excel detallado V2 (BATCH)`.
- **Columnas Vista Cabecera (`vm.listarPorDetalle == '0'`)**:
  - `Cod #`: Numero de operacion de merma (`merma_id`).
  - `Local`, `Tipo`: Badge `AUTOMATICA` (tipo 1, por expiracion/cierre) o `MANUAL` (tipo 0, por merma manual).
  - `Categoría`, `Usuario`, `Fecha registro`, `Fecha y hora del evento`, `Responsable`, `Razón`.
  - `Importe`: Costo total de la merma.
  - `Opciones`: Boton `Ver detalle` (`vm.fnVerDetalleMerma(merma)`), abre modal con detalle por insumo.
- **Columnas Vista Detalle (`vm.listarPorDetalle == '1'`)**:
  - `Producto/insumo` (con etiqueta Producto o Insumo), `Tipo` (Automatica/Manual), `Categoría`, `Almacen`, `Cantidad`, `U.M.`, `Costo`, `Importe` (calculado en linea: `detallemerma_costo * detallemerma_cantidad`).
- **Modal de Detalle (`modal-detallemerma.html`)**:
  - Despliega tabla con Almacen, Cantidad, Unidad de Medida, Producto/Insumo (con subcomponentes si la merma provino de un combo o preparacion compuesta), Costo unitario, Importe total y fila de Gran Total.

#### F. Cuadre de Stock y Regularizacion (`cuadrestockmanual.html` e `importarcuadremanual.html`)
- **Filtros**:
  - `vm.localSeleccionado` (`<ui-select>`).
  - `vm.rangoDeFechas.fechas` (`<button date-range-picker>`).
- **Alertas y Reglas Criticas de Negocio**:
  - Banner interactivo de advertencia: Notifica al operario si existen Ventas, Compras, Guias, Preparacion de recetas o Mermas pendientes de procesar en el periodo, advirtiendo que ejecutar un cuadre sin procesar causara descuadres en el kardex permanente. Enlaza a `almacen.procesarstock.procesar`.
- **KPIs y Resumen Financiero**:
  - `Nº Cuadres activos`: Cantidad de auditorias aplicadas.
  - `Total sobrevalorización` (en verde): Ganancia contable por sobrantes fisicos encontrados.
  - `Total de perdida` (en rojo): Perdida contable por faltantes fisicos.
- **Columnas de la Tabla Maestra**:
  - `Fecha` y hora del cuadre.
  - `Responsable` (nombre y apellidos del usuario).
  - `Motivo`: Explicacion del ajuste.
  - `Sobrevalorización` (en verde si > 0, o texto "Sin Sobrevalorización").
  - `Perdida` (en rojo si > 0, o texto "Sin perdidas").
  - `Estado`: Badge azul `Activo` (1) o rojo `Inactivo` (0).
  - `Acciones`: Boton `Ver Detalles` / `Ocultar`, Boton `Anular` (cancela el ajuste devolviendo el stock a su valor previo), Boton `Descargar Excel` individual (`vm.fnExportarDetalle(v.cuadremanual_id)`).
- **Subtabla Expandible (Detalle de Ajuste por Articulo)**:
  - `Producto / Insumo`, `Nota`, `Almacen`.
  - `Cantidad aumento`: Unidades agregadas (`+` en verde).
  - `Cantidad disminuyo`: Unidades restadas (`-` en rojo).
  - `Costo promedio`: Costo unitario ponderado aplicado al ajuste.
  - `Stock anterior`: Saldo que figuraba en el sistema antes del conteo.
  - `Stock actual`: Saldo fisico real resultante despues del conteo.
- **Importacion Masiva (`importarcuadremanual.html` y modal)**:
  - Opciones de descarga: Formato V1, Formato V2, o Lotes paginados por numero de registros.
  - Modal de parametros: Permite configurar fecha y hora de aplicacion (`bs-datepicker` y `clockpicker`), y selector de formato decimal (`Formato númerico: punto o coma`) para prevenir errores de importacion.

---

### 2.2 Informes Clave de Compras

#### A. Compras por Producto / Insumo (`compras__producto.html`)
- **Filtros**:
  - `vm.localSeleccionado` (`<ui-select>`).
  - `vm.comprobanteSeleccionado` (`<ui-select>`): Tipo de comprobante (Factura, Boleta, etc.).
  - `vm.categoriaSeleccionada` (`<ui-select>`): Insumo (1) o Producto (0).
  - `vm.categoriaProductoSeleccionada` / `vm.categoriaInsumoSeleccionada`: Subclasificacion segun el tipo.
  - `vm.rangoDeFechas.fechas` (`<button date-range-picker>`).
  - `vm.productoFiltro` (`<input type="text">`): Buscador por nombre.
- **Botones y Exportacion**: `Atras`, `Generar informe`, `Descargar` -> `Excel` y `Excel V2`.
- **Columnas**:
  - `Producto/Insumo`: Descripcion y presentacion (`producto_descripcion + ' - ' + producto_presentacion`).
  - `Tipo/Categoria`: Badge amarillo para `Insumo` / celeste para `Producto` junto con el nombre de la categoria.
  - `Cantidad`: Volumen total comprado.
  - `Precio promedio`: Costo unitario promedio pagado en el periodo.
  - `Importe`: Monto acumulado total (`Utility.getSimboloMoneda() {{item.importe}}`).

#### B. Consolidado de Compras por Insumos y Productos (`compras__productosinsumos.html`)
- **Estructura Especial**: Divide la pantalla en dos tablas independientes:
  - **Tabla 1: Insumos**: Codigo, Articulo (nombre y presentacion), Seccion (categoria insumo), Almacen, Cantidad, Precio unitario, Inafecto, Afecto, Sub total, Impuesto (IGV), Total.
  - **Tabla 2: Productos**: Codigo, Articulo, Seccion, Almacen, Cantidad, Costo unitario, Inafecto, Afecto, Sub total, Impuesto, Total.
- **Exportaciones**: `Por insumos y productos` (`vm.fnExportarPorInsumosProductos('excel')`) y `Por proveedor` (`vm.fnExportarPorProveedor('excel')`).

#### C. Detalle de Compras con Equivalencias de Presentacion (`consolidadocomprasinsumosproducto.html`)
- **Filtros**: Local, Proveedor (con selector inteligente por RUC o razon social), Comprobante, Rango de fechas y filtro reactivo por articulo.
- **KPIs Superiores**: `Cantidad comprada`, `Costo promedio`, `Total comprado`.
- **Columnas Criticas para Conversion de Medidas**:
  - `Fecha`, `Documento`, `Serie`, `Número`, `RUC`, `Razon social`.
  - `Cantidad`: Cantidad de paquetes/unidades compradas.
  - `Producto / Insumo`, `Categoria`.
  - `Eq. Presentacion Unt.`: Cantidad por paquete comercial y unidad comercial (ej. Caja x 12 botellas).
  - `Cant Eq. Base`: Cantidad total convertida a la unidad base del kardex (ej. 12 litros).
  - `Precio por unidad`, `V. Afecto`, `V. Inafecto`, `Impuestos`, `Total`.

#### D. Compras por Proveedor y Proveedor vs. Articulos (`proveedor.html` y `proveedorvsarticulos.html`)
- **Filtros**: Local, Comprobante, Proveedor (buscador interactivo por RUC o nombre), Rango de fechas.
- **Columnas de Compras por Proveedor**:
  - `Fecha`, `Local`, `Proveedor`, `Documento`, `Serie doc.`, `Número doc.`.
  - `Nota de crédito`: Muestra serie, numero y monto total si la factura tiene notas de credito asociadas.
  - `Total`, `Estado` (Badge azul `Activa` / rojo `Anulada`).
  - Boton `Detalles`: Abre modal con el desglose de insumos y guias de compra.
- **Columnas de Proveedor vs. Artículos**:
  - `Producto/Insumo`, `UM`, `Fecha de compra`, `Proveedor`, `Cantidad`, `Precio`, `Importe`. Permite auditar qué proveedor vende más barato cada materia prima.

#### E. Estado de Compras y Cuentas por Pagar (`comprascreditospagos.html`)
- **Filtros**: Local, Proveedor, Comprobante, Checkbox con texto dinamico: `Filtrar por fecha de [compra / registro]`, Rango de fechas.
- **KPIs de Cabecera**:
  - `Compras realizadas`: Conteo total de operaciones.
  - `Total compras pagadas`: Importe cancelado acumulado.
  - `Total compras realizadas`: Monto neto comprado.
  - `Total compras pendientes`: Deuda viva por pagar a proveedores (`vm.cuotaObj.deudaTotal`).
- **Tres Vistas / Tablas en la Misma Pantalla**:
  1. `Todas las compras`: Fecha, Documento, Serie - Nro., Local, Proveedor, Total, Forma de pago (`Al credito` en amarillo o `Contado` en verde), Boton Detalles.
  2. `Consolidado de compras pagadas`: Muestra compras canceladas con boton `Ver pagos / Ocultar pagos`. Al abrirlo, despliega subtabla con: Fecha pago, Forma de pago (`Efectivo` o `Deposito`), Datos de operacion bancaria (banco, fecha de transaccion bancaria, numero de operacion, observacion) y monto amortizado. Pie de tabla con totales de compras al contado y al credito.
  3. `Consolidado de créditos pendientes (Cuentas por Pagar)`: Fecha de vencimiento de cuota, Proveedor, Comprobante, N° Comprobante, Monto de deuda original (badge rojo), Intereses, Monto amortizado, Saldo pendiente (badge amarillo para credito activo, celeste para vencido).
- **Exportaciones**: Formato `Excel` y Formato especifico `Estado de creditos`.

---

## 3 Confirmaciones o correcciones a los informes previos (cita cual)

Al contrastar la evidencia EN VIVO de las plantillas de AngularJS contra los informes previos realizados unicamente con documentos tecnicos de referencia, se confirman y corrigen los siguientes puntos especificos:

### 3.1 Correccion Mayor a `vivo-almacen.md`
- **Informe Previo**: `vivo-almacen.md` contenia unicamente: *"NO HAY SESION EN EL NAVEGADOR DEL AGENTE: indica en que navegador inicio sesion el usuario"*.
- **Correccion EN VIVO**: Se corrige y anula dicha afirmacion. Las pantallas reales de restaurant.pe se encuentran extraidas y disponibles localmente en `/tmp/claude-1000/almacen-agy/vivo/`. No se requiere una sesion interactiva en navegador para auditar con rigor absoluto cada campo, boton, directiva de AngularJS, filtro y validacion.

### 3.2 Correccion a `informes.md` sobre Columnas de Stock Valorizado
- **Informe Previo (`informes.md` §1.2.A.3)**: Afirmo que la pantalla de Stock Valorizado contenia columnas como: `Almacen Principal, Stock, Mínimo req., Máximo req., Faltante`.
- **Correccion EN VIVO**: En la plantilla real `stockvalorizado.html`, esas columnas no existen. Las columnas de minimos y faltantes corresponden a la vista operativa de stock (`almacen/stock`). El informe de Stock Valorizado es una **matriz multialmacen dinamica** cuyas columnas son: `Producto / Insumo`, `¿Afecto?`, `Unidad de medida`, `Categoria`, y por cada almacen seleccionado se repite la triada: `Stock`, `Valor Promedio` y `Stock valorizado`, rematando en la columna `Consolidado`. Ademas, se verifico que los costos estan condicionados estrictamente al permiso `Security.hasAccess('almacen.vercostos')`.

### 3.3 Confirmacion y Precision a `informes.md` sobre Kardex SUNAT
- **Informe Previo (`informes.md` §1.2.A.1)**: Mencionaba genericamente "Kardex tributario SUNAT (Formato 13.1)".
- **Confirmacion y Precision EN VIVO**: Se confirma en `kardexsunat.html` la implementacion exacta del Formato 13.1 (Documento Traslado, Tipo Operacion, Entradas, Salidas y Saldo Final). Se descubre ademas la **regla de negocio critica documentada en su propia alerta**: restaurant.pe excluye del Kardex SUNAT las mermas internas, elaboraciones no formalizadas y ajustes que no cuenten con comprobante de pago o guia de remision oficial.

### 3.4 Correccion a `compras.md` e `informes.md` sobre Cuentas por Pagar
- **Informe Previo (`informes.md` §1.2.A.2 y `compras.md`)**: Trataban "Estado de compras / Cuentas por pagar" como un listado plano de creditos pendientes.
- **Correccion y Precision EN VIVO**: La plantilla `comprascreditospagos.html` no es un listado plano, sino un modulo de control financiero en tres niveles jerarquicos:
  1. Conteo y metricas KPI globales (deuda viva vs pagado).
  2. Historial de compras pagadas con auditoria de depositos bancarios y numero de operacion.
  3. Matriz de creditos pendientes con seguimiento de cuotas, intereses pactados y saldos amortizados.
  Posee ademas su propio exportador independiente titulado `Estado de creditos`.

### 3.5 Precision a `stock.md` sobre Mermas y Cuadre de Stock
- **Informe Previo (`stock.md` y `almacen.md`)**: No identificaron que el informe de mermas (`informemerma.html`) posee un switch de vista para alternar entre "Cabecera de salida" y "Detalle de articulos", ni la existencia de 6 variantes de exportacion a Excel (incluyendo algoritmos por lotes BATCH V1 y V2 para evitar bloqueos del servidor PHP).
- **Confirmacion EN VIVO**: Se confirma en `cuadrestockmanual.html` la advertencia que exige "Procesar stock" antes de realizar un inventario fisico, evidenciando la arquitectura asincrona en dos pasos de restaurant.pe.

---

## 4 Lo que falta en el mockup, priorizado (tabla: falta | pantalla/plantilla de referencia | gravedad | esfuerzo S/M/L)

Al revisar `/tmp/claude-1000/almacen-agy/fuente/Admin.dc.html`, se comprueba que el mockup actual **no cuenta con pantallas funcionales de informes**. En la linea 2842 solo presenta un catalogo estatico en texto:
`informes: { t: 'Informes', s: 'Catálogo de reportes disponibles. Aquí solo se muestra su estructura.', cols: ['Informe', 'Categoría', 'Qué muestra', 'Filtros', 'Exportar'] }`

Para que Caprichos disponga de un sistema de almacen profesional y operativo, se priorizan las ausencias criticas en la siguiente tabla:

| Falta identificada en el Mockup | Pantalla / Plantilla de referencia EN VIVO | Gravedad | Esfuerzo (S/M/L) | Justificacion y Valor para Caprichos |
|---|---|---|---|---|
| **Pantalla interactiva de Stock Valorizado** (matriz multialmacen con costos promedio y consolidado) | `scripts__restaurantpe__informes__inventario__stockvalorizado.html` | **Critica** | **M** | Indispensable para saber el capital inmovilizado en insumos (cafe, leche, jarabes, descartables) en cada area de la cafeteria. |
| **Kardex interactivo individual de insumos** (entradas, salidas, saldo fisico, costo promedio y valorizado) | `scripts__restaurantpe__informes__inventario__kardexvalorizado.html` y `kardex.html` | **Critica** | **M** | Trazabilidad diaria indispensable para auditoria y detectar fugas de producto en barra o cocina. |
| **Informe de Cuentas por Pagar a Proveedores** (deuda pendiente, amortizaciones, bancos y vencimiento de cuotas) | `scripts__restaurantpe__informes__compras__comprascreditospagos__comprascreditospagos.html` | **Critica** | **M** | Permite a la administracion de Caprichos programar los pagos semanales a proveedores y no cortar la cadena de suministros. |
| **Informe y trazabilidad de Mermas** (desglose por motivo, responsable, clasificacion manual/automatica y costeo) | `scripts__restaurantpe__informes__inventario__informemerma__informemerma.html` | **Alta** | **S** | Vital para registrar desperdicios diarios de pasteleria o leche vencida y cuantificar la perdida en soles. |
| **Control preventivo de Productos por Vencer** (filtro por horizonte de dias, alertas de caducidad y lotes) | `scripts__restaurantpe__informes__inventario__productosporvencer.html` | **Alta** | **S** | En cafeteria los insumos lacteos y frescos tienen vida util corta. Evita servir productos en mal estado o botar insumos vencidos. |
| **Consola de Cuadre de Stock y conciliacion fisica** (registro de aumentos/disminuciones, calculo de sobrevalorizacion o perdida) | `scripts__restaurantpe__informes__inventario__cuadrestockmanual.html` | **Alta** | **M** | Permite cuadrar las existencias fisicas del barista o almacenero contra el sistema y generar ajustes limpios. |
| **Detalle de Compras por Insumo con conversion de medidas** (equivalencia de empaque comercial a unidad base) | `scripts__restaurantpe__informes__compras__consolidadocomprasinsumosproducto__consolidadocomprasinsumosproducto.html` | **Alta** | **M** | Permite verificar compras (ej. Caja x 12 unidades) transformadas a unidades de receta (litros o gramos). |
| **Historial de Precios Proveedor vs. Artículos** (comparativa de variacion de cotizaciones por insumo) | `scripts__restaurantpe__informes__compras__proveedorvsarticulos__proveedorvsarticulos.html` | **Media** | **S** | Permite optimizar costos eligiendo siempre al proveedor con mejor precio para el cafe o descartables. |
| **Exportadores reales a Excel / CSV y selector de fechas** (`DateRangePicker` integrado) | Todos los informes (`amDateFormat`, exportadores XLSX) | **Media** | **M** | El mockup no genera archivos descargables; la administracion requiere exportar la data para contabilidad. |
| **Kardex SUNAT Formato 13.1** (Libro permanente valorizado fiscal) | `scripts__restaurantpe__informes__inventario__kardexsunat.html` | **Baja** (fase 2) | **L** | Requerido si Caprichos supera los topes tributarios de inventario permanente valorizado ante SUNAT. |

---

## 5 Mejoras sobre restaurant.pe (menos tablas, todo en un solo lugar)

La arquitectura de informes de restaurant.pe, aunque funcional, evidencia signos de envejecimiento tipicos de sistemas acumulativos: fragmentacion excesiva de reportes, multiplicidad de pantallas casi identicas, descargas lentas por lotes y un modelo de actualizacion asincrono que entorpece la operacion diaria. Para Caprichos se proponen las siguientes mejoras sustanciales:

### 5.1 Unificacion del Kardex en una Sola Pantalla Multifuncion
- **Defecto en restaurant.pe**: Existen 4 pantallas separadas para la misma necesidad basica: `kardex.html` (fisico), `kardexvalorizado.html` (con costos), `kardexsunat.html` (fiscal) y `kardexconsolidadoporfechas.html`. El usuario debe salir y entrar de pantallas distintas segun lo que desee consultar.
- **Mejora para Caprichos**: Una unica pantalla de **Kardex Integral**. Un switch rapido en la cabecera ("Solo Unidades Fisicas" / "Ver Costos y Valorizado" / "Vista Fiscal SUNAT") adapta dinamicamente las columnas de la tabla sin recargar la pagina.

### 5.2 Stock y Valorizacion en Tiempo Real (Eliminar el "Procesar Stock")
- **Defecto en restaurant.pe**: Exige un proceso intermedio manual ("Procesar stock") porque las ventas y mermas se encolan en segundo plano. Si el almacenero consulta el stock o kardex sin procesar, los datos estan desfasados y las alertas se activan constantemente.
- **Mejora para Caprichos**: Actualizacion de stock basada en eventos en tiempo real. Cada venta en caja, cada merma registrada y cada recepcion de compra descuenta o suma inventario al instante mediante transacciones atomicas en base de datos. Se elimina completamente la advertencia y el paso de "Procesar stock".

### 5.3 Centro de Control de Existencias Unificado (Stock + Cuadre + Vencimientos)
- **Defecto en restaurant.pe**: Para gestionar existencias, el usuario debe abrir el reporte de stock en un sitio, ir a otra pantalla para ver productos por vencer, y navegar a otra seccion para importar un cuadre manual.
- **Mejora para Caprichos**: Pantalla unificada de **Existencias e Inventario**. Una vista maestra tipo dashboard donde cada articulo muestra su stock actual, su semaforo de estado (bajo minimo, optimo, sobrestock), una alerta visual si tiene lotes proximos a caducar en menos de 7 dias, y un boton directo "Ajustar / Cuadrar" en la misma fila sin salir del modulo.

### 5.4 Consolidacion de Compras y Cuentas por Pagar en una Sola Ficha de Proveedor
- **Defecto en restaurant.pe**: Hay reportes separados para "Compras por proveedor", "Todas las compras", "Detalle de compras", "Proveedor vs Articulos" y "Compras creditos pagos".
- **Mejora para Caprichos**: Modulo unificado de **Compras y Proveedores con Drill-down**:
  - Pestaña 1: Registro general de facturas con tarjetas KPI (Total comprado, IGV, Deuda viva).
  - Pestaña 2: Cuentas por pagar agrupadas por proveedor con semaforo de vencimiento y boton para amortizar directamente con salida de caja o registro de transferencia bancaria.
  - Pestaña 3: Comparador de precios de insumos entre proveedores en graficos simples de barra o linea.

### 5.5 Exportacion Moderna y Eficiente sin Hacks BATCH
- **Defecto en restaurant.pe**: Debido a limitaciones de memoria de su backend tradicional en PHP, restaurant.pe invento descargas "Excel V1", "Excel V2", "Excel BATCH por lotes" y "Excel paginado" para evitar errores 500 al exportar catalogos grandes.
- **Mejora para Caprichos**: Generacion de reportes en streaming o exportacion directa a formato CSV/Excel nativo en el cliente o mediante endpoints optimizados, eliminando la confusion de elegir entre cinco tipos de Excel.

---

## 6 NO VERIFICADO

Con el fin de garantizar estricta honestidad y no realizar conjeturas tecnicas infundadas, se declaran los siguientes aspectos que no se pudieron verificar unicamente a partir de las plantillas de vista:

1. **Procedimientos Almacenados y Consultas SQL**: No se verifico la logica interna de calculo a nivel de base de datos (MariaDB/MySQL) en los endpoints `/restaurant/readonly/rest/`, tales como la formula exacta de prorrateo para notas de credito en compras multidestino o el cierre fiscal anual.
2. **Generacion de Documentos PDF**: Las plantillas HTML analizadas corresponden a las vistas en pantalla de AngularJS y referencian funciones de exportacion a Excel (`.fnExportar('excel')`). No se encontro evidencia de plantillas HTML especificas para impresion de reportes en PDF formal (se presume generado en backend por librerias tipo FPDF o TCPDF).
3. **Credenciales y Tokens Externos**: Conforme a las normas de seguridad, no se verificaron credenciales, tokens de sesion ni endpoints privados de integracion con el OSE/SUNAT para la transmision electronica del kardex.
4. **Logica de los Controladores AngularJS (`$scope` / `vm`)**: Las plantillas definen las propiedades enlazadas (`ng-model`, `ng-repeat`, `ng-click`), pero los algoritmos especificos de ordenamiento, filtros en memoria y llamadas REST residen en los archivos de controladores JS compilados (`controllers.js`), los cuales no fueron intervenidos.

---

INFORME LISTO.

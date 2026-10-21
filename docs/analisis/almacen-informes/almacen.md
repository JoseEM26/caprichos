---
id: ANA-CAP-002
tipo: analisis
titulo: "Informe Funcional y Comparativo del Modulo de Almacen: Caprichos vs Restaurant.pe (Rol Almacen)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, almacen-informes]
---

# Informe Funcional y Comparativo del Modulo de Almacen: Caprichos vs Restaurant.pe (Rol Almacen)

Este informe presenta la evaluacion funcional y tecnica completa del modulo de Almacen para el rol de Almacen en la cafeteria Caprichos (Lima, Peru, moneda en soles PEN). Se analiza la gestion de inventarios por insumo, entradas, salidas, mermas, devoluciones, transferencias, ajustes, arqueos o tomas de inventario fisico, kardex, control de lotes y vencimientos, almacenes fisicos, origenes de movimientos, produccion del dia, notas de movimiento, unidades de medida, stock minimo y sistema de alertas.

El analisis contrasta la arquitectura de referencia de Restaurant.pe frente al estado actual del prototipo interactivo (mockup en Admin.dc.html, modulos-y-roles.md, BRD.md y registro-mockup.md), identificando las brechas funcionales y proponiendo una replica mejorada, mas limpia e intuitiva.

---

## 1 Lo que restaurant.pe tiene en este tema (separa EN VIVO de REFERENCIA): pantallas, pestanas, campos, filtros, columnas, botones, reglas, reportes y permisos

### Estado de la inspeccion en vivo
NO SE PUDO VER EN VIVO: requiere que el usuario inicie sesion.
Al acceder a la direccion https://restaurant.pe y al punto de acceso https://caprichos.restaurant.pe/restaurant/#!/login, el sistema presenta unicamente el formulario de autenticacion de usuario. En estricto cumplimiento de la regla obligatoria de seguridad (no ingresar, guardar, leer ni manipular credenciales, contrasenas, tokens o cookies), la inspeccion en vivo se detuvo en esa pantalla. Por consiguiente, todo el detalle operativo de Restaurant.pe expuesto a continuacion proviene de la auditoria tecnica y documental consolidada en la carpeta de REFERENCIA (/tmp/claude-1000/almacen-agy/referencia/almacen.md, compras.md, informes.md, modulos-descripcion.md, modulos-usuarios-notificaciones.md y productos.md).

---

### Pantallas y pestanas identificadas en REFERENCIA

En Restaurant.pe, las funciones de almacen y control de existencias se estructuran en 7 pantallas principales y modulos complementarios de compras y ajustes:

1. **Movimiento Interno** (`#!/almacen/requerimientomovimiento/requerimientos/movimiento`):
   - Pantalla dividida en dos paneles: panel lateral izquierdo con lista de plantillas de movimiento registradas y panel derecho con el detalle o resumen de la plantilla seleccionada.
   - Flujo en dos etapas: primero se define una plantilla recurrente (ejemplo: reabastecimiento diario de barra o cocina) y luego se ejecuta el canje del movimiento real.
   - Bloques agrupadores en el resumen: Productos terminados, Insumos directos y Recetas base.

2. **Requerimiento** (`#!/almacen/requerimientomovimiento/requerimientos/nuevo-requerimiento`):
   - Orientado a la solicitud formal de abastecimiento entre locales o desde cocina central hacia sucursales satelite.
   - Manejo de plantillas fijas de pedido para evitar digitacion diaria manual.
   - Generacion de requerimiento con fecha limite de necesidad.

3. **Recepcion** (`#!/almacen/requerimientomovimiento/requerimientos/nuevo-recepcion`):
   - Pantalla para recepcionar la carga fisica enviada por el almacen emisor.
   - Lista izquierda de guias internas de remision en estado "En camino".
   - Panel derecho de conciliacion física por grupos: Productos, Insumos, Recetas y Derivados.

4. **Lista de Procesos** (`#!/almacen/requerimientomovimiento/requerimientos/lista-de-proceso`):
   - Centro de monitoreo y auditoria con tres pestanas maestras:
     * *Pestana 1: Requerimientos*: Listado historico de solicitudes con estados (Pendiente, Aprobado, Despachado / En camino, Recepcionado, Cancelado / Rechazado).
     * *Pestana 2: Registros de Recepcion*: Historial de ingresos fisicos registrados con detalle de items solicitados versus entregados.
     * *Pestana 3: Movimientos Internos*: Auditoria cronologica de traslados entre almacenes del local.

5. **Stock / Existencias y Stock Bajo** (`#!/almacen/stock`):
   - Tablero integral de saldos fisicos y valorizados de inventario.
   - Filtros rapidos para detectar quiebres (articulos por debajo del minimo requerido) y sobrestock (por encima del maximo).
   - Boton de enlace directo para transformar faltantes en ordenes de compra hacia proveedores.

6. **Kardex de Almacen** (`#!/almacen/kardex/individual`, `Kardex general`, `Kardex avanzado`):
   - Libro mayor auxiliar de movimientos de inventario.
   - Permite consultar cronologicamente entradas, salidas y saldos fisicos y valorizados por insumo o producto, con seleccion de motivos.

7. **Mermas de Almacen** (`#!/almacen/merma`):
   - Registro de perdidas y desechos de mercaderia (vencimiento, caida, deterioro, merma de cocina) con imputacion de costo.

8. **Ajustes > Almacenes y Produccion** (`#!/ajustes/produccion`):
   - Catalogo maestro de almacenes fisicos (Bodega principal, Barra, Cocina caliente, Pasteleria) y definicion de areas de produccion vinculadas a impresoras y pantallas.

9. **Productos > Insumos y Recetas** (`#!/productos/insumos`):
   - Maestro de materias primas con 3 sub-pestanas: Insumos directos (`tipoinsumo = 1`), Recetas base (`tipoinsumo = 2`) y Porcionables (`tipoinsumo = 3`).

---

### Campos, formularios y controles

A partir de la inspeccion de controladores y plantillas en REFERENCIA, se identifican los siguientes campos estructurados:

1. **Formulario de Plantilla de Movimiento y Canje**:
   - `movimiento_nombre`: Texto descriptivo (obligatorio).
   - `almacenOrigenSeleccionado`: Selector desplegable de almacen emisor (obligatorio).
   - `almacenDestinoSeleccionado`: Selector desplegable de almacen receptor (obligatorio, debe ser distinto al origen).
   - `movimiento_encargado`: Nombre de la persona que despacha.
   - `movimiento_receptor`: Nombre de la persona que recibe.
   - Selector de items: Insumo, Producto terminado o Receta base.
   - `detallemovimiento_cantidad`: Cantidad numerica mayor a cero.
   - `detallemovimiento_um`: Unidad de medida o presentacion seleccionada.

2. **Formulario de Recepcion de Mercaderia**:
   - `fecha_abastecimiento`: Selector de fecha efectiva de ingreso fisico.
   - `almacenRecepcionSeleccionado`: Almacen fisico de destino final.
   - Casilla rapida de coincidencia: Casilla de verificacion que marca que la cantidad recibida es identica a la enviada.
   - `item_cantidad`: Cantidad real ingresada (permite digitar diferencias por faltantes o danos en transporte).

3. **Formulario de Ficha de Insumo**:
   - `insumo_nombre`: Nombre de la materia prima (obligatorio).
   - `insumo_codigo` e `insumo_codigointerno`: Codigos de identificacion interna y tributaria.
   - `unidadmedida_id`: Unidad de medida base de almacenamiento (KG, LT, UNID, GR, ML).
   - `categoriainsumo_id`: Categoria gastronomica o de suministros.
   - `clasificacionabc`: Clasificacion ABC de rotacion de inventario (A, B, C).
   - Matriz de conversiones: Permite configurar factores de conversion (ejemplo: 1 saco = 50 kg; 1 botella = 750 ml).
   - `% Merma en compra`: Porcentaje estimado de merma al limpiar o procesar la materia prima comprada.
   - Tabla de inventario inicial por almacen: Stock de apertura, costo unitario, stock minimo y stock maximo.

4. **Formulario de Registro de Merma**:
   - Almacen emisor de la merma.
   - Insumo o producto afectado.
   - Cantidad mermada y unidad de medida.
   - Motivo de la merma (Vencido, Caido / Roto, Descomposicion, Merma de elaboracion).
   - Costo unitario imputado e importe total de la perdida monetaria.

---

### Filtros disponibles

1. **En Stock**:
   - Buscador de texto libre por insumo, descartable o producto (`vm.productoFiltro`).
   - Casilla de verificacion: Articulos con stock bajo (`debajoStock = '1'`).
   - Casilla de verificacion: Articulos con stock por encima del maximo (`arribaStock = '1'`).
   - Casilla de verificacion: Solo articulos con stock positivo.
   - Desplegable de Local y Almacen fisico especifico.
   - Desplegable de Categoria de insumo.

2. **En Lista de Procesos y Movimientos**:
   - Rango de fechas (desde fecha inicio hasta fecha fin).
   - Filtro por Estado del proceso (Pendiente, Aprobado, Despachado, Recepcionado, Cancelado).
   - Filtro por Almacen Origen y Almacen Destino.

3. **En Kardex**:
   - Rango de fechas.
   - Selector predictivo de insumo / producto.
   - Selector de Motivo de Kardex (Compras, Ventas, Traslados, Ajustes, Mermas, Produccion).
   - Selector de Almacen fisico.

---

### Columnas de tablas

1. **Tabla de Stock**:
   - `Producto / Insumo`: Nombre y codigo asignado.
   - `Tipo`: Clasificacion (Insumo directo, Receta base, Producto comercial, Descartable).
   - `Categoria`: Grupo de pertenencia (Bebidas, Lacteos, Panaderia, Empaques).
   - `Almacenes`: Indicador de presencia en almacenes.
   - `Stock total`: Saldo fisico sumando todos los almacenes del local.
   - Columnas dinamicas por almacen fisico (ejemplo: `Almacen Principal`, `Barra`).
   - `Stock`: Existencia en unidad de medida base.
   - `Minimo req.`: Umbral de stock de seguridad.
   - `Maximo req.`: Umbral maximo admisible para evitar sobrecostos.
   - `Faltante`: Diferencia calculada (`Minimo req. - Stock actual`).

2. **Tabla de Movimientos Internos (Lista de Procesos)**:
   - `Movimiento`: Numero identificador correlativo (`Movimiento interno #ID`).
   - `Desde`: Almacen de origen.
   - `Hacia`: Almacen de destino.
   - `Fecha del mov.`: Fecha y hora de registro.
   - `Items transferidos`: Cantidad de lineas o insumos trasladados.
   - `Acciones`: Boton Ver detalle.

3. **Tabla de Kardex**:
   - `Fecha`: Fecha y hora de la transaccion.
   - `Tipo / Operacion`: Entrada, Salida o Saldo inicial.
   - `Documento / Referencia`: Comprobante de compra, numero de comanda, guia interna o vale de merma.
   - `Motivo`: Venta en salón, Recepcion de compra, Ajuste de inventario, Merma.
   - `Entrada`: Cantidad que ingresa.
   - `Salida`: Cantidad que egresa.
   - `Saldo Cantidad`: Saldo fisico resultante en el almacen.
   - `Costo Unitario`: Costo promedio ponderado asignado a la operacion.
   - `Saldo Valorizado`: Monto total en dinero del inventario resultante.

---

### Botones y acciones disponibles

- `Generar informe`: Dispara la consulta reactiva en stock y kardex.
- `Generar orden compra`: Recopila todos los insumos bajo stock minimo y abre el modulo de compras para generar pedidos a proveedores.
- `Descargar`: Exporta las tablas visibles a archivos Microsoft Excel (.xlsx) o CSV.
- `Registrar plantilla`: Abre modal para crear una plantilla fija de requerimiento o movimiento.
- `Usar esta plantilla`: Abre modal de canje operativo con las cantidades prellenadas.
- `Realizar registro`: Inicia el cotejo de recepcion fisica contra una guia en camino.
- `Finalizar registro`: Confirma el ingreso fisico al almacen y asienta la entrada en kardex.
- `Registrar salida`: Boton para dar de baja mercaderia en el modulo de mermas.

---

### Reglas de negocio identificadas en REFERENCIA

1. **Doble modalidad de descargo de recetas**:
   - *Modo 1 (Por preparacion en venta)*: Al cobrarse o comandarse un plato, el sistema ejecuta la "explosion de la receta" en tiempo real, descontando automaticamente los gramos o mililitros de cada ingrediente del almacen asignado. Si el cliente elige un modificador (ejemplo: cambiar leche entera por leche de almendra), se descuenta el ingrediente sustituto.
   - *Modo 0 (Por stock en almacen / Lotes previos)*: Aplicable a pasteleria y postres elaborados previamente (queques, tortas, donas). Requiere una "Orden de Preparacion / Produccion" previa que consume la harina y azucar crudos y genera stock del producto terminado. La venta posterior descuenta las unidades terminadas existentes.
2. **Procesamiento de Kardex Asincrono**:
   - Las ventas descuentan de inmediato el saldo logico para advertir si el plato se agota, pero el asentamiento formal en el kardex corre mediante una tarea programada en cola (`logistica/pendienteProcesoStock`). En el encabezado del kardex se muestra un aviso: *"Actualmente cuenta con N Ventas pendientes de procesar para el kardex"*.
3. **Restriccion de venta por stock cero**:
   - Parametro `producto_restriccionporstock`: Si esta activo, el sistema bloquea el cobro o la comanda en caja si el insumo o producto tiene saldo cero.
4. **Circuito de Traslado en Dos Fases**:
   - La mercaderia que sale del Almacen Central hacia la Barra no ingresa automaticamente al stock de la Barra: queda en estado "En camino" amparada en una Guia Interna hasta que el receptor confirma la recepcion fisica con posibles discrepancias.

---

### Catalogo de reportes especializados de Inventario (28 reportes)

El modulo de Informes de Restaurant.pe contempla 28 reportes orientados a inventarios:
- Kardex individual por insumo o producto.
- Kardex consolidado por fechas y locales.
- Kardex tributario SUNAT (Formato oficial 13.1).
- Catalogo integral de productos, insumos, recetas y porcionables.
- Stock valorizado con costeo promedio ponderado.
- Stock valorizado comparativo entre periodos.
- Stock por fechas historicas.
- Stock de menu del dia.
- Porcentaje de consumo de stock frente a ventas.
- Cuadre de stock manual e importador/exportador de inventarios fisicos.
- Movimientos entre almacenes (transferencias simples y valorizadas).
- Historial de mermas y desperdicios.
- Historial de preparacion de recetas y ordenes de produccion.
- Consolidado de salidas de materias primas.
- Consolidado de existencias por local.
- Paloteo de productos y paloteo de insumos consumidos.
- Productos proximos a vencer (gestion preventiva FEFO/FIFO).
- Food Cost (porcentaje real de costo de materia prima sobre precio de venta).
- Auditoria de control de inventarios.
- Planificador de abastecimiento y derivados.

---

### Permisos del rol Almacen en la matriz de seguridad

En el arbol de permisos granulares (`modulos-usuarios-notificaciones.md`), el acceso a almacen esta protegido por etiquetas tecnicas especificas:
- `almacen.stock`: Consulta y generacion del informe de existencias.
- `almacen.movimientoalmacen`: Registro de traslados, salidas y mermas.
- `almacen.requerimientomovimiento`: Emision de pedidos internos y recepcion de guias.
- `almacen.kardex`: Visualizacion del historial de movimientos y costos.
- `almacen.preparacionreceta`: Ejecucion de ordenes de elaboracion por lote.
- `compras.proveedores` y `compras.todas`: Consulta de compras pendientes y recepcion de mercaderia de proveedores.

---

## 2 Lo que el mockup YA tiene para el rol almacen en este tema (con evidencia)

En el prototipo de Caprichos (`Admin.dc.html`, `modulos-y-roles.md`, `registro-mockup.md` y `BRD.md`), el rol Almacen esta formalmente modelado y cuenta con pantallas operativas y datos reactivos simulados.

### 1. Definicion del Rol Almacen y Vistas Asignadas
- **Evidencia en archivo y linea**: `Admin.dc.html`, lineas 2833 y 2834:
  `almacen: { n: 'Almacén', user: 'alm01', person: 'Almacenero de ejemplo', ini: 'AL', color: '#F08A3E', views: [ 'escritorio', 'compras', 'almacen', 'stock', 'informes', 'notificaciones' ], home: 'escritorio', manage: false }`
- **Permiso de movimiento**: `Admin.dc.html`, linea 3950:
  `const canMove = [ 'admin', 'almacen', 'produccion' ].indexOf(s.role) >= 0;`
  El rol almacen tiene autorizacion expresa para registrar movimientos en el sistema.
- **Acceso en menu**: Agrupador "Compras y stock" (`Admin.dc.html`, lineas 2974-2976), con accesos a Compras, Almacen y Stock y recetas. No tiene acceso a Pedidos y caja, Cocina, Repartos, Clientes, Creditos ni Configuracion del local.

---

### 2. Escritorio del Rol Almacen
- **Evidencia en archivo y linea**: `Admin.dc.html`, lineas 3192-3195:
  Cuando el usuario activo es del rol `almacen`, el escritorio genera dinamicamente:
  * 4 Indicadores clave (KPIs):
    1. *Insumos bajo el minimo*: Conteo dinamico de insumos en nivel critico (`lowSupplies.length`).
    2. *Compras por recibir*: Filtro sobre la tabla de compras con estado Pendiente (`TABLES.compras.rows.filter(r => r[6] === 'Pendiente').length`).
    3. *Movimientos de hoy*: Contador fijo de ejemplo ('3').
    4. *Requerimientos pendientes*: Contador de solicitudes ('1').
  * 3 Accesos directos a pendientes:
    1. "Insumos con stock bajo" con enlace a la vista de `stock`.
    2. "Compras pendientes" con enlace a la vista de `compras`.
    3. "Movimientos de almacen" con enlace a la vista de `almacen`.
  * Tabla inferior de auditoria: Despliega "Ultimos movimientos" tomando las primeras 4 filas de `TABLES.almacen.rows`.
  * Monitor inferior de stock bajo: Bandera `dStock = true`, que renderiza al pie del escritorio la lista de insumos en rojo o naranja.

---

### 3. Pantalla de Almacen (Movimientos Internos)
- **Evidencia en archivo y linea**: `Admin.dc.html`, lineas 2873-2877 (`TABLES.almacen`):
  * Titulo: "Almacen: Entradas, salidas, mermas y devoluciones de insumos. La produccion del dia entra como entrada (acta 02)."
  * Columnas de la tabla: `Fecha`, `Tipo`, `Insumo`, `Cantidad`, `Origen`, `Destino`, `Documento`.
  * Filtros interactivos:
    - Filtro por Tipo: Entrada, Salida, Transferencia, Merma.
    - Filtro por Origen: Proveedor, Almacen central, Cocina, Barra, Produccion.
    - Filtro por Insumo: Lista de insumos registrados.
  * Filas de ejemplo: 9 movimientos que incluyen entradas de compras (`OC-210`, `OC-209`, `OC-207`), salidas a cocina y barra (`REQ-044`, `REQ-043`), mermas de produccion (`MER-009`), devoluciones desde cocina (`DEV-003`) y entrada de produccion del dia (`PRD-014`).
- **Botones de cabecera en Almacen**: `Admin.dc.html`, lineas 1057-1061 (`isAlmacenView`):
  * Boton naranja "Registrar movimiento" (`openMov`).
  * Boton de borde negro "Registrar la produccion del dia" (`openProd`).
  * Boton de advertencia rojo "Cerrar el dia (sobrantes a merma)" (`closeDay`).
- **Modal de Registro de Movimiento (`isMv`)**: `Admin.dc.html`, lineas 1845-1858 y lineas 3951-3969:
  * Selector de Tipo con botones redondos: Entrada, Salida, Merma, Devolucion (Transferencia apagada por defecto).
  * Selector de Insumo con botones de toda la lista de insumos (`SUPPLIES`).
  * Campo de texto para Cantidad numerica (`mvCant`).
  * Selector de Origen: Proveedor, Almacen central, Cocina, Barra, Produccion.
  * Selector de Destino (si no es merma): Almacen central, Cocina, Barra, Produccion.
  * Selector de Justificacion de Merma (si el tipo es Merma): Donacion, Personal, Desecho.
  * Confirmacion con dialogo emergente: `ask('¿Registrar ...?')`.
  * Generacion automatica de correlativo: `ENT-100`, `SAL-100`, `MER-100`, `DEV-100`.
  * Actualizacion del stock en tiempo real: Formula `cur + SIGN[tipo] * q`.
- **Gestion de listas en Almacen**: `Admin.dc.html`, lineas 2235-2239 (`MANAGE.almacen` y `LIST_COLS.almacen`):
  * Permite activar o desactivar tipos de movimiento y origenes desde la propia interfaz.

---

### 4. Pantalla de Stock y Recetas
- **Evidencia en archivo y linea**: `Admin.dc.html`, lineas 808-863 (interfaz) y lineas 2308-2329 (datos y logica):
  * Filtro por semaforo: Botones "Todos", "Bajo", "Regular", "Suficiente".
  * Catalogo de 11 insumos base en `SUPPLIES`: Leche entera, Leche sin lactosa, Bebida de almendra, Cafe en grano, Galleta Oreo, Crema chantilly, Pulpa de maracuya, Nutella, Pan de molde, Filete de pollo y Donas (produccion del dia).
  * Cada insumo tiene: unidad (`L`, `kg`, `paquetes`, `bolsas`, `filetes`, `unidades`), stock actual, minimo, medio y maximo, y proveedor sugerido.
  * Barra de progreso con color del semaforo segun el nivel actual.
  * Boton "Armar orden de compra con lo bajo" (`orderAll`): Recopila los insumos en rojo o naranja y genera una plantilla con texto listo para enviar por WhatsApp al proveedor correspondiente (`ocTitle`, `ocTo`, `ocText`, `ocLink`).
  * Boton individual "Pedir por WhatsApp" por cada insumo.
  * Conmutador de "Alertas por correo" (`toggleMail`).
  * Panel interactivo de Recetas (escandallo): Muestra Frappe Oreo 16 oz, Capuccino 12 oz y Club Sandwich con el desglose de ingredientes, costo total de insumos, precio de venta y calculo automatico de margen comercial en soles y porcentaje.
  * Descuento automatico de stock por ventas (`acceptEffects` y `usageOf`, lineas 2316-2324 y 2920-2928): Cuando se envia un pedido a cocina, el prototipo descuenta automaticamente los gramos de cafe, mililitros de leche, galletas o pan segun la receta y las opciones de modificador elegidas por el cliente.
  * Cierre del dia para perecibles (`closeDay`, lineas 3960-3963): Busca insumos con atributo `vida` (ejemplo: Donas con `vida: 1`), traslada el saldo remanente a merma con documento `MER-xxx` y deja la existencia en cero.

---

### 5. Pantalla de Compras
- **Evidencia en archivo y linea**: `Admin.dc.html`, lineas 2867-2872 (`TABLES.compras`):
  * Tabla con ordenes de compra a proveedores: `Compra`, `Proveedor`, `Fecha`, `Insumos`, `Total`, `Pago` (Contado/Credito), `Estado` (Recibida, Pendiente, Anulada).
  * Filtros por Estado y Forma de pago.
  * 8 compras registradas de ejemplo.

---

### 6. Pantalla de Informes
- **Evidencia en archivo y linea**: `Admin.dc.html`, lineas 2878-2885 (`TABLES.informes`):
  * Fichas de reporte catalogadas: "Kardex de insumos" (inventario, Excel), "Stock bajo" (inventario, PDF y Excel), "Mermas" (inventario, Excel) y "Compras por proveedor" (compras, PDF y Excel).
  * Nota explicativa: *"Aqui solo se muestra su estructura"*.

---

### 7. Pantalla de Notificaciones
- **Evidencia en archivo y linea**: `Admin.dc.html`, lineas 2897-2902 (`TABLES.notificaciones`):
  * Registros historicos de alerta por tipo "Stock bajo" (ejemplo: *"Crema chantilly y leche sin lactosa bajo el minimo"*).

---

## 3 Lo que FALTA o esta incompleto

A continuacion se presenta la matriz comparativa de brechas funcionales entre lo que Restaurant.pe provee y lo que actualmente le falta o tiene incompleto el mockup de Caprichos para el rol Almacen:

| Que falta o esta incompleto | Donde lo tiene restaurant.pe | Por que importa en Caprichos | Gravedad | Esfuerzo |
| :--- | :--- | :--- | :--- | :--- |
| **Arqueo y Toma Fisica de Inventario (Cuadre de Stock)** | Modulo de Stock e Informes (Reporte 68: "Cuadre de stock manual e importacion/exportacion de inventarios"). | Permite al almacenero contar las existencias reales en estantes, contrastarlas contra el sistema, calcular sobrantes/faltantes y generar ajustes automaticos de balance. Hoy en el mockup NO EXISTE esta pantalla. | Alta | M |
| **Tipo de Movimiento "Ajuste de Inventario"** | En Kardex y movimientos de almacen (motivos de Kardex con ajuste positivo y negativo). | Si el conteo fisico difiere del saldo teorico, hoy el mockup solo permite registrar "Entrada" o "Salida", sin tipificar que se trata de una regularizacion por descuadre de inventario. En el mockup el tipo Ajuste NO EXISTE. | Alta | S |
| **Kardex Analitico Cronologico por Insumo** | Pantalla dedicada `#!/almacen/kardex/individual` y `kardex/general`, con trazabilidad de saldo acumulado y costo promedio ponderado. | Es el libro contable de almacen. Hoy en el mockup `TABLES.informes` solo muestra una tarjeta de texto ("Kardex de insumos"), y la tabla de movimientos es una lista plana sin calculo de saldo acumulado posterior a cada fila ni valorizacion monetaria. | Alta | M |
| **Gestion de Lotes y Fechas de Vencimiento de Perecibles** | En Compras (lotizacion) e Informes (reporte 78: "Productos por vencer FEFO/FIFO"). | En cafeteria, la leche fresca, cremas, embutidos y pulpas de fruta se descomponen si no se controlan fechas de caducidad. Hoy en el mockup solo hay un indicador fijo `vida: 1` para Donas; no hay registro de fecha de vencimiento por lote ni alertas preventivas. | Alta | M |
| **Separacion de Existencias por Almacen Fisico (Multialmacen)** | Ajustes > Almacenes (`#!/ajustes/produccion`) y filtro por almacen en pantalla de Stock. | Hoy el mockup muestra chips de origen/destino ("Almacen central", "Barra", "Cocina"), pero el stock en `this.state.stock` es un saldo unico global. No se puede saber cuanta leche hay en la Bodega principal versus cuanta hay en el refrigerador de Barra. | Media | M |
| **Circuito de Transferencia con Guia y Recepcion en 2 Fases** | Requerimiento -> Movimiento -> Guia en camino -> Recepcion con casillas de discrepancia (`nuevo-recepcion`). | Evita perdidas en el traslado de mercaderia. Hoy en el mockup la opcion "Transferencia" esta desactivada por defecto (`on: false`); y si se usa, el movimiento es instantaneo sin confirmacion del receptor de barra o cocina. | Media | M |
| **Integracion de Recepcion de Compras con Entrada a Stock** | Pantalla de Compras y Recepcion: marcar una orden como recibida alimenta el stock y genera la entrada automaticamente. | En el mockup, la tabla de compras tiene compras en estado "Recibida", pero no hay ningun boton que tome los insumos de la compra y actualice el saldo de stock en Almacen. Estan totalmente desconectados. | Alta | S |
| **Emision y Detalle de Notas de Entrada y Salida** | Guias internas y comprobantes de movimiento con encargado, receptor y formato para impresion. | El personal necesita un comprobante de entrega fisica cuando retira insumos caros (ejemplo: sacos de cafe o cajas de leche). Hoy en el mockup solo se genera un texto correlativo (`ENT-100`, `SAL-100`) sin vista de detalle ni comprobante imprimible. | Media | S |
| **Catalogo de Unidades de Medida y Conversiones** | Maestro de Insumos (`categoriainsumo/all`, `unidadmedida`) con factores de conversion (ej. 1 kg = 1000 g). | Permite comprar en sacos, almacenar en kilos y descargar recetas en gramos. En el mockup cada insumo tiene una unidad de texto fija y no existe tabla de equivalencias ni conversion automatica. | Media | M |
| **Valorizacion e Historial Analitico de Mermas** | Pantalla `#!/almacen/merma` con costo unitario, importe total de merma y motivos tipificados. | El mockup tiene chips de destino de merma (Donacion, Personal, Desecho), pero no calcula cuanto dinero en soles se perdio en el dia por mermas, ni genera un consolidado mensual para gerencia. | Media | S |
| **Explosion Automatica de Insumos en Produccion del Dia** | Preparacion de Receta (`Modo de descargo = 0`): al registrar produccion de lote se descargan los ingredientes crudos. | El mockup tiene el boton "Registrar la produccion del dia", pero este solo agrega 24 donas al stock. NO descarga automaticamente los kilos de harina, azucar o levadura que se consumieron para fabricar esas donas. | Alta | S |
| **Edicion de Umbrales de Stock Minimo y Maximo desde la Interfaz** | Ficha de Insumo: campos editables de stock minimo y stock maximo por almacen. | En el mockup los valores de minimo, medio y maximo estan fijos en el arreglo `SUPPLIES` dentro del codigo. El usuario no puede calibrar los umbrales de alerta desde la pantalla si cambia la temporada. | Baja | S |
| **Bloqueo Opcional en Carta Digital por Quiebre de Insumo Clave** | Parametro `producto_restriccionporstock` y agotamiento en cascada en carta online. | Si se termina el cafe en grano o la leche, la carta virtual y el chatbot deberian advertir o pausar en cascada las bebidas dependientes. Hoy solo existe marcado de agotado manual plato por plato en Productos. | Media | M |

---

## 4 Mejoras sobre restaurant.pe (que haria mejor nuestro sistema: menos tablas, mas intuitivo, todo en un solo lugar)

Restaurant.pe es un sistema robusto pero sufre de alta dispersion funcional, sobrecarga de tablas heredadas de su arquitectura original de escritorio y procesos asincronos que confunden al usuario. Nuestro sistema para Caprichos puede ser sustancialmente superior aplicando las siguientes mejoras:

### 1. Centro de Control Todo en Uno (Menos navegacion, mas accion)
- *Problema en Restaurant.pe*: Para gestionar el almacen diario el operador debe saltar entre 6 pantallas distintas: `#!/almacen/stock` para ver que falta, `#!/almacen/requerimientomovimiento` para pedir, `#!/almacen/requerimientos/nuevo-recepcion` para recibir, `#!/almacen/kardex` para auditar, `#!/almacen/merma` para registrar perdidas y `#!/compras/todas` para ver compras.
- *Solucion Caprichos*: Unificar la vista en un panel con pestañas dinamicas bien definidas: **Existencias y Alertas**, **Movimientos y Produccion**, **Toma de Inventario (Arqueo)** y **Kardex**. Todo el flujo operativo de la jornada se resuelve sin abandonar el modulo.

### 2. Pedidos a Proveedores por WhatsApp en un Clic
- *Problema en Restaurant.pe*: Generar una orden de compra requiere armar un documento formal, guardarlo en PDF y enviarlo por correo electronico tradicional, lo cual resulta lento e ineficaz para la relacion diaria con proveedores locales de Lima (fruterias, panaderias, queserias).
- *Solucion Caprichos*: Ya iniciada en el mockup y muy superior: al detectar insumos bajo el minimo, el sistema genera automaticamente un mensaje preformateado y abre la conversacion de WhatsApp con el numero del proveedor registrado, con las cantidades exactas que faltan para llegar al stock optimo.

### 3. Cierre Diario Automatizado de Productos Perecibles
- *Problema en Restaurant.pe*: No existe una rutina automatica de cierre de inventario para alimentos de vida util de 1 solo dia (donas frescas, sandwiches preparados, jugos naturales). El personal debe acordarse de digitar una merma manual diaria linea por linea o el inventario queda inflado con saldos fantasmas al dia siguiente.
- *Solucion Caprichos*: El boton existente en el mockup "Cerrar el dia (sobrantes a merma)" identifica automaticamente todos los productos con vigencia diaria, traslada el sobrante a merma y deja el contador limpio para el turno de la manana.

### 4. Semaforo Visual de 3 Estados (Verde, Naranja y Rojo)
- *Problema en Restaurant.pe*: La pantalla de stock muestra columnas numericas densas (`Stock total`, `Almacen Principal`, `Minimo req.`, `Maximo req.`, `Faltante`). No ofrece una representacion grafica inmediata que permita al personal de cocina o barra evaluar el abastecimiento de un solo vistazo.
- *Solucion Caprichos*: La barra visual de progreso del mockup con 3 colores (Verde = suficiente, Naranja = regular/reposicion preventiva, Rojo = critico/bajo el minimo) permite que el almacenero o cocinero identifique faltantes en menos de 3 segundos sin hacer calculos matematicos.

### 5. Kardex en Tiempo Real sin Bloqueos ni Procesamiento Batch
- *Problema en Restaurant.pe*: El kardex oficial acumula advertencias de ventas sin procesar (`pendienteProcesoStock`) y obliga a esperar a un proceso por lotes nocturno para cuadrar costos y saldos.
- *Solucion Caprichos*: Registro transaccional en tiempo real. Cada pedido cobrado y cada movimiento registrado actualiza de inmediato el saldo fisico y el saldo valorizado en el kardex, garantizando que el arqueo de cierre siempre coincida con la realidad fisica.

### 6. Simplificacion del Circuito de Traslados para Local Unico
- *Problema en Restaurant.pe*: Obliga a configurar complejas "Plantillas de Movimiento", luego "Canjear la plantilla", luego generar una "Guia Interna" y luego "Recepcionar la guia", un esquema burocratico pesado disenado para grandes cadenas con multiples locales y camiones de reparto.
- *Solucion Caprichos*: Caprichos opera en un local unico. El traslado interno entre la bodega principal y la barra debe ser un registro rapido en un solo paso, con confirmacion opcional de la barra solo si Kevin lo considera necesario.

---

## 5 Propuesta concreta de implementacion en el mockup, priorizada (pantallas, campos, reglas)

Para transformar el mockup en una replica mejorada y funcional para el rol de Almacen, se propone el siguiente plan de implementacion estructurado en tres fases prioritarias:

### Fase 1: Flujo Operativo Critico e Inventario Diario (Prioridad Alta)

1. **Pantalla de Toma de Inventario / Arqueo Fisico de Stock**:
   - *Ubicacion*: Sub-pestana dentro de `Stock y recetas` o boton principal "Hacer arqueo de stock".
   - *Interfaz*: Lista de insumos clasificados por categoria, mostrando columna de "Stock teorico" (solo visible para admin; en modo ciego para almacenero para evitar conteos sesgados), campo para digitar el "Conteo fisico real", columna de "Diferencia" y "Valor monetario de la diferencia".
   - *Boton de accion*: "Guardar arqueo y aplicar ajustes".
   - *Regla de negocio*: Si el conteo fisico es menor al teorico, genera automaticamente un movimiento de tipo "Ajuste negativo" por faltante. Si es mayor, genera un "Ajuste positivo" por sobrante.

2. **Inclusion del Tipo de Movimiento "Ajuste"**:
   - *Ubicacion*: Modal `isMv` en `Admin.dc.html`.
   - *Campos*: Agregar a la lista de tipos: `Ajuste positivo` y `Ajuste negativo`, con campo obligatorio de "Motivo del ajuste" (Diferencia de conteo fisico, Correccion de digitacion, Merma no registrada).

3. **Vinculacion Real entre Compras y Almacen**:
   - *Ubicacion*: Vista de `compras`.
   - *Accion*: En las compras con estado "Pendiente", agregar boton "Recepcionar en almacen". Al pulsarlo, solicita confirmacion de cantidades ingresadas y genera automaticamente un movimiento de "Entrada" en la tabla de almacen, actualizando el saldo de stock de cada insumo.

4. **Explosion de Receta en la Produccion del Dia**:
   - *Ubicacion*: Boton "Registrar la produccion del dia" (`openProd`).
   - *Regla*: Al registrar la entrada de 24 donas (o queques del dia), el sistema debe mostrar los insumos consumidos segun su receta base (ejemplo: 3 kg de harina, 500 g de azucar, 6 huevos) y descontarlos del stock de materias primas al mismo tiempo que incrementa el stock de producto terminado.

---

### Fase 2: Control de Calidad, Trazabilidad y Costeo (Prioridad Media)

1. **Control de Fechas de Vencimiento y Lotes en Insumos Perecibles**:
   - *Ubicacion*: Modal de movimiento de entrada y formulario de recepcion de compra.
   - *Campos*: `Numero de lote` (opcional/texto) y `Fecha de vencimiento` (selector de fecha).
   - *Regla*: En la pantalla de Stock, mostrar un distintivo amarillo cuando un lote este a 5 dias de caducar y rojo cuando haya vencido, con boton directo "Trasladar a merma por vencimiento".

2. **Kardex Analitico por Insumo con Saldo Posterior**:
   - *Ubicacion*: Al hacer clic sobre cualquier insumo en la lista de stock, abrir un panel lateral o modal "Kardex de [Insumo]".
   - *Columnas*: Fecha, Tipo, Documento de referencia, Entrada (+), Salida (-), Saldo resultante, Costo unitario y Costo acumulado.
   - *Boton*: "Exportar Kardex a Excel".

3. **Valorizacion Monetaria de Mermas**:
   - *Ubicacion*: Tabla y reportes de almacen.
   - *Mejora*: Al registrar una merma, calcular automaticamente el costo en soles segun el costo unitario del insumo (`Cantidad * Costo`). Mostrar en el Escritorio de Almacen la cifra: "Total mermado en el mes: S/ XXX.XX".

4. **Comprobante de Movimiento Imprimible (Nota de Almacen)**:
   - *Ubicacion*: Tarjeta de movimiento en la lista de Almacen.
   - *Accion*: Boton "Ver nota / Imprimir ticket", que despliega el formato compacto de 80 mm para impresora termica con fecha, tipo, insumos, cantidades, entregado por y recibido por.

---

### Fase 3: Multialmacen y Parametrizacion Avanzada (Prioridad Baja / Horizonte Futuro)

1. **Desglose de Existencias por Ubicacion (Bodega vs Barra vs Cocina)**:
   - *Regla*: Mantener el almacen unico por defecto (segun BRD RN-CAP-046), pero permitir en la configuracion activar sub-almacenes si el volumen del local lo requiere, discriminando cuanto stock esta disponible en la barra de despacho.

2. **Editor de Umbrales de Stock en Pantalla**:
   - *Ubicacion*: Tarjeta de insumo en Stock.
   - *Mejora*: Permitir al usuario editar directamente el stock minimo, intermedio y maximo mediante un boton "Editar umbrales", sin requerir intervencion tecnica en el codigo.

3. **Pausado Automatico de Platos en Carta por Insumo Agotado**:
   - *Regla*: Cuando un insumo critico (ejemplo: Cafe Espresso o Pan de Molde) llega a saldo cero, el sistema marca automaticamente como "Agotado temporalmente" todos los productos de la carta que lo utilizan, evitando que los clientes pidan productos que no se pueden preparar.

---

## 6 Preguntas para el dueno (Kevin)

Para cerrar el diseno definitivo del modulo de Almacen y validar las reglas de negocio con Kevin, se formulan las siguientes preguntas clave:

1. **Estructura fisica de almacenes**:
   ¿Caprichos maneja actualmente un unico almacen fisico donde se guarda todo, o la Barra de cafe y la Cocina manejan stocks independientes que requieren traslados internos formales entre turnos?

2. **Frecuencia y ejecucion de la toma de inventario**:
   ¿Cada cuanto tiempo se realiza el conteo fisico de insumos en el local (diario al cierre, semanal o fin de mes)? ¿Quien realiza el conteo y como se aprueban las diferencias o faltantes detectados?

3. **Destino y politicas de merma**:
   ¿Que se hace exactamente con los productos no vendidos al cierre del dia (por ejemplo las donas artesanales, tortas o sandwiches frescos)? ¿Se entregan como refrigerio al personal, se donan o se descartan a la basura? ¿Desea ver en el sistema el valor monetario en soles que representa esa merma diaria?

4. **Recepcion de compras en el local**:
   Cuando el proveedor llega con mercaderia (leche, cafe, frutas), ¿quien la recibe fisicamente (el almacenero, la cajera, el cocinero)? ¿Desea que al marcar la compra como recibida se ingrese automaticamente el stock, o prefiere que el almacen registre el ingreso por separado tras verificar la calidad?

5. **Exigencia de fechas de vencimiento**:
   ¿Desea ingresar obligatoriamente la fecha de vencimiento de productos perecibles criticos (leches, cremas, quesos, pulpas) para recibir alertas preventivas antes de que caduquen, o el movimiento de rotacion de la cafeteria es tan rapido que no amerita esa digitacion adicional?

6. **Control de cafe en grano y descartables**:
   ¿Desea controlar el cafe por gramaje exacto descargado por cada taza servida (ejemplo: 18 gramos por espresso doble) o prefiere controlar el cafe por bolsas completas despachadas desde el almacen hacia la barra? Lo mismo para los vasos descartables y servilletas: ¿se descuentan por bebida vendida o se controlan por conteo fisico semanal?

---

## 7 NO VERIFICADO

En estricto apego a las directivas de auditoria tecnica y honestidad profesional, se declaran los siguientes aspectos como NO VERIFICADOS:

1. **NO VERIFICADO EN VIVO (Portal web de Restaurant.pe)**:
   - Motivo: La plataforma web de produccion solicito credenciales de inicio de sesion. En cumplimiento de la regla 2, no se ingresaron datos de acceso ni se forzo el inicio de sesion, por lo que no se pudo interactuar con la aplicacion web real en vivo. Todos los datos de comparacion provienen de los documentos de auditoria tecnica de REFERENCIA.

2. **NO VERIFICADO (Modulo de mermas en la cuenta real de Caprichos en Restaurant.pe)**:
   - Motivo: Durante la auditoria previa documentada en REFERENCIA (`almacen.md`, linea 351), la navegacion a `#!/almacen/merma` redirigio a `#!/accesorestringido` porque el usuario de auditoria `krosales` carecia del permiso `almacen.movimientoalmacen`. El detalle de mermas de Restaurant.pe se dedujo de sus plantillas HTML estaticas (`merma.html` y `merma-nuevo.html`), pero no se comprobo en ejecucion viva con datos de Caprichos.

3. **NO VERIFICADO (Costos reales de insumos y mermas de Caprichos)**:
   - Motivo: Los precios, costos de recetas y factores de rendimiento utilizados en el mockup y en este informe son valores de ejemplo estructurados con fines de diseno funcional y no reflejan las facturas comerciales ni los acuerdos de precios privados de Caprichos con sus proveedores.

4. **NO VERIFICADO (Comportamiento del procesamiento batch de kardex)**:
   - Motivo: En REFERENCIA se detecto la llamada `logistica/pendienteProcesoStock`, pero al no poder ejecutar procesos en la base de datos de produccion de MariaDB/MaxScale, no se verifico el tiempo de retardo exacto que toma consolidar las ventas del POS en el kardex definitivo de Restaurant.pe.

5. **NO VERIFICADO (Formatos fisicos de impresion de guias de remision interna)**:
   - Motivo: No se tuvieron a la vista muestras fisicas impresas de guias internas o tickets de almacen emitidos por las ticketeras del local de Caprichos.

---

INFORME LISTO.

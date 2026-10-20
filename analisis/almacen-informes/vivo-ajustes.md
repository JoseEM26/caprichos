---
id: ANA-CAP-007
tipo: analisis
titulo: "Analisis de Pantallas en Vivo de Ajustes: Almacenes, Produccion, Impresoras y Configuraciones de Inventario"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, almacen-informes]
---

# Analisis de Pantallas en Vivo de Ajustes: Almacenes, Produccion, Impresoras y Configuraciones de Inventario

Este informe documenta la inspeccion tecnica exhaustiva de las pantallas reales (en vivo) de restaurant.pe pertenecientes al modulo de Ajustes y configuraciones maestras que impactan en el almacen, las areas de produccion y el control de inventarios. Se analiza la evidencia viva extraida de las plantillas AngularJS ubicadas en `/tmp/claude-1000/almacen-agy/vivo/ajustes-a/` (complementadas con las plantillas de inventario vinculadas en `/tmp/claude-1000/almacen-agy/vivo/almacen/`), se contrastan con los informes previos elaborados a partir de documentacion y se evaluan frente al prototipo de Caprichos (`Admin.dc.html`).

---

## 1 Pantallas encontradas

A continuacion se detallan todas las plantillas analizadas con su nombre exacto de archivo y la funcion operativa que cumplen en el sistema:

### A. Almacenes y Areas de Produccion
1. `scripts__restaurantpe__ajustes__produccion__index.html`:
   - Pantalla principal dual de administracion de Areas de Produccion y Almacenes.
   - Muestra en un diseño a dos columnas: a la izquierda, la tabla de areas de produccion y la tabla de almacenes con sus respectivos buscadores y paginadores; a la derecha, un contenedor lateral persistente (`ui-view="form"`) con sticky kit que incrusta los formularios de creacion y edicion sin salir de la vista. Dispone de botones en cabecera para ver historial de auditoria ("Ver ultimas actualizaciones").
2. `scripts__restaurantpe__ajustes__produccion__almacen-editar.html`:
   - Formulario embebido de creacion y edicion de un Almacen fisico o logico.
   - Configura el nombre del almacen, control de stock, inclusion en el reporte de Food Cost, condicion de linea de produccion y estado activo.
3. `scripts__restaurantpe__ajustes__produccion__area-editar.html`:
   - Formulario embebido de creacion y edicion de un Area de Produccion (ej. Barra, Cocina Caliente, Pasteleria).
   - Asigna el almacen de descarga por defecto, la impresora asociada, la orden de imprimir comandas, reglas de omision de descuento por almacen de caja, tiempos criticos y malos de despacho, asignacion de impresoras por salon, visibilidad en centro logistico (KDS) y estado.
4. `scripts__restaurantpe__ajustes__produccion__modals__almacen-modal.html`:
   - Ventana modal de registro rapido de un nuevo almacen mientras se esta configurando un area de produccion.
5. `scripts__restaurantpe__ajustes__produccion__modals__impresora-modal.html`:
   - Ventana modal de registro rapido de una nueva impresora de red mientras se configura un area de produccion.
6. `scripts__restaurantpe__ajustes__produccion__bc-index.html`, `bc-nuevo.html`, `bc-editar.html`:
   - Plantillas de migas de pan (breadcrumbs) para la navegacion en produccion.

### B. Impresoras y Enrutamiento a Areas de Produccion y Almacen
7. `scripts__restaurantpe__ajustes__impresoras__impresoras-lista.html` e `index.html`:
   - Maestro de impresoras de red y locales registradas por sucursal.
   - Lista nombre, direccion IP, numero de serie, uso para facturacion (serie y correlativo), estado y boton de prueba ("Probar").
8. `scripts__restaurantpe__ajustes__impresoras__areas-tabla.html`:
   - Vista rapida y matriz de asignacion de impresoras directamente por cada Area de Produccion.
   - Permite alternar inline la impresora y el flag de impresion de comanda sin ingresar a la edicion profunda del area, con enlace de retorno hacia `ajustes.produccion`.
9. `scripts__restaurantpe__ajustes__configurarimpresoras__index.html`:
   - Matriz jerarquica avanzada de asignacion de impresoras por Local, Salon y arbol multinivel de Categorias y Subcategorias de productos, con opciones de "Aplicar" y "Replicar a categorias hijas".
10. `scripts__restaurantpe__ajustes__vista-conf-impresora__vista-conf-impresora.view.html` (y parciales `side-vista-conf-impresora.view.html`, `tabla-visualizacion-configuracion.view.html`, `guia-conf-impresion.view.html`):
   - Simulador visual interactivo y diagrama de jerarquia de configuraciones de impresion entre modalidades (Salon, Venta Rapida, Delivery), mostrando el flujo: Terminal -> Salon -> Caja -> Categoria -> Producto -> Area de Produccion -> Impresora.

### C. Motivos de Operacion y Descuentos
11. `scripts__restaurantpe__ajustes__motivosoperacion__index.html` y `editar.html`:
   - Maestro de motivos para operaciones de punto de venta: Descuentos unitarios, Cortesias y Anulaciones de pedidos. No gestiona motivos de movimiento de existencias de almacen.

### D. Cuentas de Transferencia (Aclaracion Operativa)
12. `scripts__restaurantpe__ajustes__tipotransferencia__index.html` y `editar.html`:
   - Administracion de cuentas bancarias y billeteras de pago digital (PLIN, YAPE, Transferencia bancaria). No corresponde a traslados fisicos de mercaderia entre almacenes.

### E. Transportistas para Guías de Remisión y Traslados
13. `scripts__restaurantpe__ajustes__transportistas__index.html` y `editar.html`:
   - Maestro de empresas y conductores de transporte para emision de guias de remision por transferencias de mercaderia entre locales/almacenes y compras. Registra razon social, RUC, direccion fiscal, placa, marca, certificados y licencias.

### F. Opciones Globales del Sistema Vinculadas a Inventario y Almacen
14. `scripts__restaurantpe__ajustes__opcionessistema__index.html` y `modal__impuestos-dinamicos-modal.html`:
   - Panel de parametros del sistema por local y generales. Gobierna:
     - Metodo de valorizacion y control de costos de insumos y productos (Promedio Ponderado, FIFO, Ultimo Costo, Lote).
     - Reserva automatica de stock en pedidos de delivery.
     - Vinculacion y prioridad de descuento de stock entre Almacen de Caja y Almacen de Area de Produccion.
     - Activacion de impuestos dinamicos para compras de insumos e inventario.
     - Gestion de modificadores y agrupadores por sucursal.
     - Comportamiento de precios sin impuestos en notas de venta.

### G. Sucursales, Parametros Contables y Almacenes en ERP
15. `scripts__restaurantpe__ajustes__sucursales__editar.html` y `modals__parametrocontable.view.html`:
   - Configuracion de la sucursal con mapeo de parametros contables para integraciones (SISCONT, CONCAR, SAP B1, STARSOFT, ECB CONT). Incluye:
     - Codigo de almacen para exportables ("WarehouseCode" / `sap_whscode`).
     - Centros de costo (`CostingCode`).
     - Asientos contables para Transferencias de Inventario y Diferencias de Inventario (mermas y descuadres).
16. `scripts__restaurantpe__ajustes__proveedorfe__modals__modal-actualizaareaproduccionsucursales.html`:
   - Modal de asignacion del Area de Produccion principal por cada sucursal de la empresa.

### H. Mapeo de Almacenes y Unidades con ERP Contable
17. `scripts__restaurantpe__ajustes__integracion__modals__modal-mapeos-erpcontable.html`:
   - Pantalla de equivalencias tecnicas: mapea cada almacen del restaurante (`almacenNombre`) contra el almacen del sistema contable externo (`almacenErp`), define la unidad de medida por defecto para articulos sin unidad y los centros de costo asignados.

### I. Cajas Registradas y su Enlace con el Almacen
18. `scripts__restaurantpe__ajustes__cajas__index.html` y `editar.html`:
   - Configuracion de cajas fisicas del local. Incluye el campo obligatorio u opcional `vm.almacenSeleccionado` ("Asignar almacen"), que define de que almacen fisico descuentan las ventas cobradas en dicha terminal.

### J. Unidades de Medida y Categorias de Insumos (Ubicacion Real en restaurant.pe)
19. `scripts__restaurantpe__productos__categorias__insumos__categoria.lista.insumo.view.html`:
   - Ubicada en el modulo de Productos/Insumos (no en Ajustes). Define categorias de insumos con codigo de existencia SUNAT, codigo de familia, cuenta contable y participacion en Food Cost.
20. `scripts__restaurantpe__productos__insumos__nuevo__insumos-nuevo.html`:
   - Demuestra que en restaurant.pe no existe un CRUD de "Unidades de Medida" en Ajustes; las unidades corresponden a un catalogo cerrado del sistema. La configuracion operacional reside en la "Ficha del Insumo", donde se parametriza la conversion entre unidades de compra y unidades de consumo en receta, mas el stock minimo y de apertura por cada almacen.

---

## 2 Detalle de las pantallas clave

### 2.1 Almacenes (`scripts__restaurantpe__ajustes__produccion__almacen-editar.html`)
- **Tipo de interfaz**: Panel lateral integrado con transicion de estado `$state.go('ajustes.produccion.editarAlmacen')`.
- **Campos del formulario**:
  - `almacen_descripcion`: Texto, obligatorio, longitud minima de 3 caracteres, directiva `capitalize` y validacion de unicidad (`uniqueNombrecaja`).
  - `almacen_controlstock`: Casilla de seleccion (icheck), valores `'1'` (activo) o `'0'` (inactivo). Etiqueta: "Control stock". Si esta inactivo, el sistema no restringe ni alerta por saldo en este almacen.
  - `almacen_aplicafoodcost`: Casilla de seleccion (icheck), valores `'1'` o `'0'`. Etiqueta: "Incluir en foodcost". Determina si los insumos consumidos en este almacen entran al calculo del costo porcentual del local.
  - `almacen_eslineaproduccion`: Casilla de seleccion (icheck), valores `'1'` o `'0'`. Etiqueta: "Es linea de produccion". Identifica si el almacen funciona como un area de elaboracion intermedia (ej. panaderia/reposteria).
  - `almacen_estado`: Casilla de seleccion (icheck), valores `'1'` o `'0'`. Etiqueta: "Almacen activo".
- **Botones**:
  - `Guardar` (`#btnRegistrar`): Visible en estado `nuevoAlmacen`, bloqueado si `form.$invalid`, con animacion ladda.
  - `Modificar` (`#btnModificar`): Visible en estado `editarAlmacen`, bloqueado si `form.$invalid`.
  - `Cancelar`: Redirige al estado base `ajustes.produccion`.
- **Columnas de la tabla en index (`#almacenes`)**:
  - `Nombre`: Descripcion del almacen.
  - `Estado`: Badge "Activo" (label-primary) o "Inactivo" (label-danger).
  - `Acciones`: Boton "Editar" con bloqueo condicional si se esta editando un area de produccion al mismo tiempo.
- **Filtros y controles**:
  - Buscador textual: `vm.valBusquedaAlmacen`.
  - Selector de paginacion: `cantidadesPorPaginaAlmacenes` (10, 25, 50, Todos).
  - Boton de refresco directo (`fa-refresh`).
  - Boton de auditoria en cabecera: `vm.fnObtenerLogtablaAlmacenPorId()` ("Ver ultimas actualizaciones").

---

### 2.2 Areas de Produccion (`scripts__restaurantpe__ajustes__produccion__area-editar.html`)
- **Campos del formulario**:
  - `areaproduccion_descripcion`: Texto, obligatorio, longitud minima 3 letras, directivas `colocar-focus` y `capitalize`.
  - `almacenSeleccionado`: Control `ui-select`, obligatorio (`ng-required="true"`). Despliega los almacenes activos del local. Enlace rapido "Crear nuevo almacen" que abre modal emergente si la lista esta vacia o se requiere crear uno nuevo en el acto.
  - `impresoraSeleccionado`: Control `ui-select`, opcional. Lista impresoras con formato: `Nombre (IP)`. Enlace rapido "Registrar nueva impresora".
  - `areaproduccion_imprimir`: Casilla (icheck), `'1'` o `'0'`. Etiqueta: "Imprimir comandas".
  - `areaproduccion_omitiralmacencaja`: Casilla (icheck), `'1'` o `'0'`. Etiqueta: "Omitir configuracion: descuento de stock por almacen de caja". Tooltip explicativo: *"Cada producto vinculado a esta area de produccion se descontara del almacen [Nombre del Almacen Asignado]"*. Solo visible si la configuracion global `estaActivaConfiguracionVinculaAlmacenCaja` esta encendida.
  - `areaproduccion_numerocopias`: Campo numerico entero (`solo-numeros-sin-decimal`), obligatorio si se activa la impresion y la opcion `estaActivaConfiguracionImprimirCopiasAdicionalesDeComandas`.
  - `areaproduccion_tiempodespachomalo`: Numerico entero, maximo 3 digitos. Minutos transcurridos para marcar comanda en estado "malo" (amarillo).
  - `areaproduccion_tiempodespachocrititco`: Numerico entero, maximo 3 digitos. Minutos transcurridos para marcar comanda en estado "critico" (rojo). Ambos visibles si rige `estaActivaConfiguracionTiemposDespachoPersonalizados`.
  - Impresion por Salon:
    - Selector `salon`: Control `ui-select`.
    - Tabla de salones: Columnas Salon, Imp. asignada (`areasalonimpresora_count`), Estado (checkbox) y boton "Asignar" que abre modal `areasalonimpresora`.
    - `areaproduccion_noafectaconfiguracionsalon`: Casilla (icheck) para excluir el area del enrutamiento por salon.
  - `areaproduccion_visiblecentrologistico`: Casilla (icheck), `'1'` o `'0'`. Etiqueta: "Visible en centro logistico" (pantallas KDS de cocina y despacho).
  - `areaproduccion_estado`: Casilla (icheck), `'1'` o `'0'`. Etiqueta: "Area activa".
- **Columnas de la tabla en index (`#areas`)**:
  - `Nombre`: Descripcion del area de produccion.
  - `Almacen`: Descripcion del almacen enlazado.
  - `Impresora`: Nombre de la impresora o texto "Ninguna impresora".
  - `¿Imprime comandas?`: Icono verde "Sí" o rojo "No".
  - `Estado`: Badge "Activo" o "Inactivo".
  - `Acciones`: Boton "Editar" con proteccion tooltip ("Debes terminar de modificar el Almacen para poder editar un Area de produccion").
- **Validaciones y reglas**:
  - Bloqueo mutuo: La interfaz deshabilita la edicion de areas si un almacen esta en edicion y viceversa.
  - Vinculo estricto: Todo producto vendido que pertenezca a esta area descargara recetas e insumos del almacen asignado aqui, a menos que el local trabaje con descarga por caja.

---

### 2.3 Impresoras por Area y Configuracion de Impresion
- **Asignacion Rapida por Area (`scripts__restaurantpe__ajustes__impresoras__areas-tabla.html`)**:
  - Columnas: `Nombre`, `Impresora`, `Imprimir comandas`, `Acciones`.
  - Modo inline: Al pulsar "Editar", la celda de impresora se convierte en un `ui-select` y la de impresion en un checkbox, permitiendo guardar con `vm.fnVincularAreaImpresora(areaproduccion)` sin navegar a otra pantalla.
  - Dispone de boton "Probar" para emitir ticket de prueba a la IP asignada y boton "Ver log" de modificaciones.
- **Enrutamiento por Categorias (`scripts__restaurantpe__ajustes__configurarimpresoras__index.html`)**:
  - Panel izquierdo con selector de Local y lista interactiva de Salones.
  - Panel derecho con arbol de hasta 4 niveles de profundidad de categorias de platos/bebidas (`cat.hijos`, `subhijo.hijos`, `subhijo2.hijos`).
  - Columnas por cada nivel:
    - `Aplicar`: Checkbox `categoria_afectaconfiguracion` para activar la regla.
    - `Replicar`: Checkbox para heredar la configuracion a todas las subcategorias.
    - `Impresora`: Lista repetitiva de impresoras asociadas con boton para agregar multiples impresoras (`+`) o eliminarlas.
- **Visualizador y Simulador de Jerarquia (`scripts__restaurantpe__ajustes__vista-conf-impresora__vista-conf-impresora.view.html`)**:
  - Pestanas por modalidad: Salon, Venta Rapida, Delivery.
  - Reglas de jerarquia documentadas en pantalla:
    - *Configuracion 1 y 2 (Base)*: El pedido se imprime en el area de produccion asignada al producto; si tiene varias areas, sale una copia en cada una.
    - *Configuracion 16 (Prioritaria en Venta Rapida)*: El pedido se imprime directamente en la impresora de la caja emisora.
    - *Configuracion 40 (Prioritaria en Salon)*: Imprime segun la impresora asignada a la categoria del producto en ese salon especifico.
    - *Configuracion 62 y 62.1*: Imprime segun el salon emisor o la terminal que registro la comanda.
  - Simulador de trazas: Representa visualmente la cadena "Terminal -> Salon -> Caja -> Categoria -> Producto -> Area de Produccion -> Impresora" coloreando en verde la ruta activa y en gris las descartadas.

---

### 2.4 Opciones del Sistema que Afectan Inventario (`scripts__restaurantpe__ajustes__opcionessistema__index.html`)
- **Pestanas principales**:
  - `Configuraciones generales`: Parametros globales (ej. Plaza Puntos).
  - `Configuraciones por local`: Listado categorizado con buscador textual (`vm.valBusqueda`).
- **Opciones criticas de Inventario y Almacen**:
  - `CONTROL_DE_COSTOS` y `CONTROL_DE_COSTOS_PRODUCTOS`:
    - Tipo de control: Lista desplegable obligatoria con 4 algoritmos:
      0. *Promedio ponderado* (default para gastronomia en Peru).
      1. *FIFO* (PEPS - Primeras entradas, primeras salidas; requiere flag auxiliar).
      2. *Ultimo costo* (actualiza costo de reposicion segun la ultima compra).
      3. *Lote* (control por lote especifico de ingreso).
  - `CONFIGURACION_USAR_RESERVAS_DE_STOCK_EN_DELIVERYS`:
    - Permite reservar stock temporalmente cuando entra un pedido por delivery online o WhatsApp antes de que sea aceptado o cobrado en caja.
  - `CONFIGURACION_PERMITIR_USO_DE_IMPUESTOS_DINAMICOS_PARA_COMPRAS_Y_VENTAS`:
    - Modal `impuestos-dinamicos-modal.html`: Vincula cada tasa de impuesto (IGV 18%, etc.) con su correspondiente tributo fiscal SUNAT para el correcto costeo neto y credito fiscal en compras de insumos.
  - `CONFIGURACION_GESTION_AGRUPADOR_Y_MODIFICADOR_POR_LOCAL`:
    - Controla si las recetas y modificadores (ej. tipos de leche, jarabes extras) se administran por sucursal independiente o a nivel cadena.
  - `PRECIOS_PRODUCTOS_SIN_IMPUESTOS`:
    - Define si las notas de venta descuentan existencias alterando precios y si los descuentos se calculan sobre el subtotal o el total.
  - Categorias visibles: Las opciones relativas a stock portan el icono descriptivo de almacen (`fa-shopping-basket` para `cAlmacen`, `fa-archive` para `Inventario`, `fa-desktop` para `Cocina`).

---

### 2.5 Transportistas (`scripts__restaurantpe__ajustes__transportistas__editar.html`)
- **Campos del formulario**:
  - `transportista_razonsocial`: Texto, obligatorio, minimo 3 letras.
  - `transportista_ruc`: Numerico, obligatorio, validado a 11 digitos.
  - `transportista_direccion`: Texto, obligatorio.
  - `transportista_placa`: Texto, opcional (placa del camion/vehiculo de carga).
  - `transportista_marca`: Texto, opcional (marca del vehiculo).
  - `transportista_certificado`: Texto, opcional (certificado de habilitacion vehicular).
  - `transportista_licencia`: Texto, opcional (brevete del conductor).
  - `transportista_telefono`: Texto, opcional.
  - `transportista_estadol`: Checkbox (icheck), `'1'` (activo) o `'0'` (inactivo).
- **Ruta de navegacion**: Enlazado internamente a `$state.go('modulocompras.ajustes.transportistas')`. Se utiliza para emitir Guias de Remision Electronicas de remitente en traslados entre sucursales o devoluciones a proveedores.

---

### 2.6 Categorias de Insumos (`scripts__restaurantpe__productos__categorias__insumos__categoria.lista.insumo.view.html`)
- **Campos**:
  - `categoriainsumo_descripcion`: Texto, obligatorio ("Nombre").
  - `categoriainsumo_cuenta`: Texto, opcional ("Cuenta contable").
  - `categoriainsumo_codigofamilia`: Texto, opcional ("Codigo familia").
  - `categoriainsumo_codigoexistencia`: Texto, opcional ("Codigo de existencia SUNAT").
  - `categoriainsumo_controlfoodcost`: Checkbox (icheck), `'1'` o `'0'` ("¿Se aplica en Food-Cost?").
  - `categoriainsumo_estado`: Checkbox, `'1'` o `'0'` ("Activa").
  - Filtro: Casilla "Ver Anuladas" (`vm.verAnulados`).
  - Gestion de impuestos: Enlace a modal de afectacion tributaria para insumos de la categoria.

---

### 2.7 Conversión de Unidades y Stock por Almacen (`scripts__restaurantpe__productos__insumos__nuevo__insumos-nuevo.html`)
- **Unidad de medida base**: Selector `ui-select` obligatorio alimentado por `vm.listaUnidadesMedida` (catalogo cerrado de unidades).
- **Panel de conversion de unidades para recetas**:
  - Checkbox `permiteConversion`: *"¿Utilizas este insumo con otras unidades de medida cuando armas tus recetas base? Permitir conversiones"*.
  - Regla: `[X] [Unidad Base]` equivale a `[Y] [Unidad de Receta]` (ej. 1 KILOGRAMO equivale a 1000 GRAMOS).
- **Tabla matricial de Stock por Almacen (al dar de alta el insumo)**:
  - Columnas: `Almacen`, `¿Se controla?` (checkbox), `Stock Apertura` (input con sigla de unidad), `Costo Por 1 [Unidad]` (input monetario con hasta 6 decimales para costeo fino de insumos), `Stock Minimo` (input con sigla).
  - Solo se activan los campos de cantidad y costo si se marca la casilla `almacen_controlar`.

---

### 2.8 Enlace de Almacen en Cajas (`scripts__restaurantpe__ajustes__cajas__editar.html`)
- **Campo `vm.asignar_caja`**: Checkbox "Asignar almacen".
- **Campo `vm.almacenSeleccionado`**: Control `ui-select` para seleccionar el almacen de descarga vinculado a la caja.
- **Regla operacional**: Cuando el personal cobra en esta caja, el sistema descuenta los insumos del almacen asignado a la caja, a menos que el Area de Produccion tenga activa la casilla `areaproduccion_omitiralmacencaja`, en cuyo caso se respeta prioritariamente el almacen de dicha area.

---

## 3 Confirmaciones o correcciones a los informes previos

Al comparar la evidencia extraida directamente de las plantillas en vivo frente a los reportes preliminares de la carpeta `/home/jose/JoseEM/caprichos/analisis/almacen-informes/`, se determinan los siguientes hallazgos:

### 3.1 Confirmaciones
1. **Confirmacion sobre `almacen.md` y `modulos.md` - Multi-almacen y vinculo con produccion**:
   - Se confirma plenamente lo reportado en `almacen.md` (seccion 2.2) y `modulos.md` (seccion B.1, punto 16): restaurant.pe separa logicamente los almacenes fisicos de las areas de produccion pero los enlaza de manera obligatoria (`almacenSeleccionado` en `area-editar.html`).
2. **Confirmacion sobre `stock.md` - Conversion de Unidades por Insumo**:
   - Se confirma lo indicado en `stock.md` (seccion 2.1): la conversion de unidades no es una tabla general en Ajustes, sino un factor de equivalencia declarado insumo por insumo (`permiteConversion` en `insumos-nuevo.html`), permitiendo comprar en una unidad (saco de 5 kg o botella de 1 L) y descargar en recetas por gramos o mililitros.
3. **Confirmacion sobre `almacen.md` - Descuento por Almacen de Caja vs. Produccion**:
   - Se confirma la regla descubierta en los documentos: restaurant.pe contempla el conflicto operativo de donde descontar el stock (si del almacen de la barra donde se cobra o del almacen de la cocina que produce) mediante el flag `areaproduccion_omitiralmacencaja` y la opcion del sistema `estaActivaConfiguracionVinculaAlmacenCaja`.
4. **Confirmacion sobre `stock.md` - Metodos de Costeo**:
   - Se confirma que el sistema soporta formalmente 4 algoritmos de valuacion de inventario en `opcionessistema`: Promedio Ponderado, FIFO, Ultimo Costo y Lote.

### 3.2 Correcciones Criticas
1. **Correccion a `modulos.md` y `almacen.md` respecto a "Tipos de Transferencia"**:
   - *Error en informe previo*: Se asumio que la pantalla `Ajustes > Tipo transferencia` (`ajustes.tipotransferencia`) configuraba traslados internos de mercaderia entre almacenes o sucursales.
   - *Correccion en vivo*: La plantilla `scripts__restaurantpe__ajustes__tipotransferencia__index.html` demuestra de forma irrefutable que "Tipos de transferencia" corresponde exclusivamente a **Cuentas bancarias y medios de pago electronico** (YAPE, PLIN y Transferencia bancaria) para cobros en caja. No tiene relacion con el inventario fisico.
2. **Correccion a `modulos.md` respecto a "Motivos de Movimiento de Almacen"**:
   - *Error en informe previo*: Se mencionaba que en Ajustes se administraban los motivos de entrada, salida y merma de almacen.
   - *Correccion en vivo*: La plantilla `scripts__restaurantpe__ajustes__motivosoperacion__index.html` evidencia que `motivosoperacion` solo gestiona motivos para punto de venta: Descuentos unitarios, Cortesias y Anulaciones de pedidos. Los tipos de movimiento de almacen en restaurant.pe son fijos o se administran dentro de las pantallas transaccionales del modulo Almacen (`merma`, `movimientoalmacen`), no en Ajustes.
3. **Correccion sobre "Pantalla de Unidades de Medida"**:
   - *Error en informe previo*: Se buscaba una pantalla CRUD de unidades de medida dentro de Ajustes.
   - *Correccion en vivo*: No existe tal pantalla en Ajustes. Las unidades son un catalogo de sistema precargado. Lo que se parametriza es la equivalencia y la asignacion de stock inicial/minimo por almacen en la pantalla de insumos de Productos.
4. **Correccion sobre la ubicacion de "Categorias de Insumos"**:
   - *Error en informe previo*: Se listaba categorias de insumos como submateria de Ajustes generales.
   - *Correccion en vivo*: La plantilla en vivo demuestra que `categoria.lista.insumo.view.html` pertenece a `productos.insumos.categoria`, formando un submenu lateral dentro del maestro de insumos.
5. **Correccion sobre "Estado de la inspeccion en vivo" en `vivo-almacen.md`**:
   - *Situacion previa*: `vivo-almacen.md` reportaba "NO HAY SESION EN EL NAVEGADOR DEL AGENTE" porque se evaluaba intentando navegar por URL externa.
   - *Correccion actual*: La inspeccion se realiza sobre las plantillas HTML AngularJS reales en vivo almacenadas en el entorno local, permitiendo verificar cada directiva, ng-model y validacion con precision de codigo fuente.

---

## 4 Lo que falta en el mockup, priorizado

Al contrastar la maqueta interactiva de Caprichos (`Admin.dc.html`) con las pantallas en vivo inspeccionadas, se identifican las siguientes omisiones tecnicas y funcionales, ordenadas por gravedad:

| Falta identificada | Pantalla / Plantilla de referencia en vivo | Gravedad | Esfuerzo (S/M/L) | Justificacion para Caprichos |
| :--- | :--- | :--- | :--- | :--- |
| **Soporte Multi-Almacen (Almacen Central vs. Barra vs. Cocina)** | `scripts__restaurantpe__ajustes__produccion__almacen-editar.html` | **Critica** | **M** | El mockup asume un unico inventario global. En Caprichos se requiere separar el stock del almacen seco (deposito) del stock en mano de la barra (leche, cafe, jarabes) y pasteleria (donas, postres). |
| **Configuracion de Areas de Produccion y Almacen de Descarga** | `scripts__restaurantpe__ajustes__produccion__area-editar.html` | **Critica** | **M** | En el mockup las recetas descuentan en el aire. No se define que la preparacion de un Frappe debe descargar insumos del almacen de Barra ni de que almacen consume la cocina caliente. |
| **Enrutamiento y Asignacion de Impresoras por Area/Salon** | `scripts__restaurantpe__ajustes__impresoras__areas-tabla.html` y `configurarimpresoras__index.html` | **Alta** | **M** | En Caprichos las comandas de bebidas deben salir en la ticketera de Barra y los sandwiches/waffles en Cocina. Hoy el mockup solo tiene una alerta generica de "error de impresora" sin enrutamiento real. |
| **Banderas de Control de Almacen (Control Stock, Food Cost, Linea Prod.)** | `scripts__restaurantpe__ajustes__produccion__almacen-editar.html` | **Alta** | **S** | No existe parametrizacion para indicar si un almacen calcula food cost o si es una linea de produccion del dia (donas). |
| **Regla de Prioridad de Descuento (Almacen de Caja vs. Almacen de Area)** | `scripts__restaurantpe__ajustes__produccion__area-editar.html` (`areaproduccion_omitiralmacencaja`) | **Alta** | **S** | Si se vende una dona en caja para llevar, debe saberse si se descuenta de la vitrina de atencion o del almacen de produccion. |
| **Conversion de Unidades de Medida en Ficha de Insumo** | `scripts__restaurantpe__productos__insumos__nuevo__insumos-nuevo.html` | **Alta** | **M** | El mockup usa cantidades decimales arbitrarias (0.018 kg de cafe). Se requiere la regla: 1 bolsa = 1 kg = 1000 g para que el stock y la receta cuadren de forma natural. |
| **Metodo de Costeo de Inventario (Opciones del Sistema)** | `scripts__restaurantpe__ajustes__opcionessistema__index.html` (`CONTROL_DE_COSTOS`) | **Media** | **S** | El mockup no define si el valor del inventario se actualiza por Promedio Ponderado o Ultimo Costo, afectando el margen bruto visible en los informes. |
| **Maestro de Transportistas para Guias de Remision** | `scripts__restaurantpe__ajustes__transportistas__editar.html` | **Baja** | **S** | Necesario unicamente si Caprichos abre un centro de produccion separado y traslada mercaderia con guias formales de remitente a la tienda. Para un solo local es prescindible inicialmente. |

---

## 5 Mejoras sobre restaurant.pe (menos tablas, todo en un solo lugar)

La arquitectura de restaurant.pe en materia de ajustes de almacen y produccion presenta una dispersion severa: para configurar el circuito de preparacion y despacho de un cafe con dona, el usuario debe abrir 6 pantallas distintas repartidas en rutas desconectadas (`ajustes.produccion`, `ajustes.impresoras`, `ajustes.configurarimpresoras`, `ajustes.opcionessistema`, `productos.insumos.categoria` y `ajustes.cajas`).

Caprichos puede resolver esto mediante una experiencia unificada, simplificada y enfocada en cafeteria:

### 5.1 Consolidacion en un unico "Centro de Configuracion de Operaciones"
En lugar de forzar al administrador a navegar entre pantallas aisladas, se propone fusionar Almacenes, Areas de Produccion e Impresoras en una **vista de 3 tarjetas interconectadas**:
- **Tarjeta 1: Almacenes Fisicos**:
  - Lista limpia de los 3 almacenes reales de Caprichos: *Almacen Principal (Deposito)*, *Barra de Cafe y Bebidas* y *Cocina / Pasteleria*.
  - Switch rapido: Control de stock (Si/No) e Incluir en Food Cost (Si/No).
- **Tarjeta 2: Estaciones de Preparacion (Areas de Produccion)**:
  - Cada estacion (Barra, Cocina, Vitrina) muestra en una sola linea: Nombre, Almacen del cual descuenta sus recetas y la Impresora o Pantalla (KDS) donde se reciben los pedidos.
  - Sin formularios modales superpuestos: edicion directa inline.
- **Tarjeta 3: Regla de Despacho Simple**:
  - Una regla clara y legible: *"Los productos pedidos en Salon o Delivery descuentan del almacen de su estacion de produccion. Las bebidas descuentan de Barra, los postres de Vitrina y los salados de Cocina"*. Se elimina la confusa red de checkboxes y excepciones cruzadas de restaurant.pe.

### 5.2 Unificacion de Insumos, Unidades y Categorias en la Ficha del Articulo
- En restaurant.pe, crear un insumo exige crear la categoria en un submenu, asignarle cuentas contables que un encargado de cafeteria no domina, y luego configurar unidades en otra pantalla.
- En Caprichos, al crear un insumo (ej. *Cafe en Grano Especial*):
  - La categoria se elige o se escribe directamente (creacion al vuelo).
  - La unidad de compra (ej. *Bolsa de 1 kg*) y la unidad de receta (ej. *Gramo - g*) se configuran en la misma tarjeta con una frase natural: *"1 Bolsa equivale a 1000 Gramos"*.
  - El stock minimo se define en esa misma vista por cada estacion (ej. Barra: minimo 2 kg; Deposito: minimo 10 kg).

### 5.3 Eliminacion de Tablas Burocraticas Innecesarias
- **Eliminar `tipotransferencia` duplicada**: Los pagos por Yape/Plin pertenecen a la configuracion de caja, no a transferencias de inventario.
- **Simplificar `configurarimpresoras`**: Eliminar la matriz de 4 niveles de subcategorias por salon. En una cafeteria del tamaño de Caprichos, el enrutamiento es por estacion: todo lo clasificado como Bebida va a la ticketera de Barra; todo lo clasificado como Comida va a Cocina; todo lo de Vitrina se entrega inmediato.
- **Reemplazar el visor abstracto de configuraciones de impresion**: En lugar del diagrama de simulacion con jerarquias tecnicas (#16, #40, #62, #62.1), mostrar una vista previa de comandas de ejemplo con un selector: *"¿Donde quieres que se imprima la comanda de Barra?"*.

---

## 6 NO VERIFICADO

En estricto apego a las reglas de verificacion sobre las plantillas en vivo, se deja constancia de lo que **no se encuentra en las plantillas analizadas** y requeriria validacion adicional en el backend o base de datos:

1. **NO VERIFICADO — Catalogo maestro completo de Unidades de Medida**:
   - En las plantillas en vivo de Ajustes no existe archivo que contenga la definicion de la tabla `unidadmedidainsumo`. Las siglas (KG, LTR, NIU, UND, G, ML) se consumen como servicio REST inyectado a los controladores AngularJS (`vm.listaUnidadesMedida`). No es posible verificar desde estas plantillas si el usuario administrador puede crear nuevas unidades arbitrarias en base de datos o si es una lista estatica inmutable.
2. **NO VERIFICADO — Logica exacta de redondeo del costo promedio ponderado en base de datos**:
   - Si bien la plantilla `opcionessistema__index.html` muestra la seleccion del metodo "Promedio ponderado" (valor `'0'`), la formula matematica de recalculacion ante recepcion de compras con flete o descuentos financieros se procesa en el backend PHP/Node de restaurant.pe y no es visible en el HTML cliente.
3. **NO VERIFICADO — Pantalla de gestion de perfiles y tags de permisos dentro de `/vivo/ajustes-a/`**:
   - La carpeta `/vivo/ajustes-a/` no contiene los archivos de `usuarios` ni `perfilUsuario.html` (los cuales fueron auditados documentalmente en `referencia/modulos-usuarios-notificaciones.md`). La configuracion de que permisos especificos de almacen se asignan a cada rol no esta presente en los archivos de esta carpeta particular.
4. **NO VERIFICADO — Comportamiento en tiempo real del socket de impresoras de red**:
   - El boton "Conectar con servicio" y "Probar" (`vm.fnTestImpresora`) invoca llamadas locales al agente de impresion de escritorio de restaurant.pe (servicio Quipu/Bridge). La tasa de fallo y comportamiento ante desconexion de red no puede verificarse estaticamente sin ejecucion de red.

---

INFORME LISTO.

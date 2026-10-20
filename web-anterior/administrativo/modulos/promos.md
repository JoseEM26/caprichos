# Módulo: Ofertas, Descuentos, Cupones, Promociones y Vales de Pago

Documentación técnica, arquitectónica y funcional del subsistema comercial de **Ofertas, Descuentos, Cupones de Descuento, Promociones/Sorteos y Vales de Pago** del sistema de gestión y POS de **CAPRICHOS** (`https://caprichos.restaurant.pe/restaurant/#!/login`). Elaborada mediante auditoría pasiva en modo estricto de solo lectura sobre el entorno de producción, complementada con el análisis estructural de las plantillas públicas AngularJS, directivas, controladores de interfaz y contratos de endpoints REST.

---

## 1. Propósito General del Módulo

El subsistema de fidelización y promociones comerciales tiene como objetivo regular y automatizar todas las estrategias de incentivo comercial, rebaja de precios, premios por sorteo y medios de pago promocionales dentro de CAPRICHOS. Sus funciones centrales abarcan:

1. **Gestión de Ofertas por Volumen y Modalidad**: Programación y tarificación especial de productos bajo formatos estructurados (Combos "2 en 1", "2 x 1", "Precio Bajo" escalonado por volumen, y "Por Salón" con precios diferenciados por zona).
2. **Políticas de Descuentos Operativos**: Administración de motivos de descuento (Personal, Cortesías, Convenios, Descuentos de Gerencia), límites máximos autorizados, porcentajes deducibles y restricciones de no acumulación con ofertas.
3. **Emisión y Canje de Cupones de Descuento**: Generación masiva o correlativa de códigos de cupones con fecha de caducidad, saldo monedero fraccionable o uso único, restricción por cliente y carga masiva vía hojas de cálculo Excel.
4. **Mecánicas de Sorteos en Punto de Venta**: Configuración de cupones físicos impresos automáticamente por la ticketera al alcanzar umbrales de consumo o al comprar productos seleccionados, solicitando datos al cliente para ánforas.
5. **Vales de Pago y Certificados de Regalo (Gift Cards)**: Mantenimiento de vales prepagos vinculados a formas de pago del POS, control de saldo reutilizable, restricción por producto y alcance por local o global.

---

## 2. Mapa de Navegación y Rutas del Subsistema

```text
Promociones y Descuentos
├── 1. Ofertas (#!/ofertas)
│   ├── Oferta 2 en 1 (#!/ofertas/sucursales/2en1/1/categoria/:idCategoria)
│   │   ├── Matriz de asignación de precios por sucursal
│   │   └── Registrar oferta 2 en 1 (#!/ofertas/2en1/registrar/1/categoria/:idCategoria)
│   ├── Oferta 2 x 1 (#!/ofertas/sucursales/2x1/2/categoria/:idCategoria)
│   │   ├── Matriz de asignación de precios por sucursal
│   │   └── Registrar oferta 2 x 1 (#!/ofertas/2x1/registrar/2/categoria/:idCategoria)
│   ├── Oferta Precio Bajo (#!/ofertas/sucursales/lowprice/3/categoria/:idCategoria)
│   │   ├── Matriz de asignación de precios por sucursal
│   │   └── Registrar precio bajo (#!/ofertas/lowprice/registrar/3/categoria/:idCategoria)
│   └── Oferta Por Salón (#!/ofertas/porsalon/4/categoria/:idCategoria)
│       ├── Lista de ofertas por salón
│       └── Registrar oferta por salón (#!/ofertas/porsalon/registrar/4/categoria/:idCategoria)
│
├── 2. Descuentos (#!/descuentos)
│   ├── Lista de Categorías de Descuento (#!/descuentos)
│   ├── Registrar Nuevo Descuento (#!/descuentos/nuevo)
│   └── Modificar Descuento Existente (#!/descuentos/:idDescuento/editar)
│
├── 3. Cupones de Descuento (#!/ajustes/cupondescuento)
│   ├── Lista y Saldos de Cupones (#!/ajustes/cupondescuento)
│   ├── Registrar / Generar por Lote (#!/ajustes/cupondescuento/nuevo)
│   ├── Editar Cupón (#!/ajustes/cupondescuento/:idCupondescuento/editar)
│   ├── Importar Cupones desde Excel (#!/ajustes/cupondescuento/importar)
│   └── Modal Gestión de Categorías de Cupón
│
├── 4. Promociones y Sorteos (#!/promocionsorteo)
│   ├── Vista Principal (Dashboard / Campañas) (#!/promocionsorteo)
│   ├── Lista de Sorteos Registrados (#!/promocionsorteo/listar)
│   ├── Registrar Nueva Promoción/Sorteo (#!/promocionsorteo/registrar)
│   └── Campañas de Mensajería (#!/promocionsorteo/detalle/:idPlanmensajeria)
│
└── 5. Vales de Pago (#!/ajustes/valedepago)
    ├── Lista de Vales de Pago y Formas de Pago (#!/ajustes/valedepago)
    ├── Configurar / Editar Vale (#!/ajustes/valedepago/:idVale/editar)
    ├── Modal Configurar por Local (modal-configurarporlocal)
    └── Modal Vales Restaurant por Productos (modal-valepagorestaurant)
```

---

## 3. Pantalla 1: Ofertas (`#!/ofertas/sucursales/2en1/1/categoria/All`)

### 3.1 Propósito
Permite definir, habilitar y sincronizar ofertas comerciales directas aplicadas a los platos y bebidas de la carta, diferenciadas por sucursal y canal de venta. Integra un selector visual superior para 4 modalidades de oferta comercial: **2 en 1**, **2 x 1**, **Precio bajo** y **Por salón**.

### 3.2 Flujo de Uso Paso a Paso
1. **Selección del Tipo de Oferta**: El usuario ingresa a la pantalla y utiliza la barra superior de selección rápida para alternar entre:
   - Botón `2 en 1` (`tipoOfertaTxt: '2en1'`, `idTipooferta: '1'`)
   - Botón `2 x 1` (`tipoOfertaTxt: '2x1'`, `idTipooferta: '2'`)
   - Botón `Precio bajo` (`tipoOfertaTxt: 'lowprice'`, `idTipooferta: '3'`)
   - Botón `Por salón` (`tipoOfertaTxt: 'porsalon'`, `idTipooferta: '4'`)
2. **Filtro por Categoría de Carta**: A través del árbol lateral de categorías, el usuario filtra los platos a los que desea aplicar la oferta o selecciona `All` para ver el catálogo completo.
3. **Configuración de Precios y Sucursales en Matriz**:
   - En la tabla de asignación por sucursales, el sistema lista cada producto y una columna por cada local operativo (ej. *Sucursal CAPRICHOS*).
   - El usuario activa o desactiva la oferta mediante casillas de verificación por local o marca la casilla global `¿Marcar fila?` para afectar todas las sucursales.
   - Digita el precio promocional correspondiente para la sucursal.
4. **Registro de una Oferta Nueva**:
   - Al pulsar el botón `+` junto al tipo de oferta o el botón de registro, se abre el formulario de registro (`oferta2en1.registrar`, `oferta2x1.registrar`, etc.).
   - Define el producto principal, cantidad o equivalencia, y restricciones de calendario/canal.
5. **Guardado**: El usuario pulsa `Guardar cambios` para persistir las activaciones masivas por sucursal.

### 3.3 Columnas de la Tabla Principal (Matriz de Asignación)
| Columna | Alineación | Significado / Contenido | Variable Angular |
| :--- | :--- | :--- | :--- |
| **Producto** | Izquierda | Nombre de la presentación o plato general | `producto.producto_descripcion` |
| **¿Marcar fila?** | Centro | Checkbox maestro para activar o desactivar la oferta en todas las sucursales | `oferta.marcarfila` |
| **Sucursal [Nombre Local]** | Centro / Derecha | Checkbox de estado por sucursal e input de precio o cantidad asignada | `localoferta.oferta.oferta_estado` / `localoferta.oferta.oferta_precio` |

### 3.4 Formularios de Registro según Tipo de Oferta

#### A. Oferta 2 en 1 (`oferta2en1.registrar.view.html`)
Combina una cantidad fija de productos por un precio global único.
| Etiqueta | Tipo de Control | Obligatorio | Opciones / Rango | Variable Angular |
| :--- | :--- | :--- | :--- | :--- |
| **Seleccionar Producto** | `ui-select` / Búsqueda | **Sí** | Catálogo de productos activos | `vm.productobusqueda` |
| **Cantidad de productos** | `input[number]` | **Sí** | Mínimo 2 | `vm.productobusqueda.oferta_cantidad` |
| **Precio por cantidad** | `input[number]` | **Sí** | Monto en moneda local | `vm.productobusqueda.oferta_preciocantidad` |
| **¿Aplica a Delivery?** | `checkbox` (switch) | No | Sí / No | `vm.oferta.oferta_aplicadelivery` |
| **¿Aplica a Salones?** | `checkbox` (switch) | No | Sí / No | `vm.oferta.oferta_aplicasalones` |
| **¿Aplica a Ventas Rápidas?** | `checkbox` (switch) | No | Sí / No | `vm.oferta.oferta_aplicarapidas` |
| **¿Restricción por monto?** | `checkbox` | No | Sí / No | `vm.oferta.oferta_pormonto` |
| **Monto mínimo de orden** | `input[number]` | Condicional | Requerido si activa restricción por monto | `vm.oferta.oferta_monto` |
| **Oferta periódica** | `select` | No | Permanente / Por rango de fechas | `vm.oferta.oferta_periodica` |
| **Fecha inicial / final** | `datepicker` | Condicional | Rango calendario | `vm.fechaHora.oferta_fechainicial` / `vm.fechaHora.oferta_fechafinal` |
| **Horario por día** | `select` / `timepicker` | No | Rango de horas (ej. 16:00 a 19:00) | `vm.fechaHora.oferta_horainicio` / `vm.fechaHora.oferta_horafin` |
| **Límite máximo por orden** | `input[number]` | No | Cantidad máxima por cliente/comanda | `vm.oferta.oferta_cantmaxproducto` |
| **Stock total para oferta** | `input[number]` | No | Existencias máximas promocionales | `vm.oferta.oferta_stock` |

#### B. Oferta 2 x 1 (`oferta2x1.registrar.view.html`)
Mecánica de compre X y lleve Y (ej. compra 1 y lleva 2).
| Etiqueta | Tipo de Control | Obligatorio | Opciones / Rango | Variable Angular |
| :--- | :--- | :--- | :--- | :--- |
| **Producto Compra** | `ui-select` | **Sí** | Producto a comprar | `vm.productobusqueda.oferta_compra` |
| **Producto Lleva** | `ui-select` | **Sí** | Producto bonificado | `vm.productobusqueda.oferta_lleva` |
| **Canales autorizados** | `checkboxes` | No | Delivery, Salón, Venta Rápida | `oferta_aplicadelivery`, `oferta_aplicasalones`, `oferta_aplicarapidas` |
| **Vigencia y horarios** | Fechas / Horas | No | Permanente o rango de fechas y horas | `fechaHora` |
| **Límite de stock / orden** | `input[number]` | No | Límites por comanda | `oferta_cantmaxproducto`, `oferta_stock` |

#### C. Oferta Precio Bajo (`lowprice.registrar.view.html`)
Descuento directo sobre el precio unitario del producto o precio escalonado por volumen.
| Etiqueta | Tipo de Control | Obligatorio | Opciones / Rango | Variable Angular |
| :--- | :--- | :--- | :--- | :--- |
| **Precio promocional** | `input[number]` | **Sí** | Precio rebajado | `vm.productobusqueda.oferta_precio` |
| **¿Aplica por volumen vendido?** | `checkbox` | No | Escala por cantidad comprada | `vm.oferta.oferta_aplicaporcantidadvendida` |
| **Desde cantidad vendida** | `input[number]` | Condicional | Cantidad mínima comprada | `vm.oferta.oferta_desdecantidadvendida` |
| **Hasta cantidad vendida** | `input[number]` | Condicional | Cantidad máxima de la escala | `vm.oferta.oferta_hastacantidadvendida` |
| **¿Aplica Menú Online?** | `checkbox` | No | Habilita en carta QR / web | `vm.oferta.oferta_aplicamenuonline` |

#### D. Oferta Por Salón (`porsalon.registrar.view.html`)
Tarifas especiales asignadas según el ambiente físico (ej. Terraza vs Salón Principal).
| Etiqueta | Tipo de Control | Obligatorio | Opciones / Rango | Variable Angular |
| :--- | :--- | :--- | :--- | :--- |
| **Salón / Zona** | `select` | **Sí** | Lista de salones del local | `vm.salonSeleccionado` |
| **Precio por salón** | `input[number]` | **Sí** | Precio diferenciado | `vm.productobusqueda.oferta_preciosalon` |
| **Vigencia temporal** | Rango Fechas | No | Días y horas | `fechaHora` |

### 3.5 Filtros Disponibles
- Selector de Tipo de Oferta (tabs: `2 en 1`, `2 x 1`, `Precio bajo`, `Por salón`).
- Árbol jerárquico de Categorías de Carta a la izquierda.
- Selector de Sucursal / Local.

### 3.6 Botones y Acciones Visibles
- `2 en 1` (botón de selector con icono)
- `2 x 1` (botón de selector con icono)
- `Precio bajo` (botón de selector con icono)
- `Por salón` (botón de selector con icono)
- `+` (icono de botón para registrar oferta nueva de cada tipo)
- `Ver detalles de ofertas` (`btn btn-primary`)
- `Guardar cambios` (`btn btn-success`)
- `Cancelar` (`btn btn-default`)

### 3.7 Estados y Reglas Visibles
- Validación obligatoria de selección de producto.
- Control de concurrencia: si la oferta se desactiva en el local, el checkbox maestro de la fila se desmarca automáticamente (`fnChangeSelectOfertaLocal`).
- Si se activa `oferta_pormonto`, el campo `oferta_monto` se vuelve estrictamente obligatorio y debe ser mayor a 0.

### 3.8 Relaciones con Otros Módulos
- **Productos / Carta**: Consume el árbol de categorías y las presentaciones de platos.
- **Ventas (Salones, Venta Rápida, Delivery)**: Aplica automáticamente las reglas de precio según el canal activado en la oferta.
- **Caja / Cobranza**: Refleja la rebaja en la pre-cuenta y detalle de boleta.

### 3.9 Entidades de Datos
- `Oferta`: `oferta_id`, `productogeneral_id`, `producto_id`, `tipooferta_id`, `oferta_precio`, `oferta_cantidad`, `oferta_preciocantidad`, `oferta_compra`, `oferta_lleva`, `oferta_aplicadelivery`, `oferta_aplicasalones`, `oferta_aplicarapidas`, `oferta_aplicamenuonline`, `oferta_pormonto`, `oferta_monto`, `oferta_periodica`, `oferta_fechainicial`, `oferta_fechafinal`, `oferta_horainicio`, `oferta_horafin`, `oferta_cantmaxproducto`, `oferta_stock`, `oferta_estado`.
- `OfertaLocal`: `ofertalocal_id`, `oferta_id`, `local_id`, `oferta_precio`, `oferta_estado`.

### 3.10 Permisos Asociados
- Requiere ACL: `"ofertas"`.

### 3.11 Endpoints GET
- `GET /restaurant/api/rest/oferta/getAllByTipoAndCategoria/:idTipooferta/:idCategoria/:pagina/:registros/:idEstado/:idLocal`
  - *Respuesta*: `{ tipo: "SUCCESS", data: [ { productogeneral_id, producto_descripcion, locales: [ { local_id, oferta: { oferta_id, oferta_estado, oferta_precio } } ] } ], total: 45 }`
- `GET /restaurant/api/rest/oferta/get/:idOferta`
  - *Respuesta*: `{ tipo: "SUCCESS", data: { oferta_id, tipooferta_id, oferta_fechainicial, ... } }`

---

## 4. Pantalla 2: Descuentos (`#!/descuentos`)

### 4.1 Propósito
Configurar las categorías o motivos de descuento del restaurante. Estas categorías definen políticas de descuento (porcentaje por defecto, monto máximo en soles, deducibilidad tributaria y reglas de exclusión para evitar acumulación con promociones).

### 4.2 Flujo de Uso Paso a Paso
1. **Visualización de la Lista**: El usuario accede a `#!/descuentos` y observa la tabla de categorías de descuento configuradas en el sistema (ej. *Cortesía*, *Descuento Personal*, *Convenio Corporativo*), junto con su estado (Activo/Inactivo).
2. **Crear Nuevo Descuento**: Pulsa el botón `Registrar descuento` para navegar a `#!/descuentos/nuevo`.
3. **Formulario de Parámetros**:
   - Ingresa la descripción del descuento.
   - Especifica el porcentaje de descuento por defecto (%) y el monto máximo autorizado (en moneda local).
   - Opcionalmente habilita porcentaje deducible (para gastos de representación o deducciones contables).
   - Configura exclusiones: selecciona qué categorías de la carta NO admiten este descuento (ej. licores o combos).
   - Marca la regla de protección anti-acumulación: `No afecta a promociones u ofertas`.
   - Asigna las sucursales donde el descuento es válido.
4. **Edición**: Desde la lista principal, pulsa `Editar` sobre una fila para modificar sus parámetros en `#!/descuentos/:idDescuento/editar`.

### 4.3 Columnas de la Tabla Principal (`descuento.lista.view.html`)
| Columna | Alineación | Significado / Contenido | Variable Angular |
| :--- | :--- | :--- | :--- |
| **Descripción** | Izquierda | Nombre o motivo de la categoría de descuento | `categoriadescuento.categoriadescuento_descripcion` |
| **Estado** | Centro | Estado operativo (`Activo` en verde / `Inactivo` en rojo) | `categoriadescuento.categoriadescuento_estado` |
| **Acciones** | Derecha | Botón `Editar` para acceder a la ficha técnica | Botón `btn btn-success btn-xs` |

### 4.4 Campos del Formulario de Registro / Edición (`descuento.editar.view.html`)
| Etiqueta | Tipo de Control | Obligatorio | Opciones / Valores | Variable Angular |
| :--- | :--- | :--- | :--- | :--- |
| **Descripción** | `input[text]` | **Sí** | Texto descriptivo | `vm.categoriadescuento.categoriadescuento_descripcion` |
| **Estado** | `select` | **Sí** | `1` (Activo), `0` (Inactivo) | `vm.categoriadescuento.categoriadescuento_estado` |
| **Monto máximo** | `input[number]` | No | Límite máximo en Soles (0 = sin límite) | `vm.categoriadescuento.categoriadescuento_montomaximo` |
| **Porcentaje descuento por defecto** | `input[number]` | No | 0% a 100% | `vm.categoriadescuento.categoriadescuento_porcentajedescuento` |
| **Agregar un porcentaje deducible** | `checkbox` | No | Habilita campo deducible | `vm.filtroporcentajededucible` |
| **Porcentaje deducible** | `input[number]` | Condicional | Porcentaje contable deducible | `vm.categoriadescuento.categoriadescuento_porcentajededucible` |
| **Excluir descuentos en categorías** | Selector / Árbol | No | Lista de categorías de productos excluidas | `vm.categoriadescuento.categoriadescuento_filtroporcategoria` |
| **Incluir descuentos en locales** | Checkboxes por local | No | Lista de locales activos de la empresa | `vm.categoriadescuento.categoriadescuento_excluyelocales` |
| **Incluir clientes** | Buscador / Lista | No | Asocia clientes específicos autorizados | `vm.categoriadescuento.categoriadescuento_incluyeclientes` |
| **No afecta a promociones u ofertas** | `checkbox` | No | Si está activo, los ítems en oferta se ignoran al calcular el descuento | `vm.categoriadescuento.categoriadescuento_noafectaoferta` |
| **¿Se usa para canjes?** | `checkbox` | No | Indica si el descuento representa canje comercial | `vm.categoriadescuento.categoriadescuento_seusaparancajes` |

### 4.5 Filtros Disponibles
- Input de búsqueda rápida por descripción (`vm.valBusqueda`).
- Búsqueda en árbol de categorías a excluir (`vm.valBusquedaCategoria`).
- Búsqueda en lista de locales (`vm.valBusquedaLocal`).

### 4.6 Botones y Acciones Visibles
- `Registrar descuento` (`btn btn-primary btn-block` y `btn btn-link`)
- `Editar` (`btn btn-success btn-xs` por fila)
- `Guardar` (`btn btn-primary`)
- `Cancelar` (`btn btn-default`)

### 4.7 Estados y Reglas Visibles
- Al superar el `categoriadescuento_montomaximo` en caja, el POS bloquea la aplicación directa y exige PIN supervisor.
- Si `categoriadescuento_noafectaoferta == "1"`, la base imponible sobre la cual se calcula el porcentaje de descuento excluye los productos con ofertas activas.

### 4.8 Relaciones con Otros Módulos
- **Caja / Cobranza**: El cajero selecciona la categoría de descuento al procesar la comanda (`caja_modals_categoriadescuento.view.html`).
- **Ventas (Salones / Pedidos)**: Los mozos o supervisores aplican descuento por mesa (`descuentomesa.view.html`) vinculándolo a esta tabla.
- **Informes de Ventas**: Reporte específico de auditoría de descuentos (`reportedescuentos/descuento.html`).

### 4.9 Entidades de Datos
- `CategoriaDescuento`: `categoriadescuento_id`, `categoriadescuento_descripcion`, `categoriadescuento_montomaximo`, `categoriadescuento_porcentajedescuento`, `categoriadescuento_porcentajededucible`, `categoriadescuento_noafectaoferta`, `categoriadescuento_seusaparancajes`, `categoriadescuento_estado`.
- `CategoriaDescuentoLocal`: `categoriadescuentolocal_id`, `categoriadescuento_id`, `local_id`.
- `CategoriaDescuentoProducto`: `categoriadescuentoproducto_id`, `categoriadescuento_id`, `categoria_id`, `producto_id`.

### 4.10 Permisos Asociados
- Requiere ACL: `"descuentos"`.

### 4.11 Endpoints GET
- `GET /restaurant/api/rest/categoriadescuento/getAll/:idEstado/:pagina/:registros`
  - *Respuesta*: `{ tipo: "SUCCESS", data: [ { categoriadescuento_id: 1, categoriadescuento_descripcion: "CORTESÍA", categoriadescuento_estado: "1", categoriadescuento_porcentajedescuento: 100 } ], total: 2 }`
- `GET /restaurant/api/rest/categoriadescuento/obtenerCategoriadescuentoPorId/:id`
  - *Respuesta*: `{ tipo: "SUCCESS", data: { categoriadescuento_id: 1, listaCategorias: [...], listaLocales: [...] } }`

---

## 5. Pantalla 3: Cupones de Descuento (`#!/ajustes/cupondescuento`)

### 5.1 Propósito
Gestión centralizada de cupones de descuento promocionales alfanuméricos. Permite crear cupones unitarios o series masivas por lotes correlativos, definir si otorgan un descuento porcentual o monto fijo en soles, controlar el saldo restante consumible en múltiples visitas (tipo monedero) y limitar su uso a una única vez por cliente.

### 5.2 Flujo de Uso Paso a Paso
1. **Monitoreo de Cupones**: En la tabla principal de `#!/ajustes/cupondescuento`, el usuario visualiza los cupones activos, su saldo nominal, saldo disponible, monto ya usado y fecha de caducidad.
2. **Crear Cupón Individual o por Lote**: Pulsa `Nuevo cupón`.
   - Selecciona si es registro individual o activa `Registrar por lote`.
   - Si es individual, digita el código del cupón (ej. `VERANO2026`).
   - Si es por lote, especifica una sigla prefijo (ej. `CAP-`) y el rango correlativo (número inicial `1` al número final `500`).
3. **Definir Condiciones de Descuento**:
   - Escoge si el descuento es por **Monto fijo** (S/) o **Porcentaje** (%).
   - Si es porcentaje, define el porcentaje y el **Monto máximo** tope de rebaja.
   - Establece la **Fecha de expiración**.
   - Si aplica, activa la casilla `Por uso de cliente` (un solo uso por DNI/cliente).
   - Opcionalmente vincula el cupón a un producto específico de la carta (`¿Contiene un producto?`).
4. **Importación Masiva**: Si los cupones provienen de una campaña externa o convenio, pulsa `Importar Cupones` (`importar.html`), descarga la plantilla Excel y carga los códigos masivamente.

### 5.3 Columnas de la Tabla Principal (`cupondescuento/index.html`)
| Columna | Alineación | Significado / Contenido | Variable Angular |
| :--- | :--- | :--- | :--- |
| **Fecha expiración** | Centro | Fecha límite de validez (formato DD/MM/AAAA) | `cupondescuento.cupondescuento_fechaexpiracion` |
| **Categoría / Código** | Izquierda | Código único del cupón y categoría asociada | `cupondescuento.cupondescuento_codigo` |
| **Monto** | Derecha | Valor nominal total asignado al cupón | `cupondescuento.cupondescuento_monto` |
| **Monto disponible** | Derecha | Saldo aún no consumido por el cliente | `cupondescuento.cupondescuento_montodisponible` |
| **Monto usado** | Derecha | Total acumulado canjeado en ventas | `cupondescuento.cupondescuento_montousado` |
| **Estado** | Centro | `Activo` o `Expirado` / `Agotado` | `cupondescuento.cupondescuento_estado` |
| **Acciones** | Derecha | Botón `Editar` para ver detalles o ajustar vigencia | Botón `btn btn-success btn-xs` |

### 5.4 Campos del Formulario de Creación / Edición (`cupondescuento/editar.html`)
| Etiqueta | Tipo de Control | Obligatorio | Opciones / Valores | Variable Angular |
| :--- | :--- | :--- | :--- | :--- |
| **Registrar por lote** | `checkbox` | No | Activa generación de series numéricas | `vm.registrarPorRango` |
| **Categoría** | `ui-select` | **Sí** | Categorías de cupón creadas | `vm.cupondescuento.categoriacupodescuento` |
| **Código** | `input[text]` | Condicional | Requerido si no es por lote | `vm.cupondescuento.cupondescuento_codigo` |
| **Sigla del lote** | `input[text]` | Condicional | Requerido si es por lote (ej. "PROM") | `vm.cupondescuento.cupondescuento_sigla` |
| **Número inicial del lote** | `input[number]` | Condicional | Inicio correlativo (ej. 1) | `vm.cupondescuento.cupondescuento_numeroinicioserie` |
| **Número final del lote** | `input[number]` | Condicional | Fin correlativo (ej. 100) | `vm.cupondescuento.cupondescuento_numerofinserie` |
| **Fecha de expiración** | `datepicker` | **Sí** | Fecha futura de caducidad | `vm.cupondescuento.cupondescuento_fechaexpiracion` |
| **Es por porcentaje** | `select` / `radio` | **Sí** | `0` = Monto fijo, `1` = Porcentaje | `vm.cupondescuento.cupondescuento_esporporcentaje` |
| **Monto / Porcentaje** | `input[number]` | **Sí** | Valor numérico del beneficio | `vm.cupondescuento.cupondescuento_monto` |
| **Monto máximo** | `input[number]` | Condicional | Tope si es porcentaje | `vm.cupondescuento.cupondescuento_montomaximodescuentoporporcentaje` |
| **Monto disponible** | `input[number]` | Solo edición | Saldo remanente | `vm.cupondescuento.cupondescuento_montodisponible` |
| **Monto usado** | `input[number]` | Solo edición | Saldo consumido histórico | `vm.cupondescuento.cupondescuento_montousado` |
| **Por uso de cliente** | `checkbox` | No | Limita a 1 uso por cliente | `vm.cupondescuento.cupondescuento_unusoporcliente` |
| **¿Contiene un producto?** | `checkbox` | No | Si aplica solo a platos específicos | `vm.cupondescuento.cupondescuento_esporproducto` |
| **Estado** | `select` | **Sí** | `1` (Activo), `0` (Inactivo) | `vm.cupondescuento.cupondescuento_estado` |

### 5.5 Filtros Disponibles
- Selector de Categoría de Cupón (`vm.categoriacupodescuento`).
- Input de búsqueda por código o serie (`vm.valBusqueda`).
- Selector de cantidad de registros por página (`vm.paginacionSeleccionada`: 10, 20, 50).

### 5.6 Botones y Acciones Visibles
- `Nuevo cupón` (`btn btn-primary btn-block`)
- `Importar Cupones` (`btn btn-primary btn-block`)
- `Editar` (`btn btn-success btn-xs` por fila)
- `Descargar formato de importación` (en vista de importación)
- `Guardar` (`btn btn-primary`)
- `Cancelar` (`btn btn-default`)

### 5.7 Estados y Reglas Visibles
- Validación de sigla: el sistema verifica por endpoint que la sigla del lote no colisione con una existente (`validarSiglaCupon`).
- Control de saldo en caja: si el consumo es menor al monto del cupón y este admite saldo, el sistema actualiza `cupondescuento_montousado` y conserva `cupondescuento_montodisponible` para una venta posterior.
- Si `cupondescuento_unusoporcliente == "1"`, el POS exige registrar el documento del cliente y rechaza el cupón si dicho documento ya lo redimió.

### 5.8 Relaciones con Otros Módulos
- **Caja / Cobranza**: Modal de ingreso de cupón (`caja_modals_ingresocupondescuento.view.html`) donde el cajero tipea o escanea el código.
- **Clientes / Fidelización**: Cruce de documento de identidad para validar la política de un solo uso.
- **Integraciones externas**: Mapeo con plataformas como Yape Cupones (`lista-descuentos-yape.view.html`).

### 5.9 Entidades de Datos
- `CuponDescuento`: `cupondescuento_id`, `categoriacupodescuento_id`, `cupondescuento_codigo`, `cupondescuento_monto`, `cupondescuento_montodisponible`, `cupondescuento_montousado`, `cupondescuento_fechaexpiracion`, `cupondescuento_esporporcentaje`, `cupondescuento_montomaximodescuentoporporcentaje`, `cupondescuento_unusoporcliente`, `cupondescuento_esporproducto`, `cupondescuento_estado`.
- `CategoriaCuponDescuento`: `categoriacupodescuento_id`, `categoriacupodescuento_descripcion`, `categoriacupodescuento_montopordefecto`, `categoriacupodescuento_fechaexpiracionpordefecto`, `categoriacupodescuento_estado`.

### 5.10 Permisos Asociados
- Requiere ACL: `"ajustes"`.

### 5.11 Endpoints GET
- `GET /restaurant/api/rest/cupondescuento/listarPorPaginacion/:idCategoria/:idEstado/:pagina/:registros/:busqueda`
  - *Respuesta*: `{ tipo: "SUCCESS", data: [ { cupondescuento_id, cupondescuento_codigo, cupondescuento_monto, cupondescuento_montodisponible, cupondescuento_montousado, cupondescuento_fechaexpiracion, cupondescuento_estado } ], total: 6 }`
- `GET /restaurant/api/rest/categoriacupodescuento/getAllActivos`
  - *Respuesta*: `{ tipo: "SUCCESS", data: [ { categoriacupodescuento_id: 1, categoriacupodescuento_descripcion: "PROMOCION WEB" } ] }`

---

## 6. Pantalla 4: Promociones y Sorteos (`#!/promocionsorteo`)

### 6.1 Propósito
Configuración de promociones orientadas a la emisión de tickets para sorteos en el punto de venta. Cuando un comensal realiza un pedido que cumple ciertas condiciones (consumo mínimo en soles o compra de platos participantes), la impresora de comandas/caja emite automáticamente uno o varios cupones de sorteo con campos en blanco (Nombre, DNI, Teléfono) para que el cliente participe en ánforas físicas o campañas de marketing.

### 6.2 Flujo de Uso Paso a Paso
1. **Acceso y Exploración**: El usuario ingresa a `#!/promocionsorteo` para ver el estado de las campañas activas o navega a `#!/promocionsorteo/listar`.
2. **Crear Nueva Promoción / Sorteo**: Pulsa `Nueva promoción/sorteo` (`promocionsorteo.nuevo.html`).
3. **Paso 1 - Datos Generales de la Campaña**:
   - Ingresa el nombre del sorteo (ej. *Gran Sorteo Aniversario Caprichos*).
   - Establece la vigencia con fecha de inicio y fecha de fin.
4. **Paso 2 - Selección de Mecánica de Oferta**:
   - *Modalidad 1: Por rango de consumos*: Define un `Monto mínimo` de compra y la regla `Por cada X soles imprime un cupón` (ej. por cada S/ 40.00 se emite 1 ticket de sorteo).
   - *Modalidad 2: Por cantidad de productos vendidos*: Selecciona los productos de la carta que otorgan cupón al ser pedidos.
5. **Paso 3 - Configuración del Ticket Físico**:
   - Define el tope de tickets por comanda (`Cantidad máxima de impresiones`).
   - Marca las casillas de los datos que debe llenar el comensal: Nombre, DNI, Teléfono, Correo, etc.
   - Redacta el texto legal o mensaje impreso al pie del ticket (ej. *Deposita este cupón en el ánfora de caja antes del 31 de octubre*).
6. **Guardado y Notificación**: El sistema consulta confirmación y activa el trigger de impresión en caja.

### 6.3 Columnas de la Tabla de Sorteos (`promocionsorteo.listar.html`)
| Columna | Alineación | Significado / Contenido | Variable Angular |
| :--- | :--- | :--- | :--- |
| **Nombre Promoción / Sorteo** | Izquierda | Nombre descriptivo de la campaña | `promocionsorteo.promocionsorteo_descripcion` |
| **Tipo de Oferta** | Centro | `Por rango de consumos` o `Por productos vendidos` | `promocionsorteo.promocionsorteotipo_descripcion` |
| **Vigencia** | Centro | Rango de fechas (Desde - Hasta) | `promocionsorteo_fechainicio` - `promocionsorteo_fechafin` |
| **Monto Mínimo / Regla** | Derecha | Umbral monetario o regla de emisión | `promocionsorteo.promocionsorteo_montominimo` |
| **Tope Impresión** | Centro | Máximo de cupones por comanda | `promocionsorteo.promocionsorteo_cantidadimpresion` |
| **Estado** | Centro | Activo / Finalizado | `promocionsorteo.promocionsorteo_estado` |
| **Acciones** | Derecha | Botones de Ver Detalle, Editar o Anular | Botones de acción |

### 6.4 Campos del Formulario de Creación (`promocionsorteo.nuevo.html`)
| Etiqueta | Tipo de Control | Obligatorio | Opciones / Valores | Variable Angular |
| :--- | :--- | :--- | :--- | :--- |
| **Nombre de tu promoción/sorteo** | `input[text]` | **Sí** | Texto libre descriptivo | `vm.promocionsorteo.promocionsorteo_descripcion` |
| **Tipo de oferta** | `select` | **Sí** | `1` = Por cantidad productos vendidos, `2` = Por rango de consumos | `vm.promocionsorteotipo` |
| **Desde** | `datepicker` | **Sí** | Fecha de inicio | `vm.promocionsorteo.promocionsorteo_fechainicio` |
| **Hasta** | `datepicker` | **Sí** | Fecha final de vigencia | `vm.promocionsorteo.promocionsorteo_fechafin` |
| **Monto mínimo** | `input[number]` | Condicional | Requerido en tipo por consumo | `vm.promocionsorteo.promocionsorteo_montominimo` |
| **Por cada (imprime un cupón)** | `input[number]` | Condicional | Monto escalonado (ej. 30.00) | `vm.promocionsorteo.promocionsorteo_montoporcupon` |
| **Cantidad máxima de impresiones** | `input[number]` | **Sí** | Límite máximo de tickets por comanda (ej. 5) | `vm.promocionsorteo.promocionsorteo_cantidadimpresion` |
| **Campos a ingresar por el cliente** | `checkboxes` | No | Nombre, Teléfono, DNI, Email, Dirección | `vm.campoClienteSeleccionadoList` |
| **Mensaje de impresión** | `textarea` | No | Texto impreso en ticket térmico | `vm.promocionsorteo.promocionsorteo_textoimpresion` |
| **Productos participantes** | `ui-select` / Lista | Condicional | Requerido en tipo por producto | `vm.productoSeleccionadoList` |

### 6.5 Filtros Disponibles
- Input de búsqueda por nombre de campaña (`vm.valBusqueda`).
- Paginación dinámica (10, 20, 50 registros).

### 6.6 Botones y Acciones Visibles
- `Nueva promoción/sorteo` (`btn btn-primary`)
- `Paso Siguiente` / `Atrás` (navegación del wizard)
- `Guardar Promoción` (`btn btn-primary`)
- `Cancelar` (`btn btn-default`)

### 6.7 Estados y Reglas Visibles
- Validación de fechas: `promocionsorteo_fechafin` no puede ser anterior a `promocionsorteo_fechainicio`.
- En caja, el driver de impresión térmica evalúa el total facturado y emite tantos cupones como múltiplos de `promocionsorteo_montoporcupon` contenga, sin exceder `promocionsorteo_cantidadimpresion`.

### 6.8 Relaciones con Otros Módulos
- **Caja / Impresión de Comandas**: La ticketera de recibos ejecuta la orden de corte e impresión de los boletos adicionales.
- **Planes de Mensajería / CRM**: Permite vincular la promoción con campañas masivas de SMS o correos electrónicos dirigidas a los clientes de la base de datos (`PlanMensajeriaDetalleCtrl`).

### 6.9 Entidades de Datos
- `PromocionSorteo`: `promocionsorteo_id`, `local_id`, `promocionsorteotipo_id`, `promocionsorteo_descripcion`, `promocionsorteo_fechainicio`, `promocionsorteo_fechafin`, `promocionsorteo_montominimo`, `promocionsorteo_montoporcupon`, `promocionsorteo_cantidadimpresion`, `promocionsorteo_textoimpresion`, `promocionsorteo_estado`.
- `PromocionSorteoProducto`: `promocionsorteoproducto_id`, `promocionsorteo_id`, `producto_id`, `promocionsorteoproducto_cantidadimpresion`.

### 6.10 Permisos Asociados
- Requiere ACL: `"clientes"`.

### 6.11 Endpoints GET
- `GET /restaurant/api/rest/promocionsorteo/getAllByLocalId/:localId/:pagina/:registros/:idTipo`
  - *Respuesta*: `{ tipo: "SUCCESS", data: [ { promocionsorteo_id, promocionsorteo_descripcion, ... } ], total: 0 }`
- `GET /restaurant/api/rest/promocionsorteo/obtener/:id`
  - *Respuesta*: `{ tipo: "SUCCESS", data: { promocionsorteo_id, promocionsorteo_textoimpresion, campos: [...] } }`

---

## 7. Pantalla 5: Vales de Pago (`#!/ajustes/valedepago`)

### 7.1 Propósito
Administrar vales de pago, certificados de consumo o Gift Cards. Cumple una función dual: por un lado, se configura como un **Medio de Pago** en el POS (en la pantalla de cobro se puede cancelar una venta mediante "Vale de Pago"), y por otro, permite registrar códigos de vales físicos/electrónicos con monto prepagado, control de caducidad, saldo reutilizable y restricción opcional a platos específicos de la carta.

### 7.2 Flujo de Uso Paso a Paso
1. **Configuración de la Forma de Pago**: En `#!/ajustes/valedepago`, el usuario visualiza las formas de pago de tipo "Vale" registradas.
2. **Habilitación por Local o Global**:
   - Mediante el modal `modal-configurarporlocal`, activa si el vale opera en el local actual o a nivel global de la empresa.
3. **Gestión de Códigos de Vales**:
   - Accede a `Editar vale de pago` (`#!/ajustes/valedepago/:idVale/editar`).
   - Define si `TODOS LOS PRODUCTOS SON CANJEABLES` o si el vale restringe su uso a una lista específica de platos (`valepagoproducto`).
   - Configura equivalencias de puntos de fidelización si el vale se canjea por puntos.
4. **Emisión de Códigos de Vales**:
   - Puede registrar un código único con su monto nominal y fecha de caducidad, o generar lotes masivos especificando sigla y numeración correlativa inicial y final.
   - Marca si el vale es `Reutilizable` (permite consumir el saldo en múltiples transacciones hasta agotarlo).
5. **Canje en Caja**: Al momento de cobrar una venta, el cajero selecciona el medio de pago "Vale de Pago", introduce el código del vale, valida el saldo disponible y aplica el importe.

### 7.3 Columnas de la Tabla Principal (`valedepago/index.html`)
| Columna | Alineación | Significado / Contenido | Variable Angular |
| :--- | :--- | :--- | :--- |
| **Nombre** | Izquierda | Nombre de la modalidad de vale (ej. *Vale de Consumo Caprichos*) | `formapago.formapago_descripcion` |
| **Tipo** | Centro | Tipo de medio de pago | `formapago.tipoformapago_descripcion` |
| **Categoría** | Centro | Categoría interna de la forma de pago | `formapago.categoriaformapago_descripcion` |
| **Local actual** | Centro | Indicador de disponibilidad en la sucursal activa | `formapago.activo_local` |
| **Global** | Centro | Indicador de disponibilidad transversal en toda la cadena | `formapago.activo_global` |
| **Configurar** | Derecha | Botones de configuración de locales y edición de vales | Botones de acción modal |

### 7.4 Campos del Formulario de Edición (`valedepago/editar.html`)
| Etiqueta | Tipo de Control | Obligatorio | Opciones / Valores | Variable Angular |
| :--- | :--- | :--- | :--- | :--- |
| **Nombre** | `input[text]` | **Sí** | Denominación del vale | `vm.formapago.formapago_descripcion` |
| **Activar** | `checkbox` | No | Activo / Inactivo | `vm.formapago.formapago_activo` |
| **Todos los productos son canjeables** | `checkbox` (switch) | No | Si está apagado, abre selector de productos | `vm.formapago.formapago_todosproductos` |
| **Equivalencia en soles** | `input[number]` | No | Valor en dinero para canje de puntos | `vm.formapago.formapago_equivalenciasoles` |
| **Equivalencia en puntos** | `input[number]` | No | Puntos necesarios para obtener el vale | `vm.formapago.formapago_equivalenciapuntos` |
| **Registrar por lote** | `checkbox` | No | Emisión masiva de series | `vm.valepagorestaurant.registrarPorRango` |
| **Código** | `input[text]` | Condicional | Código alfanumérico si es individual | `vm.valepagorestaurant.valepagorestaurant_codigo` |
| **Sigla del lote** | `input[text]` | Condicional | Prefijo de serie (ej. `GIFT-`) | `vm.valepagorestaurant.valepagorestaurant_sigla` |
| **Número inicial del lote** | `input[number]` | Condicional | Inicio numérico | `vm.valepagorestaurant.valepagorestaurant_numeroinicioserie` |
| **Número final del lote** | `input[number]` | Condicional | Fin numérico | `vm.valepagorestaurant.valepagorestaurant_numerofinserie` |
| **Monto** | `input[number]` | **Sí** | Importe en soles del vale | `vm.valepagorestaurant.valepagorestaurant_monto` |
| **Fecha de expiración / caducidad** | `datepicker` | **Sí** | Fecha límite de canje | `vm.valepagorestaurant.valepagorestaurant_fechacaducidad` |
| **Reutilizable** | `checkbox` | No | Permite saldos remanentes multiconsumo | `vm.valepagorestaurant.valepagorestaurant_reutilizable` |
| **Productos permitidos** | Tabla selectora | Condicional | Platos que pueden cobrarse con este vale | `productovale.valepagoproducto_estado` |

### 7.5 Filtros Disponibles
- Input de búsqueda por nombre de vale (`vm.valBusqueda`).
- Búsqueda en catálogo de productos para asignación de canje (`vm.valBusquedaProducto`).
- Paginación (10 registros por defecto).

### 7.6 Botones y Acciones Visibles
- `Configurar locales` (abre modal de sucursales)
- `Editar vales` (navega a la ficha de códigos y restricciones)
- `Guardar` (`btn btn-primary`)
- `Deshabilitar vale` (`btn btn-danger btn-xs` por fila)
- `Cancelar` (`btn btn-default`)

### 7.7 Estados y Reglas Visibles
- Si `valepagorestaurant_reutilizable == "1"`, el cajero puede cobrar solo una fracción de la orden y el vale conserva su saldo para visitas posteriores. Si no es reutilizable, cualquier saldo no consumido se pierde o no se permite cambio en efectivo.
- Validación de caducidad en el cobro: el POS rechaza el vale si la fecha del sistema supera `valepagorestaurant_fechacaducidad`.

### 7.8 Relaciones con Otros Módulos
- **Caja / Cobranza (`ingresovalepago.view.html`)**: Actúa como medio de pago con campos `codigoVale`, `montoVale` y `referenciaVale`.
- **Fidelización / Plaza Puntos**: Sincroniza el canje de puntos acumulados por consumo para la generación de vales.
- **Productos**: Matriz de productos canjeables (`valepago_producto`).

### 7.9 Entidades de Datos
- `FormaPago`: `formapago_id`, `formapago_descripcion`, `tipoformapago_id`, `formapago_activo`, `formapago_todosproductos`, `formapago_equivalenciasoles`, `formapago_equivalenciapuntos`.
- `ValePagoRestaurant`: `valepagorestaurant_id`, `formapago_id`, `valepagorestaurant_codigo`, `valepagorestaurant_monto`, `valepagorestaurant_fechacaducidad`, `valepagorestaurant_reutilizable`, `valepagorestaurant_estado`.
- `ValePagoProducto`: `valepagoproducto_id`, `valepagorestaurant_id`, `producto_id`, `valepagoproducto_estado`.

### 7.10 Permisos Asociados
- Requiere ACL: `"descuentos"`.

### 7.11 Endpoints GET
- `GET /restaurant/api/rest/valepagorestaurant/obtenerValesRestaurantByFormaPagoID/:formaPagoId`
  - *Respuesta*: `{ tipo: "SUCCESS", data: [ { valepagorestaurant_id, valepagorestaurant_codigo, valepagorestaurant_monto, valepagorestaurant_fechacaducidad, valepagorestaurant_reutilizable } ] }`
- `GET /restaurant/api/rest/valepagoproducto/listarPorPaginacion/:pagina/:registros`
  - *Respuesta*: `{ tipo: "SUCCESS", data: [ { valepagoproducto_id, producto_id, valepagoproducto_estado } ], total: 0 }`

---

## 8. Funcionalidades Imprescindibles para Replicar

Para que el nuevo sistema reemplace satisfactoriamente al actual sin generar disrupciones comerciales en CAPRICHOS, se deben implementar prioritariamente:

1. **Motor de Ofertas por Canal y Sucursal**:
   - Soportar las 4 mecánicas: combos cerrados (2 en 1), compra-lleva (2x1), precios bajos escalonados por volumen y precios especiales por ambiente de salón.
   - Reglas estrictas de vigencia por horario comercial (ej. "Happy Hour" de café de 4 PM a 7 PM de lunes a jueves).
   - Control estricto de disponibilidad según canal (Salón, Venta Rápida o Delivery).
2. **Políticas de Descuentos con Auditoría y No Acumulación**:
   - Motivos tipificados con tope de monto en soles y porcentaje deducible para control tributario.
   - Regla anti-acumulación que excluya automáticamente productos que ya gocen de oferta comercial activa.
   - Registro del usuario que autorizó el descuento (trazabilidad y firma de supervisor).
3. **Cupones de Descuento con Gestión de Saldo**:
   - Soporte tanto para cupón de importe total como cupón fraccionable (saldo monedero).
   - Regla de un solo canje por documento de cliente (evita duplicidad fraudulenta).
   - Generador correlativo masivo por rangos e importador Excel.
4. **Vales de Consumo Integrados al Motor de Pagos**:
   - Tratamiento de vales como medios de pago de caja con validación de código en tiempo real.
   - Posibilidad de restringir vales a productos específicos (ej. "Vale válido solo para tortas y cafés").
5. **Disparadores de Sorteo en Ticketera**:
   - Cálculo automático de cupones impresos en el recibo de comanda según consumo o productos clave, con campos en blanco para participación en ánforas físicas.

---

## 9. Oportunidades de Mejora y Modernización

1. **Unificación Conceptual y de Interfaz**:
   - En el sistema actual, *Ofertas*, *Descuentos*, *Cupones*, *Sorteos* y *Vales* se encuentran dispersos en tres secciones distintas del menú lateral (`Ofertas`, `Descuentos` y `Ajustes`). En el nuevo sistema deben consolidarse bajo un único módulo armónico: **Promociones y Fidelización**.
2. **Validación Online Centralizada de Cupones y Vales**:
   - El sistema actual almacena códigos con validación básica. Se recomienda implementar validación criptográfica o tokens QR escaneables desde el teléfono del cliente mediante la cámara del POS o escáner 2D, evitando la digitación manual de códigos en horas punta.
3. **Ofertas Inteligentes y Combinatorias (Mix & Match)**:
   - En el 2x1 y 2 en 1 actual, las equivalencias son rígidas. Se recomienda un motor de reglas "Lleva 2 productos de la categoría Pastelería y paga el de mayor valor", común en cafeterías modernas.
4. **Sorteos 100% Digitales sin Papel Térmico**:
   - En lugar de gastar papel térmico y exigir llenado manual a lapicero en el ticket, generar un código QR único en el comprobante que dirija a un formulario web donde el cliente registra sus datos para el sorteo, ahorrando papel y capturando leads limpios y sin errores de caligrafía.
5. **Dashboard Analítico de Retorno de Inversión (ROI)**:
   - Incluir métricas en tiempo real de cuánto vendió cada oferta, cuál fue el margen real tras el descuento y qué cupones tuvieron mayor tasa de redención.

---

## 10. Dudas para el Cliente (CAPRICHOS)

1. **Uso Real de Mecánicas de Oferta**:
   - ¿Qué modalidades de oferta se emplean con mayor frecuencia en Caprichos: 2x1, combos 2 en 1, precios especiales por salón o precios rebajados?
2. **Políticas de Descuentos de Personal y Cortesías**:
   - ¿Cuál es el límite máximo permitido para que un cajero o mozo aplique un descuento antes de exigir autorización o PIN del administrador/supervisor?
3. **Cupones y Alianzas Comerciales**:
   - ¿Manejan actualmente convenios con empresas o cupones digitales (ej. Yape Promos, Cuponatic) que requieran importación masiva o integración vía API externa?
4. **Mecánica de Sorteos**:
   - ¿Se siguen realizando sorteos físicos con cupones impresos y ánforas en caja, o prefieren una solución digital mediante registro web vía QR en la boleta?
5. **Gift Cards y Vales de Consumo**:
   - ¿Venden tarjetas de regalo ("Gift Cards") recargables o emiten vales corporativos a clientes empresariales? ¿Requieren que el saldo restante quede guardado para futuras visitas?

---

## 11. Registro de Elementos No Observados

- **Modal de confirmación de canje de puntos con Plaza Puntos**: No fue posible observar la ventana emergente de sincronización en vivo debido a que requiere ejecutar una transacción de cobro real (estrictamente prohibido por reglas de solo lectura).
- **Proceso de impresión física de boletos de sorteo**: No fue posible verificar la maqueta de corte térmico en físico al no disponer de una ticketera conectada en el entorno de inspección remota.

# Documentación Técnica y de Negocio: Módulo de Delivery

**Sistema**: Restaurant.pe (Instancia en Producción: CAPRICHOS - Lima, Perú)  
**Entorno**: Producción en uso real (`https://caprichos.restaurant.pe/`)  
**Fecha de Auditoría**: 2026-10-13  
**Auditor**: `krosales` (Modo Solo Lectura Estricto)  
**Objetivo del Proyecto**: Replicar y modernizar el ecosistema de delivery (Carta digital propia, Pedidos QR, Call Center telefónico, Zonas poligonales de reparto, Flota de motorizados, Auditoría de reclamos e Inteligencia de cobertura).

---

## Índice del Módulo
1. [Arquitectura General del Canal Delivery](#1-arquitectura-general-del-canal-delivery)
2. [Menú Online (Carta Digital Propia)](#2-menú-online-carta-digital-propia)
3. [Pedidos QR (Autopedido en Mesa y Recojo Rápido)](#3-pedidos-qr-autopedido-en-mesa-y-recojo-rápido)
4. [Call Center (Recepción Telefónica y Gestión de Envíos)](#4-call-center-recepción-telefónica-y-gestión-de-envíos)
5. [Zona de Reparto (Georreferenciación y Polígonos de Cobertura)](#5-zona-de-reparto-georreferenciación-y-polígonos-de-cobertura)
6. [Ajustes de Delivery (Flota, Movilidad, Canales y Motivos)](#6-ajustes-de-delivery-flota-movilidad-canales-y-motivos)
7. [Resumen de Delivery (Panel de Control y KPIs Operativos)](#7-resumen-de-delivery-panel-de-control-y-kpis-operativos)
8. [Informe de Cobertura (Zonas de Reparto)](#8-informe-de-cobertura-zonas-de-reparto)
9. [Mapa de Calor (Densidad Cartográfica de Despachos)](#9-mapa-de-calor-densidad-cartográfica-de-despachos)
10. [Reclamos de Delivery](#10-reclamos-de-delivery)
11. [Informe de Frecuencia de Clientes](#11-informe-de-frecuencia-de-clientes)
12. [Tu Restaurant en Facebook (Canal Social)](#12-tu-restaurant-en-facebook-canal-social)
13. [Funcionalidades Imprescindibles para Replicar](#13-funcionalidades-imprescindibles-para-replicar)
14. [Mejoras Sugeridas para el Nuevo Sistema](#14-mejoras-sugeridas-para-el-nuevo-sistema)
15. [Dudas para el Cliente (CAPRICHOS)](#15-dudas-para-el-cliente-caprichos)
16. [Registro de Elementos No Observados](#16-registro-de-elementos-no-observados)

---

## 1. Arquitectura General del Canal Delivery

El subsistema de Delivery de CAPRICHOS opera como un ecosistema híbrido compuesto por:
1. **Frontend Público (Carta Digital / Pedidos QR)**: Aplicación SPA moderna desarrollada en **Angular 15+** e **Ionic Framework**, sincronizada en tiempo real mediante **Firebase Realtime Database** para disponibilidad de carta y stock.
2. **Backoffice Administrativo (Call Center y Ajustes)**: Aplicación SPA en **AngularJS 1.6.10** sobre Bootstrap 3, respaldada por un backend en **PHP 7.1.33** y base de datos con balanceo Nginx/Redis.
3. **Motores Geoespaciales**: Integración mixta entre Google Maps JavaScript API (geocodificación/places) y MapLibre GL / MapTiler (delimitación vectorial de polígonos de reparto).
4. **Pasarelas de Pago Multi-canal**: Sockets y SDKs integrados para Efectivo contra entrega, Terminales POS físicos, Culqi, Mercado Pago, Izipay (Krypton Client), Wava y billeteras digitales (Yape / Plin mediante transferencia verificada).

---

## 2. Menú Online (Carta Digital Propia)

- **URL Pública**: `https://caprichos.restaurant.pe/carta-digital/#/inicio`
- **Ruta de Tienda y Catálogo**: `https://caprichos.restaurant.pe/carta-digital/#/tienda/1`
- **Ruta de Checkout**: `https://caprichos.restaurant.pe/carta-digital/#/tienda/1/finalizarcompra`
- **Ruta de Seguimiento**: `https://caprichos.restaurant.pe/carta-digital/#/tracking/:delivery_id`

### Propósito
Permitir que los clientes de la cafetería exploren la carta gastronómica en tiempo real desde sus navegadores o smartphones, armen un carrito de compras con opciones y complementos personalizados, seleccionen entre modalidad de recojo en local o despacho a domicilio con cálculo de tarifa geográfica, y completen el pago sin intermediarios de comisiones altas (como PedidosYa o Rappi).

### Flujo de Uso Paso a Paso
1. **Ingreso y Selección de Modalidad**:
   - El cliente ingresa a `carta-digital/#/inicio`.
   - Se despliega la ventana modal de bienvenida (`app-select-modalidad-modal`):
     - Opción A: **Recojo en tienda**
     - Opción B: **Delivery** (Entrega a domicilio)
2. **Flujo Recojo en Tienda**:
   - Se abre el selector de sucursal (`app-recojo-tienda-modal`): el cliente selecciona la tarjeta de la sede (`CAPRICHOS - Calle 11, Mz D LT 27 Urb. Los girasoles de Campoy, SJL, Lima`).
   - Se habilitan dos carruseles dinámicos de selección:
     - **Selecciona el día**: Lunes a Domingo con fecha y mes.
     - **Selecciona un horario de atención**: Rango operativo (`De 14:00 pm a 22:00 pm`), horas discretas (de `2 pm` a `10 pm`) y franja de minutos en intervalos de 15 minutos (`:00`, `:15`, `:30`, `:45`).
   - Validación activa: Si pulsa "Aceptar" sin seleccionar día o franja horaria, el sistema bloquea el paso y muestra los avisos *"Te falta escoger la fecha de tu pedido"* o *"Te falta escoger la hora de tu pedido"*.
3. **Flujo Delivery a Domicilio**:
   - El cliente presiona "Delivery" e ingresa su dirección en el buscador conectado al endpoint de geolocalización o ubica el pin en el mapa.
   - El algoritmo cliente (`point-in-polygon`) valida si las coordenadas caen dentro de alguna de las zonas de cobertura activas (Z1 a Z5). Si está fuera, emite un aviso de falta de cobertura.
4. **Navegación del Catálogo (`app-tienda`)**:
   - Encabezado con información del local: Nombre (`CAFETERIA ARTESANAL CAPRICHOS`), Dirección, Teléfono (`977503006`), banner de estado abierto/cerrado y botón de carrito con insignia de cantidad.
   - Barra de Categorías (`ion-segment`): `COMBOS`, `FRIO`, `POSTRES`, `CALIENTES`, `SALADO`.
   - Listado de tarjetas de productos: Imagen, título, descripción breve, precio en Soles (`S/`) y botón `AÑADIR`.
5. **Personalización del Producto (`app-product-detail`)**:
   - Al pulsar un ítem con modificadores (ej. `1/2 DOCENA DONUTS/GALLETAS` o `DUO COMPARTIR`), se despliega una modal emergente.
   - Reglas de complementos:
     - Título del grupo (ej. *"Elige tus complementos"*).
     - Tipo de selección: *"Selección múltiple"*, *"Máximo: 6"*.
     - Lista de complementos con selector de incremento/decremento (`+` / `-`): Manjar blanco, Chocolate negro, Oreo, Crema pastelera, Fresa, Choco chips, etc.
     - Campo de texto libre: *"Comentarios"* (ej. "sin azúcar", "bien caliente").
     - Botones de acción: `Agregar y seguir comprando` o `Agregar S/ [Monto]`.
6. **Carrito de Compras (`app-carrito`)**:
   - Despliegue de lista de productos seleccionados con cantidades modificables, subtotal, desglose de complementos y opción de eliminar ítems.
   - Botón de avance: `Continuar` o `Pedir`.
7. **Pantalla de Checkout (`app-finalizar-compra`)**:
   - **Dirección / Modalidad**: Muestra la sede de recojo o la dirección de entrega geocodificada.
   - **Tiempo de entrega**: Hora programada o entrega inmediata.
   - **Tus datos (`app-cliente`)**: Si faltan datos de contacto, se abre automáticamente el formulario modal con validaciones obligatorias:
     - Nombre completo (`*`)
     - Apellidos (`*`)
     - Teléfono celular (`*`)
     - Correo electrónico (`*`)
     - Documento de identidad (DNI/CE con filtro numérico `OnlyNumber`).
   - **¿Desea comprobante?**:
     - Checkbox interactivo. Si está desmarcado, emite Nota de Venta interna por defecto (`delivery_comprobante = "3"`).
     - Si se marca, permite alternar entre:
       - **Boleta**: Requiere DNI (mínimo 4 dígitos, obligatorio) y Nombre completo.
       - **Factura**: Requiere RUC (11 dígitos), Razón Social y Dirección fiscal.
   - **Mis métodos de Pago (`#mediosPago`)**:
     - **Efectivo**: Habilita el campo *"¿Con cuánto paga?"* (`id="concuantopaga"`) para cálculo del vuelto.
     - **Tarjeta contra entrega**: Muestra terminal POS físico del motorizado.
     - **Pago en línea / Pasarela**: Despliega componentes de Culqi, Izipay, Mercado Pago o Wava según la pasarela activa.
     - **Transferencia / Billeteras Digitales**: Muestra las cuentas bancarias, CCI y números de Yape/Plin registrados en `local_listacuentastransferencia`.
   - **Cupón de descuento (`app-ingresar-cupon`)**: Campo para canjear códigos promocionales con recálculo automático del total.
   - **Resumen Financiero**: Costo de productos, Costo de envío (`S/ 0.00` en recojo o tarifa poligonal en delivery), Descuentos y Total final (`S/`).
8. **Finalización del Pedido**:
   - Al presionar `Realizar pedido`, el frontend compila el payload JSON (`crearObjdelivery`), valida que el local esté abierto y que se cumpla el monto mínimo (`local_montominimo`), registra el pedido en el servidor y redirige al tracking en tiempo real (`#/tracking/:delivery_id`) o envía una confirmación estructurada vía WhatsApp.

### Estructura de Formularios y Campos (Checkout y Cliente)

| Formulario / Sección | Campo | Etiqueta Visible | Tipo de Control | Obligatorio | Validación / Opciones |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `app-cliente` | `nombre` | Nombre completo (*) | `input[type="text"]` | Sí | Texto alfabético |
| `app-cliente` | `apellido` | Apellidos (*) | `input[type="text"]` | Sí | Texto alfabético |
| `app-cliente` | `documento` | Documento / DNI | `input[type="text"]` | No | Directiva `OnlyNumber` (8 dígitos DNI) |
| `app-cliente` | `celular` | Celular (*) | `input[type="number"]` | Sí | 9 dígitos numéricos |
| `app-cliente` | `email` | Email (*) | `input[type="email"]` | Sí | Formato RFC email válido |
| `comprobante (Boleta)` | `dni` | DNI | `input[type="text"]` | Sí | Minlength 4, `OnlyNumber`, placeholder `Ejem. 46145816` |
| `comprobante (Boleta)` | `name` | Nombre completo | `input[type="text"]` | Sí | Placeholder `Ejem. Jean Pierre Santillán García` |
| `comprobante (Factura)`| `ruc` | RUC | `input[type="number"]`| Sí | 11 dígitos, placeholder `Ejem. 10461458161` |
| `comprobante (Factura)`| `razon-social` | Razón Social | `input[type="text"]` | Sí | Placeholder `Ejem. Restaurant Jp S.A.C.` |
| `comprobante (Factura)`| `direccion` | Dirección fiscal | `input[type="text"]` | Sí | Placeholder `Ejem. Urb. Los Tallanes Mz F Lt 11` |
| `metodopago` | `concuantopaga`| ¿Con cuánto paga? | `input[type="text"]` | Condicional (Efectivo) | Monto en Soles >= Total del pedido |
| `cupon` | `codigoCupon` | Código de cupón | `input[type="text"]` | No | Validación contra backend |

### Endpoints Identificados (Carta Digital)
- `GET /restaurant/facebook/rest/delivery/cargarLocalesMenuEnLinea?page_id=0`: Retorna metadata de sucursales, horarios, cuentas de transferencia, impuestos y configuraciones de pago.
- `POST /backendrestaurantpe/public/rest/common/credentialsFirebase`: Obtiene tokens y credenciales de conexión al cluster de Firebase.
- `POST https://mapas.restaurant.pe/get-geolocalizacion`: Proxy de autocompletado y geocodificación de direcciones.
- `POST /restaurant/facebook/rest/delivery/tokenFormIzipay`: Genera token de sesión para pasarela Izipay.
- `POST /restaurant/facebook/rest/delivery/tokenFormWAVA`: Genera token de sesión para pasarela Wava.
- `POST /restaurant/facebook/rest/delivery/tokenFormCARDNET`: Token de pasarela de tarjetas CardNet.

---

## 3. Pedidos QR (Autopedido en Mesa y Recojo Rápido)

- **URL Base**: `https://caprichos.restaurant.pe/carta-digital/#/inicio?pickupAtStore=1&storeId=null`
- **Ruta Operativa**: `https://caprichos.restaurant.pe/carta-digital/#/tienda/null?pickupAtStore=1&storeId=null` o `https://caprichos.restaurant.pe/carta-digital/#/menu`

### Propósito
Permitir a los comensales sentados en una mesa física del salón o a clientes presenciales en ventanilla escanear un código QR con su celular, consultar la carta digital, enviar comandas directamente a la pantalla de cocina (`KDS`) y solicitar la pre-cuenta sin esperar la asistencia presencial del mozo.

### Flujo de Uso Paso a Paso
1. **Escaneo del QR**: El código QR en la mesa codifica la URL con parámetros: `?pickupAtStore=1&storeId=1&mesa_id=[ID_MESA]`.
2. **Carga Contextual**: La aplicación omite la selección de modalidad (Delivery/Recojo) y vincula automáticamente la comanda a la mesa y sucursal indicadas.
3. **Selección de Platos**: El comensal agrega platos y bebidas a su lista de pedidos de mesa.
4. **Envío de Comanda**: Al presionar `Enviar a Cocina`, el frontend ejecuta el endpoint `delivery/agregarListaPedidosMesaQR/[local_id]`.
5. **Consulta de Cuenta y Cierre**: Los comensales pueden consultar en cualquier momento el acumulado de consumos de la mesa mediante `delivery/obtenerListaPedidosPorMesaQR` o pedir la liquidación mediante `delivery/generarPreCuentaQRPorMesa`.

### Endpoints Específicos de Pedidos QR
- `GET /restaurant/facebook/rest/delivery/cargarCartaQR`: Carga la estructura de carta optimizada para salón.
- `GET /restaurant/facebook/rest/delivery/obtenerMesaPorId/[id]`: Obtiene datos de la mesa física, salón y estado de ocupación.
- `GET /restaurant/facebook/rest/delivery/obtenerListaPedidosPorMesaQR/[mesa_id]`: Lista las órdenes activas en la mesa.
- `POST /restaurant/facebook/rest/delivery/agregarListaPedidosMesaQR/[local_id]`: Inserta pedidos directamente al flujo de comanda de cocina.
- `POST /restaurant/facebook/rest/delivery/generarPreCuentaQRPorMesa/[mesa_id]`: Bloquea la mesa y solicita ticket de pre-cuenta en caja.

---

## 4. Call Center (Recepción Telefónica y Gestión de Envíos)

- **Ruta Interna**: `#!/ventas/callcenter`
- **Controlador**: `CallCenterCtrl as vm`
- **Plantilla Base**: `scripts/restaurantpe/ventas-full/callcenter/index.html`

### Propósito
Centralizar la digitación de pedidos recibidos por teléfono, WhatsApp o canales externos, asociándolos rápidamente a clientes registrados o nuevos, y monitorear el ciclo de vida de los despachos en tiempo real mediante tarjetas de estado kanban.

### Interfaz y Componentes Visibles
1. **Buscador de Clientes Superior**:
   - Campo de entrada: *"Ingresa un nombre, DNI, RUC o teléfono para buscar..."* con autocompletado en vivo.
   - Acciones inmediatas:
     - Botón `Registra un nuevo cliente` (abre modal de alta rápida).
     - Botón `Asignar cliente luego` (inicia comanda con cliente genérico/público general).
2. **Pestañas de Estado Operativo**:
   - `Pedidos en curso ([N])`: Muestra las órdenes activas del día que requieren seguimiento o despacho.
   - `Pedidos cerrados ()`: Historial de pedidos completados o liquidados en la jornada.
3. **Filtros de Cabecera**:
   - Selector de Sucursal: `Sucursal: CAPRICHOS`.
   - Selector de Rango de Fechas: DateRangePicker (`Del 01 Octubre, 2026 hasta 13 Octubre, 2026`).
   - Campo de filtro de resultados: *"Palabras clave..."*.
   - Botón `fa fa-refresh`: Refresco manual de la grilla de pedidos.
4. **Tarjetas de Pedidos en Curso (`card-pedido.html`)**:
   - Cada pedido se representa en una tarjeta visual interactiva que contiene:
     - Nombre completo del cliente en encabezado resaltado.
     - Número de comanda correlativo (ej. `#4897`, `#C1-821`).
     - Insignia de estado operativo: `En camino`, `En cocina`, `Por confirmar`.
     - Insignia de modalidad y hora: `EN TIENDA (14 H)`, `EN TIENDA (15 H)`, `EN TIENDA (16 H)`.
     - Cantidad de productos (ej. `2 productos`).
     - Teléfono de contacto con enlace para llamada o WhatsApp directo.
     - Indicador de urgencia: `Entrega inmediata` / `Inmediata`.
     - Etiqueta del canal de entrada: `Canal: Menú online`, `Canal: Delivery Telefónico`.
     - Acciones sobre la tarjeta:
       - Botón `Anular`: Despliega modal de cancelación con selección obligatoria de motivo (`tipoproblemadelivery`).
       - Botón `Mensaje a [SUCURSAL]`: Envía instrucción o alerta operativa a la pantalla del local.

### Sub-Flujo: Toma de Nuevo Pedido (`/nuevo-pedido/:clienteId`)
1. **Ficha del Cliente**:
   - Muestra teléfonos, correos y lista de direcciones guardadas.
   - Botón `Agregar dirección` (`modal-agregardireccion.html`): Geocodificación con mapa interactivo, ingreso de calle, número, interior, referencia, complemento (condominio/departamento), distrito, provincia, región y código de Ubigeo.
2. **Carga de Platos y Comanda**:
   - Interfaz táctil idéntica al punto de venta con familias de productos, modificadores, términos de cocción y notas al plato.
3. **Revisión del Pedido (`/revisar/:idPedido`)**:
   - Selección de modalidad de despacho (Delivery con motorizado propio, Courier externo o Recojo en tienda).
   - Asignación de motorizado responsable de la flota activa.
   - Selección de comprobante (Boleta / Factura / Nota de venta).
   - Registro de medio de pago y monto con el que abona el cliente.
4. **Resumen y Envío (`/resumen/:deliveryId`)**:
   - Confirmación final y emisión de comanda para impresión remota en cocina y despacho.

### Endpoints Identificados (Call Center)
- `POST /restaurant/api/rest/callcenter/buscarClientePorTexto`: Búsqueda instantánea de clientes por nombre, teléfono o documento.
- `GET /restaurant/api/rest/callcenter/obtenerPedidosEnCursoPorLocal/[local_id]`: Recupera lista de pedidos activos.
- `GET /restaurant/api/rest/callcenter/obtenerPedidosCerradosPorLocal/[local_id]`: Recupera historial de pedidos atendidos.
- `POST /restaurant/api/rest/delivery/anularPedidoDelivery`: Cancelación controlada de la orden con motivo.

---

## 5. Zona de Reparto (Georreferenciación y Polígonos de Cobertura)

- **Ruta de Sucursales**: `#!/ajustes/zonareparto`
- **Ruta de Configuración por Local**: `#!/ajustes/zonareparto/sucursal/1`
- **Controlador**: `ZonaRepartoSucursalCtrl as vm`
- **Plantilla Base**: `scripts/restaurantpe/ajustes/callcenter/sucursal.html`

### Propósito
Definir los límites geográficos exactos donde la cafetería realiza despachos a domicilio, configurando tarifas diferenciadas por cercanía o dificultad de acceso mediante polígonos vectoriales sobre mapa interactivo.

### Interfaz y Componentes Visibles
1. **Pantalla Inicial (`Lista de sucursales`)**:
   - Tarjetas de locales con indicador de estado: `ACTIVO | CAPRICHOS`.
   - Buscador de dirección/referencia para pruebas de ubicación.
2. **Pantalla de Sucursal (`sucursal.html`)**:
   - **Visor Cartográfico**: Mapa interactivo basado en MapLibre GL y tiles de MapTiler / OpenStreetMap con herramientas de dibujo vectorial (Terradraw / polígonos).
   - **Encabezado**: `Sucursal: CAPRICHOS`, indicador *"Esta sucursal está habilitada para recibir pedidos"*, `Estado: Activo`.
   - **Botones de Control**:
     - `Regresar a todas las sucursales`
     - `Nueva zona de reparto`: Activa la herramienta de trazo en el mapa para delimitar un nuevo polígono.
     - `Opciones`: Abre la modal de configuración operativa del local (`modal-configuracionlocalcallcenter.html`).
     - `Descargar plantilla`: Descarga archivo base en Excel/CSV con estructura de coordenadas para importación masiva.
     - `Importar zonas de reparto`: Selector de archivo (`input[type="file"]`) para carga masiva de polígonos geoespaciales.
3. **Listado de Zonas Configuradas en CAPRICHOS**:
   - Cada zona muestra su estado, costo de despacho y nombre clave:
     - `ACTIVA | S/ 2.00 | Z1-2` (Zona de máxima cercanía / Campoy núcleo)
     - `ACTIVA | S/ 3.00 | Z3` (Radio medio)
     - `ACTIVA | S/ 4.00 | Z4` (Radio ampliado)
     - `ACTIVA | S/ 5.00 | Z5` (Límite perimetral de cobertura)

### Modal de Configuración Operativa (`modal-configuracionlocalcallcenter.html`)

| Campo | Etiqueta | Tipo de Control | Propósito / Opciones |
| :--- | :--- | :--- | :--- |
| `local_aceptadelivery` | Habilitar DELIVERYS | Switch / Checkbox | Activa o suspende globalmente el canal de delivery en el local |
| `estadoDeliverySeleccionado` | Estado inicial de un pedido | `<select>` | Define si entra en: `Por confirmar`, `En cocina` o `En reparto` |
| `localconfig_metaventadelivery` | Capacidad de reparto / Meta venta | `input[type="number"]` | Meta financiera o tope operativo diario de pedidos |
| `localconfig_tiempoentrega` | Tiempo promedio de entrega | `input[type="number"]` | Tiempo estándar prometido al cliente (en minutos, ej. 45 min) |
| Integración externa | Integración con ChaskyFood | Switch / Checkbox | Habilita conexión con flota tercerizada ChaskyFood |

---

## 6. Ajustes de Delivery (Flota, Movilidad, Canales y Motivos)

- **Ruta Principal**: `#!/delivery/ajustes/motorizado`
- **Controlador**: `AjustesDeliveryCtrl as vm`
- **Plantilla Contenedora**: `scripts/restaurantpe/delivery/ajustes/ajustesdelivery.html`

### Propósito
Administrar los recursos humanos y logísticos del canal de despacho: catálogo de motorizados, parque vehicular, canales de procedencia de ventas, tipificación de quejas y causales de cancelación de pedidos.

### Pestaña 1: Motorizados (`scripts/restaurantpe/delivery/motorizados/index.html`)
- **Propósito**: Mantenimiento de la nómina de repartidores habilitados.
- **Columnas de la Tabla**:
  1. `Nombres` (incluye DNI del repartidor)
  2. `Dirección`
  3. `Licencia` (Número de brevete de conducir)
  4. `Teléfono`
  5. `Estado` (`ACTIVO` / `INACTIVO`)
  6. `Acciones` (Botón `Editar`)
- **Filtros**:
  - Buscador general: `Buscar...`
  - Paginación: `Por: 10 registros`
  - Filtro por sucursal: `Local: Todos los locales`
  - Botón de refresco: `fa fa-refresh`
- **Acciones Disponibles**:
  - Botón `Nuevo motorizado` (abre formulario de alta `editar.html`).
  - Botón `Editar` por cada fila de la grilla.
- **Campos del Formulario Motorizado (`editar.html`)**:

| Campo (`ng-model`) | Etiqueta Visible | Tipo de Control | Obligatorio | Regla / Validación |
| :--- | :--- | :--- | :---: | :--- |
| `vm.motorizado.motorizado_nombres` | Nombres | `input[type="text"]` | Sí | Nombre(s) del colaborador |
| `vm.motorizado.motorizado_apellidos` | Apellidos | `input[type="text"]` | Sí | Apellidos paterno/materno |
| `vm.motorizado.motorizado_dni` | DNI | `input[type="text"]` | Sí | Documento de identidad |
| `vm.motorizado.motorizado_licencia` | Licencia | `input[type="text"]` | No | Brevete emitido por MTC |
| `vm.motorizado.motorizado_direccion`| Dirección | `input[type="text"]` | No | Residencia del repartidor |
| `vm.motorizado.motorizado_telefono` | Teléfono | `input[type="text"]` | Sí | Celular para coordinación |
| `vm.motorizado.motorizado_mtc` | MTC | `input[type="text"]` | No | Registro ante Ministerio de Transportes |
| `vm.motorizado.motorizado_estado` | Motorizado activo | Checkbox / Toggle | Sí | `1` = Activo, `0` = Inactivo |

### Pestaña 2: Canales de Delivery (`canaldelivery`)
- **Propósito**: Configurar los diferentes orígenes por los cuales ingresan los pedidos (ej. Web, Teléfono, WhatsApp, Rappi, PedidosYa).
- **Columnas de la Tabla**: `Nombre del canal`, `Teléfono`, `Estado`, `Acciones`.
- **Botones**: `Nuevo canal de delivery`, `Editar`.
- **Campos de Formulario**: `canaldelivery_descripcion` (Nombre del canal), Icono identificador, `canaldelivery_estado` (Activo/Inactivo).

### Pestaña 3: Movilidad (`movilidad`)
- **Propósito**: Control del parque móvil asignado a los despachos.
- **Columnas de la Tabla**: `Placa`, `Marca`, `Categoría`, `Estado`, `Acciones`.
- **Campos de Formulario (`movilidad/editar.html`)**:
  - Placa vehículo (`movilidad_placa`)
  - Serie del chasis (`movilidad_seriechasis`)
  - Marca vehículo (`movilidad_marca`)
  - Categoría del vehículo (`movilidad_categoria`: Moto, Bicicleta, Auto, Torito/Mototaxi)
  - Estado: Movilidad activa (`movilidad_estado`)

### Pestaña 4: Tipo de Reclamo (`tiporeclamo`)
- **Propósito**: Catálogo maestro de categorías para clasificación de quejas en Call Center.
- **Columnas de la Tabla**: `Descripción`, `Estado`, `Acciones`.
- **Campos de Formulario**: Descripción (`tiporeclamo_descripcion`), Tipo reclamo activo (`tiporeclamo_estado`).

### Pestaña 5: Motivos de Cancelación (`tipoproblemadelivery`)
- **Propósito**: Catálogo de causales obligatorias que el operador debe registrar al anular una orden de delivery.
- **Columnas de la Tabla**: `Descripción`, `Estado`, `Acciones`.
- **Campos de Formulario**: Descripción del motivo (`tipoproblemadelivery_descripcion`), Motivo activo (`tipoproblemadelivery_estado`).

---

## 7. Resumen de Delivery (Panel de Control y KPIs Operativos)

- **Ruta Interna**: `#!/resumen/delivery`
- **Controlador**: Vinculado al módulo de Escritorio (`escritorio.delivery`)
- **Plantilla Base**: `scripts/restaurantpe/escritorio/resumen/delivery.view.html`

### Propósito
Tablero de inteligencia de negocios e indicadores clave (KPIs) en tiempo real para supervisar la rentabilidad, tiempos de respuesta, hábitos de pago y rendimiento del equipo de reparto durante el turno o período seleccionado.

### Filtros Superiores
- `Selecciona un gráfico`: Alterna entre Gráfico por cantidad de ventas vs. Dinero por ventas.
- `Canal: Todos`: Filtro dropdown por canal de procedencia.
- `Del [Fecha Inicio] hasta [Fecha Fin]`: Selector de rango de fechas con presets (Hoy, Ayer, Esta semana, Este mes).
- `1 Local seleccionado(s)`: Filtro por sucursal.
- Botones: `Generar informe`, `Ver Novedades`, `Ver más información`.

### Métricas y Bloques de Información Mostrados
1. **Volumen Financiero y Operativo**:
   - `Total Venta` (Monto acumulado en Soles `S/` y Cantidad de Operaciones).
   - `En efectivo`: Monto total recaudado en efectivo.
   - `En tarjeta`: Monto total pagado mediante terminales o pasarelas.
   - `Ventas a crédito`: Consumos de clientes bajo cuenta corriente o crédito comercial.
   - `Redondeo` e `Interés`: Ajustes decimales o recargos financieros.
2. **Distribución por Medio de Pago**:
   - Gráfico circular / porcentaje: `% Efectivo` vs. `% Tarjeta`.
3. **Control de Anulaciones**:
   - Monto total de ventas anuladas en Soles.
   - `% del total de ventas` representado por anulaciones.
   - Conteo absoluto de órdenes anuladas.
4. **Rankings Diarios de Desempeño**:
   - **Colaborador del día**: Empleado/operador que generó mayor venta y porcentaje.
   - **Cliente del día**: Cliente con mayor volumen de compra en delivery.
   - **Motorizado del día**: Repartidor con mayor cantidad de entregas efectivas.
   - **Hora de mayor afluencia**: Hora punta del día (hora con mayor concentración de pedidos y facturación).
   - **Hora más libre**: Franja valle con menor demanda.
   - **Local con mayor venta**: Sucursal líder en facturación de delivery.
   - **Promedio de venta del día**: Ticket promedio por comanda (`Ticket Medio = Total Ventas / Cantidad Operaciones`).
5. **Trazabilidad de Tiempos Promedio entre Fases de Delivery**:
   - `Confirmar`: Tiempo promedio desde que entra la orden hasta que el operador la aprueba (minutos).
   - `Asignar`: Tiempo transcurrido hasta que se asigna motorizado disponible.
   - `En cocina`: Tiempo de preparación del pedido por los cocineros/baristas.
   - `En entregar`: Tiempo de tránsito en ruta del motorizado hasta la puerta del cliente.
   - `Tiempo total`: Ciclo completo de atención (*Order to Delivery Time*).

---

## 8. Informe de Cobertura (Zonas de Reparto)

- **Ruta Interna**: `#!/informes/ventas/deliverys-cobertura`
- **Controlador**: `InformesVentasDeliveryscoberturaCtrl as vm`
- **Plantilla Base**: `scripts/restaurantpe/informes/ventas/deliveryscobertura/deliverys.html`

### Propósito
Auditar el desempeño comercial y operativo por zona geográfica de entrega, midiendo qué sectores de la ciudad concentran las mayores ventas y evaluando los cuellos de botella en cada etapa del despacho.

### Filtros Disponibles
- Moneda facturación: `Soles`
- Filtro de Sucursal: `Local`
- Filtro de Terminal de Caja: `Caja` (ej. Caja Principal)
- Filtro de Comprobante: `Comprobante` (Todos / Boleta / Factura / Nota de venta)
- Filtro de Turno: `Turno` (Turno Día / Noche)
- Filtro de Estado: `Estado` (Todos / Entregado / Anulado)
- Filtro de Canal de Venta: `Canal de venta`
- Filtro de Motorizado: `Motorizado`
- Filtro de Solicitante: `Solicitante`
- Rango de Fechas: `Del [Inicio] hasta [Fin]`
- Checkboxes: `Por delivery`, `Público general`
- Búsqueda Geo: `Ingresa la dirección o una referencia`

### Columnas de la Tabla de Cobertura

| Grupo de Columnas | Nombre de Columna | Descripción / Métrica |
| :--- | :--- | :--- |
| **Zona y Logística** | `Zona` | Nombre de la zona poligonal configurada (ej. Z1-2, Z3, Z4, Z5) |
| **Zona y Logística** | `Horario` | Franja horaria de atención |
| **Zona y Logística** | `Costo de envio` | Tarifa de flete asignada a la zona |
| **Operaciones** | `Total de operaciones`| Conteo total de pedidos despachados al sector |
| **Tiempos Promedio** | `En Confirmar` | Minutos promedio en recepción |
| **Tiempos Promedio** | `En Asignar` | Minutos promedio para vinculación de repartidor |
| **Tiempos Promedio** | `En Cocina` | Minutos promedio de elaboración en barra/cocina |
| **Tiempos Promedio** | `En Entregar` | Minutos promedio de viaje en ruta |
| **Tiempos Promedio** | `De confirmar a entregar` | Tiempo acumulado global de servicio |
| **Financiero** | `Subtotal` | Base imponible facturada en la zona |
| **Financiero** | `Impuestos` | Monto de IGV / tributos recaudados |
| **Financiero** | `Total` | Venta bruta total en la zona |
| **Financiero** | `Costo de envio` | Total recaudado exclusivamente por flete de envío |

### Acciones
- Botón `Generar informe`: Dispara la consulta al backend.
- Botón `Descargar`: Exportación de la sábana de datos en formato Excel (.xlsx).
- Botón `Atrás`: Retorno a la pantalla previa.

---

## 9. Mapa de Calor (Densidad Cartográfica de Despachos)

- **Ruta Interna**: `#!/informes/ventas/deliverys-cobertura/mapa`
- **Controlador**: `InformesVentasDeliveryscoberturamapaCtrl as vm`
- **Librería Cartográfica**: Google Maps API con módulo de visualización (`libraries=visualization`, `google.maps.visualization.HeatmapLayer`).

### Propósito
Visualizar sobre un mapa interactivo la densidad geográfica y concentración de los pedidos entregados en Lima (principalmente San Juan de Lurigancho y alrededores de Campoy), permitiendo a la administración identificar zonas con alta demanda desatendida, optimizar los polígonos de reparto y planificar aperturas de nuevas sedes o *dark kitchens*.

### Filtros
- Selector de Local: `Local: CAPRICHOS`.
- Selector de Canales: Multi-select con cantidad de canales seleccionados (ej. `22 Canal de delivery seleccionado(s)`).
- Rango de Fechas: DateRangePicker (`Del 01 Octubre, 2026 hasta 13 Octubre, 2026`).
- Buscador de Dirección: *"Ingresa la dirección o una referencia"*.
- Acciones: Botón `Generar informe`, Botón `Atrás`.

### Comportamiento Visual
- El mapa renderiza gradientes de color térmico (de verde a rojo intenso) en los vértices de latitud y longitud donde se acumula la mayor frecuencia de pedidos confirmados.

---

## 10. Reclamos de Delivery

- **Ruta Interna**: `#!/ventas/callcenter/reclamo`
- **Controlador**: `VentasCallcenterReclamoCtrl as vm`
- **Plantilla Base**: `scripts/restaurantpe/ventas-full/callcenter/reclamo.html`

### Propósito
Gestionar las quejas, incidentes, demoras excesivas, productos faltantes o pedidos derramados reportados por los clientes de delivery, permitiendo hacer seguimiento hasta su resolución comercial o compensación.

### Filtros
- Filtro de Sucursal: `Local`
- Filtro de Usuario: `Usuario: Todos`
- Filtro de Tipo: `Tipo: Todos` (categorías de queja)
- Filtro de Estado: `Estado: Todos` (Pendiente, En revisión, Resuelto, Desestimado)
- Rango de Fechas: `Del [Inicio] hasta [Fin]`
- Checkbox: `Público general`
- Acciones: `Generar informe`, `Descargar`, `Atrás`.

### Columnas de la Tabla de Reclamos
1. `Fecha`: Marca de tiempo (fecha y hora exacta del registro).
2. `Cliente`: Nombre completo del cliente afectado.
3. `Local`: Sucursal que procesó el despacho.
4. `Usuario`: Colaborador que registró la queja en el sistema.
5. `Asunto`: Título resumen de la incidencia.
6. `Mensaje`: Detalle descriptivo de lo ocurrido.
7. `Tipo`: Categoría del reclamo (ej. Retraso en entrega, Pedido incompleto, Calidad de producto).
8. `Estado`: Estatus del trámite (`Pendiente`, `Atendido`, etc.).

---

## 11. Informe de Frecuencia de Clientes

- **Ruta Interna**: `#!/informes/ventas/deliverys-frecuencia`
- **Controlador**: `InformesVentasDeliverysfrecuenciaclienteCtrl as vm`
- **Plantilla Base**: `scripts/restaurantpe/informes/ventas/deliverysfrecuenciacliente/deliverys.html`

### Propósito
Identificar a los clientes más recurrentes y leales del canal de delivery, analizando su frecuencia de compra, ticket promedio y tasa de cancelación para alimentar programas de fidelización o promociones dirigidas.

### Filtros
- Moneda de facturación: `Soles`
- Selector de Sucursal: `Local`
- Rango de Fechas: DateRangePicker (`Del [Inicio] hasta [Fin]`)
- Checkbox: `Público general`
- Acciones: `Generar informe`, `Descargar`, `Atrás`.

### Columnas de la Tabla de Frecuencia
1. `Cliente`: Nombre y apellidos o razón social del cliente.
2. `Telefonos`: Número(s) telefónicos asociados.
3. `Nº operaciones`: Cantidad total de órdenes solicitadas en el período.
4. `Fecha de Ultima Visita`: Fecha del último pedido completado.
5. `Total Ventas Anuladas`: Monto acumulado en Soles de pedidos que fueron cancelados.
6. `Total Ventas`: Monto acumulado neto facturado al cliente.
7. `Costo de Envio`: Total pagado por el cliente en concepto de tarifas de delivery.

---

## 12. Tu Restaurant en Facebook (Canal Social)

- **Ruta Interna**: `#!/delivery`
- **Plantilla Base**: `scripts/restaurantpe/delivery/delivery.view.html`

### Propósito
Configurar la integración comercial para incrustar la carta y el botón de autopedidos directamente dentro de la página oficial de Facebook de la cafetería mediante un *tab* de aplicación de Facebook.

### Elementos Observados
1. **Configuración de Costo Base de Envío**:
   - Tarifa plana referencial para pedidos sociales: `S/ 3.50`.
   - Botón `Editar`: Permite modificar la tarifa fija base.
2. **Asistente de Vinculación con Facebook**:
   - Paso 1: Instrucción: *"Primero tienes que haber iniciado sesión en tu Facebook"*.
   - Botón de autorización OAuth: `Log in con Facebook`.
   - Paso 2: Selección de la página de empresa donde se montará la pestaña de delivery.

---

## 13. Funcionalidades Imprescindibles para Replicar

Para que el nuevo sistema reemplace exitosamente al actual sin generar disrupción en las ventas ni en la operación de cocina de CAPRICHOS, se deben implementar las siguientes funcionalidades nucleares:

1. **Carta Digital Responsiva de Carga Ultrarrápida**:
   - Catálogo clasificado por categorías con imágenes optimizadas y estados de stock en tiempo real.
   - Modificador avanzado de combos (ej. seleccionar exactamente 6 unidades entre diferentes sabores de donas/galletas con validación de límite).
2. **Motor de Selección de Horarios y Fechas de Recojo**:
   - Selector visual de día, hora y franjas de 15 minutos con bloqueo de horas pasadas o fuera del horario de atención.
3. **Checkout con Facturación Electrónica Peruana**:
   - Emisión fluida de Boleta (DNI) y Factura (RUC con validación de 11 dígitos y razón social), así como Nota de Venta interna.
   - Desglose transparente de precios con IGV e impuestos a bolsas plásticas (ICBPER).
4. **Geocodificación y Tarifación Poligonal Dinámica**:
   - Herramienta administrativa para dibujar polígonos sobre el mapa (Zonas Z1 a Z5) y asignar tarifas fijas o dinámicas por zona.
   - Algoritmo en frontend/backend para validar si la dirección del cliente está dentro de la cobertura antes de procesar el pago.
5. **Call Center Operativo en Tablero Kanban**:
   - Tarjetas de pedidos en curso con cronómetro de tiempo transcurrido, canal de procedencia, teléfono de contacto y botón de anulación con motivo obligatorio.
   - Registro express de clientes con múltiples direcciones guardadas.
6. **Módulo de Asignación y Control de Motorizados**:
   - Padrón de repartidores, placas de vehículos y asignación de órdenes por pedido.
7. **Pasarelas de Pago Múltiples**:
   - Efectivo (con campo "paga con"), POS contra entrega, Billeteras móviles (Yape/Plin con captura o confirmación de voucher) y pasarelas online seguras (Culqi/Izipay/MercadoPago).
8. **Auditoría de Reclamos y Tiempos de Entrega**:
   - Métrica precisa de los tiempos entre recepción, cocina, despacho y entrega.

---

## 14. Mejoras Sugeridas para el Nuevo Sistema

1. **Eliminación de Obsolescencias Técnicas Críticas**:
   - El sistema actual corre sobre PHP 7.1 (EOL 2019) y AngularJS 1.6 (EOL 2022) con peticiones REST HTTP sin cifrar en el backoffice. El nuevo sistema debe construirse con arquitectura moderna (ej. Next.js / React / Node / Go / Python) con HTTPS estricto y WebSockets seguros.
2. **Validación Automática de Documentos SUNAT**:
   - Integrar consulta automática de RUC y DNI contra API oficial (RENIEC / SUNAT) en el checkout de la carta digital y en el Call Center, evitando que el usuario o cliente deba tipear manualmente la razón social o cometa errores en el DNI.
3. **Confirmación Automatizada de Pagos Yape / Plin**:
   - Actualmente el operador debe verificar manualmente las transferencias. Se recomienda integrar lectores automáticos de notificaciones bancarias o pasarelas que generen QR dinámico de Yape/Plin con confirmación instantánea (*webhook*).
4. **App Nativa o PWA para el Motorizado**:
   - Proveer a los repartidores una PWA móvil con geolocalización GPS en vivo para que el cliente final y la cafetería vean el trayecto de la moto en un mapa en tiempo real, similar a las aplicaciones comerciales de delivery.
5. **Notificaciones Push y WhatsApp API Oficial**:
   - Reemplazar los enlaces manuales a WhatsApp por la API oficial de WhatsApp Business (Cloud API), enviando confirmaciones automáticas de estado: *"Tu pedido #4897 ya está en el horno"* -> *"Tu pedido ha salido con el motorizado"*.

---

## 15. Dudas para el Cliente (CAPRICHOS)

1. **Flota de Reparto**: ¿Los motorizados son empleados directos en planilla de la cafetería o se contrata a repartidores independientes por viaje / empresas tercerizadas (ej. ChaskyFood, Urbaner)?
2. **Monto Mínimo de Pedido**: ¿Cuál es el monto mínimo oficial exigido para habilitar el despacho a domicilio en Campoy y SJL (actualmente configurado en S/ 15.00 en base de datos)?
3. **Tiempos de Preparación**: El tiempo promedio configurado es de 45 minutos. ¿Existen productos de pastelería o tortas enteras que requieran programación con 24 o 48 horas de anticipación?
4. **Integración con Canales de Terceros**: ¿Desean que el nuevo sistema reciba pedidos automáticamente de Rappi o PedidosYa en la misma pantalla del Call Center mediante API, o se gestionan por separado en sus propias tablets?
5. **Políticas de Reclamos**: ¿Cuáles son las directivas actuales de compensación ante pedidos tardíos o defectuosos (ej. emisión de cupón de descuento, reenvío sin costo o nota de crédito)?

---

## 16. Registro de Elementos No Observados

- **Modal de edición de polígonos complejos en vivo**: No se crearon ni editaron zonas de reparto reales en `#!/ajustes/zonareparto` para no alterar las tarifas geográficas que los clientes de producción están pagando en este momento.
- **Acción de guardar nuevo motorizado**: Se inspeccionó el formulario completo `editar.html` pero no se pulsó el botón de confirmación/guardado para no alterar el padrón de personal en base de datos.
- **Pasarelas de cobro con tarjeta real**: En el checkout de la carta digital se llegó hasta la selección de pasarela y campos de tokenización sin enviar números reales de tarjeta para evitar cobros bancarios no deseados.
- **Transmisión de estados en tiempo real hacia cocina**: Al no enviar una orden de prueba en producción, no se observó la animación de transición de la comanda en la pantalla de cocina (`KDS`).

---
id: ANA-CAP-055
tipo: analisis
titulo: "Informe de Homogeneidad: Datos, Vocabulario, Persistencia y Permisos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, revision-cruzada-informes]
---

# Informe de Homogeneidad: Datos, Vocabulario, Persistencia y Permisos

## 1. Resumen Ejecutivo

El presente informe evalua la coherencia interna de la plataforma digital Caprichos entre sus cuatro componentes fundamentales:
1. Sistema Administrativo (`fuente/Admin.dc.html`)
2. Carta Virtual para clientes (`fuente/Main.dc.html`)
3. Simulador del Chatbot de WhatsApp (`fuente/Chatbot.dc.html`)
4. Documentacion funcional y tecnica (`docs/`, actas de descubrimiento y reportes por rol)

El analisis identifica discordancias criticas de vocabulario entre canales, duplicacion de catalogos y reglas de negocio fijas en codigo, perdida total de datos operativos al recargar el navegador debido a la falta de persistencia en memoria, brechas de permisos donde roles operativos pueden modificar precios de venta, y discrepancias directas entre la documentacion de arquitectura de roles y el codigo implementado (notablemente la omision completa del rol Produccion en la matriz documental).

---

## 2. Vocabulario y Glosario Unico

### 2.1 Discordancias de Vocabulario Detectadas

#### (1) Modalidades de Atencion
- **Admin**: Usa tres claves internas: `delivery: 'Delivery'`, `llevar: 'Para llevar'`, `local: 'En mesa'` (`MODAL`). Sin embargo, en filtros y reportes usa `'Salón'` (`'Salón, web, WhatsApp y delivery'`), en canales usa `'En el local'` (`CANAL_V.local`), en descripciones de combos dice `'Válido para salón y delivery'`, y en los chats de WhatsApp muestra `'Para llevar'`.
- **Main**: Define `MODALS = [ { id: 'delivery', n: 'Delivery' }, { id: 'llevar', n: 'Para recoger' } ]`. En etiquetas largas muestra `'Para recoger: pasas por el local a retirar tu pedido'`, pero en mensajes de error de zona dice `'Puedes pedir Para llevar y recoger en la tienda'`. En combos conserva el texto `'Válido para salón y delivery'`.
- **Chatbot**: Define `MODALS = [ { id: 'delivery', n: 'Delivery' }, { id: 'llevar', n: 'Para recoger' } ]`.
- **Docs**: `flujo-de-pedidos.md` habla de `'En el local (mesa)'`, `'Delivery o para recoger'`; `BRD.md` alterna entre `'en mesa'`, `'en el salón'`, `'para recoger en el local'`, `'para llevar'`.

#### (2) Areas de Preparacion y Estaciones
- **Admin (KDS y Comandas)**: El KDS clasifica pedidos en tres areas logicas: `'Bebidas'`, `'Postres'`, `'Salados'` (`kareaChips`). Las etiquetas de impresion (`LBL_AREA`) definen `'BEBIDAS'`, `'SALADOS'`, `'POSTRES · DULCES'`.
- **Admin (Plano, Pantallas y Personal)**: En el modulo Pantallas las estaciones son `['Cocina y barra', 'Solo barra', 'Solo cocina']`. En el Plano del local los elementos son `'cocina'` y `'barra'`. En Personal y Almacen el rol y origen son `'Cocina y barra'`, `'Cocina'`, `'Barra'`.
- **Docs y Actas**: En `acta-02-descubrimiento.md`, el cliente Kevin Rosales explico explicitamente que las tres areas de produccion fisica son: `'bebidas'`, `'postres'` y `'salados'`, reclamando que el sistema anterior saturaba al personal porque no separaba los items de un combo por estas tres areas. En contraste, `pantalla-cocina.md` propone dividir pantallas por `'cocina'` y `'barra'`.

#### (3) Estados Operativos
- **Pedidos**:
  - `Admin` implementa: `nuevo` ('Por confirmar'), `cola` ('En cocina · nuevo'), `prep` ('Preparando'), `listo` ('Listo'), `ruta` ('En camino'), `entregado` ('Entregado'), `rechazado` ('Rechazado').
  - No existe un valor de estado `'anulado'` en la propiedad `status`; al anular se asigna `status: 'rechazado'` y se adjunta un objeto `anulado`. La UI del admin titula el dialogo "Anular pedido", pero el estado visible resulta "Rechazado".
  - El estado `'servido'` no es un estado del ciclo de vida sino un flag booleano adicional (`o.servido`).
  - `Main` muestra etapas al cliente: `'Pedido recibido'`, `'Un asesor te contacta y confirma el pago'`, `'En cocina'`, `'En camino'` o `'Listo para recoger'`.
  - `docs/flujo-de-pedidos.md` lista: `'Por confirmar'`, `'En cocina'`, `'preparando'`, `'listo'`, `'servido'`, `'en ruta'`, `'entregado'`, `'rechazado'`, `'anulado'`.
- **Reservas**:
  - En la tabla del Admin: `'Confirmada'`, `'Pendiente'`, `'Cancelada'`, `'Atendida'`.
  - En la lista reactiva de solicitudes: `'pendiente'`, `'confirmada'`.
- **Compras**:
  - `'Recibida'`, `'Pendiente'`, `'Anulada'`, `'Pagada'`.
- **Creditos**:
  - `'Al día'`, `'Por vencer'`, `'Vencido'`, `'Pagado'`.

#### (4) Medios de Pago
- **Admin**: `PAGOS = [ 'Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta' ]`. En pedidos con multiples metodos registra `pay: 'Mixto'`. No existe la opcion `'Crédito'` dentro del selector de cobro de pedidos.
- **Main**: `PAYS = [ 'Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia' ]`. En pie de confianza destaca `'Yape · Plin · Tarjeta'` (omitiendo efectivo y transferencia); en mosaico destaca `'Yape · Plin · Tarjeta · Efectivo'`.
- **Chatbot**: Opciones fijas reducidas: `[ 'Efectivo', 'Yape', 'Plin' ]`. Omite totalmente `'Tarjeta'` y `'Transferencia'`.
- **Docs**: `cierre-de-caja.md` agrega la categoria `'otros'`.

#### (5) Nombres de Roles
- **Definicion del Objeto ROLES en Admin**: `admin` ('Administrador'), `cajero` ('Cajero'), `cocina` ('Cocina y barra'), `mozo` ('Mozo'), `callcenter` ('Call center'), `almacen` ('Almacén'), `produccion` ('Producción'), `repartidor` ('Repartidor').
- **Discordancia interna en Admin**: En la constante `STAFF` y en los filtros de la tabla de creditos, `'Cajero'` se llama `'Caja'`, y `'Repartidor'` se llama `'Reparto'`.
- **Docs**: `modulos-y-roles.md` y `BRD.md` afirman taxativamente que existen "siete roles" y excluyen a `'Producción'` de las listas de roles del sistema.

#### (6) Tamanos de Bebidas (12 / 16 / 20 / 21 oz)
- En `Admin` y `Main`, el generador estandar de variantes de bebidas `T3` establece:
  - `Regular 12 oz`
  - `Grande 16 oz`
  - `Extra 21 oz`
- En el combo `DÚO PARA COMPARTIR` (tanto en `Admin` como en `Main`), las variantes fijas definen: `Extra 20 oz`.
- En el combo `DÚO IRRESISTIBLE` (en `Admin` y `Main`), las variantes fijas definen: `Extra 21 oz`.
- En `docs/combos-y-opciones.md` se cita textualmente: "por ejemplo Regular 12 oz, Grande 16 oz, Extra 20 oz".
- En `Frozen` la unica variante es `Extra 21 oz`. En `Gelatina` es `Vaso 12 oz`.

#### (7) Categorias de Productos
- En `Admin`: `PCATS = [ 'Todos', 'Combos', 'Frappes', 'Iced', 'Frozen', 'Calientes', 'Waffles', 'Salados', 'Croissants', 'Postres' ]`.
- En la definicion de catalogo de `Admin` y `Main`, el identificador tecnico es `'complementos'`, pero su etiqueta visible es `'Postres'`.
- En el texto descriptivo del Admin (modulo productos mas comprados) se listan: "frappes, iced, calientes, waffles, salados, complementos y combos", omitiendo `'frozen'` y `'croissants'`, y usando el identificador tecnico `'complementos'` en vez de `'Postres'`.
- En `Chatbot`: Solo existen 4 categorias (`Frappes`, `Calientes`, `Waffles`, `Salados`), omitiendo las otras 5 (`Combos`, `Iced`, `Frozen`, `Croissants`, `Postres`).

---

### 2.2 Propuesta de Glosario Unico

| Concepto | Termino Estandar Unico | Clave Tecnica (ID) | Definicion Operativa | Sinonimos Deprecados | Ambito de Uso |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Modalidad Salon** | En mesa | `mesa` | Consumo presencial en salon servido por mozo. Requiere asignacion de mesa fisica. | En el local, Salón, Local | Admin, Mozo, Comandas, Informes |
| **Modalidad Recojo** | Para recoger | `recojo` | Pedido generado fuera de tienda que el cliente retira presencialmente en mostrador. | Para llevar, Llevar, Mostrador | Carta web, Chatbot, Admin, Caja |
| **Modalidad Envio** | Delivery | `delivery` | Pedido generado para entrega en direccion del cliente mediante motorizado. | A domicilio, Envío | Carta web, Chatbot, Admin, Repartos |
| **Area Produccion 1** | Bebidas | `bebidas` | Estacion de preparacion de bebidas frias, calientes, frappés y frozen (barra/barista). | Barra, Cocina y barra | KDS, Impresion, Pantallas |
| **Area Produccion 2** | Postres | `postres` | Estacion de despacho de reposteria, donas, galletas, tortas y dulces. | Complementos, Dulces, Repostería | KDS, Impresion, Pantallas |
| **Area Produccion 3** | Salados | `salados` | Estacion de preparacion de sandwiches, waffles, hamburguesas y comida caliente de cocina. | Cocina caliente, Cocina | KDS, Impresion, Pantallas |
| **Estado Pedido 1** | Por confirmar | `por_confirmar` | Pedido web o chatbot ingresado a la espera de validacion humana por WhatsApp. | Nuevo, Recibido | Admin, Carta, Chatbot |
| **Estado Pedido 2** | En cocina | `en_cocina` | Pedido verificado que entro a las pantallas de preparacion. | Cola, En preparación, Prep | KDS, Admin, Carta |
| **Estado Pedido 3** | Listo | `listo` | Pedido terminado por todas las areas de produccion. | Preparado, Despachado | KDS, Mozo, Caja, Reparto |
| **Estado Pedido 4** | En camino | `en_camino` | Pedido de delivery retirado por el repartidor en trayecto al domicilio. | En ruta, Ruta | Repartos, Carta web, Bot |
| **Estado Pedido 5** | Entregado | `entregado` | Pedido finalizado y entregado satisfactoriamente al cliente (o servido y cerrado en mesa). | Servido (como estado), Cerrado | Admin, Historial, Cierre |
| **Estado Pedido 6** | Rechazado | `rechazado` | Pedido que no fue admitido antes de entrar a preparacion (cliente no contactable/pago fallido). | Cancelado previo | Admin, Notificaciones |
| **Estado Pedido 7** | Anulado | `anulado` | Pedido que entro a preparacion o salio a ruta pero fue dado de baja por incidencia justificada. | Rechazado (post-confirmación) | Admin, Auditoria, Almacen |
| **Medio de Pago 1** | Efectivo | `efectivo` | Pago en moneda fisica contra entrega o en mostrador; requiere calculo de vuelto. | Cash, Contado | Todos los canales |
| **Medio de Pago 2** | Yape | `yape` | Billetera digital BCP verificada con comprobante y codigo de operacion. | Billetera BCP | Todos los canales |
| **Medio de Pago 3** | Plin | `plin` | Billetera digital interbancaria verificada con comprobante. | Billetera BBVA/Interbank | Todos los canales |
| **Medio de Pago 4** | Tarjeta | `tarjeta` | Cobro mediante terminal POS (debito/credito) en tienda o con POS portatil del rider. | POS | Todos los canales |
| **Medio de Pago 5** | Transferencia | `transferencia` | Abono a cuenta corriente o CCI validado antes del envio. | Depósito bancario | Carta web, Admin, Caja |
| **Medio de Pago 6** | Mixto | `mixto` | Cobro dividido entre dos o mas medios de pago que suman el total exacto. | Dividido | Admin, Caja, Cierre |
| **Medio de Pago 7** | Credito del Personal | `credito_personal` | Modalidad de compra interna exclusiva para trabajadores con descuento por planilla. | Crédito | Admin, Mozo, Caja |
| **Rol 1** | Administrador | `admin` | Gestion integral, configuracion, reportes gerenciales y autorizacion de excepciones. | Dueño, Encargado | Sistema global |
| **Rol 2** | Cajero | `cajero` | Cobro de pedidos, apertura y arqueo de turno, emision de notas de venta/boletas. | Caja | Sistema global |
| **Rol 3** | Cocina y barra | `cocina` | Visualizacion KDS y cambio de estado de comandas en areas de preparacion. | Cocinero, Barista | KDS, Notificaciones |
| **Rol 4** | Mozo | `mozo` | Toma de comandas en salon mediante plano interactivo y atencion de mesas. | Salonero | Tablet salon |
| **Rol 5** | Call center | `callcenter` | Atencion telefonica, confirmacion de pedidos digitales y soporte de delivery. | Operadora | Atencion remota |
| **Rol 6** | Almacen | `almacen` | Control de insumos, recepcion de compras a proveedores y despacho de requerimientos. | Almacenero, Logística | Almacen central |
| **Rol 7** | Produccion | `produccion` | Elaboracion diaria por recetas (donas, masas, pre-elaborados) y pase a stock. | Taller, Repostería | Taller de elaboracion |
| **Rol 8** | Repartidor | `repartidor` | Toma atomaica de pedidos listos de delivery, navegacion por GPS y entrega. | Reparto, Motorizado, Rider | Movil reparto |
| **Tamano 1** | Regular 12 oz | `12oz` | Vaso estandar chico de 12 onzas para bebidas calientes y frias. | Chico, Regular | Carta, Bot, KDS, Stock |
| **Tamano 2** | Grande 16 oz | `16oz` | Vaso intermedio de 16 onzas para bebidas calientes y frias. | Mediano, Grande | Carta, Bot, KDS, Stock |
| **Tamano 3** | Extra 21 oz | `21oz` | Vaso grande de 21 onzas para bebidas frias, frappés y frozen. | Grande 20 oz, Extra 20 oz | Carta, Bot, KDS, Stock |
| **Categoria 1** | Combos | `combos` | Promociones combinadas con seleccion de bebidas y postres. | Combos Dúo, Ofertas | Carta, Bot, Admin |
| **Categoria 2** | Frappes | `frappes` | Bebidas licuadas con hielo, espresso, leche y toppings. | Frappés | Carta, Bot, Admin |
| **Categoria 3** | Iced | `iced` | Bebidas frias servidas sobre cubos de hielo. | Bebidas frías | Carta, Bot, Admin |
| **Categoria 4** | Frozen | `frozen` | Bebidas granizadas refrescantes de fruta o limonada (solo 21 oz). | Granizados | Carta, Bot, Admin |
| **Categoria 5** | Calientes | `calientes` | Cafes y chocolates calientes servidos en taza de vidrio o vaso para llevar. | Cafetería caliente | Carta, Bot, Admin |
| **Categoria 6** | Waffles | `waffles` | Waffles artesanales completos o medias porciones. | Repostería caliente | Carta, Bot, Admin |
| **Categoria 7** | Salados | `salados` | Sandwiches, hamburguesas, croissants rellenos y complementos salados. | Cocina salada | Carta, Bot, Admin |
| **Categoria 8** | Croissants | `croissants` | Masas hojaldradas artesanales horneadas. | Hojaldres | Carta, Bot, Admin |
| **Categoria 9** | Postres | `postres` | Donas, galletas, tortas individuales, porciones y dulces. | Complementos | Carta, Bot, Admin |

---

## 3. Persistencia de Datos en el Admin

### 3.1 Datos que se guardan en localStorage
El archivo `fuente/Admin.dc.html` utiliza la funcion `writeCfg(patch)` para sincronizar configuraciones hacia `localStorage` bajo la clave principal `caprichos_carta_cfg_v1`, ademas de una clave secundaria para comentarios (`caprichos_comments_v1`):

1. `info`: Datos generales del local, direccion, horarios por dia, fechas especiales, cuentas bancarias, PIN de anulacion, umbral de envio gratis (`envioGratis`), pedido minimo (`pedidoMin`) y tarifas por zona (`tarZ2`, `tarZ3`, etc.).
2. `pover`: Sobrescrituras manuales de precios y categorias de productos (`state.pover`).
3. `plan`: Distribucion fisica del plano del local y mesas (`state.plan`).
4. `catOrder`, `order`, `hidden`, `photos`, `layout`, `promos`, `texts`, `banner`, `theme`: Todo el estado visual y ordenamiento del Diseñador de la Carta (`dzPublish`).
5. `palettes`: Personalizaciones de colores por temporada festiva (`palPublish`).
6. `promosAll`: Definicion de combos, promociones 2x1 y 3x2 (`persistPromos`).
7. `opciones`: Estructura de grupos de opciones (leches, endulzantes, cremas) y tamanos (`opcLoad`).
8. `tipos`: Tipos de producto con sabores asociados como donas y galletas (`persistTipos`).
9. `proveedores`: Catalogo de proveedores (`pvSave`).
10. `comprasReg`: Historial de ordenes de compra recibidas (`cpgSave`).
11. `insumosCfg`: Fichas tecnicas de insumos con factores de conversion y alertas (`insuSave`).
12. `descuentos`: Descuentos automaticos por categoria o producto (`saveDescs`).
13. `reglas`: Reglas globales de promociones y validez (`rgSave`).
14. `coupons` y `couponCfg`: Catalogo de cupones de descuento y configuracion de emision en ticket (`saveCoupons`).
15. `couponLog`: Bitacora de cambios de cupones (`logCt`).
16. `credPay`: Registro de abonos a deudas de credito de los trabajadores (`credPay`).
17. `credit`: Porcentaje de descuento y dias de plazo para credito de personal (`saveCred`).
18. `altaDem`: Estado del modo Alta Demanda (extra minutos y pausa del bot).
19. `reqs`: Requerimientos internos entre cocina/produccion y almacen.
20. `prodExtra`: Productos nuevos creados desde el admin.
21. `highlights`: Historias destacadas tipo Instagram (`hlPublish`).
22. `news`: Publicaciones y eventos de Novedades (`newsPublish`).
23. `local`: Fotografias del local subidas (`local`).
24. `etiq`: Preferencias de impresion de etiquetas de vasos y cocina.
25. `topOn`: Interruptor de estrellas de productos mas comprados en carta.
26. `agot` y `agotHoy`: Disponibilidad de productos y agotados del dia (`availPersist`).
27. `caja`: Historial de turnos cerrados (`caja.cierres`) y turno actual (`caja.ses`).
28. `clientes`: Registro de clientes guardado via `cliSave` bajo la propiedad `clientes` de la misma clave.
29. `caprichos_comments_v1` (clave separada): Mensajes y comentarios dejados por clientes desde la carta virtual.

### 3.2 Datos que viven SOLO en memoria y se pierden al recargar (F5)
Los siguientes elementos residen exclusivamente en `this.state` del componente React/DCLogic y se reinician a sus valores de semilla (`SEED`) al refrescar el navegador:

1. **Pedidos (`orders`)**: Toda orden nueva (`CP-0109` en adelante), cambios de estado (de cola a prep, de prep a listo, de ruta a entregado), cancelaciones/anulaciones, comprobantes adjuntos, vuelto calculado y asignacion de repartidores.
2. **Stock fisico en tiempo real (`stock`)**: Los descuentos de insumos calculados tras aceptar pedidos (`acceptEffects`), bajas por mermas y ajustes de inventario se pierden. El sistema recarga los stocks fijos de `SUPPLIES`.
3. **Movimientos de Kardex (`movAdded`)**: Las filas de entradas, salidas, mermas y transferencias registradas en la sesion actual se borran.
4. **Estado dinamico de Mesas (`rvSeated`, `mesaOv`)**: Que mesa esta ocupada, con pedido activo o cuenta pedida en el salon.
5. **Reservas activas (`rs`)**: Las solicitudes de mesa pendientes (`S-01`, `S-02`), su aprobacion y la asignacion de mesa se resetean a la lista hardcoded.
6. **Simulador de Chats de WhatsApp (`cv.convs`)**: Los mensajes intercambiados con clientes en la consola de WhatsApp, los estados del chat (`atencion`, `validar`, `atendido`) y los comprobantes subidos vuelven a la semilla `CONV0`.
7. **Lotes de produccion perecible (`plotes`)**: El control de vencimiento de 12 horas para donas y masas producidas en el dia se pierde.
8. **Cola de alertas y llamadas (`alerts`)**: Peticiones de ayuda de clientes y quejas pendientes en la campana.
9. **Bitacora operativa de stock (`stockLog`)**: Los ultimos 6 registros de actividad mostrados en pantalla.
10. **Ediciones de celdas en tablas estaticas (`tedits`, `tinactive`)**: Desactivaciones temporales o ediciones rapidas no vinculadas a `writeCfg`.

### 3.3 Requerimientos de Persistencia para el Sistema Real
En un entorno de produccion real ("replica mejorada de restaurant.pe"), la persistencia en `localStorage` es inviable debido al riesgo de corrupcion por concurrencia multi-dispositivo y limites de cuota de navegador. El sistema debe estructurarse asi:

- **Base de Datos Relacional Central (PostgreSQL / MySQL)**:
  - Tablas transaccionales ACID para: `pedidos`, `pedido_items`, `pagos`, `caja_turnos`, `caja_movimientos`, `kardex_movimientos`, `stock_insumo`, `mesas_estado`, `reservas`.
  - Descuento atomico de stock: Cada pedido confirmado descuenta insumos mediante transacciones bloqueantes para evitar sobreventas.
  - Trazabilidad y auditoria: Campos `creado_por`, `creado_en`, `modificado_por`, `anulado_motivo`, `pin_autorizador`.
- **Canal de Tiempo Real (WebSockets / Server-Sent Events)**:
  - Sincronizacion bidireccional instantanea: Cuando un mozo envia una comanda desde una tablet, esta aparece en el KDS de cocina y en la pantalla de caja sin esperar recargas ni compartir localStorage.
  - Toma atomica de repartos: Cuando un repartidor pulsa "Tomar reparto", el backend valida con bloqueo que ningun otro motorizado lo haya tomado milisegundos antes.
- **Cache y Cola Offline (IndexedDB + Service Workers)**:
  - Para contingencias sin internet en caja local: Almacenar ventas pendientes en cola local (`IndexedDB`) y sincronizar en lote contra el servidor al restablecer conexion.

---

## 4. Matriz Real de Permisos de los 8 Roles

### 4.1 Matriz de Acceso a Vistas en Codigo vs Documentacion

| Rol | Vistas en Codigo (`Admin.dc.html:3171`) | Modulos en Docs (`modulos-y-roles.md:111`) | Discrepancias Detectadas |
| :--- | :--- | :--- | :--- |
| **Administrador** (`admin`) | `ALL_VIEWS` (los 22 modulos) | Los 22 modulos | Coincide. Control absoluto. |
| **Cajero** (`cajero`) | `escritorio`, `caja`, `cierre`, `reservas`, `clientes`, `creditos`, `mensajes`, `notificaciones` | Escritorio, Pedidos y caja, Reservas, Clientes, Créditos, Ofertas y descuentos, Notificaciones | **Codigo da `cierre` y `mensajes`** (no listados en tabla doc). **Docs da `ofertas`**, pero el codigo **NO** incluye `ofertas` en las vistas del cajero. |
| **Cocina y barra** (`cocina`) | `escritorio`, `cocina`, `stock`, `notificaciones` | Escritorio, Cocina, Stock y recetas, Notificaciones | Coincide. |
| **Mozo** (`mozo`) | `escritorio`, `caja`, `reservas`, `productos`, `notificaciones` | Escritorio, Pedidos y caja, Reservas, Productos, Notificaciones | Coincide. |
| **Call center** (`callcenter`) | `escritorio`, `caja`, `repartos`, `reservas`, `clientes`, `mapa`, `mensajes`, `notificaciones` | Escritorio, Pedidos y caja, Repartos, Reservas, Clientes, Notificaciones | **Codigo anade `mapa` (mapa de calor) y `mensajes`** (consola WhatsApp). Ambos ausentes en docs. |
| **Almacen** (`almacen`) | `escritorio`, `compras`, `almacen`, `stock`, `informes`, `notificaciones` | Escritorio, Compras, Almacén, Stock y recetas, Informes, Notificaciones | Coincide. |
| **Produccion** (`produccion`) | `escritorio`, `almacen`, `stock`, `notificaciones` | *(Rol completamente omitido)* | **HUECO MAYOR**: El rol Produccion existe en el sistema y tiene `manage: true`, pero **no figura** en `modulos-y-roles.md`. |
| **Repartidor** (`repartidor`) | `escritorio`, `repartos`, `notificaciones` | Escritorio, Repartos, Notificaciones | Coincide. |

---

### 4.2 Matriz de Permisos Efectivos para Acciones Criticas

| Accion Critica | Roles Autorizados en Codigo | Verificacion Tecnica en Codigo Fuente | Evaluacion de Seguridad / Negocio |
| :--- | :--- | :--- | :--- |
| **Cobrar pedidos en salon / caja** | `admin`, `cajero` | `canCollect = selOrder... && !selOrder.paid && canManage`. Requiere `role.manage: true` (`Admin:3887`). | Mozo y Call center tienen `manage: false`, por lo que **no pueden** cobrar en la vista de Pedidos. |
| **Cobrar contra entrega (Delivery)** | `repartidor`, `admin` | `o.status === 'ruta' && !o.paid ? () => cbOpenFor(o)`. Registra `cobroRider: me, liq: false` (`Admin:3680, 3948`). | Correcto: el repartidor cobra en calle y entrega cuentas a caja al liquidar. |
| **Confirmar pago (Web / Bot)** | `admin`, `cajero`, `mozo`, `callcenter` | `canConfirmPay = selOrder.status === 'nuevo' && selOrder.modal !== 'local' && ['admin','cajero','mozo','callcenter'].indexOf(role) >= 0` (`Admin:3884`). | Mozo y Call center pueden validar comprobantes y pasar pedidos a cocina. |
| **Anular pedidos** | `admin` (libre); `cajero` y `callcenter` (con PIN) | `canAnular = !selOrder.paid && ['admin','cajero','callcenter'].indexOf(s.role) >= 0`. `anuNeedPin = s.role !== 'admin'` (`Admin:4512-4515`). | **Mozo no puede anular**. Si el pedido ya esta pagado (`selOrder.paid === true`), **nadie puede anularlo**. |
| **Editar precios de productos** | `admin`, `mozo` **(ANOMALIA)** | En vista `productos`: `p.edit = () => edit... kind: 'product'`. La funcion `editSave` modifica `pover` (`Admin:3405, 3968`). | **BRECHA CRITICA**: El mozo tiene acceso a `productos` y el boton `Editar` **no valida `canManage` ni el rol**. Un mozo puede alterar precios de la carta. |
| **Ver costos de insumos y recetas** | `admin`, `almacen`, `produccion` | `canSeeCost = ['cocina', 'mozo'].indexOf(s.role) < 0` (`Admin:4814`). En compras, solo entran `admin` y `almacen`. | Cocina y mozo tienen ocultos los costos unitarios y margenes de ganancia. Almacen y Produccion si ven costos. |
| **Ver DNI completo de clientes** | Solo `admin` | En filas de tabla se aplica `dniMask(c.dni)` ('4521****'). Al abrir edicion, solo si `s.role === 'admin'` se envia el DNI plano (`Admin:3472, 3500`). | Cajero y Call center ven el DNI enmascarado; solo el Administrador visualiza el documento completo al editar. |
| **Entregar pedido de mesa (Salon)** | `mozo`, `cajero`, `admin` | `canServe = selOrder.status === 'listo' && selOrder.modal === 'local' && !selOrder.servido && ['mozo','cajero','admin'].indexOf(s.role) >= 0` (`Admin:3888`). | Mozo marca `servido: true` ("Ya lo llevé a la mesa"), pero el cierre final de caja (`canDeliver`) solo lo hace Caja o Admin. |
| **Entregar pedido de Delivery** | `repartidor`, `admin` | En `repartos`: `act = ... o.status === 'listo' ? 'ruta' : 'entregado'`. Restringido a `mineOrAdmin` (`Admin:3944, 3948`). | Solo el repartidor asignado o el administrador pueden marcar entregado el pedido en ruta. |

---

## 5. Datos Duplicados y Riesgo de Desalineacion

A continuacion se detallan los valores hardcoded en el codigo que se repiten en multiples archivos y corren riesgo inminente de desincronizacion:

### 5.1 Precios de Productos y Combos
- **Duplicacion**:
  - `Admin.dc.html` define su catalogo completo en `MCAT` / `CARTA` / `COMBOS_DEF`.
  - `Main.dc.html` define un catalogo paralelo en su propio array de productos (`mk(...)`, lineas 995-1050) y combos (`comboBuild`).
  - `Chatbot.dc.html` define un tercer catalogo hardcoded en `CATS` (lineas 112-125) con precios propios (`BEB`, `CAL`, `WAF`).
- **Punto Critico**: Si el administrador modifica un precio en el sistema administrativo (`pover`), la carta virtual lo lee solo si carga la clave compartida, pero si la clave no esta inicializada lee su propio codigo fijo. Peor aun, el Chatbot **nunca lee `pover`** y sigue cobrando sus tarifas estaticas.

### 5.2 Tarifas de Delivery y Envio Gratis
- **Admin**: Configurable en `info.envioGratis` (defecto S/ 70), `info.pedidoMin` (defecto S/ 14.50) y tarifas por zona (`tarZ2: 2`, `tarZ3: 3`, `tarZ4: 4`, `tarZ5: 5`, `tarZ7: 7`).
- **Main**: Lee `INFO.envioGratis`, `INFO.pedidoMin` e `INFO.tarZ*` del almacenamiento compartido; si falta, recurre a su propio `INFO_DEFAULT`.
- **Chatbot**: Linea 260:
  `const fee = s.modal === 'delivery' && sub < 70 ? 3 : 0;`
  **Grave desalineacion**: El Chatbot tiene cableada una tarifa plana de S/ 3.00 si el pedido es menor a S/ 70.00. No reconoce las zonas de reparto de S/ 2, S/ 4, S/ 5 ni S/ 7, ni valida el pedido minimo de S/ 14.50.

### 5.3 Horarios del Local
- **Admin**:
  - Estructura programable `HDEF()`: lunes a domingo de `14:00` a `22:00`.
  - Cadena de texto fija en `INFO_DEFAULT`: `'Lunes a Domingo de 2:00 pm a 10:00 pm'`.
- **Main**:
  - Cadena estatica en `INFO_DEFAULT`: `'Todos los días, de 2:00 pm a 10:00 pm'`.
  - Generador dinamico `schedText(horarioOf(INFO))` que sobreescribe la propiedad en tiempo de ejecucion.
- **Riesgo**: Si un usuario cambia el horario en la interfaz grafica pero solo edita los dias en el selector, los textos informativos fijos pueden mostrar datos contradictorios si no se recalculan de forma unificada.

### 5.4 Telefonos y Datos de Contacto
- **Admin**: `telefono: '9XX XXX XXX (ejemplo)'`, `whatsapp: '51900000000'`, `correoDueno: 'dueno@caprichos.pe'`, `grupoWhatsapp: 'Equipo Caprichos'`.
- **Main**: `telefono: '9XX XXX XXX'`, `whatsapp: '51900000000'`. Ademas, incluye un telefono de prueba cableado para autocompletado: `const MEM_PHONE = '999888777'; const MEM_ADDR = 'Av. Los Jazmines 123, Campoy';`.
- **Chatbot**: `yape: '9XX XXX XXX (ejemplo)'`, `plin: '9XX XXX XXX (ejemplo)'`, `telefono: '9XX XXX XXX'`.

### 5.5 Porcentaje de Descuento y Plazo de Creditos de Personal
- **Configuracion**: En Admin existe el formulario de credito (`credLoad()`) con `pct: '25'` y `days: '15'`.
- **Valores fijos en codigo (`Admin.dc.html:4517`)**:
  `moStaffNote: mo && mo.who === 'personal' ? 'Pedido del personal: al cobrar a crédito se descuenta 25 %. Pagarías ' + fmt(Math.round((moNet + moFee) * 75) / 100) ...`
  El calculo del total a pagar aplica directamente `* 75 / 100` en lugar de usar `(100 - Number(s.credCfg.pct)) / 100`. Si el administrador actualiza el descuento al 30 %, el texto informativo continuara cobrando con el 25 % fijo.
- **Textos de tablas**: Linea 3195 describe la tabla con `'hasta 15 días para pagar y 25 % de descuento'` como texto estatico.

### 5.6 Tiempo Estandar de Entrega (13 Minutos)
- El valor `13 min` aparece cableado como numero magico en:
  - `Admin.dc.html` (indicadores, KDS color warning a los 13 min).
  - `Main.dc.html:1482`: `'Entrega en unos 13 min'` y `'Alta demanda: entrega en unos ' + (13 + extra) + ' min'`.
  - `Chatbot.dc.html:142`: `'la entrega está tardando unos ' + (13 + extra) + ' minutos'`.
  - Documentacion: `BRD.md` y `modulos-y-roles.md` ("meta de 13 minutos").
- No existe en `Configuración del local` ningun campo para alterar el tiempo base de preparacion (por ejemplo si un dia lluvioso o concurrido la base pasa a 20 min).

---

## 6. Registro Detallado de Hallazgos

### D-01: Disparidad de nombres en modalidades de atencion entre canales
- **Tipo**: Discordancia
- **Donde esta cada lado**:
  - `fuente/Admin.dc.html`: `const MODAL = { delivery: 'Delivery', llevar: 'Para llevar', local: 'En mesa' };` y `CANAL_V.local = 'En el local'`
  - `fuente/Main.dc.html`: `const MODALS = [ { id: 'delivery', n: 'Delivery' }, { id: 'llevar', n: 'Para recoger' } ];`
  - `fuente/Chatbot.dc.html`: `const MODALS = [ { id: 'delivery', n: 'Delivery' }, { id: 'llevar', n: 'Para recoger' } ];`
  - `docs/flujo-de-pedidos.md`: "En el local (mesa) / Delivery o para recoger"
- **Por que importa**: Genera confusion operativa en cocina, reportes contables y experiencia de usuario al referirse a la misma modalidad como "En mesa", "En el local", "Salón", "Para llevar" o "Para recoger".
- **Prioridad**: Alta
- **Propuesta de arreglo**: Adoptar universalmente las tres etiquetas oficiales: "En mesa", "Para recoger" y "Delivery".
- **Estado**: CONFIRMADO (citas textuales en codigo y docs).

---

### D-02: Conflicto entre areas de produccion KDS y estaciones de pantallas
- **Tipo**: Discordancia
- **Donde esta cada lado**:
  - `fuente/Admin.dc.html`: KDS usa `kareaChips = [ ['todas', 'Todas'], ['bebidas', 'Bebidas'], ['postres', 'Postres'], ['salados', 'Salados'] ]`; pero en Pantallas usa `opts: ['Cocina y barra', 'Solo barra', 'Solo cocina']`
  - `docs/pantalla-cocina.md`: "Separación por estación (cocina, barra)"
  - `docs/acta-02-descubrimiento.md`: Kevin Rosales indica: "tenemos el área de salados, postres y bebidas, esas tres áreas de producción"
- **Por que importa**: En un Smart TV configurado como "Solo cocina" no queda claro tecnicamente si mostrara Salados, Postres o ambos, rompiendo el requerimiento expreso del cliente en el Acta 02 de independizar la pantalla de Postres para no saturarla.
- **Prioridad**: Alta
- **Propuesta de arreglo**: Homogeneizar las pantallas de TV y los filtros KDS a las tres estaciones reales del negocio: "Bebidas", "Postres" y "Salados".
- **Estado**: CONFIRMADO (citas en Admin, acta 02 y pantalla-cocina.md).

---

### D-03: Inexistencia de estado 'anulado' y contradiccion con 'rechazado'
- **Tipo**: Flujo
- **Donde esta cada lado**:
  - `fuente/Admin.dc.html`: Dialogo titula "Anular pedido", pero la accion ejecuta: `this.setOrder(s.sel, { status: 'rechazado', anulado: { motivo: ... } })` y `STATUS` carece de clave `anulado`.
  - `docs/flujo-de-pedidos.md`: Especifica como estados separados "rechazado" (previo a confirmacion) y "anulado" (posterior a cocina).
- **Por que importa**: Un pedido rechazado por falta de respuesta del cliente se mezcla estadisticamente con un pedido anulado por merma o error de preparacion en cocina, distorsionando reportes y auditorias de caja.
- **Prioridad**: Alta
- **Propuesta de arreglo**: Agregar el estado explicito `anulado: { l: 'Anulado', bg: '#B2500F', fg: '#FFFFFF' }` en el objeto `STATUS` y transicionar a el al anular.
- **Estado**: CONFIRMADO (revisado en Admin:2451 y Admin:4515).

---

### D-04: Perdida total de pedidos y movimientos al recargar por falta de persistencia
- **Tipo**: Hueco
- **Donde esta cada lado**:
  - `fuente/Admin.dc.html`: En constructor (linea 3261), `orders`, `stock` y `movAdded` se inicializan en memoria (`SEED`, `{}`, `[]`) y jamas se guardan en `writeCfg` ni `localStorage`.
- **Por que importa**: Si el navegador de la caja o el KDS se recarga accidentalmente, todos los pedidos tomados durante el turno, pagos registrados y salidas de stock desaparecen de inmediato.
- **Prioridad**: Alta
- **Propuesta de arreglo**: Persistir `orders`, `stock` y `movAdded` en la base de datos centralizada con sincronizacion en tiempo real.
- **Estado**: CONFIRMADO (verificado que no existe `writeCfg` para orders ni stock).

---

### D-05: Omision total del rol Produccion en la documentacion de modulos y roles
- **Tipo**: Hueco
- **Donde esta cada lado**:
  - `fuente/Admin.dc.html`: `produccion: { n: 'Producción', user: 'prod01', views: ['escritorio', 'almacen', 'stock', 'notificaciones'], manage: true }`
  - `docs/modulos-y-roles.md`: Seccion 3 y Seccion 4 resumen de acceso listan unicamente 7 roles, ignorando a Produccion.
  - `docs/BRD.md`: "siete roles (administrador, cajero, cocina y barra, mozo, call center, almacén, repartidor)"
- **Por que importa**: El equipo de desarrollo y el cliente carecen de una especificacion formal sobre que facultades tiene el encargado de produccion y que modulos audita.
- **Prioridad**: Media
- **Propuesta de arreglo**: Incorporar el rol "Producción" en `docs/modulos-y-roles.md` y actualizar la cifra del BRD a 8 roles.
- **Estado**: CONFIRMADO (cotejo directo entre Admin:3177 y modulos-y-roles.md:111).

---

### D-06: Brecha de seguridad en edicion de precios por el rol Mozo
- **Tipo**: Discordancia
- **Donde esta cada lado**:
  - `fuente/Admin.dc.html`: En vista `productos`, `p.edit` se habilita a cualquiera que tenga acceso a la vista. Como `mozo` tiene `productos` en sus `views`, puede pulsar Editar, abrir el dialogo y modificar el precio guardando en `pover` (`Admin:3405, 3968`).
  - `docs/modulos-y-roles.md`: Administrador es el "Único que cambia la carta... y precios".
- **Por que importa**: Un trabajador con rol de mozo podria rebajar los precios de venta de cualquier producto desde su tablet.
- **Prioridad**: Alta
- **Propuesta de arreglo**: Bloquear el boton de edicion de productos verificando estrictamente `s.role === 'admin'`.
- **Estado**: CONFIRMADO (revisado en Admin:3405 y Admin:3968).

---

### D-07: Inconsistencia en tamano extra de bebidas (20 oz frente a 21 oz)
- **Tipo**: Discordancia
- **Donde esta cada lado**:
  - `fuente/Admin.dc.html` y `fuente/Main.dc.html`: Combo Dúo Para Compartir define `Extra 20 oz`, mientras Dúo Irresistible, Frozen y la constante global `T3` definen `Extra 21 oz`.
  - `docs/combos-y-opciones.md`: Texto descriptivo cita "Extra 20 oz".
- **Por que importa**: Descuadra las compras y stock de vasos en almacen (no se sabe si comprar vasos de 20 oz o 21 oz) y genera etiquetas de comanda dispares.
- **Prioridad**: Media
- **Propuesta de arreglo**: Estandarizar a nivel de toda la carta el tamano grande de bebidas frias a "Extra 21 oz" y corregir la definicion del Dúo Para Compartir.
- **Estado**: CONFIRMADO (citas en Admin:2482, Admin:2487 y Main:955).

---

### D-08: Tarifa plana fija y desalineada en Chatbot frente a tarifas por zona
- **Tipo**: Fijo en codigo
- **Donde esta cada lado**:
  - `fuente/Chatbot.dc.html`: `const fee = s.modal === 'delivery' && sub < 70 ? 3 : 0;`
  - `fuente/Admin.dc.html` y `fuente/Main.dc.html`: Tarifas escalonadas `tarZ2: 2, tarZ3: 3, tarZ4: 4, tarZ5: 5, tarZ7: 7`.
- **Por que importa**: Un cliente que pide por WhatsApp a Campoy zona 7 pagara S/ 3.00 en vez de S/ 7.00, ocasionando perdidas directas de margen de reparto.
- **Prioridad**: Alta
- **Propuesta de arreglo**: Hacer que el Chatbot consulte la zona detectada por GPS/direccion contra la matriz tarifaria de `info.tarZ*`.
- **Estado**: CONFIRMADO (revisado en Chatbot:260).

---

### D-09: Descuento de credito de personal cableado en 25 % ignora configuracion
- **Tipo**: Fijo en codigo
- **Donde esta cada lado**:
  - `fuente/Admin.dc.html`: Linea 4517 aplica `* 75 / 100` en lugar de `(100 - credCfg.pct) / 100`.
- **Por que importa**: El modulo de administracion de creditos permite configurar el porcentaje de descuento del personal, pero el pedido de mozo no lo respeta y mantiene el 25 % cableado.
- **Prioridad**: Media
- **Propuesta de arreglo**: Reemplazar el factor multiplicador `75` por `(100 - Number(s.credCfg.pct || 25))`.
- **Estado**: CONFIRMADO (revisado en Admin:4517).

---

### D-10: Catalogo e intermediarios de pago recortados en el simulador del Chatbot
- **Tipo**: Hueco
- **Donde esta cada lado**:
  - `fuente/Chatbot.dc.html`: Contiene unicamente 4 categorias de productos y 3 medios de pago (`Efectivo`, `Yape`, `Plin`).
  - `fuente/Admin.dc.html`: Contiene 9 categorias de carta y 5 medios de pago (incluyendo `Tarjeta` y `Transferencia`).
- **Por que importa**: El simulador del chatbot no permite probar pedidos de combos, tortas, bebidas iced ni pagos con tarjeta contra entrega.
- **Prioridad**: Media
- **Propuesta de arreglo**: Conectar el simulador de chatbot a la carta unificada compartida en `caprichos_carta_cfg_v1`.
- **Estado**: CONFIRMADO (revisado en Chatbot:112 y Chatbot:291).

---

INFORME LISTO

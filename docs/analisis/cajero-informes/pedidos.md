---
id: ANA-CAP-019
tipo: analisis
titulo: "Informe de análisis funcional: Módulo de Pedidos y Caja (Rol Cajero)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, cajero-informes]
---

# Informe de análisis funcional: Módulo de Pedidos y Caja (Rol Cajero)

## 1 Lo que el cajero YA puede hacer en el mockup en este modulo (con evidencia: lineas o funciones)

En el archivo principal del mockup (`/tmp/claude-1000/cajero-agy/fuente/Admin.dc.html`), el cajero cuenta con acceso operativo a la vista de Pedidos y Caja (`view === 'caja'`, evaluado a través de `ROLES.cajero`, línea 2667). En esta interfaz, el cajero puede realizar las siguientes acciones funcionales comprobables en el código:

1. **Gestión de la lista de pedidos mediante pestañas**:
   - Visualizar las órdenes distribuidas en tres pestañas operativas (`tabs`, líneas 230-233, 3045):
     - **Por confirmar** (`nuevo`): pedidos entrantes desde la carta web o chatbot que requieren contacto previo (función de agrupación `groups.nuevo`, línea 2785).
     - **En curso** (`curso`): pedidos comandados que están en cola, preparación, listos o en reparto (`['cola', 'prep', 'listo', 'ruta']`, línea 2786).
     - **Cerrados** (`cerrado`): pedidos entregados o rechazados (`['entregado', 'rechazado']`, línea 2787).
   - En cada tarjeta de la lista izquierda (`orderList`, líneas 268-277, 3054-3058), el cajero visualiza: código de pedido (ej. `CP-0101`), insignia de estado con color diferenciado (`stLabel`, `stBg`, `stFg`), canal de venta (`Web`, `WhatsApp`, `Mozo`, `Caja`), modalidad (`Delivery`, `Para llevar`, `En mesa`), nombre del cliente, resumen condensado de productos (`summary`) y monto total formateado en soles (`fmt(total)`).
   - El cajero selecciona cualquier pedido con un clic (`o.pick`, línea 269) para cargar su detalle integral en la columna derecha (`sel`, líneas 291-427, 3144-3159).

2. **Búsqueda y filtrado multicriterio de órdenes**:
   - Búsqueda en vivo por texto mediante el campo `#ord-q` (líneas 236-237), que evalúa coincidencias instantáneas sobre el código del pedido o el nombre del cliente (`ordq`, línea 3048).
   - Panel desplegable de filtros avanzados activado mediante el botón `Filtros` (`fcToggle`, línea 238), que incluye indicador numérico de filtros activos (`fcN`, línea 238) y resumen textual de lo que se está filtrando (`fcSum`, línea 240).
   - Tres selectores desplegables independientes (`fcGroups`, líneas 242-257, 3472-3481, 3693):
     - **Canal**: `Todos`, `Web`, `WhatsApp`, `Mozo`, `Caja`.
     - **Modalidad**: `Todas`, `Delivery`, `Para llevar`, `En mesa`.
     - **Cobro**: `Todos`, `Cobrado`, `Pendiente`.
   - Botón directo para restablecer parámetros (`fcClear`, línea 258) y contador dinámico de pedidos resultantes (`orderCountText`, línea 261, 3851).

3. **Paginación de la cola de pedidos**:
   - Paginador posicionado en el pie de la columna izquierda (`cj-foot`, líneas 280-287).
   - Configurado a una cuota fija de 4 órdenes por página (`OPAGE = 4`, líneas 3049-3053).
   - Botones táctiles de desplazamiento `← Anterior` (`opagePrev`), selector numérico de páginas (`opageBtns`) y `Siguiente →` (`opageNext`), con atenuación visual (`opacity`) cuando se alcanza el límite.

4. **Auditoría del detalle del pedido por pestañas**:
   Al elegir un pedido, la columna derecha despliega un encabezado con datos generales (código, estado, canal, modalidad, cliente, teléfono, dirección con enlace a Google Maps en delivery, o número de mesa; líneas 293-297) y una barra de navegación con hasta 5 pestañas dinámicas (`ctabs`, línea 298, 3063):
   - **Pestaña Pedido** (`ctPedido`, líneas 301-311): muestra información de la cuenta asociada del cliente o personal si está registrado (acumulación o aplicación de puntos por DNI, línea 302, 3153), la lista pormenorizada de productos con cantidad, título y opciones seleccionadas (línea 305), y la nota especial para cocina enmarcada en recuadro destacado (líneas 308-310).
   - **Pestaña Cobro** (`ctCobro`, líneas 312-324): visualiza el medio de pago preferido, estado del cobro (`Cobrado` o `Pendiente`), alerta si el pago está por confirmar, desglose de confirmación si ya fue validado (quién lo confirmó, hora, código de operación bancaria y visualización de la captura del voucher subida; líneas 317-319), selector de tipo de comprobante mediante botones circulares (`Nota de venta`, `Boleta`, `Factura`; línea 320, 3863), botón para ver la precuenta si el pedido es de mesa (línea 321, 3865) y total general en soles (línea 322).
   - **Pestaña Ticket de cocina** (`ctTicket`, líneas 325-358): simula gráficamente la comanda física térmica en papel de 80 mm para cocina y barra (líneas 329-352) con encabezado de Caprichos, comanda, modalidad, fecha, canal, cliente, mesa o delivery, desglose de ítems, notas resaltadas, datos de pago y clave de Wi-Fi; detalla el estado de la impresión y número de copias emitidas; y dispone del botón `Reimprimir ticket` (`reprintSel`, línea 355, 3870) que incrementa el contador de reimpresiones y simula el envío a la impresora de cocina.
   - **Pestaña Etiquetas** (`ctEtiq`, líneas 359-377): visible para cualquier pedido no rechazado (línea 3063). Permite ver y controlar la emisión de tres tipos de etiquetas adhesivas térmicas:
     - *Etiqueta general del pedido* (para bolsa o bandeja de despacho, línea 366).
     - *Etiquetas por área de producción* (una por cada estación: Bebidas, Salados, Postres, línea 369).
     - *Etiqueta por bebida* (una por cada vaso, indicando ingredientes, dulce, leches y nombre del comensal, línea 373).
     - Incluye conmutadores generales para activar o desactivar la impresión de cada tipo (`lbToggles`, línea 363, 3141) y botones operativos para reimprimir de forma aislada la etiqueta general (`reprintLbGeneral`), las de área (`reprintLbAreas`) o las de vaso (`reprintLbCups`) (líneas 367, 370, 375, 3142).
   - **Pestaña Comprobante** (`ctComp`, líneas 378-397): se activa automáticamente para órdenes confirmadas o atendidas (línea 3063). Renderiza el comprobante final del cliente (`sel.comp`) y, al pie de este, dibuja una línea de corte con tijera (`- - - cortar aquí - - -`) donde estampa hasta 2 cupones de descuento promocionales activos (`receiptCoupons`, líneas 390-391, 3059-3061) con su código (ej. `DUO20-0102`), porcentaje o rebaja, vigencia calculada y texto legal. Dispone del botón interactivo `Imprimir comprobante con cupones` (`printReceipt`, línea 393, 3868), el cual contabiliza los cupones emitidos en la base de datos de cupones, genera una entrada en la bitácora de auditoría (`couponLog`) y confirma la acción en pantalla.

5. **Confirmación de pagos en pedidos remotos (fuera del local)**:
   - Para pedidos web o de WhatsApp en estado nuevo, se habilita el botón `Confirmar pedido y pago` (`openPc`, líneas 404, 3075), accesible para el cajero (`canConfirmPay`, línea 3154).
   - Despliega la ventana modal asistida `isPc` (líneas 1984-2006):
     - **Paso 1 (Comunicación)**: muestra el resumen preformateado del pedido (`pcText`, línea 1991), ofrece el botón directo `Abrir WhatsApp con el cliente` mediante enlace oficial `wa.me` (línea 1992) y exige marcar obligatoriamente la casilla de confirmación *"Ya hablé con el cliente y el pedido está bien"* (`toggleContacted`, línea 1993, 3077).
     - **Paso 2 (Medio de pago)**: selector de medio de pago con 5 alternativas (`Efectivo`, `Yape`, `Plin`, `Transferencia`, `Tarjeta`; líneas 1995, 3065). Si es efectivo, permite anotar con cuánto abona el cliente para calcular el vuelto (línea 1996). Si es Yape, Plin o Transferencia, habilita el campo de código de operación (línea 1998) y exige la carga del archivo de imagen del comprobante de pago (`pcPickImg`, líneas 1999-2001, 3078).
     - **Paso 3 (Confirmación y comanda)**: al presionar `Confirmar y enviar a cocina` (`pcConfirm`, línea 2004, 3076-3079), el pedido pasa a estado comanda en cocina (`cola`), se descuentan los insumos en almacén (`acceptEffects`), queda registrado con la marca temporal y el nombre del cajero (`payBy: 'Cajero'`, `payAt: '21:40'`), y la imagen del voucher queda archivada en la pestaña Cobro.

6. **Rechazo de órdenes**:
   - Botón `Rechazar` (`rejectSel`, líneas 405, 413, 3871), visible en pedidos en estado nuevo.
   - Solicita confirmación de seguridad *"¿Rechazar el pedido CP-XXXX? El cliente será avisado de que no se atenderá"*.
   - Al aceptar, actualiza el estado a `rechazado` (línea 3871). La orden pasa a la pestaña Cerrados, se bloquea la emisión de comprobantes y etiquetas, y el ticket de cocina se inhabilita indicando que no se imprimirá (línea 3156).

7. **Registro de cobro ordinario**:
   - Botón `Registrar cobro` (`collectSel`, líneas 417, 3872), habilitado en pedidos que ya están en proceso y no han sido cancelados ni cobrados (`canCollect`, línea 3157).
   - Solicita confirmación en ventana emergente y conmuta la bandera a cobrado (`paid: true`, línea 3872). Si el pedido tenía asociada una cuenta de cliente con DNI, acumula automáticamente 1 punto por cada sol consumido en la base de clientes (`setOrder`, línea 2772).

8. **Liquidación mediante Crédito del Personal**:
   - Botón `Cobrar a crédito del personal` (`openCr`, líneas 418, 3584).
   - Abre la ventana modal `isCr` (líneas 1783-1792):
     - Despliega la nómina de trabajadores del restaurante (`crStaff`, lista `STAFF`, línea 3585).
     - Calcula de forma automática el descuento de personal (25 % sobre productos elegibles, excluyendo combos y promociones; `crLines`, línea 3586).
     - Determina el monto neto a cobrar y fija la fecha de vencimiento a 15 días calendario.
     - Al confirmar con `Cobrar a crédito` (`crConfirm`, línea 3582), marca el pedido como pagado con medio `Crédito del personal`, descuenta el total y registra la cuenta por cobrar en el módulo de Créditos (`credAdded`, línea 3582).

9. **Despacho final y cierre de pedidos en local y para llevar**:
   - Botón `Entregar al cliente y cerrar` (`deliverSel`, líneas 421, 3873), activo cuando el pedido está listo en cocina y la modalidad es salón o mostrador (`!isDelivery`, línea 3158).
   - Marca simultáneamente el pedido como entregado y cobrado (`status: 'entregado'`, `paid: true`), cerrando su ciclo de vida.

10. **Apertura y registro de pedidos desde caja**:
    - El cajero dispone de los botones superiores `Nuevo pedido` (`openMo`) y `Pedido del personal` (`openMoStaff`) (líneas 228, 3768).
    - Puede iniciar la comanda seleccionando la modalidad: salón (con plano de mesas interactivo, selector de pisos e indicación de mesas libres, ocupadas y reservadas; líneas 1678-1692), para llevar, delivery (con buscador geográfico por OpenStreetMap/Nominatim y pin cartográfico; líneas 1639-1653) o reserva.
    - Selecciona platos del catálogo con configurador de variantes, tamaños, modificadores y notas (`isCfg`, líneas 1758-1780).
    - Asocia la orden a un cliente invitado, busca por DNI para sumar puntos, realiza el registro express de comensales nuevos sin contraseña (líneas 1733-1739) o selecciona a un colaborador si es pedido del personal.

---

## 2 Lo que hace restaurant.pe en este modulo (resumen propio, con el archivo de REFERENCIA que lo respalda)

De acuerdo con los documentos de auditoría de restaurant.pe en producción (`ventas.md`, `delivery.md`, `consolidado-reunion.md`, `clientes.md`, `promos.md` y `creditos.md`), el flujo de atención, pedidos y caja en el sistema de referencia opera bajo los siguientes estándares:

1. **Gestión integral de salones y mapa de mesas táctil** (`ventas.md`, §2 y §3):
   - Muestra las mesas organizadas por salones con codificación visual de colores en tiempo real: verde (libre), rojo/naranja (ocupada) e ícono distintivo de campana para mesas que han solicitado la precuenta física o mediante código QR desde el celular del comensal (`ventas.md`, líneas 35-39).
   - Permite alternar la información visible en la tarjeta de cada mesa entre el tiempo transcurrido desde la apertura (en minutos) y la cantidad de personas sentadas (`ventas.md`, líneas 57-59).
   - Identifica y alerta sobre mesas que tienen productos seleccionados en borrador que aún no han sido comandados a las ticketeras de producción (`obtenerMesasConPedidosPendientesDeEnvio`, línea 66).

2. **División de cuentas (*Split bill*) y traslado de mesas** (`ventas.md`, §3.2, §3.3; `consolidado-reunion.md`, §13.1):
   - En cualquier momento antes del cobro, el sistema permite separar una comanda en múltiples subcuentas (`C1`, `C2`, etc.) mediante cuatro modalidades: por platos individuales consumidos, en partes iguales (equitativa), por montos monetarios específicos o por porcentajes de consumo (`consolidado-reunion.md`, línea 236; `ventas.md`, líneas 100, 116).
   - Soporta el traslado parcial o total de comandas de una mesa a otra (`moverPedidos`, línea 132) si los comensales deciden cambiar de ubicación física en el restaurante.
   - Permite emitir precuentas térmicas independientes para cada subcuenta antes de que el cajero efectúe el cobro formal (`ventas.md`, líneas 102, 113).

3. **Cobro mixto y multimoneda en caja** (`consolidado-reunion.md`, §13.1; `informes.md`, §5.2):
   - El punto de cobro admite liquidar una comanda combinando múltiples formas de pago de forma simultánea (ejemplo: cobrar una parte en efectivo con cálculo de vuelto, otra parte con tarjeta de débito y el saldo remanente con Yape o Plin; `consolidado-reunion.md`, línea 234).
   - Dispone de teclado táctil con botonera rápida de denominaciones de billetes peruanos para agilizar el registro del dinero recibido y la entrega del cambio en ventanilla.

4. **Emisión y canje tributario oficial (SUNAT)** (`consolidado-reunion.md`, §13.1; `delivery.md`, §2, §7; `creditos.md`, §3.2):
   - Generación inmediata de Boletas de Venta Electrónicas y Facturas Electrónicas con conexión directa hacia el Proveedor de Servicios Electrónicos (PSE).
   - Validación automática de documentos peruanos: comprobación de DNI de 8 dígitos ante RENIEC y RUC de 11 dígitos con razón social y domicilio fiscal ante SUNAT (`delivery.md`, líneas 114-118).
   - Emisión de Nota de Venta interna por defecto y soporte para canjear posteriormente lotes de Notas de Venta por Boletas o Facturas consolidadas (`creditos.md`, líneas 98-102).
   - Desglose transparente de impuestos peruanos: Subtotal, Base imponible, Impuesto General a las Ventas (IGV 18%) e impuesto a las bolsas plásticas (ICBPER).
   - Detección y aplicación automática de retención o detracción tributaria para comprobantes empresariales que superen el umbral legal de S/ 700.00 (`consolidado-reunion.md`, línea 235).

5. **Tratamiento desacoplado de propinas (*Tips*)** (`consolidado-reunion.md`, §13.1; `escritorio.md`, §7; `informes.md`, §3.2, §5.2):
   - El cajero puede registrar propinas voluntarias dejadas por los comensales tanto en efectivo como cargadas al voucher de la tarjeta o billetera digital (`venta_propina`).
   - El sistema separa estrictamente el dinero de las propinas de la venta neta del local, evitando que tribute IGV de forma incorrecta, y genera reportes específicos por mozo para la liquidación o entrega del pozo común (`informes.md`, línea 552).

6. **Descuentos comerciales y manuales controlados** (`promos.md`, §4):
   - El personal de caja o salón puede aplicar descuentos directos por mesa o por producto eligiendo motivos catalogados (Cortesía, Descuento Personal, Convenio, Queja de servicio; `promos.md`, líneas 183-195).
   - Aplica topes de monto máximo autorizado (`categoriadescuento_montomaximo`). Si el descuento solicitado excede el límite permitido para el cajero, el sistema exige la introducción de un código PIN o clave de supervisor para autorizar la rebaja (`promos.md`, línea 231).
   - Reglas de exclusión para asegurar que los descuentos no se apliquen sobre productos que ya tienen promociones u ofertas vigentes (`noafectaoferta`, línea 216).

7. **Control de anulaciones y notas de crédito auditadas** (`delivery.md`, §4, §6; `informes.md`, §3.2; `consolidado-reunion.md`, §13.1):
   - Cualquier cancelación de pedido o anulación de comanda exige el registro obligatorio de una causal tipificada (`tipoproblemadelivery`, ej. error de toma, demora excesiva, queja de comensal, quiebre de stock; `delivery.md`, líneas 190, 317-321).
   - Para ventas ya facturadas o cerradas, el cajero emite Notas de Crédito o Notas de Débito electrónicas (`Notas-Credito`, `caja.md`), permitiendo la anulación total o parcial de la operación con reversión automática del inventario al kardex de almacén y generación del egreso de dinero en la gaveta de caja (`consolidado-reunion.md`, líneas 239-240).

8. **Monitoreo kanban y auditoría en Call Center / Delivery** (`delivery.md`, §4):
   - Bandeja de despachos con tarjetas interactivas que miden el ciclo de vida del reparto: tiempo transcurrido en recepción, asignación de repartidor, tiempo de cocción en barra/cocina y tiempo de tránsito en ruta (`delivery.md`, líneas 361-367).

---

## 3 Diferencias y faltantes

A continuación se presenta la matriz de brechas funcionales entre lo que el cajero requiere operar según la referencia de restaurant.pe y lo que actualmente permite la vista `caja` del mockup:

| Qué falta o está mal | Dónde se ve | Por qué importa | Gravedad |
| :--- | :--- | :--- | :--- |
| **No existe interfaz para cobrar: el cobro se marca a ciegas** | `Admin.dc.html`, línea 417 (botón `collectSel`) y línea 3872 (`setOrder(id, { paid: true })`) | Al presionar "Registrar cobro", el sistema marca el pedido como cobrado inmediatamente sin abrir ninguna pantalla para elegir el medio de pago real, sin recibir el dinero, sin calcular el vuelto y sin registrar el número de operación. En un restaurante el cliente frecuentemente decide cómo pagar al llegar a caja. | **Alta** |
| **No existe cobro mixto (pagos combinados)** | `Admin.dc.html`, modelo `orders` (línea 2074) y vista de cobro (línea 314); solo existe un campo simple de texto `pay` | En la vida real es cotidiano que una cuenta se pague con dos medios distintos (ejemplo: S/ 30.00 en efectivo y S/ 22.50 con Yape, o dos tarjetas). El mockup no permite registrar más de un medio por pedido. | **Alta** |
| **No existe división de cuentas (*Split bill*)** | Vista `caja`, detalle del pedido y precuenta (líneas 301-324) | Si un grupo de personas en una mesa pide pagar sus consumos por separado, el cajero no tiene forma de dividir los productos ni los montos en subcuentas (`C1`, `C2`) para emitir comprobantes independientes. | **Alta** |
| **No existen anulaciones de pedidos cobrados ni Notas de Crédito** | Vista `caja`; la acción `rejectSel` (línea 3871) solo funciona en pedidos con estado `nuevo` | Si un cliente cancela un pedido que ya está en preparación, o si devuelve un producto después de cobrar, el cajero no tiene ningún botón para anularlo, anular el comprobante o registrar la devolución del dinero. | **Alta** |
| **Falta captura de datos fiscales para Boletas y Facturas** | `Admin.dc.html`, chips de comprobante (línea 320, 3863) | Al conmutar el chip de "Nota de venta" a "Boleta" o "Factura", no se solicita el número de RUC (11 dígitos), razón social ni domicilio fiscal de la empresa, lo que impide emitir comprobantes válidos para SUNAT. | **Alta** |
| **No permite cambio de mesa en pedidos ya abiertos** | Vista `caja`, detalle del pedido en salón (líneas 297, 301) | El botón "Cambiar mesa" solo existe durante la toma del pedido en `Nuevo pedido` (línea 1694). Si los clientes se mudan de mesa cuando ya están consumiendo, el cajero no puede actualizar la mesa en el pedido abierto. | **Media** |
| **No permite modificar el medio de pago de una comanda abierta** | Vista `caja`, pestaña `Cobro` (línea 314) | El medio de pago se muestra como un texto fijo (`sel.pay`). Si el comensal dijo inicialmente "efectivo" pero al momento de pagar entrega una tarjeta o escanea el QR de Plin, el cajero no tiene opción para corregirlo. | **Media** |
| **No existe registro de propinas** | Pestañas `Cobro`, `Ticket` y `Comprobante` (líneas 312-398) | Las propinas dejadas al cajero o al personal no se pueden ingresar. Si entran por tarjeta o billetera digital, se mezclarían erróneamente con la venta gravada del negocio o no se podrían cuadrar. | **Media** |
| **No existen descuentos manuales ni cortesías en caja** | Pestaña `Cobro` (líneas 312-324) | Solo existe el descuento fijo de crédito de personal (25%) y las promociones automáticas de la carta. El cajero no puede aplicar una cortesía, rebaja por convenio ni compensación por queja directamente en el punto de cobro. | **Media** |
| **La precuenta no se puede imprimir físicamente** | Modal `isPre` (líneas 1605-1618) | La ventana de precuenta solo tiene un botón "Cerrar" (línea 1617). No existe botón de "Imprimir precuenta" hacia la ticketera de salón para llevarle el papel impreso a la mesa antes de cobrar. | **Media** |
| **El rechazo de pedidos no solicita motivo obligatorio** | Función `rejectSel` (línea 3871) | Al rechazar un pedido nuevo, el sistema no pide seleccionar una causa (fuera de zona, sin insumos, cliente desistió), perdiendo el registro de control administrativo exigido por restaurant.pe. | **Media** |
| **No hay selector de cantidad de registros por página** | Barra de paginación (líneas 280-287, 3049) | La paginación está fijada estrictamente en 4 pedidos por pantalla. En momentos de alta demanda (horas punta), el cajero tiene que navegar entre demasiadas páginas para ver sus pedidos activos. | **Baja** |

---

## 4 Errores o incoherencias que veas en el mockup (botones que no hacen nada, textos viejos, reglas contradictorias con flujo-de-pedidos.md, permisos que no corresponden al cajero)

Durante la inspección estática del código fuente de `Admin.dc.html` y su contraste con `flujo-de-pedidos.md` y `modulos-y-roles.md`, se identificaron los siguientes errores técnicos e incoherencias de negocio:

1. **Subtítulo del módulo con regla de negocio obsoleta y contradictoria**:
   - *Ubicación*: `Admin.dc.html`, línea 2838:
     ```javascript
     caja: ['Pedidos y caja', 'El cajero verifica cada pedido y lo acepta antes de que pase a cocina.']
     ```
   - *Incoherencia*: Este texto describe el flujo antiguo previo a la reunión del 18/10/2026. Según `flujo-de-pedidos.md` (§1 y §4) y la regla `RN-CAP-073` del BRD, los pedidos tomados por los mozos en el local van **directo a cocina sin pasar por caja**. Mantener ese texto confunde al usuario haciéndole creer que debe aceptar los pedidos de las mesas.

2. **Etiqueta engañosa en el botón de confirmación de pedido de mesa**:
   - *Ubicación*: `Admin.dc.html`, línea 1750 (dentro del modal de toma de pedidos `isMoItems`):
     ```html
     <button onClick="{{sendMo}}" ...>Enviar a caja</button>
     ```
   - *Incoherencia*: El botón dice textualmente "Enviar a caja". Sin embargo, al inspeccionar la función `sendMo` (línea 3320-3322), el código evalúa `m.modal === 'local'` e inserta el pedido con `status: 'cola'` (directo a cocina) ejecutando `acceptEffects` (impresión inmediata de comanda y descuento de stock). El botón debería llamarse **"Enviar a cocina"** cuando se trata de una mesa.

3. **Botón huérfano / código muerto de aceptación de pedidos de mesa**:
   - *Ubicación*: `Admin.dc.html`, líneas 409-415:
     ```html
     <sc-if value="{{sel.canAccept}}" ...>
       ...
       <button onClick="{{acceptSel}}" ...>Aceptar y enviar a cocina</button>
     ```
   - *Incoherencia*: En la línea 3154, la condición es:
     ```javascript
     canAccept: selOrder.status === 'nuevo' && selOrder.modal === 'local' && canManage
     ```
     Dado que la función `sendMo` ahora crea los pedidos de mesa directamente en estado `cola`, **ningún pedido de salón se crea en estado `nuevo`**. Por su parte, los pedidos fuera del local usan la condición `canConfirmPay` con el botón "Confirmar pedido y pago". Por lo tanto, el botón `acceptSel` ha quedado como código muerto o remanente. Además, su texto de ayuda asociado (línea 410) indica: *"Verifica el pedido. Solo después de aceptarlo pasa a las pantallas de cocina y empiezan a correr los tiempos"*, regla que fue expresamente derogada para pedidos en el local.

4. **Botón de precuenta que no realiza ninguna acción física**:
   - *Ubicación*: `Admin.dc.html`, línea 321 y líneas 1605-1618 (`isPre`).
   - *Incoherencia*: El botón `Sacar precuenta (el cajero cobra)` abre una ventana emergente que dibuja el ticket con un código QR simulado, pero dentro de dicha modal **solo existe un botón para cerrar** (`closePre`, línea 1617). No existe botón de imprimir ni función que envíe la orden a la impresora térmica, dejando la acción incompleta para la operación física.

5. **Botón de desarrollo expuesto directamente en la pantalla de trabajo del cajero**:
   - *Ubicación*: `Admin.dc.html`, línea 216:
     ```html
     <button onClick="{{newOrder}}" ...>Simular pedido nuevo desde la web</button>
     ```
   - *Incoherencia*: Se trata de un disparador de depuración que inserta órdenes ficticias de prueba en la base de datos local (`newOrder`, línea 3845). Debe ocultarse para el rol del cajero y mantenerse exclusivamente en un panel de desarrollo.

6. **Chips de comprobante no funcionales tributariamente**:
   - *Ubicación*: `Admin.dc.html`, líneas 320 y 3863-3864 (`compChips`).
   - *Incoherencia*: La función asociada solo ejecuta `this.setOrder(s.sel, { comp: n })`, cambiando únicamente el rótulo del texto. Si el cajero hace clic en "Factura", el sistema no solicita el RUC ni valida los 11 dígitos, permitiendo emitir una factura sin datos fiscales a nombre de cualquier cliente informal.

---

## 5 Propuesta concreta de mejora para el mockup (pantallas, campos, botones, reglas), priorizada

Para lograr la paridad funcional con restaurant.pe y brindar al cajero las herramientas que necesita en la operación diaria de Caprichos, se propone implementar las siguientes mejoras, ordenadas por prioridad:

### Prioridad 1 (Crítica para la operación): Modal completo de Cobro en Caja
Reemplazar la acción ciega del botón `Registrar cobro` (`collectSel`) por una ventana modal interactiva de cobranza que se abra al pulsar el botón:
- **Campos y controles**:
  - Selector de medio de pago principal con botones grandes táctiles: `Efectivo`, `Tarjeta Visa/Mastercard`, `Yape`, `Plin`, `Transferencia`, `Crédito Personal`.
  - Si se elige Efectivo:
    - Teclado numérico en pantalla y botones de billetes rápidos (`S/ 10`, `S/ 20`, `S/ 50`, `S/ 100`, `S/ 200`, `Monto exacto`).
    - Campo editable *"Paga con"* y campo automático en verde *"Vuelto a entregar"*.
  - Opción de **Cobro mixto / Dividir pago**:
    - Casilla *"Pago combinado"*: permite ingresar un monto para el Medio 1 (ej. S/ 20.00 en efectivo) y asigna automáticamente la diferencia al Medio 2 (ej. S/ 15.00 con Yape).
  - Campo opcional de **Propina voluntaria**:
    - Permite agregar propina en efectivo o con tarjeta, manteniéndola en un casillero separado del subtotal imponible.
  - Datos fiscales del comprobante:
    - Si se selecciona Boleta: campo DNI (8 dígitos) con búsqueda de cliente.
    - Si se selecciona Factura: campos obligatorios de RUC (11 dígitos), Razón Social y Dirección Fiscal.
  - Botón principal: `Confirmar cobro e imprimir comprobante`.

### Prioridad 2 (Alta): División de cuentas (*Split bill*) en mesas
- En pedidos de salón en curso, incorporar en la pestaña `Pedido` o `Cobro` el botón `Dividir cuenta`.
- **Comportamiento**:
  - Desplegar una pantalla con dos columnas (Cuenta 1 y Cuenta 2).
  - Permitir transferir ítems de una columna a otra con flechas táctiles o con un botón *"Dividir en partes iguales"*.
  - Cada cuenta genera su propio ticket de precuenta y se cobra de forma independiente, liberando la mesa únicamente cuando todas las fracciones hayan sido cobradas.

### Prioridad 3 (Alta): Traslado y cambio de mesa en pedidos abiertos
- En el encabezado del detalle de órdenes en mesa (línea 297), incorporar el botón `Mover / Cambiar mesa`.
- Al pulsarlo, abrir el mapa del salón mostrando únicamente las mesas libres del turno.
- Al elegir una mesa vacía y confirmar, el pedido transfiere su código físico a la nueva mesa, actualiza el plano y libera la mesa original sin alterar los productos ya enviados a cocina.

### Prioridad 4 (Media): Descuentos manuales autorizados en caja
- En la pestaña `Cobro`, agregar el botón `Aplicar descuento`.
- Desplegar selector de motivo: `Cortesía de la casa`, `Descuento de personal`, `Convenio institucional`, `Queja o demora en atención`.
- Selector de tipo: `Porcentaje (%)` o `Monto fijo (S/)`.
- Regla: si el descuento supera un tope predeterminado (ej. más de S/ 20.00 o más del 15%), solicitar el ingreso de PIN de supervisor o confirmación de administrador.

### Prioridad 5 (Media): Flujo de anulación auditada y devolución de pedidos
- Habilitar el botón `Anular comanda` para pedidos en preparación o listos (con confirmación y selección de motivo de cancelación obligatorio: error de mozo, demora excesiva, insumo agotado).
- Para pedidos ya cobrados en la pestaña Cerrados, incorporar la opción `Emitir Nota de Crédito / Devolución`, que permita revertir el cobro, registrar la salida del dinero de la caja y decidir si el producto regresa o no al stock (merma o retorno a vitrina).

### Prioridad 6 (Media): Limpieza de inconsistencias y adecuación al flujo 18/10
- Actualizar el subtítulo de la vista caja eliminando la frase *"verifica cada pedido y lo acepta antes de que pase a cocina"*.
- Cambiar el texto del botón en la toma de pedidos de salón de *"Enviar a caja"* a *"Enviar a cocina"*.
- Ocultar el botón de depuración *"Simular pedido nuevo desde la web"* para el rol del cajero.
- Añadir el botón `Imprimir precuenta física` en la modal `isPre` para enviar el ticket a la impresora de 80 mm.

---

## 6 Preguntas para el dueno (Kevin)

1. **Procedimiento de cobro en mostrador**: Cuando un cliente pide de forma presencial en caja para llevar, ¿se le debe cobrar de inmediato en ese mismo instante antes de preparar su pedido, o se debe enviar primero a cocina y cobrarle recién cuando su pedido esté empaquetado?
2. **Cobros combinados (pagos mixtos)**: ¿Con qué frecuencia los clientes en Caprichos solicitan pagar una sola cuenta usando dos medios de pago a la vez (por ejemplo, una parte en efectivo y otra parte mediante Yape o tarjeta)?
3. **Manejo y destino de las propinas**: ¿La cafetería permite que los clientes agreguen propinas en los pagos con tarjeta o billeteras digitales? En caso afirmativo, ¿esas propinas se entregan en efectivo al personal al cierre de cada turno o se acumulan semanal/mensualmente?
4. **Política de división de cuentas en salón**: Cuando una mesa con varios comensales solicita pagar por separado, ¿suelen pedir que la cuenta total se divida en montos iguales entre el número de personas, o exigen que a cada cliente se le cobre con exactitud lo que consumió?
5. **Autonomía del cajero para descuentos**: ¿Deseas que el cajero tenga autorización para aplicar descuentos manuales de cortesía o por compensación ante reclamos, o cualquier rebaja sobre el precio de carta debe requerir obligatoriamente tu aprobación?
6. **Manejo de anulaciones y devoluciones**: Si un comensal devuelve una bebida o un postre después de haberlo pagado, ¿cómo proceden habitualmente en el local (se le cambia por otro producto del mismo valor, se le entrega nota de crédito o se le devuelve el dinero en efectivo)?

---

## 7 NO VERIFICADO

- **NO VERIFICADO**: No se pudo comprobar el enlace ni la respuesta física con ticketeras térmicas reales (protocolo ESC/POS sobre red IP `192.168.1.201:9100` o conexión USB/Bluetooth), debido a que el análisis es estrictamente estático y el mockup opera con simulaciones de interfaz en memoria (`prints`, `rcMsg`, `lbMsg`).
- **NO VERIFICADO**: No se pudo verificar la integración con los servicios web de consulta en línea de SUNAT ni RENIEC para la validación automática de documentos DNI y RUC, al tratarse de un prototipo frontend sin backend activo ni credenciales tributarias configuradas.
- **NO VERIFICADO**: No se pudo comprobar la existencia de comunicación electrónica bidireccional con terminales de pago Smart POS físicos (Niubiz o Izipay) en el punto de venta de Caprichos, desconociendo si los terminales operan de forma independiente digitando el monto a mano o si están integrados a la computadora de caja.
- **NO VERIFICADO**: No se pudo verificar si los mozos en salón cuentan con claves de identificación individual o PIN al ingresar pedidos en sus tablets, o si todos los terminales de salón operan bajo una sesión compartida abierta.

INFORME LISTO.

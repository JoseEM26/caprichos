---
id: ANA-CAP-013
tipo: analisis
titulo: "Documentacion Funcional: Modulo de Caja en Restaurant.pe"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, caja-informes]
---

# Documentacion Funcional: Modulo de Caja en Restaurant.pe

Este documento describe la estructura funcional, flujos operativos, componentes visuales y reglas de negocio del modulo de Caja de la plataforma Restaurant.pe (version 7.0.1 produccion). El objetivo es servir como especificacion de referencia tecnica y funcional para la replica de esta logica en el prototipo y mockup de cafeteria Caprichos (Lima, Peru).

El analisis fue realizado bajo la modalidad de estricta solo lectura, inspeccionando la aplicacion web real en ejecucion y el codigo estatico de frontend (plantillas AngularJS, controladores, servicios y modales). Todos los datos personales, identificadores reales y montos han sido anonimizados conforme a las directivas de seguridad.

---

## A) Menu y ubicacion

En la interfaz de Restaurant.pe, las funcionalidades de caja se organizan principalmente dentro del menu lateral izquierdo y se complementan con accesos en los modulos de Ajustes e Informes.

### 1. Menu Principal: "Caja"
Ruta base en aplicacion: `#!/caja`
Contiene las siguientes subpantallas y opciones directas:
- **Cobrar** (`#!/caja/cobrar/salones`): Modulo de atencion y cobro con subpestanas por canal de venta:
  - *Salones* (`#!/caja/cobrar/salones`): Mapa de mesas y cobro por salon.
  - *Delivery* (`#!/caja/cobrar/online`): Pedidos a domicilio y por telefono.
  - *Rapida* (`#!/caja/cobrar/ventarapida`): Venta rapida en mostrador/caja.
  - *Manual* (`#!/caja/cobrar/comprobantemanual`): Emision de comprobantes manuales de contingencia.
  - *Prepagos* (`#!/caja/cobrar/prepagos`): Gestion y cobro de pedidos pagados por anticipado.
  - *Barra de herramientas superior*: Botones para `Pagar creditos`, `Mover pedidos`, `Unir mesas`, `Anular ventas`, `Modificar pagos`, `Imprimir mensaje` y `Abre gaveta`.
- **Apertura y cierre** (`#!/caja/apertura-cierre`): Pantalla dinamica que cambia segun el estado actual de la caja asignada:
  - Si la caja esta cerrada: Muestra el formulario de apertura de turno con saldo inicial y tipo de cambio.
  - Si la caja esta abierta: Muestra el panel de control del turno activo, boton de verificacion obligatoria de movimientos, resumen por medio de pago, boton de arqueo fisico y boton de cierre de caja (Cierre X).
- **Cierre caja Z** (`#!/caja/cierre-caja-z`): Pantalla para el cierre general fiscal del dia o consolidacion de multiples turnos (cierres X) antes de reiniciar la jornada contable.
- **Cierres de caja** (`#!/caja/movimientos`): Pantalla de historial analitico y movimientos de la caja activa, desglose de ingresos, egresos, ventas por tipo de pago, correlativos y tabla de cierres anteriores.
- **Ingresos** (`#!/caja/ingresos`): Registro y consulta de ingresos extraordinarios de dinero en efectivo en la caja. Rutas hijas:
  - *Registrar ingreso*: `#!/caja/ingresos/registrar`
  - *Registrar debito*: `#!/caja/ingresos/registrardebito`
- **Egresos** (`#!/caja/egresos`): Registro y consulta de salidas, gastos menores y retiros de efectivo. Ruta hija:
  - *Registrar egreso*: `#!/caja/egresos/registrar`
- **Notas de credito** (`#!/caja/Notas-Credito`): Modulo de consulta y emision de notas de credito electronicas asociadas a ventas.
- **Notas de debito** (`#!/caja/Notas-Debito`): Modulo de consulta y emision de notas de debito electronicas.
- **Monitor de ventas** (`#!/caja/monitorcaja`): Tablero de control operativo en tiempo real con transacciones, ticket promedio, clientes atendidos y ventas registradas y pendientes.

### 2. Modulo de Configuracion y Ajustes asociados a Caja
Ruta base: `#!/ajustes`
- **Cajas** (`#!/ajustes/cajas`): Catalogo de cajas por sucursal, asignacion de almacen, estado (Activa/Inactiva), si factura e imprime, y si opera en modo Self Service.
- **Turnos** (`#!/ajustes/turnos`): Definicion de turnos (Nombre, Hora Inicio, Hora Fin, Estado).
- **Comprobantes** (`#!/ajustes/comprobantes`): Asignacion de comprobantes por caja (Factura, Boleta, Nota de Venta, Guia de Remision, Notas de Credito/Debito), series asignadas, correlativo actual e impresora vinculada.
- **Tarjetas** (`#!/ajustes/tarjetas`): Configuracion de pasarelas y marcas de tarjeta (Visa, Mastercard, Tarjeta general), retenciones y disponibilidad para delivery.
- **Cuentas de transferencia** (`#!/ajustes/tipotransferencia`): Catalogo de billeteras digitales y bancos (Yape, Plin, BCP, BBVA, etc.) con titular, numero de telefono o cuenta asociada.
- **Categoria Anular Venta** (`#!/ajustes/categoriaanularventa`): Catalogo de motivos tipificados para anular transacciones.
- **Usuarios** (`#!/ajustes/usuarios`): Gestion de personal, asignacion de perfiles y configuracion de matriz de permisos de caja y punto de venta.

### 3. Modulo de Informes asociados a Caja
Ruta base: `#!/informes`
- **Informes de Finanzas**:
  - *Cierres de caja*: `#!/informes/finanzas/resumen`
  - *Resumen comparativo de cierres de caja*: `#!/informes/finanzas/resumencomparativo`
  - *Ingresos extras*: `#!/informes/finanzas/ingresos`
  - *Egresos extras*: `#!/informes/finanzas/egresos`
- **Informes de Ventas**:
  - *Por forma de pago*: `#!/informes/ventas/porformadepago`
  - *Resumen de ventas por cajero*: `#!/informes/ventas/resumenventascajero`
  - *Retenciones por tarjeta*: `#!/informes/ventas/retencionportarjeta`
  - *Propinas por mozo/motorizado*: `#!/informes/ventas/propinapormozo`
  - *Pedidos anulados*: `#!/informes/ventas/pedidos-anulados`

---

## B) APERTURA de caja

La apertura es el paso obligatorio para habilitar el cobro y la emision de pedidos en la estacion de trabajo.

### 1. Elementos visuales y campos
Al ingresar a `#!/caja/apertura-cierre` con la caja cerrada, la interfaz presenta:
- **Encabezado y contexto superior**:
  - Nombre de la caja asignada a la estacion (ejemplo: "Caja Principal").
  - Identificador del usuario que ha iniciado sesion (mostrado en la barra de navegacion).
  - Nombre de la sucursal activa (ejemplo: "CAPRICHOS").
- **Bloque de ultimos movimientos (informativo)**:
  - Mensaje de estado: "Caja Principal cerrada".
  - Monto del cierre anterior: Despliega el importe final con el que cerro el turno previo (ejemplo de referencia: S/ 0.00).
  - Fecha y hora del ultimo cierre registrado.
- **Campos del formulario de apertura**:
  - **Turno** (`turno_id`): Lista desplegable que muestra los turnos activos en el sistema (ejemplo: "Turno Dia", "Turno Noche"). El sistema selecciona automaticamente el turno coincidente con la hora actual segun su programacion.
  - **Monto inicial / saldo base** (`cierrecaja_monto`): Campo de entrada numerico. Permite ingresar el fondo fijo de sencillo o cambio con el que arranca la caja. Por defecto muestra "0" y cuenta con selector de moneda ("S/").
  - **Tabla de Tipo de Cambio**: Panel ubicado al costado del formulario donde se listan las monedas extranjeras configuradas (ejemplo: Dolares americanos), con sus valores de venta, compra y fecha de ultima actualizacion. Permite actualizar el tipo de cambio del dia si el usuario tiene permiso.
- **Boton de accion**:
  - Boton principal "Abrir caja" (estilo `btn-primary btn-lg`, con icono de campana y spinner `ladda`).

### 2. Validaciones y reglas de apertura
1. **Validacion de monto inicial**: La funcion `validarMontoApertura()` verifica que el valor ingresado no sea nulo, vacio ni negativo. Se permite iniciar con S/ 0.00 si no se cuenta con fondo fijo inicial.
2. **Caja unica por estacion**: El sistema no permite abrir simultaneamente dos sesiones de caja sobre el mismo identificador de caja si la sesion anterior no fue formalmente cerrada.
3. **Cuestionario o checklist de apertura (RAT)**: El controlador invoca `existePreguntaPorAccionLocalUsuario()`. Si el local tiene habilitadas preguntas de control operativo (por ejemplo, verificacion de insumos o estado del local), se abre un modal de confirmacion con un cuestionario que el operador debe responder afirmativamente antes de permitir la apertura.
4. **Alerta de reservaciones pendientes**: El sistema ejecuta una comprobacion en segundo plano sobre reservas agendadas para el dia actual para alertar al cajero sobre compromisos comerciales previstos.
5. **Auditoria del dispositivo**: Al momento de registrar la apertura en el servidor, se almacena una huella digital o identificador del navegador/equipo (token del dispositivo) que realiza la operacion.

---

## C) COBRO de un pedido

El cobro se gestiona a traves del modal unificado de checkout (`modalcaja.view.html` y `pagos.html`), activado desde el mapa de mesas de salon, desde el modulo de venta rapida o desde delivery.

### 1. Estructura general de la pantalla de cobro
El modal presenta una distribucion dividida en tres areas clave:
- **Cabecera de identificacion del cliente**:
  - Selector de cliente (`ui-select`) con busqueda predictiva por DNI, RUC, Telefono, Nombres o Razon Social.
  - Opcion de "Anadir nuevo cliente" sin salir del flujo de cobro.
  - Opcion de "Busqueda con lector de codigo de barras".
  - Si no se asigna cliente, el sistema asigna de forma automatica "Publico general".
  - Control de lineas de credito: Si el cliente posee cuenta corriente, se despliega en tiempo real: Credito restante, Credito diario disponible y Limite de consumo asignado.
- **Selector de comprobante de pago**:
  - Botones destacados para seleccionar el tipo de documento:
    - **Boleta**: Para personas naturales con DNI o sin documento.
    - **Factura**: Exige cliente con RUC valido de 11 digitos y razon social. Incluye boton "Validar RUC" contra el servicio de consulta SUNAT.
    - **Nota de Venta**: Comprobante interno no tributario (con serie y numeracion independiente).
  - Opciones complementarias mediante casillas de verificacion:
    - *Por consumo*: Agrupa los items del pedido bajo la glosa "Por consumo" en la impresion fiscal.
    - *Marcar 0% Impuesto*: Exonera la transaccion de impuestos si aplica.
    - *Incluir guia*: Asocia una guia de remision al comprobante.
    - *Enviar correo*: Envia automaticamente la representacion impresa y el XML al cliente.
    - *Impresion con PDF*: Genera descarga directa en lugar de disparo a ticketera termica.
- **Panel financiero central**:
  - Muestra el Total a pagar (en grande, en soles y/o moneda extranjera).
  - Faltante (marcado en color rojo si el monto recibido es menor al total adeudado).
  - Vuelto (marcado en color amarillo/destacado mediante la funcion `fnGetVueltoRedondeado()`).

### 2. Medios de pago disponibles
El sistema permite el cobro a traves de las siguientes vias:
1. **Efectivo**:
   - Campo para ingresar el importe recibido.
   - Botonera de denominaciones rapidas para agilizar el ingreso (billetes de S/ 10, S/ 20, S/ 50, S/ 100 y S/ 200).
   - Selector de moneda para cobros en divisa extranjera, calculando la equivalencia a moneda nacional en base al tipo de cambio registrado.
   - Boton para anadir multiples entradas de efectivo en distintas monedas.
2. **Tarjetas (Debito / Credito)**:
   - Selector del tipo de tarjeta (Visa, Mastercard, Amex, Diners, Tarjeta General).
   - Campo para ingresar el monto a cargar a la tarjeta. El sistema valida que el monto no exceda el saldo pendiente (`fnValidarMontoTarjetaNoMayorMontoVenta`).
   - Campo para ingresar el numero de referencia, lote o codigo de voucher emitido por el POS fisico.
   - Integracion con terminales de pago electronico: Boton para enviar la transaccion a terminales POS integrados (tipo Niubiz/Izipay/Vendemas) con confirmacion de voucher.
3. **Transferencias y Billeteras Digitales**:
   - Opcion "Pago por transferencia".
   - Selector de cuenta receptora configurada en la sucursal (ejemplo: Yape, Plin, BCP Soles, BBVA, etc.).
   - Campo obligatorio para ingresar el "Codigo de operacion" o numero de referencia de la transaccion bancaria.
4. **Vales de Pago y Gift Cards**:
   - Boton "Usar un vale pago". Permite ingresar el codigo de serie o vale emitido, valida el saldo disponible y descuenta el importe.
5. **Cupones de Descuento**:
   - Campo para registrar codigos promocionales o cupones de fidelizacion, aplicando descuentos de tipo porcentaje o monto fijo.
6. **Debitos / Anticipos de Reserva**:
   - Si el pedido cuenta con un deposito previo por reservacion de mesa, el sistema permite cruzar el anticipo descontando el total pendiente.
7. **Venta al Credito**:
   - Casilla "Al credito", con especificacion de amortizacion, fecha de vencimiento y generacion de cronograma de cuotas si aplica.

### 3. Pago mixto y vuelto
- **Pago mixto**: El sistema permite combinar libremente multiples formas de pago en una sola venta (por ejemplo, una fraccion en efectivo, otra mediante Yape y el saldo restante con tarjeta). Cada medio de pago anadido se desglosa en la tabla lateral de liquidacion.
- **Calculo de vuelto**: El vuelto solo se genera a partir de excedentes en pagos en efectivo. Si el cliente paga con tarjeta o transferencia por un importe exacto, el sistema no calcula vuelto sobre dichos medios. Se aplica politica de redondeo conforme a la normativa comercial.

### 4. Propinas (Tips)
- El sistema cuenta con un modulo dedicado para registrar propinas voluntarias:
  - Selector de medio de pago de la propina: Efectivo, Tarjeta o Transferencia bancaria.
  - Destinatario: Propina para Mozo de mesa o Propina para Motorizado (en delivery).
  - El monto de la propina no forma parte de la base imponible del comprobante electronico y se contabiliza en cuentas de custodia temporal para liquidacion al personal.

### 5. Anulacion de ventas y modificacion de pagos
- **Anulacion**: Se ejecuta desde el modulo `Anular ventas` (`anularventas.html`). Permite localizar la venta por serie, correlativo o ID. Requiere seleccionar un motivo estandarizado ("Categoria Anular Venta"). Si el comprobante era fiscal (Boleta o Factura), Restaurant.pe gestiona la emision de la Nota de Credito electronica ante el PSE/SUNAT; si era Nota de Venta, anula el registro interno y reversa los inventarios.
- **Modificar pagos**: Permite corregir el medio de pago asignado a una venta ya cerrada (por ejemplo, si se marco Efectivo por error en lugar de Yape) sin necesidad de anular el comprobante de venta, garantizando la exactitud del arqueo de caja.

---

## D) MOVIMIENTOS de caja

Los movimientos de caja corresponden a las entradas y salidas de dinero en efectivo ajenas a las ventas de productos del menu.

### 1. Ingresos extras
- **Ubicacion**: `Caja > Ingresos` (`#!/caja/ingresos`).
- **Listado**: Muestra una tabla con los ingresos del turno:
  - Columnas: `Fecha de ingreso`, `Usuario`, `Categoria`, `Recibido de`, `Concepto`, `Monto` y `Acciones`.
  - Filtro por estado: `Todos`, `Activos`, `Anulados`.
- **Formulario de registro** (`#!/caja/ingresos/registrar`):
  - **Categoria** (`categoriaingreso_id`): Lista desplegable tipificada (ejemplo: "Otros", "Delivery", "Aporte de capital"). Incluye acceso al modal de gestion y creacion de categorias.
  - **Motivo** (`ingreso_motivo`): Campo de texto multilineal (`textarea`) para describir el origen o justificacion de la entrada.
  - **Recibido de** (`ingreso_aquien`): Campo de texto libre para indicar la persona, proveedor o cliente que entrega el dinero.
  - **Monto** (`ingreso_monto`): Valor numerico positivo con selector de moneda ("S/").
  - Botones: `Guardar` (color primario) y `Cancelar`.
- **Registro de Debito**: Opcion especializada para asentar pagos directos o depositos a cuentas de clientes (`registrardebito.html`).

### 2. Egresos y gastos menores
- **Ubicacion**: `Caja > Egresos` (`#!/caja/egresos`).
- **Listado**: Muestra la relacion de salidas de dinero registradas en la caja:
  - Columnas: `Fecha de egreso`, `Usuario`, `Categoria`, `Entregado a`, `Concepto`, `Monto` y `Acciones`.
  - Filtro por estado: `Todos`, `Activos`, `Anulados`.
- **Formulario de registro** (`#!/caja/egresos/registrar`):
  - **Categoria** (`categoriaegreso_id`): Lista desplegable tipificada (ejemplo: "Compras de emergencia", "Movilidad", "Pago de servicios", "Mantenimiento", "Otros").
  - **Motivo** (`egreso_motivo`): Campo de texto multilineal para detallar el gasto.
  - **Entregado a** (`egreso_aquien`): Campo de texto con el nombre del receptor del efectivo (empleado, proveedor o repartidor).
  - **Monto** (`egreso_monto`): Valor numerico positivo con selector de moneda.
  - Botones: `Guardar`, `Cancelar` y `Egresar debitos`.
- **Efecto contable en caja**:
  - Todo egreso activo resta inmediatamente del saldo en efectivo disponible en la caja.
  - No existe eliminacion fisica de registros; las operaciones erradas deben ser marcadas como "Anuladas", preservando la trazabilidad del usuario que registro y anulo el egreso.

---

## E) CIERRE de caja / arqueo

Restaurant.pe contempla dos modalidades de cierre: el **Cierre de Turno (Cierre X)** en `#!/caja/apertura-cierre` y el **Cierre Fiscal Diario (Cierre Z)** en `#!/caja/cierre-caja-z`. A continuacion se detalla el flujo integral de cierre y arqueo:

### 1. Pantalla paso a paso del Cierre X
1. **Acceso y contexto del turno**:
   - En el panel izquierdo de `#!/caja/apertura-cierre`, se muestra la ficha del turno activo: nombre de la caja, estado "Abierta", monto inicial de apertura, nombre del usuario cajero, fecha y hora de inicio, turno en curso y cotizacion de monedas extranjeras.
2. **Paso 1: Verificacion obligatoria de movimientos**:
   - Inicialmente, el boton principal de cierre se encuentra inhabilitado (`ng-disabled="!vm.verificado"`).
   - Se muestra la instruccion: "Verifica los movimientos de Caja antes de cerrarla".
   - El cajero debe presionar el boton azul `Verificar movimientos` (`fnVerificarSaldosCierreCajaConExclusionDeNotasVenta()`).
3. **Paso 2: Visualizacion de saldos esperados por sistema**:
   - Si la opcion de "Caja a ciegas" esta desactivada (`cajaAciegas == 0`), el sistema despliega la tabla comparativa de saldos calculados por el sistema:
     - `En efectivo`: Total recaudado en efectivo por cada moneda.
     - `En tarjetas`: Total cobrado con tarjetas de credito y debito.
     - `Transferencias Totales`: Total recaudado por billeteras y transferencias (Yape, Plin, BCP, etc.).
     - `Vales de pago`: Importes cobrados mediante cupones o tarjetas de regalo.
     - `Pago en linea`: Recaudacion por canales web o pasarelas online.
     - `Cupon Yape`: Descuentos o promociones asociadas a Yape.
     - `Total en caja`: Resumen final aplicando la formula estricta:
       $$\text{Total en caja} = \text{Monto Apertura} + \text{Ventas} + \text{Ingresos Extras} - \text{Egresos Extras}$$
4. **Paso 3: Arqueo fisico detallado (Modal "Registrar arqueo")**:
   - Al pulsar el boton amarillo `Registrar arqueo`, se abre la ventana emergente `arqueocaja.html` (`arqueoCajaCtrl`):
     - **Control de correlativos**: Muestra el numero inicial, numero final y total emitido en el turno para Boletas, Facturas y Notas de Venta.
     - **Control de efectivo en moneda local**:
       - *Billetes*: Tabla con filas para cada denominacion oficial (S/ 200, S/ 100, S/ 50, S/ 20, S/ 10). El cajero ingresa la cantidad de piezas y el sistema calcula el subtotal.
       - *Monedas*: Tabla con filas para monedas (S/ 5, S/ 2, S/ 1, S/ 0.50, S/ 0.20, S/ 0.10). El cajero ingresa las unidades contadas.
       - *Total Moneda Local*: Suma automatica de billetes y monedas fisicas contadas.
     - **Control de moneda extranjera**: Si se recibieron dolares u otra divisa, permite registrar la cantidad por denominacion y calcula la conversion a soles con el tipo de cambio oficial.
     - **Control de tarjetas**: Tabla donde se lista cada tarjeta. Muestra el monto calculado por el sistema (si no es a ciegas) y solicita ingresar el `Monto por tarjeta manual` (conteo de vouchers fisicos) y el numero de `Lote` del POS.
     - **Tabla resumen de Arqueo y diferencias**:
       - Fila *MANUAL*: Total de efectivo contado, total de tarjetas contado y total de venta del dia contado.
       - Fila *SISTEMA*: Totales esperados por el sistema.
       - Columnas de evaluacion:
         - *Sobrante*: Calculado automaticamente si el conteo fisico supera al sistema.
         - *Faltante*: Calculado automaticamente si el conteo fisico es inferior al sistema.
     - **Observaciones de caja y documentos**: Campo de texto amplio (`textarea`) para que el cajero documente justificaciones sobre cualquier descuadre, billetes deteriorados o incidencias.
     - Botones del modal: `Cancelar` y `Registrar arqueo` (guarda los datos del conteo).
5. **Modalidad "Caja a ciegas" (`cajaAciegas == 1`)**:
   - Si esta politica de seguridad esta activada en el restaurante, el cajero **no puede ver** los totales esperados del sistema ni en la pantalla previa ni en el arqueo.
   - El cajero unicamente ingresa las cantidades fisicas contadas en billetes, monedas y vouchers, y pulsa el boton rojo `Cuadrar caja a ciegas`. El sistema almacena el conteo sin revelar diferencias en pantalla para evitar manipulacion del efectivo.
6. **Validaciones previas al cierre final**:
   - **Pedidos pendientes o mesas ocupadas**: El sistema consulta el estado operativo mediante `vm.cajaOperacion.result_mensaje`. Si existen mesas abiertas, consumos sin facturar o pedidos en cocina sin liquidar, la interfaz presenta una alerta destacada advirtiendo la condicion.
   - **Comprobantes pendientes de envio a SUNAT**: La funcion `verificarDocumentosPendientesSunatByModal()` inspecciona si hay documentos electronicos pendientes de emision o con error de envio al PSE/SUNAT en los ultimos dias y muestra un modal de advertencia antes de cerrar.
7. **Confirmacion y post-cierre**:
   - Al presionar `Cerrar caja`, se despliega un cuadro de dialogo de confirmacion (SweetAlert): "¿Desea cerrar caja con S/ 0.00?".
   - Tras confirmar:
     - El registro del turno se marca con fecha y hora de cierre.
     - Se ejecuta el proceso automatico de liquidacion de inventario (`procesarStockVentasByCajaYLocalActual`).
     - Se dispara una notificacion automatica al administrador/gerente (`enviarNotificacionManager`).
     - La pantalla cambia de inmediato a estado "Caja cerrada".

### 2. Impresion y reportes de cierre
Al concluir el cierre o desde el historial, se activa el modal `imprimircierrecaja.html`, el cual permite configurar:
- Impresora termica de destino.
- Opciones de reporte seleccionables mediante casillas:
  - *Excluir las notas de venta* (para reporte exclusivamente tributario).
  - *Imprimir lista de ventas* (relacion detallada comprobante por comprobante).
  - *Imprimir consolidado de productos vendidos (Paloteo)*: Total de unidades despachadas de cada articulo de la carta.
  - *Imprimir consolidado de modificadores vendidos*.
  - *Excluir ventas por usuario o por area de produccion*.
  - *Imprimir detalles de marca*.
  - *Imprimir detalles de propina*.
- Exportacion de documentos de cierre:
  - Ticket termico de 80mm / 58mm.
  - Reporte en formato PDF (version V1 estandar y version V2 extendida con graficos).
  - Reporte completo en formato Excel descargable.

---

## F) HISTORIAL de cierres

El seguimiento y auditoria de los cierres ejecutados se encuentra en `Caja > Cierres de caja` (`#!/caja/movimientos`) e `Informes > Finanzas > Cierres de caja` (`#!/informes/finanzas/resumen`).

### 1. Filtros de busqueda
- Selector de Local / Sucursal.
- Selector de Caja (Todas o una caja especifica).
- Selector de Turno (Todos o un turno especifico).
- Selector de rango de fechas y horas (`daterangepicker` con fecha/hora inicio y fecha/hora fin).

### 2. Estructura y columnas de la tabla de cierres
La tabla consolida la informacion en tres columnas integradas de alta densidad informativa:
1. **Apertura**:
   - Fecha y hora de inicio del turno.
   - Nombre de la caja.
   - Identificador o huella digital del dispositivo (token de estacion).
   - Nombre completo del usuario responsable que realizo la apertura.
   - Monto inicial de apertura (en soles).
   - Descripcion del turno.
2. **Cierre**:
   - Fecha y hora exacta de ejecucion del cierre.
   - Nombre completo del usuario que efectuo el cierre.
   - Monto final acumulado en caja al momento de cerrar.
   - Descripcion del turno.
3. **Reporte / Acciones**:
   - Boton verde para descarga directa del resumen en formato **Excel**.
   - Boton desplegable para generar y visualizar el informe en **PDF** (con opciones de descarga de PDF V1 y PDF V2).
   - Boton para **Reimprimir ticket** de cierre en la ticketera termica local.
   - Boton "Imprimir paloteo": reimprime la relacion consolidada de articulos vendidos en dicho turno.
   - Boton "Eliminar ultimo cierre" (funcion restringida a perfiles de maxima jerarquia administrativa para corregir cierres accidentales).

---

## G) REPORTES de caja y ventas por medio de pago

Restaurant.pe dispone de modulos de reporteria orientados al control del dinero:

### 1. Monitor de Ventas (`#!/caja/monitorcaja`)
Tablero visual enfocado en la operacion del dia:
- **Filtros**: Local, Caja, Tipo de Comprobante (Todos, Boleta, Factura, Nota de Venta), Turno y Rango de Fechas.
- **Tarjetas de metricas (KPIs)**:
  - *N° de transacciones*: Cantidad total de comprobantes cobrados.
  - *Promedio de ventas*: Monto medio por operacion comercial.
  - *Numero de clientes*: Personas atendidas segun conteo de comensales en mesa.
  - *Ticket Promedio Cliente*: Gasto medio por comensal.
  - *Total en ventas*: Importe bruto acumulado.
- **Pestanas de detalle**:
  - *Lista de ventas*: Tabla cronologica con Fecha, Caja, Turno, Documento, Serie/Numero, Total, Tipo de venta (Contado/Credito) y Estado (Activo/Anulado).
  - *Comparativo por local*: Grafico comparativo de rendimiento entre sucursales.
  - *Deliverys pendientes por integracion*: Transacciones online por sincronizar.

### 2. Reporte "Por forma de pago" (`#!/informes/ventas/porformadepago`)
Reporte fundamental para conciliar ingresos financieros con contabilidad:
- **Filtros**: Moneda de facturacion, Local, Caja, Forma de pago (Todas, Efectivo, Tarjetas, Transferencias, Vales), Tipo de comprobante, Serie, Correlativo y Periodo de fechas.
- **Estructura de la tabla**:
  - `Fecha`: Fecha y hora de cobro.
  - `Cliente`: Nombre o razon social.
  - `Documento`: Boleta, Factura o Nota de Venta con su serie y correlativo.
  - `Pago`: Medio especifico empleado (Efectivo, Visa, Mastercard, Yape, Plin, Transferencia BCP, etc.).
  - `Total recibido`: Monto exacto cobrado mediante ese medio especifico.
  - `Tipo de venta`: Contado o Credito.
  - `Caja`: Caja donde se efectuo el cobro.
  - `Acciones`: Boton "Ver Detalles" para consultar la orden completa.
- **Totales**: Despliega el resumen final agrupado por cada medio de pago y el total global del periodo.

### 3. Reportes complementarios de finanzas
- **Reporte Cierres de caja en Finanzas** (`#!/informes/finanzas/resumen`): Tabla con Caja, Fecha Apertura, Fecha Cierre, Usuario Apertura, Usuario Cierre, Turno Apertura, Turno Cierre, Monto Apertura, Monto Cierre y botones de exportacion a Excel/PDF.
- **Reporte de Retenciones por Tarjeta** (`#!/informes/ventas/retencionportarjeta`): Calcula las comisiones y retenciones financieras aplicadas por los operadores de POS.
- **Reporte de Ventas por Cajero** (`#!/informes/ventas/resumenventascajero`): Agrupa el volumen recaudado por cada usuario operador.

---

## H) Roles y permisos

La seguridad del modulo de caja se configura a nivel de usuario en `Ajustes > Usuarios > Permisos POS` (`editar-permisopos`):

### 1. Cargos o roles base en la plataforma
- **ADMINISTRADOR**: Acceso total al sistema, configuracion de cajas, turnos, comprobantes, eliminacion de cierres, autorizacion de descuentos y arqueo gerencial.
- **CAJERO**: Responsable operativo de la estacion de cobro. Habilitado para apertura, cobro, egresos/ingresos menores y arqueo de su turno.
- **MOZO**: Rol restringido a la toma de pedidos, comandeo y solicitud de precuentas en mesas; no tiene acceso al modulo de cobro ni a los reportes financieros.
- **PRODUCCION**: Pantallas de cocina, bar y despacho; sin visibilidad del dinero ni de la caja.

### 2. Matriz de permisos especificos de Caja y POS
Cada usuario cuenta con una serie de conmutadores (checks) que regulan sus capacidades operativas en caja:
1. `Caja`: Permite al usuario visualizar los montos de ventas, ingresos, egresos y acceder a las pantallas de arqueo.
2. `Venta rapida`: Autoriza a realizar cobros directos en el mostrador.
3. `Venta salones`: Autoriza a cerrar y cobrar pedidos de mesas en salon.
4. `Venta Online`: Autoriza a gestionar cobros de pedidos de delivery.
5. `Cobrar con POS`: Permite operar pasarelas y terminales POS enlazados.
6. `Modificar pagos`: Faculta al usuario para reasignar el metodo de pago de una venta ya concluida sin anular el comprobante.
7. `Anular ventas`: Autoriza la anulacion de comprobantes y ventas cerradas.
8. `Anular pedidos`: Permite anular pedidos ya enviados a las areas de preparacion.
9. `Cambiar precios de pedidos`: Permite alterar manualmente el precio unitario de un item al momento de la venta.
10. `Aplicar descuentos`: Permite realizar descuentos en porcentaje o monto sobre el total de la cuenta.
11. `Modificar o eliminar ingresos o egresos`: Otorga permisos para editar o anular registros de gastos y entradas de caja.
12. `Imprimir paloteo o productos vendidos en el cierre de caja`: Autoriza la impresion del reporte de cantidades fisicas vendidas durante el arqueo.
13. `Reimprimir precuentas`: Permite volver a imprimir el detalle de cuenta preliminar para la mesa.

---

## I) Capturas y descripcion visual del diseno

Restaurant.pe utiliza una interfaz web basada en **Bootstrap 3** y la plantilla administrativa **Inspinia**, orientada a pantallas tactiles y terminales de escritorio.

### 1. Paleta de colores y estilo general
- **Color primario (Verde turquesa `#1ab394` / Azul corporativo `#1c84c6`)**: Utilizado en botones principales de confirmacion, cabeceras de tablas activas y badges de estado activo.
- **Color de peligro / cancelacion (Rojo `#ed5565`)**: Empleado en botones de "Cerrar caja", anulaciones y alertas de saldo faltante.
- **Color de advertencia (Amarillo / Naranja `#f8ac59`)**: Utilizado en botones de "Registrar arqueo", advertencias de pedidos pendientes y visualizacion de vuelto.
- **Color secundario / informacion (Gris claro `#f3f3f4`, Azul cielo `#23c6c8`)**: Utilizado en fondos de paneles, bordes y botones de busqueda o impresion.
- **Barra lateral de checkout (`sidebar-dark`)**: Fondo gris oscuro/negro (`#2f4050`) con iconos grandes y texto blanco en disposicion vertical para botones de alta frecuencia (Dividir cuentas, Pagar, Anular).

### 2. Disposicion y arquitectura de bloques por pantalla

#### A. Pantalla de Apertura y Cierre (`#!/caja/apertura-cierre`)
- **Estructura de dos columnas (grid 5 / 7)**:
  - *Columna izquierda (5 columnas)*: Un contenedor tipo "Jumbotron" gris suave que muestra en tipografia grande y negrita el estado de la caja ("Caja Principal abierta/cerrada"), monto de apertura, usuario, fecha y lista compacta del tipo de cambio.
  - *Columna derecha (7 columnas)*: Panel principal de operaciones. En estado abierto contiene:
    1. Tabla limpia de saldos esperados (filas alternadas blanco/gris suave) con totales alineados a la derecha.
    2. Fila destacada en azul suave (`info`) con el **Total en caja**.
    3. Fila de botones de accion horizontales con iconos FontAwesome: Boton primario `Verificar movimientos`, boton amarillo `Registrar arqueo`, boton cyan `Imprimir paloteo`.
    4. Panel inferior destacado con alerta amarilla si hay observaciones y boton ancho rojo `Cerrar caja` con spinner de procesamiento.

#### B. Modal de Arqueo de Caja (`arqueocaja.html`)
- **Ventana modal grande (`size: lg`)**:
  - *Cabecera*: Fondo blanco con titulo en negrita acompanado del icono `fa-archive`.
  - *Cuerpo*:
    1. Tablas en dos columnas paralelas: A la izquierda tabla de billetes (filas con denominacion en texto grande, input numerico centrado y total calculado a la derecha); a la derecha tabla identica para monedas.
    2. Tabla horizontal para tarjetas con columnas: Nombre, Monto Sistema (azul), Monto Manual (campo editable) y Lote del POS.
    3. Tabla comparativa final: Fila MANUAL vs Fila SISTEMA con casillas destacadas para Sobrante y Faltante.
    4. Area inferior con campo de texto libre para observaciones.
  - *Pie de modal*: Boton gris `Cancelar` y boton azul primario `Registrar arqueo`.

#### C. Pantalla de Cobro / Checkout (`pagos.html`)
- **Disposicion modular horizontal**:
  - *Area superior*: Selector de cliente con buscador de texto y boton rapido para crear cliente nuevo.
  - *Area central izquierda*: Botonera de tipo de comprobante (Boleta, Factura, Nota de Venta) con botones rectangulares grandes faciles de presionar de forma tactil.
  - *Area central derecha*: Bloque financiero con botonera de billetes rapidos para efectivo, campo de monto con teclado virtual integrado, selectores de tarjetas y campo de codigo de transferencia.
  - *Area inferior*: Visualizador de cifras grandes (`amount-big`): Importe total en color oscuro, Faltante en rojo (`text-danger`) o Vuelto en verde/amarillo (`text-warning` / `text-success`). Boton de accion final ancho "PAGAR (CTRL + ENTER)".

---

## J) Reglas de negocio que se deducen

A partir de la revision estatica del codigo y la operacion del sistema, se desprenden las siguientes reglas de negocio fundamentales para incorporar en el mockup de Caprichos:

1. **Apertura obligatoria previa a toda transaccion**: No es posible emitir pedidos, registrar consumos ni procesar cobros en una caja si esta no cuenta con un registro formal de apertura y asignacion de turno.
2. **Formula contable estricta del total en caja**:
   $$\text{Total en Efectivo Esperado} = \text{Monto Apertura} + \text{Ventas en Efectivo} + \text{Ingresos Extras} - \text{Egresos Extras}$$
   Los cobros en tarjeta, transferencias y vales se liquidan por separado y no incrementan el saldo en efectivo del cajon.
3. **Paso de verificacion mandatorio antes del cierre**: El sistema impide ejecutar el cierre de caja de forma directa sin antes haber pulsado "Verificar movimientos", garantizando que el cajero consulte los saldos actualizados del servidor.
4. **Independencia entre Cierre X y Cierre Z**:
   - El *Cierre X* cierra el turno de trabajo y la responsabilidad del cajero individual.
   - El *Cierre Z* consolida los multiples turnos X transcurridos en el dia y realiza el cierre fiscal de la jornada.
5. **Politica de Caja a Ciegas**: Capacidad configurable para ocultar los montos esperados del sistema al cajero durante el arqueo, forzandolo a realizar un conteo fisico honesto para prevenir manipulaciones.
6. **Conteo por denominacion fisica**: El arqueo exige el conteo de billetes y monedas por valor facial, calculando automaticamente los subtotales para evitar errores de digitacion.
7. **Control cruzado de lotes de tarjeta**: Cada liquidacion con tarjeta durante el arqueo solicita el ingreso del numero de lote del terminal fisico, facilitando la conciliacion con el estado de cuenta bancario.
8. **Segregacion de propinas**: Las propinas no integran la venta neta del negocio ni forman parte de la base imponible de los comprobantes electronicos; se auditan por separado segun beneficiario (mozo o repartidor).
9. **Trazabilidad estricta y prohibicion de borrado fisico**: Los movimientos de egreso, ingreso y comprobantes de venta no se eliminan de la base de datos; unicamente se marcan como anulados registrando fecha, usuario responsable y categoria de motivo.
10. **Exigencia de RUC en Facturas**: La emision de Factura exige indefectiblemente un cliente registrado con RUC de 11 digitos y razon social validada, mientras que Boletas y Notas de Venta permiten emitirse a Publico General.
11. **Bloqueo / Advertencia por operaciones pendientes**: Al cerrar la caja, el sistema inspecciona si hay mesas abiertas con pedidos sin cobrar o comprobantes electronicos pendientes de transmision a SUNAT, requiriendo atencion antes de cerrar.
12. **Actualizacion automatica de kardex de inventario**: Al concretarse el cierre de caja, se dispara el proceso de consolidacion y rebaja definitiva del stock de insumos y productos asociados a las ventas del turno.

---

## K) NO VERIFICADO

Para mantener estricta fidelidad con la realidad y evitar presunciones, se declaran los siguientes aspectos que no pudieron ser comprobados directamente debido a restricciones de seguridad, ausencia de hardware fisico o limitaciones de entorno:

1. **Protocolo fisico de apertura del cajon monedero (RJ11 / Gaveta)**: No fue posible verificar la secuencia de escape ESC/POS o comando de hardware enviado a traves del puerto de la impresora termica para disparar la apertura automatica del cajon en un cobro o al pulsar "Abre gaveta".
2. **Comunicacion bidireccional en tiempo real con terminales POS inteligentes**: No se comprobo en vivo el handshake o intercambio de paquetes con terminales Izipay Smart o Niubiz integrados (se leyeron los metodos y callbacks en codigo JS, pero no se ejecuto transaccion fisica bancaria).
3. **Mecanismo de tolerancia de descuadre para autorizacion gerencial**: No se pudo verificar si existe un umbral parametrico de diferencia maxima tolerada (ejemplo: +/- S/ 5.00) que bloquee el cierre si no se ingresa la contrasena de un supervisor, o si el sistema simplemente registra el sobrante/faltante con la observacion del cajero sin bloquear el cierre.
4. **Contenido visual exacto del comprobante PDF generado por el servicio backend PHP**: La logica de generacion del PDF de cierre reside en el servidor (`report.php` / `enviocierrecajapdf.php`), por lo que no se pudo descargar un documento renderizado real para no alterar registros de auditoria del restaurante.

---
INFORME LISTO.

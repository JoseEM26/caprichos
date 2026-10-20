---
id: ANA-CAP-011
tipo: analisis
titulo: "Analisis Funcional del Proceso de Cobros y Cuadre de Caja en el Mockup de Caprichos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, caja-informes]
---

# Analisis Funcional del Proceso de Cobros y Cuadre de Caja en el Mockup de Caprichos

El presente documento analiza en detalle el funcionamiento actual del modulo de cobros dentro del administrativo de Caprichos (archivo fuente Admin.dc.html y documentos de soporte del BRD y analisis), identificando los flujos existentes, las omisiones tecnicas y operativas, y la propuesta funcional necesaria para asegurar un control de caja confiable y auditable.

---

## 1 Lo que YA existe (con evidencia)

A continuacion se detallan todas las funcionalidades, datos y reglas que actualmente existen en el codigo y la documentacion del sistema.

### 1.1 Medios de pago reconocidos y configuracion del local
- **Definicion de medios en documentos del negocio:**
  - En [BRD.md](file:///tmp/claude-1000/caja-agy/fuente/BRD.md#L179), la regla RN-CAP-011 establece: "Medios de pago admitidos: efectivo (con monto para el vuelto), Yape, Plin, transferencia y tarjeta".
  - En [BRD.md](file:///tmp/claude-1000/caja-agy/fuente/BRD.md#L137), en la seccion de alcance de Caja se indica: "el pedido llega a caja, el cajero lo verifica y lo acepta; registro del cobro y del medio de pago (efectivo, Yape, Plin, transferencia, tarjeta)".
  - En [modulos-y-roles.md](file:///tmp/claude-1000/caja-agy/fuente/modulos-y-roles.md#L21), en el modulo Pedidos y caja se describe: "registra cobro y medio de pago (efectivo con vuelto, Yape, Plin, transferencia, tarjeta)".
  - En [registro-mockup.md](file:///tmp/claude-1000/caja-agy/fuente/registro-mockup.md#L37), se resume: "pagos con efectivo (vuelto), Yape, Plin, tarjeta y transferencia".
  - En [BRD.md](file:///tmp/claude-1000/caja-agy/fuente/BRD.md#L57) (NEC-CAP-025), [BRD.md](file:///tmp/claude-1000/caja-agy/fuente/BRD.md#L204) (RN-CAP-036) y [BRD.md](file:///tmp/claude-1000/caja-agy/fuente/BRD.md#L226) (RN-CAP-058), se define el "Credito del personal": beneficio exclusivo para trabajadores de hasta 15 dias de plazo con 25 % de descuento (no aplicable a clientes externos ni a combos/promociones).
- **Datos semilla en el codigo:**
  - En [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L1904-L1922), la constante `SEED` contiene pedidos precargados con los siguientes valores en el campo `pay`:
    - `pay: 'Yape'` (pedidos CP-0101, CP-0107, CP-0100)
    - `pay: 'Efectivo'` (pedidos CP-0102, CP-0105, CP-0108, CP-0098, CP-0096, CP-0095)
    - `pay: 'Tarjeta'` (pedido CP-0103)
    - `pay: 'Plin'` (pedidos CP-0104, CP-0099)
    - `pay: 'Transferencia'` (pedido CP-0097)
  - En [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L1923), la constante `NEW_ORDER` define la simulacion de pedido web con `pay: 'Yape'` y `paid: false`.
- **Parametros en Configuracion del local:**
  - En [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2181-L2182), `INFO_DEFAULT` define los datos bancarios del establecimiento:
    - `yape: '9XX XXX XXX (ejemplo)'`
    - `plin: '9XX XXX XXX (ejemplo)'`
    - `cuenta: 'XXX-XXXXXXXXXX-X-XX (ejemplo)'`
  - En [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2190), en la categoria de configuracion `pagos`, se disponen campos editables para el numero de Yape, numero de Plin y numero de cuenta corriente.

### 1.2 Flujo de creacion de pedidos en el administrativo (Nuevo pedido)
- En [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L228), los botones "Nuevo pedido" (`openMo`) y "Pedido del personal" (`openMoStaff`) abren el asistente modal `isMo` ([Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L1564-L1697)).
- En este modal se selecciona modalidad (mesa, llevar, delivery o reserva), cliente o mesa, productos y cuenta de fidelizacion DNI.
- Sin embargo, en la funcion que procesa el envio del pedido ([Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2954), variable `sendMo`), los campos financieros se asignan de forma fija:
  `pay: 'Efectivo'`, `paid: false`.
- En este asistente NO EXISTE ninguna pantalla, campo ni boton para que el operador o el mozo seleccione el medio de pago acordado con el cliente.

### 1.3 Consulta y visualizacion del cobro en el detalle del pedido
- En la vista de caja (`view === 'caja'`), columna derecha `cj-right` ([Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L289-L403)), el pedido seleccionado cuenta con cuatro pestanas: Pedido, Cobro, Ticket de cocina y Comprobante.
- En la pestana "Cobro" (`ctCobro`, [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L312-L320)):
  - Linea 314: Se visualiza el texto estatico del medio de pago asignado: `<span>Medio de pago</span><span style="font-weight:700">{{sel.pay}}</span>`. Es de solo lectura.
  - Linea 315: Se visualiza el estado del cobro: `<span>Cobro</span><span style="font-weight:700">{{sel.paidText}}</span>` (muestra "Cobrado" si `paid === true` o "Pendiente" si `paid === false`, logica en linea 2781).
  - Linea 316: Se permite cambiar el tipo de comprobante tributario mediante chips interactivos (`compChips`, [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L3496-L3497)): 'Nota de venta', 'Boleta' o 'Factura'. Por defecto se asume 'Nota de venta' (conforme a RN-CAP-037).
  - Linea 317: En pedidos de mesa (`sel.isMesaOrder`), se muestra el boton "Sacar precuenta (el cajero cobra)", que dispara `openPre` ([Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L3498)).
  - Linea 318: Se visualiza el monto total del pedido: `<span>Total</span><span>{{sel.totalText}}</span>`.

### 1.4 Acciones de cobro en el pie del detalle (cj-foot)
- **Boton "Registrar cobro" (`collectSel`):**
  - Ubicacion en interfaz: [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L391).
  - Condicion de visibilidad: [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2789) (`canCollect`: pedido aceptado, no rechazado, no pagado aun `!selOrder.paid`, y usuario con rol habilitado).
  - Comportamiento en codigo: [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L3514):
    `collectSel: ask('¿Registrar el cobro de ' + s.sel + '?', 'Quedara marcado como cobrado.', () => this.setOrder(s.sel, { paid: true }))`.
    Muestra un cuadro de confirmacion generico (Si/No) y unicamente conmuta la variable booleana `paid` a `true`. No solicita medio de pago, no recibe montos ni emite recibos de caja.
- **Boton "Cobrar a credito del personal" (`openCr`):**
  - Ubicacion en interfaz: [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L392).
  - Logica funcional: [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L3208-L3220) y modal `isCr` en lineas [1725-1735](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L1725-L1735).
  - Funcionamiento: Abre una ventana donde se elige al trabajador de la lista `STAFF` (Marta, Luis, Rosa, Pedro, Elena, Jorge). Aplica automaticamente el descuento configurado (25 % sobre platos que no sean combos ni promociones), calcula la fecha de vencimiento (15 dias posteriores) y al confirmar (`crConfirm`, linea 3211) ejecuta:
    `this.setOrder(crOrder.id, { paid: true, pay: 'Credito del personal', total: crCalc.pay, credWho: st.n })`
    e inserta una fila en la tabla del modulo `creditos`.
- **Boton "Entregar al cliente y cerrar" (`deliverSel`):**
  - Ubicacion en interfaz: [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L395).
  - Logica funcional: [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L3515):
    `deliverSel: ask('¿Entregar y cerrar el pedido ' + s.sel + '?', 'Se marcara como entregado y cobrado.', () => this.setOrder(s.sel, { status: 'entregado', paid: true }))`.
    Fuerza el cobro (`paid: true`) y el cierre del pedido al mismo tiempo sin validar por que via ingreso el dinero.
- **Acumulacion de puntos al cobrar:**
  - En [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2482-L2487), metodo `setOrder`: Cuando un pedido pasa de no pagado a `paid === true`, si tiene una cuenta asociada (`o0.acct`), calcula `g = Math.floor(total)` y suma 1 punto por cada sol cobrado al registro del cliente en la lista `clientes`.

### 1.5 Impresion y comprobantes del cliente
- **Precuenta de mesa (`openPre` / `isPre`):**
  - En [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L1547-L1561), ventana modal que emite un ticket simulado con el detalle del consumo, total y mensaje informativo: "Paga con Yape o Plin al 9XX XXX XXX (ejemplo) o entrega el efectivo al mozo; el cajero cobra y emite el comprobante. La precuenta no es un comprobante de pago."
- **Comprobante del cliente (`ctComp` / `printReceipt`):**
  - En [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L360-L379) y [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L3510), genera el formato impreso del comprobante (Nota de venta, Boleta o Factura) adjuntando hasta 2 cupones promocionales configurables al pie del papel.

### 1.6 Visualizacion en Repartos (Delivery)
- En [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L487) y [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2827), cada tarjeta de reparto muestra el texto formateado:
  `d.pay: o.pay + (o.paid ? ' · cobrado' : ' · cobrar')` junto al total monetario.
  Permite al repartidor saber si el pedido ya fue pagado previamente (por ejemplo web con Yape) o si debe exigir el cobro al cliente al entregar.

### 1.7 Modulo de Creditos del personal
- En [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2418-L2423), existe una tabla completa con columnas Documento, Trabajador, Rol, Emision, Vence, Monto (con 25 %), Saldo, Estado y Mes, permitiendo filtrar creditos por cobrar a colaboradores.

### 1.8 Informes y Escritorio de Caja
- En [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2445), la tabla del modulo `informes` lista los titulos "Cierre de caja" (ingresos y egresos por turno) y "Arqueo de caja" (efectivo esperado y contado), pero aclara expresamente en la linea 2441 que se trata de un catalogo de consulta estatico ("Aqui solo se muestra su estructura").
- En [Admin.dc.html](file:///tmp/claude-1000/caja-agy/fuente/Admin.dc.html#L2715), el escritorio del cajero muestra indicadores resumen: "Cobrado en mi caja hoy: s/ 668.40" (valor estatico de ejemplo) y "Cobros pendientes" (conteo de pedidos no pagados).

---

## 2 Lo que FALTA o esta incompleto

La siguiente tabla evalua las carencias del sistema frente a las exigencias operativas y contables de una cafeteria real:

| Que falta o esta incompleto | Por que importa para el negocio | Gravedad |
| :-- | :-- | :-- |
| **Cambio y eleccion del medio de pago al cobrar** | Al registrar un pedido manual se asigna "Efectivo" de forma obligada y fija. Al momento de cobrar en caja no se puede cambiar a Yape, Plin o Tarjeta. Genera distorsion total entre el reporte del sistema y los ingresos reales. | **Alta** |
| **Registro de monto recibido y calculo de vuelto** | En cobros en efectivo no existe campo para registrar con cuanto dinero paga el cliente ni se calcula el vuelto. El cajero debe calcularlo mentalmente o en calculadora externa, propiciando errores en caja y quejas de clientes. | **Alta** |
| **Referencia o codigo de operacion en billeteras y transferencias** | No hay campo para guardar los 4 o 6 digitos de operacion de Yape, Plin o transferencias. El cajero puede marcar "cobrado" sin verificar la transaccion bancaria real, facilitando estafas con capturas falsas. | **Alta** |
| **Pagos mixtos o combinados (split payment)** | Muy habitual en cafeterias (ejemplo: cuenta de S/ 45 pagada S/ 20 en efectivo y S/ 25 por Yape; o cuentas compartidas). El sistema solo admite un unico texto `pay`, impidiendo registrar dos medios para una misma cuenta. | **Alta** |
| **Apertura de caja y fondo inicial (sencillo)** | No existe registro del efectivo inicial en gaveta al abrir el turno. Sin saldo inicial es imposible realizar un arqueo de caja matematicamente valido al terminar el dia. | **Alta** |
| **Arqueo ciego y cierre de turno** | No existe pantalla de cuadre donde el cajero declare el dinero fisico contado (billetes y monedas) ni conciliacion contra lo esperado por sistema por cada medio de pago. | **Alta** |
| **Control de cambio y liquidacion de delivery** | En pedidos de delivery no se registra con que billete pagara el cliente, por lo que el repartidor no sabe cuanto vuelto llevar. Al regresar, no hay interfaz de liquidacion para que el repartidor entregue el dinero recaudado a caja. | **Alta** |
| **Anulacion de cobros y devoluciones** | Solo se puede rechazar pedidos en estado `nuevo`. Si un pedido ya cobrado debe anularse por reclamo o error de digitacion, no existe funcion de devolucion de dinero ni reversa contable. | **Alta** |
| **Captura o validacion visual del voucher digital** | No existe opcion para adjuntar o previsualizar el pantallazo de pago de Yape/Plin enviado por WhatsApp para contrastarlo antes de aceptar el cobro. | **Media** |
| **Registro de gastos menores y caja chica** | Si se retira dinero de caja para compras urgentes (ejemplo: hielo, bolsas o recargas), no hay modulo de egresos de caja, generando faltantes artificiales en el arqueo final. | **Media** |
| **Control de estados de cobro por canal** | No se diferencia entre "cobrado en local", "por cobrar en mostrador", "por cobrar en mesa" o "por cobrar en ruta", lo que confunde la custodia del dinero entre mozo, cajero y motorizado. | **Media** |
| **Gestion y liquidacion de propinas** | No existe registro de propinas voluntarias (en mesa o delivery). No se pueden computar para su posterior distribucion equitativa entre mozos y personal de cocina/barra. | **Baja** |

---

## 3 Propuesta concreta para el mockup (pantallas, campos, botones, reglas)

Para que el mockup refleje la operacion real y permita realizar un cuadre de caja exacto, se propone incorporar las siguientes pantallas, campos y reglas:

### 3.1 Nuevo modal interactivo "Registrar Cobro"
Sustituir la simple confirmacion de linea 3514 por un dialogo operativo con las siguientes caracteristicas:
- **Cabecera informativa:**
  - Codigo de pedido, Modalidad (Mesa, Llevar, Delivery), Nombre del cliente y Total a cobrar destacado.
- **Selector de medio de pago (botones tipo chip seleccionables):**
  - Opciones: `Efectivo`, `Yape`, `Plin`, `Tarjeta POS`, `Transferencia`, `Credito personal`, `Pago mixto`.
- **Formularios dinamicos segun medio elegido:**
  - **Si es Efectivo:**
    - Campo numerico: `Monto recibido (S/)`.
    - Botones de acceso rapido para billetes comunes: `[Exacto]`, `[S/ 20]`, `[S/ 50]`, `[S/ 100]`.
    - Campo de solo lectura destacado: `Vuelto a entregar (S/)` (calculado automaticamente: `Monto recibido − Total`). Bloqueo de confirmacion si el monto recibido es menor al total.
  - **Si es Yape o Plin:**
    - Campo de texto obligatorio: `Numero de operacion / Referencia` (4 a 6 digitos).
    - Campo opcional: `Titular / Telefono emisor`.
    - Casilla de verificacion: `[x] Pago verificado en la cuenta del local`.
  - **Si es Tarjeta POS:**
    - Selector desplegable de terminal: `Izipay`, `Niubiz`, `Culqi`.
    - Campo de texto: `Numero de referencia / Operacion de voucher`.
    - Campo opcional: `Ultimos 4 digitos de tarjeta`.
  - **Si es Transferencia:**
    - Selector de banco: `BCP`, `BBVA`, `Interbank`.
    - Campo obligatorio: `Numero de operacion bancaria`.
  - **Si es Pago Mixto:**
    - Interfaz de dos filas donde se eligen dos medios y se distribuye el monto (por ejemplo: `Fila 1: Efectivo S/ 20.00` + `Fila 2: Yape S/ 15.00`), validando que la suma coincida exactamente con el total del pedido.
  - **Campo opcional de propina:**
    - `Propina voluntaria (S/)`: se suma al cobro pero se contabiliza en cuenta separada a favor del personal.
- **Botones de accion al pie:**
  - Boton principal: `[Confirmar cobro e imprimir comprobante]`.
  - Boton secundario: `[Cancelar]`.

### 3.2 Flujo de cobro y vuelto en Delivery (Repartidores)
- **Al tomar el pedido (Nuevo pedido delivery):**
  - Agregar el campo obligatorio: `¿Con cuanto cancela el cliente?`.
  - Si el cliente indica que paga con S/ 50 y el pedido es de S/ 26, el sistema genera una alerta en la comanda de despacho: `Llevar S/ 24.00 de vuelto`.
- **Entrega de sencillo al motorizado:**
  - En el modulo de Repartos, habilitar un registro de `Fondo de sencillo entregado al repartidor` al inicio de su turno o despacho.
- **Rendicion y liquidacion de delivery:**
  - En Repartos, al marcar el pedido como entregado, el dinero no pasa directo a caja: queda en estado `Pendiente de rendicion por Repartidor`.
  - El cajero debe tener un boton `Liquidar entrega`, donde recibe el efectivo cobrado por el repartidor, verifica el monto y lo ingresa a la caja principal del turno.

### 3.3 Registro de movimientos de caja chica (Ingresos y Egresos menores)
- En el modulo "Pedidos y caja", agregar en la barra superior el boton `[Movimiento de caja]`.
- Permite registrar salidas menores de dinero de la gaveta:
  - Tipo: `Egreso menor` o `Ingreso extraordinario`.
  - Concepto: `Compra urgente de insumos`, `Movilidad/Gasolina repartidor`, `Sencillo adicional`, `Mantenimiento`.
  - Monto (S/) y responsable que autoriza.
  - Esto descuenta el saldo teorico de efectivo para no generar faltantes al cuadrar.

### 3.4 Pantalla de Arqueo y Cierre de Turno de Caja
Crear una subvista o pestana de gestion de caja dentro de "Pedidos y caja" accesible para el Cajero y el Administrador:
- **Paso 1: Apertura de turno:**
  - Registro de `Fondo inicial en caja (sencillo inicial)` al comenzar el dia (por ejemplo S/ 150.00).
- **Paso 2: Arqueo ciego al cerrar turno:**
  - El cajero ingresa el conteo fisico de billetes y monedas en gaveta (desglose de monedas de S/ 1, S/ 2, S/ 5 y billetes de S/ 10, S/ 20, S/ 50, S/ 100).
- **Paso 3: Conciliacion del sistema:**
  - La pantalla muestra el cuadro comparativo:
    - **Efectivo esperado:** `Fondo inicial + Ventas cobradas en efectivo en mostrador + Ventas delivery liquidadas − Egresos de caja chica`.
    - **Efectivo contado:** Dinero real declarado por el cajero.
    - **Diferencia:** `Sobrante (+)` o `Faltante (-)`.
    - **Yape esperado vs verificado:** Total de transacciones y suma en soles.
    - **Plin esperado vs verificado:** Total de transacciones y suma en soles.
    - **Tarjetas POS esperadas:** Total vouchers vs reporte del lote del terminal POS.
    - **Creditos del personal:** Total firmado a cuenta.
- **Paso 4: Boton de cierre:**
  - `[Cerrar turno e imprimir reporte de cuadre]`. Genera el comprobante impreso en papel termico con el resumen de la jornada.

---

## 4 Preguntas para el dueno (Kevin)

Para afinar el diseno definitivo con las politicas comerciales de Caprichos, es indispensable consultar a Kevin los siguientes puntos:

1. **Recepcion y verificacion de Yape y Plin:**
   - ¿A que telefono llegan las notificaciones de Yape y Plin? ¿Hay un telefono celular fisico exclusivo en el mostrador de caja para que el cajero compruebe la llegada del dinero en tiempo real, o llegan al telefono personal de Kevin?
   - ¿Manejan cuenta personal (con limite de recepcion mensual) o Yape Empresa / Plin Empresas?
2. **Terminales POS para tarjetas de debito y credito:**
   - ¿Que empresa proveedora de POS utilizan en tienda (Izipay, Niubiz, Culqi, Mercado Pago)?
   - ¿Cuentan con terminales POS inalambricos para llevar a la mesa cuando el cliente pide la precuenta, o el cliente debe acercarse siempre al mostrador de caja a pagar?
   - ¿Disponen de un POS movil para que el motorizado cobre con tarjeta en delivery, o el delivery solo cobra en efectivo y billeteras digitales?
3. **Manejo de vuelto y caja chica en repartos (Delivery):**
   - ¿Con cuanto fondo de cambio o sencillo sale cada repartidor a la calle al inicio de su turno?
   - ¿El repartidor liquida el dinero cobrado pedido por pedido, o entrega todo el efectivo acumulado en una sola rendicion al terminar su turno?
4. **Politica de propinas:**
   - ¿Caprichos acepta propinas voluntarias incluidas en pagos con tarjeta o Yape, o se manejan unicamente en efectivo mediante una alcancia en barra?
   - Si se reciben por sistema, ¿con que periodicidad y porcentaje se reparten entre mozos, cocina y barra?
5. **Frecuencia de pagos mixtos:**
   - ¿Es frecuente que los clientes pidan pagar una parte de la cuenta en efectivo y la otra parte por Yape o tarjeta? ¿Es prioritario permitirlo desde la primera version?
6. **Turnos de atencion y apertura de gaveta:**
   - ¿Manejan un solo turno corrido diario (de 14:00 a 22:00) o hacen cambio de cajero a mitad de la tarde con arqueo intermedio?
   - ¿La gaveta de dinero de caja esta conectada a la ticketera y se abre de forma automatica al imprimir el cobro en efectivo, o se abre con llave manual?

---

INFORME LISTO.

---
id: ANA-CAP-012
tipo: analisis
titulo: "Informe Funcional de Caja, Ventas, Cierre de Turno e Indicadores de Caprichos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, caja-informes]
---

# Informe Funcional de Caja, Ventas, Cierre de Turno e Indicadores de Caprichos

> Documento de analisis funcional para el sistema de punto de venta y administrativo de la cafeteria Caprichos (Lima, Peru). Moneda de operacion: Soles (S/). Realizado por el analista funcional de sistemas POS sobre la version estatica del codigo y la documentacion de negocio.

---

## 1 Lo que YA existe (con evidencia)

A continuacion se presenta la revision estatica de los archivos fuente (`Admin.dc.html`, `BRD.md`, `modulos-y-roles.md`, `registro-mockup.md`, `impresion-tickets.md`), evaluando lo que hoy esta implementado o documentado en torno a ventas y dinero:

### 1.1 Ventas del dia por medio de pago
* **En el codigo (`Admin.dc.html`):**
  * Los pedidos de ejemplo en el arreglo `SEED` (`Admin.dc.html`, lineas 1904-1910) registran el campo `pay` con valores individuales como `'Yape'`, `'Efectivo'`, `'Tarjeta'`, `'Plin'` y `'Crédito del personal'`, y un indicador booleano `paid` (`true` o `false`).
  * En la vista de caja (`Admin.dc.html`, lineas 314-315, dentro de la pestana `Cobro`), se muestra el medio de pago del pedido seleccionado (`sel.pay`) y el estado del cobro (`sel.paidText`).
  * El boton "Registrar cobro" (`Admin.dc.html`, linea 391 y linea 3514 en `collectSel`) actualiza el estado a pagado: `this.setOrder(s.sel, { paid: true })`.
  * En la tabla de catalogo de reportes (`Admin.dc.html`, lineas 2441-2445, `TABLES.informes`), se lista el nombre del informe "Cierre de caja" indicando que muestra "Ingresos y egresos por turno". Sin embargo, la propia definicion aclara: *"Catálogo de reportes disponibles. Aquí solo se muestra su estructura"*; por tanto, la generacion real del reporte **NO EXISTE**.
  * En los paneles de Escritorio e Indicadores **NO EXISTE** una sumatoria o acumulado del dinero recaudado por medio de pago (cuanto entro en efectivo, cuanto en Yape, cuanto en Plin o tarjeta).
* **En el BRD (`BRD.md`):**
  * En la regla `RN-CAP-011` (`BRD.md`, linea 179) se establecen los medios de pago admitidos: "efectivo (con monto para el vuelto), Yape, Plin, transferencia y tarjeta".
  * En el alcance (`BRD.md`, linea 137) se indica que en caja se realiza el "registro del cobro y del medio de pago".

### 1.2 Ventas del dia por canal
* **En el codigo (`Admin.dc.html`):**
  * En el Escritorio del Administrador (`Admin.dc.html`, linea 2702), los porcentajes de ventas por canal son valores estaticos y fijos definidos en la constante `channels`: Salon (46%), Delivery (28%), Web recojo (14%) y WhatsApp (12%).
  * En el modulo Indicadores (`Admin.dc.html`, lineas 3078-3081 y linea 3092), existe un grafico circular (donut) y leyenda generada con porcentajes fijos: Salon (46%), Delivery (28%), Web recojo (14%) y WhatsApp (12%). Si se filtra por canal, se aplica un factor fijo en `dayVal` (`Admin.dc.html`, linea 3059: `todos: 1, salon: 0.46, delivery: 0.28, web: 0.14, whatsapp: 0.12`). Los montos en soles son aproximaciones matematicas simuladas sobre una funcion trigonometrica (`dayVal`, linea 3060), no sobre pedidos reales.
  * En la vista de pedidos de Caja (`Admin.dc.html`, linea 3105), existe un filtro interactivo por canal (`cCanals`): Todos, Web, WhatsApp, Mozo, Caja.
  * En el catalogo de informes (`Admin.dc.html`, linea 2445), aparece registrado el nombre "Ventas por canal" (Salon, web, WhatsApp y delivery) con exportacion simulada a PDF y Excel.
* **En el BRD y modulos (`modulos-y-roles.md`):**
  * Se describe en `modulos-y-roles.md` (linea 65) que el administrador ve en su escritorio las "ventas por canal".

### 1.3 Ventas del dia por modalidad
* **En el codigo (`Admin.dc.html`):**
  * Existe el diccionario de modalidades: `MODAL = { delivery: 'Delivery', llevar: 'Para llevar', local: 'En mesa' }` (`Admin.dc.html`, linea 1903).
  * En Pedidos y caja (`Admin.dc.html`, linea 3106), se puede filtrar la lista por modalidad (`cModal`): Todas, Delivery, Para llevar, En mesa.
  * En Escritorio e Indicadores **NO EXISTE** un indicador o acumulado que distinga ventas por modalidad. Se confunde parcialmente canal con modalidad (en Indicadores se agrupa Salon y Delivery como canales, ignorando "Para llevar").
  * En Informes (`TABLES.informes`) **NO EXISTE** reporte de ventas por modalidad.
* **En el BRD (`BRD.md`):**
  * La regla `RN-CAP-016` (`BRD.md`, linea 184) senala que la modalidad (delivery o para recoger) se elige en el carrito de la carta, mientras que en salon pide exclusivamente el mozo.

### 1.4 Ventas por cajero y por mozo
* **En el codigo (`Admin.dc.html`):**
  * En el Escritorio del Cajero (`Admin.dc.html`, linea 2715), se muestra un indicador fijo quemado en codigo: `Cobrado en mi caja hoy: s/ 668.40`. No se calcula sumando pedidos cobrados por el usuario conectado.
  * En el Escritorio del Mozo (`Admin.dc.html`, lineas 2724-2728), se muestran pedidos de sus mesas abiertas y listos para llevar, pero ningun monto de dinero (cumpliendo la regla `RN-CAP-013` de que el mozo no ve ventas).
  * En la estructura de los pedidos (`SEED`, `Admin.dc.html`, lineas 1904-1910) **NO EXISTE** campo de identificador de cajero (`cajeroId`) ni de mozo (`mozoId`). Solo en la pantalla de cocina se muestra una cadena fija para tickets de mozo (`Admin.dc.html`, linea 2797: `canal === 'Mozo' ? ' · mozo Luis' : ''`).
  * En el catalogo de informes (`Admin.dc.html`, linea 2444), figura el texto "Ventas por mozo" con la descripcion "Ventas y propinas por mozo", pero **NO EXISTE** logica ni datos detras.
* **En el BRD (`BRD.md`):**
  * La regla `RN-CAP-030` (`BRD.md`, linea 198) senala: "El mozo no cobra: saca la precuenta y el cajero cobra y emite el comprobante".

### 1.5 Ticket promedio
* **En el codigo (`Admin.dc.html`):**
  * En el Escritorio del Administrador (`Admin.dc.html`, linea 2705), se muestra un valor fijo de ejemplo: `Ticket promedio: s/ 33.80`.
  * En el modulo Indicadores (`Admin.dc.html`, lineas 3074-3077), el ticket promedio se calcula matematicamente a partir de la simulacion: `orders2 = Math.max(1, Math.round(total / 33.8))` y luego `fmS(Math.round(total / orders2 * 10) / 10)` junto con su comparativa contra el periodo anterior.
  * En la operacion diaria de Caja **NO EXISTE** el calculo del ticket promedio en tiempo real a partir de las comandas efectivamente cobradas del dia.
* **En el BRD y modulos (`modulos-y-roles.md`):**
  * Se menciona en `modulos-y-roles.md` (linea 45) que el modulo Indicadores mide el ticket promedio del negocio.

### 1.6 Comparacion con caja (arqueo y cierre)
* **En el codigo (`Admin.dc.html`):**
  * En la tabla de catálogo `TABLES.informes` (`Admin.dc.html`, linea 2445), se mencionan "Cierre de caja" (ingresos y egresos por turno) y "Arqueo de caja" (efectivo esperado y contado).
  * En el inicio de sesion y perfil (`Admin.dc.html`, lineas 78-79 y 1526), aparecen etiquetas visuales fijas: `CAJA: Caja Principal` y `TURNO: Día`.
  * En la logica de la aplicacion **NO EXISTE** apertura de caja, **NO EXISTE** ingreso de saldo inicial o sencillo, **NO EXISTE** registro de gastos menores de caja chica, **NO EXISTE** arqueo de efectivo fisico y **NO EXISTE** proceso de cierre de caja por turno o fin de jornada.
  * Nota: Existe una funcion `closeDay` en `Admin.dc.html` (linea 3322), pero corresponde al cierre de insumos perecibles en Almacen (merma diaria de donas), no a dinero.
* **En el BRD (`BRD.md`):**
  * El BRD actual no contempla requerimientos explicitos de cuadre de dinero, fondo fijo, sobrantes ni faltantes.

### 1.7 Creditos del personal por cobrar
* **En el codigo (`Admin.dc.html`):**
  * Existe el modulo completo "Creditos del personal" (`TABLES.creditos`, lineas 2418-2423), con las columnas: Documento (`CP-Pxx`), Trabajador, Rol, Emision, Vence, Monto (con 25%), Saldo, Estado (`Al día`, `Por vencer`, `Vencido`, `Pagado`) y Mes.
  * Configuracion del beneficio (`Admin.dc.html`, lineas 980-988 y 3203-3205): inputs para porcentaje de descuento (`credCfg.pct`, por defecto 25%) y plazo de pago (`credCfg.days`, por defecto 15 dias).
  * Accion de cobro en caja: boton "Cobrar a crédito del personal" (`openCr`, linea 392 y lineas 3208-3220). Abre una ventana emergente donde se selecciona el trabajador de una lista (`STAFF`), calcula el descuento excluyendo combos y promociones mediante la funcion `estLine` (linea 3206), marca el pedido como pagado con medio "Credito del personal" y agrega el registro a la tabla de creditos (`s.credAdded`, linea 3215).
  * En el Escritorio del Cajero (`Admin.dc.html`, linea 2716), hay un enlace directo a `Creditos por vencer`.
  * Lo que **NO EXISTE** en el codigo: no hay funcionalidad para registrar la cobranza de la deuda (cuando el trabajador paga o se le descuenta de su sueldo), ni reflejo de este cobro posterior en el flujo de caja.
* **En el BRD (`BRD.md`):**
  * Reglas `RN-CAP-036`, `RN-CAP-058` y `RN-CAP-072` (`BRD.md`, lineas 204, 226 y 240): Credito exclusivo para el personal (hasta 15 dias y 25% de descuento, excepto combos y promociones). A clientes no se les da credito.

### 1.8 Cupones y descuentos aplicados
* **En el codigo (`Admin.dc.html`):**
  * Existe el modulo "Ofertas y descuentos" (`Admin.dc.html`, lineas 3221-3245), estructurado en 4 pestanas: Promociones, Descuentos automaticos, Cupones e Historial/Reglas generales.
  * Los cupones se administran con codigo, tipo (% o monto en soles), compra minima, vigencia, usos maximos, usos por cliente, categoria o producto, canal y requerimiento de cuenta.
  * Al imprimir el comprobante del cliente (`Admin.dc.html`, lineas 372-376 y linea 3510 en `printReceipt`), se imprimen los cupones activos configurados en el pie de ticket e incrementa el contador de cupones impresos (`c.impresos`).
  * En Pedidos y caja **NO EXISTE** un campo en la creacion manual del pedido (`mo`, linea 2944) para aplicar cupones o descuentos discrecionales, ni se desglosa el ahorro total en el detalle del pedido.
  * En `registro-mockup.md` (linea 86) se documenta formalmente: *"los usos de canje no suben al pedir (sí se cuentan los cupones impresos); el límite por cliente no se controla"*.
  * En Informes **NO EXISTE** reporte de cupones canjeados ni de monto total descontado en las ventas.
* **En el BRD (`BRD.md`):**
  * Reglas `RN-CAP-054`, `RN-CAP-056`, `RN-CAP-069` y `RN-CAP-070` (`BRD.md`, lineas 86, 88, 237, 238): CRUD de cupones impresos en el comprobante (por defecto 2), vigencia en dias y reglas de incompatibilidad entre cupones y descuentos automaticos.

### 1.9 Puntos
* **En el codigo (`Admin.dc.html`):**
  * En `Component.setOrder` (`Admin.dc.html`, linea 2485), cuando un pedido pasa a pagado (`patch.paid && !o0.paid`), si tiene cuenta asociada (`o0.acct`) y no se habian procesado puntos (`!o0.ptsDone`), se acumula 1 punto por cada sol gastado: `g = Math.floor(total)`. Se actualiza la lista de clientes y se guarda en almacenamiento local (`cliSave`).
  * En Nuevo pedido de mostrador o mesa (`Admin.dc.html`, lineas 3411-3418), se puede buscar al cliente por su DNI, registrarlo si no existe o asociar a un trabajador de `STAFF`. El sistema muestra el mensaje de que el pedido sumara puntos al cobrarse.
  * En el modulo Clientes (`Admin.dc.html`, lineas 2411-2417 y 2661), la tabla muestra los puntos acumulados por cada persona.
  * En la operacion de cobro **NO EXISTE** la posibilidad de redimir o canjear puntos para pagar un pedido ni para obtener descuentos.
  * En Informes **NO EXISTE** reporte sobre pasivo de puntos acumulados, puntos canjeados o puntos vencidos.
* **En el BRD (`BRD.md`):**
  * Necesidad `NEC-CAP-024` y `NEC-CAP-036` (`BRD.md`, lineas 56, 68), y regla `RN-CAP-066` y `RN-CAP-071` (lineas 234, 239): 1 punto por cada S/ 1 gastado para compras con cuenta identificada con DNI. Crear cuenta es opcional y nunca obligatorio para comprar.

---

## 2 Lo que FALTA o esta incompleto

La siguiente tabla consolida las omisiones, vacios y discrepancias criticas entre las necesidades operativas de una cafeteria y lo que hoy esta documentado o construido en el sistema:

| Que falta | Por que importa | Gravedad |
| :-- | :-- | :-- |
| **Apertura de caja y fondo inicial (sencillo)** | Sin registrar el dinero fisico con el que abre el turno, es imposible saber si al final del dia sobra o falta plata en la gaveta. No hay donde ingresar los billetes y monedas iniciales para dar vuelto. | **Alta** |
| **Arqueo ciego y cierre de caja diario (Corte Z)** | El cajero no tiene una pantalla donde contar su dinero fisico al terminar su turno. Hoy solo existe un listado de nombres en Informes, pero ninguna pantalla real que compare lo vendido contra lo recaudado. | **Alta** |
| **Registro de gastos menores de caja chica (egresos de efectivo)** | En el dia a dia de una cafeteria se compra hielo de emergencia, insumos urgentes o se pagan recados en efectivo. Si ese dinero sale de la gaveta sin registrarse, la caja descuadra al final de la jornada. | **Alta** |
| **Desglose de ventas reales por medio de pago** | El administrador y el cajero necesitan ver exactamente cuanto ingreso por Efectivo, Yape, Plin y Tarjeta POS para conciliar con los estados de cuenta bancarios y los vouchers de los terminales. | **Alta** |
| **Calculo de efectivo recibido y vuelto en caja** | El cajero debe calcular mentalmente el vuelto al cobrar en efectivo. Si el sistema no calcula ni registra el efectivo entregado y el cambio devuelto, aumentan las equivocaciones al cobrar en mostrador. | **Alta** |
| **Reportes reales en el modulo Informes** | El modulo Informes es hoy una tabla estatica que lista nombres de reportes (un catalogo) sin datos reales, sin filtros por rango de fechas y sin posibilidad de consulta interactiva. | **Alta** |
| **Pagos combinados o mixtos en un mismo pedido** | Es habitual que un cliente pague una parte en efectivo y el saldo con Yape o tarjeta (ej. cuenta de S/ 45 pagada con S/ 20 en efectivo y S/ 25 en Yape). El sistema actual solo admite un unico medio de pago por pedido. | **Media** |
| **Asociacion de cajero y mozo a cada pedido** | Los pedidos no guardan el usuario que abrio la orden ni el usuario que cobro. Impide auditar quien cobro un pedido, quien genero un faltante de caja o medir las ventas y propinas por trabajador. | **Media** |
| **Registro de cobranza de creditos del personal** | Se registra la venta a credito del trabajador, pero no existe pantalla para registrar cuando el trabajador paga su deuda en efectivo o quincena, ni como ingresa ese dinero a la caja. | **Media** |
| **Aplicacion de cupones y descuentos en caja manual** | Cuando un mozo o cajero toma un pedido presencial en `Nuevo pedido`, no existe opcion para registrar un cupon de descuento o cortesia autorizada. | **Media** |
| **Separacion funcional entre canal y modalidad** | En Indicadores y Escritorio se mezclan 'Salon' y 'Delivery' como canales, dejando fuera la modalidad 'Para llevar' y desalineando los datos frente a la lista de pedidos de Caja. | **Media** |
| **Proceso de anulaciones y devoluciones con autorizacion** | No esta definido como se anula un pedido ya cobrado ni como se registra la salida del dinero devuelto al cliente, lo cual es fuente frecuente de mermas y fraudes. | **Media** |
| **Reglas de redencion y valor monetario de puntos** | Los puntos se acumulan pero no hay ninguna regla definida de como se usan (cuantos puntos equivalen a un sol o que productos se pueden canjear en caja). | **Baja** |

---

## 3 Propuesta concreta para el mockup (pantallas, campos, botones, reglas)

Para transformar el mockup en una herramienta util para el negocio y lista para ser validada con Kevin, se propone agregar el ciclo operativo de caja en la vista `caja` y en `informes`:

### 3.1 Flujo Operativo de Caja: Apertura, Movimientos y Cierre

#### A. Pantalla / Modal: Apertura de Turno de Caja
* **Momento:** Se muestra al cajero al iniciar su jornada si la caja no ha sido abierta.
* **Campos:**
  * Fecha y hora de apertura (automaticas, ej. `15/10/2026 14:00`).
  * Cajero responsable (toma el usuario conectado, ej. `caja01 - Cajera de ejemplo`).
  * Estacion / Caja (ej. `Caja Principal 01`).
  * Turno (`Tarde / Noche`).
  * Monto de fondo inicial / sencillo (campo numerico obligatorio en Soles, ej. `s/ 150.00`).
  * Desglose opcional de sencillo (cantidad de monedas de S/ 1, S/ 2, S/ 5 y billetes de S/ 10, S/ 20).
* **Botones:** `Abrir Turno de Caja`, `Cancelar`.
* **Regla:** Ningun pedido puede marcarse como cobrado en efectivo si la caja no tiene un turno abierto.

#### B. Modal: Movimiento de Caja Chica (Ingreso / Egreso)
* **Momento:** Accesible desde un nuevo boton en la cabecera de Pedidos y caja: `Movimiento de caja`.
* **Campos:**
  * Tipo de movimiento: Botones de seleccion `Egreso (Salida)` o `Ingreso (Entrada)`.
  * Concepto / Motivo: Lista desplegable (`Compra urgente de insumos`, `Compra de hielo/gas`, `Pago de recado/delivery externo`, `Retiro parcial a caja fuerte`, `Ingreso adicional de sencillo`, `Otro`).
  * Detalle / Descripcion: Campo de texto libre (ej. `Compra de 2 bolsas de hielo por falta de stock`).
  * Monto en Soles (obligatorio, ej. `s/ 18.00`).
  * Nro. de comprobante o recibo interno fisico respaldatorio.
* **Botones:** `Registrar Salida / Ingreso`, `Cancelar`.
* **Regla:** Todo egreso resta directamente del efectivo esperado en gaveta y genera una linea en el cierre.

#### C. Cobro Mejorado en Pedidos y Caja (Pestana "Cobro")
* **Nuevos campos en la pestana Cobro:**
  * Medio de pago: Selector (`Efectivo`, `Yape`, `Plin`, `Tarjeta POS`, `Transferencia`, `Credito personal`).
  * Si es Efectivo:
    * Campo `Monto recibido` (ej. cliente paga con billete de `s/ 50.00` una cuenta de `s/ 33.00`).
    * Campo automatico `Vuelto a entregar` en color contrastado (ej. `Vuelto: s/ 17.00`).
  * Si es Yape / Plin / Transferencia: Campo opcional para anotar los ultimos 4 digitos de la operacion bancaria.
  * Opcion de Pago Mixto (casilla de verificacion `Dividir pago`): permite especificar monto en Efectivo y el remanente en medio electronico.

#### D. Pantalla / Modal: Arqueo y Cierre del Dia (Corte Z)
* **Momento:** El cajero pulsa el boton `Cerrar Caja / Arqueo` al finalizar el servicio (22:00 hrs).
* **Mecanica (Arqueo Ciego):** El cajero ingresa primero lo que tiene fisicamente en la gaveta sin ver el resultado del sistema, para evitar que ajuste las cifras a conveniencia.
* **Campos del arqueo fisico:**
  * Tabla de conteo de billetes (S/ 200, S/ 100, S/ 50, S/ 20, S/ 10) y monedas (S/ 5, S/ 2, S/ 1, S/ 0.50, S/ 0.20, S/ 0.10). El sistema calcula el total fisico en soles.
  * Lote o total de vouchers de Tarjeta POS declarados (ej. `s/ 285.00`).
  * Total de pagos verificados por Yape y Plin segun celular de caja.
* **Resultado del Cuadre (visible tras ingresar el conteo):**
  * Comparacion automatica: Efectivo Contado vs. Efectivo del Sistema.
  * Indicador de Cuadre: `Caja Cuadrada` (verde), `Sobrante de Caja` (azul) o `Faltante de Caja` (rojo).
  * Campo de justificacion obligatoria si hay diferencia mayor a S/ 2.00.
* **Botones:** `Imprimir Pre-Cierre (Corte X)`, `Confirmar Cierre Definitivo (Corte Z)`.

---

### 3.2 Estructura del Reporte de Cierre del Dia (Ticket o Informe PDF)

Este es el formato y los datos de ejemplo recomendados para la cafetería Caprichos al cerrar el dia:

```text
============================================================
                   CAPRICHOS CAFETERIA
           Reporte de Cierre Diario de Caja (Corte Z)
============================================================
Fecha: 15/10/2026          Turno: Tarde / Noche (14:00 - 22:00)
Caja: Caja Principal 01    Cajero: Marta (cajera)
Impresion: 15/10/2026 22:15  Estado: CERRADO
------------------------------------------------------------
1. RESUMEN GENERAL DE VENTAS
------------------------------------------------------------
Total Pedidos Atendidos:                      38 pedidos
Venta Bruta Total:                           s/ 1,326.50
(-) Descuentos por promociones (combos/2x1): s/   -25.00
(-) Descuentos por cupones aplicados:        s/   -10.00
(-) Descuento personal (25% en CP-P07):      s/    -7.00
------------------------------------------------------------
VENTA NETA TOTAL DEL DIA:                    s/ 1,284.50
Ticket Promedio (Venta Neta / Pedidos):      s/    33.80

------------------------------------------------------------
2. VENTAS POR CANAL Y MODALIDAD
------------------------------------------------------------
Canal:
- Salon (Mesas y barra):                     s/   590.87 (46 %)
- Delivery propio (Web y telefono):          s/   359.66 (28 %)
- Web recojo en tienda:                      s/   179.83 (14 %)
- WhatsApp chatbot (Capri):                  s/   154.14 (12 %)

Modalidad:
- En Mesa (Salon):                           s/   590.87 (18 pedidos)
- Para Llevar (Mostrador / Web):             s/   334.00 (11 pedidos)
- Delivery a domicilio:                      s/   359.63 ( 9 pedidos)

------------------------------------------------------------
3. VENTAS POR MEDIO DE PAGO
------------------------------------------------------------
- Efectivo en caja:                          s/   420.00 (13 pedidos)
- Yape:                                      s/   380.00 (11 pedidos)
- Plin:                                      s/   150.00 ( 5 pedidos)
- Tarjeta de Credito / Debito (POS):         s/   285.00 ( 7 pedidos)
- Transferencia bancaria:                    s/    28.50 ( 1 pedido)
- Credito del personal por cobrar:           s/    21.00 ( 1 pedido)
------------------------------------------------------------
TOTAL VENTAS POR MEDIOS DE PAGO:             s/ 1,284.50  [CUADRA]

------------------------------------------------------------
4. MOVIMIENTO FISICO DE EFECTIVO EN GAVETA
------------------------------------------------------------
(+) Saldo inicial de caja (sencillo de apertura): s/ 150.00
(+) Ventas cobradas en efectivo hoy:              s/ 420.00
(+) Cobranzas de creditos de personal en efectivo:s/   0.00
(+) Otros ingresos de efectivo en turno:          s/   0.00
(-) Egresos / Gastos menores de caja chica:
    * Egr 01: Compra urgente de hielo (recibo):   s/ -15.00
    * Egr 02: Taxi para traslado de insumo:       s/ -12.00
------------------------------------------------------------
EFECTIVO ESPERADO EN GAVETA:                      s/ 543.00

------------------------------------------------------------
5. ARQUEO FISICO Y CUADRE DE CAJA
------------------------------------------------------------
Billetes y monedas contados en gaveta:            s/ 543.00
Diferencia de caja (Contado - Esperado):          s/   0.00
Estado del cuadre:                                CAJA CUADRADA

------------------------------------------------------------
6. CONTROL DE CREDITOS DEL PERSONAL
------------------------------------------------------------
Saldo deudor al iniciar el dia:                   s/ 146.40
(+) Nuevos creditos otorgados hoy (CP-P07):       s/  21.00
(-) Deudas canceladas o cobradas hoy:             s/   0.00
------------------------------------------------------------
SALDO TOTAL POR COBRAR AL PERSONAL:               s/ 167.40
(Detalle: Marta s/ 48.00, Luis s/ 31.50, Rosa s/ 22.50,
 Pedro s/ 18.00, Jorge s/ 26.40, Nuevo s/ 21.00)

------------------------------------------------------------
7. CONTROL DE FIDELIZACION Y PROMOCIONES
------------------------------------------------------------
- Puntos emitidos hoy (1 pt por s/ 1 cobrado):    1,284 pts
- Clientes identificados con cuenta DNI:             16 clientes
- Cupones promocionales impresos en tickets:         38 cupones
- Cupones canjeados en compras del dia:               2 cupones

------------------------------------------------------------
Responsable de Caja: ____________________  Marta (cajera)
Visto Bueno Gerencia: ___________________  Kevin Rosales
============================================================
```

---

### 3.3 Indicadores que DEBEN cuadrar entre si (Reglas de Control Matematico)

Para asegurar la integridad contable del negocio y evitar fugas de dinero, el sistema debe validar automaticamente las siguientes ecuaciones antes de autorizar el cierre:

1. **Ecuacion Fundamental del Arqueo de Caja (Efectivo Fisico):**
   $$\text{Efectivo Esperado en Gaveta} = \text{Fondo Inicial de Apertura} + \text{Ventas en Efectivo} + \text{Cobranzas de Deudas en Efectivo} - \text{Egresos de Caja Chica}$$
   $$\text{Diferencia de Arqueo} = \text{Efectivo Fisico Contado} - \text{Efectivo Esperado}$$
   * *Regla:* Si la diferencia es igual a 0.00, la caja esta **Cuadrada**. Si es mayor a 0, existe **Sobrante**. Si es menor a 0, existe **Faltante** y se exige justificacion formal.

2. **Ecuacion de Ventas Netas vs. Medios de Pago:**
   $$\text{Venta Neta Total} = \text{Venta Bruta} - (\text{Descuentos Promocionales} + \text{Descuentos Cupones} + \text{Descuento Personal})$$
   $$\text{Total Cobrado} = \text{Efectivo} + \text{Yape} + \text{Plin} + \text{Tarjetas} + \text{Transferencias} + \text{Creditos por Cobrar}$$
   * *Regla:* La `Venta Neta Total` debe ser **identica al centavo** al `Total Cobrado`. No puede haber ventas sin medio de pago registrado.

3. **Ecuacion de Consistencia por Canal y Modalidad:**
   $$\text{Ventas Totales} = \text{Ventas Salon} + \text{Ventas Delivery} + \text{Ventas Web Recojo} + \text{Ventas WhatsApp}$$
   $$\text{Ventas Totales} = \text{Modalidad Mesa} + \text{Modalidad Para Llevar} + \text{Modalidad Delivery}$$
   * *Regla:* La suma de ventas desglosadas por canal debe ser exactamente igual a la suma desglosada por modalidad.

4. **Ecuacion del Ticket Promedio:**
   $$\text{Ticket Promedio} = \frac{\text{Venta Neta Total}}{\text{Numero de Pedidos Cerrados y Cobrados}}$$
   * *Regla:* No se deben incluir en el divisor los pedidos cancelados o rechazados.

5. **Ecuacion de la Cartera de Creditos del Personal:**
   $$\text{Saldo Final de Creditos} = \text{Saldo Inicial} + \text{Nuevos Creditos del Dia} - \text{Cobranzas/Abonos del Dia}$$
   * *Regla:* Un credito otorgado suma a la venta neta del dia pero **no entra** al efectivo de gaveta; queda registrado en cuentas por cobrar hasta su pago efectivo.

6. **Ecuacion de Emision de Puntos:**
   $$\text{Puntos Otorgados en el Dia} = \sum \lfloor \text{Total Cobrado de Pedidos con DNI registrado} \rfloor$$
   * *Regla:* Solo suman puntos los pedidos en estado cobrado con cuenta de cliente o personal verificada.

---

## 4 Preguntas para el dueno (Kevin)

Para cerrar estas definiciones funcionales antes de presentar el diseno final del sistema, es indispensable validar con Kevin Rosales las siguientes decisiones de negocio:

1. **Fondo inicial de sencillo:** ¿Con que monto fijo de sencillo abre caja habitualmente Caprichos al iniciar el dia (ej. S/ 100 o S/ 150)? ¿Ese monto queda fijo en la gaveta o se retira integro al final del dia?
2. **Politica ante faltantes de dinero:** Si al final del turno hay un faltante de efectivo en el arqueo, ¿se le descuenta directamente a la cajera de su liquidacion o existe un margen de tolerancia para pequenos descuadres de monedas?
3. **Pagos combinados (mixtos):** ¿Con que frecuencia un cliente pide pagar una parte en efectivo y otra con Yape o tarjeta? ¿Es indispensable permitir dividir el cobro de una misma cuenta en dos medios de pago desde la primera version?
4. **Gastos menores de caja chica:** ¿Se permite que el personal tome dinero de la gaveta para compras menores imprevistas (hielo, leche de urgencia, pasajes)? ¿Quien debe autorizar estos egresos?
5. **Cobranza del credito del personal:** Cuando un trabajador paga su consumo a credito (hasta 15 dias), ¿paga en efectivo directamente en la caja o Kevin lo descuenta de su pago de quincena/fin de mes fuera del sistema?
6. **Manejo de turnos:** ¿El local opera con un unico turno corrido con una sola responsable de caja (de 14:00 a 22:00) o hay relevo de cajeras a media tarde que exija hacer un corte intermedio (Corte X)?
7. **Reglas para canje de puntos:** Ya esta definido que el cliente gana 1 punto por cada S/ 1 gastado, pero ¿cuanto vale cada punto al momento de usarlo? (Por ejemplo: ¿100 puntos equivalen a S/ 5 de descuento, o los puntos se canjean por productos especificos como una dona o un americano?).
8. **Propinas en tarjeta y medios digitales:** Si un cliente deja propina mediante tarjeta POS o Yape, ¿esa propina ingresa a la cuenta del negocio y se liquida luego en efectivo, o las propinas se manejan unicamente de mano en mano en efectivo?

---
INFORME LISTO.

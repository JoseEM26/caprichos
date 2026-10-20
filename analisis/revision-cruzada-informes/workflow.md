---
id: ANA-CAP-056
tipo: analisis
titulo: "INFORME DE AUDITORIA DE FLUJO DE TRABAJO (WORKFLOW) END-TO-END"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, revision-cruzada-informes]
---

# INFORME DE AUDITORIA DE FLUJO DE TRABAJO (WORKFLOW) END-TO-END

**Sistema:** Plataforma Digital Caprichos (Cafeteria artesanal, Lima)  
**Archivos fuente auditados:** `fuente/Admin.dc.html`, `fuente/Main.dc.html`, `fuente/Chatbot.dc.html`, `bot/bot_wa.py`, `bot/AGENTS.md`  
**Documentacion de referencia:** `docs/flujo-de-pedidos.md`, `docs/modulos-y-roles.md`, `docs/cierre-de-caja.md`, `docs/pantalla-cocina.md`, `docs/acta-01-descubrimiento.md`, `docs/acta-02-descubrimiento.md`, `docs/BRD.md`, `referencia/restaurantpe-caja.md`  
**Destino del informe:** `/tmp/claude-1000/qa-agy/informes/workflow.md`  

---

## 1. RESUMEN EJECUTIVO

El presente informe reconstruye y evalua de forma exhaustiva el ciclo de vida de un pedido en la plataforma digital de la cafeteria Caprichos, abarcando sus seis canales de venta: Carta web, Chatbot de WhatsApp, Llamada al Call Center, Mozo en mesa (salon), Mozo para llevar/delivery y Pedido del personal a credito.

La auditoria confronto la implementacion viva en el codigo fuente (`fuente/Admin.dc.html`, `fuente/Main.dc.html`, `fuente/Chatbot.dc.html`), el bot de produccion (`bot/`), las actas de descubrimiento con el cliente Kevin Rosales y los documentos funcionales de diseno. Se identificaron quince (15) hallazgos criticos de flujo operativo, callejones sin salida, pedidos huerfanos, avisos no emitidos y descuadres financieros sistematicos entre pedidos, arqueo de caja e informes estadisticos.

---

## 2. RECONSTRUCCION DEL CICLO DE VIDA POR CANAL

A continuacion se describe para cada canal: quien lo crea, la secuencia de estados, el rol responsable, los avisos/notificaciones que se generan, el descuento de inventario, la cobranza y su liquidacion en el cierre de caja. Cada paso ha sido verificado contra las funciones reales de `fuente/Admin.dc.html` y piezas asociadas.

```
ESTADOS FORMALES EN EL SISTEMA (STATUS en Admin.dc.html):
- nuevo: "Por confirmar"
- cola: "En cocina · nuevo"
- prep: "Preparando"
- listo: "Listo"
- ruta: "En camino"
- entregado: "Entregado"
- rechazado: "Rechazado"

ESTADOS VIRTUALES / BANDERAS COMPLEMENTARIAS:
- servido: bandera booleana (servido: true) sobre estado listo en pedidos de mesa.
- anulado: objeto de auditoria (anulado: { motivo, por, pin }) guardado bajo status 'rechazado'.
```

---

### CANAL 1: CARTA WEB (Clientes remotos)

#### Diagrama de flujo en texto
```
[Cliente en Main.dc.html]
       |
       v (Navega carta, arma carrito, selecciona entrega y pago preferido)
       v (Presiona "¿Enviar tu pedido?" -> overlay: 'done')
[Estado: nuevo ("Por confirmar")] <--- (En Admin.dc.html simulado en SEED / newOrder)
       |
       +---> Notificacion 'acc' a: Admin, Cajero, Call Center, Mozo
       |
       +---> [Rechazar] (rejectSel) --------------------------> [Estado: rechazado]
       |                                                            (Fin del flujo)
       v
[Accion: Confirmar pedido y pago] (openPc -> modal isPc)
       | Responsable: Admin, Cajero, Call Center o Mozo
       | - Abre chat WhatsApp (wa.me) con resumen prellenado
       | - Marca casilla obligatoria: "Ya hable con el cliente..."
       | - Elige medio de pago y sube comprobante (Yape/Plin/Transf.) o vuelto (Efectivo)
       | - Presiona "Confirmar y enviar a cocina" (pcConfirm -> acceptOrder)
       v
[Estado: cola ("En cocina · nuevo")]
       | - Se descuenta stock de insumos y combos (acceptEffects)
       | - Se emite comanda y etiquetas (prints: 1, tkPrinter: 192.168.1.201)
       | - Pedido queda marcado como cobrado (paid: true, payBy, payAt)
       | - Cocina recibe alerta sonora (kBeep)
       v
[Pantalla de Cocina / Barra] (view: 'cocina')
       | Responsable: Cocina / Barra
       | - Columna NUEVOS: presiona "Empezar a preparar" (kcol adv)
       v
[Estado: prep ("Preparando")]
       | - Columna EN PREPARACION: presiona "Marcar listo" (kcol adv)
       v
[Estado: listo ("Listo")]
       | - Cocina puede presionar "Despejar" (kcol clear -> kcl[area] = true)
       |
       +---> Si modalidad es PARA LLEVAR:
       |        - Cliente retira en tienda.
       |        - Responsable: Cajero / Admin.
       |        - Accion: "Entregar al cliente y cerrar" (deliverSel).
       |        - Estado pasa a: [entregado].
       |
       +---> Si modalidad es DELIVERY:
                - Aparece en modulo Repartos como "Disponible".
                - Notificacion 'rep' a: Repartidor.
                - Repartidor presiona "Tomar pedido" (rider: me).
                - Repartidor presiona "Salir a repartir" (label: Salir a repartir).
                - Estado pasa a: [ruta].
                - Repartidor llega al domicilio y presiona "Entregar al cliente" (act).
                - Estado pasa a: [entregado].
       v
[Cierre de Caja] (view: 'cierre')
       - El pedido tiene paid: true y entra a cjOrders.
       - Suma al total vendido del turno (cjVent[medio]).
       - Al cerrar caja (doCerrar), queda sellado con cajaId: CZ-XXXX.
```

#### Detalle operativo verificado
- **Quien lo crea:** El cliente desde el navegador en `fuente/Main.dc.html`. Sin embargo, `Main.dc.html` no escribe en `localStorage` (hueco D-08); en el administrativo se carga desde datos iniciales `SEED` o mediante depuracion `newOrder`.
- **Estados:** `nuevo` -> `cola` -> `prep` -> `listo` -> (`ruta`) -> `entregado`. Alternativa de cancelacion: `rechazado`.
- **Roles participantes:** Cliente (creacion), Cajero/Call Center/Mozo/Admin (confirmacion de pago), Cocina (elaboracion), Repartidor (traslado si es delivery), Cajero (cierre y entrega si es recojo).
- **Avisos recibidos:** Al crearse, se activa la notificacion `acc` (`Admin.dc.html`, linea 4188) para `admin`, `cajero`, `callcenter`, `mozo` ("X pedidos por confirmar"). En cocina suena `kBeep()` (`Admin.dc.html`, linea 3280). Si es delivery listo, notificacion `rep` para `repartidor` (linea 4192).
- **Descuento de stock:** Ocurre en `acceptEffects(o)` (`Admin.dc.html`, lineas 3266-3274) unicamente al ejecutarse `acceptOrder` tras confirmar el pago. Descuenta insumos en `stock` y anota en `stockLog`.
- **Cobro y liquidacion:** Se cobra por anticipado en el modal `isPc`. Si es Yape, Plin o Transferencia, se adjunta comprobante. Al estar cobrado antes de salir (`paid: true`), no requiere liquidacion de efectivo por el repartidor y computa directamente en `cjVent` de la caja del turno.

---

### CANAL 2: CHATBOT WHATSAPP (Clientes por mensajeria)

#### Diagrama de flujo en texto
```
[Cliente en WhatsApp / Chatbot.dc.html]
       |
       v (Conversa con asistente Capri, elige modalidad, direccion y productos)
       v (Confirma productos, costo de envio y forma de pago preferida)
       v (Mensaje final: "Anotado... Todavia no pagues: una persona te escribira")
[Estado: nuevo ("Por confirmar")] <--- (Simulado en SEED en Admin.dc.html)
       |
       +---> Notificacion 'acc' a personal de atencion
       |
       v
[Accion: Confirmar pedido y pago] (openPc en Admin.dc.html)
       | Responsable: Call Center, Cajero o Administrador
       | - Abre chat de WhatsApp para validar datos y monto
       | - Cajero/Operador sube comprobante verificado
       | - Confirma y pasa a cocina (pcConfirm)
       v
[Estado: cola ("En cocina · nuevo")]
       | - Descuento de insumos en stock (acceptEffects)
       | - Impresion de comanda en ticketera de cocina (prints: 1)
       | - Marcado como cobrado (paid: true)
       v
[Estado: prep ("Preparando")]
       | Responsable: Cocina
       v
[Estado: listo ("Listo")]
       | Responsable: Cocina
       |
       +---> Delivery: Repartidor lo toma -> [ruta] -> [entregado]
       +---> Para llevar: Cajero despacha -> [entregado]
       v
[Cierre de Caja]
       - Registrado como venta del turno por el medio validado.
```

#### Detalle operativo verificado
- **Quien lo crea:** El cliente conversando con el bot de WhatsApp. En el bot real (`bot/bot_wa.py`), el bot procesaba y notificaba a un telefono personal (discordancia D-13); en el simulador `fuente/Chatbot.dc.html` termina en `doneOrder` sin persistencia compartida (hueco D-08).
- **Estados:** `nuevo` -> `cola` -> `prep` -> `listo` -> (`ruta`) -> `entregado` (o `rechazado`).
- **Roles participantes:** Cliente, Call Center/Cajero/Admin (confirmador), Cocina/Barra, Repartidor.
- **Avisos recibidos:** Notificacion `acc` en la campana de atencion. Si el cliente solicita hablar con una persona desde el chatbot, se genera la alerta `cli-` en notificaciones para atenderlo por WhatsApp (`Admin.dc.html`, linea 4180).
- **Descuento de stock:** En `acceptEffects(o)` al confirmarse el pedido por el operador humano.
- **Cobro y liquidacion:** Similar a la carta web. El cliente no transfiere hasta que el operador humano lo contacta. El operador valida la acreditacion en la cuenta bancaria de la empresa y sube la captura.

---

### CANAL 3: LLAMADA AL CALL CENTER (Venta asistida por telefono / manual)

#### Diagrama de flujo en texto
```
[Operador Call Center en Admin.dc.html]
       |
       v (Presiona "Nuevo pedido" [openMo] en vista Pedidos y caja)
       v (Elige modalidad: Delivery o Para llevar)
       v (Busca ubicacion en mapa Nominatim, ingresa nombre, celular y productos)
       v (Presiona "¿Registrar el pedido de...?" [sendMo0])
[Estado: nuevo ("Por confirmar")] <--- (Bloqueo: no pasa directo a cocina)
       |
       v
[Accion: Confirmar pedido y pago] (openPc)
       | Responsable: Operador Call Center / Cajero
       | - Debe volver a abrir el pedido recien creado
       | - Valida medio de pago acordado por telefono
       | - Si es contra entrega (Efectivo/Tarjeta): confirma sin voucher (paid: false)
       | - Si es transferencia previa: sube voucher (paid: true)
       | - Presiona "Confirmar y enviar a cocina" (pcConfirm)
       v
[Estado: cola ("En cocina · nuevo")]
       | - Descuento de insumos en stock (acceptEffects)
       | - Impresion de comanda de cocina y etiquetas
       v
[Estado: prep ("Preparando")]
       v
[Estado: listo ("Listo")]
       |
       v (Si es Delivery: pasa a modulo Repartos)
[Estado: ruta ("En camino")]
       | Responsable: Repartidor asignado
       |
       +---> Si pago por adelantado:
       |        - Repartidor entrega y presiona "Entregar al cliente".
       |        - Estado: [entregado].
       |
       +---> Si es CONTRA ENTREGA (paid: false):
                - Repartidor entrega y presiona accion (abre modal cbOpenFor).
                - Repartidor cobra efectivo o billetera digital al cliente.
                - Registra monto y vuelto: paid: true, cobroRider: me, liq: false.
                - Estado: [entregado].
                - Dinero retenido fuera de caja (cjHold).
       v
[Liquidacion del Repartidor en Caja]
       | Responsable: Cajero / Administrador
       | - En modulo Caja y cierres -> panel liqRows ("Recibir s/ ... de Repartidor X").
       | - Cajero recibe el dinero en efectivo del motorizado.
       | - Se actualiza el pedido con: liq: true, liqBy: role.n.
       | - El efectivo ingresa oficialmente a cjVent.Efectivo y cjEsp.
       v
[Cierre de Caja]
       - Se verifica el turno y se arquea el efectivo fisico en boveda/gaveta.
```

#### Detalle operativo verificado
- **Quien lo crea:** Operadora de Call Center (`s.role === 'callcenter'`).
- **Estados:** `nuevo` -> `cola` -> `prep` -> `listo` -> `ruta` -> `entregado`.
- **Roles participantes:** Call Center (toma y confirmacion), Cocina (elaboracion), Repartidor (reparto y eventual cobranza), Cajero (liquidacion de efectivo y cierre).
- **Avisos recibidos:** Al crearse en `nuevo`, aparece en pendientes del escritorio del call center y notificacion `acc`. Si el repartidor tiene problemas en ruta ("cliente no contesta" o "no encuentro la direccion"), se genera la alerta `fallo-` (`Admin.dc.html`, linea 4184) para Call Center y Caja con enlace directo a WhatsApp.
- **Descuento de stock:** En `acceptEffects(o)` cuando se confirma el pedido.
- **Cobro y liquidacion:** Si el pago es contra entrega, el repartidor actua como agente de cobranza en calle (`cbd` en vista repartos). El pedido queda con `liq: false` y no entra al efectivo esperado de caja hasta que el cajero pulsa "Recibir" en `liqRows` (`Admin.dc.html`, linea 3611).

---

### CANAL 4: MOZO EN MESA (Salon / Consumo en el local)

#### Diagrama de flujo en texto
```
[Mozo en tablet en Admin.dc.html]
       |
       v (Presiona "Nuevo pedido" [openMo] en vista Pedidos y caja)
       v (Elige modalidad: "En el local (mesa)")
       v (Selecciona mesa en plano interactivo, ej. Mesa 7 [M07])
       v (Arma pedido: variantes, leches, dulces, cremas, extras y notas)
       v (Asocia DNI de comensal para puntos o marca "Sin cuenta")
       v (Presiona "Enviar a caja" -> ejecuta sendMo0 para local)
[Estado: cola ("En cocina · nuevo")] <--- (INGRESO DIRECTO SIN CAJA)
       | - Mesa queda marcada como ocupada en el plano (mesaOv)
       | - Insumos se descuentan de inmediato (acceptEffects)
       | - Comanda y etiquetas se imprimen en cocina (prints: 1)
       | - Pedido queda sin cobrar (paid: false)
       v
[Pantalla de Cocina / Barra]
       | Responsable: Cocina / Barra
       | - NUEVOS: presiona "Empezar a preparar"
       v
[Estado: prep ("Preparando")]
       | - EN PREPARACION: presiona "Marcar listo"
       v
[Estado: listo ("Listo")]
       |
       +---> Notificacion 'listo-CP-XXXX' a: Mozo ("Mesa X lista para llevar")
       |
       v
[Accion: Servir en mesa] (serveSel en Admin.dc.html)
       | Responsable: Mozo / Cajero / Admin
       | - Mozo lleva la bandeja a la mesa de los clientes.
       | - Mozo presiona: "Ya lo lleve a la mesa".
       | - El pedido adquiere la bandera: servido: true.
       | - El estado principal se mantiene en: listo.
       v
[Solicitud de Cuenta y Precuenta] (openPre -> modal isPre)
       | Responsable: Mozo / Cajero
       | - Muestra resumen y codigo QR de transferencia bancaria en pantalla.
       v
[Cobro en Caja] (collectSel -> modal cbd)
       | Responsable: Cajero / Administrador
       | - Cajero selecciona comprobante: Nota de venta, Boleta o Factura.
       | - Cajero abre cobro: Efectivo, Tarjeta POS, Yape, Plin, Transferencia o Mixto.
       | - Si es efectivo: calcula vuelto automatico segun recibido.
       | - Confirma cobro: paid: true, recibido, vuelto, cobradoPor, cobradoAt.
       | - Si el cliente tenia DNI, se abonan 1 punto por sol en cliSave.
       v
[Cierre y Liberacion de Mesa] (deliverSel)
       | Responsable: Cajero / Administrador
       | - Presiona: "Entregar al cliente y cerrar".
       | - Estado pasa a: [entregado].
       | - Mesa queda libre en el plano para un nuevo grupo.
       v
[Cierre de Caja]
       - El pedido se liquida en el arqueo del turno actual.
```

#### Detalle operativo verificado
- **Quien lo crea:** Mozo (`s.role === 'mozo'`) desde su tablet en salon.
- **Estados:** `cola` -> `prep` -> `listo` (con `servido: true`) -> `entregado`. NO pasa por `nuevo` ni `ruta`.
- **Roles participantes:** Mozo (comanda y servicio), Cocina (elaboracion), Cajero (precuenta, cobro y despacho final).
- **Avisos recibidos:** Cuando cocina marca el pedido como listo, se dispara la notificacion especifica `listo-` (`Admin.dc.html`, linea 4182) dirigida exclusivamente al rol `mozo` con el boton de accion rapida "Ya lo lleve".
- **Descuento de stock:** Inmediato al momento de crearse el pedido en mesa (`Admin.dc.html`, linea 4075).
- **Cobro y liquidacion:** Se cobra al finalizar el consumo en el modulo de caja. El mozo no cobra dinero (cumpliendo la regla directriz de Kevin Rosales). El cajero registra los medios reales y emite el comprobante.

---

### CANAL 5: MOZO / CAJA PARA LLEVAR O DELIVERY EN LOCAL

#### Diagrama de flujo en texto
```
[Mozo o Cajero en mostrador]
       |
       v (Presiona "Nuevo pedido" y elige "Para llevar" o "Delivery")
       v (Arma pedido con productos de mostrador o despacho rapido)
       v (Presiona "¿Registrar el pedido de...?" [sendMo0])
[Estado: nuevo ("Por confirmar")] <--- (Bloqueo indebido para venta presencial)
       |
       v
[Accion: Confirmar pedido y pago] (openPc)
       | Responsable: Cajero / Mozo
       | - Debe validar el pago y forzar la confirmacion
       v
[Estado: cola ("En cocina · nuevo")]
       | - Descuento de insumos (acceptEffects) e impresion termica
       v
[Estado: prep ("Preparando")]
       v
[Estado: listo ("Listo")]
       |
       +---> [AVISO QUE NADIE RECIBE]: No genera alerta a caja ni mozo
       |
       v
[Entrega en Mostrador] (deliverSel)
       | Responsable: Cajero / Administrador
       | - Si ya estaba cobrado: marca entregado.
       | - Si estaba sin cobrar: abre cobro (cbd) y simultaneamente entrega.
       v
[Estado: entregado ("Entregado")]
       v
[Cierre de Caja]
```

#### Detalle operativo verificado
- **Quien lo crea:** Cajero o Mozo en mostrador.
- **Estados:** `nuevo` -> `cola` -> `prep` -> `listo` -> `entregado`.
- **Roles participantes:** Mozo/Cajero (toma), Cajero (cobro), Cocina (empaque).
- **Avisos recibidos:** Notificacion inicial `acc`. Al quedar listo, NO se genera ninguna alerta (hueco D-03).
- **Descuento de stock:** En `acceptEffects(o)` tras confirmar en `openPc`.
- **Cobro y liquidacion:** Se cobra en caja antes o al momento de entregar en ventanilla.

---

### CANAL 6: PEDIDO DEL PERSONAL A CREDITO

#### Diagrama de flujo en texto
```
[Colaborador solicita compra a credito de personal]
       |
       v
[Cajero o Mozo en Admin.dc.html]
       | - Presiona "Pedido del personal" (openMoStaff -> mo.who = 'personal')
       | - Selecciona al colaborador de la lista STAFF (Marta, Luis, Rosa, Pedro, etc.)
       | - Modalidad restringida a: Salon o Para llevar (delivery bloqueado)
       | - Registra comanda
       v
[Estado: cola (si es salon) o nuevo (si es para llevar)]
       | - Descuento de stock de insumos en cocina
       v
[Cocina elabora el pedido] -> [prep] -> [listo]
       |
       v
[Cobro a Credito en Pedidos y Caja] (openCr -> modal isCr)
       | Responsable: Cajero / Administrador
       | - Selecciona al colaborador beneficiario
       | - Sistema calcula descuento automatico del 25% (credPct)
       | - Excluye expresamente combos, docenas y promociones
       | - Muestra total original, descuento, monto a pagar y fecha de vencimiento (15 dias)
       | - Presiona "Cobrar a credito" (crConfirm)
       v
[Pedido queda cobrado a credito]
       | - paid: true, pay: 'Credito del personal', total: crCalc.pay
       | - Se genera vale de consumo: CP-PXX
       | - Se inserta en tabla de Creditos del Personal (credAdded)
       v
[Impacto en Caja del Turno] <--- [DESCUADRE FINANCIERO D-05]
       | - El pedido entra a cjOrders (porque paid === true).
       | - Como pay no es efectivo ni tarjeta, cjMedioOf lo clasifica como "Otros".
       | - Suma a las ventas del dia (cjVent['Otros'].t += o.total).
       | - En el arqueo fisico se le pide al cajero contar "Otros" (dinero inexistente).
       v
[Mes siguiente: Liquidacion del Credito / Abono del Trabajador] (doAb)
       | Responsable: Cajero / Administrador en modulo Creditos
       | - Trabajador abona s/ X a su vale CP-PXX.
       | - Si paga en Efectivo: se inserta movimiento de "Ingreso extra" en caja (ses.movs).
       |   (DUPLICIDAD: se cuenta como venta el dia 1 y como ingreso el dia del abono).
       | - Si paga con Yape/Transferencia: NO se registra ningun movimiento en caja.
```

#### Detalle operativo verificado
- **Quien lo crea:** Cajero o Mozo identificando a un colaborador activo.
- **Estados:** Pasa por cocina (`cola` -> `prep` -> `listo`) y se cierra como `entregado` al liquidarse en `openCr`.
- **Roles participantes:** Colaborador solicitante, Mozo/Cajero, Administrador (quien fija politicas de credito).
- **Descuento de stock:** Se descuenta en cocina de igual manera que cualquier venta comercial.
- **Cobro y liquidacion:** Se liquida contablemente con cargo a la cuenta corriente del colaborador (descuento por planilla o abono en caja hasta 15 dias). Genera graves discordancias de caja (hallazgo D-05).

---

## 3. MATRIZ DE COMPARACION ENTRE CANALES

| Canal de Venta | Quien lo Crea | Estado Inicial | Valida Pago Previo | Descuento Stock | Rol Despacho | Medio de Cobro | Modo Liquidacion en Caja |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Carta Web** | Cliente remoto | `nuevo` | Si (WhatsApp + voucher) | Al confirmar | Repartidor / Cajero | Yape, Plin, Transf., Efectivo, Tarjeta | Venta directa del turno (`cjVent`) |
| **Chatbot WhatsApp** | Cliente por bot | `nuevo` | Si (WhatsApp + voucher) | Al confirmar | Repartidor / Cajero | Billeteras digitales o Efectivo | Venta directa del turno (`cjVent`) |
| **Call Center** | Operador telefonico | `nuevo` | Si (por sistema) | Al confirmar | Repartidor / Cajero | Anticipado o Contra entrega | Anticipado directo; Contra entrega via `liqRows` |
| **Mozo en Mesa** | Mozo en tablet | `cola` | No (va directo a KDS) | Al comandar | Mozo (servicio) / Cajero | Efectivo, Tarjeta, Yape, Plin en caja | Cobro en ventanilla al cierre de mesa |
| **Para Llevar Mostrador** | Cajero / Mozo | `nuevo` | Si (innecesario) | Al confirmar | Cajero | Efectivo, Tarjeta, Billetera digital | Venta en mostrador |
| **Credito Personal** | Cajero / Mozo | `cola` / `nuevo` | No (pago diferido) | Al comandar | Cajero | Credito (25% descuento) | Clasificado en "Otros"; abono diferido duplica ingreso |

---

## 4. HALLAZGOS Y ANOMALIAS DEL FLUJO DE TRABAJO (AUDITORIA RIGUROSA)

Cada hallazgo se presenta clasificado con su identificador unico, tipo, ubicacion exacta verificada por texto, explicacion de impacto operativo, nivel de prioridad y propuesta concreta de solucion en una sola frase.

---

### D-01: Imposibilidad de anular pedidos cobrados o confirmados con pago (Callejon sin salida)
- **Tipo:** Flujo / Callejon sin salida.
- **Donde esta cada lado:**
  - `fuente/Admin.dc.html`: condicion de control `canAnular: !!selOrder && [ 'cola', 'prep', 'listo', 'ruta' ].indexOf(selOrder.status) >= 0 && !selOrder.paid && [ 'admin', 'cajero', 'callcenter' ].indexOf(s.role) >= 0`.
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Cita textual de `fuente/Admin.dc.html`:
    `canAnular: !!selOrder && [ 'cola', 'prep', 'listo', 'ruta' ].indexOf(selOrder.status) >= 0 && !selOrder.paid && [ 'admin', 'cajero', 'callcenter' ].indexOf(s.role) >= 0`
- **Por que importa:** Si un cliente que pago por adelantado mediante Yape o transferencia solicita cancelar su pedido mientras esta en preparacion o en ruta, o si un comensal en salon devuelve un plato despues de haber pagado en caja, el sistema oculta por completo el boton "Anular pedido" (`!selOrder.paid` es falso). No existe ningun mecanismo en el sistema para anular la transaccion, registrar la devolucion del dinero ni emitir una Nota de Credito, dejando la comanda atascada sin salida legal ni contable.
- **Prioridad:** Alta.
- **Propuesta de arreglo:** Permitir que el administrador anule pedidos con `paid: true` mediante su clave PIN, registrando automaticamente el egreso del dinero en la caja del turno y emitiendo el comprobante de devolucion.

---

### D-02: Pedidos devueltos a tienda por delivery quedan atascados en bucle infinito (Pedido huerfano)
- **Tipo:** Flujo / Pedido huerfano.
- **Donde esta cada lado:**
  - `fuente/Admin.dc.html`: accion del repartidor `returnStore: ask('¿Devolver el pedido a la tienda?', 'Vuelve a la lista de disponibles y se queda sin repartidor. Caja decide qué hacer con el pedido.', () => this.setOrder(o.id, { status: 'listo', rider: '', fallo: undefined, devuelto: true }))`.
  - `fuente/Admin.dc.html`: accion de entrega en caja `canDeliver: selOrder.status === 'listo' && !isDelivery && canManage`.
  - `fuente/Admin.dc.html`: texto informativo `waitsRider: selOrder.status === 'listo' && isDelivery`.
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Cita textual de `fuente/Admin.dc.html`:
    `returnStore: ask('¿Devolver el pedido a la tienda?', 'Vuelve a la lista de disponibles y se queda sin repartidor. Caja decide qué hacer con el pedido.', () => this.setOrder(o.id, { status: 'listo', rider: '', fallo: undefined, devuelto: true }))`
    y condicion de entrega:
    `canDeliver: selOrder.status === 'listo' && !isDelivery && canManage`
- **Por que importa:** Cuando un motorizado no encuentra la direccion o el cliente no contesta y devuelve el pedido al local, el pedido regresa al estado `listo` con la bandera `devuelto: true`. Sin embargo, como `modal` sigue siendo `'delivery'`, la vista de Pedidos y caja muestra el texto *"Listo en cocina. Asigna un repartidor en la pestaña Repartos"* y bloquea el boton de entrega (`canDeliver` exige `!isDelivery`). Caja no tiene ningun boton para cerrar el pedido, cancelarlo o cambiarlo a recojo presencial, mientras que en el modulo Repartos el pedido vuelve a aparecer como "Disponible" para que otro motorizado lo vuelva a tomar por equivocacion.
- **Prioridad:** Alta.
- **Propuesta de arreglo:** Incorporar en la vista de caja un panel de resolucion para ordenes con `devuelto: true` que permita transformar el pedido a recojo en tienda, gestionar reenvio o anularlo definitivamente.

---

### D-03: Pedidos para llevar no generan aviso al ponerse listos en cocina (Aviso que nadie recibe)
- **Tipo:** Flujo / Aviso que nadie recibe.
- **Donde esta cada lado:**
  - `fuente/Admin.dc.html`: alertas de cocina listas en `orders.filter((o) => o.modal === 'local' && o.status === 'listo' && !o.servido)` y `orders.filter((o) => o.modal === 'delivery' && o.status === 'listo' && !o.rider)`.
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Cita textual de `fuente/Admin.dc.html`:
    `orders.filter((o) => o.modal === 'local' && o.status === 'listo' && !o.servido).forEach((o) => addN({ id: 'listo-' + o.id, prio: 'alta', t0: clockMin, roles: [ 'mozo' ], title: (o.mesa || 'Mesa') + ' lista para llevar', detail: 'El pedido ' + o.id + ' está listo en cocina. Llévalo a la mesa.'...`
    y para delivery:
    `const dispR = orders.filter((o) => o.modal === 'delivery' && o.status === 'listo' && !o.rider).length; if (dispR > 0) { addN({ id: 'rep', prio: 'media', t0: 1285, roles: [ 'repartidor' ]...`
- **Por que importa:** El motor de notificaciones del sistema solo genera alertas de pedidos listos para salon (`modal === 'local'`, aviso a mozos) y para delivery (`modal === 'delivery'`, aviso a repartidores). Los pedidos para llevar (`modal === 'llevar'`) quedan completamente excluidos: cuando cocina presiona "Marcar listo", ni el cajero, ni los mozos, ni el cliente reciben ningun aviso sonoro o visual, ocasionando que la comida se enfrie en el mostrador sin que nadie sepa que esta terminada.
- **Prioridad:** Alta.
- **Propuesta de arreglo:** Anadir un disparador de notificaciones para pedidos con `modal === 'llevar'` y `status === 'listo'` dirigido a los roles cajero y mozo con la accion directa de entregar al cliente.

---

### D-04: Cierre de caja ignora efectivo en poder de repartidores no liquidado (Discordancia de dinero)
- **Tipo:** Discordancia / Reglas de dinero que no cuadran.
- **Donde esta cada lado:**
  - `fuente/Admin.dc.html`: filtro de pedidos que impiden cerrar `const cjPend = orders.filter((o) => !o.paid && o.status !== 'rechazado')`.
  - `fuente/Admin.dc.html`: validacion en cierre `if (cjPend.length) { bad('Hay pedidos sin cobrar o por confirmar.'); return; }`.
  - `fuente/Admin.dc.html`: retencion de efectivo de motorizados `const cjHold = (o, m) => !!o.cobroRider && o.liq === false && m === 'Efectivo'`.
  - `fuente/Admin.dc.html`: eliminacion de cola de liquidacion `const os = orders.filter((o) => o.cobroRider === r && o.liq === false && !o.cajaId)`.
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Cita textual de `fuente/Admin.dc.html`:
    `const cjPend = orders.filter((o) => !o.paid && o.status !== 'rechazado');`
    y en el cierre:
    `if (cjPend.length) { bad('Hay pedidos sin cobrar o por confirmar.'); return; }`
    y en el estampado de cajaId:
    `orders: this.state.orders.map((o) => (ids[o.id] ? Object.assign({}, o, { cajaId: rec.id }) : o))`
- **Por que importa:** Cuando un repartidor cobra un delivery en efectivo contra entrega, el pedido se marca `paid: true`, `cobroRider: 'r1'`, `liq: false`. Como `paid` es verdadero, el pedido NO entra en `cjPend` y el sistema permite que el cajero cierre la caja del dia. Debido a que `cjHold` retiene el efectivo, este dinero no se suma al efectivo esperado de la caja. Lo mas grave es que al ejecutarse el cierre, el sistema estampa `cajaId` en todos los pedidos cobrados, provocando que la orden deje de cumplir la condicion `!o.cajaId` en `liqRows`: la deuda del repartidor desaparece de la pantalla de liquidaciones y el efectivo cobrado en la calle se pierde de la contabilidad sin ingresar jamas a la gaveta.
- **Prioridad:** Alta.
- **Propuesta de arreglo:** Impedir el cierre de caja si existen ordenes con `cobroRider` y `liq === false`, obligando a liquidar todo el efectivo de los motorizados antes del arqueo final.

---

### D-05: Doble conteo de ingresos y arqueo irreal en Credito del Personal (Discordancia de dinero)
- **Tipo:** Discordancia / Reglas de dinero que no cuadran.
- **Donde esta cada lado:**
  - `fuente/Admin.dc.html`: clasificacion a "Otros" `const cjMedioOf = (p) => (CJ_MEDIOS.indexOf(p) >= 0 ? p : 'Otros')`.
  - `fuente/Admin.dc.html`: cobro a credito `this.setOrder(crOrder.id, { paid: true, pay: 'Crédito del personal', total: crCalc.pay, credWho: st.n })`.
  - `fuente/Admin.dc.html`: abono posterior en efectivo `const mov = { id: 'M' + (ses.movs.length + 1), tipo: 'ingreso', monto: Math.round(mo * 100) / 100, motivo: 'Abono de crédito ' + q.doc...`.
  - `fuente/Admin.dc.html`: conteo manual de cierre `cjMan: [ 'Yape', 'Plin', 'Transferencia', 'Tarjeta', 'Otros' ].map...`.
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Cita textual de `fuente/Admin.dc.html`:
    `this.setOrder(crOrder.id, { paid: true, pay: 'Crédito del personal', total: crCalc.pay, credWho: st.n });`
    y en caja:
    `const cjOrders = orders.filter((o) => o.paid && !o.cajaId && o.status !== 'rechazado');`
    y en el abono:
    `q.medio === 'Efectivo' ? ' Como es en efectivo, entra a la caja del turno como ingreso.' : ''`
- **Por que importa:** El consumo a credito de un trabajador se registra como pedido cobrado (`paid: true`) y entra a `cjOrders` mapeado como venta en "Otros", inflando los ingresos del dia en que se consumio el producto sin haber ingresado dinero. Dias despues, cuando el colaborador abona su deuda en efectivo, el sistema registra un "Ingreso extra" en la caja del turno, duplicando la contabilizacion del dinero. Ademas, durante el arqueo de cierre diario, el sistema exige al cajero contar fisicamente el rubro "Otros", el cual carece de billetes o cuenta bancaria asociada, generando descuadres ficticios permanentes. Por ultimo, si el trabajador abona mediante Yape o transferencia, el sistema no registra ningun movimiento en caja, perdiendo el rastro del abono bancario.
- **Prioridad:** Alta.
- **Propuesta de arreglo:** Desvincular las ordenes a credito de las ventas del turno en caja manteniendolas como cuentas por cobrar, y reconocer el ingreso financiero unicamenta al momento del pago efectivo o transferencia.

---

### D-06: Consumos adicionales en mesa crean pedidos aislados sin unificar cuenta ni precuenta (Pedido huerfano)
- **Tipo:** Flujo / Pedido huerfano.
- **Donde esta cada lado:**
  - `fuente/Admin.dc.html`: promesa en dialogo `ask('¿Agregar consumos a ' + e.label + '?', 'Abre una comanda nueva en la misma mesa; se suma a la cuenta del pedido ' + busy[code] + ' y cocina la ve como adicional.'`
  - `fuente/Admin.dc.html`: ejecucion real `orders: this.state.orders.concat([ Object.assign({ id: id, ... extraOf: m.modal === 'local' ? m.extraOf : undefined... }) ])`.
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Cita textual de `fuente/Admin.dc.html`:
    `ask('¿Agregar consumos a ' + e.label + '?', 'Abre una comanda nueva en la misma mesa; se suma a la cuenta del pedido ' + busy[code] + ' y cocina la ve como adicional.', () => this.setState({ mo: Object.assign({}, this.state.mo, { step: 'items', mesa: e.label, code: code, extraOf: busy[code], msg: '' }) }))`
    y en la insercion:
    `orders: this.state.orders.concat([ Object.assign({ id: id... extraOf: m.modal === 'local' ? m.extraOf : undefined, total: Math.round((moNet + moFee) * 100) / 100... }) ])`
- **Por que importa:** Aunque el sistema promete al mozo que los consumos adicionales *"se suman a la cuenta del pedido existente"*, en realidad inserta un pedido completamente independiente con su propio codigo correlativo (ej. `CP-0109` vinculado debilmente por `extraOf: 'CP-0103'`). La precuenta, el cobro y la emision de comprobante en caja operan estrictamente sobre un solo pedido a la vez. Cuando el cajero cobra la mesa, suele cobrar unicamente la primera comanda; el pedido adicional queda huerfano, sin cobrar, bloqueando el cierre de caja o liberando la mesa mientras los consumos de la segunda ronda quedan impagos.
- **Prioridad:** Alta.
- **Propuesta de arreglo:** Fusionar los productos adicionales directamente dentro de la lista de items del pedido matriz de la mesa conservando una marca de comanda adicional para impresion en cocina.

---

### D-07: Imposibilidad de cambiar de mesa en pedidos abiertos de salon (Callejon sin salida)
- **Tipo:** Flujo / Callejon sin salida.
- **Donde esta cada lado:**
  - `fuente/Admin.dc.html`: vista de detalle de pedido en salon `isMesaOrder: selOrder.modal === 'local'` (lineas 297, 3883).
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Verificacion en el codigo de `Admin.dc.html`: la propiedad `mesa` se asigna unicamente durante la creacion en `sendMo0` (`mesa: m.code`) y no existe ningun metodo `setMesa`, `moverMesa` ni boton interactivo en el detalle de la comanda en curso para reasignar la ubicacion fisica.
- **Por que importa:** En la operacion diaria de la cafeteria es muy comun que unos clientes sentados en una mesa decidan mudarse a otra mesa mas comoda o juntar mesas. Al no existir la funcion de cambio de mesa en pedidos en curso, la comanda queda permanentemente atada a la mesa original en el plano. Esto provoca que el personal lleve los pedidos a la mesa equivocada, impide sentar a nuevos comensales en la mesa original y bloquea la nueva mesa.
- **Prioridad:** Media.
- **Propuesta de arreglo:** Anadir un boton "Cambiar mesa" en la cabecera de pedidos de salon que muestre el plano de mesas libres y transfiera la orden actualizando el mapa en tiempo real.

---

### D-08: Desconexion total de datos entre Carta Web, Chatbot y Administrativo (Hueco de integracion)
- **Tipo:** Hueco / Integracion.
- **Donde esta cada lado:**
  - `fuente/Main.dc.html`: finalizacion de orden `placeOrder: ... ask('¿Enviar tu pedido?', ... () => { ... this.setState({ overlay: 'done', stage: 0, user: nu }); })`.
  - `fuente/Chatbot.dc.html`: finalizacion de orden `doneOrder(msgs) { this.setState({ sheet: false, sel: -1, step: 'done', msgs: this.say(...) }) }`.
  - `fuente/Admin.dc.html`: inicializacion de ordenes `const SEED = [ ... ]`.
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Cita textual de `fuente/Main.dc.html`:
    `this.setState({ overlay: 'done', stage: 0, user: nu });`
    y de `fuente/Chatbot.dc.html`:
    `doneOrder(msgs) { this.setState({ sheet: false, sel: -1, step: 'done', msgs: this.say(msgs, 'bot', 'Listo. Recibimos tu pedido ' + this.state.code...`
    Ninguno de los dos archivos realiza llamadas a `window.localStorage.setItem` para almacenar pedidos en `caprichos_carta_cfg_v1` o coleccion analoga.
- **Por que importa:** El objetivo central del cliente es que las tres piezas (Administrativo, Carta virtual y Chatbot) funcionen coordinadas y sin contradicciones. Actualmente, la carta web y el chatbot son maquetas visuales aisladas que no persisten los pedidos generados por los clientes en ningun repositorio compartido. En el administrativo, los pedidos entrantes provienen unicamente de un arreglo estatico en memoria (`SEED`), impidiendo cualquier prueba de integracion real de punta a punta.
- **Prioridad:** Alta.
- **Propuesta de arreglo:** Implementar un almacenamiento centralizado de pedidos en `localStorage` bajo una clave compartida que sincronice en tiempo real los pedidos emitidos desde la carta y el bot hacia la bandeja de entrada del administrativo.

---

### D-09: Pedidos manuales de Call Center o mostrador entran obligatoriamente a "Por confirmar" (Flujo innecesario)
- **Tipo:** Flujo / Discordancia operativa.
- **Donde esta cada lado:**
  - `fuente/Admin.dc.html`: asignacion de estado inicial `status: m.modal === 'local' ? 'cola' : 'nuevo'`.
  - `fuente/Admin.dc.html`: confirmacion obligatoria `Quedará por confirmar: una persona del equipo debe hablar con el cliente y confirmar el pago antes de que pase a cocina.`
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Cita textual de `fuente/Admin.dc.html`:
    `status: m.modal === 'local' ? 'cola' : 'nuevo', mins: 0, prints: m.modal === 'local' ? 1 : 0`
    y en el texto de confirmacion del modal:
    `Quedará por confirmar: una persona del equipo debe hablar con el cliente y confirmar el pago antes de que pase a cocina.`
- **Por que importa:** Cuando una operadora del call center atiende una llamada telefonica o un cajero toma un pedido para llevar en el mostrador, la interaccion con el cliente ya esta ocurriendo en vivo. Asignar forzosamente `status: 'nuevo'` obliga al operador a salir del modal de toma, buscar la orden en la pestaña "Por confirmar", presionar "Confirmar pedido y pago", marcar artificialmente "Ya hable con el cliente por WhatsApp" y subir una imagen ficticia para recien enviarlo a cocina. Esto ralentiza la atencion en ventanilla y contradice la dinamica de una cafeteria rapida.
- **Prioridad:** Media.
- **Propuesta de arreglo:** Permitir que en la toma manual de pedidos de mostrador y call center se pueda registrar el cobro inmediato o validacion telefonica directa, ingresando a cocina en estado `cola` sin escala previa.

---

### D-10: Indicadores de venta usan formulas sinusoidales matematicas falsas y computan pedidos no cobrados (Discordancia de dinero)
- **Tipo:** Discordancia / Reglas de dinero que no cuadran.
- **Donde esta cada lado:**
  - `fuente/Admin.dc.html`: formula matematica simulada `const dayVal = (ms) => { const d = new Date(ms); const k = d.getUTCDate() * 7 + d.getUTCMonth() * 31 + d.getUTCFullYear(); const wk = d.getUTCDay(); return Math.round((1050 + 330 * Math.sin(k * 0.9) + (wk === 0 || wk === 6 ? 380 : 0) + d.getUTCMonth() * 18 - (d.getUTCFullYear() - 2026) * 160) * CF); };`.
  - `fuente/Admin.dc.html`: calculo de ventas de hoy `const total = SF.per === 'hoy' && SF.canal === 'todos' ? Math.round(orders.filter((o) => o.status !== 'rechazado').reduce((t, o) => t + o.total, 0)) : days.reduce((a, t) => a + dayVal(t), 0);`.
  - `fuente/Admin.dc.html`: regla de caja real `const cjOrders = orders.filter((o) => o.paid && !o.cajaId && o.status !== 'rechazado');`.
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Cita textual de `fuente/Admin.dc.html`:
    `const total = SF.per === 'hoy' && SF.canal === 'todos' ? Math.round(orders.filter((o) => o.status !== 'rechazado').reduce((t, o) => t + o.total, 0)) : days.reduce((a, t) => a + dayVal(t), 0);`
    y formula simulada:
    `1050 + 330 * Math.sin(k * 0.9)...`
- **Por que importa:** En el modulo `Indicadores` y en el `Escritorio`, para el dia de hoy se suman indiscriminadamente todos los pedidos cuyo estado sea diferente de rechazado, incluyendo pedidos en borrador, por confirmar o en preparacion que todavia no han sido cobrados (`paid: false`). Por el contrario, en el modulo `Caja y cierres`, unicamente se computan ordenes cobradas (`paid: true`), generando un descuadre inmediato entre la recaudacion real de caja y las cifras del panel gerencial. Peor aun, si el usuario selecciona cualquier otro periodo o canal, las cifras no leen la base de datos sino que generan datos inventados con una funcion trigonometrica (`Math.sin`), perdiendo toda validez como herramienta de gestion.
- **Prioridad:** Alta.
- **Propuesta de arreglo:** Vincular los paneles de estadistica e indicadores directamente a las ventas reales cobradas y al historico consolidado de cierres de caja.

---

### D-11: Anulacion de pedidos en preparacion no notifica a cocina y pierde insumos (Paso sin responsable)
- **Tipo:** Flujo / Paso sin responsable.
- **Donde esta cada lado:**
  - `fuente/Admin.dc.html`: metodo de anulacion `anuSave: () => { ... ask('¿Anular el pedido ' + s.sel + '?', 'Sale de cocina y de repartos. Motivo: ' + q.motivo.toLowerCase() + '. Queda en el historial; no se elimina. Los insumos que ya se descontaron no se devuelven solos.', () => { this.setOrder(s.sel, { status: 'rechazado', rider: '', anulado: { motivo: this.state.anud.motivo, por: role.n, pin: s.role !== 'admin' } }); ... }`.
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Cita textual de `fuente/Admin.dc.html`:
    `ask('¿Anular el pedido ' + s.sel + '?', 'Sale de cocina y de repartos. Motivo: ' + q.motivo.toLowerCase() + '. Queda en el historial; no se elimina. Los insumos que ya se descontaron no se devuelven solos.'...`
    y ejecucion:
    `this.setOrder(s.sel, { status: 'rechazado', rider: '', anulado: { motivo: this.state.anud.motivo, por: role.n, pin: s.role !== 'admin' } });`
- **Por que importa:** Cuando caja o call center anulan una orden en preparacion, el pedido simplemente desaparece de las pantallas de cocina (`kcol` filtra `[ 'cola', 'prep', 'listo' ]`). Cocina no recibe ninguna alerta sonora ni visual que indique que debe detener la elaboracion de los platos, provocando desperdicio de insumos y tiempo de mano de obra. Asimismo, como el propio sistema reconoce que *"los insumos que ya se descontaron no se devuelven solos"*, no existe ningun formulario posterior que permita al personal registrar si el insumo debe tirarse a la basura como merma o regresar al stock utilizable.
- **Prioridad:** Media.
- **Propuesta de arreglo:** Disparar una alarma sonora y visual en las pantallas de cocina al anular una comanda en curso y desplegar un modal para clasificar los insumos involucrados como merma o retorno a almacen.

---

### D-12: Inversion de permisos: Mozo puede validar pagos remotos pero no anular ni cobrar en salon (Hueco de roles)
- **Tipo:** Flujo / Permisos que no corresponden.
- **Donde esta cada lado:**
  - `fuente/Admin.dc.html`: permiso de anulacion `canAnular: ... [ 'admin', 'cajero', 'callcenter' ].indexOf(s.role) >= 0`.
  - `fuente/Admin.dc.html`: permiso de cobro de pedidos `canCollect: ... canManage`.
  - `fuente/Admin.dc.html`: permiso de confirmacion de pagos web `canConfirmPay: ... [ 'admin', 'cajero', 'mozo', 'callcenter' ].indexOf(s.role) >= 0`.
  - `fuente/Admin.dc.html`: definicion del rol mozo `mozo: { ... manage: false }`.
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Cita textual de `fuente/Admin.dc.html`:
    `canConfirmPay: selOrder.status === 'nuevo' && selOrder.modal !== 'local' && [ 'admin', 'cajero', 'mozo', 'callcenter' ].indexOf(s.role) >= 0`
    y en la definicion de roles:
    `mozo: { n: 'Mozo', user: 'mozo01', person: 'Mozo de ejemplo', ini: 'MZ', color: '#E3D6C6', views: [ 'escritorio', 'caja', 'reservas', 'productos', 'notificaciones' ], home: 'escritorio', manage: false }`
- **Por que importa:** Existe una incongruencia en la matriz de permisos: al mozo se le otorga la atribucion de verificar comprobantes bancarios, contactar clientes por WhatsApp y aprobar pedidos remotos de delivery (`canConfirmPay` incluye a `'mozo'`), funcion ajena a la atencion de salon; sin embargo, no se le permite corregir ni anular una orden que el mismo tomo erroneamente en una mesa, debiendo buscar a un superior para anularla.
- **Prioridad:** Media.
- **Propuesta de arreglo:** Remover al mozo de la confirmacion de pagos remotos (`canConfirmPay`) e incorporar un mecanismo de autorizacion por PIN de supervisor para que el mozo pueda corregir items en mesas antes de salir de cocina.

---

### D-13: Contradiccion estructural entre el bot real de produccion y el flujo del mockup (Discordancia)
- **Tipo:** Discordancia.
- **Donde esta cada lado:**
  - `bot/AGENTS.md`: regla operativa `Notificación directa de tickets y alertas al WhatsApp de Cocina/Administrador (51977503006) con 2 botones táctiles ([Aprobar Pedido] y [Rechazar])...`.
  - `bot/bot_wa.py`: solicitud de comprobante al cliente antes de mandar comanda.
  - `docs/flujo-de-pedidos.md`: regla acordada `El cliente hace el pedido en la carta (o por el chatbot). Elige solo su forma de pago preferida; no paga ni envía capturas. El pedido llega a Pedidos y caja como Por confirmar...`.
  - `fuente/Admin.dc.html`: modulo Pedidos y caja centralizado.
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Citas textuales:
    En `bot/AGENTS.md`, punto 3: *"Notificación directa de tickets y alertas al WhatsApp de Cocina/Administrador (51977503006) con 2 botones táctiles ([Aprobar Pedido] y [Rechazar])... Al pulsar 'Rechazar', le solicita amablemente al cliente el comprobante correcto."*
    En `docs/flujo-de-pedidos.md`, §3 punto 1 y §4: *"Antes, el cliente pagaba por Yape o Plin y enviaba la captura. Ahora no: el cliente espera el mensaje del asesor... el comprobante lo sube quien verifica."*
- **Por que importa:** El codigo real del bot que opera en el negocio sigue ejecutando la logica antigua que Kevin Rosales critico en el Acta 02: exige que el cliente envie vouchers de pago por WhatsApp y envia alertas a un telefono personal para aprobacion manual con botones de WhatsApp. Por el contrario, el mockup administrativo y las directrices del 18/10 asumen que el bot no exige capturas y que los pedidos entran silenciosamente a la bandeja de Pedidos y caja para confirmacion por un asesor. Esta discrepancia rompe la operacion si se conectan sin homologacion previa.
- **Prioridad:** Alta.
- **Propuesta de arreglo:** Refactorizar el servicio de `bot_wa.py` para sincronizar con la API centralizada del administrativo eliminando la solicitud de capturas al cliente y las alertas al numero personal de cocina.

---

### D-14: Cobro de fletes de delivery a clientes sin mecanismo de liquidacion ni pago al motorizado (Regla de dinero)
- **Tipo:** Flujo / Reglas de dinero que no cuadran.
- **Donde esta cada lado:**
  - `fuente/Admin.dc.html`: cobro del flete en total del pedido `o.total = Math.round((moNet + moFee) * 100) / 100; fee: moFee`.
  - `fuente/Admin.dc.html`: visualizacion en escritorio de repartidor `dKpis = [ ... { n: 'Fletes de hoy', v: fmt(mine.filter((o) => o.status === 'entregado').reduce((t, o) => t + (o.fee || 0), 0)) } ]`.
  - `fuente/Admin.dc.html`: caja del turno `const cjVent = ... cjOrders.forEach((o) => { cjVent[m].t += o.total })`.
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Cita textual de `fuente/Admin.dc.html`:
    `dKpis = [ ... { n: 'Fletes de hoy', v: fmt(mine.filter((o) => o.status === 'entregado').reduce((t, o) => t + (o.fee || 0), 0)) } ]`
    y en caja:
    `cjVent[m].t += o.total;`
- **Por que importa:** El importe cobrado por delivery (`fee`, entre S/ 3.00 y S/ 7.00 segun la zona) se anade al valor total del pedido que paga el cliente. En caja, este monto ingresa íntegramente como venta del negocio. Sin embargo, en el escritorio del repartidor se contabilizan los "Fletes de hoy" como si fuera un ingreso devengado por el motorizado. El sistema no cuenta con ningun comprobante ni boton de egreso para liquidar el pago de fletes a los repartidores al final de su jornada, provocando que la caja retenga dinero que le pertenece a la flota externa o genere descuadres si se paga en efectivo sin registrar.
- **Prioridad:** Media.
- **Propuesta de arreglo:** Incorporar en el cierre de turno un rubro tipificado de liquidacion y egreso de caja para el pago de fletes acumulados a cada motorizado.

---

### D-15: La pantalla de simulacion de Mensajes no interactua con el flujo de pedidos (Hueco operativo)
- **Tipo:** Discordancia / Hueco.
- **Donde esta cada lado:**
  - `fuente/Admin.dc.html`: botones en vista mensajes `cvOk: ask('¿Aprobar el pago de ' + cvSel.nombre + '?', ... () => cvPush(cvSel.id, 'Pago verificado. Tu pedido ya entró a preparación...', 'atendido'))` y `cvNo: ask('¿Rechazar el pago de ' + cvSel.nombre + '?'...)`.
- **CONFIRMADO o SUPOSICION:**
  - CONFIRMADO: Cita textual de `fuente/Admin.dc.html`:
    `cvOk: ask('¿Aprobar el pago de ' + cvSel.nombre + '?', 'Se le avisa al cliente que el pago fue verificado y que su pedido demora unos ' + cvMin + ' minutos.' + (s.hd.on ? ' (Alta demanda activa)' : ''), () => cvPush(cvSel.id, 'Pago verificado. Tu pedido ya entró a preparación y llega en unos ' + cvMin + ' minutos.', 'atendido'))`
- **Por que importa:** En la vista `mensajes` existen botones destacados para "Aprobar pago" y "Rechazar pago" asociados a conversaciones de WhatsApp. Sin embargo, al pulsarlos, la funcion unicamente anade un mensaje de texto simulado al historial del chat (`cvPush`). No crea ningun pedido en la tabla de ordenes, no actualiza ningun estado, no descuenta stock y no envia comanda a cocina, creando una falsa expectativa operativa para el usuario administrativo.
- **Prioridad:** Baja.
- **Propuesta de arreglo:** Conectar la accion de "Aprobar pago" de la consola de mensajes con la llamada formal `acceptOrder(id)` de la tabla de pedidos.

---

## 5. CONCLUSIONES Y RECOMENDACIONES DE ARQUITECTURA

1. **Unificacion del Modelo de Estados:**
   Es urgente formalizar los estados complementarios dentro del enumerador principal `STATUS`. Tanto `servido` como `anulado` no deben ser banderas secundarias aisladas, sino estados con representacion grafica propia en la lista de pedidos y en los filtros de busqueda.

2. **Normalizacion del Circuito Financiero de Caja:**
   El dinero cobrado por repartidores en la calle contra entrega y los consumos a credito del personal deben desacoplarse de las ventas inmediatas del turno. Ninguna caja debe poder cerrarse mientras existan fondos en mano de motorizados sin liquidar.

3. **Consolidacion de Cuentas en Mesas:**
   Los pedidos adicionales en mesa deben anexarse a la comanda activa para emitir una unica precuenta y comprobante final unificado, evitando ordenes huerfanas y retrasos en salon.

---

INFORME LISTO.

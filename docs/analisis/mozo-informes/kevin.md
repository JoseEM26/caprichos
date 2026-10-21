---
id: ANA-CAP-039
tipo: analisis
titulo: "Informe de Requerimientos y Decisiones de Kevin Rosales para el Rol Mozo"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, mozo-informes]
---

# Informe de Requerimientos y Decisiones de Kevin Rosales para el Rol Mozo

## 1. Introduccion y Alcance

El presente informe consolida todas las declaraciones, directrices y decisiones operativas emitidas por Kevin Rosales (cliente y administrador de Caprichos) durante las reuniones de descubrimiento (Acta 01 del 12 de octubre de 2026 y Acta 02 del 14 de octubre de 2026), asi como el analisis de iniciativas derivado en `fuente/iniciativas-acta-02.md`.

El objetivo central es auditar el estado del rol Mozo (`mozo`) en el prototipo interactivo del sistema administrativo (`fuente/Admin.dc.html`), evaluando para cada aspecto si la implementacion actual cumple, cumple a medias o no cumple con las directrices del cliente.

Toda la evidencia se cataloga bajo criterios estrictos de verificacion:
- CONFIRMADO en el acta: afirmacion o regla expresa de Kevin Rosales en las transcripciones.
- CONFIRMADO en el codigo: propiedad, texto o comportamiento exacto comprobado en `fuente/Admin.dc.html`.
- SUPOSICION: deduccion tecnica o funcional que no cuenta con declaracion textual explicita y requiere confirmacion.

---

## 2. Analisis Detallado por Area Tematica

### 2.1. Tomar pedidos en mesa

- Cita del cliente en acta:
  "el mozo lo que agarra es cuando va a tomar el pedido y, o sea, usualmente el mozo agarra del uno al ocho porque son ocho mesas mas o menos del uno al 8" (Acta 02, minuto 00:52:16).
  "Roles y areas mencionados: cajero/a, meseros (toman pedidos con tablet y el pedido aparece en pantalla)..." (Acta 01, seccion 2).
  "y cuando llega el cliente le tomamos pedidos." (Acta 02, minuto 00:56:25).

- Busqueda en el mockup (`fuente/Admin.dc.html`):
  Texto confirmado en codigo:
  - Definicion de vistas: `mozo: { views: [ 'escritorio', 'caja', 'reservas', 'productos', 'notificaciones' ] }`
  - Permiso de toma de comanda: `canTableOrder: ['mozo', 'cajero', 'admin', 'callcenter'].indexOf(s.role) >= 0`
  - Apertura del pedido: `openMo` inicializa el modal con modalidad local (`modal: 'local'`) y paso de plano (`step: 'modal'`).
  - Boton en interfaz: `<button onClick="{{openMo}}" ...>Nuevo pedido</button>` dentro de `Pedidos y caja`.
  - Configuracion de modificadores: la orden permite seleccionar tamanos (`cfgVariants`), tipo de leche, endulzante y complementos (`cfgGroups`), asi como notas especiales por producto.

- Grado de cumplimiento: Cumple.

- Donde esta:
  En la pantalla `Pedidos y caja`, accion `Nuevo pedido`, modal interactivo de seleccion de mesa y catalogo de productos.

- Por que importa para una cafeteria:
  En una cafeteria de especialidad artesanal, la comanda en mesa requiere registrar personalizaciones criticas (leche descremada, vegetal, nivel de azucar o jarabes, temperatura y acompanamientos). Si el mozo no pudiera tomar estos atributos al pie de mesa, la cocina cometeria errores continuos de preparacion.

- Prioridad: Alta.

- Clasificacion: CONFIRMADO en el acta y CONFIRMADO en el codigo.

---

### 2.2. Mesas y plano del local

- Cita del cliente en acta:
  "Ellos primero nos entregaron con 8 mesas, nosotros le ampliamos a 30... el mozo lo que agarra es cuando va a tomar el pedido y, o sea, usualmente el mozo agarra del uno al ocho porque son ocho mesas mas o menos del uno al 8" (Acta 02, minuto 00:52:16).
  "¿agregar mesas tambien se van a poder?" (Acta 02, minuto 01:50:27).
  "Pero eso lo podrias hacer en la misma opcion del de que tienes ahi de a ver la otra pantalla de las mesas, pues ahi puedes poner una R reservado no mas... que aparezca rojo y R, algo asi naranja" (Acta 02, minuto 00:57:43).

- Busqueda en el mockup (`fuente/Admin.dc.html`):
  Texto confirmado en codigo:
  - Texto de ayuda en vista de diseno: `Dibuja el local: elige un elemento arriba y toca el plano para colocarlo... El mozo vera este plano al tomar un pedido de mesa.`
  - Matriz del rol mozo: el rol `mozo` NO incluye la vista `plano` en su arreglo `views` de navegacion principal (`views: [ 'escritorio', 'caja', 'reservas', 'productos', 'notificaciones' ]`).
  - Visualizacion embebida: el mozo unicamente accede al plano dentro del flujo modal de `Nuevo pedido` (`moEls`, `gridStyle`).
  - Estados visuales: mesa libre en fondo verde (`#DFF3E3`), ocupada en durazno (`#F6C9A5` con borde `#E67929`), reservada en amarillo (`#F9E0B5` con borde `#D99E39` y distintivo `R`).

- Grado de cumplimiento: A medias.

- Donde esta:
  Modal de toma de pedido al pulsar `Nuevo pedido` -> `En el local (mesa)`. No existe vista dedicada del plano en el menu lateral del mozo.

- Por que importa para una cafeteria:
  El mozo necesita orientacion espacial rapida durante horas punta para verificar la disponibilidad de las 8 mesas reales sin tener que iniciar un flujo forzado de creacion de comanda. Ademas, el plano no diferencia visualmente las 8 mesas fisicas reales del salon respecto a las mesas logicas adicionales configuradas.

- Prioridad: Alta.

- Clasificacion: CONFIRMADO en el acta y CONFIRMADO en el codigo.

---

### 2.3. Mesa ocupada o varios pedidos en la misma mesa (concurrencia y cuentas separadas)

- Cita del cliente en acta:
  "Entonces yo voy a tomar pedido... y pero el mozo tambien agarro la mesa 02 y esta tomando pedido. Entonces a las finales el mozo termina de tomar pedido y se llena la mesa dos, se pone en amarillo. Pero como tambien estuvo tomando pedido el cajero ahi en un cliente que fue a caja y que fue verbalmente a pedir, lo ingreso en la mesa 02. Entonces el detalle fue que a las finales esos dos pedidos se juntan y uno de esos dos clientes se queda ahi. El que el segundo de repente ya no se registra ya, solamente el primero, o sea, aparece un cliente con esos dos pedidos de diferentes clientes en la mesa 02. Hay conflicto. Se mezcla." (Acta 02, minutos 00:52:16 a 00:53:44).
  "Cuando hacen un pedido, la mesa se queda registrada con el nombre del cliente, ¿no? Mientras el no se desocupe, o sea, cuando el cliente paga la mesa, eh, ahi es donde se libera actualmente cuando paga, pero porque al final en la mayoria de comercio paga el ultimo, pero a nosotros no. Aqui paga primero. Entonces a veces este esta ahi la mesa y paga y se borro, se libero la mesa, pero el sigue ahi." (Acta 02, minuto 00:24:07).

- Busqueda en el mockup (`fuente/Admin.dc.html`):
  Texto confirmado en codigo:
  - Deteccion de mesa ocupada:
    `busy[o.mesa] = o.id` si `o.modal === 'local' && o.status !== 'entregado' && o.status !== 'rechazado' && !o.paid && o.mesa`
  - Bloqueo estricto al pulsar mesa:
    `if (used) { this.setState({ mo: Object.assign({}, mo, { msg: e.label + ' esta ocupada ' + (busy[code] === 'manual' ? '(marcada a mano)' : '(pedido ' + busy[code] + ')') + '. Se libera al cobrar o a mano.' }) }); return; }`
  - Desbloqueo y liberacion manual:
    `<div style="font-size:12px;color:#2C4C5D">La mesa se libera al cobrar. Un mozo o caja tambien puede liberarla a mano en Nuevo pedido, En el local.</div>`
    Boton interactivo: `Liberar o marcar ocupada a mano` mediante `mo.liberar`.

- Grado de cumplimiento: A medias.

- Donde esta:
  Pantalla de seleccion de mesa en el modal de nuevo pedido y detalle del pedido de mesa en `Pedidos y caja`.

- Por que importa para una cafeteria:
  1. El bloqueo previene efectivamente la sobreescritura accidental entre caja y mozo detectada en restaurant.pe.
  2. Sin embargo, bloquea radicalmente la posibilidad de registrar cuentas separadas o pedidos adicionales independientes para clientes que comparten la misma mesa.
  3. Mantiene la regla tecnica `!o.paid`, lo que provoca que si el comensal paga por adelantado (practica fomentada por Kevin), la mesa se marca como libre en el sistema mientras los clientes continuan sentados fisicamente en el local.

- Prioridad: Alta.

- Clasificacion: CONFIRMADO en el acta y CONFIRMADO en el codigo.

---

### 2.4. Precuenta para cobro asistido

- Cita del cliente en acta:
  "Entonces, aqui al mozo no le permite cobrar porque el unico responsable de cobrar es caja. Entonces, el mozo lo que puede hacer es precuentas, sacar precuentas y con eso cobrar al cliente con la precuenta. Y una vez cobrado al cliente en mesa, el mozo llega a caja, paga y recien el cajero recibe el dinero y emite el comprobante de pago, ¿no? Eso me parece tambien logico y me parece tambien sensato." (Acta 02, minuto 00:26:48).

- Busqueda en el mockup (`fuente/Admin.dc.html`):
  Texto confirmado en codigo:
  - Boton de emision:
    `<button onClick="{{openPre}}" ...>Sacar precuenta (el cajero cobra)</button>`
  - Apertura del modal:
    `openPre: () => this.setState({ precuenta: true })`
  - Estructura del modal:
    Renderiza `preLines` (productos, cantidades y notas), `preTotal` (monto total formateado), `preMesa` (identificador de mesa o cliente) y boton para imprimir ticket de precuenta o cerrarlo.

- Grado de cumplimiento: Cumple.

- Donde esta:
  Panel lateral de detalle del pedido seleccionado en `Pedidos y caja`, visible exclusivamente para pedidos en sala (`sel.isMesaOrder`).

- Por que importa para una cafeteria:
  Protege el flujo de caja impidiendo fugas de efectivo. El mozo presenta un documento impreso o digital claro al comensal para solicitar el pago en mesa, trasladando el efectivo o comprobante digital a la caja centralizada sin manipular la emision fiscal directa.

- Prioridad: Alta.

- Clasificacion: CONFIRMADO en el acta y CONFIRMADO en el codigo.

---

### 2.5. Prohibicion expresa de cobrar al mozo

- Cita del cliente en acta:
  "Actualmente el sistema no nos permite no le permite al mozo realizar el cobro... no le permito. Y es algo que tambien yo entendi y si tiene logica porque en el otro sistema eh si en el hola click si, o sea, un o la tablet si tu tienes puedes tomar pedido y normal. En cambio, aca son usuarios diferentes, un usuario de mozo, un usuario de caja, me imagino que es para el control del dinero. Entonces, aqui al mozo no le permite cobrar porque el unico responsable de cobrar es caja." (Acta 02, minuto 00:26:48).

- Busqueda en el mockup (`fuente/Admin.dc.html`):
  Texto confirmado en codigo:
  - Definicion del rol mozo sin gestion administrativa:
    `mozo: { ..., manage: false }`
  - Restriccion del permiso de cobro:
    `const canManage = role.manage`
    `canCollect: selOrder.status !== 'nuevo' && selOrder.status !== 'rechazado' && !selOrder.paid && canManage`
  - Control de interfaz:
    El boton `Cobrar este pedido` esta condicionado por `<sc-if value="{{sel.canCollect}}">`. Al tener `manage: false`, el mozo nunca ve activo dicho boton.
  - Modulo de cierre:
    El rol mozo no tiene acceso a la vista `cierre` (arqueo y cierre de caja).

- Grado de cumplimiento: Cumple.

- Donde esta:
  Logica de permisos en controlador principal y pestana `Cobro` del pedido en `Pedidos y caja`.

- Por que importa para una cafeteria:
  Garantiza el arqueo diario y la cuadratura de caja. La manipulacion del dinero queda asignada a una sola persona responsable (el cajero de turno), evitando descuadres, confusiones con vueltos y posibles mermas monetarias en salon.

- Prioridad: Alta.

- Clasificacion: CONFIRMADO en el acta y CONFIRMADO en el codigo.

---

### 2.6. Propinas voluntarias y registro

- Cita del cliente en acta:
  Kevin no menciono el termino "propina" ni en el Acta 01 ni en el Acta 02.
  Registro en documentos del proyecto:
  En `fuente/BRD.md`: "Pedidos programados ('pedir para luego') y propina voluntaria: no fueron elegidos para la primera version; se confirman con el cliente." (linea 174).

- Busqueda en el mockup (`fuente/Admin.dc.html`):
  Texto confirmado en codigo:
  - En informes generales de administracion aparece listado el reporte:
    `['Ventas por mozo', 'Ventas', 'Ventas y propinas por mozo', 'Fecha, local', 'PDF · Excel']`
  - En la interfaz operativa del mozo (`Pedidos y caja`, precuenta o comanda): NO existe ningun campo, boton o registro de propinas.

- Grado de cumplimiento: No cumple (no implementado en el flujo operativo del mozo).

- Donde esta:
  Aparece unicamente como texto estatico en la tabla de reportes del Administrador. Ausente en la operativa diaria del mozo.

- Por que importa para una cafeteria:
  En el rubro de cafeteria y servicio de mesas en Lima, las propinas por billeteras digitales (Yape/Plin) o tarjeta son habituales. Aunque Kevin no las priorizo para la primera fase, su omision impide liquidar propinas acumuladas por cada colaborador.

- Prioridad: Baja (descartada inicialmente por BRD, pendiente de definicion con cliente).

- Clasificacion: CONFIRMADO en BRD.md (no solicitada por Kevin en actas) y CONFIRMADO en el codigo que no existe en el flujo del mozo.

---

### 2.7. Atencion al cliente, hospitalidad y formas de cobro

- Cita del cliente en acta:
  "Caprichos es un negocio gastronomico donde el foco principal es la hospitalidad. Kevin insiste en que el proyecto no es solo programacion: hay que entender la vision de la empresa, como trata a sus clientes, su vocabulario de marketing y sus cierres de venta." (Acta 01, seccion 1).
  "Si, pues le puede dar QR. Solo que aca en la zona como tal, este, en la mayoria de clientes hemos probado con QR, pero no como viene a veces familia, viene a veces senores, este, que son un poco mayorcitos... usualmente el QR es mas para los jovenes, jovencitos, entonces si, tambien es una buena opcion." (Acta 02, minuto 00:27:49).
  "Ahorita no cobran. A veces estan en eso. Cobro primero. Yo le digo, cobren adelantado. O sea, acostumbrar tambien a ese flujo... Y si un cliente quiere pagar al final, no hay ningun problema... Pero a veces este el cliente pregunta, este, ¿se paga ahorita? Si, seria uno le puede decir si seria 25 soles. Este, ¿me permitiria, por favor? Eh, seria 25 soles. Usted cancela con Yape en efectivo. Entonces, le damos las dos opciones y ya estamos ya practicamente realizando el cobro de una forma amena, educada..." (Acta 02, minuto 00:24:52).

- Busqueda en el mockup (`fuente/Admin.dc.html`):
  Texto confirmado en codigo:
  - Toma de orden asistida por mozo: implementada para atender a familias y adultos mayores.
  - Generacion o muestra de QR de mesa en la aplicacion del mozo: NO existe. El mozo no puede mostrar un QR en su tablet para que un comensal joven escanee la carta.
  - Distincion operativa de cobro: no existe campo ni indicador en el pedido que marque si la mesa cancela por adelantado o al final de la estancia.

- Grado de cumplimiento: A medias.

- Donde esta:
  Pantalla de toma de pedidos en `Pedidos y caja`.

- Por que importa para una cafeteria:
  El perfil de clientes de Caprichos incluye familias y personas de la tercera edad que demandan atencion tradicional humana, conviviendo con publico joven que prefiere autoservicio digital. No contar con soporte dual (QR dinamico en tablet / asistencia verbal) limita la flexibilidad en mesa.

- Prioridad: Media.

- Clasificacion: CONFIRMADO en el acta y CONFIRMADO en el codigo.

---

### 2.8. Pedido directo a cocina sin intervencion de caja

- Cita del cliente en acta:
  "Roles y areas mencionados: cajero/a, meseros (toman pedidos con tablet y el pedido aparece en pantalla)... Al aceptar el pedido, este aparece en todas las pantallas de cocina y empiezan a correr los tiempos." (Acta 01, seccion 2).
  "pedido del mozo en el local va directo a cocina; fuera del local queda por confirmar" (`contexto.txt` y `fuente/BRD.md`, reglas RN-CAP-001 y RN-CAP-074).

- Busqueda en el mockup (`fuente/Admin.dc.html`):
  Texto confirmado en codigo:
  - Mensaje de confirmacion al enviar pedido:
    `ask(mo && mo.modal === 'local' ? '¿Enviar el pedido de ' + mo.mesa + ' a cocina?' : '¿Registrar el pedido...?', mo && mo.modal === 'local' ? 'Va directo a las pantallas de cocina, sin pasar por caja. El cobro se hace al final, en caja.' : 'Quedara por confirmar...')`
  - Asignacion directa de estado:
    `status: m.modal === 'local' ? 'cola' : 'nuevo'`
    `tab: m.modal === 'local' ? 'curso' : 'nuevo'`
  - Impresion y efectos inmediatos de inventario:
    `prints: m.modal === 'local' ? 1 : 0`
    `m.modal === 'local' ? this.acceptEffects({ id: id, items: cc.map((l) => ({ q: l.q, n: l.name, d: l.desc })) }) : {}`
  - Etiqueta del boton de envio:
    `moSendLabel: mo && mo.modal === 'local' ? 'Enviar a cocina' : 'Registrar pedido'`

- Grado de cumplimiento: Cumple.

- Donde esta:
  Boton de envio en el modal de nuevo pedido (`Nuevo pedido`) cuando la modalidad es `En el local (mesa)`.

- Por que importa para una cafeteria:
  Agiliza radicalmente la operacion de salon. En horas punta, el mozo ingresa los capuchinos o waffles en la mesa y estos aparecen de inmediato en los monitores de baristas y cocineros sin esperar que la cajera los apruebe uno por uno, reduciendo los tiempos de espera a la meta de 13 minutos.

- Prioridad: Alta.

- Clasificacion: CONFIRMADO en el acta y CONFIRMADO en el codigo.

---

### 2.9. Avisos y notificaciones cuando un pedido esta listo en cocina

- Cita del cliente en acta:
  "es eso, dices, para que los pedidos eh los pedidos listos salgan en pantalla... para el cliente dices... pero en cocina este no tenemos todavia, pero esta bien que estes preparandolo para un Smart TV, pero todas las pantallas de cocina que tenemos son computadoras... no son por cada area... salados, postres y bebidas... y me gustaria una pantalla de despacho o una etiquetera despacho donde solamente salgan ahi si salga todo junto..." (Acta 02, minutos 00:33:09 y 00:36:29).
  "Este de aca ya lo debieron de haber despachado, pero no lo despejaron todavia porque yo ahorita voy a ver la camara... ese ya es este parte de de ellos, ¿no? Que tienen que despejarlo" (Acta 02, minuto 00:40:50).

- Busqueda en el mockup (`fuente/Admin.dc.html`):
  Texto confirmado en codigo:
  - En el Escritorio del rol mozo:
    `dKpis = [ { n: 'Mesas con pedido abierto', v: String(mesas.length) }, { n: 'Listos para llevar a la mesa', v: String(orders.filter((o) => o.modal === 'local' && o.status === 'listo').length) }, ... ]`
  - En el sistema de notificaciones (`addN`):
    NO existe ninguna notificacion generada para el rol mozo cuando un pedido pasa a estado `listo`. Unicamente existe notificacion para repartidores de delivery (`dispR > 0`, `roles: ['repartidor']`).
  - Bloqueo de entrega:
    `canDeliver: selOrder.status === 'listo' && !isDelivery && canManage`
    Al tener `manage: false`, el boton `Entregar al cliente y cerrar` esta desactivado para el mozo. Solo caja o admin pueden marcarlo.

- Grado de cumplimiento: No cumple / A medias deficiente.

- Donde esta:
  Escritorio del mozo (solo contador numerico pasivo) y panel de detalle en `Pedidos y caja`.

- Por que importa para una cafeteria:
  Los frappés y bebidas calientes pierden temperatura y consistencia (chantilli derretido) si reposan en la barra. El mozo requiere una alerta proactiva inmediata (sonora o visual en su tablet) que le indique que el pedido de la mesa X esta listo para ser retirado de cocina, asi como el permiso para marcarlo como entregado en mesa.

- Prioridad: Alta.

- Clasificacion: CONFIRMADO en el acta y CONFIRMADO en el codigo.

---

### 2.10. Reservas de mesas

- Cita del cliente en acta:
  "reserva. Si, si, lo usamos. Si, lo usamos, pero no con recurrencia. Asi hacer al mes unas cuatro veces, cinco veces... O sea, tu estas ahi, quiero una mesa para es las 6 de la tarde. Quiero, favor que me reciba una mesa para las 8. Ya le reservamos una mesa para las 8, le damos 15 minutos de tolerancia y si no liberamos la mesa... Es que usualmente hm si le pones esa opcion le vas a obligar a que, o sea, a que pida, pero usualmente los que reservan no saben que pedir todavia llegan, se reunen y llegan... Pero eso lo podrias hacer en la misma opcion del de que tienes ahi de a ver la la otra pantalla de las mesas, pues ahi puedes poner una R reservado no mas, o sea, reservar mesa, una opcion para reservar mesa, pero no una categoria entera... si tenemos ahi un base, una base informativa... flyer" (Acta 02, minutos 00:55:09 a 00:58:46).
  "Usualmente escriben en el WhatsApp y quiero reservar, no se podra reservar para tal hora y nosotros le confirmamos... no lo hacen por la web... queremos que sea lo mas simple posible" (Acta 02, minuto 00:58:46).

- Busqueda en el mockup (`fuente/Admin.dc.html`):
  Texto confirmado en codigo:
  - Modulo dedicado en navegacion: el mozo tiene acceso a la vista `reservas` (`views: [ ..., 'reservas', ... ]`).
  - Aprobacion de reservas:
    `Solicitudes de reserva por WhatsApp`
    `No se reserva sola: el cliente envia la solicitud desde el chatbot y un mozo o caja la aprueba y asigna la mesa (acta 02).`
    Boton `Aprobar y guardar la mesa` (`r.approve`).
  - Opcion en modal de nuevo pedido:
    `{ n: 'Reservar mesa', d: 'Por personas y hora (acta 02)', pick: () => setMo({ modal: 'reserva', step: 'resv', msg: '' }) }`
  - Tolerancia y senalizacion:
    Guarda 15 minutos de tolerancia y marca en el plano con `R`, color naranja y hora programada. Bloquea apertura de pedido regular: `esta reservada para X a las Y. Llega con 15 minutos de tolerancia.`
  - Alerta de 15 minutos previos para colocar cartel fisico en mesa: NO implementada en codigo.

- Grado de cumplimiento: A medias.

- Donde esta:
  Vista `Reservas` en menu principal y opcion `Reservar mesa` dentro del modal `Nuevo pedido`.

- Por que importa para una cafeteria:
  Evita comprometer mesas innecesariamente y garantiza que si los comensales no se presentan tras los 15 minutos de tolerancia, la mesa se libere para atender a clientes en espera. Sin embargo, Kevin solicito no crear una categoria entera sino una marcacion rapida `R` en el plano, y falta el aviso anticipado para colocar el senalizador fisico en mesa.

- Prioridad: Media.

- Clasificacion: CONFIRMADO en el acta y CONFIRMADO en el codigo.

---

### 2.11. Pedidos para llevar y delivery gestionados por personal de salon

- Cita del cliente en acta:
  "Claro, pero este si no es el mozo tambien puede ser este caja... o cualquier persona, ¿no? El delivery no toma pedido" (Acta 02, minuto 00:46:53).
  "¿Como haria un cajero para tomar un pedido para llevar?" (Acta 02, minuto 00:53:44).
  "me gustaria que sea el call center bacan para tomar pedidos de delivery... para tomar pedidos manualmente en caso de que el cliente no quiera hacerlo ni por el bot ni por los botones, quiera hacerlo o por llamadas o nos mande su pedido... nosotros tengamos que procesarlo manualmente" (Acta 02, minutos 00:44:29 a 00:46:53).
  "Si el cliente me manda una ubicacion... pediamos la ubicacion... y aparecia un punto rojo... nosotros haciamos en hola click era copiar el codigo plus y pegarlo aqui... no pega coordenadas en restaurant.pe" (Acta 02, minuto 00:45:38).

- Busqueda en el mockup (`fuente/Admin.dc.html`):
  Texto confirmado en codigo:
  - Opciones de modalidad en modal de pedido:
    `{ n: 'Para llevar', d: 'Sin mesa: nombre y telefono', pick: () => setMo({ modal: 'llevar', step: 'cli', msg: '' }) }`
    `{ n: 'Delivery', d: 'Nombre, telefono y ubicacion', pick: () => setMo({ modal: 'delivery', step: 'cli', msg: '' }) }`
  - Captura geografica:
    Boton `O usar la ubicacion actual de este equipo` (`useGpsMo`), visor de mapa con chincheta y enlace a Google Maps (`moGpsMap`, `moGpsLink`).
  - Estado del pedido externo:
    Entra como `status: 'nuevo'` (por confirmar) y el mozo tiene permiso para verificar y confirmar el pago (`canConfirmPay: ['admin', 'cajero', 'mozo', 'callcenter'].indexOf(s.role) >= 0`).
  - Soporte de codigo Plus: NO existe en el mockup (se elimino en revision del 17/10 para usar geolocalizacion directa del navegador).

- Grado de cumplimiento: Cumple.

- Donde esta:
  Modal `Nuevo pedido` accesible desde `Pedidos y caja`.

- Por que importa para una cafeteria:
  En horas de baja afluencia o turnos compartidos, el mozo o la persona presente en el mostrador atiende llamadas o mensajes directos de clientes que solicitan recojo en puerta o envio a domicilio, requiriendo procesar la venta sin obligar a amarrar una mesa fisica del local.

- Prioridad: Media.

- Clasificacion: CONFIRMADO en el acta y CONFIRMADO en el codigo.

---

### 2.12. Pedido del personal (consumo de trabajadores a credito)

- Cita del cliente en acta:
  "Creditos no damos a clientes creditos a nadie, pero si damos creditos al personal. Al personal compra por credito... lo tiene para pagar hasta 15 dias asi... y usualmente lo piden a credito y con descuento... Se le descuenta el 25% de todo lo en general, todo menos promociones y combos, menos los dos duos compartir, el duo compartir y el duo irresistible, menos eso... Todo lo demas para ellos tienen 25% de descuento, menos la media docena de donas que ya tiene descuento... La compra la van a hacer con su usuario, ¿no? Como un cliente." (Acta 02, minutos 01:03:27 a 01:05:24).
  "Alexandra, el M01, la mesa 01 tambien debe estar preparandolo en el local, dice Alexandra. Ella es ella seguridad trabajadora." (Acta 02, minuto 00:42:00).

- Busqueda en el mockup (`fuente/Admin.dc.html`):
  Texto confirmado en codigo:
  - Apertura especifica de pedido de colaborador:
    `openMoStaff: () => this.setState({ mo: { ..., who: 'personal' } })`
    Boton en interfaz: `<button onClick="{{openMoStaff}}" ...>Pedido del personal</button>`
  - Restriccion de modalidad:
    `const moModalChoices = mo && mo.who === 'personal' ? moModalAll.filter((c) => c.n === 'En el local (mesa)' || c.n === 'Para llevar') : moModalAll`
    `El pedido del personal es solo para comer en el local o para llevar.`
  - Seleccion de colaborador:
    Listado de colaboradores cargados en `STAFF` (Marta, Luis, Rosa, Pedro, Elena, Jorge).
  - Calculo del descuento del 25% y credito a 15 dias:
    El mozo NO ve reflejado el descuento del 25% al momento de tomar la orden ni puede aplicar el credito. El descuento y la liquidacion a 15 dias solo se calculan en Caja mediante `openCr` / `crConfirm` al cobrar.
  - Consulta de saldos por el mozo: el rol mozo no tiene acceso a la vista `creditos`.

- Grado de cumplimiento: A medias.

- Donde esta:
  Boton `Pedido del personal` en `Pedidos y caja`. Liquidacion contable en pestana `Cobro` (exclusiva de caja).

- Por que importa para una cafeteria:
  El personal consume diariamente alimentos durante su jornada (desayunos, almuerzos o refrigerios). Permitir que el mozo ingrese la comanda indicando que es consumo de personal evita que se registre como una mesa comercial externa y previene confusiones en el inventario. Sin embargo, el mozo no puede verificar su propio limite de credito o deuda acumulada.

- Prioridad: Alta.

- Clasificacion: CONFIRMADO en el acta y CONFIRMADO en el codigo.

---

### 2.13. Celulares o tablets del mozo y conectividad local

- Cita del cliente en acta:
  "Roles y areas mencionados: meseros (toman pedidos con tablet y el pedido aparece en pantalla)..." (Acta 01, seccion 2).
  "en el otro sistema... la tablet si tu tienes puedes tomar pedido y normal" (Acta 02, minuto 00:26:48).
  "Nos gustaria ponerle [al ticket], pero no esta, creo, la contrasena en el voucher ahorita... para usuarios y contrasenas asociados al ticket para controlar mas la red wifi... algunas las tablets estan conectadas con Wi-Fi... todo se desconfigura, la tablet de marcar registro, ingreso, salida..." (Acta 02, minutos 00:28:46 y 00:29:47).
  "¿En caso de que el internet se vaya, el internet local... el mozo va a poder seguir procesando pedidos, la cajera va a seguir poder procesando pedidos, las pantallas de cocina se van a poder seguir viendo de forma local?" (Acta 02, minuto 01:54:38).

- Busqueda en el mockup (`fuente/Admin.dc.html`):
  Texto confirmado en codigo:
  - Adaptabilidad de interfaz: selector de vista `device: 'mobile' | 'pc'`, con ancho ajustado a 476px y zoom 0.82 en dispositivos moviles.
  - Simulacion de operacion fuera de linea:
    `online: true/false`, con banner de aviso `Sin internet` y almacenamiento de pedidos con `sync: false` pendientes de sincronizacion.
  - Complejidad de interfaz: la pantalla del mozo en movil sigue cargando la estructura completa del panel de control de escritorio (multitud de filtros, paneles laterales colapsables, pestanas de etiquetas y auditoria), resultando pesada para una tablet basica de salon.
  - Control de red Wi-Fi en ticket: no implementado.

- Grado de cumplimiento: A medias.

- Donde esta:
  Controlador global de dispositivos (`deviceChips`) y bandera de red `online` en cabecera.

- Por que importa para una cafeteria:
  En horas de alta demanda comercial, la caida del enlace a internet o la saturacion de la red Wi-Fi por clientes externos no puede detener la toma de comandas en sala. El mozo requiere una aplicacion ultra ligera, agil y capaz de encolar pedidos localmente hacia la ticketera de cocina.

- Prioridad: Alta.

- Clasificacion: CONFIRMADO en el acta y CONFIRMADO en el codigo.

---

### 2.14. Reglas de turnos, responsables y control de asistencia

- Cita del cliente en acta:
  "Actualmente el sistema no nos permite no le permite al mozo realizar el cobro... el unico responsable de cobrar es caja" (Acta 02, minuto 00:26:48).
  "En la noche disponen de, por ejemplo, el delivery es el que se encarga del almacén, también es almacenero... que haya una persona responsable como él que se encargue de anotar todas esas salidas en la tarde... A veces él descansa y yo estoy en el turno y el otro delivery no se encarga tanto del almacén... ahí me tocaría a mí. Si no, cualquier día yo la apoyo también" (Acta 02, minuto 01:16:53).
  "Yo y a veces la supervisora que está aquí, ella es la..." (Acta 02, minuto 01:15:21).
  "Alexandra, el M01, la mesa 01 también debe estar preparándolo en el local, dice Alexandra. Ella es ella seguridad trabajadora" (Acta 02, minuto 00:42:00).
  "registro de asistencia del personal integrado (hoy usan el software gratuito Open Time Clock). Se haria desde la plataforma web, validando la ubicacion del local y con foto facial; fuera del local no permitiria marcar." (Acta 01, seccion 2).
  "La tablet de marcar registro, ingreso, salida, o sea, es una gestion" (Acta 02, minuto 00:29:47).

- Busqueda en el mockup (`fuente/Admin.dc.html`):
  Texto confirmado en codigo:
  - Registro de usuarios y roles:
    Existen usuarios predefinidos (`mozo01`, `mozo02`, `cajero01`, etc.) en la configuracion de `USUARIOS`.
  - Atribucion de comanda:
    El identificador del mozo en el pedido esta fijado de forma estatica en codigo:
    `canal: o.canal + (o.canal === 'Mozo' ? ' · mozo Luis' : '')`
  - Control de asistencia biometrica / geolocalizada: NO existe ninguna pantalla ni funcionalidad en el mockup para registrar entrada o salida del personal.
  - Asignacion de turnos y mesas: no existe parametrizacion de turnos de trabajo para salon ni delimitacion de mesas asignadas por mozo.

- Grado de cumplimiento: A medias / No cumple en asistencia.

- Donde esta:
  Modulo `Usuarios` (solo visible para admin) y detalle del pedido en `Pedidos y caja`.

- Por que importa para una cafeteria:
  Caprichos requiere reemplazar la aplicacion externa Open Time Clock para que los mozos y demas colaboradores fichen su ingreso y salida directamente en el sistema desde el local. Asimismo, en una cafeteria con rotacion de turnos (manana/tarde), la comanda debe reflejar exactamente que mozo tomo el pedido para efectos de seguimiento y atencion.

- Prioridad: Media.

- Clasificacion: CONFIRMADO en el acta y CONFIRMADO en el codigo.

---

## 3. Matriz Resumen de Cumplimiento

| # | Idea / Requerimiento de Kevin | Cita Corta del Acta | Estado en Mockup | Prioridad |
| :-: | :-- | :-- | :-: | :-: |
| 1 | Tomar pedidos en mesa con tablet | "meseros (toman pedidos con tablet...)" | Cumple | Alta |
| 2 | Plano del local interactivo | "el mozo vera este plano al tomar pedido" | A medias | Alta |
| 3 | Bloqueo de concurrencia en mesas | "aparece un cliente con esos dos pedidos... hay conflicto" | A medias | Alta |
| 4 | Emision de precuenta para cobrar | "el mozo lo que puede hacer es precuentas" | Cumple | Alta |
| 5 | Prohibicion estricta de cobrar al mozo | "el unico responsable de cobrar es caja" | Cumple | Alta |
| 6 | Gestion y liquidacion de propinas | BRD: "propina voluntaria: no fueron elegidos" | No cumple | Baja |
| 7 | Atencion hospitalaria y dual (QR vs asistencia) | "el foco principal es la hospitalidad" | A medias | Media |
| 8 | Pedido de salon directo a cocina | "va directo a las pantallas de cocina" | Cumple | Alta |
| 9 | Alerta de pedidos listos en barra/cocina | "para que los pedidos listos salgan en pantalla" | No cumple | Alta |
| 10 | Reservas simples con marca R en plano | "puedes poner una R reservado no mas" | A medias | Media |
| 11 | Pedidos para llevar y delivery desde salon | "si no es el mozo tambien puede ser caja" | Cumple | Media |
| 12 | Pedido del personal a credito | "creditos al personal... 25% de descuento" | A medias | Alta |
| 13 | Interfaz agil para tablet y modo sin red | "¿el mozo va a poder seguir procesando pedidos?" | A medias | Alta |
| 14 | Turnos, responsables y asistencia | "la tablet de marcar registro, ingreso, salida" | A medias | Media |

---

## 4. Lista de Ideas de Kevin que el Rol Mozo Todavia NO Cumple

A continuacion se detallan los requerimientos explicitados o derivados directamente de las directrices de Kevin Rosales que el rol Mozo en el prototipo actual (`Admin.dc.html`) aun NO cumple o cumple de manera insuficiente:

1. Alerta activa e inmediata de pedidos listos en cocina:
   El mozo no recibe ninguna notificacion emergente, sonora ni visual en su tablet cuando una bebida o plato de su mesa pasa a estado "Listo" en cocina. Unicamente existe un contador numerico pasivo en su escritorio.

2. Permiso para marcar "Entregar al cliente y cerrar":
   Cuando el pedido de salon esta listo y el mozo lo lleva fisicamente a la mesa, el boton `Entregar al cliente y cerrar` (`canDeliver`) se encuentra bloqueado para el rol mozo porque requiere permisos de gestion (`manage: false`). Solo el cajero o admin pueden cambiar el estado a entregado.

3. Soporte para cuentas separadas y pedidos concurrentes en una misma mesa:
   El sistema bloquea absolutamente la seleccion de una mesa si esta tiene cualquier orden activa (`used`), impidiendo que dos personas sentadas en la misma mesa pidan cuentas independientes o que se agreguen nuevos consumos a una mesa ocupada.

4. Resolucion de la liberacion prematura de mesa en cobro adelantado:
   El mockup mantiene la regla de liberar la mesa de inmediato cuando `o.paid === true`. Dado que Kevin establecio la politica de invitar al cobro por adelantado, la mesa desaparece visualmente del plano digital mientras los comensales permanecen sentados consumiendo.

5. Visualizacion de QR dinamico de mesa para comensales jovenes:
   La interfaz del mozo carece de una funcion para generar o mostrar en pantalla el codigo QR asociado a la mesa para aquellos clientes que prefieren revisar la carta y ordenar desde su propio celular.

6. Interfaz simplificada y ergonomica exclusiva para tablets de salon:
   El rol mozo carga el mismo entorno administrativo denso de escritorio (con pestanas de configuracion de tickets, auditoria y filtros avanzados), en lugar de una interfaz tipo punto de venta movil tactil, rapida y limpia para operar de pie en sala.

7. Visualizacion del descuento del 25% en la toma de pedidos del personal:
   Al usar la funcion `Pedido del personal` (`openMoStaff`), el descuento del 25% no se refleja en la comanda del mozo ni se calcula en el subtotal; solo se aplica posteriormente si el cajero ejecuta el cobro a credito en caja. Ademas, el mozo no tiene acceso a consultar su saldo deudor acumulado.

8. Registro de asistencia laboral integrado (reemplazo de Open Time Clock):
   No se ha implementado el modulo de marcacion de asistencia con verificacion de local ni control de turnos para el personal de salon, manteniendo la dependencia de herramientas externas.

9. Notificacion anticipada de 15 minutos para senalizar mesas reservadas:
   No se emite la alerta preventiva que indique al mozo acercarse a la mesa fisica a colocar el cartel o base informativa de reserva ("flyer") 15 minutos antes de la hora reservada por WhatsApp.

10. Identificacion dinamica del mozo en la comanda de cocina:
    El nombre del mozo que atiende la mesa se encuentra fijado en el codigo como texto fijo ("mozo Luis") en lugar de vincular el nombre del usuario autenticado en la sesion de la tablet.

INFORME LISTO.

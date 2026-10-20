---
id: ANA-CAP-030
tipo: analisis
titulo: "INFORME DE AUDITORIA Y EVALUACION: ROL CALL CENTER EN EL MOCKUP ADMINISTRATIVO DE CAPRICHOS"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, delivery-informes]
---

# INFORME DE AUDITORIA Y EVALUACION: ROL CALL CENTER EN EL MOCKUP ADMINISTRATIVO DE CAPRICHOS

## 1. RESUMEN EJECUTIVO Y ALCANCE DEL ROL CALL CENTER

El presente informe evalua de punta a punta el diseno, alcance operativo, reglas de negocio y experiencia de uso del rol **Call Center** (`callcenter`) en el mockup del sistema administrativo de la cafeteria artesanal Caprichos (`fuente/Admin.dc.html`), contrastandolo directamente con las declaraciones, quejas y requerimientos expresados por Kevin Rosales en las actas de descubrimiento (`fuente/acta-01-descubrimiento.md`, `fuente/acta-02-descubrimiento.md`, `fuente/iniciativas-acta-02.md`, `fuente/iniciativas-acta-02-evidencia.md`), los documentos de arquitectura (`fuente/BRD.md`, `fuente/modulos-y-roles.md`, `fuente/flujo-de-pedidos.md`) y la logica real del chatbot entregado por el cliente (`bot/bot_wa.py`, `bot/client_db.py`, `bot/geo_utils.py`, `bot/AGENTS.md`, `bot/LIMITES_DELIVERY.geojson`).

### 1.1. Configuracion del Rol en el Mockup
En el objeto `ROLES` de `fuente/Admin.dc.html`, el perfil esta definido como:
- Identificador: `callcenter`
- Nombre visible: "Call center"
- Usuario demo: `call01`
- Persona: "Operadora de ejemplo"
- Iniciales: "OP"
- Color tematico: `#D9CFC2`
- Vistas accesibles: `['escritorio', 'caja', 'repartos', 'reservas', 'clientes', 'notificaciones']`
- Vista inicial (home): `escritorio`
- Bandera de gestion (`manage`): `false`

### 1.2. Mision Operativa
El rol Call Center esta concebido para centralizar tres frentes criticos de una cafeteria artesanal con alta demanda de delivery y pedidos remotos:
1. Atencion y toma de pedidos manuales ingresados por llamada telefonica o conversacion directa de WhatsApp.
2. Verificacion del cliente, coordinacion del medio de pago y confirmacion de comprobantes para habilitar el pase a produccion (pantallas de cocina y barra).
3. Coordinacion logistica del despacho por delivery: verificacion de direcciones, mapas, tarifas de envio y asignacion o reasignacion de la flota de repartidores motorizados.
Adicionalmente, atiende solicitudes de reserva de mesa y gestiona alertas de intervencion humana derivadas del chatbot o de quejas del servicio posventa.

---

## 2. DECLARACIONES DE KEVIN ROSALES EN LAS ACTAS Y CUMPLIMIENTO EN EL MOCKUP

A continuacion se extraen todas las directrices, experiencias y requerimientos formulados por Kevin Rosales en las reuniones de descubrimiento respecto a delivery, pedidos por telefono, WhatsApp y validacion de comprobantes, auditando su grado de cumplimiento en el prototipo actual.

### 2.1. Toma Manual de Pedidos y Datos Obligatorios
- **Declaracion de Kevin (Acta 02, 00:45:38, C-01):**
  *"yo pongo aca mi numero 946 388 934. Ya, busca el cliente, le encuentra. Ya? Okay. En caso de que no no este el cliente este Nicolas, este le pongo cualquier nombre. registrar un nuevo cliente... pero tengo que ingresar el nombre, el y el numero de la persona, el telefono, si o si. Todo lo que esta en este disco es si o si, esos dos. Y de ahi guardar y continuar."*
- **Verificacion en el Mockup:** CUMPLE PARCIALMENTE CON DEFICIENCIAS GRAVES.
  En el modal de nuevo pedido (`openMo`), al elegir modalidad "Delivery" o "Para llevar", se despliegan los campos Nombre (`cli-n`) y Telefono (`cli-t`) como obligatorios. Sin embargo, el prototipo NO busca al cliente al tipear el numero ni autocompleta el nombre si el cliente ya existe; simplemente almacena cadenas de texto en crudo (`cli.n` y `cli.t`).

### 2.2. Busqueda por Plus Code o Coordenadas de Google Maps
- **Declaracion de Kevin (Acta 02, 00:45:38, C-02):**
  *"Si el cliente me manda una ubicacion, lo que nosotros hacemos es pedimos la ubicacion del cliente y le sale al cliente, por ejemplo, le sale, ya yo vivo aca, el cliente nos manda su ubicacion y nos aparece un punto rojo... Entonces, lo que nosotros hacemos, haciamos en el hola click era copiar el codigo plus y pegarlo en aqui y ya nos solucionar el problema. No se puede aca porque este es otro mapa. Google Maps y aparte hemos intentado trabajar con este mapa en particular que yo tengo el nombre por ahi guardado ese mapa, pero igualito no pega las coordenadas, no funciona su sistema, o sea tienes que buscar manualmente donde es."*
- **Verificacion en el Mockup:** NO CUMPLE.
  El buscador del mapa en `Admin.dc.html` (`mapSearch`) utiliza la API publica de Nominatim (OpenStreetMap) buscando direcciones en texto (`nominatim.openstreetmap.org/search?q=...`). No reconoce codigos Plus de Google Maps (por ejemplo "76X2+5P Lima") ni permite pegar pares de coordenadas directas para ubicar el pin de inmediato. Si falla la busqueda, obliga al operador a navegar y pinchar manualmente sobre el mapa.

### 2.3. Calculo Automatico de Tarifa de Delivery por Rango de Distancia o Poligono
- **Declaracion de Kevin (Acta 02, 00:45:38, C-03):**
  *"aca si puedo colocar, mira, aca si me sale para colocar la ubicacion y aca va a colocar el precio segun el rango, no?"*
  *(Complementado con Acta 02, 00:19:08: "Por ejemplo, hoy dia me mandaron un captura de que no le cobre el delivery a un cliente, no?")*
- **Verificacion en el Mockup:** NO CUMPLE.
  En `Admin.dc.html`, la toma de pedido manual (`openMo`) carece por completo de calculo de delivery. El pin en el mapa (`mapClick`, `mpPlace`) solo guarda latitud y longitud, pero no consulta ninguna tabla de zonas, no lee poligonos ni anade ningun cargo de envio al total (`moTotal` es solo la suma de items del carrito). El pedido se registra con costo de envio S/ 0.00.

### 2.4. Centralizacion de Pantallas de Delivery y Eliminacion del Desorden
- **Declaracion de Kevin (Acta 02, 00:50:20, C-08):**
  *"tiene tantas ventanas para delivery, o sea, esta es una, por ejemplo, este es otro... Te vas a caja, ventas, pedidos en caja, delivery... Liset y Miguel Angel. Estos dos es aca sale todos, todos tienen interfaz diferente... Se pierde. El ultimo pedido es las 9:54. Ya. Entonces, este tiene todas estas estas ventanas, no? La pantalla de cocina, modulo call center, este esto que te estaba mostrando aca, esta de caja, ventas, delivery."*
- **Verificacion en el Mockup:** CUMPLE PARCIALMENTE.
  Se unifico la visualizacion general en el modulo "Pedidos y caja" (`caja`) con pestanas por estado ("Por confirmar", "En curso", "Cerrados") y un modulo especifico de "Repartos". No obstante, persiste fragmentacion operativa: el boton "Nuevo pedido" esta en "Pedidos y caja", mientras que la asignacion de motorizados esta en "Repartos", obligando al operador de Call Center a alternar constantemente entre vistas.

### 2.5. Restriccion de Roles: El Repartidor no Toma Pedidos
- **Declaracion de Kevin (Acta 02, 00:46:53, C-05):**
  *"El delivery no toma P."*
- **Verificacion en el Mockup:** CUMPLE.
  La accion de tomar pedidos manuales (`canTableOrder`) esta reservada estrictamente a `admin`, `cajero`, `mozo` y `callcenter`. El rol `repartidor` no tiene acceso a crear pedidos ni a la vista `caja`.

### 2.6. Flujo de Pago: El Cliente no Sube Comprobantes en la Web
- **Declaracion de Kevin (Acta 02, 00:06:11, A-12):**
  *"No, no, no que lo mande. Este, en este caso estamos esperando tu pago, te contactaremos por WhatsApp para que puedas enviarnos constancia, algo así. Sí. O sea, hacerle la vida fácil al cliente, que pida fácil y que envíe la captura al WhatsApp. Sí. O sea, para que en el WhatsApp por donde se inició la conversación o en caso de que ingrese directo al link, ya entablemos comunicación en el WhatsApp para la entrega también para coordinar, para darle seguimiento al pedido, no?"*
- **Verificacion en el Mockup:** CUMPLE EN LA CARTA, PERO GENERA UN CUELLO DE BOTELLA EN ADMINISTRACION.
  En `Main.dc.html`, el cliente no sube imagenes y ve el mensaje: "Un asesor te escribira por WhatsApp... No envies capturas por tu cuenta". En `Admin.dc.html`, el pedido cae como "Por confirmar". El asesor abre el modal `openPc`, donde obligatoriamente debe subir el archivo de comprobante si se eligio medio digital. Si el operador valido el abono mirando su celular y no tiene el archivo en la computadora, el sistema le bloquea el pase a cocina.

### 2.7. Notificacion Proactiva de Recepcion de Pedido
- **Declaracion de Kevin (Acta 02, 00:06:11, A-13):**
  *"hola, Click, tiene algo bien bonito que se que es un bot que cuando el pedido, nosotros por ejemplo recibimos el pedido de forma automática, el bot lo que hace es que le envía, 'Hemos recibido tu pedido.' de arranque al WhatsApp, de golpe al WhatsApp, ya el bot se adelanta y inicia la conversación por el WhatsApp. Con qué dato? Con el dato que el número del cliente que el número que el cliente ingresó a la carta digital."*
- **Verificacion en el Mockup:** NO CUMPLE (ES MANUAL).
  En el mockup no existe envio automatico por API al ingresar la orden web. El operador de Call Center debe ingresar manualmente al pedido, abrir la ventana de confirmacion (`openPc`) y pulsar el enlace `a href="https://wa.me/51..."` para abrir WhatsApp Web o la aplicacion de escritorio y enviar el texto prellenado.

### 2.8. Memoria de Ubicacion por Numero de Telefono y Verificacion Rapida
- **Declaracion de Kevin (Acta 02, 01:07:16 y 01:08:33, C-32, C-33):**
  *"porque el Hola Click, algo lo bueno que tiene el Hola Click es que con el número ya lo asociaba el número y recordaba la ubicación para que el cliente no esté nuevamente colocando su ubicación en el aplicativo... Que le preguntaba al cliente? Era es para su misma ubicación. Esta es su ubicación, le decía, no? O sea, y le mostraba ahí el mapa."*
- **Verificacion en el Mockup:** NO CUMPLE.
  No existe memoria historica de direcciones vinculadas al telefono en la toma manual. Al ingresar un numero en `cli-t`, el sistema no recupera la direccion anterior ni muestra el dialogo confirmatorio "¿Es para su misma ubicacion?". El operador debe volver a teclear la calle y reposicionar el pin en cada compra.

### 2.9. Alerta Roja "Se Requiere Atencion" y Transferencia Humana
- **Declaracion de Kevin (Acta 02, 02:07:02 y 02:09:18, E-37, E-38):**
  *"cuando se va al punto rojo que está en la izquierda, donde dice se requiere atención, es cuando el bot hace la transferencia al humano y ahí una alerta parece, se requiere atención... y ahí es donde tienen que intervenir el cajero o para procesar el pedido... cuando marcas como atendido en la parte derecha, se va para hoy. Entonces requiere atención, queda vacío."*
- **Verificacion en el Mockup:** CUMPLE.
  En `Admin.dc.html`, la campana y la barra superior integran `alertsPend` (visibles para `callcenter`), permitiendo gestionar alertas de "Cliente pide una persona" o "Queja en la encuesta", contactar al cliente por enlace directo a WhatsApp y presionar "Marcar como atendido".

### 2.10. Reservas de Mesa Centralizadas por WhatsApp con Tolerancia de 15 Minutos
- **Declaracion de Kevin (Acta 02, 00:58:46, C-12, C-14, C-16, C-17):**
  *"Usualmente escriben en el WhatsApp y quiero reservar... le reservamos una mesa para las 8, le damos 15 minutos de tolerancia y si no liberamos la mesa... pues ahí puedes poner una R reservado no más... pero no una categoría entera... solo nosotros lo reservamos y cuando llega el cliente le tomamos pedidos."*
- **Verificacion en el Mockup:** CUMPLE.
  El modulo `reservas` gestiona solicitudes de WhatsApp (`solPend`), asigna mesas libres verificando capacidad, marca la mesa con "R" en el plano del local y contempla la tolerancia de 15 minutos.

---

## 3. REVISION EXTREMO A EXTREMO DE LOS PROCESOS DEL CALL CENTER

### 3.1. Pedidos por Confirmar y Bandeja de Entrada
- **Flujo observado:**
  Los pedidos procedentes de la Carta Web o del Chatbot entran con `status: 'nuevo'` si su modalidad es `delivery` o `llevar`.
  El Call Center recibe la alerta en la campana de notificaciones (`porAceptar > 0`), en el KPI del Escritorio ("Delivery por confirmar") y en la pestana "Por confirmar" de la vista `caja`.
- **Fallas detectadas:**
  1. Si un operador de Call Center toma un pedido telefónico manualmente desde "Nuevo pedido" (`openMo`), al finalizarlo con modalidad delivery el sistema lo guarda como `nuevo` ("Por confirmar"). Esto obliga al propio operador a tener que "confirmar" un pedido que el mismo acaba de tomar por telefono, duplicando pasos absurdamente.
  2. La campana muestra un texto estatico en el detalle: *"Caja debe verificarlos y aceptarlos para que pasen a cocina"*, omitiendo que el Call Center tambien tiene dicha potestad y confundiendo al personal.

### 3.2. Comprobante y Confirmacion de Pago
- **Flujo observado:**
  Al presionar "Confirmar pedido y pago" (`openPc`), se abre un modal con tres fases:
  1. Habla con el cliente (muestra texto prellenado y boton hacia WhatsApp). Checkbox obligatorio: *"Ya hable con el cliente y el pedido esta bien"*.
  2. Seleccion de medio de pago: Efectivo, Yape, Plin, Transferencia o Tarjeta.
  3. Si es Efectivo o Tarjeta, no exige comprobante. Si es Yape, Plin o Transferencia (`pcDigital`), exige obligatoriamente adjuntar un archivo de imagen (`pcPickImg`) y permite un codigo de operacion opcional.
  Al confirmar (`pcConfirm`), la orden pasa a `paid: true`, `status: 'cola'` (cocina), se graba el usuario confirmador (`payBy: role.n`) y la hora fija estatica `21:40`.
- **Fallas detectadas:**
  1. Exigencia inflexible de archivo de imagen: En una operacion real de call center, la cajera u operadora muchas veces tiene el celular del negocio en la mano y revisa la notificacion de Yape en pantalla. Forzarla a transferir la imagen a la computadora para adjuntarla en el navegador genera demoras criticas y rechazo de uso.
  2. Hora fija de confirmacion: En la funcion `pcConfirm`, el campo `payAt` esta quemado con el valor estatico `'21:40'` en lugar de tomar la hora real del reloj interno (`clockMin`).
  3. Bloqueo para cambiar tipo de comprobante: Si el cliente solicita Boleta o Factura durante la llamada o chat, el Call Center no puede cambiarlo porque los botones de comprobante (`compChips`) exigen `canManage`, propiedad que es `false` para Call Center.

### 3.3. Mensaje de WhatsApp con Resumen del Pedido
- **Flujo observado:**
  La funcion `pcMsgOf(o)` construye un mensaje estructurado que incluye:
  - Saludo personalizado con el primer nombre del cliente.
  - Codigo de pedido.
  - Desglose de productos con cantidades y especificaciones/opciones.
  - Nota especial si existe.
  - Modalidad de entrega (con direccion y referencia si es delivery).
  - Monto total y medio de pago preferido.
  - Cierre invitando a validar el pedido y coordinar el pago.
- **Fallas detectadas:**
  1. Si el numero de telefono contiene caracteres no numericos defectuosos o viene vacio, la URL resultante es `https://wa.me/51?text=...`, lo cual causa error en WhatsApp Web sin advertir al usuario.
  2. No incluye los datos bancarios ni los numeros de Yape/Plin de la empresa en el mensaje, obligando al operador a redactarlos manualmente en WhatsApp.

### 3.4. Nuevo Pedido por Telefono (Toma Manual)
- **Flujo observado:**
  Se activa mediante `openMo`. Permite seleccionar "Delivery", ingresar Nombre, Telefono, Direccion, Referencia, seleccionar punto en el mapa, armar el carrito con variantes y modificadores identicos a la carta, aplicar cupones o descuentos y registrar la cuenta del cliente.
- **Fallas detectadas:**
  1. El boton "Nuevo pedido" no esta disponible en el Escritorio del Call Center ni en Repartos; solo se puede acceder entrando a la vista de "Pedidos y caja".
  2. Falta de validacion y busqueda automatica por telefono en el primer paso.
  3. Inconsistencia de navegacion: si el operador se equivoca de modalidad en el paso inicial, el boton de retroceso (`moBack`) a veces reinicia el formulario borrando datos ingresados.

### 3.5. Cuenta del Cliente por DNI y Acumulacion de Puntos
- **Flujo observado:**
  En el paso del carrito de `openMo`, la seccion "¿Quien pide?" ofrece: "Sin cuenta", "Cliente con cuenta (DNI)" y "Personal".
  Al tipear 8 digitos y dar "Buscar" (`moDniFind`), busca en la coleccion `clientes`. Si existe, asocia la cuenta y calcula que el pedido sumara puntos (1 punto por cada S/ 1). Si no existe, abre "Registro rapido en el local" solicitando Nombre, Cumpleanos, Correo y aceptacion de tratamiento de datos.
- **Fallas detectadas:**
  1. Redundancia de ingreso de datos: El operador ya escribio el nombre del cliente en el paso 1 (`cli.n`), pero el formulario de registro rapido aparece en blanco (`regN: ''`), obligandolo a escribir el nombre por segunda vez.
  2. Desvinculacion del telefono: Al guardar el registro rapido (`regDo`), el cliente se guarda con `tel: ''`, perdiendose el numero ingresado en el paso anterior (`cli.t`).
  3. El Call Center no puede buscar al cliente por DNI al inicio de la llamada para precargar su nombre, telefono y direccion; la busqueda por DNI esta confinada al final del pedido, despues de haber cargado los productos.

### 3.6. Direccion, Mapas y Geolocalizacion
- **Flujo observado:**
  El paso `cli` incluye un mapa interactivo renderizado con cuadrantes de OpenStreetMap (`mapTiles`), controles de desplazamiento direccional (`← ↑ ↓ →`), acercamiento/alejamiento (`- +`) y escucha de clics para fijar el pin de entrega (`mapClick`, `mpPlace`). Posee un buscador de texto (`mapSearch`) y un boton "O usar la ubicacion actual de este equipo" (`useGpsMo`).
- **Fallas detectadas:**
  1. El boton "Usar ubicacion actual de este equipo" es un contrasentido operativo para Call Center: si la operadora presiona ese boton, el sistema captura el GPS del local o del domicilio de la operadora, fijando esa coordenada como destino del pedido del cliente.
  2. No admite Plus Codes ni coordenadas directas de Google Maps, incumpliendo el requerimiento C-02 de Kevin.
  3. Dependencia estricta de internet: el buscador realiza peticiones externas a OpenStreetMap. Si la cafeteria se queda sin conexion (situacion frecuente descrita por Kevin en E-17), el mapa queda ciego y no permite resolver ninguna direccion.

### 3.7. Zonas de Cobertura y Costo de Envio
- **Flujo observado:**
  El mockup carece de motor tarifario de reparto en el administrativo.
- **Fallas detectadas:**
  1. Omision de las zonas reales Z2 a Z7: El chatbot real posee poligonos en `LIMITES_DELIVERY.geojson` que determinan si el costo es S/ 2, S/ 3, S/ 4, etc., o si la direccion queda fuera de cobertura (`-1`). El mockup administrativo no tiene esta logica.
  2. Tarifa plana cero involuntaria: Todo pedido creado por Call Center se computa con delivery gratis, generando perdidas economicas para el negocio y descuadres frente a la liquidacion de los motorizados.
  3. No respeta la regla de delivery gratis por monto minimo configurada en el local (`envioGratis: 70`), ya que ni siquiera calcula el flete base.

### 3.8. Coordinacion y Asignacion de Repartidores
- **Flujo observado:**
  En la vista `repartos`, los pedidos de delivery listos aparecen como "Disponible". El Call Center visualiza a los tres repartidores (`r1`, `r2`, `r3`) y tiene botones para asignar directamente el pedido a cualquiera de ellos (`assign`), o bien los repartidores pueden autoasignarselo desde su propia interfaz.
- **Fallas detectadas:**
  1. Ceguera temporal de despacho: El Call Center solo ve el pedido en `repartos` cuando cocina lo marca como `listo`. No puede preasignar un motorizado mientras el pedido esta en preparacion (`prep`), impidiendo planificar rutas agrupadas con antelacion.
  2. Falta de asignacion directa desde Pedidos: Si la operadora esta en la vista `caja` viendo el pedido listo, la interfaz le dice: *"Listo en cocina. Asigna un repartidor en la pestana Repartos"*, obligandola a salir de pedidos, ir a repartos, buscar la comanda y recien asignar.

### 3.9. Gestion de Reservas de Mesa
- **Flujo observado:**
  El Call Center tiene acceso completo al modulo `reservas`. Visualiza solicitudes entrantes de WhatsApp con nombre, comensales y hora. El sistema filtra las mesas del plano que tengan capacidad suficiente y no esten ocupadas. Al presionar "Aprobar", la reserva se confirma y bloquea la mesa con la letra "R".
- **Fallas detectadas:**
  1. La tolerancia de 15 minutos no cuenta con liberacion automatica ni temporizador visible en la lista; requiere que un operador recuerde el tiempo y libere la mesa manualmente.
  2. No se pueden registrar reservas para fechas futuras distintas al dia en curso dentro de la maqueta interactiva.

### 3.10. Clientes Frecuentes
- **Flujo observado:**
  El modulo `clientes` permite consultar clientes registrados, su historial de pedidos y su puntaje acumulado.
- **Fallas detectadas:**
  1. Durante la llamada telefonica, el Call Center no recibe ninguna indicacion visual de si quien llama es un cliente frecuente, cuantos pedidos tiene o que productos suele pedir habitualmente.
  2. En el bot real (`client_db.py`, `get_client_delivery_cost`), los clientes frecuentes pueden tener tarifas de delivery preferenciales o descuentos silenciosos; en el mockup administrativo esta regla no existe.

### 3.11. Pedido Repetido (Recurrente)
- **Flujo observado:**
  En la ficha de historial del cliente dentro del modulo `clientes` (`chList`), se listan los pedidos pasados con su ID, modalidad, total y estado.
- **Fallas detectadas:**
  1. NO EXISTE funcion ni boton de "Repetir pedido".
  2. Si un cliente frecuente llama y dice *"mandame lo mismo de ayer"*, la operadora tiene que abrir el historial, leer lo que pidio, memorizarlo o anotarlo en un papel, abrir "Nuevo pedido", buscar cada producto uno por uno en el catalogo y volver a configurar todas sus opciones manualmente.

### 3.12. Cliente que no Contesta
- **Flujo observado:**
  En `Admin.dc.html`, si un pedido esta por confirmar y el cliente no atiende la llamada ni contesta el WhatsApp, solo existen dos opciones: confirmar (lo cual es imposible porque exige validar pago) o "Rechazar".
- **Fallas detectadas:**
  1. No existe un estado intermedio de "No contesta", "Reintento pendiente" o "En espera de respuesta".
  2. Si el motorizado esta en la puerta del domicilio y el cliente no contesta, la interfaz de repartos solo permite marcar "Entregado al cliente". No hay boton para reportar "Cliente ausente / no contesta" ni registrar la devolucion del pedido a cafeteria.

### 3.13. Cancelacion y Anulacion de Pedidos
- **Flujo observado:**
  Solo se pueden rechazar pedidos que se encuentren en estado `nuevo` ("Por confirmar").
- **Fallas detectadas:**
  1. Imposibilidad de cancelar pedidos en curso: Si un pedido ya fue aceptado y pasa a `cola`, `prep`, `listo` o `ruta`, desaparece todo boton de anulacion o cancelacion en el mockup.
  2. Si un cliente llama para cancelar porque tardo demasiado, o si se genero un pedido duplicado por error concurrente (problema frecuente advertido por Kevin en C-08 y C-09), el Call Center no tiene ninguna herramienta en pantalla para anular la comanda.

### 3.14. Alertas de Atencion Humana y Posventa
- **Flujo observado:**
  El panel superior y la campana integran la seccion `showAlerts`, que despliega alertas criticas: "Cliente pide una persona" y "Queja en la encuesta". Cada alerta muestra el cliente, telefono, tiempo transcurrido, boton para abrir chat de WhatsApp y boton "Marcar como atendido".
- **Cumplimiento:**
  Cumple satisfactoriamente con los requerimientos E-37 y E-38 de Kevin, permitiendo al Call Center actuar como la primera linea de resolucion de reclamos.

---

## 4. MATRIZ DE HALLAZGOS Y FALLAS DE USABILIDAD (UX / OPERACION)

A continuacion se presenta la matriz detallada de hallazgos clasificados bajo los estandares exigidos: ubicacion exacta, impacto en la cafeteria, prioridad y estado de confirmacion.

| ID | Hallazgo y Ubicacion | Impacto Operativo en la Cafeteria | Prioridad | Estado |
| :--- | :--- | :--- | :---: | :---: |
| **H-01** | **Restriccion indebida de permisos por `manage: false`**<br>*Ubicacion:* `fuente/Admin.dc.html`, definicion de rol `callcenter` y variables `canManage`, `compChips`, `canReprint`. | Impide que el Call Center cambie el tipo de comprobante a Boleta o Factura a solicitud del cliente, o que reimprima comandas en caso de fallas de ticketera. | **Alta** | CONFIRMADO en el codigo |
| **H-02** | **Inexistencia de calculo de costo de delivery y zonas geograficas**<br>*Ubicacion:* `fuente/Admin.dc.html`, funcion `sendMo` y evento `mapClick`. | Todos los pedidos manuales de delivery se cargan con flete S/ 0.00. La cafeteria asume el flete perdiendo dinero y Kevin reporto quejas por cobros omitidos. | **Alta** | CONFIRMADO en el codigo y en el acta |
| **H-03** | **Falta de memoria de direccion y autocompletado por telefono**<br>*Ubicacion:* `fuente/Admin.dc.html`, funcion `setCliT` y modal `isMoCli`. | En cada llamada de delivery se obliga a pedir y registrar nombre y direccion desde cero, aumentando el tiempo de llamada y frustrando al cliente habitual. | **Alta** | CONFIRMADO en el codigo y en el acta |
| **H-04** | **Incompatibilidad con codigos Plus y coordenadas de Google Maps**<br>*Ubicacion:* `fuente/Admin.dc.html`, funcion `mapSearch`. | El Call Center no puede pegar el codigo Plus que el cliente envia por WhatsApp; la busqueda de Nominatim falla y se pierde tiempo ubicando la casa a mano. | **Alta** | CONFIRMADO en el codigo y en el acta |
| **H-05** | **Bloqueo estricto por falta de archivo de comprobante de pago**<br>*Ubicacion:* `fuente/Admin.dc.html`, funcion `pcConfirm` (`pcDigital(p.medio) && !p.img`). | Si la operadora valida el Yape en el celular del negocio y no tiene el archivo en la PC, el sistema no la deja enviar el pedido a cocina, paralizando la orden. | **Alta** | CONFIRMADO en el codigo |
| **H-06** | **Imposibilidad de cancelar o anular pedidos en preparacion o ruta**<br>*Ubicacion:* `fuente/Admin.dc.html`, pie de detalle de pedido `cj-foot`. | Si el cliente desiste, no contesta o el pedido se duplica, el Call Center no puede cancelar la orden una vez enviada a cocina, distorsionando cocina y caja. | **Alta** | CONFIRMADO en el codigo y en el acta |
| **H-07** | **Auto-confirmacion redundante en pedidos telefonicos**<br>*Ubicacion:* `fuente/Admin.dc.html`, funcion `sendMo` (`status: m.modal === 'local' ? 'cola' : 'nuevo'`). | Un pedido tomado en vivo por telefono por el Call Center se guarda como "Por confirmar", obligando al mismo operador a simular que contacta al cliente por WhatsApp. | **Media** | CONFIRMADO en el codigo |
| **H-08** | **Boton de GPS institucional absurdo en Call Center**<br>*Ubicacion:* `fuente/Admin.dc.html`, funcion `useGpsMo` en modal `isMoCli`. | Si el operador presiona "Usar ubicacion de este equipo", fija la ubicacion geografica del operador (local o casa) como destino del cliente que llamo por telefono. | **Media** | CONFIRMADO en el codigo |
| **H-09** | **Ausencia de funcion para repetir pedidos frecuentes**<br>*Ubicacion:* `fuente/Admin.dc.html`, vista de cliente `cliVals` y pestana `isCh`. | Obliga a rearmar manualmente pedidos identicos de clientes diarios (ej. combo desayuno), incrementando la cola telefonica en horas pico. | **Media** | CONFIRMADO en el codigo |
| **H-10** | **Doble ingreso de nombre y perdida de telefono en registro DNI**<br>*Ubicacion:* `fuente/Admin.dc.html`, funciones `moDniFind` y `regDo`. | Tras haber digitado el nombre en el paso 1, el formulario pide escribirlo de nuevo; al guardar, no transfiere el telefono ingresado al registro del cliente. | **Media** | CONFIRMADO en el codigo |
| **H-11** | **Boton "Nuevo pedido" inaccesible desde Escritorio**<br>*Ubicacion:* `fuente/Admin.dc.html`, plantilla `<!-- ===== CAJA: PEDIDOS ===== -->`. | El operador no puede iniciar una llamada desde su pantalla principal de trabajo; debe obligatoriamente hacer clic en "Pedidos y caja" primero. | **Baja** | CONFIRMADO en el codigo |
| **H-12** | **Ceguera de planificacion de despacho en Repartos**<br>*Ubicacion:* `fuente/Admin.dc.html`, definicion de lista `dels`. | No permite preasignar motorizados mientras el pedido esta en preparacion en cocina, retrasando la salida inmediata apenas sale la comida. | **Media** | CONFIRMADO en el codigo |
| **H-13** | **Hora estatica quemada en confirmacion de pago (`21:40`)**<br>*Ubicacion:* `fuente/Admin.dc.html`, llamada `this.acceptOrder` en `pcConfirm`. | Registra en la auditoria que todos los pedidos fuera del local fueron confirmados exactamente a las 21:40, viciando los reportes de tiempos de atencion. | **Baja** | CONFIRMADO en el codigo |
| **H-14** | **Inexistencia de flujo para "Cliente que no contesta"**<br>*Ubicacion:* `fuente/Admin.dc.html`, modales `isPc` y vista `repartos`. | No hay etiquetas de intento de llamada fallido ni protocolo para motorizado varado en puerta sin respuesta del cliente. | **Media** | CONFIRMADO en el codigo y en el acta |

---

## 5. COMPARATIVA CON LA LOGICA REAL DEL CHATBOT (`bot/`)

El analisis del codigo fuente real del bot de WhatsApp entrega importantes lecciones y reglas operativas que el mockup administrativo no ha incorporado:

### 5.1. Gestion de Zonas y Cobertura (`bot/geo_utils.py` y `bot/LIMITES_DELIVERY.geojson`)
- **En el bot real:** La funcion `calculate_delivery_cost(lat, lon)` evalua si el punto cae dentro de poligonos GeoJSON precisos de Lima Este / San Juan de Lurigancho (Campoy, Mangomarca, Zarate, etc.). Si cae en Z2 cobra S/ 2; en Z3, S/ 3; etc. Si esta fuera de todo limite, devuelve `-1` ("Fuera de cobertura").
- **En el mockup administrativo:** No existe archivo GeoJSON ni evaluacion geometrica; el costo de envio simplemente no se calcula.

### 5.2. Tarifas Personalizadas y Descuentos Silenciosos (`bot/client_db.py`)
- **En el bot real:** La funcion `get_client_delivery_cost(phone, standard_cost)` consulta `clientes.json`. Si el cliente tiene `costo_delivery_fijo` (ej. S/ 2.50) o `descuento_delivery` (ej. 50%), se le aplica de forma silenciosa sin necesidad de que ingrese ningun cupon.
- **En el mockup administrativo:** El modulo de clientes no almacena tarifas especiales de delivery por cliente ni permite fijar condiciones comerciales diferenciadas.

### 5.3. Debouncer y Agrupacion de Mensajes (`bot/bot_wa.py`)
- **En el bot real:** Existe un debouncer de 2 segundos (`process_debounced_messages_wa`) para apilar mensajes fragmentados que el cliente manda en WhatsApp antes de responderle o consolidar la orden.
- **En el mockup administrativo:** Se asume que el pedido llega como un paquete cerrado y unico, sin contemplar modificaciones concurrentes en el chat.

### 5.4. Registro Persistente de Atributos (`bot/client_db.py`, `save_client_info`)
- **En el bot real:** Cada interaccion exitosa guarda permanentemente: nombre, celular, total de pedidos aprobados y ultima ubicacion GPS (`ultima_ubicacion`).
- **En el mockup administrativo:** `clientes` almacena DNI, nombre, tipo, telefono, email, cumpleanos, pedidos y puntos, pero NO almacena la ultima direccion ni coordenadas de delivery.

---

## 6. RECOMENDACIONES DE REDISENO Y MEJORAS URGENTES

Para transformar el rol Call Center en una herramienta de alta eficiencia que resuelva los problemas reales vividos por Kevin Rosales y su equipo, se deben ejecutar las siguientes correcciones:

1. **Correccion de Permisos del Rol (`manage`):**
   Habilitar `manage: true` para `callcenter` en `Admin.dc.html`, o bien desacoplar la variable `canManage` para que el Call Center pueda modificar el tipo de comprobante (Boleta/Factura), reimprimir comandas por fallo de hardware y emitir notas de venta.

2. **Integracion del Motor GeoJSON y Calculo de Delivery:**
   Migrar los poligonos de `LIMITES_DELIVERY.geojson` a una funcion ligera en JavaScript (usando algoritmo de punto en poligono - ray casting). Al hacer clic en el mapa o buscar direccion, el sistema debe autocalcular el costo de envio (S/ 2 a S/ 7), verificar el umbral de envio gratis (`envioGratis: 70`) y sumar el flete a la orden.

3. **Memoria de Direccion por Telefono y Buscador Plus Code:**
   Al escribir el numero de telefono en la toma manual:
   - Si el telefono existe en compras anteriores, autocompletar el nombre y preguntar: *"¿Es para su misma ubicacion: [Direccion guardada]?"* con un boton de validacion inmediata.
   - En el buscador del mapa, incorporar decodificacion de Google Maps Plus Codes mediante la libreria oficial `open-location-code` (de Google, de codigo abierto) o expresiones regulares para aceptar coordenadas directas `lat, lng`.

4. **Flexibilizacion de la Confirmacion de Comprobantes:**
   En el modal `openPc`, permitir marcar una casilla: *"Validado visualmente en app bancaria / SMS"* con ingreso obligatorio del codigo de operacion, haciendo que la subida del archivo grafico sea opcional cuando se opere desde terminales sin camara o sin WhatsApp sincronizado. Corregir la hora estatica `21:40` para que adopte la hora actual del sistema.

5. **Eliminacion de la Auto-Confirmacion en Llamadas:**
   Si el pedido es ingresado directamente por un operador autenticado con rol `callcenter` o `cajero`, la orden debe pasar directamente a cocina si el pago ya fue coordinado en la misma llamada, sin obligar a pasar por la bandeja de "Por confirmar".

6. **Flujo de Anulacion y Estados para Clientes que no Contestan:**
   - Incorporar en el detalle de la comanda un boton "Anular pedido" (con solicitud de motivo: duplicado, desistimiento, error de digitacion) habilitado para estados `cola`, `prep` y `listo`.
   - Incorporar estados de "Cliente no contesta" tanto en la bandeja de confirmacion (con registro de intentos) como en el despacho de reparto (para registrar reintentos de entrega o retorno a base).

7. **Boton "Repetir Pedido":**
   En la pestana de historial del cliente dentro del modulo `clientes`, anadir el boton "Cargar este pedido al carrito", copiando automaticamente los productos, variantes y notas para cerrar la llamada en menos de 30 segundos.

---

## 7. CONCLUSION

El rol de Call Center en el mockup actual de Caprichos cuenta con aciertos de diseno notables: centraliza la campana de alertas humanas (transferencia de bot y reclamos de encuestas), proporciona una interfaz estructurada para redactar el resumen de pedido a WhatsApp y ofrece una vista limpia de las reservas con asignacion de mesas en plano.

Sin embargo, adolece de fricciones criticas que comprometen su viabilidad en un entorno de cafeteria real: carece de calculo de tarifas de delivery (generando perdidas economicas directas), no recuerda las direcciones de clientes recurrentes, bloquea la operacion si no se sube una imagen de comprobante, no reconoce codigos Plus y priva al operador de la capacidad de emitir facturas/boletas o anular pedidos en curso. Aplicando las correcciones descritas, el sistema alcanzara la agilidad, robustez y fidelidad operativa que el cliente solicito.

INFORME LISTO

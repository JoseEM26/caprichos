---
id: ANA-CAP-031
tipo: analisis
titulo: "INFORME DE EVALUACION OPERATIVA Y TECNICA: ROL REPARTIDOR Y SISTEMA DE REPARTO"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, delivery-informes]
---

# INFORME DE EVALUACION OPERATIVA Y TECNICA: ROL REPARTIDOR Y SISTEMA DE REPARTO

## 1. INTRODUCCION Y ALCANCE

El presente informe realiza una auditoria tecnica y funcional sobre el rol del repartidor (motorizado) y todo el subsistema de despacho a domicilio en el prototipo del sistema administrativo (fuente/Admin.dc.html), la carta digital (fuente/Main.dc.html), el chatbot demostrativo (fuente/Chatbot.dc.html) y la documentacion del proyecto (fuente/BRD.md, fuente/modulos-y-roles.md, fuente/flujo-de-pedidos.md, actas de descubrimiento). Asimismo, contrasta estos componentes con la implementacion real del chatbot de produccion ubicado en la carpeta bot/ (geo_utils.py, LIMITES_DELIVERY.geojson, js/zones.js, bot_wa.py, client_db.py y AGENTS.md).

El objetivo es determinar la madurez de la solucion actual frente a los requerimientos operativos de una cafeteria artesanal en Lima (Caprichos, ubicada en Campoy, San Juan de Lurigancho), identificando discrepancias de diseno, riesgos financieros en la liquidacion de caja, y especificando que logica geoespacial y comercial del bot real aun no ha sido incorporada al prototipo.

---

## 2. AUDITORIA DETALLADA DEL ROL REPARTIDOR EN EL MOCKUP

El rol repartidor esta configurado en el prototipo con el usuario 'rep01' (color #D99E39, iniciales 'R1') y tiene acceso restringido a tres vistas: Escritorio ('escritorio'), Repartos ('repartos') y Notificaciones ('notificaciones'). A continuacion se desglosa el analisis sobre cada uno de los aspectos solicitados.

### 2.1. Lista de pedidos por entregar

- Hallazgo y ubicacion:
  En fuente/Admin.dc.html (objeto ROLES y controladores de 'escritorio' y 'repartos').
  En la vista Escritorio, el repartidor ve cuatro tarjetas KPI resumen: 'Disponibles para tomar', 'Por salir', 'En camino' y 'Entregados hoy'. Ademas, ve la lista 'Mis pedidos por entregar', que filtra unicamente los pedidos de modalidad delivery asignados a su identificador ('r1', 'r2' o 'r3') con estado 'listo' o 'ruta'. Los pedidos disponibles sin tomar no aparecen en la lista de su escritorio, sino que debe pulsar el enlace 'Tomar un pedido disponible' que lo redirige a la vista Repartos.
  En la vista Repartos, el repartidor ve una cuadricula con dos tipos de tarjetas:
  1. Pedidos con estado 'listo' que no tienen motorizado asignado (se muestran con etiqueta 'Disponible').
  2. Pedidos asignados a el ('o.rider === me') en estados 'listo', 'ruta' o 'entregado'.
  Discrepancia detectada: El documento fuente/modulos-y-roles.md establece explicitamente en la seccion del Repartidor: "No ve: pedidos de otros repartidores, montos ni ningun otro modulo". Sin embargo, en el codigo de Admin.dc.html, tanto en la vista Escritorio como en Repartos, el repartidor visualiza claramente el monto total del pedido (propiedad 'totalText' con formato 's/ XX.XX') y el estado del pago ('Efectivo · cobrar' o 'Yape · cobrado').
- Por que importa para una cafeteria:
  Para una cafeteria artesanal, que el repartidor vea el monto es indispensable si el pedido es con pago contra entrega en efectivo, ya que de lo contrario no sabria cuanto dinero exigir al cliente ni que vuelto entregar. No obstante, la contradiccion entre la documentacion de requerimientos y el codigo genera dudas sobre politicas de confidencialidad de ventas de la empresa.
- Prioridad: Alta.
- Estado: CONFIRMADO en el codigo (Admin.dc.html) y en la documentacion (modulos-y-roles.md).

### 2.2. Tomar un pedido (reclamarlo) y condicion de carrera

- Hallazgo y ubicacion:
  En fuente/Admin.dc.html (funcion 'claim' y boton 'd.race'), respaldado por fuente/modulos-y-roles.md (seccion 4.1) y fuente/BRD.md (regla RN-CAP-024).
  El prototipo implementa la regla de negocio solicitada por el cliente: un pedido listo aparece disponible para los 3 repartidores; el primero que lo reclama se lo adjudica. En la tarjeta aparece el boton 'Tomar este pedido'. Al pulsarlo, se dispara la confirmacion 'ask'. Si el pedido ya fue reclamado por otro companero, se muestra un mensaje de advertencia: 'No se pudo: [Nombre Repartidor] tomo el pedido [ID] un instante antes. Elige otro pedido'. El mockup incluye ademas un boton de prueba interactiva titulado 'Solo prototipo: simular que otro repartidor lo toma a la vez' para evidenciar este caso de uso.
- Por que importa para una cafeteria:
  Evita duplicidad de salidas y traslados innecesarios. En horas punta (tardes y noches), cuando salen varios pedidos de frappes y waffles calientes al mismo tiempo, los motorizados no deben disputarse fisicamente los paquetes ni salir dos personas hacia la misma direccion.
- Prioridad: Alta.
- Estado: CONFIRMADO en el codigo y en el acta de reunion.

### 2.3. Mapa y ruta

- Hallazgo y ubicacion:
  En fuente/Admin.dc.html (vistas 'escritorio' y 'repartos').
  En todo el prototipo administrativo NO existe ningun mapa embebido ni visualizacion cartografica para el repartidor. No hay mapas de calor, ni visualizador Leaflet, ni plano interactivo de la ciudad. Tampoco existe trazado de rutas entre paradas ni optimizacion del recorrido.
- Por que importa para una cafeteria:
  Los productos de cafeteria (especialmente bebidas frias con chantilly, bebidas calientes y waffles) tienen una vida util muy corta antes de perder temperatura o derretirse (como indico Kevin Rosales en el acta 02, el chantilly llega derretido si el viaje demora o se mueve demasiado). No tener un mapa visual de ruta obliga al repartidor a salir a ciegas sin dimensionar la dispersion de sus destinos.
- Prioridad: Media.
- Estado: CONFIRMADO en el codigo (ausencia total de mapas internos en el rol repartidor).

### 2.4. Abrir en Google Maps o Waze

- Hallazgo y ubicacion:
  En fuente/Admin.dc.html (constantes 'waze' y 'gmaps', y botones en cada tarjeta de reparto).
  Cada tarjeta de pedido en Repartos y en el Escritorio cuenta con dos botones directos: 'Google Maps' y 'Waze'.
  La construccion tecnica de los enlaces es:
  - Google Maps: 'https://www.google.com/maps/search/?api=1&query=' concatenando el texto de la direccion mas ' Lima Peru'.
  - Waze: 'https://waze.com/ul?q=' concatenando el texto de la direccion mas ' Lima Peru' y '&navigate=yes'.
  Deficiencia detectada: Ambas funciones envian unicamente el texto libre que el cliente escribio en el formulario de la carta (por ejemplo 'Jr. Los Pinos 215, Campoy'). No utilizan coordenadas de latitud y longitud geograficas (GPS), a pesar de que el bot de WhatsApp y la carta web disponen de geolocalizacion. Si el cliente cometio una falta ortografica o puso una direccion sin numeracion exacta, Waze y Google Maps ubican puntos erroneos o centroides distritales lejanos.
- Por que importa para una cafeteria:
  En zonas perifericas como San Juan de Lurigancho y Campoy, muchas calles comparten nombres similares o carecen de numeracion correlativa oficial en las plataformas de navegacion. Abrir por coordenadas GPS exactas garantiza que el motorizado llegue a la puerta correcta antes de que las bebidas se enfrien o se baje la crema.
- Prioridad: Alta.
- Estado: CONFIRMADO en el codigo de Admin.dc.html.

### 2.5. Llamar o escribir al cliente

- Hallazgo y ubicacion:
  En fuente/Admin.dc.html (seccion Repartos, linea de datos del cliente).
  En la tarjeta del pedido se muestra unicamente texto plano: '{{d.cliente}} · {{d.phone}}'.
  Deficiencias detectadas:
  1. El telefono no tiene enlace de llamada directa (falta la etiqueta 'a' con protocolo 'tel:').
  2. No existe boton de contacto por WhatsApp ('https://wa.me/51...').
  Curiosamente, en la vista Pedidos y caja para el rol Cajero/Call Center si existe la funcion 'pcWa' que abre WhatsApp con el mensaje prellenado del pedido. En cambio, al repartidor en la calle no se le proveyo ningun boton rapido para coordinar la llegada con el cliente.
- Por que importa para una cafeteria:
  Un repartidor en moto utiliza guantes y opera un telefono movil en la via publica. No puede memorizar ni tipear manualmente 9 digitos en el marcador telefonico ni agendar el numero en WhatsApp para avisar 'estoy abajo' o 'no encuentro la casa'. La ausencia de enlaces 'tel:' y 'wa.me' entorpece severamente la entrega.
- Prioridad: Alta.
- Estado: CONFIRMADO en el codigo de Admin.dc.html.

### 2.6. Ciclo de estados del pedido (casos no contesta y no encontrado)

- Hallazgo y ubicacion:
  En fuente/Admin.dc.html (controlador 'deliveries', definicion de 'act' y constante 'STATUS').
  El ciclo de vida del reparto en el mockup es estrictamente lineal y unidireccional:
  - Estado 1: 'listo' (en cocina, disponible para tomar).
  - Estado 2: 'ruta' (accion 'Sali a entregar').
  - Estado 3: 'entregado' (accion 'Entregado al cliente').
  Deficiencia critica: No existen estados de excepcion o contingencia en el prototipo. No hay botones ni opciones para registrar:
  - Cliente no contesta.
  - Direccion no encontrada / inexistente.
  - Cliente rechaza el pedido en puerta.
  - Pedido reprogramado o devuelto a tienda.
  Tampoco se registra motivo de cancelacion en destino ni derivacion a merma de alimentos perecibles.
- Por que importa para una cafeteria:
  Los productos alimenticios de cafeteria (como postres decorados o frappes) no pueden regresar al refrigerador despues de 40 minutos en una mochila de moto; se convierten en merma inmediata. Si un cliente no contesta, el sistema debe registrar el incidente, alertar a caja/call center en tiempo real y definir si se autoriza el retorno a tienda o el descarte, imputando el costo a la cuenta adecuada.
- Prioridad: Alta.
- Estado: CONFIRMADO en el codigo de Admin.dc.html.

### 2.7. Cobro contra entrega y su impacto en el cierre de caja

- Hallazgo y ubicacion:
  En fuente/Admin.dc.html (funciones 'deliveries', 'setOrder', 'pcConfirm', y modulo 'cierre').
  Existe una severa desconexion conceptual y financiera entre el cobro en ruta y la caja del local:
  1. Si un pedido entra por delivery con pago en efectivo pendiente ('paid: false'), el repartidor ve en su tarjeta: 'Efectivo · cobrar'.
  2. Sin embargo, al llegar a la puerta del cliente y cobrar el dinero en efectivo, el repartidor presiona 'Entregado al cliente', lo cual ejecuta: 'setOrder(o.id, { status: "entregado" })'. Esta accion cambia el estado a entregado, pero DEJA LA PROPIEDAD 'paid' EN FALSE. El repartidor no tiene interfaz para registrar el cobro del dinero.
  3. En consecuencia, en el modulo Caja y Cierres ('cierre'), el pedido entregado continua computandose dentro de 'cjPend' ('pedidos sin cobrar o por confirmar'). Como el calculo de ventas e ingresos en efectivo del turno filtra unicamente 'orders.filter(o => o.paid)', el dinero recaudado por el motorizado NO ENTRA al efectivo esperado en caja ('cjEsp') ni a las ventas del dia.
  4. Por el contrario, en el flujo de 'Confirmar pedido y pago' en Caja (fuente/flujo-de-pedidos.md), si la operadora marca el pedido como Efectivo antes de enviarlo a cocina, el pedido pasa con 'paid: true', ingresando ficticiamente a la caja de la tienda ANTES de que el dinero haya sido recaudado en la calle. No existe ningun modulo de arqueo de repartidores, entrega de sobres de dinero ni liquidacion de cuenta de motorizados al terminar el turno.
- Por que importa para una cafeteria:
  Genera descuadres inevitables en el arqueo diario del cajero al cierre del turno nocturno (22:00 hrs). El cajero tendra un faltante de efectivo porque el dinero esta en el bolsillo del repartidor, o tendra un excedente no auditado. Para una cafeteria con multiples repartidores independientes o de turno, la falta de liquidacion de caja por repartidor representa un riesgo directo de fuga de dinero.
- Prioridad: Alta.
- Estado: CONFIRMADO en el codigo (Admin.dc.html) y en el flujo (flujo-de-pedidos.md).

### 2.8. Gestion de vuelto

- Hallazgo y ubicacion:
  En fuente/Admin.dc.html (controlador 'cbVals') frente a 'deliveries' en Repartos.
  En el modal de cobro de pedidos en mesa y mostrador ('cbVals'), el sistema si implementa calculo de vuelto ('hasVuelto', 'vueltoT: Vuelto: s/ XX.XX') ingresando el efectivo recibido.
  Sin embargo, en la vista del Repartidor ('repartos'), la tarjeta unicamente senala: 'Efectivo · cobrar' y el total del pedido (ejemplo: 's/ 30.00'). En ninguna parte se le indica al repartidor con que billete pagara el cliente (por ejemplo: 'Paga con billete de S/ 100') ni cuanto vuelto debe solicitar en caja antes de encender la moto.
- Por que importa para una cafeteria:
  Es una de las fricciones mas comunes en el reparto a domicilio: el repartidor llega a la puerta del cliente, este le entrega un billete de denominacion alta (S/ 50 o S/ 100), el motorizado no lleva cambio suficiente y debe buscar una bodega cercana, demorando la entrega y arruinando la temperatura del cafe o frappe.
- Prioridad: Alta.
- Estado: CONFIRMADO en el codigo de Admin.dc.html.

### 2.9. Propinas

- Hallazgo y ubicacion:
  En fuente/Admin.dc.html (tabla simulada de reportes), fuente/BRD.md (seccion de exclusiones) y referencia/consolidado-reunion.md.
  En el prototipo no existe ningun campo, boton o flujo operativo para registrar propinas de delivery. En el BRD.md se declaro explicitamente: "propina voluntaria: no fueron elegidos para la primera version; se confirman con el cliente". La unica mencion en todo el archivo Admin.dc.html es una fila estatica en los reportes que dice 'Ventas y propinas por mozo', sin funcionalidad real.
  En los documentos de restaurant.pe (referencia/informes.md), el software anterior si contaba con 'Propinas (Tips) por mozo y motorizado' y cuadre de propinas recaudadas por tarjeta vs efectivo.
- Por que importa para una cafeteria:
  Muchos clientes que pagan con billeteras digitales (Yape o Plin) o tarjeta desean incluir una propina voluntaria para el motorizado. Si el sistema no desglosa la propina de la venta bruta de la comida, la cafeteria termina asumiendo impuestos tributarios sobre un monto que corresponde legalmente al trabajador, o el negocio no tiene forma transparente de pagarle sus propinas al repartidor.
- Prioridad: Media.
- Estado: CONFIRMADO en el codigo y en el BRD.

### 2.10. Entrega con foto o firma (prueba de entrega)

- Hallazgo y ubicacion:
  En fuente/Admin.dc.html (controlador de accion 'd.act').
  Al marcar un pedido como 'Entregado al cliente', la plataforma se limita a abrir un modal basico de confirmacion con botones Si/No. No existe captura de fotografia del paquete entregado en puerta, ni captura de firma digital en pantalla tactil, ni ingreso de codigo PIN de seguridad de entrega (tipo aplicaciones de delivery modernas).
- Por que importa para una cafeteria:
  En entregas en condominios, edificios multifamiliares o recepciones de empresas en San Juan de Lurigancho, los paquetes suelen dejarse en recepcion o con el vigilante. Si el cliente final alega que el pedido no le llego o que llego destrozado, la cafeteria no tiene ninguna evidencia grafica para deslindar responsabilidad entre el personal de porteria y el motorizado.
- Prioridad: Media.
- Estado: CONFIRMADO en el codigo de Admin.dc.html.

### 2.11. Gestion de varios pedidos a la vez (despacho agrupado)

- Hallazgo y ubicacion:
  En fuente/Admin.dc.html (filtro 'dels' y accion 'claim').
  El repartidor tiene la posibilidad de reclamar varios pedidos en la vista Repartos; estos se iran acumulando bajo su identificador. No existe restriccion de cantidad maxima de pedidos tomados por un motorizado.
  Deficiencias detectadas:
  1. Cada pedido funciona como una isla independiente. No existe un concepto de 'Ruta de reparto' o 'Lote de despacho'.
  2. Para marcar que inicio el viaje, el repartidor debe ingresar a cada tarjeta por separado y pulsar 'Sali a entregar' una por una.
  3. No existe un orden sugerido de entrega segun cercania geografica ni agrupamiento por urbanizaciones (por ejemplo, agrupar pedidos de Campoy frente a pedidos de Mangomarca o Zarate).
- Por que importa para una cafeteria:
  Una cafeteria no envia un motorizado por cada ticket individual en hora punta; un motorizado suele salir con 2 o 3 pedidos a la vez hacia la misma zona. Si no hay agrupamiento por ruta, se incrementa el riesgo de entregar pedidos cambiados o recorrer distancias ineficientes que enfríen los pedidos.
- Prioridad: Media.
- Estado: CONFIRMADO en el codigo de Admin.dc.html.

### 2.12. Pedidos del dia y ganancias del repartidor

- Hallazgo y ubicacion:
  En fuente/Admin.dc.html (vista Escritorio, KPIs del repartidor).
  El Escritorio del repartidor contabiliza la cantidad de pedidos: 'Entregados hoy: X'. Sin embargo, NO muestra ninguna metrica economica para el motorizado:
  - Cero registro de ganancias acumuladas por fletes o carreras.
  - Cero calculo de tarifa por envio devengada (por ejemplo S/ 3.00 o S/ 5.00 por entrega realizada).
  - Cero consolidado de cuanto dinero en efectivo tiene en su bolsillo pendiente de rendir a caja.
  - Cero historial de turnos pasados.
- Por que importa para una cafeteria:
  En el acta 02 (01:16:53 y 01:17:30), Kevin Rosales detalla que los repartidores tienen dinamicas particulares: uno de ellos apoya ademas en el almacen y otro viene unicamente una vez por semana. Para liquidar la compensacion de los motorizados que cobran por envio realizado o por jornada, tanto el administrador como el propio repartidor necesitan ver al final del dia el monto exacto acumulado por sus repartos.
- Prioridad: Alta.
- Estado: CONFIRMADO en el codigo de Admin.dc.html y en el acta 02.

### 2.13. Zonas y tarifas en el mockup

- Hallazgo y ubicacion:
  En fuente/Admin.dc.html (categoria 'entrega' de 'mirest') y fuente/Main.dc.html (constante 'SHIPS').
  En el panel administrativo (Admin.dc.html), dentro del modulo de Configuracion del Local ('mirest' -> pestana 'Entrega'), solo existen dos campos de texto libre:
  1. 'envioGratis': configurado por defecto en '70' (S/ 70.00).
  2. 'pedidoMin': configurado por defecto en '14.50' (S/ 14.50).
  No existe ninguna configuracion de zonas geograficas, no hay tarifas por sector, ni tablas de costos por kilometraje.
  Por su parte, en la carta digital del cliente (Main.dc.html), el costo de envio se resuelve mediante tres botones fijos con etiquetas manuales:
  - 'Hasta 1 km · s/ 3.00' (r1)
  - '1 a 3 km · s/ 5.00' (r3)
  - '3 a 5 km · s/ 8.00' (r5)
  Ademas, el propio boton exhibe el texto 'ejemplo, por confirmar'. El cliente es quien debe auto-declarar a que distancia se encuentra pulsando un chip, lo que carece de precision y control.
- Por que importa para una cafeteria:
  Permitir que el cliente elija libremente su tarifa de delivery genera que personas que viven a 4 kilometros marquen 'Hasta 1 km' para pagar S/ 3.00 en vez de S/ 8.00, provocando perdidas operativas que el motorizado o la cafeteria deben asumir.
- Prioridad: Alta.
- Estado: CONFIRMADO en el codigo de Admin.dc.html y Main.dc.html.

---

## 3. COMPARATIVA TECNICA CON LA LOGICA REAL DEL BOT EN BOT/

El codigo real del chatbot que el cliente facilito en la carpeta bot/ cuenta con una arquitectura de calculo de delivery completamente estructurada y funcional. A continuacion se detallan los hallazgos especificos de dicha implementacion frente a las carencias del mockup:

### 3.1. Poligonos GeoJSON y cobertura territorial real

- Implementacion en el bot:
  En bot/LIMITES_DELIVERY.geojson y bot/js/zones.js.
  El bot cuenta con un archivo GeoJSON real que delimita la geografia de reparto de Caprichos mediante 6 objetos espaciales (poligonos) con coordenadas de alta precision centradas en San Juan de Lurigancho (Campoy, Mangomarca, Zarate y alrededores).
  Las zonas oficiales definidas son:
  1. Zona Z2 (Tarifa Reducida): Costo S/ 2.00. Identificada con color verde (#10b981). Representa el area inmediata y contigua a la cafeteria en Campoy.
  2. Zona Z3 (Tarifa Estandar y Sector Este): Costo S/ 3.00. Dividida en 2 poligonos (central y este), color celeste (#0ea5e9). Es la zona de reparto habitual de la tienda.
  3. Zona Z4: Costo S/ 4.00. Color indigo (#6366f1). Abarca sectores contiguos de mayor distancia.
  4. Zona Z5: Costo S/ 5.00. Color ambar (#f59e0b). Cubre areas extendidas del distrito.
  5. Zona Z7 (Sector Extendido): Costo S/ 7.00. Color rojo (#f43f5e). Representa el limite maximo de cobertura directa hacia avenidas troncales lejanas.
- Ausencia en el mockup:
  El mockup administrativo (Admin.dc.html) desconoce por completo la existencia de las zonas Z2, Z3, Z4, Z5 y Z7. No tiene guardado este archivo GeoJSON, no visualiza los poligonos en ningun mapa y no almacena en los pedidos a que zona pertenece cada entrega.

### 3.2. Algoritmo de calculo geoespacial por coordenadas

- Implementacion en el bot:
  En bot/geo_utils.py (funcion 'calculate_delivery_cost') y bot/js/zones.js (funciones 'isPointInPolygon' y 'evaluateDeliveryLocation').
  El backend utiliza la libreria matematica Shapely en Python y el algoritmo de Ray-Casting (trazado de rayos) en JavaScript:
  - 'calculate_delivery_cost(lat, lon)': Crea un objeto 'Point(lon, lat)', recorre los poligonos de LIMITES_DELIVERY.geojson mediante 'polygon.contains(punto)' e inspecciona las propiedades ('zona', 'costo', 'precio'). Si el punto cae dentro de Z2 devuelve 2, en Z3 devuelve 3, en Z4 devuelve 4, en Z5 devuelve 5 y en Z7 devuelve 7. Si no cae dentro de ninguno, retorna -1 (fuera de cobertura).
  - En bot_wa.py (recepcion de mensajes tipo 'location' y enlaces de Google Maps en texto): Cuando el cliente comparte su ubicacion nativa por WhatsApp o un enlace de Google Maps ('https://www.google.com/maps?q=lat,lon'), el servidor extrae las coordenadas decimales, invoca a 'calculate_delivery_cost' y valida la cobertura automaticamente en milisegundos.
- Ausencia en el mockup:
  En el prototipo (Admin.dc.html y Main.dc.html) no se ejecuta ningun calculo de punto en poligono. En Main.dc.html, cuando el usuario presiona 'Usar mi ubicacion actual', el navegador solo escribe la coordenada como texto en el campo de direccion ('Mi ubicacion actual (-12.01, -76.96)'), pero no ejecuta ninguna evaluacion de zonas ni fija el precio adecuado.

### 3.3. Regla de negocio: Delivery gratuito por monto de compra

- Implementacion en el bot:
  En bot/bot_wa.py (bloque de calculo en la herramienta de cotizacion y evaluacion GPS) y bot/prompt.py (Fase 2 de atencion).
  En bot_wa.py existe la regla matematica explicita:
  Si la suma del subtotal de productos de la orden supera los 70 soles ('subtotal_productos > 70'), el costo de delivery se exonera automaticamente a S/ 0.00:
  'Delivery = S/ 0.00 (GRATIS por compra mayor a S/ 70)'.
  Esta logica esta blindada mediante una herramienta de codigo ('calcular_total_pedido') para que el modelo de lenguaje no cometa errores de calculo aritmetico.
- Situacion en el mockup:
  El mockup administrativo guarda en 'INFO.envioGratis' el valor 70 y la carta web (Main.dc.html) muestra la nota 'Envio gratis desde s/ 70.00'. Esto coincide con el bot. No obstante, en la carta web el cliente primero debe seleccionar un chip de distancia arbitrario (3, 5 u 8 soles) para que luego el carrito le reste el envio, lo cual resulta confuso si ya supero el monto minimo.

### 3.4. Tarifas especiales y descuentos silenciosos por cliente

- Implementacion en el bot:
  En bot/client_db.py (funcion 'get_client_delivery_cost') y bot/AGENTS.md (regla 14 de negocio).
  El bot cuenta con un sistema de fidelizacion y tarifas preferenciales almacenado en 'clientes.json'. Al evaluar la ubicacion de un cliente frecuente por su numero de telefono:
  - Si el cliente tiene configurado 'costo_delivery_fijo', el sistema sobreescribe el costo estandar y le cobra ese monto plano (por ejemplo S/ 2.50), sin importar la zona en la que viva.
  - Si tiene 'descuento_delivery', aplica un descuento porcentual (ejemplo 0.50 para cobrar el 50%).
  - Regla 14 de AGENTS.md: Se exige que la presentacion de este beneficio sea 'silenciosa y transparente', es decir, se le cotiza el precio especial de forma natural sin enviar mensajes publicitarios ni codigos de cupon redundantes.
- Ausencia en el mockup:
  En Admin.dc.html no existe ninguna vinculacion entre la base de datos de Clientes y las tarifas de envio. En el modulo de Clientes del mockup se guardan datos personales y tarjetas de credito corporativas, pero no hay campos para 'costo_delivery_fijo' ni 'descuento_delivery'.

### 3.5. Reutilizacion obligatoria de direccion guardada

- Implementacion en el bot:
  En bot/prompt.py (regla de reutilizacion de ubicacion guardada) y bot/client_db.py (campo 'ultima_ubicacion').
  Si el cliente ya compro anteriormente, el bot tiene TERMINANTEMENTE PROHIBIDO volver a pedirle que comparta su GPS. En su lugar, el bot recupera la ubicacion y le pregunta: 'Veo que tenemos guardada tu ubicacion anterior: [referencia]. ¿Confirmas si lo enviamos a esta misma ubicacion o a una nueva direccion?'.
- Situacion en el mockup:
  En Main.dc.html hay una simulacion basica de este comportamiento con dos variables cableadas en el codigo ('MEM_PHONE = 966555444' y 'MEM_ADDR = Calle 11 N.º 220, Campoy'). Si el usuario ingresa ese telefono exacto, le muestra el mensaje 'Encontramos tu direccion guardada: Calle 11 N.º 220, Campoy. ¿Es esta tu ubicacion?'. Sin embargo, en Admin.dc.html esta memoria no existe ni se almacena para pedidos tomados por Call Center o mostrador.

### 3.6. Restriccion de pedido minimo de delivery

- Implementacion en el bot:
  En bot/prompt.py (Fase 2) y bot/AGENTS.md.
  Para que un pedido califique a delivery, el consumo minimo en productos debe ser de al menos S/ 14.50. Si no alcanza este monto, el bot no permite continuar el delivery e invita a agregar mas productos o cambiar a 'Recojo en Tienda'.
- Situacion en el mockup:
  En Main.dc.html y Admin.dc.html existe el parametro 'pedidoMin: 14.50' y la carta digital bloquea el paso al checkout mostrando el mensaje 'Faltan s/ X.XX para el pedido minimo de delivery (s/ 14.50)'. Esto coincide plenamente con la regla de negocio del bot.

---

## 4. MATRIZ CONSOLIDADA DE BRECHAS

A continuacion se presenta la matriz comparativa entre lo que opera el bot real (y las necesidades expresadas en reuniones) frente a lo construido en el mockup administrativo y la carta:

| Caracteristica / Requerimiento | Logica Real (bot/ o Actas) | Estado en el Mockup (fuente/) | Impacto Operativo para la Cafeteria | Prioridad | Confirmacion |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Delimitacion de Zonas | GeoJSON con 5 tarifas: Z2 (S/2), Z3 (S/3), Z4 (S/4), Z5 (S/5), Z7 (S/7). | No existe. Solo hay 3 rangos manuales de km en la carta web. | Cobros arbitrarios o incorrectos que no cubren el costo del combustible. | Alta | CONFIRMADO en codigo |
| Calculo de Tarifa por GPS | Algoritmo Ray-Casting y Shapely sobre coordenadas nativas. | No existe. El cliente marca chips a mano o escribe texto. | Friccion con el cliente y riesgo de fraude al elegir tarifas mas bajas. | Alta | CONFIRMADO en codigo |
| Delivery Gratis por Monto | Automatico en subtotal productos > S/ 70. | Existe campo S/ 70, pero condicionado a eleccion manual previa. | Consistencia en la politica comercial de promocion. | Media | CONFIRMADO en codigo |
| Tarifas VIP / Especiales | 'costo_delivery_fijo' y 'descuento_delivery' en clientes.json. | No existe asociacion entre clientes y tarifas de delivery. | Imposibilidad de otorgar beneficios pactados a clientes frecuentes. | Media | CONFIRMADO en codigo |
| Reclamar Pedido (Claim) | Despacho en tienda manual / notificaciones WhatsApp a cocina. | Implementado con gestion de carrera ('claim' y 'race'). | Excelente alineacion funcional para evitar duplicidad de salidas. | Alta | CONFIRMADO en codigo |
| Enlaces a Waze y Google Maps | WhatsApp recibe enlaces directos por coordenadas lat/lon. | Implementado, pero busca texto concatenado con 'Lima Peru'. | El repartidor puede ser enviado a calles homonimas en otros distritos. | Alta | CONFIRMADO en codigo |
| Comunicacion con Cliente | Flujo directo de chat en WhatsApp con el asesor. | En Repartos solo hay texto plano; no hay enlace 'tel:' ni 'wa.me'. | Demoras criticas del motorizado en la puerta del cliente. | Alta | CONFIRMADO en codigo |
| Gestion de Estados | Flujo guiado por el personal de cocina/caja. | Solo lineal: listo -> ruta -> entregado. Sin estados de fallo. | Perdida de trazabilidad de mermas si el cliente no contesta. | Alta | CONFIRMADO en codigo |
| Liquidacion y Cierre de Caja | Cuadre de caja fisico contra comprobantes y efectivo diario. | Desconexion total: marcar 'entregado' no cobra el dinero en caja. | Descuadres graves en el arqueo del turno nocturno. | Alta | CONFIRMADO en codigo |
| Notificacion de Vuelto | Bot detecta 'cancelo con [monto]' y registra necesidad de sencillo. | No se muestra al repartidor con que billete pagara el cliente. | Motorizado sin cambio suficiente en la puerta del cliente. | Alta | CONFIRMADO en codigo |
| Control de Propinas | Restaurant.pe poseia reportes de propinas de motorizados. | Descartado en BRD; sin interfaz en Admin.dc.html. | Desmotivacion del personal y desorden contable en pagos mixtos. | Media | CONFIRMADO en codigo y acta |
| Prueba de Entrega | No implementado en el bot. | Solo confirmacion Sí/No sin fotografia ni firma. | Indefension de la cafeteria ante quejas por entregas en recepcion. | Media | CONFIRMADO en codigo |
| Despacho Multipedido | Salidas agrupadas segun criterio operativo del turno. | Sin agrupacion por rutas, lotes ni orden de paradas. | Desorden en horas punta y riesgo de enfriamiento de productos. | Media | CONFIRMADO en codigo |
| Ganancias del Repartidor | Kevin Rosales indico pagos semanales y turnos diferenciados. | No calcula fletes ganados ni comisiones acumuladas. | El administrador debe llevar cuentas en papel o Excel externo. | Alta | CONFIRMADO en acta y codigo |

---

## 5. RECOMENDACIONES DE DISENO Y ARQUITECTURA PARA EL MOCKUP

Para que el prototipo refleje fielmente la operativa de Caprichos y sirva como una herramienta eficiente para el motorizado, se recomienda implementar las siguientes mejoras en la siguiente iteracion:

1. Integracion del motor de zonas de bot/ en Admin.dc.html y Main.dc.html:
   Reemplazar los tres chips estaticos de kilometros en la carta web por la logica de 'bot/js/zones.js'. Cuando el cliente comparta su ubicacion o ingrese su direccion, el sistema debe evaluar contra el archivo LIMITES_DELIVERY.geojson e imprimir la zona correspondiente (Z2 a Z7) con su tarifa oficial automatica e inalterable.
2. Interfaz movil optimizada con botones de accion rapida:
   En la tarjeta de cada pedido para el repartidor, transformar el telefono del cliente en un enlace ejecutable 'tel:{{phone}}' y agregar un boton 'Escribir por WhatsApp' con enlace 'https://wa.me/51...'.
3. Correccion de enlaces de navegacion hacia coordenadas GPS:
   Modificar las funciones 'gmaps' y 'waze' para que utilicen coordenadas de latitud y longitud siempre que esten disponibles ('q=lat,lon') en lugar de depender exclusivamente de cadenas de texto imprecisas.
4. Flujo de cobranza y liquidacion de repartidores (Billetera del Motorizado):
   - Al marcar 'Entregado al cliente', si el pedido estaba pendiente de pago en efectivo, desplegar un modal que pregunte: '¿Cobraste los S/ XX.XX en efectivo?'.
   - Crear una cuenta transitoria 'Efectivo en poder de repartidores'.
   - En el modulo de Caja y Cierres ('cierre'), anadir una sub-pestana 'Liquidacion de repartidores' donde el cajero reciba el sobre de dinero de cada motorizado, marque los pedidos como liquidados y traspase el efectivo a la caja general.
5. Visualizacion de vuelto requerido:
   Si el pedido fue confirmado para pago en efectivo, mostrar de forma destacada en la tarjeta del repartidor: 'Llevar vuelto para: S/ [Monto]', dato capturado desde la carta web o por la operadora.
6. Incorporacion de estados de contingencia:
   Agregar en la tarjeta de Repartos los botones de excepcion: 'Cliente no contesta' y 'Direccion no encontrada', los cuales deben emitir una notificacion prioritaria al escritorio del Cajero y Call Center para apoyo inmediato antes de ordenar el retorno a tienda.
7. Modulo de fletes y ganancias por repartidor:
   En el Escritorio del repartidor, incluir una tarjeta que indique: 'Ganancias por reparto hoy: S/ [Total Fletes]', permitiendo al repartidor y al administrador validar la liquidacion de sus carreras diarias.

---

INFORME LISTO

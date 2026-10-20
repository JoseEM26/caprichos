---
id: ANA-CAP-053
tipo: analisis
titulo: "INFORME DE AUDITORIA Y CONTRATE TECNICO: CHATBOT SIMULADOR VS. ADMIN, MAIN Y BOT REAL"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, revision-cruzada-informes]
---

# INFORME DE AUDITORIA Y CONTRATE TECNICO: CHATBOT SIMULADOR VS. ADMIN, MAIN Y BOT REAL

---

## 1. RESUMEN EJECUTIVO Y ALCANCE

El presente informe técnico evalúa de forma exhaustiva el simulador del chatbot conversacional (`fuente/Chatbot.dc.html`) frente a la carta web del cliente (`fuente/Main.dc.html`), el sistema administrativo (`fuente/Admin.dc.html`) y la implementación operativa del bot real alojada en el directorio `bot/` (`bot/prompt.py`, `bot/AGENTS.md`, `bot/bot_wa.py`, `bot/menu_dinamico.txt`, `bot/LIMITES_DELIVERY.geojson`, `bot/geo_utils.py` y `bot/client_db.py`).

El objetivo principal es auditar la coordinación entre todas las piezas, identificar discordancias críticas, huecos de cobertura operativa, datos fijos en código que deben ser configurables por el dueño del negocio (Kevin Rosales) sin recurrir a un programador, y definir la arquitectura de integración para que el bot real consuma dinámicamente la carta y las directrices del nuevo sistema administrativo.

Conforme a las reglas de auditoría del proyecto, el informe está redactado en español técnico formal, sin uso de emojis, separando hechos confirmados con citas textuales exactas frente a suposiciones analíticas, y concluyendo con la línea de cierre reglamentaria.

---

## 2. AUDITORIA DETALLADA DE LOS 10 PUNTOS CRITICOS

### 2.1. Carta y Precios que Usa el Simulador (¿Tiene Carta Propia de Ejemplo?)
- **Estado:** CONFIRMADO. El simulador tiene una carta propia de juguete/ejemplo, completamente aislada y cableada en código duro en JavaScript, desconectada tanto del sistema administrativo (`Admin.dc.html`) como de la carta web (`Main.dc.html`) y del bot en producción (`bot/menu_dinamico.txt`).
- **Evidencia en Simulador (`fuente/Chatbot.dc.html`):**
  Texto exacto:
  `const CATS = [`
  Contiene únicamente 4 categorías y 9 productos:
  1. Frappes: `FRAPPE OREO`, `FRAPPE MARACUYÁ`, `FRAPPE STRAWBERRY` (con variantes `BEB`: 12 oz a 14.5, 16 oz a 16.5, 21 oz a 17.5).
  2. Calientes: `MOCACCINO` (variantes `CAL`: 12, 13.5, 14.5) y `CAPUCCINO` (9.5, 11, 12).
  3. Waffles: `WAFFLE FRUTOS DEL BOSQUE` y `NUTEWAFFLE` (variantes `WAF`: 1/2 waffle a 15, completo a 21).
  4. Salados: `CAPRISABROSO` (Unidad a 33) y `CLUB SANDWICH` (4 cuartos a 27).
- **Contraste con Admin y Main:**
  En `Admin.dc.html` y `Main.dc.html`, el catálogo oficial `MCAT` incluye decenas de productos en múltiples categorías (Frappés, Calientes, Iced, Frozens, Waffles, Salados, Croissants artesanales, Donas artesanales, Postres y Combos completos). Además, Admin permite agregar productos (`prodExtra`), alterar el orden y ocultar ítems.
- **Contraste con Bot Real (`bot/menu_dinamico.txt`):**
  El bot real tiene 12 frappés diferentes, bebidas calientes clásicas y de especialidad (Americano, Choconube, Saltamel Brownie, Canelatte caramel), toda la línea Iced (Iced Coffee, Iced Latte, Iced Chocolate, Iced Berry), Frozens (Limonada, Maracuyá, Strawberry), amplia variedad de sándwiches y croissants, y 10 variedades de waffles (donde `NUTEWAFFLE` se llama `Nutella`).
- **Impacto:** Si el administrador cambia un precio o crea un nuevo producto en Admin, el simulador nunca se entera ni lo muestra. Asimismo, el simulador carece por completo de combos y postres, distorsionando la experiencia de prueba.

### 2.2. Horarios y Fuera de Horario
- **Estado:** CONFIRMADO. Hay discordancia funcional y de flujo.
- **Evidencia en Simulador (`fuente/Chatbot.dc.html`):**
  El simulador define:
  `const HORARIO = horarioOf(CINFO);`
  y consulta `statusNow(HORARIO, new Date())` exclusivamente para responder una de las preguntas predefinidas:
  `{ id: 'd3', n: '¿Hasta qué hora atienden?', a: 'Nuestro horario: ' + schedText(HORARIO) + '. Hoy: ' + statusNow(HORARIO, new Date()).text.toLowerCase() + '. El pedido lo hacemos por botones.' }`
  y para limitar los horarios del selector de reservas:
  `const HORAS = (() => { const e = entryOn(HORARIO, new Date()).e;`
  Sin embargo, dentro del flujo de toma de pedidos (`choose(opt)`), el simulador NO evalúa el horario en tiempo real: permite iniciar y completar pedidos a cualquier hora sin alertar si el local está cerrado.
- **Evidencia en Bot Real (`bot/bot_wa.py`, `bot/prompt.py` y `bot/AGENTS.md`):**
  En `bot/bot_wa.py`:
  `en_horario = 14 <= now.hour < 22`
  En `bot/AGENTS.md` (Regla 1) y `bot/prompt.py`:
  `Tienda/Recojo: 2:00 pm a 10:00 pm. Delivery recepción 24h, preparación 2:00 pm a 10:00 pm.`
  `Cero spam de horario: SOLO mencionar si el cliente pregunta explícitamente por él.`
  El bot real tiene una regla operativa estricta: recibe pedidos 24/7, pero si se confirma un pedido fuera del rango 14:00 - 22:00, le aclara al cliente que su despacho iniciará a las 2:00 PM. Además, en `bot_wa.py` el horario está fijado en código en Python (`14 <= now.hour < 22`) y no lee los horarios ni fechas especiales configuradas en Admin.

### 2.3. Pedido Mínimo
- **Estado:** CONFIRMADO. Hueco crítico en el simulador.
- **Evidencia en Simulador (`fuente/Chatbot.dc.html`):**
  El simulador NO contiene ninguna validación de pedido mínimo. En el cálculo de cierre (`step === 'more'`):
  `const sub = s.items.reduce((a, x) => a + x.price, 0);`
  `const fee = s.modal === 'delivery' && sub < 70 ? 3 : 0;`
  El cliente puede pedir una galleta de S/ 4.00 o un producto inferior a S/ 14.50 con delivery y el simulador procede a cerrar el pedido sin objeción.
- **Evidencia en Admin y Main (`fuente/Admin.dc.html` y `fuente/Main.dc.html`):**
  Admin define en `INFO_DEFAULT`:
  `pedidoMin: '14.50'`
  y Main valida en `cartLines`:
  `belowMin: belowMin, minText: 'Faltan ' + fmt(Number(INFO.pedidoMin) - t.sub) + ' para el pedido mínimo de delivery (' + fmt(Number(INFO.pedidoMin)) + ').'`
- **Evidencia en Bot Real (`bot/prompt.py`):**
  Línea de prompt:
  `- Valida el consumo mínimo en productos de S/ 14.50. (¡Recuerda que si el consumo en productos supera S/ 70.00, el delivery es **TOTALMENTE GRATIS (S/ 0.00)**!).`
- **Impacto:** El simulador no refleja la restricción de rentabilidad básica del negocio de cafetería, permitiendo simular ventas delivery inviables.

### 2.4. Envío por Zonas y Cobertura Geográfica
- **Estado:** CONFIRMADO. Discordancia y hueco severo.
- **Evidencia en Simulador (`fuente/Chatbot.dc.html`):**
  El simulador ignora las zonas de reparto. Cobra una tarifa plana fija de S/ 3.00:
  `const fee = s.modal === 'delivery' && sub < 70 ? 3 : 0;`
  En la captura de ubicación (`getPos`):
  `getPos((g) => this.setState({ msgs: this.say(this.state.msgs, 'bot', geoOkText(g) + ' ' + mapsOf(g) + '\nElige una categoría.'), step: 'cat' })`
  El simulador obtiene `lat` y `lng` del navegador pero NO las evalúa contra ningún polígono, ni calcula zonas, ni detecta si la dirección está fuera de cobertura.
  Peor aún: ofrece un botón para tipear dirección:
  `options = [ { n: 'Compartir mi ubicación', say: 'Comparto mi ubicación actual', id: 'share' }, { n: 'Escribir mi dirección', say: 'Prefiero escribir mi dirección', id: 'type' } ];`
  y si el usuario elige escribir su dirección, responde:
  `if (opt.id === 'type') { done({ msgs: bot('Listo. Una persona del equipo te pedirá la dirección al confirmar el pedido. Elige una categoría.'), step: 'cat' }); }`
- **Evidencia en Bot Real (`bot/geo_utils.py` y `bot/bot_wa.py`):**
  En `bot/geo_utils.py`:
  `calculate_delivery_cost(lat, lon, filepath="LIMITES_DELIVERY.geojson")`
  Cruza coordenadas exactas contra polígonos GeoJSON con tarifas escalonadas (Z2 = S/ 2, Z3 = S/ 3, Z4 = S/ 4, Z5 = S/ 5, Z7 = S/ 7) y devuelve `-1` si está fuera de cobertura.
  En `bot/bot_wa.py`:
  `UBICACIÓN GPS RECIBIDA: El sistema de mapas calculó que la ubicación del cliente ESTÁ FUERA DE LA ZONA DE REPARTO (sin cobertura).`
  Y sobre escribir la dirección en texto, el bot real aplica la regla opuesta:
  `REGLA DE UBICACIÓN POR TEXTO: El cliente intentó enviar su dirección escrita en texto. NO ACEPTES ESTA DIRECCIÓN ESCRITA EN TEXTO.`
- **Evidencia en Admin (`fuente/Admin.dc.html`):**
  Admin soporta polígonos GeoJSON (`ZONAS_GEO`), tarifas `tarZ2` a `tarZ7`, y detecta `moZid === 'FUERA'`. El simulador está completamente desalineado.

### 2.5. Medios de Pago
- **Estado:** CONFIRMADO. Discordancia y omisión de canales clave.
- **Evidencia en Simulador (`fuente/Chatbot.dc.html`):**
  Las opciones de pago ofrecidas son únicamente:
  `options = [ { n: 'Efectivo', id: 'efectivo' }, { n: 'Yape', id: 'yape' }, { n: 'Plin', id: 'plin' } ];`
  OMITE por completo Tarjeta con POS y Transferencia bancaria (BCP / Interbank).
  Además, al elegir Yape o Plin, dice:
  `'Anotado: ' + opt.n + '. Todavía no pagues: una persona del equipo te dirá por aquí cómo hacerlo y lo confirma contigo.'`
  No muestra el número telefónico de Yape/Plin ni el nombre del titular configurados en el sistema.
- **Evidencia en Bot Real (`bot/prompt.py`):**
  El bot real entrega de inmediato las cuentas:
  ` Yape y Plin: 9XX XXX XXX\n A nombre de: María José Morillo Ruiz\n BCP: 19197148281074 (CCI: 00219119714828107455)\n Interbank: 0913227414217 (CCI: 00309101322741421764)`
  Y soporta explícitamente tarjeta:
  `Informa que el pago con tarjeta se realiza **Contra Entrega con POS inalámbrico ** al momento de recibir o recoger su pedido.`
- **Evidencia en Admin (`fuente/Admin.dc.html`):**
  Admin maneja Efectivo, Yape, Plin, Transferencia y Tarjeta POS en Caja.

### 2.6. Textos de Confirmación, Comprobantes y Tiempos de Entrega
- **Estado:** CONFIRMADO. Contradicción directa flagrante.
- **Evidencia en Simulador (`fuente/Chatbot.dc.html`):**
  Al terminar el pedido en el simulador:
  `Listo. Recibimos tu pedido ' + this.state.code + '. Una persona del equipo te escribe por este mismo chat para confirmarlo y ver el pago contigo. Recién entonces pasa a cocina. No hace falta que envíes capturas de pago.`
  El texto afirma categóricamente: *"No hace falta que envíes capturas de pago"*.
- **Evidencia en Bot Real (`bot/prompt.py` y `bot/AGENTS.md`):**
  En `bot/prompt.py`:
  `Por favor, envíanos la captura o foto de tu comprobante de pago por aquí para validar tu orden .`
  `¡Recibí tu comprobante!  En un breve momento un asesor lo validará para preparar tu orden `
  En `bot/AGENTS.md` (Regla 3):
  `Al pulsar 'Rechazar', le solicita amablemente al cliente el comprobante correcto.`
  En la operación real, la captura del voucher es el insumo indispensable para que el cajero o cocina apruebe la comanda. La afirmación del simulador desentrena al personal y confunde las pruebas.
- **Tiempos de entrega:**
  En `fuente/Admin.dc.html`:
  `cvMin = 13 + (s.hd.on ? Number(s.hd.extra) || 0 : 0);`
  Admin promete entrega en 13 minutos (o 13 + extra).
  En `bot/bot_wa.py`:
  `return "50 - 60 mnts." if alta_demanda_mode else "30 - 45 mnts."`
  Prometer 13 minutos para un delivery en Lima es operativamente inviable y contradice la promesa real del bot de 30 a 45 minutos.

### 2.7. Alta Demanda y Pausa del Bot
- **Estado:** CONFIRMADO. Lógica divergente entre maquetas y bot real.
- **Evidencia en Simulador (`fuente/Chatbot.dc.html`):**
  Lee la configuración al cargar:
  `const hdCfg = () => { try { const raw = window.localStorage.getItem('caprichos_carta_cfg_v1'); const c = raw ? JSON.parse(raw) : null; return (c && c.altaDem && c.altaDem.on) ? c.altaDem : null; } catch (err) { return null; } };`
  En el saludo inicial agrega:
  `HELLO + (h ? '\n\nHoy tenemos muchos pedidos: la entrega está tardando unos ' + (13 + (Number(h.extra) || 10)) + ' minutos.' + (h.pause ? ' Por ahora un asesor te atiende por WhatsApp.' : '') : '')`
  Y tiene un botón en controles para simular alta demanda que fija 35 minutos:
  `if (s.demand) { bot('Hoy tenemos alta demanda: la entrega puede tardar unos 35 minutos'); }`
- **Evidencia en Admin (`fuente/Admin.dc.html`):**
  La pantalla de Cocina (`isCocina`) tiene chips para sumar +5, +10, +15, +20 minutos sobre la base de 13 minutos y un selector para pausar el bot globalmente (`hdPauseChips`).
- **Evidencia en Bot Real (`bot/bot_wa.py`):**
  El bot real tiene un switch booleano `alta_demanda_mode` operado desde `/api/dashboard/toggle-alta-demanda`. Al activarse, inyecta al prompt:
  `MODO ALTA DEMANDA ACTIVO : Si el cliente consulta sobre el tiempo de entrega o llegada del pedido, informa que el tiempo estimado actualmente es de 50 a 60 minutos debido a la alta demanda de delivery.`
  El bot real NO se pausa automáticamente al entrar en alta demanda (continúa tomando pedidos informando el tiempo mayor); la pausa en el bot real es selectiva por chat (`toggle-pause`).

### 2.8. Handoff a Persona Humana y Escalado
- **Estado:** CONFIRMADO. Flujo cerrado en simulador frente a cola activa en bot real.
- **Evidencia en Simulador (`fuente/Chatbot.dc.html`):**
  Al pulsar "Hablar con una persona" o derivar:
  `const SYS = 'SE REQUIERE ATENCIÓN · pasó a una persona';`
  `const HUMAN = 'Te paso con alguien del equipo. Ya les avisé con tu nombre y tu número; en unos minutos te escriben.';`
  El simulador imprime el texto, muestra la píldora amarilla de sistema y solo ofrece un botón: `"Volver al menú"` (`options = [ { n: 'Volver al menú', id: 'menu' } ]`). Es un callejón sin salida interactivo.
- **Evidencia en Bot Real (`bot/bot_wa.py`):**
  El bot real gestiona una estructura `requires_worker_chats = {}` con motivos concretos (`derivar_reserva_promo_amarilla`, recepción de comprobante, solicitud expresa o pack amarillo). En el panel web `/admin`, esto genera:
  1. Resaltado con borde amarillo pulsante (`chat-item requires-worker`).
  2. Banner superior con botón `"Resolver Atención"` (`/api/dashboard/resolve-worker`).
  3. Pausa del bot en ese hilo para permitir que el operador humano tome el control sin que la IA interfiera.
  4. Despausado automático a medianoche mediante `midnight_auto_resume_task()`.

### 2.9. Mensajes de Posventa
- **Estado:** CONFIRMADO. Escenario huérfano en simulador, inexistente en bot real y en Admin.
- **Evidencia en Simulador (`fuente/Chatbot.dc.html`):**
  Posee un botón de control simulado:
  `Object.assign({ n: 'Pasaron 2 horas', pick: () => this.scenario('post', 'Hola, ¿tu pedido llegó bien y en orden? Cuéntanos cómo te fue') })`
  Y si el cliente responde "Excelente":
  `if (opt.id === 'buena') { done({ msgs: bot('¡Qué alegría! ¿Nos dejas tu opinión en Google Maps? Copia y pega lo que nos escribiste en este enlace y obtén 25 % de descuento en tu próximo pedido: [enlace a Google Maps]'), step: 'end' }); }`
  Si responde "Regular" o "Mal":
  `else { done({ msgs: this.say(bot('Lamentamos eso. Te paso con alguien del equipo para ayudarte'), 'sys', SYS), step: 'human' }); }`
- **Evidencia en Bot Real (`bot/bot_wa.py`):**
  No existe ninguna tarea programada (cron ni job en segundo plano) que envíe mensajes de seguimiento a las 2 horas de entregado el pedido, ni solicitud de reseña en Google Maps a cambio de un cupón de 25%.
- **Evidencia en Admin (`fuente/Admin.dc.html`):**
  No existe configuración ni módulo para automatizar encuestas de posventa ni emisión de cupones por reseñas. Es un requerimiento identificado en Acta 02 que quedó únicamente como botón cosmético en la maqueta.

### 2.10. Cuánto Lee el Simulador de la Configuración Compartida (`caprichos_carta_cfg_v1`)
- **Estado:** CONFIRMADO. Lectura mínima y selectiva.
- **Lo que SÍ lee el simulador:**
  1. `c.info.nombre` (para el título de la cabecera `{{botName}}`).
  2. `c.info.direccion`, `referencia`, `mapa`, `telefono` (para responder la duda predefinida "¿Dónde están ubicados?").
  3. `c.info.horario` (para responder la duda "¿Hasta qué hora atienden?" y calcular `HORAS` de reserva).
  4. `c.altaDem` (exclusivamente al inicio para el saludo de bienvenida si estaba activo en localStorage al abrir).
- **Lo que NO lee el simulador (e ignora por completo de `caprichos_carta_cfg_v1`):**
  1. Productos y categorías (`MCAT` y `prodExtra`): usa su propia constante `CATS` de 9 productos.
  2. Agotados de cocina (`c.agot` y `c.agotHoy`): ignora la cocina; tiene fijo `const AGOTADOS = [ 'FRAPPE STRAWBERRY' ];`.
  3. Modificadores y adicionales (`c.opciones`): ignora grupos y opciones configuradas; tiene fijos `LECHE`, `DULZOR`, `TOPS`, `ADIC`, `CREMAS`.
  4. Combos y promociones (`c.promosAll`): ignora combos; no ofrece ninguno.
  5. Tarifa de delivery y envío gratis (`c.info.envioGratis`, `c.info.pedidoMin`, `tarZ2` a `tarZ7`): tiene fijos S/ 70 y S/ 3.
  6. Datos bancarios (`c.info.yape`, `c.info.plin`, `c.info.cuenta`): no muestra los números al elegir medio de pago.

---

## 3. REGLAS DEL BOT REAL AUSENTES EN EL SIMULADOR Y EN EL ADMIN

Las siguientes reglas y mecanismos de negocio, activos en el código de producción del bot (`bot/`), no existen en el simulador (`Chatbot.dc.html`) ni en el sistema administrativo (`Admin.dc.html`):

1. **Ventana de Debounce de 10 a 12 Segundos:**
   - Ubicación en bot: `bot/bot_wa.py` (`process_debounced_messages_wa` y `add_to_user_buffer_wa`).
   - Descripción: El bot acumula mensajes consecutivos que el cliente envía fragmentados antes de llamar a OpenAI, evitando respuestas cortadas y costos duplicados. Ausente en simulador y Admin.
2. **Interpretación Peruana: "Cancelar" = Pagar en Efectivo:**
   - Ubicación en bot: `bot/prompt.py` (Regla Fundamental 1) y `bot/bot_wa.py`.
   - Descripción: Si el cliente escribe "cancelo con 100", el sistema procesa pago en efectivo y vuelto de S/ 100. Prohíbe terminantemente interpretar la palabra como anulación del pedido. En Admin y simulador no existe tratamiento para esta ambigüedad lingüística.
3. **Interpretación de "Extra" como Tamaño 21 oz:**
   - Ubicación en bot: `bot/prompt.py` (Regla Fundamental 2).
   - Descripción: Si el cliente dice "¿cuál es el extra?" o "quiero extra", se asocia al vaso de 21 oz o modificador, no a un problema ni queja.
4. **Rechazo Estricto de Direcciones por Texto Escrito:**
   - Ubicación en bot: `bot/bot_wa.py` (`REGLA DE UBICACIÓN POR TEXTO`).
   - Descripción: El bot prohíbe aceptar direcciones tiroteadas en texto libre por inexactitud en Lima y exige ubicación GPS nativa vía WhatsApp. El simulador hace lo contrario ("Prefiero escribir mi dirección").
5. **Cálculo Geoespacial con Polígonos GeoJSON y Descarte por "Fuera de Cobertura":**
   - Ubicación en bot: `bot/geo_utils.py` y `bot/LIMITES_DELIVERY.geojson`.
   - Descripción: Determina pertenencia a zonas Z2 a Z7 o devuelve `-1` para invitar a "Recojo en Tienda". El simulador cobra S/ 3 ciegamente.
6. **Reutilización de GPS Histórico de Clientes Registrados:**
   - Ubicación en bot: `bot/prompt.py` (Fase 2) y `bot/client_db.py`.
   - Descripción: Si el cliente ya pidió antes, el bot rescata su coordenada y le pide confirmar si se envía al mismo punto sin pedir GPS de nuevo.
7. **Tarifas Especiales Silenciosas por Cliente:**
   - Ubicación en bot: `bot/AGENTS.md` (Regla 14) y `bot/client_db.py` (`get_client_delivery_cost`).
   - Descripción: Permite fijar costos preferenciales de delivery a clientes específicos sin publicitar descuentos.
8. **Validación de Comprobantes de Pago (Vouchers con Imagen):**
   - Ubicación en bot: `bot/prompt.py` (Fase 5) y `bot/bot_wa.py` (`is_photo`).
   - Descripción: Exige comprobante visual, lo descarga de Meta WhatsApp Cloud API y lo almacena para revisión del cajero.
9. **Pago con Tarjeta POS Contra Entrega:**
   - Ubicación en bot: `bot/prompt.py` (Fase 5).
   - Descripción: Acepta tarjeta inalámbrica contra entrega al repartidor. Ausente en opciones del simulador.
10. **Notificación de Comanda a Cocina con Botones Interactivos en WhatsApp:**
    - Ubicación en bot: `bot/bot_wa.py` (`send_admin_order_notification_with_buttons`).
    - Descripción: Envía el ticket al WhatsApp del administrador (`519XX XXX XXX`) con botones táctiles `[Aprobar]` y `[Rechazar]`.
11. **Asimilación Directa de Precio a Presentación:**
    - Ubicación en bot: `bot/prompt.py` (línea 25) y `bot/AGENTS.md` (Regla 11).
    - Descripción: Si el cliente contesta indicando el precio (ej. "14.50"), el bot infiere el tamaño Regular sin repetir la pregunta.
12. **Manejo Estricto de Fuera de Carta y Sustitución de Jugos Naturales:**
    - Ubicación en bot: `bot/AGENTS.md` (Regla 17).
    - Descripción: Prohíbe inventar productos e instruye explicar que no se venden jugos tradicionales, ofreciendo Frozens o Frappés de fruta.
13. **Reglas Complejas de Waffles, Toppings y Leches:**
    - Ubicación en bot: `bot/AGENTS.md` (Regla 5).
    - Descripción: Distingue cambios gratuitos (fruta por fruta, salsa por salsa, sin chantilly) de adicionales con costo (Chantilly S/ 2, Helado S/ 2.50, almendras S/ 2.50, topping extra S/ 1.00). En el simulador las opciones son rígidas y genéricas.
14. **Timeout de Sesión de 3 Horas y Reset Nocturno:**
    - Ubicación en bot: `bot/bot_wa.py` (`midnight_auto_resume_task`) y `bot/AGENTS.md` (Regla 4).
    - Descripción: Resetea carritos inactivos tras 3 horas y libera pausas a las 00:00 horas.
15. **Transcripción de Notas de Voz con Whisper:**
    - Ubicación en bot: `bot/bot_wa.py` (`transcribe_audio_bytes`).
    - Descripción: Procesa notas de voz de clientes convirtiéndolas a texto antes de enviarlas a OpenAI. En el simulador el micrófono es un adorno visual inerte.

---

## 4. DISCREPANCIAS ENTRE LA CONSOLA DE MENSAJES DE ADMIN Y EL COMPORTAMIENTO REAL DEL BOT

La pantalla "Mensajes de WhatsApp" (`isMensajes`) de `Admin.dc.html` presenta serias inconsistencias frente a lo que ejecuta el bot en producción (`bot/bot_wa.py`):

1. **Promesa de Tiempos de Entrega al Aprobar Pago:**
   - En Admin (`isMensajes`): Al presionar "Aprobar el pago" (`cvOk`), el sistema envía al cliente:
     `Pago verificado. Tu pedido ya entró a preparación y llega en unos ' + cvMin + ' minutos.`
     donde `cvMin` equivale a 13 minutos (o 13 + extra de alta demanda).
   - En el bot real: El tiempo estimado se calcula dinámicamente mediante `get_tiempo_estimado_str()`:
     `return "50 - 60 mnts." if alta_demanda_mode else "30 - 45 mnts."`
     El mensaje de Admin promete una entrega física en 13 minutos, provocando reclamos por expectativas irreales.
2. **Carencia de Visualización de Vouchers e Imágenes:**
   - En Admin: La consola solo renderiza texto plano (`cvMsgs`). No soporta previsualización de imágenes, comprobantes de pago ni fotos enviadas por los clientes.
   - En el bot real: El panel `/admin` tiene visor de imágenes, almacenamiento en disco (`uploads/`) y visualización de comprobantes para cotejo financiero.
3. **Respuestas Rápidas Incompletas y Desactualizadas:**
   - En Admin: La respuesta rápida `/pago` envía:
     `Puedes pagar con Yape o Plin al ' + String(s.info.yape || '').replace(' (ejemplo)', '') + ' y enviarnos el comprobante.`
     Omite las cuentas corrientes BCP e Interbank con código de cuenta interbancario (CCI) y el titular de la cuenta, datos que el bot real envía de forma obligatoria para transferencias.
4. **Ausencia de Generación y Copiado Estructurado de Resumen para POS:**
   - En Admin: Dispone de botones genéricos como `cvCopyProd` y `cvCopyTel`.
   - En el bot real: Cuenta con un modal dedicado (`btn-order-summary`) conectado al endpoint `/api/dashboard/order-summary/{phone}` que genera el resumen listo con sintaxis estandarizada para pegado inmediato en el sistema de ventas/POS.
5. **Divergencia en Filtros y Monitoreo en Vivo:**
   - En Admin: Presenta 4 chats estáticos de ejemplo en un arreglo en memoria sin buscador ni filtros.
   - En el bot real: El panel implementa pestañas activas para filtrar chats ("No leídos", "Requiere asesor", "Atendidos", "Pausados", "Hoy"), buscador predictivo por nombre/teléfono y alertas sonoras periódicas ante mensajes entrantes.

---

## 5. TABLA COMPARATIVA DE HALLAZGOS Y DISCORDANCIAS

| ID | Tipo | Dónde está cada lado (archivo y texto exacto) | Por qué importa | Prioridad | Propuesta de arreglo en una frase |
| :--- | :--- | :--- | :--- | :--- | :--- |
| D-01 | discordancia | `fuente/Chatbot.dc.html`: `const CATS = [` frente a `fuente/Admin.dc.html`: `const MCAT =` y `bot/menu_dinamico.txt` | El simulador utiliza una carta propia de 9 productos y no refleja los precios, categorías ni cambios realizados por el administrador. | Alta | Modificar el simulador para que consuma el catálogo y precios desde la configuración compartida `caprichos_carta_cfg_v1`. |
| D-02 | discordancia | `fuente/Chatbot.dc.html`: `No hace falta que envíes capturas de pago` frente a `bot/prompt.py`: `Por favor, envíanos la captura o foto de tu comprobante de pago` | Contradicción operativa total: el bot real y el cajero exigen el comprobante para aprobar el pedido, mientras el simulador le dice al cliente que no lo envíe. | Alta | Eliminar la frase del simulador y exigir el envío del comprobante de pago como en el bot real. |
| D-03 | discordancia | `fuente/Admin.dc.html`: `Pago verificado. Tu pedido ya entró a preparación y llega en unos ' + cvMin + ' minutos.` (base 13) frente a `bot/bot_wa.py`: `return "50 - 60 mnts." if alta_demanda_mode else "30 - 45 mnts."` | Prometer entrega en 13 minutos destruye la confianza del cliente, mientras que el bot real maneja entre 30 y 45 minutos estándar. | Alta | Alinear los tiempos del Admin con los rangos operativos reales de 30 a 45 minutos y 50 a 60 minutos en alta demanda. |
| D-04 | discordancia | `fuente/Chatbot.dc.html`: `options = [ { n: 'Compartir mi ubicación'... { n: 'Escribir mi dirección'...` frente a `bot/bot_wa.py`: `NO ACEPTES ESTA DIRECCIÓN ESCRITA EN TEXTO` | El bot real rechaza sistemáticamente direcciones escritas en texto para evitar fallas de entrega en Lima, mientras el simulador las acepta como opción válida. | Alta | Alinear el simulador para que exija coordenadas GPS obligatorias en delivery igual que el bot de producción. |
| D-05 | hueco | `fuente/Chatbot.dc.html`: `const fee = s.modal === 'delivery' && sub < 70 ? 3 : 0;` frente a `fuente/Admin.dc.html`: `pedidoMin: '14.50'` y `bot/prompt.py`: `Valida el consumo mínimo en productos de S/ 14.50` | El simulador no valida el consumo mínimo de S/ 14.50 y permite procesar pedidos delivery deficitarios. | Alta | Integrar la validación de `pedidoMin` en el flujo de cierre del pedido del simulador. |
| D-06 | hueco | `fuente/Chatbot.dc.html`: tarifa plana fija de S/ 3.00 frente a `fuente/Admin.dc.html`: `tarZ2` a `tarZ7` y `bot/LIMITES_DELIVERY.geojson` | El simulador no aplica tarifas por zonas ni detecta entregas fuera de cobertura, ignorando los polígonos GeoJSON. | Alta | Implementar en el simulador el cálculo de tarifa según las zonas configuradas en Admin o marcar fuera de cobertura. |
| D-07 | hueco | `fuente/Chatbot.dc.html`: `options = [ { n: 'Efectivo', id: 'efectivo' }, { n: 'Yape', id: 'yape' }, { n: 'Plin', id: 'plin' } ];` frente a `bot/prompt.py`: `Contra Entrega con POS inalámbrico` y `BCP` / `Interbank` | Omite pagos con tarjeta contra entrega y transferencias bancarias directas con CCI. | Media | Agregar Tarjeta con POS y Transferencia bancaria en las opciones de pago del simulador. |
| D-08 | fijo en codigo | `bot/bot_wa.py`: `en_horario = 14 <= now.hour < 22` frente a `fuente/Admin.dc.html`: `INFO_CATS` (`id: 'horario'`) | El bot real tiene el horario de cocina hardcodeado en Python y no se actualiza si el administrador cambia las horas en Admin. | Alta | Hacer que el bot consulte los horarios y feriados desde el endpoint de configuración centralizada. |
| D-09 | fijo en codigo | `fuente/Chatbot.dc.html`: `const AGOTADOS = [ 'FRAPPE STRAWBERRY' ];` frente a `fuente/Admin.dc.html`: `availPersist` (`c.agot` y `c.agotHoy`) | El simulador ignora los productos marcados como agotados por la cocina en el sistema administrativo. | Media | Conectar la lista de agotados del simulador con las claves `agot` y `agotHoy` de la configuración. |
| D-10 | fijo en codigo | `fuente/Chatbot.dc.html`: `LECHE`, `DULZOR`, `TOPS`, `ADIC`, `CREMAS` frente a `fuente/Admin.dc.html`: `opciones` (`opcLoad`) | Los grupos de modificadores y adicionales del simulador están fijos y no reflejan cambios de opciones hechos en Admin. | Media | Leer las opciones y recargos desde `opciones` en la configuración compartida. |
| D-11 | flujo | `fuente/Chatbot.dc.html`: `const SYS = 'SE REQUIERE ATENCIÓN · pasó a una persona';` frente a `bot/bot_wa.py`: `requires_worker_chats` y `/api/dashboard/resolve-worker` | En el simulador, solicitar atención humana lleva a un callejón sin salida ("Volver al menú"), sin registrar ticket ni pausar el bot para un operador. | Media | Simular en el chatbot la apertura de un ticket de atención humana y su reflejo en la consola de mensajes de Admin. |
| D-12 | hueco | `fuente/Chatbot.dc.html`: escenario `Pasaron 2 horas` y reseña en Google Maps frente a `bot/bot_wa.py` (ausente) y `fuente/Admin.dc.html` (ausente) | El flujo de posventa a las 2 horas no está implementado ni automatizado en el bot real ni configurado en Admin. | Baja | Implementar en el backend un job programado que dispare el mensaje de posventa 2 horas después de la entrega. |
| D-13 | discordancia | `fuente/Chatbot.dc.html`: `NUTEWAFFLE` frente a `bot/menu_dinamico.txt`: `Nutella` y `fuente/Admin.dc.html`: `WAFFLE DE NUTELLA` | Discrepancia en la nomenclatura del waffle más popular de la carta entre los tres sistemas. | Baja | Unificar el nombre del producto como Waffle Nutella en todos los módulos y documentos. |

---

## 6. PROPUESTA ARQUITECTURAL: LECTURA DINAMICA DEL BOT REAL SIN DEPENDER DEL PROGRAMADOR

Para cumplir el objetivo del negocio de que **nada dependa del programador** y todo cambio realizado en el sistema administrativo se refleje automáticamente en el bot de WhatsApp, se propone la siguiente arquitectura desacoplada:

```
+-------------------------------------------------------------------------+
|                       ADMINISTRATIVO (Admin)                            |
|  - Productos y Precios (MCAT / prodExtra)                               |
|  - Insumos y Agotados por hoy (Cocina KDS / Almacén)                    |
|  - Configuración Local: Horarios, Teléfonos, Cuentas, Pedido Mínimo     |
|  - Zonas de Reparto y Tarifas (GeoJSON / Z2-Z7)                         |
|  - Alta Demanda (Cocina)                                                |
+------------------------------------+------------------------------------+
                                     | Evento Guardar / Webhook
                                     v
+------------------------------------+------------------------------------+
|                    BACKEND CENTRAL / API REST                           |
|  - Endpoint: GET /api/v1/bot/config                                     |
|  - Endpoint: GET /api/v1/bot/menu                                       |
|  - Endpoint: GET /api/v1/bot/zones.geojson                              |
+------------------------------------+------------------------------------+
                                     | Polling (60s) o Webhook Invalidation
                                     v
+------------------------------------+------------------------------------+
|                    CHATBOT WHATSAPP (bot_wa.py)                         |
|  - Generador de System Prompt Dinámico (reemplaza menu_dinamico.txt)    |
|  - Evaluación horaria contra JSON de configuración                      |
|  - Cuentas bancarias y números inyectados dinámicamente                 |
|  - Cálculo de zonas con GeoJSON provisto por API                        |
|  - Detección inmediata de Agotados en System Prompt                     |
+-------------------------------------------------------------------------+
```

### 6.1. Endpoint Unificado de Configuración y Carta (`GET /api/v1/bot/config`)
El backend central expondrá un endpoint protegido que devolverá la fotografía operativa completa del restaurante:
1. `empresa`: Nombre, teléfonos de contacto, WhatsApp oficial.
2. `pagos`: Cuentas Yape, Plin, BCP e Interbank con CCI y nombre del titular.
3. `horarios`: Matriz semanal de días abiertos/cerrados, horas de apertura y cierre, y lista de fechas especiales con prioridad sobre el horario regular.
4. `politicas_entrega`: Monto de pedido mínimo, umbral de envío gratis y tarifas asociadas a cada identificador de zona (`Z2`, `Z3`, `Z4`, `Z5`, `Z7`).
5. `alta_demanda`: Estado (`true`/`false`), minutos adicionales y tiempos estimados vigentes para informar al cliente.
6. `agotados`: Arreglo de nombres de productos e insumos marcados sin stock en cocina.
7. `catalogo`: Lista estructurada de productos activos con sus presentaciones, precios unitarios, modificadores obligatorios y opcionales.

### 6.2. Generador Automático del System Prompt (Sustitución de `menu_dinamico.txt`)
En lugar de mantener un archivo plano `menu_dinamico.txt` editado a mano por desarrolladores, el bot incorporará una rutina en Python (`render_system_prompt`):
- Transforma el árbol JSON de productos en la sintaxis optimizada para OpenAI, agrupando por categorías (Bebidas Calientes, Frappés, Salados, Waffles, Postres y Combos).
- Filtra automáticamente los productos inactivos y agrega la etiqueta explícita `[AGOTADO POR HOY]` a los ítems reportados por cocina, indicándole a OpenAI que sugiera las alternativas definidas.
- Inyecta en las directrices de cobro los números reales de Yape/Plin y las cuentas bancarias vigentes, eliminando valores cableados en `prompt.py`.

### 6.3. Sincronización en Tiempo Real por Webhook de Invalidación
Para que los cambios en Admin impacten al instante:
1. Al pulsar "Guardar" en Admin (por ejemplo, al actualizar el precio de un café, modificar el número de Yape o marcar un insumo agotado en KDS), el backend emite una petición interna `POST /cmd/actualizar` hacia la instancia de FastAPI del bot.
2. La función `load_dynamic_menu()` del bot consulta la API, regenera `CURRENT_PROMPT` en memoria y actualiza las variables operativas (`alta_demanda_mode`, `horarios`, `cuentas_bancarias`) sin necesidad de reiniciar el servicio ni interrumpir las conversaciones en curso.
3. Como mecanismo de contingencia ante fallas de red, el bot refresca la configuración mediante un polling periódico en segundo plano cada 5 minutos.

### 6.4. Sincronización de Zonas y Polígonos de Cobertura
El módulo `geo_utils.py` dejará de depender de un archivo estático local `LIMITES_DELIVERY.geojson`. Al actualizarse las zonas en el módulo "Mapa de entregas" de Admin, el archivo GeoJSON se sincronizará automáticamente vía API, garantizando que tanto la carta web (`Main.dc.html`), el cajero en Admin y el bot calculen exactamente el mismo costo de envío para cualquier coordenada.

---

INFORME LISTO.

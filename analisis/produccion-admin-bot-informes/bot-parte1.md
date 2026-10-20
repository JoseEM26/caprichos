---
id: ANA-CAP-046
tipo: analisis
titulo: "INFORME DE ANALISIS INTEGRAL DEL CHATBOT: PARTE 1"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, produccion-admin-bot-informes]
---

# INFORME DE ANALISIS INTEGRAL DEL CHATBOT: PARTE 1
## REGLAS DE NEGOCIO, CONDICIONES, MENSAJES FIJOS, UMBRALES Y BRECHAS FRENTE AL MOCKUP

---

### 1. ALCANCE Y METODOLOGIA

El presente documento constituye la primera parte de la lectura exhaustiva y auditoria tecnica del chatbot de WhatsApp de la cafeteria artesanal Caprichos (Lima, Peru).

Fuentes primarias examinadas linea por linea:
1. `bot/prompt.py` (lineas 1 a 98, completo).
2. `bot/AGENTS.md` (lineas 1 a 69, completo).
3. `bot/menu_dinamico.txt` (estructura de categorias, productos, combos y modificadores).
4. `bot/bot_wa.py` (lineas 1 a 2600, leidas en tramos continuos de 200 lineas mediante sed -n sin omisiones).

Archivos de contraste del mockup y requerimientos:
1. `fuente/Admin.dc.html` (sistema administrativo y KDS).
2. `fuente/Main.dc.html` (carta web interactiva para clientes).
3. `fuente/Chatbot.dc.html` (simulador de atencion conversacional).
4. `fuente/acta-01-descubrimiento.md` y `fuente/acta-02-descubrimiento.md` (reuniones con el cliente Kevin Rosales).
5. `fuente/flujo-de-pedidos.md` e `fuente/iniciativas-acta-02.md`.

Reglas de redaccion cumplidas:
- Documento redactado en español formal y sin emojis.
- Cada hallazgo detalla: nombre de funcion y ubicacion, que hace, estado en el mockup, relevancia gastronomica/operativa, estado de confirmacion y prioridad.
- Concluye con la seccion priorizada de reglas ausentes en el mockup.
- Ultima linea exacta: INFORME LISTO.

---

### 2. ANALISIS DETALLADO DE REGLAS DE NEGOCIO POR COMPONENTE

---

#### 2.1. HORARIOS Y ATENCION FUERA DE HORARIO

##### Regla 2.1.1: Evaluacion de Horario Comercial y Cero Spam de Horarios
- Nombre de funcion / Ubicacion en bot: `get_ai_response` (en `bot/bot_wa.py`), `SYSTEM_PROMPT` (en `bot/prompt.py`), y Regla 1 (en `bot/AGENTS.md`).
- Que hace en el bot: Evalua en tiempo real la hora local en Lima mediante `pytz.timezone('America/Lima')`. El horario de atencion y despacho de cocina/tienda es de 2:00 PM a 10:00 PM (14:00 a 22:00 horas). La recepcion de pedidos por WhatsApp opera las 24 horas del dia. Impone una condicion estricta denominada "CERO SPAM DE HORARIO": el bot tiene terminantemente prohibido mencionar el horario de atencion en saludos, botones de bienvenida o mensajes intermedios. El horario SOLO se menciona si el cliente pregunta explicitamente por el (por ejemplo, "¿a que hora abren?", "¿estan atendiendo?") o al momento de confirmar un pedido tomado fuera del rango de 14:00 a 22:00, recordando amablemente que la preparacion y despacho iniciara a las 2:00 PM.
- Estado en el Mockup: La tiene a medias.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` y `fuente/Main.dc.html`, el objeto de configuracion `INFO` define `horario` con dias y horas (14:00 a 22:00) y la funcion `statusNow`. En `fuente/Chatbot.dc.html`, existe la respuesta fija a la duda `d3` ("¿Hasta que hora atienden?"). Sin embargo, el mockup no implementa la directiva de suprimir el horario durante el flujo normal ni la regla conversacional de recepcion continua 24h. En el Acta 02 (`00:03:55`), Kevin indica que entran pedidos desde temprano para ser despachados en la tarde.
- Por que importa para una cafeteria: Si el bot suelta el horario en cada respuesta o rechaza mensajes en la mañana, genera friccion y ahuyenta ventas anticipadas para la tarde (almuerzos, lonches y pedidos corporativos).
- Clasificacion: CONFIRMADO en el codigo (`bot_wa.py`) y en el acta.
- Prioridad: Alta.

##### Regla 2.1.2: Captura Continua Fuera de Horario
- Nombre de funcion / Ubicacion en bot: `get_ai_response` (variable `contexto_horario` inyectada al sistema en `bot/bot_wa.py`).
- Que hace en el bot: Si `now.hour < 14` o `now.hour >= 22`, el bot no bloquea la compra. Permite armar el pedido completo (productos, sabores, direccion y metodo de pago) y recien en el resumen final aclara: "la preparacion y despacho iniciara a las 2:00 PM".
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: En `fuente/Main.dc.html` y `fuente/Chatbot.dc.html`, al estar fuera de hora el sistema muestra simplemente el indicador visual "Cerrado" o "Cerrado hoy", sin mecanismo para recepcion y cola diferida.
- Por que importa para una cafeteria: Convierte la demanda pasiva de la mañana (madrugadores o coordinadores de oficina) en pedidos ya pagados listos para que la cocina empiece a hornear apenas encienda hornos a las 14:00.
- Clasificacion: CONFIRMADO en el codigo (`bot_wa.py`).
- Prioridad: Media.

---

#### 2.2. PROMOCIONES, COMBOS Y EQUIVALENCIAS (DUO Y CAPRIKIDS)

##### Regla 2.2.1: Combo Duo Compartir y Matriz de Equivalencias de Complementos
- Nombre de funcion / Ubicacion en bot: `SYSTEM_PROMPT` (en `bot/prompt.py`), Reglas 2 y 9 (en `bot/AGENTS.md`), y `bot/menu_dinamico.txt`.
- Que hace en el bot: Promocion compuesta por 2 Bebidas (frias o calientes, excepto frozen) mas 1 Complemento. Precios estrictos por tamaño de bebida:
  - 12oz: S/ 33.00
  - 16oz: S/ 36.00
  - 20oz: S/ 38.00
  Regla condicional de complementos: El cliente puede elegir complementos ligeros en cantidad de 2 unidades (2 Donas, 2 Galletas con chispas de chocolate, o 1 Dona mas 1 Galleta). Pero si el cliente elige un complemento de reposteria o cocina salada de mayor costo (1 tajada de Carrot Cake, 1 tajada de Keke Marmoleado, 1 Empanada de pollo/jamon y queso, o 1 porcion de 4 Petit Pan con pollo), la regla impone que sea obligatoriamente 1 sola unidad.
- Estado en el Mockup: La tiene a medias.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` (pedido demo `CP-0102` con DUO PARA COMPARTIR a S/ 33) y `fuente/Main.dc.html` (tarjeta de promocion Duo). En el Acta 02 (`00:37:31`), Kevin expone ampliamente esta regla y señala la frustracion con restaurant.pe porque permitia que el cliente seleccionara 2 empanadas o 2 tortas al mismo precio promocional, generando perdidas.
- Por que importa para una cafeteria: Es el combo con mayor rotacion en turnos de tarde. Un error en la validacion de complementos permite pedir 2 porciones de torta de chocolate o 2 empanadas (costo individual S/ 7.50 a S/ 9.50 c/u), destruyendo el margen bruto del combo.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

##### Regla 2.2.2: Combo Duo Irresistible
- Nombre de funcion / Ubicacion en bot: `SYSTEM_PROMPT` (en `bot/prompt.py`), Regla 2 (en `bot/AGENTS.md`), y `bot/menu_dinamico.txt`.
- Que hace en el bot: Incluye 1 Club Sandwich gigante (4 pisos de pan artesanal, doble jamon, doble queso, pechuga de pollo, lechuga, tomate y tocino) mas 350 gramos de papas nativas mas 2 Bebidas seleccionadas exclusivamente de una lista cerrada de 6 opciones: Americano, Cappuccino, Chocolate caliente, Iced Coffee, Iced Latte Coffee o Iced Chocolate. Precios estructurados por tamaño:
  - 12oz: S/ 37.00
  - 16oz: S/ 40.00
  - 21oz: S/ 42.00
- Estado en el Mockup: La tiene a medias.
- Donde esta en el mockup / acta: En `fuente/Main.dc.html` aparece como banner y producto. No valida que la eleccion de bebidas este restringida a las 6 variedades oficiales sin permitir bebidas de mayor costo fuera del combo.
- Por que importa para una cafeteria: Evita que el cliente seleccione frappes especiales costosos (como Frappe Caramel o Fit) dentro de un combo diseñado con bebidas de base espresso o chocolate estandar.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

##### Regla 2.2.3: Promocion Media Docena (6 Unidades)
- Nombre de funcion / Ubicacion en bot: Regla 2 (en `bot/AGENTS.md`) y `bot/menu_dinamico.txt`.
- Que hace en el bot: Precio fijo de S/ 21.00 por un surtido de 6 unidades a elegir libremente entre: 6 donas, 6 galletas, o combinacion mixta de donas y galletas cuya sumatoria sea exactamente 6 unidades.
- Estado en el Mockup: La tiene a medias.
- Donde esta en el mockup / acta: En `fuente/Main.dc.html` se lista como combo, pero la interfaz de armado de la caja no valida la restriccion de suma exacta de 6 items ni gestiona inventario diferenciado por sabor de dona.
- Por que importa para una cafeteria: Estimula el consumo grupal y empaque para llevar en postres frescos del dia.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

##### Regla 2.2.4: Combo Cajita Caprikids
- Nombre de funcion / Ubicacion en bot: Regla 2 (en `bot/AGENTS.md`), `SYSTEM_PROMPT` (en `bot/prompt.py`), y `PRODUCT_IMAGE_MAP` (en `bot/bot_wa.py`).
- Que hace en el bot: Precio fijo de S/ 27.00. Contenido: 1 Frappe Oreo 12oz mas porcion de Nuggets artesanales mas Papas nativas mini con salchichas ahumadas mas 2 Juguetes a eleccion. El bot tiene la instruccion obligatoria de preguntar si el combo es para niño o niña y consultar que 2 juguetes prefiere entre: Pistola de burbujas, Tubo de burbujas o Squishy.
- Estado en el Mockup: La tiene.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` (definicion de combo `COMBO CAJITA CAPRIKIDS` a S/ 27 con modificador `jug` de 2 juguetes: Pistola de burbujas, Burbujas, Squishy).
- Por que importa para una cafeteria: Atrae publico familiar los fines de semana; requiere coordinacion exacta de inventario no solo de insumos gastronomicos sino de juguetes fisicos.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

##### Regla 2.2.5: Promocion Cumpleaños en Salon
- Nombre de funcion / Ubicacion en bot: Regla 2 (en `bot/AGENTS.md`).
- Que hace en el bot: Valida exclusivamente para consumo presencial en salon con un consumo minimo previo de S/ 14.50. Otorga al agasajado 1 tajada de Carrot Cake o Keke Marmoleado mas 8 minishots de frappe degustacion y la animacion con cancion de cumpleaños por parte del equipo.
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: No existe en `fuente/Admin.dc.html`, `fuente/Main.dc.html` ni `fuente/Chatbot.dc.html`.
- Por que importa para una cafeteria: Herramienta de marketing vivencial y fidelizacion de clientes en local presencial.
- Clasificacion: CONFIRMADO en el codigo (`AGENTS.md`).
- Prioridad: Baja.

##### Regla 2.2.6: Manejo de Promociones Vencidas y Bloqueo de Stock Agotado (Pack Amarillo)
- Nombre de funcion / Ubicacion en bot: `check_pack_amarillo_registered` y directiva en `calcular_total_pedido` (en `bot/bot_wa.py`).
- Que hace en el bot: Regla 2 de `AGENTS.md` estipula que la promocion 2x1 finalizo. En `bot_wa.py`, para la promocion temporal "Pack Amarillo" (21/09/2026), la funcion `check_pack_amarillo_registered` inspecciona si el cliente ya contaba con reserva previa. Si no la tenia y el modelo intenta añadirlo en `calcular_total_pedido`, la herramienta retorna un error explicito: "El Pack Amarillo se encuentra COMPLETAMENTE AGOTADO por alta demanda. No es posible añadirlo al pedido".
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` y `fuente/Main.dc.html` no existe logica de validacion historica de reservas previas ante productos agotados.
- Por que importa para una cafeteria: En campañas de alta estacionalidad (San Valentin, Dia de la Madre, flores amarillas), evita sobrevender packs promocionales con stock fisico cerrado.
- Clasificacion: CONFIRMADO en el codigo (`bot_wa.py`).
- Prioridad: Baja.

##### Regla 2.2.7: Asociacion Automatica de Bebidas a Combos y Cero Preguntas Redundantes
- Nombre de funcion / Ubicacion en bot: Reglas 9 y 10 (en `bot/AGENTS.md`).
- Que hace en el bot: Cuando el cliente pide combos/duos (por ejemplo, "quiero 2 duos compartir: 2 frappes oreo, 1 cappuccino, 1 chocolate y 2 carrot cake"), el bot tiene prohibido cobrar las bebidas de forma separada como articulos sueltos; debe asociarlas automaticamente a los duos solicitados. Asimismo, si el cliente ya indico tamaño, sabores o complementos en el primer mensaje, queda estrictamente prohibido volver a preguntarlos.
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: `fuente/Chatbot.dc.html` es una maquina estatica de pasos lineales que siempre interroga paso a paso (tamaño, tipo de leche, endulzante) sin capacidad de absorcion de datos previos.
- Por que importa para una cafeteria: Reduce la cantidad de mensajes requeridos para cerrar una venta; evita sobrecobros indebidos que espantan al comprador.
- Clasificacion: CONFIRMADO en el codigo (`AGENTS.md`).
- Prioridad: Alta.

---

#### 2.3. MODIFICADORES, LECHES, ENDULZANTES, TOPPINGS Y PRECIOS EXTRA

##### Regla 2.3.1: Politica de Leches en Bebidas Calientes, Frappes e Iced
- Nombre de funcion / Ubicacion en bot: Regla 5 (en `bot/AGENTS.md`) y `SYSTEM_PROMPT` (en `bot/prompt.py`).
- Que hace en el bot:
  - Preparacion base: Leche entera UHT.
  - Sustitucion a Leche Sin Lactosa: S/ 0.00 (Totalmente GRATIS).
  - Sustitucion a Bebida / Leche de Almendras: Recargo exacto de + S/ 2.50.
- Estado en el Mockup: La tiene.
- Donde esta en el mockup / acta: En `fuente/Main.dc.html`, `fuente/Chatbot.dc.html` (constante `LECHE` con opts: Leche entera 0, Leche sin lactosa 0, Bebida de almendra 2.50) y en `fuente/Admin.dc.html`.
- Por que importa para una cafeteria: Estandariza el cobro de bebidas vegetales, cuyo costo de insumo duplica a la leche de vaca.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

##### Regla 2.3.2: Politica de Azucar, Stevia y Endulzantes Exclusivos de Receta
- Nombre de funcion / Ubicacion en bot: Regla 5 (en `bot/AGENTS.md`).
- Que hace en el bot:
  - Endulzante general: Azucar blanca tradicional.
  - Sustitucion a Stevia o sin azucar: S/ 0.00 (Totalmente GRATIS).
  - Endulzantes exclusivos por receta tecnica:
    - Chocolate caliente, Mocaccino y Choconube: Syrup artesanal de almendra.
    - Latte Vainilla: Vainilla natural 100% organica.
    - Caramel Macchiato: Caramelo artesanal y manjar blanco.
    - Americano: Se ofrece y sirve sin azucar.
    - Frappes Caramel clasico y Caramel chocolate: Caramelo artesanal.
    - Frappe Algarrolucuma: Algarrobina natural (sin necesidad de azucar añadida).
- Estado en el Mockup: La tiene a medias.
- Donde esta en el mockup / acta: En `fuente/Chatbot.dc.html` y `fuente/Main.dc.html` existe seleccion basica entre azucar blanca y stevia. No existen las restricciones de endulzante por receta exclusiva de especialidad.
- Por que importa para una cafeteria: Preserva la identidad de sabor del cafe artesanal de especialidad y evita que un barista reciba comandas contradictorias.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

##### Regla 2.3.3: Chantilly, Toppings y Adicionales en Frappes
- Nombre de funcion / Ubicacion en bot: Regla 5 (en `bot/AGENTS.md`) y `bot/menu_dinamico.txt`.
- Que hace en el bot:
  - Chantilly Extra (porcion de 4oz): + S/ 2.00.
  - Opcion sin chantilly: Permitida y gratuita (S/ 0.00).
  - Topping estandar incluido segun sabor de frappe: Chispas de chocolate (Cafe, Moca, Caramel chocolate, Chocolucuma), Oreo triturado (Oreo, Chocoberry), Chin Chin (Strawberry, Berries), Almendra triturada (Algarrolucuma, Caramel clasico), Granola (Fit), Sin topping (Maracuya).
  - Cambio de Topping por otro de la lista: Totalmente GRATIS (S/ 0.00).
  - Topping Extra / Adicional: + S/ 1.00 por porcion extra.
- Estado en el Mockup: La tiene a medias.
- Donde esta en el mockup / acta: `fuente/Main.dc.html` y `fuente/Admin.dc.html` contemplan Chantilly a S/ 2.00. No implementan la regla de cambio gratuito de topping ni el costo diferenciado de porcion adicional a S/ 1.00.
- Por que importa para una cafeteria: Control estricto de mermas en barra de frappes y satisfaccion del comensal al personalizar su vaso.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

##### Regla 2.3.4: Advertencias Culinarias sobre Hielo, Textura y Cafe en Frappes
- Nombre de funcion / Ubicacion en bot: Regla 5 (en `bot/AGENTS.md`).
- Que hace en el bot:
  - Solicitud de "Poco hielo": El bot debe advertir obligatoriamente al cliente que preparar un frappe con poco hielo resultara en un menor volumen o cantidad de liquido dentro del vaso.
  - Solicitud de "No tan helado / aguado": El bot debe explicar que, al elaborarse sobre una base de hielo triturado, la bebida perdera consistencia y quedara aguada. Si el cliente insiste, formula un descargo de responsabilidad cordial sobre la textura y el sabor resultante.
  - Opcion "Sin cafe": Los frappes vienen formulados con cafe por defecto, pero se indica explicitamente que pueden prepararse sin cafe si el cliente lo solicita.
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: No existe advertencia alguna sobre consistencia ni volumen en `fuente/Main.dc.html` ni `fuente/Chatbot.dc.html`.
- Por que importa para una cafeteria: Resuelve uno de los reclamos mas frecuentes en cafeterias de Lima: comensales que exigen vaso lleno tras haber pedido "sin hielo" en una bebida cuya estructura fisica es granizado de hielo.
- Clasificacion: CONFIRMADO en el codigo (`AGENTS.md`).
- Prioridad: Media.

##### Regla 2.3.5: Modificadores y Adicionales en Waffles
- Nombre de funcion / Ubicacion en bot: Regla 5 (en `bot/AGENTS.md`) y `bot/menu_dinamico.txt`.
- Que hace en el bot:
  - Cambios gratuitos: Cambiar una fruta por otra fruta de la carta, cambiar sabor de salsa/syrup (chocolate 100% cacao, maracuya, fresa, cheesecake), pedir sin chantilly, o pedir que la salsa y el helado se sirvan en envases separados.
  - Adicionales con costo:
    - Chantilly Extra: + S/ 2.00
    - Bola de Helado Extra: + S/ 2.50
    - Porcion Adicional de Salsa/Syrup: + S/ 2.50
- Estado en el Mockup: La tiene a medias.
- Donde esta en el mockup / acta: En `fuente/Chatbot.dc.html` (constante `ADIC` con Chantilly 2, Bola de helado 2.5, Syrop 2.5) y `fuente/Main.dc.html`. No codifica la regla de cambio gratuito de fruta o envio de salsas por separado.
- Por que importa para una cafeteria: Permite despachos de delivery donde el helado llega intacto en pote termico aparte sin derretirse sobre el waffle caliente durante el trayecto.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

---

#### 2.4. TAMAÑOS DE BEBIDAS Y ASIMILACION DE PRECIOS

##### Regla 2.4.1: Presentacion Obligatoria de los 3 Tamaños Oficiales
- Nombre de funcion / Ubicacion en bot: Reglas 6 y 7 (en `bot/AGENTS.md`) y `SYSTEM_PROMPT` (en `bot/prompt.py`).
- Que hace en el bot: Toda bebida debe ofrecerse obligatoriamente en sus 3 tamaños oficiales con sus respectivos precios, quedando estrictamente prohibido omitir el tamaño Extra o asumir un tamaño por omision:
  - Regular: 12oz
  - Grande: 16oz
  - Extra Grande: 21oz (o 20oz en bebidas calientes y combos)
- Estado en el Mockup: La tiene.
- Donde esta en el mockup / acta: En `fuente/Chatbot.dc.html` (constantes `BEB` y `CAL` con 12oz, 16oz y 21oz) y en `fuente/Main.dc.html`.
- Por que importa para una cafeteria: El tamaño Extra de 21oz genera el mayor margen de contribucion monetaria por vaso de cafe o frappe; omitirlo castiga el ticket promedio.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

##### Regla 2.4.2: Asimilacion Automatica de Precio Digitado a Tamaño
- Nombre de funcion / Ubicacion en bot: Regla 11 (en `bot/AGENTS.md`) y `SYSTEM_PROMPT` (en `bot/prompt.py`).
- Que hace en el bot: Si el bot formula la pregunta de tamaño ("¿Deseas Regular 12oz a S/ 14.50, Grande 16oz a S/ 16.50 o Extra 21oz a S/ 17.50?") y el cliente responde escribiendo el precio en soles (por ejemplo, "14.50", "16.5", "17.50" o "33"), el bot asimila dicho numero inmediatamente al tamaño correspondiente (Regular, Grande o Extra) y avanza en la conversacion sin reiterar la pregunta.
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: En `fuente/Chatbot.dc.html` la seleccion opera exclusivamente mediante botones clicables; no hay procesamiento semantico de cifras monetarias asociadas a tamaños.
- Por que importa para una cafeteria: Muchisimos comensales responden con el precio que vieron en la carta en vez de memorizar si el vaso se llama Regular o Grande.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

---

#### 2.5. PEDIDO MINIMO Y DELIVERY GRATIS

##### Regla 2.5.1: Consumo Minimo para Delivery
- Nombre de funcion / Ubicacion en bot: `SYSTEM_PROMPT` (Fase 2 en `bot/prompt.py`) y `calcular_total_pedido` (en `bot/bot_wa.py`).
- Que hace en el bot: Para que una orden pueda despacharse bajo la modalidad de Delivery, el consumo neto en productos debe ser de al menos S/ 14.50. Si el pedido no alcanza esta cifra, el bot solicita agregar un complemento o sugiere Recojo en Tienda.
- Estado en el Mockup: La tiene.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` (campo `pedidoMin: '14.50'` en `INFO`) y en `fuente/Main.dc.html` (bloqueo en checkout si total < S/ 14.50). En `fuente/Chatbot.dc.html` no se valida este umbral.
- Por que importa para una cafeteria: Protege la rentabilidad operativa; despachar un motorizado por una dona de S/ 4.00 genera perdida neta directa de transporte y empaque.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

##### Regla 2.5.2: Umbral de Delivery Gratuito (Exoneracion de Flete)
- Nombre de funcion / Ubicacion en bot: `calcular_total_pedido` (en `bot/bot_wa.py`), `SYSTEM_PROMPT` (en `bot/prompt.py`), y `process_incoming_msg_wa` (en `bot/bot_wa.py`).
- Que hace en el bot: Si la suma de subtotales de productos consumidos (`subtotal_productos`) supera estrictamente los S/ 70.00 (`if subtotal_productos > 70:`):
  - El costo de delivery se sobreescribe a exactamente S/ 0.00.
  - La herramienta inyecta la leyenda explicativa: "- Delivery = S/ 0.00 (¡GRATIS por compra mayor a S/ 70! )".
- Estado en el Mockup: La tiene.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` (campo `envioGratis: '70'`), `fuente/Main.dc.html` (`moFree = moIsDel && moNet >= Number(s.info.envioGratis || 70)`), y `fuente/Chatbot.dc.html` (`const fee = s.modal === 'delivery' && sub < 70 ? 3 : 0`).
- Por que importa para una cafeteria: Es el principal gatillador para elevar el ticket promedio; empuja a los clientes que tienen S/ 55 o S/ 60 en el carrito a sumar un postre adicional para ahorrarse el delivery.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

---

#### 2.6. UBICACION, COORDENADAS, ZONAS Y POLIGONOS GEOESPACIALES

##### Regla 2.6.1: Evaluacion Geoespacial de Poligonos (GeoJSON) y Zonas de Cobertura
- Nombre de funcion / Ubicacion en bot: `calculate_delivery_cost` (en `geo_utils.py`), invocado por `process_incoming_msg_wa` y `extract_coordinates_from_text` (en `bot/bot_wa.py`).
- Que hace en el bot: Utiliza la libreria geoespacial `shapely.geometry` sobre el archivo de limites vectoriales `LIMITES_DELIVERY.geojson`. Al recibir la latitud y longitud del comensal, determina en que poligono cae y retorna la tarifa fija correspondiente:
  - Zona Z2: S/ 2.00
  - Zona Z3: S/ 3.00 (tarifa comun)
  - Zona Z4: S/ 4.00
  - Zona Z5: S/ 5.00
  - Zona Z7: S/ 7.00
  - Fuera de zona de reparto: Retorna `-1`. En este caso, el bot inyecta la instruccion de sistema: "UBICACIÓN GPS RECIBIDA: El sistema de mapas calculó que la ubicación del cliente ESTÁ FUERA DE LA ZONA DE REPARTO (sin cobertura). Infórmale amablemente que lamentablemente su dirección se encuentra fuera de nuestra zona de reparto de delivery, y pregúntale si preferiría registrar su pedido para Recojo en Tienda".
  - Error de poligono nulo (`costo is None`): El bot asume S/ 0 temporalmente y pide referencia territorial.
- Estado en el Mockup: La tiene a medias.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` se configuran las tarifas de entrega (`tarZ2` a `tarZ7`). En `fuente/Main.dc.html` existe `zonaOf(lat, lng)`. Sin embargo, `fuente/Chatbot.dc.html` usa una tarifa plana fija de 3 soles (`sub < 70 ? 3 : 0`) sin soporte de mapas, y el mockup no cuenta con el motor de poligonos GeoJSON real ni el tratamiento de exclusion por fuera de cobertura. En el Acta 02 (`00:44:29` y `02:08:12`), Kevin exige calculo por mapa satelital.
- Por que importa para una cafeteria: En distritos geograficamente complejos como San Juan de Lurigancho (zonas planas vs cerros o quebradas), el radio por kilometros lineales es engañoso; los poligonos GeoJSON evitan que un repartidor tarde 45 minutos por una tarifa de 3 soles.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

##### Regla 2.6.2: Rechazo Estricto de Direcciones Escritas en Texto
- Nombre de funcion / Ubicacion en bot: `process_incoming_msg_wa` (bloque `address_keywords` en `bot/bot_wa.py`).
- Que hace en el bot: Si el cliente escribe palabras clave de direccion ("pasaje", "av", "avenida", "calle", "jiron", "manzana", "lote", "mz", "urbanizacion", etc.) sin adjuntar su GPS nativo, el bot activa el mensaje de sistema: "REGLA DE UBICACIÓN POR TEXTO: El cliente intentó enviar su dirección escrita en texto. NO ACEPTES ESTA DIRECCIÓN ESCRITA EN TEXTO. Explícale amablemente que no podemos procesar direcciones por texto porque Google Maps presenta múltiples lugares con el mismo nombre y nuestro delivery se guía exclusivamente por coordenadas GPS de WhatsApp. Pídele e insiste en que comparta su UBICACIÓN ACTUAL enviada desde el botón de adjuntar ubicación de WhatsApp (clip  -> Ubicación)".
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: En `fuente/Main.dc.html` y `fuente/Chatbot.dc.html` se permite libremente escribir texto en el campo de direccion sin advertencia de imprecision.
- Por que importa para una cafeteria: En las periferias de Lima abundan calles sin rotulacion oficial o duplicadas en distintos asentamientos humanos; forzar el pin GPS de WhatsApp erradica envios extraviados.
- Clasificacion: CONFIRMADO en el codigo (`bot_wa.py`).
- Prioridad: Alta.

##### Regla 2.6.3: Parser Universal de Coordenadas de Mapas
- Nombre de funcion / Ubicacion en bot: `extract_coordinates_from_text` y `parse_dms_coordinates` (en `bot/bot_wa.py`).
- Que hace en el bot: Es capaz de extraer coordenadas geograficas de multiples formatos que envia el usuario en el texto:
  1. Enlaces cortos de Google Maps (`maps.app.goo.gl`): Realiza una peticion HTTP GET asincrona siguiendo redirecciones para obtener la URL expandida.
  2. Coordenadas DMS (grados, minutos y segundos: ej. 11°58'45.2"S 77°01'12.4"W) y las convierte matematicamente a decimal.
  3. Patrones regex en URLs de mapas: `@lat,lon`, `search/lat,lon`, `q=lat,lon`, `!3dlat!4dlon`.
  4. Coordenadas decimales sueltas en texto: Valida que esten en la caja geografica de Peru (`-25 <= lat <= 5` y `-85 <= lon <= -60`).
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: No existe parser de enlaces ni coordenadas en los mockups.
- Por que importa para una cafeteria: Muchos clientes comparten el enlace copiado de Google Maps en lugar de usar la funcion nativa de WhatsApp.
- Clasificacion: CONFIRMADO en el codigo (`bot_wa.py`).
- Prioridad: Media.

##### Regla 2.6.4: Reutilizacion Obligatoria de Ubicacion Anterior
- Nombre de funcion / Ubicacion en bot: `get_ai_response` (en `bot/bot_wa.py`), `SYSTEM_PROMPT` (Fase 2 en `bot/prompt.py`), y `client_db.py`.
- Que hace en el bot: Si el cliente ya tiene una ubicacion GPS registrada en `clientes.json` o en la sesion (`user_gps`), el bot tiene terminantemente prohibido pedirle el GPS de nuevo desde cero. Debe preguntar obligatoriamente: "Veo que tenemos guardada tu ubicación anterior : {enlace_maps}. ¿Confirmas si lo enviamos a esta misma ubicación o a una nueva dirección? ". Si el cliente dice "si", "a esa misma", "la misma" o "enviamelo rapido", toma de inmediato esa ubicacion y su costo de delivery calculado.
- Estado en el Mockup: La tiene a medias.
- Donde esta en el mockup / acta: En `fuente/Main.dc.html` se guarda direccion en `localStorage` (`addrMem`), pero no en el chatbot ni con la confirmacion conversacional automatica. En el Acta 02 (`01:07:16`), Kevin pide que el sistema reconozca la direccion guardada por celular.
- Por que importa para una cafeteria: Elimina pasos molestos en la compra recurrente de clientes frecuentes.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

##### Regla 2.6.5: Prohibicion Estricta de Pedir GPS en Recojo en Tienda o Salon
- Nombre de funcion / Ubicacion en bot: `SYSTEM_PROMPT` (Fase 2 en `bot/prompt.py`), Reglas 8, 13 y 16 (en `bot/AGENTS.md`), y `generate_kitchen_ticket` (en `bot/bot_wa.py`).
- Que hace en el bot: Si el cliente manifesto que el pedido es para "Recojo en Tienda" o "Consumo en Local":
  - Costo de delivery = S/ 0.00.
  - Esta terminantemente prohibido solicitar ubicacion GPS o cobrar flete.
  - Si el cliente luego comparte por inercia su GPS, el bot debe consultar si desea cambiar su pedido a Delivery o mantenerlo para Recojo en Tienda.
- Estado en el Mockup: La tiene.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html`, `fuente/Main.dc.html` y `fuente/Chatbot.dc.html`, donde marcar 'recojo' o 'local' anula el flete y oculta campos de direccion.
- Por que importa para una cafeteria: Evita cobrar transporte a quien va a retirar el producto al mostrador.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

---

#### 2.7. PAGOS: YAPE, PLIN, TRANSFERENCIA, EFECTIVO, TARJETA, VUELTO Y "CANCELO CON"

##### Regla 2.7.1: Datos Oficiales de Cuentas Bancarias y Billeteras Digitales
- Nombre de funcion / Ubicacion en bot: `SYSTEM_PROMPT` (Fase 5 en `bot/prompt.py`).
- Que hace en el bot: Una vez confirmado el resumen de la orden, el bot remite el mensaje con las cuentas oficiales exactas del comercio:
  - Yape y Plin: Celular `977503006` a nombre de Maria Jose Morillo Ruiz.
  - BCP Soles: Cuenta corriente `19197148281074` (CCI: `00219119714828107455`).
  - Interbank Soles: Cuenta corriente `0913227414217` (CCI: `00309101322741421764`).
  - Mensaje fijo de cierre de cobro: "Por favor, envíanos la captura o foto de tu comprobante de pago por aquí para validar tu orden ".
- Estado en el Mockup: La tiene.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` y `fuente/Main.dc.html` (campos `yape`, `plin`, `cuenta` en `INFO`). En el Acta 02 (`00:05:03`), Kevin exige boton de copiar numero para Yape y Plin y cuentas bancarias.
- Por que importa para una cafeteria: El 90% de pedidos por canal digital en Lima se liquidan mediante transferencias bancarias o billeteras moviles.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

##### Regla 2.7.2: Semantica Peruana: "Cancelo con [Monto]" = Pago en Efectivo y Vuelto
- Nombre de funcion / Ubicacion en bot: `SYSTEM_PROMPT` (en `bot/prompt.py`) y directiva de sistema en `get_ai_response` (en `bot/bot_wa.py`).
- Que hace en el bot: Condicion obligatoria de criterio lingüistico peruano: "En el Perú el verbo 'cancelar' significa PAGAR la cuenta. Si el cliente dice frases como 'cancelo con 100 soles enviamelo rapido', 'cancelo con 50', 'cancelo con 20', 'cancelo en efectivo', se refiere a que pagará en efectivo con un billete de ese valor y necesita vuelto. ESTÁ TERMINANTEMENTE PROHIBIDO interpretar esto como cancelar o anular el pedido. Atiende con total criterio: anota el medio de pago (Efectivo con billete de S/ 100), verifica la modalidad/ubicación si falta, y calcula el total y vuelto correspondiente".
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: En `fuente/Chatbot.dc.html` el selector es un boton estatico 'Efectivo' que despliega "¿Con cuanto pagas?". No procesa lenguaje natural ni reconoce la expresion "cancelo con".
- Por que importa para una cafeteria: Modismo critico en Peru. Los motores de inteligencia artificial convencionales entrenados en español internacional cancelan o anulan la orden si el cliente escribe "cancelo con 50 soles", perdiendo la venta.
- Clasificacion: CONFIRMADO en el codigo (`prompt.py` y `bot_wa.py`).
- Prioridad: Alta.

##### Regla 2.7.3: Pago Contra Entrega con POS Inalambrico (Tarjeta)
- Nombre de funcion / Ubicacion en bot: `SYSTEM_PROMPT` (Fase 5 en `bot/prompt.py`).
- Que hace en el bot: Si el cliente selecciona pago con tarjeta de debito o credito, el bot no solicita datos de tarjeta por chat. Informa que el pago se realiza "Contra Entrega con POS inalámbrico  al momento de recibir o recoger su pedido" y confirma: "¡Excelente! Pago con tarjeta POS contra entrega anotado. En un breve momento un asesor validará tu orden para prepararla ".
- Estado en el Mockup: La tiene.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` y `fuente/Main.dc.html`, la opcion de tarjeta figura como medio de cobro al recibir.
- Por que importa para una cafeteria: Garantiza cumplimiento de normativas de seguridad bancaria y permite cobrar en puerta con datafono movil Izipay o Niubiz.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

##### Regla 2.7.4: Confirmacion Previa Obligatoria Antes del Cobro
- Nombre de funcion / Ubicacion en bot: `SYSTEM_PROMPT` (Fase 4 en `bot/prompt.py`) y `get_ai_response` (en `bot/bot_wa.py`).
- Que hace en el bot: Esta estrictamente prohibido enviar cuentas bancarias o solicitar comprobantes de pago antes de que el cliente haya dado su confirmacion expresa del resumen ("Si", "conforme", "ok", "proceder", "enviamelo"). Primero se envía el resumen total mediante `calcular_total_pedido`, se espera la conformidad del cliente y recien entonces se habilitan los datos de pago.
- Estado en el Mockup: La tiene a medias.
- Donde esta en el mockup / acta: En `fuente/Chatbot.dc.html`, el flujo avanza de forma forzada boton por boton sin un resumen estructurado previo a las opciones de pago.
- Por que importa para una cafeteria: Evita transferencias erradas de dinero antes de que el cliente valide si pidio el tamaño, sabor o direccion correctos.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

---

#### 2.8. COMPROBANTES CON VISION ARTIFICIAL Y RECEPCION FORMAL

##### Regla 2.8.1: Extraccion Optica con IA de Datos del Voucher
- Nombre de funcion / Ubicacion en bot: `get_ai_response` (bloque `is_photo` en `bot/bot_wa.py`), `get_whatsapp_media_bytes` y `upload_whatsapp_media`.
- Que hace en el bot: Al recibir una imagen en el webhook, el bot descarga el binario desde Meta API, lo convierte a base64 y lo envia a OpenAI `gpt-4o-mini` con instrucciones de vision artificial:
  1. Identifica si es un comprobante de pago (Yape, Plin, BCP, Interbank, BBVA, etc.).
  2. Lee y extrae tres datos obligatorios: MONTO (S/ ...), NUMERO / CODIGO DE OPERACION y FECHA / HORA exacta de la transaccion.
  3. Si la imagen es una captura de la carta/menu, identifica el producto y consulta variantes.
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` el cajero puede visualizar la imagen subida en `payImg` y tipear la referencia `payRef`, pero no hay procesamiento optico ni vision con IA. En `fuente/flujo-de-pedidos.md` se documento que la verificacion final la realiza el humano.
- Por que importa para una cafeteria: Elimina la digitacion manual del cajero y detecta en segundos si el monto transferido coincide con la comanda.
- Clasificacion: CONFIRMADO en el codigo (`bot_wa.py`).
- Prioridad: Alta.

##### Regla 2.8.2: Mensaje Fijo de Recepcion de Voucher y Prohibicion de Auto-Aprobacion
- Nombre de funcion / Ubicacion en bot: `get_ai_response` (en `bot/bot_wa.py`) y `SYSTEM_PROMPT` (en `bot/prompt.py`).
- Que hace en el bot: El bot tiene terminantemente prohibido dar por aprobado un pedido o prometer tiempos de entrega por su cuenta tras ver el voucher. Su respuesta debe ser exactamente esta plantilla formal:
  "¡Pedido registrado!  Hemos recibido su comprobante por S/ {monto} (Op. {num_operacion}). Estamos enviando su orden al área encargada para su validación. Denos un momento por favor ".
  Regla de oro: Prohibido decir "tu pedido esta en proceso" o "llegara en 30 a 45 minutos" sin autorizacion humana de cocina.
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: En `fuente/Chatbot.dc.html`, al marcar un pago simplemente simula que el pedido paso a confirmacion de asesor.
- Por que importa para una cafeteria: Evita fraudes con comprobantes falsos, montos incompletos o vouchers de fechas anteriores antes de que el dinero este verificado en la cuenta del negocio.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

---

#### 2.9. APROBACION Y RECHAZO DE PEDIDOS POR COCINA Y ADMINISTRACION

##### Regla 2.9.1: Generacion del Ticket de Cocina sin Placeholders
- Nombre de funcion / Ubicacion en bot: `generate_kitchen_ticket` (en `bot/bot_wa.py`).
- Que hace en el bot: Compila toda la conversacion del usuario y solicita a `gpt-4o-mini` generar el ticket de cocina estandarizado con el formato exacto:
  - Linea 1: [Nombre y Apellido]
  - Linea 2: [Numero de Celular]
  - Modalidad: Delivery / Recojo en Tienda / Consumo en el Local
  - Ubicacion: Enlace de Google Maps con coordenadas o "Atencion en Tienda / Salon"
  - Pedido: Lista de productos con cantidades y personalizaciones
  - Total: Monto total cobrado
  - Forma de pago: Medio utilizado (con cuanto cancela en efectivo o si es POS)
  - N° de Operacion: Codigo extraido del voucher o "N/A"
  - Fecha/Hora del Pago: Fecha extraida del comprobante o "N/A"
  Condicion critica: Prohibido incluir identificadores inventados (#Pedido). Guarda el resultado en `latest_order_summaries[phone]` para su copia directa en el punto de venta (POS).
- Estado en el Mockup: La tiene.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` (vista `ticket` de cocina y KDS). En el Acta 02 (`01:48:00`), se detalla el formato del ticket impreso en termica.
- Por que importa para una cafeteria: Es la comanda fisica que se pega al empaque o vaso para despacho y produccion sin errores.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

##### Regla 2.9.2: Notificacion a Administracion con Botones Interactivos de Decision
- Nombre de funcion / Ubicacion en bot: `send_admin_order_notification_with_buttons` y `handle_admin_order_action_wa` (en `bot/bot_wa.py`).
- Que hace en el bot: Despacha una alerta interactiva a los numeros de cocina/administracion (`ADMIN_WHATSAPP_NUMBERS`, por defecto `51977503006`) con la imagen del voucher y 2 botones rapidos:
  - Boton `approve_{phone}`: "Aprobar Pedido"
  - Boton `reject_{phone}`: "Rechazar"
  Si la API de Meta no soporta botones en el dispositivo del admin, envia el texto estructurado de respaldo. Si es delivery, adjunta un mensaje adicional con el enlace satelital de Google Maps.
- Estado en el Mockup: La tiene a medias.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` existe el modal de confirmacion con botones de Aceptar y Rechazar dentro del navegador web. Sin embargo, no existe la integracion de administracion y aprobacion remota via WhatsApp con botones táctiles.
- Por que importa para una cafeteria: Permite al dueño o jefe de cocina autorizar o rechazar comandas directamente desde su celular personal sin estar frente a una computadora.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

##### Regla 2.9.3: Accion de Aprobacion y Disparo de Confirmacion Oficial al Cliente
- Nombre de funcion / Ubicacion en bot: `handle_admin_order_action_wa` (bloque `action == "approve"` en `bot/bot_wa.py`).
- Que hace en el bot: Cuando el administrador pulsa "Aprobar Pedido":
  1. Incrementa el contador de compras en `clientes.json` mediante `increment_approved_order_count(customer_phone)`.
  2. Remueve al cliente de `pending_validation_users_wa` y limpia alertas en `requires_worker_chats`.
  3. Añade el telefono a `recently_approved_chats`.
  4. Envia el mensaje oficial de confirmacion por WhatsApp al cliente:
     - Si es Recojo en Tienda o Salon: "Gracias \n\nSu pedido ha sido aceptado con éxito . Le avisaremos por aquí cuando su pedido esté listo para su recojo . ¡Muchas gracias por su preferencia! ".
     - Si es Delivery: "Gracias  \n\nEn un plazo aprox a {tiempo_estimado} estará llegando su pedido , por favor este atent@ que el Delivery le anticipará su llegada vía WhatsApp o llamada".
  5. Envia confirmacion al administrador informando el numero historico de pedidos de este cliente.
- Estado en el Mockup: La tiene a medias.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` el pedido pasa de estado `nuevo` a `cola`. No emite el mensaje automatico de confirmacion de WhatsApp al comensal con el calculo del tiempo estimado.
- Por que importa para una cafeteria: Cierra el ciclo de venta informando al cliente que su dinero ya fue verificado y su comida esta en preparacion.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

##### Regla 2.9.4: Accion de Rechazo por Pago Invalido
- Nombre de funcion / Ubicacion en bot: `handle_admin_order_action_wa` (bloque `action == "reject"` en `bot/bot_wa.py`).
- Que hace en el bot: Cuando el administrador pulsa "Rechazar":
  1. Remueve el bloqueo de `pending_validation_users_wa`.
  2. Envia al cliente el mensaje formal: "Hola, lamentablemente hemos encontrado un problema con la validación de su pago (el monto no coincide o no se pudo verificar). Por favor, revise e intente enviar el comprobante correcto nuevamente .".
  3. Confirma al administrador que el aviso fue enviado.
- Estado en el Mockup: La tiene a medias.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` existe el estado `rechazado`. No existe el disparo automatico del mensaje al cliente solicitando la subsanacion del comprobante.
- Por que importa para una cafeteria: Da una segunda oportunidad al comensal que transfirio un monto incompleto o se equivoco de voucher sin perder la transaccion de forma definitiva.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

---

#### 2.10. DEBOUNCER Y CONSOLIDACION DE MENSAJES CONSECUTIVOS

##### Regla 2.10.1: Temporizador de Debounce Asincrono
- Nombre de funcion / Ubicacion en bot: `DEBOUNCE_DELAY = 2.0`, `add_to_user_buffer_wa` y `process_debounced_messages_wa` (en `bot/bot_wa.py`).
- Que hace en el bot: Gestiona el comportamiento de usuarios que escriben en fragmentos sucesivos (ej. "hola", "un frappe", "de lucuma", "para delivery"). Al recibir un mensaje, `add_to_user_buffer_wa` lo encola en memoria en `wa_user_buffers[from_phone]`. Si existia una tarea de debounce activa, la cancela (`task.cancel()`) y programa una nueva tarea que duerme 2.0 segundos (`await asyncio.sleep(DEBOUNCE_DELAY)`). Solo cuando el cliente deja de escribir por mas de 2 segundos, se ejecuta `process_debounced_messages_wa`, concatenando todos los textos con saltos de linea en una sola llamada consolidada a OpenAI. (Nota: En `bot.py` de Telegram el temporizador es de 10 segundos).
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: `fuente/Chatbot.dc.html` responde instantaneamente ante cada pulsacion de boton web; no simula la concurrencia ni las rafagas de texto fragmentado.
- Por que importa para una cafeteria: Reduce en mas de un 60% el costo de tokens de OpenAI al no responder cada palabra por separado y evita que el robot interrumpa al cliente a la mitad de su frase.
- Clasificacion: CONFIRMADO en el codigo (`bot_wa.py`).
- Prioridad: Alta.

---

#### 2.11. PAUSA, HANDOFF Y ESTADOS OPERATIVOS

##### Regla 2.11.1: Pausa Automatica y Traslado a "Requiere Atencion"
- Nombre de funcion / Ubicacion en bot: `check_and_send_ticket_to_whatsapp_admin`, `is_order_ready_for_ticket`, diccionario `requires_worker_chats` y conjunto `pending_validation_users_wa` (en `bot/bot_wa.py`).
- Que hace en el bot: El bot se silencia y se pausa bajo las siguientes condiciones:
  1. Deteccion de pedido completo o comprobante enviado (`is_order_ready_for_ticket` detecta frases como "asesor lo validara", "recibi tu comprobante", "vuelto exacto", "pos contra entrega", etc.).
  2. El cliente consulta sobre la demora de su pedido en RestaurantPE (`is_status_query`).
  3. Falla critica de conexion o agotamiento de saldo en OpenAI (Error 429).
  Al activarse: ingresa el telefono a `pending_validation_users_wa` y a `requires_worker_chats`. En `process_debounced_messages_wa`, si el usuario esta en este conjunto, el bot imprime en log "El bot no responderá porque su pedido está pendiente" y no emite ningun mensaje, permitiendo la intervencion humana limpia.
- Estado en el Mockup: La tiene a medias.
- Donde esta en el mockup / acta: En `fuente/Chatbot.dc.html` existe el boton "Hablar con asesor" que emite `SYS = 'SE REQUIERE ATENCIÓN'` y pasa a humano. En `fuente/Admin.dc.html` existe la pestaña de pedidos pendientes. No se implementa la logica de supresion de respuestas en el bot ante eventos de pago. En el Acta 02 (`02:07:02`), Kevin detalla el punto rojo "Se requiere atencion".
- Por que importa para una cafeteria: Impide que el asistente virtual colisione con el cajero o administrador cuando este ultimo toma el control del chat para coordinar el envio.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

##### Regla 2.11.2: Timeout por Inactividad de 3 Horas y Desbloqueo Automatico
- Nombre de funcion / Ubicacion en bot: `SESSION_TIMEOUT_HOURS = 3`, `SESSION_TIMEOUT_SECONDS = 10800`, evaluado en `get_ai_response` y `process_debounced_messages_wa` (en `bot/bot_wa.py`).
- Que hace en el bot: Si transcurren mas de 10,800 segundos (3 horas) desde el ultimo mensaje del cliente:
  - Elimina la sesion conversacional de `user_sessions` para resetear el contexto.
  - Elimina el bloqueo de `pending_validation_users_wa` y `requires_worker_chats`.
  - REGLA CRITICA: NO borra `user_gps` ni los datos del cliente, preservando la ubicacion domiciliaria para compras futuras.
  - Si un usuario quedo pausado y escribe despues de 3 horas, el bot despierta automaticamente sin dejarlo en el limbo.
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: No existe expiracion de sesion por reloj ni desbloqueo por inactividad en los mockups.
- Por que importa para una cafeteria: Si un cliente que compro ayer escribe hoy para un nuevo pedido, no debe encontrar al bot mudo debido a la sesion del dia previo.
- Clasificacion: CONFIRMADO en el codigo (`bot_wa.py`).
- Prioridad: Alta.

##### Regla 2.11.3: Tarea Nocturna de Medianoche (Auto-Resume Diario)
- Nombre de funcion / Ubicacion en bot: `midnight_auto_resume_task` (en `bot/bot_wa.py`).
- Que hace en el bot: Tarea asincrona en segundo plano que calcula los segundos restantes hasta las 00:00:05 horas de Lima (`America/Lima`). Cada medianoche ejecuta una purga general:
  - Vacia `pending_validation_users_wa.clear()`.
  - Vacia `requires_worker_chats.clear()`.
  - Vacia `waiting_order_query_users.clear()`.
  - Persiste el estado limpio en `save_user_sessions()` y `save_chat_history()`.
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: No existe reseteo automatico por cron en los mockups.
- Por que importa para una cafeteria: Garantiza que cada jornada comercial inicie a cero, sin chats bloqueados ni alertas rezagadas del dia anterior.
- Clasificacion: CONFIRMADO en el codigo (`bot_wa.py`).
- Prioridad: Media.

---

#### 2.12. MODO ALTA DEMANDA

##### Regla 2.12.1: Conmutador de Tiempo Estimado Dinamico
- Nombre de funcion / Ubicacion en bot: `alta_demanda_mode`, `get_tiempo_estimado_str`, `get_tiempo_estimado_texto`, y directiva en `get_ai_response` (en `bot/bot_wa.py`).
- Que hace en el bot: Conmutador global que altera los tiempos de entrega comunicados por el bot:
  - Modo Normal (`alta_demanda_mode = False`): Tiempo de entrega de 30 a 45 minutos ("30 - 45 mnts.").
  - Modo Alta Demanda (`alta_demanda_mode = True`): Tiempo de entrega se eleva a 50 a 60 minutos ("50 - 60 mnts."). La IA recibe la directiva de informar este retraso si el cliente consulta por demoras o al confirmar el despacho.
- Estado en el Mockup: La tiene.
- Donde esta en el mockup / acta: En `fuente/Admin.dc.html` y `fuente/Main.dc.html` existe el switch de configuracion `altaDem` que añade minutos extra. En `fuente/Chatbot.dc.html` existe la simulacion con el chip "Alta demanda". En el Acta 02 (`02:09:18`), Kevin solicita encender alta demanda cuando la cocina este saturada.
- Por que importa para una cafeteria: Sincroniza las expectativas del comensal en horas punta, mitigando reclamos y cancelaciones por demoras en cocina.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

---

#### 2.13. NOTAS DE VOZ (AUDIOS) Y TRANSCRIPCION

##### Regla 2.13.1: Transcripcion Automatica con Whisper
- Nombre de funcion / Ubicacion en bot: `transcribe_audio_bytes` y en el webhook bloque `msg_type in ["audio", "voice"]` (en `bot/bot_wa.py`).
- Que hace en el bot: Al llegar un mensaje de voz o audio de WhatsApp:
  1. Descarga el archivo de audio (.ogg) desde Meta API.
  2. Lo remite a la API de OpenAI con el modelo `whisper-1` indicando idioma español (`language="es"`).
  3. Si la transcripcion es exitosa, inyecta el texto transcrito directamente al buffer de debouncing del cliente (`add_to_user_buffer_wa`), procesando el pedido como si hubiera sido escrito.
  4. Si la calidad del audio es inaudible o falla la transcripcion, inyecta la directiva de sistema: "El cliente envió un mensaje de voz pero la calidad no permitió transcribirlo con precisión. Pídele amablemente si puede escribir su pedido o consulta por mensaje de texto".
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: No existe soporte para recepcion de audios ni transcripcion por voz en los prototipos.
- Por que importa para una cafeteria: En el mercado peruano, una proporcion significativa de clientes realiza pedidos mientras camina o conduce enviando audios de WhatsApp.
- Clasificacion: CONFIRMADO en el codigo (`bot_wa.py`).
- Prioridad: Media.

---

#### 2.14. MANEJO DE ERRORES Y ROBUSTEZ OPERATIVA

##### Regla 2.14.1: Alerta y Rescate ante Saldo Agotado de OpenAI (Error 429)
- Nombre de funcion / Ubicacion en bot: `get_ai_response` (bloque de excepcion en `bot/bot_wa.py`).
- Que hace en el bot: Captura excepciones de OpenAI. Si el error contiene "429", "insufficient_quota", "credit_balance_exhausted" o "quota":
  1. Emite log critico: "SALDO DE OPENAI AGOTADO (ERROR 429)".
  2. Registra el chat en `requires_worker_chats[session_id] = "Asistencia humana requerida (Saldo agotado OpenAI)"`.
  3. Pausa el bot agregando el usuario a `pending_validation_users_wa`.
  4. Dispara una notificacion de emergencia por WhatsApp a los administradores: "ALERTA CRÍTICA CAPRICHOS BOT: El saldo de OpenAI API se ha agotado (Error 429). Por favor recargar créditos en OpenAI Platform. El bot está derivando a asesor humano.".
  5. Responde al cliente de forma amable: "¡Hola! En este momento estamos atendiendo con un asesor humano . Por favor déjanos tu consulta o pedido y te responderemos a la brevedad posible .".
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: En el Acta 02 (`00:01:20`), Kevin narra el incidente critico ocurrido en el pasado cuando el bot colapso por falta de saldo y dejo de responder clientes.
- Por que importa para una cafeteria: Evita la muerte silenciosa del canal de ventas cuando se vencen los creditos de la API.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

##### Regla 2.14.2: Sanitizacion de Historial Conversacional y Recuperacion de Error 400
- Nombre de funcion / Ubicacion en bot: `sanitize_messages_for_openai` y bloque de recuperacion en `get_ai_response` (en `bot/bot_wa.py`).
- Que hace en el bot:
  - Elimina mensajes de rol `tool` huerfanos que no cuenten con un mensaje previo de `assistant` con su correspondiente `tool_calls`.
  - Si un `assistant` tiene llamadas a herramientas incompletas, lo convierte a texto normal.
  - Si OpenAI arroja error de contexto invalido (Error 400), la funcion ejecuta un reintento automatico ("fallback") enviando solo el System Prompt y el mensaje actual del cliente para recuperar la comunicacion sin interrumpir la experiencia.
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: No aplica a los mockups estaticos.
- Por que importa para una cafeteria: Elimina caidas tecnicas del bot causadas por mensajes malformados o llamadas interrumpidas.
- Clasificacion: CONFIRMADO en el codigo (`bot_wa.py`).
- Prioridad: Media.

##### Regla 2.14.3: Manejo de Politica de Ventana de 24 Horas de Meta
- Nombre de funcion / Ubicacion en bot: `parse_meta_error` (en `bot/bot_wa.py`).
- Que hace en el bot: Si Meta rechaza el envio con codigo 131047 ("24 hours", "re-engagement"), la funcion traduce el error tecnico a una instruccion clara para el personal: "No se puede enviar el mensaje: Han transcurrido más de 24 horas desde el último mensaje de la clienta (Política estricta de ventana de 24h de Meta). Para responderle, debes escribirle directamente desde el WhatsApp de la tienda". Asimismo maneja codigos de identificadores BSUID internos de Meta (131009/100) y telefonos no activos (131026).
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: No existe en los mockups.
- Por que importa para una cafeteria: Evita confusiones operativas en los operadores que intentan responder a un cliente desde el panel web tras un dia de inactividad.
- Clasificacion: CONFIRMADO en el codigo (`bot_wa.py`).
- Prioridad: Media.

##### Regla 2.14.4: Persistencia Atomica en Disco
- Nombre de funcion / Ubicacion en bot: `atomic_json_dump` (en `bot/bot_wa.py`).
- Que hace en el bot: Guarda todos los archivos JSON (`clientes.json`, `chat_history.json`, `user_sessions.json`) escribiendo primero en un archivo temporal (`.tmp`) y realizando un reemplazo atomico con `os.replace` o `shutil.move`.
- Estado en el Mockup: No la tiene (usa `localStorage` directo en navegador).
- Donde esta en el mockup / acta: No existe en el mockup.
- Por que importa para una cafeteria: Previene la corrupcion catastrofica de la base de clientes y pedidos ante un corte de energia o reinicio del servidor durante el guardado.
- Clasificacion: CONFIRMADO en el codigo (`bot_wa.py`).
- Prioridad: Media.

---

#### 2.15. RECORDATORIOS Y AVISOS DE CONTINGENCIA

##### Regla 2.15.1: Aviso Especial de Contingencia (Corte de Luz)
- Nombre de funcion / Ubicacion en bot: `is_special_notice_active`, `load_special_notice_notified`, `save_special_notice_notified`, y `process_debounced_messages_wa` (en `bot/bot_wa.py`).
- Que hace en el bot: Para fechas con incidencias operativas mayores (`SPECIAL_NOTICE_DATE = "2026-09-08"`), el bot intercepta el primer mensaje entrante de cualquier cliente y le envia una unica vez una imagen informativa y el mensaje:
  "Aviso importante: El día de hoy no podremos brindar atención debido a un corte de energía eléctrica en nuestro local. Lamentamos mucho los inconvenientes y agradecemos su comprensión. Caprichos Cafetería Artesanal".
  Guarda el usuario en `special_notice_notified.json` y se mantiene en silencio absoluto ante cualquier mensaje posterior de ese cliente durante el resto del dia.
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: No existe en el mockup.
- Por que importa para una cafeteria: Automatiza la gestion de emergencias o desastres urbanos sin colapsar las lineas telefonicas.
- Clasificacion: CONFIRMADO en el codigo (`bot_wa.py`).
- Prioridad: Baja.

---

#### 2.16. SEGUIMIENTO POSVENTA

##### Regla 2.16.1: Encuesta de Posventa a las 2 Horas
- Nombre de funcion / Ubicacion en bot: No implementada en el codigo actual de `bot_wa.py`. Registrada en requerimientos de actas.
- Que hace segun requerimiento: En el Acta 02, Kevin establecio que exactamente 2 horas despues de la entrega del pedido, el bot debe enviar un mensaje de seguimiento por WhatsApp: "Hola, queremos saber si tu pedido llegó todo bien y está todo en orden". Si el cliente manifiesta conformidad, se le invita a calificar en Google Maps con incentivo; si manifiesta queja o disconformidad, se traslada de inmediato el chat a gerencia humana.
- Estado en el Mockup: No la tiene.
- Donde esta en el mockup / acta: Acta 02 (minuto `01:15:30` y documento `fuente/iniciativas-acta-02.md`, iniciativa D-35 y D-38).
- Por que importa para una cafeteria: Canaliza el feedback negativo en privado antes de que se publique una reseña dañina en redes sociales y fomenta el posicionamiento SEO en Google Maps.
- Clasificacion: CONFIRMADO en el acta; PENDIENTE tanto en el bot como en el mockup.
- Prioridad: Media.

---

### 3. REGLAS QUE FALTAN EN EL MOCKUP (PRIORIZADAS)

A partir del contraste exhaustivo entre el codigo real del bot y los archivos de prototipo (`fuente/Admin.dc.html`, `fuente/Main.dc.html` y `fuente/Chatbot.dc.html`), se identifican y clasifican las reglas de negocio indispensables que deben implementarse en el mockup para alcanzar paridad funcional con la operacion real de Caprichos:

#### 3.1. PRIORIDAD ALTA (CRITICAS PARA LA OPERACION Y CONVERSION)

1. **Interpretacion Semantica de "Cancelo con [Monto]" como Pago en Efectivo y Calculo de Vuelto:**
   - Hallazgo: En `bot/prompt.py` y `bot/bot_wa.py` (`get_ai_response`).
   - Brecha en mockup: En `fuente/Chatbot.dc.html`, no existe procesamiento de lenguaje natural. Si un usuario interactuara escribiendo "cancelo con 100", el sistema no sabria procesarlo.
   - Relevancia: Regla de oro nacional. "Cancelar" en Peru significa pagar. Un asistente sin esta regla arruina ventas anulando pedidos.

2. **Rechazo Estricto de Direcciones Escritas en Texto y Exigencia de GPS Satelital:**
   - Hallazgo: En `bot/bot_wa.py` (`process_incoming_msg_wa`, bloque `address_keywords`).
   - Brecha en mockup: `fuente/Main.dc.html` y `fuente/Chatbot.dc.html` admiten texto libre sin advertir la imprecision o ambigüedad territorial de Lima.
   - Relevancia: Garantiza que los motorizados tengan coordenadas exactas de Google Maps, evitando entregas fallidas o extravios en zonas no señalizadas.

3. **Motor de Poligonos Geoespaciales GeoJSON y Gestion de Cobertura:**
   - Hallazgo: En `geo_utils.py` y `bot/bot_wa.py` (`calculate_delivery_cost`).
   - Brecha en mockup: `fuente/Chatbot.dc.html` aplica una tarifa arbitraria plana de S/ 3.00, omitiendo las zonas reales Z2 (S/ 2), Z3 (S/ 3), Z4 (S/ 4), Z5 (S/ 5), Z7 (S/ 7) y la respuesta formal ante direcciones fuera de cobertura (`-1`) ofreciendo recojo en tienda.
   - Relevancia: Evita cobrar de menos o de mas por delivery en un distrito extenso con distintas pendientes geograficas.

4. **Matriz de Equivalencias y Restricciones del Combo Duo Compartir:**
   - Hallazgo: En `bot/prompt.py`, `bot/AGENTS.md` (Reglas 2 y 9) y Acta 02 (`00:37:31`).
   - Brecha en mockup: En `fuente/Main.dc.html` y `fuente/Admin.dc.html`, no se programa la logica condicional que permite elegir 2 donas o 2 galletas, pero restringe a 1 sola unidad si el cliente elige Carrot Cake, Keke Marmoleado, Empanada o Petit Pan.
   - Relevancia: Protege directamente el costo de receta del combo mas vendido de la cafeteria.

5. **Pausa Operativa Silenciosa y Timeout por Inactividad de 3 Horas:**
   - Hallazgo: En `bot/bot_wa.py` (`SESSION_TIMEOUT_HOURS = 3`, `pending_validation_users_wa`, `requires_worker_chats`).
   - Brecha en mockup: En `fuente/Chatbot.dc.html` no existe gestion de estados de sesion, despausa automatica ni reseteo nocturno.
   - Relevancia: Permite la intervencion limpia de un cajero humano sin colisionar con el robot y evita bloquear clientes recurrentes en dias posteriores.

6. **Notificacion y Aprobacion Remota por WhatsApp de Cocina/Admin con Botones Interactivos:**
   - Hallazgo: En `bot/bot_wa.py` (`send_admin_order_notification_with_buttons`, `handle_admin_order_action_wa`).
   - Brecha en mockup: `fuente/Admin.dc.html` solo permite aprobar desde la pantalla de la computadora, sin emitir el ticket con botones de aprobacion al WhatsApp del jefe de cocina ni enviar el WhatsApp de confirmacion de tiempo al cliente.
   - Relevancia: Permite a los administradores gestionar pedidos mientras se desplazan fuera de la estacion de caja.

#### 3.2. PRIORIDAD MEDIA (EXPERIENCIA DE USUARIO Y CALIDAD DE PRODUCCION)

7. **Recepcion Continua 24 Horas y Cero Spam de Horarios:**
   - Hallazgo: En `bot/bot_wa.py` (`contexto_horario`) y `bot/AGENTS.md` (Regla 1).
   - Brecha en mockup: Los mockups se limitan a mostrar un rotulo rigido de "Cerrado", sin habilitar la recepcion anticipada de pedidos para el turno de apertura a las 14:00 horas.
   - Relevancia: Captura ventas en horarios no laborables para su preparacion en la apertura.

8. **Advertencias Culinarias sobre Hielo, Textura y Consistencia en Frappes:**
   - Hallazgo: En `bot/AGENTS.md` (Regla 5).
   - Brecha en mockup: En `fuente/Main.dc.html` y `fuente/Chatbot.dc.html` no se alerta al comensal de que pedir "poco hielo" reduce el volumen del vaso o que "no tan helado" deja la bebida aguada.
   - Relevancia: Desactiva los reclamos mas recurrentes por falta de volumen o textura en frappes artesanales.

9. **Asimilacion de Precios Digitados a Tamaños de Bebida:**
   - Hallazgo: En `bot/AGENTS.md` (Regla 11) y `bot/prompt.py`.
   - Brecha en mockup: `fuente/Chatbot.dc.html` solo responde a clics en botones; no interpreta cuando un cliente escribe "14.50" o "16.50" como seleccion de tamaño.
   - Relevancia: Agiliza la compra conversacional para clientes que recuerdan el costo pero no el nombre comercial del vaso.

10. **Reutilizacion Conversacional de Ubicacion Anterior:**
    - Hallazgo: En `bot/bot_wa.py` (`get_ai_response`) y `bot/prompt.py` (Fase 2).
    - Brecha en mockup: `fuente/Chatbot.dc.html` solicita siempre seleccionar modalidad desde cero sin ofrecer "¿Deseas enviarlo a tu misma direccion anterior?".
    - Relevancia: Reduce a menos de 30 segundos el proceso de checkout en compras recurrentes.

11. **Mecanismo de Debouncer para Consolidacion de Mensajes:**
    - Hallazgo: En `bot/bot_wa.py` (`DEBOUNCE_DELAY = 2.0`).
    - Brecha en mockup: Ausente en el simulador de chat interactivo.
    - Relevancia: Vital para la arquitectura tecnica del backend conversacional real.

12. **Soporte de Transcripcion de Notas de Voz con Whisper:**
    - Hallazgo: En `bot/bot_wa.py` (`transcribe_audio_bytes`).
    - Brecha en mockup: Ningun componente de mockup soporta recepcion de audios.
    - Relevancia: Permite atender a comensales que se comunican exclusivamente por notas de voz.

13. **Encuesta Automatizada de Posventa a las 2 Horas:**
    - Hallazgo: Registrada en Acta 02 (`01:15:30`) e iniciativas del proyecto.
    - Brecha en mockup: No codificada en `fuente/Chatbot.dc.html` ni en `fuente/Admin.dc.html`.
    - Relevancia: Canaliza quejas de despacho y potencia opiniones favorables en Google Maps.

#### 3.3. PRIORIDAD BAJA (OPTIMIZACIONES SECUNDARIAS Y CONTINGENCIAS)

14. **Aviso Especial Automatizado de Contingencia por Corte de Energia:**
    - Hallazgo: En `bot/bot_wa.py` (`SPECIAL_NOTICE_DATE`, `special_notice_notified.json`).
    - Brecha en mockup: Ausente en los prototipos.
    - Relevancia: Permite silenciar el negocio y avisar con imagen en dias de emergencia sin requerir atencion manual mensaje por mensaje.

15. **Promocion Cumpleañero Exclusiva de Salon con Minishots:**
    - Hallazgo: En `bot/AGENTS.md` (Regla 2).
    - Brecha en mockup: No figura en los modulos de promociones de `fuente/Admin.dc.html`.
    - Relevancia: Accion comercial presencial para grupos en tienda.

---

INFORME LISTO

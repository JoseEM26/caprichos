---
id: ANA-CAP-052
tipo: analisis
titulo: "Informe de Autonomia del Negocio: Caprichos Cafeteria Artesanal"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, revision-cruzada-informes]
---

# Informe de Autonomia del Negocio: Caprichos Cafeteria Artesanal
**Enfoque:** Autonomia del dueno ("que el negocio no dependa del programador")  
**Fecha de evaluacion:** 18 de octubre de 2026  
**Ambito analizado:** Mockups en `fuente/Admin.dc.html`, `fuente/Main.dc.html`, `fuente/Chatbot.dc.html`, logica real en `bot/bot_wa.py` y `bot/geo_utils.py`, y documentacion en `docs/`.

---

## Resumen Ejecutivo

El objetivo estrategico del dueno de Caprichos es operar, ajustar precios, modificar politicas, cambiar fotos, coordinar horarios y lanzar promociones sin requerir intervencion tecnica continua de un desarrollador.

En el estado actual de la maqueta y el bot:
- **Aspectos parcialmente centralizados:** Datos basicos de contacto, redes sociales, horarios semanales, pedido minimo, envio gratis, cupones y categorias de carta estan almacenados bajo la clave `caprichos_carta_cfg_v1` en `localStorage` y cuentan con interfaces en `Admin.dc.html`.
- **Dependencias criticas del programador:** El logotipo del negocio, las coordenadas base del local, los poligonos geograficos de delivery, las recetas e insumos consumidos por venta, las plantillas de mensajes de WhatsApp, los textos de politica de privacidad y terminos legales, la tolerancia de reservas, los tiempos base de preparacion (13 min vs 30-45 min), la gestion de cuentas de trabajadores y la asignacion de areas de cocina estan cableados de forma fija en el codigo fuente.
- **Discordancias activas entre modulos:** El horario en texto visible (`horarioTexto`) no se actualiza al cambiar los dias de atencion; el chatbot desconoce las reglas de envio gratis y pedido minimo; y el bot real (`bot/bot_wa.py`) tiene numeros de telefono, nombres de titulares de pago y tiempos de entrega completamente distintos a los de la carta virtual y el panel administrativo.

---

## 1. Inventario Exhaustivo de Configuraciones, Datos y Reglas

A continuacion se audita cada uno de los 26 elementos solicitados. Para cada componente se detalla:
- (a) Donde vive hoy (archivo y palabra o constante exacta)
- (b) Si es administrable por el dueno (en que pantalla) o si esta fijo en codigo
- (c) Prioridad de independizacion (Alta, Media, Baja)
- (d) Hallazgos formales identificados con su respectivo identificador (D-01 a D-28)

---

### 1.1 Telefonos y WhatsApp
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html`: constante `INFO_DEFAULT.telefono` ('9XX XXX XXX') y `INFO_DEFAULT.whatsapp` ('51900000000').
  - `fuente/Main.dc.html`: constante `INFO_DEFAULT.telefono` y `INFO_DEFAULT.whatsapp`, inyectado en `aboutPhone` y `aboutWa`.
  - `fuente/Chatbot.dc.html`: constante `CINFO.telefono` ('9XX XXX XXX'); no enlaza la variable `whatsapp`.
  - `bot/bot_wa.py`: telefono de atencion '977503006' y '977 503 006' fijo en lineas 2031, 3070, 3974, 4080, 4270, 4276, 4294 y 4694.
- **(b) Administracion:** En el administrativo es editable en pantalla **Configuracion del local** (`mirest`), pestana **Contacto**. Sin embargo, en `bot/bot_wa.py` esta cableado en codigo python.
- **(c) Prioridad:** Alta.

> **Hallazgo D-01**  
> **Tipo:** Discordancia y fijo en codigo  
> **Donde esta cada lado:** En `fuente/Admin.dc.html` y `fuente/Main.dc.html` el WhatsApp del negocio se lee de `cfg.info.whatsapp` ('51900000000'), mientras que en `bot/bot_wa.py` esta escrito de forma fija como '977503006' y '977 503 006' en multiples funciones (por ejemplo en el comando manual `/pago` y en la interfaz de monitoreo).  
> **Por que importa:** Si el negocio cambia de linea telefonica o chip de WhatsApp Business, la carta web mostrara un numero y el bot enviara otro numero a los clientes en los comprobantes de pago.  
> **Prioridad:** Alta.  
> **Propuesta de arreglo:** Centralizar el telefono y WhatsApp en una unica variable compartida que el bot de Python y las vistas web consuman desde la misma fuente de configuracion.  
> **Estado:** CONFIRMADO. Cita en `bot/bot_wa.py`: `[V] Yape y Plin: 977503006`. Cita en `fuente/Admin.dc.html`: `whatsapp: '51900000000'`.

---

### 1.2 Direccion, Ubicacion del Local y Enlace de Mapa
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html`: constante `INFO_DEFAULT.direccion` ('Campoy, San Juan de Lurigancho, Lima'), `INFO_DEFAULT.referencia` ('Direccion exacta y referencia: por confirmar (ejemplo).') e `INFO_DEFAULT.mapa` ('https://www.google.com/maps/search/?api=1&query=Caprichos%20Campoy%20Lima').
  - `fuente/Main.dc.html`: propiedades `aboutAddr`, `aboutRef`, `aboutMap` derivadas de `INFO`.
  - `fuente/Chatbot.dc.html`: constante `CINFO.direccion`, `CINFO.referencia`, `CINFO.mapa` consumidas en la respuesta de la pregunta frecuente `d5`.
  - `bot/prompt.py` y `bot/bot_wa.py`: menciones textuales de "Campoy, San Juan de Lurigancho".
- **(b) Administracion:** Editable desde el administrativo en **Configuracion del local** (`mirest`), pestana **Ubicacion** (campos Direccion, Referencia y Enlace de Google Maps). En el bot de Python permanece como texto fijo.
- **(c) Prioridad:** Media.

> **Hallazgo D-02**  
> **Tipo:** Fijo en codigo  
> **Donde esta cada lado:** En `bot/prompt.py` y en respuestas fijas de `bot/bot_wa.py` la referencia urbana del local esta escrita directamente en el prompt del sistema ("Campoy, San Juan de Lurigancho"), sin consultar la configuracion de `mirest`.  
> **Por que importa:** Si el local cambia de sede o abre un segundo punto de atencion, el bot seguira asumiendo que opera unicamente en Campoy.  
> **Prioridad:** Media.  
> **Propuesta de arreglo:** Hacer que el prompt del bot y sus mensajes de bienvenida inyecten dinamicamente la direccion y referencia registradas en la configuracion del local.  
> **Estado:** CONFIRMADO. Cita en `bot/prompt.py`: `Campoy, San Juan de Lurigancho`. Cita en `fuente/Admin.dc.html`: `direccion: 'Campoy, San Juan de Lurigancho, Lima'`.

---

### 1.3 Coordenadas Geograficas del Local
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html`: constantes `HEAT_LOCAL = { lat: -12.0147, lng: -76.966 };` y `MP0 = { lat: -12.0147, lng: -76.966, z: 14... };`.
  - `fuente/Main.dc.html`: centrado de mapa en calculo de rutas relativas.
  - `bot/geo_utils.py`: lectura del archivo geoespacial `LIMITES_DELIVERY.geojson`.
- **(b) Administracion:** Fijo en el codigo. No existe ningun campo en la interfaz del administrativo para cambiar la latitud y longitud del local ni el centro del mapa de calor. Requiere programador.
- **(c) Prioridad:** Alta.

> **Hallazgo D-03**  
> **Tipo:** Fijo en codigo  
> **Donde esta cada lado:** En `fuente/Admin.dc.html` vive la constante `HEAT_LOCAL = { lat: -12.0147, lng: -76.966 };` y en el estado inicial `hm: { lat: -12.0147, lng: -76.966... }`. En la pantalla `mirest` no existe ningun campo para ingresar coordenadas numericas.  
> **Por que importa:** El mapa de calor de entregas, el calculo de anillos de kilometraje (0.5 km, 1 km, 2 km) y el calculo de distancias quedan fijos a un punto geografico rigido.  
> **Prioridad:** Alta.  
> **Propuesta de arreglo:** Anadir los campos de latitud y longitud del establecimiento dentro de la pestana Ubicacion de la configuracion del local y consumirlos en `HEAT_LOCAL` y `MP0`.  
> **Estado:** CONFIRMADO. Cita en `fuente/Admin.dc.html`: `const HEAT_LOCAL = { lat: -12.0147, lng: -76.966 };`.

---

### 1.4 Horarios de Atencion y Feriados
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html`: funcion `horarioOf`, constante `INFO_DEFAULT.horarioTexto` ('Todos los dias, de 2:00 pm a 10:00 pm'), manejador de dias `hDays` y lista de excepciones `hSpecials`.
  - `fuente/Main.dc.html`: evaluacion de apertura en vivo mediante `statusNow(horarioOf(INFO), new Date())` y lectura fija de `INFO.horarioTexto`.
  - `fuente/Chatbot.dc.html`: constante `HORARIO = horarioOf(CINFO)` y generador de horas de reserva `HORAS`.
  - `bot/bot_wa.py`: logica de verificacion horaria y mensajes automaticos.
- **(b) Administracion:** Los interruptores de cada dia (abierto/cerrado, hora abre y hora cierra) y las fechas especiales con motivo (cerrado o con otro horario) son editables desde **Configuracion del local** (`mirest`), pestana **Horario y fechas**.
- **(c) Prioridad:** Alta.

> **Hallazgo D-04**  
> **Tipo:** Discordancia  
> **Donde esta cada lado:** En `fuente/Admin.dc.html` existe `INFO_DEFAULT.horarioTexto = 'Todos los dias, de 2:00 pm a 10:00 pm'`, pero la lista de campos `INFO_CATS` de la pestana `horario` tiene `fields: []`. Al modificar los dias y horas en la maqueta, `INFO.horarioTexto` nunca se regenera ni se guarda. En `fuente/Main.dc.html`, el pie de pagina (`footerLine`) y los azulejos informativos (`infoTiles`) muestran `INFO.horarioTexto`.  
> **Por que importa:** El cliente ve en la cabecera "Cerrado hoy" (calculado dinamicamente), pero en el pie de pagina lee "Todos los dias, de 2:00 pm a 10:00 pm", generando confusion en feriados o dias con horario reducido.  
> **Prioridad:** Alta.  
> **Propuesta de arreglo:** Generar automaticamente la cadena descriptiva a partir de `schedText(hz)` al guardar los horarios en el administrativo, o permitir su edicion directa.  
> **Estado:** CONFIRMADO. Cita en `fuente/Admin.dc.html`: `{ id: 'horario', n: 'Horario y fechas', d: 'Horario de cada dia y fechas especiales', fields: [] }`. Cita en `fuente/Main.dc.html`: `footerLine: 'Horario: ' + INFO.horarioTexto`.

---

### 1.5 Logotipo, Iconos, Banner, Imagenes de Productos, Fotos de Novedades y Fondos
- **(a) Donde vive hoy:**
  - Logotipo: `fuente/Main.dc.html` y `fuente/Chatbot.dc.html` en la etiqueta `<img src="/_blob/6d6aa5696913688bb2235a49f1133c2a" alt="Caprichos">`.
  - Iconos del sistema: cadenas SVG en constante `ICONS` en `Admin.dc.html` y `Main.dc.html`.
  - Banner principal: constante `BANNER_DEF = { on: true, tag: 'CAPRICHOS DEL MES', title: 'Frappe Maracuya Tropical', sub: 'Nuevo este mes: pruebalo antes de que se acabe' };` en `Main.dc.html`.
  - Fotos de productos: diccionario `ID` con hashes blob en `Main.dc.html:839` e inyeccion en `cfg.photos[nombre]`.
  - Fotos de novedades: `cfg.news` administrado en `newsPublish`.
  - Fotos del local: diccionario `cfg.local` con 6 espacios (salon1, salon2, barra, fachada, terraza, detalle).
  - Imagen de carga: `fuente/Main.dc.html:49` fija al hash blob del logo.
- **(b) Administracion:**
  - Productos: Si es administrable en **Diseno de la carta** (`disenador`), accion `pickPhoto`.
  - Novedades: Si es administrable en **Novedades y publicidad** (`novedades`).
  - Fotos del local: Si es administrable en **Configuracion del local** (`mirest`), seccion **Fotos del local**.
  - Logotipo del negocio: Fijo en el codigo. No existe interfaz para subir o cambiar el logo. Necesita programador.
  - Imagen del Banner principal: En `disenador` solo se puede editar el texto del banner (`tag`, `title`, `sub`) y activarlo/desactivarlo; no permite subir imagen para el banner (recurre por defecto a `img('maracuya')`).
  - Iconos del sistema: Fijos en el codigo SVG.
- **(c) Prioridad:** Alta.

> **Hallazgo D-05**  
> **Tipo:** Fijo en codigo y hueco  
> **Donde esta cada lado:** En `fuente/Main.dc.html` y `fuente/Chatbot.dc.html` el logo del negocio esta fijo como `src="/_blob/6d6aa5696913688bb2235a49f1133c2a"`. En `fuente/Admin.dc.html` no existe ningun selector de archivo para cargar un nuevo isotipo o logotipo de la empresa.  
> **Por que importa:** Si la cafeteria renueva su identidad visual, redisenia su imagotipo o lanza una edicion conmemorativa, depende obligatoriamente de un programador para reemplazar el archivo blob en el repositorio.  
> **Prioridad:** Alta.  
> **Propuesta de arreglo:** Agregar un campo de subida de imagen para el logotipo en la seccion Datos del local del administrativo y almacenar la URL resultante en `cfg.info.logoUrl`.  
> **Estado:** CONFIRMADO. Cita en `fuente/Main.dc.html`: `<img src="/_blob/6d6aa5696913688bb2235a49f1133c2a" alt="Caprichos"`.

> **Hallazgo D-06**  
> **Tipo:** Hueco  
> **Donde esta cada lado:** En `fuente/Admin.dc.html` el objeto `dzBanner` (lineas de interfaz del disenador) solo vincula `tag`, `title` y `sub`. En `fuente/Main.dc.html` el hero consume `bn.img || img('maracuya')`.  
> **Por que importa:** El negocio puede cambiar el eslogan y titulo del banner del mes, pero no puede subir la foto del producto promocionado en el banner, mostrandose siempre la imagen predeterminada de maracuya.  
> **Prioridad:** Media.  
> **Propuesta de arreglo:** Anadir un boton de carga de imagen en el bloque Banner de publicidad de la pantalla Diseno de la carta.  
> **Estado:** CONFIRMADO. Cita en `fuente/Admin.dc.html`: `dzBanner: { on: dz.banner.on... tag: dz.banner.tag, title: dz.banner.title, sub: dz.banner.sub }`. Cita en `fuente/Main.dc.html`: `heroImg: bn.img || img('maracuya')`.

---

### 1.6 Paleta de Colores, Tipografias y Decoraciones Festivas
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html`: constante `PAL_DEFAULT` (paletas para ninguno, halloween, navidad, anonuevo, sanvalentin, madre, padre, patrias, ninos, aniversario), constante `FX` y pantalla de edicion `paleta`.
  - `fuente/Main.dc.html`: constantes `PAL_DEFAULT`, `FX`, funcion `palFor` y generador de estilos CSS `palVars`.
  - `fuente/Chatbot.dc.html`: estilos en linea con colores CSS duros (`#008069`, `#111B21`, `#FFFFFF`, `#0B6FB3`, `#54656F`).
- **(b) Administracion:**
  - Colores de la carta: Si es administrable en **Paleta de colores** (`paleta`) y se activa el tema festivo en **Diseno de la carta** (`disenador`).
  - Cobertura de la carta: Parcial. La pantalla de carga inicial (`fuente/Main.dc.html:48-51`) tiene colores fijos (`#FBF4EC`, `#F3E9DB`, `#E67929`, `#0B2C3E`) y el visor de historias (`vwBars`) tiene fondos negros fijos (`#0B0F12`).
  - Cobertura del chatbot: Nula. El simulador de WhatsApp no lee `palettes`, no aplica `palVars` y no cambia sus estilos segun la festividad activa.
  - Tipografias: Fijas en codigo (`Montserrat, sans-serif` y `Nunito, sans-serif`). No existe configurador tipografico.
  - Decoraciones festivas (glifos y frases): Fijas en codigo dentro del diccionario `FX` en `Admin.dc.html:2990` y `Main.dc.html:1135`. El dueno solo puede encender o apagar festividades preprogramadas, no crear festividades nuevas ni cambiar los saludos festivos.
- **(c) Prioridad:** Media.

> **Hallazgo D-07**  
> **Tipo:** Discordancia y hueco  
> **Donde esta cada lado:** En `fuente/Admin.dc.html` la pantalla `paleta` permite editar y publicar paletas de color hacia `cfg.palettes`, pero en `fuente/Chatbot.dc.html` no existe ninguna referencia a `palettes`, `palFor` ni variables CSS (`var(--accent)`).  
> **Por que importa:** Al activar una tematica especial (por ejemplo Navidad o Halloween), la carta virtual cambia sus acentos a rojo o morado, pero el chatbot de WhatsApp retiene colores genericos y elementos desvinculados de la campana.  
> **Prioridad:** Media.  
> **Propuesta de arreglo:** Homogeneizar los estilos del chatbot y sus burbujas interactivas para que consuman las variables de diseno activas en la configuracion compartida.  
> **Estado:** CONFIRMADO. Cita en `fuente/Chatbot.dc.html`: busqueda de `palettes` o `var(--accent)` devuelve cero coincidencias.

> **Hallazgo D-08**  
> **Tipo:** Fijo en codigo  
> **Donde esta cada lado:** En `fuente/Admin.dc.html:2990` y `fuente/Main.dc.html:1135` la constante `FX` define los mensajes festivos rigidos (por ejemplo: `¡Feliz Halloween! Dulces y travesuras en Caprichos` o `¡Feliz Navidad! Endulza la Nochebuena con Caprichos`) y sus glifos.  
> **Por que importa:** El negocio no puede adaptar el eslogan de campana ni agregar eventos locales propios (por ejemplo: Aniversario de San Juan de Lurigancho) sin solicitar cambios en el codigo.  
> **Prioridad:** Baja.  
> **Propuesta de arreglo:** Permitir que los textos y emoticonos de las festividades se editen desde la pestana de diseno en lugar de dejarlos congelados en la constante `FX`.  
> **Estado:** CONFIRMADO. Cita en `fuente/Main.dc.html`: `halloween: { n: 'Halloween', glyphs: ['[calabaza]', '[murcielago]', '[fantasma]', '[destellos]'], msg: '¡Feliz Halloween! Dulces y travesuras en Caprichos' ... }`.

---

### 1.7 Textos de Portada, Lema, Descripcion, Terminos y Condiciones, Politica de Privacidad, Textos del Chatbot y Plantillas de WhatsApp
- **(a) Donde vive hoy:**
  - Textos institucionales: `fuente/Admin.dc.html:2895` (`nombre`, `lema`, `zona`, `barrio`, `descripcion`).
  - Terminos y condiciones y Politica de privacidad: No existen en `Admin.dc.html`, `Main.dc.html` ni `Chatbot.dc.html`. Solo se mencionan como requerimiento en `docs/iniciativas-acta-02-evidencia.md:844` y `docs/BRD.md:170`.
  - Textos del Chatbot: Arreglo `DUDAS` en `fuente/Chatbot.dc.html:164-170` con preguntas fijas sobre lactosa, bebidas calientes y postres.
  - Plantillas de WhatsApp en el administrativo: Arreglo `QR` en `fuente/Admin.dc.html:4589` con los comandos `/listo`, `/recojo`, `/ubicacion`, `/pago`.
  - Plantillas de WhatsApp en el bot real: `bot/bot_wa.py:3061-3070` con textos divergentes para los mismos 4 comandos.
  - Mensaje de confirmacion web: `pcMsgOf` en `fuente/Admin.dc.html:2868`.
  - Mensaje de repartidor: `fuente/Admin.dc.html:3940`.
- **(b) Administracion:**
  - Portada, lema y descripcion: Si es administrable en **Configuracion del local** (`mirest`), pestana **Datos del local**.
  - Terminos y privacidad: Fijo/Inexistente. No hay pantalla ni campo de configuracion.
  - Textos de dudas frecuentes del chatbot: Fijos en el codigo de `Chatbot.dc.html`.
  - Plantillas de WhatsApp (`/listo`, `/recojo`, `/ubicacion`, `/pago`): Fijas en el codigo en ambos sistemas (`Admin.dc.html` y `bot_wa.py`).
  - Plantillas de posventa y encuesta: Inexistentes en el panel administrativo; fijas en `Chatbot.dc.html:230`.
- **(c) Prioridad:** Alta.

> **Hallazgo D-09**  
> **Tipo:** Hueco critico  
> **Donde esta cada lado:** El BRD (`docs/BRD.md:170`, `RN-CAP-045`) y las actas de descubrimiento (`docs/iniciativas-acta-02.md:795`) exigen que el registro de cuentas de clientes incluya aviso de privacidad, tratamiento de datos personales y terminos y condiciones. En `fuente/Admin.dc.html` y `fuente/Main.dc.html` no existe ningun formulario, enlace ni pantalla para redactar o consultar dicha politica.  
> **Por que importa:** Incumplimiento de la normativa peruana de proteccion de datos personales (Ley N° 29733) y desproteccion legal del negocio frente al almacenamiento de DNIs, telefonos y correos de clientes.  
> **Prioridad:** Alta.  
> **Propuesta de arreglo:** Crear una seccion "Legales y Privacidad" en el modulo de ajustes para ingresar los terminos y condiciones y la politica de privacidad, desplegandolos en el pie de pagina y en el modal de registro de la carta.  
> **Estado:** CONFIRMADO. Cita en `docs/iniciativas-acta-02.md`: `C-24 · Inclusion de aviso de privacidad y tratamiento de datos personales en el registro`. Cita en `fuente/Main.dc.html`: no existe mención a terminos ni politica de privacidad.

> **Hallazgo D-10**  
> **Tipo:** Discordancia y fijo en codigo  
> **Donde esta cada lado:** En `fuente/Admin.dc.html:4589` el comando `/listo` genera el texto `Tu pedido ya esta listo. Te avisamos cuando salga con el repartidor.`. En `bot/bot_wa.py:3064` el comando `/listo` genera `Gracias ... En un plazo aprox a {get_tiempo_estimado_str()} estara llegando su pedido...`. Ni el administrativo ni el bot permiten que el dueno edite estas respuestas rapidas desde una pantalla.  
> **Por que importa:** Los operadores de WhatsApp envian respuestas incoherentes segun si usan el panel web del bot o el administrativo de la cafeteria, y cualquier ajuste de redaccion exige editar archivos fuente.  
> **Prioridad:** Alta.  
> **Propuesta de arreglo:** Crear un gestor de plantillas de mensajeria de WhatsApp en el administrativo que guarde las respuestas en configuracion y las provea mediante API a ambos paneles.  
> **Estado:** CONFIRMADO. Cita en `fuente/Admin.dc.html`: `const QR = [ [ '/listo', 'Tu pedido ya está listo...' ] ]`. Cita en `bot/bot_wa.py`: `text = f"Gracias ... En un plazo aprox a {get_tiempo_estimado_str()} estará llegando su pedido..."`.

> **Hallazgo D-11**  
> **Tipo:** Fijo en codigo  
> **Donde esta cada lado:** En `fuente/Chatbot.dc.html:164-170` la constante `DUDAS` contiene preguntas y respuestas duras: "Soy intolerante a la lactosa" (menciona bebida de almendra a + s/ 2.50), "¿Que bebidas calientes tienen?" (lista tres opciones) y "¿Que postres hay hoy?" (lista Carrot Cake y galletas).  
> **Por que importa:** Si la cafeteria deja de ofrecer bebida de almendra o cambia el precio del adicional, o si los postres del dia cambian, el chatbot sigue ofreciendo productos desactualizados porque no existe pantalla administrativa para actualizar las preguntas frecuentes.  
> **Prioridad:** Media.  
> **Propuesta de arreglo:** Conectar las respuestas del chatbot a los datos reales de insumos y productos activos, o habilitar un editor de preguntas frecuentes en el administrativo.  
> **Estado:** CONFIRMADO. Cita en `fuente/Chatbot.dc.html`: `const DUDAS = [ { id: 'd1', n: 'Soy intolerante a la lactosa', a: 'Revisé lo que hay ahora: tenemos leche sin lactosa y bebida de almendra (+ s/ 2.50)...' } ]`.

---

### 1.8 Redes Sociales
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html:2899` en `INFO_DEFAULT`: `instagram`, `instagramNombre`, `facebook`, `tiktok`.
  - `fuente/Main.dc.html:1527`: consumo en arreglo `socials`.
- **(b) Administracion:** Si es administrable en **Configuracion del local** (`mirest`), pestana **Redes sociales**.
- **(c) Prioridad:** Baja.
- **Detalle de evaluacion:** Actualmente soporta unicamente tres redes fijas (Instagram, Facebook y TikTok). Si el negocio decide crear un canal de difusion de WhatsApp, cuenta de YouTube o perfil en Google Maps, no puede agregarlos como nueva red social sin modificar el codigo de `Main.dc.html`.

---

### 1.9 Cuentas de Yape, Plin y Bancarias
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html:2900` en `INFO_DEFAULT`: `yape: '9XX XXX XXX (ejemplo)'`, `plin: '9XX XXX XXX (ejemplo)'`, `cuenta: 'XXX-XXXXXXXXXX-X-XX (ejemplo)'`.
  - `fuente/Main.dc.html:1105`: funcion `payInfo()`.
  - `fuente/Chatbot.dc.html:162`: objeto `CINFO`.
  - `bot/bot_wa.py:3070`: texto duro en `/pago`: `[V] Yape y Plin: 977503006\n[V] A nombre de: María José Morillo Ruiz`.
- **(b) Administracion:** En el administrativo es editable en **Configuracion del local** (`mirest`), pestana **Pagos**. En el bot real de WhatsApp esta congelado en el codigo Python.
- **(c) Prioridad:** Alta.

> **Hallazgo D-12**  
> **Tipo:** Fijo en codigo y discordancia  
> **Donde esta cada lado:** En `bot/bot_wa.py:3070` el nombre del titular bancario (`María José Morillo Ruiz`) y el numero de Yape/Plin (`977503006`) estan grabados como cadena de texto estatica. En `fuente/Admin.dc.html` la pestana `pagos` solo permite editar `yape`, `plin` y `cuenta`, sin incluir un campo para el nombre del titular ni para el banco destino (BCP, Interbank, BBVA).  
> **Por que importa:** Si cambia el titular de la cuenta receptora o el numero corporativo de Yape, los clientes que piden por el bot de WhatsApp reciben datos bancarios desfasados, provocando transferencias fallidas o pagos a terceros no autorizados.  
> **Prioridad:** Alta.  
> **Propuesta de arreglo:** Ampliar la configuracion de pagos con campos estructurados para Entidad Bancaria, Nombre del Titular y Numero de Cuenta/CCI, e integrarlos a todas las plantillas del bot y la carta.  
> **Estado:** CONFIRMADO. Cita en `bot/bot_wa.py`: `[V] A nombre de: María José Morillo Ruiz`. Cita en `fuente/Admin.dc.html`: `fields: [ { k: 'yape', l: 'Número de Yape' }, { k: 'plin', l: 'Número de Plin' }, { k: 'cuenta', l: 'Cuenta para transferir' } ]`.

---

### 1.10 Medios de Pago Habilitados
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html:3590`: constante `PAGOS = [ 'Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta' ];` y en la caja `CJ_MEDIOS = [ 'Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta', 'Otros' ];`.
  - `fuente/Main.dc.html:1595, 1602`: selectores fijos de pago (`yape`, `plin`, `transf`, `tarj`, `efe`).
- **(b) Administracion:** Fijo en el codigo. El dueno no cuenta con casillas de activacion/desactivacion para apagar temporalmente un medio de pago (por ejemplo: si se malogra el POS de tarjetas o si se suspende la recepcion de efectivo por seguridad en turno nocturno). Requiere programador.
- **(c) Prioridad:** Alta.

> **Hallazgo D-13**  
> **Tipo:** Fijo en codigo  
> **Donde esta cada lado:** En `fuente/Admin.dc.html:3590` la lista `PAGOS` es fija, y en `fuente/Main.dc.html:1492` la cabecera reza `'PAGOS', v: 'Yape · Plin · Tarjeta · Efectivo'`.  
> **Por que importa:** Ante una caida del sistema de Yape/Plin o averia de terminales POS, el negocio no puede suspender esos medios en la carta web de forma inmediata.  
> **Prioridad:** Alta.  
> **Propuesta de arreglo:** Anadir una matriz de medios de pago en el administrativo con interruptores individuales (Activo / Inactivo) y mensajes de contingencia por medio.  
> **Estado:** CONFIRMADO. Cita en `fuente/Admin.dc.html`: `const PAGOS = [ 'Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta' ];`.

---

### 1.11 Tarifas y Zonas de Delivery y su Mapa Geografico
- **(a) Donde vive hoy:**
  - Tarifas por zona: `INFO_DEFAULT` en `fuente/Admin.dc.html:2900` (`tarZ2: '2'`, `tarZ3: '3'`, `tarZ4: '4'`, `tarZ5: '5'`, `tarZ7: '7'`).
  - Poligonos de las zonas (coordenadas GPS): constante `ZONAS_GEO` en `fuente/Main.dc.html:1108` y `fuente/Admin.dc.html:4499`.
  - Zonas en bot real: archivo geoespacial `bot/LIMITES_DELIVERY.geojson` procesado por `bot/geo_utils.py`.
- **(b) Administracion:**
  - Montos de las tarifas en soles: Si es administrable en **Configuracion del local** (`mirest`), pestana **Entrega** (`tarZ2`, `tarZ3`, etc.).
  - Poligonos geograficos y limites de cobertura: Fijos en el codigo de las maquetas y en un archivo GeoJSON independiente en el bot. El dueno no puede redibujar una zona, expandir la cobertura ni modificar los vertices de los poligonos desde el administrativo. Requiere programador.
- **(c) Prioridad:** Alta.

> **Hallazgo D-14**  
> **Tipo:** Fijo en codigo y discordancia  
> **Donde esta cada lado:** En `fuente/Main.dc.html:1108` los poligonos de reparto residen en la constante JavaScript `ZONAS_GEO` con cientos de coordenadas codificadas a mano. En el backend del bot (`bot/geo_utils.py`), las zonas se leen de `LIMITES_DELIVERY.geojson`. Si un poligono cambia en un lado, no se sincroniza con el otro, y ninguno es editable por el dueno.  
> **Por que importa:** Si una urbanizacion o calle cercana a Campoy solicita despacho o si se bloquea un acceso por obras, el negocio no puede ajustar su area de cobertura sin intervencion de un especialista en SIG o programador.  
> **Prioridad:** Alta.  
> **Propuesta de arreglo:** Almacenar el archivo de zonas como un GeoJSON centralizado en base de datos y ofrecer una herramienta visual en el administrativo para importar o editar poligonos.  
> **Estado:** CONFIRMADO. Cita en `fuente/Main.dc.html`: `const ZONAS_GEO = [{"z":"Z2","p":[[-12.01935,-76.97091]...]`. Cita en `bot/geo_utils.py`: `def calculate_delivery_cost(lat, lon, filepath="LIMITES_DELIVERY.geojson"):`.

---

### 1.12 Pedido Minimo y Envio Gratis
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html:2900` en `INFO_DEFAULT`: `envioGratis: '70'`, `pedidoMin: '14.50'`.
  - `fuente/Main.dc.html:1081`: `INFO.envioGratis`, `INFO.pedidoMin`, aplicados en las validaciones de checkout (`belowMin`, `contBg`).
  - `fuente/Chatbot.dc.html`: No contiene ninguna validacion ni mencion a pedido minimo ni envio gratis.
- **(b) Administracion:** Si es administrable en el administrativo en **Configuracion del local** (`mirest`), pestana **Entrega**.
- **(c) Prioridad:** Media.

> **Hallazgo D-15**  
> **Tipo:** Hueco  
> **Donde esta cada lado:** En `fuente/Main.dc.html:1591` se bloquea el boton de pedido si el subtotal no alcanza `INFO.pedidoMin` ('14.50'). En `fuente/Chatbot.dc.html`, el flujo de pedidos permite confirmar pedidos de cualquier monto inferior (por ejemplo una sola dona de s/ 4.00) sin validar monto minimo ni calcular el umbral de envio gratis.  
> **Por que importa:** Los clientes que utilicen el chatbot pueden emitir pedidos deficitarios para la operacion del delivery que luego deben ser cancelados o renegociados manualmente por el personal.  
> **Prioridad:** Media.  
> **Propuesta de arreglo:** Incorporar la regla de validacion de `pedidoMin` y la exoneracion de costo por `envioGratis` dentro de la maquina de estados de `Chatbot.dc.html`.  
> **Estado:** CONFIRMADO. Cita en `fuente/Main.dc.html`: `belowMin: belowMin, minText: 'Faltan ' + fmt(Number(INFO.pedidoMin) - t.sub)`. Cita en `fuente/Chatbot.dc.html`: `doneOrder(msgs)` no valida subtotales minimos.

---

### 1.13 Porcentajes (Personal, Cumpleanos, Puntos del Cliente)
- **(a) Donde vive hoy:**
  - Descuento del personal: `credLoad` en `Admin.dc.html:2969` (`pct: '25'`, `days: '15'`).
  - Descuento por cumpleanos: cupon `CUMPLE25` en `COUPONS_DEFAULT` (`Admin.dc.html:2920` y `Main.dc.html:1090`, valor '25' %).
  - Puntos de fidelidad de clientes: `Admin.dc.html:4711` (`este pedido suma ' + Math.floor(moTotal) + ' puntos al cobrarse'`).
- **(b) Administracion:**
  - Descuento del personal: Si es administrable en **Creditos del personal** (`creditos`), campo "Porcentaje de descuento".
  - Descuento por cumpleanos: Si es administrable en **Ofertas y descuentos** (`ofertas`), pestana **Cupones** (cupon `CUMPLE25`).
  - Tasa de acumulacion de puntos: Fijo en el codigo. La equivalencia de 1 sol = 1 punto esta codificada como `Math.floor(moTotal)` de forma rigida. No existe pantalla para modificar la razon de puntos ni reglas de vencimiento. Requiere programador.
- **(c) Prioridad:** Media.

> **Hallazgo D-16**  
> **Tipo:** Fijo en codigo  
> **Donde esta cada lado:** En `fuente/Admin.dc.html:4711` la acumulacion de puntos esta hardcodeada como `Math.floor(moTotal)` soles gastados. No existe parametro en el administrativo para configurar factores multiplicadores (ejemplo: 2x puntos los jueves o 1 punto por cada 5 soles).  
> **Por que importa:** Si la gerencia busca lanzar una campana de fidelizacion agresiva o ajustar el valor del punto para proteger el margen comercial, requiere un desarrollador para alterar el calculo matematico.  
> **Prioridad:** Media.  
> **Propuesta de arreglo:** Configurar la tasa de conversion de puntos (soles por punto y puntos por sol) dentro de las reglas comerciales del negocio.  
> **Estado:** CONFIRMADO. Cita en `fuente/Admin.dc.html`: `este pedido suma ' + Math.floor(moTotal) + ' puntos al cobrarse.'`.

---

### 1.14 Plazos de Credito
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html:2969`: constante por defecto `days: '15'` en `credLoad`.
  - Guardado en `writeCfg({ credit: this.state.credCfg })`.
- **(b) Administracion:** Si es administrable en el administrativo en pantalla **Creditos del personal** (`creditos`), campo "Dias de plazo para pagar".
- **(c) Prioridad:** Baja (Ya resuelto en el mockup).

---

### 1.15 Tiempos de Entrega y Meta de 13 Minutos
- **(a) Donde vive hoy:**
  - Promesa base de entrega: `fuente/Main.dc.html:1482` fijo en `'Entrega en unos 13 min'` y `fuente/Chatbot.dc.html:142` fijo en `(13 + (Number(h.extra) || 10))`.
  - Tiempos en bot real: `bot/bot_wa.py:667` fijo en `"50 - 60 mnts." if alta_demanda_mode else "30 - 45 mnts."`.
  - Meta de cocina e indicadores: `fuente/Admin.dc.html:3566` y cronometro de cocina fijo a 13 minutos.
- **(b) Administracion:**
  - El suplemento por "Alta demanda" (+10 min u otro valor) si se activa desde el administrativo en **Cocina** (`altaDem.extra`).
  - El tiempo base (los 13 minutos) y la meta de servicio estan completamente fijos en codigo. En el bot real los tiempos son fijos y totalmente diferentes (30 a 45 min). Requiere programador.
- **(c) Prioridad:** Alta.

> **Hallazgo D-17**  
> **Tipo:** Discordancia critica y fijo en codigo  
> **Donde esta cada lado:** En `fuente/Main.dc.html:1482` la promesa al cliente dice `Entrega en unos 13 min`. En `bot/bot_wa.py:668` la funcion `get_tiempo_estimado_str()` devuelve `30 - 45 mnts.` en modo normal y `50 - 60 mnts.` en alta demanda. En `fuente/Admin.dc.html` no existe ningun campo para fijar el tiempo de entrega base del local.  
> **Por que importa:** Existe una discordancia de mas del 200% entre lo que promete la carta web (13 min) y lo que informa el bot de WhatsApp (30 a 45 min). El dueno no puede ajustar estos compromisos en dias de lluvia o menor dotacion de motorizados.  
> **Prioridad:** Alta.  
> **Propuesta de arreglo:** Crear un ajuste parametrizable de "Tiempo promedio estimado de entrega" en minutos que alimente tanto a la carta web como a la logica del bot.  
> **Estado:** CONFIRMADO. Cita en `fuente/Main.dc.html`: `'Entrega en unos 13 min'`. Cita en `bot/bot_wa.py`: `return "50 - 60 mnts." if alta_demanda_mode else "30 - 45 mnts."`.

---

### 1.16 Tolerancia de Reserva
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html`: lineas 1810, 1817, 3185, 4031, 4604, 4606 (textos fijos de "15 minutos de tolerancia").
  - `fuente/Chatbot.dc.html:226`: texto fijo `Si se confirma, guardamos la mesa 15 minutos de tolerancia.`.
- **(b) Administracion:** Fijo en el codigo. No existe ningun parametro en la pantalla **Reservas** ni en **Configuracion del local** para cambiar los 15 minutos a 10 o 20 minutos. Requiere programador.
- **(c) Prioridad:** Media.

> **Hallazgo D-18**  
> **Tipo:** Fijo en codigo  
> **Donde esta cada lado:** En `fuente/Admin.dc.html` y `fuente/Chatbot.dc.html` la cifra `15 minutos de tolerancia` se repite como literal embebido en multiples mensajes y alertas de inasistencia.  
> **Por que importa:** Si en fines de semana de alta rotacion el dueno desea recortar la tolerancia a 10 minutos para liberar mesas antes, no puede hacerlo desde el panel administrativo.  
> **Prioridad:** Media.  
> **Propuesta de arreglo:** Parametrizar la tolerancia de reserva en minutos dentro de la configuracion de sala y reservas.  
> **Estado:** CONFIRMADO. Cita en `fuente/Chatbot.dc.html`: `guardamos la mesa 15 minutos de tolerancia`. Cita en `fuente/Admin.dc.html`: `La mesa queda marcada con R en el plano. Se guarda 15 minutos de tolerancia y luego se libera`.

---

### 1.17 Categorias y Orden de la Carta
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html:3115`: lista `CARTA_CATS`, orden guardado en `cfg.catOrder`.
  - `fuente/Main.dc.html:1443`: reordenamiento dinamico consumiendo `cfg.catOrder`.
  - Gestion de nombres de categorias: `Admin.dc.html:2520` en `LIST_DEFAULT.categorias`.
- **(b) Administracion:** Si es administrable en **Diseno de la carta** (`disenador`) para el orden visible, y en **Productos** (modal Gestionar listas) para anadir o renombrar categorias.
- **(c) Prioridad:** Baja (Confirmado como administrable).

---

### 1.18 Tamanos y Opciones
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html:2505`: funcion `opcLoad`, modal `opd` y persistencia en `writeCfg({ opciones: oc })`.
  - `fuente/Main.dc.html:947`: funcion `opcLoad` sincronizada mediante `localStorage`.
- **(b) Administracion:** Si es administrable en pantalla **Productos**, boton "Opciones y tamanos" de cada ficha de producto (permite configurar tamanos, grupos obligatorios, extras y precios diferenciales).
- **(c) Prioridad:** Baja (Confirmado como administrable).

---

### 1.19 Recetas, Insumos, Unidades y Proveedores
- **(a) Donde vive hoy:**
  - Proveedores: `fuente/Admin.dc.html:3780` persistido en `cfg.proveedores`.
  - Insumos y unidades: `fuente/Admin.dc.html:3782` persistido en `cfg.insumosCfg` y modal `icd` (Ficha de insumo).
  - Recetas e impresion de costos: constante `RECIPES` en `fuente/Admin.dc.html:2665` (solo 3 recetas de muestra: Frappe Oreo, Capuccino y Club Sandwich).
  - Descuento de stock por venta (logica de descargo): funcion `usageOf` en `fuente/Admin.dc.html:2656-2664`.
- **(b) Administracion:**
  - Proveedores, unidades de compra, factores de conversion y minimos de stock: Si es administrable en **Compras**, **Almacen** y **Stock y recetas**.
  - Recetas y reglas de consumo de insumos por producto: Fijo en el codigo. La funcion `usageOf` utiliza expresiones regulares cableadas (`/FRAPPE/.test`, `/CAPUCC/.test`, etc.) para deducir gramos de cafe, mililitros de leche o unidades de pan. No existe interfaz para que el dueno cree una receta nueva o altere las cantidades que se descuentan del kardex. Requiere programador.
- **(c) Prioridad:** Alta.

> **Hallazgo D-19**  
> **Tipo:** Fijo en codigo critico  
> **Donde esta cada lado:** En `fuente/Admin.dc.html:2656-2664` la deduccion automatica de insumos reside en la funcion `usageOf(it)` con reglas fijas en expresiones regulares: si el producto contiene "FRAPPE" resta `0.25 * q` de leche y `0.05 * q` de chantilly; si contiene "SANDWICH" resta `0.2` de bolsa de pan y `1` filete de pollo. Ademas, `const RECIPES` contiene solo 3 recetas fijas.  
> **Por que importa:** Si el barista ajusta la dosis de cafe de 18 g a 20 g, si se crea un nuevo producto en carta o si cambia la marca de los insumos, el inventario del almacen central se desfasara de inmediato a menos que un programador edite el script.  
> **Prioridad:** Alta.  
> **Propuesta de arreglo:** Implementar un modulo de Ingenieria de Recetas donde el dueno vincule a cada producto sus insumos componentes y cantidades de descuento directo.  
> **Estado:** CONFIRMADO. Cita en `fuente/Admin.dc.html`: `if (/FRAPPE/.test(n)) { u.push([leche, 0.25 * q], ['Galleta Oreo', /OREO/.test(n) ? 0.5 * q : 0]...`.

---

### 1.20 Mensajes de Error y Avisos
- **(a) Donde vive hoy:**
  - Errores de geolocalizacion del navegador: constante `GEO_ERR` en `fuente/Main.dc.html:1122`.
  - Advertencias operativas de personalizacion: `Main.dc.html:1581` (mensajes sobre "poco hielo" o "menos helado").
  - Avisos de fuera de cobertura: `Main.dc.html:1589` (`Tu ubicacion esta fuera de la zona de reparto...`).
  - Avisos del bot: `bot/bot_wa.py:2656` (`Recibi tu imagen pero hubo un problema al procesarla...`) y alerta 429 de OpenAI (`bot/bot_wa.py:1671`).
- **(b) Administracion:** Fijo en el codigo. Todos los textos de error, advertencias de insumos agotados y validaciones de campo estan incrustados como cadenas de texto en los controladores. Requiere programador.
- **(c) Prioridad:** Baja.

> **Hallazgo D-20**  
> **Tipo:** Fijo en codigo  
> **Donde esta cada lado:** En `fuente/Main.dc.html:1122` la constante `GEO_ERR` contiene literales rigidos para codigos de error de GPS (1: permiso denegado, 2: posicion no disponible, 3: tiempo expirado).  
> **Por que importa:** El negocio no puede suavizar los mensajes de rechazo de ubicacion ni orientar a los clientes con instrucciones especificas segun su distrito sin cambiar el codigo.  
> **Prioridad:** Baja.  
> **Propuesta de arreglo:** Mantener un catalogo de mensajes del sistema en un archivo de textos configurable.  
> **Estado:** CONFIRMADO. Cita en `fuente/Main.dc.html`: `const GEO_ERR = { 1: 'No fue posible conseguir la ubicación: no diste permiso...' }`.

---

### 1.21 Clave de Wi-Fi y Texto de Tickets y Etiquetas
- **(a) Donde vive hoy:**
  - Clave de Wi-Fi del establecimiento: Inexistente en todo el codigo de `Admin.dc.html`, `Main.dc.html` y `Chatbot.dc.html`. Solo se menciona como problema tecnico en `docs/iniciativas-acta-02.md:1042-1050`.
  - Configuracion de etiquetas: constante `lblCfgLoad` en `Admin.dc.html:2846` guardado en `cfg.etiq`.
  - Direcciones IP de impresoras de etiquetas: `LBL_PRINTER` en `Admin.dc.html:2848` (`192.168.1.210` a `.213`).
  - Texto al pie del ticket: `REGLAS_DEF.pie` en `Admin.dc.html:2937` (`Cupón no acumulable con otras promociones. Uno por compra.`).
- **(b) Administracion:**
  - Interruptores de etiquetas (pedido, area, vaso): Si es administrable en **Pedidos y caja** (`caja`), pestana **Etiquetas**.
  - Texto al pie del ticket: Si es administrable en **Ofertas y descuentos** (`ofertas`), pestana **Reglas**.
  - Clave de Wi-Fi: No administrable ni visible en ninguna pantalla. Fijo/Inexistente.
  - IPs y modelos de impresoras: Fijos en codigo en `LBL_PRINTER`. Requiere programador.
- **(c) Prioridad:** Media.

> **Hallazgo D-21**  
> **Tipo:** Hueco  
> **Donde esta cada lado:** En `docs/iniciativas-acta-02.md:1042` se discutio la necesidad de imprimir la clave de Wi-Fi para clientes en los comprobantes y no cambiar la clave del router por afectar las tablets de mozos. Sin embargo, en `fuente/Admin.dc.html` no existe ningun campo en la configuracion del local para registrar el SSID y la contrasena de Wi-Fi de clientes, ni se imprime en los tickets de muestra.  
> **Por que importa:** Los mozos y cajeros deben responder verbalmente cientos de veces al dia cual es la clave de Wi-Fi en salon, interrumpiendo la atencion.  
> **Prioridad:** Media.  
> **Propuesta de arreglo:** Anadir los campos "Red Wi-Fi de Clientes" y "Contrasena Wi-Fi" en la pantalla de configuracion del local e imprimirlos automaticamente al pie del ticket de comanda o precuenta.  
> **Estado:** CONFIRMADO. Cita en `docs/iniciativas-acta-02.md`: `Kevin sugiere implementar a futuro un servidor de autenticación de red...`. En `fuente/Admin.dc.html` la busqueda de `wifi` o `wi-fi` arroja 0 resultados.

---

### 1.22 Areas de Cocina y Pantallas TV
- **(a) Donde vive hoy:**
  - Mapeo de productos a areas: funcion `AREA_OF` en `Admin.dc.html:2785`.
  - Paleta de areas: `LBL_AREA` en `Admin.dc.html:2844` (`Bebidas`, `Salados`, `Postres`).
  - Titulos de areas: `kareaName` en `Admin.dc.html:4810`.
  - Pantallas TV vinculadas: pantalla `pantallas` en `Admin.dc.html:4761`.
- **(b) Administracion:**
  - Vinculacion y desvinculacion de TVs: Si es administrable en **Pantallas** (`pantallas`) mediante codigo de enlace de 6 caracteres.
  - Creacion, cambio o renombramiento de areas de produccion: Fijo en el codigo. `AREA_OF` clasifica de forma inmutable segun la categoria (`frappes` -> `Bebidas`; `salados` -> `Salados`; resto -> `Postres`). El acta y el registro de la maqueta (`docs/registro-mockup.md:87`) senalan la duda pendiente de Kevin sobre cambiar las areas a "Salados, Frios y Calientes". No existe pantalla para modificar estas areas. Requiere programador.
- **(c) Prioridad:** Alta.

> **Hallazgo D-22**  
> **Tipo:** Fijo en codigo  
> **Donde esta cada lado:** En `fuente/Admin.dc.html:2785` la funcion `AREA_OF` hardcodea las tres areas fijas `Bebidas`, `Salados` y `Postres`. En `docs/registro-mockup.md:87` se anota textualmente: "Por confirmar con Kevin: si las áreas son Salados, Fríos y Calientes en lugar de Bebidas, Salados y Postres".  
> **Por que importa:** Si Kevin decide separar la barra fria de la estacion caliente, las comandas y pantallas KDS no se adaptan y continuaran enviando los productos a los tres destinos rigidos de fabricacion.  
> **Prioridad:** Alta.  
> **Propuesta de arreglo:** Permitir que las areas de preparacion del KDS y etiqueteras sean administrables como una lista editable vinculable a las categorias de la carta.  
> **Estado:** CONFIRMADO. Cita en `fuente/Admin.dc.html`: `const AREA_OF = (name) => { ... return (c === 'frappes' || c === 'iced' || c === 'calientes' || c === 'frozen') ? 'Bebidas' : ((c === 'salados' || c === 'croissants') ? 'Salados' : 'Postres'); };`.

---

### 1.23 Nombres de Roles y Permisos
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html:3170-3179` en la constante `ROLES` (roles: `admin`, `cajero`, `cocina`, `mozo`, `callcenter`, `almacen`, `produccion`, `repartidor`).
- **(b) Administracion:** Fijo en el codigo. Las vistas asignadas a cada perfil (`views`), el permiso de gestion global (`manage: true/false`) y la pantalla inicial (`home`) estan sellados en la constante `ROLES`. No existe interfaz de roles y permisos. Requiere programador.
- **(c) Prioridad:** Media.

> **Hallazgo D-23**  
> **Tipo:** Fijo en codigo  
> **Donde esta cada lado:** En `fuente/Admin.dc.html:3170-3179` los 8 roles tienen asignadas sus pantallas visibles por medio de listas fijas en el codigo (ejemplo: `cajero` tiene `[ 'escritorio', 'caja', 'cierre', 'reservas', 'clientes', 'creditos', 'mensajes', 'notificaciones' ]`).  
> **Por que importa:** Si el dueno quiere que el cajero tambien consulte el stock de insumos o prohibirle el acceso al modulo de creditos, no puede ajustar los permisos sin que un programador altere el objeto `ROLES`.  
> **Prioridad:** Media.  
> **Propuesta de arreglo:** Implementar una matriz de perfiles y permisos en la base de datos que el administrador pueda marcar o desmarcar por rol.  
> **Estado:** CONFIRMADO. Cita en `fuente/Admin.dc.html`: `const ROLES = { admin: { ... }, cajero: { ... } };`.

---

### 1.24 Usuarios y Contrasenas
- **(a) Donde vive hoy:**
  - Cuentas de trabajadores: `TABLES.usuarios` en `Admin.dc.html:3229-3235` (tabla de datos fijos con `admin01`, `caja01`, `coc01`, `mozo01`, etc.).
  - PIN de anulacion administrativa: `INFO_DEFAULT.pinAnular = '0000'` en `Admin.dc.html:2900`.
  - Cuentas de clientes web: persistidas en `cfg.clientes` mediante `cliSave` (`Admin.dc.html:2965` y `Main.dc.html:1239`).
- **(b) Administracion:**
  - PIN para anular pedidos: Si es administrable en **Configuracion del local** (`mirest`), pestana **Entrega** (campo PIN del administrador).
  - Usuarios del personal y sus contrasenas: Fijo en el codigo. La pantalla **Usuarios** en el administrativo solo muestra una tabla estatica de lectura y no posee botones para crear colaboradores, cambiar contrasenas ni asignar credenciales. Requiere programador.
- **(c) Prioridad:** Alta.

> **Hallazgo D-24**  
> **Tipo:** Hueco y fijo en codigo  
> **Donde esta cada lado:** En `fuente/Admin.dc.html:3229-3235` la pantalla `usuarios` unicamente renderiza la estructura de lectura de `TABLES.usuarios` sin formularios de alta, baja, edicion de correo ni cambio de clave de acceso.  
> **Por que importa:** Ante la renuncia o rotacion habitual de un cajero o mozo, el dueno queda imposibilitado de bloquear el usuario antiguo o crear un nuevo usuario con clave propia sin solicitarlo al desarrollador.  
> **Prioridad:** Alta.  
> **Propuesta de arreglo:** Dotar a la pantalla Usuarios de un CRUD operativo con creacion de cuentas de empleados y reseteo seguro de contrasenas o PINs.  
> **Estado:** CONFIRMADO. Cita en `fuente/Admin.dc.html`: `rows: [ ['admin01', 'Persona de ejemplo 1', 'Administrador'...] ]`.

---

### 1.25 Correo y Grupo de Alertas
- **(a) Donde vive hoy:**
  - `fuente/Admin.dc.html:2901` en `INFO_DEFAULT`: `correoDueno: 'kevin@ejemplo.com'`, `grupoWhatsapp: 'Grupo del equipo (por definir)'`.
  - Interruptor de alertas de stock por email: estado `s.mailOn` y accion `toggleMail` en `Admin.dc.html:4812`.
  - Notificaciones en campana: logica de despacho a correo y grupo en `Admin.dc.html:4180`.
- **(b) Administracion:** Si es administrable en **Configuracion del local** (`mirest`), pestana **Avisos** (campos "Correo de Kevin" y "Grupo de WhatsApp del equipo"), y la activacion de alertas de stock en **Stock y recetas**.
- **(c) Prioridad:** Baja (Confirmado como administrable).

---

### 1.26 Encuestas y Gestion de Quejas
- **(a) Donde vive hoy:**
  - Disparo de queja simulada: `Admin.dc.html:4172` (`Queja en la encuesta`).
  - Alerta en campana: `Admin.dc.html:4180` (`Respondió "Mal" en la encuesta · Se avisó al correo ...`).
  - Flujo de encuesta en simulador de WhatsApp: `Chatbot.dc.html:230-231, 288, 326`.
- **(b) Administracion:** Fijo en el codigo. La pregunta ("Hola, ¿tu pedido llego bien y en orden? Cuentanos como te fue"), las opciones de respuesta ("Excelente", "Regular", "Mal"), el incentivo ("obten 25 % de descuento en tu proximo pedido") y el enlace a resenas de Google Maps estan cableados dentro del flujo de `Chatbot.dc.html`. No hay pantalla administrativa para disenar encuestas ni cambiar el porcentaje de descuento de agradecimiento. Requiere programador.
- **(c) Prioridad:** Media.

> **Hallazgo D-25**  
> **Tipo:** Fijo en codigo y hueco  
> **Donde esta cada lado:** En `fuente/Chatbot.dc.html:230` la respuesta a una calificacion positiva reza literalmente: `¡Qué alegría! ¿Nos dejas tu opinión en Google Maps? Copia y pega lo que nos escribiste en este enlace y obtén 25 % de descuento en tu próximo pedido: [enlace a Google Maps]`. Ademas el enlace es un texto sin sustitucion real.  
> **Por que importa:** El negocio regala un 25 % de descuento rigido sin que el dueno pueda fijar un 10 % o un postre de cortesia, y el enlace de Google Maps esta roto (es un marcador de posicion en texto).  
> **Prioridad:** Media.  
> **Propuesta de arreglo:** Configurar la plantilla de agradecimiento posventa, su enlace a Google Maps y el beneficio comercial otorgado dentro de los ajustes generales del negocio.  
> **Estado:** CONFIRMADO. Cita en `fuente/Chatbot.dc.html`: `obtén 25 % de descuento en tu próximo pedido: [enlace a Google Maps]`.

---

## 2. Confirmacion de lo que YA es Administrable Hoy

Para garantizar rigor y no duplicar esfuerzos de desarrollo, se certifica que las siguientes funciones **ya estan resueltas y operativas** desde el administrativo del mockup:

1. **Datos del local:** Nombre, lema comercial, distrito, barrio y descripcion para "Conocenos" se editan en `mirest` y se reflejan en la carta web.
2. **Ubicacion basica:** Direccion escrita, referencia de llegada y enlace URL de Google Maps se editan en `mirest` (pestana Ubicacion).
3. **Contacto:** Telefono institucional y numero WhatsApp se editan en `mirest` (pestana Contacto).
4. **Horarios semanales y feriados:** Apertura/cierre por dia y fechas especiales con horario diferenciado o cierre total se gestionan en `mirest` (pestana Horario y fechas).
5. **Redes sociales:** Enlaces a Instagram, Facebook y TikTok en `mirest` (pestana Redes sociales).
6. **Cuentas receptoras de pago:** Numeros de Yape, Plin y cuenta bancaria de transferencia en `mirest` (pestana Pagos).
7. **Reglas de entrega basicas:** Importe para envio gratis, pedido minimo de delivery, PIN administrativo de anulacion y tarifas por zona (Z2, Z3, Z4, Z5, Z7) se configuran en `mirest` (pestana Entrega).
8. **Avisos y alertas:** Correo del dueno para alertas criticas y grupo de WhatsApp del equipo en `mirest` (pestana Avisos).
9. **Fotos del local:** Galeria de 6 fotografias del local ("Nuestro lugar") se cargan directamente en `mirest`.
10. **Orden y visibilidad de la carta:** Orden de categorias, orden interno de productos, productos ocultos y fotos personalizadas por plato se publican en `disenador`.
11. **Diseno y decoraciones:** Eleccion del diseno de cuadricula/lista/tarjetas grandes y eleccion del tema festivo en `disenador`.
12. **Paletas de color:** Ajuste de los 9 colores estructurales por festividad y validacion de contraste visual WCAG en `paleta`.
13. **Novedades y publicidad:** Publicacion, fechas de vigencia, enlaces de video y galeria de fotos en `novedades`.
14. **Destacadas (Historias):** Creacion y orden de circulos de historias con imagenes en `destacadas`.
15. **Constructor de combos y promociones:** Creacion de combos con ranuras fijas o a eleccion, vigencias por dia/hora/canal en `ofertas`.
16. **Descuentos automaticos y cupones:** Creacion de cupones con validez, limite de uso y reglas de acumulacion en `ofertas`.
17. **Credito al personal:** Porcentaje de descuento y dias de plazo para pago en `creditos`.
18. **Tamanos y grupos de opciones:** Creacion de variantes de tamano y modificadores (leche, dulzor, toppings, shots) con sobrecostos en `productos`.
19. **Proveedores y compras:** Catalogo de proveedores, registro de facturas/ordenes de compra y actualizacion de costo unitario en `compras`.
20. **Ficha de insumos:** Unidades de medida, unidades de compra, factores de conversion y minimos de stock en `stock`.
21. **Etiquetas autoadhesivas:** Activacion y desactivacion de impresion de etiquetas de pedido, por area y de vaso en `caja`.
22. **Vinculacion de pantallas KDS:** Enlace y baja de televisores de cocina mediante codigo de 6 caracteres en `pantallas`.
23. **Plano de mesas:** Distribucion de mesas, capacidad de comensales y paredes en dos pisos en `plano`.

---

## 3. Lista Priorizada de lo que SI Necesita Programador Hoy

A continuacion se presenta la consolidacion de requerimientos tecnicos que el dueno **no puede resolver por si mismo hoy**, ordenados por su criticidad operativa:

### Prioridad Alta (Bloquea la operacion o causa perdidas directas)
1. **D-19 · Deduccion de recetas fija en expresiones regulares:** El dueno no puede registrar nuevas recetas ni ajustar los gramos/mililitros que se descargan del stock. Requiere programador para que el kardex sea confiable.
2. **D-01 / D-12 · Datos de pago y telefonos divergentes y cableados en el bot real:** `bot/bot_wa.py` tiene el celular `977503006` y el titular `María José Morillo Ruiz` soldados en el script, desalineados del administrativo.
3. **D-24 · Modulo de usuarios sin gestion de credenciales:** El administrador no puede crear personal nuevo ni revocar contrasenas ante despidos o rotacion.
4. **D-14 · Poligonos geograficos de delivery soldados en codigo:** Imposibilidad de alterar fronteras de reparto o incorporar nuevas zonas de entrega sin editar arrays GeoJSON.
5. **D-17 · Discordancia en tiempo de entrega prometido:** Contradiccion entre los 13 minutos de la carta web y los 30-45 minutos del bot de WhatsApp. Falta parametrizar el tiempo base.
6. **D-05 · Logotipo del negocio no modificable:** No hay via administrativa para reemplazar el archivo de logotipo en la carta y el bot.
7. **D-13 · Imposibilidad de desactivar medios de pago especificos:** Ante fallas en el POS o contingencias bancarias, no se puede deshabilitar Tarjeta o Yape de forma selectiva.
8. **D-09 · Ausencia de Terminos y Condiciones y Politica de Privacidad:** Vacio legal en la carta web y formulario de registro de cuentas frente a la normativa de proteccion de datos.
9. **D-10 · Plantillas de WhatsApp estaticas:** Respuestas rapidas de confirmacion, recojo, pago y despacho fijas en codigo sin posibilidad de edicion comercial.

### Prioridad Media (Afecta la experiencia del cliente o la flexibilidad comercial)
10. **D-03 · Coordenadas GPS del local estaticas:** Centro geografico del local fijo en el mapa de calor y calculos radiales.
11. **D-04 · Desconexion del texto explicativo del horario (`horarioTexto`):** Al cambiar los dias de atencion en el panel, el texto del pie de pagina no se actualiza.
12. **D-22 · Areas de cocina fijas:** Imposibilidad de reorganizar los despachos de KDS hacia estaciones de Frios / Calientes / Salados.
13. **D-18 · Tolerancia de reservas rigida en 15 minutos:** Inexistencia de parametro para ajustar la ventana de espera de mesas.
14. **D-16 · Tasa de acumulacion de puntos inmutable:** Factor de 1 sol = 1 punto hardcodeado sin reglas de campana.
15. **D-15 · Omision de pedido minimo en el Chatbot:** El simulador y el bot de WhatsApp no aplican la restriccion de monto minimo que si impone la web.
16. **D-25 · Encuesta y recompensa posventa soldada en codigo:** Descuento del 25 % y texto de resena de Google Maps no parametrizables.
17. **D-21 · Falta de credenciales de Wi-Fi para clientes:** No hay campos de SSID ni clave Wi-Fi para impresion en precuenta.
18. **D-23 · Permisos por rol rigidos:** Imposibilidad de habilitar o restringir modulos a perfiles especificos sin modificar la matriz de roles en codigo.
19. **D-07 · Chatbot desvinculado de la paleta y decoraciones festivas:** El simulador no adopta los colores ni motivos festivos activos.

### Prioridad Baja (Mejoras esteticas o de detalle fino)
20. **D-06 · Falta de subida de imagen para el banner principal del disenador.**
21. **D-08 · Glifos y saludos festivos fijos en el objeto `FX`.**
22. **D-20 · Catalogo de textos de error de sistema y advertencias de preparacion rigidos.**

---

## 4. Propuesta de una Pantalla Unica: "Ajustes del Negocio"

Actualmente la configuracion se encuentra dispersa entre `mirest` (Configuracion del local), `disenador` (Diseno de la carta), `paleta` (Paleta de colores), `ofertas` (Reglas comerciales) y variables escondidas en el codigo. Se propone consolidar todo en una unica vista madre: **"Ajustes del Negocio"**, organizada en las siguientes pestañas funcionales:

```
+--------------------------------------------------------------------------------------------------------+
|                                        AJUSTES DEL NEGOCIO                                             |
+---------------+----------------+---------------+---------------+---------------+-----------------------+
|  1. Identidad |  2. Operacion  |  3. Delivery  |  4. Pagos y   |  5. Mensajes  |  6. Personal,         |
|   y Marca     |  y Horarios    |  y Cobertura  |   Finanzas    |   y Clientes  |   Roles y Seguridad   |
+---------------+----------------+---------------+---------------+---------------+-----------------------+
```

### Seccion 1: Identidad y Marca
- **Logotipo e Isotipo:** Subida directa de archivo de imagen con recorte cuadrado y circular para web, bot y KDS.
- **Datos institucionales:** Nombre comercial, lema de cabecera, distrito, barrio, descripcion para "Conocenos".
- **Identidad corporativa:** Razón social, RUC y direccion fiscal para emision de comprobantes.
- **Redes sociales dinamicas:** Lista editable para anadir cualquier red social (Instagram, TikTok, Facebook, Canal de WhatsApp, YouTube, TripAdvisor).
- **Legales:** Editor de Politica de Privacidad y Terminos y Condiciones de la carta virtual.

### Seccion 2: Operacion, Horarios y Sala
- **Horario semanal:** Interruptores y selectores de hora por dia con generacion automatica de texto resumen (`horarioTexto`).
- **Feriados y excepciones:** Calendario de fechas especiales (cerrado o con horario especial).
- **Politica de reservas:** Tiempo de tolerancia en minutos (ej. 15 min), horario habilitado para reservas y cupo maximo de mesas simultaneas.
- **Areas de produccion:** Creacion y renombramiento de areas de despacho (ej. Bebidas frias, Cafeteria caliente, Salados, Postres) y mapeo directo a categorias de carta.
- **Conectividad:** Nombre de la red Wi-Fi de clientes (SSID) y contrasena para impresion automatica en comprobantes.

### Seccion 3: Delivery y Cobertura Geografica
- **Centro operativo:** Coordenadas GPS del local (latitud y longitud) para centrado de mapas y calculos de distancia.
- **Tiempos de entrega:** Tiempo base promedio de entrega en minutos (normal) y suplemento de tiempo para alta demanda.
- **Reglas economicas:** Monto minimo de compra para delivery y monto exonerado para envio gratis.
- **Zonas de cobertura:** Tabla de zonas con nombre, tarifa de envio en soles y visor interactivo para cargar o ajustar limites GeoJSON.

### Seccion 4: Pagos y Finanzas
- **Medios de pago disponibles:** Casillas de activacion/desactivacion para Efectivo, Yape, Plin, Tarjeta POS y Transferencia Bancaria, con mensaje personalizado para medios temporalmente suspendidos.
- **Cuentas bancarias detalladas:** Por cada cuenta: Entidad (BCP, BBVA, Interbank), Numero de Cuenta, Codigo de Cuenta Interbancario (CCI) y Nombre completo del Titular.
- **Credito del personal:** Porcentaje de descuento permitido y plazo maximo en dias para cancelacion de saldos.
- **Fidelidad y puntos:** Cantidad de soles requeridos para acumular 1 punto y vigencia de los puntos.

### Seccion 5: Mensajes, WhatsApp y Satisfaccion
- **Plantillas de WhatsApp (Comandos rapidos):** Editor de textos para `/listo` (pedido listo para despacho), `/recojo` (listo en tienda), `/ubicacion` (solicitud de GPS) y `/pago` (instrucciones de abono).
- **Notificaciones operativas:** Correo electronico para alertas de quiebre de stock y enlace/numero del grupo de WhatsApp interno.
- **Encuesta de satisfaccion y posventa:** Tiempo de disparo tras la entrega (ej. 120 min), pregunta de calificacion, porcentaje de descuento de agradecimiento y enlace real de Google Maps para resenas.

### Seccion 6: Personal, Roles y Seguridad
- **Gestion de usuarios:** Creacion, desactivacion y edicion de cuentas del personal (cajeros, mozos, cocineros, repartidores).
- **Contrasenas y PINs:** Cambio de clave por usuario y PIN administrativo maestro para autorizar anulaciones de pedidos y descuentos.
- **Matriz de permisos:** Permiso de acceso de cada rol a las distintas pantallas del sistema.

---

## 5. Lo que Seguiria Necesitando Programador en un Sistema Real

Incluso en una arquitectura completamente autonoma para el negocio, existen responsabilidades que forman parte de la **infraestructura tecnica, seguridad y cumplimiento normativo**, las cuales deben permanecer bajo el cuidado de un programador o equipo de soporte tecnico especializado:

### 1. Infraestructura, Servidor y Base de Datos
- **Mantenimiento y despliegue:** Provisionamiento del servidor en la nube (VPS, AWS, DigitalOcean o GCP), configuracion de Docker, balanceadores de carga y certificados SSL (HTTPS / WSS).
- **Actualizaciones del sistema operativo y parches de seguridad:** Actualizacion de versiones de Python, Node.js y parches del kernel de Linux.
- **Monitoreo de disponibilidad y caidas:** Configuracion de reinicio automatico mediante `systemd` o `pm2` y alertas en caso de saturacion de CPU, RAM o disco.

### 2. Integracion con Meta WhatsApp Cloud API y OpenAI
- **Credenciales y Tokens de Meta:** Renovacion de tokens de acceso permanente (`System User Token`), administracion de la cuenta en Meta for Developers y configuracion de los Webhooks protegidos por `WHATSAPP_VERIFY_TOKEN`.
- **Aprobacion de plantillas HSM:** Si el negocio desea enviar mensajes proactivos fuera de la ventana de 24 horas de WhatsApp (mensajes de marketing o reactivacion), Meta exige la aprobacion tecnica previa de plantillas oficiales.
- **Gestion de cuotas de Inteligencia Artificial:** Administracion de la clave de OpenAI API, control de presupuesto mensual de tokens y mitigacion del error de saturacion (Error 429).

### 3. Red Local, Impresoras Termicas y Hardware del Salon
- **Configuracion de red local (LAN / VLAN):** Asignacion de direcciones IP estaticas a las ticketeras de cocina y etiqueteras de barra (ej. `192.168.1.210`) para evitar que el router cambie las IPs al reiniciarse.
- **Drivers y protocolos ESC/POS:** Mantenimiento del servicio puente de impresion local (spooler) que transforma los pedidos web en comandos crudos para ticketeras de 80 mm y 58 mm.
- **Pantallas KDS en Smart TVs:** Emparejamiento inicial de red y configuracion del navegador embebido de los televisores para arranque en modo kiosco.

### 4. Copias de Seguridad, Respaldo y Recuperacion de Desastres
- **Copias automaticas de base de datos:** Tarea programada (cron job) diaria para exportar la base de datos SQL / JSON hacia un almacenamiento externo seguro y cifrado (ej. Amazon S3 o Google Cloud Storage).
- **Plan de recuperacion ante desastres (DRP):** Procedimiento probado de restauracion del sistema en un servidor de respaldo en caso de corrupcion de datos o falla total del proveedor de nube.

### Como Dejarlo Documentado (Runbooks Operativos)
Para que el dueno no quede cautivo de un unico proveedor, el desarrollador debe entregar una carpeta de operacion documentada (`docs/operacion/`) con:
1. **Ficha tecnica de accesos y servicios:** Listado de proveedores (dominio, servidor, Meta, OpenAI), cuentas asociadas y ubicacion de credenciales maestras.
2. **Guia de reinicio de emergencia:** Instrucciones sencillas paso a paso sobre como reiniciar el servicio web o el bot de WhatsApp si la atencion se detiene.
3. **Manual de instalacion de impresoras:** Protocolo para dar de alta una nueva ticketera termica o reemplazar un equipo averiado, indicando marca, modelo recomendado y asignacion de IP.
4. **Guia de restauracion de respaldos:** Comando exacto para restaurar la base de datos a partir del archivo de copia de seguridad mas reciente.

---

INFORME LISTO

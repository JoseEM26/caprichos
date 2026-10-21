---
id: REG-CAP-001
tipo: analisis
titulo: Registro del mockup de Caprichos (qué hace hoy cada pantalla)
estado: approved
producto: caprichos
version: "0.1"
owner: "José Ángel Espinoza (desarrollo); validación pendiente de Kevin Rosales"
aprobadores: ["José Ángel Espinoza (Product Owner)", "José Ángel Espinoza (UX/UI Designer)", "Kevin Rosales (Stakeholder)"]
fecha: 2026-10-17
relacionados: [BRD-CAP-001, CFG-CAP-001]
tags: [mockup, registro, etapa-siguiente]
---

# Registro del mockup de Caprichos

Documento de trabajo para la etapa siguiente (cuando el cliente apruebe el mockup). Dice **qué hace hoy el mockup**, qué decisiones se tomaron y qué falta. No está aprobado: la IA propone y el humano decide. Todos los datos del mockup son de ejemplo.

Estado del mockup al 17/10/2026: artifact "Caprichos Plataforma Digital", versión 105.

## 1. Superficies

| Superficie | Qué es | Dónde está |
| :-- | :-- | :-- |
| Pantalla principal | Portada con tres entradas: carta virtual, administrativo y WhatsApp | Tablero "Inicio" |
| Carta virtual | Lo que ve el cliente | Tablero "Main" |
| Chatbot (Capri) | Atención por WhatsApp | Tablero "Chatbot" |
| Administrativo | Lo que usa el equipo, por roles | Tablero "Admin" |
| Pantalla de cocina (TV) | Vista de solo lectura por área | Tablero "Pantalla" (no se muestra al cliente) |
| Propuestas | Comercial, técnica y modo sin internet | Tableros internos (no se muestran al cliente todavía) |

## 2. Carta virtual

- **Inicio:** portada con el Capricho del mes y botones "Pedir ahora" y "Ver la carta"; franja de datos útiles (abierto o cerrado, delivery gratis, tiempo de entrega, pagos); círculos "Momentos Caprichos" (destacadas con fotos); carrusel de novedades; carta por categorías con el más comprado de cada una (estrella). Las dos tarjetas de promociones dúo y la franja "Un lugar para compartir" se quitaron por decisión del 17/10.
- **Páginas:** Carta, Novedades y Conócenos.
- **Producto:** ventana con foto (lupa para ampliar), tamaño, leche, endulzante, toppings opcionales, adicionales y nota para cocina. Los **combos** se piden por unidad (sabor, leche, dulzor y toppings de cada frappe; sabor de cada dona) en pasos plegables.
- **Carrito y pago:** aviso visual al agregar; Delivery o Para recoger en el local (el cliente no pide "en el local": en el salón pide el mozo); pagos con efectivo (vuelto), Yape, Plin, tarjeta y transferencia; cupón; costo de delivery por rangos de distancia.
- **Delivery con ubicación actual:** botón "Usar mi ubicación actual". Si se consigue: "Tu ubicación fue localizada correctamente", mapa y enlace a Google Maps. Si no: "No fue posible conseguir la ubicación" con la causa. La dirección y la referencia siguen editables. Ya no existe el campo de código Plus de Google Maps.
- **Cuenta del cliente (opcional):** botón "Ingresar" en la cabecera con ingresar, crear cuenta (con casilla para guardar datos) y "Seguir como invitado". Con cuenta se ven los puntos (1 por cada s/ 1). Sin cuenta se compra igual, sin puntos. El inicio de sesión es solo visual.
- **Descuentos automáticos:** la carta aplica sola el mejor descuento que corresponda según día, hora, fechas y canal (por ejemplo un happy hour) y lo muestra como línea aparte; si las reglas no permiten juntarlo con un cupón, avisa.
- **Cupones:** el cliente escribe el código (incluidos los impresos en el comprobante, como DUO20-0102); se valida vigencia, usos máximos, canal, cuenta, compra mínima y categoría o producto.
- **Novedades:** panel general de publicidad, no solo de comida. Portada deslizable con banners, filtros por tipo, tarjetas con galería de fotos, "Antes de venir" y redes. Tipos: promoción, banner, video (TikTok, Instagram o YouTube, con enlace y portada), novedad con imagen, fotos de clientes o de un evento, evento (fecha y lugar) y aviso; cada una con etiqueta o tema (por ejemplo Navidad) y varias fotos. Los videos van por enlace en el mockup; subir archivos de video queda para el sistema real.
- **Destacadas:** los círculos abren un visor de fotos tipo historias de Instagram (barras de progreso, tocar a los lados). Solo muestran fotos de clientes, local o equipo; no redirigen.
- **Conócenos:** descripción, galería "Nuestro lugar", ubicación, horario por día con fechas especiales, contacto y redes.
- **Comentarios y pie de página:** formulario "¿Cómo te fue en Caprichos?" (comentario, sugerencia, felicitación o queja) y pie con ubicación, horario, contacto, redes y enlaces.
- **Celular primero:** cabecera compacta, pantalla de carga, ocultar "Controles de la maqueta" y detección de teléfono real.

## 3. Chatbot (Capri)

Menú: hacer un pedido, reservar mesa, ver la carta, preguntar algo y hablar con una persona. El pedido va por botones, con varios productos, pago y aviso de alta demanda. En **Delivery** pide compartir la ubicación actual (con los mismos mensajes de éxito y error) o escribirla. La reserva es una solicitud que un mozo o caja aprueba. Las respuestas de nombre, ubicación, horario, Yape y Plin salen de la configuración.

## 4. Administrativo

Menú por grupos y por rol (administrador, cajero, cocina y barra, mozo, call center, almacén, producción y repartidor).

- **Operación:** escritorio por rol; pedidos y caja (aceptar, cobrar, nuevo pedido de mesa: el mozo elige la mesa entre las libres o en el plano y ve un cartel con la mesa y "Cambiar mesa"; para llevar, delivery con ubicación actual, reservar mesa; ver productos con o sin imagen; cobro a crédito del personal); cocina por área, con pantalla completa sin desplazar; repartos; reservas.
- **Clientes y ventas:** clientes (puntos y comentarios recibidos); créditos del personal (25 % y 15 días configurables, solo trabajadores); productos; ofertas y descuentos (cuatro pestañas: promociones con días, horas y fechas; descuentos automáticos; cupones del comprobante con historial; y reglas generales).
- **Compras y stock:** compras; almacén (entrada, salida, merma y devolución; producción del día; cierre del día); stock y recetas con semáforo.
- **Análisis:** informes e indicadores con gráficos y filtros (periodo, año, canal y fechas).
- **Configuración:** diseño de la carta; novedades y publicidad; destacadas; paleta de colores; configuración del local (datos, ubicación, contacto, horario por día y fechas especiales, redes, pagos, entrega, avisos, empresa y fotos del local); usuarios; pantallas; plano del local (controles arriba, plano a pantalla casi completa, cuadrícula con más o menos cuadrados, pisos y eliminar mesas); notificaciones.
- **Campanita:** todas las notificaciones por prioridad y tiempo de espera, filtradas por rol.

## 5. Reglas transversales del mockup

- Toda acción que cambia algo pide confirmar Sí/No.
- No se elimina: se desactiva. Excepción: el plano del local, donde se puede eliminar cualquier elemento, incluso una mesa que ya se usó; solo se bloquea una mesa con un pedido abierto o una reserva activa hoy.
- Todo dato del local se escribe una sola vez en Configuración del local (ver CFG-CAP-001).
- Los filtros son combos con buscador cuando pasan de 10 opciones, y las fechas usan selector de calendario.
- La IA no aprueba documentos.

## 6. Decisiones del equipo de desarrollo que amplían o cambian el acta 02 (por confirmar con Kevin)

- Crédito solo para el personal (Kevin dijo en la reunión "ponle para todos").
- Se quitó el código Plus de Google Maps en el delivery; manda la ubicación actual con mapa.
- Página Novedades, destacadas con fotos y formulario de comentarios: no están en el acta (solo un banner publicitario que se puede desactivar).
- Combos por unidad con sabor y toppings.

- Cuenta por DNI (v89): DNI + contraseña, correo personal y cumpleaños opcionales. En Nuevo pedido, "¿Quién pide?": sin cuenta, cliente con cuenta (busca por DNI o lo registra en el local sin pedir contraseña) o personal; botón "Pedido del personal". Los puntos se suman al cobrar y aparecen en Clientes (DNI enmascarado). El pedido del personal solo ofrece "En el local" y "Para llevar".
- Tipos con sabores (v86): donas, galletas y tipos nuevos con sus sabores, en Productos > Gestionar listas; las promociones eligen un tipo y la carta usa sus sabores.
- Pedidos y caja (v88): dos columnas del mismo alto, detalle en pestañas (Pedido, Cobro, Ticket de cocina, Comprobante) con total y acciones fijos.

- Delivery con mapa (v91): en Nuevo pedido, el operador busca la dirección o toca el mapa para marcar la entrega; mueve y acerca el mapa; el pedido guarda la dirección y el enlace "Ver en el mapa". Mosaicos de OpenStreetMap y búsqueda de Nominatim: dependen de internet y de su uso razonable; en el sistema real se usará el servicio de mapas que se acuerde.

- Carta actualizada (v93): productos, precios, descripciones y categorías tomados de `menu_dinamico.txt` del chatbot (CAPRIBOT RAIZ). Nuevas categorías Frozen y Croissants; Complementos pasa a llamarse Postres; extras reales (chantilly, syrops, bola de helado, shots, extras de salados). Dúo para compartir ahora es 2 bebidas + 1 complemento (12/16/20 oz a s/ 33, 36 y 38). Combo Cajita Caprikids. 66 productos con las imágenes nuevas (73 fotos reducidas a webp, guardadas en el artifact). Carta virtual, administrativo (Productos, Nuevo pedido, Diseñador) y chatbot usan el mismo catálogo. No se usaron las imágenes de carta impresa, termos ni pack amarillo (no están en el menú).
- Por confirmar con Kevin de esa carta: precios duplicados en Extras (chantilly 2.0 y 2.5; leche de almendras 2.5 y 3.0), 'Dúo compartir 20 oz' frente a 21 oz del Dúo irresistible, la empanada (un trío o una unidad), y que el menú no trae descripción para Caprisabroso, Entremets y Tartaleta.

- Etiquetas adhesivas (v94): en el detalle del pedido, nueva pestaña Etiquetas con tres tipos: general del pedido, por área (Bebidas, Salados, Postres o dulces) y por bebida (con lo que contiene, para pegar dentro del vaso). Contador, activar o desactivar cada tipo, reimpresión por tipo y la etiquetera de cada área (nombres de ejemplo). Por confirmar con Kevin: si las áreas son Salados, Fríos y Calientes en lugar de Bebidas, Salados y Postres; tamaño real de la etiqueta; modelo de etiquetera.

- Flujo de pedidos (v96): el pedido del mozo en el local va directo a cocina (sin caja). Todo pedido fuera del local queda "por confirmar": en Pedidos y caja, botón Confirmar pedido y pago con paso 1 hablar por WhatsApp (enlace wa.me y casilla "ya hablé con el cliente"), paso 2 medio de pago, comprobante obligatorio en Yape, Plin y transferencia, y envío a cocina. La carta virtual y el chatbot ya no piden pago ni capturas. Ver `flujo-de-pedidos.md`.

- Caja y cierres (v97): nuevo módulo para administrador y cajero. Turno actual (abre en cero, ventas por medio de pago, efectivo esperado, movimientos de caja), cierre con verificación, conteo de billetes y monedas, billeteras y tarjetas, diferencia y observaciones, y historial con filtros y ticket. Basado en el análisis de restaurant.pe (`caja-informes/restaurantpe-caja.md`). Datos de ejemplo.

- Mejoras del cajero (v100), a partir de la revisión de 6 agentes (`cajero-informes/`): cobro con medio, pago mixto, monto recibido y vuelto; Clientes con nuevo cliente, búsqueda por DNI completo, edición sin tocar el documento e historial; abonos del crédito del personal; escritorio con cifras reales; promociones, cupones y descuentos automáticos en Nuevo pedido.

- Nuevo pedido y carta (v101): las opciones de un producto (por ejemplo las 27 bebidas del Dúo para compartir) se muestran en columnas y, si son más de 8, con buscador y lista con desplazamiento; muestra lo elegido. En Nuevo pedido, al agregar un producto sale un aviso que se esconde solo, con la foto, el producto y cuántos productos lleva el pedido.

- Combos y opciones (v102-v103): constructor de combos en Ofertas y descuentos (partes: a elección, una opción entre varias, fijo) y Opciones y tamaños en cada producto (tamaños, grupos como tipo de leche, endulzante, shots y extras, con precios, activar o desactivar y dónde se preguntan). La carta, Nuevo pedido, el descuento de stock y las etiquetas usan estas definiciones. Ver `combos-y-opciones.md`.

- Producción, administrador y mensajes (v110): registrar producción por tanda con descuento de materia prima, cierre con conteo físico, alerta de 12 horas, escritorio real de producción, entrega de pedidos al almacén que baja stock; nuevo producto, precios y plano guardados, PIN para anular, cajero sin ofertas ni condiciones del crédito, costo de recetas oculto a cocina y mozo; consola de mensajes de WhatsApp; toppings de 1 sol y aviso de hielo. Detalle en `produccion-admin-bot-informes/README.md`.
- Delivery y roles (v108-v109): envío por zonas reales del bot (carta y pedidos manuales), zonas sobre el mapa, repartos con llamar, WhatsApp, coordenadas, vuelto, estados de problema y liquidación del efectivo a caja; mozo (consumos a mesa ocupada, sentar reserva, precuenta imprimible, servido, aviso de listo); call center (memoria de dirección, repetir, anular con motivo, paga con, tarifa especial); Mapa de entregas con calor. Detalle en `delivery-informes/README.md`.
- Cocina y barra (v107): estado por área, un toque con Deshacer, despejar listos, mesa y notas en pantalla completa, sonido de pedido nuevo, Se acabó algo (agotar por hoy; la carta lo oculta), Alta demanda (carta y chatbot), merma y cierre para Cocina, pedidos al almacén. Detalle en `cocina-informes/README.md`.
- Almacén (v106): módulo Compras con pestañas Compras y Proveedores; registrar compra con lote y vencimiento (suma al stock y deja la entrada en Almacén); directorio de proveedores con historial y precios; ficha del insumo con unidades, niveles y proveedores A, B, C; nuevo insumo; la orden de compra de Stock usa el proveedor A y su WhatsApp. Detalle en `compras-y-proveedores.md`.
- Ofertas unificadas (v105): un solo botón + Armar oferta con tres tipos (Combo, Llevas más pagas menos, Descuento) y vigencia opcional también en el combo; ayuda con ? que explica la diferencia.

## 7. Límites y pendientes

- **Cupones:** los usos de canje no suben al pedir (sí se cuentan los cupones impresos); el límite por cliente no se controla; la vigencia se compara con una fecha fija (15/10/2026); CUMPLE25 no comprueba el cumpleaños; crear cuenta no da un cupón de bienvenida.
- **Cuenta del cliente:** inicio de sesión visual con DNI y contraseña (no se valida contra un servidor); falta verificar el correo opcional y recuperar la contraseña; el DNI y la lista de clientes viven en el navegador.
- **Ubicación:** queda como coordenadas (sin "calle y número", que pide un servicio de mapas); el mapa y el permiso dependen del navegador; el pedido de la carta no llega con coordenadas al administrativo.
- **Fotos y archivos:** se guardan en el navegador; en el sistema real irán a un almacenamiento de archivos.
- **Comentarios:** se guardan en el navegador; falta el aviso real por correo al dueño y a la campanita.
- **Filtros:** al abrir un combo, el contenedor se agranda; en el diseño final la lista debe flotar encima.
- **Visor de destacadas:** no se puede pausar manteniendo presionado ni deslizar con el dedo.
- **Impresión, pantallas de TV, WhatsApp real, base de datos local para modo sin internet:** solo propuestas o simulaciones.
- Falta validar con Kevin: textos, campos, horarios, números, redes, reglas de cupones y de puntos.

## 8. Publicación

El mockup vive en el artifact. Hay una copia de prueba en Vercel (`caprichos-mockup`) con solo la portada, la carta, el administrativo y el chatbot, que quedó en la versión del 17/10 con los combos por pasos; no incluye los cambios posteriores. El código de esa copia está en el repositorio privado `JoseEM26/caprichos-mockup` (con commits locales sin subir).

## Índice rápido de v113 a v135 (18 y 19/10/2026)
Cada versión tiene su sección abajo. Los flujos explicados de punta a punta están en `flujo-pago-whatsapp-y-ubicacion.md` y los requisitos en `BRD.md` v1.38 (NEC-CAP-090 a 098, RN-CAP-100 a 112).

| Versión | Qué se hizo |
|---|---|
| v113 | Envío gratis desde/más de, zonas editables, áreas de cocina, devolución de cobros cerrados, pedidos persistentes, pulido del chatbot |
| v114 | Reservas no bloqueantes (15 min y se anulan solas) |
| v115 a v118 | Mensajes de WhatsApp con aspecto de WhatsApp, compacto, zoom, pantalla completa, icono del menú |
| v119, v120 | Botón Pulir mensaje (tono y ortografía) |
| v121 a v123 | Nuevo pedido: pedido del personal por usuario, un solo botón, «Pide» en una línea |
| v124 | Descuento del personal a crédito en Configuración |
| v125 | Envío «más de S/ 70», tarifa especial por cliente, Reservar mesa en un formulario |
| v126, v127, v130, v133 | Ubicación: botón de ubicación actual, nunca obligatoria, el equipo ubica en el mapa, zonas internas |
| v128, v129 | Cumpleaños con calendario (obligatorio) y campanita; propuesta a S/ 3,500 |
| v131 | Chatbot: cambios después de pedir y mensajes libres |
| v132 | Juntar varias mesas |
| v134 | Pago por WhatsApp automatizado; un dueño por chat |
| v135, v136 | Chats de ejemplo con el flujo por opciones; resumen y aviso de ubicación en el primer mensaje del bot |

## v111 (18/10/2026): construcción de la revisión cruzada (partes A a D)
Probado solo con el arnés de pruebas (sin navegador). Ver `revision-cruzada-informes/README.md`.
- **A. Carta web:** los pedidos se bloquean fuera de horario, en feriado cerrado y con la pausa por alta demanda (aviso en carrito y checkout; se vuelve a comprobar al confirmar). Cupones validan contra la fecha real (antes fecha fija 15/10). Los precios editados en el Admin ahora también mueven productos con varios tamaños (se suma la diferencia a todos). El cierre de caja no deja cerrar con efectivo de repartidores sin liquidar.
- **B. Chatbot simulador:** lee la configuración compartida (cerrado/pausa, pedido mínimo, zonas y tarifas por ubicación, envío gratis, agotados, medios de pago, precios editados). Ya no acepta dirección escrita (como el bot real) y pide la captura del comprobante. Opciones "Simular" para probar zonas sin GPS.
- **C. Configuración del local ampliada** (pestañas Pagos, Logo, Operación, Textos y mensajes): activar/desactivar medios de pago, logo propio, tiempo de entrega prometido, tolerancia de reservas, porcentaje de puntos, Wi-Fi en la precuenta, coordenadas del local, términos y privacidad (visibles en el checkout de la carta) y los cuatro mensajes rápidos de WhatsApp.
- **D. Diseño del Admin:** colores como variables (`--cp-*`), botones mínimos de 44 px y letra mínima de 12 px.
- **Pendiente de Kevin:** anular pedidos cobrados, Libro de Reclamaciones, boleta/factura con RUC, tiempo 13 min frente a 30-45 min del bot real, envío gratis desde 70 frente a más de 70.
- **Falta:** zonas/polígonos y recetas editables, altas de usuarios, matriz de permisos editable, áreas de cocina configurables, encuesta posventa editable; carta web que envíe pedidos al Admin (integración real).

## v112 (18/10/2026): segunda tanda de la revisión cruzada
Probado solo con el arnés de pruebas (sin navegador).
- **Carta a Admin:** el pedido web se guarda en la cola compartida (`webOrders`) y el Admin lo recoge cada 3 segundos como "por confirmar" (código CP-W001...). Sus cambios de estado se guardan.
- **Anular cobrados:** administrador y cajero, con motivo y PIN, solo si el cobro sigue en la caja abierta; queda registrado el monto devuelto.
- **Libro de Reclamaciones** en el buzón de la carta (tipo Reclamo, con DNI, domicilio y monto) y **comprobante** (sin / boleta / factura con RUC y razón social) en el checkout.
- **Encuesta posventa** editable (minutos, pregunta, descuento, enlace).
- **Usuarios:** nuevo usuario, desactivar/activar, y matriz de permisos por rol (guardar o volver a fábrica).
- **Recetas:** editor de qué insumos descuenta cada producto por unidad vendida.
- **Áreas de cocina:** cada categoría se asigna a Bebidas, Postres o Salados (no se pueden crear áreas nuevas).
- **Zonas:** cada zona se puede apagar; la carta, el chatbot y el call center la tratan como fuera de cobertura.
- **Sin hacer:** polígonos de zona editables en pantalla, crear áreas de cocina nuevas, clave real de usuario (sistema real), envío de pedidos del call center a la cola web.

## v113 (18/10/2026): pendientes de la revisión cruzada
Probado solo con el arnés de pruebas (sin navegador).
- **Envío gratis:** interruptor "solo si se pasa del monto" (más de) o "desde el monto" (desde). Lo respetan la carta, el chatbot y el Admin.
- **Zonas de reparto en pantalla:** cada zona se edita como lista de puntos (latitud, longitud); se valida y, si queda mal, se usa la original. Cambian la detección en la carta, el chatbot, el call center y los mapas del Admin. No se pueden crear zonas nuevas.
- **Áreas de cocina nuevas:** hasta 4 áreas propias (por ejemplo Barra fría, Parrilla); aparecen al asignar categorías y como pantalla en Cocina. No imprimen etiquetas propias.
- **Devolución de cobros cerrados:** administrador y cajero pueden anular un pedido de un cierre anterior; si fue en efectivo, se registra un egreso en el turno abierto.
- **Pedidos guardados en el navegador:** los pedidos y su contador sobreviven a recargar la página. Botón "Restablecer pedidos de ejemplo" en Configuración del local. El stock y los puntos aún no se guardan.
- **Chatbot:** letra mínima de 12 px, botones de 44 px, registro de la conversación para lectores de pantalla y logo configurable. Se mantiene la paleta de WhatsApp a propósito.
- **Siguen fuera:** clave y login reales, boleta o factura electrónica, y el tiempo de entrega 13 frente a 30-45 min (ya se configura; falta que Kevin elija el valor).

## v114 — Reservas no bloqueantes (18/10/2026)
- La reserva de mesa dura la tolerancia configurada (15 min) desde su hora; pasado ese tiempo se anula sola y la mesa vuelve a verse libre.
- La marca R en el plano es solo visual: se puede abrir un pedido en una mesa reservada (ya no sale el diálogo de sentar/liberar) y también reservar una mesa que ya tiene reserva.
- Al asignar mesa a una reserva por WhatsApp, ya no se excluyen las mesas reservadas.
- Probado con el arnés: a las 12:00 se ve 1 mesa con R y el clic abre el pedido; a las 18:00 no hay ninguna R. No probado en navegador. El vencimiento depende de la hora del equipo y de las filas de ejemplo con fecha 15/10.

## v115 — Mensajes de WhatsApp con aspecto de WhatsApp (18/10/2026)
- Bandeja en dos paneles: lista de chats (avatar con iniciales, hora, vista previa con "Tú:" / "Bot:", contador de no leídos, estado) y conversación con fondo, burbujas blancas y verdes, hora con doble visto y separador "HOY".
- Organización: buscador por nombre o celular, pestañas Todos / Por atender / Con el bot / Atendidos con contador, y resumen "N por atender".
- Franja explicativa por estado (qué hacer en ese chat) con el botón Pausar/Reanudar el bot a la vista. El pedido armado va en una tarjeta y Aprobar/Rechazar pago quedan grandes. Respuestas rápidas con nombre claro (Pedido listo, Puede recoger, Pedir ubicación, Datos de pago). Las demás acciones están en "Más acciones".
- En celular se ve una pantalla a la vez (lista o chat) con flecha para volver.
- Probado con el arnés (filtros, búsqueda, abrir/volver, aprobar pago, matriz de roles sin errores). No visto en navegador: el diseño y el cambio lista/chat en celular están por revisar a ojo.

## v116 — Mensajes de WhatsApp: más compacto y con zoom (18/10/2026)
- Vista más pequeña por defecto (85 %) y filas, encabezados y franjas más bajos; la bandeja ocupa casi todo el alto de la pantalla.
- Control de zoom (−, porcentaje que restablece, +) de 60 % a 140 %, de 10 en 10. Usa la propiedad CSS `zoom` (no probada en navegador; en Firefox antiguo, anterior a la versión 126, puede no aplicar). No se guarda al recargar.
- Con zoom bajo los botones quedan menores a 44 px reales: es a pedido del usuario.

## v117 — Iconos del menú
- Faltaba el icono de Mensajes de WhatsApp (burbuja de chat) y el de Mapa de entregas (marcador): ya se ven en el menú.


## v118 — Mensajes de WhatsApp: pantalla completa y sin textos de relleno (18/10/2026)
- Botón Pantalla completa / Salir (cubre toda la ventana y pide al navegador su pantalla completa; si el navegador la niega, queda la cobertura de la ventana). Esc del navegador sale de su pantalla completa pero no de la cobertura: se sale con el botón. No probado en navegador.
- Se quitaron el título visible, la frase de apoyo y el aviso de datos de ejemplo (queda como ayuda al pasar el cursor y el título sigue disponible para lectores de pantalla).

## v119 — Botón Pulir mensaje (18/10/2026)
- Junto al cuadro de escribir hay un botón Pulir: muestra cómo quedaría el mensaje más amable (saludo con el nombre, abreviaturas escritas completas, mayúsculas, cierre cortés) y la persona elige Usar este texto o Dejar el mío. Nunca se envía solo.
- En el mockup lo hacen reglas simples, no una IA. Con IA real sería una llamada corta por clic y solo cuando se toca el botón.

## v120 — Pulir mensaje también corrige la escritura (18/10/2026)
- Corrige abreviaturas y faltas comunes (kiero, ola, q, xfa, tmb, dnd, direcion, minuts, aqui, tambien), mayúsculas seguidas (TODO EN MAYÚSCULAS), letras y signos repetidos, signos de pregunta ¿? y tildes en preguntas (dónde, cuánto, cómo), nombres de distritos con mayúscula.
- Es un diccionario fijo del mockup: no entiende el contexto ni detecta faltas fuera de la lista. Una IA real lo haría completo.

## v121 — Nuevo pedido: pedido del personal por usuario (18/10/2026)
- La primera pantalla de Nuevo pedido se ordena en dos grupos: Para un cliente (local, para llevar, delivery, reservar) y Para el equipo (Pedido del personal).
- Pedido del personal: paso nuevo con la lista de usuarios ACTIVOS (nombre, usuario, cargo, perfil), buscador, y elegir En el local o Para llevar. Ya no se escribe el nombre ni el teléfono; los usuarios desactivados no salen. Para llevar salta directo a los productos; En el local sigue a piso y mesa.
- En el paso de productos, la lista de Personal también usa los usuarios activos.
- Pendiente: los puntos y el crédito del personal siguen ligados a la lista de clientes de tipo Personal (nombres de ejemplo distintos a los usuarios), así que este pedido guarda al usuario pero no suma puntos hasta unir ambas listas en el sistema real.

## v122 — Un solo botón en Pedidos y caja (18/10/2026)
- Se quitó el botón aparte Pedido del personal: queda Nuevo pedido, y el pedido del personal se elige dentro del mismo modal (grupo Para el equipo).

## v123 — Nuevo pedido más limpio: quién pide en una sola línea (18/10/2026)
- En el paso de productos, el bloque ¿Quién pide? ya no muestra la lista de personal ni los botones: queda una línea (por ejemplo, Pide: Personal · Repartidor 1 (rep01)) con un botón Cambiar. Se abre solo si hace falta (cliente con cuenta sin DNI al enviar).
- Se quitó el cuadro verde repetido de la cuenta y se acortó el texto de ayuda del personal.

## v124 — Descuento del personal a crédito en Configuración (18/10/2026)
- El porcentaje de descuento y el plazo del crédito del personal se cambian ahora en Configuración del local > Operación (campos credPct y credDays, 25 % y 15 días de ejemplo). En Créditos del personal solo se muestran.
- El aviso del pedido del personal usa el mismo cálculo que el cobro a crédito: el descuento no se aplica a combos, promociones ni docenas. Antes el aviso descontaba todo el pedido y podía diferir del cobro.

## v125 — Envío: 'más de S/ 70' y tarifa por cliente; Reservar mesa en un solo formulario (18/10/2026)
- Alineado con el bot real: envío gratis solo si los productos pasan de S/ 70 (valor por defecto del mockup y del chatbot; se puede volver a 'desde' en Configuración > Entrega).
- Tarifa especial por cliente (como costo_delivery_fijo y descuento_delivery del bot): dos columnas nuevas en Clientes, Envío fijo (s/) y Descuento de envío (%), editables solo por el administrador. Se aplican en Nuevo pedido (cliente con cuenta) y en la carta (cliente que inició sesión). El chatbot del mockup no sabe quién escribe, así que no las usa. Probado: fijo 2, 50 % de 4 = 2, sin tarifa = 4, S/ 70 exactos cobra, S/ 80 gratis.
- Reservar mesa: formulario único con 4 pasos numerados (nombre y celular opcional; personas con + / − y atajos; hora exacta con selector y sugerencias cada 30 min dentro del horario; mesa por botones que muestran asientos y piso, o 'Elegir en el plano') y un resumen antes de guardar. Valida hora pasada, fuera de horario, mesa sin asientos suficientes. Probado con el arnés; no visto en navegador.

## v126 — Delivery: la ubicación actual fija la zona y el envío (18/10/2026)
- Carta virtual: en el carrito, con delivery, hay un botón grande Usar mi ubicación actual. Antes el envío aparecía con una zona supuesta (s/ 3) y las zonas a mano, con el texto No pudimos ubicarte. Ahora el envío dice Con tu ubicación y no se suma al total hasta que el cliente comparte su ubicación o elige su zona. Con la ubicación muestra Zona N y el costo; si queda fuera de cobertura avisa. Elegir la zona a mano quedó plegado en No puedo compartir mi ubicación.
- Al pedir sin ubicación ni zona, avisa y no envía.
- Administrativo (mozo, caja, call center): el botón de ubicación actual de Nuevo pedido > Delivery ahora también coloca el punto en el mapa y fija la zona y el envío (antes solo copiaba las coordenadas a la dirección).
- Probado con el arnés y una ubicación simulada (zona 2 = s/ 2; lejos = sin cobertura; S/ 80 = gratis). La ubicación real del navegador no se probó: depende del permiso del cliente y de que la carta se abra con https.

## v127 — Ubicación opcional; el equipo ubica en el mapa (18/10/2026)
- Carta: la ubicación actual ya no es obligatoria ni bloquea. Si el cliente la comparte, la dirección escrita es opcional; si no, la dirección escrita es obligatoria (etiqueta dinámica). Si el navegador niega el permiso, el mensaje dice que no hay problema y que un asesor le ayudará a ubicarla. El envío dice Lo confirmamos contigo hasta tener zona; elegir la zona a mano es opcional. El pedido marca ubicPend.
- Administrativo: en el detalle de un pedido de delivery, mozo, cajero, call center y administrador tienen el botón Ubicar en el mapa (o Corregir ubicación). Abre el mapa con el puntero, fija zona y envío, recalcula el total y guarda con confirmación; si el punto cae fuera de cobertura no guarda.
- Cupón: la etiqueta dice ¿Tienes un cupón? (opcional).
- Pago por WhatsApp (ya estaba): la carta no recibe capturas; el equipo (admin, cajero, mozo, call center) habla con el cliente por WhatsApp y sube la captura al confirmar el pedido.

## v128 — Cumpleaños con calendario y campanita de notificaciones (18/10/2026)
- Carta: al crear la cuenta, el cumpleaños se elige en un calendario (campo de fecha) y se guarda como día/mes (sin año). Lo mismo en el administrativo (Nuevo cliente y registro rápido en Nuevo pedido). Correo personal sigue opcional.
- Carta: con la sesión iniciada aparece una campanita junto a Ingresar y el carrito, con contador de nuevas. Panel: en el mes del cumpleaños llega el aviso ¡Feliz cumpleaños! con el cupón de cumpleaños vigente (CUMPLE25) y un botón para usarlo; si el cumpleaños es otro mes avisa cuándo llegará; si no hay cumpleaños guardado, ofrece un calendario para agregarlo; también muestra los puntos. Las nuevas se marcan al abrir el panel y se recuerdan por cliente en el navegador.
- Probado con el arnés y fechas simuladas. Los avisos son del mockup: en el sistema real el cupón de cumpleaños se emitiría por cliente (hoy el cupón de ejemplo es único y vale para todos). No visto en navegador.

## v129 — Propuesta a S/ 3,500 y cumpleaños obligatorio (18/10/2026)
- Propuesta comercial (Propuesta.dc.html): total S/ 3,500 en cuatro partes de S/ 600, 800, 1,000 y 1,100 (acumulado 600, 1,400, 2,400, 3,500). El reparto entre partes es mío y se puede cambiar; los plazos (2, 3, 3 y 4 semanas) no se tocaron aunque el alcance creció.
- Dos láminas nuevas (3 y 4): lo que se agregó al prototipo (carta con ubicación opcional y cuenta con campanita, pedidos y caja con pedido del personal y pago confirmado por WhatsApp, reservas, bandeja de mensajes con Pulir, delivery por zonas, control del local). Ahora son 12 láminas; fecha 18/10/2026. Se anotó que Pulir con IA es opcional y se paga por uso.
- Cumpleaños obligatorio al crear la cuenta en la carta, en Nuevo cliente (solo personas; las empresas no) y en el registro rápido de Nuevo pedido.

## v130 — Sin elegir zona en la carta; todo pedido de delivery se ubica antes de confirmarse (18/10/2026)
- Carta: se quitó Sabes tu zona, elígela. El cliente solo comparte su ubicación actual (opcional) o escribe su dirección (obligatoria solo si no la compartió), con ejemplo Lima, San Juan de Lurigancho, Mz. B Lote 5. Sin ubicación, el envío dice Lo confirmamos contigo y avisa que un asesor lo ubicará por WhatsApp. Con ubicación, la dirección escrita es opcional.
- Administrativo: no se puede confirmar un pedido de delivery que no tiene ubicación (ni zona); el aviso manda a usar Ubicar en el mapa en el detalle del pedido. Los pedidos de ejemplo de delivery anteriores sin coordenadas piden lo mismo.

## v131 — Chatbot: cambios después de pedir y mensajes libres (18/10/2026)
- Chatbot (simulador): ahora tiene cuadro para escribir. Entiende lo básico: cambio de dirección o ubicación, cambio o cancelación del pedido, cuánto falta, hablar con una persona, hacer un pedido y saludos. Un mensaje que no entiende se repregunta una vez y a la segunda pasa a una persona. Los cambios los decide una persona: el bot solo avisa.
- Respuesta según el estado del pedido (por confirmar, en preparación, en camino, entregado): por ejemplo, con el pedido ya en camino no cambia la dirección y avisa como urgente. Cuánto falta responde con el estado y el tiempo prometido; si ya pasó, se disculpa y avisa al equipo.
- Menú nuevo Mi pedido. Controles de la maqueta para simular: el cliente escribe tras pedir, estado del pedido y minutos transcurridos.
- Cada aviso a una persona se guarda y aparece en Mensajes de WhatsApp como chat que Requiere atención, con una tarjeta (tipo, detalle, estado del pedido, botón Abrir el pedido) y en el pedido como Escribió por WhatsApp. Suena el aviso del sistema.
- Dirección escrita: el simulador ya no la rechaza; la acepta y avisa que un asesor ubica y confirma el envío (el resumen dice lo confirma un asesor).
- Límites: el simulador interpreta con palabras clave; el bot real con IA lo haría mejor y habría que conectarle el estado real del pedido. No he revisado el bot real.

## v132 — Juntar varias mesas en pedidos y reservas (18/10/2026)
- Reservar mesa: la reserva acepta una o varias mesas (botones o plano). Muestra los asientos sumados contra las personas (ej. 6 de 8, falta 2) y no guarda si no alcanzan. Guarda una marca por mesa (con el grupo) y el resumen lista todas.
- Nuevo pedido en el local: nuevo modo Juntar varias mesas en el plano (junto a Tomar pedido y Liberar o marcar mesa). Se tocan todas las mesas, aparece la barra con las mesas y los asientos y Continuar. Un solo pedido ocupa todas las mesas; se muestra como Mesa 1 + Mesa 2 + Mesa 3 en tickets, listas y precuenta, y se liberan juntas al cobrar. Tomar pedido con una mesa sigue siendo de un solo toque.
- Pendiente: las solicitudes de reserva que llegan por WhatsApp se siguen aprobando con una sola mesa. Probado con el arnés; no visto en navegador.

## v133 — Ubicar pedido más ordenado; las zonas nunca se muestran ni se eligen (19/10/2026)
- Ubicar el pedido / Nuevo pedido delivery: pantalla en dos columnas. Izquierda: resumen del pedido (qué escribió el cliente), datos, sugerencia y dirección y referencia. Derecha: mapa, resultado (zona interna, envío y cómo cambia el total) y botón. Se quitaron el cobro en efectivo y la ubicación del equipo de la pantalla de ubicar.
- Sugerencia por número o por cuenta: si el cliente ya pidió antes, propone su dirección y, si tiene punto guardado, lo pone en el mapa de un toque (prefiere el pedido más reciente que ya tenía ubicación). Ya no se sugiere el mismo pedido que se está ubicando.
- Las zonas son internas: se quitaron los botones Zona 2 a Zona 7 y Fuera de cobertura del administrativo (la zona sale sola del punto del mapa). La carta y el chatbot ya no dicen zona al cliente: solo el costo del envío, o el aviso de fuera de cobertura.

## v134 — Pago por WhatsApp automatizado (el bot pide, la persona decide) y chats de ejemplo como el bot real (19/10/2026)
- Cuando llega un pedido de la carta (delivery o para llevar), el bot abre un chat y le escribe al cliente: recibimos tu pedido, total, ¿cómo prefieres pagar? Según el medio le manda los datos de pago de Configuración y el monto, o pregunta con cuánto paga (efectivo), y espera la captura. La persona solo entra cuando llega el comprobante: tarjeta Comprobante por revisar con Aprobar y enviar a cocina o Rechazar (el bot pide otra captura). Aprobar registra el cobro y manda el pedido a cocina; un delivery sin ubicación no se puede aprobar hasta ubicarlo en el mapa.
- Para que persona y bot no se crucen: cada chat tiene un solo dueño (Bot o Persona). La franja dice quién lo atiende; Tomar el chat / Soltar el chat; si lo atiende otra persona, no se puede escribir ni aprobar sin tomarlo; si el cliente escribe mientras lo atienden, el bot no responde; «urgente» cede al instante y marca el chat como URGENTE. Faltan en la maqueta: la liberación automática por inactividad y la conexión con WhatsApp real.
- Para probar: fila Simular al cliente (solo en la maqueta) con las respuestas del cliente.
- Chats de ejemplo de Mensajes de WhatsApp reescritos con el comportamiento real del bot (prompt.py): saludo de Capri, pide tamaño y sabor con precios, ¿Deseas agregar algo más?, modalidad, reutiliza la ubicación guardada, confirma nombre y celular, resumen del pedido, datos de pago solo tras confirmar, comprobante con la respuesta exacta del bot, cancelo con 100 = efectivo. Reconstruidos desde las reglas, no copiados de conversaciones reales ni con los datos de pago reales.

## v135 — Chats de ejemplo según el flujo por opciones del chatbot (19/10/2026)
- Los cuatro chats de Mensajes de WhatsApp ahora son los mismos textos y pasos del mockup del chatbot (flujo por botones y listas), generados ejecutando el propio chatbot: menú, modalidad, ubicación, categoría, producto, presentación, leche, endulzante, extras, resumen, pago y cierre. Ejemplos: delivery con Yape (con la captura por revisar), para recoger con efectivo, una consulta de lactosa y pasar a una persona.
- Nota: el bot real hoy saluda con dos botones (Carta / Ya sé qué pedir) y luego conversa con IA en texto libre; el mockup del chatbot es el flujo por opciones que se propone. No se mezclaron.

## v136 — Primer mensaje del bot con el resumen y el aviso de ubicación (19/10/2026)
- Al llegar un pedido de la carta, el bot manda el resumen del pedido (cliente, contacto, modalidad, dirección, productos, envío, total) y la pregunta de cómo paga. Si el cliente no puso ubicación, el envío dice que lo confirma un asesor y el bot añade: «En unos instantes un asesor se pondrá en contacto contigo para ayudarte a validar tu comprobante de pago y la ubicación de entrega. Gracias.»
- Se documentó todo en `flujo-pago-whatsapp-y-ubicacion.md` y en el BRD v1.38.

## v137 — Alta demanda configurable (19/10/2026)
- Minutos extra: atajos de +5 a +60 y un campo Otro (min) de 1 a 180.
- Pausar pedidos reemplaza «Pausar el bot» (carta y chatbot dejan de recibir pedidos) y solo vale con la alta demanda activada; antes la pausa seguía bloqueando la carta con la alta demanda apagada.
- Textos de ayuda y de confirmación actualizados. Probado con el arnés.

## v138 — Registrar movimiento: solo insumos con stock (19/10/2026)
- En Salida, Merma y Devolución la lista de insumos muestra solo los que tienen stock mayor que cero, cada uno con su stock actual (por ejemplo «Leche entera · 18 L»). Un botón «Mostrar también los de stock 0 (N)» los muestra todos y otro vuelve a ocultarlos. En Entrada se muestran todos, porque lo que llega puede venir de stock cero. Si hay un insumo ya elegido sin stock, sigue visible. Probado con el arnés.

## v139 — Movimientos: Cocina solo merma de productos de cocina; Almacén gestiona el resto (19/10/2026)
- Cocina: solo Merma; el origen solo puede ser Cocina, Barra o Producción; solo se ofrecen productos de cocina (los de producción del día: donas, galletas, pan pullman, gelatina) que existen y tienen stock. Ya no aparecen leche, harina ni pollo (eso es de Almacén). El botón de merma de cocina ya no arranca con «Leche entera».
- Almacén: gestiona entradas, salidas, mermas y devoluciones de todos los insumos. Origen según el tipo: Entrada (Proveedor o Producción), Salida (Almacén central), Merma (Almacén central, Cocina, Barra o Producción), Devolución (Cocina, Barra o Producción). Una entrada o salida de un proveedor es de Almacén, no de Cocina.
- Cantidad: el campo solo acepta números (con punto o coma decimal); las letras se descartan al escribir. No deja registrar más de lo que hay en stock ni un producto que no existe en la lista.
- Devolución se quedó solo en Almacén (para cuando regresa un sobrante y alguien decide anotarlo); el caso «pidió 10 huevos y usó 5» no se controla, porque el sistema no lo ve.
- Pendiente: los insumos no tienen todavía un área propia (cocina, barra, almacén); por eso el criterio de cocina es «producto de producción del día». La merma de barra (por ejemplo calibrar café) quedaría en Almacén hasta tener área por insumo.

## v140 — Merma de varios productos a la vez (19/10/2026)
- Botón «Merma de varios productos» en Cocina y en Almacén. Una lista con todos los productos que tienen stock (en Cocina solo los de cocina); en cada línea se pone la cantidad o se toca «Todo», y cada línea tiene su propio origen (Cocina, Barra, Producción y, en Almacén, Almacén central) y su propio destino (Donación, Personal, Desecho, Caída, Error de comanda, Calibración). Arriba se elige «qué se hace con todo» (por defecto Desecho) y cada línea puede cambiarlo. «Todo lo que hay» y «Limpiar».
- La cantidad solo admite números y no puede pasar del stock; un resumen dice cuántos productos y unidades; al confirmar se registra un movimiento de merma por línea y se descuenta el stock. Probado con el arnés (todas las donas, 5 galletas, 1 pan; destinos distintos).

## v141 — Producción sin stock negativo, barras de stock y filtros de Almacén (19/10/2026)
- Registrar la producción: si las tandas piden más materia prima de la que hay, las líneas que no alcanzan salen en rojo con «FALTAN N», aparece un aviso con lo que falta y cuántas tandas sí alcanzan, y un botón «Usar N tandas (lo máximo que alcanza)». No deja registrar y el stock nunca queda en negativo (antes el aviso solo salía al guardar). Tandas y cantidad total solo aceptan números (punto o coma).
- Stock y recetas: cada insumo tiene una barra de qué tan lleno está frente a su máximo, con marcas del mínimo y del medio, el porcentaje y una palabra (Agotado, Por acabarse, Poco, Bien, Lleno); filtros con conteo y uno nuevo de Agotados. Se reorganizó cada insumo: nombre y estado, barra, cantidad, vencimiento y botones.
- Almacén (movimientos): filtros más claros. Chips de tipo con conteo (Todos, Entradas, Salidas, Mermas, Devoluciones; antes faltaba Devolución), chips de fecha (Todas, Hoy, Ayer, Últimos 7 días) y Desde/Hasta con calendario; el tipo y el origen (con Producción) también están en Filtros. Las fechas de los movimientos de ejemplo no llevan año (se asume 2026) y «Hoy» es el 15/10 del mockup.

## v142 — Primer ingreso: contraseña nueva y foto (19/10/2026)
- Inicio de sesión: control de la maqueta «Estado del usuario»: «Ya cambió su contraseña» (por defecto, entra directo) o «Usuario nuevo (primer ingreso)». Con usuario nuevo, la nota recuerda que la contraseña inicial es 123456.
- Pantalla de primer ingreso: bienvenida, contraseña nueva y repetirla, botón Ver/Ocultar contraseña, reglas con marca (6 caracteres, distinta de la inicial, iguales), foto de perfil opcional (subir, cambiar, quitar) y «Guardar y entrar». Al guardar, el usuario deja de ser nuevo y la foto queda en su perfil.
- No se guarda ninguna contraseña. Documentado en `primer-ingreso-y-contrasenas.md` y en el BRD v1.39 (NEC-CAP-099, RN-CAP-119 y 120; RN-CAP-098 actualizada).

## v143 — Cerrar el día con todos los productos del día y filtros de Almacén plegables (19/10/2026)
- Cerrar el día con conteo: ya no sale solo la dona. Salen todos los productos del día que tienen stock (donas, galletas choco chips, pan pullman, gelatina; las donas primero). En cada línea: lo contado (por defecto lo del sistema), cuánto se bota (con botón «Todo»; las donas arrancan en «todo», los demás en 0) y a dónde va (Donación, Personal o Desecho; arriba se elige uno para todos y cada línea lo cambia). Lo que no se bota sigue en el stock; si se contó menos de lo que dice el sistema, la diferencia queda como merma «Diferencia de conteo». Cada línea muestra el resultado («se bota 10, queda 10, diferencia 4»); solo números; no se puede botar más de lo contado ni contar más que el sistema.
- Almacén: los filtros nuevos (tipo, fecha, desde y hasta) pasaron dentro del botón Filtros, plegados como en las demás pantallas; el botón muestra cuántos filtros hay activos, el resumen «Filtrando» incluye las fechas y «Limpiar» también las borra.

## v144 — Cocina y Almacén separados por pantalla, no solo por rol (19/10/2026)
- Antes la separación dependía del rol: un administrador que abría la merma desde Cocina veía leche, harina y demás insumos. Ahora depende de la pantalla: en Cocina (con cualquier rol) solo salen productos de cocina (donas, galletas choco chips, pan pullman, gelatina), solo Merma y origen Cocina, Barra o Producción; en Almacén (con cualquier rol) solo salen los insumos con los que se prepara (leche, azúcar, harina, huevos, pollo, café, etc.), con Entrada, Salida, Merma y Devolución. Lo mismo vale para «Merma de varios productos» y para Stock y recetas.
- La Entrada de Almacén tiene como origen solo Proveedor (la producción entra por «Registrar la producción», no por movimientos).
- Se actualizó RN-CAP-115 del BRD.

## Documentación (19/10/2026)
- Nuevo `flujo-cocina-y-almacen.md` (FLU-CAP-004): pantallas de Cocina y Almacén, movimientos, merma de varios productos, producción, cierre del día, stock y filtros de Almacén, alta demanda, y lo pendiente.
- BRD v1.40: NEC-CAP-100 a 103 y RN-CAP-122 a 124 (zonas editables, áreas de cocina, cocina y almacén separados, alta demanda).
- Propuesta comercial actualizada con las láminas de lo agregado después (ver más abajo si se publicó una versión nueva).

## v147 — Entregas fallidas del repartidor (19/10/2026)
- Configuración del local > Entregas fallidas: tiempo de espera (10 min), intentos (2), plazo de coordinación por WhatsApp (120 min), recargo por reprogramar (s/ 0) y recomendación (devolver el dinero o cobrar igual).
- Repartidor: «Cliente no contesta» y «No encuentro la dirección» cuentan intentos («Intento 1 de 2») y muestran cuánto esperar; escribe, o escribe caja o call center, la dirección corregida; «Ya se resolvió: sigo con la entrega»; «Devolver a la tienda» (avisa cuando ya se llegó al máximo).
- Devuelto: el pedido queda en coordinación (nadie puede tomarlo), llega la notificación «Pedido devuelto a la tienda» y en el detalle aparece el panel «Entrega fallida»: WhatsApp con mensaje listo, destino de lo preparado y tres cierres: reprogramar (con recargo opcional), devolver el dinero (abre la anulación con el motivo «Cliente no recibió») o cobrar igual (solo si ya estaba pagado). Lo preparado queda como merma informativa sin tocar el stock.
- Documentado en `flujo-entregas-fallidas.md`; propuesta de stock por área en `flujo-cocina-y-almacen.md` 8.1; BRD v1.41 (NEC-CAP-104, RN-CAP-125 a 127). No hay reloj que haga cumplir los tiempos en el mockup.

## v148 — Stock por área con «por recibir» y pantalla de Workflows (19/10/2026)
- Stock por área: el almacén central y cocina o barra tienen cada uno su stock. «Entregar desde el almacén» (o una Salida con destino Cocina o Barra) baja el almacén y deja la entrega «por recibir»; Cocina o Barra confirma con «Recibí» (con la cantidad real; si llegó menos, queda «recibido con diferencia») y recién entonces sube su stock; aviso a Cocina de las entregas por recibir. Las ventas por receta bajan del área primero (y del almacén solo si el área no alcanza, avisándolo); la merma y la devolución desde Barra o Cocina bajan el área. En Stock y recetas cada insumo muestra «En almacén» y «En Barra/Cocina · por recibir». Probado con el ejemplo de la leche (compra 40 L, entrega 10 L, recibe 9, venta de un frappé, merma y devolución).
- Los números iniciales cambian: el área parte con el 10 % de cada insumo y el almacén con el resto (por ejemplo, leche entera: 16.2 L en almacén y 1.8 L en la Barra).
- Nueva pantalla del artifact **Workflow.dc.html** (Workflows: categorías a la izquierda y, por proceso, diagrama por carriles, reglas clave y pendientes): 7 categorías y 15 workflows, entre ellos el de compra, entrega a cocina y venta de la leche. Se agregó al lienzo del artifact (canvas.json).

## v151 — Aclaración del flujo de stock (19/10/2026)
- Se aclaró en la pantalla de Workflows y en `flujo-cocina-y-almacen.md`: el proveedor entrega y el almacenero registra la Entrada; «Entregar desde el almacén» (Salida a la Barra) es un movimiento físico que no consume nada (el total de la tienda no baja); el total solo baja con la venta (receta) o la merma. Se agregaron los totales paso a paso en el ejemplo de la leche.

## v152 — Workflows: flujo general de la carta virtual y de cada módulo (19/10/2026)
- La pantalla de Workflows ahora tiene tres grupos en el menú: **Carta virtual** (flujo general del ingreso al pedido, cuenta con puntos y campanita, libro de reclamaciones y encuesta), **Procesos de punta a punta** (los detallados: pago por WhatsApp, ubicación, entrega fallida, bot y persona, mesas y reservas, cocina, almacén, acceso) y **Módulos del administrativo** con un flujo general de cada uno: Operación (escritorio, pedidos y caja, mensajes, caja y cierres, cocina, repartos, reservas), Clientes y ventas (clientes, créditos del personal, productos, ofertas), Compras y stock (compras, almacén, stock y recetas), Análisis (informes, mapa de entregas, indicadores) y Configuración (configuración del local, diseño de la carta, novedades y destacadas y paleta, usuarios, pantallas y plano, notificaciones). En total 41 workflows en 13 categorías. Escritos desde lo que hace el mockup; los informes e indicadores son estructura de ejemplo.

## v153 — Repartos y Reservas con un diseño más ordenado (19/10/2026)
- Repartos: arriba, tarjetas de resumen que también filtran (Todos, Disponibles, En ruta, Con problema, Entregados, con su conteo); lista ordenada por urgencia (con problema, en ruta, disponibles, entregados). Cada pedido es una tarjeta con borde de color según su estado: código y estado, total y medio de pago, cliente con botones Llamar y WhatsApp, dirección con referencia en un recuadro con Google Maps y Waze, avisos (cobro en efectivo, coordinación, intento fallido), la acción principal grande (Tomar este pedido o el siguiente paso) y, al final, «Más opciones» plegado con reportar un problema, reasignar y el simulador del prototipo. La explicación del módulo quedó en «¿Cómo funciona?» plegado.
- Reservas: botón «+ Nueva reserva» directo, tarjetas de resumen (solicitudes por atender, reservas de hoy, confirmadas, pendientes), solicitudes por WhatsApp como tarjetas (con inicial, datos, mesas libres como botones y Aprobar o Rechazar; las ya resueltas plegadas), y una agenda de hoy en orden de hora con el estado en vivo («Llega en 20 min», «Se espera ahora · vence en 5 min», «Pasó la tolerancia: se anula sola»). Debajo sigue la tabla con búsqueda y filtros, ahora con su título.

## v154 — Las mesas se eligen siempre en el plano (19/10/2026)
- Reservas > Solicitudes por WhatsApp: ya no hay botones «Mesa 3 · 4». Cada solicitud tiene el botón «Elegir la mesa en el plano»: abre el dibujo del local (con piso, libre, ocupada, reservada y elegida), el título dice «Mesa para Camila Ríos · 4 personas · 19:30», se tocan una o varias mesas y la barra de abajo suma los asientos contra las personas («Mesa 1 + Mesa 2 · 4 asientos para 4 personas»); no deja cerrar si faltan asientos. La tarjeta muestra la mesa elegida y recién ahí se puede aprobar.
- Nueva reserva (formulario): la lista de mesas se reemplazó por el plano del local dentro del propio formulario (paso 4), con leyenda y contador de asientos; ya no hay un botón aparte «Elegir en el plano».
- Se actualizó el workflow de Reservas en la pantalla de Workflows.

## v155 — Tamaños, opciones y grupos se eligen de una lista (con crear y editar ahí mismo) (19/10/2026)
- Productos > Opciones y tamaños: el nombre de cada tamaño (Regular 12 oz, Grande, Extra…), de cada opción (Leche entera, Stevia, Chantilly…) y el tipo de grupo (Tipo de leche, Extras…) ya no se escribe: se elige en una lista desplegable. Solo el precio se escribe (y solo acepta números). Las listas parten de lo que ya existía en la carta.
- Sin módulo nuevo: la lista es flexible, ahí mismo. Se escribe en su buscador y, si no existe, aparece «+ Crear «Leche de coco»» (queda en la lista y se elige al instante; el nombre se normaliza: espacios y mayúscula inicial; si ya existe, no se duplica). Cada nombre tiene un lápiz para corregirlo en tiempo real: Guardar (el cambio se refleja en lo que se está editando) u Ocultar (deja de ofrecerse; nada se elimina). Lo ya usado en el mismo producto o grupo sale marcado «(ya está)» para no repetirlo.
- Las listas se guardan en la configuración compartida (clave catalogo) para que sean las mismas para todos; en el sistema real serían una tabla aparte.
- Ofertas y descuentos: en la promoción aparece «Usar el nombre sugerido» armado con sus componentes, para no escribir el nombre a mano ni cometer errores (por ejemplo «LATTE COFFE»).
- Pendiente: que un nombre corregido con el lápiz también se actualice en los productos que no se están editando en ese momento.

## v156 — Listas y categorías: cada apartado con su propia lista y un módulo para administrarlas (19/10/2026)
- Corrección de v155: los combos de Opciones y tamaños ya no mezclan todo. El combo de **Tamaño** solo muestra tamaños; el de **Tipo de grupo**, solo tipos de grupo; y el de **Opción** solo las opciones de la categoría del grupo (en Endulzantes solo azúcar, stevia…; en Tipo de leche solo leches; en Extras de salados solo huevo, tocino, jamón…).
- Categorías predefinidas: Tamaños y presentaciones, Tipos de leche, Endulzantes, Shots de espresso, Extras de bebidas, Adicionales de waffles, Cremas, Acompañamientos, Extras de salados, Otras opciones y Tipos de grupo. Cada tipo de grupo usa una categoría de opciones.
- Módulo nuevo **Productos ▸ Listas y categorías** (menú Clientes y ventas, debajo de Productos): categorías a la izquierda con su conteo; a la derecha, la lista de la categoría elegida con formulario «Agregar a la lista», editar nombre (✎), ocultar/activar y cuántos productos usan cada elemento. «+ Nueva categoría» crea una categoría de opciones vacía (por ejemplo Salsas) que además aparece como tipo de grupo. Se puede renombrar una categoría; un tipo de grupo elige de qué categoría toma sus opciones.
- Sigue siendo flexible: dentro del combo se puede seguir creando o corrigiendo un nombre en el momento; va a la categoría correcta.
- Nada se elimina (se oculta) y no se repiten nombres. Se guarda en la configuración compartida (clave catalogo, nuevo formato por categorías; las listas de v155 se reconstruyen).
- Pendiente: que un nombre corregido se actualice también en los productos que ya lo usan; en el sistema real, las categorías y elementos son tablas aparte.

## v157 — Tamaños separados de las presentaciones (19/10/2026)
- Corrección de v156: la lista «Tamaños» aún mezclaba Cajita, Unidad, Tajada, 1/2 docena, etc. Ahora son dos categorías: **Tamaños de bebida** (Regular 12 oz, Grande 16 oz, Extra 20 oz…) y **Presentaciones y porciones** (Cajita, 1/2 docena, Waffle completo, Porción 350 g, Bandeja de 4, Tajada…).
- En Opciones y tamaños, un producto de bebida (frappés, iced, frozen, calientes) solo ve los tamaños de bebida; cualquier otro producto solo ve las presentaciones. Lo que se cree desde el combo va a la lista que se está viendo.
- Las listas ya guardadas se separan solas; ambas se administran en Listas y categorías.

## v158 — Categorías de la carta gestionables (19/10/2026)
- Antes las categorías (Frappes, Iced, Frozen, Calientes, Waffles, Salados, Croissants, Postres) eran fijas. Ahora el administrador puede crear más (Pizzas, Hamburguesas…) sin tocar código.
- **Nuevo producto**: junto a las categorías hay «+ Nueva categoría». Pide el nombre y cómo se venden sus productos: **con tamaños y opciones** (como un cappuccino) o **se vende fijo** (como la media docena de donas). Si lleva opciones, se elige qué preguntas se le hacen al cliente (tipo de leche, endulzante, cremas…). La categoría queda elegida al crearla.
- Al agregar un producto de una categoría con tamaños y opciones, se abre solo **Opciones y tamaños** para armarlos; en una categoría fija solo se piden nombre y precio y el botón de opciones no aparece.
- **Listas y categorías ▸ Categorías de la carta** (primer elemento del módulo): lista de todas las categorías con su número de productos, si llevan tamaños y opciones (botón para cambiarlo), mostrar/ocultar, crear nuevas y renombrar las creadas por el administrador (las originales no se renombran).
- La categoría nueva aparece en: filtros de Productos, Nuevo pedido, Diseño de la carta (orden), combos (categorías de las que se puede elegir), grupos de opciones y la carta virtual (se lee de la configuración compartida, clave `catsExtra` y `catsOpc`).
- Pendiente: el chatbot aún no lista las categorías nuevas por nombre; las categorías ocultas no se guardan entre sesiones (igual que las demás listas de gestión); en el sistema real son una tabla aparte.

## v159 — Preguntas nuevas al crear una categoría y ventanas más anchas (19/10/2026)
- Al crear una categoría con tamaños y opciones, la lista «¿Qué se le pregunta al cliente?» ahora tiene «+ Nueva pregunta» (por ejemplo Tipo de masa, Salsas, Punto de cocción): se escribe el nombre, queda creada, marcada para esa categoría y también en la lista de tipos de grupo. Se crea sin opciones; se arman después en Opciones y tamaños.
- Todas las ventanas (Nuevo producto, Opciones y tamaños, Constructor de combos, Registrar compra, Cobrar, etc.) son más anchas (hasta unos 1100 px en pantallas grandes) para aprovechar los lados; en móvil siguen ocupando el ancho disponible. Notificaciones queda igual.

## v160 — Productos: más a la vista y «Ver todos» (19/10/2026)
- La lista de Productos mostraba solo 8 por página, así que parecía que faltaban productos (la carta tiene 66 y el módulo los cuenta todos). Ahora muestra 24 por página, dice «Mostrando 24 de 66 productos» y tiene el botón «Ver todos en una sola lista» (y «Paginar de 24 en 24» para volver).

## v162 — Corrección: error al renderizar con categorías nuevas (19/10/2026)
- Con una categoría creada por el administrador (por ejemplo Pizzas) ya guardada en la configuración, el administrativo fallaba al dibujarse («Cannot read properties of undefined (reading 't')»): Diseño de la carta buscaba el título de cada categoría en una tabla fija. Ahora usa el nombre de la categoría cuando no está en la tabla y tolera categorías sin productos ordenados.
- Lección: las pruebas anteriores corrían con la configuración vacía; ahora también se prueban con configuración guardada (categorías nuevas, listas de versiones anteriores, grupos sin opciones) y en todas las pantallas y roles.

## v163 — «¿En qué categorías se pregunta?» sale de la ventana del producto (19/10/2026)
- En Opciones y tamaños de un producto ya no están las categorías enteras (Frappes, Iced, Postres…): confundían, porque desde ahí se editaba un solo producto y tocarlas cambiaba la regla para decenas. Cada grupo muestra solo el botón «Se pregunta en este producto» y una línea informativa: «Además, este grupo se pregunta en todos los productos de: …».
- Esa decisión general pasó a **Listas y categorías ▸ Dónde se pregunta cada grupo**: cada grupo de opciones con las categorías marcables, cuántos productos lo llevan y cuántas opciones activas. El cambio vale para todos los productos de las categorías marcadas.

## v164 — Se quita «Usar estos tamaños y precios en todos los productos de la categoría» (19/10/2026)
- Opciones y tamaños ya no tiene ese botón: reemplazaba los tamaños y precios de todos los productos de la categoría sin deshacer. Cada producto se edita por separado.

## v165 — Armar oferta: «lleva N, paga M» a medida, con tope de unidades (19/10/2026)
- Revisión de la ventana «Armar oferta» (Llevas más, pagas menos). Fallos encontrados: (1) al agregar «un tipo con sabores» (galleta, dona) se cambiaba el **tipo de la promoción** a «galleta» (se mezclaban dos cosas distintas); (2) solo existían 2x1 y 3x2 y la cantidad no se relacionaba con el contenido: se podían poner 17 productos en una promo «2x1»; (3) se podía agregar la categoría **Combos** dentro de una promoción (circular); (4) el nombre sugerido era ilegible («17 × … + 2 × a elección en…»); (5) el precio era libre sin ninguna ayuda.
- Ahora: **Lleva [−N+] · Paga [−M+]** con cualquier combinación (5x4, 4x3…), atajos 2x1, 3x2 y las que se hayan guardado; cada combinación guardada aparece como tipo en Ofertas.
- **Restricción por contenido**: el contenido debe sumar exactamente lo que lleva. Un 2x1 de frappés = «2 × a elección en Frappes»: solo permite dos frappés. Contador «Llevas 1 de 2 (falta 1)»; no deja agregar de más ni guardar incompleto; Paga debe ser menor que Lleva.
- **Precio sugerido**: paga los M más caros de los N (botón «Usar»), editable.
- Nombre sugerido corto: «2x1 en Frappes», «2x1 LATTE COFFE». Se quitó «Combos» como componente.
- La ventana es más ancha. También se ensancharon las ventanas que no se habían ensanchado en v159.
- Pendiente: la carta y Nuevo pedido siguen cobrando el precio fijo de la promoción; no calculan la mezcla en el carrito (ver reglas de aplicación de promociones).

## v166 — Nuevo pedido avisa cuando una promoción «lleva N, paga M» aplica (19/10/2026)
- En Nuevo pedido (mozo, cajero, call center) el pedido se compara con las promociones activas, vigentes y válidas en ese canal. No hace falta configurar nada más en el administrativo: se usa el «Lleva N, paga M» y el contenido de la oferta.
- Si el pedido **ya califica** (por ejemplo, dos frappés para un 2x1): aviso «El pedido califica para «2x1 en Frappes»: pagas s/ 14.50 en vez de s/ 31 (ahorra s/ 16.50)» con el botón **Aplicar la promoción**, que reemplaza esas unidades por la promoción.
- Si **falta poco**: «Con 1 más (Frappes) se aplica «2x1 en Frappes» a s/ 14.50.» (solo informa).
- Nunca cambia el cobro solo: el personal decide. No avisa si la promoción no ahorra. Muestra como máximo dos avisos.
- Pendiente: la carta virtual del cliente (aún no muestra estos avisos), promociones con «un tipo con sabores» y empate entre varias promociones.

## v167 — Corrección: la promoción x por y no borra los adicionales (19/10/2026)
- Fallo encontrado probando: con 2 ICED COFFE con adicionales (shot extra, sirope de cacao, bola de helado; s/ 28 en total), «Aplicar la promoción» los reemplazaba por una línea a s/ 9 y **se perdían los adicionales** (y su cobro).
- Ahora la promoción se aplica como **descuento**: los productos se quedan en el pedido (con sus adicionales y su descuento de stock) y se resta solo la diferencia de los precios base respecto al precio de la promoción. Ejemplo: 28 − 9 = **s/ 19** (9 por los cafés y 10 de adicionales). El renglón dice «Promoción: 2x1 ICED COFFE − s/ 9» y tiene «Quitar».
- Si el pedido cambia y ya no cubre la promoción (por ejemplo, se quita un café), el descuento se retira solo. El pedido guarda `descPromo`.
- Cada línea guarda ahora su precio base (`base`) para poder separar adicionales.
- Pendiente: regla de acumulación entre promoción, descuento automático y cupón (hoy se suman).

## v168 — Los avisos de promoción valen para todas las promociones «lleva N, paga M» (19/10/2026)
- La regla (avisar cuando el pedido califica, aplicar como descuento sin tocar adicionales) ya usaba todas las promociones activas, vigentes y válidas en el canal; se confirmó con varias a la vez (2x1 ICED COFFE y un 3x2 de Iced): cada una se ofrece y, al aplicar una, la otra se recalcula con las unidades que quedan libres.
- Se respeta el **«Límite por pedido»** de cada promoción: no se ofrece de nuevo si ya se aplicó esa cantidad de veces.
- Pendiente: promociones con «un tipo con sabores», carta virtual del cliente y regla de acumulación con descuentos y cupones.

## v169 — Promociones x por y: tipos con sabores, carta virtual y regla de acumulación (19/10/2026)
- **Tipos con sabores (donas, galletas…)**: una promoción como «2x1 Donas» (componente «un tipo con sabores») ya se detecta: las unidades del producto de ese tipo cuentan para la promoción (avisos y descuento).
- **Carta virtual del cliente**: el carrito avisa igual que Nuevo pedido: «Agrega 1 más (ICED COFFE) y se aplica…» o «Tu pedido califica para «2x1 ICED COFFE»: te ahorras s/ 9» con el botón **Aplicar la promoción**. Respeta días, horas, vigencia, «dónde vale» (web) y el límite por pedido. Se aplica como descuento sobre los precios base: los adicionales se cobran aparte. Si el cliente quita un producto y ya no califica, el descuento se retira solo. El pedido web guarda `descPromo`. Usa las promociones guardadas en el administrativo; si aún no se guardó ninguna, las de ejemplo.
- **Regla de acumulación** (Ofertas > Reglas «¿Se pueden juntar?»): con «No», entre la promoción, el descuento automático y el cupón se aplica solo el de mayor valor (el cupón no se acepta si ya hay promoción o descuento, con mensaje claro); con «Sí», se suman. Vale en Nuevo pedido y en la carta.
- Pendiente: el chatbot de WhatsApp no ofrece estas promociones; varias promociones iguales en el mismo pedido dependen del límite por pedido.

## v170 — El chatbot ofrece las promociones «lleva N, paga M» (19/10/2026)
- Mismas promociones que Nuevo pedido y la carta (las guardadas en el administrativo; si no hay, las de ejemplo), con los mismos criterios: día, hora, vigencia, límite por pedido y «dónde vale» (WhatsApp).
- Al agregar un producto, si falta poco para una promoción, el bot lo menciona en el mismo mensaje («🏷 Con 1 más (Frappes) se aplica «2x1 en Frappes»…»).
- Al pedir el resumen: si el pedido **califica**, pregunta «¿La aplico?» con botones **Sí, aplicar la promoción** / **No, gracias**; si **falta poco**, pregunta si quiere agregar otro producto o seguir sin la promoción. Nada cambia sin que el cliente acepte, y si dice que no, no se vuelve a ofrecer en ese pedido.
- El resumen muestra la promoción como una línea de descuento («Promoción 2x1 en Frappes — −s/ 14.50») y el total correcto; los adicionales se siguen cobrando aparte (el descuento es sobre los precios base).
- Limitación de la maqueta: el bot solo ofrece frappes, calientes, waffles y salados (con precios copiados dentro de su archivo), así que la promoción de ejemplo «2x1 ICED COFFE» no se activa en el bot; las promociones por categoría o de productos que el bot sí tiene (por ejemplo «2x1 en Frappes») funcionan.

## v171 — Reservas como calendario (19/10/2026)
- En Reservas, la «Agenda de hoy» se reemplazó por un **calendario mensual** (lunes a domingo): flechas ‹ › para cambiar de mes y botón **Hoy**.
- Cada día muestra cuántas reservas tiene: verde = confirmadas o atendidas, naranja = pendientes. El día de hoy lleva borde naranja y el elegido se pinta de azul.
- Al tocar un día aparece debajo su agenda (hora, cliente, personas, mesa y estado). Hoy conserva el «Llega en X min» y la tolerancia; los otros días muestran solo el estado. Los días sin reservas dicen «No hay reservas para este día».
- Siguen igual: tarjetas de resumen, solicitudes por WhatsApp y la tabla «Todas las reservas» con búsqueda y filtros.
- En la maqueta «hoy» es el 15/10/2026 y solo hay datos de ejemplo del 13 al 17 de octubre. Las solicitudes pendientes siguen en su panel y no se cuentan en el calendario hasta aprobarse.
- Pendiente: crear una reserva directamente desde un día del calendario con la fecha ya elegida (hoy «+ Nueva reserva» sigue siendo para hoy).

## v172 — Créditos del personal: consumo mensual, sin plazo ni abonos (19/10/2026)
- Cambio pedido por el dueño: el trabajador **no tiene plazo de 15 días para pagar**. Lo que consume con su usuario se **acumula por mes** y a fin de mes el administrador lo revisa; el descuento del pago se hace **fuera del sistema**.
- Créditos del personal ahora muestra **«Consumo del personal por mes»**: selector de mes (‹ ›), total consumido, trabajadores con consumo y número de consumos; cada trabajador con su total del mes y, al abrirlo, el detalle (fecha, documento, monto). Los que no consumieron salen al final, en gris.
- Se quitaron: el plazo (columna «Vence», estados Por vencer/Vencido/Pagado, el campo «Plazo para pagar» de Configuración y del módulo) y los **abonos** (botón y ventana «Registrar abono», y su ingreso a caja). La tabla queda como detalle: documento, trabajador, rol, fecha, monto con descuento y mes, con sus filtros.
- «Cobrar a crédito del personal» (Pedidos y caja) ahora dice «Se suma al consumo de octubre de X; se le descuenta a fin de mes, fuera del sistema», y suma a su mes. El escritorio muestra «Consumos del personal en octubre» en lugar de «Créditos por vencer».
- El crédito se consume solo desde Pedidos y caja; por la carta virtual no hay crédito (BRD RN-CAP-131).
- Pendiente de confirmar con el dueño: si el trabajador, al entrar a la carta con su usuario, puede cargar ese pedido a su consumo del mes (hoy no).

## v173 — Créditos del personal: qué consumió cada uno y una sola pantalla (19/10/2026)
- En el detalle de cada trabajador, cada consumo ahora lista **lo que se llevó** («2 × FRAPPE OREO», «1 × DÚO PARA COMPARTIR (combo)», «1 × 2x1 ICED COFFE (promoción)», «1 × DONAS ARTESANALES (docena)»…). Los consumos nuevos cobrados a crédito en Pedidos y caja guardan sus productos con el tamaño; los de ejemplo son datos de muestra.
- Créditos del personal queda con **un solo cuadro**: «Condiciones del crédito del personal» (descuento) y el consumo por mes. Se quitaron la tabla, los filtros, el buscador y la nota de abajo, que repetían lo mismo. El cajero también ve el cuadro (solo lectura; el descuento lo cambia el administrador en Configuración del local).

## v174 — Corrección: Créditos del personal salía vacío (19/10/2026)
- Causa: en v173 se ocultó la tabla de abajo apagando todo el bloque «tabla», pero el cuadro de Créditos del personal está **dentro** de ese bloque, así que desapareció con él (la pantalla quedaba vacía).
- Ahora se oculta solo la tabla (filtros, buscador, filas y paginación) y el cuadro de créditos (condiciones + consumo por mes) se mantiene.
- Lección: además de los valores, ahora se comprueba que el bloque de la pantalla quede dentro del contenedor que se muestra (no solo que los datos existan).

## v175 — Revisión de descuentos y horarios (19/10/2026)
- Se comprobó con el reloj simulado que «Domingos de waffles» solo vale los domingos (y solo descuenta los waffles) y que «Happy hour» solo vale de lunes a viernes de 15:00 a 17:00 (a las 17:00 ya no), dentro de sus fechas, en Nuevo pedido y en la carta; además canal, compra mínima, por producto, monto fijo y mejor de varios.
- Corregido: el **chatbot no aplicaba descuentos automáticos** (ahora sí, como línea del resumen y con la regla de acumulación); la **fecha del cupón** en Nuevo pedido estaba fija en 15/10 (ahora es la real); el aviso al guardar un descuento ya no dice «solo en la carta».
- Documentado en el nuevo `descuentos-y-promociones.md` (FLU-CAP-006) y en RN-CAP-132.
- Pendiente: horarios que cruzan la medianoche, varios rangos de hora por descuento y un reloj de prueba en la maqueta.

## v176 — Cupones con código único, de un solo uso, y pestaña Cupones reorganizada (19/10/2026)
- **Seguridad**: el código impreso era `DUO20-0102` (cupón + número del pedido): correlativo, adivinable, aceptaba cualquier sufijo y se podía repetir. Ahora cada cupón impreso lleva un código **único y al azar** (`DUO20-K7M2QX`, sin 0/O/1/I), se guarda en un **registro de cupones emitidos**, se canjea **una sola vez** y vence a los N días; reimprimir da los mismos códigos. `DUO20-0102`, `DUO20-9999` o `DUO20` solos ya no sirven. Mensajes claros (ya usado, vencido, anulado). La carta bloquea 5 minutos tras 5 intentos fallidos. Detalle en `cupones.md` (FLU-CAP-007) y RN-CAP-133.
- **Administrador**: botón «Cupones emitidos» (búsqueda, filtros vigente/canjeado/vencido/anulado y **Anular**); cada tarjeta indica si sale en el comprobante (y en qué puesto), si no cabe por el límite, o si no se imprime, y cuántos códigos se emitieron/canjearon.
- **Por qué salían 2 de 5**: solo 3 cupones están marcados para imprimirse y el comprobante lleva como máximo 2 (Reglas); ahora la pantalla lo explica («Salen 2 de 3…», con el cupón que no cabe y un atajo a Reglas).
- **Diseño**: la pestaña Cupones usa todo el ancho: tarjetas a la izquierda y, a la derecha, el **comprobante en vertical** con los cupones uno debajo de otro; en celular se apilan (tarjetas y luego el comprobante). Textos de Descuentos y Reglas actualizados (aplican en la carta, Nuevo pedido y chatbot; regla de acumulación con promociones).
- Datos de ejemplo para probar: `DUO20-K7M2QX` (vigente), `FRAPPE5-9PWD4H` (canjeado), `GRACIAS10-B3N8TA` (vencido).

- (19/10/2026) Decisión del dueño sobre las limitaciones de horarios: se aceptan como están (un solo rango de horas por descuento, sin horarios que crucen la medianoche, sin reloj de prueba) y quedan documentadas en `descuentos-y-promociones.md`, sección 7.

## v177 — Cupones: historial en una ventana grande y cifras arriba (19/10/2026)
- El historial era un cuadro pequeño con scroll dentro de la pestaña. Ahora el botón «Historial de cambios (N)» abre una **ventana grande**: todos los movimientos (hasta 60), lo más reciente primero, con letra legible, **búsqueda** y **filtros** (emisiones, canjes, creaciones, ediciones, activar/desactivar, orden y límite, anulaciones) y una etiqueta de color por tipo.
- La pestaña Cupones muestra **cifras** arriba (activos, emitidos con código, canjeados, vigentes) y ya no lleva el cuadro del historial entre las tarjetas.

## v178 — Cupones: código único o código compartido con tope (19/10/2026)
- Al crear o editar un cupón se elige **cómo se entrega**: **código único en el comprobante** (distinto por comprobante, de un solo uso, vence a los N días) o **código compartido con tope** (el mismo para todos, **no se imprime**, se reparte en afiches, volantes o redes, y se canjea en la carta).
- El formulario cambia según el modo (nombre del código y ayuda, frase y días de validez para el único; tope de usos y máximo por cliente para el compartido); el compartido pasa a canal «carta web» por defecto. El tope de usos es obligatorio.
- Las tarjetas de cupones compartidos muestran **usos y cuántos quedan**, una barra de avance y pasan a **Agotado** cuando llegan al tope; el canje se rechaza con «ya alcanzó su máximo de usos» y se cuenta cada uso (carta y Nuevo pedido).
- El **máximo por cliente** ahora se cumple cuando el cliente pide con su cuenta (DNI) en la carta y en Nuevo pedido; como invitado no se puede saber quién es y solo rige el tope total.
- Documentado en `cupones.md` (sección 2.1) y RN-CAP-134.

## v179 — Los cupones del comprobante se sortean al azar (19/10/2026)
- Antes salían siempre los primeros según el orden de las tarjetas (el resto nunca). Ahora, al imprimir el comprobante, se **sortean al azar N cupones entre los de código único activos** (N = «Cupones por comprobante» en Reglas). Sorteo simple, sin evitar repeticiones entre comprobantes; dentro de uno no se repite. Se hace una vez por pedido y se guarda (reimprimir da los mismos cupones y códigos).
- Se quitaron las flechas ↑ ↓ de las tarjetas (el orden ya no influye). Cada tarjeta dice si entra al sorteo; la vista previa y el texto de Reglas lo explican. El comprobante de un pedido todavía no impreso muestra «Se sortean al imprimir».
- Probado con 12 comprobantes y 5 cupones: cada cupón salió entre 4 y 6 veces; con límite mayor que los cupones disponibles salen todos; sin cupones activos no sale ninguno. RN-CAP-135 y `cupones.md` (sección 4).

## v180 — Compras: pedir a proveedores, recibir y diseño ordenado (19/10/2026)
- Nueva pestaña **Compras ▸ Pedir a proveedores**: «Traer lo que falta» (bajo el mínimo, y opcionalmente lo regular), lista agrupada por proveedor con cantidades en cajas o sacos, cambiar cantidad, quitar, descartar, agregar otro insumo y cambiar de proveedor (A/B/C). Un botón de **WhatsApp por proveedor** con su mensaje (ver el mensaje antes de enviar); sin WhatsApp, «Copiar mensaje» y «Ya lo pedí».
- Enviar crea un pedido **«Por recibir»**; en su detalle, **«Recibir y registrar costos»** abre el registro con todo prellenado; al guardar sube el stock y el pedido pasa a «Recibida» sin duplicarse. Los pedidos por recibir se pueden anular.
- **Almacén** tiene el botón «Stock bajo (N) · pedir a proveedores»; **Stock y recetas** manda lo bajo (o un insumo) a esa lista.
- Revisión: el estado «Por recibir» no tenía flujo, la fecha de compra estaba fija en 15/10, la numeración mezclaba `OC-` y `C-`, había 6 estilos rotos (punto y coma) y las compras iban en una columna. Corregido; ahora cifras arriba y cuadrícula. Detalle en `compras-y-proveedores.md` y RN-CAP-136.

## v182 — Registrar compra más ordenado (19/10/2026)
- En «Registrar compra», cada línea elegía el insumo entre **todos los chips juntos** (más de 30). Ahora hay un **buscador** («leche», «café»…) que muestra hasta 10 resultados; al elegir, queda el nombre del insumo con «Cambiar insumo». Si la compra viene de un pedido, el insumo ya viene fijo.
- Proveedor y datos de la compra (fecha, comprobante, pago) van **lado a lado** en pantallas anchas y apilados en celular; el texto explica que un pedido ya trae proveedor y lo pedido.

## v183 — Pedir a proveedores: un proveedor a la vez y varios proveedores por insumo (19/10/2026)
- La lista ya no crece hacia abajo con una tarjeta por proveedor: hay una **fila de proveedores** (con su número de insumos) y se muestra el pedido del **proveedor elegido**, con sus insumos en cuadrícula, el botón de WhatsApp y descartar.
- Un **insumo puede pedirse a más de un proveedor** (A, B, C): botones «+ / ✓» por línea; cada proveedor lleva su cantidad y un aviso si se pide también a otro. Enviar a uno no borra lo pendiente de los demás. Las listas guardadas antes se convierten solas.

## v184 — Corrección: un insumo, un proveedor por pedido; documentación general (19/10/2026)
- **Corrección de v183** (decisión del dueño): un insumo **no se pide a dos proveedores a la vez** (no hay «mitad y mitad»). Elegir otro proveedor **mueve** el insumo al pedido de ese proveedor; otro día, en otro pedido, puede ir a otro. Si el insumo ya tiene un pedido «Por recibir», la línea avisa. Las listas guardadas con dos proveedores se quedan con el primero. RN-CAP-137.
- **Documentación al día**: `modulos-y-roles.md` (Reservas, Créditos del personal, Productos, Listas y categorías, Ofertas y descuentos, Compras, Stock y recetas), `BRD.md` v1.51 (NEC-CAP-106 a 112 y RN-CAP-128 a 137), la pantalla **Workflow** (Reservas, Créditos, Listas y categorías, Ofertas y descuentos, Compras) y los documentos `descuentos-y-promociones.md`, `cupones.md` y `compras-y-proveedores.md`.

## v187 — Producción y ventas descuentan del mismo stock (19/10/2026)

**Cómo funciona el stock (revisado con el dueño)**
- **Registrar la producción del día:** baja del Almacén central la materia prima de la receta (harina, azúcar, huevos…) y suma el producto elaborado (donas, galletas, gelatina, pan de molde). No deja guardar si falta insumo.
- **Vender (pedido enviado a cocina):** los productos elaborados bajan del mismo stock que suma la producción. Los insumos comprados (café, leche, pan de molde, pollo) bajan primero del stock de Cocina/Barra y, si falta, del almacén.
- **Corrección:** antes solo las donas descontaban al venderse. Ahora también galletas (media docena = 6) y gelatina; las donas en media docena descuentan 6.
- **Pan pullman = Pan de molde:** la receta suma «Pan de molde» (bolsas) y los sándwiches descuentan de ahí; se quitó el insumo duplicado «Pan pullman (producción)».
- **Aviso sin stock (decisión del dueño):** en Nuevo pedido, si un elaborado no alcanza, el aviso al agregar dice «quedan N (registra la producción)». No bloquea la venta.
- **Producción toma primero de Cocina/Barra** (igual que las ventas) y, si falta, del Almacén central; el «no alcanza» suma ambos. Los movimientos PRD salen separados por origen. Pasar insumos del almacén a la cocina es una transferencia (no baja el total); solo bajan el total las ventas, la producción, mermas, donaciones/personal, cierre del día y devoluciones.
- **Confirmación al tomar del almacén:** si Cocina/Barra no alcanza, la lista de materia prima marca «N saldrán del almacén central» y, al registrar, pregunta «¿Seguro?» nombrando cada insumo y cantidad. Con Sí se registra; con No (o cerrar) no cambia nada. Si Cocina alcanza, no pregunta extra.
- La fecha «15/10» de los movimientos es el día fijo del mockup, no un error.

## v188 — Stock y recetas en tres pestañas (19/10/2026)

La pantalla mezclaba en una sola fila 9 botones, los pedidos de cocina, el stock y la receta. Ahora tiene tres pestañas, cada una con una sola función:
- **Insumos:** filtros de estado (Todos, Agotados, Stock bajo…), «+ Nuevo insumo», «Pedir lo que falta a los proveedores», alertas por correo y la lista de insumos en tarjetas en cuadrícula. La pestaña muestra la cantidad de insumos bajo el mínimo.
- **Producción y almacén:** tres bloques con una explicación corta cada uno: *Producir* (registrar producción), *Pedir al almacén* y *Pérdidas y cierre* (merma, merma de varios, cerrar el día); debajo, los pedidos de cocina y barra al almacén y el registro de lo descontado. La pestaña muestra los pedidos pendientes o por recibir.
- **Recetas:** receta por plato, costo, precio y margen, y el botón «Editar qué descuenta cada producto».
- La notificación «entregas del almacén por recibir» abre directo la pestaña Producción y almacén.

## v189 — Informes con datos reales del sistema (19/10/2026)

Antes era un catálogo de 14 nombres sin contenido. Ahora tiene 22 informes que se arman con los pedidos del día, el historial de cierres de caja, el almacén, las compras, los clientes y el delivery.
- **Hoy en un vistazo:** pedidos, ventas, ticket promedio, por cobrar y rechazados.
- **Buscador y categorías:** Ventas, Caja, Inventario, Compras, Clientes y Delivery, con el número de informes de cada una.
- **Tarjetas:** nombre, categoría, qué muestra, una cifra clave, filtros, forma de exportar y número de filas.
- **Al abrir uno:** cifras principales, tabla y botón «Descargar para Excel (.csv)».
- **Nuevos respecto del catálogo anterior:** ventas por categoría, por modalidad y por método de pago (hoy frente a los últimos cierres), caja por medio de pago (Yape, Plin, transferencia, efectivo, tarjeta), pendiente de cobro, producción registrada, estado y pago de las compras, mejores clientes, próximos cumpleaños, créditos del personal por mes, delivery por repartidor y por zona.
- **Límites:** el monto por producto y por categoría es una estimación (el total del pedido se reparte entre sus productos); no hay filtro de fechas ni PDF todavía; «Platos cancelados» y «Reclamos de delivery» salieron del catálogo porque el mockup no guarda esos datos.

## v190 — Informes con período y filtros (19/10/2026)

- **Período:** Hoy, Ayer, Últimos 7 días y Todo, más «Desde» y «Hasta» con calendario. Si «Desde» es posterior a «Hasta» avisa y no muestra datos.
- **Filtros de pedidos:** canal (Mozo, Caja, Web, WhatsApp), método de pago y modalidad (local, para llevar, delivery), con «Limpiar filtros».
- **Qué responde a qué:** las fechas aplican a ventas, caja, almacén, compras y créditos; canal, pago y modalidad aplican a los informes de pedidos. Stock bajo, mejores clientes y próximos cumpleaños son «de hoy» y lo dicen.
- **Historial de ejemplo:** para que el período tenga sentido, se generan pedidos de ejemplo de los días de los cierres de caja (10 al 14/10), con los mismos montos por medio de pago. Los de hoy son los pedidos reales de la cola.
- **Nuevo informe:** Ventas por día (mejor y peor día). «Ventas por método de pago» ahora compara los pedidos del período con los cierres de caja de esos días.

## v191 — Diseño, Destacadas y Novedades (19/10/2026)

- **Diseño de la carta, revisado:** un producto, categoría o combo creado en la misma sesión (Productos, Listas y categorías, Ofertas) no aparecía en el diseñador hasta recargar; ahora aparece al instante, al final de su categoría. Se comprobó que lo publicado (orden de categorías y productos) es lo que muestra la carta.
- **Destacadas más interactivas:** arrastrar círculos para reordenar; avisos «Oculta» y «Sin fotos: no se ve»; resumen; botón «Ver como cliente» y «▶ Ver» por círculo con visor tipo historia (barras, toque a ambos lados, reproducir solo cada 3 s, salto entre círculos); «Cargar fotos de ejemplo» para probar.
- **Novedades más interactivas:** filtros por estado con conteo; acciones rápidas en la tarjeta (subir, bajar, activar/desactivar, destacar, duplicar); atajos de fecha; cuenta regresiva en el estado; «Ver como cliente» con un celular (portada, filtros por tipo, detalle con galería y botón).
- La vista previa de Novedades muestra lo activo y vigente hoy, aunque no esté publicado.

## v192 — Novedades como el diseñador de la carta; Destacadas con archivar y eliminar (19/10/2026)

- **Novedades y publicidad:** ahora se abre en pantalla completa igual que Diseño de la carta (tarjeta de presentación, barra con Agregar / Publicar cambios / Descartar / Salir, y la página como la ve el cliente). Cada tarjeta se arrastra o se mueve con flechas, y tiene Editar, Activar/Desactivar, Destacar y Duplicar. «Editar» abre una ventana con todos los campos.
- **Se quitó «Ver como cliente»** de Novedades (la propia pantalla ya es la vista del cliente).
- **Destacadas:** subir varias fotos a la vez, cambiar o usar de portada cada imagen, quitar todas; por círculo: duplicar, archivar (sección «Archivadas», con restaurar) y eliminar para siempre (con confirmación). La carta ignora los círculos archivados.

## v193 — Notificaciones, Plano del local y Usuarios (19/10/2026)

- **Notificaciones:** página propia en vez de una tabla. Resumen (pendientes ahora, urgentes, sin leer, de hoy); «Pendientes ahora» con los avisos en vivo del rol y sus botones; historial agrupado por día (Hoy, Ayer) con filtros por tipo (con conteo), estado (nuevas o leídas), fecha (hoy, ayer, 7 días o entre dos fechas) y búsqueda. Marcar como leída o nueva, marcar todas las que se ven (con confirmación) e ir al módulo donde se resuelve (solo si el rol lo puede abrir).
- **Plano del local:** resumen arriba (mesas activas, capacidad en personas, mesas del piso, pisos activos, elementos). El plano ocupa la columna grande; a la derecha, «Agregar al plano» con los elementos agrupados (para sentarse, estructura, servicios), el panel del elemento elegido (nombre, personas, ancho, alto, desactivar, eliminar) y el tamaño del plano.
- **Usuarios:** tres pestañas. **Personal** (resumen, filtros por cargo, estado, creación y último acceso, tarjetas con ambas fechas, aviso de quien nunca ingresó o lleva más de 30 días sin entrar), **Clientes** (con cuenta o invitados, cliente desde, último pedido, puntos; filtros por tipo, cuenta, alta y último pedido) y **Qué ve cada rol** (la matriz de siempre). Los usuarios nuevos guardan la fecha de creación.
- **Límites:** las fechas de creación y último acceso del personal, y de alta y último pedido de los clientes, son de ejemplo; los clientes se editan en el módulo Clientes. En las notificaciones, «leída» solo cambia lo que ve esta pantalla.

## v194 — Plano del local: girar, copiar y pegar el diseño; plano por defecto documentado (19/10/2026)

- **Girar:** cada elemento tiene «↻ Girar (horizontal / vertical)», que intercambia ancho y alto y lo mantiene dentro del plano.
- **Guardar o cambiar el diseño:** copia todo el plano (pisos, elementos, tamaño) como texto y permite pegar uno para reemplazarlo (con confirmación; avisa si el texto no es válido).
- **Documentación del plano por defecto:** `plano-del-local.md` y `plano-del-local.default.json` (Piso 1 con 10 mesas y 38 personas; Piso 2 desactivado con 4 mesas y 20 personas).
- **Pendiente:** el plano que dibujó el dueño vive solo en su navegador; falta recibirlo con «Copiar» para dejarlo como plano inicial y mover la entrada.

## v195 — Ubicación actual de la tienda actualizable (19/10/2026)

- En *Configuración del local ▸ Ubicación* hay un panel con la dirección y las coordenadas en uso, y cuatro formas de cambiarlas: **«Usar mi ubicación actual»** (el navegador pide permiso y toma la posición del dispositivo, con su precisión), **«Buscar la dirección escrita»** (OpenStreetMap), **«Tomar del enlace de Google Maps»** (lee @latitud,longitud) o escribir latitud y longitud (acepta coma decimal). Hay «Ver en el mapa».
- Avisa si los números no son válidos (se sigue usando la última ubicación válida) y si falta guardar.
- Los campos de latitud y longitud salieron de la sección Operación y viven aquí.
- El mapa de entregas (centro y radios de 0,5, 1 y 2 km, y «Centrar») y el mapa de Nuevo pedido usan la ubicación configurada, no un punto fijo.
- Límite: las zonas de reparto y los puntos de ejemplo del mapa de calor son fijos; las zonas se editan en «Zonas de reparto».

## v203 — Historial de acciones (auditoría) (20/10/2026)

- Pantalla nueva **Configuración ▸ Historial de acciones**, solo para el administrador (DT-49, ADR-014, FT-USR-04). Otros roles no la ven en el menú.
- Cuatro cifras: registros con los filtros, cambios, accesos rechazados y lecturas sensibles.
- Filtros: buscador, persona, tipo (cambio, acceso, lectura sensible), módulo, resultado y fecha (Hoy, Ayer, Últimos 7 días y desde/hasta, con aviso si las fechas están al revés). Registros agrupados por día, con «Ver detalle» que muestra el antes y el después lado a lado y la huella del registro y la del anterior. Marcas «Rechazado» y «Con PIN del admin». Botón «Copiar como CSV».
- Estado de la cadena: «Última verificación automática: hoy 03:30» y «Verificar ahora». En «Cómo se protege este historial» hay una prueba que altera el texto del registro N.° 7 solo en pantalla: la verificación avisa que la cadena se rompe ahí y marca los registros afectados. Se deshace con el mismo botón.
- Datos de ejemplo: 20 registros del 13 al 15/10, con DNI enmascarados e IP de documentación.
- Probado con el harness: 128 combinaciones de rol, vista y equipo sin errores, y un flujo con filtros, detalle, verificación y alteración.
- Pendiente: el botón «Ver historial» en cada ficha (pedido, producto, usuario y cliente).

## v205 — Historial con IP, sin clasificar el origen (20/10/2026)

- Se probó y se **quitó** una pantalla «Equipos del local» (registrar equipos, guardar la IP del local y marcar las acciones «desde fuera del local»). Motivo: la IP del local puede cambiar y la llave en cada navegador es frágil (DT-50 descartada).
- El **Historial de acciones** vuelve a la versión v203: cada registro muestra la IP y el dispositivo tal cual, sin clasificar ni marcar nada.
- Las IP de ejemplo ahora son realistas: todos los equipos del local salen con la misma IP (203.0.113.10) y los externos con otras.
- Probado con el harness: 144 combinaciones de rol, vista y equipo sin errores.
- Pendiente: el botón «Ver historial» en cada ficha (pedido, producto, usuario y cliente).

## Documento nuevo — Información a pedir al cliente (19/10/2026)

`informacion-a-pedir-al-cliente.md`: 17 bloques de datos que faltan o son de ejemplo (recetas, insumos y costos, producción, proveedores, carta, fotos de productos y del local, datos legales, pagos, delivery, personal, salón, WhatsApp, promociones, caja, historial y decisiones del dueño), con prioridad, formato, para qué sirve y dónde se carga en el sistema. Incluye un mensaje corto para Kevin y cómo pedirlo en tandas. Se revisó contra el mockup: 62 de 64 productos tienen foto (faltan Papas nativas y Entremets y tartaleta), hay 3 recetas de ejemplo, 21 insumos sin costos y 7 proveedores sin RUC.

## Índice rápido de v156 a v195 (19/10/2026)

| Versión | Qué cambió |
|---|---|
| v156–v157 | Módulo **Listas y categorías**; tamaños de bebida separados de presentaciones y porciones. |
| v158–v159 | **Categorías de la carta** gestionables (con o sin tamaños y opciones); preguntas nuevas al crear una categoría; ventanas más anchas. |
| v160 | Productos: 24 por página y «Ver todos». |
| v162 | Corrección del error de render con categorías nuevas guardadas. |
| v163–v164 | «Dónde se pregunta cada grupo» en Listas y categorías; se quita «usar estos tamaños en toda la categoría». |
| v165–v170 | Promociones «lleva N, paga M» a medida; avisos de promoción en Nuevo pedido, carta y chatbot; promoción como descuento (adicionales aparte); tipos con sabores; regla de acumulación. |
| v171 | Reservas como calendario. |
| v172–v174 | Créditos del personal por mes, sin plazo ni abonos, con lo consumido; una sola pantalla (corrección del error que la dejó vacía). |
| v175 | Revisión de descuentos y horarios; el chatbot aplica descuentos; fecha real en el cupón. |
| v176–v179 | Cupones con código único, código compartido con tope, historial en ventana grande, sorteo al azar en el comprobante. |
| v180–v183 | Compras: pedir a proveedores, recibir, diseño ordenado, proveedores por pestañas. |
| v184 | Un insumo a un solo proveedor por pedido; documentación general. |
| v187 | Producción y ventas descuentan del mismo stock (galletas, gelatina, pan de molde); producción toma primero de Cocina y confirma si usa almacén; aviso de poco stock en Nuevo pedido. |
| v188 | Stock y recetas en tres pestañas: Insumos, Producción y almacén, Recetas. |
| v189 | Informes: 22 reportes con datos del sistema, buscador, categorías y descarga .csv. |
| v190 | Informes con período (desde-hasta) y filtros de canal, pago y modalidad; informe de ventas por día. |
| v191 | Diseño de la carta sincronizado con lo que se crea; Destacadas y Novedades interactivas (visor de historias, vista de celular, acciones rápidas). |
| v192 | Novedades con diseñador en pantalla completa; Destacadas con archivar, eliminar, duplicar y varias fotos. |
| v193 | Notificaciones con historial y filtros; Plano del local reorganizado; Usuarios en tres pestañas (personal, clientes, permisos) con filtros por fecha. |
| v194 | Plano: girar elementos, copiar/pegar el diseño y plano por defecto documentado. |
| v195 | Ubicación actual de la tienda actualizable (ubicación del dispositivo, dirección, enlace de Google Maps o coordenadas). |

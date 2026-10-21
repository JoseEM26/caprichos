---
id: INI-CAP-002
tipo: analisis
titulo: Iniciativas, sugerencias y pendientes de la reunión del 14 de octubre de 2026 (acta 02)
estado: approved
producto: caprichos
version: "1.1"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)"]
fecha: 2026-10-15
fuente: actas/acta-02-descubrimiento.md
relacionados: [INT-CAP-001, BRD-CAP-001]
tags: [acta-02, iniciativas, backlog-candidato]
---

# Iniciativas y sugerencias de la reunión del 14 de octubre de 2026

> **Borrador para decisión humana.** Aquí está TODO lo nuevo que se habló en la reunión (pedidos de Kevin, ideas de José, cosas por investigar, compromisos y dudas). **Nada de esto es un requisito aprobado**: se anota como candidato para decidir después qué entra y cuándo. La IA propone; el humano decide.
> La prioridad que aparece es la que **sugiere la conversación**, no una decisión.

## Cómo se hizo

- La transcripción (1,749 líneas, 2 h 11 min) se partió en 5 tramos con solape. Cinco agentes Antigravity, cada uno en su panel de herdr, extrajeron elementos con cita textual (213 en bruto).
- Se verificó contra la transcripción: las citas coinciden en promedio en un 94 % con el texto original (el resto son citas que unen varios turnos). Detalle y citas en [`iniciativas-acta-02-evidencia.md`](iniciativas-acta-02-evidencia.md).
- Después se **deduplicaron** los elementos repetidos por el solape o por repetirse el tema en la conversación (212 → 186 elementos). Los detalles de los fusionados se conservan dentro de cada entrada como "Ver también".
- La transcripción es automática y tiene errores de voz. Lo dudoso lleva "Confianza: Media/Baja" y debe confirmarse con Kevin.

## Cifras

| Área | Elementos |
| :-- | :-: |
| 1. Carta web (cliente) | 34 |
| 2. Chatbot de WhatsApp | 26 |
| 3. Administrativo, roles y comprobantes | 31 |
| 4. Cocina, pantallas e impresión | 17 |
| 5. Mesas, pedidos en sala y reservas | 14 |
| 6. Clientes, puntos, créditos y descuentos | 12 |
| 7. Almacén, stock, recetas y compras | 27 |
| 8. Marketing, posventa y opiniones | 7 |
| 9. Infraestructura, red y operación | 18 |
| **Total** | **186** |

| Naturaleza | Elementos |
| :-- | :-: |
| Idea del desarrollador | 37 |
| Regla o decisión | 37 |
| Pedido del cliente | 30 |
| Problema actual | 15 |
| Aplazado, descartado o a futuro | 13 |
| Idea del cliente | 12 |
| Dato del negocio | 11 |
| Pendiente del desarrollador | 9 |
| Investigar o revisar | 8 |
| Pendiente del cliente | 6 |
| Compromiso | 4 |
| Duda abierta | 4 |

## Estado según el prototipo (versión 78 del artifact, actualizado el 17/10)

Cada elemento lleva un símbolo al costado del título: **✔** implementado en el prototipo, **◐** parcial o simulado (la idea está, falta la parte real), **☐** pendiente (no está en el prototipo), **?** duda abierta que se debe decidir con el cliente, **·** dato o decisión registrada que no requiere una pantalla.

| Estado | Elementos |
| :-- | :-: |
| ✔ Implementado | 112 |
| ◐ Parcial o simulado | 25 |
| ☐ Pendiente | 29 |
| ? Duda abierta | 4 |
| · Dato o decisión registrada | 16 |

El estado sale de revisar el prototipo, no de pruebas con usuarios. "Implementado" significa que se puede recorrer en la maqueta con datos de ejemplo; la construcción real viene después.

## Lo nuevo de un vistazo

**Cambios al flujo de la carta web (lo más repetido por Kevin)**
- Copiar el flujo de **Hola Click**: elegir productos primero y pedir los datos al final. La carta se toma de **restaurant.pe** (es la actualizada).
- Pedir solo nombre y teléfono: sin fecha, sin correo obligatorio, sin login para pedir, y sin subir comprobante en la web.
- **Yape y Plin visibles como métodos propios** (no escondidos en "transferencia"). Al pagar así: "estamos esperando tu pago, te contactaremos por WhatsApp para la constancia". Mostrar número para copiar y pegar, no QR.
- **Ubicación fácil:** recordar la dirección por teléfono, preguntar "¿es esta tu ubicación?", aceptar el código Plus de Google Maps y el GPS, y calcular el delivery por rangos de distancia.
- Imágenes cuadradas, de buena resolución y con **zoom**; catálogo más compacto en celular (la mayoría pide desde el celular); solo filtro por categoría y, quizá, "más vendido". Sin filtros de precio ni reseñas públicas.
- **Banner publicitario administrable** (por ejemplo "Caprichos del mes", que se desactiva cuando no hay campaña), sección "Conócenos" y elegir recojo o delivery al inicio, como Starbucks.

**Chatbot de WhatsApp (Capri)**
- Mantener los **botones** para pedir; usar la IA solo para dudas y recomendaciones (ahorra costo y errores). Carrito con varios productos.
- Mensaje automático apenas entra un pedido por la web; reservas por personas y hora (sin elegir mesa); botón "hablar con un asesor"; emojis y banner de bienvenida.
- Sin stock en tiempo real (el bot actual ofrece lo que no hay); promociones y menú que se actualizan solos desde el panel.
- **Posventa:** encuesta a las 2 horas; si es positiva, invitar a opinar en Google Maps (con incentivo); si es negativa, derivar a una persona y avisar al WhatsApp de gerencia.
- Mecanismo de **alta demanda** (pausar y subir tiempos de entrega). Pasar a José los prompts y el panel del bot actual.

**Cocina, impresión y mesas**
- **Tres pantallas por área** (bebidas, postres, salados), cada una solo con lo suyo; el "Dúo Compartir" debe repartir sus partes a cada área y seguir vendiéndose aunque falte un complemento.
- **Etiquetas autoadhesivas** con la comanda para pegar en el vaso (con variantes festivas); una pantalla o etiquetera de **despacho** con todo junto; sin scroll; la comanda debe llevar mozo, ticket, cronómetro y notas; clave de Wi-Fi en el ticket.
- **Mesas:** el plano debe impedir que dos personas tomen la misma mesa; "para llevar" sin mesa; marca de **mesa reservada**; el mozo **no cobra** (saca precuenta, el cajero cobra); QR o número; se incentiva pagar adelantado.

**Clientes y negocio**
- **Puntos de fidelidad** (modelo Cineplanet: invitado sin puntos o con cuenta y puntos), con login por correo, cumpleaños y aviso de privacidad. Niveles (Platino, Súper Capricho) quedan para después.
- **Crédito al personal** (15 días) con 25 % de descuento, salvo combos y promociones; el crédito es solo para el personal (decisión del 16/10, por confirmar con Kevin, que en la reunión dijo "ponle para todos"). Cupones con validez, monto y alcance.
- **Almacén** como restaurant.pe pero solo entrada, salida y merma (sin transferencia por ahora): producción de la mañana registra insumos y productos; al vender, la **receta descuenta insumos automáticamente**; semáforo verde, naranja y rojo; alertas por correo; **orden de compra por WhatsApp con un clic**; proveedores A, B y C por insumo.
- Comprobante por defecto: **nota de venta**; boleta y factura con SUNAT, después. Un rol de **producción y almacén**; el delivery también hace de almacenero en las tardes.

**Infraestructura**
- **VPS en Contabo**, dominio **caprichos.pe** (unos 110 al año, a comprar con el correo institucional), WhatsApp con la API de Meta y un chip exclusivo.
- **Modo sin internet** para sala, caja y cocina, con sincronización al volver la conexión: es un requisito fuerte de Kevin y José se comprometió a estudiarlo.

**Compromisos de José:** viernes, nueva reunión con la propuesta y el primer abono; revisar Hola Click, restaurant.pe y el bot actual; visita al local para sacar el código del bot; agregar GPS, filtros por fecha y gráficos al administrativo.
**Compromisos de Kevin:** enviar páginas de referencia, el enlace de cupones de restaurant.pe, el usuario de Hola Click, el correo institucional, el Excel de recetas y los prompts del bot.

---

## 1. Carta web (cliente)

#### ✔ Filtros de búsqueda y navegación en la Carta Web
*Idea del desarrollador · José · 00:00:54 · Prioridad: Próximo · Confianza: Alta · Fuentes: A-02 · Estado: Implementado en el prototipo*

José muestra en la maqueta de la carta web opciones de ordenamiento y filtrado por rango de precios, un filtro para mostrar exclusivamente productos en promoción, y categorías especializadas como "100% cacao" para facilitar la navegación del cliente tanto en PC como en móviles.

#### ✔ Atributos de personalización y notas especiales por producto en Carta Web
*Idea del desarrollador · José · 00:00:54 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-03 · Estado: Implementado en el prototipo*

En la carta web se contemplan opciones de configuración para bebidas como frappés: selección de tamaño (regular, grande), tipo de leche (entera, deslactosada), tipo de endulzante, y un campo de notas adicionales u observaciones para que el cliente detalle especificaciones antes de añadir el producto al carrito.

#### ✔ Carrito de compras multi-producto para pedidos con delivery
*Regla o decisión · Kevin · 00:00:54 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-05 · Estado: Implementado en el prototipo*

Kevin consulta si el servicio de delivery se aplica al consolidado del carrito de compras. José ratifica que el cliente tiene la capacidad de incorporar múltiples productos de diversas categorías en un único pedido antes de procesar el despacho por delivery.

#### ✔ Incorporación de toppings y complementos en la personalización de productos
*Pedido del cliente · Kevin · 00:01:59 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-06 · Estado: Implementado en el prototipo*

Kevin señala que además de tamaño, leche y endulzante, en Caprichos se manejan toppings y complementos adicionales (por ejemplo en frappés o combos como el dúo compartir), por lo que solicita que la plataforma permita seleccionarlos y agregarlos al producto.

#### ✔ Captura de ubicación y dirección para entrega por delivery
*Pedido del cliente · Kevin · 00:01:59 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-07 · Estado: Implementado en el prototipo*

Kevin remarca que al elegir la opción de delivery en la web, el sistema debe desplegar los campos necesarios para ingresar la ubicación o dirección exacta de entrega del cliente, junto con el tiempo estimado de entrega.

#### ✔ Regla de negocio: pedidos 100% para hoy y eliminación de selección forzada de fecha
*Regla o decisión · Kevin · 00:03:55 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-08 · Estado: Implementado en el prototipo*

Kevin critica severamente el sistema restaurant.pe por exigir al usuario seleccionar una fecha de entrega al iniciar. Establece formalmente que en Caprichos el 100% de los pedidos son para consumo inmediato en el mismo día, por lo que resulta un obstáculo innecesario exigir fecha (a lo sumo podría dejarse opcional, pero nunca obligatorio al inicio).

#### ✔ Eliminación de login obligatorio y solicitud forzosa de correo electrónico
*Pedido del cliente · Kevin · 00:03:55 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-09 · Estado: Implementado en el prototipo*

Kevin manifiesta su desacuerdo con obligar al cliente a registrarse, iniciar sesión o ingresar correo electrónico para comprar, calificándolo como un trámite engorroso pensado solo para el comercio y no para la experiencia del usuario. Pide un flujo de compra directo sin barreras de registro obligatorio.

#### ☐ Revisión y catálogo de productos existente en restaurant.pe
*Dato del negocio · José · 00:03:55 · Prioridad: Próximo · Confianza: Alta · Fuentes: A-10 · Estado: Pendiente (no está en el prototipo)*

José y Kevin repasan la estructura del menú vigente de Caprichos en restaurant.pe, que incluye combos fríos, postres calientes, salados, promociones, carta general, caja feliz, frappés, y artículos de merchandising de la marca como el termo Caprichos 20.

#### ✔ Visualización directa e independiente de Yape y Plin en métodos de pago
*Pedido del cliente · Kevin · 00:05:03 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-11 · Estado: Implementado en el prototipo*

En restaurant.pe las billeteras digitales Yape y Plin están ocultas dentro del botón de transferencia bancaria, provocando que un 30% de los clientes se confunda y pregunte si aceptan dichos medios de pago. Kevin exige que Yape y Plin figuren como opciones de pago directas, visibles e independientes desde el primer nivel de selección.

#### ✔ Flujo de pago sin carga forzosa de comprobante en web y confirmación por WhatsApp
*Pedido del cliente · Kevin · 00:06:11 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-12 · Estado: Implementado en el prototipo*

Kevin rechaza que el sistema web obligue al cliente a cargar un comprobante de pago o voucher (ya que el software no valida transferencias de forma automática). Prefiere un flujo ágil donde tras hacer el pedido aparezca el mensaje 'Estamos esperando tu pago, te contactaremos por WhatsApp para que puedas enviarnos constancia', derivando el envío de la captura al canal de WhatsApp para coordinar y hacer seguimiento.

#### ✔ Datos de pago: cuenta y número telefónico con opción de copiar y pegar sin QR
*Pedido del cliente · Kevin · 00:07:13 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-14 · Estado: Implementado en el prototipo*

Al momento de pagar con Yape o transferencia desde el celular, mostrar un código QR resulta incómodo e impráctico para el cliente. Kevin y José acuerdan mostrar claramente el número de teléfono y nombre del titular junto a una función o botón de copiar y pegar para que el cliente lo transfiera directamente a su aplicación bancaria.

#### ✔ Adopción del flujo de pedido de Hola Click: productos primero, datos al final
*Pedido del cliente · Kevin · 00:10:34 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-15 · Estado: Implementado en el prototipo*

Kevin define la regla para el flujo de la carta web: tomar como modelo a Hola Click, donde el usuario visualiza los productos y arma su orden directamente, solicitándole sus datos de despacho e identificación únicamente al final del proceso de compra, sin interrupciones previas.

#### ✔ Imágenes de producto: formato cuadrado, alta resolución y función de zoom
*Pedido del cliente · Kevin · 00:11:41 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-16 · Estado: Implementado en el prototipo*

Queja respecto a restaurant.pe porque fuerza todas las imágenes a un formato rectangular u horizontal de baja resolución que no se puede ampliar. Kevin solicita usar formato cuadrado (como en Hola Click) y con suficiente calidad para que el cliente pueda abrir y apreciar el producto. José se compromete expresamente a incorporar la funcionalidad de zoom interactivo en las imágenes.

#### ☐ Referencia web de Starbucks para la configuración de bebidas personalizadas
*Investigar o revisar · Kevin · 00:13:29 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-19 · Estado: Pendiente (no está en el prototipo)*

Kevin recomienda como referencia de diseño y flujo a la página web de Starbucks Perú, destacando cómo estructura la selección inicial del método de entrega (recoger, delivery) y la parametrización de bebidas (tamaños, tipo de leche, café batido, opciones). Kevin comparte el enlace a José durante la llamada.

#### ✔ Sección institucional "Conócenos" en la web inspirada en Starbucks
*Idea del desarrollador · José · 00:14:23 · Prioridad: Futuro · Confianza: Alta · Fuentes: A-20 · Estado: Implementado en el prototipo*

Al analizar la referencia de Starbucks, José propone crear un apartado informativo de marca para Caprichos ('Lo que tienes que saber de Caprichos' o sección 'Conócenos') que transmita la identidad y propuesta de valor de la cafetería artesanal a los clientes.

#### ✔ Optimización visual móvil: diseño compacto de catálogo para evitar saturación
*Pedido del cliente · Kevin · 00:15:23 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-23 · Estado: Implementado en el prototipo*

Kevin observa en la maqueta móvil que las tarjetas de los productos son excesivamente grandes y advierte que causarán fatiga visual y mareo al cliente mientras navega. Solicita que la vista de exploración sea compacta y con elementos reducidos, reservando el formato grande únicamente para el momento en que se selecciona un producto específico.

#### ✔ Reducción del tamaño de fuente en los filtros para dispositivos móviles
*Idea del desarrollador · José · 00:15:23 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-24 · Estado: Implementado en el prototipo*

José identifica que en pantallas de celular la tipografía empleada en los botones de filtro resulta demasiado grande y desborda la interfaz, por lo que ajustará las dimensiones del texto para asegurar una correcta visualización en pantallas reducidas.

#### ◐ Referencia de sistema: Hola Click (experiencia de usuario y flujo de pedidos)
*Investigar o revisar · Kevin · 00:01:59 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-39 · Estado: Parcial o simulado en el prototipo*

Aunque la cuenta de Hola Click que tenía Caprichos ya no se encuentra activa, Kevin insiste en tomarla como la principal referencia de interfaz y flujo comercial (pedido directo, datos mínimos solicitados al final, notificación automática vía WhatsApp e imágenes cuadradas).

#### ☐ Referencia de sistema: restaurant.pe (catálogo activo y deficiencias operativas)
*Investigar o revisar · Kevin · 00:03:55 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-40 · Estado: Pendiente (no está en el prototipo)*

Kevin y José analizan el menú web actual de Caprichos provisto por restaurant.pe. Si bien es la fuente fidedigna y actualizada de productos y precios, presenta serios problemas de conversión: exige fecha y correo antes de ver la carta, esconde Yape/Plin dentro de transferencias, pide subir comprobantes manuales y no permite ampliar imágenes.

#### ☐ Compromiso de envío de páginas web gastronómicas de referencia por parte del cliente
*Pendiente del cliente · Kevin · 00:14:23 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-41 · Estado: Pendiente (no está en el prototipo)*

Kevin se compromete a compartir con José enlaces de páginas web de referencia de otros comercios de comida y bebidas que tengan interfaces destacadas, habiéndole enviado durante la misma llamada el enlace de la web de Starbucks.

#### ☐ Compromiso del desarrollador: extraer catálogo completo de restaurant.pe y replicar flujo de Hola Click
*Pendiente del desarrollador · José · 00:11:41 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-42 · Estado: Pendiente (no está en el prototipo)*

José se compromete a adoptar íntegramente la lógica y el flujo de navegación de Hola Click para la carta digital, y a extraer la totalidad del catálogo, categorías, descripciones y precios vigentes desde la plataforma de restaurant.pe.

#### ✔ Compromiso del desarrollador: corregir visualización de imágenes cortadas en el prototipo
*Pendiente del desarrollador · José · 00:00:54 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-43 · Estado: Implementado en el prototipo*

Al mostrar la maqueta inicial de la carta web, José advierte que las imágenes de los productos se encuentran desalineadas o cortadas en la interfaz y se compromete explícitamente a ajustar el encuadre para que se aprecien completas.

#### ✔ Reglas comerciales complejas y equivalencias en el "Dúo Compartir"
*Regla o decisión · Kevin · 00:37:31 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-28 · Estado: Implementado en el prototipo*

Kevin explica detalladamente la lógica de negocio del Dúo Compartir que los propios técnicos de restaurant.pe no lograron parametrizar: la promoción incluye 2 bebidas a elección y un conjunto condicional de complementos. Permite elegir 2 donas, 2 galletas o 1 dona + 1 galleta; pero si el comensal opta por un producto de mayor costo o tamaño (como una porción de queque/carrot cake, una empanada o una bandeja de pitipanes), la regla exige que sea exactamente una (1) sola unidad y no dos. El sistema debe permitir esta lógica condicional de selección y aplicar el precio promocional sin descuadrar.

#### ◐ Cálculo tarifario de delivery según rangos de distancia en mapa
*Regla o decisión · Kevin · 00:44:29 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-36, C-03 · Estado: Parcial o simulado en el prototipo*

Kevin señala que al fijar el punto de entrega en el mapa del pedido a domicilio, el sistema debe cotizar y cargar automáticamente el costo del servicio de delivery en función de rangos o polígonos de distancia establecidos por el negocio.

- Ver también (C-03, 00:45:38): Al colocar la ubicación de entrega del cliente en el mapa interactivo durante la toma de pedido, el sistema debe fijar automáticamente la tarifa del delivery en función del rango o radio de cobertura geográfica en el que se encuentre el punto de entrega.

#### ✔ Asociación automática y memoria de dirección por número de teléfono en pedidos como invitado
*Pedido del cliente · Kevin · 01:07:16 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-32 · Estado: Implementado en el prototipo*

Kevin subraya una funcionalidad crítica para mejorar la usabilidad en pedidos de delivery recurrentes: cuando un cliente hace un nuevo pedido como invitado e ingresa su número telefónico, el sistema debe recordar y asociar la dirección guardada en su compra anterior, impidiendo que deba volver a señalar su ubicación en el mapa cada vez que ordena.

#### ✔ Pantalla de verificación rápida de dirección ("¿Es para su misma ubicación?")
*Idea del cliente · Kevin · 01:08:33 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-33 · Estado: Implementado en el prototipo*

Describiendo la última mejora implementada en Hola Click, Kevin propone que al detectar una dirección previa asociada al teléfono, la plataforma muestre una ventana de confirmación mostrando el mapa con la pregunta: "¿Es para su misma ubicación? Esta es su ubicación". De este modo el cliente valida con un solo clic o corrige el pin si se encuentra en otra dirección.

#### ☐ Envío de credenciales de acceso de Hola Click para auditar configuraciones y flujos
*Pendiente del cliente · Kevin · 01:08:33 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-34 · Estado: Pendiente (no está en el prototipo)*

Kevin se compromete a buscar y compartir sus credenciales de usuario y clave de Hola Click para que José explore el panel de configuración interna y pruebe la interfaz de compra desde la perspectiva del cliente, aclarando que al no estar pagando el servicio actualmente algunas funciones podrían estar restringidas.

#### ✔ Presentación de productos en tarjetas cuadradas con conmutador de disponibilidad
*Idea del desarrollador · José · 01:10:55 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-37 · Estado: Implementado en el prototipo*

En el diseño visual de la carta virtual, José propone maquetar los productos en formato de tarjetas cuadradas con carga de imágenes optimizadas y un control de disponibilidad ("aquí y disponible") para marcar en tiempo real si un producto se encuentra agotado o listo para la venta.

#### ✔ Administración de promociones avanzadas (2x1, 3x2, descuentos porcentuales y vales de sorteo)
*Idea del desarrollador · José · 01:10:55 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-38 · Estado: Implementado en el prototipo*

En el módulo de ofertas y descuentos se integrarán diversas modalidades promocionales inspiradas en Restaurant.pe: promociones tipo 2x1, combos 3x2, rebajas de porcentaje fijo, aplicación de cupones de descuento y emisión y control de vales para sorteos comerciales.

#### ✔ Descarte de filtros complejos y rangos de precio en la carta de comida
*Aplazado, descartado o a futuro · Kevin · 01:37:11 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-32 · Estado: Implementado en el prototipo*

Kevin solicita prescindir de filtros complejos o búsquedas por rango de precios en la carta web, explicando que en gastronomía el cliente no compra como en un e-commerce de electrodomésticos o tecnología, ni descarta un plato si cuesta 12 soles en lugar de 10. Concluyen que basta con mantener la barra superior de categorías.

#### ✔ Destacado y filtro de productos más vendidos en la carta web
*Idea del cliente · Kevin · 01:37:57 · Prioridad: Próximo · Confianza: Alta · Fuentes: D-33 · Estado: Implementado en el prototipo*

Kevin plantea que el único filtro o distintivo que realmente ayuda al comensal es una categoría o etiqueta de "Lo más vendido" (identificada con una estrella o indicador), permitiendo que clientes nuevos o indecisos elijan con confianza opciones probadas del menú.

#### ✔ Descarte de valoraciones y reseñas públicas en la carta virtual
*Aplazado, descartado o a futuro · Kevin · 01:38:59 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-34 · Estado: Implementado en el prototipo*

Kevin rechaza implementar calificaciones o reseñas con estrellas públicas en los productos de la web. Argumenta que en productos elaborados al momento o transportados por delivery existen riesgos externos (como la crema chantillí derretida por el clima o una decoración movida por el traslado) que inducen a clientes a emitir calificaciones bajas injustas, perjudicando la reputación comercial del negocio.

#### ✔ Ambientación y temas festivos configurables para la carta web
*Idea del desarrollador · José · 01:46:01 · Prioridad: Próximo · Confianza: Alta · Fuentes: D-39, E-01 · Estado: Implementado en el prototipo*

José presenta una funcionalidad en el panel administrativo que permite personalizar globalmente la estética, colores y estilo visual de la carta virtual en fechas conmemorativas o festividades (como Halloween, Navidad o Día del Niño). Kevin aprueba con entusiasmo la idea, destacando que le gusta mucho.

- Ver también (E-01, 01:46:39): José muestra que desde el panel administrativo el cliente podrá cambiar de forma directa y visual el diseño, colores y ambientación de la carta digital según festividades especiales (Navidad, Día del Niño, aniversario). Al hacer el cambio, todos los comensales verán la carta tematizada de forma inmediata sin necesidad de tocar código.

#### ✔ Incorporación obligatoria de captura de ubicación GPS en la solución web
*Compromiso · José · 02:08:12 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-40 · Estado: Implementado en el prototipo*

Al verificar la interfaz del bot existente donde se captura la geolocalización satelital del cliente, José reconoce que omitió la solicitud de ubicación GPS en su prototipo de pedidos. Asume de inmediato el compromiso de incorporar el envío y captura de ubicación GPS en la carta web y en el nuevo flujo de pedidos de WhatsApp.

## 2. Chatbot de WhatsApp

#### ✔ Notificación proactiva e inmediata del bot por WhatsApp al ingresar pedido web
*Idea del cliente · Kevin · 00:06:11 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-13 · Estado: Implementado en el prototipo*

Kevin destaca una funcionalidad de Hola Click que desea replicar: cuando entra un pedido web, el bot de WhatsApp toma de inmediato el número telefónico registrado por el cliente y le envía un mensaje instantáneo informando 'Hemos recibido tu pedido', abriendo el hilo de conversación proactivamente. José confirma que se integrará fácilmente mediante la API de WhatsApp.

#### ✔ Nombre oficial del asistente virtual de WhatsApp: Capri
*Regla o decisión · José · 00:16:22 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-25 · Estado: Implementado en el prototipo*

José confirma con Kevin que el bot conversacional de WhatsApp responderá oficialmente bajo el nombre de 'Capri', saludando a los usuarios con la frase de bienvenida identificativa del café.

#### ✔ Arquitectura híbrida del Chatbot: IA para atención conversacional y botones para pedidos
*Pedido del cliente · Kevin · 00:21:34 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-37, A-26, B-03 · Estado: Implementado en el prototipo*

Kevin y José definen el diseño operativo de Capri como un modelo híbrido: la inteligencia artificial se encargará de brindar recomendaciones, responder inquietudes de salud, ingredientes y preguntas abiertas, mientras que la captura y estructuración del pedido se efectuará mediante cuestionarios y botones interactivos, eliminando el esfuerzo de tipear y agilizando la venta.

- Ver también (A-26, 00:16:22): José presenta la secuencia guiada del bot: Saludo -> Opciones iniciales [Ver carta] o [Hacer pedido] -> Modalidad (Delivery, Para llevar, En local) -> Selección de categoría y producto (Frappé caliente, waffle salado, mocaccino, cappuccino) -> Personalización (tamaño, tipo de leche: deslactosada o almendrada, endulzante: azúcar o stevia) -> Acción siguiente: [Agregar otro producto] o [Finalizar pedido].

- Ver también (B-03, 00:21:34): Kevin prefiere y solicita que el flujo del chatbot de WhatsApp combine respuestas de texto con botones interactivos de selección. Destaca que los botones son mucho más amigables y accesibles para los clientes porque agilizan el proceso, evitan que tengan que redactar mensajes largos y simplifican la toma de decisiones.

#### ✔ Carrito multi-producto con cálculo de monto total en el Chatbot de WhatsApp
*Pedido del cliente · Kevin · 00:17:12 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-27 · Estado: Implementado en el prototipo*

Kevin recalca la necesidad de que el cliente pueda pedir varios artículos distintos en una sola sesión de chat. José demuestra en la maqueta cómo el bot permite añadir por ejemplo un waffle y luego un frappé oreo grande con leche deslactosada, consolidándolos en una pantalla de resumen que calcula y muestra el monto total a pagar.

#### ✔ Solicitud de comprobante de pago por WhatsApp al finalizar el pedido en el bot
*Idea del desarrollador · José · 00:17:12 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-28 · Estado: Implementado en el prototipo*

Como cierre del flujo automatizado de pedido en WhatsApp, el bot solicitará al usuario adjuntar su comprobante con un mensaje de validación: 'Sube tu voucher de pago y en unos momentos estaremos confirmando tu compra'.

#### ✔ Integración de IA en WhatsApp para resolver dudas abiertas y dar recomendaciones
*Compromiso · José · 00:18:05 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-29, B-04 · Estado: Implementado en el prototipo*

Kevin consulta si el bot responderá preguntas no estructuradas del cliente (por ejemplo, si tiene gripe y busca bebidas adecuadas, si es intolerante a la lactosa, o consultar qué opciones calientes hay disponibles). José se compromete expresamente a integrar capacidades de inteligencia artificial para responder dudas y formular recomendaciones personalizadas.

- Ver también (B-04, 00:21:34): José define la arquitectura del bot de WhatsApp: contará con un agente conversacional inteligente para brindar recomendaciones y resolver consultas de los comensales, mientras que el proceso formal de compra y pedido se canalizará de manera guiada y estructurada mediante cuestionarios, botones y formularios.

#### ☐ Soporte para clientes que omiten botones y solicitan productos directamente por texto
*Dato del negocio · Kevin · 00:18:05 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-30 · Estado: Pendiente (no está en el prototipo)*

Kevin describe la conducta real de los usuarios en WhatsApp: muchos ignoran intencionalmente los menús de botones y escriben directamente lo que desean (ej. 'Hola, quiero un frappé de Oreo'). El sistema debe ser capaz de procesar estas peticiones en lenguaje natural sin forzar un reinicio del flujo.

#### ✔ Falla detectada en bot actual: omisión de cobro de delivery por la IA
*Problema actual · Kevin · 00:18:05 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-31 · Estado: Implementado en el prototipo*

Kevin comparte un error crítico ocurrido ese mismo día con el bot de IA en producción: le enviaron una captura demostrando que el bot tomó un pedido de despacho a domicilio pero omitió cobrar el recargo correspondiente al costo de delivery.

#### ✔ Problema en bot actual: desorientación y consumo excesivo de tokens ante errores tipográficos
*Problema actual · José · 00:19:08 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-32 · Estado: Implementado en el prototipo*

Al hacer pruebas en vivo solicitando un sándwich parrillero con variantes informales o faltas ortográficas ('un parry', 'con un parryo'), el bot actual se confunde por completo, no deduce el producto y genera un consumo excesivo e ineficiente de procesamiento y tokens.

#### ✔ Gestión de productos agotados en Chatbot: ocultamiento o aviso explícito de sin stock
*Idea del desarrollador · José · 00:21:34 · Prioridad: Próximo · Confianza: Alta · Fuentes: A-35, B-02 · Estado: Implementado en el prototipo*

Cuando no haya existencias de un producto determinado (como el sándwich parrillero), José plantea dos alternativas para el bot: no mostrarlo dentro de las opciones ofrecidas, o presentarlo acompañado de un aviso claro de 'No hay stock' o 'No disponible por ahora' para prevenir que el usuario intente comprarlo.

- Ver también (B-02, 00:21:34): José plantea cómo debe reaccionar el chatbot cuando un producto se quede sin existencias (menciona como ejemplo un parrillero): se puede optar por ocultarlo del menú del bot o mantenerlo visible pero con una etiqueta clara que indique "No hay stock" o "No disponible por ahora".

#### ✔ Flujo del Chatbot de reservas solicitando comensales y hora sin asignar mesa
*Idea del desarrollador · José · 00:59:49 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-17 · Estado: Implementado en el prototipo*

Dado que las consultas de reserva ingresan por WhatsApp, se incorporará una opción en el Chatbot para iniciar la solicitud. José y Kevin convienen en que el bot no debe solicitar ni permitir elegir un número específico de mesa; únicamente preguntará para cuántas personas es la reserva, la fecha y la hora, derivando los datos al personal para la confirmación y asignación física.

#### ✔ Botón de derivación a personal humano en el Chatbot ("Hablar con un asesor")
*Idea del desarrollador · José · 00:59:49 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-18 · Estado: Implementado en el prototipo*

Para evitar la frustración de clientes que no deseen interactuar con flujos automáticos o requieran atención personalizada, José plantea incorporar un botón directo que transfiera la conversación a una persona del equipo ("Quiero hablar con un asesor directamente" o "Quiero hablar con un camarero directamente"). Kevin respalda y aprueba la iniciativa.

#### ✔ Inclusión de emojis en botones interactivos y banner de bienvenida en Chatbot
*Idea del cliente · Kevin · 01:00:36 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-19 · Estado: Implementado en el prototipo*

Kevin sugiere añadir emojis en los textos de los botones del menú de WhatsApp para brindar una experiencia más cercana, amigable y visualmente atractiva. José complementa la recomendación sugiriendo que el mensaje de bienvenida inicial cuente con un banner de cabecera ("Hola Caprichos") acompañado de emojis alusivos.

#### ✔ Encuesta de posventa automática por WhatsApp dos horas después de la entrega
*Pedido del cliente · Kevin · 01:40:15 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-35 · Estado: Implementado en el prototipo*

Kevin propone programar un mensaje de satisfacción automatizado por WhatsApp que el bot envíe exactamente dos horas después de confirmado o entregado el pedido (tiempo idóneo para que el cliente ya haya consumido). El bot consultará cordialmente: "Hola. Queremos saber si tu pedido llegó todo bien y está todo en orden".

#### ✔ Derivación interna y soporte humano ante incidencias o respuestas negativas
*Pedido del cliente · Kevin · 01:41:39 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-37 · Estado: Implementado en el prototipo*

En caso de que la respuesta del cliente a la posventa sea negativa, el bot tiene prohibido redirigirlo a Google Maps o redes públicas. El sistema debe responder indicando que transfiere el chat de inmediato a un asesor o encargado ("permíteme derivar esta conversación a un asesor para ver cómo te podemos ayudar"). El equipo contactará al cliente internamente para disculparse y, si amerita, reemplazar el producto defectuoso.

#### ◐ Confirmación de WhatsApp Business Cloud API oficial con chip exclusivo
*Dato del negocio · Kevin · 02:02:34 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-28 · Estado: Parcial o simulado en el prototipo*

José consulta por las características técnicas de la línea de WhatsApp. Kevin confirma que cuentan con la API oficial de Meta (WhatsApp Business Cloud API). La cuenta está asociada a una tarjeta SIM (chip) física que no se utiliza para llamadas de voz ni uso particular, destinada en exclusiva para el tráfico del chatbot.

#### · Plataforma actual del bot creada por Josué mediante Antigravity Pro
*Dato del negocio · Kevin · 02:03:46 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-29 · Estado: Dato o decisión registrada (no requiere pantalla)*

Kevin revela que la solución de chatbot actual fue implementada por un desarrollador externo llamado Josué empleando la herramienta Antigravity bajo una suscripción Pro costeada por Caprichos. Con el tiempo, Kevin ha continuado ajustando y optimizando el flujo de atención por su cuenta.

#### ☐ Evaluación comparativa de modelos de lenguaje para el bot (ChatGPT, Gemini o alternativa asiática)
*Investigar o revisar · José · 02:03:46 · Prioridad: Próximo · Confianza: Alta · Fuentes: E-30 · Estado: Pendiente (no está en el prototipo)*

José expone que evaluará costos, velocidad, calidad interpretativa y seguridad entre la API de ChatGPT (OpenAI), Google Gemini o una alternativa china (DeepSeek), con el objetivo de presentar a Kevin una comparativa presupuestaria y funcional que optimice el rendimiento del bot.

#### ✔ Optimización financiera mediante flujos híbridos en WhatsApp
*Idea del desarrollador · José · 02:04:49 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-31 · Estado: Implementado en el prototipo*

José explica que la razón del elevado consumo económico en el bot anterior radicaba en someter cada mensaje al modelo de IA generativa. Plantea como solución estructurar la carta y selección de pedidos con botones y formularios nativos de WhatsApp (sin costo de IA), restringiendo el uso del LLM únicamente a brindar sugerencias culinarias y responder dudas abiertas que requieran lenguaje natural. De esta manera, una recarga pequeña de tokens podrá durar hasta seis meses.

#### · Consumo descontrolado de saldo API tras migración a GPT-4o
*Problema actual · Kevin · 02:04:49 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-32 · Estado: Dato o decisión registrada (no requiere pantalla)*

Kevin relata que antes utilizaban el modelo económico `gpt-4o-mini`, pero el desarrollador Josué lo reemplazó por un modelo superior o Pro (`gpt-4o`) para intentar resolver incidencias. Debido a que el bot reenviaba todo el tráfico conversacional hacia la IA sin filtros, el crédito se agotó rápidamente, registrando un gasto imprevisto de casi $10 USD en tan solo tres días.

#### ☐ Compromiso de transferencia de prompts y reglas de contexto del bot
*Pendiente del cliente · Kevin · 02:05:54 · Prioridad: Próximo · Confianza: Alta · Fuentes: E-33 · Estado: Pendiente (no está en el prototipo)*

Kevin se compromete a organizar, depurar y entregar a José el conjunto de directrices, prompts de sistema y vocabulario que ha venido entrenando en el asistente virtual para que comprenda con criterio las solicitudes de los clientes limeños, facilitando su reutilización en el nuevo chatbot.

#### · Despliegue del bot actual en servidor privado sin nombre de dominio
*Investigar o revisar · José · 02:05:54 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-34 · Estado: Dato o decisión registrada (no requiere pantalla)*

Al observar en vivo la pantalla del panel administrativo del bot compartida por Kevin, José descubre que está montado sobre un servidor VPS que responde únicamente en una dirección IP de red privada sin dominio web asignado. Constata además que el proyecto de código fuente fue programado con Antigravity en una computadora física local y posteriormente subido a dicha máquina.

#### ☐ Regla de retención de historial de chat limitado a 10-15 mensajes
*Regla o decisión · Kevin · 02:07:02 · Prioridad: Próximo · Confianza: Alta · Fuentes: E-35 · Estado: Pendiente (no está en el prototipo)*

Kevin detalla el protocolo de gestión de memoria del bot: al culminar la jornada, los mensajes del día pasan automáticamente de la vista "Hoy" a "Todos". Para controlar el consumo de tokens y la memoria operativa, la IA únicamente retiene en contexto activo los últimos 10 a 15 mensajes de la conversación, archivando el historial anterior. Kevin planea solicitar una función de búsqueda para consultar conversaciones archivadas.

#### ◐ Registro persistente de ubicación GPS, celular y nombre del cliente
*Regla o decisión · Kevin · 02:07:02 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-36 · Estado: Parcial o simulado en el prototipo*

Kevin resalta que, al margen del archivado de mensajes antiguos, la base de datos almacena indefectiblemente tres atributos esenciales de cada comensal: sus coordenadas geográficas GPS (para delivery), su número telefónico de celular y su nombre, datos valiosos incluso tratándose de usuarios nuevos no registrados.

#### ✔ Alerta roja "Se requiere atención" y protocolo de transferencia a humano
*Regla o decisión · Kevin · 02:07:02 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-37 · Estado: Implementado en el prototipo*

Kevin describe la bandeja de atención prioritaria del panel del bot: un punto rojo indicador llamado "Se requiere atención". Se activa bajo tres escenarios: 1) Cuando el cliente escribe expresamente que desea interactuar con un humano, 2) En el caso eventual de que el bot no logre absolver una consulta, y 3) Al completarse un pedido de comida, debido a que el bot actual carece de enlace automático con restaurant.pe y obliga a la cajera a copiar y pegar manualmente la comanda para procesarla en el punto de venta.

#### ◐ Mecanismo de "Alta demanda" y ajuste dinámico de tiempos de entrega
*Regla o decisión · Kevin · 02:09:18 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-39 · Estado: Parcial o simulado en el prototipo*

Kevin explica la funcionalidad del interruptor de "Alta demanda" ubicado en la barra superior del panel del bot. Al activarlo (posición ON), el bot reajusta de forma inmediata los tiempos estimados de despacho y entrega prometidos al cliente en sus respuestas automáticas para evitar quejas por demoras en horas punta. Asimismo, cuenta con respuestas rápidas predefinidas (como la plantilla "Listo").

## 3. Administrativo, roles y comprobantes

#### ✔ Gestión dinámica de visibilidad de banners desde el panel administrativo
*Idea del desarrollador · José · 00:14:23 · Prioridad: Próximo · Confianza: Alta · Fuentes: A-22 · Estado: Implementado en el prototipo*

José detalla que la presencia del banner publicitario en la carta será totalmente configurable desde el panel de administración: si en determinada época no hay campañas activas o no se desea publicar contenido promocional, el banner se desactivará automáticamente para no dejar espacios vacíos.

#### ✔ Esquema de roles y permisos en el panel administrativo
*Regla o decisión · José · 00:22:38 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-05 · Estado: Implementado en el prototipo*

José presenta la estructura de perfiles de usuario contemplada para el sistema: administrador (con acceso total a la configuración y métricas), cajero, cocina, barra y mozo. Adicionalmente, señala que revisó el sistema restaurant.pe y constató que también incorporan roles de call center, almacén y repartidor, los cuales podrían sumarse según las necesidades de la cafetería.

#### ◐ Paneles y dashboards estadísticos configurables para el administrador
*Idea del desarrollador · José · 00:22:38 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-06 · Estado: Parcial o simulado en el prototipo*

José describe el dashboard de la vista de administrador, el cual será configurable. Incluirá estadísticas y gráficos de ventas discriminadas por canal (consumo en salón, delivery, recojo en tienda, pedidos por WhatsApp), desglose de ventas por hora y por tiempo, valor promedio diario, tiempos promedio de entrega, ranking de productos más vendidos y alertas de productos con bajo stock.

#### ◐ Compromiso de desarrollo de dashboards a medida
*Pendiente del desarrollador · José · 00:22:38 · Prioridad: Próximo · Confianza: Alta · Fuentes: B-07, B-08 · Estado: Parcial o simulado en el prototipo*

José se compromete explícitamente con Kevin a programar e incorporar cualquier métrica, indicador o gráfico adicional que el negocio requiera visualizar en el panel de control.

- Ver también (B-08, 00:23:20): Kevin consulta si el dashboard permite filtrar los datos por fechas y rangos específicos. José admite que aún no están incluidos en la maqueta actual, pero se compromete a implementar filtros por rango de fechas, día exacto, día de la semana, mes y año.

#### ✔ Filtro de visualización de pedidos en sala por canal de origen
*Idea del desarrollador · José · 00:25:48 · Prioridad: Próximo · Confianza: Alta · Fuentes: B-13 · Estado: Implementado en el prototipo*

José plantea que en el módulo de mesas y pedidos se incorpore un filtro para diferenciar el origen de cada comanda: pedidos generados desde la carta web, enviados vía WhatsApp, ingresados por el mozo desde la tablet o digitados directamente por caja.

#### ✔ Deficiencia operativa del módulo de Call Center en restaurant.pe
*Problema actual · Kevin · 00:44:29 · Prioridad: Próximo · Confianza: Alta · Fuentes: B-34, B-38 · Estado: Implementado en el prototipo*

Kevin indica que restaurant.pe dispone de un módulo rotulado como call center para la recepción de pedidos telefónicos y delivery, pero califica su funcionamiento de inefectivo y engorroso para el ritmo de atención del negocio.

- Ver también (B-38, 00:46:53): Ante la pregunta de José sobre cuándo se justifica emplear el call center, Kevin aclara que no se concibe para una central telefónica compleja, sino como una herramienta de toma manual de pedidos para atender a aquellos clientes que no desean utilizar la carta web ni interactuar con los botones del bot de WhatsApp, prefiriendo llamar por teléfono o enviar su lista de productos por mensaje escrito.

#### ✔ Flujo rápido de registro con campos obligatorios en Call Center
*Regla o decisión · Kevin · 00:44:29 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-35, C-01 · Estado: Implementado en el prototipo*

Kevin demuestra cómo opera la captura de un pedido asistido: primero se ingresa el número telefónico para verificar si el cliente ya está registrado (utiliza de prueba su propio teléfono 946 388 934). Si el cliente no existe, el formulario de alta rápida debe exigir únicamente dos datos indispensables marcados con asterisco: Nombre y Teléfono, permitiendo pasar inmediatamente a definir la dirección y armar la orden.

- Ver también (C-01, 00:45:38): Al tomar un pedido de delivery de forma manual (por llamada o por mensaje de WhatsApp), se busca primero si el cliente ya existe por su número de teléfono (por ejemplo, el 946 388 934). Si el cliente no existe, se abre una ventana rápida para registrarlo como nuevo cliente. En este formulario es indispensable y obligatorio ingresar únicamente dos campos: el nombre y el número telefónico (marcados con asterisco). Tras ingresar estos datos, se puede ubicar la dirección en el mapa, calcular la tarifa y continuar con el pedido.

#### ◐ Falla de georreferenciación en restaurant.pe vs soporte de Google Plus Codes
*Problema actual · Kevin · 00:45:38 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-37, C-02, B-39 · Estado: Parcial o simulado en el prototipo*

> Actualización del 17/10: Decisión del 17/10: se quitó el campo de código Plus; en delivery manda "Usar mi ubicación actual" con mapa y enlace a Google Maps (carta, administrativo y chatbot). Por confirmar con Kevin, que pidió aceptar el código Plus.

Kevin expone una falla crítica en el módulo de mapas de restaurant.pe: el mapa que emplean no permite pegar coordenadas geográficas ni reconoce los Plus Codes de Google Maps que los clientes envían por WhatsApp, obligando al cajero a buscar manualmente la dirección navegando por las calles. Contrasta esto con su anterior sistema (Hola Click), donde bastaba con copiar el código Plus del cliente y pegarlo en el sistema para ubicar el destino exacto al instante.

- Ver también (C-02, 00:45:38): En el flujo habitual de delivery, el cliente envía su ubicación por WhatsApp y aparece un punto rojo en el mapa. En la plataforma anterior (Hola Click), el personal simplemente copiaba el Plus Code (código alfanumérico de Google Maps) y lo pegaba en el buscador del sistema, ubicando la casa al instante. En el sistema actual utilizan un mapa alternativo (cuyo nombre Kevin tiene guardado) donde no se pueden pegar coordenadas ni códigos plus, obligando a buscar la calle manualmente en el mapa, lo cual resulta ineficiente y propenso a errores. Se necesita poder buscar por coordenadas o Plus Codes de Google Maps.

- Ver también (B-39, 00:45:38): Kevin cita como buena práctica la plataforma Hola Click (la cual usaban previamente), destacando que permitía pegar directamente el código Plus de Google Maps en el buscador para fijar la ubicación exacta del domicilio sin pérdida de tiempo ni errores de tipeo.

#### ✔ Referencia a catálogo de roles operativos en restaurant.pe
*Investigar o revisar · José · 00:22:38 · Prioridad: Próximo · Confianza: Alta · Fuentes: B-41 · Estado: Implementado en el prototipo*

José referencia la arquitectura de permisos del panel de restaurant.pe ("rest.p"), mencionando que revisó sus roles de call center, almacén y repartidor para evaluar cuáles aplican al modelo de negocio de Caprichos.

#### ✔ Integración de toma de pedidos manuales en módulos de Mozo y Caja
*Idea del desarrollador · José · 00:46:53 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-04 · Estado: Implementado en el prototipo*

Ante la existencia de una pantalla separada de Call Center para tomar pedidos telefónicos o manuales de clientes que no usan el bot ni la web, José propone no crear un módulo aislado de Call Center, sino dotar al módulo de Mozo o al de Caja de la capacidad de ingresar pedidos manuales con selección de ubicación de delivery. Kevin concuerda en que puede estar en Caja o Mozo.

#### ✔ Restricción de rol: el repartidor de delivery no toma pedidos
*Regla o decisión · Kevin · 00:46:53 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-05 · Estado: Implementado en el prototipo*

Al evaluar qué usuarios del sistema deberían tener acceso a la toma manual de pedidos, José consultó si el repartidor de delivery podría hacerlo. Kevin fue tajante: el personal de reparto nunca toma pedidos; esa responsabilidad está restringida exclusivamente al cajero y a los mozos.

#### · Descarte de tótems de autoservicio (Self Service) por dimensiones del local
*Aplazado, descartado o a futuro · Kevin · 00:48:05 · Prioridad: Futuro · Confianza: Alta · Fuentes: C-06 · Estado: Dato o decisión registrada (no requiere pantalla)*

Al revisar el panel de Delivery Pro, se observó la opción de Self Service (tótems interactivos de autoservicio como los que utilizan locales de gran escala como McDonald's). Kevin aclaró que no lo necesitan ni piensan implementarlo actualmente debido a que las dimensiones físicas del local de Caprichos son reducidas, quedando relegado únicamente como una posibilidad a futuro lejano.

#### ✔ Fragmentación y desorden en interfaces de delivery de Restaurant.pe
*Problema actual · Kevin · 00:50:20 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-08 · Estado: Implementado en el prototipo*

Kevin manifiesta su disconformidad con el sistema actual (Restaurant.pe / Delivery Pro) debido a la proliferación innecesaria de ventanas distintas para gestionar un mismo pedido de delivery: existe una pantalla en Delivery Pro, otra en el menú Caja -> Ventas -> Pedidos en Caja -> Delivery, y otra distinta en el módulo de Call Center. Cada una tiene una interfaz gráfica diferente, lo cual desorienta al personal, entorpece el seguimiento en tiempo real y propicia errores como pedidos duplicados o anulaciones involuntarias.

#### ☐ Revisión técnica de la plataforma y experiencia de usuario en Hola Click
*Pendiente del desarrollador · José · 01:08:33 · Prioridad: Próximo · Confianza: Media · Fuentes: C-35 · Estado: Pendiente (no está en el prototipo)*

Tras el ofrecimiento de Kevin, José acepta las credenciales y se compromete a ingresar a Hola Click para revisar en detalle el flujo de cliente, la verificación de ubicación y los paneles de configuración administrativa.

#### ✔ Creación y desactivación en cascada de categorías estacionales o por temporada
*Idea del desarrollador · José · 01:10:02 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-36 · Estado: Implementado en el prototipo*

En el gestor de catálogo se permitirá dar de alta múltiples categorías de productos. Se incluirá la capacidad de desactivar temporalmente una categoría completa (ideal para líneas de temporada festiva o estacional), logrando que todos los artículos agrupados en dicha categoría queden ocultos en cascada de la carta digital de forma instantánea.

#### ✔ Creación del rol operativo de Producción y Almacén
*Idea del desarrollador · José · 01:14:24 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-43, D-03 · Estado: Implementado en el prototipo*

Para soportar operativamente el flujo matutino descrito por Kevin, José establece que en la gestión de roles y permisos se creará un perfil específico para la encargada de repostería/cocina con permisos acotados exclusivamente a la extracción de insumos de almacén y al registro de producto terminado en stock diario.

- Ver también (D-03, 01:14:24): José plantea que la encargada de elaborar los productos por la mañana dispondrá en el sistema de un perfil con doble función: rol de almacén (para registrar las salidas de insumos) y rol de preparación de productos (para dar de alta el stock final terminado).

#### ✔ Autorización para el registro de mermas
*Regla o decisión · Kevin · 01:15:21 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-05 · Estado: Implementado en el prototipo*

> Actualización del 17/10: Las mermas las registran almacén, producción y el administrador (que tiene todos los permisos).

El ingreso y control de las mermas en el sistema es una facultad restringida que realizan únicamente Kevin y, en ocasiones, la supervisora del local.

#### ? Rol de almacenero vespertino asignado al repartidor de delivery
*Regla o decisión · Kevin · 01:16:53 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-06 · Estado: Duda abierta: falta decidir*

Para cubrir las salidas de insumos durante el turno tarde y noche (como vasos, sorbetes, tapas, servilletas, azúcar, crema de leche, fresas, etc.), el repartidor de delivery principal asume el rol de almacenero. Él contará con un usuario en el sistema para registrar las salidas de insumos por la tarde y registrar las entradas cuando llegue mercadería.

#### ✔ Acceso administrativo para Kevin y suplencia ante descansos del almacenero
*Regla o decisión · Kevin · 01:16:53 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-07 · Estado: Implementado en el prototipo*

Kevin requiere contar con credenciales de acceso para registrar directamente las entradas de mercadería que él mismo adquiere y transporta al local. Además, cuando el delivery almacenero descansa, Kevin asume dicha función, puesto que el repartidor secundario solo trabaja un día a la semana y desconoce la distribución de los insumos en el almacén.

#### ☐ Gráficos y diagramas para reportes de ventas por mozo y producto
*Idea del desarrollador · José · 01:29:46 · Prioridad: Próximo · Confianza: Alta · Fuentes: D-22 · Estado: Pendiente (no está en el prototipo)*

José revisa la sección de informes y ventas por mozo y por producto, proponiendo enriquecer la visualización de datos mediante gráficos y diagramas en lugar de tablas planas de texto.

#### ✔ Editor visual interactivo de la carta web desde el panel administrativo
*Idea del desarrollador · José · 01:36:14 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-31, D-40, E-02 · Estado: Implementado en el prototipo*

José muestra el módulo de diseño de la carta web donde el administrador puede reubicar productos, cambiar fotografías y editar descripciones directamente sobre la vista previa en pantalla, destacando que es un esquema mucho más ágil e intuitivo que editar mediante formularios y tablas tradicionales.

- Ver también (D-40, 01:46:39): José muestra cómo ordenar interactivamente las categorías y productos de la carta mediante una vista previa dinámica en el panel de administración (por ejemplo, desplazar frappés hacia abajo, ubicar la categoría Ice en la primera posición o reordenar combos Dúo) sin necesidad de llenar tablas o formularios engorrosos.

- Ver también (E-02, 01:46:39): José explica que la administración del orden de las categorías de la carta es visual e intuitiva, alejándose de formularios o tablas tradicionales. Se pueden mover bloques arriba o abajo fácilmente (por ejemplo, mandar Frapés al fondo, colocar la categoría de cafés fríos / Ice en primer lugar o crear una sección destacada para el aniversario del local).

#### ✔ Reordenamiento de productos dentro de una misma categoría
*Pedido del cliente · Kevin · 01:46:39 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-03 · Estado: Implementado en el prototipo*

Kevin consulta y solicita que el sistema permita definir el orden de aparición de los productos específicos dentro de una categoría (por ejemplo, priorizar que aparezca primero el chocolate o el waffle). José confirma que el panel dispone de controles con flechas para reordenar cada ítem individualmente (ejemplo: subir Iced Coffee al primer lugar).

#### ✔ Módulo administrativo para edición de paleta de colores
*Idea del desarrollador · José · 01:47:19 · Prioridad: Próximo · Confianza: Alta · Fuentes: E-04 · Estado: Implementado en el prototipo*

José destaca que el sistema incluye un módulo dedicado de paleta de colores en el panel de control. Si al cliente no le satisface la combinación de colores predeterminada, podrá ajustarla y personalizarla directamente según sus preferencias de marca.

#### ✔ Depuración de secciones innecesarias heredadas de restaurant.pe
*Aplazado, descartado o a futuro · José · 01:47:19 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-05 · Estado: Implementado en el prototipo*

José analiza módulos confusos presentes en la plataforma anterior restaurant.pe (tales como "Datos de la empresa" y "Condición servicio externo"), concluyendo que carecen de intuición y no aportan valor operativo práctico, por lo que propone eliminarlos de la nueva plataforma. Kevin coincide plenamente en que no son necesarios.

#### ✔ Definición de moneda única en Soles peruanos
*Regla o decisión · Kevin · 01:48:14 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-07 · Estado: Implementado en el prototipo*

Ante la consulta de José sobre la configuración monetaria del sistema, Kevin confirma de forma terminante que todas las listas de precios, comandas, cuentas y cobros operan exclusivamente en soles peruanos (PEN), sin requerimiento de gestión multimoneda.

#### · Omisión de módulo tributario y Kardex contable para SUNAT
*Aplazado, descartado o a futuro · Kevin · 01:49:18 · Prioridad: Futuro · Confianza: Alta · Fuentes: E-08 · Estado: Dato o decisión registrada (no requiere pantalla)*

José indaga si el café genera Kardex o declaraciones tributarias mensuales para SUNAT a través del software. Kevin explica que no se necesita incorporar esa lógica en el sistema por ahora, debido a que él efectúa la declaración mensual directamente en el portal web de SUNAT, validando allí las propuestas prellenadas de compras y ventas de la empresa.

#### ✔ Configuración de tipos de comprobante y Nota de Venta por defecto
*Pedido del cliente · Kevin · 01:49:18 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-09 · Estado: Implementado en el prototipo*

Kevin establece como regla de negocio estricta que al cobrar se disponga de tres alternativas de comprobante: Boleta, Factura y Nota de venta. Exige que todas las ventas salgan configuradas por defecto como Nota de Venta; en caso de que un cliente solicite expresamente boleta o factura, el cajero deberá realizar la modificación de forma manual.

#### · Postergación de facturación electrónica directa con SUNAT
*Aplazado, descartado o a futuro · Kevin · 01:49:18 · Prioridad: Futuro · Confianza: Alta · Fuentes: E-10 · Estado: Dato o decisión registrada (no requiere pantalla)*

Kevin aclara que la sincronización automática de facturas y boletas electrónicas directamente hacia los servidores de SUNAT no se requiere en la fase inicial, acordando evaluar más adelante su conexión e integración directa.

#### ✔ Módulo de gestión de usuarios y jerarquía de permisos
*Idea del desarrollador · José · 01:50:27 · Prioridad: Próximo · Confianza: Alta · Fuentes: E-11 · Estado: Implementado en el prototipo*

José expone el funcionamiento del módulo de usuarios, orientado a crear cuentas de empleados, editarlas y desactivar al personal que cese sus funciones. Se establece la regla de seguridad de que únicamente el administrador tendrá autorización para cambiar nombres y usuarios; el personal operativo únicamente podrá cambiar su foto de perfil y cerrar su sesión.

#### ✔ Centro de notificaciones generales en panel administrativo
*Idea del desarrollador · José · 01:50:27 · Prioridad: Próximo · Confianza: Media · Fuentes: E-13 · Estado: Implementado en el prototipo*

José plantea incorporar una sección centralizada de notificaciones en el panel administrativo para alertar a los usuarios sobre eventos importantes de la operación o mensajes del sistema.

#### ✔ Protocolo operativo del botón "Marcar como atendido"
*Regla o decisión · Kevin · 02:09:18 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-38 · Estado: Implementado en el prototipo*

Kevin describe la dinámica de trabajo de los operadores en el panel: tras gestionar una consulta o transcribir un pedido derivado en la bandeja "Se requiere atención", el operador presiona el botón "Marcar como atendido" en la parte derecha de la pantalla. Dicha conversación sale de la cola de alerta y se traslada a la pestaña "Hoy", manteniendo limpia la lista de casos pendientes. La cajera debe vigilar ambas pantallas durante su turno.

## 4. Cocina, pantallas e impresión

#### ☐ Visita técnica para evaluar pantallas de cocina y flujo de trabajo actual
*Compromiso · Kevin · 00:00:00 · Prioridad: Próximo · Confianza: Alta · Fuentes: A-01 · Estado: Pendiente (no está en el prototipo)*

Kevin indica que en ese momento se encuentran saturados en el local, por lo que plantea coordinar para un día por la tarde una visita presencial de José para que observe en vivo el funcionamiento de las pantallas de cocina y el flujo de trabajo operativo con el sistema actual.

#### ✔ Inclusión de clave Wi-Fi en el ticket o voucher impreso
*Pedido del cliente · Kevin · 00:27:49 · Prioridad: Próximo · Confianza: Alta · Fuentes: B-16 · Estado: Implementado en el prototipo*

José consulta si actualmente imprimen el acceso Wi-Fi en el comprobante. Kevin indica que actualmente no figura en el voucher impreso, pero solicita que se configure el formato de ticket para imprimir la red y contraseña de Wi-Fi de forma automática.

#### ✔ Impresión de comandas en etiquetas autoadhesivas para vasos de bebidas
*Pedido del cliente · Kevin · 00:29:47 · Prioridad: Próximo · Confianza: Alta · Fuentes: B-19, B-40 · Estado: Implementado en el prototipo*

Kevin solicita que el nuevo sistema soporte impresoras de stickers/etiquetas autoadhesivas para que la comanda de barra se imprima en una etiqueta adhesiva y se pegue directamente en el vaso de la bebida, emulando la metodología de trabajo de Starbucks (tanto en sucursales locales como en Estados Unidos).

- Ver también (B-40, 00:29:47): Kevin toma como referente el flujo de barra de Starbucks en Estados Unidos y algunas sucursales locales, donde las comandas de café y bebidas se expiden en etiquetas adhesivas que se adhieren al vaso, sugiriendo replicar este estándar operativo en Caprichos.

#### ✔ Pantallas de cocina web (KDS) vinculadas por URL y código de seguridad
*Idea del desarrollador · José · 00:32:04 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-21 · Estado: Implementado en el prototipo*

José detalla la solución arquitectónica para las pantallas de cocina: se accederá mediante un navegador web a una URL. Al ingresar por primera vez, el sistema solicitará un código de vinculación. El administrador, desde el panel administrativo, autorizará dicho código para habilitar la pantalla y comenzar a desplegar las comandas en tiempo real.

#### ✔ Inestabilidad de app de escritorio de restaurant.pe y migración a KDS web en red local
*Problema actual · Kevin · 00:32:04 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-22 · Estado: Implementado en el prototipo*

Kevin relata que desde que comenzaron a operar usaban el aplicativo de escritorio de restaurant.pe instalado en las computadoras para las pantallas de cocina, pero sufría de constantes errores y fallas. Ante sus reclamos técnicos, el proveedor les configuró recientemente una versión de pantalla de cocina web que funciona mediante URL sobre la red local.

#### ☐ Uso de 3 televisores Smart TV en salón para avisos de pedidos a clientes
*Dato del negocio · Kevin · 00:33:09 · Prioridad: Próximo · Confianza: Alta · Fuentes: B-23 · Estado: Pendiente (no está en el prototipo)*

Kevin precisa la infraestructura de pantallas del establecimiento: cuentan con tres (3) televisores Smart TV ubicados en el salón principal para que los comensales visualicen la cola de pedidos (pedidos por preparar, en preparación y listos para entrega). Aclara que no se utilizan en la cocina interna, sino de cara al cliente en salón.

#### ✔ Estructura de producción en tres áreas independientes con PCs dedicadas
*Regla o decisión · Kevin · 00:33:09 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-24 · Estado: Implementado en el prototipo*

Kevin establece formalmente que la producción de Caprichos está dividida en tres áreas de trabajo independientes: 1) Salados, 2) Postres y 3) Bebidas. Cada área dispone de su propia computadora fija con pantalla KDS para gestionar sus comandas específicas.

#### ✔ Incapacidad de restaurant.pe para segmentar ítems de combos en pantallas de cocina
*Problema actual · Kevin · 00:34:01 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-25 · Estado: Implementado en el prototipo*

Kevin expone una limitación crítica de restaurant.pe con la promoción "Dúo Compartir" (2 bebidas y 2 complementos). Debido a la rigidez del módulo de combos, debieron configurarlo como producto simple. Al ser producto simple, el sistema no permite desglosar los ítems entre estaciones de trabajo: la orden completa se envía a Bebidas y no se visualiza en Postres. Si el área de Postres activa la visualización de Bebidas para ver su parte, su pantalla se satura con todas las comandas de bebidas ajenas.

#### ✔ Despacho segmentado por pantalla de área y visualización de modificadores
*Pedido del cliente · Kevin · 00:36:29 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-26 · Estado: Implementado en el prototipo*

Kevin exige que cada pantalla de estación reciba exclusivamente los productos que le corresponde elaborar (salados a cocinera, postres a repostería, cafés/bebidas al barista), junto con sus especificaciones y modificadores (azúcar, stevia, sin salsas, etc.), sin saturar visualmente a los operarios con productos de otras áreas durante horas pico.

#### ◐ Incorporación de pantalla o etiquetera central para despacho consolidado
*Pedido del cliente · Kevin · 00:36:29 · Prioridad: Próximo · Confianza: Alta · Fuentes: B-27 · Estado: Parcial o simulado en el prototipo*

> Actualización del 17/10: La vista "Todas" del administrativo junta las áreas; falta la etiquetera central.

Kevin anuncia que adquirirán una pantalla adicional o una etiquetera dedicada específicamente al área de despacho final. En este punto de salida sí se requiere que aparezca la comanda completa con todos los productos consolidados (bebidas, postres y salados) para validar y ensamblar el pedido antes de entregarlo a la mesa, al cliente de recojo o al repartidor.

#### · Revisión en vivo de comandas reales en pantalla de cocina de restaurant.pe
*Problema actual · Kevin · 00:40:50 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-31 · Estado: Dato o decisión registrada (no requiere pantalla)*

A las 21:55 Kevin comparte pantalla mostrando la operación en tiempo real del KDS de restaurant.pe. Revisa comandas activas: una dona artesanal enviada hace 4 minutos, un club sándwich (ticket 4931) y un consumo en sala de la trabajadora Alexandra en la mesa M01. Señala como problema recurrente que el personal de cocina no despeja oportunamente los pedidos terminados en pantalla.

#### ✔ Eliminación de barras de desplazamiento (scroll) en pantalla KDS táctil
*Pedido del cliente · Kevin · 00:42:00 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-32 · Estado: Implementado en el prototipo*

Kevin critica severamente que la pantalla de cocina de restaurant.pe requiera desplazarse verticalmente con scroll para ver las comandas. Explica que los cocineros y baristas manipulan alimentos y tienen las manos húmedas o con guantes, por lo que resulta impráctico hacer scroll. La interfaz debe mostrar todas las tarjetas de un vistazo y permitir despejarlas con un solo clic o toque en pantalla.

#### ✔ Datos indispensables en la comanda de cocina: notas, mozo, ticket y cronómetro
*Regla o decisión · Kevin · 00:43:10 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-33 · Estado: Implementado en el prototipo*

Analizando las comandas en pantalla, Kevin y José validan los elementos informativos imprescindibles que debe portar cada tarjeta de KDS: nombre del plato con modificador detallado (ej. frutos del bosque en medio waffle, dona rellena de manjar blanco), comentarios de personalización (ej. sin tomate, sin mayonesa), nombre del mozo que atendió, número identificador de ticket y cronómetro con el tiempo transcurrido desde la orden.

#### ? Descarte temporal de televisores Smart TV en cocina en favor de computadoras
*Aplazado, descartado o a futuro · Kevin · 00:33:09 · Prioridad: Futuro · Confianza: Alta · Fuentes: B-42 · Estado: Duda abierta: falta decidir*

Aunque José diseñó la vista de KDS pensando en su eventual proyección en pantallas Smart TV de cocina, Kevin descarta utilizar Smart TVs en las zonas de preparación por el momento, confirmando que seguirán operando con computadoras de escritorio dedicadas en cada área (salados, postres y bebidas).

#### ◐ Abastecimiento matutino y conservación en mesas refrigeradas de cocina
*Regla o decisión · Kevin · 01:26:46 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-16 · Estado: Parcial o simulado en el prototipo*

El personal del área de salados inicia su jornada abasteciéndose en el almacén de los insumos necesarios para el día (quesos, jamones, verduras, congelados) y registra una salida global matutina. Dichos insumos se conservan en las mesas refrigeradas y congeladoras propias de la estación de cocina. Si requieren insumos adicionales durante el día, acuden y registran la salida.

#### ◐ Configuración y gestión de impresoras de producción por red local
*Pedido del cliente · Kevin · 01:48:14 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-06 · Estado: Parcial o simulado en el prototipo*

Kevin recalca que la administración de impresoras para áreas de producción es un componente indispensable del sistema. José aclara que la conexión con las impresoras térmicas se efectuará a través de la red local (LAN) del café, requiriendo únicamente conocer el modelo de cada equipo. Kevin ratifica que la red y los equipos son plenamente manejables.

#### ? Identificación del modelo y protocolo de las impresoras térmicas de producción
*Duda abierta · José · 01:48:14 · Prioridad: Próximo · Confianza: Alta · Fuentes: E-44 · Estado: Duda abierta: falta decidir*

Queda pendiente identificar la marca, modelo exacto y protocolo de conexión (ESC/POS, red cableada o USB compartida en red) de las impresoras de producción del establecimiento para garantizar la emisión directa de tickets y comandas de cocina desde la red local.

## 5. Mesas, pedidos en sala y reservas

#### ✔ Opción de número de mesa para consumo en local desde Carta Web
*Regla o decisión · José · 00:00:54 · Prioridad: Próximo · Confianza: Alta · Fuentes: A-04 · Estado: Implementado en el prototipo*

Al seleccionar la modalidad de pedido para consumo en el local, la carta web solicita los datos del cliente (nombre, apellido) e incluye el número de mesa asignada, confirmando José que mantendrá dicho campo activo para pedidos en sala.

#### ✔ Plano interactivo con distribución física de mesas del local
*Idea del desarrollador · José · 00:23:20 · Prioridad: Próximo · Confianza: Alta · Fuentes: B-09, E-12 · Estado: Implementado en el prototipo*

José muestra un módulo de pedidos y caja que incorpora un plano interactivo configurable para reflejar la distribución real del salón de Caprichos (por ejemplo, ubicando con precisión las mesas situadas junto a la puerta de ingreso) para orientar y facilitar la labor de los mozos al tomar y llevar comandas.

- Ver también (E-12, 01:50:27): José presenta la interfaz interactiva para el diseño del plano del salón. Aunque actualmente atienden con equipos de cómputo fijos, la herramienta permite agregar mesas, desactivarlas y reorganizarlas arrastrándolas. También permite ubicar puntos estructurales de referencia como la barra, la puerta de ingreso, los servicios higiénicos y la salida de cocina/luz, facilitando la ubicación espacial de los mozos al tomar comandas.

#### ✔ Mecanismo de detección y visualización de mesas ocupadas vs libres
*Duda abierta · José · 00:24:07 · Prioridad: Próximo · Confianza: Alta · Fuentes: B-10, C-10 · Estado: Implementado en el prototipo*

José expone que aún tiene pendiente definir cómo el sistema determinará y mostrará si una mesa está ocupada o libre, señalando que debe evaluar la mejor manera técnica y operativa de implementarlo.

- Ver también (C-10, 00:53:44): Para resolver de raíz el problema de concurrencia y evitar el uso de mesas ficticias, José propone que el plano de mesas se actualice en tiempo real. Si un mozo o el cajero intenta ingresar una comanda en una mesa que acaba de ser ocupada por otro usuario, el sistema bloqueará la acción y desplegará un mensaje de alerta preventivo (ejemplo: "La mesa número X está ocupada"), evitando la pérdida de pedidos o la duplicidad de cuentas.

#### ✔ Conflicto operativo por liberación prematura de mesa en cobro anticipado
*Problema actual · Kevin · 00:24:07 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-11 · Estado: Implementado en el prototipo*

> Actualización del 17/10: La mesa se libera al cobrar y también a mano por mozo o caja.

Kevin describe la lógica de ocupación actual: al abrir una comanda la mesa queda vinculada al nombre del cliente. En restaurant.pe la mesa se libera automáticamente en el momento en que se procesa el cobro. Dado que en Caprichos acostumbran cobrar de forma adelantada al momento de pedir, el sistema borra y libera la mesa de inmediato, provocando un desfase entre el estado digital del salón y los clientes que continúan físicamente consumiendo en la mesa.

#### ◐ Política comercial de cobro adelantado con flexibilidad y estímulo al pago al retirarse
*Regla o decisión · Kevin · 00:24:52 · Prioridad: Próximo · Confianza: Alta · Fuentes: B-12 · Estado: Parcial o simulado en el prototipo*

Kevin explica que instruye a su equipo a solicitar el cobro por adelantado con amabilidad (mencionando como ejemplo: "sería 25 soles, ¿cancela con Yape o en efectivo?"), pero aclara que si un cliente solicita pagar al final de su estancia, se le concede sin problema. José sugiere no forzar pero sí incentivar al comensal a pagar al final para que la liberación de la mesa en el plano coincida con su partida física real. Kevin aprueba esta directriz.

#### ✔ Restricción de cobro a mozos y circuito de precuenta para control de dinero
*Regla o decisión · Kevin · 00:26:48 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-14 · Estado: Implementado en el prototipo*

Kevin detalla una regla estricta de seguridad financiera: el usuario con rol de mozo no tiene permisos para cobrar en el sistema. El único responsable de registrar el cobro y manipular dinero es el cajero. El mozo solo puede imprimir o emitir una precuenta con el desglose del consumo, acudir a la mesa a cobrarle al cliente con ese documento, trasladar el dinero en efectivo o comprobante digital a la caja, y es allí donde el cajero valida el ingreso y expide el comprobante fiscal definitivo.

#### ✔ Soporte dual en salón: pedidos mediante QR y atención asistida por mozo
*Pedido del cliente · Kevin · 00:26:48 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-15 · Estado: Implementado en el prototipo*

Al evaluar la toma de pedidos mediante códigos QR en mesa, Kevin señala que en su zona muchos comensales son grupos familiares o personas mayores que no se sienten cómodas escaneando QR y prefieren la atención personalizada tradicional, siendo el QR más adecuado para jóvenes. José propone que la plataforma brinde ambas opciones: auto-pedido escaneando el QR de la mesa, o asistencia del mozo mostrando el catálogo en su tablet o ingresando el número de mesa directamente.

#### ✔ Conflicto de pedidos concurrentes en la misma mesa y artificio de 30 mesas
*Problema actual · Kevin · 00:52:16 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-09 · Estado: Implementado en el prototipo*

El salón de Caprichos cuenta físicamente con aproximadamente 8 mesas. Sin embargo, en el software tuvieron que configurar artificialmente 30 mesas. Esto ocurrió porque los mozos usaban las mesas 1 al 8 y el cajero las mesas 9 al 30. Si el mozo y el cajero tomaban un pedido simultáneamente seleccionando la misma mesa vacía (por ejemplo, la mesa 02), el sistema actual no alertaba de la concurrencia: al guardar, las comandas de clientes distintos se fusionaban en una sola cuenta o el segundo pedido se perdía.

#### ✔ Opción independiente de "Para llevar" para ventas en caja sin mesa física
*Idea del cliente · Kevin · 00:53:44 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-11 · Estado: Implementado en el prototipo*

Al analizar el flujo de pedidos en caja, Kevin plantea cómo se registrarán las compras presenciales de clientes que piden para llevar sin ocupar una mesa en el salón. José confirma que en el módulo de ventas compartidas se incorporará un botón o selector expreso de "Para llevar" que permita procesar la venta y comandar productos sin vincular obligatoriamente una mesa física del plano.

#### ◐ Margen de tolerancia de 15 minutos en reservas de mesa
*Regla o decisión · Kevin · 00:55:09 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-12 · Estado: Parcial o simulado en el prototipo*

Las reservas en Caprichos se solicitan con baja recurrencia (aproximadamente de 4 a 5 veces al mes). La regla operativa del negocio es agendar la mesa para la hora pactada y conceder una tolerancia estricta de 15 minutos. Si los comensales no se presentan cumplido ese lapso, la mesa se libera de inmediato para atender a los clientes en espera en el salón.

#### · Descarte de reserva con selección previa de platos desde la página web
*Aplazado, descartado o a futuro · Kevin · 00:56:25 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-13 · Estado: Dato o decisión registrada (no requiere pantalla)*

José planteó habilitar en la web pública una función para que los clientes separen mesa y elijan sus platos con antelación. Kevin descartó la idea: los clientes que reservan acuden a encuentros sociales o de trabajo y no saben con anticipación qué consumirán; el pedido de alimentos se toma recién cuando llegan y se sientan. Habilitar pre-órdenes en la web añadiría complejidad innecesaria y entorpecería la experiencia del usuario.

#### ✔ Señalización gráfica de mesa reservada ("R" y color rojo/naranja) en el plano
*Idea del cliente · Kevin · 00:57:43 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-14 · Estado: Implementado en el prototipo*

En vez de estructurar un módulo complejo e independiente de reservas, Kevin prefiere mantenerlo simple y operativo en el plano de mesas existente: contar con una opción para marcar una mesa como reservada, cambiando visualmente su estado con un color distintivo (naranja o rojo) y una letra "R" visible.

#### ☐ Notificación administrativa previa de 15 minutos para colocar señalizador físico
*Idea del desarrollador · José · 00:57:43 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-15 · Estado: Pendiente (no está en el prototipo)*

Cuando una mesa sea reservada con horas de anticipación, el panel administrativo emitirá una alerta visual/sonora 15 minutos antes de la hora programada ("En 15 minutos la mesa 5 va a estar reservada"). Esto servirá para que el personal de sala se acerque y coloque en la mesa física un soporte o flyer informativo de reserva ("base informativa") que tienen disponible en el local.

#### ✔ Canal de reservas centralizado exclusivamente por WhatsApp
*Regla o decisión · Kevin · 00:58:46 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-16 · Estado: Implementado en el prototipo*

Queda formalmente descartado incluir un flujo de reservas dentro de la carta web para el cliente final. Kevin argumenta que programar reservas en la web representaría un esfuerzo innecesario para una función que apenas se usa 4 o 5 veces al mes y saturaría visualmente la carta con botones prescindibles. Se mantendrá el canal habitual: el cliente consulta disponibilidad por WhatsApp y el personal registra la reserva manualmente en el sistema.

## 6. Clientes, puntos, créditos y descuentos

#### ✔ Reincorporación del sistema de puntos y simplificación de asignación
*Pedido del cliente · Kevin · 01:00:36 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-20 · Estado: Implementado en el prototipo*

> Actualización del 17/10: 1 punto por cada s/ 1, solo con cuenta; se ven en la cabecera de la carta y al terminar el pedido.

Kevin solicita expresamente volver a habilitar el programa de fidelización por puntos, señalando que la clientela habitual lo solicita de manera constante. Recuerda que Hola Click contaba con puntos, pero presentaba la gran desventaja de obligar a configurar y definir las reglas de puntos de manera individual producto por producto, lo que resultaba muy engorroso de mantener.

#### ✔ Modelo de compra de Cineplanet (invitado sin puntos vs logueado con puntos)
*Investigar o revisar · José · 01:01:34 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-21 · Estado: Implementado en el prototipo*

> Actualización del 17/10: Botón "Ingresar" en la carta: ingresar, crear cuenta o seguir como invitado, sin obligar. El inicio de sesión es visual.

José plantea como referencia técnica la experiencia de compra en línea de Cineplanet: ofrecer al cliente la opción de realizar pedidos de forma ágil como invitado (comprando directamente sin acumular puntos) o mediante inicio de sesión/registro de cuenta, en cuyo caso sí acumula puntos canjeables por beneficios en sus consumos.

#### ◐ Recolección de fecha de cumpleaños para campañas automáticas de fidelización
*Idea del cliente · Kevin · 01:01:34 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-22 · Estado: Parcial o simulado en el prototipo*

Kevin solicita que el formulario de registro de clientes en la plataforma incluya obligatoriamente el campo de fecha de cumpleaños. El objetivo comercial es automatizar campañas de saludo y fidelización enviando al cumpleañero promociones personalizadas, cortesías u obsequios especiales en su fecha festiva.

#### ☐ Inicio de sesión basado en correo electrónico para recopilar correos verídicos
*Regla o decisión · Kevin · 01:02:33 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-23 · Estado: Pendiente (no está en el prototipo)*

Al definir si el login debe usar nombre de usuario o correo, Kevin resuelve que sea obligatoriamente por correo electrónico. Explica que esto permite captar el correo personal real del cliente (Gmail, Outlook, etc.) en vez de un alias ficticio inventado solo para Caprichos, construyendo una base de datos de correos verificados para futuras estrategias de email marketing.

#### ☐ Inclusión de aviso de privacidad y tratamiento de datos personales en el registro
*Idea del desarrollador · José · 01:02:33 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-24 · Estado: Pendiente (no está en el prototipo)*

Al recopilar información personal sensible del cliente durante el proceso de registro (nombres completos, teléfonos, direcciones residenciales, correos electrónicos y fechas de cumpleaños), José señala que se debe colocar un pie informativo o cláusula legal de privacidad y términos y condiciones, asegurando al usuario que sus datos serán tratados y almacenados de manera segura.

#### · Aplazamiento de niveles y categorías de puntos (Platino, Súper Capricho)
*Aplazado, descartado o a futuro · José · 01:03:27 · Prioridad: Futuro · Confianza: Alta · Fuentes: C-25 · Estado: Dato o decisión registrada (no requiere pantalla)*

José propone estructurar niveles de membresía o categorías de fidelización escalonadas por puntos acumulados (por ejemplo, nivel Platino o cliente "Súper Capricho") con privilegios crecientes. Kevin muestra agrado por el concepto, pero ambos coinciden en aplazar su diseño y parametrización para una etapa posterior.

#### ✔ Sistema de crédito interno para consumo del personal con plazo de 15 días
*Regla o decisión · Kevin · 01:03:27 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-26 · Estado: Implementado en el prototipo*

> Actualización del 17/10: Cobro "a crédito del personal" en Pedidos y caja; plazo configurable (15 días de inicio); módulo Créditos del personal con filtros por trabajador y mes.

En Caprichos no se otorga crédito comercial a clientes externos bajo ninguna circunstancia. Sin embargo, sí existe una política activa de crédito para el personal de la empresa: los trabajadores pueden consumir productos a cuenta y disponen de hasta 15 días (o liquidación quincenal/fin de mes) para saldar su deuda.

#### ✔ Descuento del 25% para personal con exclusión de combos y promociones
*Regla o decisión · Kevin · 01:04:24 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-27 · Estado: Implementado en el prototipo*

> Actualización del 17/10: Porcentaje configurable (25 % de inicio); se calcula sin combos, promociones ni docenas (estimado con los precios de la carta).

Los trabajadores del equipo (beneficio extendido a José por su colaboración en el proyecto) gozan de un 25% de descuento sobre el precio de carta regular. Se establecen excepciones estrictas: el 25% no es acumulable ni aplica a combos ni promociones, excluyendo expresamente el "Dúo Compartir", el "Dúo Irresistible" y la media docena de donas (ítems que ya cuentan con tarifa rebajada). Se detallan precios resultantes: una dona individual queda en S/ 3.00 y un frappé de S/ 14.50 se reduce a aproximadamente S/ 10.50 o S/ 10.60. A los empleados les resulta más económico comprar productos individuales con su 25% que adquirir combos.

#### ◐ Disponibilidad estructural del módulo de crédito autenticado por cuenta de usuario
*Idea del cliente · Kevin · 01:05:24 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-28 · Estado: Parcial o simulado en el prototipo*

> Actualización del 17/10: Decisión del 17/10: el crédito es solo para el personal (Kevin dijo "ponle para todos"). Por confirmar con Kevin.

Aunque el crédito se destina operativamente solo al equipo de trabajo, Kevin pide que el módulo de créditos no se bloquee a nivel de código ni se limite exclusivamente a un rol, sino que quede disponible de forma general en el sistema (tal como lo permite Restaurant.pe). Cada colaborador contará con su cuenta de usuario individual para iniciar sesión y registrar sus compras a crédito como si fuera un cliente registrado.

#### ◐ Asociación de cupones y descuentos a la cuenta autenticada del cliente
*Idea del cliente · Kevin · 01:05:24 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-29 · Estado: Parcial o simulado en el prototipo*

> Actualización del 17/10: Hay cupones que exigen cuenta y la cuenta del cliente ya existe; falta controlar usos y límite por cliente.

Kevin destaca que la aplicación de cupones promocionales y descuentos especiales debe realizarse a través de la cuenta de usuario del cliente, garantizando el control de acceso, la trazabilidad del uso y la validación de condiciones como la fecha de caducidad y el porcentaje o monto del beneficio.

#### ◐ Definición de parámetros y condiciones de cupones para Caprichos
*Duda abierta · José · 01:06:22 · Prioridad: No se sabe · Confianza: Alta · Fuentes: C-30 · Estado: Parcial o simulado en el prototipo*

> Actualización del 17/10: Constructor de cupones completo (código, % o monto, mínimo, vigencia, usos, categoría, canal, cuenta). Falta validar las reglas con Kevin.

José formuló preguntas puntuales sobre las reglas de negocio de los cupones en Caprichos: cuánto tiempo de validez tendrán, cuál será el importe o porcentaje de descuento y sobre qué categorías o productos específicos aplicarán. Kevin no respondió los valores numéricos concretos para su negocio, sino que remitió a revisar las opciones existentes en Restaurant.pe, quedando pendiente definir la política comercial propia.

#### ☐ Envío del enlace de Restaurant.pe sobre configuración de cupones y descuentos
*Pendiente del cliente · Kevin · 01:06:22 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-31 · Estado: Pendiente (no está en el prototipo)*

Kevin afirma que Restaurant.pe tiene un módulo muy completo y detallado para estructurar cupones de descuento y promociones, y se compromete formalmente a remitirle el enlace web a José para que analice la arquitectura, campos y opciones de parametrización disponibles en ese sistema.

## 7. Almacén, stock, recetas y compras

#### ✔ Regla operativa de stock: productos de panadería y repostería sin disponibilidad diaria fija
*Dato del negocio · José · 00:20:36 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-33 · Estado: Implementado en el prototipo*

Se identifica un factor operativo clave en Caprichos: determinados productos de repostería y panadería artesanal como las donas (en sus diversas variedades), pitipanes y empanadas no se elaboran ni se encuentran disponibles todos los días en el local.

#### ◐ Sincronización en tiempo real del Chatbot con el inventario y stock de la base de datos
*Regla o decisión · Kevin · 00:20:36 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-34, B-01, B-30 · Estado: Parcial o simulado en el prototipo*

Kevin destaca el problema actual de que los clientes piden y pagan productos que no tienen stock físico disponible ('va a pedir por las puras'). Se acuerda como requisito crítico que el nuevo chatbot esté enlazado y sincronizado en tiempo real con la base de datos de stock: si un producto se agota o se desactiva desde el panel administrativo, el bot debe actualizar su oferta al instante.

- Ver también (B-01, 00:21:34): Kevin plantea que el chatbot de WhatsApp debe sincronizarse y actualizarse automáticamente en tiempo real cada vez que se modifique o administre el catálogo, los precios y las promociones desde el panel administrativo del menú (por ejemplo, promociones festivas como las de Navidad o productos rotativos como empanadas y pitipanes).

- Ver también (B-30, 00:39:36): Kevin indica que trabajan con pulpa de fruta fresca procesada diariamente (por ejemplo, lúcuma fresca para el batido "Chocolúcuma"). Si en un día se agota la fruta, ese producto debe inhabilitarse de inmediato en la carta web y sincronizarse en tiempo real con el bot de WhatsApp, ofreciendo alternativas o recomendaciones al comensal para concretar la venta. José confirma que la sincronización con WhatsApp será en tiempo real.

#### ✔ Continuidad comercial de combos ante quiebre de stock de complementos
*Regla o decisión · Kevin · 00:38:39 · Prioridad: Inmediato · Confianza: Alta · Fuentes: B-29 · Estado: Implementado en el prototipo*

> Actualización del 17/10: El combo se vende igual y se elige otro complemento de la misma categoría.

Ante la pregunta de José sobre si un combo se desactiva cuando se termina un insumo (por ejemplo, las donas), Kevin estipula la regla comercial: el combo NUNCA debe desactivarse si aún cuenta con otros complementos disponibles. El software debe mantener activo el combo y permitir que el cliente elija entre los complementos que aún tienen existencias (galletas, queques o empanadas).

#### ✔ Programación de vinculación obligatoria de productos e insumos en combos
*Pendiente del desarrollador · José · 01:12:00 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-39 · Estado: Implementado en el prototipo*

José asume el compromiso de programar una lógica de entrelazado entre los productos que componen un combo o promoción, garantizando que el sistema mantenga una relación ordenada entre los ítems seleccionados, sus variantes y la deducción correspondiente en cocina y almacén.

#### ☐ Filtros avanzados en módulo de compras por período temporal, categoría y sede
*Idea del desarrollador · José · 01:12:00 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-40 · Estado: Pendiente (no está en el prototipo)*

En el historial de compras de insumos e inventario, José añadirá filtros de búsqueda dinámicos que permitan consultar transacciones por rangos temporales específicos (1 día, 2 días, 1 semana, 1 año), por categoría de insumos y por ubicación o local de procedencia.

#### ✔ Replicación del flujo de almacén de Restaurant.pe (Entrada, Salida, Transferencia y Merma)
*Regla o decisión · Kevin · 01:12:00 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-41, D-01 · Estado: Implementado en el prototipo*

Kevin indica que actualmente no llevan control de almacén en el sistema. Sin embargo, decide adoptar exactamente la estructura de cuatro movimientos que ofrece Restaurant.pe: Entrada, Salida, Transferencia y Merma, debido a que es un esquema operativo estándar y comprobado en el rubro gastronómico.

- Ver también (D-01, 01:12:58): Kevin indica que en la actualidad no manejan ni usan el módulo de almacén en Caprichos. Solicita que el diseño y flujo del almacén en la nueva plataforma sea exactamente como el de restaurant.pe ("restaurant.p"), debido a que dicho flujo operativo ya está probado y funciona con éxito en el rubro gastronómico.

#### ✔ Protocolo operativo de producción matutina y descargo de insumos y stock diario
*Regla o decisión · Kevin · 01:12:58 · Prioridad: Inmediato · Confianza: Alta · Fuentes: C-42, D-02 · Estado: Implementado en el prototipo*

Kevin describe la rutina productiva del negocio: una colaboradora asiste por las mañanas exclusivamente a elaborar la producción del día (postres, panes pullman y gelatinas). En el nuevo sistema, ella retirará los insumos de almacén anotando lo utilizado, y al terminar su jornada matutina ingresará al sistema: 1) La salida formal de insumos consumidos; 2) La entrada a stock diario de los productos terminados disponibles para la venta.

- Ver también (D-02, 01:12:58): Por las mañanas acude una encargada de producción que elabora postres, pan pullman, gelatinas y otros productos. Ella toma los insumos directamente del almacén físico, anota lo utilizado y, al finalizar su jornada diaria, debe ingresar al sistema tanto el consumo de insumos (salidas de almacén) como el inventario de productos terminados preparados (entradas de stock diario).

#### ✔ Política y destino de mermas de productos perecibles
*Regla o decisión · Kevin · 01:15:21 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-04, D-17 · Estado: Implementado en el prototipo*

Los productos perecibles no vendidos al cierre del turno (especialmente donas) se clasifican formalmente como merma. Kevin explica que anteriormente se repartían entre todo el equipo de trabajo, pero actualmente todo se separa y él decide personalmente su destino. Aunque raras veces sobra producto, cuando quedan donas se regalan a familiares o conocidos; no se desechan a la basura porque Kevin no acostumbra botar comida.

- Ver también (D-17, 01:27:36): Los insumos que sobran al culminar el turno en las mesas refrigeradas de cocina se mantienen almacenados allí para la producción del día siguiente. No se procesa una devolución física al almacén general a menos que el producto se deteriore o eche a perder, en cuyo caso se registra formalmente como merma.

#### ✔ Eliminación del módulo de transferencias entre almacenes en fase inicial
*Aplazado, descartado o a futuro · José · 01:17:56 · Prioridad: Futuro · Confianza: Alta · Fuentes: D-08 · Estado: Implementado en el prototipo*

José aclara que la opción de transferencias fue copiada de otro sistema y confirma que la suprimirá de la versión inicial, dado que Caprichos cuenta con un solo local y un único almacén central. Kevin conviene en que dicha función solo se retomará a futuro si surge la necesidad de abrir sucursales o múltiples almacenes.

#### ✔ Vida útil de doce horas para donas y reseteo matutino de stock
*Regla o decisión · Kevin · 01:17:56 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-09, D-11 · Estado: Implementado en el prototipo*

El periodo de vida comercial de las donas para los estándares de Caprichos es de máximo 12 horas (un día de turno), ya que de un día para otro la textura cambia. Por consiguiente, cada mañana el stock registrado de donas debe comenzar en cero y cualquier sobrante debe ser computado como merma.

- Ver también (D-11, 01:19:01): José propone incorporar un campo editable en el sistema para que el administrador pueda parametrizar y modificar la vida útil de cada producto o insumo perecible (estableciendo uno o dos días, según corresponda), evitando que el stock se vacíe erróneamente de forma fija.

#### ☐ Conservación y prioridad de salida para filetes de pollo cocidos
*Regla o decisión · Kevin · 01:19:01 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-10 · Estado: Pendiente (no está en el prototipo)*

Cuando quedan filetes de pechuga de pollo cocidos al final del turno de noche que formaban parte del mise en place (por ejemplo, cuatro filetes), se refrigeran dentro de un táper de acero inoxidable. Al día siguiente, estos filetes refrigerados son los primeros que deben consumirse en la preparación de pedidos. Su tiempo de conservación máximo es de un día.

#### ✔ Descuento automatizado de insumos al vender productos preparados al momento
*Pedido del cliente · Kevin · 01:20:19 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-12 · Estado: Implementado en el prototipo*

Kevin requiere que al venderse un plato preparado al momento (como el Club Sándwich), el sistema descargue automáticamente del inventario cada insumo individual involucrado en su receta (filete de pollo, rebanadas de pan, queso, jamón, etc.). Explica que ingresar salidas manuales plato por plato es ineficiente y no automatiza la operación.

#### ☐ Estandarización de porciones y uso de filetes enteros de pechuga
*Problema actual · Kevin · 01:20:19 · Prioridad: Próximo · Confianza: Alta · Fuentes: D-13 · Estado: Pendiente (no está en el prototipo)*

A diferencia de la mayoría de establecimientos que preparan el Club Sándwich con pollo deshilachado, Caprichos utiliza filetes enteros de pechuga. Kevin señala como oportunidad de mejora que cuando un filete es muy pequeño en cocina agregan uno y medio, por lo que deben estandarizar el gramaje o tamaño unitario para asegurar la precisión del descuento de stock.

#### ◐ Receta estándar y dosificación de insumos del Club Sándwich
*Dato del negocio · Kevin · 01:22:47 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-14 · Estado: Parcial o simulado en el prototipo*

Kevin detalla los insumos que componen la receta del Club Sándwich: cuatro rebanadas de pan de molde pullman (de un molde horneado se dosifican las rebanadas, rindiendo aprox. siete sándwiches), un filete de pollo, dos rebanadas de jamón inglés, dos rebanadas de queso edam, tocino culinario, tomate y lechuga. La receta debe estar enlazada al producto para descontar insumos en tiempo real.

#### ✔ Diferenciación operativa entre productos por lote y productos bajo pedido
*Regla o decisión · Kevin · 01:25:31 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-15 · Estado: Implementado en el prototipo*

Se establece la diferencia funcional del flujo de inventario: para productos elaborados por lote (como donas), la encargada descarga insumos por la mañana y registra la entrada del lote terminado al stock, descontándose unidades terminadas en caja al vender; para sándwiches y salados preparados al instante, la cocina se abastece de insumos y la venta descuenta los insumos individuales según la receta.

#### ☐ Envío pendiente de plantilla Excel con recetas y costeo de Caprichos
*Pendiente del cliente · Kevin · 01:27:36 · Prioridad: Próximo · Confianza: Alta · Fuentes: D-18 · Estado: Pendiente (no está en el prototipo)*

Kevin explica que las recetas son fundamentales para calcular el costeo y la utilidad de cada producto de la carta. Manifiesta que cuenta con un archivo Excel con la información de recetas y costos, comprometiéndose a ordenarlo y completarlo para facilitárselo a José.

#### ✔ Aplazamiento de carga de recetas y trabajo con datos de prueba
*Pendiente del desarrollador · José · 01:28:50 · Prioridad: Próximo · Confianza: Alta · Fuentes: D-19 · Estado: Implementado en el prototipo*

José y Kevin acuerdan que la alimentación definitiva de las recetas en la base de datos se dejará como última etapa del desarrollo. Mientras Kevin consolida el Excel con la información real, José programará y probará los módulos de recetas y almacén utilizando datos simulados o ficticios.

#### ✔ Compra y control de pollo por unidades de filete de pechuga especial
*Dato del negocio · Kevin · 01:29:46 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-20 · Estado: Implementado en el prototipo*

Kevin aclara que Caprichos no adquiere pollos enteros ni piezas mixtas (piernas o entrepiernas), sino exclusivamente filetes de pechuga limpios y cortados ("pecho especial"). José confirma que la gestión de entradas y salidas en el sistema se controlará directamente por número de filetes unitarios.

#### ✔ Módulo visual de inventario con porcentajes e insumos de cafetería
*Idea del desarrollador · José · 01:28:50 · Prioridad: Próximo · Confianza: Alta · Fuentes: D-21 · Estado: Implementado en el prototipo*

José exhibe un módulo de stock en la maqueta donde se visualizan insumos habituales de cafetería (leche entera, leche sin lactosa, bebidas embotelladas, etc.) acompañados de un indicador porcentual del nivel disponible en inventario.

#### ✔ Filtros para stock bajo y stock alto con historial de movimientos
*Pedido del cliente · Kevin · 01:30:57 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-23 · Estado: Implementado en el prototipo*

Kevin solicita incorporar filtros rápidos para visualizar insumos en "stock bajo" y "stock alto", lo que facilitará la emisión oportuna de órdenes de compra. José añade que cada insumo mostrará su historial cronológico de entradas y salidas con fechas y cantidades.

#### · Logística de compras y centros de abastecimiento de Caprichos
*Dato del negocio · Kevin · 01:32:06 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-24 · Estado: Dato o decisión registrada (no requiere pantalla)*

Kevin describe su circuito de abastecimiento: acude personalmente al Mercado de Productores de Abarrotes, Productores de Verduras y al Mercado de Frutas de San Luis. En Makro adquiere sacos de azúcar y harina por conveniencia geográfica cuando su vehículo particular no puede cargar más peso (su capacidad límite es de seis a ocho sacos); en Makro paga 20 soles de delivery y una diferencia de aproximadamente 10 soles adicionales por saco respecto a productores. Descarta Candy por precios excesivos.

#### ✔ Catálogo de proveedores jerarquizado por insumo (A, B, C)
*Idea del cliente · Kevin · 01:32:06 · Prioridad: Próximo · Confianza: Alta · Fuentes: D-25 · Estado: Implementado en el prototipo*

Kevin solicita que el sistema permita registrar una terna de proveedores priorizada para cada insumo: Proveedor A (principal), Proveedor B (de contingencia) y Proveedor C, de modo que ante el desabastecimiento o fallo del proveedor habitual, el negocio pueda contactar inmediatamente a la siguiente alternativa.

#### ✔ Generación y envío de solicitudes de compra con un clic vía WhatsApp
*Pedido del cliente · Kevin · 01:32:06 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-26 · Estado: Implementado en el prototipo*

Kevin pide con gran interés implementar un botón que permita enviar directamente por WhatsApp la orden de compra a los proveedores para los insumos en stock bajo. La función debe abrir una plantilla de mensaje predefinido y editable indicando la cantidad y la fecha programada de entrega (por ejemplo: "Hola, por favor necesito para su próxima visita 100 cajas de leche Gloria entera"). Señala que esto ahorraría un tiempo invaluable.

#### ✔ Arquitectura del catálogo de pedidos centrada en el insumo
*Pedido del cliente · Kevin · 01:33:32 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-27 · Estado: Implementado en el prototipo*

Kevin subraya que la lista de pedidos de reposición debe estructurarse teniendo como eje central los insumos agotados y no los proveedores. Explica que un mismo proveedor distribuye productos diversos (como galletas Oreo, crema de leche, etc.), por lo que el sistema debe filtrar primero por insumo faltante y desde allí asociar el proveedor correspondiente.

#### ✔ Semáforo de stock con parámetros mínimo, intermedio y máximo
*Regla o decisión · Kevin · 01:35:13 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-28 · Estado: Implementado en el prototipo*

Se acuerda definir para cada insumo umbrales de stock mínimo, stock intermedio y stock máximo, activando un indicador semafórico visual: color verde cuando hay stock suficiente, naranja para stock regular o medio, y rojo para stock bajo crítico.

#### ◐ Alertas por correo electrónico ante insumos en stock crítico
*Idea del desarrollador · José · 01:35:13 · Prioridad: Próximo · Confianza: Alta · Fuentes: D-29 · Estado: Parcial o simulado en el prototipo*

José sugiere aprovechar la disponibilidad del dominio propio para configurar el envío automático de notificaciones de advertencia al correo de Kevin cuando un insumo crítico (como leche sin lactosa) alcance un nivel bajo. A Kevin le parece una funcionalidad muy útil y conveniente para no tener que revisar el sistema de forma permanente.

#### · Descarte de emisión de órdenes de compra mediante correo electrónico
*Aplazado, descartado o a futuro · Kevin · 01:35:13 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-30 · Estado: Dato o decisión registrada (no requiere pantalla)*

Kevin descarta el uso del correo electrónico para tramitar pedidos a proveedores. Aclara que en el funcionamiento real de Caprichos todas las órdenes de compra y coordinaciones de suministros se gestionan única y exclusivamente a través de WhatsApp.

## 8. Marketing, posventa y opiniones

#### ✔ Banner publicitario en Carta Web para campañas y promociones
*Idea del desarrollador · José · 00:12:35 · Prioridad: Próximo · Confianza: Alta · Fuentes: A-17 · Estado: Implementado en el prototipo*

José propone incorporar un banner publicitario destacado en la parte superior o en espacios libres de la carta web para comunicar promociones, campañas de temporada o lanzamientos especiales, aspecto que Kevin valida como altamente beneficioso para el negocio.

#### · Frecuencia de novedades del negocio: lanzamiento mensual de Caprichos del mes
*Dato del negocio · Kevin · 00:12:35 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-18 · Estado: Dato o decisión registrada (no requiere pantalla)*

Kevin explica que Caprichos mantiene una dinámica de marketing constante donde mensualmente introducen uno o dos productos o pedidos especiales nuevos denominados 'Caprichos del mes', los cuales requieren difusión mediante el banner o sección promocional.

#### ☐ Integración de promociones estacionales (campaña de Navidad) en el Chatbot
*Idea del desarrollador · José · 00:20:36 · Prioridad: Próximo · Confianza: Alta · Fuentes: A-36 · Estado: Pendiente (no está en el prototipo)*

José propone que el chatbot incorpore de manera dinámica ofertas y campañas especiales de temporada (como promociones navideñas), de modo que el asistente virtual las promocione activamente en las interacciones comerciales.

#### ✔ Personalización de etiquetas de vasos según festividades o fechas especiales
*Idea del desarrollador · José · 00:29:47 · Prioridad: Futuro · Confianza: Alta · Fuentes: B-20 · Estado: Implementado en el prototipo*

José sugiere complementar la propuesta de los stickers autoadhesivos para vasos de bebidas permitiendo que el diseño o contenido de la etiqueta se adapte automáticamente según el día festivo o fecha cívica especial (campañas de temporada). Kevin se muestra complacido con la idea.

#### ☐ Mapa de calor y radio de ventas para campañas de marketing offline
*Idea del desarrollador · José · 00:49:10 · Prioridad: Próximo · Confianza: Alta · Fuentes: C-07 · Estado: Pendiente (no está en el prototipo)*

Al visualizar en el panel una gráfica de radio de distribución de clientes frecuentes y ventas, José señala que dicha información geográfica es clave para planificar marketing directo fuera de línea: identificar los vecindarios o radios con mayor concentración de pedidos delivery para enviar personal a repartir volantes (flyers) y pegar afiches publicitarios. Kevin valida y aprueba el enfoque.

#### ✔ Incentivo y redirección a Google Maps para opiniones positivas analizadas por IA
*Idea del cliente · Kevin · 01:41:39 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-36 · Estado: Implementado en el prototipo*

Si el análisis de lenguaje natural del bot determina que la respuesta de posventa del cliente es positiva, el sistema le enviará automáticamente el enlace directo al perfil de Google Maps de Caprichos invitándolo a copiar su comentario a cambio de un beneficio (como un 25% de descuento en su siguiente pedido o participación en promociones), potenciando el posicionamiento orgánico y la reputación en Google Maps.

#### ◐ Envío automático de quejas y opiniones negativas al WhatsApp de gerencia
*Problema actual · Kevin · 01:44:37 · Prioridad: Inmediato · Confianza: Alta · Fuentes: D-38 · Estado: Parcial o simulado en el prototipo*

> Actualización del 17/10: Formulario de comentarios en la carta y avisos configurables (correo de Kevin; grupo de WhatsApp por definir). Falta el envío real.

Kevin expone que en el día a día las quejas suelen quedarse en el personal de caja, quienes frecuentemente no las transmiten al grupo interno por falta de tiempo o carga laboral. Pide que el sistema envíe en tiempo real cualquier comentario negativo o reclamo a su WhatsApp personal o a un grupo de WhatsApp de administración para realizar seguimiento inmediato y corregir posibles fallas en la preparación o el servicio.

## 9. Infraestructura, red y operación

#### ✔ Regla de negocio: operación exclusiva en local único
*Dato del negocio · José · 00:14:23 · Prioridad: Inmediato · Confianza: Alta · Fuentes: A-21 · Estado: Implementado en el prototipo*

Durante la revisión de interfaces se confirma que Caprichos cuenta con una sola sede o cafetería en funcionamiento, por lo que no es necesario implementar selectores complejos de locales o sucursales en la carta web.

#### ☐ Portal cautivo de Wi-Fi con credenciales temporales generadas por ticket
*Idea del cliente · Kevin · 00:27:49 · Prioridad: Futuro · Confianza: Alta · Fuentes: B-17 · Estado: Pendiente (no está en el prototipo)*

Kevin sugiere implementar a futuro un servidor de autenticación de red (portal cautivo) que asocie usuarios y contraseñas temporales al ticket de compra del cliente. Explica que esto evitaría que vecinos o personas ajenas al establecimiento obtengan la clave compartida y congestionen el ancho de banda del local.

#### ◐ Dependencia crítica de la red inalámbrica para dispositivos de operación
*Problema actual · Kevin · 00:28:46 · Prioridad: No se sabe · Confianza: Alta · Fuentes: B-18 · Estado: Parcial o simulado en el prototipo*

Kevin fundamenta por qué no resulta viable cambiar periódicamente la contraseña del Wi-Fi en el router: múltiples dispositivos operativos esenciales operan por Wi-Fi (tablets de mozos, tablet para el registro de asistencia/ingreso-salida del personal y una impresora fotográfica para eventos). Cambiar la clave inalámbrica implica reconfigurar manualmente equipo por equipo, generando paralizaciones operativas.

#### · Definición de los cinco requisitos no negociables de la plataforma
*Idea del desarrollador · José · 01:51:29 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-14 · Estado: Dato o decisión registrada (no requiere pantalla)*

José establece cinco condiciones operativas indispensables que la arquitectura tecnológica del sistema debe cumplir rigurosamente: 1) Disponibilidad permanente (alta disponibilidad), 2) Procesamiento de pedidos en tiempo real e instantáneo, 3) Integridad y seguridad de la información corporativa, 4) Impresión local fiable en el establecimiento, y 5) Costos fijos predecibles mes a mes sin variaciones imprevistas.

#### ✔ Adopción de VPS propio en la nube frente a esquemas serverless
*Idea del desarrollador · José · 01:51:29 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-15 · Estado: Implementado en el prototipo*

José analiza dos propuestas de infraestructura para alojar el sistema: la Opción A (un Servidor Privado Virtual / VPS propio alquilado) y la Opción B (plataforma serverless en Vercel). Descarta Vercel por imponer límites en su capa gratuita y generar costos variables irregulares en planes de pago. Defiende el VPS por ofrecer tarifa mensual fija, escalabilidad vertical, control total del código fuente y recursos garantizados (RAM, CPU, almacenamiento) que evitan saturaciones ante picos de demanda.

#### ✔ Selección formal de Contabo como proveedor de VPS
*Idea del desarrollador · José · 01:57:50 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-16 · Estado: Implementado en el prototipo*

José recomienda formalmente contratar la máquina virtual con el proveedor Contabo ("Contable"), destacando su paquete de prestaciones: 8 GB de memoria RAM, 4 vCPU, 100 GB de disco SSD, copias de seguridad automáticas (snapshots) y transferencia de datos ilimitada. Todo esto bajo una tarifa promocional por 24 meses de aproximadamente $5 a $6 mensuales (ajustándose a $8-$9 tras la promoción). Kevin aprueba la propuesta.

#### ✔ Vulnerabilidad operativa por cortes recurrentes de internet en horas punta
*Problema actual · Kevin · 01:55:42 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-17, E-18 · Estado: Implementado en el prototipo*

Kevin destaca que, aunque el servidor en la nube mantenga un 99% de operatividad, la vulnerabilidad real radica en el servicio de internet del establecimiento físico. Advierte que la conexión local suele colapsar durante días festivos, feriados y fechas de máxima concurrencia debido a la congestión de la red en la zona, dejando al restaurante desprotegido en sus momentos de mayor venta.

- Ver también (E-18, 01:56:41): Kevin relata la traumática experiencia vivida al usar software netamente web (como Hola Click): al cortarse el internet, el negocio quedaba a la deriva y debían recurrir a comandas manuales en papel. Esto provocaba descontrol administrativo absoluto, pérdida de métricas y auditoría de ventas, lentitud en la atención y una crisis generalizada en la que el personal operaba en "modo supervivencia".

#### ◐ Exigencia de continuidad operativa local sin conexión para sala, caja y cocina
*Pedido del cliente · Kevin · 01:54:38 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-19, E-20 · Estado: Parcial o simulado en el prototipo*

Kevin pregunta y exige como condición operativa indispensable que, si se interrumpe el acceso a internet, los mozos puedan continuar registrando comandas, la cajera continúe facturando y procesando cobros, y las pantallas de cocina mantengan la recepción de pedidos operando de forma 100% autónoma en la red local.

- Ver también (E-20, 01:55:42): José asimila el requerimiento planteado por Kevin basándose en el funcionamiento de restaurant.pe y propone estructurar una solución mediante una aplicación de escritorio o instancia local con cola de sincronización. De este modo, ante una desconexión, la operación se retiene localmente en cola sin interrumpir las ventas y, en cuanto se restablece el internet, los pedidos acumulados se transmiten de forma automática hacia el VPS en la nube.

#### ◐ Compromiso de estudiar la arquitectura de contingencia sin conexión
*Pendiente del desarrollador · José · 01:57:50 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-21 · Estado: Parcial o simulado en el prototipo*

José asume expresamente el compromiso técnico de evaluar a detalle la mejor alternativa arquitectónica (aplicación de escritorio, base de datos local y colas de sincronización) para garantizar la continuidad operativa ante caídas del servicio de internet.

#### · Antecedentes de desincronización y fallos de comanda en restaurant.pe
*Investigar o revisar · Kevin · 01:59:03 · Prioridad: Próximo · Confianza: Alta · Fuentes: E-22 · Estado: Dato o decisión registrada (no requiere pantalla)*

Kevin comparte que en restaurant.pe, pese a contar con aplicación de escritorio sincronizada periódicamente con el servidor central, en ocasiones ocurrían errores de sincronización o bloqueos por timeout que impedían que las órdenes llegaran a las comandas de producción. José toma nota del caso para diseñar un mecanismo de reconexión resiliente con reintentos controlados y preservación de la última copia local coherente.

#### · Descarte de software dependiente al 100% de conexión web
*Aplazado, descartado o a futuro · Kevin · 02:00:05 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-23 · Estado: Dato o decisión registrada (no requiere pantalla)*

Kevin y José ratifican que los sistemas de punto de venta que funcionan exclusivamente en la nube sin cliente local ni tolerancia a fallas de red (como Hola Click) quedan completamente descartados para el funcionamiento físico del local de Caprichos.

#### ☐ Adquisición prioritaria del dominio institucional caprichos.pe
*Pedido del cliente · Kevin · 02:00:05 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-24 · Estado: Pendiente (no está en el prototipo)*

José propone la compra del dominio `caprichos.pe` en Punto.pe (NIC Perú) por una inversión anual de 110 soles, explicando que servirá para consolidar la marca corporativa y habilitar el despacho de correos electrónicos transaccionales. Kevin da su aprobación inmediata y pide concretar la compra cuanto antes para reservarlo y evitar que terceros lo tomen.

#### · Rechazo a la compra del dominio comercial .com por especulación
*Aplazado, descartado o a futuro · Kevin · 02:01:07 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-25 · Estado: Dato o decisión registrada (no requiere pantalla)*

José informa que el dominio `caprichos.com` se encuentra en manos de un revendedor que exige precios desorbitados. Kevin rechaza de manera tajante entrar en negociaciones o pagar tarifas especulativas, argumentando que "Caprichos" es una denominación genérica y que la extensión territorial `.pe` satisface plenamente sus necesidades comerciales en Lima.

#### ☐ Registro de cuenta corporativa para gestión de dominios en Punto.pe
*Compromiso · José · 02:01:07 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-26 · Estado: Pendiente (no está en el prototipo)*

José explica que la adquisición del dominio en Punto.pe exige crear un perfil con correo electrónico y vincular tarjeta de pago. Kevin autoriza a José a crear el usuario en la plataforma con el correo corporativo del negocio, asignarle una contraseña temporal y luego proporcionársela a Kevin para que este formalice el pago con su tarjeta bancaria.

#### ☐ Entrega del correo institucional para administración del dominio
*Pendiente del cliente · Kevin · 02:02:34 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-27 · Estado: Pendiente (no está en el prototipo)*

Kevin se compromete y procede a entregar la dirección de correo electrónico corporativo empleada para las gestiones de la empresa (Caprichos Campoy / grupo) con el propósito de centralizar las compras de infraestructura y dominio web.

#### ☐ Visita técnica presencial al almacén del local para extracción de código y accesos
*Pendiente del desarrollador · José · 02:10:15 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-41, E-42 · Estado: Pendiente (no está en el prototipo)*

Dado que la plataforma del bot actual se ejecuta sobre una IP privada y no es posible descargar las credenciales de Meta ni los proyectos originales de Antigravity por la web, José y Kevin acuerdan una visita presencial de José al local de Caprichos. Kevin señala que la computadora principal se halla en el área de almacén y su acceso es inmediato.

- Ver también (E-42, 02:10:15): José establece sus horarios libres para la inspección presencial: trabaja de lunes a viernes hasta las 7:00 PM, por lo que puede concurrir al local entre semana a partir de las 7:00 PM, o en cualquier franja horaria los fines de semana (sábados y domingos por la mañana). Kevin valida que en las tardes el local presenta un ambiente despejado y propicio para trabajar.

#### ◐ Elaboración de propuesta integral y definición de pago inicial para el viernes
*Pendiente del desarrollador · José · 02:00:05 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-43 · Estado: Parcial o simulado en el prototipo*

José se compromete a consolidar todas las especificaciones tratadas en la sesión en una propuesta técnica y económica formal para presentarla en su próxima reunión programada para el viernes (17 de octubre). Kevin solicita que defina con claridad el monto del primer abono económico para formalizar el inicio del desarrollo.

#### ? Definición de la arquitectura técnica para contingencia sin conexión (offline)
*Duda abierta · Kevin · 01:54:38 · Prioridad: Inmediato · Confianza: Alta · Fuentes: E-45 · Estado: Duda abierta: falta decidir*

Queda abierta para resolución técnica de José la selección del mecanismo específico para garantizar la operatividad continua en contingencia (si se desarrollará una aplicación empaquetada de escritorio para Windows, una réplica de base de datos local SQLite/PostgreSQL o una cola de sincronización con Service Workers) que impida el retraso de comandas y pérdidas de datos ante caídas de internet.

---

# Vistas transversales (índices)

## Para investigar o revisar
| Elemento | Área | Prioridad sugerida |
| :-- | :-- | :-- |
| Referencia web de Starbucks para la configuración de bebidas personalizadas (A-19) | Carta web (cliente) | Inmediato |
| Referencia de sistema: Hola Click (experiencia de usuario y flujo de pedidos) (A-39) | Carta web (cliente) | Inmediato |
| Referencia de sistema: restaurant.pe (catálogo activo y deficiencias operativas) (A-40) | Carta web (cliente) | Inmediato |
| Referencia a catálogo de roles operativos en restaurant.pe (B-41) | Administrativo, roles y comprobantes | Próximo |
| Modelo de compra de Cineplanet (invitado sin puntos vs logueado con puntos) (C-21) | Clientes, puntos, créditos y descuentos | Próximo |
| Antecedentes de desincronización y fallos de comanda en restaurant.pe (E-22) | Infraestructura, red y operación | Próximo |
| Evaluación comparativa de modelos de lenguaje para el bot (ChatGPT, Gemini o alternativa asiática) (E-30) | Chatbot de WhatsApp | Próximo |
| Despliegue del bot actual en servidor privado sin nombre de dominio (E-34) | Chatbot de WhatsApp | Inmediato |

## Pendientes del cliente (Kevin se comprometió)
| Elemento | Área | Prioridad sugerida |
| :-- | :-- | :-- |
| Compromiso de envío de páginas web gastronómicas de referencia por parte del cliente (A-41) | Carta web (cliente) | Inmediato |
| Envío del enlace de Restaurant.pe sobre configuración de cupones y descuentos (C-31) | Clientes, puntos, créditos y descuentos | Inmediato |
| Envío de credenciales de acceso de Hola Click para auditar configuraciones y flujos (C-34) | Carta web (cliente) | Inmediato |
| Envío pendiente de plantilla Excel con recetas y costeo de Caprichos (D-18) | Almacén, stock, recetas y compras | Próximo |
| Entrega del correo institucional para administración del dominio (E-27) | Infraestructura, red y operación | Inmediato |
| Compromiso de transferencia de prompts y reglas de contexto del bot (E-33) | Chatbot de WhatsApp | Próximo |

## Pendientes del desarrollador (José se comprometió)
| Elemento | Área | Prioridad sugerida |
| :-- | :-- | :-- |
| Integración de IA en WhatsApp para resolver dudas abiertas y dar recomendaciones (A-29) | Chatbot de WhatsApp | Inmediato |
| Compromiso del desarrollador: extraer catálogo completo de restaurant.pe y replicar flujo de Hola Click (A-42) | Carta web (cliente) | Inmediato |
| Compromiso del desarrollador: corregir visualización de imágenes cortadas en el prototipo (A-43) | Carta web (cliente) | Inmediato |
| Compromiso de desarrollo de dashboards a medida (B-07) | Administrativo, roles y comprobantes | Próximo |
| Revisión técnica de la plataforma y experiencia de usuario en Hola Click (C-35) | Administrativo, roles y comprobantes | Próximo |
| Programación de vinculación obligatoria de productos e insumos en combos (C-39) | Almacén, stock, recetas y compras | Próximo |
| Aplazamiento de carga de recetas y trabajo con datos de prueba (D-19) | Almacén, stock, recetas y compras | Próximo |
| Compromiso de estudiar la arquitectura de contingencia sin conexión (E-21) | Infraestructura, red y operación | Inmediato |
| Registro de cuenta corporativa para gestión de dominios en Punto.pe (E-26) | Infraestructura, red y operación | Inmediato |
| Incorporación obligatoria de captura de ubicación GPS en la solución web (E-40) | Carta web (cliente) | Inmediato |
| Visita técnica presencial al almacén del local para extracción de código y accesos (E-41) | Infraestructura, red y operación | Inmediato |
| Elaboración de propuesta integral y definición de pago inicial para el viernes (E-43) | Infraestructura, red y operación | Inmediato |

## Aplazado, descartado o a futuro
| Elemento | Área | Prioridad sugerida |
| :-- | :-- | :-- |
| Descarte temporal de televisores Smart TV en cocina en favor de computadoras (B-42) | Cocina, pantallas e impresión | Futuro |
| Descarte de tótems de autoservicio (Self Service) por dimensiones del local (C-06) | Administrativo, roles y comprobantes | Futuro |
| Descarte de reserva con selección previa de platos desde la página web (C-13) | Mesas, pedidos en sala y reservas | Inmediato |
| Aplazamiento de niveles y categorías de puntos (Platino, Súper Capricho) (C-25) | Clientes, puntos, créditos y descuentos | Futuro |
| Eliminación del módulo de transferencias entre almacenes en fase inicial (D-08) | Almacén, stock, recetas y compras | Futuro |
| Descarte de emisión de órdenes de compra mediante correo electrónico (D-30) | Almacén, stock, recetas y compras | Inmediato |
| Descarte de filtros complejos y rangos de precio en la carta de comida (D-32) | Carta web (cliente) | Inmediato |
| Descarte de valoraciones y reseñas públicas en la carta virtual (D-34) | Carta web (cliente) | Inmediato |
| Depuración de secciones innecesarias heredadas de restaurant.pe (E-05) | Administrativo, roles y comprobantes | Inmediato |
| Omisión de módulo tributario y Kardex contable para SUNAT (E-08) | Administrativo, roles y comprobantes | Futuro |
| Postergación de facturación electrónica directa con SUNAT (E-10) | Administrativo, roles y comprobantes | Futuro |
| Descarte de software dependiente al 100% de conexión web (E-23) | Infraestructura, red y operación | Inmediato |
| Rechazo a la compra del dominio comercial .com por especulación (E-25) | Infraestructura, red y operación | Inmediato |

## Dudas abiertas
| Elemento | Área | Prioridad sugerida |
| :-- | :-- | :-- |
| Mecanismo de detección y visualización de mesas ocupadas vs libres (B-10) | Mesas, pedidos en sala y reservas | Próximo |
| Definición de parámetros y condiciones de cupones para Caprichos (C-30) | Clientes, puntos, créditos y descuentos | No se sabe |
| Identificación del modelo y protocolo de las impresoras térmicas de producción (E-44) | Cocina, pantallas e impresión | Próximo |
| Definición de la arquitectura técnica para contingencia sin conexión (offline) (E-45) | Infraestructura, red y operación | Inmediato |

## Problemas actuales que hay que evitar repetir
| Elemento | Área | Prioridad sugerida |
| :-- | :-- | :-- |
| Falla detectada en bot actual: omisión de cobro de delivery por la IA (A-31) | Chatbot de WhatsApp | Inmediato |
| Problema en bot actual: desorientación y consumo excesivo de tokens ante errores tipográficos (A-32) | Chatbot de WhatsApp | Inmediato |
| Conflicto operativo por liberación prematura de mesa en cobro anticipado (B-11) | Mesas, pedidos en sala y reservas | Inmediato |
| Dependencia crítica de la red inalámbrica para dispositivos de operación (B-18) | Infraestructura, red y operación | No se sabe |
| Inestabilidad de app de escritorio de restaurant.pe y migración a KDS web en red local (B-22) | Cocina, pantallas e impresión | Inmediato |
| Incapacidad de restaurant.pe para segmentar ítems de combos en pantallas de cocina (B-25) | Cocina, pantallas e impresión | Inmediato |
| Revisión en vivo de comandas reales en pantalla de cocina de restaurant.pe (B-31) | Cocina, pantallas e impresión | Inmediato |
| Deficiencia operativa del módulo de Call Center en restaurant.pe (B-34) | Administrativo, roles y comprobantes | Próximo |
| Falla de georreferenciación en restaurant.pe vs soporte de Google Plus Codes (B-37) | Administrativo, roles y comprobantes | Inmediato |
| Fragmentación y desorden en interfaces de delivery de Restaurant.pe (C-08) | Administrativo, roles y comprobantes | Próximo |
| Conflicto de pedidos concurrentes en la misma mesa y artificio de 30 mesas (C-09) | Mesas, pedidos en sala y reservas | Inmediato |
| Estandarización de porciones y uso de filetes enteros de pechuga (D-13) | Almacén, stock, recetas y compras | Próximo |
| Envío automático de quejas y opiniones negativas al WhatsApp de gerencia (D-38) | Marketing, posventa y opiniones | Inmediato |
| Vulnerabilidad operativa por cortes recurrentes de internet en horas punta (E-17) | Infraestructura, red y operación | Inmediato |
| Consumo descontrolado de saldo API tras migración a GPT-4o (E-32) | Chatbot de WhatsApp | Inmediato |

## Ruido descartado

- Fuga de gas refrigerante de una mesa durante la limpieza (A-38) y las pausas de la reunión por asuntos del local.
- Conversaciones laterales de fondo y saludos; ver el detalle de cada agente en la evidencia.

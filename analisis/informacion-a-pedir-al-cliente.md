---
id: ANA-CAP-034
tipo: analisis
titulo: "Información que hay que pedirle al cliente (Kevin) para cargarla al sistema"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-19
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, analisis]
---

# Información que hay que pedirle al cliente (Kevin) para cargarla al sistema

**Fecha:** 19/10/2026 · **Para:** José Ángel Espinoza (desarrollo) · **Cliente:** Kevin Rosales, Caprichos

Este documento sale de revisar el mockup publicado (versión 201): qué datos son todavía **de ejemplo** o **están vacíos**, y cuáles son **decisiones que solo el dueño puede tomar**. Cada bloque dice **qué pedir**, **en qué formato**, **para qué sirve** y **dónde se carga** en el sistema.

Prioridad: **A** = sin esto no se puede poner en uso · **B** = hace falta para que los números sean reales · **C** = mejora la experiencia, se puede después.

---

## Resumen de una página

| # | Qué pedir | Prio. | Hoy en el mockup |
|---|---|---|---|
| 1 | Recetas por producto | A | 3 recetas de ejemplo y reglas de consumo aproximadas |
| 2 | Lista real de insumos, costos y stock inicial | A | 21 insumos de ejemplo, **sin costos** |
| 3 | Producción: tandas, rendimientos y vida útil | A | 4 tandas de ejemplo (donas 30, galletas 40, pan 2, gelatina 24) |
| 4 | Proveedores | A | 7 de ejemplo, sin RUC ni condiciones |
| 5 | Carta validada (precios, tamaños, opciones, alérgenos) | A | 64 productos copiados de la web anterior |
| 6 | Fotos de productos | B | 62 de 64 tienen foto; faltan **Papas nativas** y **Entremets y tartaleta** |
| 7 | Fotos del local, equipo y marca | B | Destacadas vacías (5 círculos sin fotos); sin logo propio cargado |
| 8 | Datos del negocio y legales | A | RUC, razón social y textos legales vacíos o de ejemplo |
| 9 | Pagos | A | Yape, Plin y cuenta con «XXX (ejemplo)» |
| 10 | Delivery: zonas, tarifas, repartidores | A | Zonas y tarifas de ejemplo |
| 11 | Personal y accesos | A | «Persona de ejemplo 1…10» |
| 12 | Salón: plano real, reservas, equipos | B | Plano por defecto, sin el diseño real |
| 13 | WhatsApp y bot | A | Acceso a la cuenta sin confirmar |
| 14 | Promociones, cupones y puntos | B | Reglas de ejemplo |
| 15 | Caja y finanzas | B | Apertura en cero, medios de pago supuestos |
| 16 | Historial de ventas y clientes | C | Datos de ejemplo |
| 17 | Decisiones pendientes del dueño | A | 10 puntos abiertos (al final) |

---

## 1. Recetas (lo más importante para el stock y el costo)

**Por qué:** cada venta descuenta insumos y el sistema calcula costo y margen. Hoy solo hay 3 recetas de ejemplo (Frappe Oreo 16 oz, Capuccino 12 oz, Club Sandwich) y reglas automáticas por palabra del nombre (por ejemplo, «todo FRAPPE usa 0,25 L de leche»), que son aproximadas.

**Qué pedir, por cada producto y por cada tamaño o presentación:**
- Ingredientes y **cantidad por porción** (en la unidad con la que los usan: g, ml, unidades, lonjas).
- Qué cambia según la **leche** (entera, sin lactosa, almendra), el **endulzante**, los **shots** y los **adicionales** (chantilly, helado, syrops).
- **Mermas normales** (lo que se pierde al preparar).
- **Tiempo de preparación** (para los tiempos de la pantalla de cocina) y a qué **área** va (cocina, barra, ambas).
- Si el producto se **hace por tanda** (donas, galletas) o **al momento**.

**Formato:** una hoja de Excel o una foto del cuaderno de recetas, con columnas `Producto | Tamaño | Insumo | Cantidad | Unidad`. Empezar por los 15 productos que más se venden.

**Se carga en:** Stock y recetas ▸ Recetas, y «Editar qué descuenta cada producto».

## 2. Insumos: lista real, costos y stock inicial

**Qué pedir:**
- Lista completa de insumos, con **unidad de compra** (caja de 24, saco de 25 kg, bandeja de 10) y **unidad de uso** (kg, L, unidades) y su equivalencia.
- **Costo** por unidad de compra (con IGV o sin IGV; decir cuál). Hoy el sistema no tiene costos, por eso el margen no es real.
- **Stock inicial**: un conteo físico el día de arranque, separado por **almacén** y por **cocina/barra**.
- **Mínimo, medio y máximo** deseados por insumo, y a qué área pertenece cada uno.
- **Vida útil** de lo perecible (hoy solo se supone 12 horas para las donas).
- Empaques y descartables: vasos, tapas, bolsas, servilletas (hoy no se descuentan).

**Se carga en:** Stock y recetas ▸ Insumos («+ Nuevo insumo» y «Ficha y unidades»), y Almacén ▸ Entradas (stock inicial).

## 3. Producción de cada día

**Qué pedir:** para donas, galletas, pan pullman (que usa el mockup como «Pan de molde») y gelatina mosaico, y cualquier otra cosa que preparen por tanda:
- **Ingredientes por tanda** y **cuántas unidades salen** (rendimiento real, no teórico).
- Cuántas tandas hacen al día y a qué hora.
- Qué hacen con lo que **sobra** (donación, personal, merma) y desde qué hora ya no se vende.
- Quién la registra (encargada de producción).

**Se carga en:** Stock y recetas ▸ Producción y almacén ▸ Producir. Hoy las cantidades son de ejemplo.

## 4. Proveedores

**Qué pedir, por proveedor:** razón social, **RUC**, nombre del contacto, **WhatsApp**, qué insumos entrega, **días y horario de reparto**, **pedido mínimo**, **forma de pago** (contado o crédito y a cuántos días) y si entrega a domicilio. Además: ¿qué insumo se compra a un solo proveedor y cuál puede cambiar de proveedor?

**Se carga en:** Compras ▸ Proveedores. Hoy hay 7 de ejemplo sin RUC.

## 5. La carta, validada

**Qué pedir:** que Kevin **revise la carta completa** (64 productos hoy) y confirme:
- Nombres, descripciones y **precios** vigentes; tamaños y precio de cada uno.
- Opciones y **adicionales con su precio** (leche, endulzante, shots, extras, cremas, acompañamientos).
- **Alérgenos** y datos útiles (sin lactosa, contiene frutos secos, cacao…).
- Qué productos se venden **solo ciertos días u horas** (Domingos de waffles, Happy hour) y qué productos **se agotan** durante el día.
- Combos vigentes y qué lleva cada uno.
- Qué categorías o productos **se quitan** y cuáles faltan.

**Se carga en:** Productos, Listas y categorías, Ofertas y descuentos.

## 6. Fotos de productos

**Estado:** 62 de 64 productos ya tienen foto (tomadas de la web anterior). Faltan **Papas nativas** y **Entremets y tartaleta**.

**Qué pedir:**
- Una foto por producto y, si es posible, una por **tamaño** o variante (frappe de 12, 16 y 21 oz).
- **Formato:** horizontal 4:3 o cuadrada, luz natural, fondo limpio y parejo, producto centrado, **mínimo 1200 píxeles** de ancho, sin filtros ni textos encima.
- Fotos de los **combos** y de las **opciones** que cambian el aspecto (con chantilly, con helado).
- Revisar si las fotos actuales son de Caprichos o son de la web anterior (derechos de uso).

**Se carga en:** Productos ▸ foto de cada producto. Entregar en una carpeta con el **nombre del producto** como nombre del archivo.

## 7. Fotos del local, del equipo y de la marca

**Qué pedir:**
- **Logo** en el mejor formato que tengan (vector o PNG con fondo transparente) y versión clara y oscura; colores y tipografía de la marca si existen.
- **Fachada** (de día y de noche), **interior por ambientes**, barra, vitrina de postres, zona de mesas, segundo piso. Horizontales.
- **Equipo** (con permiso por escrito de cada persona) y **clientes** en el local (con permiso).
- **Eventos** (Navidad, aniversario, chocolatada) y **detrás de cámaras** (preparando un frappe).
- 5 a 8 fotos por cada círculo de «Momentos Caprichos»: Clientes felices, Nuestro local, Nuestro equipo, Eventos, Detrás de cámaras.
- Banners para Novedades: horizontales 16:9, con espacio libre para el texto.
- Si tienen, **videos cortos** (TikTok o Instagram) y los enlaces a las redes.

**Se carga en:** Destacadas de la carta, Novedades y publicidad, Configuración del local ▸ Logo, Diseño de la carta (promociones).

## 8. Datos del negocio y legales

**Qué pedir:**
- **Razón social, RUC, dirección fiscal**, régimen tributario y representante legal.
- **Boleta y factura electrónica:** si ya usan un facturador (nombre, series de boleta y factura, usuario SOL, certificado digital) o si hay que contratar uno. Hoy el mockup solo recoge los datos del cliente.
- **Libro de Reclamaciones:** texto, plazo y cómo se atiende. Requiere revisión legal.
- **Términos y condiciones** y **política de privacidad** reales (hoy son texto de ejemplo; aplica la Ley 29733 de datos personales).
- **Dirección exacta y referencia** de la tienda, y su **ubicación** (se puede marcar desde Configuración del local ▸ Ubicación estando en el local).
- **Horario por día** y **fechas especiales** (feriados, Navidad). Hoy se supone 14:00 a 22:00.
- Teléfono que se muestra, **WhatsApp oficial**, correo del dueño para alertas, Instagram, Facebook y TikTok.
- «Conócenos»: la historia en 3 o 4 líneas y el lema.

**Se carga en:** Configuración del local (todas las secciones).

## 9. Pagos

**Qué pedir:** número de **Yape** y de **Plin** (y a nombre de quién), **cuenta bancaria o CCI** para transferencias, si aceptan **tarjeta** y con qué POS (proveedor, comisión), y la política de **vuelto** y de **propinas**. Hoy los números dicen «9XX XXX XXX (ejemplo)».

**Se carga en:** Configuración del local ▸ Pagos.

## 10. Delivery

**Qué pedir:**
- Mapa o lista de **zonas que atienden** (hoy hay 5 zonas de ejemplo) y la **tarifa de cada una**.
- **Pedido mínimo** (hoy S/ 14.50 de la web anterior) y **envío gratis** (hoy desde S/ 70).
- **Tiempo prometido** al cliente y horario de reparto.
- **Repartidores:** cuántos, si son propios o de un servicio, cómo se les paga y si cobran en efectivo al entregar.
- Qué hacen si el cliente no recibe el pedido (esperar, reprogramar, devolver) y el recargo por reprogramar.

**Se carga en:** Configuración del local ▸ Entrega y Entregas fallidas; Mapa de entregas.

## 11. Personal y accesos

**Qué pedir:** lista de quienes usarán el sistema: **nombre, cargo, turno** y qué hace cada uno (administrador, cajero, mozo, cocina, barra, almacén, producción, call center, repartidor). Quién será el **administrador principal** y quién lo reemplaza.

También: el **descuento del personal** (hoy 25 % sobre el pedido, sin combos ni promociones) y quiénes lo tienen. Cada persona recibe su usuario y su clave inicial en persona y la cambia en su primer ingreso.

**Se carga en:** Usuarios ▸ Personal (hoy aparecen «Persona de ejemplo 1 a 10»).

## 12. El salón y los equipos

**Qué pedir:**
- **El plano real:** pisos, mesas con su numeración y asientos, barra, cocina, caja, baños, escalera. Se puede copiar desde Plano del local ▸ «Ver / copiar el diseño» ▸ «Copiar». Está **pendiente** de recibir (ver `plano-del-local.md`).
- Si usan el **segundo piso**, desde cuándo y en qué horario.
- **Reservas:** cuántas al mes, a qué hora, tolerancia (hoy 15 minutos), si cobran adelanto.
- **Equipos:** cuántas cajas, **marca y modelo de las impresoras** (cocina, barra, caja; ancho de papel 58 u 80 mm), si hay tablet para mozos, la mini PC y el televisor de cocina, y cómo es el internet del local (plan, velocidad, si hay respaldo).

## 13. WhatsApp y el bot

**Qué pedir:** acceso a la **cuenta de Meta Business / API de WhatsApp** y al número exclusivo, quién la administra, las **plantillas** de mensaje aprobadas, el **tono** con el que quieren hablar, las **preguntas frecuentes reales** de los clientes y sus respuestas, el horario en que atiende una persona y a quién se avisa cuando algo falla. También confirmar quién asume el costo de las plantillas que cobra Meta.

**Importante de seguridad:** cambiar las contraseñas de prueba y rotar las llaves del bot que se compartieron durante el desarrollo.

## 14. Promociones, cupones y puntos

**Qué pedir:** lista de las promociones y descuentos **que tienen hoy** (2x1 de los martes, Domingos de waffles, Happy hour, combos) con días, horas, productos y si se acumulan; si quieren **cupones** (para qué campañas, valor, vigencia); cómo funcionan los **puntos** (hoy 1 por cada S/ 1) y **qué se canjea** y a cuánto; descuento de **cumpleaños** y calendario de campañas del año.

**Se carga en:** Ofertas y descuentos.

## 15. Caja y finanzas

**Qué pedir:** con cuánto **abren la caja** (hoy en cero) y en qué billetes y monedas, **a qué hora cierran**, quién hace el arqueo, qué gastos pagan con la caja (egresos típicos), qué medios de pago reciben y cuál es «Otros», y qué diferencia toleran antes de revisar.

**Se carga en:** Caja ▸ apertura y cierre.

## 16. Historial (opcional)

**Qué pedir:** si tienen ventas pasadas en Excel o cuaderno (últimos 3 a 6 meses), una **lista de clientes frecuentes** (solo con su consentimiento) y los **reclamos** más comunes. Sirve para los informes, para calibrar mínimos de stock y para saber qué productos se venden más. No es necesario para arrancar.

## 17. Decisiones que solo puede tomar Kevin

| # | Decisión | Opciones conocidas |
|---|---|---|
| 1 | Tiempo de entrega prometido | 13 minutos (propuesta) o 30 a 45 (bot actual) |
| 2 | Envío gratis | «más de S/ 70» (como hoy) o «desde S/ 70» |
| 3 | Pedido mínimo y tarifas de delivery | ¿S/ 14.50 sigue vigente? |
| 4 | Horario de atención | ¿14:00 a 22:00 todos los días? |
| 5 | Plazo para atender un pedido «por confirmar» | minutos antes de avisar o anular |
| 6 | Libro de Reclamaciones | texto y plazo (con revisión legal) |
| 7 | Boleta y factura electrónica | facturador, series, certificado |
| 8 | Costo de las plantillas de WhatsApp | quién lo asume |
| 9 | Si un trabajador, entrando a la carta con su usuario, puede **cargar el pedido a su consumo del mes** | hoy el crédito del personal solo se usa en Pedidos y caja |
| 10 | Una promoción con tipo (donas, galletas) ¿se puede mezclar con descuentos? | hoy se aplica solo el mayor si «Acumula» está en No |

---

## Cómo pedirlo para que lo entregue

1. **No mandar todo junto.** Pedirlo en 3 tandas: (1) lo que bloquea (recetas, insumos, proveedores, personal, pagos, datos legales), (2) fotos y delivery, (3) promociones e historial.
2. **Plantillas.** Mandar un Excel con las hojas `Recetas`, `Insumos`, `Proveedores`, `Personal` y `Productos` (columnas ya puestas). Es más fácil para Kevin completar una hoja que contestar mensajes sueltos.
3. **Fotos.** Pedir una carpeta compartida (Drive) con subcarpetas `Productos`, `Local`, `Equipo`, `Eventos`, `Logo` y los archivos con el nombre del producto.
4. **Quién responde qué.** Marcar qué puede contestar Kevin, qué la encargada de producción (recetas y tandas), qué el almacenero (insumos y proveedores) y qué el contador (datos legales y facturación).
5. **Ejemplos reales.** Si Kevin duda de un dato, dejar el de ejemplo y marcarlo «por confirmar»; el mockup ya lo dice así en varias partes.

### Mensaje corto para enviarle

> Hola Kevin, para dejar el sistema listo con los datos reales necesito, en este orden: **(1)** las recetas de tus 15 productos más vendidos con las cantidades, **(2)** la lista de insumos con su costo y el stock que tienes hoy, **(3)** tus proveedores con RUC y WhatsApp, **(4)** los datos de tu negocio (razón social, RUC, horario, Yape, Plin y cuenta), y **(5)** quiénes van a usar el sistema y con qué cargo. Después te pido las fotos del local y del equipo. Te mando una hoja de Excel para que solo la completes. ¿Cuándo podemos revisarlo juntos?

---

## Lo que ya tenemos (no volver a pedir)

- La carta de 64 productos con precios, tamaños y opciones, tomada de la web anterior (solo falta validarla).
- Fotos de 62 productos.
- Reglas del negocio acordadas en las actas: crédito del personal, descuentos y promociones, cupones, devoluciones y entregas fallidas, un insumo se pide a un solo proveedor por pedido.
- El plano por defecto (`plano-del-local.md`).

*Documento de trabajo: se actualiza a medida que el cliente va entregando cada bloque.*

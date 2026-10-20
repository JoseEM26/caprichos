---
id: ANA-CAP-051
tipo: analisis
titulo: "Informe de Coordinacion entre el Sistema Administrativo (Admin.dc.html) y la Carta Virtual (Main.dc.html)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, revision-cruzada-informes]
---

# Informe de Coordinacion entre el Sistema Administrativo (Admin.dc.html) y la Carta Virtual (Main.dc.html)

## 1. Resumen Ejecutivo

El presente informe evalua el grado de coordinacion, homogenizacion y persistencia de datos entre el sistema administrativo (`Admin.dc.html`) y la carta virtual de cara al cliente (`Main.dc.html`) del proyecto Caprichos. Ambos modulos interactuan primordialmente a traves del almacenamiento local (`localStorage`) mediante la clave compartida `caprichos_carta_cfg_v1`, complementada con `caprichos_comments_v1` para el buzon de mensajes.

Del analisis exhaustivo del codigo fuente se desprende que, si bien existe una infraestructura compartida para datos del local, decoraciones, banners, novedades y promociones tipo combo, subsisten desconexiones criticas de arquitectura:
1. Desconexion completa en el flujo transaccional: los pedidos emitidos por la carta virtual (`placeOrder`) no se registran en `localStorage` ni ingresan a la cola de pedidos de `Admin.dc.html`. Viven exclusivamente en el estado volatil del componente cliente.
2. Contradicciones y limitaciones en la edicion de precios: `Admin.dc.html` dispone de tres vias independientes de mutacion de precios (`pover`, `texts` en el disenador, y `sizes` en opciones y tamanos), mientras que `Main.dc.html` aplica `pover` unicamente a productos de variante unica, descartando silenciosamente cambios de precio para bebidas y productos multivariante.
3. Desfase en reglas de promocion: las ofertas configuradas en el administrador como "Llevas mas, pagas menos" (2x1, 3x2) o descuentos sin ranuras (`slots`) no son interpretadas por el motor de descuentos de la carta virtual.
4. Fechas y datos operativos congelados: la carta virtual valida los cupones contra una constante fija (`TODAY = '2026-10-15'`), el tiempo base de delivery se encuentra fijado en 13 minutos, y los "Mas comprados del mes" se encuentran cableados en codigo para el mes de octubre.
5. Vacio regulatorio e inconsistencia legal: no existe Libro de Reclamaciones segun la normativa de INDECOPI en Peru, los datos fiscales de empresa configurados en el administrador se ocultan deliberadamente al consumidor, y no se permite solicitar boleta o factura con RUC en la carta web.

---

## 2. Tabla Maestra de Configuracion en el Administrativo y su Reflejo en la Carta Virtual

En esta tabla se detalla cada seccion y campo que el administrativo permite configurar o cambiar mediante la clave compartida (`caprichos_carta_cfg_v1`), contrastando si `Main.dc.html` lee la configuracion y la refleja en la interfaz, o si mantiene el valor fijo en su codigo.

| Modulo / Campo en Administrativo | Clave / Estructura en caprichos_carta_cfg_v1 | Se Lee en Main.dc.html? | Como se Refleja o Donde Queda Fijo en Main.dc.html | Evaluacion de Coordinacion |
| :--- | :--- | :--- | :--- | :--- |
| **Configuracion del local: Datos** | | | | |
| Nombre del local | `info.nombre` | Si | `INFO.nombre`. Se usa en cabecera, pie y titulos de marca. Por defecto 'Caprichos'. | Coordinado. |
| Lema | `info.lema` | Si | `INFO.lema`. Se muestra en la cabecera junto al barrio y horario, y en la seccion Conocenos. | Coordinado. |
| Distrito (Zona) | `info.zona` | Si | `INFO.zona`. Se usa en el titulo de Conocenos (`INFO.lema + ' en ' + INFO.zona`). | Coordinado. |
| Barrio | `info.barrio` | Si | `INFO.barrio`. Se refleja en la linea superior de la cabecera (`headerLine`). | Coordinado. |
| Descripcion del local | `info.descripcion` | Si | `INFO.descripcion`. Se muestra en el bloque descriptivo de Conocenos (`aboutDesc`). | Coordinado. |
| **Configuracion del local: Ubicacion** | | | | |
| Direccion fisica | `info.direccion` | Si | `INFO.direccion`. Se muestra en Conocenos y en la pastilla de informacion del pie (`infoTiles`). | Coordinado. |
| Referencia de llegada | `info.referencia` | Si | `INFO.referencia`. Se refleja en Conocenos (`aboutRef`). | Coordinado. |
| Enlace de Google Maps | `info.mapa` | Si | `INFO.mapa`. Se utiliza como vinculo directo en el boton "Ver mapa" de Conocenos. | Coordinado. |
| **Configuracion del local: Contacto** | | | | |
| Telefono visible | `info.telefono` | Si | `INFO.telefono`. Se refleja en el texto de contacto de Conocenos (`aboutPhone`). | Coordinado. |
| WhatsApp del negocio | `info.whatsapp` | Si | `INFO.whatsapp`. Genera enlace dinamico `https://wa.me/...` en botones de ayuda y Conocenos. | Coordinado. |
| **Configuracion del local: Horarios** | | | | |
| Horario semanal (Lun-Dom: abre, cierra, activo) | `info.horario.dias` | Si | Funcion `horarioOf(INFO)` calcula apertura, cierre y badge en tiempo real (`statusNow`). | Coordinado en visualizacion; no bloquea pedidos si cerrado. |
| Fechas especiales (feriados con horario alterno o cierre) | `info.horario.especiales` | Si | Lista de fechas especiales que sobreescriben el dia ordinario en `hoursRows` y cabecera. | Coordinado en visualizacion. |
| **Configuracion del local: Redes Sociales** | | | | |
| Instagram enlace y nombre visible | `info.instagram`, `info.instagramNombre` | Si | Lista de enlaces en el pie (`socials`). Si no hay URL, no se muestra. | Coordinado. |
| Facebook enlace | `info.facebook` | Si | Enlace de Facebook en el pie (`socials`). | Coordinado. |
| TikTok enlace | `info.tiktok` | Si | Enlace de TikTok en el pie (`socials`). | Coordinado. |
| **Configuracion del local: Pagos** | | | | |
| Numero de Yape | `info.yape` | Si | `payInfo().yape.v`. Se muestra en modal de datos y pago al seleccionar Yape. | Coordinado para el dato; lista de medios fija. |
| Numero de Plin | `info.plin` | Si | `payInfo().plin.v`. Se muestra en modal al seleccionar Plin. | Coordinado para el dato; lista de medios fija. |
| Cuenta bancaria para transferencias | `info.cuenta` | Si | `payInfo().transf.v`. Se muestra al seleccionar Transferencia bancaria. | Coordinado para el dato; lista de medios fija. |
| **Configuracion del local: Entrega y Tarifas** | | | | |
| Envio gratis desde monto minimo | `info.envioGratis` | Si | `Number(INFO.envioGratis)`. Carrito exonera tarifa de flete al superar dicho valor. | Coordinado. |
| Pedido minimo de delivery | `info.pedidoMin` | Si | `Number(INFO.pedidoMin)`. Valida en carrito (`belowMin`) e impide pasar al pago. | Coordinado. |
| Tarifas de delivery por zona (Z2, Z3, Z4, Z5, Z7) | `info.tarZ2`, `info.tarZ3`, `info.tarZ4`, `info.tarZ5`, `info.tarZ7` | Si | `shipsOf()`. Asigna el costo de envio por zona geografica detectada o seleccionada. | Coordinado para montos; zonas geograficas fijas. |
| PIN de anulacion del administrador | `info.pinAnular` | No | Exclusivo del administrativo para autorizar cancelaciones. No aplica a la carta. | N/A (Uso interno). |
| **Configuracion del local: Avisos y Alertas** | | | | |
| Correo del dueno para quejas | `info.correoDueno` | No | Main guarda quejas en `caprichos_comments_v1` en localStorage. No envia correos ni notifica. | Hueco de integracion. |
| Grupo de WhatsApp del equipo | `info.grupoWhatsapp` | No | Main no tiene acceso a API de mensajeria; no se dispara alerta a ningun grupo. | Hueco de integracion. |
| **Configuracion del local: Empresa (Fiscal)** | | | | |
| Razon Social | `info.razonSocial` | No | Main inicializa `razonSocial: ''` en `INFO_DEFAULT`, pero jamas lo pinta en pantalla. | Hueco fiscal. |
| RUC | `info.ruc` | No | Main inicializa `ruc: ''`. No se visualiza en pie ni comprobantes. | Hueco fiscal. |
| Direccion fiscal | `info.direccionFiscal` | No | Main inicializa `direccionFiscal: ''`. No se visualiza en pie ni comprobantes. | Hueco fiscal. |
| **Configuracion del local: Fotos** | | | | |
| Galeria del local (portada, ambiente, grupo, fachada, equipo, detalle) | `local` (objeto con 6 claves) | Si | `locPh = localLoad()`. Se pintan en la galeria "Nuestro lugar" de la seccion Conocenos. | Coordinado. |
| **Productos y Disponibilidad** | | | | |
| Creacion de productos nuevos | `prodExtra` | Parcial | Main lee `prodExtra` una sola vez al cargar el archivo (`P.push(...)`). Nuevos productos no aparecen sin recargar. | Incompleto en tiempo real. |
| Edicion de precio y categoria de producto | `pover` | Parcial | Main solo actualiza el precio si `variants.length === 1`. Ignora cambios en productos con varios tamanos y desecha `cat`. | Discordancia severa. |
| Ocultar productos de la carta | `hidden` | Si | Main filtra en `eff`: `!(cfg && cfg.hidden && cfg.hidden[p.id])`. Oculta tarjetas en la carta. | Coordinado. |
| Reordenar productos por categoria | `order` | Si | Main clasifica los productos de cada seccion segun el indice en `cfg.order[cid]`. | Coordinado. |
| Marcar agotado permanente | `agot` | Si | Main filtra en `eff`: `!(cfg && cfg.agot && cfg.agot[p.name])`. | Coordinado. |
| Marcar agotado por hoy | `agotHoy` | Si | Main filtra comparando la fecha ISO actual con `cfg.agotHoy[p.name]`. | Coordinado. |
| Plano de mesas del salon | `plan` | No | Exclusivo del administrativo (posicion de mesas y obstaculos). Main no gestiona salon. | N/A (Por diseno). |
| **Ofertas, Combos, Descuentos y Cupones** | | | | |
| Combos armados con slots | `promosAll` (items con `slots`) | Parcial | Main los lee con `combosCfgLoad()` al inicio del script y crea productos con `comboBuild`. No reactivo. | Coordinado en carga inicial. |
| Promociones "Llevas mas, pagas menos" (2x1, 3x2) | `promosAll` (items sin `slots`) | No | Main filtra estrictamente `p.slots`. Ninguna promocion 2x1 o 3x2 es procesada ni descontada en el carrito. | Hueco funcional. |
| Descuentos automaticos por fecha, dia y hora | `descuentos` | Si | Main ejecuta `autoDisc()` leyendo `descsCfg()`, validando dias, horas y canal 'web'/'todos'. | Coordinado. |
| Cupones promocionales | `coupons` | Si | Main evalua cupones en `couponCheck()`. Lee `cfg.coupons`, pero valida vigencia con fecha congelada. | Coordinado con defecto de fecha. |
| Limite de cupones por comprobante | `couponCfg.porTicket` | No | Main solo permite ingresar un cupón unico en su estado (`s.coupon`), ignorando `porTicket`. | Hueco de regla. |
| Historial de creacion de cupones | `couponLog` | No | Main no lee ni alimenta `couponLog` al canjear cupones. | Hueco de trazabilidad. |
| Regla de acumulacion descuento + cupon | `reglas.acumula` | Si | `reglasCfg().acumula`. Si es falso e ingresa un cupon habiendo descuento automatico, lo rechaza. | Coordinado. |
| **Opciones y Tamanos** | | | | |
| Grupos de modificadores (leche, endulzante, shots, extras, cremas, papas, salx) | `opciones.groups` | Parcial | Main los lee con `opcLoad()` al iniciar el archivo y los asigna con `opcApplyTo`. No actualiza dinamicamente. | Coordinado en carga inicial. |
| Tamanos y precios personalizados por producto | `opciones.sizes` | Parcial | Main los inyecta en `p.variants` durante la carga inicial del script. | Coordinado en carga inicial. |
| **Tipos con Sabores** | | | | |
| Tipos de productos con lista de sabores (Donas, Galletas) | `tipos` | Parcial | Main lee `CFG0.tipos` al cargar el archivo para alimentar `TIPOS` y `saborGroups()`. No actualiza en caliente. | Coordinado en carga inicial. |
| **Novedades, Destacadas, Paleta y Decoraciones** | | | | |
| Novedades y avisos publicitarios | `news` | Si | Main ejecuta `newsActive()` en cada render leyendo `cfg.news` o `NEWS_DEFAULT`. Filtra por vigencia. | Coordinado. |
| Historias destacadas (circulos con visor) | `highlights` | Si | Main lee `cfg.highlights` dinamicamente y levanta el visor `overlay: 'highlight'`. | Coordinado. |
| Paletas de colores | `palettes` | Si | Main ejecuta `palFor(themeId, cfg)` aplicando variables CSS dinamicas (`--accent`, `--bg`, etc.). | Coordinado. |
| Decoracion de temporada / Tema | `theme` | Si | Main extrae `themeId = cfg.theme` e inyecta la paleta de colores y motivos graficos. | Coordinado. |
| Banner publicitario superior | `banner` | Si | Main lee `cfg.banner` (activacion, titulo, subtitulo y etiqueta). | Coordinado. |
| Layout u organizacion de tarjetas | `layout` | Parcial | En PC aplica `LAYOUT_STYLES[cfg.layout]`. En celular fuerza diseno compacto de una fila ignorando el ajuste. | Parcial (restringido en movil). |
| Mostrar u ocultar estrellas de mas vendidos | `topOn` | Si | Main lee `cfg.topOn` para mostrar o apagar badges de favoritos. | Coordinado. |
| **Categorias** | | | | |
| Reordenar categorias | `catOrder` | Si | Main reordena las secciones segun el arreglo `catOrder` del disenador. | Coordinado. |
| Crear o renombrar categorias | No configurable | No | Admin no permite crear categorias; Main tiene las 9 categorias fijadas en constante `CATS`. | Dato fijo en ambos. |
| **Zonas de Reparto** | | | | |
| Geometria y limites de zonas (poligonos) | No configurable | No | Ambos archivos poseen `ZONAS_GEO` con poligonos identicos cableados en codigo. | Fijo en codigo. |
| Tarifas de despacho por zona | `info.tarZ2..7` | Si | Main calcula la tarifa mediante `Number(INFO['tar' + id])`. | Coordinado. |

---

## 3. Elementos Inversos: Lo que la Carta Virtual Tiene Fijo y No Puede Cambiarse desde el Administrativo

Se analizaron aquellos textos, logicas, politicas, parametros operativos e imagenes que viven fijos en el codigo de `Main.dc.html` y que el dueno del negocio o administrador no puede alterar desde la interfaz de `Admin.dc.html`.

1. Subtitulos y notas de categorias con precios fijos:
   En `CATS`, la categoria `frappes` exhibe una nota descriptiva fija: `"Todos al mismo precio: 12 oz s/ 14.50 · 16 oz s/ 16.50 · 21 oz s/ 17.50"`. Si el negocio incrementa el precio de los frappés en el administrador, la cabecera de la seccion continuara anunciando los precios antiguos. Similarmente, `frozen` tiene fija la nota `"Solo tamaño extra de 21 oz"`.
2. Tiempo base de delivery:
   La carta virtual tiene fijado en codigo un tiempo base de despacho de 13 minutos: `'Entrega en unos 13 min'` y en alta demanda `(13 + (Number(loadCfg().altaDem.extra) || 10)) + ' min'`. No hay campo en el administrador para establecer un tiempo base realista (por ejemplo, 30 a 45 minutos).
3. Catalogo rigido de medios de pago:
   La lista de medios de pago en `Main.dc.html` esta definida en la constante `PAYS = [ { id: 'efe', n: 'Efectivo' }, { id: 'yape', n: 'Yape' }, { id: 'plin', n: 'Plin' }, { id: 'tarj', n: 'Tarjeta' }, { id: 'transf', n: 'Transferencia' } ]`. No existe mecanismo en el administrador para deshabilitar temporalmente pagos en efectivo contra entrega, apagar Plin, ni agregar pagos con billeteras digitales nuevas o pasarelas online.
4. Leyendas operativas de metodos de pago:
   Textos explicativos como `"Pagas con tarjeta al recibir el pedido (el repartidor lleva POS) o al recoger en tienda."` o `"Yape · Plin · Tarjeta · Efectivo"` se encuentran concatenados en plantillas de `Main.dc.html` sin parametrizacion.
5. Inexistencia de Libro de Reclamaciones:
   La carta carece de enlace o formulario de Libro de Reclamaciones Virtual, exigido por el Codigo de Proteccion y Defensa del Consumidor en Peru (Ley N° 29571). Unicamente ofrece un formulario generico de comentarios (`FB_TYPES = [ 'Comentario', 'Sugerencia', 'Felicitación', 'Queja' ]`), el cual no emite hoja de reclamacion ni registra codigo correlativo.
6. Renuncia a la emision de comprobantes fiscales:
   En el pie del formulario de compra se muestra el texto fijo: `"El comprobante electrónico no se emite desde esta carta. Pide boleta o factura por WhatsApp."`. El cliente no dispone de casillas para ingresar RUC o Razon Social si requiere factura.
7. Declaracion de consentimiento de datos personales:
   La casilla de consentimiento legal tiene el texto fijo `"Acepto que Caprichos guarde mi DNI y mis datos para acumular puntos y enviarme mi cupón de cumpleaños."`. No hay enlace a una Politica de Privacidad integral ni a Terminos del Servicio.
8. Tabla fija de los productos mas vendidos del mes (`TOP_MES`):
   La constante `TOP_MES` define de manera estatica: `{ mes: 'octubre', porCat: { frappes: 'FRAPPE OREO', iced: 'LATTE COFFE', calientes: 'CAPUCCINO', waffles: 'NUTEWAFFLE', salados: 'CLUB SANDWICH', complementos: 'DONAS ARTESANALES', combos: 'DÚO PARA COMPARTIR' } }`. El mes y los productos destacados son inmutables desde el administrador.
9. Criterio de filtro de productos 100% Cacao:
   El filtro rapido se alimenta de la lista dura `const CACAO = ['FRAPPE MOCA', 'ICED CHOCOLATE', 'CHOCOLATE CALIENTE'];`. Si se anade una nueva torta o bebida con cacao puro, no es filtrable a menos que se modifique el codigo fuente.
10. Canales de atencion y modalidades:
    La constante `MODALS = [ { id: 'delivery', n: 'Delivery' }, { id: 'llevar', n: 'Para recoger' } ]` es fija. El texto que explica que no se pide en mesa (`// los clientes no piden "en el local": en el salón pide el mozo`) esta incrustado como decision de diseno estatica.
11. Datos de prueba en memoria precargados:
    Las constantes `MEM_PHONE = '999888777'` y `MEM_ADDR = 'Av. Los Jazmines 123, Campoy'`, asi como el estado inicial del formulario (`name: 'Ana Pérez'`), aparecen precargados por defecto en el codigo cliente.
12. Omision de bloqueo ante local cerrado o pedidos pausados:
    Aunque la cabecera advierte `"Cerrado por hoy"` o `"Cerrado hoy"`, la carta permite ingresar productos al carrito y pulsar `"Pedir · s/ XX.XX"`, confirmando la orden sin restriccion operativa. Asimismo, ignora la bandera `pause: true` de alta demanda que la cocina puede activar en el administrativo.
13. Fecha de referencia para cupones congelada:
    La constante `const TODAY = '2026-10-15';` se utiliza en `couponCheck()` para comparar los limites `desde` y `hasta`. En cualquier fecha posterior o anterior del calendario real, los cupones que no coincidan con ese dia seran rechazados o admitidos incorrectamente.
14. Desconexion total del envio de pedidos:
    La funcion `placeOrder` finaliza con `this.setState({ overlay: 'done', stage: 0 })`. En ningun momento escribe la orden en `localStorage` ni en un servicio central. Para el administrativo, la venta nunca ocurrio.
15. Stepper de seguimiento ficticio:
    Los 4 estados de avance del cliente son manejados con un boton manual `advance()`, con textos y notas fijas, sin enlace alguno con las comandas de cocina o estados de reparto del administrativo.

---

## 4. Comparativa Detallada entre Administrativo y Carta Virtual

### 4.1. Comparacion de Precios
- Catalogo base: los 64 productos definidos en `P` dentro de `Admin.dc.html` (dentro de `MCAT`) y `Main.dc.html` poseen exactamente los mismos precios y variantes de fabrica (por ejemplo, Frappe Oreo a 14.50, 16.50 y 17.50; Caprisabroso a 33.00; Waffles desde 12.00 hasta 23.00).
- Desincronizacion de ediciones de precio (`pover`):
  - En `Admin.dc.html`, el administrador puede editar el precio de cualquier producto en la vista de Productos. Esto se guarda en `cfg.pover[nombre] = { p: nuevoPrecio }`.
  - En `Main.dc.html`, la logica de lectura dice textualmente:
    `if (o && p.variants.length === 1 && isFinite(Number(o.p)) && Number(o.p) > 0) { p.variants[0].p = Number(o.p); }`
  - Consecuencia confirmada: Si el administrador sube el precio de un Frappe, de un Cafe Caliente o de un Waffle, `p.variants.length` es mayor a 1, por lo que la carta virtual ignora el cambio por completo y mantiene el precio antiguo.
- Conflicto de precios entre Disenador y Catalogo:
  - En el Disenador de `Admin.dc.html`, se pueden modificar textos y precios (`dz.texts`). Al publicarse, `Main.dc.html` aplica una formula de escalamiento relativo:
    `const f = t.price / min; out.variants = p.variants.map((v) => Object.assign({}, v, { p: r2(v.p * f) }))`
  - Si un producto se modifica por `Opciones y tamanos` y simultaneamente por el `Disenador`, los precios se multiplican y escalan de manera impredecible, desalineando lo que ve el cajero frente a lo que cobra la carta.

### 4.2. Comparacion de Nombres de Productos
- Los 64 nombres de productos en el catalogo base son identicos caracter por caracter (incluyendo mayusculas y tildes: `FRAPPE CHOCO LÚCUMA`, `PETIT PAN RELLENO DE POLLO`, `GALLETA CHOCO CHIPS`, etc.).
- Sin embargo, en los combos predeterminados existe una discrepancia sutil:
  - En `COMBOS_DEF` (ambos archivos), el combo DÚO PARA COMPARTIR lista en sus tamanos: `Regular 12 oz`, `Grande 16 oz`, y `Extra 20 oz`.
  - En las bebidas individuales (Frappes y Cafes) y en el DÚO IRRESISTIBLE, el tamano mayor es `Extra 21 oz`.
  - En la documentacion (`combos-y-opciones.md`) se describe `Extra 20 oz`, mientras que en `CATS` de `Main.dc.html` se explicita `Solo tamaño extra de 21 oz`.

### 4.3. Comparacion de Categorias
- Cantidad: ambos manejan exactamente las mismas 9 categorias internas: `combos`, `frappes`, `iced`, `frozen`, `calientes`, `waffles`, `salados`, `croissants`, `complementos`.
- Denominacion visible:
  - Para la categoria con ID `complementos`:
    - En `Admin.dc.html`: en `CARTA_CATS` figura como `Postres`, pero en el objeto `SEC` original se denomino `Complementos` y luego se sobreescribio a `Postres`.
    - En `Main.dc.html`: en `CATS` se visualiza con la etiqueta en mayusculas `POSTRES` y el titulo `Postres`.
  - En `salados`:
    - En `Admin.dc.html`: `SEC.salados.note = 'Hamburguesas, sándwiches y papas'`.
    - En `Main.dc.html`: `CATS.salados.note = 'Hamburguesas, sándwiches, papas, petit pan y empanadas'`.
- Restriccion estructural: Ninguno de los dos sistemas permite dar de alta una decima categoria (por ejemplo, "Jugos Naturales" o "Bebidas Alcohólicas"). El listado esta completamente congelado.

### 4.4. Comparacion de Areas de Produccion
- En `Admin.dc.html`:
  - Los productos se agrupan en tres areas de despacho mediante la funcion `AREA_OF`:
    - `Bebidas`: `frappes`, `iced`, `calientes`, `frozen`.
    - `Salados`: `salados`, `croissants`.
    - `Postres`: `complementos`, `waffles`.
  - Adicionalmente, en la pantalla de pedidos de insumos (`reqLoad`), el area operativa de cocina se identifica como `'Cocina y barra'`.
- En `Main.dc.html`:
  - No existe ninguna referencia a areas de produccion. El cliente desconoce que su comanda se divide en tickets separados para barra y cocina caliente.

### 4.5. Comparacion de Medios de Pago
- En `Admin.dc.html`:
  - Permite cobrar con: `Efectivo`, `Yape`, `Plin`, `Transferencia`, `Tarjeta`, y ademas incluye `Otros` en la conciliacion y arqueo de caja (`CJ_MEDIOS`).
  - Admite pagos mixtos (combinacion de efectivo y digital) y control de vueltos.
- En `Main.dc.html`:
  - Define `PAYS`: `Efectivo`, `Yape`, `Plin`, `Tarjeta`, `Transferencia`.
  - No admite pagos divididos ni pago con `Otros` o vales.
  - Al no haber sincronizacion, la carta no valida si el local cuenta con cambio suficiente para billetes grandes.

### 4.6. Comparacion de Estados del Pedido
- En `Admin.dc.html`:
  - Ciclo de vida estandarizado en constante `STATUS`:
    - `nuevo` ("Por confirmar")
    - `cola` ("En cocina · nuevo")
    - `prep` ("Preparando")
    - `listo` ("Listo")
    - `ruta` ("En camino")
    - `entregado` ("Entregado")
    - `rechazado` ("Rechazado")
  - Modalidad de entrega: `delivery` ("Delivery"), `llevar` ("Para llevar"), `local` ("En mesa").
- En `Main.dc.html`:
  - Stepper desacoplado con 4 estados:
    - 0: "Pedido recibido"
    - 1: "Un asesor te contacta y confirma el pago"
    - 2: "En cocina"
    - 3: "En camino" (si es delivery) o "Listo para recoger" (si es llevar)
  - Modalidad de entrega: `delivery` ("Delivery"), `llevar` ("Para recoger"). Hay una discrepancia de termino entre "Para llevar" (Admin) y "Para recoger" (Main).
  - La carta virtual no tiene estado para "Entregado", "Rechazado" ni "Anulado".

### 4.7. Comparacion de Textos Legales y Fiscales
- Identificacion tributaria:
  - En `Admin.dc.html`, en `Configuracion del local > Empresa`, se solicita `razonSocial`, `ruc` y `direccionFiscal`. No obstante, la interfaz advierte: `"Uso interno: no se muestra al cliente"`.
  - En `Main.dc.html`, estos valores no se despliegan en ningun sector de la carta virtual ni en el pie de pagina.
- Comprobantes electronicos:
  - En `Admin.dc.html`, los pedidos cuentan con el atributo `comp` para emitir `Nota de venta`, `Boleta` o `Factura`.
  - En `Main.dc.html`, la carta expone la negativa: `"El comprobante electrónico no se emite desde esta carta. Pide boleta o factura por WhatsApp."`, privando al cliente de consignar sus datos de facturacion.
- Libro de Reclamaciones:
  - Completamente ausente en `Main.dc.html`. Los reclamos se degradan a un formulario de sugerencias informal.

---

## 5. Registro Detallado de Hallazgos

### Hallazgo D-01: Desconexion transaccional de pedidos de la carta virtual
- **Tipo:** Flujo / Hueco
- **Donde esta cada lado:**
  - En `Main.dc.html`: funcion `placeOrder` dentro de `Component.renderVals()` (`this.setState({ overlay: 'done', stage: 0, user: nu })`).
  - En `Admin.dc.html`: arreglo de ordenes inicializado exclusivamente en memoria (`orders: JSON.parse(JSON.stringify(SEED))`).
- **Por que importa:** Cuando un cliente finaliza su pedido en la carta web, la orden no se escribe en `localStorage` ni se transmite al panel del administrador ni a las pantallas de cocina. El pedido queda huerfano en el navegador del cliente y el restaurante nunca se entera de la compra a menos que el cliente escriba por WhatsApp.
- **Prioridad:** Alta
- **Propuesta de arreglo:** Implementar un guardado de pedidos en `localStorage` con una clave compartida (ej. `caprichos_pedidos_v1`) y un listener de eventos `storage` en `Admin.dc.html` para incorporar los nuevos pedidos a la bandeja de entrada en tiempo real.
- **Evidencia:**
  - CONFIRMADO: En `Main.dc.html`, `placeOrder` solo ejecuta `this.setState({ overlay: 'done', stage: 0, user: nu })` y suma puntos en `cliSave(cl)`, sin llamar a `writeCfg` ni registrar la orden. En `Admin.dc.html`, `this.state.orders` se inicializa con `SEED` y jamas consulta `localStorage`.

---

### Hallazgo D-02: Edicion de precios ignorada para productos multivariante
- **Tipo:** Discordancia / Fijo en codigo
- **Donde esta cada lado:**
  - En `Admin.dc.html`: edicion de precios en vista de productos que guarda `pover` (`writeCfg({ pover: this.state.pover })`).
  - En `Main.dc.html`: bloque de carga de modificaciones de precio (`const po = (c && c.pover) || {}; P.forEach((p) => { const o = po[p.name]; if (o && p.variants.length === 1 && isFinite(Number(o.p)) && Number(o.p) > 0) { p.variants[0].p = Number(o.p); } });`).
- **Por que importa:** Si el administrador cambia el precio de cualquier producto que tenga mas de un tamano (como todos los Frappes, Cafes, Bebidas frias, Waffles o Tortas), la condicion `p.variants.length === 1` se evalua como falsa y la carta virtual descarta el cambio de precio sin advertir al usuario.
- **Prioridad:** Alta
- **Propuesta de arreglo:** Modificar la estructura de `pover` para admitir precios por variante o tamano y actualizar `p.variants` en `Main.dc.html` independientemente de la cantidad de variantes.
- **Evidencia:**
  - CONFIRMADO: Cita textual de `Main.dc.html`: `if (o && p.variants.length === 1 && isFinite(Number(o.p)) && Number(o.p) > 0) { p.variants[0].p = Number(o.p); }`. Los productos con varias presentaciones quedan excluidos por diseno.

---

### Hallazgo D-03: Promociones tipo "Llevas mas, pagas menos" no son procesadas por la carta virtual
- **Tipo:** Hueco
- **Donde esta cada lado:**
  - En `Admin.dc.html`: generador de ofertas en `Ofertas y descuentos > Promociones > Armar oferta` que almacena en `promosAll` ofertas tipo Combo, 2x1 o 3x2.
  - En `Main.dc.html`: funcion `combosCfgLoad` (`const l = c && Array.isArray(c.promosAll) ? c.promosAll.filter((p) => p.slots) : COMBOS_DEF;`).
- **Por que importa:** El administrador cree haber lanzado una oferta de 2x1 o 3x2, pero la carta virtual descarta toda promocion que no contenga la propiedad `slots`. El cliente paga precio completo en el carrito.
- **Prioridad:** Alta
- **Propuesta de arreglo:** Ampliar el evaluador de descuentos de la carta virtual (`autoDisc`) para reconocer y aplicar descuentos por cantidad (2x1, 3x2) definidos en `promosAll`.
- **Evidencia:**
  - CONFIRMADO: En `Main.dc.html`, la unica referencia a `promosAll` es `c.promosAll.filter((p) => p.slots)`. Las ofertas de tipo 2x1 carecen de logica de calculo en el carrito.

---

### Hallazgo D-04: Fecha de validacion de cupones congelada en el pasado
- **Tipo:** Fijo en codigo
- **Donde esta cada lado:**
  - En `Main.dc.html`: declaracion `const TODAY = '2026-10-15';` y su uso en `couponCheck` (`if (TODAY < c.desde || TODAY > c.hasta)`).
  - En `Admin.dc.html`: evaluacion de vigencias en `vigNow` (`const iso = isoOf(now);`).
- **Por que importa:** La carta virtual evalua la vigencia de cualquier cupón contra la fecha estatica `2026-10-15`. Si se crea un cupón valido para noviembre de 2026 o en dias posteriores, sera rechazado de inmediato con el mensaje `"El cupón no está vigente"`.
- **Prioridad:** Alta
- **Propuesta de arreglo:** Reemplazar la constante fija `TODAY` por la fecha actual del sistema calculada dinamicamente con `isoOf(new Date())`.
- **Evidencia:**
  - CONFIRMADO: En `Main.dc.html` linea exacta `const TODAY = '2026-10-15';` y `if (TODAY < c.desde || TODAY > c.hasta) { return { ok: false, msg: 'El cupón no está vigente (' + c.desde + ' a ' + c.hasta + ').' }; }`.

---

### Hallazgo D-05: Productos mas vendidos del mes ("Top del mes") cableados en codigo
- **Tipo:** Fijo en codigo
- **Donde esta cada lado:**
  - En `Main.dc.html`: declaracion de constante `TOP_MES` (`const TOP_MES = { mes: 'octubre', porCat: { frappes: 'FRAPPE OREO', iced: 'LATTE COFFE', calientes: 'CAPUCCINO', waffles: 'NUTEWAFFLE', salados: 'CLUB SANDWICH', complementos: 'DONAS ARTESANALES', combos: 'DÚO PARA COMPARTIR' } };`).
  - En `Admin.dc.html`: interruptor general `toggleTop` (`writeCfg({ topOn: !topOn })`).
- **Por que importa:** El administrador solo puede encender o apagar las estrellas en la carta, pero no puede cambiar los productos destacados ni el nombre del mes. Cuando comience noviembre o varien las ventas reales, la carta continuara mostrando "Mas comprado en octubre" con los mismos 7 articulos prefijados.
- **Prioridad:** Media
- **Propuesta de arreglo:** Guardar en `caprichos_carta_cfg_v1` un objeto `topMes` configurable desde el panel de reportes o administracion, y leerlo dinamicamente en la carta.
- **Evidencia:**
  - CONFIRMADO: En `Main.dc.html`, `topInfo` utiliza `TOP_MES.porCat[cat]` y `TOP_MES.mes`, los cuales son literales estaticos.

---

### Hallazgo D-06: Precios desactualizados cableados en el subtitulo de categoria Frappes
- **Tipo:** Discordancia / Fijo en codigo
- **Donde esta cada lado:**
  - En `Main.dc.html`: definicion de `CATS` (`{ id: 'frappes', n: 'FRAPPES', t: 'Frappes', note: 'Todos al mismo precio: 12 oz s/ 14.50 · 16 oz s/ 16.50 · 21 oz s/ 17.50' }`).
  - En `Admin.dc.html`: administracion de precios en catalogo y diseno.
- **Por que importa:** Si la administracion altera los precios base de los frappés debido a la inflacion o promociones, la cabecera de la categoria en la carta virtual seguira pregonando que todos cuestan s/ 14.50, s/ 16.50 y s/ 17.50, generando quejas de publicidad enganosa de los clientes.
- **Prioridad:** Media
- **Propuesta de arreglo:** Generar la nota de precios de forma dinamica a partir de las variantes reales de los productos de la categoria o permitir la edicion de la nota en el administrador.
- **Evidencia:**
  - CONFIRMADO: El texto literal en `Main.dc.html` contiene `'Todos al mismo precio: 12 oz s/ 14.50 · 16 oz s/ 16.50 · 21 oz s/ 17.50'`.

---

### Hallazgo D-07: Tiempo base de entrega fijo e incumplimiento de pausa por alta demanda
- **Tipo:** Fijo en codigo / Flujo
- **Donde esta cada lado:**
  - En `Main.dc.html`: calculo de tiempo en bloque de confianza (`(loadCfg() && loadCfg().altaDem && loadCfg().altaDem.on) ? 'Alta demanda: entrega en unos ' + (13 + (Number(loadCfg().altaDem.extra) || 10)) + ' min' : 'Entrega en unos 13 min'`).
  - En `Admin.dc.html`: boton de pausa de pedidos en alta demanda (`hdSave({ pause: !hd.pause })`).
- **Por que importa:** El tiempo normal de entrega esta fijo en 13 minutos, cifra que no refleja el tiempo real de despacho de la mayoria de cafeterias en Lima (usualmente 30-45 min). Ademas, cuando cocina activa la opcion "Pausar pedidos" por saturacion de comanda, la carta virtual ignora el estado `pause` y permite a los comensales seguir comprando normalmente.
- **Prioridad:** Alta
- **Propuesta de arreglo:** Configurar el tiempo base de entrega en los datos del local dentro del administrador y bloquear el carrito en la carta cuando `altaDem.pause` sea verdadero.
- **Evidencia:**
  - CONFIRMADO: En `Main.dc.html`, el numero 13 esta hardcodeado y la variable `loadCfg().altaDem.pause` jamas se consulta en ningun componente o validador.

---

### Hallazgo D-08: Pedidos permitidos con el local cerrado
- **Tipo:** Flujo
- **Donde esta cada lado:**
  - En `Main.dc.html`: funcion `goCheckout` (`if (!belowMin && !outZone && s.modal) { this.setState({ overlay: 'checkout' }); }`) y funcion `placeOrder`.
  - En `Main.dc.html`: funcion `statusNow` que determina `open: false` y texto `"Cerrado por hoy"`.
- **Por que importa:** Aunque la carta detecta y muestra el cartel de "Cerrado hoy" o "Cerrado por el momento", no existe ninguna condicion que inhabilite `goCheckout` ni `placeOrder`. Un cliente puede emitir un pedido a las 3:00 am creyendo que sera despachado.
- **Prioridad:** Alta
- **Propuesta de arreglo:** Condicionar la ejecucion de `goCheckout` y el boton de confirmacion a que `statusNow(horarioOf(INFO), new Date()).open` sea afirmativo, o requerir seleccion expliciita de pedido programado.
- **Evidencia:**
  - CONFIRMADO: La comprobacion en `goCheckout` es estrictamente `!belowMin && !outZone && s.modal`; carece de chequeo del estado del horario.

---

### Hallazgo D-09: Imposibilidad de configurar medios de pago activos
- **Tipo:** Fijo en codigo / Hueco
- **Donde esta cada lado:**
  - En `Admin.dc.html`: configuracion de pagos (`INFO_CATS.pagos` solo incluye campos para ingresar strings de `yape`, `plin` y `cuenta`).
  - En `Main.dc.html`: arreglo inmutable `const PAYS = [ { id: 'efe', n: 'Efectivo' }, { id: 'yape', n: 'Yape' }, { id: 'plin', n: 'Plin' }, { id: 'tarj', n: 'Tarjeta' }, { id: 'transf', n: 'Transferencia' } ];`.
- **Por que importa:** Si el local decide no aceptar efectivo para delivery por seguridad de los motorizados, o si la pasarela de POS tarjeta se averia, el negocio no tiene manera de apagar ese medio de pago en la carta virtual.
- **Prioridad:** Media
- **Propuesta de arreglo:** Incorporar casillas de activacion/desactivacion por medio de pago en `Configuracion del local > Pagos` y filtrar `PAYS` en la carta segun dicha configuracion.
- **Evidencia:**
  - CONFIRMADO: En `Admin.dc.html`, los campos de pagos son solo tres cajas de texto sin interruptores. En `Main.dc.html`, `PAYS` es constante de nivel de modulo.

---

### Hallazgo D-10: Inconsistencia en nomenclatura de modalidades de entrega
- **Tipo:** Discordancia
- **Donde esta cada lado:**
  - En `Admin.dc.html`: constante `MODAL = { delivery: 'Delivery', llevar: 'Para llevar', local: 'En mesa' };`.
  - En `Main.dc.html`: constante `MODALS = [ { id: 'delivery', n: 'Delivery' }, { id: 'llevar', n: 'Para recoger' } ];`.
- **Por que importa:** La misma modalidad operativa es denominada "Para llevar" en la comanda administrativa y "Para recoger" en la carta virtual. Si el cliente recibe confirmacion o consulta sobre su pedido "Para recoger", el personal de mostrador busca ordenes "Para llevar", dificultando la comunicacion interna y con el cliente.
- **Prioridad:** Baja
- **Propuesta de arreglo:** Estandarizar el termino en ambos sistemas bajo una sola etiqueta oficial acordada con el cliente (ej. "Para llevar" o "Recojo en tienda").
- **Evidencia:**
  - CONFIRMADO: En `Admin.dc.html`, `llevar` mapea a `'Para llevar'`, mientras que en `Main.dc.html` mapea a `'Para recoger'`.

---

### Hallazgo D-11: Ausencia obligatoria de Libro de Reclamaciones
- **Tipo:** Hueco / Legal
- **Donde esta cada lado:**
  - En `Main.dc.html`: modal de sugerencias (`FB_TYPES = [ 'Comentario', 'Sugerencia', 'Felicitación', 'Queja' ];`).
  - En `Admin.dc.html`: bandeja de mensajes de clientes (`commentsRead()`).
- **Por que importa:** El Codigo de Proteccion y Defensa del Consumidor de Peru sanciona a los establecimientos virtuales que no cuenten con un Libro de Reclamaciones formal con identificacion del consumidor, detalle del bien/servicio, tipificacion de queja o reclamo y constancia enviada al correo del quejoso.
- **Prioridad:** Alta
- **Propuesta de arreglo:** Implementar un enlace formal al Libro de Reclamaciones Virtual en el pie de pagina de la carta virtual que genere un numero de reclamo y guarde la informacion estructurada.
- **Evidencia:**
  - CONFIRMADO: `grep -i "reclamaciones" Main.dc.html` no arroja ocurrencias en la interfaz. El formulario actual solo solicita mensaje, nombre y contacto opcionales.

---

### Hallazgo D-12: Ocultamiento de datos fiscales y renuncia a emitir facturas
- **Tipo:** Hueco / Discordancia
- **Donde esta cada lado:**
  - En `Admin.dc.html`: formulario de empresa con etiqueta descriptiva literal: `{ id: 'empresa', n: 'Empresa', d: 'Uso interno: no se muestra al cliente', fields: [ { k: 'razonSocial', l: 'Razón social' }, { k: 'ruc', l: 'RUC' }, { k: 'direccionFiscal', l: 'Dirección fiscal' } ] }`.
  - En `Main.dc.html`: texto de pie de carrito: `<div style="font-size:12px;line-height:16px;color:var(--soft);margin:12px 0">El comprobante electrónico no se emite desde esta carta. Pide boleta o factura por WhatsApp.</div>`.
- **Por que importa:** Las actas con el cliente y el documento `configuracion-centralizada.md` estipulan que los datos de empresa se configuran para ser usados en comprobantes. Sin embargo, el administrativo declara que son de uso interno y la carta virtual avisa expresamente que no emite comprobantes electronicos, obligando a triangulaciones manuales por WhatsApp y contradiciendo el objetivo de autoservicio.
- **Prioridad:** Media
- **Propuesta de arreglo:** Habilitar en el proceso de pago de la carta virtual la seleccion de Boleta o Factura con captura de RUC y Razon Social, y mostrar la informacion fiscal del emisor en el pie de pagina.
- **Evidencia:**
  - CONFIRMADO: Las citas son literales en la definición de `INFO_CATS` de `Admin.dc.html` y en la plantilla del pie de compra de `Main.dc.html`.

---

### Hallazgo D-13: Codigo de pedido congelado en CP-0001
- **Tipo:** Fijo en codigo
- **Donde esta cada lado:**
  - En `Main.dc.html`: estado inicial del componente (`orderCode: 'CP-0001'`).
  - En `Admin.dc.html`: generador de pedidos correlativo (`CP-0101`, `CP-0102`, etc.).
- **Por que importa:** Cada orden enviada desde la carta virtual muestra en pantalla la confirmacion con el codigo estatico "CP-0001". Si multiples clientes realizan pedidos, todos tendran el mismo codigo, haciendo imposible el rastreo e identificacion telefonica o presencial.
- **Prioridad:** Media
- **Propuesta de arreglo:** Generar un codigo correlativo o seudoaleatorio unico almacenado en `localStorage` (ej. `CP-` mas timestamp o secuencial) al momento de pulsar confirmar.
- **Evidencia:**
  - CONFIRMADO: En `Main.dc.html`, `s.orderCode` se lee del estado inicial y nunca se modifica durante la ejecucion de `placeOrder`.

---

### Hallazgo D-14: Desconexion del consumo de cupones con el registro administrativo
- **Tipo:** Hueco / Flujo
- **Donde esta cada lado:**
  - En `Main.dc.html`: confirmacion de orden en `placeOrder`.
  - En `Admin.dc.html`: contador de usos de cupones (`c.usos`) y bitacora de auditoria `couponLog`.
- **Por que importa:** Cuando un cliente aplica con exito un cupón en la carta web y completa la orden, el numero de usos (`usos`) del cupón en `caprichos_carta_cfg_v1.coupons` no se incrementa, ni se anade ninguna entrada a `couponLog`. El cupón puede usarse infinitas veces superando el limite `maxUsos`.
- **Prioridad:** Alta
- **Propuesta de arreglo:** Actualizar el objeto del cupón en `localStorage` dentro de `placeOrder`, incrementando `c.usos` y agregando una linea de auditoria con el DNI o telefono del comprador.
- **Evidencia:**
  - CONFIRMADO: En `placeOrder`, la unica mutacion de almacenamiento es `cliSave(cl)` y `userSave(nu)` para sumar puntos; no hay manipulacion de `cfg.coupons` ni de `couponLog`.

---

### Hallazgo D-15: Poligonos y coberturas de zonas de delivery completamente rigidos
- **Tipo:** Fijo en codigo
- **Donde esta cada lado:**
  - En `Admin.dc.html`: definicion estatica de `ZONAS_GEO`, `ZONA_COLOR` y `ZONA_IDS = [ 'Z2', 'Z3', 'Z4', 'Z5', 'Z7' ]`.
  - En `Main.dc.html`: definicion identica de `ZONAS_GEO`, `ZONA_COLOR` y `ZONA_IDS`.
- **Por que importa:** El negocio unicamente puede cambiar el precio de envio de las zonas preexistentes (`tarZ2` a `tarZ7`). Si el restaurante expande su radio de entrega a una Zona 8 o modifica los limites de una zona por apertura de nuevas vias en San Juan de Lurigancho, no puede hacerlo desde el administrativo; requiere intervencion directa en el codigo fuente de ambos archivos.
- **Prioridad:** Baja
- **Propuesta de arreglo:** Centralizar la configuracion geoespacial en una estructura administrable o permitir dibujar/cargar GeoJSON desde el modulo de Configuracion del Local.
- **Evidencia:**
  - CONFIRMADO: Las coordenadas de los poligonos estan cableadas en arreglos literales de latitud y longitud en ambos ficheros HTML.

---

### Hallazgo D-16: Triple mecanismo en conflicto para modificacion de precios en el Administrador
- **Tipo:** Discordancia / Flujo
- **Donde esta cada lado:**
  - En `Admin.dc.html`: edicion de precios en tres vistas distintas:
    1. Vista Productos: actualiza `this.state.pover` y escribe `writeCfg({ pover })`.
    2. Vista Disenador: actualiza `dz.texts[p.id].price` y escribe `writeCfg({ texts })`.
    3. Vista Opciones y tamanos: actualiza `opciones.sizes[p.name]` y escribe `writeCfg({ opciones })`.
  - En `Main.dc.html`:
    - Aplica `pover` al inicio si tiene una sola variante.
    - Aplica `opciones.sizes` al inicio.
    - Aplica `applyTexts` en cada render escalando proporcionalmente las variantes segun `texts.price`.
- **Por que importa:** Existen tres lugares en el administrativo para cambiar el precio de un mismo producto. Al modificarse en mas de uno, las capas de sobreescritura compiten entre si, generando redondeos anómalos o ignorando los cambios de forma arbitraria.
- **Prioridad:** Alta
- **Propuesta de arreglo:** Unificar la fuente de verdad del precio en una sola entidad administrable (`catalogo`), eliminando las mutaciones paralelas de `pover` y el escalamiento matematico ciego de `texts`.
- **Evidencia:**
  - CONFIRMADO: `Admin.dc.html` persiste independientemente `pover`, `texts` y `opciones.sizes`, y `Main.dc.html` ejecuta tanto `opcApplyTo` como `applyTexts` con formulas de proporcionalidad.

---

## 6. Conclusion y Recomendaciones Prioritarias

La coordinacion entre el administrativo y la carta virtual se encuentra en un estado hibrido de desarrollo:
- Aspectos bien resueltos: los datos institucionales (nombre, redes, horario dinamico, ubicacion, fotos del local, politicas de envio gratis y pedido minimo), novedades publicitarias, destacadas, banner de portada, decoraciones de temporada y el catalogo base de 64 productos operan de manera sincronizada y consistente.
- Aspectos criticos que requieren atencion inmediata:
  1. Conectar la creacion de pedidos (`placeOrder`) con la persistencia compartida para que las comandas lleguen a las pantallas de cocina y al panel de pedidos.
  2. Corregir el filtro de edicion de precios `pover` en `Main.dc.html` para que los productos con multiples variantes no queden inmunes a los cambios del administrador.
  3. Eliminar la fecha congelada `TODAY = '2026-10-15'` en la validacion de cupones para permitir el uso de promociones en tiempo real.
  4. Impedir compras cuando el local se encuentre fuera de horario o en pausa por alta demanda.
  5. Incorporar el formulario reglamentario de Libro de Reclamaciones y habilitar la emision de boletas y facturas con RUC.

INFORME LISTO

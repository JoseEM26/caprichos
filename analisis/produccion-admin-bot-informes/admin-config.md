---
id: ANA-CAP-044
tipo: analisis
titulo: "Informe de Auditoria Tecnica y Funcional: Rol Administrador (Parte A: Configuracion y Catalogo)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, produccion-admin-bot-informes]
---

# Informe de Auditoria Tecnica y Funcional: Rol Administrador (Parte A: Configuracion y Catalogo)

## 1. Resumen Ejecutivo y Metodologia

El presente informe audita de manera exhaustiva el rol de Administrador en su alcance de configuracion del sistema y gestion del catalogo para el proyecto Caprichos (cafeteria artesanal en Lima). La evaluacion toma como base el prototipo interactivo implementado en `fuente/Admin.dc.html`, contrastandolo directamente con los requerimientos expresados por el cliente Kevin Rosales en las sesiones de descubrimiento (`fuente/acta-01-descubrimiento.md`, `fuente/acta-02-descubrimiento.md` y `fuente/iniciativas-acta-02.md`), y con los estandares operativos del sistema de referencia en produccion documentados en `referencia/` (`productos.md`, `modulos-usuarios-notificaciones.md`, `escritorio.md`, `modulos.md`, `consolidado-reunion.md`).

Para cada hallazgo se documenta con rigor:
1. Ubicacion exacta: texto o vista en el mockup, funcion o constante en el codigo, o cita textual en las actas de reunion.
2. Impacto comercial y operativo concreto para una cafeteria artesanal en Lima.
3. Nivel de prioridad: Alta, Media o Baja.
4. Estado de certeza: distincion explicita entre **CONFIRMADO en el codigo o en el acta** y **SUPOSICION**.
5. Diagnostico sobre persistencia, modificabilidad sin programador, seguridad en permisos y requerimientos de autonomia para el dueno del negocio.

---

## 2. Auditoria de Punta a Punta por Modulo (12 Componentes)

### 2.1. Productos y su Disponibilidad

#### Hallazgo 1.1: Ausencia de boton y funcionalidad para crear nuevos productos desde el panel administrativo
- **Donde esta**: En `Admin.dc.html`, en la vista `isProductos` (seccion `<!-- ===== PRODUCTOS ===== -->`), donde se renderiza la barra de categorias, buscador `prod-q`, filtros y la lista de tarjetas `products`. La coleccion se genera a partir de la constante global `PRODUCTS`, derivada exclusivamente de la lista inmutable `MCAT`. No existe boton `+ Nuevo producto`, formulario de alta ni funcion de guardado de nuevos platos.
- **Por que importa para una cafeteria**: Una cafeteria artesanal renueva su oferta periodicamente (bebidas de estacion, postres del dia, ediciones limitadas por campana como bebidas navidenas o postres de Halloween). Si el dueno no puede crear productos por si mismo, queda completamente bloqueado y dependiente de un desarrollador para cada lanzamiento comercial.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo.

#### Hallazgo 1.2: Bloqueo de edicion del nombre de los productos y persistencia volatil del precio
- **Donde esta**: En `Admin.dc.html`, en la funcion asignada a `p.edit` dentro del mapeo de productos en `Component`: `edit: () => this.setState({ edit: { kind: 'product', key: p.n, title: p.n, labels: ['Nombre', 'Categoría', 'Precio (s/)'], vals: [p.n, p.cat, String(p.p)], lock: [true, false, false], combos: { 1: 'categorias' }, imgKey: 'prod|' + p.n, open: -1, nv: {} } })`. Al guardar la edicion en `saveEdit`, se ejecuta: `this.setState({ pover: Object.assign({}, s.pover, { [ed.key]: { cat: ed.vals[1], p: isNaN(price) ? base.p : price } }), edit: null })`. El estado `s.pover` no se persiste en `localStorage` ni en base de datos.
- **Por que importa para una cafeteria**: El nombre del producto esta bloqueado (`lock: [true, ...]`), impidiendo corregir faltas ortograficas o renombrar un plato sin programador. Ademas, si el dueno actualiza el precio de un frapé o café ante el alza del costo de insumos (leche o café), el nuevo precio se almacena solo en memoria volatil; al recargar la pagina o cerrar sesion, el precio se revierte al valor inicial de `MCAT`.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo.

#### Hallazgo 1.3: Marcado de disponibilidad inmediata y agotado temporal
- **Donde esta**: En `Admin.dc.html`, funcion `availPersist(av, ah)` vinculada a `p.toggle`, y carga con `availLoad()` y `ahoyLoad()`. Permite conmutar un producto entre DISPONIBLE y AGOTADO, persistiendo el estado en `localStorage` bajo las propiedades `agot` y `agotHoy` de la clave `caprichos_carta_cfg_v1`.
- **Por que importa para una cafeteria**: Cumple de forma adecuada con el requerimiento clave de Kevin Rosales (Acta 02, minuto 00:39:36) sobre inhabilitar inmediatamente productos cuando se agota un insumo perecible (como pulpa fresca de fruta o lúcuma fresca), evitando que los clientes pidan y paguen por la web o chatbot articulos sin existencias.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo y en el acta.

#### Hallazgo 1.4: Gestion de categorias en memoria sin persistencia al recargar
- **Donde esta**: En `Admin.dc.html`, boton `Gestionar listas` (`manageOpen`) que llama a `setList('categorias', next)`. En la definicion de `setList`: `const setList = (key, arr, extra) => { const lists = Object.assign({}, this.state.lists, { [key]: arr }); this.setState(Object.assign({ lists: lists }, extra || {})); if (/^sab_/.test(key)) { persistTipos(lists, this.state.tipos); } };`.
- **Por que importa para una cafeteria**: La condicion solo persiste si la clave comienza con `sab_` (sabores de tipos). Cuando el administrador crea una nueva categoria de carta (por ejemplo, "Cafes de Especialidad" o "Bebidas Calientes Especiales"), dicha categoria solo vive en el estado temporal del componente y desaparece totalmente al recargar el navegador.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo.

---

### 2.2. Ofertas y Descuentos

#### Hallazgo 2.1: Implementacion del constructor visual de combos con reglas de sustitucion
- **Donde esta**: En `Admin.dc.html`, pestana `isOfPromos` (Promociones) y modal `cmb`. Soporta slots fijos, slots por categoria/producto ("a eleccion") y alternativas dinamicas (`slots.alts`). Guarda mediante `persistPromos` invocando `writeCfg({ promosAll: np })`. En `areaParts` y `expandPromo` se modela el desglose hacia cocina y la regla solicitada por Kevin de sustituir complementos agotados en lugar de desactivar el combo completo.
- **Por que importa para una cafeteria**: Resuelve directamente el problema central expresado por Kevin (Acta 02, minutos 00:34:01 y 01:04:24) sobre el "Dúo Compartir" y el "Dúo Irresistible", permitiendo vender paquetes promocionales sin romper el flujo operativo de cocina y barra.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo y en el acta.

#### Hallazgo 2.2: Descuentos automaticos por franja horaria y categoria (Happy Hour)
- **Donde esta**: En `Admin.dc.html`, pestana `isOfDescs` y funcion `saveDescs(list)` que escribe `writeCfg({ descuentos: list })`. Evalua vigencia mediante `vigNow(o, now)` considerando dias de la semana, fechas limite y horas (con `hMin(o.hd)` y `hMin(o.hh)`).
- **Por que importa para una cafeteria**: Facilita dinamizar ventas en horas de baja afluencia tipicas de cafeteria (por ejemplo, tardes entre las 15:00 y las 17:00 con descuentos en frapés o cafes frios), aplicando la rebaja automaticamente sin exigir digitacion de codigos por el cajero o cliente.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el codigo.

#### Hallazgo 2.3: Cupones impresos al pie del comprobante y control de acumulacion
- **Donde esta**: En `Admin.dc.html`, pestanas `isOfCupones` y `isOfReglas`. Los cupones se cargan con `couponsLoad()` y se guardan con `saveCoupons`. Incluye vista previa en ticket monospace de 80 mm (`ctPreview`), configuracion de cupones por comprobante (`ctCfgLoad`), texto de pie y regla de no acumulacion con descuentos automaticos (`rgAcumula`).
- **Por que importa para una cafeteria**: Permite fidelizar y estimular la recompra de clientes presenciales imprimiendo cupones con fecha de caducidad corta (7 a 15 dias) en su recibo, emulando la mecanica comercial de cadenas gastronomicas.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el codigo.

#### Hallazgo 2.4: Brecha de auditoria en ofertas y reglas de descuento
- **Donde esta**: En `Admin.dc.html`, funcion `logCt` que solo audita cupones (`couponLog`), mientras que la creacion/edicion de combos (`persistPromos`), descuentos automaticos (`saveDescs`) y reglas generales (`rgSave`) no generan ningun registro en bitacora.
- **Por que importa para una cafeteria**: Si un usuario modifica indebidamente el precio de un combo o amplía el descuento de una categoria sin autorizacion, el dueno no tiene manera de saber quien realizo el cambio ni en que fecha y hora.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el codigo.

---

### 2.3. Diseno de la Carta

#### Hallazgo 3.1: Reordenamiento interactivo de categorias y productos
- **Donde esta**: En `Admin.dc.html`, vista `isDisenador`. Funciones `moveCat(i, d)`, `moveIn(id, from, to)` y controles drag-and-drop (`dragStart`, `dragOver`, `drop`). Permite subir y bajar bloques de categorias y productos especificos con flechas y arrastre. Publica mediante `dzPublish` en `localStorage` con la clave `caprichos_carta_cfg_v1`.
- **Por que importa para una cafeteria**: Cumple exactamente lo solicitado por Kevin (Acta 02, minutos 01:46:39 y siguientes): "que salga primero la chocolate, no? El waffle... poder mover los bloques sin formularios engorrosos".
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo y en el acta.

#### Hallazgo 3.2: Rigidez estructural de categorias en el disenador
- **Donde esta**: En `Admin.dc.html`, constantes `CARTA_CATS` y `CHIP_NAMES`: `[ { id: 'combos', n: 'Combos' }, { id: 'frappes', n: 'Frappes' }, { id: 'iced', n: 'Iced' }, { id: 'frozen', n: 'Frozen' }, { id: 'calientes', n: 'Calientes' }, { id: 'waffles', n: 'Waffles' }, { id: 'salados', n: 'Salados' }, { id: 'croissants', n: 'Croissants' }, { id: 'complementos', n: 'Postres' } ]`. La funcion `dzDefault()` genera las secciones basadas exclusivamente en este arreglo fijo y en `CARTA` (derivado de `MCAT`).
- **Por que importa para una cafeteria**: Si el dueno desea crear una nueva seccion tematica en la carta (por ejemplo, "Infusiones y Tes", "Sandwiches Especiales" o "Packs de Desayuno"), no puede hacerlo desde la interfaz visual; las secciones estan cableadas en el codigo javascript.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo.

#### Hallazgo 3.3: Gestion del banner promocional y textos de producto
- **Donde esta**: En `Admin.dc.html`, objeto `dzBanner` (con propiedades `on`, `tag`, `title`, `sub`, `toggle`) y modal de edicion `kind === 'ptext'` en `dzSections`. Permite ocultar productos individuales (`dz.hidden[n]`), editar descripciones y sustituir fotos por imagenes redimensionadas en canvas (`readPhoto`).
- **Por que importa para una cafeteria**: Resuelve el requerimiento de visibilidad dinamica de campanas (Iniciativa A-22) sin dejar huecos vacios en la carta publica cuando no hay campana vigente.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el codigo y en el acta.

---

### 2.4. Novedades y Publicidad

#### Hallazgo 4.1: Constructor multimedia de novedades por tarjetas
- **Donde esta**: En `Admin.dc.html`, vista `isNovedades`. Tipos admitidos mediante `newsAddChips`: `promo`, `banner`, `imagen`, `galeria`, `evento`, `video`, `aviso`. Carga con `newsLoad()` y publica mediante `newsPublish` en `writeCfg({ news: this.state.news })`.
- **Por que importa para una cafeteria**: Las cafeterias modernas dependen activamente de redes visuales como Instagram y TikTok para atraer publico joven y familiar. Poder vincular videos de preparacion de café o fotos de eventos en el local enriquece la experiencia del cliente en la carta web.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el codigo.

#### Hallazgo 4.2: Programacion de vigencia temporal y deteccion de plataformas
- **Donde esta**: En `Admin.dc.html`, campos `nDesde`, `nHasta`, `nFecha`, `nLugar` y funcion auxiliar `platformOf(link)`. Muestra estado dinamico de la publicacion (`nsEstado(n)`: vigente, programada, vencida o desactivada).
- **Por que importa para una cafeteria**: Evita que promociones con fecha fija (como una cata de cafe o un taller de reposteria) sigan mostrandose despues de concluidas, ahorrando trabajo manual al administrador.
- **Prioridad**: Baja.
- **Certeza**: CONFIRMADO en el codigo.

---

### 2.5. Destacadas de la Carta

#### Hallazgo 5.1: Formato de historias tipo red social (Momentos Caprichos)
- **Donde esta**: En `Admin.dc.html`, vista `isDestacadas`. Coleccion `hls` cargada con `hlLoad()` y persistida con `hlPublish` (`writeCfg({ highlights: ... })`). Cada destacada permite carátula (`cover`), múltiples imágenes con subtitulo (`cap`), ordenamiento secuencial y botón de activacion/desactivacion.
- **Por que importa para una cafeteria**: Refuerza la identidad artesanal de la marca mostrando el proceso de tostado, elaboracion de donas o momentos de clientes sin redirigir fuera de la carta.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el codigo.

#### Hallazgo 5.2: Riesgo de agotamiento de cuota en almacenamiento local por imagenes en base64
- **Donde esta**: En `Admin.dc.html`, funciones `downscaleN` y advertencia en `hlPublish`: `hlMsg: ok ? 'Publicado en la carta.' : 'No se pudo guardar: el navegador no tiene espacio (usa menos imágenes o más livianas).'`.
- **Por que importa para una cafeteria**: El prototipo codifica imagenes completas en formato data URL Base64 dentro de una sola clave de `localStorage` (cuyo limite estandar es de 5 MB a 10 MB segun navegador). Si el administrador sube 8 o 10 fotos de alta calidad, el almacenamiento colapsa silenciosamente, impidiendo guardar no solo destacadas, sino tambien novedades, horarios y configuraciones del local.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo.

---

### 2.6. Paleta de Colores

#### Hallazgo 6.1: Personalizacion de paletas tematicas y control de contraste
- **Donde esta**: En `Admin.dc.html`, vista `isPaleta`. Constante `PAL_DEFAULT` con 10 estilos festivos (`ninguno`, `halloween`, `navidad`, `anonuevo`, `sanvalentin`, `madre`, `padre`, `patrias`, `ninos`, `aniversario`), evaluacion de luminancia con `hexL(h)` y contraste WCAG con `ratioOf(a, b)`. Publica mediante `palPublish` en `writeCfg({ palettes: s.pal })`.
- **Por que importa para una cafeteria**: Permite adaptar la identidad visual del negocio a festividades de alto consumo sin alterar la estructura del software ni arriesgar legibilidad para personas con dificultades visuales.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el codigo y en el acta.

#### Hallazgo 6.2: Imposibilidad de crear nuevas temporadas personalizadas
- **Donde esta**: En `Admin.dc.html`, `PAL_DEFAULT` tiene claves fijas. No existe opcion para que el administrador cree una temporada nueva (por ejemplo, "Cyber Days", "Verano Artesanal" o "Semana Santa") con colores propios. Solo puede sobreescribir los colores de las 10 festividades predefinidas.
- **Por que importa para una cafeteria**: Limita la autonomia del dueno frente a campanas comerciales locales no contempladas en la lista inicial.
- **Prioridad**: Baja.
- **Certeza**: CONFIRMADO en el codigo.

---

### 2.7. Configuracion del Local (Horarios, Entrega, Redes, Pagos)

#### Hallazgo 7.1: Centralizacion de datos del establecimiento como fuente unica
- **Donde esta**: En `Admin.dc.html`, vista `isMirest` (pestana `mirest` de `titles`), constante `INFO_DEFAULT`, categorias en `INFO_CATS` (`local`, `ubicacion`, `contacto`, `horario`, `redes`, `pagos`, `entrega`, `avisos`, `empresa`). Persistido mediante `infoSave` en `writeCfg({ info: this.state.info })`.
- **Por que importa para una cafeteria**: Consolida la informacion comercial (telefonos, cuentas Yape/Plin, redes sociales, horarios de apertura y cierre) para alimentar simultaneamente la carta web, el chatbot y el panel de caja, evitando discrepancias en precios minimos o canales de atencion.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo.

#### Hallazgo 7.2: Rigidez en la definicion de zonas y tarifas de reparto
- **Donde esta**: En `Admin.dc.html`, `INFO_DEFAULT` y campos de entrega: `tarZ2: '2', tarZ3: '3', tarZ4: '4', tarZ5: '5', tarZ7: '7'`. Los poligonos geograficos residen en `ZONAS_GEO` y las coordenadas del local en `const HEAT_LOCAL = { lat: -12.0147, lng: -76.966 }`.
- **Por que importa para una cafeteria**: Las tarifas de delivery estan ancladas a 5 zonas fijas (Z2, Z3, Z4, Z5, Z7). Si Caprichos decide crear una Zona 1 para reparto a pie gratuito o una Zona 6 para repartos lejanos, o si cambia el local de sede física, el dueno no puede ajustar las coordenadas ni dibujar poligonos; requiere que un programador modifique las constantes matematicas y geometricas del codigo.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo.

#### Hallazgo 7.3: Omision de credenciales Wi-Fi para impresion de tickets
- **Donde esta**: En `Admin.dc.html`, formulario de configuracion del local (`INFO_CATS`). En las actas (Acta 02, minuto 00:27:49, iniciativa B-16), Kevin Rosales solicito expresamente: "imprimir la red y contrasena de Wi-Fi de forma automatica en el comprobante". No existe ningun campo en `INFO_CATS` ni en `info` para ingresar el nombre de red (SSID) ni la contrasena del Wi-Fi de clientes.
- **Por que importa para una cafeteria**: El servicio de Wi-Fi es de primera necesidad para clientes que van a cafeterias a trabajar o estudiar con sus computadoras portatiles. Si el cajero debe dar la clave verbalmente todo el tiempo, se generan colas y perdida de tiempo operativo.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el codigo y en el acta.

---

### 2.8. Usuarios y Permisos por Rol

#### Hallazgo 8.1: Desconexion total entre la tabla visual de usuarios y el sistema de autenticacion
- **Donde esta**: En `Admin.dc.html`, vista `isTable` para `usuarios`. La tabla se alimenta de `TABLES.usuarios.rows` con 12 registros de muestra (`admin01`, `caja01`, etc.). Por otro lado, la logica de roles y permisos del sistema reside en la constante `ROLES` (`admin`, `cajero`, `cocina`, `mozo`, `callcenter`, `almacen`, `produccion`, `repartidor`).
- **Por que importa para una cafeteria**: La tabla de usuarios es un cascaron meramente decorativo. No existe ningun vinculo operativo entre crear o editar un usuario en la tabla y los permisos de acceso al software. El conmutador de roles en cabecera cambia entre las claves de `ROLES`, ignorando las filas de la tabla.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo.

#### Hallazgo 8.2: Ausencia de boton para dar de alta nuevos empleados
- **Donde esta**: En `Admin.dc.html`, vista `isTable`. Mientras que para `clientes` existe el boton `+ Nuevo cliente` (`openNc`), para la vista `usuarios` no existe ningun control que permita crear un nuevo registro de trabajador.
- **Por que importa para una cafeteria**: La rotacion de personal en cafeterias (mozos, baristas o cajeros que entran o renuncian) es constante. El administrador no cuenta con ningun formulario para ingresar un nuevo empleado, registrar su usuario o asignarle contrasena.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo.

#### Hallazgo 8.3: Permisos cableados en codigo y brechas criticas de autorizacion
- **Donde esta**: En `Admin.dc.html`, definicion de `ROLES` y en las funciones de `Component`:
  1. `cajero: { views: [..., 'ofertas', ...], manage: true }`. El rol cajero tiene acceso al modulo de Ofertas y descuentos, y al tener `manage: true` puede abrir "Gestionar listas".
  2. En `crVals` (modulo de Creditos del personal), la funcion `saveCred` (que modifica el porcentaje de descuento del personal del 25% al valor deseado y los dias de plazo) esta expuesta en `isCreditosView` sin validar si el usuario es `admin`. Dado que `cajero` tiene acceso a `creditos`, un cajero puede cambiar libremente la politica de descuento para si mismo o sus companeros.
  3. En `isProductos`, las acciones `p.edit` (modificar precios) y `p.openOpc` (modificar tamanos y precios de opciones) no verifican si `s.role === 'admin'`. Dado que `mozo` tiene `productos` en sus vistas autorizadas, un mozo podria abrir el editor y alterar precios de la carta.
- **Por que importa para una cafeteria**: Compromete la seguridad del negocio y la integridad de ingresos de la caja. En restaurant.pe existen mas de 500 permisos granulares asignables por perfil (`referencia/modulos-usuarios-notificaciones.md`); aqui los accesos estan agrupados en paquetes rigidos y carecen de control de privilegios a nivel de accion especifica.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo.

---

### 2.9. Pantallas de TV

#### Hallazgo 9.1: Discrepancia fundamental entre KDS de cocina y pantallas Smart TV de salon
- **Donde esta**: En `Admin.dc.html`, vista `isPantallas` y `TABLES.pantallas.rows`. La interfaz indica: "Televisores de cocina y barra que solo muestran pedidos. No piden usuario: cada una tiene su propia llave." Las filas listan `TV cocina`, `TV barra` y `TV de prueba`.
- **Por que importa para una cafeteria**: Contradice directamente lo senalado por Kevin Rosales en la reunion (Acta 02, minuto 00:33:09): Kevin aclaro enfaticamente que en cocina NO usan Smart TVs sino computadoras de escritorio dedicadas para cada una de las tres areas (Salados, Postres y Bebidas), mientras que los tres (3) Smart TVs de la cafeteria estan instalados en el SALON de cara al publico comensal para que vean la cola de pedidos (turnero: pedidos por preparar, en preparacion y listos para recoger). El prototipo no tiene ninguna pantalla disenada para proyectar turnos a clientes en el salon.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo y en el acta.

#### Hallazgo 9.2: Vinculacion ficticia de pantallas sin persistencia
- **Donde esta**: En `Admin.dc.html`, funcion `pairLink`: `() => this.setState({ pairMsg: 'Pantalla vinculada con el código ' + s.pairCode.trim() + '. El código ya no sirve. Aparecerá en la lista cuando la TV se conecte.', pairCode: '' })`.
- **Por que importa para una cafeteria**: La vinculacion de una pantalla mediante codigo de 6 caracteres es una simulacion visual que solo actualiza un mensaje de texto. No inserta ningun registro en la tabla de pantallas ni guarda llaves criptograficas en almacenamiento permanente.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el codigo.

---

### 2.10. Plano del Local

#### Hallazgo 10.1: Perdida total de los cambios del plano al recargar el navegador
- **Donde esta**: En `Admin.dc.html`, constructor de `Component`: `this.state = { ..., plan: JSON.parse(JSON.stringify(PLAN_SEED)), pf: 'p1', psel: '', ... }`. Las funciones `setEl` (modificar elemento), `delSel` (eliminar) y colocacion de mesas o paredes solo ejecutan `this.setState({ plan: ... })`. No existe llamada a `writeCfg` ni almacenamiento en `localStorage`.
- **Por que importa para una cafeteria**: Si el dueno invierte tiempo en mapear la distribucion fisica real del local (ubicar la barra, la entrada, los banos y las 8 mesas reales de Caprichos), toda esa diagramacion se borra instantaneamente al recargar el navegador o reiniciar el equipo, retornando a las 14 mesas genericas de `PLAN_SEED`.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo.

#### Hallazgo 10.2: Desconexion entre el plano interactivo y el problema de concurrencia de 30 mesas
- **Donde esta**: En `Admin.dc.html`, evaluacion de `busy` en `orders` y `mesaOv`. En el acta (Acta 02, minutos 00:52:16 a 00:53:44), Kevin detallo que tuvieron que crear artificialmente 30 mesas en restaurant.pe para que los mozos usen del 1 al 8 y caja del 9 al 30, debido a que el sistema fusionaba o sobreescribia pedidos cuando dos usuarios comandaban sobre la misma mesa libre a la vez. En el prototipo, aunque se propone alertar cuando una mesa esta ocupada, la sincronizacion entre terminales es local y depende de pedidos en memoria no compartidos con un servidor backend real.
- **Por que importa para una cafeteria**: En horas punta de salon, dos trabajadores atendiendo a clientes simultaneos pueden perder o mezclar pedidos si no existe un bloqueo optimista en servidor en tiempo real.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo y en el acta.

---

### 2.11. Centro de Notificaciones

#### Hallazgo 11.1: Separacion entre el panel emergente de alertas y la tabla historica
- **Donde esta**: En `Admin.dc.html`, campana de notificaciones con calculo dinamico de prioridad (`PW`, `PN`, `PCOL`, escalado por tiempo `wait >= 30`) frente a la tabla estatica `TABLES.notificaciones.rows` que muestra 10 filas fijas fechadas en "12/10" y "13/10".
- **Por que importa para una cafeteria**: Las alertas que se atienden o generan en la campana (quejas de clientes, pedidos pendientes de confirmacion, roturas de stock) no se registran en la tabla de notificaciones. La tabla es un listado estatico sin busqueda historica real ni conexion con eventos pasados.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el codigo.

#### Hallazgo 11.2: Volatilidad de alertas y quejas de clientes
- **Donde esta**: En `Admin.dc.html`, arreglo `alerts` en `this.state` inicializado con un registro simulado `A-01`. Cuando se pulsa "Marcar atendido", se actualiza unicamente en memoria mediante `setState`.
- **Por que importa para una cafeteria**: Si un cliente envia una queja grave o solicita atencion humana urgente por WhatsApp y la cajera o administrador recargan la pantalla, la alerta vuelve a aparecer como pendiente o se pierde segun el estado inicial, sin bitacora de quien atendio la incidencia.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el codigo.

---

### 2.12. Clientes y Creditos del Personal

#### Hallazgo 12.1: Perdida de nuevos creditos otorgados al personal tras recargar
- **Donde esta**: En `Admin.dc.html`, funcion `crConfirm` vinculada al cobro a credito del personal:
  ```javascript
  const doc = 'CP-P' + String(7 + this.state.credAdded.length).padStart(2, '0');
  this.setOrder(crOrder.id, { paid: true, pay: 'Crédito del personal', total: crCalc.pay, credWho: st.n });
  this.setState({ cr: null, credAdded: [ [ doc, st.n, st.rol, '15/10', crCalc.due, fmt(crCalc.pay), fmt(crCalc.pay), 'Al día', 'Octubre' ] ].concat(this.state.credAdded) });
  ```
  El arreglo `s.credAdded` no se guarda en `writeCfg` ni en `localStorage`. Por el contrario, los abonos a la deuda si se guardan en `s.credPay` con `writeCfg({ credPay: nx })`.
- **Por que importa para una cafeteria**: Si un empleado consume a cuenta (por ejemplo, s/ 40.00 en frapés y donas) y el administrador o cajero registran el pedido a credito, al recargar la pagina la deuda desaparece de la tabla de creditos pendientes (`credAdded` se reinicia a `[]`). Esto ocasiona descuadres financieros en el control de liquidaciones quincenales del personal.
- **Prioridad**: Alta.
- **Certeza**: CONFIRMADO en el codigo.

#### Hallazgo 12.2: Contradiccion en el alcance del credito (personal vs clientes)
- **Donde esta**: En `Admin.dc.html`, pestana `creditos` de `TABLES` y nota de cabecera: "Solo el personal compra a crédito; a los clientes no se les da crédito (acta 02)". Sin embargo, en el Acta 02 (minutos 01:05:24), Kevin Rosales indico expresamente: "No, no, ponle para todos en realidad ponle para todos. O sea, ahi incluimos al trabajador... ellos tienen que tener su usuario, tienen que loguearse... la compra la van a hacer con su usuario como un cliente".
- **Por que importa para una cafeteria**: Kevin solicito mantener abierta la posibilidad arquitectonica de otorgar creditos o cuentas corrientes comerciales (como permite restaurant.pe), aunque en el dia a dia solo se use para el equipo. El prototipo bloquea a nivel de diseno y logica el modulo exclusivamente para el personal predefinido en `STAFF`.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el codigo y en el acta.

#### Hallazgo 12.3: Inflexibilidad en el registro rapido de clientes frente a lo pedido por Kevin
- **Donde esta**: En `Admin.dc.html`, modal de nuevo cliente `kind === 'table'` para `clientes`. Solicita DNI, Nombre, Telefono, Correo, Cumpleanos, etc.
- **Por que importa para una cafeteria**: En el Acta 02 (minutos 00:44:29 a 00:46:53, iniciativas B-35 y C-01), Kevin explico que al tomar un pedido asistido por llamada o WhatsApp, el formulario rapido de alta debe exigir UNICAMENTE dos datos indispensables con asterisco: Nombre y Telefono, permitiendo pasar de inmediato a la direccion y toma de pedido para no perder tiempo al telefono con el cliente.
- **Prioridad**: Media.
- **Certeza**: CONFIRMADO en el codigo y en el acta.

---

## 3. Ejes Transversales de Deficiencia Tecnica

### 3.1. Que No se Puede Cambiar sin Programador (Hardcoded)

| Componente | Elemento Afectado | Justificacion Tecnica | Certeza | Prioridad |
| :--- | :--- | :--- | :--- | :--- |
| **Catalogo de Productos** | Creacion de platos y bebidas | `PRODUCTS` se autogenera desde la lista rigida `MCAT`. No hay interfaz ni contrato de alta. | CONFIRMADO en codigo | Alta |
| **Estructura de Secciones** | Categorias de la carta digital | `CARTA_CATS` y `CHIP_NAMES` son arreglos estaticos en codigo. | CONFIRMADO en codigo | Alta |
| **Georreferenciacion** | Coordenadas de la tienda y poligonos | `HEAT_LOCAL` (-12.0147, -76.966) y `ZONAS_GEO` estan fijados en JS. | CONFIRMADO en codigo | Alta |
| **Zonas de Entrega** | Claves de tarifa de delivery | Ancladas a 5 campos fijos (`tarZ2`, `tarZ3`, `tarZ4`, `tarZ5`, `tarZ7`). No se pueden anadir mas zonas. | CONFIRMADO en codigo | Alta |
| **Usuarios del Sistema** | Altas y perfiles de empleados | `TABLES.usuarios` y `ROLES` no tienen mecanismo de adicion ni configuracion de claves. | CONFIRMADO en codigo | Alta |
| **Temporadas Visuales** | Temas festivos de paleta | `PAL_DEFAULT` solo admite las 10 festividades preprogramadas. | CONFIRMADO en codigo | Media |
| **Impresoras de Barra** | Direcciones IP y puertos | `LBL_PRINTER` tiene direcciones IP locales fijas (ej. `192.168.1.210`). | CONFIRMADO en codigo | Media |

### 3.2. Datos Fijos que Deberian Ser Configurables

1. **Credenciales Wi-Fi**: Nombre de red y clave para emision de comanda/ticket al cliente (solicitado expresamente por Kevin en Acta 02, minuto 00:27:49).
2. **Series y Correlativos de Comprobantes**: Actualmente genera codigos genericos sin series fiscales ni configuracion de contingencia SUNAT.
3. **Numero de Sucursal y Cajas**: El local esta cableado a `CAPRICHOS` y `caja01`; no es configurable para una segunda sede.
4. **Umbrales de Alerta de Stock**: El calculo de stock bajo usa factores y minimos fijos en `SUPPLIES`, requiriendo un editor integral por almacenero o dueno.
5. **Direcciones IP de Dispositivos**: Las etiqueteras y pantallas KDS deben permitir configurar IP, mascara y puerto desde la interfaz sin tocar scripts.

### 3.3. Cosas que se Pierden al Recargar el Navegador (Falta de Persistencia)

| Modulo / Estado | Variable Afectada | Mecanismo Actual | Consecuencia Operativa |
| :--- | :--- | :--- | :--- |
| **Plano del Local** | `s.plan`, `s.floors` | En memoria (`setState`) | Se borran paredes, barras y distribucion de mesas dibujadas por el usuario. |
| **Edicion de Productos** | `s.pover` | En memoria (`setState`) | Los cambios de categoria y precio hechos en la vista Productos desaparecen. |
| **Categorias Creadas** | `s.lists.categorias` | En memoria (`setState`) | Nuevas categorias creadas en "Gestionar listas" no se guardan en `writeCfg`. |
| **Edicion de Usuarios** | `s.tedits`, `s.tinactive` | En memoria (`setState`) | Cambios de nombre, cargo, perfil o desactivacion de personal se pierden. |
| **Creditos Otorgados** | `s.credAdded` | En memoria (`setState`) | Las compras a credito de los empleados desaparecen; solo persisten los abonos. |
| **Vinculacion de TVs** | `s.pairCode`, `pairMsg` | En memoria (`setState`) | No se registra ninguna pantalla nueva en la base de datos local. |
| **Movimientos Almacen** | `s.movAdded`, `s.tedits` | En memoria (`setState`) | Movimientos internos no guardados en compras se pierden al refrescar. |

### 3.4. Permisos Mal Puestos y Riesgos de Seguridad

1. **Acceso de Cajero a Configuracion de Credito**: El rol `cajero` tiene acceso al modulo `creditos` y puede alterar el porcentaje de descuento del personal (`credPct`) y el plazo de vencimiento (`credDays`), facultad que debe ser exclusiva de Gerencia/Administracion.
2. **Acceso de Cajero a Modulo de Ofertas**: El rol `cajero` puede entrar a `ofertas` y editar o crear promociones, descuentos por volumen y reglas de aplicacion.
3. **Acceso de Mozo a Modificacion de Productos**: El rol `mozo` cuenta con la vista `productos` activa para consulta de carta, pero la interfaz le permite ejecutar `p.edit` y `p.openOpc`, exponiendo la carta a modificaciones involuntarias de precios por parte del personal de sala.
4. **Flag `manage: true` en Roles Operativos**: Los roles `cajero` y `produccion` tienen activado el indicador `manage: true`, permitiendoles interactuar con la manipulacion estructural de listas.

### 3.5. Falta de Historial o Auditoria de Cambios

1. **Ausencia de Trazabilidad en Modificaciones de Precios**: No existe registro historico de cuando vario el precio de un frapé o sandwich, quien efectuo el cambio ni que valor tenia antes.
2. **Ausencia de Bitacora en Disponibilidad (Agotados)**: Marcar un producto como agotado o reactivarlo no deja constancia de fecha, hora ni usuario responsable.
3. **Bitacora Parcial Limitada a Cupones**: Unicamente el gestor de cupones implementa `couponLog`; las demas entidades criticas (promociones, horarios, empleados, permisos) carecen de bitacora.
4. **Falta de Auditoria en Datos de Clientes y Puntos**: Modificar puntos o telefonos de clientes no genera registro de auditoria para prevenir fraude en canjes.

---

## 4. Que Falta para que el Dueno Administre Solo

Para que Kevin Rosales pueda prescindir completamente del soporte continuo de un programador en la operacion cotidiana de Caprichos, el sistema administrativo debe incorporar:

1. **CRUD Integral y Autonomo de Catalogo**:
   - Boton funcional `+ Nuevo Producto` con selector de categoria, precio regular, precio con descuento, descripcion, tiempo estimado de preparacion y carga directa de fotografia con recorte automatico.
   - Posibilidad de crear, editar, reordenar y eliminar categorias comerciales que se reflejen de inmediato y en cascada en la carta web, el POS y el modulo de diseno.
2. **Constructor Visual de Zonas de Reparto**:
   - Integracion de un mapa interactivo (mediante Leaflet o Google Maps) donde el dueno pueda dibujar poligonos de reparto haciendo clics sobre las avenidas de San Juan de Lurigancho y asignar una tarifa en soles a cada poligono creado.
3. **Gestion Real de Usuarios, Roles y Credenciales**:
   - Formulario de alta rapida de trabajadores con asignacion de PIN de 4 digitos para caja/mozo, seleccion de rol predefinido y matriz visual de permisos (checkboxes) para activar o desactivar modulos por usuario.
4. **Persistencia Centralizada en Base de Datos**:
   - Sustitucion de la persistencia volatil en `localStorage` del navegador por llamadas a una API backend conectada a base de datos relacional (PostgreSQL / SQLite persistido), garantizando que las modificaciones del plano, precios, categorias y creditos sean compartidas en tiempo real entre todas las terminales del local.
5. **Modulo de Pantallas de Salon (Turnero Publico)**:
   - Crear la interfaz especifica para los 3 Smart TVs del salon principal, mostrando en letras grandes y contrastadas los pedidos "En preparacion" y "Listos para recoger" segun el ticket del cliente, diferenciando esta vista del KDS operativo interno de cocina.
6. **Configuracion de Impresoras y Tickets**:
   - Campos administrativos para definir el encabezado y pie del comprobante fiscal o nota de venta, incluyendo la red Wi-Fi y contrasena para clientes, y selector de impresoras detectadas en la red local.

---

## 5. Cuadro Consolidado de Hallazgos y Prioridades

| # | Modulo / Area | Descripcion Sintetica del Hallazgo | Prioridad | Certeza |
| :-: | :--- | :--- | :---: | :---: |
| 1 | Productos | No existe opcion para dar de alta nuevos productos en el catalogo | Alta | CONFIRMADO en codigo |
| 2 | Productos | El nombre del producto esta bloqueado y la edicion de precios no persiste | Alta | CONFIRMADO en codigo |
| 3 | Plano del local | La distribucion de mesas, paredes y barras se borra al recargar la pagina | Alta | CONFIRMADO en codigo |
| 4 | Creditos | Nuevos consumos a credito del personal se pierden tras recargar el navegador | Alta | CONFIRMADO en codigo |
| 5 | Usuarios | Tabla de usuarios desconectada de roles; no hay altas de trabajadores | Alta | CONFIRMADO en codigo |
| 6 | Permisos | Cajero puede modificar el % de descuento y dias de credito del personal | Alta | CONFIRMADO en codigo |
| 7 | Pantallas | Prototipo enfocado en KDS para TV; faltan pantallas de pedidos para salon | Alta | CONFIRMADO en codigo y acta |
| 8 | Entrega | Coordenadas y tarifas de zonas (Z2-Z7) cableadas sin editor geografico | Alta | CONFIRMADO en codigo |
| 9 | Diseno | Categorias de la carta bloqueadas en arreglo estatico | Alta | CONFIRMADO en codigo |
| 10 | Almacenamiento | Riesgo de desbordamiento de cuota `localStorage` por imagenes Base64 | Alta | CONFIRMADO en codigo |
| 11 | Ofertas | Constructor de combos y descuentos implementado pero sin log de auditoria | Media | CONFIRMADO en codigo |
| 12 | Configuracion | Falta campo para configurar clave Wi-Fi para impresion en voucher | Media | CONFIRMADO en codigo y acta |
| 13 | Notificaciones | Desconexion entre campana de alertas activas y tabla historica de avisos | Media | CONFIRMADO en codigo |
| 14 | Creditos | Contradiccion en alcance de credito: restringido a personal vs clientes | Media | CONFIRMADO en codigo y acta |
| 15 | Paleta | Limitado a 10 temporadas predeterminadas sin opcion de crear nuevas | Baja | CONFIRMADO en codigo |

INFORME LISTO

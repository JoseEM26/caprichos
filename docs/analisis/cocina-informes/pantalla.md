---
id: ANA-CAP-024
tipo: analisis
titulo: "Informe Tecnico: Evaluacion Integral de la Pantalla de Cocina (KDS) y el Flujo de Pedidos en Caprichos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, cocina-informes]
---

# Informe Tecnico: Evaluacion Integral de la Pantalla de Cocina (KDS) y el Flujo de Pedidos en Caprichos

## 1. Resumen Ejecutivo y Marco de Referencia

El presente documento analiza exhaustivamente el diseno, arquitectura tecnica, experiencia de usuario y reglas operativas de la pantalla de Cocina (Kitchen Display System - KDS) y el flujo de pedidos en el prototipo del sistema administrativo para la cafeteria artesanal Caprichos (Lima), materializado en el archivo `fuente/Admin.dc.html` (version v96), confrontandolo con las actas de descubrimiento con el cliente Kevin Rosales (`acta-01-descubrimiento.md`, `acta-02-descubrimiento.md`, `iniciativas-acta-02.md`), la documentacion funcional interna (`BRD.md`, `pantalla-cocina.md`, `flujo-de-pedidos.md`, `impresion-tickets.md`, `modulos-y-roles.md`) y la referencia del sistema anterior restaurant.pe (`referencia/`).

Caprichos enfrenta un reto critico de negocio: reducir el tiempo de atencion y despacho de 20-25 minutos a una meta maxima de 13 minutos por pedido, evitando la saturacion visual de los operarios, facilitando la manipulacion sin contacto continuo y resolviendo la segmentacion de productos y combos por estacion de trabajo (Bebidas, Postres y Salados).

El analisis identifica fortalezas notables ya incorporadas en el codigo, pero tambien omisiones criticas que pondrian en riesgo la operacion real del salon y despacho.

---

## 2. Evaluacion Detallada de Capacidades del Rol Cocina y Pantalla KDS

### 2.1 Ver Pedidos en Cola
- **CONFIRMADO en el codigo o en el acta**: 
  - En `fuente/Admin.dc.html` (lineas 3694-3706 y 466-495), la funcion `kcol` genera la columna "NUEVOS" filtrando pedidos con estado `cola` (`o.status === 'cola'`).
  - Un pedido entra en estado `cola` de dos formas confirmadas:
    1. Si es pedido en salon tomado por mozo (`modal === 'local'`), pasa directo a `cola` al guardarse (linea 3861).
    2. Si es pedido fuera de local (Web, WhatsApp, Delivery o Llevar), entra en `nuevo` ("Por confirmar") y solo pasa a `cola` cuando un usuario autorizado confirma el pedido y pago (`acceptOrder`, linea 3095).
- **Hallazgo y Limitacion**: 
  - (a) Ubicacion: `Admin.dc.html`, lineas 3702-3706.
  - (b) Impacto en cafeteria: Los pedidos de salon ingresan de inmediato sin friccion de caja, cumpliendo el flujo acordado el 18/10/2026. Sin embargo, no hay distincion visual en la tarjeta entre un pedido que recien ingreso hace 30 segundos y uno que lleva 5 minutos esperando inicio de preparacion, mas alla del numero de minutos transcurridos.
  - (c) Prioridad: Media.

### 2.2 Empezar a Preparar
- **CONFIRMADO en el codigo o en el acta**: 
  - En `Admin.dc.html` (lineas 488-490 y 3699), cada tarjeta en la columna "NUEVOS" muestra el boton "Empezar a preparar", el cual ejecuta:
    `ask('¿Empezar a preparar?', 'Pedido ' + o.id + '.', () => this.setOrder(o.id, { status: 'prep' }))`.
- **Hallazgo y Limitacion**: 
  - (a) Ubicacion: `Admin.dc.html`, lineas 3131, 3699 y 2289-2299.
  - (b) Impacto en cafeteria: 
    1. Friccion de confirmacion modal: Cada pulsacion de "Empezar a preparar" dispara un dialogo modal bloqueante a pantalla completa (`isConfirm`, `z-index: 90`) con botones "Si" y "No". En hora punta, con baristas y cocineros con guantes o manos humedas, obligar a confirmar cada avance con un modal centralizado ralentiza la operacion y contradice el Acta 02 (00:42:00), donde Kevin solicita un solo toque directo sin maniobras complejas.
    2. Cambio de estado global destructivo: La llamada `this.setOrder(o.id, { status: 'prep' })` cambia el estado de TODO el pedido en la base de datos general. Si un pedido contiene un Sandwich (Salados) y un Frappe (Bebidas), y el barista pulsa "Empezar a preparar", el pedido completo pasa a preparacion en todas las pantallas, eliminando la trazabilidad del inicio real de cada estacion.
  - (c) Prioridad: Alta.

### 2.3 Marcar Listo y Despeje de Pedidos
- **CONFIRMADO en el codigo o en el acta**: 
  - En `Admin.dc.html` (lineas 3704 y 512), las tarjetas en la columna "EN PREPARACION" muestran el boton "Marcar listo", el cual ejecuta `this.setOrder(o.id, { status: 'listo' })` previa confirmacion con `ask()`.
  - En la columna "LISTOS" (linea 3705): `kcol('LISTOS', (x) => x === 'listo', '', 'listo')`. La etiqueta de accion es una cadena vacia `''`, por lo que `hasAction` es `false`.
- **Hallazgo y Limitacion**: 
  - (a) Ubicacion: `Admin.dc.html`, linea 3705 y plantilla lineas 488-490.
  - (b) Impacto en cafeteria: 
    1. Imposibilidad de despejar comandas: En la columna "LISTOS", la pantalla de cocina NO TIENE BOTON ALGUNO para que el cocinero despeje, archive o retire el pedido de su vista. Las comandas terminadas permanecen acumuladas indefinidamente hasta que Caja o el Repartidor cambien el pedido a "entregado" o "ruta". Esto repite exactamente el problema que Kevin denuncio en Acta 02 (00:40:50, evidencia B-31 y 00:42:00, evidencia B-32), donde se quejo de que en restaurant.pe las comandas listas se quedaban atascadas en pantalla saturando visualmente el espacio de trabajo.
    2. Cierre prematuro de pedidos compuestos: Si el barista marca listo el cafe a los 3 minutos, el pedido entero pasa a `listo`. Si es un delivery, aparece de inmediato como "Disponible" para que el repartidor se lo lleve en `Repartos` (linea 3715), aunque el sandwich caliente de cocina aun este crudo en la plancha.
  - (c) Prioridad: Alta.

### 2.4 Ver Tiempos y Semaforo de Atraso (Meta 13 Minutos)
- **CONFIRMADO en el codigo o en el acta**: 
  - En `Admin.dc.html` (lineas 3698, 481, 510): Cada comanda incluye una insignia circular con el tiempo transcurrido en minutos (`o.mins + ' min'`).
  - Semaforo cromatico de alerta:
    - 0 a 7 minutos: fondo beige neutro (`#E3D6C6`), texto azul marino (`#0B2C3E`).
    - 8 a 12 minutos: fondo mostaza preventiva (`#D99E39`), texto azul marino (`#0B2C3E`).
    - 13 minutos a mas: fondo terracota de urgencia (`#B2500F`), texto blanco (`#FFFFFF`).
  - Coincide con la iniciativa de negocio de reducir tiempos y alertar al llegar al umbral de 13 minutos (confirmado en `recursos/README.md` y `BRD.md`).
  - En el Escritorio de Cocina (lineas 3338-3341), se muestran los indicadores clave: "Nuevos en cocina", "Preparando", "Atrasados (13 min o mas)" y "Tiempo promedio en cocina (meta 13)".
- **Hallazgo y Limitacion**: 
  - (a) Ubicacion: `Admin.dc.html`, linea 4411 (`addMinutes`).
  - (b) Impacto en cafeteria: En el prototipo actual, los minutos no corren en tiempo real mediante un temporizador periodico (`setInterval` o diferencia de marcas de tiempo UTC). Unicamente avanzan cuando un usuario hace clic en el boton manual de pruebas "Simular +3 minutos". En produccion real debe implementarse el cronometro vinculado a la hora de envio de la comanda (`t0`).
  - (c) Prioridad: Media (naturaleza de prototipo, indispensable en software productivo).

### 2.5 Filtrar por Area de Produccion (Bebidas, Postres, Salados)
- **CONFIRMADO en el codigo o en el acta**: 
  - En `Admin.dc.html` (lineas 2605 y 3701): Se configuran los botones de filtro `kareaChips`: "Todas", "Bebidas", "Postres", "Salados".
  - Funcion clasificadora `AREA_OF(name)`:
    - `Bebidas`: frappes, iced, calientes, frozen.
    - `Salados`: salados, croissants.
    - `Postres`: waffles, complementos / reposteria.
  - Al seleccionar un chip, la pantalla KDS solo lista los productos correspondientes a esa estacion.
- **Hallazgo y Limitacion**: 
  - (a) Ubicacion: `Admin.dc.html`, lineas 3057 vs 3701.
  - (b) Impacto en cafeteria: 
    1. Incoherencia terminologica: En la configuracion del modulo "Pantallas" (linea 3057), las opciones son "Cocina y barra", "Solo barra", "Solo cocina". En cambio, en la pantalla de cocina los filtros reales son "Bebidas", "Postres", "Salados". En el Acta 02 (00:33:09, B-24), Kevin establecio con total claridad que las tres areas fisicas son: 1) Salados, 2) Postres y 3) Bebidas. El modulo administrativo hereda terminos genericos de restaurant.pe en lugar de respetar la arquitectura fisica real de Caprichos.
    2. Falta de persistencia por dispositivo: Si el cocinero de Salados refresca la pantalla o ingresa al sistema, el estado por defecto vuelve a `todas`. Cada estacion fisica de computo debe arrancar anclada a su estacion sin depender de seleccion manual en cada inicio de turno.
  - (c) Prioridad: Alta.

### 2.6 Ver Notas del Cliente y Opciones del Producto
- **CONFIRMADO en el codigo o en el acta**: 
  - En `Admin.dc.html` (lineas 484-487): En la vista normal de cocina, cada producto muestra su cantidad (`it.q`), nombre (`it.n`) y modificadores elegidos (`it.d`: tamano, tipo de leche, endulzante, temperatura). Debajo se muestra la nota del cliente: `<sc-if value="{{k.hasNote}}"><div style="...">Nota: {{k.note}}</div></sc-if>`.
- **Hallazgo y Limitacion**: 
  - (a) Ubicacion: `Admin.dc.html`, lineas 509-514 (`isKfull`).
  - (b) Impacto en cafeteria: 
    1. Omision critica en pantalla completa: En la vista `isKfull` ("Pantalla completa, sin desplazar"), la plantilla OMITIO el bloque `hasNote` / `note`. El cocinero que use la pantalla completa no puede leer advertencias vitales (ej. "Sin hielo", "Alergico al mani", "Sin mayonesa", "Bien caliente").
    2. Falta de notas por producto individual: Las notas en salon se consolidan en una sola cadena de texto global al final del pedido. Si una mesa pide dos cafes y uno es "con leche de almendras tibia" y el otro "hirviendo", la nota no queda asociada explicitamente a la linea respectiva dentro de la comanda de cocina.
  - (c) Prioridad: Alta.

### 2.7 Ver Combos Expandidos en sus Partes
- **CONFIRMADO en el codigo o en el acta**: 
  - En `Admin.dc.html` (lineas 2627-2662): Se implementan las funciones `expandCombo`, `expandPromo` y `areaParts`.
  - Los combos (como el "Duo para Compartir") se desglosan en sus partes constitutivas: las bebidas van a la pantalla de Bebidas y los complementos (waffles, donas, galletas) van a Postres o Salados.
  - Cada componente desglosado se marca con la leyenda explicativa: `[Nombre] (parte de [Combo])`.
  - Si un producto de combo se encuentra agotado, el sistema aplica la regla de reemplazo inteligente: `en lugar de [Original] (agotado)`. Si no se especifico sabor, indica `sabor por confirmar con el cliente`.
  - Esta implementacion soluciona exitosamente el reclamo de Kevin Rosales contra restaurant.pe expuesto en Acta 02 (00:34:01, iniciativa B-25), donde denuncio que restaurant.pe saturaba la barra con queques o la cocina con cafes porque no sabia partir los combos.
- **Hallazgo y Limitacion**: 
  - (a) Ubicacion: `Admin.dc.html`, lineas 2630-2655.
  - (b) Impacto en cafeteria: 
    1. Perdida de modificadores en la expansion: En `expandPromo` (linea 2653), la expresion regular que captura opciones solo busca `leche|dulzor|toppings`. Cualquier personalizacion adicional (tamano 16 oz, cremas, salsas o jarabes extras) se elimina durante el desglose. En `expandCombo` (linea 2630), ni siquiera se transfiere la variable de descripcion `d` en productos elegidos fijos o por slots, provocando que los productos de combos lleguen a cocina "desnudos" sin sus especificaciones.
  - (c) Prioridad: Alta.

### 2.8 Rechazar o Avisar un Problema (Falta de Insumo / Producto Agotado)
- **CONFIRMADO en el codigo o en el acta**: 
  - En `Admin.dc.html`: El rol Cocina (`cocina`, linea 2992) NO TIENE PERMISOS sobre el modulo `productos` ni `caja` (`views: ['escritorio', 'cocina', 'stock', 'notificaciones']`).
  - Dentro de la vista de Cocina (`isCocina` e `isKfull`, lineas 466-520), NO EXISTE ningun boton de "Agotar producto", "Rechazar pedido" o "Avisar problema a mozo/caja".
  - En `fuente/pantalla-cocina.md` (seccion 1, linea 10 y seccion 2, linea 14), se estipulo explicitamente: "El cocinero pulsa para empezar a preparar, marcar listo o agotar un producto".
  - En `referencia/productos.md` (linea 15): restaurant.pe disponia de "Administrar Disponibilidad Operativa (Agotados)" para marcar platos agotados con politicas de vigencia (solo hoy, una semana, indefinido).
- **Hallazgo y Limitacion**: 
  - (a) Ubicacion: `Admin.dc.html`, lineas 466-520 y 2992.
  - (b) Impacto en cafeteria: Si en plena elaboracion el barista descubre que se agoto la pulpa de lucuma (caso real narrado por Kevin en Acta 02, 00:39:36) o no hay pan de molde para el Club Sandwich, el cocinero queda completamente incomunicado en el sistema: no puede alertar a salon, no puede devolver la comanda y no puede marcar el producto como agotado. Tiene que dejar su puesto, abandonar la cocina fisica y avisar verbalmente al cajero o al mozo.
  - (c) Prioridad: Alta.

### 2.9 Recibir Aviso de Pedido Nuevo (Timbre / Sonido / Notificacion)
- **CONFIRMADO en el codigo o en el acta**: 
  - En `Admin.dc.html`: NO EXISTE ninguna instruccion de audio (`AudioContext`, etiqueta `<audio>` ni llamadas a sonidos sintetizados).
  - En la generacion de notificaciones (`Admin.dc.html`, lineas 3951-3965), la campana solo emite avisos de pedidos por confirmar (`acc`) para roles `admin`, `cajero`, `callcenter`, `mozo`. Para el rol `cocina` SOLO se generan alertas de falta de internet (`net`), insumos bajo el minimo (`stk`) y error de impresora (`prt`).
  - No existe notificacion interna cuando un pedido ingresa al estado `cola`.
  - En `fuente/pantalla-cocina.md` (lineas 8 y 50) y `referencia/modulos-descripcion.md`: Se exige que al ingresar una comanda suene un timbre sonoro de aviso.
- **Hallazgo y Limitacion**: 
  - (a) Ubicacion: `Admin.dc.html`, lineas 3951-3965.
  - (b) Impacto en cafeteria: En un entorno ruidoso de cocina con licuadoras de frappé, molinos de café y campana extractora funcionando, el personal no mira continuamente la pantalla. Sin una alerta sonora (timbre) o campanilla automatica al llegar una comanda a `cola`, los pedidos nuevos pasan desapercibidos durante varios minutos, consumiendo inutilmente la meta de 13 minutos antes de iniciar la preparacion.
  - (c) Prioridad: Alta.

### 2.10 Ver Pedidos del Mozo de Mesa y Asignacion de Mesa
- **CONFIRMADO en el codigo o en el acta**: 
  - En `Admin.dc.html`: Los pedidos de mozo entran con canal "Mozo" y modalidad `local`.
  - En la vista `isCocina` (linea 483), se imprime el encabezado: `{{k.modalName}} · {{k.canal}}` (ejemplo: "En mesa · Mozo · mozo Luis").
- **Hallazgo y Limitacion**: 
  - (a) Ubicacion: `Admin.dc.html`, linea 3697 (`kcol`) y linea 483.
  - (b) Impacto en cafeteria: 
    1. Desaparicion del numero de mesa en cocina: La variable `o.mesa` (ejemplo: "M07" o "Mesa 7") NUNCA se inyecta en el objeto que retorna `kcol` (linea 3697). Por ende, el ticket de cocina dice "En mesa · Mozo · mozo Luis", pero OMITE el numero de mesa. El personal de cocina no tiene como saber a que mesa entregar el pedido.
    2. Omision total en pantalla completa: En `isKfull` (lineas 509-514), no se renderiza ni la modalidad, ni el canal, ni el mozo, ni la mesa.
  - (c) Prioridad: Alta.

### 2.11 Ver Pedidos Para Llevar y Delivery
- **CONFIRMADO en el codigo o en el acta**: 
  - En `Admin.dc.html`: Los pedidos para llevar (`modal === 'llevar'`) y de delivery (`modal === 'delivery'`) aparecen en la cola de cocina una vez confirmados por el personal de atencion.
  - En `isCocina` (linea 483), se muestra la leyenda descriptiva: `Para llevar · WhatsApp` o `Delivery · Web`.
- **Hallazgo y Limitacion**: 
  - (a) Ubicacion: `Admin.dc.html`, linea 483 y lineas 509-514.
  - (b) Impacto en cafeteria: 
    1. Ausencia de distincion visual de empaque: Para una cafeteria, el empaque es radicalmente diferente segun la modalidad: un cafe para salon se sirve en taza de porcelana o ceramica; uno para llevar requiere vaso polipapel con faja y tapa plana; uno de delivery requiere faja de seguridad, precinto antiderrame y bolsa sellada. En la pantalla de cocina no hay colores de fondo, bordes ni iconos que distingan de un golpe de vista si el producto se prepara para salon, empaque de recojo o delivery.
    2. En `isKfull` se oculta toda referencia a si el producto es delivery o llevar.
  - (c) Prioridad: Media.

### 2.12 Pantalla de TV Vinculada vs Computadoras de Produccion
- **CONFIRMADO en el codigo o en el acta**: 
  - En `fuente/Admin.dc.html` (lineas 1249-1258 y 4399-4400), existe la pantalla administrativa "Pantallas" para vincular un dispositivo con codigo alfanumerico de 6 digitos.
  - En `pantalla-cocina.md` (seccion 3), se propuso una arquitectura con URL publica de solo lectura (`/pantalla/<codigo>`), con sesion permanente que no expira y sin botones interactivos.
  - En Acta 02 (00:33:09, iniciativa B-23 y B-42), Kevin aclaró que los 3 Smart TVs estan en el salon principal para avisos a clientes, mientras que en la cocina y barra operan con computadoras fijas dedicadas por estacion.
- **Hallazgo y Limitacion**: 
  - (a) Ubicacion: `Admin.dc.html`, lineas 498-520 (`isKfull`).
  - (b) Impacto en cafeteria: 
    1. Contradiccion de diseno en `isKfull`: La vista a pantalla completa no es una URL independiente de solo lectura, sino un modal dentro de la aplicacion que requiere sesion autenticada de usuario (que puede caducar) y CONTIENE BOTONES DE ACCION (`k.act`), violando el principio de que los Smart TVs no deben ser operados con cursor ni ser manipulados.
    2. Omision de la pantalla de salon para clientes: No se diseno la vista KDS de cara al cliente (comensales esperando su numero de orden en las 3 Smart TVs del salon principal).
  - (c) Prioridad: Alta.

### 2.13 Impresion y Reimpresion de Comandas y Etiquetas Adhesivas
- **CONFIRMADO en el codigo o en el acta**: 
  - En `Admin.dc.html` (lineas 2663-2669 y 3666-3675): Se incorporo el generador de etiquetas adhesivas `lblBuild` que estructura: 1) Etiqueta general del pedido, 2) Etiquetas por area de produccion, y 3) Etiquetas individuales por vaso de bebida para adherir al vaso, satisfaciendo el requerimiento tipo Starbucks solicitado por Kevin en Acta 02 (00:29:47, iniciativas B-19 y B-40).
  - Se definen direcciones IP locales para impresoras: ticketera de cocina (192.168.1.201), etiquetera de caja (192.168.1.210), etiquetera de bebidas (192.168.1.211), etiquetera de salados (192.168.1.212) y etiquetera de postres (192.168.1.213).
- **Hallazgo y Limitacion**: 
  - (a) Ubicacion: `Admin.dc.html`, lineas 3674-3675 y 3689 (`canManage`).
  - (b) Impacto en cafeteria: Bloqueo de reimpresion para Cocina. Los controles para reimprimir etiquetas (`reprintLbGeneral`, `reprintLbAreas`, `reprintLbCups`) y reimprimir comandas de cocina (`reprintSel`) estan condicionados estrictamente a `canManage` y unicamente son accesibles dentro del modulo `Pedidos y caja` (`isCaja`). Como el rol `cocina` no tiene acceso a Caja ni permisos de administracion, si la ticketera de cocina atasca papel o la etiquetera de barra arruga un sticker, el cocinero o barista NO PUEDE REIMPRIMIR desde su pantalla de cocina.
  - (c) Prioridad: Alta.

---

## 3. Comparativa con Restaurant.pe y Documentos de Especificacion

| Criterio Funcional | Restaurant.pe (Observado en Referencia) | Especificacion Caprichos (`pantalla-cocina.md` / Actas) | Implementacion en Mockup (`Admin.dc.html`) | Estado de Evaluacion |
| :--- | :--- | :--- | :--- | :--- |
| **Arquitectura de KDS** | Pagina web (`#!/ventas/ver-pedidos/estado`) accesible tras inicio de sesion. Sufrio inestabilidad en app de escritorio previa. | URL de solo lectura con llave propia para TV, mas interfaz KDS en PCs de estacion. | Modal `isKfull` dentro del admin que requiere login; no existe URL publica desacoplada. | Deficiente frente a especificacion |
| **Desglose de Combos** | Rigido. No permite partir componentes entre estaciones; el combo completo se asigna a un solo area. | Requisito indispensable: partir el "Duo para Compartir" entre Bebidas, Postres y Salados. | Resuelto mediante `areaParts` y `expandPromo`. Asigna partes a cada area con etiqueta aclaratoria. | Cumplido (con perdida de modificadores en slots) |
| **Navegacion sin Scroll** | Requiere desplazamiento vertical con scrollbar, criticado duramente por Kevin. | Pantalla completa con maximo 3 tarjetas por columna y sin necesidad de scroll. | Cumplido en `isKfull` (`KMAX = 3`), pero trunca con "+N mas" sin permitir paginacion tactil. | Cumplido parcialmente |
| **Alertas Sonoras (Timbre)** | Soporte nativo de timbre al recibir comanda en tiempo real. | Timbre obligatorio al entrar comanda a cocina para alertar al personal. | Inexistente. No hay audio ni sintetizador de sonido en el prototipo. | No implementado |
| **Acciones sobre Pedidos** | Botones para empezar a preparar, marcar listo y agotar producto. | Marcar preparacion, listo, despejar comanda y marcar insumo agotado. | Botones de preparacion y listo con modal bloqueante `ask()`. No hay despeje de listos ni agotados. | Incompleto y con friccion de UX |
| **Reimpresion de Tickets** | Servicio de impresion local (`ServicioV5.msi`) con reimpresion desde comandero. | Reimpresion automatica y manual ante atascos; soporte de stickers para vasos. | Generador de stickers excelente, pero reimpresion bloqueada para el rol Cocina. | Bloqueo de permisos |
| **Manejo de Tiempos** | Semáforo: azul, naranja (15 min) y rojo (20 min). | Meta estricta de 13 minutos. Cambios de color progresivos. | Semaforo en beige (<8m), mostaza (8-12m) y terracota (>=13m). Indicador en KPI de escritorio. | Cumplido en diseno visual |

---

## 4. Fallas de Usabilidad en Tabletas Tactiles y Celulares

Analizando la hoja de estilos en linea y la disposicion de elementos para dispositivos moviles y tabletas operativas en cocina (`fuente/Admin.dc.html`), se evidencian fallas de usabilidad criticas:

### 4.1 Tipografia Diminuta en Entornos de Cocina
- **Hallazgo**: 
  - Las especificaciones y modificadores de los platos (`it.d`) se renderizan con `font-size: 12px` (linea 485).
  - Los badges de area de produccion utilizan `font-size: 10px` con relleno comprimido (`padding: 0 6px`, linea 485).
  - La nota del cliente tiene tamano de `12px` (linea 487).
  - Las leyendas de canal y modalidad tienen `12px` (linea 483).
- **Impacto Operativo**: 
  - En una cocina, las pantallas o tablets estan montadas en soportes de pared o repisas de acero a distancias de 60 a 120 cm de los ojos del operario. Una tipografia de 10px o 12px obliga a inclinarse fisicamente o forzar la vista, propiciando errores en la preparacion (ej. confundir leche de vaca con leche deslactosada o stevia con azucar regular). La pauta estandar de KDS exige fuentes minimas de 16px para modificadores y 20px para titulos de productos.
- **Prioridad**: Alta.

### 4.2 Apilamiento Vertical Forzado en Tablets y Celulares
- **Hallazgo**: 
  - La distribucion de las columnas principales en `isCocina` esta definida como `display: flex; flex-wrap: wrap; gap: 16px` con cada columna en `flex: 1 1 280px; min-width: 0` (lineas 472-474).
- **Impacto Operativo**: 
  - En una tablet pequena (pantalla de 8 pulgadas, 800x1280) o en un celular de supervision, los 280px por columna mas los margenes hacen que las 3 columnas no quepan horizontalmente. Las columnas se envuelven y se apilan una debajo de otra: arriba quedan los pedidos "NUEVOS", abajo "EN PREPARACION" y mas abajo "LISTOS".
  - Para consultar un pedido en preparacion o listo, el personal se ve obligado a realizar un scroll vertical kilometrico, precisamente el defecto ergonomico que Kevin exigio erradicar debido a las manos sucias o mojadas del personal.
- **Prioridad**: Alta.

### 4.3 Friccion Extrema por Ventanas Modales Bloqueantes (`isConfirm`)
- **Hallazgo**: 
  - Cada transicion operativa ("Empezar a preparar" y "Marcar listo") invoca la funcion `ask()` (linea 3699), que levanta un modal con `z-index: 90`, fondo oscurecido (`rgba(11,44,62,0.6)`) y dos botones: "Si" y "No" (lineas 2289-2299).
- **Impacto Operativo**: 
  - En una jornada con 150 comandas, el personal se ve obligado a realizar 300 toques adicionales de confirmacion en pantalla. En un ambiente donde la velocidad se mide en segundos, este patron de UI es hostil para el ritmo de despacho.
- **Prioridad**: Alta.

### 4.4 Truncamiento Ciego en Pantalla Completa sin Paginacion Interactiva
- **Hallazgo**: 
  - En la vista `isKfull` (lineas 3708-3709), el codigo fija un limite rigido de visualizacion: `const KMAX = 3`. Los pedidos excedentes se ocultan y se reemplazan por una etiqueta estatica: `+N mas` (`linea 515`).
- **Impacto Operativo**: 
  - Si una estacion de trabajo acumula 6 pedidos nuevos en una hora pico, el cocinero solo ve los primeros 3 pedidos. Los 3 pedidos restantes estan invisibilizados detras del texto `+3 mas`. Como la pantalla de TV o KDS no tiene carrusel horizontal, paginacion con botones amplios ni desplazamiento guiado, el cuarto pedido corre el riesgo de envejecer y retrasarse sin que el personal sepa que articulos incluye.
- **Prioridad**: Alta.

---

## 5. Analisis de Casos Raros y Contingencias Operativas

### 5.1 Pedido Cancelado Mientras Esta en Preparacion
- **CONFIRMADO en el codigo**: 
  - En `Admin.dc.html`, el boton `Rechazar` (`rejectSel`, lineas 407 y 415) SOLO esta disponible cuando el pedido esta en estado `nuevo` ("Por confirmar").
  - Una vez que el pedido pasa a `cola`, `prep` o `listo`, NO EXISTE EN TODA LA APLICACION ningun boton para anular o cancelar el pedido.
- **SUPOSICION**: 
  - Si administrativamente se forzara el estado a `rechazado` en la base de datos, el filtro de `kcol` (`f(x.o.status)`) dejaria de evaluar verdadero y la tarjeta simplemente DESAPARECERIA silenciosamente de la pantalla de cocina.
- **Impacto en Cafeteria**: 
  - Si un cliente llama para cancelar su orden o se retira del local tras 10 minutos de espera:
    1. El cocinero nunca recibe una alerta sonora ni un banner visual de "PEDIDO CANCELADO".
    2. El cocinero continua elaborando el sandwich, waffle o frappe, provocando merma directa de insumos costosos (mantequilla, pechuga de pollo, fresas, pulpas, envases).
    3. No se restituye el stock descontado automaticamente al inicio ni se genera una entrada en el registro de mermas.
- **Prioridad**: Alta.

### 5.2 Pedido Repetido o Duplicado
- **CONFIRMADO en el codigo**: 
  - En `Admin.dc.html`, cada orden se crea con un correlativo incremental simple (`id = 'CP-0' + s.n`, linea 3861).
  - No existe ningun mecanismo de verificacion de duplicidad o deduplicacion en una ventana de tiempo (debounce o verificacion de hash de pedido).
- **Impacto en Cafeteria**: 
  - En conexiones inestables de WhatsApp o cuando un cliente pulsa repetidamente el boton de envio en la carta web, se generan dos pedidos independientes con distinto identificador (`CP-0109` y `CP-0110`), pero con identico cliente, telefono y productos.
  - Ambos pedidos ingresan a la cola de Cocina como comandas distintas. La cocina elabora ambos pedidos en paralelo. Al momento de la entrega o cobro en caja se detecta el duplicado, perdiendose la produccion excedente.
- **Prioridad**: Alta.

### 5.3 Hora de Entrega Programada (Pedidos Agendados)
- **CONFIRMADO en el codigo o en el acta**: 
  - En Acta 02 (linea 89), Kevin expreso su escepticismo inicial sobre agendar pedidos ("¿Quien va a agendar? El 100% de los pedidos son para hoy").
  - Sin embargo, en la operacion real de delivery y eventos, existen clientes que piden a las 2:00 PM indicando: "Para recoger a las 6:00 PM" o "Enviar a las 7:30 PM".
  - En la estructura de pedidos de `Admin.dc.html` (`SEED`, lineas 2311-2326), NO EXISTE ningun campo de hora programada (`scheduledTime`). Solo existe la propiedad `mins` que mide el tiempo transcurrido desde el ingreso.
- **Impacto en Cafeteria**: 
  - Si el cliente o el asesor de WhatsApp anota en el campo libre de notas "Entregar a las 6:30 pm":
    1. El pedido entra inmediatamente a la pantalla de cocina a las 2:00 PM.
    2. A los 13 minutos, el semaforo se pone rojo y marca el pedido como "Atrasado".
    3. El cocinero prepara el club sandwich y el café caliente a las 2:10 PM. Para las 6:30 PM el producto esta descompuesto, frio y no apto para consumo humano.
  - Se requiere un estado "Programado" que retenga la comanda y solo la libere a la pantalla de cocina 15 minutos antes de la hora pactada.
- **Prioridad**: Media.

### 5.4 Pedido que Cambia de Mesa en Salon
- **CONFIRMADO en el codigo o en el acta**: 
  - En `Admin.dc.html`, la reasignacion de mesa `moChangeMesa` (linea 1739) solo puede realizarse durante la confeccion inicial del pedido en la tablet del mozo.
  - Una vez confirmado y enviado el pedido a cocina, NO EXISTE ningun mecanismo para cambiar la mesa asociada al pedido abierto.
  - En `referencia/modulos-usuarios-notificaciones.md` (linea 241), restaurant.pe si contempla la funcion de "Cambio de mozo y cambio de mesa".
- **Impacto en Cafeteria**: 
  - En una cafeteria es habitual que comensales sentados en una mesa pequena interior (M02) soliciten mudarse a la terraza o a una mesa grande (M08) cuando esta se desocupa.
  - Al no poder actualizarse la mesa en el pedido abierto, y dado que en la pantalla de cocina ni siquiera se visualiza el codigo de mesa, el mozo termina buscando al cliente en la mesa equivocada o entregando la comida a comensales recien llegados.
- **Prioridad**: Media.

---

## 6. Matriz Consolidada de Hallazgos

| # | Hallazgo Identificado | Ubicacion en Codigo / Acta | Justificacion de Impacto en Negocio | Prioridad | Naturaleza del Hallazgo |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | **Cambio de estado global destructivo** | `Admin.dc.html`, linea 3699 (`this.setOrder(o.id, { status: next })`) | Una estacion que marca listo su item cierra el pedido entero, habilitando entrega de platos aun no cocinados. | Alta | CONFIRMADO en el codigo |
| 2 | **Ausencia de boton para despejar comandas listas** | `Admin.dc.html`, linea 3705 (`kcol` LISTOS sin accion) | La pantalla de cocina se satura de tarjetas terminadas que el cocinero no puede retirar, violando el Acta 02. | Alta | CONFIRMADO en el codigo |
| 3 | **Omision de notas del cliente en pantalla completa** | `Admin.dc.html`, lineas 509-514 (`isKfull`) | Cocineros en modo pantalla completa no ven notas de alergias, preferencias ni advertencias del comensal. | Alta | CONFIRMADO en el codigo |
| 4 | **Perdida de modificadores en expansion de combos** | `Admin.dc.html`, lineas 2630 y 2653 (`expandPromo`) | Se pierden tamanos, cremas y especificaciones al dividir combos tipo "Duo para Compartir". | Alta | CONFIRMADO en el codigo |
| 5 | **Incomunicacion de productos e insumos agotados** | `Admin.dc.html`, lineas 2992 y 466-520 | Cocina no tiene permisos en `productos` ni boton en KDS para reportar un insumo agotado a salon o caja. | Alta | CONFIRMADO en el codigo |
| 6 | **Falta total de avisos sonoros (timbre de comanda)** | `Admin.dc.html`, lineas 3951-3965 | En cocinas ruidosas, los pedidos en cola pasan inadvertidos minutos vitales antes de ser atendidos. | Alta | CONFIRMADO en el codigo |
| 7 | **Ocultamiento del numero de mesa en tickets KDS** | `Admin.dc.html`, linea 3697 (`kcol` omite `o.mesa`) | Las tarjetas dicen "En mesa" pero no especifican el numero de mesa fisica de salon. | Alta | CONFIRMADO en el codigo |
| 8 | **Bloqueo de reimpresion de tickets y stickers** | `Admin.dc.html`, lineas 3674-3675 y 3689 | Cocina no puede reimprimir comandas o stickers atascados porque la funcion exige permisos de Caja. | Alta | CONFIRMADO en el codigo |
| 9 | **Friccion por modal de confirmacion en cada toque** | `Admin.dc.html`, lineas 3131 y 2289-2299 (`ask`) | Obliga a dos toques y tapa la pantalla con un pop-up central en plena manipulacion con manos sucias. | Alta | CONFIRMADO en el codigo |
| 10 | **Traspaso ciego en pedidos cancelados en curso** | `Admin.dc.html`, lineas 407 y 3695 | Si un pedido se cancela, desaparece sin alerta sonora ni visual, propiciando desperdicio de insumos. | Alta | CONFIRMADO en el codigo |
| 11 | **Fuentes diminutas e ilegibles para tablet en pared** | `Admin.dc.html`, lineas 483-487 (10px y 12px) | Forzar la vista a 1 metro de distancia provoca lentitud y equivocaciones en modificadores. | Alta | CONFIRMADO en el codigo |
| 12 | **Apilamiento vertical que revive el scroll en movil** | `Admin.dc.html`, linea 472 (`flex-wrap: wrap`) | En tablets verticales o celulares, las columnas se ponen una bajo la otra, requiriendo scroll continuo. | Alta | CONFIRMADO en el codigo |
| 13 | **Incoherencia en nomenclatura de estaciones** | `Admin.dc.html`, lineas 3057 vs 3701 | "Pantallas" usa nombres genericos (Barra/Cocina) y KDS usa las 3 reales (Bebidas, Postres, Salados). | Media | CONFIRMADO en el codigo |
| 14 | **Temporizador manual sin avance en tiempo real** | `Admin.dc.html`, linea 4411 (`addMinutes`) | El semaforo de 13 min depende de simular minutos manualmente; no corre solo con reloj del sistema. | Media | CONFIRMADO en el codigo |
| 15 | **Falta de distincion visual para Delivery / Llevar** | `Admin.dc.html`, lineas 483 y 510 | Solo hay texto gris plano de 12px; falta codigo de color para empaque especial (bolsa sellada vs vaso). | Media | CONFIRMADO en el codigo |
| 16 | **Contradiccion en rol del Smart TV (Salon vs Cocina)** | `Admin.dc.html`, lineas 498-520 vs Acta 02 | Mockup hace KDS con botones en Smart TV, mientras Kevin pidio Smart TV en salon para clientes. | Media | CONFIRMADO en acta y codigo |
| 17 | **Inexistencia de pedidos programados a futuro** | `Admin.dc.html`, lineas 2311-2326 | Pedidos diferidos envejecen en pantalla horas antes de la entrega real del producto. | Media | CONFIRMADO en el codigo |
| 18 | **Imposibilidad de transferir pedidos entre mesas** | `Admin.dc.html`, linea 1739 | Comensales que cambian de mesa física generan desajustes entre cocina, salon y caja. | Media | CONFIRMADO en el codigo |
| 19 | **Vulnerabilidad ante pedidos repetidos** | `Admin.dc.html`, lineas 3861 y 4410 | Doble pulsacion del cliente o bot genera dos tickets identicos que cocina prepara por duplicado. | Media | SUPOSICION tecnica basada en codigo |

---

## 7. Recomendaciones Tecnicas de Diseno y Arquitectura

Para transformar el prototipo actual en una solucion robusta y funcional que responda fielmente a las exigencias operativas de Caprichos, se formulan las siguientes recomendaciones directas:

1. **Desacoplar el Estado por Item y Estacion de Trabajo**:
   - Reemplazar la propiedad unica `o.status` por un arreglo de sub-estados por estacion o por linea de comanda: `o.items[i].status = { Bebidas: 'listo', Salados: 'prep' }`.
   - El estado global del pedido solo pasara a `listo` cuando el 100% de sus areas hayan marcado "Listo". De este modo, Bebidas puede despachar su frappé sin cerrar prematuramente el sandwich de Salados.

2. **Accion Directa con Boton de Despeje ("BUMP BAR" Virtual)**:
   - Eliminar el modal bloqueante `ask()` para transiciones en KDS. La pulsacion debe cambiar el estado de inmediato. Para evitar errores, puede implementarse un boton de "Deshacer" (Undo) flotante durante 5 segundos.
   - En la columna "LISTOS", incorporar un boton expreso "Despejar Comanda" con color verde de 48px de alto para que el cocinero limpie su tablero una vez entregado el plato al mozo o empaque.

3. **Incorporacion de Timbre Sonoro y Web Audio API**:
   - Integrar un sintetizador ligero de audio (`AudioContext`) que emita un doble tono limpio (frecuencias 880 Hz y 1760 Hz durante 250 ms) cada vez que una comanda entre al estado `cola` o cambie de estacion.
   - Agregar un indicador de estado sonoro conmutador (Timbre activado/silenciado) en la barra superior de la pantalla de cocina.

4. **KDS de Cara al Cliente para los 3 Smart TVs de Salon**:
   - Separar conceptualmente las pantallas:
     - Pantalla de Produccion (KDS Interno): Operada en PCs con pantalla tactil/mouse por estacion (Bebidas, Postres, Salados).
     - Pantalla de Turnos en Salon (Smart TV): Vista limpia de solo lectura con dos columnas ("Preparando" y "Listos para recoger"), con numeros de ticket grandes (ej. `#0103`), visible a 6 metros de distancia en el salon principal para que los clientes se acerquen al mostrador cuando su pedido este listo.

5. **Restitucion de Datos Criticos en las Tarjetas**:
   - Reincorporar obligatoriamente en `kcol`:
     - El numero de mesa (`o.mesa`), renderizado con badge llamativo (ej. `M07` en fondo terracota).
     - La insignia destacada de modalidad con codificacion de colores: Verde para `En Salon`, Azul para `Para Llevar`, Morado para `Delivery`.
     - El bloque completo de notas del cliente en la vista `isKfull`, resaltado en caja con borde de advertencia cuando exista texto.

6. **Herramientas de Contingencia para el Rol Cocina**:
   - Incluir en la esquina superior de cada tarjeta un menu contextual rapido de 3 puntos o boton de incidencia:
     - `Reimprimir comanda / sticker`: Envia una orden raw al agente local de impresion sin requerir auxilio de Caja.
     - `Reportar insumo faltante`: Permite al cocinero seleccionar un ingrediente o producto para marcarlo "Agotado por hoy", notificando de inmediato a las tablets de los mozos y bloqueandolo en la carta web y chatbot.

---

INFORME LISTO

---
id: ANA-CAP-036
tipo: analisis
titulo: "Módulos y roles del administrativo de Caprichos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-19
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, analisis]
---

# Módulos y roles del administrativo de Caprichos

> Borrador para revisión. Describe los módulos y roles **del prototipo** de UX (artifact "Caprichos Plataforma Digital", tablero Administrativo). La matriz de qué ve cada rol sale del prototipo y está **por confirmar con Kevin** (RN-CAP-013 del BRD). Todos los datos del prototipo son de ejemplo.
> Origen de los módulos: análisis del sistema actual restaurant.pe (`legacy/web-anterior/administrativo/`), reducido a lo que Caprichos usa.

## 1. Reglas generales

- Cada persona entra con su usuario y ve solo los módulos de su rol, más su escritorio y su perfil.
- **Nada se elimina**: los registros se desactivan o se activan (con filtro de "Registro" activo/inactivo). Única excepción: en el Plano del local se puede eliminar cualquier elemento, incluso una mesa que ya se usó (el historial conserva el nombre de la mesa); solo se bloquea una mesa con un pedido abierto o una reserva activa hoy, que se desactiva mientras tanto.
- Toda acción que cambia datos pregunta antes: **¿Está seguro? Sí / No**.
- Las listas se muestran como tarjetas, con búsqueda, filtros y paginación; cada tarjeta tiene Editar y Desactivar.
- **Perfil**: todos pueden cambiar su foto; solo el administrador edita los datos personales y el rol.
- Los menús se agrupan: Operación, Clientes y ventas, Compras y stock, Análisis y Configuración.

## 2. Módulos

### Operación
| Módulo | Para qué sirve | Funcionalidad |
| :-- | :-- | :-- |
| **Escritorio** | Pantalla de inicio de cada rol. | Cifras y listas según el rol, "para hacer ahora" con botones al módulo correspondiente. Solo el administrador ve ventas, gráficos y productos más vendidos. |
| **Pedidos y caja** | Recibir, verificar, aceptar y cobrar pedidos de carta, chatbot, mesa y teléfono. | Pedido del mozo en el local: va directo a cocina. Pedido fuera del local: llega por confirmar; caja, mozo o call center habla con el cliente por WhatsApp, elige el medio de pago, sube el comprobante (Yape, Plin, transferencia) y lo envía a cocina; registra cobro y medio de pago (efectivo con vuelto, Yape, Plin, transferencia, tarjeta); entrega y cierra pedidos de mesa y para llevar. En delivery, "Usar mi ubicación actual" con mapa; los filtros (canal, modalidad y cobro) van en combos dentro de un panel "Filtros". |
| **Cocina** | Pantalla de cocina y barra. | Tickets de pedidos aceptados con su tiempo corriendo; "Empezar a preparar" y "Marcar listo"; el contador cambia de color cerca de los 13 minutos (meta de entrega). |
| **Repartos** | Gestión del delivery. | Cada pedido listo aparece como **Disponible**; el repartidor lo **toma** él mismo (hay 3) y a los demás les desaparece. Ve dirección y referencia, abre Google Maps o Waze y marca entregado. Caja y call center ven quién tomó cada pedido y pueden reasignar. |
| **Reservas** *(por conversar)* | Agenda de mesas. | **Calendario del mes** (cada día muestra sus reservas confirmadas y pendientes; se toca un día para ver su agenda); solicitudes de WhatsApp que se aprueban eligiendo la mesa en el plano; reserva nueva con hora exacta y mesas en el plano; tabla con búsqueda y filtros. La reserva nunca bloquea una mesa. Falta decidir con Kevin si se mantiene o se quita. |

### Clientes y ventas
| Módulo | Para qué sirve | Funcionalidad |
| :-- | :-- | :-- |
| **Clientes** | Historial de clientes, puntos y comentarios. | El cliente puede pedir como invitado (sin puntos) o con cuenta de DNI y contraseña, con correo y cumpleaños opcionales (1 punto por cada s/ 1; el personal también suma, con aceptación de guardar sus datos); el módulo muestra su historial y los comentarios que dejan desde la carta (atendidos o por atender). |
| **Caja y cierres** | Abrir la caja en cero, ver las ventas del turno por medio de pago, registrar movimientos y cerrar el día con arqueo. | Administrador y cajero. Turno actual: ventas por medio, efectivo esperado, movimientos. Cierre: verificar movimientos, contar billetes y monedas, anotar lo que se ve en billeteras y tarjetas, diferencia y observaciones. Historial de cierres con filtros, ticket de 80 mm y PDF; no se edita ni se borra. |
| **Créditos del personal** | Consumo a crédito de los trabajadores. | Solo personal, con 25 % de descuento (sin combos ni promociones). **Sin plazo ni abonos**: lo que consume cada trabajador se **acumula por mes**, con lo que se llevó; a fin de mes el administrador lo revisa y el descuento del pago se hace fuera del sistema. Se consume solo en Pedidos y caja, no por la carta. A clientes no se les da crédito; lo que se debe a proveedores se ve en Compras. |
| **Productos** | Catálogo de la carta. | Productos con precio, **imagen**, categoría y variantes; **marcar AGOTADO**; desactivar/activar; «Ver todos» en una sola lista. La categoría se elige entre las de la carta y se puede **crear una nueva al agregar el producto** (por ejemplo Pizzas), diciendo si lleva tamaños y opciones o se vende fijo. Opciones y tamaños en una ventana: cada combo muestra solo su lista. |
| **Listas y categorías** | Mantener las listas de la carta. | Categorías de la carta (con o sin tamaños y opciones), «Dónde se pregunta cada grupo», tamaños de bebida, presentaciones y porciones, tipos de leche, endulzantes y demás listas, cada una con su categoría: crear, editar y ocultar (no se elimina). Solo administrador. |
| **Ofertas y descuentos** | Promociones, descuentos automáticos, cupones y sus reglas. | Cuatro pestañas. **Promociones:** combos y promociones «lleva N, paga M» (2x1, 3x2, 5x4…) con contenido que suma lo que lleva y precio sugerido; la carta, Nuevo pedido y el chatbot avisan y las aplican como descuento. **Descuentos:** automáticos por categoría o producto, con días, horas, fechas, canal y compra mínima (Domingos de waffles, Happy hour). **Cupones:** de **código único** (en el comprobante, distinto en cada uno, de un solo uso, sorteados al azar) o de **código compartido con tope** (afiches y redes); cifras, cupones emitidos con **Anular**, historial en ventana grande. **Reglas:** acumulación (entre promoción, descuento y cupón se aplica el mayor), cuántos cupones salen por comprobante, días de validez y pie. |

### Compras y stock
| Módulo | Para qué sirve | Funcionalidad |
| :-- | :-- | :-- |
| **Compras** | Abastecimiento. | Tres pestañas: **Pedir a proveedores** (lo que falta, por proveedor, con WhatsApp por proveedor; un insumo a un solo proveedor por pedido), **Compras** (pedidos por recibir, recibidas y por pagar, con cifras arriba) y **Proveedores**. Recibir un pedido registra costos y sube el stock. |
| **Almacén** | Movimiento de insumos. | Por defecto solo **entrada y salida**. Otros tipos (transferencia, merma) y el **origen** se gestionan en el mismo módulo, desactivados por defecto. |
| **Stock y recetas** | Insumos y costos. | Tres pestañas: Insumos (stock, filtros, nuevo insumo, pedir a proveedores), Producción y almacén (producir, pedir al almacén, mermas y cierre) y Recetas. Stock por insumo con mínimo y alerta de stock bajo; botón para mandar lo bajo (o un insumo) a Compras ▸ Pedir a proveedores; recetas por plato con costo y margen de utilidad. |

### Análisis
| Módulo | Para qué sirve | Funcionalidad |
| :-- | :-- | :-- |
| **Informes** | Reportes de operación. | Período (hoy, ayer, 7 días, todo, o desde-hasta) y filtros de canal, método de pago y modalidad; 23 informes con datos del sistema, en 6 categorías (Ventas, Caja, Inventario, Compras, Clientes, Delivery): resumen «Hoy en un vistazo», buscador, tarjetas con qué muestra / filtros / exportación, y al abrir uno sus cifras, su tabla y la descarga en .csv para Excel. |
| **Indicadores** | Medir el negocio. | Ventas, pedidos, ticket promedio y tiempo de entrega frente a la meta de 13 minutos. |

### Configuración
| Módulo | Para qué sirve | Funcionalidad |
| :-- | :-- | :-- |
| **Configuración del local** | Única fuente de los datos del local (ver CFG-CAP-001). | Por categorías: datos del local, ubicación, contacto, horario por día y fechas especiales, redes, pagos, entrega, avisos, empresa y fotos del local. Lo que se guarda aquí se refleja en la carta, el chatbot y el administrativo. **Ubicación actual de la tienda** (sección Ubicación): se puede actualizar con «Usar mi ubicación actual», buscando la dirección escrita, tomándola del enlace de Google Maps o escribiendo latitud y longitud; es el centro del mapa de entregas, de los radios de 0,5/1/2 km y del mapa de Nuevo pedido. |
| **Diseño de la carta** | El administrador configura la carta viéndola como la ve el cliente. | Pantalla completa; tres organizaciones (secciones en cuadrícula, lista, tarjetas grandes); arrastrar productos y categorías; cambiar foto, nombre, descripción y precio; ocultar productos; editar las dos promociones de la parte superior; decoración festiva; **Publicar** o descartar. Mientras no se publique, el cliente no ve cambios. Lo que se crea en Productos, Listas y categorías u Ofertas (productos, categorías, combos) aparece al instante, al final de su categoría. |
| **Destacadas de la carta** | Los círculos "Momentos Caprichos" con fotos. | Crear, nombrar, ordenar y desactivar círculos; foto del círculo y fotos con texto (clientes, local, equipo) que el cliente ve como en las historias de Instagram; no redirigen a ninguna parte; publicar con confirmación. Arrastrar los círculos para cambiar su lugar; avisos de «Oculta» y «Sin fotos: no se ve»; resumen de cuántos se ven; «Ver como cliente» abre un visor tipo historia (barras de avance, toque izquierda/derecha, reproducir solo, salto entre círculos); «Cargar fotos de ejemplo» para probarlo. Varias fotos a la vez, y por imagen: cambiar, usar de portada, subir, bajar, quitar (o quitar todas); por círculo: desactivar, duplicar, archivar (queda en «Archivadas», se restaura) y eliminar para siempre con confirmación. |
| **Novedades y publicidad** | La página Novedades de la carta virtual (publicidad general, no solo comida). | Diseñador en pantalla completa igual que el de la carta: la página como la ve el cliente (portada, tarjetas), con orden por arrastre o flechas, activar/desactivar, destacar, duplicar y «Editar» (tipo, textos, fotos, enlace, fechas con atajos); filtros por estado (activas, programadas, vencidas, desactivadas); publicar o descartar. Nada se elimina: se desactiva. |
| **Paleta de colores** | Colores de la carta por temporada. | Una paleta por decoración (Halloween, Navidad, Año Nuevo, San Valentín, Día de la Madre, Día del Padre, Fiestas Patrias, Día del Niño, Aniversario), con 9 colores editables y aviso de contraste; se usa solo mientras esa decoración esté activa. |
| **Plano del local** | Dibujar el local por piso. | Mesas, cocina, barra, caja, baños, paredes, escalera y entrada; se colocan, arrastran, renombran y se les cambia el tamaño; entrada, cocina, baños, paredes y demás se pueden **eliminar** sin restricción; una **mesa** solo se elimina si no tiene pedidos ni reservas, y si los tiene **solo se desactiva**. El segundo piso existe pero queda desactivado hasta que se necesite. El mozo ve este plano al tomar un pedido de mesa. Resumen arriba (mesas activas, capacidad, mesas del piso, pisos activos); a la derecha, elementos agrupados (para sentarse, estructura, servicios), el panel del elemento elegido y el tamaño del plano. Girar un elemento (horizontal/vertical) y copiar o pegar el diseño completo. Plano por defecto en `plano-del-local.md`. |
| **Pantallas** | Televisores de cocina y barra de solo lectura. | Vincular una TV escribiendo el código que muestra (con confirmación Sí/No); lista con estación, última conexión y llave parcial; desactivar una pantalla si se pierde. La TV solo ve pedidos de cocina, sin teléfono ni dirección. |
| **Usuarios** | Personal con acceso y clientes con cuenta. | Tres pestañas. **Personal:** resumen (activos, inactivos, entraron hoy, nuevos, nunca ingresaron), filtros por cargo, estado, fecha de creación (o entre dos fechas) y último acceso, tarjetas con cuándo se creó y cuándo entró por última vez, alta y desactivación (no se elimina). **Clientes:** con cuenta o invitados, desde cuándo, último pedido y puntos, con filtros por tipo, cuenta, alta y último pedido; se editan en Clientes. **Qué ve cada rol:** matriz de permisos. |
| **Notificaciones** | Avisos del sistema. | Campanita con lo pendiente según el rol y página propia: resumen, «Pendientes ahora» con su botón para resolverlo, e historial agrupado por día con filtros por tipo, estado (nuevas o leídas), fecha (hoy, ayer, 7 días o entre dos fechas) y búsqueda; marcar como leída o nueva (o todas) e ir al módulo. |

## 3. Roles

### Administrador (dueño o encargado)
Dirige el negocio y configura el sistema. Único que ve ventas e indicadores del negocio y que cambia la carta, los colores, los usuarios y los datos personales.
- **Ve:** los 22 módulos.
- **Escritorio:** ventas del día, pedidos, ticket promedio, entrega promedio, gráfico por hora, ventas por canal, productos más vendidos y pendientes.
- **Puede editar y desactivar** en todos los módulos.

### Cajero
Verifica, acepta y cobra los pedidos. Es el filtro entre el cliente y la cocina.
- **Ve:** Escritorio, Pedidos y caja, Reservas, Clientes, Créditos, Ofertas y descuentos, Notificaciones.
- **Escritorio:** pedidos por aceptar, cobros pendientes, cobrado en su caja, pedidos cerrados, lista de pedidos por aceptar, reservas y créditos por vencer.
- **Puede editar y desactivar** en sus módulos.
- **No ve:** ventas totales del negocio, cocina, stock, configuración.

### Cocina y barra
Prepara los pedidos aceptados.
- **Ve:** Escritorio, Cocina, Stock y recetas, Notificaciones.
- **Escritorio:** pedidos nuevos, en preparación, atrasados (13 minutos o más), tiempo promedio, lista de tickets e insumos con stock bajo.
- **Solo lectura** en Stock y recetas.
- **No ve:** montos, ventas ni clientes.

### Mozo
Atiende las mesas.
- **Ve:** Escritorio, Pedidos y caja, Reservas, Productos, Notificaciones.
- **Escritorio:** sus mesas con pedido abierto, pedidos listos para llevar, reservas de hoy y productos agotados.
- **Pedido de mesa:** en Pedidos y caja pulsa "Nuevo pedido de mesa": elige el piso (solo si hay más de uno), toca una mesa libre en el plano y arma el pedido como un carrito con **las mismas opciones de la carta** (tamaño, leche, endulzante, cremas, adicionales y nota para cocina), con varios productos; lo envía a caja.
- **No ve:** ventas del negocio, cocina ni configuración.

### Call center
Toma pedidos por teléfono y atiende el delivery.
- **Ve:** Escritorio, Pedidos y caja, Repartos, Reservas, Clientes, Notificaciones.
- **Escritorio:** delivery por aceptar y en curso, reclamos abiertos, reservas, lista de deliveries y búsqueda de clientes.
- **No ve:** ventas del negocio, stock ni configuración.

### Almacén
Controla insumos y recibe mercadería.
- **Ve:** Escritorio, Compras, Almacén, Stock y recetas, Informes, Notificaciones.
- **Escritorio:** insumos bajo el mínimo, compras por recibir, movimientos del día, requerimientos pendientes, últimos movimientos y lista de stock bajo.
- **No ve:** ventas, caja ni clientes.

### Repartidor (motorizado)
Entrega los pedidos de delivery. Usa la misma web, no hay aplicación aparte.
- **Ve:** Escritorio, Repartos, Notificaciones.
- **Escritorio:** pedidos disponibles para tomar, y lo suyo: por salir, en camino y entregados; por cada entrega, dirección, referencia y botones de Google Maps y Waze.
- **No ve:** pedidos de otros repartidores, montos ni ningún otro módulo.

## 4. Resumen de acceso

| Módulo | Admin | Cajero | Cocina | Mozo | Call center | Almacén | Repartidor |
| :-- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Escritorio | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pedidos y caja | ✓ | ✓ | | ✓ | ✓ | | |
| Cocina | ✓ | | ✓ | | | | |
| Repartos | ✓ | | | | ✓ | | ✓ |
| Reservas | ✓ | ✓ | | ✓ | ✓ | | |
| Clientes | ✓ | ✓ | | | ✓ | | |
| Créditos | ✓ | ✓ | | | | | |
| Productos | ✓ | | | ✓ | | | |
| Ofertas y descuentos | ✓ | ✓ | | | | | |
| Compras | ✓ | | | | | ✓ | |
| Almacén | ✓ | | | | | ✓ | |
| Stock y recetas | ✓ | | ✓ | | | ✓ | |
| Informes | ✓ | | | | | ✓ | |
| Indicadores | ✓ | | | | | | |
| Configuración del local, Diseño de la carta, Paleta, Usuarios, Pantallas, Plano del local | ✓ | | | | | | |
| Notificaciones | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## 4.1 Reparto con varios repartidores a la vez (decisión de producto; lo técnico se ve después)
- Hay 3 repartidores. Un pedido listo aparece como disponible para todos; el que lo toma se lo queda.
- Si dos lo toman en el mismo instante, **solo uno lo recibe** y el otro ve el aviso "tomó el pedido un instante antes, elige otro".
- Técnicamente se resuelve en el servidor con una toma atómica (la base de datos acepta solo la primera) y avisos en tiempo real a los demás; una cola es una alternativa. Se define en el ADR.

## 5. Por confirmar con el cliente

- Si el mozo debe cobrar o solo tomar pedidos, y si puede marcar productos agotados.
- Si el cajero también edita ofertas o solo las consulta.
- Si el call center ve montos de los pedidos que toma.
- Qué hacer con **Reservas, Clientes y Créditos**: mantener, quitar o dejar solo historial.
- **Configuración del local y Notificaciones** (el módulo Ajustes se eliminó el 17/10 por no tener funciones propias): se propone unirlos en una sola pantalla de configuración con campos reales y pasar Notificaciones a una campana.
- Quién configura el pedido mínimo y el envío gratis (hoy solo el administrador).
- Los módulos de restaurant.pe que no entraron (facturación electrónica, publicidad, redes) se mantienen fuera del alcance, como indica el BRD.

---
Generado por IA a partir del prototipo y del análisis de restaurant.pe — Revisado por: (pendiente)

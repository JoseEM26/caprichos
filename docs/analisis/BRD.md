---
id: BRD-CAP-001
tipo: brd
titulo: BRD — plataforma digital de Caprichos (carta virtual, módulo administrativo y chatbot)
estado: approved
producto: caprichos
version: "1.51"
owner: "Kevin Rosales (negocio)"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [INT-CAP-001, INI-CAP-002]
tags: [brd, plataforma-digital, g1]
---

# BRD — Plataforma digital de Caprichos

> Business Requirement Document (R12). Documenta las necesidades de negocio de Caprichos como salida de la etapa de Discovery (F1). Habla de negocio, no de tecnología: la elección de herramientas y arquitectura se decide después, en el diseño técnico.

| Campo | Detalle |
| :-- | :-- |
| Ticket | *(pendiente — R13)* |
| Tipo | T3 |
| Gate que alimenta | G1 (Discovery) |
| Aprueba | Stakeholder firma el BRD; PO cierra G1; en T3 aprueban PO + Stakeholder + TL |
| Origen | `analisis/ficha-intake.md` (INT-CAP-001) y actas de las reuniones (`actas/acta-01-descubrimiento.md` y `actas/acta-02-descubrimiento.md`) y las iniciativas de la segunda reunión (`analisis/iniciativas-acta-02.md`, INI-CAP-002) |

> **Cambios del acta 03 (revisión del mockup, 20/10/2026).** Estas reglas del BRD quedaron reemplazadas o ajustadas por `analisis/decisiones.md` §11, que manda sobre este documento:
>
> | Del BRD | Ahora | Decisión |
> |---|---|---|
> | NEC-CAP-036 y V8: 1 punto por cada S/ 1 | Se gana el 5 % del total (configurable); 1 punto = S/ 1 para canjear | DT-55 |
> | RN-CAP-001 y RN-CAP-074: todo pedido de fuera espera «por confirmar» | El pedido de la carta va directo a las comandas; caja coordina el pago después | DT-57 |
> | RN-CAP-084: área avanza en preparación → listo | Un solo botón «Despejar», historial y vista de despacho | DT-58 |
> | RN-CAP-078: el cajero ve lo esperado mientras cuenta | Cierre ciego: el cajero solo ve «Cuadra» o «No cuadra» | DT-61 |
> | RN-CAP-094: anular por otro rol con el PIN del administrador | El cajero anula con motivo y el PIN de 6 dígitos de la supervisora, en persona | DT-61 |
> | NEC-CAP-025, NEC-CAP-108 y RN-CAP-131: crédito por mes | Crédito revisado por semana y por rango de fechas | DT-63 |
> | RN-CAP-081 (2.ª): los perecibles exigen vencimiento | Compras sin lote ni fecha de vencimiento | DT-64 |
> | OBJ-CAP-001 y D-01: 13 minutos prometidos | Al cliente se le dice de 25 a 35 minutos | V1 |
>
> Además se agregaron el mapa del repartidor (DT-59), los mensajes de reparto (DT-60), las opciones por unidad (DT-62), la marca «no suma puntos» (DT-65), el horario del personal (DT-64), los datos de clientes (DT-67) y se descartaron las reseñas de Google (DT-66).

## 1. Problema

Caprichos es una cafetería artesanal cuyo foco es la hospitalidad. Hoy sus herramientas de venta están separadas: una carta digital anterior (con el plan vencido y sin vínculo con el stock), un sistema de caja y administración, y un chatbot de WhatsApp que solo entrega el enlace de la carta. Un pedido que nace en WhatsApp o en la web no pasa de forma ordenada por caja ni llega a cocina, y el negocio no ve en tiempo real qué hay en stock ni cuánto gana por plato. Los procesos son empíricos y no están documentados. El tiempo de entrega actual es de 20 a 25 minutos.

| ID | Necesidad | Quién la siente | Fuente |
| :-- | :-- | :-- | :-- |
| NEC-CAP-001 | Que un pedido hecho por la carta o por WhatsApp pase por caja y llegue a cocina sin reescribirlo a mano. | Cajero/a, cocina | Acta 01 |
| NEC-CAP-002 | Que solo se ofrezca lo que hay disponible, con el stock de insumos actualizado en tiempo real. | Cliente, almacén, cajero/a | Acta 01 |
| NEC-CAP-003 | Que el dueño conozca el margen de utilidad de cada plato a partir de sus recetas. | Dueño | Acta 01 |
| NEC-CAP-004 | Que los clientes que no manejan bien la web puedan pedir por WhatsApp eligiendo todas las opciones (variante, leche, endulzante, cremas), como en la página. | Cliente | Conversación de descubrimiento |
| NEC-CAP-005 | Bajar el tiempo de entrega de 20-25 minutos a un máximo de 13. | Dueño, cliente | Retos específicos del cliente |
| NEC-CAP-006 | Una carta digital propia, vigente y con promociones (precio anterior tachado, porcentaje de descuento, combos). | Dueño, cliente | Análisis de la web anterior |
| NEC-CAP-007 | Respuestas del canal de WhatsApp consistentes con la voz de la marca y sin errores que generen quejas. | Dueño, cliente | Acta 01 |
| NEC-CAP-008 | Procesos y roles documentados, ya que hoy son empíricos y la lista de roles y funciones de 2024 quedó desactualizada. | Dueño, personal | Acta 01 |
| NEC-CAP-009 | Que el repartidor reciba su pedido con la dirección de entrega y pueda abrirla de inmediato en su aplicación de mapas, sin copiarla a mano. | Repartidor, cliente | Conversación de descubrimiento |
| NEC-CAP-014 | Dibujar el local (mesas, cocina, baños, paredes, entrada) por piso, y que el mozo elija piso y mesa al hacer un pedido; hoy es un solo piso, pero debe poder haber dos. | Dueño, mozo | Pedido del cliente en reunión |
| NEC-CAP-015 | Que cada repartidor tome por sí mismo el pedido que va a llevar, sin que dos lo tomen a la vez. | Repartidor, caja | Pedido del cliente en reunión |
| NEC-CAP-016 | Crear y gestionar categorías, tipos de oferta, tipos de movimiento y origen desde el mismo módulo donde se usan, y poder subir imágenes de productos y ofertas. | Dueño | Pedido del cliente en reunión |
| NEC-CAP-013 | Que al aceptar un pedido se imprima automáticamente la comanda en la ticketera de cocina (y, si corresponde, de barra), y que caja pueda reimprimirla si falla. | Cocina, cajero | Pedido del cliente en reunión |
| NEC-CAP-010 | Que cada persona del equipo vea solo lo que le corresponde según su rol (administrador, cajero, cocina y barra, mozo, call center, almacén, repartidor), también en su pantalla de inicio. | Dueño, personal | Prototipo de UX (fase de diseño) |
| NEC-CAP-011 | Que el administrador configure la carta viéndola como la ve el cliente: orden de productos y categorías, fotos, textos, precios, productos ocultos y promociones, sin tocar un formulario técnico. | Dueño | Prototipo de UX (fase de diseño) |
| NEC-CAP-012 | Decorar la carta en fechas festivas (Halloween, Navidad, Año Nuevo y otras) con paleta de colores propia, solo mientras la decoración esté activa. | Dueño, cliente | Prototipo de UX (fase de diseño) |
| NEC-CAP-017 | Pedir en la carta con el menor esfuerzo: elegir productos primero y dar los datos al final; sin pedir fecha, sin correo obligatorio y sin crear cuenta para comprar. | Cliente, dueño | Acta 02 |
| NEC-CAP-018 | Pagar con Yape y Plin como opciones visibles y propias, y confirmar el pago por WhatsApp en vez de subir un comprobante en la web. | Cliente, dueño | Acta 02 |
| NEC-CAP-019 | Que la dirección de entrega se recuerde por teléfono, se verifique con el cliente ("¿es esta tu ubicación?") y use la ubicación actual del cliente (GPS) con mapa; costo de delivery por rangos de distancia. *(Decisión del 17/10: se quitó el campo de código Plus de Google Maps que pedía el acta; por confirmar con Kevin.)* | Cliente, cajero | Acta 02 y decisión del 17/10 |
| NEC-CAP-020 | Que cada área de producción (bebidas, postres y salados) vea en su pantalla solo lo que le toca, incluidas las partes de un combo, con la comanda completa (mozo, ticket, tiempo y notas) y sin tener que desplazar la pantalla. | Cocina y barra | Acta 02 |
| NEC-CAP-021 | Imprimir etiquetas adhesivas con la comanda para pegar en el vaso y, si hace falta, una pantalla o etiquetera de despacho con todo junto. | Cocina y barra | Acta 02 |
| NEC-CAP-022 | Seguir operando (tomar pedidos, cobrar y ver la cocina) cuando se cae el internet, y que todo se sincronice al volver. | Dueño, caja, cocina | Acta 02 |
| NEC-CAP-023 | Que dos personas no abran pedido en la misma mesa, y poder marcar una mesa como reservada en el plano. | Mozo, caja | Acta 02 |
| NEC-CAP-024 | Programa de puntos para clientes con cuenta (correo y fecha de cumpleaños), manteniendo la compra como invitado. | Dueño, cliente | Acta 02 |
| NEC-CAP-025 | Que el personal pueda consumir a crédito con descuento y que lo consumido se acumule por mes, para descontarlo del pago a fin de mes (fuera del sistema). | Dueño, personal | Acta 02 |
| NEC-CAP-026 | Controlar el almacén con entradas, salidas y mermas; que la producción diaria entre al stock; que al vender se descuenten los insumos según la receta; ver el stock con semáforo y recibir alertas. | Almacén, dueño | Acta 02 |
| NEC-CAP-027 | Armar la orden de compra con un clic desde los insumos con stock bajo y enviarla por WhatsApp al proveedor. | Dueño, almacén | Acta 02 |
| NEC-CAP-028 | Un chatbot que pida por botones, use la IA solo para dudas y recomendaciones, avise cuando entra un pedido web, tome reservas, derive a una persona y haga seguimiento después de la venta. | Cliente, caja | Acta 02 |
| NEC-CAP-029 | Pedir opinión después de la entrega, llevar las positivas a Google Maps y derivar las negativas a una persona, avisando por WhatsApp a la gerencia. | Dueño | Acta 02 |
| NEC-CAP-030 | Un espacio administrable para publicidad en la carta (por ejemplo "Caprichos del mes") que se pueda desactivar. | Dueño | Acta 02 |
| NEC-CAP-031 | Emitir por defecto nota de venta, y boleta o factura solo cuando el cliente la pida. | Caja, dueño | Acta 02 |
| NEC-CAP-032 | Que la carta destaque con estrellas los productos más comprados del mes, que el ranking se reinicie solo cada mes y que el mes anterior quede en un historial. | Dueño, cliente | Acta 02 (15/10) |
| NEC-CAP-033 | Una página "Conócenos" aparte con ubicación, horario, teléfono y redes sociales. | Cliente, dueño | Acta 02 (15/10) |
| NEC-CAP-034 | Promociones y combos armados con sus productos: al venderse se registra la promoción y se descuenta cada producto por separado; si un componente no hay, se elige otro de la misma categoría. | Cliente, dueño | Acta 02 (14/10) |
| NEC-CAP-035 | Cupones de descuento completos (código, % o monto, mínimo, vigencia, usos máximos y por cliente, categoría o producto, canal, requiere cuenta). | Cliente | Acta 02 (14/10) y pedido del 17/10 |
| NEC-CAP-036 | Pedir como invitado (sin puntos) o con cuenta (1 punto por cada s/ 1, con visto bueno para guardar datos); nunca se obliga a crear cuenta. | Cliente | Acta 02 (14/10) |
| NEC-CAP-037 | Pantalla de cocina por área (bebidas, postres, salados), sin desplazamiento y con vista general opcional. | Cliente | Acta 02 (14/10) |
| NEC-CAP-038 | Toda la información del local (nombre, ubicación, teléfono, WhatsApp, horario por día, fechas especiales, redes, pagos, entrega y fotos) se administra en un solo módulo, Configuración del local, y se refleja en la carta, el chatbot y el administrativo. | Cliente, dueño | Decisión del 17/10 (ver CFG-CAP-001) |
| NEC-CAP-039 | Formulario "¿Cómo te fue?" al final de la carta (comentario, sugerencia, felicitación o queja) y pie de página con ubicación, horario, contacto y redes; los mensajes se ven en el administrativo. | Cliente | Decisión del 17/10 |
| NEC-CAP-040 | Combos pedidos por unidad (sabor, leche, dulzor y toppings de cada frappe; sabor de cada dona), en pasos plegables. | Cliente | Decisión del 16/10 |
| NEC-CAP-041 | Estadística con gráficos y filtros (periodo, año, fechas y canal) en el escritorio y en Indicadores. | Dueño | Decisión del 16/10 |
| NEC-CAP-042 | Fotos del local administrables, con espacios reservados en la carta y en Conócenos. | Cliente, dueño | Decisión del 17/10 |
| NEC-CAP-043 | Pedido del mozo con opción de ver los productos con o sin imagen, pantalla de carga y vistas compactas en celular. | Mozo, cliente | Decisión del 16/10 |
| NEC-CAP-044 | Página "Novedades" en la carta virtual (promociones, imágenes, videos de TikTok o Instagram y avisos) administrable desde un módulo, viéndola como la ve el cliente y editando una novedad a la vez. | Cliente, dueño | Pedido del 17/10 (el acta solo menciona un banner publicitario que se puede desactivar) |
| NEC-CAP-045 | Los círculos "Momentos Caprichos" de la carta son destacadas editables: al tocarlos abren un visor de fotos (como las historias de Instagram) de clientes, del local o del equipo, que sube el administrador. Solo muestran fotos y no redirigen a ninguna parte. | Cliente, dueño | Pedido del 17/10 |
| NEC-CAP-046 | Página Novedades más completa: portada con banners, filtros por tipo, galería de fotos por novedad, datos útiles y redes. | Cliente, dueño | Pedido del 17/10 |
| NEC-CAP-047 | Filtros del administrativo en una barra compacta (buscador y botón "Filtros" que abre un panel con limpiar y resumen), pensada para celular. | Todos los roles | Pedido del 17/10 |
| NEC-CAP-048 | Entrada visible a la cuenta del cliente en la carta (botón "Ingresar"): ingresar, crear cuenta o seguir como invitado; con cuenta se ve el saldo de puntos y suma 1 punto por cada s/ 1. Nunca se obliga. | Cliente | Pedido del 17/10 (complementa NEC-CAP-036) |
| NEC-CAP-049 | "Usar mi ubicación actual" en todo pedido de delivery (carta, administrativo y chatbot), con mensaje de éxito o de error, mapa y enlace a Google Maps; la dirección y la referencia siguen editables. | Cliente, cajero, mozo | Pedido del 17/10 |
| NEC-CAP-050 | Filtros del administrativo como combos (listas desplegables) con buscador cuando pasan de 10 opciones, y fechas con selector de calendario. | Todos los roles | Pedido del 17/10 |
| NEC-CAP-051 | El panel de novedades y publicidad es general, no solo de comida: promociones, banners, videos (TikTok, Instagram o YouTube), fotos de clientes o de un evento, eventos con fecha y lugar y avisos; con etiqueta o tema (por ejemplo Navidad) y varias fotos por publicación. | Cliente, dueño | Pedido del 17/10 |
| NEC-CAP-052 | Plano del local con controles arriba, plano a casi toda la pantalla, cuadrícula de tamaño ajustable (más o menos cuadrados), pisos que se activan y desactivan, y eliminación de cualquier elemento, incluso mesas ya usadas. | Dueño, administrador | Pedido del 17/10 |
| NEC-CAP-053 | Pedido del mozo en mesa más intuitivo: pregunta la mesa con botones de mesas libres o con el plano, y muestra siempre la mesa con la opción de cambiarla. | Mozo | Pedido del 17/10 |
| NEC-CAP-054 | Cupones que no se asignan a mano: al imprimir el comprobante del cliente salen abajo dos cupones (por ejemplo "en tu siguiente compra, 20 % de descuento en el Dúo para compartir"), con CRUD completo (crear, editar, desactivar, ordenar) e historial de cambios e impresiones. | Dueño, cliente | Pedido del 17/10 |
| NEC-CAP-055 | Quitar el módulo Ajustes del administrativo por no tener funciones propias; sus datos útiles (pagos, entrega, empresa) ya están en Configuración del local. | Dueño | Pedido del 17/10 |
| NEC-CAP-056 | Ofertas y descuentos con cuatro partes: promociones (combos, 2x1, 3x2) con días, horas, fechas, canal y límite; descuentos automáticos sin código por categoría o producto; cupones del comprobante; y reglas generales (acumulación, cupones por comprobante, validez y texto al pie). | Dueño | Pedido del 17/10 |
| NEC-CAP-057 | La cuenta del cliente se identifica con el DNI y una contraseña; el correo personal es opcional y el cumpleaños también. El personal usa la misma cuenta que en el administrativo y también suma puntos. Quien atiende puede pedir en nombre de un cliente solo con su DNI (nunca su contraseña), o registrarlo en el local; el cliente crea su contraseña después, en la carta. La cuenta nunca es obligatoria. | Cliente, personal, mozo, caja |
| NEC-CAP-058 | Los productos con variantes (donas, galletas, mañana pizzas) se gestionan como tipos con sus sabores, que se crean, editan y desactivan sin eliminar; las promociones pueden pedir un tipo y la carta ofrece solo los sabores activos. | Administrador |
| NEC-CAP-059 | Quien toma un pedido de delivery por teléfono o WhatsApp puede marcar el lugar de entrega en un mapa (buscando la dirección que dio el cliente o tocando el punto), en lugar de depender de la ubicación del equipo. El enlace al mapa queda en el pedido para caja y reparto. | Call center, caja, mozo |
| NEC-CAP-060 | Al aceptar un pedido se imprimen, junto con la comanda, tres tipos de etiqueta adhesiva: una **general** del pedido (para la bolsa o bandeja), una **por área** de producción (bebidas, salados y postres o dulces), cada una en la etiquetera de su área, y una **por bebida**, que dice qué contiene (por ejemplo, el frappé) y se pega dentro del vaso. Se puede reimprimir cada tipo y activar o desactivar cada tipo en la configuración. | Cocina, barra, caja | Reunión con el cliente (18/10) |
| NEC-CAP-061 | Dos caminos para un pedido: (1) el que toma el **mozo en el local** con su tablet va **directo a las pantallas de cocina**, sin validación de caja; (2) todo pedido **fuera del local** (carta virtual, chatbot, teléfono) llega como "por confirmar" y **no pasa a cocina** hasta que una persona del equipo se comunica con el cliente por WhatsApp, verifica el pago y sube el comprobante. El cliente **no envía capturas de pago**. | Cliente, mozo, caja, call center | Reunión con el cliente (18/10) |
| NEC-CAP-062 | Cierre de caja del día: la caja se **abre en cero** cada mañana; durante el turno se ven las ventas por medio de pago (efectivo, Yape, Plin, transferencia, tarjeta y otros) y se registran ingresos y egresos de caja; al cerrar se verifican los movimientos, se cuenta el efectivo por billetes y monedas, se compara con lo que dice el sistema y con lo que ve el cajero en el celular de las billeteras y en el terminal de tarjetas, y se registra la diferencia. Todo cierre queda en un **historial que no se pierde**. | Cajero, administrador | Reunión 18/10 y restaurant.pe |
| NEC-CAP-063 | Al cobrar un pedido el cajero elige el medio de pago (efectivo, Yape, Plin, transferencia, tarjeta), puede pagar una parte con cada medio (pago mixto), anota con cuánto paga el cliente y ve el vuelto. El cobro por medio alimenta el cierre de caja. | Cajero | Revisión del rol cajero (18/10) |
| NEC-CAP-064 | Clientes: crear cliente (DNI o RUC, nombre, teléfono, correo y cumpleaños opcionales, con aceptación), buscar por DNI completo, editar sin cambiar el documento y ver el historial de pedidos. Créditos del personal: registrar abonos que bajan el saldo; un abono en efectivo entra a la caja del turno. Escritorio del cajero con cifras reales. | Cajero | Revisión del rol cajero (18/10) |
| NEC-CAP-065 | En Nuevo pedido (mozo o caja) se pueden elegir las promociones vigentes y aplicar un cupón; los descuentos automáticos vigentes se aplican solos, respetando que un cupón no se junta con un descuento automático salvo que la regla lo permita. | Mozo, cajero | Revisión del rol cajero (18/10) |
| NEC-CAP-066 | Los combos los arma el propio usuario, sin programador, desde Ofertas y descuentos: nombre, precio por tamaño y las partes que lleva (productos a elección de unas categorías, una opción entre varias, o un producto fijo). El combo usa productos de la carta, así el stock, la cocina y los informes cuentan por producto y también por combo. | Administrador | Reunión 18/10 |
| NEC-CAP-068 | Las ofertas (combo, llevas más pagas menos, descuento) se arman desde un solo botón y todas comparten la vigencia opcional (días, horas, fechas y canal). Un combo fuera de su vigencia no se ofrece en la carta ni en Nuevo pedido. | Administrador | Reunión 18/10 |
| NEC-CAP-069 | Registrar cada compra a un proveedor (comprobante, contado o crédito, detalle con cantidad, costo, lote y vencimiento) y que sume al stock y deje la entrada en Almacén. | Almacén, dueño | Acta 02; informe de almacén |
| NEC-CAP-070 | Directorio de proveedores con RUC, WhatsApp, días de crédito y cuenta de pago; historial de compras y de precios por proveedor; se desactivan, no se eliminan. | Almacén, dueño | Acta 02 (proveedores A, B, C) |
| NEC-CAP-071 | Cada insumo tiene ficha con unidad de compra, de almacén y de receta (con equivalencias), niveles de stock editables, si vence y sus proveedores A, B y C elegidos del directorio. | Almacén | Acta 02 |
| NEC-CAP-072 | Cada área (Bebidas, Postres, Salados) avanza su parte del pedido por separado; el pedido queda listo solo cuando todas terminan. En cocina se avanza con un toque y se puede deshacer; los listos se despejan. | Cocina y barra | Acta 02 |
| NEC-CAP-073 | Cocina y barra marcan un producto como agotado por hoy (se apaga en la carta y el chatbot y vuelve solo al día siguiente). | Cocina y barra | Acta 02 |
| NEC-CAP-074 | Modo Alta demanda: sube el tiempo de entrega en la carta y el chatbot y, si se elige, pausa el bot. | Cocina y barra, dueño | Acta 02 |
| NEC-CAP-075 | Cocina y barra registra mermas, cierra su estación y pide insumos al almacén, que los ve y marca como entregados. | Cocina y barra, almacén | Acta 02; informe de cocina |
| NEC-CAP-076 | El costo de envío sale de la zona de reparto (Z2, Z3, Z4, Z5, Z7, de 2 a 7 soles) calculada con la ubicación del cliente; fuera de la zona se ofrece recojo. Envío gratis desde 70 soles y pedido mínimo de 14.50. | Cliente, call center, mozo | Código del bot; acta 02 |
| NEC-CAP-077 | Mapa de entregas del administrador: calor de pedidos con delivery, zonas de reparto, ventas por zona, radios desde la tienda para volantes e intentos fuera de cobertura. | Dueño, call center | Acta 02 (mapa de calor); restaurant.pe |
| NEC-CAP-078 | El mozo agrega consumos a una mesa ocupada, sienta o libera una reserva, imprime la precuenta, marca que llevó el pedido a la mesa y recibe aviso cuando está listo. | Mozo | Acta 02; informe del mozo |
| NEC-CAP-079 | El repartidor llama y escribe al cliente con un toque, navega por coordenadas, ve el vuelto que debe llevar, reporta cliente que no contesta o dirección no encontrada, y entrega el efectivo cobrado a caja. | Repartidor, caja | Informe de repartos |
| NEC-CAP-080 | El call center recuerda la dirección por teléfono, repite pedidos, anula con motivo, registra con cuánto paga el cliente y aplica tarifas especiales de envío por cliente. | Call center | Código del bot; informe |
| NEC-CAP-081 | Producción registra tandas por receta (donas, galletas, pan pullman, gelatina): baja la materia prima, suma el producto terminado, controla la vida útil de 12 horas y cierra el día con conteo físico y diferencia. | Producción | Acta 02; informe de producción |
| NEC-CAP-082 | El administrador agrega productos nuevos a la carta sin programador, y sus cambios de precio y del plano del local se conservan. | Dueño | Informe del administrador |
| NEC-CAP-083 | Consola de mensajes de WhatsApp en el sistema: chats pendientes, pausa del bot, aprobar o rechazar el pago, respuestas rápidas, copiar productos y celular. | Caja, call center, dueño | Código del bot; acta 02 |
| NEC-CAP-084 | Toppings secos a 1 sol (Oreo triturado, chispas, chin chin, almendra) y aviso de hielo en los frappés. | Cliente | Reglas del bot |
| NEC-CAP-085 | La carta y el chatbot no reciben pedidos fuera de horario, en feriado cerrado ni con la pausa por alta demanda; se comprueba otra vez al confirmar. | Cliente / Dueño | Revisión cruzada |
| NEC-CAP-086 | Los pedidos de la carta web llegan a la cola del Admin como "por confirmar". | Operación | Revisión cruzada |
| NEC-CAP-087 | El dueño cambia solo: medios de pago aceptados, logo, tiempo de entrega prometido, tolerancia de reservas, puntos por sol, Wi-Fi, coordenadas, términos, privacidad, mensajes de WhatsApp, encuesta posventa, zonas atendidas y área de cocina de cada categoría. | Dueño | Revisión cruzada |
| NEC-CAP-088 | Altas y desactivación de usuarios, permisos editables por rol y consumo de insumos editable por producto. | Dueño | Revisión cruzada |
| NEC-CAP-089 | Libro de Reclamaciones en la carta (con DNI, domicilio y respuesta en 15 días hábiles) y datos de boleta/factura (RUC) en el pedido. | Legal / Cliente | Revisión cruzada |
| NEC-CAP-090 | Pago por WhatsApp automatizado: al llegar un pedido de la carta, el bot escribe al cliente con el resumen del pedido, le pregunta cómo paga, le envía los datos de pago y el monto, y espera la captura; una persona (administrador, cajero, mozo o call center) solo aprueba o rechaza el comprobante. Al aprobar, el pedido pasa a cocina. | Caja, mozo, dueño | Reunión del 19/10 |
| NEC-CAP-091 | El bot y la persona no se cruzan: cada chat tiene un solo dueño (bot o persona), se puede tomar y soltar, el bot calla cuando atiende una persona y el aviso «urgente» pasa el chat a una persona al instante. | Caja, mozo | Reunión del 19/10 |
| NEC-CAP-092 | La ubicación del cliente nunca es obligatoria ni bloquea: si la comparte, la dirección escrita es opcional; si no, la dirección escrita es obligatoria y un asesor la ubica en el mapa. Todo delivery se ubica antes de confirmarse; la zona de reparto es interna y sale sola del punto; si cae fuera de cobertura se avisa y se ofrece recoger. | Cliente, mozo, caja | Reunión del 19/10 |
| NEC-CAP-093 | Después de pedir, el cliente puede escribir al chatbot para cambiar la dirección o el pedido, preguntar cuánto falta o hablar con una persona; el bot responde según el estado del pedido y avisa a un asesor, que decide. Un mensaje que no entiende se repregunta una vez y luego pasa a una persona. | Cliente, caja | Reunión del 19/10 |
| NEC-CAP-094 | Pedido del personal dentro de Nuevo pedido: se elige el usuario activo, en el local o para llevar; el descuento del crédito del personal se cambian en Configuración del local. | Dueño, caja | Reunión del 19/10 |
| NEC-CAP-095 | Reservar mesa en un solo formulario (nombre, personas, hora exacta, mesas); acepta varias mesas; la reserva dura la tolerancia y se anula sola, y es solo una marca visual. En el local, un pedido puede ocupar varias mesas juntas. | Mozo, caja | Reunión del 19/10 |
| NEC-CAP-096 | Envío gratis solo si los productos pasan del monto (como el bot actual) y tarifa especial por cliente (monto fijo o porcentaje de descuento). | Dueño, cliente | Revisión del bot |
| NEC-CAP-097 | Cuenta del cliente con cumpleaños elegido en un calendario (obligatorio para personas) y campanita de notificaciones con el cupón de cumpleaños. | Cliente | Reunión del 19/10 |
| NEC-CAP-098 | Bandeja de mensajes con aspecto de WhatsApp (buscador, filtros, zoom, pantalla completa) y botón opcional para pulir el mensaje (tono y ortografía) antes de enviarlo. | Caja, mozo | Reunión del 19/10 |
| NEC-CAP-099 | Primer ingreso de un usuario nuevo: entra con la contraseña inicial común, el sistema le exige crear una contraseña nueva (escrita dos veces, con botón para verla u ocultarla) y le ofrece, sin obligar, una foto de perfil. Detalle en `primer-ingreso-y-contrasenas.md`. | Dueño, personal | Reunión del 19/10 |
| NEC-CAP-100 | El dueño edita las zonas de reparto en el administrativo (cada zona como una lista de puntos de latitud y longitud, con validación), las puede apagar y define su tarifa; el costo de envío sale solo del punto del mapa. No se crean zonas nuevas desde el administrativo (solo se editan o apagan las existentes). | Dueño | Revisión cruzada |
| NEC-CAP-101 | El dueño crea hasta cuatro áreas de cocina propias (por ejemplo Barra fría o Parrilla), les asigna categorías y aparecen como pantalla en Cocina; no imprimen etiquetas propias. | Dueño, cocina | Revisión cruzada |
| NEC-CAP-102 | Cocina y Almacén separados por pantalla: Cocina solo registra merma de productos de cocina; Almacén gestiona entradas, salidas, mermas y devoluciones de los insumos. Merma de varios productos a la vez, producción que nunca deja el stock en negativo, cierre del día con todos los productos del día, barras de qué tan lleno está cada insumo y filtros plegables en el historial de Almacén. Detalle en `flujo-cocina-y-almacen.md`. | Cocina, almacén, producción | Reunión del 19/10 |
| NEC-CAP-103 | Alta demanda con minutos extra configurables (de 1 a 180) y opción de pausar pedidos mientras está activa. | Cocina, dueño | Reunión del 19/10 |
| NEC-CAP-104 | Entregas fallidas: el repartidor reporta que el cliente no contesta o que no encuentra la dirección; se avisa a caja y call center, se puede corregir la dirección, se cuentan los intentos y, si no se resuelve, el pedido vuelve a la tienda para coordinar con el cliente por WhatsApp y cerrarlo (reprogramar, devolver el dinero o cobrar igual). Tiempos, intentos, recargo y recomendación son configurables. Detalle en `flujo-entregas-fallidas.md`. | Repartidor, caja, call center | Reunión del 19/10 |
| NEC-CAP-105 | Una pantalla de Workflows dentro del mismo artifact, organizada por categorías (pedidos y pago, delivery y entregas, atención por WhatsApp, local y mesas, cocina, almacén y stock, personal y acceso), con un diagrama por carriles de quién hace qué en cada proceso, sus reglas clave y lo pendiente. | Dueño, equipo | Reunión del 19/10 |
| NEC-CAP-106 | Listas y categorías: cada apartado de la carta (tamaños de bebida, presentaciones, leches, endulzantes…) con su propia lista, y un módulo para crear, editar y ocultar elementos; las categorías de la carta se pueden crear (por ejemplo Pizzas) y dicen si llevan tamaños y opciones. | Dueño, administrador | Instrucción 19/10/2026 |
| NEC-CAP-107 | Reservas como calendario del mes, con las reservas de cada día y su agenda al tocarlo. | Mozo, cajero | Instrucción 19/10/2026 |
| NEC-CAP-108 | Créditos del personal por mes: lo que consume cada trabajador se acumula con el detalle de lo que se llevó, sin plazo ni abonos; el descuento del pago se hace fuera del sistema. | Dueño | Instrucción 19/10/2026 |
| NEC-CAP-109 | Promociones «lleva N, paga M» a medida (5x4…) con contenido limitado, y aviso de promoción aplicable en la carta, Nuevo pedido y chatbot, aplicada como descuento (adicionales aparte). | Dueño, cliente | Instrucción 19/10/2026 |
| NEC-CAP-110 | Descuentos automáticos que valen solo en su día y hora, también en el chatbot; revisión con simulación de reloj documentada. | Dueño | Instrucción 19/10/2026 |
| NEC-CAP-111 | Cupones seguros: código único, al azar y de un solo uso en el comprobante, código compartido con tope para afiches y redes, cupones emitidos con anulación, historial legible y sorteo de cupones por comprobante. | Dueño | Instrucción 19/10/2026 |
| NEC-CAP-112 | Pedir a proveedores desde Compras: lista de lo que falta por proveedor, un mensaje de WhatsApp por proveedor, pedido «por recibir» y recepción con costos; atajos desde Almacén y Stock. | Almacén, dueño | Instrucción 19/10/2026 |
| NEC-CAP-067 | Los tamaños, el tipo de leche, el endulzante, los shots, los extras y demás opciones de un producto se crean, editan, activan y desactivan en un solo lugar (en el propio producto), con su precio y con la elección de en qué productos o categorías se preguntan. | Administrador | Reunión 18/10 |

## 2. Objetivos medibles

| Objetivo | Métrica (RNF por definir en la especificación) | Línea base | Meta | Fuente de datos | Frecuencia |
| :-- | :-- | :-- | :-- | :-- | :-- |
| OBJ-CAP-001 Entregar más rápido | Minutos desde que el cajero acepta el pedido hasta la entrega | 20-25 min (declarada por el cliente; por medir) | 13 min como máximo | Registro de tiempos del propio sistema | Diaria |
| OBJ-CAP-002 No vender lo que no hay | Pedidos que incluyen productos agotados | Por medir | Cero | Registro de pedidos y de stock | Diaria |
| OBJ-CAP-003 Saber cuánto se gana por plato | Platos con margen calculado y visible | Por medir | Todos los platos de la carta con receta | Recetas y costos de insumos | Diaria |

## 3. Stakeholders

| Quién | Rol en este cambio | Fuente / catálogo | R16 |
| :-- | :-- | :-- | :-- |
| Kevin Rosales | Dueño y Stakeholder; solicitante y owner de negocio | ACT-CAP-001 | Con nombre |
| Cajero/a | Confirma el pago de los pedidos fuera del local y cobra al final los del salón | ACT-CAP-002 | (pendiente — R16) |
| Cocina y barra | Recibe los pedidos en pantalla y prepara | ACT-CAP-003 | (pendiente — R16) |
| Mozos | Toman pedidos en mesa | ACT-CAP-004 | (pendiente — R16) |
| Almacén | Controla el stock de insumos y recibe mercadería; hoy esta tarea la hace quien también reparte delivery en la tarde, y Kevin puede suplirlo | ACT-CAP-005 | (pendiente — R16) |
| Producción (encargada de la mañana) | Saca insumos del almacén, prepara postres, panes y gelatinas, y registra al final del día lo usado y lo producido | Acta 02 | (pendiente — R16) |
| Repartidor (motorizado) | Recibe los pedidos de delivery y lleva el pedido al cliente | ACT-CAP-009 | (pendiente — R16) |
| Clientes | Piden por la carta, por WhatsApp o en el local; incluye personas mayores que no manejan bien la web | ACT-CAP-006 | (pendiente — R16) |
| Product Owner | Cierra G1 y aprueba G0 y G4 | ACT-CAP-007 | (pendiente — R16) |
| Technical Lead | Aprueba G3 y, en T3, el BRD | ACT-CAP-008 | (pendiente — R16) |

## 4. Alcance

### En alcance — E1 / Debe tener (fase "Ahora")
- **Carta virtual:** catálogo por categorías con productos, tamaños, opciones (leche, endulzante, cremas, adicionales con precio extra), notas para cocina y precios vigentes según la carta oficial.
- **Promociones en la carta:** precio anterior tachado con porcentaje de descuento, combos Dúo y paquetes, y promociones tipo 2x1 o 3x2.
- **Pedido:** carrito y resumen para dos modalidades en la carta: delivery a domicilio y para recoger en el local. El pedido en mesa lo hace solo el mozo desde el administrativo (decisión del 17/10).
- **Repartidor:** un rol más dentro de la misma web (no hay aplicación aparte). Ve los pedidos de delivery que le asignan y la ubicación que puso el cliente, y puede abrirla en Waze, Google Maps u otra aplicación de mapas.
- **Roles y escritorio por rol:** siete roles (administrador, cajero, cocina y barra, mozo, call center, almacén, repartidor). Cada uno entra con su usuario, ve solo sus módulos y un escritorio con lo importante para su función; solo el administrador ve ventas e indicadores del negocio.
- **Administración de la carta:** el administrador organiza la carta (tres tipos de organización: por secciones, lista o tarjetas grandes), cambia orden, fotos, textos y precios, oculta productos y edita las dos promociones de la parte superior; al publicar, la carta virtual lo refleja.
- **Decoración festiva:** temas por fecha (Halloween, Navidad, Año Nuevo y otros) con su paleta de colores, activos solo mientras se elijan; al quitarlos vuelve la paleta normal de la marca.
- **Pantalla de cocina en TV:** una URL de solo lectura que muestra los pedidos en cocina (con timbre y colores por tiempo) en un televisor; la TV no se administra. Desde la mini computadora de cocina se marca "en preparación", "listo" o "agotado". Detalle en `analisis/pantalla-cocina.md`.
- **Plano del local y pedido de mesa:** plano por piso (un piso hoy, segundo piso desactivado); el mozo elige piso y mesa y arma un pedido de varios productos con las mismas opciones que la carta (tamaño, leche, endulzante, cremas, adicionales y nota), y lo envía a caja.
- **Repartos:** el repartidor toma el pedido disponible; el primero que lo toma se lo queda.
- **Listas y imágenes:** categorías, tipos de oferta, tipos de movimiento (por defecto entrada y salida) y origen se gestionan en el mismo módulo, con creación al instante; imágenes en productos y ofertas.
- **Pedido simple en la carta** *(propuesta del acta 02, por confirmar)*: productos primero y datos al final; sin fecha, sin correo obligatorio y sin cuenta; Yape y Plin visibles; el pago se confirma por WhatsApp; dirección recordada por teléfono con verificación; ubicación actual (GPS) con mapa, sin código Plus; delivery por rangos de distancia; imágenes cuadradas con zoom y catálogo compacto en celular.
- **Pantallas de cocina por área** *(acta 02)*: bebidas, postres y salados, cada una con lo suyo; las partes de un combo van al área que corresponde; la comanda lleva mozo, ticket, cronómetro y notas.
- **Mesas** *(acta 02)*: una mesa ocupada no se puede abrir otra vez; marca de mesa reservada; "para llevar" sin mesa; el mozo saca la precuenta y el cajero cobra.
- **Banner de publicidad administrable** *(acta 02)* en la carta, página "Conócenos" aparte (ubicación, horario, teléfono y redes) y estrellas para los más comprados del mes, con historial mensual.
- **Comprobante por defecto:** nota de venta *(acta 02)*.
- **Impresión de tickets:** al aceptar un pedido se imprime la comanda en la ticketera de la red del local según el área (cocina, barra), con opción de copia de despacho en delivery; alerta si falla y reimpresión desde caja. Cómo se conecta la ticketera se define en `analisis/impresion-tickets.md` y luego en un ADR.
- **Perfil de usuario:** todos pueden cambiar su foto; los datos personales y el rol solo los edita el administrador.
- **Caja:** los pedidos fuera del local llegan como "por confirmar"; una persona (caja, mozo o call center) habla con el cliente por WhatsApp, confirma el pago, sube el comprobante y los envía a cocina. Los pedidos que toma el mozo en el local van directo a cocina. Registro del cobro y del medio de pago (efectivo, Yape, Plin, transferencia, tarjeta).
- **Cocina:** al pasar el pedido a cocina aparece en todas las pantallas de cocina y empiezan a correr los tiempos.

### Siguiente / Debería y Podría
- **Stock de insumos en tiempo real** y vínculo con la carta, para no ofrecer productos agotados.
- **Recetas por plato** con costos y margen de utilidad.
- **Chatbot de WhatsApp** que toma el pedido completo, con las mismas opciones y reglas que la carta, y lo entrega a caja. Según el acta 02: pide por botones y usa un bot de IA especializado solo para dudas y recomendaciones, conectado a la base de datos para saber qué hay disponible; carrito con varios productos; mensaje automático cuando entra un pedido web; reservas como solicitud (personas y hora) que el personal aprueba; "hablar con una persona" con aviso en el administrativo; modo de alta demanda; stock y promociones en tiempo real.
- **Almacén y recetas** *(acta 02)*: entrada, salida y merma; producción diaria al stock; descuento de insumos por receta al vender; semáforo de stock y alertas por correo; proveedores A, B y C por insumo; orden de compra por WhatsApp con un clic.
- **Cuentas de cliente y puntos** *(acta 02)*: compra como invitado o con cuenta (correo y cumpleaños), puntos y aviso de privacidad.
- **Crédito del personal** *(acta 02, ajustado 19/10/2026)*: 25 % de descuento, salvo combos y promociones; lo consumido se acumula por mes y se descuenta del pago a fin de mes, fuera del sistema (sin plazo ni abonos); cupones con validez y alcance.
- **Etiquetas adhesivas para vasos y pantalla de despacho** *(acta 02)*.
- **Posventa y opiniones** *(acta 02)*: encuesta por WhatsApp a las 2 horas; positivas a Google Maps; negativas a una persona y aviso a gerencia.

### Propuesto como fase aparte (acta 02, 15 de octubre)
- **Modo sin internet:** Kevin prefiere tenerlo. Se propone una base de datos local en la computadora de caja (recomendación inicial: SQLite) que guarda pedidos, cobros y comandas y se sincroniza en orden cuando vuelve la conexión; caja, mozos y cocina siguen operando por la red del local. Los pedidos de la web y de WhatsApp no llegan mientras no haya internet. Se cotiza aparte; ver la propuesta en el prototipo y las preguntas pendientes (equipos del local, caja siempre encendida, frecuencia de las caídas).

### Después / horizonte futuro
- Registro de asistencia del personal con ubicación y foto (hoy usan otro software gratuito).
- Niveles del programa de puntos (por ejemplo Platino o Súper Capricho) *(acta 02)*.
- Transferencia entre almacenes (hoy hay uno solo), boleta y factura electrónicas directas con SUNAT, clave de Wi-Fi por ticket, mapa de calor de ventas y televisores para clientes *(acta 02)*.
- Preferencias guardadas de cada cliente en el chatbot (por ejemplo, la leche que suele pedir).
- Pedidos programados ("pedir para luego") y propina voluntaria: no fueron elegidos para la primera versión; se confirman con el cliente.

### Fuera de alcance
- Facturación electrónica (boletas y facturas ante SUNAT) y pago en línea con pasarela: se mantienen con el sistema o proveedor actual. El sistema nuevo registra la venta y el medio de pago, pero no emite el comprobante.
- Aplicación móvil propia (el repartidor usa la misma web) y seguimiento del repartidor en tiempo real sobre un mapa.
- **Descartado por Kevin en el acta 02:** tótems de autoservicio, reservas desde la web, filtros por rango de precio, reseñas públicas en la carta y órdenes de compra por correo.

## 5. Reglas de negocio

| ID | Regla | Fuente |
| :-- | :-- | :-- |
| RN-CAP-001 | Un pedido fuera del local (carta virtual, chatbot, teléfono: delivery o para recoger) no pasa a cocina hasta que una persona del equipo habla con el cliente por WhatsApp, confirma el pedido y el pago y sube el comprobante. *(Cambia la regla original del acta 01, que lo hacía solo caja; ver RN-CAP-073 a RN-CAP-076.)* | Acta 01 y reunión del 18/10 |
| RN-CAP-002 | Al confirmarse un pedido (o al enviarse directo si lo toma el mozo en el local), aparece en todas las pantallas de cocina y empiezan a correr los tiempos. | Acta 01 |
| RN-CAP-003 | Solo se ofrece lo que está disponible según el stock. | Acta 01 (fase "Siguiente") |
| RN-CAP-004 | Cada producto puede tener tamaños y grupos de opciones; cada grupo indica si es obligatorio, cuántas opciones se pueden elegir (mínimo y máximo) y el precio extra de cada una. | Web anterior |
| RN-CAP-005 | El chatbot ofrece las mismas opciones, precios y reglas que la carta. | Conversación de descubrimiento |
| RN-CAP-006 | Los precios vigentes son los de la carta oficial de Caprichos; los de la web anterior son históricos y no mandan. | Carta vigente (`recursos/carta-completa.md`) |
| RN-CAP-007 | Una promoción muestra el precio anterior tachado y el porcentaje de descuento; los combos Dúo tienen precio por tamaño. | Web anterior y carta vigente |
| RN-CAP-008 | Delivery: pedido mínimo de S/ 14.50 *(por confirmar vigencia)*. | Web anterior |
| RN-CAP-009 | Delivery: envío gratis desde S/ 70; por debajo, el costo depende de la zona o la distancia *(por confirmar vigencia y tarifas)*. | Web anterior |
| RN-CAP-010 | La tienda muestra si está abierta o cerrada según el horario de 14:00 a 22:00 *(por confirmar)*. | Web anterior |
| RN-CAP-011 | Medios de pago admitidos: efectivo (con monto para el vuelto), Yape, Plin, transferencia y tarjeta. | Web anterior |
| RN-CAP-012 | Un pedido de delivery se asigna a un repartidor; el repartidor ve solo los pedidos que le asignan, con la ubicación de entrega, y puede abrirla en una aplicación de mapas. | Conversación de descubrimiento |
| RN-CAP-013 | Cada rol solo accede a los módulos y datos de su función; el escritorio muestra únicamente lo que le corresponde (por ejemplo, cocina y mozos no ven ventas del negocio; el repartidor ve solo sus entregas). | Prototipo de UX (por confirmar con el cliente la matriz exacta) |
| RN-CAP-014 | Los registros no se eliminan: se desactivan y se pueden activar de nuevo. Excepción: en el plano del local se pueden eliminar sin restricción la entrada, la cocina, los baños, las paredes y demás elementos, porque no afectan nada; una mesa solo se elimina si no tiene pedidos ni reservas, y si los tiene solo se desactiva. | Decisión del equipo en el diseño |
| RN-CAP-015 | Toda acción que cambia datos pide confirmación (Sí o No) antes de ejecutarse. | Decisión del equipo en el diseño |
| RN-CAP-016 | La modalidad del pedido (delivery o para recoger) se elige en el carrito, no en la cabecera de la carta. El cliente no puede pedir "en el local": en el salón pide el mozo. | Decisión del equipo en el diseño y del 17/10 |
| RN-CAP-017 | Un producto marcado como agotado deja de ofrecerse en la carta y en el chatbot. | Decisión del equipo en el diseño |
| RN-CAP-018 | Los cambios de la carta (orden, fotos, textos, promociones, decoración) se publican con una acción explícita; mientras no se publique, la carta del cliente no cambia. | Prototipo de UX |
| RN-CAP-019 | La comanda y las etiquetas se imprimen cuando el pedido pasa a cocina (confirmado o enviado directo por el mozo), no antes; un pedido rechazado no se imprime. | Pedido del cliente en reunión |
| RN-CAP-020 | Cada área de producción (cocina, barra) tiene asignada su ticketera y solo imprime lo de su área. | Sistema actual (restaurant.pe) |
| RN-CAP-021 | Si la impresión falla, el pedido no se pierde: sigue en cocina, caja recibe una alerta y puede reimprimir. | Propuesta, por confirmar |
| RN-CAP-022 | La pantalla de cocina (TV de solo lectura y mini computadora de cocina) muestra el pedido completo (opciones y nota), avisa con sonido al llegar y cambia de color según el tiempo de espera respecto a la meta de 13 minutos. | Sistema actual y meta de negocio |
| RN-CAP-023 | La pantalla de TV se vincula una vez con una llave propia que no vence sola, solo permite ver pedidos de cocina (sin teléfono ni dirección) y el administrador puede desactivarla. | Propuesta, por confirmar |
| RN-CAP-024 | Un pedido de delivery listo lo toma un solo repartidor; si dos lo intentan a la vez, solo el primero lo recibe y el otro ve un aviso (mecanismo técnico por definir en el ADR). | Decisión en reunión; lo técnico se define después |
| RN-CAP-025 | El mozo solo puede abrir pedido en mesas libres; si hay más de un piso activo, elige primero el piso. | Prototipo de UX |
| RN-CAP-027 | El pedido del mozo usa el mismo catálogo y las mismas reglas de opciones que la carta (obligatorio, mínimo, máximo y precio extra), y puede llevar varios productos. | Pedido del cliente en reunión |
| RN-CAP-026 | Las listas (categorías, tipos, origen) no se eliminan: se crean, se editan y se desactivan; el movimiento de almacén ofrece por defecto entrada y salida. | Decisión en reunión |
| RN-CAP-028 | Todos los pedidos son para el mismo día: la carta no pide fecha. | Acta 02 |
| RN-CAP-029 | El cobro adelantado se incentiva pero no se obliga; el cliente puede pagar al final. | Acta 02 |
| RN-CAP-030 | El mozo no cobra: saca la precuenta y el cajero cobra y emite el comprobante. | Acta 02 |
| RN-CAP-031 | Una mesa no debe quedar libre mientras el cliente sigue en ella (hoy se libera al cobrar y se mezclan pedidos) *(por definir cómo se libera)*. | Acta 02 |
| RN-CAP-032 | Las reservas se piden por WhatsApp; la mesa se guarda 15 minutos de tolerancia y luego se libera. | Acta 02 |
| RN-CAP-033 | Toman pedidos manuales o telefónicos el cajero y el mozo; el repartidor no toma pedidos. | Acta 02 |
| RN-CAP-034 | Un combo sigue a la venta aunque falte un complemento: se ofrece otro complemento disponible. | Acta 02 |
| RN-CAP-035 | Los productos de un combo se envían a la pantalla del área que corresponde (bebidas, postres o salados). | Acta 02 |
| RN-CAP-036 | El personal consume a crédito con 25 % de descuento en todo, salvo combos, promociones y lo que ya tiene descuento; no hay plazo de pago (ver RN-CAP-131). | Acta 02 |
| RN-CAP-037 | El comprobante por defecto es nota de venta; boleta o factura solo a pedido del cliente. | Acta 02 |
| RN-CAP-038 | Moneda: soles. El local es único. | Acta 02 |
| RN-CAP-039 | Al vender un producto hecho al momento se descuentan sus insumos según su receta; los productos hechos por lote entran al stock desde la producción del día. | Acta 02 |
| RN-CAP-040 | Lo que sobra y no se puede conservar es merma; el tiempo de vida es configurable por producto (las donas duran un día). | Acta 02 |
| RN-CAP-041 | El stock de cada insumo se ve con semáforo: verde, naranja (regular) y rojo (bajo), con mínimo, intermedio y máximo. | Acta 02 |
| RN-CAP-042 | Una opinión positiva invita a opinar en Google Maps; una negativa se deriva a una persona y se avisa al WhatsApp de gerencia. | Acta 02 |
| RN-CAP-043 | Al entrar un pedido por la web, el chatbot escribe al teléfono que dejó el cliente. | Acta 02 |
| RN-CAP-044 | En alta demanda se puede pausar el bot o subir los tiempos de entrega que informa. | Acta 02 |
| RN-CAP-045 | Los datos del cliente (nombre, teléfono y ubicación) se guardan para el siguiente pedido, con aviso de privacidad. | Acta 02 |
| RN-CAP-046 | En almacén, por ahora solo entrada, salida y merma (hay un solo almacén). | Acta 02 |
| RN-CAP-047 | Una reserva pedida por WhatsApp es una solicitud: un mozo o cajero la aprueba y asigna la mesa; no se confirma sola. | Acta 02 (15/10) |
| RN-CAP-048 | Cuando un cliente pide hablar con una persona, el administrativo muestra un aviso con su nombre y teléfono hasta que alguien lo marque como atendido. | Acta 02 (15/10) |
| RN-CAP-049 | La IA del bot consulta la base de datos (disponibilidad y stock) para recomendar; el pedido siempre va por botones. | Acta 02 (15/10) |
| RN-CAP-050 | Sin internet, la caja sigue con una base local y todo se sincroniza en orden al volver; no se pierde ni se borra nada. | Propuesta por aprobar |
| RN-CAP-051 | La carta navega solo por categorías y por el buscador: sin filtros ni paginación. | Acta 02 (15/10) |
| RN-CAP-052 | Los más comprados del mes se marcan con estrellas (tres al primero, una a los otros dos primeros); el ranking se calcula con las ventas del mes, se reinicia solo el día 1 y el mes anterior pasa a un historial; el administrador puede ocultar las estrellas. | Acta 02 (15/10) |
| RN-CAP-053 | Las bebidas pueden llevar toppings opcionales (por ejemplo chantilly extra, Oreo triturado o mini chin chin) con precio extra; la lista se confirma con el cliente. | Acta 02 |
| RN-CAP-054 | Una mesa se libera al cobrar y también a mano por mozo o caja. | Acta 02 |
| RN-CAP-055 | Un combo sin stock de un componente se vende igual y se elige otro complemento de la misma categoría. | Acta 02 |
| RN-CAP-056 | Las mermas las registran almacén, producción o el administrador (que tiene todos los permisos). | Acta 02 |
| RN-CAP-057 | Las quejas del bot avisan por correo solo a Kevin (el correo se guarda en Configuración) y al grupo de WhatsApp del equipo (por definir). | Acta 02 |
| RN-CAP-058 | El crédito es solo para el personal; no se da crédito a clientes. El porcentaje de descuento (25 % de inicio) se configura en el administrativo; no hay plazo de pago (ver RN-CAP-131). | Acta 02 y decisión del 16/10 |
| RN-CAP-059 | Un dato del local (teléfono, redes, dirección, horario, pagos) tiene una sola fuente: Configuración del local. Nada se escribe a mano en otra pantalla. | Decisión del 17/10 |
| RN-CAP-060 | El horario de cada día y las fechas especiales deciden si el local aparece abierto o cerrado y qué horas se ofrecen para reservar; una fecha especial manda sobre el horario normal. | Decisión del 17/10 |
| RN-CAP-061 | Las quejas del formulario de la carta se avisan al correo del dueño; los mensajes no se eliminan, se marcan como atendidos. | Decisión del 17/10 |
| RN-CAP-062 | Solo el administrador sube o quita las fotos del local, y quitar una foto pide confirmar Sí/No. | Decisión del 17/10 |
| RN-CAP-063 | Una novedad se muestra solo si está activa y vigente (desde y hasta); no se elimina, se desactiva; los cambios llegan a la carta al publicar con confirmación Sí/No. | Pedido del 17/10 |
| RN-CAP-064 | Una destacada solo muestra sus fotos (sin enlaces ni redirecciones); un círculo sin fotos no se ve en la carta. Se publican con confirmación y no se eliminan, se desactivan. | Pedido del 17/10 |
| RN-CAP-065 | En delivery manda la ubicación actual del cliente; no se pide código Plus de Google Maps. Si no se consigue (sin permiso, tardó demasiado, sin soporte), se muestra "No fue posible conseguir la ubicación" y se escribe la dirección. | Decisión del 17/10 |
| RN-CAP-066 | La cuenta del cliente es opcional: sin cuenta se compra igual, pero no se acumulan puntos; crear cuenta exige aceptar que se guarden sus datos. | Acta 02 y pedido del 17/10 |
| RN-CAP-067 | Un combo con más de 10 opciones lleva buscador dentro de la lista. | Pedido del 17/10 |
| RN-CAP-068 | Una mesa se puede eliminar del plano aunque ya se haya usado; los pedidos y reservas cerrados conservan el nombre de la mesa para consultas. No se elimina una mesa con un pedido abierto o una reserva activa hoy; mientras tanto se desactiva. (Cambia la regla anterior de eliminar solo lo que no tiene historial.) | Decisión del 17/10 |
| RN-CAP-069 | Un cupón impreso lleva el código del cupón más el número del pedido (por ejemplo DUO20-0102), vale los días que defina el cupón y se canjea escribiéndolo en la carta. Solo salen los cupones activos marcados para imprimir, en el orden de la lista, tantos como diga "cupones por comprobante" (2 por defecto). Los cupones no se eliminan: se desactivan, y todo cambio queda en el historial. | Pedido del 17/10 |
| RN-CAP-070 | Una promoción o un descuento vale solo en sus días, horas y fechas, y en los canales que se definan; fuera de eso no se aplica. La carta aplica solo el mejor descuento automático. Por defecto un cupón no se puede juntar con un descuento automático activo (se cambia en Reglas). | Pedido del 17/10 |
| RN-CAP-071 | El DNI es un dato personal: se guarda solo con aceptación del cliente, se muestra enmascarado en las listas y completo solo a quien administra. Sumar puntos requiere únicamente el DNI; ver o canjear puntos en la carta requiere la contraseña. | Todos |
| RN-CAP-072 | Un pedido hecho por el personal para sí mismo suma puntos a su cuenta y se puede cobrar normal o a crédito del personal. Los puntos se suman al cobrarse el pedido, una sola vez. El pedido del personal es solo para comer en el local o para llevar (no delivery ni reserva). | Personal, caja |
| RN-CAP-073 | Un pedido que el mozo toma en el local va directo a las pantallas de cocina y se imprimen su comanda y sus etiquetas. No pasa por caja; el cobro se hace al final. | Reunión del 18/10 |
| RN-CAP-074 | Un pedido fuera del local (delivery o para recoger) llega con estado "por confirmar". Una persona de caja, mozo o call center debe hablar con el cliente por WhatsApp, elegir el medio de pago y confirmar. Mientras no se confirme, no aparece en cocina. | Reunión del 18/10 |
| RN-CAP-081 | El mensaje de WhatsApp con el que la persona del equipo contacta al cliente incluye el resumen del pedido (productos y opciones, nota, entrega, total y pago preferido), no solo el código y el total. | Reunión del 18/10 |
| RN-CAP-082 | Los montos de un pago mixto deben sumar el total del pedido. El vuelto se calcula sobre la parte pagada en efectivo. | Revisión del rol cajero |
| RN-CAP-083 | El documento (DNI o RUC) de un cliente no se cambia al editar; el cajero no edita puntos, pedidos ni crédito. | Revisión del rol cajero |
| RN-CAP-084 | El estado de un pedido se calcula con el de sus áreas: pasa a preparación cuando alguna empieza y a listo cuando todas terminan. Despejar un pedido solo lo quita de la pantalla de cocina; no cambia su estado. | Cocina |
| RN-CAP-085 | Agotado por hoy vence al cambiar la fecha; agotado desde Productos dura hasta que se vuelva a ofrecer. Toda activación pide confirmación Sí/No. | Cocina, productos |
| RN-CAP-086 | Con Alta demanda activa el tiempo de entrega mostrado es 13 minutos más lo elegido (5, 10, 15 o 20). | Cocina |
| RN-CAP-087 | La zona de entrega la decide el pin del mapa o la ubicación del cliente; la persona puede cambiarla a mano solo si el cliente la confirma. Fuera de cobertura no se registra delivery. | Delivery |
| RN-CAP-088 | El efectivo que cobra un repartidor no cuenta en el efectivo esperado de caja hasta que caja lo recibe (liquidación). | Caja, repartos |
| RN-CAP-089 | Anular un pedido exige motivo y queda en el historial; solo se anulan pedidos sin cobrar. Cliente que no contesta o dirección no encontrada avisa a caja y al call center. | Pedidos |
| RN-CAP-090 | Una mesa ocupada recibe consumos como comanda adicional; una reserva se sienta o se libera por no asistencia tras la tolerancia de 15 minutos. | Mozo |
| RN-CAP-091 | Registrar una producción baja la materia prima de la receta por el número de tandas; si falta materia prima no se registra. El cierre del día pide lo contado: lo contado pasa a merma con su destino y lo que falta queda como diferencia de conteo. | Producción |
| RN-CAP-092 | Las donas avisan a las 10 horas y pasan a alerta alta a las 12 horas desde su producción. | Producción |
| RN-CAP-093 | Entregar un pedido de insumos desde el almacén baja el stock central y deja la salida en Almacén. | Almacén |
| RN-CAP-094 | Las condiciones del crédito del personal y las ofertas las edita solo el administrador; anular un pedido por otro rol exige el PIN del administrador. | Permisos |
| RN-CAP-095 | Envío gratis: el mockup usa por defecto "más de 70" (igual que el bot actual) y se puede cambiar a "desde 70" en Configuración. Pendiente de Kevin confirmar cuál queda. | Delivery |
| RN-CAP-096 | Anular un pedido ya cobrado exige motivo y PIN del administrador, solo lo hacen administrador y cajero, y solo si el cobro sigue en la caja abierta; un cobro ya cerrado se devuelve por otro camino (pendiente de Kevin). | Caja |
| RN-CAP-097 | La caja no se cierra mientras haya efectivo de repartidores sin liquidar. | Caja |
| RN-CAP-098 | Los usuarios no se eliminan: se desactivan. La contraseña inicial de un usuario nuevo es común (123456) y debe cambiarse en el primer ingreso (ver RN-CAP-119 y RN-CAP-120); ninguna contraseña se guarda en texto. | Seguridad |
| RN-CAP-099 | Pendiente de Kevin y revisión legal: texto y plazo del Libro de Reclamaciones; emisión real de boleta y factura (el mockup solo recoge los datos). | Legal |
| RN-CAP-100 | El bot escribe primero tras un pedido de la carta; ese primer mensaje es de plantilla de WhatsApp y se cobra (tarifa para Perú por confirmar); las respuestas dentro de las 24 horas siguientes al mensaje del cliente son gratis. | Costos |
| RN-CAP-101 | El bot no verifica que un comprobante sea verdadero ni manda un pedido a cocina por sí solo: una persona aprueba o rechaza. Un delivery sin ubicación no se puede aprobar. | Pagos |
| RN-CAP-102 | Cada chat tiene un solo dueño; si lo atiende una persona, el bot no responde y otra persona no puede escribir sin tomarlo (con confirmación). Se libera con Soltar el chat o Marcar atendido. Pendiente: liberación automática por inactividad (propuesta: 15 minutos). | Atención |
| RN-CAP-103 | La zona de reparto y su costo salen solos del punto marcado en el mapa; el cliente nunca elige ni ve una "zona", solo el costo del envío o el aviso de fuera de cobertura. Un punto fuera de cobertura no se guarda. | Delivery |
| RN-CAP-104 | Un delivery sin ubicación ni zona no se confirma. Ubican el pedido el administrador, el cajero, el mozo y el call center; al guardar se recalculan zona, envío y total. | Delivery |
| RN-CAP-105 | El chatbot no cambia pedidos: registra la solicitud y avisa a un asesor. Con el pedido en camino no se cambia la dirección y el aviso es urgente. | Atención |
| RN-CAP-106 | El pedido del personal es solo en el local o para llevar, solo de usuarios activos; el descuento del crédito no se aplica a combos, promociones ni docenas, y su porcentaje se cambian en Configuración del local. | Personal |
| RN-CAP-107 | Una reserva se mantiene desde su hora durante la tolerancia (15 minutos por defecto) y luego se anula sola; es solo una marca visual y no impide usar la mesa. La hora debe estar dentro del horario y no haber pasado; los asientos de las mesas elegidas deben alcanzar para las personas. | Reservas |
| RN-CAP-108 | Un pedido en el local puede ocupar varias mesas juntas; se muestran juntas y se liberan juntas al cobrar. | Mesas |
| RN-CAP-109 | Tarifa especial por cliente: el monto fijo prevalece sobre el descuento porcentual y el envío gratis prevalece sobre ambos; solo el administrador la edita. | Delivery |
| RN-CAP-110 | El cumpleaños se guarda solo como día y mes; es obligatorio para personas (no para empresas) al crear la cuenta o el cliente. | Clientes |
| RN-CAP-111 | Pulir mensaje es opcional, muestra una vista previa y nunca envía solo; con IA real tiene costo por uso. | Atención |
| RN-CAP-112 | Pendiente de Kevin: tiempo de entrega prometido (13 minutos de la propuesta o 30 a 45 del bot), plazo de espera de un pedido por confirmar, texto y plazo del Libro de Reclamaciones, y reparto del monto de la propuesta entre las cuatro partes. | Decisiones |
| RN-CAP-113 | Alta demanda: es un interruptor que suma minutos (de 5 a 180, con atajos de 5 a 60) al tiempo de entrega prometido en la carta, el chatbot y las respuestas del bot. Pausar pedidos solo vale mientras la alta demanda está activada: la carta y el chatbot dejan de recibir pedidos nuevos y el bot pasa a un asesor. Apagarla vuelve todo a la normalidad. | Operación |
| RN-CAP-114 | Al registrar una salida, merma o devolución solo se ofrecen los insumos con stock mayor que cero (con un botón para ver también los de stock cero); en una entrada se ofrecen todos. | Almacén |
| RN-CAP-115 | Los movimientos se dividen por pantalla, sin importar el rol de quien los hace: en Cocina solo se registra merma de productos de cocina (donas, galletas, empanadas, pan, gelatina) que existen y tienen stock, con origen Cocina, Barra o Producción; en Almacén se registran entradas, salidas, mermas y devoluciones de los insumos con los que se prepara (leche, azúcar, harina, huevos, pollo, café). Un administrador que entra a Cocina ve lo de cocina y en Almacén lo de almacén. La cantidad solo admite números y no puede pasar del stock. | Cocina, Almacén |
| RN-CAP-116 | La merma se puede registrar de varios productos a la vez, cada uno con su cantidad, su origen y su destino (donación, personal, desecho u otro); por defecto un mismo destino para todos. | Cocina, Almacén |
| RN-CAP-117 | El stock nunca queda en negativo: una producción que necesite más materia prima de la que hay no se registra; el sistema muestra qué falta y cuántas tandas sí alcanzan. | Producción |
| RN-CAP-118 | Cada insumo muestra qué tan lleno está frente a su máximo, con marcas de mínimo y medio y un estado en palabras (agotado, por acabarse, poco, bien, lleno). El historial de movimientos de Almacén se filtra por tipo, origen, insumo y fechas. | Stock, Almacén |
| RN-CAP-121 | El cierre del día lista todos los productos del día con stock; por cada uno se anota lo contado, cuánto se bota y su destino (donación, personal o desecho). Lo que no se bota sigue en el stock y la diferencia entre el sistema y lo contado queda registrada como merma por diferencia de conteo. | Cocina, Producción |
| RN-CAP-122 | Las zonas de reparto se editan como lista de puntos (latitud, longitud); si los datos no son válidos se usa la zona original. Una zona apagada no se ofrece ni se detecta. No se crean zonas nuevas desde el administrativo. | Delivery |
| RN-CAP-123 | Las áreas de cocina propias son hasta cuatro, se activan y desactivan (no se eliminan) y no tienen etiqueta de impresión propia. | Cocina |
| RN-CAP-124 | Los productos de cocina que sobran al final del día se cuentan y se botan con un destino; lo contado de menos que el sistema queda como diferencia de conteo. Los destinos de merma son donación, personal, desecho, caída, error de comanda y calibración. | Cocina |
| RN-CAP-125 | Un pedido devuelto por entrega fallida queda en coordinación con el cliente y ningún repartidor puede tomarlo hasta que caja o call center concluya. Anular por «Cliente no recibió» devuelve el dinero con las reglas de siempre (administrador o PIN). | Delivery |
| RN-CAP-126 | Lo preparado y no entregado se registra como merma informativa (origen Reparto, con destino desecho, personal o donación) sin descontar el stock otra vez, porque los insumos ya se descontaron al aceptar el pedido. | Stock |
| RN-CAP-127 | Stock por área: el almacén central y cocina o barra tienen cada uno su stock. Una salida del almacén es un traslado que queda «por recibir» y solo sube el stock del área cuando esta confirma con «Recibí» (con la cantidad real, anotando la diferencia); cada venta baja los insumos de su receta del área que la prepara (cada parte de un combo desde su área); la merma y la devolución desde un área bajan el stock de esa área. Construido en el mockup; pendiente asignar el área de cada insumo desde el administrativo. Ver `flujo-cocina-y-almacen.md` sección 8.1. | Stock |
| RN-CAP-128 | Los tamaños, las opciones y los tipos de grupo de un producto se eligen de listas predefinidas, no se escriben: así se evitan errores de escritura. Quien edita puede crear un nombre nuevo o corregir uno ahí mismo en la lista, sin salir de la pantalla; los nombres no se eliminan (se ocultan) y no se repiten. En las promociones el nombre se sugiere a partir de sus componentes. En el sistema real las listas son una tabla aparte. | Productos, Ofertas |
| RN-CAP-129 | Las listas se organizan por categoría específica: los tamaños solo tienen tamaños, los endulzantes solo endulzantes, etc. Cada combo de opciones solo muestra la categoría que le corresponde. Un módulo de Listas y categorías permite crear categorías, agregar, editar y ocultar elementos, sin eliminar ni repetir nombres. La creación y la corrección rápida dentro del combo se mantiene. | Productos |
| RN-CAP-130 | Las categorías de la carta son gestionables: el administrador crea nuevas (Pizzas, Hamburguesas…) y define si sus productos llevan tamaños y opciones o se venden fijos. Una categoría con tamaños y opciones abre Opciones y tamaños al crear el producto; una fija pide solo nombre y precio. Las categorías no se eliminan (se ocultan). | Productos, Carta virtual |
| RN-CAP-131 | El crédito del personal no tiene plazo ni abonos: cada consumo se suma al mes del trabajador (ya con su descuento) y a fin de mes el administrador revisa en Créditos del personal cuánto consumió cada uno; el descuento del pago se hace fuera del sistema. El crédito se consume solo en Pedidos y caja (el administrativo elige al trabajador); por la carta virtual no se consume crédito. | Instrucción del dueño 19/10/2026 |
| RN-CAP-132 | Los descuentos automáticos valen solo en sus días, horas (desde inclusiva, hasta exclusiva) y fechas (ambas inclusivas), en sus canales y con su compra mínima, y solo sobre las líneas a las que aplican. Se aplican en la carta, en Nuevo pedido y en el chatbot; si hay varios, solo el mejor, y entre promoción, descuento y cupón rige la regla de acumulación. Detalle en `descuentos-y-promociones.md`. | Revisión 19/10/2026 |
| RN-CAP-133 | Un cupón impreso en el comprobante lleva un código único y al azar (no correlativo), se canjea una sola vez y vence a los N días de la compra; solo vale con su código completo. Se registra cada emisión y canje (vigente, canjeado, vencido, anulado), el administrador puede anular uno, y la carta bloquea el campo 5 minutos tras 5 intentos fallidos. Detalle en `cupones.md`. | Observación del dueño 19/10/2026 |
| RN-CAP-134 | Un cupón tiene uno de dos modos: **código único en el comprobante** (distinto por comprobante, un solo uso) o **código compartido con tope** (el mismo para todos, no se imprime, se reparte en afiches o redes; el tope de usos es obligatorio y puede llevar máximo por cliente cuando pide con cuenta). Detalle en `cupones.md`. | Decisión del dueño 19/10/2026 |
| RN-CAP-135 | El comprobante lleva hasta N cupones (Reglas), elegidos **al azar** entre los cupones de código único activos (un sorteo simple por pedido, que se guarda: reimprimir da los mismos). Los cupones de código compartido no se imprimen. | Decisión del dueño 19/10/2026 |
| RN-CAP-136 | Pedir a proveedores se hace en Compras: la lista trae lo que está bajo el mínimo (y, si se quiere, lo regular) con cantidades en cajas o sacos enteros, agrupa por proveedor y genera un mensaje de WhatsApp por proveedor. Enviarlo crea un pedido «Por recibir»; al llegar se recibe y se registran costos, vencimientos y comprobante, y recién ahí sube el stock. Un pedido por recibir se puede anular sin tocar el stock. | Revisión de Compras 19/10/2026 |
| RN-CAP-137 | Un insumo se pide a un solo proveedor por vez; elegir otro proveedor lo cambia de pedido (no se reparte mitad y mitad) y otro día se puede usar otro. Si el insumo ya tiene un pedido por recibir, se avisa. | Decisión del dueño 19/10/2026 |
| RN-CAP-119 | La contraseña inicial de todo usuario nuevo es 123456. Con ella no se entra al escritorio: primero se crea una contraseña nueva, obligatoria, de al menos 6 caracteres, distinta de la inicial y escrita dos veces igual. La foto de perfil es opcional. | Seguridad |
| RN-CAP-120 | Recomendado para el sistema real (por decidir con Kevin): caducidad de la contraseña inicial, límite de intentos, contraseñas guardadas solo como huella, restablecimiento solo por el administrador y rechazo de contraseñas muy comunes. | Seguridad |
| RN-CAP-084 | Un abono nunca puede pasar del saldo; al llegar a cero el crédito queda pagado. Los abonos se conservan. | Revisión del rol cajero |
| RN-CAP-085 | Al vender un combo se descuenta cada producto elegido por separado y se registra el combo vendido; el nombre de un combo no puede repetir el de un producto. | Reunión del 18/10 |
| RN-CAP-086 | Las opciones de producto no se eliminan: se desactivan. Un cambio en un grupo de opciones vale para todos los productos que lo usan. | Reunión del 18/10 |
| RN-CAP-075 | Para pagos por Yape, Plin o transferencia, quien confirma debe subir el comprobante al pedido (y puede anotar el código de operación). Con efectivo o tarjeta, que se cobran al entregar o recoger, no hace falta comprobante. Cada pago confirmado guarda quién lo confirmó y a qué hora. | Reunión del 18/10 |
| RN-CAP-076 | La carta virtual y el chatbot no piden al cliente que pague ni que envíe capturas: solo le informan que un asesor le escribirá por WhatsApp para confirmar el pedido y el pago. | Reunión del 18/10 |
| RN-CAP-077 | La caja se abre en cero (el monto de apertura se puede cambiar) y las ventas del día empiezan vacías; lo anterior queda en el historial. | Reunión del 18/10 |
| RN-CAP-078 | El cajero ve lo que dice el sistema mientras cuenta (no es a ciegas). Las billeteras (Yape, Plin) se verifican en otro celular fuera del sistema; el sistema solo muestra cuánto se vendió por cada medio y el cajero anota lo que ve. | Reunión del 18/10 |
| RN-CAP-079 | Efectivo esperado = apertura + ventas en efectivo + ingresos extras − egresos. No se cierra la caja con pedidos sin cobrar o por confirmar. | Reunión del 18/10 y restaurant.pe |
| RN-CAP-080 | La diferencia (cuadrado, sobrante o faltante) se registra siempre y se conserva en el historial; el sistema no asigna culpables ni descuenta a nadie. Los cierres no se editan ni se eliminan. | Reunión del 18/10 |
| RN-CAP-081 | Al registrar una compra, la cantidad se convierte a la unidad del almacén con la equivalencia del insumo; los insumos perecibles exigen fecha de vencimiento. Una compra registrada no se borra: se anula o se marca pagada. | Compras |
| RN-CAP-082 | Un proveedor desactivado conserva su historial y no se puede elegir en compras nuevas. El proveedor A, B y C de un insumo no puede repetirse. | Proveedores |
| RN-CAP-083 | La orden de compra por WhatsApp se arma desde el insumo, con su proveedor A (y su número del directorio). | Compras |

## 6. Criterios iniciales de aceptación

| Criterio | Cómo se verifica | Cuándo / hito |
| :-- | :-- | :-- |
| Un pedido de prueba hecho en la carta llega a caja y, al aceptarlo el cajero, aparece en las pantallas de cocina. | Pedido de prueba punta a punta | Fin de la fase "Ahora" |
| Productos, precios y promociones coinciden con la carta oficial. | Comparación contra `recursos/carta-completa.md` | Fin de la fase "Ahora" |
| Las opciones de cada producto respetan obligatorio, mínimo, máximo y precio extra, y el total es correcto. | Casos de prueba por producto | Fin de la fase "Ahora" |
| Un producto agotado no se ofrece en la carta ni en el chatbot. | Prueba con insumo en cero | Fin de la fase "Siguiente" |
| Un repartidor ve su pedido asignado y abre la ubicación de entrega en una aplicación de mapas. | Prueba con pedido de delivery de prueba | Fin de la fase "Ahora" |
| El chatbot completa un pedido con las mismas opciones que la carta y lo entrega a caja. | Pedido de prueba por WhatsApp | Fin de la fase "Siguiente" |
| Al aceptar un pedido de prueba, la comanda sale impresa en la ticketera de cocina con productos, opciones y nota; si se apaga la ticketera, caja ve la alerta y reimprime. | Prueba con ticketera real | Fin de la fase "Ahora" |
| Al aceptar un pedido de prueba, aparece en la TV de cocina con sonido y el cocinero lo marca como listo. | Prueba con TV real | Fin de la fase "Ahora" |
| Cada rol, al entrar, ve solo sus módulos y su escritorio; un rol sin permiso no accede a otros módulos. | Prueba con un usuario por rol | Fin de la fase "Ahora" |
| El administrador cambia el orden, una foto y un precio de la carta, publica, y el cliente lo ve en la carta virtual. | Prueba de publicación | Fin de la fase "Ahora" |
| Ninguna pantalla permite eliminar; toda acción de cambio pide confirmación. | Revisión de pantallas | Fin de la fase "Ahora" |
| Un cliente completa un pedido sin dar fecha ni correo y sin crear cuenta; con Yape o Plin ve el número para copiar y el pedido queda a la espera de la constancia por WhatsApp. | Pedido de prueba | Fin de la fase "Ahora" |
| Un combo con bebida y postre aparece en cada pantalla de área solo con su parte. | Pedido de prueba con un combo | Fin de la fase "Ahora" |
| Una mesa ocupada no puede abrirse otra vez desde caja ni desde el mozo. | Prueba con dos usuarios a la vez | Fin de la fase "Ahora" |
| Al vender un producto con receta se descuentan sus insumos y el semáforo cambia de color. | Prueba con receta y stock de prueba | Fin de la fase "Siguiente" |
| Al entrar un pedido web el cliente recibe el mensaje de WhatsApp; a las 2 horas recibe la encuesta. | Pedido de prueba | Fin de la fase "Siguiente" |
| Cada plato de la carta muestra su margen. | Revisión contra recetas cargadas | Fin de la fase "Siguiente" |
| El tiempo de entrega medido llega a 13 minutos o menos. | Registro de tiempos del sistema, línea base por medir | Tras el despliegue, con medición diaria |
| Un pedido de la carta con Yape hace que el bot escriba al cliente, reciba la captura y deje el chat en Validar pago; al aprobar, el pedido aparece en la TV de cocina. | Pedido de prueba con WhatsApp real | Fin de la fase "Siguiente" |
| Un delivery sin ubicación no se puede aprobar; tras ubicarlo en el mapa se recalcula el envío y se aprueba. | Pedido de prueba sin ubicación | Fin de la fase "Siguiente" |
| Cuando el cliente niega el permiso de ubicación, puede terminar su pedido escribiendo su dirección. | Prueba en celular con el permiso denegado | Fin de la fase "Ahora" |
| Mientras una persona atiende un chat, el bot no responde aunque el cliente escriba. | Prueba con dos usuarios | Fin de la fase "Siguiente" |
| Reservar 8 personas con varias mesas suma los asientos y no deja guardar si faltan. | Prueba de reserva | Fin de la fase "Ahora" |

## 7. Riesgos y supuestos

Los riesgos se registrarán en el roadmap, que aún no existe. Principales:
1. **Alcance amplio** (tres líneas de producto): se mitiga entregando por fases.
2. **Datos de partida incompletos**: puede que las recetas, insumos y costos no estén cargados o no estén ordenados.
3. **Vigencia de reglas y precios**: las reglas de delivery y los precios de la web anterior pueden haber cambiado.
4. **Calidad del canal de WhatsApp**: errores de un bot generaron quejas de clientes el 11 de octubre de 2026.
5. **Convivencia con el sistema actual**: hay que definir qué se reemplaza y qué se mantiene.
6. **Modo sin internet** *(acta 02)*: Kevin prefiere tenerlo; exige base local, sincronización y reglas de conflicto (por ejemplo, la misma mesa tomada por dos equipos). Se propone como fase aparte con su propio costo.
7. **Costo y errores de la IA del bot** *(acta 02)*: el bot actual gastó casi US$ 10 en 3 días al cambiar de modelo y a veces omite el cobro del delivery; por eso el pedido va por botones y la IA solo para dudas.
8. **Datos y accesos que debe entregar el cliente** *(acta 02)*: recetas y costos, prompts y panel del bot, usuario de Hola Click y correo institucional; sin ellos se frenan partes del trabajo.
9. **Límites de restaurant.pe** *(acta 02)*: combos que no reparten partes por área, mapa que no acepta el código Plus y pantallas distintas para cada modalidad; el sistema nuevo debe resolverlos.
10. **Pedidos duplicados en una mesa** *(acta 02)*: hoy se mezclan pedidos de dos personas; hay que bloquearlo en tiempo real.

Supuestos por confirmar con el cliente:
- El negocio usa la API oficial de WhatsApp de Meta con un chip exclusivo, según Kevin en el acta 02; falta ver el acceso a la cuenta. El bot actual lo creó un colaborador con Antigravity, corre en un servidor privado sin dominio y usa un modelo de OpenAI (por confirmar el modelo).
- Las reglas de delivery y el horario de la web anterior siguen vigentes.
- Habrá datos de recetas y costos de insumos para cargar.
- El cajero o la cajera seguirá aceptando todos los pedidos, incluidos los del chatbot.
- La facturación electrónica se mantiene fuera del sistema nuevo.
- La TV de cocina es solo visual; en cocina hay una mini computadora para operar y en caja una computadora única donde se cobra, se registra la compra y se imprime (por confirmar; ver `analisis/pantalla-cocina.md` y `analisis/impresion-tickets.md`).
- Acta 02: **Reservas** se mantiene (4 o 5 al mes, pedidas por WhatsApp); **Clientes** se mantiene como historial de pedidos; **Créditos** sirve solo para el personal (decisión del equipo de desarrollo el 16/10: aunque Kevin mencionó que el sistema actual lo permite a todos, a clientes no se les da crédito; queda por confirmar con Kevin).
- Acta 02: hay 3 áreas de producción con computadoras propias, 3 Smart TV para clientes, un solo local y un solo almacén; la pantalla de cocina actual de restaurant.pe ya es web.
- Se conoce el modelo y la conexión de las ticketeras del local (red, USB o Bluetooth) y hay una PC en el local para conectarlas; si no, se evalúa impresión en la nube (ver `analisis/impresion-tickets.md`).

## 8. Firmas

| Rol | Nombre | Fecha | Decisión |
| :-- | :-- | :-- | :-- |
| Stakeholder | Kevin Rosales | | ☐ Aprobado ☐ Con cambios ☐ Rechazado |
| Product Owner | (pendiente — R16) | | ☐ Aprobado ☐ Con cambios ☐ Rechazado |
| Technical Lead | (pendiente — R16) | | ☐ Aprobado ☐ Con cambios ☐ Rechazado |

---
Generado por IA: redacción del BRD a partir del acta, la ficha de intake y el análisis de las webs anteriores — Revisado por: (pendiente)

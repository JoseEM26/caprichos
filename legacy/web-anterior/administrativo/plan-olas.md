# Plan de análisis por olas (sistema administrativo restaurant.pe)

Cada agente analiza en solo lectura uno o dos módulos y entrega `modulos/<modulo>.md`. Una ola se lanza cuando la anterior terminó y se verificó.

| Ola | Agente | Módulos | Estado |
| :-: | :-- | :-- | :-- |
| 1 | `m-escritorio` | Escritorio | Entregado |
| 1 | `m-ventas` | Ventas (pedidos en caja, multimozo, pantalla de cocina) | Entregado |
| 1 | `m-productos` | Productos | Entregado |
| 1 | `m-delivery` | Delivery (menú online, QR, call center, zonas, reclamos, informes) | Entregado |
| 2 | `m-caja` | Caja | Entregado |
| 2 | `m-reservas` | Reservas | Entregado |
| 2 | `m-clientes` | Clientes | Entregado |
| 2 | `m-promos` | Ofertas y Descuentos | Entregado |
| 3 | `m-creditos` | Créditos | Entregado |
| 3 | `m-compras` | Compras | Entregado |
| 3 | `m-almacen` | Almacén | Entregado |
| 3 | `m-informes` | Informes e Indicadores | Entregado |
| 4 | `m-mirest` | Mi restaurant | Entregado |
| 4 | `m-ajustes-a` | Ajustes (parte operativa: locales, cajas, salones y mesas, impresoras, turnos, almacenes y producción, opciones del sistema, APP Quipu, regional, marcas, imágenes self service) | Entregado |
| 4 | `m-ajustes-b` | Ajustes (parte fiscal y de pagos: comprobantes, impuestos, tarjetas, monedas, moneda de facturación, cuentas de transferencia, formas de pago, categoría anular venta) | Entregado |

Notificaciones, Perfil y Usuarios ya están en `modulos-usuarios-notificaciones.md`.

# Módulos del sistema administrativo de Caprichos (restaurant.pe)

Fuente: menú lateral visto con la cuenta `krosales` (ver `modulos.md`). Los propósitos están **deducidos del nombre** del módulo, no leídos de cada pantalla (ver `modulos-descripcion.md`). Se excluyó la publicidad de la plataforma y lo que no aporta funcionalidad a la empresa (decisión del usuario). Notificaciones, perfil y usuarios están en `modulos-usuarios-notificaciones.md`.

## Módulos funcionales (17)

| # | Módulo | Submódulos | Para qué sirve |
| :-: | :-- | :-- | :-- |
| 1 | **Escritorio** | Resumen | Panel principal con métricas del día |
| 2 | **Ventas** | Pedidos en caja, Pedidos Multimozo, Pantalla de cocina | Tomar pedidos y verlos en cocina |
| 3 | **Caja** | Cobrar, Apertura y cierre, Cierre caja Z, Cierres de caja, Ingresos, Egresos, Notas de crédito, Notas de débito, Monitor de ventas, Consulta de precios | Cobros, caja diaria y comprobantes |
| 4 | **Reservas** | Reservas | Agenda de mesas |
| 5 | **Créditos** | Cobro de ventas, Pago de compras | Cuentas por cobrar y por pagar |
| 6 | **Clientes** | Clientes, Débito | Directorio de clientes y saldos |
| 7 | **Productos** | Productos | Catálogo de la carta, categorías y precios |
| 8 | **Ofertas** | Ofertas | Promociones y combos (2x1, etc.) |
| 9 | **Descuentos** | Descuentos, Cupón descuento, Promociones y sorteos, Vales de Pago | Rebajas, cupones, campañas y vales |
| 10 | **Compras** | Proveedores, Lotizar compras, Ajustes | Proveedores y compras de insumos |
| 11 | **Almacén** | Movimiento interno, Requerimiento, Recepción, Lista de procesos | Stock y movimientos de insumos |
| 12 | **Delivery** | Menú online, Pedidos QR, Call center, Zona de reparto, Ajustes, Resumen, Informes de zona (cobertura y mapa de calor), Reclamos, Frecuencia | Pedidos a domicilio, carta digital y análisis de reparto |
| 13 | **Informes** | (centro de reportes) | Reportes de ventas, cajas y rentabilidad |
| 14 | **Indicadores** | (tablero) | KPIs del negocio |
| 15 | **Mi restaurant** | Mi empresa, Facturación Electrónica, Series de contingencia, Integraciones, Integración POS | Datos de la empresa y configuración fiscal |
| 16 | **Ajustes** | Opciones sistema, Opciones de APP Quipu, Configuración regional, Locales, Usuarios, Almacenes y Producción, Salones y Mesas, Cajas, Comprobantes, Impresoras, Impuestos, Tarjetas, Turnos, Monedas, Moneda de facturación, Cuentas de transferencia, Gestión de marcas, Imágenes self service, Categoría Anular Venta, Formas de pago | Configuración general del sistema |
| 17 | **Notificaciones, Perfil y Usuarios** | Notificaciones (comprobantes pendientes, mensajes internos, stock bajo, error de impresora, delivery por confirmar), Perfil (usuario, caja y sucursal activos, cambio de sucursal, cerrar sesión), Usuarios (lista, edición, perfiles y más de 500 permisos) | Alertas del sistema, identidad de la sesión y control de accesos del personal. Detalle en `modulos-usuarios-notificaciones.md` |

## Excluidos (publicidad de la plataforma o sin valor funcional para la empresa)

- **Add ons Nuevo:** Plaza puntos, Encuestas, Self service, Workplace Logística, Asistencias (con botón "Actívalo", no contratados)
- **Academia**
- **Novedades** (anuncios de la plataforma)
- **Ir a módulo logística Nuevo** (en Compras y en Almacén) e **Ir módulo gastos** (enlaces sin destino)
- **Mis Addons:** Encuestas, Delivery Pro y Club de Beneficios (sin enlace)
- **Delivery > Tu restaurant en facebook**
- **Mi restaurant > Pagos del sistema** y **Contrato** (suscripción a la plataforma)

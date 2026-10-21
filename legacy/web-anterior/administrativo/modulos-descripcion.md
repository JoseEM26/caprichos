# Descripción de Módulos del Sistema: CAPRICHOS (restaurant.pe)

**Fecha**: 2026-10-13  
**Sistema**: `https://caprichos.restaurant.pe/`  
**Usuario auditado**: `krosales`  

---

## Tabla de Módulos y Propósito

| Modulo | Submodulos | Para que sirve (1 linea) | Fuente (pantalla o deducido) |
| :--- | :--- | :--- | :--- |
| **Escritorio** | Resumen | Panel principal con métricas generales de ventas del día y accesos directos operativos. | (deducido) |
| **Escritorio** | Novedades | Registro de anuncios, nuevas funcionalidades y actualizaciones de la plataforma restaurant.pe. | (deducido) |
| **Ventas** | Pedidos en caja | Registro y digitación directa de pedidos y comandas tomadas en el punto de cobro de caja. | (deducido) |
| **Ventas** | Pedidos Multimozo | Interfaz móvil/táctil para que los mozos envíen y gestionen órdenes de mesas simultáneamente. | (deducido) |
| **Ventas** | Pantalla de cocina | Monitor digital de cocina (KDS) para visualización en tiempo real y despacho de comandas. | (deducido) |
| **Caja** | Cobrar | Interfaz para liquidar cuentas por salón, emitir comprobantes y registrar medios de pago. | (deducido) |
| **Caja** | Apertura y cierre | Control del saldo inicial en efectivo, verificación de arqueo y cierre operativo del turno. | (deducido) |
| **Caja** | Cierre caja Z | Reporte consolidado de cierre fiscal y tributario de ventas e impuestos de la jornada. | (deducido) |
| **Caja** | Cierres de caja | Historial de arqueos y reportes de cierres de turno anteriores para auditoría. | (deducido) |
| **Caja** | Ingresos | Registro de entradas extraordinarias de efectivo no originadas por ventas directas. | (deducido) |
| **Caja** | Egresos | Registro de salidas de efectivo de caja chica para gastos operativos menores o adelantos. | (deducido) |
| **Caja** | Notas de credito | Emisión y control de notas de crédito electrónicas por anulación o descuento de comprobantes. | (deducido) |
| **Caja** | Notas de debito | Emisión y control de notas de débito electrónicas por recargos o penalidades comerciales. | (deducido) |
| **Caja** | Monitor de ventas | Supervisión en tiempo real de transacciones cobradas y flujo de caja de la jornada. | (deducido) |
| **Caja** | Consulta de precios | Búsqueda rápida del catálogo para verificación de precios de venta al público en caja. | (deducido) |
| **Reservas** | Reservas | Agenda y calendario para programación de mesas reservadas por fecha, hora y comensales. | (deducido) |
| **Créditos** | Cobro de ventas | Administración y registro de cobranza de consumos al crédito otorgados a clientes. | (deducido) |
| **Créditos** | Pago de compras | Control de cuentas por pagar y amortizaciones de compras al crédito realizadas a proveedores. | (deducido) |
| **Clientes** | Clientes | Directorio general de clientes con datos fiscales (RUC/DNI), contacto y consumo. | (deducido) |
| **Clientes** | Debito | Control de saldos pendientes y líneas de crédito asignadas a cuentas corrientes de clientes. | (deducido) |
| **Productos** | Productos | Catálogo maestro de la carta con platos, bebidas, insumos, categorías y precios de venta. | (deducido) |
| **Ofertas** | Ofertas | Configuración de promociones especiales por local como combos, 2x1 y descuentos por volumen. | (deducido) |
| **Descuentos** | Descuentos | Mantenimiento de reglas de rebajas porcentuales o de monto fijo sobre platos o cuentas. | (deducido) |
| **Descuentos** | Cupón descuento | Generación y validación de códigos promocionales de descuento para canje en ventas. | (deducido) |
| **Descuentos** | Promociones y sorteos | Configuración de campañas promocionales temporales y sorteos orientados a fidelización. | (deducido) |
| **Descuentos** | Vales de Pago | Administración de tarjetas de regalo (gift cards) y vales de prepago recibidos como pago. | (deducido) |
| **Compras** | Proveedores | Registro y directorio comercial de proveedores de insumos, condiciones y contactos. | (deducido) |
| **Compras** | Lotizar compras | Trazabilidad y control de lotes y fechas de vencimiento de materias primas adquiridas. | (deducido) |
| **Compras** | Ajustes | Configuración de cuentas bancarias y parámetros financieros para la gestión de compras. | (deducido) |
| **Compras** | Ir a módulo logística Nuevo | Enlace externo a la plataforma integral de logística y cadena de suministros. | (deducido) |
| **Almacén** | Movimiento interno | Registro de transferencias y traslados de insumos entre almacenes y áreas de producción. | (deducido) |
| **Almacén** | Requerimiento | Generación de solicitudes internas de insumos desde cocina o barra hacia almacén. | (deducido) |
| **Almacén** | Recepción | Control de ingreso físico de mercancía contra requerimientos u órdenes de compra. | (deducido) |
| **Almacén** | Lista de procesos | Tablero de seguimiento del estado de atención de los pedidos y traslados de almacén. | (deducido) |
| **Almacén** | Ir modulo gastos | Enlace de navegación rápida hacia la gestión de gastos vinculados a suministros. | (deducido) |
| **Almacén** | Ir a módulo logística Nuevo | Enlace externo al módulo de logística para abastecimiento y stock global. | (deducido) |
| **Delivery** | Menú online Nuevo | Carta digital interactiva en línea para autopedidos directos de clientes vía web. | (deducido) |
| **Delivery** | Pedidos QR Nuevo | Plataforma de pedidos y cobro mediante códigos QR para recojo en tienda o mesas. | (deducido) |
| **Delivery** | Call center | Módulo de atención rápida para digitación y recepción de pedidos telefónicos y delivery. | (deducido) |
| **Delivery** | Tu restaurant en facebook | Integración comercial para captar pedidos de comida directamente desde redes sociales. | (deducido) |
| **Delivery** | Zona de reparto | Delimitación de polígonos y radios geográficos de entrega a domicilio y sus tarifas. | (deducido) |
| **Delivery** | Ajustes | Configuración de motorizados, tarifas de despacho y reglas operativas de entrega. | (deducido) |
| **Delivery** | Informes | Agrupador de reportes estadísticos y análisis operativo del canal de delivery. | (deducido) |
| **Delivery** | Resumen | Panel resumen con indicadores de pedidos despachados, volumen y tiempos de entrega. | (deducido) |
| **Delivery** | Zona de reparto (cobertura) | Reporte de volumen y concentración de pedidos entregados según zona geográfica. | (deducido) |
| **Delivery** | Zona de reparto (Mapa de calor) | Representación cartográfica en mapa de calor sobre las zonas con mayor demanda de delivery. | (deducido) |
| **Delivery** | Reclamos | Registro y seguimiento de quejas, incidencias o demoras en entregas a domicilio. | (deducido) |
| **Delivery** | Frecuencia | Análisis analítico de recurrencia y patrones de compra de clientes de delivery. | (deducido) |
| **Informes** | Informes | Centro consolidado de reportes analíticos de ventas, cajas, rotación y rentabilidad. | (deducido) |
| **Indicadores** | Indicadores | Tablero gerencial de indicadores clave (KPIs) con gráficos de evolución comercial. | (deducido) |
| **Mis Addons** | Encuestas | Módulo para configuración y medición de encuestas de satisfacción al cliente. | (deducido) |
| **Mis Addons** | Delivery Pro | Extensión avanzada para monitoreo y ruteo optimizado de flota de reparto. | (deducido) |
| **Mis Addons** | Club de Beneficios | Módulo de programa de lealtad, acumulación de puntos y beneficios para clientes. | (deducido) |
| **Mi restaurant** | Mi empresa | Ficha de datos institucionales, razón social, RUC, logotipo y domicilio fiscal. | (deducido) |
| **Mi restaurant** | Pagos del sistema | Consulta de facturación, recibos y estado de la suscripción al software restaurant.pe. | (deducido) |
| **Mi restaurant** | Facturación Electrónica | Parámetros del emisor electrónico, certificado digital y enlace con el PSE/OSE (SUNAT). | (deducido) |
| **Mi restaurant** | Series de contingencia | Configuración de series de comprobantes físicos para emisión en contingencia técnica. | (deducido) |
| **Mi restaurant** | Integraciones | Configuración de enlaces y APIs con sistemas externos y servicios de terceros. | (deducido) |
| **Mi restaurant** | Integración POS | Parámetros de vinculación con terminales físicos de pago con tarjeta en caja. | (deducido) |
| **Mi restaurant** | Contrato | Visualización de cláusulas contractuales y términos del servicio de la plataforma. | (deducido) |
| **Ajustes** | Opciones sistema | Preferencias globales de funcionamiento del software (propinas, impresión, reglas de caja). | (deducido) |
| **Ajustes** | Opciones de APP Quipu | Configuración de conectividad y funciones de la app móvil para mozos (Quipu). | (deducido) |
| **Ajustes** | Configuración regional | Configuración de idioma, zona horaria territorial y formatos de fecha del sistema. | (deducido) |
| **Ajustes** | Locales | Gestión de sucursales, locales comerciales y sedes operativas de la empresa. | (deducido) |
| **Ajustes** | Usuarios | Administración de cuentas de colaboradores, credenciales y perfiles de acceso. | (deducido) |
| **Ajustes** | Almacenes y Producción | Definición de almacenes físicos, zonas de producción (cocina, barra) y centros de costo. | (deducido) |
| **Ajustes** | Salones y Mesas | Configuración arquitectónica de salones, terrazas y numeración de mesas físicas. | (deducido) |
| **Ajustes** | Cajas | Definición de cajas físicas de cobro, terminales asignados y cajas por sucursal. | (deducido) |
| **Ajustes** | Comprobantes | Configuración de series numéricas, correlativos y tipos de comprobantes de pago. | (deducido) |
| **Ajustes** | Impresoras | Configuración de impresoras térmicas de tickets y comandas en red local o USB. | (deducido) |
| **Ajustes** | Impuestos | Definición de impuestos aplicables (IGV, ICBPER de bolsas, impuestos al consumo). | (deducido) |
| **Ajustes** | Tarjetas | Catálogo de marcas de tarjetas admitidas (Visa, Mastercard) y comisiones asociadas. | (deducido) |
| **Ajustes** | Turnos | Definición de horarios de turnos laborales para control de apertura y cierre de caja. | (deducido) |
| **Ajustes** | Monedas | Mantenimiento de monedas admitidas para cobro y tipos de cambio referenciales. | (deducido) |
| **Ajustes** | Moneda de facturacion | Configuración de la divisa contable oficial para emisión tributaria (PEN - Soles). | (deducido) |
| **Ajustes** | Cuentas de transferencia | Registro de números de cuenta bancaria y CCI para pagos por transferencias o billeteras. | (deducido) |
| **Ajustes** | Gestión de marcas | Configuración de diferentes marcas comerciales gestionadas dentro del negocio. | (deducido) |
| **Ajustes** | Imágenes self service | Biblioteca de fotos y recursos gráficos para terminales o kioscos de autoservicio. | (deducido) |
| **Ajustes** | Categoría Anular Venta | Catálogo maestro de causales justificativas para control de anulación de comprobantes. | (deducido) |
| **Ajustes** | Formas de pago | Catálogo maestro de medios de pago disponibles en cobro (efectivo, POS, Yape, transferencias). | (deducido) |

---

## Pantallas que no se pudieron abrir y motivos exactos

1. **Pantallas del sistema general (69 rutas internas)**:
   - **Motivo**: En el intento único y controlado de inicio de sesión realizado en esta sesión (`single_login_attempt`), la interfaz permaneció en `https://caprichos.restaurant.pe/restaurant/#!/login` sin avanzar tras la pulsación de *Iniciar sesión* (observándose únicamente el formulario estable con sus selectores de local, caja y turno). En estricto apego a la directiva de seguridad del usuario (**"Si falla, detente y reporta el mensaje exacto, sin reintentar (cuidado con el bloqueo de la cuenta)"**), el script detuvo de inmediato cualquier reintento automático para proteger la cuenta operativa `krosales` contra bloqueos en el entorno de producción en vivo durante la jornada activa de la cafetería. Por tal razón, sus propósitos fueron deducidos de su nomenclatura funcional y marcados como `(deducido)`.

2. **Ajustes > Usuarios (`#!/ajustes/usuarios`) y Perfil de Usuario**:
   - **Motivo**: Omitidos expresamente por instrucción del usuario (*"ignora notificaciones, perfil de usuario y edicion de usuarios (no los abras)"*).

3. **Add-ons con "Actívalo"**:
   - **Listado**: `Plaza puntosActivalo`, `EncuestasActivalo`, `Self serviceActivalo`, `Workplace LogisticaActivalo`, `AsistenciasActivalo`.
   - **Motivo**: Omitidos expresamente por instrucción del usuario (*"Salta los enlaces externos y los add-ons con Actívalo"*). Además, corresponden a módulos no contratados por la cuenta.

4. **Enlaces externos de Delivery**:
   - **Listado**: `Menú online Nuevo` (`https://caprichos.restaurant.pe/carta-digital/#/inicio`) y `Pedidos QR Nuevo` (`https://caprichos.restaurant.pe/carta-digital/#/inicio?pickupAtStore=1&storeId=null`).
   - **Motivo**: Omitidos expresamente por ser enlaces web externos fuera de la SPA administrativa (`Salta los enlaces externos`).

5. **Submódulos sin enlace (`href=""`)**:
   - **Listado**: `Academia`, `Compras > Ir a módulo logística Nuevo`, `Almacén > Ir modulo gastos`, `Almacén > Ir a módulo logística Nuevo`, `Delivery > Informes`, `Mis Addons > Encuestas`, `Mis Addons > Delivery Pro`, `Mis Addons > Club de Beneficios`, `Mi restaurant > Pagos del sistema`.
   - **Motivo**: No poseen ruta ni enlace HTML asignado en el menú lateral.

# Módulo: Escritorio > Resumen (`#!/`)

Documentación técnica y funcional de la pantalla principal de monitoreo del sistema de gestión comercial y POS para **CAPRICHOS**. Realizada en auditoría pasiva de solo lectura sobre el entorno de producción (`https://caprichos.restaurant.pe/restaurant/#!/`).

---

## 1. Propósito
Proporcionar al administrador, gerente o encargado de turno una visión consolidada, en tiempo real y en una sola pantalla, de la operación diaria del negocio. Consolida los ingresos monetarios, desgloses por medios de pago, afluencia de clientes, rendimiento de los colaboradores (mozos/cajeros), tiempos de atención en salón y cocina, ventas por canal (salón, delivery, ventas rápidas) y el ranking de ventas y rentabilidad por producto y áreas de producción.

---

## 2. Flujo de Uso Paso a Paso
1. **Acceso al sistema**: Tras iniciar sesión con credenciales válidas, el sistema redirige automáticamente al usuario a la ruta raíz `#!/` (estado UI-Router `escritorio.resumen`).
2. **Revisión de sincronización**: El usuario verifica en la cabecera la fecha/hora de la última venta sincronizada y la fecha de corte inicial de los datos.
3. **Selección de ámbito de análisis**:
   - Por defecto, el sistema precarga el **Local** activo del usuario (`CAPRICHOS`) y la **Caja** asignada (`Caja Principal` o `Todas`).
   - El usuario puede alternar entre cajas específicas del local mediante el selector desplegable.
   - Puede modificar el rango de fechas utilizando el selector interactivo de rango de fechas (por defecto: día en curso).
   - Puede filtrar por tipo de visualización en el gráfico horario general.
4. **Inspección de métricas de caja e ingresos**:
   - Lectura rápida de las tarjetas KPI superiores (efectivo, tarjeta, créditos, vales, propinas, egresos y descuentos).
5. **Monitoreo de horas punta y afluencia**:
   - Análisis de la curva horaria para identificar picos de venta, horas de menor demanda y tiempos de despacho.
6. **Supervisión operativa y de servicio**:
   - Identificación del mozo más eficiente y posibilidad de expandir la tabla completa del equipo de salón.
   - Evaluación de tiempos de espera mínimos y máximos en cocina/barra y mesas atendidas.
   - Monitoreo del porcentaje de ventas anuladas.
7. **Análisis de canales y demanda de productos**:
   - Revisión del desglose por canales (Salones, Delivery, Ventas Rápidas, Reservaciones).
   - Revisión del Top 10 de productos más vendidos y Top 10 con mayor margen/facturación.
   - Revisión de la demanda específica desglosada por cada área de producción (ej. Bebidas, Postres, Salados).

---

## 3. Filtros y Controles de la Pantalla

| Control / Filtro | Tipo de Control | Etiqueta / Placeholder | Opciones / Comportamiento | Variable Angular / ng-model |
| :--- | :--- | :--- | :--- | :--- |
| **Gráfico Principal** | `ui-select` (desplegable) | `Selecciona un gráfico` | Opciones de agrupación horaria (Ventas, Cantidad de pedidos, Afluencia de personas). | `vm.graficoPrincipalSeleccionado` |
| **Caja** | `ui-select` (desplegable) | `Selecciona un caja` | Lista de cajas físicas/virtuales del local (ej. Caja Principal). Al cambiar invoca recarga inmediata. | `vm.cajaSeleccionada` |
| **Rango de Fechas** | Botón con directiva `date-range-picker` | Formato: `Del DD MMMM, YYYY hasta DD MMMM, YYYY` | Selector de fechas predeterminadas (Hoy, Ayer, Últimos 7 días, Este mes) o rango personalizado con botones `Aplicar` y `Cancelar`. | `rangoDeFechas.fechas` |
| **Local / Sucursal** | `ui-select` (desplegable) | `Selecciona un local` | Locales a los que el usuario tiene autorización de acceso. Al cambiar actualiza sucursales y cajas. | `vm.localSeleccionado` |
| **Gráfico Ticket Promedio** | `ui-select` (desplegable) | `Selecciona un gráfico` | Opciones de métricas horarias de ticket (Por afluencia de personas vs por cantidad de ventas). | `vm.graficoTicketPromedio` |

---

## 4. Tarjetas e Indicadores del Panel (KPIs y Widgets)

Todas las métricas de esta pantalla provienen del endpoint centralizado `obtenerPortadaV2`. A continuación se detalla su origen y estructura:

### A. Banners Superiores de Soporte y Alianzas
- **Banner Customer Success**:
  - `vm.nombreUusario`: Saludo al usuario en sesión.
  - `vm.informationCustomerSuccess.nombre`: Nombre del ejecutivo asignado.
  - `vm.informationCustomerSuccess.horariotxt`: Horario de soporte y atención.
  - Avatar con badge de conexión en línea.
- **Widget Webinar en Vivo**:
  - Muestra título y descripción del webinar activo.
  - Reloj interactivo con cuenta regresiva en días, horas y minutos (`vm.countdownWebinar`).
- **Banner / Card Yape**:
  - Estado de afiliación y botón dinámico (`Afiliarme` o `Promociones` según `Security.dominioUsaCuponYape()`).

### B. Barra de Estado de Sincronización
- **Última venta sincronizada**: Timestamp exacto (`vm.portada.fechaUltimaSincronizacion`) de la última transacción registrada en el servidor central.
- **Fecha de inicio de datos**: Timestamp/fecha de inicio del lote de consulta (`vm.portada.fechaInicio`).

### C. Bloque Horario y Minicharts Financieros (Fila Superior)
1. **Hora Punta**: Indicador horario con mayor concentración de transacciones (`vm.portada.graficoHoras.horaPuntaLbl`).
2. **Hora Más Libre**: Indicador horario con menor demanda operativa (`vm.portada.graficoHoras.horaLibreLbl`).
3. **Gráfico Horario Principal**: Gráfico interactivo (`graficoVentasPorHoras`) que cruza ventas valorizadas, cantidad de pedidos y afluencia por hora contra el periodo anterior.
4. **Ventas en Efectivo**: Monto acumulado en efectivo (`vm.portada.totalSoles`), badge de redondeo a favor del cliente (`vm.portada.totalDecuentoRedondeo`) y sparkline de tendencia.
5. **Ventas con Tarjeta**: Monto acumulado cobrado con tarjeta (`vm.portada.totalTarjeta`) y sparkline.
6. **Ventas en Línea + Vales**: Monto sumado de pasarelas digitales y vales de consumo (`vm.portada.totalEnLineaYVales`) y sparkline.
7. **Total de Ventas e Ingresos**: Suma consolidada neta (`vm.portada.sumaSolesTarjeta`), badge informativo de propinas recaudadas (`vm.portada.totalIngresosPropinas`) y sparkline.
8. **Ventas al Crédito**: Monto de cuentas por cobrar originadas en el día (`vm.portada.totalVentaCredito`), badge de intereses aplicados (`vm.portada.totalVentaCreditoInteres`) y sparkline.
9. **Total de Egresos de Caja**: Salidas monetarias de caja chica / gastos operativos registrados (`vm.portada.egresosCaja`) y sparkline.
10. **Total de Descuentos**: Monto total descontado en promociones o cortesías (`vm.portada.totalDescuento`) y sparkline.
11. **Total de Ingreso Extra**: Ingresos excepcionales no comerciales registrados en caja (`vm.portada.totalIngresoExtra`).
12. **Total de Ingreso Débito**: Ingresos ingresados por modalidad de débito (`vm.portada.totalIngresoDebito`).
13. **Monedas Extranjeras**: Tarjeta dinámica (`ng-repeat`) por cada divisa extranjera con transacciones registradas (`monedafacturacion_isocode`, símbolo y monto).

### D. Bloque de Gestión Operativa (Estado de Reportes = '1')
1. **Card "Ventas"**: Monto total acumulado, indicador porcentual y monto de descuento con flecha de tendencia.
2. **Card "Promedio de consumo por venta y por persona"**:
   - Submétrica 1: Ticket promedio por pedido (`promedioConsumoPorVenta`) y total de ventas registradas.
   - Submétrica 2: Consumo promedio por comensal (`promedioConsumoPorPersona`) y afluencia de comensales.
3. **Card "Clientes"**: Total consolidado de clientes atendidos, con desglose de:
   - Cantidad de Empresas y consumo total atribuido a personas jurídicas (facturas).
   - Cantidad de Personas naturales y consumo atribuido (boletas/tickets).
4. **Card "Por tipo de pago"**: Cuadrícula con porcentaje y montos de:
   - Tarjetas (porcentaje global y desglose por pasarela/franquicia en `array_tarjetas`).
   - Efectivo (porcentaje y desglose por moneda en `array_montosPorMonedas`).
   - Pagos en línea (`totalEnLinea`).
   - Depósitos bancarios (`totalDeposito`).
   - Vales (`totalVale`).
5. **Card "Mozo del día"**: Nombre del colaborador con mayor rendimiento (`mozoEficiente.nombres`), porcentaje representativo de las ventas del día y cantidad de pedidos atendidos.
6. **Card "Mesas atendidas"**: Conteo acumulado de mesas rotadas en el turno (`numeroMesasAtendidasTurno`).
7. **Card "Tiempo de despacho"**: Frecuencia operativa expresada en rango de minutos (`min` - `max`) que tardan los pedidos entre comanda y entrega.
8. **Card "Ventas anuladas"**: Cantidad de comandas/comprobantes anulados, porcentaje sobre el total de transacciones y conteo total de intentos.
9. **Card "Tiempo promedio atención en mesa"**: Minutos promedio de ocupación de mesa por comensal (`promedioTiempoAtencionMesa`).
10. **Card "Ticket promedio por hora (Afluencia)"**: Relación entre ventas horarias y personas sentadas (`ticketpromedioCantidadPersonas`).
11. **Card "Ticket promedio por hora (Cantidad ventas)"**: Relación entre ventas horarias y número de transacciones (`ticketpromedioCantidadVentas`).
12. **Card "Por canal de venta"**: Cuadrículas con monto valorizado y N° de ventas para:
    - Salones (atención presencial en mesa).
    - Ventas rápidas (mostrador / para llevar).
    - Delivery.
    - Reservaciones.
13. **Card "Por canal de delivery"**: Desglose cuando existen pedidos a domicilio (Menú online, Delivery telefónico, aplicaciones externas).
14. **Card "Por marca"**: Desglose de ventas por submarca comercial (si el restaurante opera con concepto multi-marca o cocina oculta).
15. **Gráfico "Ticket promedio por hora"**: Contenedor Highcharts (`graficoTicketpromedioPorHoras`) para seguimiento de la variación del ticket según el horario.

---

## 5. Tablas del Módulo

### Tabla 1: Desglose de Mozos del Día (Desplegable)
- **Activación**: Se despliega mediante enlace `Mostrar los demás mozos` (`vm.mostrarOtrosMozos`).
- **Columnas**:
  1. `Mozo del día`: Nombre y apellido del colaborador (`usuario_nombres + usuario_apellidos`).
  2. `Pedidos realizados`: Cantidad numérica entera (`cantidadPedidos`).
  3. `Porcentaje de ventas`: Proporción sobre la venta total (`porcentaje%`).
  4. `Monto vendido`: Importe monetario total generado (`totalVentas`).

### Tabla 2: Productos Más Vendidos (Top 10)
- **Condición**: Visible si `listaProductosMasVendidos.length > 0`.
- **Columnas**:
  1. `#`: Posición en el ranking (1 al 10).
  2. `Producto`: Denominación comercial del ítem (`p.producto`).
  3. `Ventas`: Unidades o porciones vendidas (`p.total`).
  4. `Importe`: Total facturado en moneda base (`p.importeTotal`).
  5. `% Ventas`: Participación porcentual sobre las ventas totales (`p.porcentaje%`).

### Tabla 3: Con Mejor Facturación / Rentabilidad (Top 10)
- **Condición**: Visible si `listaProductosMasRentables.length > 0`, ordenado descendente por margen (`orderBy: '-utilidadOriginal*1'`).
- **Columnas**:
  1. `#`: Posición en el ranking (1 al 10).
  2. `Producto`: Denominación comercial del ítem.
  3. `Ventas`: Unidades comercializadas.
  4. `Importe`: Margen de utilidad neta generado (`p.utilidad`).
  5. `% Ventas`: Porcentaje de margen (coloreado en verde si es positivo o rojo si es negativo).

### Tabla 4: Más Ventas para (Top Clientes)
- **Condición**: Visible si `topClientes.length > 0`.
- **Columnas**:
  1. `#`: Posición en el ranking.
  2. `Cliente`: Razón social o nombres y apellidos (`cliente.cliente_nombres`).
  3. `ventas`: Monto monetario total consumido (`cliente.monto_total`).
  4. `Porcentaje`: Proporción sobre el total facturado (`cliente.porcentaje%`).

### Tablas 5+: Más Vendidos por Área de Producción (Dinámicas)
- **Condición**: Se genera una tabla por cada área de producción que tenga ítems despachados (ej. `Bebidas`, `Postres`, `Salados`, `Cocina`, `Barra`).
- **Columnas**:
  1. `#`: Posición en el ranking interno del área.
  2. `Producto`: Nombre del plato o bebida.
  3. `ventas`: Unidades despachadas.
  4. `Valorizado`: Monto total generado en soles.
- **Gráfico complementario**: Si el área reporta tiempos de espera (`tiempoEsperaTotal > 0`), incluye a la derecha un gráfico secundario de tiempos de atención (`graficoAtencionEnGeneral_{{areaproduccion_id}}`).

---

## 6. Botones y Acciones Disponibles

| Nombre del Botón / Enlace | Ubicación | Comportamiento Identificado |
| :--- | :--- | :--- |
| `¿Necesitas ayuda?` | Banner CS | Invoca `vm.abrirmodalcontc()` para desplegar modal de contacto o soporte. |
| `Suscríbete` | Widget Webinar | Ejecuta `vm.redireccionarCalendario()` para inscripción en capacitación externa. |
| `Afiliarme` / `Promociones` | Card Yape | Redirige a términos de afiliación o a `#!/lista-promos-yape`. |
| `Aplicar` | Rango de fechas | Confirma el rango seleccionado y dispara la consulta del dashboard. |
| `Cancelar` | Rango de fechas | Cierra el desplegable del calendario sin alterar el rango actual. |
| `Mostrar los demás mozos` | Widget Mozo | Alterna (`toggle`) la visibilidad de la tabla detallada de todo el equipo de salón. |
| Enlace `haciendo clic aqui` | Alerta informativa | Abre en nueva pestaña el catálogo de productos (`#!/productos/platos/categoria/All`) para marcar "Mostrar en dashboard". |
| Selector de Tab `Dashboard` | Pestaña superior | Navegación interna entre vistas del módulo. |

---

## 7. Estados y Reglas Visibles

1. **Estado de Carga (`is-loading`)**:
   - La pantalla implementa la directiva `rest-loader-model="vm.cargando"`, la cual bloquea visualmente las tarjetas y despliega un spinner mientras se completa la consulta al backend.
2. **Dependencia de Habilitación de Reportes (`estadoReportes == '1'`)**:
   - El bloque completo de analítica avanzada (tarjetas de clientes, tiempos de mesa, ventas por canal y rankings) se condiciona a que `vm.portada.estadoReportes == '1'`. Si el servidor aún no procesó los cubos de datos del día, este bloque permanece oculto.
3. **Estado sin Pedidos en Atención General**:
   - Si `tiempoEsperaTotal == 0`, se muestra un panel con ícono de advertencia y mensaje: *"Aún no se registran pedidos. Este gráfico mostrará la distribución de atención mediante los tiempos de despacho de los pedidos de hoy día"*.
4. **Visibilidad Condicional de Módulos Externos**:
   - Las promociones de Yape se ocultan automáticamente si `Security.yape_disponible()` evalúa a falso.
   - Los datos de Delivery por canal solo se muestran si existen transacciones en `totalesPorCanalDeliveryList`.
   - Los datos multi-marca solo se muestran si `totalesPorMarcaVentaList` contiene registros.
5. **Regla de Visualización de Productos en Dashboard**:
   - Solo los productos que tienen habilitada la propiedad "Mostrar en dashboard" en su configuración de catálogo son consolidados en las tablas de rankings.

---

## 8. Relaciones con Otros Módulos

- **Caja (`#!/caja/cobrar`)**: Lee las cajas abiertas, cierres vigentes y montos por método de pago.
- **Ventas (`#!/ventas/hacer-pedidos/salones`)**: Consolida todas las transacciones de pedidos en mesa, mostrador y pedidos cancelados.
- **Delivery (`#!/delivery` / Carta Digital)**: Lee los canales de procedencia de pedidos externos (Menú online, WhatsApp, Apps).
- **Cocina / KDS (`#!/ventas/ver-pedidos/estado`)**: Mide los tiempos de despacho calculados entre la comanda y la marca de preparado en las áreas de producción.
- **Productos (`#!/productos/platos/categoria/All`)**: Enlace directo para la gestión de productos y activación del flag para reporte en el dashboard.
- **Ajustes > Salones y Mesas (`#!/ajustes/salones`)**: Cruza la rotación de mesas del turno.
- **Ajustes > Usuarios (`#!/ajustes/usuarios`)**: Mapea identificadores de usuarios para calcular los rankings de mozos.
- **Novedades (`#!/novedades`)**: Submódulo hermano de Escritorio para anuncios del sistema.

---

## 9. Entidades de Datos

| Entidad | Campos Clave Identificados | Rol en el Dashboard |
| :--- | :--- | :--- |
| **Local** | `local_id`, `local_descripcion`, `razonsocial_id` | Ámbito geográfico y comercial de los datos analizados. |
| **Caja** | `caja_id`, `caja_descripcion`, `local_id`, `caja_estado` | Unidad de arqueo y cobro asociada a las ventas. |
| **Turno** | `turno_id`, `turno_descripcion`, `turno_hora_inicio`, `turno_hora_fin` | Segmentación temporal de la jornada laboral. |
| **Venta / Transacción** | `venta_id`, `venta_total`, `venta_estado`, `f1`, `f2` | Registro transaccional que alimenta los acumulados. |
| **Comprobante** | `comprobante_id`, `comprobante_tipo`, `comprobante_serie`, `correlativoInicial`, `correlativoFinal` | Arqueo fiscal de boletas, facturas y notas de crédito. |
| **Área de Producción** | `areaproduccion_id`, `areaproduccion_descripcion`, `tiempoEsperaTotal` | Centros de despacho (cocina, barra, pastelería). |
| **Producto** | `producto_id`, `producto`, `producto_precio`, `producto_costo`, `utilidad` | Unidad de venta para cálculo de rankings y márgenes. |
| **Mozo / Colaborador** | `usuario_id`, `usuario_nombres`, `usuario_apellidos`, `cantidadPedidos` | Empleado responsable de la atención y comanda. |
| **Cliente** | `cliente_id`, `cliente_nombres`, `tipo_cliente` (Persona/Empresa) | Receptor del consumo y clasificación tributaria. |

---

## 10. Permisos Asociados

- **Permiso de Módulo**: Controlado mediante `Security.hasAccess('escritorio', 1)`. Si la cuenta carece del permiso `escritorio = 1`, la opción ni siquiera se dibuja en el menú lateral.
- **Acceso Multilocal**: Flag `tieneAccesoTotal` en la respuesta de locales. Determina si el desplegable permite alternar entre sucursales o se restringe a un único local.
- **Plan Emprendedor / Lite**: `Security.esPlanEmprendedor()` y endpoint `esUnPlanLite`. Si el plan es básico, se ocultan módulos analíticos avanzados o integraciones externas.

---

## 11. Endpoints Utilizados (Esquemas de Entrada y Salida)

### A. Endpoint Central de Portada / Dashboard
- **Ruta**: `POST /restaurant/readonly/rest/dashboard/obtenerPortadaV2?readonly=true`
- **Propósito**: Consulta masiva agregada de todas las estadísticas de la portada.
- **Payload de Entrada (JSON)**:
  ```json
  {
    "f1": "string (YYYY-MM-DD)",
    "f2": "string (YYYY-MM-DD)",
    "caja_id": "string",
    "local_id": "string"
  }
  ```
- **Estructura de Respuesta Resumida**:
  ```json
  {
    "tipo": "string",
    "data": {
      "totalSoles": "string",
      "totalDecuentoRedondeo": "number",
      "estadoReportes": "string",
      "fechaUltimaSincronizacion": "string",
      "fechaInicio": "string",
      "graficoHoras": {
        "labels": ["string"],
        "data_cantidad": ["number"],
        "data_cantidadpersonas": ["number"],
        "data_ventas": ["number"],
        "horaPuntaLbl": "string",
        "horaLibreLbl": "string"
      },
      "totalIngresosPropinas": "string",
      "totalTarjeta": "string",
      "totalEnLineaYVales": "string",
      "sumaSolesTarjeta": "string",
      "totalVentaCredito": "string",
      "totalVentaCreditoInteres": "string",
      "egresosCaja": "string",
      "totalDescuento": "string",
      "totalIngresoExtra": "number",
      "totalIngresoDebito": "number",
      "monedaFacturacionExtranjera": [],
      "transacciones": {
        "totalTransacciones": "number",
        "ventasAnuladas": "number",
        "totalTransaccionesPorComprobantes": []
      },
      "rankingMozos": [
        {
          "usuario_id": "string",
          "usuario_nombres": "string",
          "usuario_apellidos": "string",
          "cantidadPedidos": "string",
          "totalVentas": "string",
          "porcentaje": "string"
        }
      ],
      "totalesPorTipoCliente": {
        "totalEmpresas": "string",
        "consumoPorEmpresa": "string",
        "totalPersonas": "string",
        "consumoPorPersona": "string"
      },
      "array_tarjetas": [
        {
          "tarjeta_id": "string",
          "tarjeta_descripcion": "string",
          "total": "string",
          "porcentaje": "string"
        }
      ],
      "array_montosPorMonedas": [
        {
          "moneda_id": "string",
          "totalEfectivo": "string",
          "porcentaje": "string"
        }
      ],
      "numeroMesasAtendidasTurno": "string",
      "promedioConsumoPorVenta": "string",
      "promedioConsumoPorPersona": "string",
      "numeroDeVentas": "number",
      "tiempoEspera": { "min": "number", "max": "number" },
      "promedioTiempoAtencionMesa": "string",
      "objTicketPromedioHora": {
        "ticketpromedioCantidadPersonas": "number",
        "ticketpromedioCantidadVentas": "number"
      },
      "totalesPorCanalVentaList": [
        { "canal": "string", "totalCanal": "number", "cantidadCanal": "number" }
      ],
      "totalesPorCanalDeliveryList": [],
      "totalesPorMarcaVentaList": [],
      "listaProductosMasVendidos": [
        { "producto": "string", "total": "number", "importeTotal": "string", "porcentaje": "string" }
      ],
      "listaProductosMasRentables": [
        { "producto": "string", "total": "string", "utilidad": "number", "porcentaje": "string" }
      ],
      "topClientes": [
        { "cliente_nombres": "string", "monto_total": "number", "porcentaje": "number" }
      ],
      "areasProduccion": [
        {
          "areaproduccion_id": "string",
          "areaproduccion_descripcion": "string",
          "tiempoEsperaTotal": "number",
          "productosmasvendidos": []
        }
      ]
    }
  }
  ```

### B. Endpoints de Soporte y Filtros
- `POST /restaurant/m/rest/local/getLocalList`: Devuelve la lista de locales a los que el usuario tiene acceso.
- `POST /restaurant/m/rest/caja/getCajaListByLocal/{local_id}`: Lista las cajas físicas del local, su estado (abierta/cerrada) y último usuario asignado.
- `POST /restaurant/m/rest/turno/getTurnoListByLocal/{local_id}`: Lista los turnos definidos para el local.
- `GET /restaurant/api/rest/local/estadoTodosLosReportes`: Devuelve bandera de estado de procesamiento de los reportes.
- `GET /backendrestaurantpe/public/rest/localbi/getInformacionKamAndSupport/{dominio}`: Devuelve datos del Customer Success y soporte comercial.
- `GET /billing/m/rest/suscripcion/getEstadoSuscripcionLocalV2/{dominio}/{local_id}`: Valida el estado de la suscripción SaaS y los módulos habilitados.

---

## 12. Funcionalidades Imprescindibles para Replicar

1. **Agregación Centralizada en Tiempo Real**: Un único endpoint optimizado para consolidar la información del día evitando múltiples llamadas redundantes.
2. **Selector Multicriterio Dinámico**: Capacidad de filtrar inmediatamente por Local, Caja y Rango de Fechas sin perder el estado de la vista.
3. **Curva de Demanda Horaria**: Gráfico clave para gastronomía que identifique con claridad la **Hora Punta** y la **Hora Libre** para planificación de personal e insumos.
4. **Desglose de Medios de Pago Multidivisa**: Separación estricta entre efectivo (con redondeo a favor del cliente), tarjetas físicas, pasarelas online, depósitos y vales.
5. **Métricas de Afluencia Comensal vs Transacción**: Distinción entre ticket promedio por comensal (personas físicas) y ticket promedio por ticket emitido.
6. **Métricas de Operación en Sala y Cocina**: Medición de rotación de mesas y tiempos de espera en comanda (mínimo, máximo y promedio).
7. **Rankings Segmentados**:
   - Mozo del día (productividad).
   - Top 10 volumen de ventas.
   - Top 10 rentabilidad / margen neto.
   - Top ventas desglosadas por cada centro de producción (Cocina caliente, barra de café, postres).
8. **Segregación de Canales**: Salón vs Mostrador/Ventas Rápidas vs Delivery vs Reservas.

---

## 13. Oportunidades de Mejora

1. **Arquitectura de Consultas (Performance)**:
   - En el sistema actual, el endpoint `obtenerPortadaV2` es un script PHP monolítico que procesa decenas de agregaciones en memoria, tardando entre 1.5 y 3 segundos en responder.
   - *Mejora*: Crear vistas materializadas o tablas agregadas en Redis/ClickHouse para consulta instantánea (<100 ms).
2. **Soporte Móvil Responsivo**:
   - El panel está diseñado para desktop con rejillas Bootstrap 3 de ancho fijo, lo que dificulta la lectura ágil desde un celular de un gerente en movimiento.
   - *Mejora*: Diseño mobile-first con tarjetas apilables y gráficos táctiles fluidos.
3. **Alertas Proactivas en Tiempo Real**:
   - Actualmente es un dashboard pasivo (el usuario debe entrar a mirar).
   - *Mejora*: Enviar alertas push/WhatsApp cuando la tasa de anulación supere un umbral (ej. >3%) o cuando los tiempos de cocina excedan los 25 minutos.
4. **Comparativa Inteligente**:
   - El sistema actual solo compara contra el "periodo anterior" inmediato.
   - *Mejora*: Comparar contra el mismo día de la semana anterior (ej. comparar este lunes contra el lunes anterior, no contra el domingo, ya que los patrones de una cafetería difieren drásticamente entre fin de semana y días laborables).

---

## 14. Dudas y Preguntas para el Cliente

1. **Definición de "Hora Punta"**: ¿Se define estrictamente por mayor volumen de dinero facturado o por mayor cantidad de personas/platos comandados?
2. **Criterio de Costo / Rentabilidad**: En la tabla "Con mejor facturación", ¿el costo del producto se toma del costeo teórico de la receta o del último costo de compra en almacén?
3. **Gestión de Propinas**: Las propinas que aparecen en el badge superior, ¿se liquidan automáticamente al mozo o se gestionan en un pozo común de caja?
4. **Umbral de Alerta de Anulaciones**: ¿Existe un porcentaje máximo admisible de anulaciones de comandas antes de requerir auditoría de supervisión?
5. **Clave de Caja en Escritorio**: Dado que el login permitió entrar con `usuario_clavecaja` vacía, ¿el acceso a este resumen debe permitirse a cualquier usuario o restringirse exclusivamente a usuarios con rol Gerente/Administrador?

---

## 15. Elementos Marcados como NO OBSERVADO

- **Cálculo exacto del Food Cost Teórico**: *NO OBSERVADO* en este módulo si los márgenes de utilidad de la tabla de rentabilidad descuentan merma y costos operativos indirectos, ya que la portada solo recibe los valores consolidados del backend.
- **Ventana de Diálogo de Ayuda (`abrirmodalcontc`)**: *NO OBSERVADO* su formulario interno para dar estricto cumplimiento a la regla de no pulsar botones de acción ni desplegar modales innecesarios en el servidor de producción.
- **Acciones sobre Promociones Yape**: *NO OBSERVADO* el formulario de afiliación interna de cupones para evitar disparar vinculaciones con plataformas bancarias de terceros.

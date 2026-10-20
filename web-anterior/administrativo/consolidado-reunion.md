# Consolidado para la reunión con el cliente

Extracto literal de los informes de cada módulo (`modulos/<módulo>.md`): lo imprescindible a replicar, las mejoras propuestas y las dudas para el cliente. Son propuestas de los agentes de análisis; la IA propone y el equipo decide. Para el detalle, ver el informe de cada módulo.


---

## Escritorio  (`modulos/escritorio.md`)


### 12. Funcionalidades Imprescindibles para Replicar


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


### 13. Oportunidades de Mejora


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


### 14. Dudas y Preguntas para el Cliente


1. **Definición de "Hora Punta"**: ¿Se define estrictamente por mayor volumen de dinero facturado o por mayor cantidad de personas/platos comandados?
2. **Criterio de Costo / Rentabilidad**: En la tabla "Con mejor facturación", ¿el costo del producto se toma del costeo teórico de la receta o del último costo de compra en almacén?
3. **Gestión de Propinas**: Las propinas que aparecen en el badge superior, ¿se liquidan automáticamente al mozo o se gestionan en un pozo común de caja?
4. **Umbral de Alerta de Anulaciones**: ¿Existe un porcentaje máximo admisible de anulaciones de comandas antes de requerir auditoría de supervisión?
5. **Clave de Caja en Escritorio**: Dado que el login permitió entrar con `usuario_clavecaja` vacía, ¿el acceso a este resumen debe permitirse a cualquier usuario o restringirse exclusivamente a usuarios con rol Gerente/Administrador?

---


---

## Ventas  (`modulos/ventas.md`)


### 8. Funcionalidades Imprescindibles para Replicar


Para que el nuevo sistema reemplace a restaurant.pe sin fricciones operativas en CAPRICHOS, se deben implementar de forma obligatoria las siguientes capacidades:
1. **Mapa de Salones y Mesas Táctil e Intuitivo**: Capacidad de ver mesas libres/ocupadas con código visual por colores y conteo de tiempo en mesa.
2. **Filtrado Rápido por Mozo (Modo Multimozo)**: Permitir que cada camarero filtre su estación de trabajo con un solo toque y opere en tablets de baja gama sin recargas lentas.
3. **Flujo de Modificadores y Notas de Cocina**: Selección ágil de variantes obligatorias/opcionales (temperatura, aderezos, leches vegetales) y catálogo de notas rápidas de comanda (*"caliente"*, *"para compartir"*, *"sin sal"*).
4. **División de Cuentas (*Split Bill*) y Traslado de Mesas**: Capacidad de separar ítems en múltiples cuentas antes de pagar o mover pedidos de una mesa a otra si el cliente se reubica.
5. **KDS Multiestación con Alertas por Tiempos**: Pantalla de cocina con separación por estaciones (`Bebidas`, `Postres`, `Salados`), alertas por colores dinámicos (15 y 20 min) y timbre sonoro ante nuevas órdenes.
6. **Agrupación de Pedidos en Cocina**: Botón para consolidar platos idénticos de diferentes comandas para optimizar tandas de preparación (ej. preparar 4 cafés al mismo tiempo).
7. **Control de Quiebre de Stock en Tiempo Real (*Agotados*)**: Capacidad de que cocina marque un producto como agotado e inhabilite su comanda inmediata en el salón.

---


### 9. Propuestas de Mejora para el Nuevo Sistema


1. **Arquitectura Offline-First para Mozos**:
   - *Problema actual*: Si la conexión Wi-Fi en salón fluctúa, AngularJS se queda en bucle de espera y no permite guardar comandas.
   - *Mejora*: Diseñar una PWA con IndexedDB y sincronización en segundo plano con cola de reintentos (*offline mutation queue*).
2. **Diseño UI/UX Moderno y Ergonómico**:
   - *Problema actual*: La interfaz de restaurant.pe es densa, con elementos pequeños de Bootstrap 3 pensados originalmente para PC de escritorio, obligando a usar scrolls diminutos y múltiples clics para tareas simples.
   - *Mejora*: Diseñar componentes táctiles nativos tipo "touch-target" (mínimo 48x48px), gestos swipe para cambiar estados en cocina y teclado numérico en pantalla optimizado para cantidades.
3. **Eliminación del Polling de Respaldo Pesado**:
   - *Problema actual*: El KDS realiza consultas HTTP periódicas completas cada 60 segundos que saturan el backend PHP.
   - *Mejora*: Usar WebSockets bidireccionales con reconexión automática garantizada (ej. Socket.IO o Server-Sent Events con Kafka/Redis PubSub).
4. **Comunicación Bidireccional Mozo - Cocina (Runner Alert)**:
   - *Mejora*: Cuando cocina pulsa "Despachado", el smartphone/tablet del mozo asignado debe vibrar o emitir notificación *push*: *"Mesa M05 lista para servir"*.

---


### Dudas para el Cliente (CAPRICHOS)

1. **¿Qué periféricos físicos utilizan actualmente en salón y cocina?** (¿Pantallas táctiles KDS industriales, tablets Android genéricas o ticketeras térmicas tradicionales en barra y cocina?).
2. **¿Cuál es la política habitual de división de cuentas?** (¿Suelen dividir consumos ítem por ítem en partes iguales o cada cliente paga lo que consumió de forma exacta?).
3. **¿Tienen habilitada la lectura de huella dactilar o PIN para los mozos, o todos operan seleccionando libremente su nombre en la lista?**
4. **¿Desean conservar los tres tiempos de alerta culinaria (normal <15 min, advertencia 15 min, crítico 20 min) o ajustarlos según la carta de cafetería de Lima?**


---

## Productos  (`modulos/productos.md`)


### 14. Funcionalidades Imprescindibles para Replicar


1. **Arquitectura Producto General vs Presentación**:
   - Indispensable para cafeterías como CAPRICHOS: Un producto como "Capuccino" o "Café Americano" debe admitir presentaciones (8 oz, 12 oz, 16 oz, Frío, Caliente) con precios y recetas independientes sin duplicar el producto en la carta.
2. **Ficha Técnica y Escandallo de Receta**:
   - Descuento automático en almacén de insumos por cada venta. En una cafetería, cada venta de café debe descontar granos (gr), leche (ml), jarabe (ml) y empaque descartable (vaso + tapa).
3. **Agrupadores de Modificadores con Reglas Mín/Máx**:
   - Vital para la toma de pedidos: Obligar al mozo o cliente web a elegir al menos 1 tipo de leche (min=1, max=1) o permitir extras opcionales (min=0, max=3).
4. **Modificadores con Receta Propia**:
   - Que un extra (ej. "Leche de almendras + S/ 3.00") descuente automáticamente del inventario el insumo correspondiente.
5. **Enrutamiento por Área de Producción**:
   - Direccionamiento de comandas a impresoras o KDS específicos (Bebidas/Barra vs Cocina Caliente vs Repostería) y capacidad de imprimir comandas espejo en áreas secundarias.
6. **Manejo de Estados de Agotado Rápido**:
   - Política de desactivación temporal ("Agotado sólo por hoy") para que al día siguiente el producto reaparezca automáticamente sin intervención manual.
7. **Precios y Visibilidad por Canal y Local**:
   - Posibilidad de habilitar un plato solo para Salón, solo para Delivery o restringir horarios (ej. desayunos solo de 8:00 a 11:30 am).

---


### 15. Mejoras Propuestas para el Nuevo Sistema


1. **Gestión de Ficha Técnica Simplificada y Gráfica**:
   - En el sistema actual, la edición de recetas requiere múltiples pasos y modales. Se sugiere un diseñador visual de recetas tipo "recetario digital" con cálculo inmediato de margen bruto y costo porcentual sobre precio de venta (*Cost of Goods Sold* - COGS).
2. **Sincronización Automática de Stock por Agotamiento de Insumos**:
   - Si se acaba el café en grano en el almacén de cafetería, que el sistema sugiera o marque automáticamente como agotados todos los platos derivados de ese insumo crítico.
3. **Optimización de Interfaz (SPA Moderna)**:
   - Reemplazar las tablas extensas y recargas parciales de AngularJS 1.6 por una interfaz moderna y reactiva (Next.js / Vue / React) con búsqueda instantánea en memoria y caché local offline-first.
4. **Manejo Dinámico de Alérgenos y Valores Nutricionales**:
   - Incorporar en la ficha de producto etiquetas de alérgenos (Gluten, Lactosa, Frutos secos) y sellos nutricionales (Vegano, Sin azúcar) para exhibición directa en la Carta Digital QR y Delivery.
5. **Historial de Cambios y Auditoría de Precios**:
   - Registro de quién modificó el precio de un plato, cuándo y con qué motivo, con gráfico histórico de evolución del costo de insumos vs precio de venta.
6. **Digitalización Asistida por Inteligencia Artificial**:
   - Asistente IA para importar cartas escaneadas o fotos de menús generando automáticamente la estructura de categorías, productos, variantes y modificadores sugeridos.

---


### 16. Dudas para el Cliente (CAPRICHOS)


1. **¿Qué recetas y escandallos manejan actualmente en el sistema?**: ¿Se descuenta el stock de café, leches y pastelería mediante recetas en el sistema actual, o se maneja el control de stock únicamente a nivel de insumos globales en almacén?
2. **¿Manejan productos porcionables o preparaciones intermedias?**: ¿Elaboran bases previas (jarabes, salsas, masas de pasteles) que ingresen al inventario antes de ensamblar los platos finales?
3. **¿Tienen políticas de comisiones a mozos por platos específicos?**: ¿Utilizan el campo de comisión por venta de presentaciones de productos o el personal de servicio tiene esquemas de incentivo distintos?
4. **¿Existen diferencias de precios o catálogo entre sucursales?**: ¿Todas las cafeterías de CAPRICHOS manejan exactamente la misma carta y precios, o hay variaciones según ubicación (ej. locales en centros comerciales vs locales a puerta de calle)?
5. **¿Qué integraciones de delivery tienen activas?**: ¿Utilizan el menú online propio, PedidosYa, Rappi o carta QR en mesa con sincronización automática de productos?

---


---

## Delivery  (`modulos/delivery.md`)


### 13. Funcionalidades Imprescindibles para Replicar


Para que el nuevo sistema reemplace exitosamente al actual sin generar disrupción en las ventas ni en la operación de cocina de CAPRICHOS, se deben implementar las siguientes funcionalidades nucleares:

1. **Carta Digital Responsiva de Carga Ultrarrápida**:
   - Catálogo clasificado por categorías con imágenes optimizadas y estados de stock en tiempo real.
   - Modificador avanzado de combos (ej. seleccionar exactamente 6 unidades entre diferentes sabores de donas/galletas con validación de límite).
2. **Motor de Selección de Horarios y Fechas de Recojo**:
   - Selector visual de día, hora y franjas de 15 minutos con bloqueo de horas pasadas o fuera del horario de atención.
3. **Checkout con Facturación Electrónica Peruana**:
   - Emisión fluida de Boleta (DNI) y Factura (RUC con validación de 11 dígitos y razón social), así como Nota de Venta interna.
   - Desglose transparente de precios con IGV e impuestos a bolsas plásticas (ICBPER).
4. **Geocodificación y Tarifación Poligonal Dinámica**:
   - Herramienta administrativa para dibujar polígonos sobre el mapa (Zonas Z1 a Z5) y asignar tarifas fijas o dinámicas por zona.
   - Algoritmo en frontend/backend para validar si la dirección del cliente está dentro de la cobertura antes de procesar el pago.
5. **Call Center Operativo en Tablero Kanban**:
   - Tarjetas de pedidos en curso con cronómetro de tiempo transcurrido, canal de procedencia, teléfono de contacto y botón de anulación con motivo obligatorio.
   - Registro express de clientes con múltiples direcciones guardadas.
6. **Módulo de Asignación y Control de Motorizados**:
   - Padrón de repartidores, placas de vehículos y asignación de órdenes por pedido.
7. **Pasarelas de Pago Múltiples**:
   - Efectivo (con campo "paga con"), POS contra entrega, Billeteras móviles (Yape/Plin con captura o confirmación de voucher) y pasarelas online seguras (Culqi/Izipay/MercadoPago).
8. **Auditoría de Reclamos y Tiempos de Entrega**:
   - Métrica precisa de los tiempos entre recepción, cocina, despacho y entrega.

---


### 14. Mejoras Sugeridas para el Nuevo Sistema


1. **Eliminación de Obsolescencias Técnicas Críticas**:
   - El sistema actual corre sobre PHP 7.1 (EOL 2019) y AngularJS 1.6 (EOL 2022) con peticiones REST HTTP sin cifrar en el backoffice. El nuevo sistema debe construirse con arquitectura moderna (ej. Next.js / React / Node / Go / Python) con HTTPS estricto y WebSockets seguros.
2. **Validación Automática de Documentos SUNAT**:
   - Integrar consulta automática de RUC y DNI contra API oficial (RENIEC / SUNAT) en el checkout de la carta digital y en el Call Center, evitando que el usuario o cliente deba tipear manualmente la razón social o cometa errores en el DNI.
3. **Confirmación Automatizada de Pagos Yape / Plin**:
   - Actualmente el operador debe verificar manualmente las transferencias. Se recomienda integrar lectores automáticos de notificaciones bancarias o pasarelas que generen QR dinámico de Yape/Plin con confirmación instantánea (*webhook*).
4. **App Nativa o PWA para el Motorizado**:
   - Proveer a los repartidores una PWA móvil con geolocalización GPS en vivo para que el cliente final y la cafetería vean el trayecto de la moto en un mapa en tiempo real, similar a las aplicaciones comerciales de delivery.
5. **Notificaciones Push y WhatsApp API Oficial**:
   - Reemplazar los enlaces manuales a WhatsApp por la API oficial de WhatsApp Business (Cloud API), enviando confirmaciones automáticas de estado: *"Tu pedido #4897 ya está en el horno"* -> *"Tu pedido ha salido con el motorizado"*.

---


### 15. Dudas para el Cliente (CAPRICHOS)


1. **Flota de Reparto**: ¿Los motorizados son empleados directos en planilla de la cafetería o se contrata a repartidores independientes por viaje / empresas tercerizadas (ej. ChaskyFood, Urbaner)?
2. **Monto Mínimo de Pedido**: ¿Cuál es el monto mínimo oficial exigido para habilitar el despacho a domicilio en Campoy y SJL (actualmente configurado en S/ 15.00 en base de datos)?
3. **Tiempos de Preparación**: El tiempo promedio configurado es de 45 minutos. ¿Existen productos de pastelería o tortas enteras que requieran programación con 24 o 48 horas de anticipación?
4. **Integración con Canales de Terceros**: ¿Desean que el nuevo sistema reciba pedidos automáticamente de Rappi o PedidosYa en la misma pantalla del Call Center mediante API, o se gestionan por separado en sus propias tablets?
5. **Políticas de Reclamos**: ¿Cuáles son las directivas actuales de compensación ante pedidos tardíos o defectuosos (ej. emisión de cupón de descuento, reenvío sin costo o nota de crédito)?

---


---

## Caja  (`modulos/caja.md`)


### 13.1 Funcionalidades Imprescindibles para Replicar

1. **Cobro Mixto y Teclado Táctil Ágil**: Capacidad de dividir un cobro en múltiples formas de pago (efectivo + tarjeta + Yape) con cálculo automático de vuelto y botonera de billetes rápidos.
2. **Emisión Electrónica Integral (SUNAT)**: Generación y firma digital inmediata de Boletas y Facturas, validación de RUC contra SUNAT y DNI contra RENIEC, cálculo de IGV y detracción automática para montos superiores a S/ 700.
3. **División de Cuentas Flexible**: Cuatro formas de partición (por platos, equitativa, montos específicos o porcentajes) con precuentas y tickets independientes.
4. **Arqueo Físico y Modo Ciego**: Desglose minucioso por denominación de billetes/monedas y lotes de tarjetas con detección automática de sobrante/faltante, soportando cierre ciego para evitar fraudes.
5. **Control de Propinas Desacoplado**: Captura de propinas voluntarias y generación de egresos de caja controlados para su reparto al personal.
6. **Notas de Crédito y Débito con Efecto en Stock y Gaveta**: Anulación total o parcial vinculada al comprobante original con opciones de reversión de inventario y egreso automático de caja física.


### 13.2 Mejoras Propuestas para el Nuevo Sistema

1. **Integración Nativa con Datafonos / Terminales de Pago (Smart POS)**: En el sistema actual, el cajero debe ingresar el importe manualmente en el POS físico y luego transcribir el número de operación. Proponer una API directa (vía Bluetooth o red local) con terminales Niubiz/Izipay para que el monto viaje solo al POS y se confirme automáticamente.
2. **Conciliación Automatizada de Pagos con Billeteras (Yape / Plin por QR)**: Integrar visualización de QR dinámico en pantalla del cliente con verificación instantánea de webhook para confirmar el abono sin que el cajero tenga que mirar la pantalla del celular del cliente.
3. **Flujo de Cierre sin Trabas**: El sistema actual requiere pulsar obligatoriamente *Verificar movimientos* antes de habilitar el botón de cierre. En el nuevo sistema, este cálculo debe ser reactivo y continuo.
4. **Prevención Proactiva de Mesas Fantasma**: Avisos visuales emergentes antes del cierre de caja si existen mesas con comandas activas o deliverys en tránsito que impedirían el cuadre.
5. **Búsqueda Inteligente de Clientes con Autocompletado**: Integración directa con base de datos unificada de clientes frecuentes con historial de preferencias y comprobantes emitidos previamente.


### 13.3 Dudas para el Cliente

1. *¿Qué políticas de tolerancia existen para sobrantes y faltantes de caja en CAPRICHOS (ej. margen permitido en céntimos por redondeo)?*
2. *¿Las propinas se liquidan diariamente al cerrar el turno en efectivo o se acumulan semanal/mensualmente para pago en planilla?*
3. *¿Trabajan con datafonos integrados por red local o datáfonos independientes estándar?*
4. *¿Se utiliza la modalidad de Cierre a Ciegas de forma obligatoria para los cajeros, reservando la vista de montos únicamente para la gerencia?*
5. *¿Se emiten facturas sujetas a detracción de forma frecuente para eventos corporativos o empresas en la cafetería?*

---


---

## Reservas  (`modulos/reservas.md`)


### 10. Funcionalidades Imprescindibles para Replicar


Para que el nuevo sistema de CAPRICHOS posea paridad operativa completa con este módulo, es obligatorio implementar:

1. **Gestión Integral del Ciclo de Vida de la Reserva**: Estados claramente diferenciados: *Pendiente*, *En curso*, *Finalizada* y *Anulada*.
2. **Asignación Gráfica sobre el Plano de Mesas**: Selección visual interactiva de mesas con indicador de reservas preexistentes (`1 R`, `2 R`) y detección de solapamiento horario.
3. **Cobro de Garantía / Amortización con Ingreso a Caja**: Capacidad de registrar pagos adelantados en efectivo o tarjeta, vinculados a la caja del turno activo y reflejados como créditos de consumo.
4. **Activación Inmediata con Sincronización en Tiempo Real**: Al presionar "Activar", la mesa física pasa inmediatamente a estado ocupada en todos los terminales y tablets de mozos mediante WebSockets sin necesidad de recargar la página.
5. **Modalidad Híbrida de Reserva**: Soporte para reservar únicamente el espacio físico (mesa), o reservar mesa con selección previa de platos de la carta que se despachan automáticamente a cocina al llegar el cliente.
6. **Historial de Cliente y Control de Inasistencias (No-Show)**: Visor de comportamiento del cliente con conteo de reservas canceladas en los últimos 90 días y ticket promedio de consumo.
7. **Integración con Comprobantes SUNAT**: Preconfiguración de Boleta o Factura con validación de RUC ante SUNAT para reservas corporativas.
8. **Impresión y Exportación**: Generación de tickets de reserva y descarga de comprobante en PDF.

---


### 11. Mejoras Propuestas para el Nuevo Sistema


1. **Portal Público de Reservas Web y Carta Digital**:
   - Actualmente las reservas deben ser registradas manualmente por el personal del restaurante. Se recomienda habilitar un widget en la carta digital pública para que los clientes reserven en línea con confirmación inmediata.
2. **Pasarela de Pago Online para Señas / Garantías**:
   - Integración directa con pasarelas de pago (Niubiz, Culqi, MercadoPago, Yape/Plin con QR dinámico) para que el cliente abone la seña desde su celular al reservar en la web.
3. **Notificaciones Automatizadas por WhatsApp y SMS**:
   - Envío de recordatorios automáticos al cliente 24 horas y 2 horas antes de la reserva, con botón de confirmación o cancelación rápida para reducir la tasa de inasistencia (*No-Show*).
4. **Política de Liberación Automática por Tolerancia**:
   - Si el cliente no llega transcurridos los minutos de espera configurados (`reservacion_tiempoespera`), sugerir automáticamente al anfitrión la liberación de la mesa para comensales de paso.
5. **Timeline / Vista Gantt de Mesas**:
   - Además de la vista mensual de calendario, implementar una vista horizontal tipo Gantt para visualizar en una sola pantalla los turnos y horas de ocupación de cada mesa a lo largo del día.

---


### 12. Preguntas para el Cliente (CAPRICHOS)


1. **Uso Actual del Módulo**: ¿La cafetería utiliza actualmente este módulo de reservas en su operación diaria o gestionan las reservas por canales externos (WhatsApp, libreta, teléfono)?
2. **Política de Cobro de Señas / Garantías**: ¿Suelen cobrar un monto por adelantado para reservar mesas grandes o eventos, o las reservas son 100% sin costo?
3. **Tiempo de Tolerancia Estándar**: ¿Cuál es el tiempo de tolerancia máximo habitual antes de considerar una mesa como disponible (ej. 15 minutos)?
4. **Reservas en Días y Horas Punta**: ¿Desean restringir reservas automáticas durante horarios de máxima afluencia (almuerzos/fines de semana) para priorizar comensales directos?
5. **Mesas Combinables**: ¿Requieren una función para unir mesas contiguas para reservas de grupos numerosos (ej. unir mesas 4 y 5 para 8 personas)?

---


---

## Clientes y Débito  (`modulos/clientes.md`)


### 11. Funcionalidades Imprescindibles para Replicar


Para el nuevo sistema de CAPRICHOS, los siguientes componentes son indispensables desde el día 1:

1. **Doble Padrón (Personas vs Empresas)**:
   - Mantener la separación explícita de clientes B2C (boletas con DNI) y B2B (facturas corporativas con RUC), asegurando que las validaciones de longitud y formato de documento sean estrictas.
2. **Integración Directa con Padrón SUNAT / RENIEC**:
   - La consulta automática al ingresar DNI (8 dígitos) o RUC (11 dígitos) es fundamental para la agilidad en caja y mostrador durante horas punta.
3. **Múltiples Direcciones por Cliente (Delivery)**:
   - Soporte para asociar varias direcciones (casa, oficina, etc.) con sus referencias y coordenadas de geolocalización vinculadas a tarifas de reparto.
4. **Módulo de Anticipos y Débitos (Monedero de Cliente)**:
   - Mecanismo transparente para recibir pagos anticipados en caja, generar saldo en cuenta y permitir que el comensale pague utilizando dicho saldo.
5. **Control de Línea de Crédito Comercial**:
   - Límite global, tope diario y días de crédito con restricción de permisos por rol de usuario para prevenir autorizaciones no supervisadas.
6. **Historial de Consumos en Ficha**:
   - Vista de los últimos consumos y acceso a exportar reportes detallados de lo consumido por cliente.

---


### 12. Mejoras y Oportunidades para el Nuevo Sistema


1. **Unificación de Interfaz (Evitar el patrón de dos pestañas separadas)**:
   - En lugar de forzar al usuario a conmutar entre pestañas de "Personas" y "Empresas", implementar un buscador unificado inteligente con autocompletado en tiempo real que identifique automáticamente si el término es DNI, RUC, nombre o teléfono.
2. **Monedero Virtual Integrado y Trazabilidad de Saldos**:
   - En el sistema actual, la tabla de débitos muestra el monto disponible pero no detalla en la misma pantalla en qué ventas específicas se fue consumiendo el dinero. La nueva versión debe incluir un **kardex de movimientos de saldo** (Entrada por anticipo, Salida por venta #123, Devolución, Saldo remanente).
3. **Programa de Fidelización Moderno (Cashback / Puntos QR)**:
   - Activar un programa de lealtad accesible desde la carta digital o WhatsApp donde el cliente acumule puntos por cada compra y los canjee directamente por postres o cafés mediante un código QR en caja.
4. **Validación Asíncrona de Correos para Facturación**:
   - Implementar validación de sintaxis estricta en el correo electrónico y confirmación de recepción para reducir rebotes de comprobantes electrónicos SUNAT.
5. **Gestión de Etiquetas y Segmentos Dinámicos**:
   - Permitir asignar etiquetas libres (ej. `Vegano`, `Celíaco`, `Cliente VIP`, `Corporativo`, `Cumpleaños Octubre`) para marketing automatizado.

---


### 13. Preguntas y Dudas para el Cliente (CAPRICHOS)


1. **Uso Actual del Crédito de Clientes**:
   - ¿CAPRICHOS otorga crédito comercial actualmente a empresas u oficinas cercanas de Lima, o todas las ventas se cobran al contado en mostrador/delivery?
2. **Políticas de Saldos a Favor y Anticipos (Débitos)**:
   - ¿Con qué frecuencia se utilizan los débitos en la cafetería? ¿Se usan para reservas de eventos, consumo corporativo prepagado o notas de crédito por devoluciones?
3. **Políticas de Puntos y Fidelización**:
   - Aunque en el sistema actual el add-on comercial está apagado, ¿desean lanzar un programa de acumulación de puntos o cashback en la nueva carta digital?
4. **Consumo de Servicios SUNAT/RENIEC**:
   - ¿Tienen contratado un proveedor de API específico para consultas de DNI/RUC o utilizan las consultas provistas por su PSE de facturación?

---


---

## Ofertas y Descuentos  (`modulos/promos.md`)


### 8. Funcionalidades Imprescindibles para Replicar


Para que el nuevo sistema reemplace satisfactoriamente al actual sin generar disrupciones comerciales en CAPRICHOS, se deben implementar prioritariamente:

1. **Motor de Ofertas por Canal y Sucursal**:
   - Soportar las 4 mecánicas: combos cerrados (2 en 1), compra-lleva (2x1), precios bajos escalonados por volumen y precios especiales por ambiente de salón.
   - Reglas estrictas de vigencia por horario comercial (ej. "Happy Hour" de café de 4 PM a 7 PM de lunes a jueves).
   - Control estricto de disponibilidad según canal (Salón, Venta Rápida o Delivery).
2. **Políticas de Descuentos con Auditoría y No Acumulación**:
   - Motivos tipificados con tope de monto en soles y porcentaje deducible para control tributario.
   - Regla anti-acumulación que excluya automáticamente productos que ya gocen de oferta comercial activa.
   - Registro del usuario que autorizó el descuento (trazabilidad y firma de supervisor).
3. **Cupones de Descuento con Gestión de Saldo**:
   - Soporte tanto para cupón de importe total como cupón fraccionable (saldo monedero).
   - Regla de un solo canje por documento de cliente (evita duplicidad fraudulenta).
   - Generador correlativo masivo por rangos e importador Excel.
4. **Vales de Consumo Integrados al Motor de Pagos**:
   - Tratamiento de vales como medios de pago de caja con validación de código en tiempo real.
   - Posibilidad de restringir vales a productos específicos (ej. "Vale válido solo para tortas y cafés").
5. **Disparadores de Sorteo en Ticketera**:
   - Cálculo automático de cupones impresos en el recibo de comanda según consumo o productos clave, con campos en blanco para participación en ánforas físicas.

---


### 9. Oportunidades de Mejora y Modernización


1. **Unificación Conceptual y de Interfaz**:
   - En el sistema actual, *Ofertas*, *Descuentos*, *Cupones*, *Sorteos* y *Vales* se encuentran dispersos en tres secciones distintas del menú lateral (`Ofertas`, `Descuentos` y `Ajustes`). En el nuevo sistema deben consolidarse bajo un único módulo armónico: **Promociones y Fidelización**.
2. **Validación Online Centralizada de Cupones y Vales**:
   - El sistema actual almacena códigos con validación básica. Se recomienda implementar validación criptográfica o tokens QR escaneables desde el teléfono del cliente mediante la cámara del POS o escáner 2D, evitando la digitación manual de códigos en horas punta.
3. **Ofertas Inteligentes y Combinatorias (Mix & Match)**:
   - En el 2x1 y 2 en 1 actual, las equivalencias son rígidas. Se recomienda un motor de reglas "Lleva 2 productos de la categoría Pastelería y paga el de mayor valor", común en cafeterías modernas.
4. **Sorteos 100% Digitales sin Papel Térmico**:
   - En lugar de gastar papel térmico y exigir llenado manual a lapicero en el ticket, generar un código QR único en el comprobante que dirija a un formulario web donde el cliente registra sus datos para el sorteo, ahorrando papel y capturando leads limpios y sin errores de caligrafía.
5. **Dashboard Analítico de Retorno de Inversión (ROI)**:
   - Incluir métricas en tiempo real de cuánto vendió cada oferta, cuál fue el margen real tras el descuento y qué cupones tuvieron mayor tasa de redención.

---


### 10. Dudas para el Cliente (CAPRICHOS)


1. **Uso Real de Mecánicas de Oferta**:
   - ¿Qué modalidades de oferta se emplean con mayor frecuencia en Caprichos: 2x1, combos 2 en 1, precios especiales por salón o precios rebajados?
2. **Políticas de Descuentos de Personal y Cortesías**:
   - ¿Cuál es el límite máximo permitido para que un cajero o mozo aplique un descuento antes de exigir autorización o PIN del administrador/supervisor?
3. **Cupones y Alianzas Comerciales**:
   - ¿Manejan actualmente convenios con empresas o cupones digitales (ej. Yape Promos, Cuponatic) que requieran importación masiva o integración vía API externa?
4. **Mecánica de Sorteos**:
   - ¿Se siguen realizando sorteos físicos con cupones impresos y ánforas en caja, o prefieren una solución digital mediante registro web vía QR en la boleta?
5. **Gift Cards y Vales de Consumo**:
   - ¿Venden tarjetas de regalo ("Gift Cards") recargables o emiten vales corporativos a clientes empresariales? ¿Requieren que el saldo restante quede guardado para futuras visitas?

---


---

## Créditos  (`modulos/creditos.md`)


### 10. Funcionalidades Imprescindibles para Replicar


Para que el nuevo sistema reemplace a la perfección la operativa actual de CAPRICHOS, es obligatorio replicar las siguientes características clave:

1. **Flujo de Cobro Unificado desde Caja**:
   - El cobro de cuotas no debe requerir que el cajero digite datos a ciegas; debe integrarse de forma natural con la pasarela de cobro del POS (`modalcaja`), soportando pagos mixtos (parte efectivo, parte Yape/Plin, parte POS).
2. **Cobranza de Cuotas Múltiples y en Bloque**:
   - Capacidad de seleccionar varias facturas de un mismo cliente empresarial y pagarlas en un solo asiento contable, con validación de coincidencia de divisa.
3. **Canje de Notas de Venta por Comprobantes Electrónicos (Boleta/Factura)**:
   - Funcionalidad imprescindible en la gastronomía peruana: muchos clientes consumen diariamente con vales o notas de venta internas, y a fin de mes la empresa solicita una sola Factura Electrónica por todo el acumulado. El sistema debe agrupar los ítems, calcular base imponible e IGV y emitir el documento ante SUNAT extinguiendo las notas previas.
4. **Vínculo Automatizado entre Pagos a Proveedores y la Caja Física**:
   - La casilla `¿Pago sale de caja?` resuelve la conciliación del día a día: cuando el administrador le paga al proveedor de leche o café con billetes de la caja registradora, ese pago debe descontarse del arqueo de caja inmediatamente bajo la categoría de Egreso Operativo para que el cuadre de caja al final del turno sea exacto.
5. **Auditoría Estricta de Anulaciones**:
   - Tanto en cobros como en pagos, una amortización no se puede eliminar discretamente: exige confirmación, registro obligatorio del motivo de anulación y preservación del historial con estado `Anulada`.
6. **Soporte de Instrumentos Bancarios Completos para Proveedores**:
   - Soporte para cheques comunes y diferidos, transferencias con registro de código de operación, cuenta de cargo y cuenta de abono.

---


### 11. Oportunidades de Mejora y Modernización


Al rediseñar y construir el nuevo sistema, se identifican las siguientes oportunidades de mejora sobre la base actual:

1. **Arquitectura Reactiva y SPA Moderna (Next.js / React / Tailwind)**:
   - Sustituir la navegación pesada con parámetros posicionales en URL (`/.../-1/1/1/1/75/-1/-1/...`) por APIs REST limpias con query params estándar (`?cliente_id=12&estado=pendiente&page=1`) o GraphQL.
2. **Gestión Documental Digital de Vouchers y Facturas**:
   - En la actualidad, la URL del voucher es un campo de texto plano. Se debe implementar carga directa de imágenes con previsualización inmediata (drag-and-drop), compresión en el cliente y almacenamiento en S3/Cloud Storage.
3. **Notificaciones y Cobranza Automatizada (WhatsApp / Email)**:
   - Envío automático de estados de cuenta y recordatorios de vencimiento a clientes corporativos a través de WhatsApp Business API cuando una cuota esté por vencer o vencida.
4. **Panel de Antigüedad de Deuda (Aging Report)**:
   - Incorporar métricas visuales con semaforización de saldos: *Corriente (0-15 días)*, *Vencido (16-30 días)*, *Moroso (+30 días)*, permitiendo al administrador priorizar cobranzas críticas.
5. **Conciliación Bancaria Automática**:
   - Integración con extractos bancarios (formato OFX/Excel) o APIs de banca empresa (BCP/BBVA) para conciliar automáticamente códigos de operación de transferencias sin digitación manual.

---


### 12. Preguntas y Dudas Clave para el Cliente (CAPRICHOS)


Para afinar las reglas de negocio durante la fase de desarrollo, se deben levantar las siguientes consultas con la administración de CAPRICHOS:

1. **Políticas de Crédito a Clientes**:
   - ¿Qué porcentaje de clientes cuenta con línea de crédito autorizada y bajo qué criterios se define su límite de crédito?
   - ¿Se aplican intereses por mora en la cafetería o todas las ventas a crédito se financian a tasa 0%?
2. **Uso del Canje de Notas de Venta**:
   - ¿Con qué frecuencia se realiza el canje de notas de venta por factura/boleta? ¿Existe un plazo máximo en días dentro del mismo mes para realizar dicho canje según su asesoría contable?
3. **Pagos a Proveedores en Turnos Operativos**:
   - ¿Quién tiene autorización para marcar `¿Pago sale de caja?`? ¿Cualquier cajero o únicamente el administrador/jefe de tienda?
   - ¿Cuál es el tope máximo de efectivo que se permite desembolsar de caja para el pago de un proveedor antes de exigir transferencia bancaria?
4. **Manejo de Monedas**:
   - ¿Se manejan compras o ventas a crédito en Dólares Americanos (USD) o el 100% de la cartera de CAPRICHOS opera estrictamente en Soles (PEN)?

---


---

## Compras  (`modulos/compras.md`)


### 11. Funcionalidades Imprescindibles para Replicar


Para el nuevo sistema de **CAPRICHOS**, las siguientes funcionalidades del módulo de compras son de carácter crítico y no pueden omitirse:
1. **Catálogo de Proveedores con Búsqueda SUNAT**: Registro de proveedores con validación de RUC de 11 dígitos y autocompletado en línea vía API de SUNAT (indispensable para evitar errores de digitación en facturas).
2. **Registro Integral de Compras / Facturas**:
   - Cabecera con serie/correlativo, proveedor, fecha de emisión y fecha de tributación.
   - Detalle multialmacén: asignación de insumos directamente al almacén correspondiente (Barra, Cocina, Depósito).
   - Captura de **Fecha de Vencimiento** por insumo en la misma línea de compra para alimentar el semáforo de insumos perecederos.
3. **Manejo Tributario Peruano**:
   - Soporte para IGV (precios con IGV incluido o más IGV).
   - Soporte para régimen de Percepciones (sumado al comprobante).
   - Soporte para Detracciones (SPOT SUNAT) con cálculo automático del porcentaje y generación del saldo neto a pagar al proveedor.
4. **Vínculo Directo Compra - Caja Chica**: Posibilidad de marcar compras al contado en efectivo como egreso directo de la caja del turno activo para que el cuadre de caja coincida al cierre del día.
5. **Programación Financiera de Lotes de Pago**: Agrupamiento de facturas a crédito por fecha y cuenta bancaria para pago masivo.

---


### 12. Oportunidades de Mejora para el Nuevo Sistema


1. **UX/UI Moderna y Unificada**: El sistema actual dispersa la gestión entre "Proveedores", "Lotizar compras", "Ajustes", "Almacén" y "Créditos > Pago de compras". En el nuevo sistema se debe unificar en un único **Hub de Abastecimiento**: `Compras > Facturas`, `Proveedores`, `Pagos Programados` y `Configuración`.
2. **Carga Masiva de Facturas Electrónicas (XML / UBL 2.1)**: Actualmente el usuario debe ingresar manualmente cada campo, serie, correlativo y línea de detalle. Una mejora de alto impacto es permitir arrastrar el archivo `XML` de la factura del proveedor para que el sistema autocomplete el RUC, razón social, serie, número, montos e incluso empareje los insumos automáticamente.
3. **Validación Automática del Estado del Comprobante en SUNAT**: Verificar en tiempo real mediante el API de SUNAT si el comprobante del proveedor se encuentra en estado *Aceptado*, *Anulado* o *Rechazado*.
4. **Alerta Temprana de Caducidad de Insumos**: Al vincular la fecha de vencimiento capturada en la compra con el inventario, generar notificaciones push / correo al jefe de cocina cuando un lote de lácteos, carnes o pastelería esté a 3 o 5 días de expirar.

---


### 13. Dudas y Preguntas para el Cliente (CAPRICHOS)


1. **Uso de Órdenes de Compra**: ¿El personal de CAPRICHOS emite primero una Orden de Compra previa autorización de gerencia antes de que llegue la mercadería, o registran directamente la Factura/Guía al momento de la entrega de insumos?
2. **Frecuencia de Compras a Crédito y Pagos por Lote**: ¿Qué porcentaje aproximado de sus proveedores se cancela al contado desde la caja de la cafetería vs. mediante transferencias bancarias programadas en lotes semanales/quincenales?
3. **Cuentas Bancarias de Pago**: ¿Desde cuántas cuentas bancarias distintas (BCP, BBVA, Interbank) ejecutan pagos a proveedores habitualmente?
4. **Tratamiento de Detracciones**: Para servicios de mantenimiento, limpieza o compras sujetas a detracción, ¿requieren que el nuevo sistema genere el archivo plano para pago masivo de detracciones del Banco de la Nación?


---

## Almacén  (`modulos/almacen.md`)


### 12. Funcionalidades Imprescindibles para Replicar


Para la nueva versión del sistema de CAPRICHOS, deben considerarse obligatorias las siguientes capacidades:

1. **Gestión Multialmacén y Áreas de Producción**:
   - Capacidad de crear múltiples almacenes lógicos y físicos (Almacén Principal, Barra, Pastelería, Cocina Fría, Cocina Caliente).
   - Asignación obligatoria de cada producto e insumo a su almacén de despacho por defecto.
2. **Motor de Recetas y Fichas Técnicas con Escandallo Multinivel**:
   - Soporte para Insumos puros, Sub-recetas/Bases (recetas que consumen otros insumos) y Porcionables.
   - Conversión automática de unidades de medida (KG a G, L a ML, Unidades a Porciones).
   - Doble modalidad de descargo: en tiempo real con cada venta del POS o por lotes de producción previa.
3. **Mecanismo de Plantillas para Operación Rápida**:
   - Replicar el patrón de plantillas en Requerimientos y Movimientos Internos. En cafeterías, los pedidos entre turnos son altamente estandarizados y el uso de plantillas ahorra decenas de minutos al personal de barra.
4. **Circuito de Traslado y Recepción Controlada**:
   - Requerimiento (Solicitud) $\rightarrow$ Aprobación $\rightarrow$ Despacho (Guía en tránsito) $\rightarrow$ Recepción física en destino.
   - Posibilidad de recepción parcial con registro de faltantes o mermas de traslado.
5. **Monitor Proactivo de Stock Bajo y Reposición**:
   - Filtro dedicado de stock crítico y cálculo de cantidades faltantes según stock de seguridad.
   - Conversión de faltantes en órdenes de compra con un solo clic.
6. **Manejo Riguroso de Mermas**:
   - Formulario de salida por merma con tipificación clara (vencimiento, error de comanda, desecho de preparación).

---


### 13. Mejoras Propuestas respecto al Sistema Actual


1. **Rediseño de la Experiencia de Usuario (UI/UX Moderna)**:
   - En el sistema actual, la interfaz de Requerimientos y Movimientos Internos utiliza paneles rígidos con alto espacio muerto si no hay plantilla seleccionada. Se sugiere una interfaz fluida tipo Kanban o tablas interactivas con filtros reactivos integrados.
2. **Sincronización Inmediata de Kárdex vs Procesamiento en Cola**:
   - El sistema actual acumula ventas sin procesar (`pendienteProcesoStock`) y muestra advertencias en el kárdex hasta que se corre un proceso batch. En la nueva arquitectura (ej. PostgreSQL + microservicios o eventos), el kárdex debe actualizarse transaccionalmente o vía eventos en tiempo casi real sin retrasar las consultas.
3. **Control de Lotes y Fechas de Vencimiento**:
   - El sistema actual tiene una sección incipiente de lotes en compras, pero no exige el control de fechas de vencimiento en el kárdex diario de cafetería (PEPS/FIFO). Incorporar alertas visuales de insumos perecibles próximos a caducar.
4. **Validación de Stock en Tiempo Real en la Carta Digital y Mesas**:
   - Cuando un ingrediente clave llega a stock cero, el sistema debe permitir agotar automáticamente en cascada todos los platos de la carta digital que dependen de ese insumo, evitando que los comensales pidan platos no disponibles.
5. **Recepción con Evidencia Fotográfica / Discrepancias**:
   - En recepciones donde la cantidad entregada difiera de la solicitada, permitir adjuntar una foto o nota obligatoria de discrepancia desde la app móvil o tablet.

---


### 14. Dudas y Preguntas Clave para el Cliente CAPRICHOS


1. **Organización Física de Almacenes**:
   - ¿CAPRICHOS opera con un único almacén físico central y despacha a las barras, o la barra y la cocina manejan sus propios sub-almacenes independientes?
2. **Periodicidad y Responsables de Requerimientos**:
   - ¿Con qué frecuencia se elaboran los requerimientos de insumos (diario por turno, interdiario, semanal)? ¿Quién aprueba los pedidos antes de enviarlos a compras?
3. **Escandallo y Costeo en Barra de Café**:
   - ¿Desean controlar el gramaje exacto de café por taza (ej. 18g para doble espresso) con descargo estricto en kárdex, o prefieren controlar el café por bolsas completas retiradas de almacén a barra?
4. **Manejo de Descartables**:
   - ¿Los vasos, tapas y servilletas se descuentan por receta fija en cada bebida para llevar, o se controlan mediante conteo de inventario físico semanal?
5. **Políticas de Merma**:
   - ¿Qué porcentaje de merma estándar se tolera en productos de pastelería fresca (ej. tortas o sándwiches no vendidos al cierre del día) y cómo se registran actualmente?


---

## Informes e Indicadores  (`modulos/informes.md`)


### 7. Funcionalidades Imprescindibles para Replicar


Para que la nueva versión del sistema satisfaga las operaciones de CAPRICHOS sin fricción, debe incluir como mínimo:

1. **Todas las Ventas con Auditoría Rápida**: Buscador por rango de fecha/hora, número de boleta/factura y visualización modal del detalle de platos consumidos.
2. **Conciliación Multimedio de Pagos**: Cuadre exacto entre efectivo físico, pasarelas de tarjetas (Niubiz/Izipay) y billeteras móviles (Yape/Plin), distinguiendo propinas de ventas netas.
3. **Cierres de Caja Z con Arqueo**: Historial inmutable de aperturas y cierres con cálculo automático de faltantes o sobrantes de caja.
4. **Ventas por Producto y Mix de Ventas**: Informe que identifique cuáles son los cafés, sándwiches o postres más vendidos y en qué canal (Salón vs. Delivery vs. Venta Rápida de mostrador).
5. **Dashboard Ejecutivo de KPIs en Vivo**: Tablero con las ecuaciones de Utilidades = Ventas - Costos - Pasivos y gráficos de ventas por hora y día para anticipar horas pico de personal.
6. **Kardex y Stock Valorizado Ponderado**: Valorización de existencias de insumos clave (café en grano, leche, harinas) para determinar el costo de venta mensual.
7. **Control de Anulaciones y Modificaciones**: Registro auditado de pedidos cancelados o platos eliminados con registro del responsable y motivo.

---


### 8. Mejoras Sugeridas para el Nuevo Sistema


1. **Motor de Consultas y Reportes en Tiempo Real (OLAP Moderno)**:
   - En lugar de ejecutar consultas agregadas pesadas en MySQL mediante llamadas sincrónicas, implementar una base de datos analítica o vistas materializadas (ClickHouse, PostgreSQL con rollup o DuckDB en backend) para que los filtros de fechas respondan en milisegundos sin congelar la interfaz.
2. **Descargas Asíncronas y Notificaciones**:
   - Para informes grandes (ej. Kardex anual o Todas las ventas de varios meses), generar la exportación en un worker de fondo y notificar al usuario cuando el Excel esté listo para descargar, evitando time-outs HTTP de 60 segundos.
3. **Exportaciones Estructuradas Nativas (Excel, CSV, PDF Vectorial)**:
   - Ofrecer reportes con formato limpio, agrupaciones plegables, gráficos incrustados y compatibilidad directa con formatos tributarios de SUNAT (Formato 13.1) y sistemas contables peruanos (Concar, Siscont).
4. **Filtros Avanzados y Dinámicos**:
   - Permitir guardar filtros frecuentes (ej. *"Turno Mañana - Fin de Semana"* o *"Solo Ventas Delivery Yape"*) y cruces multidimensionales (ej. ventas de un producto por mozo y hora).
5. **Alertas Inteligentes de KPIs (Detección de Anomalías)**:
   - Notificaciones automáticas por Telegram/WhatsApp o correo si las ventas caen más de un 20% respecto al mismo día de la semana anterior, si el porcentaje de mermas supera el umbral permitido, o si se registran más de 3 anulaciones de comandas en un solo turno.

---


### 9. Preguntas y Dudas para el Cliente (CAPRICHOS)


1. **¿Qué reportes son los que realmente consulta el administrador a diario y al cierre de mes?** (En el sistema actual existen más de 100 reportes; identificar los 10 prioritarios optimizará la experiencia de usuario).
2. **¿Cómo realizan actualmente el costeo de las recetas de cafetería?** (¿Utilizan el módulo de Food Cost e inventario del sistema para dar de baja insumos por receta, o solo controlan stock de productos finales embotellados/empaquetados?).
3. **¿Cuál es la política para la distribución de propinas (Tips)?** (¿Se liquidan diariamente al mozo según el reporte de propinas, o se acumulan para un pozo común mensual repartido entre sala y cocina?).
4. **¿Requieren exportación directa a algún software contable en particular?** (ej. Siscont, Concar, Siigo o simplemente libros electrónicos en formato TXT/PLE para SUNAT).
5. **¿Qué métricas o gráficos adicionales desearía ver la gerencia en su teléfono celular?** (ej. Ticket promedio en vivo, ocupación porcentual de mesas, tiempo medio de permanencia de comensales).

---


---

## Mi restaurant  (`modulos/mirest.md`)


### 10. Funcionalidades Imprescindibles para Replicar


1. **Gestión de Identidad de Marca y Razón Social Matriz**:
   - Campos de Razón Social, Nombre Comercial, RUC, Dirección, Teléfono, Correo y Logotipo.
   - Sincronización transparente con el frontend de la carta digital y módulos de suscripción.
2. **Arquitectura Multi-Proveedor de Facturación Electrónica**:
   - Soporte nativo para emitir mediante PSE/OSE o API directa (Restafact, Nubefact, etc.).
   - Mapeo jerárquico de comprobantes: Sucursal -> Caja -> Tipo de Comprobante -> Serie -> Correlativo.
   - Manejo independiente o agrupado de series para Notas de Crédito y Débito.
   - Monitoreo automatizado de la vigencia del Certificado Digital Tributario (CDT) con alertas preventivas.
3. **Módulo de Regularización de Series de Contingencia**:
   - Catálogo de series físicas preimpresas (3 dígitos numéricos) para Boleta y Factura.
   - Marcado de fecha de alta autorizada por imprenta y estado activo.
   - Asociación durante las ventas cuando el sistema o la red operan en modo fuera de línea.
4. **Hub Central de Integraciones (Delivery y Pagos)**:
   - Conectores estandarizados para agregadores de pedidos (Rappi, PedidosYa, Uber Eats) con inyección a cocina.
   - Integración con pasarelas de pago online (Culqi, Mercado Pago, PayU) para venta web/QR.
   - Sincronización de catálogo y carta por canal de venta.
5. **Driver / Integración de POS Bancario en Caja**:
   - Soporte para protocolos de terminales Izipay y Niubiz (Vendemás).
   - Asignación flexible de terminales POS a cajas específicas.
   - Envío de importe directo al terminal y confirmación desatendida del cobro.

---


### 11. Oportunidades de Mejora y Modernización


1. **Eliminar el bloqueo por PIN de Soporte en Facturación Electrónica**:
   - *Situación actual*: El cliente o administrador no puede ver ni auditar su propio estado de facturación electrónica sin solicitar la intervención de un técnico con PIN de soporte.
   - *Mejora*: Diseñar una vista de usuario con permisos basados en roles (RBAC) donde el administrador del restaurante pueda visualizar diagnósticos, vigencia de certificados, consumo de comprobantes y errores de envío a SUNAT sin requerir soporte externo.
2. **Unificación de Pantallas de Facturación**:
   - *Situación actual*: Coexisten dos rutas (`#!/ajustes/facturacionelectronica` y `#!/mirestaurante/facturacion-electronica`), generando confusión sobre dónde se configura el proveedor y dónde se consultan los XML emitidos.
   - *Mejora*: Centralizar en un único módulo integral de "Facturación Electrónica" con pestañas: *1. Emisión y Monitoreo*, *2. Documentos y XML/CDR*, *3. Series y Correlativos*, *4. Proveedor y Certificado*.
3. **Automatización de Contingencia con Sincronización Automática (Offline-First)**:
   - *Situación actual*: El cajero debe recordar usar el talonario manual y luego el administrador debe registrar las series.
   - *Mejora*: Implementar arquitectura PWA / IndexedDB con capacidad de emitir comprobantes electrónicos en cola local firmados sin internet, sincronizándolos automáticamente con SUNAT cuando la conexión retorne, reduciendo al mínimo el uso de talonarios de papel.
4. **Monitoreo en Tiempo Real del Estado de Integraciones**:
   - *Situación actual*: La lista de integraciones muestra sólo un indicador binario de Activa/Inactiva sin indicar si el webhook o token expiró.
   - *Mejora*: Incorporar un panel de salud (*Health Check*) con estado de ping/latencia, conteo de órdenes recibidas hoy por agregador y visualizador de logs de error en caso de rechazo de pedidos de Rappi o PedidosYa.
5. **Modernización de la Integración POS**:
   - *Situación actual*: Soporta principalmente llamadas WS de escritorio legacy.
   - *Mejora*: Añadir soporte para terminales Android POS Smart (ej. Izipay Smart, Niubiz Smart POS) mediante comunicación por red local (LAN/Wi-Fi WebSocket) o Bluetooth, permitiendo que mozos cobren en la mesa directamente desde una tablet o smartphone.

---


### 12. Preguntas y Dudas para el Cliente (CAPRICHOS)


1. **Operación Fiscal y SUNAT**:
   - ¿Qué proveedor de facturación electrónica tienen actualmente contratado en CAPRICHOS (Restafact directo de Restaurant.pe u otro PSE/OSE como Nubefact o TCI)?
   - ¿La empresa cuenta con Certificado Digital propio (.pfx) o utilizan el certificado del PSE? ¿Cuál es la fecha de vencimiento actual de su certificado?
   - ¿En situaciones de corte de luz o internet en el local de Lima, utilizan talonarios físicos de contingencia autorizados por imprenta o aguardan el restablecimiento del servicio?
2. **Canales de Delivery y Pasarelas**:
   - ¿Cuáles de las 34 integraciones disponibles tienen actualmente contratadas y operativas en CAPRICHOS (ej. Rappi, PedidosYa, WhatsApp, Uber Eats)?
   - ¿Utilizan la carta digital / menú online de Restaurant.pe con cobro mediante Culqi o Mercado Pago, o únicamente operan con venta presencial en salón y teléfono?
3. **Hardware de POS en Cajas**:
   - ¿Cuántos equipos POS físicos tienen en el local y de qué marcas/operadores son (Izipay, Niubiz)?
   - ¿Están integrados por cable/red a la computadora de caja o el cajero digita manualmente el monto en el POS al momento del cobro?
4. **Contabilidad y ERP**:
   - ¿Utilizan algún software contable o ERP externo (ej. Concar, Contasis, Siigo) para el cual requieran exportar los comprobantes diarios, o su contador descarga los reportes en Excel directamente desde el sistema?

---
*Fin de la documentación técnica del módulo Mi restaurant.*


---

## Ajustes (operativa)  (`modulos/ajustes-a.md`)


### 14. Funcionalidades Imprescindibles para Replicar


1. **Matriz de Enrutamiento de Comandas Flexible**: Capacidad de dirigir ítems automáticamente a múltiples áreas de preparación (cocina caliente, fría, barra, hornos) combinando área por producto e impresora por salón.
2. **Independencia de Impresión Térmica (Raw TCP / Socket Directo)**: Envío directo de comandos ESC/POS vía IP (puerto 9100) sin depender obligatoriamente de controladores o spoolers de Windows que se cuelgan en horas punta.
3. **Gestión Jerárquica de Salones y Mesas con Estados en Tiempo Real**: Bloqueo estricto de reasignación cuando una mesa tiene comensales o pedidos activos.
4. **Separación de Cajas Físicas, Almacenes y Series Fiscales**: Cada caja debe poder tener su propia serie correlativa SUNAT (Boleta, Factura, Notas de Crédito) y descontar existencias de su almacén asignado.
5. **Configuración de Cierre Ciego**: Ocultamiento estricto de los saldos teóricos al cajero para forzar un conteo físico honesto en el arqueo de turno.
6. **Soporte Multimarca / Dark Kitchen**: Habilidad para que una misma cocina opere múltiples marcas comerciales virtuales con diferente identidad fiscal, logo y precios.

---


### 15. Mejoras Propuestas para el Nuevo Sistema


1. **Gestión de Impresoras con Detección Automática mDNS / ZeroConf**: En lugar de exigir la configuración manual de IPs estáticas o la instalación de un instalador MSI de Windows (`ServicioV5.msi`), integrar descubrimiento automático de ticketeras en la red local y soporte para impresión directa desde el navegador vía WebSockets seguros o agentes ligeros multiplataforma (Linux/macOS/Windows).
2. **Diseñador Visual de Salones (Drag & Drop)**: El sistema actual solo permite ingresar listas de mesas con prefijos numéricos. Proponer un lienzo interactivo 2D donde el administrador arrastre mesas, barras y paredes reflejando el plano arquitectónico real del salón.
3. **Consolidación Reactiva de Opciones del Sistema**: La pantalla de opciones actual agrupa más de 100 checkboxes en una lista plana de difícil navegación. Se recomienda una interfaz categorizada en pestañas con buscador semántico, vista previa del impacto visual y guardado inmediato reactivo por interruptor.
4. **Gestión Unificada de Periféricos en la Nube**: Monitorizar el estado de salud de las ticketeras (falta de papel, desconexión de cable, tapa abierta) con telemetría en tiempo real, alertando al cajero antes de que se pierdan comandas.
5. **Mapeo Inteligente de Horarios de Menú Online**: Simplificar la interfaz de horarios de delivery y recojo, permitiendo definir excepciones festivas y cierres por lluvia en un solo clic.

---


### 16. Dudas para el Cliente


1. *¿Cuántas ticketeras físicas operan actualmente en la sede CAPRICHOS y cuál es la distribución habitual entre barra, cocina caliente y caja?*
2. *¿La cafetería opera o tiene proyectado operar marcas virtuales independientes (Dark Kitchen) desde la misma cocina?*
3. *¿Se utiliza el módulo de quioscos de autoservicio (Self Service) o tótems en el local, o se prioriza la carta digital por código QR en las mesas?*
4. *¿Qué servicio de impresión local utilizan actualmente en las PCs de caja (el instalador ServicioV5.msi de Restaurant.pe o impresión directa por red IP)?*
5. *¿Se aplica el cierre de caja a ciegas de forma estricta para todos los turnos en CAPRICHOS?*

---


---

## Ajustes (fiscal y pagos)  (`modulos/ajustes-b.md`)


### 11. Funcionalidades Imprescindibles para Replicar el Sistema


Para construir la nueva plataforma moderna de CAPRICHOS, los siguientes componentes son de implementación obligatoria:

1. **Gestor Centralizado de Series y Correlativos**:
   - Numeración atómica con bloqueo transaccional por base de datos para impedir duplicación de comprobantes ante ventas simultáneas en varias cajas o tablets.
   - Protección con perfil administrativo o PIN de seguridad para que ningún cajero pueda modificar correlativos una vez sincronizados con SUNAT.
2. **Motor Multi-impuesto Flexible**:
   - Capacidad de aplicar impuestos porcentuales (IGV 18% / 10%) y montos nominales fijos (ICBPER por unidad de empaque).
   - Clasificación de impuestos fiscales (que tributan a SUNAT con código de catálogo) y no fiscales (recargo al consumo / propina de servicio).
   - Asignación granular de impuestos por modalidad de venta (Salón, Barra, Delivery).
3. **Mapeo Estricto ISO 4217 para Facturación Electrónica**:
   - Separación clara entre la divisa de visualización en caja y el identificador oficial tributario (`PEN` / `USD`) requerido por el estándar UBL 2.1.
4. **Módulo de Cuentas de Cobro Digital (Billeteras y Bancos)**:
   - Soporte nativo para Yape, Plin y transferencias interbancarias con almacenamiento de imágenes QR optimizadas para despliegue en pantalla de POS y en el checkout del menú online.
   - Validación obligatoria de número de operación bancario en caja.
5. **Matriz de Denominaciones para Arqueo de Caja**:
   - Configuración dinámica del cono monetario (monedas de 0.10 a 5.00 y billetes de 10 a 200) para permitir conteo ciego rápido al momento del cierre de turno.
6. **Catálogo de Motivos de Anulación de Venta**:
   - Validación forzosa de causal antes de autorizar la anulación de cualquier pedido o la emisión de Notas de Crédito.
7. **Control de Retenciones y Comisión de Propinas por Tarjeta**:
   - Cálculo automático de descuentos por comisión bancaria en las propinas electrónicas para liquidación transparente con mozos.

---


### 12. Oportunidades de Mejora y Modernización


1. **Sincronización Automática del Tipo de Cambio**:
   - Actualmente, el tipo de cambio compra/venta debe digitarse a mano en la interfaz. Se propone integrar una conexión automática a la API pública de SUNAT / SBS para actualizar la tasa oficial diariamente al abrir el primer turno de caja.
2. **Validación Automática de Pagos Yape / Plin por Webhook o Notificación**:
   - En el sistema actual, el cajero solo visualiza el QR y escribe a mano el código del voucher en el POS. Implementar una integración con APIs de pagos QR dinámicos (ej. Yape Empresas / Izipay QR) permitiría que el sistema confirme automáticamente el abono en cuenta sin intervención humana, eliminando el fraude por vouchers falsos.
3. **Consolidación de las Pantallas "Monedas" y "Moneda de Facturación"**:
   - Mantener dos pantallas separadas para gestionar monedas físicas e ISOs fiscales genera confusión operativa. En la nueva versión deben integrarse en una única pantalla con una pestaña de configuración fiscal.
4. **Transición a Arquitectura Reactiva y API RESTful Moderna**:
   - Reemplazar las peticiones HTTP planas sobre PHP 7.1 y AngularJS 1.6 por una API en backend moderno (NestJS / Go / Python) con WebSockets para sincronizar en tiempo real el estado de correlativos entre todas las cajas activas.

---


### 13. Dudas y Preguntas Clave para el Cliente


1. **¿Qué proveedor PSE/OSE utiliza actualmente CAPRICHOS para la facturación electrónica?**
   - Es necesario conocer si la empresa utiliza un facturador propio conectado directamente a SUNAT o un servicio intermediario (ej. Nubefact, TCI, Efact, Bizlinks) para diseñar los adaptadores de emisión de Boletas y Facturas.
2. **¿CAPRICHOS se encuentra acogido al régimen del IGV al 10% (Ley 31556) o tributa bajo la tasa general del 18%?**
   - Esto definirá la plantilla de cálculo fiscal por defecto de la nueva carta digital y el POS.
3. **¿Se aplican recargos al consumo (servicio del 10%) en la cafetería?**
   - Confirmar si se cobra porcentaje de servicio a la mesa o si todos los precios exhibidos son netos finales.
4. **¿Cómo se realiza el cobro con datafonos en sala?**
   - Precisar si los mozos utilizan datafonos autónomos (Izipay / Niubiz inalámbricos independientes) donde el cajero solo tipea el voucher, o si disponen de terminales integrados vía Bluetooth/Wi-Fi al punto de venta.
5. **¿El local realiza ventas multimoneda de forma habitual?**
   - Determinar si reciben pagos en dólares con frecuencia en caja para dimensionar la necesidad de vuelto bimonetario (pago en USD y vuelto en PEN) en la nueva versión.

---

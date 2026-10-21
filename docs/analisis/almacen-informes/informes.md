---
id: ANA-CAP-004
tipo: analisis
titulo: "Análisis Funcional: Informes, Escritorio, Notificaciones, Perfil y Permisos del Rol Almacén"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, almacen-informes]
---

# Análisis Funcional: Informes, Escritorio, Notificaciones, Perfil y Permisos del Rol Almacén

**Proyecto**: Caprichos - Cafetería de Especialidad (Lima, Perú)  
**Rol Evaluado**: Almacén (`ROLES.almacen`)  
**Fuentes Analizadas**:  
- Maqueta / Mockup: `/tmp/claude-1000/almacen-agy/fuente/Admin.dc.html`, `BRD.md`, `modulos-y-roles.md`, `registro-mockup.md`.  
- Referencia Restaurant.pe: `/tmp/claude-1000/almacen-agy/referencia/informes.md`, `escritorio.md`, `modulos-usuarios-notificaciones.md`, `almacen.md`, `compras.md`.  
**Destino**: `/home/jose/JoseEM/caprichos/analisis/almacen-informes/informes.md`  
**Fecha de Emisión**: Octubre de 2026  

---

## 1 Lo que restaurant.pe tiene en este tema (separa EN VIVO de REFERENCIA): pantallas, pestañas, campos, filtros, columnas, botones, reglas, reportes y permisos

### 1.1 Estado de la VISTA EN VIVO de restaurant.pe
NO SE PUDO VER EN VIVO: requiere que el usuario inicie sesion.  
Al intentar la conexión pasiva al dominio público `https://restaurant.pe`, el servicio responde con su portal comercial y su aplicación web de inicio de sesión (`#!/login`). En estricto cumplimiento de las reglas obligatorias de seguridad y privacidad (no ingresar, almacenar ni manipular credenciales, contraseñas, tokens ni cookies de producción), se detuvo la inspección interactiva en ese punto. Toda la información presentada a continuación proviene de la documentación técnica y funcional de REFERENCIA recopilada en la auditoría del entorno de producción de Caprichos.

---

### 1.2 Según REFERENCIA de restaurant.pe

#### A. Informes de Inventario, Compras, Mermas, Kárdex y Stock Valorizado
En restaurant.pe, los reportes se organizan en dos grandes capas: el **Hub Maestro de Informes** (`#!/informes`) que cuenta con más de 100 reportes transaccionales y consolidados en 9 categorías, y las vistas operativas distribuidas en los submódulos de **Almacén** (`#!/almacen/`) y **Compras** (`#!/compras/`).

##### 1. Catálogo de Informes de Inventario y Almacén (28 reportes en el Hub)
- **Kárdex individual por producto/insumo** (`#!/almacen/kardex/individual`): Movimientos detallados de entradas, salidas y saldos de un insumo seleccionado en un rango de fechas.
- **Kárdex consolidado por fechas**: Visión general de movimientos de todos los insumos en el periodo.
- **Kárdex tributario SUNAT (Formato 13.1)**: Libro de inventario permanente valorizado según norma contable peruana.
- **Stock valorizado** (`#!/informes/inventario/stockvalorizado`): Valoración monetaria de las existencias bajo el método de Promedio Ponderado.
- **Stock valorizado comparativo**: Contraste de inventarios entre meses o ejercicios anuales.
- **Stock actual y Stock Bajo** (`#!/almacen/stock`): Existencias físicas actuales frente a umbrales mínimos y máximos.
- **Historial de merma y desperdicios** (`#!/almacen/merma`): Registro de bajas por deterioro, vencimiento o rotura.
- **Movimientos entre almacenes** y **Movimientos entre almacenes valorizado**: Traslados internos entre bodegas.
- **Historial de preparación de recetas / Órdenes de producción**: Consumos automáticos de materias primas por elaboración.
- **Food Cost (% de costo de materia prima sobre venta)**: Relación entre costo de insumos y precio de venta de la carta.
- **Productos por vencer**: Control preventivo bajo criterio FEFO/FIFO.
- **Catálogo maestro exportable** (`#!/informes/inventario/catalogo`): Diccionario de artículos, unidades de medida y recetas.

##### 2. Catálogo de Informes de Compras (11 reportes en el Hub)
- **Todas las compras** (`#!/informes/compras/todas` y `#!/compras/todas`): Listado maestro de comprobantes de compra.
- **Compras del mes**: Consolidado mensual para liquidación de compras.
- **Compras por producto / insumo** y **Detalle de compras**: Desglose línea por línea de lo adquirido a proveedores.
- **Consolidado de compras por insumo**: Acumulado de cantidades y montos por artículo.
- **Estado de compras / Cuentas por pagar**: Créditos pendientes de pago a proveedores con fechas de vencimiento.
- **Proveedor vs. Artículos**: Historial de variaciones de precios y comparativa de cotizaciones por proveedor.
- **Notas de crédito de compras**: Devoluciones o descuentos comerciales sobre facturas de proveedores.
- **Exportables contables**: Generación de interfaces para Concar, Siscont y libros electrónicos PLE.

##### 3. Pantallas, Filtros, Columnas y Botones Principales

###### Pantalla: Stock y Stock Bajo (`#!/almacen/stock`)
- **Filtros**: Búsqueda por texto de insumo/producto, casilla "Artículos con stock bajo", casilla "Artículos con stock por encima del máximo", casilla "Solo con stock positivo", selectores de Local y Almacén.
- **Columnas**: `Producto / Insumo`, `Tipo` (Insumo, Producto, Receta, Descartable), `Categoría`, `Almacenes`, `Stock total`, `Almacen Principal`, `Stock`, `Mínimo req.`, `Máximo req.`, `Faltante`.
- **Botones**: `Generar informe`, `Generar orden compra` (prepara solicitud en compras), `Descargar` (Excel/CSV).

###### Pantalla: Kárdex Individual (`#!/almacen/kardex/individual`)
- **Filtros**: Rango de fechas, buscador de insumo/descartable/producto, motivo/tipo de movimiento, almacén de origen/destino.
- **Columnas**: `Fecha`, `Tipo movimiento`, `Documento / Comprobante`, `Detalle / Motivo`, `Entrada`, `Salida`, `Saldo físico`, `Costo unitario`, `Valor total`.
- **Regla crítica visible**: Muestra advertencia en cabecera: *"Actualmente cuenta con (N) Ventas pendientes de procesar para el kardex"*, evidenciando que el cómputo de salidas por comandas se ejecuta por lotes asíncronos.

###### Pantalla: Mermas de Almacén (`#!/almacen/merma`)
- **Filtros**: Rango de fechas, local, usuario que registra, motivo de merma.
- **Columnas**: `Local`, `Usuario`, `Tipo`, `Razón / Motivo`, `Fecha registro`, `Fecha evento`, `Importe valorizado`, `Estado`, `Acciones`.
- **Botones**: `Registrar salida`, `Generar informe`.
- **Campos del formulario**: Almacén de salida, Insumo/Producto, Cantidad mermada, Motivo (Vencido, Caído, Mal estado, Merma de elaboración), Costo estimado.

###### Pantalla: Stock Valorizado (`#!/informes/inventario/stockvalorizado`)
- **Filtros**: Local, Almacén específico o consolidado, Categoría/Familia, Fecha de corte, Moneda.
- **Columnas**: `Producto / Insumo`, `¿Afecto?`, `Unidad de medida`, `Categoría`, `Almacenes`, `Consolidado`, `Almacen Principal`, `Stock`, `Valor Promedio`, `Stock valorizado`.
- **Botones**: `Buscar / Generar informe`, `Descargar Excel`.

###### Pantalla: Registro y Listado de Compras (`#!/compras/todas`)
- **Filtros**: Rango de fechas, local, proveedor (búsqueda por RUC/Razón Social), tipo de comprobante (Factura, Boleta, Recibo Honorarios), estado de pago (Pagado, Crédito, Anulado).
- **Columnas**: `Fecha`, `Local`, `Proveedor`, `Documento`, `Serie doc.`, `Número doc.`, `Nota de crédito`, `Total`, `Estado`.
- **Formulario de compra (`compra-form.html`)**: Fecha de compra, fecha de tributación, proveedor, establecimiento, tipo de documento, serie, número, moneda (Soles/Dólares), tipo de cambio SUNAT, casilla "Generar impuestos a partir del total", detalle de insumos con almacén destino, cantidad, unidad de medida, precio unitario, afectación IGV, fecha de vencimiento del lote, condición de pago (Contado con salida de caja o Crédito con cuotas), régimen de percepciones y detracciones SPOT SUNAT.

---

#### B. Escritorio e Indicadores en restaurant.pe (`#!/`)
- **Orientación del escritorio**: La pantalla de inicio de restaurant.pe (`escritorio.resumen`) está diseñada para la gestión comercial y gerencial general del local. No existe un escritorio específico ni exclusivo para el rol de almacén.
- **Indicadores que muestra**: Total de ventas en soles, ventas con tarjeta, efectivo, ventas al crédito, egresos de caja chica, descuentos, propinas, rotación de mesas, curva horaria de ventas (hora punta y hora libre), mozo más eficiente, tiempos de espera en despacho de cocina y ranking de productos más vendidos.
- **Indicadores y alertas visibles para almacén**: El personal con acceso a inventarios solo observa en el encabezado global un banner fijo de alerta: *"Desde ahora puedes ver los artículos con stock bajo desde Almacén/stock, click aquí para ir"*, el cual enlaza a la vista de existencias.

---

#### C. Notificaciones en restaurant.pe
El sistema cuenta con varios canales de notificación en la barra superior (`topnavbar.html` y `subnav.html`):
1. **Campana de comprobantes pendientes (`fa-bell`)**: Alerta anaranjada si hay boletas o facturas con sincronización pendiente ante SUNAT.
2. **Buzón de mensajes internos (`fa-envelope`)**: Bandeja con badge numérico rojo de mensajes no leídos entre colaboradores del restaurante y panel desplegable.
3. **Dropdown de notificaciones del sistema**: Menú con las últimas 7 alertas generales, incluyendo avisos de stock mínimo.
4. **Alerta de error de impresora (`fa-print`)**: Icono animado con signo de exclamación cuando falla la cola de tickets o la conexión de red.
5. **Avisos de delivery por confirmar (`fa-truck`)**: Indicador de pedidos online entrantes.
6. **Banners institucionales fijos**: Avisos de cuota o suscripción mensual pendiente de pago a la plataforma restaurant.pe, advertencias preventivas sobre caducidad del Certificado Digital Tributario (CDT) ante SUNAT y notificaciones de tickets atendidos por soporte.

---

#### D. Perfil de Usuario en restaurant.pe
- **Ubicación**: Menú desplegable con icono de engranaje en la esquina superior derecha y bloque `.profile-element` en la parte alta del menú lateral.
- **Datos visibles**: Nombre o nick del colaborador (`krosales`), caja vinculada en el turno (`Caja Principal`) y local activo (`CAPRICHOS`).
- **Opciones disponibles**:
  - Enlace directo a Ajustes del sistema (`#!/ajustes`).
  - Conmutador de sucursales (permite cambiar de local en caliente si tiene privilegios multilocal).
  - Enlace de cierre de sesión seguro (`main.cerrarSesion()`).

---

#### E. Permisos de Seguridad (Ajustes > Usuarios en restaurant.pe)
- **Roles nativos en el sistema**: `ADMINISTRADOR`, `CAJERO`, `PRODUCCION`, `MOZO`, `CALL CENTER`, `AUTO SERVICIO` y `MOTORIZADO`. El puesto de almacenero se configura habitualmente bajo el cargo de `PRODUCCION` o `ADMINISTRADOR` restringido a través de perfiles de usuario (`perfilUsuario.html`).
- **Catálogo de permisos**: Más de 500 directivas granulares organizadas por módulos.
- **Permisos asociados a inventarios y compras**:
  - `PERMISO_COMPRAS_VER`: Visualización del registro de compras y comprobantes de proveedores.
  - `PERMISO_COMPRAS_REGISTRAR`: Alta y guardado de facturas de compra y lotes.
  - `PERMISO_COMPRAS_ANULAR`: Anulación de facturas de compra previamente ingresadas.
  - `PERMISO_PROVEEDORES_EDITAR`: Mantenimiento del catálogo de proveedores y RUCs.
  - `PERMISO_LOTES_PAGAR`: Liquidación y programación financiera de cuentas por pagar.
  - `PERMISO_AJUSTES_COMPRAS`: Configuración de bancos y tipos de comprobantes.
  - `almacen.movimientoalmacen`: Autorización para registrar entradas, salidas y transferencias.
  - Permisos específicos para visualización y descarga de kárdex, stock valorizado y mermas.

---

## 2 Lo que el mockup YA tiene para el rol almacén en este tema (con evidencia)

### 2.1 Definición y Alcance del Rol Almacén
En el archivo principal del mockup `/tmp/claude-1000/almacen-agy/fuente/Admin.dc.html`, el rol `almacen` está formalmente parametrizado:
- **Línea 2833 (`ROLES.almacen`)**:  
  `almacen: { n: 'Almacén', user: 'alm01', person: 'Almacenero de ejemplo', ini: 'AL', color: '#F08A3E', views: [ 'escritorio', 'compras', 'almacen', 'stock', 'informes', 'notificaciones' ], home: 'escritorio', manage: false }`
- **Línea 98 de `modulos-y-roles.md`**:  
  Define su alcance funcional: *"Almacén: Controla insumos y recibe mercadería. Ve: Escritorio, Compras, Almacén, Stock y recetas, Informes, Notificaciones. Escritorio: insumos bajo el mínimo, compras por recibir, movimientos del día, requerimientos pendientes, últimos movimientos y lista de stock bajo. No ve: ventas, caja ni clientes"*.

---

### 2.2 Escritorio del Almacenero en el Mockup
A diferencia de restaurant.pe, el mockup cuenta con una pantalla de Escritorio diseñada a la medida del rol Almacén:
- **Indicadores superiores (4 KPIs) (Línea 3193 de `Admin.dc.html`)**:
  1. `Insumos bajo el mínimo`: Cálculo en vivo evaluando los insumos cuyo stock es inferior al umbral mínimo (`lowSupplies.length`).
  2. `Compras por recibir`: Conteo en vivo de las órdenes de compra en estado "Pendiente" en `TABLES.compras.rows`.
  3. `Movimientos de hoy`: Valor referencial (`'3'`).
  4. `Requerimientos pendientes`: Valor referencial (`'1'`).
- **Bloque "Para hacer ahora" (Línea 3194 de `Admin.dc.html`)**:
  - `Insumos con stock bajo`: Conteo y enlace directo a la vista `stock`.
  - `Compras pendientes`: Conteo y enlace directo a la vista `compras`.
  - `Movimientos de almacén`: Enlace directo a la vista `almacen`.
- **Lista central "Últimos movimientos" (Líneas 3195 y 948-965 de `Admin.dc.html`)**:
  - Presenta las últimas 4 transacciones de `TABLES.almacen`: nombre del insumo, cantidad, fecha, almacén origen, almacén destino, código de documento y distintivo visual según tipo (Entrada, Salida, Merma, Devolución).
- **Sección de Alerta "Insumos con stock bajo" (Líneas 3207 y 977-982 de `Admin.dc.html`)**:
  - Activada con la bandera `showStock = true`. Despliega tarjetas con recuadro en color de advertencia mostrando cada insumo crítico, su stock disponible y su mínimo requerido (ej. Crema chantilly, Leche sin lactosa).
- **Seguridad y privacidad operativa (Líneas 3163, 3170 y 938-945)**:
  - La bandera `dCharts` permanece apagada para almacén. El almacenero no tiene acceso visual a los gráficos horarios, facturación del día en soles, ticket promedio, comensales ni información de cajas registradoras.

---

### 2.3 Módulo de Informes en el Mockup
- **Estructura observada (Líneas 2878-2885 de `Admin.dc.html`)**:
  - La vista `informes` en el mockup no es un motor de cálculo ni un generador de reportes, sino una tabla estática informativa bajo el título: *"Catálogo de reportes disponibles. Aquí solo se muestra su estructura"*.
  - Registra 14 filas de ejemplo clasificadas en 6 categorías: Ventas (4), Caja (2), Inventario (3), Compras (1), Clientes (2) y Delivery (2).
- **Reportes de Inventario y Compras contemplados en dicha tabla**:
  - `Kardex de insumos` (Categoría Inventario, describe: "Entradas y salidas por insumo", filtros: "Fecha, insumo", exportar: "Excel").
  - `Stock bajo` (Categoría Inventario, describe: "Insumos por debajo del mínimo", filtros: "Almacén", exportar: "PDF · Excel").
  - `Mermas` (Categoría Inventario, describe: "Pérdidas por insumo y motivo", filtros: "Fecha", exportar: "Excel").
  - `Compras por proveedor` (Categoría Compras, describe: "Total comprado por proveedor", filtros: "Fecha, proveedor", exportar: "PDF · Excel").
- **Evidencia sobre Stock Valorizado y otros reportes**:
  - El informe de **Stock Valorizado NO EXISTE** en la tabla ni en ninguna otra sección del mockup.
  - Tampoco existen reportes de Kardex SUNAT 13.1, Detalle de compras por insumo, Consolidado de compras ni Productos por vencer.

---

### 2.4 Notificaciones Recibidas por el Rol Almacén
- **Lógica de filtrado en cabecera (Líneas 3670-3687 de `Admin.dc.html`)**:
  - El sistema evalúa `addN(n)` validando si el rol activo figura en la lista autorizada de la alerta.
- **Notificaciones que SÍ recibe el almacenero**:
  1. `Insumos bajo el mínimo` (Línea 3680): Alerta de prioridad media (`id: 'stk'`) dirigida a `['admin', 'almacen', 'produccion', 'cocina']`. Detalla los insumos críticos y ofrece el botón de acción inmediata `Ver stock` para navegar a la vista de existencias.
  2. `Sin internet` (Línea 3677): Alerta de prioridad alta (`id: 'net'`) para todos los roles (`Object.keys(ROLES)`). Avisa que el sistema opera en modo local fuera de línea.
  3. `Internet de vuelta` (Línea 3678): Alerta de prioridad baja (`id: 'sync'`) para todos los roles, confirmando la reconexión.
- **Notificaciones que NO recibe el almacenero**:
  - Alertas de atención al cliente / quejas de WhatsApp (`ROLES_ATT = ['admin', 'cajero', 'mozo', 'callcenter']`).
  - Solicitudes de reservas de mesas (`ROLES_ATT`).
  - Pedidos por confirmar de caja (`['admin', 'cajero', 'callcenter', 'mozo']`).
  - Errores de impresora de cocina (`['admin', 'cajero', 'cocina']`).
  - Avisos de delivery para repartidores (`['repartidor']`).
- **Vista tabular de Notificaciones (`TABLES.notificaciones`, líneas 2897-2900)**:
  - Muestra una tabla con columnas: `Fecha`, `Tipo`, `Mensaje`, `Estado`, con filtros por Tipo y Estado.

---

### 2.5 Perfil del Usuario Almacén
- **Estructura en plantilla (Líneas 1575-1601 de `Admin.dc.html`)**:
  - Foto o avatar con iniciales `AL` sobre fondo naranja (#F08A3E).
  - Botón interactivo `Cambiar foto` con recorte automático de imagen en canvas local.
  - Tarjetas de datos fijos:
    - `USUARIO`: `alm01`
    - `ROL`: `Almacén`
    - `LOCAL`: `CAPRICHOS`
    - `CAJA Y TURNO`: `Caja Principal · Día` (valor asignado por defecto en la inicialización global del sistema).
  - Restricción de seguridad: Texto explícito *"Por seguridad, solo el administrador puede cambiar tus datos (nombre, usuario, rol, local y caja). Tú puedes cambiar tu foto."* (Línea 1594). El botón `Editar mis datos` permanece oculto para este rol.
  - Módulos con acceso: Listado de etiquetas destacadas con las 6 vistas asignadas: Escritorio, Compras, Almacén, Stock y recetas, Informes, Notificaciones.
  - Botón de cierre de sesión: `Cerrar sesión`.

---

### 2.6 Matriz de Permisos del Rol Almacén en el Mockup
Analizando las funciones del controlador en `Admin.dc.html`:

| Módulo | Ver | Crear | Editar | Anular / Desactivar | Aprobar | Evidencia en Código del Mockup |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Escritorio** | SÍ | NO | NO | NO | NO | Líneas 2833, 3192-3195, 937-983. Solo consulta de métricas propias y accesos directos. |
| **Almacén** | SÍ | SÍ | SÍ | SÍ | NO | Líneas 3950 (`canMove`), 1060 (Botones `Registrar movimiento` y `Registrar la producción`), 3146 (`edit.kind = 'table'`), 3144 (`tinactive`). Permite además el botón especial `Cerrar el día (sobrantes a merma)` (Línea 3960). No existe flujo de aprobación de transferencias. |
| **Compras** | SÍ | NO | SÍ | SÍ | NO | Líneas 2867-2872 (`TABLES.compras`), 3146 (Edita campos de la fila), 3144 (Desactiva la orden). No hay botón de "Nueva compra" en esta vista. No hay botón de recepción formal. |
| **Stock y Recetas** | SÍ | NO | NO | NO | NO | Líneas 808-863. Visualiza insumos, recetas, márgenes y costos. Puede accionar botones operativos: `Armar orden de compra con lo bajo` (abre texto WhatsApp), `Pedir por WhatsApp` y `Cerrar el día`. No edita fichas de insumo. |
| **Informes** | SÍ | NO | NO | NO | NO | Líneas 2878-2885 (`TABLES.informes`). Solo lectura de la tabla catálogo. No hay generación interactiva ni descargas reales. |
| **Notificaciones** | SÍ | NO | NO | NO | NO | Líneas 3670-3687 y 2897-2900. Consulta de alertas en campana y tabla. Acciona "Ver stock" o "Entendido". |
| **Resto de Módulos (18 módulos)** | NO | NO | NO | NO | NO | Líneas 2833 (`views`) y 2965 (`go`). Bloqueados por completo para el rol almacén (no figuran en menú lateral ni switcher). |

---

## 3 Lo que FALTA o está incompleto

| Qué falta | Dónde lo tiene restaurant.pe | Por qué importa | Gravedad | Esfuerzo |
| :--- | :--- | :--- | :---: | :---: |
| **Informe de Stock Valorizado** (costo promedio y valor total en soles del inventario) | En `#!/informes/inventario/stockvalorizado` y widget de indicadores | Imprescindible para conocer cuánto dinero hay invertido en insumos y calcular el costo de ventas contable mensual de la cafetería. | **Alta** | **M** |
| **Kárdex interactivo de insumos** con historial cronológico de entradas, salidas y saldo valorizado | En `#!/almacen/kardex/individual` | Permite auditar qué pasó con insumos de alto valor (café en grano, leche, pulpas, envases) y justificar descuadres físicos. | **Alta** | **M** |
| **Generador interactivo de informes** con filtros funcionales y descargas reales (Excel / PDF) | En `#!/informes` (Hub con más de 100 reportes y exportadores) | Hoy en el mockup la vista de informes es solo una tabla catálogo estática; no permite consultar datos reales ni exportar planillas. | **Alta** | **M** |
| **Flujo de Recepción de Compras** que alimente automáticamente el inventario | En `#!/compras/todas` y `#!/almacen/requerimientomovimiento/requerimientos/nuevo-recepcion` | Si se recibe una orden de compra, debe existir un botón para recibir mercadería y que el stock suba automáticamente sin doble digitación. | **Alta** | **M** |
| **Reporte detallado de Mermas** con clasificación por motivo y costo imputado | En `#!/almacen/merma` | Permite identificar si las pérdidas ocurren por vencimiento, mala manipulación o calibración de máquinas de café, midiendo su costo en soles. | **Media** | **S** |
| **Cuentas por pagar a proveedores y compras por insumo** | En `#!/informes/compras/todas` y `comprasporpagar` | El almacenero o encargado debe saber qué compras están al crédito, cuáles vencen y cuánto volumen de insumos se compra a cada proveedor. | **Media** | **S** |
| **Notificación de compras por recibir y de requerimientos de cocina** | En banners de cabecera y alertas de almacén | Avisar al almacenero cuando un pedido a proveedor está programado para entrega hoy o cuando cocina solicita insumos urgentes. | **Media** | **S** |
| **Alerta preventiva de insumos y productos por vencer** | En `#!/informes/inventario/productosporvencer` | En una cafetería con lácteos, embutidos y pastelería, los insumos perecibles deben alertar antes de malograrse en la bodega. | **Media** | **S** |
| **Gestión de multialmacén físico** (Almacén Central vs Cocina vs Barra) | En `#!/ajustes/produccion` y transferencias | El mockup mezcla almacén central con cocina y barra como destinos, pero no maneja saldos de stock independientes por estación. | **Media** | **M** |
| **Corrección de contexto en el Perfil de Almacén** | En `.profile-element` | En el mockup, el perfil del almacenero indica `Caja Principal · Día`; el rol almacén no cobra ni gestiona cajas de dinero en efectivo. | **Baja** | **S** |

---

## 4 Mejoras sobre restaurant.pe (qué haría mejor nuestro sistema)

1. **Unificación de Informes en un solo lugar interactivo y sin tablas redundantes**:
   - *Problema en restaurant.pe*: Dispersa la información en más de 39 reportes distintos entre el Hub de Informes, el Tablero de Indicadores, la pantalla de Stock, la de Kárdex y la de Mermas.
   - *Solución Caprichos*: Un único módulo de Informes Logísticos con 4 pestañas esenciales para la cafetería: Kárdex por Insumo, Stock Valorizado, Mermas y Compras por Proveedor, con filtros compartidos de fecha y búsqueda rápida.

2. **Escritorio Logístico enfocado en la operación del día**:
   - *Problema en restaurant.pe*: Obliga a todo usuario que entra a la portada a ver ventas de salón, tarjetas y gráficos comerciales que no le competen al almacenero.
   - *Solución Caprichos*: El escritorio de Almacén de Caprichos ya diseñado muestra únicamente lo que el colaborador necesita para su turno: insumos bajo el mínimo, órdenes de compra por recibir, requerimientos pendientes y accesos directos de acción.

3. **Cierre diario de productos perecibles en un solo clic**:
   - *Problema en restaurant.pe*: Dar de baja los sobrantes de pastelería (donas, postres de vitrina que duran un día) exige ingresar manualmente movimiento por movimiento en la pantalla de mermas.
   - *Solución Caprichos*: Incorporación del botón operativo `Cerrar el día (sobrantes a merma)` (`closeDay`), que detecta los productos con vida útil diaria y traslada sus saldos a merma automáticamente en segundos.

4. **Kárdex reactivo e instantáneo sin procesamiento por lotes**:
   - *Problema en restaurant.pe*: El kárdex muestra alertas de *"Ventas pendientes de procesar"*, obligando a esperar procesos batch en el servidor para ver el stock real tras una venta.
   - *Solución Caprichos*: Descuento de stock en tiempo real al momento en que la comanda es aceptada en caja, manteniendo el saldo del kárdex permanentemente conciliado.

5. **Abastecimiento directo por WhatsApp con proveedores**:
   - *Problema en restaurant.pe*: Genera órdenes de compra en formatos PDF rígidos pensados para impresión formal o envío por correo tradicional.
   - *Solución Caprichos*: Integración de los botones `Armar orden de compra con lo bajo` y `Pedir por WhatsApp`, que redactan un mensaje de texto limpio y formateado con los faltantes exactos para enviarlo directamente al chat del proveedor.

---

## 5 Propuesta concreta de implementación en el mockup, priorizada

### Fase 1: Núcleo de Informes y Recepción (Prioridad Alta)
1. **Transformar la vista `informes` en un panel de consulta funcional**:
   - Reemplazar la tabla descriptiva actual por un selector de 3 informes logísticos clave:
     - **Pestaña 1: Kárdex de Insumos**: Selector de insumo, selector de rango de fechas (Hoy, Esta semana, Este mes), tabla con columnas `Fecha`, `Movimiento`, `Documento`, `Entrada`, `Salida`, `Saldo` y botón de exportación a Excel.
     - **Pestaña 2: Stock Valorizado**: Tabla de insumos con columnas `Insumo`, `Unidad`, `Stock actual`, `Costo unitario (s/)`, `Valor total (s/)` y tarjeta superior con el KPI `Valor Total del Inventario (s/)`.
     - **Pestaña 3: Mermas del Periodo**: Tabla de bajas con `Fecha`, `Insumo`, `Cantidad`, `Motivo` (Vencimiento, Desecho, Personal) y `Costo estimado`.
2. **Acción de Recepción de Mercadería en Compras**:
   - En la vista `compras`, agregar en cada fila con estado "Pendiente" un botón de acción rápida `Recibir mercadería`. Al pulsarlo con confirmación Sí/No, la orden pasa a estado "Recibida" y se genera automáticamente una Entrada en la tabla de `almacen`, actualizando el stock disponible.
3. **Ajuste del Perfil del Almacenero**:
   - En la vista `perfil`, reemplazar el campo `CAJA Y TURNO: Caja Principal · Día` por `UBICACIÓN: Almacén Central`, eliminando la referencia a cajas registradoras para roles que no manejan cobranzas.

### Fase 2: Alertas y Trazabilidad Operativa (Prioridad Media)
1. **Incorporar Notificaciones Logísticas en la Campana**:
   - Agregar dos nuevas alertas automáticas en `Admin.dc.html`:
     - Alerta de compras esperadas: *"OC-211 de Lácteos del Norte programada para recepción hoy"*.
     - Alerta de insumos por vencer: *"Donas del día pendientes de rotación o cierre"*.
2. **Campos de Costo en Movimientos de Almacén**:
   - En el formulario `Registrar movimiento` (`openMov`), agregar los campos numéricos opcionales `Costo unitario` e `Importe total`, de modo que las entradas y compras registren la valorización del lote.

### Fase 3: Integración Contable y Previsión (Prioridad Baja / Evolutiva)
1. **Exportable Kárdex SUNAT (Formato 13.1)**:
   - Botón en informes para descargar archivo estructurado compatible con los requerimientos contables y tributarios peruanos.
2. **Previsión de Agotamiento de Insumos**:
   - Cálculo del ritmo de consumo promedio de insumos (días de stock restantes) en la pantalla de Stock, avisando visualmente cuántos días faltan para que se termine el café o la leche según el ritmo de ventas del mes.

---

## 6 Preguntas para el dueño (Kevin)

1. **Gestión de Compras y Pagos**: ¿El almacenero de Caprichos registra y negocia compras a proveedores, o su labor es estrictamente recibir la mercadería en puerta y verificar las cantidades físicas contra la guía/orden?
2. **Criterio de Costeo de Inventarios**: Para calcular el costo de los insumos y el stock valorizado, ¿prefieren utilizar el método de Costo Promedio Ponderado (como restaurant.pe) o el Costo de la Última Compra?
3. **Requerimientos Contables Externos**: ¿El contador externo de Caprichos solicita el reporte de Kárdex SUNAT Formato 13.1 o únicamente trabaja con el consolidado mensual de facturas de compra y cierres de caja?
4. **Comunicación de Insumos entre Cocina y Almacén**: ¿Cocina y barra solicitan insumos mediante vales de requerimiento dentro del sistema, o el almacenero abastece libremente las estaciones al inicio de cada turno?
5. **Control de Vencimientos**: ¿Existen insumos críticos que requieran registrar fecha de caducidad por lote al ingresar al local (por ejemplo leche, embutidos, cremas), o se gestiona mediante control visual diario en almacén?
6. **Desvinculación Total de Caja**: ¿Confirmamos que el almacenero no debe tener asignada ninguna caja registradora ni turno de apertura/cierre en su perfil y escritorio?

---

## 7 NO VERIFICADO

1. **Comportamiento en vivo de las pantallas de restaurant.pe**: No verificado de forma interactiva en la sesión actual debido a que el sistema requiere inicio de sesión con credenciales de usuario activo. Se trabajó rigurosamente con la documentación de auditoría técnica previa de solo lectura.
2. **Algoritmo de cálculo de Kárdex valorizado en el backend de restaurant.pe**: No verificado el código fuente de los procedimientos almacenados en la base de datos de restaurant.pe respecto a si descuentan percepciones o fletes del costo unitario registrado.
3. **Padrón real de insumos y costos unitarios de Caprichos**: No verificado el inventario valorizado real de la empresa para dar estricto cumplimiento al protocolo de confidencialidad de datos comerciales.
4. **Configuración de permisos POS para almacén**: No verificada la pantalla `editar-permisopos.html` para personal de almacén en terminales físicas táctiles, ya que la auditoría se concentró en la consola web administrativa.

---

INFORME LISTO.

# Reporte de Auditoría y Mapeo de Módulos: CAPRICHOS (restaurant.pe)

**Fecha y Hora de Ejecución**: 2026-10-13 10:40:00 (Hora Local Lima / America/Lima)  
**Objetivo**: Validación de acceso en modo de solo lectura y extracción del árbol de módulos para la cuenta `krosales` en el sistema en producción `https://caprichos.restaurant.pe/restaurant/#!/login`.  
**Alcance**: Auditoría pasiva de interfaz y navegación, sin ejecución de operaciones, transacciones ni alteraciones en base de datos o cajas.

---

## (a) Resultado del Inicio de Sesión

### Estado: **INICIO DE SESIÓN EXITOSO (1 solo intento)**

El inicio de sesión se realizó en un único intento controlado mediante Playwright, respetando estrictamente las restricciones de seguridad y el modo de solo lectura.

### Campos del Formulario de Login Observados Previamente:
Previo al envío del formulario, se inspeccionaron todos los controles de entrada y sus valores precargados en el DOM:

| Campo (Atributo `name` / `ng-model`) | Tipo de Control | Valor Precargado Observado | Texto Visible / Etiqueta | Acción Realizada |
| :--- | :--- | :--- | :--- | :--- |
| `local_id` (`vm.usuario.local_id`) | `<select>` | `string:1` | **CAPRICHOS** | *No tocado (conservado)* |
| `caja_id` (`vm.usuario.caja_id`) | `<select>` | `string:1` | **Caja Principal** | *No tocado (conservado)* |
| `turno_id` (`vm.usuario.turno_id`) | `<select>` | `string:1` | **Turno Dia** | *No tocado (conservado)* |
| `usuario_nick` (`vm.usuario.usuario_nick`) | `<input type="text">` | `""` (vacío) | Placeholder: `Usuario` | *Escrito únicamente: `krosales`* |
| `usuario_clave` (`vm.usuario.usuario_clave`) | `<input type="password">`| `""` (vacío) | Placeholder: `Contraseña` | *Ingresado desde variable de entorno* |
| `usuario_clavecaja` (`vm.usuario.usuario_clavecaja`)| `<input type="password">`| `""` (vacío) | Placeholder: `Clave de caja` | *No tocado (se dejó vacío)* |

### Pasos Exactos Ejecutados:
1. **Navegación**: Carga de `https://caprichos.restaurant.pe/restaurant/#!/login` con evento `domcontentloaded`.
2. **Estabilización del DOM**: Espera pasiva de 4 segundos para asegurar la inicialización del framework AngularJS y la carga de valores en los selectores.
3. **Lectura de campos precargados**: Extracción de los valores y nombres de todos los campos del formulario sin modificar nada.
4. **Completado de credenciales**:
   - Inyección del usuario `krosales` en el campo `input[name="usuario_nick"]`.
   - Inyección de la contraseña proveniente de la variable de entorno en `input[name="usuario_clave"]`.
   - El campo `usuario_clavecaja` no fue modificado y se mantuvo vacío.
5. **Pulsación única**: Un único clic sobre el botón de inicio de sesión: `<button type="submit" class="btn btn-primary btn-block m-t-lg ladda-button">` (`Iniciar sesión`).
6. **Respuesta del sistema**:
   - Transición de URL: De `http://caprichos.restaurant.pe/restaurant/#!/login` a la pantalla principal `http://caprichos.restaurant.pe/restaurant/#!/`.
   - Petición de backend: Llamada HTTP 200 a `/restaurant/api/rest/usuario/obtenerAddonsPorToken`.
   - Mensajes de error en login: **Ninguno**.
   - Contador de intentos / bloqueo: **NO OBSERVADO** (no aplicó al ser una autenticación inmediata y exitosa).
7. **Exploración pasiva del menú**: Extracción completa de los elementos de navegación y submódulos desplegables sin ejecutar transacciones ni abrir/cerrar caja.
8. **Cierre de sesión seguro**: Al terminar la lectura, se localizó el enlace `Cerrar sesión`, se hizo clic para finalizar la sesión en el servidor y se cerró la instancia del navegador.

---

## (b) Árbol COMPLETO de Módulos y Submódulos Accesibles

A continuación se detalla la jerarquía exacta de la barra de navegación lateral y menús accesibles para la cuenta `krosales`:

```text
├── Usuario: krosales CAPRICHOS
├── Academia
├── Escritorio (index.html)
│   ├── Resumen (#!/)
│   └── Novedades (#!/novedades)
├── Add onsNuevo
│   ├── Plaza puntosActivalo (#!/ajustes/addon-nuevos/Plaza_puntos)
│   ├── EncuestasActivalo (#!/ajustes/addon-nuevos/Encuestas)
│   ├── Self serviceActivalo (#!/ajustes/addon-nuevos/Self_service)
│   ├── Workplace LogisticaActivalo (#!/ajustes/addon-nuevos/Workplace_Logistica)
│   └── AsistenciasActivalo (#!/ajustes/addon-nuevos/Asistencias)
├── Ventas (#!/ventas/hacer-pedidos/salones)
│   ├── Pedidos en caja (#!/ventas/hacer-pedidos/salones)
│   ├── Pedidos Multimozo (#!/ventas/multimozo)
│   └── Pantalla de cocina (#!/ventas/ver-pedidos/estado)
├── Caja (#!/caja/cobrar)
│   ├── Cobrar (#!/caja/cobrar/salones)
│   ├── Apertura y cierre (#!/caja/apertura-cierre)
│   ├── Cierre caja Z (#!/caja/cierre-caja-z)
│   ├── Cierres de caja (#!/caja/movimientos)
│   ├── Ingresos (#!/caja/ingresos)
│   ├── Egresos (#!/caja/egresos)
│   ├── Notas de credito (#!/caja/Notas-Credito)
│   ├── Notas de debito (#!/caja/Notas-Debito)
│   ├── Monitor de ventas (#!/caja/monitorcaja)
│   └── Consulta de precios (#!/informes/inventario/productos-con-precio)
├── Reservas (#!/reservas/principal)
├── Créditos
│   ├── Cobro de ventas (#!/creditos/ventacreditos)
│   └── Pago de compras (#!/creditos/compracreditos)
├── Clientes (#!/descuentos)
│   ├── Clientes (#!/clientes)
│   └── Debito (#!/clientes/debito)
├── Productos (#!/productos/platos/categoria/All)
├── Ofertas (#!/ofertas/sucursales/2en1/1/categoria/All)
├── Descuentos (#!/descuentos)
│   ├── Descuentos (#!/descuentos)
│   ├── Cupón descuento (#!/ajustes/cupondescuento)
│   ├── Promociones y sorteos (#!/promocionsorteo)
│   └── Vales de Pago (#!/ajustes/valedepago)
├── Compras
│   ├── Proveedores (#!/compras/proveedores)
│   ├── Lotizar compras (#!/compras/lotes)
│   ├── Ajustes (#!/compras/ajustes/banco)
│   └── Ir a módulo logística Nuevo (enlace externo / sin ruta interna)
├── Almacén
│   ├── Movimiento interno (#!/almacen/requerimientomovimiento/requerimientos/movimiento)
│   ├── Requerimiento (#!/almacen/requerimientomovimiento/requerimientos/nuevo-requerimiento)
│   ├── Recepción (#!/almacen/requerimientomovimiento/requerimientos/nuevo-recepcion)
│   ├── Lista de procesos (#!/almacen/requerimientomovimiento/requerimientos/lista-de-proceso)
│   ├── Ir modulo gastos (sin enlace directo)
│   └── Ir a módulo logística Nuevo (sin enlace directo)
├── Delivery
│   ├── Menú online Nuevo (https://caprichos.restaurant.pe/carta-digital/#/inicio)
│   ├── Pedidos QR Nuevo (https://caprichos.restaurant.pe/carta-digital/#/inicio?pickupAtStore=1&storeId=null)
│   ├── Call center (#!/ventas/callcenter)
│   ├── Tu restaurant en facebook (#!/delivery)
│   ├── Zona de reparto (#!/ajustes/zonareparto)
│   ├── Ajustes (#!/delivery/ajustes/motorizado)
│   ├── Informes (agrupador)
│   ├── Resumen (#!/resumen/delivery)
│   ├── Zona de reparto (#!/informes/ventas/deliverys-cobertura)
│   ├── Zona de reparto (Mapa de calor) (#!/informes/ventas/deliverys-cobertura/mapa)
│   ├── Reclamos (#!/ventas/callcenter/reclamo)
│   └── Frecuencia (#!/informes/ventas/deliverys-frecuencia)
├── Informes (#!/informes)
├── Indicadores (#!/indicadores)
├── Mis Addons
│   ├── Encuestas (sin enlace)
│   ├── Delivery Pro (sin enlace)
│   └── Club de Beneficios (sin enlace)
├── Mi restaurant
│   ├── Mi empresa (#!/mirestaurante/miempresa)
│   ├── Pagos del sistema (sin enlace)
│   ├── Facturación Electrónica (#!/ajustes/facturacionelectronica)
│   ├── Series de contingencia (#!/ajustes/serie-contingencia)
│   ├── Integraciones (#!/ajustes/integraciones)
│   ├── Integración POS (#!/ajustes/pos)
│   └── Contrato (#!/ajustes/contrato)
└── Ajustes (#!/ajustes)
    ├── Opciones sistema (#!/ajustes/opcionessistema)
    ├── Opciones de APP Quipu (#!/ajustes/configuracionpos)
    ├── Configuración regional (#!/ajustes/configuracionregional)
    ├── Locales (#!/ajustes/locales)
    ├── Usuarios (#!/ajustes/usuarios)
    ├── Almacenes y Producción (#!/ajustes/produccion)
    ├── Salones y Mesas (#!/ajustes/salones)
    ├── Cajas (#!/ajustes/cajas)
    ├── Comprobantes (#!/ajustes/comprobantes)
    ├── Impresoras (#!/ajustes/impresoras)
    ├── Impuestos (#!/ajustes/impuestos)
    ├── Tarjetas (#!/ajustes/tarjetas)
    ├── Turnos (#!/ajustes/turnos)
    ├── Monedas (#!/ajustes/monedas)
    ├── Moneda de facturacion (#!/ajustes/monedafacturacion)
    ├── Cuentas de transferencia (#!/ajustes/tipotransferencia)
    ├── Gestión de marcas (#!/ajustes/marca)
    ├── Imágenes self service (#!/ajustes/imagen-self-service)
    ├── Categoría Anular Venta (#!/ajustes/categoriaanularventa)
    └── Formas de pago (#!/ajustes/formas-de-pago)
```

---

## (c) Módulos Bloqueados o Ausentes

1. **Add-ons Comerciales no activos ("Actívalo")**:
   - `Plaza puntos`, `Encuestas`, `Self service`, `Workplace Logistica`, `Asistencias`.  
   - En la respuesta oficial del endpoint de addons (`/restaurant/api/rest/usuario/obtenerAddonsPorToken`), los siguientes indicadores vinieron inactivos (`"0"`):
     - `tieneAddonAsistencia: "0"`
     - `deboMostrarProgramaFidelizacion: "0"`
     - `deboMostrarReservas: "0"` (aunque el enlace a reservas está visible en la barra lateral)
     - `deboMostrarAsistenciasFaceID: "0"`
     - `deboMostrarLogisticaIA: "0"`
2. **Submódulos con enlaces vacíos o no vinculados (`href=""`)**:
   - En Compras: `Ir a módulo logística Nuevo`.
   - En Almacén: `Ir modulo gastos`, `Ir a módulo logística Nuevo`.
   - En Mis Addons: `Encuestas`, `Delivery Pro`, `Club de Beneficios`.
   - En Mi restaurant: `Pagos del sistema`.
3. **Ausencia de bloqueos por rol o perfil en el menú lateral**:
   - **NO OBSERVADO** ningún módulo con candado o desactivación visual en la barra lateral.
   - *Nota*: La cuenta `krosales` fue descrita como "cuenta de solo lectura", sin embargo, el menú lateral expone enlaces a la totalidad de las opciones del sistema (incluyendo administración de usuarios, facturación electrónica, configuración fiscal y aperturas de caja). Debido a que no se hizo clic en dichas pantallas para no alterar producción, **NO OBSERVADO** si el backend aplica una restricción por API al intentar realizar cambios (REST 403 Forbidden) o si la cuenta posee permisos reales de administrador.

---

## (d) Tecnología Observada

- **Arquitectura de Frontend**: Single Page Application (SPA) con enrutamiento Hashbang (`#!/`).
- **Framework Principal**: AngularJS **v1.6.10** (`window.angular.version.full = 1.6.10`).
- **Librerías Frontend**:
  - jQuery **v3.2.1** (`window.jQuery.fn.jquery = 3.2.1`).
  - Bootstrap **v3** (detectado en plugins de transiciones y diseño Inspinia/MetisMenu).
  - Ladda UI / Spinners para botones de acción.
- **Backend y Servidor Web**:
  - Servidor HTTP: **Nginx**
  - Lenguaje Backend: **PHP 7.1.33** (Cabecera `X-Powered-By: PHP/7.1.33`, PleskLin).
  - Servidores/Nodos de balanceo identificados en cabeceras HTTP y logs:
    - `node1web.p4.d2.restaurant.pe`
    - `node2web.p4.d2.restaurant.pe`
    - `node2db.p4.d2.restaurant.pe`
- **Caché y Mensajería**:
  - **Redis** activo (Cabeceras `redis: UP`, `redis_suscripcion: cacheada`, `from_redis_billing: ON`).
- **URL Base de APIs Identificadas**:
  - API interna principal: `http://caprichos.restaurant.pe/restaurant/api/rest/`
  - API de módulos REST: `http://caprichos.restaurant.pe/restaurant/m/rest/`
  - Microservicios de la plataforma: `http://microservices.restaurant.pe/backendrestaurantpe/api/rest/`
  - Gestión interna / Encuestas: `http://gestioninterna.restaurant.pe/restaurant/m/rest/`
  - Logging y telemetría: `http://restaurantlog.portafolioitdast.com/restaurant/api/rest/`
  - Integración de delivery externo: `https://api.deliverygo.app/v2/public/rest/`
  - Mapas: Google Maps JavaScript API v3.
- **Manejo de Sesión**:
  - Cookies de sesión: `PHPSESSID`, `SERVERID`.

---

## (e) Advertencias de Riesgo

1. **Privilegios Excesivos para una Cuenta de Consulta**:
   - El menú expone opciones extremadamente sensibles como `Ajustes > Usuarios`, `Ajustes > Facturación Electrónica`, `Ajustes > Cajas`, `Caja > Cierre caja Z` y `Caja > Apertura y cierre`.
   - Si las APIs no tienen control estricto de roles a nivel de token/sesión, cualquier usuario con estas credenciales podría alterar datos de facturación ante SUNAT, cerrar cajas de venta o crear/modificar otros usuarios del restaurante.
2. **Uso de HTTP no cifrado en Peticiones y Redirecciones**:
   - Al navegar a `https://caprichos.restaurant.pe/restaurant/`, el servidor emite una redirección HTTP 302 hacia `http://caprichos.restaurant.pe/restaurant/`.
   - Las llamadas a APIs internas y la transferencia de cookies de sesión se realizan sobre HTTP sin cifrar (`http://...`).
   - Esto expone la sesión a ataques de interceptación (*Man-in-the-Middle*), captura de credenciales y secuestro de sesión (*session hijacking*) en redes WiFi o locales de la cafetería.
3. **Obsolescencia Crítica de Software**:
   - **PHP 7.1.33**: Llegó al fin de su ciclo de vida (EOL) en diciembre de 2019. Contiene múltiples vulnerabilidades conocidas de ejecución de código y desbordamiento de memoria que no reciben parches de seguridad oficiales.
   - **AngularJS 1.6.10**: En estado EOL oficial desde enero de 2022.
4. **Acceso sin Clave de Caja**:
   - El formulario cuenta con un campo `usuario_clavecaja`, pero el sistema permitió el acceso y asignación a `Caja Principal` dejándolo completamente vacío, lo que debilita el doble factor de control para arqueos o transacciones de caja.
5. **Aislamiento en Producción Garantizado en esta Auditoría**:
   - En esta ejecución no se pulsó ningún botón de confirmación, guardado, edición, apertura o cierre de caja. La sesión fue cerrada de manera explícita y limpia inmediatamente después de mapear el menú.

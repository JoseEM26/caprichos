---
id: ANA-CAP-015
tipo: analisis
titulo: "Informe de Analisis Funcional: Modulo Clientes para el Rol Cajero en Caprichos POS"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, cajero-informes]
---

# Informe de Analisis Funcional: Modulo Clientes para el Rol Cajero en Caprichos POS

Este informe evalua de manera estatica y exhaustiva todas las capacidades, restricciones, vacios funcionales e inconsistencias del modulo **Clientes** (vista `clientes`) para el rol de **Cajero** en el prototipo funcional actual de la cafeteria Caprichos (Lima, Peru).

El analisis contrasta el codigo fuente del prototipo ([Admin.dc.html](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html)) y sus especificaciones asociadas ([modulos-y-roles.md](file:///tmp/claude-1000/cajero-agy/fuente/modulos-y-roles.md), [BRD.md](file:///tmp/claude-1000/cajero-agy/fuente/BRD.md), [flujo-de-pedidos.md](file:///tmp/claude-1000/cajero-agy/fuente/flujo-de-pedidos.md), [registro-mockup.md](file:///tmp/claude-1000/cajero-agy/fuente/registro-mockup.md)) contra el comportamiento documentado del sistema de referencia en produccion ([referencia/clientes.md](file:///tmp/claude-1000/cajero-agy/referencia/clientes.md)).

---

## 1 Lo que el cajero YA puede hacer en el mockup en este modulo (con evidencia: lineas o funciones)

1. **Acceso al modulo desde la barra lateral de navegacion:**
   - En la definicion de roles ([Admin.dc.html, linea 2667](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2667)), el rol `cajero` tiene asignado en su arreglo de vistas permitidas (`views`) el identificador `'clientes'`.
   - En la barra de navegacion lateral ([Admin.dc.html, linea 2807](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2807)), bajo el grupo "Clientes y ventas", se renderiza el enlace `Clientes`, permitiendo al cajero conmutar a `this.state.view = 'clientes'`.
   - Como antecedente adicional, en el escritorio del rol `callcenter` ([Admin.dc.html, linea 3020](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3020)) existe un boton directo "Buscar un cliente" que conduce a este modulo; sin embargo, en el escritorio del cajero ([Admin.dc.html, lineas 3008-3014](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3008-L3014)) solo se listan accesos directos a pedidos, reservas y creditos por vencer.

2. **Visualizacion de la lista de clientes en formato de tarjetas paginadas:**
   - La vista utiliza la plantilla generica `isTable` ([Admin.dc.html, lineas 1017 y 1089-1108](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1017)).
   - Los datos se inicializan desde el almacenamiento local del navegador mediante `cliLoad()` ([Admin.dc.html, lineas 2460 y 2753](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2460)), respaldados por la constante `CLI_SEED` ([Admin.dc.html, lineas 2441-2458](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2441)), la cual contiene 17 registros de muestra (personas naturales, empresas y trabajadores del local).
   - La funcion `cliRows()` ([Admin.dc.html, linea 2949](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2949)) mapea cada registro en 9 columnas:
     - Nombre del cliente (`c.name`).
     - Tipo (`c.tipo`: Persona, Empresa o Personal).
     - Documento de identidad enmascarado (`dniMask(c.dni)`).
     - Telefono de contacto (`c.tel` o guion largo `—`).
     - Correo electronico (`c.email` o texto `sin correo`).
     - Fecha de cumpleanos (`c.bday` o guion largo `—`).
     - Cantidad de pedidos realizados (`String(c.pedidos)`).
     - Saldo de puntos acumulados (`String(c.points)`).
     - Indicador de credito del personal (`c.cred ? 'Sí' : 'No'`).
   - La lista se presenta dividida en paginas de 6 tarjetas (`TPAGE = 6`, [Admin.dc.html, linea 2960](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2960)), con controles de paginacion funcional anterior, siguiente y botones numerados ([Admin.dc.html, lineas 1111-1117](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1111)).

3. **Busqueda de clientes por texto:**
   - Existe una barra de busqueda superior ([Admin.dc.html, lineas 1062-1064 y 3839](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1062)) enlazada a la variable `s.tq` con el texto de orientacion `tsearch: 'Buscar por nombre'` ([Admin.dc.html, linea 2686](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2686)).
   - En la logica de filtrado ([Admin.dc.html, linea 2959](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2959)), la comparacion evalua `r.join(' ').toLowerCase().indexOf(tq) >= 0`. Esto permite al cajero buscar por coincidencia en cualquier columna visible (nombre, telefono, correo o cumpleanos).
   - *Hallazgo tecnico sobre el DNI:* Al evaluar sobre `r` (donde el DNI ya fue enmascarado como `4521****`), si el cajero digita los 8 digitos del DNI del cliente, la busqueda devuelve cero resultados. Solo encuentra al cliente si el cajero digita exclusivamente los 4 primeros digitos.

4. **Filtrado de clientes por criterios definidos:**
   - Mediante el boton "Filtros" ([Admin.dc.html, lineas 1064-1085](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1064)), el cajero puede desplegar un panel con 3 filtros activos:
     - `Tipo` ([Admin.dc.html, linea 2688](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2688)): opciones `Todos`, `Persona`, `Empresa` y `Personal`.
     - `Crédito del personal` ([Admin.dc.html, linea 2688](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2688)): opciones `Todos`, `Sí` y `No`.
     - `Registro` ([Admin.dc.html, linea 2965](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2965)): opciones `Todos`, `Activos` y `Desactivados`.
   - Cada seleccion actualiza de inmediato el contador de resultados coincidentes (`tcount`, [Admin.dc.html, lineas 1087 y 2967](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1087)).

5. **Edicion de datos del cliente (mediante modal generico):**
   - Cada tarjeta cuenta con un boton "Editar" ([Admin.dc.html, linea 1103](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1103)), el cual invoca la accion definida en [Admin.dc.html, linea 2976](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2976).
   - Abre un cuadro de dialogo modal (`s.edit`, [Admin.dc.html, lineas 2852-2870](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2852)) donde se presentan los 9 campos de la tarjeta en cajas de texto libre.
   - El cajero puede modificar los valores y presionar "Guardar" (`saveEdit`, [Admin.dc.html, linea 2872](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2872)), almacenandose en el estado local `this.state.tedits['clientes|' + i]`.

6. **Desactivacion y reactivacion logica de clientes:**
   - Cada tarjeta dispone de un boton alternable "Desactivar" / "Activar" ([Admin.dc.html, lineas 1104 y 2974-2975](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1104)).
   - Al pulsarlo, el sistema solicita confirmacion ("¿Desactivar '[Nombre]'? Quedara desactivado. No se elimina y se puede activar de nuevo").
   - Al confirmar, actualiza `this.state.tinactive['clientes|' + i]`, cambia la opacidad visual de la tarjeta a 0.6 y le coloca una etiqueta de estado "Desactivado" ([Admin.dc.html, lineas 2969-2972](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2969)).

7. **Consulta y atencion de comentarios de clientes procedentes de la carta virtual:**
   - En la parte superior del modulo ([Admin.dc.html, lineas 1021-1036](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1021)), el cajero visualiza el bloque "Comentarios de los clientes".
   - Este bloque lee los mensajes depositados por comensales en el formulario "¿Como te fue en Caprichos?" de la carta web mediante `commentsRead()` ([Admin.dc.html, lineas 2171-2172 y 3560](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2171)).
   - Las tarjetas clasifican el mensaje con distintivos de color: Queja (fondo rojo tierra), Sugerencia (mostaza), Felicitacion (verde) o Comentario general (crema) ([Admin.dc.html, linea 3561](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3561)).
   - Muestra el texto del comensal, su nombre, datos de contacto, fecha y estado (`Atendido` o `Por atender`).
   - El cajero cuenta con el boton "Marcar como atendido" (`canMark: !c.atendido && s.role !== 'cocina'`, [Admin.dc.html, lineas 1032 y 3563](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1032)), el cual solicita confirmacion y actualiza el estado en `localStorage` ([Admin.dc.html, linea 3564](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3564)).

8. **Verificacion de la regla de puntos para clientes y personal:**
   - La regla transversal de fidelizacion establece que cada sol consumido genera 1 punto al cobrarse el pedido ([BRD.md, linea 89](file:///tmp/claude-1000/cajero-agy/fuente/BRD.md#L89), `NEC-CAP-057`, y [BRD.md, linea 243](file:///tmp/claude-1000/cajero-agy/fuente/BRD.md#L243), `RN-CAP-072`).
   - En el cobro de pedidos ([Admin.dc.html, lineas 2770-2773](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2770)), cuando un pedido pasa a pagado (`patch.paid && !o0.paid && o0.acct && !o0.ptsDone`), el metodo `setOrder` suma `Math.floor(total)` a los puntos del cliente identificado y suma 1 a su contador de pedidos, persistiendo los datos con `cliSave(cl)`.
   - En la lista de clientes ([Admin.dc.html, lineas 2453-2458](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2453)), los 6 miembros del personal (`Marta (cajera)`, `Luis (cocina)`, `Rosa (mozo)`, `Pedro (almacén)`, `Elena (producción)` y `Jorge (reparto)`) estan dados de alta con `tipo: 'Personal'`, su DNI y sus saldos de puntos acumulados. Cuando el cajero o mozo genera un pedido a nombre del trabajador en Pedidos y caja, los puntos se acreditan a su misma cuenta institucional.

---

## 2 Lo que hace restaurant.pe en este modulo (resumen propio, con el archivo de REFERENCIA que lo respalda)

Segun la auditoria tecnica del sistema de produccion documentada en [referencia/clientes.md](file:///tmp/claude-1000/cajero-agy/referencia/clientes.md), el modulo de Clientes opera bajo la ruta `#!/clientes` y despliega una infraestructura especializada para restaurantes y cafeterias:

1. **Separacion estricta en dos padrones (Personas vs. Empresas):**
   - El directorio se organiza en dos pestanas independientes: **Personas** (clientes naturales con DNI que reciben Boleta) y **Empresas** (personas juridicas con RUC que exigen Factura electronica) ([referencia/clientes.md, lineas 60-64](file:///tmp/claude-1000/cajero-agy/referencia/clientes.md#L60-L64)).
   - Al cambiar de pestana se limpian los filtros y se ejecuta la consulta correspondiente al tipo fiscal de cliente.

2. **Esquema de pantalla dividida (Maestro-Detalle):**
   - La pantalla mantiene visible a la izquierda el listado general con sus filtros (8 de 12 columnas), mientras que a la derecha (4 de 12 columnas) opera un panel lateral dinamico (`ui-view="side"`) ([referencia/clientes.md, lineas 47-50](file:///tmp/claude-1000/cajero-agy/referencia/clientes.md#L47-L50)).
   - Esto permite inspeccionar la ficha completa de un cliente o editarlo sin perder de vista los demas registros.

3. **Ficha de detalle e historial completo de consumos (`ver.html`):**
   - Al seleccionar un cliente, el panel lateral muestra sus datos de contacto, observaciones internas y la seccion **Ultimos consumos** ([referencia/clientes.md, lineas 119-147](file:///tmp/claude-1000/cajero-agy/referencia/clientes.md#L119-L147)).
   - Cada consumo detalla: fecha y hora exacta, sucursal, tipo y numero de comprobante emitido (serie y correlativo), condicion de venta (`Contado` o `Al credito`), propina registrada, puntos generados en la venta y monto total en soles.
   - Permite descargar reportes en Excel de las compras del cliente (consolidado general o detallado plato por plato).

4. **Formulario riguroso de alta y edicion (`editar.html`):**
   - Valida longitudes exactas segun documento: DNI de 8 digitos numericos o RUC de 11 digitos numericos ([referencia/clientes.md, lineas 157-177](file:///tmp/claude-1000/cajero-agy/referencia/clientes.md#L157-L177)).
   - Conectado a microservicios directos con padrones oficiales: `MSconsultaDNI` para autocompletar nombres desde RENIEC y `MSconsultaRuc` para consultar razon social, direccion y condicion de contribuyente (Activo y Habido) ante SUNAT ([referencia/clientes.md, lineas 350-351](file:///tmp/claude-1000/cajero-agy/referencia/clientes.md#L350-L351)).
   - Registra fecha de nacimiento para campanas de cumpleanos, telefonos secundarios y notas internas de preferencias o alergias del comensal.

5. **Multiples direcciones de despacho para Delivery:**
   - Un cliente puede registrar varias direcciones alternativas (casa, oficina, taller) con descripciones, referencias y coordenadas de geolocalizacion asociadas a tarifas de reparto ([referencia/clientes.md, lineas 178-187](file:///tmp/claude-1000/cajero-agy/referencia/clientes.md#L178-L187)).

6. **Seguridad y permisos de credito comercial (ACL):**
   - El sistema diferencia claramente lo que puede ver o cambiar un operador frente al administrador ([referencia/clientes.md, lineas 327-335](file:///tmp/claude-1000/cajero-agy/referencia/clientes.md#L327-L335)).
   - Los campos de financiamiento comercial (`cliente_limitecredito`, `cliente_maximocreditodiario`, `cliente_diascreditomax` y `cliente_diascreditoinicia`) solo pueden ser modificados por usuarios con rol Administrador o permiso explicito `clientes.lineadecreditoclientes`. Para cajeros y otros usuarios, estos campos aparecen bloqueados en solo lectura (`ng-disabled`).

7. **Submodulo de Debitos / Anticipos (`#!/clientes/debito`):**
   - Administra el monedero de saldos a favor de comensales o empresas (anticipos para catering, recargas corporativas o reembolsos) ([referencia/clientes.md, lineas 211-253](file:///tmp/claude-1000/cajero-agy/referencia/clientes.md#L211-L253)).
   - Permite auditar el saldo vivo disponible y utilizarlo en la pasarela de cobro de caja como medio de pago.

8. **Mantenimiento masivo e importacion:**
   - Asistente para carga masiva de clientes desde archivos Excel (`.xlsx`) ([referencia/clientes.md, lineas 196-208](file:///tmp/claude-1000/cajero-agy/referencia/clientes.md#L196-L208)).
   - Activacion o anulacion en bloque marcando casillas en la tabla ([referencia/clientes.md, linea 352](file:///tmp/claude-1000/cajero-agy/referencia/clientes.md#L352)).

---

## 3 Diferencias y faltantes (tabla: que falta o esta mal | donde se ve | por que importa | gravedad alta/media/baja)

| Que falta o esta mal | Donde se ve | Por que importa | Gravedad |
| :--- | :--- | :--- | :--- |
| **NO EXISTE boton para crear cliente en este modulo** | [Admin.dc.html, lineas 1017-1089](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1017). Solo existe alta dentro del modal de pedido en caja ([lineas 3778-3783](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3778)). | Si un comensal se acerca a caja a afiliarse al programa de puntos o una empresa pide registrar sus datos antes de comprar, el cajero esta bloqueado; no hay formulario de registro en la vista de clientes. | **Alta** |
| **Fallo en la busqueda de cliente por DNI completo** | [Admin.dc.html, lineas 2463, 2949 y 2959](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2463). | El texto buscado se compara contra la fila ya enmascarada (`4521****`). Si el cajero digita los 8 digitos del DNI del cliente, el sistema dice que no existe. Obliga a adivinar o escribir solo los primeros 4 digitos. | **Alta** |
| **NO EXISTE historial de pedidos ni detalle de consumos** | [Admin.dc.html, lineas 1097-1100 y 2949](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1097). | La tarjeta solo muestra una cifra plana (ej. "Pedidos: 18"). La tarjeta no se puede abrir ni consultar: no se sabe que compro, cuando vino, con que pago, que comprobante se le emitio ni cuanta propina dejo. | **Alta** |
| **Permisos de administrador expuestos al cajero (puntos, pedidos y credito)** | [Admin.dc.html, lineas 1103 y 2859-2870](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1103). | Al presionar "Editar", el cajero tiene cajas de texto abiertas donde puede adulterar a mano su propio saldo de puntos, inflar su numero de pedidos o asignarse credito escribiendo "Sí". Estos campos deben ser de solo lectura para el cajero. | **Alta** |
| **Corrupcion irreversible del DNI al editar un cliente** | [Admin.dc.html, lineas 2861-2862, 2879 y 2976](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2861). | El modal de edicion se precarga con el valor enmascarado `4521****`. Si el cajero solo queria corregir el telefono o el correo y guarda, el DNI queda guardado permanentemente con los asteriscos, destruyendo el documento real. | **Alta** |
| **Soporte de Empresas con RUC incompleto e inutilizable** | [Admin.dc.html, lineas 2445, 2447 y 2687](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2445). | Las empresas registradas ("Colegio San Martín", "Constructora Andina") tienen el DNI vacio. No existe campo RUC de 11 digitos, ni razon social, ni direccion fiscal, ni consulta a SUNAT. No se puede emitir factura a empresas. | **Alta** |
| **El Administrador tampoco puede ver el DNI completo (incumple RN-CAP-071)** | [Admin.dc.html, linea 2949](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2949). | La regla [BRD.md, linea 242](file:///tmp/claude-1000/cajero-agy/fuente/BRD.md#L242) ordena: "El DNI se muestra enmascarado en las listas y completo solo a quien administra". En el codigo actual, la funcion `dniMask` se aplica a todos los roles por igual; ni el administrador puede ver el DNI real. | **Media** |
| **Falta de persistencia real de las ediciones de tabla** | [Admin.dc.html, linea 2879](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2879). | `saveEdit` almacena los cambios en `s.tedits['clientes|' + i]` usando el indice visible `i`. No actualiza el arreglo original `s.clientes` ni `localStorage` (`cliSave`). Al recargar la pagina o filtrar, las modificaciones se pierden o se asignan a otro cliente. | **Media** |
| **Mezcla de trabajadores (personal) dentro de la lista de clientes comensales** | [Admin.dc.html, lineas 2453-2458 y 2688](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2453). | Los 6 trabajadores de la cafeteria estan mezclados en la misma tabla de comensales bajo el tipo "Personal". Aunque tienen derecho a sumar puntos en consumos propios, saturan la base comercial externa y exponen datos internos. | **Media** |
| **NO EXISTE soporte para multiples direcciones de entrega** | [Admin.dc.html, lineas 2441-2458](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2441). En referencia: [referencia/clientes.md, lineas 178-187](file:///tmp/claude-1000/cajero-agy/referencia/clientes.md#L178). | En delivery frecuente, un cliente suele pedir a su casa o a su oficina. No se pueden almacenar direcciones secundarias con referencias, obligando al operador a digitarlas cada vez. | **Media** |
| **NO EXISTE exportacion de padron de clientes a Excel o CSV** | [Admin.dc.html, lineas 1017-1089](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1017). En referencia: [referencia/clientes.md, lineas 80-93](file:///tmp/claude-1000/cajero-agy/referencia/clientes.md#L80). | En restaurant.pe se puede descargar el listado de clientes activos, clientes con mayor consumo o clientes con correo para campanas de marketing. En Caprichos no hay opcion de exportacion. | **Baja** |

---

## 4 Errores o incoherencias que veas en el mockup (botones que no hacen nada, textos viejos, reglas contradictorias con flujo-de-pedidos.md, permisos que no corresponden al cajero)

1. **Desfase de columnas en los datos estaticos de prueba (`TABLES.clientes.rows`):**
   - En [Admin.dc.html, linea 2687](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2687), la tabla declara 9 columnas: `['Cliente', 'Tipo', 'DNI', 'Teléfono', 'Correo (opcional)', 'Cumpleaños', 'Pedidos', 'Puntos', 'Crédito del personal']`.
   - Sin embargo, las filas precargadas en [Admin.dc.html, lineas 2689-2692](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2689) solo contienen 8 elementos: `['Ana Pérez', 'Persona', '999 888 777', 'ana@ejemplo.com', '14/03', '18', '180', 'No']`.
   - Omitieron el DNI, lo que hace que el telefono caiga en la columna DNI, el correo en telefono, etc. Aunque en ejecucion `cliRows()` ([linea 2950](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2950)) sobreescribe estas filas, si esta rutina fallara, los datos quedarian completamente descuadrados.

2. **Incoherencia en los puntos acumulados de Marta (cajera):**
   - En `TABLES.clientes.rows` ([Admin.dc.html, linea 2692](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2692)), Marta figura con 40 pedidos y **0 puntos** (`'40', '0', 'Sí'`).
   - En cambio, en `CLI_SEED` ([Admin.dc.html, linea 2453](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2453)), figura con 40 pedidos y **40 puntos** (`pedidos: 40, points: 40`). Esta contradiccion interna evidencia falta de consistencia en los datos semilla.

3. **Placeholder enganoso frente a la funcionalidad del buscador:**
   - La caja de busqueda ([Admin.dc.html, linea 1063](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1063)) muestra `placeholder="Buscar por nombre"`. No obstante, el codigo evalua toda la fila concatenada (`r.join(' ')`), permitiendo buscar por telefono y correo, pero fallando paradojicamente al buscar por el documento principal (DNI completo de 8 digitos) debido al enmascaramiento con asteriscos.

4. **El modal de edicion carece de selectores y validacion de tipos:**
   - Al abrir "Editar" ([Admin.dc.html, linea 2861](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2861)), todos los campos son `<input type="text">` sin validacion.
   - En el campo `Tipo`, el usuario puede escribir cualquier texto arbitrario en lugar de elegir entre Persona, Empresa o Personal.
   - En `Cumpleaños`, no hay selector de fecha ni mascara `DD/MM`.
   - En `Crédito del personal`, permite escribir cualquier palabra en lugar de un interruptor Si/No.
   - En `Pedidos` y `Puntos`, permite tipear letras sin control numerico.

5. **Contradiccion con la regla de negocio del credito (RN-CAP-058):**
   - El requerimiento [BRD.md, linea 229](file:///tmp/claude-1000/cajero-agy/fuente/BRD.md#L229) (`RN-CAP-058`) estipula con claridad: "El credito es solo para el personal; no se da credito a clientes".
   - A pesar de esto, la tabla de Clientes muestra en todos los comensales una columna y un filtro de "Credito del personal" que en el 100% de clientes regulares dice "No". Esta columna genera ruido visual y confunde al cajero. El credito debe figurar unicamente en el modulo especializado de Creditos.

6. **Atencion indiscriminada de quejas graves por el cajero:**
   - En el panel superior de comentarios ([Admin.dc.html, lineas 1021-1036](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1021)), el cajero puede presionar "Marcar como atendido" sobre una Queja.
   - De acuerdo con [BRD.md, linea 232](file:///tmp/claude-1000/cajero-agy/fuente/BRD.md#L232) (`RN-CAP-061`), las quejas del formulario deben ser notificadas al correo del dueno y atendidas con seguimiento formal. Permitir que el cajero silencie una queja con un solo clic sin dejar constancia de que accion correctiva se tomo debilita la gestion de calidad de la cafeteria.

---

## 5 Propuesta concreta de mejora para el mockup (pantallas, campos, botones, reglas), priorizada

### Prioridad 1 (Imprescindible para operar en mostrador)
1. **Incorporar el boton "+ Nuevo Cliente" en la cabecera del modulo Clientes:**
   - Disenar un modal de registro rapido con dos modalidades mediante pestanas o selector:
     - **Persona Natural:** Campo DNI (8 digitos obligatorios), Nombres y Apellidos, Celular (9 digitos), Correo electronico (opcional), Cumpleanos (opcional `DD/MM`) y casilla obligatoria: "El comensal acepta registrar sus datos para acumular puntos". Boton simulado de busqueda RENIEC para autocompletar nombres.
     - **Empresa:** Campo RUC (11 digitos obligatorios que inicien con 10 o 20), Razon Social, Direccion Fiscal, Contacto y Correo de facturacion electronica. Boton de consulta SUNAT para validar estado Activo/Habido.
2. **Corregir el buscador inteligente en tiempo real:**
   - Modificar la logica de filtrado ([Admin.dc.html, linea 2959](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2959)) para que busque sobre los datos reales del objeto cliente (`c.dni`, `c.name`, `c.tel`, `c.email`) y no sobre la representacion visual enmascarada con asteriscos. Si el cajero ingresa el DNI completo de 8 digitos, el sistema debe encontrar al cliente de inmediato.
3. **Restringir campos sensibles en el formulario de edicion segun el rol:**
   - Si el rol activo es `cajero`: los campos `Puntos`, `Pedidos`, `Tipo` y `Crédito del personal` deben ser estrictamente de solo lectura (`ro: true` o texto deshabilitado).
   - El cajero unicamente podra corregir: Telefono, Correo electronico, Fecha de cumpleanos y Direccion.
   - Solo el `admin` podra autorizar ajustes manuales de puntos (con un campo obligatorio de motivo o justificacion).
4. **Subsanar el defecto del DNI enmascarado en la edicion:**
   - El modal de edicion debe mantener el valor real del DNI en el estado interno y mostrarlo protegido o en modo solo lectura para no sobreescribir el documento con la cadena de texto `4521****`.

### Prioridad 2 (Estructura y fidelizacion)
5. **Implementar la Ficha de Detalle de Cliente con Historial de Consumos:**
   - Al tocar una tarjeta de cliente, debe abrirse un visor lateral o modal con su perfil completo y su **Historial de Consumos**: tabla con fecha, codigo de pedido, canal (Salón, Delivery, Llevar), comprobante emitido, total en soles y puntos acreditados.
6. **Cumplir la regla de visualizacion de DNI para Administrador (RN-CAP-071):**
   - En la tarjeta o ficha de detalle, incorporar un icono de ojo para que el usuario con rol `admin` pueda desenmascarar y visualizar el DNI completo de 8 digitos cuando requiera validar la identidad tributaria.
7. **Pestana exclusiva o separador para el Personal:**
   - Segregar visualmente a los trabajadores de la cafeteria en una subpestana o seccion separada ("Clientes comensales" frente a "Cuentas del personal"). Esto mantiene intacta la regla de que los colaboradores sumen puntos en sus compras sin mezclarlos con la cartera de clientes de Caprichos.

### Prioridad 3 (Extension y gestion comercial)
8. **Multiples direcciones para clientes de delivery:**
   - Permitir guardar hasta 3 direcciones por cliente (ej. Casa, Oficina, Pareja) con referencias de entrega y enlace al mapa para agilizar pedidos por WhatsApp y telefono.
9. **Exportacion de base de clientes:**
   - Boton "Descargar Excel" en la cabecera que exporte los registros filtrados (nombre, documento, contacto, fecha de cumpleanos y saldo de puntos) para labores de difusion de novedades y promociones.

---

## 6 Preguntas para el dueno (Kevin)

1. **Emision de comprobantes a Empresas con Factura:**
   - ¿Caprichos atiende habitualmente a empresas u oficinas cercanas de Lima que exigen Factura con RUC de 11 digitos, o casi la totalidad de consumos son de personas naturales con Boleta o Nota de Venta? Si se atienden empresas, ¿se requiere validar obligatoriamente que el RUC este "Activo y Habido" en SUNAT antes de cerrar la venta?
2. **Registro de clientes en frio en mostrador:**
   - ¿El cajero debe estar facultado para afiliar clientes en cualquier momento desde el modulo Clientes sin necesidad de abrir un pedido de venta, o el registro siempre debe nacer a partir de un consumo en caja o desde la carta virtual?
3. **Ajustes manuales y reclamos por puntos:**
   - Si un comensal habitual reclama que olvido dar su DNI en una compra pasada o que no se le cargaron sus puntos correspondientes, ¿el cajero podra abonarle puntos directamente desde su pantalla, o esa correccion exige la autorizacion exclusiva de la administracion?
4. **Flujo de atencion de Quejas recibidas desde la carta:**
   - Cuando un comensal envia una queja a traves de "¿Como te fue en Caprichos?", ¿el cajero tiene permiso para marcarla como atendida tras conversar con el cliente en tienda, o la resolucion de quejas debe quedar reservada unicamente a la administracion y a su correo electronico?
5. **Tratamiento de saldos a favor (Debitos/Anticipos):**
   - En el sistema anterior restaurant.pe existia el modulo de Debitos para gestionar saldos a favor por adelantos o notas de credito. ¿Caprichos maneja actualmente pagos anticipados (por ejemplo, para reservas de cumpleanos o pedidos grandes de pasteleria) que deban quedar como saldo a favor del cliente en caja?
6. **Campana de cumpleanos:**
   - Dado que el sistema registra el cumpleanos del comensal, ¿se otorgara un beneficio automatico (como el cupon CUMPLE25, un cafe de cortesia o postre gratis) durante la semana de su cumpleanos al identificarse con su DNI en caja?

---

## 7 NO VERIFICADO

1. **NO VERIFICADO:** No se ha comprobado la existencia de un contrato o credenciales activas con un proveedor de servicios electronicos (PSE) o API publica para la consulta automatizada de datos de RENIEC (DNI) o SUNAT (RUC). En el codigo del prototipo solo existen validaciones y estructuras locales sin llamadas asincronas activas hacia servicios tributarios gubernamentales.
2. **NO VERIFICADO:** No se ha verificado el comportamiento del almacenamiento del navegador (`localStorage`) bajo una carga real de miles de clientes acumulados en operacion continua. El prototipo almacena los clientes en texto JSON en el navegador del equipo local, el cual cuenta con un limite fisico aproximado de 5 MB, por lo que el paso a produccion requerira una base de datos persistente en servidor.
3. **NO VERIFICADO:** No se ha podido verificar si el correo electronico registrado en la ficha del cliente interactua con algun servidor SMTP real para el despacho automatico de comprobantes de pago electronicos (XML/PDF) o mensajes de bienvenida.
4. **NO VERIFICADO:** No se ha comprobado si el cliente puede recuperar de forma autonoma su contrasena si la olvida en la carta web, ya que el prototipo actual carece de pasarela transaccional de envio de SMS o correos de restablecimiento de clave.

---
INFORME LISTO.

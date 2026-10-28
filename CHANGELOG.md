# Registro de cambios (CHANGELOG)

Todos los cambios notables del proyecto Caprichos se documentan en este archivo. El contenido se organiza en orden cronologico inverso, agrupado por fecha y clasificado por temas operativos y tecnicos a partir de la historia de confirmaciones (`git log`) de la rama `ola-1`.

---

## 2026-10-28

### El mozo envía el cobro de mesa a Caja (no lo cobra)
- **Flujo**: el mozo elige el medio en la mesa (Efectivo, Yape, Plin o Transferencia), toma la foto del voucher (se lee al instante) y pulsa Enviar a Caja con Sí/No. Caja revisa el voucher con su semáforo y es quien cobra y confirma. El mozo no marca el pedido como pagado.
- **Mozo**: en el plano, al tocar una mesa ocupada con pedido aparece "Cobrar mesa (enviar a Caja)" (`PlanoView`), que abre la cuenta de la mesa (`ModalPrecuenta`). Se quitó la tarjeta muerta de precuenta que tenía `PlanoView` (nadie la abría). Solo ve si la foto se lee o no, sin montos ni semáforo. Se quitó del flujo del mozo "Cobrar sin comprobante" y el botón de cobro. El soporte de la excepción en el servidor (`cobros.service.ts`) se mantiene.
- **Servidor**: `POST /admin/vouchers/enviar-a-caja` (permiso `vouchers/subir`, ya lo tiene el mozo). Crea una notificación para CAJERO: `PAGO_EFECTIVO_MOZO` en efectivo, `VOUCHER_PENDIENTE_MOZO` en digital (con voucher legible o sin foto legible). El enlace abre `/admin/caja?pedido=<id>`. Audita `ENVIADO_CAJA`. Responde solo `{ ok }`. Pedido ya pagado: 409. Medio no válido: 400.
- **Caja**: al abrir Registrar cobro de un pedido que ya tiene foto (del mozo, del cliente o de la carta), la foto (ampliable con `FotoAmpliable`) y su semáforo aparecen solos; se cobra con esa foto sin subir otra (`voucherId`). Botón Subir otra foto para reemplazarla. La sección Comprobantes del pedido también usa la foto ampliable.
- **Campana**: las notificaciones de Caja del historial navegan a su enlace; `/admin/caja?pedido=` selecciona ese pedido en su pestaña.
- **Pruebas**: Jest en `vouchers.service.spec.ts` (efectivo, digital legible, digital sin foto legible, pagado, medio inválido). Vitest en `ModalPrecuentaVouchers.spec.tsx` (reescrito: efectivo, Yape legible, Yape ilegible, No, error de API, sin pedido), `PlanoCuentaMozo.spec.tsx` (nuevo: botón de la mesa ocupada, envía con Sí/No, mesa libre sin botón) y `ModalCobrarComprobante.spec.tsx` (cobro con la foto ya subida por el mozo, y solo ilegible).
- **Permisos**: ninguno nuevo para el mozo.
- **Manuales**: `plano.md` (cobrar en mesa = enviar a Caja) y `caja.md` (foto ya subida, notificación del mozo).

### Cobro sin comprobante también para el mozo (excepción con código del supervisor)
- **Regla**: el mozo que cobra un pago digital (Yape o Plin) sin foto legible puede usar la excepción: motivo (mínimo 5 letras) y código de 6 dígitos que le dicta el supervisor presente. Misma regla `exigirComprobanteDigital` y misma auditoría `COBRAR_SIN_VOUCHER` con su usuario; un código inválido no cobra. No se le dieron permisos nuevos (ya tenía `mesas/abrir`, que habilita el cobro).

### Comprobante útil en todo pago digital: ILEGIBLE no cuenta, coordinado con foto y voucher obligatorio para todos
- **Causa**: un voucher que la IA marcaba ILEGIBLE todavía valía como comprobante al cobrar y al confirmar el pago; el pago coordinado (`POST /admin/caja/pedidos/:id/coordinado`) se marcaba sin foto; y el parámetro `voucher_mozo_obligatorio` dejaba al mozo sin exigencia si estaba en `false`.
- **Regla**: todo pago digital (Yape, Plin, transferencia) necesita una foto útil enlazada al pedido. Un voucher `ILEGIBLE` no cuenta. Sin foto útil, Caja y Administrador pueden seguir con motivo y código del supervisor (auditado). El mozo no tiene excepción: debe subir otra foto o avisar a Caja.
- **Servidor**: regla única en `apps/api/src/modulos/caja/comprobante-pago.util.ts` (`exigirComprobanteDigital`, `hayVoucherUtil`), usada por el cobro (`cobros.service.ts`), el registro de pago (`pedidos-estado.service.ts`) y el coordinado. El coordinado acepta `sinVoucher` en el cuerpo y audita `MARCAR_COORDINADO_SIN_VOUCHER` con el motivo.
- **Respuesta de voucher**: `legible` sale del semáforo (`legible = semáforo distinto de ILEGIBLE`), para que el front nunca tome por válida una foto que el cobro rechaza.
- **Parámetro `voucher_mozo_obligatorio`: obsoleto.** Ya no tiene efecto en el servidor ni en el front, y se quitó su control de Configuración. Nada se eliminó de la base de datos (no hace falta migración). Sigue en la tabla `parametro` sin uso.
- **Front**: `ModalCobrar` (Caja, cierre) y `ModalConfirmarPago` no cuentan una foto ILEGIBLE; `SubirVoucherMozo` muestra «No se lee: sube otra foto o confirma sin comprobante con código del supervisor» (con `ofrecerExcepcion`, solo Caja); `TarjetaLecturaVoucher` muestra el mismo aviso; `ModalPrecuenta` del mozo ya no marca válida una foto ilegible.
- **Pago coordinado en Caja**: «Marcar coordinado» abre `ModalCoordinarPago` con la foto del comprobante o la excepción con supervisor (solo medios digitales), y pide Sí/No antes de marcar. La lista de por coordinar devuelve `pago_preferido`.
- **Manuales**: `caja.md` (flujo de foto, excepción y pago coordinado; ILEGIBLE). `docs/operacion/RB-CAP-009` (parámetro obsoleto, ILEGIBLE y flujo del mozo).
- **Pruebas**: Jest en `cobros.service.spec.ts` (ILEGIBLE falla y con excepción ok y auditado; coordinado digital sin voucher falla, con voucher ok, con excepción ok y auditado, efectivo ok, PIN incorrecto), `cobros-mozo-voucher.spec.ts` (mozo siempre exigido, sin excepción propia, el parámetro no se lee) y `caja.controller.spec.ts`. Vitest en `ModalCobrarComprobante.spec.tsx`, `ModalCoordinarPago.spec.tsx` (nuevo), `TarjetaLecturaVoucher.spec.tsx` y `vouchersApi.spec.ts`.

## 2026-10-27

### Aviso de WhatsApp al crear un pedido desde la carta virtual (recibido)
- **Causa**: quien pedía desde la carta con celular no recibía ningún mensaje al crear el pedido; el aviso solo existía a partir de la cocina o de reparto.
- **Qué recibe el cliente**: al crear el pedido desde la carta virtual con celular llega un WhatsApp de confirmación. Con Yape, Plin o transferencia avisa que un asesor gestionará el voucher por ese chat. Con efectivo u otro medio no digital dice que el pedido ya está en proceso. Sin celular válido no se envía nada.
- **Caja y Mensajes**: con pago digital, la conversación pasa a una persona (VALIDAR_PAGO, urgente), igual que cuando llega un voucher, y aparece en Mensajes para atenderla. Con efectivo no se toca la conversación.
- **Parámetro nuevo**: `whatsapp_aviso_recibido_activo` (Sí/No, por defecto `si`), en Configuración, pestaña Operación.
- **Técnica**: reutiliza `AvisosPedidoService` (etapa `RECIBIDO`, número 9 en `mensaje_reparto`, idempotente, cualquier modalidad). La conversación se marca con `marcarPagoParaPersona`, la misma función que usa el voucher de WhatsApp. El aviso se dispara después de crear el pedido, fuera de la transacción, sin esperar ni propagar errores. Migración `20261031140000_aviso_recibido_carta` (amplía el CHECK de `mensaje_reparto` a 1-9 y siembra el parámetro).
- **Plantillas Meta**: `caprichos_pedido_recibido_digital` y `caprichos_pedido_recibido_efectivo`, pendientes de enviar a Meta (ver `docs/operacion/PLANTILLAS-WHATSAPP.md`, secciones 16 y 17). Mientras no estén aprobadas, el aviso falla con la ventana cerrada y Caja recibe la notificación de plantilla no enviada.
- **Pruebas**: Jest en `avisos-pedido.service.spec.ts` (digital por medio, efectivo, sin teléfono, parámetro apagado, idempotencia, fallo del envío sin propagar) y `pedidos.service.spec.ts` (disparo desde la creación de pedido de carta; no para mozo ni chatbot; error no frena el pedido).
- **Manual**: una línea nueva en `mensajes.md`. Grafo de ayuda regenerado.

### Comprobante de pago digital: foto obligatoria en todo cobro Yape, Plin o transferencia (vch-all)
- **Causa**: Caja no pedía la foto del voucher al cobrar; la exigencia solo existía para el MOZO en el servidor, sin permiso de cobro para ese rol. En la precuenta del salón, la foto subía con el nombre de la mesa en lugar del pedido y el botón «Confirmar cobro» marcaba «Cobro registrado» sin llamar al servidor. En WhatsApp, la fila del voucher solo se creaba si el cliente tenía pedido con teléfono: una imagen sin pedido o de cliente con BSUID se guardaba como archivo del chat sin análisis. Si la IA rechazaba la llamada por límite de lecturas, la fila no se guardaba.
- **Caja (`ModalCobrar`, `POST /admin/caja/cobrar`)**: todo cobro con Yape, Plin o Transferencia exige la foto (cámara o archivo, reducida a 1600 px en el navegador, componente `SubirVoucherMozo`). Muestra la lectura (semáforo, motivos, datos extraídos y comparación con el total). Sin foto, el botón Registrar cobro queda deshabilitado. La excepción «No hay foto: registrar sin voucher» exige motivo de al menos 5 caracteres y el código rotativo de 6 dígitos del supervisor (`caja/cobrar_sin_voucher`); queda auditada como `COBRAR_SIN_VOUCHER` con motivo y supervisor. El servidor aplica la misma regla, así que un cliente que se salte la pantalla recibe `VOUCHER_REQUERIDO`.
- **La IA solo informa**: el semáforo ya no bloquea el cobro. Se elimina el bloqueo `VOUCHER_NO_LEGIBLE` del mozo. Tampoco bloquea la aprobación desde Mensajes.
- **Foto enlazada como prueba**: el cobro acepta `voucherId` y enlaza la foto al pedido (`voucher_pago.pedido_id`). Aprobar un pago en Mensajes enlaza la foto del chat al pedido.
- **Mozo (salón, precuenta)**: la foto sube con el `pedidoId` correcto. El botón de cobro solo aparece si la vista entrega `alCobrar` (hoy ninguna lo hace: el cajero cobra). Sin foto, el mozo puede avisar a Caja (`POST /admin/vouchers/aviso-sin-foto`, notificación `VOUCHER_PENDIENTE_MOZO`). El mozo no tiene excepción propia.
- **Carta web**: en la pantalla de confirmación y seguimiento, los pedidos con Yape, Plin o transferencia permiten adjuntar la captura (`POST /carta/seguimiento/:codigo/comprobante?t=`, con el token del seguimiento, máximo 5 MB, solo imágenes). La captura es opcional al crear el pedido y queda por validar hasta que llega. La respuesta no muestra semáforo.
- **WhatsApp**: toda imagen se guarda y se analiza, con pedido o sin él, con BSUID o chat en manos de una persona. Si la IA no lee la imagen, queda `SIN_LECTURA`. Si Meta no entrega los bytes (falla o más de 5 MB), Caja recibe la notificación `COMPROBANTE_NO_GUARDADO`.
- **Límite de lecturas**: al superar 10 lecturas por minuto la IA ya no lanza error; el voucher se guarda como `SIN_LECTURA`.
- **Visibilidad**: sección «Comprobantes del pedido» en el detalle del pedido (Caja y Pedidos), con foto y lectura. El cierre de caja y Mensajes ya listaban los vouchers; siguen igual.
- **Pendiente de decisión**: Tarjeta (POS) no exige foto; el comprobante de operación del POS queda para una decisión posterior.
- **Pruebas**: Jest en `cobros.service.spec.ts` (regla de comprobante, excepción con PIN, voucherId, mozo), `vouchers.service.spec.ts` (todo voucher se guarda, carta, pedido inexistente, aviso del mozo), `whatsapp-voucher.spec.ts` (webhook real con Meta y OpenAI simulados: con pedido, sin pedido, BSUID, IA caída, chat con persona y descarga fallida) y `mensajes.service.spec.ts`. Vitest en `ModalCobrarComprobante.spec.tsx`, `ModalPrecuentaVouchers.spec.tsx`, `SeccionVouchersPedido.spec.tsx` y `AdjuntarCapturaPago.spec.tsx`.
- **Manuales**: `caja.md` (nueva tarea «Adjuntar la foto del comprobante al cobrar») y `mensajes.md` (aprobación y avisos). Grafo de ayuda regenerado.

### Imágenes de marca en la pantalla de ingreso y en la carta (img-all)
- **Pantalla de ingreso dividida (`/admin/ingresar`)**: en PC (900 px o más) el formulario va a la izquierda y una imagen grande a todo el alto a la derecha, con frase editable sobre la imagen. En celular, la imagen es una franja superior y el formulario va debajo en una tarjeta. La imagen por defecto es `fantasma-cafe.webp`. Con varias imágenes rotan cada 6 segundos; si el dispositivo pide movimiento reducido, no rotan. Si la consulta falla, se muestran la imagen y la frase por defecto. La lógica de ingreso no cambió.
- **Configuración del local, pestaña "Pantalla de ingreso"**: permite elegir hasta 5 imágenes de fábrica o propias, ordenarlas, quitarlas (sin borrar el archivo) y editar la frase (hasta 80 caracteres). Las fotos propias se reducen en el navegador antes de subirlas. Solo se ve y edita con el permiso `configuracion/editar` (ADMIN) y se guarda con confirmación Sí/No.
- **API**: `GET /carta/ingreso` (público, sin autenticación, caché de 60 segundos) devuelve `{ imagenes, frase }` ya resueltos. `GET` y `PUT /admin/pantalla-ingreso` requieren `configuracion/editar`. Los parámetros son `login_imagenes` y `login_frase`. La validación es estricta: solo nombres de la lista de fábrica o rutas de archivos públicos existentes, sin URLs externas ni rutas con `..`, sin imágenes repetidas, máximo 5 imágenes y frase de hasta 80 caracteres sin `<` ni `>`. Cada cambio queda en auditoría.
- **Mosaico "Momentos Caprichos" (`MosaicoMomentos`)**: mosaico sin huecos con esquinas redondeadas, relaciones de aspecto variadas, 2 columnas en celular y 4 en PC, carga diferida salvo la primera fila. Muestra primero las fotos reales (Diseñador y Novedades) y completa con las 5 fotos de marca repetidas, en orden alternado para que no se vean dos iguales juntas. Se usa en Conócenos (collage en el encabezado y galería "Momentos Caprichos"), en Novedades (al final de la página) y en las vistas previas del admin, que reutilizan los mismos componentes.
- **Pruebas**: Jest para el módulo `pantalla-ingreso` (utilidades, servicio, controladores y validación del cuerpo) y Vitest para la pantalla de ingreso dividida, la tarjeta de configuración, la visibilidad por permiso y el mosaico.
- **Manual de ayuda**: nueva tarea "Cambiar las imágenes de la pantalla de ingreso" en `mirest.md`, con sección de errores y dudas comunes, y grafo de ayuda regenerado.

### Módulo de Repartos: Aislamiento estricto por repartidor y vista mobile-first (rep-all)
- **Aislamiento de datos en el servidor para el rol REPARTIDOR**: Reglas de autorización y visibilidad estricta en `repartos.service.ts` (`listarTodos`, `listarMios`, `consultarMensajes`, `reportarFalla`, `obtenerResumen`) y `pedidos-estado.service.ts` (`listar`, `obtenerPorId`, `cambiarEstado`, `registrarPago`). Un repartidor únicamente ve y ejecuta acciones sobre pedidos asignados a su propio `partyId`. Intentos de consultar o intervenir pedidos ajenos devuelven código HTTP 403 con código de error `NO_ASIGNADO` o 404. Administradores y cajeros conservan visibilidad y control total sin alteraciones.
- **Protección de datos personales (teléfono de clientes)**: En el listado de pedidos disponibles para tomar (`listarDisponibles`), el teléfono del cliente permanece enmascarado (`null`) para repartidores. El número telefónico solo se revela una vez que el pedido ha sido tomado formalmente por el motorizado.
- **Tope de pedidos por repartidor elevado a 5**: Actualización del parámetro por defecto `rep_max_pedidos` de 3 a 5 tanto en el código del servidor (`repartos.service.ts`, `ruta.service.ts`), frontend (`calculoRuta.ts`) y en la semilla de base de datos (`seed-demo.ts`, `seed-usuarios-demo.ts`).
- **Interfaz de Repartidor Mobile-First (`RepartidorView.tsx`)**: Nueva interfaz para celulares orientada a motorizados (botones táctiles ≥ 48 px, paleta corporativa `#0B2C3E`, `#FBF4EC`, `#E67929`, `#D99E39`, `#B2500F`, `#2F7A45`, tipografía Montserrat, cero emojis y confirmaciones modulares Sí/No con el componente `Confirmar`). Incluye tres pestañas ergonómicas:
  - *Mi ruta*: pedidos tomados en orden secuencial de entrega con botones de acción por etapa (*Salir a reparto*, *Llegué a destino*, *Entregar pedido*, *Reportar problema*), enlaces a llamadas, WhatsApp y navegación satelital (Google Maps, Waze).
  - *Para elegir*: pedidos listos sin asignar agrupados en ruta sugerida de hasta 5 paradas; selección parcial de 1..N pedidos con recálculo dinámico en tiempo real de paradas óptimas, kilómetros estimados y minutos de viaje; toma atómica con bloqueo pesimista y aviso claro por pedido ganado por otro motorizado.
  - *Hechos hoy*: entregas culminadas en el turno y tarjeta de liquidación que totaliza el dinero cobrado en efectivo para rendición de cuentas en caja.
- **Semilla demo con 3 repartidores independientes**: Adición de `sembrarRepartidoresDemo()` en `apps/api/prisma/seed-demo.ts` garantizando tres usuarios motorizados listos para pruebas operativas: *Repartidor 1* (DNI 10000006), *Repartidor 2* (DNI 10000007) y *Repartidor 3* (DNI 10000008), con clave demo `123456` sin modificar contraseñas de cuentas preexistentes.
- **Saneamiento de deuda previa en `listarMios`**: Inclusión del desglose de productos (`cantidad_productos`), sincronización de paradas y coordenadas de ruta, y exposición autorizada de datos de contacto solo al conductor asignado.
- **Cobertura de pruebas**: 71 pruebas Jest en el backend (`repartos-aislamiento.spec.ts`, `repartos.service.spec.ts`, `repartos.controller.spec.ts`, `pedidos-admin`) y 566 pruebas Vitest en el frontend (`RepartidorView.spec.tsx`, `repartos.spec.tsx`, etc.) verificadas y aprobadas.

### Chatbot de WhatsApp: Cierre comercial determinista y promociones
- **Cierre comercial determinista en respuestas y carta**: Incorporación de utilidades (`cierre-comercial.util.ts`) para anexar automáticamente por código (nunca la IA) una frase cálida y sobria animando a la compra (`¿Te animas a pedirlo?`, `¿Te gustaría pedirlo ahora?`, `¿Te provoca probarlo hoy?`) y botones interactivos de WhatsApp tras consultas de productos o fichas del catálogo (`CARTA_PRODUCTO_DETALLE`).
- **Botones interactivos optimizados (límite WhatsApp)**: Cumplimiento riguroso de restricciones de Meta WhatsApp Cloud API (máximo 3 botones por mensaje, títulos ≤ 20 caracteres): `[Pedir este producto]` (`ped_prod_${id}`, 19 caracteres) que redirige directamente a la configuración del producto en el flujo de pedido sin reiniciar la modalidad; `[Ver la promo]` (`btn_promo_${id}`, 12 caracteres); `[Volver al menú]` (15 caracteres); `[Hablar con persona]` (18 caracteres) y `[Hacer un pedido]` / `[Ver la carta]` para recomendaciones múltiples.
- **Sugerencia de promociones calculadas por código**: Detección y cálculo determinista de promociones vigentes aplicables (combos, lleva-y-paga 2x1, descuentos porcentuales y cupones) con ahorro exacto formateado en soles (`S/ XX.XX`) mediante funciones matemáticas de centavos (`redondearMonto`), evitando alucinaciones del modelo LLM.
- **Auditoría y corrección anti-alucinación de precios**: Validación automática de menciones de precios en respuestas de IA contra las fichas oficiales del catálogo; reemplazo determinista inmediato por la ficha oficial si el LLM menciona precios inventados o divergentes.
- **Aislamiento en prompt de sistema**: Restricción en el prompt del sistema (`PROMPT_SISTEMA_CAPRI`) prohibiendo expresamente al modelo LLM generar instrucciones de compra por botones o cierres comerciales pasivos.

### Chatbot de WhatsApp y Modo Asistido
- **Modo Asistido en ATENCION_PERSONA**: Mecanismo de contingencia operativa para evitar desatención de clientes cuando una conversación se encuentra transferida a atención humana (`ATENCION_PERSONA`). Si transcurren más de `asistido_espera_min` (por defecto 3 minutos) sin intervención humana (`SALE`, `PERSONA`), o si el cliente presiona botones/acciones inmediatas (menú, carta, pedir nuevo pedido, estado de pedido, horarios), el bot reanuda respuestas dentro de un alcance seguro y acotado.
- **Protección de propiedad y urgencia**: Al activarse el modo asistido, la conversación preserva estrictamente `duenio: 'PERSONA'` y la marca `urgente: true`, asegurando que el chat permanezca visible en la cola de atención de Caja y no sea liberado indebidamente.
- **Gestión segura de cancelaciones y cambios**: El bot nunca cancela ni modifica pedidos autónomamente. En su lugar, canaliza la solicitud creando un registro formal de `solicitudCambio` para Caja con el mensaje: *"Registre tu solicitud de cancelacion; una persona de Caja la confirma."* (advirtiendo al cliente si el pedido ya está en preparación o despacho) y emitiendo una alerta en la campana de notificaciones.
- **Consultas libres con IA o frase fija rate-limited**: Soporte para resolver dudas mediante el módulo de IA (`ia/`) si `chatbot_ia_activo` está habilitado. Si la IA está apagada, responde con la frase fija *"Ya avise a una persona; mientras tanto puedo ayudarte con esto:"* y botones interactivos (≤ 20 caracteres), con límite de frecuencia estricto (máximo una vez cada 3 minutos por conversación vía Redis).
- **Parámetro configurable y panel web**: Incorporación del parámetro `asistido_espera_min` en la base de datos (migración y seeds), expuesto para edición por administradores en `TarjetaUmbralesAlertasEspera.tsx` con validación estricta (> 0 minutos) y diálogo de confirmación.

### Despliegue e infraestructura
- **Limpieza automática de imágenes antiguas de Docker (sc-infra3)**: Incorporación de saneamiento automático de almacenamiento tras despliegues exitosos en `desplegar.sh` y `actualizar.sh`. Elimina versiones obsoletas de `caprichos-api` y `caprichos-web` y capas huérfanas (`docker image prune -f`) protegiendo estrictamente contenedores activos, versión activa (`TAG`), versión de retroceso (`TAG_PREVIA`) y las 5 etiquetas más recientes por repositorio (`IMAGENES_CONSERVAR=5`). Incluye modo simulación (`LIMPIEZA_SIMULACRO=1`) y garantiza total aislamiento respecto a bases de datos (`postgres`), caché (`redis`), balanceadores (`traefik`) y aplicaciones externas.
- **Llamada directa a script de relevo continuo**: Se corrigio la ejecucion del comando de despliegue para invocar directamente el script vendorizado `infra/compose/scripts/docker-rollout` tanto en la publicacion como en la vuelta atras. Esto previene el falso positivo que devolvia la verificacion del comando del sistema cuando el plugin no estaba instalado globalmente (`c628b02`).
- **Despliegue sin corte (Rolling Rollout)**: Implementacion de relevo sin interrupcion de servicio para los contenedores `caprichos-api` y `caprichos-web`. El nuevo contenedor arranca en paralelo, valida su estado en `/api/salud`, y Traefik conmuta el trafico de manera transparente (`c856104`).
- **Apagado ordenado del servidor**: Configuracion de ganchos de apagado (`enableShutdownHooks`) en NestJS y periodo de gracia de 30 segundos (`stop_grace_period: 30s`) en Docker Compose para permitir que las conexiones y transacciones en curso culminen limpiamente (`c856104`).
- **Cola BullMQ para webhooks de WhatsApp**: Procesamiento asincrono de notificaciones de Meta mediante BullMQ sobre Redis. Incluye generacion de identificador de tarea por resumen sha256 para evitar duplicidad, concurrencia fija de 5 procesos, hasta 5 reintentos con retraso exponencial y respaldo de ejecucion en linea ante indisponibilidad de Redis (`c856104`).
- **Coordinacion en Redis para tareas y tiempo real**: Inclusion de candado distribuido (`candado.util.ts`) para tareas programadas y adaptador de Socket.IO con Redis (`redis-io.adapter.ts`) para soportar escalamiento horizontal en multiples instancias (`c856104`).
- **Resiliencia en el cliente web**: Incorporacion de reintentos automaticos ante respuestas 502, 503, 504 o fallas momentaneas de conexion en peticiones de lectura y en operaciones de escritura protegidas con la cabecera `Idempotency-Key` (`59e4d05`).
- **Socket.IO exclusivamente sobre WebSocket**: Configuracion del cliente y servidor en tiempo real para operar solo con el protocolo WebSocket, evitando la dependencia de sesiones fijas (sticky sessions) entre multiples servidores (`59e4d05`).

### Lectura de vouchers con IA
- **Analisis inteligente de comprobantes Yape y Plin**: Integracion de vision artificial con OpenAI para la lectura automatica de capturas de pago. La IA extrae monto, numero de operacion, billetera detectada, titular y fecha, asignando un semaforo de confianza: Confiable, Observado, Raro, Ilegible o Sin lectura (`d51d50b`).
- **Politica de decision humana obligatoria**: La inteligencia artificial actua unicamente como auxiliar de lectura; nunca aprueba ni rechaza transacciones de forma autonoma. La aprobacion final recae siempre en una persona de Caja o Call Center (`d51d50b`).
- **Captura obligatoria de foto en sala**: Implementacion del flujo de cobro para mozos en mesa mediante `ModalPrecuenta` y `SubirVoucherMozo`. La aplicacion reduce la foto en el navegador (maximo 1600 px en formato JPEG al 85 %) y el mozo solo recibe confirmacion de legibilidad ("legible" o "no legible") sin acceso a semaforos internos de riesgo (`d51d50b`).
- **Auditoria de vouchers en cierre de caja**: Incorporacion del componente `SeccionVouchersCierre` en el modulo de Caja y cierres para auditar todos los comprobantes digitales recibidos en el dia, con visualizador en alta resolucion y marcado individual de revisado (`d51d50b`).
- **Parametros y consumo de IA**: Parametros configurables en el local (`voucher_ia_activo`, `voucher_titular_nombre`, `voucher_yape_numero`, `voucher_plin_numero`, `voucher_mozo_obligatorio`) sin tope de gasto, con registro discriminado de tokens y costos en `ia_consumo` bajo el origen `VOUCHER` (`d51d50b`).
- **Registro persistente y permisos**: Creacion de la tabla `voucher_pago` y asignacion de permisos `vouchers/subir` (Mozo, Cajero, Administrador) y `vouchers/ver` (Cajero, Administrador) mediante migracion de esquema (`d51d50b`).

### Asistente Capri
- **Ajustes de la version 2D**: Correccion de lineas de expresion en la version vectorial de respaldo, elevacion del flequillo y afinamiento de pestanas (`8a8c1bd`).
- **Minimizacion y expansion ergonomica**: Boton circular compacto en la esquina para ocultar a la mascota sin tapar los controles de envio o pulido de mensajes, con opcion de restaurar el tamano completo al pulsar el control de expansion (`8a8c1bd`).

---

## 2026-10-26

### Mensajeria y WhatsApp
- **Compatibilidad con prefijo telefonico 51**: Los controles de aprobacion y rechazo de pagos permanecen habilitados aunque el numero de chat cuente con prefijo de pais (`519...`) y el pedido no lo contenga (`14b306a`).
- **Prioridad de vinculacion**: El pedido asociado al comprobante de pago recibe prioridad en la visualizacion y gestion de la conversacion (`14b306a`).
- **Traspaso automatico a atencion humana**: Ante la recepcion de una captura de voucher en el chat, el chatbot transfiere de inmediato la conversacion a la cola de atencion humana en Caja (`14b306a`).
- **Visualizacion de archivos privados en chat**: La foto del voucher se despliega dentro de la conversacion mediante peticion autenticada de archivo privado con el token de sesion de la operadora (`4a29812`).
- **Persistencia de medios entrantes**: Toda fotografia entrante por la API de WhatsApp queda registrada y asociada formalmente al historial del mensaje (`4a29812`).
- **Reconexion en tiempo real**: El canal de Socket.IO renueva su suscripcion con el token activo tras caidas o despliegues del servidor, complementado con un refresco de lista cada 20 segundos (`7541cb8`).

### Chatbot de pedidos y reservas
- **Identificacion por envase en bebidas**: Solicitud de nombre de cliente por cada vaso en categorias de bebidas (Frappes, Iced, Frozen y Calientes) con dialogo de confirmacion Si/No (`744fc51`).
- **Ofrecimiento de numero de contacto**: El flujo de pedido ofrece la opcion rapida "Usar este numero" a partir del telefono de WhatsApp del remitente (`744fc51`).
- **Comprobantes legales simplificados**: Restriccion de opciones de comprobante exclusivamente a Boleta o Factura (`744fc51`).
- **Proteccion de comanda en cocina**: Los pedidos registrados con pago digital (Yape o Plin) no aparecen en las pantallas de Cocina hasta que su voucher es aprobado formalmente en Caja o Mensajes (`744fc51`).
- **Remocion de tope de unidades**: Se retiro el limite artificial de 20 unidades por producto en el chatbot, admitiendo pedidos de cualquier volumen hasta el limite operativo de 9999 unidades (`22af0b5`).
- **Notificaciones de reservas en la campana**: Las reservas pendientes de confirmacion ingresadas por WhatsApp se reflejan como alertas prioritarias en la campanita y en el contador del menu Reservas (`748707b`).
- **Filtro de franjas horarias por fecha**: Correccion en la consulta de disponibilidad de mesas para evaluar las franjas de la fecha indicada por el cliente en el mensaje, evitando falsos rechazos por consultar la fecha de hoy (`4976350`).
- **Precision en derivacion de mensajes**: Optimizacion de patrones en notas, nombres y fechas para que palabras de cortesia o solicitud de atencion no transfieran equivocadamente el chat a una persona (`0a75271`).

### Asistente de ayuda Capri y documentacion
- **Motor de ayuda del panel administrativo**: Construccion del cargador de 34 manuales Markdown normalizados en `apps/api/src/modulos/ayuda-admin` y grafo de conocimiento derivado en memoria con enlaces bidireccionales (`eda7053`).
- **Busqueda contextual con IA opcional**: Recuperacion lexica de manuales con sinonimos y vecino a 1 salto jerarquico segun el rol del usuario; generacion de respuestas directas con OpenAI respaldada por modo de contingencia sin IA (`eda7053`).
- **Privacidad y control presupuestal**: Filtro de sanitizacion para rechazar consultas con datos personales (DNI, telefonos, tarjetas), limites de uso por cuenta y registro detallado en `ia_consumo` (`eda7053`).
- **Interfaz web de Capri**: Boton flotante con globo de dialogo, panel lateral en escritorio y hoja inferior en moviles, sugerencias rapidas y enlaces directos a las pantallas del sistema (`f4a75cc`).
- **Sintesis y precision en respuestas**: Optimizacion del prompt a un maximo de 400 caracteres para entregar exclusivamente el proposito del modulo o los pasos numerados de la tarea solicitada (`0e66cac`).
- **Nueva tarea de indicadores de escritorio**: Incorporacion de la tarea de interpretacion de metricas en el manual del Escritorio (`0e66cac`).
- **Ampliacion visual del panel**: Incremento de tamano de cabecera y ancho de lectura del panel de ayuda para mayor comodidad de lectura (`9dfa945`).

### Mascota Capri y modelado
- **Redefinicion del personaje**: Capri se presenta como una chef mujer de estilo figurita de vinilo, con cabello castano, flequillo, colitas con lazos, mejillas sonrosadas y uniforme naranja y negro con vivos dorados (`1f7fd57`, `bd21d80`, `2357242`).
- **Implementacion tecnica 3D y 2D**: Modelo procedural generado en Three.js con carga bajo demanda (lazy loading) para no retrasar la carga del panel, junto con una version vectorial SVG para navegadores livianos (`7820fe1`).
- **Estados de animacion y entorno de prueba**: Siete estados gestuales integrados y pagina de verificacion tecnica en `/mascota` (`7820fe1`).

### Impresion de etiquetas
- **Agente local de impresion**: Desarrollo de la aplicacion de escritorio `apps/agente-local` para la estacion de Caja, encargada de consultar la cola del servidor y comunicarse con la etiquetera fisica (`ab0e0d4`).
- **Generacion de comandos TSPL2**: Soporte de impresion en lenguaje nativo para tres formatos: etiqueta general del pedido, etiqueta por area de despacho y etiqueta individual por bebida (`ab0e0d4`).
- **Cola centralizada en el servidor**: Tabla `print_job` con autenticacion por llave de agente, reclamo atomico de trabajos, latidos de conexion y confirmacion de reimpresion Si/No (`371312a`).

### Correcciones de servidor
- **Resolucion de dependencia circular**: Reorganizacion de importaciones entre `ChatbotModule`, `PedidosModule` y el modulo de avisos internos para permitir el arranque estable de la API (`c3c7299`).

---

## 2026-10-25

### WhatsApp y chatbot (Fase 1 y 2)
- **Motor conversacional por olas**: Estructuracion de la arquitectura por capas para mensajeria con WhatsApp Cloud API y modo simulado para desarrollo (`44d5558`, `f1ab21e`).
- **Seguridad en webhooks**: Validacion de firmas criptograficas, procesamiento idempotente y gestion de la ventana de atencion de 24 horas mediante plantillas oficiales (`44d5558`).
- **Flujo de pedidos interactivos**: Seleccion de productos por botones y listas de opciones, calculo de cupones, promociones y tarifas de envio, con creacion de pedido asociada al canal WhatsApp (`863bc1d`, `e9b4c7c`).
- **Identificacion por BSUID**: Soporte para interacciones con usuarios identificados por identificador de Meta (BSUID) en lugar de numero telefonico directo (`1bb18f4`).
- **Integracion con reclamos y soporte**: Registro automatico de quejas recibidas por WhatsApp en el Libro de reclamaciones y solicitudes de cambio de pedido atendidas desde Mensajes (`44d5558`, `b86bdd6`).
- **Asistente de lectura de carta**: Integracion preliminar de consultas de carta y promociones mediante funcion-calling de solo lectura (`6fd8e23`).

### Modulos operativos
- **Optimizacion del mapa de repartos**: Rutas sugeridas por sector diferenciadas por colores, exclusion de datos sensibles en el mapa del conductor y boton atomico para iniciar ruta (`3cbbffc`, `99223bc`).
- **Unificacion de compras y produccion**: Compras establecida como la via central de ingreso de insumos, reporte de elaboracion diaria Hoy prepare y recetas consolidadas en una sola vista (`ad3ca13`).
- **Gestion simplificada en cocina**: Control rapido de productos agotados, modal unificado para reporte de mermas y seguimiento de pedidos internos al almacen en tres pasos (`9eb484f`).
- **Reglas de promociones y combos**: Constructor guiado de combos en 4 pasos con validacion en servidor; exclusion de descuentos porcentuales sobre productos que ya forman parte de un combo cerrado (`a8afb18`, `d0f54e8`).
- **Seguridad con codigo rotativo del supervisor**: Sustitucion del PIN estatico por un token TOTP dinamico de 30 segundos generado en pantalla protegida para el Administrador, requerido en anulaciones de pedidos, cierres con descuadre y mermas altas (`4d5cb9f`).
- **Visor seguro de iniciativas**: Visualizacion y carga de imagenes privadas de iniciativas mediante descarga autenticada con token de sesion (`1261e15`).

---

## 2026-10-24

### Infraestructura y aseguramiento de calidad
- **Migracion a Docker Compose y SSH**: Sustitucion de la gestion por Dokploy por una infraestructura reproducible con Docker Compose, proxy perimetral Traefik y despliegues orquestados por GitHub Actions mediante SSH seguro (`f9424b8`).
- **Publicacion segura en GHCR**: Compilacion unica de imagenes de API y Web en ejecutores de GitHub, liberando espacio en disco y publicando unicamente artefactos escaneados con Trivy libres de vulnerabilidades criticas (`5ea826b`).
- **Sincronizacion de scripts de operacion**: Despliegue automatizado de scripts y archivos Compose en la carpeta `/opt/caprichos` del VPS (`1c70a85`).
- **Soporte multidominio y certificados**: Configuracion de Traefik para atender `caprichos.pe` y `www.caprichos.pe` con renovacion automatica de certificados TLS via Let's Encrypt (`b074629`).
- **Bateria de pruebas end-to-end con Playwright**: Creacion de 24 pruebas de integracion sobre un entorno aislado con semilla fija de base de datos (`44e9086`).

### Modulos administrativos y experiencia de usuario
- **Sincronizacion de Almacen y Caja**: Sincronizacion de anulacion de cobros protegida con codigo de supervisor en lugar de anular pedidos pagados (`2a22a1d`).
- **Reposicion automatica de inventario**: La anulacion de cobros o pedidos repone automaticamente el stock de productos terminados registrando la identidad del operador responsable (`f2a62a6`).
- **Redisenos visuales**: Simplificacion de vistas en Comprobantes, Libro de reclamaciones y Repartos sustituyendo tablas saturadas por tarjetas y filtros interactivos (`99c76ad`, `5314bc8`, `1ac830c`).

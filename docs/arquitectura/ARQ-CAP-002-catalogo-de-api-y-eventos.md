---
id: ARQ-CAP-002
tipo: arquitectura
titulo: "Catálogo de API y eventos en tiempo real"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [ADR-001, ADR-006, ADR-008, ADR-009, ADR-014, ARQ-CAP-001]
tags: [arquitectura, api, websocket, g3]
---

# ARQ-CAP-002 — Catálogo de API y eventos en tiempo real

> Borrador del contrato para G3 (ADR-001). Prefijo `/api/v1`; errores en RFC 7807 (`application/problem+json`) con `codigo`; `X-Request-Id` en cada respuesta. La columna **Quién** es el rol del sistema (ADR-008); «+PIN» exige el PIN del administrador. Los endpoints marcados como auditables registran su acción en el historial (ADR-014). El OpenAPI (`arquitectura/caprichos.openapi.yaml`) se genera desde el código NestJS con `@nestjs/swagger` al construir; este catálogo es la lista acordada.

## 1. Convenciones

| Tema | Regla |
| --- | --- |
| Autenticación | `Authorization: Bearer <acceso>` (15 min); renovación por cookie `HttpOnly` en `/auth/renovar` (ADR-008). |
| Autorización | Cada endpoint declara módulo y acción; 403 con `codigo: SIN_PERMISO` si el rol no la tiene. |
| Auditoría | Cambios sensibles, accesos y lecturas sensibles llevan `@Auditar(modulo, accion)` (ADR-014). |
| Concurrencia | 409 con `codigo` específico (`MESA_OCUPADA`, `PEDIDO_YA_CONFIRMADO`, `REPARTO_TOMADO`, `CHAT_TOMADO`, `CUPON_USADO`). |
| Idempotencia | `POST /pedidos`, `/cobrar` y `/confirmar` aceptan `Idempotency-Key`. |
| Validación | 422 con la lista de campos; montos en soles con 2 decimales. |
| Listas | Paginación por cursor (`?limite=&despues=`) y filtros por query. |
| Fechas | ISO 8601 con zona; los cortes de día se calculan en `America/Lima`. |
| Público | Endpoints de la carta sin sesión, con límite de solicitudes por IP en Cloudflare y en la API. |

## 2. Endpoints por feature

### FT-CAR-01 — Catálogo por categorías con tamaños y opciones (EP-CAP-001)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/carta` | Público | Carta publicada: categorías, productos, tamaños, grupos de opciones, sabores y promociones vigentes |
| GET | `/carta/productos/{id}` | Público | Ficha con opciones y precios |
| POST | `/carta/cotizar` | Público | Precio de una línea o carrito con opciones (mismo cálculo de `packages/compartido`) |

### FT-CAR-02 — Disponibilidad en la carta: agotados, horario y pausa (EP-CAP-001)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/carta/estado` | Público | Abierto/cerrado, pausa, tiempo prometido con Alta demanda, agotados del momento |
| WS | `/carta → disponibilidad.cambio` | Público | Aviso en vivo de agotados, pausa y horario |

### FT-CAR-03 — Más vendidos, Conócenos y opinión del cliente (EP-CAP-001)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/carta/mas-vendidos` | Público | Ranking del mes con estrellas |
| GET | `/local` | Público | Datos de Conócenos y pie (desde Configuración) |
| POST | `/carta/mensajes` | Público | «¿Cómo te fue?»; una queja avisa al correo del dueño |
| GET | `/admin/mensajes-carta` | ADMIN | Lista con filtros |
| PATCH | `/admin/mensajes-carta/{id}/atender` | ADMIN | Marcar atendido |
| PATCH | `/admin/ranking/visible` | ADMIN | Ocultar o mostrar estrellas |

### FT-PED-01 — Carrito, modalidad y datos mínimos (EP-CAP-002)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/carta/cupones/validar` | Público | Valida un código (límite de intentos) |
| POST | `/pedidos` | Público (canal CARTA) | Crea el pedido directo en cocina con el pago por coordinar (DT-57); método de pago obligatorio; idempotente con `Idempotency-Key` |

### FT-PED-02 — Ubicación y costo de envío en la carta (EP-CAP-002)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/zonas/detectar` | Público | Zona y costo de envío para un punto; fuera de cobertura → 422 |
| GET | `/carta/recordar?telefono=` | Público (con consentimiento previo) | Nombre y última dirección para el siguiente pedido |

### FT-PED-03 — Envío del pedido a comandas y aviso al cliente (EP-CAP-002)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/pedidos/{codigo}/confirmacion` | Público | Pantalla de confirmación y enlace de WhatsApp con el resumen |
| WS | `/admin → pedido.creado` | CAJERO, MOZO, CALLCENTER, ADMIN | Aviso y sonido de pedido nuevo |

### FT-CLI-01 — Cuenta del cliente (EP-CAP-003)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/cuenta/registro` | Público | Crear cuenta con DNI, contraseña, cumpleaños y aceptación |
| POST | `/cuenta/ingresar` | Público | Ingreso por DNI y contraseña (5 intentos) |
| POST | `/cuenta/crear-contrasena` | Público | Cliente registrado en el local crea su contraseña |
| GET | `/admin/clientes?doc=` | CAJERO, ADMIN | Búsqueda por DNI o RUC completo; DNI y RUC enmascarados salvo ADMIN |
| POST | `/admin/clientes` | CAJERO, ADMIN | Registrar cliente en el local |
| PATCH | `/admin/clientes/{id}` | CAJERO, ADMIN | Editar sin cambiar el documento |
| GET | `/admin/clientes/{id}/pedidos` | CAJERO, ADMIN | Historial de pedidos |
| GET | `/admin/clientes/{id}/documento` | ADMIN | DNI o RUC completo; queda en el historial (DT-67) |
| GET | `/admin/clientes.xlsx` | ADMIN | Exportar nombre y teléfono a Excel; queda en el historial |

### FT-CLI-02 — Puntos y beneficio de cumpleaños (EP-CAP-003)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/cuenta/puntos` | Cliente | Saldo e historial |
| POST | `/carta/puntos/simular` | Público | Puntos que gana un carrito (5 % configurable, sin productos marcados, DT-55) |
| POST | `/cuenta/puntos/canjear` | Cliente | Aplica N puntos al pedido; 422 si supera el saldo o el total |
| POST | `/admin/pedidos/{id}/puntos/canjear` | CAJERO, ADMIN | Canje en caja con DNI y contraseña del cliente |
| GET | `/cuenta/notificaciones` | Cliente | Campanita: cupón de cumpleaños |

### FT-CAJ-01 — Cola de pedidos por confirmar (EP-CAP-004)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/pedidos?estado=POR_CONFIRMAR` | CAJERO, MOZO, CALLCENTER, ADMIN | Cola por confirmar (chatbot y teléfono) |
| GET | `/admin/pedidos?pago=POR_COORDINAR` | CAJERO, CALLCENTER, ADMIN | Pedidos de la carta con el pago por coordinar (DT-57) |
| POST | `/admin/pedidos/{id}/pago-coordinado` | CAJERO, CALLCENTER, ADMIN | Registra el pago y la captura sin reenviar a cocina |
| POST | `/admin/pedidos/{id}/comprobante-pago` | CAJERO, MOZO, CALLCENTER, ADMIN | Subir captura (carpeta privada) |
| POST | `/admin/pedidos/{id}/confirmar` | CAJERO, MOZO, CALLCENTER, ADMIN | Confirmar: pasa a cocina, imprime, descuenta stock; 409 si otro ya confirmó |
| PUT | `/admin/pedidos/{id}/ubicacion` | CAJERO, MOZO, CALLCENTER, ADMIN | Ubicar en el mapa; recalcula zona, envío y total |
| POST | `/admin/pedidos/{id}/rechazar` | CAJERO, MOZO, CALLCENTER, ADMIN | Rechazar con motivo |

### FT-CAJ-02 — Cobro con medios de pago y pago mixto (EP-CAP-004)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/admin/pedidos/{id}/cobrar` | CAJERO, ADMIN | Cobro con uno o varios medios, vuelto, comprobante, crédito del personal |
| POST | `/admin/pedidos/{id}/anular` | CAJERO, ADMIN (+PIN) | Anular con motivo; cobrado solo con caja abierta |
| POST | `/admin/pedidos/{id}/precuenta` | MOZO, CAJERO | Imprimir precuenta |

### FT-CAJ-03 — Nuevo pedido desde caja y call center (EP-CAP-004)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/clientes/buscar?telefono=` | CAJERO, CALLCENTER | Recordar cliente y dirección |
| POST | `/admin/pedidos` | CAJERO, CALLCENTER, MOZO | Nuevo pedido (MOSTRADOR, TELEFONO, personal) |
| POST | `/admin/pedidos/{id}/repetir` | CAJERO, CALLCENTER | Llenar carrito con un pedido anterior |

### FT-CIE-01 — Apertura, movimientos y liquidación de repartidores (EP-CAP-005)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/admin/caja/abrir` | CAJERO, ADMIN | Abrir en cero (monto editable) |
| GET | `/admin/caja/actual` | CAJERO, ADMIN | Ventas por medio, movimientos, efectivo esperado, por liquidar |
| POST | `/admin/caja/movimientos` | CAJERO, ADMIN | Ingreso o egreso con motivo |
| POST | `/admin/caja/movimientos/{id}/anular` | CAJERO, ADMIN | Anular movimiento |
| POST | `/admin/caja/liquidaciones` | CAJERO, ADMIN | Liquidar efectivo de un repartidor |

### FT-CIE-02 — Arqueo ciego y cierre con historial (EP-CAP-005)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/admin/caja/conteos` | CAJERO, ADMIN | Arqueo ciego: guarda el intento y responde solo CUADRA o NO_CUADRA (DT-61) |
| GET | `/admin/caja/conteos/detalle` | ADMIN (+PIN) | Detalle por medio y ventas del día de un cierre que no cuadra |
| POST | `/admin/caja/cerrar` | CAJERO, ADMIN | Cierra; con NO_CUADRA exige el PIN de la supervisora; valida pendientes |
| GET | `/admin/caja/cierres` | ADMIN | Historial con filtros |
| GET | `/admin/caja/cierres/{fecha}.csv` | ADMIN | Exportar |

### FT-COC-01 — Pantallas de cocina por área (EP-CAP-006)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/cocina/comandas?area=` | COCINA, ADMIN | Comandas activas del área |
| POST | `/cocina/comandas/{pedido}/{area}/despejar` | COCINA | Único botón: despeja la parte del área (DT-58) |
| GET | `/cocina/historial?area=&fecha=` | COCINA, ADMIN | Despejadas del día con hora de llegada y despeje |
| POST | `/cocina/comandas/{pedido}/{area}/devolver` | COCINA | Devuelve a la pantalla una despejada por error |
| GET | `/despacho/pedidos` | DESPACHO, CAJERO, ADMIN | Pedido completo de todas las áreas y qué falta |
| POST | `/despacho/pedidos/{id}/entregar` | DESPACHO, CAJERO, ADMIN | Entregado al mozo, al cliente o al repartidor |
| GET | `/tv/comandas` | Llave TV | Solo lectura, sin datos personales |
| CRUD | `/admin/areas-cocina` | ADMIN | Áreas propias (máx. 4) y categoría → área |

### FT-COC-02 — Impresión de comandas y etiquetas (EP-CAP-006)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/impresion/fallidos` | CAJERO, ADMIN | Alertas de impresión |
| POST | `/admin/pedidos/{id}/reimprimir` | CAJERO, ADMIN | Reimprimir comanda o etiqueta (COPIA) |
| WS | `/dispositivo → impresion.trabajo / impresion.resultado` | Llave AGENTE | Trabajos y confirmaciones del agente |

### FT-COC-03 — Agotado por hoy y alta demanda (EP-CAP-006)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/cocina/agotados` | COCINA, CAJERO, ADMIN | Agotar por hoy producto, sabor u opción |
| DELETE | `/cocina/agotados/{id}` | COCINA, ADMIN | Reactivar (cierra la vigencia, no borra) |
| PUT | `/cocina/alta-demanda` | COCINA, ADMIN | Minutos (5–180) y pausa |

### FT-SAL-01 — Plano del local (EP-CAP-007)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/plano` | Todos los roles del salón | Pisos y elementos |
| PUT | `/admin/plano` | ADMIN | Guardar plano (valida mesas con pedido o reserva) |
| GET | `/admin/plano/exportar` | ADMIN | Copiar como JSON |
| POST | `/admin/plano/importar` | ADMIN | Pegar JSON |

### FT-SAL-02 — Pedido del mozo y control de mesas (EP-CAP-007)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/mesas` | MOZO, CAJERO | Estado de mesas en vivo |
| POST | `/admin/pedidos/{id}/adicional` | MOZO | Comanda adicional |
| POST | `/admin/pedidos/{id}/entregado-en-mesa` | MOZO | Marcar entrega |
| POST | `/admin/mesas/{id}/liberar` | MOZO, CAJERO | Liberar a mano |

### FT-SAL-03 — Reservas (EP-CAP-007)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/reservas?mes=` | MOZO, CAJERO, ADMIN | Calendario del mes |
| POST | `/admin/reservas` | MOZO, CAJERO | Registrar (valida hora y asientos) |
| POST | `/admin/reservas/{id}/sentar` | MOZO, CAJERO | Abrir pedido en sus mesas |
| POST | `/admin/reservas/{id}/cancelar` | MOZO, CAJERO | Cancelar con motivo |

### FT-DEL-01 — Zonas de reparto y tarifas (EP-CAP-008)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/zonas` | ADMIN | Zonas |
| PUT | `/admin/zonas/{id}` | ADMIN | Puntos, tarifa, activa (sin crear) |
| PUT | `/admin/clientes/{id}/tarifa-envio` | ADMIN | Tarifa especial |

### FT-DEL-02 — Reparto: tomar, navegar y entregar (EP-CAP-008)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/reparto/disponibles` | REPARTIDOR | Delivery listos |
| POST | `/reparto/{pedido}/tomar` | REPARTIDOR | Tomar (409 si otro ganó) |
| GET | `/reparto/mis-entregas` | REPARTIDOR | Solo sus pedidos |
| GET | `/reparto/mapa` | REPARTIDOR | Puntos con nombre, código, minutos de espera, zona y orden sugerido (DT-59) |
| POST | `/reparto/{pedido}/en-camino` | REPARTIDOR | Salida; envía el mensaje 1 al cliente (DT-60) |
| POST | `/reparto/{pedido}/he-llegado` | REPARTIDOR | Llegada; envía el mensaje 2 y programa el 3 |
| POST | `/reparto/{pedido}/entregado` | REPARTIDOR | Entrega y efectivo cobrado |

### FT-DEL-03 — Entregas fallidas (EP-CAP-008)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/reparto/{pedido}/incidente` | REPARTIDOR | No contesta / no encuentro |
| POST | `/admin/pedidos/{id}/coordinacion/cerrar` | CAJERO, CALLCENTER | Reprogramar, devolver o cobrar igual |

### FT-STK-01 — Insumos, unidades y niveles (EP-CAP-009)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| CRUD | `/admin/insumos` | ALMACEN, ADMIN | Ficha, unidades, niveles, proveedores A/B/C, lugar |
| GET | `/admin/stock?lugar=&estado=` | ALMACEN, ADMIN | Stock por lugar con semáforo |

### FT-STK-02 — Recetas, costo y margen (EP-CAP-009)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| PUT | `/admin/productos/{id}/receta` | ADMIN | Receta por tamaño |
| PUT | `/admin/opciones/{id}/ajustes` | ADMIN | Efecto de la opción en la receta |
| GET | `/admin/productos/margenes` | ADMIN | Costo y margen por plato |

### FT-STK-03 — Descuento por venta y disponibilidad (EP-CAP-009)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| (evento) | `pedido.confirmado → stock` | Sistema | Descuenta insumos por receta y área; devuelve al anular |
| WS | `/admin → stock.bajo` | ALMACEN, ADMIN | Aviso de mínimo o negativo |

### FT-ALM-01 — Movimientos de almacén (EP-CAP-010)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/admin/almacen/movimientos` | ALMACEN, ADMIN | Entrada, salida (traslado), merma, devolución |
| POST | `/admin/traslados/{id}/recibir` | COCINA, ADMIN | Recibí con cantidad real |
| GET | `/admin/almacen/movimientos` | ALMACEN, ADMIN | Historial con filtros |
| POST | `/admin/almacen/movimientos/{id}/anular` | ALMACEN, ADMIN | Movimiento inverso |

### FT-ALM-02 — Producción por tanda (EP-CAP-010)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/admin/produccion` | ALMACEN, COCINA, ADMIN | Registrar tandas; 409 si falta materia prima |
| POST | `/admin/produccion/simular` | ALMACEN, COCINA, ADMIN | Cuánto sale de cocina y del almacén |
| POST | `/admin/produccion/{id}/anular` | ALMACEN, ADMIN | Revertir |

### FT-ALM-03 — Pedidos internos, mermas y cierre del día (EP-CAP-010)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/admin/pedidos-internos` | COCINA | Pedir insumos |
| POST | `/admin/pedidos-internos/{id}/recibido` | ALMACEN, PRODUCCION, ADMIN | Calla el sonido; queda quién recibió (DT-64) |
| POST | `/admin/pedidos-internos/{id}/entregar` | ALMACEN | Entregar (crea traslados) |
| POST | `/admin/cocina/mermas` | COCINA, ADMIN | Merma de productos de cocina |
| POST | `/admin/cierre-dia` | COCINA, ALMACEN, ADMIN | Conteo y destino |

### FT-COM-01 — Directorio de proveedores (EP-CAP-011)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| CRUD | `/admin/proveedores` | ALMACEN, ADMIN | Directorio (desactivar, no borrar) |
| GET | `/admin/proveedores/{id}/historial` | ALMACEN, ADMIN | Compras y precios |

### FT-COM-02 — Pedir a proveedores por WhatsApp (EP-CAP-011)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/compras/por-pedir` | ALMACEN, ADMIN | Lista bajo mínimo en unidades enteras por proveedor |
| POST | `/admin/pedidos-proveedor` | ALMACEN, ADMIN | Crea «Por recibir» y devuelve el mensaje de WhatsApp |
| POST | `/admin/pedidos-proveedor/{id}/anular` | ALMACEN, ADMIN | Anular sin tocar stock |

### FT-COM-03 — Registro y recepción de compras (EP-CAP-011)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/admin/compras` | ALMACEN, ADMIN | Registrar compra (o recibir un pedido) |
| POST | `/admin/compras/{id}/pagar` | ADMIN | Marcar pagada |
| POST | `/admin/compras/{id}/anular` | ADMIN | Anular y revertir entrada |

### FT-OFE-01 — Combos y promociones (EP-CAP-012)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| CRUD | `/admin/ofertas` | ADMIN | Combos y lleva N paga M con vigencia |

### FT-OFE-02 — Descuentos automáticos y acumulación (EP-CAP-012)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| CRUD | `/admin/descuentos` | ADMIN | Descuentos automáticos |
| PUT | `/admin/reglas-acumulacion` | ADMIN | Acumulación, cupones por comprobante, texto al pie |

### FT-OFE-03 — Cupones (EP-CAP-012)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| CRUD | `/admin/cupones` | ADMIN | Cupones de los dos modos |
| GET | `/admin/cupones/emitidos` | ADMIN | Emitidos y canjes |
| POST | `/admin/cupones/emitidos/{id}/anular` | ADMIN | Anular |

### FT-USR-01 — Usuarios y primer ingreso (EP-CAP-013)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| CRUD | `/admin/usuarios` | ADMIN | Alta, edición, desactivar (no borrar) |
| POST | `/auth/ingresar` | Público | Ingreso del personal; 403 USUARIO_DESACTIVADO si la cuenta está inactiva |
| POST | `/auth/cambiar-contrasena` | Personal | Primer ingreso y cambio; en el cambio pide la contraseña actual (reautenticación) y queda en el historial |
| POST | `/admin/usuarios/{id}/restablecer` | ADMIN | Solo el administrador: vuelve a la inicial y obliga a cambiarla; queda en el historial |
| PUT | `/perfil/foto` | Personal | Foto de perfil |
| PUT | `/admin/usuarios/{id}/horario` | ADMIN | Días y horas de trabajo (DT-64) |
| CRUD | `/admin/coberturas` | ADMIN | Quién cubre un descanso un día puntual |
| GET | `/admin/turno?rol=&momento=` | ADMIN, sistema | Quién está de turno |
| POST | `/auth/renovar` | Personal y cliente | Token de renovación rotativo |

### FT-USR-02 — Roles, permisos y escritorio por rol (EP-CAP-013)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/auth/yo` | Personal | Rol, permisos y menú |
| GET | `/admin/escritorio` | Personal | Escritorio según rol |
| PUT | `/admin/roles/{rol}/permisos` | ADMIN | Matriz editable |
| PUT | `/admin/pin` | ADMIN | Cambiar PIN de 6 dígitos (DT-61) |
| POST | `/admin/pin/verificar` | Personal (con el PIN de la supervisora) | Aprobación en la misma pantalla; 3 errores bloquean 5 minutos |

### FT-USR-03 — Crédito del personal (EP-CAP-013)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/creditos-personal?desde=&hasta=` | ADMIN | Consumo por trabajador; por defecto la semana actual (DT-63) |
| GET | `/admin/creditos-personal.xlsx?desde=&hasta=` | ADMIN | Exportar a Excel (queda en el historial) |

### FT-BOT-01 — Pedido por botones (EP-CAP-014)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/whatsapp/webhook` | Meta (firma) | Mensajes entrantes → cola |
| GET | `/whatsapp/webhook` | Meta | Verificación del webhook |

### FT-BOT-02 — Pago por WhatsApp con aprobación (EP-CAP-014)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/admin/conversaciones/{id}/pago/aprobar` | CAJERO, MOZO, CALLCENTER, ADMIN | Aprobar captura → confirmar pedido |
| POST | `/admin/conversaciones/{id}/pago/rechazar` | CAJERO, MOZO, CALLCENTER, ADMIN | Rechazar con motivo |

### FT-BOT-03 — IA para dudas y recomendaciones (EP-CAP-014)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/solicitudes-reserva` | MOZO, CAJERO | Solicitudes del bot |
| POST | `/admin/solicitudes-reserva/{id}/aprobar` | MOZO, CAJERO | Crea la reserva y avisa |
| GET | `/admin/uso-externo` | ADMIN | Costo de IA y plantillas |

### FT-ATN-01 — Consola de chats con dueño único (EP-CAP-015)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/conversaciones` | CAJERO, MOZO, CALLCENTER, ADMIN | Consola con filtros |
| POST | `/admin/conversaciones/{id}/tomar` | Ídem | Tomar (con confirmación si es de otro) |
| POST | `/admin/conversaciones/{id}/soltar` | Ídem | Devolver al bot |
| POST | `/admin/conversaciones/{id}/mensajes` | Ídem | Enviar mensaje |
| POST | `/admin/conversaciones/pulir` | Ídem | Vista previa con IA |
| CRUD | `/admin/respuestas-rapidas` | ADMIN | Respuestas rápidas |

### FT-ATN-02 — Cambios después del pedido y derivación (EP-CAP-015)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/solicitudes-cambio` | CAJERO, CALLCENTER | Pendientes |
| POST | `/admin/solicitudes-cambio/{id}/decidir` | CAJERO, CALLCENTER | Aceptar o rechazar |

### FT-ATN-03 — Encuesta posventa y quejas (EP-CAP-015)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/encuestas` | ADMIN | Resultados |

### FT-CON-01 — Productos, listas y categorías (EP-CAP-016)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| CRUD | `/admin/productos` | ADMIN | Productos (ocultar, no borrar) |
| CRUD | `/admin/categorias` | ADMIN | Categorías con o sin opciones |
| CRUD | `/admin/grupos-opciones` | ADMIN | Opciones y alcance |
| CRUD | `/admin/listas/{codigo}/valores` | ADMIN | Listas por categoría |
| POST | `/admin/archivos` | ADMIN | Subir foto (WebP) |

### FT-CON-02 — Diseñador de la carta y decoración (EP-CAP-016)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/carta/borrador` | ADMIN | Versión en edición |
| PUT | `/admin/carta/borrador` | ADMIN | Orden, ocultos, destacados, organización, decoración |
| POST | `/admin/carta/publicar` | ADMIN | Publicar |
| POST | `/admin/carta/descartar` | ADMIN | Descartar borrador |

### FT-CON-03 — Novedades y destacadas (EP-CAP-016)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/carta/novedades` | Público | Novedades vigentes |
| GET | `/carta/destacadas` | Público | Círculos con fotos |
| CRUD | `/admin/novedades` | ADMIN | Novedades (desactivar) |
| CRUD | `/admin/destacadas` | ADMIN | Destacadas (archivar y eliminar) |

### FT-CFG-01 — Datos del local, horario y fechas especiales (EP-CAP-017)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/configuracion/local` | ADMIN | Datos del local |
| PUT | `/admin/configuracion/local` | ADMIN | Datos y ubicación |
| PUT | `/admin/configuracion/horario` | ADMIN | Horario y fechas especiales |
| CRUD | `/admin/configuracion/fotos` | ADMIN | Fotos del local |

### FT-CFG-02 — Pagos, entrega y parámetros de operación (EP-CAP-017)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/parametros` | ADMIN | Parámetros de operación |
| PUT | `/admin/parametros/{clave}` | ADMIN | Cambiar con historial |

### FT-INF-01 — Informes con período y filtros (EP-CAP-018)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/informes/{tipo}?desde=&hasta=&canal=&pago=&modalidad=` | ADMIN | Ventas, tiempos, rentabilidad, ofertas |
| GET | `/admin/informes/{tipo}.xlsx` | ADMIN | Exportar a Excel (queda en el historial, DT-67) |

### FT-INF-02 — Indicadores y mapa de entregas (EP-CAP-018)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/indicadores` | ADMIN | Escritorio e indicadores |
| GET | `/admin/mapa-entregas` | ADMIN | Calor, zonas, radios, fuera de cobertura |

### FT-INF-03 — Notificaciones (EP-CAP-018)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/notificaciones` | Personal | Filtros por tipo, estado y fechas |
| POST | `/admin/notificaciones/leer` | Personal | Marcar leídas |
| WS | `/admin → notificacion.nueva` | Según rol | Campanita en vivo |

### FT-OFF-01 — Operación local y sincronización (EP-CAP-019)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| (agente) | `http://caja.local/api/v1/*` | Local | Subconjunto de pedidos, cobros, comandas y mesas sin internet, en el mini servidor de la caja (segunda meta, DT-52) |
| POST | `/sincronizacion` | Llave AGENTE | Envío ordenado e idempotente al volver |

### FT-LEG-01 — Comprobantes: nota de venta y datos de boleta o factura (EP-CAP-020)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/comprobantes/por-emitir` | CAJERO, ADMIN | Boletas y facturas a emitir en el facturador |
| POST | `/admin/pedidos/{id}/comprobante/reimprimir` | CAJERO | Copia |

### FT-LEG-02 — Libro de Reclamaciones, términos y privacidad (EP-CAP-020)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| POST | `/carta/reclamos` | Público | Libro de Reclamaciones con constancia |
| GET | `/admin/reclamos` | ADMIN | Con plazo restante |
| POST | `/admin/reclamos/{id}/responder` | ADMIN | Respuesta |
| POST | `/admin/personas/{id}/exportar` | ADMIN | Derecho de acceso |
| POST | `/admin/personas/{id}/anonimizar` | ADMIN (+PIN) | Anonimizar |

### FT-USR-04 — Historial de acciones (auditoría) (EP-CAP-013)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| (interceptor) | `@Auditar(modulo, accion) en cada endpoint de la lista` | Sistema | Registra cambios, accesos y lecturas sensibles en la misma transacción (ADR-014) |
| GET | `/admin/auditoria?persona=&modulo=&accion=&resultado=&desde=&hasta=` | ADMIN | Historial de acciones con filtros |
| GET | `/admin/auditoria/{entidad}/{id}` | ADMIN | «Ver historial» de una ficha |
| GET | `/admin/auditoria.csv` | ADMIN | Exportar (queda auditado) |
| GET | `/admin/auditoria/verificacion` | ADMIN | Estado de la última verificación de la cadena |

### FT-PLA-01 — Monorepo y publicación automática (EP-CAP-021)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/salud` | Público (Uptime Kuma) | Estado de la API, la base y Redis; 503 si algo falla |
| GET | `/version` | Público | Versión y commit desplegados |
| (CI) | `.github/workflows/ci.yml · deploy-staging.yml · deploy-prod.yml` | GitHub Actions | Lint, pruebas, dependencias, build, Trivy; publicación a pruebas y a producción con tag |

### FT-PLA-02 — Servidor, red, ambientes y secretos (EP-CAP-021)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| (infra) | `infra/ansible/site.yml` | SSH con llave | Prepara el VPS: usuario, firewall, fail2ban, parches, Docker y Dokploy |
| (infra) | `Cloudflare: caprichos.pe, admin., api., staging., panel.` | Cloudflare | DNS, proxy, HTTPS y Access para el panel |

### FT-PLA-03 — Copias y recuperación (EP-CAP-021)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| (tarea) | `copia-diaria (restic) 03:00 Lima` | VPS | pg_dump por ambiente + carpetas de fotos y comprobantes, cifrado, fuera del VPS |
| (tarea) | `prueba-de-restauracion trimestral` | Persona responsable | Restaurar en pruebas siguiendo RB-CAP-002 y anotar el tiempo |

### FT-PLA-04 — Vigilancia y alertas (EP-CAP-021)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| (monitor) | `Uptime Kuma: carta, /salud, WebSocket, webhook de WhatsApp, agente, copia` | Uptime Kuma | Revisa cada minuto y avisa al celular |
| (monitor) | `GlitchTip: api, web, bot` | GlitchTip | Errores sin datos personales |

### FT-PLA-05 — Seguridad y mantenimiento (EP-CAP-021)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| (CI) | `Renovate y Trivy` | GitHub | PRs de actualización y bloqueo de imágenes con vulnerabilidades críticas |
| (infra) | `unattended-upgrades` | VPS | Parches de seguridad automáticos |

### FT-INI-01 — Iniciativas del equipo (EP-CAP-022)

| Método | Ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| GET | `/admin/iniciativas?q=&tipo=&estado=&mias=` | Personal | Lista para todo el personal, con autor, rol, fecha y contadores |
| POST | `/admin/iniciativas` | Personal | Subir (tipo, área, título, detalle, captura); queda en el historial |
| POST | `/admin/iniciativas/capturas` | Personal | Subir la captura (imagen hasta 5 MB, carpeta privada) |
| POST | `/admin/iniciativas/{id}/comentarios` | Personal | Comentar; queda en el historial |
| PATCH | `/admin/iniciativas/{id}/estado` | ADMIN | Nueva, en revisión, hecha o no por ahora; queda en el historial |

## 3. Eventos en tiempo real (Socket.IO, ADR-006)

Namespaces: `/admin` (personal), `/carta` (público, sin datos personales), `/dispositivo` (agente y TV). Los eventos se publican **después del commit**; al reconectar, la pantalla pide el estado por REST.

| Evento | Sala / destino | Significado | Feature |
| --- | --- | --- | --- |
| `pedido.creado` | `/admin, rol:CAJERO/MOZO/CALLCENTER/ADMIN, area:*` | Pedido nuevo: por confirmar, de mesa o de la carta (este va directo a cocina) | FT-PED-03 |
| `pedido.confirmado` | `area:*` | Comanda nueva en cocina | FT-CAJ-01, FT-COC-01 |
| `comanda.estado` | `area:*, pedido:{id}, rol:DESPACHO` | Despejada o devuelta por un área | FT-COC-01 |
| `reparto.mensaje` | `rol:REPARTIDOR` | El cliente respondió o falló un aviso | FT-DEL-02 |
| `almacen.pedido` | `rol:ALMACEN, usuario:{de turno}` | Pedido interno: suena hasta «Recibido» | FT-ALM-03 |
| `pedido.listo` | `usuario:{mozo}, rol:CAJERO, rol:REPARTIDOR` | Todas las áreas terminaron | FT-COC-01, FT-SAL-02, FT-DEL-02 |
| `pedido.estado` | `pedido:{id}` | Cualquier cambio de estado | FT-CAJ-01 |
| `mesa.estado` | `rol:MOZO, rol:CAJERO` | Ocupada, libre, reservada | FT-SAL-02, FT-SAL-03 |
| `reparto.tomado` | `rol:REPARTIDOR` | Sale de disponibles | FT-DEL-02 |
| `entrega.incidente` | `rol:CAJERO, rol:CALLCENTER` | No contesta / no encuentro | FT-DEL-03 |
| `agotado.cambio` | `/carta, /admin` | Producto, sabor u opción agotado o reactivado | FT-COC-03, FT-CAR-02 |
| `altademanda.cambio` | `/carta, /admin` | Minutos extra y pausa | FT-COC-03 |
| `impresion.trabajo` | `/dispositivo (agente)` | Trabajo a imprimir | FT-COC-02 |
| `impresion.fallo` | `rol:CAJERO` | Alerta con reimprimir | FT-COC-02 |
| `stock.bajo` | `rol:ALMACEN, rol:ADMIN` | Bajo mínimo o negativo | FT-STK-03 |
| `chat.mensaje` | `rol:CAJERO/MOZO/CALLCENTER` | Mensaje nuevo, urgente o validar pago | FT-ATN-01, FT-BOT-02 |
| `chat.tomado` | `rol:CAJERO/MOZO/CALLCENTER` | Cambio de dueño del chat | FT-ATN-01 |
| `caja.cobro` | `rol:ADMIN` | Totales por medio en vivo (el cajero no los recibe, DT-61) | FT-CIE-01 |
| `carta.publicada` | `/carta` | Recargar la carta | FT-CON-02 |
| `notificacion.nueva` | `rol:*, usuario:*` | Campanita | FT-INF-03 |

## 4. Colas y tareas programadas (ADR-007)

| Cola o tarea | Qué hace | Cuándo |
| --- | --- | --- |
| `impresion` | Envía trabajos al agente y marca fallidos a los 10 s | Al pasar a cocina, reimprimir |
| `whatsapp-entrada` | Procesa mensajes del webhook (flujo del bot) | Cada mensaje entrante |
| `whatsapp-salida` | Envía mensajes y plantillas; registra costo | Bot, confirmaciones, encuesta |
| `ia` | Consulta a OpenAI con tope mensual | Dudas, «Pulir mensaje» |
| `notificaciones` | Crea notificaciones y correos al dueño | Eventos de dominio |
| vencer-reservas | Pasa a NO_ASISTIO tras la tolerancia | Cada minuto |
| agotado-por-hoy | Reactiva agotados del día | 00:00 Lima |
| recordatorio-por-confirmar | Avisa a caja a los N minutos (D-05) | Cada minuto |
| encuesta-posventa | Envía la encuesta a las 2 h de entregado | Cada 5 minutos |
| ranking-mes | Cierra el ranking y abre el mes | Día 1, 00:05 |
| liberar-chats | Devuelve al bot chats inactivos (propuesta 15 min) | Cada minuto |
| verificar-auditoria | Recalcula la huella encadenada y avisa si se rompió (ADR-014) | 03:30 Lima |
| archivar-auditoria | Pasa a archivo cifrado lo de más de 2 años (ADR-014) | Mensual |
| anonimizar | Aplica plazos de conservación (ADR-005) | Mensual |
| copia-diaria | pg_dump + carpetas con restic (ADR-012) | 03:00 Lima (en el VPS, fuera de la API) |

---

Generado por IA: 201 endpoints derivados de los requerimientos de las 61 features y de los ADR-001, 006, 007, 008, 009 y 014 — Revisado por: (pendiente)

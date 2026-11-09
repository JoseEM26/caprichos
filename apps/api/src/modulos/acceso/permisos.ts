export interface DefinicionRol {
  codigo: string;
  nombre: string;
}

export interface DefinicionPermiso {
  modulo: string;
  accion: string;
}

export const ROLES: readonly DefinicionRol[] = [
  { codigo: 'ADMIN', nombre: 'Administrador' },
  { codigo: 'CAJERO', nombre: 'Cajero' },
  { codigo: 'COCINA', nombre: 'Cocina (todas las áreas)' },
  { codigo: 'MOZO', nombre: 'Mozo' },
  { codigo: 'ALMACEN', nombre: 'Almacén' },
  { codigo: 'REPARTIDOR', nombre: 'Repartidor' },
  // Persona encargada del local: caja, salón y escritorio operativo. Sin administración.
  { codigo: 'SUPERVISOR', nombre: 'Supervisor' },
  // Rol EXTRA para que cualquiera apoye en delivery (ver, seguir, tomar y entregar). A diferencia de REPARTIDOR sí se combina
  { codigo: 'APOYO_DELIVERY', nombre: 'Apoyo en delivery' },
] as const;

/** Roles retirados del sistema: el sincronizador les borra los permisos y nunca los recrea. */
export const ROLES_ELIMINADOS: readonly string[] = ['CALLCENTER'];

/** Roles que anulan pedidos (todos los de personal con acceso a pedidos; ALMACEN no); el sincronizador quita pedidos/anular a cualquier otro rol. */
export const ROLES_ANULAN_PEDIDOS: readonly string[] = ['ADMIN', 'CAJERO', 'SUPERVISOR', 'COCINA', 'MOZO', 'REPARTIDOR', 'APOYO_DELIVERY'];

/** Permisos retirados (modulo/accion): el sincronizador los borra de la base y de todos los roles. */
export const PERMISOS_RETIRADOS: readonly string[] = ['supervisor/ver_codigo', 'supervisor/gestionar_codigo'];

export const PERMISOS: readonly DefinicionPermiso[] = [
  { modulo: 'usuarios', accion: 'ver' },
  { modulo: 'usuarios', accion: 'crear' },
  { modulo: 'usuarios', accion: 'editar' },
  { modulo: 'usuarios', accion: 'desactivar' },
  { modulo: 'usuarios', accion: 'reactivar' },
  { modulo: 'usuarios', accion: 'restablecer' },
  { modulo: 'configuracion', accion: 'ver' },
  { modulo: 'configuracion', accion: 'editar' },
  { modulo: 'auditoria', accion: 'ver' },
  { modulo: 'catalogo', accion: 'ver' },
  { modulo: 'catalogo', accion: 'crear' },
  { modulo: 'catalogo', accion: 'editar' },
  { modulo: 'catalogo', accion: 'agotar' },
  { modulo: 'catalogo', accion: 'ocultar' },
  { modulo: 'local', accion: 'ver' },
  { modulo: 'local', accion: 'editar' },
  { modulo: 'archivos', accion: 'subir' },
  { modulo: 'archivos', accion: 'ver' },
  // Zonas y Pedidos (Ola 3)
  { modulo: 'pedidos', accion: 'ver' },
  { modulo: 'pedidos', accion: 'crear' },
  { modulo: 'pedidos', accion: 'cambiar_estado' },
  { modulo: 'pedidos', accion: 'anular' },
  // Editar productos y datos de un pedido aún sin cobrar (Caja): ADMIN, SUPERVISOR, CAJERO y MOZO
  { modulo: 'pedidos', accion: 'editar' },
  { modulo: 'pedidos', accion: 'corregir_cliente' },
  // Imprimir la precuenta de una mesa (ticket sin cobrar) desde cualquier equipo, tablet incluida: ADMIN, SUPERVISOR, CAJERO y MOZO
  { modulo: 'pedidos', accion: 'imprimir_precuenta' },
  // Agregar un pedido extra enlazado a uno ya hecho (con su propio pago y comprobante): ADMIN, SUPERVISOR, CAJERO y MOZO
  { modulo: 'pedidos', accion: 'extra' },
  { modulo: 'zonas', accion: 'ver' },
  { modulo: 'zonas', accion: 'editar' },
  // Caja y Repartos (Ola 4)
  { modulo: 'caja', accion: 'abrir' },
  { modulo: 'caja', accion: 'cobrar' },
  { modulo: 'caja', accion: 'movimientos' },
  { modulo: 'caja', accion: 'cerrar' },
  { modulo: 'caja', accion: 'ver' },
  { modulo: 'repartos', accion: 'ver' },
  // Seguimiento de solo lectura de los deliveries (qué entrega y lleva cada repartidor): quien atiende delivery sin repartir
  { modulo: 'repartos', accion: 'seguir' },
  { modulo: 'repartos', accion: 'tomar' },
  { modulo: 'repartos', accion: 'entregar' },
  { modulo: 'repartos', accion: 'reportar' },
  // Chat de WhatsApp de un pedido propio (solo texto, solo mientras el pedido siga vigente)
  { modulo: 'repartos', accion: 'chat' },
  // Ver en el mapa dónde está cada repartidor en ruta, en vivo: solo ADMIN, SUPERVISOR y CAJERO (ni mozo, ni cocina, ni otros repartidores)
  { modulo: 'repartos', accion: 'ver_ubicacion' },
  { modulo: 'repartos', accion: 'liquidar' },
  // Cambio de ubicación de un delivery: Caja aprueba/cambia; el repartidor propone
  { modulo: 'pedidos', accion: 'cambiar_ubicacion' },
  // Cortesías (venta a costo 0): libres para ADMIN, SUPERVISOR, CAJERO y MOZO (sin código); motivo obligatorio y queda auditada. Ver el informe: Caja y ADMIN
  { modulo: 'cortesias', accion: 'dar' },
  { modulo: 'cortesias', accion: 'ver' },
  { modulo: 'repartos', accion: 'proponer_ubicacion' },
  // Cambio de forma de pago en la puerta: el repartidor solicita; Caja, Admin y Supervisor validan
  { modulo: 'repartos', accion: 'solicitar_cambio_cobro' },
  { modulo: 'pedidos', accion: 'validar_cambio_cobro' },
  // Cambiar o agregar medios de pago del pedido en cualquier estado (sin código ni aprobación): Caja, Admin, Supervisor, Mozo (sus pedidos) y Repartidor (los asignados)
  { modulo: 'pedidos', accion: 'ajustar_pago' },
  // Cocina, Stock y Recetas (Ola 5)
  { modulo: 'cocina', accion: 'ver' },
  { modulo: 'cocina', accion: 'despejar' },
  { modulo: 'cocina', accion: 'despachar' },
  // Pantalla Despacho: pedidos completos de todas las áreas y marca de atendido
  { modulo: 'cocina', accion: 'despacho' },
  { modulo: 'cocina', accion: 'devolver' },
  { modulo: 'cocina', accion: 'agotar' },
  { modulo: 'cocina', accion: 'demanda' },
  { modulo: 'stock', accion: 'ver' },
  { modulo: 'stock', accion: 'editar' },
  { modulo: 'stock', accion: 'movimientos' },
  { modulo: 'recetas', accion: 'ver' },
  { modulo: 'recetas', accion: 'editar' },
  // Salón, plano y reservas (Ola 6)
  { modulo: 'plano', accion: 'ver' },
  { modulo: 'plano', accion: 'editar' },
  { modulo: 'mesas', accion: 'ver' },
  { modulo: 'mesas', accion: 'abrir' },
  { modulo: 'mesas', accion: 'liberar' },
  { modulo: 'reservas', accion: 'ver' },
  { modulo: 'reservas', accion: 'crear' },
  { modulo: 'reservas', accion: 'editar' },
  // Comprobantes y Reclamos (Ola 7)
  { modulo: 'comprobantes', accion: 'ver' },
  { modulo: 'comprobantes', accion: 'reimprimir' },
  { modulo: 'comprobantes', accion: 'emitir' },
  { modulo: 'comprobantes', accion: 'anular' },
  { modulo: 'reclamos', accion: 'ver' },
  { modulo: 'reclamos', accion: 'responder' },
  // Ofertas, cupones, clientes y puntos (Fase Siguiente - Ola S1)
  { modulo: 'ofertas', accion: 'ver' },
  { modulo: 'ofertas', accion: 'crear' },
  { modulo: 'ofertas', accion: 'editar' },
  { modulo: 'cupones', accion: 'ver' },
  { modulo: 'cupones', accion: 'crear' },
  { modulo: 'cupones', accion: 'editar' },
  { modulo: 'cupones', accion: 'canjear' },
  { modulo: 'clientes', accion: 'ver' },
  { modulo: 'clientes', accion: 'editar' },
  { modulo: 'puntos', accion: 'ver' },
  { modulo: 'puntos', accion: 'ajustar' },
  // Compras y proveedores (FT-COM-01..03)
  { modulo: 'compras', accion: 'ver' },
  { modulo: 'compras', accion: 'crear' },
  { modulo: 'compras', accion: 'anular' },
  { modulo: 'compras', accion: 'pagar' },
  { modulo: 'proveedores', accion: 'ver' },
  { modulo: 'proveedores', accion: 'crear' },
  { modulo: 'proveedores', accion: 'editar' },
  { modulo: 'proveedores', accion: 'desactivar' },
  { modulo: 'pedidos_proveedor', accion: 'ver' },
  { modulo: 'pedidos_proveedor', accion: 'crear' },
  { modulo: 'pedidos_proveedor', accion: 'anular' },
  // Almacén y producción (FT-ALM-01..03)
  { modulo: 'almacen', accion: 'ver' },
  { modulo: 'almacen', accion: 'movimientos' },
  { modulo: 'almacen', accion: 'traslados' },
  { modulo: 'almacen', accion: 'pedidos_internos' },
  { modulo: 'almacen', accion: 'cierre' },
  // Conteo de apertura del día de los productos que controlan stock (donas, galletas)
  { modulo: 'almacen', accion: 'apertura' },
  // Merma de producto terminado: Cocina decide y queda auditada
  { modulo: 'almacen', accion: 'merma_producto' },
  { modulo: 'produccion', accion: 'ver' },
  { modulo: 'produccion', accion: 'crear' },
  { modulo: 'produccion', accion: 'anular' },
  // Crédito del personal (FT-USR-03)
  { modulo: 'creditos', accion: 'ver' },
  { modulo: 'creditos', accion: 'exportar' },
  // Saldar consumos del personal (pagar en Caja o marcar descontado por planilla)
  { modulo: 'creditos', accion: 'saldar' },
  // Cobrarle al trabajador en el momento (Nuevo pedido del personal, «Pagar ahora»): ADMIN, CAJERO y MOZO; queda quién cobró
  { modulo: 'creditos', accion: 'cobrar_ahora' },
  // Iniciativas del equipo (FT-INI-01)
  { modulo: 'iniciativas', accion: 'ver' },
  { modulo: 'iniciativas', accion: 'crear' },
  { modulo: 'iniciativas', accion: 'comentar' },
  { modulo: 'iniciativas', accion: 'cambiar_estado' },
  // Atención, mensajes y bot (FT-ATN-01..03)
  { modulo: 'mensajes', accion: 'ver' },
  { modulo: 'mensajes', accion: 'tomar' },
  { modulo: 'mensajes', accion: 'enviar' },
  { modulo: 'mensajes', accion: 'cerrar' },
  // Bloquear números de WhatsApp (nada se les envía y se ignoran sus mensajes): solo ADMIN y SUPERVISOR
  { modulo: 'mensajes', accion: 'bloquear_numeros' },
  // Cola de WhatsApp saliente (outbox): ver el estado, reenviar o descartar un fallido
  { modulo: 'whatsapp_salientes', accion: 'ver' },
  { modulo: 'whatsapp_salientes', accion: 'reenviar' },
  { modulo: 'whatsapp_salientes', accion: 'descartar' },
  { modulo: 'encuestas', accion: 'ver' },
  // Informes, indicadores y notificaciones (FT-INF-01..03)
  { modulo: 'informes', accion: 'ver' },
  { modulo: 'informes', accion: 'exportar' },
  { modulo: 'indicadores', accion: 'ver' },
  { modulo: 'notificaciones', accion: 'ver' },
  { modulo: 'notificaciones', accion: 'marcar' },
  // Contenidos, diseñador y carta (FT-CON-02/03, FT-CAR-03)
  { modulo: 'carta_diseno', accion: 'ver' },
  { modulo: 'carta_diseno', accion: 'editar' },
  { modulo: 'carta_diseno', accion: 'publicar' },
  { modulo: 'novedades', accion: 'ver' },
  { modulo: 'novedades', accion: 'crear' },
  { modulo: 'novedades', accion: 'editar' },
  { modulo: 'destacadas', accion: 'ver' },
  { modulo: 'destacadas', accion: 'crear' },
  { modulo: 'destacadas', accion: 'editar' },
  { modulo: 'destacadas', accion: 'archivar' },
  { modulo: 'destacadas', accion: 'eliminar' },
  { modulo: 'mensajes_carta', accion: 'ver' },
  { modulo: 'mensajes_carta', accion: 'atender' },
  // Pantallas TV (FT-COC-01)
  { modulo: 'pantallas', accion: 'ver' },
  { modulo: 'pantallas', accion: 'vincular' },
  { modulo: 'pantallas', accion: 'desactivar' },
  // Escritorio operativo del supervisor: solo conteos y horarios, sin dinero
  { modulo: 'escritorio', accion: 'operativo' },
  // Cumpleaños del personal (dato personal, Ley 29733): solo ADMIN y SUPERVISOR
  { modulo: 'escritorio', accion: 'cumpleanos' },
  // Vouchers y lectura IA (vch-api)
  { modulo: 'vouchers', accion: 'subir' },
  { modulo: 'vouchers', accion: 'ver' },
  // Control de asistencia: marcar (todo el personal con horario), reportes y correcciones (solo ADMIN),
  // pantalla del QR del local (solo ADMIN por defecto)
  { modulo: 'asistencia', accion: 'marcar' },
  { modulo: 'asistencia', accion: 'administrar' },
  { modulo: 'asistencia', accion: 'pantalla' },
  // Mascota Capri (mas-api)
  { modulo: 'mascota', accion: 'ver' },
  { modulo: 'mascota', accion: 'editar' },
  // Propinas (acumulado del mes, solo lectura)
  { modulo: 'propinas', accion: 'ver' },
  // Reparto mensual de propinas por horas (cálculo, aprobación, pago y anulación): solo ADMIN
  { modulo: 'propinas', accion: 'repartir' },
] as const;

export const MATRIZ: Record<string, string[]> = {
  ADMIN: PERMISOS.map((p) => `${p.modulo}/${p.accion}`),
  // Caja y cobro, anular pedidos (junto con ADMIN, los únicos), cocina y carta en solo lectura. Escritorio no tiene permiso propio.
  CAJERO: [
    // Chat de WhatsApp (Mensajes): lo atienden MOZO y CAJERO (antes el rol CALLCENTER, eliminado)
    'mensajes/ver',
    'mensajes/tomar',
    'mensajes/enviar',
    'mensajes/cerrar',
    'whatsapp_salientes/ver',
    'whatsapp_salientes/reenviar',
    'whatsapp_salientes/descartar',
    'cupones/canjear', // canje en caja (antes solo lo tenía el rol CALLCENTER, eliminado)
    'almacen/apertura',
    'pedidos/ver',
    'pedidos/crear',
    'pedidos/cambiar_estado',
    'pedidos/anular', // anular pedidos: todos los roles de pedidos, cada uno en su alcance (orden del dueño 08/11)
    'pedidos/cambiar_ubicacion',
    'pedidos/validar_cambio_cobro',
    'pedidos/ajustar_pago',
    'pedidos/editar',
    'pedidos/corregir_cliente',
    'pedidos/imprimir_precuenta',
    'pedidos/extra',
    'cortesias/dar',
    'cortesias/ver',
    'creditos/cobrar_ahora',
    'caja/abrir',
    'caja/cobrar',
    'caja/movimientos',
    'caja/cerrar',
    'caja/ver',
    'propinas/ver',
    'cocina/ver',
    'cocina/despacho',
    'catalogo/ver',
    // Iniciativas: todo el personal ve, crea y comenta (el cambio de estado es solo ADMIN y SUPERVISOR)
    'iniciativas/ver',
    'iniciativas/crear',
    'iniciativas/comentar',
    'comprobantes/ver',
    'comprobantes/reimprimir',
    'mesas/ver',
    'mesas/abrir',
    'mesas/liberar',
    'repartos/ver',
    'repartos/seguir',
    'repartos/ver_ubicacion',
    'repartos/liquidar',
    'vouchers/subir',
    'vouchers/ver',
  ],
  COCINA: [
    'almacen/apertura',
    'almacen/merma_producto',
    'pedidos/ver',
    'pedidos/cambiar_estado',
    'pedidos/anular',
    'cocina/ver',
    'cocina/despejar',
    'cocina/despachar',
    'cocina/despacho',
    'cocina/devolver',
    'cocina/agotar',
    'cocina/demanda',
    'stock/ver',
    'almacen/ver',
    'almacen/movimientos',
    'almacen/pedidos_internos',
    'almacen/traslados',
    'almacen/cierre',
    'produccion/ver',
    'produccion/crear',
    'produccion/anular',
    'iniciativas/ver',
    'iniciativas/crear',
    'iniciativas/comentar',
    'notificaciones/ver',
    'notificaciones/marcar',
  ],
  MOZO: [
    'pedidos/ajustar_pago', // solo sus pedidos (lo valida el servicio)
    // Chat de WhatsApp (Mensajes): lo atienden MOZO y CAJERO (antes el rol CALLCENTER, eliminado)
    'mensajes/ver',
    'mensajes/tomar',
    'mensajes/enviar',
    'mensajes/cerrar',
    'whatsapp_salientes/ver',
    'whatsapp_salientes/reenviar',
    'whatsapp_salientes/descartar',
    'pedidos/crear',
    'pedidos/anular', // cualquier pedido (decisión del dueño 09/11)
    'pedidos/imprimir_precuenta', // precuenta de sus mesas desde la tablet: encola el ticket, no cobra
    'pedidos/corregir_cliente', // corrige celular/nombre/dirección de cualquier pedido vigente
    'pedidos/editar', // cualquier pedido aún sin cobrar, no solo los suyos (decisión del dueño)
    'pedidos/extra', // agrega un extra a cualquier pedido vigente, con su propio pago y comprobante
    'cortesias/dar', // libre: cualquier pedido sin cobrar; queda auditada con quién y por qué (decisión del dueño)
    'creditos/cobrar_ahora', // cobra al trabajador en el momento (pedido del personal); queda quién cobró
    'plano/ver',
    'mesas/ver',
    'mesas/abrir',
    'mesas/liberar',
    'cocina/despachar',
    'repartos/seguir',
    'reservas/ver',
    'reservas/crear',
    'reservas/editar',
    'iniciativas/ver',
    'iniciativas/crear',
    'iniciativas/comentar',
    'notificaciones/ver',
    'notificaciones/marcar',
    'vouchers/subir',
  ],
  ALMACEN: [
    'stock/ver',
    'stock/editar',
    'stock/movimientos',
    'almacen/ver',
    'almacen/movimientos',
    'almacen/traslados',
    'almacen/pedidos_internos',
    'almacen/cierre',
    'almacen/apertura',
    'compras/ver',
    'compras/crear',
    'proveedores/ver',
    'proveedores/crear',
    'proveedores/editar',
    'pedidos_proveedor/ver',
    'pedidos_proveedor/crear',
    'pedidos_proveedor/anular',
    'produccion/ver',
    'produccion/crear',
    'produccion/anular',
    'iniciativas/ver',
    'iniciativas/crear',
    'iniciativas/comentar',
    'notificaciones/ver',
    'notificaciones/marcar',
  ],
  REPARTIDOR: [
    'pedidos/anular', // solo los asignados a él (NO_ASIGNADO en el servicio)
    'repartos/ver',
    'repartos/tomar',
    'repartos/entregar',
    'repartos/reportar',
    'repartos/chat',
    'repartos/proponer_ubicacion',
    'repartos/solicitar_cambio_cobro',
    'pedidos/ajustar_pago', // solo los pedidos asignados a él (lo valida el servicio)
    'iniciativas/ver',
    'iniciativas/crear',
    'iniciativas/comentar',
    'notificaciones/ver',
    'notificaciones/marcar',
  ],
  // Apoyo en delivery (rol extra): lo del repartidor más seguir. SIN repartos/liquidar: ese permiso también liquida
  // el efectivo de los repartidores (cierre) y reasigna; es dinero y queda en Caja y ADMIN.
  // No se combina con ADMIN (ya lo tiene todo) pero sí con cualquier otro rol, a diferencia de REPARTIDOR.
  APOYO_DELIVERY: [
    'pedidos/anular',
    'repartos/ver',
    'repartos/seguir',
    'repartos/tomar',
    'repartos/entregar',
    'repartos/reportar',
    'repartos/chat',
    'repartos/proponer_ubicacion',
    'repartos/solicitar_cambio_cobro',
    'pedidos/ajustar_pago', // solo los asignados a él
    'notificaciones/ver',
    'notificaciones/marcar',
  ],
};

// Marcar asistencia desde el celular: todo el personal que puede tener horario (no el ADMIN, que ya lo tiene todo)
for (const rol of ['CAJERO', 'COCINA', 'MOZO', 'ALMACEN', 'REPARTIDOR']) {
  MATRIZ[rol] = [...MATRIZ[rol], 'asistencia/marcar'];
}

// Supervisor: la unión de lo que tienen CAJERO y MOZO.
// No recibe diseño de carta, Novedades, informes, usuarios, configuración ni compras (ver la tabla del informe).
// Y su escritorio operativo (conteos, sin montos).
// El conteo de apertura (almacen/apertura) no lo tiene el supervisor: sin administración de stock.
// Iniciativas: cambiar el estado (NUEVA, EN_REVISION, HECHA, NO_POR_AHORA) lo tienen ADMIN y SUPERVISOR.
MATRIZ.SUPERVISOR = [
  ...new Set([...MATRIZ.CAJERO, ...MATRIZ.MOZO, 'escritorio/operativo', 'escritorio/cumpleanos', 'iniciativas/cambiar_estado', 'mensajes/bloquear_numeros']),
].filter(
  // Sin dinero: el supervisor no cambia ubicación con cobro, ni canjea cupones, ni cobra al personal al instante, ni hace el conteo de apertura
  (p) => p !== 'almacen/apertura' && p !== 'pedidos/cambiar_ubicacion' && p !== 'cupones/canjear' && p !== 'creditos/cobrar_ahora',
);


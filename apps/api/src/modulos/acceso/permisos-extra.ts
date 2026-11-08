import { PERMISOS } from './permisos';

/** Permisos que NO se delegan por la vía de «permisos extra» salvo ADMIN con confirmación fuerte (gestión de personas, dinero, configuración, facturación y acciones destructivas). */
export const PERMISOS_SENSIBLES: readonly string[] = [
  'usuarios/crear', 'usuarios/editar', 'usuarios/desactivar', 'usuarios/reactivar', 'usuarios/restablecer',
  'configuracion/ver', 'configuracion/editar',
  'auditoria/ver',
  'creditos/saldar',
  'pedidos/anular',
  'comprobantes/emitir', 'comprobantes/anular',
  'puntos/ajustar',
  'compras/anular', 'compras/pagar', 'pedidos_proveedor/anular', 'produccion/anular',
  'destacadas/eliminar',
  'asistencia/administrar',
  'pantallas/vincular', 'pantallas/desactivar',
  'repartos/liquidar',
];

export const CATALOGO_PERMISOS: ReadonlySet<string> = new Set(PERMISOS.map((p) => `${p.modulo}/${p.accion}`));

export const esSensible = (clave: string): boolean => PERMISOS_SENSIBLES.includes(clave);

/** Nombre llano de cada módulo de permisos (como en el menú del admin). Lo que no esté aquí se muestra con su código. */
export const NOMBRES_MODULO: Record<string, string> = {
  usuarios: 'Usuarios', configuracion: 'Configuración', auditoria: 'Auditoría', catalogo: 'Productos', local: 'Datos del local',
  archivos: 'Archivos', pedidos: 'Pedidos', zonas: 'Zonas de reparto', caja: 'Caja', repartos: 'Repartos', cortesias: 'Cortesías',
  cocina: 'Cocina', stock: 'Stock', recetas: 'Recetas', plano: 'Plano del salón', mesas: 'Mesas', reservas: 'Reservas',
  comprobantes: 'Comprobantes', reclamos: 'Reclamos', ofertas: 'Ofertas', cupones: 'Cupones', clientes: 'Clientes', puntos: 'Puntos',
  compras: 'Compras', proveedores: 'Proveedores', pedidos_proveedor: 'Pedidos a proveedor', almacen: 'Almacén', produccion: 'Producción',
  creditos: 'Créditos', iniciativas: 'Iniciativas', mensajes: 'Mensajes de WhatsApp', whatsapp_salientes: 'Avisos de WhatsApp enviados',
  encuestas: 'Encuestas', informes: 'Reportes', indicadores: 'Indicadores', notificaciones: 'Notificaciones', carta_diseno: 'Diseñador de la carta',
  novedades: 'Novedades', destacadas: 'Destacadas', mensajes_carta: 'Mensajes de la carta', pantallas: 'Pantallas', escritorio: 'Escritorio',
  vouchers: 'Vouchers', asistencia: 'Asistencia', mascota: 'Mascota', propinas: 'Propinas',
};

export const NOMBRES_ACCION: Record<string, string> = {
  ver: 'Ver', crear: 'Crear', editar: 'Editar', anular: 'Anular', exportar: 'Exportar', saldar: 'Saldar deudas', cobrar: 'Cobrar',
  cobrar_ahora: 'Cobrar al momento', enviar: 'Enviar mensajes', tomar: 'Tomar', cerrar: 'Cerrar', abrir: 'Abrir', movimientos: 'Movimientos',
  desactivar: 'Desactivar', reactivar: 'Reactivar', restablecer: 'Restablecer claves', pagar: 'Pagar', reimprimir: 'Reimprimir', emitir: 'Emitir',
  agotar: 'Marcar agotado', ocultar: 'Ocultar', publicar: 'Publicar', liquidar: 'Liquidar', apertura: 'Apertura del día', cierre: 'Cierre',
  traslados: 'Traslados', cambiar_estado: 'Cambiar estado', ajustar: 'Ajustar', responder: 'Responder',
};

export const nombreAccion = (a: string): string => NOMBRES_ACCION[a] ?? a.replace(/_/g, ' ');

import { LIBRE, PERMISOS_POR_PREFIJO, PERMISOS_POR_TIPO } from './permisos-por-tipo';

/**
 * «Avisos por rol» (Configuración): qué rol VE cada tipo de aviso en su campanita. Guardado en el parámetro
 * `notificaciones_por_rol` como { [tipo]: [roles] }. Los tipos con sufijo variable llevan su prefijo como clave
 * (`FACTURACION:`). Un tipo que no esté en el catálogo solo lo ve el ADMIN. Los avisos dirigidos a una persona
 * (party_destino) no pasan por esta tabla: los ve solo esa persona.
 */
export const CLAVE_AVISOS_POR_ROL = 'notificaciones_por_rol';

export const ROLES_AVISO = [
  'ADMIN', 'CAJERO', 'SUPERVISOR', 'COCINA', 'MOZO', 'ALMACEN', 'REPARTIDOR', 'APOYO_DELIVERY', 'MARKETING',
] as const;

export type AvisosPorRol = Record<string, string[]>;

export interface TipoAviso {
  /** Clave del tipo (o prefijo terminado en «:») */
  tipo: string;
  nombre: string;
  detalle: string;
}

export const CATALOGO_AVISOS: TipoAviso[] = [
  { tipo: 'PEDIDO_NUEVO', nombre: 'Pedido nuevo', detalle: 'Entró un pedido desde la carta web.' },
  { tipo: 'PEDIDO_POR_CONFIRMAR', nombre: 'Pedido por confirmar', detalle: 'Un pedido espera que alguien lo confirme.' },
  { tipo: 'PEDIDOS_SIN_PAGAR_TOPE', nombre: 'Cliente con muchos pedidos sin pagar', detalle: 'Un cliente llegó al tope de pedidos sin pagar.' },
  { tipo: 'UBICACION_PROPUESTA', nombre: 'Ubicación propuesta por el cliente', detalle: 'El cliente mandó su ubicación y Caja debe aceptarla.' },
  { tipo: 'ANULACION_SIN_DEVOLUCION', nombre: 'Anulación sin devolución', detalle: 'Se anuló un pedido pagado sin devolver el dinero.' },
  { tipo: 'CAJA_CERRADA_APERTURA', nombre: 'Caja cerrada con pedidos', detalle: 'Entra un pedido y la caja del día no está abierta.' },
  { tipo: 'PAGO_EFECTIVO_MOZO', nombre: 'Pago en efectivo del mozo', detalle: 'Un mozo cobró en efectivo y debe entregar el dinero.' },
  { tipo: 'PAGO_SIN_CAPTURA_MOZO', nombre: 'Pago del mozo sin captura', detalle: 'Un mozo registró un pago digital sin foto del voucher.' },
  { tipo: 'CAMBIO_COBRO_SOLICITADO', nombre: 'Cambio de cobro por validar', detalle: 'Alguien pide cambiar el medio de pago de un pedido.' },
  { tipo: 'CAMBIO_COBRO_APLICADO', nombre: 'Cambio de cobro aplicado', detalle: 'Se cambió el medio de pago de un pedido.' },
  { tipo: 'CAMBIO_COBRO_RESUELTO', nombre: 'Cambio de cobro resuelto', detalle: 'Se resolvió una solicitud de cambio de cobro.' },
  { tipo: 'REPROG_COBRAR_RECARGO', nombre: 'Cobrar recargo por reprogramar', detalle: 'Un delivery reprogramado tiene un recargo por cobrar.' },
  { tipo: 'COMPROBANTE_PENDIENTE', nombre: 'Comprobante pendiente', detalle: 'Hay comprobantes electrónicos por emitir.' },
  { tipo: 'COMPROBANTE_RECIBIDO', nombre: 'Comprobante recibido por WhatsApp', detalle: 'Un cliente envió su comprobante de pago por WhatsApp.' },
  { tipo: 'COMPROBANTE_NO_GUARDADO', nombre: 'Comprobante no guardado', detalle: 'Llegó un comprobante por WhatsApp y no se pudo guardar.' },
  { tipo: 'FACTURACION:', nombre: 'Facturación electrónica', detalle: 'Alertas de SUNAT: certificado por vencer, envíos rechazados.' },
  { tipo: 'RESERVA_NUEVA', nombre: 'Reserva nueva', detalle: 'Un cliente pidió una reserva.' },
  { tipo: 'RESERVA_CANCELADA', nombre: 'Reserva cancelada', detalle: 'Un cliente canceló su reserva.' },
  { tipo: 'RECLAMO_CARTA', nombre: 'Reclamo desde la carta', detalle: 'Un cliente dejó un reclamo en el libro de reclamaciones.' },
  { tipo: 'QUEJA_WHATSAPP', nombre: 'Queja por WhatsApp', detalle: 'Un cliente se quejó por WhatsApp.' },
  { tipo: 'VOUCHER_ILEGIBLE', nombre: 'Voucher ilegible', detalle: 'La foto de un voucher no se puede leer.' },
  { tipo: 'VOUCHER_PENDIENTE_MOZO', nombre: 'Voucher del mozo por revisar', detalle: 'Un mozo subió un voucher que Caja debe revisar.' },
  { tipo: 'VOUCHER_IA_CAIDA', nombre: 'Lectura de vouchers con IA en pausa', detalle: 'La IA que lee vouchers dejó de responder.' },
  { tipo: 'VOUCHER_IA_RECUPERADA', nombre: 'Lectura de vouchers con IA recuperada', detalle: 'La IA de vouchers volvió a funcionar.' },
  { tipo: 'VOUCHER_IA_TOPE', nombre: 'Tope mensual de IA de vouchers', detalle: 'La lectura de vouchers llegó a su tope del mes.' },
  { tipo: 'STOCK_BAJO', nombre: 'Stock bajo', detalle: 'Un insumo está por agotarse.' },
  { tipo: 'DELIVERY_POR_CONFIRMAR', nombre: 'Delivery por confirmar', detalle: 'Un delivery espera confirmación de reparto.' },
  { tipo: 'REPROGRAMACION_DELIVERY', nombre: 'Delivery reprogramado', detalle: 'Un cliente reprogramó su delivery.' },
  { tipo: 'REPROGRAMACION_CANCELADA', nombre: 'Reprogramación cancelada', detalle: 'Un cliente canceló la reprogramación de su delivery.' },
  { tipo: 'RETIRO_MOVILIDAD', nombre: 'Retiro de movilidad', detalle: 'El cliente retira su pedido o la movilidad se retira.' },
  { tipo: 'ESPERA_AGOTADA', nombre: 'Espera de delivery agotada', detalle: 'Se agotó la espera de un delivery sin repartidor.' },
  { tipo: 'MESA_LISTA', nombre: 'Mesa lista para llevar', detalle: 'El pedido de una mesa está listo para llevarlo.' },
  { tipo: 'ATENCION_WHATSAPP', nombre: 'Atención en WhatsApp', detalle: 'Un cliente necesita que una persona le responda por WhatsApp.' },
  { tipo: 'CHAT_SIN_RESPUESTA', nombre: 'Chat sin respuesta', detalle: 'Un chat de WhatsApp lleva demasiado sin respuesta.' },
  { tipo: 'CHAT_BLOQUEADO_SPAM', nombre: 'Chat bloqueado por spam', detalle: 'El bot bloqueó un número por mandar demasiados mensajes.' },
  { tipo: 'WHATSAPP_ALERTA', nombre: 'Alerta de WhatsApp', detalle: 'Un cliente espera respuesta o se acaba la ventana de 24 horas.' },
  { tipo: 'ALERTA_INTERNA', nombre: 'Alerta interna', detalle: 'Avisos del sistema para administración (por ejemplo, agotados).' },
  { tipo: 'ERROR_IMPRESORA', nombre: 'Error de impresora', detalle: 'Una impresora falló al imprimir.' },
  { tipo: 'IMPRESORA_SIN_CONEXION', nombre: 'Impresora sin conexión', detalle: 'Una impresora no responde.' },
  { tipo: 'WHATSAPP_CONSUMO', nombre: 'Mensajes de WhatsApp del mes', detalle: 'Se acerca el límite gratuito de mensajes de WhatsApp.' },
  { tipo: 'REDIS_CAIDO', nombre: 'Servicio de apoyo caído', detalle: 'El servicio de tiempo real dejó de responder.' },
  { tipo: 'REDIS_RECUPERADO', nombre: 'Servicio de apoyo recuperado', detalle: 'El servicio de tiempo real volvió.' },
  { tipo: 'APRENDIZAJES_PROPUESTAS', nombre: 'Propuestas del bot', detalle: 'El bot propone respuestas nuevas para revisar.' },
  { tipo: 'TURNO_PEDIDO', nombre: 'Pedido de cambio de turno', detalle: 'Un compañero te pide cubrir o cambiar un turno.' },
  { tipo: 'TURNO_POR_APROBAR', nombre: 'Reemplazo por aprobar', detalle: 'Un reemplazo aceptó y espera la aprobación de Supervisión.' },
  { tipo: 'TURNO_RESUELTO', nombre: 'Cambio de turno resuelto', detalle: 'Se aprobó, rechazó o canceló un cambio de turno.' },
  { tipo: 'TURNO_SIN_MARCA', nombre: 'Reemplazo que no marcó', detalle: 'Quien debía cubrir un turno no marcó asistencia.' },
  { tipo: 'MENSAJE_INTERNO', nombre: 'Mensaje interno', detalle: 'Mensajes que el equipo se envía; si van a un rol, solo ese rol los lee.' },
];

const CAJA = ['ADMIN', 'CAJERO', 'SUPERVISOR'];
const SOLO_ADMIN = ['ADMIN'];
/**
 * A qué roles se envían HOY esos tipos (campo rol_destino con que el código los crea). El SUPERVISOR hereda lo del CAJERO.
 * Sirve solo para calcular el valor por defecto = lo que cada rol ve antes de que el ADMIN toque la tabla.
 */
const DESTINO_HABITUAL: Record<string, string[]> = {
  ANULACION_SIN_DEVOLUCION: CAJA,
  CAJA_CERRADA_APERTURA: CAJA,
  PAGO_EFECTIVO_MOZO: CAJA,
  PAGO_SIN_CAPTURA_MOZO: CAJA,
  CAMBIO_COBRO_APLICADO: CAJA,
  CAMBIO_COBRO_RESUELTO: CAJA,
  REPROG_COBRAR_RECARGO: CAJA,
  UBICACION_PROPUESTA: CAJA,
  COMPROBANTE_RECIBIDO: CAJA,
  COMPROBANTE_NO_GUARDADO: CAJA,
  QUEJA_WHATSAPP: CAJA,
  VOUCHER_ILEGIBLE: CAJA,
  VOUCHER_PENDIENTE_MOZO: CAJA,
  REPROGRAMACION_DELIVERY: CAJA,
  REPROGRAMACION_CANCELADA: CAJA,
  RETIRO_MOVILIDAD: CAJA,
  ESPERA_AGOTADA: CAJA,
  'FACTURACION:': SOLO_ADMIN,
  VOUCHER_IA_CAIDA: SOLO_ADMIN,
  VOUCHER_IA_RECUPERADA: SOLO_ADMIN,
  VOUCHER_IA_TOPE: SOLO_ADMIN,
  ALERTA_INTERNA: SOLO_ADMIN,
  WHATSAPP_CONSUMO: SOLO_ADMIN,
  REDIS_CAIDO: SOLO_ADMIN,
  REDIS_RECUPERADO: SOLO_ADMIN,
  APRENDIZAJES_PROPUESTAS: SOLO_ADMIN,
  MESA_LISTA: ['ADMIN', 'MOZO'],
  TURNO_POR_APROBAR: ['ADMIN', 'SUPERVISOR'],
  TURNO_SIN_MARCA: ['ADMIN', 'SUPERVISOR'],
};

const permisosDe = (tipo: string): string[] => PERMISOS_POR_TIPO[tipo] ?? PERMISOS_POR_PREFIJO[tipo] ?? [];

/** Clave del catálogo a la que pertenece un tipo guardado (el tipo mismo o su prefijo); undefined si no está. */
export const claveDeAviso = (tipo: string): string | undefined =>
  CATALOGO_AVISOS.some((a) => a.tipo === tipo)
    ? tipo
    : CATALOGO_AVISOS.find((a) => a.tipo.endsWith(':') && tipo.startsWith(a.tipo))?.tipo;

/**
 * Roles que ven un tipo por defecto (= comportamiento anterior): ADMIN siempre; el resto, con alguno de los permisos
 * del tipo y dentro del destino habitual del aviso. `tiene(rol, permiso)` dice si ese rol tiene el permiso.
 */
export function rolesPorDefecto(tipo: string, tiene: (rol: string, permiso: string) => boolean): string[] {
  const permisos = permisosDe(tipo);
  const destino = DESTINO_HABITUAL[tipo];
  return ROLES_AVISO.filter(
    (rol) =>
      rol === 'ADMIN' ||
      ((!destino || destino.includes(rol)) && permisos.some((p) => p === LIBRE || tiene(rol, p))),
  );
}

export const defectoAvisos = (tiene: (rol: string, permiso: string) => boolean): AvisosPorRol =>
  Object.fromEntries(CATALOGO_AVISOS.map((a) => [a.tipo, rolesPorDefecto(a.tipo, tiene)]));

/** Lee lo guardado; ignora lo que no cuadre (tipos o roles desconocidos). */
export function leerAvisosGuardados(valor: unknown): AvisosPorRol {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
  const salida: AvisosPorRol = {};
  for (const a of CATALOGO_AVISOS) {
    const v = (valor as Record<string, unknown>)[a.tipo];
    if (Array.isArray(v)) salida[a.tipo] = ROLES_AVISO.filter((r) => v.includes(r));
  }
  return salida;
}

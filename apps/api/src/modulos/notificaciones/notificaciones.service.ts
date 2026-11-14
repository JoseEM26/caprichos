import { pedidoVivoDeHoy } from '../../comun/fechas-lima';
import { createHash } from 'crypto';
import { coincideTexto } from '../../comun/normalizar-busqueda';
import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { controlAlmacenActivo } from '../stock/control-almacen';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AsistenciaCorreccionesService } from '../asistencia/asistencia-correcciones.service';
import { AvisosPorRol, CATALOGO_AVISOS, CLAVE_AVISOS_POR_ROL, ROLES_AVISO, defectoAvisos, leerAvisosGuardados, rolesPorDefecto } from './avisos-por-rol';
import { AjustesNotificaciones, CLAVES_AJUSTES_NOTIF, leerAjustesNotificacion } from './ajustes-notificaciones';

import { minutosDeHora, momentoLima } from '../correo';
import { SonidoHorario, sonidoPorHorario } from './sonido-horario.util';
export type Prioridad = 'ALTA' | 'MEDIA' | 'BAJA';

export interface Notificacion {
  id: string;
  /** Clave para marcar leída: `n:<id>` (guardada) o `c:<tipo>:<firma>` (calculada; cambia si cambia su contenido) */
  clave: string;
  titulo: string;
  detalle: string;
  prioridad: Prioridad;
  /** Desde cuándo está pendiente (ISO); en las guardadas, cuándo se creó */
  desde: string | null;
  /** Módulo del administrativo donde se resuelve (clave de modulos.ts) */
  modulo: string;
  accion: string;
  ruta?: string;
  /** Leída por ESTE usuario (cada persona tiene su propio estado) */
  leida: boolean;
  leidaEn: string | null;
}

export interface ResumenNotificaciones {
  /** Contadores para las insignias del menú, por clave de módulo */
  conteos: Record<string, number>;
  /** Primero las no leídas (urgentes primero, las más nuevas arriba); después las leídas de las últimas 24 h */
  notificaciones: Notificacion[];
  /** Sonido y «Marcar todas leídas»: los lee la web sin recargar */
  ajustes: AjustesNotificaciones;
}

export const TIPOS_NOTIFICACION: Record<string, string> = {
  PEDIDO_NUEVO: 'Pedido nuevo',
  RESERVA_NUEVA: 'Reserva nueva',
  RESERVA_CANCELADA: 'Reserva cancelada',
  ALERTA_INTERNA: 'Alerta interna',
  ATENCION_WHATSAPP: 'Atención en WhatsApp',
  PEDIDO_POR_CONFIRMAR: 'Pedido por confirmar',
  DELIVERY_POR_CONFIRMAR: 'Delivery por confirmar',
  STOCK_BAJO: 'Stock bajo',
  ERROR_IMPRESORA: 'Error de impresora',
  COMPROBANTE_PENDIENTE: 'Comprobante pendiente',
  MENSAJE_INTERNO: 'Mensaje interno',
  PAGO_EFECTIVO_MOZO: 'Pago en efectivo del mozo',
  VOUCHER_PENDIENTE_MOZO: 'Voucher del mozo por revisar',
  IMPRESORA_SIN_CONEXION: 'Impresora sin conexión',
  VOUCHER_IA_CAIDA: 'Lectura de vouchers con IA en pausa',
  VOUCHER_IA_RECUPERADA: 'Lectura de vouchers con IA recuperada',
  VOUCHER_IA_TOPE: 'Tope mensual de IA de vouchers',
  WHATSAPP_CONSUMO: 'Mensajes de WhatsApp del mes',
  APRENDIZAJES_PROPUESTAS: 'Propuestas del bot',
};

export const COLORES_NOTIFICACION: Record<string, string> = {
  'Lectura de vouchers con IA en pausa': '#B5442E',
  'Lectura de vouchers con IA recuperada': '#2F7A45',
  'Tope mensual de IA de vouchers': '#C99A2E',
  'Mensajes de WhatsApp del mes': '#C99A2E',
  'Pedido nuevo': '#E2812C',
  'Reserva nueva': '#E2812C',
  'Reserva cancelada': '#B5442E',
  'Alerta interna': '#B5442E',
  'Atención en WhatsApp': '#B5442E',
  'Pedido por confirmar': '#E2812C',
  'Delivery por confirmar': '#E2812C',
  'Stock bajo': '#C99A2E',
  'Error de impresora': '#B5442E',
  'Comprobante pendiente': '#0B2C3E',
  'Mensaje interno': '#6B7F8C',
  'Pago en efectivo del mozo': '#0B2C3E',
  'Voucher del mozo por revisar': '#0B2C3E',
  'Impresora sin conexión': '#B5442E',
};

export const ACCIONES_NOTIFICACION: Record<string, [string, string]> = {
  'Pedido nuevo': ['caja', 'Ir a Caja'],
  'Reserva nueva': ['reservas', 'Ir a Reservas'],
  'Reserva cancelada': ['reservas', 'Ir a Reservas'],
  'Atención en WhatsApp': ['mensajes', 'Ir a Mensajes'],
  'Pedido por confirmar': ['caja', 'Ir a Caja'],
  'Delivery por confirmar': ['repartos', 'Ir a Repartos'],
  'Pago en efectivo del mozo': ['caja', 'Ir a Caja'],
  'Voucher del mozo por revisar': ['caja', 'Ir a Caja'],
  'Stock bajo': ['stock', 'Ver stock'],
  'Error de impresora': ['mirest', 'Ver configuración'],
  'Comprobante pendiente': ['caja', 'Ir a Caja'],
  'Impresora sin conexión': ['caja', 'Ir a Caja'],
  'Lectura de vouchers con IA en pausa': ['mirest', 'Ver configuración'],
  'Lectura de vouchers con IA recuperada': ['mirest', 'Ver configuración'],
  'Tope mensual de IA de vouchers': ['mirest', 'Ver configuración'],
  'Mensajes de WhatsApp del mes': ['mirest', 'Ver configuración'],
};

/** Prioridad de un aviso guardado según su tipo (la tabla no guarda prioridad). Por defecto, MEDIA. */
const PRIORIDAD_POR_TIPO: Record<string, Prioridad> = {
  PEDIDO_NUEVO: 'ALTA',
  RESERVA_NUEVA: 'ALTA',
  ATENCION_WHATSAPP: 'ALTA',
  PAGO_EFECTIVO_MOZO: 'ALTA',
  VOUCHER_PENDIENTE_MOZO: 'ALTA',
  CAMBIO_COBRO_SOLICITADO: 'ALTA',
  CAMBIO_COBRO_APLICADO: 'MEDIA',
  TURNO_PEDIDO: 'ALTA',
  TURNO_POR_APROBAR: 'ALTA',
  TURNO_SIN_MARCA: 'ALTA',
  ERROR_IMPRESORA: 'ALTA',
  IMPRESORA_SIN_CONEXION: 'ALTA',
  WHATSAPP_CONSUMO: 'BAJA',
  VOUCHER_IA_RECUPERADA: 'BAJA',
};

const prioridadDeTipo = (tipo: string): Prioridad => PRIORIDAD_POR_TIPO[tipo] ?? 'MEDIA';

/**
 * Condición de Prisma de lo que ESTE usuario puede ver de las guardadas (una sola regla para resumen, historial,
 * contadores, marcar leída y marcar todas). `claves` = tipos del catálogo «Avisos por rol» que alguno de sus roles
 * tiene marcados:
 *  - dirigido a una persona (party_destino): solo esa persona (ni siquiera el ADMIN: es un aviso personal);
 *  - lo demás (sin persona): solo de los tipos marcados para sus roles; un tipo fuera del catálogo solo lo ve el ADMIN;
 *  - MENSAJE_INTERNO además respeta su rol_destino (el ADMIN lo ve siempre).
 */
export const visibleA = (
  usuario: UsuarioAutenticado,
  claves: string[],
  condicion: Prisma.NotificacionWhereInput = {},
): Prisma.NotificacionWhereInput => {
  const roles = usuario.roles ?? [usuario.rol];
  const esAdmin = roles.includes('ADMIN') || usuario.rol === 'ADMIN';
  const prefijos = claves.filter((c) => c.endsWith(':'));
  const tipos = claves.filter((c) => !c.endsWith(':'));
  const interno = tipos.includes('MENSAJE_INTERNO');
  const porRol: Prisma.NotificacionWhereInput = {
    OR: [{ rol_destino: null }, { rol_destino: { in: ROLES_QUE_VE(roles) } }],
  };
  const porTipo: Prisma.NotificacionWhereInput[] = [
    { tipo: { in: tipos.filter((t) => t !== 'MENSAJE_INTERNO') } },
    ...prefijos.map((p) => ({ tipo: { startsWith: p } })),
  ];
  if (interno) porTipo.push(esAdmin ? { tipo: 'MENSAJE_INTERNO' } : { tipo: 'MENSAJE_INTERNO', AND: [porRol] });
  if (esAdmin) {
    // tipo nuevo sin configurar (fuera del catálogo): lo ve el ADMIN
    porTipo.push({
      tipo: { notIn: CATALOGO_AVISOS.filter((a) => !a.tipo.endsWith(':')).map((a) => a.tipo) },
      NOT: { OR: CATALOGO_AVISOS.filter((a) => a.tipo.endsWith(':')).map((a) => ({ tipo: { startsWith: a.tipo } })) },
    });
  }
  return { AND: [{ OR: [{ party_destino: usuario.partyId }, { party_destino: null, OR: porTipo }] }, condicion] };
};

const ORDEN: Record<Prioridad, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
const HORAS_LEIDAS_VISIBLES = 24;
const MAX_LEIDAS_VISIBLES = 30;
const MAX_GUARDADAS_NO_LEIDAS = 100;
const MAX_GUARDADAS_LEIDAS = 100;
const LIMITE_PAGINA = 10;
const MAX_LIMITE_PAGINA = 50;
const CLAVE_VALIDA = /^(n:\d+|c:[a-z-]+:[0-9a-f]{12})$/;

/** Clave de un aviso calculado: cambia con sus ids (o cantidad), así un aviso leído vuelve si cambia. */
const claveCalculada = (tipo: string, valores: Array<string | number | bigint>): string =>
  `c:${tipo}:${createHash('sha1').update(valores.map(String).join('|')).digest('hex').slice(0, 12)}`;

/**
 * Roles cuyos avisos ve cada rol. El SUPERVISOR ve también los del CAJERO (decisión del dueño):
 * la caja es suya y cada uno marca su propio Leído.
 */
const ROLES_QUE_VE = (roles: string[]): string[] =>
  [...new Set(roles.flatMap((rol) => (rol === 'SUPERVISOR' ? ['SUPERVISOR', 'CAJERO'] : [rol])))];

const haceHoras = (horas: number): Date => new Date(Date.now() - horas * 3600000);
const ABIERTOS = ['COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO'];
const ATRASO_COCINA_MIN = 13;

const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`;

const aIsoLima = (d: Date): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
};

const aFechaLima = (d: Date): string => {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
};

const aHoraLima = (d: Date): string => {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return `${d.getUTCHours()}:${d.getUTCMinutes()}`;
  }
};

/**
 * Servicio de Notificaciones: alertas pendientes para la campanita y menú,
 * más historial persistente y mensajes internos entre el equipo.
 */
@Injectable()
export class NotificacionesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditoria?: AuditoriaService,
    @Optional() private readonly eventos?: EventosGateway,
    @Optional() private readonly correcciones?: AsistenciaCorreccionesService,
  ) {}

  private async permisosDe(usuario: UsuarioAutenticado): Promise<(m: string) => boolean> {
    if (usuario.rol === 'ADMIN') return () => true;
    // Unión de permisos de todos sus roles (principal y extra)
    const filas = await this.prisma.rolPermiso.findMany({
      where: { rol: { in: usuario.roles ?? [usuario.rol] } },
      include: { permiso: true },
    });
    const modulos = new Set(filas.map((f) => `${f.permiso.modulo}/${f.permiso.accion}`));
    return (p) => modulos.has(p);
  }

  /** Tipos del catálogo «Avisos por rol» que ven los roles de este usuario (unión); lo no guardado vale el defecto de siempre. */
  private async clavesVisibles(usuario: UsuarioAutenticado, puede: (m: string) => boolean): Promise<string[]> {
    const roles = usuario.roles ?? [usuario.rol];
    const fila = await this.prisma.parametro.findUnique({ where: { clave: CLAVE_AVISOS_POR_ROL } });
    const guardado = leerAvisosGuardados(fila?.valor);
    return CATALOGO_AVISOS.filter((a) => {
      const marcados = guardado[a.tipo] ?? rolesPorDefecto(a.tipo, (r, p) => roles.includes(r) && puede(p));
      return marcados.some((r) => roles.includes(r));
    }).map((a) => a.tipo);
  }

  private soloAdmin(usuario: UsuarioAutenticado) {
    if (!(usuario.roles ?? [usuario.rol]).includes('ADMIN') && usuario.rol !== 'ADMIN') {
      throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo el administrador cambia los avisos por rol' });
    }
  }

  /** Matriz vigente: lo guardado y, donde falte un tipo, el valor por defecto según los permisos actuales de cada rol. */
  private async matrizVigente(): Promise<AvisosPorRol> {
    const fila = await this.prisma.parametro.findUnique({ where: { clave: CLAVE_AVISOS_POR_ROL } });
    const guardado = leerAvisosGuardados(fila?.valor);
    if (CATALOGO_AVISOS.every((a) => guardado[a.tipo])) return guardado;
    const filas = await this.prisma.rolPermiso.findMany({ include: { permiso: true } });
    const tiene = new Set(filas.map((f) => `${f.rol}|${f.permiso.modulo}/${f.permiso.accion}`));
    return { ...defectoAvisos((rol, p) => tiene.has(`${rol}|${p}`)), ...guardado };
  }

  /** Tabla de Configuración › Avisos por rol (solo ADMIN). */
  async avisosPorRol(usuario: UsuarioAutenticado) {
    this.soloAdmin(usuario);
    const matriz = await this.matrizVigente();
    return {
      roles: [...ROLES_AVISO],
      avisos: CATALOGO_AVISOS.map((a) => ({ ...a, roles: matriz[a.tipo] })),
    };
  }

  /** Guarda la tabla completa (solo ADMIN), con auditoría de antes y después. */
  async guardarAvisosPorRol(matriz: Record<string, unknown>, usuario: UsuarioAutenticado, ip?: string) {
    this.soloAdmin(usuario);
    const invalido = (mensaje: string) =>
      new HttpException({ codigo: 'DATOS_INVALIDOS', mensaje }, HttpStatus.BAD_REQUEST);
    if (!matriz || typeof matriz !== 'object' || Array.isArray(matriz)) throw invalido('La tabla de avisos no es válida');
    const nueva: AvisosPorRol = {};
    for (const a of CATALOGO_AVISOS) {
      const v = matriz[a.tipo];
      if (!Array.isArray(v) || v.some((r) => !(ROLES_AVISO as readonly string[]).includes(String(r)))) {
        throw invalido(`Faltan o sobran roles en el aviso «${a.nombre}»`);
      }
      nueva[a.tipo] = ROLES_AVISO.filter((r) => v.includes(r));
    }
    const antes = await this.matrizVigente();
    await this.prisma.parametro.upsert({
      where: { clave: CLAVE_AVISOS_POR_ROL },
      update: { valor: nueva as unknown as Prisma.InputJsonValue },
      create: { clave: CLAVE_AVISOS_POR_ROL, valor: nueva as unknown as Prisma.InputJsonValue },
    });
    await this.auditoria?.registrar({
      categoria: 'CAMBIO',
      modulo: 'configuracion',
      accion: 'AVISOS_POR_ROL',
      resultado: 'OK',
      entidad: 'parametro',
      antes: { clave: CLAVE_AVISOS_POR_ROL, valor: antes },
      despues: { clave: CLAVE_AVISOS_POR_ROL, valor: nueva },
      partyId: usuario.partyId,
      ip,
    });
    // cada panel vuelve a pedir su lista con la regla nueva
    this.eventos?.emitirAdmin('notificaciones:nueva', {});
    return { ok: true };
  }

  /** Estado de lectura de las guardadas para ESTE usuario: id -> leída en (null = no leída explícitamente). */
  private async lecturasGuardadas(partyId: bigint): Promise<Map<string, Date | null>> {
    const filas = await this.prisma.notificacionLectura.findMany({
      where: { party_id: partyId, clave: { startsWith: 'n:' } },
      select: { clave: true, leida_en: true },
    });
    // ponytail: una fila por aviso leído; si crece mucho, filtrar por fecha en la consulta
    return new Map(filas.filter((f) => f.clave.startsWith('n:')).map((f) => [f.clave.slice(2), f.leida_en]));
  }

  /** ¿Debe sonar la campanita ahora para esta persona? (hora de Lima; ver sonido-horario.util) */
  async miHorarioSonido(usuario: UsuarioAutenticado, ahora: Date = new Date()): Promise<SonidoHorario> {
    const roles = usuario.roles ?? [usuario.rol];
    if (roles.includes('ADMIN') || usuario.rol === 'ADMIN') return { suenaAhora: true, texto: null };
    const momento = momentoLima(ahora);
    const [persona, horarios, coberturas] = await Promise.all([
      this.prisma.person.findUnique({ where: { party_id: usuario.partyId }, select: { horario_24_7: true } }),
      this.prisma.horarioTrabajo.findMany({ where: { party_id: usuario.partyId, activo: true }, select: { dia_semana: true, entrada: true, salida: true } }),
      this.prisma.coberturaTurno.findMany({
        where: { fecha: new Date(`${momento.fecha}T00:00:00.000Z`), cubre_party_id: usuario.partyId },
        select: { desde: true, hasta: true },
      }),
    ]);
    return sonidoPorHorario(momento, {
      esAdmin: false,
      h247: Boolean(persona?.horario_24_7),
      horarios: horarios.map((h) => ({ dia: h.dia_semana, entrada: minutosDeHora(h.entrada), salida: minutosDeHora(h.salida) })),
      coberturas: coberturas.map((c) => ({ desde: minutosDeHora(c.desde), hasta: minutosDeHora(c.hasta) })),
    });
  }

  async resumen(usuario: UsuarioAutenticado): Promise<ResumenNotificaciones> {
    const puede = await this.permisosDe(usuario);
    const avisosVisibles = await this.clavesVisibles(usuario, puede);
    const ahora = Date.now();
    const ahoraIso = new Date(ahora).toISOString();
    const conteos: Record<string, number> = {};
    // Avisos calculados al vuelo (sin fila propia): su clave lleva la firma de su contenido
    const calculadas: Omit<Notificacion, 'leida' | 'leidaEn'>[] = [];

    if (puede('caja/ver') || puede('pedidos/ver')) {
      const porCobrar = await this.prisma.pedido.findMany({
        where: { estado: { in: ABIERTOS }, pago_estado: { not: 'PAGADO' }, es_personal: false },
        select: { id: true, creado_en: true },
        orderBy: { creado_en: 'asc' },
      });
      conteos.caja = porCobrar.length;
      if (porCobrar.length) {
        calculadas.push({
          id: 'por-cobrar',
          clave: claveCalculada('por-cobrar', porCobrar.map((p) => p.id)),
          titulo: plural(porCobrar.length, 'pedido por cobrar', 'pedidos por cobrar'),
          detalle: 'Pedidos activos que aún no tienen el cobro registrado.',
          prioridad: ahora - porCobrar[0].creado_en.getTime() > 20 * 60000 ? 'ALTA' : 'MEDIA',
          desde: porCobrar[0].creado_en.toISOString(),
          modulo: 'caja',
          accion: 'Ir a Pedidos y caja',
        });
      }

      const sinUbicar = await this.prisma.pedido.findMany({
        where: { modalidad: 'DELIVERY', entrega_lat: null, estado: { in: ABIERTOS } },
        select: { id: true, creado_en: true },
        orderBy: { creado_en: 'asc' },
      });
      if (sinUbicar.length) {
        calculadas.push({
          id: 'sin-ubicar',
          clave: claveCalculada('sin-ubicar', sinUbicar.map((p) => p.id)),
          titulo: plural(sinUbicar.length, 'delivery sin ubicar', 'delivery sin ubicar'),
          detalle: 'Ningún repartidor puede tomarlos hasta que caja marque el punto en el mapa.',
          prioridad: 'ALTA',
          desde: sinUbicar[0].creado_en.toISOString(),
          modulo: 'caja',
          accion: 'Ubicar pedidos',
        });
      }
    }

    if (puede('cocina/ver')) {
      const enCocina = await this.prisma.pedido.findMany({
        where: { ...pedidoVivoDeHoy(), estado: { in: ['COLA', 'PREPARANDO'] } },
        select: { id: true, creado_en: true },
        orderBy: { creado_en: 'asc' },
      });
      conteos.cocina = enCocina.length;
      const atrasados = enCocina.filter((p) => ahora - p.creado_en.getTime() > ATRASO_COCINA_MIN * 60000);
      if (atrasados.length) {
        calculadas.push({
          id: 'cocina-atrasados',
          clave: claveCalculada('cocina-atrasados', atrasados.map((p) => p.id)),
          titulo: plural(atrasados.length, 'pedido atrasado en cocina', 'pedidos atrasados en cocina'),
          detalle: `Llevan más de ${ATRASO_COCINA_MIN} minutos esperando.`,
          prioridad: 'ALTA',
          desde: atrasados[0].creado_en.toISOString(),
          modulo: 'cocina',
          accion: 'Ir a Cocina',
        });
      }
    }

    if (puede('repartos/ver')) {
      const listos = await this.prisma.pedido.findMany({
        where: { modalidad: 'DELIVERY', estado: 'LISTO', repartidor_party_id: null, motivo_falla: null },
        select: { id: true, creado_en: true, entrega_lat: true },
        orderBy: { creado_en: 'asc' },
      });
      conteos.repartos = listos.length;
      const tomables = listos.filter((p) => p.entrega_lat !== null);
      if (tomables.length) {
        calculadas.push({
          id: 'repartos-listos',
          clave: claveCalculada('repartos-listos', tomables.map((p) => p.id)),
          titulo: plural(tomables.length, 'delivery listo para tomar', 'delivery listos para tomar'),
          detalle: 'Esperan repartidor.',
          prioridad: ahora - tomables[0].creado_en.getTime() > 35 * 60000 ? 'ALTA' : 'MEDIA',
          desde: tomables[0].creado_en.toISOString(),
          modulo: 'repartos',
          accion: 'Ir a Repartos',
        });
      }
    }

    if (puede('comprobantes/ver')) {
      const porEmitir = await this.prisma.comprobante.count({ where: { emision: 'POR_EMITIR' } });
      conteos.comprobantes = porEmitir;
      if (porEmitir) {
        calculadas.push({
          id: 'comprobantes',
          clave: claveCalculada('comprobantes', [porEmitir]),
          titulo: plural(porEmitir, 'comprobante por emitir', 'comprobantes por emitir'),
          detalle: 'Boletas y facturas pendientes de emisión.',
          prioridad: 'BAJA',
          desde: null,
          modulo: 'comprobantes',
          accion: 'Ir a Comprobantes',
        });
      }
    }

    if (puede('reservas/ver')) {
      const solicitudes = await this.prisma.solicitudReserva.findMany({
        where: { estado: 'PENDIENTE' },
        select: { id: true, creado_en: true },
        orderBy: { creado_en: 'asc' },
      });
      conteos.reservas = solicitudes.length;
      if (solicitudes.length) {
        calculadas.push({
          id: 'reservas',
          clave: claveCalculada('reservas', solicitudes.map((p) => p.id)),
          titulo: plural(solicitudes.length, 'solicitud de reserva por revisar', 'solicitudes de reserva por revisar'),
          detalle: 'Reservas pedidas por WhatsApp que esperan aprobación.',
          prioridad: 'ALTA',
          desde: solicitudes[0].creado_en.toISOString(),
          modulo: 'reservas',
          accion: 'Ir a Reservas',
        });
      }
    }

    if (puede('reclamos/ver')) {
      const reclamos = await this.prisma.reclamo.findMany({
        where: { estado: { not: 'RESPONDIDO' } },
        select: { id: true, creado_en: true },
        orderBy: { creado_en: 'asc' },
      });
      conteos.reclamos = reclamos.length;
      if (reclamos.length) {
        calculadas.push({
          id: 'reclamos',
          clave: claveCalculada('reclamos', reclamos.map((p) => p.id)),
          titulo: plural(reclamos.length, 'reclamo sin responder', 'reclamos sin responder'),
          detalle: 'La ley da 15 días hábiles para responder cada reclamo.',
          prioridad: ahora - reclamos[0].creado_en.getTime() > 10 * 24 * 3600000 ? 'ALTA' : 'MEDIA',
          desde: reclamos[0].creado_en.toISOString(),
          modulo: 'reclamos',
          accion: 'Ir a Reclamos',
        });
      }
    }

    // Asistencia: el admin ve las solicitudes de corrección pendientes
    if (this.correcciones && puede('asistencia/administrar')) {
      const pendientes = await this.correcciones.contarPendientes();
      conteos.asistencia = pendientes;
      if (pendientes) {
        calculadas.push({
          id: 'asistencia-solicitudes',
          clave: claveCalculada('asistencia-solicitudes', [pendientes]),
          titulo: plural(pendientes, 'solicitud de corrección de asistencia', 'solicitudes de corrección de asistencia'),
          detalle: 'Compáralas con las marcas y las fotos antes de aprobar o rechazar.',
          prioridad: 'MEDIA',
          desde: ahoraIso,
          modulo: 'asistencia',
          accion: 'Ir a Asistencia',
        });
      }
    }
    // Asistencia: cada persona (no el ADMIN) recibe un aviso por jornada con marcas que no cuadran; leído, no vuelve a sonar
    // ponytail: se calcula al consultar (1 persona x 7 días); si pesara, guardar el resultado del día en una tabla
    if (this.correcciones && puede('asistencia/marcar') && ![usuario.rol, ...(usuario.roles ?? [])].includes('ADMIN')) {
      const sinCorregir = (await this.correcciones.inconsistencias(usuario.partyId)).filter((i) => i.estado === 'SIN_CORREGIR');
      conteos['mi-asistencia'] = sinCorregir.length;
      if (sinCorregir.length) {
        calculadas.push({
          id: 'asistencia-inconsistencias',
          clave: claveCalculada('asistencia-inc', sinCorregir.map((i) => i.jornada)),
          titulo: sinCorregir.length === 1 ? sinCorregir[0].texto : `Tienes ${sinCorregir.length} jornadas con marcas por corregir`,
          detalle: 'Entra a Mi asistencia y envía la hora real: el administrador la aprobará.',
          prioridad: 'ALTA',
          desde: ahoraIso,
          modulo: 'mi-asistencia',
          accion: 'Corregir mi asistencia',
        });
      }
    }

    // Los avisos de stock bajo solo existen con el «Control de almacén» encendido (Configuración › Operación)
    if ((puede('compras/ver') || puede('stock/ver')) && (await controlAlmacenActivo(this.prisma))) {
      const insumos = await this.prisma.insumo.findMany({
        where: { activo: true },
        include: { stocks: true },
      });
      const bajos = insumos.filter((ins: any) => {
        const stockTotal = (ins.stocks || []).reduce((acc: number, s: any) => acc + Number(s.cantidad), 0);
        return stockTotal <= Number(ins.minimo);
      });
      if (bajos.length > 0) {
        conteos.compras = bajos.length;
        calculadas.push({
          id: 'stock-bajo',
          clave: claveCalculada('stock-bajo', bajos.map((ins: any) => ins.id)),
          titulo: `${bajos.length} ${bajos.length === 1 ? 'insumo con stock bajo' : 'insumos con stock bajo'}`,
          detalle: 'Insumos que han llegado o están por debajo de su stock mínimo.',
          prioridad: 'ALTA',
          desde: null,
          modulo: 'compras',
          accion: 'Pedir al proveedor',
          ruta: '/admin/compras?tab=pedir',
        });
      }
    }

    // ---- Estado de lectura de ESTE usuario ----
    const desdeVentana = haceHoras(HORAS_LEIDAS_VISIBLES);
    const lecturasN = await this.lecturasGuardadas(usuario.partyId);
    const idsLeidos: bigint[] = [];
    const idsNoLeidosExplicito: bigint[] = [];
    const idsLeidosRecientes: bigint[] = [];
    for (const [id, leidaEn] of lecturasN) {
      if (leidaEn === null) {
        idsNoLeidosExplicito.push(BigInt(id));
        continue;
      }
      idsLeidos.push(BigInt(id));
      if (leidaEn >= desdeVentana) idsLeidosRecientes.push(BigInt(id));
    }

    // Guardadas no leídas: sin lectura propia y sin marca global (datos anteriores), o marcadas no leídas a mano
    const noLeidas = await this.prisma.notificacion.findMany({
      where: visibleA(usuario, avisosVisibles, {
        AND: [{ id: { notIn: idsLeidos } }, { OR: [{ leida_en: null }, { id: { in: idsNoLeidosExplicito } }] }],
      }),
      orderBy: { en: 'desc' },
      take: MAX_GUARDADAS_NO_LEIDAS,
    });
    // Guardadas leídas en las últimas 24 h: por lectura propia (o la marca global de datos anteriores)
    const leidas = await this.prisma.notificacion.findMany({
      where: visibleA(usuario, avisosVisibles, { OR: [{ id: { in: idsLeidosRecientes } }, { leida_en: { gte: desdeVentana } }] }),
      orderBy: { en: 'desc' },
      take: MAX_GUARDADAS_LEIDAS,
    });

    // Lectura de los calculados (una consulta)
    const lecturasC = calculadas.length
      ? await this.prisma.notificacionLectura.findMany({
          where: { party_id: usuario.partyId, clave: { in: calculadas.map((c) => c.clave) } },
          select: { clave: true, leida_en: true },
        })
      : [];
    const mapaC = new Map(lecturasC.map((f) => [f.clave, f.leida_en]));

    const guardadaComoAviso = (n: (typeof noLeidas)[number], leidaEn: Date | null): Notificacion => {
      const tipoLegible = TIPOS_NOTIFICACION[n.tipo] || n.tipo;
      const accionGo = ACCIONES_NOTIFICACION[tipoLegible];
      return {
        id: n.id.toString(),
        clave: `n:${n.id}`,
        titulo: n.titulo,
        detalle: n.mensaje ?? '',
        prioridad: prioridadDeTipo(n.tipo),
        desde: n.en.toISOString(),
        modulo: accionGo ? accionGo[0] : 'notificaciones',
        accion: accionGo ? accionGo[1] : 'Ver en el historial',
        ruta: n.enlace ?? undefined,
        leida: leidaEn !== null,
        leidaEn: leidaEn ? leidaEn.toISOString() : null,
      };
    };

    const todas: Notificacion[] = [
      ...calculadas.map((c) => {
        const leidaEn = mapaC.get(c.clave) ?? null;
        return { ...c, leida: leidaEn !== null, leidaEn: leidaEn ? leidaEn.toISOString() : null };
      }),
      ...noLeidas.map((n) => guardadaComoAviso(n, null)),
      ...leidas
        // la lectura propia manda; sin ella, vale la marca heredada de la tabla
        .map((n) => guardadaComoAviso(n, lecturasN.has(n.id.toString()) ? lecturasN.get(n.id.toString()) ?? null : n.leida_en))
        .filter((n) => n.leida),
    ];

    // Leídas: solo las de las últimas 24 h (las calculadas siguen contando en los conteos)
    const visibles = todas.filter((n) => !n.leida || (n.leidaEn !== null && new Date(n.leidaEn) >= desdeVentana));
    // Urgencia primero y, dentro de cada prioridad, lo más nuevo arriba
    const urgencia = (a: Notificacion, b: Notificacion) =>
      ORDEN[a.prioridad] - ORDEN[b.prioridad] || (b.desde ?? ahoraIso).localeCompare(a.desde ?? ahoraIso);
    const sinLeer = visibles.filter((n) => !n.leida).sort(urgencia);
    const yaLeidas = visibles
      .filter((n) => n.leida)
      .sort((a, b) => (b.leidaEn ?? '').localeCompare(a.leidaEn ?? ''))
      .slice(0, MAX_LEIDAS_VISIBLES);

    return { conteos, notificaciones: [...sinLeer, ...yaLeidas], ajustes: await this.ajustes() };
  }

  /** Ajustes de sonido y «Marcar todas leídas» (tabla parametro, los cambia el ADMIN en Configuración). */
  async ajustes(): Promise<AjustesNotificaciones> {
    const filas = await this.prisma.parametro.findMany({ where: { clave: { in: Object.values(CLAVES_AJUSTES_NOTIF) } } });
    return leerAjustesNotificacion(filas);
  }

  /**
   * Listado del historial de notificaciones con métricas y conteos dinámicos (mockup Notificaciones).
   */
  async historial(
    filtro: { tipo?: string; estado?: 'todas' | 'nuevas' | 'leidas'; desde?: string; hasta?: string; q?: string; limite?: number; cursor?: string },
    usuario: UsuarioAutenticado,
  ) {
    // 1. Obtener todas las notificaciones visibles para el usuario o su rol
    const avisosVisibles = await this.clavesVisibles(usuario, await this.permisosDe(usuario));
    const todas = await this.prisma.notificacion.findMany({
      where: visibleA(usuario, avisosVisibles),
      orderBy: { en: 'desc' },
    });
    const lecturas = await this.lecturasGuardadas(usuario.partyId);

    const hoyIso = aIsoLima(new Date());

    // Mapear filas, con la lectura de este usuario
    const filas = todas.map((n) => {
      const propia = lecturas.get(n.id.toString());
      const leidaEn = propia !== undefined ? propia : n.leida_en;
      const leida = !!leidaEn;
      const tipoLegible = TIPOS_NOTIFICACION[n.tipo] || n.tipo;
      const iso = aIsoLima(n.en);
      const fecha = aFechaLima(n.en);
      const hora = aHoraLima(n.en);
      const color = COLORES_NOTIFICACION[tipoLegible] || '#6B7F8C';
      const accionGo = ACCIONES_NOTIFICACION[tipoLegible];

      return {
        id: n.id.toString(),
        tipoCodigo: n.tipo,
        tipo: tipoLegible,
        titulo: n.titulo,
        mensaje: n.mensaje ?? '',
        enlace: n.enlace ?? null,
        leida,
        leidaEn: leidaEn ? leidaEn.toISOString() : null,
        creadoEn: n.en.toISOString(),
        fecha,
        hora,
        iso,
        color,
        modulo: accionGo ? accionGo[0] : null,
        accion: accionGo ? accionGo[1] : null,
      };
    });

    // Conteos globales para métricas y pastillas
    const totalHistorial = filas.length;
    const sinLeerHistorial = filas.filter((f) => !f.leida).length;
    const delDiaDeHoy = filas.filter((f) => f.iso === hoyIso).length;

    // Resumen de pendientes en vivo para la sección superior (solo las no leídas).
    // Las páginas siguientes (con cursor) no lo recalculan: solo traen más filas.
    const siguiente = !!filtro.cursor;
    const res = siguiente ? null : await this.resumen(usuario);
    const pendientes = res ? res.notificaciones.filter((n) => !n.leida) : [];
    const pendientesAhora = pendientes.length;
    const urgentesAhora = pendientes.filter((p) => p.prioridad === 'ALTA').length;

    // Conteo por tipo dinámico
    const conteosPorTipo: Record<string, number> = { Todos: totalHistorial };
    for (const f of filas) {
      conteosPorTipo[f.tipo] = (conteosPorTipo[f.tipo] || 0) + 1;
    }

    // Conteo por estado
    const conteosPorEstado = {
      todas: totalHistorial,
      nuevas: sinLeerHistorial,
      leidas: totalHistorial - sinLeerHistorial,
    };

    // Aplicar filtros
    const qTerm = (filtro.q ?? '').trim();
    const filtroTipo = filtro.tipo && filtro.tipo !== 'Todos' ? filtro.tipo : undefined;
    const filtroEstado = filtro.estado || 'todas';

    const items = filas.filter((f) => {
      if (filtroTipo && f.tipo !== filtroTipo && f.tipoCodigo !== filtroTipo) {
        return false;
      }
      if (filtroEstado === 'nuevas' && f.leida) return false;
      if (filtroEstado === 'leidas' && !f.leida) return false;

      if (filtro.desde && f.iso < filtro.desde) return false;
      if (filtro.hasta && f.iso > filtro.hasta) return false;

      if (qTerm) {
        if (!coincideTexto(qTerm, f.tipo, f.titulo, f.mensaje)) return false;
      }

      return true;
    });

    // Paginación por cursor (id de la última recibida): no se repite nada aunque entren avisos nuevos arriba
    const limite = Math.min(Math.max(Math.trunc(filtro.limite ?? LIMITE_PAGINA), 1), MAX_LIMITE_PAGINA);
    let inicio = 0;
    if (filtro.cursor) {
      const pos = items.findIndex((f) => f.id === filtro.cursor);
      inicio = pos >= 0 ? pos + 1 : 0;
    }
    const pagina = items.slice(inicio, inicio + limite);
    const hayMas = inicio + limite < items.length;

    return {
      ajustes: res ? res.ajustes : await this.ajustes(),
      metricas: {
        pendientesAhora,
        urgentesAhora,
        sinLeerHistorial,
        delDiaDeHoy,
        totalHistorial,
        rolNombre: usuario.rol.toLowerCase(),
      },
      pendientes,
      conteosPorTipo,
      conteosPorEstado,
      items: pagina,
      total: items.length,
      hayMas,
      siguienteCursor: hayMas ? pagina[pagina.length - 1].id : null,
    };
  }

  /** Marca leída (o no leída) una notificación para ESTE usuario. Solo escribe su fila de lectura. */
  async marcarClave(clave: string, leida: boolean, usuario: UsuarioAutenticado) {
    const noEncontrada = new NotFoundException({ codigo: 'NOTIFICACION_NO_ENCONTRADA', mensaje: 'Notificación no encontrada' });
    if (!CLAVE_VALIDA.test(clave)) throw noEncontrada;

    if (clave.startsWith('n:')) {
      const avisosVisibles = await this.clavesVisibles(usuario, await this.permisosDe(usuario));
      const id = BigInt(clave.slice(2));
      const existe = await this.prisma.notificacion.findFirst({ where: visibleA(usuario, avisosVisibles, { id }), select: { id: true } });
      if (!existe) throw noEncontrada;
    }

    // leida = false se guarda como fila con leida_en NULL: así pisa también una marca heredada
    const ahora = leida ? new Date() : null;
    await this.prisma.notificacionLectura.upsert({
      where: { party_id_clave: { party_id: usuario.partyId, clave } },
      create: { party_id: usuario.partyId, clave, leida_en: ahora },
      update: { leida_en: ahora },
    });

    this.eventos?.emitirAParty(usuario.partyId, 'notificaciones:actualizada', {});
    return { ok: true, clave, leida };
  }

  /** Compatibilidad: marca por id de aviso guardado. */
  async marcarLeida(id: string, leida = true, usuario: UsuarioAutenticado) {
    if (!/^\d+$/.test(id)) {
      throw new NotFoundException({ codigo: 'NOTIFICACION_NO_ENCONTRADA', mensaje: 'Notificación no encontrada' });
    }
    await this.marcarClave(`n:${id}`, leida, usuario);
    return { ok: true, id, leida };
  }

  /** Marca leídas para ESTE usuario: las de `ids` o, sin ids, todo lo que hoy ve como no leído. */
  async marcarTodasLeidas(usuario: UsuarioAutenticado, ids?: string[]) {
    // Decisión del dueño: con el botón apagado, cada aviso se marca uno por uno
    if (!(await this.ajustes()).marcarTodasActivo) {
      throw new ForbiddenException({
        codigo: 'MARCAR_TODAS_DESACTIVADO',
        mensaje: 'Marcar todas como leídas está desactivado. Marca cada aviso por separado.',
      });
    }
    let claves: string[];
    if (ids && ids.length > 0) {
      if (!ids.every((i) => /^\d+$/.test(i))) {
        throw new NotFoundException({ codigo: 'NOTIFICACION_NO_ENCONTRADA', mensaje: 'Notificación no encontrada' });
      }
      // solo las que este usuario puede ver: no se marca (ni se «descubre») lo ajeno
      const avisosVisibles = await this.clavesVisibles(usuario, await this.permisosDe(usuario));
      const visibles = await this.prisma.notificacion.findMany({
        where: visibleA(usuario, avisosVisibles, { id: { in: ids.map((i) => BigInt(i)) } }),
        select: { id: true },
      });
      claves = visibles.map((n) => `n:${n.id}`);
    } else {
      // Calculadas pendientes + TODAS las guardadas sin leer que ve este usuario (el resumen solo muestra las últimas 100)
      const res = await this.resumen(usuario);
      const calculadas = res.notificaciones.filter((n) => !n.leida && n.clave.startsWith('c:')).map((n) => n.clave);
      const avisosVisibles = await this.clavesVisibles(usuario, await this.permisosDe(usuario));
      const lecturas = await this.lecturasGuardadas(usuario.partyId);
      const leidos = [...lecturas].filter(([, en]) => en !== null).map(([id]) => BigInt(id));
      const explicitas = [...lecturas].filter(([, en]) => en === null).map(([id]) => BigInt(id));
      const pendientes = await this.prisma.notificacion.findMany({
        where: visibleA(usuario, avisosVisibles, { AND: [{ id: { notIn: leidos } }, { OR: [{ leida_en: null }, { id: { in: explicitas } }] }] }),
        select: { id: true },
      });
      claves = [...calculadas, ...pendientes.map((n) => `n:${n.id}`)];
    }

    const ahora = new Date();
    if (claves.length) {
      // Solo filas de ESTE usuario: se reemplazan en bloque (una sola ida a la base, aunque sean cientos)
      await this.prisma.$transaction([
        this.prisma.notificacionLectura.deleteMany({ where: { party_id: usuario.partyId, clave: { in: claves } } }),
        this.prisma.notificacionLectura.createMany({
          data: claves.map((clave) => ({ party_id: usuario.partyId, clave, leida_en: ahora })),
          skipDuplicates: true,
        }),
      ]);
    }

    this.eventos?.emitirAParty(usuario.partyId, 'notificaciones:actualizada', {});
    return { ok: true, marcadas: claves.length };
  }

  async crearMensajeInterno(
    dto: { rol_destino?: string; titulo: string; mensaje: string },
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const titulo = dto.titulo.trim();
    const mensaje = dto.mensaje.trim();
    if (!titulo || !mensaje) {
      throw new HttpException(
        { codigo: 'DATOS_INVALIDOS', mensaje: 'Título y mensaje son obligatorios' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const notif = await this.prisma.notificacion.create({
      data: {
        tipo: 'MENSAJE_INTERNO',
        rol_destino: dto.rol_destino ? dto.rol_destino.toUpperCase() : null,
        titulo,
        mensaje,
      },
    });

    if (this.auditoria) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'notificaciones',
        accion: 'CREAR_MENSAJE_INTERNO',
        entidad: 'notificacion',
        entidadId: notif.id,
        partyId: usuario.partyId,
        despues: { titulo, mensaje, rol: dto.rol_destino },
        ip,
      });
    }

    this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
    return { ok: true, id: notif.id.toString() };
  }
}

import { HttpException, HttpStatus, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';

export type Prioridad = 'ALTA' | 'MEDIA' | 'BAJA';

export interface Notificacion {
  id: string;
  titulo: string;
  detalle: string;
  prioridad: Prioridad;
  /** Desde cuándo está pendiente lo más antiguo (ISO) */
  desde: string | null;
  /** Módulo del administrativo donde se resuelve (clave de modulos.ts) */
  modulo: string;
  accion: string;
}

export interface ResumenNotificaciones {
  /** Contadores para las insignias del menú, por clave de módulo */
  conteos: Record<string, number>;
  notificaciones: Notificacion[];
}

export const TIPOS_NOTIFICACION: Record<string, string> = {
  PEDIDO_POR_CONFIRMAR: 'Pedido por confirmar',
  DELIVERY_POR_CONFIRMAR: 'Delivery por confirmar',
  STOCK_BAJO: 'Stock bajo',
  ERROR_IMPRESORA: 'Error de impresora',
  COMPROBANTE_PENDIENTE: 'Comprobante pendiente',
  MENSAJE_INTERNO: 'Mensaje interno',
};

export const COLORES_NOTIFICACION: Record<string, string> = {
  'Pedido por confirmar': '#E2812C',
  'Delivery por confirmar': '#E2812C',
  'Stock bajo': '#C99A2E',
  'Error de impresora': '#B5442E',
  'Comprobante pendiente': '#0B2C3E',
  'Mensaje interno': '#6B7F8C',
};

export const ACCIONES_NOTIFICACION: Record<string, [string, string]> = {
  'Pedido por confirmar': ['caja', 'Ir a Caja'],
  'Delivery por confirmar': ['repartos', 'Ir a Repartos'],
  'Stock bajo': ['stock', 'Ver stock'],
  'Error de impresora': ['mirest', 'Ver configuración'],
  'Comprobante pendiente': ['caja', 'Ir a Caja'],
};

const ORDEN: Record<Prioridad, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
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
  ) {}

  private async permisosDe(usuario: UsuarioAutenticado): Promise<(m: string) => boolean> {
    if (usuario.rol === 'ADMIN') return () => true;
    const filas = await this.prisma.rolPermiso.findMany({
      where: { rol: usuario.rol },
      include: { permiso: true },
    });
    const modulos = new Set(filas.map((f) => `${f.permiso.modulo}/${f.permiso.accion}`));
    return (p) => modulos.has(p);
  }

  async resumen(usuario: UsuarioAutenticado): Promise<ResumenNotificaciones> {
    const puede = await this.permisosDe(usuario);
    const ahora = Date.now();
    const conteos: Record<string, number> = {};
    const lista: Notificacion[] = [];

    if (puede('caja/ver') || puede('pedidos/ver')) {
      const porCobrar = await this.prisma.pedido.findMany({
        where: { estado: { in: ABIERTOS }, pago_estado: { not: 'PAGADO' }, es_personal: false },
        select: { creado_en: true },
        orderBy: { creado_en: 'asc' },
      });
      conteos.caja = porCobrar.length;
      if (porCobrar.length) {
        lista.push({
          id: 'por-cobrar',
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
        select: { creado_en: true },
        orderBy: { creado_en: 'asc' },
      });
      if (sinUbicar.length) {
        lista.push({
          id: 'sin-ubicar',
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
        where: { estado: { in: ['COLA', 'PREPARANDO'] } },
        select: { creado_en: true },
        orderBy: { creado_en: 'asc' },
      });
      conteos.cocina = enCocina.length;
      const atrasados = enCocina.filter((p) => ahora - p.creado_en.getTime() > ATRASO_COCINA_MIN * 60000);
      if (atrasados.length) {
        lista.push({
          id: 'cocina-atrasados',
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
        select: { creado_en: true, entrega_lat: true },
        orderBy: { creado_en: 'asc' },
      });
      conteos.repartos = listos.length;
      const tomables = listos.filter((p) => p.entrega_lat !== null);
      if (tomables.length) {
        lista.push({
          id: 'repartos-listos',
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
        lista.push({
          id: 'comprobantes',
          titulo: plural(porEmitir, 'comprobante por emitir', 'comprobantes por emitir'),
          detalle: 'Boletas y facturas pendientes de emisión.',
          prioridad: 'BAJA',
          desde: null,
          modulo: 'comprobantes',
          accion: 'Ir a Comprobantes',
        });
      }
    }

    if (puede('reclamos/ver')) {
      const reclamos = await this.prisma.reclamo.findMany({
        where: { estado: { not: 'RESPONDIDO' } },
        select: { creado_en: true },
        orderBy: { creado_en: 'asc' },
      });
      conteos.reclamos = reclamos.length;
      if (reclamos.length) {
        lista.push({
          id: 'reclamos',
          titulo: plural(reclamos.length, 'reclamo sin responder', 'reclamos sin responder'),
          detalle: 'La ley da 15 días hábiles para responder cada reclamo.',
          prioridad: ahora - reclamos[0].creado_en.getTime() > 10 * 24 * 3600000 ? 'ALTA' : 'MEDIA',
          desde: reclamos[0].creado_en.toISOString(),
          modulo: 'reclamos',
          accion: 'Ir a Reclamos',
        });
      }
    }

    lista.sort(
      (a, b) =>
        ORDEN[a.prioridad] - ORDEN[b.prioridad] ||
        (a.desde ?? '9').localeCompare(b.desde ?? '9'),
    );
    return { conteos, notificaciones: lista };
  }

  /**
   * Listado del historial de notificaciones con métricas y conteos dinámicos (mockup Notificaciones).
   */
  async historial(
    filtro: { tipo?: string; estado?: 'todas' | 'nuevas' | 'leidas'; desde?: string; hasta?: string; q?: string },
    usuario: UsuarioAutenticado,
  ) {
    // 1. Obtener todas las notificaciones visibles para el usuario o su rol
    const condicionesRol: any[] = [{ rol_destino: null }, { rol_destino: usuario.rol }];
    if (usuario.rol === 'ADMIN') {
      // Admin ve todo
    }
    const whereBase: any = usuario.rol === 'ADMIN' ? {} : { OR: condicionesRol };

    const todas = await this.prisma.notificacion.findMany({
      where: whereBase,
      orderBy: { en: 'desc' },
    });

    const hoyIso = aIsoLima(new Date());

    // Mapear filas
    const filas = todas.map((n) => {
      const leida = !!n.leida_en;
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
        leidaEn: n.leida_en ? n.leida_en.toISOString() : null,
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

    // Resumen de pendientes en vivo para la sección superior
    const res = await this.resumen(usuario);
    const pendientesAhora = res.notificaciones.length;
    const urgentesAhora = res.notificaciones.filter((p) => p.prioridad === 'ALTA').length;

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
    const qTerm = (filtro.q ?? '').toLowerCase().trim();
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
        const buscable = `${f.tipo} ${f.titulo} ${f.mensaje}`.toLowerCase();
        if (!buscable.includes(qTerm)) return false;
      }

      return true;
    });

    return {
      metricas: {
        pendientesAhora,
        urgentesAhora,
        sinLeerHistorial,
        delDiaDeHoy,
        totalHistorial,
        rolNombre: usuario.rol.toLowerCase(),
      },
      pendientes: res.notificaciones,
      conteosPorTipo,
      conteosPorEstado,
      items,
    };
  }

  async marcarLeida(id: string, leida = true, usuario: UsuarioAutenticado) {
    let bigId: bigint;
    try {
      bigId = BigInt(id);
    } catch {
      throw new NotFoundException({ codigo: 'NOTIFICACION_NO_ENCONTRADA', mensaje: 'Notificación no encontrada' });
    }

    const n = await this.prisma.notificacion.findUnique({ where: { id: bigId } });
    if (!n) {
      throw new NotFoundException({ codigo: 'NOTIFICACION_NO_ENCONTRADA', mensaje: 'Notificación no encontrada' });
    }

    await this.prisma.notificacion.update({
      where: { id: bigId },
      data: {
        leida_en: leida ? new Date() : null,
      },
    });

    this.eventos?.emitirAdmin('notificaciones:actualizada', { id });
    return { ok: true, id, leida };
  }

  async marcarTodasLeidas(usuario: UsuarioAutenticado, ids?: string[]) {
    const ahora = new Date();
    if (ids && ids.length > 0) {
      const bigIds = ids.map((i) => BigInt(i));
      await this.prisma.notificacion.updateMany({
        where: { id: { in: bigIds }, leida_en: null },
        data: { leida_en: ahora },
      });
    } else {
      const where: any = { leida_en: null };
      if (usuario.rol !== 'ADMIN') {
        where.OR = [{ rol_destino: null }, { rol_destino: usuario.rol }];
      }
      await this.prisma.notificacion.updateMany({
        where,
        data: { leida_en: ahora },
      });
    }

    this.eventos?.emitirAdmin('notificaciones:actualizada', { todas: true });
    return { ok: true };
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

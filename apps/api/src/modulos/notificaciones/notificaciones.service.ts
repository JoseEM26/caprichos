import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

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

const ORDEN: Record<Prioridad, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
const ABIERTOS = ['COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO'];
const ATRASO_COCINA_MIN = 13;

const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`;

/**
 * Lo pendiente para la campanita y las insignias del menú (mockup Admin ▸ barra superior).
 * Solo cuenta lo que el rol del usuario puede resolver.
 */
@Injectable()
export class NotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

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
}

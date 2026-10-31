import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';

/** Estados de pedido que todavía no llegaron al cliente (NUEVO = por confirmar). */
const NO_ENTREGADOS = ['NUEVO', 'COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO'];
const PROXIMAS_MAX = 5;

/** Día calendario de Lima (YYYY-MM-DD) de un instante. */
const diaLima = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d);

/** Hora HH:mm en Lima de un instante. */
const horaLima = (d: Date): string =>
  new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);

/**
 * Escritorio operativo del SUPERVISOR: solo conteos, horarios y estados. Nunca montos, ventas ni cobros.
 * Las cifras van en `cantidad`, `ocupadas`... para que ningún campo lleve nombre de dinero.
 */
@Injectable()
export class EscritorioOperativoService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(ahora: Date = new Date()) {
    const hoy = diaLima(ahora);
    // Lima no tiene horario de verano: el día empieza a las 05:00 UTC
    const inicioDia = new Date(`${hoy}T00:00:00-05:00`);
    const finDia = new Date(inicioDia.getTime() + 24 * 3600000);

    const [porEstado, reservasHoy, proximas, mesas, mesasOcupadas, caja] = await Promise.all([
      this.prisma.pedido.groupBy({
        by: ['estado'],
        where: { estado: { in: NO_ENTREGADOS }, es_personal: false },
        _count: { _all: true },
      }),
      this.prisma.reserva.count({ where: { estado: 'ACTIVA', hora: { gte: inicioDia, lt: finDia } } }),
      this.prisma.reserva.findMany({
        where: { estado: 'ACTIVA', hora: { gte: ahora, lt: finDia } },
        select: { nombre: true, personas: true, hora: true },
        orderBy: { hora: 'asc' },
        take: PROXIMAS_MAX,
      }),
      this.prisma.elementoPlano.count({ where: { tipo: 'MESA', activo: true } }),
      this.prisma.pedidoMesa.findMany({
        where: { abierta: true, mesa_id: { not: null }, mesa: { tipo: 'MESA', activo: true } },
        select: { mesa_id: true },
        distinct: ['mesa_id'],
      }),
      this.prisma.caja.findUnique({ where: { fecha: new Date(`${hoy}T00:00:00Z`) }, select: { estado: true } }),
    ]);

    const contar = (estado: string) => porEstado.find((g) => g.estado === estado)?._count._all ?? 0;
    const ocupadas = mesasOcupadas.length;

    return {
      generadoEn: ahora.toISOString(),
      pedidos: {
        porConfirmar: contar('NUEVO'),
        enPreparacion: contar('PREPARANDO'),
        enCola: contar('COLA'),
        listos: contar('LISTO'),
        enReparto: contar('EN_CAMINO'),
        noEntregados: NO_ENTREGADOS.reduce((n, e) => n + contar(e), 0),
      },
      reservas: {
        cantidadHoy: reservasHoy,
        proximas: proximas.map((r) => ({ nombre: r.nombre, personas: r.personas, hora: horaLima(r.hora) })),
      },
      mesas: {
        cantidad: mesas,
        ocupadas,
        libres: Math.max(0, mesas - ocupadas),
      },
      caja: {
        estado: caja ? (caja.estado === 'ABIERTA' ? 'ABIERTA' : 'CERRADA') : 'SIN_ABRIR',
      },
    };
  }
}

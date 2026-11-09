import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { ROLES } from '../acceso/permisos';

/** Estados de pedido que todavía no llegaron al cliente (NUEVO = por confirmar). */
const NO_ENTREGADOS = ['NUEVO', 'COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO'];
const PROXIMAS_MAX = 5;

/** Día calendario de Lima (YYYY-MM-DD) de un instante. */
const diaLima = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d);

/** Hora HH:mm en Lima de un instante. */
const horaLima = (d: Date): string =>
  new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);

const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TOPE_CUMPLES = 6;
const VENTANA_POR_DEFECTO = 60;

const esBisiesto = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export interface Cumple {
  nombre: string;
  rol: string;
  fecha: string;
  enDias: number;
  etiqueta: string;
}

/**
 * Próximos cumpleaños por día y mes (sin año: no se guarda). El 29/02 se celebra el 28/02 en años no bisiestos.
 * `hoy` es el día de Lima (AAAA-MM-DD). Ordena por cercanía y corta por ventana y tope.
 */
export function proximosCumpleanos(
  personas: { nombre: string; rol: string; dia: number; mes: number }[],
  hoy: string,
  dias: number = VENTANA_POR_DEFECTO,
  tope: number = TOPE_CUMPLES,
): Cumple[] {
  const [y, m, d] = hoy.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  const lista: Cumple[] = [];
  for (const p of personas) {
    const ocurre = (anio: number) => Date.UTC(anio, p.mes - 1, p.mes === 2 && p.dia === 29 && !esBisiesto(anio) ? 28 : p.dia);
    let f = ocurre(y);
    if (f < base) f = ocurre(y + 1);
    const enDias = Math.round((f - base) / 86400000);
    if (enDias > dias) continue;
    const fd = new Date(f);
    lista.push({
      nombre: p.nombre,
      rol: p.rol,
      fecha: `${DIAS_SEM[fd.getUTCDay()]} ${fd.getUTCDate()} ${MESES[fd.getUTCMonth()]}`,
      enDias,
      etiqueta: enDias === 0 ? 'Hoy' : enDias === 1 ? 'Mañana' : `en ${enDias} días`,
    });
  }
  return lista.sort((a, b) => a.enDias - b.enDias || a.nombre.localeCompare(b.nombre, 'es')).slice(0, tope);
}

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

  /** Cumpleaños del personal activo (solo ADMIN y SUPERVISOR; lo exige el permiso del controlador). Nunca devuelve la fecha completa. */
  async cumpleanos(dias?: number, ahora: Date = new Date()) {
    const ventana = Number.isFinite(dias) && (dias as number) >= 1 ? Math.min(Math.floor(dias as number), 366) : VENTANA_POR_DEFECTO;
    const cuentas = await this.prisma.userAccount.findMany({
      where: { activo: true },
      select: { rol: true, party: { select: { persona: { select: { nombres: true, apellidos: true, cumple_dia: true, cumple_mes: true } } } } },
    });
    const conFecha: { nombre: string; rol: string; dia: number; mes: number }[] = [];
    let sinFecha = 0;
    for (const c of cuentas) {
      const p = c.party?.persona;
      if (!p) continue;
      if (!p.cumple_dia || !p.cumple_mes) {
        sinFecha++;
        continue;
      }
      const nombre = [p.nombres.trim().split(/\s+/)[0], (p.apellidos ?? '').trim().split(/\s+/)[0]].filter(Boolean).join(' ');
      conFecha.push({ nombre, rol: ROLES.find((r) => r.codigo === c.rol)?.nombre ?? c.rol, dia: p.cumple_dia, mes: p.cumple_mes });
    }
    return { ventanaDias: ventana, sinFecha, proximos: proximosCumpleanos(conFecha, diaLima(ahora), ventana) };
  }
}

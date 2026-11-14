import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { montoACobrar } from '../../comun/monto-a-cobrar';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { aCentimos, calcularMontosCaja, efectivoDelRepartidor, enPesos, pedidosRepartoDelDia } from '../caja';
import { CierreService } from './cierre.service';
import { calcularTotalConteo, rangoDiaCaja } from './cierre.util';
import { analizarCaja, DatosAnalisis, horaLima, PagoA } from './analisis-cierre';

const TOPE = 200;
const pagosDe = (pagos: Array<{ medio: string; monto: unknown; propina: unknown }>): PagoA[] =>
  pagos.map((p) => ({ medio: p.medio, monto: Number(p.monto), propina: Number(p.propina ?? 0) }));

/** Pasos fijos que ve quien cierra: no dependen de ningún monto. */
export const LISTA_REVISION = [
  '¿Contaste los billetes y las monedas dos veces?',
  '¿El Yape, Plin o transferencia que escribiste es el total del día que muestra la app, sin movimientos que no son ventas?',
  '¿El total del POS de tarjeta es del mismo día y del mismo lote?',
  '¿Registraste los gastos como egreso?',
  '¿Algún cliente pagó por un medio distinto al que se registró (cobrado como efectivo pero pagó por Yape, o al revés)?',
  '¿Hubo pedidos anulados que ya habían pagado? Hay que devolver el dinero.',
  '¿Entregaste vuelto que no se anotó?',
];

@Injectable()
export class AnalisisCierreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cierre: CierreService,
  ) {}

  /** Análisis completo de una caja (cerrada o abierta). Solo administrador, solo lectura. */
  async analizar(id: string, usuario: UsuarioAutenticado) {
    if (usuario?.rol !== 'ADMIN') {
      throw new HttpException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo el administrador puede ver el análisis del cierre.' }, HttpStatus.FORBIDDEN);
    }
    let cajaId: bigint;
    try {
      cajaId = BigInt(id);
    } catch {
      throw new HttpException({ codigo: 'ID_INVALIDO', mensaje: 'El ID proporcionado no es válido.' }, HttpStatus.BAD_REQUEST);
    }
    const caja = await this.prisma.caja.findUnique({ where: { id: cajaId }, include: { cierre: { include: { medios: true } } } });
    if (!caja) throw new HttpException({ codigo: 'CIERRE_NO_ENCONTRADO', mensaje: 'Caja no encontrada.' }, HttpStatus.NOT_FOUND);
    const { inicio, fin } = rangoDiaCaja(new Date(caja.fecha));

    const [cobros, anulados, movimientos, liquidaciones, credito, reparto, conteoUlt] = await Promise.all([
      this.prisma.cobro.findMany({
        where: { caja_id: cajaId },
        include: { pagos: true, pedido: { select: { codigo: true, creado_en: true } } },
        orderBy: { id: 'asc' },
        take: 2000,
      }),
      this.prisma.pedido.findMany({
        where: {
          estado: 'ANULADO',
          OR: [{ pago_estado: 'PAGADO' }, { cobros: { some: { caja_id: cajaId } } }],
          AND: [{ OR: [{ anulado_en: { gte: inicio, lt: fin } }, { creado_en: { gte: inicio, lt: fin } }, { cobros: { some: { caja_id: cajaId } } }] }],
        },
        select: { codigo: true, pago_estado: true, pago_metodo: true, total: true, monto_credito: true, cobros: { select: { anulado_en: true, pagos: true } } },
        take: TOPE,
      }),
      this.prisma.movimientoCaja.findMany({ where: { caja_id: cajaId }, orderBy: { id: 'asc' }, take: TOPE }),
      this.prisma.liquidacion.findMany({ where: { caja_id: cajaId } }),
      this.prisma.pedido.findMany({
        where: { estado: { not: 'ANULADO' }, creado_en: { gte: inicio, lt: fin }, OR: [{ monto_credito: { gt: 0 } }, { es_personal: true }, { pago_metodo: 'CREDITO_PERSONAL' }] },
        select: { codigo: true, total: true, monto_credito: true },
        take: TOPE,
      }),
      pedidosRepartoDelDia(this.prisma, new Date(caja.fecha).toISOString().slice(0, 10), caja.estado === 'ABIERTA'),
      this.prisma.conteoCierre.findFirst({ where: { caja_id: cajaId }, orderBy: { intento: 'desc' } }),
    ]);

    // Medios: del cierre guardado; si la caja sigue abierta, el sistema de hoy y lo último que se haya contado
    let medios: DatosAnalisis['medios'];
    let conteo: Record<string, number> | null = null;
    if (caja.cierre) {
      medios = caja.cierre.medios.map((m) => ({ medio: m.medio, sistema: Number(m.sistema), visto: Number(m.visto), diferencia: m.diferencia !== null ? Number(m.diferencia) : null }));
      conteo = (caja.cierre.conteo as Record<string, number>) ?? null;
    } else {
      const m = await calcularMontosCaja(this.prisma, caja);
      const v = (conteoUlt?.medios as Record<string, number> | null) ?? null;
      conteo = (conteoUlt?.conteo as Record<string, number>) ?? null;
      const fila = (medio: string, sistema: number, visto: number | null) => ({ medio, sistema, visto, diferencia: visto === null ? null : enPesos(aCentimos(visto) - aCentimos(sistema)) });
      medios = [
        fila('EFECTIVO', m.esperadoEfectivo, conteo ? calcularTotalConteo(conteo) : null),
        fila('YAPE', m.sistemaYape, v ? Number(v.yape ?? 0) : null),
        fila('PLIN', m.sistemaPlin, v ? Number(v.plin ?? 0) : null),
        fila('TRANSFERENCIA', m.sistemaTransferencia, v ? Number(v.transferencia ?? 0) : null),
        fila('TARJETA', m.sistemaTarjeta, v ? Number(v.tarjeta ?? 0) : null),
      ];
    }
    const hayDetalle = conteo && !('total_directo' in conteo) && Object.keys(conteo).length > 0;

    // Efectivo contra entrega aún sin liquidar
    const pendientes = reparto.flatMap((p) => {
      const c = efectivoDelRepartidor(p);
      return c > 0 ? [{ codigo: p.codigo, monto: enPesos(c), repartidor: String(p.repartidor_party_id) }] : [];
    });
    const liquidadoPor = new Set(liquidaciones.map((l) => String(l.repartidor_party_id)));
    const repartidoresPorLiquidar = new Set(pendientes.filter((p) => !liquidadoPor.has(p.repartidor)).map((p) => p.repartidor)).size;

    return {
      cajaId: Number(caja.id),
      cerrada: !!caja.cierre,
      ...analizarCaja({
        medios,
        conteoTotal: hayDetalle ? calcularTotalConteo(conteo) : null,
        cobros: cobros.map((c) => ({ pedidoCodigo: c.pedido.codigo, pedidoCreadoEn: c.pedido.creado_en, en: c.en, anuladoEn: c.anulado_en, pagos: pagosDe(c.pagos) })),
        anuladosPagados: anulados.map((p) => ({
          codigo: p.codigo,
          pagoEstado: p.pago_estado,
          pagoMetodo: p.pago_metodo,
          total: montoACobrar(p),
          cobros: p.cobros.map((c) => ({ anulado: !!c.anulado_en, pagos: pagosDe(c.pagos) })),
        })),
        movimientos: movimientos.map((m) => ({ tipo: m.tipo, monto: Number(m.monto), motivo: m.motivo, anulado: !!m.anulado_en })),
        delivery: {
          pendientes: pendientes.map(({ codigo, monto }) => ({ codigo, monto })),
          liquidaciones: liquidaciones.map((l) => ({ esperado: Number(l.esperado), entregado: Number(l.entregado) })),
          repartidoresPorLiquidar,
        },
        credito: credito.map((p) => ({ codigo: p.codigo, monto: Number(p.monto_credito) > 0 ? Number(p.monto_credito) : Number(p.total) })),
        inicioDia: inicio,
      }),
    };
  }

  /**
   * Guía para quien cierra la caja abierta. NUNCA devuelve esperado, sistema, visto ni diferencias (DT-61):
   * solo operaciones propias (códigos, medio, monto del pedido), cantidades y una lista fija.
   */
  async guiaRevision() {
    const caja = await this.cierre.obtenerCajaAbierta();
    const { inicio, fin } = rangoDiaCaja(new Date(caja.fecha));
    const [anulados, cobrosAnulados, movimientos, pendientes, propinas, repartidores] = await Promise.all([
      this.prisma.pedido.findMany({
        where: {
          estado: 'ANULADO',
          OR: [{ pago_estado: 'PAGADO' }, { cobros: { some: { caja_id: caja.id } } }],
          AND: [{ OR: [{ anulado_en: { gte: inicio, lt: fin } }, { creado_en: { gte: inicio, lt: fin } }, { cobros: { some: { caja_id: caja.id } } }] }],
        },
        select: { codigo: true, pago_estado: true, pago_metodo: true, total: true, monto_credito: true, cobros: { select: { pagos: { select: { medio: true, monto: true, propina: true } } } } },
        take: 50,
      }),
      this.prisma.cobro.findMany({
        where: { caja_id: caja.id, anulado_en: { not: null } },
        include: { pagos: true, pedido: { select: { codigo: true } } },
        orderBy: { id: 'asc' },
        take: 50,
      }),
      this.prisma.movimientoCaja.findMany({ where: { caja_id: caja.id }, orderBy: { id: 'asc' }, take: 50 }),
      this.cierre.listarPendientesDeCobro(),
      this.prisma.cobroPago.groupBy({ by: ['medio'], where: { propina: { gt: 0 }, cobro: { caja_id: caja.id, anulado_en: null } }, _count: { _all: true } }),
      this.cierre.listarRepartidoresPorLiquidar(),
    ]);

    return {
      cajaId: Number(caja.id),
      anuladosConPago: anulados.map((p) => {
        const pagos = p.cobros.flatMap((c) => c.pagos);
        return {
          codigo: p.codigo,
          medio: (pagos[0]?.medio ?? p.pago_metodo ?? '').toUpperCase() || null,
          monto: pagos.length ? enPesos(pagos.reduce((a, x) => a + aCentimos(x.monto) + aCentimos(x.propina), 0)) : montoACobrar(p),
        };
      }),
      cobrosAnulados: cobrosAnulados.map((c) => ({
        codigo: c.pedido.codigo,
        medio: c.pagos.map((x) => x.medio.toUpperCase()).join(' + ') || null,
        monto: enPesos(c.pagos.reduce((a, x) => a + aCentimos(x.monto) + aCentimos(x.propina), 0)),
        hora: horaLima(c.anulado_en!),
      })),
      movimientos: movimientos.map((m) => ({ tipo: m.tipo, monto: Number(m.monto), motivo: m.motivo, anulado: !!m.anulado_en })),
      pendientesDeCobro: pendientes.slice(0, 50).map((p) => ({ codigo: p.codigo, estado: p.estado, total: p.total })),
      // Solo cuántas propinas hubo por medio, como recordatorio: sin montos del sistema
      propinasPorMedio: propinas.map((g) => ({ medio: g.medio.toUpperCase(), cantidad: g._count._all })),
      // Solo quién y cuántos pedidos; sin lo que debe entregar
      repartidoresPorLiquidar: repartidores.filter((r) => r.pendiente > 0).map((r) => ({ nombre: r.nombre, pedidos: r.pedidos.length })),
      lista: LISTA_REVISION,
    };
  }
}

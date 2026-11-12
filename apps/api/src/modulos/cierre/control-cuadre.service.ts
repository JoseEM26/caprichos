import { montoACobrar } from '../../comun/monto-a-cobrar';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { aCentimos, enPesos } from '../caja/caja.calculo';
import { pagadosSinCobroDelDia, rangoDiaCaja } from './cierre.util';

const DIGITALES = ['YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'];

/** Baja de comprobante ya hecha o en curso: ese comprobante ya no cuenta como vigente. */
const BAJA_HECHA = ['ACEPTADA', 'SOLICITADA', 'PENDIENTE_RESUMEN'];

/**
 * «Control de cuadre» (solo lectura): para un día de Lima compara lo cobrado en caja contra los pedidos y
 * señala dinero que no pasó por caja, cobros mal sumados, anulados sin devolver y comprobantes de más.
 * No escribe nada. Cada alerta trae los pedidos para revisarlos a mano.
 */
@Injectable()
export class ControlCuadreService {
  constructor(private readonly prisma: PrismaService) {}

  async controlar(fechaIso: string) {
    const { inicio, fin } = rangoDiaCaja(new Date(`${fechaIso}T00:00:00.000Z`));
    const enElDia = { gte: inicio, lt: fin };

    // 1. Lo cobrado en caja ese día, por medio (venta y propina aparte)
    const cobros = await this.prisma.cobro.findMany({
      where: { en: enElDia, anulado_en: null },
      include: { pagos: true, pedido: { select: { codigo: true, estado: true, propina: true } } },
    });
    const porMedio: Record<string, { venta: number; propina: number }> = {};
    const cobrosDescuadrados: Array<{ pedido: string; total: number; sumaPagos: number }> = [];
    for (const c of cobros) {
      let suma = 0;
      for (const p of c.pagos) {
        const medio = (p.medio || '').trim().toUpperCase();
        porMedio[medio] ??= { venta: 0, propina: 0 };
        porMedio[medio].venta += aCentimos(p.monto);
        porMedio[medio].propina += aCentimos(p.propina);
        suma += aCentimos(p.monto);
      }
      if (suma !== aCentimos(c.total)) {
        cobrosDescuadrados.push({ pedido: c.pedido.codigo, total: enPesos(aCentimos(c.total)), sumaPagos: enPesos(suma) });
      }
    }

    // 2. Pedidos pagados que no tienen ningún cobro vigente (no pasaron por «cobrar» de Caja): su dinero digital no
    //    entra a ninguna caja; el efectivo de un delivery entra solo si el repartidor se liquidó.
    const sinCobro = await pagadosSinCobroDelDia(this.prisma, enElDia);
    const pagadosSinCobro = sinCobro.map((p: any) => {
      const plan = p.planPago ?? [];
      const digital = plan.length
        ? plan.filter((f: any) => DIGITALES.includes(f.medio)).reduce((a: number, f: any) => a + aCentimos(f.monto), 0)
        : DIGITALES.includes(String(p.pago_metodo)) ? aCentimos(montoACobrar(p)) : 0;
      const efectivo = plan.length
        ? plan.filter((f: any) => f.medio === 'EFECTIVO').reduce((a: number, f: any) => a + aCentimos(f.monto), 0)
        : p.pago_metodo === 'EFECTIVO' ? aCentimos(montoACobrar(p)) : 0;
      return {
        pedido: p.codigo,
        modalidad: p.modalidad,
        medio: p.pago_metodo,
        total: enPesos(aCentimos(montoACobrar(p))),
        digitalFueraDeCaja: enPesos(digital),
        efectivo: enPesos(efectivo),
        // Un efectivo sin cobro solo llega a caja por la liquidación del repartidor (delivery entregado)
        efectivoPorLiquidar: p.modalidad === 'DELIVERY' && p.estado === 'ENTREGADO',
      };
    });
    const digitalFueraDeCaja = pagadosSinCobro.reduce((a, p) => a + aCentimos(p.digitalFueraDeCaja), 0);
    const efectivoFueraDeCaja = pagadosSinCobro
      .filter((p) => !p.efectivoPorLiquidar)
      .reduce((a, p) => a + aCentimos(p.efectivo), 0);

    // 3. Pedidos anulados con un cobro vigente y sin devolución: el dinero sigue en caja y nadie lo devolvió
    const anulados = await this.prisma.pedido.findMany({
      where: { estado: 'ANULADO', cobros: { some: { anulado_en: null, en: enElDia } }, devolucion: { is: null } },
      select: { codigo: true, total: true },
    });

    // 4. Boletas o facturas vigentes de pedidos sin cobro vigente o anulados: suman de más en el comprobante
    const comprobantes = await this.prisma.comprobante.findMany({
      where: {
        creado_en: enElDia,
        anulado_en: null,
        tipo: { in: ['BOLETA', 'FACTURA'] },
        OR: [{ pedido: { estado: 'ANULADO' } }, { pedido: { cobros: { none: { anulado_en: null } } } }],
      },
      select: { numero_texto: true, baja_estado: true, pedido: { select: { codigo: true, total: true, estado: true } } },
    });
    const comprobantesDeMas = comprobantes.filter((c) => !BAJA_HECHA.includes(c.baja_estado ?? ''));

    // 4b. Bajas que SUNAT no recibió todavía (anulación de cobro o pedido con SUNAT sin respuesta): se reintentan solas
    const bajasPendientes = await this.prisma.comprobante.findMany({
      where: { baja_estado: 'PENDIENTE_BAJA' },
      select: { numero_texto: true, pedido: { select: { codigo: true } } },
    });

    // 5. Devoluciones del día y cierre de la caja del día (si ya cerró)
    const devoluciones = await this.prisma.devolucionPedido.findMany({
      where: { creado_en: enElDia },
      select: { medio: true, monto_devuelto: true },
    });
    const devueltoPorMedio: Record<string, number> = {};
    for (const d of devoluciones) {
      devueltoPorMedio[d.medio] = (devueltoPorMedio[d.medio] ?? 0) + aCentimos(d.monto_devuelto);
    }
    const caja = await this.prisma.caja.findUnique({ where: { fecha: new Date(`${fechaIso}T00:00:00.000Z`) } });
    const cierre = caja
      ? await this.prisma.cierreMedio.findMany({ where: { caja_id: caja.id }, orderBy: { medio: 'asc' } })
      : [];
    const descuadresCierre = cierre
      .filter((m) => aCentimos(m.visto) !== aCentimos(m.sistema))
      .map((m) => ({ medio: m.medio, sistema: Number(m.sistema), visto: Number(m.visto), diferencia: enPesos(aCentimos(m.visto) - aCentimos(m.sistema)) }));

    const alertas: string[] = [];
    if (digitalFueraDeCaja > 0) alertas.push(`S/ ${enPesos(digitalFueraDeCaja).toFixed(2)} pagados por Yape/Plin/transferencia/tarjeta sin cobro en caja`);
    if (efectivoFueraDeCaja > 0) alertas.push(`S/ ${enPesos(efectivoFueraDeCaja).toFixed(2)} en efectivo pagados sin cobro en caja ni liquidación`);
    if (cobrosDescuadrados.length) alertas.push(`${cobrosDescuadrados.length} cobro(s) cuyos pagos no suman su total`);
    if (anulados.length) alertas.push(`${anulados.length} pedido(s) anulados con cobro vigente y sin devolución`);
    if (comprobantesDeMas.length) alertas.push(`${comprobantesDeMas.length} boleta(s)/factura(s) vigentes de pedidos anulados o sin cobro`);
    if (bajasPendientes.length) alertas.push(`${bajasPendientes.length} boleta(s)/factura(s) con la baja pendiente de enviar a SUNAT (se reintenta sola)`);
    if (descuadresCierre.length) alertas.push(`El cierre de la caja registró descuadre en ${descuadresCierre.map((d) => d.medio).join(', ')}`);

    return {
      fecha: fechaIso,
      cobradoPorMedio: Object.fromEntries(
        Object.entries(porMedio).map(([m, v]) => [m, { venta: enPesos(v.venta), propina: enPesos(v.propina) }]),
      ),
      cobros: cobros.length,
      devueltoPorMedio: Object.fromEntries(Object.entries(devueltoPorMedio).map(([m, v]) => [m, enPesos(v)])),
      cajaEstado: caja?.estado ?? null,
      descuadresCierre,
      pagadosSinCobro,
      digitalFueraDeCaja: enPesos(digitalFueraDeCaja),
      efectivoFueraDeCaja: enPesos(efectivoFueraDeCaja),
      cobrosDescuadrados,
      anuladosSinDevolucion: anulados.map((a) => ({ pedido: a.codigo, total: Number(a.total) })),
      comprobantesDeMas: comprobantesDeMas.map((c) => ({
        comprobante: c.numero_texto,
        pedido: c.pedido.codigo,
        estadoPedido: c.pedido.estado,
        total: Number(c.pedido.total),
      })),
      bajasPendientes: bajasPendientes.map((c) => ({ comprobante: c.numero_texto, pedido: c.pedido.codigo })),
      alertas,
      cuadra: alertas.length === 0,
    };
  }
}

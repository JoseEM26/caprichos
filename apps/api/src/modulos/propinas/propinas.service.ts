import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { diaLima, rangoMesLima, resumirPropinas, topePropina } from './propinas.util';

/** Configuración de propinas (parámetros propina_activa y propina_tope). Lo usan pedidos, carta y bot. */
export async function leerConfigPropina(db: Pick<PrismaService, 'parametro'>) {
  const filas = await db.parametro.findMany({ where: { clave: { in: ['propina_activa', 'propina_tope'] } } });
  const mapa = new Map(filas.map((f) => [f.clave, f.valor]));
  return { activa: mapa.get('propina_activa') ?? null, tope: topePropina(mapa.get('propina_tope')) };
}

@Injectable()
export class PropinasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Acumulado de propinas de un mes calendario de Lima. Cuenta lo COBRADO (cobro vigente: un cobro anulado
   * sale). Una DEVOLUCIÓN de pedido resta su propina el día en que se devuelve, por el medio del cobro
   * (efectivo o digital): es el mismo criterio que el cierre de caja (calcularMontosCaja), así que no divergen.
   */
  async resumenMes(anio: number, mes: number) {
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new BadRequestException({ codigo: 'MES_INVALIDO', mensaje: 'Indica un año y un mes válidos' });
    }
    const { inicio, fin } = rangoMesLima(anio, mes);
    const filas = await this.filasCobradas(inicio, fin);
    const resumen = resumirPropinas(filas);
    const devuelto = Math.round(filas.filter((f) => f.propina < 0).reduce((a, f) => a - f.propina, 0) * 100) / 100;
    return { anio, mes, ...resumen, devuelto };
  }

  /**
   * Filas de propina de un rango [inicio, fin): cada cobro vigente suma el día del cobro y cada devolución resta
   * (en negativo) el día en que se devuelve. Es la fuente única del acumulado del mes y del reparto por día.
   */
  private async filasCobradas(inicio: Date, fin: Date) {
    const [cobrados, devueltos] = await Promise.all([
      this.prisma.cobroPago.findMany({
        where: { propina: { gt: 0 }, cobro: { anulado_en: null, en: { gte: inicio, lt: fin } } },
        select: { medio: true, propina: true, cobro: { select: { en: true, pedido: { select: { canal: true } } } } },
      }),
      this.prisma.devolucionPedido.findMany({
        where: { creado_en: { gte: inicio, lt: fin } },
        select: {
          creado_en: true,
          pedido: {
            select: {
              canal: true,
              cobros: { where: { anulado_en: null }, select: { pagos: { select: { medio: true, propina: true } } } },
            },
          },
        },
      }),
    ]);
    return [
      ...cobrados.map((f) => ({
        en: f.cobro.en,
        medio: f.medio,
        canal: f.cobro.pedido.canal,
        propina: Number(f.propina),
      })),
      // Devolución: propina de cada renglón del cobro vigente, en negativo, el día de la devolución
      ...devueltos.flatMap((d) =>
        d.pedido.cobros.flatMap((c) =>
          c.pagos
            .filter((p) => Number(p.propina) > 0)
            .map((p) => ({ en: d.creado_en, medio: p.medio, canal: d.pedido.canal, propina: -Number(p.propina) })),
        ),
      ),
    ];
  }

  /** Propina neta de cada día de Lima entre dos fechas AAAA-MM-DD (incluidas): cobros menos devoluciones. */
  async totalesPorDia(desde: string, hasta: string): Promise<Array<{ fecha: string; total: number }>> {
    const inicio = new Date(`${desde}T00:00:00-05:00`);
    const fin = new Date(new Date(`${hasta}T00:00:00-05:00`).getTime() + 86_400_000);
    const filas = await this.filasCobradas(inicio, fin);
    const porDia = new Map<string, number>();
    for (const f of filas) {
      const d = diaLima(f.en);
      porDia.set(d, Math.round(((porDia.get(d) ?? 0) + f.propina) * 100) / 100);
    }
    return [...porDia].map(([fecha, total]) => ({ fecha, total })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  /**
   * Pedidos entregados con propina que NO tienen cobro registrado en caja: la propina no cuenta hasta que
   * Caja cobre el pedido (contra entrega en efectivo, sin cobro). Es un aviso para regularizar.
   */
  async pendientesDeCobro() {
    const pedidos = await this.prisma.pedido.findMany({
      where: { propina: { gt: 0 }, estado: 'ENTREGADO', cobros: { none: { anulado_en: null } } },
      select: { id: true, codigo: true, propina: true, total: true, canal: true, modalidad: true, cliente_nombre: true, mesa_nombre: true, entregado_en: true },
      orderBy: { entregado_en: 'desc' },
      take: 200,
    });
    return pedidos.map((p) => ({
      id: Number(p.id),
      codigo: p.codigo,
      propina: Number(p.propina),
      total: Number(p.total),
      canal: p.canal,
      modalidad: p.modalidad,
      cliente: p.cliente_nombre?.trim() || (p.modalidad === 'MESA' ? p.mesa_nombre : null) || null,
      entregadoEn: p.entregado_en,
    }));
  }

  /** Mes actual de Lima (YYYY-MM-DD → año y mes). */
  mesActualLima(): { anio: number; mes: number } {
    const [anio, mes] = diaLima(new Date()).split('-').map(Number);
    return { anio, mes };
  }

  async configuracion() {
    return leerConfigPropina(this.prisma);
  }
}

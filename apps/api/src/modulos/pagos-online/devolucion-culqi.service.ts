import { HttpException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { enPesos } from '../caja/caja.calculo';
import { PASARELA_PAGO, PasarelaPago } from './pasarela.puerto';

export interface Devolucion {
  id: string;
  monto_centimos: number;
  en: string;
  motivo: string;
  origen: 'SISTEMA' | 'WEBHOOK';
  /** CULQI (reembolso por la pasarela) o el medio con que se devolvió por fuera */
  medio?: string;
  movimiento_caja_id?: string;
  /** Clave de idempotencia de quien pidió el reembolso (p. ej. «dp:12» = devolución del pedido 12) */
  ref?: string;
}

/** Culqi no aceptó el reembolso o no respondió: la reserva del monto ya se liberó. */
export class ErrorReembolso extends Error {}

/**
 * Reembolso por Culqi, un solo camino: lo usan «Pagos en línea › Devolver» y la anulación de un pedido pagado.
 * Reserva el monto antes de llamar a Culqi (dos a la vez no pasan del total) y deja el reembolso en el JSON del
 * intento con su `ref`: pedir lo mismo con la misma `ref` no vuelve a llamar a Culqi.
 */
@Injectable()
export class DevolucionCulqiService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASARELA_PAGO) private readonly pasarela: PasarelaPago,
  ) {}

  /** Intento de Culqi con dinero cobrado del pedido (aprobado, o devuelto en parte). */
  intentoDelPedido(pedidoId: bigint) {
    return this.prisma.pagoOnlineIntento.findFirst({
      where: { pedido_id: pedidoId, estado: { in: ['APROBADO', 'DEVUELTO'] }, culqi_cargo_id: { not: null } },
      orderBy: { id: 'desc' },
    });
  }

  /** Guarda un reembolso en el JSON del intento (sin repetir ids) y lo pasa a DEVUELTO si ya está todo devuelto. */
  async anotar(intentoId: bigint, d: Devolucion): Promise<{ totalDevuelto: number; montoTotal: number }> {
    const actual = await this.prisma.pagoOnlineIntento.findUniqueOrThrow({ where: { id: intentoId } });
    const lista = (actual.devoluciones as unknown as Devolucion[]) ?? [];
    const nueva = lista.some((x) => x.id === d.id) ? lista : [...lista, d];
    await this.prisma.pagoOnlineIntento.update({
      where: { id: intentoId },
      data: { devoluciones: nueva as unknown as Prisma.InputJsonValue, estado: actual.devuelto_centimos >= actual.monto_centimos ? 'DEVUELTO' : actual.estado },
    });
    return { totalDevuelto: actual.devuelto_centimos, montoTotal: actual.monto_centimos };
  }

  /** Reserva el monto contra el total del intento (devuelve false si otra devolución lo tocó a la vez). */
  async reservar(intentoId: bigint, antes: number, monto: number): Promise<boolean> {
    const r = await this.prisma.pagoOnlineIntento.updateMany({ where: { id: intentoId, devuelto_centimos: antes }, data: { devuelto_centimos: antes + monto } });
    return r.count > 0;
  }

  async liberar(intentoId: bigint, monto: number) {
    await this.prisma.pagoOnlineIntento.updateMany({ where: { id: intentoId }, data: { devuelto_centimos: { decrement: monto } } });
  }

  async reembolsar(p: {
    intentoId: bigint;
    montoCentimos: number;
    motivo: string;
    ref: string;
    /** Reintento tras un fallo sin respuesta: antes de pedir de nuevo se consulta a Culqi si ya lo devolvió */
    verificarPrevio?: boolean;
  }): Promise<{ devolucionId: string; totalDevuelto: number; montoTotal: number; repetido: boolean }> {
    const intento = await this.prisma.pagoOnlineIntento.findUniqueOrThrow({ where: { id: p.intentoId } });
    const lista = (intento.devoluciones as unknown as Devolucion[]) ?? [];
    const previa = lista.find((x) => x.ref === p.ref);
    if (previa) return { devolucionId: previa.id, totalDevuelto: intento.devuelto_centimos, montoTotal: intento.monto_centimos, repetido: true };

    const restante = intento.monto_centimos - intento.devuelto_centimos;
    if (!Number.isInteger(p.montoCentimos) || p.montoCentimos <= 0) throw new HttpException({ codigo: 'MONTO_INVALIDO', mensaje: 'El monto a devolver no es válido' }, 400);
    if (p.montoCentimos > restante) throw new HttpException({ codigo: 'MONTO_EXCEDE', mensaje: `Solo se pueden devolver S/ ${enPesos(restante).toFixed(2)} más` }, 409);
    if (!intento.culqi_cargo_id) throw new HttpException({ codigo: 'PAGO_NO_APROBADO', mensaje: 'Solo se devuelven pagos aprobados' }, 409);
    if (!(await this.reservar(intento.id, intento.devuelto_centimos, p.montoCentimos))) {
      throw new HttpException({ codigo: 'DEVOLUCION_EN_CURSO', mensaje: 'Hay otra devolución en curso. Intenta de nuevo.' }, 409);
    }

    let devolucionId: string | undefined;
    try {
      if (p.verificarPrevio) {
        const c = await this.pasarela.consultarCargo(intento.culqi_cargo_id).catch(() => null);
        if (c && c.devueltoCentimos >= intento.devuelto_centimos + p.montoCentimos) devolucionId = `culqi_previo_${p.ref}`;
      }
      devolucionId ??= (await this.pasarela.devolver({ cargoId: intento.culqi_cargo_id, montoCentimos: p.montoCentimos, motivo: p.motivo })).devolucionId;
    } catch (e: any) {
      await this.liberar(intento.id, p.montoCentimos);
      throw new ErrorReembolso(String(e?.message ?? 'sin detalle').slice(0, 200));
    }
    const { totalDevuelto, montoTotal } = await this.anotar(intento.id, {
      id: devolucionId, monto_centimos: p.montoCentimos, en: new Date().toISOString(), motivo: p.motivo, origen: 'SISTEMA', medio: 'CULQI', ref: p.ref,
    });
    return { devolucionId, totalDevuelto, montoTotal, repetido: false };
  }
}

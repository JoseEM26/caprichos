import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MEDIOS_DIGITALES_PLAN } from '../pedidos/pago-plan.service';

/** Medios digitales: siempre llevan la foto del comprobante (la IA solo informa, nunca aprueba). */
export const MEDIOS_CON_COMPROBANTE = ['YAPE', 'PLIN', 'TRANSFERENCIA'];

/** Medios que piden el código de operación al confirmar (Yape, Plin, transferencia y tarjeta, como MEDIOS_CON_VOUCHER_CAJA). */
// La tarjeta no lleva voucher ni lectura de IA en esta pantalla: no se pide código de operación
export const MEDIOS_CON_CODIGO_OPERACION = ['YAPE', 'PLIN', 'TRANSFERENCIA'];

/**
 * Medios que necesitan código de operación: los digitales del plan (pago dividido) y el medio elegido, si aplica.
 * El efectivo nunca pide código. Igual que la web (mediosQueExigenCodigo en mediosPago.ts).
 */
export function mediosQueExigenCodigo(metodo: string | null | undefined, planPago?: ReadonlyArray<{ medio: string }> | null): string[] {
  const medios = [...(planPago ?? []).map((f) => f.medio), metodo ?? ''].map((m) => String(m).toUpperCase().trim());
  return [...new Set(medios.filter((m) => MEDIOS_CON_CODIGO_OPERACION.includes(m)))];
}

const NOMBRE_MEDIO_DIGITAL: Record<string, string> = {
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFERENCIA: 'Transferencia',
};

export interface SinVoucherEntrada {
  motivo: string;
  pinSupervisor?: string;
}

export interface SinVoucherAutorizado {
  motivo: string;
  supervisorPartyId: string;
  /** Medios digitales que se cobraron sin captura (vacío si no hizo falta la excepción). */
  faltan: string[];
  /** true: salió por la casilla «ya hablé con el cliente y pagó» (local), sin motivo ni supervisor. */
  sinCaptura?: boolean;
}

/** Pedido del local (mozo o caja, no delivery): el único que puede pasar sin captura con la casilla de confirmación. */
export function esPedidoLocalSinCaptura(p: { canal?: string | null; modalidad?: string | null }): boolean {
  return ['MOZO', 'CAJA'].includes(String(p.canal ?? '')) && String(p.modalidad ?? '') !== 'DELIVERY';
}

export const MENSAJE_SIN_CAPTURA = 'Pagado sin captura: confirmado por el personal (el cliente ya pagó)';

/** Texto de la casilla única, igual en la web. */
export function textoConfirmaSinCaptura(medio: string): string {
  return `Confirmo que ya hablé con el cliente y pagó con ${NOMBRE_MEDIO_DIGITAL[medio] ?? medio} (sin captura)`;
}

type ClienteVouchers = Pick<Prisma.TransactionClient, 'voucherPago'>;

/** Voucher útil del pedido: vigente (no reemplazado), enlazado y no ILEGIBLE. Un ILEGIBLE no cuenta como comprobante. */
export async function hayVoucherUtil(db: ClienteVouchers, pedidoId: bigint): Promise<boolean> {
  const voucher = await db.voucherPago.findFirst({
    where: { pedido_id: pedidoId, reemplazado_en: null, semaforo: { not: 'ILEGIBLE' } },
    select: { id: true },
  });
  return voucher !== null;
}

/**
 * Un voucher cubre un medio si es de ese medio o no tiene medio (vouchers antiguos: cubren cualquiera).
 * Compartido por el cobro y por "Mis pedidos" para que la web vea lo mismo que exige el servidor.
 */
export function voucherCubreMedio(medioVoucher: string | null | undefined, medio: string): boolean {
  return medioVoucher == null || medioVoucher === medio;
}

/** Medios digitales del plan que todavía no tienen captura vigente y legible. */
export async function mediosSinCaptura(
  db: ClienteVouchers,
  pedidoId: bigint,
  medios: string[],
): Promise<string[]> {
  const vouchers = await db.voucherPago.findMany({
    where: { pedido_id: pedidoId, reemplazado_en: null, semaforo: { not: 'ILEGIBLE' } },
    select: { medio: true },
  });
  return medios.filter((m) => !vouchers.some((v) => voucherCubreMedio(v.medio, m)));
}

/**
 * Regla del comprobante para los pagos digitales.
 * - Pedido con plan de 2 o más medios digitales: hace falta una captura útil por CADA uno (planPago).
 * - Si no, la regla de siempre: un voucher útil del pedido basta si alguno de los medios es digital.
 * Si falta, lanza VOUCHER_REQUERIDO con `faltan`, salvo que el rol pueda usar la excepción: entonces
 * verifica el código del supervisor y devuelve la autorización (con los medios que faltaron) para auditar.
 */
export async function exigirComprobanteDigital(args: {
  db: ClienteVouchers;
  pedidoId: bigint;
  medios: Array<string | null | undefined>;
  /** Plan de pago del pedido (solo se lee el medio). */
  planPago?: ReadonlyArray<{ medio: string }> | null;
  sinVoucher?: SinVoucherEntrada;
  /** Casilla «ya hablé con el cliente y pagó»: solo vale si `pedidoLocal` (mozo/caja, no delivery). */
  confirmaSinCaptura?: boolean;
  pedidoLocal?: boolean;
  permiteExcepcion: boolean;
  verificarPin: (pin: string | undefined) => Promise<{ party_id?: bigint; supervisorPartyId?: bigint }>;
}): Promise<SinVoucherAutorizado | null> {
  const digitalesPlan = [
    ...new Set((args.planPago ?? []).map((f) => f.medio).filter((m) => (MEDIOS_DIGITALES_PLAN as readonly string[]).includes(m))),
  ];

  let faltan: string[];
  if (digitalesPlan.length >= 2) {
    faltan = await mediosSinCaptura(args.db, args.pedidoId, digitalesPlan);
  } else {
    const digitales = args.medios
      .map((m) => String(m ?? '').toUpperCase().trim())
      .filter((m) => MEDIOS_CON_COMPROBANTE.includes(m));
    if (digitales.length === 0) return null;
    if (await hayVoucherUtil(args.db, args.pedidoId)) return null;
    faltan = [...new Set(digitales)];
  }
  if (faltan.length === 0) return null;

  if (args.confirmaSinCaptura && args.pedidoLocal) {
    return { motivo: MENSAJE_SIN_CAPTURA, supervisorPartyId: '', faltan, sinCaptura: true };
  }

  if (!args.permiteExcepcion || !args.sinVoucher) {
    const nombres = faltan.map((m) => NOMBRE_MEDIO_DIGITAL[m] ?? m).join(', ');
    const cabecera =
      faltan.length === 1 ? `Falta la captura de ${nombres}` : `Faltan las capturas de ${nombres}`;
    throw new BadRequestException({
      codigo: 'VOUCHER_REQUERIDO',
      faltan,
      mensaje: args.permiteExcepcion
        ? `${cabecera}. Sube la foto, o marca que ya hablaste con el cliente y pagó (sin captura).`
        : `${cabecera}. Sube la foto del voucher para cobrar.`,
    });
  }

  const sup = await args.verificarPin(args.sinVoucher.pinSupervisor);
  return {
    motivo: args.sinVoucher.motivo.trim(),
    supervisorPartyId: String(sup?.supervisorPartyId ?? sup?.party_id ?? ''),
    faltan,
  };
}

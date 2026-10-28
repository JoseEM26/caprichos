import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Medios digitales: siempre llevan la foto del comprobante (la IA solo informa, nunca aprueba). */
export const MEDIOS_CON_COMPROBANTE = ['YAPE', 'PLIN', 'TRANSFERENCIA'];

export interface SinVoucherEntrada {
  motivo: string;
  pinSupervisor: string;
}

export interface SinVoucherAutorizado {
  motivo: string;
  supervisorPartyId: string;
}

type ClienteVouchers = Pick<Prisma.TransactionClient, 'voucherPago'>;

/** Voucher útil del pedido: enlazado y no ILEGIBLE. Un voucher ILEGIBLE no cuenta como comprobante. */
export async function hayVoucherUtil(db: ClienteVouchers, pedidoId: bigint): Promise<boolean> {
  const voucher = await db.voucherPago.findFirst({
    where: { pedido_id: pedidoId, semaforo: { not: 'ILEGIBLE' } },
    select: { id: true },
  });
  return voucher !== null;
}

/**
 * Regla del comprobante para los pagos digitales. Si ninguno de los medios exige foto, o el pedido ya
 * tiene un voucher útil, no hace nada (null). Si falta, lanza VOUCHER_REQUERIDO, salvo que el rol pueda
 * usar la excepción: entonces verifica el código del supervisor y devuelve la autorización para auditar.
 */
export async function exigirComprobanteDigital(args: {
  db: ClienteVouchers;
  pedidoId: bigint;
  medios: Array<string | null | undefined>;
  sinVoucher?: SinVoucherEntrada;
  permiteExcepcion: boolean;
  verificarPin: (pin: string) => Promise<{ party_id?: bigint; supervisorPartyId?: bigint }>;
}): Promise<SinVoucherAutorizado | null> {
  const exige = args.medios.some((m) =>
    MEDIOS_CON_COMPROBANTE.includes(String(m ?? '').toUpperCase().trim()),
  );
  if (!exige) return null;
  if (await hayVoucherUtil(args.db, args.pedidoId)) return null;

  if (!args.permiteExcepcion || !args.sinVoucher) {
    throw new BadRequestException({
      codigo: 'VOUCHER_REQUERIDO',
      mensaje: args.permiteExcepcion
        ? 'Falta una foto legible del comprobante del pago digital. Sube otra foto, o registra el pago sin voucher con motivo y código del supervisor.'
        : 'Falta una foto legible del comprobante del pago digital. Sube otra foto del voucher para cobrar.',
    });
  }

  const sup = await args.verificarPin(args.sinVoucher.pinSupervisor);
  return {
    motivo: args.sinVoucher.motivo.trim(),
    supervisorPartyId: String(sup?.supervisorPartyId ?? sup?.party_id ?? ''),
  };
}

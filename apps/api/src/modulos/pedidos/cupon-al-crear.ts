import { HttpException } from '@nestjs/common';

/** Resultado de dar el cupón junto con el pedido. Un pedido nunca falla por el cupón: si no se puede, va aquí el motivo. */
export interface ResultadoCuponAlCrear {
  cuponDado?: { codigo: string; descripcion: string | null; venceEn: string | null; yaExistia: boolean };
  cuponNoDado?: { motivo: string };
}

type DarCuponFn = (cuponId: string, pedidoId: string, usuario?: { partyId?: bigint | string | number }) => Promise<any>;

/**
 * Da el cupón «Lo da el personal» con la misma regla que el botón del detalle (OfertasService.darCupon: vigencia, cupo,
 * un cupón por pedido, auditoría). Cualquier error de negocio se devuelve como `cuponNoDado` y no se relanza.
 */
export async function darCuponAlCrear(
  darCupon: DarCuponFn,
  pedidoId: bigint,
  cuponDarId: string,
  usuarioPartyId?: bigint | string | number,
): Promise<ResultadoCuponAlCrear> {
  try {
    const emitido = await darCupon(cuponDarId, pedidoId.toString(), { partyId: usuarioPartyId });
    return {
      cuponDado: {
        codigo: emitido.codigo,
        descripcion: emitido.descripcion ?? null,
        venceEn: emitido.venceEn ?? null,
        yaExistia: emitido.yaExistia === true,
      },
    };
  } catch (err) {
    if (err instanceof HttpException) {
      const r: any = err.getResponse();
      return { cuponNoDado: { motivo: (typeof r === 'object' && r?.mensaje) || 'el cupón no está disponible' } };
    }
    return { cuponNoDado: { motivo: 'error inesperado; puedes darlo después desde el detalle del pedido' } };
  }
}

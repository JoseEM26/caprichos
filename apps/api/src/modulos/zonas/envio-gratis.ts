import { reglaEnvioGratis, ReglaEnvioGratis } from '@caprichos/compartido';

/** Lee envio_gratis_monto y envio_gratis_modo de la tabla parametro (valores por defecto si faltan). */
export async function leerReglaEnvioGratis(prisma: {
  parametro: { findUnique: (args: { where: { clave: string } }) => Promise<{ valor: unknown } | null> };
}): Promise<ReglaEnvioGratis> {
  const [monto, modo] = await Promise.all([
    prisma.parametro.findUnique({ where: { clave: 'envio_gratis_monto' } }),
    prisma.parametro.findUnique({ where: { clave: 'envio_gratis_modo' } }),
  ]);
  return reglaEnvioGratis(monto?.valor, modo?.valor);
}

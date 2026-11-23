import type { PrismaService } from '../../../comun/prisma/prisma.service';

export const HORAS_VENTANA_AVISO = 24;
/** evolution_resumen_contacto_dias por defecto: 6 meses. */
export const DIAS_RESUMEN_CONTACTO_DEFECTO = 180;

/**
 * ¿El celular escribió lo bastante cerca para que el aviso salga solo? Los avisos del pedido piden 24 h; el resumen («recibido»)
 * acepta además a quien escribió en los últimos `diasResumen` días (0 = solo 24 h). Lo usan la política de Evolution y la carta
 * (botonWhatsapp), en un archivo ligero para que no diverjan ni arrastren el gateway.
 */
export async function escribioParaAviso(
  prisma: Pick<PrismaService, 'whatsappMensaje'>,
  telefonoHash: string,
  esResumen: boolean,
  diasResumen: number,
  ahora = new Date(),
): Promise<boolean> {
  const horas = esResumen ? Math.max(HORAS_VENTANA_AVISO, (Number(diasResumen) || 0) * 24) : HORAS_VENTANA_AVISO;
  const desde = new Date(ahora.getTime() - horas * 3_600_000);
  return (await prisma.whatsappMensaje.count({ where: { telefono_hash: telefonoHash, direccion: 'ENTRANTE', creado_en: { gte: desde } } })) > 0;
}

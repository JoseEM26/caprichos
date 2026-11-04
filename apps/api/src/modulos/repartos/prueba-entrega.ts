import { PrismaService } from '../../comun/prisma/prisma.service';

/** Incidentes NO_CONTESTA con llegada registrada: lo que el repartidor subió como prueba. */
export const SELECT_PRUEBA_INCIDENTE = {
  llego_en: true,
  espera_max_min: true,
  repartidor_party_id: true,
  en: true,
  fotos: { select: { archivo_id: true }, orderBy: { archivo_id: 'asc' as const } },
};

export interface PruebaEntregaFallida {
  llego_en: Date;
  minutos_espera: number | null;
  repartidor: string | null;
  reportado_en: Date;
  /** Ids de archivos privados (se piden a /admin/archivos/:id). Nunca salen en el seguimiento del cliente. */
  fotos: string[];
}

/** Vista de la prueba de entrega fallida para admin/caja/supervisor. Null si no hubo llegada registrada. */
export async function construirPruebaEntrega(
  prisma: PrismaService,
  inc: any | null | undefined,
): Promise<PruebaEntregaFallida | null> {
  if (!inc?.llego_en) return null;

  let repartidor: string | null = null;
  if (inc.repartidor_party_id != null) {
    const persona = await prisma.person.findFirst({
      where: { party_id: inc.repartidor_party_id },
      select: { nombres: true, apellidos: true },
    });
    if (persona) repartidor = `${persona.nombres} ${persona.apellidos || ''}`.trim();
  }

  return {
    llego_en: inc.llego_en,
    minutos_espera: inc.espera_max_min ?? null,
    repartidor,
    reportado_en: inc.en,
    fotos: (inc.fotos ?? []).map((f: any) => String(f.archivo_id)),
  };
}

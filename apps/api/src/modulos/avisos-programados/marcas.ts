import { PrismaService } from '../../comun/prisma/prisma.service';

/**
 * Reclama una marca de idempotencia (clave única en aviso_marca). Devuelve true solo a quien la crea:
 * con varias instancias del API (o un reinicio) un aviso programado sale una sola vez.
 */
export async function reclamarMarca(
  prisma: PrismaService,
  clave: string,
  tipo: string,
  referencia: string | null,
  ahora: Date,
): Promise<boolean> {
  try {
    await prisma.avisoMarca.create({ data: { clave, tipo, referencia, creado_en: ahora } });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2002') return false;
    throw err;
  }
}

export async function leerParametro(prisma: PrismaService, clave: string): Promise<unknown> {
  const p = await prisma.parametro.findUnique({ where: { clave } });
  return p?.valor;
}

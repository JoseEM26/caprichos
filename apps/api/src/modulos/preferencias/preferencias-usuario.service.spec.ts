import { PreferenciasUsuarioService } from './preferencias-usuario.service';

/** Prisma falso con la tabla preferencia_usuario en memoria (clave compuesta party_id + clave). */
function prismaConTabla() {
  const filas = new Map<string, { party_id: bigint; clave: string; valor: unknown }>();
  const k = (p: bigint, c: string) => `${p}|${c}`;
  const prisma: any = {
    preferenciaUsuario: {
      findUnique: jest.fn(async ({ where }: any) => {
        const { party_id, clave } = where.party_id_clave;
        return filas.get(k(party_id, clave)) ?? null;
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const { party_id, clave } = where.party_id_clave;
        const previa = filas.get(k(party_id, clave));
        const fila = previa ? { ...previa, ...update } : { ...create };
        filas.set(k(party_id, clave), fila);
        return fila;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const borradas = [...filas.values()].filter((f) => f.party_id === where.party_id && f.clave === where.clave);
        borradas.forEach((f) => filas.delete(k(f.party_id, f.clave)));
        return { count: borradas.length };
      }),
    },
  };
  return { prisma, filas };
}

describe('PreferenciasUsuarioService', () => {
  it('guarda, lee y persiste entre dos lecturas separadas', async () => {
    const { prisma } = prismaConTabla();
    const service = new PreferenciasUsuarioService(prisma);

    expect(await service.obtener(7n, 'x.clave')).toBeUndefined();
    await service.guardar(7n, 'x.clave', false);
    expect(await service.obtener(7n, 'x.clave')).toBe(false);
    // Otra instancia (otro día, otro equipo) lee lo mismo: está en la base, no en memoria del servicio
    expect(await new PreferenciasUsuarioService(prisma).obtener('7', 'x.clave')).toBe(false);
  });

  it('reemplaza el valor al guardar de nuevo, sin duplicar', async () => {
    const { prisma, filas } = prismaConTabla();
    const service = new PreferenciasUsuarioService(prisma);
    await service.guardar(7n, 'x.clave', true);
    await service.guardar(7n, 'x.clave', false);
    expect(await service.obtener(7n, 'x.clave')).toBe(false);
    expect(filas.size).toBe(1);
  });

  it('borrar quita la preferencia y no falla si no existe', async () => {
    const { prisma } = prismaConTabla();
    const service = new PreferenciasUsuarioService(prisma);
    await service.guardar(7n, 'x.clave', true);
    await service.borrar(7n, 'x.clave');
    expect(await service.obtener(7n, 'x.clave')).toBeUndefined();
    await expect(service.borrar(7n, 'x.clave')).resolves.toBeUndefined();
  });

  it('las preferencias de un usuario no se ven desde otro', async () => {
    const { prisma } = prismaConTabla();
    const service = new PreferenciasUsuarioService(prisma);
    await service.guardar(7n, 'x.clave', false);
    expect(await service.obtener(8n, 'x.clave')).toBeUndefined();
  });
});

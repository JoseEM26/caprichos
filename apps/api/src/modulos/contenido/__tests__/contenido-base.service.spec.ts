import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ContenidoBaseService } from '../contenido-base.service';

describe('ContenidoBaseService', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-'));
    fs.mkdirSync(path.join(dir, 'publico/seed'), { recursive: true });
    for (const f of ['frappe_maracuya', 'frappe_oreo', 'mocaccino', 'waffle_oreo']) fs.writeFileSync(path.join(dir, `publico/seed/${f}.webp`), 'x');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const armar = (o: { destacadas?: number; sinFoto?: any[]; novedadesSinFoto?: any[] } = {}) => {
    const prisma: any = {
      producto: { findMany: jest.fn().mockResolvedValue(o.sinFoto ?? []), update: jest.fn().mockResolvedValue({}) },
      novedad: { findMany: jest.fn().mockResolvedValue(o.novedadesSinFoto ?? []) },
      novedadFoto: { create: jest.fn().mockResolvedValue({}) },
      archivo: { upsert: jest.fn().mockImplementation(({ where }: any) => Promise.resolve({ id: BigInt(where.ruta.length) })) },
      destacada: { count: jest.fn().mockResolvedValue(o.destacadas ?? 0), create: jest.fn().mockResolvedValue({}) },
    };
    return { prisma, servicio: new ContenidoBaseService(prisma, { get: () => dir } as any) };
  };

  it('con destacadas vacías crea los dos círculos con varias fotos existentes', async () => {
    const { prisma, servicio } = armar();
    expect(await servicio.asegurar()).toEqual({ fotos: 0, novedades: 0, destacadas: 2 });
    const [mes, momentos] = prisma.destacada.create.mock.calls.map((c: any) => c[0].data);
    expect(mes.titulo).toBe('Caprichos del mes');
    expect(mes.fotos.create).toHaveLength(3); // solo las que existen en disco
    expect(momentos.titulo).toBe('Momentos Caprichos');
    expect(momentos.fotos.create.length).toBeGreaterThan(5); // 5 de marca + mocaccino
    const rutas = prisma.archivo.upsert.mock.calls.map((c: any) => c[0].where.ruta);
    expect(rutas).toContain('/imagenes/caprichos/caprichos-del-mes.webp');
    expect(rutas).not.toContain('publico/seed/duo_irresistible.webp');
  });

  it('no pisa lo que el admin ya cargó y es idempotente', async () => {
    const { prisma, servicio } = armar({ destacadas: 1 });
    expect(await servicio.asegurar()).toEqual({ fotos: 0, novedades: 0, destacadas: 0 });
    expect(prisma.destacada.create).not.toHaveBeenCalled();
  });

  it('enlaza foto solo a productos sin foto y con archivo en disco', async () => {
    const { prisma, servicio } = armar({
      destacadas: 1,
      sinFoto: [{ id: BigInt(1), nombre: 'FRAPPE OREO' }, { id: BigInt(5), nombre: 'FRAPPE FIT' }],
    });
    expect(await servicio.enlazarFotosBase()).toBe(1);
    expect(prisma.producto.findMany.mock.calls[0][0].where.foto_archivo_id).toBeNull();
    expect(prisma.producto.update).toHaveBeenCalledTimes(1);
  });

  it('novedades: registra fotos solo a las que no tienen ninguna, con las que existen en disco', async () => {
    const { prisma, servicio } = armar({
      destacadas: 1,
      novedadesSinFoto: [{ id: BigInt(1), titulo: 'Fin de semana de waffles' }, { id: BigInt(2), titulo: 'Nuevo: Frappe Maracuyá Tropical' }],
    });
    expect(await servicio.enlazarFotosNovedades()).toBe(2);
    expect(prisma.novedad.findMany.mock.calls[0][0].where.fotos).toEqual({ none: {} });
    const datos = prisma.novedadFoto.create.mock.calls.map((c: any) => c[0].data);
    expect(datos).toHaveLength(2 + 0); // waffle_oreo + frappe_maracuya (frappe_strawberry/berries no existen en disco)
    expect(datos.map((d: any) => d.orden)).toEqual([0, 0]);
  });

  it('novedades: si todas ya tienen foto no crea nada (idempotente)', async () => {
    const { prisma, servicio } = armar({ destacadas: 1, novedadesSinFoto: [] });
    expect(await servicio.enlazarFotosNovedades()).toBe(0);
    expect(prisma.novedadFoto.create).not.toHaveBeenCalled();
    expect(prisma.archivo.upsert).not.toHaveBeenCalled();
  });

  it('onModuleInit no lanza si falla la base', async () => {
    const { prisma, servicio } = armar();
    prisma.producto.findMany.mockRejectedValue(new Error('caída'));
    await expect(servicio.onModuleInit()).resolves.toBeUndefined();
  });
});

describe('ContenidoBaseService: Fotos del local pasan a Conócenos una sola vez', () => {
  const fila = (slot: string, id: bigint, orden: number) => ({
    archivo_id: id,
    slot,
    orden,
    activo: true,
    archivo: { ruta: `publico/2026/10/${id}.webp` },
  });
  const armar = (o: { fotos?: any[]; publicado?: any; borrador?: any } = {}) => {
    const parametro = {
      findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
        where.clave === 'contenido_conocenos' ? o.publicado ?? null : where.clave === 'contenido_conocenos_borrador' ? o.borrador ?? null : null,
      ),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    };
    const prisma: any = { fotoLocal: { findMany: jest.fn().mockResolvedValue(o.fotos ?? []) }, parametro };
    return { prisma, servicio: new ContenidoBaseService(prisma, { get: () => '' } as any) };
  };

  it('crea la galería publicada con las fotos activas del local, en su orden, con su lugar de origen', async () => {
    const { prisma, servicio } = armar({ fotos: [fila('Fachada', 7n, 0), fila('Terraza', 9n, 3)] });
    expect(await servicio.copiarFotosLocalAConocenos()).toBe(1);
    expect(prisma.parametro.create).toHaveBeenCalledWith({
      data: {
        clave: 'contenido_conocenos',
        valor: {
          galeria: [
            { id: 'local-7', url: '/archivos/publico/2026/10/7.webp', activo: true, origen: 'Fachada' },
            { id: 'local-9', url: '/archivos/publico/2026/10/9.webp', activo: true, origen: 'Terraza' },
          ],
        },
      },
    });
  });

  it('si ya hay galería guardada no vuelve a copiar (queda independiente)', async () => {
    const { prisma, servicio } = armar({
      fotos: [fila('Fachada', 7n, 0)],
      publicado: { valor: { titulo: 'X', galeria: [] } },
      borrador: { valor: { galeria: [{ id: 'a', url: '/archivos/a.webp', activo: true }] } },
    });
    expect(await servicio.copiarFotosLocalAConocenos()).toBe(0);
    expect(prisma.parametro.update).not.toHaveBeenCalled();
    expect(prisma.parametro.create).not.toHaveBeenCalled();
  });

  it('una fila anterior sin galería recibe la copia y conserva lo demás; también el borrador', async () => {
    const { prisma, servicio } = armar({
      fotos: [fila('Fachada', 7n, 0)],
      publicado: { valor: { titulo: 'Publicado' } },
      borrador: { valor: { titulo: 'Borrador' } },
    });
    expect(await servicio.copiarFotosLocalAConocenos()).toBe(2);
    const llamadas = prisma.parametro.update.mock.calls.map((c: any) => c[0]);
    expect(llamadas[0].where.clave).toBe('contenido_conocenos');
    expect(llamadas[0].data.valor.titulo).toBe('Publicado');
    expect(llamadas[0].data.valor.galeria).toHaveLength(1);
    expect(llamadas[1].where.clave).toBe('contenido_conocenos_borrador');
    expect(llamadas[1].data.valor.titulo).toBe('Borrador');
  });

  it('sin fotos en el local no crea fila: Conócenos queda sin galería', async () => {
    const { prisma, servicio } = armar({ fotos: [] });
    expect(await servicio.copiarFotosLocalAConocenos()).toBe(0);
    expect(prisma.parametro.create).not.toHaveBeenCalled();
  });
});

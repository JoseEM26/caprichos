import { PantallaLocalService, nombreDePila, LISTO_VISIBLE_MIN } from '../pantalla-local.service';
import { pasaLimite } from '../pantalla-local.controller';

const AHORA = new Date('2026-11-20T20:00:00.000-05:00');
const hace = (min: number) => new Date(AHORA.getTime() - min * 60000);

function crear(param: unknown, filas: any[]) {
  const prisma: any = {
    parametro: { findUnique: jest.fn().mockResolvedValue(param === undefined ? null : { valor: param }) },
    pedido: { findMany: jest.fn().mockResolvedValue(filas) },
  };
  return { servicio: new PantallaLocalService(prisma), prisma };
}

const fila = (o: any) => ({ codigo: 'CP-W945', estado: 'COLA', modalidad: 'COMER_LOCAL', cliente_nombre: 'Lucía Pérez Gómez', creado_en: hace(8), pasa_cocina_en: hace(6), listo_en: null, ...o });

describe('PantallaLocalService', () => {
  it('nombreDePila deja solo la primera palabra', () => {
    expect(nombreDePila('  lUCÍA   Pérez ')).toBe('Lucía');
    expect(nombreDePila('123 456')).toBeNull();
    expect(nombreDePila(null)).toBeNull();
  });

  it('agrupa estados y modalidades, y nunca expone teléfono, documento ni apellidos', async () => {
    const { servicio } = crear('si', [
      fila({}),
      fila({ codigo: 'CP-A1', estado: 'LISTO', modalidad: 'RECOGER', listo_en: hace(3), cliente_telefono: '999888777' }),
    ]);
    const r = await servicio.pedidos(AHORA);
    expect(r.pedidos[0]).toEqual({ codigo: 'CP-W945', estado: 'PREPARANDO', modalidad: 'COMER_LOCAL', minutos: 6, nombre: 'Lucía', avatarUrl: null });
    expect(r.pedidos[1]).toMatchObject({ estado: 'LISTO', modalidad: 'LLEVAR', minutos: 3 });
    const texto = JSON.stringify(r);
    expect(texto).not.toContain('Pérez');
    expect(texto).not.toContain('999888777');
  });

  it('con el parámetro en «no» no manda ningún nombre', async () => {
    const { servicio } = crear('no', [fila({})]);
    const r = await servicio.pedidos(AHORA);
    expect(r.mostrarNombre).toBe(false);
    expect(r.pedidos[0].nombre).toBeNull();
  });

  it('por defecto (sin parámetro) muestra el nombre de pila', async () => {
    const { servicio } = crear(undefined, [fila({})]);
    expect((await servicio.pedidos(AHORA)).pedidos[0].nombre).toBe('Lucía');
  });

  it('consulta solo el día de Lima, comer en local y llevar (sin delivery) y los listos recientes', async () => {
    const { servicio, prisma } = crear('si', []);
    await servicio.pedidos(AHORA);
    const where = prisma.pedido.findMany.mock.calls[0][0].where;
    expect(where.creado_en.gte.toISOString()).toBe('2026-11-20T05:00:00.000Z');
    expect(where.modalidad.in).toEqual(['COMER_LOCAL', 'MESA', 'RECOGER']);
    expect(where.modalidad.in).not.toContain('DELIVERY');
    expect(where.OR[0].estado.in).toEqual(['COLA', 'PREPARANDO']);
    expect(where.OR[1].estado).toBe('LISTO');
    expect(where.OR[1].listo_en.gte.getTime()).toBe(AHORA.getTime() - LISTO_VISIBLE_MIN * 60000);
    // el select no pide teléfono ni documento
    const select = prisma.pedido.findMany.mock.calls[0][0].select;
    expect(select.cliente_telefono).toBeUndefined();
    expect(select.comprobante_doc).toBeUndefined();
  });

  it('guarda en caché unos segundos', async () => {
    const { servicio, prisma } = crear('si', []);
    await servicio.pedidos(AHORA);
    await servicio.pedidos(new Date(AHORA.getTime() + 3000));
    expect(prisma.pedido.findMany).toHaveBeenCalledTimes(1);
    await servicio.pedidos(new Date(AHORA.getTime() + 9000));
    expect(prisma.pedido.findMany).toHaveBeenCalledTimes(2);
  });
});

describe('límite por IP', () => {
  it('corta pasadas las 60 consultas por minuto y se reinicia después', () => {
    const t = 1_000_000;
    for (let i = 0; i < 60; i++) expect(pasaLimite('1.1.1.1', t)).toBe(true);
    expect(pasaLimite('1.1.1.1', t)).toBe(false);
    expect(pasaLimite('1.1.1.1', t + 61000)).toBe(true);
  });
});

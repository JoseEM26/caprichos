jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { registerAsync: jest.fn() } }));
import { ForbiddenException } from '@nestjs/common';
import { PantallaLocalService, nombreDePila, LISTO_VISIBLE_MIN, ANULADO_VISIBLE_MIN } from '../pantalla-local.service';
import { PantallaLocalController } from '../pantalla-local.controller';
import { TvController } from '../../tv/tv.controller';

const AHORA = new Date('2026-11-20T20:00:00.000-05:00');
const hace = (min: number) => new Date(AHORA.getTime() - min * 60000);

function crear(param: unknown, filas: any[]) {
  const prisma: any = {
    parametro: { findUnique: jest.fn().mockResolvedValue(param === undefined ? null : { valor: param }) },
    pedido: { findMany: jest.fn().mockResolvedValue(filas) },
    person: { findMany: jest.fn().mockResolvedValue([{ party_id: 7n, avatar_url: '/archivos/retrato-7.png' }]) },
  };
  return { servicio: new PantallaLocalService(prisma), prisma };
}

const linea = (o: any = {}) => ({ id: 1n, nombre: 'Frappe', cantidad: 2, tamano: 'Grande', area_id: 10n, producto: null, opcionesElegidas: [], sabores: [], ...o });
const fila = (o: any = {}) => ({
  codigo: 'CP-W945',
  estado: 'PREPARANDO',
  modalidad: 'MESA',
  mesa_nombre: 'Mesa 4',
  cliente_nombre: 'Lucía Pérez Gómez',
  creado_en: hace(8),
  pasa_cocina_en: hace(6),
  listo_en: null,
  anulado_en: null,
  total: 30,
  pago_metodo: 'YAPE',
  pago_estado: 'PAGADO',
  planPago: [],
  comandas: [
    { area_id: 10n, estado: 'DESPEJADA', area: { nombre: 'Bebidas' } },
    { area_id: 11n, estado: 'PENDIENTE', area: { nombre: 'Salado' } },
  ],
  lineas: [linea(), linea({ id: 2n, nombre: 'Sándwich', area_id: 11n, tamano: null })],
  ...o,
});

describe('PantallaLocalService', () => {
  it('nombreDePila deja solo la primera palabra', () => {
    expect(nombreDePila('  lUCÍA   Pérez ')).toBe('Lucía');
    expect(nombreDePila('123 456')).toBeNull();
    expect(nombreDePila(null)).toBeNull();
  });

  it('arma la información completa: modalidad, mesa, productos, pago, estado por área y etapa', async () => {
    const { servicio } = crear('si', [fila()]);
    const [p] = (await servicio.pedidos(AHORA)).pedidos;
    expect(p).toMatchObject({ codigo: 'CP-W945', etapa: 'COCINA', modalidad: 'MESA', mesa: 'Mesa 4', nombre: 'Lucía', minutos: 8 });
    expect(p.pago).toMatchObject({ estado: 'PAGADO', total: 30, medios: [{ medio: 'YAPE', monto: 30 }] });
    expect(p.areas.map((a) => [a.areaNombre, a.listo])).toEqual([['Bebidas', true], ['Salado', false]]);
    expect(p.areas[0].lineas[0]).toMatchObject({ nombre: 'Frappe', cantidad: 2, tamano: 'Grande' });
    expect(p.areas[1].lineas[0].nombre).toBe('Sándwich');
  });

  it('sin comandas todavía el pedido está en caja, con todo en un bloque', async () => {
    const { servicio } = crear('si', [fila({ estado: 'COLA', pasa_cocina_en: null, comandas: [] })]);
    const [p] = (await servicio.pedidos(AHORA)).pedidos;
    expect(p.etapa).toBe('CAJA');
    expect(p.areas).toHaveLength(1);
    expect(p.areas[0].lineas.map((l) => l.nombre)).toEqual(['Frappe', 'Sándwich']);
  });

  it('LISTO y anulado cierran su tiempo en listo_en / anulado_en', async () => {
    const { servicio } = crear('si', [
      fila({ estado: 'LISTO', listo_en: hace(3) }),
      fila({ codigo: 'CP-X', estado: 'ANULADO', anulado_en: hace(1) }),
    ]);
    const r = await servicio.pedidos(AHORA);
    expect(r.pedidos[0]).toMatchObject({ etapa: 'LISTO', minutos: 5, fin: hace(3).toISOString() });
    expect(r.pedidos[1]).toMatchObject({ etapa: 'ANULADO', minutos: 7 });
  });

  it('delivery entra, con su zona y sin dirección, teléfono ni documento', async () => {
    const { servicio } = crear('si', [
      fila({
        modalidad: 'DELIVERY',
        mesa_nombre: null,
        zona: { codigo: 'MIRAFLORES' },
        entrega_direccion: 'Av. Secreta 123',
        entrega_referencia: 'casa azul',
        cliente_telefono: '999888777',
        comprobante_doc: '12345678',
      }),
    ]);
    const r = await servicio.pedidos(AHORA);
    expect(r.pedidos[0]).toMatchObject({ modalidad: 'DELIVERY', zona: 'MIRAFLORES', mesa: null });
    const texto = JSON.stringify(r);
    for (const secreto of ['Secreta', 'casa azul', '999888777', '12345678', 'Pérez']) expect(texto).not.toContain(secreto);
  });

  it('con el parámetro en «no» no manda ningún nombre ni retrato', async () => {
    const { servicio, prisma } = crear('no', [fila({ party_id: 7n })]);
    const r = await servicio.pedidos(AHORA);
    expect(r.mostrarNombre).toBe(false);
    expect(r.pedidos[0].nombre).toBeNull();
    expect(r.pedidos[0].avatarUrl).toBeNull();
    expect(prisma.person.findMany).not.toHaveBeenCalled();
  });

  it('el retrato sale solo si el cliente tiene uno', async () => {
    const { servicio } = crear('si', [fila({ party_id: 7n }), fila({ codigo: 'CP-B2', party_id: null })]);
    expect((await servicio.pedidos(AHORA)).pedidos.map((p) => p.avatarUrl)).toEqual(['/archivos/retrato-7.png', null]);
  });

  it('consulta el día de Lima: en curso, listos recientes y anulados recientes; el select no pide datos de contacto', async () => {
    const { servicio, prisma } = crear('si', []);
    await servicio.pedidos(AHORA);
    const { where, select } = prisma.pedido.findMany.mock.calls[0][0];
    expect(where.creado_en.gte.toISOString()).toBe('2026-11-20T05:00:00.000Z');
    expect(where.modalidad).toBeUndefined(); // ya incluye delivery
    expect(where.OR[0].estado.in).toEqual(['COLA', 'PREPARANDO']);
    expect(where.OR[1].listo_en.gte.getTime()).toBe(AHORA.getTime() - LISTO_VISIBLE_MIN * 60000);
    expect(where.OR[2].estado.in).toEqual(['ANULADO', 'RECHAZADO']);
    expect(where.OR[2].anulado_en.gte.getTime()).toBe(AHORA.getTime() - ANULADO_VISIBLE_MIN * 60000);
    for (const campo of ['cliente_telefono', 'comprobante_doc', 'entrega_direccion', 'entrega_lat']) expect(select[campo]).toBeUndefined();
  });

  it('guarda en caché unos segundos', async () => {
    const { servicio, prisma } = crear('si', []);
    await servicio.pedidos(AHORA);
    await servicio.pedidos(new Date(AHORA.getTime() + 2000));
    expect(prisma.pedido.findMany).toHaveBeenCalledTimes(1);
    await servicio.pedidos(new Date(AHORA.getTime() + 9000));
    expect(prisma.pedido.findMany).toHaveBeenCalledTimes(2);
  });
});

describe('acceso a los pedidos del local', () => {
  const servicio: any = { pedidos: jest.fn().mockResolvedValue({ pedidos: [] }) };
  const tv = new (TvController as any)({}, {}, {}, servicio);
  const req = (vista: string | null | undefined) => ({ tv: { vista } });

  it('la TV vinculada como PANTALLA_LOCAL lee los pedidos', async () => {
    await expect(tv.pedidosLocal(req('PANTALLA_LOCAL'))).resolves.toEqual({ pedidos: [] });
  });

  it('una TV de otra vista, o sin vista (antigua), recibe 403 sin datos', () => {
    for (const v of ['SALON_VIVO', 'COCINA', null, undefined]) {
      servicio.pedidos.mockClear();
      expect(() => tv.pedidosLocal(req(v))).toThrow(ForbiddenException);
      expect(servicio.pedidos).not.toHaveBeenCalled();
    }
  });

  it('la ruta pública vieja ya no existe: el controlador de la pantalla solo sirve con sesión (AccesoGuard + permiso)', () => {
    expect(Reflect.getMetadata('path', PantallaLocalController)).toBe('admin/pantalla-local');
    expect(Reflect.getMetadata('__guards__', PantallaLocalController)).toBeDefined();
  });
});

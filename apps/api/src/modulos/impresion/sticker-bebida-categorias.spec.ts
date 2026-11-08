jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
import { BadRequestException } from '@nestjs/common';
import { aplicarCambio, configAFila, filaAConfig } from './equipo-config';
import { CONFIG_EQUIPO_NUEVO, destinoDeTrabajo, equipoAcepta, vasoDescartadoPorCategoria } from './ruteo-impresion';
import { ImpresionService } from './impresion.service';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

const BEBIDAS = '7';
const FRAPPES = '11';
const CALIENTES = '12';
const cfg = (c: any) => ({ ...CONFIG_EQUIPO_NUEVO, configurado: true, etiquetera: true, stickerBebidaAreas: [BEBIDAS], ...c });
const pc = (id: bigint, c: any) => ({ id, areaId: null, conectado: true, config: cfg(c) });

describe('sticker de bebida: filtro por categoría (ruteo)', () => {
  it('sin lista (null) imprime todas las categorías, como antes', () => {
    expect(equipoAcepta(cfg({}), 'ETIQUETA_BEBIDA', [null, BEBIDAS], FRAPPES)).toBe(true);
    expect(equipoAcepta(cfg({}), 'ETIQUETA_BEBIDA', [null, BEBIDAS], CALIENTES)).toBe(true);
  });
  it('con lista solo imprime las marcadas; sin categoría conocida sale igual', () => {
    const c = cfg({ stickerBebidaCategorias: [FRAPPES] });
    expect(equipoAcepta(c, 'ETIQUETA_BEBIDA', [null, BEBIDAS], FRAPPES)).toBe(true);
    expect(equipoAcepta(c, 'ETIQUETA_BEBIDA', [null, BEBIDAS], CALIENTES)).toBe(false);
    expect(equipoAcepta(c, 'ETIQUETA_BEBIDA', [null, BEBIDAS], null)).toBe(true);
  });
  it('lista vacía: ninguna categoría', () => {
    expect(equipoAcepta(cfg({ stickerBebidaCategorias: [] }), 'ETIQUETA_BEBIDA', [null, BEBIDAS], FRAPPES)).toBe(false);
  });
  it('dos PC con filtros distintos: cada categoría va a la suya; si otra la tiene marcada no se pierde', () => {
    const ctx = { equipos: [pc(1n, { stickerBebidaCategorias: [FRAPPES] }), pc(2n, { stickerBebidaCategorias: [CALIENTES] })], areaBebidasId: 7n };
    expect(destinoDeTrabajo('ETIQUETA_BEBIDA', [null, BEBIDAS], ctx, FRAPPES)?.id).toBe(1n);
    expect(destinoDeTrabajo('ETIQUETA_BEBIDA', [null, BEBIDAS], ctx, CALIENTES)?.id).toBe(2n);
    expect(vasoDescartadoPorCategoria([null, BEBIDAS], CALIENTES, ctx)).toBe(false);
  });
  it('descartado solo si alguna PC lo tomaría sin el filtro; sin PC para el área sigue esperando', () => {
    const ctx = { equipos: [pc(1n, { stickerBebidaCategorias: [FRAPPES] })], areaBebidasId: 7n };
    expect(vasoDescartadoPorCategoria([null, BEBIDAS], CALIENTES, ctx)).toBe(true);
    expect(vasoDescartadoPorCategoria([null, BEBIDAS], FRAPPES, ctx)).toBe(false);
    expect(vasoDescartadoPorCategoria([null, BEBIDAS], CALIENTES, { equipos: [], areaBebidasId: 7n })).toBe(false);
  });
});

describe('sticker de bebida: configuración guardada', () => {
  const validas = new Set(['11', '12']);
  it('retrocompatible: una fila sin la lista queda en null (todas)', () => {
    expect(filaAConfig({ etiquetera: true, tamanos: {} }).stickerBebidaCategorias).toBeNull();
    expect(filaAConfig(null).stickerBebidaCategorias).toBeNull();
  });
  it('se guarda junto a la PC y se lee de vuelta', () => {
    const c = aplicarCambio(CONFIG_EQUIPO_NUEVO, { stickerBebidaCategorias: ['11', '11'] }, new Set(), validas);
    expect(c.stickerBebidaCategorias).toEqual(['11']);
    const fila: any = configAFila(c);
    expect(filaAConfig({ ...fila }).stickerBebidaCategorias).toEqual(['11']);
    expect(aplicarCambio(c, { stickerBebidaCategorias: null }, new Set(), validas).stickerBebidaCategorias).toBeNull();
  });
  it('valida: categoría inexistente o tipo erróneo es 400', () => {
    expect(() => aplicarCambio(CONFIG_EQUIPO_NUEVO, { stickerBebidaCategorias: ['99'] }, new Set(), validas)).toThrow(BadRequestException);
    expect(() => aplicarCambio(CONFIG_EQUIPO_NUEVO, { stickerBebidaCategorias: 'x' }, new Set(), validas)).toThrow(BadRequestException);
    expect(() => aplicarCambio(CONFIG_EQUIPO_NUEVO, { stickerBebidaCategorias: [5] }, new Set(), validas)).toThrow(BadRequestException);
  });
});

const pedido = () => ({
  id: 9n,
  codigo: 'PED-9',
  estado: 'ENTREGADO',
  modalidad: 'LLEVAR',
  total: 20,
  subtotal: 20,
  cliente_nombre: 'Rosa',
  creado_en: new Date(),
  planPago: [],
  cobros: [],
  lineas: [
    { id: 1n, cantidad: 1, nombre: 'Frappe de fresa', area_id: 7n, area: { nombre: 'Bebidas' }, producto: { categoria_id: 11n, categoria: { nombre: 'Frappes' } }, opcionesElegidas: [], sabores: [], subtotal: 10, precio_unit: 10 },
    { id: 2n, cantidad: 1, nombre: 'Café americano', area_id: 7n, area: { nombre: 'Bebidas' }, producto: { categoria_id: 12n, categoria: { nombre: 'Calientes' } }, opcionesElegidas: [], sabores: [], subtotal: 10, precio_unit: 10 },
  ],
});

describe('sticker de bebida: filtro al encolar, reimprimir y simular', () => {
  let prisma: any;
  let service: ImpresionService;
  let equipos: any[];
  const vasos = (fn: any) => fn.mock.calls.map((c: any) => c[0].data ?? c[0].create).filter((d: any) => d.tipo === 'ETIQUETA_BEBIDA');

  beforeEach(() => {
    equipos = [pc(1n, {})];
    let n = 100n;
    prisma = {
      printJob: {
        create: jest.fn(async () => ({ id: n++ })),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      pedido: { findUnique: jest.fn().mockResolvedValue(pedido()) },
      areaCocina: { findMany: jest.fn().mockResolvedValue([{ id: 7n, nombre: 'Bebidas' }]) },
      deviceKey: { findMany: jest.fn().mockResolvedValue([{ id: 1n, nombre: 'Caja' }, { id: 2n, nombre: 'Barra' }]), findFirst: jest.fn().mockResolvedValue(null) },
      parametro: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      comprobante: { findFirst: jest.fn().mockResolvedValue(null) },
      cuponEmitido: { findFirst: jest.fn().mockResolvedValue(null) },
      notificacion: { create: jest.fn() },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    service = new ImpresionService(prisma, { registrar: jest.fn() } as any);
    (service as any).equipos = { contexto: jest.fn(async () => ({ equipos, areaBebidasId: 7n })) };
  });

  it('retrocompatible: PC sin lista imprime los dos vasos', async () => {
    await service.encolarEtiquetasPedido(9n);
    expect(vasos(prisma.printJob.upsert)).toHaveLength(2);
  });
  it('solo frías: Frappe + Café caliente genera un sticker', async () => {
    equipos = [pc(1n, { stickerBebidaCategorias: [FRAPPES] })];
    await service.encolarEtiquetasPedido(9n);
    const v = vasos(prisma.printJob.upsert);
    expect(v).toHaveLength(1);
    expect(v[0].payload.bebidaNombre).toBe('Frappe de fresa');
    expect(v[0].destino_equipo_id).toBe(1n);
  });
  it('ninguna marcada: ningún sticker de vaso, sin error ni pendientes', async () => {
    equipos = [pc(1n, { stickerBebidaCategorias: [] })];
    await expect(service.encolarEtiquetasPedido(9n)).resolves.toBeUndefined();
    expect(vasos(prisma.printJob.upsert)).toHaveLength(0);
  });
  it('dos PC con filtros distintos: cada vaso va a la suya', async () => {
    equipos = [pc(1n, { stickerBebidaCategorias: [FRAPPES] }), pc(2n, { stickerBebidaCategorias: [CALIENTES] })];
    await service.encolarEtiquetasPedido(9n);
    const v = vasos(prisma.printJob.upsert);
    expect(v.map((d: any) => [d.payload.bebidaNombre, d.destino_equipo_id])).toEqual(
      expect.arrayContaining([['Frappe de fresa', 1n], ['Café americano', 2n]]),
    );
  });
  it('reimprimir respeta el filtro (sin error ni omitidos)', async () => {
    equipos = [pc(1n, { stickerBebidaCategorias: [FRAPPES] })];
    const r: any = await service.reimprimirPedido(9, { tipo: 'todo' }, { partyId: '3' } as any, '1.1.1.1');
    const v = vasos(prisma.printJob.create);
    expect(v).toHaveLength(1);
    expect(v[0].payload.bebidaNombre).toBe('Frappe de fresa');
    expect((r.omitidos ?? []).filter((o: any) => o.tipo === 'ETIQUETA_BEBIDA')).toHaveLength(0);
  });
  it('reimprimir etiqueta de bebidas respeta el filtro', async () => {
    equipos = [pc(1n, { stickerBebidaCategorias: [FRAPPES] })];
    await service.reimprimirEtiqueta('9', { tipo: 'BEBIDA' } as any);
    expect(vasos(prisma.printJob.create)).toHaveLength(1);
  });
  it('categoría de una bebida de combo se busca por el nombre del producto', async () => {
    prisma.producto = { findMany: jest.fn().mockResolvedValue([{ nombre: 'Latte', categoria_id: 12n }]) };
    const b: any[] = [{ bebidaNombre: 'Latte' }, { bebidaNombre: 'Otro', categoriaId: '11' }];
    await (service as any).anotarCategorias(b);
    expect(b[0].categoriaId).toBe('12');
    expect(b[1].categoriaId).toBe('11');
  });
  it('simulación respeta el filtro sin fallar', async () => {
    equipos = [pc(1n, { stickerBebidaCategorias: [FRAPPES] })];
    await expect(service.simularPedido('LLEVAR', { roles: ['ADMIN'], partyId: '1' } as any, 'ip')).resolves.toBeDefined();
  });
});

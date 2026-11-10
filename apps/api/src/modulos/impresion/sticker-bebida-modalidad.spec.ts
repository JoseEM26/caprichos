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

const MODS = (m: any) => ({ stickerBebidaCategoriasPorModalidad: m });
const A = (c: any, cat: string | null, mod: string | null) => equipoAcepta(cfg(c), 'ETIQUETA_BEBIDA', [null, BEBIDAS], cat, mod);

describe('sticker de bebida por tipo de pedido (ruteo)', () => {
  const regla = { stickerBebidaCategorias: [FRAPPES, CALIENTES], ...MODS({ COMER_LOCAL: [FRAPPES], DELIVERY: null }) };
  it('en el local solo frías; delivery (null) usa la general', () => {
    expect(A(regla, CALIENTES, 'COMER_LOCAL')).toBe(false);
    expect(A(regla, FRAPPES, 'COMER_LOCAL')).toBe(true);
    expect(A(regla, CALIENTES, 'DELIVERY')).toBe(true);
  });
  it('MESA y LOCAL cuentan como en el local', () => {
    expect(A(regla, CALIENTES, 'MESA')).toBe(false);
    expect(A(regla, CALIENTES, 'LOCAL')).toBe(false);
  });
  it('modalidad ausente o desconocida o clave ausente: regla general', () => {
    expect(A(regla, CALIENTES, null)).toBe(true);
    expect(A(regla, CALIENTES, 'XYZ')).toBe(true);
    expect(A(regla, CALIENTES, 'LLEVAR')).toBe(true);
  });
  it('RECOGER usa la de LLEVAR; la propia gana', () => {
    const c = { stickerBebidaCategorias: null, ...MODS({ LLEVAR: [FRAPPES] }) };
    expect(A(c, CALIENTES, 'RECOGER')).toBe(false);
    expect(A(c, CALIENTES, 'LLEVAR')).toBe(false);
    expect(A({ ...c, ...MODS({ LLEVAR: [FRAPPES], RECOGER: [CALIENTES] }) }, CALIENTES, 'RECOGER')).toBe(true);
  });
  it('arreglo vacío = ninguna en ese tipo; sin la regla nueva todo igual que antes', () => {
    expect(A({ stickerBebidaCategorias: null, ...MODS({ DELIVERY: [] }) }, FRAPPES, 'DELIVERY')).toBe(false);
    expect(A({ stickerBebidaCategorias: [FRAPPES] }, CALIENTES, 'DELIVERY')).toBe(false);
    expect(A({}, CALIENTES, 'DELIVERY')).toBe(true);
  });
  it('dos PC con reglas distintas por tipo; descartado solo si ninguna lo toma', () => {
    const ctx = { equipos: [pc(1n, MODS({ COMER_LOCAL: [FRAPPES] })), pc(2n, MODS({ COMER_LOCAL: [CALIENTES] }))], areaBebidasId: 7n };
    expect(destinoDeTrabajo('ETIQUETA_BEBIDA', [null, BEBIDAS], ctx, CALIENTES, 'MESA')?.id).toBe(2n);
    const solo = { equipos: [pc(1n, MODS({ COMER_LOCAL: [FRAPPES] }))], areaBebidasId: 7n };
    expect(vasoDescartadoPorCategoria([null, BEBIDAS], CALIENTES, solo, 'COMER_LOCAL')).toBe(true);
    expect(vasoDescartadoPorCategoria([null, BEBIDAS], CALIENTES, solo, 'DELIVERY')).toBe(false);
  });
});

describe('sticker de bebida por tipo de pedido (configuración)', () => {
  const validas = new Set(['11', '12']);
  it('se guarda, se lee de vuelta y null limpia', () => {
    const c = aplicarCambio(CONFIG_EQUIPO_NUEVO, { stickerBebidaCategoriasPorModalidad: { COMER_LOCAL: ['11', '11'], DELIVERY: null } }, new Set(), validas);
    expect(c.stickerBebidaCategoriasPorModalidad).toEqual({ COMER_LOCAL: ['11'] });
    expect(filaAConfig(configAFila(c) as any).stickerBebidaCategoriasPorModalidad).toEqual({ COMER_LOCAL: ['11'] });
    expect(aplicarCambio(c, { stickerBebidaCategoriasPorModalidad: null }, new Set(), validas).stickerBebidaCategoriasPorModalidad).toBeUndefined();
  });
  it('retrocompatible: fila de v0.4.82', () => {
    const c = filaAConfig({ etiquetera: true, tamanos: { bebidaCategorias: ['11'] } });
    expect(c.stickerBebidaCategorias).toEqual(['11']);
    expect(c.stickerBebidaCategoriasPorModalidad).toBeUndefined();
  });
  it('valida categoría, modalidad y tipos', () => {
    const f = (v: any) => () => aplicarCambio(CONFIG_EQUIPO_NUEVO, { stickerBebidaCategoriasPorModalidad: v }, new Set(), validas);
    expect(f({ DELIVERY: ['99'] })).toThrow(BadRequestException);
    expect(f({ MARTE: ['11'] })).toThrow(BadRequestException);
    expect(f({ DELIVERY: 'x' })).toThrow(BadRequestException);
    expect(f(['11'])).toThrow(BadRequestException);
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

describe('sticker de bebida por tipo de pedido: encolar, reimprimir y reasignar', () => {
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

  const conMod = (m: string) => prisma.pedido.findUnique.mockResolvedValue({ ...pedido(), modalidad: m });
  const REGLA = MODS({ COMER_LOCAL: [FRAPPES] }); // no calientes en el local, sí en delivery
  it.each([['COMER_LOCAL', 1], ['DELIVERY', 2], ['LLEVAR', 2], ['RECOGER', 2]])('encolar %s -> %i sticker(s)', async (m, n) => {
    equipos = [pc(1n, REGLA)];
    conMod(m as string);
    await service.encolarEtiquetasPedido(9n);
    expect(vasos(prisma.printJob.upsert)).toHaveLength(n as number);
  });
  it('reimprimir respeta la modalidad vigente', async () => {
    equipos = [pc(1n, REGLA)];
    conMod('COMER_LOCAL');
    await service.reimprimirPedido(9, { tipo: 'todo' }, { partyId: '3' } as any, '1.1.1.1');
    expect(vasos(prisma.printJob.create)).toHaveLength(1);
    prisma.printJob.create.mockClear();
    conMod('DELIVERY');
    await service.reimprimirPedido(9, { tipo: 'todo', otra_copia: true }, { partyId: '3' } as any, '1.1.1.1');
    expect(vasos(prisma.printJob.create)).toHaveLength(2);
  });
  it('reimprimir etiqueta de bebidas respeta la modalidad', async () => {
    equipos = [pc(1n, REGLA)];
    conMod('COMER_LOCAL');
    await service.reimprimirEtiqueta('9', { tipo: 'BEBIDA' } as any);
    expect(vasos(prisma.printJob.create)).toHaveLength(1);
  });
  it('dos PC con reglas distintas: el caliente en el local va a la otra y no se pierde', async () => {
    equipos = [pc(1n, REGLA), pc(2n, MODS({ COMER_LOCAL: [CALIENTES] }))];
    conMod('COMER_LOCAL');
    await service.encolarEtiquetasPedido(9n);
    expect(vasos(prisma.printJob.upsert).map((d: any) => [d.payload.bebidaNombre, d.destino_equipo_id])).toEqual(
      expect.arrayContaining([['Frappe de fresa', 1n], ['Café americano', 2n]]),
    );
  });
  it('sin la regla nueva se comporta como antes (dos vasos)', async () => {
    conMod('COMER_LOCAL');
    await service.encolarEtiquetasPedido(9n);
    expect(vasos(prisma.printJob.upsert)).toHaveLength(2);
  });
  it('reasignarPendientes descarta el pendiente que la modalidad ya no permite', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EquipoConfigService } = require('./equipo-config.service');
    const update = jest.fn().mockResolvedValue({});
    const pr: any = {
      printJob: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1n, tipo: 'ETIQUETA_BEBIDA', area_id: 7n, destino_equipo_id: 1n, payload: { areaId: '7', categoriaId: CALIENTES, modalidadFiltro: 'COMER_LOCAL' } },
          { id: 2n, tipo: 'ETIQUETA_BEBIDA', area_id: 7n, destino_equipo_id: 1n, payload: { areaId: '7', categoriaId: CALIENTES, modalidadFiltro: 'DELIVERY' } },
        ]),
        update,
      },
    };
    const svc = new EquipoConfigService(pr, undefined, undefined);
    svc.contexto = jest.fn(async () => ({ equipos: [pc(1n, REGLA)], areaBebidasId: 7n }));
    await svc.reasignarPendientes();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].where.id).toBe(1n);
    expect(update.mock.calls[0][0].data.estado).toBe('DESCARTADO');
  });
});

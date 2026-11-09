import { construirEtiquetasBebida, construirTicketComandaSalon } from '../impresion/constructor-etiquetas';
import {
  invalidarOpcionesMenosPedida,
  motivoResaltado,
  resaltadoDeLineas,
  marcadasDeGrupos,
  opcionesMenosPedidas,
  opcionesMenosPedidasPorProducto,
  TTL_MENOS_PEDIDA_MS,
  VENTANA_DIAS_MENOS_PEDIDA,
} from './opcion-menos-pedida';
import { ComandasService, lineasDeArea } from './comandas.service';
import { confirmarDespejarActivo } from './cocina.util';

jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

const DIA = 24 * 60 * 60 * 1000;

/** Prisma mínimo: un producto con un grupo de opciones (ids en orden) y las elecciones contadas. */
function prismaFalso(opts: {
  flag?: boolean;
  grupos?: string[][];
  conteos?: Array<{ opcion_id: bigint; n: number }>;
}) {
  return {
    producto: {
      findUnique: jest.fn().mockResolvedValue({ resaltar_opcion_menos_pedida: opts.flag ?? true }),
    },
    productoGrupo: {
      findMany: jest.fn().mockResolvedValue(
        (opts.grupos ?? [['201', '202', '203']]).map((ids) => ({
          grupo: { opciones: ids.map((id) => ({ id: BigInt(id) })) },
        })),
      ),
    },
    pedidoLineaOpcion: {
      groupBy: jest.fn().mockResolvedValue(
        (opts.conteos ?? []).map((c) => ({ opcion_id: c.opcion_id, _count: { _all: c.n } })),
      ),
    },
  } as any;
}

describe('opcionesMenosPedidas (cálculo puro)', () => {
  it('resalta la de menor conteo', () => {
    const conteos = new Map([['201', 5], ['202', 2], ['203', 9]]);
    expect(opcionesMenosPedidas(['201', '202', '203'], conteos)).toEqual(['202']);
  });

  it('empate TOTAL (todo en 0, o todas con el mismo conteo): no hay «menos pedida», no se resalta nada', () => {
    expect(opcionesMenosPedidas(['201', '202', '203'], new Map())).toEqual([]);
    expect(opcionesMenosPedidas(['201', '202'], new Map([['201', 3], ['202', 3]]))).toEqual([]);
  });

  it('empate en el mínimo: se resaltan TODAS las empatadas, no solo una', () => {
    const conteos = new Map([['201', 0], ['202', 4], ['203', 0]]);
    expect(opcionesMenosPedidas(['201', '202', '203'], conteos)).toEqual(['201', '203']);
  });

  it('grupo con una sola opción: no resaltar (no hay con qué comparar)', () => {
    expect(opcionesMenosPedidas(['201'], new Map())).toEqual([]);
    expect(opcionesMenosPedidas([], new Map())).toEqual([]);
  });

  it('marcadasDeGrupos: las menos pedidas de cada grupo con al menos dos opciones', () => {
    const marcadas = marcadasDeGrupos(
      [['201', '202'], ['301'], ['401', '402', '403']],
      new Map([['201', 3], ['202', 1], ['401', 2], ['402', 0], ['403', 0]]),
    );
    expect([...marcadas].sort()).toEqual(['202', '402', '403']);
  });
});

describe('opcionesMenosPedidasPorProducto (consulta, ventana y caché)', () => {
  beforeEach(() => invalidarOpcionesMenosPedida());

  it('cuenta solo la ventana de 30 días móviles y excluye anulados y rechazados', async () => {
    const prisma = prismaFalso({ conteos: [{ opcion_id: 202n, n: 2 }] });
    const ahora = new Date('2026-11-02T15:00:00.000Z');

    await opcionesMenosPedidasPorProducto(prisma, ['10'], ahora);

    const args = prisma.pedidoLineaOpcion.groupBy.mock.calls[0][0];
    expect(args.by).toEqual(['opcion_id']);
    expect(args.where.pedido_linea.producto_id).toBe(10n);
    expect(args.where.pedido_linea.pedido.creado_en.gte.getTime()).toBe(
      ahora.getTime() - VENTANA_DIAS_MENOS_PEDIDA * DIA,
    );
    expect(args.where.pedido_linea.pedido.estado.notIn).toEqual(['ANULADO', 'RECHAZADO']);
  });

  it('a inicio de mes la ventana usa días del mes pasado (no empieza de cero)', async () => {
    const prisma = prismaFalso({});
    const ahora = new Date('2026-11-01T12:00:00.000Z');

    await opcionesMenosPedidasPorProducto(prisma, ['10'], ahora);

    const desde = prisma.pedidoLineaOpcion.groupBy.mock.calls[0][0].where.pedido_linea.pedido.creado_en.gte;
    expect(desde.toISOString()).toBe('2026-10-02T12:00:00.000Z');
  });

  it('grupo inactivo no se resalta: no compite ni marca sus opciones', async () => {
    // Mock que respeta el filtro grupo.activo de la consulta (como Prisma)
    const prisma: any = prismaFalso({ conteos: [{ opcion_id: 201n, n: 3 }] });
    prisma.productoGrupo.findMany.mockImplementation(async (args: any) => {
      const grupos = [
        { activo: true, ids: ['201', '202'] },
        { activo: false, ids: ['301', '302'] },
      ];
      return grupos
        .filter((g) => g.activo === args.where.grupo.activo)
        .map((g) => ({ grupo: { opciones: g.ids.map((id) => ({ id: BigInt(id) })) } }));
    });

    const res = await opcionesMenosPedidasPorProducto(prisma, ['10']);

    expect(prisma.productoGrupo.findMany.mock.calls[0][0].where.grupo).toEqual({ activo: true });
    expect([...res.get('10')!]).toEqual(['202']);
  });

  it('check del producto apagado = nada: no cuenta ni marca', async () => {
    const prisma = prismaFalso({ flag: false });

    const res = await opcionesMenosPedidasPorProducto(prisma, ['10']);

    expect(res.get('10')?.size).toBe(0);
    expect(prisma.pedidoLineaOpcion.groupBy).not.toHaveBeenCalled();
  });

  it('usa la caché 10 minutos y vuelve a contar después', async () => {
    const prisma = prismaFalso({});
    const t0 = new Date('2026-11-02T10:00:00.000Z');

    await opcionesMenosPedidasPorProducto(prisma, ['10'], t0);
    await opcionesMenosPedidasPorProducto(prisma, ['10'], new Date(t0.getTime() + TTL_MENOS_PEDIDA_MS - 1000));
    expect(prisma.pedidoLineaOpcion.groupBy).toHaveBeenCalledTimes(1);

    await opcionesMenosPedidasPorProducto(prisma, ['10'], new Date(t0.getTime() + TTL_MENOS_PEDIDA_MS + 1000));
    expect(prisma.pedidoLineaOpcion.groupBy).toHaveBeenCalledTimes(2);
  });

  it('invalidar un producto obliga a volver a contar', async () => {
    const prisma = prismaFalso({});
    const t0 = new Date('2026-11-02T10:00:00.000Z');
    await opcionesMenosPedidasPorProducto(prisma, ['10'], t0);

    invalidarOpcionesMenosPedida('10');
    await opcionesMenosPedidasPorProducto(prisma, ['10'], t0);

    expect(prisma.pedidoLineaOpcion.groupBy).toHaveBeenCalledTimes(2);
  });
});

describe('listado de cocina con la opción menos pedida', () => {
  beforeEach(() => invalidarOpcionesMenosPedida());

  it('marca en la línea la opción elegida que es la menos pedida de su grupo', async () => {
    const prisma: any = prismaFalso({
      grupos: [['201', '202', '203']],
      conteos: [{ opcion_id: 201n, n: 3 }, { opcion_id: 202n, n: 1 }],
    });
    const hora = new Date(Date.now() - 5 * 60000);
    const linea = (id: bigint, opcion: bigint, nombre: string) => ({
      id,
      nombre: 'Latte',
      cantidad: 1,
      area_id: 1n,
      producto_id: 10n,
      nota: null,
      opcionesElegidas: [{ opcion_id: opcion, opcion_nombre: nombre, grupo_nombre: 'Leche' }],
    });
    const pedido = {
      id: 5n,
      codigo: 'CP-0005',
      estado: 'COLA',
      canal: 'CARTA',
      modalidad: 'LLEVAR',
      creado_en: hora,
      pasa_cocina_en: hora,
      comandas: [],
      lineas: [linea(1n, 203n, 'Almendra'), linea(2n, 201n, 'Entera')],
    };
    prisma.parametro = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.areaCocina = {
      findFirst: jest.fn().mockResolvedValue({ id: 1n, nombre: 'Bebidas', activo: true }),
      findMany: jest.fn().mockResolvedValue([{ id: 1n, nombre: 'Bebidas', activo: true }]),
    };
    prisma.pedido = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.comandaArea = {
      findMany: jest.fn().mockResolvedValue([
        { pedido_id: 5n, area_id: 1n, estado: 'EN_COCINA', llego_en: hora, pedido },
      ]),
    };

    const service = new ComandasService(prisma, { registrar: jest.fn() } as any);
    const [comanda] = await service.listarComandas('Bebidas');

    const opciones = (lineaId: string) => comanda.lineas.find((l: any) => l.id === lineaId).opciones;
    expect(opciones('1')[0]).toMatchObject({ nombre: 'Almendra', pocoPedida: true });
    expect(opciones('2')[0]).toMatchObject({ nombre: 'Entera', pocoPedida: false });
  });

  it('con el check del producto apagado ninguna opción queda marcada', async () => {
    const prisma: any = prismaFalso({ flag: false });
    const hora = new Date(Date.now() - 60000);
    prisma.parametro = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.areaCocina = {
      findFirst: jest.fn().mockResolvedValue({ id: 1n, nombre: 'Bebidas', activo: true }),
      findMany: jest.fn().mockResolvedValue([{ id: 1n, nombre: 'Bebidas', activo: true }]),
    };
    prisma.pedido = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.comandaArea = {
      findMany: jest.fn().mockResolvedValue([
        {
          pedido_id: 6n,
          area_id: 1n,
          estado: 'EN_COCINA',
          llego_en: hora,
          pedido: {
            id: 6n, codigo: 'CP-0006', estado: 'COLA', canal: 'CARTA', modalidad: 'LLEVAR',
            creado_en: hora, pasa_cocina_en: hora, comandas: [],
            lineas: [{ id: 3n, nombre: 'Latte', cantidad: 1, area_id: 1n, producto_id: 10n,
              opcionesElegidas: [{ opcion_id: 203n, opcion_nombre: 'Almendra', grupo_nombre: 'Leche' }] }],
          },
        },
      ]),
    };

    const service = new ComandasService(prisma, { registrar: jest.fn() } as any);
    const [comanda] = await service.listarComandas('Bebidas');

    expect(comanda.lineas[0].opciones[0].pocoPedida).toBe(false);
  });
});

describe('parámetro cocina_confirmar_despejar', () => {
  it('sin parámetro o con «si» pide confirmación; solo «no» la apaga', () => {
    expect(confirmarDespejarActivo(undefined)).toBe(true);
    expect(confirmarDespejarActivo('si')).toBe(true);
    expect(confirmarDespejarActivo('no')).toBe(false);
    expect(confirmarDespejarActivo(' NO ')).toBe(false);
    expect(confirmarDespejarActivo(false)).toBe(false);
  });

  it('obtenerAjustes lee el parámetro: «no» apaga la confirmación', async () => {
    const prisma: any = {
      parametro: { findUnique: jest.fn().mockResolvedValue({ clave: 'cocina_confirmar_despejar', valor: 'no' }) },
    };
    const service = new ComandasService(prisma, { registrar: jest.fn() } as any);
    await expect(service.obtenerAjustes()).resolves.toEqual({ confirmarDespejar: false });
  });

  it('obtenerAjustes sin fila en parametro: confirmación encendida', async () => {
    const prisma: any = { parametro: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new ComandasService(prisma, { registrar: jest.fn() } as any);
    await expect(service.obtenerAjustes()).resolves.toEqual({ confirmarDespejar: true });
  });
});

describe('resaltado manual («Resaltar siempre») y motivo', () => {
  const lineas = [
    { producto_id: 7n, opcionesElegidas: [{ opcion_id: 201n }, { opcion_id: 203n }] },
  ];

  it('manual marca aunque el check automático del producto esté apagado (no mira producto ni 30 días)', async () => {
    invalidarOpcionesMenosPedida();
    const prisma = {
      ...prismaFalso({ flag: false }),
      opcion: { findMany: jest.fn().mockResolvedValue([{ id: 203n }]) },
    };
    const r = await resaltadoDeLineas(prisma, lineas);
    expect(motivoResaltado(r, '7', '203')).toBe('MANUAL');
    expect(motivoResaltado(r, '7', '201')).toBeNull();
    expect(prisma.pedidoLineaOpcion.groupBy).not.toHaveBeenCalled();
  });

  it('automático marca la menos pedida; manual + automático no duplica y gana MANUAL', async () => {
    invalidarOpcionesMenosPedida();
    const prisma = {
      ...prismaFalso({ flag: true, conteos: [{ opcion_id: 201n, n: 5 }, { opcion_id: 202n, n: 4 }, { opcion_id: 203n, n: 1 }] }),
      opcion: { findMany: jest.fn().mockResolvedValue([{ id: 203n }]) },
    };
    const r = await resaltadoDeLineas(prisma, lineas);
    expect(motivoResaltado(r, '7', '203')).toBe('MANUAL');
    expect(motivoResaltado(r, '7', '201')).toBeNull();
    const auto = { automaticas: new Map([['7', new Set(['201'])]]), manuales: new Set<string>() };
    expect(motivoResaltado(auto, '7', '201')).toBe('MENOS_PEDIDA');
  });

  it('empate total en el producto con check encendido: nada se resalta', async () => {
    invalidarOpcionesMenosPedida();
    const prisma = {
      ...prismaFalso({ flag: true, conteos: [] }),
      opcion: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const r = await resaltadoDeLineas(prisma, lineas);
    expect(r.manuales.size).toBe(0);
    expect(r.automaticas.get('7')?.size).toBe(0);
  });

  it('lineasDeArea trae pocoPedida y motivoResaltado MANUAL (cocina por área y Despacho usan esta función)', () => {
    const l = {
      id: 1n, nombre: 'Frappé', cantidad: 1, producto_id: 7n, area_id: 1n,
      opcionesElegidas: [
        { opcion_id: 201n, grupo_nombre: 'Leche', opcion_nombre: 'Entera' },
        { opcion_id: 203n, grupo_nombre: 'Leche', opcion_nombre: 'Sin lactosa' },
      ],
    };
    const out = lineasDeArea([l], 1n, { automaticas: new Map(), manuales: new Set(['203']) });
    expect(out[0].opciones[0]).toMatchObject({ nombre: 'Entera', pocoPedida: false });
    expect(out[0].opciones[0]).not.toHaveProperty('motivoResaltado');
    expect(out[0].opciones[1]).toMatchObject({ nombre: 'Sin lactosa', pocoPedida: true, motivoResaltado: 'MANUAL' });
  });

  it('ticket y stickers imprimen la opción resaltada entre asteriscos', () => {
    const pedido = {
      id: 1n, codigo: 'CP-1', modalidad: 'LLEVAR', creado_en: new Date(), cliente_nombre: 'Ana',
      lineas: [{
        id: 1n, nombre: 'Frappé', cantidad: 1, area_id: 1n, tamano: null, area: { nombre: 'BARRA' },
        producto: { categoria: { nombre: 'FRAPPES' } },
        opcionesElegidas: [
          { opcion_id: 201n, opcion_nombre: 'Entera', grupo_nombre: 'Leche', resaltada: false },
          { opcion_id: 203n, opcion_nombre: 'Sin lactosa', grupo_nombre: 'Leche', resaltada: true },
        ],
      }],
    };
    expect(construirEtiquetasBebida(pedido)[0].opciones).toEqual(['Entera', '*Sin lactosa*']);
    expect(construirTicketComandaSalon(pedido).lineas[0].opciones).toEqual(['Entera', '*Sin lactosa*']);
  });
});

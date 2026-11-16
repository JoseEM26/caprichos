import { ImpresionService } from './impresion.service';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

describe('Etiquetas al editar un pedido: solo lo nuevo', () => {
  let service: ImpresionService;
  let prisma: any;
  let creados: any[];
  const bebida = (id: bigint, nombre: string, cantidad: number, tamano: string | null = null) => ({
    id, cantidad, nombre, tamano, area: { nombre: 'Bebidas' }, opciones: [], nota: null,
  });
  const pedido = (lineas: any[], mesa = '2') => ({
    id: 7n, codigo: 'CP-7', modalidad: 'DELIVERY', mesa_nombre: mesa, cliente_nombre: 'Luis', canal: 'CAJA', creado_en: new Date(), lineas,
  });

  beforeEach(() => {
    creados = [];
    prisma = {
      printJob: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: any) => { creados.push(data); return {}; }),
      },
      deviceKey: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      areaCocina: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      parametro: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findUnique: jest.fn() },
    };
    service = new ImpresionService(prisma, { registrar: jest.fn() } as any);
  });

  const bebidasNuevas = () => creados.filter((c) => c.tipo === 'ETIQUETA_BEBIDA');

  it('agregar una bebida a un pedido con 2: sale un solo sticker de bebida (el nuevo)', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido([bebida(1n, 'Latte', 2)]));
    const antes = await service.capturarEtiquetas(7n);
    prisma.pedido.findUnique.mockResolvedValue(pedido([bebida(1n, 'Latte', 2), bebida(2n, 'Mocha', 1)]));
    await service.encolarEtiquetasEditadas(7n, antes);
    expect(bebidasNuevas()).toHaveLength(1);
    expect(bebidasNuevas()[0].payload).toMatchObject({ bebidaNombre: 'Mocha', totalBebidas: 3 });
  });

  it('subir de 2 a 3 la misma bebida: sale solo el vaso que sobra', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido([bebida(1n, 'Latte', 2)]));
    const antes = await service.capturarEtiquetas(7n);
    prisma.pedido.findUnique.mockResolvedValue(pedido([bebida(1n, 'Latte', 3)]));
    await service.encolarEtiquetasEditadas(7n, antes);
    expect(bebidasNuevas()).toHaveLength(1);
  });

  it('cambiar de mesa no reimprime nada', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido([bebida(1n, 'Latte', 2)], '2'));
    const antes = await service.capturarEtiquetas(7n);
    prisma.pedido.findUnique.mockResolvedValue(pedido([bebida(1n, 'Latte', 2)], '5'));
    expect(await service.encolarEtiquetasEditadas(7n, antes)).toBe(0);
    expect(creados).toHaveLength(0);
  });

  it('cambiar el tamaño de una bebida reimprime solo esa', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido([bebida(1n, 'Latte', 1, 'Chico'), bebida(2n, 'Mocha', 1)]));
    const antes = await service.capturarEtiquetas(7n);
    prisma.pedido.findUnique.mockResolvedValue(pedido([bebida(1n, 'Latte', 1, 'Grande'), bebida(2n, 'Mocha', 1)]));
    await service.encolarEtiquetasEditadas(7n, antes);
    expect(bebidasNuevas()).toHaveLength(1);
    expect(bebidasNuevas()[0].payload).toMatchObject({ bebidaNombre: 'Latte', tamano: 'Grande' });
  });
});

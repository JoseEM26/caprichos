jest.mock('../../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

jest.mock('../../stock/producto-controlado', () => ({
  controlaPorSabor: () => false,
  validarSaboresLinea: jest.fn(),
  descontarVentaProductos: jest.fn(async () => ({ agotados: [], saboresAgotados: [] })),
  devolverCortesiaProductos: jest.fn(async () => 1),
}));

import { CortesiasService } from '../cortesias.service';

/** Prisma falso mínimo para la cortesía: pedido de referencia, producto, la cortesía y la transacción. */
function crearPrisma(over: Partial<Record<string, any>> = {}) {
  const prisma: any = {
    pedido: { findUnique: jest.fn(async () => ({ id: 900n, codigo: 'CP-W900' })), update: jest.fn(async () => ({})) },
    producto: {
      findUnique: jest.fn(async () => ({ id: 10n, nombre: 'Frappe', precio: 12, categoria: { area_id: 3n }, tamanos: [], sabores: [] })),
    },
    cortesia: {
      create: jest.fn(async (args: any) => ({ id: 77n, ...args.data })),
      findUnique: jest.fn(async () => null),
      update: jest.fn(async () => ({})),
    },
    pedidoLinea: { update: jest.fn(async () => ({})) },
    pedidoPagoPlan: { findMany: jest.fn(async () => []), update: jest.fn(), deleteMany: jest.fn() },
    ...over,
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  return prisma;
}

const auditoria = { registrar: jest.fn(async () => undefined) };
const usuario = { partyId: 5n, rol: 'CAJERO' } as any;

/** Stock falso: solo las funciones que la cortesía llama. */
function crearStock() {
  return {
    descontarInsumosCortesia: jest.fn(async () => ({ insumos: 1, insumosAgotados: [] })),
    revertirInsumosCortesia: jest.fn(async () => [1n]),
    verificarYReactivarAgotados: jest.fn(async () => ({})),
    descontarPorPedidoSeguro: jest.fn(async () => ({ ok: true })),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CortesiasService con insumos (control de almacén)', () => {
  it('registrar la cortesía separada consume sus insumos dentro de la transacción, con el área del producto', async () => {
    const prisma = crearPrisma();
    const stock = crearStock();
    const svc = new CortesiasService(prisma, auditoria as any, stock as any);

    await svc.registrarSeparada({ productoId: '10', cantidad: 2, motivo: 'PRUEBA', pedidoReferenciaId: '900' } as any, usuario);

    expect(stock.descontarInsumosCortesia).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ cortesiaId: 77n, productoId: 10n, areaId: 3n, tamanoValorId: null, cantidad: 2, por: 5n }),
    );
  });

  it('anular devuelve los insumos y reactiva lo que quedó agotado por ellos, dentro de la transacción', async () => {
    const prisma = crearPrisma({
      cortesia: {
        findUnique: jest.fn(async () => ({ id: 77n, pedido_id: null, anulada_en: null, cantidad: 2, producto: { nombre: 'Frappe', controla_stock: false } })),
        update: jest.fn(async () => ({})),
      },
    });
    const stock = crearStock();
    const svc = new CortesiasService(prisma, auditoria as any, stock as any);

    await svc.anular('77', 'Se registró por error', usuario);

    expect(stock.revertirInsumosCortesia).toHaveBeenCalledWith(prisma, 77n, 5n);
    expect(stock.verificarYReactivarAgotados).toHaveBeenCalledWith([1n], [], prisma);
  });

  it('anular sin insumos devueltos no toca la reactivación', async () => {
    const prisma = crearPrisma({
      cortesia: {
        findUnique: jest.fn(async () => ({ id: 77n, pedido_id: null, anulada_en: null, cantidad: 2, producto: { nombre: 'Frappe', controla_stock: false } })),
        update: jest.fn(async () => ({})),
      },
    });
    const stock = crearStock();
    stock.revertirInsumosCortesia.mockResolvedValueOnce([]);
    const svc = new CortesiasService(prisma, auditoria as any, stock as any);

    await svc.anular('77', 'Se registró por error', usuario);

    expect(stock.verificarYReactivarAgotados).not.toHaveBeenCalled();
  });

  it('una cortesía en línea que deja el pedido en S/ 0 descuenta sus insumos (el pedido nace pagado sin cobro)', async () => {
    const pedido = {
      id: 1n,
      codigo: 'CP-W001',
      estado: 'COLA',
      pago_estado: 'PENDIENTE',
      subtotal: 20,
      descuento: 0,
      envio: 0,
      total: 20,
      lineas: [{ id: 100n, nombre: 'Frappe', cantidad: 2, precio_unit: 10, subtotal: 20, es_cortesia: false, producto_id: 10n, linea_combo_id: null, oferta_id: null }],
      cobros: [],
      comprobante: [],
    };
    const prisma = crearPrisma({ pedido: { findUnique: jest.fn(async () => pedido), update: jest.fn(async () => ({})) } });
    const stock = crearStock();
    const svc = new CortesiasService(prisma, auditoria as any, stock as any);

    await svc.darEnLinea('1', '100', { motivo: 'ERROR_COCINA' }, usuario);

    expect(stock.descontarPorPedidoSeguro).toHaveBeenCalledWith(1n, 5n);
  });

  it('una cortesía en línea que deja el pedido con total positivo no descuenta nada todavía (se cobra después)', async () => {
    const pedido = {
      id: 1n,
      codigo: 'CP-W001',
      estado: 'COLA',
      pago_estado: 'PENDIENTE',
      subtotal: 30,
      descuento: 0,
      envio: 0,
      total: 30,
      lineas: [
        { id: 100n, nombre: 'Frappe', cantidad: 2, precio_unit: 10, subtotal: 20, es_cortesia: false, producto_id: 10n, linea_combo_id: null, oferta_id: null },
        { id: 101n, nombre: 'Waffle', cantidad: 1, precio_unit: 10, subtotal: 10, es_cortesia: false, producto_id: 11n, linea_combo_id: null, oferta_id: null },
      ],
      cobros: [],
      comprobante: [],
    };
    const prisma = crearPrisma({ pedido: { findUnique: jest.fn(async () => pedido), update: jest.fn(async () => ({})) } });
    const stock = crearStock();
    const svc = new CortesiasService(prisma, auditoria as any, stock as any);

    await svc.darEnLinea('1', '100', { motivo: 'ERROR_COCINA' }, usuario);

    expect(stock.descontarPorPedidoSeguro).not.toHaveBeenCalled();
  });

  it('sin el servicio de stock (control no disponible) la cortesía sigue igual', async () => {
    const prisma = crearPrisma();
    const svc = new CortesiasService(prisma, auditoria as any);
    await expect(svc.registrarSeparada({ productoId: '10', cantidad: 1, motivo: 'PRUEBA', pedidoReferenciaId: '900' } as any, usuario)).resolves.toMatchObject({ cantidad: 1 });
  });
});

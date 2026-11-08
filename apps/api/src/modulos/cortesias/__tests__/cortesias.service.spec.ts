import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

jest.mock('../../stock/producto-controlado', () => ({
  controlaPorSabor: () => false,
  validarSaboresLinea: jest.fn(),
  descontarVentaProductos: jest.fn(async () => ({ agotados: [], saboresAgotados: [] })),
}));

import { CortesiasService } from '../cortesias.service';
import { descontarVentaProductos } from '../../stock/producto-controlado';

function crearPrisma(over: Partial<Record<string, any>> = {}) {
  const prisma: any = {
    pedido: { findUnique: jest.fn(async () => null), update: jest.fn(async () => ({})) },
    producto: { findUnique: jest.fn(async () => null) },
    cortesia: { create: jest.fn(async (args: any) => ({ id: 77n, ...args.data })) },
    pedidoLinea: { update: jest.fn(async () => ({})) },
    pedidoPagoPlan: { findMany: jest.fn(async () => []), update: jest.fn() },
    ...over,
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  return prisma;
}

const auditoria = { registrar: jest.fn(async () => undefined) };
const usuario = { partyId: 5n, rol: 'CAJERO' } as any;
const pedidoRef = { id: 900n, codigo: 'CP-W900' };
const producto = {
  id: 10n,
  nombre: 'Frappe Oreo',
  precio: 12,
  categoria: { area_id: 3n },
  tamanos: [],
  sabores: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CortesiasService.registrarSeparada', () => {
  it('sin pedido de referencia válido responde 404', async () => {
    const prisma = crearPrisma();
    const svc = new CortesiasService(prisma, auditoria as any);
    await expect(
      svc.registrarSeparada({ productoId: '10', cantidad: 1, motivo: 'ERROR_COCINA', pedidoReferenciaId: '900' } as any, usuario),
    ).rejects.toMatchObject({ response: { codigo: 'PEDIDO_REFERENCIA_NO_ENCONTRADO' } });
    expect(prisma.cortesia.create).not.toHaveBeenCalled();
  });

  it('motivo fuera de la lista responde 400 antes de tocar la base', async () => {
    const prisma = crearPrisma();
    const svc = new CortesiasService(prisma, auditoria as any);
    await expect(
      svc.registrarSeparada({ productoId: '10', cantidad: 1, motivo: 'NO_EXISTE', pedidoReferenciaId: '900' } as any, usuario),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.pedido.findUnique).not.toHaveBeenCalled();
  });

  it('con «Otro» exige nota', async () => {
    const prisma = crearPrisma();
    const svc = new CortesiasService(prisma, auditoria as any);
    await expect(
      svc.registrarSeparada({ productoId: '10', cantidad: 1, motivo: 'OTRO', pedidoReferenciaId: '900' } as any, usuario),
    ).rejects.toMatchObject({ response: { codigo: 'NOTA_REQUERIDA' } });
  });

  it('descuenta stock como cortesía (sin pedido propio) y guarda el valor de lista', async () => {
    const prisma = crearPrisma({
      pedido: { findUnique: jest.fn(async () => pedidoRef), update: jest.fn() },
      producto: { findUnique: jest.fn(async () => producto) },
    });
    const svc = new CortesiasService(prisma, auditoria as any);
    const r = await svc.registrarSeparada({ productoId: '10', cantidad: 3, motivo: 'PRUEBA', pedidoReferenciaId: '900' } as any, usuario, 42n);

    expect(prisma.cortesia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pedido_id: null,
        pedido_referencia_id: 900n,
        cantidad: 3,
        valor_lista: 36,
        autorizada_por_party_id: 42n,
      }),
    });
    // Descuenta 3 unidades del producto, con pedido nulo y tipo CORTESIA
    expect(descontarVentaProductos).toHaveBeenCalledWith(
      prisma,
      null,
      [expect.objectContaining({ productoId: 10n, cantidad: 3, areaId: 3n })],
      5n,
      expect.any(Date),
      { tipo: 'CORTESIA' },
    );
    expect(r.valorLista).toBe(36);
    expect(auditoria.registrar).toHaveBeenCalled();
  });
});

describe('CortesiasService.darEnLinea', () => {
  const pedidoBase = (over: any = {}) => ({
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
    ...over,
  });

  it('pedido ya cobrado: 409 PEDIDO_YA_COBRADO', async () => {
    const prisma = crearPrisma({ pedido: { findUnique: jest.fn(async () => pedidoBase({ pago_estado: 'PAGADO' })), update: jest.fn() } });
    const svc = new CortesiasService(prisma, auditoria as any);
    await expect(svc.darEnLinea('1', '100', { motivo: 'ERROR_COCINA' }, usuario)).rejects.toMatchObject({
      response: { codigo: 'PEDIDO_YA_COBRADO' },
    });
  });

  it('línea a S/ 0: baja el subtotal y el total en el valor de lista, sin tocar la otra línea', async () => {
    const prisma = crearPrisma({ pedido: { findUnique: jest.fn(async () => pedidoBase()), update: jest.fn() } });
    const svc = new CortesiasService(prisma, auditoria as any);
    const r = await svc.darEnLinea('1', '100', { motivo: 'ERROR_COCINA' }, usuario);

    expect(prisma.pedidoLinea.update).toHaveBeenCalledWith({
      where: { id: 100n },
      data: { es_cortesia: true, precio_unit: 0, subtotal: 0 },
    });
    expect(prisma.pedido.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { subtotal: 10, total: 10 } });
    expect(r).toMatchObject({ subtotal: 10, total: 10, valorLista: 20 });
  });

  it('audita quién la dio y por qué: cortesía con su autor y el motivo, y registro de auditoría del pedido', async () => {
    const prisma = crearPrisma({ pedido: { findUnique: jest.fn(async () => pedidoBase()), update: jest.fn() } });
    const svc = new CortesiasService(prisma, auditoria as any);
    await svc.darEnLinea('1', '100', { motivo: 'CUMPLEANOS', nota: ' mesa 4 ' }, usuario);

    expect(prisma.cortesia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ motivo: 'CUMPLEANOS', nota: 'mesa 4', pedido_id: 1n, pedido_linea_id: 100n, dada_por_party_id: 5n, valor_lista: 20 }),
    });
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: 'cortesias', accion: 'DAR_EN_PEDIDO', entidad: 'pedido', entidadId: 1n, partyId: 5n, despues: expect.objectContaining({ motivo: 'CUMPLEANOS', nota: 'mesa 4' }) }),
      expect.anything(),
    );
  });

  it('un pedido anulado no admite cortesía', async () => {
    const prisma = crearPrisma({ pedido: { findUnique: jest.fn(async () => pedidoBase({ estado: 'ANULADO' })), update: jest.fn() } });
    const svc = new CortesiasService(prisma, auditoria as any);
    await expect(svc.darEnLinea('1', '100', { motivo: 'PRUEBA' }, usuario)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_VIGENTE' } });
  });

  it('una línea ya cortesía no se vuelve a marcar', async () => {
    const base = pedidoBase();
    base.lineas[0].es_cortesia = true;
    const prisma = crearPrisma({ pedido: { findUnique: jest.fn(async () => base), update: jest.fn() } });
    const svc = new CortesiasService(prisma, auditoria as any);
    await expect(svc.darEnLinea('1', '100', { motivo: 'ERROR_COCINA' }, usuario)).rejects.toBeInstanceOf(ConflictException);
  });

  it('una línea de combo o de oferta no se marca', async () => {
    const base = pedidoBase();
    base.lineas[0].oferta_id = 5n;
    const prisma = crearPrisma({ pedido: { findUnique: jest.fn(async () => base), update: jest.fn() } });
    const svc = new CortesiasService(prisma, auditoria as any);
    await expect(svc.darEnLinea('1', '100', { motivo: 'ERROR_COCINA' }, usuario)).rejects.toMatchObject({
      response: { codigo: 'LINEA_EN_OFERTA' },
    });
  });

  it('línea inexistente en el pedido: 404', async () => {
    const prisma = crearPrisma({ pedido: { findUnique: jest.fn(async () => pedidoBase()), update: jest.fn() } });
    const svc = new CortesiasService(prisma, auditoria as any);
    await expect(svc.darEnLinea('1', '999', { motivo: 'ERROR_COCINA' }, usuario)).rejects.toBeInstanceOf(NotFoundException);
  });
});

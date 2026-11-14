jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { register: jest.fn().mockReturnValue({ module: class {} }) } }));

import { ClientesService } from './clientes.service';

const pedido = {
  id: 55n, codigo: 'CP-55', creado_en: new Date('2026-11-10T10:00:00Z'), modalidad: 'DELIVERY', estado: 'ENTREGADO',
  subtotal: '24', descuento: '4', envio: '6', propina: '2', total: '28', puntos_canjeados: '0',
  pago_estado: 'PAGADO', pago_metodo: 'YAPE', comprobante_tipo: 'BOLETA', nota: null,
  descuento_detalle: [{ tipo: 'OFERTA', nombre: 'Promo 2x', monto: 4 }],
  entrega_direccion: 'Calle X 123', cliente_telefono: '999111222',
  lineas: [{
    id: 1n, cantidad: 2, nombre: 'Frappé', tamano: 'Grande', opciones: [], es_cortesia: false, precio_unit: '12', subtotal: '24', nota: null,
    nombres_persona: ['Ana', 'Luis'], opcionesElegidas: [{ opcion_nombre: 'Leche de almendra' }], sabores: [{ sabor_nombre: 'Fresa', cantidad: 2 }],
  }],
  planPago: [{ medio: 'YAPE', monto: '18' }, { medio: 'EFECTIVO', monto: '10' }],
  cobros: [],
};

const servicio = (fila: any) => {
  const prisma: any = { pedido: { findFirst: jest.fn().mockResolvedValue(fila) } };
  return { svc: new (ClientesService as any)(prisma, {}, {}, {}, {}, {}, {}, {}) as ClientesService, prisma };
};

describe('ClientesService.detallePedidoCliente', () => {
  it('pedido de otro cliente: 404 y la consulta filtra por el cliente', async () => {
    const { svc, prisma } = servicio(null);
    await expect(svc.detallePedidoCliente('9', '55')).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_ENCONTRADO' } });
    const where = JSON.stringify(prisma.pedido.findFirst.mock.calls[0][0].where, (_, v) => (typeof v === 'bigint' ? `n${v}` : v));
    expect(where).toContain('cliente_party_id');
    expect(where).toContain('n9');
  });

  it('mapea líneas, descuentos y plan de pago, sin celular ni dirección', async () => {
    const { svc } = servicio(pedido);
    const d: any = await svc.detallePedidoCliente('9', '55');
    expect(d.lineas[0]).toMatchObject({ cantidad: 2, nombre: 'Frappé', tamano: 'Grande', opciones: ['Leche de almendra'], nombresPersona: ['Ana', 'Luis'], subtotal: 24 });
    expect(d.lineas[0].sabores).toEqual([{ nombre: 'Fresa', cantidad: 2 }]);
    expect(d.descuentos).toEqual([{ tipo: 'OFERTA', nombre: 'Promo 2x', monto: 4 }]);
    expect(d.pagos).toEqual([{ medio: 'YAPE', monto: 18 }, { medio: 'EFECTIVO', monto: 10 }]);
    expect(d).toMatchObject({ envio: 6, propina: 2, total: 28, comprobante: 'BOLETA' });
    expect(JSON.stringify(d)).not.toMatch(/999111222|Calle X/);
  });

  it('sin plan usa los pagos del cobro vigente', async () => {
    const { svc } = servicio({ ...pedido, planPago: [], cobros: [{ pagos: [{ medio: 'TARJETA', monto: '28' }] }] });
    expect(((await svc.detallePedidoCliente('9', '55')) as any).pagos).toEqual([{ medio: 'TARJETA', monto: 28 }]);
  });
});

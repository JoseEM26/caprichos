jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { OfertasService } from './ofertas.service';

/** Vista previa de la carta con celular: el total mostrado sale de la misma función que al crear el pedido. */
describe('vistaPreviaDescuentos con sesión de cuenta del equipo (carta)', () => {
  let s: any;
  let prisma: any;
  const linea = { productoId: '1', cantidad: 2, subtotal: 28, precioUnitario: 14 };

  beforeEach(() => {
    prisma = {
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      producto: { findMany: jest.fn().mockResolvedValue([{ id: 1n, nombre: 'Americano', categoria_id: 1n, no_suma_beneficios: false }]) },
      partyRole: { findFirst: jest.fn().mockResolvedValue(null) },
      customerAccount: { findFirst: jest.fn().mockResolvedValue({ telefono: '900000001' }) },
      contactMechanism: { findFirst: jest.fn().mockResolvedValue({ party_id: 9n }) },
    };
    s = Object.create(OfertasService.prototype);
    s.prisma = prisma;
    s.calcularDescuentosParaPedido = jest.fn().mockResolvedValue({ descuentoTotal: 0, detalles: [], envioGratisCupon: false });
  });

  const vista = (cuenta: string | null = '77', canal = 'CARTA') => s.vistaPreviaDescuentos([linea], undefined, cuenta, canal, 'RECOGER');

  it('trabajador activo: suma el descuento del equipo al total y lo nombra, sin datos de la persona', async () => {
    const r = await vista();
    expect(r.descuentoTotal).toBe(7);
    expect(r.detalles).toEqual([{ tipo: 'PERSONAL', nombre: 'Descuento por ser del equipo (25 %)', monto: 7 }]);
    expect(r.montoCanjeable).toBe(0);
    expect(JSON.stringify(r)).not.toMatch(/party|nombres|apellidos|900000001/);
    expect(prisma.contactMechanism.findFirst.mock.calls[0][0].where.valor.in).toContain('900000001');
  });

  it('trabajador inactivo o cuenta sin celular de personal: respuesta idéntica a la de un cliente común', async () => {
    const sinSesion = await vista(null);
    prisma.contactMechanism.findFirst.mockResolvedValue(null);
    expect(await vista()).toEqual(sinSesion);
  });

  it('sin sesión no aplica aunque exista un trabajador con ese celular', async () => {
    const r = await vista(null);
    expect(r.descuentoTotal).toBe(0);
    expect(prisma.customerAccount.findFirst).not.toHaveBeenCalled();
  });

  it('no acumula con otra promoción de la misma línea', async () => {
    s.calcularDescuentosParaPedido.mockResolvedValue({
      descuentoTotal: 5, envioGratisCupon: false,
      detalles: [{ tipo: 'DESCUENTO', nombre: '2x', montoDescontado: 5, lineasAfectadas: [{ productoId: '1', cantidad: 2, subtotal: 28, descuento: 5 }] }],
    });
    const r = await vista();
    expect(r.descuentoTotal).toBe(5);
  });

  it('la vista previa no incluye el envío en la base: 25 % de 28 = 7 sin importar la modalidad', async () => {
    const r = await s.vistaPreviaDescuentos([linea], undefined, '77', 'CARTA', 'DELIVERY');
    expect(r.descuentoTotal).toBe(7);
  });

  it('solo en la carta', async () => {
    expect((await vista('77', 'CAJA')).descuentoTotal).toBe(0);
  });
});

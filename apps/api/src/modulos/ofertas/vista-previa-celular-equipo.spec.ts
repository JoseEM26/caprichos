jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { OfertasService } from './ofertas.service';

/** Vista previa de la carta con celular: el total mostrado sale de la misma función que al crear el pedido. */
describe('vistaPreviaDescuentos con celular del equipo (carta)', () => {
  let s: any;
  let prisma: any;
  const linea = { productoId: '1', cantidad: 2, subtotal: 28, precioUnitario: 14 };

  beforeEach(() => {
    prisma = {
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      producto: { findMany: jest.fn().mockResolvedValue([{ id: 1n, nombre: 'Americano', categoria_id: 1n, no_suma_beneficios: false }]) },
      partyRole: { findFirst: jest.fn().mockResolvedValue(null) },
      contactMechanism: { findFirst: jest.fn().mockResolvedValue({ party_id: 9n }) },
    };
    s = Object.create(OfertasService.prototype);
    s.prisma = prisma;
    s.calcularDescuentosParaPedido = jest.fn().mockResolvedValue({ descuentoTotal: 0, detalles: [], envioGratisCupon: false });
  });

  const vista = (celular?: string, canal = 'CARTA') => s.vistaPreviaDescuentos([linea], undefined, null, canal, 'RECOGER', undefined, celular);

  it('trabajador activo: suma el descuento del equipo al total y lo nombra, sin datos de la persona', async () => {
    const r = await vista('900000001');
    expect(r.descuentoTotal).toBe(7);
    expect(r.detalles).toEqual([{ tipo: 'PERSONAL', nombre: 'Descuento por ser del equipo (25 %)', monto: 7 }]);
    expect(r.montoCanjeable).toBe(0);
    expect(JSON.stringify(r)).not.toMatch(/party|nombres|apellidos|900000001/);
  });

  it('no personal (no existe o inactivo): respuesta idéntica a no poner celular', async () => {
    prisma.contactMechanism.findFirst.mockResolvedValue(null);
    expect(await vista('900000002')).toEqual(await vista(undefined));
  });

  it('no acumula con otra promoción de la misma línea', async () => {
    s.calcularDescuentosParaPedido.mockResolvedValue({
      descuentoTotal: 5, envioGratisCupon: false,
      detalles: [{ tipo: 'DESCUENTO', nombre: '2x', montoDescontado: 5, lineasAfectadas: [{ productoId: '1', cantidad: 2, subtotal: 28, descuento: 5 }] }],
    });
    const r = await vista('900000001');
    expect(r.descuentoTotal).toBe(5);
  });

  it('solo en la carta', async () => {
    expect((await vista('900000001', 'CAJA')).descuentoTotal).toBe(0);
  });
});

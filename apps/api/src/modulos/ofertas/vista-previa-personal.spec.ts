jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { OfertasService } from './ofertas.service';
import { calcularDescuentoPersonal } from '../creditos';

/**
 * La vista previa con colaboradorPartyId debe dar el mismo descuento del personal que PedidosService.crear:
 * ambos usan calcularDescuentoPersonal con la misma elegibilidad (producto sin beneficios, combo/oferta,
 * nombre «docena», líneas que ya recibieron otro descuento). Los casos 28 → 7 y 20 % → 5,6 repiten los de
 * pedidos.service.spec («pedido del personal»).
 */
describe('vistaPreviaDescuentos con colaboradorPartyId', () => {
  let s: any;
  let prisma: any;
  const sinDescuento = { descuentoTotal: 0, detalles: [], envioGratisCupon: false };

  const productos = [
    { id: 1n, nombre: 'Americano', categoria_id: 1n, no_suma_beneficios: false },
    { id: 2n, nombre: 'Gaseosa', categoria_id: 1n, no_suma_beneficios: true },
    { id: 3n, nombre: 'Dúo para compartir', categoria_id: 2n, no_suma_beneficios: false },
    { id: 4n, nombre: 'Docena de donas', categoria_id: 2n, no_suma_beneficios: false },
  ];

  beforeEach(() => {
    prisma = {
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      producto: { findMany: jest.fn().mockResolvedValue(productos) },
      party: { findUnique: jest.fn().mockResolvedValue({ id: 9n, persona: {}, usuario: { activo: true }, roles: [] }) },
      partyRole: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    s = Object.create(OfertasService.prototype);
    s.prisma = prisma;
    s.calcularDescuentosParaPedido = jest.fn().mockResolvedValue(sinDescuento);
  });

  const linea = (productoId: string, subtotal: number, extra: any = {}) => ({ productoId, cantidad: 1, subtotal, precioUnitario: subtotal, ...extra });
  const vista = (lineas: any[], colab: string | undefined = '9', canal = 'CAJA') =>
    s.vistaPreviaDescuentos(lineas, undefined, null, canal, 'COMER_LOCAL', colab);

  // Lo que arma pedidos.service a partir de sus líneas calculadas
  const comoPedido = (lineas: any[], pct: number, detalles: any[] = []) =>
    calcularDescuentoPersonal(
      lineas.map((l) => {
        const p = productos.find((x) => String(x.id) === l.productoId)!;
        return { productoId: p.id, nombre: p.nombre, subtotal: l.subtotal, noSumaBeneficios: p.no_suma_beneficios, enPromocion: Boolean(l.ofertaId) };
      }),
      detalles,
      pct,
    );

  it('producto normal: 25 % por defecto (28 → 7), igual que al crear el pedido', async () => {
    const r = await vista([linea('1', 28)]);
    expect(r.descuentoPersonal).toEqual({ pct: 25, monto: 7 });
    expect(r.totalDescuentos).toBe(7);
    expect(r.descuentoPersonal.monto).toBe(comoPedido([linea('1', 28)], 25));
  });

  it('porcentaje del parámetro del local (20 % → 5,6)', async () => {
    prisma.parametro.findUnique.mockResolvedValue({ valor: 20 });
    expect((await vista([linea('1', 28)])).descuentoPersonal).toEqual({ pct: 20, monto: 5.6 });
  });

  it('porcentaje propio de la ficha del empleado gana al del local', async () => {
    prisma.partyRole.findFirst.mockResolvedValue({ employee_detail: { descuento_pct: 40 } });
    prisma.parametro.findUnique.mockResolvedValue({ valor: 20 });
    expect((await vista([linea('1', 10)])).descuentoPersonal).toEqual({ pct: 40, monto: 4 });
  });

  it('combo (ofertaId), producto sin beneficios y «docena» no se descuentan; la mezcla solo cuenta lo elegible', async () => {
    const lineas = [linea('1', 20), linea('2', 10), linea('3', 30, { ofertaId: '5' }), linea('4', 40)];
    const r = await vista(lineas);
    expect(r.descuentoPersonal.monto).toBe(5); // solo el Americano: 20 × 25 %
    expect(r.descuentoPersonal.monto).toBe(comoPedido(lineas, 25));
  });

  it('línea que ya recibió otra promoción no recibe el descuento del personal', async () => {
    const detalles = [{ tipo: 'DESCUENTO', nombre: '2x', montoDescontado: 5, lineasAfectadas: [{ productoId: '1', cantidad: 2, subtotal: 28, descuento: 5 }] }];
    s.calcularDescuentosParaPedido.mockResolvedValue({ descuentoTotal: 5, detalles, envioGratisCupon: false });
    const r = await vista([linea('1', 28)]);
    expect(r.descuentoPersonal.monto).toBe(0);
    expect(r.descuentoTotal).toBe(5);
    expect(r.totalDescuentos).toBe(5);
    expect(r.descuentoPersonal.monto).toBe(comoPedido([linea('1', 28)], 25, detalles));
  });

  it('sin colaborador la respuesta no cambia (sin descuentoPersonal ni totalDescuentos)', async () => {
    const r = await vista([linea('1', 28)], '');
    expect(r).not.toHaveProperty('descuentoPersonal');
    expect(r).not.toHaveProperty('totalDescuentos');
    expect(prisma.party.findUnique).not.toHaveBeenCalled();
  });

  it('colaborador que no es personal: NO_ES_PERSONAL', async () => {
    prisma.party.findUnique.mockResolvedValue({ id: 9n, persona: {}, usuario: null, roles: [] });
    await expect(vista([linea('1', 28)])).rejects.toMatchObject({ response: { codigo: 'NO_ES_PERSONAL' } });
  });

  it('colaborador inexistente o mal formado se rechaza', async () => {
    prisma.party.findUnique.mockResolvedValue(null);
    await expect(vista([linea('1', 28)])).rejects.toMatchObject({ response: { codigo: 'COLABORADOR_NO_ENCONTRADO' } });
    await expect(vista([linea('1', 28)], 'abc')).rejects.toMatchObject({ response: { codigo: 'COLABORADOR_REQUERIDO' } });
  });

  it('por la carta no hay descuento del personal', async () => {
    await expect(vista([linea('1', 28)], '9', 'CARTA')).rejects.toMatchObject({ response: { codigo: 'CANAL_NO_PERMITIDO' } });
  });
});

/** Puntos estimados de la carta: puntos_combos_suman / puntos_ofertas_suman cambian lo que SUMA, nunca lo que se CANJEA. */
describe('vistaPreviaDescuentos: puntos estimados con combos y ofertas', () => {
  let s: any;
  const productos = [
    { id: 1n, nombre: 'Americano', categoria_id: 1n, no_suma_beneficios: false },
    { id: 3n, nombre: 'Dúo', categoria_id: 2n, no_suma_beneficios: false },
    { id: 5n, nombre: 'Torta', categoria_id: 2n, no_suma_beneficios: false },
  ];
  const lineas = [
    { productoId: '1', cantidad: 1, subtotal: 20, precioUnitario: 20 },
    { productoId: '3', cantidad: 1, subtotal: 60, precioUnitario: 60, ofertaId: '7' }, // combo
    { productoId: '5', cantidad: 1, subtotal: 20, precioUnitario: 20, ofertaId: '8' }, // oferta
  ];
  const armar = (interruptores: Record<string, string>) => {
    s = Object.create(OfertasService.prototype);
    s.prisma = {
      parametro: {
        findUnique: jest.fn().mockResolvedValue({ valor: 5 }),
        findMany: jest.fn().mockResolvedValue(Object.entries(interruptores).map(([clave, valor]) => ({ clave, valor }))),
      },
      producto: { findMany: jest.fn().mockResolvedValue(productos) },
      oferta: { findMany: jest.fn().mockResolvedValue([{ id: 7n, tipo: 'COMBO' }, { id: 8n, tipo: 'DESCUENTO' }]) },
    };
    s.calcularDescuentosParaPedido = jest.fn().mockResolvedValue({ descuentoTotal: 0, detalles: [], envioGratisCupon: false });
    return s.vistaPreviaDescuentos(lineas, undefined, null, 'CARTA', 'COMER_LOCAL');
  };

  it('apagados: solo lo normal suma y se canjea (20 → 1 punto)', async () => {
    const r = await armar({});
    expect(r.puntosEstimados).toBe(1);
    expect(r.montoCanjeable).toBe(20);
  });
  it('combos encendido: suma el combo (80 → 4) y el canje no cambia', async () => {
    const r = await armar({ puntos_combos_suman: 'si' });
    expect(r.puntosEstimados).toBe(4);
    expect(r.montoCanjeable).toBe(20);
  });
  it('ofertas encendido: suma la oferta (40 → 2)', async () => {
    expect((await armar({ puntos_ofertas_suman: 'si' })).puntosEstimados).toBe(2);
  });
  it('ambos encendidos (100 → 5)', async () => {
    expect((await armar({ puntos_combos_suman: 'si', puntos_ofertas_suman: 'si' })).puntosEstimados).toBe(5);
  });
});

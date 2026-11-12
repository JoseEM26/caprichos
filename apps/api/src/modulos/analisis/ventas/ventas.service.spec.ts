import { VentasService, agregarVentas, MAX_PEDIDOS_VENTAS, type PedidoVenta } from './ventas.service';

const AHORA = new Date('2026-11-11T20:00:00Z'); // 15:00 Lima (tarde)

const linea = (nombre: string, cantidad: number, subtotal: number, extra: Record<string, unknown> = {}) => ({
  nombre,
  cantidad,
  subtotal,
  producto_id: BigInt(nombre.length),
  oferta_id: null,
  es_cortesia: false,
  producto: { categoria: { nombre: 'Postres' } },
  ...extra,
});

function pedido(extra: Partial<PedidoVenta> = {}): PedidoVenta {
  return {
    canal: 'CAJA',
    modalidad: 'RECOGER',
    estado: 'ENTREGADO',
    creado_en: AHORA,
    total: 30,
    descuento: 0,
    envio: 0,
    propina: 0,
    descuento_detalle: null,
    lineas: [linea('Torta', 2, 30)],
    cobros: [{ pagos: [{ medio: 'yape', monto: 30 }] }],
    ...extra,
  };
}

const R1 = { dias: 1, turno: null };

describe('agregarVentas', () => {
  it('venta = total del pedido (sin propina), sin anulados ni rechazados', () => {
    const r = agregarVentas([pedido({ total: 30, propina: 5 }), pedido({ total: 50 }), pedido({ estado: 'ANULADO', total: 999 }), pedido({ estado: 'RECHAZADO', total: 999 })], R1, true);
    expect(r.pedidos).toBe(2);
    expect(r.ventas).toMatchObject({ monto: 80, ticket: 40, propinaAparte: 5 });
  });

  it('el SUPERVISOR no recibe ningún monto: conteos y unidades sí', () => {
    const r = agregarVentas([pedido({ descuento: 3, envio: 4 })], R1, false);
    expect(r.ventas).toEqual({ monto: null, ticket: null, envio: null, descuento: null, propinaAparte: null });
    expect(r.porCanal[0]).toMatchObject({ id: 'CAJA', pedidos: 1, monto: null, ticket: null, porcentaje: 100 });
    expect(r.productos.masVendidos[0]).toMatchObject({ nombre: 'Torta', unidades: 2, monto: null });
    expect(r.productos.masMonto).toEqual([]);
    expect(r.medios.filas[0]).toMatchObject({ id: 'YAPE', pagos: 1, monto: null, porcentaje: 100 });
    expect(r.evolucion.unidad).toBe('pedidos');
    expect(JSON.stringify(r)).not.toMatch(/"monto":\d/);
  });

  it('productos: las partes de un combo no duplican, la cortesía no es venta y las opciones ya van en el subtotal', () => {
    const r = agregarVentas(
      [
        pedido({
          total: 45,
          lineas: [
            linea('Combo Dúo', 1, 25, { oferta_id: 9n, producto_id: null }),
            linea('Frappe', 1, 20),
            linea('Galleta', 1, 0, { es_cortesia: true }),
          ],
        }),
      ],
      R1,
      true,
    );
    expect(r.productos.distintos).toBe(2);
    expect(r.productos.masVendidos.map((p) => p.nombre).sort()).toEqual(['Combo Dúo', 'Frappe']);
    expect(r.productos.masMonto[0]).toMatchObject({ nombre: 'Combo Dúo', monto: 25, combo: true, categoria: 'Combos' });
    expect(r.ofertas).toMatchObject({ pedidosConCombo: 1, aporteCombos: 45 });
    expect(r.ofertas.combos[0]).toMatchObject({ nombre: 'Combo Dúo', unidades: 1, monto: 25 });
  });

  it('menos vendidos: los de menos unidades primero', () => {
    const r = agregarVentas([pedido({ lineas: [linea('A', 5, 50), linea('BB', 1, 9), linea('CCC', 3, 20)] })], R1, true);
    expect(r.productos.menosVendidos.map((p) => p.nombre)).toEqual(['BB', 'CCC', 'A']);
    expect(r.productos.masVendidos[0].nombre).toBe('A');
  });

  it('ticket por canal, modalidad y turno (hora de Lima)', () => {
    const r = agregarVentas(
      [
        pedido({ canal: 'CARTA', modalidad: 'DELIVERY', total: 40, creado_en: new Date('2026-11-12T01:30:00Z') }), // 20:30 Lima: noche
        pedido({ canal: 'CARTA', modalidad: 'DELIVERY', total: 20, creado_en: new Date('2026-11-12T01:40:00Z') }),
        pedido({ canal: 'MOZO', modalidad: 'MESA', total: 30 }), // tarde
      ],
      R1,
      true,
    );
    expect(r.porCanal.find((c) => c.id === 'CARTA')).toMatchObject({ pedidos: 2, monto: 60, ticket: 30 });
    expect(r.porModalidad.find((c) => c.id === 'MESA')).toMatchObject({ ticket: 30 });
    expect(r.porTurno.find((c) => c.id === 'NOCHE')).toMatchObject({ pedidos: 2, monto: 60 });
    expect(r.porTurno.find((c) => c.id === 'TARDE')).toMatchObject({ pedidos: 1 });
  });

  it('el filtro de turno solo deja los pedidos de esas horas de Lima', () => {
    const r = agregarVentas([pedido(), pedido({ creado_en: new Date('2026-11-12T01:30:00Z') })], { dias: 1, turno: 'NOCHE' }, true);
    expect(r.pedidos).toBe(1);
  });

  it('evolución diaria hasta 31 días y semanal (lunes) después', () => {
    const dias = [pedido({ creado_en: new Date('2026-11-09T17:00:00Z') }), pedido({ creado_en: new Date('2026-11-11T17:00:00Z') })];
    expect(agregarVentas(dias, { dias: 7, turno: null }, true).evolucion.periodos).toEqual(['2026-11-09', '2026-11-11']);
    const sem = agregarVentas(dias, { dias: 60, turno: null }, true).evolucion;
    expect(sem.granularidad).toBe('semana');
    expect(sem.periodos).toEqual(['2026-11-09']); // miércoles 11 cae en la semana del lunes 9
    expect(sem.canales[0].valores).toEqual([60]);
  });

  it('medios de pago: proporción por monto (sin propina) y pedidos sin cobro aparte', () => {
    const r = agregarVentas(
      [
        pedido({ cobros: [{ pagos: [{ medio: 'EFECTIVO', monto: 10 }, { medio: 'Yape', monto: 30 }] }] }),
        pedido({ cobros: [] }),
      ],
      R1,
      true,
    );
    expect(r.medios.filas.map((m) => [m.id, m.monto, m.porcentaje])).toEqual([
      ['EFECTIVO', 10, 25],
      ['YAPE', 30, 75],
    ]);
    expect(r.medios.pedidosSinCobro).toBe(1);
  });

  it('descuentos por oferta/cupón desde descuento_detalle; ignora basura y montos 0', () => {
    const r = agregarVentas(
      [
        pedido({ descuento_detalle: [{ tipo: 'DESCUENTO', nombre: '10% postres', montoDescontado: 3.5 }, { tipo: 'CUPON', nombre: 'X', montoDescontado: 0 }, null] }),
        pedido({ descuento_detalle: [{ tipo: 'DESCUENTO', nombre: '10% postres', montoDescontado: 1.5 }] }),
        pedido({ descuento_detalle: 'roto' as unknown }),
      ],
      R1,
      true,
    );
    expect(r.ofertas.pedidosConDescuento).toBe(2);
    expect(r.ofertas.descuentos).toEqual([{ tipo: 'DESCUENTO', nombre: '10% postres', pedidos: 2, monto: 5 }]);
  });

  it('sin pedidos: ceros reales, nulos donde no hay promedio posible', () => {
    const r = agregarVentas([], R1, true);
    expect(r.pedidos).toBe(0);
    expect(r.ventas).toMatchObject({ monto: 0, ticket: null });
    expect(r.porCanal).toEqual([]);
    expect(r.medios.filas).toEqual([]);
    expect(r.ofertas.porcentajeAporte).toBeNull();
  });
});

describe('VentasService', () => {
  const servicio = (filas: any[]) => {
    const prisma: any = { pedido: { findMany: jest.fn(async () => filas) } };
    return { s: new VentasService(prisma), prisma };
  };

  it('pide solo no anulados dentro del rango con tope, y marca conDinero', async () => {
    const { s, prisma } = servicio([pedido()]);
    const r = await s.resumen({ canal: 'caja' }, true, AHORA);
    const args = prisma.pedido.findMany.mock.calls[0][0];
    expect(args.where.estado).toEqual({ notIn: ['ANULADO', 'RECHAZADO'] });
    expect(args.where.canal).toBe('CAJA');
    expect(args.take).toBe(MAX_PEDIDOS_VENTAS + 1);
    expect(r).toMatchObject({ conDinero: true, truncado: false });
  });

  it('avisa si se pasa del tope', async () => {
    const { s } = servicio(Array.from({ length: MAX_PEDIDOS_VENTAS + 1 }, () => pedido()));
    const r = await s.resumen({}, true, AHORA);
    expect(r.truncado).toBe(true);
    expect(r.pedidos).toBe(MAX_PEDIDOS_VENTAS);
  });

  it('rechaza filtros inválidos', async () => {
    const { s } = servicio([]);
    await expect(s.resumen({ canal: 'XX' }, true, AHORA)).rejects.toMatchObject({ response: { codigo: 'FILTRO_INVALIDO' } });
    await expect(s.resumen({ desde: '2026-01-01', hasta: '2026-11-11' }, true, AHORA)).rejects.toMatchObject({ response: { codigo: 'FILTRO_INVALIDO' } });
  });
});

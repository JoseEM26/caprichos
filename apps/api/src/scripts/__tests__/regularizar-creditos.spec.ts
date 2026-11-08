import { enmascarar, leerOpciones, regularizarCreditos } from '../regularizar-creditos';

describe('regularizar-creditos', () => {
  const pedido = (id: number, extra: Record<string, unknown> = {}) => ({
    id: BigInt(id), codigo: `CP-W${id}`, total: '28.00', descuento: '0', es_personal: true,
    cliente_party_id: null, cliente_nombre: 'Kevin Rosales (personal)', descuento_detalle: null,
    lineas: [{ producto_id: BigInt(1), nombre: 'Café', subtotal: '28.00', precio_unit: '14', cantidad: 2, oferta_id: null, linea_combo_id: null }],
    ...extra,
  });
  const montar = (pedidos: any[]) => {
    const prisma: any = {
      pedido: { findMany: jest.fn().mockResolvedValue(pedidos) },
      producto: { findMany: jest.fn().mockResolvedValue([]) },
      partyRole: { findFirst: jest.fn().mockResolvedValue(null) },
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const creditos: any = {
      registrarConsumo: jest.fn().mockResolvedValue({}),
      listarPersonalActivo: jest.fn().mockResolvedValue([
        { partyId: '9', nombre: 'Kevin Rosales', rol: 'CAJERO' },
        { partyId: '10', nombre: 'Ana Pérez', rol: 'MOZO' },
        { partyId: '11', nombre: 'Ana Pérez', rol: 'COCINA' },
      ]),
    };
    return { prisma, creditos };
  };
  const op = { dias: 60, aplicar: false, ajustarDescuento: false };

  it('el simulacro no escribe nada, cuenta por persona con el 25 % y enmascara el nombre', async () => {
    const { prisma, creditos } = montar([pedido(1), pedido(2)]);
    const salida: string[] = [];
    const r = await regularizarCreditos(prisma, creditos, op, (t) => salida.push(t));
    expect(creditos.registrarConsumo).not.toHaveBeenCalled();
    expect(r.porPersona).toEqual([{ nombre: 'K•••• R••••••', pedidos: 2, monto: 42 }]);
    expect(salida.join('\n')).not.toContain('Kevin');
    expect(salida.join('\n')).toContain('SIMULACRO');
  });

  it('solo mira pedidos del personal sin consumo, dentro de los días pedidos y sin anulados', async () => {
    const { prisma, creditos } = montar([]);
    const ahora = new Date('2026-11-07T12:00:00Z');
    await regularizarCreditos(prisma, creditos, { ...op, dias: 30 }, () => undefined, ahora);
    const where = prisma.pedido.findMany.mock.calls[0][0].where;
    expect(where.es_personal).toBe(true);
    expect(where.consumoPersonal).toBeNull();
    expect(where.estado).toEqual({ notIn: ['ANULADO', 'RECHAZADO'] });
    expect(where.creado_en.gte.toISOString()).toBe('2026-10-08T12:00:00.000Z');
  });

  it('aplicar registra cada pedido sin ajustar el pedido por defecto; con la bandera lo ajusta', async () => {
    const a = montar([pedido(1)]);
    await regularizarCreditos(a.prisma, a.creditos, { ...op, aplicar: true }, () => undefined);
    expect(a.creditos.registrarConsumo).toHaveBeenCalledWith(BigInt(1), '9', undefined, undefined, false);
    const b = montar([pedido(1)]);
    await regularizarCreditos(b.prisma, b.creditos, { ...op, aplicar: true, ajustarDescuento: true }, () => undefined);
    expect(b.creditos.registrarConsumo).toHaveBeenCalledWith(BigInt(1), '9', undefined, undefined, true);
  });

  it('es idempotente: un pedido que ya tiene consumo no llega (la consulta lo excluye) y un 409 no rompe la corrida', async () => {
    const { prisma, creditos } = montar([pedido(1), pedido(2)]);
    creditos.registrarConsumo.mockRejectedValueOnce({ response: { codigo: 'YA_COBRADO_A_CREDITO' } });
    const r = await regularizarCreditos(prisma, creditos, { ...op, aplicar: true }, () => undefined);
    expect(r.errores).toBe(1);
    expect(r.registrados).toBe(1);
  });

  it('no adivina: nombre repetido o ausente queda sin identificar y no se toca', async () => {
    const { prisma, creditos } = montar([
      pedido(1, { cliente_nombre: 'Ana Pérez' }),
      pedido(2, { cliente_nombre: 'Alguien Más' }),
      pedido(3, { cliente_nombre: null, cliente_party_id: BigInt(10) }),
    ]);
    const r = await regularizarCreditos(prisma, creditos, { ...op, aplicar: true }, () => undefined);
    expect(r.sinIdentificar).toBe(2);
    expect(creditos.registrarConsumo).toHaveBeenCalledTimes(1);
    expect(creditos.registrarConsumo.mock.calls[0][1]).toBe('10');
  });

  it('un pedido que ya lleva su 25 % se acumula por su total sin volver a descontar', async () => {
    const { prisma, creditos } = montar([
      pedido(1, { total: '21.00', descuento_detalle: [{ tipo: 'PERSONAL', montoDescontado: 7, descuentoValor: 25 }] }),
    ]);
    const r = await regularizarCreditos(prisma, creditos, op, () => undefined);
    expect(r.porPersona[0].monto).toBe(21);
  });

  it('opciones: 60 días por defecto, apagado --aplicar y --ajustar-descuento', () => {
    expect(leerOpciones([])).toEqual({ dias: 60, aplicar: false, ajustarDescuento: false });
    expect(leerOpciones(['--dias', '15', '--aplicar', '--ajustar-descuento'])).toEqual({ dias: 15, aplicar: true, ajustarDescuento: true });
    expect(enmascarar('Kevin Rosales')).toBe('K•••• R••••••');
  });
});

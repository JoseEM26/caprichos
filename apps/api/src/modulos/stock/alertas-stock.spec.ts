import {
  cruceAlertaStock,
  evaluarCrucesStock,
  nivelAlertaStock,
  porcentajeAlertaStock,
  umbralAlertaStock,
} from './alertas-stock';

describe('Umbral y nivel de alerta de insumos', () => {
  it('umbral = max(mínimo, máximo × porcentaje)', () => {
    expect(umbralAlertaStock(5, 100, 20)).toBe(20);
    expect(umbralAlertaStock(30, 100, 20)).toBe(30); // el mínimo manda si es mayor
    expect(umbralAlertaStock(5, 100, 50)).toBe(50);
  });

  it('sin máximo (0) el umbral es el mínimo', () => {
    expect(umbralAlertaStock(7, 0, 20)).toBe(7);
  });

  it('total <= 0 es AGOTADO, salvo un insumo sin uso (mínimo 0, sin stock ni movimientos)', () => {
    expect(nivelAlertaStock(0, 10)).toBe('AGOTADO');
    expect(nivelAlertaStock(-2, 10)).toBe('AGOTADO');
    expect(nivelAlertaStock(0, 0, true)).toBeNull();
  });

  it('0 < total <= umbral es POR_PEDIR; por encima no hay nivel', () => {
    expect(nivelAlertaStock(10, 20)).toBe('POR_PEDIR');
    expect(nivelAlertaStock(20, 20)).toBe('POR_PEDIR');
    expect(nivelAlertaStock(25, 20)).toBeNull();
  });
});

describe('Cruce: un aviso solo al pasar a un nivel más grave', () => {
  it.each([
    [null, 'POR_PEDIR', 'POR_PEDIR'],
    [null, 'AGOTADO', 'AGOTADO'],
    ['POR_PEDIR', 'AGOTADO', 'AGOTADO'],
    ['POR_PEDIR', 'POR_PEDIR', null],
    ['AGOTADO', 'AGOTADO', null],
    ['AGOTADO', 'POR_PEDIR', null], // subió pero sigue bajo: no se vuelve a avisar
    ['POR_PEDIR', null, null], // se repuso: se re-arma sin aviso
  ])('de %s a %s avisa %s', (anterior, nuevo, esperado) => {
    expect(cruceAlertaStock(anterior as any, nuevo as any)).toBe(esperado);
  });
});

/** Base falsa mínima: un insumo, sus lugares y movimientos, y la reclamación condicionada. */
function baseFalsa(insumo: any, opciones: { pct?: string; movimientos?: number; reclamoOk?: boolean } = {}) {
  const updateMany = jest.fn().mockResolvedValue({ count: opciones.reclamoOk === false ? 0 : 1 });
  return {
    db: {
      parametro: {
        findUnique: jest.fn().mockResolvedValue(opciones.pct ? { valor: opciones.pct } : null),
      },
      insumo: {
        findMany: jest.fn().mockResolvedValue([insumo]),
        updateMany,
      },
      movimientoStock: { count: jest.fn().mockResolvedValue(opciones.movimientos ?? 0) },
    },
    updateMany,
  };
}

const insumo = (over: Record<string, unknown> = {}) => ({
  id: 55n,
  nombre: 'Leche Evaporada',
  unidad_almacen: 'UND',
  minimo: 10,
  maximo: 100,
  alerta_stock: null,
  lugarConsumo: { nombre: 'Almacén Central' },
  stocks: [{ cantidad: 15 }],
  ...over,
});

describe('evaluarCrucesStock', () => {
  it('pasar de normal a bajo avisa POR_PEDIR y reclama el nuevo nivel con la condición del anterior', async () => {
    const { db, updateMany } = baseFalsa(insumo({ stocks: [{ cantidad: 15 }] }));

    const cruces = await evaluarCrucesStock(db);

    expect(cruces).toHaveLength(1);
    expect(cruces[0]).toMatchObject({ insumoId: 55n, tipo: 'POR_PEDIR', total: 15, minimo: 10, lugarNombre: 'Almacén Central' });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 55n, alerta_stock: null }, data: { alerta_stock: 'POR_PEDIR' } });
  });

  it('el saldo es el TOTAL de todos los lugares: 10 + 20 = 30 no es bajo con umbral 20', async () => {
    const { db, updateMany } = baseFalsa(insumo({ stocks: [{ cantidad: 10 }, { cantidad: 20 }] }));

    expect(await evaluarCrucesStock(db)).toEqual([]);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('ya avisado como POR_PEDIR no vuelve a avisar mientras siga bajo (sin antirrebote por calendario)', async () => {
    const { db, updateMany } = baseFalsa(insumo({ alerta_stock: 'POR_PEDIR', stocks: [{ cantidad: 12 }] }));

    expect(await evaluarCrucesStock(db)).toEqual([]);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('llegar a 0 desde POR_PEDIR avisa AGOTADO', async () => {
    const { db } = baseFalsa(insumo({ alerta_stock: 'POR_PEDIR', stocks: [{ cantidad: 0 }] }));

    const cruces = await evaluarCrucesStock(db);
    expect(cruces.map((c) => c.tipo)).toEqual(['AGOTADO']);
  });

  it('reponerse por encima del umbral re-arma sin aviso; el siguiente bajón vuelve a avisar', async () => {
    const { db, updateMany } = baseFalsa(insumo({ alerta_stock: 'AGOTADO', stocks: [{ cantidad: 60 }] }));

    expect(await evaluarCrucesStock(db)).toEqual([]);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 55n, alerta_stock: 'AGOTADO' }, data: { alerta_stock: null } });
  });

  it('si otro proceso ya reclamó el cambio (count 0), no se avisa', async () => {
    const { db } = baseFalsa(insumo({ stocks: [{ cantidad: 0 }] }), { reclamoOk: false });

    expect(await evaluarCrucesStock(db)).toEqual([]);
  });

  it('insumo sin uso (mínimo 0, sin stock cargado ni movimientos) no cuenta como agotado', async () => {
    const { db, updateMany } = baseFalsa(insumo({ minimo: 0, maximo: 0, stocks: [] }), { movimientos: 0 });

    expect(await evaluarCrucesStock(db)).toEqual([]);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('insumo con mínimo 0 pero con movimientos sí cuenta como agotado al llegar a 0', async () => {
    const { db } = baseFalsa(insumo({ minimo: 0, maximo: 0, stocks: [{ cantidad: 0 }] }), { movimientos: 4 });

    expect((await evaluarCrucesStock(db)).map((c) => c.tipo)).toEqual(['AGOTADO']);
  });

  it('usa el porcentaje del parámetro stock_alerta_porcentaje (50 % de 100 = umbral 50)', async () => {
    const { db } = baseFalsa(insumo({ stocks: [{ cantidad: 40 }] }), { pct: '50' });

    expect((await evaluarCrucesStock(db)).map((c) => c.tipo)).toEqual(['POR_PEDIR']);
  });
});

describe('porcentajeAlertaStock', () => {
  it('valor fuera de 1 a 100 o ausente vale 20', async () => {
    expect(await porcentajeAlertaStock({ parametro: { findUnique: jest.fn().mockResolvedValue(null) } })).toBe(20);
    expect(await porcentajeAlertaStock({ parametro: { findUnique: jest.fn().mockResolvedValue({ valor: 0 }) } })).toBe(20);
    expect(await porcentajeAlertaStock({ parametro: { findUnique: jest.fn().mockResolvedValue({ valor: 35 }) } })).toBe(35);
  });
});

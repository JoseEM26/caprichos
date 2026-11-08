import { ejecutarReconstruccion, enmascararCelular, FILTRO_CANDIDATOS, MOTIVO_RECONSTRUCCION } from '../reconstruir-puntos';

const pedidos = [
  { id: 1n, codigo: 'A1', cliente_telefono: '987654321' },
  { id: 2n, codigo: 'A2', cliente_telefono: '+51 987 654 321' }, // mismo celular, otro formato
  { id: 3n, codigo: 'A3', cliente_telefono: '911222333' },
  { id: 4n, codigo: 'A4', cliente_telefono: '999999999' },
];

function deps(resp: Record<string, any>) {
  const findMany = jest.fn().mockImplementation(({ where }: any) =>
    Promise.resolve(pedidos.filter((p) => p.id > where.id.gt)),
  );
  const acumularPorPedido = jest.fn().mockImplementation((id: bigint) => Promise.resolve(resp[String(id)]));
  const registrar = jest.fn();
  return { findMany, acumularPorPedido, registrar, d: { prisma: { pedido: { findMany } }, puntos: { acumularPorPedido }, auditoria: { registrar } } as any };
}

const resp = {
  '1': { puntos: 10, sumados: true, partyId: 900n },
  '2': { puntos: 5, sumados: true, partyId: 900n },
  '3': { puntos: 7.5, sumados: true, partyId: 901n },
  '4': { puntos: 0, sumados: false, motivoNo: 'SIN_CELULAR' },
};

describe('reconstruir-puntos', () => {
  it('filtro: pagados, no anulados, sin SUMA', () => {
    expect(FILTRO_CANDIDATOS.pago_estado).toBe('PAGADO');
    expect(FILTRO_CANDIDATOS.estado.notIn).toEqual(expect.arrayContaining(['ANULADO', 'RECHAZADO']));
    expect(FILTRO_CANDIDATOS.movimientosPuntos).toEqual({ none: { tipo: 'SUMA' } });
  });

  it('enmascara el celular', () => {
    expect(enmascararCelular('987654321')).toBe('9•••••321');
  });

  it('simulacro: pide simular, no audita, resume sin celulares completos', async () => {
    const { d, acumularPorPedido, registrar } = deps(resp);
    const salida: string[] = [];
    expect(await ejecutarReconstruccion(d, false, (l) => salida.push(l))).toBe(0);
    for (const c of acumularPorPedido.mock.calls) expect(c[1].simular).toBe(true);
    expect(registrar).not.toHaveBeenCalled();
    const txt = salida.join('\n');
    expect(txt).toContain('SIMULACRO');
    expect(txt).toContain('Pedidos a acreditar: 3');
    expect(txt).toContain('Clientes a beneficiar: 2');
    expect(txt).toContain('Total de puntos: 22.50');
    expect(txt).toContain('SIN_CELULAR=1');
    expect(txt).toContain('9•••••321 — 15.00 pts');
    expect(txt).not.toContain('987654321');
  });

  it('aplicar: acredita con el motivo de reconstrucción y deja auditoría', async () => {
    const { d, acumularPorPedido, registrar } = deps(resp);
    await ejecutarReconstruccion(d, true, () => undefined);
    for (const c of acumularPorPedido.mock.calls) {
      expect(c[1].simular).toBe(false);
      expect(c[1].motivo).toContain(MOTIVO_RECONSTRUCCION);
    }
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'RECONSTRUIR_PUNTOS', despues: { pedidos: 3, clientes: 2, puntos: 22.5, errores: 0 } }));
  });

  it('segunda corrida: lo ya sumado se omite y no cuenta', async () => {
    const ya = Object.fromEntries(Object.keys(resp).map((k) => [k, { puntos: 5, sumados: false, motivoNo: 'YA_SUMADO' }]));
    const { d } = deps(ya);
    const salida: string[] = [];
    await ejecutarReconstruccion(d, true, (l) => salida.push(l));
    expect(salida.join('\n')).toContain('Pedidos acreditados: 0');
    expect(salida.join('\n')).toContain('Total de puntos: 0.00');
  });

  it('un pedido que falla no detiene el resto', async () => {
    const { d, acumularPorPedido } = deps(resp);
    acumularPorPedido.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    const salida: string[] = [];
    await ejecutarReconstruccion(d, true, (l) => salida.push(l));
    expect(salida.join('\n')).toContain('Errores: 1');
    expect(salida.join('\n')).toContain('Pedidos acreditados: 2');
  });
});

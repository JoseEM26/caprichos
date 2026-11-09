import { lineasTicketCierre } from '@caprichos/compartido';
import { CierreService } from './cierre.service';
import { armarTicketCierre, FuentesTicketCierre } from './ticket-cierre';

jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

const base = (extra: Partial<FuentesTicketCierre> = {}): FuentesTicketCierre => ({
  localNombre: 'Caprichos',
  caja: { id: 12n, fecha: new Date('2026-10-21T00:00:00Z'), apertura: 100, abierta_por: 1n, cerrada_por: 2n, cerrada_en: new Date('2026-10-22T02:30:00Z') },
  cierre: {
    resultado: 'NO_CUADRA',
    aprobado_por: 2n,
    nota: 'Faltó un sol',
    conteo: { '200': 1, '50': 2, '0.5': 3 },
    medios: [
      { medio: 'EFECTIVO', sistema: 301.5, visto: 301.5, diferencia: 0 },
      { medio: 'YAPE', sistema: 200, visto: 190, diferencia: -10 },
    ],
  },
  conteos: [],
  movimientos: [{ tipo: 'EGRESO', monto: 20, motivo: 'Hielo', anulado_en: null }],
  ajustes: [],
  liquidaciones: [],
  cobrosAnulados: [],
  nombre: (id) => (id == null ? null : `U${id}`),
  ...extra,
});

describe('armarTicketCierre', () => {
  it('desglosa el efectivo por denominación y cuadra con el total contado', () => {
    const t = armarTicketCierre(base());
    expect(t.efectivo.desglose).toEqual([
      { valor: 200, cantidad: 1, subtotal: 200 },
      { valor: 50, cantidad: 2, subtotal: 100 },
      { valor: 0.5, cantidad: 3, subtotal: 1.5 },
    ]);
    expect(t.efectivo.desglose!.reduce((a, d) => a + d.subtotal, 0)).toBe(t.efectivo.contado);
    expect(t.codigo).toBe('CZ-0012');
    expect(t.fecha).toBe('21/10/2026');
    expect(t.diferencia).toBe(-10);
    expect(t.abiertoPor).toBe('U1');
    expect(t.movimientos).toEqual([{ tipo: 'EGRESO', monto: 20, motivo: 'Hielo', anulado: false }]);
  });

  it('cierre con total directo: no inventa billetes', () => {
    const t = armarTicketCierre(base({ cierre: { ...base().cierre, conteo: { total_directo: 301.5 } } }));
    expect(t.efectivo.desglose).toBeNull();
    expect(t.efectivo.contado).toBe(301.5);
    expect(lineasTicketCierre(t).some((l) => l.texto.includes('Sin detalle por billetes'))).toBe(true);
  });

  it('muestra los intentos de conteo y el ticket entra en 48 columnas', () => {
    const t = armarTicketCierre(base({
      conteos: [
        { intento: 1, conteo: { '100': 1 }, resultado: 'NO_CUADRA', por: 2n, en: new Date('2026-10-22T02:10:00Z') },
        { intento: 2, conteo: { '200': 1, '50': 2, '0.5': 3 }, resultado: 'CUADRA', por: 2n, en: new Date('2026-10-22T02:20:00Z') },
      ],
    }));
    expect(t.intentos.map((i) => i.total)).toEqual([100, 301.5]);
    const lineas = lineasTicketCierre(t, 48);
    expect(lineas.some((l) => l.texto.includes('INTENTOS DE CONTEO'))).toBe(true);
    expect(lineas.every((l) => l.texto.length <= 48)).toBe(true);
    expect(lineas.some((l) => l.texto.includes('-S/ 10.00'))).toBe(true);
  });
});

describe('CierreService.imprimirCierre', () => {
  const admin: any = { partyId: 1n, rol: 'ADMIN' };
  const armar = (impresion: any) => {
    const prisma: any = {
      cierreCaja: {
        findUnique: jest.fn().mockResolvedValue({ caja_id: 12n, ...base().cierre, caja: base().caja, medios: base().cierre.medios }),
      },
      cierreAjusteMedio: { findMany: jest.fn().mockResolvedValue([]) },
      conteoCierre: { findMany: jest.fn().mockResolvedValue([]) },
      movimientoCaja: { findMany: jest.fn().mockResolvedValue([]) },
      liquidacion: { findMany: jest.fn().mockResolvedValue([]) },
      cobro: { findMany: jest.fn().mockResolvedValue([]) },
      parametro: { findUnique: jest.fn().mockResolvedValue({ valor: { nombre: 'Caprichos' } }) },
      party: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new CierreService(prisma, {} as any, {} as any, {} as any, {} as any, undefined, impresion);
  };

  it('encola el ticket de cierre del admin', async () => {
    const impresion = { encolarTicketCierre: jest.fn().mockResolvedValue({ ok: true }) };
    await armar(impresion).imprimirCierre('12', admin, '1.1.1.1');
    expect(impresion.encolarTicketCierre).toHaveBeenCalledWith(12n, expect.objectContaining({ codigo: 'CZ-0012' }), admin, '1.1.1.1');
  });

  it('rechaza a quien no es administrador', async () => {
    const impresion = { encolarTicketCierre: jest.fn() };
    await expect(armar(impresion).imprimirCierre('12', { partyId: 3n, rol: 'CAJERO' } as any)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
    expect(impresion.encolarTicketCierre).not.toHaveBeenCalled();
  });
});

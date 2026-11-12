import { EscritorioOperativoService, proximosCumpleanos } from './escritorio-operativo.service';
import { esCumpleanosHoy } from '../../comun/fechas-lima';

describe('Cumpleaños: hoy y próximos (zona Lima, 29 de febrero)', () => {
  it('esCumpleanosHoy: día y mes exactos', () => {
    expect(esCumpleanosHoy(12, 11, '2026-11-12')).toBe(true);
    expect(esCumpleanosHoy(13, 11, '2026-11-12')).toBe(false);
    expect(esCumpleanosHoy(null, null, '2026-11-12')).toBe(false);
  });
  it('29/02 se celebra el 28/02 en año no bisiesto y el 29 en bisiesto', () => {
    expect(esCumpleanosHoy(29, 2, '2027-02-28')).toBe(true);
    expect(esCumpleanosHoy(29, 2, '2028-02-28')).toBe(false);
    expect(esCumpleanosHoy(29, 2, '2028-02-29')).toBe(true);
  });
  it('proximos: hoy primero, respeta la ventana y no trae fecha completa ni año', () => {
    const r = proximosCumpleanos(
      [
        { nombre: 'A', rol: 'x', dia: 12, mes: 11 },
        { nombre: 'B', rol: 'x', dia: 15, mes: 11 },
        { nombre: 'C', rol: 'x', dia: 1, mes: 3 },
      ],
      '2026-11-12',
      7,
    );
    expect(r.map((c) => [c.nombre, c.enDias])).toEqual([['A', 0], ['B', 3]]);
    expect(JSON.stringify(r)).not.toMatch(/20\d\d/);
  });
  it('la hora de Lima manda: 02:00 UTC del 13 sigue siendo el 12 en Lima', async () => {
    const prisma: any = {
      userAccount: { findMany: jest.fn(async () => [{ rol: 'MOZO', party: { persona: { nombres: 'Ana Maria', apellidos: 'Gil', cumple_dia: 12, cumple_mes: 11 } } }]) },
    };
    const r = await new EscritorioOperativoService(prisma).cumpleanos(7, new Date('2026-11-13T02:00:00Z'));
    expect(r.proximos[0]).toMatchObject({ nombre: 'Ana Gil', enDias: 0 });
  });
});

describe('Cumpleaños de clientes', () => {
  const ahora = new Date('2026-11-12T15:00:00Z');
  function montar(entrante: boolean) {
    const prisma: any = {
      userAccount: { findUnique: jest.fn(async () => ({ id: 1n })) },
      rolPermiso: { findMany: jest.fn(async () => [{ permiso: { modulo: 'mensajes', accion: 'ver' } }]) },
      userAccountPermiso: { findMany: jest.fn(async () => []) },
      partyRole: {
        findMany: jest.fn(async () => [
          { party: { persona: { nombres: 'Rosa Elena', apellidos: 'Lima', cumple_dia: 12, cumple_mes: 11 }, cuentaCliente: { telefono: '987654321' } } },
          { party: { persona: { nombres: 'Sin Chat', apellidos: null, cumple_dia: 14, cumple_mes: 11 }, cuentaCliente: { telefono: '911222333' } } },
        ]),
      },
      conversacion: { findMany: jest.fn(async () => [{ id: 5n, telefono: '51987654321' }]) },
      whatsappMensaje: { findMany: jest.fn(async () => (entrante ? [{ conversacion_id: 5n }] : [])) },
    };
    return new EscritorioOperativoService(prisma);
  }
  const admin: any = { partyId: 1n, rol: 'ADMIN', roles: ['ADMIN'] };

  it('enmascara el celular y solo da el número cuando hay ventana abierta', async () => {
    const r = await montar(true).cumpleanosClientes(admin, 31, ahora);
    expect(r.proximos[0]).toMatchObject({ nombre: 'Rosa Lima', celular: '9•• ••• 321', ventanaAbierta: true, chatCelular: '987654321' });
    expect(r.proximos[1]).toMatchObject({ ventanaAbierta: false, chatCelular: null });
    expect(JSON.stringify(r.proximos[1])).not.toContain('911222333');
  });
  it('sin ventana de 24 h no hay chatCelular (no se paga plantilla)', async () => {
    const r = await montar(false).cumpleanosClientes(admin, 31, ahora);
    expect(r.proximos[0]).toMatchObject({ ventanaAbierta: false, chatCelular: null });
  });
});

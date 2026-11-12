import { EscritorioOperativoService } from './escritorio-operativo.service';
import { readFileSync } from 'fs';
import { join } from 'path';

function montar(personas: any[], parametro: unknown = null) {
  const findMany = jest.fn(async (..._a: any[]) => personas.map((persona) => ({ party: { persona } })));
  const prisma: any = {
    parametro: { findUnique: jest.fn(async () => (parametro === null ? null : { valor: parametro })) },
    userAccount: { findMany },
  };
  return { svc: new EscritorioOperativoService(prisma), findMany };
}
const p = (nombres: string, apellidos: string | null, dia: number, mes: number) => ({ nombres, apellidos, cumple_dia: dia, cumple_mes: mes });

describe('Banner «Hoy cumple años» para todo el equipo', () => {
  const hoy = new Date('2026-11-12T15:00:00Z');

  it('devuelve solo «Nombre A.»: sin fecha, edad, celular, rol ni próximos', async () => {
    const { svc } = montar([p('Ana María', 'Gil Paz', 12, 11), p('Luis', 'ñañez', 12, 11)]);
    const r = await svc.cumpleanosHoy(1n, hoy);
    expect(r).toEqual({ nombres: ['Ana G.', 'Luis Ñ.'] });
    expect(Object.keys(r)).toEqual(['nombres']);
    expect(JSON.stringify(r)).not.toMatch(/\d/);
  });

  it('descarta a quien no cumple hoy y excluye a la propia persona en la consulta', async () => {
    const { svc, findMany } = montar([p('Otra', 'X', 13, 11), p('Sin', null, 12, 11)]);
    expect((await svc.cumpleanosHoy(9n, hoy)).nombres).toEqual(['Sin']);
    expect(findMany.mock.calls[0][0].where).toMatchObject({ activo: true, party_id: { not: 9n } });
  });

  it('hora de Lima: 02:00 UTC del 13 sigue siendo el 12', async () => {
    const { svc } = montar([p('Ana', 'Gil', 12, 11)]);
    expect((await svc.cumpleanosHoy(1n, new Date('2026-11-13T02:00:00Z'))).nombres).toEqual(['Ana G.']);
  });

  it('29 de febrero: se celebra el 28 en año no bisiesto y el 29 en bisiesto', async () => {
    const a = montar([p('Bea', 'Ruiz', 29, 2)]);
    expect((await a.svc.cumpleanosHoy(1n, new Date('2027-02-28T15:00:00Z'))).nombres).toEqual(['Bea R.']);
    expect(a.findMany.mock.calls[0][0].where.party.persona).toEqual({ cumple_mes: 2, cumple_dia: { in: [28, 29] } });
    const b = montar([p('Bea', 'Ruiz', 29, 2)]);
    expect((await b.svc.cumpleanosHoy(1n, new Date('2028-02-28T15:00:00Z'))).nombres).toEqual([]);
    expect((await b.svc.cumpleanosHoy(1n, new Date('2028-02-29T15:00:00Z'))).nombres).toEqual(['Bea R.']);
  });

  it('tope de cinco nombres', async () => {
    const { svc } = montar(Array.from({ length: 8 }, (_, i) => p(`N${i}`, 'Z', 12, 11)));
    expect((await svc.cumpleanosHoy(1n, hoy)).nombres).toHaveLength(5);
  });

  it('parámetro cumpleanos_banner_equipo en «no» lo apaga sin consultar personas', async () => {
    const { svc, findMany } = montar([p('Ana', 'Gil', 12, 11)], 'no');
    expect(await svc.cumpleanosHoy(1n, hoy)).toEqual({ nombres: [] });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('sin parámetro o en «si» está encendido', async () => {
    expect((await montar([p('Ana', 'Gil', 12, 11)], 'si').svc.cumpleanosHoy(1n, hoy)).nombres).toEqual(['Ana G.']);
  });

  it('permiso: el endpoint no exige ninguno (cualquier usuario del panel) y la lista completa sigue con escritorio/cumpleanos', () => {
    const fuente = readFileSync(join(__dirname, 'escritorio-operativo.controller.ts'), 'utf8');
    expect(fuente).toMatch(/@Get\('cumpleanos-hoy'\)\s+cumpleanosHoy\(/);
    expect(fuente).toMatch(/@Get\('cumpleanos'\)\s+@Permiso\('escritorio', 'cumpleanos'\)/);
  });
});

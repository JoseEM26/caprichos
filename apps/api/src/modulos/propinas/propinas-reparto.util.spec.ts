import { firmaReparto, repartirPorHoras } from './propinas-reparto.util';

const suma = (filas: Array<{ monto: number }>) => Math.round(filas.reduce((a, f) => a + f.monto * 100, 0));

describe('repartirPorHoras', () => {
  it('reparte en proporción a las horas: 3, 5 y 7 días', () => {
    const filas = repartirPorHoras(150, [
      { partyId: 1, horas: 30 },
      { partyId: 2, horas: 50 },
      { partyId: 3, horas: 70 },
    ]);
    // 30, 50 y 70 horas de 150: 20 %, 33.33 % y 46.67 % de S/ 150
    expect(filas.map((f) => f.monto)).toEqual([30, 50, 70]);
    expect(filas.map((f) => f.porcentaje)).toEqual([20, 33.3333, 46.6667]);
    expect(suma(filas)).toBe(15000);
  });

  it('la suma de céntimos es exacta aunque no se pueda dividir (resto mayor, empate por orden)', () => {
    // 10 soles entre tres personas iguales: 3.34 + 3.33 + 3.33
    const filas = repartirPorHoras(10, [
      { partyId: 1, horas: 8 },
      { partyId: 2, horas: 8 },
      { partyId: 3, horas: 8 },
    ]);
    expect(filas.map((f) => f.monto)).toEqual([3.34, 3.33, 3.33]);
    expect(suma(filas)).toBe(1000);
  });

  it('nunca pierde ni inventa céntimos con muchas personas', () => {
    const participantes = Array.from({ length: 17 }, (_, i) => ({ partyId: i + 1, horas: 40 + i * 3.37 }));
    const filas = repartirPorHoras(123.45, participantes);
    expect(suma(filas)).toBe(12345);
  });

  it('personas con 0 horas no reciben', () => {
    const filas = repartirPorHoras(20, [
      { partyId: 1, horas: 0 },
      { partyId: 2, horas: 10 },
    ]);
    expect(filas).toEqual([{ partyId: 2, horas: 10, porcentaje: 100, monto: 20 }]);
  });

  it('sin horas positivas devuelve lista vacía (el llamador da el error)', () => {
    expect(repartirPorHoras(20, [])).toEqual([]);
    expect(repartirPorHoras(20, [{ partyId: 1, horas: 0 }])).toEqual([]);
  });

  it('total cero: todos en cero y horas repartidas', () => {
    const filas = repartirPorHoras(0, [{ partyId: 1, horas: 5 }, { partyId: 2, horas: 5 }]);
    expect(filas.map((f) => f.monto)).toEqual([0, 0]);
  });

  it('la firma cambia si cambian horas o montos, y no depende del orden', () => {
    const a = [{ partyId: 2, horas: 5, monto: 1 }, { partyId: 1, horas: 3, monto: 2 }];
    const b = [{ partyId: 1, horas: 3, monto: 2 }, { partyId: 2, horas: 5, monto: 1 }];
    expect(firmaReparto(3, a)).toBe(firmaReparto(3, b));
    expect(firmaReparto(3, a)).not.toBe(firmaReparto(3, [{ partyId: 1, horas: 3.5, monto: 2 }, { partyId: 2, horas: 5, monto: 1 }]));
  });
});

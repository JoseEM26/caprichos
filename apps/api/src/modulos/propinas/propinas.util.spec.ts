import {
  claveCanalPropina,
  diaLima,
  normalizarPropina,
  propinaActivaParaCanal,
  rangoMesLima,
  repartirPropina,
  resumirPropinas,
  topePropina,
  totalCobrable,
} from './propinas.util';

describe('propinas.util', () => {
  describe('interruptor por canal', () => {
    it('carta y bot tienen interruptor propio; mozo y caja nunca ofrecen propina', () => {
      expect(claveCanalPropina('CARTA')).toBe('carta');
      expect(claveCanalPropina('WHATSAPP')).toBe('bot');
      expect(claveCanalPropina('BOT')).toBe('bot');
      expect(claveCanalPropina('MOZO')).toBeNull();
      expect(claveCanalPropina('CAJA')).toBeNull();
    });

    it('encendida solo en carta: el bot sigue apagado; sin configuración = apagada', () => {
      const activa = { carta: true, bot: false };
      expect(propinaActivaParaCanal(activa, 'CARTA')).toBe(true);
      expect(propinaActivaParaCanal(activa, 'WHATSAPP')).toBe(false);
      expect(propinaActivaParaCanal(null, 'CARTA')).toBe(false);
      expect(propinaActivaParaCanal({ carta: 'si' }, 'CARTA')).toBe(false);
    });

    it('tope inválido cae al de por defecto', () => {
      expect(topePropina(null)).toBe(200);
      expect(topePropina(50)).toBe(50);
    });
  });

  describe('normalizarPropina', () => {
    it('vacío, 0 o texto vacío = sin propina', () => {
      expect(normalizarPropina(undefined, 200)).toEqual({ valido: true, monto: 0 });
      expect(normalizarPropina('', 200)).toEqual({ valido: true, monto: 0 });
      expect(normalizarPropina(0, 200)).toEqual({ valido: true, monto: 0 });
    });

    it('acepta número o texto con coma o S/, hasta 2 decimales', () => {
      expect(normalizarPropina(5, 200)).toEqual({ valido: true, monto: 5 });
      expect(normalizarPropina('2,50', 200)).toEqual({ valido: true, monto: 2.5 });
      expect(normalizarPropina('S/ 10', 200)).toEqual({ valido: true, monto: 10 });
    });

    it('rechaza más de 2 decimales, negativos, texto libre y sobre el tope', () => {
      expect(normalizarPropina(1.234, 200)).toEqual({ valido: false, motivo: 'decimales' });
      expect(normalizarPropina(-3, 200)).toEqual({ valido: false, motivo: 'formato' });
      expect(normalizarPropina('cinco soles', 200)).toEqual({ valido: false, motivo: 'formato' });
      expect(normalizarPropina(201, 200)).toEqual({ valido: false, motivo: 'tope' });
    });
  });

  describe('repartirPropina', () => {
    it('reparte en céntimos y la suma es exacta (resto mayor)', () => {
      const reparto = repartirPropina([{ monto: 30 }, { monto: 25 }], 5);
      expect(reparto.reduce((a, b) => a + b, 0)).toBeCloseTo(5, 2);
      expect(reparto).toEqual([2.73, 2.27]);
    });

    it('un solo medio: toda la propina va a ese renglón', () => {
      expect(repartirPropina([{ monto: 50 }], 7.5)).toEqual([7.5]);
    });

    it('sin propina, todo cero', () => {
      expect(repartirPropina([{ monto: 50 }], 0)).toEqual([0]);
    });
  });

  describe('totalCobrable', () => {
    it('venta + propina; el comprobante y los puntos usan solo el total', () => {
      expect(totalCobrable({ total: 40, propina: 5 })).toBe(45);
      expect(totalCobrable({ total: 40 })).toBe(40);
    });
  });

  describe('mes de Lima', () => {
    it('el rango de un mes empieza a las 05:00 UTC (Lima no tiene horario de verano)', () => {
      const { inicio, fin } = rangoMesLima(2026, 11);
      expect(inicio.toISOString()).toBe('2026-11-01T05:00:00.000Z');
      expect(fin.toISOString()).toBe('2026-12-01T05:00:00.000Z');
    });

    it('un cobro a las 23:30 de Lima cuenta en su día calendario de Lima', () => {
      expect(diaLima(new Date('2026-11-06T04:30:00.000Z'))).toBe('2026-11-05');
      expect(diaLima(new Date('2026-11-06T05:30:00.000Z'))).toBe('2026-11-06');
    });
  });

  describe('resumirPropinas', () => {
    it('suma por día, medio (efectivo vs digital) y canal; ignora propina cero', () => {
      const r = resumirPropinas([
        { en: new Date('2026-11-06T15:00:00.000Z'), medio: 'EFECTIVO', canal: 'CARTA', propina: 5 },
        { en: new Date('2026-11-06T16:00:00.000Z'), medio: 'YAPE', canal: 'WHATSAPP', propina: 3.5 },
        { en: new Date('2026-11-07T16:00:00.000Z'), medio: 'YAPE', canal: 'CARTA', propina: 0 },
      ]);
      expect(r.total).toBe(8.5);
      expect(r.efectivo).toBe(5);
      expect(r.digital).toBe(3.5);
      expect(r.porDia).toEqual([{ fecha: '2026-11-06', total: 8.5, efectivo: 5, digital: 3.5 }]);
      expect(r.porMedio).toEqual([
        { medio: 'EFECTIVO', monto: 5 },
        { medio: 'YAPE', monto: 3.5 },
      ]);
      expect(r.porCanal.map((c) => c.canal)).toEqual(['CARTA', 'WHATSAPP']);
    });

    it('una devolución (fila negativa) resta en su día y en su medio', () => {
      const r = resumirPropinas([
        { en: new Date('2026-11-06T15:00:00.000Z'), medio: 'YAPE', canal: 'CARTA', propina: 10 },
        { en: new Date('2026-11-06T20:00:00.000Z'), medio: 'YAPE', canal: 'CARTA', propina: -4 },
      ]);
      expect(r.total).toBe(6);
      expect(r.digital).toBe(6);
      expect(r.porMedio).toEqual([{ medio: 'YAPE', monto: 6 }]);
    });
  });
});

import {
  calcularDiasHabilesRestantes,
  enmascararDocumento,
  enmascararTelefono,
  formatearFechaIso,
  formatearTextoPlazo,
  obtenerAnioLima,
  obtenerHoyLima,
  sumarDiasHabiles,
} from './reclamos.util';

describe('ReclamosUtil', () => {
  describe('sumarDiasHabiles', () => {
    it('un reclamo del viernes vence 15 días hábiles después, no 15 naturales (salta fines de semana)', () => {
      // Viernes 23 de octubre de 2026
      const fechaViernes = '2026-10-23';
      const resultado = sumarDiasHabiles(fechaViernes, 15);

      // 15 días naturales darían 2026-11-07 (sábado)
      // 15 días hábiles deben saltar 3 fines de semana (6 días no laborales) -> 21 días naturales -> Viernes 13 de noviembre de 2026
      expect(resultado).toBe('2026-11-13');
      expect(resultado).not.toBe('2026-11-07');
    });

    it('suma 1 día hábil desde un viernes dando el siguiente lunes', () => {
      const fechaViernes = '2026-10-23';
      expect(sumarDiasHabiles(fechaViernes, 1)).toBe('2026-10-26');
    });

    it('suma 5 días hábiles desde un lunes dando el siguiente lunes', () => {
      const fechaLunes = '2026-10-19';
      expect(sumarDiasHabiles(fechaLunes, 5)).toBe('2026-10-26');
    });
  });

  describe('calcularDiasHabilesRestantes y formatearTextoPlazo', () => {
    it('calcula exactamente «Faltan 3 días» cuando faltan 3 días hábiles', () => {
      // Martes a Viernes de la misma semana = 3 días hábiles restantes (Mié, Jue, Vie)
      const hoy = '2026-10-20'; // Martes
      const limite = '2026-10-23'; // Viernes
      const dias = calcularDiasHabilesRestantes(hoy, limite);
      expect(dias).toBe(3);
      expect(formatearTextoPlazo(dias)).toBe('Faltan 3 días');
    });

    it('calcula «Falta 1 día» cuando queda solo un día hábil', () => {
      const hoy = '2026-10-22';
      const limite = '2026-10-23';
      const dias = calcularDiasHabilesRestantes(hoy, limite);
      expect(dias).toBe(1);
      expect(formatearTextoPlazo(dias)).toBe('Falta 1 día');
    });

    it('calcula «Faltan 0 días» cuando hoy es el día límite', () => {
      const hoy = '2026-10-23';
      const limite = '2026-10-23';
      const dias = calcularDiasHabilesRestantes(hoy, limite);
      expect(dias).toBe(0);
      expect(formatearTextoPlazo(dias)).toBe('Faltan 0 días');
    });

    it('calcula «Vencido hace 1 día» cuando venció el viernes y hoy es lunes', () => {
      const limite = '2026-10-23'; // Viernes
      const hoy = '2026-10-26'; // Lunes
      const dias = calcularDiasHabilesRestantes(hoy, limite);
      expect(dias).toBe(-1);
      expect(formatearTextoPlazo(dias)).toBe('Vencido hace 1 día');
    });

    it('calcula «Vencido hace 3 días» cuando han pasado 3 días hábiles tras el vencimiento', () => {
      const limite = '2026-10-23'; // Viernes
      const hoy = '2026-10-28'; // Miércoles
      const dias = calcularDiasHabilesRestantes(hoy, limite);
      expect(dias).toBe(-3);
      expect(formatearTextoPlazo(dias)).toBe('Vencido hace 3 días');
    });
  });

  describe('Enmascaramiento según Ley 29733 (ADR-005)', () => {
    it('enmascara DNI de 8 dígitos mostrando solo 2 primeros y 2 últimos', () => {
      expect(enmascararDocumento('45678912')).toBe('45****12');
      expect(enmascararDocumento('08765432')).toBe('08****32');
    });

    it('enmascara Carnet de Extranjería (CE)', () => {
      expect(enmascararDocumento('001234567')).toBe('00****67');
    });

    it('enmascara teléfono de 9 dígitos mostrando 2 primeros y 2 últimos con asteriscos', () => {
      expect(enmascararTelefono('987654321')).toBe('98*****21');
    });

    it('maneja valores vacíos o nulos de forma segura', () => {
      expect(enmascararDocumento('')).toBe('****');
      expect(enmascararTelefono('')).toBe('****');
      expect(enmascararDocumento('12')).toBe('****');
    });
  });

  describe('obtenerHoyLima y obtenerAnioLima', () => {
    it('calcula la fecha y año con la hora de Lima (UTC-5), no la del servidor', () => {
      // 2026-10-22T02:00:00.000Z en UTC es todavía 2026-10-21 a las 21:00 en Lima
      const fechaUtc = new Date('2026-10-22T02:00:00.000Z');
      expect(obtenerHoyLima(fechaUtc)).toBe('2026-10-21');
      expect(obtenerAnioLima(fechaUtc)).toBe(2026);
    });

    it('calcula el año nuevo en Lima al cruzar la medianoche local', () => {
      // 2027-01-01T04:59:00.000Z en UTC es 2026-12-31 23:59:00 en Lima
      const finDeAnio = new Date('2027-01-01T04:59:00.000Z');
      expect(obtenerHoyLima(finDeAnio)).toBe('2026-12-31');
      expect(obtenerAnioLima(finDeAnio)).toBe(2026);

      // 2027-01-01T05:01:00.000Z en UTC es 2027-01-01 00:01:00 en Lima
      const anioNuevo = new Date('2027-01-01T05:01:00.000Z');
      expect(obtenerHoyLima(anioNuevo)).toBe('2027-01-01');
      expect(obtenerAnioLima(anioNuevo)).toBe(2027);
    });
  });
});

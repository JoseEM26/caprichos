import { estadoVerificacionCliente as f, INICIO_VERIFICACION_REGISTRO as INI } from './estado-verificacion-cliente';

const base = { tieneContrasena: true, cuentaActiva: true, saldo: 5, consentimientosCarta: [], creadoEnMostrador: false, claveCambiadaEn: null };
const despues = new Date('2026-11-05T12:00:00Z');
const antes = new Date('2026-10-20T12:00:00Z');

describe('estadoVerificacionCliente', () => {
  it('registro en la carta con código: verificado con su fecha', () => {
    const r = f({ ...base, consentimientosCarta: [despues] });
    expect(r).toMatchObject({ estado: 'VERIFICADO', verificado: true, verificadoEn: despues, puedeGastarPuntos: true });
  });
  it('contraseña creada con código de recuperación: verificado', () => {
    expect(f({ ...base, claveCambiadaEn: despues })).toMatchObject({ verificado: true, verificadoEn: despues });
  });
  it('toma la fecha más antigua', () => {
    const otra = new Date('2026-11-06T00:00:00Z');
    expect(f({ ...base, consentimientosCarta: [otra], claveCambiadaEn: despues }).verificadoEn).toEqual(despues);
  });
  it('registro anterior al código obligatorio: cuenta antigua (no se inventa)', () => {
    const r = f({ ...base, consentimientosCarta: [antes] });
    expect(r).toMatchObject({ estado: 'ANTIGUA', verificado: false, verificadoEn: null, tieneContrasena: true });
    expect(r.puedeGastarPuntos).toBe(true); // el canje real solo pide cuenta activa y contraseña
  });
  it('justo en el límite cuenta como verificado', () => {
    expect(f({ ...base, consentimientosCarta: [INI] }).verificado).toBe(true);
  });
  it('contraseña sin ninguna evidencia: antigua', () => {
    expect(f(base).estado).toBe('ANTIGUA');
  });
  it('mostrador sin contraseña: sin verificar por mostrador y no gasta', () => {
    expect(f({ ...base, tieneContrasena: false, creadoEnMostrador: true })).toMatchObject({
      estado: 'SIN_VERIFICAR', razon: 'MOSTRADOR', verificado: false, puedeGastarPuntos: false,
    });
  });
  it('bot sin contraseña: sin verificar por no crear contraseña', () => {
    expect(f({ ...base, tieneContrasena: false })).toMatchObject({ estado: 'SIN_VERIFICAR', razon: 'SIN_CONTRASENA' });
  });
  it('sin saldo o cuenta inactiva no gasta', () => {
    expect(f({ ...base, consentimientosCarta: [despues], saldo: 0 }).puedeGastarPuntos).toBe(false);
    expect(f({ ...base, consentimientosCarta: [despues], cuentaActiva: false }).puedeGastarPuntos).toBe(false);
  });
});

import { horaHHMM, interpretarConfig, validarHorasEnvio } from './facturacion.config';

describe('horas de envío', () => {
  it('acepta HH:MM y la hora entera antigua', () => {
    expect(horaHHMM('23:30')).toBe('23:30');
    expect(horaHHMM('9:05')).toBe('09:05');
    expect(horaHHMM(16)).toBe('16:00');
    expect(horaHHMM('24:00')).toBeNull();
    expect(horaHHMM('abc')).toBeNull();
  });

  it('el resumen va al menos 15 min después del lote y antes de 23:50', () => {
    expect(validarHorasEnvio('23:00', '23:30')).toBeNull();
    expect(validarHorasEnvio('23:00', '23:10')).toMatch(/15 minutos/);
    expect(validarHorasEnvio('22:00', '23:55')).toMatch(/23:50/);
  });

  it('defectos 23:00 y 23:30; un par inválido guardado vuelve al defecto', () => {
    expect(interpretarConfig({})).toMatchObject({ horaEnvio: '23:00', horaResumen: '23:30' });
    expect(interpretarConfig({ facturacion_hora_envio: 23, facturacion_hora_resumen: '22:00' })).toMatchObject({ horaEnvio: '23:00', horaResumen: '23:30' });
    expect(interpretarConfig({ facturacion_hora_envio: '22:45', facturacion_hora_resumen: '23:15' })).toMatchObject({ horaEnvio: '22:45', horaResumen: '23:15' });
  });
});

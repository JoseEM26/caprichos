import { avisosMozo, DatosVoucherExtraidos, ContextoSemaforo } from '../semaforo.util';

describe('avisosMozo - avisos en texto para el mozo', () => {
  const voucher: DatosVoucherExtraidos = {
    legible: true,
    monto: 35.5,
    operacion: '12345678',
    fecha: '2026-10-27',
    hora: '14:30',
    titular: 'Maria Jose Morillo Ruiz',
    destinoNumero: '977503006',
    medioDetectado: 'YAPE',
    confianza: 0.95,
  };

  const contexto: ContextoSemaforo = {
    pedidoTotal: 35.5,
    medioEsperado: 'YAPE',
    titularEsperado: 'Maria Jose Morillo Ruiz',
    yapeNumeroEsperado: '977503006',
    plinNumeroEsperado: '977503006',
    fechaActual: '2026-10-27',
  };

  it('sin avisos cuando todo cuadra', () => {
    expect(avisosMozo(voucher, contexto)).toEqual([]);
  });

  it('avisa si el monto no coincide con lo que debe pagar por Yape', () => {
    const avisos = avisosMozo({ ...voucher, monto: 20 }, contexto);
    expect(avisos).toEqual([
      'El monto del voucher (S/ 20.00) no coincide con lo que debe pagar por Yape (S/ 35.50)',
    ]);
  });

  it('avisa si el medio del voucher no es el elegido', () => {
    const avisos = avisosMozo({ ...voucher, medioDetectado: 'PLIN' }, { ...contexto, medioEsperado: 'YAPE' });
    expect(avisos).toContain('El medio del voucher (Plin) no coincide con el elegido (Yape)');
  });

  it('avisa de duplicado, fecha ajena y destinatario distinto, sin repetir datos del destinatario', () => {
    const avisos = avisosMozo(
      { ...voucher, fecha: '2026-10-20', titular: 'Juan Perez' },
      { ...contexto, operacionDuplicada: true },
    );
    expect(avisos).toEqual(
      expect.arrayContaining([
        'El destinatario no coincide con la cuenta del negocio',
        'La fecha del voucher no es de hoy',
        'Este voucher parece ya usado en otro pedido',
      ]),
    );
    expect(avisos.join(' ')).not.toContain('12345678');
    expect(avisos.join(' ')).not.toContain('Juan Perez');
  });

  it('avisa si la foto es de confianza media (borrosa o cortada)', () => {
    expect(avisosMozo({ ...voucher, confianza: 0.6 }, contexto)).toContain('La foto está borrosa o cortada; sube otra');
  });

  it('sin lectura de IA no hay avisos', () => {
    expect(avisosMozo(null, contexto)).toEqual([]);
    expect(avisosMozo(voucher, { ...contexto, sinLectura: true })).toEqual([]);
  });

  it('con plan dividido compara con la parte digital: no hay aviso si el monto del voucher coincide', () => {
    // pedidoTotal ya viene resuelto por montoEsperadoVoucher (parte digital del plan)
    expect(avisosMozo({ ...voucher, monto: 20 }, { ...contexto, pedidoTotal: 20 })).toEqual([]);
  });
});

import { detalleDatosPago, TEXTOS_PAGO } from '../conversacion/flujos/pago/textos-pago';
import { textoDatosPagoPersona } from './datos-pago-persona.util';

const pagos = { transferencia: { activo: true, banco: 'BCP', titular: 'Ana Prueba', cuenta: '191-00000000-0-00', cci: '002-191-000000000000-00' } };

describe('datos de transferencia en texto', () => {
  it('el bot manda banco, titular, cuenta y CCI, cada uno en su línea', () => {
    const t = detalleDatosPago('TRANSFERENCIA', pagos, '35.00').split('\n');
    expect(t).toEqual(expect.arrayContaining(['• Banco: BCP', '• Titular: Ana Prueba', '• Cuenta: 191-00000000-0-00', '• CCI: 002-191-000000000000-00']));
    const msg = TEXTOS_PAGO.datosPagoMensaje({ codigo: 'C-007', total: 35, metodo: 'TRANSFERENCIA', datosLocalPagos: pagos } as any);
    expect(msg).toContain('• CCI: 002-191-000000000000-00');
  });

  it('el mensaje de Caja/mozo lleva código, monto, datos y pide la captura', () => {
    const t = textoDatosPagoPersona({ nombre: 'Lucía Pérez', codigo: 'C-007', medio: 'TRANSFERENCIA', monto: 35, pagos });
    expect(t).toContain('Hola Lucía');
    expect(t).toContain('C-007');
    expect(t).toContain('S/ 35.00');
    expect(t).toContain('• Cuenta: 191-00000000-0-00');
    expect(t).toContain('• CCI: 002-191-000000000000-00');
    expect(t).toMatch(/captura/);
  });

  it('Yape lleva el número', () => {
    const t = textoDatosPagoPersona({ codigo: 'C-8', medio: 'YAPE', monto: 10, pagos: { yape: { numero: '900000000', titular: 'Ana' } } });
    expect(t).toContain('900000000');
  });
});

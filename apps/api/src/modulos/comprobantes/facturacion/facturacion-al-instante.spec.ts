import { interpretarConfig } from './facturacion.config';

describe('Cuándo se emiten boletas y facturas', () => {
  it('por defecto AL INSTANTE: sin valor, «no» o cualquier otro valor no activa la noche', () => {
    expect(interpretarConfig({}).envioNocturno).toBe(false);
    expect(interpretarConfig({ facturacion_envio_nocturno: 'no' }).envioNocturno).toBe(false);
    expect(interpretarConfig({ facturacion_envio_nocturno: 'x' }).envioNocturno).toBe(false);
  });
  it('solo «si» activa el envío de la noche', () => {
    expect(interpretarConfig({ facturacion_envio_nocturno: 'si' }).envioNocturno).toBe(true);
    expect(interpretarConfig({ facturacion_envio_nocturno: true }).envioNocturno).toBe(true);
  });
});

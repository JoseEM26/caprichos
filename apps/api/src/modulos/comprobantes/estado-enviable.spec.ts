import { estadoEnviable } from './factura-whatsapp';

describe('Cuándo se puede mandar el comprobante al cliente por WhatsApp', () => {
  it('la boleta sale apenas queda firmada al cobrar (PENDIENTE_RESUMEN), sin esperar el resumen de la noche', () => {
    expect(estadoEnviable('BOLETA', 'PENDIENTE_RESUMEN')).toBe(true);
    expect(estadoEnviable('BOLETA', 'EMITIDO_SUNAT')).toBe(true);
  });
  it('la factura solo cuando SUNAT la aceptó', () => {
    expect(estadoEnviable('FACTURA', 'EMITIDO_SUNAT')).toBe(true);
    expect(estadoEnviable('FACTURA', 'PENDIENTE_RESUMEN')).toBe(false);
    expect(estadoEnviable('FACTURA', 'PENDIENTE_ENVIO')).toBe(false);
  });
  it('rechazadas o por emitir no salen', () => {
    expect(estadoEnviable('BOLETA', 'RECHAZADO')).toBe(false);
    expect(estadoEnviable('BOLETA', 'POR_EMITIR_NOCHE')).toBe(false);
  });
});

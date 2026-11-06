import { payloadQr, secretoQr, slotDe, verificarCodigo, verificarPayload, codigoCorto } from './asistencia.qr';

describe('QR de asistencia (HMAC, ventana de 30 s)', () => {
  const secreto = secretoQr('secreto-de-prueba');
  const ahora = Date.parse('2026-11-06T13:00:10Z');
  const slot = slotDe(ahora);

  it('acepta el QR de la ranura actual', () => {
    expect(verificarPayload(secreto, payloadQr(secreto, slot), ahora)).toBe(slot);
  });

  it('acepta la ranura anterior (latencia) pero no la de hace dos', () => {
    expect(verificarPayload(secreto, payloadQr(secreto, slot - 1), ahora)).toBe(slot - 1);
    expect(verificarPayload(secreto, payloadQr(secreto, slot - 2), ahora)).toBeNull();
  });

  it('rechaza un QR firmado con otro secreto (ajeno)', () => {
    const ajeno = secretoQr('otro-servidor');
    expect(verificarPayload(secreto, payloadQr(ajeno, slot), ahora)).toBeNull();
  });

  it('rechaza un texto cualquiera o una firma alterada', () => {
    expect(verificarPayload(secreto, 'hola', ahora)).toBeNull();
    const bueno = payloadQr(secreto, slot);
    const alterado = bueno.slice(0, -1) + (bueno.endsWith('0') ? '1' : '0');
    expect(verificarPayload(secreto, alterado, ahora)).toBeNull();
  });

  it('el código de 6 dígitos vale para la ranura actual y la anterior', () => {
    expect(verificarCodigo(secreto, codigoCorto(secreto, slot), ahora)).toBe(slot);
    expect(verificarCodigo(secreto, codigoCorto(secreto, slot - 1), ahora)).toBe(slot - 1);
    expect(verificarCodigo(secreto, codigoCorto(secreto, slot - 2), ahora)).toBeNull();
    expect(verificarCodigo(secreto, '12345', ahora)).toBeNull();
  });
});

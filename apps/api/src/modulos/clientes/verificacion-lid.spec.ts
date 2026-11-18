import { atenderVerificacionSinNumero, estadoVerificacion, iniciarVerificacion, PuenteLid, RESPUESTA_NO_VERIFICADO, RESPUESTA_SIN_NUMERO, RESPUESTA_VERIFICADO, claveMarcaVerificacion } from './verificacion-whatsapp.util';

const SECRETO = 'secreto_de_prueba';
const TEL9 = '987654321';
const OTRO9 = '912345678';
const LID = '123456789012345';
const texto = (token: string) => `Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`;

/** Redis en memoria con lo que usa la verificación. */
function redisFalso() {
  const datos = new Map<string, string>();
  const contadores = new Map<string, number>();
  return {
    datos,
    set: jest.fn(async (k: string, v: string) => {
      datos.set(k, v);
      return 'OK';
    }),
    get: jest.fn(async (k: string) => datos.get(k) ?? null),
    incr: jest.fn(async (k: string) => {
      const n = (contadores.get(k) ?? 0) + 1;
      contadores.set(k, n);
      return n;
    }),
    expire: jest.fn().mockResolvedValue(1),
    del: jest.fn(async (...ks: string[]) => ks.length),
  };
}

/** Puente sin datos: nada aprendido, Evolution no sabe, no puede confirmar. */
const puenteVacio = (): jest.Mocked<PuenteLid> => ({
  aprendido: jest.fn().mockResolvedValue(null),
  numeroDeLid: jest.fn().mockResolvedValue(null),
  confirmaLid: jest.fn().mockResolvedValue('NO_RESUELTO'),
  aprender: jest.fn().mockResolvedValue(undefined),
});

describe('Verificación de un remitente con LID (número oculto)', () => {
  let redis: ReturnType<typeof redisFalso>;
  let token: string;
  beforeEach(async () => {
    redis = redisFalso();
    token = await iniciarVerificacion(redis as any, SECRETO, TEL9, 'REGISTRO');
  });

  it('1. par ya aprendido (tabla) con el celular del token: verifica y marca', async () => {
    const puente = puenteVacio();
    puente.aprendido.mockResolvedValue(TEL9);
    const r = await atenderVerificacionSinNumero(redis as any, SECRETO, texto(token), LID, puente);
    expect(r).toBe(RESPUESTA_VERIFICADO);
    expect(await estadoVerificacion(redis as any, SECRETO, token)).toBe('verificado');
    expect(redis.datos.get(claveMarcaVerificacion('REGISTRO', TEL9))).toBe('1');
    expect(puente.numeroDeLid).not.toHaveBeenCalled();
  });

  it('2. Evolution asocia el LID al celular del token: verifica, guarda el par y marca', async () => {
    const puente = puenteVacio();
    puente.numeroDeLid.mockResolvedValue(`51${TEL9}`);
    const r = await atenderVerificacionSinNumero(redis as any, SECRETO, texto(token), LID, puente);
    expect(r).toBe(RESPUESTA_VERIFICADO);
    expect(puente.aprender).toHaveBeenCalledWith(LID, TEL9);
    expect(redis.datos.get(claveMarcaVerificacion('REGISTRO', TEL9))).toBe('1');
  });

  it('3. Evolution asocia el LID a OTRO celular: no verifica, no marca y el token sigue pendiente', async () => {
    const puente = puenteVacio();
    puente.numeroDeLid.mockResolvedValue(`51${OTRO9}`);
    const r = await atenderVerificacionSinNumero(redis as any, SECRETO, texto(token), LID, puente);
    expect(r).toBe(RESPUESTA_NO_VERIFICADO);
    expect(redis.datos.get(claveMarcaVerificacion('REGISTRO', TEL9))).toBeUndefined();
    expect(await estadoVerificacion(redis as any, SECRETO, token)).toBe('pendiente');
  });

  it('4. prueba de propiedad: Evolution confirma que el número del token tiene ese LID: verifica', async () => {
    const puente = puenteVacio();
    puente.confirmaLid.mockResolvedValue('CONFIRMADO');
    const r = await atenderVerificacionSinNumero(redis as any, SECRETO, texto(token), LID, puente);
    expect(r).toBe(RESPUESTA_VERIFICADO);
    expect(puente.confirmaLid).toHaveBeenCalledWith(`51${TEL9}`, LID);
    expect(puente.aprender).toHaveBeenCalledWith(LID, TEL9);
  });

  it('5. prueba de propiedad: Evolution dice que el LID no corresponde al número del token: NO verifica y no marca', async () => {
    const puente = puenteVacio();
    puente.confirmaLid.mockResolvedValue('OTRO');
    const r = await atenderVerificacionSinNumero(redis as any, SECRETO, texto(token), LID, puente);
    expect(r).toBe(RESPUESTA_NO_VERIFICADO);
    expect(redis.datos.get(claveMarcaVerificacion('REGISTRO', TEL9))).toBeUndefined();
    expect(puente.aprender).not.toHaveBeenCalled();
  });

  it('6. Evolution falla o no responde (puente lanza): el token pasa a sin_numero y se responde el texto del código', async () => {
    const puente = puenteVacio();
    puente.aprendido.mockRejectedValue(new Error('redis caído'));
    puente.numeroDeLid.mockRejectedValue(new Error('timeout'));
    puente.confirmaLid.mockRejectedValue(new Error('timeout'));
    const r = await atenderVerificacionSinNumero(redis as any, SECRETO, texto(token), LID, puente);
    expect(r).toBe(RESPUESTA_SIN_NUMERO);
    expect(r).toContain('código de 6 dígitos');
    expect(await estadoVerificacion(redis as any, SECRETO, token)).toBe('sin_numero');
  });

  it('7. sin datos de Evolution (NO_RESUELTO) también pasa a sin_numero y no marca la verificación', async () => {
    const r = await atenderVerificacionSinNumero(redis as any, SECRETO, texto(token), LID, puenteVacio());
    expect(r).toBe(RESPUESTA_SIN_NUMERO);
    expect(redis.datos.get(claveMarcaVerificacion('REGISTRO', TEL9))).toBeUndefined();
  });

  it('8. sin LID (identificador de Meta): va directo a sin_numero', async () => {
    const r = await atenderVerificacionSinNumero(redis as any, SECRETO, texto(token), null, null);
    expect(r).toBe(RESPUESTA_SIN_NUMERO);
    expect(await estadoVerificacion(redis as any, SECRETO, token)).toBe('sin_numero');
  });

  it('9. token inexistente o vencido: NO_VERIFICADO sin consultar nada', async () => {
    const puente = puenteVacio();
    const r = await atenderVerificacionSinNumero(redis as any, SECRETO, texto('ZZZZZZZZ'), LID, puente);
    expect(r).toBe(RESPUESTA_NO_VERIFICADO);
    expect(puente.aprendido).not.toHaveBeenCalled();
    expect(puente.numeroDeLid).not.toHaveBeenCalled();
    expect(puente.confirmaLid).not.toHaveBeenCalled();
  });

  it('10. el log nunca muestra el token completo ni el LID completo', async () => {
    const eventos: string[] = [];
    await atenderVerificacionSinNumero(redis as any, SECRETO, texto(token), LID, puenteVacio(), (e, d) => eventos.push(`${e} ${JSON.stringify(d)}`));
    const todo = eventos.join('\n');
    expect(todo).toContain('LID_SIN_NUMERO');
    expect(todo).not.toContain(token);
    expect(todo).not.toContain(LID);
  });
});

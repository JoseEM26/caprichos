jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { registerAsync: () => ({ module: class {} }) } }));

import { WhatsAppEvolutionAdaptador } from '../adaptadores/whatsapp-evolution.adaptador';

const LID = '123456789012345';

/** Cliente Evolution falso: solo lo que usan resolverLid y confirmarLid. Nunca sale a la red. */
function apiFalsa(respuesta: { ok: boolean; status?: number; data?: any; red?: boolean }, configurado = true) {
  return {
    instancia: 'caprichos',
    configurado: () => configurado,
    llamar: jest.fn(async () => ({ status: 200, ...respuesta })),
  };
}
const adaptadorCon = (api: any) => new WhatsAppEvolutionAdaptador(api, {} as any, {} as any, {} as any);

describe('Evolution: resolver un LID (hipótesis de endpoints, ver comentarios del adaptador)', () => {
  it('resolverLid: toma el celular del par LID↔celular de findContacts y usa timeout corto', async () => {
    const api = apiFalsa({ ok: true, data: [{ id: `${LID}@lid`, remoteJid: `${LID}@lid`, remoteJidAlt: '51987654321@s.whatsapp.net' }] });
    expect(await adaptadorCon(api).resolverLid(LID)).toBe('51987654321');
    expect(api.llamar).toHaveBeenCalledWith('POST', '/chat/findContacts/caprichos', { where: { id: `${LID}@lid` } }, 5000);
  });

  it('resolverLid: sin par en la respuesta, error o sin configurar devuelve null', async () => {
    expect(await adaptadorCon(apiFalsa({ ok: true, data: [{ id: `${LID}@lid` }] })).resolverLid(LID)).toBeNull();
    expect(await adaptadorCon(apiFalsa({ ok: false, status: 0, red: true, data: null })).resolverLid(LID)).toBeNull();
    const sinConfig = apiFalsa({ ok: true, data: [] }, false);
    expect(await adaptadorCon(sinConfig).resolverLid(LID)).toBeNull();
    expect(sinConfig.llamar).not.toHaveBeenCalled();
  });

  it('confirmarLid: CONFIRMADO cuando la respuesta trae el mismo LID del remitente', async () => {
    const api = apiFalsa({ ok: true, data: [{ jid: '51987654321@s.whatsapp.net', exists: true, number: '51987654321', lid: `${LID}@lid` }] });
    expect(await adaptadorCon(api).confirmarLid('51987654321', LID)).toBe('CONFIRMADO');
    expect(api.llamar).toHaveBeenCalledWith('POST', '/chat/whatsappNumbers/caprichos', { numbers: ['51987654321'] }, 5000);
  });

  it('confirmarLid: OTRO cuando el número tiene otro LID', async () => {
    const api = apiFalsa({ ok: true, data: [{ jid: '51987654321@s.whatsapp.net', exists: true, lid: '999@lid' }] });
    expect(await adaptadorCon(api).confirmarLid('51987654321', LID)).toBe('OTRO');
  });

  it('confirmarLid: NO_RESUELTO si la respuesta no trae LID, falla o no está configurado (nunca confirma por defecto)', async () => {
    expect(await adaptadorCon(apiFalsa({ ok: true, data: [{ jid: '51987654321@s.whatsapp.net', exists: true }] })).confirmarLid('51987654321', LID)).toBe('NO_RESUELTO');
    expect(await adaptadorCon(apiFalsa({ ok: false, status: 0, red: true, data: null })).confirmarLid('51987654321', LID)).toBe('NO_RESUELTO');
    expect(await adaptadorCon(apiFalsa({ ok: true, data: [] }, false)).confirmarLid('51987654321', LID)).toBe('NO_RESUELTO');
  });
});

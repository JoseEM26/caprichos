jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { destinoEvolution, normalizarMensajeEvolution } from '../evolution/evolution-mensaje.util';
import { conGuardiaSalida } from '../proveedor/guardia-salida';
import { NumerosWhatsappService } from '../servicios/numeros-whatsapp.service';
import { WhatsAppEvolutionAdaptador } from '../adaptadores/whatsapp-evolution.adaptador';

// Forma real de Evolution 2.3.7 con WhatsApp en modo LID (dígitos inventados)
const LID = '123456789012345@lid';
const claveLid = (extra: Record<string, unknown> = {}) => ({
  remoteJid: LID, remoteJidAlt: undefined, fromMe: false, id: '3ACD0001', participant: '', participantAlt: undefined, addressingMode: 'lid', ...extra,
});
const dato = (key = claveLid()) => ({ key, pushName: 'Cliente Prueba', message: { conversation: 'Hola' }, messageType: 'conversation', source: 'ios' });

describe('Evolution con LID', () => {
  it('sin número: se procesa con el LID como remitente', () => {
    const r: any = normalizarMensajeEvolution(dato());
    expect(r.ok).toBe(true);
    expect(r.msg.from).toBe(LID);
    expect(r.contacto.wa_id).toBe(LID);
    expect(r.msg.text.body).toBe('Hola');
  });

  it('con remoteJidAlt / participantAlt trae el número y se prefiere', () => {
    expect((normalizarMensajeEvolution(dato(claveLid({ remoteJidAlt: '51900111222@s.whatsapp.net' }))) as any).msg.from).toBe('51900111222');
    expect((normalizarMensajeEvolution(dato(claveLid({ participantAlt: '51900111223@s.whatsapp.net' }))) as any).msg.from).toBe('51900111223');
  });

  it('destino: el LID va completo, el teléfono solo con dígitos', () => {
    expect(destinoEvolution(`wa-user:${LID}`)).toBe(LID);
    expect(destinoEvolution(LID)).toBe(LID);
    expect(destinoEvolution('+51 900 111 222')).toBe('51900111222');
  });

  it('el adaptador manda al @lid tal cual', async () => {
    const llamar = jest.fn(async (..._a: any[]) => ({ ok: true, status: 200, data: { key: { id: 'X' } } }));
    const api: any = { configurado: () => true, instancia: 'i', llamar };
    const config: any = {
      estaPausado: async () => false,
      obtener: async () => ({ evolution_pausa_min_seg: 0, evolution_pausa_max_seg: 0, evolution_max_enlaces: 9, evolution_max_texto_identico: 9, evolution_escribiendo_ms_por_caracter: 0 }),
      registrarResultadoEnvio: async () => undefined,
    };
    const a = new WhatsAppEvolutionAdaptador(api, config, { borrar: async () => undefined } as any, { whatsappMensaje: { create: async () => ({}) } } as any);
    const r = await a.enviarTexto(`wa-user:${LID}`, 'Hola');
    expect(r.exito).toBe(true);
    expect(llamar.mock.calls[0][2].number).toBe(LID);
  });
});

describe('lista blanca con LID', () => {
  const previo = { ...process.env };
  afterEach(() => {
    process.env = { ...previo };
  });
  const montar = () => {
    const prisma: any = { parametro: { findUnique: jest.fn(async () => null) }, numeroBloqueado: { findMany: jest.fn(async () => []) } };
    const base: any = { enviarTexto: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })) };
    return { base, puerto: conGuardiaSalida(base, new NumerosWhatsappService(prisma, { registrar: jest.fn() } as any)) };
  };

  it('LID sin número y sin permiso: se omite; con permiso: sale', async () => {
    process.env.WHATSAPP_SOLO_NUMEROS = '51900111222';
    delete process.env.WHATSAPP_PERMITIR_LID_SIN_NUMERO;
    const a = montar();
    expect((await a.puerto.enviarTexto(`wa-user:${LID}`, 'x')).estado).toBe('OMITIDO');
    process.env.WHATSAPP_PERMITIR_LID_SIN_NUMERO = 'si';
    const b = montar();
    expect((await b.puerto.enviarTexto(`wa-user:${LID}`, 'x')).estado).toBe('ENVIADO');
  });

  it('con número resuelto se valida con el número, aunque el permiso esté activo', async () => {
    process.env.WHATSAPP_SOLO_NUMEROS = '51900111222';
    process.env.WHATSAPP_PERMITIR_LID_SIN_NUMERO = 'si';
    const { puerto } = montar();
    expect((await puerto.enviarTexto('51900111222', 'x')).estado).toBe('ENVIADO');
    expect((await puerto.enviarTexto('51977000111', 'x')).estado).toBe('OMITIDO');
  });
});

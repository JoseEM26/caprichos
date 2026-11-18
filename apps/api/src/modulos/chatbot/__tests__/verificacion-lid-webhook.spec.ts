jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { registerAsync: () => ({ module: class {} }) } }));

import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import { WhatsAppEvolutionAdaptador } from '../adaptadores/whatsapp-evolution.adaptador';
import {
  RESPUESTA_NO_VERIFICADO,
  RESPUESTA_SIN_NUMERO,
  RESPUESTA_VERIFICADO,
  claveMarcaVerificacion,
  estadoVerificacion,
  iniciarVerificacion,
  secretoVerificacion,
} from '../../clientes/verificacion-whatsapp.util';

const TEL9 = '987654321';
const TEL = `51${TEL9}`;
const LID = '123456789012345';
const IDENTIFICADOR = `wa-user:${LID}@lid`;

function redisFalso() {
  const datos = new Map<string, string>();
  const contadores = new Map<string, number>();
  return {
    datos,
    obtenerCliente() {
      return this;
    },
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
    exists: jest.fn(async () => 0),
    eval: jest.fn(async () => 1),
  };
}

const mensajeLid = (id: string, body: string) => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ value: { contacts: [{ wa_id: `${LID}@lid`, profile: { name: 'Ana' } }], messages: [{ id, from: `${LID}@lid`, type: 'text', text: { body } }] } }] }],
});

describe('Verificación con LID en el webhook: resolución del celular', () => {
  let webhook: WhatsappWebhookService;
  let redis: ReturnType<typeof redisFalso>;
  let mensajeria: { enviarTexto: jest.Mock };
  let motor: { procesarMensajeEntrante: jest.Mock };
  let adaptador: { resolverLid: jest.Mock; confirmarLid: jest.Mock };
  let config: ConfigService;
  let token: string;

  beforeEach(async () => {
    redis = redisFalso();
    mensajeria = { enviarTexto: jest.fn().mockResolvedValue(undefined) };
    motor = { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) };
    adaptador = { resolverLid: jest.fn().mockResolvedValue(null), confirmarLid: jest.fn().mockResolvedValue('NO_RESUELTO') };
    config = { get: (_k: string, d?: any) => d } as unknown as ConfigService;
    const conv = { id: 42n, telefono: TEL, duenio: 'BOT', estado: 'ABIERTA', tomado_por: null, flujo: {}, nombre_contacto: 'Ana', nombre_editado: false, identificador_tipo: 'TELEFONO' };
    const prisma: any = {
      whatsappMensaje: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      encuestaPosventa: { findFirst: jest.fn().mockResolvedValue(null) },
      clienteWhatsappConsentimiento: { findUnique: jest.fn(), upsert: jest.fn() },
      pedido: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null) },
      conversacion: { findUnique: jest.fn(async () => conv), create: jest.fn(), update: jest.fn(async ({ data }: any) => ({ ...conv, ...data })) },
      mensajeChat: { create: jest.fn(async () => ({ id: 9n })), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      salienteWhatsapp: { findFirst: jest.fn().mockResolvedValue(null) },
      notificacion: { create: jest.fn() },
    };
    const u = undefined;
    webhook = new WhatsappWebhookService(
      config,
      prisma,
      mensajeria as any,
      { subirArchivo: jest.fn() } as any,
      { emitirAdmin: jest.fn() } as any,
      motor as any,
      u,
      u,
      u,
      u,
      redis as any,
      u,
      u,
      u,
      u,
      u,
      adaptador as unknown as WhatsAppEvolutionAdaptador,
    );
    token = await iniciarVerificacion(redis as any, secretoVerificacion(config), TEL9, 'REGISTRO');
  });

  it('el par ya aprendido (Redis) verifica sin consultar a Evolution', async () => {
    redis.datos.set(`cliente:wa:lid:${LID}`, TEL9);
    await webhook.procesarPayload(mensajeLid('wamid.L1', `Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`));
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(IDENTIFICADOR, RESPUESTA_VERIFICADO);
    expect(adaptador.resolverLid).not.toHaveBeenCalled();
    expect(redis.datos.get(claveMarcaVerificacion('REGISTRO', TEL9))).toBe('1');
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
  });

  it('Evolution asocia el LID al celular del token: verifica y guarda el par en Redis', async () => {
    adaptador.resolverLid.mockResolvedValue(TEL);
    await webhook.procesarPayload(mensajeLid('wamid.L2', `Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`));
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(IDENTIFICADOR, RESPUESTA_VERIFICADO);
    expect(redis.datos.get(`cliente:wa:lid:${LID}`)).toBe(TEL9);
    expect(redis.datos.get(claveMarcaVerificacion('REGISTRO', TEL9))).toBe('1');
  });

  it('Evolution asocia el LID a otro celular: no verifica, no marca y responde RESPUESTA_NO_VERIFICADO', async () => {
    adaptador.resolverLid.mockResolvedValue('51912345678');
    await webhook.procesarPayload(mensajeLid('wamid.L3', `Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`));
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(IDENTIFICADOR, RESPUESTA_NO_VERIFICADO);
    expect(redis.datos.get(claveMarcaVerificacion('REGISTRO', TEL9))).toBeUndefined();
    expect(await estadoVerificacion(redis as any, secretoVerificacion(config), token)).toBe('pendiente');
  });

  it('Evolution confirma la propiedad del número del token: verifica', async () => {
    adaptador.confirmarLid.mockResolvedValue('CONFIRMADO');
    await webhook.procesarPayload(mensajeLid('wamid.L4', `Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`));
    expect(adaptador.confirmarLid).toHaveBeenCalledWith(TEL, LID);
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(IDENTIFICADOR, RESPUESTA_VERIFICADO);
  });

  it('Evolution no puede confirmar: el token pasa a sin_numero, responde el texto del código y el sondeo lo ve', async () => {
    await webhook.procesarPayload(mensajeLid('wamid.L5', `Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`));
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(IDENTIFICADOR, RESPUESTA_SIN_NUMERO);
    expect(redis.datos.get(claveMarcaVerificacion('REGISTRO', TEL9))).toBeUndefined();
    expect(await estadoVerificacion(redis as any, secretoVerificacion(config), token)).toBe('sin_numero');
  });

  it('Evolution falla (lanza): el mismo desenlace de sin_numero, sin romper el webhook', async () => {
    adaptador.resolverLid.mockRejectedValue(new Error('timeout'));
    adaptador.confirmarLid.mockRejectedValue(new Error('timeout'));
    await webhook.procesarPayload(mensajeLid('wamid.L6', `Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`));
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(IDENTIFICADOR, RESPUESTA_SIN_NUMERO);
    expect(await estadoVerificacion(redis as any, secretoVerificacion(config), token)).toBe('sin_numero');
  });

  it('un LID con token inexistente no consulta a Evolution y responde RESPUESTA_NO_VERIFICADO', async () => {
    await webhook.procesarPayload(mensajeLid('wamid.L7', 'Hola Caprichos, quiero verificar mi celular. Mi código: ZZZZZZZZ'));
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(IDENTIFICADOR, RESPUESTA_NO_VERIFICADO);
    expect(adaptador.resolverLid).not.toHaveBeenCalled();
  });

  it('con número visible el camino no cambia: no consulta a Evolution y verifica igual', async () => {
    await webhook.procesarPayload({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { contacts: [{ wa_id: TEL }], messages: [{ id: 'wamid.L8', from: TEL, type: 'text', text: { body: `Mi código: ${token}` } }] } }] }],
    });
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith(TEL, RESPUESTA_VERIFICADO);
    expect(adaptador.resolverLid).not.toHaveBeenCalled();
    expect(adaptador.confirmarLid).not.toHaveBeenCalled();
  });
});

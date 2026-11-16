jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { registerAsync: () => ({ module: class {} }) } }));
jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { WhatsAppEnrutadorAdaptador } from '../adaptadores/whatsapp-enrutador.adaptador';
import { WhatsAppEvolutionAdaptador } from '../adaptadores/whatsapp-evolution.adaptador';
import { WhatsAppMetaAdaptador } from '../adaptadores/whatsapp-meta.adaptador';
import { CATALOGO_PLANTILLAS } from '../catalogo/plantillas.catalogo';
import { textoDePlantilla } from '../catalogo/texto-plantilla';
import { esAgradecimiento, esSaludo } from '../conversacion/cortesia-entrante.util';
import { EvolutionConfigService } from '../evolution/evolution-config.service';
import { aRespuestaDeMenu, normalizarMensajeEvolution } from '../evolution/evolution-mensaje.util';
import { MenuNumeradoStore } from '../evolution/menu-numerado.store';
import { conGuardiaSalida } from '../proveedor/guardia-salida';
import { AutorespuestaWhatsappService, HORAS_ENTRE_AUTORESPUESTAS } from '../servicios/autorespuesta-whatsapp.service';
import { NumerosWhatsappService } from '../servicios/numeros-whatsapp.service';
import { Ventana24hService } from '../servicios/ventana-24h.service';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import { iniciarVerificacion, RESPUESTA_VERIFICADO, secretoVerificacion } from '../../clientes/verificacion-whatsapp.util';

const MIGRACIONES = join(__dirname, '../../../../prisma/migrations');
const migracion = () => readFileSync(join(MIGRACIONES, readdirSync(MIGRACIONES).find((d) => d.endsWith('_evolution_decisiones'))!, 'migration.sql'), 'utf8');

/** prisma falso con parametro en memoria. */
function prismaFalso(params: Record<string, unknown> = {}) {
  const guardados: Record<string, unknown> = { ...params };
  return {
    guardados,
    parametro: {
      findMany: jest.fn(async ({ where }: any) => Object.entries(guardados).filter(([k]) => where.clave.in.includes(k)).map(([clave, valor]) => ({ clave, valor }))),
      findUnique: jest.fn(async ({ where }: any) => (where.clave in guardados ? { clave: where.clave, valor: guardados[where.clave] } : null)),
      upsert: jest.fn(async ({ where, create }: any) => { guardados[where.clave] = create.valor; }),
    },
    notificacion: { create: jest.fn(async () => ({ id: 1n })) },
    whatsappMensaje: { create: jest.fn(async () => ({})) },
  } as any;
}

describe('decisión 1 y 3: migración de parámetros', () => {
  it('la encuesta pasa a 15 minutos y los topes a 350 por día y 60 por hora', () => {
    const sql = migracion();
    expect(sql).toMatch(/'encuesta_espera_min', '15'::jsonb/);
    expect(sql).toMatch(/'evolution_limite_dia', '350'::jsonb/);
    expect(sql).toMatch(/'evolution_limite_hora', '60'::jsonb/);
    expect(sql).not.toMatch(/evolution_limite_minuto/); // se mantiene en 3
    expect(sql).toMatch(/ON CONFLICT \("clave"\) DO UPDATE/);
  });
  it('la migración es posterior a la última que ya existía', () => {
    const todas = readdirSync(MIGRACIONES).filter((d) => /^\d{14}_/.test(d)).sort();
    expect(todas[todas.length - 1].endsWith('_evolution_decisiones') || todas[todas.length - 1] > '20270309200000').toBe(true);
    expect('20270315100000_evolution_decisiones' > '20270309200000_pagos_online').toBe(true);
  });
  it('los valores por defecto del código coinciden con la migración', async () => {
    const c = await new EvolutionConfigService(prismaFalso()).obtener();
    expect([c.evolution_limite_minuto, c.evolution_limite_hora, c.evolution_limite_dia]).toEqual([3, 60, 350]);
    expect([c.evolution_fallos_seguidos, c.evolution_fallos_ventana_min]).toEqual([5, 10]);
  });
});

describe('decisión 4: el texto de cada plantilla, centralizado', () => {
  it.each(Object.entries(CATALOGO_PLANTILLAS))('%s: devuelve su texto con todas las variables puestas', (clave, def) => {
    const valores = def.variables.map((_v, i) => `VALOR${i + 1}`);
    const porOrden = textoDePlantilla(clave, valores)!;
    const porNombre = textoDePlantilla(def.nombre, Object.fromEntries(def.variables.map((v, i) => [v, valores[i]])))!;
    expect(porOrden).toBe(porNombre);
    expect(porOrden).not.toMatch(/\{\{\d+\}\}/);
    for (const v of valores) expect(porOrden).toContain(v);
    expect(porOrden.replace(/VALOR\d+/g, '').length).toBeGreaterThan(5);
  });
  it('una plantilla desconocida devuelve null', () => {
    expect(textoDePlantilla('NO_EXISTE')).toBeNull();
  });
  it('el adaptador de Evolution usa esa misma función para sus plantillas', async () => {
    const prisma = prismaFalso({ evolution_pausa_min_seg: 0, evolution_pausa_max_seg: 0 });
    const api: any = { configurado: () => true, instancia: 'prueba', llamar: jest.fn(async () => ({ ok: true, status: 201, data: { key: { id: 'WA1' } } })) };
    const ad = new WhatsAppEvolutionAdaptador(api, new EvolutionConfigService(prisma), new MenuNumeradoStore(), prisma);
    await ad.enviarPlantilla('51900000001', 'caprichos_delivery_aceptado', 'es', ['Ana', 'CP-1']);
    expect(api.llamar.mock.calls[0][2].text).toBe(textoDePlantilla('DELIVERY_ACEPTADO', ['Ana', 'CP-1']));
  });
});

describe('decisión 4: la ventana de 24 h rige igual con Evolution que con Meta', () => {
  const montar = (entrante: boolean) => {
    const prisma: any = {
      whatsappMensaje: { findFirst: jest.fn(async () => (entrante ? { id: 1n, creado_en: new Date() } : null)) },
      clienteWhatsappConsentimiento: { findUnique: jest.fn(async () => null) },
      mensajeChat: { findFirst: jest.fn(async () => null) },
      notificacion: { create: jest.fn() },
    };
    const mensajeria: any = {
      enviarTexto: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })),
      enviarPlantilla: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })),
    };
    return { mensajeria, ventana: new Ventana24hService(prisma, mensajeria) };
  };
  it('fuera de las 24 h, lo que iría por plantilla sale como plantilla (con Evolution, su texto)', async () => {
    const { ventana, mensajeria } = montar(false);
    await ventana.enviarMensajeNegocio('51900000001', { textoLibre: 'libre', plantillaClave: 'DELIVERY_SALIDA', variablesPlantilla: ['Ana', 'CP-1', '25'] });
    expect(mensajeria.enviarTexto).not.toHaveBeenCalled();
    expect(mensajeria.enviarPlantilla).toHaveBeenCalledWith('51900000001', 'caprichos_delivery_en_camino', 'es', ['Ana', 'CP-1', '25'], undefined);
  });
  it('fuera de las 24 h y sin plantilla: no se escribe (descartado como con Meta)', async () => {
    const { ventana, mensajeria } = montar(false);
    const r = await ventana.enviarMensajeNegocio('51900000001', { textoLibre: 'libre' });
    expect(r).toMatchObject({ exito: false, estado: 'OMITIDO', errorCodigo: 'PLANTILLA_NO_CONFIGURADA' });
    expect(mensajeria.enviarTexto).not.toHaveBeenCalled();
  });
  it('dentro de las 24 h sale el texto libre', async () => {
    const { ventana, mensajeria } = montar(true);
    await ventana.enviarMensajeNegocio('51900000001', { textoLibre: 'libre', plantillaClave: 'DELIVERY_SALIDA', variablesPlantilla: ['Ana', 'CP-1', '25'] });
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith('51900000001', 'libre', undefined);
  });
});

describe('decisión 6: reacciones', () => {
  const montarEvo = (configurado = true, params: Record<string, unknown> = {}) => {
    const prisma = prismaFalso(params);
    const api: any = { configurado: () => configurado, instancia: 'prueba', llamar: jest.fn(async () => ({ ok: true, status: 201, data: { key: { id: 'R1' } } })) };
    return { api, ad: new WhatsAppEvolutionAdaptador(api, new EvolutionConfigService(prisma), new MenuNumeradoStore(), prisma) };
  };
  it('Evolution v2: POST /message/sendReaction con la llave del mensaje del cliente y el emoji', async () => {
    const { ad, api } = montarEvo();
    expect(await ad.reaccionar('51900000001', 'MSG1', '✅')).toMatchObject({ exito: true, estado: 'ENVIADO' });
    expect(api.llamar).toHaveBeenCalledWith('POST', '/message/sendReaction/prueba', { key: { remoteJid: '51900000001@s.whatsapp.net', fromMe: false, id: 'MSG1' }, reaction: '✅' });
  });
  it('sin credenciales: simulado, y en pausa no reacciona', async () => {
    expect((await montarEvo(false).ad.reaccionar('51900000001', 'MSG1', '✅')).estado).toBe('SIMULADO');
    const pausado = montarEvo(true, { evolution_pausado: 'si' });
    expect(await pausado.ad.reaccionar('51900000001', 'MSG1', '✅')).toMatchObject({ exito: false, errorCodigo: 'EVOLUTION_PAUSADO' });
    expect(pausado.api.llamar).not.toHaveBeenCalled();
  });
  it('Meta: type reaction de la Cloud API con el message_id del cliente', async () => {
    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: jest.fn().mockResolvedValue(JSON.stringify({ messages: [{ id: 'wamid.R' }] })) } as any);
    try {
      const config: any = { get: (k: string, d?: any) => ({ WHATSAPP_TOKEN: 'tok', WHATSAPP_PHONE_ID: '123', WHATSAPP_API_VERSION: 'v20.0', WHATSAPP_TIMEOUT_MS: 1000 } as any)[k] ?? d };
      const meta = new WhatsAppMetaAdaptador(config, { whatsappMensaje: {}, conversacion: { findFirst: jest.fn(async () => null) } } as any);
      expect(await meta.reaccionar('51900000001', 'wamid.CLIENTE', '❤️')).toMatchObject({ exito: true, estado: 'ENVIADO' });
      const cuerpo = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(cuerpo).toMatchObject({ messaging_product: 'whatsapp', type: 'reaction', reaction: { message_id: 'wamid.CLIENTE', emoji: '❤️' } });
    } finally {
      global.fetch = original;
    }
  });
  it('el enrutador manda la reacción al proveedor activo', async () => {
    const prisma = prismaFalso({ whatsapp_proveedor: 'EVOLUTION' });
    const base: any = { reaccionar: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })) };
    const evo: any = { reaccionar: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })) };
    await new WhatsAppEnrutadorAdaptador(base, evo, new EvolutionConfigService(prisma)).reaccionar('51900000001', 'M', '✅');
    expect([base.reaccionar.mock.calls.length, evo.reaccionar.mock.calls.length]).toEqual([0, 1]);
  });
  it('la lista blanca WHATSAPP_SOLO_NUMEROS también corta las reacciones', async () => {
    const previo = process.env.WHATSAPP_SOLO_NUMEROS;
    process.env.WHATSAPP_SOLO_NUMEROS = '51987654321';
    try {
      const prisma: any = { parametro: { findUnique: jest.fn(async () => null) }, numeroBloqueado: { findMany: jest.fn(async () => []) } };
      const base: any = { reaccionar: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })) };
      const puerto = conGuardiaSalida(base, new NumerosWhatsappService(prisma, { registrar: jest.fn() } as any));
      expect((await puerto.reaccionar!('51987654321', 'M', '✅')).estado).toBe('ENVIADO');
      expect(await puerto.reaccionar!('51911222333', 'M', '✅')).toMatchObject({ estado: 'OMITIDO', errorCodigo: 'DESTINO_FUERA_DE_LISTA_BLANCA' });
      expect(base.reaccionar).toHaveBeenCalledTimes(1);
    } finally {
      if (previo === undefined) delete process.env.WHATSAPP_SOLO_NUMEROS;
      else process.env.WHATSAPP_SOLO_NUMEROS = previo;
    }
  });
  it('reconoce «gracias», «ok», «listo» y 👍 solo cuando es todo el mensaje', () => {
    for (const t of ['gracias', 'Muchas gracias!', 'ok', 'Listo', 'ok gracias', '👍', '🙏', 'Perfecto']) expect(esAgradecimiento(t)).toBe(true);
    for (const t of ['gracias, y a qué hora llega', 'ok pero quiero cambiar mi pedido', 'hola', '', 'listo para pedir una torta']) expect(esAgradecimiento(t)).toBe(false);
  });
});

describe('decisiones 5 y 7: fuera de horario y bienvenida con carta (sin bot)', () => {
  const montar = (o: { botActivo?: boolean; abierto?: boolean; pedidoActivo?: boolean; pedidoHoy?: boolean; previa?: boolean; carta?: string | null; reaccion?: boolean; proveedor?: string } = {}) => {
    const prisma: any = {
      parametro: { findMany: jest.fn(async () => [{ clave: 'whatsapp_proveedor', valor: o.proveedor ?? 'EVOLUTION' }]), findUnique: jest.fn(async ({ where }: any) => (where.clave === 'chatbot_activo' ? { valor: o.botActivo ? 'si' : 'no' } : null)) },
      pedido: { count: jest.fn(async ({ where }: any) => ((where.estado ? o.pedidoActivo : o.pedidoHoy) ? 1 : 0)) },
      salienteWhatsapp: { findFirst: jest.fn(async () => (o.previa ? { id: 1n } : null)) },
      horarioDia: { findUnique: jest.fn(async () => ({ cerrado: false, abre: '09:00' })) },
    };
    const outbox: any = { encolar: jest.fn(async () => true), despertar: jest.fn() };
    const mensajeria: any = { reaccionar: jest.fn(async () => ({ exito: o.reaccion !== false, estado: 'ENVIADO' })) };
    const config: any = { get: (k: string) => (k === 'CARTA_URL_PUBLICA' ? (o.carta === undefined ? 'https://carta.caprichos.pe' : (o.carta ?? '')) : undefined) };
    const local: any = { obtenerEstadoCarta: jest.fn(async () => (o.abierto === false ? { abierta: false, motivo: 'HORARIO', abre: '23:59' } : { abierta: true, motivo: 'OK', abre: '09:00' })) };
    const svc = new AutorespuestaWhatsappService(prisma, outbox, mensajeria, config, new EvolutionConfigService(prisma), local);
    return { svc, outbox, mensajeria, prisma };
  };
  const entrada = (texto: string, extra: any = {}) => ({
    telefono: '51900000001', nombre: 'Ana', texto, waMessageId: 'MSG1', puedeProcesarMotor: false,
    conversacion: { id: 1n, flujo: { estado: 'MENU' }, estado: 'ABIERTA', duenio: 'PERSONA', tomado_por: null, ...extra },
  });

  it('fuera de horario, con el bot apagado: responde una vez, corto y cariñoso, con la hora real de apertura y la carta (sin menú)', async () => {
    const { svc, outbox } = montar({ abierto: false });
    expect(await svc.atender(entrada('quiero una torta'))).toBe(true);
    const arg = outbox.encolar.mock.calls[0][0];
    expect(arg).toMatchObject({ origen: 'AUTORESPUESTA', tipo: 'TEXTO', telefono: '51900000001' });
    expect(arg.carga.textoLibre).toContain('Ana');
    expect(arg.carga.textoLibre).toContain('Ahora estamos cerrados.');
    expect(arg.carga.textoLibre).toMatch(/Abrimos (hoy|mañana) a las \d{1,2}:\d\d\./);
    expect(arg.carga.textoLibre).toContain('No tomamos pedidos fuera de horario');
    expect(arg.carga.textoLibre).not.toMatch(/Responde|1\. /);
    expect(outbox.despertar).toHaveBeenCalled();
  });
  it('fuera de horario: máximo una vez cada 6 horas por cliente', async () => {
    const { svc, outbox } = montar({ abierto: false, previa: true });
    expect(await svc.atender(entrada('hola'))).toBe(true);
    expect(outbox.encolar).not.toHaveBeenCalled();
    expect(HORAS_ENTRE_AUTORESPUESTAS).toBe(6);
  });
  it('cerrado y con el bot activo: el bot NO conversa, responde el aviso corto una vez', async () => {
    const { svc, outbox } = montar({ abierto: false, botActivo: true });
    expect(await svc.atender({ ...entrada('hola'), puedeProcesarMotor: true })).toBe(true);
    expect(outbox.encolar).toHaveBeenCalledTimes(1);
  });
  it('cerrado pero con un pedido en curso: el bot sigue atendiendo', async () => {
    const { svc, outbox } = montar({ abierto: false, botActivo: true, pedidoActivo: true });
    expect(await svc.atender({ ...entrada('dónde está mi pedido'), puedeProcesarMotor: true })).toBe(false);
    expect(outbox.encolar).not.toHaveBeenCalled();
  });
  it('abierto y con el bot activo no se mete: él ya saluda', async () => {
    const { svc, outbox } = montar({ botActivo: true });
    expect(await svc.atender({ ...entrada('hola'), puedeProcesarMotor: true })).toBe(false);
    expect(outbox.encolar).not.toHaveBeenCalled();
  });
  it('sin nombre real (genérico de WhatsApp) saluda sin nombre', async () => {
    const { svc, outbox } = montar({ abierto: false });
    await svc.atender({ ...entrada('hola'), nombre: 'Usuario de WhatsApp (JoseEM)' });
    expect(outbox.encolar.mock.calls[0][0].carga.textoLibre).toMatch(/^¡Hola! /);
  });
  it('no responde si una persona ya tomó el chat', async () => {
    const { svc, outbox } = montar({ abierto: false });
    expect(await svc.atender(entrada('hola', { tomado_por: 5n }))).toBe(false);
    expect(outbox.encolar).not.toHaveBeenCalled();
  });
  it('saludo sin pedido activo y con el bot apagado: bienvenida con el enlace a la carta', async () => {
    const { svc, outbox } = montar();
    expect(await svc.atender(entrada('Hola buenas'))).toBe(true);
    const texto = outbox.encolar.mock.calls[0][0].carga.textoLibre;
    expect(texto).toContain('https://carta.caprichos.pe');
    expect(texto).toContain('Ana');
  });
  it('saludo con un pedido activo: no se manda la bienvenida', async () => {
    const { svc, outbox } = montar({ pedidoActivo: true });
    expect(await svc.atender(entrada('hola'))).toBe(false);
    expect(outbox.encolar).not.toHaveBeenCalled();
  });
  it('saludo sin enlace público de la carta o un texto que no es saludo: no se inventa nada', async () => {
    const sinCarta = montar({ carta: null });
    expect(await sinCarta.svc.atender(entrada('hola'))).toBe(false);
    const otro = montar();
    expect(await otro.svc.atender(entrada('a qué hora llega mi pedido'))).toBe(false);
    expect(otro.outbox.encolar).not.toHaveBeenCalled();
  });
  it('un saludo y un «hola» dentro de las 12 h no repiten la bienvenida', async () => {
    const { svc, outbox } = montar({ previa: true });
    await svc.atender(entrada('hola'));
    expect(outbox.encolar).not.toHaveBeenCalled();
  });
  it('un «gracias» con pedido de hoy se contesta con ❤️ en vez de texto; sin pedido no', async () => {
    const con = montar({ pedidoHoy: true });
    expect(await con.svc.atender(entrada('gracias'))).toBe(true);
    expect(con.mensajeria.reaccionar).toHaveBeenCalledWith('51900000001', 'MSG1', '❤️');
    expect(con.outbox.encolar).not.toHaveBeenCalled();
    const sin = montar();
    expect(await sin.svc.atender(entrada('gracias'))).toBe(false);
    expect(sin.mensajeria.reaccionar).not.toHaveBeenCalled();
  });
  it('si la reacción falla, el mensaje sigue su camino normal (el bot contesta)', async () => {
    const { svc } = montar({ pedidoHoy: true, reaccion: false });
    expect(await svc.atender(entrada('gracias'))).toBe(false);
  });
  it('un «ok» en mitad de una pregunta del bot no se toma como agradecimiento', async () => {
    const { svc, mensajeria } = montar({ pedidoHoy: true, botActivo: true });
    const r = await svc.atender({ ...entrada('ok'), puedeProcesarMotor: true, conversacion: { ...entrada('ok').conversacion, duenio: 'BOT', flujo: { estado: 'PEDIDO_CONFIRMAR' } } });
    expect(r).toBe(false);
    expect(mensajeria.reaccionar).not.toHaveBeenCalled();
  });
  it('✅ para el voucher recibido', async () => {
    const { svc, mensajeria } = montar();
    expect(await svc.reaccionarAVoucher('51900000001', 'MSGV')).toBe(true);
    expect(mensajeria.reaccionar).toHaveBeenCalledWith('51900000001', 'MSGV', '✅');
    expect(await svc.reaccionarAVoucher('51900000001', null)).toBe(false);
  });
  it('con Meta activo y abierto todo sigue como hoy: sin reacciones ni bienvenida con carta', async () => {
    const m = montar({ proveedor: 'META', pedidoHoy: true });
    expect(await m.svc.atender(entrada('quiero una torta'))).toBe(false);
    expect(await m.svc.atender(entrada('hola'))).toBe(false);
    expect(await m.svc.atender(entrada('gracias'))).toBe(false);
    expect(await m.svc.reaccionarAVoucher('51900000001', 'MSGV')).toBe(false); // el acuse sale en texto
    expect(m.outbox.encolar).not.toHaveBeenCalled();
    expect(m.mensajeria.reaccionar).not.toHaveBeenCalled();
  });
  it('reconoce los saludos que ya reconoce el bot', () => {
    for (const t of ['hola', 'Buenas tardes', 'buen día', 'Holaa']) expect(esSaludo(t)).toBe(true);
    expect(esSaludo('hola quiero una torta')).toBe(false);
  });
});

describe('decisión 8: pausa automática por bloqueo o desconexión', () => {
  const montar = (params: Record<string, unknown> = {}, meta = true) => {
    const prisma = prismaFalso({ whatsapp_proveedor: 'EVOLUTION', ...params });
    const auditoria = { registrar: jest.fn() } as any;
    const config: any = { get: (k: string) => (meta && (k === 'WHATSAPP_TOKEN' || k === 'WHATSAPP_PHONE_ID') ? 'x' : undefined) };
    const avisos = { enviarAvisoAdmin: jest.fn(async (..._a: any[]) => ({})) };
    const moduleRef: any = { get: jest.fn(() => avisos) };
    const svc = new EvolutionConfigService(prisma, undefined, auditoria, config, moduleRef);
    return { svc, prisma, auditoria, avisos };
  };

  it('5 fallos seguidos pausan Evolution (el proveedor sigue Evolution), se auditan y avisan al ADMIN', async () => {
    const { svc, prisma, auditoria, avisos } = montar();
    for (let i = 0; i < 4; i++) await svc.registrarResultadoEnvio(false, 'HTTP 500');
    expect(await svc.estaPausado()).toBe(false);
    await svc.registrarResultadoEnvio(false, 'HTTP 500');
    expect(await svc.estaPausado()).toBe(true);
    expect(await svc.proveedor()).toBe('EVOLUTION');
    expect(prisma.guardados.whatsapp_proveedor).toBe('EVOLUTION');
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ modulo: 'whatsapp_proveedor', accion: 'pausa_automatica', despues: expect.objectContaining({ whatsapp_proveedor: 'EVOLUTION', evolution_pausado: 'si', motivo: 'FALLOS' }) }));
    expect(avisos.enviarAvisoAdmin).toHaveBeenCalledTimes(1);
    expect(avisos.enviarAvisoAdmin.mock.calls[0][2]).toBe('/admin/configuracion');
  });
  it('un envío exitoso borra la racha', async () => {
    const { svc } = montar();
    for (let i = 0; i < 4; i++) await svc.registrarResultadoEnvio(false, 'HTTP 500');
    await svc.registrarResultadoEnvio(true);
    await svc.registrarResultadoEnvio(false, 'HTTP 500');
    expect(await svc.estaPausado()).toBe(false);
  });
  it('los fallos fuera de la ventana de 10 minutos no cuentan', async () => {
    jest.useFakeTimers();
    try {
      const { svc } = montar();
      for (let i = 0; i < 4; i++) await svc.registrarResultadoEnvio(false, 'x');
      jest.setSystemTime(Date.now() + 11 * 60_000);
      await svc.registrarResultadoEnvio(false, 'x');
      expect(await svc.estaPausado()).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
  it('la cantidad de fallos sale del parámetro; 0 lo desactiva', async () => {
    const dos = montar({ evolution_fallos_seguidos: 2 });
    await dos.svc.registrarResultadoEnvio(false, 'x');
    await dos.svc.registrarResultadoEnvio(false, 'x');
    expect(await dos.svc.estaPausado()).toBe(true);
    const cero = montar({ evolution_fallos_seguidos: 0 });
    for (let i = 0; i < 20; i++) await cero.svc.registrarResultadoEnvio(false, 'x');
    expect(await cero.svc.estaPausado()).toBe(false);
  });
  it('la desconexión de la instancia también pausa sin cambiar de proveedor (un cierre 515 de reinicio no)', async () => {
    const { svc } = montar();
    await svc.registrarConexion('open');
    await svc.registrarConexion('close', 515);
    expect(await svc.estaPausado()).toBe(false);
    await svc.registrarConexion('open');
    await svc.registrarConexion('close', 428);
    expect(await svc.estaPausado()).toBe(true);
    expect(await svc.proveedor()).toBe('EVOLUTION');
  });
  it('con o sin credenciales de Meta nunca cambia de proveedor y el aviso dice que esperan en la cola', async () => {
    for (const meta of [true, false]) {
      const { svc, avisos } = montar({}, meta);
      await svc.registrarConexion('open');
      await svc.registrarConexion('close', 428);
      expect(await svc.proveedor()).toBe('EVOLUTION');
      expect(avisos.enviarAvisoAdmin.mock.calls[0][1]).toContain('esperan en la cola');
      expect(avisos.enviarAvisoAdmin.mock.calls[0][1]).not.toContain('Meta');
    }
  });
  it('al reconectar (open) se reanuda solo la pausa automática; la manual y el baneo no', async () => {
    const auto = montar();
    await auto.svc.registrarConexion('open');
    await auto.svc.registrarConexion('close', 428);
    expect(await auto.svc.estaPausado()).toBe(true);
    await auto.svc.registrarConexion('open');
    expect(await auto.svc.estaPausado()).toBe(false);
    expect(await auto.svc.proveedor()).toBe('EVOLUTION');

    const manual = montar();
    await manual.svc.fijarPausa(true);
    await manual.svc.registrarConexion('open');
    expect(await manual.svc.estaPausado()).toBe(true);

    const baneo = montar();
    await baneo.svc.registrarConexion('open');
    await baneo.svc.registrarConexion('close', 401);
    await baneo.svc.registrarConexion('open');
    expect(await baneo.svc.estaPausado()).toBe(true);
  });
  it('si ya estaba pausado no repite la pausa ni el aviso', async () => {
    const { svc, avisos } = montar({ evolution_pausado: 'si' });
    await svc.pausarAutomatico('FALLOS', 'x');
    expect(avisos.enviarAvisoAdmin).not.toHaveBeenCalled();
  });
  it('si el servicio de avisos internos no está, igual llega a la campana del ADMIN', async () => {
    const prisma = prismaFalso({ whatsapp_proveedor: 'EVOLUTION' });
    const moduleRef: any = { get: jest.fn(() => { throw new Error('no existe'); }) };
    const svc = new EvolutionConfigService(prisma, undefined, undefined, { get: () => 'x' } as any, moduleRef);
    await svc.pausarAutomatico('BANEO', 'cuenta bloqueada');
    expect(prisma.notificacion.create.mock.calls[0][0].data).toMatchObject({ rol_destino: 'ADMIN', enlace: '/admin/configuracion' });
  });
  it('un ADMIN lo devuelve a Evolution a mano: reanudar y conmutar', async () => {
    const { svc } = montar();
    await svc.pausarAutomatico('FALLOS', 'x');
    await svc.fijarPausa(false, { partyId: 1n });
    await svc.conmutarProveedor('EVOLUTION', { partyId: 1n });
    expect(await svc.estaPausado()).toBe(false);
    expect(await svc.proveedor()).toBe('EVOLUTION');
  });
  it('el adaptador cuenta como fallo la red caída, los 5xx y 401/403, pero no un 400 (número sin WhatsApp)', async () => {
    const prisma = prismaFalso({ evolution_pausa_min_seg: 0, evolution_pausa_max_seg: 0, evolution_fallos_seguidos: 2 });
    const config = new EvolutionConfigService(prisma);
    const respuestas: any[] = [{ ok: false, status: 400, data: { message: 'exists false' } }, { ok: false, status: 400, data: {} }, { ok: false, status: 0, data: null, red: true }, { ok: false, status: 502, data: {} }];
    const api: any = { configurado: () => true, instancia: 'p', llamar: jest.fn(async () => respuestas.shift()) };
    const ad = new WhatsAppEvolutionAdaptador(api, config, new MenuNumeradoStore(), prisma);
    await ad.enviarTexto('51900000001', 'a');
    await ad.enviarTexto('51900000001', 'b');
    expect(await config.estaPausado()).toBe(false);
    await ad.enviarTexto('51900000001', 'c');
    await ad.enviarTexto('51900000001', 'd');
    expect(await config.estaPausado()).toBe(true);
  });
});

describe('la verificación del celular sigue funcionando cuando el mensaje entra por Evolution', () => {
  it('«Mi código: TOKEN» recibido por Evolution verifica el celular igual que por Meta, sin pasar por el bot', async () => {
    const datos = new Map<string, string>();
    const redis: any = {
      obtenerCliente() { return this; },
      set: jest.fn(async (k: string, v: string, ...r: unknown[]) => { if (r.includes('NX') && datos.has(k)) return null; datos.set(k, v); return 'OK'; }),
      get: jest.fn(async (k: string) => datos.get(k) ?? null),
      incr: jest.fn(async () => 1),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn(async () => 1),
      exists: jest.fn(async (k: string) => (datos.has(k) ? 1 : 0)),
      eval: jest.fn(async (_s: string, _n: number, llave: string) => { datos.delete(llave); return 1; }),
    };
    const config: any = { get: (_k: string, d?: any) => d };
    const conv = { id: 42n, telefono: '51987654321', duenio: 'BOT', estado: 'ABIERTA', tomado_por: null, flujo: {}, nombre_contacto: 'Ana', nombre_editado: false, identificador_tipo: 'TELEFONO' };
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
    const mensajeria = { enviarTexto: jest.fn().mockResolvedValue(undefined) };
    const motor = { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) };
    const autorespuesta = { atender: jest.fn(), reaccionarAVoucher: jest.fn() };
    const webhook = new WhatsappWebhookService(config, prisma, mensajeria as any, { subirArchivo: jest.fn() } as any, { emitirAdmin: jest.fn() } as any, motor as any, undefined, undefined, undefined, undefined, redis, undefined, undefined, undefined, undefined, autorespuesta as any);

    const token = await iniciarVerificacion(redis, secretoVerificacion(config), '987654321', 'REGISTRO');
    // Lo que manda Evolution (messages.upsert) pasa por el mismo normalizador y arma el mismo payload que Meta
    const n = normalizarMensajeEvolution({ key: { remoteJid: '51987654321@s.whatsapp.net', fromMe: false, id: 'EVO-V1' }, pushName: 'Ana', message: { conversation: `Hola Caprichos, quiero verificar mi celular. Mi código: ${token}` } });
    expect(n.ok).toBe(true);
    if (!n.ok) return;
    const msg = aRespuestaDeMenu(n.msg, null);
    await webhook.procesarPayload({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', contacts: [n.contacto], messages: [msg] } }] }] });
    await new Promise((r) => setImmediate(r));

    expect(datos.get('cliente:reg:ok:987654321')).toBe('1');
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith('51987654321', RESPUESTA_VERIFICADO);
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    expect(autorespuesta.atender).not.toHaveBeenCalled(); // la verificación no recibe cortesías
  });
});

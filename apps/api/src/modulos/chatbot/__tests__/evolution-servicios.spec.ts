jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { UnauthorizedException } from '@nestjs/common';
import { EvolutionConfigService } from '../evolution/evolution-config.service';
import { PoliticaEvolutionService } from '../evolution/politica-evolution.service';
import { EvolutionWebhookService } from '../evolution/evolution-webhook.service';
import { EvolutionWebhookController } from '../evolution/evolution-webhook.controller';
import { MenuNumeradoStore } from '../evolution/menu-numerado.store';
import { WhatsAppEvolutionAdaptador } from '../adaptadores/whatsapp-evolution.adaptador';
import { WhatsAppEnrutadorAdaptador } from '../adaptadores/whatsapp-enrutador.adaptador';
import { OutboxWhatsappService } from '../servicios/outbox-whatsapp.service';

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
    whatsappMensaje: { count: jest.fn(async () => 1), create: jest.fn(async () => ({})) },
    pedido: { count: jest.fn(async () => 0) },
    salienteWhatsapp: { count: jest.fn(async () => 0), updateMany: jest.fn(async () => ({ count: 1 })) },
  } as any;
}

const DENTRO = new Date('2026-11-13T17:00:00Z'); // 12:00 Lima
const FUERA = new Date('2026-11-13T07:00:00Z'); // 02:00 Lima

describe('conmutación de proveedor', () => {
  it('por defecto es META y conmutar a EVOLUTION se audita', async () => {
    const prisma = prismaFalso();
    const auditoria = { registrar: jest.fn() } as any;
    const svc = new EvolutionConfigService(prisma, undefined, auditoria);
    expect(await svc.proveedor()).toBe('META');
    expect(svc.proveedorEnCache()).toBe('META');
    await svc.conmutarProveedor('EVOLUTION', { partyId: 7n });
    expect(await svc.proveedor()).toBe('EVOLUTION');
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ modulo: 'whatsapp_proveedor', accion: 'conmutar', antes: { whatsapp_proveedor: 'META' }, despues: { whatsapp_proveedor: 'EVOLUTION' } }));
    await svc.conmutarProveedor('META');
    expect(await svc.proveedor()).toBe('META');
  });
  it('rechaza un proveedor inválido y un límite inválido', async () => {
    const svc = new EvolutionConfigService(prismaFalso());
    await expect(svc.conmutarProveedor('OTRO' as any)).rejects.toMatchObject({ response: { codigo: 'PROVEEDOR_INVALIDO' } });
    await expect(svc.actualizarLimites({ evolution_limite_minuto: -1 })).rejects.toMatchObject({ response: { codigo: 'LIMITE_INVALIDO' } });
  });
  it('un valor ausente o inválido cae al defecto conservador', async () => {
    const svc = new EvolutionConfigService(prismaFalso({ evolution_limite_minuto: 'abc' }));
    const c = await svc.obtener();
    expect([c.evolution_limite_minuto, c.evolution_limite_hora, c.evolution_limite_dia]).toEqual([3, 60, 350]);
    expect([c.evolution_pausa_min_seg, c.evolution_pausa_max_seg, c.evolution_horario_desde, c.evolution_horario_hasta]).toEqual([2, 6, 9, 22]);
  });
  it('desconexión con Meta activo: avisa al ADMIN una sola vez y el baneo pausa el envío', async () => {
    const prisma = prismaFalso();
    const svc = new EvolutionConfigService(prisma);
    await svc.registrarConexion('open');
    await svc.registrarConexion('close', 428);
    await svc.registrarConexion('close', 428);
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(1);
    expect(prisma.notificacion.create.mock.calls[0][0].data.rol_destino).toBe('ADMIN');
    expect(await svc.estaPausado()).toBe(false);
    await svc.registrarConexion('open');
    await svc.registrarConexion('close', 401);
    expect(await svc.estaPausado()).toBe(true);
    expect((await svc.estadoConexion()).estado).toBe('DESCONECTADO');
  });
});

describe('política de envío con Evolution', () => {
  const crear = (params: Record<string, unknown> = {}, prismaExtra: any = {}) => {
    const prisma = Object.assign(prismaFalso({ whatsapp_proveedor: 'EVOLUTION', ...params }), prismaExtra);
    return { prisma, politica: new PoliticaEvolutionService(prisma, new EvolutionConfigService(prisma)) };
  };
  const aviso = { telefono_destino: '51900000001', origen: 'AVISO_PEDIDO' };

  it('con Meta no hace nada', async () => {
    const { politica } = crear({ whatsapp_proveedor: 'META' });
    expect(await politica.evaluar({ telefono_destino: '51900000001', origen: 'CAMPANA' }, FUERA)).toEqual({ accion: 'ENVIAR' });
  });
  it('igualito a Meta: salen los mismos avisos (rigen los interruptores whatsapp_aviso_*), no una lista aparte', async () => {
    const { politica } = crear();
    for (const origen of ['RECORDATORIO_RESERVA', 'ALERTA_ADMIN', 'EQUIPO_NUEVO_PEDIDO', 'ESPERA', 'RECORDATORIO_PAGO', 'AVISO_PEDIDO', 'ENCUESTA']) {
      expect(await politica.evaluar({ ...aviso, origen }, DENTRO)).toEqual({ accion: 'ENVIAR' });
    }
  });
  it('si el ADMIN escribe una lista de orígenes, solo salen esos', async () => {
    const { politica } = crear({ evolution_origenes_permitidos: 'AVISO_PEDIDO' });
    expect(await politica.evaluar({ ...aviso, origen: 'ESPERA' }, DENTRO)).toMatchObject({ accion: 'DESCARTAR', codigo: 'PROACTIVO_BLOQUEADO' });
    expect(await politica.evaluar(aviso, DENTRO)).toEqual({ accion: 'ENVIAR' });
  });
  it('los avisos al equipo no exigen contacto previo (sus números no escriben primero)', async () => {
    const { politica } = crear({ stock_control_activo: 'si' }, { whatsappMensaje: { count: jest.fn(async () => 0) } });
    for (const origen of ['ALERTA_ADMIN', 'EQUIPO_NUEVO_PEDIDO', 'EQUIPO_ALERTA_ALMACEN']) expect(await politica.evaluar({ ...aviso, origen }, DENTRO)).toEqual({ accion: 'ENVIAR' });
  });

  it('un aviso de almacén fuera de horario se DIFIERE hasta que abra (no se descarta); otros avisos sí se descartan', async () => {
    const { politica } = crear({ stock_control_activo: 'si' });
    const decision = await politica.evaluar({ telefono_destino: '51900000001', origen: 'EQUIPO_ALERTA_ALMACEN' }, FUERA);
    expect(decision).toMatchObject({ accion: 'DIFERIR' });
    expect((decision as any).esperaMs).toBeGreaterThan(0);
    expect(await politica.evaluar({ ...aviso, origen: 'ALERTA_ADMIN' }, FUERA)).toMatchObject({ accion: 'DESCARTAR', codigo: 'FUERA_DE_HORARIO' });
  });

  it('con el control de almacén apagado no sale ningún aviso de stock, ni los que quedaron en cola', async () => {
    const { politica } = crear({ stock_control_activo: 'no' });
    expect(await politica.evaluar({ telefono_destino: '51900000001', origen: 'EQUIPO_ALERTA_ALMACEN' }, DENTRO)).toMatchObject({ accion: 'DESCARTAR', codigo: 'CONTROL_APAGADO' });
  });
  it('permite aviso del pedido y encuesta, y siempre las respuestas a un mensaje del cliente', async () => {
    const { politica } = crear();
    expect(await politica.evaluar(aviso, DENTRO)).toEqual({ accion: 'ENVIAR' });
    expect(await politica.evaluar({ ...aviso, origen: 'ENCUESTA' }, DENTRO)).toEqual({ accion: 'ENVIAR' });
    expect(await politica.evaluar({ ...aviso, origen: 'VOUCHER' }, FUERA)).toEqual({ accion: 'ENVIAR' });
  });
  it('nunca escribe primero a un número que jamás escribió (otros proactivos)', async () => {
    const { politica } = crear({}, { whatsappMensaje: { count: jest.fn(async () => 0) } });
    expect(await politica.evaluar({ ...aviso, origen: 'ENCUESTA' }, DENTRO)).toMatchObject({ accion: 'DESCARTAR', codigo: 'SIN_CONTACTO_PREVIO' });
  });
  it('REGLA 24 h: el aviso del pedido solo sale solo si el cliente escribió en las últimas 24 h; si no, queda DESCARTADO con motivo (aunque haya pedido por la web)', async () => {
    const count = jest.fn(async (_a?: any) => 0);
    const { politica } = crear({}, { whatsappMensaje: { count }, pedido: { count: jest.fn(async () => 1) } });
    const r = await politica.evaluar(aviso, DENTRO);
    expect(r).toMatchObject({ accion: 'DESCARTAR', codigo: 'FUERA_DE_VENTANA_24H' });
    expect((r as any).motivo).toContain('Fuera de las 24 h');
    expect(count.mock.calls[0][0].where.creado_en.gte).toBeInstanceOf(Date);
  });
  it('con el cliente dentro de las 24 h el aviso del pedido sale', async () => {
    const { politica } = crear({}, { whatsappMensaje: { count: jest.fn(async () => 1) } });
    expect(await politica.evaluar(aviso, DENTRO)).toEqual({ accion: 'ENVIAR' });
  });
  it('código de cuenta, reserva y cuenta creada no exigen contacto previo (los pidió el cliente)', async () => {
    const { politica } = crear({}, { whatsappMensaje: { count: jest.fn(async () => 0) } });
    for (const origen of ['CODIGO_CUENTA', 'RESERVA', 'AVISO_CUENTA']) expect(await politica.evaluar({ ...aviso, origen }, DENTRO)).toEqual({ accion: 'ENVIAR' });
  });
  it('fuera de horario se DESCARTA (no se manda al día siguiente), salvo las respuestas a un mensaje del cliente', async () => {
    const { politica } = crear();
    expect(await politica.evaluar(aviso, FUERA)).toMatchObject({ accion: 'DESCARTAR', codigo: 'FUERA_DE_HORARIO' });
    for (const origen of ['VOUCHER', 'AUTORESPUESTA']) expect(await politica.evaluar({ ...aviso, origen }, FUERA)).toEqual({ accion: 'ENVIAR' });
  });
  // Decisión del dueño: el código de cuenta (lo pide la propia persona para entrar) sí sale fuera de horario
  it('CODIGO_CUENTA fuera de horario sí se envía; otro origen fuera de horario sigue diferido/descartado', async () => {
    const { politica } = crear();
    expect(await politica.evaluar({ ...aviso, origen: 'CODIGO_CUENTA' }, FUERA)).toEqual({ accion: 'ENVIAR' });
    expect(await politica.evaluar({ ...aviso, origen: 'RESERVA' }, FUERA)).toMatchObject({ accion: 'DESCARTAR', codigo: 'FUERA_DE_HORARIO' });
    expect(await politica.evaluar({ ...aviso, origen: 'ENCUESTA' }, FUERA)).toMatchObject({ accion: 'DESCARTAR', codigo: 'FUERA_DE_HORARIO' });
  });
  it('CODIGO_CUENTA fuera de horario mantiene la pausa, la desconexión y los topes', async () => {
    const codigo = { ...aviso, origen: 'CODIGO_CUENTA' };
    expect(await crear({ evolution_pausado: 'si' }).politica.evaluar(codigo, FUERA)).toMatchObject({ accion: 'DIFERIR' });
    expect(await crear({ evolution_estado: { estado: 'DESCONECTADO' } }).politica.evaluar(codigo, FUERA)).toMatchObject({ accion: 'DIFERIR' });
    const topado = crear({ evolution_limite_minuto: 3 }, { salienteWhatsapp: { count: jest.fn(async () => 3) } });
    expect(await topado.politica.evaluar(codigo, FUERA)).toMatchObject({ accion: 'DIFERIR', motivo: expect.stringContaining('por minuto') });
  });
  it('el horario es el del local en Configuración; el evolution_horario_* solo es respaldo', async () => {
    const prisma = prismaFalso({ whatsapp_proveedor: 'EVOLUTION' });
    const cerrado = { obtenerEstadoCarta: jest.fn(async () => ({ abierta: false, motivo: 'HORARIO', abre: '15:00' })) } as any;
    const abierto = { obtenerEstadoCarta: jest.fn(async () => ({ abierta: true, motivo: 'OK', abre: '09:00' })) } as any;
    const pausa = { obtenerEstadoCarta: jest.fn(async () => ({ abierta: false, motivo: 'PAUSA', abre: null })) } as any;
    const roto = { obtenerEstadoCarta: jest.fn(async () => { throw new Error('bd'); }) } as any;
    const con = (local: any) => new PoliticaEvolutionService(prisma, new EvolutionConfigService(prisma), local);
    // A las 12:00 de Lima el respaldo (9 a 22) diría «abierto»; el local manda y dice cerrado
    expect(await con(cerrado).evaluar(aviso, DENTRO)).toMatchObject({ accion: 'DESCARTAR', codigo: 'FUERA_DE_HORARIO' });
    // A las 02:00 de Lima el respaldo diría «cerrado»; el local manda y dice abierto (turno de madrugada)
    expect(await con(abierto).evaluar(aviso, FUERA)).toEqual({ accion: 'ENVIAR' });
    // Pausa por alta demanda y fallo de lectura: cae al respaldo
    expect(await con(pausa).evaluar(aviso, DENTRO)).toEqual({ accion: 'ENVIAR' });
    expect(await con(pausa).evaluar(aviso, FUERA)).toMatchObject({ codigo: 'FUERA_DE_HORARIO' });
    expect(await con(roto).evaluar(aviso, FUERA)).toMatchObject({ codigo: 'FUERA_DE_HORARIO' });
  });
  it('fuera de horario: el «recibido» de un pedido PROGRAMADO de la carta o el bot sale; los demás avisos se descartan como hoy', async () => {
    const pedido = (estado: string, canal = 'CARTA') => ({ pedido: { count: jest.fn(async () => 0), findUnique: jest.fn(async () => ({ estado, canal })) } });
    const recibido = { ...aviso, pedido_id: 7n, carga: { etapa: 'RECIBIDO' } };
    expect(await crear({}, pedido('PROGRAMADO')).politica.evaluar(recibido, FUERA)).toEqual({ accion: 'ENVIAR' });
    expect(await crear({}, pedido('PROGRAMADO', 'WHATSAPP')).politica.evaluar(recibido, FUERA)).toEqual({ accion: 'ENVIAR' });
    // no programado + cerrado = se descarta como hoy
    expect(await crear({}, pedido('COLA')).politica.evaluar(recibido, FUERA)).toMatchObject({ accion: 'DESCARTAR', codigo: 'FUERA_DE_HORARIO' });
    // programado por Caja: no es de cliente
    expect(await crear({}, pedido('PROGRAMADO', 'CAJA')).politica.evaluar(recibido, FUERA)).toMatchObject({ codigo: 'FUERA_DE_HORARIO' });
    // otro aviso del mismo programado (p. ej. aceptado) fuera de horario: se descarta
    expect(await crear({}, pedido('PROGRAMADO')).politica.evaluar({ ...recibido, carga: { etapa: 'ACEPTADO' } }, FUERA)).toMatchObject({ codigo: 'FUERA_DE_HORARIO' });
    // sin pedido_id (aviso suelto): se descarta
    expect(await crear({}, pedido('PROGRAMADO')).politica.evaluar(aviso, FUERA)).toMatchObject({ codigo: 'FUERA_DE_HORARIO' });
  });
  it('pausado o desconectado espera', async () => {
    expect(await crear({ evolution_pausado: 'si' }).politica.evaluar(aviso, DENTRO)).toMatchObject({ accion: 'DIFERIR' });
    expect(await crear({ evolution_estado: { estado: 'DESCONECTADO' } }).politica.evaluar(aviso, DENTRO)).toMatchObject({ accion: 'DIFERIR' });
  });
  it('tope por minuto y por día: lo que excede espera', async () => {
    const desde = (where: any) => DENTRO.getTime() - where.enviado_en.gte.getTime();
    const porMinuto = crear({}, { salienteWhatsapp: { count: jest.fn(async ({ where }: any) => (desde(where) <= 61_000 ? 3 : 0)) } });
    expect(await porMinuto.politica.evaluar(aviso, DENTRO)).toMatchObject({ accion: 'DIFERIR', motivo: expect.stringContaining('por minuto') });
    const porDia = crear({ evolution_limite_dia: 5 }, { salienteWhatsapp: { count: jest.fn(async ({ where }: any) => (desde(where) > 7_200_000 ? 5 : 0)) } });
    expect(await porDia.politica.evaluar(aviso, DENTRO)).toMatchObject({ accion: 'DIFERIR', motivo: expect.stringContaining('por día') });
  });
  it('0 en un tope significa sin tope', async () => {
    const { politica } = crear({ evolution_limite_minuto: 0, evolution_limite_hora: 0, evolution_limite_dia: 0 }, { salienteWhatsapp: { count: jest.fn(async () => 9999) } });
    expect(await politica.evaluar(aviso, DENTRO)).toEqual({ accion: 'ENVIAR' });
  });
});

describe('el outbox aplica la política', () => {
  const fila: any = { id: 1n, telefono_destino: '51900000001', tipo: 'TEXTO', carga: { textoLibre: 'x' }, intentos: 0, max_intentos: 5, pedido_id: null, origen: 'RECORDATORIO_PAGO' };
  const montar = (decision: any) => {
    const prisma = { salienteWhatsapp: { updateMany: jest.fn(async () => ({ count: 1 })) } } as any;
    const mensajeria = { enviarTexto: jest.fn() } as any;
    const ventana = { enviarMensajeNegocio: jest.fn() } as any;
    const svc = new OutboxWhatsappService(prisma, ventana, mensajeria, undefined, undefined, { evaluar: jest.fn(async () => decision) } as any);
    return { svc, prisma, ventana };
  };
  it('DESCARTAR deja el mensaje DESCARTADO con motivo y no envía', async () => {
    const { svc, prisma, ventana } = montar({ accion: 'DESCARTAR', codigo: 'PROACTIVO_BLOQUEADO', motivo: 'Bloqueado: prueba' });
    expect(await (svc as any).enviarFila(fila, 'tok')).toBe('OMITIDO');
    expect(prisma.salienteWhatsapp.updateMany.mock.calls[0][0].data).toMatchObject({ estado: 'DESCARTADO', motivo_descarte: 'Bloqueado: prueba', descartado_por: 'Sistema' });
    expect(ventana.enviarMensajeNegocio).not.toHaveBeenCalled();
  });
  it('DIFERIR vuelve a PENDIENTE sin gastar intentos', async () => {
    const { svc, prisma, ventana } = montar({ accion: 'DIFERIR', esperaMs: 60_000, motivo: 'Tope' });
    expect(await (svc as any).enviarFila(fila, 'tok')).toBe('REINTENTO');
    const data = prisma.salienteWhatsapp.updateMany.mock.calls[0][0].data;
    expect(data.estado).toBe('PENDIENTE');
    expect(data.intentos).toBeUndefined();
    expect(ventana.enviarMensajeNegocio).not.toHaveBeenCalled();
  });
});

describe('webhook de Evolution', () => {
  const montar = (token = 'secreto-de-prueba') => {
    const config = { get: (k: string) => (k === 'EVOLUTION_WEBHOOK_TOKEN' ? token : undefined) } as any;
    const estado = { registrarConexion: jest.fn() } as any;
    const store = new MenuNumeradoStore();
    const webhook = { procesarPayload: jest.fn(async () => ({})), registrarMensajeDelLocal: jest.fn(async () => 'SISTEMA'), vincularLidConCelular: jest.fn() } as any;
    const svc = new EvolutionWebhookService(config, estado, store, webhook);
    return { svc, estado, store, webhook, ctrl: new EvolutionWebhookController(svc) };
  };
  const evento = (data: any, event = 'messages.upsert') => ({ event, instance: 'prueba', data });
  const texto = (extra: any = {}, cuerpo = 'hola') => ({ key: { remoteJid: '51900000001@s.whatsapp.net', fromMe: false, id: 'ID1', ...extra }, message: { conversation: cuerpo } });

  it('token inválido, ausente o sin configurar: 401', async () => {
    const { ctrl } = montar();
    await expect(ctrl.recibir(undefined, undefined, undefined, evento(texto()))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(ctrl.recibir('otro', undefined, undefined, evento(texto()))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(montar('').ctrl.recibir('', undefined, undefined, evento(texto()))).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('token válido por cabecera, Bearer o consulta', async () => {
    const { ctrl, webhook } = montar();
    await expect(ctrl.recibir('secreto-de-prueba', undefined, undefined, evento(texto()))).resolves.toMatchObject({ ok: true, procesados: 1 });
    await ctrl.recibir(undefined, 'Bearer secreto-de-prueba', undefined, evento(texto()));
    await ctrl.recibir(undefined, undefined, 'secreto-de-prueba', evento(texto()));
    expect(webhook.procesarPayload).toHaveBeenCalledTimes(3);
  });
  it('ignora grupos y estados; lo propio (fromMe) va al registro del local y no al flujo del bot', async () => {
    const { svc, webhook } = montar();
    const r1 = await svc.procesar(evento(texto({ fromMe: true })));
    const r2 = await svc.procesar(evento(texto({ remoteJid: '1203@g.us' })));
    const r3 = await svc.procesar(evento(texto({ remoteJid: 'status@broadcast' })));
    expect([r1, r2, r3].map((r) => r.ignorados)).toEqual([1, 1, 1]); // fromMe del sistema: SISTEMA = ignorado
    expect(webhook.procesarPayload).not.toHaveBeenCalled();
  });
  it('acepta el nombre del evento en mayúsculas con guion bajo', async () => {
    const { svc, webhook } = montar();
    await svc.procesar(evento(texto(), 'MESSAGES_UPSERT'));
    expect(webhook.procesarPayload).toHaveBeenCalledTimes(1);
  });
  it('un duplicado llega con el mismo id de mensaje (el flujo de Meta lo descarta por wa_message_id)', async () => {
    const { svc, webhook } = montar();
    await svc.procesar(evento(texto()));
    await svc.procesar(evento(texto()));
    const ids = webhook.procesarPayload.mock.calls.map((c: any) => c[0].entry[0].changes[0].value.messages[0].id);
    expect(ids).toEqual(['ID1', 'ID1']);
  });
  it('la respuesta numérica a un menú llega como el id del botón', async () => {
    const { svc, store, webhook } = montar();
    await store.guardar('51900000001', { tipo: 'boton', opciones: [{ n: 1, id: 'menu_carta', titulo: 'Ver carta' }, { n: 2, id: 'menu_pedir', titulo: 'Pedir' }] });
    await svc.procesar(evento(texto({}, '2')));
    const msg = webhook.procesarPayload.mock.calls[0][0].entry[0].changes[0].value.messages[0];
    expect(msg).toMatchObject({ type: 'interactive', interactive: { button_reply: { id: 'menu_pedir', title: 'Pedir' } } });
    expect(await store.obtener('51900000001')).toBeNull(); // el menú se consume
  });
  it('connection.update registra la conexión', async () => {
    const { svc, estado } = montar();
    await svc.procesar(evento({ state: 'close', statusReason: 401 }, 'connection.update'));
    expect(estado.registrarConexion).toHaveBeenCalledWith('close', 401);
  });
});

describe('adaptador y enrutador', () => {
  const montarAdaptador = (configurado: boolean, params: Record<string, unknown> = {}) => {
    const prisma = prismaFalso({ evolution_pausa_min_seg: 0, evolution_pausa_max_seg: 0, ...params });
    const api = { configurado: () => configurado, instancia: 'prueba', llamar: jest.fn(async () => ({ ok: true, status: 201, data: { key: { id: 'WA1' } } })) } as any;
    const config = new EvolutionConfigService(prisma);
    const store = new MenuNumeradoStore();
    return { api, config, store, prisma, ad: new WhatsAppEvolutionAdaptador(api, config, store, prisma) };
  };

  it('sin credenciales: éxito simulado, sin tocar la red', async () => {
    const { ad, api } = montarAdaptador(false);
    const r = await ad.enviarTexto('51900000001', 'hola');
    expect(r).toMatchObject({ exito: true, estado: 'SIMULADO' });
    expect(api.llamar).not.toHaveBeenCalled();
    expect(ad.estaConectado().modo).toBe('simulado');
  });
  it('botones salen como texto numerado, con «escribiendo…», y se guarda el menú', async () => {
    const { ad, api, store, prisma } = montarAdaptador(true);
    const r = await ad.enviarBotones('51900000001', 'Elige', [{ id: 'a', titulo: 'Uno' }, { id: 'b', titulo: 'Dos' }]);
    expect(r).toMatchObject({ exito: true, estado: 'ENVIADO', waMessageId: 'WA1' });
    const [metodo, ruta, cuerpo] = api.llamar.mock.calls[0];
    expect([metodo, ruta]).toEqual(['POST', '/message/sendText/prueba']);
    expect(cuerpo).toMatchObject({ number: '51900000001' });
    expect(cuerpo.text).toContain('1. Uno');
    expect(cuerpo.text).toContain('Responde 1 o 2.');
    expect(cuerpo.delay).toBeGreaterThanOrEqual(1000);
    expect((await store.obtener('51900000001'))?.opciones.map((o) => o.id)).toEqual(['a', 'b']);
    expect(prisma.whatsappMensaje.create).toHaveBeenCalledWith({ data: expect.objectContaining({ direccion: 'SALIENTE', estado: 'ENVIADO', tipo: 'BOTON', wa_message_id: 'WA1' }) });
  });
  it('un texto normal posterior borra el menú viejo', async () => {
    const { ad, store } = montarAdaptador(true);
    await ad.enviarLista('51900000001', 'Elige', 'Ver', [{ id: 'a', titulo: 'Uno' }]);
    await ad.enviarTexto('51900000001', 'Gracias');
    expect(await store.obtener('51900000001')).toBeNull();
  });
  it('carrusel sale como lista numerada; plantilla como su texto libre', async () => {
    const { ad, api } = montarAdaptador(true);
    await ad.enviarCarrusel('51900000001', { cuerpo: 'Mira', tarjetas: [{ nombre: 'Torta', imagenUrl: null, cuerpo: 'c', boton: { id: 'p1', titulo: 'Pedir' } }, { nombre: 'Dona', imagenUrl: null, cuerpo: 'c', boton: { id: 'p2', titulo: 'Pedir' } }] });
    expect(api.llamar.mock.calls[0][2].text).toContain('1. Torta');
    await ad.enviarPlantilla('51900000001', 'caprichos_delivery_en_camino', 'es', ['Ana', 'P-1', '20']);
    expect(api.llamar.mock.calls[1][2].text).toContain('Tu pedido P-1 ya salió');
  });
  it('«Ver la carta» con Evolution: lista numerada con precio, sin «Pedir este», y elegir un número pide el producto', async () => {
    const { ad, api, store } = montarAdaptador(true);
    const cuerpo = 'Nuestros favoritos 💛 Toca «Pedir este» para pedirlo. Carta completa: https://carta.pe';
    await ad.enviarCarrusel('51900000001', {
      cuerpo,
      tarjetas: [{ nombre: 'Frappe Oreo', imagenUrl: null, cuerpo: 'Frappe Oreo\nS/ 12.00', boton: { id: 'ped_prod_1', titulo: 'Pedir este' } }, { nombre: 'Waffle', imagenUrl: null, cuerpo: 'Waffle\nS/ 9.00', boton: { id: 'ped_prod_2', titulo: 'Pedir este' } }],
      respaldo: { texto: cuerpo, botones: [{ id: 'volver_menu', titulo: 'Volver al menú' }] },
    });
    const texto = api.llamar.mock.calls[0][2].text;
    expect(texto).not.toContain('Pedir este');
    expect(texto).toContain('1. Frappe Oreo (S/ 12.00)');
    expect(texto).toContain('3. Volver al menú');
    expect(texto).toContain('https://carta.pe');
    expect((await store.obtener('51900000001'))?.opciones.map((o) => o.id)).toEqual(['ped_prod_1', 'ped_prod_2', 'volver_menu']);
  });
  it('el menú numerado sigue valiendo horas después (24 h), no cae en la IA', async () => {
    const { ad, store } = montarAdaptador(true);
    await ad.enviarBotones('51900000001', 'Carta', [{ id: 'volver_menu', titulo: 'Volver al menú' }]);
    jest.useFakeTimers().setSystemTime(Date.now() + 5 * 3_600_000);
    try {
      expect((await store.obtener('51900000001'))?.opciones[0].id).toBe('volver_menu');
    } finally {
      jest.useRealTimers();
    }
  });
  it('limita los enlaces y varía el saludo si el mismo texto se repite', async () => {
    const { ad, api } = montarAdaptador(true, { evolution_max_texto_identico: 1 });
    await ad.enviarTexto('51900000001', 'Hola, mira https://a.pe/1 y https://a.pe/2');
    expect(api.llamar.mock.calls[0][2].text).toBe('Hola, mira https://a.pe/1 y (enlace omitido)');
    await ad.enviarTexto('51900000002', 'Hola, mira https://a.pe/1 y https://a.pe/2');
    expect(api.llamar.mock.calls[1][2].text).not.toBe(api.llamar.mock.calls[0][2].text);
  });
  it('pausado: no envía y devuelve un error temporal', async () => {
    const { ad, api } = montarAdaptador(true, { evolution_pausado: 'si' });
    expect(await ad.enviarTexto('51900000001', 'hola')).toMatchObject({ exito: false, errorCodigo: 'EVOLUTION_PAUSADO' });
    expect(api.llamar).not.toHaveBeenCalled();
  });
  it('un error de baneo al enviar pausa el envío', async () => {
    const { ad, api, config } = montarAdaptador(true);
    api.llamar.mockResolvedValueOnce({ ok: false, status: 403, data: { message: 'account banned' } });
    expect(await ad.enviarTexto('51900000001', 'hola')).toMatchObject({ exito: false, errorCodigo: 'ERROR_EVOLUTION' });
    expect(await config.estaPausado()).toBe(true);
  });
  it('documento: sube a memoria y se envía en base64', async () => {
    const { ad, api } = montarAdaptador(true);
    const id = await ad.subirMedia(Buffer.from('pdf-de-prueba'), 'application/pdf', undefined, 'factura.pdf');
    await ad.enviarDocumento('51900000001', id!, 'factura.pdf', 'Tu factura');
    expect(api.llamar.mock.calls[0][1]).toBe('/message/sendMedia/prueba');
    expect(api.llamar.mock.calls[0][2]).toMatchObject({ mediatype: 'document', fileName: 'factura.pdf', media: Buffer.from('pdf-de-prueba').toString('base64') });
  });

  it('el enrutador usa Meta por defecto y Evolution al conmutar, sin redesplegar', async () => {
    const prisma = prismaFalso();
    const config = new EvolutionConfigService(prisma);
    const base: any = { enviarTexto: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })), estaConectado: () => ({ conectado: true, modo: 'meta' }) };
    const evo: any = { enviarTexto: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })), estaConectado: () => ({ conectado: true, modo: 'evolution' }) };
    const r = new WhatsAppEnrutadorAdaptador(base, evo, config);
    await r.enviarTexto('51900000001', 'a');
    expect([base.enviarTexto.mock.calls.length, evo.enviarTexto.mock.calls.length]).toEqual([1, 0]);
    expect(r.estaConectado().modo).toBe('meta');
    await config.conmutarProveedor('EVOLUTION');
    await r.enviarTexto('51900000001', 'b');
    expect([base.enviarTexto.mock.calls.length, evo.enviarTexto.mock.calls.length]).toEqual([1, 1]);
    expect(r.estaConectado().modo).toBe('evolution');
  });
});

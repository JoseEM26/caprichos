jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ReanudacionBotService } from './reanudacion-bot.service';
import { botPausadoHasta, botPausadoPorPersona, debeOmitirBienvenida } from '../conversacion/reanudacion-bot.util';

// Lima = UTC-5
const lima = (iso: string) => new Date(`${iso}-05:00`);

describe('botPausadoHasta', () => {
  it('pausa hasta las 00:01 de Lima del día siguiente', () => {
    expect(botPausadoHasta(lima('2026-11-07T10:30:00')).toISOString()).toBe(lima('2026-11-08T00:01:00').toISOString());
  });
  it('una intervención a las 23:59 de Lima también reanuda a las 00:01 (2 min después)', () => {
    expect(botPausadoHasta(lima('2026-11-07T23:59:00')).toISOString()).toBe(lima('2026-11-08T00:01:00').toISOString());
  });
  it('cambio de mes', () => {
    expect(botPausadoHasta(lima('2026-11-30T12:00:00')).toISOString()).toBe(lima('2026-12-01T00:01:00').toISOString());
  });
  it('sigue pausado el resto del día y se reanuda pasadas las 00:01', () => {
    const i = lima('2026-11-07T10:00:00');
    expect(botPausadoPorPersona(i, lima('2026-11-07T22:00:00'))).toBe(true);
    expect(botPausadoPorPersona(i, lima('2026-11-08T00:00:30'))).toBe(true);
    expect(botPausadoPorPersona(i, lima('2026-11-08T00:01:00'))).toBe(false);
    expect(botPausadoPorPersona(null)).toBe(false);
  });
});

describe('debeOmitirBienvenida', () => {
  const ahora = lima('2026-11-08T09:00:00');
  it('primera conversación: sí saluda', () => {
    expect(debeOmitirBienvenida({ ahora })).toBe(false);
  });
  it('pedido de hoy tras Atendido: no saluda', () => {
    expect(debeOmitirBienvenida({ ahora, pedidosHoy: 1, estadoConversacion: 'ATENDIDA', ultimoMensajeSaleEn: lima('2026-11-08T08:00:00') })).toBe(true);
  });
  it('marcado Atendido: no saluda', () => {
    expect(debeOmitirBienvenida({ ahora, estadoConversacion: 'ATENDIDA' })).toBe(true);
  });
  it('persona intervino hoy: no saluda', () => {
    expect(debeOmitirBienvenida({ ahora, ultimaIntervencionHumana: lima('2026-11-08T07:00:00'), ultimoMensajeSaleEn: lima('2026-11-01T07:00:00') })).toBe(true);
  });
  it('último mensaje del bot hace menos de 24 h: no saluda', () => {
    expect(debeOmitirBienvenida({ ahora, ultimoMensajeSaleEn: lima('2026-11-07T20:00:00') })).toBe(true);
  });
  it('tras la reanudación de las 00:01: habló ayer (más de 24 h) tampoco repite', () => {
    expect(debeOmitirBienvenida({ ahora, ultimoMensajeSaleEn: lima('2026-11-07T08:00:00'), reanudadoEn: '2026-11-08T05:01:00Z' })).toBe(true);
  });
  it('varios días sin hablar: sí saluda', () => {
    expect(debeOmitirBienvenida({ ahora, ultimoMensajeSaleEn: lima('2026-11-03T08:00:00'), reanudadoEn: '2026-11-04T05:01:00Z' })).toBe(false);
  });
});

describe('ReanudacionBotService', () => {
  const ahora = lima('2026-11-08T00:05:00');
  function armar(convs: any[], opts: { delivery?: number; lock?: string | null } = {}) {
    const prisma: any = {
      conversacion: { findMany: jest.fn().mockResolvedValue(convs), update: jest.fn().mockResolvedValue({}) },
      mensajeChat: {
        findFirst: jest.fn(({ where }: any) => Promise.resolve(convs.find((c) => c.id === where.conversacion_id)?.ultimoPersona ?? null)),
        create: jest.fn().mockResolvedValue({}),
      },
      pedido: { count: jest.fn().mockResolvedValue(opts.delivery ?? 0) },
    };
    const set = jest.fn().mockResolvedValue(opts.lock === null ? null : 'OK');
    const redis: any = { obtenerCliente: () => ({ set, del: jest.fn() }) };
    return { prisma, set, svc: new ReanudacionBotService(prisma, redis) };
  }
  const conv = (extra: any = {}) => ({
    id: BigInt(1), telefono: '51912345678', estado: 'ABIERTA', flujo: { estado: 'ATENCION_PERSONA' },
    tomado_en: lima('2026-11-07T10:00:00'), ultimoPersona: { en: lima('2026-11-07T11:00:00') }, ...extra,
  });

  it('libera el chat tomado ayer: dueño BOT, sin tomar, flujo a MENU y motivo registrado', async () => {
    const { svc, prisma } = armar([conv()]);
    expect(await svc.ejecutarCiclo(ahora)).toBe(1);
    const data = prisma.conversacion.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ duenio: 'BOT', tomado_por: null, tomado_en: null });
    expect(data.flujo.estado).toBe('MENU');
    expect(prisma.mensajeChat.create.mock.calls[0][0].data.contenido.texto).toBe('Reanudado a las 00:01');
  });

  it('no libera VALIDAR_PAGO ni delivery en curso', async () => {
    const a = armar([conv({ estado: 'VALIDAR_PAGO' })]);
    expect(await a.svc.liberarVencidos(ahora)).toBe(0);
    const b = armar([conv()], { delivery: 1 });
    expect(await b.svc.liberarVencidos(ahora)).toBe(0);
    expect(b.prisma.conversacion.update).not.toHaveBeenCalled();
  });

  it('no libera si la persona intervino hoy ni si nunca intervino una persona', async () => {
    const hoy = armar([conv({ ultimoPersona: { en: lima('2026-11-08T00:03:00') }, tomado_en: null })]);
    expect(await hoy.svc.liberarVencidos(ahora)).toBe(0);
    const nadie = armar([conv({ ultimoPersona: null, tomado_en: null })]);
    expect(await nadie.svc.liberarVencidos(ahora)).toBe(0);
  });

  it('es idempotente: con el candado diario ya tomado no hace nada, y antes de las 00:01 tampoco', async () => {
    const tomado = armar([conv()], { lock: null });
    expect(await tomado.svc.ejecutarCiclo(ahora)).toBe(0);
    expect(tomado.prisma.conversacion.update).not.toHaveBeenCalled();
    const temprano = armar([conv()]);
    expect(await temprano.svc.ejecutarCiclo(lima('2026-11-08T00:00:20'))).toBe(0);
    expect(temprano.set).not.toHaveBeenCalled();
  });
});

jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { MOTIVO_REANUDADO, ReanudacionBotService } from './reanudacion-bot.service';
import { botPausadoPorPersona, debeOmitirBienvenida } from '../conversacion/reanudacion-bot.util';

// Lima = UTC-5
const lima = (iso: string) => new Date(`${iso}-05:00`);

describe('botPausadoPorPersona (regla de los 20 minutos)', () => {
  const i = lima('2026-11-07T10:00:00');
  it('la persona escribió hace 5 min: el bot calla', () => {
    expect(botPausadoPorPersona(i, lima('2026-11-07T10:05:00'), 20)).toBe(true);
  });
  it('hace 21 min: el bot responde, también si cruzó la medianoche', () => {
    expect(botPausadoPorPersona(i, lima('2026-11-07T10:21:00'), 20)).toBe(false);
    expect(botPausadoPorPersona(lima('2026-11-07T23:55:00'), lima('2026-11-08T00:05:00'), 20)).toBe(true);
  });
  it('sin intervención de una persona no hay silencio', () => {
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
  it('tras reanudar el bot: habló ayer (más de 24 h) tampoco repite', () => {
    expect(debeOmitirBienvenida({ ahora, ultimoMensajeSaleEn: lima('2026-11-07T08:00:00'), reanudadoEn: '2026-11-08T05:01:00Z' })).toBe(true);
  });
  it('varios días sin hablar: sí saluda', () => {
    expect(debeOmitirBienvenida({ ahora, ultimoMensajeSaleEn: lima('2026-11-03T08:00:00'), reanudadoEn: '2026-11-04T05:01:00Z' })).toBe(false);
  });
});

describe('ReanudacionBotService', () => {
  const ahora = lima('2026-11-08T10:30:00');
  function armar(convs: any[], opts: { delivery?: number; param?: number } = {}) {
    const prisma: any = {
      conversacion: { findMany: jest.fn().mockResolvedValue(convs), update: jest.fn().mockResolvedValue({}) },
      mensajeChat: {
        findFirst: jest.fn(({ where }: any) => Promise.resolve(convs.find((c) => c.id === where.conversacion_id)?.ultimoPersona ?? null)),
        create: jest.fn().mockResolvedValue({}),
      },
      pedido: { count: jest.fn().mockResolvedValue(opts.delivery ?? 0) },
      parametro: { findUnique: jest.fn().mockResolvedValue(opts.param ? { valor: opts.param } : null) },
    };
    return { prisma, svc: new ReanudacionBotService(prisma) };
  }
  const conv = (extra: any = {}) => ({
    id: BigInt(1), telefono: '51912345678', estado: 'ABIERTA', flujo: { estado: 'ATENCION_PERSONA' },
    tomado_en: null, ultimoPersona: { en: lima('2026-11-08T10:00:00') }, ...extra,
  });

  it('con 30 min sin que el equipo escriba libera el chat: dueño BOT, sin tomar, flujo a MENU y motivo registrado', async () => {
    const { svc, prisma } = armar([conv()]);
    expect(await svc.ejecutarCiclo(ahora)).toBe(1);
    const data = prisma.conversacion.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ duenio: 'BOT', tomado_por: null, tomado_en: null });
    expect(data.flujo.estado).toBe('MENU');
    expect(prisma.mensajeChat.create.mock.calls[0][0].data.contenido.texto).toBe(MOTIVO_REANUDADO);
  });

  it('un chat tomado por alguien que dejó de escribir se libera a los 20 min', async () => {
    const tomado = armar([conv({ tomado_por: BigInt(7), tomado_en: lima('2026-11-08T10:05:00'), ultimoPersona: null })]);
    expect(await tomado.svc.liberarVencidos(lima('2026-11-08T10:30:00'))).toBe(1);
    const reciente = armar([conv({ tomado_por: BigInt(7), tomado_en: lima('2026-11-08T10:15:00'), ultimoPersona: null })]);
    expect(await reciente.svc.liberarVencidos(lima('2026-11-08T10:30:00'))).toBe(0);
  });

  it('respeta el parámetro de minutos', async () => {
    const { svc } = armar([conv({ ultimoPersona: { en: lima('2026-11-08T10:20:00') } })], { param: 5 });
    expect(await svc.liberarVencidos(ahora)).toBe(1);
  });

  it('no libera VALIDAR_PAGO ni delivery en curso', async () => {
    const a = armar([conv({ estado: 'VALIDAR_PAGO' })]);
    expect(await a.svc.liberarVencidos(ahora)).toBe(0);
    const b = armar([conv()], { delivery: 1 });
    expect(await b.svc.liberarVencidos(ahora)).toBe(0);
    expect(b.prisma.conversacion.update).not.toHaveBeenCalled();
  });

  it('no libera si el equipo escribió hace 5 min ni si nunca intervino una persona', async () => {
    const hoy = armar([conv({ ultimoPersona: { en: lima('2026-11-08T10:25:00') } })]);
    expect(await hoy.svc.liberarVencidos(ahora)).toBe(0);
    const nadie = armar([conv({ ultimoPersona: null })]);
    expect(await nadie.svc.liberarVencidos(ahora)).toBe(0);
  });
});

jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { registerAsync: () => ({ module: class {} }) } }));
jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { EvolutionConfigService } from '../evolution/evolution-config.service';
import { iaAgotada, siguienteTurnosIa, TOPE_TURNOS_IA } from '../conversacion/escalado-ia.util';
import { construirPromptSistema } from '../ia/prompt-sistema';
import { AutorespuestaWhatsappService } from '../servicios/autorespuesta-whatsapp.service';

/** Conversación real: local cerrado, abre a las 14:00 (hora de Lima = UTC-5). */
function montar(proveedor: 'META' | 'EVOLUTION') {
  const enviados: any[] = [];
  const prisma: any = {
    parametro: {
      findMany: jest.fn(async () => [{ clave: 'whatsapp_proveedor', valor: proveedor }]),
      findUnique: jest.fn(async ({ where }: any) => (where.clave === 'chatbot_activo' ? { valor: 'si' } : null)),
    },
    pedido: { count: jest.fn(async () => 0) },
    salienteWhatsapp: {
      findFirst: jest.fn(async ({ where }: any) => {
        const desde = where.creado_en.gte as Date;
        return enviados.find((e) => e.en >= desde) ? { id: 1n } : null;
      }),
    },
    horarioDia: { findUnique: jest.fn(async () => ({ cerrado: false, abre: '09:00' })) },
  };
  const outbox: any = {
    encolar: jest.fn(async (a: any) => {
      enviados.push({ ...a, en: new Date() });
      return true;
    }),
    despertar: jest.fn(),
  };
  const local: any = {
    obtenerEstadoCarta: jest.fn(async (ahora: Date) => {
      const horaLima = (ahora.getUTCHours() + 24 - 5) % 24;
      return horaLima >= 14 ? { abierta: true, motivo: 'OK', abre: '14:00' } : { abierta: false, motivo: 'HORARIO', abre: '14:00' };
    }),
  };
  const config: any = { get: () => undefined };
  const svc = new AutorespuestaWhatsappService(prisma, outbox, {} as any, config, new EvolutionConfigService(prisma), local);
  const hablar = (texto: string) =>
    svc.atender({
      telefono: '51900000001',
      nombre: 'Usuario de WhatsApp (X)',
      texto,
      puedeProcesarMotor: true,
      conversacion: { id: 1n, flujo: { estado: 'MENU' }, estado: 'ABIERTA', duenio: 'BOT', tomado_por: null },
    });
  return { hablar, enviados };
}

describe.each(['EVOLUTION', 'META'] as const)('bot cerrado estricto (%s): conversación real del 16/11', (proveedor) => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('1er «Hola» avisa; el 2º «Hola» y «Están atendiendo?» no responden; a las 14:01 el bot atiende normal', async () => {
    const { hablar, enviados } = montar(proveedor);

    jest.setSystemTime(new Date('2026-11-16T17:09:00Z')); // 12:09 Lima
    expect(await hablar('Hola')).toBe(true);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].carga.textoLibre).toBe(
      '¡Hola! 🥰☕ Soy Capri, la asistente de Caprichos.\n¡Qué alegría tenerte por aquí! ✨ ¿En qué te ayudo hoy? 🍩\n\nAhora estamos cerrados. Abrimos hoy a las 14:00. No tomamos pedidos fuera de horario; escríbenos cuando abramos.',
    );

    jest.setSystemTime(new Date('2026-11-16T17:22:00Z')); // 12:22
    expect(await hablar('Hola')).toBe(true); // true = atendido aquí: el bot no contesta
    jest.setSystemTime(new Date('2026-11-16T17:24:00Z')); // 12:24
    expect(await hablar('Están atendiendo?')).toBe(true);
    expect(enviados).toHaveLength(1); // silencio total

    jest.setSystemTime(new Date('2026-11-16T19:01:00Z')); // 14:01 Lima, ya abrió
    expect(await hablar('Hola')).toBe(false); // lo atiende el bot con su bienvenida normal
    expect(enviados).toHaveLength(1);
  });

  it('tras un enfriamiento de 6 h y aún cerrado, repite el aviso una sola vez', async () => {
    const { hablar, enviados } = montar(proveedor);
    jest.setSystemTime(new Date('2026-11-16T05:00:00Z')); // 00:00 Lima
    await hablar('Hola');
    jest.setSystemTime(new Date('2026-11-16T11:30:00Z')); // 06:30 Lima, cerrado
    await hablar('Hola');
    await hablar('Hola otra vez');
    expect(enviados).toHaveLength(2);
    expect(enviados[1].carga.textoLibre).toContain('Abrimos hoy a las 14:00.');
  });
});

describe('IA al grano y tope de turnos', () => {
  const prompt = construirPromptSistema('Ana', true);
  it('prompt: corto, solo temas del local, una línea para lo ajeno, sin inventar y 1-2 emojis', () => {
    expect(prompt).toContain('2 a 3 líneas');
    expect(prompt).toContain('Te ayudo con pedidos, carta, horario o tu pedido 💛');
    expect(prompt).toContain('carta, precios, horario, ubicación, pedidos, pagos, estado del pedido, reservas y reclamos');
    expect(prompt).toContain('Nunca inventes datos');
    expect(prompt).toContain('uno o dos emojis como máximo');
  });
  it('tras 6 respuestas de IA seguidas deja la IA hasta que el cliente elija una opción', () => {
    let n = 0;
    for (let i = 0; i < TOPE_TURNOS_IA; i++) {
      expect(iaAgotada(n, false)).toBe(false);
      n = siguienteTurnosIa(n, false, true);
    }
    expect(iaAgotada(n, false)).toBe(true); // texto libre: menú, sin IA
    expect(iaAgotada(n, true)).toBe(false); // tocó una opción
    expect(siguienteTurnosIa(n, true, false)).toBe(0);
    expect(siguienteTurnosIa(n, false, false)).toBe(n); // menú por texto no suma
  });
});

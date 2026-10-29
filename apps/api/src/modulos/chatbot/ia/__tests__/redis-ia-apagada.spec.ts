jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { IaConsumoService } from '../ia-consumo.service';

/** Con Redis caído la IA del bot se apaga (respuestas fijas), sin lanzar, y avisa una vez por episodio. */
describe('IA del bot con Redis caído', () => {
  let prisma: any;
  let eventos: any;
  let config: any;
  let redisEstado: { ping: jest.Mock };
  let servicio: IaConsumoService;

  const reiniciar = () => {
    prisma = {
      parametro: {
        findUnique: jest.fn(async ({ where }: any) =>
          where.clave === 'chatbot_ia_activo' ? { valor: 'si' } : null,
        ),
      },
      iaConsumo: { aggregate: jest.fn().mockResolvedValue({ _sum: { costo_usd_estimado: 0 } }) },
      notificacion: { create: jest.fn(async ({ data }: any) => ({ id: 5n, ...data })) },
    };
    eventos = { emitirAdmin: jest.fn() };
    config = { get: (_k: string, d?: any) => (_k === 'OPENAI_API_KEY' ? 'sk-test' : d) };
    redisEstado = { ping: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) };
    servicio = new IaConsumoService(prisma, { obtenerCliente: () => redisEstado } as any, config, eventos);
  };

  beforeEach(() => reiniciar());

  it('con Redis caído la IA queda apagada, no lanza y no llama a OpenAI', async () => {
    const estado = await servicio.puedeUsarIa();
    expect(estado.permitido).toBe(false);
    expect(estado.motivo).toContain('Redis no responde');
  });

  it('avisa a administradores una sola vez por episodio (aunque se consulte varias veces)', async () => {
    await servicio.puedeUsarIa();
    await servicio.puedeUsarIa();
    await new Promise((r) => setTimeout(r, 0));
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(1);
    expect(prisma.notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: 'REDIS_CAIDO', rol_destino: 'ADMIN' }),
    });
  });

  it('el PING se cachea 10 s: no vuelve a preguntar a Redis en ese plazo', async () => {
    await servicio.redisDisponible();
    await servicio.redisDisponible();
    expect(redisEstado.ping).toHaveBeenCalledTimes(1);
  });

  it('al recuperarse Redis la IA vuelve y se avisa la recuperación una vez', async () => {
    await servicio.puedeUsarIa();
    redisEstado.ping.mockResolvedValue('PONG');
    (servicio as any).redisCache = null; // pasan los 10 s de caché

    const estado = await servicio.puedeUsarIa();
    await new Promise((r) => setTimeout(r, 0));

    expect(estado.permitido).toBe(true);
    const tipos = prisma.notificacion.create.mock.calls.map((c: any[]) => c[0].data.tipo);
    expect(tipos).toEqual(['REDIS_CAIDO', 'REDIS_RECUPERADO']);
  });

  it('un PING que no responde a tiempo cuenta como Redis caído (sin colgar la petición)', async () => {
    jest.useFakeTimers();
    redisEstado.ping.mockReturnValue(new Promise(() => {}));
    const pendiente = servicio.redisDisponible();
    jest.advanceTimersByTime(1600);
    await expect(pendiente).resolves.toBe(false);
    jest.useRealTimers();
  });
});

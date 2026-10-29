import { BadRequestException } from '@nestjs/common';
import { ChatbotConfiguracionService, MOTIVO_BLOQUEO_SPAM } from '../chatbot-configuracion.service';

const TEL = '51987654321';
const CLAVE_BLOQUEO = `chatbot:spam:bloqueo:${encodeURIComponent(TEL)}`;
const CLAVE_REINC = `chatbot:spam:reinc:${encodeURIComponent(TEL)}`;

/** Redis en memoria: lo justo para el anti-spam (incr, expire, get, set, exists, del). */
function crearRedis() {
  const datos = new Map<string, string>();
  const redis = {
    datos,
    incr: jest.fn(async (k: string) => {
      const n = Number(datos.get(k) ?? 0) + 1;
      datos.set(k, String(n));
      return n;
    }),
    expire: jest.fn(async () => 1),
    get: jest.fn(async (k: string) => datos.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => {
      datos.set(k, v);
      return 'OK';
    }),
    exists: jest.fn(async (k: string) => (datos.has(k) ? 1 : 0)),
    del: jest.fn(async (...ks: string[]) => {
      ks.forEach((k) => datos.delete(k));
      return ks.length;
    }),
  };
  return redis;
}

describe('Anti-spam: bloqueo por reincidencia y desbloqueo', () => {
  let servicio: ChatbotConfiguracionService;
  let redis: ReturnType<typeof crearRedis>;
  let prisma: any;
  let auditoria: any;

  /** Pasa el límite por minuto (10) y devuelve la respuesta del último mensaje. */
  const enviarExcesos = async (n: number) => {
    let r: any;
    for (let i = 0; i < n; i++) r = await servicio.verificarAntiSpam(TEL);
    return r;
  };

  beforeEach(() => {
    redis = crearRedis();
    prisma = {
      parametro: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
      conversacion: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 42n, nombre_contacto: 'Ana', motivo_derivacion: null }),
        update: jest.fn().mockResolvedValue({}),
      },
      pedido: { count: jest.fn().mockResolvedValue(0) },
      notificacion: { create: jest.fn(async ({ data }: any) => ({ id: 1n, ...data })) },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const redisService = { obtenerCliente: () => redis } as any;
    servicio = new ChatbotConfiguracionService(prisma, redisService, auditoria);
  });

  it('tercer exceso en la hora: bloqueo de 1 hora (3600 s) y notificación una vez', async () => {
    await enviarExcesos(12); // 10 permitidos por minuto; los excesos 1 y 2 solo avisan o callan
    const resultado = await servicio.verificarAntiSpam(TEL); // exceso 3

    expect(resultado).toMatchObject({ permitido: false, bloqueado: true });
    expect(redis.set).toHaveBeenCalledWith(CLAVE_BLOQUEO, '1', 'EX', 3600);
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(1);
    expect(prisma.notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: 'CHAT_BLOQUEADO_SPAM', enlace: `/admin/mensajes?telefono=${TEL}` }),
    });
    expect(prisma.conversacion.updateMany).toHaveBeenCalledWith({
      where: { telefono: TEL },
      data: { motivo_derivacion: MOTIVO_BLOQUEO_SPAM },
    });
  });

  it('durante el bloqueo hay silencio total y no se cuenta ni se notifica de nuevo', async () => {
    await enviarExcesos(13);
    const llamadasAntes = redis.incr.mock.calls.length;

    const r = await servicio.verificarAntiSpam(TEL);

    expect(r).toEqual({ permitido: false, enviarAvisoSpam: false, bloqueado: true });
    expect(redis.incr.mock.calls.length).toBe(llamadasAntes);
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(1);
  });

  it('reincidencia dentro de las 24 h del bloqueo anterior: bloqueo de 24 horas (86400 s)', async () => {
    redis.datos.set(CLAVE_REINC, '1'); // bloqueo previo vigente
    await enviarExcesos(13);

    expect(redis.set).toHaveBeenCalledWith(CLAVE_BLOQUEO, '1', 'EX', 86400);
    expect(prisma.notificacion.create.mock.calls[0][0].data.mensaje).toContain('reincidencia');
  });

  it('los minutos salen de parámetros configurables', async () => {
    prisma.parametro.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.clave === 'spam_bloqueo_min') return { valor: '15' };
      if (where.clave === 'spam_bloqueo_excesos') return { valor: 2 };
      return null;
    });
    await enviarExcesos(12); // exceso 2 ya bloquea

    expect(redis.set).toHaveBeenCalledWith(CLAVE_BLOQUEO, '1', 'EX', 900);
  });

  it('desbloqueo manual: quita el bloqueo y los contadores, limpia la marca y audita', async () => {
    await enviarExcesos(13);
    prisma.conversacion.findUnique.mockResolvedValueOnce({ id: 42n, telefono: TEL, motivo_derivacion: MOTIVO_BLOQUEO_SPAM });

    const r = await servicio.desbloquearSpam(42n, 'Era un cliente real, confirmado', { partyId: 1n, rol: 'ADMIN', debeCambiar: false } as any);

    expect(r).toEqual({ ok: true });
    expect(redis.datos.has(CLAVE_BLOQUEO)).toBe(false);
    expect(prisma.conversacion.update).toHaveBeenCalledWith({ where: { id: 42n }, data: { motivo_derivacion: null } });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'DESBLOQUEAR_SPAM', modulo: 'mensajes' }));
    expect(await servicio.verificarAntiSpam(TEL)).toEqual({ permitido: true, enviarAvisoSpam: false });
  });

  it('desbloqueo sin motivo suficiente se rechaza', async () => {
    await expect(
      servicio.desbloquearSpam(42n, 'ok', { partyId: 1n, rol: 'ADMIN', debeCambiar: false } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('si Redis falla, deja pasar (fail-open) sin lanzar', async () => {
    const roto = new ChatbotConfiguracionService(
      prisma,
      { obtenerCliente: () => { throw new Error('ECONNREFUSED'); } } as any,
      auditoria,
    );
    await expect(roto.verificarAntiSpam(TEL)).resolves.toEqual({ permitido: true, enviarAvisoSpam: false });
  });
});

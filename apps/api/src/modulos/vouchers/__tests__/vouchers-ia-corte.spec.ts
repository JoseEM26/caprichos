jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VouchersIaService, MOTIVO_PAUSA_IA, MOTIVO_TOPE_IA } from '../vouchers-ia.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { IaConsumoService } from '../../chatbot/ia/ia-consumo.service';
import { AvisosInternosService } from '../../chatbot/avisos-internos/avisos-internos.service';
import { clasificarExcepcionIa, clasificarFalloOpenAI, ErrorOpenAI } from '../vouchers-ia-corte.util';

const RESPUESTA_OK = {
  ok: true,
  json: async () => ({
    choices: [{ message: { content: JSON.stringify({ legible: true, monto: 10, confianza: 0.9 }) } }],
    usage: { prompt_tokens: 1, completion_tokens: 1 },
  }),
};

const respuestaError = (status: number, cuerpo = '{"error":{"message":"x"}}') => ({
  ok: false,
  status,
  text: async () => cuerpo,
});

const SALDO = respuestaError(429, '{"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}');
const CLAVE = respuestaError(401, '{"error":{"message":"Incorrect API key provided"}}');

const BUFFER = Buffer.from('imagen-de-prueba');

/** Redis falso con estado real: TTL según Date.now, SET NX, INCR y DEL. */
const crearRedisFalso = () => {
  const datos = new Map<string, { v: string; exp?: number }>();
  const vivo = (k: string) => {
    const e = datos.get(k);
    if (!e) return undefined;
    if (e.exp !== undefined && Date.now() >= e.exp) {
      datos.delete(k);
      return undefined;
    }
    return e;
  };
  return {
    get: jest.fn(async (k: string) => vivo(k)?.v ?? null),
    set: jest.fn(async (k: string, v: string, ...args: any[]) => {
      if (args.includes('NX') && vivo(k)) return null;
      const i = args.indexOf('EX');
      datos.set(k, { v: String(v), exp: i >= 0 ? Date.now() + Number(args[i + 1]) * 1000 : undefined });
      return 'OK';
    }),
    incr: jest.fn(async (k: string) => {
      const previo = vivo(k);
      const n = Number(previo?.v ?? 0) + 1;
      datos.set(k, { v: String(n), exp: previo?.exp });
      return n;
    }),
    del: jest.fn(async (k: string) => (vivo(k) ? (datos.delete(k), 1) : 0)),
    expire: jest.fn(async () => 1),
  };
};

describe('clasificarFalloOpenAI', () => {
  it('clasifica clave, saldo, errores y límite normal', () => {
    expect(clasificarFalloOpenAI(401, 'bad key')).toBe('CLAVE');
    expect(clasificarFalloOpenAI(403, 'forbidden')).toBe('CLAVE');
    expect(clasificarFalloOpenAI(402, '')).toBe('SALDO');
    expect(clasificarFalloOpenAI(429, '{"code":"insufficient_quota"}')).toBe('SALDO');
    expect(clasificarFalloOpenAI(429, 'Rate limit reached for gpt-4o-mini')).toBe('NO_CUENTA');
    expect(clasificarFalloOpenAI(500, '')).toBe('ERROR');
    expect(clasificarFalloOpenAI(503, '')).toBe('ERROR');
    expect(clasificarFalloOpenAI(400, 'bad request')).toBe('NO_CUENTA');
  });

  it('red o timeout cuentan como ERROR y JSON inválido no cuenta', () => {
    expect(clasificarExcepcionIa(new Error('fetch failed'))).toBe('ERROR');
    expect(clasificarExcepcionIa(new ErrorOpenAI(502, ''))).toBe('ERROR');
    expect(clasificarExcepcionIa(new SyntaxError('Unexpected token'))).toBe('NO_CUENTA');
  });
});

describe('VouchersIaService: corte, tope y avisos', () => {
  let service: VouchersIaService;
  let prismaMock: any;
  let redisMock: any;
  let iaConsumoMock: any;
  let avisosMock: any;
  let fetchMock: jest.Mock;
  let fetchOriginal: any;
  let ahora: number;
  let corteMin: number;
  let costoMes: number;

  const crear = async (redisRoto = false) => {
    if (redisRoto) {
      redisMock.obtenerCliente.mockImplementation(() => {
        throw new Error('Redis caído');
      });
    }
    const modulo = await Test.createTestingModule({
      providers: [
        VouchersIaService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: IaConsumoService, useValue: iaConsumoMock },
        { provide: AvisosInternosService, useValue: avisosMock },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string, def?: any) => (k === 'OPENAI_API_KEY' ? 'clave-de-prueba' : def),
          },
        },
      ],
    }).compile();
    return modulo.get(VouchersIaService);
  };

  const notificaciones = (tipo: string) =>
    prismaMock.notificacion.create.mock.calls.filter((c: any[]) => c[0].data.tipo === tipo);

  beforeEach(() => {
    fetchOriginal = global.fetch;
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    ahora = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => ahora);
    corteMin = 10;
    costoMes = 0;

    prismaMock = {
      parametro: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.clave === 'voucher_ia_activo') return { clave: where.clave, valor: true };
          if (where.clave === 'voucher_ia_corte_min') return { clave: where.clave, valor: corteMin };
          return null;
        }),
      },
      iaConsumo: {
        aggregate: jest.fn(async () => ({
          _count: { id: 1 },
          _sum: { tokens_entrada: 1, tokens_salida: 1, costo_usd_estimado: costoMes },
        })),
      },
      notificacion: { create: jest.fn().mockResolvedValue({ id: 7n }) },
    };
    redisMock = {
      obtenerCliente: jest.fn().mockReturnValue(crearRedisFalso()),
    };
    iaConsumoMock = {
      registrarConsumo: jest.fn().mockResolvedValue(0),
      obtenerTopeMensualUsd: jest.fn().mockResolvedValue(20),
    };
    avisosMock = { enviarAvisoAdmin: jest.fn().mockResolvedValue({ omitido: true }) };
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.restoreAllMocks();
  });

  it('se abre a los 3 fallos de saldo: la cuarta lectura no llama a OpenAI', async () => {
    const service = await crear();
    fetchMock.mockResolvedValue(SALDO);

    for (let i = 0; i < 3; i++) {
      const r = await service.analizarVoucher(BUFFER, 'image/jpeg');
      expect(r.sinLectura).toBe(true);
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const cuarta = await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(cuarta).toEqual({ sinLectura: true, extraido: null, motivo: MOTIVO_PAUSA_IA });
    expect(MOTIVO_PAUSA_IA).toBe('Lectura de IA en pausa por saldo o clave; revisión visual requerida');
  });

  it('un 429 de límite normal no abre el corte', async () => {
    const service = await crear();
    fetchMock.mockResolvedValue(respuestaError(429, 'Rate limit reached for gpt-4o-mini'));

    for (let i = 0; i < 6; i++) await service.analizarVoucher(BUFFER, 'image/jpeg');

    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('cinco errores 5xx seguidos abren el corte y tres no', async () => {
    const service = await crear();
    fetchMock.mockResolvedValue(respuestaError(503));

    for (let i = 0; i < 4; i++) await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(fetchMock).toHaveBeenCalledTimes(4);

    await service.analizarVoucher(BUFFER, 'image/jpeg');
    await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('un éxito reinicia el contador de fallos', async () => {
    const service = await crear();
    fetchMock
      .mockResolvedValueOnce(SALDO)
      .mockResolvedValueOnce(SALDO)
      .mockResolvedValueOnce(RESPUESTA_OK)
      .mockResolvedValueOnce(SALDO)
      .mockResolvedValueOnce(SALDO);

    for (let i = 0; i < 5; i++) await service.analizarVoucher(BUFFER, 'image/jpeg');

    // 2 fallos, un éxito, 2 fallos: nunca llega a 3 seguidos
    fetchMock.mockResolvedValue(SALDO);
    const r = await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(r.motivo).not.toBe(MOTIVO_PAUSA_IA);
  });

  it('vencido el corte, una sola lectura es la prueba: si funciona, cierra y reinicia', async () => {
    const service = await crear();
    fetchMock.mockResolvedValue(CLAVE);
    for (let i = 0; i < 3; i++) await service.analizarVoucher(BUFFER, 'image/jpeg');

    ahora += 10 * 60_000 + 1;
    fetchMock.mockResolvedValue(RESPUESTA_OK);
    const prueba = await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(prueba.sinLectura).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('si la prueba falla, el corte se reabre', async () => {
    const service = await crear();
    fetchMock.mockResolvedValue(SALDO);
    for (let i = 0; i < 3; i++) await service.analizarVoucher(BUFFER, 'image/jpeg');

    ahora += 10 * 60_000 + 1;
    await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const siguiente = await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(siguiente.motivo).toBe(MOTIVO_PAUSA_IA);
  });

  it('en la prueba solo una lectura sale a OpenAI mientras otra espera', async () => {
    const service = await crear();
    fetchMock.mockResolvedValue(SALDO);
    for (let i = 0; i < 3; i++) await service.analizarVoucher(BUFFER, 'image/jpeg');

    ahora += 10 * 60_000 + 1;
    let liberarPrueba: (v: any) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise((r) => (liberarPrueba = r)));

    const primera = service.analizarVoucher(BUFFER, 'image/jpeg');
    // Esperar a que la primera tome la prueba y salga a OpenAI
    while (fetchMock.mock.calls.length < 4) await new Promise((r) => setImmediate(r));
    const segunda = await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(segunda.motivo).toBe(MOTIVO_PAUSA_IA);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    liberarPrueba(RESPUESTA_OK);
    expect((await primera).sinLectura).toBe(false);
  });

  it('avisa una sola vez al abrir y una sola vez al recuperarse', async () => {
    const service = await crear();
    fetchMock.mockResolvedValue(SALDO);
    for (let i = 0; i < 3; i++) await service.analizarVoucher(BUFFER, 'image/jpeg');

    // La prueba falla y reabre: no es un episodio nuevo
    ahora += 10 * 60_000 + 1;
    await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(notificaciones('VOUCHER_IA_CAIDA')).toHaveLength(1);

    const caida = notificaciones('VOUCHER_IA_CAIDA')[0][0].data;
    expect(caida).toMatchObject({
      rol_destino: 'ADMIN',
      titulo: 'Lectura de vouchers con IA en pausa',
      mensaje: 'Sin saldo o clave inválida en OpenAI. Los vouchers se guardan y Caja los revisa a mano.',
      enlace: '/admin/configuracion',
    });
    expect(avisosMock.enviarAvisoAdmin).toHaveBeenCalledTimes(1);
    expect(avisosMock.enviarAvisoAdmin.mock.calls[0][5]).toEqual({ sinCampana: true });

    // Recupera: una notificación de recuperación
    ahora += 10 * 60_000 + 1;
    fetchMock.mockResolvedValue(RESPUESTA_OK);
    await service.analizarVoucher(BUFFER, 'image/jpeg');
    await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(notificaciones('VOUCHER_IA_RECUPERADA')).toHaveLength(1);
    expect(notificaciones('VOUCHER_IA_CAIDA')).toHaveLength(1);
  });

  it('con el tope mensual de vouchers alcanzado no llama a OpenAI y avisa una vez por mes', async () => {
    const service = await crear();
    fetchMock.mockResolvedValue(RESPUESTA_OK);
    costoMes = 25;

    const r1 = await service.analizarVoucher(BUFFER, 'image/jpeg');
    const r2 = await service.analizarVoucher(BUFFER, 'image/jpeg');

    expect(r1).toEqual({ sinLectura: true, extraido: null, motivo: MOTIVO_TOPE_IA });
    expect(r2.motivo).toBe(MOTIVO_TOPE_IA);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(notificaciones('VOUCHER_IA_TOPE')).toHaveLength(1);
  });

  it('bajo el tope, la lectura funciona normal', async () => {
    const service = await crear();
    fetchMock.mockResolvedValue(RESPUESTA_OK);
    costoMes = 3;

    const r = await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(r.sinLectura).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sin Redis no lanza: el corte sigue funcionando en memoria del proceso', async () => {
    const service = await crear(true);
    fetchMock.mockResolvedValue(SALDO);

    await expect(service.analizarVoucher(BUFFER, 'image/jpeg')).resolves.toBeDefined();
    await service.analizarVoucher(BUFFER, 'image/jpeg');
    await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const cuarta = await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(cuarta.motivo).toBe(MOTIVO_PAUSA_IA);
  });

  it('el voucher no se propaga como error aunque OpenAI caiga por completo', async () => {
    const service = await crear();
    fetchMock.mockRejectedValue(new Error('network down'));

    const r = await service.analizarVoucher(BUFFER, 'image/jpeg');
    expect(r.sinLectura).toBe(true);
    expect(r.extraido).toBeNull();
  });

  it('estadoIa refleja pausa, causa, hasta y tope mensual', async () => {
    const service = await crear();
    fetchMock.mockResolvedValue(CLAVE);
    costoMes = 4;

    const antes = await service.estadoIa();
    expect(antes).toEqual({
      activa: true,
      enPausa: false,
      causa: null,
      hastaEn: null,
      topeMensual: { usadoUsd: 4, topeUsd: 20, superado: false },
    });

    for (let i = 0; i < 3; i++) await service.analizarVoucher(BUFFER, 'image/jpeg');
    const despues = await service.estadoIa();
    expect(despues.enPausa).toBe(true);
    expect(despues.causa).toBe('CLAVE');
    expect(despues.hastaEn).toBe(new Date(ahora + 10 * 60_000).toISOString());
  });
});

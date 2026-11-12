jest.mock('../chatbot', () => ({ ChatbotIaService: class {}, ConocimientoBotService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { AprendizajesHistoricoService } from './aprendizajes-historico.service';
import { AprendizajesNocheService } from './aprendizajes-noche.service';
import { chatFalso, crearPrisma, crearRedis } from './prueba-util';

const DIAS = ['2027-01-10', '2027-01-11', '2027-01-12'];
const prop = (intencion: string, evidencia: number[]) => ({ tipo: 'FAQ', intencion, pregunta: 'p', respuesta: 'r', frases: [], evidencia });

function crearIa(tokensSalida = 100, porLote: () => unknown[] = () => []) {
  return {
    tieneApiKey: () => true,
    completarJson: jest.fn(async (m: any[]) => {
      const n = (m[1].content.match(/^\[\d+\]/gm) ?? []).length;
      const texto = (m[0].content as string).startsWith('Clasificas')
        ? JSON.stringify({ temas: Array.from({ length: n }, (_, i) => ({ i, tema: 'VENTA' })) })
        : JSON.stringify({ propuestas: porLote() });
      return { texto, tokensEntrada: 0, tokensSalida };
    }),
  } as any;
}

const armar = (ia: any, parametros: any = {}) => {
  const chats = [1, 2].map((i) => chatFalso(i, [['CLIENTE', 'hola'], ['PERSONA', 'hola']]));
  const prisma = crearPrisma({ chats, dias: DIAS, parametros });
  const redis = crearRedis();
  const noche = new AprendizajesNocheService(prisma, redis, ia);
  return { prisma, redis, noche, hist: new AprendizajesHistoricoService(prisma, redis, noche) };
};
const lanzar = async (h: AprendizajesHistoricoService, redis: any) => {
  await redis.obtenerCliente().set('lock:aprendizajes:noche', 't', 'PX', 1, 'NX');
  return h.correr({ token: 't', fallback: false });
};

describe('AprendizajesHistoricoService', () => {
  it('recorre todos los días con chats y queda OK; resumen NUNCA antes de correr', async () => {
    const { hist, prisma, redis } = armar(crearIa());
    expect((await hist.resumen()).estado).toBe('NUNCA');
    const r = await lanzar(hist, redis);
    expect(prisma._noches.map((n: any) => n.fecha.toISOString().slice(0, 10))).toEqual(DIAS);
    expect(r).toMatchObject({ estado: 'OK', diasProcesados: 3, diasTotales: 3 });
    expect(redis._claves.size).toBe(0); // soltó el candado
  });

  it('el umbral de repeticiones suma sobre todo el historial y avisa una sola vez al final', async () => {
    let dia = 0;
    // cada día aporta 1 prueba de la misma intención: al tercer día llega al mínimo (3)
    const { hist, prisma, redis } = armar(crearIa(100, () => (dia++, [prop('delivery', [0])])));
    // evidencia con ids distintos por día
    prisma.conversacion.findMany.mockImplementation(async () => [chatFalso(100 + dia, [['CLIENTE', 'delivery?'], ['PERSONA', 'si']])]);
    await lanzar(hist, redis);
    const delivery = prisma._props.find((p: any) => p.intencion === 'delivery');
    expect(delivery.repeticiones).toBe(3);
    expect(prisma._notifs).toHaveLength(1);
    expect(prisma._notifs[0].titulo).toBe('1 propuesta nueva para revisar');
  });

  it('respeta el tope total: para en TOPE y deja los días siguientes pendientes', async () => {
    // cada llamada gasta 0.6 (1M tokens de salida); tope total 1.0: el primer día gasta 0.6 y el segundo no cabe
    const { hist, prisma, redis } = armar(crearIa(1_000_000), { aprendizaje_tope_usd_historico: '1' });
    const r = await lanzar(hist, redis);
    expect(r.estado).toBe('TOPE');
    expect(r.diasProcesados).toBeLessThan(3);
    expect(prisma._noches.length).toBeLessThan(3);
    // otro día: los días OK no se repiten y se sigue con los pendientes
    const ia2 = crearIa();
    const noche2 = new AprendizajesNocheService(prisma, redis, ia2);
    const r2 = await lanzar(new AprendizajesHistoricoService(prisma, redis, noche2), redis);
    expect(r2).toMatchObject({ estado: 'OK', diasProcesados: 3 });
  });

  it('es idempotente: con todas las noches OK no llama a la IA', async () => {
    const ia = crearIa();
    const { hist, redis } = armar(ia);
    await lanzar(hist, redis);
    const n = ia.completarJson.mock.calls.length;
    await lanzar(hist, redis);
    expect(ia.completarJson.mock.calls.length).toBe(n);
  });

  it('no corre a la vez que el nocturno ni dos veces', async () => {
    const { hist, redis } = armar(crearIa());
    redis._claves.add('lock:aprendizajes:noche'); // el nocturno tiene el candado
    await expect(hist.ejecutar()).rejects.toMatchObject({ response: { codigo: 'APRENDIZAJE_OCUPADO' } });
    redis._claves.clear();
    await hist.ejecutar(); // arranca en segundo plano y toma el candado
    expect(redis._claves.has('lock:aprendizajes:noche') || (await hist.resumen()).estado !== 'EN_CURSO').toBe(true);
  });

  it('la petición no espera al trabajo: responde EN_CURSO y luego termina', async () => {
    const { hist, redis } = armar(crearIa());
    const r = await hist.ejecutar();
    expect(r.estado).toBe('EN_CURSO');
    await new Promise((res) => setTimeout(res, 50));
    expect((await hist.resumen()).estado).toBe('OK');
    expect(redis._claves.size).toBe(0);
  });
});

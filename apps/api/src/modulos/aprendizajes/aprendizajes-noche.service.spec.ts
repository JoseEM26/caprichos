jest.mock('../chatbot', () => ({ ChatbotIaService: class {}, ConocimientoBotService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { AprendizajesNocheService } from './aprendizajes-noche.service';
import { chatFalso, crearPrisma, crearRedis } from './prueba-util';

const FECHA = '2027-03-01';
const prop = (intencion: string, evidencia: number[], extra: any = {}) => ({
  tipo: 'FAQ', intencion, pregunta: `¿${intencion}?`, respuesta: 'Con gusto te ayudo.', frases: [], evidencia, ...extra,
});

/** IA de mentira: el paso 1 marca todo como VENTA; el paso 2 devuelve lo que se le indique. */
function crearIa(propuestas: (n: number) => unknown, tokens = { e: 1000, s: 200 }) {
  return {
    tieneApiKey: jest.fn(() => true),
    completarJson: jest.fn(async (m: any[]) => {
      const sistema = m[0].content as string;
      const n = (m[1].content.match(/^\[\d+\]/gm) ?? []).length;
      const texto = sistema.startsWith('Clasificas')
        ? JSON.stringify({ temas: Array.from({ length: n }, (_, i) => ({ i, tema: 'VENTA' })) })
        : typeof propuestas(n) === 'string' ? (propuestas(n) as string) : JSON.stringify({ propuestas: propuestas(n) });
      return { texto, tokensEntrada: tokens.e, tokensSalida: tokens.s };
    }),
  } as any;
}

const armar = (ia: any, chats: any[], parametros: any = {}) => {
  const prisma = crearPrisma({ chats, parametros });
  const redis = crearRedis();
  return { prisma, redis, svc: new AprendizajesNocheService(prisma, redis, ia) };
};
const cuatroChats = () => [1, 2, 3, 4].map((i) => chatFalso(i, [['CLIENTE', 'precio de la torta'], ['PERSONA', 'cuesta S/ 40']]));

describe('AprendizajesNocheService', () => {
  it('sin OpenAI configurado la noche queda SIN_IA y no llama a nada', async () => {
    const ia = crearIa(() => []);
    ia.tieneApiKey.mockReturnValue(false);
    const { svc, prisma } = armar(ia, cuatroChats());
    const r = await svc.ejecutarNoche(FECHA);
    expect(r.estado).toBe('SIN_IA');
    expect(ia.completarJson).not.toHaveBeenCalled();
    expect(prisma._noches).toHaveLength(1);
  });

  it('lee chats anonimizados: nada personal llega a la IA', async () => {
    const ia = crearIa(() => []);
    const chats = [chatFalso(1, [['CLIENTE', 'soy Rosa, mi cel 987654321, vivo en Av. Lima 123'], ['PERSONA', 'ok Rosa']])];
    const { svc } = armar(ia, chats);
    await svc.ejecutarNoche(FECHA);
    const enviado = ia.completarJson.mock.calls.map((c: any) => c[0][1].content).join('\n');
    expect(enviado).toContain('<NOMBRE>');
    expect(enviado).toContain('<CEL>');
    expect(enviado).toContain('<DIR>');
    expect(enviado).not.toMatch(/Rosa|987654321|Lima 123/);
  });

  it('selecciona chats atendidos con mensaje de persona del día (consulta)', async () => {
    const { svc, prisma } = armar(crearIa(() => []), []);
    await svc.cargarChats(FECHA);
    const where = prisma.conversacion.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ estado: 'ATENDIDA' }, { atendido_en: { not: null } }]);
    expect(where.mensajes.some).toMatchObject({ autor: 'PERSONA', direccion: 'SALE' });
    expect(where.mensajes.some.en.gte.toISOString()).toBe('2027-03-01T05:00:00.000Z');
  });

  it('descarta lo FUERA de tema y lo cuenta', async () => {
    const ia = crearIa(() => []);
    ia.completarJson.mockImplementationOnce(async () => ({ texto: JSON.stringify({ temas: [{ i: 0, tema: 'VENTA' }, { i: 1, tema: 'FUERA' }] }), tokensEntrada: 10, tokensSalida: 5 }));
    const { svc } = armar(ia, cuatroChats().slice(0, 2));
    const r = await svc.ejecutarNoche(FECHA);
    expect(r.descartadosFueraTema).toBe(1);
    expect(r.chatsLeidos).toBe(2);
  });

  it('descarta el JSON inválido y registra cuántos', async () => {
    const { svc, prisma } = armar(crearIa(() => [{ tipo: 'XX', intencion: 'a' }, prop('horario', [0, 1, 2]), prop('sin_evidencia', [])]), cuatroChats());
    const r = await svc.ejecutarNoche(FECHA);
    expect(r.estado).toBe('OK');
    expect(prisma._props).toHaveLength(1);
    expect(prisma._noches[0].error).toMatch(/2 respuesta/);
    const roto = armar(crearIa(() => 'esto no es json'), cuatroChats());
    expect((await roto.svc.ejecutarNoche(FECHA)).propuestas).toBe(0);
  });

  it('agrupa por intención dentro de la noche y exige el mínimo de repeticiones', async () => {
    // lote de 15: todos los chats caen en el mismo lote → una propuesta con 3 pruebas llega; otra con 2 queda en observación
    const { svc, prisma } = armar(crearIa(() => [prop('precio_torta', [0, 1, 2]), prop('delivery', [0, 3])]), cuatroChats());
    const r = await svc.ejecutarNoche(FECHA);
    expect(r.propuestas).toBe(1);
    expect(prisma._props.map((p: any) => [p.intencion, p.repeticiones])).toEqual([['precio_torta', 3], ['delivery', 2]]);
    expect(prisma._notifs).toHaveLength(1);
    expect(prisma._notifs[0]).toMatchObject({ rol_destino: 'ADMIN', enlace: '/admin/aprendizajes', tipo: 'APRENDIZAJES_PROPUESTAS' });
    expect(prisma._notifs[0].titulo).toBe('1 propuesta nueva para revisar');
  });

  it('suma a una PENDIENTE previa de la misma intención en vez de duplicar', async () => {
    const { svc, prisma } = armar(crearIa(() => [prop('Delivery', [2, 3])]), cuatroChats());
    prisma._props.push({
      id: 99n, estado: 'PENDIENTE', creado_en: new Date(), intencion: 'delivery', repeticiones: 2,
      evidencia: [{ conversacionId: '7', extracto: 'x' }, { conversacionId: '8', extracto: 'y' }],
    });
    const r = await svc.ejecutarNoche(FECHA);
    expect(prisma._props).toHaveLength(1);
    expect(prisma._props[0].repeticiones).toBe(4);
    expect(r.propuestas).toBe(0 + 1); // cruzó el mínimo (2 → 4) esta noche
  });

  it('no propone lo que ya está vigente', async () => {
    const { svc, prisma } = armar(crearIa(() => [prop('horario', [0, 1, 2])]), cuatroChats());
    prisma._conocimientos.push({ id: 1n, version: 1, estado: 'VIGENTE', intencion: 'Horario' });
    await svc.ejecutarNoche(FECHA);
    expect(prisma._props).toHaveLength(0);
  });

  it('para en TOPE cuando el gasto superaría el tope de la noche y guarda el estado', async () => {
    // 1.000.000 tokens de salida por llamada a US$0.60 = 0.60; el tope de 0.5 se cruza en la 2.ª llamada
    const ia = crearIa(() => [], { e: 0, s: 1_000_000 });
    const { svc, prisma } = armar(ia, cuatroChats(), { aprendizaje_tope_usd_noche: '0.5' });
    const r = await svc.ejecutarNoche(FECHA);
    expect(r.estado).toBe('TOPE');
    expect(ia.completarJson).toHaveBeenCalledTimes(1);
    expect(r.usd).toBeCloseTo(0.6, 4);
    expect(prisma._noches[0].terminado_en).toBeInstanceOf(Date);
  });

  it('el tope por defecto es 3 y el gasto usa las tarifas de los parámetros', async () => {
    const { svc } = armar(crearIa(() => []), []);
    expect(await svc.parametros()).toMatchObject({ topeUsd: 3, hora: 3, minRepeticiones: 3, usdEntrada: 0.15, usdSalida: 0.6, topeHistoricoUsd: 10 });
  });

  it('es idempotente por fecha: una noche OK no se repite; ERROR sí', async () => {
    const ia = crearIa(() => []);
    const { svc, prisma } = armar(ia, cuatroChats());
    await svc.ejecutarNoche(FECHA);
    const llamadas = ia.completarJson.mock.calls.length;
    await svc.ejecutarNoche(FECHA);
    expect(ia.completarJson.mock.calls.length).toBe(llamadas);
    prisma._noches[0].estado = 'ERROR';
    await svc.ejecutarNoche(FECHA);
    expect(ia.completarJson.mock.calls.length).toBeGreaterThan(llamadas);
    expect(prisma._noches).toHaveLength(1);
  });

  it('si OpenAI falla la noche queda en ERROR con el motivo', async () => {
    const ia = crearIa(() => []);
    ia.completarJson.mockRejectedValue(new Error('OpenAI API error [500]'));
    const { svc } = armar(ia, cuatroChats());
    const r = await svc.ejecutarNoche(FECHA);
    expect(r.estado).toBe('ERROR');
  });

  it('no corre si otra copia tiene el candado', async () => {
    const ia = crearIa(() => []);
    const { svc, redis } = armar(ia, cuatroChats());
    redis._claves.add('lock:aprendizajes:noche');
    await expect(svc.ejecutarNoche(FECHA)).rejects.toThrow(/Otra copia/);
    expect(ia.completarJson).not.toHaveBeenCalled();
  });
});

jest.mock('../acceso/acceso.guard', () => ({ AccesoGuard: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('./aprendizajes.service', () => ({ AprendizajesService: class {} }));
jest.mock('../chatbot', () => ({
  ChatbotIaService: class {}, IaConsumoService: class {},
  conUrlCarta: (p: string, u?: string) => p.split('{{URL_CARTA}}').join(u || 'https://caprichos.pe'),
  urlPublicaCarta: (g: (k: string) => string | undefined) => g('CARTA_URL_PUBLICA') ?? '',
}));

import { AprendizajesMejorarService, MAX_MEJORAS_POR_HORA, ORIGEN_MEJORAR } from './aprendizajes-mejorar.service';
import { AprendizajesController } from './aprendizajes.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';

const armar = (salida: unknown = { respuesta: '¡Hola! 🥰 Mira la carta 👉 https://carta.test 🍩✨' }, conClave = true) => {
  const ia = {
    tieneApiKey: () => conClave, obtenerModelo: () => 'gpt-test',
    completarJson: jest.fn(async () => ({ texto: typeof salida === 'string' ? salida : JSON.stringify(salida), tokensEntrada: 100, tokensSalida: 40 })),
  };
  const consumo = { registrarConsumo: jest.fn(async () => 0) };
  const contador = new Map<string, number>();
  const redis = { obtenerCliente: () => ({ incr: async (k: string) => { contador.set(k, (contador.get(k) ?? 0) + 1); return contador.get(k)!; }, expire: async () => 1 }) };
  const config = { get: (k: string) => (k === 'CARTA_URL_PUBLICA' ? 'https://carta.test' : undefined) };
  const svc = new AprendizajesMejorarService(ia as any, consumo as any, redis as any, config as any);
  return { svc, ia, consumo };
};

describe('AprendizajesMejorarService', () => {
  it('devuelve la respuesta, con la URL de la carta en el prompt y consumo registrado', async () => {
    const { svc, ia, consumo } = armar();
    const r = await svc.mejorar({ pregunta: '¿Tienen carta?', respuesta: 'Sí, está en la web.', tipo: 'DERIVAR' }, 1n);
    expect(r).toEqual({ respuesta: expect.stringContaining('https://carta.test') });
    const [mensajes] = (ia.completarJson as jest.Mock).mock.calls[0];
    expect(mensajes[0].content).toContain('https://carta.test');
    expect(mensajes[0].content).toMatch(/NUNCA inventes/);
    expect(mensajes[1].content).toContain('Sí, está en la web.');
    expect(consumo.registrarConsumo).toHaveBeenCalledWith(expect.objectContaining({ origen: ORIGEN_MEJORAR, tokensEntrada: 100, tokensSalida: 40, resultado: 'EXITO' }));
  });

  it('en FAQ valida frases: sin duplicar, máx 5 y solo textos válidos', async () => {
    const { svc } = armar({ respuesta: 'Hola 🥰', frases: ['abren hoy', 'abren hoy', 'a', 5, 'horario', 'x1x', 'x2x', 'x3x', 'x4x'] });
    const r = await svc.mejorar({ respuesta: 'Sí', tipo: 'FAQ' }, 1n);
    expect(r.frases).toEqual(['abren hoy', 'horario', 'x1x', 'x2x', 'x3x']);
  });

  it('en DERIVAR no devuelve frases', async () => {
    const { svc } = armar({ respuesta: 'Hola 🥰', frases: ['abren hoy'] });
    expect(await svc.mejorar({ respuesta: 'Sí', tipo: 'DERIVAR' }, 1n)).toEqual({ respuesta: 'Hola 🥰' });
  });

  it.each([['no es json'], [{ respuesta: '' }], [{ respuesta: 'a'.repeat(601) }], [{ otra: 1 }]])('salida inválida %p -> error en español', async (salida) => {
    const { svc } = armar(salida as any);
    await expect(svc.mejorar({ respuesta: 'Sí' }, 1n)).rejects.toMatchObject({ response: { codigo: 'IA_RESPUESTA_INVALIDA' } });
  });

  it('IA no configurada -> 409 IA_NO_DISPONIBLE', async () => {
    const { svc, ia } = armar(undefined, false);
    await expect(svc.mejorar({ respuesta: 'Sí' }, 1n)).rejects.toMatchObject({ status: 409, response: { codigo: 'IA_NO_DISPONIBLE', mensaje: 'La IA no está configurada' } });
    expect(ia.completarJson).not.toHaveBeenCalled();
  });

  it('si OpenAI falla -> 502 y consumo en ERROR', async () => {
    const { svc, ia, consumo } = armar();
    (ia.completarJson as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(svc.mejorar({ respuesta: 'Sí' }, 1n)).rejects.toMatchObject({ status: 502, response: { codigo: 'IA_ERROR' } });
    expect(consumo.registrarConsumo).toHaveBeenCalledWith(expect.objectContaining({ resultado: 'ERROR' }));
  });

  it('respuesta vacía -> 400', async () => {
    const { svc } = armar();
    await expect(svc.mejorar({ respuesta: '  ' }, 1n)).rejects.toMatchObject({ response: { codigo: 'RESPUESTA_VACIA' } });
  });

  it(`límite: la llamada ${MAX_MEJORAS_POR_HORA + 1} de un usuario por hora da 429, otro usuario no`, async () => {
    const { svc, ia } = armar();
    for (let i = 0; i < MAX_MEJORAS_POR_HORA; i++) await svc.mejorar({ respuesta: 'Sí' }, 1n);
    await expect(svc.mejorar({ respuesta: 'Sí' }, 1n)).rejects.toMatchObject({ status: 429, response: { codigo: 'LIMITE_MEJORAR' } });
    expect(ia.completarJson).toHaveBeenCalledTimes(MAX_MEJORAS_POR_HORA);
    await expect(svc.mejorar({ respuesta: 'Sí' }, 2n)).resolves.toBeDefined();
  });

  it('el endpoint exige aprendizajes/aprobar', () => {
    expect(Reflect.getMetadata(CLAVE_PERMISO, AprendizajesController.prototype.mejorar)).toEqual({ modulo: 'aprendizajes', accion: 'aprobar' });
  });
});

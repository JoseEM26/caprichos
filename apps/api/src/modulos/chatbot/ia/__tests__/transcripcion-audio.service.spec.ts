jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { TranscripcionAudioService, transcripcionValida, MODELO_TRANSCRIPCION_DEFECTO } from '../transcripcion-audio.service';
import { calcularCostoEstimadoUsd } from '../ia-precios.config';

describe('TranscripcionAudioService (OpenAI simulado)', () => {
  const fetchOriginal = global.fetch;
  let params: Record<string, string>;
  let consumo: any;
  let svc: TranscripcionAudioService;
  const audio = Buffer.alloc(20_000);

  beforeEach(() => {
    params = {};
    consumo = { puedeUsarIa: jest.fn().mockResolvedValue({ permitido: true }), registrarConsumo: jest.fn().mockResolvedValue(0) };
    const prisma: any = {
      parametro: { findUnique: jest.fn(async ({ where }: any) => (where.clave in params ? { valor: params[where.clave] } : null)) },
    };
    const config: any = { get: (k: string, d?: any) => (k === 'OPENAI_API_KEY' ? 'sk-prueba' : d) };
    svc = new TranscripcionAudioService(prisma, config, consumo);
  });
  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  const ok = (texto: string, usage?: any) => ({ ok: true, status: 200, json: async () => ({ text: texto, usage }) });

  it('transcribe en español con el modelo por defecto y cuenta el consumo (origen AUDIO)', async () => {
    const f = jest.fn().mockResolvedValue(ok(' quiero dos donas ', { type: 'tokens', input_tokens: 300, output_tokens: 10 }));
    global.fetch = f as any;
    const r = await svc.transcribir(audio, 'audio/ogg', 42n);
    expect(r).toEqual({ intentado: true, texto: 'quiero dos donas' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(init.headers.Authorization).toBe('Bearer sk-prueba');
    const form: FormData = init.body;
    expect(form.get('model')).toBe(MODELO_TRANSCRIPCION_DEFECTO);
    expect(form.get('language')).toBe('es');
    expect(consumo.registrarConsumo).toHaveBeenCalledWith(
      expect.objectContaining({ origen: 'AUDIO', resultado: 'EXITO', tokensEntrada: 300, tokensSalida: 10, conversacionId: 42n }),
    );
  });

  it('usa el modelo configurado si es válido y el de por defecto si no lo es', async () => {
    params.chatbot_transcripcion_modelo = 'whisper-1';
    expect(await svc.modelo()).toBe('whisper-1');
    params.chatbot_transcripcion_modelo = 'cualquiera';
    expect(await svc.modelo()).toBe(MODELO_TRANSCRIPCION_DEFECTO);
  });

  it('no intenta nada con el interruptor en «no», con la IA sin poder usarse o con un formato sin soporte', async () => {
    const f = jest.fn();
    global.fetch = f as any;
    params.chatbot_transcribir_audios = 'no';
    expect(await svc.transcribir(audio, 'audio/ogg')).toEqual({ intentado: false, texto: null });
    delete params.chatbot_transcribir_audios;
    consumo.puedeUsarIa.mockResolvedValue({ permitido: false, motivo: 'tope' });
    expect(await svc.transcribir(audio, 'audio/ogg')).toEqual({ intentado: false, texto: null });
    consumo.puedeUsarIa.mockResolvedValue({ permitido: true });
    expect(await svc.transcribir(audio, 'audio/amr')).toEqual({ intentado: false, texto: null });
    expect(f).not.toHaveBeenCalled();
  });

  it('reintenta una vez ante un error 5xx y devuelve el texto', async () => {
    const f = jest.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce(ok('hola buenas tardes'));
    global.fetch = f as any;
    expect((await svc.transcribir(audio, 'audio/ogg')).texto).toBe('hola buenas tardes');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('un error 4xx no se reintenta; falla sin lanzar y se registra el error', async () => {
    const f = jest.fn().mockResolvedValue({ ok: false, status: 400 });
    global.fetch = f as any;
    expect(await svc.transcribir(audio, 'audio/ogg')).toEqual({ intentado: true, texto: null });
    expect(f).toHaveBeenCalledTimes(1);
    expect(consumo.registrarConsumo).toHaveBeenCalledWith(expect.objectContaining({ resultado: 'ERROR', origen: 'AUDIO' }));
  });

  it('una excepción de red tras dos intentos devuelve intentado sin texto', async () => {
    const f = jest.fn().mockRejectedValue(new Error('socket'));
    global.fetch = f as any;
    expect(await svc.transcribir(audio, 'audio/ogg')).toEqual({ intentado: true, texto: null });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('un texto vacío o sin letras cuenta como no entendido', async () => {
    global.fetch = jest.fn().mockResolvedValue(ok(' ... ')) as any;
    expect(await svc.transcribir(audio, 'audio/ogg')).toEqual({ intentado: true, texto: null });
    expect(transcripcionValida('')).toBe(false);
    expect(transcripcionValida('sí, dos')).toBe(true);
  });

  it('las tarifas de transcripción están en la tabla (0.003 USD por minuto en mini)', () => {
    // 60 s a 10 tokens/s = 600 tokens
    expect(calcularCostoEstimadoUsd('gpt-4o-mini-transcribe', 600, 0)).toBeCloseTo(0.003, 6);
    expect(calcularCostoEstimadoUsd('whisper-1', 600, 0)).toBeCloseTo(0.006, 6);
  });
});

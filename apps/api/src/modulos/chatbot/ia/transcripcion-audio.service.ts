import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { IaConsumoService } from './ia-consumo.service';
import { MODELOS_TRANSCRIPCION, MODELO_TRANSCRIPCION_DEFECTO } from './transcripcion-modelos';

export { MODELOS_TRANSCRIPCION, MODELO_TRANSCRIPCION_DEFECTO };

/** Extensión que OpenAI reconoce por tipo (AMR y AAC suelto no los acepta: no se transcriben). */
const NOMBRE_ARCHIVO: Record<string, string> = {
  'audio/ogg': 'audio.ogg',
  'audio/mpeg': 'audio.mp3',
  'audio/mp4': 'audio.m4a',
};

const TIMEOUT_MS = 20_000;
/** ~2 KB por segundo en una nota de voz opus: solo para estimar el consumo cuando la API no informa duración. */
const BYTES_POR_SEGUNDO = 2000;
const TOKENS_AUDIO_POR_SEGUNDO = 10;

export interface ResultadoTranscripcion {
  /** false = no se intentó (IA apagada, sin clave, interruptor en «no», tope alcanzado o formato sin soporte). */
  intentado: boolean;
  /** Texto transcrito; null si falló o salió vacío. */
  texto: string | null;
}

/** Un texto sirve si tiene al menos una letra o dígito (descarta vacíos, «...» o puro ruido). */
export const transcripcionValida = (t: string | null | undefined): t is string => !!t && /[\p{L}\p{N}]{2,}/u.test(t);

/**
 * Transcribe notas de voz con OpenAI (POST /v1/audio/transcriptions). Cuenta el consumo en ia_consumo (origen AUDIO),
 * respeta tope mensual y apagado de la IA. Nunca lanza y nunca registra el texto en logs (dato personal, Ley 29733).
 */
@Injectable()
export class TranscripcionAudioService {
  private readonly logger = new Logger(TranscripcionAudioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly consumo: IaConsumoService,
  ) {}

  private async parametro(clave: string): Promise<string | null> {
    try {
      const p = await this.prisma.parametro.findUnique({ where: { clave } });
      return p?.valor === null || p?.valor === undefined ? null : String(p.valor).toLowerCase().trim();
    } catch {
      return null;
    }
  }

  /** Interruptor `chatbot_transcribir_audios` (por defecto «si») más IA operativa (clave, chatbot_ia_activo, Redis, tope). */
  async habilitada(): Promise<boolean> {
    if ((await this.parametro('chatbot_transcribir_audios')) === 'no') return false;
    return (await this.consumo.puedeUsarIa()).permitido;
  }

  async modelo(): Promise<string> {
    const m = await this.parametro('chatbot_transcripcion_modelo');
    return (MODELOS_TRANSCRIPCION as readonly string[]).includes(m ?? '') ? (m as string) : MODELO_TRANSCRIPCION_DEFECTO;
  }

  async transcribir(
    buffer: Buffer,
    mimeType: string,
    conversacionId?: bigint | string | null,
  ): Promise<ResultadoTranscripcion> {
    const nombre = NOMBRE_ARCHIVO[mimeType];
    if (!nombre || !(await this.habilitada())) return { intentado: false, texto: null };

    const apiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    const modelo = await this.modelo();
    let ultimoError = '';

    for (let intento = 1; intento <= 2; intento++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const form = new FormData();
        form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), nombre);
        form.append('model', modelo);
        form.append('language', 'es');
        form.append('response_format', 'json');
        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          signal: controller.signal,
        });
        if (!res.ok) {
          ultimoError = `HTTP ${res.status}`;
          // 4xx (salvo 429): reintentar no sirve
          if (res.status < 500 && res.status !== 429) break;
          continue;
        }
        const data: any = await res.json();
        const texto = String(data?.text ?? '').trim();
        const segundos = Number(data?.usage?.seconds) || buffer.length / BYTES_POR_SEGUNDO;
        await this.consumo.registrarConsumo({
          conversacionId: conversacionId ?? null,
          modelo,
          tokensEntrada: Number(data?.usage?.input_tokens) || Math.round(segundos * TOKENS_AUDIO_POR_SEGUNDO),
          tokensSalida: Number(data?.usage?.output_tokens) || 0,
          resultado: 'EXITO',
          origen: 'AUDIO',
        });
        return { intentado: true, texto: transcripcionValida(texto) ? texto : null };
      } catch (err: any) {
        ultimoError = err?.name === 'AbortError' ? 'tiempo agotado' : String(err?.message ?? 'error').slice(0, 120);
      } finally {
        clearTimeout(timer);
      }
    }

    this.logger.warn(`No se pudo transcribir un audio (${ultimoError}).`);
    await this.consumo.registrarConsumo({
      conversacionId: conversacionId ?? null,
      modelo,
      tokensEntrada: 0,
      tokensSalida: 0,
      resultado: 'ERROR',
      origen: 'AUDIO',
    });
    return { intentado: true, texto: null };
  }
}

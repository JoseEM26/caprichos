import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RespuestaEvolution {
  ok: boolean;
  status: number;
  data: any;
  /** Fallo de red o tiempo agotado (no hubo respuesta del servidor). */
  red?: boolean;
}

/** Cliente HTTP mínimo de Evolution API v2. Sin EVOLUTION_API_URL, EVOLUTION_API_KEY e instancia: no está configurado y todo es simulado. */
@Injectable()
export class EvolutionApiCliente {
  private readonly logger = new Logger(EvolutionApiCliente.name);

  constructor(private readonly config: ConfigService) {}

  private get url(): string {
    return (this.config.get<string>('EVOLUTION_API_URL') || '').trim().replace(/\/+$/, '');
  }
  private get clave(): string {
    return (this.config.get<string>('EVOLUTION_API_KEY') || '').trim();
  }
  get instancia(): string {
    return (this.config.get<string>('EVOLUTION_INSTANCE') || '').trim();
  }

  configurado(): boolean {
    return !!(this.url && this.clave && this.instancia);
  }

  async llamar(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown, timeoutMs = 20_000): Promise<RespuestaEvolution> {
    try {
      const res = await fetch(`${this.url}${ruta}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', apikey: this.clave },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const data = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, data };
    } catch (err: any) {
      this.logger.warn(`Evolution no respondió (${metodo} ${ruta.split('/')[1] ?? ''}): ${err?.message}`);
      return { ok: false, status: 0, data: null, red: true };
    }
  }

  /** open | close | connecting, o null si no se pudo consultar. */
  async estado(): Promise<string | null> {
    if (!this.configurado()) return null;
    const r = await this.llamar('GET', `/instance/connectionState/${encodeURIComponent(this.instancia)}`, undefined, 8000);
    return r.ok ? (r.data?.instance?.state ?? r.data?.state ?? null) : null;
  }

  /** QR para vincular el número (base64 de la imagen y código de emparejamiento), si la API lo entrega. */
  async qr(): Promise<{ base64: string | null; codigo: string | null } | null> {
    if (!this.configurado()) return null;
    const r = await this.llamar('GET', `/instance/connect/${encodeURIComponent(this.instancia)}`, undefined, 15_000);
    if (!r.ok) return null;
    return { base64: r.data?.base64 ?? null, codigo: r.data?.pairingCode ?? r.data?.code ?? null };
  }

  /** Descarga un adjunto recibido (imagen, audio, documento) por el id del mensaje. */
  async descargarMedia(mensajeId: string): Promise<{ buffer: Buffer; mime: string } | null> {
    if (!this.configurado()) return null;
    const r = await this.llamar('POST', `/chat/getBase64FromMediaMessage/${encodeURIComponent(this.instancia)}`, { message: { key: { id: mensajeId } }, convertToMp4: false }, 30_000);
    const b64 = r.data?.base64;
    if (!r.ok || typeof b64 !== 'string') return null;
    return { buffer: Buffer.from(b64.replace(/^data:[^,]*,/, ''), 'base64'), mime: String(r.data?.mimetype ?? 'application/octet-stream') };
  }
}

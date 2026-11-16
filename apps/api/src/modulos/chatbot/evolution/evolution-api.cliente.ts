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

  /** Adjuntos recién llegados por webhook (base64 y/o el mensaje completo), para no depender de que Evolution ya lo tenga en su base. */
  private readonly recientes = new Map<string, { buffer?: Buffer; mime?: string; key?: any; message?: any; hasta: number }>();

  /** Guarda unos minutos lo que trajo el webhook de un adjunto (base64 si venía, y el mensaje sin base64). Nunca se imprime. */
  recordarAdjunto(id: string, d: { base64?: string; mime?: string; key?: any; message?: any }): void {
    const ahora = Date.now();
    for (const [k, v] of this.recientes) if (v.hasta < ahora) this.recientes.delete(k);
    if (this.recientes.size >= 100) this.recientes.delete(this.recientes.keys().next().value as string);
    this.recientes.set(id, {
      buffer: d.base64 ? Buffer.from(d.base64.replace(/^data:[^,]*,/, ''), 'base64') : undefined,
      mime: d.mime,
      key: d.key,
      message: d.message,
      hasta: ahora + 5 * 60_000,
    });
  }

  /**
   * Descarga un adjunto recibido (imagen, audio, documento) por el id del mensaje: primero lo que trajo el webhook (base64);
   * si no, se pide a Evolution con el mensaje completo (no depende de su base de datos) o, sin él, solo con la clave.
   */
  async descargarMedia(mensajeId: string): Promise<{ buffer: Buffer; mime: string; nombre?: string } | null> {
    if (!this.configurado()) return null;
    const rec = this.recientes.get(mensajeId);
    if (rec?.buffer?.length) return { buffer: rec.buffer, mime: rec.mime ?? 'application/octet-stream' };
    const cuerpo = { message: { key: rec?.key ?? { id: mensajeId }, ...(rec?.message ? { message: rec.message } : {}) }, convertToMp4: false };
    const ruta = `/chat/getBase64FromMediaMessage/${encodeURIComponent(this.instancia)}`;
    let r = await this.llamar('POST', ruta, cuerpo, 30_000);
    // Sin el mensaje a mano, Evolution puede no haberlo guardado todavía: un segundo intento
    if (!r.ok && !rec?.message) {
      await new Promise((ok) => setTimeout(ok, 2000));
      r = await this.llamar('POST', ruta, cuerpo, 30_000);
    }
    const b64 = r.data?.base64;
    if (!r.ok || typeof b64 !== 'string') {
      this.logger.warn(`Evolution no entregó el adjunto (estado ${r.status})`);
      return null;
    }
    return {
      buffer: Buffer.from(b64.replace(/^data:[^,]*,/, ''), 'base64'),
      mime: String(r.data?.mimetype ?? rec?.mime ?? 'application/octet-stream').split(';')[0].trim().toLowerCase(),
      nombre: typeof r.data?.fileName === 'string' ? r.data.fileName : undefined,
    };
  }
}

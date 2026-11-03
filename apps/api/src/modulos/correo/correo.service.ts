import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../comun/prisma/prisma.service';

export const CORREO_REMITENTE = 'Caprichos <avisos@caprichos.pe>';
const RESEND_URL = 'https://api.resend.com/emails';
const REINTENTOS = 2;
const PAUSA_MS = 300;
const TIMEOUT_MS = 8000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface DatosCorreo {
  /** Identifica el caso (p. ej. stock:12:AGOTADO:2026-12-09). Un caso no se manda dos veces al mismo destinatario. */
  clave: string;
  origen: string;
  asunto: string;
  texto: string;
  destinatarios: string[];
}

export interface ResultadoCorreo {
  enviados: number;
  simulados: number;
  fallidos: number;
  omitidos: number;
}

/**
 * Envío de correo con Resend (API HTTP). Sin RESEND_API_KEY el envío queda en modo simulado:
 * solo registra en la tabla correo_envio y en el log. Nunca lanza: un fallo de correo no frena el flujo.
 */
@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async enviar(datos: DatosCorreo): Promise<ResultadoCorreo> {
    const resultado: ResultadoCorreo = { enviados: 0, simulados: 0, fallidos: 0, omitidos: 0 };
    const clave = datos.clave.slice(0, 160);
    const asunto = datos.asunto.slice(0, 200);
    const destinos = [...new Set(datos.destinatarios.map((d) => d.trim().toLowerCase()).filter((d) => EMAIL.test(d)))];

    if (destinos.length === 0) {
      await this.registrarSinDestino(clave, datos.origen, asunto);
      this.logger.log(JSON.stringify({ evento: 'correo_aviso_sin_destino', origen: datos.origen }));
      return { ...resultado, omitidos: 1 };
    }

    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    for (const destino of destinos) {
      const fila = await this.reservar(clave, destino, datos.origen, asunto);
      if (!fila) {
        resultado.omitidos++;
        continue;
      }
      if (!apiKey) {
        await this.cerrar(fila, 'SIMULADO');
        resultado.simulados++;
        continue;
      }
      const envio = await this.enviarResend(apiKey, destino, asunto, datos.texto);
      if (envio.ok) {
        await this.cerrar(fila, 'ENVIADO', envio.id);
        resultado.enviados++;
      } else {
        await this.cerrar(fila, 'FALLIDO', undefined, envio.error);
        resultado.fallidos++;
      }
    }

    this.logger.log(JSON.stringify({ evento: 'correo_aviso', origen: datos.origen, ...resultado }));
    return resultado;
  }

  /** Inserta la fila PENDIENTE; si el caso ya se registró para ese destinatario, devuelve null. */
  private async reservar(clave: string, destinatario: string, origen: string, asunto: string): Promise<bigint | null> {
    try {
      const fila = await this.prisma.correoEnvio.create({
        data: { clave, destinatario, origen, asunto, estado: 'PENDIENTE' },
        select: { id: true },
      });
      return fila.id;
    } catch (err: any) {
      if (err?.code === 'P2002') return null;
      this.logger.warn(JSON.stringify({ evento: 'correo_registro_fallido', origen, codigo: err?.code ?? 'DESCONOCIDO' }));
      return null;
    }
  }

  private async registrarSinDestino(clave: string, origen: string, asunto: string): Promise<void> {
    await this.reservar(clave, '-', origen, asunto).catch(() => null);
  }

  private async cerrar(id: bigint, estado: string, proveedorId?: string, error?: string): Promise<void> {
    await this.prisma.correoEnvio
      .update({ where: { id }, data: { estado, proveedor_id: proveedorId ?? null, error: error ?? null } })
      .catch(() => null);
  }

  /** Reintenta solo errores de red, 429 y 5xx. Los errores de datos (4xx) no se reintentan. */
  private async enviarResend(
    apiKey: string,
    to: string,
    subject: string,
    text: string,
  ): Promise<{ ok: boolean; id?: string; error?: string }> {
    let ultimo: { ok: boolean; error?: string } = { ok: false, error: 'SIN_INTENTO' };
    for (let intento = 0; intento <= REINTENTOS; intento++) {
      try {
        const res = await fetch(RESEND_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: CORREO_REMITENTE, to: [to], subject, text }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.ok) {
          const cuerpo = (await res.json().catch(() => ({}))) as { id?: unknown };
          return { ok: true, id: typeof cuerpo.id === 'string' ? cuerpo.id.slice(0, 80) : undefined };
        }
        ultimo = { ok: false, error: `HTTP_${res.status}` };
        if (res.status < 500 && res.status !== 429) break;
      } catch (err: any) {
        ultimo = { ok: false, error: err?.name === 'TimeoutError' ? 'TIMEOUT' : 'RED' };
      }
      if (intento < REINTENTOS) await new Promise((r) => setTimeout(r, PAUSA_MS));
    }
    return ultimo;
  }
}

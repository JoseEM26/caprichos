import * as net from 'net';
import type { RolImpresora } from '@caprichos/compartido';
import type { IDispositivoImpresora, EstadoDispositivo } from './dispositivo.interface';
import { ErrorImpresora } from './dispositivo.interface';

/** Puerto RAW/JetDirect estándar de las impresoras de red. */
export const PUERTO_RED_POR_DEFECTO = 9100;

export interface DestinoRed {
  host: string;
  puerto: number;
}

export interface OpcionesImpresoraRed {
  /** Solo la ticketera pide el estado en tiempo real (DLE EOT), si la impresora responde. */
  rol?: RolImpresora;
  timeoutConexionMs?: number;
  timeoutEscrituraMs?: number;
  timeoutEstadoMs?: number;
}

const OCTETOS_IPV4 = /^\d{1,3}$/;
const ETIQUETA_HOST = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

function esIPv4(texto: string): boolean {
  const partes = texto.split('.');
  return partes.length === 4 && partes.every((p) => OCTETOS_IPV4.test(p) && Number(p) <= 255);
}

function esNombreHost(texto: string): boolean {
  return texto.length <= 253 && texto.split('.').every((e) => ETIQUETA_HOST.test(e));
}

/**
 * ¿El destino es de red? `tcp://...` o una IPv4 con puerto opcional. Un nombre suelto (ej. «POS80»)
 * sigue siendo el nombre de una impresora de Windows: los nombres de host van solo con `tcp://`.
 */
export function esDestinoRed(destino: string): boolean {
  const t = destino.trim();
  return /^tcp:\/\//i.test(t) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(t);
}

/** Acepta `tcp://IP[:puerto]`, `IP[:puerto]` o `tcp://host[:puerto]`. Lanza Error con mensaje en español si no sirve. */
export function parsearDestinoRed(destino: string): DestinoRed {
  const original = destino.trim();
  const conPrefijo = /^tcp:\/\//i.test(original);
  const t = conPrefijo ? original.slice('tcp://'.length) : original;
  const formato = 'Usa IP[:puerto], por ejemplo 192.168.1.50 o 192.168.1.50:9100';
  const m = /^([^:/\\\s?#@]+)(?::(\d+))?$/.exec(t);
  if (!m) throw new Error(`Destino de red no válido: "${destino}". ${formato}`);
  const [, host, puertoTexto] = m;
  const puerto = puertoTexto === undefined ? PUERTO_RED_POR_DEFECTO : Number(puertoTexto);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error(`Puerto no válido en "${destino}": debe estar entre 1 y 65535`);
  }
  // Solo números y puntos son una IP: «999.1.1.1» no es un nombre de host
  const pareceIp = /^[\d.]+$/.test(host);
  if (!esIPv4(host) && (pareceIp || !(conPrefijo && esNombreHost(host)))) {
    throw new Error(`IP no válida en "${destino}". ${formato}`);
  }
  return { host, puerto };
}

/** Error interno de socket: `enviado` dice si ya salieron bytes (entonces no se reintenta). */
class FalloSocket extends Error {
  constructor(public readonly codigo: string, public readonly enviado: boolean = false) {
    super(codigo);
  }
}

const CODIGOS_SIN_LLEGADA = new Set([
  'TIMEOUT_CONEXION', 'TIMEOUT_ESCRITURA', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH',
  'ENOTFOUND', 'EAI_AGAIN', 'ENETDOWN',
]);

function conectar(host: string, puerto: number, timeoutMs: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const s = net.createConnection({ host, port: puerto });
    const onError = (err: NodeJS.ErrnoException) => {
      clearTimeout(t);
      s.destroy();
      reject(new FalloSocket(err.code ?? 'ERROR'));
    };
    const t = setTimeout(() => {
      s.off('error', onError);
      s.destroy();
      reject(new FalloSocket('TIMEOUT_CONEXION'));
    }, timeoutMs);
    s.once('connect', () => {
      clearTimeout(t);
      s.off('error', onError);
      resolve(s);
    });
    s.on('error', onError);
  });
}

/**
 * Impresora de red por IP (ESC/POS o TSPL en el puerto 9100). Sin dependencias: módulo net de Node.
 * Cada escritura abre y cierra su propia conexión, así un fallo no deja sockets colgados.
 */
export class ImpresoraRed implements IDispositivoImpresora {
  private readonly host: string;
  private readonly puerto: number;
  private readonly rol?: RolImpresora;
  private readonly timeoutConexionMs: number;
  private readonly timeoutEscrituraMs: number;
  private readonly timeoutEstadoMs: number;

  constructor(destino: string, opciones: OpcionesImpresoraRed = {}) {
    const d = parsearDestinoRed(destino);
    this.host = d.host;
    this.puerto = d.puerto;
    this.rol = opciones.rol;
    this.timeoutConexionMs = opciones.timeoutConexionMs ?? 5000;
    this.timeoutEscrituraMs = opciones.timeoutEscrituraMs ?? 10000;
    this.timeoutEstadoMs = opciones.timeoutEstadoMs ?? 1000;
  }

  obtenerRuta(): string {
    return `tcp://${this.host}:${this.puerto}`;
  }

  private get direccion(): string {
    return `${this.host}:${this.puerto}`;
  }

  /** Envía el búfer completo, espera a que salga del programa (flush) y cierra. Un reset antes de enviar nada se reintenta una vez. */
  async escribir(datos: Buffer): Promise<void> {
    try {
      await this.enviarUnaVez(datos);
    } catch (err) {
      const f = err instanceof FalloSocket ? err : new FalloSocket('ERROR');
      if (f.codigo === 'ECONNRESET' && !f.enviado) {
        await this.enviarUnaVez(datos).catch((e) => { throw this.aErrorImpresora(e); });
        return;
      }
      throw this.aErrorImpresora(f);
    }
  }

  private async enviarUnaVez(datos: Buffer): Promise<void> {
    const s = await conectar(this.host, this.puerto, this.timeoutConexionMs);
    let enviado = false;
    try {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new FalloSocket('TIMEOUT_ESCRITURA', enviado)), this.timeoutEscrituraMs);
        s.on('error', (e: NodeJS.ErrnoException) => {
          clearTimeout(t);
          reject(new FalloSocket(e.code ?? 'ERROR', enviado));
        });
        enviado = true;
        // El callback de end() llega cuando todo salió del programa (flush); no espera a que la impresora cierre.
        s.end(datos, (err?: Error | null) => {
          clearTimeout(t);
          if (err) reject(new FalloSocket((err as NodeJS.ErrnoException).code ?? 'ERROR', true));
          else resolve();
        });
      });
    } finally {
      s.on('error', () => undefined);
      s.destroy();
    }
  }

  private aErrorImpresora(err: unknown): ErrorImpresora {
    const codigo = err instanceof FalloSocket ? err.codigo : 'ERROR';
    if (codigo === 'TIMEOUT_ESCRITURA') {
      return new ErrorImpresora(
        `La impresora ${this.direccion} no terminó de recibir los datos a tiempo: revisa que esté encendida y con papel`,
        'desconectada',
        codigo,
      );
    }
    if (CODIGOS_SIN_LLEGADA.has(codigo)) {
      return new ErrorImpresora(
        `No se pudo conectar con la impresora ${this.direccion}: revisa que esté encendida y en la misma red`,
        'desconectada',
        codigo,
      );
    }
    return new ErrorImpresora(
      `Se cortó la comunicación con la impresora ${this.direccion} (${codigo}): vuelve a intentarlo`,
      'error',
      codigo,
    );
  }

  /** Solo intenta conectar (sin enviar datos). La ticketera además pide el estado DLE EOT si contesta. */
  async verificarEstado(): Promise<EstadoDispositivo> {
    let s: net.Socket;
    try {
      s = await conectar(this.host, this.puerto, Math.min(this.timeoutConexionMs, 2500));
    } catch (err) {
      const e = this.aErrorImpresora(err);
      return { estado: e.estado, detalle: `${e.message} (${e.codigoOriginal})` };
    }
    try {
      if (this.rol === 'TICKETERA') {
        const respuesta = await this.leerEstadoTiempoReal(s);
        if (respuesta) return this.interpretarEstado(respuesta);
      }
      return { estado: 'lista', detalle: `Red ${this.direccion}` };
    } finally {
      s.on('error', () => undefined);
      s.destroy();
    }
  }

  /** DLE EOT 4 (papel) y DLE EOT 2 (causa offline). No imprime nada. Sin respuesta en el plazo → null. */
  private leerEstadoTiempoReal(s: net.Socket): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const recibido: Buffer[] = [];
      let total = 0;
      const fin = () => {
        clearTimeout(t);
        s.off('data', alDato);
        resolve(total >= 2 ? Buffer.concat(recibido) : null);
      };
      const alDato = (chunk: Buffer) => {
        recibido.push(chunk);
        total += chunk.length;
        if (total >= 2) fin();
      };
      const t = setTimeout(fin, this.timeoutEstadoMs);
      s.on('data', alDato);
      s.on('error', fin);
      s.write(Buffer.from([0x10, 0x04, 0x04, 0x10, 0x04, 0x02]));
    });
  }

  private interpretarEstado(bytes: Buffer): EstadoDispositivo {
    const papel = bytes[0];
    const causa = bytes[1];
    if (causa & 0x04) return { estado: 'error', detalle: `Tapa abierta (${this.direccion})` };
    if (papel & 0x60) return { estado: 'sin_papel', detalle: `Sin papel (${this.direccion})` };
    return { estado: 'lista', detalle: `Red ${this.direccion}` };
  }
}

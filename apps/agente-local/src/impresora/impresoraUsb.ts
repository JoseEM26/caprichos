import * as fs from 'fs';
import type {
  IDispositivoImpresora,
  EstadoDispositivo,
} from './dispositivo.interface';
import { ErrorImpresora } from './dispositivo.interface';

export class ImpresoraUsb implements IDispositivoImpresora {
  /**
   * @param identidad  MFG MDL|serie guardada al configurar (opcional: configs viejas solo traen la ruta)
   * @param listar     impresoras USB actuales con su identidad, para reubicarla si cambió de lpN
   */
  constructor(
    private rutaDispositivo: string = '/dev/usb/lp0',
    private readonly identidad?: string,
    private readonly listar?: () => { destino: string; identidad?: string }[],
    private readonly logger: (m: string) => void = () => undefined,
  ) {}

  /** Si la identidad está en otra ruta (reconexión, dos impresoras), usa la nueva. */
  resolverRuta(): string {
    if (!this.identidad || !this.listar) return this.rutaDispositivo;
    const mias = this.listar().filter((d) => d.identidad === this.identidad);
    if (mias.length && !mias.some((d) => d.destino === this.rutaDispositivo)) {
      // ponytail: con varias iguales y sin serie no se adivina; solo se mueve si hay una sola
      if (mias.length === 1) {
        this.logger(`La impresora ${this.identidad} cambió de ${this.rutaDispositivo} a ${mias[0].destino}`);
        this.rutaDispositivo = mias[0].destino;
      }
    }
    return this.rutaDispositivo;
  }

  private msgPermiso(): string {
    return `Sin permiso para usar ${this.rutaDispositivo}: ejecuta \`sudo usermod -aG lp $USER\` y reinicia el equipo`;
  }

  obtenerRuta(): string {
    return this.rutaDispositivo;
  }

  /**
   * Escribe el búfer de bytes directamente en el nodo de dispositivo (ej. /dev/usb/lp0).
   * Si el dispositivo no existe, arroja ErrorImpresora('desconectada').
   * Si no hay permisos, arroja ErrorImpresora('error', 'EACCES').
   * Si hay fallo de hardware, arroja ErrorImpresora('error', 'EIO').
   */
  async escribir(datos: Buffer): Promise<void> {
    this.resolverRuta();
    // 1. Verificar existencia del nodo de dispositivo para distinguir desconexión (ENOENT)
    try {
      await fs.promises.stat(this.rutaDispositivo);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new ErrorImpresora(
          `Impresora desconectada: no se encuentra el dispositivo ${this.rutaDispositivo}`,
          'desconectada',
          'ENOENT'
        );
      }
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new ErrorImpresora(
          this.msgPermiso(),
          'sin_permiso',
          err.code
        );
      }
      throw new ErrorImpresora(
        `Error al acceder al dispositivo ${this.rutaDispositivo}: ${err.message}`,
        'error',
        err.code
      );
    }

    // 2. Abrir y escribir datos en el dispositivo
    let handle: fs.promises.FileHandle | null = null;
    try {
      handle = await fs.promises.open(this.rutaDispositivo, 'w');
      await handle.write(datos);
    } catch (err: any) {
      if (err instanceof ErrorImpresora) {
        throw err;
      }

      if (err.code === 'ENOENT') {
        throw new ErrorImpresora(
          `Impresora desconectada: no se encuentra el dispositivo ${this.rutaDispositivo}`,
          'desconectada',
          'ENOENT'
        );
      }

      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new ErrorImpresora(
          this.msgPermiso(),
          'sin_permiso',
          err.code
        );
      }

      if (err.code === 'EIO' || err.code === 'EBUSY') {
        throw new ErrorImpresora(
          `Error de E/S o dispositivo ocupado en ${this.rutaDispositivo}: ${err.message}`,
          'error',
          err.code
        );
      }

      throw new ErrorImpresora(
        `Error inesperado al escribir en la impresora (${this.rutaDispositivo}): ${err.message}`,
        'error',
        err.code
      );
    } finally {
      if (handle) {
        try {
          await handle.close();
        } catch {
          // Ignorar errores al cerrar
        }
      }
    }
  }

  /**
   * Comprueba si el dispositivo existe y tiene permisos de escritura.
   */
  async verificarEstado(): Promise<EstadoDispositivo> {
    this.resolverRuta();
    try {
      await fs.promises.access(this.rutaDispositivo, fs.constants.W_OK);
      return { estado: 'lista' };
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return {
          estado: 'desconectada',
          detalle: this.identidad
            ? `Impresora guardada no encontrada: ${this.identidad}`
            : `No encontrada (ruta ${this.rutaDispositivo})`,
        };
      }
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        return {
          estado: 'sin_permiso',
          detalle: this.msgPermiso(),
        };
      }
      return {
        estado: 'error',
        detalle: `Estado desconocido en ${this.rutaDispositivo}: ${err.message}`,
      };
    }
  }
}

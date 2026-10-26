import * as fs from 'fs';
import type {
  IDispositivoImpresora,
  EstadoDispositivo,
} from './dispositivo.interface';
import { ErrorImpresora } from './dispositivo.interface';

export class ImpresoraUsb implements IDispositivoImpresora {
  constructor(private readonly rutaDispositivo: string = '/dev/usb/lp0') {}

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
          `Permiso denegado al inspeccionar ${this.rutaDispositivo}. Verifique grupo lp o reglas udev.`,
          'error',
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
          `Permiso denegado al escribir en ${this.rutaDispositivo}. Verifique grupo lp o reglas udev.`,
          'error',
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
    try {
      await fs.promises.access(this.rutaDispositivo, fs.constants.W_OK);
      return { estado: 'lista' };
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return {
          estado: 'desconectada',
          detalle: `Dispositivo no encontrado en ${this.rutaDispositivo}`,
        };
      }
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        return {
          estado: 'error',
          detalle: `Sin permisos de escritura en ${this.rutaDispositivo}. Requiere grupo lp.`,
        };
      }
      return {
        estado: 'error',
        detalle: `Estado desconocido en ${this.rutaDispositivo}: ${err.message}`,
      };
    }
  }
}

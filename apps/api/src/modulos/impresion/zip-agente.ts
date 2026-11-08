import * as fs from 'fs';
import { once } from 'events';
import { Zip, ZipPassThrough } from 'fflate';

export interface EntradaZip {
  nombre: string;
  /** Texto/Buffer pequeño, o ruta de un archivo grande que se lee en streaming. */
  contenido?: string | Buffer;
  ruta?: string;
}

/**
 * Arma un ZIP sin comprimir (store: un .exe no gana nada) y lo escribe en `salida` por trozos:
 * nunca carga el archivo grande entero en memoria.
 */
export function escribirZip(salida: NodeJS.WritableStream, entradas: EntradaZip[]): Promise<void> {
  let lleno = false;
  return new Promise((resolve, reject) => {
    const zip = new Zip((err, trozo, final) => {
      if (err) return reject(err);
      if (!salida.write(trozo)) lleno = true;
      if (final) {
        salida.end();
        resolve();
      }
    });
    (async () => {
      for (const e of entradas) {
        const f = new ZipPassThrough(e.nombre);
        zip.add(f);
        if (e.ruta) {
          for await (const c of fs.createReadStream(e.ruta, { highWaterMark: 256 * 1024 })) {
            f.push(c as Buffer);
            if (lleno) { lleno = false; await once(salida, 'drain'); }
          }
          f.push(new Uint8Array(0), true);
        } else {
          f.push(typeof e.contenido === 'string' ? Buffer.from(e.contenido, 'utf8') : (e.contenido as Buffer), true);
        }
      }
      zip.end();
    })().catch(reject);
  });
}

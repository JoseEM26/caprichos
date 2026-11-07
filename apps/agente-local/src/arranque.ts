import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { rutaArchivoConfiguracion } from './config';

/** Archivo de registro junto a la configuración (en Windows: %APPDATA%\CaprichosAgente\agente.log). */
export function rutaArchivoLog(env: NodeJS.ProcessEnv = process.env): string {
  return env.AGENTE_LOG || path.join(path.dirname(rutaArchivoConfiguracion(env)), 'agente.log');
}

/** Añade una línea al log; nunca lanza (si no se puede escribir, se sigue sin log). */
export function registrarLog(mensaje: string, ruta = rutaArchivoLog()): void {
  try {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.appendFileSync(ruta, `[${new Date().toISOString()}] ${mensaje}\n`);
  } catch {
    // ponytail: sin rotación del log; añadir si crece (solo guarda errores de arranque)
  }
}

/** Mantiene la ventana abierta hasta pulsar Enter (con doble clic en Windows la consola se cierra al terminar). */
export function esperarEnter(): Promise<void> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY && process.platform !== 'win32') return resolve();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('close', resolve);
    rl.question('\nPresiona Enter para cerrar esta ventana...', () => rl.close());
  });
}

export function describirError(err: unknown): string {
  const e = err as any;
  const causa = e?.cause?.code ? ` (${e.cause.code})` : '';
  return `${e?.message || String(err)}${causa}`;
}

/** Corre el programa; ante cualquier error lo muestra en español, lo guarda en el log y espera Enter antes de cerrar. */
export async function arrancarProtegido(
  principal: () => Promise<void>,
  salir: (codigo: number) => void = (c) => process.exit(c),
): Promise<void> {
  let cayendo = false;
  const fallar = async (err: unknown) => {
    if (cayendo) return;
    cayendo = true;
    const detalle = describirError(err);
    registrarLog(`ERROR: ${(err as any)?.stack || detalle}`);
    console.error('\n==================================================');
    console.error('  El programa de impresión de Caprichos no pudo seguir.');
    console.error(`  Motivo: ${detalle}`);
    console.error(`  Detalle guardado en: ${rutaArchivoLog()}`);
    console.error('  Revisa tu conexión a internet y vuelve a abrir el programa.');
    console.error('  Si sigue igual, envía ese archivo a soporte.');
    console.error('==================================================');
    await esperarEnter();
    salir(1);
  };
  process.on('uncaughtException', fallar);
  process.on('unhandledRejection', fallar);
  registrarLog(`Inicio (${process.platform}, ${process.argv.slice(2).join(' ') || 'sin argumentos'})`);
  try {
    await principal();
  } catch (err) {
    await fallar(err);
  }
}

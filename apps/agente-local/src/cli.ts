import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { obtenerConfiguracion, rutaArchivoConfiguracion } from './config';
import type { ArchivoConfiguracion } from './config';
import { ImpresoraWindows, listarImpresorasWindows } from './impresora/impresoraWindows';
import { ImpresoraUsb } from './impresora/impresoraUsb';
import type { IDispositivoImpresora } from './impresora/dispositivo.interface';
import { ClienteApiImpresion, canjearCodigoVinculo } from './api/clienteApi';
import { AgenteLocalServicio } from './agente/bucle';
import {
  generarTsplTrabajo,
  generarBytesTrabajo,
} from './tspl/generadorTspl';
import {
  muestraEtiquetaGeneral,
  muestraEtiquetaArea,
  muestraEtiquetaBebida,
} from './datosMuestra';

export async function ejecutarComandoProbar(
  impresora?: IDispositivoImpresora,
  logger: (msg: string) => void = console.log
): Promise<{ exito: boolean; impresas: number; error?: string }> {
  const config = obtenerConfiguracion();
  const dispositivo = impresora || new ImpresoraUsb(config.impresoraRuta);

  logger('=====================================================');
  logger('  MODO PRUEBA: Imprimiendo 3 etiquetas de muestra   ');
  logger('  (1 General, 1 de Área y 1 por Vaso de Bebida)     ');
  logger(`  Dispositivo destino: ${dispositivo.obtenerRuta()} `);
  logger('=====================================================');

  try {
    // 1. General
    logger('Enviando Etiqueta General de Pedido (PED-101)...');
    const bytesGeneral = generarBytesTrabajo('ETIQUETA_GENERAL', muestraEtiquetaGeneral);
    await dispositivo.escribir(bytesGeneral);

    // 2. Área
    logger('Enviando Etiqueta de Área (COCINA 1 de 2)...');
    const bytesArea = generarBytesTrabajo('ETIQUETA_AREA', muestraEtiquetaArea);
    await dispositivo.escribir(bytesArea);

    // 3. Bebida
    logger('Enviando Etiqueta por Bebida (CAPPUCCINO VAINILLA - MARÍA ELENA)...');
    const bytesBebida = generarBytesTrabajo('ETIQUETA_BEBIDA', muestraEtiquetaBebida);
    await dispositivo.escribir(bytesBebida);

    logger('-----------------------------------------------------');
    logger('✔ 3 etiquetas impresas correctamente en el dispositivo.');
    return { exito: true, impresas: 3 };
  } catch (err: any) {
    logger('-----------------------------------------------------');
    logger(`✖ Error durante la prueba de impresión: ${err.message}`);
    if (err.codigoOriginal === 'ENOENT') {
      logger('  Asegúrese de que el cable USB de la etiquetera esté conectado.');
    } else if (err.codigoOriginal === 'EACCES') {
      logger('  Permiso denegado. Ejecute: sudo usermod -a -G lp $USER');
    }
    return { exito: false, impresas: 0, error: err.message };
  }
}

export async function ejecutarComandoVolcar(
  directorioDestino: string = path.join(process.cwd(), 'etiquetas-tspl'),
  logger: (msg: string) => void = console.log
): Promise<string[]> {
  logger('=====================================================');
  logger('  MODO VOLCADO: Generando archivos TSPL en disco    ');
  logger(`  Directorio: ${directorioDestino}                  `);
  logger('=====================================================');

  if (!fs.existsSync(directorioDestino)) {
    fs.mkdirSync(directorioDestino, { recursive: true });
  }

  const archivosGenerados: string[] = [];

  // 1. General
  const tsplGeneral = generarTsplTrabajo('ETIQUETA_GENERAL', muestraEtiquetaGeneral);
  const rutaGeneral = path.join(directorioDestino, 'etiqueta-general.tspl');
  fs.writeFileSync(rutaGeneral, tsplGeneral, 'utf-8');
  archivosGenerados.push(rutaGeneral);
  logger(`✔ Escrito: ${rutaGeneral} (${tsplGeneral.length} bytes)`);

  // 2. Área
  const tsplArea = generarTsplTrabajo('ETIQUETA_AREA', muestraEtiquetaArea);
  const rutaArea = path.join(directorioDestino, 'etiqueta-area.tspl');
  fs.writeFileSync(rutaArea, tsplArea, 'utf-8');
  archivosGenerados.push(rutaArea);
  logger(`✔ Escrito: ${rutaArea} (${tsplArea.length} bytes)`);

  // 3. Bebida
  const tsplBebida = generarTsplTrabajo('ETIQUETA_BEBIDA', muestraEtiquetaBebida);
  const rutaBebida = path.join(directorioDestino, 'etiqueta-bebida.tspl');
  fs.writeFileSync(rutaBebida, tsplBebida, 'utf-8');
  archivosGenerados.push(rutaBebida);
  logger(`✔ Escrito: ${rutaBebida} (${tsplBebida.length} bytes)`);

  logger('-----------------------------------------------------');
  logger('Archivos TSPL volcados listos para inspección o pruebas.');
  return archivosGenerados;
}

/** Windows: nombre de la impresora instalada. Linux: ruta del dispositivo (empieza con /). */
export function crearDispositivo(destino: string): IDispositivoImpresora {
  return destino.startsWith('/') ? new ImpresoraUsb(destino) : new ImpresoraWindows(destino);
}

export function leerArchivoConfiguracion(ruta = rutaArchivoConfiguracion()): ArchivoConfiguracion {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
  } catch {
    return {};
  }
}

function preguntar(rl: readline.Interface, texto: string): Promise<string> {
  return new Promise((resolve) => rl.question(texto, (r) => resolve(r.trim())));
}

/** Asistente: pega el código de vinculación y elige cuál es la etiquetera y cuál la ticketera. */
export async function ejecutarAsistente(
  preguntarFn?: (texto: string) => Promise<string>,
  logger: (m: string) => void = console.log
): Promise<ArchivoConfiguracion> {
  const rl = preguntarFn ? null : readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = preguntarFn ?? ((t: string) => preguntar(rl!, t));
  const ruta = rutaArchivoConfiguracion();
  const actual = leerArchivoConfiguracion(ruta);
  try {
    logger('=== Programa de impresión de Caprichos ===');
    let { apiUrl, agenteKey } = actual;
    if (!agenteKey) {
      const codigo = await ask('Pega el código de vinculación que te muestra Caprichos: ');
      const r = await canjearCodigoVinculo(apiUrl || obtenerConfiguracion().apiUrl, codigo);
      apiUrl = r.apiUrl;
      agenteKey = r.llave;
      logger('Vinculado correctamente.');
    }
    const nombres = process.platform === 'win32' ? await listarImpresorasWindows().catch(() => []) : [];
    if (nombres.length) {
      logger('Impresoras encontradas en este equipo:');
      nombres.forEach((n, i) => logger(`  ${i + 1}. ${n}`));
    }
    const elegir = async (rol: string, previa?: string) => {
      const r = await ask(`Número o nombre de la ${rol}${previa ? ` [${previa}]` : ''} (Enter = ninguna): `);
      if (!r) return previa;
      return nombres[Number(r) - 1] ?? r;
    };
    const etiquetera = await elegir('ETIQUETERA (stickers)', actual.etiquetera);
    const ticketera = await elegir('TICKETERA (ticket de pago)', actual.ticketera);
    const cfg: ArchivoConfiguracion = { apiUrl, agenteKey, etiquetera, ticketera, ticketColumnas: actual.ticketColumnas };
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, JSON.stringify(cfg, null, 2), { mode: 0o600 });
    logger(`Configuración guardada en ${ruta}`);
    return cfg;
  } finally {
    rl?.close();
  }
}

export async function main(): Promise<void> {
  const comando = process.argv[2]?.trim().toLowerCase();

  if (comando === 'probar') {
    const res = await ejecutarComandoProbar();
    process.exit(res.exito ? 0 : 1);
  }

  if (comando === 'volcar') {
    await ejecutarComandoVolcar();
    process.exit(0);
  }

  if (comando === 'configurar' || comando === 'vincular') {
    await ejecutarAsistente();
    process.exit(0);
  }

  // Sin configuración (primer uso, doble clic en el .exe): abre el asistente
  let archivo = leerArchivoConfiguracion();
  if (!archivo.agenteKey && !process.env.AGENTE_KEY && process.stdin.isTTY) {
    archivo = await ejecutarAsistente();
  }

  // Modo servicio (bucle continuo): una impresora por rol; IMPRESORA_RUTA sigue valiendo como etiquetera
  const config = obtenerConfiguracion(process.env, archivo);
  const clienteApi = new ClienteApiImpresion(config.apiUrl, config.agenteKey);
  const impresoras: Partial<Record<'ETIQUETERA' | 'TICKETERA', IDispositivoImpresora>> = {};
  const etiquetera = config.etiquetera ?? (config.ticketera ? undefined : config.impresoraRuta);
  if (etiquetera) impresoras.ETIQUETERA = crearDispositivo(etiquetera);
  if (config.ticketera) impresoras.TICKETERA = crearDispositivo(config.ticketera);

  const agente = new AgenteLocalServicio({
    config,
    clienteApi,
    impresoras,
  });

  const finalizar = () => {
    console.log('\nSeñal de terminación recibida. Deteniendo agente...');
    agente.detener();
    process.exit(0);
  };

  process.on('SIGINT', finalizar);
  process.on('SIGTERM', finalizar);

  await agente.iniciar();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error fatal en el agente:', err);
    process.exit(1);
  });
}

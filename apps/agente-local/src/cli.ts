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
  generarBytesDeScript,
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
  const config = obtenerConfiguracion(process.env, leerArchivoConfiguracion());
  const dispositivo = impresora || new ImpresoraUsb(config.impresoraRuta);

  logger('=====================================================');
  logger('  MODO PRUEBA: Imprimiendo 3 etiquetas de muestra   ');
  logger('  (1 General, 1 de Área y 1 por Vaso de Bebida)     ');
  logger(`  Dispositivo destino: ${dispositivo.obtenerRuta()} `);
  logger('=====================================================');

  try {
    // 1. General
    logger('Enviando Etiqueta General de Pedido (PED-101)...');
    const bytesGeneral = generarBytesTrabajo('ETIQUETA_GENERAL', muestraEtiquetaGeneral, false, config.etiqueta);
    await dispositivo.escribir(bytesGeneral);

    // 2. Área
    logger('Enviando Etiqueta de Área (COCINA 1 de 2)...');
    const bytesArea = generarBytesTrabajo('ETIQUETA_AREA', muestraEtiquetaArea, false, config.etiqueta);
    await dispositivo.escribir(bytesArea);

    // 3. Bebida
    logger('Enviando Etiqueta por Bebida (CAPPUCCINO VAINILLA - MARÍA ELENA)...');
    const bytesBebida = generarBytesTrabajo('ETIQUETA_BEBIDA', muestraEtiquetaBebida, false, config.etiqueta);
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
  const config = obtenerConfiguracion(process.env, leerArchivoConfiguracion());

  // 1. General
  const tsplGeneral = generarTsplTrabajo('ETIQUETA_GENERAL', muestraEtiquetaGeneral, false, config.etiqueta);
  const rutaGeneral = path.join(directorioDestino, 'etiqueta-general.tspl');
  fs.writeFileSync(rutaGeneral, generarBytesDeScript(tsplGeneral));
  archivosGenerados.push(rutaGeneral);
  logger(`✔ Escrito: ${rutaGeneral} (${tsplGeneral.length} bytes)`);

  // 2. Área
  const tsplArea = generarTsplTrabajo('ETIQUETA_AREA', muestraEtiquetaArea, false, config.etiqueta);
  const rutaArea = path.join(directorioDestino, 'etiqueta-area.tspl');
  fs.writeFileSync(rutaArea, generarBytesDeScript(tsplArea));
  archivosGenerados.push(rutaArea);
  logger(`✔ Escrito: ${rutaArea} (${tsplArea.length} bytes)`);

  // 3. Bebida
  const tsplBebida = generarTsplTrabajo('ETIQUETA_BEBIDA', muestraEtiquetaBebida, false, config.etiqueta);
  const rutaBebida = path.join(directorioDestino, 'etiqueta-bebida.tspl');
  fs.writeFileSync(rutaBebida, generarBytesDeScript(tsplBebida));
  archivosGenerados.push(rutaBebida);
  logger(`✔ Escrito: ${rutaBebida} (${tsplBebida.length} bytes)`);

  logger('-----------------------------------------------------');
  logger('Archivos TSPL volcados listos para inspección o pruebas.');
  return archivosGenerados;
}

export interface ImpresoraDetectada {
  destino: string;
  modelo?: string;
  /** Lenguaje que declara la impresora (TSPL2, ESCPOS...). */
  lenguaje?: string;
  /** Etiquetas (TSPL/ZPL/EPL) o tickets (ESC/POS), según el lenguaje. */
  sugerido?: 'ETIQUETERA' | 'TICKETERA';
  /** MFG MDL|serie: estable aunque cambie el número de lpN. */
  identidad?: string;
  puedeEscribir: boolean;
}

/** Lee `MFG:..;CMD:..;MDL:..;` de ieee1284_id. */
export function interpretarIeee1284(id: string): { modelo?: string; lenguaje?: string; sugerido?: 'ETIQUETERA' | 'TICKETERA'; serie?: string } {
  const c: Record<string, string> = {};
  for (const par of id.split(';')) {
    const i = par.indexOf(':');
    if (i > 0) c[par.slice(0, i).trim().toUpperCase()] = par.slice(i + 1).trim();
  }
  const mdl = c.MDL || c.MODEL;
  const mfg = c.MFG || c.MANUFACTURER;
  const modelo = [mfg && !mdl?.toUpperCase().startsWith(mfg.toUpperCase()) ? mfg : '', mdl].filter(Boolean).join(' ') || undefined;
  const lenguaje = c.CMD || c.COMMAND || c['COMMAND SET'] || undefined;
  const l = (lenguaje || '').toUpperCase();
  const sugerido = /TSPL|ZPL|EPL|CPCL/.test(l) ? 'ETIQUETERA' : /ESC/.test(l) ? 'TICKETERA' : undefined;
  const serie = c.SN || c.SERN || c.SERIALNUMBER || c.SERIAL || undefined;
  return { modelo, lenguaje, sugerido, serie };
}

/** Linux: TODOS los /dev/usb/lpN que el kernel ve, aunque no haya permiso de escritura. */
export function listarImpresorasLinux(dir = '/dev/usb', sysDir = '/sys/class/usbmisc'): ImpresoraDetectada[] {
  let nombres: string[];
  try {
    nombres = fs.readdirSync(dir).filter((n) => /^lp\d+$/.test(n)).sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)));
  } catch {
    return [];
  }
  return nombres.map((n) => {
    const destino = `${dir}/${n}`;
    let info: ReturnType<typeof interpretarIeee1284> = {};
    try {
      info = interpretarIeee1284(fs.readFileSync(`${sysDir}/${n}/device/ieee1284_id`, 'utf-8'));
    } catch {
      // sin ieee1284: se lista igual, sin modelo
    }
    let serie = info.serie;
    if (!serie) {
      try {
        serie = fs.readFileSync(`${sysDir}/${n}/device/../serial`, 'utf-8').trim() || undefined; // atributo USB
      } catch {
        // la impresora no declara número de serie
      }
    }
    const identidad = info.modelo ? `${info.modelo}${serie ? `|${serie}` : ''}` : undefined;
    let puedeEscribir = true;
    try {
      fs.accessSync(destino, fs.constants.W_OK);
    } catch {
      puedeEscribir = false;
    }
    return { destino, modelo: info.modelo, lenguaje: info.lenguaje, sugerido: info.sugerido, identidad, puedeEscribir };
  });
}

export function describirImpresora(i: ImpresoraDetectada): string {
  const tipo = i.sugerido === 'ETIQUETERA' ? 'etiquetas' : i.sugerido === 'TICKETERA' ? 'tickets' : '';
  const det = [tipo, i.lenguaje].filter(Boolean).join(' ');
  return `${i.destino}${i.modelo ? ` — ${i.modelo}` : ''}${det ? ` (${det})` : ''}${i.puedeEscribir ? '' : ' [sin permiso]'}`;
}

/** Windows: nombre de la impresora instalada. Linux: ruta del dispositivo (empieza con /). */
export function crearDispositivo(destino: string, identidad?: string): IDispositivoImpresora {
  return destino.startsWith('/')
    ? new ImpresoraUsb(destino, identidad, () => listarImpresorasLinux(), (m) => console.log(`[${new Date().toISOString()}] [WARN] ${m}`))
    : new ImpresoraWindows(destino);
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
    const esWin = process.platform === 'win32';
    const detectadas: ImpresoraDetectada[] = esWin
      ? (await listarImpresorasWindows().catch(() => [])).map((n) => ({ destino: n, puedeEscribir: true }))
      : listarImpresorasLinux();
    if (!detectadas.length) {
      logger(esWin ? 'No se encontraron impresoras instaladas en Windows.' : 'No hay impresoras USB en /dev/usb/lp*. Revisa el cable.');
    } else {
      logger('Impresoras encontradas en este equipo:');
      detectadas.forEach((d, i) => logger(`  ${i + 1}) ${describirImpresora(d)}`));
    }
    const elegir = async (rol: string, previa?: string, sugerida?: number) => {
      const porDefecto = previa ?? (sugerida ? detectadas[sugerida - 1].destino : undefined);
      const nota = porDefecto ? ` [Enter = ${previa ? 'actual' : 'sugerida'}: ${porDefecto}]` : ' (Enter = ninguna)';
      for (;;) {
        const r = await ask(`Número o ${esWin ? 'nombre' : 'ruta'} de la ${rol}${nota}: `);
        if (!r) return porDefecto;
        if (/^\d+$/.test(r)) {
          if (detectadas[Number(r) - 1]) return detectadas[Number(r) - 1].destino;
        } else if (esWin) {
          const d = detectadas.find((x) => x.destino.toLowerCase() === r.toLowerCase());
          if (d) return d.destino;
        } else if (r.startsWith('/') && fs.existsSync(r)) {
          return r;
        }
        logger(`"${r}" no existe en este equipo. Elige un número de la lista${esWin ? ' o el nombre exacto' : ' o una ruta que exista'}.`);
      }
    };
    const sug = (rol: 'ETIQUETERA' | 'TICKETERA') => {
      const i = detectadas.findIndex((d) => d.sugerido === rol);
      return i >= 0 ? i + 1 : undefined;
    };
    const etiquetera = await elegir('ETIQUETERA (stickers)', actual.etiquetera, sug('ETIQUETERA'));
    const ticketera = await elegir('TICKETERA (ticket de pago)', actual.ticketera, sug('TICKETERA'));
    const idDe = (destino?: string, previo?: string, idPrevio?: string) =>
      destino ? detectadas.find((d) => d.destino === destino)?.identidad ?? (destino === previo ? idPrevio : undefined) : undefined;
    const cfg: ArchivoConfiguracion = {
      apiUrl, agenteKey, etiquetera, ticketera,
      etiqueteraId: idDe(etiquetera, actual.etiquetera, actual.etiqueteraId),
      ticketeraId: idDe(ticketera, actual.ticketera, actual.ticketeraId),
      ticketColumnas: actual.ticketColumnas,
    };
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, JSON.stringify(cfg, null, 2), { mode: 0o600 });
    logger(`Configuración guardada en ${ruta}`);
    for (const d of [etiquetera, ticketera]) {
      if (d && d.startsWith('/') && detectadas.find((x) => x.destino === d && !x.puedeEscribir)) {
        logger(`AVISO: sin permiso para usar ${d}. Ejecuta \`sudo usermod -aG lp $USER\` y reinicia el equipo.`);
        logger('Alternativa sin reiniciar sesión: crea /etc/udev/rules.d/99-caprichos-impresoras.rules con');
        logger('  SUBSYSTEM=="usbmisc", KERNEL=="lp*", GROUP="lp", MODE="0660", TAG+="uaccess"');
        logger('  y ejecuta `sudo udevadm control --reload && sudo udevadm trigger` (el usuario debe estar en el grupo lp).');
      }
    }
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

  if (comando === 'impresoras') {
    if (process.platform === 'win32') {
      (await listarImpresorasWindows().catch(() => [])).forEach((n, i) => console.log(`  ${i + 1}) ${n}`));
    } else {
      const l = listarImpresorasLinux();
      console.log(l.length ? 'Impresoras encontradas en este equipo:' : 'No hay impresoras USB en /dev/usb/lp*.');
      l.forEach((d, i) => console.log(`  ${i + 1}) ${describirImpresora(d)}`));
    }
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
  if (etiquetera) impresoras.ETIQUETERA = crearDispositivo(etiquetera, archivo.etiqueteraId);
  if (config.ticketera) impresoras.TICKETERA = crearDispositivo(config.ticketera, archivo.ticketeraId);

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

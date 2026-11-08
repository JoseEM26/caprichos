import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { obtenerConfiguracion, rutaArchivoConfiguracion } from './config';
import type { ArchivoConfiguracion } from './config';
import { ImpresoraWindows, listarImpresorasWindows, listarImpresorasWindowsDetalle } from './impresora/impresoraWindows';
import { candidatasDeLinux, candidatasDeWindows, idGuardado } from './candidatas';
import type { CandidataLocal } from './candidatas';
import { activarAutoarranque, autoarranqueActivo, desactivarAutoarranque } from './autoarranque';
import { generarPruebaEtiqueta, generarPruebaTicket } from './pruebaImpresora';
import { ImpresoraUsb } from './impresora/impresoraUsb';
import { ImpresoraRed, esDestinoRed, parsearDestinoRed } from './impresora/impresoraRed';
import type { IDispositivoImpresora } from './impresora/dispositivo.interface';
import { ClienteApiImpresion, canjearCodigoVinculo } from './api/clienteApi';
import { comandoDiagnostico, comandoEstado, comandoImpresoras, comandoProbarTodas, comandoProbarUna, comandoUsar, ejecutarMenu } from './comandos';
import type { DepsComandos } from './comandos';
import { AgenteLocalServicio } from './agente/bucle';
import type { EquipoLocal } from './agente/bucle';
import { esperarEnter, describirError } from './arranque';
import {
  generarTsplTrabajo,
  generarBytesTrabajo,
  generarBytesDeScript,
} from './tspl/generadorTspl';
import { generarTicketEscPos } from './escpos/generadorTicket';
import type { RolImpresora } from '@caprichos/compartido';
import {
  muestraEtiquetaGeneral,
  muestraEtiquetaArea,
  muestraEtiquetaBebida,
  muestraTicketPago,
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

/** Red: `tcp://IP:PUERTO` o IP[:puerto]. Windows: nombre de la impresora instalada. Linux: ruta del dispositivo (empieza con /). */
export function crearDispositivo(destino: string, identidad?: string, rol?: RolImpresora): IDispositivoImpresora {
  if (esDestinoRed(destino)) return new ImpresoraRed(destino, { rol });
  return destino.startsWith('/')
    ? new ImpresoraUsb(destino, identidad, () => listarImpresorasLinux(), (m) => console.log(`[${new Date().toISOString()}] [WARN] ${m}`))
    : new ImpresoraWindows(destino);
}

/** Página de prueba corta: etiqueta general (etiquetera) o ticket de pago (ticketera). */
async function imprimirPruebaRed(rol: RolImpresora, destino: string, logger: (m: string) => void): Promise<void> {
  const config = obtenerConfiguracion(process.env, leerArchivoConfiguracion());
  const bytes = rol === 'ETIQUETERA'
    ? generarBytesTrabajo('ETIQUETA_GENERAL', muestraEtiquetaGeneral, false, config.etiqueta)
    : generarTicketEscPos(muestraTicketPago, config.ticketColumnas);
  try {
    await new ImpresoraRed(destino, { rol }).escribir(bytes);
    logger('✔ Página de prueba enviada a la impresora.');
  } catch (err: any) {
    logger(`✖ No se imprimió la prueba: ${err.message}`);
  }
}

/** Impresoras reales del equipo (sin PDF, OneNote, Fax, XPS ni duplicados «Copiar 1»), con identificación estable. */
export async function listarCandidatasLocales(): Promise<CandidataLocal[]> {
  if (process.platform === 'win32') {
    const lista = await listarImpresorasWindowsDetalle().catch(async () =>
      (await listarImpresorasWindows().catch(() => [] as string[])).map((nombre) => ({ nombre })),
    );
    return candidatasDeWindows(lista);
  }
  return candidatasDeLinux(listarImpresorasLinux());
}

/** Guarda la impresora de un rol en config.json (destino + identidad estable) conservando el resto. */
export function guardarImpresoraElegida(rol: RolImpresora, c: CandidataLocal, ruta = rutaArchivoConfiguracion()): ArchivoConfiguracion {
  const actual = leerArchivoConfiguracion(ruta);
  const nuevo: ArchivoConfiguracion =
    rol === 'ETIQUETERA'
      ? { ...actual, etiquetera: c.destino, etiqueteraId: c.identidad }
      : { ...actual, ticketera: c.destino, ticketeraId: c.identidad };
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, JSON.stringify(nuevo, null, 2), { mode: 0o600 });
  return nuevo;
}

/** El equipo para el bucle: lista lo que ve, crea el dispositivo y guarda lo elegido en el panel. */
export function crearEquipoLocal(archivoInicial: ArchivoConfiguracion, ruta = rutaArchivoConfiguracion()): EquipoLocal {
  let archivo = archivoInicial;
  return {
    listar: listarCandidatasLocales,
    crear: (c, rol) => crearDispositivo(c.destino, c.identidad, rol),
    idActual: (rol) =>
      rol === 'ETIQUETERA' ? idGuardado(archivo.etiquetera, archivo.etiqueteraId) : idGuardado(archivo.ticketera, archivo.ticketeraId),
    guardar: (rol, c) => {
      archivo = guardarImpresoraElegida(rol, c, ruta);
    },
  };
}

/** Dependencias reales de los comandos de terminal (impresoras de este equipo, config.json, consola). */
export function depsComandos(logger: (m: string) => void = console.log): DepsComandos {
  const ruta = rutaArchivoConfiguracion();
  const archivo = leerArchivoConfiguracion(ruta);
  return {
    listar: listarCandidatasLocales,
    crear: (c, rol) => crearDispositivo(c.destino, c.identidad, rol),
    guardar: (rol, c) => void guardarImpresoraElegida(rol, c, ruta),
    archivo,
    relear: () => leerArchivoConfiguracion(ruta),
    config: obtenerConfiguracion(process.env, archivo),
    autoarranque: () => autoarranqueActivo(),
    log: logger,
  };
}

/** Menú numerado (probar todas, elegir, estado, arranque) para no recordar comandos. */
async function abrirMenu(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    await ejecutarMenu((t) => preguntar(rl, t), depsComandos(), rutaArchivoConfiguracion(), {
      alternarAutoarranque:
        process.platform === 'win32'
          ? async () => ((await autoarranqueActivo()) ? (await desactivarAutoarranque()).mensaje : (await activarAutoarranque()).mensaje)
          : undefined,
    });
  } finally {
    rl.close();
  }
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
      logger('Abre Caprichos > Configuración > Impresión, pulsa para vincular este equipo y copia el código que aparece.');
      let vacios = 0;
      while (!agenteKey) {
        const codigo = await ask('Pega aquí el código de vinculación y pulsa Enter (clic derecho pega en esta ventana): ');
        if (!codigo) {
          if (++vacios >= 5) throw new Error('No se escribió ningún código de vinculación.');
          continue;
        }
        try {
          const r = await canjearCodigoVinculo(apiUrl || obtenerConfiguracion().apiUrl, codigo);
          apiUrl = r.apiUrl;
          agenteKey = r.llave;
        } catch (err: any) {
          logger(`✖ No se pudo vincular: ${describirError(err)}. Revisa el código completo (incluye lo que va después de @) y tu internet, e inténtalo de nuevo.`);
        }
      }
      logger('Vinculado correctamente.');
    }
    const esWin = process.platform === 'win32';
    const detectadas: ImpresoraDetectada[] = esWin
      ? (await listarCandidatasLocales()).map((c) => ({ destino: c.destino, modelo: c.detalle, sugerido: c.sugerido, puedeEscribir: true }))
      : listarImpresorasLinux();
    if (!detectadas.length) {
      logger(esWin ? 'No se encontraron impresoras instaladas en Windows.' : 'No hay impresoras USB en /dev/usb/lp*. Revisa el cable.');
    } else {
      logger('Impresoras encontradas en este equipo:');
      detectadas.forEach((d, i) => logger(`  ${i + 1}) ${describirImpresora(d)}`));
    }
    const opcionRed = detectadas.length + 1;
    logger(`  ${opcionRed}) Impresora de RED por IP (escribe su IP, ej. 192.168.1.50)`);

    // Pide la IP, comprueba la conexión y, si el usuario quiere, imprime una página de prueba. undefined = volver.
    const pedirImpresoraRed = async (rol: RolImpresora, inicial?: string): Promise<string | undefined> => {
      let valor = inicial;
      for (;;) {
        if (!valor) {
          valor = await ask('IP de la impresora de red (ej. 192.168.1.50 o 192.168.1.50:9100; Enter = volver): ');
          if (!valor) return undefined;
        }
        let destino: string;
        try {
          const d = parsearDestinoRed(valor);
          destino = `tcp://${d.host}:${d.puerto}`;
        } catch (err: any) {
          logger(`✖ ${err.message}`);
          valor = undefined;
          continue;
        }
        const estado = await new ImpresoraRed(destino, { rol }).verificarEstado();
        if (estado.estado === 'desconectada') {
          logger(`✖ ${estado.detalle}`);
          valor = undefined;
          continue;
        }
        logger(`✔ Conexión con ${destino} correcta${estado.estado === 'lista' ? '' : ` (${estado.detalle})`}`);
        const respuesta = (await ask(`¿Imprimir una página de prueba en la ${rol === 'ETIQUETERA' ? 'etiquetera' : 'ticketera'}? (S/n): `)).toLowerCase();
        if (respuesta !== 'n') await imprimirPruebaRed(rol, destino, logger);
        return destino;
      }
    };

    const elegir = async (rol: RolImpresora, etiqueta: string, previa?: string, sugerida?: number) => {
      const porDefecto = previa ?? (sugerida ? detectadas[sugerida - 1].destino : undefined);
      const nota = porDefecto ? ` [Enter = ${previa ? 'actual' : 'sugerida'}: ${porDefecto}]` : ' (Enter = ninguna)';
      for (;;) {
        const r = await ask(`Número, ${esWin ? 'nombre' : 'ruta'} o IP de red de la ${etiqueta}${nota}: `);
        if (!r) return porDefecto;
        if (r === String(opcionRed) || esDestinoRed(r)) {
          const red = await pedirImpresoraRed(rol, esDestinoRed(r) ? r : undefined);
          if (red) return red;
          continue;
        }
        if (/^\d+$/.test(r)) {
          if (detectadas[Number(r) - 1]) return detectadas[Number(r) - 1].destino;
        } else if (esWin) {
          const d = detectadas.find((x) => x.destino.toLowerCase() === r.toLowerCase());
          if (d) return d.destino;
        } else if (r.startsWith('/') && fs.existsSync(r)) {
          return r;
        }
        logger(`"${r}" no existe en este equipo. Elige un número de la lista${esWin ? ' o el nombre exacto' : ' o una ruta que exista'}, o escribe la IP de una impresora de red.`);
      }
    };
    const sug = (rol: 'ETIQUETERA' | 'TICKETERA') => {
      const i = detectadas.findIndex((d) => d.sugerido === rol);
      return i >= 0 ? i + 1 : undefined;
    };
    const etiquetera = await elegir('ETIQUETERA', 'etiquetera (stickers)', actual.etiquetera, sug('ETIQUETERA'));
    const ticketera = await elegir('TICKETERA', 'ticketera (ticket de pago)', actual.ticketera, sug('TICKETERA'));
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
    logger('Esa impresora queda guardada: al encender la computadora el programa se conecta SOLO a ella. Para cambiarla, usa Configuración > Impresión en Caprichos.');
    // Prueba en la impresora local elegida (la de red ya ofreció la suya al configurarla)
    for (const [rol, destino] of [['ETIQUETERA', etiquetera], ['TICKETERA', ticketera]] as [RolImpresora, string | undefined][]) {
      if (!destino || esDestinoRed(destino)) continue;
      if ((await ask(`¿Imprimir una página de prueba en la ${rol === 'ETIQUETERA' ? 'etiquetera' : 'ticketera'} (${destino})? (S/n): `)).toLowerCase() === 'n') continue;
      try {
        const nombre = detectadas.find((d) => d.destino === destino)?.modelo ?? destino;
        const config = obtenerConfiguracion(process.env, cfg);
        await crearDispositivo(destino, undefined, rol).escribir(
          rol === 'ETIQUETERA' ? generarPruebaEtiqueta(nombre, rol, config.etiqueta) : generarPruebaTicket(nombre, rol, config.ticketColumnas),
        );
        logger('✔ Página de prueba enviada. Si no salió en la impresora que esperabas, vuelve a elegir.');
      } catch (err: any) {
        logger(`✖ No se imprimió la prueba: ${err.message}`);
      }
    }
    if (process.platform === 'win32' && !(await autoarranqueActivo())) {
      const r = await activarAutoarranque();
      logger(r.ok ? `✔ ${r.mensaje} (Para quitarlo: programa autoarranque desactivar)` : `AVISO: ${r.mensaje}`);
    }
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

  if (comando === 'probar' && process.argv[3]) {
    const ok = await comandoProbarUna(depsComandos(), process.argv.slice(3).join(' '));
    await esperarEnter();
    process.exit(ok ? 0 : 1);
  }
  if (comando === 'probar-todas') {
    await comandoProbarTodas(depsComandos());
    await esperarEnter();
    process.exit(0);
  }
  if (comando === 'usar') {
    const ok = await comandoUsar(depsComandos(), process.argv[3] ?? '', process.argv.slice(4).join(' '));
    await esperarEnter();
    process.exit(ok ? 0 : 1);
  }
  if (comando === 'estado') {
    await comandoEstado(depsComandos(), rutaArchivoConfiguracion());
    await esperarEnter();
    process.exit(0);
  }
  if (comando === 'diagnostico' || comando === 'diagnóstico') {
    await comandoDiagnostico(depsComandos(), rutaArchivoConfiguracion());
    await esperarEnter();
    process.exit(0);
  }
  if (comando === 'menu') {
    await abrirMenu();
    process.exit(0);
  }

  if (comando === 'probar') {
    const res = await ejecutarComandoProbar();
    await esperarEnter();
    process.exit(res.exito ? 0 : 1);
  }

  if (comando === 'volcar') {
    await ejecutarComandoVolcar();
    await esperarEnter();
    process.exit(0);
  }

  if (comando === 'impresoras') {
    await comandoImpresoras(depsComandos());
    await esperarEnter();
    process.exit(0);
  }

  if (comando === 'autoarranque') {
    const accion = process.argv[3]?.trim().toLowerCase();
    if (accion === 'activar' || accion === 'desactivar') {
      console.log((await (accion === 'activar' ? activarAutoarranque() : desactivarAutoarranque())).mensaje);
    } else {
      console.log(`Arranque automático: ${(await autoarranqueActivo()) ? 'ACTIVADO' : 'desactivado'}. Usa "autoarranque activar" o "autoarranque desactivar".`);
    }
    await esperarEnter();
    process.exit(0);
  }

  if (comando === 'configurar' || comando === 'vincular') {
    await ejecutarAsistente();
    await abrirMenu();
    process.exit(0);
  }

  // Sin configuración (primer uso, doble clic en el .exe): abre el asistente
  let archivo = leerArchivoConfiguracion();
  const sinLlave = !archivo.agenteKey && !process.env.AGENTE_KEY && !process.env.CAPRICHOS_AGENTE_KEY;
  if (sinLlave && (process.stdin.isTTY || process.platform === 'win32')) {
    archivo = await ejecutarAsistente();
  } else if (sinLlave) {
    throw new Error('Este equipo aún no está vinculado. Ejecuta el programa con el comando "vincular" en una terminal.');
  }

  // Modo servicio (bucle continuo): una impresora por rol; IMPRESORA_RUTA sigue valiendo como etiquetera
  const config = obtenerConfiguracion(process.env, archivo);
  const clienteApi = new ClienteApiImpresion(config.apiUrl, config.agenteKey);
  const impresoras: Partial<Record<'ETIQUETERA' | 'TICKETERA', IDispositivoImpresora>> = {};
  // Sin elegir nada: en Windows no se inventa una ruta Linux (el panel pide elegir de la lista); en Linux sigue valiendo IMPRESORA_RUTA
  const rutaPorDefecto = process.platform === 'win32' && !process.env.IMPRESORA_RUTA && !process.env.PRINTER_PATH ? undefined : config.impresoraRuta;
  const etiquetera = config.etiquetera ?? (config.ticketera ? undefined : rutaPorDefecto);
  if (etiquetera) impresoras.ETIQUETERA = crearDispositivo(etiquetera, archivo.etiqueteraId, 'ETIQUETERA');
  if (config.ticketera) impresoras.TICKETERA = crearDispositivo(config.ticketera, archivo.ticketeraId, 'TICKETERA');

  const agente = new AgenteLocalServicio({
    config,
    clienteApi,
    impresoras,
    equipo: crearEquipoLocal(archivo),
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

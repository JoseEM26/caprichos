import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { crearReenlace } from './revinculacion';
import { COMMIT_AGENTE, LINEA_VERSION, VERSION_NUMERO, obtenerConfiguracion, rutaArchivoConfiguracion } from './config';
import type { ArchivoConfiguracion } from './config';
import { ImpresoraWindows, listarImpresorasWindows, listarImpresorasWindowsDetalle } from './impresora/impresoraWindows';
import { candidatasDeLinux, candidatasDeWindows, idGuardado } from './candidatas';
import type { CandidataLocal } from './candidatas';
import { activarAutoarranque, autoarranqueActivo, desactivarAutoarranque, ejecutablePropio, mismaRuta, rutaRegistrada } from './autoarranque';
import type { OpcionesAutoarranque } from './autoarranque';
import { consultarUltimaVersion, formatearEstado, reunirEstado } from './estadoPrograma';
import { cerrarCopiasPrevias, describirCopias, detenerTodo, listarCopias, noCerrarOtras } from './copias';
import type { CopiaPrograma } from './copias';
import type { DepsEstado } from './estadoPrograma';
import {
  dirDatos, describirEstado, detenerEnMarcha, guardarEstado, pidEnMarcha, relanzarOculto,
  reemplazable, rutaMarcaInicio, soltarBloqueo, tomarBloqueo, vigilarParada,
} from './segundoPlano';
import { generarPruebaEtiqueta, generarPruebaTicket } from './pruebaImpresora';
import { ImpresoraUsb } from './impresora/impresoraUsb';
import { ImpresoraRed, esDestinoRed, parsearDestinoRed } from './impresora/impresoraRed';
import type { IDispositivoImpresora } from './impresora/dispositivo.interface';
import { ClienteApiImpresion, canjearCodigoVinculo } from './api/clienteApi';
import { comandoDiagnostico, comandoImpresoras, comandoProbarTodas, comandoProbarUna, comandoUsar, ejecutarMenu } from './comandos';
import type { DepsComandos } from './comandos';
import { AgenteLocalServicio, leerInfoEquipo } from './agente/bucle';
import type { EquipoLocal } from './agente/bucle';
import { esperarEnter, describirError, modo, redirigirConsolaALog, registrarLog, rutaArchivoLog } from './arranque';
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

/** config.json que trae el ZIP «programa ya vinculado», junto al .exe (solo si corre empaquetado). */
export function rutaConfigJuntoExe(execPath = process.execPath, empaquetado = Boolean((process as any).pkg)): string | undefined {
  return empaquetado ? path.join(path.dirname(execPath), 'config.json') : undefined;
}

/** Si junto al .exe hay un config.json con llave nueva, la copia a la configuración normal (conserva impresoras). */
export function migrarConfigJuntoExe(ruta: string, rutaExe: string | undefined): void {
  if (!rutaExe || path.resolve(rutaExe) === path.resolve(ruta)) return;
  try {
    const junto = JSON.parse(fs.readFileSync(rutaExe, 'utf-8')) as ArchivoConfiguracion;
    if (!junto.agenteKey) return;
    let actual: ArchivoConfiguracion = {};
    try {
      actual = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    } catch {
      /* aún no existe */
    }
    if (actual.llaveDeExe === junto.agenteKey) return;
    const nuevo = { ...actual, apiUrl: junto.apiUrl ?? actual.apiUrl, agenteKey: junto.agenteKey, llaveDeExe: junto.agenteKey };
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, JSON.stringify(nuevo, null, 2), { mode: 0o600 });
  } catch {
    /* sin config junto al .exe o ilegible: se usa la normal */
  }
}

/** Guarda un vínculo nuevo (tras volver a vincular) conservando las impresoras elegidas. */
export function guardarVinculo(apiUrl: string, agenteKey: string, ruta = rutaArchivoConfiguracion()): void {
  const nuevo = { ...leerArchivoConfiguracion(ruta), apiUrl, agenteKey };
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, JSON.stringify(nuevo, null, 2), { mode: 0o600 });
}

export function leerArchivoConfiguracion(ruta = rutaArchivoConfiguracion()): ArchivoConfiguracion {
  if (ruta === rutaArchivoConfiguracion()) migrarConfigJuntoExe(ruta, rutaConfigJuntoExe());
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
      logger('Lo más fácil: descarga el programa ya vinculado desde Caprichos › Configuración › Impresión.');
      logger('O abre esa pantalla, pulsa para vincular este equipo y copia el código que aparece.');
      let vacios = 0;
      while (!agenteKey) {
        const codigo = await ask('Pega aquí el código de vinculación y pulsa Enter (clic derecho pega en esta ventana): ');
        if (!codigo) {
          if (++vacios >= 5) throw new Error('No se escribió ningún código de vinculación.');
          continue;
        }
        try {
          const r = await canjearCodigoVinculo(apiUrl || obtenerConfiguracion().apiUrl, codigo, fetch, leerInfoEquipo());
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
    if (process.platform === 'win32' && !cfg.autoinicioDesactivado && !(await autoarranqueActivo())) {
      const r = await activarAutoarranque();
      logger(r.ok ? `✔ ${r.mensaje} (Para quitarlo: autoinicio desactivar)` : `AVISO: ${r.mensaje}`);
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

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Recuerda en config.json si el usuario quitó el inicio automático a propósito. */
export function fijarAutoinicioDesactivado(desactivado: boolean, ruta = rutaArchivoConfiguracion()): void {
  const nuevo = { ...leerArchivoConfiguracion(ruta), autoinicioDesactivado: desactivado || undefined };
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, JSON.stringify(nuevo, null, 2), { mode: 0o600 });
}

/**
 * «Iniciar con Windows»: se registra solo (idempotente), se corrige si el .exe cambió de ruta, y no se vuelve a poner si el
 * usuario lo desactivó (config.autoinicioDesactivado; también cuenta la marca antigua `inicio-configurado` sin registro).
 */
export async function asegurarInicio(
  log: (m: string) => void = console.log,
  dir = dirDatos(),
  o: OpcionesAutoarranque & { rutaConfig?: string } = {},
): Promise<void> {
  const exe = o.ejecutable ?? ejecutablePropio();
  if (!exe) return;
  if (leerArchivoConfiguracion(o.rutaConfig).autoinicioDesactivado) return;
  const registrada = await rutaRegistrada(o);
  const plataforma = o.plataforma ?? process.platform;
  if (registrada && mismaRuta(registrada, exe, plataforma)) return;
  if (!registrada && fs.existsSync(rutaMarcaInicio(dir))) return fijarAutoinicioDesactivado(true, o.rutaConfig); // instalaciones viejas que lo quitaron
  const r = await activarAutoarranque({ ...o, ejecutable: exe });
  if (!r.ok) return log(`AVISO: ${r.mensaje} (puedes intentarlo con: autoinicio activar)`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(rutaMarcaInicio(dir), new Date().toISOString());
  log(registrada ? '✔ Inicio con Windows actualizado a la ubicación actual del programa.' : `✔ ${r.mensaje} (Para quitarlo: autoinicio desactivar)`);
}

/** `autoinicio activar|desactivar` (y --instalar-inicio / --quitar-inicio). Devuelve el código de salida. */
export async function comandoAutoinicio(accion: string | undefined, log: (m: string) => void = console.log, dir = dirDatos(), o: OpcionesAutoarranque & { rutaConfig?: string } = {}): Promise<number> {
  if (accion !== 'activar' && accion !== 'desactivar') {
    log(`Iniciar con Windows: ${(await autoarranqueActivo(o)) ? 'ACTIVADO' : 'desactivado'}. Usa "autoinicio activar" o "autoinicio desactivar".`);
    return 0;
  }
  if (accion === 'desactivar') {
    const r = await desactivarAutoarranque(o);
    if (r.ok) fijarAutoinicioDesactivado(true, o.rutaConfig);
    log(r.mensaje);
    return r.ok ? 0 : 1;
  }
  const r = await activarAutoarranque(o);
  if (r.ok) {
    fijarAutoinicioDesactivado(false, o.rutaConfig);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(rutaMarcaInicio(dir), new Date().toISOString());
  }
  log(r.mensaje);
  return r.ok ? 0 : 1;
}

/** `estado` / `diagnostico`: informe con ✔/✘; salida 0 si todo bien, 1 si algo falla. `--json` sin secretos. */
export async function comandoEstadoPrograma(json: boolean, log: (m: string) => void = console.log, deps?: DepsEstado): Promise<number> {
  const ruta = rutaArchivoConfiguracion();
  const d: DepsEstado = deps ?? {
    archivo: leerArchivoConfiguracion(ruta),
    dir: dirDatos(),
    ejecutable: ejecutablePropio(),
    listar: listarCandidatasLocales,
    verificarRed: async (destino) => {
      const e = await new ImpresoraRed(destino).verificarEstado();
      return { ok: e.estado !== 'desconectada', detalle: e.detalle };
    },
    consultarVersion: (apiUrl) => consultarUltimaVersion(apiUrl, 8000),
    copias: () => listarCopias(),
  };
  const e = await reunirEstado(d);
  if (json) log(JSON.stringify(e, null, 2));
  else {
    formatearEstado(e).forEach((l) => log(l));
  }
  return e.ok ? 0 : 1;
}

const nombreExe = () => path.basename(process.execPath);
const rojo = (t: string) => (process.stdout.isTTY && !process.env.NO_COLOR ? `\x1b[31m${t}\x1b[0m` : t);

/** Líneas que `--estado` añade: versión en uso, última disponible (sin fallar si no hay red), copias e inicio con Windows. */
export async function lineasExtraEstado(o: { archivo?: ArchivoConfiguracion; consultar?: typeof consultarUltimaVersion; copias?: () => Promise<CopiaPrograma[]>; auto?: OpcionesAutoarranque; nombre?: string } = {}): Promise<string[]> {
  const archivo = o.archivo ?? leerArchivoConfiguracion();
  const l = [`Versión en uso: ${VERSION_NUMERO}${COMMIT_AGENTE === 'dev' ? '' : ` (${COMMIT_AGENTE})`}`];
  try {
    if (!archivo.apiUrl) throw new Error('sin vincular');
    const ultima = await (o.consultar ?? consultarUltimaVersion)(archivo.apiUrl, 4000);
    l.push(ultima ? `Última versión disponible: ${ultima}` : 'Última versión disponible: No se pudo consultar (aún no hay una publicada)');
  } catch {
    l.push('Última versión disponible: No se pudo consultar');
  }
  try {
    const n = (await (o.copias ?? listarCopias)()).length;
    l.push(n > 1 ? rojo(`✘ Copias corriendo: ${n}. Hay ${n} copias: usa --detener-todo y vuelve a abrir el programa`) : `Copias corriendo: ${n}`);
  } catch {
    l.push('Copias corriendo: No se pudo comprobar');
  }
  const auto = o.auto ?? { ejecutable: ejecutablePropio() };
  if ((auto.plataforma ?? process.platform) === 'win32') {
    const r = await rutaRegistrada(auto);
    l.push(r ? `Inicio con Windows: registrado desde ${r}` : 'Inicio con Windows: no registrado (se registra al abrir el programa, o con: autoinicio activar)');
  }
  return l;
}

/** Comandos de control (`--estado`, `--detener`...). undefined = no es uno de ellos. */
async function comandoControl(c: string | undefined): Promise<number | undefined> {
  const dir = dirDatos();
  switch (c) {
    case '--estado':
      console.log(describirEstado(dir));
      (await lineasExtraEstado()).forEach((l) => console.log(l));
      return 0;
    case '--copias': {
      const nombre = nombreExe();
      try {
        describirCopias(await listarCopias(), nombre).forEach((l) => console.log(l));
        return 0;
      } catch (e: any) {
        console.log(`No se pudo consultar las copias: ${e?.message ?? e}`);
        return 1;
      }
    }
    case '--detener-todo': {
      try {
        const r = await detenerTodo({}, nombreExe());
        r.lineas.forEach((l) => console.log(l));
        if (!r.codigo) console.log('Listo. Ahora puedes abrir la versión nueva (doble clic, una sola vez).');
        return r.codigo;
      } catch (e: any) {
        console.log(`No se pudo consultar las copias: ${e?.message ?? e}`);
        return 1;
      }
    }
    case '--detener': {
      const r = await detenerEnMarcha(dir);
      console.log(r === 'no-corria' ? 'El programa no estaba corriendo.' : 'Programa detenido. Para volver a prenderlo, ábrelo de nuevo (o reinicia la PC).');
      return 0;
    }
    case '--reiniciar':
      await detenerEnMarcha(dir);
      relanzarOculto(['--segundo-plano']);
      console.log('Programa reiniciado en segundo plano. Revisa con --estado.');
      await dormir(1500);
      return 0;
    case '--ver-logs':
      console.log(`Registro del programa: ${rutaArchivoLog()}`);
      try {
        console.log(fs.readFileSync(rutaArchivoLog(), 'utf-8').split('\n').slice(-40).join('\n'));
      } catch {
        console.log('(aún no hay registro)');
      }
      return 0;
    case '--instalar-inicio':
      return comandoAutoinicio('activar', console.log, dir);
    case '--quitar-inicio':
      return comandoAutoinicio('desactivar', console.log, dir);
  }
  return undefined;
}

export async function main(): Promise<void> {
  let comando = process.argv[2]?.trim().toLowerCase();
  if (comando === '--version' || comando === '-v' || comando === 'version') {
    console.log(LINEA_VERSION);
    process.exit(0);
  }
  if (comando === 'copias' || comando === 'detener-todo') comando = `--${comando}`;
  const segundoPlano = comando === '--segundo-plano';
  if (!segundoPlano && !process.argv.includes('--json')) console.log(LINEA_VERSION);
  const primerPlano = comando === '--primer-plano';
  const cerrarOtras = !noCerrarOtras();
  if (segundoPlano) {
    modo.segundoPlano = true;
    redirigirConsolaALog();
  }
  const codigoControl = await comandoControl(comando);
  if (codigoControl !== undefined) process.exit(codigoControl);
  if (comando === '--vincular') comando = 'vincular';

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
  if (comando === 'estado' || comando === 'diagnostico' || comando === 'diagnóstico') {
    const json = process.argv.includes('--json');
    const codigo = await comandoEstadoPrograma(json);
    if (comando !== 'estado') await comandoDiagnostico(depsComandos(), rutaArchivoConfiguracion());
    if (!json) await esperarEnter();
    process.exit(codigo);
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

  if (comando === 'autoinicio' || comando === 'autoarranque') {
    const codigo = await comandoAutoinicio(process.argv[3]?.trim().toLowerCase());
    await esperarEnter();
    process.exit(codigo);
  }

  if (comando === 'configurar' || comando === 'vincular') {
    await ejecutarAsistente();
    await abrirMenu();
    process.exit(0);
  }

  // Sin configuración (primer uso, doble clic en el .exe): abre el asistente
  let archivo = leerArchivoConfiguracion();
  const sinLlave = !archivo.agenteKey && !process.env.AGENTE_KEY && !process.env.CAPRICHOS_AGENTE_KEY;
  if (sinLlave && !segundoPlano && (process.stdin.isTTY || process.platform === 'win32')) {
    archivo = await ejecutarAsistente();
  } else if (sinLlave) {
    throw new Error('Este equipo aún no está vinculado. Descarga el programa ya vinculado desde Caprichos › Configuración › Impresión (o ejecuta el programa con el comando "vincular" en una terminal).');
  }

  // Doble clic o terminal: deja el programa en segundo plano (sin ventana) y esta ventana se cierra
  if (!segundoPlano && !primerPlano) {
    await asegurarInicio();
    if (pidEnMarcha() && !(cerrarOtras && reemplazable())) {
      console.log('El programa de impresión ya está funcionando en segundo plano. Revisa con --estado.');
    } else {
      // Si hay una versión anterior en marcha, la copia nueva (en segundo plano) la reemplaza al arrancar
      relanzarOculto(['--segundo-plano', ...(cerrarOtras ? [] : ['--no-cerrar-otras'])]);
      console.log('Listo: el programa de impresión quedó funcionando en segundo plano y arrancará solo al prender la PC.');
      console.log('Puedes cerrar esta ventana. Para ver cómo va: --estado. Para detenerlo: --detener.');
    }
    await dormir(3000);
    process.exit(0);
  }
  if (!tomarBloqueo()) {
    // Solo se reemplaza a una versión ANTERIOR (misma o más nueva se respeta): así, si dos nuevas arrancan a la vez, queda una
    const reemplazar = cerrarOtras && reemplazable();
    if (reemplazar) {
      console.log('Había una versión anterior del programa en marcha; la cierro para que quede esta.');
      await detenerEnMarcha(dirDatos());
    }
    if (!reemplazar || !tomarBloqueo()) {
      console.log('El programa de impresión ya está funcionando (solo puede haber uno).');
      process.exit(0);
    }
  }
  // Con el bloqueo ya en la mano (atómico), se cierran las copias que no lo respetan: versiones viejas, otra carpeta, huérfanas
  if (cerrarOtras) await cerrarCopiasPrevias(segundoPlano ? registrarLog : console.log);
  if (segundoPlano) await asegurarInicio(registrarLog); // tras una actualización o mudanza del .exe, el inicio apunta a la ruta nueva

  // Modo servicio (bucle continuo): una impresora por rol; IMPRESORA_RUTA sigue valiendo como etiquetera
  const config = obtenerConfiguracion(process.env, archivo);
  const interactivo = Boolean(process.stdin.isTTY);
  const rlRevincular = interactivo ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
  const reenlace = crearReenlace(
    {
      leer: () => leerArchivoConfiguracion(),
      interactivo,
      preguntar: (t) => (rlRevincular ? preguntar(rlRevincular, t) : Promise.resolve('')),
      canjear: (codigo) => canjearCodigoVinculo(config.apiUrl, codigo, fetch, leerInfoEquipo()),
      guardar: (u, k) => guardarVinculo(u, k),
      log: (m) => console.log(m),
    },
    config.agenteKey
  );
  const clienteApi = new ClienteApiImpresion(config.apiUrl, config.agenteKey, undefined, reenlace);
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
    alEstado: (e) => guardarEstado({ pid: process.pid, inicio: inicioProceso, ultimaConexionOk: e.ultimaConexionOk, ultimoError: e.ultimoError, necesitaVincular: e.necesitaVincular, roles: e.roles }),
  });
  const inicioProceso = new Date().toISOString();
  registrarLog(`Servicio iniciado (pid ${process.pid}, ${segundoPlano ? 'segundo plano' : 'primer plano'})`);

  // Cierre ordenado: termina el trabajo en curso (se imprime y se confirma), borra el bloqueo y sale
  let cerrando = false;
  const finalizar = async () => {
    if (cerrando) return;
    cerrando = true;
    console.log('Cierre solicitado. Deteniendo el programa...');
    agente.detener();
    await Promise.race([corrida, dormir(8000)]);
    soltarBloqueo();
    process.exit(0);
  };
  for (const senal of ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const) process.on(senal, () => void finalizar());
  vigilarParada(() => void finalizar());

  const corrida = agente.iniciar();
  await corrida;
  await finalizar();
}

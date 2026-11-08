import type { ImpresoraCandidata, RolImpresora } from '@caprichos/compartido';

/** Impresora tal como la ve el equipo, con lo necesario para abrirla (destino) y reconocerla (id estable). */
export interface CandidataLocal extends ImpresoraCandidata {
  /** Nombre del spooler (Windows), ruta del dispositivo (Linux) o tcp://ip:puerto. */
  destino: string;
  /** Linux: MFG MDL|serie, estable aunque cambie el número de lpN. */
  identidad?: string;
  /** Windows: puerto del spooler (USB001, LPT1, IP_...). Linux: la ruta del dispositivo. */
  puerto?: string;
  driver?: string;
  /** Windows: estado del spooler (Normal, Offline...), con «sin conexión» si WorkOffline. */
  estadoSpooler?: string;
  /** Va conectada por USB (puerto USBxxx en Windows; /dev/usb/lpN en Linux). */
  usb?: boolean;
}

export interface ImpresoraWindowsInfo {
  nombre: string;
  driver?: string;
  puerto?: string;
  /** PrinterStatus de Get-Printer (Normal, Offline, PaperOut...). */
  estado?: string;
  workOffline?: boolean;
}

const NOMBRE_VIRTUAL = /pdf|onenote|fax|xps|document writer|print to file|imprimir (en|a) (archivo|pdf)|snagit|cutepdf|primopdf|dopdf|send to|enviar a|teams|anydesk/i;
const PUERTO_VIRTUAL = /^(portprompt|file|nul|xpsport|shrfax|microsoft\.|pdf|ica_)/i;
const COPIA = /\s*\((copiar|copia|copy)\s*\d+\)\s*$/i;

/** PDF, OneNote, Fax, XPS, «imprimir a archivo»: no sirven para etiquetas ni tickets. */
export function esImpresoraVirtual(i: ImpresoraWindowsInfo): boolean {
  return NOMBRE_VIRTUAL.test(i.nombre) || NOMBRE_VIRTUAL.test(i.driver ?? '') || PUERTO_VIRTUAL.test(i.puerto ?? '');
}

/** Quita las virtuales y los duplicados «(Copiar 1)» cuya impresora original también está en la lista. */
export function filtrarImpresorasWindows(lista: ImpresoraWindowsInfo[]): ImpresoraWindowsInfo[] {
  const nombres = new Set(lista.map((i) => i.nombre.toLowerCase()));
  return lista.filter(
    (i) => !esImpresoraVirtual(i) && !(COPIA.test(i.nombre) && nombres.has(i.nombre.replace(COPIA, '').toLowerCase())),
  );
}

const PARECE_ETIQUETERA = /tsc|4barcode|4b-?20|label|etiq|zebra|tspl|gk\d|godex|argox/i;
const PARECE_TICKETERA = /pos|receipt|ticket|thermal|termic|epson tm|xprinter|rongta|58|80mm|escpos/i;

/** Ticketera del local: driver 3nStar «POS-80» / «POS-80C» (RPT-Drivers). Se reconoce primero y sin dudar. */
export const ES_TICKETERA_LOCAL = /\bpos[\s-]?80c?\b/i;

export function sugerirRol(texto: string): RolImpresora | undefined {
  if (ES_TICKETERA_LOCAL.test(texto)) return 'TICKETERA';
  if (PARECE_ETIQUETERA.test(texto)) return 'ETIQUETERA';
  if (PARECE_TICKETERA.test(texto)) return 'TICKETERA';
  return undefined;
}

export function candidatasDeWindows(lista: ImpresoraWindowsInfo[]): CandidataLocal[] {
  const ordenadas = [...filtrarImpresorasWindows(lista)].sort(
    (a, b) => Number(ES_TICKETERA_LOCAL.test(`${b.nombre} ${b.driver ?? ''}`)) - Number(ES_TICKETERA_LOCAL.test(`${a.nombre} ${a.driver ?? ''}`)),
  );
  return ordenadas.map((i) => ({
    id: i.nombre,
    nombre: i.nombre,
    destino: i.nombre,
    detalle: [i.driver, i.puerto && `puerto ${i.puerto}`].filter(Boolean).join(' · ') || undefined,
    sugerido: sugerirRol(`${i.nombre} ${i.driver ?? ''}`),
    puerto: i.puerto,
    driver: i.driver,
    estadoSpooler: i.workOffline ? 'sin conexión' : i.estado,
    usb: /^usb/i.test(i.puerto ?? ''),
  }));
}

export interface ImpresoraLinuxInfo {
  destino: string;
  modelo?: string;
  lenguaje?: string;
  sugerido?: RolImpresora;
  identidad?: string;
}

/** Linux: el id es la identidad (modelo|serie); si dos impresoras la comparten, se usa la ruta para no confundirlas. */
export function candidatasDeLinux(lista: ImpresoraLinuxInfo[]): CandidataLocal[] {
  return lista.map((i) => {
    const repetida = !!i.identidad && lista.filter((x) => x.identidad === i.identidad).length > 1;
    return {
      id: i.identidad && !repetida ? i.identidad : i.destino,
      nombre: i.modelo ?? i.destino,
      destino: i.destino,
      identidad: i.identidad,
      detalle: [i.destino, i.lenguaje].filter(Boolean).join(' · '),
      sugerido: i.sugerido ?? sugerirRol(i.modelo ?? ''),
      puerto: i.destino,
      usb: i.destino.startsWith('/dev/usb/'),
    };
  });
}

/** Lo que viaja al servidor: sin datos internos. */
export function paraServidor(c: CandidataLocal): ImpresoraCandidata {
  return {
    id: c.id,
    nombre: c.nombre,
    ...(c.detalle ? { detalle: c.detalle } : {}),
    ...(c.sugerido ? { sugerido: c.sugerido } : {}),
    ...(c.puerto ? { puerto: c.puerto } : {}),
    ...(c.driver ? { driver: c.driver } : {}),
    ...(c.estadoSpooler ? { estado: c.estadoSpooler } : {}),
    ...(c.usb !== undefined ? { usb: c.usb } : {}),
  };
}

/** Identificación estable de lo guardado en la configuración (identidad en Linux; si no, el destino). */
export function idGuardado(destino?: string, identidad?: string): string | undefined {
  return destino ? identidad ?? destino : undefined;
}

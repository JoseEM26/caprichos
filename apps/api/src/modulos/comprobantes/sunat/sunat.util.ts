import { zipSync, unzipSync } from 'fflate';
import * as crypto from 'crypto';

/** Fecha AAAA-MM-DD en hora de Lima. */
export function fechaIsoLima(fecha: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(fecha);
  const d = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${d('year')}-${d('month')}-${d('day')}`;
}

/** Hora HH:MM:SS en hora de Lima. */
export function horaLima(fecha: Date): string {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(fecha);
  const d = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return `${d('hour')}:${d('minute')}:${d('second')}`;
}

/** AAAAMMDD en hora de Lima (para los nombres de resúmenes). */
export function yyyymmddLima(fecha: Date): string {
  return fechaIsoLima(fecha).replace(/-/g, '');
}

const UNIDADES = ['CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
const VEINTIS = ['', 'VEINTIUNO', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function menorDeMil(n: number): string {
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (r > 0 && r <= 20) partes.push(UNIDADES[r]);
  else if (r > 20 && r < 30) partes.push(VEINTIS[r - 20]);
  else if (r >= 30) {
    const u = r % 10;
    partes.push(DECENAS[Math.floor(r / 10)] + (u ? ` Y ${UNIDADES[u]}` : ''));
  }
  return partes.join(' ');
}

/** Número entero en letras (español, mayúsculas). Hasta 999 millones. */
export function numeroEnLetras(n: number): string {
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? 'UN MILLON' : `${numeroEnLetras(millones)} MILLONES`);
  if (miles) partes.push(miles === 1 ? 'MIL' : `${menorDeMil(miles)} MIL`);
  if (resto) partes.push(menorDeMil(resto));
  return partes.join(' ');
}

/** Leyenda 1000 de SUNAT: "SON CIENTO DIECIOCHO CON 00/100 SOLES". Entrada en céntimos. */
export function montoEnLetras(cents: number): string {
  const entero = Math.floor(cents / 100);
  const cc = String(cents % 100).padStart(2, '0');
  return `SON ${numeroEnLetras(entero)} CON ${cc}/100 SOLES`;
}

/** Monto con 2 decimales a partir de céntimos (sin floats en el cálculo). */
export function montoXml(cents: number): string {
  const signo = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${signo}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Escapa texto para XML. */
export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** ZIP con un único XML (SUNAT: el zip contiene solo el xml, con el mismo nombre). */
export function zipUnico(nombreXml: string, xml: string | Buffer): Buffer {
  const datos = typeof xml === 'string' ? Buffer.from(xml, 'utf8') : xml;
  return Buffer.from(zipSync({ [nombreXml]: new Uint8Array(datos) }, { level: 9 }));
}

/** Lee un ZIP y devuelve sus entradas. */
export function leerZip(zip: Buffer): Record<string, Buffer> {
  const salida: Record<string, Buffer> = {};
  for (const [nombre, datos] of Object.entries(unzipSync(new Uint8Array(zip)))) salida[nombre] = Buffer.from(datos);
  return salida;
}

export function sha256(datos: string | Buffer): string {
  return crypto.createHash('sha256').update(datos).digest('hex');
}

/** Buffer como Uint8Array para columnas Bytes de Prisma. */
export function bytes(b: Buffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(b);
}

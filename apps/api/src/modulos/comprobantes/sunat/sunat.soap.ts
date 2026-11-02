import { DOMParser } from '@xmldom/xmldom';
import { ErrorRedEmisor } from '../emisor/emisor.tipos';
import { esc, leerZip } from './sunat.util';

/** Tiempo máximo de una llamada a SUNAT. Sin respuesta a tiempo el envío queda pendiente. */
export const TIMEOUT_SUNAT_MS = 60000;

export type OperacionSoap = 'sendBill' | 'sendSummary' | 'getStatus' | 'getStatusCdr';

const NS_SERVICIO = 'http://service.sunat.gob.pe';
const TIPO_CLAVE_TEXTO_PLANO = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText';

/**
 * Sobre SOAP 1.1 con WS-Security UsernameToken (usuario SOL = RUC + usuario secundario, y clave SOL).
 * `cuerpo` son los hijos de la operación ya escapados.
 */
export function sobreSoap(op: OperacionSoap, cuerpo: string, usuario: string, clave: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="${NS_SERVICIO}" ` +
    `xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">` +
    `<soap-env:Header><wsse:Security><wsse:UsernameToken>` +
    `<wsse:Username>${esc(usuario)}</wsse:Username>` +
    `<wsse:Password Type="${TIPO_CLAVE_TEXTO_PLANO}">${esc(clave)}</wsse:Password>` +
    `</wsse:UsernameToken></wsse:Security></soap-env:Header>` +
    `<soap-env:Body><ser:${op}>${cuerpo}</ser:${op}></soap-env:Body></soap-env:Envelope>`
  );
}

/** Sobre de sendBill / sendSummary con el zip en base64. */
export function cuerpoEnvio(nombreZip: string, zip: Buffer): string {
  return `<fileName>${esc(nombreZip)}</fileName><contentFile>${zip.toString('base64')}</contentFile>`;
}

export type FetchSoap = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Llama al servicio. Sin respuesta (red, tiempo agotado o 5xx sin SOAP Fault) lanza ErrorRedEmisor.
 * Un SOAP Fault llega con HTTP 500 y se devuelve como texto para interpretarlo.
 * Nunca registra el sobre (lleva la clave SOL).
 */
export async function enviarSoap(url: string, sobre: string, fetchFn: FetchSoap = (u, i) => fetch(u, i)): Promise<string> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_SUNAT_MS);
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
      body: sobre,
      signal: control.signal,
    });
    const texto = await res.text();
    if (res.status >= 500 && !/Fault/i.test(texto)) throw new ErrorRedEmisor(`SUNAT respondió ${res.status} sin datos`);
    return texto;
  } catch (e) {
    if (e instanceof ErrorRedEmisor) throw e;
    throw new ErrorRedEmisor();
  } finally {
    clearTimeout(reloj);
  }
}

/** Respuesta SOAP ya leída: fault (si lo hay) y los textos de los elementos de respuesta, por nombre local. */
export interface RespuestaSoap {
  fault?: { codigo: string; mensaje: string };
  textos: Record<string, string>;
}

function hijosElemento(nodo: any): any[] {
  const salida: any[] = [];
  for (let c = nodo.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) salida.push(c);
  return salida;
}

/** Recorre el árbol y guarda el primer texto de cada nombre local (sin prefijos). */
export function parsearSoap(texto: string): RespuestaSoap {
  const doc = new DOMParser().parseFromString(texto, 'text/xml');
  const textos: Record<string, string> = {};
  let fault: RespuestaSoap['fault'];
  const visitar = (nodo: any) => {
    for (const h of hijosElemento(nodo)) {
      const nombre = h.localName ?? h.nodeName.split(':').pop();
      if (nombre === 'Fault') {
        const codigo = (h.getElementsByTagName('faultcode')[0]?.textContent ?? '').trim();
        const mensaje = (h.getElementsByTagName('faultstring')[0]?.textContent ?? '').trim();
        fault = { codigo, mensaje };
      } else if (hijosElemento(h).length === 0 && textos[nombre] === undefined) {
        textos[nombre] = (h.textContent ?? '').trim();
      }
      visitar(h);
    }
  };
  visitar(doc.documentElement ?? doc);
  return { fault, textos };
}

/** Un fault de cliente (faultcode con Client) es un rechazo; de servidor se trata como sin respuesta. */
export function esFaultCliente(fault: { codigo: string }): boolean {
  return /Client/i.test(fault.codigo);
}

/** Código numérico SUNAT dentro del faultcode (soap-env:Client.0109 -> 0109). */
export function codigoFault(fault: { codigo: string; mensaje: string }): string {
  return /\.(\d{4})/.exec(fault.codigo)?.[1] ?? fault.codigo;
}

/** CDR de SUNAT: código de respuesta, descripción y observaciones, con el XML para guardarlo. */
export interface Cdr {
  nombre: string;
  codigo: number;
  descripcion: string;
  observaciones: string[];
  xml: Buffer;
}

/** Lee el ZIP de respuesta y extrae R-{archivo}.xml (ApplicationResponse). */
export function leerCdr(zipB64: string): Cdr {
  const entradas = leerZip(Buffer.from(zipB64, 'base64'));
  const nombre = Object.keys(entradas).find((n) => /^R-.*\.xml$/i.test(n)) ?? Object.keys(entradas).find((n) => n.endsWith('.xml'));
  if (!nombre) throw new Error('El ZIP de respuesta no trae el CDR');
  const xml = entradas[nombre].toString('utf8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const porNombre = (n: string) => Array.from(doc.getElementsByTagNameNS('*', n)).map((e: any) => (e.textContent ?? '').trim());
  const codigoTxt = porNombre('ResponseCode')[0] ?? '';
  const codigo = Number(codigoTxt);
  return {
    nombre,
    codigo: Number.isFinite(codigo) ? codigo : -1,
    descripcion: porNombre('Description')[0] ?? '',
    observaciones: porNombre('Note').filter(Boolean),
    xml: entradas[nombre],
  };
}

/**
 * Resultado de un CDR: 0 aceptada; 4000-4999 aceptada con observaciones (SUNAT lo trata como aceptado);
 * cualquier otro código es rechazada. ponytail: el rango 4000 se confirma con las pruebas en beta.
 */
export function estadoCdr(cdr: Cdr): 'ACEPTADA' | 'ACEPTADA_CON_OBSERVACIONES' | 'RECHAZADA' {
  if (cdr.codigo === 0) return 'ACEPTADA';
  if (cdr.codigo >= 4000 && cdr.codigo <= 4999) return 'ACEPTADA_CON_OBSERVACIONES';
  return 'RECHAZADA';
}

/** Texto de un CDR para la fila del comprobante (código, descripción y observaciones, sin secretos). */
export function textoCdr(cdr: Cdr): string {
  const partes = [`${cdr.codigo}`, cdr.descripcion, ...cdr.observaciones.map((o) => `Obs: ${o}`)].filter(Boolean);
  return partes.join(' | ').slice(0, 1000);
}

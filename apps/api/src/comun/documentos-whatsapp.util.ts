/**
 * Documentos de WhatsApp (recibidos del cliente y enviados por el equipo): lista blanca estricta por extensión Y tipo,
 * nombre saneado y tamaño máximo. Meta permite hasta 100 MB; aquí se es prudente.
 */

/** Tamaño máximo al recibir y al enviar (16 MB). */
export const MAX_DOCUMENTO_BYTES = 16 * 1024 * 1024;
export const MAX_DOCUMENTO_ENVIO_BYTES = 16 * 1024 * 1024;

const OOXML = 'application/vnd.openxmlformats-officedocument';

/** extensión -> tipos MIME aceptados para esa extensión (el primero es el canónico). */
export const DOCUMENTOS_PERMITIDOS: Record<string, string[]> = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: [`${OOXML}.wordprocessingml.document`],
  xls: ['application/vnd.ms-excel'],
  xlsx: [`${OOXML}.spreadsheetml.sheet`],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: [`${OOXML}.presentationml.presentation`],
  txt: ['text/plain'],
  // Windows suele declarar los .csv como application/vnd.ms-excel
  csv: ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
};

export const TIPOS_DOCUMENTO_PERMITIDOS: string[] = [...new Set(Object.values(DOCUMENTOS_PERMITIDOS).flat())];

/** Valor para el atributo accept del selector de archivos. */
export const ACCEPT_DOCUMENTOS = Object.keys(DOCUMENTOS_PERMITIDOS).map((e) => `.${e}`).join(',');

/** Si alguna parte intermedia del nombre es una de estas, es un intento de engaño (informe.exe.pdf). */
const EXTENSIONES_PELIGROSAS = new Set([
  'exe', 'com', 'bat', 'cmd', 'msi', 'scr', 'js', 'jse', 'vbs', 'vbe', 'ps1', 'sh', 'jar', 'apk', 'dll', 'lnk',
  'hta', 'wsf', 'reg', 'zip', 'rar', '7z', 'html', 'htm', 'svg', 'php', 'py', 'docm', 'xlsm', 'pptm',
]);

/** Nombre sin rutas, sin caracteres de control ni de ruta, de largo limitado, conservando la extensión. */
export function sanearNombreDocumento(nombre: unknown, max = 120): string {
  let n = String(nombre ?? '');
  n = n.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  n = n.replace(/[\u0000-\u001f\u007f<>:"|?*‪-‮]/g, '').replace(/\s+/g, ' ').trim();
  n = n.replace(/^\.+/, '');
  if (n.length > max) {
    const i = n.lastIndexOf('.');
    const ext = i > 0 && n.length - i <= 8 ? n.slice(i) : '';
    n = n.slice(0, max - ext.length) + ext;
  }
  return n || 'documento';
}

/** Nombre de respaldo cuando Meta no manda filename: «documento.pdf» según el tipo declarado. */
export function nombreSegunMime(mimeCrudo: unknown): string | null {
  const mime = String(mimeCrudo ?? '').split(';')[0].trim().toLowerCase();
  const ext = Object.keys(DOCUMENTOS_PERMITIDOS).find((e) => DOCUMENTOS_PERMITIDOS[e][0] === mime);
  return ext ? `documento.${ext}` : null;
}

export function extensionDe(nombre: string): string {
  const i = nombre.lastIndexOf('.');
  return i > 0 ? nombre.slice(i + 1).toLowerCase() : '';
}

export type ResultadoDocumento =
  | { ok: true; nombre: string; mime: string; ext: string }
  | { ok: false; motivo: 'TIPO' };

/** Valida nombre y MIME (sin parámetros) a la vez: ambos deben ser coherentes y estar en la lista blanca. */
export function validarDocumento(nombreCrudo: unknown, mimeCrudo: unknown): ResultadoDocumento {
  const nombre = sanearNombreDocumento(nombreCrudo);
  const mime = String(mimeCrudo ?? '').split(';')[0].trim().toLowerCase();
  const partes = nombre.toLowerCase().split('.');
  const ext = partes.length > 1 ? partes[partes.length - 1] : '';
  if (partes.slice(1, -1).some((p) => EXTENSIONES_PELIGROSAS.has(p))) return { ok: false, motivo: 'TIPO' };
  const tipos = DOCUMENTOS_PERMITIDOS[ext];
  if (!tipos || !tipos.includes(mime)) return { ok: false, motivo: 'TIPO' };
  return { ok: true, nombre, mime, ext };
}

/** Comprobación de los primeros bytes: PDF, OOXML (zip) u OLE2 (doc/xls/ppt) según la extensión; texto sin bytes nulos. */
export function contenidoCoincide(buffer: Buffer, ext: string): boolean {
  if (!buffer?.length) return false;
  const inicio = buffer.subarray(0, 8);
  if (ext === 'pdf') return buffer.subarray(0, 1024).includes('%PDF-');
  if (ext === 'docx' || ext === 'xlsx' || ext === 'pptx') return inicio[0] === 0x50 && inicio[1] === 0x4b;
  if (ext === 'doc' || ext === 'xls' || ext === 'ppt') {
    return inicio.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  if (ext === 'txt' || ext === 'csv') return !buffer.subarray(0, 8192).includes(0);
  return false;
}

export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Texto visible en el hilo: «📄 nombre.docx (120 KB)». */
export function textoDocumentoChat(nombre: string, bytes: number): string {
  return `📄 ${nombre} (${formatearTamano(bytes)})`;
}

export const TEXTO_DOCUMENTO_RECIBIDO = 'Recibí tu documento 📄 Una persona del equipo lo revisará y te responde en breve 😊';
export const TEXTO_DOCUMENTO_TIPO_NO_PERMITIDO =
  'Solo puedo recibir documentos PDF, Word, Excel, PowerPoint o de texto 📄 ¿Me lo envías en uno de esos formatos?';
export const TEXTO_DOCUMENTO_NO_RECIBIDO =
  'No pude recibir tu documento 😕 Puede pesar más de 16 MB o haber fallado la descarga. ¿Lo envías de nuevo?';
export const MOTIVO_DERIVACION_DOCUMENTO = 'DOCUMENTO';

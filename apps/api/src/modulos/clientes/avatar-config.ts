import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

/** Lo que guarda el avatar de la cuenta: solo ids de piezas y colores hex, nunca texto libre largo ni datos personales. */
export interface PiezaAvatar {
  id: string;
  colores: Record<string, string>;
}
export interface AvatarConfig {
  nombre: string;
  genero: 'mujer' | 'hombre' | 'neutro';
  piel: string;
  ojos: string;
  expresion: 'feliz' | 'sonrisa' | 'guino' | 'sorpresa';
  colorPelo: string;
  disfraz: string | null;
  disfrazId: string | null;
  cabello: PiezaAvatar;
  arriba: PiezaAvatar;
  abajo: PiezaAvatar;
  calzado: PiezaAvatar;
  cabeza: PiezaAvatar;
  cara: PiezaAvatar;
  accesorio: PiezaAvatar;
  /** Saludo al entrar a la carta (encendido si falta) */
  mostrarAlEntrar?: boolean;
}

export const AVATAR_CONFIG_MAX_BYTES = 4 * 1024;
export const AVATAR_RETRATO_MAX_BYTES = 200 * 1024;

const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^[a-z0-9_]{1,40}$/;
const SLOTS = ['principal', 'secundario', 'acento'];
const PIEZAS = ['cabello', 'arriba', 'abajo', 'calzado', 'cabeza', 'cara', 'accesorio'] as const;
const GENEROS = ['mujer', 'hombre', 'neutro'];
const EXPRESIONES = ['feliz', 'sonrisa', 'guino', 'sorpresa'];

const invalido = (mensaje: string) => new BadRequestException({ codigo: 'AVATAR_INVALIDO', mensaje });

function hex(v: unknown, campo: string): string {
  if (typeof v !== 'string' || !HEX.test(v)) throw invalido(`El color de «${campo}» no es válido.`);
  return v.toUpperCase();
}
function id(v: unknown, campo: string): string {
  if (typeof v !== 'string' || !ID.test(v)) throw invalido(`La pieza de «${campo}» no es válida.`);
  return v;
}

/** Valida y devuelve una copia limpia (lista blanca de campos): lo que no encaja se rechaza. */
export function validarAvatarConfig(crudo: unknown): AvatarConfig {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) throw invalido('Falta la configuración del avatar.');
  if (Buffer.byteLength(JSON.stringify(crudo)) > AVATAR_CONFIG_MAX_BYTES) {
    throw new PayloadTooLargeException({ codigo: 'AVATAR_GRANDE', mensaje: 'La configuración del avatar es demasiado grande.' });
  }
  const c = crudo as Record<string, unknown>;
  const nombre = typeof c.nombre === 'string' ? c.nombre.trim() : '';
  if (nombre.length > 18) throw invalido('El apodo del avatar admite hasta 18 letras.');
  if (!GENEROS.includes(c.genero as string)) throw invalido('El género del avatar no es válido.');
  if (!EXPRESIONES.includes(c.expresion as string)) throw invalido('La expresión del avatar no es válida.');
  const disfraz = c.disfraz == null ? null : typeof c.disfraz === 'string' && c.disfraz.length <= 40 ? c.disfraz : undefined;
  if (disfraz === undefined) throw invalido('El nombre del disfraz no es válido.');
  const salida: Record<string, unknown> = {
    nombre,
    genero: c.genero,
    piel: hex(c.piel, 'piel'),
    ojos: hex(c.ojos, 'ojos'),
    expresion: c.expresion,
    colorPelo: hex(c.colorPelo, 'cabello'),
    disfraz,
    disfrazId: c.disfrazId == null ? null : id(c.disfrazId, 'disfraz'),
  };
  // mostrarAlEntrar: booleano opcional
  if (c.mostrarAlEntrar !== undefined) {
    if (typeof c.mostrarAlEntrar !== 'boolean') throw invalido('«Mostrar mi avatar al entrar» no es válido.');
    salida.mostrarAlEntrar = c.mostrarAlEntrar;
  }
  for (const k of PIEZAS) {
    const p = c[k] as { id?: unknown; colores?: unknown } | undefined;
    if (!p || typeof p !== 'object') throw invalido(`Falta la pieza «${k}».`);
    const colores: Record<string, string> = {};
    const crudos = p.colores ?? {};
    if (typeof crudos !== 'object' || Array.isArray(crudos)) throw invalido(`Los colores de «${k}» no son válidos.`);
    for (const [slot, valor] of Object.entries(crudos as Record<string, unknown>)) {
      if (!SLOTS.includes(slot)) throw invalido(`Color desconocido en «${k}».`);
      colores[slot] = hex(valor, k);
    }
    salida[k] = { id: id(p.id, k), colores };
  }
  return salida as unknown as AvatarConfig;
}

/** Retrato en data URL PNG (hasta 200 KB). Devuelve los bytes ya verificados por su firma PNG. */
export function retratoDesdeDataUrl(dataUrl: unknown): Buffer {
  const m = typeof dataUrl === 'string' ? /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!m) throw new BadRequestException({ codigo: 'AVATAR_RETRATO_INVALIDO', mensaje: 'El retrato del avatar debe ser una imagen PNG.' });
  const grande = () =>
    new PayloadTooLargeException({ codigo: 'AVATAR_RETRATO_GRANDE', mensaje: 'El retrato del avatar no puede pasar de 200 KB.' });
  // El tope se mira antes de decodificar: base64 pesa ~4/3 de los bytes reales
  if (m[1].length > Math.ceil((AVATAR_RETRATO_MAX_BYTES * 4) / 3) + 4) throw grande();
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > AVATAR_RETRATO_MAX_BYTES) throw grande();
  if (buf.length < 8 || !buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new BadRequestException({ codigo: 'AVATAR_RETRATO_INVALIDO', mensaje: 'El retrato del avatar debe ser una imagen PNG.' });
  }
  return buf;
}

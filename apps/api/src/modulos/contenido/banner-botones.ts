import { BadRequestException } from '@nestjs/common';

// Botones del banner «Caprichos del mes»: texto y visibilidad editables desde el diseñador.
// Viven dentro del JSON `banner` de la versión de la carta (sin migración); si faltan, valen los de siempre.
export const BOTONES_BANNER_DEFECTO = {
  textoBotonPrincipal: 'Pedir ahora',
  botonPrincipalActivo: true,
  textoBotonSecundario: 'Ver la carta',
  botonSecundarioActivo: true,
};
export const MAX_TEXTO_BOTON = 24;

/** Quita HTML (< y >) y espacios sobrantes; la carta además escapa al pintar. */
const limpiar = (v: unknown) => (typeof v === 'string' ? v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim() : '');

function texto(valor: unknown, defecto: string, nombre: string, estricto: boolean): string {
  if (valor === undefined || valor === null) return defecto;
  const t = limpiar(valor);
  if (t.length >= 1 && t.length <= MAX_TEXTO_BOTON) return t;
  if (estricto) throw new BadRequestException(`El texto del botón (${nombre}) debe tener de 1 a ${MAX_TEXTO_BOTON} caracteres`);
  return defecto;
}

const activo = (v: unknown) => v !== false;

// ---- Modo «Mis banners (imágenes)»: carrusel que reemplaza por completo al banner del mes ----
export const MODOS_BANNER = ['MES', 'IMAGENES'] as const;
export const MAX_BANNERS_IMAGEN = 8;
export const INTERVALO_BANNER = { min: 3, max: 15, defecto: 5 };
export const TIPOS_ENLACE_BANNER = ['CARTA', 'CATEGORIA', 'PRODUCTO', 'URL'] as const;
const MAX_ALT = 150;

/** Imagen propia: ruta de archivos subidos o https. Nunca javascript:, data: ni http plano. */
export function urlImagenSegura(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const u = v.trim();
  if (/^\/(archivos|imagenes)\/[^\s<>"']+$/.test(u)) return u;
  return urlHttpsSegura(u);
}

/** URL externa permitida: solo https con host. */
export function urlHttpsSegura(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 500) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' && u.hostname.includes('.') && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

function enlace(e: any, estricto: boolean, pos: number): { tipo: string; valor?: string } | undefined {
  if (!e || typeof e !== 'object' || !e.tipo) return undefined;
  const tipo = String(e.tipo);
  if (!(TIPOS_ENLACE_BANNER as readonly string[]).includes(tipo)) {
    if (estricto) throw new BadRequestException(`Banner ${pos}: tipo de enlace no válido`);
    return undefined;
  }
  if (tipo === 'CARTA') return { tipo };
  if (tipo === 'URL') {
    const url = urlHttpsSegura(e.valor);
    if (!url) {
      if (estricto) throw new BadRequestException(`Banner ${pos}: el enlace debe ser una dirección https:// segura`);
      return undefined;
    }
    return { tipo, valor: url };
  }
  const valor = limpiar(e.valor);
  if (!/^\d{1,18}$/.test(valor)) {
    if (estricto) throw new BadRequestException(`Banner ${pos}: elige de la lista la ${tipo === 'CATEGORIA' ? 'categoría' : 'producto'} del enlace`);
    return undefined;
  }
  return { tipo, valor };
}

/** Fecha AAAA-MM-DD (día de Lima): «desde» empieza a las 00:00 y «hasta» termina a las 23:59:59. */
function fecha(v: unknown, estricto: boolean, pos: number, nombre: string): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const t = String(v);
  const d = new Date(`${t}T00:00:00Z`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(d.getTime()) && d.toISOString().startsWith(t)) return t;
  if (estricto) throw new BadRequestException(`Banner ${pos}: la fecha «${nombre}» no es válida`);
  return undefined;
}

/** Hoy en Lima como AAAA-MM-DD. */
export function hoyLima(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

export const vigenteHoy = (b: { desde?: string; hasta?: string }, hoy: string) => (!b.desde || hoy >= b.desde) && (!b.hasta || hoy <= b.hasta);

function imagenes(lista: unknown, estricto: boolean) {
  if (lista === undefined || lista === null) return [];
  if (!Array.isArray(lista)) {
    if (estricto) throw new BadRequestException('La lista de banners no es válida');
    return [];
  }
  if (lista.length > MAX_BANNERS_IMAGEN && estricto) throw new BadRequestException(`Máximo ${MAX_BANNERS_IMAGEN} banners`);
  const salida: Record<string, unknown>[] = [];
  lista.slice(0, MAX_BANNERS_IMAGEN).forEach((b: any, i) => {
    const url = urlImagenSegura(b?.url);
    if (!url) {
      if (estricto) throw new BadRequestException(`Banner ${i + 1}: falta la imagen o su dirección no es válida`);
      return;
    }
    const urlCelular = b?.urlCelular ? urlImagenSegura(b.urlCelular) : null;
    if (b?.urlCelular && !urlCelular && estricto) throw new BadRequestException(`Banner ${i + 1}: la imagen de celular no es válida`);
    const alt = limpiar(b?.alt).slice(0, MAX_ALT);
    const en = enlace(b?.enlace, estricto, i + 1);
    const desde = fecha(b?.desde, estricto, i + 1, 'desde');
    const hasta = fecha(b?.hasta, estricto, i + 1, 'hasta');
    if (desde && hasta && hasta < desde) {
      if (estricto) throw new BadRequestException(`Banner ${i + 1}: «Mostrar hasta» no puede ser anterior a «Mostrar desde»`);
      return;
    }
    salida.push({
      ...(desde ? { desde } : {}),
      ...(hasta ? { hasta } : {}),
      id: limpiar(b?.id).slice(0, 40) || `b${i + 1}`,
      url,
      ...(urlCelular ? { urlCelular } : {}),
      alt,
      ...(en ? { enlace: en } : {}),
      activo: activo(b?.activo),
    });
  });
  return salida;
}

function intervalo(v: unknown, estricto: boolean): number {
  if (v === undefined || v === null) return INTERVALO_BANNER.defecto;
  const n = Number(v);
  if (Number.isInteger(n) && n >= INTERVALO_BANNER.min && n <= INTERVALO_BANNER.max) return n;
  if (estricto) throw new BadRequestException(`El intervalo debe ser de ${INTERVALO_BANNER.min} a ${INTERVALO_BANNER.max} segundos`);
  return INTERVALO_BANNER.defecto;
}

function modo(v: unknown, estricto: boolean): string {
  if (v === undefined || v === null) return 'MES';
  if ((MODOS_BANNER as readonly string[]).includes(v as string)) return v as string;
  if (estricto) throw new BadRequestException('Modo de banner no válido');
  return 'MES';
}

/** Devuelve el banner con los 4 campos de botones completos. `estricto` (guardar) rechaza textos inválidos; si no, usa el valor por defecto. */
export function normalizarBotonesBanner<T extends Record<string, any>>(banner: T, estricto = false) {
  const d = BOTONES_BANNER_DEFECTO;
  return {
    ...banner,
    textoBotonPrincipal: texto(banner?.textoBotonPrincipal, d.textoBotonPrincipal, 'principal', estricto),
    botonPrincipalActivo: activo(banner?.botonPrincipalActivo),
    textoBotonSecundario: texto(banner?.textoBotonSecundario, d.textoBotonSecundario, 'secundario', estricto),
    botonSecundarioActivo: activo(banner?.botonSecundarioActivo),
    modo: modo(banner?.modo, estricto),
    intervaloSeg: intervalo(banner?.intervaloSeg, estricto),
    imagenes: imagenes(banner?.imagenes, estricto),
  };
}

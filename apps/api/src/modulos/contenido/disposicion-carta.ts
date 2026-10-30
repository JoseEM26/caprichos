import { BadRequestException } from '@nestjs/common';

// Ajustes de tamaño y posición de la carta pública. Viven dentro de versionCarta.contenido.disposicion
// (borrador y publicada, mismo flujo que banner y promos). Los valores por defecto reproducen
// exactamente el diseño anterior, así que una carta sin disposición se ve igual que antes.

export const SECCIONES_CARTA = ['mes', 'franja', 'momentos', 'novedades', 'categorias'] as const;
export const ITEMS_FRANJA = ['estado', 'delivery', 'entrega', 'medios'] as const;
export const TAMANOS_BANNER = ['compacto', 'normal', 'grande'] as const;
export const AJUSTES_FOTO = ['cubrir', 'contener'] as const;
export const FOCOS_FOTO = ['arriba', 'centro', 'abajo'] as const;
export const TAMANOS_TARJETA = ['chico', 'normal', 'grande'] as const;
export const COLUMNAS_CARTA = ['auto', '2', '3', '4'] as const;

export interface DisposicionCarta {
  secciones: { id: string; visible: boolean }[];
  banner: { tamanoPc: string; tamanoCelular: string; ajusteFoto: string; focoFoto: string };
  franja: { items: { id: string; visible: boolean }[] };
  momentos: { tamano: string };
  novedades: { tamano: string };
  carta: { columnasPc: string };
}

export const DISPOSICION_CARTA_DEFECTO: DisposicionCarta = {
  secciones: SECCIONES_CARTA.map((id) => ({ id, visible: true })),
  banner: { tamanoPc: 'normal', tamanoCelular: 'normal', ajusteFoto: 'cubrir', focoFoto: 'centro' },
  franja: { items: ITEMS_FRANJA.map((id) => ({ id, visible: true })) },
  momentos: { tamano: 'normal' },
  novedades: { tamano: 'normal' },
  carta: { columnasPc: 'auto' },
};

const esObjeto = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Valida y completa la disposición. Con `estricto` lanza 400 ante cualquier valor fuera de
 * catálogo (al guardar el borrador); sin `estricto` cae al valor por defecto (al leer la carta
 * pública, para que un dato viejo nunca rompa la carta).
 */
export function resolverDisposicionCarta(raw: unknown, estricto = false): DisposicionCarta {
  const errores: string[] = [];
  const d = DISPOSICION_CARTA_DEFECTO;
  const src: Record<string, any> = esObjeto(raw) ? raw : {};

  const enumerado = (valor: unknown, permitidos: readonly string[], defecto: string, campo: string): string => {
    if (valor === undefined || valor === null) return defecto;
    if (typeof valor === 'string' && permitidos.includes(valor)) return valor;
    errores.push(`${campo} no es válido`);
    return defecto;
  };

  // Secciones: orden completo y sin repetir; ocultar = visible false
  let secciones = d.secciones;
  if (src.secciones !== undefined) {
    const lista = Array.isArray(src.secciones) ? src.secciones : null;
    const ids = (lista ?? []).map((s: any) => s?.id);
    const completo =
      lista !== null &&
      lista.length === SECCIONES_CARTA.length &&
      SECCIONES_CARTA.every((id) => ids.includes(id)) &&
      lista.every((s: any) => esObjeto(s) && typeof s.visible === 'boolean');
    if (completo) {
      secciones = lista!.map((s: any) => ({ id: s.id, visible: s.visible }));
    } else {
      errores.push('secciones debe listar cada sección una sola vez, con visible true o false');
    }
  }

  // Franja de datos: mismo criterio que secciones
  let items = d.franja.items;
  if (src.franja !== undefined) {
    const lista = esObjeto(src.franja) && Array.isArray(src.franja.items) ? src.franja.items : null;
    const ids = (lista ?? []).map((s: any) => s?.id);
    const completo =
      lista !== null &&
      lista.length === ITEMS_FRANJA.length &&
      ITEMS_FRANJA.every((id) => ids.includes(id)) &&
      lista.every((s: any) => esObjeto(s) && typeof s.visible === 'boolean');
    if (completo) {
      items = lista!.map((s: any) => ({ id: s.id, visible: s.visible }));
    } else {
      errores.push('franja.items debe listar cada dato una sola vez, con visible true o false');
    }
  }

  const banner = esObjeto(src.banner) ? src.banner : {};
  const momentos = esObjeto(src.momentos) ? src.momentos : {};
  const novedades = esObjeto(src.novedades) ? src.novedades : {};
  const carta = esObjeto(src.carta) ? src.carta : {};

  const resultado: DisposicionCarta = {
    secciones,
    banner: {
      tamanoPc: enumerado(banner.tamanoPc, TAMANOS_BANNER, d.banner.tamanoPc, 'banner.tamanoPc'),
      tamanoCelular: enumerado(banner.tamanoCelular, TAMANOS_BANNER, d.banner.tamanoCelular, 'banner.tamanoCelular'),
      ajusteFoto: enumerado(banner.ajusteFoto, AJUSTES_FOTO, d.banner.ajusteFoto, 'banner.ajusteFoto'),
      focoFoto: enumerado(banner.focoFoto, FOCOS_FOTO, d.banner.focoFoto, 'banner.focoFoto'),
    },
    franja: { items },
    momentos: { tamano: enumerado(momentos.tamano, TAMANOS_TARJETA, d.momentos.tamano, 'momentos.tamano') },
    novedades: { tamano: enumerado(novedades.tamano, TAMANOS_TARJETA, d.novedades.tamano, 'novedades.tamano') },
    carta: { columnasPc: enumerado(carta.columnasPc, COLUMNAS_CARTA, d.carta.columnasPc, 'carta.columnasPc') },
  };

  if (estricto && errores.length > 0) {
    throw new BadRequestException(`Disposición de la carta no válida: ${errores.join('; ')}`);
  }
  return resultado;
}

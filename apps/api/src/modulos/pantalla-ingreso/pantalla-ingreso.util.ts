import { BadRequestException } from '@nestjs/common';
import {
  FRASE_INGRESO_POR_DEFECTO,
  IMAGEN_INGRESO_POR_DEFECTO,
  IMAGENES_FABRICA,
  MAX_IMAGENES_INGRESO,
  MAX_LONGITUD_FRASE_INGRESO,
  REGEX_ARCHIVO_PUBLICO,
  RUTA_IMAGENES_FABRICA,
} from './pantalla-ingreso.constantes';
import { ImagenIngreso, PantallaIngresoConfig, PantallaIngresoPublica } from './pantalla-ingreso.tipos';

export const CONFIG_INGRESO_POR_DEFECTO: PantallaIngresoConfig = {
  imagenes: [{ tipo: 'defecto', valor: IMAGEN_INGRESO_POR_DEFECTO }],
  frase: FRASE_INGRESO_POR_DEFECTO,
};

/**
 * Lectura defensiva de lo guardado: descarta entradas mal formadas y,
 * si no queda ninguna válida, usa la imagen por defecto.
 */
export function resolverImagenesIngreso(crudo: unknown): ImagenIngreso[] {
  const lista = Array.isArray(crudo) ? crudo : [];
  const validas: ImagenIngreso[] = [];
  for (const item of lista) {
    if (!item || typeof item !== 'object') continue;
    const { tipo, valor } = item as Record<string, unknown>;
    if (typeof valor !== 'string' || valor.length === 0) continue;
    if (tipo === 'defecto' && (IMAGENES_FABRICA as readonly string[]).includes(valor)) {
      validas.push({ tipo, valor });
    } else if (tipo === 'archivo' && REGEX_ARCHIVO_PUBLICO.test(valor) && !valor.includes('..')) {
      validas.push({ tipo, valor });
    }
    if (validas.length >= MAX_IMAGENES_INGRESO) break;
  }
  return validas.length > 0 ? validas : [...CONFIG_INGRESO_POR_DEFECTO.imagenes];
}

/** Frase guardada, o la de fábrica si no hay una válida. */
export function resolverFraseIngreso(crudo: unknown): string {
  if (typeof crudo !== 'string') return FRASE_INGRESO_POR_DEFECTO;
  const limpia = crudo.trim();
  if (!limpia || limpia.length > MAX_LONGITUD_FRASE_INGRESO) return FRASE_INGRESO_POR_DEFECTO;
  return limpia;
}

export function urlImagenIngreso(imagen: ImagenIngreso): string {
  return imagen.tipo === 'defecto' ? `${RUTA_IMAGENES_FABRICA}${imagen.valor}` : imagen.valor;
}

export function construirPantallaIngresoPublica(config: PantallaIngresoConfig): PantallaIngresoPublica {
  return {
    imagenes: config.imagenes.map(urlImagenIngreso),
    frase: config.frase,
  };
}

/**
 * Validación estricta de lo que envía el administrador. Lanza 400 ante cualquier
 * dato fuera de lo permitido. No consulta la base: la existencia de los archivos
 * propios la comprueba el servicio.
 */
export function validarPantallaIngreso(entrada: {
  imagenes: ImagenIngreso[];
  frase?: string | null;
}): PantallaIngresoConfig {
  const { imagenes } = entrada;
  if (!Array.isArray(imagenes) || imagenes.length === 0) {
    throw new BadRequestException('Elige al menos una imagen para la pantalla de ingreso');
  }
  if (imagenes.length > MAX_IMAGENES_INGRESO) {
    throw new BadRequestException(`Puedes elegir hasta ${MAX_IMAGENES_INGRESO} imágenes`);
  }

  const vistas = new Set<string>();
  const normalizadas: ImagenIngreso[] = imagenes.map((img) => {
    if (img.tipo === 'defecto') {
      if (!(IMAGENES_FABRICA as readonly string[]).includes(img.valor)) {
        throw new BadRequestException(`La imagen de fábrica "${img.valor}" no existe`);
      }
    } else if (img.tipo === 'archivo') {
      if (!REGEX_ARCHIVO_PUBLICO.test(img.valor) || img.valor.includes('..')) {
        throw new BadRequestException('Solo se aceptan imágenes propias subidas al sistema');
      }
    } else {
      throw new BadRequestException('Tipo de imagen no válido');
    }
    if (vistas.has(img.valor)) {
      throw new BadRequestException('Una misma imagen no puede repetirse en la pantalla de ingreso');
    }
    vistas.add(img.valor);
    return { tipo: img.tipo, valor: img.valor };
  });

  const frase = (entrada.frase ?? '').trim();
  if (frase.length > MAX_LONGITUD_FRASE_INGRESO) {
    throw new BadRequestException(`La frase no puede superar ${MAX_LONGITUD_FRASE_INGRESO} caracteres`);
  }
  if (/[<>]/.test(frase)) {
    throw new BadRequestException('La frase no puede contener los caracteres < o >');
  }

  return {
    imagenes: normalizadas,
    frase: frase || FRASE_INGRESO_POR_DEFECTO,
  };
}

/**
 * aspectoUtils.ts
 * Lógica pura de validación, fusión y resolución de aspecto según temas y fecha en Lima.
 */

import {
  type AspectoCapri,
  type ConfiguracionMascota,
  type TemaMascota,
  type EstiloCabello,
  type TipoGorro,
  type TipoPrenda,
  type TipoAccesorio,
  ASPECTO_BASE_DEFECTO,
  CONFIGURACION_DEFECTO,
  ESCALA_DEFECTO,
  ESCALA_MAXIMA,
  ESCALA_MINIMA,
  ESTILOS_CABELLO,
  TEMAS_PREDETERMINADOS,
  TIPOS_GORRO,
  TIPOS_PRENDA,
  TIPOS_ACCESORIOS,
} from './tiposAspecto';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Valida y normaliza un color hexadecimal #RRGGBB. Si no es válido, devuelve el fallback.
 */
export function sanitizarColorHex(color: unknown, fallback: string): string {
  if (typeof color === 'string' && HEX_COLOR_REGEX.test(color)) {
    return color.toUpperCase();
  }
  return fallback;
}

/**
 * Normaliza y sanea un objeto AspectoCapri para asegurar que todos los campos requeridos
 * sean válidos y pertenezcan a la lista blanca permitida.
 */
export function sanitizarAspecto(aspecto?: unknown): AspectoCapri {
  if (!aspecto || typeof aspecto !== 'object') {
    return { ...ASPECTO_BASE_DEFECTO };
  }

  const raw = aspecto as Record<string, any>;
  const def = ASPECTO_BASE_DEFECTO;

  const piel = sanitizarColorHex(raw.piel, def.piel);

  const rawCabello = raw.cabello && typeof raw.cabello === 'object' ? raw.cabello : {};
  const estiloCabello: EstiloCabello = ESTILOS_CABELLO.includes(rawCabello.estilo)
    ? rawCabello.estilo
    : def.cabello.estilo;
  const colorCabello = sanitizarColorHex(rawCabello.color, def.cabello.color);

  const ojos = sanitizarColorHex(raw.ojos, def.ojos);

  const rawUniforme = raw.uniforme && typeof raw.uniforme === 'object' ? raw.uniforme : {};
  const uniformePrincipal = sanitizarColorHex(rawUniforme.principal, def.uniforme.principal);
  const uniformeDelantal = sanitizarColorHex(rawUniforme.delantal, def.uniforme.delantal);
  const uniformeRibete = sanitizarColorHex(rawUniforme.ribete, def.uniforme.ribete);

  const rawGorro = raw.gorro && typeof raw.gorro === 'object' ? raw.gorro : {};
  const tipoGorro: TipoGorro = TIPOS_GORRO.includes(rawGorro.tipo) ? rawGorro.tipo : def.gorro.tipo;
  const colorGorro = sanitizarColorHex(rawGorro.color, def.gorro.color);

  const rawPrenda = rawUniforme.prenda;
  const prenda: TipoPrenda = TIPOS_PRENDA.includes(rawPrenda) ? rawPrenda : def.uniforme.prenda!;

  let accesorios: TipoAccesorio[] = [];
  if (Array.isArray(raw.accesorios)) {
    accesorios = raw.accesorios.filter((acc: any): acc is TipoAccesorio =>
      TIPOS_ACCESORIOS.includes(acc)
    );
  }

  return {
    piel,
    cabello: {
      color: colorCabello,
      estilo: estiloCabello,
    },
    ojos,
    uniforme: {
      principal: uniformePrincipal,
      delantal: uniformeDelantal,
      ribete: uniformeRibete,
      prenda,
    },
    gorro: {
      tipo: tipoGorro,
      color: colorGorro,
    },
    accesorios,
  };
}

/**
 * Escala de Capri limitada a [ESCALA_MINIMA, ESCALA_MAXIMA]; lo no numérico vale ESCALA_DEFECTO.
 */
export function sanitizarEscala(valor: unknown): number {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return ESCALA_DEFECTO;
  return Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, n));
}

/**
 * Sanea una configuración completa (la de la API o una guardada antes de estas opciones).
 * Todo campo ausente o desconocido cae al valor por defecto; nunca lanza.
 */
export function sanitizarConfiguracion(raw: unknown): ConfiguracionMascota {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
  const temas: TemaMascota[] =
    Array.isArray(r.temas) && r.temas.length > 0 ? r.temas : TEMAS_PREDETERMINADOS;
  return {
    base: sanitizarAspecto(r.base),
    temas,
    modo: r.modo === 'MANUAL' ? 'MANUAL' : 'AUTOMATICO',
    temaManual: typeof r.temaManual === 'string' ? r.temaManual : 'normal',
    escala: sanitizarEscala(r.escala),
  };
}

/**
 * Extrae la configuración de la respuesta de GET /admin/mascota. El API la devuelve plana
 * (base, temas, modo...); se acepta también la forma envuelta { config }.
 */
export function extraerConfiguracion(respuesta: unknown): ConfiguracionMascota {
  const r = respuesta && typeof respuesta === 'object' ? (respuesta as Record<string, any>) : {};
  return sanitizarConfiguracion(r.config && typeof r.config === 'object' ? r.config : r);
}

/**
 * Fusiona un aspecto base con uno parcial (como el definido en un tema).
 */
export function fusionarAspecto(
  base: AspectoCapri,
  parcial?: Partial<{
    piel: string;
    cabello: Partial<{ color: string; estilo: EstiloCabello }>;
    ojos: string;
    uniforme: Partial<{ principal: string; delantal: string; ribete: string; prenda: TipoPrenda }>;
    gorro: Partial<{ tipo: TipoGorro; color: string }>;
    accesorios: TipoAccesorio[];
  }>
): AspectoCapri {
  if (!parcial) return { ...base };

  const piel = parcial.piel ? sanitizarColorHex(parcial.piel, base.piel) : base.piel;

  const cabello = {
    color: parcial.cabello?.color
      ? sanitizarColorHex(parcial.cabello.color, base.cabello.color)
      : base.cabello.color,
    estilo:
      parcial.cabello?.estilo && ESTILOS_CABELLO.includes(parcial.cabello.estilo)
        ? parcial.cabello.estilo
        : base.cabello.estilo,
  };

  const ojos = parcial.ojos ? sanitizarColorHex(parcial.ojos, base.ojos) : base.ojos;

  const uniforme = {
    principal: parcial.uniforme?.principal
      ? sanitizarColorHex(parcial.uniforme.principal, base.uniforme.principal)
      : base.uniforme.principal,
    delantal: parcial.uniforme?.delantal
      ? sanitizarColorHex(parcial.uniforme.delantal, base.uniforme.delantal)
      : base.uniforme.delantal,
    ribete: parcial.uniforme?.ribete
      ? sanitizarColorHex(parcial.uniforme.ribete, base.uniforme.ribete)
      : base.uniforme.ribete,
    prenda:
      parcial.uniforme?.prenda && TIPOS_PRENDA.includes(parcial.uniforme.prenda)
        ? parcial.uniforme.prenda
        : base.uniforme.prenda,
  };

  // el gorro elegido por el negocio manda siempre; los temas no lo pisan
  const gorro = { ...base.gorro };

  // (uniforme.prenda se hereda del base si el tema no la define)

  const accesorios = Array.isArray(parcial.accesorios)
    ? parcial.accesorios.filter((acc): acc is TipoAccesorio => TIPOS_ACCESORIOS.includes(acc))
    : base.accesorios;

  return {
    piel,
    cabello,
    ojos,
    uniforme,
    gorro,
    accesorios,
  };
}

/**
 * Obtiene la fecha actual en zona horaria America/Lima formateada como 'MM-DD'.
 */
export function obtenerFechaHoyLima(): string {
  try {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      month: '2-digit',
      day: '2-digit',
    });
    const partes = formatter.formatToParts(d);
    const mes = partes.find((p) => p.type === 'month')?.value || '01';
    const dia = partes.find((p) => p.type === 'day')?.value || '01';
    return `${mes}-${dia}`;
  } catch {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${mes}-${dia}`;
  }
}

/**
 * Determina si una fecha MM-DD se encuentra dentro de un rango desde/hasta.
 * Maneja rangos regulares (ej. 10-24 a 11-02) y rangos que cruzan fin de año (ej. 12-27 a 01-02).
 */
export function estaEnRango(fecha: string, desde: string, hasta: string): boolean {
  if (desde <= hasta) {
    return fecha >= desde && fecha <= hasta;
  }
  // Rango que cruza fin de año (ej. 12-27 a 01-02)
  return fecha >= desde || fecha <= hasta;
}

/**
 * Convierte MM-DD a número ordinal aproximado de día del año (asumiendo año regular de 365 días)
 */
function diaOrdinal(mmdd: string): number {
  const [mmStr, ddStr] = mmdd.split('-');
  const mm = parseInt(mmStr || '1', 10);
  const dd = parseInt(ddStr || '1', 10);
  const diasPorMes = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let suma = 0;
  for (let i = 1; i < mm; i++) {
    suma += diasPorMes[i] || 30;
  }
  return suma + dd;
}

/**
 * Calcula la duración en días de un rango desde/hasta para resolver empates (rango más corto gana).
 */
export function calcularDuracionRango(desde: string, hasta: string): number {
  const dDesde = diaOrdinal(desde);
  const dHasta = diaOrdinal(hasta);
  if (dHasta >= dDesde) {
    return dHasta - dDesde + 1;
  }
  return 365 - dDesde + dHasta + 1;
}

/**
 * Resuelve el aspecto final aplicando el tema correspondiente según la configuración y la fecha en Lima.
 */
export function resolverAspecto(
  configProp?: ConfiguracionMascota,
  fechaProp?: string
): { aspecto: AspectoCapri; tema: string } {
  const config = configProp || CONFIGURACION_DEFECTO;
  const base = sanitizarAspecto(config.base || ASPECTO_BASE_DEFECTO);
  const temas = Array.isArray(config.temas) ? config.temas : [];
  const modo = config.modo || 'AUTOMATICO';
  const fecha = fechaProp || obtenerFechaHoyLima();

  if (modo === 'MANUAL') {
    const clave = config.temaManual || 'normal';
    if (clave === 'normal') {
      return { aspecto: base, tema: 'normal' };
    }
    const temaEncontrado = temas.find((t) => t.clave === clave && t.activo);
    if (temaEncontrado) {
      return {
        aspecto: fusionarAspecto(base, temaEncontrado.aspecto),
        tema: temaEncontrado.clave,
      };
    }
    return { aspecto: base, tema: 'normal' };
  }

  // Modo AUTOMATICO
  const temasCoincidentes: { tema: TemaMascota; duracion: number }[] = [];

  for (const t of temas) {
    if (!t.activo || !t.desde || !t.hasta) continue;
    if (estaEnRango(fecha, t.desde, t.hasta)) {
      temasCoincidentes.push({
        tema: t,
        duracion: calcularDuracionRango(t.desde, t.hasta),
      });
    }
  }

  if (temasCoincidentes.length === 0) {
    return { aspecto: base, tema: 'normal' };
  }

  // Si hay varios coincidentes, gana el de menor duración (más específico)
  temasCoincidentes.sort((a, b) => a.duracion - b.duracion);
  const ganador = temasCoincidentes[0].tema;

  return {
    aspecto: fusionarAspecto(base, ganador.aspecto),
    tema: ganador.clave,
  };
}

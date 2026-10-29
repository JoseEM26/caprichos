import {
  ACCESORIOS_VALIDOS,
  DEFAULT_ASPECTO_BASE,
  DEFAULT_MASCOTA_CONFIG,
  DEFAULT_TEMAS,
  ESCALA_DEFECTO,
  ESCALA_MAXIMA,
  ESCALA_MINIMA,
  ESTILOS_CABELLO,
  PRENDAS_UNIFORME,
  TIPOS_GORRO,
} from './mascota.constantes';
import {
  AspectoBase,
  AspectoParcial,
  AspectoResuelto,
  MascotaConfig,
  TemaMascota,
} from './mascota.tipos';

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Convierte un formato 'MM-DD' en el número de día del año (1 a 365).
 */
export function mmDdADiaDelAno(mmDd: string): number {
  const [mStr, dStr] = mmDd.split('-');
  const m = Math.max(1, Math.min(12, parseInt(mStr, 10) || 1));
  const d = Math.max(1, Math.min(31, parseInt(dStr, 10) || 1));
  let dia = d;
  for (let i = 0; i < m - 1; i++) {
    dia += DIAS_POR_MES[i];
  }
  return dia;
}

/**
 * Calcula la duración inclusiva en días entre dos fechas 'MM-DD'.
 * Maneja rangos dentro del mismo año y rangos que cruzan fin de año.
 */
export function calcularDuracionDias(desde: string, hasta: string): number {
  const dDesde = mmDdADiaDelAno(desde);
  const dHasta = mmDdADiaDelAno(hasta);
  if (dDesde <= dHasta) {
    return dHasta - dDesde + 1;
  }
  // Cruza el fin de año (ejemplo: 12-27 a 01-02 -> (365 - 361) + 2 + 1 = 7 días)
  return 365 - dDesde + dHasta + 1;
}

/**
 * Verifica si una fecha 'MM-DD' está contenida en el rango inclusivo [desde, hasta].
 * Soporta rangos que cruzan fin de año.
 */
export function estaEnRango(fechaMMDD: string, desde: string, hasta: string): boolean {
  if (desde <= hasta) {
    return fechaMMDD >= desde && fechaMMDD <= hasta;
  }
  // Cruza fin de año (ej. 12-27 a 01-02)
  return fechaMMDD >= desde || fechaMMDD <= hasta;
}

/**
 * Obtiene la representación 'MM-DD' correspondiente a la zona horaria America/Lima (UTC-5).
 */
export function obtenerFechaLima(fecha?: Date | string): string {
  if (
    typeof fecha === 'string' &&
    /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(fecha)
  ) {
    return fecha;
  }
  const d = fecha
    ? typeof fecha === 'string'
      ? new Date(fecha)
      : fecha
    : new Date();

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  return `${month}-${day}`;
}

/**
 * Fusiona de manera profunda un aspecto base con los campos parciales definidos por un tema.
 */
export function fusionarAspecto(
  base: AspectoBase,
  parcial?: AspectoParcial | null,
): AspectoBase {
  if (!parcial) {
    return {
      piel: base.piel,
      cabello: { ...base.cabello },
      ojos: base.ojos,
      uniforme: { ...base.uniforme },
      gorro: { ...base.gorro },
      accesorios: [...base.accesorios],
    };
  }

  return {
    piel: parcial.piel ?? base.piel,
    cabello: {
      color: parcial.cabello?.color ?? base.cabello.color,
      estilo: parcial.cabello?.estilo ?? base.cabello.estilo,
    },
    ojos: parcial.ojos ?? base.ojos,
    uniforme: {
      principal: parcial.uniforme?.principal ?? base.uniforme.principal,
      delantal: parcial.uniforme?.delantal ?? base.uniforme.delantal,
      ribete: parcial.uniforme?.ribete ?? base.uniforme.ribete,
      prenda: parcial.uniforme?.prenda ?? base.uniforme.prenda,
    },
    // el gorro elegido por el negocio manda siempre; los temas no lo pisan
    gorro: { ...base.gorro },
    accesorios:
      parcial.accesorios !== undefined
        ? [...parcial.accesorios]
        : [...base.accesorios],
  };
}

/** Escala de Capri limitada a [ESCALA_MINIMA, ESCALA_MAXIMA]; lo no numérico vale ESCALA_DEFECTO. */
export function sanitizarEscala(valor: unknown): number {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return ESCALA_DEFECTO;
  return Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, n));
}

/**
 * Normaliza y completa una configuración asegurando valores válidos por defecto.
 */
export function normalizarMascotaConfig(
  config?: Partial<MascotaConfig> | null,
): MascotaConfig {
  if (!config) {
    return { ...DEFAULT_MASCOTA_CONFIG };
  }

  const base: AspectoBase = {
    piel: config.base?.piel || DEFAULT_ASPECTO_BASE.piel,
    cabello: {
      color:
        config.base?.cabello?.color || DEFAULT_ASPECTO_BASE.cabello.color,
      estilo:
        config.base?.cabello?.estilo || DEFAULT_ASPECTO_BASE.cabello.estilo,
    },
    ojos: config.base?.ojos || DEFAULT_ASPECTO_BASE.ojos,
    uniforme: {
      principal:
        config.base?.uniforme?.principal ||
        DEFAULT_ASPECTO_BASE.uniforme.principal,
      delantal:
        config.base?.uniforme?.delantal ||
        DEFAULT_ASPECTO_BASE.uniforme.delantal,
      ribete:
        config.base?.uniforme?.ribete || DEFAULT_ASPECTO_BASE.uniforme.ribete,
      prenda: (PRENDAS_UNIFORME as readonly string[]).includes(
        config.base?.uniforme?.prenda as string,
      )
        ? config.base!.uniforme!.prenda
        : DEFAULT_ASPECTO_BASE.uniforme.prenda,
    },
    gorro: {
      tipo: (TIPOS_GORRO as readonly string[]).includes(config.base?.gorro?.tipo as string)
        ? config.base!.gorro!.tipo
        : DEFAULT_ASPECTO_BASE.gorro.tipo,
      color: config.base?.gorro?.color || DEFAULT_ASPECTO_BASE.gorro.color,
    },
    accesorios: Array.isArray(config.base?.accesorios)
      ? config.base.accesorios.filter((a) =>
          (ACCESORIOS_VALIDOS as readonly string[]).includes(a),
        )
      : [...DEFAULT_ASPECTO_BASE.accesorios],
  };

  if (!(ESTILOS_CABELLO as readonly string[]).includes(base.cabello.estilo)) {
    base.cabello.estilo = DEFAULT_ASPECTO_BASE.cabello.estilo;
  }

  const temas: TemaMascota[] = Array.isArray(config.temas) && config.temas.length > 0
    ? config.temas
    : DEFAULT_TEMAS;

  const modo = config.modo === 'MANUAL' ? 'MANUAL' : 'AUTOMATICO';
  const temaManual = config.temaManual ?? 'normal';

  return {
    base,
    temas,
    modo,
    temaManual,
    escala: sanitizarEscala(config.escala),
  };
}

/**
 * Función pura resolverAspecto(config, fecha)
 * - Modo MANUAL: si temaManual no es 'normal' y el tema existe y está activo, aplica ese tema.
 *   Si temaManual es 'normal', el tema no existe o está inactivo -> aspecto base (tema: null).
 * - Modo AUTOMATICO: evalúa fecha en Lima. Filtra temas activos cuyo rango incluye la fecha.
 *   Si coinciden varios, desempata eligiendo el de menor duración en días.
 *   Si hay empate en duración, mantiene orden determinista (el primero definido).
 *   Si ninguno coincide -> aspecto base (tema: null).
 */
export function resolverAspecto(
  config?: Partial<MascotaConfig> | null,
  fecha?: Date | string,
): AspectoResuelto {
  const normalizada = normalizarMascotaConfig(config);
  const { base, temas, modo, temaManual } = normalizada;

  if (modo === 'MANUAL') {
    if (temaManual && temaManual !== 'normal') {
      const temaEncontrado = temas.find((t) => t.clave === temaManual);
      if (temaEncontrado && temaEncontrado.activo !== false) {
        return {
          tema: temaEncontrado.clave,
          aspecto: fusionarAspecto(base, temaEncontrado.aspecto),
        };
      }
    }
    return {
      tema: null,
      aspecto: fusionarAspecto(base, null),
    };
  }

  // Modo AUTOMATICO
  const fechaLimaMMDD = obtenerFechaLima(fecha);
  const temasActivosCoincidentes = temas.filter(
    (t) => t.activo === true && estaEnRango(fechaLimaMMDD, t.desde, t.hasta),
  );

  if (temasActivosCoincidentes.length === 0) {
    return {
      tema: null,
      aspecto: fusionarAspecto(base, null),
    };
  }

  if (temasActivosCoincidentes.length === 1) {
    const seleccionado = temasActivosCoincidentes[0];
    return {
      tema: seleccionado.clave,
      aspecto: fusionarAspecto(base, seleccionado.aspecto),
    };
  }

  // Desempate: rango más corto en días
  // Desempate secundario: orden original en la lista
  const temasConDuracion = temasActivosCoincidentes.map((t, index) => ({
    tema: t,
    duracion: calcularDuracionDias(t.desde, t.hasta),
    ordenOriginal: index,
  }));

  temasConDuracion.sort((a, b) => {
    if (a.duracion !== b.duracion) {
      return a.duracion - b.duracion;
    }
    return a.ordenOriginal - b.ordenOriginal;
  });

  const ganador = temasConDuracion[0].tema;
  return {
    tema: ganador.clave,
    aspecto: fusionarAspecto(base, ganador.aspecto),
  };
}

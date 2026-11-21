/** Anuncio tal como lo recibe quien lo ve (GET /carta/anuncios y GET /admin/anuncios/mios). */
export interface AnuncioPublico {
  id: string;
  plantilla: string;
  titulo: string;
  texto: string | null;
  imagen: string | null;
  botonTexto: string | null;
  botonEnlace: string | null;
  detalle: { precio?: string; cupon?: string; fecha?: string; lugar?: string; icono?: string } | null;
  color: string;
  frecuencia: string;
  vecesPorDia: number;
  cadaHoras: number | null;
  cierreSegundos: number;
  puedeCerrar: boolean;
}

export type TipoEventoAnuncio = 'VISTA' | 'CIERRE' | 'CLIC' | 'ENTENDIDO';

export const PLANTILLAS_ANUNCIO = [
  { id: 'NOVEDAD', nombre: 'Novedad', ayuda: 'Título, texto e imagen' },
  { id: 'PROMOCION', nombre: 'Promoción', ayuda: 'Imagen grande, precio o cupón y botón' },
  { id: 'AVISO', nombre: 'Aviso', ayuda: 'Informativo, con ícono' },
  { id: 'EVENTO', nombre: 'Evento', ayuda: 'Fecha y lugar' },
  { id: 'SOLO_IMAGEN', nombre: 'Solo imagen', ayuda: 'Un afiche' },
  { id: 'BIENVENIDA', nombre: 'Bienvenida', ayuda: 'Para la primera vez' },
  { id: 'COMUNICADO_INTERNO', nombre: 'Comunicado interno', ayuda: 'Para el personal, con «Entendido»' },
] as const;

/** Paleta de la marca: navy #0B2C3E, crema #FBF4EC, naranja #E67929, dorado #D99E39. */
export const COLORES_ANUNCIO: Record<string, { nombre: string; fondo: string; texto: string; acento: string }> = {
  NAVY: { nombre: 'Navy', fondo: '#0B2C3E', texto: '#FBF4EC', acento: '#D99E39' },
  CREMA: { nombre: 'Crema', fondo: '#FBF4EC', texto: '#0B2C3E', acento: '#E67929' },
  NARANJA: { nombre: 'Naranja', fondo: '#E67929', texto: '#FFFFFF', acento: '#0B2C3E' },
  DORADO: { nombre: 'Dorado', fondo: '#D99E39', texto: '#0B2C3E', acento: '#0B2C3E' },
};

/** Espejo de `tocaPorFrecuencia` de la API (apps/api/src/modulos/anuncios/anuncios.regla.ts). `vistas` en milisegundos. */
const diaLima = (ms: number): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date(ms));

export function tocaPorFrecuencia(
  a: Pick<AnuncioPublico, 'frecuencia' | 'vecesPorDia' | 'cadaHoras'>,
  vistas: number[],
  ahora: number = Date.now(),
): boolean {
  switch (a.frecuencia) {
    case 'CADA_INGRESO':
      return true;
    case 'VECES_POR_DIA': {
      const hoy = diaLima(ahora);
      return vistas.filter((v) => diaLima(v) === hoy).length < Math.max(1, a.vecesPorDia || 1);
    }
    case 'CADA_N_HORAS':
      return !vistas.some((v) => ahora - v < Math.max(1, a.cadaHoras || 1) * 3_600_000);
    default:
      return vistas.length === 0;
  }
}

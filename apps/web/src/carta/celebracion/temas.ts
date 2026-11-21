/**
 * Temáticas de la celebración del pedido. La fuente de verdad es la misma que usa la carta: `contenido.decoracion`
 * (ninguno, halloween, navidad, anonuevo, sanvalentin, madre, padre, patrias, ninos, aniversario) más `verano`.
 * Solo cambia el fondo, la letra y los colores: el avatar nunca se toca.
 */
export type Escenario = 'clasico' | 'navidad' | 'halloween' | 'patrias' | 'corazones' | 'fuegos' | 'verano' | 'flores';
export type FormaParticula = 'confeti' | 'nieve' | 'corazon' | 'estrella' | 'hoja' | 'burbuja';

export interface TemaCelebracion {
  id: string;
  fuente: { familia: string; google?: string; pila: string };
  /** Valor CSS de `background` del fondo */
  fondo: string;
  escenario: Escenario;
  particulas: { forma: FormaParticula; colores: string[]; sube?: boolean };
  cartel: { fondo: string; tinta: string; borde: string; acento: string };
  boton: { fondo: string; tinta: string; borde: string };
}

const SANS = 'Montserrat, "Open Sans", system-ui, sans-serif';

const CLASICO: TemaCelebracion = {
  id: 'clasico',
  fuente: { familia: 'Montserrat', pila: SANS },
  fondo: 'radial-gradient(circle at 50% 38%, #1B5873 0%, #0F3A52 45%, #0B2C3E 100%)',
  escenario: 'clasico',
  particulas: { forma: 'confeti', colores: ['#E67929', '#F2C14E', '#FFF4E1', '#E84A7F', '#3BB4E7'] },
  cartel: { fondo: '#FFF4E1', tinta: '#0B2C3E', borde: '#E67929', acento: '#A8430A' },
  boton: { fondo: '#FFF4E1', tinta: '#0B2C3E', borde: '#F2C14E' },
};

export const TEMAS: Record<string, TemaCelebracion> = {
  clasico: CLASICO,
  navidad: {
    id: 'navidad',
    fuente: { familia: 'Mountains of Christmas', google: 'Mountains+of+Christmas:wght@700', pila: '"Mountains of Christmas", "Trebuchet MS", cursive' },
    fondo: 'radial-gradient(circle at 50% 35%, #1F6B45 0%, #124A32 50%, #0A2E21 100%)',
    escenario: 'navidad',
    particulas: { forma: 'nieve', colores: ['#FFFFFF', '#E8F4FF'] },
    cartel: { fondo: '#FFF8EC', tinta: '#A3171F', borde: '#1F7A45', acento: '#14582F' },
    boton: { fondo: '#FFF8EC', tinta: '#0A2E21', borde: '#E4B94B' },
  },
  halloween: {
    id: 'halloween',
    fuente: { familia: 'Creepster', google: 'Creepster', pila: 'Creepster, "Chalkduster", fantasy' },
    fondo: 'radial-gradient(circle at 50% 30%, #4A2578 0%, #2B1650 50%, #150A2B 100%)',
    escenario: 'halloween',
    particulas: { forma: 'hoja', colores: ['#FF8A1F', '#B36AE0', '#FFB84D'] },
    cartel: { fondo: '#2A1647', tinta: '#FFA64D', borde: '#FF7A1A', acento: '#E3C7FF' },
    boton: { fondo: '#FFE9CC', tinta: '#2A1647', borde: '#FF7A1A' },
  },
  patrias: {
    id: 'patrias',
    fuente: { familia: 'Lilita One', google: 'Lilita+One', pila: '"Lilita One", Impact, sans-serif' },
    fondo: 'radial-gradient(circle at 50% 35%, #E0243F 0%, #C8102E 55%, #8E0A20 100%)',
    escenario: 'patrias',
    particulas: { forma: 'confeti', colores: ['#FFFFFF', '#FFFFFF', '#FFD9DE', '#F5C84B'] },
    cartel: { fondo: '#FFFFFF', tinta: '#B00D26', borde: '#C8102E', acento: '#7A0919' },
    boton: { fondo: '#FFFFFF', tinta: '#8E0A20', borde: '#F5C84B' },
  },
  sanvalentin: {
    id: 'sanvalentin',
    fuente: { familia: 'Pacifico', google: 'Pacifico', pila: 'Pacifico, "Brush Script MT", cursive' },
    fondo: 'radial-gradient(circle at 50% 35%, #FF9DBB 0%, #F0608F 55%, #C13468 100%)',
    escenario: 'corazones',
    particulas: { forma: 'corazon', colores: ['#FFFFFF', '#FFD0E0', '#FF5C8A', '#C2185B'], sube: true },
    cartel: { fondo: '#FFF1F5', tinta: '#A3144F', borde: '#E8447C', acento: '#7C0E3A' },
    boton: { fondo: '#FFF1F5', tinta: '#7C0E3A', borde: '#FFD0E0' },
  },
  anonuevo: {
    id: 'anonuevo',
    fuente: { familia: 'Cinzel', google: 'Cinzel:wght@800', pila: 'Cinzel, Georgia, serif' },
    fondo: 'radial-gradient(circle at 50% 40%, #26266B 0%, #14143D 55%, #080819 100%)',
    escenario: 'fuegos',
    particulas: { forma: 'estrella', colores: ['#F5C84B', '#FFFFFF', '#FFE08A', '#E67929'] },
    cartel: { fondo: '#12123A', tinta: '#F8D56B', borde: '#F5C84B', acento: '#FFFFFF' },
    boton: { fondo: '#F8D56B', tinta: '#12123A', borde: '#FFFFFF' },
  },
  verano: {
    id: 'verano',
    fuente: { familia: 'Baloo 2', google: 'Baloo+2:wght@700;800', pila: '"Baloo 2", "Trebuchet MS", sans-serif' },
    fondo: 'linear-gradient(180deg, #2BA8E0 0%, #7FD3F2 55%, #FFE9A6 100%)',
    escenario: 'verano',
    particulas: { forma: 'burbuja', colores: ['#FFFFFF', '#CFF1FF'], sube: true },
    cartel: { fondo: '#FFFBEF', tinta: '#0A5463', borde: '#F29A2E', acento: '#8A4A00' },
    boton: { fondo: '#FFFBEF', tinta: '#0A5463', borde: '#F29A2E' },
  },
  madre: {
    id: 'madre',
    fuente: { familia: 'Dancing Script', google: 'Dancing+Script:wght@700', pila: '"Dancing Script", "Brush Script MT", cursive' },
    fondo: 'radial-gradient(circle at 50% 35%, #FFD6E8 0%, #F2A5C8 55%, #C777A8 100%)',
    escenario: 'flores',
    particulas: { forma: 'hoja', colores: ['#FFFFFF', '#FFC2DD', '#F58AB8'] },
    cartel: { fondo: '#FFF7FA', tinta: '#8A2060', borde: '#E0679F', acento: '#6B1A4A' },
    boton: { fondo: '#FFF7FA', tinta: '#6B1A4A', borde: '#FFC2DD' },
  },
  padre: {
    ...CLASICO,
    id: 'padre',
    fondo: 'radial-gradient(circle at 50% 38%, #3C5B7A 0%, #243D57 50%, #142436 100%)',
    particulas: { forma: 'estrella', colores: ['#F2C14E', '#FFFFFF', '#9CC3E6'] },
    cartel: { fondo: '#F3F7FB', tinta: '#142436', borde: '#4F7FAF', acento: '#244F7A' },
  },
  ninos: {
    ...CLASICO,
    id: 'ninos',
    fuente: { familia: 'Fredoka', google: 'Fredoka:wght@700', pila: 'Fredoka, "Trebuchet MS", sans-serif' },
    fondo: 'radial-gradient(circle at 50% 35%, #FFE27A 0%, #FFC13D 55%, #F28E1C 100%)',
    particulas: { forma: 'confeti', colores: ['#E84A7F', '#3BB4E7', '#2DBE60', '#6B4E9B', '#FFFFFF'] },
    cartel: { fondo: '#FFFFFF', tinta: '#0B2C3E', borde: '#E84A7F', acento: '#B01E57' },
    boton: { fondo: '#FFFFFF', tinta: '#0B2C3E', borde: '#E84A7F' },
  },
  aniversario: {
    ...CLASICO,
    id: 'aniversario',
    fondo: 'radial-gradient(circle at 50% 38%, #F5A04A 0%, #E67929 50%, #A8430A 100%)',
    particulas: { forma: 'confeti', colores: ['#FFF4E1', '#F2C14E', '#0B2C3E', '#FFFFFF'] },
    cartel: { fondo: '#FFF4E1', tinta: '#0B2C3E', borde: '#F2C14E', acento: '#A8430A' },
    boton: { fondo: '#FFF4E1', tinta: '#0B2C3E', borde: '#F2C14E' },
  },
};

/** Alias de lo que guarda el diseñador de la carta (`contenido.decoracion`) y del tema de Capri (`/carta/mascota`). */
const ALIAS: Record<string, string> = { ninguno: 'clasico', normal: 'clasico', fiestas_patrias: 'patrias', san_valentin: 'sanvalentin', dia_madre: 'madre', dia_padre: 'padre', ano_nuevo: 'anonuevo' };

/** Función pura: de la decoración de la carta al tema de la celebración (desconocido o vacío = clásico Caprichos). */
export function temaDeDecoracion(decoracion?: string | null): TemaCelebracion {
  const k = (decoracion ?? '').toLowerCase().trim();
  return TEMAS[ALIAS[k] ?? k] ?? CLASICO;
}

/** Contraste WCAG entre dos colores #RRGGBB. */
export function contraste(a: string, b: string): number {
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

import { useEffect, useState } from 'react';
import './configuracion-nav.css';

export interface CategoriaNav { id: string; n: string; d: string; }

export const GRUPOS_CONFIG: Array<{ id: string; titulo: string; tabs: string[] }> = [
  { id: 'local', titulo: 'Mi local', tabs: ['local', 'ubicacion', 'contacto', 'horario', 'redes', 'empresa'] },
  { id: 'ventas', titulo: 'Ventas y reparto', tabs: ['pagos', 'entrega', 'zonas', 'reparto', 'fallas', 'demanda', 'cocina', 'operacion'] },
  { id: 'clientes', titulo: 'Comunicación con clientes', tabs: ['textos', 'chatbot', 'vouchers', 'ayuda'] },
  { id: 'equipos', titulo: 'Equipos y dispositivos', tabs: ['mapa-impresion', 'impresion', 'ingreso'] },
  { id: 'sistema', titulo: 'Sistema', tabs: ['parametros'] },
];

export function grupoDe(tab: string): string {
  return GRUPOS_CONFIG.find((g) => g.tabs.includes(tab))?.titulo ?? 'Otros ajustes';
}

/** Íconos simples (trazo 24x24, sin emoji). Clave = id de categoría. */
const D: Record<string, string> = {
  local: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  ubicacion: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  contacto: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  horario: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  redes: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  marca: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5a1 1 0 1 0 0-.01',
  empresa: 'M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2M3 21h18',
  pagos: 'M3 6h18v12H3zM3 10h18M7 15h3',
  entrega: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-.01M17 19a1.5 1.5 0 1 0 0-.01',
  zonas: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  reparto: 'M5 18a3 3 0 1 0 0-.01M19 18a3 3 0 1 0 0-.01M8 18h8l-3-8h-3M13 10l3-3h3',
  fallas: 'M12 3l10 18H2zM12 10v5M12 18v.01',
  demanda: 'M13 2L4 14h7l-1 8 9-12h-7z',
  cocina: 'M7 10h10M5 10a7 7 0 0 1 14 0M4 18h16M9 6V4M15 6V4',
  operacion: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6',
  areas: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  textos: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5',
  avisos: 'M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4',
  chatbot: 'M4 5h16v11H9l-5 4zM9 10h.01M12 10h.01M15 10h.01',
  vouchers: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  ayuda: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.01',
  impresion: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
  'mapa-impresion': 'M4 5h5v5H4zM15 5h5v5h-5zM9.5 16.5h5M6.5 10v3.5h11V10',
  ingreso: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9',
  parametros: 'M4 6h8M16 6h4M4 12h4M12 12h8M4 18h10M18 18h2M14 4v4M8 10v4M16 16v4',
};

export function IconoCategoria({ id }: { id: string }) {
  return (
    <svg className="cfg-icono" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={D[id] || D.parametros} />
    </svg>
  );
}

const LLAVE_CERRADOS = 'cfg_nav_grupos_cerrados';
const leerCerrados = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(LLAVE_CERRADOS) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};

/** Nav por grupos. PC: acordeón con memoria. Móvil: lista tipo ajustes del teléfono. */
export function NavegacionConfiguracion({ categorias, activo, onElegir, movil }: {
  categorias: CategoriaNav[];
  activo: string;
  onElegir: (id: string) => void;
  movil: boolean;
}) {
  const [cerrados, setCerrados] = useState<string[]>(leerCerrados);
  const grupoActivo = GRUPOS_CONFIG.find((g) => g.tabs.includes(activo))?.id;

  // al saltar a un ajuste de un grupo plegado (buscador), se abre
  useEffect(() => {
    if (grupoActivo) setCerrados((c) => (c.includes(grupoActivo) ? c.filter((x) => x !== grupoActivo) : c));
  }, [grupoActivo, activo]);

  const alternar = (id: string) =>
    setCerrados((c) => {
      const n = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
      try { localStorage.setItem(LLAVE_CERRADOS, JSON.stringify(n)); } catch { /* sin almacenamiento */ }
      return n;
    });

  const conocidos = new Set(GRUPOS_CONFIG.flatMap((g) => g.tabs));
  const grupos = [
    ...GRUPOS_CONFIG,
    { id: 'otros', titulo: 'Otros ajustes', tabs: categorias.map((c) => c.id).filter((i) => !conocidos.has(i)) },
  ];

  return (
    <div role="tablist" aria-label="Categorías de configuración" aria-orientation="vertical" className={`cfg-nav ${movil ? 'cfg-nav-movil' : ''}`}>
      {grupos.map((g) => {
        const cats = g.tabs.map((t) => categorias.find((c) => c.id === t)).filter(Boolean) as CategoriaNav[];
        if (!cats.length) return null;
        const abierto = movil || !cerrados.includes(g.id);
        return (
          <div key={g.id} role="presentation" className="cfg-grupo">
            {movil ? (
              <div className="cfg-grupo-titulo">{g.titulo}</div>
            ) : (
              <button type="button" className="cfg-grupo-titulo cfg-grupo-boton" aria-expanded={abierto} onClick={() => alternar(g.id)}>
                <span>{g.titulo}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={abierto ? 'cfg-giro' : ''}><path d="M6 9l6 6 6-6" /></svg>
              </button>
            )}
            {abierto && (
              <div role="presentation" className="cfg-grupo-filas">
                {cats.map((c) => (
                  <button key={c.id} type="button" role="tab" aria-selected={activo === c.id} className="cfg-fila" onClick={() => onElegir(c.id)}>
                    <IconoCategoria id={c.id} />
                    <span className="cfg-fila-texto">
                      <span className="cfg-fila-titulo">{c.n}</span>
                      <span className="cfg-fila-desc">{c.d}</span>
                    </span>
                    {movil && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** true bajo 720 px; escucha el cambio de tamaño. */
export function useEsMovil(): boolean {
  const calc = () => typeof window !== 'undefined' && window.innerWidth < 720;
  const [m, setM] = useState(calc);
  useEffect(() => {
    const f = () => setM(calc());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return m;
}

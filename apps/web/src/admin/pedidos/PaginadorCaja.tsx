/** Tamaños de página del paginador. null = automático (lo que cabe en la cuadrícula de tarjetas). */
export type FilasPorPagina = number | 'todas' | null;

export const OPCIONES_FILAS: number[] = [10, 25, 50, 100];
/** Tope de pedidos que la pantalla carga (20 páginas de 100); «Todas» no puede pasar de aquí. */
export const TOPE_TODAS = 2000;

/** Valor guardado → tamaño válido (si no lo es, el automático). */
export function normalizarFilas(v: unknown): FilasPorPagina {
  if (v === 'todas') return 'todas';
  return typeof v === 'number' && OPCIONES_FILAS.includes(v) ? v : null;
}

/** Cuántos elementos por página para una vista: lo elegido, o el automático (tarjetas) / 50 (tabla). */
export function tamanoPagina(filas: FilasPorPagina, total: number, automatico: number): number {
  if (filas === 'todas') return Math.max(1, total);
  return filas ?? automatico;
}

export interface PaginadorCajaProps {
  total: number;
  desde: number;
  hasta: number;
  pagina: number;
  totalPaginas: number;
  alIr: (pagina: number) => void;
  filas: FilasPorPagina;
  alCambiarFilas: (f: FilasPorPagina) => void;
  /** Incluye la opción «Auto» (tarjetas). */
  conAuto?: boolean;
  /** «Todas» pidió más de lo que se pudo cargar. */
  avisoTope?: string | null;
  unidad?: string;
}

const Flecha = ({ der }: { der?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={der ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
  </svg>
);

/**
 * Paginador compacto al final de la lista, en el flujo normal (sin sticky ni fixed): una línea delgada, alineada a la derecha
 * y del ancho de su contenido. Con una sola página no muestra «Página 1 de 1» ni las flechas; con 0 elementos, solo el conteo.
 * Los botones se ven chicos pero su área de toque llega a 44 px (ver `.cj2-pag-btn::after` en caja-lista.css).
 */
export function PaginadorCaja({ total, desde, hasta, pagina, totalPaginas, alIr, filas, alCambiarFilas, conAuto = true, avisoTope, unidad = 'pedidos' }: PaginadorCajaProps) {
  const valorSelect = filas === null ? 'auto' : String(filas);
  const variasPaginas = totalPaginas > 1;
  return (
    <nav className="cj2-pag" aria-label="Paginación">
      <span className="cj2-pag-rango" data-testid="rango-pagina">
        {total === 0 ? `0 ${unidad}` : `Mostrando ${desde}–${hasta} de ${total}`}
      </span>
      {/* Con pocas filas (caben en la menor página) el selector no aporta: solo queda el conteo */}
      {total > OPCIONES_FILAS[0] && (
        <label className="cj2-pag-filas">
          <span aria-hidden="true">Filas</span>
          <select
            className="cj2-pag-select"
            aria-label="Filas por página"
            value={valorSelect}
            onChange={(e) => {
              const v = e.target.value;
              alCambiarFilas(v === 'auto' ? null : v === 'todas' ? 'todas' : Number(v));
            }}
          >
            {conAuto && <option value="auto">Auto</option>}
            {OPCIONES_FILAS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
            <option value="todas">Todas</option>
          </select>
        </label>
      )}
      {avisoTope && <span className="cj2-pag-aviso" role="status">{avisoTope}</span>}
      {variasPaginas && (
        <div className="cj2-pag-flechas">
          {totalPaginas >= 5 && (
            <button type="button" className="cj2-pag-btn cj2-pag-extremo" aria-label="Primera página" disabled={pagina <= 1} onClick={() => alIr(1)}>
              Primera
            </button>
          )}
          <button type="button" className="cj2-pag-btn" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => alIr(Math.max(1, pagina - 1))}>
            <Flecha />
          </button>
          {totalPaginas >= 5 ? (
            <label className="cj2-pag-ir">
              <select className="cj2-pag-select" aria-label="Ir a la página" value={pagina} onChange={(e) => alIr(Number(e.target.value))}>
                {Array.from({ length: totalPaginas }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
              <span>/ {totalPaginas}</span>
            </label>
          ) : (
            <span className="cj2-pag-n">Página {pagina} de {totalPaginas}</span>
          )}
          <button type="button" className="cj2-pag-btn" aria-label="Página siguiente" disabled={pagina >= totalPaginas} onClick={() => alIr(Math.min(totalPaginas, pagina + 1))}>
            <Flecha der />
          </button>
          {totalPaginas >= 5 && (
            <button type="button" className="cj2-pag-btn cj2-pag-extremo" aria-label="Última página" disabled={pagina >= totalPaginas} onClick={() => alIr(totalPaginas)}>
              Última
            </button>
          )}
        </div>
      )}
    </nav>
  );
}

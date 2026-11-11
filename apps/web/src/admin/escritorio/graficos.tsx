import type { ReactNode } from 'react';
import './escritorio.css';

/** Gráficos del Escritorio: HTML/CSS y SVG propios (sin librerías). Cada uno lleva texto y una tabla alternativa. */

export type EstadoGrafico = 'cargando' | 'vacio' | 'error' | 'ok';

export interface TablaAlterna {
  cabecera: string[];
  filas: (string | number)[][];
}

interface TarjetaProps {
  id: string;
  titulo: string;
  subtitulo?: string;
  estado: EstadoGrafico;
  /** Texto cuando no hay datos en el período (por defecto, uno genérico) */
  vacio?: string;
  tabla?: TablaAlterna;
  ancha?: boolean;
  children?: ReactNode;
}

/** Tarjeta con título, subtítulo, estados cargando/vacío/error y la tabla alternativa del gráfico. */
export function TarjetaGrafico({ id, titulo, subtitulo, estado, vacio, tabla, ancha, children }: TarjetaProps) {
  return (
    <section className={`esc-tarjeta${ancha ? ' esc-tarjeta--ancha' : ''}`} aria-labelledby={`${id}-t`}>
      <div>
        <h3 id={`${id}-t`}>{titulo}</h3>
        {subtitulo && <p className="esc-subtitulo">{subtitulo}</p>}
      </div>
      {estado === 'cargando' && <div className="esc-esqueleto" role="status" aria-label={`Cargando ${titulo}`} />}
      {estado === 'error' && (
        <div className="esc-estado esc-estado--error" role="alert">
          No se pudo cargar este gráfico. Prueba de nuevo en unos segundos.
        </div>
      )}
      {estado === 'vacio' && <div className="esc-estado">{vacio ?? 'Sin datos en este período.'}</div>}
      {estado === 'ok' && children}
      {estado === 'ok' && tabla && (
        <details className="esc-alt">
          <summary>Ver como tabla</summary>
          <div className="esc-alt__tabla">
            <table>
              <thead>
                <tr>
                  {tabla.cabecera.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabla.filas.map((f, i) => (
                  <tr key={i}>
                    {f.map((v, j) => (
                      <td key={j}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

export interface PuntoBarra {
  etiqueta: string;
  valor: number;
  /** Texto que se muestra sobre la barra y en la descripción (por defecto, el número) */
  texto?: string;
}

/** Barras verticales: valor visible sobre cada barra, la más alta resaltada y etiquetas abajo. */
export function BarrasVerticales({ datos, descripcion }: { datos: PuntoBarra[]; descripcion: string }) {
  const max = Math.max(...datos.map((d) => d.valor), 1);
  const punta = Math.max(...datos.map((d) => d.valor));
  const muchas = datos.length > 12;
  return (
    <div role="img" aria-label={descripcion}>
      <div className="esc-barras">
        {datos.map((d) => (
          <div className="esc-barras__col" key={d.etiqueta}>
            {(!muchas || (d.valor === punta && d.valor > 0)) && d.valor > 0 && <span className="esc-barras__valor">{d.texto ?? d.valor}</span>}
            <div
              className={`esc-barras__barra${d.valor === punta && d.valor > 0 ? ' esc-barras__barra--punta' : ''}`}
              style={{ height: `${Math.round((d.valor / max) * 100)}%` }}
              title={`${d.etiqueta}: ${d.texto ?? d.valor}`}
            />
          </div>
        ))}
      </div>
      <div className="esc-barras__etiquetas" aria-hidden="true">
        {datos.map((d, i) => (
          <span key={d.etiqueta}>{muchas && i % 2 === 1 ? '' : d.etiqueta}</span>
        ))}
      </div>
    </div>
  );
}

export interface PuntoLinea {
  etiqueta: string;
  valor: number;
  texto: string;
}

/** Línea con área (una serie), ejes con texto, una meta opcional y un aviso por punto (título al pasar o tocar). */
export function LineaTiempo({
  puntos,
  descripcion,
  formatoY,
  meta,
}: {
  puntos: PuntoLinea[];
  descripcion: string;
  formatoY: (n: number) => string;
  meta?: { valor: number; texto: string };
}) {
  const max = Math.max(...puntos.map((p) => p.valor), meta?.valor ?? 0, 1);
  const n = puntos.length;
  const x = (i: number) => (n === 1 ? 300 : (i / (n - 1)) * 600);
  const y = (v: number) => 150 - (v / max) * 140;
  const linea = puntos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ');
  const mitad = puntos[Math.floor((n - 1) / 2)];
  return (
    <div>
      <div className="esc-linea" role="img" aria-label={descripcion}>
        <div className="esc-linea__y" aria-hidden="true">
          <span>{formatoY(max)}</span>
          <span>{formatoY(max / 2)}</span>
          <span>{formatoY(0)}</span>
        </div>
        <svg viewBox="0 0 600 160" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <line x1="0" y1="150" x2="600" y2="150" stroke="var(--cp-line)" strokeWidth="1" />
          <line x1="0" y1="80" x2="600" y2="80" stroke="var(--cp-line)" strokeWidth="1" strokeDasharray="3 4" />
          <polygon className="esc-linea__area" points={`0,150 ${linea} 600,150`} />
          <polyline className="esc-linea__trazo" points={linea} />
          {meta && <line className="esc-linea__meta" x1="0" x2="600" y1={y(meta.valor)} y2={y(meta.valor)} />}
          {puntos.map((p, i) => (
            <rect key={p.etiqueta} x={x(i) - 600 / (2 * Math.max(n, 1))} y="0" width={600 / Math.max(n, 1)} height="160" fill="transparent">
              <title>{`${p.etiqueta}: ${p.texto}`}</title>
            </rect>
          ))}
        </svg>
      </div>
      <div className="esc-linea__x" style={{ paddingLeft: 52 }} aria-hidden="true">
        <span>{puntos[0].etiqueta}</span>
        {n > 2 && <span>{mitad.etiqueta}</span>}
        {n > 1 && <span>{puntos[n - 1].etiqueta}</span>}
      </div>
      {meta && <p className="esc-linea__meta-texto">{meta.texto}</p>}
    </div>
  );
}

export interface ParteReparto {
  n: string;
  c: string;
  pct: number;
  /** Texto de cada fila de la leyenda, por ejemplo «12 pedidos · s/ 340.00» */
  dato: string;
}

/** Reparto en partes: barra apilada y leyenda con nombre, porcentaje y dato en texto (no solo color). */
export function RepartoPartes({ partes, descripcion }: { partes: ParteReparto[]; descripcion: string }) {
  return (
    <div role="img" aria-label={descripcion} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="esc-partes" aria-hidden="true">
        {partes
          .filter((p) => p.pct > 0)
          .map((p) => (
            <div key={p.n} className="esc-partes__trozo" style={{ flexBasis: `${p.pct}%`, background: p.c }} title={`${p.n}: ${p.pct} %`} />
          ))}
      </div>
      <ul className="esc-leyenda">
        {partes.map((p) => (
          <li key={p.n}>
            <span className="esc-leyenda__punto" style={{ background: p.c }} aria-hidden="true" />
            <span className="esc-leyenda__nombre">{p.n}</span>
            <span className="esc-leyenda__dato">
              {p.pct} % · {p.dato}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface FilaHBarra {
  n: string;
  valor: number;
  texto: string;
  c?: string;
}

/** Barras horizontales con el valor escrito al lado del nombre. */
export function BarrasHorizontales({ filas, descripcion }: { filas: FilaHBarra[]; descripcion: string }) {
  const max = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <ul className="esc-hbarras" aria-label={descripcion}>
      {filas.map((f) => (
        <li key={f.n}>
          <div className="esc-hbarras__cab">
            <span>{f.n}</span>
            <span>{f.texto}</span>
          </div>
          <div className="esc-hbarras__pista" aria-hidden="true">
            <div className="esc-hbarras__barra" style={{ width: `${Math.round((f.valor / max) * 100)}%`, background: f.c ?? 'var(--cp-orange)' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

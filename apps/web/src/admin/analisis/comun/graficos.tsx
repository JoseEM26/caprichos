import { useId, type ReactNode } from 'react';
import { Boton } from '../../../comun/Boton';
import './analisis.css';

/**
 * Componentes de gráficos de Análisis: HTML/CSS propio, sin librerías, en modo claro (variables --cp-*).
 * Todos llevan texto alternativo, no dependen solo del color (forma + palabra) y los de datos traen su tabla plegable.
 * Guía de uso: ./README.md
 */

export type EstadoTarjeta = 'cargando' | 'vacio' | 'error' | 'ok';
export type NivelSemaforo = 'verde' | 'ambar' | 'rojo' | 'sin_dato';

export interface TablaAlterna {
  cabecera: string[];
  filas: Array<Array<string | number>>;
}

/* ---------- Semáforo ---------- */
const TEXTO_SEMAFORO: Record<NivelSemaforo, string> = {
  verde: 'En meta',
  ambar: 'Cerca de la meta',
  rojo: 'Pasada de la meta',
  sin_dato: 'Sin dato',
};
const FORMA_SEMAFORO: Record<NivelSemaforo, string> = { verde: '●', ambar: '▲', rojo: '■', sin_dato: '○' };

/** Etiqueta con forma, color y palabra (verde ●, ámbar ▲, rojo ■): se entiende sin ver colores. */
export function Semaforo({ nivel, texto, corto = false }: { nivel: NivelSemaforo; texto?: string; corto?: boolean }) {
  const palabra = texto ?? TEXTO_SEMAFORO[nivel];
  return (
    <span className={`an-sem an-sem--${nivel}`} data-nivel={nivel}>
      <span aria-hidden="true">{FORMA_SEMAFORO[nivel]}</span>
      <span className={corto ? 'an-solo-lector' : undefined}>{palabra}</span>
    </span>
  );
}

/* ---------- Tarjeta con estados + tabla alterna ---------- */
interface TarjetaProps {
  id: string;
  titulo: string;
  subtitulo?: string;
  estado: EstadoTarjeta;
  vacio?: string;
  alReintentar?: () => void;
  tabla?: TablaAlterna;
  acciones?: ReactNode;
  children?: ReactNode;
}

/** Marco de un gráfico: título, estados cargando/vacío/error (con Reintentar) y «Ver como tabla». */
export function TarjetaAnalisis({ id, titulo, subtitulo, estado, vacio, alReintentar, tabla, acciones, children }: TarjetaProps) {
  return (
    <section className="an-tarjeta" aria-labelledby={`${id}-t`}>
      <div className="an-tarjeta__cab">
        <div>
          <h3 id={`${id}-t`}>{titulo}</h3>
          {subtitulo && <p className="an-sub">{subtitulo}</p>}
        </div>
        {acciones}
      </div>
      {estado === 'cargando' && <div className="an-esqueleto" role="status" aria-label={`Cargando ${titulo}`} />}
      {estado === 'error' && (
        <div className="an-estado an-estado--error" role="alert">
          <span>No se pudo cargar. Prueba de nuevo en unos segundos.</span>
          {alReintentar && (
            <Boton variante="secundario" tamano="pequeno" onClick={alReintentar}>
              Reintentar
            </Boton>
          )}
        </div>
      )}
      {estado === 'vacio' && <div className="an-estado">{vacio ?? 'Sin datos en este período.'}</div>}
      {estado === 'ok' && children}
      {estado === 'ok' && tabla && <TablaDatos tabla={tabla} />}
    </section>
  );
}

/** Los mismos datos del gráfico como tabla, plegada. */
export function TablaDatos({ tabla }: { tabla: TablaAlterna }) {
  return (
    <details className="an-alt">
      <summary>Ver como tabla</summary>
      <div className="an-alt__tabla">
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
  );
}

/* ---------- Indicador (KPI) ---------- */
export function TarjetaIndicador({
  titulo,
  valor,
  detalle,
  semaforo,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  semaforo?: NivelSemaforo;
}) {
  return (
    <div className="an-kpi">
      <span className="an-kpi__titulo">{titulo}</span>
      <strong className="an-kpi__valor">{valor}</strong>
      {detalle && <span className="an-kpi__detalle">{detalle}</span>}
      {semaforo && <Semaforo nivel={semaforo} />}
    </div>
  );
}

/* ---------- Barras horizontales ---------- */
export interface FilaBarra {
  id: string;
  nombre: string;
  /** Línea pequeña bajo el nombre (qué mide). */
  detalle?: string;
  /** null = sin dato: la barra queda vacía y dice «Sin dato». */
  valor: number | null;
  /** Texto del valor (por ejemplo «7,5 min»). */
  texto: string;
  /** Marca de meta sobre la barra, en la misma unidad que `valor`. */
  meta?: number;
  semaforo?: NivelSemaforo;
  /** Resalta la fila (borde grueso y la palabra de `etiquetaDestacada`). */
  destacada?: boolean;
}

/**
 * Barras horizontales con valor escrito, marca de meta y semáforo. Con `alElegir` cada fila es un botón de 44 px
 * (para abrir el detalle en un panel inline); sin él, son filas de lectura.
 */
export function BarrasHorizontales({
  filas,
  descripcion,
  etiquetaDestacada = 'Más lenta',
  alElegir,
  elegida,
}: {
  filas: FilaBarra[];
  descripcion: string;
  etiquetaDestacada?: string;
  alElegir?: (id: string) => void;
  elegida?: string | null;
}) {
  const max = Math.max(1, ...filas.map((f) => Math.max(f.valor ?? 0, f.meta ?? 0)));
  return (
    <ul className="an-barras" aria-label={descripcion}>
      {filas.map((f) => {
        const ancho = f.valor == null ? 0 : Math.max(2, Math.round((f.valor / max) * 100));
        const contenido = (
          <>
            <span className="an-barras__cab">
              <span className="an-barras__nombre">
                {f.nombre}
                {f.destacada && <span className="an-pastilla">{etiquetaDestacada}</span>}
              </span>
              <span className="an-barras__valor">{f.texto}</span>
            </span>
            {f.detalle && <span className="an-barras__detalle">{f.detalle}</span>}
            <span className={`an-barras__pista${f.valor == null ? ' an-barras__pista--vacia' : ''}`} aria-hidden="true">
              {f.valor != null && <span className={`an-barras__barra an-barras__barra--${f.semaforo ?? 'neutro'}`} style={{ width: `${ancho}%` }} />}
              {f.meta != null && <span className="an-barras__meta" style={{ left: `${Math.min(100, Math.round((f.meta / max) * 100))}%` }} />}
            </span>
            {f.semaforo && (
              <span className="an-barras__pie">
                <Semaforo nivel={f.semaforo} />
                {f.meta != null && <span className="an-sub">Meta: {f.meta} min</span>}
              </span>
            )}
          </>
        );
        const clase = `an-barras__fila${f.destacada ? ' an-barras__fila--destacada' : ''}${elegida === f.id ? ' an-barras__fila--elegida' : ''}`;
        return (
          <li key={f.id}>
            {alElegir ? (
              <button type="button" className={clase} aria-pressed={elegida === f.id} onClick={() => alElegir(f.id)}>
                {contenido}
              </button>
            ) : (
              <div className={clase}>{contenido}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Mapa de calor ---------- */
/**
 * Tabla de calor (por ejemplo día de la semana por hora). Cada celda escribe su número: el color solo refuerza.
 * `valores[fila][columna]`; null = sin dato. En pantallas angostas la tabla se desplaza dentro de su caja,
 * nunca la página.
 */
export function MapaDeCalor({
  filas,
  columnas,
  valores,
  descripcion,
  formato = (n) => String(n),
}: {
  filas: string[];
  columnas: string[];
  valores: Array<Array<number | null>>;
  descripcion: string;
  formato?: (n: number) => string;
}) {
  const id = useId();
  const max = Math.max(1, ...valores.flat().map((v) => v ?? 0));
  return (
    <div className="an-calor" role="region" aria-labelledby={`${id}-c`} tabIndex={0}>
      <table>
        <caption id={`${id}-c`} className="an-solo-lector">
          {descripcion}
        </caption>
        <thead>
          <tr>
            <td />
            {columnas.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={fila}>
              <th scope="row">{fila}</th>
              {columnas.map((c, j) => {
                const v = valores[i]?.[j] ?? null;
                const nivel = v == null ? 0 : Math.ceil((v / max) * 4);
                return (
                  <td key={c} className={`an-calor__celda an-calor__celda--${nivel}`}>
                    {v == null ? '–' : formato(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Ranking ---------- */
export interface ItemRanking {
  id: string;
  nombre: string;
  valor: number;
  texto: string;
  detalle?: string;
}

/** Lista numerada de mayor a menor con una barra fina; `max` limita cuántos se muestran. */
export function ListaRanking({ items, descripcion, max = 10 }: { items: ItemRanking[]; descripcion: string; max?: number }) {
  const lista = [...items].sort((a, b) => b.valor - a.valor).slice(0, max);
  const tope = Math.max(1, ...lista.map((i) => i.valor));
  return (
    <ol className="an-ranking" aria-label={descripcion}>
      {lista.map((i, n) => (
        <li key={i.id}>
          <span className="an-ranking__pos" aria-hidden="true">
            {n + 1}
          </span>
          <span className="an-ranking__cuerpo">
            <span className="an-ranking__cab">
              <span>{i.nombre}</span>
              <strong>{i.texto}</strong>
            </span>
            {i.detalle && <span className="an-sub">{i.detalle}</span>}
            <span className="an-ranking__pista" aria-hidden="true">
              <span style={{ width: `${Math.max(2, Math.round((i.valor / tope) * 100))}%` }} />
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Detalle inline ---------- */
/** Panel de detalle dentro de la página (nunca un modal sobre otro). Se cierra con el botón o con Esc. */
export function PanelDetalle({ titulo, alCerrar, children }: { titulo: string; alCerrar: () => void; children: ReactNode }) {
  return (
    <section
      className="an-detalle"
      role="region"
      aria-label={`Detalle: ${titulo}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') alCerrar();
      }}
    >
      <div className="an-detalle__cab">
        <h4>{titulo}</h4>
        <Boton variante="texto" tamano="pequeno" onClick={alCerrar} aria-label={`Cerrar detalle de ${titulo}`}>
          Cerrar
        </Boton>
      </div>
      {children}
    </section>
  );
}

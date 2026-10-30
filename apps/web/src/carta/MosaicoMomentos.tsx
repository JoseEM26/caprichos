import { IMAGENES_MARCA_FABRICA } from '../comun/imagenesMarca';
import { useEsMovil } from './useEsMovil';
import { TextoEd } from './edicion';

/** Paso de la secuencia de relleno. Con 5 fotos y paso 2, dos vecinas nunca son la misma. */
const PASO_RELLENO = 2;

/** Relaciones de aspecto variadas para que el mosaico se vea como una colección y no como una tabla. */
const RELACIONES = ['4 / 5', '1 / 1', '3 / 4', '4 / 5', '2 / 3'];

export const CANTIDAD_MOMENTOS_POR_DEFECTO = 8;

/**
 * Arma la lista de fotos del mosaico: primero las propias (Diseñador / Novedades, sin repetir),
 * y luego las de fábrica repetidas hasta completar `cantidad`, en orden alternado.
 */
export function armarMosaicoMomentos(
  fotosPropias: string[],
  cantidad: number = CANTIDAD_MOMENTOS_POR_DEFECTO,
  fabrica: readonly string[] = IMAGENES_MARCA_FABRICA,
): string[] {
  const propias = Array.from(new Set(fotosPropias.filter((f) => typeof f === 'string' && f.length > 0)));
  const total = Math.max(cantidad, propias.length);
  const relleno = Array.from(
    { length: Math.max(0, total - propias.length) },
    (_, k) => fabrica[(k * PASO_RELLENO) % fabrica.length],
  );
  return [...propias, ...relleno];
}

/** Reparte los elementos en columnas (round robin): la lectura por filas sigue el orden de la lista. */
export function repartirEnColumnas<T>(items: T[], columnas: number): T[][] {
  const cols: T[][] = Array.from({ length: Math.max(1, columnas) }, () => []);
  items.forEach((item, i) => cols[i % cols.length].push(item));
  return cols;
}

export interface MosaicoMomentosProps {
  /** Fotos reales (Diseñador / Novedades). Tienen prioridad y se muestran primero. */
  fotos?: string[];
  /** Cuántas celdas llenar en total. */
  cantidad?: number;
  /** Columnas. Por defecto 2 en celular y 4 en PC. */
  columnas?: number;
  /** Encabezado opcional, por ejemplo "Momentos Caprichos". */
  titulo?: string;
  /** Si el título se puede editar en sitio, su clave. */
  claveTitulo?: string;
  /** Primera pantalla: carga inmediata de las primeras imágenes. */
  prioritaria?: boolean;
}

/** Mosaico de fotos sin huecos ni cajas vacías. Las imágenes de fábrica se repiten si hace falta. */
export function MosaicoMomentos({
  fotos = [],
  cantidad = CANTIDAD_MOMENTOS_POR_DEFECTO,
  columnas,
  titulo,
  claveTitulo,
  prioritaria = false,
}: MosaicoMomentosProps) {
  const movil = useEsMovil();
  const cols = columnas ?? (movil ? 2 : 4);
  const espacio = movil ? 8 : 14;
  const celdas = armarMosaicoMomentos(fotos, cantidad);
  const columnasRepartidas = repartirEnColumnas(
    celdas.map((src, indice) => ({ src, indice })),
    cols,
  );

  return (
    <section aria-label={titulo || 'Momentos Caprichos'} style={{ width: '100%', boxSizing: 'border-box' }}>
      {titulo && (
        <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: movil ? 17 : 22, marginBottom: 10 }}>
          {claveTitulo ? <TextoEd clave={claveTitulo} valor={titulo} ayuda="Título del mosaico" /> : titulo}
        </div>
      )}
      <div
        data-testid="mosaico-momentos"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: espacio,
          alignItems: 'start',
        }}
      >
        {columnasRepartidas.map((columna, c) => (
          <div key={c} style={{ display: 'flex', flexDirection: 'column', gap: espacio, minWidth: 0 }}>
            {columna.map(({ src, indice }) => (
              <div
                key={indice}
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: RELACIONES[indice % RELACIONES.length],
                  borderRadius: 16,
                  overflow: 'hidden',
                  background: 'var(--cp-sand)',
                  boxShadow: '0 4px 14px rgba(11, 44, 62, 0.12)',
                }}
              >
                <img
                  src={src}
                  alt={`Momento Caprichos ${indice + 1}`}
                  loading={prioritaria && indice < cols ? 'eager' : 'lazy'}
                  decoding="async"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

import { Fragment } from 'react';
import { useEsMovil } from './useEsMovil';
import { TextoEd, useEdicion } from './edicion';

/** Relaciones de aspecto variadas para que el mosaico se vea como una colección y no como una tabla. */
const RELACIONES = ['4 / 5', '1 / 1', '3 / 4', '4 / 5', '2 / 3'];

/** Foto propia de un mosaico. `id` es la clave con la que el editor la cambia, la ordena u oculta. */
export interface FotoMosaico {
  id: string;
  url: string;
  activo?: boolean;
}

/** Reparte los elementos en columnas (round robin): la lectura por filas sigue el orden de la lista. */
export function repartirEnColumnas<T>(items: T[], columnas: number): T[][] {
  const cols: T[][] = Array.from({ length: Math.max(1, columnas) }, () => []);
  items.forEach((item, i) => cols[i % cols.length].push(item));
  return cols;
}

export interface MosaicoMomentosProps {
  /** Fotos propias de este mosaico, en su orden. Nunca se rellena con fotos de otro lugar. */
  fotos?: FotoMosaico[];
  /** Columnas. Por defecto 2 en celular y 4 en PC; con menos fotos, menos columnas. */
  columnas?: number;
  /** Encabezado opcional, por ejemplo "Momentos Caprichos". */
  titulo?: string;
  /** Si el título se puede editar en sitio, su clave. */
  claveTitulo?: string;
  /** Prefijo de la clave de edición de cada foto: el editor recibe `${claveFotos}:${id}`. */
  claveFotos?: string;
  /** En edición, muestra «+ Agregar foto» al final del mosaico. */
  conAgregar?: boolean;
  /** Primera pantalla: carga inmediata de las primeras imágenes. */
  prioritaria?: boolean;
}

/**
 * Mosaico de fotos sin huecos ni cajas vacías. Muestra solo las fotos que recibe: si no hay ninguna,
 * en la carta no se pinta nada, y en edición queda el «+ Agregar foto».
 */
export function MosaicoMomentos({
  fotos = [],
  columnas,
  titulo,
  claveTitulo,
  claveFotos = 'foto',
  conAgregar = false,
  prioritaria = false,
}: MosaicoMomentosProps) {
  const ed = useEdicion();
  const movil = useEsMovil();
  if (!ed && fotos.length === 0) return null;

  const maximo = columnas ?? (movil ? 2 : 4);
  const cols = Math.max(1, Math.min(maximo, fotos.length || 1));
  const espacio = movil ? 8 : 14;
  const columnasRepartidas = repartirEnColumnas(
    fotos.map((f, indice) => ({ f, indice })),
    cols,
  );

  const celda = (f: FotoMosaico, indice: number) => (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: RELACIONES[indice % RELACIONES.length],
        borderRadius: 16,
        overflow: 'hidden',
        background: 'var(--cp-sand)',
        boxShadow: '0 4px 14px rgba(11, 44, 62, 0.12)',
        opacity: f.activo === false ? 0.45 : 1,
      }}
    >
      <img
        src={f.url}
        alt={`Momento Caprichos ${indice + 1}`}
        loading={prioritaria && indice < cols ? 'eager' : 'lazy'}
        decoding="async"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
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
            {columna.map(({ f, indice }) => (
              <Fragment key={f.id}>{ed ? ed.bloque(`${claveFotos}:${f.id}`, celda(f, indice)) : celda(f, indice)}</Fragment>
            ))}
          </div>
        ))}
      </div>
      {ed && conAgregar && ed.agregar(claveFotos, 'Agregar foto', { marginTop: espacio, minHeight: 44 })}
    </section>
  );
}

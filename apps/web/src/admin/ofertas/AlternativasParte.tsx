import { useState } from 'react';
import type { AlternativaParteItem } from './ofertasApi';

interface ProductoLista {
  id: string;
  nombre: string;
  precio?: number;
}

interface Props {
  /** FIJO: el producto principal no se ofrece como alternativa. */
  principalId?: string;
  /** Alternativas en orden: producto y cantidad (el cliente las elige si no hay stock del original). */
  alternativas: AlternativaParteItem[];
  productos: ProductoLista[];
  onCambiar: (alternativas: AlternativaParteItem[]) => void;
}

const boton = {
  minHeight: '44px',
  minWidth: '44px',
  padding: '0 12px',
  borderRadius: '8px',
  border: '1.5px solid var(--cp-navy)',
  backgroundColor: 'transparent',
  color: 'var(--cp-navy)',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

/** Alternativas de una parte del combo: si no hay stock, el cliente elige una (mismo precio del combo). */
export function AlternativasParte({ principalId, alternativas, productos, onCambiar }: Props) {
  const [q, setQ] = useState('');
  const [aQuitar, setAQuitar] = useState<number | null>(null);
  const texto = q.trim().toLowerCase();
  const usadas = new Set(alternativas.map((a) => String(a.id)));
  const resultados = texto
    ? productos
        .filter((p) => String(p.id) !== principalId && !usadas.has(String(p.id)) && p.nombre.toLowerCase().includes(texto))
        .slice(0, 6)
    : [];

  const mover = (i: number, dir: -1 | 1) => {
    const copia = [...alternativas];
    [copia[i], copia[i + dir]] = [copia[i + dir], copia[i]];
    onCambiar(copia);
  };
  const cambiarCantidad = (i: number, valor: string) => {
    const n = Math.floor(Number(valor));
    onCambiar(alternativas.map((a, j) => (j === i ? { ...a, cantidad: Number.isFinite(n) && n >= 1 ? n : 1 } : a)));
  };

  return (
    <div data-testid="alternativas-parte" style={{ marginTop: '14px' }}>
      <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>Si no hay stock, el cliente podrá elegir:</div>
      <span style={{ fontSize: '12px', color: 'var(--cp-soft)', display: 'block', marginBottom: '8px' }}>
        Se ofrecen solo cuando el complemento no alcanza. Mismo precio del combo; las agotadas salen bloqueadas. Si no hay ninguna con stock, el combo se muestra agotado.
      </span>

      {alternativas.map((a, i) => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
          <strong style={{ minWidth: '64px', fontSize: '13px' }}>Opción {i + 1}</strong>
          <span style={{ flex: 1, fontSize: '14px', minWidth: '120px' }}>{a.nombre || `Producto ${a.id}`}</span>
          <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Cantidad
            <input
              type="number"
              min={1}
              step={1}
              value={a.cantidad}
              aria-label={`Cantidad de ${a.nombre || a.id}`}
              onChange={(e) => cambiarCantidad(i, e.target.value)}
              style={{ width: '64px', minHeight: '44px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 8px', fontSize: '14px' }}
            />
          </label>
          <button type="button" style={{ ...boton, opacity: i === 0 ? 0.4 : 1 }} disabled={i === 0} aria-label={`Subir ${a.nombre || a.id}`} onClick={() => mover(i, -1)}>
            Subir
          </button>
          <button
            type="button"
            style={{ ...boton, opacity: i === alternativas.length - 1 ? 0.4 : 1 }}
            disabled={i === alternativas.length - 1}
            aria-label={`Bajar ${a.nombre || a.id}`}
            onClick={() => mover(i, 1)}
          >
            Bajar
          </button>
          <button type="button" style={boton} aria-label={`Quitar ${a.nombre || a.id}`} onClick={() => setAQuitar(i)}>
            Quitar
          </button>
        </div>
      ))}

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar un producto para agregar como opción..."
        aria-label="Buscar alternativa"
        style={{ width: '100%', boxSizing: 'border-box', minHeight: '44px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 10px', fontSize: '14px' }}
      />
      {resultados.map((p) => (
        <button
          key={p.id}
          type="button"
          style={{ ...boton, display: 'block', width: '100%', textAlign: 'left', marginTop: '6px' }}
          onClick={() => {
            onCambiar([...alternativas, { id: String(p.id), nombre: p.nombre, cantidad: 1, disponible: true }]);
            setQ('');
          }}
        >
          Agregar {p.nombre}
        </button>
      ))}

      {aQuitar !== null && (
        <div role="alertdialog" aria-label="Quitar opción" style={{ marginTop: '8px', fontSize: '13px' }}>
          ¿Quitar {alternativas[aQuitar]?.nombre || 'esta opción'} de las alternativas?{' '}
          <button
            type="button"
            style={boton}
            onClick={() => {
              onCambiar(alternativas.filter((_, j) => j !== aQuitar));
              setAQuitar(null);
            }}
          >
            Sí
          </button>{' '}
          <button type="button" style={boton} onClick={() => setAQuitar(null)}>
            No
          </button>
        </div>
      )}
    </div>
  );
}

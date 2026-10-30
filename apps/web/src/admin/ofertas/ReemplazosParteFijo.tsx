import { useState } from 'react';
import { ModalConfirmacion } from './ModalConfirmacion';

interface ProductoLista {
  id: string;
  nombre: string;
  precio?: number;
}

interface Props {
  principalId: string;
  principalNombre: string;
  /** Ids de producto en orden: plan B, plan C... */
  reemplazos: string[];
  productos: ProductoLista[];
  onCambiar: (ids: string[]) => void;
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

/** Plan B, C...: lo que se ofrece en lugar del producto fijo cuando se agota (mismo precio del combo). */
export function ReemplazosParteFijo({ principalId, principalNombre, reemplazos, productos, onCambiar }: Props) {
  const [q, setQ] = useState('');
  const [aQuitar, setAQuitar] = useState<string | null>(null);
  const nombre = (id: string) => productos.find((p) => String(p.id) === id)?.nombre ?? `Producto ${id}`;
  const texto = q.trim().toLowerCase();
  const resultados = texto
    ? productos
        .filter((p) => String(p.id) !== principalId && !reemplazos.includes(String(p.id)) && p.nombre.toLowerCase().includes(texto))
        .slice(0, 6)
    : [];

  const mover = (i: number, dir: -1 | 1) => {
    const copia = [...reemplazos];
    [copia[i], copia[i + dir]] = [copia[i + dir], copia[i]];
    onCambiar(copia);
  };

  return (
    <div data-testid="reemplazos-parte" style={{ marginTop: '14px' }}>
      <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
        Si no hay {principalNombre || 'el producto principal'}, ofrecer en su lugar
      </div>
      <span style={{ fontSize: '12px', color: 'var(--cp-soft)', display: 'block', marginBottom: '8px' }}>
        Si el principal y todos los reemplazos se agotan, el combo se muestra agotado.
      </span>

      {reemplazos.map((id, i) => (
        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
          <strong style={{ minWidth: '56px', fontSize: '13px' }}>Plan {String.fromCharCode(66 + i)}</strong>
          <span style={{ flex: 1, fontSize: '14px' }}>{nombre(id)}</span>
          <button type="button" style={{ ...boton, opacity: i === 0 ? 0.4 : 1 }} disabled={i === 0} aria-label={`Subir ${nombre(id)}`} onClick={() => mover(i, -1)}>
            Subir
          </button>
          <button
            type="button"
            style={{ ...boton, opacity: i === reemplazos.length - 1 ? 0.4 : 1 }}
            disabled={i === reemplazos.length - 1}
            aria-label={`Bajar ${nombre(id)}`}
            onClick={() => mover(i, 1)}
          >
            Bajar
          </button>
          <button type="button" style={boton} aria-label={`Quitar ${nombre(id)}`} onClick={() => setAQuitar(id)}>
            Quitar
          </button>
        </div>
      ))}

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar un producto para agregar como reemplazo..."
        aria-label="Buscar reemplazo"
        style={{ width: '100%', boxSizing: 'border-box', minHeight: '44px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 10px', fontSize: '14px' }}
      />
      {resultados.map((p) => (
        <button
          key={p.id}
          type="button"
          style={{ ...boton, display: 'block', width: '100%', textAlign: 'left', marginTop: '6px' }}
          onClick={() => {
            onCambiar([...reemplazos, String(p.id)]);
            setQ('');
          }}
        >
          Agregar {p.nombre}
        </button>
      ))}

      <ModalConfirmacion
        abierto={aQuitar !== null}
        titulo="¿Quitar este reemplazo?"
        mensaje={aQuitar ? `${nombre(aQuitar)} dejará de ofrecerse en lugar de ${principalNombre || 'el producto principal'}.` : ''}
        textoConfirmar="Sí"
        textoCancelar="No"
        onConfirmar={() => {
          onCambiar(reemplazos.filter((x) => x !== aQuitar));
          setAQuitar(null);
        }}
        onCancelar={() => setAQuitar(null)}
      />
    </div>
  );
}

import { useState } from 'react';
import { SelectorSaboresMezcla } from '../comun/SelectorSaboresMezcla';
import { Reparto, aArreglo, aReparto, recortarAlTope, repartoValido } from '../comun/saboresMezcla';
import { useCarrito } from './CarritoContext';
import { mezclasDisponibles, saboresParaLinea } from './stock';

/**
 * Ventana para reelegir los sabores de una línea del carrito (con su cantidad) cuando el saldo cambió.
 * Muestra solo lo que queda para esa línea; el resto del pedido no se toca.
 */
export function AjusteSaboresLinea() {
  const { lineaAjustandoId, lineas, inventario, actualizarLinea, cerrarAjusteLinea } = useCarrito();
  const linea = lineas.find((l) => l.id === lineaAjustandoId) ?? null;
  const productoId = linea ? String(linea.productoId) : '';
  const info = inventario[productoId];
  const unidades = linea?.unidadesPorMezcla ?? 1;

  const [cantidad, setCantidad] = useState<number | null>(null);
  const [valor, setValor] = useState<Reparto>(() => aReparto(linea?.sabores ?? []));

  if (!linea) return null;

  const cantidadActual = cantidad ?? linea.cantidad;
  const disponibles = info && info.sabores ? saboresParaLinea(info, lineas, productoId, linea.id) : [];
  const maxMezclas = info ? mezclasDisponibles(info, lineas, productoId, unidades, linea.id) : 0;
  const tope = maxMezclas ?? Infinity;
  const total = unidades * cantidadActual;
  const valorOk = recortarAlTope(valor, disponibles, total);
  const listo = repartoValido(valorOk, total, disponibles);

  const confirmar = () => {
    if (!listo) return;
    const sabores = aArreglo(valorOk).map((s) => ({ ...s, nombre: disponibles.find((d) => d.id === s.saborId)?.nombre }));
    actualizarLinea(linea.id, { cantidad: cantidadActual, sabores });
    cerrarAjusteLinea();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Elegir sabores de ${linea.nombre}`}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(11,44,62,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, boxSizing: 'border-box' }}
    >
      <div
        style={{
          width: 'min(520px, 100%)',
          maxHeight: '100%',
          overflowY: 'auto',
          background: 'var(--cp-cream)',
          borderRadius: 18,
          padding: '18px 16px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18, color: 'var(--cp-navy)' }}>{linea.nombre}</div>
        {linea.tamanoNombre && <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>{linea.tamanoNombre}</div>}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--cp-navy)' }}>Mezclas</span>
          <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--cp-navy)', borderRadius: 12 }}>
            <button
              type="button"
              onClick={() => {
                setCantidad(Math.max(1, cantidadActual - 1));
              }}
              disabled={cantidadActual <= 1}
              aria-label="Menos mezclas"
              style={{ width: 44, height: 44, border: 0, background: 'transparent', color: 'var(--cp-navy)', fontSize: 22, fontWeight: 800 }}
            >
              −
            </button>
            <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{cantidadActual}</span>
            <button
              type="button"
              onClick={() => setCantidad(Math.min(tope, cantidadActual + 1))}
              disabled={cantidadActual >= tope}
              aria-label="Más mezclas"
              style={{ width: 44, height: 44, border: 0, background: 'transparent', color: 'var(--cp-navy)', fontSize: 22, fontWeight: 800 }}
            >
              +
            </button>
          </div>
        </div>

        {disponibles.length === 0 ? (
          <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
            Ya no quedan sabores de este producto. Quita la línea del carrito.
          </div>
        ) : (
          <SelectorSaboresMezcla sabores={disponibles} total={total} valor={valorOk} onCambio={setValor} />
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={cerrarAjusteLinea}
            style={{ flex: '1 1 120px', minHeight: 48, borderRadius: 12, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!listo}
            style={{
              flex: '1 1 160px',
              minHeight: 48,
              borderRadius: 12,
              border: 0,
              background: listo ? 'var(--cp-orange)' : 'var(--cp-line)',
              color: listo ? '#FFFFFF' : 'var(--cp-soft)',
              fontWeight: 800,
              cursor: listo ? 'pointer' : 'not-allowed',
            }}
          >
            {listo ? 'Guardar sabores' : 'Elige todos los sabores'}
          </button>
        </div>
      </div>
    </div>
  );
}

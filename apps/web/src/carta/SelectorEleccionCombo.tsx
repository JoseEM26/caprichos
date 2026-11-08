import type { CSSProperties } from 'react';
import { Reparto, totalElegido } from '../comun/saboresMezcla';
import { claveSabor, type ParteEleccion } from './ReemplazoCombo';

interface Props {
  parte: ParteEleccion;
  /** Unidades del combo en la línea: se eligen cantidad × unidades. */
  unidades: number;
  valor: Reparto;
  onCambio: (valor: Reparto) => void;
  deshabilitar?: boolean;
  /** Unidades ya comprometidas por sabor (este combo + carrito): el + de un sabor nunca supera su saldo. */
  usos?: Record<string, number>;
}

const boton: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  borderRadius: 22,
  border: '1.5px solid var(--cp-navy)',
  background: 'var(--cp-white)',
  color: 'var(--cp-navy)',
  fontWeight: 800,
  fontSize: 20,
  lineHeight: 1,
  cursor: 'pointer',
};

/**
 * Elegir las opciones de una parte del combo (p. ej. «2 juguetes»): un contador por opción, sin repetir
 * más de lo elegido en total. Las opciones agotadas se ven, pero no se pueden elegir.
 */
export function SelectorEleccionCombo({ parte, unidades, valor, onCambio, deshabilitar = false, usos = {} }: Props) {
  const total = parte.cantidad * unidades;
  const elegidas = totalElegido(valor);
  const faltan = Math.max(0, total - elegidas);
  const sobran = Math.max(0, elegidas - total);

  const fijar = (id: string, n: number) => {
    const nuevo: Reparto = { ...valor };
    if (n > 0) nuevo[id] = n;
    else delete nuevo[id];
    onCambio(nuevo);
  };

  // Una fila: nombre (con aviso si no hay stock), y −, cantidad, + (el + solo si puedeMas)
  const fila = (clave: string, etiqueta: string, cantidad: number, disponible: boolean, puedeMas: boolean, aviso: string | null, indentada = false) => (
    <div
      key={clave}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        minHeight: 48,
        opacity: disponible ? 1 : 0.5,
        paddingLeft: indentada ? 12 : 0,
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, lineHeight: '18px', color: 'var(--cp-navy)' }}>
        {etiqueta}
        {aviso && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--cp-rust)' }}>{aviso}</span>}
      </span>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          aria-label={`Quitar ${etiqueta}`}
          onClick={() => fijar(clave, cantidad - 1)}
          disabled={deshabilitar || cantidad === 0}
          style={{ ...boton, opacity: cantidad === 0 ? 0.4 : 1 }}
        >
          −
        </button>
        <span aria-label={`Cantidad de ${etiqueta}`} style={{ minWidth: 24, textAlign: 'center', fontWeight: 800 }}>
          {cantidad}
        </span>
        <button
          type="button"
          aria-label={`Agregar ${etiqueta}`}
          onClick={() => fijar(clave, cantidad + 1)}
          disabled={!puedeMas}
          style={{ ...boton, opacity: puedeMas ? 1 : 0.4 }}
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div
      role="group"
      aria-label={`Elige ${total} de la parte del combo`}
      data-testid={`eleccion-combo-${parte.parteId}`}
      style={{ border: '1.5px solid var(--cp-line)', borderRadius: 14, padding: 12, background: 'var(--cp-white)', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span aria-live="polite" style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy)' }}>
          {`Elige ${total} ${total === 1 ? 'opción' : 'opciones'}`}
        </span>
        {sobran > 0 ? (
          <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--cp-rust)' }}>{`Sobran ${sobran}: quita unidades`}</span>
        ) : faltan > 0 ? (
          <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--cp-rust)' }}>{`Faltan ${faltan}`}</span>
        ) : (
          <span style={{ fontWeight: 800, fontSize: 12, color: '#2F9E57' }}>Completo ✓</span>
        )}
      </div>

      {parte.opciones.map((o) => {
        if (o.sabores && o.sabores.length > 0) {
          // Producto por sabor: un contador por sabor; el + no supera el saldo del sabor (ni lo que ya va en el combo o carrito)
          return (
            <div key={o.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--cp-navy)' }}>{o.nombre}</span>
              {o.sabores.map((s) => {
                const clave = claveSabor(o.id, s.id);
                const cantidad = valor[clave] ?? 0;
                const restan = s.saldo - (usos[s.id] ?? 0);
                const puedeMas = !deshabilitar && s.disponible && elegidas < total && restan > 0;
                const sinStock = !s.disponible || (restan <= 0 && cantidad === 0);
                return fila(clave, `${o.nombre} · ${s.nombre}`, cantidad, !sinStock, puedeMas, sinStock ? 'No hay stock' : null, true);
              })}
            </div>
          );
        }
        const cantidad = valor[o.id] ?? 0;
        const puedeMas = !deshabilitar && o.disponible && elegidas < total;
        return fila(o.id, o.nombre, cantidad, o.disponible, puedeMas, o.disponible ? null : o.sinStock ? 'No hay stock' : 'Agotado');
      })}
    </div>
  );
}

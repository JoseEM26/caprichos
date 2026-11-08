import { useId, useState } from 'react';
import { Reparto, totalElegido } from '../comun/saboresMezcla';
import { claveSabor, type ParteEleccion } from './ReemplazoCombo';
import './combo-armado.css';

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

/** «1 Fresa · 2 Manjar»: lo elegido en una parte (o en un producto de ella, con `solo`). */
export function resumenReparto(parte: ParteEleccion, valor: Reparto, solo?: string, separador = ' · '): string {
  return Object.entries(valor)
    .filter(([clave, n]) => n > 0 && (!solo || clave.split('|')[0] === solo))
    .map(([clave, n]) => {
      const [pid, sid] = clave.split('|');
      const o = parte.opciones.find((x) => x.id === pid);
      return `${n} ${(sid ? o?.sabores?.find((s) => s.id === sid)?.nombre : undefined) ?? o?.nombre ?? ''}`.trim();
    })
    .join(separador);
}

/**
 * Elegir las opciones de una parte del combo (p. ej. «2 donas»): un contador por opción, sin repetir
 * más de lo elegido en total. Cada producto por sabor es una tarjeta plegable con sus sabores en rejilla;
 * las opciones agotadas se ven, pero no se pueden elegir.
 */
export function SelectorEleccionCombo({ parte, unidades, valor, onCambio, deshabilitar = false, usos = {} }: Props) {
  const total = parte.cantidad * unidades;
  const base = useId();
  const elegidas = totalElegido(valor);
  const faltan = Math.max(0, total - elegidas);
  const sobran = Math.max(0, elegidas - total);
  const porSabor = parte.opciones.filter((o) => o.sabores && o.sabores.length > 0);
  // abiertas: al inicio la primera tarjeta de sabores
  const [abiertas, setAbiertas] = useState<string[]>(() => (porSabor[0] ? [porSabor[0].id] : []));
  const alternar = (id: string) => setAbiertas((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const fijar = (id: string, n: number) => {
    const nuevo: Reparto = { ...valor };
    if (n > 0) nuevo[id] = n;
    else delete nuevo[id];
    onCambio(nuevo);
  };

  // Un sabor: nombre (con aviso si no hay stock), y −, cantidad, + (el + solo si puedeMas)
  const casilla = (clave: string, etiqueta: string, visible: string, cantidad: number, disponible: boolean, puedeMas: boolean, aviso: string | null) => (
    <div key={clave} className="ca-sabor" data-n={cantidad > 0 ? 'si' : 'no'} data-agotado={disponible ? 'no' : 'si'}>
      <span style={{ minWidth: 0, fontWeight: 700, fontSize: 13, lineHeight: '16px', color: 'var(--cp-navy)' }}>
        {visible}
        {aviso && <span style={{ display: 'block', fontSize: 12, color: 'var(--cp-rust)' }}>{aviso}</span>}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <button type="button" className="ca-paso" aria-label={`Quitar ${etiqueta}`} onClick={() => fijar(clave, cantidad - 1)} disabled={deshabilitar || cantidad === 0}>
          −
        </button>
        <span aria-label={`Cantidad de ${etiqueta}`} style={{ minWidth: 20, textAlign: 'center', fontWeight: 800, fontSize: 15, color: 'var(--cp-navy)' }}>
          {cantidad}
        </span>
        <button type="button" className="ca-paso" aria-label={`Agregar ${etiqueta}`} onClick={() => fijar(clave, cantidad + 1)} disabled={!puedeMas}>
          +
        </button>
      </div>
    </div>
  );

  const sueltas = parte.opciones.filter((o) => !(o.sabores && o.sabores.length > 0));
  const completo = total > 0 && elegidas === total;
  const rejilla = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))', gap: 8 } as const;

  return (
    <div
      role="group"
      aria-label={`Elige ${total} de la parte del combo`}
      data-testid={`eleccion-combo-${parte.parteId}`}
      style={{ border: `1.5px solid ${completo ? 'var(--cp-green)' : 'var(--cp-line)'}`, borderRadius: 14, padding: 12, background: 'var(--cp-white)', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy)' }}>{`Elige ${total} ${total === 1 ? 'opción' : 'opciones'}`}</span>
        <span aria-live="polite" style={{ fontWeight: 800, fontSize: 12, color: completo ? 'var(--cp-green)' : 'var(--cp-rust)' }}>
          {sobran > 0 ? `Sobran ${sobran}: quita unidades` : faltan > 0 ? `Faltan ${faltan}` : 'Completo ✓'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="ca-barra" data-completo={completo ? 'si' : 'no'} role="progressbar" aria-label="Opciones elegidas" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(elegidas, total)}>
          <span style={{ width: `${total > 0 ? Math.min(100, (elegidas / total) * 100) : 0}%` }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>{`${Math.min(elegidas, total)} de ${total} elegidas`}</span>
      </div>

      {porSabor.map((o) => {
        const abierta = abiertas.includes(o.id);
        const idCuerpo = `${base}-${o.id}`;
        const resumen = resumenReparto(parte, valor, o.id);
        return (
          <div key={o.id} className="ca-tarjeta" style={{ background: 'var(--cp-cream)' }}>
            <button type="button" className="ca-cab" aria-expanded={abierta} aria-controls={idCuerpo} onClick={() => alternar(o.id)}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>{o.nombre}</span>
                {!abierta && (
                  <span style={{ display: 'block', fontSize: 12, color: resumen ? 'var(--cp-navy)' : 'var(--cp-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumen || 'Ninguno elegido'}</span>
                )}
              </span>
              <span aria-hidden="true" style={{ flex: 'none', fontSize: 16, color: 'var(--cp-soft)' }}>{abierta ? '▴' : '▾'}</span>
            </button>
            <div id={idCuerpo} className="ca-cuerpo" hidden={!abierta}>
              <div style={rejilla}>
                {(o.sabores ?? []).map((s) => {
                  const clave = claveSabor(o.id, s.id);
                  const cantidad = valor[clave] ?? 0;
                  const restan = s.saldo - (usos[s.id] ?? 0);
                  const puedeMas = !deshabilitar && s.disponible && elegidas < total && restan > 0;
                  const sinStock = !s.disponible || (restan <= 0 && cantidad === 0);
                  return casilla(clave, `${o.nombre} · ${s.nombre}`, s.nombre, cantidad, !sinStock, puedeMas, sinStock ? 'No hay stock' : null);
                })}
              </div>
            </div>
          </div>
        );
      })}

      {sueltas.length > 0 && (
        <div style={rejilla}>
          {sueltas.map((o) => {
            const cantidad = valor[o.id] ?? 0;
            const puedeMas = !deshabilitar && o.disponible && elegidas < total;
            return casilla(o.id, o.nombre, o.nombre, cantidad, o.disponible, puedeMas, o.disponible ? null : o.sinStock ? 'No hay stock' : 'Agotado');
          })}
        </div>
      )}
    </div>
  );
}

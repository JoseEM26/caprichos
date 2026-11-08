import { useState } from 'react';
import type { OpcionDetalleCombo } from '../admin/ofertas/ofertasApi';
import { claveSabor, type ParteEleccion } from './ReemplazoCombo';

interface Props {
  parte: ParteEleccion;
  /** Unidades del combo en la línea: hay cantidad × unidades pasos «Bebida N». */
  unidades: number;
  /** Clave elegida en cada paso (producto o «producto|sabor»); '' = sin elegir. */
  valor: string[];
  onCambio: (valor: string[]) => void;
  deshabilitar?: boolean;
  /** Unidades ya comprometidas por sabor (este combo + carrito). */
  usos?: Record<string, number>;
}

interface Candidata {
  clave: string;
  nombre: string;
  etiqueta: string;
  fotoUrl?: string;
  ok: boolean;
  aviso: string | null;
}

/** Cada bebida (o cada sabor de una bebida por sabor) como una opción que se puede elegir o no. */
function candidatas(opciones: OpcionDetalleCombo[], usos: Record<string, number>): Candidata[] {
  return opciones.flatMap((o): Candidata[] => {
    if (o.sabores && o.sabores.length > 0) {
      return o.sabores.map((s) => {
        const ok = s.disponible && s.saldo - (usos[s.id] ?? 0) > 0;
        return { clave: claveSabor(o.id, s.id), nombre: o.nombre, etiqueta: `${o.nombre} · ${s.nombre}`, fotoUrl: o.fotoUrl, ok, aviso: ok ? null : 'No hay stock' };
      });
    }
    return [{ clave: o.id, nombre: o.nombre, etiqueta: o.nombre, fotoUrl: o.fotoUrl, ok: o.disponible, aviso: o.disponible ? null : o.sinStock ? 'No hay stock' : 'Agotado' }];
  });
}

/**
 * Parte de bebidas del combo («Bebida 1», «Bebida 2»…): un paso por bebida con los productos de las categorías
 * que marcó el dueño, con foto y nombre. Sin precio extra (el combo ya lo incluye).
 */
export function PasosBebidaCombo({ parte, unidades, valor, onCambio, deshabilitar = false, usos = {} }: Props) {
  const total = parte.cantidad * unidades;
  const [busqueda, setBusqueda] = useState('');
  const todas = candidatas(parte.opciones, usos);
  const q = busqueda.trim().toLowerCase();

  const elegir = (i: number, clave: string) => {
    const nuevo = Array.from({ length: total }, (_, k) => valor[k] ?? '');
    nuevo[i] = nuevo[i] === clave ? '' : clave;
    onCambio(nuevo);
  };

  return (
    <div data-testid={`bebidas-combo-${parte.parteId}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {todas.length > 8 && (
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar bebida"
          aria-label="Buscar bebida"
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 9999, border: '1.5px solid var(--cp-line)', background: 'var(--cp-cream)', color: 'var(--cp-navy)', padding: '0 14px', fontSize: 13 }}
        />
      )}
      {Array.from({ length: total }, (_, i) => {
        const actual = valor[i] ?? '';
        const lista = todas.filter((c) => !q || c.etiqueta.toLowerCase().includes(q) || c.clave === actual);
        const elegida = todas.find((c) => c.clave === actual);
        return (
          <div
            key={i}
            role="group"
            aria-label={`Bebida ${i + 1}`}
            style={{ border: `1.5px solid ${elegida ? 'var(--cp-line)' : 'var(--cp-orange)'}`, borderRadius: 14, padding: '10px 12px', background: 'var(--cp-white)', display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy)' }}>{`Bebida ${i + 1}`}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: elegida ? '#2F9E57' : 'var(--cp-rust)' }}>
                {elegida ? `✓ ${elegida.etiqueta}` : 'Elige una'}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
              {lista.map((c) => {
                const on = c.clave === actual;
                const bloqueada = !c.ok && !on;
                return (
                  <button
                    key={c.clave}
                    type="button"
                    aria-pressed={on}
                    disabled={deshabilitar || bloqueada}
                    onClick={() => elegir(i, c.clave)}
                    style={{
                      minHeight: 44,
                      padding: '4px 12px 4px 4px',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      border: `2px solid ${on ? 'var(--cp-orange)' : 'var(--cp-line)'}`,
                      background: on ? 'rgba(230,121,41,0.16)' : 'var(--cp-white)',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: 13,
                      textAlign: 'left',
                      opacity: bloqueada ? 0.5 : 1,
                      cursor: bloqueada ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {c.fotoUrl ? (
                      <img src={c.fotoUrl} alt="" width={36} height={36} loading="lazy" style={{ borderRadius: 8, objectFit: 'cover', flex: 'none' }} />
                    ) : null}
                    <span>
                      {c.etiqueta}
                      {c.aviso && <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--cp-rust)' }}>· {c.aviso}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

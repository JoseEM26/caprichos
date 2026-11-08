import { useId, useRef, useState } from 'react';
import './combo-armado.css';
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
  categoria?: string;
  ok: boolean;
  aviso: string | null;
}

/** Cada bebida (o cada sabor de una bebida por sabor) como una opción que se puede elegir o no. */
export function candidatas(opciones: OpcionDetalleCombo[], usos: Record<string, number>): Candidata[] {
  return opciones.flatMap((o): Candidata[] => {
    if (o.sabores && o.sabores.length > 0) {
      return o.sabores.map((s) => {
        const ok = s.disponible && s.saldo - (usos[s.id] ?? 0) > 0;
        return { clave: claveSabor(o.id, s.id), nombre: o.nombre, etiqueta: `${o.nombre} · ${s.nombre}`, fotoUrl: o.fotoUrl, categoria: o.categoria, ok, aviso: ok ? null : 'No hay stock' };
      });
    }
    return [{ clave: o.id, nombre: o.nombre, etiqueta: o.nombre, fotoUrl: o.fotoUrl, categoria: o.categoria, ok: o.disponible, aviso: o.disponible ? null : o.sinStock ? 'No hay stock' : 'Agotado' }];
  });
}

/** Minúsculas y sin acentos: «cafe» encuentra «CAFÉ». */
const plano = (t: string): string => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Etiqueta de la bebida elegida con esa clave (para resúmenes y nombres de vaso). */
export const etiquetaBebida = (parte: ParteEleccion, clave: string): string => candidatas(parte.opciones, {}).find((c) => c.clave === clave)?.etiqueta ?? '';

/**
 * Parte de bebidas del combo («Bebida 1», «Bebida 2»…): una tarjeta plegable por bebida. Cerrada muestra lo elegido;
 * abierta, buscador, categorías (si las hay) y una rejilla compacta. Al elegir se cierra y abre la siguiente pendiente.
 * Sin precio extra (el combo ya lo incluye).
 */
export function PasosBebidaCombo({ parte, unidades, valor, onCambio, deshabilitar = false, usos = {} }: Props) {
  const total = parte.cantidad * unidades;
  const base = useId();
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  // la tarjeta abierta: al inicio, la primera sin elegir
  const [abierta, setAbierta] = useState<number | null>(() => {
    const i = Array.from({ length: total }, (_, k) => k).find((k) => !valor[k]);
    return i === undefined ? null : i;
  });
  const [busqueda, setBusqueda] = useState('');
  const [cat, setCat] = useState('');
  const todas = candidatas(parte.opciones, usos);
  const categorias = Array.from(new Set(todas.map((c) => c.categoria).filter((c): c is string => !!c)));
  const q = plano(busqueda.trim());

  const abrir = (i: number | null) => {
    setAbierta(i);
    setBusqueda('');
    setCat('');
  };

  const fijar = (i: number, clave: string) => {
    const nuevo = Array.from({ length: total }, (_, k) => valor[k] ?? '');
    nuevo[i] = clave;
    onCambio(nuevo);
    if (!clave) return;
    // cierra esta y abre la siguiente pendiente (primero hacia adelante), con scroll suave
    const sig = [...Array.from({ length: total - i - 1 }, (_, k) => i + 1 + k), ...Array.from({ length: i }, (_, k) => k)].find((k) => !nuevo[k]);
    abrir(sig ?? null);
    const destino = sig ?? i;
    setTimeout(() => refs.current[destino]?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), 0);
  };
  const elegir = (i: number, clave: string) => fijar(i, (valor[i] ?? '') === clave ? '' : clave);

  return (
    <div data-testid={`bebidas-combo-${parte.parteId}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: total }, (_, i) => {
        const actual = valor[i] ?? '';
        const elegida = todas.find((c) => c.clave === actual);
        const open = abierta === i;
        const idCuerpo = `${base}-b${i}`;
        const lista = todas.filter((c) => (!q || plano(c.etiqueta).includes(q) || c.clave === actual) && (!cat || c.categoria === cat || c.clave === actual));
        const primera = valor[0] ? todas.find((c) => c.clave === valor[0]) : undefined;
        return (
          <div
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="group"
            aria-label={`Bebida ${i + 1}`}
            className="ca-tarjeta"
            data-pendiente={elegida ? 'no' : 'si'}
          >
            <button type="button" className="ca-cab" aria-expanded={open} aria-controls={idCuerpo} disabled={deshabilitar} onClick={() => abrir(open ? null : i)}>
              <span style={{ flex: 'none', width: 28, height: 28, borderRadius: 14, background: elegida ? 'var(--cp-green)' : 'var(--cp-line)', color: elegida ? '#FFFFFF' : 'var(--cp-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                {elegida ? '✓' : i + 1}
              </span>
              {elegida?.fotoUrl ? <img src={elegida.fotoUrl} alt="" width={36} height={36} style={{ borderRadius: 8, objectFit: 'cover', flex: 'none' }} /> : null}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>{`Bebida ${i + 1}`}</span>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 14, color: elegida ? 'var(--cp-navy)' : 'var(--cp-rust)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {elegida ? elegida.etiqueta : `Elige tu bebida ${i + 1}`}
                </span>
              </span>
              <span style={{ flex: 'none', fontSize: 12, fontWeight: 800, color: 'var(--cp-rust)' }}>{open ? 'Cerrar' : elegida ? 'Cambiar' : 'Elegir'}</span>
            </button>
            <div id={idCuerpo} className="ca-cuerpo" hidden={!open}>
              {open && (
                <>
                  {i > 0 && primera && primera.ok && actual !== primera.clave && (
                    <button type="button" className="ca-chip" disabled={deshabilitar} onClick={() => fijar(i, primera.clave)} style={{ alignSelf: 'flex-start' }}>
                      {`Misma que la bebida 1 · ${primera.etiqueta}`}
                    </button>
                  )}
                  {todas.length > 8 && (
                    <input
                      type="search"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar bebida"
                      aria-label="Buscar bebida"
                      style={{ width: '100%', minHeight: 44, borderRadius: 9999, border: '1.5px solid var(--cp-line)', background: 'var(--cp-cream)', color: 'var(--cp-navy)', padding: '0 14px', fontSize: 14 }}
                    />
                  )}
                  {categorias.length >= 2 && (
                    <div role="group" aria-label="Categoría de bebida" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                      {['', ...categorias].map((c) => (
                        <button key={c || 'todas'} type="button" className="ca-chip" aria-pressed={cat === c} onClick={() => setCat(c)} style={{ flex: 'none' }}>
                          {c || 'Todas'}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="ca-rejilla">
                    {lista.map((c) => {
                      const on = c.clave === actual;
                      const bloqueada = !c.ok && !on;
                      return (
                        <button key={c.clave} type="button" className="ca-op" aria-pressed={on} disabled={deshabilitar || bloqueada} onClick={() => elegir(i, c.clave)}>
                          {c.fotoUrl ? <img src={c.fotoUrl} alt="" width={32} height={32} loading="lazy" style={{ borderRadius: 8, objectFit: 'cover', flex: 'none' }} /> : null}
                          <span style={{ flex: 1, minWidth: 0 }}>
                            {on ? '✓ ' : ''}
                            {c.etiqueta}
                            {c.aviso && <span style={{ display: 'block', fontSize: 12, color: 'var(--cp-rust)' }}>{c.aviso}</span>}
                          </span>
                        </button>
                      );
                    })}
                    {lista.length === 0 && <span style={{ gridColumn: '1 / -1', fontSize: 13, color: 'var(--cp-soft)' }}>No hay bebidas con ese nombre.</span>}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import {
  ETIQUETA_ITEM_FRANJA,
  ETIQUETA_SECCION,
} from '../../carta/disposicion';
import type { DisposicionCarta } from '../../carta/disposicion';

interface Props {
  disposicion: DisposicionCarta;
  onCambiar: (nueva: DisposicionCarta) => void;
}

const TAMANO_BANNER = [
  { v: 'compacto', t: 'Compacto' },
  { v: 'normal', t: 'Normal (como hoy)' },
  { v: 'grande', t: 'Grande' },
] as const;

const TAMANO_TARJETA = [
  { v: 'chico', t: 'Chico' },
  { v: 'normal', t: 'Normal (como hoy)' },
  { v: 'grande', t: 'Grande' },
] as const;

const estilo = {
  select: {
    minHeight: 38,
    borderRadius: 10,
    border: '1.5px solid var(--cp-line)',
    background: 'var(--cp-white)',
    color: 'var(--cp-navy)',
    padding: '0 8px',
    fontSize: 13,
  },
  boton: {
    minHeight: 34,
    minWidth: 64,
    borderRadius: 10,
    border: '1.5px solid var(--cp-navy)',
    background: 'var(--cp-white)',
    color: 'var(--cp-navy)',
    fontWeight: 800,
    fontSize: 12,
    cursor: 'pointer',
  },
  fila: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 12,
    border: '1px solid var(--cp-line)',
    background: 'var(--cp-cream)',
    fontSize: 13,
  },
  etiqueta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 700,
    color: 'var(--cp-navy)',
  },
} as const;

function moverEn<T>(lista: T[], idx: number, dir: -1 | 1): T[] {
  const j = idx + dir;
  if (j < 0 || j >= lista.length) return lista;
  const copia = [...lista];
  [copia[idx], copia[j]] = [copia[j], copia[idx]];
  return copia;
}

function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--cp-navy)', flex: '1 1 180px' }}>
      {titulo}
      {children}
    </label>
  );
}

/** Controles de tamaño y posición de la carta pública. Cada cambio se guarda como borrador. */
export function DisposicionControles({ disposicion: d, onCambiar }: Props) {
  return (
    <section
      aria-label="Orden y tamaños de la carta"
      style={{
        border: '1.5px solid var(--cp-navy)',
        borderRadius: 20,
        background: 'var(--cp-white)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div>
        <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 14, letterSpacing: '0.06em', color: 'var(--cp-navy)' }}>
          ORDEN Y TAMAÑOS DE LA CARTA
        </div>
        <div style={{ fontSize: 12, color: 'var(--cp-soft)', marginTop: 4 }}>
          Lo que ves en la vista previa es lo que verá el cliente. Los cambios quedan en borrador hasta publicar.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--cp-navy)' }}>Orden de las secciones (de arriba abajo)</div>
        {d.secciones.map((s, i) => (
          <div key={s.id} style={estilo.fila}>
            <label style={estilo.etiqueta}>
              <input
                type="checkbox"
                checked={s.visible}
                onChange={(e) => onCambiar({ ...d, secciones: d.secciones.map((x) => (x.id === s.id ? { ...x, visible: e.target.checked } : x)) })}
              />
              {ETIQUETA_SECCION[s.id]}
            </label>
            <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" style={{ ...estilo.boton, opacity: i === 0 ? 0.4 : 1 }} disabled={i === 0} aria-label={`Subir ${ETIQUETA_SECCION[s.id]}`} onClick={() => onCambiar({ ...d, secciones: moverEn(d.secciones, i, -1) })}>Subir</button>
              <button type="button" style={{ ...estilo.boton, opacity: i === d.secciones.length - 1 ? 0.4 : 1 }} disabled={i === d.secciones.length - 1} aria-label={`Bajar ${ETIQUETA_SECCION[s.id]}`} onClick={() => onCambiar({ ...d, secciones: moverEn(d.secciones, i, 1) })}>Bajar</button>
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Campo titulo="Alto del banner en PC">
          <select style={estilo.select} value={d.banner.tamanoPc} onChange={(e) => onCambiar({ ...d, banner: { ...d.banner, tamanoPc: e.target.value as DisposicionCarta['banner']['tamanoPc'] } })}>
            {TAMANO_BANNER.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
        </Campo>
        <Campo titulo="Alto del banner en celular">
          <select style={estilo.select} value={d.banner.tamanoCelular} onChange={(e) => onCambiar({ ...d, banner: { ...d.banner, tamanoCelular: e.target.value as DisposicionCarta['banner']['tamanoCelular'] } })}>
            {TAMANO_BANNER.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
        </Campo>
        <Campo titulo="Foto del producto">
          <select style={estilo.select} value={d.banner.ajusteFoto} onChange={(e) => onCambiar({ ...d, banner: { ...d.banner, ajusteFoto: e.target.value as DisposicionCarta['banner']['ajusteFoto'] } })}>
            <option value="cubrir">Llenar el círculo (como hoy)</option>
            <option value="contener">Ver la foto completa</option>
          </select>
        </Campo>
        <Campo titulo="Punto de enfoque de la foto">
          <select style={estilo.select} value={d.banner.focoFoto} onChange={(e) => onCambiar({ ...d, banner: { ...d.banner, focoFoto: e.target.value as DisposicionCarta['banner']['focoFoto'] } })}>
            <option value="arriba">Arriba</option>
            <option value="centro">Centro (como hoy)</option>
            <option value="abajo">Abajo</option>
          </select>
        </Campo>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--cp-navy)' }}>Franja de datos (abierto, delivery, entrega, pagos)</div>
        {d.franja.items.map((it, i) => (
          <div key={it.id} style={estilo.fila}>
            <label style={estilo.etiqueta}>
              <input
                type="checkbox"
                checked={it.visible}
                onChange={(e) => onCambiar({ ...d, franja: { items: d.franja.items.map((x) => (x.id === it.id ? { ...x, visible: e.target.checked } : x)) } })}
              />
              {ETIQUETA_ITEM_FRANJA[it.id]}
            </label>
            <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" style={{ ...estilo.boton, opacity: i === 0 ? 0.4 : 1 }} disabled={i === 0} aria-label={`Subir ${ETIQUETA_ITEM_FRANJA[it.id]}`} onClick={() => onCambiar({ ...d, franja: { items: moverEn(d.franja.items, i, -1) } })}>Subir</button>
              <button type="button" style={{ ...estilo.boton, opacity: i === d.franja.items.length - 1 ? 0.4 : 1 }} disabled={i === d.franja.items.length - 1} aria-label={`Bajar ${ETIQUETA_ITEM_FRANJA[it.id]}`} onClick={() => onCambiar({ ...d, franja: { items: moverEn(d.franja.items, i, 1) } })}>Bajar</button>
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Campo titulo="Tamaño de Momentos Caprichos">
          <select style={estilo.select} value={d.momentos.tamano} onChange={(e) => onCambiar({ ...d, momentos: { tamano: e.target.value as DisposicionCarta['momentos']['tamano'] } })}>
            {TAMANO_TARJETA.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
        </Campo>
        <Campo titulo="Tamaño de las tarjetas de Novedades">
          <select style={estilo.select} value={d.novedades.tamano} onChange={(e) => onCambiar({ ...d, novedades: { tamano: e.target.value as DisposicionCarta['novedades']['tamano'] } })}>
            {TAMANO_TARJETA.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
        </Campo>
        <Campo titulo="Productos por fila en PC">
          <select style={estilo.select} value={d.carta.columnasPc} onChange={(e) => onCambiar({ ...d, carta: { columnasPc: e.target.value as DisposicionCarta['carta']['columnasPc'] } })}>
            <option value="auto">Automático (como hoy)</option>
            <option value="2">2 por fila</option>
            <option value="3">3 por fila</option>
            <option value="4">4 por fila</option>
          </select>
        </Campo>
      </div>
    </section>
  );
}

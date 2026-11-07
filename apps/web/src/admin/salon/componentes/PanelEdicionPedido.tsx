import { MapaUbicacion } from '../../../comun/mapa/MapaUbicacion';
import type { Punto } from '../../../comun/mapa/MapaUbicacion';
import { BuscadorDireccion } from '../../../comun/mapa/BuscadorDireccion';

export interface PanelEdicionPedidoProps {
  /** Un pedido de mesa no cambia de modalidad. */
  modalidadEditable: boolean;
  modalidad: 'local' | 'llevar' | 'delivery';
  onModalidad: (m: 'llevar' | 'delivery') => void;
  nombre: string;
  onNombre: (v: string) => void;
  telefono: string;
  onTelefono: (v: string) => void;
  direccion: string;
  onDireccion: (v: string) => void;
  referencia: string;
  onReferencia: (v: string) => void;
  punto: Punto | null;
  onPunto: (p: Punto | null) => void;
  sede?: Punto;
  zona: string | null;
  tieneVoucher: boolean;
  /** Nombre de otra persona que tiene abierto el editor de este pedido. */
  editandoPor: string | null;
}

const campo: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 8,
  border: '1.5px solid var(--cp-line)',
  background: 'var(--cp-white)',
  padding: '0 10px',
  fontSize: 14,
};
const etiqueta: React.CSSProperties = { fontWeight: 700, fontSize: 12, color: 'var(--cp-navy)' };

/** Datos del cliente y de la entrega que se pueden corregir al editar un pedido sin cobrar. */
export function PanelEdicionPedido(p: PanelEdicionPedidoProps) {
  const esDelivery = p.modalidad === 'delivery';
  return (
    <div className="np-edicion" style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="panel-edicion-pedido">
      {p.editandoPor && (
        <div role="status" style={{ background: '#FFF4D6', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 700, color: 'var(--cp-navy)' }}>
          {p.editandoPor} también está editando este pedido. El primero que guarde se queda; el otro tendrá que revisar.
        </div>
      )}
      {p.tieneVoucher && (
        <div role="status" style={{ background: '#FFF4D6', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--cp-navy)' }}>
          Este pedido ya tiene un voucher. Si cambia el total, revisa el monto al cobrar.
        </div>
      )}
      {p.modalidadEditable && (
        <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Modalidad">
          {(['llevar', 'delivery'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={p.modalidad === m}
              onClick={() => p.onModalidad(m)}
              style={{
                flex: 1,
                minHeight: 40,
                borderRadius: 9999,
                border: '1.5px solid var(--cp-navy)',
                background: p.modalidad === m ? 'var(--cp-navy)' : 'transparent',
                color: p.modalidad === m ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {m === 'llevar' ? 'Para llevar' : 'Delivery'}
            </button>
          ))}
        </div>
      )}
      <label htmlFor="ed-nombre" style={etiqueta}>Nombre del cliente</label>
      <input id="ed-nombre" style={campo} value={p.nombre} onChange={(e) => p.onNombre(e.target.value)} />
      <label htmlFor="ed-telefono" style={etiqueta}>Celular (opcional)</label>
      <input
        id="ed-telefono"
        style={campo}
        inputMode="numeric"
        maxLength={9}
        value={p.telefono}
        onChange={(e) => p.onTelefono(e.target.value.replace(/\D/g, ''))}
      />
      {esDelivery && (
        <>
          <label htmlFor="ed-direccion" style={etiqueta}>Dirección</label>
          <input id="ed-direccion" style={campo} value={p.direccion} onChange={(e) => p.onDireccion(e.target.value)} />
          <label htmlFor="ed-referencia" style={etiqueta}>Referencia</label>
          <input id="ed-referencia" style={campo} value={p.referencia} onChange={(e) => p.onReferencia(e.target.value)} />
          <BuscadorDireccion
            onElegir={(pt, texto) => {
              p.onPunto(pt);
              if (!p.direccion.trim() && texto) p.onDireccion(texto.split(',').slice(0, 2).join(',').trim());
            }}
          />
          <MapaUbicacion punto={p.punto} onCambiar={(c) => p.onPunto(c)} altura={180} local={p.sede} ajustarA={p.punto ? 'ambos' : 'local'} />
          <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
            {p.punto ? `Zona: ${p.zona ?? 'calculando…'}` : 'Sin punto en el mapa: el envío queda por confirmar.'}
          </div>
        </>
      )}
    </div>
  );
}

import type { DireccionCliente } from './tipos';
import { MapaUbicacion } from '../comun/mapa/MapaUbicacion';

interface SelectorDireccionesClienteProps {
  /** null mientras carga la libreta */
  direcciones: DireccionCliente[] | null;
  ocupado: boolean;
  aviso: string | null;
  alElegir: (direccion: DireccionCliente) => void;
  alNueva: () => void;
}

const textoUsos = (usos: number) => (usos === 1 ? 'usada 1 vez' : `usada ${usos} veces`);

/** Pregunta «¿A dónde lo enviamos?»: direcciones anteriores del cliente con cuenta, o una nueva. */
export function SelectorDireccionesCliente({ direcciones, ocupado, aviso, alElegir, alNueva }: SelectorDireccionesClienteProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--cp-white)',
        padding: '16px',
        borderRadius: '14px',
        border: '1px solid var(--cp-line)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: '14px' }}>¿A dónde lo enviamos?</div>

      {direcciones === null ? (
        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>Buscando tus direcciones...</div>
      ) : (
        <>
          {direcciones.map((d) => (
            <button
              key={d.id}
              type="button"
              disabled={ocupado}
              onClick={() => alElegir(d)}
              style={{
                minHeight: '44px',
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1.5px solid var(--cp-line)',
                backgroundColor: 'var(--cp-cream)',
                color: 'var(--cp-navy)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                cursor: ocupado ? 'wait' : 'pointer',
              }}
            >
              {d.lat != null && d.lng != null && (
                <div style={{ width: '100%', pointerEvents: 'none' }} data-testid="mini-mapa-direccion">
                  <MapaUbicacion
                    punto={{ lat: Number(d.lat), lng: Number(d.lng) }}
                    altura={96}
                    soloLectura
                    ajustarA="punto"
                    etiqueta={`Mapa de ${d.direccion}`}
                  />
                </div>
              )}
              <span style={{ fontWeight: 800, fontSize: '14px' }}>{d.direccion}</span>
              {d.referencia && <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{d.referencia}</span>}
              <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{textoUsos(d.usos)}</span>
            </button>
          ))}
          <button
            type="button"
            disabled={ocupado}
            onClick={alNueva}
            style={{
              minHeight: '44px',
              padding: '0 12px',
              borderRadius: '12px',
              border: '1.5px dashed var(--cp-navy)',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '14px',
              cursor: ocupado ? 'wait' : 'pointer',
            }}
          >
            Otra dirección
          </button>
        </>
      )}

      {aviso && (
        <div role="alert" style={{ fontSize: '13px', fontWeight: 700, lineHeight: '17px', color: 'var(--cp-rust)' }}>
          {aviso}
        </div>
      )}
    </div>
  );
}

import { useId, useMemo, useState } from 'react';
import type { DireccionCliente } from './tipos';
import { MapaUbicacion } from '../comun/mapa/MapaUbicacion';
import { TarjetasFormaUbicacion, type FormaUbicacion } from './FormasUbicacion';

interface SelectorDireccionesClienteProps {
  /** null mientras carga la libreta */
  direcciones: DireccionCliente[] | null;
  ocupado: boolean;
  aviso: string | null;
  alElegir: (direccion: DireccionCliente) => void;
  /** GPS, mapa o escribir: pasa al detalle de esa forma */
  alForma: (forma: FormaUbicacion) => void;
}

const textoUsos = (usos: number) => (usos === 1 ? 'usada 1 vez' : `usada ${usos} veces`);

const fechaCorta = (iso: string): string | null => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }).replace(/\.$/, '');
};

/** Más usada primero; empate: la más reciente primero. */
const ordenarPorUso = (lista: DireccionCliente[]): DireccionCliente[] =>
  [...lista].sort(
    (a, b) =>
      Number(b.usos) - Number(a.usos) ||
      (Date.parse(b.ultimoUsoEn) || 0) - (Date.parse(a.ultimoUsoEn) || 0),
  );

/** Línea «Ubicación guardada · 5 nov · usada 2 veces» (cada dato en su propio elemento). */
function MetaUbicacion({ d }: { d: DireccionCliente }) {
  const fecha = fechaCorta(d.ultimoUsoEn);
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '12px', color: 'var(--cp-soft)' }}>
      <span>{fecha ? `Ubicación guardada · ${fecha}` : 'Ubicación guardada'}</span>
      <span aria-hidden="true">·</span>
      <span>{textoUsos(Number(d.usos))}</span>
    </span>
  );
}

/** Pregunta «¿Dónde te lo llevamos?»: la ubicación más usada destacada, el historial plegado y las acciones de siempre. */
export function SelectorDireccionesCliente({
  direcciones,
  ocupado,
  aviso,
  alElegir,
  alForma,
}: SelectorDireccionesClienteProps) {
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const idHistorial = useId();
  const ordenadas = useMemo(() => (direcciones ? ordenarPorUso(direcciones) : []), [direcciones]);
  const [habitual, ...anteriores] = ordenadas;

  return (
    <div
      style={{
        backgroundColor: 'var(--cp-white)',
        padding: '16px',
        borderRadius: '14px',
        border: '1px solid var(--cp-line)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: '14px', color: 'var(--cp-navy)' }}>¿Dónde te lo llevamos?</div>

      {direcciones === null ? (
        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>Buscando tus direcciones...</div>
      ) : (
        <>
          {habitual && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => alElegir(habitual)}
              style={{
                textAlign: 'left',
                padding: '12px',
                borderRadius: '14px',
                border: '2px solid var(--cp-navy)',
                backgroundColor: 'var(--cp-cream)',
                color: 'var(--cp-navy)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                cursor: ocupado ? 'wait' : 'pointer',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-rust)' }}>
                {habitual.alias || 'Tu ubicación habitual'}
              </span>
              {habitual.lat != null && habitual.lng != null && (
                <div style={{ width: '100%', pointerEvents: 'none' }} data-testid="mini-mapa-direccion">
                  <MapaUbicacion
                    punto={{ lat: Number(habitual.lat), lng: Number(habitual.lng) }}
                    altura={140}
                    soloLectura
                    ajustarA="punto"
                    etiqueta={`Mapa de ${habitual.direccion}`}
                  />
                </div>
              )}
              <span style={{ fontWeight: 800, fontSize: '15px' }}>{habitual.direccion}</span>
              {habitual.referencia && <span style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>{habitual.referencia}</span>}
              <MetaUbicacion d={habitual} />
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--cp-orange)' }}>Enviar aquí</span>
            </button>
          )}

          {anteriores.length > 0 && (
            <>
              <button
                type="button"
                disabled={ocupado}
                aria-expanded={historialAbierto}
                aria-controls={idHistorial}
                onClick={() => setHistorialAbierto((v) => !v)}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-line)',
                  backgroundColor: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: ocupado ? 'wait' : 'pointer',
                }}
              >
                {`Ver historial de ubicaciones anteriores (${anteriores.length})`}
              </button>

              {historialAbierto && (
                <div
                  id={idHistorial}
                  role="group"
                  aria-label="Ubicaciones anteriores"
                  style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '2px' }}
                >
                  {anteriores.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      disabled={ocupado}
                      onClick={() => alElegir(d)}
                      style={{
                        minHeight: '56px',
                        textAlign: 'left',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        border: '1.5px solid var(--cp-line)',
                        backgroundColor: 'var(--cp-cream)',
                        color: 'var(--cp-navy)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: ocupado ? 'wait' : 'pointer',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                        <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
                        <circle cx="12" cy="9.5" r="2.5" />
                      </svg>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 800, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.direccion}</span>
                        <MetaUbicacion d={d} />
                      </span>
                      <span aria-hidden="true" style={{ width: '18px', height: '18px', borderRadius: '9px', border: '2px solid var(--cp-navy)', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <TarjetasFormaUbicacion deshabilitado={ocupado} alElegir={alForma} />
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

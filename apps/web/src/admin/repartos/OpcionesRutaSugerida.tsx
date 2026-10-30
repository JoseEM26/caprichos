import { useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { ErrorApi } from '../../comun/api';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { PALETA_RUTAS_SUGERIDAS } from './calculoRuta';
import { OpcionRutaSugerida, RespuestaRutasSugeridas, repartosApi } from './repartosApi';

export const colorOpcion = (i: number) => PALETA_RUTAS_SUGERIDAS[i % PALETA_RUTAS_SUGERIDAS.length].color;

export interface OpcionesRutaSugeridaProps {
  datos: RespuestaRutasSugeridas | null;
  cargando: boolean;
  error: string | null;
  alReintentar: () => void;
  seleccionadaId: string | null;
  alSeleccionar: (id: string | null) => void;
  /** Se llama tras tomar la ruta o tras un 409 (para recargar). */
  alCambiar: () => void;
  /** Caja/Admin: repartidor al que se asigna. El repartidor no lo pasa: se asigna a sí mismo. */
  repartidorDestinoId?: string;
  puedeTomar?: boolean;
  /** Se llama solo cuando la ruta quedó tomada. */
  alTomada?: () => void;
}

function Flecha({ rumbo, color }: { rumbo: number; color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" style={{ transform: `rotate(${rumbo}deg)`, flex: 'none' }}>
      <path d="M14 3 L22 22 L14 17 L6 22 Z" fill={color} />
    </svg>
  );
}

export function OpcionesRutaSugerida({
  datos, cargando, error, alReintentar, seleccionadaId, alSeleccionar, alCambiar,
  repartidorDestinoId, puedeTomar = true, alTomada,
}: OpcionesRutaSugeridaProps) {
  const [porTomar, setPorTomar] = useState<OpcionRutaSugerida | null>(null);
  const [tomando, setTomando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const avisar = setAviso;

  const tomar = async () => {
    if (!porTomar || tomando) return;
    setTomando(true);
    try {
      await repartosApi.tomarRutaSugerida(porTomar, repartidorDestinoId);
      avisar('Ruta tomada: ya está en Mi ruta');
      alTomada?.();
      alSeleccionar(null);
    } catch (err: any) {
      if (err instanceof ErrorApi && err.codigo === 'RUTA_YA_TOMADA') {
        avisar('Otro repartidor tomó parte de esta ruta; actualizamos las opciones');
        alSeleccionar(null);
      } else if (err instanceof ErrorApi) {
        avisar(err.message || 'No se pudo tomar la ruta');
      } else {
        avisar('No se pudo tomar la ruta');
      }
    } finally {
      setTomando(false);
      setPorTomar(null);
      alCambiar();
    }
  };

  let cuerpo;
  if (cargando && !datos) {
    cuerpo = <Cargando mensaje="Calculando rutas sugeridas..." />;
  } else if (error && !datos) {
    cuerpo = <EstadoError mensaje={error} alReintentar={alReintentar} />;
  } else if (!datos || datos.opciones.length === 0) {
    cuerpo = (
      <p data-testid="rutas-vacio" style={{ margin: 0, color: 'var(--cp-soft, #5A6E78)', fontSize: 14 }}>
        {datos && datos.cupo <= 0 && datos.sinUbicacion.length === 0
          ? 'Ya llevas el máximo de pedidos: entrega alguno antes de tomar otra ruta'
          : 'No hay pedidos listos para repartir'}
      </p>
    );
  } else {
    cuerpo = (
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {datos.opciones.map((o, i) => {
          const color = colorOpcion(i);
          const activa = o.id === seleccionadaId;
          return (
            <article
              key={o.id}
              data-testid={`opcion-ruta-${o.id}`}
              aria-pressed={activa}
              onClick={() => alSeleccionar(activa ? null : o.id)}
              style={{
                border: activa ? `2.5px solid ${color}` : '1.5px solid var(--cp-line, #E3D6C6)',
                borderRadius: 14, padding: 12, background: 'var(--cp-white, #fff)', cursor: 'pointer',
                opacity: seleccionadaId && !activa ? 0.6 : 1, display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Flecha rumbo={o.rumbo} color={color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}>Ruta hacia el {o.sector.toLowerCase()}</div>
                  <div style={{ fontSize: 13, color: 'var(--cp-soft, #5A6E78)' }}>
                    <strong>{o.pedidos.length} {o.pedidos.length === 1 ? 'pedido' : 'pedidos'}</strong> · {o.tiempoMin} min · {o.distanciaKm} km
                  </div>
                </div>
                {o.urgente && (
                  <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 8px', borderRadius: 8, background: '#B91C1C', color: '#fff' }}>
                    Urgente
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--cp-navy, #0B2C3E)' }}>{o.razon}</div>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                {o.pedidos.map((p) => (
                  <li key={p.id}>
                    {p.codigo} · {p.cliente}
                    <span style={{ color: p.retrasoMin > 0 ? '#B91C1C' : 'var(--cp-soft, #5A6E78)' }}>
                      {' '}· llega en {p.llegadaMin} min{p.retrasoMin > 0 ? ` (${p.retrasoMin} min tarde)` : ''}
                    </span>
                  </li>
                ))}
              </ol>
              {puedeTomar && (
                <button
                  type="button"
                  disabled={tomando}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPorTomar(o);
                  }}
                  style={{
                    minHeight: 44, borderRadius: 12, border: 'none', background: color, color: '#fff',
                    fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Tomar esta ruta
                </button>
              )}
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <section aria-label="Rutas sugeridas" data-testid="opciones-ruta-sugerida" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}>
        Rutas sugeridas (elige una y es tuya)
      </h3>
      {aviso && (
        <div role="status" data-testid="aviso-rutas" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-navy, #0B2C3E)' }}>
          {aviso}
        </div>
      )}
      {datos && datos.sinUbicacion.length > 0 && (
        <div data-testid="rutas-sin-ubicacion" style={{ fontSize: 13, color: 'var(--cp-soft, #5A6E78)' }}>
          Sin ubicación (Caja debe ubicarlos): {datos.sinUbicacion.map((s) => s.codigo).join(', ')}
        </div>
      )}
      {cuerpo}
      <Confirmar
        abierto={!!porTomar}
        titulo="¿Tomar esta ruta?"
        mensaje={porTomar ? `Quedarán asignados ${porTomar.pedidos.length} pedidos y nadie más podrá tomarlos:` : ''}
        textoSi="Sí, tomar la ruta"
        textoNo="No"
        cargando={tomando}
        alConfirmar={tomar}
        alCancelar={() => setPorTomar(null)}
      >
        {porTomar && (
          <ul data-testid="confirmar-pedidos-ruta" style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
            {porTomar.pedidos.map((p) => (
              <li key={p.id}>{p.codigo} · {p.cliente}</li>
            ))}
          </ul>
        )}
      </Confirmar>
    </section>
  );
}

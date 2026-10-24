import {
  PedidoParaRuta,
  ParadaRuta,
  RutaCalculada,
  clasificarEspera,
  ConfigReparto,
} from './calculoRuta';

export interface PanelRutaSugeridaProps {
  ruta: RutaCalculada;
  pedidosCandidatos: PedidoParaRuta[];
  paradasSeleccionadasIds: string[];
  onAlternarSeleccionParada: (id: string) => void;
  onMoverParada: (origenIdx: number, destinoIdx: number) => void;
  config?: Partial<ConfigReparto>;
  maxParadas?: number;
  alIniciarRuta?: () => void;
}

export function PanelRutaSugerida({
  ruta,
  pedidosCandidatos,
  paradasSeleccionadasIds,
  onAlternarSeleccionParada,
  onMoverParada,
  config = {},
  maxParadas = 3,
  alIniciarRuta,
}: PanelRutaSugeridaProps) {
  const limite = maxParadas ?? config.maxPedidosPorRepartidor ?? 3;

  const iniciarGoogleMaps = () => {
    if (ruta.urlGoogleMaps) {
      alIniciarRuta?.();
      window.open(ruta.urlGoogleMaps, '_blank', 'noopener,noreferrer');
    }
  };

  const iniciarWaze = () => {
    if (ruta.urlWazePrimeraParada) {
      alIniciarRuta?.();
      window.open(ruta.urlWazePrimeraParada, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      role="region"
      aria-label="Ruta sugerida de entrega"
      style={{
        background: 'var(--cp-white, #FFFFFF)',
        border: '1.5px solid var(--cp-line, #E3D6C6)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: '0 4px 16px rgba(11, 44, 62, 0.08)',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {/* Cabecera con resumen numérico (Decisión 4) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '17px',
              lineHeight: '22px',
              color: 'var(--cp-navy, #0B2C3E)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>Ruta sugerida</span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                borderRadius: '9999px',
                padding: '2px 8px',
                background: 'var(--cp-cream, #FFFDF8)',
                border: '1px solid var(--cp-navy, #0B2C3E)',
                color: 'var(--cp-navy, #0B2C3E)',
              }}
            >
              {ruta.totalParadas} de {limite} paradas
            </span>
          </div>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--cp-soft, #5A6E78)',
              marginTop: '2px',
            }}
          >
            {ruta.distanciaAproxKm > 0 ? (
              <>
                <strong>{ruta.distanciaAproxKm} km</strong> aprox ·{' '}
                <strong>~{ruta.tiempoAproxMin} min</strong> de viaje (a {config.velocidadMediaKmH ?? 20} km/h)
              </>
            ) : (
              'Elige los pedidos para calcular la ruta'
            )}
          </div>
        </div>

        {/* Botón principal «Iniciar ruta» */}
        {ruta.totalParadas > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={iniciarGoogleMaps}
              style={{
                minHeight: '48px',
                padding: '0 18px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--cp-orange, #E67929)',
                color: 'var(--cp-navy, #0B2C3E)',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 3px 8px rgba(230, 121, 41, 0.35)',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              <span>Iniciar ruta</span>
            </button>

            {ruta.totalParadas === 1 && ruta.urlWazePrimeraParada && (
              <button
                type="button"
                onClick={iniciarWaze}
                style={{
                  minHeight: '48px',
                  padding: '0 14px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  background: 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Waze
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lista interactiva de paradas numeradas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {ruta.paradas.map((parada: ParadaRuta, idx: number) => {
          const infoEspera = clasificarEspera(parada.minutosEspera, config);
          const esPrimero = idx === 0;
          const esUltimo = idx === ruta.paradas.length - 1;

          return (
            <div
              key={parada.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'var(--cp-cream, #FFFDF8)',
                border: '1px solid var(--cp-line, #E3D6C6)',
                borderRadius: '12px',
                gap: '8px',
              }}
            >
              {/* Checkbox y número de orden */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <input
                  type="checkbox"
                  id={`check-parada-${parada.id}`}
                  checked={paradasSeleccionadasIds.includes(parada.id)}
                  onChange={() => onAlternarSeleccionParada(parada.id)}
                  aria-label={`Incluir pedido ${parada.codigo} en la ruta`}
                  style={{
                    width: '20px',
                    height: '20px',
                    accentColor: 'var(--cp-orange, #E67929)',
                    cursor: 'pointer',
                  }}
                />

                <span
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: infoEspera.colorHex,
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '13px',
                    flex: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                  }}
                >
                  {parada.orden}
                </span>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy, #0B2C3E)' }}>
                      {parada.codigo}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy, #0B2C3E)' }}>
                      · {parada.cliente_nombre}
                    </span>
                    {parada.estado === 'EN_CAMINO' && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '6px',
                          background: '#E1EFFE',
                          color: '#1E429F',
                        }}
                      >
                        En camino
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--cp-soft, #5A6E78)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {parada.direccion || 'Sin dirección'}
                    {parada.zona ? ` · Zona ${parada.zona}` : ''}
                    {' · espera '}
                    <strong style={{ color: infoEspera.colorHex }}>
                      {parada.minutosEspera} min ({infoEspera.label})
                    </strong>
                  </div>
                </div>
              </div>

              {/* Botones de reordenamiento (Subir / Bajar) */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 'none' }}>
                <button
                  type="button"
                  disabled={esPrimero}
                  onClick={() => onMoverParada(idx, idx - 1)}
                  aria-label={`Mover parada ${parada.codigo} arriba`}
                  title="Mover arriba"
                  style={{
                    width: '34px',
                    height: '34px',
                    border: '1px solid var(--cp-line, #E3D6C6)',
                    borderRadius: '8px',
                    background: esPrimero ? 'transparent' : 'var(--cp-white, #FFFFFF)',
                    color: esPrimero ? '#BBB' : 'var(--cp-navy, #0B2C3E)',
                    cursor: esPrimero ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 800,
                  }}
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={esUltimo}
                  onClick={() => onMoverParada(idx, idx + 1)}
                  aria-label={`Mover parada ${parada.codigo} abajo`}
                  title="Mover abajo"
                  style={{
                    width: '34px',
                    height: '34px',
                    border: '1px solid var(--cp-line, #E3D6C6)',
                    borderRadius: '8px',
                    background: esUltimo ? 'transparent' : 'var(--cp-white, #FFFFFF)',
                    color: esUltimo ? '#BBB' : 'var(--cp-navy, #0B2C3E)',
                    cursor: esUltimo ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 800,
                  }}
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Candidatos restantes no seleccionados pero que se pueden sumar a la ruta */}
      {pedidosCandidatos.filter((p) => !paradasSeleccionadasIds.includes(p.id)).length > 0 && (
        <details style={{ fontSize: '13px', color: 'var(--cp-soft, #5A6E78)', marginTop: '4px' }}>
          <summary
            style={{
              cursor: 'pointer',
              fontWeight: 700,
              minHeight: '36px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Sumar más pedidos disponibles o en camino ({pedidosCandidatos.filter((p) => !paradasSeleccionadasIds.includes(p.id)).length} adicionales)
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '6px' }}>
            {pedidosCandidatos
              .filter((p) => !paradasSeleccionadasIds.includes(p.id))
              .map((p) => {
                const info = clasificarEspera(p.minutosEspera, config);
                const disabled = paradasSeleccionadasIds.length >= limite;
                return (
                  <label
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--cp-cream, #FFFDF8)',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.6 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={false}
                      onChange={() => onAlternarSeleccionParada(p.id)}
                      style={{
                        width: '18px',
                        height: '18px',
                        accentColor: 'var(--cp-orange, #E67929)',
                      }}
                    />
                    <span style={{ fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}>
                      {p.codigo}
                    </span>
                    <span>· {p.cliente_nombre}</span>
                    <span style={{ color: info.colorHex, fontWeight: 700 }}>
                      ({p.minutosEspera} min)
                    </span>
                    {p.estado === 'EN_CAMINO' && (
                      <span style={{ fontSize: '11px', color: '#1E429F', fontWeight: 700 }}>
                        [En camino]
                      </span>
                    )}
                  </label>
                );
              })}
          </div>
        </details>
      )}
    </div>
  );
}

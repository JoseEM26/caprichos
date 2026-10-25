import { useState } from 'react';
import {
  PedidoParaRuta,
  ParadaRuta,
  RutaCalculada,
  clasificarEspera,
  ConfigReparto,
} from './calculoRuta';
import { PedidoPerdido } from './repartosApi';
import { Confirmar } from '../../comun/Confirmar';

export interface PanelRutaSugeridaProps {
  ruta: RutaCalculada;
  pedidosCandidatos: PedidoParaRuta[];
  paradasSeleccionadasIds: string[];
  onAlternarSeleccionParada: (id: string) => void;
  onMoverParada: (origenIdx: number, destinoIdx: number) => void;
  config?: Partial<ConfigReparto>;
  maxParadas?: number;
  alIniciarRuta?: (ids?: string[]) => Promise<void> | void;
  avisosPerdidos?: PedidoPerdido[];
  onCerrarAvisoPerdido?: (pedidoId: string) => void;
  cargandoInicio?: boolean;
}

export function PanelRutaSugerida({
  ruta,
  pedidosCandidatos = [],
  paradasSeleccionadasIds = [],
  onAlternarSeleccionParada,
  onMoverParada,
  config = {},
  maxParadas = 3,
  alIniciarRuta,
  avisosPerdidos = [],
  onCerrarAvisoPerdido,
  cargandoInicio = false,
}: PanelRutaSugeridaProps) {
  const limite = maxParadas ?? config.maxPedidosPorRepartidor ?? 3;
  const [mostrarConfirmarInicio, setMostrarConfirmarInicio] = useState(false);
  const [menuNavegacion, setMenuNavegacion] = useState(false);

  const abrirNavegador = (url?: string) => {
    if (!url) return;
    setMenuNavegacion(false);
    if (url.startsWith('geo:')) {
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const esAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  const esIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  const opcionesNavegacion = [
    {
      id: 'google',
      titulo: 'Google Maps',
      detalle: ruta.totalParadas > 1 ? `Ruta completa con las ${ruta.totalParadas} paradas` : 'Ruta hasta el cliente',
      url: ruta.urlGoogleMaps,
    },
    {
      id: 'waze',
      titulo: 'Waze',
      detalle: ruta.totalParadas > 1 ? 'Va a la parada 1; al entregar, abre la siguiente' : 'Ruta hasta el cliente',
      url: ruta.urlWazePrimeraParada,
    },
    ...(esIOS
      ? [
          {
            id: 'apple',
            titulo: 'Apple Maps',
            detalle: ruta.totalParadas > 1 ? 'Va a la parada 1' : 'Ruta hasta el cliente',
            url: ruta.urlAppleMapsPrimeraParada,
          },
        ]
      : []),
    ...(esAndroid
      ? [
          {
            id: 'otra',
            titulo: 'Otra aplicación',
            detalle: 'Elige entre las apps de mapas de tu celular',
            url: ruta.urlGeoPrimeraParada,
          },
        ]
      : []),
  ];

  // Identificar pedidos seleccionados para el mensaje de confirmación
  const mapaCandidatos = new Map(pedidosCandidatos.map((p) => [p.id, p]));
  const pedidosSeleccionados = paradasSeleccionadasIds
    .map((id) => mapaCandidatos.get(id))
    .filter(Boolean) as PedidoParaRuta[];
  const codigosSeleccionados = pedidosSeleccionados.map((p) => p.codigo).join(', ');

  const handleConfirmarInicioRuta = async () => {
    setMostrarConfirmarInicio(false);
    if (alIniciarRuta) {
      await alIniciarRuta(paradasSeleccionadasIds);
    }
  };

  // Consolidar candidatos: primero los seleccionados en el orden de la ruta, luego los no seleccionados
  const noSeleccionados = pedidosCandidatos.filter(
    (c) => !paradasSeleccionadasIds.includes(c.id),
  );

  return (
    <>
      <div
        role="region"
        aria-label="Ruta sugerida de entrega"
        data-testid="panel-ruta-sugerida"
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
        {/* Avisos de pedidos perdidos al iniciar ruta */}
        {avisosPerdidos.length > 0 && (
          <div
            role="alert"
            data-testid="banner-pedidos-perdidos"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {avisosPerdidos.map((p) => {
              let mensaje = `El pedido ${p.codigo} ya no está disponible`;
              if (p.motivo === 'OTRO_REPARTIDOR') {
                mensaje = `El pedido ${p.codigo} ya lo tomó ${p.tomadoPor || 'otro repartidor'}`;
              } else if (p.motivo === 'LIMITE') {
                mensaje = `El pedido ${p.codigo} superó el límite máximo de pedidos permitidos`;
              } else if (p.motivo === 'ANULADO') {
                mensaje = `El pedido ${p.codigo} fue anulado o devuelto a cocina`;
              }

              return (
                <div
                  key={p.pedidoId}
                  data-testid={`aviso-perdido-${p.pedidoId}`}
                  style={{
                    background: '#FEE2E2',
                    border: '1.5px solid var(--cp-rust, #C4412B)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    color: '#991B1B',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  <span>{mensaje}</span>
                  {onCerrarAvisoPerdido && (
                    <button
                      type="button"
                      onClick={() => onCerrarAvisoPerdido(p.pedidoId)}
                      aria-label={`Descartar aviso para ${p.codigo}`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#991B1B',
                        fontSize: '16px',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontWeight: 800,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Cabecera con resumen numérico */}
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
                {paradasSeleccionadasIds.length} de {limite} paradas elegidas
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
                'Marca las casillas para elegir los pedidos de la ruta'
              )}
            </div>
          </div>

          {/* Botones «Iniciar ruta» y selector de navegador */}
          {paradasSeleccionadasIds.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                data-testid="btn-iniciar-ruta"
                disabled={cargandoInicio}
                onClick={() => setMostrarConfirmarInicio(true)}
                style={{
                  minHeight: '48px',
                  padding: '0 18px',
                  borderRadius: '12px',
                  border: 'none',
                  background: cargandoInicio ? '#CCCCCC' : 'var(--cp-orange, #E67929)',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: cargandoInicio ? 'not-allowed' : 'pointer',
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
                <span>{cargandoInicio ? 'Iniciando...' : 'Iniciar ruta'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMenuNavegacion((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuNavegacion}
                title="Abrir mapa externo (Google Maps / Waze)"
                style={{
                  minHeight: '48px',
                  minWidth: '48px',
                  padding: '0 12px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  background: 'var(--cp-white, #FFFFFF)',
                  color: 'var(--cp-navy, #0B2C3E)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                </svg>
              </button>

              {menuNavegacion && (
                <div
                  role="menu"
                  aria-label="Elegir aplicación de navegación"
                  style={{
                    flexBasis: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: '4px',
                  }}
                >
                  {opcionesNavegacion.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="menuitem"
                      onClick={() => abrirNavegador(o.url)}
                      style={{
                        minHeight: '48px',
                        padding: '8px 14px',
                        borderRadius: '12px',
                        border: '1.5px solid var(--cp-line, #E3D6C6)',
                        background: 'var(--cp-cream, #FFFDF8)',
                        color: 'var(--cp-navy, #0B2C3E)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      <strong style={{ fontSize: '13px' }}>{o.titulo}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--cp-soft, #5A6E78)' }}>{o.detalle}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lista de paradas seleccionadas y candidatas con casillas de verificación */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* 1. Paradas activas ordenadas de la ruta */}
          {ruta.paradas.map((parada: ParadaRuta, idx: number) => {
            const infoEspera = clasificarEspera(parada.minutosEspera, config);
            const esPrimero = idx === 0;
            const esUltimo = idx === ruta.paradas.length - 1;
            const estaMarcada = paradasSeleccionadasIds.includes(parada.id);

            return (
              <div
                key={parada.id}
                data-testid={`parada-fila-${parada.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--cp-cream, #FFFDF8)',
                  border: '1.5px solid var(--cp-line, #E3D6C6)',
                  borderRadius: '12px',
                  gap: '8px',
                }}
              >
                {/* Casilla de selección y número correlativo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <input
                    type="checkbox"
                    id={`check-parada-${parada.id}`}
                    data-testid={`check-parada-${parada.id}`}
                    checked={estaMarcada}
                    onChange={() => onAlternarSeleccionParada(parada.id)}
                    aria-label={`Incluir pedido ${parada.codigo} en la ruta`}
                    style={{
                      width: '22px',
                      height: '22px',
                      accentColor: 'var(--cp-orange, #E67929)',
                      cursor: 'pointer',
                      flex: 'none',
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

                  <div style={{ minWidth: 0, flex: 1 }}>
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
                        marginTop: '2px',
                      }}
                    >
                      <span>espera </span>
                      <strong style={{ color: infoEspera.colorHex }}>
                        {parada.minutosEspera} min ({infoEspera.label})
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Botones de reordenamiento */}
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

          {/* 2. Candidatos adicionales del sector no seleccionados */}
          {noSeleccionados.map((candidato) => {
            const info = clasificarEspera(candidato.minutosEspera, config);
            const yaLlegoAlLimite = paradasSeleccionadasIds.length >= limite;

            return (
              <div
                key={candidato.id}
                data-testid={`candidato-fila-${candidato.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: 'var(--cp-white, #FFFFFF)',
                  border: '1px dashed var(--cp-line, #E3D6C6)',
                  gap: '10px',
                  opacity: yaLlegoAlLimite ? 0.6 : 1,
                }}
              >
                <input
                  type="checkbox"
                  id={`check-parada-${candidato.id}`}
                  data-testid={`check-parada-${candidato.id}`}
                  checked={false}
                  disabled={yaLlegoAlLimite}
                  onChange={() => onAlternarSeleccionParada(candidato.id)}
                  aria-label={`Incluir pedido ${candidato.codigo} en la ruta`}
                  title={
                    yaLlegoAlLimite
                      ? `Llegaste al límite de ${limite} pedidos simultáneos`
                      : `Agregar ${candidato.codigo}`
                  }
                  style={{
                    width: '22px',
                    height: '22px',
                    accentColor: 'var(--cp-orange, #E67929)',
                    cursor: yaLlegoAlLimite ? 'not-allowed' : 'pointer',
                    flex: 'none',
                  }}
                />

                <span
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#CCCCCC',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '13px',
                    flex: 'none',
                  }}
                >
                  —
                </span>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy, #0B2C3E)' }}>
                      {candidato.codigo}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy, #0B2C3E)' }}>
                      · {candidato.cliente_nombre}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--cp-soft, #5A6E78)', marginTop: '2px' }}>
                    <span>espera </span>
                    <strong style={{ color: info.colorHex }}>
                      {candidato.minutosEspera} min ({info.label})
                    </strong>
                    {yaLlegoAlLimite && (
                      <span style={{ marginLeft: '6px', color: 'var(--cp-rust, #C4412B)', fontWeight: 700 }}>
                        (límite alcanzado)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Diálogo de Confirmación para «Iniciar ruta» */}
      <Confirmar
        abierto={mostrarConfirmarInicio}
        titulo="¿Iniciar ruta de reparto?"
        mensaje={`Vas a llevar estos ${paradasSeleccionadasIds.length} pedidos: ${codigosSeleccionados}. Los pedidos pasarán a EN CAMINO y se registrará tu hora de salida.`}
        alConfirmar={handleConfirmarInicioRuta}
        alCancelar={() => setMostrarConfirmarInicio(false)}
        textoConfirmar="Sí, iniciar ruta"
        textoNo="Cancelar"
      />
    </>
  );
}

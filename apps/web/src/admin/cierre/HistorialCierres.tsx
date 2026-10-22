import { useState, useEffect, useCallback, useMemo } from 'react';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { useSesion } from '../../comun/sesion';
import {
  cierreApi,
  ItemHistorialCierre,
  DetalleCierreCompleto,
} from './cierreApi';

export function HistorialCierres() {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN';

  const [cierres, setCierres] = useState<ItemHistorialCierre[]>([]);
  const [total, setTotal] = useState(0);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'cuadrado' | 'sobrante' | 'faltante'>('todos');

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal de detalle estilo ticket térmico 80 mm
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<DetalleCierreCompleto | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [msgTicket, setMsgTicket] = useState('');

  const cargarHistorial = useCallback(async () => {
    setError(null);
    try {
      const res = await cierreApi.obtenerHistorial({
        pagina: 1,
        limite: 50,
        desde: desde || undefined,
        hasta: hasta || undefined,
      });
      setCierres(res.cierres);
      setTotal(res.total);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar el historial de cierres');
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  const abrirDetalle = async (id: number) => {
    setDetalleId(id);
    setCargandoDetalle(true);
    setErrorDetalle(null);
    setMsgTicket('');
    try {
      const res = await cierreApi.obtenerCierrePorId(id);
      setDetalle(res);
    } catch (err: any) {
      setErrorDetalle(err?.message || 'Error al cargar el detalle del cierre');
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cerrarDetalle = () => {
    setDetalleId(null);
    setDetalle(null);
    setErrorDetalle(null);
  };

  const cierresFiltrados = useMemo(() => {
    return cierres.filter((c) => {
      const dif = c.cierre?.medios?.find((m) => m.medio.toLowerCase() === 'efectivo')?.diferencia ?? 0;
      const estado = Math.abs(dif) < 0.005 ? 'cuadrado' : dif > 0 ? 'sobrante' : 'faltante';
      if (filtroEstado !== 'todos' && estado !== filtroEstado) return false;
      return true;
    });
  }, [cierres, filtroEstado]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Tarjeta de filtros del historial */}
      <div
        style={{
          background: 'var(--cp-white, #FFFFFF)',
          border: '1px solid var(--cp-line, #E3D6C6)',
          borderRadius: 14,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
          Todos los cierres quedan guardados. No se pueden editar ni borrar.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label
              htmlFor="cj-f"
              style={{ fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 3 }}
            >
              Desde
            </label>
            <input
              id="cj-f"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              style={{
                minHeight: 44,
                borderRadius: 10,
                border: '1.5px solid var(--cp-line, #E3D6C6)',
                padding: '0 10px',
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label
              htmlFor="cj-t"
              style={{ fontWeight: 700, fontSize: 12, display: 'block', marginBottom: 3 }}
            >
              Hasta
            </label>
            <input
              id="cj-t"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              style={{
                minHeight: 44,
                borderRadius: 10,
                border: '1.5px solid var(--cp-line, #E3D6C6)',
                padding: '0 10px',
                fontSize: 13,
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'todos', n: 'Todos' },
              { id: 'cuadrado', n: 'Cuadrados' },
              { id: 'sobrante', n: 'Sobrantes' },
              { id: 'faltante', n: 'Faltantes' },
            ].map((e) => {
              const activo = filtroEstado === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setFiltroEstado(e.id as any)}
                  style={{
                    minHeight: 44,
                    padding: '0 12px',
                    borderRadius: 9999,
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    background: activo ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                    color: activo ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {e.n}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>
          {cierresFiltrados.length} de {total} cierres
        </div>
      </div>

      {cargando ? (
        <div style={{ padding: '24px 0' }}>
          <Cargando mensaje="Cargando historial..." />
        </div>
      ) : error ? (
        <EstadoError mensaje={error} alReintentar={cargarHistorial} />
      ) : cierresFiltrados.length === 0 ? (
        <div
          style={{
            background: 'var(--cp-white, #FFFFFF)',
            border: '1px solid var(--cp-line, #E3D6C6)',
            borderRadius: 14,
            padding: '14px 16px',
            textAlign: 'center',
            color: 'var(--cp-soft, #2C4C5D)',
          }}
        >
          No hay cierres con esos filtros.
        </div>
      ) : (
        /* Cuadrícula de tarjetas de cierre idéntica al mockup */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          {cierresFiltrados.map((h) => {
            const dif = h.cierre?.medios?.find((m) => m.medio.toLowerCase() === 'efectivo')?.diferencia ?? 0;
            const cuadra = Math.abs(dif) < 0.005;
            const col = cuadra ? 'var(--cp-green, #2F7A45)' : dif > 0 ? 'var(--cp-soft, #2C4C5D)' : 'var(--cp-rust, #B2500F)';
            const estLabel = cuadra ? 'Cuadrado' : dif > 0 ? 'Sobrante' : 'Faltante';
            const difTexto = (dif > 0 ? '+' : '') + `s/ ${Math.abs(dif).toFixed(2)}`;

            const totalVendido = (h.cierre?.medios || []).reduce((acc, m) => acc + (m.visto || m.sistema || 0), 0);
            const fechaStr = new Date(h.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const horaAbre = '14:00';
            const horaCierra = h.cerradaEn ? new Date(h.cerradaEn).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '22:05';

            return (
              <button
                key={h.cajaId}
                type="button"
                onClick={() => abrirDetalle(h.cajaId)}
                style={{
                  textAlign: 'left',
                  background: 'var(--cp-white, #FFFFFF)',
                  border: '1px solid var(--cp-line, #E3D6C6)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy, #0B2C3E)' }}>
                    CZ-{String(h.cajaId).padStart(4, '0')} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cp-soft, #2C4C5D)' }}>· Caja #{h.cajaId}</span>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: col }}>
                    {estLabel} {difTexto}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
                  {fechaStr} · {horaAbre} a {horaCierra}
                </div>
                <div style={{ fontSize: 13, color: 'var(--cp-navy, #0B2C3E)' }}>
                  {h.cerradaPor ? `Usuario #${h.cerradaPor}` : (usuario?.nombres || 'Cajera de turno')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}>
                  <span>Vendido</span>
                  <span>s/ {totalVendido.toFixed(2)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Modal Detalle de Cierre formato Ticket 80 mm */}
      {detalleId && (
        <>
          <div
            onClick={cerrarDetalle}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              background: 'rgba(11,44,62,0.55)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cierre de caja"
            style={{
              position: 'fixed',
              zIndex: 60,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%,-50%)',
              width: 'min(500px, calc(100% - 24px))',
              maxHeight: 'calc(100% - 24px)',
              overflowY: 'auto',
              background: 'var(--cp-cream, #FBF4EC)',
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--cp-navy, #0B2C3E)' }}>
                Detalle del cierre #{detalle ? detalle.cajaId : ''}
              </div>
              <button
                type="button"
                onClick={cerrarDetalle}
                aria-label="Cerrar"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  background: 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontSize: 20,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            {cargandoDetalle ? (
              <div style={{ padding: 24 }}>
                <Cargando mensaje="Cargando ticket..." />
              </div>
            ) : errorDetalle ? (
              <EstadoError mensaje={errorDetalle} />
            ) : detalle ? (
              <>
                <div
                  style={{
                    alignSelf: 'center',
                    width: 'min(100%, 320px)',
                    boxSizing: 'border-box',
                    background: 'var(--cp-white, #FFFFFF)',
                    border: '1px solid var(--cp-line, #E3D6C6)',
                    boxShadow: '0 4px 12px rgba(11,44,62,0.15)',
                    padding: '16px 14px',
                    fontFamily: "'Courier New', monospace",
                    fontSize: 12,
                    lineHeight: '16px',
                    color: '#111',
                  }}
                >
                  <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, letterSpacing: '0.08em' }}>
                    CAPRICHOS
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 700 }}>
                    CIERRE DE CAJA CZ-{String(detalle.cajaId).padStart(4, '0')}
                  </div>
                  <div style={{ textAlign: 'center' }}>------------------------------</div>
                  <div>Fecha: {new Date(detalle.fecha).toLocaleDateString('es-PE')}</div>
                  <div>Abre 14:00 · Cierra {detalle.cerradaEn ? new Date(detalle.cerradaEn).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '22:05'}</div>
                  <div>Cajero: {detalle.cerradaPor ? `Usuario #${detalle.cerradaPor}` : (usuario?.nombres || 'Cajera de turno')}</div>
                  <div>Apertura: s/ {detalle.apertura.toFixed(2)}</div>
                  <div style={{ textAlign: 'center' }}>------------------------------</div>
                  {esAdmin ? (
                    <div data-testid="detalle-medios">
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                        Detalle por medio de pago (solo administrador)
                      </div>
                      <div style={{ fontWeight: 700 }}>VENTAS POR MEDIO</div>
                      {(detalle.medios || []).map((m) => {
                        const dif = m.diferencia !== null ? m.diferencia : m.visto - m.sistema;
                        return (
                          <div key={m.medio} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>{m.medio}</span>
                              <span>s/ {(m.visto || m.sistema || 0).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--cp-soft, #2C4C5D)' }}>
                              <span>Sist. S/ {m.sistema.toFixed(2)}</span>
                              <span>Cont. S/ {m.visto.toFixed(2)}</span>
                              <span style={{ fontWeight: 800, color: Math.abs(dif) < 0.005 ? 'var(--cp-green, #2F7A45)' : 'var(--cp-rust, #B2500F)' }}>
                                {Math.abs(dif) < 0.005 ? 'Cuadra' : dif > 0 ? `+ S/ ${dif.toFixed(2)}` : `- S/ ${Math.abs(dif).toFixed(2)}`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--cp-line, #E3D6C6)', paddingTop: 4 }}>
                        <span>TOTAL VENDIDO</span>
                        <span>s/ {(detalle.medios || []).reduce((acc, m) => acc + (m.visto || m.sistema || 0), 0).toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div
                      data-testid="aviso-detalle-restringido"
                      style={{
                        padding: '6px 8px',
                        background: '#FDE8E8',
                        color: 'var(--cp-rust, #B2500F)',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        textAlign: 'center',
                      }}
                    >
                      El desglose detallado por medio de pago y las diferencias del sistema están reservados para el administrador (cierre ciego).
                    </div>
                  )}
                  <div style={{ textAlign: 'center' }}>------------------------------</div>
                  <div style={{ fontWeight: 700 }}>RESUMEN DE CAJA</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Esperado</span>
                    <span>s/ {((detalle.medios?.find((m) => m.medio.toLowerCase() === 'efectivo')?.sistema) ?? detalle.apertura).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Contado</span>
                    <span>s/ {((detalle.medios?.find((m) => m.medio.toLowerCase() === 'efectivo')?.visto) ?? detalle.apertura).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>{detalle.resultado === 'CUADRA' ? 'Cuadrado' : 'Diferencia'}</span>
                    <span>{detalle.resultado === 'CUADRA' ? '+s/ 0.00' : `${(detalle.medios?.find((m) => m.medio.toLowerCase() === 'efectivo')?.diferencia ?? 0).toFixed(2)}`}</span>
                  </div>
                  {detalle.nota && (
                    <div style={{ marginTop: 6, fontStyle: 'italic' }}>
                      Obs: {detalle.nota}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setMsgTicket('Ticket de cierre enviado a la ticketera (simulado).')}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      borderRadius: 12,
                      background: 'transparent',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Imprimir ticket de cierre
                  </button>
                  <button
                    type="button"
                    onClick={() => setMsgTicket('PDF del cierre listo para descargar (simulado).')}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      borderRadius: 12,
                      background: 'transparent',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Descargar PDF
                  </button>
                </div>
                {msgTicket && (
                  <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)', textAlign: 'center' }}>
                    {msgTicket}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

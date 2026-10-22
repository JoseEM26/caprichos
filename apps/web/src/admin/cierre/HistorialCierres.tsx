import { useState, useEffect, useCallback } from 'react';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { Paginacion } from '../../comun/Paginacion';
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
  const [pagina, setPagina] = useState(1);
  const [limite] = useState(10);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal de detalle
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<DetalleCierreCompleto | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  const cargarHistorial = useCallback(async () => {
    setError(null);
    try {
      const res = await cierreApi.obtenerHistorial({
        pagina,
        limite,
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
  }, [pagina, limite, desde, hasta]);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  const abrirDetalle = async (id: number) => {
    setDetalleId(id);
    setCargandoDetalle(true);
    setErrorDetalle(null);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <h2
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '18px',
            color: 'var(--cp-navy)',
            margin: 0,
          }}
        >
          Historial de cierres inmutables
        </h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--cp-soft)' }}>
          Todos los cierres de caja quedan guardados de forma permanente. No se pueden editar ni borrar.
        </p>
      </div>

      {/* Filtros de fecha */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '12px',
          padding: '12px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: '1 1 140px' }}>
          <label
            htmlFor="hist-desde"
            style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}
          >
            Desde
          </label>
          <input
            id="hist-desde"
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              setPagina(1);
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '44px',
              borderRadius: '8px',
              border: '1px solid var(--cp-line)',
              padding: '0 10px',
              fontSize: '13px',
            }}
          />
        </div>

        <div style={{ flex: '1 1 140px' }}>
          <label
            htmlFor="hist-hasta"
            style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}
          >
            Hasta
          </label>
          <input
            id="hist-hasta"
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              setPagina(1);
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '44px',
              borderRadius: '8px',
              border: '1px solid var(--cp-line)',
              padding: '0 10px',
              fontSize: '13px',
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setPagina(1);
            cargarHistorial();
          }}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '8px',
            background: 'var(--cp-navy)',
            color: 'var(--cp-cream)',
            border: 0,
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Filtrar
        </button>

        {(desde || hasta) && (
          <button
            type="button"
            onClick={() => {
              setDesde('');
              setHasta('');
              setPagina(1);
            }}
            style={{
              minHeight: '44px',
              padding: '0 14px',
              borderRadius: '8px',
              border: '1px solid var(--cp-line)',
              background: 'transparent',
              color: 'var(--cp-soft)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Limpiar fechas
          </button>
        )}
      </div>

      {cargando ? (
        <div style={{ padding: '30px 0' }}>
          <Cargando mensaje="Cargando historial de cierres..." />
        </div>
      ) : error ? (
        <EstadoError mensaje={error} alReintentar={cargarHistorial} />
      ) : cierres.length === 0 ? (
        <EstadoVacio
          titulo="Sin cierres registrados"
          mensaje="No se encontraron cierres de caja para los filtros seleccionados."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {cierres.map((c) => {
              const res = c.cierre?.resultado;
              const cuadra = res === 'CUADRA';
              return (
                <button
                  key={c.cajaId}
                  type="button"
                  onClick={() => abrirDetalle(c.cajaId)}
                  style={{
                    textAlign: 'left',
                    background: 'var(--cp-white)',
                    border: '1px solid var(--cp-line)',
                    borderLeft: `5px solid ${cuadra ? 'var(--cp-green)' : 'var(--cp-rust)'}`,
                    borderRadius: '14px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    cursor: 'pointer',
                    minHeight: '44px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: '16px',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      Caja #{c.cajaId}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        borderRadius: '9999px',
                        padding: '2px 8px',
                        background: cuadra ? 'var(--cp-greenbg, #DEF7EC)' : '#FDE8E8',
                        color: cuadra ? '#1F5C33' : 'var(--cp-rust)',
                      }}
                    >
                      {res || 'CERRADA'}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Fecha: {new Date(c.fecha).toLocaleDateString('es-PE')}
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>
                    Apertura: S/ {Number(c.apertura).toFixed(2)}
                  </div>

                  {c.cerradaEn && (
                    <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
                      Cerrada: {new Date(c.cerradaEn).toLocaleTimeString('es-PE')}
                    </div>
                  )}

                  {c.cierre?.nota && (
                    <div style={{ fontSize: '12px', color: 'var(--cp-rust)', fontStyle: 'italic', marginTop: '4px' }}>
                      Nota: {c.cierre.nota}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {total > limite && (
            <div style={{ marginTop: '10px' }}>
              <Paginacion
                paginaActual={pagina}
                totalPaginas={Math.ceil(total / limite)}
                totalRegistros={total}
                tamanoPagina={limite}
                alCambiarPagina={(nueva) => setPagina(nueva)}
              />
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalle de Cierre */}
      {detalleId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-detalle-cierre"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(11, 44, 62, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) cerrarDetalle();
          }}
        >
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '20px',
              boxShadow: '0 20px 40px rgba(11, 44, 62, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3
                  id="titulo-detalle-cierre"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '18px',
                    color: 'var(--cp-navy)',
                    margin: 0,
                  }}
                >
                  Detalle del cierre #{detalleId}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--cp-soft)' }}>
                  Inmutable: no se edita ni se elimina
                </p>
              </div>

              <button
                type="button"
                onClick={cerrarDetalle}
                aria-label="Cerrar detalle"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '22px',
                  border: '1px solid var(--cp-line)',
                  background: 'transparent',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                x
              </button>
            </div>

            {cargandoDetalle ? (
              <div style={{ padding: '20px 0' }}>
                <Cargando mensaje="Cargando detalle..." />
              </div>
            ) : errorDetalle ? (
              <EstadoError mensaje={errorDetalle} />
            ) : detalle ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Resumen general */}
                <div
                  style={{
                    background: 'var(--cp-cream)',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Fecha de caja:</span>
                    <b>{new Date(detalle.fecha).toLocaleDateString('es-PE')}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Apertura inicial:</span>
                    <b>S/ {detalle.apertura.toFixed(2)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Resultado:</span>
                    <b style={{ color: detalle.resultado === 'CUADRA' ? 'var(--cp-green)' : 'var(--cp-rust)' }}>
                      {detalle.resultado}
                    </b>
                  </div>
                  {detalle.cerradaEn && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Fecha y hora de cierre:</span>
                      <span>{new Date(detalle.cerradaEn).toLocaleString('es-PE')}</span>
                    </div>
                  )}
                  {detalle.nota && (
                    <div style={{ marginTop: '4px', borderTop: '1px solid var(--cp-line)', paddingTop: '4px' }}>
                      <span>Nota: </span>
                      <b>{detalle.nota}</b>
                    </div>
                  )}
                </div>

                {/* Detalle por medio de pago: VISIBLE SOLO PARA ADMIN */}
                {esAdmin ? (
                  <div
                    data-testid="detalle-medios"
                    style={{
                      border: '1px solid var(--cp-line)',
                      borderRadius: '10px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--cp-navy)' }}>
                      Detalle por medio de pago (solo administrador)
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {detalle.medios?.map((m) => {
                        const dif = m.diferencia !== null ? m.diferencia : m.visto - m.sistema;
                        return (
                          <div
                            key={m.medio}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '100px 1fr 1fr 1fr',
                              gap: '6px',
                              fontSize: '12px',
                              padding: '4px 0',
                              borderBottom: '1px solid var(--cp-sand, #F3E9DB)',
                              alignItems: 'center',
                            }}
                          >
                            <b>{m.medio}</b>
                            <span>Sist. S/ {m.sistema.toFixed(2)}</span>
                            <span>Cont. S/ {m.visto.toFixed(2)}</span>
                            <span
                              style={{
                                fontWeight: 800,
                                color: Math.abs(dif) < 0.005 ? 'var(--cp-green)' : 'var(--cp-rust)',
                              }}
                            >
                              {Math.abs(dif) < 0.005 ? 'Cuadra' : dif > 0 ? `+ S/ ${dif.toFixed(2)}` : `- S/ ${Math.abs(dif).toFixed(2)}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div
                    data-testid="aviso-detalle-restringido"
                    style={{
                      background: 'var(--cp-cream)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      fontSize: '12px',
                      color: 'var(--cp-soft)',
                      fontStyle: 'italic',
                      textAlign: 'center',
                    }}
                  >
                    El desglose detallado por medio de pago y las diferencias del sistema están reservados para el administrador (cierre ciego).
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

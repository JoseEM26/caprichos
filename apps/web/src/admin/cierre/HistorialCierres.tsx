import { useState, useEffect, useCallback, useMemo } from 'react';
import { Cargando } from '../../comun/Cargando';
import { ListaCorrecciones } from './CorreccionesMedios';
import { EstadoError } from '../../comun/EstadoError';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';
import { Paginacion } from '../../comun/Paginacion';
import { useSesion } from '../../comun/sesion';
import {
  cierreApi,
  ItemHistorialCierre,
  DetalleCierreCompleto,
} from './cierreApi';

// Las fechas de caja son de día (DATE, medianoche UTC): se muestran tal cual, sin cambio de zona.
const fechaDeCaja = (fecha: string) =>
  new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

const horaDeCierre = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });

// Estado del cierre según el efectivo; si el efectivo cuadra pero el arqueo no, es «No cuadra»
const estadoCierre = (c: ItemHistorialCierre) => {
  const dif = c.cierre?.medios?.find((m) => m.medio.toLowerCase() === 'efectivo')?.diferencia ?? 0;
  if (Math.abs(dif) >= 0.005) return dif > 0 ? 'sobrante' : 'faltante';
  return c.cierre?.resultado === 'NO_CUADRA' ? 'otros' : 'cuadrado';
};

const ETIQUETA_ESTADO: Record<string, string> = {
  cuadrado: 'Cuadrado',
  sobrante: 'Sobrante',
  faltante: 'Faltante',
  otros: 'No cuadra',
};

/** Suma de las diferencias de todos los medios (efectivo + digitales). */
const difTotalCierre = (medios: Array<{ diferencia: number | null }> | undefined) =>
  Math.round((medios ?? []).reduce((t, m) => t + (m.diferencia ?? 0), 0) * 100) / 100;
const difSigno = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}S/ ${Math.abs(n).toFixed(2)}`;

/** Etiqueta «Cerrado con diferencia» (texto + color + ícono): se muestra cuando el cierre no cuadró. */
function EtiquetaConDiferencia({ total }: { total: number }) {
  return (
    <span
      data-testid="cerrado-con-diferencia"
      style={{ display: 'inline-block', background: '#FFF3E6', color: '#B2500F', border: '1px solid #B2500F', borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}
    >
      <span aria-hidden="true">▲▼ </span>Cerrado con diferencia{Math.abs(total) >= 0.005 ? `: ${difSigno(total)}` : ''}
    </span>
  );
}

export function HistorialCierres() {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN';

  const [cierres, setCierres] = useState<ItemHistorialCierre[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
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

  const cargarHistorial = useCallback(async () => {
    setError(null);
    try {
      const res = await cierreApi.obtenerHistorial({
        pagina,
        limite: 20,
        desde: desde || undefined,
        hasta: hasta || undefined,
      });
      setCierres(res.cierres);
      setTotal(res.total);
      setTotalPaginas(res.totalPaginas);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar el historial de cierres');
    } finally {
      setCargando(false);
    }
  }, [pagina, desde, hasta]);

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

  // El filtro de estado se aplica a la página que está en pantalla
  const cierresFiltrados = useMemo(() => {
    return cierres.filter((c) => filtroEstado === 'todos' || estadoCierre(c) === filtroEstado);
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
        <BarraFiltros style={{ alignItems: 'flex-end' }}>
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
              onChange={(e) => {
                setDesde(e.target.value);
                setPagina(1);
              }}
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
              onChange={(e) => {
                setHasta(e.target.value);
                setPagina(1);
              }}
              style={{
                minHeight: 44,
                borderRadius: 10,
                border: '1.5px solid var(--cp-line, #E3D6C6)',
                padding: '0 10px',
                fontSize: 13,
              }}
            />
          </div>
          <FiltroCombo
            etiqueta="Resultado"
            valor={filtroEstado}
            opciones={[
              { valor: 'todos', etiqueta: 'Todos' },
              { valor: 'cuadrado', etiqueta: 'Cuadrados' },
              { valor: 'sobrante', etiqueta: 'Sobrantes' },
              { valor: 'faltante', etiqueta: 'Faltantes' },
            ]}
            alCambiar={(v) => setFiltroEstado(v as typeof filtroEstado)}
          />
        </BarraFiltros>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>
          {total} {total === 1 ? 'cierre' : 'cierres'} con esas fechas
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
            const estado = estadoCierre(h);
            const col = estado === 'cuadrado' ? 'var(--cp-green, #2F7A45)' : estado === 'sobrante' ? 'var(--cp-soft, #2C4C5D)' : 'var(--cp-rust, #B2500F)';
            const difTexto = (dif > 0 ? '+' : '') + `s/ ${Math.abs(dif).toFixed(2)}`;

            const fechaStr = fechaDeCaja(h.fecha);

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
                    {ETIQUETA_ESTADO[estado]} {estado === 'cuadrado' || estado === 'otros' ? '' : difTexto}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
                  {fechaStr}
                  {h.cerradaEn ? ` · cerrada a las ${horaDeCierre(h.cerradaEn)}` : ''}
                </div>
                <div style={{ fontSize: 13, color: 'var(--cp-navy, #0B2C3E)' }}>
                  Cerró: {h.cerradaPorNombre ?? (h.cerradaPor ? `Usuario #${h.cerradaPor}` : 'Sin dato de cajero')}
                </div>
                {h.cierre?.resultado === 'NO_CUADRA' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                    <EtiquetaConDiferencia total={difTotalCierre(h.cierre.medios)} />
                    {h.cierre.nota && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--cp-soft, #2C4C5D)' }}>Nota: {h.cierre.nota}</div>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Paginacion pagina={pagina} totalPaginas={totalPaginas} alCambiarPagina={setPagina} totalRegistros={total} tamanoPagina={20} />

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
                  id="ticket-cierre"
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
                  <div>Fecha: {fechaDeCaja(detalle.fecha)}</div>
                  {detalle.cerradaEn && <div>Cierre: {horaDeCierre(detalle.cerradaEn)}</div>}
                  <div>Cajero: {detalle.cerradaPorNombre ?? (detalle.cerradaPor ? `Usuario #${detalle.cerradaPor}` : 'Sin dato de cajero')}</div>
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
                              <span>s/ {m.visto.toFixed(2)}</span>
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
                  {detalle.resultado === 'NO_CUADRA' && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <EtiquetaConDiferencia total={difTotalCierre(detalle.medios)} />
                      <div style={{ fontSize: 12 }}>Hay S/ {Math.abs(difTotalCierre(detalle.medios)).toFixed(2)} de {difTotalCierre(detalle.medios) >= 0 ? 'más' : 'menos'} en total entre todos los medios.</div>
                    </div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <ListaCorrecciones ajustes={detalle.ajustesMedio ?? []} titulo="Correcciones de medios digitales" />
                  </div>
                  {detalle.nota && (
                    <div style={{ marginTop: 6, fontStyle: 'italic' }}>
                      Obs: {detalle.nota}
                    </div>
                  )}
                </div>

                <style>{`
                  @media print {
                    body * { visibility: hidden !important; }
                    #ticket-cierre, #ticket-cierre * { visibility: visible !important; }
                    #ticket-cierre { position: absolute; left: 0; top: 0; width: 80mm; box-shadow: none; border: 0; }
                  }
                `}</style>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
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
                    onClick={() => window.print()}
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
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

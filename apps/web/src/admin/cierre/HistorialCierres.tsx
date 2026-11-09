import { useState, useEffect, useCallback, useMemo } from 'react';
import { Cargando } from '../../comun/Cargando';
import { DetalleCierreModal } from './DetalleCierreModal';
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
  const { usuario, tiene } = useSesion();
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

      {detalleId !== null && (
        <DetalleCierreModal
          cajaId={detalleId}
          detalle={detalle}
          cargando={cargandoDetalle}
          error={errorDetalle}
          esAdmin={esAdmin}
          puedeImprimir={esAdmin && tiene('caja/ver')}
          alCerrar={cerrarDetalle}
        />
      )}
    </div>
  );
}

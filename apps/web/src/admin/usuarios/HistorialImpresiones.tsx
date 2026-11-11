import { useCallback, useEffect, useRef, useState } from 'react';
import { Cargando } from '../../comun/Cargando';
import { Paginacion } from '../../comun/Paginacion';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';
import { impresionApi } from '../impresion/impresionApi';
import {
  ESTADOS_IMPRESION,
  ORIGENES,
  historialImpresionApi,
  type OrigenImpresion,
  type RespuestaHistorialImpresion,
} from '../impresion/historialImpresionApi';
import { ChipOrigen, FilaImpresion, TEXTO_ESTADO } from '../impresion/FilaImpresion';

const TIPOS = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'ETIQUETA_GENERAL', etiqueta: 'Sticker · General' },
  { valor: 'ETIQUETA_AREA', etiqueta: 'Sticker · Por área' },
  { valor: 'ETIQUETA_BEBIDA', etiqueta: 'Sticker · Bebida' },
  { valor: 'TICKET_PAGO', etiqueta: 'Ticket · Pago' },
  { valor: 'TICKET_COMANDA_SALON', etiqueta: 'Ticket · Comanda salón' },
  { valor: 'TICKET_COMANDA_AREA', etiqueta: 'Ticket · Comanda por área' },
  { valor: 'TICKET_CIERRE', etiqueta: 'Ticket · Cierre de caja' },
];

const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const sumarDias = (iso: string, dias: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
};
function rangoPreset(p: string): { desde: string; hasta: string } | null {
  const hoy = hoyLima();
  if (p === 'hoy') return { desde: hoy, hasta: hoy };
  if (p === 'ayer') return { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) };
  if (p === '7') return { desde: sumarDias(hoy, -6), hasta: hoy };
  return null;
}

const caja = { background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 14, padding: 14 } as const;

/** «Impresiones» del Historial: todo lo que se imprimió, con su origen (automática, reimpresión, prueba, reintento). */
export function HistorialImpresiones() {
  const [origenes, setOrigenes] = useState<OrigenImpresion[]>([]);
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [equipoId, setEquipoId] = useState('');
  const [fecha, setFecha] = useState('hoy');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');
  const [limite, setLimite] = useState(25);
  const [pagina, setPagina] = useState(1);
  const [verFiltros, setVerFiltros] = useState(false);
  const [equipos, setEquipos] = useState<Array<{ id: string; nombre: string }>>([]);

  const [datos, setDatos] = useState<RespuestaHistorialImpresion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const solicitud = useRef(0);

  const cargar = useCallback(async () => {
    const n = ++solicitud.current;
    setCargando(true);
    setError(null);
    const preset = rangoPreset(fecha);
    try {
      const r = await historialImpresionApi.listar({
        desde: preset ? preset.desde : desde,
        hasta: preset ? preset.hasta : hasta,
        origen: origenes,
        tipo,
        estado,
        equipoId,
        q,
        pagina,
        limite,
      });
      if (n === solicitud.current) setDatos(r);
    } catch (e) {
      if (n === solicitud.current) setError(e instanceof Error && e.message ? e.message : 'No se pudo cargar el historial de impresiones.');
    } finally {
      if (n === solicitud.current) setCargando(false);
    }
  }, [fecha, desde, hasta, origenes, tipo, estado, equipoId, q, pagina, limite]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Búsqueda por código con espera corta
  useEffect(() => {
    if (busqueda === q) return;
    const t = setTimeout(() => {
      setQ(busqueda);
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, q]);

  // Las computadoras para el filtro se piden solo al abrir los filtros
  useEffect(() => {
    if (!verFiltros || equipos.length) return;
    Promise.resolve()
      .then(() => impresionApi.obtenerMapa())
      .then((m) => setEquipos((m.equipos ?? []).map((e) => ({ id: e.deviceKeyId, nombre: e.nombre }))))
      .catch(() => undefined);
  }, [verFiltros, equipos.length]);

  const alternarOrigen = (o: OrigenImpresion) => {
    setOrigenes((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));
    setPagina(1);
  };
  const reiniciar = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPagina(1);
  };
  const activos = (tipo ? 1 : 0) + (estado ? 1 : 0) + (equipoId ? 1 : 0) + (fecha !== 'hoy' || desde || hasta ? 1 : 0);
  const limpiar = () => {
    setOrigenes([]);
    setTipo('');
    setEstado('');
    setEquipoId('');
    setFecha('hoy');
    setDesde('');
    setHasta('');
    setBusqueda('');
    setQ('');
    setPagina(1);
  };

  const resumen = datos?.resumen;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, lineHeight: '19px', color: 'var(--cp-soft)' }}>
        Todo lo que salió por las impresoras: si fue <b>automático</b> (al aceptar, cobrar o cerrar), una <b>reimpresión</b> pedida con el botón Reimprimir, una <b>prueba</b> o un <b>reintento</b>; quién lo pidió, dónde salió y si salió bien.
      </div>

      <div style={{ ...caja, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="hi-q" style={{ position: 'absolute', left: -9999 }}>Buscar por código de pedido</label>
          <input
            id="hi-q"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Código de pedido…"
            style={{ flex: '1 1 200px', minWidth: 0, minHeight: 44, borderRadius: 9999, border: '1.5px solid var(--cp-line)', padding: '0 16px', fontSize: 14, background: 'var(--cp-white)', color: 'var(--cp-navy)' }}
          />
          <button
            type="button"
            aria-expanded={verFiltros}
            onClick={() => setVerFiltros((v) => !v)}
            style={{
              flex: 'none',
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 9999,
              border: '1.5px solid var(--cp-navy)',
              background: verFiltros ? 'var(--cp-navy)' : 'transparent',
              color: verFiltros ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Filtros{activos ? ` (${activos})` : ''}
          </button>
        </div>

        {verFiltros && (
          <BarraFiltros style={{ borderTop: '1px solid var(--cp-line)', paddingTop: 8 }}>
            <FiltroCombo etiqueta="Tipo" valor={tipo} valorPorDefecto="" opciones={TIPOS} alCambiar={reiniciar(setTipo)} />
            <FiltroCombo
              etiqueta="Estado"
              valor={estado}
              valorPorDefecto=""
              opciones={[
                { valor: '', etiqueta: 'Todos' },
                ...ESTADOS_IMPRESION.map((e) => ({ valor: e, etiqueta: TEXTO_ESTADO[e], cantidad: resumen?.estado[e] })),
              ]}
              alCambiar={reiniciar(setEstado)}
            />
            <FiltroCombo
              etiqueta="Computadora"
              valor={equipoId}
              valorPorDefecto=""
              opciones={[{ valor: '', etiqueta: 'Todas' }, ...equipos.map((e) => ({ valor: e.id, etiqueta: e.nombre }))]}
              alCambiar={reiniciar(setEquipoId)}
            />
            <FiltroCombo
              etiqueta="Fecha"
              valor={fecha}
              valorPorDefecto="hoy"
              opciones={[
                { valor: 'hoy', etiqueta: 'Hoy' },
                { valor: 'ayer', etiqueta: 'Ayer' },
                { valor: '7', etiqueta: 'Últimos 7 días' },
                { valor: 'todos', etiqueta: 'Todo' },
              ]}
              alCambiar={(v) => {
                setFecha(v);
                setDesde('');
                setHasta('');
                setPagina(1);
              }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <label style={{ fontSize: 12, fontWeight: 700 }} htmlFor="hi-d">Desde</label>
              <input id="hi-d" type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setFecha('todos'); setPagina(1); }} style={{ minHeight: 38, borderRadius: 8, border: '1.5px solid var(--cp-line)', padding: '0 6px', fontSize: 12 }} />
              <label style={{ fontSize: 12, fontWeight: 700 }} htmlFor="hi-h">Hasta</label>
              <input id="hi-h" type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setFecha('todos'); setPagina(1); }} style={{ minHeight: 38, borderRadius: 8, border: '1.5px solid var(--cp-line)', padding: '0 6px', fontSize: 12 }} />
              <button type="button" onClick={limpiar} style={{ minHeight: 38, padding: '0 10px', border: '1.5px solid var(--cp-navy)', borderRadius: 8, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                Limpiar filtros
              </button>
            </div>
          </BarraFiltros>
        )}

        {/* Totales por origen: también filtran (se pueden combinar) */}
        <div role="group" aria-label="Filtrar por origen" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {ORIGENES.map((o) => (
            <ChipOrigen key={o} origen={o} cantidad={resumen?.origen[o]} activo={origenes.includes(o)} alClic={() => alternarOrigen(o)} />
          ))}
          <span style={{ fontSize: 12.5, color: 'var(--cp-soft)', marginLeft: 4 }}>{datos ? `${datos.total} impresiones` : ''}</span>
        </div>
      </div>

      {cargando && <Cargando />}
      {error && (
        <div role="alert" style={{ border: '1.5px solid var(--cp-rust)', background: '#FBEDE9', color: 'var(--cp-rust)', borderRadius: 12, padding: '10px 12px', fontSize: 14, fontWeight: 700, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" onClick={() => void cargar()} style={{ minHeight: 40, padding: '0 14px', borderRadius: 10, border: '1.5px solid var(--cp-rust)', background: 'transparent', color: 'var(--cp-rust)', fontWeight: 800, cursor: 'pointer' }}>
            Reintentar
          </button>
        </div>
      )}
      {!cargando && !error && datos && datos.datos.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--cp-soft)', ...caja }}>No hay impresiones con estos filtros.</div>
      )}

      {datos && datos.datos.length > 0 && (
        <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, opacity: cargando ? 0.6 : 1 }}>
          {datos.datos.map((f) => (
            <FilaImpresion key={f.id} fila={f} alTerminar={() => void cargar()} />
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <Paginacion paginaActual={pagina} totalPaginas={datos?.paginas ?? 1} alCambiarPagina={setPagina} />
        <label style={{ fontSize: 12.5, color: 'var(--cp-soft)', display: 'flex', gap: 6, alignItems: 'center' }}>
          Por página
          <select value={limite} onChange={(e) => { setLimite(Number(e.target.value)); setPagina(1); }} style={{ minHeight: 36, borderRadius: 8, border: '1.5px solid var(--cp-line)', padding: '0 6px' }}>
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

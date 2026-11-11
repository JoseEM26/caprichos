import { memo, useMemo, useState } from 'react';
import '../pedidos/caja-lista.css';
import './ventas-turno.css';
import type { CobroTurno } from '../pedidos/pedidosApi';
import type { VentaDetalle } from './cierreApi';
import { usePreferencia } from '../../comun/usePreferencia';
import { ConmutadorVista, FiltroMultiple, SelectorColumnas, normalizarVista, type VistaLista } from '../../comun/tabla/ControlesTabla';
import { PaginadorCaja, normalizarFilas, tamanoPagina, type FilasPorPagina } from '../pedidos/PaginadorCaja';
import { MEDIOS_FILTRO } from '../pedidos/mediosFila';
import { nombreMedio } from '../pedidos/planPago';
import { aHora } from '../pedidos/columnasCaja';
import { EstadoVacio } from '../../comun/EstadoVacio';
import {
  CLAVE_VENTAS_COLUMNAS,
  CLAVE_VENTAS_FILAS,
  CLAVE_VENTAS_VISTA,
  COLUMNAS_VENTAS,
  COLUMNAS_VENTAS_POR_DEFECTO,
  FILTROS_VENTAS,
  filtrarVentas,
  hayFiltros,
  normalizarColumnasVentas,
  opcionesDe,
  ordenarVentas,
  totalesVentas,
  unir,
  ventasACsv,
  type FiltrosElegidos,
  type Orden,
  type VentaFila,
} from './ventasTurno';

const soles = (n: number) => `S/ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface VentasTurnoProps {
  cobrados: CobroTurno[];
  ventas?: VentaDetalle[];
  /** Fecha AAAA-MM-DD de la caja: para el nombre del archivo CSV */
  fecha?: string;
}

function descargarCsv(texto: string, nombre: string) {
  try {
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // sin descarga disponible en este navegador
  }
}

const FilaTabla = memo(function FilaTabla({ f, columnas }: { f: VentaFila; columnas: string[] }) {
  return (
    <tr data-testid="fila-venta">
      {columnas.map((id) => {
        const c = COLUMNAS_VENTAS.find((x) => x.id === id)!;
        let contenido: React.ReactNode = c.texto(f);
        if (id === 'medios') contenido = f.medios.map((m) => <span key={m} className="cj2-tb-chip cj2-tb-medio" data-medio={m}>{nombreMedio(m)}</span>);
        return (
          <td key={id} className={c.numerica ? 'cj2-tb-num' : undefined} data-col={id} title={typeof contenido === 'string' ? contenido : undefined}>
            {contenido}
          </td>
        );
      })}
    </tr>
  );
});

const Dato = ({ t, v }: { t: string; v: string }) => (v ? (
  <div className="vt-dato"><span className="vt-dato-t">{t}</span><span className="vt-dato-v">{v}</span></div>
) : null);

const TarjetaVenta = memo(function TarjetaVenta({ f }: { f: VentaFila }) {
  return (
    <article className="vt-card" data-testid="tarjeta-venta" aria-label={`Venta ${f.codigo}`}>
      <header className="vt-card-cab">
        <div>
          <b className="vt-card-cod">{f.codigo}</b>
          <span className="vt-card-hora">{aHora(f.hora)}{f.horaCobro && f.horaCobro !== f.hora ? ` · cobro ${aHora(f.horaCobro)}` : ''}</span>
        </div>
        <b className="vt-card-total">{soles(f.total)}</b>
      </header>
      <div className="vt-chips">
        {f.modalidad && <span className="cj2-tb-chip vt-chip-tipo">{f.modalidad}</span>}
        {f.medios.map((m) => <span key={m} className="cj2-tb-chip cj2-tb-medio" data-medio={m}>{nombreMedio(m)}</span>)}
        <span className="cj2-tb-chip vt-chip-estado">{f.estadoCobro}</span>
      </div>
      <Dato t="Registró" v={f.registro} />
      <Dato t="Cliente" v={f.cliente} />
      <Dato t="Categoría" v={f.categorias.join(', ')} />
      <Dato t="Repartidor" v={f.repartidor} />
      <Dato t="Mesa" v={f.mesa} />
      <Dato t="Cobró (Caja)" v={f.cobro} />
      <Dato t="Cobrado por mozo" v={f.cobroMozo} />
      <Dato t="Propina" v={f.propina > 0 ? soles(f.propina) : ''} />
      <Dato t="Comprobante" v={f.comprobante} />
      <Dato t="Canal" v={f.canal} />
    </article>
  );
});

/**
 * «Ventas del turno»: cada venta cobrada de la caja que se cierra, en tabla o tarjetas, con columnas a gusto,
 * filtros, orden, búsqueda y CSV. Solo muestra datos: los totales del cierre no salen de aquí.
 */
export function VentasTurno({ cobrados, ventas, fecha }: VentasTurnoProps) {
  const [vista, setVista] = usePreferencia<VistaLista>(CLAVE_VENTAS_VISTA, 'tabla', normalizarVista);
  const [columnas, setColumnas] = usePreferencia<string[]>(CLAVE_VENTAS_COLUMNAS, COLUMNAS_VENTAS_POR_DEFECTO, normalizarColumnasVentas);
  const [filasPref, setFilasPref] = usePreferencia<FilasPorPagina>(CLAVE_VENTAS_FILAS, null, normalizarFilas);
  const [busqueda, setBusqueda] = useState('');
  const [elegidos, setElegidos] = useState<FiltrosElegidos>({});
  const [verFiltros, setVerFiltros] = useState(false);
  const [orden, setOrden] = useState<Orden | null>(null);
  const [pagina, setPagina] = useState(1);

  const todas = useMemo(() => unir(cobrados, ventas), [cobrados, ventas]);
  const filtradas = useMemo(() => filtrarVentas(todas, elegidos, busqueda), [todas, elegidos, busqueda]);
  const visibles = useMemo(() => ordenarVentas(filtradas, orden), [filtradas, orden]);
  const totales = useMemo(() => totalesVentas(filtradas), [filtradas]);
  const mediosTotal = MEDIOS_FILTRO.filter((m) => totales.porMedio[m.id] != null);
  const filtrado = hayFiltros(elegidos, busqueda);
  const nFiltros = Object.values(elegidos).filter((v) => v.length > 0).length;

  const filasPorPagina = filasPref ?? 25;
  const tam = tamanoPagina(filasPorPagina, visibles.length, 25);
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / tam));
  const paginaValida = Math.min(pagina, totalPaginas);
  const desde = visibles.length === 0 ? 0 : (paginaValida - 1) * tam + 1;
  const hasta = Math.min(visibles.length, paginaValida * tam);
  const pagina_ = visibles.slice((paginaValida - 1) * tam, paginaValida * tam);

  const cambiarFiltro = (id: string, v: string[]) => {
    setElegidos((e) => ({ ...e, [id]: v }));
    setPagina(1);
  };
  const limpiar = () => {
    setElegidos({});
    setBusqueda('');
    setPagina(1);
  };
  const ordenarPor = (col: string) => {
    setOrden((o) => (o?.col === col ? (o.asc ? { col, asc: false } : null) : { col, asc: true }));
    setPagina(1);
  };

  return (
    <section className="vt" aria-labelledby="vt-titulo" data-testid="ventas-turno">
      <div className="vt-cab">
        <h3 id="vt-titulo" className="vt-titulo">Ventas del turno</h3>
        <span className="vt-sub">{todas.length} {todas.length === 1 ? 'venta cobrada' : 'ventas cobradas'}</span>
      </div>

      {todas.length === 0 ? (
        <EstadoVacio mensaje="Todavía no hay ventas cobradas en este turno. Aparecerán aquí apenas se cobre la primera." />
      ) : (
        <>
          <div className="vt-barra">
            <label className="vt-buscar">
              <span className="vt-sr">Buscar por código o cliente</span>
              <input
                type="search"
                inputMode="search"
                placeholder="Buscar por código o cliente"
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
              />
            </label>
            <button type="button" className="cj2-btn" aria-expanded={verFiltros} aria-controls="vt-filtros" onClick={() => setVerFiltros((v) => !v)}>
              Filtros{nFiltros > 0 ? ` (${nFiltros})` : ''}
            </button>
            <div className="cj2-vistabar">
              <ConmutadorVista vista={vista} alCambiar={(v) => { setVista(v); setPagina(1); }} />
              {vista === 'tabla' && (
                <SelectorColumnas todas={COLUMNAS_VENTAS} columnas={columnas} porDefecto={COLUMNAS_VENTAS_POR_DEFECTO} alCambiar={setColumnas} />
              )}
              <button
                type="button"
                className="cj2-btn"
                disabled={visibles.length === 0}
                onClick={() => descargarCsv(ventasACsv(visibles, columnas), `ventas-turno-${fecha ?? 'caja'}.csv`)}
              >
                Descargar CSV
              </button>
            </div>
          </div>

          {verFiltros && (
            <div id="vt-filtros" className="vt-filtros" role="group" aria-label="Filtros de ventas">
              {FILTROS_VENTAS.map((def) => (
                <FiltroMultiple key={def.id} titulo={def.titulo} opciones={opcionesDe(def, todas)} elegidas={elegidos[def.id] ?? []} alCambiar={(v) => cambiarFiltro(def.id, v)} />
              ))}
            </div>
          )}

          {nFiltros > 0 && (
            <div className="vt-activos" aria-label="Filtros activos">
              {FILTROS_VENTAS.flatMap((def) =>
                (elegidos[def.id] ?? []).map((v) => (
                  <button
                    key={`${def.id}:${v}`}
                    type="button"
                    className="vt-chip-filtro"
                    aria-label={`Quitar filtro ${def.titulo}: ${def.nombre ? def.nombre(v) : v}`}
                    onClick={() => cambiarFiltro(def.id, (elegidos[def.id] ?? []).filter((x) => x !== v))}
                  >
                    {def.titulo}: {def.nombre ? def.nombre(v) : v} <span aria-hidden="true">×</span>
                  </button>
                )),
              )}
              <button type="button" className="cj2-limpiar" onClick={limpiar}>Quitar todos</button>
            </div>
          )}

          <div className="vt-resumen" data-testid="totales-ventas" role="status">
            {filtrado && <span className="vt-fil">Filtrado: {totales.n} de {todas.length}</span>}
            <span><b>{totales.n}</b> {totales.n === 1 ? 'venta' : 'ventas'}</span>
            <span data-testid="vt-total">Total <b>{soles(totales.total)}</b></span>
            {totales.propina > 0 && <span>Propinas <b>{soles(totales.propina)}</b></span>}
            {mediosTotal.map((m) => (
              <span key={m.id} data-testid={`vt-medio-${m.id}`}>{m.n} <b>{soles(totales.porMedio[m.id])}</b></span>
            ))}
          </div>

          {visibles.length === 0 ? (
            <div className="vt-sin" role="status">
              <p>Ninguna venta coincide con lo que elegiste.</p>
              <button type="button" className="cj2-btn" onClick={limpiar}>Quitar los filtros</button>
            </div>
          ) : vista === 'tabla' ? (
            <div className="cj2-tabla-marco" data-testid="tabla-ventas">
              <div className="cj2-tabla-scroll" tabIndex={0} role="region" aria-label="Tabla de ventas del turno">
                <table className="cj2-tabla">
                  <thead>
                    <tr>
                      {columnas.map((id) => {
                        const c = COLUMNAS_VENTAS.find((x) => x.id === id)!;
                        const activo = orden?.col === id;
                        return (
                          <th key={id} scope="col" className={c.numerica ? 'cj2-tb-num' : undefined} aria-sort={activo ? (orden!.asc ? 'ascending' : 'descending') : 'none'}>
                            <button type="button" className="vt-th" aria-label={`Ordenar por ${c.titulo}`} onClick={() => ordenarPor(id)}>
                              {c.titulo}{activo ? (orden!.asc ? ' ▲' : ' ▼') : ''}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {pagina_.map((f) => <FilaTabla key={f.id} f={f} columnas={columnas} />)}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="vt-cuadricula" data-testid="tarjetas-ventas">
              {pagina_.map((f) => <TarjetaVenta key={f.id} f={f} />)}
            </div>
          )}

          <PaginadorCaja
            total={visibles.length}
            desde={desde}
            hasta={hasta}
            pagina={paginaValida}
            totalPaginas={totalPaginas}
            alIr={setPagina}
            filas={filasPorPagina}
            alCambiarFilas={(f) => { setFilasPref(f); setPagina(1); }}
            conAuto={false}
            unidad="ventas"
          />
        </>
      )}
    </section>
  );
}

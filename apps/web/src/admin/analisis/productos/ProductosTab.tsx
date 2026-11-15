import { Fragment, useId, useMemo, useState } from 'react';
import { Cargando } from '../../../comun/Cargando';
import { EstadoError } from '../../../comun/EstadoError';
import {
  BarrasHorizontales,
  Paginador,
  Semaforo,
  TarjetaAnalisis,
  TarjetaIndicador,
  consultaDe,
  ddmm,
  usePaginacion,
  useConsultaAnalisis,
  type NivelSemaforo,
  type PropsPestanaAnalisis,
} from '../comun';
import type { FilaMargen, FilaProducto, GrupoMargen, Opcion, RespuestaProductos } from './tipos';

const FORMATO = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
});
const soles = (n: number | null) => (n == null ? 'Sin dato' : FORMATO.format(n));
const pct = (n: number | null) => (n == null ? 'Sin dato' : `${String(n).replace('.', ',')} %`);
const NUM = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 });
const TOP_BARRAS = 10;

/** Misma regla del servidor: 20 % que más vende (TOP) y 20 % que menos (BAJO); con menos de 5 no se marca. */
function marcar(filas: FilaProducto[]): FilaProducto[] {
  const k = Math.ceil(filas.length * 0.2);
  return filas.map((f, i) => ({
    ...f,
    marca: filas.length < 5 ? null : i >= filas.length - k ? 'BAJO' : i < k ? 'TOP' : null,
  }));
}

type Seccion = 'vendidos' | 'dias' | 'modificadores' | 'margen';
const SECCIONES: ReadonlyArray<{ id: Seccion; nombre: string }> = [
  { id: 'vendidos', nombre: 'Productos vendidos' },
  { id: 'dias', nombre: 'Días de venta' },
  { id: 'modificadores', nombre: 'Opciones elegidas' },
  { id: 'margen', nombre: 'Margen' },
];

/** Pestaña «Productos»: qué se vende, qué días, con qué opciones y cuánto se gana. Los montos y márgenes son solo del ADMIN. */
export function ProductosTab({ filtros, alCambiarPeriodo }: PropsPestanaAnalisis) {
  const { datos, estado, mensaje, recargar } = useConsultaAnalisis<RespuestaProductos>(`/admin/analisis/productos?${consultaDe(filtros, ['modalidad', 'canal', 'turno'])}`);
  const [seccion, setSeccion] = useState<Seccion>('vendidos');
  return (
    <div className="an">
      {estado === 'cargando' && !datos && <Cargando mensaje="Calculando los productos" />}
      {estado === 'error' && !datos && <EstadoError titulo="No se pudieron calcular los productos" mensaje={mensaje || 'Prueba de nuevo en unos segundos.'} alReintentar={recargar} />}
      {datos && datos.productos.total > 0 && datos.productos.unidades === 0 && (
        <div className="an-estado" role="status">
          <strong>Todavía no hay ventas en este periodo</strong>
          {alCambiarPeriodo && (
            <div className="an-chips">
              <button type="button" className="an-chip" onClick={() => alCambiarPeriodo('ayer')}>
                Ver ayer
              </button>
              <button type="button" className="an-chip" onClick={() => alCambiarPeriodo('7d')}>
                Ver últimos 7 días
              </button>
            </div>
          )}
        </div>
      )}
      {datos && !(datos.productos.total > 0 && datos.productos.unidades === 0) && (
        <>
          <div className="an-chips" role="group" aria-label="Secciones de productos">
            {SECCIONES.map((s) => (
              <button key={s.id} type="button" className="an-chip" aria-pressed={seccion === s.id} onClick={() => setSeccion(s.id)}>
                {s.nombre}
              </button>
            ))}
          </div>
          {seccion === 'vendidos' && <Vendidos d={datos} />}
          {seccion === 'dias' && <Dias d={datos} />}
          {seccion === 'modificadores' && <Modificadores d={datos} />}
          {seccion === 'margen' && <Margen d={datos} />}
        </>
      )}
    </div>
  );
}

/* ---------------- 1. Productos vendidos ---------------- */
function Tendencia({ f }: { f: FilaProducto }) {
  if (f.tendencia == null) return <span>{f.unidades > 0 ? 'Nuevo' : '—'}</span>;
  const flecha = f.tendencia > 0 ? '▲' : f.tendencia < 0 ? '▼' : '=';
  return (
    <span>
      <span aria-hidden="true">{flecha} </span>
      {pct(Math.abs(f.tendencia))}
      <span className="an-solo-lector">{f.tendencia > 0 ? ' más' : f.tendencia < 0 ? ' menos' : ' igual'} que antes</span>
    </span>
  );
}

function Marca({ f }: { f: FilaProducto }) {
  if (f.marca === 'TOP') return <Semaforo nivel="verde" texto="Top 20 %" />;
  if (f.marca === 'BAJO') return <Semaforo nivel="rojo" texto="Bajo 20 %" />;
  return null;
}

function Vendidos({ d }: { d: RespuestaProductos }) {
  const id = useId();
  const [orden, setOrden] = useState<'mas' | 'menos'>('mas');
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [conCeros, setConCeros] = useState(false);
  const p = d.productos;
  // sin el interruptor, los de 0 ventas no se muestran ni cuentan para «Bajo 20 %» (la marca se recalcula entre los que vendieron)
  const base = useMemo(() => (conCeros ? p.filas : marcar(p.filas.filter((x) => x.unidades > 0))), [p.filas, conCeros]);
  const filas = useMemo(() => {
    const q = texto.trim().toLowerCase();
    const f = base.filter((x) => (!categoria || x.categoria === categoria) && (!q || x.nombre.toLowerCase().includes(q)));
    return orden === 'mas' ? f : [...f].reverse();
  }, [base, orden, texto, categoria]);
  const pag = usePaginacion(filas, `${texto}|${categoria}|${orden}|${conCeros}`);
  // las barras muestran los N de cada extremo sobre TODO el catálogo (sin buscador): la marca decide quedarse o irse
  const barras = (lista: FilaProducto[]) =>
    lista.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      detalle: f.categoria,
      valor: f.unidades,
      texto: `${f.unidades} u.${f.monto != null ? ` · ${soles(f.monto)}` : ''}`,
      semaforo: (f.marca === 'TOP' ? 'verde' : f.marca === 'BAJO' ? 'rojo' : undefined) as NivelSemaforo | undefined,
    }));
  const mas = base.filter((f) => f.unidades > 0).slice(0, TOP_BARRAS);
  const menos = [...base].reverse().slice(0, TOP_BARRAS);
  if (p.total === 0) return <div className="an-estado">No hay productos en el catálogo.</div>;
  return (
    <>
      <div className="an-rejilla an-rejilla--kpi">
        <TarjetaIndicador titulo="Productos en el catálogo" valor={String(p.total)} />
        <TarjetaIndicador titulo="Con ventas" valor={String(p.conVentas)} />
        <TarjetaIndicador titulo="Sin ninguna venta" valor={String(p.sinVentas)} detalle="Candidatos a salir de la carta" />
        <TarjetaIndicador titulo="Unidades vendidas" valor={String(p.unidades)} detalle={d.conDinero ? soles(p.monto) : undefined} />
      </div>
      <div className="an-rejilla">
        <TarjetaAnalisis id="an-prod-mas" titulo={`Los ${TOP_BARRAS} más vendidos`} estado={mas.length ? 'ok' : 'vacio'} vacio="Sin ventas en este período.">
          <BarrasHorizontales descripcion="Productos más vendidos por unidades" filas={barras(mas)} />
        </TarjetaAnalisis>
        <TarjetaAnalisis
          id="an-prod-menos"
          titulo={`Los ${TOP_BARRAS} menos vendidos`}
          subtitulo={conCeros ? 'Incluye los que no vendieron nada.' : 'Solo los que vendieron algo. Activa «Mostrar productos sin ventas» para ver los demás.'}
          estado="ok"
        >
          <BarrasHorizontales descripcion="Productos menos vendidos por unidades" filas={barras(menos)} />
        </TarjetaAnalisis>
      </div>
      <TarjetaAnalisis
        id="an-prod-lista"
        titulo="Todos los productos"
        subtitulo="Top 20 % es el quinto que más vende; Bajo 20 % el quinto que menos vende (los productos sin ventas solo cuentan si activas el interruptor). La tendencia compara con el período anterior de igual largo."
        estado="ok"
      >
        <div className="an-herramientas">
          <div className="an-filtros__grupo">
            <label className="an-filtros__etiqueta" htmlFor={`${id}-b`}>
              Buscar producto
            </label>
            <input id={`${id}-b`} className="an-campo" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <div className="an-filtros__grupo">
            <label className="an-filtros__etiqueta" htmlFor={`${id}-c`}>
              Categoría
            </label>
            <select id={`${id}-c`} className="an-campo" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Todas</option>
              {p.categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <label className="an-interruptor">
            <input type="checkbox" checked={conCeros} onChange={(e) => setConCeros(e.target.checked)} />
            Mostrar productos sin ventas ({p.sinVentas})
          </label>
          <div className="an-chips" role="group" aria-label="Orden">
            <button type="button" className="an-chip" aria-pressed={orden === 'mas'} onClick={() => setOrden('mas')}>
              Más vendidos primero
            </button>
            <button type="button" className="an-chip" aria-pressed={orden === 'menos'} onClick={() => setOrden('menos')}>
              Menos vendidos primero
            </button>
          </div>
        </div>
        {filas.length === 0 ? (
          <div className="an-estado">Ningún producto coincide con la búsqueda.</div>
        ) : (
          <div className="an-tabla">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="an-num">Unidades</th>
                  {d.conDinero && <th className="an-num">Monto</th>}
                  <th className="an-num">% del total</th>
                  <th className="an-num">Pedidos</th>
                  <th>Tendencia</th>
                  <th>Marca</th>
                </tr>
              </thead>
              <tbody>
                {pag.filas.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {f.nombre}
                      <br />
                      <span className="an-sub">{f.categoria}</span>
                    </td>
                    <td className="an-num">{f.unidades}</td>
                    {d.conDinero && <td className="an-num">{soles(f.monto)}</td>}
                    <td className="an-num">{pct(f.porcentaje)}</td>
                    <td className="an-num">{f.pedidos}</td>
                    <td>
                      <Tendencia f={f} />
                    </td>
                    <td>
                      <Marca f={f} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginador p={pag} />
      </TarjetaAnalisis>
    </>
  );
}

/* ---------------- 2. Días ---------------- */
function Dias({ d }: { d: RespuestaProductos }) {
  const x = d.dias;
  const dinero = d.conDinero;
  const tabla = (titulo: string, id: string, filas: typeof x.masVentas) => (
    <TarjetaAnalisis id={id} titulo={titulo} estado={filas.length ? 'ok' : 'vacio'} vacio="Sin ventas en este período.">
      <div className="an-tabla">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th className="an-num">Pedidos</th>
              {dinero && <th className="an-num">Monto</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.fecha}>
                <td>{ddmm(f.fecha)}</td>
                <td className="an-num">{f.pedidos}</td>
                {dinero && <td className="an-num">{soles(f.monto)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TarjetaAnalisis>
  );
  const mayor = Math.max(...x.porSemana.map((s) => (dinero ? (s.promedioMonto ?? 0) : (s.promedioPedidos ?? 0))));
  return (
    <>
      <TarjetaAnalisis
        id="an-dias-semana"
        titulo="Promedio por día de la semana"
        subtitulo={`${dinero ? 'Venta' : 'Pedidos'} promedio de cada día con ventas. Un día cerrado no baja el promedio.`}
        estado={x.diasConVentas ? 'ok' : 'vacio'}
        vacio="Sin ventas en este período."
        tabla={{
          cabecera: ['Día', 'Días con ventas', 'Pedidos por día', ...(dinero ? ['Venta por día'] : [])],
          filas: x.porSemana.map((s) => [s.dia, s.dias, s.promedioPedidos ?? 'Sin dato', ...(dinero ? [soles(s.promedioMonto)] : [])]),
        }}
      >
        <BarrasHorizontales
          descripcion="Venta promedio por día de la semana"
          etiquetaDestacada="Mejor día"
          filas={x.porSemana.map((s) => {
            const v = dinero ? s.promedioMonto : s.promedioPedidos;
            return {
              id: s.dia,
              nombre: s.dia,
              detalle: s.dias ? `${s.dias} ${s.dias === 1 ? 'día' : 'días'} con ventas · ${NUM.format(s.promedioPedidos ?? 0)} pedidos por día` : 'Sin ventas ese día',
              valor: v,
              texto: v == null ? 'Sin dato' : dinero ? soles(v) : `${NUM.format(v)} pedidos`,
              destacada: v != null && v === mayor && mayor > 0,
            };
          })}
        />
      </TarjetaAnalisis>
      <div className="an-rejilla">
        {tabla('Fechas con más ventas', 'an-dias-mas', x.masVentas)}
        {tabla('Fechas con menos ventas', 'an-dias-menos', x.menosVentas)}
      </div>
    </>
  );
}

/* ---------------- 3. Modificadores ---------------- */
function Modificadores({ d }: { d: RespuestaProductos }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const m = d.modificadores;
  const pag = usePaginacion(m.porProducto);
  const texto = (o: Opcion) => `${o.grupo}: ${o.opcion}`;
  return (
    <>
      <TarjetaAnalisis
        id="an-mod-global"
        titulo="Opciones más elegidas"
        subtitulo="Tamaños y opciones de todos los productos. Cuenta las unidades vendidas con esa opción."
        estado={m.global.length ? 'ok' : 'vacio'}
        vacio="No se eligieron opciones en este período."
        tabla={{
          cabecera: ['Grupo', 'Opción', 'Veces'],
          filas: m.global.map((o) => [o.grupo, o.opcion, o.veces]),
        }}
      >
        <BarrasHorizontales
          descripcion="Opciones más elegidas"
          filas={m.global.slice(0, 15).map((o) => ({
            id: `${o.grupo}|${o.opcion}`,
            nombre: o.opcion,
            detalle: o.grupo,
            valor: o.veces,
            texto: String(o.veces),
          }))}
        />
      </TarjetaAnalisis>
      <TarjetaAnalisis
        id="an-mod-prod"
        titulo="Opciones por producto"
        subtitulo="Toca un producto para ver qué opciones y tamaños se eligieron."
        estado={m.porProducto.length ? 'ok' : 'vacio'}
        vacio="Ningún producto vendió con opciones."
      >
        <div className="an-tabla">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="an-num">Opciones elegidas</th>
              </tr>
            </thead>
            <tbody>
              {pag.filas.map((p) => (
                <Fragment key={p.id}>
                  <tr>
                    <td>
                      <button type="button" className="an-fila-boton" aria-expanded={abierto === p.id} onClick={() => setAbierto((a) => (a === p.id ? null : p.id))}>
                        <span aria-hidden="true">{abierto === p.id ? '▾ ' : '▸ '}</span>
                        {p.nombre}
                      </button>
                    </td>
                    <td className="an-num">{p.total}</td>
                  </tr>
                  {abierto === p.id && (
                    <tr>
                      <td colSpan={2}>
                        <ul className="an-lista">
                          {p.opciones.map((o) => (
                            <li key={`${o.grupo}|${o.opcion}`}>
                              <span className="an-lista__texto">{texto(o)}</span>
                              <strong>{o.veces}</strong>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Paginador p={pag} />
      </TarjetaAnalisis>
    </>
  );
}

/* ---------------- 4. Margen ---------------- */
const NIVEL: Record<GrupoMargen, { nivel: NivelSemaforo; texto: string }> = {
  BAJO: { nivel: 'rojo', texto: 'Margen bajo' },
  MEDIO: { nivel: 'ambar', texto: 'Margen medio' },
  ALTO: { nivel: 'verde', texto: 'Margen alto' },
  SIN_COSTO: { nivel: 'sin_dato', texto: 'Sin costo registrado' },
};
const ORDEN_GRUPOS: GrupoMargen[] = ['BAJO', 'MEDIO', 'ALTO', 'SIN_COSTO'];

function Margen({ d }: { d: RespuestaProductos }) {
  const [grupo, setGrupo] = useState<GrupoMargen | ''>('');
  const m = d.margen;
  const lista = useMemo(() => (m && grupo ? m.filas.filter((f) => f.grupo === grupo) : (m?.filas ?? [])), [m, grupo]);
  const pag = usePaginacion(lista, grupo);
  if (!m) {
    return (
      <section className="an-tarjeta" role="status">
        <h3>Margen solo para el administrador</h3>
        <p>El margen muestra costos y ganancias, que solo ve el administrador.</p>
      </section>
    );
  }
  const filas: FilaMargen[] = lista;
  return (
    <>
      <div className="an-rejilla an-rejilla--kpi">
        <TarjetaIndicador
          titulo="Margen del período"
          valor={pct(m.ponderado.margen)}
          detalle={m.ponderado.margen == null ? 'Ningún producto vendido tiene costo' : `Sobre ${soles(m.ponderado.ingresos)} de ${m.ponderado.productos} productos con costo`}
        />
        {ORDEN_GRUPOS.map((g) => (
          <div className="an-kpi" key={g}>
            <span className="an-kpi__titulo">{NIVEL[g].texto}</span>
            <strong className="an-kpi__valor">{m.grupos[g]}</strong>
            <Semaforo nivel={NIVEL[g].nivel} texto={g === 'BAJO' ? 'Menos de 30 %' : g === 'ALTO' ? 'Más de 70 %' : g === 'MEDIO' ? '30 a 70 %' : 'Falta receta o costo'} />
          </div>
        ))}
      </div>
      <TarjetaAnalisis
        id="an-margen"
        titulo="Margen por producto"
        subtitulo="Margen = (precio de venta − costo) ÷ precio de venta. El costo sale de la receta con el costo de cada insumo. Sin ventas se usa el precio de la carta."
        estado={m.filas.length ? 'ok' : 'vacio'}
        vacio="No hay productos."
      >
        <div className="an-chips" role="group" aria-label="Filtrar por grupo de margen">
          <button type="button" className="an-chip" aria-pressed={grupo === ''} onClick={() => setGrupo('')}>
            Todos
          </button>
          {ORDEN_GRUPOS.map((g) => (
            <button key={g} type="button" className="an-chip" aria-pressed={grupo === g} onClick={() => setGrupo(g)}>
              {NIVEL[g].texto} ({m.grupos[g]})
            </button>
          ))}
        </div>
        {filas.length === 0 ? (
          <div className="an-estado">Ningún producto en este grupo.</div>
        ) : (
          <div className="an-tabla">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Grupo</th>
                  <th className="an-num">Margen</th>
                  <th className="an-num">Precio</th>
                  <th className="an-num">Costo</th>
                  <th className="an-num">Unidades</th>
                </tr>
              </thead>
              <tbody>
                {pag.filas.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {f.nombre}
                      <br />
                      <span className="an-sub">{f.categoria}</span>
                      {f.grupo === 'SIN_COSTO' && <span className="an-sub"> · Falta: {f.motivos.join('; ')}</span>}
                      {f.base === 'catalogo' && f.grupo !== 'SIN_COSTO' && <span className="an-sub"> · Sin ventas: precio de la carta</span>}
                    </td>
                    <td>
                      <Semaforo nivel={NIVEL[f.grupo].nivel} texto={NIVEL[f.grupo].texto} />
                    </td>
                    <td className="an-num">{pct(f.margen)}</td>
                    <td className="an-num">{f.precio == null ? '—' : soles(f.precio)}</td>
                    <td className="an-num">{f.costo == null ? '—' : soles(f.costo)}</td>
                    <td className="an-num">{f.unidades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginador p={pag} />
      </TarjetaAnalisis>
    </>
  );
}

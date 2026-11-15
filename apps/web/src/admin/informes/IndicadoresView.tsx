import { useState, useEffect } from 'react';
import { api } from '../../comun/api';
import { Confirmar } from '../../comun/Confirmar';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { SeccionEncuestas } from './encuestas/SeccionEncuestas';
import { BarraFiltrosIndicadores, notaNoAplica, textoPeriodo, useFiltrosIndicadores, type ClaveFiltro } from './FiltrosIndicadores';

/** Filtros que usa cada cuadro; los demás se muestran con la nota «No aplica…». */
const APLICA_META: Record<string, ClaveFiltro[]> = {
  'Tiempo de entrega': ['periodo', 'canal', 'modalidad'],
  'Ventas de productos agotados': ['periodo', 'canal', 'modalidad', 'categoria'],
  'Platos con margen visible': ['categoria'],
  'Pedidos por carta o chatbot sin reingreso': ['periodo', 'modalidad'],
  'Rotación de mesas': ['periodo', 'canal'],
  'Reclamos de delivery': ['periodo'],
};
const APLICA_TOP: ClaveFiltro[] = ['periodo', 'canal', 'modalidad', 'categoria'];
const APLICA_PROMOS: ClaveFiltro[] = ['periodo', 'canal', 'modalidad'];
const APLICA_ENCUESTAS: ClaveFiltro[] = ['periodo', 'canal', 'modalidad'];

const estiloNota = { fontSize: 12, color: 'var(--cp-soft)', lineHeight: '16px' } as const;
function Sub({ periodo, nota }: { periodo?: string; nota: string }) {
  if (!periodo && !nota) return null;
  return (
    <div style={estiloNota}>
      {periodo && <span>Periodo: {periodo}</span>}
      {periodo && nota ? ' · ' : ''}
      {nota && <span>{nota}</span>}
    </div>
  );
}

interface IndicadorMeta {
  n: string;
  meta: string;
  v: string;
  w: string;
  bar: string;
  ok: boolean;
}

interface TopCategoriaItem {
  categoria: string;
  producto: string;
  unidades: number;
  estrellas: string;
  porcentaje: string;
}

export function IndicadoresView() {
  const [metas, setMetas] = useState<IndicadorMeta[]>([
    { n: 'Tiempo de entrega', meta: 'Meta: 13 min como máximo', v: '-', w: '0%', bar: 'var(--cp-soft)', ok: true },
    { n: 'Ventas de productos agotados', meta: 'Meta: cero', v: '-', w: '0%', bar: 'var(--cp-soft)', ok: true },
    { n: 'Platos con margen visible', meta: 'Meta: todos los platos con receta', v: '-', w: '0%', bar: 'var(--cp-soft)', ok: true },
    { n: 'Pedidos por carta o chatbot sin reingreso', meta: 'Meta: por definir con el cliente', v: '-', w: '0%', bar: 'var(--cp-soft)', ok: true },
    { n: 'Rotación de mesas', meta: 'Mesas atendidas por turno', v: '-', w: '0%', bar: 'var(--cp-soft)', ok: true },
    { n: 'Reclamos de delivery', meta: 'Meta: menos de 2 por semana', v: '-', w: '0%', bar: 'var(--cp-soft)', ok: true },
  ]);

  const [topActual, setTopActual] = useState<TopCategoriaItem[]>([]);
  const [topHistorial, setTopHistorial] = useState<{ mes: string; top: string[] }[]>([]);
  const [promocionesVendidas, setPromocionesVendidas] = useState<{ nombre: string; unidades: string; desc: string }[]>([]);
  const [productosDescontados, setProductosDescontados] = useState<{ nombre: string; unidades: string }[]>([]);

  const [estrellasActivadas, setEstrellasActivadas] = useState(true);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);

  const [categorias, setCategorias] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [reintento, setReintento] = useState(0);
  const { filtros, errorFechas, hoy, cambiar, limpiar, hayFiltros } = useFiltrosIndicadores();
  const periodo = textoPeriodo(filtros, hoy);

  const { desde, hasta, canal, modalidad, categoria } = filtros;
  useEffect(() => {
    if (errorFechas) return;
    let montado = true;
    setCargando(true);
    setError(false);
    const q = new URLSearchParams({ desde, hasta });
    if (canal) q.set('canal', canal);
    if (modalidad) q.set('modalidad', modalidad);
    if (categoria) q.set('categoria', categoria);
    api
      .get<any>(`/admin/informes/indicadores?${q.toString()}`)
      .then((res: any) => {
        if (montado && res) {
          if (res.categoriasDisponibles) setCategorias(res.categoriasDisponibles);
          if (res.metas) setMetas(res.metas);
          if (res.topActual) setTopActual(res.topActual);
          if (res.topHistorial) setTopHistorial(res.topHistorial);
          if (res.promocionesVendidas) setPromocionesVendidas(res.promocionesVendidas);
          if (res.productosDescontados) setProductosDescontados(res.productosDescontados);
        }
      })
      .catch(() => {
        if (montado) setError(true);
      })
      .finally(() => {
        if (montado) setCargando(false);
      });
    return () => {
      montado = false;
    };
  }, [desde, hasta, canal, modalidad, categoria, errorFechas, reintento]);

  const conmutarEstrellas = () => {
    setEstrellasActivadas(!estrellasActivadas);
    setConfirmarAbierto(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <BarraFiltrosIndicadores
        filtros={filtros}
        errorFechas={errorFechas}
        hoy={hoy}
        categorias={categorias}
        hayFiltros={hayFiltros}
        alCambiar={cambiar}
        alLimpiar={limpiar}
      />
      {error && <EstadoError mensaje="No pudimos cargar los indicadores. Revisa tu conexión e inténtalo de nuevo." alReintentar={() => setReintento((n) => n + 1)} />}
      {!error && cargando && <Cargando mensaje="Cargando indicadores" />}
      {/* Rejilla de Metas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {metas.map((g, idx) => (
          <div
            key={idx}
            style={{
              opacity: cargando ? 0.6 : 1,
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontWeight: 700 }}>{g.n}</div>
            <Sub periodo={APLICA_META[g.n]?.includes('periodo') ? periodo : undefined} nota={notaNoAplica(APLICA_META[g.n] ?? [], filtros)} />
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '26px', lineHeight: '32px' }}>
              {g.v}
            </div>
            <div style={{ height: '10px', borderRadius: '5px', background: 'var(--cp-sand)', overflow: 'hidden' }}>
              <div style={{ height: '10px', width: g.w, background: g.bar }} />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{g.meta}</div>
          </div>
        ))}
      </div>

      {/* Fila de 3 columnas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
        {/* Columna Izquierda: Más comprado del mes */}
        <div
          style={{
            flex: '2 1 380px',
            minWidth: '0px',
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
              Más comprado de cada categoría
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>Estrellas en la carta</span>
              <button
                type="button"
                onClick={() => setConfirmarAbierto(true)}
                style={{
                  minHeight: '44px',
                  padding: '0px 12px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background: estrellasActivadas ? 'var(--cp-navy)' : 'transparent',
                  color: estrellasActivadas ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {estrellasActivadas ? 'Activadas' : 'Apagadas'}
              </button>
            </span>
          </div>

          <Sub periodo={periodo} nota={notaNoAplica(APLICA_TOP, filtros)} />

          {topActual.length === 0 ? (
            <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '12px 0' }}>
              Sin productos registrados en este periodo.
            </div>
          ) : (
            topActual.map((t, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ minWidth: '150px', fontWeight: 700 }}>
                  {t.categoria} · {t.producto}
                </span>
                <div style={{ flex: '1 1 0%', height: '10px', borderRadius: '5px', background: 'var(--cp-sand)', overflow: 'hidden' }}>
                  <div style={{ height: '10px', width: t.porcentaje, background: 'var(--cp-orange)' }} />
                </div>
                <span style={{ minWidth: '60px', textAlign: 'right', fontSize: '13px' }}>
                  {t.unidades} u.
                </span>
                <span style={{ minWidth: '40px', color: 'var(--cp-rust)', fontWeight: 800 }}>
                  {t.estrellas}
                </span>
              </div>
            ))
          )}

          <div style={{ fontSize: '12px', lineHeight: '17px', color: 'var(--cp-soft)' }}>
            Cada categoría (frappes, iced, calientes, waffles, salados, complementos y combos) tiene su propio más comprado, con una estrella en la carta. Este cuadro sigue los filtros de arriba. El interruptor de estrellas en la carta no: siempre usa los más comprados del mes actual (el 1 de cada mes se reinicia solo y el mes que termina pasa al historial).
          </div>
        </div>

        {/* Columna Centro: Historial de más comprados */}
        <div
          style={{
            flex: '1 1 260px',
            minWidth: '0px',
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
            Historial de más comprados
          </div>
          <Sub nota={notaNoAplica([], filtros)} />
          <div style={estiloNota}>Historial mensual fijo.</div>
          {topHistorial.length === 0 ? (
            <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '12px 0' }}>
              Sin historial previo registrado.
            </div>
          ) : (
            topHistorial.map((h, idx) => (
              <div key={idx} style={{ borderTop: '1px solid var(--cp-sand)', paddingTop: '8px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>{h.mes}</div>
                {h.top.map((item, iIdx) => (
                  <div key={iIdx} style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                    {item}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Columna Derecha: Lo vendido hoy: promociones y productos */}
        <div
          style={{
            flex: '1 1 320px',
            minWidth: '0px',
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
            Promociones y productos vendidos
          </div>
          <Sub periodo={periodo} nota={notaNoAplica(APLICA_PROMOS, filtros)} />
          <div style={{ fontSize: '12px', lineHeight: '17px', color: 'var(--cp-soft)' }}>
            Cada promoción vendida se cuenta como promoción y, dentro de ella, se descuentan sus productos por separado (acta 02).
          </div>

          {promocionesVendidas.length === 0 ? (
            <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '8px 0' }}>
              No hay promociones vendidas en este periodo.
            </div>
          ) : (
            promocionesVendidas.map((p, idx) => (
              <div key={idx} style={{ borderTop: '1px solid var(--cp-sand)', paddingTop: '8px' }}>
                <div style={{ fontWeight: 800, fontSize: '13px' }}>
                  {p.nombre} · {p.unidades}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{p.desc}</div>
              </div>
            ))
          )}

          <div style={{ borderTop: '1px solid var(--cp-sand)', paddingTop: '8px', fontWeight: 800, fontSize: '13px' }}>
            Productos descontados por separado
          </div>
          {productosDescontados.length === 0 ? (
            <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '8px 0' }}>
              No hay productos descontados en este periodo.
            </div>
          ) : (
            productosDescontados.map((p, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>{p.nombre}</span>
                <span style={{ fontWeight: 700 }}>{p.unidades}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Encuestas posventa por WhatsApp */}
      <SeccionEncuestas
        filtros={{ desde, hasta, canal, modalidad, periodo, nota: notaNoAplica(APLICA_ENCUESTAS, filtros) }}
      />

      {/* Confirmación Sí/No */}
      <Confirmar
        abierto={confirmarAbierto}
        titulo={estrellasActivadas ? '¿Quitar las estrellas de la carta?' : '¿Mostrar las estrellas en la carta?'}
        mensaje={
          estrellasActivadas
            ? 'La carta dejará de marcar los más comprados del mes.'
            : 'La carta marcará con estrellas los más comprados del mes.'
        }
        textoConfirmar={estrellasActivadas ? 'Sí, quitar estrellas' : 'Sí, mostrar estrellas'}
        alConfirmar={conmutarEstrellas}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </div>
  );
}

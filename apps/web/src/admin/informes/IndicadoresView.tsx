import { useState, useEffect } from 'react';
import { api } from '../../comun/api';
import { Confirmar } from '../../comun/Confirmar';

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

  useEffect(() => {
    let montado = true;
    api
      .get<any>('/admin/informes/indicadores')
      .then((res: any) => {
        if (montado && res) {
          if (res.metas) setMetas(res.metas);
          if (res.topActual) setTopActual(res.topActual);
          if (res.topHistorial) setTopHistorial(res.topHistorial);
          if (res.promocionesVendidas) setPromocionesVendidas(res.promocionesVendidas);
          if (res.productosDescontados) setProductosDescontados(res.productosDescontados);
        }
      })
      .catch(() => {});
    return () => {
      montado = false;
    };
  }, []);

  const conmutarEstrellas = () => {
    setEstrellasActivadas(!estrellasActivadas);
    setConfirmarAbierto(false);
  };

  const hoy = new Date();
  const mesNombre = hoy.toLocaleDateString('es-PE', { month: 'long', timeZone: 'America/Lima' });
  const anioActual = hoy.toLocaleDateString('es-PE', { year: 'numeric', timeZone: 'America/Lima' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Rejilla de Metas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {metas.map((g, idx) => (
          <div
            key={idx}
            style={{
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
              Más comprado de cada categoría · {mesNombre} de {anioActual} (en curso)
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

          {topActual.length === 0 ? (
            <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '12px 0' }}>
              Sin productos registrados este mes.
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
            Cada categoría (frappes, iced, calientes, waffles, salados, complementos y combos) tiene su propio más comprado, con una estrella en la carta. Se calcula con las ventas del mes; el 1 de cada mes se reinicia solo y el mes que termina pasa al historial (datos de ejemplo).
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
            Lo vendido hoy: promociones y productos
          </div>
          <div style={{ fontSize: '12px', lineHeight: '17px', color: 'var(--cp-soft)' }}>
            Cada promoción vendida se cuenta como promoción y, dentro de ella, se descuentan sus productos por separado (acta 02). Acepta un pedido en Pedidos y caja para ver cómo suma. Datos de ejemplo.
          </div>

          {promocionesVendidas.length === 0 ? (
            <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '8px 0' }}>
              No hay promociones vendidas hoy.
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
              No hay productos descontados hoy.
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

import { useState, useMemo, useEffect } from 'react';
import { api } from '../../comun/api';
import { cortesiasApi } from '../cortesias/cortesiasApi';
import { filasInformeCortesias } from '../cortesias/informeCortesias';

interface ReporteItem {
  id: string;
  nombre: string;
  categoria: string;
  queResponde: string;
  filtrosTexto: string;
  exportaTexto: string;
  kpiClave: string;
  kpiValor: string;
  filasTotal: number;
  sinFecha?: boolean;
}

interface ReporteDetalleData {
  id: string;
  nombre: string;
  categoria: string;
  queResponde: string;
  periodoTexto: string;
  filtrosActivosTexto: string;
  kpis: { n: string; v: string }[];
  cols: string[];
  rows: (string | number)[][];
  nota?: string;
  sinFecha?: boolean;
}

const CATALOGO_INICIAL: ReporteItem[] = [
  { id: 'resumen', nombre: 'Resumen del día', categoria: 'Ventas', queResponde: 'Pedidos, ventas, ticket promedio y cuánto falta cobrar, por estado del pedido.', filtrosTexto: 'Fecha, local', exportaTexto: 'PDF · Excel', kpiClave: 'Ventas', kpiValor: '-', filasTotal: 0 },
  { id: 'dia', nombre: 'Ventas por día', categoria: 'Ventas', queResponde: 'Pedidos, ventas y ticket promedio de cada día del período, con el mejor y el peor día.', filtrosTexto: 'Fecha, canal, pago', exportaTexto: 'PDF · Excel', kpiClave: 'Días con ventas', kpiValor: '-', filasTotal: 0 },
  { id: 'producto', nombre: 'Ventas por producto', categoria: 'Ventas', queResponde: 'Unidades y monto estimado de cada plato, del más al menos vendido.', filtrosTexto: 'Fecha, categoría', exportaTexto: 'PDF · Excel', kpiClave: 'Productos distintos', kpiValor: '-', filasTotal: 0 },
  { id: 'categoria', nombre: 'Ventas por categoría', categoria: 'Ventas', queResponde: 'Qué categoría de la carta deja más: frappes, waffles, salados, postres…', filtrosTexto: 'Fecha', exportaTexto: 'PDF · Excel', kpiClave: 'Categorías', kpiValor: '-', filasTotal: 0 },
  { id: 'canal', nombre: 'Ventas por canal', categoria: 'Ventas', queResponde: 'Salón, mostrador, carta web y WhatsApp: pedidos, monto y ticket.', filtrosTexto: 'Fecha', exportaTexto: 'PDF · Excel', kpiClave: 'Ventas', kpiValor: '-', filasTotal: 0 },
  { id: 'modalidad', nombre: 'Ventas por modalidad', categoria: 'Ventas', queResponde: 'Cuánto se vende en el local, para llevar y por delivery.', filtrosTexto: 'Fecha', exportaTexto: 'PDF · Excel', kpiClave: 'Ventas', kpiValor: '-', filasTotal: 0 },
  { id: 'pago', nombre: 'Ventas por método de pago', categoria: 'Ventas', queResponde: 'Efectivo, Yape, Plin, transferencia y tarjeta: lo de hoy y lo de los últimos cierres.', filtrosTexto: 'Fecha', exportaTexto: 'PDF · Excel', kpiClave: 'Digital', kpiValor: '-', filasTotal: 0 },
  { id: 'rechazados', nombre: 'Pedidos rechazados', categoria: 'Ventas', queResponde: 'Pedidos que no se aceptaron o se anularon, con cliente y monto.', filtrosTexto: 'Fecha, canal', exportaTexto: 'PDF · Excel', kpiClave: 'Pedidos rechazados', kpiValor: '-', filasTotal: 0 },
  { id: 'cierres', nombre: 'Cierres de caja', categoria: 'Caja', queResponde: 'Cada cierre con sus ventas, lo esperado, lo contado y la diferencia.', filtrosTexto: 'Fecha, caja', exportaTexto: 'PDF', kpiClave: 'Cierres', kpiValor: '-', filasTotal: 0 },
  { id: 'medios', nombre: 'Caja por medio de pago', categoria: 'Caja', queResponde: 'Por día: efectivo, Yape, Plin, transferencia, tarjeta y otros lado a lado.', filtrosTexto: 'Fecha, caja', exportaTexto: 'PDF · Excel', kpiClave: 'Digital', kpiValor: '-', filasTotal: 0 },
  { id: 'arqueo', nombre: 'Arqueo y diferencias', categoria: 'Caja', queResponde: 'Solo los cierres donde faltó o sobró efectivo, con la explicación que dejó el cajero.', filtrosTexto: 'Fecha, caja', exportaTexto: 'PDF', kpiClave: 'Cierres con diferencia', kpiValor: '-', filasTotal: 0 },
  { id: 'cobrar', nombre: 'Pendiente de cobro', categoria: 'Caja', queResponde: 'Pedidos aceptados que todavía no se cobraron, con su método de pago.', filtrosTexto: 'Canal, estado', exportaTexto: 'PDF · Excel', kpiClave: 'Pedidos sin cobrar', kpiValor: '-', filasTotal: 0 },
  { id: 'cortesias', nombre: 'Cortesías', categoria: 'Ventas', queResponde: 'Lo regalado a costo 0: por motivo, por producto y por quién la dio, con su valor de lista.', filtrosTexto: 'Fecha', exportaTexto: 'Excel', kpiClave: 'Valor de lista regalado', kpiValor: '-', filasTotal: 0 },
  { id: 'stockbajo', nombre: 'Stock bajo', categoria: 'Inventario', queResponde: 'Insumos por debajo del mínimo: cuánto hay en almacén y cocina, y cuánto falta.', filtrosTexto: 'Almacén', exportaTexto: 'PDF · Excel', kpiClave: 'Insumos bajo el mínimo', kpiValor: '-', filasTotal: 0, sinFecha: true },
  { id: 'kardex', nombre: 'Kardex de insumos', categoria: 'Inventario', queResponde: 'Entradas, salidas y mermas más recientes, con origen y destino.', filtrosTexto: 'Fecha, insumo', exportaTexto: 'Excel', kpiClave: 'Movimientos', kpiValor: '-', filasTotal: 0 },
  { id: 'mermas', nombre: 'Mermas', categoria: 'Inventario', queResponde: 'Pérdidas por insumo y motivo.', filtrosTexto: 'Fecha', exportaTexto: 'Excel', kpiClave: 'Registros', kpiValor: '-', filasTotal: 0 },
  { id: 'produccion', nombre: 'Producción registrada', categoria: 'Inventario', queResponde: 'Lo que se produjo (donas, galletas, pan, gelatina) y de dónde salió la materia prima.', filtrosTexto: 'Fecha', exportaTexto: 'PDF · Excel', kpiClave: 'Movimientos', kpiValor: '-', filasTotal: 0 },
  { id: 'proveedor', nombre: 'Compras por proveedor', categoria: 'Compras', queResponde: 'Cuánto se compró a cada proveedor y cuánto sigue pendiente.', filtrosTexto: 'Fecha, proveedor', exportaTexto: 'PDF · Excel', kpiClave: 'Proveedores', kpiValor: '-', filasTotal: 0 },
  { id: 'comprasestado', nombre: 'Compras por estado y pago', categoria: 'Compras', queResponde: 'Recibidas, pendientes y anuladas; contado frente a crédito.', filtrosTexto: 'Fecha', exportaTexto: 'PDF · Excel', kpiClave: 'Compras', kpiValor: '-', filasTotal: 0 },
  { id: 'topclientes', nombre: 'Mejores clientes', categoria: 'Clientes', queResponde: 'Quién pide más y cuántos puntos acumula.', filtrosTexto: 'Tipo', exportaTexto: 'Excel', kpiClave: 'Clientes', kpiValor: '-', filasTotal: 0, sinFecha: true },
  { id: 'cumple', nombre: 'Próximos cumpleaños', categoria: 'Clientes', queResponde: 'Quién cumple años pronto, para saludarlo o darle un detalle.', filtrosTexto: 'Días por delante', exportaTexto: 'Excel', kpiClave: 'En los próximos 30 días', kpiValor: '-', filasTotal: 0, sinFecha: true },
  { id: 'creditos', nombre: 'Créditos del personal por mes', categoria: 'Clientes', queResponde: 'Lo consumido por cada trabajador, mes a mes, para descontarlo a fin de mes.', filtrosTexto: 'Trabajador, mes', exportaTexto: 'PDF · Excel', kpiClave: 'Trabajadores con consumo', kpiValor: '-', filasTotal: 0 },
  { id: 'repartidor', nombre: 'Delivery por repartidor', categoria: 'Delivery', queResponde: 'Pedidos y monto que lleva cada repartidor.', filtrosTexto: 'Fecha, repartidor', exportaTexto: 'PDF · Excel', kpiClave: 'Pedidos delivery', kpiValor: '-', filasTotal: 0 },
  { id: 'zonas', nombre: 'Delivery por zona', categoria: 'Delivery', queResponde: 'Pedidos a domicilio por barrio, para ver dónde conviene reforzar el reparto.', filtrosTexto: 'Fecha, zona', exportaTexto: 'PDF', kpiClave: 'Zonas con pedidos', kpiValor: '-', filasTotal: 0 },
];

function hoyEnLima(): Date {
  const d = new Date();
  const limaStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const [y, m, dia] = limaStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dia));
}

function formatearIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

const CATEGORIAS_FILTRO = ['Todas', 'Ventas', 'Caja', 'Inventario', 'Compras', 'Clientes', 'Delivery'];

export function InformesView() {
  const hoy = useMemo(() => hoyEnLima(), []);
  const ayer = useMemo(() => new Date(hoy.getTime() - 86400000), [hoy]);
  const hace6 = useMemo(() => new Date(hoy.getTime() - 6 * 86400000), [hoy]);

  const [preset, setPreset] = useState('7');
  const [desde, setDesde] = useState(() => formatearIso(hace6));
  const [hasta, setHasta] = useState(() => formatearIso(hoy));
  const [canal, setCanal] = useState('');
  const [pago, setPago] = useState('');
  const [modalidad, setModalidad] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [catSeleccionada, setCatSeleccionada] = useState('Todas');

  // Reporte abierto
  const [reporteAbiertoId, setReporteAbiertoId] = useState<string | null>(null);
  const [reporteDetalle, setReporteDetalle] = useState<ReporteDetalleData | null>(null);
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [mensajeExportacion, setMensajeExportacion] = useState('');

  // Catálogo
  const [catalogo, setCatalogo] = useState<ReporteItem[]>(CATALOGO_INICIAL);
  const [kpisPeriodo, setKpisPeriodo] = useState<{ n: string; v: string }[]>([
    { n: 'Pedidos', v: '0' },
    { n: 'Ventas', v: 's/ 0.00' },
    { n: 'Ticket promedio', v: 's/ 0.00' },
    { n: 'Por cobrar', v: 's/ 0.00' },
    { n: 'Rechazados', v: '0' },
  ]);

  useEffect(() => {
    let montado = true;
    api
      .get<ReporteItem[]>(`/admin/informes/catalogo?desde=${desde}&hasta=${hasta}&canal=${canal}&pago=${pago}&modalidad=${modalidad}`)
      .then((res: any) => {
        if (montado && Array.isArray(res) && res.length > 0) setCatalogo(res);
      })
      .catch(() => {});

    api
      .get<any>(`/admin/informes/resumen?desde=${desde}&hasta=${hasta}&canal=${canal}`)
      .then((res: any) => {
        if (montado && res && res.kpisS) {
          setKpisPeriodo([
            { n: 'Pedidos', v: res.kpisS[1]?.v || '0' },
            { n: 'Ventas', v: res.kpisS[0]?.v || 's/ 0.00' },
            { n: 'Ticket promedio', v: res.kpisS[2]?.v || 's/ 0.00' },
            { n: 'Por cobrar', v: 's/ 0.00' },
            { n: 'Rechazados', v: '0' },
          ]);
        }
      })
      .catch(() => {});

    return () => {
      montado = false;
    };
  }, [desde, hasta, canal, pago, modalidad]);

  // Carga de reporte detallado
  useEffect(() => {
    if (!reporteAbiertoId) {
      setReporteDetalle(null);
      setMensajeExportacion('');
      return;
    }
    setCargandoReporte(true);
    let montado = true;
    if (reporteAbiertoId === 'cortesias') {
      cortesiasApi
        .informe({ desde, hasta })
        .then((res) => {
          if (!montado) return;
          setReporteDetalle({
            id: 'cortesias',
            nombre: 'Cortesías',
            categoria: 'Ventas',
            queResponde: 'Lo regalado a costo 0: por motivo, por producto y por quién la dio, con su valor de lista.',
            periodoTexto: textoPeriodo,
            filtrosActivosTexto: textoFiltrosActivos,
            ...filasInformeCortesias(res),
          });
        })
        .catch((err: any) => {
          if (montado) setReporteDetalle(null);
          if (montado) setMensajeExportacion(err?.mensaje || 'No se pudo cargar el informe de cortesías.');
        })
        .finally(() => {
          if (montado) setCargandoReporte(false);
        });
      return () => {
        montado = false;
      };
    }
    api
      .get<ReporteDetalleData>(`/admin/informes/${reporteAbiertoId}?desde=${desde}&hasta=${hasta}&canal=${canal}&pago=${pago}&modalidad=${modalidad}`)
      .then((res: any) => {
        if (montado && res) setReporteDetalle(res);
      })
      .catch(() => {
        // En fallback creamos un detalle representativo si la API falló
        if (montado) {
          const item = catalogo.find((x) => x.id === reporteAbiertoId);
          if (item) {
            setReporteDetalle({
              id: item.id,
              nombre: item.nombre,
              categoria: item.categoria,
              queResponde: item.queResponde,
              periodoTexto: textoPeriodo,
              filtrosActivosTexto: textoFiltrosActivos,
              kpis: [
                { n: 'Pedidos', v: '0' },
                { n: 'Ventas', v: 's/ 0.00' },
                { n: 'Ticket promedio', v: 's/ 0.00' },
                { n: 'Por cobrar', v: 's/ 0.00' },
                { n: 'Rechazados', v: '0' },
              ],
              cols: ['Estado', 'Pedidos', 'Monto'],
              rows: [],
            });
          }
        }
      })
      .finally(() => {
        if (montado) setCargandoReporte(false);
      });

    return () => {
      montado = false;
    };
  }, [reporteAbiertoId, desde, hasta, canal, pago, modalidad]);

  const errorFechas = useMemo(() => {
    return desde && hasta && desde > hasta;
  }, [desde, hasta]);

  const textoPeriodo = useMemo(() => {
    if (errorFechas) return 'Revisa las fechas: «Desde» es posterior a «Hasta».';
    if (!desde && !hasta) return 'Todo el historial';
    const d1 = desde ? desde.split('-').reverse().join('/') : '';
    const d2 = hasta ? hasta.split('-').reverse().join('/') : '';
    if (desde && hasta) return `Del ${d1} al ${d2}`;
    if (desde) return `Desde el ${d1}`;
    return `Hasta el ${d2}`;
  }, [desde, hasta, errorFechas]);

  const filtrosActivosCount = useMemo(() => {
    return [canal, pago, modalidad].filter(Boolean).length;
  }, [canal, pago, modalidad]);

  const textoFiltrosActivos = useMemo(() => {
    if (filtrosActivosCount === 0) return 'Sin filtros de pedidos';
    return `${filtrosActivosCount} ${filtrosActivosCount === 1 ? 'filtro de pedidos activo' : 'filtros de pedidos activos'}`;
  }, [filtrosActivosCount]);

  const limpiarFiltros = () => {
    setPreset('7');
    setDesde(formatearIso(hace6));
    setHasta(formatearIso(hoy));
    setCanal('');
    setPago('');
    setModalidad('');
  };

  const aplicarPreset = (id: string, f1: string, f2: string) => {
    setPreset(id);
    setDesde(f1);
    setHasta(f2);
  };

  // Filtrado de reportes
  const reportesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return catalogo.filter((r) => {
      const coincideCat = catSeleccionada === 'Todas' || r.categoria === catSeleccionada;
      const coincideQ = !q || (r.nombre + ' ' + r.queResponde + ' ' + r.categoria).toLowerCase().includes(q);
      return coincideCat && coincideQ;
    });
  }, [catalogo, busqueda, catSeleccionada]);

  // Exportar reporte a Excel (CSV con BOM)
  const descargarExcel = () => {
    if (!reporteDetalle) return;
    try {
      const esc = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
      const lineas = [reporteDetalle.cols, ...reporteDetalle.rows].map((r) => r.map(esc).join(';')).join('\r\n');
      const blob = new Blob(['\uFEFF' + lineas], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reporteDetalle.id}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMensajeExportacion(`Se descargó ${reporteDetalle.id}.csv (se abre en Excel).`);
    } catch {
      setMensajeExportacion('En este prototipo la descarga es de ejemplo.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Texto explicativo superior */}
      <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
        Cada informe se arma con lo que hay en el sistema: pedidos, caja, almacén, compras y clientes. Elige el período y los filtros, y abre un informe para ver sus cifras y descargarlo.
      </div>

      {/* Caja PERÍODO Y FILTROS */}
      <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--cp-soft)' }}>
            PERÍODO Y FILTROS
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>
            {textoPeriodo} · {textoFiltrosActivos}
          </div>
        </div>

        {/* Presets y Fechas */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end' }}>
          {[
            ['hoy', 'Hoy', formatearIso(hoy), formatearIso(hoy)],
            ['ayer', 'Ayer', formatearIso(ayer), formatearIso(ayer)],
            ['7', 'Últimos 7 días', formatearIso(hace6), formatearIso(hoy)],
            ['todo', 'Todo', '', ''],
          ].map(([id, label, f1, f2]) => (
            <button
              key={id}
              type="button"
              onClick={() => aplicarPreset(id, f1, f2)}
              style={{
                minHeight: '44px',
                padding: '0px 14px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: preset === id ? 'var(--cp-navy)' : 'transparent',
                color: preset === id ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}

          <div style={{ flex: '1 1 140px', minWidth: '0px', maxWidth: '200px' }}>
            <label htmlFor="inf-d1" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Desde</label>
            <input
              id="inf-d1"
              type="date"
              value={desde}
              onChange={(e) => { setDesde(e.target.value); setPreset('custom'); }}
              style={{ width: '100%', boxSizing: 'border-box', minHeight: '44px', borderRadius: '10px', border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '0px 10px', fontSize: '13px' }}
            />
          </div>

          <div style={{ flex: '1 1 140px', minWidth: '0px', maxWidth: '200px' }}>
            <label htmlFor="inf-d2" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Hasta</label>
            <input
              id="inf-d2"
              type="date"
              value={hasta}
              onChange={(e) => { setHasta(e.target.value); setPreset('custom'); }}
              style={{ width: '100%', boxSizing: 'border-box', minHeight: '44px', borderRadius: '10px', border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '0px 10px', fontSize: '13px' }}
            />
          </div>
        </div>

        {errorFechas && (
          <div role="alert" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
            La fecha «Desde» es posterior a «Hasta». Corrige las fechas para ver los informes.
          </div>
        )}

        {/* Filtro Canal */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <span style={{ flex: '0 0 auto', minWidth: '104px', fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>Canal</span>
          {[
            ['', 'Todos'],
            ['Mozo', 'Mozo'],
            ['Caja', 'Caja'],
            ['Web', 'Web'],
            ['WhatsApp', 'WhatsApp'],
          ].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setCanal(val)}
              style={{
                minHeight: '40px',
                padding: '0px 12px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: canal === val ? 'var(--cp-navy)' : 'transparent',
                color: canal === val ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filtro Método de Pago */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <span style={{ flex: '0 0 auto', minWidth: '104px', fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>Método de pago</span>
          {[
            ['', 'Todos'],
            ['Efectivo', 'Efectivo'],
            ['Yape', 'Yape'],
            ['Plin', 'Plin'],
            ['Transferencia', 'Transferencia'],
            ['Tarjeta', 'Tarjeta'],
            ['Otros', 'Otros'],
          ].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setPago(val)}
              style={{
                minHeight: '40px',
                padding: '0px 12px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: pago === val ? 'var(--cp-navy)' : 'transparent',
                color: pago === val ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filtro Modalidad */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <span style={{ flex: '0 0 auto', minWidth: '104px', fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>Modalidad</span>
          {[
            ['', 'Todos'],
            ['local', 'En el local'],
            ['llevar', 'Para llevar'],
            ['delivery', 'Delivery'],
          ].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setModalidad(val)}
              style={{
                minHeight: '40px',
                padding: '0px 12px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: modalidad === val ? 'var(--cp-navy)' : 'transparent',
                color: modalidad === val ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Pie de filtros */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--cp-soft)', flex: '1 1 260px' }}>
            Las fechas aplican a ventas, caja, almacén, compras y créditos. Canal, pago y modalidad aplican a los informes de pedidos.
          </div>
          <button
            type="button"
            onClick={limpiarFiltros}
            style={{
              minHeight: '44px',
              padding: '0px 16px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '10px',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Tarjeta KPI EN EL PERÍODO */}
      <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '14px' }}>
        <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--cp-soft)', marginBottom: '8px' }}>
          EN EL PERÍODO
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          {kpisPeriodo.map((k, i) => (
            <div key={i} style={{ background: 'var(--cp-cream)', borderRadius: '12px', padding: '10px 12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>{k.n}</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '20px', overflowWrap: 'anywhere' }}>{k.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Buscador de informe */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <input
          id="inf-q"
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar informe"
          aria-label="Buscar informe"
          style={{
            flex: '1 1 220px',
            minWidth: '0px',
            minHeight: '48px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-line)',
            background: 'var(--cp-white)',
            padding: '0px 16px',
            fontFamily: 'inherit',
            fontSize: '14px',
            color: 'var(--cp-navy)',
            boxSizing: 'border-box',
          }}
        />
        <span style={{ fontSize: '12px', color: 'var(--cp-soft)', fontWeight: 700 }}>
          {reportesFiltrados.length} {reportesFiltrados.length === 1 ? 'informe' : 'informes'}
        </span>
      </div>

      {/* Chips de categorías */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {CATEGORIAS_FILTRO.map((c) => {
          const conteo = c === 'Todas' ? catalogo.length : catalogo.filter((d) => d.categoria === c).length;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCatSeleccionada(c)}
              style={{
                minHeight: '44px',
                padding: '0px 14px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: catSeleccionada === c ? 'var(--cp-navy)' : 'transparent',
                color: catSeleccionada === c ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {c} ({conteo})
            </button>
          );
        })}
      </div>

      {/* Mensaje de no resultados */}
      {reportesFiltrados.length === 0 && (
        <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '20px', textAlign: 'center', color: 'var(--cp-soft)' }}>
          Ningún informe coincide con tu búsqueda.
        </div>
      )}

      {/* Rejilla de tarjetas de informes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {reportesFiltrados.map((rep) => (
          <div
            key={rep.id}
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              minWidth: '0px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px', lineHeight: '20px', overflowWrap: 'anywhere' }}>
                {rep.nombre}
              </div>
              <span style={{ flex: '0 0 auto', padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 800, background: 'var(--cp-sand)', color: 'var(--cp-navy)' }}>
                {rep.categoria}
              </span>
            </div>

            <div style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--cp-soft)' }}>
              {rep.queResponde}
            </div>

            <div style={{ background: 'var(--cp-cream)', borderRadius: '10px', padding: '8px 10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cp-soft)' }}>{rep.kpiClave}</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '18px', overflowWrap: 'anywhere' }}>{rep.kpiValor}</div>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
              Filtros: {rep.filtrosTexto} · Exporta: {rep.exportaTexto} · {rep.filasTotal} {rep.filasTotal === 1 ? 'fila' : 'filas'}
            </div>

            <button
              type="button"
              onClick={() => setReporteAbiertoId(rep.id)}
              style={{
                minHeight: '44px',
                border: 0,
                borderRadius: '10px',
                background: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Abrir informe
            </button>
          </div>
        ))}
      </div>

      {/* Modal / Diálogo del Reporte Abierto */}
      {reporteAbiertoId && (
        <>
          <div
            onClick={() => setReporteAbiertoId(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              background: 'rgba(11, 44, 62, 0.55)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={reporteDetalle?.nombre || 'Informe'}
            style={{
              position: 'fixed',
              zIndex: 60,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(1000px, calc(100% - 24px))',
              maxHeight: 'calc(100% - 24px)',
              overflowY: 'auto',
              background: 'var(--cp-cream)',
              borderRadius: '20px',
              boxShadow: 'rgba(11, 44, 62, 0.4) 0px 20px 50px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxSizing: 'border-box',
            }}
          >
            {/* Cabecera del diálogo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <div>
                <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px', lineHeight: '27px' }}>
                  {reporteDetalle?.nombre} {cargandoReporte && <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--cp-soft)' }}>(cargando...)</span>}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                  {reporteDetalle?.categoria} · {reporteDetalle?.queResponde}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, margin: '4px 0 0' }}>
                  {reporteDetalle?.periodoTexto} · {reporteDetalle?.filtrosActivosTexto}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReporteAbiertoId(null)}
                aria-label="Cerrar"
                style={{
                  flex: '0 0 auto',
                  width: '44px',
                  height: '44px',
                  borderRadius: '22px',
                  border: '1.5px solid var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontSize: '20px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            {/* KPIs del reporte */}
            {reporteDetalle && reporteDetalle.kpis.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                {reporteDetalle.kpis.map((k, idx) => (
                  <div key={idx} style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>{k.n}</div>
                    <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '20px', overflowWrap: 'anywhere' }}>{k.v}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Tabla de resultados */}
            {reporteDetalle && (
              <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', overflowX: 'auto' }}>
                <div style={{ minWidth: `${Math.max(480, reporteDetalle.cols.length * 110)}px` }}>
                  {/* Encabezado */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${reporteDetalle.cols.length}, minmax(90px, 1fr))`,
                      gap: '8px',
                      padding: '10px 14px',
                      background: 'var(--cp-sand)',
                      fontSize: '12px',
                      fontWeight: 800,
                    }}
                  >
                    {reporteDetalle.cols.map((col, idx) => (
                      <span key={idx}>{col}</span>
                    ))}
                  </div>

                  {/* Filas */}
                  {reporteDetalle.rows.map((row, rIdx) => (
                    <div
                      key={rIdx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${reporteDetalle.cols.length}, minmax(90px, 1fr))`,
                        gap: '8px',
                        padding: '10px 14px',
                        borderTop: '1px solid var(--cp-sand)',
                        fontSize: '13px',
                        alignItems: 'center',
                      }}
                    >
                      {row.map((cell, cIdx) => (
                        <span key={cIdx} style={{ overflowWrap: 'anywhere' }}>
                          {cell}
                        </span>
                      ))}
                    </div>
                  ))}

                  {/* Estado vacío */}
                  {reporteDetalle.rows.length === 0 && (
                    <div style={{ padding: '18px', textAlign: 'center', color: 'var(--cp-soft)', fontSize: '13px' }}>
                      No hay datos para este informe con lo que hay registrado hoy.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notas opcionales */}
            {reporteDetalle?.sinFecha && (
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                Este informe es de hoy: no depende del período elegido.
              </div>
            )}
            {reporteDetalle?.nota && (
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                {reporteDetalle.nota}
              </div>
            )}

            {/* Mensaje de confirmación de descarga */}
            {mensajeExportacion && (
              <div role="status" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                {mensajeExportacion}
              </div>
            )}

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              <button
                type="button"
                onClick={descargarExcel}
                style={{
                  flex: '1 1 200px',
                  minHeight: '52px',
                  borderRadius: '12px',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '15px',
                  border: 0,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  cursor: 'pointer',
                }}
              >
                Descargar en Excel
              </button>
              <button
                type="button"
                onClick={() => setReporteAbiertoId(null)}
                style={{
                  flex: '1 1 120px',
                  minHeight: '52px',
                  borderRadius: '12px',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '15px',
                  border: '1.5px solid var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

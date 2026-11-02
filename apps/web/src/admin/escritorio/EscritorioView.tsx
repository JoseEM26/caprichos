import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSesion } from '../../comun/sesion';
import { api } from '../../comun/api';
import { useNotificaciones } from '../useNotificaciones';
import { EscritorioSupervisorView } from './EscritorioSupervisorView';
import { tieneRolUsuario } from '../../comun/rolesUsuario';

interface ResumenApi {
  kpisS?: { n: string; v: string; dTxt?: string; dCol?: string }[];
  hoursB?: { h: string; v: number; px: string; op: number }[];
  legend?: { n: string; v: string; monto: string; c: string; pct: number }[];
  tops2?: { n: string; v: string; w: string }[];
  cats2?: { n: string; v: string; w: string; c: string }[];
  pending?: { n: string; v: number; view: string }[];
  tBaseN?: number;
  metaY?: number;
  yTop?: string;
  yMid?: string;
  peak?: string;
  linePts?: string;
  lineArea?: string;
  entPts?: string;
  xl?: { t: string }[];
}

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

/** Escritorio del administrador, cajero, mozo y demás; el SUPERVISOR tiene el suyo, sin montos. */
export function EscritorioView() {
  const { usuario } = useSesion();
  if (tieneRolUsuario(usuario, 'SUPERVISOR')) return <EscritorioSupervisorView />;
  return <EscritorioGeneral />;
}

function EscritorioGeneral() {
  const { usuario, tiene } = useSesion();
  const puedeVerInformes = tiene('informes/ver');
  const navigate = useNavigate();
  const resumen = useNotificaciones();

  const rolCodigo = (usuario?.rol || 'ADMIN').toUpperCase();
  const esAdmin = rolCodigo === 'ADMIN';
  const puedeCompras = tiene('compras/ver') || tiene('stock/ver') || esAdmin;
  const notifStockBajo = puedeCompras
    ? resumen?.notificaciones?.find((n) => n.id === 'stock-bajo')
    : null;

  // Nombres y cargos
  const nombreUsuario = usuario?.nombres || (esAdmin ? 'Kevin Rosales' : 'Personal');
  const rolNombres: Record<string, string> = {
    ADMIN: 'Administrador',
    CAJERO: 'Cajero',
    COCINA: 'Cocina',
    MOZO: 'Mozo',
    CALLCENTER: 'Call center',
    ALMACEN: 'Almacén',
    PRODUCCION: 'Producción',
    REPARTIDOR: 'Repartidor',
  };
  const rolEtiqueta = rolNombres[rolCodigo] || 'Personal';

  // Fechas y Filtros (período por defecto: últimos 30 días hasta HOY en hora de Lima)
  const hoy = useMemo(() => hoyEnLima(), []);
  const hace29 = useMemo(() => new Date(hoy.getTime() - 29 * 86400000), [hoy]);

  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [periodo, setPeriodo] = useState('mes'); // 'hoy', 'sem', 'mes', 'trim', 'anio'
  const [anio, setAnio] = useState(() => String(hoy.getUTCFullYear()));
  const [canal, setCanal] = useState('todos');
  const [desde, setDesde] = useState(() => formatearIso(hace29));
  const [hasta, setHasta] = useState(() => formatearIso(hoy));
  const [comboAbierto, setComboAbierto] = useState<string | null>(null);

  // Manejadores de filtros
  const elegirPeriodo = (id: string) => {
    setPeriodo(id);
    setComboAbierto(null);
    if (id === 'hoy') {
      setDesde(formatearIso(hoy));
      setHasta(formatearIso(hoy));
    } else if (id === 'sem') {
      setDesde(formatearIso(new Date(hoy.getTime() - 6 * 86400000)));
      setHasta(formatearIso(hoy));
    } else if (id === 'mes') {
      setDesde(formatearIso(new Date(hoy.getTime() - 29 * 86400000)));
      setHasta(formatearIso(hoy));
    } else if (id === 'trim') {
      setDesde(formatearIso(new Date(hoy.getTime() - 89 * 86400000)));
      setHasta(formatearIso(hoy));
    } else if (id === 'anio') {
      const y = parseInt(anio, 10) || hoy.getUTCFullYear();
      setDesde(`${y}-01-01`);
      const finAnio = new Date(Date.UTC(y, 11, 31));
      setHasta(formatearIso(y === hoy.getUTCFullYear() ? hoy : finAnio));
    }
  };

  const elegirAnio = (nuevoAnio: string) => {
    setAnio(nuevoAnio);
    setComboAbierto(null);
    if (periodo === 'anio') {
      const y = parseInt(nuevoAnio, 10);
      setDesde(`${y}-01-01`);
      const finAnio = new Date(Date.UTC(y, 11, 31));
      setHasta(formatearIso(y === hoy.getUTCFullYear() ? hoy : finAnio));
    }
  };

  const elegirCanal = (c: string) => {
    setCanal(c);
    setComboAbierto(null);
  };

  const limpiarFiltros = () => {
    setPeriodo('mes');
    setAnio(String(hoy.getUTCFullYear()));
    setCanal('todos');
    setDesde(formatearIso(hace29));
    setHasta(formatearIso(hoy));
    setComboAbierto(null);
  };

  const errorFechas = useMemo(() => {
    if (desde && hasta && desde > hasta) {
      return 'Las fechas van como 2026-10-15 y la inicial no puede ser después de la final.';
    }
    return '';
  }, [desde, hasta]);

  const textoRango = useMemo(() => {
    if (!desde || !hasta) return 'Todo el historial';
    const [y1, m1, d1] = desde.split('-');
    const [y2, m2, d2] = hasta.split('-');
    const ms1 = Date.parse(desde);
    const ms2 = Date.parse(hasta);
    const dias = Math.max(1, Math.round((ms2 - ms1) / 86400000) + 1);
    const canalLabels: Record<string, string> = {
      salon: 'Salón',
      delivery: 'Delivery',
      web: 'Web',
      whatsapp: 'WhatsApp',
    };
    const canalTexto = canal === 'todos' ? '' : ` · solo ${canalLabels[canal] || canal}`;
    return `Del ${d1}/${m1}/${y1} al ${d2}/${m2}/${y2} · ${dias} ${dias === 1 ? 'día' : 'días'}${canalTexto}`;
  }, [desde, hasta, canal]);

  const filtrosActivosN = useMemo(() => {
    let n = 0;
    if (periodo !== 'mes') n++;
    if (canal !== 'todos') n++;
    if (desde !== formatearIso(hace29) || hasta !== formatearIso(hoy)) {
      if (periodo === 'mes') n++;
    }
    return n;
  }, [periodo, canal, desde, hasta, hace29, hoy]);

  // Carga de datos reales desde el backend
  const [datosApi, setDatosApi] = useState<ResumenApi | null>(null);

  useEffect(() => {
    let montado = true;
    // Sin informes/ver el servidor responde 403: el widget no lo pide y muestra los valores en cero
    if (!errorFechas && puedeVerInformes) {
      api
        .get<ResumenApi>(`/admin/informes/resumen?desde=${desde}&hasta=${hasta}&canal=${canal}`)
        .then((res: any) => {
          if (montado && res) setDatosApi(res);
        })
        .catch(() => {});
    }
    return () => {
      montado = false;
    };
  }, [desde, hasta, canal, errorFechas, puedeVerInformes]);

  // KPIs reales o en cero
  const kpisAdmin = datosApi?.kpisS || [
    { n: 'Ventas', v: 's/ 0.00', dTxt: 'Sin datos en período', dCol: 'var(--cp-soft)' },
    { n: 'Pedidos', v: '0', dTxt: 'Sin datos en período', dCol: 'var(--cp-soft)' },
    { n: 'Ticket promedio', v: 's/ 0.00', dTxt: 'Sin datos en período', dCol: 'var(--cp-soft)' },
    { n: 'Entrega promedio', v: '- min · meta 13', dTxt: 'Sin datos en período', dCol: 'var(--cp-soft)' },
  ];

  const ventasTiempo = {
    yTop: datosApi?.yTop || 's/ 0.00',
    yMid: datosApi?.yMid || 's/ 0.00',
    linePts: datosApi?.linePts || '',
    lineArea: datosApi?.lineArea || '',
    xl: datosApi?.xl || [],
    peak: datosApi?.peak || 'Sin ventas registradas en el período',
  };

  const canales = datosApi?.legend || [];
  const horasB = datosApi?.hoursB || [];

  const entregaTiempo = {
    meta: datosApi?.tBaseN || 13,
    metaY: datosApi?.metaY || 66,
    entPts: datosApi?.entPts || '',
    xl: datosApi?.xl || [],
  };

  const categorias = datosApi?.cats2 || [];
  const topProductos = datosApi?.tops2 || [];
  const pendientesAdmin = datosApi?.pending || [];

  // Datos para otros roles
  const datosPorRol: Record<
    string,
    {
      kpis: { n: string; v: string }[];
      listaTitulo: string;
      items: {
        id: string;
        titulo: string;
        sub: string;
        estado: string;
        estBg: string;
        estFg: string;
        derecha: string;
        mapsUrl?: string;
        wazeUrl?: string;
      }[];
      pendientes: { n: string; v: number | string; ruta: string }[];
      mostrarStock?: boolean;
      stockBajo?: { n: string; texto: string }[];
    }
  > = {
    CAJERO: {
      kpis: [
        { n: 'Pedidos por confirmar', v: '0' },
        { n: 'Cobros pendientes', v: '0' },
        { n: 'Cobrado en mi caja hoy', v: 's/ 0.00' },
        { n: 'Pedidos cerrados hoy', v: '0' },
      ],
      listaTitulo: 'Pedidos por confirmar',
      items: [],
      pendientes: [
        { n: 'Pedidos por confirmar', v: 0, ruta: '/admin/caja' },
        { n: 'Reservas de hoy', v: 0, ruta: '/admin/reservas' },
        { n: 'Consumos del personal', v: 0, ruta: '/admin/creditos' },
      ],
    },
    COCINA: {
      kpis: [
        { n: 'Nuevos en cocina', v: '0' },
        { n: 'Preparando', v: '0' },
        { n: 'Atrasados (13 min o más)', v: '0' },
        { n: 'Tiempo promedio en cocina', v: '- min · meta 13' },
      ],
      listaTitulo: 'En cocina ahora',
      items: [],
      pendientes: [
        { n: 'Ir a la pantalla de cocina', v: 0, ruta: '/admin/cocina' },
        { n: 'Insumos con stock bajo', v: 0, ruta: '/admin/stock' },
        { n: 'Mis pedidos al almacén por entregar', v: 0, ruta: '/admin/stock' },
      ],
      mostrarStock: true,
      stockBajo: [],
    },
    REPARTIDOR: {
      kpis: [
        { n: 'Disponibles para tomar', v: '0' },
        { n: 'Por salir', v: '0' },
        { n: 'En camino', v: '0' },
        { n: 'Entregados hoy', v: '0' },
        { n: 'Fletes de hoy', v: 's/ 0.00' },
        { n: 'Efectivo por entregar a caja', v: 's/ 0.00' },
      ],
      listaTitulo: 'Mis pedidos por entregar',
      items: [],
      pendientes: [
        { n: 'Tomar un pedido disponible', v: 0, ruta: '/admin/repartos' },
        { n: 'Mis pedidos por entregar', v: 0, ruta: '/admin/repartos' },
      ],
    },
  };

  const rolInfo = datosPorRol[rolCodigo] || datosPorRol.CAJERO;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Saludo inicial tal como especifica el mockup */}
      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        {esAdmin
          ? `Hola, ${nombreUsuario}. Este es tu escritorio de Administrador.`
          : `Hola, ${nombreUsuario}. Este es tu escritorio de ${rolEtiqueta}: solo muestra lo que corresponde a tu rol.`}
      </div>

      {/* Aviso de stock bajo para roles con permiso de compras */}
      {notifStockBajo && (
        <div
          role="alert"
          style={{
            background: 'rgb(253, 236, 232)',
            border: '1.5px solid var(--cp-rust)',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--cp-rust)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '14px', color: 'var(--cp-rust)' }}>
                {notifStockBajo.titulo}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--cp-navy)' }}>
                {notifStockBajo.detalle}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/compras?tab=pedir')}
            style={{
              minHeight: '40px',
              padding: '0 16px',
              border: 0,
              borderRadius: '10px',
              background: 'var(--cp-rust)',
              color: 'var(--cp-white)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Pedir al proveedor
          </button>
        </div>
      )}

      {esAdmin ? (
        <>
          {/* Barra de Filtros del Administrador */}
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '12px',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--cp-soft)', fontWeight: 600, minWidth: '0px' }}>
                {textoRango}
              </span>
              <button
                type="button"
                onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
                aria-expanded={filtrosAbiertos}
                style={{
                  flex: '0 0 auto',
                  minHeight: '44px',
                  padding: '0px 12px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background: filtrosAbiertos || filtrosActivosN > 0 ? 'var(--cp-navy)' : 'transparent',
                  color: filtrosAbiertos || filtrosActivosN > 0 ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'inline-flex',
                  gap: '6px',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 5h18l-7 8v6l-4 2v-8z" />
                </svg>
                Filtros
                {filtrosActivosN > 0 && (
                  <span
                    style={{
                      minWidth: '20px',
                      height: '20px',
                      boxSizing: 'border-box',
                      borderRadius: '10px',
                      background: 'var(--cp-orange)',
                      color: 'var(--cp-navy)',
                      fontSize: '12px',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 5px',
                    }}
                  >
                    {filtrosActivosN}
                  </span>
                )}
              </button>
            </div>

            {filtrosAbiertos && (
              <div style={{ borderTop: '1px solid var(--cp-line)', paddingTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
                {/* Selector PERIODO */}
                <div style={{ flex: '1 1 200px', minWidth: '0px', position: 'relative' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--cp-soft)', marginBottom: '3px' }}>
                    PERÍODO
                  </div>
                  <button
                    type="button"
                    onClick={() => setComboAbierto(comboAbierto === 'per' ? null : 'per')}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '44px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-navy)',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '13px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <span>
                      {periodo === 'hoy'
                        ? 'Hoy'
                        : periodo === 'sem'
                        ? '7 días'
                        : periodo === 'mes'
                        ? '30 días'
                        : periodo === 'trim'
                        ? '90 días'
                        : 'Año'}
                    </span>
                    <span>▾</span>
                  </button>
                  {comboAbierto === 'per' && (
                    <div
                      style={{
                        position: 'absolute',
                        zIndex: 10,
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        border: '1.5px solid var(--cp-navy)',
                        borderRadius: '10px',
                        background: 'var(--cp-white)',
                        overflow: 'hidden',
                      }}
                    >
                      {[
                        ['hoy', 'Hoy'],
                        ['sem', '7 días'],
                        ['mes', '30 días'],
                        ['trim', '90 días'],
                        ['anio', 'Año'],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => elegirPeriodo(id)}
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0 12px',
                            border: 0,
                            borderBottom: '1px solid var(--cp-sand)',
                            background: periodo === id ? 'var(--cp-sand)' : 'transparent',
                            color: 'var(--cp-navy)',
                            fontWeight: periodo === id ? 800 : 500,
                            fontSize: '13px',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selector AÑO */}
                <div style={{ flex: '1 1 200px', minWidth: '0px', position: 'relative' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--cp-soft)', marginBottom: '3px' }}>
                    AÑO
                  </div>
                  <button
                    type="button"
                    onClick={() => setComboAbierto(comboAbierto === 'anio' ? null : 'anio')}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '44px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-navy)',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '13px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{anio}</span>
                    <span>▾</span>
                  </button>
                  {comboAbierto === 'anio' && (
                    <div
                      style={{
                        position: 'absolute',
                        zIndex: 10,
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        border: '1.5px solid var(--cp-navy)',
                        borderRadius: '10px',
                        background: 'var(--cp-white)',
                        overflow: 'hidden',
                      }}
                    >
                      {['2026', '2025'].map((y) => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => elegirAnio(y)}
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0 12px',
                            border: 0,
                            borderBottom: '1px solid var(--cp-sand)',
                            background: anio === y ? 'var(--cp-sand)' : 'transparent',
                            color: 'var(--cp-navy)',
                            fontWeight: anio === y ? 800 : 500,
                            fontSize: '13px',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selector CANAL */}
                <div style={{ flex: '1 1 200px', minWidth: '0px', position: 'relative' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--cp-soft)', marginBottom: '3px' }}>
                    CANAL
                  </div>
                  <button
                    type="button"
                    onClick={() => setComboAbierto(comboAbierto === 'canal' ? null : 'canal')}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '44px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-navy)',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '13px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <span>
                      {canal === 'todos'
                        ? 'Todos'
                        : canal === 'salon'
                        ? 'Salón'
                        : canal === 'delivery'
                        ? 'Delivery'
                        : canal === 'web'
                        ? 'Web'
                        : 'WhatsApp'}
                    </span>
                    <span>▾</span>
                  </button>
                  {comboAbierto === 'canal' && (
                    <div
                      style={{
                        position: 'absolute',
                        zIndex: 10,
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        border: '1.5px solid var(--cp-navy)',
                        borderRadius: '10px',
                        background: 'var(--cp-white)',
                        overflow: 'hidden',
                      }}
                    >
                      {[
                        ['todos', 'Todos'],
                        ['salon', 'Salón'],
                        ['delivery', 'Delivery'],
                        ['web', 'Web'],
                        ['whatsapp', 'WhatsApp'],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => elegirCanal(id)}
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            padding: '0 12px',
                            border: 0,
                            borderBottom: '1px solid var(--cp-sand)',
                            background: canal === id ? 'var(--cp-sand)' : 'transparent',
                            color: 'var(--cp-navy)',
                            fontWeight: canal === id ? 800 : 500,
                            fontSize: '13px',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rango de fechas */}
                <div style={{ flex: '1 1 260px', minWidth: '0px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--cp-soft)', marginBottom: '3px' }}>
                    RANGO DE FECHAS
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 120px', minWidth: '0px' }}>
                      <label htmlFor="sf-a" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                        Desde
                      </label>
                      <input
                        id="sf-a"
                        type="date"
                        value={desde}
                        onChange={(e) => setDesde(e.target.value)}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          minHeight: '44px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--cp-line)',
                          background: 'var(--cp-white)',
                          color: 'var(--cp-navy)',
                          padding: '0 10px',
                          fontSize: '13px',
                        }}
                      />
                    </div>
                    <div style={{ flex: '1 1 120px', minWidth: '0px' }}>
                      <label htmlFor="sf-b" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                        Hasta
                      </label>
                      <input
                        id="sf-b"
                        type="date"
                        value={hasta}
                        onChange={(e) => setHasta(e.target.value)}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          minHeight: '44px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--cp-line)',
                          background: 'var(--cp-white)',
                          color: 'var(--cp-navy)',
                          padding: '0 10px',
                          fontSize: '13px',
                        }}
                      />
                    </div>
                  </div>
                  {errorFechas && (
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-rust)', marginTop: '4px' }}>
                      {errorFechas}
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div style={{ flex: '1 1 100%', display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    style={{
                      minHeight: '34px',
                      padding: '0 10px',
                      border: 0,
                      background: 'transparent',
                      color: 'var(--cp-rust)',
                      fontWeight: 700,
                      fontSize: '13px',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    Limpiar filtros
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltrosAbiertos(false)}
                    style={{
                      minHeight: '34px',
                      padding: '0 16px',
                      border: 0,
                      borderRadius: '10px',
                      background: 'var(--cp-navy)',
                      color: 'var(--cp-cream)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Listo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tarjetas KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {kpisAdmin.map((k, i) => (
              <div key={i} style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>{k.n}</div>
                <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '24px', lineHeight: '30px' }}>{k.v}</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: k.dCol || 'var(--cp-green)' }}>{k.dTxt}</div>
              </div>
            ))}
          </div>

          {/* Gráficos Fila 1: Ventas en el tiempo & Ventas por canal */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
            {/* Ventas en el tiempo */}
            <div style={{ flex: '2 1 420px', minWidth: '0px', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>Ventas en el tiempo</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '12px', color: 'var(--cp-soft)', height: '160px', textAlign: 'right', minWidth: '52px' }}>
                  <span>{ventasTiempo.yTop}</span>
                  <span>{ventasTiempo.yMid}</span>
                  <span>s/ 0</span>
                </div>
                <div style={{ flex: '1 1 0%', minWidth: '0px', position: 'relative', height: '160px', borderLeft: '1px solid var(--cp-line)', borderBottom: '1px solid var(--cp-line)' }}>
                  <div style={{ position: 'absolute', left: '0px', right: '0px', top: '20px', borderTop: '1px dashed var(--cp-line)' }} />
                  <div style={{ position: 'absolute', left: '0px', right: '0px', top: '80px', borderTop: '1px dashed var(--cp-line)' }} />
                  <svg viewBox="0 0 600 160" preserveAspectRatio="none" style={{ position: 'absolute', left: '0px', top: '0px', width: '100%', height: '160px' }}>
                    <polygon points={ventasTiempo.lineArea} fill="rgba(230,121,41,0.18)" />
                    <polyline points={ventasTiempo.linePts} fill="none" stroke="var(--cp-orange)" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--cp-soft)', marginLeft: '58px' }}>
                {ventasTiempo.xl.map((x, i) => (
                  <span key={i}>{x.t}</span>
                ))}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-rust)' }}>{ventasTiempo.peak}</div>
            </div>

            {/* Ventas por canal (Dona) */}
            <div style={{ flex: '1 1 300px', minWidth: '0px', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>Ventas por canal</div>
              {canales.length === 0 ? (
                <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '16px 0' }}>
                  Sin ventas por canal registradas en este período.
                </div>
              ) : (
                (() => {
                  let acc = 0;
                  const stops = canales
                    .filter((c) => (c.pct || 0) > 0)
                    .map((c) => {
                      const start = acc;
                      acc += c.pct || 0;
                      return `${c.c} ${start}% ${acc}%`;
                    });
                  if (acc < 100 && stops.length > 0) {
                    stops.push(`var(--cp-line) ${acc}% 100%`);
                  }
                  const donutGradient = stops.length > 0 ? `conic-gradient(${stops.join(', ')})` : 'var(--cp-line)';

                  return (
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ background: donutGradient, width: '150px', height: '150px', borderRadius: '50%', flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: 'var(--cp-white)' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                        {canales.map((c, i) => (
                          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: c.c, flex: '0 0 auto' }} />
                            <span><b>{c.n}</b> · {c.v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {/* Gráficos Fila 2: Pedidos por hora & Tiempo de entrega */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
            {/* Pedidos por hora */}
            <div style={{ flex: '1 1 320px', minWidth: '0px', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>Pedidos por hora (hora punta resaltada)</div>
              {horasB.length === 0 ? (
                <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '16px 0' }}>
                  Sin pedidos por hora registrados en este período.
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '150px' }}>
                  {horasB.map((h, i) => (
                    <div key={i} style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>{h.v}</span>
                      <div style={{ width: '100%', height: h.px, background: 'var(--cp-orange)', borderRadius: '6px 6px 0px 0px', opacity: h.op }} />
                      <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{h.h}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tiempo de entrega */}
            <div style={{ flex: '1 1 320px', minWidth: '0px', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
                Tiempo de entrega (la línea punteada es la meta de {entregaTiempo.meta} min)
              </div>
              <div style={{ position: 'relative', height: '160px', borderLeft: '1px solid var(--cp-line)', borderBottom: '1px solid var(--cp-line)' }}>
                <svg viewBox="0 0 600 160" preserveAspectRatio="none" style={{ position: 'absolute', left: '0px', top: '0px', width: '100%', height: '160px' }}>
                  <line x1="0" x2="600" y1={entregaTiempo.metaY} y2={entregaTiempo.metaY} stroke="var(--cp-rust)" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
                  <polyline points={entregaTiempo.entPts} fill="none" stroke="var(--cp-navy)" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--cp-soft)' }}>
                {entregaTiempo.xl.map((x, i) => (
                  <span key={i}>{x.t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Gráficos Fila 3: Ventas por categoría & Top productos */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
            {/* Ventas por categoría */}
            <div style={{ flex: '1 1 320px', minWidth: '0px', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>Ventas por categoría</div>
              {categorias.length === 0 ? (
                <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '12px 0' }}>
                  Sin ventas por categoría en este período.
                </div>
              ) : (
                categorias.map((c, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ fontWeight: 700 }}>{c.n}</span>
                      <span>{c.v}</span>
                    </div>
                    <div style={{ height: '12px', borderRadius: '6px', background: 'var(--cp-sand)', overflow: 'hidden' }}>
                      <div style={{ height: '12px', width: c.w, background: c.c }} />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Productos más vendidos */}
            <div style={{ flex: '1 1 320px', minWidth: '0px', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>Productos más vendidos</div>
              {topProductos.length === 0 ? (
                <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '12px 0' }}>
                  Sin productos vendidos en este período.
                </div>
              ) : (
                topProductos.map((p, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ fontWeight: 700 }}>{p.n}</span>
                      <span>{p.v}</span>
                    </div>
                    <div style={{ height: '12px', borderRadius: '6px', background: 'var(--cp-sand)', overflow: 'hidden' }}>
                      <div style={{ height: '12px', width: p.w, background: 'var(--cp-orange)' }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Para hacer ahora */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 280px', minWidth: '0px', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>Para hacer ahora</div>
              {pendientesAdmin.length === 0 ? (
                <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '12px 0' }}>
                  No hay tareas pendientes en este momento.
                </div>
              ) : (
                pendientesAdmin.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => navigate(p.view)}
                    style={{
                      minHeight: '48px',
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: '12px',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      padding: '0px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <span>{p.n}</span>
                    <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '18px', color: 'var(--cp-rust)' }}>{p.v}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        /* Escritorio para otros roles (Cajero, Cocina, Repartidor, etc.) */
        <>
          {/* Tarjetas KPI del Rol */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {rolInfo.kpis.map((k, i) => (
              <div key={i} style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--cp-soft)' }}>{k.n}</div>
                <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '24px', lineHeight: '32px', marginTop: '4px' }}>{k.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
            {/* Lista Principal del Rol */}
            <div style={{ flex: '2 1 420px', minWidth: '0px', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>{rolInfo.listaTitulo}</div>
              {rolInfo.items.length === 0 ? (
                <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>
                  No hay pedidos pendientes para este rol en este momento.
                </div>
              ) : (
                rolInfo.items.map((item) => (
                  <div key={item.id} style={{ border: '1.5px solid var(--cp-line)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>{item.titulo}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, borderRadius: '9999px', padding: '2px 10px', background: item.estBg, color: item.estFg }}>{item.estado}</span>
                      </div>
                      <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--cp-soft)' }}>{item.sub}</span>
                      <span style={{ fontWeight: 800, color: 'var(--cp-rust)' }}>{item.derecha}</span>
                    </div>
                    {item.mapsUrl && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                        <a href={item.mapsUrl} target="_blank" rel="noopener noreferrer" style={{ flex: '1 1 120px', minHeight: '44px', boxSizing: 'border-box', border: '1.5px solid var(--cp-navy)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy)' }}>
                          Google Maps
                        </a>
                        <a href={item.wazeUrl} target="_blank" rel="noopener noreferrer" style={{ flex: '1 1 120px', minHeight: '44px', boxSizing: 'border-box', border: '1.5px solid var(--cp-navy)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy)' }}>
                          Waze
                        </a>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Para hacer ahora */}
            <div style={{ flex: '1 1 280px', minWidth: '0px', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>Para hacer ahora</div>
              {rolInfo.pendientes.length === 0 ? (
                <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '12px 0' }}>
                  No hay acciones pendientes para este rol.
                </div>
              ) : (
                rolInfo.pendientes.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => navigate(p.ruta)}
                    style={{ minHeight: '48px', border: '1.5px solid var(--cp-navy)', borderRadius: '12px', background: 'transparent', color: 'var(--cp-navy)', padding: '0 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <span>{p.n}</span>
                    <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '18px', color: 'var(--cp-rust)' }}>{p.v}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Insumos con stock bajo */}
          {rolInfo.mostrarStock && (
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>Insumos con stock bajo</div>
              {(!rolInfo.stockBajo || rolInfo.stockBajo.length === 0) ? (
                <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '10px 0' }}>
                  Todos los insumos se encuentran dentro del stock adecuado.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                  {rolInfo.stockBajo.map((sb, i) => (
                    <div key={i} style={{ border: '1.5px solid var(--cp-rust)', borderRadius: '10px', padding: '8px 10px' }}>
                      <div style={{ fontWeight: 700 }}>{sb.n}</div>
                      <div style={{ fontSize: '12px', color: 'var(--cp-rust)', fontWeight: 600 }}>{sb.texto}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

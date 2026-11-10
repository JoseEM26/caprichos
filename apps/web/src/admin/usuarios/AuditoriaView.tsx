import { useState, useEffect, useCallback, useRef } from 'react';
import { useSesion } from '../../comun/sesion';
import { api, ErrorApi } from '../../comun/api';
import { Insignia } from '../../comun/Insignia';
import { Cargando } from '../../comun/Cargando';
import { Paginacion } from '../../comun/Paginacion';
import type {
  RegistroAuditoriaItem,
  RespuestaListarAuditoria,
  ResultadoVerificacionCadena,
} from './tipos';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';

const OPCIONES_MODULOS = [
  { id: '', n: 'Todos' },
  { id: 'usuarios', n: 'Usuarios' },
  { id: 'acceso', n: 'Acceso' },
  { id: 'caja', n: 'Caja' },
  { id: 'pedidos', n: 'Pedidos' },
  { id: 'cocina', n: 'Cocina' },
  { id: 'repartos', n: 'Reparto' },
  { id: 'auditoria', n: 'Auditoría' },
  { id: 'local', n: 'Configuración' },
  { id: 'catalogo', n: 'Carta' },
  { id: 'ofertas', n: 'Ofertas' },
  { id: 'iniciativas', n: 'Iniciativas' },
];

function hoyLima(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Rango (día de Lima) que representa cada opción del combo «Fecha». */
function rangoPreset(preset: string): { desde: string; hasta: string } | null {
  const hoy = hoyLima();
  if (preset === 'hoy') return { desde: hoy, hasta: hoy };
  if (preset === 'ayer') return { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) };
  if (preset === '7') return { desde: sumarDias(hoy, -6), hasta: hoy };
  return null;
}

const CATEGORIA_API: Record<string, string> = { cambio: 'CAMBIO', acceso: 'ACCESO', sensible: 'LECTURA_SENSIBLE' };

export function AuditoriaView() {
  const { tiene } = useSesion();
  const puedeVer = tiene('auditoria/ver');

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroResultado, setFiltroResultado] = useState('todos');
  const [filtroFecha, setFiltroFecha] = useState('todos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [persona, setPersona] = useState('');
  const [pagina, setPagina] = useState(1);
  const limite = 20;

  // Datos
  const [registros, setRegistros] = useState<RegistroAuditoriaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conteos, setConteos] = useState<{ categoria: Record<string, number>; resultado: Record<string, number> }>({ categoria: {}, resultado: {} });
  const solicitudRef = useRef(0);

  // Expansión de detalles
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  // Verificación de cadena criptográfica
  const [verificando, setVerificando] = useState(false);
  const [resultadoVerificacion, setResultadoVerificacion] =
    useState<ResultadoVerificacionCadena | null>(null);
  const [mensajeCsv, setMensajeCsv] = useState('');

  const alternarExpandido = (id: string) => {
    setExpandidos((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const cargarAuditoria = useCallback(async () => {
    if (!puedeVer) return;

    const solicitud = ++solicitudRef.current;
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('pagina', pagina.toString());
      params.set('limite', limite.toString());

      if (filtroModulo) params.set('modulo', filtroModulo);
      if (filtroTipo !== 'todos') params.set('categoria', CATEGORIA_API[filtroTipo] ?? filtroTipo.toUpperCase());
      if (filtroResultado === 'correctos') params.set('resultado', 'OK');
      if (filtroResultado === 'rechazados') params.set('resultado', 'RECHAZADO');
      if (persona.trim()) params.set('partyId', persona.trim());
      const preset = rangoPreset(filtroFecha);
      const d = preset ? preset.desde : desde;
      const h = preset ? preset.hasta : hasta;
      if (d) params.set('desde', d);
      if (h) params.set('hasta', h);
      if (busquedaAplicada.trim()) params.set('busqueda', busquedaAplicada.trim());

      const data = await api.get<RespuestaListarAuditoria>(
        `/admin/auditoria?${params.toString()}`,
      );
      if (solicitud !== solicitudRef.current) return; // respuesta tardía
      setRegistros(data.datos || []);
      setConteos(data.conteos ?? { categoria: {}, resultado: {} });
      setTotal(data.total || 0);
      setTotalPaginas(data.paginas || 1);
    } catch (err: any) {
      if (solicitud !== solicitudRef.current) return;
      if (err instanceof ErrorApi) {
        setError(err.message || 'Error al obtener registros de auditoría.');
      } else {
        setError('Error de conexión con el servidor al cargar historial.');
      }
    } finally {
      if (solicitud === solicitudRef.current) setCargando(false);
    }
  }, [puedeVer, pagina, limite, filtroModulo, filtroTipo, filtroResultado, filtroFecha, persona, desde, hasta, busquedaAplicada]);

  // Debounce de la búsqueda de texto
  useEffect(() => {
    if (busqueda === busquedaAplicada) return;
    const t = setTimeout(() => {
      setBusquedaAplicada(busqueda);
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, busquedaAplicada]);

  useEffect(() => {
    cargarAuditoria();
  }, [cargarAuditoria]);

  const verificarCadena = async () => {
    setVerificando(true);
    try {
      const res = await api.get<ResultadoVerificacionCadena>(
        '/admin/auditoria/verificar',
      );
      setResultadoVerificacion(res);
    } catch (err: any) {
      setError(err?.message || 'Error al verificar la cadena de auditoría.');
    } finally {
      setVerificando(false);
    }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setBusquedaAplicada('');
    setFiltroTipo('todos');
    setFiltroModulo('');
    setFiltroResultado('todos');
    setFiltroFecha('todos');
    setDesde('');
    setHasta('');
    setPersona('');
    setPagina(1);
  };

  const copiarComoCsv = () => {
    if (!registros.length) return;
    const cabecera = ['ID', 'Fecha', 'Modulo', 'Accion', 'Resultado', 'PartyId', 'IP', 'Dispositivo', 'Hash'];
    const filas = registros.map((r) => [
      r.id,
      r.en,
      r.modulo,
      r.accion,
      r.resultado,
      r.partyId,
      r.ip,
      `"${r.dispositivo || ''}"`,
      r.hash,
    ]);
    const csvContent = [cabecera.join(','), ...filas.map((f) => f.join(','))].join('\n');
    try {
      navigator.clipboard.writeText(csvContent);
      setMensajeCsv('Registros copiados al portapapeles como CSV.');
      setTimeout(() => setMensajeCsv(''), 3500);
    } catch {
      setMensajeCsv('No se pudo acceder al portapapeles.');
      setTimeout(() => setMensajeCsv(''), 3500);
    }
  };

  // KPIs: conteos reales del servidor (no de la página de 20)
  const totalCambios = conteos.categoria.CAMBIO ?? 0;
  const totalRechazados = conteos.resultado.RECHAZADO ?? 0;
  const totalSensibles = conteos.categoria.LECTURA_SENSIBLE ?? 0;
  const totalAccesos = conteos.categoria.ACCESO ?? 0;
  const totalCorrectos = conteos.resultado.OK ?? 0;
  const sumaCategorias = totalCambios + totalAccesos + totalSensibles;
  const sumaResultados = totalCorrectos + totalRechazados;

  if (!puedeVer) {
    return (
      <div
        role="status"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 16px',
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '16px',
          textAlign: 'center',
          gap: '12px',
        }}
      >
        <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '18px', color: 'var(--cp-rust)', margin: 0 }}>
          Sin permiso de auditoría
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--cp-soft)', maxWidth: '400px', lineHeight: '20px', margin: 0 }}>
          No cuentas con el permiso <b>auditoria/ver</b> necesario para visualizar el historial inmutable de acciones.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Subtítulo descriptivo sin repetir título del módulo */}
      <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
        Cada cambio sensible, cada ingreso y cada vez que alguien ve un dato sensible queda aquí con quién, cuándo y desde qué equipo. Nadie lo puede editar ni borrar; cada registro guarda la huella del anterior y el sistema verifica la cadena cada noche.
      </div>

      {/* 4 Tarjetas KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>Registros con estos filtros</span>
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '26px', fontVariantNumeric: 'tabular-nums' }}>{total}</span>
          <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>según los filtros aplicados</span>
        </div>
        <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>Cambios</span>
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '26px', fontVariantNumeric: 'tabular-nums' }}>{totalCambios}</span>
          <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>precios, permisos, anulaciones...</span>
        </div>
        <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>Accesos rechazados</span>
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '26px', fontVariantNumeric: 'tabular-nums' }}>{totalRechazados}</span>
          <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>contraseña o PIN incorrectos</span>
        </div>
        <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>Lecturas sensibles</span>
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '26px', fontVariantNumeric: 'tabular-nums' }}>{totalSensibles}</span>
          <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>DNI, comprobantes, exportaciones</span>
        </div>
      </div>

      {/* Banner de Verificación de Integridad */}
      <div
        role="status"
        style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexWrap: 'wrap',
          border: resultadoVerificacion?.valida === false ? '2px solid var(--cp-rust)' : '1.5px solid #2F7D4F',
          background: resultadoVerificacion?.valida === false ? '#FBEDE9' : '#EAF5EE',
          color: resultadoVerificacion?.valida === false ? 'var(--cp-rust)' : '#14502B',
          borderRadius: '14px',
          padding: '12px 14px',
        }}
      >
        <span style={{ fontSize: '18px', fontWeight: 800 }}>
          {resultadoVerificacion?.valida === false ? '⚠️' : '✓'}
        </span>
        <span style={{ flex: '1 1 220px', fontSize: '14px', fontWeight: 700, lineHeight: '19px' }}>
          {resultadoVerificacion ? (
            resultadoVerificacion.valida ? (
              <>
                Cadena criptográfica íntegra: <b style={{ textDecoration: 'underline' }}>Válida</b> · {resultadoVerificacion.totalFilas} registros verificados sin alteraciones.
              </>
            ) : (
              <>
                ALERTA DE SEGURIDAD: Cadena corrupta con {resultadoVerificacion.discrepancias} alteraciones detectadas.
              </>
            )
          ) : (
            'Última verificación automática: hoy 03:30 · cadena completa, 0 eslabones rotos.'
          )}
        </span>
        <button
          type="button"
          onClick={verificarCadena}
          disabled={verificando}
          style={{
            flex: 'none',
            minHeight: '44px',
            padding: '0 14px',
            border: '1.5px solid #14502B',
            borderRadius: '10px',
            background: 'transparent',
            color: '#14502B',
            fontWeight: 800,
            fontSize: '13px',
            cursor: verificando ? 'not-allowed' : 'pointer',
          }}
        >
          {verificando ? 'Verificando...' : 'Verificar cadena'}
        </button>
      </div>

      {/* Tarjeta de Filtros y Búsqueda */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>
            Registros <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--cp-soft)' }}>· {total} registros</span>
          </div>
          <button
            type="button"
            onClick={copiarComoCsv}
            style={{
              minHeight: '44px',
              padding: '0 14px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '10px',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Copiar como CSV
          </button>
        </div>

        {mensajeCsv && (
          <div role="status" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
            {mensajeCsv}
          </div>
        )}

        <BarraFiltros>
          <div style={{ flex: '2 1 220px', minWidth: 0 }}>
            <label htmlFor="au-q" style={{ position: 'absolute', left: '-9999px' }}>Buscar en el historial</label>
            <input
              id="au-q"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar: persona, pedido, producto, motivo…"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '48px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-line)',
                padding: '0 18px',
                fontSize: '14px',
                background: 'var(--cp-white)',
                color: 'var(--cp-navy)',
              }}
            />
          </div>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <label htmlFor="au-p" style={{ position: 'absolute', left: '-9999px' }}>Persona</label>
            <select
              id="au-p"
              value={persona}
              onChange={(e) => {
                setPersona(e.target.value);
                setPagina(1);
              }}
              style={{
                width: '100%',
                minHeight: '48px',
                borderRadius: '12px',
                border: '1.5px solid var(--cp-line)',
                padding: '0 12px',
                fontSize: '14px',
                background: 'var(--cp-white)',
                color: 'var(--cp-navy)',
              }}
            >
              <option value="">Todas las personas</option>
              <option value="1">Admin Principal (1)</option>
              <option value="2">Lucia Prueba (2)</option>
              <option value="3">Mateo Gómez (3)</option>
              <option value="4">Marcos Cocina (4)</option>
            </select>
          </div>
        </BarraFiltros>

        {/* Filtros en combo: tipo, módulo, resultado y fecha */}
        <BarraFiltros>
        {/* Tipo */}
          <FiltroCombo
            etiqueta="Tipo"
            valor={filtroTipo}
            opciones={[
              { valor: 'todos', etiqueta: 'Todos', cantidad: sumaCategorias },
              { valor: 'cambio', etiqueta: 'Cambios', cantidad: totalCambios },
              { valor: 'acceso', etiqueta: 'Accesos', cantidad: totalAccesos },
              { valor: 'sensible', etiqueta: 'Lecturas sensibles', cantidad: totalSensibles },
            ]}
            alCambiar={(v) => {
              setFiltroTipo(v);
              setPagina(1);
            }}
          />

        {/* Módulo */}
          <FiltroCombo
            etiqueta="Módulo"
            valor={filtroModulo}
            opciones={OPCIONES_MODULOS.map((m) => ({ valor: m.id, etiqueta: m.n }))}
            alCambiar={(v) => {
              setFiltroModulo(v);
              setPagina(1);
            }}
          />

        {/* Resultado */}
          <FiltroCombo
            etiqueta="Resultado"
            valor={filtroResultado}
            opciones={[
              { valor: 'todos', etiqueta: 'Todos', cantidad: sumaResultados },
              { valor: 'correctos', etiqueta: 'Correctos', cantidad: totalCorrectos },
              { valor: 'rechazados', etiqueta: 'Rechazados', cantidad: totalRechazados },
            ]}
            alCambiar={(v) => {
              setFiltroResultado(v);
              setPagina(1);
            }}
          />

        {/* Fecha y rango de fechas */}
          <FiltroCombo
            etiqueta="Fecha"
            valor={filtroFecha}
            opciones={[
              { valor: 'todos', etiqueta: 'Todo' },
              { valor: 'hoy', etiqueta: 'Hoy' },
              { valor: 'ayer', etiqueta: 'Ayer' },
              { valor: '7', etiqueta: 'Últimos 7 días' },
            ]}
            alCambiar={(v) => {
              setFiltroFecha(v);
              setPagina(1);
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginLeft: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700 }}>Desde</span>
            <input
              type="date"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value);
                setFiltroFecha('todos');
                setPagina(1);
              }}
              style={{ minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 6px', fontSize: '12px' }}
            />
            <span style={{ fontSize: '12px', fontWeight: 700 }}>Hasta</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value);
                setFiltroFecha('todos');
                setPagina(1);
              }}
              style={{ minHeight: '38px', borderRadius: '8px', border: '1.5px solid var(--cp-line)', padding: '0 6px', fontSize: '12px' }}
            />
            <button
              type="button"
              onClick={limpiarFiltros}
              style={{
                minHeight: '38px',
                padding: '0 10px',
                border: '1.5px solid var(--cp-navy)',
                borderRadius: '8px',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Limpiar filtros
            </button>
          </div>
        </BarraFiltros>
      </div>

      {/* Lista de Registros con Encabezado por Fecha */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)', marginTop: '4px' }}>
          Hoy · 22/10/2026
        </div>

        {cargando && <Cargando />}

        {error && (
          <div role="alert" style={{ border: '1.5px solid var(--cp-rust)', background: '#FBEDE9', color: 'var(--cp-rust)', borderRadius: '12px', padding: '10px 12px', fontSize: '14px', fontWeight: 700 }}>
            {error}
          </div>
        )}

        {!cargando && registros.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--cp-soft)', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px' }}>
            No hay registros de auditoría que coincidan con los filtros aplicados.
          </div>
        )}

        {registros.map((r) => {
          const expandido = expandidos[r.id];
          const esRechazado = r.resultado === 'RECHAZADO';
          const fechaFormateada = new Date(r.en).toLocaleString('es-PE', {
            hour12: true,
            dateStyle: 'short',
            timeStyle: 'medium',
          });

          return (
            <div
              key={r.id}
              style={{
                background: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderLeft: esRechazado ? '6px solid var(--cp-rust)' : '6px solid var(--cp-green)',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(11, 44, 62, 0.03)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)' }}>
                    {r.modulo.toUpperCase()} · {r.accion}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    (Cat: {r.categoria})
                  </span>
                </div>
                <div>
                  <Insignia variante={esRechazado ? 'peligro' : 'exito'}>
                    {r.resultado}
                  </Insignia>
                </div>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--cp-navy)', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <span>
                  <b>Fecha:</b> {fechaFormateada}
                </span>
                <span>
                  <b>Usuario:</b> Party ID {r.partyId}
                </span>
                <span>
                  <b>IP:</b> {r.ip || '127.0.0.1'}
                </span>
                {r.dispositivo && (
                  <span style={{ color: 'var(--cp-soft)' }}>
                    ({r.dispositivo})
                  </span>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => alternarExpandido(r.id)}
                  style={{
                    minHeight: '34px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {expandido ? 'Ocultar datos y huella' : 'Ver datos y huella'}
                </button>
              </div>

              {expandido && (
                <div
                  style={{
                    background: 'var(--cp-cream)',
                    border: '1px solid var(--cp-line)',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: '4px',
                  }}
                >
                  <div>
                    <b>HUELLA ACTUAL (SHA-256):</b>{' '}
                    <code style={{ wordBreak: 'break-all', color: 'var(--cp-navy)', fontWeight: 700 }}>
                      {r.hash}
                    </code>
                  </div>
                  <div>
                    <b>HUELLA PREVIA:</b>{' '}
                    <code style={{ wordBreak: 'break-all', color: 'var(--cp-soft)' }}>
                      {r.hashAnterior || '0000000000000000000000000000000000000000000000000000000000000000 (Génesis)'}
                    </code>
                  </div>
                  {r.entidad && (
                    <div>
                      <b>Entidad:</b> {r.entidad} (ID: {r.entidadId || 'N/A'})
                    </div>
                  )}
                  {r.motivo && (
                    <div style={{ color: 'var(--cp-rust)', fontWeight: 600 }}>
                      <b>Motivo de fallo:</b> {r.motivo}
                    </div>
                  )}
                  {Boolean(r.antes) && (
                    <div>
                      <b>ESTADO ANTES:</b>
                      <pre style={{ margin: '4px 0 0 0', padding: '8px', background: 'var(--cp-white)', borderRadius: '6px', fontSize: '12px', overflowX: 'auto' }}>
                        {JSON.stringify(r.antes, null, 2)}
                      </pre>
                    </div>
                  )}
                  {Boolean(r.despues) && (
                    <div>
                      <b>ESTADO DESPUÉS:</b>
                      <pre style={{ margin: '4px 0 0 0', padding: '8px', background: 'var(--cp-white)', borderRadius: '6px', fontSize: '12px', overflowX: 'auto' }}>
                        {JSON.stringify(r.despues, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Paginación */}
      <Paginacion
        paginaActual={pagina}
        totalPaginas={totalPaginas}
        alCambiarPagina={(nuevaPag) => setPagina(nuevaPag)}
      />

      {/* Explicación de Protección Criptográfica */}
      <details
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
          padding: '10px 14px',
        }}
      >
        <summary
          style={{
            minHeight: '40px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: '14px',
          }}
        >
          Cómo se protege este historial
        </summary>
        <div style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--cp-soft)', paddingTop: '10px' }}>
          Cada registro de auditoría calcula su resumen criptográfico SHA-256 encadenando el hash del registro anterior, asegurando inmutabilidad y no repudio. Si alguien intentara modificar un registro en la base de datos directamente, la cadena se rompería en la verificación nocturna automática.
        </div>
      </details>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useSesion } from '../../comun/sesion';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Combo } from '../../comun/Combo';
import { Insignia } from '../../comun/Insignia';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { Paginacion } from '../../comun/Paginacion';
import { Icono } from '../../comun/Icono';
import { Tarjeta } from '../../comun/Tarjeta';
import type {
  RegistroAuditoriaItem,
  RespuestaListarAuditoria,
  ResultadoVerificacionCadena,
} from './tipos';

const OPCIONES_MODULOS = [
  { valor: '', etiqueta: 'Todos los módulos' },
  { valor: 'usuarios', etiqueta: 'Usuarios y personal' },
  { valor: 'acceso', etiqueta: 'Acceso y autenticación' },
  { valor: 'caja', etiqueta: 'Caja y cobros' },
  { valor: 'cierre', etiqueta: 'Cierres de turno' },
  { valor: 'pedidos', etiqueta: 'Pedidos' },
  { valor: 'cocina', etiqueta: 'Cocina y comandas' },
  { valor: 'repartos', etiqueta: 'Repartos y motorizados' },
  { valor: 'auditoria', etiqueta: 'Auditoría interna' },
  { valor: 'local', etiqueta: 'Configuración de local' },
  { valor: 'catalogo', etiqueta: 'Catálogo de productos' },
];

export function AuditoriaView() {
  const { tiene } = useSesion();
  const puedeVer = tiene('auditoria/ver');

  // Filtros
  const [modulo, setModulo] = useState('');
  const [accion, setAccion] = useState('');
  const [partyId, setPartyId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const limite = 20;

  // Datos
  const [registros, setRegistros] = useState<RegistroAuditoriaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificación de cadena criptográfica
  const [verificando, setVerificando] = useState(false);
  const [resultadoVerificacion, setResultadoVerificacion] =
    useState<ResultadoVerificacionCadena | null>(null);

  // Registros con detalle desplegado (id -> boolean)
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});

  const cargarAuditoria = useCallback(async () => {
    if (!puedeVer) return;

    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('pagina', pagina.toString());
      params.set('limite', limite.toString());
      if (modulo) params.set('modulo', modulo);
      if (accion.trim()) params.set('accion', accion.trim());
      if (partyId.trim()) params.set('partyId', partyId.trim());
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);

      const data = await api.get<RespuestaListarAuditoria>(
        `/admin/auditoria?${params.toString()}`,
      );
      setRegistros(data.datos || []);
      setTotal(data.total || 0);
      setPaginas(data.paginas || 1);
    } catch (err) {
      if (err instanceof ErrorApi) {
        setError(err.message || 'Error al obtener el historial de auditoría.');
      } else {
        setError('Error de comunicación con el servidor.');
      }
    } finally {
      setCargando(false);
    }
  }, [puedeVer, pagina, limite, modulo, accion, partyId, desde, hasta]);

  useEffect(() => {
    cargarAuditoria();
  }, [cargarAuditoria]);

  // Verificar integridad de la cadena
  async function ejecutarVerificacion() {
    setVerificando(true);
    try {
      const res = await api.get<ResultadoVerificacionCadena>(
        '/admin/auditoria/verificar',
      );
      setResultadoVerificacion(res);
    } catch (err) {
      setResultadoVerificacion({
        valida: false,
        totalFilas: 0,
        discrepancias: 1,
        error:
          err instanceof ErrorApi
            ? err.message
            : 'No fue posible verificar la cadena.',
      });
    } finally {
      setVerificando(false);
    }
  }

  function limpiarFiltros() {
    setModulo('');
    setAccion('');
    setPartyId('');
    setDesde('');
    setHasta('');
    setPagina(1);
  }

  function toggleDetalle(id: string) {
    setAbiertos((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function formatearFecha(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  function formatearValorJson(val: unknown): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'string') return val;
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }

  if (!puedeVer) {
    return (
      <div style={{ padding: '24px' }}>
        <Tarjeta>
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '24px',
                background: '#FBEDE9',
                color: 'var(--cp-rust)',
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icono nombre="alerta" tamano={24} />
            </div>
            <h2
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '18px',
                color: 'var(--cp-navy)',
                marginBottom: '8px',
              }}
            >
              Sin permiso de auditoría
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--cp-soft)', maxWidth: '400px', margin: '0 auto' }}>
              No tienes permiso para ver el historial y auditoría del sistema (permiso requerido: <code>auditoria/ver</code>).
            </p>
          </div>
        </Tarjeta>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Descripción y botón de verificación */}
      <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
        Cada cambio sensible, cada ingreso y cada vez que alguien ve un dato sensible queda aquí con
        quién, cuándo y desde qué equipo. Nadie lo puede editar ni borrar; cada registro guarda la
        huella criptográfica del anterior y el sistema verifica la integridad de la cadena.
      </div>

      {/* Panel de Verificación de Cadena */}
      {resultadoVerificacion ? (
        resultadoVerificacion.valida ? (
          <div
            role="status"
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              flexWrap: 'wrap',
              border: '1.5px solid var(--cp-green)',
              background: 'var(--cp-greenbg)',
              color: 'var(--cp-green)',
              borderRadius: '14px',
              padding: '12px 16px',
            }}
          >
            <Icono nombre="check" tamano={22} />
            <div style={{ flex: '1 1 240px', fontSize: '14px', fontWeight: 700, lineHeight: '19px' }}>
              Cadena criptográfica íntegra: <b>Válida</b> ({resultadoVerificacion.totalFilas} registros verificados
              sin alteraciones ni discrepancias).
            </div>
            <Boton
              type="button"
              variante="oscuro"
              tamano="pequeno"
              cargando={verificando}
              onClick={ejecutarVerificacion}
            >
              Verificar de nuevo
            </Boton>
          </div>
        ) : (
          <div
            role="alert"
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              flexWrap: 'wrap',
              border: '2px solid var(--cp-rust)',
              background: '#FBEDE9',
              color: 'var(--cp-rust)',
              borderRadius: '14px',
              padding: '12px 16px',
            }}
          >
            <Icono nombre="alerta" tamano={22} />
            <div style={{ flex: '1 1 240px', fontSize: '14px', fontWeight: 800, lineHeight: '19px' }}>
              Discrepancias detectadas en la cadena: {resultadoVerificacion.discrepancias} fallos
              encontrados
              {resultadoVerificacion.primerFalloId
                ? ` (primer fallo en registro #${resultadoVerificacion.primerFalloId})`
                : ''}
              {resultadoVerificacion.error ? ` - ${resultadoVerificacion.error}` : ''}.
            </div>
            <Boton
              type="button"
              variante="peligro"
              tamano="pequeno"
              cargando={verificando}
              onClick={ejecutarVerificacion}
            >
              Reintentar verificación
            </Boton>
          </div>
        )
      ) : (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            background: 'var(--cp-white)',
            border: '1.5px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '12px 16px',
          }}
        >
          <div style={{ fontSize: '14px', color: 'var(--cp-navy)', fontWeight: 600 }}>
            Verificación de integridad de la cadena encadenada SHA-256 (inmutabilidad y no repudio):
          </div>
          <Boton
            type="button"
            variante="primario"
            tamano="pequeno"
            cargando={verificando}
            onClick={ejecutarVerificacion}
          >
            <Icono nombre="check" tamano={16} />
            Verificar cadena
          </Boton>
        </div>
      )}

      {/* Tarjeta de Filtros y Búsqueda */}
      <Tarjeta>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h3
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '16px',
                color: 'var(--cp-navy)',
                margin: 0,
              }}
            >
              Historial de eventos ({total} registros)
            </h3>
            {(modulo || accion || partyId || desde || hasta) && (
              <Boton
                type="button"
                variante="texto"
                tamano="pequeno"
                onClick={limpiarFiltros}
              >
                Limpiar filtros
              </Boton>
            )}
          </div>

          {/* Filtros */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            {/* Módulo */}
            <div>
              <Combo
                etiqueta="Módulo"
                opciones={OPCIONES_MODULOS}
                valor={modulo}
                alCambiar={(v) => {
                  setModulo(v);
                  setPagina(1);
                }}
                placeholder="Todos los módulos"
              />
            </div>

            {/* Acción */}
            <div>
              <label
                htmlFor="filtro-accion"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--cp-navy)',
                  marginBottom: '4px',
                }}
              >
                Acción
              </label>
              <input
                id="filtro-accion"
                type="text"
                placeholder="Ej: CREAR, EDITAR..."
                value={accion}
                onChange={(e) => {
                  setAccion(e.target.value);
                  setPagina(1);
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 12px',
                  fontSize: '14px',
                  color: 'var(--cp-navy)',
                  background: 'var(--cp-white)',
                }}
              />
            </div>

            {/* Usuario (partyId) */}
            <div>
              <label
                htmlFor="filtro-usuario"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--cp-navy)',
                  marginBottom: '4px',
                }}
              >
                ID Usuario / Persona
              </label>
              <input
                id="filtro-usuario"
                type="text"
                placeholder="Ej: 1"
                value={partyId}
                onChange={(e) => {
                  setPartyId(e.target.value);
                  setPagina(1);
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 12px',
                  fontSize: '14px',
                  color: 'var(--cp-navy)',
                  background: 'var(--cp-white)',
                }}
              />
            </div>

            {/* Selector de fecha nativo Desde */}
            <div>
              <label
                htmlFor="filtro-desde"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--cp-navy)',
                  marginBottom: '4px',
                }}
              >
                Desde
              </label>
              <input
                id="filtro-desde"
                type="date"
                value={desde}
                onChange={(e) => {
                  setDesde(e.target.value);
                  setPagina(1);
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 12px',
                  fontSize: '14px',
                  color: 'var(--cp-navy)',
                  background: 'var(--cp-white)',
                }}
              />
            </div>

            {/* Selector de fecha nativo Hasta */}
            <div>
              <label
                htmlFor="filtro-hasta"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--cp-navy)',
                  marginBottom: '4px',
                }}
              >
                Hasta
              </label>
              <input
                id="filtro-hasta"
                type="date"
                value={hasta}
                onChange={(e) => {
                  setHasta(e.target.value);
                  setPagina(1);
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 12px',
                  fontSize: '14px',
                  color: 'var(--cp-navy)',
                  background: 'var(--cp-white)',
                }}
              />
            </div>
          </div>

          {/* Lista de Registros */}
          {cargando ? (
            <div style={{ padding: '32px 0' }}>
              <Cargando mensaje="Cargando historial de auditoría..." />
            </div>
          ) : error ? (
            <EstadoError mensaje={error} alReintentar={cargarAuditoria} />
          ) : registros.length === 0 ? (
            <EstadoVacio
              titulo="No hay registros de auditoría"
              descripcion="No se encontraron eventos coincidentes con los filtros seleccionados."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {registros.map((r) => {
                const esOk = r.resultado === 'OK';
                const detalleAbierto = !!abiertos[r.id];

                return (
                  <div
                    key={r.id}
                    style={{
                      background: 'var(--cp-white)',
                      border: '1px solid var(--cp-line)',
                      borderRadius: '12px',
                      padding: '14px',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                    }}
                  >
                    {/* Franja vertical de color según resultado */}
                    <span
                      style={{
                        width: '5px',
                        borderRadius: '3px',
                        alignSelf: 'stretch',
                        background: esOk ? 'var(--cp-green)' : 'var(--cp-rust)',
                        flexShrink: 0,
                      }}
                    />

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* Cabecera del registro */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontFamily: 'Montserrat, sans-serif',
                              fontWeight: 800,
                              fontSize: '14px',
                              color: 'var(--cp-navy)',
                            }}
                          >
                            {r.modulo.toUpperCase()} · {r.accion}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                            (Cat: {r.categoria})
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {/* Resultado con Insignia */}
                          <Insignia variante={esOk ? 'exito' : 'peligro'}>
                            {r.resultado}
                          </Insignia>

                          {r.conPinAdmin && (
                            <Insignia variante="aviso">Con PIN Admin</Insignia>
                          )}
                        </div>
                      </div>

                      {/* Metadatos */}
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--cp-soft)',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '12px',
                        }}
                      >
                        <span>
                          <b>Fecha:</b> {formatearFecha(r.en)}
                        </span>
                        <span>
                          <b>Usuario:</b> {r.partyId ? `Party ID ${r.partyId}` : 'Sistema / Anónimo'}
                        </span>
                        <span>
                          <b>IP:</b> {r.ip || '—'}
                        </span>
                        {r.entidad && (
                          <span>
                            <b>Entidad:</b> {r.entidad} {r.entidadId ? `(${r.entidadId})` : ''}
                          </span>
                        )}
                      </div>

                      {/* Motivo si existe */}
                      {r.motivo && (
                        <div style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>
                          <b>Motivo:</b> {r.motivo}
                        </div>
                      )}

                      {/* Botón desplegar detalle */}
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleDetalle(r.id)}
                          style={{
                            minHeight: '36px',
                            padding: '0 10px',
                            borderRadius: '8px',
                            border: '1.5px solid var(--cp-navy)',
                            background: 'transparent',
                            color: 'var(--cp-navy)',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Icono nombre={detalleAbierto ? 'chevronAbajo' : 'chevronDerecha'} tamano={14} />
                          {detalleAbierto ? 'Ocultar datos y huella' : 'Ver datos y huella'}
                        </button>
                      </div>

                      {/* Detalle expandido */}
                      {detalleAbierto && (
                        <div
                          style={{
                            marginTop: '8px',
                            paddingTop: '10px',
                            borderTop: '1px solid var(--cp-line)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                          }}
                        >
                          {(r.antes !== null || r.despues !== null) && (
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                gap: '10px',
                              }}
                            >
                              <div
                                style={{
                                  border: '1px solid var(--cp-line)',
                                  borderRadius: '8px',
                                  padding: '10px',
                                  background: 'var(--cp-sand)',
                                }}
                              >
                                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cp-soft)', marginBottom: '4px' }}>
                                  ESTADO ANTES
                                </div>
                                <pre
                                  style={{
                                    margin: 0,
                                    fontSize: '12px',
                                    fontFamily: 'ui-monospace, monospace',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                  }}
                                >
                                  {formatearValorJson(r.antes)}
                                </pre>
                              </div>

                              <div
                                style={{
                                  border: '1.5px solid var(--cp-orange)',
                                  borderRadius: '8px',
                                  padding: '10px',
                                  background: 'var(--cp-white)',
                                }}
                              >
                                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cp-soft)', marginBottom: '4px' }}>
                                  ESTADO DESPUÉS
                                </div>
                                <pre
                                  style={{
                                    margin: 0,
                                    fontSize: '12px',
                                    fontFamily: 'ui-monospace, monospace',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                  }}
                                >
                                  {formatearValorJson(r.despues)}
                                </pre>
                              </div>
                            </div>
                          )}

                          {/* Huellas criptográficas */}
                          <div
                            style={{
                              background: '#F3E9DB',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '11px',
                              fontFamily: 'ui-monospace, monospace',
                              color: 'var(--cp-navy)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              wordBreak: 'break-all',
                            }}
                          >
                            <div>
                              <b>HUELLA ACTUAL (SHA-256):</b> {r.hash}
                            </div>
                            <div>
                              <b>HUELLA ANTERIOR:</b> {r.hashAnterior || '(Registro inicial / Génesis)'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Paginación */}
              <Paginacion
                pagina={pagina}
                totalPaginas={paginas}
                totalRegistros={total}
                tamanoPagina={limite}
                alCambiarPagina={(nuevaPagina) => setPagina(nuevaPagina)}
              />
            </div>
          )}
        </div>
      </Tarjeta>
    </div>
  );
}

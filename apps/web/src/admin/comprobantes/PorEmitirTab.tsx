import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { Paginacion } from '../../comun/Paginacion';
import { Insignia } from '../../comun/Insignia';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { comprobantesApi } from './comprobantesApi';
import { enmascararDocumento, formatearSoles } from './utilidades';
import type { ComprobantePorEmitir } from './tipos';
import { FiltroCombo } from '../../comun/FiltroCombo';

interface PorEmitirTabProps {
  alVerNota?: (pedidoId: string) => void;
}

async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // fallback
    }
  }
  return false;
}

export function PorEmitirTab({ alVerNota }: PorEmitirTabProps) {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN';

  const [comprobantes, setComprobantes] = useState<ComprobantePorEmitir[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [limite] = useState(20);
  const [total, setTotal] = useState(0);

  // Filtros en cliente
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | 'BOLETA' | 'FACTURA'>('TODOS');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'POR_EMITIR'>('TODOS');

  // Estado para copiar
  const [mensajeCopia, setMensajeCopia] = useState<string | null>(null);

  // Modal para ingresar referencia externa y marcar emitido
  const [itemParaEmitir, setItemParaEmitir] = useState<ComprobantePorEmitir | null>(null);
  const [referencia, setReferencia] = useState('');
  const [errorReferencia, setErrorReferencia] = useState<string | null>(null);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargarComprobantes = useCallback(async (pag = 1) => {
    setCargando(true);
    setError(null);
    try {
      const resp = await comprobantesApi.listarPorEmitir(pag, limite);
      setComprobantes(resp.elementos || []);
      setTotal(resp.total || 0);
      setPagina(resp.pagina || pag);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar comprobantes por emitir');
    } finally {
      setCargando(false);
    }
  }, [limite]);

  useEffect(() => {
    cargarComprobantes(pagina);
  }, [cargarComprobantes, pagina]);

  const handleCopiar = async (c: ComprobantePorEmitir) => {
    const docMostrar = enmascararDocumento(c.documento, esAdmin);
    const texto = [
      `Documento: ${docMostrar}`,
      `Razón social: ${c.razon_social || '-'}`,
      `Total: ${formatearSoles(c.total)}`,
      `Código: ${c.codigo_pedido || c.codigo || '-'}`,
      `Comprobante: ${c.tipo} ${c.numero_texto}`,
    ].join('\n');

    const copiado = await copiarAlPortapapeles(texto);
    if (copiado) {
      setMensajeCopia(`Datos de ${c.numero_texto} copiados al portapapeles`);
      setTimeout(() => setMensajeCopia(null), 3000);
    } else {
      setMensajeCopia('No se pudo copiar automáticamente');
      setTimeout(() => setMensajeCopia(null), 3000);
    }
  };

  const iniciarMarcarEmitido = (c: ComprobantePorEmitir) => {
    setItemParaEmitir(c);
    setReferencia('');
    setErrorReferencia(null);
  };

  const validarYEmitir = () => {
    const refLimpia = referencia.trim();
    if (refLimpia.length < 3) {
      setErrorReferencia('La referencia debe tener al menos 3 caracteres');
      return;
    }
    setErrorReferencia(null);
    setMostrarConfirmar(true);
  };

  const confirmarEmision = async () => {
    if (!itemParaEmitir) return;
    setGuardando(true);
    try {
      await comprobantesApi.marcarEmitido(itemParaEmitir.id, referencia.trim());
      setMostrarConfirmar(false);
      setItemParaEmitir(null);
      setReferencia('');
      await cargarComprobantes(pagina);
    } catch (err: any) {
      setErrorReferencia(err?.message || 'Error al marcar como emitido');
      setMostrarConfirmar(false);
    } finally {
      setGuardando(false);
    }
  };

  // Filtrado de comprobantes
  const comprobantesFiltrados = useMemo(() => {
    return comprobantes.filter((c) => {
      if (filtroTipo !== 'TODOS' && c.tipo !== filtroTipo) {
        return false;
      }
      if (filtroEstado !== 'TODOS' && c.emision !== filtroEstado) {
        return false;
      }
      if (busqueda.trim()) {
        const q = busqueda.trim().toLowerCase();
        const coincideNumero = c.numero_texto?.toLowerCase().includes(q) ?? false;
        const coincidePedido = (c.codigo_pedido || c.codigo || '').toLowerCase().includes(q);
        const coincideDoc = (c.documento || '').toLowerCase().includes(q);
        const coincideRazon = (c.razon_social || '').toLowerCase().includes(q);
        return coincideNumero || coincidePedido || coincideDoc || coincideRazon;
      }
      return true;
    });
  }, [comprobantes, filtroTipo, filtroEstado, busqueda]);

  if (cargando && comprobantes.length === 0) {
    return <Cargando mensaje="Cargando comprobantes por emitir..." />;
  }

  if (error && comprobantes.length === 0) {
    return (
      <EstadoError
        mensaje={error}
        alReintentar={() => cargarComprobantes(pagina)}
      />
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(total / limite));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {/* Barra de Filtros, Búsqueda y Actualización */}
      <div className="comprobantes-barra-filtros">
        <div className="comprobantes-busqueda-fila">
          <label htmlFor="busqueda-comprobantes" style={{ position: 'absolute', left: -9999 }}>
            Buscar comprobante
          </label>
          <input
            id="busqueda-comprobantes"
            type="search"
            className="comprobantes-busqueda-input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por número, pedido, cliente o documento..."
          />

          <Boton
            variante="secundario"
            onClick={() => cargarComprobantes(pagina)}
            cargando={cargando}
            title="Actualizar lista de comprobantes"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Actualizar cola
          </Boton>
        </div>

        {/* Fila de píldoras de filtro */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <FiltroCombo
              etiqueta="Tipo"
              valor={filtroTipo}
              valorPorDefecto="TODOS"
              opciones={[
                { valor: 'TODOS', etiqueta: 'Todos' },
                { valor: 'BOLETA', etiqueta: 'Boletas' },
                { valor: 'FACTURA', etiqueta: 'Facturas' },
              ]}
              alCambiar={(v) => setFiltroTipo(v as typeof filtroTipo)}
            />
            <FiltroCombo
              etiqueta="Estado"
              valor={filtroEstado}
              valorPorDefecto="TODOS"
              opciones={[
                { valor: 'TODOS', etiqueta: 'Todos' },
                { valor: 'POR_EMITIR', etiqueta: 'Por emitir' },
              ]}
              alCambiar={(v) => setFiltroEstado(v as typeof filtroEstado)}
            />
          </div>

          <div style={{ fontSize: '13px', color: 'var(--cp-soft)', fontWeight: 700 }}>
            {comprobantesFiltrados.length} {comprobantesFiltrados.length === 1 ? 'pendiente' : 'pendientes'}
          </div>
        </div>
      </div>

      {mensajeCopia && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: 'var(--cp-greenbg)',
            color: 'var(--cp-green)',
            fontWeight: 700,
            fontSize: '14px',
            border: '1.5px solid var(--cp-green)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {mensajeCopia}
        </div>
      )}

      {comprobantes.length === 0 ? (
        <EstadoVacio
          titulo="No hay comprobantes pendientes"
          mensaje="Todas las boletas y facturas han sido emitidas o aún no se han generado cobros."
        />
      ) : comprobantesFiltrados.length === 0 ? (
        <EstadoVacio
          titulo="Ningún comprobante coincide"
          mensaje="No se encontraron comprobantes que coincidan con la búsqueda o filtros seleccionados."
        />
      ) : (
        <>
          {/* Cuadrícula de Tarjetas de Comprobante */}
          <div className="comprobantes-grid">
            {comprobantesFiltrados.map((c) => {
              const docMostrar = enmascararDocumento(c.documento, esAdmin);
              const fechaStr = c.fecha_lima || (c.fecha ? new Date(c.fecha).toLocaleString('es-PE') : '-');

              return (
                <div key={c.id} className="comprobante-card">
                  {/* Cabecera de la tarjeta: Insignia de tipo, estado y número */}
                  <div className="comprobante-card-cabecera">
                    <div className="comprobante-card-insignias">
                      <Insignia variante={c.tipo === 'FACTURA' ? 'aviso' : c.tipo === 'BOLETA' ? 'acento' : 'neutro'}>
                        {c.tipo === 'BOLETA' ? 'Boleta' : c.tipo === 'FACTURA' ? 'Factura' : c.tipo}
                      </Insignia>
                      <Insignia variante="aviso">
                        Por emitir
                      </Insignia>
                    </div>
                    <div className="comprobante-card-numero">
                      {c.numero_texto}
                    </div>
                  </div>

                  {/* Datos del comprobante */}
                  <div className="comprobante-datos-grid">
                    <div className="comprobante-dato-item">
                      <span className="comprobante-dato-label">Pedido</span>
                      <span className="comprobante-dato-valor codigo">
                        {c.codigo_pedido || c.codigo || '-'}
                      </span>
                    </div>

                    <div className="comprobante-dato-item">
                      <span className="comprobante-dato-label">Documento</span>
                      <span className="comprobante-dato-valor mono">
                        {docMostrar}
                      </span>
                    </div>

                    <div className="comprobante-dato-item comprobante-dato-full">
                      <span className="comprobante-dato-label">Razón social / Cliente</span>
                      <span className="comprobante-dato-valor">
                        {c.razon_social || '-'}
                      </span>
                    </div>

                    <div className="comprobante-dato-item comprobante-dato-full">
                      <span className="comprobante-dato-label">Fecha de emisión</span>
                      <span className="comprobante-dato-valor" style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                        {fechaStr}
                      </span>
                    </div>
                  </div>

                  {/* Fila de Total destacado */}
                  <div className="comprobante-total-fila">
                    <span className="comprobante-total-label">Total a emitir</span>
                    <span className="comprobante-total-monto">
                      {formatearSoles(c.total)}
                    </span>
                  </div>

                  {/* Acciones claras y grandes */}
                  <div className="comprobante-acciones">
                    <Boton
                      variante="secundario"
                      onClick={() => handleCopiar(c)}
                      title="Copiar datos al portapapeles"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        style={{ marginRight: '6px' }}
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copiar datos
                    </Boton>

                    <Boton
                      variante="primario"
                      onClick={() => iniciarMarcarEmitido(c)}
                      title="Marcar como emitido en el facturador"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        style={{ marginRight: '6px' }}
                      >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      Marcar emitido
                    </Boton>

                    {alVerNota && (c.pedido_id || c.id) && (
                      <button
                        type="button"
                        onClick={() => alVerNota(c.pedido_id || c.id)}
                        style={{
                          width: '100%',
                          minHeight: '36px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--cp-navy)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: '4px',
                        }}
                      >
                        Ver nota de venta térmica
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Paginacion
            paginaActual={pagina}
            totalPaginas={totalPaginas}
            totalRegistros={total}
            tamanoPagina={limite}
            alCambiarPagina={(p) => setPagina(p)}
          />
        </>
      )}

      {/* Modal para ingresar referencia externa */}
      {itemParaEmitir && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-marcar-emitido"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            zIndex: 90,
            backgroundColor: 'rgba(11, 44, 62, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--cp-white)',
              borderRadius: '16px',
              border: '1.5px solid var(--cp-navy)',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.25)',
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxSizing: 'border-box',
            }}
          >
            <div>
              <h3 id="titulo-marcar-emitido" style={{ fontSize: '18px', color: 'var(--cp-navy)', margin: 0, fontWeight: 800 }}>
                Marcar como emitido
              </h3>
              <p style={{ margin: '8px 0 0', color: 'var(--cp-soft)', fontSize: '13px', lineHeight: '18px' }}>
                Comprobante: <b>{itemParaEmitir.tipo} {itemParaEmitir.numero_texto}</b>
                <br />
                Pedido: <b>{itemParaEmitir.codigo_pedido || itemParaEmitir.codigo}</b> · Monto: <b>{formatearSoles(itemParaEmitir.total)}</b>
              </p>
            </div>

            <div>
              <Campo
                id="campo-referencia-externa"
                etiqueta="Referencia del facturador externo"
                value={referencia}
                onChange={(e) => {
                  setReferencia(e.target.value);
                  if (errorReferencia) setErrorReferencia(null);
                }}
                error={errorReferencia || undefined}
                placeholder="Ej: F001-00042 o número de ticket externo"
                ayuda="Mínimo 3 caracteres. Identifica el comprobante generado en SUNAT o en tu PSE."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Boton
                variante="secundario"
                onClick={() => {
                  setItemParaEmitir(null);
                  setReferencia('');
                  setErrorReferencia(null);
                }}
                deshabilitado={guardando}
              >
                Cancelar
              </Boton>
              <Boton
                variante="primario"
                onClick={validarYEmitir}
                deshabilitado={referencia.trim().length < 3 || guardando}
              >
                Continuar
              </Boton>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar Sí/No */}
      {mostrarConfirmar && itemParaEmitir && (
        <Confirmar
          abierto={mostrarConfirmar}
          titulo="¿Confirmar comprobante emitido?"
          mensaje={`¿Confirmas que el comprobante ${itemParaEmitir.numero_texto} ha sido emitido con la referencia "${referencia.trim()}"? Esta acción no se puede deshacer.`}
          textoConfirmar="Sí, marcar emitido"
          textoNo="No, revisar"
          alConfirmar={confirmarEmision}
          alCancelar={() => setMostrarConfirmar(false)}
          cargando={guardando}
        />
      )}
    </div>
  );
}

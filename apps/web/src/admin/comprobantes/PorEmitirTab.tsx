import { useState, useEffect, useCallback } from 'react';
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
import type { ComprobantePorEmitir } from './tipos';
import { enmascararDocumento, formatearSoles, copiarAlPortapapeles } from './utilidades';

export function PorEmitirTab() {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN';

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comprobantes, setComprobantes] = useState<ComprobantePorEmitir[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const limite = 20;

  // Mensaje temporal al copiar
  const [mensajeCopia, setMensajeCopia] = useState<string | null>(null);

  // Modal para Marcar Emitido
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '18px', color: 'var(--cp-navy)' }}>
            Cola por emitir en facturador externo
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--cp-soft)', fontSize: '13px' }}>
            Boletas y facturas emitidas internamente pendientes de registro en SUNAT / facturador externo (DT-11).
          </p>
        </div>
        <Boton
          variante="secundario"
          onClick={() => cargarComprobantes(pagina)}
          cargando={cargando}
        >
          Actualizar cola
        </Boton>
      </div>

      {mensajeCopia && (
        <div
          role="status"
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'var(--cp-greenbg)',
            color: 'var(--cp-green)',
            fontWeight: 700,
            fontSize: '13px',
            border: '1px solid var(--cp-green)',
          }}
        >
          {mensajeCopia}
        </div>
      )}

      {comprobantes.length === 0 ? (
        <EstadoVacio
          titulo="No hay comprobantes pendientes"
          mensaje="Todas las boletas y facturas han sido emitidas o aún no se han generado cobros."
        />
      ) : (
        <>
          <div className="tabla-tactil-envoltura">
            <table className="tabla-tactil">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Número</th>
                  <th>Pedido</th>
                  <th>Documento</th>
                  <th>Razón social / Cliente</th>
                  <th>Total</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {comprobantes.map((c) => {
                  const docMostrar = enmascararDocumento(c.documento, esAdmin);
                  const fechaStr = c.fecha_lima || (c.fecha ? new Date(c.fecha).toLocaleString('es-PE') : '-');

                  return (
                    <tr key={c.id}>
                      <td>
                        <Insignia variante={c.tipo === 'FACTURA' ? 'aviso' : 'acento'}>
                          {c.tipo}
                        </Insignia>
                      </td>
                      <td style={{ fontWeight: 800 }}>{c.numero_texto}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--cp-navy)' }}>
                          {c.codigo_pedido || c.codigo || '-'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {docMostrar}
                      </td>
                      <td>{c.razon_social || '-'}</td>
                      <td style={{ fontWeight: 800, color: 'var(--cp-rust)' }}>
                        {formatearSoles(c.total)}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                        {fechaStr}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <Boton
                            variante="secundario"
                            onClick={() => handleCopiar(c)}
                            title="Copiar datos al portapapeles"
                          >
                            Copiar datos
                          </Boton>
                          <Boton
                            variante="primario"
                            onClick={() => iniciarMarcarEmitido(c)}
                          >
                            Marcar emitido
                          </Boton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
            backgroundColor: 'rgba(11, 44, 62, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--cp-white)',
              borderRadius: '16px',
              border: '1.5px solid var(--cp-navy)',
              boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div>
              <h3 id="titulo-marcar-emitido" style={{ fontSize: '18px', color: 'var(--cp-navy)' }}>
                Marcar como emitido
              </h3>
              <p style={{ margin: '6px 0 0', color: 'var(--cp-soft)', fontSize: '13px' }}>
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

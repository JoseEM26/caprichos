import { useState, useEffect, useCallback } from 'react';
import { useSesion } from '../../comun/sesion';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { comprobantesApi } from './comprobantesApi';
import { enmascararDocumento, formatearSoles } from './utilidades';
import type { NotaVentaDatos } from './tipos';

interface NotaVentaVistaProps {
  pedidoIdInicial?: string;
  alCerrar?: () => void;
}

export function NotaVentaVista({ pedidoIdInicial, alCerrar }: NotaVentaVistaProps) {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN';

  const [pedidoId, setPedidoId] = useState(pedidoIdInicial || '');
  const [pedidoIdBuscado, setPedidoIdBuscado] = useState(pedidoIdInicial || '');
  const [cargando, setCargando] = useState(false);
  const [reimprimiendo, setReimprimiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState<NotaVentaDatos | null>(null);

  const cargarNota = useCallback(async (id: string) => {
    if (!id || !id.trim()) {
      setNota(null);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const data = await comprobantesApi.obtenerNotaVenta(id.trim());
      setNota(data);
    } catch (err: any) {
      setNota(null);
      setError(err?.message || 'No se pudo obtener la nota de venta');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (pedidoIdInicial) {
      setPedidoId(pedidoIdInicial);
      setPedidoIdBuscado(pedidoIdInicial);
      cargarNota(pedidoIdInicial);
    }
  }, [pedidoIdInicial, cargarNota]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedidoId.trim()) return;
    setPedidoIdBuscado(pedidoId.trim());
    cargarNota(pedidoId.trim());
  };

  const handleReimprimir = async () => {
    if (!pedidoIdBuscado) return;
    setReimprimiendo(true);
    setError(null);
    try {
      const notaActualizada = await comprobantesApi.reimprimirNotaVenta(pedidoIdBuscado);
      setNota(notaActualizada);
      if (typeof window !== 'undefined' && window.print) {
        setTimeout(() => {
          window.print();
        }, 100);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al reimprimir la nota de venta');
    } finally {
      setReimprimiendo(false);
    }
  };

  const handleImprimirActual = () => {
    if (typeof window !== 'undefined' && window.print) {
      window.print();
    }
  };

  const docCliente = nota?.cliente?.documento || nota?.comprobante?.documento;
  const docMostrar = enmascararDocumento(docCliente, esAdmin);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Panel de búsqueda estilo tarjeta limpia */}
      <div className="no-imprimir comprobantes-panel-busqueda">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px', color: 'var(--cp-navy)' }}>
              Buscar nota de venta por pedido
            </div>
            <div style={{ margin: '4px 0 0', color: 'var(--cp-soft)', fontSize: '13px' }}>
              Visualización y reimpresión con formato térmico de 80 mm para pedidos cobrados.
            </div>
          </div>
          {alCerrar && (
            <Boton variante="secundario" onClick={alCerrar}>
              Volver a la cola
            </Boton>
          )}
        </div>

        <form onSubmit={handleBuscar} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', maxWidth: '520px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}>
            <Campo
              id="buscar-pedido-id"
              etiqueta="ID del pedido cobrado"
              value={pedidoId}
              onChange={(e) => setPedidoId(e.target.value)}
              placeholder="Ej: 30, 42 o UUID"
            />
          </div>
          <Boton
            variante="primario"
            type="submit"
            cargando={cargando}
            deshabilitado={!pedidoId.trim()}
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
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Cargar nota
          </Boton>
        </form>
      </div>

      {cargando && <Cargando mensaje="Cargando datos de la nota de venta..." />}

      {error && !cargando && (
        <EstadoError
          mensaje={error}
          alReintentar={() => {
            if (pedidoIdBuscado) cargarNota(pedidoIdBuscado);
          }}
        />
      )}

      {!cargando && !error && !nota && (
        <EstadoVacio
          titulo="Ingresa el ID del pedido"
          mensaje="Escribe el ID del pedido cobrado para visualizar su nota de venta y opciones de reimpresión."
        />
      )}

      {nota && !cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
          {/* Botones de acción grandes */}
          <div className="no-imprimir" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '440px' }}>
            <Boton
              variante="primario"
              onClick={handleImprimirActual}
              style={{ minHeight: '44px', flex: '1 1 180px' }}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ marginRight: '6px' }}
              >
                <path d="M6 9V2h12v7" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Imprimir en ticketera (80 mm)
            </Boton>
            <Boton
              variante="oscuro"
              onClick={handleReimprimir}
              cargando={reimprimiendo}
              style={{ minHeight: '44px', flex: '1 1 180px' }}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ marginRight: '6px' }}
              >
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              Reimprimir (marcar COPIA)
            </Boton>
          </div>

          {/* Ticket de 80 mm */}
          <div id="ticket-impresion" className="ticket-vista">
            {/* Encabezado del local */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px', letterSpacing: '0.04em' }}>
                {nota.local?.nombre || 'CAPRICHOS'}
              </div>
              <div style={{ fontWeight: 700, fontSize: '12px' }}>
                {nota.local?.razon_social || 'Caprichos S.A.C.'}
              </div>
              <div style={{ fontSize: '11px' }}>
                RUC: {nota.local?.ruc || '20123456789'}
              </div>
              <div style={{ fontSize: '11px' }}>
                {nota.local?.direccion || 'Av. Principal 123'}
              </div>
              <div style={{ fontSize: '11px' }}>
                Teléf: {nota.local?.telefono || '999999999'}
              </div>
            </div>

            <div className="ticket-separador-doble" />

            {/* Título y correlativo */}
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '14px' }}>
              {nota.titulo || `Nota de venta ${nota.comprobante?.numero_texto}`}
            </div>

            {/* Marca de copia si es reimpresión */}
            {(nota.es_copia || nota.comprobante?.es_copia || ((nota.comprobante?.copias_impresas ?? 0) > 0)) && (
              <div className="ticket-copia-marca" data-testid="marca-copia">
                COPIA {nota.copia_numero || nota.comprobante?.copia_numero || nota.comprobante?.copias_impresas || 1}
              </div>
            )}

            {/* Aviso por emitir si es boleta o factura */}
            {(nota.aviso || nota.comprobante?.aviso) && (
              <div className="ticket-aviso-facturador">
                {nota.aviso || nota.comprobante?.aviso}
              </div>
            )}

            <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div>Fecha: {nota.fecha}</div>
              <div>Pedido: <b>{nota.pedido?.codigo || '-'}</b> · Canal: {nota.pedido?.canal || '-'}</div>
              {nota.pedido?.mesa_nombre && <div>Mesa: {nota.pedido.mesa_nombre}</div>}
              {nota.cliente?.nombre && <div>Cliente: {nota.cliente.nombre}</div>}
              {docCliente && (
                <div data-testid="documento-cliente">
                  Doc: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{docMostrar}</span>
                </div>
              )}
              {nota.cliente?.razon_social && (
                <div>Razón Social: {nota.cliente.razon_social}</div>
              )}
            </div>

            <div className="ticket-separador" />

            {/* Detalle de productos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '11px', borderBottom: '1px solid #999', paddingBottom: '2px' }}>
                <span style={{ flex: 1 }}>CANT / DESCRIPCIÓN</span>
                <span style={{ width: '60px', textAlign: 'right' }}>TOTAL</span>
              </div>

              {(nota.detalle || []).map((it, idx) => (
                <div key={it.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ flex: 1, fontWeight: 700 }}>
                      {it.cantidad} × {it.nombre}
                    </span>
                    <span style={{ width: '60px', textAlign: 'right', fontWeight: 700 }}>
                      {formatearSoles(it.subtotal)}
                    </span>
                  </div>

                  {it.opciones && it.opciones.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#444', paddingLeft: '14px' }}>
                      {it.opciones.map((op, oIdx) => (
                        <div key={op.id || oIdx}>+ {op.nombre}</div>
                      ))}
                    </div>
                  )}

                  {it.nota && (
                    <div style={{ fontSize: '11px', fontStyle: 'italic', paddingLeft: '14px' }}>
                      Nota: {it.nota}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="ticket-separador" />

            {/* Totales */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>{formatearSoles(nota.subtotal)}</span>
              </div>
              {nota.descuento > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--cp-rust)' }}>
                  <span>Descuento:</span>
                  <span>- {formatearSoles(nota.descuento)}</span>
                </div>
              )}
              {nota.envio > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Envío:</span>
                  <span>{formatearSoles(nota.envio)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '14px', borderTop: '1px solid #999', paddingTop: '4px' }}>
                <span>TOTAL A PAGAR:</span>
                <span>{formatearSoles(nota.total)}</span>
              </div>
            </div>

            <div className="ticket-separador" />

            {/* Medios de pago y vuelto */}
            <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontWeight: 700 }}>PAGO:</div>
              {(nota.pagos || []).map((p, pIdx) => (
                <div key={p.id || pIdx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{p.medio}:</span>
                  <span>{formatearSoles(p.monto)}</span>
                </div>
              ))}
              {nota.vuelto > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--cp-green)' }}>
                  <span>VUELTO:</span>
                  <span>{formatearSoles(nota.vuelto)}</span>
                </div>
              )}
            </div>

            <div className="ticket-separador-doble" />

            {/* Pie de ticket */}
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#555' }}>
              <div>¡Gracias por tu compra en Caprichos!</div>
              <div>Conservar este comprobante interno.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

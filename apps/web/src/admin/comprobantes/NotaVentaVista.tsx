import { useState, useEffect, useCallback } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { comprobantesApi } from './comprobantesApi';
import type { NotaVentaDatos } from './tipos';
import { enmascararDocumento, formatearSoles } from './utilidades';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="no-imprimir" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '18px', color: 'var(--cp-navy)' }}>
              Nota de venta interna (NV01)
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--cp-soft)', fontSize: '13px' }}>
              Visualización y reimpresión con formato térmico de 80 mm para pedidos cobrados.
            </p>
          </div>
          {alCerrar && (
            <Boton variante="secundario" onClick={alCerrar}>
              Cerrar vista
            </Boton>
          )}
        </div>

        <form onSubmit={handleBuscar} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', maxWidth: '480px' }}>
          <div style={{ flex: 1 }}>
            <Campo
              id="buscar-pedido-id"
              etiqueta="ID del pedido cobrado"
              value={pedidoId}
              onChange={(e) => setPedidoId(e.target.value)}
              placeholder="Ej: 1, 42 o UUID"
            />
          </div>
          <Boton variante="primario" type="submit" cargando={cargando} deshabilitado={!pedidoId.trim()}>
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="no-imprimir" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Boton
              variante="primario"
              onClick={handleImprimirActual}
            >
              Imprimir en ticketera (80 mm)
            </Boton>
            <Boton
              variante="oscuro"
              onClick={handleReimprimir}
              cargando={reimprimiendo}
            >
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

import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { Pedido, pedidosApi } from './pedidosApi';
import { ModalCobrar } from './ModalCobrar';
import { ModalAnular } from './ModalAnular';
import { useSesion } from '../../comun/sesion';

export interface PedidoDetalleProps {
  pedido: Pedido;
  alActualizar: () => void;
}

export function PedidoDetalle({ pedido, alActualizar }: PedidoDetalleProps) {
  const { usuario, tiene } = useSesion();
  const [pestanaActiva, setPestanaActiva] = useState<
    'pedido' | 'cobro' | 'ticket' | 'comprobante'
  >('pedido');

  // Modales
  const [abrirCobro, setAbrirCobro] = useState<boolean>(false);
  const [abrirAnular, setAbrirAnular] = useState<boolean>(false);
  const [abrirAnularCobro, setAbrirAnularCobro] = useState<boolean>(false);

  // Confirmaciones directas
  const [transicionPendiente, setTransicionPendiente] = useState<{
    nuevoEstado: string;
    titulo: string;
    mensaje: string;
  } | null>(null);

  const [confirmarCoordinado, setConfirmarCoordinado] = useState<boolean>(false);
  const [procesandoAccion, setProcesandoAccion] = useState<boolean>(false);
  const [errorAccion, setErrorAccion] = useState<string>('');
  const [mensajeExito, setMensajeExito] = useState<string>('');

  // Validación de permisos de contacto sensible (teléfono y dirección)
  const puedeVerContacto =
    usuario?.rol === 'ADMIN' ||
    usuario?.rol === 'CAJERO' ||
    usuario?.rol === 'CALLCENTER' ||
    usuario?.rol === 'REPARTIDOR' ||
    tiene('caja/ver') ||
    tiene('pedidos/cambiar_estado') ||
    tiene('repartos/ver');

  // Transición de estado permitida según el estado actual y modalidad
  const obtenerAccionEstado = (): {
    label: string;
    nuevoEstado: string;
    titulo: string;
    mensaje: string;
  } | null => {
    const est = String(pedido.estado).toUpperCase();
    const mod = String(pedido.modalidad).toUpperCase();

    // DT-58 y DT-71: todo pedido llega directo a cocina y no hay «empezar a preparar»;
    // pasa a LISTO cuando todas las áreas despejan su parte. Caja solo cobra o anula.
    if (est === 'COLA') {
      return null;
    }
    if (est === 'PREPARANDO') {
      return {
        label: 'Marcar como listo',
        nuevoEstado: 'LISTO',
        titulo: `¿Marcar el pedido ${pedido.codigo} como listo?`,
        mensaje: 'El pedido pasará a estar listo para entrega o despacho.',
      };
    }
    if (est === 'LISTO') {
      if (mod === 'DELIVERY') {
        return {
          label: 'Despachar (En camino)',
          nuevoEstado: 'EN_CAMINO',
          titulo: `¿Despachar el pedido ${pedido.codigo}?`,
          mensaje: 'El pedido saldrá con el repartidor hacia la dirección del cliente.',
        };
      } else {
        return {
          label: 'Entregar al cliente',
          nuevoEstado: 'ENTREGADO',
          titulo: `¿Entregar el pedido ${pedido.codigo}?`,
          mensaje: 'El pedido quedará registrado como entregado al cliente.',
        };
      }
    }
    if (est === 'EN_CAMINO') {
      return {
        label: 'Marcar entregado',
        nuevoEstado: 'ENTREGADO',
        titulo: `¿Confirmar entrega del pedido ${pedido.codigo}?`,
        mensaje: 'El repartidor finalizó la entrega con éxito.',
      };
    }
    return null;
  };

  const accionEstado = obtenerAccionEstado();

  // Ejecutar cambio de estado confirmado
  const ejecutarCambioEstado = async () => {
    if (!transicionPendiente) return;
    setProcesandoAccion(true);
    setErrorAccion('');
    setMensajeExito('');
    try {
      await pedidosApi.cambiarEstado(
        pedido.id,
        transicionPendiente.nuevoEstado,
      );
      setTransicionPendiente(null);
      setMensajeExito(`Pedido actualizado a ${transicionPendiente.nuevoEstado}`);
      alActualizar();
    } catch (err: any) {
      setErrorAccion(err?.message || 'Error al actualizar el estado del pedido');
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Ejecutar marcado de pago coordinado
  const ejecutarMarcarCoordinado = async () => {
    setConfirmarCoordinado(false);
    setProcesandoAccion(true);
    setErrorAccion('');
    setMensajeExito('');
    try {
      await pedidosApi.marcarPagoCoordinado(pedido.id);
      setMensajeExito('Pago coordinado registrado con éxito');
      alActualizar();
    } catch (err: any) {
      setErrorAccion(err?.message || 'Error al registrar el pago coordinado');
    } finally {
      setProcesandoAccion(false);
    }
  };

  const puedeAnularPedido =
    ['COLA', 'PREPARANDO', 'LISTO'].includes(String(pedido.estado).toUpperCase()) &&
    String(pedido.estado).toUpperCase() !== 'ANULADO';

  const puedeCobrar =
    String(pedido.pago_estado).toUpperCase() !== 'PAGADO' &&
    String(pedido.estado).toUpperCase() !== 'ANULADO';

  const puedeAnularCobro =
    String(pedido.pago_estado).toUpperCase() === 'PAGADO' &&
    String(pedido.estado).toUpperCase() !== 'ANULADO';

  const formatearFecha = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <>
      {/* Cabecera del Detalle */}
      <div className="cj-head" style={{ gap: 8, padding: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 22,
              color: 'var(--cp-navy, #0B2C3E)',
            }}
          >
            {pedido.codigo}
          </div>
          <Insignia
            variante={
              pedido.estado === 'ANULADO'
                ? 'peligro'
                : pedido.estado === 'ENTREGADO' || pedido.pago_estado === 'PAGADO'
                  ? 'exito'
                  : 'aviso'
            }
          >
            {pedido.estado}
          </Insignia>
        </div>

        <div style={{ fontSize: 13, lineHeight: '19px', color: 'var(--cp-soft, #2C4C5D)' }}>
          <b>{pedido.canal}</b> · {pedido.modalidad} · {formatearFecha(pedido.creado_en)}
          <br />
          <b>{pedido.cliente_nombre || 'Cliente'}</b>
          {' · '}
          {puedeVerContacto ? (
            <span>{pedido.cliente_telefono || 'Sin teléfono'}</span>
          ) : (
            <span style={{ fontStyle: 'italic', opacity: 0.7 }}>[Teléfono oculto]</span>
          )}
          {pedido.modalidad === 'DELIVERY' && (
            <>
              <br />
              {puedeVerContacto ? (
                <span>
                  {pedido.entrega_direccion || 'Sin dirección escrita'}
                  {pedido.entrega_referencia && ` (${pedido.entrega_referencia})`}
                </span>
              ) : (
                <span style={{ fontStyle: 'italic', opacity: 0.7 }}>[Dirección oculta]</span>
              )}
            </>
          )}
          {pedido.mesa_nombre && (
            <>
              <br />
              <b>Ubicación:</b> {pedido.mesa_nombre}
            </>
          )}
        </div>

        {/* Pestañas del Detalle */}
        <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(
            [
              ['pedido', 'Pedido'],
              ['cobro', 'Cobro'],
              ['ticket', 'Ticket de cocina'],
              ['comprobante', 'Comprobante'],
            ] as const
          ).map(([id, etiqueta]) => {
            const activa = pestanaActiva === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={activa}
                onClick={() => setPestanaActiva(id)}
                style={{
                  minHeight: 38,
                  padding: '0 14px',
                  borderRadius: 9999,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  background: activa ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                  color: activa ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {etiqueta}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mensajes de aviso */}
      {errorAccion && (
        <div
          role="alert"
          style={{
            margin: '8px 14px 0',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--cp-rust, #B2500F)',
            background: '#FFF0E6',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--cp-rust, #B2500F)',
          }}
        >
          {errorAccion}
        </div>
      )}
      {mensajeExito && (
        <div
          role="status"
          style={{
            margin: '8px 14px 0',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--cp-green, #2F7A45)',
            background: 'var(--cp-greenbg, #DFF3E3)',
            padding: '8px 12px',
            borderRadius: 8,
          }}
        >
          {mensajeExito}
        </div>
      )}

      {/* Contenido scrolleable de las pestañas */}
      <div className="cj-scroll" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* PESTAÑA: PEDIDO */}
        {pestanaActiva === 'pedido' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy, #0B2C3E)' }}>
              Productos solicitados
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pedido.lineas && pedido.lineas.length > 0 ? (
                pedido.lineas.map((linea, idx) => (
                  <div
                    key={linea.id || idx}
                    style={{
                      display: 'flex',
                      gap: 10,
                      borderBottom: '1px solid var(--cp-sand, #F3E9DB)',
                      paddingBottom: 8,
                    }}
                  >
                    <span style={{ fontWeight: 800, minWidth: 24 }}>{linea.cantidad}×</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700 }}>
                          {linea.nombre} {linea.tamano ? `(${linea.tamano})` : ''}
                        </span>
                        <span style={{ fontWeight: 700 }}>S/ {Number(linea.subtotal).toFixed(2)}</span>
                      </div>

                      {/* Personas / Nombres */}
                      {linea.nombres_persona && linea.nombres_persona.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--cp-orange, #E67929)', fontWeight: 700, marginTop: 2 }}>
                          Para: {linea.nombres_persona.join(', ')}
                        </div>
                      )}

                      {/* Opciones elegidas */}
                      {(linea.opcionesElegidas || linea.opciones || []).map((opc, opcIdx) => (
                        <div key={opcIdx} style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                          {opc.grupo_nombre || opc.grupo}: {opc.opcion_nombre || opc.nombre}
                          {Number(opc.precio_extra || 0) > 0 && ` (+S/ ${Number(opc.precio_extra).toFixed(2)})`}
                        </div>
                      ))}

                      {/* Nota de la línea */}
                      {linea.nota && (
                        <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--cp-rust, #B2500F)', marginTop: 2 }}>
                          Nota: {linea.nota}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>Sin líneas de pedido.</div>
              )}
            </div>

            {/* Nota global */}
            {pedido.nota && (
              <div
                style={{
                  border: '1.5px dashed var(--cp-soft, #2C4C5D)',
                  borderRadius: 12,
                  padding: 10,
                  fontSize: 13,
                  background: '#FAF7F2',
                }}
              >
                <b>Nota para cocina:</b> {pedido.nota}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA: COBRO */}
        {pestanaActiva === 'cobro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span>Medio de pago preferido / registrado:</span>
              <span style={{ fontWeight: 700 }}>{pedido.pago_metodo || pedido.pago_preferido || 'Efectivo'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span>Estado del cobro:</span>
              <Insignia variante={pedido.pago_estado === 'PAGADO' ? 'exito' : 'aviso'}>
                {pedido.pago_estado || 'PENDIENTE'}
              </Insignia>
            </div>

            <div
              style={{
                background: 'var(--cp-sand, #F3E9DB)',
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal</span>
                <span>S/ {Number(pedido.subtotal || 0).toFixed(2)}</span>
              </div>
              {Number(pedido.descuento || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--cp-rust, #B2500F)' }}>
                  <span>Descuento</span>
                  <span>- S/ {Number(pedido.descuento).toFixed(2)}</span>
                </div>
              )}
              {Number(pedido.envio || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Costo de envío</span>
                  <span>S/ {Number(pedido.envio).toFixed(2)}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  borderTop: '1px solid var(--cp-line, #E3D6C6)',
                  paddingTop: 6,
                }}
              >
                <span>Total</span>
                <span>S/ {Number(pedido.total).toFixed(2)}</span>
              </div>

              {pedido.paga_con && (
                <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)', marginTop: 4 }}>
                  Cliente paga con: S/ {Number(pedido.paga_con).toFixed(2)}
                  {Number(pedido.paga_con) >= Number(pedido.total) && (
                    <span> · Vuelto: S/ {(Number(pedido.paga_con) - Number(pedido.total)).toFixed(2)}</span>
                  )}
                </div>
              )}
            </div>

            {/* Aviso y acción para pedidos de la carta con pago pendiente (DT-57) */}
            {pedido.pago_estado !== 'PAGADO' && (pedido.canal === 'CARTA' || pedido.canal === 'BOT') && (
              <div
                style={{
                  border: '1.5px solid var(--cp-gold, #D99E39)',
                  background: '#FFF6E3',
                  borderRadius: 10,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 13, lineHeight: '18px', fontWeight: 700 }}>
                  Pedido de la carta: ya está en cocina. Pago por coordinar por WhatsApp. Si el cliente no paga, anúlalo con motivo y el PIN de la supervisora.
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmarCoordinado(true)}
                  style={{
                    minHeight: 44,
                    border: 0,
                    borderRadius: 10,
                    background: 'var(--cp-navy, #0B2C3E)',
                    color: 'var(--cp-cream, #FBF4EC)',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Registrar pago coordinado
                </button>
              </div>
            )}

            {/* Si es pedido de salón */}
            {pedido.modalidad === 'MESA' && (
              <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)', fontStyle: 'italic' }}>
                La mesa se libera al cobrar. El mozo o caja también pueden liberarla a mano en el plano.
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA: TICKET DE COCINA */}
        {pestanaActiva === 'ticket' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 14 }}>
              Ticket impreso (comanda de cocina, papel de 80 mm)
            </div>
            <div
              style={{
                alignSelf: 'center',
                width: 'min(100%, 320px)',
                boxSizing: 'border-box',
                background: 'var(--cp-white, #FFFFFF)',
                border: '1px solid var(--cp-line, #E3D6C6)',
                boxShadow: '0 4px 12px rgba(11, 44, 62, 0.12)',
                padding: '16px 14px',
                fontFamily: 'monospace',
                fontSize: 12,
                lineHeight: '16px',
                color: '#111',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, letterSpacing: '0.08em' }}>
                CAPRICHOS
              </div>
              <div style={{ textAlign: 'center' }}>Café artesanal · Lima</div>
              <div style={{ textAlign: 'center' }}>------------------------------</div>
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
                COMANDA {pedido.codigo}
              </div>
              <div style={{ textAlign: 'center', fontWeight: 700 }}>
                {pedido.modalidad}
              </div>
              <div>Fecha: {new Date(pedido.creado_en).toLocaleString('es-PE')}</div>
              <div>Canal: {pedido.canal}</div>
              <div>Cliente: {pedido.cliente_nombre || 'Cliente'}</div>
              {pedido.mesa_nombre && <div style={{ fontWeight: 700 }}>Mesa: {pedido.mesa_nombre}</div>}
              {pedido.modalidad === 'DELIVERY' && puedeVerContacto && (
                <>
                  <div>Dirección: {pedido.entrega_direccion || '—'}</div>
                  <div>Teléfono: {pedido.cliente_telefono || '—'}</div>
                </>
              )}
              <div style={{ textAlign: 'center' }}>------------------------------</div>
              {pedido.lineas?.map((it, idx) => (
                <div key={idx} style={{ marginBottom: 4 }}>
                  <div style={{ fontWeight: 700 }}>{it.cantidad} × {it.nombre}</div>
                  {it.nombres_persona && (
                    <div style={{ paddingLeft: 12, fontStyle: 'italic' }}>Para: {it.nombres_persona.join(', ')}</div>
                  )}
                  {(it.opcionesElegidas || it.opciones || []).map((o, oi) => (
                    <div key={oi} style={{ paddingLeft: 12 }}>- {o.opcion_nombre || o.nombre}</div>
                  ))}
                  {it.nota && <div style={{ paddingLeft: 12, fontWeight: 700 }}>* {it.nota} *</div>}
                </div>
              ))}
              {pedido.nota && (
                <>
                  <div style={{ textAlign: 'center' }}>------------------------------</div>
                  <div style={{ fontWeight: 700 }}>** NOTA: {pedido.nota} **</div>
                </>
              )}
              <div style={{ textAlign: 'center' }}>------------------------------</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pago: {pedido.pago_metodo || 'Pendiente'}</span>
                <span>{pedido.pago_estado}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                <span>TOTAL</span>
                <span>S/ {Number(pedido.total).toFixed(2)}</span>
              </div>
              <div style={{ textAlign: 'center' }}>------------------------------</div>
              <div style={{ textAlign: 'center', fontStyle: 'italic' }}>Gracias por tu capricho</div>
            </div>
          </div>
        )}

        {/* PESTAÑA: COMPROBANTE */}
        {pestanaActiva === 'comprobante' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 14 }}>
              Comprobante del cliente ({pedido.comprobante_tipo || 'BOLETA'})
            </div>
            <div
              style={{
                alignSelf: 'center',
                width: 'min(100%, 320px)',
                boxSizing: 'border-box',
                background: 'var(--cp-white, #FFFFFF)',
                border: '1px solid var(--cp-line, #E3D6C6)',
                boxShadow: '0 4px 12px rgba(11, 44, 62, 0.12)',
                padding: '16px 14px',
                fontFamily: 'monospace',
                fontSize: 12,
                lineHeight: '16px',
                color: 'var(--cp-navy, #0B2C3E)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, letterSpacing: '0.08em' }}>
                CAPRICHOS CAFÉ
              </div>
              <div style={{ textAlign: 'center' }}>
                {pedido.comprobante_tipo || 'BOLETA ELECTRÓNICA'}
              </div>
              <div style={{ textAlign: 'center' }}>{pedido.codigo}</div>
              <div style={{ textAlign: 'center' }}>------------------------------</div>
              <div>Cliente: {pedido.comprobante_razon || pedido.cliente_nombre || 'Cliente'}</div>
              {pedido.comprobante_doc && <div>Doc.: {pedido.comprobante_doc}</div>}
              <div>Fecha: {new Date(pedido.creado_en).toLocaleString('es-PE')}</div>
              <div style={{ textAlign: 'center' }}>------------------------------</div>
              {pedido.lineas?.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{it.cantidad} × {it.nombre}</span>
                  <span>S/ {Number(it.subtotal).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ textAlign: 'center' }}>------------------------------</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                <span>TOTAL</span>
                <span>S/ {Number(pedido.total).toFixed(2)}</span>
              </div>
              <div style={{ textAlign: 'center', marginTop: 6 }}>Gracias por tu capricho</div>
            </div>
          </div>
        )}
      </div>

      {/* Pie de acciones fijo (.cj-foot) */}
      <div className="cj-foot" style={{ gap: 8, padding: '12px 16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: 16,
          }}
        >
          <span>Total</span>
          <span style={{ color: 'var(--cp-rust, #B2500F)' }}>S/ {Number(pedido.total).toFixed(2)}</span>
        </div>

        {/* Acciones contextuales */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Botón de transición de estado */}
          {accionEstado && pedido.estado !== 'ANULADO' && (
            <Boton
              variante="primario"
              cargando={procesandoAccion}
              onClick={() => setTransicionPendiente(accionEstado)}
              style={{
                flex: '1 1 180px',
                minHeight: 48,
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              {accionEstado.label}
            </Boton>
          )}

          {/* Botón Cobrar */}
          {puedeCobrar && (
            <Boton
              variante="oscuro"
              onClick={() => setAbrirCobro(true)}
              style={{
                flex: '1 1 140px',
                minHeight: 48,
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              Cobrar pedido
            </Boton>
          )}

          {/* Botón Anular cobro */}
          {puedeAnularCobro && (
            <Boton
              variante="peligro"
              onClick={() => setAbrirAnularCobro(true)}
              style={{
                flex: '1 1 130px',
                minHeight: 48,
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              Anular cobro
            </Boton>
          )}

          {/* Botón Anular Pedido */}
          {puedeAnularPedido && (
            <Boton
              variante="peligro"
              onClick={() => setAbrirAnular(true)}
              style={{
                flex: '1 1 120px',
                minHeight: 48,
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              Anular pedido
            </Boton>
          )}
        </div>
      </div>

      {/* Modal Cobrar */}
      {abrirCobro && (
        <ModalCobrar
          pedido={pedido}
          alCerrar={() => setAbrirCobro(false)}
          alCobrarExitoso={() => {
            setAbrirCobro(false);
            setMensajeExito('Cobro registrado exitosamente');
            alActualizar();
          }}
        />
      )}

      {/* Modal Anular Pedido */}
      {abrirAnular && (
        <ModalAnular
          pedidoId={pedido.id}
          codigoPedido={pedido.codigo}
          alCerrar={() => setAbrirAnular(false)}
          alAnularExitoso={() => {
            setAbrirAnular(false);
            setMensajeExito('Pedido anulado con éxito');
            alActualizar();
          }}
        />
      )}

      {/* Modal Anular Cobro */}
      {abrirAnularCobro && (
        <ModalAnular
          pedidoId={pedido.id}
          codigoPedido={pedido.codigo}
          esCobro={true}
          cobroId={(pedido as any).cobro?.id || pedido.id}
          alCerrar={() => setAbrirAnularCobro(false)}
          alAnularExitoso={() => {
            setAbrirAnularCobro(false);
            setMensajeExito('Cobro anulado con éxito; el pedido vuelve a estado pendiente');
            alActualizar();
          }}
        />
      )}

      {/* Confirmación de transición de estado */}
      {transicionPendiente && (
        <Confirmar
          abierto={Boolean(transicionPendiente)}
          titulo={transicionPendiente.titulo}
          mensaje={transicionPendiente.mensaje}
          textoSi="Confirmar"
          alConfirmar={ejecutarCambioEstado}
          alCancelar={() => setTransicionPendiente(null)}
        />
      )}

      {/* Confirmación de marcar pago coordinado */}
      {confirmarCoordinado && (
        <Confirmar
          abierto={confirmarCoordinado}
          titulo={`¿Marcar pago coordinado para ${pedido.codigo}?`}
          mensaje="Se registrará que el asesor coordinó el pago por WhatsApp. No se reenviará la comanda a cocina."
          textoSi="Sí, coordinado"
          alConfirmar={ejecutarMarcarCoordinado}
          alCancelar={() => setConfirmarCoordinado(false)}
        />
      )}
    </>
  );
}

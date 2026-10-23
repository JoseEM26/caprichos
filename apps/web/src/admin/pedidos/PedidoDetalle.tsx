import { useState, useEffect } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { Pedido, pedidosApi } from './pedidosApi';
import { ModalCobrar } from './ModalCobrar';
import { ModalAnular } from './ModalAnular';
import { ModalUbicar } from './ModalUbicar';
import { ModalPrecuenta } from '../salon/componentes/ModalPrecuenta';
import { ModalConfirmarPago } from './ModalConfirmarPago';
import { canalLabel, modLabel, getBadge } from './PedidosAdminView';
import {
  listarPersonalActivo,
  registrarConsumoCredito,
  ColaboradorActivo,
} from '../creditos/creditosApi';
import { salonApi } from '../salon/api';

export interface PedidoDetalleProps {
  pedido: Pedido;
  alActualizar: () => void;
  alRepetir?: (pedido: Pedido) => void;
}

type TabDetalle = 'pedido' | 'cobro' | 'ticket' | 'etiquetas' | 'comprobante';

export function PedidoDetalle({ pedido, alActualizar, alRepetir }: PedidoDetalleProps) {
  const [tab, setTab] = useState<TabDetalle>('pedido');

  // Modales
  const [abrirCobrar, setAbrirCobrar] = useState(false);
  const [abrirAnular, setAbrirAnular] = useState(false);
  const [abrirUbicar, setAbrirUbicar] = useState(false);
  const [abrirPrecuenta, setAbrirPrecuenta] = useState(false);
  const [abrirConfirmarPago, setAbrirConfirmarPago] = useState(false);
  const [abrirCreditoPersonal, setAbrirCreditoPersonal] = useState(false);

  // Confirmar genérico Sí/No para acciones que cambian datos
  const [accionConfirmar, setAccionConfirmar] = useState<{
    titulo: string;
    mensaje: string;
    textoConfirmar?: string;
    ejecutar: () => Promise<void>;
  } | null>(null);

  // Estados locales para acciones
  const [tipoComp, setTipoComp] = useState<string>(pedido.comprobante_tipo || 'Nota de venta');
  const [comprobanteSubido, setComprobanteSubido] = useState<string | null>(null);
  const [msgTicket, setMsgTicket] = useState('');
  const [msgEtiquetas, setMsgEtiquetas] = useState('');
  const [msgComprobante, setMsgComprobante] = useState('');
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [coordinandoDestino, setCoordinandoDestino] = useState('Merma');

  // Estado modal Crédito del personal
  const [personalLista, setPersonalLista] = useState<ColaboradorActivo[]>([]);
  const [personalElegidoId, setPersonalElegidoId] = useState<string>('');
  const [errorCredito, setErrorCredito] = useState<string | null>(null);

  useEffect(() => {
    if (abrirCreditoPersonal) {
      setErrorCredito(null);
      listarPersonalActivo()
        .then((lista) => {
          const arr = Array.isArray(lista) ? lista : [];
          setPersonalLista(arr);
          if (arr.length > 0 && !personalElegidoId) {
            setPersonalElegidoId(String(arr[0].partyId));
          }
        })
        .catch(() => setPersonalLista([]));
    }
  }, [abrirCreditoPersonal]);

  const est = String(pedido.estado || '').toUpperCase();
  const pag = String(pedido.pago_estado || '').toUpperCase();
  const mod = String(pedido.modalidad || '').toUpperCase();
  const esDelivery = mod === 'DELIVERY';
  const esMesa = mod === 'MESA';
  const estaPagado = pag === 'PAGADO';
  const tienePagoCoordinado = Boolean(pedido.pago_coordinado_en) || pag === 'COORDINADO';
  const esPorConfirmar =
    (est === 'COLA' || est === 'NUEVO') &&
    !estaPagado &&
    !tienePagoCoordinado &&
    !esMesa;
  const esPagoPorCoordinar =
    !esMesa &&
    !estaPagado &&
    !tienePagoCoordinado &&
    est !== 'ANULADO' &&
    est !== 'RECHAZADO' &&
    est !== 'ENTREGADO' &&
    est !== 'COLA' &&
    est !== 'NUEVO';

  // Configuración de estado visual (badge del mockup)
  const stBadge = getBadge(pedido);

  // Datos de contacto y mapa
  const lat = pedido.entrega_lat;
  const lng = pedido.entrega_lng;
  const hasMapCoords = lat != null && lng != null && lat !== '' && lng !== '';

  const phoneClean = (pedido.cliente_telefono || '').replace(/\D/g, '');
  const waUrl = phoneClean
    ? `https://wa.me/51${phoneClean}?text=${encodeURIComponent(`Hola ${pedido.cliente_nombre || ''}, te escribimos de Caprichos sobre tu pedido ${pedido.codigo}.`)}`
    : '#';

  // Transiciones de estado con confirmación Sí/No
  const cambiarEstado = async (nuevoEstado: string, motivo?: string) => {
    setProcesando(true);
    setErrorAccion(null);
    try {
      await pedidosApi.cambiarEstado(pedido.id, nuevoEstado, motivo);
      alActualizar();
    } catch (err: any) {
      setErrorAccion(err?.message || 'Error al actualizar el estado del pedido');
    } finally {
      setProcesando(false);
    }
  };

  const pedirConfirmacionEstado = (
    nuevoEstado: string,
    titulo: string,
    mensaje: string,
    motivo?: string,
  ) => {
    setAccionConfirmar({
      titulo,
      mensaje,
      textoConfirmar: 'Sí, continuar',
      ejecutar: async () => {
        await cambiarEstado(nuevoEstado, motivo);
      },
    });
  };

  const tabs: Array<{ id: TabDetalle; label: string }> = [
    { id: 'pedido', label: 'Pedido' },
    { id: 'cobro', label: 'Cobro' },
    { id: 'ticket', label: 'Ticket de cocina' },
    ...(est !== 'ANULADO' && est !== 'RECHAZADO' ? [{ id: 'etiquetas' as TabDetalle, label: 'Etiquetas' }] : []),
    ...(!esPorConfirmar && est !== 'ANULADO' && est !== 'RECHAZADO' ? [{ id: 'comprobante' as TabDetalle, label: 'Comprobante' }] : []),
  ];

  const totalNum = Number(pedido.total || 0);

  return (
    <>
      <div className="cj-head" style={{ gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--cp-navy, #0B2C3E)' }}>
            {pedido.codigo}
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 9999,
              padding: '3px 12px',
              background: stBadge.bg,
              color: stBadge.fg,
            }}
          >
            {stBadge.l}
          </span>
        </div>

        <div style={{ fontSize: 13, lineHeight: '19px', color: 'var(--cp-soft, #2C4C5D)' }}>
          {canalLabel(pedido.canal)} · {modLabel(pedido.modalidad)}
          <br />
          {pedido.cliente_nombre || 'Cliente'} · {pedido.cliente_telefono || 'Sin teléfono'}
          {esDelivery && (
            <>
              <br />
              {pedido.entrega_direccion || 'Sin dirección registrada'}
              <br />
              {!hasMapCoords ? (
                <button
                  type="button"
                  onClick={() => setAbrirUbicar(true)}
                  style={{
                    minHeight: 44,
                    padding: '0 14px',
                    marginTop: 4,
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    borderRadius: 10,
                    background: 'rgb(255, 241, 201)',
                    color: 'var(--cp-navy, #0B2C3E)',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Ubicar en el mapa (falta la ubicación)
                </button>
              ) : (
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontWeight: 800,
                      color: 'var(--cp-teal, #2C6E7F)',
                      textDecoration: 'underline',
                    }}
                  >
                    Ver en el mapa
                  </a>
                  <button
                    type="button"
                    onClick={() => setAbrirUbicar(true)}
                    style={{
                      minHeight: 34,
                      padding: '0 10px',
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      borderRadius: 9999,
                      background: 'transparent',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Corregir ubicación en el mapa
                  </button>
                </span>
              )}
            </>
          )}
          {esMesa && pedido.mesa_nombre && (
            <>
              <br />
              {String(pedido.mesa_nombre).toLowerCase().startsWith('mesa')
                ? pedido.mesa_nombre
                : `Mesa ${pedido.mesa_nombre}`}
            </>
          )}
        </div>

        {/* 5 Tabs */}
        <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map((t) => {
            const activo = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={activo}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  minHeight: 38,
                  padding: '0 14px',
                  borderRadius: 9999,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  background: activo ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                  color: activo ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="cj-scroll" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* TAB: PEDIDO */}
        {tab === 'pedido' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pedido.lineas && pedido.lineas.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pedido.lineas.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontWeight: 800 }}>{it.cantidad}×</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700 }}>{it.nombre}</span>
                      {it.nombres_persona && it.nombres_persona.length > 0 && (
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                          Para: {it.nombres_persona.join(', ')}
                        </span>
                      )}
                      {(it.opcionesElegidas || it.opciones || []).map((o, oi) => (
                        <span key={oi} style={{ display: 'block', fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                          + {o.opcion_nombre || o.nombre}
                        </span>
                      ))}
                      {it.nota && (
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--cp-rust, #B2500F)', fontWeight: 700 }}>
                          * {it.nota} *
                        </span>
                      )}
                    </span>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      S/ {Number(it.subtotal || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--cp-soft, #2C4C5D)', fontSize: 13 }}>Sin líneas detalladas.</div>
            )}

            {pedido.nota && (
              <div style={{ border: '1.5px dashed var(--cp-soft, #2C4C5D)', borderRadius: 12, padding: 10, fontSize: 13 }}>
                Nota para cocina: {pedido.nota}
              </div>
            )}
          </div>
        )}

        {/* TAB: COBRO */}
        {tab === 'cobro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Estado del pago</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  borderRadius: 9999,
                  padding: '3px 12px',
                  background: estaPagado ? 'var(--cp-greenbg, #DFF3E3)' : '#FFF0E6',
                  color: estaPagado ? '#1F5C33' : 'var(--cp-rust, #B2500F)',
                }}
              >
                {estaPagado ? 'PAGADO' : 'PENDIENTE'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Medio de pago</span>
              <span style={{ fontWeight: 700 }}>{pedido.pago_metodo || pedido.pago_preferido || 'Efectivo'}</span>
            </div>

            {/* Selector de comprobante */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>Comprobante</span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Nota de venta', 'Boleta', 'Factura'].map((n) => {
                  const sel = tipoComp === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTipoComp(n)}
                      style={{
                        minHeight: 44,
                        padding: '0 12px',
                        borderRadius: 9999,
                        border: '1.5px solid var(--cp-navy, #0B2C3E)',
                        background: sel ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                        color: sel ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </span>
            </div>

            {esMesa && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)', marginBottom: 6 }}>
                  La mesa se libera al cobrar. Un mozo o caja también puede liberarla a mano en Nuevo pedido, En el local.
                </div>
                <button
                  type="button"
                  onClick={() => setAbrirPrecuenta(true)}
                  style={{
                    minHeight: 44,
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    borderRadius: 12,
                    background: 'transparent',
                    color: 'var(--cp-navy, #0B2C3E)',
                    fontWeight: 700,
                    width: '100%',
                    cursor: 'pointer',
                  }}
                >
                  Sacar precuenta (el cajero cobra)
                </button>
              </div>
            )}

            {/* Comprobante de pago subido (imagen) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Comprobante de pago digital</div>
              {comprobanteSubido ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <img
                    src={comprobanteSubido}
                    alt="Comprobante de pago"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 200,
                      objectFit: 'contain',
                      border: '1px solid var(--cp-line, #E3D6C6)',
                      borderRadius: 10,
                      background: 'var(--cp-white, #FFFFFF)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setComprobanteSubido(null)}
                    style={{
                      alignSelf: 'flex-start',
                      minHeight: 36,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: '1.5px solid var(--cp-rust, #B2500F)',
                      background: 'transparent',
                      color: 'var(--cp-rust, #B2500F)',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Quitar comprobante
                  </button>
                </div>
              ) : (
                <label
                  style={{
                    minHeight: 44,
                    border: '1.5px dashed var(--cp-navy, #0B2C3E)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--cp-navy, #0B2C3E)',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Subir comprobante de pago
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setComprobanteSubido(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                    style={{ position: 'absolute', left: -9999 }}
                  />
                </label>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 18,
                borderTop: '1px solid var(--cp-line, #E3D6C6)',
                paddingTop: 8,
              }}
            >
              <span>Total</span>
              <span>S/ {totalNum.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* TAB: TICKET DE COCINA */}
        {tab === 'ticket' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 14 }}>
              Ticket impreso (comanda de cocina, papel de 80 mm)
            </div>
            <div style={{ fontSize: 12, lineHeight: '17px', color: 'var(--cp-soft, #2C4C5D)' }}>
              Impreso en cocina y barra · 1 copia
            </div>
            <div
              style={{
                alignSelf: 'center',
                width: 'min(100%, 300px)',
                boxSizing: 'border-box',
                background: 'var(--cp-white, #FFFFFF)',
                border: '1px solid var(--cp-line, #E3D6C6)',
                boxShadow: '0 4px 12px rgba(11, 44, 62, 0.15)',
                padding: '16px 14px',
                fontFamily: "'Courier New', monospace",
                fontSize: 12,
                lineHeight: '16px',
                color: '#111',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, letterSpacing: '0.08em' }}>CAPRICHOS</div>
              <div style={{ textAlign: 'center' }}>Café artesanal · Lima</div>
              <div style={{ textAlign: 'center' }}>------------------------------</div>
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14 }}>COMANDA {pedido.codigo}</div>
              <div style={{ textAlign: 'center', fontWeight: 700 }}>{pedido.modalidad}</div>
              <div>Fecha: {new Date(pedido.creado_en).toLocaleString('es-PE')}</div>
              <div>Canal: {pedido.canal}</div>
              <div>Cliente: {pedido.cliente_nombre || 'Cliente'}</div>
              {esMesa && <div style={{ fontWeight: 700 }}>Mesa: {pedido.mesa_nombre || '1'}</div>}
              {esDelivery && (
                <>
                  <div>Dirección: {pedido.entrega_direccion || '—'}</div>
                  <div>Ref.: {pedido.entrega_referencia || '—'}</div>
                  <div>Tel.: {pedido.cliente_telefono || '—'}</div>
                </>
              )}
              <div style={{ textAlign: 'center' }}>------------------------------</div>
              {(pedido.lineas || []).map((it, idx) => (
                <div key={idx}>
                  <span style={{ fontWeight: 700 }}>{it.cantidad} x {it.nombre}</span>
                  {(it.opcionesElegidas || it.opciones || []).map((o, oi) => (
                    <div key={oi} style={{ paddingLeft: 16 }}>- {o.opcion_nombre || o.nombre}</div>
                  ))}
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
                <span>S/ {totalNum.toFixed(2)}</span>
              </div>
              <div style={{ textAlign: 'center' }}>------------------------------</div>
              <div style={{ textAlign: 'center' }}>Wi-Fi: Caprichos-Clientes · clave 12345678</div>
              <div style={{ textAlign: 'center' }}>Imprime: Cocina caliente</div>
              <div style={{ textAlign: 'center' }}>Gracias por tu capricho</div>
            </div>
            <div style={{ fontSize: 12, lineHeight: '17px', color: 'var(--cp-soft, #2C4C5D)' }}>
              Las etiquetas adhesivas (general, por área y por bebida) están en la pestaña Etiquetas.
            </div>
            <button
              type="button"
              onClick={() => setMsgTicket('Ticket enviado a la impresora.')}
              style={{
                minHeight: 44,
                border: '1.5px solid var(--cp-navy, #0B2C3E)',
                borderRadius: 12,
                background: 'transparent',
                color: 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Reimprimir ticket
            </button>
            {msgTicket && (
              <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}>
                {msgTicket}
              </div>
            )}
          </div>
        )}

        {/* TAB: ETIQUETAS */}
        {tab === 'etiquetas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, lineHeight: '17px', color: 'var(--cp-soft, #2C4C5D)' }}>
              Sale una general en caja, una por área en su etiquetera y una por vaso en barra.
            </div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>
              {pedido.lineas?.length || 1} producto(s) en este pedido
            </div>

            {msgEtiquetas && (
              <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}>
                {msgEtiquetas}
              </div>
            )}

            {/* 1. General */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 14 }}>
                1. Etiqueta general del pedido
              </div>
              <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                Una por pedido, para la bolsa o la bandeja. Sale en la etiquetera de caja.
              </div>
              <div
                style={{
                  width: 230,
                  fontFamily: "'Courier New', monospace",
                  fontSize: 12,
                  lineHeight: '15px',
                  color: '#111',
                  background: 'var(--cp-white, #FFFFFF)',
                  border: '1px solid var(--cp-line, #E3D6C6)',
                  borderRadius: 8,
                  boxShadow: '0 3px 10px rgba(11, 44, 62, 0.15)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ background: 'var(--cp-navy, #0B2C3E)', color: 'var(--cp-cream, #FBF4EC)', padding: '5px 10px', fontWeight: 700, letterSpacing: '0.08em' }}>
                  CAPRICHOS · PEDIDO
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 22, lineHeight: '26px' }}>
                    {pedido.codigo}
                  </div>
                  <div style={{ fontWeight: 700 }}>{pedido.modalidad} · {pedido.cliente_nombre || 'Cliente'}</div>
                  <div>{pedido.canal} · {new Date(pedido.creado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  <div style={{ borderTop: '1px dashed #999', margin: '5px 0' }} />
                  <div>{pedido.lineas?.reduce((acc, l) => acc + l.cantidad, 0) || 1} productos</div>
                  <div>Total: S/ {totalNum.toFixed(2)}</div>
                </div>
                <div style={{ background: 'var(--cp-sand, #EDE1D1)', padding: '3px 10px', fontSize: 12 }}>
                  Sale en: Etiquetera Caja
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMsgEtiquetas('Etiqueta general enviada a la etiquetera de caja.')}
                style={{
                  alignSelf: 'flex-start',
                  minHeight: 44,
                  padding: '0 14px',
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  borderRadius: 10,
                  background: 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Reimprimir la general
              </button>
            </div>

            {/* 2. Por área */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 14 }}>
                2. Etiquetas por área
              </div>
              <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                Una por cada área que tiene productos en el pedido.
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: 230,
                    fontFamily: "'Courier New', monospace",
                    fontSize: 12,
                    lineHeight: '15px',
                    color: '#111',
                    background: 'var(--cp-white, #FFFFFF)',
                    border: '1px solid var(--cp-line, #E3D6C6)',
                    borderRadius: 8,
                    boxShadow: '0 3px 10px rgba(11, 44, 62, 0.15)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ background: '#7A3516', color: '#FFF', padding: '5px 10px', fontWeight: 700, letterSpacing: '0.08em' }}>
                    ÁREA · COCINA
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18 }}>
                      {pedido.codigo} · {pedido.cliente_nombre || 'Cliente'}
                    </div>
                    <div>{pedido.modalidad}</div>
                    <div style={{ borderTop: '1px dashed #999', margin: '5px 0' }} />
                    {(pedido.lineas || []).slice(0, 3).map((l, i) => (
                      <div key={i}>
                        <b>{l.cantidad}× {l.nombre}</b>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'var(--cp-sand, #EDE1D1)', padding: '3px 10px', fontSize: 12 }}>
                    Sale en: Etiquetera Cocina
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMsgEtiquetas('Etiquetas de área enviadas a las impresoras.')}
                style={{
                  alignSelf: 'flex-start',
                  minHeight: 44,
                  padding: '0 14px',
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  borderRadius: 10,
                  background: 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Reimprimir las de área
              </button>
            </div>
          </div>
        )}

        {/* TAB: COMPROBANTE */}
        {tab === 'comprobante' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 14 }}>
              Comprobante del cliente ({tipoComp})
            </div>
            <div
              style={{
                alignSelf: 'center',
                width: 'min(100%, 300px)',
                boxSizing: 'border-box',
                background: 'var(--cp-white, #FFFFFF)',
                border: '1px solid var(--cp-line, #E3D6C6)',
                boxShadow: '0 4px 12px rgba(11, 44, 62, 0.15)',
                padding: '16px 14px',
                fontFamily: "'Courier New', monospace",
                fontSize: 12,
                lineHeight: '16px',
                color: 'var(--cp-navy, #0B2C3E)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, letterSpacing: '0.08em' }}>CAPRICHOS</div>
              <div style={{ textAlign: 'center' }}>{tipoComp} {pedido.codigo}</div>
              <div style={{ textAlign: 'center' }}>------------------------------</div>
              {(pedido.lineas || []).map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{it.cantidad} x {it.nombre}</span>
                  <span>S/ {Number(it.subtotal || 0).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ textAlign: 'center' }}>------------------------------</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                <span>TOTAL</span>
                <span>S/ {totalNum.toFixed(2)}</span>
              </div>
              <div style={{ textAlign: 'center' }}>Gracias por tu capricho</div>
              <div style={{ textAlign: 'center', marginTop: 6 }}>- - - - - - cortar aquí - - - - - -</div>
              <div
                style={{
                  border: '2px dashed var(--cp-navy, #0B2C3E)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  marginTop: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700 }}>✂ 15 % de descuento</span>
                <span style={{ fontSize: 14, fontWeight: 800, lineHeight: '18px' }}>En tu siguiente capricho</span>
                <span style={{ fontSize: 12 }}>Válido 15 días desde la compra</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Código: FIDELIDAD-0102</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMsgComprobante('Comprobante enviado a la impresora.')}
              style={{
                minHeight: 44,
                border: '1.5px solid var(--cp-navy, #0B2C3E)',
                borderRadius: 12,
                background: 'transparent',
                color: 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Imprimir comprobante con cupones
            </button>
            {msgComprobante && (
              <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}>
                {msgComprobante}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FOOTER (.cj-foot) */}
      <div className="cj-foot" style={{ gap: 8, padding: '12px 16px' }}>
        {errorAccion && (
          <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
            {errorAccion}
          </div>
        )}
        {mensajeExito && (
          <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}>
            {mensajeExito}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16 }}>
          <span>Total</span>
          <span>S/ {totalNum.toFixed(2)}</span>
        </div>

        {/* 1. Si es por confirmar */}
        {esPorConfirmar && (
          <>
            <div style={{ fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft, #2C4C5D)' }}>
              Pedido fuera del local: aún no pasa a cocina. Habla con el cliente por WhatsApp, confirma el pago y sube el comprobante. Recién entonces va a las pantallas.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setAbrirConfirmarPago(true)}
                style={{
                  flex: '1 1 200px',
                  minHeight: 52,
                  border: 0,
                  borderRadius: 12,
                  background: 'var(--cp-orange, #E67929)',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: 'pointer',
                }}
              >
                Confirmar pedido y pago
              </button>
              <button
                type="button"
                onClick={() => setAbrirAnular(true)}
                style={{
                  flex: '1 1 120px',
                  minHeight: 52,
                  border: '1.5px solid var(--cp-rust, #B2500F)',
                  borderRadius: 12,
                  background: 'transparent',
                  color: 'var(--cp-rust, #B2500F)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Rechazar
              </button>
            </div>
          </>
        )}

        {/* 2. Si es pago por coordinar (entrega fallida u orden directa) */}
        {!esPorConfirmar && esPagoPorCoordinar && (
          <div style={{ border: '2px solid var(--cp-rust, #B2500F)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: '#FBE9DF' }}>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15 }}>
              Entrega fallida: El cliente no contestó
            </div>
            <div style={{ fontSize: 13, lineHeight: '18px' }}>
              El repartidor estuvo en la puerta y llamó 3 veces. Habla con el cliente antes de decidir.
            </div>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                minHeight: 48,
                boxSizing: 'border-box',
                border: 0,
                borderRadius: 12,
                background: 'var(--cp-green, #2F7A45)',
                color: 'var(--cp-white, #FFFFFF)',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
              }}
            >
              Hablar con el cliente por WhatsApp
            </a>
            <div style={{ fontSize: 13, fontWeight: 700 }}>¿Qué se hace con lo preparado?</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Merma', 'Personal', 'Donación'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setCoordinandoDestino(d)}
                  style={{
                    minHeight: 44,
                    padding: '0 12px',
                    borderRadius: 9999,
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    fontWeight: 700,
                    fontSize: 12,
                    background: coordinandoDestino === d ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                    color: coordinandoDestino === d ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                    cursor: 'pointer',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Cuando termines de hablar con el cliente, elige cómo se cierra:</div>
            <button
              type="button"
              onClick={() =>
                pedirConfirmacionEstado(
                  'EN_CAMINO',
                  `¿Reprogramar la entrega de ${pedido.codigo}?`,
                  'El pedido volverá a salir a reparto con cargo adicional de flete.',
                  'Reprogramada la entrega',
                )
              }
              style={{
                minHeight: 48,
                border: '1.5px solid var(--cp-navy, #0B2C3E)',
                borderRadius: 12,
                background: 'var(--cp-white, #FFFFFF)',
                color: 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Reprogramar la entrega (+ s/ 5.00 de flete)
            </button>
            <button
              type="button"
              onClick={() => setAbrirAnular(true)}
              style={{
                minHeight: 48,
                border: '1.5px solid var(--cp-rust, #B2500F)',
                borderRadius: 12,
                background: 'var(--cp-white, #FFFFFF)',
                color: 'var(--cp-rust, #B2500F)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Devolver el dinero (anular el pedido)
            </button>
            <button
              type="button"
              onClick={() =>
                pedirConfirmacionEstado(
                  'ENTREGADO',
                  `¿Cerrar el pedido ${pedido.codigo} como cobrado igual?`,
                  `Se cerrará el pedido y lo preparado quedará registrado como ${coordinandoDestino}.`,
                  `Cobrado igual sin entrega (${coordinandoDestino})`,
                )
              }
              style={{
                minHeight: 48,
                border: '1.5px solid var(--cp-navy, #0B2C3E)',
                borderRadius: 12,
                background: 'var(--cp-white, #FFFFFF)',
                color: 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Cobrar igual (el cliente no recibió)
            </button>
          </div>
        )}

        {/* 3. Botones de cobro si no está pagado y no es por confirmar */}
        {!esPorConfirmar && !estaPagado && est !== 'ANULADO' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setAbrirCobrar(true)}
              style={{
                flex: '1 1 140px',
                minHeight: 48,
                border: '1.5px solid var(--cp-navy, #0B2C3E)',
                borderRadius: 12,
                background: 'transparent',
                color: 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Registrar cobro
            </button>
            <button
              type="button"
              onClick={() => setAbrirCreditoPersonal(true)}
              style={{
                flex: '1 1 180px',
                minHeight: 48,
                border: '1.5px solid var(--cp-orange, #E67929)',
                borderRadius: 12,
                background: 'transparent',
                color: 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Cobrar a crédito del personal
            </button>
          </div>
        )}

        {/* 4. Si está listo y para entregar */}
        {est === 'LISTO' && (
          <button
            type="button"
            disabled={procesando}
            onClick={() =>
              pedirConfirmacionEstado(
                'ENTREGADO',
                `¿Marcar ${pedido.codigo} como entregado y cerrar?`,
                'El pedido pasará a la pestaña Cerrados.',
              )
            }
            style={{
              minHeight: 52,
              border: 0,
              borderRadius: 12,
              background: 'var(--cp-navy, #0B2C3E)',
              color: 'var(--cp-cream, #FBF4EC)',
              fontWeight: 800,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Entregar al cliente y cerrar
          </button>
        )}

        {/* 5. Si está en mesa y listo para servir */}
        {esMesa && (est === 'PREPARANDO' || (est === 'LISTO' && !pedido.entregado_mesa_en)) && (
          <button
            type="button"
            disabled={procesando}
            onClick={() =>
              setAccionConfirmar({
                titulo: `¿Confirmas que ya llevaste ${pedido.codigo} a la mesa?`,
                mensaje: 'Quedará registrado como servido en mesa.',
                textoConfirmar: 'Sí, ya lo llevé',
                ejecutar: async () => {
                  if (est === 'LISTO') {
                    await salonApi.marcarEntregadoMesa(String(pedido.id));
                    alActualizar();
                  } else {
                    await cambiarEstado('LISTO');
                  }
                },
              })
            }
            style={{
              minHeight: 52,
              border: 0,
              borderRadius: 12,
              background: 'var(--cp-orange, #E67929)',
              color: 'var(--cp-navy, #0B2C3E)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Ya lo llevé a la mesa
          </button>
        )}

        {/* 6. Repetir pedido y Anular pedido */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => alRepetir?.(pedido)}
            style={{
              flex: '1 1 140px',
              minHeight: 44,
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              borderRadius: 12,
              background: 'transparent',
              color: 'var(--cp-navy, #0B2C3E)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Repetir este pedido
          </button>

          {est !== 'ANULADO' && (
            <button
              type="button"
              onClick={() => setAbrirAnular(true)}
              style={{
                flex: '1 1 120px',
                minHeight: 44,
                border: '1.5px solid var(--cp-rust, #B2500F)',
                borderRadius: 12,
                background: 'transparent',
                color: 'var(--cp-rust, #B2500F)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Anular pedido
            </button>
          )}
        </div>
      </div>

      {/* Modales */}
      {abrirCobrar && (
        <ModalCobrar
          pedido={pedido}
          alCerrar={() => setAbrirCobrar(false)}
          alCobrarExitoso={() => {
            setAbrirCobrar(false);
            alActualizar();
          }}
        />
      )}

      {abrirAnular && (
        <ModalAnular
          pedidoId={pedido.id}
          codigoPedido={pedido.codigo}
          alCerrar={() => setAbrirAnular(false)}
          alAnularExitoso={() => {
            setAbrirAnular(false);
            alActualizar();
          }}
        />
      )}

      {abrirPrecuenta && (
        <ModalPrecuenta
          abierto={true}
          alCerrar={() => setAbrirPrecuenta(false)}
          mesa={pedido.mesa_nombre || ''}
          lineas={(pedido.lineas || []).map((l) => ({
            cantidad: l.cantidad,
            nombre: l.nombre,
            detalle: [l.tamano, ...(l.opciones || l.opcionesElegidas || []).map((o) => o.opcion_nombre || o.nombre)]
              .filter(Boolean)
              .join(' · '),
          }))}
          total={Number(pedido.total)}
        />
      )}

      {abrirUbicar && (
        <ModalUbicar
          pedidoId={pedido.id}
          codigoPedido={pedido.codigo}
          direccionInicial={pedido.entrega_direccion}
          puntoInicial={
            hasMapCoords ? { lat: Number(pedido.entrega_lat), lng: Number(pedido.entrega_lng) } : null
          }
          alCerrar={() => setAbrirUbicar(false)}
          alUbicar={() => {
            setAbrirUbicar(false);
            alActualizar();
          }}
        />
      )}

      {abrirConfirmarPago && (
        <ModalConfirmarPago
          pedido={pedido}
          alCerrar={() => setAbrirConfirmarPago(false)}
          alConfirmarExitoso={(datos) => {
            if (datos?.comprobanteImg) {
              setComprobanteSubido(datos.comprobanteImg);
            }
            setAbrirConfirmarPago(false);
            alActualizar();
          }}
        />
      )}

      {/* Modal Cobrar a crédito del personal */}
      {abrirCreditoPersonal && (
        <>
          <div
            onClick={() => setAbrirCreditoPersonal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 55,
              background: 'rgba(11, 44, 62, 0.55)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cobrar a crédito del personal"
            style={{
              position: 'fixed',
              zIndex: 60,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(480px, calc(100% - 24px))',
              background: 'var(--cp-cream, #FBF4EC)',
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--cp-navy, #0B2C3E)' }}>
              Cobrar {pedido.codigo} a crédito del personal
            </div>
            <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
              Se aplica el 15 % de descuento al personal sobre S/ {totalNum.toFixed(2)} ={' '}
              <b>S/ {(Math.round(totalNum * 0.85 * 100) / 100).toFixed(2)}</b>.
            </div>
            <label htmlFor="cr-emp" style={{ fontWeight: 800, fontSize: 13 }}>
              Trabajador (usuario)
            </label>
            <select
              id="cr-emp"
              value={personalElegidoId}
              onChange={(e) => setPersonalElegidoId(e.target.value)}
              style={{
                width: '100%',
                minHeight: 46,
                borderRadius: 10,
                border: '1.5px solid var(--cp-line, #E3D6C6)',
                background: 'var(--cp-white, #FFFFFF)',
                padding: '0 12px',
                fontSize: 14,
              }}
            >
              {personalLista.map((u) => (
                <option key={u.partyId} value={String(u.partyId)}>
                  {u.nombre} ({u.rol})
                </option>
              ))}
            </select>
            {errorCredito && (
              <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                {errorCredito}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={!personalElegidoId || procesando}
                onClick={() => {
                  const emp = personalLista.find(
                    (u) => String(u.partyId) === String(personalElegidoId),
                  );
                  const montoDesc = (Math.round(totalNum * 0.85 * 100) / 100).toFixed(2);
                  setAccionConfirmar({
                    titulo: `¿Anotar S/ ${montoDesc} en la cuenta de ${emp?.nombre || 'este trabajador'}?`,
                    mensaje: `Se aplicará el descuento del personal y el pedido ${pedido.codigo} quedará pagado a crédito.`,
                    textoConfirmar: 'Sí, anotar',
                    ejecutar: async () => {
                      setProcesando(true);
                      setErrorCredito(null);
                      try {
                        await registrarConsumoCredito(pedido.id, personalElegidoId);
                        setAbrirCreditoPersonal(false);
                        setMensajeExito(
                          `Consumo anotado a crédito de ${emp?.nombre || 'personal'}.`,
                        );
                        alActualizar();
                      } catch (err: any) {
                        setErrorCredito(
                          err?.message || 'Error al registrar el consumo a crédito',
                        );
                      } finally {
                        setProcesando(false);
                      }
                    },
                  });
                }}
                style={{
                  flex: 1,
                  minHeight: 48,
                  border: 0,
                  borderRadius: 12,
                  background: 'var(--cp-orange, #E67929)',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Anotar consumo
              </button>
              <button
                type="button"
                onClick={() => setAbrirCreditoPersonal(false)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  borderRadius: 12,
                  background: 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Diálogo Confirmar genérico Sí/No */}
      <Confirmar
        abierto={Boolean(accionConfirmar)}
        titulo={accionConfirmar?.titulo || '¿Confirmar acción?'}
        mensaje={accionConfirmar?.mensaje || ''}
        textoConfirmar={accionConfirmar?.textoConfirmar || 'Sí'}
        textoNo="No"
        cargando={procesando}
        alConfirmar={async () => {
          if (accionConfirmar) {
            const fn = accionConfirmar.ejecutar;
            setAccionConfirmar(null);
            await fn();
          }
        }}
        alCancelar={() => setAccionConfirmar(null)}
      />
    </>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Confirmar } from '../../comun/Confirmar';
import {
  SelectorComprobante,
  aPayloadComprobante,
  errorValorComprobante,
  etiquetaComprobante,
  type TipoComprobanteSel,
  type ValorComprobante,
} from './SelectorComprobante';
import { useSesion } from '../../comun/sesion';
import { LineaPedido, Pedido, pedidosApi } from './pedidosApi';
import { ModalCobrar } from './ModalCobrar';
import { useConfirmarImpresion } from '../impresion/useConfirmarImpresion';
import { SeccionVouchersPedido } from './SeccionVouchersPedido';
import { PruebaEntregaFallida } from './PruebaEntregaFallida';
import { ModalAnular } from './ModalAnular';
import { ModalCortesia } from '../cortesias/ModalCortesia';
import { cortesiasApi } from '../cortesias/cortesiasApi';
import { ModalRechazarCobroMozo } from './ModalRechazarCobroMozo';
import { ModalUbicar } from './ModalUbicar';
import { ModalPrecuenta } from '../salon/componentes/ModalPrecuenta';
import { ModalConfirmarPago } from './ModalConfirmarPago';
import { EtiquetasPedido } from './EtiquetasPedido';
import { InsigniaModalidad } from './InsigniaModalidad';
import { NombreCliente } from './TarjetaPedidoCaja';
import { canalLabel, modLabel, getBadge, ChipCobroMozo } from './PedidosAdminView';
import { EtiquetaCajaCerrada, esperaCajaCerrada } from './BannerCajaCerrada';
import {
  listarPersonalActivo,
  registrarConsumoCredito,
  ColaboradorActivo,
} from '../creditos/creditosApi';
import { salonApi } from '../salon/api';
import { BotonAbrirChatCliente } from '../mensajes/BotonAbrirChatCliente';
import { SeccionUbicacionPedido } from './SeccionUbicacionPedido';
import { InsigniaNumeroDia } from './InsigniaNumeroDia';
import { AvisoDeliverySinUbicacion } from './AvisoDeliverySinUbicacion';
import { MENSAJE_DELIVERY_SIN_UBICACION, deliverySinUbicacion } from './ubicacionDelivery';

export interface PedidoDetalleProps {
  pedido: Pedido;
  alActualizar: () => void;
  alRepetir?: (pedido: Pedido) => void;
  /** Abre el editor de productos y datos (solo para pedidos sin cobrar en cola, preparando o listo). */
  alEditar?: (pedido: Pedido) => void;
  /** Abre el modal en modo «extra»: pedido nuevo enlazado a este (permiso pedidos/extra). */
  alAgregarExtra?: (pedido: Pedido) => void;
  /** Abre otro pedido (enlaces de «Extras» y «EXTRA de …»). */
  alAbrirPedido?: (id: string) => void;
  /** Nombre de quien tiene abierto el editor de este pedido (llega por socket a la lista; vale 2 minutos). */
  editandoPor?: string | null;
  /** Estado de la caja de hoy (lo pasa la lista). Con caja cerrada, un pedido sin cobrar lleva «Caja cerrada». */
  cajaAbierta?: boolean | null;
}

type TabDetalle = 'pedido' | 'cobro' | 'ticket' | 'etiquetas' | 'comprobante';

/** Fila etiqueta-valor de una tarjeta del detalle. */
function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 14 }}>
      <span style={{ color: 'var(--cp-soft, #2C4C5D)' }}>{etiqueta}</span>
      <span style={{ fontWeight: 700, textAlign: 'right' }}>{valor}</span>
    </div>
  );
}

/** Comprobante guardado en el pedido como valor del selector. Sin simple, boleta ni factura guardada (nota de venta antigua), sin elegir. */
function valorDelPedido(pedido: Pedido): ValorComprobante {
  const t = String(pedido.comprobante_tipo ?? '').toUpperCase();
  const tipo: TipoComprobanteSel | null = t === 'SIMPLE' || t === 'BOLETA' || t === 'FACTURA' ? t : null;
  return {
    tipo,
    doc: tipo === null ? '' : pedido.comprobante_doc ?? '',
    razon: pedido.comprobante_razon ?? '',
    direccion: pedido.comprobante_direccion ?? '',
  };
}

/** Solo se puede dar cortesía sobre una línea de producto, sin combo ni oferta, en un pedido sin cobrar ni descuento. */
function puedeCortesiaLinea(pedido: Pedido, it: LineaPedido): boolean {
  return (
    !it.es_cortesia &&
    !!it.producto_id &&
    !it.linea_combo_id &&
    !it.oferta_id &&
    pedido.pago_estado !== 'PAGADO' &&
    Number(pedido.descuento || 0) === 0
  );
}

export function PedidoDetalle({ pedido, alActualizar, alRepetir, alEditar, alAgregarExtra, alAbrirPedido, editandoPor, cajaAbierta }: PedidoDetalleProps) {
  const { tiene, usuario } = useSesion();
  // El SUPERVISOR presenta su código para dar una cortesía; ADMIN y Caja no
  const pideCodigoCortesia = usuario?.rol === 'SUPERVISOR';
  const [lineaCortesia, setLineaCortesia] = useState<LineaPedido | null>(null);
  const [tab, setTab] = useState<TabDetalle>('pedido');

  // Modales
  const [abrirCobrar, setAbrirCobrar] = useState(false);
  const [abrirAnular, setAbrirAnular] = useState(false);
  const [abrirUbicar, setAbrirUbicar] = useState(false);
  const [abrirPrecuenta, setAbrirPrecuenta] = useState(false);
  const [abrirRechazarMozo, setAbrirRechazarMozo] = useState(false);
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
  // Comprobante del pedido (el que tiene guardado); se cambia con «Cambiar comprobante» antes de cobrar
  const tipoComp = pedido.comprobante_tipo ? etiquetaComprobante(pedido.comprobante_tipo) : 'Sin elegir';
  const [cambiandoComp, setCambiandoComp] = useState(false);
  const [valorCambio, setValorCambio] = useState<ValorComprobante>(() => valorDelPedido(pedido));
  const [confirmarCambio, setConfirmarCambio] = useState(false);
  const [guardandoComp, setGuardandoComp] = useState(false);
  const [errorComp, setErrorComp] = useState<string | null>(null);
  const [msgTicket, setMsgTicket] = useState('');
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
  const tieneCobroVigente = estaPagado || Boolean(pedido.cobro_vigente_id);
  // Editar: con permiso, mientras no esté cobrado y el pedido esté en cola, preparando o listo
  const puedeEditar =
    !!alEditar &&
    tiene('pedidos/editar') &&
    ['COLA', 'PREPARANDO', 'LISTO'].includes(est) &&
    !tieneCobroVigente &&
    !pedido.cobroMozo;
  // Extra: con permiso y mientras el pedido no esté anulado ni rechazado (entregado o pagado sí)
  const puedeAgregarExtra = !!alAgregarExtra && tiene('pedidos/extra') && est !== 'ANULADO' && est !== 'RECHAZADO';
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
  // Delivery sin repartidor: el servidor no lo deja pasar a ENTREGADO (409 REPARTIDOR_REQUERIDO)
  const sinRepartidor = pedido.modalidad === 'DELIVERY' && !pedido.repartidor_party_id;
  // Delivery sin punto o sin zona: no se confirma, cobra ni pasa a cocina hasta ubicarlo (el servidor lo rechaza igual)
  const sinUbicar = deliverySinUbicacion(pedido) && !['ANULADO', 'RECHAZADO', 'ENTREGADO'].includes(String(pedido.estado || '').toUpperCase());

  const handleAbrirAnular = async () => {
    if (tieneCobroVigente && !pedido.cobro_vigente_id) {
      try {
        const pedDet = await pedidosApi.obtenerPorId(pedido.id);
        if (pedDet.cobro_vigente_id) {
          pedido.cobro_vigente_id = pedDet.cobro_vigente_id;
        }
      } catch {
        // Continuar si falla
      }
    }
    setAbrirAnular(true);
  };

  // Configuración de estado visual (badge del mockup)
  const stBadge = getBadge(pedido);

  // Datos de contacto y mapa
  const lat = pedido.entrega_lat;
  const lng = pedido.entrega_lng;
  const hasMapCoords = lat != null && lng != null && lat !== '' && lng !== '';

  // Transiciones de estado con confirmación Sí/No
  const { pedir: pedirImpresion, dialogo: dialogoImpresion } = useConfirmarImpresion();
  const cambiarEstado = async (nuevoEstado: string, motivo?: string) => {
    // Aceptar el pedido (COLA/PREPARANDO) manda las etiquetas a imprimir: se avisa si falta una máquina
    if (nuevoEstado === 'COLA' || nuevoEstado === 'PREPARANDO') {
      return pedirImpresion(() => ejecutarCambioEstado(nuevoEstado, motivo));
    }
    return ejecutarCambioEstado(nuevoEstado, motivo);
  };
  const ejecutarCambioEstado = async (nuevoEstado: string, motivo?: string) => {
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
    // Siempre visible: un pedido anulado o rechazado puede tener etiquetas VENCIDAS que se ven y reimprimen aqui
    { id: 'etiquetas' as TabDetalle, label: 'Etiquetas' },
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
          <InsigniaNumeroDia numero={pedido.numero_dia} />
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
          {esperaCajaCerrada(pedido, cajaAbierta ?? null) && <EtiquetaCajaCerrada />}
        </div>

        {pedido.pedido_origen && (
          <button
            type="button"
            data-testid="insignia-extra"
            onClick={() => alAbrirPedido?.(pedido.pedido_origen!.id)}
            style={{ alignSelf: 'flex-start', border: 0, borderRadius: 999, padding: '4px 12px', background: '#FFF4D6', color: 'var(--cp-navy, #0B2C3E)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            EXTRA de {pedido.pedido_origen.codigo}
          </button>
        )}

        {(pedido.extras?.length ?? 0) > 0 && (
          <div data-testid="lista-extras" style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#FFF9EC', borderRadius: 12, padding: '10px 12px' }}>
            <strong style={{ fontSize: 14 }}>Extras</strong>
            {pedido.extras!.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => alAbrirPedido?.(e.id)}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 8, border: 0, background: 'transparent', padding: 0, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontWeight: 700 }}>{e.codigo} · {e.estado}{e.pago_estado ? ` · ${e.pago_estado}` : ''}</span>
                <span style={{ fontWeight: 800 }}>S/ {Number(e.total).toFixed(2)}</span>
              </button>
            ))}
            {pedido.total_con_extras != null && (
              <div data-testid="total-con-extras" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, borderTop: '1px solid rgba(0,0,0,.12)', paddingTop: 6 }}>
                <span>Total con extras</span>
                <span>S/ {pedido.total_con_extras.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {pedido.cobroMozo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <ChipCobroMozo cobro={pedido.cobroMozo} />
            <span style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
              Mozo: {pedido.cobroMozo.mozo || 'sin nombre'} · a las{' '}
              {new Date(pedido.cobroMozo.en).toLocaleTimeString('es-PE', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Lima',
              })}
            </span>
            {pedido.cobroMozo.recibido != null && (
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-navy, #0B2C3E)' }}>
                Recibió S/ {Number(pedido.cobroMozo.recibido).toFixed(2)} · vuelto S/{' '}
                {Number(pedido.cobroMozo.vuelto ?? 0).toFixed(2)}
              </span>
            )}
            {tiene('caja/cobrar') && pedido.pago_estado !== 'PAGADO' && (
              <button
                type="button"
                onClick={() => setAbrirRechazarMozo(true)}
                style={{
                  minHeight: 44,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1.5px solid var(--cp-rust, #B2500F)',
                  background: 'var(--cp-white, #FFFFFF)',
                  color: 'var(--cp-rust, #B2500F)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Rechazar cobro del mozo
              </button>
            )}
          </div>
        )}

        <div style={{ fontSize: 13, lineHeight: '19px', color: 'var(--cp-soft, #2C4C5D)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}><NombreCliente pedido={pedido} /></div>
            <InsigniaModalidad modalidad={pedido.modalidad} mesaNombre={pedido.mesa_nombre} />
          </div>
          {canalLabel(pedido.canal)} · {modLabel(pedido.modalidad)} · {pedido.cliente_telefono || 'Sin teléfono'}
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

        {esDelivery && (
          <SeccionUbicacionPedido
            pedidoId={String(pedido.id)}
            codigo={pedido.codigo}
            estado={pedido.estado}
            lat={hasMapCoords ? Number(pedido.entrega_lat) : null}
            lng={hasMapCoords ? Number(pedido.entrega_lng) : null}
            direccion={pedido.entrega_direccion}
            alActualizar={alActualizar}
          />
        )}

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
                  minHeight: 44,
                  padding: '0 18px',
                  borderRadius: 9999,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  background: activo ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                  color: activo ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="cj-scroll cj-detalle-cuerpo" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* TAB: PEDIDO */}
        {tab === 'pedido' && (
          <div className="cj-dos">
            <section className="cj-card" aria-label="Productos del pedido">
              <div className="cj-card-titulo">Productos</div>
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
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'right' }}>
                      S/ {Number(it.subtotal || 0).toFixed(2)}
                      {it.es_cortesia && (
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                          Cortesía · vale S/ {Number(it.cortesia?.valor_lista ?? 0).toFixed(2)}
                        </span>
                      )}
                      {puedeCortesiaLinea(pedido, it) && tiene('cortesias/dar') && (
                        <button
                          type="button"
                          onClick={() => setLineaCortesia(it)}
                          style={{ display: 'block', marginTop: 4, marginLeft: 'auto', minHeight: 36, fontSize: 12, fontWeight: 800, background: 'none', border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}
                        >
                          Dar como cortesía
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--cp-soft, #2C4C5D)', fontSize: 13 }}>Sin líneas detalladas.</div>
            )}

            {pedido.nota && (
              <div style={{ border: '1.5px dashed var(--cp-soft, #2C4C5D)', borderRadius: 12, padding: 10, fontSize: 14 }}>
                Nota para cocina: {pedido.nota}
              </div>
            )}
            </section>
            <section className="cj-card" aria-label="Resumen del pedido">
              <div className="cj-card-titulo">Resumen y cobro</div>
              <FilaDato etiqueta="Estado del pago" valor={estaPagado ? 'Pagado' : 'Pendiente'} />
              <FilaDato etiqueta="Medio de pago" valor={pedido.pago_metodo || pedido.pago_preferido || 'Efectivo'} />
              {pedido.puntos?.texto && (
                <FilaDato
                  etiqueta="Puntos"
                  valor={
                    pedido.puntos.estado === 'SUMADO'
                      ? `+${(pedido.puntos.puntos ?? 0).toFixed(2)}`
                      : pedido.puntos.estado === 'PENDIENTE_DE_COBRO'
                        ? `Se sumarán ${(pedido.puntos.estimado ?? 0).toFixed(2)}`
                        : `No suma: ${pedido.puntos.texto}`
                  }
                />
              )}
              <FilaDato etiqueta="Subtotal" valor={`S/ ${Number(pedido.subtotal || 0).toFixed(2)}`} />
              {Number(pedido.descuento || 0) > 0 && (
                <FilaDato etiqueta="Descuento" valor={`- S/ ${Number(pedido.descuento || 0).toFixed(2)}`} />
              )}
              {Number(pedido.envio || 0) > 0 && (
                <FilaDato etiqueta="Envío" valor={`S/ ${Number(pedido.envio || 0).toFixed(2)}`} />
              )}
            </section>
          </div>
        )}

        {/* TAB: COBRO */}
        {tab === 'cobro' && (
          <div className="cj-dos">
            <section className="cj-card" aria-label="Estado del cobro">
              <div className="cj-card-titulo">Cobro</div>
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

            {/* Comprobante: se cambia solo antes de cobrar y sin comprobante emitido (la API lo rechaza si no) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>Comprobante</span>
              <span style={{ fontWeight: 700 }}>{tipoComp}</span>
            </div>
            {tiene('caja/cobrar') && !estaPagado && est !== 'ANULADO' && !cambiandoComp && (
              <button
                type="button"
                onClick={() => {
                  setValorCambio(valorDelPedido(pedido));
                  setErrorComp(null);
                  setCambiandoComp(true);
                }}
                style={{
                  minHeight: 44,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  borderRadius: 12,
                  background: 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cambiar comprobante
              </button>
            )}
            {cambiandoComp && (
              <div aria-label="Cambiar comprobante" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SelectorComprobante idPrefijo="pd-comp" valor={valorCambio} onChange={setValorCambio} total={Number(pedido.total)} />
                {errorComp && (
                  <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                    {errorComp}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const err = errorValorComprobante(valorCambio);
                      if (err) {
                        setErrorComp(err.mensaje);
                        document.getElementById(`pd-comp-${err.campo}`)?.focus();
                        return;
                      }
                      setErrorComp(null);
                      setConfirmarCambio(true);
                    }}
                    style={{ flex: '1 1 140px', minHeight: 44, border: 'none', borderRadius: 12, background: 'var(--cp-navy, #0B2C3E)', color: 'var(--cp-cream, #FBF4EC)', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Guardar comprobante
                  </button>
                  <button
                    type="button"
                    onClick={() => setCambiandoComp(false)}
                    style={{ flex: '1 1 140px', minHeight: 44, border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 12, background: 'transparent', color: 'var(--cp-navy, #0B2C3E)', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            </section>
            <section className="cj-card" aria-label="Total a cobrar">
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
            </section>
          </div>
        )}

        {/* TAB: TICKET DE COCINA */}
        {tab === 'ticket' && (
          <div className="cj-dos">
            <section className="cj-card" aria-label="Ticket de cocina">
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
            </section>
            <section className="cj-card" aria-label="Reimprimir el ticket">
            <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--cp-soft, #2C4C5D)' }}>
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
            </section>
          </div>
        )}

        {/* TAB: ETIQUETAS */}
        {tab === 'etiquetas' && (
          <EtiquetasPedido pedido={pedido} />
        )}

        {/* TAB: COMPROBANTE */}
        {tab === 'comprobante' && (
          <div className="cj-dos">
            <section className="cj-card" aria-label="Vista del comprobante">
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15 }}>
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
            </section>
            <section className="cj-card" aria-label="Imprimir el comprobante">
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
            </section>
          </div>
        )}
      </div>

      {/* FOOTER (.cj-foot) */}
      <div className="cj-foot cj-detalle-pie" style={{ gap: 8 }}>
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

        {sinUbicar && (
          <AvisoDeliverySinUbicacion
            pedidoId={String(pedido.id)}
            codigo={pedido.codigo}
            direccion={pedido.entrega_direccion}
            alActualizar={alActualizar}
          />
        )}

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
                disabled={sinUbicar}
                title={sinUbicar ? MENSAJE_DELIVERY_SIN_UBICACION : undefined}
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
                  cursor: sinUbicar ? 'not-allowed' : 'pointer',
                  opacity: sinUbicar ? 0.6 : 1,
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
            <BotonAbrirChatCliente telefono={pedido.cliente_telefono} />
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

        {/* Prueba de entrega fallida (cliente no salió): hora de llegada, espera, repartidor y fotos */}
        <PruebaEntregaFallida prueba={pedido.prueba_entrega} />

        {/* Comprobantes del pedido (foto del pago digital, cualquier origen) */}
        <SeccionVouchersPedido
          pedidoId={pedido.id}
          recargarClave={pedido.pago_estado}
          total={pedido.total}
          medio={pedido.pago_metodo || pedido.pago_preferido || null}
        />

        {/* 3. Botones de cobro si no está pagado y no es por confirmar */}
        {!esPorConfirmar && !estaPagado && est !== 'ANULADO' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setAbrirCobrar(true)}
              disabled={sinUbicar}
              title={sinUbicar ? MENSAJE_DELIVERY_SIN_UBICACION : undefined}
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
              disabled={sinUbicar}
              title={sinUbicar ? MENSAJE_DELIVERY_SIN_UBICACION : undefined}
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

        {/* 4. Si está listo y para entregar. Un delivery sin repartidor no se entrega (REPARTIDOR_REQUERIDO) */}
        {est === 'LISTO' && sinRepartidor && (
          <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
            Asigna un repartidor antes de marcar el pedido como entregado.{' '}
            <Link to="/admin/repartos" style={{ color: 'inherit', textDecoration: 'underline' }}>
              Ir a Repartos
            </Link>
          </div>
        )}
        {est === 'LISTO' && (
          <button
            type="button"
            disabled={procesando || sinRepartidor}
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

        {/* 6. Editar, repetir y anular pedido */}
        {editandoPor && (
          <div role="status" style={{ background: '#FFF4D6', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 700, color: 'var(--cp-navy, #0B2C3E)' }}>
            {editandoPor} está editando este pedido.
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {puedeEditar && (
            <button
              type="button"
              onClick={() => alEditar?.(pedido)}
              style={{
                flex: '1 1 140px',
                minHeight: 44,
                border: '1.5px solid var(--cp-navy, #0B2C3E)',
                borderRadius: 12,
                background: 'var(--cp-navy, #0B2C3E)',
                color: 'var(--cp-cream, #FBF4EC)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Editar pedido
            </button>
          )}
          {puedeAgregarExtra && (
            <button
              type="button"
              onClick={() => alAgregarExtra?.(pedido)}
              style={{
                flex: '1 1 140px',
                minHeight: 44,
                border: '1.5px solid var(--cp-orange, #E67929)',
                borderRadius: 12,
                background: 'var(--cp-orange, #E67929)',
                color: 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Agregar extra
            </button>
          )}
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
              onClick={handleAbrirAnular}
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
              {tieneCobroVigente ? 'Anular cobro' : 'Anular pedido'}
            </button>
          )}
        </div>
      </div>

      {/* Modales */}
      {dialogoImpresion}
      {abrirCobrar && (
        <ModalCobrar
          pedido={pedido}
          alCerrar={() => setAbrirCobrar(false)}
          alCobrarExitoso={() => {
            setAbrirCobrar(false);
            alActualizar();
          }}
          alActualizarPedido={() => {
            setAbrirCobrar(false);
            alActualizar();
          }}
        />
      )}

      {lineaCortesia && (
        <ModalCortesia
          titulo={`Dar como cortesía: ${lineaCortesia.nombre}`}
          resumen={`Pedido ${pedido.codigo}. La línea pasa a S/ 0.00 y el total del pedido baja.`}
          pideCodigo={pideCodigoCortesia}
          alCerrar={() => setLineaCortesia(null)}
          alConfirmar={async (datos, codigo) => {
            await cortesiasApi.darEnLinea(pedido.id, lineaCortesia.id, datos, codigo);
            setLineaCortesia(null);
            alActualizar();
          }}
        />
      )}

      {abrirAnular && (
        <ModalAnular
          pedidoId={pedido.id}
          codigoPedido={pedido.codigo}
          esCobro={tieneCobroVigente}
          cobroId={pedido.cobro_vigente_id ?? undefined}
          alCerrar={() => setAbrirAnular(false)}
          alAnularExitoso={() => {
            setAbrirAnular(false);
            alActualizar();
          }}
        />
      )}

      {abrirRechazarMozo && (
        <ModalRechazarCobroMozo
          pedidoId={pedido.id}
          codigoPedido={pedido.codigo}
          alCerrar={() => setAbrirRechazarMozo(false)}
          alRechazar={() => {
            setAbrirRechazarMozo(false);
            alActualizar();
          }}
        />
      )}

      {abrirPrecuenta && (
        <ModalPrecuenta
          abierto={true}
          pedidoId={pedido.id}
          comprobantePedido={{
            tipo: pedido.comprobante_tipo,
            documento: pedido.comprobante_doc,
            razon: pedido.comprobante_razon,
            direccion: pedido.comprobante_direccion,
          }}
          alCerrar={() => setAbrirPrecuenta(false)}
          mesa={pedido.mesa_nombre || ''}
          lineas={(pedido.lineas || []).map((l) => ({
            cantidad: l.cantidad,
            nombre: l.nombre,
            detalle: [l.tamano, ...(l.opciones || l.opcionesElegidas || []).map((o) => o.opcion_nombre || o.nombre)]
              .filter(Boolean)
              .join(' · '),
            precio: Number(l.subtotal),
          }))}
          total={Number(pedido.total)}
          subtotal={Number(pedido.subtotal)}
          descuento={Number(pedido.descuento || 0)}
          plan={pedido.planPago}
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
          alActualizarPedido={() => {
            setAbrirConfirmarPago(false);
            alActualizar();
          }}
          alConfirmarExitoso={() => {
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
        abierto={confirmarCambio}
        titulo="Cambiar comprobante"
        mensaje={`¿Cambiar el comprobante del pedido a ${valorCambio.tipo ? etiquetaComprobante(valorCambio.tipo) : ''}${valorCambio.tipo !== 'SIMPLE' && valorCambio.doc.trim() ? ` (${valorCambio.tipo === 'FACTURA' ? 'RUC' : 'DNI'} ${valorCambio.doc.trim()})` : ''}? ${valorCambio.tipo === 'SIMPLE' ? 'No se envía a SUNAT.' : 'Caja lo emitirá al cobrar.'}`}
        textoSi="Sí, cambiar"
        textoNo="No"
        cargando={guardandoComp}
        alConfirmar={async () => {
          setGuardandoComp(true);
          setErrorComp(null);
          try {
            const dto = aPayloadComprobante(valorCambio);
            if (!dto) throw new Error('Elige comprobante simple, boleta o factura');
            await pedidosApi.cambiarComprobante(pedido.id, dto);
            setConfirmarCambio(false);
            setCambiandoComp(false);
            setMensajeExito('Comprobante cambiado');
            alActualizar();
          } catch (err: any) {
            setConfirmarCambio(false);
            setErrorComp(err?.message || 'No se pudo cambiar el comprobante');
          } finally {
            setGuardandoComp(false);
          }
        }}
        alCancelar={() => setConfirmarCambio(false)}
      />
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

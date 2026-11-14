import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Confirmar } from '../../comun/Confirmar';
import { useSesion } from '../../comun/sesion';
import { tieneRolUsuario } from '../../comun/rolesUsuario';
import { AccionesComerLocal } from '../salon/componentes/AccionesComerLocal';
import { LineaPedido, Pedido, pedidosApi, montoPorCobrar } from './pedidosApi';
import { ModalCobrar } from './ModalCobrar';
import { useConfirmarImpresion } from '../impresion/useConfirmarImpresion';
import { ModalAnular } from './ModalAnular';
import { ModalVolverAtras } from './ModalVolverAtras';
import { ModalRevertirAnulacion } from './ModalRevertirAnulacion';
import { fechaLima } from '../../comun/agotadoTiempo';
import { ModalCortesia } from '../cortesias/ModalCortesia';
import { cortesiasApi } from '../cortesias/cortesiasApi';
import { ModalRechazarCobroMozo } from './ModalRechazarCobroMozo';
import { ModalUbicar } from './ModalUbicar';
import { ModalCorregirCliente } from './ModalCorregirCliente';
import { ModalPrecuenta } from '../salon/componentes/ModalPrecuenta';
import { ModalConfirmarPago } from './ModalConfirmarPago';
import { useAvisoCocinaPendiente } from './avisoCocinaPendiente';
import { useAvisoCobroPendiente } from './avisoCobroPendiente';
import { esDeliveryContraEntrega } from './mediosPago';
import { InsigniaModalidad } from './InsigniaModalidad';
import { InsigniaMesa } from './InsigniaMesa';
import { esCerrado } from './estadosCaja';
import { PastillaEspera } from './PastillaEspera';
import { canalLabel, modLabel, getBadge, ChipCobroMozo } from './PedidosAdminView';
import { EtiquetaCajaCerrada, esperaCajaCerrada } from './BannerCajaCerrada';
import {
  listarPersonalActivo,
  registrarConsumoCredito,
  ColaboradorActivo,
} from '../creditos/creditosApi';
import { salonApi } from '../salon/api';
import { BotonAbrirChatCliente } from '../mensajes/BotonAbrirChatCliente';
import { InsigniaNumeroDia } from './InsigniaNumeroDia';
import { AvisoDeliverySinUbicacion } from './AvisoDeliverySinUbicacion';
import { descuentosDePedido } from '@caprichos/compartido';
import { lineasPrecuenta } from './precuentaDetalle';
import { MENSAJE_DELIVERY_SIN_UBICACION, deliverySinUbicacion } from './ubicacionDelivery';
import { InsigniaCambioCobro, useCambiosCobroPendientes } from './PanelCambioCobro';
import { CapaProductos } from './CapaProductos';
import { CapaPago } from './CapaPago';
import { CapaEntrega } from './CapaEntrega';
import { PanelImpresion } from './PanelImpresion';
import { ReimprimirPedido } from './ReimprimirPedido';
import { ImpresionesDelPedido } from './ImpresionesDelPedido';
import { HistorialPedidoModal } from './HistorialPedidoModal';
import './detalle-pedido.css';

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

type Capa = 'productos' | 'pago' | 'entrega';

const CAPAS: Array<{ id: Capa; largo: string; corto: string }> = [
  { id: 'productos', largo: 'Productos', corto: 'Productos' },
  { id: 'pago', largo: 'Pago y voucher', corto: 'Pago' },
  { id: 'entrega', largo: 'Cliente y entrega', corto: 'Entrega' },
];

const TRAZO = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ICONOS = {
  imprimir: <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z" />,
  editar: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  extra: <path d="M12 5v14M5 12h14" />,
  repetir: <path d="M4 12a8 8 0 0114-5l2 2M20 4v5h-5M20 12a8 8 0 01-14 5l-2-2M4 20v-5h5" />,
  precuenta: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />,
  credito: <path d="M3 6h18v12H3zM3 10h18M7 15h3" />,
  anular: <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8" />,
} as const;

function Ico({ n }: { n: keyof typeof ICONOS }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...TRAZO}>
      {ICONOS[n]}
    </svg>
  );
}

/** Botón secundario de la barra: icono (≥44 px) y, en PC, su nombre; el nombre accesible es siempre completo. */
function BotonIcono({ n, texto, etiqueta, alClic, peligro, deshabilitado, titulo }: { n: keyof typeof ICONOS; texto: string; etiqueta?: string; alClic: () => void; peligro?: boolean; deshabilitado?: boolean; titulo?: string }) {
  return (
    <button type="button" className={`dp-ico${peligro ? ' dp-ico-rust' : ''}`} aria-label={etiqueta ?? texto} title={titulo ?? etiqueta ?? texto} disabled={deshabilitado} onClick={alClic}>
      <Ico n={n} />
      <span className="dp-btxt">{texto}</span>
    </button>
  );
}

export function PedidoDetalle({ pedido, alActualizar, alRepetir, alEditar, alAgregarExtra, alAbrirPedido, editandoPor, cajaAbierta }: PedidoDetalleProps) {
  const { tiene, usuario } = useSesion();
  const [lineaCortesia, setLineaCortesia] = useState<LineaPedido | null>(null);
  const [capa, setCapa] = useState<Capa>('productos');
  const [abrirImpresion, setAbrirImpresion] = useState(false);
  const [abrirHistorial, setAbrirHistorial] = useState(false);

  // Modales
  const [abrirCobrar, setAbrirCobrar] = useState(false);
  const [abrirAnular, setAbrirAnular] = useState(false);
  const [abrirVolverAtras, setAbrirVolverAtras] = useState(false);
  const [abrirRevertir, setAbrirRevertir] = useState(false);
  const [abrirAnularPedido, setAbrirAnularPedido] = useState(false);
  const [abrirUbicar, setAbrirUbicar] = useState(false);
  const [abrirCorregirCliente, setAbrirCorregirCliente] = useState(false);
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

  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const { manejar: avisoCocina, dialogo: dialogoCocina } = useAvisoCocinaPendiente(() => alActualizar());
  const { manejar: avisoCobro, dialogo: dialogoCobro } = useAvisoCobroPendiente(() => alActualizar());
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

  // «Cambio de cobro solicitado» por el repartidor: solo se consulta con el permiso de validarlo
  const { pendientes: cambiosCobro } = useCambiosCobroPendientes(tiene('pedidos/validar_cambio_cobro'));
  const cambioCobroPendiente = cambiosCobro.some((c) => c.pedidoId === String(pedido.id));

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
  // Corregir datos del cliente: con permiso y en cualquier estado salvo anulado o rechazado (entregado o cobrado sí)
  const puedeCorregirCliente = tiene('pedidos/corregir_cliente') && est !== 'ANULADO' && est !== 'RECHAZADO';
  const esPorConfirmar =
    (est === 'COLA' || est === 'NUEVO') &&
    !estaPagado &&
    !tienePagoCoordinado &&
    !esMesa;
  const contraEntrega = esPorConfirmar && esDeliveryContraEntrega(pedido);
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
  // Volver atrás: solo Caja y Administrador, un pedido entregado; deshabilitado con el motivo si ya no aplica (el servidor lo valida igual)
  const puedeVolverAtras = est === 'ENTREGADO' && tiene('pedidos/anular') && (tieneRolUsuario(usuario, 'ADMIN') || tieneRolUsuario(usuario, 'CAJERO'));
  // Revertir una anulación: solo ADMIN y SUPERVISOR (el servidor responde 403 al resto)
  const puedeRevertirAnulacion = est === 'ANULADO' && tiene('pedidos/anular') && (tieneRolUsuario(usuario, 'ADMIN') || tieneRolUsuario(usuario, 'SUPERVISOR'));
  // Pedido pagado todavía sin entregar: además de «Anular cobro», se puede anular el pedido eligiendo qué pasa con el dinero
  const puedeAnularPedidoPagado = tieneCobroVigente && ['COLA', 'PREPARANDO', 'LISTO'].includes(est) && tiene('pedidos/anular');
  const motivoNoVolverAtras =
    cajaAbierta === false
      ? 'Ya cerró la caja del día'
      : pedido.entregado_en && fechaLima(new Date(pedido.entregado_en).getTime()) !== fechaLima(Date.now())
        ? 'Solo se vuelve atrás un pedido entregado hoy'
        : null;
  const puedeCobrar = !esPorConfirmar && !estaPagado && est !== 'ANULADO';

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
      if (avisoCocina(err, pedido.id, nuevoEstado)) return;
      if (avisoCobro(err, pedido.id, nuevoEstado, () => setAbrirCobrar(true))) return;
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

  const totalNum = Number(pedido.total || 0);
  const hora = new Date(pedido.creado_en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });
  const pagoChip = pedido.es_personal
    ? { t: 'Crédito del personal · se paga en su cuenta', bg: '#E3EEF8', fg: 'var(--cp-navy, #0B2C3E)' }
    : Number(pedido.monto_credito || 0) > 0
    ? { t: estaPagado ? `Pagado · A crédito del personal S/ ${Number(pedido.monto_credito).toFixed(2)}` : `A crédito del personal S/ ${Number(pedido.monto_credito).toFixed(2)} · Por cobrar S/ ${montoPorCobrar(pedido).toFixed(2)}`, bg: estaPagado ? 'var(--cp-greenbg, #DFF3E3)' : '#FFF0E6', fg: estaPagado ? '#1F5C33' : 'var(--cp-rust, #B2500F)' }
    : estaPagado
    ? { t: 'Pagado', bg: 'var(--cp-greenbg, #DFF3E3)', fg: '#1F5C33' }
    : tienePagoCoordinado
      ? { t: 'Pago coordinado', bg: '#E3EEF8', fg: 'var(--cp-navy, #0B2C3E)' }
      : { t: 'Por cobrar', bg: '#FFF0E6', fg: 'var(--cp-rust, #B2500F)' };

  const panelCoordinar = !esPorConfirmar && esPagoPorCoordinar && (
    <section aria-label="Entrega fallida" style={{ border: '2px solid var(--cp-rust, #B2500F)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, background: '#FBE9DF' }}>
      <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16 }}>Entrega fallida: El cliente no contestó</div>
      <div style={{ fontSize: 14, lineHeight: '19px' }}>El repartidor estuvo en la puerta y llamó 3 veces. Habla con el cliente antes de decidir.</div>
      <BotonAbrirChatCliente telefono={pedido.cliente_telefono} />
      <div style={{ fontSize: 14, fontWeight: 700 }}>¿Qué se hace con lo preparado?</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['Merma', 'Personal', 'Donación'].map((d) => (
          <button
            key={d}
            type="button"
            className="dp-btn"
            onClick={() => setCoordinandoDestino(d)}
            style={{
              borderRadius: 9999,
              background: coordinandoDestino === d ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
              color: coordinandoDestino === d ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
            }}
          >
            {d}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Cuando termines de hablar con el cliente, elige cómo se cierra:</div>
      <button
        type="button"
        className="dp-btn"
        style={{ background: 'var(--cp-white, #FFFFFF)', minHeight: 48 }}
        onClick={() =>
          pedirConfirmacionEstado(
            'EN_CAMINO',
            `¿Reprogramar la entrega de ${pedido.codigo}?`,
            'El pedido volverá a salir a reparto con cargo adicional de flete.',
            'Reprogramada la entrega',
          )
        }
      >
        Reprogramar la entrega (+ s/ 5.00 de flete)
      </button>
      <button type="button" className="dp-btn dp-btn-rust" style={{ background: 'var(--cp-white, #FFFFFF)', minHeight: 48 }} onClick={() => setAbrirAnular(true)}>
        Devolver el dinero (anular el pedido)
      </button>
      <button
        type="button"
        className="dp-btn"
        style={{ background: 'var(--cp-white, #FFFFFF)', minHeight: 48 }}
        onClick={() =>
          pedirConfirmacionEstado(
            'ENTREGADO',
            `¿Cerrar el pedido ${pedido.codigo} como cobrado igual?`,
            `Se cerrará el pedido y lo preparado quedará registrado como ${coordinandoDestino}.`,
            `Cobrado igual sin entrega (${coordinandoDestino})`,
          )
        }
      >
        Cobrar igual (el cliente no recibió)
      </button>
    </section>
  );

  return (
    <>
      <div className="dp-raiz">
        {/* CABECERA FIJA */}
        <header className="dp-cab">
          <div className="dp-cab-fila">
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                {pedido.mesa_nombre && (esMesa || /^en espera/i.test(pedido.mesa_nombre)) && <InsigniaMesa mesaNombre={pedido.mesa_nombre} grande />}
                <h2 className="dp-nombre">{pedido.cliente_nombre?.trim() || 'Cliente'}</h2>
                <InsigniaModalidad modalidad={pedido.modalidad} mesaNombre={pedido.mesa_nombre} />
              </div>
              <div className="dp-meta">
                <span className="dp-codigo">{pedido.codigo}</span> · {canalLabel(pedido.canal)} · {modLabel(pedido.modalidad)} · {hora}
              </div>
            </div>
            <PastillaEspera creadoEn={pedido.creado_en} cerrado={esCerrado(pedido)} />
            <div className="dp-total-cab" aria-label="Total del pedido">
              S/ {totalNum.toFixed(2)}
            </div>
          </div>
          <div className="dp-chips">
            <InsigniaNumeroDia numero={pedido.numero_dia} />
            <span className="dp-chip" style={{ background: stBadge.bg, color: stBadge.fg }}>
              {stBadge.l}
            </span>
            <span className="dp-chip" style={{ background: pagoChip.bg, color: pagoChip.fg }}>
              {pagoChip.t}
            </span>
            {esperaCajaCerrada(pedido, cajaAbierta ?? null) && <EtiquetaCajaCerrada />}
            {pedido.pedido_origen && (
              <button
                type="button"
                data-testid="insignia-extra"
                className="dp-chip"
                onClick={() => alAbrirPedido?.(pedido.pedido_origen!.id)}
                style={{ background: '#FFF4D6', color: 'var(--cp-navy, #0B2C3E)', cursor: 'pointer', minHeight: 32 }}
              >
                EXTRA de {pedido.pedido_origen.codigo}
              </button>
            )}
            {pedido.cobroMozo && <ChipCobroMozo cobro={pedido.cobroMozo} />}
            {cambioCobroPendiente && <InsigniaCambioCobro />}
          </div>
        </header>

        {/* CAPAS */}
        <div role="tablist" aria-label="Capas del pedido" className="dp-capas">
          {CAPAS.map((c, i) => {
            const activa = capa === c.id;
            return (
              <button key={c.id} type="button" role="tab" aria-selected={activa} aria-label={c.largo} className="dp-capa" onClick={() => setCapa(c.id)}>
                <span className="dp-capa-num" aria-hidden="true">{i + 1}</span>
                <span className="dp-t-largo" aria-hidden="true">{c.largo}</span>
                <span className="dp-t-corto" aria-hidden="true">{c.corto}</span>
                {c.id === 'pago' && esPagoPorCoordinar && <span className="dp-punto" role="img" aria-label="Requiere atención" />}
              </button>
            );
          })}
        </div>

        {/* CUERPO: lo único que se desplaza */}
        <div className="dp-cuerpo" data-testid="dp-cuerpo">
          {sinUbicar && (
            <AvisoDeliverySinUbicacion
              pedidoId={String(pedido.id)}
              codigo={pedido.codigo}
              direccion={pedido.entrega_direccion}
              alActualizar={alActualizar}
            />
          )}
          {capa === 'productos' && (
            <CapaProductos pedido={pedido} puedeDarCortesia={tiene('cortesias/dar')} alCortesia={setLineaCortesia} alAbrirPedido={alAbrirPedido} />
          )}
          {capa === 'pago' && (
            <>
              {esPorConfirmar && (
                <div className="dp-sec" style={{ fontSize: 14, lineHeight: '19px', color: 'var(--cp-soft, #2C4C5D)' }}>
                  {contraEntrega
                    ? 'Delivery: se cobra en presencial al entregar; no bloquea. Confirma el pedido tras hablar con el cliente y el repartidor cobra al entregar.'
                    : 'Pedido fuera del local: ya está en cocina, no espera el pago. Habla con el cliente por WhatsApp y confirma el pago cuando lo haga; pídele la captura con amabilidad (es opcional y se puede subir después).'}
                </div>
              )}
              {panelCoordinar}
              <CapaPago
                pedido={pedido}
                esMesa={esMesa}
                estaPagado={estaPagado}
                cambioCobroPendiente={cambioCobroPendiente}
                alRechazarCobroMozo={() => setAbrirRechazarMozo(true)}
                alExito={setMensajeExito}
                alActualizar={alActualizar}
              />
            </>
          )}
          {capa === 'entrega' && (
            <CapaEntrega
              pedido={pedido}
              esDelivery={esDelivery}
              esMesa={esMesa}
              puedeCorregirCliente={puedeCorregirCliente}
              alCorregirCliente={() => setAbrirCorregirCliente(true)}
              alUbicar={() => setAbrirUbicar(true)}
              alActualizar={alActualizar}
            />
          )}
          {tiene('pedidos/ver') && <ImpresionesDelPedido pedidoId={String(pedido.id)} />}
          {/* Solo ADMIN y SUPERVISOR (permiso caja/auditoria_pedido) */}
          {tiene('caja/auditoria_pedido') && (
            <button type="button" className="dp-ico" style={{ minHeight: 44 }} onClick={() => setAbrirHistorial(true)}>
              Historial del pedido
            </button>
          )}
          {abrirHistorial && <HistorialPedidoModal pedidoId={String(pedido.id)} codigo={pedido.codigo} alCerrar={() => setAbrirHistorial(false)} />}
        </div>

        {/* BARRA DE ACCIONES FIJA */}
        <footer className="dp-acciones">
          {(errorAccion || mensajeExito || editandoPor || (est === 'LISTO' && sinRepartidor)) && (
            <div className="dp-avisos">
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
              {editandoPor && (
                <div role="status" style={{ background: '#FFF4D6', borderRadius: 10, padding: '6px 12px', fontSize: 13, fontWeight: 700 }}>
                  {editandoPor} está editando este pedido.
                </div>
              )}
              {/* Un delivery sin repartidor no se entrega (REPARTIDOR_REQUERIDO) */}
              {est === 'LISTO' && sinRepartidor && (
                <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                  Asigna un repartidor antes de marcar el pedido como entregado.{' '}
                  <Link to="/admin/repartos" style={{ color: 'inherit', textDecoration: 'underline' }}>
                    Ir a Repartos
                  </Link>
                </div>
              )}
            </div>
          )}
          <AccionesComerLocal pedido={pedido} alCambio={alActualizar} />
          <div className="dp-acciones-fila">
            <div className="dp-primarias">
              {esPorConfirmar && (
                <button
                  type="button"
                  className="dp-primaria"
                  onClick={() => setAbrirConfirmarPago(true)}
                  disabled={sinUbicar}
                  title={sinUbicar ? MENSAJE_DELIVERY_SIN_UBICACION : undefined}
                >
                  {contraEntrega ? 'Confirmar pedido' : 'Confirmar pedido y pago'}
                </button>
              )}
              {puedeCobrar && (
                <button
                  type="button"
                  className="dp-primaria"
                  onClick={() => setAbrirCobrar(true)}
                  disabled={sinUbicar}
                  title={sinUbicar ? MENSAJE_DELIVERY_SIN_UBICACION : undefined}
                >
                  Registrar cobro S/ {totalNum.toFixed(2)}
                </button>
              )}
              {est === 'LISTO' && (
                <button
                  type="button"
                  className="dp-primaria dp-primaria-oscura"
                  disabled={procesando || sinRepartidor}
                  onClick={() =>
                    pedirConfirmacionEstado(
                      'ENTREGADO',
                      `¿Marcar ${pedido.codigo} como entregado y cerrar?`,
                      'El pedido pasará a la pestaña Cerrados.',
                    )
                  }
                >
                  Entregar al cliente y cerrar
                </button>
              )}
              {puedeVolverAtras && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button
                    type="button"
                    className="dp-ico"
                    style={{ minHeight: 44 }}
                    aria-label={`Volver atrás el pedido ${pedido.codigo}`}
                    disabled={procesando || !!motivoNoVolverAtras}
                    onClick={() => setAbrirVolverAtras(true)}
                  >
                    ↩ Volver atrás
                  </button>
                  {motivoNoVolverAtras && <span style={{ fontSize: 12, fontWeight: 700, color: '#B2500F' }}>{motivoNoVolverAtras}</span>}
                </div>
              )}
              {puedeRevertirAnulacion && (
                <button type="button" className="dp-ico" style={{ minHeight: 44 }} aria-label={`Revertir la anulación del pedido ${pedido.codigo}`} disabled={procesando} onClick={() => setAbrirRevertir(true)}>
                  ↩ Revertir anulación
                </button>
              )}
              {(est === 'ANULADO' || est === 'RECHAZADO') && !puedeRevertirAnulacion && (
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2C4C5D' }}>
                  Un pedido anulado no se puede reabrir: crea uno nuevo (botón Repetir). Si fue un error, pide al administrador o supervisor que revierta la anulación.
                </span>
              )}
              {esMesa && (est === 'PREPARANDO' || (est === 'LISTO' && !pedido.entregado_mesa_en)) && (
                <button
                  type="button"
                  className="dp-primaria"
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
                >
                  Ya lo llevé a la mesa
                </button>
              )}
            </div>
            <div className="dp-iconos">
              {puedeCobrar && (
                <BotonIcono
                  n="credito"
                  texto="Crédito personal"
                  etiqueta="Cobrar a crédito del personal"
                  alClic={() => setAbrirCreditoPersonal(true)}
                  deshabilitado={sinUbicar}
                  titulo={sinUbicar ? MENSAJE_DELIVERY_SIN_UBICACION : undefined}
                />
              )}
              {puedeEditar && <BotonIcono n="editar" texto="Editar" etiqueta="Editar pedido" alClic={() => alEditar?.(pedido)} />}
              {puedeAgregarExtra && <BotonIcono n="extra" texto="Extra" etiqueta="Agregar extra" alClic={() => alAgregarExtra?.(pedido)} />}
              <BotonIcono n="repetir" texto="Repetir" etiqueta="Repetir este pedido" alClic={() => alRepetir?.(pedido)} />
              {esMesa && <BotonIcono n="precuenta" texto="Precuenta" etiqueta="Sacar precuenta (el cajero cobra)" alClic={() => setAbrirPrecuenta(true)} />}
              <BotonIcono n="imprimir" texto="Imprimir" etiqueta="Imprimir etiquetas y ticket" alClic={() => setAbrirImpresion(true)} />
              <ReimprimirPedido pedido={pedido} variante="detalle" />
              {puedeAnularPedidoPagado && !esPorConfirmar && (
                <BotonIcono n="anular" peligro texto="Anular pedido" etiqueta="Anular pedido pagado" alClic={() => setAbrirAnularPedido(true)} />
              )}
              {est !== 'ANULADO' && (esPorConfirmar || tiene('pedidos/anular')) && (
                <BotonIcono
                  n="anular"
                  peligro
                  texto={esPorConfirmar ? 'Rechazar' : tieneCobroVigente ? 'Anular cobro' : 'Anular'}
                  etiqueta={esPorConfirmar ? 'Rechazar' : tieneCobroVigente ? 'Anular cobro' : 'Anular pedido'}
                  alClic={esPorConfirmar ? () => setAbrirAnular(true) : handleAbrirAnular}
                />
              )}
            </div>
          </div>
        </footer>
      </div>

      {abrirImpresion && (
        <PanelImpresion
          pedido={pedido}
          esMesa={esMesa}
          esDelivery={esDelivery}
          sinComprobante={esPorConfirmar || est === 'ANULADO' || est === 'RECHAZADO'}
          alCerrar={() => setAbrirImpresion(false)}
        />
      )}

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
          alCerrar={() => setLineaCortesia(null)}
          alConfirmar={async (datos) => {
            await cortesiasApi.darEnLinea(pedido.id, lineaCortesia.id, datos);
            setLineaCortesia(null);
            alActualizar();
          }}
        />
      )}

      {abrirVolverAtras && (
        <ModalVolverAtras
          pedido={pedido}
          alCerrar={() => setAbrirVolverAtras(false)}
          alExito={(estado) => {
            setAbrirVolverAtras(false);
            setMensajeExito(`${pedido.codigo} volvió a ${estado === 'EN_CAMINO' ? 'EN CAMINO' : estado}`);
            alActualizar();
          }}
        />
      )}

      {abrirRevertir && (
        <ModalRevertirAnulacion
          pedido={pedido}
          alCerrar={() => setAbrirRevertir(false)}
          alExito={(r) => {
            setAbrirRevertir(false);
            setMensajeExito(`${pedido.codigo} volvió a ${r.estado}${r.avisoCobro ? `. ${r.avisoCobro}` : ''}`);
            alActualizar();
          }}
        />
      )}

      {abrirAnularPedido && (
        <ModalAnular
          pedidoId={pedido.id}
          codigoPedido={pedido.codigo}
          esCobro={false}
          pedido={pedido}
          esAdmin={tieneRolUsuario(usuario, 'ADMIN')}
          alCerrar={() => setAbrirAnularPedido(false)}
          alAnularExitoso={() => {
            setAbrirAnularPedido(false);
            alActualizar();
          }}
        />
      )}

      {abrirAnular && (
        <ModalAnular
          pedidoId={pedido.id}
          codigoPedido={pedido.codigo}
          esCobro={tieneCobroVigente}
          esAdmin={tieneRolUsuario(usuario, 'ADMIN')}
          cobroId={pedido.cobro_vigente_id ?? undefined}
          pedido={pedido}
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
          lineas={lineasPrecuenta(pedido)}
          descuentos={descuentosDePedido(pedido)}
          envio={Number(pedido.envio || 0)}
          notaPedido={pedido.nota}
          total={Number(pedido.total)}
          subtotal={Number(pedido.subtotal)}
          descuento={Number(pedido.descuento || 0)}
          plan={pedido.planPago}
        />
      )}

      {abrirCorregirCliente && (
        <ModalCorregirCliente
          pedido={pedido}
          alCerrar={() => setAbrirCorregirCliente(false)}
          alGuardar={() => {
            setAbrirCorregirCliente(false);
            alActualizar();
          }}
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
              zIndex: 90,
              background: 'rgba(11, 44, 62, 0.55)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cobrar a crédito del personal"
            style={{
              position: 'fixed',
              zIndex: 95,
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


      {dialogoCocina}
      {dialogoCobro}
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

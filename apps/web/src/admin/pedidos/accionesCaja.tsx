import { ReactNode, useCallback, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { useSesion } from '../../comun/sesion';
import { useConfirmarImpresion } from '../impresion/useConfirmarImpresion';
import { salonApi } from '../salon/api';
import { pedidosApi, montoPorCobrar, type Pedido } from './pedidosApi';
import { ModalConfirmarPago } from './ModalConfirmarPago';
import { ModalCobrar } from './ModalCobrar';
import { useAvisoCocinaPendiente } from './avisoCocinaPendiente';
import { useAvisoCobroPendiente } from './avisoCobroPendiente';
import { esDeliveryContraEntrega } from './mediosPago';
import { deliverySinUbicacion } from './ubicacionDelivery';
import { esCerrado, esPorConfirmar, estadoVisual } from './estadosCaja';

/** Botón grande del pie de la tarjeta: la acción que sigue para ese pedido. */
export type TipoAccionCaja = 'confirmar_pago' | 'cobrar' | 'estado' | 'mesa' | 'detalle';

export interface AccionCaja {
  tipo: TipoAccionCaja;
  texto: string;
  bg: string;
  fg: string;
  /** Estado al que pasa (solo tipo «estado») */
  nuevoEstado?: string;
}

const mayus = (v: unknown) => String(v || '').toUpperCase();

/**
 * Acción siguiente de un pedido, con los mismos permisos y reglas que el detalle.
 * Cerrados: ninguna. Sin permiso para la acción: ninguna (el detalle sigue disponible al tocar la tarjeta).
 */
export function accionDePedido(p: Pedido, tiene: (permiso: string) => boolean): AccionCaja | null {
  if (esCerrado(p)) return null;
  const est = mayus(p.estado);
  const mod = mayus(p.modalidad);
  const pagado = mayus(p.pago_estado) === 'PAGADO';
  const coordinado = Boolean(p.pago_coordinado_en) || mayus(p.pago_estado) === 'COORDINADO';
  const v = estadoVisual(p);
  const sinUbicar = deliverySinUbicacion(p);
  const puedeCambiar = tiene('pedidos/cambiar_estado');

  // Delivery sin punto o zona: no se confirma ni cobra hasta ubicarlo; el aviso para ubicar vive en el detalle
  if (sinUbicar && (esPorConfirmar(p) || (!pagado && !coordinado))) {
    return { tipo: 'detalle', texto: 'UBICAR', bg: '#FFF1C9', fg: '#0B2C3E' };
  }
  if (esPorConfirmar(p)) {
    return { tipo: 'confirmar_pago', texto: esDeliveryContraEntrega(p) ? 'CONFIRMAR PEDIDO' : 'CONFIRMAR PAGO', bg: '#E67929', fg: '#0B2C3E' };
  }
  // Para llevar o mesa, ya listo y sin cobrar: lo que falta es cobrar (el delivery se cobra con el reparto)
  if (est === 'LISTO' && mod !== 'DELIVERY' && !pagado && !coordinado && tiene('caja/cobrar')) {
    return { tipo: 'cobrar', texto: `COBRAR S/ ${montoPorCobrar(p).toFixed(2)}`, bg: '#2F7A45', fg: '#FFFFFF' };
  }
  if (!puedeCambiar) return null;
  if (est === 'COLA' || est === 'NUEVO') {
    return { tipo: 'estado', texto: 'PREPARAR', nuevoEstado: 'PREPARANDO', bg: v.bg, fg: v.fg };
  }
  if (est === 'PREPARANDO' || est === 'PREP') {
    return { tipo: 'estado', texto: 'LISTO', nuevoEstado: 'LISTO', bg: v.bg, fg: v.fg };
  }
  if (est === 'LISTO') {
    if (mod === 'DELIVERY') {
      // Sin repartidor no sale: el detalle explica cómo asignarlo (Repartos)
      return p.repartidor_party_id
        ? { tipo: 'estado', texto: 'ENVIAR', nuevoEstado: 'EN_CAMINO', bg: v.bg, fg: v.fg }
        : { tipo: 'detalle', texto: 'ENVIAR', bg: v.bg, fg: v.fg };
    }
    if (mod === 'MESA' && !p.entregado_mesa_en) {
      return { tipo: 'mesa', texto: 'ENTREGAR', bg: v.bg, fg: v.fg };
    }
    return { tipo: 'estado', texto: 'ENTREGAR', nuevoEstado: 'ENTREGADO', bg: v.bg, fg: v.fg };
  }
  if (est === 'EN_CAMINO' || est === 'RUTA') {
    return { tipo: 'estado', texto: 'ENTREGAR', nuevoEstado: 'ENTREGADO', bg: v.bg, fg: v.fg };
  }
  return null;
}

interface Opciones {
  alActualizar: () => void;
  /** Abre la ventana del detalle del pedido (acciones que se resuelven allí) */
  abrirDetalle: (p: Pedido) => void;
}

interface Pendiente {
  titulo: string;
  mensaje: string;
  textoConfirmar: string;
  ejecutar: () => Promise<void>;
}

/**
 * Acciones del botón de la tarjeta. Reproduce las del detalle con los mismos modales y endpoints:
 * ModalConfirmarPago, ModalCobrar, pedidosApi.cambiarEstado (con aviso de impresora al pasar a preparar)
 * y salonApi.marcarEntregadoMesa. Una sola instancia para toda la lista.
 */
export function useAccionesCaja({ alActualizar, abrirDetalle }: Opciones): {
  accionDe: (p: Pedido) => AccionCaja | null;
  ejecutar: (p: Pedido, accion: AccionCaja) => void;
  dialogos: ReactNode;
} {
  const { tiene } = useSesion();
  const { pedir: pedirImpresion, dialogo: dialogoImpresion } = useConfirmarImpresion();
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [pagoDe, setPagoDe] = useState<Pedido | null>(null);
  const [cobroDe, setCobroDe] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { manejar: avisoCocina, dialogo: dialogoCocina } = useAvisoCocinaPendiente(() => alActualizar());
  const { manejar: avisoCobro, dialogo: dialogoCobro } = useAvisoCobroPendiente(() => alActualizar());

  const accionDe = useCallback((p: Pedido) => accionDePedido(p, tiene), [tiene]);

  const correr = async (fn: () => Promise<void>, pedido?: { id: string | number; estado: string; cobrar?: () => void }) => {
    setProcesando(true);
    setError(null);
    try {
      await fn();
      alActualizar();
    } catch (err: any) {
      if (pedido && avisoCocina(err, pedido.id, pedido.estado)) return;
      if (pedido && avisoCobro(err, pedido.id, pedido.estado, pedido.cobrar)) return;
      setError(err?.message || 'No se pudo completar la acción');
    } finally {
      setProcesando(false);
    }
  };

  const ejecutar = (p: Pedido, a: AccionCaja) => {
    setError(null);
    if (a.tipo === 'detalle') return abrirDetalle(p);
    if (a.tipo === 'confirmar_pago') return setPagoDe(p);
    if (a.tipo === 'cobrar') return setCobroDe(p);
    if (a.tipo === 'mesa') {
      return setPendiente({
        titulo: `¿Confirmas que ya llevaste ${p.codigo} a la mesa?`,
        mensaje: 'Quedará registrado como servido en mesa.',
        textoConfirmar: 'Sí, ya lo llevé',
        ejecutar: () => correr(() => salonApi.marcarEntregadoMesa(String(p.id)).then(() => undefined)),
      });
    }
    const nuevo = a.nuevoEstado as string;
    const cambiar = () => correr(() => pedidosApi.cambiarEstado(p.id, nuevo).then(() => undefined), { id: p.id, estado: nuevo, cobrar: () => setCobroDe(p) });
    setPendiente({
      titulo: `¿${a.texto === 'LISTO' ? 'Marcar como listo' : a.texto === 'PREPARAR' ? 'Pasar a preparar' : a.texto === 'ENVIAR' ? 'Enviar con repartidor' : 'Entregar al cliente'} ${p.codigo}?`,
      mensaje: `El pedido pasa a «${nuevo === 'PREPARANDO' ? 'En preparación' : nuevo === 'LISTO' ? 'Listo' : nuevo === 'EN_CAMINO' ? 'En camino' : 'Entregado'}».`,
      textoConfirmar: 'Sí, continuar',
      // Pasar a preparar manda las etiquetas a imprimir: se avisa si falta una máquina (igual que el detalle)
      ejecutar: () => (nuevo === 'PREPARANDO' ? pedirImpresion(cambiar) : cambiar()),
    });
  };

  const dialogos = (
    <>
      {dialogoImpresion}
      {dialogoCocina}
      {dialogoCobro}
      {error && (
        <div
          role="alert"
          className="cj2-aviso"
          style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 70, background: '#FDECE8', border: '1.5px solid var(--cp-rust, #B2500F)', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontWeight: 700, color: 'var(--cp-rust, #B2500F)', display: 'flex', justifyContent: 'space-between', gap: 12 }}
        >
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso" style={{ border: 0, background: 'transparent', fontWeight: 800, cursor: 'pointer' }}>×</button>
        </div>
      )}
      {pagoDe && (
        <ModalConfirmarPago
          pedido={pagoDe}
          alCerrar={() => setPagoDe(null)}
          alActualizarPedido={() => {
            setPagoDe(null);
            alActualizar();
          }}
          alConfirmarExitoso={() => {
            setPagoDe(null);
            alActualizar();
          }}
        />
      )}
      {cobroDe && (
        <ModalCobrar
          pedido={cobroDe}
          alCerrar={() => setCobroDe(null)}
          alCobrarExitoso={() => {
            setCobroDe(null);
            alActualizar();
          }}
          alActualizarPedido={() => {
            setCobroDe(null);
            alActualizar();
          }}
        />
      )}
      <Confirmar
        abierto={Boolean(pendiente)}
        titulo={pendiente?.titulo || '¿Confirmar acción?'}
        mensaje={pendiente?.mensaje || ''}
        textoConfirmar={pendiente?.textoConfirmar || 'Sí'}
        textoNo="No"
        cargando={procesando}
        alConfirmar={async () => {
          if (pendiente) {
            const fn = pendiente.ejecutar;
            setPendiente(null);
            await fn();
          }
        }}
        alCancelar={() => setPendiente(null)}
      />
    </>
  );

  return { accionDe, ejecutar, dialogos };
}

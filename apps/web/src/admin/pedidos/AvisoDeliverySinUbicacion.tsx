import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { ModalCambiarUbicacion } from './ModalCambiarUbicacion';
import { cambioUbicacionApi } from './cambioUbicacionApi';
import { MENSAJE_DELIVERY_SIN_UBICACION } from './ubicacionDelivery';

export interface AvisoDeliverySinUbicacionProps {
  pedidoId: string;
  codigo: string;
  direccion?: string | null;
  alActualizar: () => void;
}

/**
 * Delivery esperando ubicación: aviso claro con las dos salidas, ubicar en el mapa (Caja) o pedir la ubicación al
 * cliente por WhatsApp (cuando llega, el pedido se ubica solo).
 */
export function AvisoDeliverySinUbicacion({ pedidoId, codigo, direccion, alActualizar }: AvisoDeliverySinUbicacionProps) {
  const { tiene } = useSesion();
  const puede = tiene('pedidos/cambiar_ubicacion');
  const [mapa, setMapa] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  const pedir = async () => {
    setEnviando(true);
    setAviso('');
    setError('');
    try {
      await cambioUbicacionApi.pedirUbicacionWhatsapp(pedidoId);
      setAviso('Le pedimos la ubicación por WhatsApp. Cuando la envíe, el pedido se ubica solo.');
    } catch (err) {
      setError(err instanceof ErrorApi || err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      role="alert"
      data-testid="aviso-delivery-sin-ubicacion"
      style={{ background: 'rgb(255, 241, 201)', border: '1.5px solid var(--cp-orange, #E67929)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ fontWeight: 800, fontSize: 13 }}>Falta la ubicación: el cliente debe enviarla por WhatsApp</div>
      <div style={{ fontSize: 12 }}>{MENSAJE_DELIVERY_SIN_UBICACION}</div>
      {puede && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Boton variante="secundario" onClick={() => setMapa(true)} style={{ flex: '1 1 160px', minHeight: 44 }}>
            Ubicar en el mapa
          </Boton>
          <Boton cargando={enviando} onClick={pedir} style={{ flex: '1 1 160px', minHeight: 44 }}>
            Pedir ubicación por WhatsApp
          </Boton>
        </div>
      )}
      {aviso && <div role="status" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-teal, #2C6E7F)' }}>{aviso}</div>}
      {error && <div role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-rust, #C4412B)' }}>{error}</div>}
      {mapa && (
        <ModalCambiarUbicacion
          pedidoId={pedidoId}
          codigoPedido={codigo}
          direccionActual={direccion}
          puntoActual={null}
          alCerrar={() => setMapa(false)}
          alCambiar={() => {
            setMapa(false);
            alActualizar();
          }}
        />
      )}
    </div>
  );
}

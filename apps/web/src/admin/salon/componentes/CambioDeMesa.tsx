import { useState, type ReactNode } from 'react';
import { Confirmar } from '../../../comun/Confirmar';
import { Boton } from '../../../comun/Boton';
import { salonApi } from '../api';
import type { MesaSalon } from '../tipos';

/** Pedido que se va a mover y la mesa en la que está hoy. */
export interface OrigenCambioMesa {
  pedidoId: string;
  codigo: string;
  mesa: MesaSalon;
}

export const nombreMesaSalon = (m: MesaSalon) => m.nombre || (m.numero ? `Mesa ${m.numero}` : 'Mesa');

/**
 * Cambio de mesa de un pedido: el padre llama a `iniciar` (desde la vista previa o la cuenta),
 * el croquis resalta las libres, `tocarMesa` devuelve true si el toque es del cambio, y `ui`
 * muestra el aviso, el Sí/No «¿Pasar el pedido de Mesa 3 a Mesa 5?» y el error (409) del servidor.
 */
export function useCambioDeMesa(alCambiar: () => void) {
  const [origen, setOrigen] = useState<OrigenCambioMesa | null>(null);
  const [destino, setDestino] = useState<MesaSalon | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const iniciar = (o: OrigenCambioMesa) => {
    setError(null);
    setAviso(null);
    setDestino(null);
    setOrigen(o);
  };

  const cancelar = () => {
    setOrigen(null);
    setDestino(null);
  };

  const tocarMesa = (mesa: MesaSalon): boolean => {
    if (!origen) return false;
    if (mesa.estado === 'LIBRE' && mesa.id !== origen.mesa.id) setDestino(mesa);
    return true;
  };

  const confirmar = async () => {
    if (!origen || !destino) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await salonApi.cambiarMesaPedido(origen.pedidoId, destino.id);
      setAviso(`El pedido ${origen.codigo} pasó a ${r.mesa || nombreMesaSalon(destino)}.`);
      cancelar();
      alCambiar();
    } catch (err: any) {
      setError(err?.message || 'No se pudo cambiar de mesa. Intenta de nuevo.');
      cancelar();
    } finally {
      setEnviando(false);
    }
  };

  const ui: ReactNode = (
    <>
      {origen && !destino && (
        <div
          role="status"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'var(--cp-sand)',
            border: '1.5px solid var(--cp-orange)',
            color: 'var(--cp-navy)',
            fontSize: '14px',
            fontWeight: 700,
          }}
        >
          <span style={{ flex: '1 1 220px' }}>
            Elige una mesa libre para pasar el pedido de {nombreMesaSalon(origen.mesa)}.
          </span>
          <Boton variante="secundario" tamano="pequeno" onClick={cancelar}>
            Cancelar cambio
          </Boton>
        </div>
      )}
      {origen && destino && (
        <Confirmar
          abierto
          titulo={`¿Pasar el pedido de ${nombreMesaSalon(origen.mesa)} a ${nombreMesaSalon(destino)}?`}
          mensaje="El pedido queda en la mesa nueva y la anterior queda libre. No se anula ni se cobra."
          textoSi="Sí, cambiar de mesa"
          textoNo="No, volver"
          cargando={enviando}
          alConfirmar={confirmar}
          alCancelar={() => setDestino(null)}
        />
      )}
      {error && (
        <p role="alert" style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
          {error}
        </p>
      )}
      {aviso && !origen && (
        <p role="status" style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--cp-green)' }}>
          {aviso}
        </p>
      )}
    </>
  );

  return { modoDestino: origen !== null, iniciar, tocarMesa, ui, origen };
}

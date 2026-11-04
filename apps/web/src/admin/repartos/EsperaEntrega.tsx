import { useEffect, useState } from 'react';
import type { PedidoReparto } from './repartosApi';

/**
 * Temporizador de espera en puerta (después de «Llegué») y botón «Cliente no salió».
 * El botón está apagado hasta cumplirse el tiempo; el servidor vuelve a validarlo.
 */
export function BotonCancelarEspera({
  pedido,
  onCancelar,
}: {
  pedido: PedidoReparto;
  onCancelar: (p: PedidoReparto) => void;
}) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!pedido.llego_en) return;
    const id = setInterval(() => setAhora(Date.now()), 5000);
    return () => clearInterval(id);
  }, [pedido.llego_en]);

  if (!pedido.llego_en || pedido.estado !== 'EN_CAMINO') return null;

  const maxMin = pedido.espera_max_min ?? 10;
  const transcurridoMs = Math.max(0, ahora - new Date(pedido.llego_en).getTime());
  const esperaMs = maxMin * 60000;
  const cumplida = transcurridoMs >= esperaMs;
  const faltan = Math.ceil((esperaMs - transcurridoMs) / 60000);
  const esperados = Math.floor(transcurridoMs / 60000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: cumplida ? '#9B1C1C' : 'var(--cp-navy)' }}>
        Esperando en la puerta: {Math.min(esperados, maxMin)} de {maxMin} min
      </div>
      <button
        type="button"
        data-testid={`btn-cancelar-espera-${pedido.id}`}
        disabled={!cumplida}
        onClick={() => onCancelar(pedido)}
        style={{
          minHeight: 48,
          width: '100%',
          borderRadius: 10,
          fontWeight: 800,
          fontSize: 14,
          padding: '10px 12px',
          cursor: cumplida ? 'pointer' : 'not-allowed',
          border: cumplida ? '2px solid #9B1C1C' : '1.5px dashed var(--cp-line)',
          background: cumplida ? '#FDE8E8' : 'var(--cp-cream, #F6F1E7)',
          color: cumplida ? '#9B1C1C' : 'var(--cp-soft)',
        }}
      >
        {cumplida
          ? 'Cliente no salió: devolver a la tienda y reprogramar'
          : `Cliente no salió: podrás cancelar en ${faltan} min`}
      </button>
    </div>
  );
}

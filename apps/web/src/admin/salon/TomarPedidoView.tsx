import { useEffect, useState } from 'react';
import { salonApi } from './api';
import { ModalNuevoPedidoMesa } from './componentes/ModalNuevoPedidoMesa';
import type { PisoSalon } from './tipos';

/** Entrada directa a "nuevo pedido" para quien puede crearlos sin ver la lista de pedidos (el mozo). */
export function TomarPedidoView() {
  const [pisos, setPisos] = useState<PisoSalon[]>([]);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    salonApi.obtenerMesas().then((r) => setPisos(r.pisos || [])).catch(() => setPisos([]));
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={{ minHeight: 48, padding: '0 20px', borderRadius: 12, border: 0, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}
      >
        Nuevo pedido
      </button>
      {abierto && (
        <ModalNuevoPedidoMesa abierto={true} pasoInicial="modal" pisos={pisos} alCerrar={() => setAbierto(false)} />
      )}
    </div>
  );
}

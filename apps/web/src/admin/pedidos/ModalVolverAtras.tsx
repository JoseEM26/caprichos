import { useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { pedidosApi, Pedido } from './pedidosApi';

/** Estado al que vuelve un pedido entregado: delivery que ya salió → En camino; el resto → Listo (el servidor decide con el historial). */
export function destinoVolverAtras(p: Pedido): 'LISTO' | 'EN_CAMINO' {
  return String(p.modalidad || '').toUpperCase() === 'DELIVERY' && p.despachado_en ? 'EN_CAMINO' : 'LISTO';
}

export interface ModalVolverAtrasProps {
  pedido: Pedido;
  alCerrar: () => void;
  alExito: (estadoNuevo: string) => void;
}

/** «Volver atrás» de un pedido entregado por error: resumen, qué no se deshace, motivo obligatorio y Sí/No. */
export function ModalVolverAtras({ pedido, alCerrar, alExito }: ModalVolverAtrasProps) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const destino = destinoVolverAtras(pedido);
  const textoDestino = destino === 'EN_CAMINO' ? 'EN CAMINO' : 'LISTO';

  const confirmar = async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await pedidosApi.reabrir(pedido.id, motivo.trim());
      alExito(String(r?.estado || destino));
    } catch (e: any) {
      setError(e?.message || 'No se pudo volver atrás el pedido');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Confirmar
      abierto
      titulo={`¿Volver atrás ${pedido.codigo}?`}
      mensaje={`${pedido.codigo} volverá a ${textoDestino}. El cliente ya recibió el aviso de entregado y no se puede deshacer; al volver a entregar no se le enviará otro.`}
      textoConfirmar="Sí, volver atrás"
      textoNo="No"
      cargando={cargando}
      deshabilitarConfirmar={motivo.trim().length < 5}
      alConfirmar={confirmar}
      alCancelar={alCerrar}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700, color: '#0B2C3E' }}>
        Motivo (obligatorio)
        <input
          type="text"
          value={motivo}
          maxLength={300}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Me confundí, no se entregó aún"
          style={{ minHeight: 44, borderRadius: 10, border: '1.5px solid #E3D6C6', padding: '0 10px', fontSize: 14, color: '#0B2C3E', background: '#FBF4EC' }}
        />
      </label>
      {error && (
        <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#B2500F' }}>
          {error}
        </div>
      )}
    </Confirmar>
  );
}

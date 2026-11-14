import { useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { pedidosApi, Pedido, RespuestaRevertir } from './pedidosApi';

export interface ModalRevertirAnulacionProps {
  pedido: Pedido;
  alCerrar: () => void;
  alExito: (r: RespuestaRevertir) => void;
}

/** Revertir un pedido anulado (solo ADMIN y SUPERVISOR): qué se rehace, motivo obligatorio y Sí/No. */
export function ModalRevertirAnulacion({ pedido, alCerrar, alExito }: ModalRevertirAnulacionProps) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const confirmar = async () => {
    setCargando(true);
    setError(null);
    try {
      alExito(await pedidosApi.revertirAnulacion(pedido.id, motivo.trim()));
    } catch (e: any) {
      setError(e?.message || 'No se pudo revertir la anulación');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Confirmar
      abierto
      titulo={`¿Revertir la anulación de ${pedido.codigo}?`}
      mensaje={`${pedido.codigo} vuelve al estado que tenía antes de anular. Se vuelve a descontar su stock y a sumar sus puntos, y se reactiva su cobro si es seguro (si el dinero ya se devolvió, la caja cerró o la boleta se dio de baja, habrá que cobrar de nuevo). Queda registrado a tu nombre.`}
      textoConfirmar="Sí, revertir"
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
          placeholder="Se anuló por error: el pedido sí se entregó"
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

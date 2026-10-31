import { useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import type { MotivoSalto } from './repartosApi';

export const OPCIONES_SALTO: Array<{ id: MotivoSalto; texto: string }> = [
  { id: 'NO_CONTESTA', texto: 'Cliente no contesta' },
  { id: 'DIRECCION_NO_ENCONTRADA', texto: 'Dirección no encontrada' },
  { id: 'TRAFICO', texto: 'Tráfico o vía cerrada' },
  { id: 'OTRO', texto: 'Otro' },
];

/** Pide el motivo para pasar un pedido al final del orden (máximo 2 saltos por pedido, lo valida la API). */
export function SaltarPedidoModal({
  codigo,
  cargando,
  alConfirmar,
  alCancelar,
}: {
  codigo: string;
  cargando: boolean;
  alConfirmar: (motivo: MotivoSalto, detalle?: string) => void | Promise<void>;
  alCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState<MotivoSalto | null>(null);
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const confirmar = () => {
    if (!motivo) return setError('Elige un motivo');
    if (motivo === 'OTRO' && !detalle.trim()) return setError('Cuéntanos el motivo');
    return alConfirmar(motivo, motivo === 'OTRO' ? detalle.trim() : undefined);
  };

  return (
    <Confirmar
      abierto
      titulo={`Saltar ${codigo}`}
      mensaje="Pasa al final de tu ruta. Puedes saltar un pedido hasta 2 veces. ¿Por qué lo saltas?"
      textoSi="Sí, saltar"
      textoNo="No"
      cargando={cargando}
      alConfirmar={confirmar}
      alCancelar={alCancelar}
    >
      <div role="radiogroup" aria-label="Motivo del salto" style={{ display: 'grid', gap: 6 }}>
        {OPCIONES_SALTO.map((o) => (
          <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 15 }}>
            <input
              type="radio"
              name="motivo-salto"
              checked={motivo === o.id}
              onChange={() => {
                setMotivo(o.id);
                setError(null);
              }}
            />
            {o.texto}
          </label>
        ))}
        {motivo === 'OTRO' && (
          <textarea
            aria-label="Detalle del motivo"
            value={detalle}
            maxLength={200}
            onChange={(e) => setDetalle(e.target.value)}
            rows={2}
            style={{ width: '100%', fontSize: 15, borderRadius: 8, border: '1.5px solid var(--cp-line)', padding: 8 }}
          />
        )}
        {error && <div role="alert" style={{ color: 'var(--cp-rust)', fontWeight: 700, fontSize: 13 }}>{error}</div>}
      </div>
    </Confirmar>
  );
}

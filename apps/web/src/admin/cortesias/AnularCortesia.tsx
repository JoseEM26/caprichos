import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { cortesiasApi, MOTIVO_ANULACION_MINIMO } from './cortesiasApi';

/** Celda «Acción» de una cortesía del informe: botón Anular (con confirmación y motivo) o la marca «Anulada». */
export function AnularCortesia({
  id,
  anulada,
  anulable,
  alAnular,
}: {
  id: string;
  anulada: boolean;
  anulable: boolean;
  alAnular: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (anulada) return <strong style={{ color: 'var(--cp-soft)' }}>Anulada</strong>;
  if (!anulable) return <span aria-hidden="true">—</span>;

  const cerrar = () => {
    setAbierto(false);
    setMotivo('');
    setError(null);
  };
  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await cortesiasApi.anular(id, motivo.trim());
      cerrar();
      alAnular();
    } catch (e: any) {
      setError(e?.mensaje || e?.message || 'No se pudo anular la cortesía');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Boton variante="secundario" onClick={() => setAbierto(true)}>
        Anular
      </Boton>
      <Confirmar
        abierto={abierto}
        titulo="Anular cortesía"
        mensaje="Se devuelve el stock que descontó la cortesía y dejará de contar en el informe. Esto no se puede deshacer."
        textoConfirmar="Sí, anular"
        textoNo="No"
        peligro
        cargando={enviando}
        deshabilitarConfirmar={motivo.trim().length < MOTIVO_ANULACION_MINIMO}
        error={error}
        alConfirmar={confirmar}
        alCancelar={cerrar}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700 }}>
          Motivo (obligatorio)
          <textarea
            value={motivo}
            maxLength={300}
            rows={3}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Cuéntanos por qué se anula"
            style={{ font: 'inherit', padding: 8, borderRadius: 8, border: '1px solid var(--cp-line)' }}
          />
          <span style={{ fontWeight: 400, color: 'var(--cp-soft)' }}>
            Mínimo {MOTIVO_ANULACION_MINIMO} letras ({motivo.trim().length}/300).
          </span>
        </label>
      </Confirmar>
    </>
  );
}

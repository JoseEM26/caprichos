import { useEffect, useId, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { mensajeError } from './aprendizajesApi';

/** Confirmación Sí/No que pide un motivo (mínimo 5 letras) antes de enviar. */
export function MotivoConfirmar({ abierto, titulo, mensaje, textoSi, alEnviar, alCerrar }: {
  abierto: boolean; titulo: string; mensaje: string; textoSi: string;
  alEnviar: (motivo: string) => Promise<void>; alCerrar: () => void;
}) {
  const id = useId();
  const [motivo, setMotivo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (abierto) { setMotivo(''); setError(null); } }, [abierto]);
  const limpio = motivo.trim();
  return (
    <Confirmar
      abierto={abierto} titulo={titulo} mensaje={mensaje} textoSi={textoSi} peligro cargando={cargando} error={error}
      deshabilitarConfirmar={limpio.length < 5}
      alCancelar={alCerrar}
      alConfirmar={async () => {
        setCargando(true); setError(null);
        try { await alEnviar(limpio); alCerrar(); } catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
      }}
    >
      <label htmlFor={id} className="ap-etiqueta">Motivo (mínimo 5 letras)</label>
      <textarea id={id} className="ap-campo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
    </Confirmar>
  );
}

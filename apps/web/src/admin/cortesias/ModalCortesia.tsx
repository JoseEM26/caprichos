import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { CampoCodigoSupervisor } from '../../comun/CampoCodigoSupervisor';
import { MOTIVOS_CORTESIA, errorDatosCortesia, DatosCortesia } from './cortesiasApi';
import '../cierre/pendientes-cierre.css';

export interface ModalCortesiaProps {
  titulo: string;
  /** Línea o producto que se regala, para que quede claro qué se marca. */
  resumen?: string;
  /** El SUPERVISOR presenta su código de supervisor; Caja y ADMIN no. */
  pideCodigo: boolean;
  /** Devuelve la promesa del guardado; si falla con ErrorApi se muestra su mensaje. */
  alConfirmar: (datos: DatosCortesia, codigo?: string) => Promise<void>;
  alCerrar: () => void;
}

/** Motivo (obligatorio), nota (obligatoria con «Otro») y, si hace falta, código de supervisor. */
export function ModalCortesia({ titulo, resumen, pideCodigo, alConfirmar, alCerrar }: ModalCortesiaProps) {
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorLocal = errorDatosCortesia(motivo, nota);
  const codigoFaltante = pideCodigo && !/^\d{6}$/.test(codigo);

  const confirmar = async () => {
    const e = errorDatosCortesia(motivo, nota);
    if (e) {
      setError(e);
      return;
    }
    if (codigoFaltante) {
      setError('Escribe el código de 6 dígitos del supervisor.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await alConfirmar(
        { motivo, nota: nota.trim() || undefined },
        pideCodigo ? codigo : undefined,
      );
    } catch (err) {
      setError((err as any)?.mensaje || (err as Error)?.message || 'No se pudo registrar la cortesía. Intenta de nuevo.');
      if ((err as any)?.codigo === 'CODIGO_INVALIDO') setCodigo('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div onClick={enviando ? undefined : alCerrar} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(11, 44, 62, 0.55)' }} />
      <div role="dialog" aria-modal="true" aria-label={titulo} className="ad-dialogo">
        <div className="ad-cabecera">
          <div className="ad-titulo">{titulo}</div>
          <button type="button" className="ad-cerrar" onClick={alCerrar} aria-label="Cerrar" disabled={enviando}>
            X
          </button>
        </div>
        <div className="ad-cuerpo">
          {resumen && <p style={{ margin: 0, fontWeight: 700 }}>{resumen}</p>}
          <p className="ad-aviso" role="note" style={{ margin: 0 }}>
            Una cortesía es una venta a costo 0: no suma ingresos ni cuenta como merma. Queda registrada con su motivo y su valor de lista.
          </p>

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <legend style={{ fontWeight: 800, marginBottom: 6 }}>Motivo (obligatorio)</legend>
            {MOTIVOS_CORTESIA.map((m) => (
              <label key={m.codigo} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
                <input
                  type="radio"
                  name="motivo-cortesia"
                  value={m.codigo}
                  checked={motivo === m.codigo}
                  onChange={() => {
                    setMotivo(m.codigo);
                    setError(null);
                  }}
                />
                {m.etiqueta}
              </label>
            ))}
          </fieldset>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 800 }}>{motivo === 'OTRO' ? 'Nota (obligatoria)' : 'Nota (opcional)'}</span>
            <textarea
              aria-label="Nota de la cortesía"
              value={nota}
              onChange={(e) => {
                setNota(e.target.value);
                setError(null);
              }}
              rows={2}
              maxLength={300}
              style={{ borderRadius: 10, padding: 8, fontSize: 15 }}
            />
          </label>

          {pideCodigo && (
            <CampoCodigoSupervisor
              id="cortesia-codigo"
              valor={codigo}
              onChange={(v) => {
                setCodigo(v);
                setError(null);
              }}
              etiqueta="Código del supervisor (6 dígitos)"
              ayuda="Lo ve el supervisor en su pantalla y cambia cada 30 segundos"
            />
          )}

          {error && (
            <div role="alert" style={{ color: 'var(--cp-rust, #B2500F)', fontWeight: 700 }}>
              {error}
            </div>
          )}
        </div>
        <div className="ad-pie" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Boton variante="secundario" disabled={enviando} onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            cargando={enviando}
            disabled={enviando || !!errorLocal || codigoFaltante}
            onClick={confirmar}
          >
            Dar cortesía
          </Boton>
        </div>
      </div>
    </>
  );
}

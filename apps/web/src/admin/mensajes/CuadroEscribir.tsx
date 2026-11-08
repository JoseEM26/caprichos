import { useEffect, useRef, useState } from 'react';
import { insertarEnCursor } from './emojis';
import { DetalleConversacion, RespuestaRapida } from './mensajesTipos';
import { SelectorEmojis } from './SelectorEmojis';

export const MAX_FOTO_BYTES = 5 * 1024 * 1024;
export const TIPOS_FOTO = ['image/jpeg', 'image/png'];


export interface CuadroEscribirProps {
  detalle: DetalleConversacion;
  respuestasRapidas: RespuestaRapida[];
  textoMensaje: string;
  onCambiarTexto: (texto: string) => void;
  textoPulido: string | null;
  pulirError: string | null;
  mensajeCopiado: string | null;
  enviando: boolean;
  onElegirRapida: (texto: string) => void;
  onPulir: () => void;
  onUsarPulido: (texto: string) => void;
  onDejarPulido: () => void;
  onEnviar: () => void;
  /** Envía una foto al cliente; si falla, lanza (el padre ya muestra el aviso) y la vista previa se queda. */
  onEnviarImagen?: (archivo: File, subtitulo: string) => Promise<void>;
}

/** Cuadro para escribir, siempre abajo: respuestas rápidas, «Pulir» y enviar. */
export function CuadroEscribir({
  detalle,
  respuestasRapidas,
  textoMensaje,
  onCambiarTexto,
  textoPulido,
  pulirError,
  mensajeCopiado,
  enviando,
  onElegirRapida,
  onPulir,
  onUsarPulido,
  onDejarPulido,
  onEnviar,
  onEnviarImagen,
}: CuadroEscribirProps) {
  const cajaRef = useRef<HTMLTextAreaElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const [emojisAbierto, setEmojisAbierto] = useState(false);
  const [foto, setFoto] = useState<{ archivo: File; url: string } | null>(null);
  const [subtitulo, setSubtitulo] = useState('');
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => () => {
    if (foto) URL.revokeObjectURL(foto.url);
  }, [foto]);

  const elegirEmoji = (emoji: string) => {
    const caja = cajaRef.current;
    const r = insertarEnCursor(textoMensaje, emoji, caja?.selectionStart ?? null, caja?.selectionEnd ?? null);
    onCambiarTexto(r.texto);
    setEmojisAbierto(false);
    // el cursor queda justo después del emoji
    setTimeout(() => {
      caja?.focus();
      caja?.setSelectionRange(r.cursor, r.cursor);
    }, 0);
  };

  const elegirFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (!TIPOS_FOTO.includes(archivo.type)) return setErrorFoto('Solo se pueden enviar fotos JPG o PNG.');
    if (archivo.size > MAX_FOTO_BYTES) return setErrorFoto('La foto pesa más de 5 MB. Elige una más liviana.');
    setErrorFoto(null);
    setSubtitulo('');
    setFoto({ archivo, url: URL.createObjectURL(archivo) });
  };

  const enviarFoto = async () => {
    if (!foto || !onEnviarImagen || subiendo) return;
    setSubiendo(true);
    try {
      await onEnviarImagen(foto.archivo, subtitulo.trim());
      setFoto(null);
    } catch {
      // el padre muestra el motivo; la vista previa queda para reintentar
    } finally {
      setSubiendo(false);
    }
  };

  const sinIdentificador = !detalle.telefono || !detalle.telefono.trim();
  return (
    <div className="msg-componer">
      {mensajeCopiado && (
        <div className="msg-copiado" role="status">
          {mensajeCopiado}
        </div>
      )}

      {respuestasRapidas.length > 0 && (
        <div className="msg-rapidas" aria-label="Respuestas rápidas">
          {respuestasRapidas.map((q) => (
            <button key={q.id} type="button" className="msg-rapida" onClick={() => onElegirRapida(q.texto)}>
              {q.titulo}
            </button>
          ))}
        </div>
      )}

      {textoPulido && (
        <div className="msg-pulir" role="status">
          <div className="msg-pulir-etiqueta">Así quedaría tu mensaje, más amable y bien escrito:</div>
          <div className="msg-pulir-texto">{textoPulido}</div>
          <div className="msg-pulir-botones">
            <button type="button" className="msg-ok" onClick={() => onUsarPulido(textoPulido)}>
              Usar este texto
            </button>
            <button type="button" className="msg-no" onClick={onDejarPulido}>
              Dejar el mío
            </button>
          </div>
        </div>
      )}

      {pulirError && (
        <div role="status" className="msg-error">
          {pulirError}
        </div>
      )}

      {errorFoto && (
        <div role="status" className="msg-error">
          {errorFoto}
        </div>
      )}

      {foto && (
        <div className="msg-foto-previa" role="group" aria-label="Vista previa de la foto">
          <img src={foto.url} alt="Foto que se va a enviar" />
          <div className="msg-foto-previa-cuerpo">
            <input
              type="text"
              aria-label="Subtítulo de la foto (opcional)"
              placeholder="Subtítulo (opcional)"
              maxLength={1024}
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
            />
            <div className="msg-pulir-botones">
              <button type="button" className="msg-ok" disabled={subiendo} onClick={enviarFoto}>
                {subiendo ? 'Enviando…' : 'Enviar foto'}
              </button>
              <button type="button" className="msg-no" disabled={subiendo} onClick={() => setFoto(null)}>
                Quitar
              </button>
            </div>
          </div>
        </div>
      )}

      {sinIdentificador ? (
        <div role="alert" className="msg-panel-nota" style={{ padding: '12px 14px', margin: 12, borderRadius: 10, background: '#F1F4F6', color: '#1B2A33', fontWeight: 600 }}>
          Este contacto no tiene ningun identificador: no se puede responder
        </div>
      ) : (
        <div className="msg-escribir">
          {onEnviarImagen && (
            <>
              <input ref={archivoRef} type="file" accept="image/jpeg,image/png" hidden data-testid="entrada-foto" onChange={elegirFoto} />
              <button
                type="button"
                className="msg-icono-btn"
                aria-label="Adjuntar una foto"
                title="Adjuntar foto (JPG o PNG, hasta 5 MB)"
                disabled={detalle.ocupado}
                onClick={() => archivoRef.current?.click()}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                  <path
                    d="M16.5 6.5v9a4.5 4.5 0 0 1-9 0v-10a3 3 0 0 1 6 0v9.5a1.5 1.5 0 0 1-3 0V7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </>
          )}
          <div style={{ position: 'relative', flex: 'none' }}>
            <button
              type="button"
              className="msg-icono-btn"
              aria-label="Elegir un emoji"
              aria-expanded={emojisAbierto}
              title="Emojis"
              disabled={detalle.ocupado}
              onClick={() => setEmojisAbierto((v) => !v)}
            >
              😊
            </button>
            {emojisAbierto && <SelectorEmojis onElegir={elegirEmoji} onCerrar={() => setEmojisAbierto(false)} />}
          </div>
          <textarea
            ref={cajaRef}
            rows={1}
            placeholder="Escribe un mensaje"
            title="Enter envía · Shift+Enter baja a otra línea"
            aria-label="Escribe un mensaje"
            value={textoMensaje}
            disabled={detalle.ocupado}
            onChange={(e) => {
              onCambiarTexto(e.target.value);
              // crece con las líneas (hasta 6) y vuelve a una sola al vaciarse
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
            }}
            onKeyDown={(e) => {
              // Enter envía; Shift+Enter baja a la línea siguiente sin enviar
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onEnviar();
              }
            }}
          />
          <button
            type="button"
            className="msg-pulir-btn"
            aria-label="Pulir el mensaje para que sea más amable"
            disabled={detalle.ocupado}
            onClick={onPulir}
          >
            Pulir
          </button>
          <button
            type="button"
            className="msg-enviar"
            aria-label="Enviar mensaje"
            disabled={detalle.ocupado || enviando}
            onClick={() => onEnviar()}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
              <path d="M3 20l18-8L3 4v6l11 2-11 2z" fill="#FFFFFF" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

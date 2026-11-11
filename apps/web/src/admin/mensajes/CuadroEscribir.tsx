import { useEffect, useRef, useState } from 'react';
import { marcadoresPendientes, resolverPlantilla as resolverPlantillaTexto } from '@caprichos/compartido';
import { insertarEnCursor } from './emojis';
import { ContextoPlantillas, DetalleConversacion, RespuestaRapida } from './mensajesTipos';
import { filtrarPlantillas, PanelPlantillas, valoresPlantilla } from './PanelPlantillas';
import { ModalPlantillas } from './ModalPlantillas';
import { SelectorEmojis } from './SelectorEmojis';
import { formatearTamano } from './TarjetaDocumento';

/** El servidor comprime a ≤5 MB (límite de WhatsApp); aquí solo se corta lo absurdo. */
export const MAX_FOTO_BYTES = 16 * 1024 * 1024;
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
/** Documentos permitidos (mismo criterio que el servidor: extensión y tipo coherentes). */
export const MAX_DOCUMENTO_BYTES = 16 * 1024 * 1024;
export const ACCEPT_DOCUMENTOS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';
const EXT_DOCUMENTO = ACCEPT_DOCUMENTOS.split(',').map((e) => e.slice(1));
export function errorDocumento(a: { name: string; size: number }): string | null {
  const ext = a.name.includes('.') ? a.name.split('.').pop()!.toLowerCase() : '';
  if (!EXT_DOCUMENTO.includes(ext)) return 'Solo se pueden enviar documentos PDF, Word, Excel, PowerPoint o de texto.';
  if (a.size === 0) return 'El documento está vacío.';
  if (a.size > MAX_DOCUMENTO_BYTES) return 'El documento pesa más de 16 MB. Elige uno más liviano.';
  return null;
}
export const MOTIVO_VENTANA = 'Pasaron más de 24 h: solo se pueden enviar plantillas';


export interface CuadroEscribirProps {
  detalle: DetalleConversacion;
  respuestasRapidas: RespuestaRapida[];
  textoMensaje: string;
  onCambiarTexto: (texto: string) => void;
  textoPulido: string | null;
  pulirError: string | null;
  mensajeCopiado: string | null;
  enviando: boolean;
  /** Ya no se usa: la plantilla se inserta en el cuadro desde aquí (se deja por compatibilidad). */
  onElegirRapida?: (texto: string) => void;
  /** Datos del local para las {{variables}} de las plantillas. */
  contextoPlantillas?: ContextoPlantillas;
  /** Crear, editar, pausar y borrar plantillas (quien puede responder chats). */
  puedeAdministrarPlantillas?: boolean;
  /** Se guardó un cambio en las plantillas: la bandeja las vuelve a pedir. */
  onPlantillasCambiaron?: () => void;
  onPulir: () => void;
  onUsarPulido: (texto: string) => void;
  onDejarPulido: () => void;
  onEnviar: () => void;
  /** Envía una foto al cliente; si falla, lanza (el padre ya muestra el aviso) y la vista previa se queda. */
  onEnviarImagen?: (archivo: File, subtitulo: string) => Promise<void>;
  /** Envía un documento al cliente; si falla, lanza (el padre ya muestra el aviso). */
  onEnviarDocumento?: (archivo: File) => Promise<void>;
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
  contextoPlantillas,
  puedeAdministrarPlantillas = false,
  onPlantillasCambiaron,
  onPulir,
  onUsarPulido,
  onDejarPulido,
  onEnviar,
  onEnviarImagen,
  onEnviarDocumento,
}: CuadroEscribirProps) {
  const cajaRef = useRef<HTMLTextAreaElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const [emojisAbierto, setEmojisAbierto] = useState(false);
  const plantillasRef = useRef<HTMLButtonElement>(null);
  const [plantillasAbierto, setPlantillasAbierto] = useState(false);
  const [adminAbierto, setAdminAbierto] = useState(false);
  const [faltan, setFaltan] = useState<string[]>([]);
  const [errorMarcador, setErrorMarcador] = useState<string | null>(null);
  const [sugerida, setSugerida] = useState(0);
  const [foto, setFoto] = useState<{ archivo: File; url: string } | null>(null);
  const [subtitulo, setSubtitulo] = useState('');
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<File | null>(null);
  const [errorDoc, setErrorDoc] = useState<string | null>(null);
  const [enviandoDoc, setEnviandoDoc] = useState(false);

  useEffect(() => () => {
    if (foto) URL.revokeObjectURL(foto.url);
  }, [foto]);

  // al cambiar de chat el selector no se queda abierto
  useEffect(() => {
    setEmojisAbierto(false);
    setPlantillasAbierto(false);
    setFaltan([]);
    setErrorMarcador(null);
  }, [detalle.id]);

  // la caja crece con el texto aunque se llene desde una plantilla, y vuelve a una línea al vaciarse
  useEffect(() => {
    const c = cajaRef.current;
    if (!c) return;
    c.style.height = 'auto';
    if (textoMensaje) c.style.height = `${Math.min(c.scrollHeight, 150)}px`;
  }, [textoMensaje]);

  const valores = valoresPlantilla(contextoPlantillas ?? {}, detalle.nombre);
  const puedePlantillas = respuestasRapidas.length > 0 || puedeAdministrarPlantillas;
  // atajo: escribir «/» al inicio sugiere plantillas por título
  const sugerencias = puedePlantillas && /^\/\S*$/.test(textoMensaje)
    ? filtrarPlantillas(respuestasRapidas.filter((p) => p.activo !== false), textoMensaje.slice(1), null).slice(0, 6)
    : [];

  /** Pone el texto en el cuadro (nunca envía): al inicio si estaba vacío o escribiendo «/…», si no donde está el cursor. */
  const insertarPlantilla = (texto: string, faltantes: string[]) => {
    const caja = cajaRef.current;
    const vacio = !textoMensaje.trim() || /^\/\S*$/.test(textoMensaje);
    const r = vacio
      ? { texto, cursor: texto.length }
      : insertarEnCursor(textoMensaje, texto, caja?.selectionStart ?? null, caja?.selectionEnd ?? null);
    onCambiarTexto(r.texto);
    setFaltan(faltantes);
    setErrorMarcador(null);
    setPlantillasAbierto(false);
    setSugerida(0);
    setTimeout(() => {
      caja?.focus();
      caja?.setSelectionRange(r.cursor, r.cursor);
    }, 0);
  };

  const elegirSugerida = (i: number) => {
    const p = sugerencias[i];
    if (!p) return;
    const r = resolverPlantillaTexto(p.texto, valores);
    insertarPlantilla(r.texto, r.faltantes);
  };

  /** No se envía con un {{marcador}} sin completar: se avisa cuál falta. */
  const intentarEnviar = () => {
    const pendientes = marcadoresPendientes(textoMensaje);
    if (pendientes.length > 0) {
      setErrorMarcador(`Completa antes de enviar: ${pendientes.map((m) => `{{${m}}}`).join(', ')}`);
      cajaRef.current?.focus();
      return;
    }
    setErrorMarcador(null);
    setFaltan([]);
    onEnviar();
  };

  const cerrarEmojis = () => {
    setEmojisAbierto(false);
    cajaRef.current?.focus();
  };

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

  const fotoBloqueada = detalle.ventanaAbierta === false;

  const aceptarFoto = (archivo: File | undefined) => {
    if (!archivo || !onEnviarImagen || fotoBloqueada || detalle.ocupado) return;
    if (!TIPOS_FOTO.includes(archivo.type)) return setErrorFoto('Solo se pueden enviar fotos JPG, PNG o WebP.');
    if (archivo.size > MAX_FOTO_BYTES) return setErrorFoto('La foto pesa más de 16 MB. Elige una más liviana.');
    setErrorFoto(null);
    setSubtitulo('');
    setFoto({ archivo, url: URL.createObjectURL(archivo) });
  };

  const elegirFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    aceptarFoto(archivo);
  };

  // Ctrl+V con una imagen en el portapapeles (el texto pegado sigue normal)
  const pegar = (e: React.ClipboardEvent) => {
    const archivo = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
    if (!archivo) return;
    e.preventDefault();
    aceptarFoto(archivo);
  };

  const soltar = (e: React.DragEvent) => {
    const archivo = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'));
    if (!archivo) return;
    e.preventDefault();
    aceptarFoto(archivo);
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

  const elegirDocumento = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo || !onEnviarDocumento || fotoBloqueada || detalle.ocupado) return;
    const problema = errorDocumento(archivo);
    setErrorDoc(problema);
    setDoc(problema ? null : archivo);
  };

  const enviarDocumento = async () => {
    if (!doc || !onEnviarDocumento || enviandoDoc) return;
    setEnviandoDoc(true);
    try {
      await onEnviarDocumento(doc);
      setDoc(null);
    } catch {
      // el padre muestra el motivo; la vista previa queda para reintentar
    } finally {
      setEnviandoDoc(false);
    }
  };

  const sinIdentificador = !detalle.telefono || !detalle.telefono.trim();
  return (
    <div
      className="msg-componer"
      onDragOver={(e) => {
        if (onEnviarImagen && e.dataTransfer?.types?.includes('Files')) e.preventDefault();
      }}
      onDrop={soltar}
    >
      {mensajeCopiado && (
        <div className="msg-copiado" role="status">
          {mensajeCopiado}
        </div>
      )}

      {sugerencias.length > 0 && (
        <ul className="msg-pl-sugerencias" role="listbox" aria-label="Plantillas sugeridas">
          {sugerencias.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === sugerida}>
              <button type="button" className={i === sugerida ? 'msg-pl-sug msg-pl-sug-activa' : 'msg-pl-sug'} onClick={() => elegirSugerida(i)}>
                <b>{p.titulo}</b>
              </button>
            </li>
          ))}
        </ul>
      )}

      {faltan.length > 0 && !errorMarcador && (
        <div role="status" className="msg-error" data-testid="plantilla-falta">
          Falta completar a mano: {faltan.map((f) => `{{${f}}}`).join(', ')}
        </div>
      )}

      {errorMarcador && (
        <div role="alert" className="msg-error" data-testid="plantilla-pendiente">
          {errorMarcador}
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

      {onEnviarImagen && fotoBloqueada && (
        <div role="status" className="msg-error" data-testid="motivo-foto">
          {MOTIVO_VENTANA}
        </div>
      )}

      {errorDoc && (
        <div role="status" className="msg-error" data-testid="error-documento">
          {errorDoc}
        </div>
      )}

      {doc && (
        <div className="msg-doc-previa" role="group" aria-label="Vista previa del documento">
          <div className="msg-doc">
            <span className="msg-doc-icono" aria-hidden="true">📄</span>
            <div className="msg-doc-datos">
              <div className="msg-doc-nombre">{doc.name}</div>
              <div className="msg-doc-tam">{formatearTamano(doc.size)}</div>
            </div>
          </div>
          <div>¿Enviar este documento a {detalle.nombre || 'este cliente'}?</div>
          <div className="msg-pulir-botones">
            <button type="button" className="msg-ok" disabled={enviandoDoc} onClick={enviarDocumento}>
              {enviandoDoc ? 'Enviando…' : 'Sí, enviar'}
            </button>
            <button type="button" className="msg-no" disabled={enviandoDoc} onClick={() => setDoc(null)}>
              No
            </button>
          </div>
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
              <input ref={archivoRef} type="file" accept="image/jpeg,image/png,image/webp" hidden data-testid="entrada-foto" onChange={elegirFoto} />
              <button
                type="button"
                className="msg-icono-btn"
                aria-label="Adjuntar foto"
                title={fotoBloqueada ? MOTIVO_VENTANA : 'Adjuntar foto (JPG, PNG o WebP). También puedes pegarla o arrastrarla'}
                disabled={detalle.ocupado || fotoBloqueada}
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
                <span className="msg-icono-txt">Foto</span>
              </button>
            </>
          )}
          {onEnviarDocumento && (
            <>
              <input ref={docRef} type="file" accept={ACCEPT_DOCUMENTOS} hidden data-testid="entrada-documento" onChange={elegirDocumento} />
              <button
                type="button"
                className="msg-icono-btn"
                aria-label="Adjuntar documento"
                title={fotoBloqueada ? MOTIVO_VENTANA : 'Adjuntar documento (PDF, Word, Excel, PowerPoint o texto, hasta 16 MB)'}
                disabled={detalle.ocupado || fotoBloqueada || enviandoDoc}
                onClick={() => docRef.current?.click()}
              >
                <span aria-hidden="true">📄</span>
                <span className="msg-icono-txt">Documento</span>
              </button>
            </>
          )}
          {puedePlantillas && (
            <button
              ref={plantillasRef}
              type="button"
              className="msg-icono-btn"
              aria-label="Plantillas de respuesta"
              aria-haspopup="dialog"
              aria-expanded={plantillasAbierto}
              title={detalle.ocupado ? 'Para usar plantillas, toma el chat' : 'Plantillas de respuesta rápida (también escribe «/»)'}
              disabled={detalle.ocupado}
              onClick={() => setPlantillasAbierto((v) => !v)}
            >
              <span aria-hidden="true">⚡</span>
              <span className="msg-icono-txt">Plantillas</span>
            </button>
          )}
          <div style={{ position: 'relative', flex: 'none' }}>
            <button
              type="button"
              className="msg-icono-btn"
              aria-label="Elegir un emoji"
              aria-expanded={emojisAbierto}
              title={detalle.ocupado ? 'Para usar emojis, toma el chat' : 'Emojis'}
              disabled={detalle.ocupado}
              onClick={() => setEmojisAbierto((v) => !v)}
            >
              😊
            </button>
            {emojisAbierto && <SelectorEmojis onElegir={elegirEmoji} onCerrar={cerrarEmojis} />}
          </div>
          <textarea
            ref={cajaRef}
            onPaste={pegar}
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
              if (sugerencias.length > 0 && !e.nativeEvent.isComposing) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSugerida((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + sugerencias.length) % sugerencias.length);
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  elegirSugerida(Math.min(sugerida, sugerencias.length - 1));
                  return;
                }
              }
              // Enter envía; Shift+Enter baja a la línea siguiente sin enviar
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                intentarEnviar();
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
            onClick={() => intentarEnviar()}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
              <path d="M3 20l18-8L3 4v6l11 2-11 2z" fill="#FFFFFF" />
            </svg>
          </button>
        </div>
      )}
      {plantillasAbierto && (
        <PanelPlantillas
          plantillas={respuestasRapidas}
          valores={valores}
          ancla={plantillasRef}
          puedeAdministrar={puedeAdministrarPlantillas}
          alElegir={insertarPlantilla}
          alAdministrar={() => {
            setPlantillasAbierto(false);
            setAdminAbierto(true);
          }}
          alCerrar={() => {
            setPlantillasAbierto(false);
            cajaRef.current?.focus();
          }}
        />
      )}
      {adminAbierto && (
        <ModalPlantillas contexto={valores} alCambiar={() => onPlantillasCambiaron?.()} alCerrar={() => setAdminAbierto(false)} />
      )}
    </div>
  );
}

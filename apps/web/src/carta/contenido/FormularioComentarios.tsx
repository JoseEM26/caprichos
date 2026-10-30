import { useState } from 'react';
import { api } from '../../comun/api';
import { useEsMovil } from '../useEsMovil';

const TIPOS_FEEDBACK = [
  { id: 'COMENTARIO', n: 'Comentario' },
  { id: 'SUGERENCIA', n: 'Sugerencia' },
  { id: 'FELICITACION', n: 'Felicitación' },
  { id: 'QUEJA', n: 'Queja' },
  { id: 'RECLAMO', n: 'Reclamo' },
];

export function FormularioComentarios() {
  const movil = useEsMovil();
  const [tipo, setTipo] = useState('COMENTARIO');
  const [mensaje, setMensaje] = useState('');
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [dni, setDni] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [monto, setMonto] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const esReclamo = tipo === 'RECLAMO';

  const enviar = async () => {
    let m = mensaje.trim();
    if (m.length < 5) {
      setErrorMsg('Escribe tu mensaje (al menos unas palabras).');
      return;
    }
    if (esReclamo) {
      if (
        !/^[0-9A-Za-z]{8,12}$/.test(dni.trim()) ||
        domicilio.trim().length < 6 ||
        nombre.trim().length < 3 ||
        contacto.trim().length < 6
      ) {
        setErrorMsg(
          'Para un reclamo completa nombre, DNI o carné, domicilio y teléfono o correo.',
        );
        return;
      }
      m =
        `LIBRO DE RECLAMACIONES · DNI/CE ${dni.trim()} · Domicilio: ${domicilio.trim()}` +
        (monto.trim() ? ` · Monto reclamado: s/ ${monto.trim()}` : '') +
        ` · Detalle: ${m}`;
    }

    setEnviando(true);
    setErrorMsg(null);
    try {
      await api.post('/carta/contenido/comentario', {
        tipo,
        texto: m,
        nombre: nombre.trim() || undefined,
        contacto: contacto.trim() || undefined,
        dni: dni.trim() || undefined,
        domicilio: domicilio.trim() || undefined,
        monto: monto.trim() || undefined,
      });
      setEnviado(true);
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'No se pudo enviar el mensaje. Inténtalo nuevamente.',
      );
    } finally {
      setEnviando(false);
    }
  };

  const nuevoMensaje = () => {
    setDni('');
    setDomicilio('');
    setMonto('');
    setEnviado(false);
    setMensaje('');
    setNombre('');
    setContacto('');
    setTipo('COMENTARIO');
    setErrorMsg(null);
  };

  const fbThanks =
    tipo === 'QUEJA'
      ? 'Lamentamos lo ocurrido. Tu mensaje le llega directamente al dueño y lo revisaremos lo antes posible.'
      : tipo === 'FELICITACION'
        ? 'Qué alegría leerte. Se lo compartimos a todo el equipo.'
        : 'Lo leeremos con atención para seguir mejorando.';

  const secPad = movil ? '12px 16px 0' : '24px 24px 0';
  const fbTop = movil ? 28 : 48;
  const fbRad = movil ? 16 : 20;
  const fbPad = movil ? '16px' : '28px';
  const fbGap = movil ? 16 : 28;
  const fbTitleFs = movil ? 22 : 28;
  const fbTitleLh = movil ? '28px' : '34px';
  const fbH = movil ? 42 : 44;
  const fbBtn = movil ? 48 : 52;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: secPad, marginTop: fbTop }}>
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: fbRad,
          padding: fbPad,
          display: 'flex',
          flexWrap: 'wrap',
          gap: fbGap,
        }}
      >
        {/* Lado izquierdo descriptivo */}
        <div
          style={{
            flex: '1 1 260px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: '0.12em',
              color: 'var(--cp-rust)',
            }}
          >
            TU OPINIÓN NOS AYUDA
          </span>
          <span
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: fbTitleFs,
              lineHeight: fbTitleLh,
            }}
          >
            ¿Cómo te fue en Caprichos?
          </span>
          <span style={{ fontSize: 14, lineHeight: '21px', color: 'var(--cp-soft)' }}>
            Cuéntanos qué te gustó, qué podemos mejorar o qué te gustaría ver en la carta. Leemos cada mensaje.
          </span>
        </div>

        {/* Lado derecho: formulario o confirmación de enviado */}
        <div style={{ flex: '1.4 1 300px', minWidth: 0 }}>
          {!enviado ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Selector de tipo */}
              <div
                role="group"
                aria-label="Tipo de mensaje"
                style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
              >
                {TIPOS_FEEDBACK.map((t) => {
                  const activo = tipo === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTipo(t.id);
                        setErrorMsg(null);
                      }}
                      style={{
                        minHeight: 40,
                        padding: '0 14px',
                        borderRadius: 9999,
                        border: '1.5px solid var(--cp-navy)',
                        background: activo ? 'var(--cp-navy)' : 'transparent',
                        color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {t.n}
                    </button>
                  );
                })}
              </div>

              {/* Textarea */}
              <div>
                <label htmlFor="fb-msg" style={{ position: 'absolute', left: -9999 }}>
                  Tu mensaje
                </label>
                <textarea
                  id="fb-msg"
                  rows={4}
                  value={mensaje}
                  onChange={(e) => {
                    setMensaje(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="Escribe aquí tu mensaje"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderRadius: 12,
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-cream)',
                    color: 'var(--cp-navy)',
                    padding: '10px 12px',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Nombre y contacto */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: '1 1 140px' }}>
                  <label htmlFor="fb-name" style={{ position: 'absolute', left: -9999 }}>
                    Tu nombre
                  </label>
                  <input
                    id="fb-name"
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Tu nombre (opcional)"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: fbH,
                      borderRadius: 12,
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-cream)',
                      color: 'var(--cp-navy)',
                      padding: '0 12px',
                      fontSize: 14,
                    }}
                  />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label
                    htmlFor="fb-contact"
                    style={{ position: 'absolute', left: -9999 }}
                  >
                    Teléfono o correo
                  </label>
                  <input
                    id="fb-contact"
                    type="text"
                    value={contacto}
                    onChange={(e) => setContacto(e.target.value)}
                    placeholder="Teléfono o correo (opcional)"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: fbH,
                      borderRadius: 12,
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-cream)',
                      color: 'var(--cp-navy)',
                      padding: '0 12px',
                      fontSize: 14,
                    }}
                  />
                </div>
              </div>

              {/* Si es Reclamo: Libro de Reclamaciones (líneas 359-363 de Main.dc.html) */}
              {esReclamo && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    border: '1.5px solid var(--cp-line)',
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div style={{ fontWeight: 800 }}>Libro de Reclamaciones</div>
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: '17px',
                      color: 'var(--cp-soft)',
                    }}
                  >
                    Un reclamo es por el producto o servicio recibido; una queja es por la atención. Necesitamos tus datos para responderte por escrito en un máximo de 15 días hábiles.
                  </div>
                  <div>
                    <label
                      htmlFor="fb-dni"
                      style={{ fontSize: 12, fontWeight: 700, display: 'block' }}
                    >
                      DNI o carné de extranjería (obligatorio)
                    </label>
                    <input
                      id="fb-dni"
                      type="text"
                      inputMode="numeric"
                      value={dni}
                      onChange={(e) => {
                        setDni(e.target.value);
                        setErrorMsg(null);
                      }}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: 48,
                        borderRadius: 12,
                        border: '1.5px solid var(--cp-line)',
                        background: 'var(--cp-cream)',
                        color: 'var(--cp-navy)',
                        padding: '0 12px',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="fb-dom"
                      style={{ fontSize: 12, fontWeight: 700, display: 'block' }}
                    >
                      Domicilio (obligatorio)
                    </label>
                    <input
                      id="fb-dom"
                      type="text"
                      value={domicilio}
                      onChange={(e) => {
                        setDomicilio(e.target.value);
                        setErrorMsg(null);
                      }}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: 48,
                        borderRadius: 12,
                        border: '1.5px solid var(--cp-line)',
                        background: 'var(--cp-cream)',
                        color: 'var(--cp-navy)',
                        padding: '0 12px',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="fb-monto"
                      style={{ fontSize: 12, fontWeight: 700, display: 'block' }}
                    >
                      Monto reclamado en s/ (opcional)
                    </label>
                    <input
                      id="fb-monto"
                      type="text"
                      inputMode="decimal"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: 48,
                        borderRadius: 12,
                        border: '1.5px solid var(--cp-line)',
                        background: 'var(--cp-cream)',
                        color: 'var(--cp-navy)',
                        padding: '0 12px',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: '17px',
                      color: 'var(--cp-soft)',
                    }}
                  >
                    Nombre y teléfono o correo también son obligatorios para un reclamo. Cuéntanos qué pasó y qué solución esperas en el mensaje.
                  </div>
                </div>
              )}

              <div style={{ fontSize: 11, lineHeight: '15px', color: 'var(--cp-soft)' }}>
                Déjanos tu teléfono o correo solo si quieres que te respondamos. Solo usamos tus datos para eso.
              </div>

              {errorMsg && (
                <div style={{ fontSize: 13, fontWeight: 700, color: '#B2500F' }}>
                  {errorMsg}
                </div>
              )}

              <button
                onClick={enviar}
                disabled={enviando}
                style={{
                  minHeight: fbBtn,
                  border: 0,
                  borderRadius: 12,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: enviando ? 'wait' : 'pointer',
                  opacity: enviando ? 0.7 : 1,
                }}
              >
                {enviando ? 'Enviando...' : 'Enviar mensaje'}
              </button>
            </div>
          ) : (
            <div
              role="status"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 0',
              }}
            >
              <span
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  background: '#2F9E57',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="26"
                  height="26"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <div
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                ¡Gracias por escribirnos!
              </div>
              <div style={{ fontSize: 14, lineHeight: '21px', color: 'var(--cp-soft)' }}>
                {fbThanks}
              </div>
              <button
                onClick={nuevoMensaje}
                style={{
                  minHeight: 44,
                  padding: '0 16px',
                  borderRadius: 12,
                  border: '1.5px solid var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Escribir otro mensaje
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

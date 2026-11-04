import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../../comun/api';

/**
 * Modo WHATSAPP_ENTRANTE (el que está activo por defecto; ver verificacion_celular_modo en la API).
 * El cliente toca el botón, WhatsApp abre el mensaje ya escrito con su código y él lo envía. Cuando llega,
 * el servidor marca el celular como verificado y esta pantalla pasa sola al siguiente paso.
 *
 * Para volver al modo anterior (código de 6 dígitos por plantilla de Meta) basta cambiar el parámetro
 * verificacion_celular_modo a CODIGO_PLANTILLA, cuando las plantillas caprichos_codigo_cuenta y
 * caprichos_codigo_recuperar estén aprobadas. FormularioAcceso decide cuál mostrar según la respuesta del servidor.
 */

/** Respuesta de registro/codigo y recuperar/solicitar cuando el modo es WHATSAPP_ENTRANTE. */
export interface RespuestaVerificacionWa {
  ok: true;
  modo: 'WHATSAPP_ENTRANTE';
  token: string;
  enlace: string;
  vence_seg: number;
  mensaje: string;
}

export const esRespuestaWhatsappEntrante = (r: unknown): r is RespuestaVerificacionWa =>
  (r as { modo?: string } | null)?.modo === 'WHATSAPP_ENTRANTE';

/** Cada 2 s, como máximo 10 minutos (lo que dura el token). */
const INTERVALO_MS = 2000;
const MAX_SONDEOS = 300;

type Estado = 'pendiente' | 'verificado' | 'vencido';

const botonWa: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 52,
  borderRadius: 12,
  background: '#25D366',
  color: '#fff',
  fontFamily: 'var(--fuente-titulos)',
  fontWeight: 800,
  fontSize: 16,
  textDecoration: 'none',
  textAlign: 'center',
  padding: '0 12px',
};

export function VerificacionWhatsapp({
  token,
  enlace,
  mensaje,
  alVerificar,
  alReenviar,
  puedeReenviar,
}: {
  token: string;
  enlace: string;
  mensaje?: string;
  /** Se llama una vez, cuando el servidor confirma que el celular es el que escribió. */
  alVerificar: () => void;
  alReenviar: () => void;
  /** Falso mientras hay espera o un envío en curso. */
  puedeReenviar: boolean;
}) {
  const [estado, setEstado] = useState<Estado>('pendiente');
  // La referencia evita que un cambio de función reinicie el sondeo
  const alVerificarRef = useRef(alVerificar);
  alVerificarRef.current = alVerificar;

  useEffect(() => {
    setEstado('pendiente');
    let activo = true;
    let sondeos = 0;
    const timer = setInterval(async () => {
      sondeos += 1;
      if (sondeos > MAX_SONDEOS) {
        clearInterval(timer);
        if (activo) setEstado('vencido');
        return;
      }
      try {
        const r = await api.get<{ estado: Estado }>(`/carta/cuenta/verificar/estado?token=${encodeURIComponent(token)}`);
        if (!activo || r.estado === 'pendiente') return;
        clearInterval(timer);
        setEstado(r.estado);
        if (r.estado === 'verificado') alVerificarRef.current();
      } catch {
        // Un fallo puntual de red no corta el sondeo
      }
    }, INTERVALO_MS);
    return () => {
      activo = false;
      clearInterval(timer);
    };
  }, [token]);

  if (estado === 'verificado') {
    return (
      <div role="status" style={{ fontSize: 14, fontWeight: 700, color: 'var(--cp-ok)' }}>
        Celular verificado. Seguimos con el siguiente paso...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <a href={enlace} target="_blank" rel="noopener noreferrer" style={botonWa}>
        Abrir WhatsApp y enviar mensaje
      </a>
      {estado === 'pendiente' && (
        <div role="status" style={{ fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft)' }}>
          {mensaje ?? 'Toca enviar en WhatsApp y vuelve aquí.'} Cuando llegue tu mensaje, pasamos solos al siguiente paso.
          <div style={{ marginTop: 4 }}>Esperando tu mensaje de WhatsApp...</div>
        </div>
      )}
      {estado === 'vencido' && (
        <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
          El enlace venció. Pide uno nuevo.
        </div>
      )}
      {estado === 'vencido' ? (
        <button type="button" onClick={alReenviar} disabled={!puedeReenviar} style={{ minHeight: 44, border: 0, background: 'transparent', color: 'var(--cp-orange)', fontWeight: 800, fontSize: 13, textDecoration: 'underline', alignSelf: 'flex-start' }}>
          Pedir un enlace nuevo
        </button>
      ) : (
        <button type="button" onClick={alReenviar} disabled={!puedeReenviar} style={{ minHeight: 44, border: 0, background: 'transparent', color: 'var(--cp-orange)', fontWeight: 800, fontSize: 13, textDecoration: 'underline', alignSelf: 'flex-start' }}>
          Reenviar
        </button>
      )}
    </div>
  );
}

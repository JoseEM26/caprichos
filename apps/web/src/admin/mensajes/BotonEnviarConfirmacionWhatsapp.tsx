import { useEffect, useState } from 'react';
import { useSesion } from '../../comun/sesion';
import { avisosPendientesDe, type AvisoPendiente } from './avisosPendientesApi';
import { urlMensajesConTexto } from './utilidadesChat';

const ETIQUETA: Record<string, string> = {
  RECIBIDO: 'Enviar confirmación por WhatsApp',
  ACEPTADO: 'Enviar confirmación por WhatsApp',
  LISTO: 'Enviar aviso «pedido listo»',
  LISTO_RECOJO: 'Enviar aviso «pedido listo»',
  SALIDA: 'Enviar aviso «ya salió»',
  LLEGADA: 'Enviar aviso «llegó tu pedido»',
  ENTREGADO: 'Enviar aviso «entregado»',
};

/** «Fuera de las 24 h: envíalo tú» cuando es por la ventana; si no, el motivo que dejó el sistema. */
const porQue = (a: AvisoPendiente) => (/24 h/.test(a.motivo) ? 'Fuera de las 24 h: envíalo tú' : a.motivo);

/**
 * Botón OPCIONAL de un pedido: el aviso al cliente no salió solo (fuera de las 24 h, fuera de horario, número desconectado...).
 * Abre el chat del cliente en Mensajes con el mensaje YA escrito; la persona solo toca Enviar. No envía nada por su cuenta.
 * Sin avisos pendientes no se dibuja nada.
 */
export function BotonEnviarConfirmacionWhatsapp({ pedidoId, compacto }: { pedidoId: string | number | bigint; compacto?: boolean }) {
  const [avisos, setAvisos] = useState<AvisoPendiente[]>([]);
  let puede = false;
  try {
    const sesion = useSesion();
    puede = Boolean(sesion?.tiene?.('mensajes/enviar')) || sesion?.usuario?.rol === 'ADMIN';
  } catch {
    puede = false;
  }
  useEffect(() => {
    if (!puede) return;
    let vivo = true;
    avisosPendientesDe(String(pedidoId))
      .then((a) => vivo && setAvisos(a))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [pedidoId, puede]);
  // Un mismo botón (misma etiqueta) una sola vez: RECIBIDO y ACEPTADO dicen lo mismo («Enviar confirmación»); queda el más reciente
  const visibles = [...new Map(avisos.map((a) => [ETIQUETA[a.etapa] ?? `aviso-${a.id}`, a])).values()];
  if (!puede || visibles.length === 0) return null;
  return (
    <div data-testid="avisos-whatsapp-pendientes" style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={(e) => e.stopPropagation()}>
      {visibles.map((a) => (
        <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <a
            href={urlMensajesConTexto(a.telefono, a.texto)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              minHeight: compacto ? 40 : 48,
              boxSizing: 'border-box',
              padding: '0 14px',
              borderRadius: 12,
              background: 'var(--cp-green, #2F7A45)',
              color: 'var(--cp-white, #FFFFFF)',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            {ETIQUETA[a.etapa] ?? 'Enviar aviso por WhatsApp'}
          </a>
          <span style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)', textAlign: 'center' }}>{porQue(a)}</span>
        </div>
      ))}
    </div>
  );
}

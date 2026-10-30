import { useEffect, useState } from 'react';
import { useSesion } from '../../comun/sesion';
import { listarConversaciones } from './mensajesApi';

/** Últimos 9 dígitos del celular; vacío si no hay un número usable. */
export function ultimos9Digitos(telefono: string | null | undefined): string {
  const d = String(telefono || '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : '';
}

type EstadoChat = 'buscando' | 'existe' | 'no_existe' | 'sin_permiso';

/**
 * Botón de un pedido que abre el chat del cliente dentro de /admin/mensajes (pestaña nueva, con el chat
 * seleccionado). Así el mensaje queda en el sistema (mensaje_chat y outbox). Sin chat o sin permiso,
 * deshabilitado; wa.me queda solo como enlace secundario de último recurso.
 */
export function BotonAbrirChatCliente({ telefono, estilo }: { telefono: string | null | undefined; estilo?: React.CSSProperties }) {
  let puedeMensajes = false;
  try {
    const sesion = useSesion();
    puedeMensajes = Boolean(sesion?.tiene?.('mensajes/ver')) || sesion?.usuario?.rol === 'ADMIN';
  } catch {
    puedeMensajes = false;
  }

  const digitos = ultimos9Digitos(telefono);
  const [estado, setEstado] = useState<EstadoChat>('buscando');

  useEffect(() => {
    let activo = true;
    if (!digitos) return;
    if (!puedeMensajes) {
      setEstado('sin_permiso');
      return;
    }
    setEstado('buscando');
    listarConversaciones('todos', digitos)
      .then((res) => {
        if (!activo) return;
        const existe = res.chats.some((c) => ultimos9Digitos(c.telefono) === digitos);
        setEstado(existe ? 'existe' : 'no_existe');
      })
      .catch(() => {
        if (activo) setEstado('sin_permiso');
      });
    return () => {
      activo = false;
    };
  }, [digitos, puedeMensajes]);

  const base: React.CSSProperties = {
    minHeight: 48,
    boxSizing: 'border-box',
    border: 0,
    borderRadius: 12,
    background: 'var(--cp-green, #2F7A45)',
    color: 'var(--cp-white, #FFFFFF)',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    ...estilo,
  };
  const deshabilitado: React.CSSProperties = { ...base, background: '#D9D9D9', color: '#54656F', cursor: 'not-allowed' };
  const linkWa = digitos ? `https://wa.me/51${digitos}` : null;

  if (!digitos) {
    return (
      <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>Sin teléfono: no hay chat con el cliente.</div>
    );
  }

  if (estado === 'existe') {
    return (
      <a href={`/admin/mensajes?telefono=${digitos}`} target="_blank" rel="noopener noreferrer" style={base}>
        Abrir chat con el cliente
      </a>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" disabled aria-disabled="true" style={deshabilitado}>
        {estado === 'sin_permiso' ? 'Sin permiso para ver Mensajes' : estado === 'buscando' ? 'Buscando el chat...' : 'Sin chat todavía'}
      </button>
      {linkWa && (
        <a href={linkWa} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)', alignSelf: 'center' }}>
          Abrir en WhatsApp personal
        </a>
      )}
    </div>
  );
}

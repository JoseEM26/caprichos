import { useEffect, useState } from 'react';
import { api } from '../comun/api';
import type { DatosLocalCarta } from './tipos';

/**
 * «Activa los avisos de tu pedido por WhatsApp»: solo si el bot no puede escribirle primero (su celular nunca escribió; regla anti-baneo).
 * Abre el chat del local con «Hola, mi pedido CP-XXXX»: al llegar ese mensaje el bot vincula el chat y manda el resumen al instante.
 */
export function BotonRecibirPorWhatsapp({ codigo, token }: { codigo: string; token?: string | null }) {
  const [numero, setNumero] = useState<string | null>(null);
  const [clave, setClave] = useState('');
  useEffect(() => {
    if (!token) return;
    let activo = true;
    (async () => {
      try {
        const { requiereBoton, clave: k } = await api.get<{ requiereBoton: boolean; clave?: string }>(`/carta/seguimiento/${encodeURIComponent(codigo)}/whatsapp?t=${encodeURIComponent(token)}`);
        if (!requiereBoton) return;
        const local = await api.get<DatosLocalCarta>('/carta/local');
        const d = String(local?.whatsapp ?? '').replace(/\D/g, '');
        if (activo && d) setClave(k ?? '');
        if (activo && d) setNumero(d.length === 9 ? `51${d}` : d);
      } catch {
        /* sin botón: el pedido igual avanza */
      }
    })();
    return () => { activo = false; };
  }, [codigo, token]);

  if (!numero) return null;
  return (
    <a
      data-testid="recibir-por-whatsapp"
      href={`https://wa.me/${numero}?text=${encodeURIComponent(`Hola, mi pedido ${codigo}${clave ? ` (clave ${clave})` : ''}`)}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Activar avisos de mi pedido por WhatsApp"
      style={{ display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '14px', border: '1.5px solid #1F8F4E', background: '#EAF7EF', color: 'var(--cp-navy, #0B2C3E)', textDecoration: 'none', padding: '10px 12px', textAlign: 'left' }}
    >
      <span aria-hidden="true" style={{ flex: 'none', width: '36px', height: '36px', borderRadius: '50%', background: '#1F8F4E', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '18px' }}>🔔</span>
      <span style={{ display: 'grid', gap: '2px', flex: 1 }}>
        <strong style={{ fontSize: '15px' }}>Activa los avisos de tu pedido por WhatsApp</strong>
        <small style={{ fontSize: '13px', color: 'var(--cp-soft, #4A5A66)' }}>Envía el mensaje que se abre y te avisamos cuando esté listo.</small>
      </span>
      <span aria-hidden="true" style={{ flex: 'none', fontWeight: 800, color: '#1F8F4E' }}>›</span>
    </a>
  );
}

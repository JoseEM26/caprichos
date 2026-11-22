import { useEffect, useState } from 'react';
import { api } from '../comun/api';
import type { DatosLocalCarta } from './tipos';

/**
 * «Recibir mi pedido por WhatsApp»: solo si el bot no puede escribirle primero (su celular nunca escribió; regla anti-baneo).
 * Abre el chat del local con «Hola, mi pedido CP-XXXX»: al llegar ese mensaje el bot vincula el chat y manda el resumen al instante.
 */
export function BotonRecibirPorWhatsapp({ codigo, token }: { codigo: string; token?: string | null }) {
  const [numero, setNumero] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    let activo = true;
    (async () => {
      try {
        const { requiereBoton } = await api.get<{ requiereBoton: boolean }>(`/carta/seguimiento/${encodeURIComponent(codigo)}/whatsapp?t=${encodeURIComponent(token)}`);
        if (!requiereBoton) return;
        const local = await api.get<DatosLocalCarta>('/carta/local');
        const d = String(local?.whatsapp ?? '').replace(/\D/g, '');
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
      href={`https://wa.me/${numero}?text=${encodeURIComponent(`Hola, mi pedido ${codigo}`)}`}
      target="_blank"
      rel="noreferrer"
      style={{ minHeight: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '14px', fontWeight: 800, fontSize: '16px', color: '#fff', background: '#1F8F4E', textDecoration: 'none', padding: '0 16px', textAlign: 'center' }}
    >
      Recibir mi pedido por WhatsApp
    </a>
  );
}

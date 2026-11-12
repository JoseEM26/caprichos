import { useEffect, useRef, useState } from 'react';
import { useSesion } from '../comun/sesion';
import { useDialogoAccesible } from '../comun/useDialogoAccesible';

/** Día de Lima (AAAA-MM-DD). */
export const hoyLima = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());

const clave = (partyId: string) => `caprichos_saludo_cumple_${partyId}`;
const yaSaludado = (partyId: string, hoy: string): boolean => {
  try {
    return window.localStorage.getItem(clave(partyId)) === hoy;
  } catch {
    return false;
  }
};
const marcarSaludado = (partyId: string, hoy: string) => {
  try {
    window.localStorage.setItem(clave(partyId), hoy);
  } catch {
    // sin almacenamiento: puede repetirse al recargar
  }
};

const COLORES = ['#D99E39', '#E0457B', '#2F7A45', '#3B82C4', '#F2C94C'];
// Confeti ligero: 14 trozos con CSS; sin movimiento si la persona pidió menos animación.
const CSS = `
.cumple-confeti{position:absolute;top:-12px;width:9px;height:14px;border-radius:2px;opacity:.9;animation:cumple-cae 3.2s linear infinite}
@keyframes cumple-cae{to{transform:translateY(110vh) rotate(540deg)}}
@media (prefers-reduced-motion: reduce){.cumple-confeti{animation:none;top:8px}}
`;

/**
 * Saludo grande «¡Feliz cumpleaños!» la primera vez que la persona entra al panel el día de su cumpleaños.
 * El servidor solo dice «cumpleHoy» (sin fecha). Un solo modal: espera a que termine el cambio de clave obligatorio.
 * Se recuerda por navegador (localStorage); en otro dispositivo puede mostrarse una vez más.
 */
export function SaludoCumpleanos() {
  const { usuario, cumpleHoy, debeCambiar } = useSesion();
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const partyId = usuario?.partyId;

  useEffect(() => {
    if (!cumpleHoy || debeCambiar || !partyId) return;
    const hoy = hoyLima();
    if (yaSaludado(partyId, hoy)) return;
    marcarSaludado(partyId, hoy);
    setVisible(true);
  }, [cumpleHoy, debeCambiar, partyId]);

  if (!visible || !usuario) return null;
  const nombre = (usuario.nombres || '').trim().split(/\s+/)[0];
  return <Cuerpo nombre={nombre} cerrar={() => setVisible(false)} refDialogo={ref} />;
}

function Cuerpo({ nombre, cerrar, refDialogo }: { nombre: string; cerrar: () => void; refDialogo: React.RefObject<HTMLDivElement> }) {
  const onKeyDown = useDialogoAccesible(refDialogo, cerrar);
  return (
    <div
      ref={refDialogo}
      role="dialog"
      aria-modal="true"
      aria-labelledby="saludo-cumple-titulo"
      onKeyDown={onKeyDown}
      onClick={(e) => e.target === e.currentTarget && cerrar()}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(11,44,62,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' }}
    >
      <style>{CSS}</style>
      <div aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className="cumple-confeti" style={{ left: `${(i * 7 + 3) % 100}%`, background: COLORES[i % COLORES.length], animationDelay: `${(i % 7) * 0.4}s` }} />
        ))}
      </div>
      <div style={{ position: 'relative', background: '#FFFFFF', borderRadius: 24, padding: '32px 24px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <div style={{ fontSize: 64, lineHeight: 1 }} aria-hidden="true">🎂</div>
        <h2 id="saludo-cumple-titulo" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 32, lineHeight: '38px', color: '#0B2C3E', margin: '12px 0 8px' }}>
          ¡Feliz cumpleaños{nombre ? `, ${nombre}` : ''}!
        </h2>
        <p style={{ fontSize: 16, color: '#2C4C5D', margin: '0 0 20px' }}>Todo el equipo de Caprichos te desea un día muy especial. 🎉</p>
        <button
          type="button"
          data-foco-inicial
          onClick={cerrar}
          style={{ minHeight: 48, padding: '0 28px', border: 0, borderRadius: 12, background: '#D99E39', color: '#0B2C3E', fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Gracias
        </button>
      </div>
    </div>
  );
}

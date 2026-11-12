import { useEffect, useState } from 'react';
import { api } from '../comun/api';
import { useSesion } from '../comun/sesion';
import { hoyLima } from './SaludoCumpleanos';

const clave = (partyId: string) => `caprichos_banner_cumple_${partyId}`;
const cerradoHoy = (partyId: string, hoy: string): boolean => {
  try {
    return window.localStorage.getItem(clave(partyId)) === hoy;
  } catch {
    return false;
  }
};
const marcarCerrado = (partyId: string, hoy: string) => {
  try {
    window.localStorage.setItem(clave(partyId), hoy);
  } catch {
    // sin almacenamiento: reaparece al recargar
  }
};

const CSS = `
.banner-cumple-pastel{display:inline-block;animation:banner-cumple-salto 1.6s ease-in-out 3}
@keyframes banner-cumple-salto{50%{transform:translateY(-4px)}}
@media (prefers-reduced-motion: reduce){.banner-cumple-pastel{animation:none}}
`;

/** «Maria S.», «Maria S. y Luis P.», «Maria S., Luis P. y Ana G.». */
const unir = (n: string[]) => (n.length <= 1 ? n[0] : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`);

/**
 * Aviso discreto para todo el equipo: «Hoy cumple años María S.». El servidor solo manda nombres abreviados de HOY
 * (sin fecha, edad ni celular, y sin la propia persona: a ella le sale el saludo grande). No bloquea y se cierra por día.
 */
export function BannerCumpleanosEquipo() {
  const { usuario } = useSesion();
  const partyId = usuario?.partyId;
  const [nombres, setNombres] = useState<string[]>([]);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    if (!partyId) return;
    if (cerradoHoy(partyId, hoyLima())) {
      setCerrado(true);
      return;
    }
    let vigente = true;
    Promise.resolve(api.get<{ nombres?: string[] }>('/admin/escritorio/cumpleanos-hoy'))
      .then((r) => {
        if (vigente && r && Array.isArray(r.nombres)) setNombres(r.nombres.filter((x) => typeof x === 'string' && x.trim()));
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [partyId]);

  if (!partyId || cerrado || nombres.length === 0) return null;
  const varios = nombres.length > 1;
  return (
    <div
      role="status"
      data-testid="banner-cumpleanos-equipo"
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: '#FFF6DD', border: '1px solid #E8C877', color: '#0B2C3E', fontSize: 14 }}
    >
      <style>{CSS}</style>
      <span className="banner-cumple-pastel" aria-hidden="true" style={{ fontSize: 20 }}>🎂</span>
      <span style={{ flex: 1 }}>
        <strong>Hoy {varios ? 'cumplen años' : 'cumple años'} {unir(nombres)}</strong> — ¡no olvides saludar!
      </span>
      <button
        type="button"
        aria-label="Cerrar aviso de cumpleaños"
        onClick={() => {
          marcarCerrado(partyId, hoyLima());
          setCerrado(true);
        }}
        style={{ minWidth: 44, minHeight: 44, border: 0, background: 'transparent', color: '#0B2C3E', fontSize: 20, cursor: 'pointer' }}
      >
        ×
      </button>
    </div>
  );
}

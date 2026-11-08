import { useState } from 'react';
import type { CSSProperties } from 'react';
import { plusCodeParaMostrar } from '@caprichos/compartido';

/** Plus Code (Open Location Code) de un punto, listo para mostrar («7P7J+2X Lima»). null si las coordenadas no sirven. */
export function plusCodeDe(lat: unknown, lng: unknown): string | null {
  if (lat == null || lng == null || lat === '' || lng === '') return null;
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  try {
    return plusCodeParaMostrar(la, lo);
  } catch {
    return null;
  }
}

const BOTON: CSSProperties = {
  minHeight: '32px',
  padding: '0 10px',
  borderRadius: '8px',
  border: '1.5px solid var(--cp-navy)',
  background: 'var(--cp-white)',
  color: 'var(--cp-navy)',
  fontWeight: 700,
  fontSize: '12px',
  cursor: 'pointer',
};

/** «Código Plus: XXXX+XX» con botón para copiarlo. No pinta nada si el punto no tiene coordenadas. */
export function CodigoPlus({ lat, lng, estiloBoton }: { lat: unknown; lng: unknown; estiloBoton?: CSSProperties }) {
  const [copiado, setCopiado] = useState<'si' | 'no' | null>(null);
  const codigo = plusCodeDe(lat, lng);
  if (!codigo) return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado('si');
    } catch {
      setCopiado('no');
    }
  };

  return (
    <div data-testid="codigo-plus" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
      <span>
        <strong>Código Plus:</strong> {codigo}
      </span>
      <button type="button" onClick={copiar} style={{ ...BOTON, ...estiloBoton }}>
        Copiar código
      </button>
      <span role="status" aria-live="polite" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-ok)' }}>
        {copiado === 'si' ? 'Copiado' : copiado === 'no' ? 'No se pudo copiar' : ''}
      </span>
    </div>
  );
}

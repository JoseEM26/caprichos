import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Punto } from './MapaUbicacion';

interface Resultado {
  texto: string;
  lat: number;
  lng: number;
}

export interface BuscadorDireccionProps {
  onElegir: (punto: Punto, texto: string) => void;
}

/** Busca la dirección por la API (Nominatim detrás). Si la búsqueda se apaga, se marca en el mapa. */
export function BuscadorDireccion({ onElegir }: BuscadorDireccionProps) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 3) {
      setResultados([]);
      setAviso(null);
      return;
    }
    let vigente = true;
    const espera = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await api.get<{ resultados: Resultado[]; apagado: boolean }>(
          `/carta/direcciones?q=${encodeURIComponent(q)}`,
        );
        if (!vigente) return;
        setResultados(r.resultados);
        setAviso(
          r.apagado
            ? 'La búsqueda no está disponible ahora: toca el mapa para marcar el punto.'
            : r.resultados.length === 0
              ? 'No encontramos esa dirección: toca el mapa para marcar el punto.'
              : null,
        );
      } catch {
        if (vigente) setAviso('No se pudo buscar: toca el mapa para marcar el punto.');
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 600);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [texto]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        type="search"
        aria-label="Buscar dirección"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar dirección (calle y número)"
        style={{
          width: '100%',
          minHeight: 44,
          borderRadius: 10,
          border: '1.5px solid var(--cp-line)',
          backgroundColor: 'var(--cp-cream)',
          color: 'var(--cp-navy)',
          padding: '0 12px',
          fontSize: 14,
          boxSizing: 'border-box',
        }}
      />
      {buscando && <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Buscando...</div>}
      {resultados.length > 0 && (
        <ul role="listbox" aria-label="Direcciones encontradas" style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--cp-line)', borderRadius: 10, overflow: 'hidden' }}>
          {resultados.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => {
                  onElegir({ lat: r.lat, lng: r.lng }, r.texto);
                  setResultados([]);
                  setTexto('');
                }}
                style={{ width: '100%', minHeight: 44, textAlign: 'left', padding: '8px 12px', background: 'var(--cp-white)', border: 'none', borderBottom: '1px solid var(--cp-line)', fontSize: 13, color: 'var(--cp-navy)' }}
              >
                {r.texto}
              </button>
            </li>
          ))}
        </ul>
      )}
      {aviso && (
        <div role="status" style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
          {aviso}
        </div>
      )}
    </div>
  );
}

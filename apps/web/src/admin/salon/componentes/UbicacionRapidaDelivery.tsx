import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../../../comun/api';
import { parsearUbicacion } from '../../../comun/mapa/parsearUbicacion';
import type { Punto } from '../../../comun/mapa/MapaUbicacion';

interface RespuestaUbicacionWa {
  encontrada: boolean;
  lat: number | null;
  lng: number | null;
  direccionAprox?: string | null;
}

export interface UbicacionRapidaDeliveryProps {
  /** Celular de 9 dígitos que empieza con 9; null si todavía no hay uno válido */
  telefono: string | null;
  /** Mismo mecanismo que tocar el mapa: el punto se fija y la zona y el envío se recalculan */
  onElegir: (punto: Punto, direccionAprox?: string) => void;
}

const CAMPO: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '44px',
  borderRadius: '10px',
  border: '1.5px solid var(--cp-line)',
  background: 'var(--cp-white)',
  padding: '0 12px',
  fontSize: '14px',
};

const BOTON: CSSProperties = {
  minHeight: '44px',
  padding: '0 14px',
  borderRadius: '10px',
  border: '1.5px solid var(--cp-navy)',
  background: 'var(--cp-white)',
  color: 'var(--cp-navy)',
  fontWeight: 700,
  fontSize: '13px',
  cursor: 'pointer',
};

/**
 * Dos atajos para fijar el punto de entrega: la ubicación que el cliente de ese celular mandó por WhatsApp
 * (últimas 24 h, solo si existe) y pegar coordenadas o un enlace de Google Maps.
 */
export function UbicacionRapidaDelivery({ telefono, onElegir }: UbicacionRapidaDeliveryProps) {
  const [waUbicacion, setWaUbicacion] = useState<RespuestaUbicacionWa | null>(null);
  const [pegado, setPegado] = useState('');
  const [errorPegado, setErrorPegado] = useState(false);

  useEffect(() => {
    setWaUbicacion(null);
    if (!telefono) return;
    let vigente = true;
    api
      .get<RespuestaUbicacionWa>(`/admin/clientes/ubicacion-whatsapp/${telefono}`)
      .then((r) => {
        if (vigente && r?.encontrada && r.lat != null && r.lng != null) setWaUbicacion(r);
      })
      .catch(() => {
        // Sin dato o sin consulta: el atajo simplemente no aparece
      });
    return () => {
      vigente = false;
    };
  }, [telefono]);

  const usarWa = () => {
    if (!waUbicacion || waUbicacion.lat == null || waUbicacion.lng == null) return;
    onElegir({ lat: waUbicacion.lat, lng: waUbicacion.lng }, waUbicacion.direccionAprox || undefined);
  };

  const ponerPegado = () => {
    const punto = parsearUbicacion(pegado);
    if (!punto) {
      setErrorPegado(true);
      return;
    }
    setErrorPegado(false);
    setPegado('');
    onElegir(punto);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {waUbicacion && (
        <button type="button" onClick={usarWa} style={{ ...BOTON, alignSelf: 'flex-start' }}>
          Usar ubicacion de WhatsApp
        </button>
      )}
      <label htmlFor="ubicacion-pegar" style={{ fontWeight: 700, fontSize: '12px', color: 'var(--cp-navy)' }}>
        Pegar coordenadas o enlace de Google Maps
      </label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          id="ubicacion-pegar"
          type="text"
          value={pegado}
          onChange={(e) => {
            setPegado(e.target.value);
            setErrorPegado(false);
          }}
          placeholder="-12.0123, -76.9456"
          aria-invalid={errorPegado}
          style={{ ...CAMPO, flex: '1 1 220px', maxWidth: '420px' }}
        />
        <button type="button" onClick={ponerPegado} disabled={!pegado.trim()} style={BOTON}>
          Poner en el mapa
        </button>
      </div>
      {errorPegado && (
        <span role="alert" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-rust)' }}>
          Pega las coordenadas o un enlace largo de Google Maps
        </span>
      )}
    </div>
  );
}

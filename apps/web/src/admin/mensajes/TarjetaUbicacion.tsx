import { useState } from 'react';
import type { CSSProperties } from 'react';
import { MapaUbicacion } from '../../comun/mapa/MapaUbicacion';
import { CodigoPlus } from '../../comun/mapa/CodigoPlus';

/** Ubicación que el cliente mandó por WhatsApp (mensaje_chat.contenido.ubicacion). */
export interface UbicacionChat {
  lat: number;
  lng: number;
  nombre?: string | null;
  direccion?: string | null;
  direccionAprox?: string | null;
}

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
  display: 'inline-flex',
  alignItems: 'center',
  textDecoration: 'none',
};

/** Tarjeta de la ubicación del cliente: mapa de solo lectura, dirección, coordenadas y dos acciones. */
export function TarjetaUbicacion({ ubicacion }: { ubicacion: UbicacionChat }) {
  const [copiado, setCopiado] = useState<'si' | 'no' | null>(null);
  const coordenadas = `${ubicacion.lat.toFixed(6)}, ${ubicacion.lng.toFixed(6)}`;
  const direccion = ubicacion.direccion || ubicacion.direccionAprox || ubicacion.nombre || 'Ubicación sin dirección';

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(coordenadas);
      setCopiado('si');
    } catch {
      setCopiado('no');
    }
  };

  return (
    <div
      data-testid="tarjeta-ubicacion"
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '240px' }}
    >
      <MapaUbicacion
        punto={{ lat: ubicacion.lat, lng: ubicacion.lng }}
        altura={150}
        soloLectura
        ajustarA="punto"
        etiqueta="Mapa de la ubicación del cliente"
      />
      <div style={{ fontWeight: 700, fontSize: '13px' }}>Ubicación del cliente</div>
      <div style={{ fontSize: '13px' }}>{direccion}</div>
      {ubicacion.direccionAprox && ubicacion.direccion && ubicacion.direccionAprox !== ubicacion.direccion && (
        <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>Aprox.: {ubicacion.direccionAprox}</div>
      )}
      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{coordenadas}</div>
      <CodigoPlus lat={ubicacion.lat} lng={ubicacion.lng} estiloBoton={BOTON} />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <a
          href={`https://www.google.com/maps?q=${ubicacion.lat},${ubicacion.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          style={BOTON}
        >
          Abrir en Google Maps
        </a>
        <button type="button" onClick={copiar} style={BOTON}>
          Copiar coordenadas
        </button>
        <span role="status" aria-live="polite" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-ok)' }}>
          {copiado === 'si' ? 'Copiado' : copiado === 'no' ? 'No se pudo copiar' : ''}
        </span>
      </div>
    </div>
  );
}

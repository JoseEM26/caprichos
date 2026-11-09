import { useCompartirUbicacion } from './useCompartirUbicacion';

/**
 * Botón «Compartir mi ubicación con el local»: solo visible con pedidos en camino.
 * Activo por defecto; si se deniega el permiso la app sigue funcionando.
 */
export function CompartirUbicacion({ hayEnCamino }: { hayEnCamino: boolean }) {
  const { estado, alternar } = useCompartirUbicacion(hayEnCamino);
  if (estado === 'inactiva') return null;

  const compartiendo = estado === 'compartiendo';
  const texto =
    estado === 'denegada'
      ? 'Ubicación apagada: el navegador no dio permiso'
      : estado === 'sin_gps'
        ? 'Ubicación apagada: este equipo no tiene GPS'
        : compartiendo
          ? 'Compartiendo tu ubicación con el local'
          : 'Ubicación apagada';

  return (
    <div
      data-testid="compartir-ubicacion"
      style={{ background: 'var(--cp-cream, #FBF4EC)', border: '1.5px solid var(--cp-line, #E3D6C6)', borderRadius: 12, padding: '8px 10px', color: 'var(--cp-navy, #0B2C3E)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span role="status" style={{ flex: 1, fontSize: 13, fontWeight: 800, color: compartiendo ? 'var(--cp-green, #2F7A45)' : 'var(--cp-rust, #B2500F)' }}>
          {texto}
        </span>
        {estado !== 'sin_gps' && (
          <button
            type="button"
            onClick={alternar}
            aria-pressed={compartiendo}
            style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1.5px solid var(--cp-navy, #0B2C3E)', background: compartiendo ? 'transparent' : 'var(--cp-navy, #0B2C3E)', color: compartiendo ? 'var(--cp-navy, #0B2C3E)' : 'var(--cp-cream, #FBF4EC)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            {compartiendo ? 'Dejar de compartir' : '📍 Compartir mi ubicación con el local'}
          </button>
        )}
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--cp-soft, #2C4C5D)' }}>
        Solo el local la ve, solo mientras tienes pedidos en camino.
      </p>
    </div>
  );
}

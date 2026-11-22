import { useState } from 'react';
import './retrato.css';

/** Retrato PNG del avatar del cliente (solo la imagen: no baja three ni el editor). `celebra` = animación de pedido listo. */
export function RetratoAvatar({ url, tamano, celebra = false, animacion, alt = '' }: { url: string; tamano: number; celebra?: boolean; animacion?: 'saluda' | 'espera'; alt?: string }) {
  const [falla, setFalla] = useState(false);
  const clase = `av-retrato${celebra ? ' av-celebra' : animacion ? ` av-${animacion}` : ''}`;
  // Sin la imagen (red o archivo borrado) nunca un ícono roto: un círculo con un postre en su lugar
  if (falla || !url) {
    return (
      <span className={`${clase} av-retrato-vacio`} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}
        style={{ width: tamano, height: tamano, flex: 'none', fontSize: Math.round(tamano * 0.45) }} data-testid="retrato-avatar-vacio">🧁</span>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      width={tamano}
      height={tamano}
      className={clase}
      onError={() => setFalla(true)}
      style={{ width: tamano, height: tamano, flex: 'none' }}
      data-testid="retrato-avatar"
    />
  );
}

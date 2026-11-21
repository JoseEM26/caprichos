import './retrato.css';

/** Retrato PNG del avatar del cliente (solo la imagen: no baja three ni el editor). `celebra` = animación de pedido listo. */
export function RetratoAvatar({ url, tamano, celebra = false, animacion, alt = '' }: { url: string; tamano: number; celebra?: boolean; animacion?: 'saluda' | 'espera'; alt?: string }) {
  return (
    <img
      src={url}
      alt={alt}
      width={tamano}
      height={tamano}
      className={`av-retrato${celebra ? ' av-celebra' : animacion ? ` av-${animacion}` : ''}`}
      style={{ width: tamano, height: tamano, flex: 'none' }}
      data-testid="retrato-avatar"
    />
  );
}

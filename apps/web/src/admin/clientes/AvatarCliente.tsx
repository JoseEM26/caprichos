import { RetratoAvatar } from '../../avatar/RetratoAvatar';
import type { ClienteItem } from './tipos';

/** Retrato circular del avatar del cliente (solo la imagen, sin three); sin avatar, sus iniciales. */
export function AvatarCliente({ cliente, tamano = 36 }: { cliente: Pick<ClienteItem, 'nombre' | 'avatar'>; tamano?: number }) {
  const url = cliente.avatar?.url;
  const base = { width: tamano, height: tamano, borderRadius: '50%', flex: 'none', overflow: 'hidden' } as const;
  if (url) {
    return (
      <span style={{ ...base, display: 'inline-block', background: 'var(--cp-sand)' }} data-testid="avatar-cliente">
        <RetratoAvatar url={url} tamano={tamano} alt={`Avatar de ${cliente.nombre}`} />
      </span>
    );
  }
  const iniciales = cliente.nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
  return (
    <span
      aria-hidden="true"
      data-testid="avatar-cliente-iniciales"
      style={{ ...base, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cp-line)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: Math.round(tamano * 0.4) }}
    >
      {iniciales}
    </span>
  );
}

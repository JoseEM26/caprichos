import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RetratoAvatar } from '../../avatar/RetratoAvatar';
import { AvatarVivoPerezoso } from '../../avatar/AvatarVivoPerezoso';
import { useDialogoAccesible } from '../../comun/useDialogoAccesible';
import { obtenerAvatarCliente } from './clientesApi';
import type { ClienteItem } from './tipos';

/** Ventana con el avatar completo del cliente en 3D (o su retrato grande si no hay 3D). */
function VerAvatar({ id, nombre, url, alCerrar }: { id: string; nombre: string; url: string; alCerrar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const alTeclear = useDialogoAccesible(ref, alCerrar);
  const [config, setConfig] = useState<unknown | null>(null);
  useEffect(() => {
    let vigente = true;
    obtenerAvatarCliente(id).then((r) => vigente && setConfig(r?.config ?? null)).catch(() => undefined);
    return () => { vigente = false; };
  }, [id]);
  const ancho = Math.min(360, window.innerWidth - 64);
  return createPortal(
    <div onClick={(e) => { e.stopPropagation(); alCerrar(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(11,44,62,0.6)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={`Avatar de ${nombre}`} onKeyDown={alTeclear} onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--cp-cream)', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxShadow: '0 20px 50px rgba(11,44,62,0.4)' }}>
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <b style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 18 }}>{nombre}</b>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" style={{ width: 44, height: 44, border: 0, borderRadius: 22, background: 'var(--cp-line)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <AvatarVivoPerezoso config={config} retratoUrl={url} accion="saludando" ancho={ancho} alto={Math.round(ancho * 1.3)} tamanoRetrato={Math.round(ancho * 0.8)} />
      </div>
    </div>,
    document.body,
  );
}

/** Retrato circular del avatar del cliente (solo la imagen, sin three); sin avatar, sus iniciales. Con avatar, un clic lo abre completo. */
export function AvatarCliente({ cliente, tamano = 36 }: { cliente: Pick<ClienteItem, 'nombre' | 'avatar'> & { id?: string }; tamano?: number }) {
  const [ver, setVer] = useState(false);
  const url = cliente.avatar?.url;
  const base = { width: tamano, height: tamano, borderRadius: '50%', flex: 'none', overflow: 'hidden' } as const;
  if (url) {
    const retrato = (
      <span style={{ ...base, display: 'inline-block', background: 'var(--cp-sand)' }} data-testid="avatar-cliente">
        <RetratoAvatar url={url} tamano={tamano} alt={`Avatar de ${cliente.nombre}`} />
      </span>
    );
    if (!cliente.id) return retrato;
    return (
      <>
        <button type="button" title="Ver avatar completo" aria-label={`Ver avatar completo de ${cliente.nombre}`}
          onClick={(e) => { e.stopPropagation(); setVer(true); }} onKeyDown={(e) => e.stopPropagation()}
          style={{ ...base, padding: 0, border: 0, background: 'none', cursor: 'zoom-in', display: 'inline-flex' }}>
          {retrato}
        </button>
        {ver && <VerAvatar id={cliente.id} nombre={cliente.nombre} url={url} alCerrar={() => setVer(false)} />}
      </>
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

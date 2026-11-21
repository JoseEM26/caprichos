import { lazy, Suspense, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { EditorAvatarProps } from './EditorAvatar';

// three y todas las piezas viven en este chunk: la carta solo lo baja al abrir «Mi avatar»
const EditorAvatar = lazy(() => import('./EditorAvatar'));

/**
 * El editor va en un portal a <body>: si se pinta dentro del panel de la cuenta (angosto y con transform),
 * position: fixed queda encerrado en ese panel en vez de ocupar toda la pantalla.
 */
export function AvatarEditorPerezoso(props: EditorAvatarProps) {
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, []);
  return createPortal(
    <Suspense
      fallback={
        <div role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'grid', placeItems: 'center', background: '#FBF4EC', color: '#0B2C3E', fontWeight: 800 }}>
          Preparando tu vestidor…
        </div>
      }
    >
      <EditorAvatar {...props} />
    </Suspense>,
    document.body,
  );
}

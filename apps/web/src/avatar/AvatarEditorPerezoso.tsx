import { lazy, Suspense } from 'react';
import type { EditorAvatarProps } from './EditorAvatar';

// three y todas las piezas viven en este chunk: la carta solo lo baja al abrir «Mi avatar»
const EditorAvatar = lazy(() => import('./EditorAvatar'));

export function AvatarEditorPerezoso(props: EditorAvatarProps) {
  return (
    <Suspense
      fallback={
        <div role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'grid', placeItems: 'center', background: '#FBF4EC', color: '#0B2C3E', fontWeight: 800 }}>
          Preparando tu vestidor…
        </div>
      }
    >
      <EditorAvatar {...props} />
    </Suspense>
  );
}

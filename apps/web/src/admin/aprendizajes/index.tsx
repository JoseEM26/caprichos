import { lazy, Suspense } from 'react';
import { Cargando } from '../../comun/Cargando';

const Vista = lazy(() => import('./AprendizajesView'));

/** Carga la vista bajo demanda para no engordar el bundle principal. */
export function AprendizajesView() {
  return (
    <Suspense fallback={<Cargando mensaje="Cargando aprendizajes" />}>
      <Vista />
    </Suspense>
  );
}

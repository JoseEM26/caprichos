import { createElement, lazy, Suspense } from 'react';

const SalonVivoView = lazy(() => import('./SalonVivoView').then((m) => ({ default: m.SalonVivoView })));

/** Módulo del menú: el 3D y todo three se descargan solo al abrir «Salón en vivo». */
export function SalonVivoLazy() {
  return createElement(Suspense, { fallback: createElement('div', { className: 'sv-estado', role: 'status' }, 'Cargando el salón…') }, createElement(SalonVivoView));
}

import { useEffect, useState } from 'react';

const CONSULTA = '(max-width: 699px)';

/** El mockup decide tamaños distintos en celular (menos de 700 px de ancho). */
export function useEsMovil(): boolean {
  const [movil, setMovil] = useState<boolean>(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(CONSULTA);
    const alCambiar = () => setMovil(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return movil;
}

import { createContext, createElement, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const CONSULTA = '(max-width: 699px)';

// La vista previa del diseñador fuerza PC o celular sin depender del ancho de la ventana del admin.
const ContextoDispositivo = createContext<boolean | null>(null);

export function DispositivoForzado({ movil, children }: { movil: boolean; children: ReactNode }) {
  return createElement(ContextoDispositivo.Provider, { value: movil }, children);
}

/** El mockup decide tamaños distintos en celular (menos de 700 px de ancho). */
export function useEsMovil(): boolean {
  const forzado = useContext(ContextoDispositivo);
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
  return forzado ?? movil;
}

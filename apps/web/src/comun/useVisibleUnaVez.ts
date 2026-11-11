import { useEffect, useRef, useState } from 'react';

/**
 * true cuando el elemento entra en pantalla por primera vez (y se queda en true). Sirve para no descargar fotos y
 * notas de voz de un chat largo hasta que se ven. Sin IntersectionObserver (navegador viejo, pruebas) arranca en true.
 */
export function useVisibleUnaVez<T extends Element>(margenPx = 200) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: `${margenPx}px` },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, margenPx]);
  return { ref, visible };
}

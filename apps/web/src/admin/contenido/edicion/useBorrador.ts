import { useCallback, useEffect, useRef, useState } from 'react';

export type EstadoGuardado = 'guardado' | 'pendiente' | 'guardando' | 'error';

/**
 * Estado editable con autoguardado como borrador, deshacer y contador de cambios.
 * `guardar` recibe el valor completo; se llama poco después del último cambio.
 */
export function useBorrador<T>(guardar: (valor: T) => Promise<unknown>, retrasoMs = 400) {
  const [valor, setValor] = useState<T | null>(null);
  const actual = useRef<T | null>(null);
  const historial = useRef<T[]>([]);
  const sucio = useRef(false);
  const [cambios, setCambios] = useState(0);
  const [estado, setEstado] = useState<EstadoGuardado>('guardado');
  const guardarRef = useRef(guardar);
  guardarRef.current = guardar;

  const cargar = useCallback((v: T, cambiosIniciales = 0) => {
    actual.current = v;
    historial.current = [];
    sucio.current = false;
    setValor(v);
    setCambios(cambiosIniciales);
    setEstado('guardado');
  }, []);

  const cambiar = useCallback((f: (v: T) => T) => {
    const previo = actual.current;
    if (previo === null) return;
    const nuevo = f(previo);
    if (Object.is(nuevo, previo)) return;
    historial.current.push(previo);
    actual.current = nuevo;
    sucio.current = true;
    setValor(nuevo);
    setCambios((c) => c + 1);
    setEstado('pendiente');
  }, []);

  const deshacer = useCallback(() => {
    const previo = historial.current.pop();
    if (previo === undefined) return;
    actual.current = previo;
    sucio.current = true;
    setValor(previo);
    setCambios((c) => Math.max(0, c - 1));
    setEstado('pendiente');
  }, []);

  const guardarYa = useCallback(async () => {
    if (!sucio.current || actual.current === null) return;
    setEstado('guardando');
    const enviado = actual.current;
    try {
      await guardarRef.current(enviado);
      // si mientras guardaba hubo otro cambio, sigue pendiente
      if (actual.current === enviado) {
        sucio.current = false;
        setEstado('guardado');
      }
    } catch (e) {
      setEstado('error');
      throw e;
    }
  }, []);

  useEffect(() => {
    if (!sucio.current) return;
    const t = setTimeout(() => {
      guardarYa().catch(() => {});
    }, retrasoMs);
    return () => clearTimeout(t);
  }, [valor, retrasoMs, guardarYa]);

  return { valor, cargar, cambiar, deshacer, puedeDeshacer: cambios > 0 && historial.current.length > 0, cambios, estado, guardarYa };
}

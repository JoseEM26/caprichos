import { useEffect, useMemo, useRef } from 'react';
import { cargarAvatar } from './piezas';
import { EscenaAvatar } from './escena';
import type { AccionAvatar } from './escena';
import { normalizar } from './config';

export interface AvatarVivoProps {
  /** Config guardada de la cuenta (cruda: aquí se normaliza contra el catálogo) */
  config: unknown;
  accion: AccionAvatar;
  ancho: number;
  alto: number;
  /** Si WebGL falla al crear la escena, el contenedor vuelve al retrato */
  alFallar: () => void;
}

/** Avatar 3D suelto, sin editor: chunk aparte (three entra solo al montarlo). Repite la acción mientras esté en pantalla. */
export default function AvatarVivo({ config, accion, ancho, alto, alFallar }: AvatarVivoProps) {
  const A = useMemo(() => cargarAvatar(), []);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const escena = useRef<EscenaAvatar | null>(null);
  const falla = useRef(alFallar);
  falla.current = alFallar;

  useEffect(() => {
    if (!lienzo.current) return;
    try {
      escena.current = new EscenaAvatar(lienzo.current, A, false, true);
    } catch {
      falla.current();
      return;
    }
    escena.current.reconstruir(normalizar(A, config), false);
    return () => { escena.current?.dispose(); escena.current = null; };
  }, [A, config]);

  useEffect(() => {
    const dur = accion === 'saludando' ? 2.4 : 2.6;
    escena.current?.accion(accion, dur);
    const t = setInterval(() => escena.current?.accion(accion, dur), dur * 1000);
    return () => clearInterval(t);
  }, [accion, config]);

  return <canvas ref={lienzo} style={{ width: ancho, height: alto, display: 'block' }} aria-hidden="true" data-testid="avatar-3d" />;
}

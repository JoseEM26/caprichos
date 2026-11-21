import { lazy, Suspense, useMemo, useState } from 'react';
import { prefiereMovimientoReducido, tieneSoporteWebGL } from '../mascota/soporteWebGL';
import { RetratoAvatar } from './RetratoAvatar';
import type { AccionAvatar } from './escena';

// three vive en este chunk: solo se baja si de verdad se va a dibujar el avatar en 3D
const AvatarVivo = lazy(() => import('./AvatarVivo'));

const ANIM: Partial<Record<AccionAvatar, 'saluda' | 'espera'>> = { saludando: 'saluda', esperando: 'espera' };
const CELEBRA: AccionAvatar[] = ['celebrar', 'baile'];

/**
 * El avatar del cliente: 3D con la acción pedida, o el retrato PNG con animación CSS si no hay WebGL,
 * el cliente prefiere menos movimiento, la escena falla o aún no llegó su configuración.
 */
export function AvatarVivoPerezoso({ config, retratoUrl, accion, ancho, alto = ancho, tamanoRetrato = Math.min(ancho, alto) }: {
  config: unknown | null;
  retratoUrl: string;
  accion: AccionAvatar;
  ancho: number;
  alto?: number;
  tamanoRetrato?: number;
}) {
  const hay3d = useMemo(() => tieneSoporteWebGL() && !prefiereMovimientoReducido(), []);
  const [fallo, setFallo] = useState(false);
  const retrato = (
    <div style={{ width: ancho, height: alto, display: 'grid', placeItems: 'center' }}>
      <RetratoAvatar url={retratoUrl} tamano={tamanoRetrato} celebra={CELEBRA.includes(accion)} animacion={ANIM[accion]} />
    </div>
  );
  if (!hay3d || fallo || !config) return retrato;
  return (
    <Suspense fallback={retrato}>
      <AvatarVivo config={config} accion={accion} ancho={ancho} alto={alto} alFallar={() => setFallo(true)} />
    </Suspense>
  );
}

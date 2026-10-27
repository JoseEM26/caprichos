import { Suspense, useState, useEffect, lazy } from 'react';
import { CapriFallback } from './CapriFallback';
import { tieneSoporteWebGL, prefiereMovimientoReducido } from './soporteWebGL';
import type { EstadoCapri } from './animaciones';
import type { AspectoCapri } from './tiposAspecto';
import { useAspectoCapri } from './useAspectoCapri';

// Carga diferida obligatoria para que Three.js NO entre al bundle principal de la aplicación
const MascotaCapri3D = lazy(() => import('./MascotaCapri3D'));

export interface MascotaCapriProps {
  estado?: EstadoCapri;
  tamano?: number;
  className?: string;
  forzarFallback2D?: boolean;
  alHacerClic?: () => void;
  aspecto?: AspectoCapri;
}

/**
 * Componente público de Capri, mascota oficial de Caprichos.
 * Conmuta automáticamente entre el modelo 3D con Three.js y el fallback accesible 2D
 * según la compatibilidad de WebGL, preferencias de accesibilidad y modo forzado.
 * Si no se proporciona la prop 'aspecto', hereda automáticamente el aspecto público
 * configurado para el día mediante useAspectoCapri().
 */
export function MascotaCapri({
  estado = 'reposo',
  tamano = 160,
  className = '',
  forzarFallback2D = false,
  alHacerClic,
  aspecto: aspectoProp,
}: MascotaCapriProps) {
  const [soportaWebGL, setSoportaWebGL] = useState<boolean>(() => tieneSoporteWebGL());
  const [movimientoReducido, setMovimientoReducido] = useState<boolean>(() =>
    prefiereMovimientoReducido()
  );
  const [huboFallo3D, setHuboFallo3D] = useState<boolean>(false);

  // Hereda el aspecto público si no se pasa explícito
  const { aspecto: aspectoHeredado } = useAspectoCapri();
  const aspectoFinal = aspectoProp ?? aspectoHeredado;

  useEffect(() => {
    // Re-evaluar en el cliente
    setSoportaWebGL(tieneSoporteWebGL());
    setMovimientoReducido(prefiereMovimientoReducido());
  }, []);

  // Si no hay WebGL, prefiere movimiento reducido, hubo error o se solicitó 2D, usar CapriFallback
  const usarFallback =
    forzarFallback2D || !soportaWebGL || movimientoReducido || huboFallo3D;

  if (usarFallback) {
    return (
      <CapriFallback
        estado={estado}
        tamano={tamano}
        className={className}
        alHacerClic={alHacerClic}
        aspecto={aspectoFinal}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <CapriFallback
          estado={estado}
          tamano={tamano}
          className={className}
          alHacerClic={alHacerClic}
          aspecto={aspectoFinal}
        />
      }
    >
      <MascotaCapri3D
        estado={estado}
        tamano={tamano}
        className={className}
        alHacerClic={alHacerClic}
        onError={() => setHuboFallo3D(true)}
        aspecto={aspectoFinal}
      />
    </Suspense>
  );
}

export default MascotaCapri;

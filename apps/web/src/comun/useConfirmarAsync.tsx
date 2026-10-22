import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Confirmar } from './Confirmar';

interface Pregunta {
  titulo: string;
  mensaje?: string;
  textoSi?: string;
}

/**
 * Reemplazo de window.confirm con el Sí/No del sistema:
 *   const { confirmar, dialogo } = useConfirmarAsync();
 *   if (!(await confirmar({ titulo: '¿Abrir la caja?', mensaje: '…' }))) return;
 *   … y poner {dialogo} en el JSX.
 */
export function useConfirmarAsync(): {
  confirmar: (p: Pregunta) => Promise<boolean>;
  dialogo: ReactNode;
} {
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirmar = useCallback(
    (p: Pregunta) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setPregunta(p);
      }),
    [],
  );

  const responder = (v: boolean) => {
    setPregunta(null);
    resolver.current?.(v);
    resolver.current = null;
  };

  const dialogo = (
    <Confirmar
      abierto={pregunta !== null}
      titulo={pregunta?.titulo}
      mensaje={pregunta?.mensaje}
      textoSi={pregunta?.textoSi ?? 'Sí, continuar'}
      alConfirmar={() => responder(true)}
      alCancelar={() => responder(false)}
    />
  );

  return { confirmar, dialogo };
}

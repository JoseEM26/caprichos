import type { ReactNode } from 'react';
import { BloqueEditable, BotonBarra } from './BloqueEditable';

interface BloqueFotoProps {
  /** `galeria:<id>` o `momento:<id>`: el prefijo decide qué fotos se aceptan al arrastrar. */
  clave: string;
  etiqueta: string;
  activa: boolean;
  puedeSubir: boolean;
  puedeBajar: boolean;
  onSubir: () => void;
  onBajar: () => void;
  onSoltar: (desde: string) => void;
  onFoto: (archivo: File) => void | Promise<void>;
  /** Pide confirmación en la vista (Sí/No); aquí solo se avisa. */
  onQuitar: () => void;
  onMostrar: () => void;
  children: ReactNode;
}

/** Una foto de una galería editable en sitio: subir, bajar, arrastrar, cambiar foto, quitar o mostrar. */
export function BloqueFoto(p: BloqueFotoProps) {
  const prefijo = `${p.clave.split(':')[0]}:`;
  return (
    <BloqueEditable
      clave={p.clave}
      etiqueta={p.etiqueta}
      oculto={!p.activa}
      puedeSubir={p.puedeSubir}
      puedeBajar={p.puedeBajar}
      onSubir={p.onSubir}
      onBajar={p.onBajar}
      puedeSoltar={(desde) => desde.startsWith(prefijo)}
      onSoltar={p.onSoltar}
      onFoto={p.onFoto}
      acciones={
        p.activa ? (
          <BotonBarra peligro onClick={p.onQuitar}>
            Quitar
          </BotonBarra>
        ) : (
          <BotonBarra onClick={p.onMostrar}>Mostrar</BotonBarra>
        )
      }
    >
      {p.children}
    </BloqueEditable>
  );
}

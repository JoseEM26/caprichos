import { useMemo, useState } from 'react';
import { CarritoProvider } from '../../carta/CarritoContext';
import { VentanaProductoCarta } from '../../carta/VentanaProductoCarta';
import { ConmutadorDispositivo, MarcoDispositivo } from '../../comun/MarcoDispositivo';
import { aProductoCarta } from './aProductoCarta';
import type { BorradorProducto } from './aProductoCarta';
import type { GrupoOpcionItem } from './catalogoApi';

/**
 * Panel «Cómo lo ve el cliente»: la misma ventana de la carta en solo lectura, con el borrador del editor.
 * Todo sale del estado local (sin llamadas a la API) y se vuelve a pintar al instante.
 */
export function VistaPreviaEnVivo({ borrador, gruposGenerales, destacarGrupoId }: {
  borrador: BorradorProducto;
  gruposGenerales: GrupoOpcionItem[];
  destacarGrupoId?: string | null;
}) {
  const [celular, setCelular] = useState(true);
  const producto = useMemo(() => aProductoCarta(borrador, gruposGenerales), [borrador, gruposGenerales]);
  return (
    <div className="eo-vivo-cuerpo" data-testid="vista-en-vivo">
      <ConmutadorDispositivo celular={celular} onCambiar={setCelular} />
      <MarcoDispositivo celular={celular} etiqueta="Cómo lo ve el cliente" fiel>
        <CarritoProvider>
          <VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => undefined} soloLectura esMovilPreview={celular}
            numerarPreguntas destacarGrupoId={destacarGrupoId} />
        </CarritoProvider>
      </MarcoDispositivo>
    </div>
  );
}

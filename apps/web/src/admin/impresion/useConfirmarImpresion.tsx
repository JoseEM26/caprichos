import { ReactNode, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { impresionApi } from './impresionApi';
import { PanelInstalarPrograma } from './PanelInstalarPrograma';
import { MaquinasImpresion, maquinasConProblema, programaApagado } from './useEstadoMaquinas';

const FRASE = {
  ETIQUETERA: 'La etiquetera no está conectada. Si continúas, las etiquetas quedarán en cola y se imprimirán cuando se conecte.',
  TICKETERA: 'La ticketera no está conectada. Si continúas, el ticket de pago quedará en cola y se imprimirá cuando se conecte.',
};

/**
 * Antes de aprobar un pedido (confirmar pago, cobrar, aceptar): revisa las dos máquinas al momento.
 * Todo bien (o no se pudo consultar) → sigue sin preguntar. Si falta alguna → Sí/No; con «Sí» el
 * trabajo queda en la cola y sale cuando la máquina se conecte.
 * Uso: const { pedir, dialogo } = useConfirmarImpresion(); … pedir(() => ejecutar()); … {dialogo}
 */
export function useConfirmarImpresion(): { pedir: (continuar: () => void | Promise<void>) => Promise<void>; dialogo: ReactNode } {
  const [pendiente, setPendiente] = useState<{ continuar: () => void | Promise<void>; maquinas: MaquinasImpresion } | null>(null);
  const [instalar, setInstalar] = useState(false);

  const pedir = async (continuar: () => void | Promise<void>) => {
    let maquinas: MaquinasImpresion | null = null;
    try {
      maquinas = ((await impresionApi.obtenerEstado()).impresoras as MaquinasImpresion) ?? null;
    } catch {
      maquinas = null;
    }
    if (maquinasConProblema(maquinas).length === 0) {
      await continuar();
      return;
    }
    setPendiente({ continuar, maquinas: maquinas! });
  };

  const faltan = pendiente ? maquinasConProblema(pendiente.maquinas) : [];
  const dialogo = (
    <>
      <Confirmar
        abierto={Boolean(pendiente)}
        titulo="Impresora no conectada"
        mensaje={`${faltan.map((r) => FRASE[r]).join(' ')} ¿Continuar?`}
        textoConfirmar="Sí, continuar"
        textoNo="No"
        alConfirmar={async () => {
          const p = pendiente;
          setPendiente(null);
          await p?.continuar();
        }}
        alCancelar={() => setPendiente(null)}
      >
        {pendiente && programaApagado(pendiente.maquinas) && (
          <button type="button" className="cola-btn" onClick={() => setInstalar(true)}>
            Instalar programa de impresión
          </button>
        )}
      </Confirmar>
      {instalar && <PanelInstalarPrograma alCerrar={() => setInstalar(false)} />}
    </>
  );
  return { pedir, dialogo };
}

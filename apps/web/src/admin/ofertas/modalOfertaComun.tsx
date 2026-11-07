import { ReactNode, useEffect, useRef, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import './modal-oferta.css';

/**
 * Piezas comunes de los modales de Ofertas (Combo, Descuento, Lleva y paga, Cupón, Envío gratis):
 * detección de cambios sin guardar, aviso de error bajo las pestañas, pie fijo y confirmación al salir.
 */

export interface PestanaError { id: string; error: string | null }

/** Primera pestaña (en orden) con un error pendiente. */
export function primeraConError(lista: PestanaError[]): PestanaError | null {
  return lista.find((p) => p.error) ?? null;
}

/**
 * ¿Hay cambios sin guardar? Compara `firma` (JSON del estado del formulario) con la que había justo
 * después de cargar el formulario al abrir. Hasta que se asienta (80 ms) no se considera sucio.
 */
export function useCambiosSinGuardar(abierto: boolean, firma: string): boolean {
  const [base, setBase] = useState<string | null>(null);
  const ultima = useRef(firma);
  ultima.current = firma;
  useEffect(() => {
    setBase(null);
    if (!abierto) return;
    const t = setTimeout(() => setBase(ultima.current), 80);
    return () => clearTimeout(t);
  }, [abierto]);
  return base !== null && base !== firma;
}

/** Cierre con confirmación Sí/No si hay cambios sin guardar. */
export function useCierreConConfirmacion(sucio: boolean, onCerrar: () => void) {
  const [confirmando, setConfirmando] = useState(false);
  const cerrar = () => (sucio ? setConfirmando(true) : onCerrar());
  return { cerrar, confirmando, setConfirmando };
}

export function ConfirmarSalir({ abierto, alSalir, alQuedarse }: { abierto: boolean; alSalir: () => void; alQuedarse: () => void }) {
  return (
    <Confirmar abierto={abierto} titulo="¿Salir sin guardar?" mensaje="Hiciste cambios que aún no se guardaron."
      textoSi="Sí, salir" textoNo="No" peligro alConfirmar={alSalir} alCancelar={alQuedarse} />
  );
}

/** Aviso de error bajo las pestañas (se ve en cualquier pestaña). */
export function AvisoErrorOferta({ mensaje }: { mensaje: string }) {
  if (!mensaje) return null;
  return <div role="alert" className="mo-error">{mensaje}</div>;
}

export function PieOferta({ sucio, alCancelar, alGuardar, guardando, textoGuardar, testidGuardar }: {
  sucio: boolean; alCancelar: () => void; alGuardar: () => void; guardando: boolean; textoGuardar: string; testidGuardar?: string;
}): ReactNode {
  return (
    <>
      {sucio && <span role="status" className="mo-pendiente">● Hay cambios sin guardar</span>}
      <button type="button" className="mo-btn" onClick={alCancelar}>Cancelar</button>
      <button type="button" className="mo-btn principal" disabled={guardando} data-testid={testidGuardar} onClick={alGuardar}>
        {guardando ? 'Guardando...' : textoGuardar}
      </button>
    </>
  );
}

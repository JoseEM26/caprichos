import { useEffect, useState } from 'react';
import { api } from '../../comun/api';
import { Boton } from '../../comun/Boton';

export type PreviaCelular =
  | { estado: 'LIBRE'; yaVinculada?: boolean }
  | { estado: 'VINCULARA_CUENTA'; cuenta: { nombre: string; celularEnmascarado: string }; mismoNombre: boolean }
  | { estado: 'CREARA_CUENTA'; cuenta: { nombre: string; celularEnmascarado: string } }
  | { estado: 'OTRA_PERSONA'; motivo: string; mensaje: string };

/**
 * Antes de guardar: consulta (solo lectura, con espera de 400 ms al escribir) qué pasará con el celular de un usuario.
 * `celular9` solo se consulta cuando ya son 9 dígitos válidos. `confirmado` se reinicia al cambiar el celular.
 */
export function usePreviaCelular(url: string, celular9: string | null, persona?: { nombres?: string; apellidos?: string }) {
  const [previa, setPrevia] = useState<PreviaCelular | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const nombres = persona?.nombres;
  const apellidos = persona?.apellidos;

  useEffect(() => {
    setPrevia(null);
    setConfirmado(false);
    if (!celular9) return;
    let vivo = true;
    const t = setTimeout(() => {
      Promise.resolve(api.post<PreviaCelular>(url, { celular: celular9, ...(nombres ? { nombres } : {}), ...(apellidos ? { apellidos } : {}) }))
        .then((r) => vivo && setPrevia(r ?? null))
        .catch(() => vivo && setPrevia(null)); // sin vista previa el servidor igual valida al guardar
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [url, celular9, nombres, apellidos]);

  /** Hay que confirmar «es la misma persona» y aún no se hizo (el servidor también lo exige). */
  const falta = ((previa?.estado === 'VINCULARA_CUENTA' && !previa.mismoNombre) || previa?.estado === 'CREARA_CUENTA') && !confirmado;
  return { previa, confirmado, confirmar: () => setConfirmado(true), falta };
}

export interface AvisoVinculoCelularProps {
  previa: PreviaCelular | null;
  confirmado: boolean;
  alConfirmar: () => void;
  /** «No»: el ADMIN dice que no es la misma persona; el padre vacía el celular. */
  alRechazar: () => void;
}

/** Aviso bajo el campo celular (sin modal): vínculo con la cuenta de cliente, confirmación o error claro. */
export function AvisoVinculoCelular({ previa, confirmado, alConfirmar, alRechazar }: AvisoVinculoCelularProps) {
  return (
    <div aria-live="polite" data-testid="aviso-vinculo-celular" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {previa?.estado === 'VINCULARA_CUENTA' && (
        <>
          <div role="status" style={{ fontSize: 13, color: 'var(--cp-navy)', lineHeight: '18px' }}>
            Este celular es de la cuenta de cliente de <strong>{previa.cuenta.nombre}</strong> ({previa.cuenta.celularEnmascarado}). Al guardar, se vinculará a
            este usuario y recibirá su descuento de personal en la carta.
          </div>
          {!previa.mismoNombre && !confirmado && (
            <div role="group" aria-label="Confirmar que es la misma persona" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
                El nombre de la cuenta no coincide con el de este usuario. ¿Confirmas que es la misma persona?
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Boton type="button" onClick={alConfirmar}>
                  Sí, es la misma persona
                </Boton>
                <Boton type="button" variante="secundario" onClick={alRechazar}>
                  No
                </Boton>
              </div>
            </div>
          )}
          {!previa.mismoNombre && confirmado && (
            <span role="status" style={{ fontSize: 13, color: 'var(--cp-green)', fontWeight: 700 }}>
              Confirmado: es la misma persona.
            </span>
          )}
        </>
      )}
      {previa?.estado === 'CREARA_CUENTA' && (
        <div role="group" aria-label="Confirmar crear su cuenta de cliente" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--cp-navy)', lineHeight: '18px' }}>
            Ese celular ya está en el sistema (de pedidos anteriores). Se creará su cuenta de cliente y quedará vinculada a este trabajador para su descuento.
            ¿Continuar?
          </span>
          {!confirmado ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Boton type="button" onClick={alConfirmar}>
                Sí
              </Boton>
              <Boton type="button" variante="secundario" onClick={alRechazar}>
                No
              </Boton>
            </div>
          ) : (
            <span role="status" style={{ fontSize: 13, color: 'var(--cp-green)', fontWeight: 700 }}>
              Confirmado: se creará su cuenta al guardar.
            </span>
          )}
        </div>
      )}
      {previa?.estado === 'OTRA_PERSONA' && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--cp-rust)', fontWeight: 600 }}>
          {previa.mensaje}
        </div>
      )}
    </div>
  );
}

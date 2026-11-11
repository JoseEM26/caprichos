import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { useSesion } from '../../comun/sesion';
import { tieneRolUsuario } from '../../comun/rolesUsuario';
import { pedidosApi } from './pedidosApi';

export const MOTIVO_SIN_COBRO_MIN = 10;
export const MOTIVO_SIN_COBRO_MAX = 300;

interface Aviso {
  pedidoId: string | number;
  estado: string;
  mensaje: string;
  cobrar?: () => void;
}

/**
 * El pedido aún no está cobrado (409 COBRO_PENDIENTE al entregar o despachar). Aviso con «Entendido» y,
 * si quien llama puede abrir el cobro, «Cobrar». Si quien mira es administrador, «Entregar sin cobrar» pasa
 * a una confirmación Sí/No con motivo obligatorio (el servidor vuelve a validar el rol). El pedido sigue «Falta cobrar».
 * `manejar(err, pedidoId, estado, cobrar?)` devuelve true si el error era ese y ya se mostró el aviso.
 * `forzarFn` cambia cómo se reintenta (por defecto, cambiar el estado del pedido con forzarSinCobro).
 */
export function useAvisoCobroPendiente(
  alForzado: () => void,
  forzarFn?: (pedidoId: string | number, estado: string, motivo: string) => Promise<unknown>,
): {
  manejar: (err: unknown, pedidoId: string | number, estado: string, cobrar?: () => void) => boolean;
  dialogo: ReactNode;
} {
  const { usuario } = useSesion();
  const esAdmin = tieneRolUsuario(usuario, 'ADMIN');
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [forzando, setForzando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => {
    setAviso(null);
    setForzando(false);
    setMotivo('');
    setError(null);
  };

  const manejar = (err: any, pedidoId: string | number, estado: string, cobrar?: () => void): boolean => {
    if (err?.codigo !== 'COBRO_PENDIENTE') return false;
    setAviso({ pedidoId, estado, mensaje: err.message, cobrar });
    return true;
  };

  const forzar = async () => {
    if (!aviso) return;
    setEnviando(true);
    setError(null);
    try {
      if (forzarFn) await forzarFn(aviso.pedidoId, aviso.estado, motivo.trim());
      else await pedidosApi.cambiarEstado(aviso.pedidoId, aviso.estado, motivo.trim(), false, undefined, true);
      cerrar();
      alForzado();
    } catch (e: any) {
      setError(e?.message || 'No se pudo entregar sin cobrar');
    } finally {
      setEnviando(false);
    }
  };

  const motivoValido = motivo.trim().length >= MOTIVO_SIN_COBRO_MIN;

  const dialogo = !aviso ? null : forzando ? (
    <Confirmar
      abierto
      titulo="Entregar sin cobrar"
      mensaje="Vas a pasar el pedido sin que esté cobrado. Seguirá marcado «Falta cobrar» y quedará registrado con tu nombre y el motivo."
      textoConfirmar="Sí, entregar sin cobrar"
      textoNo="No"
      cargando={enviando}
      deshabilitarConfirmar={!motivoValido}
      error={error}
      alConfirmar={forzar}
      alCancelar={cerrar}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700 }}>
        Motivo (obligatorio)
        <textarea
          value={motivo}
          maxLength={MOTIVO_SIN_COBRO_MAX}
          rows={3}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Cuéntanos por qué se entrega sin cobrar"
          style={{ font: 'inherit', padding: 8, borderRadius: 8, border: '1px solid var(--cp-line)' }}
        />
        <span style={{ fontWeight: 400, color: 'var(--cp-soft)' }}>
          Mínimo {MOTIVO_SIN_COBRO_MIN} letras ({motivo.trim().length}/{MOTIVO_SIN_COBRO_MAX}).
        </span>
      </label>
    </Confirmar>
  ) : (
    createPortal(
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(11, 44, 62, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}
        onClick={cerrar}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="cobro-pendiente-titulo"
          aria-describedby="cobro-pendiente-mensaje"
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 420, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', boxSizing: 'border-box', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <h2 id="cobro-pendiente-titulo" style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18, color: 'var(--cp-navy)' }}>
            Falta cobrar este pedido
          </h2>
          <p id="cobro-pendiente-mensaje" style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: 'var(--cp-soft)' }}>
            {aviso.mensaje}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
            {esAdmin && (
              <Boton type="button" variante="secundario" onClick={() => setForzando(true)}>
                Entregar sin cobrar
              </Boton>
            )}
            {aviso.cobrar && (
              <Boton
                type="button"
                onClick={() => {
                  const abrir = aviso.cobrar;
                  cerrar();
                  abrir?.();
                }}
              >
                Cobrar
              </Boton>
            )}
            <Boton type="button" variante={aviso.cobrar ? 'secundario' : undefined} autoFocus={!aviso.cobrar} onClick={cerrar}>
              Entendido
            </Boton>
          </div>
        </div>
      </div>,
      document.body,
    )
  );

  return { manejar, dialogo };
}

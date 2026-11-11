import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { useSesion } from '../../comun/sesion';
import { tieneRolUsuario } from '../../comun/rolesUsuario';
import { pedidosApi } from './pedidosApi';

export const MOTIVO_FORZAR_MIN = 10;
export const MOTIVO_FORZAR_MAX = 300;

interface Aviso {
  pedidoId: string | number;
  estado: string;
  mensaje: string;
  areas: string[];
}

/**
 * Cocina aún no despejó el pedido (409 COCINA_PENDIENTE): aviso amable con «Entendido». Si quien mira es
 * administrador, ofrece «Forzar como administrador» con motivo obligatorio y confirmación Sí/No (el servidor
 * vuelve a validar el rol). Una sola pieza para Caja (Tarjetas, Tabla, Lista) y el detalle del pedido.
 * `manejar(err, pedidoId, estado)` devuelve true si el error era ese y ya se mostró el aviso.
 */
export function useAvisoCocinaPendiente(alForzado: () => void): {
  manejar: (err: unknown, pedidoId: string | number, estado: string) => boolean;
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

  const manejar = (err: any, pedidoId: string | number, estado: string): boolean => {
    if (err?.codigo !== 'COCINA_PENDIENTE') return false;
    const areas = Array.isArray(err?.detalles?.areasPendientes) ? (err.detalles.areasPendientes as string[]) : [];
    setAviso({ pedidoId, estado, mensaje: err.message, areas });
    return true;
  };

  const forzar = async () => {
    if (!aviso) return;
    setEnviando(true);
    setError(null);
    try {
      await pedidosApi.cambiarEstado(aviso.pedidoId, aviso.estado, motivo.trim(), true);
      cerrar();
      alForzado();
    } catch (e: any) {
      setError(e?.message || 'No se pudo forzar el cambio');
    } finally {
      setEnviando(false);
    }
  };

  const motivoValido = motivo.trim().length >= MOTIVO_FORZAR_MIN;

  const dialogo = !aviso ? null : forzando ? (
    <Confirmar
      abierto
      titulo="Forzar como administrador"
      mensaje="Vas a pasar el pedido sin esperar a Cocina. Las comandas pendientes se darán por despejadas y quedará registrado con tu nombre y el motivo."
      textoConfirmar="Sí, forzar"
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
          maxLength={MOTIVO_FORZAR_MAX}
          rows={3}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Cuéntanos por qué se entrega sin que Cocina lo marque"
          style={{ font: 'inherit', padding: 8, borderRadius: 8, border: '1px solid var(--cp-line)' }}
        />
        <span style={{ fontWeight: 400, color: 'var(--cp-soft)' }}>
          Mínimo {MOTIVO_FORZAR_MIN} letras ({motivo.trim().length}/{MOTIVO_FORZAR_MAX}).
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
          aria-labelledby="cocina-pendiente-titulo"
          aria-describedby="cocina-pendiente-mensaje"
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 420, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', boxSizing: 'border-box', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <h2 id="cocina-pendiente-titulo" style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18, color: 'var(--cp-navy)' }}>
            Cocina aún no termina este pedido
          </h2>
          <p id="cocina-pendiente-mensaje" style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: 'var(--cp-soft)' }}>
            {aviso.mensaje}
          </p>
          {aviso.areas.length > 0 && (
            <ul aria-label="Áreas pendientes" style={{ margin: 0, paddingLeft: 20, fontSize: 14, fontWeight: 700 }}>
              {aviso.areas.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
            {esAdmin && (
              <Boton type="button" variante="secundario" onClick={() => setForzando(true)}>
                Forzar como administrador
              </Boton>
            )}
            <Boton type="button" autoFocus onClick={cerrar}>
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

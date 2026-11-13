import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';

interface Cuenta {
  nombre: string;
  celular: string;
}

export interface SeccionCuentaClienteProps {
  usuarioId: string;
  /** Solo el ADMIN la ve. */
  puedeEditar: boolean;
}

const mensajeDe = (e: unknown, defecto: string) => (e instanceof ErrorApi || (e as any)?.message ? ((e as any).message as string) : defecto);

/**
 * Estado de solo lectura de la cuenta de cliente (la de la carta) del trabajador. NO tiene campo de celular: el único celular es el
 * del usuario; al guardarlo se vincula sola (o se crea) la cuenta y la carta lo reconoce como del equipo (descuento de personal).
 * Aquí solo se puede desvincular, con Sí/No. La cuenta de cliente nunca gana permisos del panel.
 */
export function SeccionCuentaCliente({ usuarioId, puedeEditar }: SeccionCuentaClienteProps) {
  const [vinculada, setVinculada] = useState<Cuenta | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const base = `/admin/usuarios/${usuarioId}/cuenta-cliente`;

  useEffect(() => {
    if (!puedeEditar) return;
    let vivo = true;
    setVinculada(undefined);
    Promise.resolve(api.get<{ vinculada: Cuenta | null }>(base))
      .then((r) => vivo && setVinculada(r?.vinculada ?? null))
      .catch(() => vivo && (setVinculada(null), setError('No se pudo leer la cuenta de cliente vinculada.')));
    return () => {
      vivo = false;
    };
  }, [base, puedeEditar]);

  if (!puedeEditar) return null;

  const quitar = async () => {
    setOcupado(true);
    setError('');
    try {
      await api.delete(base);
      setVinculada(null);
      setMensaje('Cuenta desvinculada. Sus datos de cliente no se tocaron.');
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo desvincular la cuenta.'));
    } finally {
      setConfirmarQuitar(false);
      setOcupado(false);
    }
  };

  const fila = { display: 'flex', gap: '8px', flexWrap: 'wrap' as const };
  return (
    <section
      aria-label="Cuenta de cliente"
      data-testid="seccion-cuenta-cliente"
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1.5px solid var(--cp-line)', borderRadius: 12, padding: 12 }}
    >
      <strong style={{ fontSize: 14, color: 'var(--cp-navy)' }}>Cuenta de cliente (carta)</strong>
      {vinculada === undefined && <span style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Cargando…</span>}
      {vinculada && !confirmarQuitar && (
        <>
          <div data-testid="cuenta-vinculada" style={{ fontSize: 14, color: 'var(--cp-navy)' }}>
            Vinculada a <strong>{vinculada.nombre}</strong> ({vinculada.celular}) — recibe el descuento de personal
          </div>
          <div>
            <Boton type="button" variante="secundario" onClick={() => setConfirmarQuitar(true)} deshabilitado={ocupado}>
              Desvincular
            </Boton>
          </div>
        </>
      )}
      {vinculada && confirmarQuitar && (
        <div role="group" aria-label="Confirmar desvincular" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, color: 'var(--cp-navy)' }}>¿Desvincular a {vinculada.nombre}? Dejará de recibir el descuento de personal desde la carta.</span>
          <div style={fila}>
            <Boton type="button" variante="peligro" onClick={quitar} cargando={ocupado}>
              Sí, desvincular
            </Boton>
            <Boton type="button" variante="secundario" onClick={() => setConfirmarQuitar(false)} deshabilitado={ocupado}>
              No
            </Boton>
          </div>
        </div>
      )}
      {vinculada === null && (
        <span data-testid="cuenta-sin-vincular" style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
          Se vincula sola al guardar el celular si esa persona ya tiene cuenta en la carta; si no la tiene, se crea.
        </span>
      )}
      {error && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--cp-rust)', fontWeight: 600 }}>
          {error}
        </div>
      )}
      {mensaje && (
        <div role="status" style={{ fontSize: 13, color: 'var(--cp-navy)' }}>
          {mensaje}
        </div>
      )}
    </section>
  );
}

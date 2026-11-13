import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';

interface Cuenta {
  nombre: string;
  celular: string;
  /** El celular es de un invitado (pedidos o WhatsApp): al confirmar se le crea la cuenta. */
  creara?: boolean;
}

export interface SeccionCuentaClienteProps {
  usuarioId: string;
  /** Solo el ADMIN vincula; el usuario debe estar activo para vincular. */
  puedeEditar: boolean;
  usuarioActivo: boolean;
}

const mensajeDe = (e: unknown, defecto: string) => (e instanceof ErrorApi || (e as any)?.message ? ((e as any).message as string) : defecto);

/**
 * Vincula la cuenta de cliente (la de la carta) de un trabajador con su usuario: la carta lo reconoce como del equipo
 * y le da el descuento de personal. No junta ni mueve datos (puntos, pedidos, direcciones siguen en la cuenta) y la cuenta
 * de cliente nunca gana permisos del panel. La confirmación Sí/No reemplaza el contenido de la sección (sin otro modal).
 */
export function SeccionCuentaCliente({ usuarioId, puedeEditar, usuarioActivo }: SeccionCuentaClienteProps) {
  const [vinculada, setVinculada] = useState<Cuenta | null | undefined>(undefined);
  const [celular, setCelular] = useState('');
  const [encontrada, setEncontrada] = useState<Cuenta | null>(null);
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

  const buscar = async () => {
    setError('');
    setMensaje('');
    if (!/^9\d{8}$/.test(celular)) {
      setError('El celular debe tener 9 dígitos y empezar en 9');
      return;
    }
    setOcupado(true);
    try {
      setEncontrada(await api.post<Cuenta>(`${base}/buscar`, { celular }));
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo buscar la cuenta de cliente.'));
    } finally {
      setOcupado(false);
    }
  };

  const vincular = async () => {
    setOcupado(true);
    setError('');
    try {
      const r = await api.post<{ vinculada: Cuenta; creada?: boolean }>(base, { celular });
      setVinculada(r.vinculada);
      setEncontrada(null);
      setCelular('');
      setMensaje(
        r.creada
          ? 'Listo: se creó su cuenta de cliente. Para entrar a la carta debe tocar «Crear cuenta» (o «¿Olvidaste tu contraseña?») con ese celular y verificarlo por WhatsApp para poner su contraseña.'
          : 'Listo: esa persona ya recibe el descuento de personal en la carta.',
      );
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo vincular la cuenta.'));
      setEncontrada(null);
    } finally {
      setOcupado(false);
    }
  };

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
            Cuenta de cliente vinculada: <strong>{vinculada.nombre}</strong> · {vinculada.celular}
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
      {vinculada === null && !encontrada && (
        <>
          <span style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
            Si esta persona también se registró como cliente en la carta, escribe el celular de esa cuenta para que reciba su descuento de personal. No se junta
            ni se borra nada.
          </span>
          <Campo
            id="vincular-celular"
            etiqueta="Celular de su cuenta de cliente (9 dígitos)"
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            value={celular}
            onChange={(e) => setCelular(e.target.value.replace(/\D/g, '').slice(0, 9))}
            disabled={ocupado || !usuarioActivo}
            ayuda={usuarioActivo ? undefined : 'Reactiva al usuario para vincular su cuenta'}
          />
          <div>
            <Boton type="button" variante="secundario" onClick={buscar} cargando={ocupado} deshabilitado={!usuarioActivo || celular.length === 0}>
              Vincular su cuenta de cliente
            </Boton>
          </div>
        </>
      )}
      {vinculada === null && encontrada && (
        <div role="group" aria-label="Confirmar vínculo" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span data-testid="cuenta-encontrada" style={{ fontSize: 14, color: 'var(--cp-navy)' }}>
            {encontrada.creara ? (
              <>
                Ese celular ya está en el sistema (de pedidos anteriores, a nombre de <strong>{encontrada.nombre}</strong>). Se creará su cuenta de cliente y
                quedará vinculada a este trabajador para su descuento. ¿Continuar?
              </>
            ) : (
              <>
                Encontramos la cuenta de <strong>{encontrada.nombre}</strong> ({encontrada.celular}). ¿Es la cuenta de cliente de esta persona?
              </>
            )}
          </span>
          <div style={fila}>
            <Boton type="button" onClick={vincular} cargando={ocupado}>
              {encontrada.creara ? 'Sí' : 'Sí, vincular'}
            </Boton>
            <Boton type="button" variante="secundario" onClick={() => setEncontrada(null)} deshabilitado={ocupado}>
              No
            </Boton>
          </div>
        </div>
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

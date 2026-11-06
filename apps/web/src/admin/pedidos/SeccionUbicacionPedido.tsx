import { useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { MapaUbicacion } from '../../comun/mapa/MapaUbicacion';
import { ModalCambiarUbicacion } from './ModalCambiarUbicacion';
import { InsigniaDireccionEditada } from './InsigniaDireccionEditada';
import { CambioUbicacion, HistorialUbicacion, ORIGEN_CAMBIO, cambioUbicacionApi, textoAjuste, textoDifEnvio, textoDistancia } from './cambioUbicacionApi';

export interface SeccionUbicacionPedidoProps {
  pedidoId: string;
  codigo: string;
  estado: string;
  lat?: number | null;
  lng?: number | null;
  direccion?: string | null;
  alActualizar: () => void;
}

const ESTADOS_CERRADOS = ['ENTREGADO', 'ANULADO'];

const MEDIOS = [
  { valor: 'EFECTIVO', nombre: 'Efectivo' },
  { valor: 'YAPE', nombre: 'Yape' },
  { valor: 'PLIN', nombre: 'Plin' },
  { valor: 'TRANSFERENCIA', nombre: 'Transferencia' },
  { valor: 'TARJETA', nombre: 'Tarjeta' },
];

/**
 * Detalle de la ubicación del pedido: insignia, cambiar el punto (Caja), propuesta pendiente del repartidor con
 * aprobar o rechazar, saldo o devolución por resolver, y el historial de cambios.
 */
export function SeccionUbicacionPedido({ pedidoId, codigo, estado, lat, lng, direccion, alActualizar }: SeccionUbicacionPedidoProps) {
  const { tiene } = useSesion();
  const puedeCambiar = tiene('pedidos/cambiar_ubicacion');
  const [historial, setHistorial] = useState<HistorialUbicacion | null>(null);
  const [abrirCambio, setAbrirCambio] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [rechazando, setRechazando] = useState<CambioUbicacion | null>(null);
  const [motivo, setMotivo] = useState('');
  const [liquidando, setLiquidando] = useState<{ cambio: CambioUbicacion; medio: string; codigo: string } | null>(null);

  const cargar = () =>
    cambioUbicacionApi
      .historial(pedidoId)
      .then(setHistorial)
      .catch(() => setHistorial(null));

  useEffect(() => {
    let vigente = true;
    cambioUbicacionApi
      .historial(pedidoId)
      .then((h) => vigente && setHistorial(h))
      .catch(() => vigente && setHistorial(null));
    return () => {
      vigente = false;
    };
  }, [pedidoId]);

  const propuesta = historial?.cambios.find((c) => c.estado === 'PROPUESTA') ?? null;
  const ajustePendiente = historial?.cambios.find((c) => c.ajuste?.estado === 'PENDIENTE') ?? null;
  const editable = !ESTADOS_CERRADOS.includes(estado);
  const mensajeError = (err: unknown) => (err instanceof ErrorApi || err instanceof Error ? err.message : 'No se pudo completar la acción.');

  const decidir = async (accion: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      await accion();
      setAviso(ok);
      await cargar();
      alActualizar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setOcupado(false);
    }
  };

  const liquidar = async () => {
    if (!liquidando) return;
    const { cambio, medio, codigo: cod } = liquidando;
    await decidir(
      () => cambioUbicacionApi.liquidarAjuste(pedidoId, cambio.id, { medio, codigoOperacion: medio === 'EFECTIVO' ? undefined : cod }),
      cambio.ajuste?.tipo === 'SALDO' ? 'Saldo cobrado.' : 'Devolución registrada.',
    );
    setLiquidando(null);
  };

  return (
    <section aria-label="Ubicación del pedido" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13, color: 'var(--cp-navy, #0B2C3E)' }}>Ubicación</strong>
        {historial?.editada && <InsigniaDireccionEditada />}
        {puedeCambiar && editable && (
          <Boton variante="secundario" tamano="pequeno" onClick={() => setAbrirCambio(true)}>
            Cambiar ubicación
          </Boton>
        )}
      </div>

      {propuesta && (
        <div role="region" aria-label="Cambio propuesto" style={{ background: '#fff', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>
            {propuesta.origen === 'WHATSAPP_CLIENTE'
              ? propuesta.fueraDeZona
                ? 'Fuera de zona: la ubicación que envió el cliente está fuera de la zona de reparto'
                : lat != null
                  ? 'El cliente envió otra ubicación: ¿usarla?'
                  : 'El cliente envió su ubicación: ¿usarla?'
              : `Cambio de ubicación propuesto por ${propuesta.propuestoPorNombre ?? 'el repartidor'}`}
          </div>
          {propuesta.nota && <div style={{ fontSize: 12 }}>Nota: {propuesta.nota}</div>}
          {textoDistancia(propuesta) && <div style={{ fontSize: 12, fontWeight: 700 }}>{textoDistancia(propuesta)}</div>}
          {!propuesta.fueraDeZona && (
            <div style={{ fontSize: 12 }}>
              Envío S/ {(propuesta.envioAnterior ?? 0).toFixed(2)} → S/ {(propuesta.envioNuevo ?? 0).toFixed(2)} · {textoDifEnvio(propuesta.diferencia)} · nuevo total S/{' '}
              {(propuesta.totalNuevo ?? 0).toFixed(2)}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <MapaUbicacion punto={propuesta.anterior.lat != null ? { lat: propuesta.anterior.lat, lng: propuesta.anterior.lng! } : null} soloLectura altura={140} etiqueta="Antes" />
            <MapaUbicacion punto={{ lat: propuesta.nueva.lat!, lng: propuesta.nueva.lng! }} soloLectura altura={140} etiqueta="Después" />
          </div>
          {puedeCambiar && (
            <div style={{ display: 'flex', gap: 8 }}>
              {!propuesta.fueraDeZona && (
                <Boton
                  tamano="pequeno"
                  cargando={ocupado}
                  onClick={() =>
                    decidir(() => cambioUbicacionApi.aprobarPropuesta(pedidoId, propuesta.id), 'Cambio aprobado.')
                  }
                >
                  {propuesta.origen === 'WHATSAPP_CLIENTE' ? 'Usar' : 'Aprobar'}
                </Boton>
              )}
              <Boton variante="secundario" tamano="pequeno" deshabilitado={ocupado} onClick={() => setRechazando(propuesta)}>
                {propuesta.origen === 'WHATSAPP_CLIENTE' ? 'Descartar' : 'Rechazar'}
              </Boton>
            </div>
          )}
        </div>
      )}

      {ajustePendiente?.ajuste && puedeCambiar && (
        <div role="region" aria-label="Ajuste de cobro" style={{ background: '#fff', borderRadius: 12, padding: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 13 }}>{textoAjuste(ajustePendiente.ajuste)}</span>
          <Boton
            tamano="pequeno"
            deshabilitado={ocupado}
            onClick={() => setLiquidando({ cambio: ajustePendiente, medio: 'EFECTIVO', codigo: '' })}
          >
            {ajustePendiente.ajuste.tipo === 'SALDO' ? 'Cobrar saldo' : 'Marcar como devuelta'}
          </Boton>
        </div>
      )}

      {lat != null && lng != null && <div style={{ fontSize: 12 }}>{direccion ?? 'Sin dirección escrita'}</div>}

      {aviso && (
        <div role="status" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-teal, #2C6E7F)' }}>
          {aviso}
        </div>
      )}
      {error && (
        <div role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-rust, #C4412B)' }}>
          {error}
        </div>
      )}

      {historial && historial.cambios.length > 0 && (
        <details>
          <summary style={{ fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Historial de ubicación ({historial.cambios.length})</summary>
          <ul aria-label="Historial de ubicación" style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {historial.cambios.map((c) => (
              <li key={c.id} style={{ fontSize: 12, background: '#fff', borderRadius: 10, padding: 8 }}>
                <div>
                  <strong>{ORIGEN_CAMBIO[c.origen] ?? c.origen}</strong> · {c.estado}
                  {c.estado === 'APROBADA' && c.resueltoPorNombre ? ` por ${c.resueltoPorNombre}` : ''}
                  {c.estado === 'PROPUESTA' && c.propuestoPorNombre ? ` de ${c.propuestoPorNombre}` : ''}
                </div>
                <div>
                  {c.anterior.zona ?? '—'} → {c.nueva.zona ?? '—'} · Envío {c.envioAnterior != null ? `S/ ${c.envioAnterior.toFixed(2)}` : '—'} →{' '}
                  {c.envioNuevo != null ? `S/ ${c.envioNuevo.toFixed(2)}` : '—'} ({textoDifEnvio(c.diferencia)})
                </div>
                {c.ajuste && <div>{textoAjuste(c.ajuste)}</div>}
                {c.motivo && <div>Motivo: {c.motivo}</div>}
                {c.nota && <div>Nota: {c.nota}</div>}
                {c.avisoCliente && <div>Aviso al cliente: {c.avisoCliente.replace(/_/g, ' ').toLowerCase()}</div>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {abrirCambio && (
        <ModalCambiarUbicacion
          pedidoId={pedidoId}
          codigoPedido={codigo}
          direccionActual={direccion}
          puntoActual={lat != null && lng != null ? { lat, lng } : null}
          alCerrar={() => setAbrirCambio(false)}
          alCambiar={() => {
            setAbrirCambio(false);
            setAviso('Ubicación cambiada.');
            cargar();
            alActualizar();
          }}
        />
      )}

      {rechazando && (
        <div role="dialog" aria-label="Rechazar propuesta" style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(11,44,62,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--cp-cream, #FBF4EC)', borderRadius: 16, padding: 16, width: 'min(420px, calc(100% - 24px))', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 800 }}>Rechazar el cambio propuesto</div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Motivo (opcional)
              <input value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} style={{ width: '100%', minHeight: 40, marginTop: 4, borderRadius: 10, border: '1.5px solid var(--cp-line, #E3D6C6)', padding: '0 10px', boxSizing: 'border-box' }} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Boton variante="secundario" onClick={() => setRechazando(null)} style={{ flex: 1 }}>
                Volver
              </Boton>
              <Boton
                style={{ flex: 1 }}
                cargando={ocupado}
                onClick={async () => {
                  const id = rechazando.id;
                  setRechazando(null);
                  await decidir(() => cambioUbicacionApi.rechazarPropuesta(pedidoId, id, motivo.trim() || undefined), 'Cambio rechazado.');
                  setMotivo('');
                }}
              >
                Rechazar
              </Boton>
            </div>
          </div>
        </div>
      )}

      {liquidando && (
        <div role="dialog" aria-label="Cobrar o devolver" style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(11,44,62,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--cp-cream, #FBF4EC)', borderRadius: 16, padding: 16, width: 'min(420px, calc(100% - 24px))', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 800 }}>
              {liquidando.cambio.ajuste?.tipo === 'SALDO' ? 'Cobrar saldo' : 'Marcar devolución'} · S/ {liquidando.cambio.ajuste?.monto?.toFixed(2)}
            </div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Medio
              <select value={liquidando.medio} onChange={(e) => setLiquidando({ ...liquidando, medio: e.target.value })} style={{ width: '100%', minHeight: 40, marginTop: 4, borderRadius: 10, padding: '0 10px' }}>
                {MEDIOS.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>
            {liquidando.medio !== 'EFECTIVO' && (
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Código de operación
                <input value={liquidando.codigo} maxLength={60} onChange={(e) => setLiquidando({ ...liquidando, codigo: e.target.value })} style={{ width: '100%', minHeight: 40, marginTop: 4, borderRadius: 10, border: '1.5px solid var(--cp-line, #E3D6C6)', padding: '0 10px', boxSizing: 'border-box' }} />
              </label>
            )}
            <div style={{ fontSize: 12 }}>En efectivo mueve la caja de hoy; en digital queda en el cierre del día.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Boton variante="secundario" onClick={() => setLiquidando(null)} style={{ flex: 1 }}>
                Cancelar
              </Boton>
              <Boton style={{ flex: 1 }} cargando={ocupado} deshabilitado={liquidando.medio !== 'EFECTIVO' && !liquidando.codigo.trim()} onClick={liquidar}>
                Confirmar
              </Boton>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

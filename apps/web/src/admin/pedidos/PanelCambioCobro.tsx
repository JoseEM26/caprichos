import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { useEventos } from '../../comun/socket';
import { SeccionVouchersPedido } from './SeccionVouchersPedido';
import { cambioCobroApi, textoPlan, type AccionCambioCobro, type SolicitudPendienteCaja } from '../repartos/cambioCobroApi';

/** Solicitudes de cambio de pago pendientes, al día con el socket. `activo` false = no consulta (sin permiso). */
export function useCambiosCobroPendientes(activo = true) {
  const [pendientes, setPendientes] = useState<SolicitudPendienteCaja[]>([]);
  const cargar = useCallback(() => {
    if (!activo) return;
    cambioCobroApi
      .pendientes()
      .then((r) => setPendientes(Array.isArray(r) ? r : []))
      .catch(() => setPendientes([]));
  }, [activo]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEventos('cambio-cobro:solicitud', cargar);
  return { pendientes, recargar: cargar };
}

/** Insignia «Cambio de pago solicitado» para la tarjeta o lista de pedidos de Caja. */
export function InsigniaCambioCobro() {
  return (
    <span
      data-testid="insignia-cambio-cobro"
      title="El repartidor pidió cambiar la forma de pago: valida la captura en el panel de arriba"
      style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, borderRadius: 9999, padding: '2px 8px', background: '#FDE8E8', border: '1px solid var(--cp-rust, #C4412B)', color: 'var(--cp-rust, #C4412B)' }}
    >
      Cambio de pago solicitado
    </span>
  );
}

type Dialogo = { solicitud: SolicitudPendienteCaja; accion: Exclude<AccionCambioCobro, 'APROBAR'> } | null;

/**
 * Panel de Caja: cada solicitud muestra el medio original contra el nuevo, la captura para validar y los botones
 * Aprobar / Rechazar (el pedido sigue con el medio original) / Autorizar entrega sin validar (con motivo).
 */
export function PanelCambioCobro({ pendientes, alResolver }: { pendientes: SolicitudPendienteCaja[]; alResolver?: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [motivo, setMotivo] = useState('');

  const resolver = async (s: SolicitudPendienteCaja, accion: AccionCambioCobro, texto?: string) => {
    setOcupado(true);
    setError('');
    try {
      await cambioCobroApi.resolver(s.pedidoId, s.id, accion, texto?.trim() || undefined);
      setDialogo(null);
      setMotivo('');
      alResolver?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo resolver la solicitud.');
    } finally {
      setOcupado(false);
    }
  };

  if (pendientes.length === 0) return null;
  const motivoMinimo = dialogo?.accion === 'AUTORIZAR_SIN_VALIDAR' ? 5 : 0;

  return (
    <section aria-label="Cambios de pago solicitados" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, background: '#FDE8E8', borderRadius: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy, #0B2C3E)' }}>Cambios de pago solicitados ({pendientes.length})</div>
      {error && (
        <div role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-rust, #C4412B)' }}>
          {error}
        </div>
      )}
      {pendientes.map((s) => (
        <article key={s.id} aria-label={`Cambio de pago del pedido ${s.codigo}`} style={{ background: '#fff', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13 }}>
            <strong>{s.codigo}</strong> · {s.cliente || 'Cliente'} · pide {s.solicitadoPor ?? 'el repartidor'} · total S/ {s.total.toFixed(2)}
          </div>
          <div style={{ fontSize: 13 }}>
            <div>
              <strong>Medio original:</strong> {textoPlan(s.planOriginal)}
            </div>
            <div>
              <strong>Medio nuevo:</strong> {textoPlan(s.planSolicitado)}
              {s.pagaCon != null ? ` · paga con S/ ${s.pagaCon.toFixed(2)}` : ''}
            </div>
          </div>
          <SeccionVouchersPedido pedidoId={s.pedidoId} total={s.total} recargarClave={s.id} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Boton tamano="pequeno" deshabilitado={ocupado} onClick={() => resolver(s, 'APROBAR')}>
              Aprobar
            </Boton>
            <Boton variante="secundario" tamano="pequeno" deshabilitado={ocupado} onClick={() => setDialogo({ solicitud: s, accion: 'RECHAZAR' })}>
              Rechazar
            </Boton>
            <Boton variante="secundario" tamano="pequeno" deshabilitado={ocupado} onClick={() => setDialogo({ solicitud: s, accion: 'AUTORIZAR_SIN_VALIDAR' })}>
              Autorizar entrega sin validar
            </Boton>
          </div>
        </article>
      ))}

      {dialogo && (
        <div role="dialog" aria-label={dialogo.accion === 'RECHAZAR' ? 'Rechazar cambio de pago' : 'Autorizar entrega sin validar'} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(11,44,62,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--cp-cream, #FBF4EC)', borderRadius: 16, padding: 16, width: 'min(420px, calc(100% - 24px))', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 800 }}>
              {dialogo.accion === 'RECHAZAR'
                ? `Rechazar el cambio de ${dialogo.solicitud.codigo}: el pedido vuelve a ${textoPlan(dialogo.solicitud.planOriginal)}`
                : `Autorizar la entrega de ${dialogo.solicitud.codigo} sin validar el pago`}
            </div>
            {dialogo.accion === 'AUTORIZAR_SIN_VALIDAR' && (
              <div style={{ fontSize: 12 }}>El nuevo medio se aplica, pero la captura queda sin validar. Queda registrado con tu nombre y el motivo.</div>
            )}
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Motivo {motivoMinimo ? '(obligatorio, mínimo 5 caracteres)' : '(opcional)'}
              <input value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} style={{ width: '100%', minHeight: 40, marginTop: 4, borderRadius: 10, border: '1.5px solid var(--cp-line, #E3D6C6)', padding: '0 10px', boxSizing: 'border-box' }} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Boton variante="secundario" onClick={() => { setDialogo(null); setMotivo(''); }} style={{ flex: 1 }}>
                Cancelar
              </Boton>
              <Boton cargando={ocupado} deshabilitado={motivo.trim().length < motivoMinimo} onClick={() => resolver(dialogo.solicitud, dialogo.accion, motivo)} style={{ flex: 1 }}>
                {dialogo.accion === 'RECHAZAR' ? 'Rechazar' : 'Autorizar'}
              </Boton>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

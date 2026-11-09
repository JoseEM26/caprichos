import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { useEventos } from '../../comun/socket';
import { PlanPagoEditor } from '../salon/componentes/PlanPagoEditor';
import { aPlan, errorPlan, montoEfectivoPlan, nombreMedio, planInicial, type FilaPlan } from '../pedidos/planPago';
import { cambioCobroApi, TEXTO_ESTADO_CAMBIO, textoPlan, type SolicitudCambioCobro } from './cambioCobroApi';

const MEDIOS_CON_CAPTURA = ['YAPE', 'PLIN', 'TRANSFERENCIA'];

/** Solicitud más reciente del pedido, al día con los avisos en vivo de Caja. */
export function useCambioCobro(pedidoId: string, activo = true) {
  const [vigente, setVigente] = useState<SolicitudCambioCobro | null>(null);
  const cargar = useCallback(() => {
    if (!activo) return;
    cambioCobroApi
      .vigente(pedidoId)
      .then(setVigente)
      .catch(() => setVigente(null));
  }, [pedidoId, activo]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEventos('cambio-cobro:solicitud', (d: { pedidoId?: string }) => {
    if (!d?.pedidoId || String(d.pedidoId) === String(pedidoId)) cargar();
  });
  return { vigente, recargar: cargar, fijar: setVigente };
}

/** Estado en vivo de la última solicitud de cambio de pago (pendiente, aprobada, rechazada o autorizada). */
export function EstadoCambioCobro({ solicitud }: { solicitud: SolicitudCambioCobro | null }) {
  if (!solicitud?.estado) return null;
  const color = solicitud.estado === 'RECHAZADA' ? 'var(--cp-rust)' : solicitud.estado === 'PENDIENTE' ? 'var(--cp-orange)' : 'var(--cp-green)';
  return (
    <div
      role="status"
      data-testid="estado-cambio-cobro"
      style={{ padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${color}`, background: 'var(--cp-white)', fontSize: 13, fontWeight: 700 }}
    >
      <div style={{ color }}>{TEXTO_ESTADO_CAMBIO[solicitud.estado]}</div>
      <div style={{ fontWeight: 600 }}>
        {textoPlan(solicitud.planOriginal)} → {textoPlan(solicitud.planSolicitado)}
      </div>
      {solicitud.motivo && <div style={{ fontWeight: 600 }}>Motivo: {solicitud.motivo}</div>}
    </div>
  );
}

/** Foto de la captura: cámara del celular o galería (una por medio digital). */
function CapturaMedio({ medio, monto, archivo, alElegir }: { medio: string; monto: number; archivo?: File; alElegir: (f: File | undefined) => void }) {
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const elegido = (e: React.ChangeEvent<HTMLInputElement>) => alElegir(e.target.files?.[0]);
  const boton = { minHeight: 48, flex: 1, borderRadius: 10, border: '1.5px solid var(--cp-navy)', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' } as const;
  return (
    <div data-testid={`captura-${medio}`} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, borderRadius: 10, background: 'var(--cp-white)', border: `1.5px solid ${archivo ? 'var(--cp-green)' : 'var(--cp-line, #E3D6C6)'}` }}>
      <div style={{ fontSize: 13, fontWeight: 800 }}>
        Captura de {nombreMedio(medio)} (S/ {monto.toFixed(2)}) <span style={{ color: 'var(--cp-soft)' }}>opcional</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={boton} onClick={() => camara.current?.click()}>
          Tomar foto
        </button>
        <button type="button" style={boton} onClick={() => galeria.current?.click()}>
          Galería
        </button>
      </div>
      <input ref={camara} type="file" accept="image/*" capture="environment" aria-label={`Foto de ${nombreMedio(medio)}`} hidden onChange={elegido} />
      <input ref={galeria} type="file" accept="image/*" aria-label={`Galería de ${nombreMedio(medio)}`} hidden onChange={elegido} />
      <div style={{ fontSize: 12, fontWeight: 700, color: archivo ? 'var(--cp-green)' : 'var(--cp-soft)' }}>{archivo ? `Lista: ${archivo.name}` : 'Sin captura (puedes subirla después)'}</div>
    </div>
  );
}

/**
 * Botón «Cambiar forma de pago» de la pantalla Pedido: el cliente quiere pagar distinto al llegar. El repartidor elige
 * el medio nuevo (o mixto), sube la captura de cada parte digital (opcional) y el cambio SE APLICA DE INMEDIATO, sin aprobación.
 */
export function BotonCambiarFormaPago({
  pedidoId,
  codigo,
  estado,
  totalCobrable,
  medioActual,
  solicitud,
  alEnviado,
}: {
  pedidoId: string;
  codigo: string;
  estado: string;
  totalCobrable: number;
  medioActual: string;
  solicitud: SolicitudCambioCobro | null;
  alEnviado: (s: SolicitudCambioCobro) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<FilaPlan[]>(() => planInicial(medioActual === 'YAPE' ? 'EFECTIVO' : 'YAPE', totalCobrable));
  const [pagaCon, setPagaCon] = useState('');
  const [capturas, setCapturas] = useState<Record<string, File | undefined>>({});
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const plan = useMemo(() => aPlan(filas), [filas]);
  const digitales = plan.filter((f) => MEDIOS_CON_CAPTURA.includes(f.medio));
  const falloPlan = errorPlan(totalCobrable, filas);
  const montoEf = montoEfectivoPlan(plan);
  const pagaConNum = Number(pagaCon);
  const pagaConMalo = montoEf > 0 && pagaCon !== '' && !(pagaConNum >= montoEf);
  const puedeEnviar = !falloPlan && !pagaConMalo && !ocupado;

  // Solo en camino o ya en la puerta; con una solicitud pendiente se ve su estado, no el botón
  if (estado !== 'EN_CAMINO') return null;
  const pendiente = solicitud?.estado === 'PENDIENTE';

  const enviar = async () => {
    setOcupado(true);
    setError('');
    try {
      const r = await cambioCobroApi.solicitar(pedidoId, {
        plan,
        pagaCon: montoEf > 0 && pagaCon !== '' ? pagaConNum : null,
        capturas: Object.fromEntries(digitales.map((d) => [d.medio, capturas[d.medio]])),
      });
      alEnviado(r);
      setAbierto(false);
      setCapturas({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la forma de pago.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <EstadoCambioCobro solicitud={solicitud} />
      {!pendiente && (
        <Boton variante="secundario" tamano="grande" data-testid="btn-cambiar-pago" onClick={() => setAbierto(true)} aria-label={`Cambiar forma de pago del pedido ${codigo}`}>
          Cambiar forma de pago
        </Boton>
      )}
      {abierto && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(11, 44, 62, 0.55)' }} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cambiar forma de pago"
            style={{ position: 'fixed', zIndex: 60, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(560px, calc(100% - 24px))', maxHeight: 'calc(100% - 24px)', overflowY: 'auto', background: 'var(--cp-cream, #FBF4EC)', borderRadius: 20, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box' }}
          >
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--cp-navy)' }}>Nueva forma de pago de {codigo}</div>
            <div style={{ fontSize: 13 }}>
              Total a cobrar: <strong>S/ {totalCobrable.toFixed(2)}</strong>. El cambio se aplica al instante y Caja lo ve como aviso, sin aprobación.
            </div>
            <PlanPagoEditor total={totalCobrable} filas={filas} onChange={setFilas} pagaCon={pagaCon} onPagaCon={setPagaCon} />
            {digitales.map((d) => (
              <CapturaMedio key={d.medio} medio={d.medio} monto={d.monto} archivo={capturas[d.medio]} alElegir={(f) => setCapturas((c) => ({ ...c, [d.medio]: f }))} />
            ))}
            {pagaConMalo && (
              <div role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-rust)' }}>
                Con cuánto paga debe ser al menos S/ {montoEf.toFixed(2)}
              </div>
            )}
            {error && (
              <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Boton variante="secundario" onClick={() => setAbierto(false)} style={{ flex: 1 }}>
                Cancelar
              </Boton>
              <Boton data-testid="enviar-cambio-pago" cargando={ocupado} deshabilitado={!puedeEnviar} onClick={enviar} style={{ flex: 1 }}>
                Cambiar forma de pago
              </Boton>
            </div>
          </div>
        </>
      )}
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { ErrorApi } from '../../comun/api';
import { autenticar3ds, obtenerDeviceId } from './culqi3ds';
import { abrirCulqi, culqiApi, ErrorAperturaCulqi, ESTADO_3DS, ID_CONTENEDOR_CULQI, mensajeRechazo, type ConfigCulqi, type IntentoCulqi, type MedioCulqi } from './culqiApi';

type Fase = 'cargando' | 'listo' | 'formulario' | 'pagando' | 'aprobado' | 'rechazado' | 'pendiente' | 'error';
export const AVISO_PAGO_EN_LINEA = 'Tu pedido pasa a cocina cuando se apruebe el pago. Si no pagas en 15 minutos, se anula solo.';

const SOLES = (n: number) => `S/ ${n.toFixed(2)}`;
const VIGENCIA_MS = 15 * 60 * 1000;
const ESPERA_MONTAJE_MS = 10000;

/** Minutos que quedan para pagar (el pedido sin pagar se anula a los 15 min); null si no se sabe la hora. */
function useMinutosRestantes(creadoEn?: string): number | null {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  const inicio = creadoEn ? Date.parse(creadoEn) : NaN;
  return Number.isNaN(inicio) ? null : Math.max(0, Math.ceil((inicio + VIGENCIA_MS - ahora) / 60000));
}
const TOKENS_PRUEBA: { token: string; medio: MedioCulqi; texto: string }[] = [
  { token: 'tkn_simulado_ok', medio: 'TARJETA', texto: 'Probar tarjeta aprobada' },
  { token: 'tkn_simulado_rechazo', medio: 'TARJETA', texto: 'Probar tarjeta rechazada' },
  { token: 'ype_simulado_ok', medio: 'YAPE', texto: 'Probar Yape aprobado' },
];

/** «Pagar ahora con tarjeta o Yape» (Culqi). No pinta nada si la pasarela no está activa. */
export function PagarEnLinea({ pedidoId, token: tokenSeguimiento, auto, alPagado, monto, creadoEn, alFormulario }: { pedidoId: string; token?: string; /** lo que falta pagar */ monto?: number; /** ISO de creación del pedido, para el contador de 15 min */ creadoEn?: string; /** abre el pago solo al mostrarse (pedido recién hecho con este medio) */ auto?: boolean; alPagado?: () => void; /** avisa si el formulario de pago está abierto, para que el modal le dé todo el espacio */ alFormulario?: (abierto: boolean) => void }) {
  const [config, setConfig] = useState<ConfigCulqi | null>(null);
  const [fase, setFase] = useState<Fase>('cargando');
  const [mensaje, setMensaje] = useState('');
  const [intento, setIntento] = useState<IntentoCulqi | null>(null);
  const minutos = useMinutosRestantes(creadoEn);
  const enCurso = useRef(false); // evita el doble clic antes de que React deshabilite el botón

  useEffect(() => {
    let vivo = true;
    culqiApi
      .config()
      .then((c) => vivo && (setConfig(c), setFase('listo')))
      .catch(() => vivo && setConfig(null)); // sin config no se ofrece: los medios de siempre siguen
    return () => {
      vivo = false;
    };
  }, []);

  const cobrar = async (token: string, medio: MedioCulqi, email?: string, ya?: IntentoCulqi) => {
    const it = ya ?? intento;
    if (!it) return;
    try {
      // huella del dispositivo para el banco (solo con Culqi real; sin ella el cargo sigue)
      let deviceId: string | undefined;
      if (it.modo !== 'SIMULADO') deviceId = await obtenerDeviceId().catch(() => undefined);
      const base = { intentoId: it.intentoId, token, medio, ...(email ? { email } : {}), ...(deviceId ? { deviceId } : {}) };
      let r = await culqiApi.cargo(base);
      if (r.estado === ESTADO_3DS) {
        // el banco pide verificar la tarjeta (3DS); el cargo se reenvía con el resultado
        const d = r.datos3ds;
        deviceId ??= await obtenerDeviceId().catch(() => undefined);
        const auth = await autenticar3ds(d?.publicKey ?? it.publicKey ?? config?.publicKey ?? '', token, {
          montoCentimos: d?.montoCentimos ?? it.montoCentimos,
          moneda: d?.moneda ?? it.moneda,
          email: d?.email ?? email,
        });
        r = await culqiApi.cargo({ ...base, ...(deviceId ? { deviceId } : {}), autenticacion3ds: auth });
      }
      setMensaje(r.estado === 'RECHAZADO' ? mensajeRechazo(r.codigo, r.mensaje) : r.mensaje);
      if (r.estado === 'APROBADO') {
        setFase('aprobado');
        alPagado?.();
      } else if (r.estado === 'RECHAZADO') {
        setFase('rechazado');
      } else {
        // PENDIENTE: no se ofrece reintentar; el seguimiento se refresca
        setFase('pendiente');
        alPagado?.();
      }
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No pudimos conectar. Revisa tu internet y reintenta.');
      setFase('error');
    }
  };

  const pagar = async (token?: string, medio?: MedioCulqi) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setFase('pagando');
    setMensaje('');
    try {
      const it = await culqiApi.intento(pedidoId, tokenSeguimiento); // cada intento es nuevo: uno rechazado no se reutiliza
      setIntento(it);
      if (it.modo === 'SIMULADO') {
        if (token && medio) await cobrar(token, medio, undefined, it);
        else setFase('listo');
      } else {
        setFase('formulario'); // el efecto de abajo monta Culqi dentro del contenedor de este modal
      }
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === 'PAGO_ONLINE_APAGADO') {
        setConfig(null);
        return;
      }
      setMensaje(e instanceof ErrorApi ? e.message : e instanceof Error ? e.message : 'No pudimos conectar. Reintenta.');
      setFase('error');
    } finally {
      enCurso.current = false;
    }
  };

  // Culqi embebido: se monta en #culqi-container (dentro de nuestro modal) y se desmonta al volver o cerrar.
  const cancelarCulqi = useRef<() => void>(() => {});
  useEffect(() => {
    if (fase !== 'formulario' || !intento) return;
    document.getElementById('culqi-embebido')?.focus();
    const { resultado, cerrar } = abrirCulqi(intento);
    cancelarCulqi.current = cerrar;
    let vivo = true;
    resultado
      .then((res) => {
        if (!vivo) return;
        if (!res) setFase('listo');
        else { setFase('pagando'); void cobrar(res.token, res.medio, res.email, intento); }
      })
      .catch((e) => {
        if (!vivo) return;
        setMensaje(e instanceof Error ? e.message : 'No pudimos conectar. Reintenta.');
        setFase(e instanceof ErrorAperturaCulqi ? 'error' : 'rechazado');
      });
    return () => {
      vivo = false;
      cerrar();
    };
  }, [fase, intento]);

  useEffect(() => {
    alFormulario?.(fase === 'formulario');
    return () => alFormulario?.(false);
  }, [fase]);

  // Si Culqi no llegó a montar su iframe en el contenedor, se avisa en vez de dejar un hueco vacío.
  useEffect(() => {
    if (fase !== 'formulario') return;
    const t = setTimeout(() => {
      if (!document.querySelector(`#${ID_CONTENEDOR_CULQI} iframe`)) {
        setMensaje(new ErrorAperturaCulqi().message);
        setFase('error');
      }
    }, ESPERA_MONTAJE_MS);
    return () => clearTimeout(t);
  }, [fase]);

  const iniciado = useRef(false);
  useEffect(() => {
    if (auto && config?.activo && config.modo === 'REAL' && !iniciado.current) {
      iniciado.current = true;
      void pagar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, config]);

  if (!config?.activo) return null;
  if (fase === 'cargando') return <Cargando />;

  const simulado = config.modo === 'SIMULADO';
  const ocupado = fase === 'pagando';
  const enFormulario = fase === 'formulario';

  return (
    <section className="sg-tarjeta" aria-label="Pagar en línea" data-testid="pagar-en-linea">
      {fase === 'pendiente' ? (
        <p role="status" data-testid="pago-pendiente" style={{ margin: 0, fontWeight: 700 }}>
          Estamos confirmando tu pago, no vuelvas a pagar.
        </p>
      ) : fase === 'aprobado' ? (
        <p role="status" data-testid="pago-aprobado" style={{ margin: 0, color: 'var(--cp-green)', fontWeight: 700 }}>
          Pago aprobado, tu pedido ya está en cocina. {mensaje}
        </p>
      ) : (
        <>
          <strong data-testid="falta-pagar" style={{ color: 'var(--cp-navy)', fontSize: enFormulario ? 17 : undefined }}>
            {enFormulario
              ? `Pagar ${SOLES(monto && monto > 0 ? monto : (intento?.montoCentimos ?? 0) / 100)}${minutos !== null && minutos > 0 ? ` · Te quedan ${minutos} min` : ''}`
              : monto && monto > 0 ? `Falta pagar ${SOLES(monto)}` : 'Pagar ahora con tarjeta o Yape'}
          </strong>
          {minutos !== null && !(enFormulario && minutos > 0) && (
            <p data-testid="contador-pago" className="sg-detalle" style={{ margin: '4px 0 0', fontWeight: 700 }}>
              {minutos > 0 ? `Te quedan ${minutos} min para pagar` : 'El tiempo para pagar se acabó: el pedido se anula solo'}
            </p>
          )}
          {!enFormulario && (
            <p className="sg-detalle" style={{ margin: '4px 0 8px' }}>
              Pagas el total del pedido, sin recargo. {AVISO_PAGO_EN_LINEA}
            </p>
          )}
          {fase === 'rechazado' && (
            <p role="alert" data-testid="pago-rechazado" style={{ color: 'var(--cp-rust)', margin: '0 0 8px' }}>
              {mensaje} Puedes reintentar u otro medio de pago.
            </p>
          )}
          {fase === 'error' && (
            <p role="alert" data-testid="pago-error" style={{ color: 'var(--cp-rust)', margin: '0 0 8px' }}>
              {mensaje}
            </p>
          )}
          {ocupado && <p role="status" style={{ margin: '0 0 8px' }}>Procesando tu pago...</p>}
          {enFormulario ? (
            <div id="culqi-embebido" tabIndex={-1} data-testid="culqi-embebido" style={{ outline: 'none' }} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setFase('listo'); } }}>
              {/* Culqi monta aquí su formulario (iframe alojado por Culqi: la tarjeta no pasa por nuestro código) */}
              {/* Altura DEFINIDA: el iframe de Culqi mide height:100% y con solo min-height se colapsaba */}
              <div id={ID_CONTENEDOR_CULQI} className="sg-culqi" aria-label="Formulario de pago de Culqi" />
              <Boton variante="secundario" onClick={() => setFase('listo')} style={{ marginTop: 8 }}>
                Volver
              </Boton>
            </div>
          ) : simulado ? (
            <div style={{ display: 'grid', gap: 8 }} data-testid="pago-simulado">
              <p className="sg-detalle" style={{ margin: 0 }}>Modo de prueba: no se cobra dinero real.</p>
              {TOKENS_PRUEBA.filter((t) => config.medios.includes(t.medio)).map((t) => (
                <Boton key={t.token} variante="secundario" disabled={ocupado} onClick={() => void pagar(t.token, t.medio)}>
                  {t.texto}
                </Boton>
              ))}
            </div>
          ) : (
            <Boton disabled={ocupado} cargando={ocupado} onClick={() => void pagar()}>
              {fase === 'rechazado' || fase === 'error' ? 'Reintentar el pago' : 'Pagar ahora'}
            </Boton>
          )}
          {intento && !enFormulario && <span className="sg-detalle" style={{ display: 'block', marginTop: 6 }}>Monto: {SOLES(intento.montoCentimos / 100)}</span>}
        </>
      )}
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { ErrorApi } from '../../comun/api';
import { abrirCulqi, culqiApi, type ConfigCulqi, type IntentoCulqi, type MedioCulqi } from './culqiApi';

type Fase = 'cargando' | 'listo' | 'pagando' | 'aprobado' | 'rechazado' | 'pendiente' | 'error';
export const AVISO_PAGO_EN_LINEA = 'Tu pedido pasa a cocina cuando se apruebe el pago. Si no pagas en 15 minutos, se anula solo.';

const SOLES = (n: number) => `S/ ${n.toFixed(2)}`;
const TOKENS_PRUEBA: { token: string; medio: MedioCulqi; texto: string }[] = [
  { token: 'tkn_simulado_ok', medio: 'TARJETA', texto: 'Probar tarjeta aprobada' },
  { token: 'tkn_simulado_rechazo', medio: 'TARJETA', texto: 'Probar tarjeta rechazada' },
  { token: 'ype_simulado_ok', medio: 'YAPE', texto: 'Probar Yape aprobado' },
];

/** «Pagar ahora con tarjeta o Yape» (Culqi). No pinta nada si la pasarela no está activa. */
export function PagarEnLinea({ pedidoId, token: tokenSeguimiento, auto, alPagado }: { pedidoId: string; token?: string; /** abre el pago solo al mostrarse (pedido recién hecho con este medio) */ auto?: boolean; alPagado?: () => void }) {
  const [config, setConfig] = useState<ConfigCulqi | null>(null);
  const [fase, setFase] = useState<Fase>('cargando');
  const [mensaje, setMensaje] = useState('');
  const [intento, setIntento] = useState<IntentoCulqi | null>(null);
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
      const r = await culqiApi.cargo({ intentoId: it.intentoId, token, medio, ...(email ? { email } : {}) });
      setMensaje(r.mensaje);
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
      setMensaje(e instanceof ErrorApi ? e.message : 'No pudimos conectar. Revisa tu internet y reintenta.');
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
        const res = await abrirCulqi(it);
        if (!res) setFase('listo');
        else await cobrar(res.token, res.medio, res.email, it);
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
          <strong style={{ color: 'var(--cp-navy)' }}>Pagar ahora con tarjeta o Yape</strong>
          <p className="sg-detalle" style={{ margin: '4px 0 8px' }}>
            Pagas el total del pedido, sin recargo. {AVISO_PAGO_EN_LINEA}
          </p>
          {fase === 'rechazado' && (
            <p role="alert" data-testid="pago-rechazado" style={{ color: 'var(--cp-rust)', margin: '0 0 8px' }}>
              No se pudo cobrar. {mensaje} Puedes reintentar u otro medio de pago.
            </p>
          )}
          {fase === 'error' && (
            <p role="alert" data-testid="pago-error" style={{ color: 'var(--cp-rust)', margin: '0 0 8px' }}>
              {mensaje}
            </p>
          )}
          {ocupado && <p role="status" style={{ margin: '0 0 8px' }}>Procesando tu pago...</p>}
          {simulado ? (
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
          {intento && <span className="sg-detalle" style={{ display: 'block', marginTop: 6 }}>Monto: {SOLES(intento.montoCentimos / 100)}</span>}
        </>
      )}
    </section>
  );
}

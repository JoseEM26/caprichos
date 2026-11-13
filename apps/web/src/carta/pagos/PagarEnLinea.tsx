import { useEffect, useRef, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { ErrorApi } from '../../comun/api';
import { abrirCulqi, culqiApi, type ConfigCulqi, type IntentoCulqi, type MedioCulqi } from './culqiApi';

type Fase = 'cargando' | 'listo' | 'pagando' | 'aprobado' | 'rechazado' | 'error';

const SOLES = (n: number) => `S/ ${n.toFixed(2)}`;
const TOKENS_PRUEBA: { token: string; medio: MedioCulqi; texto: string }[] = [
  { token: 'tkn_simulado_ok', medio: 'TARJETA', texto: 'Probar tarjeta aprobada' },
  { token: 'tkn_simulado_rechazo', medio: 'TARJETA', texto: 'Probar tarjeta rechazada' },
  { token: 'ype_simulado_ok', medio: 'YAPE', texto: 'Probar Yape aprobado' },
];

/** «Pagar ahora con tarjeta o Yape» (Culqi). No pinta nada si la pasarela no está activa. */
export function PagarEnLinea({ pedidoId, alPagado }: { pedidoId: string; alPagado?: () => void }) {
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

  if (!config?.activo) return null;

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
        setFase('rechazado');
        setMensaje(r.mensaje || 'Tu pago está pendiente. Si te descontaron, avísanos.');
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
      const it = await culqiApi.intento(pedidoId);
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
      setMensaje(e instanceof ErrorApi ? e.message : e instanceof Error ? e.message : 'No pudimos conectar. Reintenta.');
      setFase('error');
    } finally {
      enCurso.current = false;
    }
  };

  if (fase === 'cargando') return <Cargando />;

  const simulado = config.modo === 'SIMULADO';
  const ocupado = fase === 'pagando';

  return (
    <section className="sg-tarjeta" aria-label="Pagar en línea" data-testid="pagar-en-linea">
      {fase === 'aprobado' ? (
        <p role="status" data-testid="pago-aprobado" style={{ margin: 0, color: 'var(--cp-green)', fontWeight: 700 }}>
          Pago aprobado, tu pedido ya está en cocina. {mensaje}
        </p>
      ) : (
        <>
          <strong style={{ color: 'var(--cp-navy)' }}>Pagar ahora con tarjeta o Yape</strong>
          <p className="sg-detalle" style={{ margin: '4px 0 8px' }}>
            Pagas el total del pedido, sin recargo. Al aprobarse, tu pedido pasa a cocina.
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

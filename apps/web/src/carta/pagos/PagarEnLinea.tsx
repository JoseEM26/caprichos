import { useEffect, useRef, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { ErrorApi } from '../../comun/api';
import { autenticar3ds, obtenerDeviceId } from './culqi3ds';
import { abrirCulqi, cargarScriptCulqi, culqiApi, ErrorAperturaCulqi, ESTADO_3DS, logCulqi, mensajeRechazo, type ConfigCulqi, type IntentoCulqi, type MedioCulqi } from './culqiApi';

type Fase = 'cargando' | 'listo' | 'formulario' | 'pagando' | 'aprobado' | 'rechazado' | 'pendiente' | 'error';
const MEDIOS_CAMBIO: { medio: string; nombre: string }[] = [
  { medio: 'EFECTIVO', nombre: 'Efectivo' },
  { medio: 'YAPE', nombre: 'Yape' },
  { medio: 'PLIN', nombre: 'Plin' },
  { medio: 'TRANSFERENCIA', nombre: 'Transferencia' },
];
export const AVISO_PAGO_EN_LINEA = 'Tu pedido pasa a cocina cuando se apruebe el pago. Si no pagas en 15 minutos, se anula solo.';

const SOLES = (n: number) => `S/ ${n.toFixed(2)}`;
const VIGENCIA_MS = 15 * 60 * 1000;

/** Milisegundos que quedan para pagar (el pedido sin pagar se anula a los 15 min); null si no se sabe la hora. Se refresca cada 30 s. */
function useRestanteMs(creadoEn?: string): number | null {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const inicio = creadoEn ? Date.parse(creadoEn) : NaN;
  return Number.isNaN(inicio) ? null : inicio + VIGENCIA_MS - ahora;
}

/** Cinta de cuenta regresiva con el estilo de la carta. Nunca lleva el precio: el formulario de Culqi ya lo muestra. */
export function CintaTiempo({ restanteMs }: { restanteMs: number | null }) {
  // La barra nace ya en su ancho real: la transición de 30 s se activa tras el primer pintado,
  // así al montar no anima desde 0 y solo anima los cambios posteriores.
  const [conTransicion, setConTransicion] = useState(false);
  useEffect(() => {
    setConTransicion(true);
  }, []);
  if (restanteMs === null) return null;
  const vencido = restanteMs <= 0;
  const urgente = restanteMs <= 3 * 60000;
  const texto = vencido
    ? 'El tiempo para pagar se acabó: el pedido se anula solo'
    : restanteMs <= 60000
      ? 'Te quedan menos de 1 min'
      : `Te quedan ${Math.ceil(restanteMs / 60000)} min para pagar`;
  const pct = Math.max(0, Math.min(100, (restanteMs / VIGENCIA_MS) * 100));
  return (
    <div
      role="group"
      aria-label={texto}
      data-testid="contador-pago"
      data-urgente={urgente ? 'si' : undefined}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 6,
        maxWidth: '100%',
        boxSizing: 'border-box',
        marginTop: 4,
        padding: '8px 14px',
        borderRadius: 14,
        background: urgente ? 'var(--cp-rust)' : 'var(--cp-navy)',
        color: 'var(--cp-cream)',
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1.3,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="13" r="9" />
          <path d="M12 8v5l3 2M9 2h6" />
        </svg>
        {texto}
      </span>
      <span aria-hidden="true" style={{ display: 'block', width: 'min(240px, 100%)', height: 4, borderRadius: 4, background: 'rgba(251,244,236,0.25)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: urgente ? 'var(--cp-cream)' : 'var(--cp-gold)', transition: conTransicion ? 'width 30s linear' : 'none' }} />
      </span>
    </div>
  );
}

/** Estado de carga mientras se abre el pago: aparece al tocar Pagar y se quita cuando llega el iframe de Culqi. */
function CargaPago() {
  const [lenta, setLenta] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLenta(true), 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div role="status" aria-live="polite" data-testid="pago-cargando" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '16px 8px', textAlign: 'center' }}>
      <span aria-hidden="true" style={{ display: 'block', width: 44, height: 44, borderRadius: '50%', border: '4px solid var(--cp-sand)', borderTopColor: 'var(--cp-orange)', animation: 'cp-spin 0.9s linear infinite' }} />
      <strong style={{ color: 'var(--cp-navy)', fontFamily: 'var(--fuente-titulos)', fontSize: 15 }}>Cargando tu pago seguro…</strong>
      <span className="sg-detalle">{lenta ? 'Sigue cargando, no cierres esta ventana' : 'Esto puede tardar unos segundos'}</span>
    </div>
  );
}
const TOKENS_PRUEBA: { token: string; medio: MedioCulqi; texto: string }[] = [
  { token: 'tkn_simulado_ok', medio: 'TARJETA', texto: 'Probar tarjeta aprobada' },
  { token: 'tkn_simulado_rechazo', medio: 'TARJETA', texto: 'Probar tarjeta rechazada' },
  { token: 'ype_simulado_ok', medio: 'YAPE', texto: 'Probar Yape aprobado' },
];

/** «Pagar ahora con tarjeta o Yape» (Culqi). No pinta nada si la pasarela no está activa. */
export function PagarEnLinea({ pedidoId, pedidoCodigo, token: tokenSeguimiento, auto, alPagado, monto, creadoEn, alFormulario }: { pedidoId: string; token?: string; /** código del pedido (CP-…), para el diagnóstico */ pedidoCodigo?: string; /** lo que falta pagar */ monto?: number; /** ISO de creación del pedido, para el contador de 15 min */ creadoEn?: string; /** abre el pago solo al mostrarse (pedido recién hecho con este medio) */ auto?: boolean; alPagado?: () => void; /** avisa si el formulario de pago está abierto, para que el modal le dé todo el espacio */ alFormulario?: (abierto: boolean) => void }) {
  const [config, setConfig] = useState<ConfigCulqi | null>(null);
  const [fase, setFase] = useState<Fase>('cargando');
  const [mensaje, setMensaje] = useState('');
  const [intento, setIntento] = useState<IntentoCulqi | null>(null);
  const restanteMs = useRestanteMs(creadoEn);
  // 'cargando' desde que se toca Pagar hasta que llega el iframe de Culqi ('lista')
  const [pasarela, setPasarela] = useState<'inactiva' | 'cargando' | 'lista'>('inactiva');
  const enCurso = useRef(false); // evita el doble clic antes de que React deshabilite el botón
  const [configFallo, setConfigFallo] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [medioNuevo, setMedioNuevo] = useState<string | null>(null);
  const [enviandoCambio, setEnviandoCambio] = useState(false);
  const [avisoCambio, setAvisoCambio] = useState('');
  const [avisoOk, setAvisoOk] = useState('');
  // Culqi sin respuesta: a los 10 s sin formulario usable se ofrece salida (reintentar, ventana aparte, otro medio)
  const [reintento, setReintento] = useState(0);
  const [ventanaAparte, setVentanaAparte] = useState(false);
  const [diagnostico, setDiagnostico] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    culqiApi
      .config()
      .then((c) => vivo && (setConfig(c), setFase('listo')))
      .catch(() => vivo && (setConfig(null), setConfigFallo(true))); // sin config no se cobra en línea, pero el cliente siempre puede cambiar el medio
    return () => {
      vivo = false;
    };
  }, []);

  // Precarga del script de Culqi en cuanto hay pedido por pagar (idempotente): el formulario no espera la descarga
  useEffect(() => {
    if (config?.activo && config.modo === 'REAL') void cargarScriptCulqi().catch(() => {});
  }, [config]);

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
    setPasarela('cargando');
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

  // Culqi embebido: abrirCulqi crea su propio nodo dentro de `anfitrion` (React no lo posee). Se abre en el
  // frame siguiente, cuando el padre ya aplicó el cambio de layout (alFormulario).
  const anfitrion = useRef<HTMLDivElement>(null);
  const [respaldo, setRespaldo] = useState(false);
  useEffect(() => {
    if (fase !== 'formulario' || !intento) return;
    document.getElementById('culqi-embebido')?.focus();
    let vivo = true;
    let cerrar = () => {};
    let mo: MutationObserver | undefined;
    const frame = requestAnimationFrame(() => {
      if (!vivo || !anfitrion.current) return;
      const nodoAnfitrion = anfitrion.current;
      // en cuanto Culqi mete su iframe en el anfitrión, se quita el estado de carga
      if (typeof MutationObserver !== 'undefined') {
        mo = new MutationObserver(() => {
          const iframe = nodoAnfitrion.querySelector('iframe');
          if (!iframe) return;
          mo?.disconnect();
          // «lista» solo cuando el iframe terminó de cargar: un iframe vacío no quita el estado de carga
          iframe.addEventListener('load', () => {
            if (!vivo) return;
            setPasarela('lista');
            logCulqi('iframe cargado: formulario listo');
          }, { once: true });
        });
        mo.observe(nodoAnfitrion, { childList: true, subtree: true });
      }
      const a = abrirCulqi(intento, nodoAnfitrion, (v) => vivo && setRespaldo(v), undefined, ventanaAparte);
      cerrar = a.cerrar;
      a.resultado
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
    });
    return () => {
      vivo = false;
      cancelAnimationFrame(frame);
      mo?.disconnect();
      cerrar();
      setRespaldo(false);
    };
  }, [fase, intento, reintento, ventanaAparte]);

  useEffect(() => {
    alFormulario?.(fase === 'formulario');
    return () => alFormulario?.(false);
  }, [fase]);

  // Sin formulario usable a los 10 s: se ofrece salida dentro del mismo recuadro (con el código para soporte)
  useEffect(() => {
    if (fase !== 'formulario' || respaldo || pasarela === 'lista') return;
    const t = setTimeout(() => {
      const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setDiagnostico(`Culqi sin respuesta · pedido ${pedidoCodigo ?? pedidoId} · ${hora}`);
      logCulqi('sin respuesta a los 10 s: se ofrece reintentar');
    }, 10000);
    return () => {
      clearTimeout(t);
      setDiagnostico(null);
    };
  }, [fase, respaldo, pasarela, reintento, ventanaAparte]);
  const reintentarCulqi = () => {
    logCulqi('reintento pedido por el cliente');
    setDiagnostico(null);
    setVentanaAparte(false);
    setPasarela('cargando');
    setReintento((n) => n + 1);
  };
  const cambiarMedioAhora = () => {
    setDiagnostico(null);
    setCambiando(true);
    setAvisoCambio('');
    setAvisoOk('');
    setFase('listo');
  };
  const copiarDiagnostico = () => {
    try {
      void navigator.clipboard.writeText(diagnostico ?? '').catch(() => {});
    } catch {
      /* sin portapapeles: el código se puede seleccionar a mano */
    }
  };
  const iniciado = useRef(false);
  useEffect(() => {
    if (auto && config?.activo && config.modo === 'REAL' && !iniciado.current) {
      iniciado.current = true;
      void pagar();
    }
  }, [auto, config]);

  // Cambiar el medio (E1): el pedido deja de ser «en línea» y pasa a cocina según el medio elegido
  const confirmarCambio = async () => {
    if (!medioNuevo) return;
    setEnviandoCambio(true);
    setAvisoCambio('');
    setAvisoOk('');
    try {
      const r = await culqiApi.cambiarMedio(pedidoId, medioNuevo, tokenSeguimiento);
      setCambiando(false);
      setMedioNuevo(null);
      setAvisoOk(r.mensaje);
      alPagado?.();
    } catch (e) {
      setAvisoCambio(e instanceof Error ? e.message : 'No pudimos cambiar el medio. Reintenta.');
    } finally {
      setEnviandoCambio(false);
    }
  };
  const bloqueCambio = (
    <div data-testid="cambio-medio" style={{ marginTop: 8, display: 'grid', gap: 8 }}>
      {!cambiando ? (
        <Boton variante="secundario" onClick={() => { setCambiando(true); setAvisoCambio(''); setAvisoOk(''); }}>
          Cambiar medio de pago
        </Boton>
      ) : (
        <>
          <span className="sg-detalle">Elige otro medio. Tu pedido pasa a cocina según el medio que elijas.</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {MEDIOS_CAMBIO.map((m) => (
              <Boton key={m.medio} variante={medioNuevo === m.medio ? 'primario' : 'secundario'} onClick={() => setMedioNuevo(m.medio)}>
                {m.nombre}
              </Boton>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Boton disabled={!medioNuevo || enviandoCambio} cargando={enviandoCambio} onClick={() => void confirmarCambio()}>
              Confirmar el cambio
            </Boton>
            <Boton variante="secundario" onClick={() => { setCambiando(false); setMedioNuevo(null); }}>
              No cambiar
            </Boton>
          </div>
        </>
      )}
      {avisoCambio && <p role="alert" style={{ color: 'var(--cp-rust)', margin: 0 }}>{avisoCambio}</p>}
      {avisoOk && <p role="status" style={{ color: 'var(--cp-navy)', fontWeight: 700, margin: 0 }}>{avisoOk}</p>}
    </div>
  );

  // Sin pago en línea disponible (apagado, caja cerrada o sin conexión): se dice, sin pantalla muerta, y puede cambiar el medio
  if (!config && !configFallo) return null;
  if (!config?.activo) {
    return (
      <section className="sg-tarjeta" aria-label="Pagar en línea" data-testid="pagar-en-linea">
        <p className="sg-detalle" style={{ margin: 0 }} data-testid="pago-no-disponible">
          Ahora no podemos cobrarte con tarjeta o Yape. Puedes elegir otro medio de pago.
        </p>
        {bloqueCambio}
      </section>
    );
  }
  if (fase === 'cargando') return <Cargando />;

  const simulado = config.modo === 'SIMULADO';
  const ocupado = fase === 'pagando';
  const enFormulario = fase === 'formulario';
  const cargandoPasarela = !simulado && pasarela === 'cargando' && !respaldo && (fase === 'pagando' || enFormulario);

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
          {!enFormulario && (
            <strong data-testid="falta-pagar" style={{ color: 'var(--cp-navy)' }}>
              {monto && monto > 0 ? `Falta pagar ${SOLES(monto)}` : 'Pagar ahora con tarjeta o Yape'}
            </strong>
          )}
          {/* cuenta regresiva sin precio: con el formulario de Culqi abierto, Culqi ya muestra el monto */}
          <CintaTiempo restanteMs={restanteMs} />
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
          {cargandoPasarela && !enFormulario && <CargaPago />}
          {ocupado && !cargandoPasarela && <p role="status" style={{ margin: '0 0 8px' }}>Procesando tu pago...</p>}
          {enFormulario ? (
            <div id="culqi-embebido" tabIndex={-1} data-testid="culqi-embebido" style={{ outline: 'none' }} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setFase('listo'); } }}>
              {/* Culqi monta aquí su formulario (iframe alojado por Culqi: la tarjeta no pasa por nuestro código) */}
              {/* Altura DEFINIDA: el iframe de Culqi mide height:100% y con solo min-height se colapsaba */}
              {respaldo && <p role="status" data-testid="culqi-respaldo" style={{ margin: 0 }}>Abriendo la ventana segura de Culqi…</p>}
              <div style={{ position: 'relative' }}>
                {cargandoPasarela && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'var(--cp-cream)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CargaPago />
                  </div>
                )}
                <div ref={anfitrion} className="sg-culqi" aria-label="Formulario de pago de Culqi" style={respaldo ? { display: 'none' } : undefined} />
              </div>
              {diagnostico && (
                <div role="alert" data-testid="culqi-ayuda" style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--cp-cream)', border: '1px solid var(--cp-sand)', display: 'grid', gap: 8 }}>
                  <strong style={{ color: 'var(--cp-navy)' }}>¿No carga el pago? Prueba otra vez</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <Boton variante="secundario" onClick={reintentarCulqi}>Reintentar</Boton>
                    <Boton variante="secundario" onClick={() => { setVentanaAparte(true); setPasarela('cargando'); }}>Abrir en ventana aparte</Boton>
                    <Boton variante="secundario" onClick={cambiarMedioAhora}>Cambiar medio de pago</Boton>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                    <code data-testid="culqi-diagnostico" className="sg-detalle" style={{ fontSize: 12, wordBreak: 'break-all', userSelect: 'all' }}>{diagnostico}</code>
                    <button type="button" onClick={copiarDiagnostico} style={{ fontSize: 12, background: 'none', border: 0, color: 'var(--cp-navy)', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Copiar código</button>
                  </div>
                </div>
              )}
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
          ) : cargandoPasarela ? null : (
            <Boton disabled={ocupado} cargando={ocupado} onClick={() => void pagar()}>
              {fase === 'rechazado' || fase === 'error' ? 'Reintentar el pago' : 'Pagar ahora'}
            </Boton>
          )}
          {intento && !enFormulario && <span className="sg-detalle" style={{ display: 'block', marginTop: 6 }}>Monto: {SOLES(intento.montoCentimos / 100)}</span>}
          {!enFormulario && !ocupado && bloqueCambio}
        </>
      )}
    </section>
  );
}

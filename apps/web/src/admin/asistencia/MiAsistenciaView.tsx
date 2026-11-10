import { useEffect, useRef, useState } from 'react';
import {
  MiHoy,
  identificadorDispositivo,
  MiPropina,
  marcarAsistencia,
  marcarManual,
  miHoy as cargarMiHoy,
  miPropinas,
  miResumen as cargarMiResumen,
  MiResumen,
} from './asistenciaApi';
import { TarjetaGanado } from './TarjetaGanado';
import { CorreccionesAsistencia, type PedidoCorreccion } from './CorreccionesAsistencia';
import { MiVacaciones } from './MiVacaciones';
import { MiCalendario } from './MiCalendario';
import { MisPagos } from './MisPagos';
import { AYUDA_ACCION, ETIQUETA_ACCION, ETIQUETA_LINEA, ORDEN_TIPOS, horasMin, normalizarTipo, sugerirSiguiente, type TipoMarcaElegido } from './tiposMarca';
import { BotonInstalarApp } from '../../pwa/BotonInstalarApp';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Insignia } from '../../comun/Insignia';
import { leerQrDeVideo, mensajeErrorCamara, pedirCamara, mensajeErrorUbicacion, pedirUbicacionTolerante } from './escanerQr';
import './asistencia.css';
import './miAsistencia.css';

const NOMBRES_PASOS = ['QR', 'Ubicación', 'Selfie', 'Confirmar'];
const INDICE_PASO: Partial<Record<Paso, number>> = { escanear: 0, ubicacion: 1, selfie: 2, confirmar: 3 };

/** Lo que el API de «hoy» agrega (contrato de la asistencia con tipos de marca); todo opcional para convivir con el API viejo. */
type HoyExt = MiHoy & {
  siguienteSugerido?: TipoMarcaElegido | null;
  almuerzoMin?: number | null;
};
const horaDe = (m: any): string => m.hora ?? horaCorta(m.momento);
const aMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Horas ganadas hoy (el almuerzo cuenta): de la primera entrada a la salida, o a ahora si sigue en el local. */
export function horasGanadasHoy(marcas: any[], ahoraHHmm: string): number | null {
  const v = marcas.filter((m) => !m.duplicada);
  const ent = v.find((m) => normalizarTipo(m.tipo) === 'ENTRADA') ?? (v[0] && normalizarTipo(v[0].tipo) === null ? v[0] : undefined);
  if (!ent) return null;
  const sal = [...v].reverse().find((m) => normalizarTipo(m.tipo) === 'SALIDA');
  const fin = aMin(sal ? horaDe(sal) : ahoraHHmm);
  const ini = aMin(horaDe(ent));
  return fin >= ini ? fin - ini : fin + 1440 - ini;
}

const horaCorta = (iso: string) => new Date(iso).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });

const MESES_TEXTO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

type Paso = 'inicio' | 'escanear' | 'ubicacion' | 'selfie' | 'confirmar' | 'listo';

const MAX_SELFIE_B64 = 200_000 * 1.37; // tamaño base64 máximo aproximado de la foto (límite del servidor: 200 KB)

const mensajeDe = (e: unknown, fallback: string): string => {
  const x = e as any;
  return x?.mensaje ?? x?.response?.mensaje ?? x?.message ?? fallback;
};

/** Foto de la cámara frontal, reducida y recomprimida en el navegador (JPEG, base64 sin prefijo). */
async function capturarSelfie(video: HTMLVideoElement): Promise<string> {
  const lado = 480;
  const escala = lado / Math.max(video.videoWidth || lado, video.videoHeight || lado);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((video.videoWidth || lado) * escala);
  canvas.height = Math.round((video.videoHeight || lado) * escala);
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  for (const calidad of [0.7, 0.5, 0.35]) {
    const url = canvas.toDataURL('image/jpeg', calidad);
    const b64 = url.slice(url.indexOf(',') + 1);
    if (b64.length <= MAX_SELFIE_B64) return b64;
  }
  throw new Error('La foto quedó muy pesada. Vuelve a tomarla con menos luz de fondo.');
}

export function MiAsistenciaView() {
  const [hoy, setHoy] = useState<MiHoy | null>(null);
  const [propinas, setPropinas] = useState<MiPropina[]>([]);
  const [resumen, setResumen] = useState<MiResumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pedido, setPedido] = useState<PedidoCorreccion | null>(null);
  const [paso, setPaso] = useState<Paso>('inicio');
  const [codigo, setCodigo] = useState('');
  const [qrTexto, setQrTexto] = useState<string | null>(null);
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number; precision: number } | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoMarcaElegido | null>(null); // «¿qué estás haciendo?»
  const [manual, setManual] = useState(false); // sin QR ni selfie: solo GPS, queda para revisión
  const [enviando, setEnviando] = useState(false);
  const [mensajeOk, setMensajeOk] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const flujo = useRef<MediaStream | null>(null);
  const [modoCamara, setModoCamara] = useState<'environment' | 'user'>('environment');
  const [variasCamaras, setVariasCamaras] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [errorUbic, setErrorUbic] = useState<string | null>(null);
  const [intentoUbic, setIntentoUbic] = useState(0);
  const [forzarUbic, setForzarUbic] = useState(false);
  const [sinFoto, setSinFoto] = useState(false); // la cámara no abrió: se marca sin selfie y queda para revisión

  const recargar = async () => {
    try {
      setHoy(await cargarMiHoy());
      // Mis propinas: solo mi parte de los repartos aprobados o pagados. Si falla, no se muestra.
      setPropinas(await miPropinas().catch(() => []));
      setResumen(await cargarMiResumen().catch(() => null));
      setError(null);
    } catch (e) {
      setError(mensajeDe(e, 'No pudimos cargar tu asistencia.'));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void recargar();
    return () => detenerCamara();
  }, []);

  function detenerCamara() {
    flujo.current?.getTracks().forEach((t) => t.stop());
    flujo.current = null;
  }

  async function abrirCamara(modo: 'environment' | 'user') {
    detenerCamara();
    const stream = await pedirCamara(modo);
    flujo.current = stream;
    if (video.current) {
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
    }
  }

  const empezar = (t: TipoMarcaElegido) => {
    setTipo(t);
    setMensajeOk(null);
    setError(null);
    setCodigo('');
    setQrTexto(null);
    setModoCamara('environment');
    setUbicacion(null);
    setSelfie(null);
    setSinFoto(false);
    setErrorUbic(null);
    setForzarUbic(false);
    setManual(false);
    setPaso('escanear');
  };

  const empezarManual = (t: TipoMarcaElegido) => {
    setTipo(t);
    setMensajeOk(null);
    setError(null);
    setUbicacion(null);
    setSelfie(null);
    setSinFoto(false);
    setErrorUbic(null);
    setForzarUbic(false);
    setManual(true);
    setPaso('ubicacion');
  };

  // Escaneo del QR: BarcodeDetector si existe; si no, jsQR. El código manual siempre queda a la vista.
  useEffect(() => {
    if (paso !== 'escanear') return;
    let activo = true;
    let parar: (() => void) | undefined;
    setErrorCamara(null);
    (async () => {
      try {
        await abrirCamara(modoCamara);
        if (!activo) return;
        navigator.mediaDevices.enumerateDevices?.()
          .then((d) => activo && setVariasCamaras(d.filter((x) => x.kind === 'videoinput').length > 1))
          .catch(() => undefined);
        if (!video.current) return;
        parar = leerQrDeVideo(video.current, (texto) => {
          setQrTexto(texto);
          setPaso('ubicacion');
        });
      } catch (e) {
        if (activo) setErrorCamara(mensajeErrorCamara(e));
      }
    })();
    return () => {
      activo = false;
      parar?.();
      detenerCamara();
    };
  }, [paso, modoCamara]);

  // Ubicación al entrar a su paso (con reintento y modo aproximado si el GPS preciso falla)
  useEffect(() => {
    if (paso !== 'ubicacion') return;
    let cancelado = false;
    setErrorUbic(null);
    pedirUbicacionTolerante(forzarUbic)
      .then((u) => {
        if (cancelado) return;
        setUbicacion(u);
        if (manual) void enviar({ u });
        else setPaso('selfie');
      })
      .catch((e) => {
        if (!cancelado) setErrorUbic(mensajeErrorUbicacion(e));
      });
    return () => {
      cancelado = true;
    };
  }, [paso, manual, intentoUbic, forzarUbic]);

  // Cámara frontal para la selfie
  useEffect(() => {
    if (paso !== 'selfie') return;
    setErrorCamara(null);
    abrirCamara('user').catch((e) => setErrorCamara(mensajeErrorCamara(e)));
    return () => detenerCamara();
  }, [paso]);

  async function tomarSelfie() {
    if (!video.current) return;
    try {
      setSelfie(await capturarSelfie(video.current));
      detenerCamara();
      setPaso('confirmar');
    } catch (e) {
      setError(mensajeDe(e, 'No pudimos tomar la foto.'));
    }
  }

  async function enviar(directo?: { u: { lat: number; lng: number; precision: number } }) {
    const u = directo?.u ?? ubicacion;
    if (!u || (!directo && !selfie && !sinFoto)) return;
    setEnviando(true);
    setError(null);
    try {
      // La persona elige qué está haciendo; si el API aún no conoce `tipo`, lo ignora y interpreta por orden.
      const r = directo
        ? await marcarManual({ lat: u.lat, lng: u.lng, precision: u.precision, ...(tipo ? { tipo } : {}) })
        : await marcarAsistencia({
            ...(tipo ? { tipo: tipo as any } : {}),
            ...(qrTexto ? { qr: qrTexto } : { codigo: codigo.replace(/\s+/g, '') }),
            lat: u.lat,
            lng: u.lng,
            precision: u.precision,
            ...(selfie ? { selfie } : { sinSelfie: true }),
            dispositivo: identificadorDispositivo(),
          });
      setMensajeOk(r.mensaje + (r.marca.estado === 'A_REVISAR' ? ' (queda para revisión del administrador)' : ''));
      setPaso('listo');
      await recargar();
    } catch (e) {
      await recargar();
      setError(mensajeDe(e, 'No se pudo registrar tu marca. Intenta otra vez.'));
      setPaso('inicio');
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <Cargando mensaje="Cargando tu asistencia…" />;
  if (!hoy) return <div role="alert" className="ma-resultado ma-resultado--error"><strong>No pudimos cargar tu asistencia</strong><span>{error ?? 'Revisa tu conexión e intenta otra vez.'}</span></div>;

  const h = hoy as HoyExt;
  const validas = h.marcas.filter((m) => !m.duplicada);
  const sugerido: TipoMarcaElegido | null = h.siguienteSugerido !== undefined
    ? h.siguienteSugerido
    : sugerirSiguiente(validas.map((m) => m.tipo));
  const sinUbicacion = hoy.localConUbicacion === false;
  const puedeMarcar = !sinUbicacion;
  const indice = INDICE_PASO[paso];
  const horaLima = new Date(hoy.ahora).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });
  const ganadoHoy = horasGanadasHoy(h.marcas, horaLima);
  const almuerzoMin = h.almuerzoMin ?? null;
  const chipTipo = tipo && <p className="ma-vas" data-testid="vas-a-marcar">Vas a marcar: <strong>{ETIQUETA_ACCION[tipo]}</strong></p>;

  return (
    <div className="ma-vista">
      <BotonInstalarApp />
      <section className="ma-estado" aria-label="Estado de hoy">
        <span className="ma-fecha">Hoy {hoy.jornada} · {horaLima}</span>
        <div data-testid="estado-hoy" className="ma-estado-txt">
          {h.marcas.length === 0
            ? <>Te falta marcar: <strong>Entrada</strong></>
            : sugerido
              ? <>Lo siguiente: <strong>{ETIQUETA_ACCION[sugerido]}</strong></>
              : <>Terminaste tu día. <strong>¡Gracias!</strong></>}
        </div>
        {hoy.turno ? (
          <div className="ma-turno">
            Tu turno: {hoy.turno.entrada} a {hoy.turno.salida}
            {hoy.turno.almuerzo ? ` (almuerzo ${hoy.turno.almuerzo})` : ''}
          </div>
        ) : (
          <div className="ma-turno">Hoy no tienes turno programado.</div>
        )}
        <div className="ma-turno" data-testid="mi-dia">
          <strong>Mi día</strong>
          {validas.length === 0
            ? <p className="ma-vas">Todavía no marcas nada hoy. Cuando llegues, marca tu entrada.</p>
            : (
              <ol className="ma-dia" aria-label="Mi día">
                {h.marcas.map((m, i) => {
                  const t = normalizarTipo(m.tipo);
                  return (
                    <li key={m.id ?? i} style={m.duplicada ? { textDecoration: 'line-through' } : undefined}>
                      <b>{horaDe(m)}</b> {t ? ETIQUETA_LINEA[t] : 'Marca'}
                      {t === 'ALMUERZO_VUELTA' && almuerzoMin != null && <small> (almuerzo {almuerzoMin} min, pagado)</small>}
                      {m.duplicada && ' (unida a la anterior)'}
                    </li>
                  );
                })}
              </ol>
            )}
          {ganadoHoy !== null && <p className="ma-vas" data-testid="horas-hoy">Horas ganadas hoy: <strong>{horasMin(ganadoHoy)}</strong> (el almuerzo cuenta)</p>}
        </div>
        {hoy.interpretacion && hoy.interpretacion.alertas.length > 0 && (
          <div role="status" className="as-aviso as-aviso--alerta">{hoy.interpretacion.alertas.join(' · ')}. Si hay un error, pide la corrección abajo.</div>
        )}
      </section>

      {sinUbicacion && (
        <div role="alert" className="as-aviso as-aviso--alerta" data-testid="aviso-sin-ubicacion">
          El administrador aún no configuró la ubicación del local. Todavía no puedes marcar; avísale.
        </div>
      )}

      {indice !== undefined && (
        <ol className="ma-pasos" aria-label="Pasos de la marca">
          {NOMBRES_PASOS.map((n, i) => (
            <li key={n} data-estado={i < indice ? 'hecho' : i === indice ? 'actual' : 'pendiente'} aria-current={i === indice ? 'step' : undefined}>
              <span>{i < indice ? '✓' : i + 1}</span>
              {n}
            </li>
          ))}
        </ol>
      )}

      {paso === 'inicio' && (
        <section className="ma-card" aria-label="¿Qué estás haciendo?">
          <h3>¿Qué estás haciendo?</h3>
          <div className="as-ayuda">Elige y escanea el QR del local. El almuerzo es opcional: puedes ir directo a la salida.</div>
          <div className="ma-acciones">
            {[...ORDEN_TIPOS].sort((a, b) => (a === sugerido ? -1 : b === sugerido ? 1 : 0)).map((t) => (
              <button
                key={t}
                type="button"
                className="ma-accion"
                data-sugerido={t === sugerido}
                disabled={!puedeMarcar || enviando}
                onClick={() => empezar(t)}
              >
                <b>{ETIQUETA_ACCION[t]}</b>
                <small>{t === sugerido ? `Sugerido · ${AYUDA_ACCION[t]}` : AYUDA_ACCION[t]}</small>
              </button>
            ))}
          </div>
          <Boton type="button" variante="texto" disabled={!puedeMarcar || enviando} onClick={() => empezarManual(sugerido ?? 'ENTRADA')}>
            Marcar manualmente (sin QR)
          </Boton>
          <p className="as-ayuda">Si no puedes escanear el QR: se usa solo tu ubicación, sin foto, y el administrador revisa tu marca{sugerido ? ` (se marcará: ${ETIQUETA_ACCION[sugerido]})` : ''}.</p>
        </section>
      )}

      {paso === 'escanear' && (
        <section className="ma-card">
          <h3>1. Escanea el QR</h3>
          {chipTipo}
          <div className="as-ayuda">Apunta la cámara al QR de la pantalla del local.</div>
          <video ref={video} muted playsInline autoPlay className="ma-video" />
          {errorCamara && <div role="alert" className="as-aviso as-aviso--alerta" data-testid="error-camara">{errorCamara}</div>}
          {variasCamaras && !errorCamara && (
            <Boton type="button" variante="secundario" onClick={() => setModoCamara((m) => (m === 'environment' ? 'user' : 'environment'))}>
              Cambiar cámara
            </Boton>
          )}
          <label className="as-campo">
            O escribe el código de 6 dígitos de la pantalla
            <input
              inputMode="numeric"
              maxLength={7}
              className="ma-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </label>
          <Boton type="button" tamano="grande" disabled={codigo.replace(/\s+/g, '').length !== 6} onClick={() => setPaso('ubicacion')}>
            Continuar
          </Boton>
          <Boton type="button" variante="texto" onClick={() => setPaso('inicio')}>Cancelar</Boton>
        </section>
      )}

      {paso === 'ubicacion' && (
        <section className="ma-card">
          <h3>2. Ubicación</h3>
          {chipTipo}
          {!errorUbic && <Cargando mensaje={forzarUbic ? 'Buscando tu ubicación aproximada…' : 'Leyendo tu ubicación…'} />}
          {errorUbic && (
            <div role="alert" className="as-aviso as-aviso--alerta" data-testid="error-ubicacion">{errorUbic}</div>
          )}
          {errorUbic && (
            <>
              <Boton type="button" tamano="grande" onClick={() => setIntentoUbic((n) => n + 1)}>Volver a pedir ubicación</Boton>
              <Boton type="button" variante="secundario" onClick={() => { setForzarUbic(true); setIntentoUbic((n) => n + 1); }}>
                Forzar ubicación aproximada
              </Boton>
              <p className="as-ayuda">«Forzar» usa la ubicación por red/WiFi cuando el GPS no responde. La marca puede quedar para revisión del administrador.</p>
            </>
          )}
          <Boton type="button" variante="texto" onClick={() => setPaso('inicio')}>Cancelar</Boton>
        </section>
      )}

      {paso === 'selfie' && (
        <section className="ma-card">
          <h3>3. Selfie</h3>
          <div className="as-ayuda">Tómate una selfie para confirmar tu marca.</div>
          <video ref={video} muted playsInline className="ma-video" />
          {errorCamara && <div role="alert" className="as-aviso as-aviso--alerta" data-testid="error-camara-selfie">{errorCamara}</div>}
          {!errorCamara && <Boton type="button" tamano="grande" onClick={() => void tomarSelfie()}>Tomar selfie</Boton>}
          {errorCamara && (
            <>
              <Boton type="button" variante="secundario" onClick={() => { setErrorCamara(null); abrirCamara('user').catch((e) => setErrorCamara(mensajeErrorCamara(e))); }}>
                Reintentar cámara
              </Boton>
              <Boton type="button" tamano="grande" onClick={() => { setSinFoto(true); setSelfie(null); setPaso('confirmar'); }}>
                Continuar sin foto
              </Boton>
              <p className="as-ayuda">Sin foto la marca queda para revisión del administrador.</p>
            </>
          )}
        </section>
      )}

      {paso === 'confirmar' && (
        <section className="ma-card">
          <h3>4. Confirmar</h3>
          <div>Confirmar mi marca de ahora: <strong>{tipo ? ETIQUETA_ACCION[tipo] : 'Marca'}</strong></div>
          {selfie && <img alt="Selfie de la marca" src={`data:image/jpeg;base64,${selfie}`} className="as-selfie" style={{ maxWidth: 140 }} />}
          <Boton type="button" tamano="grande" disabled={enviando} onClick={() => void enviar()}>
            {enviando ? 'Registrando…' : 'Confirmar marca'}
          </Boton>
          <Boton type="button" variante="texto" onClick={() => setPaso('inicio')}>Cancelar</Boton>
        </section>
      )}

      {mensajeOk && (
        <div role="status" className="ma-resultado ma-resultado--ok"><strong>Marca registrada</strong><span>{mensajeOk}</span></div>
      )}
      {error && (
        <div role="alert" className="ma-resultado ma-resultado--error"><strong>No se pudo marcar</strong><span>{error}</span></div>
      )}

      {resumen && (
        <section aria-label="Mi período" className="ma-lista">
          <h3 className="as-sub">Mi {resumen.modalidad === 'SEMANAL' ? 'semana' : 'mes'} ({resumen.periodo.desde} a {resumen.periodo.hasta})</h3>
          <div className="ma-card">
            <div>Horas programadas: <strong>{resumen.programadasH} h</strong></div>
            <div>Horas trabajadas: <strong>{resumen.trabajadasH} h</strong></div>
            <div>Tardanzas: <strong>{resumen.tardanzas}</strong>{resumen.tardanzaMin > 0 ? ` (${resumen.tardanzaMin} min)` : ''}</div>
            {resumen.faltas > 0 && <div>Faltas: <strong>{resumen.faltas}</strong></div>}
            {resumen.jornadasPorRevisar > 0 && <div>Jornadas por revisar con el administrador: <strong>{resumen.jornadasPorRevisar}</strong></div>}
          </div>
        </section>
      )}

      <CorreccionesAsistencia pedido={pedido} alAbrir={setPedido} alCerrar={() => setPedido(null)} />
      <TarjetaGanado />
      <MiVacaciones />

      {propinas.length > 0 && (
        <section aria-label="Mis propinas" className="ma-lista">
          <h3 className="as-sub">Mis propinas</h3>
          {propinas.map((p) => (
            <div key={`${p.anio}-${p.mes}`} className="ma-item">
              <span>
                <b>{MESES_TEXTO[p.mes - 1]} {p.anio}</b>
                <small>{p.horas.toFixed(2)} h · {p.porcentaje.toFixed(2)} %</small>
              </span>
              <strong>S/ {p.monto.toFixed(2)}</strong>
              <Insignia variante={p.pagadoEn ? 'exito' : 'aviso'}>{p.pagadoEn ? `Pagado (${p.pagadoMedio ?? 'sin medio'})` : 'Por pagar'}</Insignia>
            </div>
          ))}
        </section>
      )}

      <MiCalendario alPedirCorreccion={(jornada) => setPedido({ jornada })} />
      <MisPagos />
    </div>
  );
}

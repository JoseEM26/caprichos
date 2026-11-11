import { useEffect, useRef, useState } from 'react';
import { identificadorDispositivo, marcarAsistencia, marcarManual } from './asistenciaApi';
import { AYUDA_ACCION, ETIQUETA_ACCION, ORDEN_TIPOS, type TipoMarcaElegido } from './tiposMarca';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Plegable } from './Plegable';
import { leerQrDeVideo, mensajeErrorCamara, pedirCamara, mensajeErrorUbicacion, pedirUbicacionTolerante } from './escanerQr';
import './asistencia.css';
import './miAsistencia.css';

/** inicio = «¿Qué estás haciendo?»; listo = marca registrada. */
type Paso = 'inicio' | 'escanear' | 'ubicacion' | 'selfie' | 'confirmar' | 'listo';
type Punto = { lat: number; lng: number; precision: number };

const PASOS: { id: Exclude<Paso, 'listo'>; corto: string; titulo: string }[] = [
  { id: 'inicio', corto: 'Acción', titulo: '¿Qué estás haciendo?' },
  { id: 'escanear', corto: 'QR', titulo: 'Escanea el QR' },
  { id: 'ubicacion', corto: 'Ubicación', titulo: 'Tu ubicación' },
  { id: 'selfie', corto: 'Selfie', titulo: 'Tu selfie' },
  { id: 'confirmar', corto: 'Confirmar', titulo: 'Confirma tu marca' },
];
const PASOS_MANUAL = PASOS.filter((p) => p.id === 'inicio' || p.id === 'ubicacion');

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

/** Si el servidor rechaza, a qué paso hay que volver según lo que dice (el mensaje ya viene en español simple). */
export function pasoDelProblema(mensaje: string): Exclude<Paso, 'listo'> {
  if (/\bqr\b|c[oó]digo de 6|c[oó]digo.*(venci|v[aá]lido)/i.test(mensaje)) return 'escanear';
  if (/del local|ubicaci|gps|precis|se[ñn]al/i.test(mensaje)) return 'ubicacion';
  if (/foto|selfie/i.test(mensaje)) return 'selfie';
  return 'inicio';
}

const horaAhoraLima = () => new Date().toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Asistente de marcado: UNA parte a la vez (acción → QR → ubicación → selfie → confirmar).
 * Atrás no pierde lo hecho (QR, ubicación, selfie quedan en estado). `activo` = la pestaña está a la vista:
 * si no, la cámara se apaga y el GPS no se pide (el estado se conserva).
 */
export function MarcarAsistente({ sugerido, puedeMarcar, activo, alRegistrar }: {
  sugerido: TipoMarcaElegido | null;
  puedeMarcar: boolean;
  activo: boolean;
  alRegistrar: () => Promise<void>;
}) {
  const [paso, setPaso] = useState<Paso>('inicio');
  const [tipo, setTipo] = useState<TipoMarcaElegido | null>(null);
  const [codigo, setCodigo] = useState('');
  const [qrTexto, setQrTexto] = useState<string | null>(null);
  const [ubicacion, setUbicacion] = useState<Punto | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [sinFoto, setSinFoto] = useState(false); // la cámara no abrió: se marca sin selfie y queda para revisión
  const [manual, setManual] = useState(false); // sin QR ni selfie: solo GPS, queda para revisión
  const [enviando, setEnviando] = useState(false);
  const [mensajeOk, setMensajeOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [errorUbic, setErrorUbic] = useState<string | null>(null);
  const [intentoUbic, setIntentoUbic] = useState(0);
  const [forzarUbic, setForzarUbic] = useState(false);
  const [modoCamara, setModoCamara] = useState<'environment' | 'user'>('environment');
  const [variasCamaras, setVariasCamaras] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);
  const flujo = useRef<MediaStream | null>(null);

  const codigoLimpio = codigo.replace(/\s+/g, '');
  const codigoValido = codigoLimpio.length === 6;

  function detenerCamara() {
    flujo.current?.getTracks().forEach((t) => t.stop());
    flujo.current = null;
  }
  useEffect(() => () => detenerCamara(), []);

  async function abrirCamara(modo: 'environment' | 'user') {
    detenerCamara();
    const stream = await pedirCamara(modo);
    flujo.current = stream;
    if (video.current) {
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
    }
  }

  const limpiarTodo = () => {
    setCodigo('');
    setQrTexto(null);
    setUbicacion(null);
    setSelfie(null);
    setSinFoto(false);
    setErrorUbic(null);
    setErrorCamara(null);
    setForzarUbic(false);
    setModoCamara('environment');
  };

  /** Navegar a mano limpia el aviso de error anterior; lo hecho (QR, ubicación, selfie) se conserva. */
  const ir = (p: Paso) => { setError(null); setPaso(p); };

  const elegir = (t: TipoMarcaElegido) => {
    setMensajeOk(null);
    setError(null);
    if (t !== tipo || manual || paso === 'listo') { limpiarTodo(); setManual(false); }
    setTipo(t);
    setPaso('escanear');
  };

  const empezarManual = () => {
    setMensajeOk(null);
    setError(null);
    limpiarTodo();
    setTipo(tipo ?? sugerido ?? 'ENTRADA');
    setManual(true);
    setPaso('ubicacion');
  };

  // Escaneo del QR: BarcodeDetector si existe; si no, jsQR. El código manual siempre queda a la vista.
  useEffect(() => {
    if (paso !== 'escanear' || !activo || qrTexto) return;
    let vivo = true;
    let parar: (() => void) | undefined;
    setErrorCamara(null);
    (async () => {
      try {
        await abrirCamara(modoCamara);
        if (!vivo) return;
        navigator.mediaDevices.enumerateDevices?.()
          .then((d) => vivo && setVariasCamaras(d.filter((x) => x.kind === 'videoinput').length > 1))
          .catch(() => undefined);
        if (!video.current) return;
        parar = leerQrDeVideo(video.current, (texto) => {
          setQrTexto(texto);
          setPaso('ubicacion');
        });
      } catch (e) {
        if (vivo) setErrorCamara(mensajeErrorCamara(e));
      }
    })();
    return () => {
      vivo = false;
      parar?.();
      detenerCamara();
    };
  }, [paso, modoCamara, activo, qrTexto]);

  // Ubicación al entrar a su paso, solo si aún no la tenemos (con reintento y modo aproximado si el GPS preciso falla)
  useEffect(() => {
    if (paso !== 'ubicacion' || !activo || ubicacion) return;
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
  }, [paso, manual, intentoUbic, forzarUbic, activo, ubicacion]);

  // Cámara frontal para la selfie (si ya hay foto o se eligió seguir sin ella, no se abre)
  useEffect(() => {
    if (paso !== 'selfie' || !activo || selfie || sinFoto) return;
    setErrorCamara(null);
    abrirCamara('user').catch((e) => setErrorCamara(mensajeErrorCamara(e)));
    return () => detenerCamara();
  }, [paso, activo, selfie, sinFoto]);

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

  async function enviar(directo?: { u: Punto }) {
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
            ...(qrTexto ? { qr: qrTexto } : { codigo: codigoLimpio }),
            lat: u.lat,
            lng: u.lng,
            precision: u.precision,
            ...(selfie ? { selfie } : { sinSelfie: true }),
            dispositivo: identificadorDispositivo(),
          });
      setMensajeOk(r.mensaje + (r.marca.estado === 'A_REVISAR' ? ' (queda para revisión del administrador)' : ''));
      setPaso('listo');
      await alRegistrar();
    } catch (e) {
      await alRegistrar();
      const msg = mensajeDe(e, 'No se pudo registrar tu marca. Intenta otra vez.');
      setError(msg);
      // Vuelve al paso del problema y limpia solo lo que falló (lo demás se conserva)
      const destino = manual ? 'inicio' : pasoDelProblema(msg); // en manual solo hay dos pasos
      if (manual) setUbicacion(null);
      if (destino === 'escanear') { setQrTexto(null); setCodigo(''); }
      // la ubicación se conserva: se vuelve a leer solo si la persona pulsa «Leer otra vez» (evita un bucle de reintentos)
      if (destino === 'selfie') { setSelfie(null); setSinFoto(false); }
      setPaso(destino);
    } finally {
      setEnviando(false);
    }
  }

  const lista = manual ? PASOS_MANUAL : PASOS;
  const indice = lista.findIndex((p) => p.id === paso);
  const actual = indice >= 0 ? lista[indice] : null;
  const chipTipo = tipo && <p className="ma-vas" data-testid="vas-a-marcar">Vas a marcar: <strong>{ETIQUETA_ACCION[tipo]}</strong></p>;

  /** Qué falta para pasar al siguiente (null = nada). Se muestra junto al campo y en el aviso del pie. */
  const falta: string | null =
    paso === 'inicio' ? (tipo ? null : 'Falta elegir qué estás haciendo.')
    : paso === 'escanear' ? (qrTexto || codigoValido ? null : 'Falta escanear el QR o escribir los 6 números de la pantalla.')
    : paso === 'ubicacion' ? (ubicacion ? null : errorUbic ? 'Falta tu ubicación: permite el GPS o usa los botones de arriba.' : 'Falta tu ubicación: espera un momento mientras la leemos.')
    : paso === 'selfie' ? (selfie || sinFoto ? null : 'Falta tu selfie: toma la foto o, si la cámara no abre, continúa sin foto.')
    : null;

  const siguiente = () => {
    if (falta) return;
    if (paso === 'inicio') ir('escanear');
    else if (paso === 'escanear') ir('ubicacion');
    else if (paso === 'ubicacion') ir('selfie');
    else if (paso === 'selfie') ir('confirmar');
  };
  const atras = () => {
    if (paso === 'escanear') ir('inicio');
    else if (paso === 'ubicacion') ir(manual ? 'inicio' : 'escanear');
    else if (paso === 'selfie') ir('ubicacion');
    else if (paso === 'confirmar') ir('selfie');
  };

  const pie = actual && !(paso === 'inicio' && !tipo) && (
    <div className="ma-pie">
      {falta && <p className="ma-falta" id="ma-falta" role="note" data-testid="ma-falta">{falta}</p>}
      <div className="ma-pie-botones">
        {paso !== 'inicio'
          ? <Boton type="button" variante="secundario" onClick={atras} disabled={enviando}>Atrás</Boton>
          : <span />}
        {paso === 'confirmar'
          ? <Boton type="button" tamano="grande" disabled={enviando} onClick={() => void enviar()}>{enviando ? 'Registrando…' : 'Confirmar marca'}</Boton>
          : !(paso === 'ubicacion' && manual) && (
            <Boton type="button" disabled={Boolean(falta)} aria-describedby={falta ? 'ma-falta' : undefined} onClick={siguiente}>Siguiente</Boton>
          )}
      </div>
    </div>
  );

  return (
    <section className="ma-card ma-asistente" aria-label="Marcar mi asistencia" data-testid="asistente-marcado">
      {actual && (
        <>
          <div className="ma-progreso-cab">
            <span className="ma-paso-n">Paso {indice + 1} de {lista.length}</span>
            <progress className="ma-progreso" max={lista.length} value={indice + 1} aria-label={`Progreso del marcado: paso ${indice + 1} de ${lista.length}`} />
          </div>
          <ol className="ma-pasos" aria-label="Pasos de la marca">
            {lista.map((p, i) => (
              <li key={p.id} data-estado={i < indice ? 'hecho' : i === indice ? 'actual' : 'pendiente'} aria-current={i === indice ? 'step' : undefined}>
                <span>{i < indice ? '✓' : i + 1}</span>
                {p.corto}
              </li>
            ))}
          </ol>
          {manual && <p className="as-ayuda">Sin QR ni selfie: no son necesarios en este modo. Solo se usa tu ubicación y el administrador revisa tu marca.</p>}
          <div className="ma-sr" aria-live="polite" data-testid="ma-anuncio">Paso {indice + 1} de {lista.length}: {actual.titulo}</div>
        </>
      )}

      {error && (
        <div role="alert" className="ma-resultado ma-resultado--error" data-testid="ma-error"><strong>No se pudo marcar</strong><span>{error}</span></div>
      )}

      {paso === 'inicio' && (
        <>
          <h3>¿Qué estás haciendo?</h3>
          <div className="as-ayuda">Elige y escanea el QR del local.</div>
          <div className="ma-acciones">
            {[...ORDEN_TIPOS].sort((a, b) => (a === sugerido ? -1 : b === sugerido ? 1 : 0)).map((t) => (
              <button
                key={t}
                type="button"
                className="ma-accion"
                data-sugerido={t === sugerido}
                aria-pressed={t === tipo ? true : undefined}
                disabled={!puedeMarcar || enviando}
                onClick={() => elegir(t)}
              >
                <b>{ETIQUETA_ACCION[t]}</b>
                <small>{t === sugerido ? `Sugerido · ${AYUDA_ACCION[t]}` : AYUDA_ACCION[t]}</small>
              </button>
            ))}
          </div>
          <Boton type="button" variante="texto" disabled={!puedeMarcar || enviando} onClick={empezarManual}>
            Marcar manualmente (sin QR)
          </Boton>
          <Plegable titulo="¿Cuándo marco manualmente?">
            <p className="as-ayuda">El almuerzo es opcional: puedes ir directo a la salida. Si no puedes escanear el QR, se usa solo tu ubicación, sin foto, y el administrador revisa tu marca{sugerido ? ` (se marcará: ${ETIQUETA_ACCION[sugerido]})` : ''}.</p>
          </Plegable>
        </>
      )}

      {paso === 'escanear' && (
        <>
          <h3>Escanea el QR</h3>
          {chipTipo}
          {qrTexto ? (
            <div role="status" className="as-aviso as-aviso--ok" data-testid="qr-leido">QR leído. Ya puedes seguir.</div>
          ) : (
            <>
              <div className="as-ayuda">Apunta la cámara al QR de la pantalla del local.</div>
              <video ref={video} muted playsInline autoPlay className="ma-video" />
              {errorCamara && <div role="alert" className="as-aviso as-aviso--alerta" data-testid="error-camara">{errorCamara}</div>}
              {variasCamaras && !errorCamara && (
                <Boton type="button" variante="secundario" onClick={() => setModoCamara((m) => (m === 'environment' ? 'user' : 'environment'))}>
                  Cambiar cámara
                </Boton>
              )}
            </>
          )}
          {qrTexto
            ? <Boton type="button" variante="secundario" onClick={() => setQrTexto(null)}>Escanear otra vez</Boton>
            : (
              <label className="as-campo">
                O escribe el código de 6 dígitos de la pantalla
                <input
                  inputMode="numeric"
                  maxLength={7}
                  className="ma-codigo"
                  value={codigo}
                  aria-describedby={falta ? 'ma-falta' : undefined}
                  onChange={(e) => setCodigo(e.target.value)}
                />
              </label>
            )}
        </>
      )}

      {paso === 'ubicacion' && (
        <>
          <h3>Tu ubicación</h3>
          {chipTipo}
          {ubicacion && !manual && (
            <>
              <div role="status" className="as-aviso as-aviso--ok" data-testid="ubicacion-leida">Ubicación leída (precisión de {Math.round(ubicacion.precision)} m).</div>
              <Boton type="button" variante="secundario" onClick={() => { setUbicacion(null); setIntentoUbic((n) => n + 1); }}>Leer otra vez</Boton>
            </>
          )}
          {!ubicacion && !errorUbic && <Cargando mensaje={forzarUbic ? 'Buscando tu ubicación aproximada…' : 'Leyendo tu ubicación…'} />}
          {!ubicacion && errorUbic && (
            <>
              <div role="alert" className="as-aviso as-aviso--alerta" data-testid="error-ubicacion">{errorUbic}</div>
              <Boton type="button" tamano="grande" onClick={() => setIntentoUbic((n) => n + 1)}>Volver a pedir ubicación</Boton>
              <Boton type="button" variante="secundario" onClick={() => { setForzarUbic(true); setIntentoUbic((n) => n + 1); }}>
                Forzar ubicación aproximada
              </Boton>
              <Plegable titulo="¿Qué hace «forzar»?">
                <p className="as-ayuda">«Forzar» usa la ubicación por red/WiFi cuando el GPS no responde. La marca puede quedar para revisión del administrador.</p>
              </Plegable>
            </>
          )}
        </>
      )}

      {paso === 'selfie' && (
        <>
          <h3>Tu selfie</h3>
          <div className="as-ayuda">Tómate una selfie para confirmar tu marca.</div>
          {selfie ? (
            <>
              <img alt="Selfie tomada" src={`data:image/jpeg;base64,${selfie}`} className="as-selfie ma-miniatura" />
              <Boton type="button" variante="secundario" onClick={() => setSelfie(null)}>Repetir selfie</Boton>
            </>
          ) : sinFoto ? (
            <>
              <div role="status" className="as-aviso as-aviso--alerta" data-testid="sin-foto">Seguirás sin foto: la marca queda para revisión del administrador.</div>
              <Boton type="button" variante="secundario" onClick={() => setSinFoto(false)}>Intentar con la cámara</Boton>
            </>
          ) : (
            <>
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
            </>
          )}
        </>
      )}

      {paso === 'confirmar' && (
        <>
          <h3>Confirma tu marca</h3>
          <dl className="ma-resumen" data-testid="resumen-marca">
            <div><dt>Marca</dt><dd>{tipo ? ETIQUETA_ACCION[tipo] : 'Marca'}</dd></div>
            <div><dt>Hora</dt><dd>{horaAhoraLima()}</dd></div>
            <div><dt>QR</dt><dd>{qrTexto ? 'Leído' : 'Código escrito'}</dd></div>
            <div><dt>Ubicación</dt><dd>{ubicacion ? `leída (± ${Math.round(ubicacion.precision)} m)` : 'sin leer'}</dd></div>
            <div>
              <dt>Selfie</dt>
              <dd>{selfie ? <img alt="Selfie de la marca" src={`data:image/jpeg;base64,${selfie}`} className="as-selfie ma-miniatura" /> : 'Sin foto (queda para revisión)'}</dd>
            </div>
          </dl>
          <p className="as-ayuda">Confirmar mi marca de ahora: <strong>{tipo ? ETIQUETA_ACCION[tipo] : 'Marca'}</strong></p>
        </>
      )}

      {paso === 'listo' && (
        <>
          {mensajeOk && <div role="status" className="ma-resultado ma-resultado--ok"><strong>Marca registrada</strong><span>{mensajeOk}</span></div>}
          <Boton type="button" variante="secundario" onClick={() => { limpiarTodo(); setManual(false); setTipo(null); setMensajeOk(null); setPaso('inicio'); }}>Hacer otra marca</Boton>
        </>
      )}

      {paso === 'ubicacion' && manual && enviando && <Cargando mensaje="Registrando tu marca…" />}
      {pie}
    </section>
  );
}

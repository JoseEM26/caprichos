import { useEffect, useRef, useState } from 'react';
import {
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO,
  MiHoy,
  TipoMarca,
  identificadorDispositivo,
  MiPropina,
  marcarAsistencia,
  miHistorial,
  miHoy as cargarMiHoy,
  miPropinas,
} from './asistenciaApi';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { leerQrDeVideo, mensajeErrorCamara, pedirCamara } from './escanerQr';
import './asistencia.css';

const VARIANTE_ESTADO: Record<string, VarianteInsignia> = {
  CUMPLIO: 'exito', TARDANZA: 'aviso', SALIO_ANTES: 'aviso', SALIO_DESPUES: 'neutro',
  FALTA: 'peligro', INCOMPLETO: 'peligro', A_REVISAR: 'acento', DESCANSO: 'neutro', SIN_EVALUAR: 'neutro',
};
const NOMBRES_PASOS = ['QR', 'Ubicación', 'Selfie', 'Confirmar'];
const INDICE_PASO: Partial<Record<Paso, number>> = { escanear: 0, ubicacion: 1, selfie: 2, confirmar: 3 };

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

function pedirUbicacion(): Promise<{ lat: number; lng: number; precision: number }> {
  return new Promise((resolver, rechazar) => {
    if (!navigator.geolocation) return rechazar(new Error('Este celular no permite ubicación.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }),
      () => rechazar(new Error('Activa la ubicación del celular y da permiso al navegador.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export function MiAsistenciaView() {
  const [hoy, setHoy] = useState<MiHoy | null>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [propinas, setPropinas] = useState<MiPropina[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoMarca | null>(null);
  const [paso, setPaso] = useState<Paso>('inicio');
  const [codigo, setCodigo] = useState('');
  const [qrTexto, setQrTexto] = useState<string | null>(null);
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number; precision: number } | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [aceptaConsent, setAceptaConsent] = useState(false);
  const [aceptadoEnSesion, setAceptadoEnSesion] = useState(false);
  const [verAviso, setVerAviso] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensajeOk, setMensajeOk] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const flujo = useRef<MediaStream | null>(null);
  const [modoCamara, setModoCamara] = useState<'environment' | 'user'>('environment');
  const [variasCamaras, setVariasCamaras] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);

  const recargar = async () => {
    try {
      const [h, hist] = await Promise.all([cargarMiHoy(), miHistorial(7)]);
      setHoy(h);
      setHistorial(hist);
      // Mis propinas: solo mi parte de los repartos aprobados o pagados. Si falla, no se muestra.
      setPropinas(await miPropinas().catch(() => []));
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

  const empezar = (t: TipoMarca) => {
    setTipo(t);
    setMensajeOk(null);
    setError(null);
    setCodigo('');
    setQrTexto(null);
    setModoCamara('environment');
    setUbicacion(null);
    setSelfie(null);
    setPaso('escanear');
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

  // Ubicación al entrar a su paso
  useEffect(() => {
    if (paso !== 'ubicacion') return;
    let cancelado = false;
    pedirUbicacion()
      .then((u) => {
        if (cancelado) return;
        setUbicacion(u);
        setPaso('selfie');
      })
      .catch((e) => {
        if (!cancelado) setError(mensajeDe(e, 'No pudimos leer tu ubicación.'));
      });
    return () => {
      cancelado = true;
    };
  }, [paso]);

  // Cámara frontal para la selfie
  useEffect(() => {
    if (paso !== 'selfie') return;
    abrirCamara('user').catch((e) => setError(mensajeErrorCamara(e)));
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

  async function enviar() {
    if (!tipo || !ubicacion || !selfie) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await marcarAsistencia({
        tipo,
        ...(qrTexto ? { qr: qrTexto } : { codigo: codigo.replace(/\s+/g, '') }),
        lat: ubicacion.lat,
        lng: ubicacion.lng,
        precision: ubicacion.precision,
        selfie,
        dispositivo: identificadorDispositivo(),
        consentimiento: hoy?.consentimiento ? aceptaConsent : undefined,
      });
      setMensajeOk(r.mensaje + (r.marca.estado === 'A_REVISAR' ? ' (queda para revisión del administrador)' : ''));
      setPaso('listo');
      await recargar();
    } catch (e) {
      const x = e as any;
      const codigo = x?.codigo ?? x?.response?.codigo;
      // El servidor guarda el aviso aceptado aunque la marca se rechace: se recarga para no volver a pedirlo.
      if (codigo !== 'CONSENTIMIENTO_REQUERIDO') {
        if (aceptaConsent) setAceptadoEnSesion(true);
        await recargar();
      }
      setError(mensajeDe(e, 'No se pudo registrar tu marca. Intenta otra vez.'));
      setPaso('inicio');
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <Cargando mensaje="Cargando tu asistencia…" />;
  if (!hoy) return <div role="alert" className="ma-resultado ma-resultado--error"><strong>No pudimos cargar tu asistencia</strong><span>{error ?? 'Revisa tu conexión e intenta otra vez.'}</span></div>;

  const pendiente = hoy.pendiente;
  const faltaConsent = hoy.consentimiento !== null && !hoy.consentimientoAceptado && !aceptadoEnSesion;
  const puedeMarcar = (pendiente !== null || hoy.permitidas.length > 0) && (!faltaConsent || aceptaConsent);
  const indice = INDICE_PASO[paso];
  const horaLima = new Date(hoy.ahora).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="ma-vista">
      <section className="ma-estado" aria-label="Estado de hoy">
        <span className="ma-fecha">Hoy {hoy.jornada} · {horaLima}</span>
        <div data-testid="estado-hoy" className="ma-estado-txt">
          {pendiente ? <>Te falta marcar: <strong>{ETIQUETA_TIPO[pendiente]}</strong></> : 'Hoy ya no tienes marcas pendientes'}
        </div>
        {hoy.turno ? (
          <div className="ma-turno">
            Tu turno: {hoy.turno.entrada} a {hoy.turno.salida}
            {hoy.turno.almuerzo ? ` (almuerzo ${hoy.turno.almuerzo})` : ''}
          </div>
        ) : (
          <div className="ma-turno">Hoy no tienes turno programado.</div>
        )}
        {hoy.marcas.length > 0 && (
          <div className="ma-marcas">
            {hoy.marcas.map((m: any, i: number) => (
              <Insignia key={m.id ?? i} variante="exito">{ETIQUETA_TIPO[m.tipo as TipoMarca] ?? m.tipo}</Insignia>
            ))}
          </div>
        )}
      </section>

      {faltaConsent && hoy.consentimiento && (
        <label className="ma-consent">
          <span>{hoy.consentimiento.texto}</span>
          <span className="ma-check">
            <input type="checkbox" checked={aceptaConsent} onChange={(e) => setAceptaConsent(e.target.checked)} /> Acepto el tratamiento de mis datos para el control de asistencia.
          </span>
        </label>
      )}

      {!faltaConsent && hoy.consentimientoAceptado && hoy.consentimientoAceptadoEn && (
        <p className="as-ayuda" data-testid="aviso-aceptado">
          Aceptaste el aviso de datos el {new Date(hoy.consentimientoAceptadoEn).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}.{' '}
          <button type="button" className="ma-enlace" onClick={() => setVerAviso((v) => !v)}>{verAviso ? 'Ocultar aviso' : 'Ver aviso'}</button>
          {verAviso && <span> {hoy.textoConsentimiento}</span>}
        </p>
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
        <>
          <button
            type="button"
            className="ma-grande"
            disabled={!puedeMarcar || enviando}
            onClick={() => empezar(pendiente ?? hoy.permitidas[0])}
          >
            {pendiente ? 'Escanear QR' : 'Marcar'}
          </button>
          {hoy.permitidas.length > 1 && (
            <div className="ma-otras">
              {hoy.permitidas
                .filter((t) => t !== pendiente)
                .map((t) => (
                  <Boton key={t} type="button" variante="secundario" disabled={!puedeMarcar} onClick={() => empezar(t)}>
                    {ETIQUETA_TIPO[t]}
                  </Boton>
                ))}
            </div>
          )}
          {faltaConsent && !aceptaConsent && <p className="as-ayuda">Acepta el aviso de datos para poder marcar.</p>}
        </>
      )}

      {paso === 'escanear' && (
        <section className="ma-card">
          <h3>1. Escanea el QR</h3>
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
          <Cargando mensaje="Leyendo tu ubicación precisa…" />
          {error && <Boton type="button" variante="texto" onClick={() => setPaso('inicio')}>Cancelar</Boton>}
        </section>
      )}

      {paso === 'selfie' && (
        <section className="ma-card">
          <h3>3. Selfie</h3>
          <div className="as-ayuda">Tómate una selfie para confirmar tu marca.</div>
          <video ref={video} muted playsInline className="ma-video" />
          <Boton type="button" tamano="grande" onClick={() => void tomarSelfie()}>Tomar selfie</Boton>
        </section>
      )}

      {paso === 'confirmar' && tipo && (
        <section className="ma-card">
          <h3>4. Confirmar</h3>
          <div>Confirmar: <strong>{ETIQUETA_TIPO[tipo]}</strong></div>
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

      <section aria-label="Historial de los últimos días" className="ma-lista">
        <h3 className="as-sub">Últimos días</h3>
        {historial.length === 0 && <p className="as-ayuda">Aún no tienes días registrados.</p>}
        {historial.map((d) => (
          <div key={d.jornada} className="ma-item">
            <b>{d.jornada}</b>
            <Insignia variante={VARIANTE_ESTADO[d.estado] ?? 'neutro'}>{ETIQUETA_ESTADO[d.estado] ?? d.estado}</Insignia>
          </div>
        ))}
      </section>
    </div>
  );
}

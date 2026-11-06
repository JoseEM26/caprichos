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
  const [enviando, setEnviando] = useState(false);
  const [mensajeOk, setMensajeOk] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const flujo = useRef<MediaStream | null>(null);

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
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: modo }, audio: false });
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
    setUbicacion(null);
    setSelfie(null);
    setPaso('escanear');
  };

  // Escaneo con BarcodeDetector cuando el navegador lo trae; si no, código manual.
  useEffect(() => {
    if (paso !== 'escanear') return;
    const Detector = (window as any).BarcodeDetector;
    let activo = true;
    let intervalo: ReturnType<typeof setInterval> | undefined;
    (async () => {
      try {
        await abrirCamara('environment');
        if (!Detector || !video.current) return;
        const det = new Detector({ formats: ['qr_code'] });
        intervalo = setInterval(async () => {
          if (!activo || !video.current) return;
          const codigos = await det.detect(video.current).catch(() => []);
          if (codigos.length && activo) {
            setQrTexto(codigos[0].rawValue);
            setPaso('ubicacion');
          }
        }, 400);
      } catch {
        // Sin cámara: queda el código manual
      }
    })();
    return () => {
      activo = false;
      if (intervalo) clearInterval(intervalo);
      detenerCamara();
    };
  }, [paso]);

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
    abrirCamara('user').catch(() => setError('No pudimos abrir la cámara. Revisa el permiso del navegador.'));
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
      setError(mensajeDe(e, 'No se pudo registrar tu marca. Intenta otra vez.'));
      setPaso('inicio');
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <div role="status">Cargando tu asistencia…</div>;
  if (!hoy) return <div role="alert">{error ?? 'No pudimos cargar tu asistencia.'}</div>;

  const pendiente = hoy.pendiente;
  const faltaConsent = hoy.consentimiento !== null && !hoy.consentimientoAceptado;
  const puedeMarcar = (pendiente !== null || hoy.permitidas.length > 0) && (!faltaConsent || aceptaConsent);

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 520, margin: '0 auto', padding: 16 }}>
      <h2 style={{ margin: 0 }}>Mi asistencia</h2>
      <div data-testid="estado-hoy" style={{ fontSize: 18 }}>
        {pendiente ? <>Te falta marcar: <strong>{ETIQUETA_TIPO[pendiente]}</strong></> : 'Hoy ya no tienes marcas pendientes'}
      </div>
      {hoy.turno && (
        <div style={{ fontSize: 14 }}>
          Tu turno: {hoy.turno.entrada} a {hoy.turno.salida}
          {hoy.turno.almuerzo ? ` (almuerzo ${hoy.turno.almuerzo})` : ''}
        </div>
      )}
      {!hoy.turno && <div style={{ fontSize: 14 }}>Hoy no tienes turno programado.</div>}

      {faltaConsent && hoy.consentimiento && (
        <label style={{ display: 'grid', gap: 8, padding: 12, border: '1px solid #ccc', borderRadius: 8 }}>
          <span>{hoy.consentimiento.texto}</span>
          <span>
            <input type="checkbox" checked={aceptaConsent} onChange={(e) => setAceptaConsent(e.target.checked)} /> Acepto el tratamiento de mis datos para el control de asistencia.
          </span>
        </label>
      )}

      {paso === 'inicio' && (
        <>
          <button
            type="button"
            disabled={!puedeMarcar || enviando}
            onClick={() => empezar(pendiente ?? hoy.permitidas[0])}
            style={{ padding: '24px 16px', fontSize: 22, borderRadius: 16, width: '100%' }}
          >
            {pendiente ? `Marcar ${ETIQUETA_TIPO[pendiente]}` : 'Marcar'}
          </button>
          {hoy.permitidas.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {hoy.permitidas
                .filter((t) => t !== pendiente)
                .map((t) => (
                  <button key={t} type="button" disabled={!puedeMarcar} onClick={() => empezar(t)}>
                    {ETIQUETA_TIPO[t]}
                  </button>
                ))}
            </div>
          )}
        </>
      )}

      {paso === 'escanear' && (
        <section style={{ display: 'grid', gap: 8 }}>
          <div>Apunta la cámara al QR de la pantalla del local.</div>
          <video ref={video} muted playsInline style={{ width: '100%', borderRadius: 8 }} />
          <label>
            O escribe el código de 6 dígitos de la pantalla
            <input
              inputMode="numeric"
              maxLength={7}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              style={{ display: 'block', fontSize: 24, width: '100%' }}
            />
          </label>
          <button type="button" disabled={codigo.replace(/\s+/g, '').length !== 6} onClick={() => setPaso('ubicacion')}>
            Continuar
          </button>
          <button type="button" onClick={() => setPaso('inicio')}>Cancelar</button>
        </section>
      )}

      {paso === 'ubicacion' && <div role="status">Leyendo tu ubicación precisa…</div>}

      {paso === 'selfie' && (
        <section style={{ display: 'grid', gap: 8 }}>
          <div>Tómate una selfie para confirmar tu marca.</div>
          <video ref={video} muted playsInline style={{ width: '100%', borderRadius: 8 }} />
          <button type="button" onClick={() => void tomarSelfie()}>Tomar selfie</button>
        </section>
      )}

      {paso === 'confirmar' && tipo && (
        <section style={{ display: 'grid', gap: 8 }}>
          <div>Confirmar: <strong>{ETIQUETA_TIPO[tipo]}</strong></div>
          {selfie && <img alt="Selfie de la marca" src={`data:image/jpeg;base64,${selfie}`} style={{ width: 120, borderRadius: 8 }} />}
          <button type="button" disabled={enviando} onClick={() => void enviar()} style={{ padding: 16, fontSize: 18 }}>
            {enviando ? 'Registrando…' : 'Confirmar marca'}
          </button>
          <button type="button" onClick={() => setPaso('inicio')}>Cancelar</button>
        </section>
      )}

      {mensajeOk && <div role="status">{mensajeOk}</div>}
      {error && <div role="alert">{error}</div>}

      {propinas.length > 0 && (
        <section aria-label="Mis propinas" style={{ display: 'grid', gap: 6 }}>
          <h3 style={{ margin: 0 }}>Mis propinas</h3>
          {propinas.map((p) => (
            <div key={`${p.anio}-${p.mes}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, gap: 8 }}>
              <span>{MESES_TEXTO[p.mes - 1]} {p.anio}</span>
              <span>{p.horas.toFixed(2)} h · {p.porcentaje.toFixed(2)} %</span>
              <strong>S/ {p.monto.toFixed(2)}</strong>
              <span>{p.pagadoEn ? `Pagado (${p.pagadoMedio ?? 'sin medio'})` : 'Por pagar'}</span>
            </div>
          ))}
        </section>
      )}

      <section aria-label="Historial de los últimos días" style={{ display: 'grid', gap: 6 }}>
        <h3 style={{ margin: 0 }}>Últimos días</h3>
        {historial.map((d) => (
          <div key={d.jornada} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span>{d.jornada}</span>
            <span>{ETIQUETA_ESTADO[d.estado] ?? d.estado}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorApi } from '../../comun/api';
import './asistencia.css';
import { pantallaQr, pantallaQrPublica, QrPantalla } from './asistenciaApi';

/** Ya corre como app instalada (Chrome/Edge/Android o iOS). */
const instalada = () =>
  (typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches)) ||
  (navigator as any).standalone === true;

/** Cambia el manifest y el tema solo mientras la pantalla pública está montada; después restaura los de la PWA general. */
function useManifestPantalla(token?: string) {
  useEffect(() => {
    if (token === undefined) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]') ?? document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'manifest' }));
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]') ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color' }));
    const antes = { href: link.getAttribute('href'), tema: meta.getAttribute('content'), titulo: document.title };
    link.setAttribute('href', `/carta/asistencia-pantalla/${encodeURIComponent(token)}/manifest.webmanifest`);
    meta.setAttribute('content', '#0B2C3E');
    document.title = 'QR Asistencia';
    return () => {
      if (antes.href === null) link.removeAttribute('href');
      else link.setAttribute('href', antes.href);
      if (antes.tema === null) meta.removeAttribute('content');
      else meta.setAttribute('content', antes.tema);
      document.title = antes.titulo;
    };
  }, [token]);
}

/** Botón «Instalar app»: beforeinstallprompt donde exista; si no, ayuda con los pasos del navegador. */
function BotonInstalar() {
  const [evento, setEvento] = useState<any>(null);
  const [ayuda, setAyuda] = useState(false);
  const [oculto, setOculto] = useState(instalada);

  useEffect(() => {
    const alPedir = (e: Event) => {
      e.preventDefault();
      setEvento(e);
    };
    const alInstalar = () => setOculto(true);
    window.addEventListener('beforeinstallprompt', alPedir);
    window.addEventListener('appinstalled', alInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', alPedir);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  if (oculto) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const pulsar = async () => {
    if (!evento) return setAyuda(true);
    await evento.prompt();
    setEvento(null);
  };
  return (
    <div className="pa-instalar">
      <button type="button" className="pa-instalar__btn" onClick={() => void pulsar()}>
        Instalar app QR Asistencia
      </button>
      {ayuda && (
        <p role="note" className="pa-instalar__ayuda">
          {ios
            ? 'Toca Compartir y luego Añadir a pantalla de inicio.'
            : 'En el menú del navegador (⋮) elige «Instalar app» o «Añadir a pantalla de inicio».'}
        </p>
      )}
    </div>
  );
}

/**
 * Pantalla fija del local: muestra el QR de asistencia y lo renueva cada ranura de 30 s.
 * Admin (con sesión) o pública (`token`: enlace secreto, sin sesión, a pantalla completa).
 * La hora de referencia es la del servidor (offset al cargar), así la cuenta regresiva no depende del reloj del equipo.
 */
export function PantallaAsistenciaView({ token }: { token?: string } = {}) {
  const publica = token !== undefined;
  useManifestPantalla(token);
  const [qr, setQr] = useState<QrPantalla | null>(null);
  const [offset, setOffset] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cargar = async () => {
      try {
        const nuevo = publica ? await pantallaQrPublica(token) : await pantallaQr();
        if (cancelado) return;
        setQr(nuevo);
        setOffset(nuevo.ahora - Date.now());
        setError(null);
        // Renueva justo al cambiar la ranura (con un margen de 50 ms)
        timer = setTimeout(cargar, Math.max(200, nuevo.cambiaEn - nuevo.ahora + 50));
      } catch (e) {
        if (cancelado) return;
        // 404 del enlace público: revocado o regenerado. No tiene sentido reintentar.
        if (publica && e instanceof ErrorApi && e.statusCode === 404) {
          setQr(null);
          setError('Este enlace ya no es válido. Pide uno nuevo al administrador.');
          return;
        }
        setError('Sin conexión con el servidor. Reintentando…');
        timer = setTimeout(cargar, 5000);
      }
    };

    void cargar();
    const reloj = setInterval(() => setAhora(Date.now()), 250);
    return () => {
      cancelado = true;
      if (timer) clearTimeout(timer);
      clearInterval(reloj);
    };
    // Nota: el enlace no cambia mientras la pantalla está montada.
  }, [token]);

  const restan = qr ? Math.max(0, Math.ceil((qr.cambiaEn - (ahora + offset)) / 1000)) : null;

  return (
    <section aria-label="Pantalla de asistencia" className={`pa-pantalla${publica ? ' pa-pantalla--publica' : ''}`}>
      <h2 style={{ margin: 0 }}>Marca tu asistencia</h2>
      <p style={{ margin: 0 }}>Abre «Mi asistencia» en tu celular y escanea este código.</p>
      {qr ? (
        <img
          src={qr.qr}
          alt="Código QR de asistencia"
          data-testid="qr-asistencia"
          className="pa-qr"
        />
      ) : (
        <div role="status">Cargando código…</div>
      )}
      {qr && (
        <>
          <div aria-live="polite" data-testid="cuenta-regresiva" className="pa-cuenta">
            El código cambia en {restan} s
          </div>
          <div>
            Si la cámara no funciona, escribe este código: <strong data-testid="codigo-corto" className="pa-codigo">{qr.codigo}</strong>
          </div>
        </>
      )}
      {error && <div role="alert" className="as-aviso as-aviso--error">{error}</div>}
      {publica && <BotonInstalar />}
    </section>
  );
}

/** Ruta pública /asistencia/pantalla/:token: sin sesión y sin menú. */
export function PantallaAsistenciaPublica() {
  const { token = '' } = useParams();
  return <PantallaAsistenciaView token={token} />;
}

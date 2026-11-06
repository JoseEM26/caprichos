/** Mensaje claro para cada fallo al abrir la cámara. */
export function mensajeErrorCamara(e: unknown): string {
  const nombre = (e as { name?: string })?.name;
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return 'La cámara solo funciona en una página segura (HTTPS). Escribe el código de 6 dígitos.';
  }
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
    return 'Permite la cámara en el navegador (candado de la barra de direcciones) y vuelve a intentar.';
  }
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
    return 'Este equipo no tiene cámara: escribe el código de 6 dígitos.';
  }
  if (nombre === 'NotReadableError' || nombre === 'AbortError') {
    return 'La cámara está ocupada por otra aplicación. Ciérrala y vuelve a intentar, o escribe el código de 6 dígitos.';
  }
  if (nombre === 'SinCamara') {
    return 'Este navegador no puede abrir la cámara: escribe el código de 6 dígitos.';
  }
  return 'No pudimos abrir la cámara: escribe el código de 6 dígitos.';
}

/** Pide la cámara (trasera o frontal). Lanza un error con `name` estándar si no se puede. */
export async function pedirCamara(modo: 'environment' | 'user'): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    const e = new Error('sin getUserMedia');
    e.name = 'SinCamara';
    throw e;
  }
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: modo }, audio: false });
}

const ANCHO_ANALISIS = 640;
const CADA_MS = 200;

/**
 * Lee QR del video: BarcodeDetector si existe; si no, jsQR (carga perezosa) sobre un canvas reducido.
 * Devuelve la función que detiene la lectura. `alLeer` se llama una sola vez con el texto tal cual.
 */
export function leerQrDeVideo(video: HTMLVideoElement, alLeer: (texto: string) => void): () => void {
  let activo = true;
  let intervalo: ReturnType<typeof setInterval> | undefined;
  const fin = (texto: string) => {
    if (!activo) return;
    activo = false;
    if (intervalo) clearInterval(intervalo);
    alLeer(texto);
  };

  void (async () => {
    const Detector = (window as any).BarcodeDetector;
    if (Detector) {
      try {
        const det = new Detector({ formats: ['qr_code'] });
        intervalo = setInterval(async () => {
          if (!activo) return;
          const codigos = await det.detect(video).catch(() => []);
          if (codigos.length) fin(codigos[0].rawValue);
        }, CADA_MS);
        return;
      } catch {
        // formato no soportado: se cae a jsQR
      }
    }
    const jsQR = (await import('jsqr')).default;
    if (!activo) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    intervalo = setInterval(() => {
      if (!activo || !video.videoWidth) return;
      const escala = Math.min(1, ANCHO_ANALISIS / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * escala);
      canvas.height = Math.round(video.videoHeight * escala);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (r?.data) fin(r.data);
    }, CADA_MS);
  })();

  return () => {
    activo = false;
    if (intervalo) clearInterval(intervalo);
  };
}

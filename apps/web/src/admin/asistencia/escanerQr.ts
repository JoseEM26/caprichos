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
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: modo }, audio: false });
  } catch (e) {
    const nombre = (e as { name?: string })?.name;
    // Celulares viejos o con restricciones raras: se reintenta con cualquier cámara disponible
    if (nombre === 'OverconstrainedError' || nombre === 'NotFoundError' || nombre === 'NotReadableError' || nombre === 'AbortError') {
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    throw e;
  }
}

export interface PuntoGps {
  lat: number;
  lng: number;
  precision: number;
}

/** Mensaje claro y accionable para cada fallo del GPS (códigos 1 permiso, 2 sin señal, 3 tiempo agotado). */
export function mensajeErrorUbicacion(e: unknown): string {
  const codigo = (e as { code?: number })?.code;
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return 'La ubicación solo funciona en una página segura (HTTPS).';
  }
  if (codigo === 1) {
    return 'El navegador no tiene permiso para tu ubicación. Toca el candado de la barra de direcciones › Permisos › Ubicación › Permitir, y vuelve a intentar.';
  }
  if (codigo === 2) {
    return 'No hay señal de ubicación. Activa el GPS (Ubicación) del celular, sal a un lugar abierto o acércate a una ventana, y vuelve a intentar.';
  }
  if (codigo === 3) {
    return 'La ubicación tardó demasiado en responder. Activa el GPS del celular y vuelve a intentar.';
  }
  return (e as { message?: string })?.message || 'No pudimos leer tu ubicación. Activa el GPS y da permiso al navegador.';
}

const leerGps = (opciones: PositionOptions): Promise<PuntoGps> =>
  new Promise((resolver, rechazar) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }),
      rechazar,
      opciones,
    );
  });

/**
 * Lee la ubicación con tolerancia: primero GPS preciso (12 s); si falla por tiempo o por falta de señal, reintenta con
 * ubicación aproximada (red/WiFi, hasta 20 s, acepta una lectura de hasta 60 s). «Forzar» salta directo al modo aproximado.
 * Si el permiso está denegado no se reintenta: el mensaje explica cómo permitirlo.
 */
export async function pedirUbicacionTolerante(forzar = false): Promise<PuntoGps> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    const e = new Error('Este celular o navegador no permite leer la ubicación.');
    throw e;
  }
  if (!forzar) {
    try {
      return await leerGps({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    } catch (e) {
      if ((e as { code?: number })?.code === 1) throw e;
    }
  }
  return leerGps({ enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 });
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

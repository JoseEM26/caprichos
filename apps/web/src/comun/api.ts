export class ErrorApi extends Error {
  codigo: string;
  override message: string;
  statusCode?: number;
  detalles?: unknown;

  constructor(
    codigo: string,
    mensaje: string,
    statusCode?: number,
    detalles?: unknown,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.codigo = codigo;
    this.message = mensaje;
    this.statusCode = statusCode;
    this.detalles = detalles;
  }
}

let tokenAcceso: string | null = null;
let promesaRenovacion: Promise<string> | null = null;

export function setTokenAcceso(token: string | null): void {
  tokenAcceso = token;
}

export function getTokenAcceso(): string | null {
  return tokenAcceso;
}

interface OpcionesApi extends RequestInit {
  _esReintento?: boolean;
}

async function ejecutarRenovacion(): Promise<string> {
  try {
    const res = await fetch('/auth/renovar', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Ignorar error al parsear
      }
      tokenAcceso = null;
      throw new ErrorApi(
        data?.codigo || 'TOKEN_INVALIDO',
        data?.mensaje || 'No fue posible renovar la sesión',
        res.status,
        data,
      );
    }

    const json = await res.json();
    if (!json?.accessToken) {
      tokenAcceso = null;
      throw new ErrorApi(
        'RESPUESTA_INVALIDA',
        'La respuesta de renovación no contiene accessToken',
        res.status,
      );
    }

    tokenAcceso = json.accessToken;
    return json.accessToken;
  } catch (err) {
    tokenAcceso = null;
    if (err instanceof ErrorApi) {
      throw err;
    }
    throw new ErrorApi(
      'ERROR_RED',
      err instanceof Error ? err.message : 'Error al renovar la sesión',
    );
  } finally {
    promesaRenovacion = null;
  }
}

/**
 * Reintentos ante un reinicio del servidor (despliegue): error de red o 502/503/504.
 * Solo se repiten peticiones seguras: lecturas (GET/HEAD) o escrituras con Idempotency-Key.
 */
let pausasReintento: number[] = (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE === 'test' ? [] : [600, 1500, 3000];

export function configurarReintentos(pausasMs: number[]): void {
  pausasReintento = pausasMs;
}

async function fetchConReintento(ruta: string, init: RequestInit): Promise<Response> {
  const metodo = String(init.method || 'GET').toUpperCase();
  const cab = (init.headers || {}) as Record<string, string>;
  const seguro = metodo === 'GET' || metodo === 'HEAD' || Boolean(cab['Idempotency-Key']);
  const pausas = seguro ? pausasReintento : [];

  for (let intento = 0; ; intento++) {
    try {
      const resp = await fetch(ruta, init);
      if ([502, 503, 504].includes(resp.status) && intento < pausas.length) {
        await new Promise((r) => setTimeout(r, pausas[intento]));
        continue;
      }
      return resp;
    } catch (err) {
      if (intento >= pausas.length) throw err;
      await new Promise((r) => setTimeout(r, pausas[intento]));
    }
  }
}

export async function clienteFetch<T = any>(
  ruta: string,
  opciones: OpcionesApi = {},
): Promise<T> {
  const { _esReintento = false, headers: cabecerasCustom, ...resto } = opciones;

  const cabeceras: Record<string, string> = {
    Accept: 'application/json',
    ...(cabecerasCustom as Record<string, string>),
  };

  if (resto.body && typeof resto.body === 'string' && !cabeceras['Content-Type']) {
    cabeceras['Content-Type'] = 'application/json';
  }

  if (tokenAcceso) {
    cabeceras['Authorization'] = `Bearer ${tokenAcceso}`;
  }

  const respuesta = await fetchConReintento(ruta, {
    ...resto,
    headers: cabeceras,
    credentials: 'include',
    // No reusar el caché HTTP: una navegación a la misma URL (HTML del SPA) lo llenaría
    // y el fetch volvería a leer esa página en lugar del JSON.
    cache: 'no-store',
  });

  if (respuesta.status === 401) {
    const esRutaAuth = ruta.includes('/auth/renovar') || ruta.includes('/auth/ingresar');
    if (_esReintento || esRutaAuth) {
      let datosErr: any = null;
      try {
        datosErr = await respuesta.json();
      } catch {
        // Ignorar
      }
      throw new ErrorApi(
        datosErr?.codigo || 'NO_AUTORIZADO',
        datosErr?.mensaje || 'Sesión expirada o no autorizada',
        401,
        datosErr,
      );
    }

    // Intentar renovar una vez
    if (!promesaRenovacion) {
      promesaRenovacion = ejecutarRenovacion();
    }

    try {
      await promesaRenovacion;
    } catch (err) {
      // Si la renovación falla, lanzar error de sesión expirada
      if (err instanceof ErrorApi) {
        throw err;
      }
      throw new ErrorApi('SESION_EXPIRADA', 'La sesión ha expirado', 401);
    }

    // Reintentar con el nuevo token marcando que es un reintento
    return clienteFetch<T>(ruta, {
      ...opciones,
      _esReintento: true,
    });
  }

  if (!respuesta.ok) {
    let datosErr: any = null;
    try {
      datosErr = await respuesta.json();
    } catch {
      // No era JSON
    }
    const codigo =
      datosErr?.codigo ||
      (respuesta.status === 403
        ? 'SIN_PERMISO'
        : respuesta.status === 404
        ? 'NO_ENCONTRADO'
        : 'ERROR_API');
    // Nest (ValidationPipe, HttpException con texto) manda `message` (texto o lista), no `mensaje`
    const msgNest = Array.isArray(datosErr?.message) ? datosErr.message[0] : datosErr?.message;
    const mensaje =
      datosErr?.mensaje ||
      (typeof msgNest === 'string' && msgNest ? msgNest : '') ||
      respuesta.statusText ||
      'Error al procesar la solicitud';
    throw new ErrorApi(codigo, mensaje, respuesta.status, datosErr);
  }

  if (respuesta.status === 204) {
    return {} as T;
  }

  const tipoContenido = respuesta.headers.get('content-type');
  if (tipoContenido && tipoContenido.includes('application/json')) {
    return (await respuesta.json()) as T;
  }

  if (tipoContenido && tipoContenido.includes('text/html')) {
    // Un 200 con HTML nunca es un dato de la API: no devolver {} en silencio.
    throw new ErrorApi(
      'RESPUESTA_NO_JSON',
      'El servidor respondió con una página en lugar de datos. Recarga la pantalla e inténtalo de nuevo.',
      respuesta.status,
    );
  }

  return {} as T;
}

export const api = {
  get: <T = any>(ruta: string, opciones?: RequestInit) =>
    clienteFetch<T>(ruta, { ...opciones, method: 'GET' }),
  post: <T = any>(ruta: string, cuerpo?: unknown, opciones?: RequestInit) =>
    clienteFetch<T>(ruta, {
      ...opciones,
      method: 'POST',
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    }),
  put: <T = any>(ruta: string, cuerpo?: unknown, opciones?: RequestInit) =>
    clienteFetch<T>(ruta, {
      ...opciones,
      method: 'PUT',
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    }),
  patch: <T = any>(ruta: string, cuerpo?: unknown, opciones?: RequestInit) =>
    clienteFetch<T>(ruta, {
      ...opciones,
      method: 'PATCH',
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    }),
  delete: <T = any>(ruta: string, opciones?: RequestInit) =>
    clienteFetch<T>(ruta, { ...opciones, method: 'DELETE' }),
};

const cacheBlobs = new Map<string, Promise<string>>();

export function limpiarCacheBlobs(): void {
  for (const [, promesa] of cacheBlobs) {
    promesa
      .then((url) => {
        if (url && url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // Ignorar error si ya fue revocado
          }
        }
      })
      .catch(() => {});
  }
  cacheBlobs.clear();
}

/**
 * Descarga un archivo privado (ej. /admin/archivos/:id) con cabecera Authorization: Bearer.
 * Gestiona renovación de token si expira (401) y almacena el Blob URL en memoria para no repetir peticiones.
 */
export async function obtenerBlobAutenticado(ruta: string): Promise<string> {
  if (!ruta) return '';
  if (ruta.startsWith('blob:') || ruta.startsWith('data:')) {
    return ruta;
  }

  const enCache = cacheBlobs.get(ruta);
  if (enCache) {
    return enCache;
  }

  const fetchPromesa = (async () => {
    const cabeceras: Record<string, string> = {
      Accept: 'image/*,application/octet-stream,*/*',
    };
    if (tokenAcceso) {
      cabeceras['Authorization'] = `Bearer ${tokenAcceso}`;
    }

    const respuesta = await fetch(ruta, {
      method: 'GET',
      headers: cabeceras,
      credentials: 'include',
    });

    if (respuesta.status === 401) {
      if (!promesaRenovacion) {
        promesaRenovacion = ejecutarRenovacion();
      }
      try {
        await promesaRenovacion;
      } catch {
        throw new ErrorApi('SESION_EXPIRADA', 'La sesión ha expirado', 401);
      }

      const retryHeaders: Record<string, string> = {
        Accept: 'image/*,application/octet-stream,*/*',
      };
      if (tokenAcceso) {
        retryHeaders['Authorization'] = `Bearer ${tokenAcceso}`;
      }

      const resRetry = await fetch(ruta, {
        method: 'GET',
        headers: retryHeaders,
        credentials: 'include',
      });

      if (!resRetry.ok) {
        throw new ErrorApi(
          'ERROR_DESCARGA',
          `Error al descargar archivo: ${resRetry.status}`,
          resRetry.status,
        );
      }

      const blob = await resRetry.blob();
      return URL.createObjectURL(blob);
    }

    if (!respuesta.ok) {
      throw new ErrorApi(
        'ERROR_DESCARGA',
        `Error al descargar archivo: ${respuesta.status}`,
        respuesta.status,
      );
    }

    const blob = await respuesta.blob();
    return URL.createObjectURL(blob);
  })();

  fetchPromesa.catch(() => {
    cacheBlobs.delete(ruta);
  });

  cacheBlobs.set(ruta, fetchPromesa);
  return fetchPromesa;
}


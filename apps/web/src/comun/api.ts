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

  const respuesta = await fetch(ruta, {
    ...resto,
    headers: cabeceras,
    credentials: 'include',
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
    const mensaje =
      datosErr?.mensaje || respuesta.statusText || 'Error al procesar la solicitud';
    throw new ErrorApi(codigo, mensaje, respuesta.status, datosErr);
  }

  if (respuesta.status === 204) {
    return {} as T;
  }

  const tipoContenido = respuesta.headers.get('content-type');
  if (tipoContenido && tipoContenido.includes('application/json')) {
    return (await respuesta.json()) as T;
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

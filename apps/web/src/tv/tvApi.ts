import { ErrorApi } from '../comun/api';

/** Vistas que una TV puede mostrar sin sesión (iguales a las de la API). */
export type VistaTv = 'SALON_VIVO' | 'COCINA' | 'PANTALLA_LOCAL';

export interface EstadoTv {
  vinculada: boolean;
  activa: boolean;
  vista: VistaTv | null;
  areaId: string | null;
  nombre: string;
}

export interface CodigoTv {
  codigo: string;
  expiraEn: string;
  llave: string;
}

const CLAVE = (vista: VistaTv) => `caprichos_tv_llave_${vista}`;

export function leerLlave(vista: VistaTv): string | null {
  try {
    return window.localStorage.getItem(CLAVE(vista));
  } catch {
    return null;
  }
}

export function guardarLlave(vista: VistaTv, llave: string): void {
  try {
    window.localStorage.setItem(CLAVE(vista), llave);
  } catch {
    // sin almacenamiento: la TV pedirá un código cada vez que se recargue
  }
}

export function borrarLlave(vista: VistaTv): void {
  try {
    window.localStorage.removeItem(CLAVE(vista));
  } catch {
    // nada que borrar
  }
}

/** Pedido de la TV a la API pública. Sin cookies ni renovación de sesión: solo la llave de la pantalla. */
export async function tvFetch<T>(ruta: string, llave?: string | null, cuerpo?: unknown): Promise<T> {
  const res = await fetch(ruta, {
    method: cuerpo === undefined ? 'GET' : 'POST',
    headers: {
      Accept: 'application/json',
      ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(llave ? { Authorization: `Bearer ${llave}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    cache: 'no-store',
  });
  if (!res.ok) {
    let d: any = null;
    try {
      d = await res.json();
    } catch {
      // no era JSON
    }
    throw new ErrorApi(d?.codigo || 'ERROR_API', d?.mensaje || res.statusText || 'Error', res.status, d);
  }
  return (await res.json()) as T;
}

export const tvApi = {
  pedirCodigo: (vista: VistaTv) => tvFetch<CodigoTv>('/carta/tv/codigo', null, { vista }),
  estado: (llave: string) => tvFetch<EstadoTv>('/carta/tv/estado', llave),
};

/** true si la API dice que la llave ya no sirve (pantalla desactivada o desconocida): hay que pedir otro código. */
export const llaveRevocada = (e: unknown): boolean => (e as { statusCode?: number } | null)?.statusCode === 401;

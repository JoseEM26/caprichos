import { useEffect, useState } from 'react';
import { api } from '../../../comun/api';

/** Dirección guardada en la libreta del cliente con cuenta (GET /admin/clientes/por-telefono/:telefono) */
export interface DireccionCliente {
  id: string;
  direccion: string;
  referencia: string | null;
  lat: number | null;
  lng: number | null;
  alias: string | null;
  usos: number;
  ultimoUsoEn: string | null;
  origen: string;
}

/** Cliente con cuenta encontrado por celular */
export interface CuentaCliente {
  party: string;
    nombre: string;
  telefono: string | null;
  puntos: number;
  direcciones: DireccionCliente[];
}

/** Consulta la cuenta por celular. Devuelve null si no hay cuenta. Lanza ErrorApi si falla. */
export async function buscarCuentaPorTelefono(telefono: string): Promise<CuentaCliente | null> {
  const res: any = await api.get(`/admin/clientes/por-telefono/${telefono}`);
  if (!res || !res.encontrado) return null;
  return {
    party: String(res.party ?? ''),
    nombre: String(res.nombre ?? ''),
    telefono: res.telefono ? String(res.telefono) : null,
    puntos: Number(res.puntos ?? 0),
    direcciones: (Array.isArray(res.direcciones) ? res.direcciones : [])
      .slice(0, 5)
      .map((d: any) => ({
        id: String(d.id),
        direccion: String(d.direccion ?? ''),
        referencia: d.referencia ? String(d.referencia) : null,
        lat: d.lat == null ? null : Number(d.lat),
        lng: d.lng == null ? null : Number(d.lng),
        alias: d.alias ?? null,
        usos: Number(d.usos ?? 0),
        ultimoUsoEn: d.ultimoUsoEn ?? null,
        origen: String(d.origen ?? ''),
      })),
  };
}

/** Mensaje claro para el mozo según el error de la consulta por celular */
export function mensajeErrorCuenta(err: any): string {
  const estado = err?.statusCode ?? err?.status;
  const codigo = err?.codigo;
  if (estado === 429 || codigo === 'DEMASIADAS_BUSQUEDAS') {
    return 'Demasiadas búsquedas seguidas. Espera un minuto y vuelve a intentar.';
  }
  if (estado === 400 || codigo === 'TELEFONO_INVALIDO') {
    return 'El celular debe tener 9 dígitos y empezar con 9.';
  }
  return 'No se pudo consultar la cuenta. Revisa la conexión e inténtalo de nuevo.';
}

/** Fecha corta en es-PE para la última vez que se usó una dirección */
export function fechaCortaDireccion(iso: string | null): string {
  if (!iso) return 'sin fecha';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'sin fecha';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Busca la cuenta sola cuando el celular tiene 9 dígitos y empieza con 9. Solo vale la respuesta del
 * último celular (las viejas se ignoran) y no repite la búsqueda si el celular no cambió.
 */
export function useCuentaPorCelular(telefono: string) {
  const valido = /^9\d{8}$/.test(telefono);
  const [estado, setEstado] = useState<{
    tel: string;
    cuenta: CuentaCliente | null;
    buscando: boolean;
    error: string | null;
  }>({ tel: '', cuenta: null, buscando: false, error: null });

  useEffect(() => {
    if (!valido) {
      setEstado((e) => (e.tel === '' ? e : { tel: '', cuenta: null, buscando: false, error: null }));
      return;
    }
    let vigente = true;
    setEstado({ tel: telefono, cuenta: null, buscando: true, error: null });
    buscarCuentaPorTelefono(telefono)
      .then((cuenta) => vigente && setEstado({ tel: telefono, cuenta, buscando: false, error: null }))
      .catch((err) =>
        vigente && setEstado({ tel: telefono, cuenta: null, buscando: false, error: mensajeErrorCuenta(err) }),
      );
    return () => {
      vigente = false;
    };
  }, [telefono, valido]);

  // Mientras no coincida con el celular escrito, el estado guardado es de otro número: no se muestra
  const actual = valido && estado.tel === telefono;
  return {
    cuenta: actual ? estado.cuenta : null,
    buscando: valido && (!actual || estado.buscando),
    error: actual ? estado.error : null,
    sinCuenta: actual && !estado.buscando && !estado.error && estado.cuenta === null,
  };
}

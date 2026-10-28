import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../comun/api';
import type { ModalidadEntrega } from './tipos';

const CLAVE = 'caprichos_pedidos';
const MAXIMO = 20;
export const INTERVALO_SEGUIMIENTO_MS = 15000;
const DIAS_CONSERVADO_MS = 30 * 24 * 60 * 60 * 1000;
const EVENTO_CAMBIO = 'caprichos:pedidos-cambio';
const MODALIDADES: ModalidadEntrega[] = ['DELIVERY', 'RECOGER'];

export interface PedidoGuardado {
  codigo: string;
  token: string;
  modalidad: ModalidadEntrega;
  nombre: string;
  creadoEn: string;
  // Último estado conocido: los terminados ya no se consultan y se muestran con esta copia
  estado?: string;
  estadoEtiqueta?: string;
  terminado?: boolean;
  anulado?: boolean;
  total?: number;
}

export interface PasoSeguimiento {
  clave: string;
  etiqueta: string;
  hecho: boolean;
  actual: boolean;
  hora: string | null;
}

export interface EstadoSeguimiento {
  codigo: string;
  estado: string;
  estadoEtiqueta: string;
  modalidad: ModalidadEntrega;
  total: number;
  terminado: boolean;
  anulado: boolean;
  pasos: PasoSeguimiento[];
  /** Yape, Plin o transferencia: la pantalla pide la captura del pago. */
  pagoDigital?: boolean;
}

export type ResultadoLote = EstadoSeguimiento | { codigo: string; noEncontrado: true };

function esPedidoGuardado(valor: unknown): valor is PedidoGuardado {
  const p = valor as PedidoGuardado;
  return (
    !!p &&
    typeof p.codigo === 'string' &&
    typeof p.token === 'string' &&
    typeof p.nombre === 'string' &&
    typeof p.creadoEn === 'string' &&
    MODALIDADES.includes(p.modalidad)
  );
}

function escribirPedidosGuardados(lista: PedidoGuardado[]): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(lista.slice(0, MAXIMO)));
    window.dispatchEvent(new Event(EVENTO_CAMBIO));
  } catch {
    // Sin almacenamiento disponible: el pedido solo se ve en esta pantalla
  }
}

// Ventana privada o almacenamiento bloqueado: se trata como lista vacía, sin romper la carta.
// Al leer se podan los pedidos de más de 30 días desde que se crearon.
export function leerPedidosGuardados(): PedidoGuardado[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    const lista = crudo ? JSON.parse(crudo) : [];
    if (!Array.isArray(lista)) return [];
    const limite = Date.now() - DIAS_CONSERVADO_MS;
    const vigentes = lista
      .filter(esPedidoGuardado)
      .filter((p) => !(Date.parse(p.creadoEn) < limite))
      .slice(0, MAXIMO);
    if (vigentes.length !== lista.length) escribirPedidosGuardados(vigentes);
    return vigentes;
  } catch {
    return [];
  }
}

// El más nuevo primero; si ya estaba, se reemplaza
export function guardarPedido(pedido: PedidoGuardado): void {
  const otros = leerPedidosGuardados().filter((p) => p.codigo !== pedido.codigo);
  escribirPedidosGuardados([pedido, ...otros]);
}

export function quitarPedido(codigo: string): void {
  escribirPedidosGuardados(leerPedidosGuardados().filter((p) => p.codigo !== codigo));
}

// Copia el último estado del pedido en su registro, sin escribir si no cambió nada
function guardarEstado(estado: EstadoSeguimiento): void {
  const lista = leerPedidosGuardados();
  const actual = lista.find((p) => p.codigo === estado.codigo);
  if (!actual) return;
  const cambios = {
    estado: estado.estado,
    estadoEtiqueta: estado.estadoEtiqueta,
    terminado: estado.terminado,
    anulado: estado.anulado,
    total: estado.total,
  };
  const cambio = (Object.keys(cambios) as (keyof typeof cambios)[]).some((k) => actual[k] !== cambios[k]);
  if (cambio) escribirPedidosGuardados(lista.map((p) => (p.codigo === estado.codigo ? { ...p, ...cambios } : p)));
}

/** Consulta varios pedidos del invitado en una sola llamada y actualiza su copia local. */
export async function consultarLote(pedidos: PedidoGuardado[]): Promise<ResultadoLote[]> {
  if (pedidos.length === 0) return [];
  const { resultados } = await api.post<{ resultados: ResultadoLote[] }>('/carta/seguimiento/lote', {
    pedidos: pedidos.map((p) => ({ codigo: p.codigo, t: p.token })),
  });
  for (const r of resultados) {
    if ('noEncontrado' in r) quitarPedido(r.codigo);
    else guardarEstado(r);
  }
  return resultados;
}

/** Lista de pedidos guardados en el navegador; se actualiza cuando cambian. */
export function usePedidosGuardados(): PedidoGuardado[] {
  const [lista, setLista] = useState(leerPedidosGuardados);

  useEffect(() => {
    const alCambiar = () => setLista(leerPedidosGuardados());
    window.addEventListener(EVENTO_CAMBIO, alCambiar);
    window.addEventListener('storage', alCambiar);
    return () => {
      window.removeEventListener(EVENTO_CAMBIO, alCambiar);
      window.removeEventListener('storage', alCambiar);
    };
  }, []);

  return lista;
}

// Consulta el estado real a la API cada 15 s mientras la pantalla esté abierta y la pestaña visible
export function useSeguimientoPedido(codigo: string | null, token: string | null) {
  const [estado, setEstado] = useState<EstadoSeguimiento | null>(null);
  const [error, setError] = useState<'RED' | 'NO_ENCONTRADO' | null>(null);

  useEffect(() => {
    if (!codigo || !token) return;

    let activo = true;
    let fin = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const programar = () => {
      clearTimeout(temporizador);
      if (activo && !fin) temporizador = setTimeout(consultar, INTERVALO_SEGUIMIENTO_MS);
    };

    const consultar = async () => {
      clearTimeout(temporizador);
      if (!activo || fin || document.visibilityState === 'hidden') return;

      try {
        const res = await api.get<EstadoSeguimiento>(
          `/carta/seguimiento/${encodeURIComponent(codigo)}?t=${encodeURIComponent(token)}`,
        );
        if (!activo) return;
        setEstado(res);
        setError(null);
        guardarEstado(res);
        if (res.terminado) fin = true;
      } catch (err) {
        if (!activo) return;
        if (err instanceof ErrorApi && err.statusCode === 404) {
          fin = true;
          quitarPedido(codigo);
          setError('NO_ENCONTRADO');
        } else {
          setError('RED');
        }
      }
      programar();
    };

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') void consultar();
    };

    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    void consultar();

    return () => {
      activo = false;
      clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [codigo, token]);

  return { estado, error };
}

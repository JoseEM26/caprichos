import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../comun/api';
import type { ModalidadEntrega } from './tipos';

const CLAVE = 'caprichos_pedidos';
const MAXIMO = 5;
const INTERVALO_MS = 15000;
const TRES_HORAS_MS = 3 * 60 * 60 * 1000;
const MODALIDADES: ModalidadEntrega[] = ['DELIVERY', 'RECOGER'];

export interface PedidoGuardado {
  codigo: string;
  token: string;
  modalidad: ModalidadEntrega;
  nombre: string;
  creadoEn: string;
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
}

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

// Ventana privada o almacenamiento bloqueado: se trata como lista vacía, sin romper la carta
export function leerPedidosGuardados(): PedidoGuardado[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    const lista = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? lista.filter(esPedidoGuardado).slice(0, MAXIMO) : [];
  } catch {
    return [];
  }
}

function escribirPedidosGuardados(lista: PedidoGuardado[]): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(lista.slice(0, MAXIMO)));
  } catch {
    // Sin almacenamiento disponible: el pedido solo se ve en esta pantalla
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

export function limpiarPedidosGuardados(): void {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // Nada que limpiar si el almacenamiento no está disponible
  }
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
      if (activo && !fin) temporizador = setTimeout(consultar, INTERVALO_MS);
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
        if (res.terminado) {
          fin = true;
          const antiguo = Date.now() - pedidoCreadoEn(codigo) > TRES_HORAS_MS;
          if (antiguo) quitarPedido(codigo);
        }
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

// Fecha de creación del pedido guardado; si no está, se cuenta como reciente
function pedidoCreadoEn(codigo: string): number {
  const pedido = leerPedidosGuardados().find((p) => p.codigo === codigo);
  const creado = pedido ? Date.parse(pedido.creadoEn) : NaN;
  return Number.isNaN(creado) ? Date.now() : creado;
}

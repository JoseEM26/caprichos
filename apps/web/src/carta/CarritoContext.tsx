import React, { createContext, useContext, useEffect, useState } from 'react';
import { calcularSubtotalPedido } from '@caprichos/compartido';
import { LineaCarrito, PedidoConfirmado, ProductoCarta } from './tipos';
import type { PedidoGuardado } from './seguimiento';

const CLAVE_SESSION_STORAGE = 'caprichos_carrito';

export interface NotificacionAgregadoItem {
  nombre: string;
  detalle: string;
  fotoUrl?: string | null;
}

interface CarritoContextoValor {
  lineas: LineaCarrito[];
  cantidadTotal: number;
  subtotal: number;
  agregarLinea: (linea: Omit<LineaCarrito, 'id'>) => void;
  actualizarCantidad: (id: string, delta: number) => void;
  eliminarLinea: (id: string) => void;
  limpiarCarrito: () => void;
  cajonAbierto: boolean;
  abrirCajon: () => void;
  cerrarCajon: () => void;
  checkoutAbierto: boolean;
  abrirCheckout: () => void;
  cerrarCheckout: () => void;
  productoEnModal: ProductoCarta | null;
  abrirModalProducto: (producto: ProductoCarta) => void;
  cerrarModalProducto: () => void;
  notificacion: NotificacionAgregadoItem | null;
  cerrarToast: () => void;
  pedidoConfirmado: PedidoConfirmado | null;
  setPedidoConfirmado: (p: PedidoConfirmado | null) => void;
  seguimientoAbierto: PedidoGuardado | null;
  setSeguimientoAbierto: (p: PedidoGuardado | null) => void;
  listaPedidosAbierta: boolean;
  setListaPedidosAbierta: (abierta: boolean) => void;
}

const CarritoContext = createContext<CarritoContextoValor | undefined>(undefined);

function cargarLineasIniciales(): LineaCarrito[] {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return [];
  }
  try {
    const raw = window.sessionStorage.getItem(CLAVE_SESSION_STORAGE);
    if (!raw) return [];
    const parseado = JSON.parse(raw);
    return Array.isArray(parseado) ? parseado : [];
  } catch {
    return [];
  }
}

export function CarritoProvider({ children }: { children: React.ReactNode }) {
  const [lineas, setLineas] = useState<LineaCarrito[]>(cargarLineasIniciales);
  const [cajonAbierto, setCajonAbierto] = useState(false);
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  const [productoEnModal, setProductoEnModal] = useState<ProductoCarta | null>(null);
  const [notificacion, setNotificacion] = useState<NotificacionAgregadoItem | null>(null);
  const [pedidoConfirmado, setPedidoConfirmado] = useState<PedidoConfirmado | null>(null);
  const [seguimientoAbierto, setSeguimientoAbierto] = useState<PedidoGuardado | null>(null);
  const [listaPedidosAbierta, setListaPedidosAbierta] = useState(false);

  // Guardar en sessionStorage ante cada cambio
  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(CLAVE_SESSION_STORAGE, JSON.stringify(lineas));
      } catch {
        // En caso de cuota excedida o modo privado estricto
      }
    }
  }, [lineas]);

  const agregarLinea = (nueva: Omit<LineaCarrito, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const lineaCompleta: LineaCarrito = { ...nueva, id };

    setLineas((prev) => [...prev, lineaCompleta]);

    // Resumen para el toast
    const detallesPartes: string[] = [];
    if (nueva.tamanoNombre) detallesPartes.push(nueva.tamanoNombre);
    detallesPartes.push(`${nueva.cantidad} ${nueva.cantidad === 1 ? 'unidad' : 'unidades'}`);
    const detalle = detallesPartes.join(' · ');

    setNotificacion({
      nombre: nueva.nombre,
      detalle,
      fotoUrl: nueva.fotoUrl,
    });
  };

  const actualizarCantidad = (id: string, delta: number) => {
    setLineas((prev) => {
      return prev
        .map((lin) => {
          if (lin.id !== id) return lin;
          const nuevaCant = lin.cantidad + delta;
          if (nuevaCant <= 0) return null;
          const nuevoSubtotal = Number((lin.precioUnitario * nuevaCant).toFixed(2));
          return {
            ...lin,
            cantidad: nuevaCant,
            subtotal: nuevoSubtotal,
          };
        })
        .filter((l): l is LineaCarrito => l !== null);
    });
  };

  const eliminarLinea = (id: string) => {
    setLineas((prev) => prev.filter((l) => l.id !== id));
  };

  const limpiarCarrito = () => {
    setLineas([]);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(CLAVE_SESSION_STORAGE);
    }
  };

  const cantidadTotal = lineas.reduce((acc, l) => acc + l.cantidad, 0);
  const subtotal = calcularSubtotalPedido(lineas);

  const abrirCajon = () => {
    setNotificacion(null);
    setCajonAbierto(true);
  };

  const cerrarCajon = () => setCajonAbierto(false);

  const abrirCheckout = () => {
    setCajonAbierto(false);
    setCheckoutAbierto(true);
  };

  const cerrarCheckout = () => setCheckoutAbierto(false);

  const abrirModalProducto = (producto: ProductoCarta) => setProductoEnModal(producto);
  const cerrarModalProducto = () => setProductoEnModal(null);

  const cerrarToast = () => setNotificacion(null);

  return (
    <CarritoContext.Provider
      value={{
        lineas,
        cantidadTotal,
        subtotal,
        agregarLinea,
        actualizarCantidad,
        eliminarLinea,
        limpiarCarrito,
        cajonAbierto,
        abrirCajon,
        cerrarCajon,
        checkoutAbierto,
        abrirCheckout,
        cerrarCheckout,
        productoEnModal,
        abrirModalProducto,
        cerrarModalProducto,
        notificacion,
        cerrarToast,
        pedidoConfirmado,
        setPedidoConfirmado,
        seguimientoAbierto,
        setSeguimientoAbierto,
        listaPedidosAbierta,
        setListaPedidosAbierta,
      }}
    >
      {children}
    </CarritoContext.Provider>
  );
}

export function useCarrito(): CarritoContextoValor {
  const ctx = useContext(CarritoContext);
  if (!ctx) {
    throw new Error('useCarrito debe usarse dentro de un CarritoProvider');
  }
  return ctx;
}

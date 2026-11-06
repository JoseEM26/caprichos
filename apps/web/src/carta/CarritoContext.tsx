import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { calcularSubtotalPedido } from '@caprichos/compartido';
import { api } from '../comun/api';
import { CategoriaCarta, LineaCarrito, PedidoConfirmado, ProductoCarta, SaborLinea } from './tipos';
import type { PedidoGuardado } from './seguimiento';
import { INTERVALO_REFRESCO_STOCK_MS, InfoStock, InventarioCarta, infoStockDe, recortarLineasProducto, recortarSaboresAlTotal } from './stock';

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
  inventario: InventarioCarta;
  /** Guarda el stock de la carta que se acaba de cargar. */
  aplicarCarta: (productos: ProductoCarta[]) => void;
  /** Vuelve a pedir la carta (como mucho cada 20 s) para tener quedan al día. */
  refrescarStock: () => Promise<void>;
  /** Fija quedan de un producto tras un 409 STOCK_INSUFICIENTE. */
  marcarQuedan: (productoId: string, quedan: number) => void;
  /** Recorta las líneas del producto para que sumen como mucho `maximo`. */
  ajustarCantidadProducto: (productoId: string, maximo: number) => void;
  /** Fija quedan de un sabor tras un 409 (SABOR_AGOTADO o STOCK_INSUFICIENTE). */
  marcarQuedanSabor: (productoId: string, saborId: string, quedan: number) => void;
  /** Cambia cantidad y mezcla de una línea (la edición de sabores desde el carrito o el checkout). */
  actualizarLinea: (id: string, cambios: { cantidad: number; sabores: SaborLinea[] }) => void;
  /** Línea cuyos sabores se están ajustando (ventana de ajuste); null si no hay ninguna abierta. */
  lineaAjustandoId: string | null;
  abrirAjusteLinea: (id: string) => void;
  cerrarAjusteLinea: () => void;
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
  const [inventario, setInventario] = useState<InventarioCarta>({});
  const [lineaAjustandoId, setLineaAjustandoId] = useState<string | null>(null);
  const ultimoRefrescoStock = useRef(0);

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
          // mezcla de sabores: si baja la cantidad, se quitan sabores hasta cuadrar; si sube, la línea pide elegir
          const sabores = lin.sabores && lin.unidadesPorMezcla !== undefined ? recortarSaboresAlTotal(lin.sabores, lin.unidadesPorMezcla * nuevaCant) : lin.sabores;
          return {
            ...lin,
            cantidad: nuevaCant,
            subtotal: nuevoSubtotal,
            sabores,
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

  const aplicarCarta = (productos: ProductoCarta[]) => {
    const nuevo: InventarioCarta = {};
    for (const p of productos) nuevo[String(p.id)] = infoStockDe(p);
    setInventario(nuevo);
  };

  const refrescarStock = async () => {
    const ahora = Date.now();
    if (ahora - ultimoRefrescoStock.current < INTERVALO_REFRESCO_STOCK_MS) return;
    ultimoRefrescoStock.current = ahora;
    try {
      const categorias = await api.get<CategoriaCarta[]>('/carta');
      if (Array.isArray(categorias)) aplicarCarta(categorias.flatMap((c) => c.productos));
    } catch {
      // Sin red: se queda el último stock conocido y el servidor valida al enviar
    }
  };

  const marcarQuedan = (productoId: string, quedan: number) => {
    setInventario((prev) => {
      const actual: InfoStock = prev[productoId] ?? { controlaStock: true, quedan, disponible: quedan > 0 };
      return { ...prev, [productoId]: { ...actual, controlaStock: true, quedan, disponible: quedan > 0 } };
    });
  };

  const ajustarCantidadProducto = (productoId: string, maximo: number) => {
    setLineas((prev) => recortarLineasProducto(prev, productoId, maximo));
  };

  const marcarQuedanSabor = (productoId: string, saborId: string, quedan: number) => {
    setInventario((prev) => {
      const actual = prev[productoId];
      if (!actual?.sabores?.[saborId]) return prev;
      const sabores = { ...actual.sabores, [saborId]: { ...actual.sabores[saborId], quedan, disponible: quedan > 0 } };
      return { ...prev, [productoId]: { ...actual, sabores } };
    });
  };

  const actualizarLinea = (id: string, cambios: { cantidad: number; sabores: SaborLinea[] }) => {
    setLineas((prev) =>
      prev.map((lin) =>
        lin.id === id
          ? { ...lin, cantidad: cambios.cantidad, sabores: cambios.sabores, subtotal: Number((lin.precioUnitario * cambios.cantidad).toFixed(2)) }
          : lin,
      ),
    );
  };

  const abrirAjusteLinea = (id: string) => setLineaAjustandoId(id);
  const cerrarAjusteLinea = () => setLineaAjustandoId(null);

  const cantidadTotal = lineas.reduce((acc, l) => acc + l.cantidad, 0);
  const subtotal = calcularSubtotalPedido(lineas);

  const abrirCajon = () => {
    setNotificacion(null);
    setCajonAbierto(true);
    void refrescarStock();
  };

  const cerrarCajon = () => setCajonAbierto(false);

  const abrirCheckout = () => {
    setCajonAbierto(false);
    setCheckoutAbierto(true);
    void refrescarStock();
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
        inventario,
        aplicarCarta,
        refrescarStock,
        marcarQuedan,
        ajustarCantidadProducto,
        marcarQuedanSabor,
        actualizarLinea,
        lineaAjustandoId,
        abrirAjusteLinea,
        cerrarAjusteLinea,
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

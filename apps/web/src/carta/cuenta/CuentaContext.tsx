import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../../comun/api';

export interface ClienteCuenta {
  partyId: string;
  nombre: string;
  dniMascara: string;
  correo: string | null;
  cumpleanos: string | null;
  puntos: number;
}

export interface DatosRegistro {
  dni: string;
  nombre: string;
  contrasena: string;
  correo?: string;
  cumpleanos: string;
  aceptaDatos: boolean;
}

interface ContextoCuenta {
  cliente: ClienteCuenta | null;
  panelAbierto: boolean;
  abrirPanel: () => void;
  cerrarPanel: () => void;
  ingresar: (dni: string, contrasena: string) => Promise<void>;
  registrar: (datos: DatosRegistro) => Promise<void>;
  salir: () => Promise<void>;
  refrescar: () => Promise<void>;
}

// Marca (no secreta) de que este navegador ya tuvo cuenta: sin ella no se consulta la sesión al abrir la carta.
const CLAVE_INDICIO = 'caprichos_cliente';
const marcar = (activa: boolean): void => {
  try {
    if (activa) window.localStorage.setItem(CLAVE_INDICIO, '1');
    else window.localStorage.removeItem(CLAVE_INDICIO);
  } catch {
    // sin almacenamiento
  }
};
const hayIndicio = (): boolean => {
  try {
    return window.localStorage.getItem(CLAVE_INDICIO) === '1';
  } catch {
    return false;
  }
};

const Contexto = createContext<ContextoCuenta | null>(null);

/**
 * Cuenta opcional del cliente (DT-55). La sesión va en una cookie httpOnly que pone la API
 * (/carta/cuenta/*); aquí solo se guarda el resumen que devuelve.
 */
export function CuentaProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<ClienteCuenta | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(false);

  const refrescar = useCallback(async () => {
    try {
      const r = await api.get<{ cliente: ClienteCuenta | null }>('/carta/cuenta/yo');
      setCliente(r.cliente ?? null);
      if (!r.cliente) marcar(false);
    } catch {
      setCliente(null);
    }
  }, []);

  useEffect(() => {
    if (hayIndicio()) void refrescar();
  }, [refrescar]);

  const ingresar = useCallback(async (dni: string, contrasena: string) => {
    const r = await api.post<{ cliente: ClienteCuenta }>('/carta/cuenta/ingresar', { dni, contrasena });
    marcar(true);
    setCliente(r.cliente);
  }, []);

  const registrar = useCallback(async (datos: DatosRegistro) => {
    const r = await api.post<{ cliente: ClienteCuenta }>('/carta/cuenta/registro', datos);
    marcar(true);
    setCliente(r.cliente);
  }, []);

  const salir = useCallback(async () => {
    try {
      await api.post('/carta/cuenta/salir');
    } catch {
      // aunque falle la red, se cierra en este navegador
    }
    marcar(false);
    setCliente(null);
  }, []);

  const valor = useMemo<ContextoCuenta>(
    () => ({
      cliente,
      panelAbierto,
      abrirPanel: () => setPanelAbierto(true),
      cerrarPanel: () => setPanelAbierto(false),
      ingresar,
      registrar,
      salir,
      refrescar,
    }),
    [cliente, panelAbierto, ingresar, registrar, salir, refrescar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Igual que useCuenta, pero devuelve null fuera de un CuentaProvider (por ejemplo en pruebas o pantallas sin cuenta) */
export function useCuentaOpcional(): ContextoCuenta | null {
  return useContext(Contexto);
}

export function useCuenta(): ContextoCuenta {
  const c = useContext(Contexto);
  if (!c) throw new Error('useCuenta debe usarse dentro de un CuentaProvider');
  return c;
}

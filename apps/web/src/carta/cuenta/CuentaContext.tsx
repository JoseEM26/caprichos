import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clienteFetch } from '../../comun/api';

export interface ClienteCuenta {
  partyId: string;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  fotoUrl: string | null;
  cumpleanos: string | null;
  puntos: number;
}

export interface DatosRegistro {
  nombre: string;
  contrasena: string;
  telefono: string;
  /** DNI opcional: 8 dígitos o no se envía */
  dni?: string;
  correo?: string;
  cumpleanos?: string;
  aceptaDatos: boolean;
}

export interface DatosPerfil {
  nombre?: string;
  correo?: string;
  cumpleanos?: string;
}

/** Solo lo que el servidor dice de la propia sesión: si es del equipo y puede cargar a su crédito del personal. */
export interface EquipoCuenta {
  esEquipo: true;
  puedeCredito: boolean;
}

interface ContextoCuenta {
  cliente: ClienteCuenta | null;
  equipo?: EquipoCuenta | null;
  panelAbierto: boolean;
  abrirPanel: () => void;
  cerrarPanel: () => void;
  ingresar: (telefono: string, contrasena: string) => Promise<void>;
  registrar: (datos: DatosRegistro) => Promise<void>;
  actualizarPerfil: (datos: DatosPerfil) => Promise<void>;
  subirFoto: (archivo: File) => Promise<void>;
  quitarFoto: () => Promise<void>;
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
  const [equipo, setEquipo] = useState<EquipoCuenta | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(false);

  const refrescar = useCallback(async () => {
    try {
      const r = await api.get<{ cliente: ClienteCuenta | null; equipo?: EquipoCuenta }>('/carta/cuenta/yo');
      setCliente(r.cliente ?? null);
      setEquipo(r.cliente ? (r.equipo ?? null) : null);
      if (!r.cliente) marcar(false);
    } catch {
      setCliente(null);
    }
  }, []);

  useEffect(() => {
    if (hayIndicio()) void refrescar();
  }, [refrescar]);

  // Enlace «ve tus puntos aquí» del aviso de WhatsApp (?puntos=1): abre el acceso solo para consultar
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('puntos') !== '1') return;
      setPanelAbierto(true);
      url.searchParams.delete('puntos');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // sin URL legible: la carta sigue normal
    }
  }, []);

  // Tras ingresar: el login no trae el dato del equipo; se pide aparte y sin romper si falla
  const cargarEquipo = useCallback(() => {
    void Promise.resolve(api.get<{ equipo?: EquipoCuenta }>('/carta/cuenta/yo'))
      .then((r) => setEquipo(r?.equipo ?? null))
      .catch(() => setEquipo(null));
  }, []);

  const ingresar = useCallback(async (telefono: string, contrasena: string) => {
    const r = await api.post<{ cliente: ClienteCuenta }>('/carta/cuenta/ingresar', { telefono, contrasena });
    marcar(true);
    setCliente(r.cliente);
    cargarEquipo();
  }, [cargarEquipo]);

  const registrar = useCallback(async (datos: DatosRegistro) => {
    const r = await api.post<{ cliente: ClienteCuenta }>('/carta/cuenta/registro', datos);
    marcar(true);
    setCliente(r.cliente);
  }, []);

  const actualizarPerfil = useCallback(async (datos: DatosPerfil) => {
    const r = await api.put<{ cliente: ClienteCuenta | null }>('/carta/cuenta/perfil', datos);
    if (r.cliente) setCliente(r.cliente);
  }, []);

  const subirFoto = useCallback(async (archivo: File) => {
    const formulario = new FormData();
    formulario.append('foto', archivo);
    const r = await clienteFetch<{ cliente: ClienteCuenta | null }>('/carta/cuenta/foto', { method: 'POST', body: formulario });
    if (r.cliente) setCliente(r.cliente);
  }, []);

  const quitarFoto = useCallback(async () => {
    const r = await api.delete<{ cliente: ClienteCuenta | null }>('/carta/cuenta/foto');
    if (r.cliente) setCliente(r.cliente);
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
      equipo: cliente ? equipo : null,
      panelAbierto,
      abrirPanel: () => setPanelAbierto(true),
      cerrarPanel: () => setPanelAbierto(false),
      ingresar,
      registrar,
      actualizarPerfil,
      subirFoto,
      quitarFoto,
      salir,
      refrescar,
    }),
    [cliente, equipo, panelAbierto, ingresar, registrar, actualizarPerfil, subirFoto, quitarFoto, salir, refrescar],
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

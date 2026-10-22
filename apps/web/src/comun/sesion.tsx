import type { ReactNode } from 'react';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { api, setTokenAcceso } from './api';

export interface UsuarioSesion {
  partyId: string;
  nombres: string;
  rol: string;
}

export interface ContextoSesion {
  usuario: UsuarioSesion | null;
  permisos: string[];
  debeCambiar: boolean;
  cargando: boolean;
  autenticado: boolean;
  ingresar: (
    dni: string,
    contrasena: string,
  ) => Promise<{ debeCambiar: boolean; usuario: UsuarioSesion }>;
  salir: () => Promise<void>;
  renovar: () => Promise<void>;
  refrescarYo: () => Promise<void>;
  marcarClaveCambiada: () => void;
  tiene: (permiso: string) => boolean;
}

const Contexto = createContext<ContextoSesion | null>(null);

export interface SesionProviderProps {
  children: ReactNode;
}

let renovacionInicial: Promise<void> | null = null;

export function SesionProvider({ children }: SesionProviderProps) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [permisos, setPermisos] = useState<string[]>([]);
  const [debeCambiar, setDebeCambiar] = useState<boolean>(false);
  const [cargando, setCargando] = useState<boolean>(true);

  const cargarYo = useCallback(async (): Promise<void> => {
    try {
      const yo = await api.get<{
        partyId: string;
        nombres: string;
        rol: string;
        debeCambiar: boolean;
        permisos: string[];
      }>('/auth/yo');

      setUsuario({
        partyId: yo.partyId,
        nombres: yo.nombres,
        rol: yo.rol,
      });
      setPermisos(yo.permisos || []);
      setDebeCambiar(Boolean(yo.debeCambiar));
    } catch {
      // Si falla /auth/yo no se sobrescriben datos críticos de forma descontrolada
    }
  }, []);

  const renovar = useCallback(async (): Promise<void> => {
    const res = await api.post<{
      accessToken: string;
      debeCambiar: boolean;
      usuario: UsuarioSesion;
    }>('/auth/renovar');

    setTokenAcceso(res.accessToken);
    setDebeCambiar(Boolean(res.debeCambiar));
    setUsuario(res.usuario);

    await cargarYo();
  }, [cargarYo]);

  const ingresar = useCallback(
    async (
      dni: string,
      contrasena: string,
    ): Promise<{ debeCambiar: boolean; usuario: UsuarioSesion }> => {
      const res = await api.post<{
        accessToken: string;
        debeCambiar: boolean;
        usuario: UsuarioSesion;
      }>('/auth/ingresar', { dni, contrasena });

      setTokenAcceso(res.accessToken);
      setDebeCambiar(Boolean(res.debeCambiar));
      setUsuario(res.usuario);

      try {
        await cargarYo();
      } catch {
        // En caso de que yo falle, mantenemos lo devuelto en el ingreso
      }

      return {
        debeCambiar: Boolean(res.debeCambiar),
        usuario: res.usuario,
      };
    },
    [cargarYo],
  );

  const salir = useCallback(async (): Promise<void> => {
    try {
      await api.post('/auth/salir');
    } catch {
      // Ignorar error al salir del servidor
    } finally {
      setTokenAcceso(null);
      setUsuario(null);
      setPermisos([]);
      setDebeCambiar(false);
    }
  }, []);

  const marcarClaveCambiada = useCallback(() => {
    setDebeCambiar(false);
  }, []);

  const tiene = useCallback(
    (permiso: string): boolean => {
      if (!usuario) {
        return false;
      }
      const rolUpper = (usuario.rol || '').toUpperCase();
      if (rolUpper === 'ADMIN') {
        return true;
      }
      if (permisos.includes(permiso)) {
        return true;
      }
      // Soporte si se busca permiso general por módulo ('caja' -> 'caja/ver')
      return permisos.some(
        (p) => p === permiso || p.startsWith(`${permiso}/`),
      );
    },
    [usuario, permisos],
  );

  // Renovar al abrir la página (una sola vez: StrictMode monta dos veces y el token de renovación rota)
  useEffect(() => {
    let montado = true;
    if (!renovacionInicial) {
      renovacionInicial = renovar();
    }
    const esta = renovacionInicial;
    esta
      .catch(() => {
        // Sin sesión previa válida
        if (montado) {
          setUsuario(null);
          setPermisos([]);
          setDebeCambiar(false);
        }
      })
      .finally(() => {
        if (renovacionInicial === esta) {
          renovacionInicial = null;
        }
        if (montado) {
          setCargando(false);
        }
      });

    return () => {
      montado = false;
    };
  }, [renovar]);

  const valor = useMemo<ContextoSesion>(
    () => ({
      usuario,
      permisos,
      debeCambiar,
      cargando,
      autenticado: usuario !== null,
      ingresar,
      salir,
      renovar,
      refrescarYo: cargarYo,
      marcarClaveCambiada,
      tiene,
    }),
    [
      usuario,
      permisos,
      debeCambiar,
      cargando,
      ingresar,
      salir,
      renovar,
      cargarYo,
      marcarClaveCambiada,
      tiene,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoSesion {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error('useSesion debe usarse dentro de un SesionProvider');
  }
  return contexto;
}

export { RutaProtegida } from './RutaProtegida';


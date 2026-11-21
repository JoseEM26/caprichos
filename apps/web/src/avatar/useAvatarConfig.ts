import { useEffect, useState } from 'react';
import { useCuentaOpcional } from '../carta/cuenta/CuentaContext';
import type { ConfigAvatar } from './tipos';

/** Config del avatar de la cuenta (cruda, sin three). `activo` evita la consulta cuando aún no hace falta. */
export function useAvatarConfig(activo: boolean): Partial<ConfigAvatar> | null {
  const ctx = useCuentaOpcional();
  const url = ctx?.cliente?.avatarUrl;
  const cargar = ctx?.cargarAvatar;
  const [cfg, setCfg] = useState<Partial<ConfigAvatar> | null>(null);
  useEffect(() => {
    if (!activo || !url || !cargar) return;
    let vivo = true;
    cargar().then((c) => { if (vivo && c && typeof c === 'object') setCfg(c as Partial<ConfigAvatar>); }).catch(() => {});
    return () => { vivo = false; };
  }, [activo, url, cargar]);
  return cfg;
}

/** Primer nombre del apodo del avatar, o de la cuenta */
export const apodoDe = (cfg: Partial<ConfigAvatar> | null, nombreCuenta?: string) =>
  (cfg?.nombre?.trim() || nombreCuenta?.trim().split(/\s+/)[0] || '').slice(0, 18);

/** «Una vez por día por navegador»: la fecha local guardada; si localStorage falla, no se bloquea nada. */
const CLAVE_SALUDO = 'caprichos.avatar.saludo';
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export function yaSaludoHoy(): boolean {
  try { return localStorage.getItem(CLAVE_SALUDO) === hoy(); } catch { return false; }
}
export function marcarSaludoHoy(): void {
  try { localStorage.setItem(CLAVE_SALUDO, hoy()); } catch { /* sin almacenamiento: saluda cada vez que abre */ }
}

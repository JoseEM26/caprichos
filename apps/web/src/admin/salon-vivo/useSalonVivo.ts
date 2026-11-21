import { useCallback, useEffect, useRef, useState } from 'react';
import { useTiempoReal } from '../../comun/socket';
import { movimientos } from './movimientos';
import { salonVivoApi, type SalonVivo } from './salonVivoApi';

export interface Movimiento { hora: string; texto: string }

const EVENTOS = ['pedido:estado', 'pedido:nuevo', 'pedido:progreso', 'pedido:pago', 'salon:mesa', 'salon:listo', 'salon:espera', 'cocina:comanda', 'reserva:cambio', 'plano:cambio'] as const;
const SONDEO_MS = 8000;

const hhmm = () => new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }).format(new Date());

/** Datos del salón en vivo: se piden al abrir, con cada evento en tiempo real y cada 8 s como respaldo. */
export function useSalonVivo(intervaloMs: number = SONDEO_MS) {
  const [datos, setDatos] = useState<SalonVivo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [bitacora, setBitacora] = useState<Movimiento[]>([]);
  const previo = useRef<SalonVivo | null>(null);

  const cargar = useCallback(async () => {
    try {
      const d = await salonVivoApi.obtener();
      const nuevos = movimientos(previo.current, d);
      previo.current = d;
      setDatos(d);
      setError(null);
      if (nuevos.length) setBitacora((b) => [...nuevos.map((texto) => ({ hora: hhmm(), texto })).reverse(), ...b].slice(0, 8));
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el salón en vivo.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState !== 'hidden') void cargar(); }, intervaloMs);
    return () => clearInterval(id);
  }, [cargar, intervaloMs]);
  useTiempoReal(EVENTOS, cargar, 1200);

  return { datos, error, cargando, bitacora, recargar: cargar };
}

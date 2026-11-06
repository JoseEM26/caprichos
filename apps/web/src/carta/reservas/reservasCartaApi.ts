import { api } from '../../comun/api';

/** Lo que devuelve GET /carta/reservas/opciones (ver reservas-carta.service.ts en la API). */
export interface OpcionesReserva {
  activa: boolean;
  diasMax: number;
  personasMax: number;
  /** dia: 0 = domingo … 6 = sábado (igual que Date.getDay) */
  /** `ultimo`: la última hora en que puede empezar una reserva (la regla que aplica el servidor). */
  horarios: { dia: number; abre: string; cierra: string; ultimo: string }[];
  fechasCerradas: string[];
  fechasEspeciales: { fecha: string; abre: string; cierra: string; ultimo: string }[];
}

export interface DatosSolicitudReserva {
  nombre: string;
  telefono: string;
  personas: number;
  /** YYYY-MM-DD (día de Lima) */
  fecha: string;
  /** HH:mm */
  hora: string;
  nota?: string;
  /** Campo trampa: siempre vacío desde la hoja */
  empresa: string;
}

export interface RespuestaSolicitudReserva {
  ok: boolean;
  solicitudId: string | null;
  resumen: { personas: number; fechaTexto: string; hora: string };
}

export const obtenerOpcionesReserva = () => api.get<OpcionesReserva>('/carta/reservas/opciones');

export const enviarSolicitudReserva = (datos: DatosSolicitudReserva) =>
  api.post<RespuestaSolicitudReserva>('/carta/reservas', datos);

const CLAVE_RECORDADOS = 'caprichos_reserva_datos';

/** Nombre y celular de la última reserva en este navegador (sin datos sensibles). Si el storage falla, no se recuerda nada. */
export function leerDatosRecordados(): { nombre: string; telefono: string } {
  try {
    const crudo = window.localStorage.getItem(CLAVE_RECORDADOS);
    const datos = crudo ? JSON.parse(crudo) : null;
    return { nombre: String(datos?.nombre ?? ''), telefono: String(datos?.telefono ?? '') };
  } catch {
    return { nombre: '', telefono: '' };
  }
}

export function guardarDatosRecordados(datos: { nombre: string; telefono: string }): void {
  try {
    window.localStorage.setItem(CLAVE_RECORDADOS, JSON.stringify(datos));
  } catch {
    // modo privado o storage lleno: se sigue sin recordar
  }
}

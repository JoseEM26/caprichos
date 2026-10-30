import { api } from '../../comun/api';

export type EstadoTextoAlertas = 'Confirmado' | 'Pendiente de confirmar' | 'Sin alertas';

export interface EstadoAlertasUsuario {
  numero: string | null;
  activa: boolean;
  confirmado: boolean;
  confirmadoEn?: string | null;
  estado: EstadoTextoAlertas | string;
}

export interface GuardarAlertasDto {
  numero: string;
  activa: boolean;
}

export interface RespuestaEnviarPrueba {
  ok: boolean;
  mensaje?: string;
}

export const ROLES_ALERTAS_WHATSAPP: readonly string[] = ['ADMIN'] as const;

export function puedeRecibirAlertasWhatsApp(rol?: string | null): boolean {
  if (!rol) return false;
  return ROLES_ALERTAS_WHATSAPP.includes(rol.toUpperCase());
}

export function limpiarNumeroPeruano(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('51') && digits[2] === '9') {
    return digits.slice(2);
  }
  if (digits.length === 9 && digits.startsWith('9')) {
    return digits;
  }
  return digits;
}

export function validarCelularPeruano(numero: string): { valido: boolean; error?: string } {
  const limpio = limpiarNumeroPeruano(numero);
  if (!limpio) {
    return { valido: false, error: 'Ingresa un número celular' };
  }
  if (limpio.length !== 9 || !limpio.startsWith('9')) {
    return { valido: false, error: 'Debe ser un celular peruano de 9 dígitos que empiece con 9' };
  }
  return { valido: true };
}

export function normalizarEstadoAlertas(raw: any): EstadoAlertasUsuario {
  const numero = raw?.numero ?? raw?.celular ?? null;
  const activa = Boolean(raw?.activa ?? raw?.alertasWhatsapp);
  const confirmado = Boolean(raw?.confirmado ?? raw?.alertasWhatsappConfirmadoEn ?? (raw?.estado === 'Confirmado'));
  const confirmadoEn = raw?.confirmadoEn ?? raw?.alertasWhatsappConfirmadoEn ?? null;
  const estado = raw?.estado ?? (confirmado ? 'Confirmado' : activa ? 'Pendiente de confirmar' : 'Sin alertas');

  return {
    numero,
    activa,
    confirmado,
    confirmadoEn,
    estado,
  };
}

export async function obtenerEstadoAlertas(usuarioId: string): Promise<EstadoAlertasUsuario> {
  const raw = await api.get<any>(`/admin/usuarios/${usuarioId}/alertas-whatsapp`);
  return normalizarEstadoAlertas(raw);
}

export async function guardarAlertas(
  usuarioId: string,
  dto: GuardarAlertasDto,
): Promise<EstadoAlertasUsuario> {
  const payload = {
    numero: dto.numero,
    activa: dto.activa,
  };
  const raw = await api.put<any>(`/admin/usuarios/${usuarioId}/alertas-whatsapp`, payload);
  return normalizarEstadoAlertas(raw);
}

export async function enviarMensajePrueba(usuarioId: string): Promise<RespuestaEnviarPrueba> {
  return api.post<RespuestaEnviarPrueba>(`/admin/usuarios/${usuarioId}/alertas-whatsapp/enviar-prueba`, {});
}

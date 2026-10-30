/**
 * Constante con la lista de roles autorizados para recibir alertas por WhatsApp.
 * Fácil de ampliar conforme a las directrices del contrato.
 */
export const ROLES_ALERTAS_WHATSAPP = ['ADMIN'] as const;

export type RolAlertasWhatsapp = (typeof ROLES_ALERTAS_WHATSAPP)[number];

export type EstadoAlertasWhatsapp = 'SIN_ALERTAS' | 'PENDIENTE' | 'CONFIRMADO';

/**
 * Normaliza y valida un número de celular peruano de 9 dígitos que comienza con 9.
 * Soporta entradas con o sin prefijo +51 / 51, espacios, guiones o paréntesis.
 */
export function normalizarCelularPeru(numero?: string | null): {
  valido: boolean;
  celular9?: string;
  celularE164?: string;
} {
  if (!numero || typeof numero !== 'string') {
    return { valido: false };
  }

  const soloDigitos = numero.replace(/\D/g, '');

  // Caso 1: 9 dígitos que comienzan con 9 (ej. 987654321)
  if (soloDigitos.length === 9 && soloDigitos.startsWith('9')) {
    return {
      valido: true,
      celular9: soloDigitos,
      celularE164: `51${soloDigitos}`,
    };
  }

  // Caso 2: 11 dígitos que comienzan con 519 (ej. 51987654321)
  if (soloDigitos.length === 11 && soloDigitos.startsWith('519')) {
    const celular9 = soloDigitos.slice(2);
    return {
      valido: true,
      celular9,
      celularE164: soloDigitos,
    };
  }

  return { valido: false };
}

/**
 * Calcula el estado de alertas que se muestra en la interfaz administrativa:
 * 'Sin alertas' (casilla desmarcada)
 * 'Pendiente de confirmar' (casilla marcada pero sin pulsar el botón de prueba)
 * 'Confirmado' (casilla marcada y confirmación registrada)
 */
export function calcularEstadoAlertas(
  alertasActivas?: boolean | null,
  confirmadoEn?: Date | string | null,
): EstadoAlertasWhatsapp {
  if (!alertasActivas) {
    return 'SIN_ALERTAS';
  }
  if (!confirmadoEn) {
    return 'PENDIENTE';
  }
  return 'CONFIRMADO';
}

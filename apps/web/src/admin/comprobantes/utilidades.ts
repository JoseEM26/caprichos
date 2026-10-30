/**
 * Utilidades para comprobantes y obligaciones legales en el administrativo y carta.
 */

/**
 * Enmascara un documento (DNI o RUC) mostrando los 2 primeros y 2 últimos caracteres (ej. 12****78).
 * Los usuarios con rol ADMIN ven el documento sin enmascarar (DT-75, Ley 29733).
 */
export function enmascararDocumento(doc?: string | null, esAdmin = false): string {
  if (!doc || typeof doc !== 'string') {
    return '****';
  }
  if (esAdmin) {
    return doc;
  }
  const limpio = doc.trim();
  if (limpio.length < 4) {
    return '****';
  }
  return `${limpio.slice(0, 2)}****${limpio.slice(-2)}`;
}

/**
 * Formatea un monto en soles peruanos sin recalcular totales.
 */
export function formatearSoles(monto: number | string | null | undefined): string {
  const num = typeof monto === 'number' ? monto : parseFloat(String(monto || 0));
  if (isNaN(num)) return 'S/ 0.00';
  return `S/ ${num.toFixed(2)}`;
}

/**
 * Retorna las clases y estilos de color según los días hábiles restantes de atención legal.
 */
export function obtenerEstiloUrgencia(diasHabilesRestantes: number): {
  etiqueta: string;
  bg: string;
  fg: string;
  borde: string;
  esVencido: boolean;
} {
  if (diasHabilesRestantes <= 0) {
    return {
      etiqueta: diasHabilesRestantes === 0 ? 'Vence hoy' : `Vencido hace ${Math.abs(diasHabilesRestantes)} días`,
      bg: '#FCEBE6',
      fg: '#B2500F',
      borde: '#B2500F',
      esVencido: true,
    };
  }

  if (diasHabilesRestantes <= 3) {
    return {
      etiqueta: `Faltan ${diasHabilesRestantes} días hábiles (urgente)`,
      bg: '#FEF6E8',
      fg: '#945800',
      borde: '#D99E39',
      esVencido: false,
    };
  }

  return {
    etiqueta: `Faltan ${diasHabilesRestantes} días hábiles`,
    bg: '#EAF7EE',
    fg: '#2F7A45',
    borde: '#2F7A45',
    esVencido: false,
  };
}

/**
 * Copia texto al portapapeles con soporte para entornos modernos y fallback para pruebas.
 */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Si falla o no está soportado en jsdom/iframe
  }

  try {
    if (typeof document !== 'undefined') {
      const area = document.createElement('textarea');
      area.value = texto;
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

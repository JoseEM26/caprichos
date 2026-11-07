/**
 * Utilidades puras para comprobantes de pago y notas de venta (FT-LEG-01, DT-11, DT-77).
 */

/**
 * Valida un DNI peruano: exactamente 8 dígitos numéricos.
 */
export function validarDni(dni?: string | null): boolean {
  if (!dni || typeof dni !== 'string') return false;
  return /^\d{8}$/.test(dni.trim());
}

/**
 * Valida un RUC peruano: exactamente 11 dígitos numéricos que comiencen con 10, 15, 17 o 20.
 * Un RUC de 10 dígitos o con otro prefijo es rechazado (RQ-LEG-01-02).
 */
export function validarRuc(ruc?: string | null): boolean {
  if (!ruc || typeof ruc !== 'string') return false;
  return /^(10|15|17|20)\d{9}$/.test(ruc.trim());
}

/**
 * Tipo de comprobante que se elige al pedir un pedido, cobrarlo o cambiarlo: simple (por defecto), boleta o factura.
 * SIMPLE es un ticket interno: sin datos del cliente y sin SUNAT. La nota de venta no es elegible (03/11/2026).
 */
export type TipoComprobantePedido = 'SIMPLE' | 'BOLETA' | 'FACTURA';
export function esComprobanteElegible(tipo?: string | null): tipo is TipoComprobantePedido {
  return tipo === 'SIMPLE' || tipo === 'BOLETA' || tipo === 'FACTURA';
}

/**
 * Valida los datos requeridos según el tipo de comprobante solicitado.
 * - SIMPLE y NOTA_VENTA: no exigen documento ni razón social.
 * - BOLETA: DNI opcional; si se escribe, debe tener 8 dígitos.
 * - FACTURA: exige RUC válido de 11 dígitos (10, 15, 17 o 20) y razón social no vacía.
 */
export function validarDocumentoComprobante(
  tipo?: string | null,
  doc?: string | null,
  razon?: string | null,
  total?: number,
): { valido: boolean; motivo?: string } {
  const tipoNormalizado = (tipo || 'NOTA_VENTA').trim().toUpperCase();

  if (tipoNormalizado === 'NOTA_VENTA' || tipoNormalizado === 'SIMPLE') {
    return { valido: true };
  }

  if (tipoNormalizado === 'BOLETA') {
    // DNI opcional (decisión del dueño): sin documento la boleta es válida; si se escribe, 8 dígitos
    // SUNAT: boleta sin identificar hasta S/ 700; por encima exige DNI o CE (total, si se conoce)
    if (!doc) {
      if (typeof total === 'number' && total > 700) {
        return { valido: false, motivo: 'La boleta mayor a S/ 700 exige DNI' };
      }
      return { valido: true };
    }
    if (!validarDni(doc)) {
      return {
        valido: false,
        motivo: 'El DNI debe tener exactamente 8 dígitos numéricos',
      };
    }
    return { valido: true };
  }

  if (tipoNormalizado === 'FACTURA') {
    if (!doc || !validarRuc(doc)) {
      return {
        valido: false,
        motivo: 'El RUC debe tener 11 dígitos numéricos y comenzar con 10, 15, 17 o 20',
      };
    }
    if (!razon || typeof razon !== 'string' || razon.trim().length === 0) {
      return {
        valido: false,
        motivo: 'La factura exige razón social',
      };
    }
    return { valido: true };
  }

  return {
    valido: false,
    motivo: `Tipo de comprobante no reconocido: ${tipo}`,
  };
}

/**
 * Enmascara un documento (DNI o RUC) mostrando los 2 primeros y 2 últimos caracteres (ej. 12****78).
 * Copia el criterio de pedidos-admin y caja (DT-75, RNF-CAP-008).
 */
export function enmascararDni(doc?: string | null): string {
  if (!doc || typeof doc !== 'string') {
    return '****';
  }
  const limpio = doc.trim();
  if (limpio.length < 4) {
    return '****';
  }
  return `${limpio.slice(0, 2)}****${limpio.slice(-2)}`;
}

/**
 * Genera el número correlativo con formato: 'NV01-000001'.
 */
export function formatearCorrelativo(serie: string, numero: number): string {
  return `${serie}-${String(numero).padStart(6, '0')}`;
}

/**
 * Formatea una fecha en hora de Lima (America/Lima, UTC-5).
 * Formato devuelto: 'YYYY-MM-DD HH:mm:ss'.
 */
export function formatearFechaHoraLima(fecha: Date = new Date()): string {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const partes = formateador.formatToParts(fecha);
  const getPart = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');
  const second = getPart('second');

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * Extrae las opciones de una línea de pedido garantizando compatibilidad con json o relación Prisma.
 */
export function extraerOpciones(linea: any): Array<{ id?: string; nombre: string; grupo?: string }> {
  if (!linea) return [];

  if (Array.isArray(linea.opcionesElegidas) && linea.opcionesElegidas.length > 0) {
    return linea.opcionesElegidas.map((o: any) => ({
      id: o.opcion_id?.toString() || o.id?.toString(),
      nombre: o.opcion_nombre || o.nombre,
      grupo: o.grupo_nombre || o.grupo,
    }));
  }

  if (Array.isArray(linea.opciones)) {
    return linea.opciones.map((o: any) => ({
      id: o.id?.toString(),
      nombre: o.nombre || o.opcion_nombre,
      grupo: o.grupo || o.grupo_nombre,
    }));
  }

  return [];
}

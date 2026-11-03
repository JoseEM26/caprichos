import { TotalesCalculados, calcularComprobante, EntradaCalculo } from './facturacion.calculo';
import { validarRuc } from '../comprobantes.util';

/** Límite de la boleta sin identificar (SUNAT): más de S/ 700 exige DNI o CE. */
export const BOLETA_SIN_DOCUMENTO_MAX_CENTS = 70000;

/** Error de datos del comprobante: no se envía a SUNAT (queda RECHAZADO con el motivo). */
export class ComprobanteInvalidoError extends Error {
  constructor(public readonly motivo: string) {
    super(motivo);
  }
}

export interface DatosComprobante extends EntradaCalculo {
  tipo: 'BOLETA' | 'FACTURA';
  serie: string;
  numero: number;
  /** Fecha de emisión (cobro). Se formatea en hora de Lima. */
  fecha: Date;
  documento?: string | null;
  razon?: string | null;
  direccion?: string | null;
  correo?: string | null;
}

/** Fecha DD-MM-AAAA en hora de Lima. */
export function fechaFacturacion(fecha: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);
  const dato = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return `${dato('day')}-${dato('month')}-${dato('year')}`;
}

/** Identifica al cliente según el tipo de comprobante (tipos de documento SUNAT: 6 RUC, 1 DNI, - varios). */
export function identificarCliente(d: DatosComprobante) {
  const doc = d.documento?.trim() || '';
  const direccion = d.direccion?.trim() || '';
  if (d.tipo === 'FACTURA') {
    if (!validarRuc(doc)) throw new ComprobanteInvalidoError('La factura exige un RUC válido de 11 dígitos');
    const razon = d.razon?.trim() || '';
    if (!razon) throw new ComprobanteInvalidoError('La factura exige razón social');
    return { tipo: '6', numero: doc, denominacion: razon, direccion };
  }
  if (!doc) {
    if (d.totalCents > BOLETA_SIN_DOCUMENTO_MAX_CENTS) {
      throw new ComprobanteInvalidoError('Boleta mayor a S/ 700 exige DNI o CE');
    }
    return { tipo: '-', numero: '-', denominacion: 'CLIENTE VARIOS', direccion: '' };
  }
  if (!/^\d{8}$/.test(doc)) throw new ComprobanteInvalidoError('El DNI debe tener 8 dígitos');
  const nombre = d.razon?.trim() || 'CLIENTE';
  return { tipo: '1', numero: doc, denominacion: nombre, direccion };
}

export interface ComprobanteArmado {
  totales: TotalesCalculados;
  /** Fecha de emisión DD-MM-AAAA (hora de Lima). */
  fecha: string;
}

/**
 * Valida los datos del comprobante (cliente y montos) y calcula los totales. Lanza ComprobanteInvalidoError
 * si los datos no sirven; no hace red.
 */
export function armarComprobante(d: DatosComprobante): ComprobanteArmado {
  identificarCliente(d);
  let totales: TotalesCalculados;
  try {
    totales = calcularComprobante(d);
  } catch (e: any) {
    throw new ComprobanteInvalidoError(e?.message || 'Montos no válidos');
  }
  return { totales, fecha: fechaFacturacion(d.fecha) };
}

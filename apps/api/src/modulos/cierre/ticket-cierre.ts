import { desglosarConteo, TicketCierreDatos } from '@caprichos/compartido';
import { calcularTotalConteo } from './cierre.util';

const num = (v: unknown) => Number(v ?? 0);
const redondear = (n: number) => Math.round(n * 100) / 100;
const hora = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }) : '';

/** Fecha de caja (DATE a medianoche UTC) como dd/mm/aaaa, sin cambio de zona. */
const fechaCaja = (d: Date | string) => {
  const [a, m, dia] = new Date(d).toISOString().slice(0, 10).split('-');
  return `${dia}/${m}/${a}`;
};

export interface FuentesTicketCierre {
  localNombre: string;
  caja: { id: bigint | number; fecha: Date | string; apertura: unknown; abierta_por: bigint | number; cerrada_por: bigint | number | null; cerrada_en: Date | string | null };
  cierre: { resultado: string; aprobado_por: bigint | number | null; nota: string | null; conteo: unknown; medios: Array<{ medio: string; sistema: unknown; visto: unknown; diferencia: unknown }> };
  conteos: Array<{ intento: number; conteo: unknown; resultado: string; por: bigint | number; en: Date | string }>;
  movimientos: Array<{ tipo: string; monto: unknown; motivo: string; anulado_en: Date | string | null }>;
  ajustes: Array<{ medio: string; montoAnterior: number; montoNuevo: number; motivo: string; porNombre: string | null; creadoEn: Date | string }>;
  liquidaciones: Array<{ repartidor_party_id: bigint | number; esperado: unknown; entregado: unknown; en: Date | string }>;
  cobrosAnulados: Array<{ pedido: { codigo: string }; total: unknown; anulado_en: Date | string | null; anulado_por: bigint | number | null }>;
  nombre: (id: bigint | number | null | undefined) => string | null;
}

/** Arma los datos del ticket de cierre (los mismos para el modal, la vista previa y la impresión). */
export function armarTicketCierre(f: FuentesTicketCierre): TicketCierreDatos {
  const medios = f.cierre.medios.map((m) => {
    const sistema = num(m.sistema);
    const visto = num(m.visto);
    return { medio: m.medio, sistema, visto, diferencia: m.diferencia != null ? num(m.diferencia) : redondear(visto - sistema) };
  });
  const efectivo = medios.find((m) => m.medio.toUpperCase() === 'EFECTIVO');
  const conteo = f.cierre.conteo as Record<string, unknown> | null;
  return {
    tipo: 'TICKET_CIERRE',
    local: { nombre: f.localNombre },
    codigo: `CZ-${String(f.caja.id).padStart(4, '0')}`,
    fecha: fechaCaja(f.caja.fecha),
    cerradoEn: f.caja.cerrada_en ? hora(f.caja.cerrada_en) : null,
    abiertoPor: f.nombre(f.caja.abierta_por),
    cerradoPor: f.nombre(f.caja.cerrada_por),
    apertura: num(f.caja.apertura),
    resultado: f.cierre.resultado === 'CUADRA' ? 'CUADRA' : 'NO_CUADRA',
    diferencia: redondear(medios.reduce((t, m) => t + m.diferencia, 0)),
    aprobadoPor: f.nombre(f.cierre.aprobado_por),
    nota: f.cierre.nota,
    efectivo: {
      desglose: desglosarConteo(conteo),
      contado: efectivo?.visto ?? 0,
      esperado: efectivo?.sistema ?? 0,
      diferencia: efectivo?.diferencia ?? 0,
    },
    intentos: f.conteos.map((c) => ({
      n: c.intento,
      hora: hora(c.en),
      por: f.nombre(c.por),
      resultado: c.resultado,
      total: calcularTotalConteo(c.conteo as any),
      desglose: desglosarConteo(c.conteo as Record<string, unknown>),
    })),
    medios,
    movimientos: f.movimientos.map((m) => ({ tipo: m.tipo, monto: num(m.monto), motivo: m.motivo, anulado: m.anulado_en != null })),
    correcciones: f.ajustes.map((a) => ({ medio: a.medio, anterior: a.montoAnterior, nuevo: a.montoNuevo, motivo: a.motivo, por: a.porNombre, hora: hora(a.creadoEn) })),
    liquidaciones: f.liquidaciones.map((l) => ({ repartidor: f.nombre(l.repartidor_party_id) ?? `Repartidor #${l.repartidor_party_id}`, esperado: num(l.esperado), entregado: num(l.entregado), hora: hora(l.en) })),
    anulaciones: f.cobrosAnulados.map((c) => ({ pedido: c.pedido.codigo, total: num(c.total), hora: hora(c.anulado_en), por: f.nombre(c.anulado_por) })),
  };
}

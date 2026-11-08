/**
 * Concilia los pedidos que quedaron PAGADO sin ningún Cobro vigente (confirmaciones de Yape/Plin/transferencia hechas
 * con «Confirmar pago» antes de la corrección, y pagos divididos liquidados al repartidor): su dinero no suma en el
 * cierre ni en los informes y Caja ya no puede cobrarlos (YA_COBRADO).
 *
 * Por defecto es SIMULACRO: no escribe. Imprime, por día, cada pedido (código, medio, total, parte digital y en
 * efectivo, estado de la caja de ese día y qué pasaría) y un CSV listo para copiar. No imprime nombres ni documentos.
 *
 * Con --aplicar crea el Cobro que falta, marcado y auditado (REGULARIZAR_COBRO, motivo
 * «Regularización: pago confirmado sin cobro»), SIN emitir comprobante y de forma idempotente (un pedido que ya
 * tiene cobro vigente no se toca, así que repetir la corrida no duplica):
 *   - Caja de ese día ABIERTA: el cobro va a esa caja (digital y efectivo), con la fecha original.
 *   - Caja de ese día CERRADA o inexistente: el cierre ya hecho NO se toca. Solo la parte DIGITAL se asienta en la
 *     caja abierta actual, con la fecha original en el cobro (los informes lo muestran en su día) y anotada en la
 *     auditoría. Un EFECTIVO de un día cerrado no se mueve: ese efectivo ya estuvo en el arqueo de aquel día y
 *     meterlo en la caja de hoy crearía un faltante; queda listado como «revisar a mano».
 *   - Delivery en efectivo entregado: entra por la liquidación del repartidor; no se crea cobro.
 *
 * Dentro del contenedor de la API (carpeta /app/apps/api):
 *   node dist/scripts/conciliar-cobros.js --desde 2026-11-01 --hasta 2026-11-08 [--aplicar]
 */
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validarEntorno } from '../config/entorno.validacion';
import { PrismaService } from '../comun/prisma/prisma.service';
import { AuditoriaService } from '../modulos/auditoria/auditoria.service';
import { aCentimos, bloquearCaja, enPesos } from '../modulos/caja/caja.calculo';
import { rangoDiaCaja } from '../modulos/cierre/cierre.util';

export const MOTIVO_REGULARIZACION = 'Regularización: pago confirmado sin cobro';
const MAX_DIAS = 93;

export interface OpcionesConciliacion {
  desde: string;
  hasta: string;
  aplicar: boolean;
}

export function leerOpciones(argv: string[]): OpcionesConciliacion {
  const val = (k: string): string | undefined => {
    const i = argv.indexOf(`--${k}`);
    if (i >= 0) return argv[i + 1];
    return argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  };
  const desde = val('desde') ?? '';
  const hasta = val('hasta') ?? desde;
  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  if (!fecha.test(desde) || !fecha.test(hasta) || Number.isNaN(Date.parse(desde)) || Number.isNaN(Date.parse(hasta))) {
    throw new Error('Indica --desde y --hasta con fecha AAAA-MM-DD.');
  }
  const dias = (Date.parse(hasta) - Date.parse(desde)) / 86400000 + 1;
  if (dias < 1 || dias > MAX_DIAS) throw new Error(`El rango debe ir de 1 a ${MAX_DIAS} días (desde <= hasta).`);
  return { desde, hasta, aplicar: argv.includes('--aplicar') };
}

/** Día de Lima (AAAA-MM-DD) de un instante: Lima es UTC-5 todo el año. */
export const diaLima = (d: Date): string => new Date(d.getTime() - 5 * 3600000).toISOString().slice(0, 10);

export interface FilaConciliacion {
  fecha: string;
  codigo: string;
  modalidad: string;
  medio: string;
  total: number;
  digital: number;
  efectivo: number;
  cajaDia: 'ABIERTA' | 'CERRADA' | 'SIN_CAJA';
  accion: string;
}

export interface ResultadoConciliacion {
  filas: FilaConciliacion[];
  creados: number;
  omitidos: number;
  errores: number;
  digitalTotal: number;
  efectivoTotal: number;
}

type Auditar = (e: any) => Promise<unknown>;

export async function conciliarCobros(
  prisma: any,
  auditar: Auditar,
  op: OpcionesConciliacion,
  log: (t: string) => void = console.log,
): Promise<ResultadoConciliacion> {
  const inicio = rangoDiaCaja(new Date(`${op.desde}T00:00:00.000Z`)).inicio;
  const fin = rangoDiaCaja(new Date(`${op.hasta}T00:00:00.000Z`)).fin;
  const enRango = { gte: inicio, lt: fin };

  const pedidos: any[] = await prisma.pedido.findMany({
    where: {
      pago_estado: 'PAGADO',
      estado: { not: 'ANULADO' },
      es_personal: false,
      total: { gt: 0 },
      cobros: { none: { anulado_en: null } },
      OR: [{ pago_coordinado_en: enRango }, { entregado_en: enRango }],
    },
    include: { planPago: true },
    orderBy: { id: 'asc' },
  });

  const cajaActual = op.aplicar
    ? await prisma.caja.findFirst({ where: { estado: 'ABIERTA' }, orderBy: { fecha: 'desc' } })
    : null;

  log(`== Conciliar cobros (${op.desde} a ${op.hasta}, ${op.aplicar ? 'APLICAR' : 'SIMULACRO'}) ==`);
  log(`Pedidos PAGADO sin cobro vigente: ${pedidos.length}`);

  const r: ResultadoConciliacion = { filas: [], creados: 0, omitidos: 0, errores: 0, digitalTotal: 0, efectivoTotal: 0 };
  const cajasCache = new Map<string, any>();

  for (const p of pedidos) {
    const cuando: Date = p.pago_coordinado_en ?? p.entregado_en ?? p.creado_en;
    const dia = diaLima(cuando);
    if (!cajasCache.has(dia)) {
      cajasCache.set(dia, await prisma.caja.findUnique({ where: { fecha: new Date(`${dia}T00:00:00.000Z`) } }));
    }
    const cajaDia = cajasCache.get(dia);
    const estadoCaja: FilaConciliacion['cajaDia'] = cajaDia ? (cajaDia.estado === 'ABIERTA' ? 'ABIERTA' : 'CERRADA') : 'SIN_CAJA';

    const plan: Array<{ medio: string; monto: unknown }> = p.planPago ?? [];
    const renglones = plan.length
      ? plan.map((f) => ({ medio: String(f.medio).toUpperCase(), monto: aCentimos(f.monto) }))
      : [{ medio: String(p.pago_metodo ?? '').toUpperCase(), monto: aCentimos(p.total) }];
    const digitales = renglones.filter((x) => x.medio !== 'EFECTIVO' && x.medio !== 'MIXTO' && x.medio !== '');
    const efectivos = renglones.filter((x) => x.medio === 'EFECTIVO');
    const digital = digitales.reduce((a, x) => a + x.monto, 0);
    const efectivo = efectivos.reduce((a, x) => a + x.monto, 0);
    const porLiquidacion = p.modalidad === 'DELIVERY' && efectivo > 0 && p.estado === 'ENTREGADO';

    // Qué renglones se asientan y en qué caja
    let aAsentar = [...digitales];
    let notaEfectivo = '';
    if (efectivo > 0) {
      if (porLiquidacion) notaEfectivo = 'efectivo por liquidación del repartidor (no se toca)';
      else if (estadoCaja === 'ABIERTA') aAsentar = [...aAsentar, ...efectivos];
      else notaEfectivo = 'efectivo de un día ya cerrado: revisar a mano (no se mueve)';
    }
    const destino = estadoCaja === 'ABIERTA' ? cajaDia : cajaActual;

    let accion: string;
    if (aAsentar.length === 0) accion = notaEfectivo || 'sin renglones que asentar (medio sin detalle): revisar a mano';
    else if (!op.aplicar) {
      accion =
        estadoCaja === 'ABIERTA'
          ? `se crearía el cobro en la caja de ese día (abierta)${notaEfectivo ? '; ' + notaEfectivo : ''}`
          : `el cierre de ese día no cambia; se asentaría ${enPesos(aAsentar.reduce((a, x) => a + x.monto, 0)).toFixed(2)} en la caja abierta de hoy con la fecha original${notaEfectivo ? '; ' + notaEfectivo : ''}`;
    } else if (!destino) {
      accion = 'SIN CAJA ABIERTA: abre la caja y repite';
      r.errores++;
    } else {
      try {
        const creado = await prisma.$transaction(async (tx: any) => {
          const bloqueada = await bloquearCaja(tx, destino.id);
          if (bloqueada?.estado !== 'ABIERTA') throw new Error('la caja destino ya no está abierta');
          const vigente = await tx.cobro.findFirst({ where: { pedido_id: p.id, anulado_en: null }, select: { id: true } });
          const sigue = await tx.pedido.findUnique({ where: { id: p.id }, select: { pago_estado: true, estado: true } });
          if (vigente || sigue?.pago_estado !== 'PAGADO' || sigue?.estado === 'ANULADO') return null;
          const propina = aCentimos(p.propina ?? 0);
          const cobro = await tx.cobro.create({
            data: {
              pedido_id: p.id,
              caja_id: destino.id,
              total: enPesos(aAsentar.reduce((a, x) => a + x.monto, 0)),
              credito_personal: false,
              cobrado_por: BigInt(p.pago_coordinado_por ?? destino.abierta_por),
              en: cuando,
              pagos: {
                create: aAsentar.map((x, i) => ({
                  medio: x.medio,
                  monto: enPesos(x.monto),
                  propina: enPesos(i === 0 ? propina : 0),
                })),
              },
            },
          });
          return cobro;
        });
        if (!creado) {
          r.omitidos++;
          accion = 'ya tenía cobro vigente: omitido';
        } else {
          r.creados++;
          accion = `cobro ${creado.id} creado en la caja ${estadoCaja === 'ABIERTA' ? 'de ese día' : 'abierta de hoy'}${notaEfectivo ? '; ' + notaEfectivo : ''}`;
          await auditar({
            categoria: 'CAMBIO',
            modulo: 'caja',
            accion: 'REGULARIZAR_COBRO',
            resultado: 'OK',
            entidad: 'cobro',
            entidadId: creado.id,
            motivo: MOTIVO_REGULARIZACION,
            despues: {
              pedido: p.codigo,
              fecha_original: cuando.toISOString(),
              caja_destino: String(destino.id),
              caja_del_dia: estadoCaja,
              pagos: aAsentar.map((x) => ({ medio: x.medio, monto: enPesos(x.monto) })),
            },
          });
        }
      } catch (e: any) {
        r.errores++;
        accion = `ERROR: ${e?.response?.codigo ?? e?.message ?? e}`;
      }
    }

    r.digitalTotal += digital;
    r.efectivoTotal += efectivo;
    r.filas.push({
      fecha: dia,
      codigo: p.codigo,
      modalidad: p.modalidad,
      medio: String(p.pago_metodo ?? ''),
      total: enPesos(aCentimos(p.total)),
      digital: enPesos(digital),
      efectivo: enPesos(efectivo),
      cajaDia: estadoCaja,
      accion,
    });
  }

  // Resumen por día y CSV
  const dias = [...new Set(r.filas.map((f) => f.fecha))].sort();
  for (const d of dias) {
    const del = r.filas.filter((f) => f.fecha === d);
    const dig = del.reduce((a, f) => a + aCentimos(f.digital), 0);
    const efe = del.reduce((a, f) => a + aCentimos(f.efectivo), 0);
    log(`Día ${d} (caja ${del[0].cajaDia}): ${del.length} pedido(s), digital S/ ${enPesos(dig).toFixed(2)}, efectivo S/ ${enPesos(efe).toFixed(2)}`);
    for (const f of del) log(`  - ${f.codigo} · ${f.modalidad} · ${f.medio || 's/medio'} · S/ ${f.total.toFixed(2)} · ${f.accion}`);
  }
  log('CSV:');
  log('fecha,codigo,modalidad,medio,total,digital,efectivo,caja_del_dia,accion');
  for (const f of r.filas) {
    log([f.fecha, f.codigo, f.modalidad, f.medio, f.total.toFixed(2), f.digital.toFixed(2), f.efectivo.toFixed(2), f.cajaDia, `"${f.accion.replace(/"/g, "'")}"`].join(','));
  }
  log(
    op.aplicar
      ? `Creados: ${r.creados} · omitidos: ${r.omitidos} · errores: ${r.errores}`
      : `SIMULACRO: no se escribió nada. Total digital S/ ${enPesos(r.digitalTotal).toFixed(2)}, efectivo S/ ${enPesos(r.efectivoTotal).toFixed(2)}. Para crear los cobros, repite con --aplicar.`,
  );
  return r;
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno })],
  providers: [PrismaService, AuditoriaService],
})
class ModuloConsolaConciliar {}

async function main(argv: string[]): Promise<number> {
  const op = leerOpciones(argv);
  const app = await NestFactory.createApplicationContext(ModuloConsolaConciliar, { logger: ['error', 'warn'] });
  try {
    const auditoria = app.get(AuditoriaService);
    const r = await conciliarCobros(app.get(PrismaService), (e) => auditoria.registrar(e), op);
    return r.errores > 0 ? 2 : 0;
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((codigo) => process.exit(codigo))
    .catch((e) => {
      console.error(`ABORTADO: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    });
}

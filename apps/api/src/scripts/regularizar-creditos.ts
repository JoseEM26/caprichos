/**
 * Regulariza el crédito del personal: registra el consumo de los pedidos «del personal» que quedaron sin acumular
 * (antes de la corrección, el pedido del personal no cargaba nada en Créditos). Idempotente: un pedido con consumo
 * ya registrado no se vuelve a tocar (y consumo_personal.pedido_id es único).
 *
 * Por defecto es SIMULACRO: no escribe. Imprime cuántos pedidos y cuánto por persona, con los nombres enmascarados.
 * Con --aplicar registra el consumo (monto = total del pedido menos el descuento del personal) sin cambiar el pedido.
 * Con --aplicar --ajustar-descuento, además deja el pedido con el descuento del personal aplicado (descuento y total
 * del pedido cambian: úsalo solo si Caja confirma que esos pedidos no se cobraron en dinero).
 *
 * A quién se le carga: cliente_party_id del pedido o, si no lo trae, el nombre del cliente («Nombre Apellido (personal)»)
 * cuando coincide con UN solo trabajador activo. Lo que no se puede identificar se lista como «sin identificar» y no se toca.
 * Solo pedidos con es_personal = true (un pedido hecho como cliente normal no se puede reconocer como del personal).
 *
 * Dentro del contenedor de la API (carpeta /app/apps/api):
 *   node dist/scripts/regularizar-creditos.js [--dias 60] [--aplicar] [--ajustar-descuento]
 */
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validarEntorno } from '../config/entorno.validacion';
import { PrismaService } from '../comun/prisma/prisma.service';
import { AuditoriaService } from '../modulos/auditoria/auditoria.service';
import { CreditosService } from '../modulos/creditos/creditos.service';
import { planDescuentoPersonalDePedido } from '../modulos/creditos/descuento-personal';

export interface OpcionesRegularizacion {
  dias: number;
  aplicar: boolean;
  ajustarDescuento: boolean;
}

export function leerOpciones(argv: string[]): OpcionesRegularizacion {
  const val = (k: string): string | undefined => {
    const i = argv.indexOf(`--${k}`);
    if (i >= 0) return argv[i + 1];
    return argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  };
  const dias = Number(val('dias'));
  return {
    dias: Number.isFinite(dias) && dias > 0 ? Math.floor(dias) : 60,
    aplicar: argv.includes('--aplicar'),
    ajustarDescuento: argv.includes('--ajustar-descuento'),
  };
}

/** «Kevin Rosales» -> «K••• R••••••»: solo la inicial, sin revelar el nombre. */
export function enmascarar(nombre: string): string {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => `${p[0]}${'•'.repeat(Math.min(Math.max(p.length - 1, 2), 6))}`)
      .join(' ') || '—'
  );
}

const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(personal\)/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

type Servicio = Pick<CreditosService, 'registrarConsumo' | 'listarPersonalActivo'>;

export interface ResultadoRegularizacion {
  pedidos: number;
  registrados: number;
  sinIdentificar: number;
  errores: number;
  porPersona: Array<{ nombre: string; pedidos: number; monto: number }>;
}

export async function regularizarCreditos(
  prisma: any,
  creditos: Servicio,
  op: OpcionesRegularizacion,
  log: (t: string) => void = console.log,
  ahora: Date = new Date(),
): Promise<ResultadoRegularizacion> {
  const desde = new Date(ahora.getTime() - op.dias * 24 * 60 * 60 * 1000);
  const pedidos: any[] = await prisma.pedido.findMany({
    where: {
      es_personal: true,
      creado_en: { gte: desde },
      estado: { notIn: ['ANULADO', 'RECHAZADO'] },
      consumoPersonal: null,
    },
    include: { lineas: true },
    orderBy: { id: 'asc' },
  });

  const personal = await creditos.listarPersonalActivo();
  const porNombre = new Map<string, string[]>();
  for (const p of personal) {
    const k = normalizar(p.nombre);
    porNombre.set(k, [...(porNombre.get(k) ?? []), p.partyId]);
  }
  const nombreDe = new Map(personal.map((p) => [p.partyId, p.nombre]));

  log(`== Regularizar créditos del personal (últimos ${op.dias} días, ${op.aplicar ? 'APLICAR' : 'SIMULACRO'}${op.ajustarDescuento ? ' + ajustar descuento' : ''}) ==`);
  log(`Pedidos del personal sin consumo registrado: ${pedidos.length}`);

  const acumulado = new Map<string, { nombre: string; pedidos: number; monto: number }>();
  const r: ResultadoRegularizacion = { pedidos: pedidos.length, registrados: 0, sinIdentificar: 0, errores: 0, porPersona: [] };

  for (const pedido of pedidos) {
    let partyId: string | null = pedido.cliente_party_id ? String(pedido.cliente_party_id) : null;
    if (!partyId && pedido.cliente_nombre) {
      const candidatos = porNombre.get(normalizar(pedido.cliente_nombre)) ?? [];
      if (candidatos.length === 1) partyId = candidatos[0];
    }
    if (!partyId) {
      r.sinIdentificar++;
      log(`- ${pedido.codigo}: sin identificar (no trae trabajador ni su nombre coincide con uno solo); no se toca`);
      continue;
    }
    const plan = await planDescuentoPersonalDePedido(prisma, pedido, BigInt(partyId));
    const nombre = nombreDe.get(partyId) ?? `party ${partyId}`;
    log(
      `- ${pedido.codigo}: ${enmascarar(nombre)} · total S/ ${Number(pedido.total).toFixed(2)} · descuento personal S/ ${plan.descuento.toFixed(2)} · a cargo S/ ${plan.montoNeto.toFixed(2)}${
        plan.yaTraeDescuento ? '' : op.ajustarDescuento ? ' · se ajusta el pedido' : ' · pedido sin el descuento aplicado'
      }`,
    );
    if (op.aplicar) {
      try {
        await creditos.registrarConsumo(pedido.id, partyId, undefined, undefined, op.ajustarDescuento);
      } catch (e: any) {
        r.errores++;
        log(`  ERROR ${pedido.codigo}: ${e?.response?.codigo ?? e?.message ?? e}`);
        continue;
      }
      r.registrados++;
    }
    const a = acumulado.get(partyId) ?? { nombre: enmascarar(nombre), pedidos: 0, monto: 0 };
    a.pedidos++;
    a.monto = Math.round((a.monto + plan.montoNeto) * 100) / 100;
    acumulado.set(partyId, a);
  }

  r.porPersona = [...acumulado.values()];
  log('Por persona:');
  for (const p of r.porPersona) log(`  ${p.nombre}: ${p.pedidos} pedido(s), S/ ${p.monto.toFixed(2)}`);
  log(
    op.aplicar
      ? `Registrados: ${r.registrados} · sin identificar: ${r.sinIdentificar} · errores: ${r.errores}`
      : `SIMULACRO: no se escribió nada. Para registrar, repite con --aplicar.`,
  );
  return r;
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno })],
  providers: [PrismaService, AuditoriaService, CreditosService],
})
class ModuloConsolaCreditos {}

async function main(argv: string[]): Promise<number> {
  const op = leerOpciones(argv);
  const app = await NestFactory.createApplicationContext(ModuloConsolaCreditos, { logger: ['error', 'warn'] });
  try {
    await regularizarCreditos(app.get(PrismaService), app.get(CreditosService), op);
    return 0;
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

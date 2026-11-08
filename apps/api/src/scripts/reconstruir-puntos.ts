/**
 * Reconstrucción de puntos por ventas anteriores, desde la consola del servidor. Se corre a mano, nunca sola.
 *
 * Recorre los pedidos PAGADOS (no anulados ni rechazados) que NO tienen movimiento de puntos de suma y a los que
 * se les puede identificar un celular válido (o ya tienen cliente), y les acredita lo que les correspondía con
 * la MISMA función que usa el cobro en vivo: PuntosService.acumularPorPedido (porcentaje `puntos_porcentaje`
 * vigente, solo productos sin descuento ni promoción, sin cortesías, sin cupón, restando lo canjeado).
 * Si la regla o el porcentaje cambiaron desde la venta, se aplica el de HOY (documentado en docs/operacion).
 *
 * Por defecto es SIMULACRO: no escribe nada (ni siquiera crea las cuentas de celular). Imprime un resumen:
 * pedidos, clientes, total de puntos, motivos de omisión y los 10 mayores con el celular enmascarado.
 * Con --aplicar acredita de verdad, un pedido a la vez (cada uno en su transacción) y deja una auditoría.
 *
 * Idempotente: la BD tiene único (pedido_id, tipo) en movimiento_puntos y el filtro excluye los pedidos que ya
 * sumaron; correrlo dos veces no duplica. Cada movimiento queda como SUMA con el motivo
 * «Reconstrucción de puntos por ventas anteriores · pedido CÓDIGO».
 *
 * Dentro del contenedor de la API (carpeta /app/apps/api):
 *   node dist/scripts/reconstruir-puntos.js            (simulacro)
 *   node dist/scripts/reconstruir-puntos.js --aplicar  (acredita)
 *
 * Códigos de salida: 0 corrió; 1 error de ejecución.
 */
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validarEntorno } from '../config/entorno.validacion';
import { PrismaService } from '../comun/prisma/prisma.service';
import { AuditoriaService } from '../modulos/auditoria/auditoria.service';
import { PuntosService } from '../modulos/clientes/puntos.service';
import { PartyPuntosService, celularValido } from '../modulos/clientes/party-puntos.service';
import { CANALES_CLIENTE_EN_PARTY } from '../modulos/clientes/cliente-del-pedido';

export const MOTIVO_RECONSTRUCCION = 'Reconstrucción de puntos por ventas anteriores';
const LOTE = 200;

/** 987654321 -> 9•••••321: nunca el número completo en la salida. */
export function enmascararCelular(c9: string): string {
  return `${c9.slice(0, 1)}•••••${c9.slice(-3)}`;
}

export interface DepsReconstruccion {
  prisma: { pedido: { findMany: (args: any) => Promise<any[]> } };
  puntos: Pick<PuntosService, 'acumularPorPedido'>;
  auditoria?: Pick<AuditoriaService, 'registrar'>;
}

/** Pedidos candidatos: pagados, no anulados, sin SUMA, con celular o cliente. */
export const FILTRO_CANDIDATOS = {
  pago_estado: 'PAGADO',
  estado: { notIn: ['ANULADO', 'RECHAZADO'] },
  movimientosPuntos: { none: { tipo: 'SUMA' } },
  OR: [
    { cliente_telefono: { not: null } },
    { cliente_party_id: { not: null } },
    { canal: { in: CANALES_CLIENTE_EN_PARTY }, party_id: { not: null } },
  ],
};

export async function ejecutarReconstruccion(
  deps: DepsReconstruccion,
  aplicar: boolean,
  salida: (linea: string) => void = console.log,
): Promise<number> {
  const porCliente = new Map<string, { etiqueta: string; puntos: number; pedidos: number }>();
  const omitidos: Record<string, number> = {};
  let revisados = 0;
  let acreditados = 0;
  let errores = 0;
  let total = 0;
  let cuentasNuevas = 0;
  const nuevasVistas = new Set<string>();
  let desdeId = 0n;

  salida(aplicar ? 'APLICADO: se acreditan los puntos.' : 'SIMULACRO: no se escribe nada.');

  for (;;) {
    const lote = await deps.prisma.pedido.findMany({
      where: { ...FILTRO_CANDIDATOS, id: { gt: desdeId } },
      orderBy: { id: 'asc' },
      take: LOTE,
      select: { id: true, codigo: true, cliente_telefono: true },
    });
    if (!lote.length) break;
    for (const p of lote) {
      desdeId = p.id;
      revisados++;
      try {
        const r = await deps.puntos.acumularPorPedido(p.id, {
          simular: !aplicar,
          motivo: `${MOTIVO_RECONSTRUCCION} · pedido ${p.codigo}`,
        });
        if (r.puntos <= 0 || r.motivoNo === 'YA_SUMADO') {
          const m = r.motivoNo ?? 'SIN_PUNTOS';
          omitidos[m] = (omitidos[m] ?? 0) + 1;
          continue;
        }
        if (aplicar && !r.sumados) {
          omitidos[r.motivoNo ?? 'SIN_PUNTOS'] = (omitidos[r.motivoNo ?? 'SIN_PUNTOS'] ?? 0) + 1;
          continue;
        }
        const c9 = celularValido(p.cliente_telefono);
        const clave = r.partyId ? `p${r.partyId}` : `t${c9}`;
        const etiqueta = c9 ? enmascararCelular(c9) : `cliente #${r.partyId}`;
        if (r.partyNuevo && !nuevasVistas.has(clave)) {
          nuevasVistas.add(clave);
          cuentasNuevas++;
        }
        const fila = porCliente.get(clave) ?? { etiqueta, puntos: 0, pedidos: 0 };
        fila.puntos = Math.round((fila.puntos + r.puntos) * 100) / 100;
        fila.pedidos++;
        porCliente.set(clave, fila);
        acreditados++;
        total = Math.round((total + r.puntos) * 100) / 100;
      } catch (e) {
        errores++;
        salida(`error en pedido ${p.codigo}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  const top = [...porCliente.values()].sort((a, b) => b.puntos - a.puntos).slice(0, 10);
  salida(`Pedidos revisados: ${revisados}`);
  salida(`${aplicar ? 'Pedidos acreditados' : 'Pedidos a acreditar'}: ${acreditados}`);
  salida(`${aplicar ? 'Clientes beneficiados' : 'Clientes a beneficiar'}: ${porCliente.size}`);
  if (!aplicar) salida(`Cuentas de celular que se crearían (sin verificar): ${cuentasNuevas}`);
  salida(`Total de puntos: ${total.toFixed(2)}`);
  salida(`Omitidos: ${Object.entries(omitidos).map(([k, v]) => `${k}=${v}`).join(' · ') || 'ninguno'}`);
  salida(`Errores: ${errores}`);
  salida('Top 10 (celular enmascarado):');
  top.forEach((t, i) => salida(`  ${i + 1}. ${t.etiqueta} — ${t.puntos.toFixed(2)} pts en ${t.pedidos} pedido(s)`));

  if (aplicar) {
    await deps.auditoria?.registrar({
      categoria: 'CAMBIO',
      modulo: 'puntos',
      accion: 'RECONSTRUIR_PUNTOS',
      resultado: errores ? 'RECHAZADO' : 'OK',
      entidad: 'movimiento_puntos',
      motivo: MOTIVO_RECONSTRUCCION,
      despues: { pedidos: acreditados, clientes: porCliente.size, puntos: total, errores },
    });
  }
  return 0;
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno })],
  providers: [PrismaService, AuditoriaService, PartyPuntosService, PuntosService],
})
class ModuloConsolaPuntos {}

async function main(argv: string[]): Promise<number> {
  const app = await NestFactory.createApplicationContext(ModuloConsolaPuntos, { logger: ['error', 'warn'] });
  try {
    return await ejecutarReconstruccion(
      { prisma: app.get(PrismaService), puntos: app.get(PuntosService), auditoria: app.get(AuditoriaService) },
      argv.includes('--aplicar'),
    );
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

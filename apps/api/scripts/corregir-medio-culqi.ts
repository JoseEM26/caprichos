/**
 * Corrige el medio de un cobro en línea de Culqi que quedó registrado con un medio equivocado (p. ej. YAPE en vez de
 * TARJETA). Consulta el cargo en Culqi (GET /charges/{id}); lo que Culqi confirma manda.
 *
 * NO SE EJECUTÓ. Sin --aplicar solo muestra el plan (dry-run). Uso:
 *   CULQI_SECRET_KEY=... CULQI_PUBLIC_KEY=... npx ts-node scripts/corregir-medio-culqi.ts chr_live_XXXX
 *   ... chr_live_XXXX --aplicar --motivo "texto del motivo (10 caracteres o más)"
 *
 * Con --aplicar cambia pagoOnlineIntento.medio (y marca/últimos 4) y cobro_pago.medio del cobro CULQI vigente, y deja
 * una fila de auditoría (MEDIO_CORREGIDO_MANUAL). Solo corrige cobros de caja ABIERTA: con caja cerrada no toca nada
 * y hay que decidirlo en Caja con un ADMIN (no hay permiso ni cierre que el script pueda reabrir).
 */
import { PrismaClient } from '@prisma/client';
import { CulqiAdaptador } from '../src/modulos/pagos-online/culqi.adaptador';
import { AuditoriaService } from '../src/modulos/auditoria/auditoria.service';

async function main(): Promise<void> {
  const argumentos = process.argv.slice(2);
  const cargoId = argumentos.find((a) => !a.startsWith('--'));
  const aplicar = argumentos.includes('--aplicar');
  const i = argumentos.indexOf('--motivo');
  const motivo = i >= 0 ? String(argumentos[i + 1] ?? '').trim() : '';
  if (!cargoId || !/^chr_[A-Za-z0-9_]{3,80}$/.test(cargoId)) throw new Error('Indica el id del cargo (chr_...)');
  const secretKey = process.env.CULQI_SECRET_KEY;
  const publicKey = process.env.CULQI_PUBLIC_KEY;
  if (!secretKey || !publicKey) throw new Error('Faltan CULQI_SECRET_KEY y CULQI_PUBLIC_KEY');
  if (aplicar && motivo.length < 10) throw new Error('Con --aplicar, --motivo es obligatorio (10 caracteres o más)');

  const cargo = await new CulqiAdaptador({ secretKey, publicKey, apiUrl: process.env.CULQI_API_URL }).consultarCargo(cargoId);
  if (!cargo) throw new Error('Culqi no conoce el cargo');
  if (cargo.estado !== 'APROBADO') throw new Error(`El cargo está ${cargo.estado}: no hay cobro que corregir`);
  if (!cargo.medioReal) throw new Error('Culqi no informa el medio del cargo: revisarlo a mano en el panel');

  const prisma = new PrismaClient();
  try {
    const intento = await prisma.pagoOnlineIntento.findUnique({ where: { culqi_cargo_id: cargoId } });
    if (!intento) throw new Error('Ningún intento del sistema tiene ese cargo');
    if (cargo.metadata?.intento !== intento.clave) throw new Error('El cargo no pertenece a ese intento');
    const pago = await prisma.cobroPago.findFirst({
      where: { origen: 'CULQI', cobro: { pedido_id: intento.pedido_id, anulado_en: null } },
      include: { cobro: { include: { caja: true } } },
    });
    console.log(JSON.stringify({
      cargo: cargoId,
      monto_centimos: intento.monto_centimos,
      medio_en_intento: intento.medio,
      medio_en_cobro: pago?.medio ?? null,
      medio_culqi: cargo.medioReal,
      marca_culqi: cargo.marca,
      ultimos4_culqi: cargo.ultimos4,
      caja: pago?.cobro.caja.estado ?? null,
    }, null, 2));
    if (intento.medio === cargo.medioReal && pago?.medio === cargo.medioReal) return console.log('Sin diferencia: nada que corregir.');
    if (!pago) throw new Error('El pedido no tiene cobro CULQI vigente en Caja: no se corrige por script');
    if (pago.cobro.caja.estado !== 'ABIERTA') throw new Error('La caja de ese cobro está cerrada: no se corrige por script; decidirlo en Caja con un ADMIN');
    if (!aplicar) return console.log('Dry-run: no se cambió nada. Repite con --aplicar --motivo "..." para corregir.');

    await prisma.$transaction(async (tx) => {
      await tx.pagoOnlineIntento.update({
        where: { id: intento.id },
        data: { medio: cargo.medioReal, marca: cargo.marca ?? intento.marca, ultimos4: cargo.ultimos4 ?? intento.ultimos4 },
      });
      await tx.cobroPago.update({ where: { id: pago.id }, data: { medio: cargo.medioReal } });
    });
    await new AuditoriaService(prisma as any).registrar({
      categoria: 'CAMBIO',
      modulo: 'pagos_online',
      accion: 'MEDIO_CORREGIDO_MANUAL',
      resultado: 'OK',
      entidad: 'pago_online_intento',
      entidadId: intento.id,
      motivo,
      despues: { medio_anterior_cobro: pago.medio, medio_nuevo: cargo.medioReal, cargo: cargoId },
    } as any);
    console.log(`Corregido: cobro ${pago.cobro_id} y intento ${intento.id} quedan como ${cargo.medioReal}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`No se corrigió nada: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});

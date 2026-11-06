import { BadRequestException } from '@nestjs/common';
import { ConfigurarHorarioDto } from './dto/horario.dto';

const aHora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
export const deHora = (d: Date) => d.toISOString().slice(11, 16);

/**
 * Guarda horario por día y reemplazos fijos dentro de una transacción.
 * Nada se borra: lo que ya no aplica queda con activo=false.
 */
export async function guardarHorarioTx(tx: any, partyId: bigint, dto: ConfigurarHorarioDto) {
  if (dto.horarios) {
    const dias = new Set<number>();
    for (const h of dto.horarios) {
      if (dias.has(h.dia)) {
        throw new BadRequestException({ codigo: 'HORARIO_INVALIDO', mensaje: 'Hay un día repetido en el horario' });
      }
      dias.add(h.dia);
      if (h.entrada === h.salida) {
        throw new BadRequestException({
          codigo: 'HORARIO_INVALIDO',
          mensaje: 'La entrada y la salida no pueden ser iguales',
        });
      }
      if (Boolean(h.almuerzoInicio) !== Boolean(h.almuerzoFin)) {
        throw new BadRequestException({
          codigo: 'HORARIO_INVALIDO',
          mensaje: 'El almuerzo necesita inicio y fin (o ninguno)',
        });
      }
    }
    const existentes: any[] = await tx.horarioTrabajo.findMany({ where: { party_id: partyId } });
    for (let dia = 0; dia <= 6; dia++) {
      const quiere = dto.horarios.find((h) => h.dia === dia);
      const filas = existentes.filter((e) => e.dia_semana === dia);
      if (quiere) {
        const data = {
          entrada: aHora(quiere.entrada),
          salida: aHora(quiere.salida),
          almuerzo_inicio: quiere.almuerzoInicio ? aHora(quiere.almuerzoInicio) : null,
          almuerzo_fin: quiere.almuerzoFin ? aHora(quiere.almuerzoFin) : null,
          activo: true,
        };
        if (filas.length) await tx.horarioTrabajo.update({ where: { id: filas[0].id }, data });
        else await tx.horarioTrabajo.create({ data: { party_id: partyId, dia_semana: dia, ...data } });
        if (filas.length > 1) {
          await tx.horarioTrabajo.updateMany({
            where: { id: { in: filas.slice(1).map((f) => f.id) } },
            data: { activo: false },
          });
        }
      } else if (filas.some((f) => f.activo)) {
        await tx.horarioTrabajo.updateMany({
          where: { id: { in: filas.map((f) => f.id) } },
          data: { activo: false },
        });
      }
    }
  }

  if (dto.reemplazos) {
    const dias = new Set<number>();
    for (const r of dto.reemplazos) {
      if (dias.has(r.dia)) {
        throw new BadRequestException({ codigo: 'REEMPLAZO_INVALIDO', mensaje: 'Hay un día repetido en los reemplazos' });
      }
      dias.add(r.dia);
      if (BigInt(r.reemplazaPartyId) === partyId) {
        throw new BadRequestException({
          codigo: 'REEMPLAZO_MISMA_PERSONA',
          mensaje: 'Una persona no puede reemplazarse a sí misma',
        });
      }
    }
    const ids = [...new Set(dto.reemplazos.map((r) => BigInt(r.reemplazaPartyId)))];
    if (ids.length) {
      const activos: any[] = await tx.userAccount.findMany({
        where: { party_id: { in: ids }, activo: true },
        select: { party_id: true },
      });
      if (activos.length !== ids.length) {
        throw new BadRequestException({
          codigo: 'REEMPLAZO_INVALIDO',
          mensaje: 'El reemplazo debe ser personal activo',
        });
      }
    }
    for (const r of dto.reemplazos) {
      const reemplaza = BigInt(r.reemplazaPartyId);
      await tx.reemplazoDia.upsert({
        where: { party_id_dia_semana: { party_id: partyId, dia_semana: r.dia } },
        create: { party_id: partyId, dia_semana: r.dia, reemplaza_party_id: reemplaza, activo: true },
        update: { reemplaza_party_id: reemplaza, activo: true },
      });
    }
    await tx.reemplazoDia.updateMany({
      where: { party_id: partyId, activo: true, dia_semana: { notIn: [...dias] } },
      data: { activo: false },
    });
  }
}

/** Quién cubre a `partyId` en `fecha`: la cobertura por fecha manda; si no, el reemplazo fijo del día (si no trabaja ese día). */
export async function reemplazoDe(prisma: any, partyId: bigint, fecha: Date): Promise<bigint | null> {
  const dia = fecha.getUTCDay();
  const cob = await prisma.coberturaTurno.findFirst({
    where: { reemplaza_party_id: partyId, fecha },
  });
  if (cob) return cob.cubre_party_id; // cubre_party_id = quien entra a cubrir a partyId
  const trabaja = await prisma.horarioTrabajo.findFirst({ where: { party_id: partyId, dia_semana: dia, activo: true } });
  if (trabaja) return null;
  const fijo = await prisma.reemplazoDia.findFirst({ where: { party_id: partyId, dia_semana: dia, activo: true } });
  return fijo?.reemplaza_party_id ?? null;
}

import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { obtenerFechaHoraLima } from './cocina.util';

/**
 * Número del día del pedido en cocina (referencial: no reemplaza el código CP-xxxx ni va a comprobantes).
 *
 * Momento de asignación: la primera vez que el pedido llega a cocina (al crear sus comanda_area),
 * dentro de la misma transacción. El día es el calendario de America/Lima de ese instante.
 * Un pedido ya numerado conserva su número para siempre, también si se anula.
 *
 * Atómico: el contador del día se incrementa con INSERT ... ON CONFLICT DO UPDATE ... RETURNING,
 * que bloquea su fila hasta el commit. Así dos llegadas simultáneas reciben 7 y 8, nunca el mismo
 * número. Si el pedido ya tenía número (otra transacción llegó antes), se lanza error y la
 * transacción completa se revierte, incluido el incremento: no quedan huecos.
 */
export async function asignarNumeroDia(
  tx: Prisma.TransactionClient,
  pedidoId: bigint,
  ahora: Date = new Date(),
): Promise<number> {
  const fecha = obtenerFechaHoraLima(ahora).fechaIso; // YYYY-MM-DD, día Lima

  const filas = await tx.$queryRaw<Array<{ ultimo: number }>>`
    INSERT INTO "contador_diario" ("fecha", "ultimo")
    VALUES (${fecha}::date, 1)
    ON CONFLICT ("fecha") DO UPDATE SET "ultimo" = "contador_diario"."ultimo" + 1
    RETURNING "ultimo"`;
  const numero = Number(filas[0].ultimo);

  const { count } = await tx.pedido.updateMany({
    where: { id: pedidoId, numero_dia: null },
    data: { numero_dia: numero, fecha_dia: new Date(`${fecha}T00:00:00.000Z`) },
  });
  if (count !== 1) {
    throw new ConflictException({
      codigo: 'NUMERO_DIA_YA_ASIGNADO',
      mensaje: 'El pedido ya tiene número del día',
    });
  }
  return numero;
}

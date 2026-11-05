import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';

/** Preferencias personales por usuario (party + clave), guardadas en la base. Solo quien las fija las ve o cambia. */
@Injectable()
export class PreferenciasUsuarioService {
  constructor(private readonly prisma: PrismaService) {}

  /** Valor guardado, o undefined si el usuario no fijó esa clave. */
  async obtener(partyId: bigint | string | number, clave: string): Promise<unknown | undefined> {
    const fila = await this.prisma.preferenciaUsuario.findUnique({
      where: { party_id_clave: { party_id: BigInt(partyId), clave } },
    });
    return fila?.valor ?? undefined;
  }

  /** Guarda (o reemplaza) la preferencia del usuario. */
  async guardar(partyId: bigint | string | number, clave: string, valor: Prisma.InputJsonValue): Promise<void> {
    const party_id = BigInt(partyId);
    await this.prisma.preferenciaUsuario.upsert({
      where: { party_id_clave: { party_id, clave } },
      create: { party_id, clave, valor },
      update: { valor, actualizado_en: new Date() },
    });
  }

  /** Quita la preferencia del usuario; si no existe, no hace nada. */
  async borrar(partyId: bigint | string | number, clave: string): Promise<void> {
    await this.prisma.preferenciaUsuario.deleteMany({ where: { party_id: BigInt(partyId), clave } });
  }
}

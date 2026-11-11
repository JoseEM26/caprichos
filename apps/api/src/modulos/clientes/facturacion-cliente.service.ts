import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { rucValido } from '../ruc';

export interface FacturacionCliente {
  ruc: string;
  razonSocial: string | null;
  direccion: string | null;
}

/** RUC enmascarado para auditoría y avisos: «20*******67». Un RUC 10… lleva el DNI de la persona. */
export function enmascararRuc(ruc?: string | null): string {
  const r = (ruc ?? '').trim();
  return r.length >= 4 ? `${r.slice(0, 2)}${'*'.repeat(r.length - 4)}${r.slice(-2)}` : '****';
}

/**
 * Datos para facturar de la cuenta del cliente (un RUC por cuenta, opcional). Se asigna la primera vez que un pedido
 * con FACTURA trae un RUC válido; no se sobrescribe solo. El DNI de la boleta no se guarda.
 */
@Injectable()
export class FacturacionClienteService {
  private readonly logger = new Logger(FacturacionClienteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async obtener(partyId: bigint | number | string): Promise<FacturacionCliente | null> {
    const f = await this.prisma.clienteFacturacion.findUnique({ where: { party_id: BigInt(partyId) } });
    return f ? { ruc: f.ruc, razonSocial: f.razon_social, direccion: f.direccion } : null;
  }

  /**
   * Guarda el RUC en la cuenta si todavía no tiene uno. Nunca lanza: un fallo aquí no puede romper el pedido.
   * Devuelve true solo si lo asignó.
   */
  async asignarSiFalta(
    partyId: bigint | number | string | null | undefined,
    datos: { ruc?: string | null; razonSocial?: string | null; direccion?: string | null },
    contexto: { canal: string; actorPartyId?: bigint | number | string | null; pedido?: string | null },
  ): Promise<boolean> {
    try {
      if (partyId === null || partyId === undefined || !rucValido(datos.ruc)) return false;
      const party = BigInt(partyId);
      // createMany + skipDuplicates: si dos pedidos llegan a la vez, gana el primero y el otro no hace nada
      const r = await this.prisma.clienteFacturacion.createMany({
        data: [
          {
            party_id: party,
            ruc: datos.ruc,
            razon_social: datos.razonSocial?.trim().slice(0, 200) || null,
            direccion: datos.direccion?.trim().slice(0, 300) || null,
            origen: contexto.canal,
          },
        ],
        skipDuplicates: true,
      });
      if (r.count === 0) return false;
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'clientes',
        accion: 'RUC_ASIGNADO_A_CUENTA',
        entidad: 'party',
        entidadId: party,
        partyId: contexto.actorPartyId !== null && contexto.actorPartyId !== undefined ? BigInt(contexto.actorPartyId) : undefined,
        despues: { canal: contexto.canal, ruc: enmascararRuc(datos.ruc), pedido: contexto.pedido ?? null },
      });
      return true;
    } catch (e: any) {
      this.logger.warn(`No se guardó el RUC en la cuenta (el pedido sigue): ${e?.code ?? e?.name ?? 'error'}`);
      return false;
    }
  }
}

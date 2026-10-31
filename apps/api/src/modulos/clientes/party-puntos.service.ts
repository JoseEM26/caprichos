import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { TELEFONO_PLACEHOLDER } from '../chatbot/utilidades/enmascarar.util';
import { normalizarCelularPeru } from '../usuarios/alertas-whatsapp.util';

const TIPOS_TELEFONO = ['TELEFONO', 'WHATSAPP'];

/** Celular de 9 dígitos que empieza en 9 (mismo criterio que celular9De de clientes.service). */
function celular9(raw: string | null | undefined): string | null {
  const n = normalizarCelularPeru(raw);
  return n.valido ? (n.celular9 ?? null) : null;
}

/**
 * Cliente que acumula puntos solo con su celular (sin nombre real, sin contraseña, sin cuenta).
 * Canjear puntos sigue exigiendo cuenta completa: eso lo valida PedidosService.
 */
@Injectable()
export class PartyPuntosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Party que acumula puntos para ese celular. Reutiliza cuenta activa o party suelto; si no hay nada, lo crea.
   * Null si el celular no es válido, es el relleno 999999999 o su cuenta está desactivada.
   */
  async resolverOCrear(telefono: string | null | undefined): Promise<bigint | null> {
    const tel = celular9(telefono);
    if (!tel || tel === TELEFONO_PLACEHOLDER) return null;

    const existente = await this.buscar(tel);
    if (existente === 'INACTIVA') return null;
    if (existente) return existente;

    try {
      return await this.crear(tel);
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
      // Carrera con otro registro del mismo celular: se vuelve a buscar sin crear
      const otra = await this.buscar(tel);
      return otra === 'INACTIVA' ? null : otra;
    }
  }

  private async buscar(tel: string): Promise<bigint | 'INACTIVA' | null> {
    // Cuenta activa: por el celular de la cuenta o por un contacto de un party con cuenta activa
    const cuenta = await this.prisma.customerAccount.findFirst({ where: { telefono: tel, activo: true }, select: { party_id: true } });
    if (cuenta) return cuenta.party_id;
    const contactoCuenta = await this.prisma.contactMechanism.findFirst({
      where: {
        tipo: { in: TIPOS_TELEFONO },
        valor: { in: [tel, `51${tel}`] },
        activo: true,
        party: { usuario: { is: null }, cuentaCliente: { is: { activo: true, telefono: null } } },
      },
      select: { party_id: true },
    });
    if (contactoCuenta) return contactoCuenta.party_id;

    const inactiva = await this.prisma.customerAccount.findFirst({
      where: {
        activo: false,
        OR: [
          { telefono: tel },
          { party: { contactos: { some: { tipo: { in: TIPOS_TELEFONO }, valor: { in: [tel, `51${tel}`] }, activo: true } } } },
        ],
      },
      select: { id: true },
    });
    if (inactiva) return 'INACTIVA';

    // Una persona = un party: también reutiliza el party de personal (con usuario) que tenga ese celular
    const suelto = await this.prisma.contactMechanism.findFirst({
      where: {
        tipo: { in: TIPOS_TELEFONO },
        valor: { in: [tel, `51${tel}`] },
        activo: true,
        party: { tipo: 'PERSONA', estado: 'ACTIVO', cuentaCliente: { is: null } },
      },
      select: { party_id: true },
    });
    if (!suelto) return null;
    await this.asegurarRolCliente(suelto.party_id);
    return suelto.party_id;
  }

  /** Rol CLIENTE vigente con customer_detail (puntos 0) para un party que ya existe. */
  private async asegurarRolCliente(partyId: bigint): Promise<void> {
    const rol = await this.prisma.partyRole.findFirst({
      where: { party_id: partyId, rol: 'CLIENTE', hasta: null },
      include: { customer_detail: true },
    });
    if (!rol) {
      await this.prisma.$transaction(async (tx) => {
        const nuevo = await tx.partyRole.create({ data: { party_id: partyId, rol: 'CLIENTE' } });
        await tx.customerDetail.create({ data: { party_role_id: nuevo.id, puntos: 0 } });
      });
    } else if (!rol.customer_detail) {
      await this.prisma.customerDetail.create({ data: { party_role_id: rol.id, puntos: 0 } });
    }
  }

  private async crear(tel: string): Promise<bigint> {
    return this.prisma.$transaction(async (tx) => {
      const party = await tx.party.create({ data: { tipo: 'PERSONA', estado: 'ACTIVO' } });
      await tx.person.create({ data: { party_id: party.id, nombres: 'Cliente' } });
      await tx.contactMechanism.create({ data: { party_id: party.id, tipo: 'TELEFONO', valor: tel, principal: true } });
      const rol = await tx.partyRole.create({ data: { party_id: party.id, rol: 'CLIENTE' } });
      await tx.customerDetail.create({ data: { party_role_id: rol.id, puntos: 0 } });
      return party.id;
    });
  }
}

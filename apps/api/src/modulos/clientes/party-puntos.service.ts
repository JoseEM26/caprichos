import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { TELEFONO_PLACEHOLDER } from '../chatbot/utilidades/enmascarar.util';
import { normalizarCelularPeru } from '../usuarios/alertas-whatsapp.util';

const TIPOS_TELEFONO = ['TELEFONO', 'WHATSAPP'];
/** Nombre provisional del party que crea el puntos por celular, hasta que el cliente diga el suyo. */
const NOMBRE_PROVISIONAL = 'Cliente';

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

  /**
   * Completa nombre y cumpleaños del party que el checkout acaba de identificar, solo si le faltan.
   * Nunca pisa un nombre real ni un cumpleaños ya guardado.
   */
  async completarDatos(partyId: bigint, datos: { nombre?: string; cumple?: { dia: number; mes: number } }): Promise<void> {
    const persona = await this.prisma.person.findUnique({ where: { party_id: partyId }, select: { nombres: true, cumple_dia: true } });
    const data: { nombres?: string; cumple_dia?: number; cumple_mes?: number } = {};
    if (datos.nombre && (!persona || persona.nombres === NOMBRE_PROVISIONAL)) data.nombres = datos.nombre;
    if (datos.cumple && persona?.cumple_dia == null) {
      data.cumple_dia = datos.cumple.dia;
      data.cumple_mes = datos.cumple.mes;
    }
    if (Object.keys(data).length === 0) return;
    await this.prisma.person.upsert({
      where: { party_id: partyId },
      create: { party_id: partyId, nombres: data.nombres ?? NOMBRE_PROVISIONAL, cumple_dia: data.cumple_dia ?? null, cumple_mes: data.cumple_mes ?? null },
      update: data,
    });
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
      await tx.person.create({ data: { party_id: party.id, nombres: NOMBRE_PROVISIONAL } });
      await tx.contactMechanism.create({ data: { party_id: party.id, tipo: 'TELEFONO', valor: tel, principal: true } });
      const rol = await tx.partyRole.create({ data: { party_id: party.id, rol: 'CLIENTE' } });
      await tx.customerDetail.create({ data: { party_role_id: rol.id, puntos: 0 } });
      return party.id;
    });
  }
}

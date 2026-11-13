import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuditoriaService } from '../auditoria/auditoria.service';
import type { UsuarioAutenticado } from '../acceso/acceso.tipos';

type Db = Pick<Prisma.TransactionClient, 'contactMechanism' | 'customerAccount' | 'userAccount' | 'person' | 'party'>;

// Mismos tipos y mensaje que clientes/celular-party.util (copiados: un módulo no importa los internos de otro)
const TIPOS_CELULAR = ['TELEFONO', 'WHATSAPP'];

export type MotivoOtraPersona = 'USUARIO' | 'CUENTA_VINCULADA' | 'USUARIO_YA_VINCULADO' | 'VARIAS_CUENTAS' | 'PERSONA';

const MENSAJES: Record<MotivoOtraPersona, string> = {
  USUARIO: 'Ese celular ya lo usa otro usuario del equipo',
  CUENTA_VINCULADA: 'Ese celular es de una cuenta de cliente ya vinculada a otra persona',
  USUARIO_YA_VINCULADO: 'Este usuario ya tiene otra cuenta de cliente vinculada. Desvincúlala primero en la sección Cuenta de cliente',
  VARIAS_CUENTAS: 'Ese celular está en varias cuentas de cliente. Vincula la correcta a mano en la sección Cuenta de cliente',
  PERSONA: 'Ese celular ya esta registrado en otra persona',
};

export type ResultadoCelular =
  | { estado: 'LIBRE' }
  /** El celular ya es de la cuenta vinculada a este usuario: no hay nada que hacer. */
  | { estado: 'YA_VINCULADA' }
  | { estado: 'VINCULARA_CUENTA'; cuentaId: bigint; cuentaPartyId: bigint; nombre: string; celularEnmascarado: string; mismoNombre: boolean }
  /** El celular es de un party «invitado» (pidió o chateó, sin usuario ni cuenta): se le crea la cuenta de cliente y se vincula. */
  | { estado: 'CREARA_CUENTA'; partyGuestId: bigint; nombre: string; celularEnmascarado: string }
  | { estado: 'OTRA_PERSONA'; motivo: MotivoOtraPersona; mensaje: string };

const otra = (motivo: MotivoOtraPersona): ResultadoCelular => ({ estado: 'OTRA_PERSONA', motivo, mensaje: MENSAJES[motivo] });

export const excepcionCelular = (motivo: MotivoOtraPersona) =>
  new ConflictException({ codigo: 'CELULAR_DUPLICADO', mensaje: MENSAJES[motivo], motivo });

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const primero = (s?: string | null) => sinTildes(s ?? '').split(/\s+/)[0] ?? '';

/**
 * ponytail: «mismo nombre» = primer nombre y primer apellido iguales (sin tildes ni mayúsculas). No es identidad:
 * solo decide si hace falta que el ADMIN confirme «es la misma persona».
 */
export function mismoNombre(a: { nombres?: string | null; apellidos?: string | null }, b: { nombres?: string | null; apellidos?: string | null }): boolean {
  return !!primero(a.nombres) && primero(a.nombres) === primero(b.nombres) && !!primero(a.apellidos) && primero(a.apellidos) === primero(b.apellidos);
}

/**
 * Qué pasa si el usuario `partyId` (null = alta sin party aún) pone `celular9`:
 * - libre o ya suyo → LIBRE; ya es de su cuenta vinculada → YA_VINCULADA;
 * - de una cuenta de cliente ACTIVA sin usuario ni vínculo → VINCULARA_CUENTA (el contacto queda en el party de la cuenta);
 * - de un party invitado (persona sin usuario ni cuenta de cliente, de pedidos o WhatsApp) → CREARA_CUENTA;
 * - de otro usuario, de una cuenta ya vinculada a otro, o de otra persona → OTRA_PERSONA.
 * En un alta (partyId null) un party sin usuario ni cuenta se reutiliza (comportamiento previo del alta) → LIBRE.
 */
export async function resolverCelular(
  db: Db,
  partyId: bigint | null,
  celular9: string,
  persona?: { nombres?: string | null; apellidos?: string | null },
): Promise<ResultadoCelular> {
  const variantes = [celular9, `51${celular9}`];
  const contactos = await db.contactMechanism.findMany({
    where: { tipo: { in: TIPOS_CELULAR }, valor: { in: variantes }, activo: true },
    select: { party_id: true },
  });
  const cuentasTel = await db.customerAccount.findMany({
    where: { telefono: { in: variantes }, activo: true },
    select: { id: true, party_id: true, usuario_party_id: true },
  });
  const duenos = new Set<bigint>([...contactos.map((c) => c.party_id), ...cuentasTel.map((c) => c.party_id)]);
  if (partyId !== null) duenos.delete(partyId);
  if (partyId !== null && cuentasTel.some((c) => c.usuario_party_id === partyId)) {
    const otros = [...duenos].filter((d) => !cuentasTel.some((c) => c.usuario_party_id === partyId && c.party_id === d));
    if (!otros.length) return { estado: 'YA_VINCULADA' };
  }
  if (!duenos.size) return { estado: 'LIBRE' };

  const candidatas: Array<{ id: bigint; party_id: bigint }> = [];
  const invitados: bigint[] = [];
  for (const dueno of duenos) {
    if (await db.userAccount.findFirst({ where: { party_id: dueno }, select: { id: true } })) return otra('USUARIO');
    const cuenta = await db.customerAccount.findFirst({ where: { party_id: dueno, activo: true }, select: { id: true, party_id: true, usuario_party_id: true } });
    if (!cuenta) {
      if (partyId === null) continue; // alta: se reutiliza ese party
      // Invitado = persona sin ninguna cuenta de cliente (ni desactivada: esa no se reactiva sola)
      const inactiva = await db.customerAccount.findFirst({ where: { party_id: dueno }, select: { id: true } });
      if (inactiva) return otra('PERSONA');
      const p = await db.party.findUnique({ where: { id: dueno }, select: { tipo: true } });
      if (p?.tipo !== 'PERSONA') return otra('PERSONA');
      invitados.push(dueno);
      continue;
    }
    if (cuenta.usuario_party_id !== null) return otra('CUENTA_VINCULADA');
    candidatas.push(cuenta);
  }
  if (!candidatas.length && !invitados.length) return { estado: 'LIBRE' };
  if (candidatas.length + invitados.length > 1) return otra('VARIAS_CUENTAS');
  if (partyId !== null && (await db.customerAccount.findFirst({ where: { usuario_party_id: partyId }, select: { id: true } }))) {
    return otra('USUARIO_YA_VINCULADO');
  }
  if (invitados.length) {
    const g = await db.person.findUnique({ where: { party_id: invitados[0] }, select: { nombres: true, apellidos: true } });
    return {
      estado: 'CREARA_CUENTA',
      partyGuestId: invitados[0],
      nombre: [g?.nombres, g?.apellidos].filter(Boolean).join(' ').trim() || 'Cliente',
      celularEnmascarado: `···${celular9.slice(-3)}`,
    };
  }

  const cuenta = candidatas[0];
  const p = await db.person.findUnique({ where: { party_id: cuenta.party_id }, select: { nombres: true, apellidos: true } });
  const nombre = [p?.nombres, p?.apellidos].filter(Boolean).join(' ').trim() || 'Cliente';
  return {
    estado: 'VINCULARA_CUENTA',
    cuentaId: cuenta.id,
    cuentaPartyId: cuenta.party_id,
    nombre,
    celularEnmascarado: `···${celular9.slice(-3)}`,
    mismoNombre: persona ? mismoNombre(persona, p ?? {}) : false,
  };
}

export const CONFIRMAR_MISMA_PERSONA = {
  codigo: 'CONFIRMAR_VINCULO',
  mensaje: 'El nombre de la cuenta de cliente no coincide con el del usuario. Confirma que es la misma persona para vincularla',
};

export const CONFIRMAR_CREAR_CUENTA = {
  codigo: 'CONFIRMAR_CREAR_CUENTA',
  mensaje: 'Ese celular ya está en el sistema (de pedidos anteriores). Confirma que se creará su cuenta de cliente y quedará vinculada a este trabajador',
};

/**
 * Crea la cuenta de cliente (sin contraseña) sobre un party invitado y la vincula al trabajador. El contacto se queda en el
 * party invitado (igual que al vincular una cuenta existente); sus pedidos y puntos siguen ahí. Dentro de la transacción de quien llama.
 * La entra a la carta con «Crear cuenta» o «¿Olvidaste tu contraseña?» y el código de WhatsApp.
 */
export async function crearCuentaDeInvitado(
  tx: Pick<Prisma.TransactionClient, 'customerAccount' | 'partyRole' | 'customerDetail'>,
  auditoria: AuditoriaService,
  a: { invitadoPartyId: bigint; celular9: string; usuarioId: bigint; usuarioPartyId: bigint; actor?: UsuarioAutenticado; ip?: string; origen: string },
): Promise<void> {
  if (await tx.customerAccount.findFirst({ where: { usuario_party_id: a.usuarioPartyId }, select: { id: true } })) throw excepcionCelular('USUARIO_YA_VINCULADO');
  let cuentaId: bigint;
  try {
    cuentaId = (await tx.customerAccount.create({
      data: { party_id: a.invitadoPartyId, hash: null, telefono: a.celular9, activo: true, usuario_party_id: a.usuarioPartyId },
      select: { id: true },
    })).id;
  } catch (e: any) {
    if (e?.code === 'P2002') throw excepcionCelular('CUENTA_VINCULADA'); // carrera: otra petición ganó
    throw e;
  }
  const rol = await tx.partyRole.findFirst({ where: { party_id: a.invitadoPartyId, rol: 'CLIENTE', hasta: null }, include: { customer_detail: true } });
  if (!rol) {
    const nuevo = await tx.partyRole.create({ data: { party_id: a.invitadoPartyId, rol: 'CLIENTE' } });
    await tx.customerDetail.create({ data: { party_role_id: nuevo.id, puntos: 0 } });
  } else if (!rol.customer_detail) {
    await tx.customerDetail.create({ data: { party_role_id: rol.id, puntos: 0 } });
  }
  await auditoria.registrar(
    {
      categoria: 'CAMBIO', modulo: 'usuarios', accion: 'USUARIO_CREAR_CUENTA_CLIENTE', resultado: 'OK',
      entidad: 'customer_account', entidadId: cuentaId,
      despues: { usuarioId: String(a.usuarioId), usuarioPartyId: String(a.usuarioPartyId), cuentaPartyId: String(a.invitadoPartyId), origen: a.origen },
      partyId: a.actor?.partyId, ip: a.ip,
    },
    tx,
  );
}

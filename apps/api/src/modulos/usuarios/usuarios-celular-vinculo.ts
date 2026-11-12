import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CELULAR_OTRA_PERSONA, TIPOS_CELULAR } from '../clientes/celular-party.util';

type Db = Pick<Prisma.TransactionClient, 'contactMechanism' | 'customerAccount' | 'userAccount' | 'person'>;

export type MotivoOtraPersona = 'USUARIO' | 'CUENTA_VINCULADA' | 'USUARIO_YA_VINCULADO' | 'VARIAS_CUENTAS' | 'PERSONA';

const MENSAJES: Record<MotivoOtraPersona, string> = {
  USUARIO: 'Ese celular ya lo usa otro usuario del equipo',
  CUENTA_VINCULADA: 'Ese celular es de una cuenta de cliente ya vinculada a otra persona',
  USUARIO_YA_VINCULADO: 'Este usuario ya tiene otra cuenta de cliente vinculada. Desvincúlala primero en la sección Cuenta de cliente',
  VARIAS_CUENTAS: 'Ese celular está en varias cuentas de cliente. Vincula la correcta a mano en la sección Cuenta de cliente',
  PERSONA: CELULAR_OTRA_PERSONA.mensaje,
};

export type ResultadoCelular =
  | { estado: 'LIBRE' }
  /** El celular ya es de la cuenta vinculada a este usuario: no hay nada que hacer. */
  | { estado: 'YA_VINCULADA' }
  | { estado: 'VINCULARA_CUENTA'; cuentaId: bigint; cuentaPartyId: bigint; nombre: string; celularEnmascarado: string; mismoNombre: boolean }
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
    where: { tipo: { in: [...TIPOS_CELULAR] }, valor: { in: variantes }, activo: true },
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
  for (const dueno of duenos) {
    if (await db.userAccount.findFirst({ where: { party_id: dueno }, select: { id: true } })) return otra('USUARIO');
    const cuenta = await db.customerAccount.findFirst({ where: { party_id: dueno, activo: true }, select: { id: true, party_id: true, usuario_party_id: true } });
    if (!cuenta) {
      if (partyId === null) continue; // alta: se reutiliza ese party
      return otra('PERSONA');
    }
    if (cuenta.usuario_party_id !== null) return otra('CUENTA_VINCULADA');
    candidatas.push(cuenta);
  }
  if (!candidatas.length) return { estado: 'LIBRE' };
  if (candidatas.length > 1) return otra('VARIAS_CUENTAS');
  if (partyId !== null && (await db.customerAccount.findFirst({ where: { usuario_party_id: partyId }, select: { id: true } }))) {
    return otra('USUARIO_YA_VINCULADO');
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

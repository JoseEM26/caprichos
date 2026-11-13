import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { resolverCelular, excepcionCelular, crearCuentaDeInvitado } from './usuarios-celular-vinculo';

/**
 * Vincula la cuenta de cliente de un trabajador (la que usa en la carta) con su usuario del panel. Es un vínculo
 * explícito y reversible (customer_account.usuario_party_id): NO fusiona personas ni mueve puntos, pedidos, direcciones
 * ni créditos; todo sigue donde está. Su único efecto es que la carta reconozca a esa cuenta como del equipo
 * (descuento de personal). La cuenta de cliente nunca gana permisos del panel. Solo el ADMIN.
 */
@Injectable()
export class UsuariosCuentaClienteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private exigirAdmin(actor?: UsuarioAutenticado): void {
    if (actor?.rol !== 'ADMIN') {
      throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo un administrador puede vincular cuentas de cliente' });
    }
  }

  private async usuario(id: bigint | string | number) {
    if (!/^\d+$/.test(String(id))) throw new NotFoundException({ codigo: 'USUARIO_NO_ENCONTRADO', mensaje: 'Usuario no encontrado' });
    const u = await this.prisma.userAccount.findUnique({ where: { id: BigInt(id) }, select: { id: true, party_id: true, activo: true } });
    if (!u) throw new NotFoundException({ codigo: 'USUARIO_NO_ENCONTRADO', mensaje: 'Usuario no encontrado' });
    return u;
  }

  private async resumen(c: { id: bigint; party_id: bigint; telefono: string | null }) {
    const p = await this.prisma.person.findUnique({ where: { party_id: c.party_id }, select: { nombres: true, apellidos: true } });
    const nombre = [p?.nombres, p?.apellidos].filter(Boolean).join(' ').trim() || 'Cliente';
    return { nombre, celular: c.telefono ? `···${c.telefono.slice(-3)}` : '···' };
  }

  /** Cuenta vinculada hoy a este usuario (solo nombre y celular enmascarado), o null. */
  async estado(id: bigint | string | number, actor?: UsuarioAutenticado) {
    this.exigirAdmin(actor);
    const u = await this.usuario(id);
    const c = await this.prisma.customerAccount.findFirst({ where: { usuario_party_id: u.party_id }, select: { id: true, party_id: true, telefono: true } });
    return { vinculada: c ? await this.resumen(c) : null };
  }

  /** Busca la cuenta activa de ese celular y valida que se pueda vincular. No cambia nada. */
  private async validar(id: bigint | string | number, celular: string) {
    const u = await this.usuario(id);
    if (!u.activo) {
      throw new ConflictException({ codigo: 'USUARIO_DESACTIVADO', mensaje: 'Reactiva al usuario antes de vincular su cuenta de cliente' });
    }
    const cuenta = await this.prisma.customerAccount.findFirst({
      where: { telefono: celular, activo: true },
      select: { id: true, party_id: true, telefono: true, usuario_party_id: true },
    });
    if (!cuenta) {
      // Sin cuenta activa: si el celular es de un invitado (pedidos o WhatsApp sin cuenta), se le crea la cuenta al vincular
      const r = await resolverCelular(this.prisma, u.party_id, celular);
      if (r.estado === 'CREARA_CUENTA') return { u, cuenta: null, crea: r };
      if (r.estado === 'OTRA_PERSONA') throw excepcionCelular(r.motivo);
      throw new NotFoundException({ codigo: 'CUENTA_CLIENTE_NO_ENCONTRADA', mensaje: 'No hay una cuenta de cliente activa con ese celular' });
    }
    if (cuenta.party_id === u.party_id || (await this.prisma.userAccount.findFirst({ where: { party_id: cuenta.party_id }, select: { id: true } }))) {
      throw new ConflictException({ codigo: 'CUENTA_ES_USUARIO', mensaje: 'Esa cuenta ya es de un usuario del panel: no hace falta vincularla' });
    }
    if (cuenta.usuario_party_id) {
      throw new ConflictException({ codigo: 'CUENTA_YA_VINCULADA', mensaje: 'Esa cuenta de cliente ya está vinculada a un usuario' });
    }
    const propia = await this.prisma.customerAccount.findFirst({ where: { usuario_party_id: u.party_id }, select: { id: true } });
    if (propia) {
      throw new ConflictException({ codigo: 'USUARIO_YA_VINCULADO', mensaje: 'Este usuario ya tiene una cuenta de cliente vinculada. Desvincúlala primero' });
    }
    return { u, cuenta, crea: null };
  }

  /** Vista previa para confirmar: solo nombre y celular enmascarado de la cuenta encontrada. */
  async buscar(id: bigint | string | number, celular: string, actor?: UsuarioAutenticado) {
    this.exigirAdmin(actor);
    const { cuenta, crea } = await this.validar(id, celular);
    if (crea) return { nombre: crea.nombre, celular: crea.celularEnmascarado, creara: true as const };
    return this.resumen(cuenta!);
  }

  /**
   * Vista previa de solo lectura de lo que pasará al guardar este celular en el usuario `id` (o en un alta si id es null):
   * LIBRE | VINCULARA_CUENTA (con nombre y celular enmascarado de la cuenta) | OTRA_PERSONA (con motivo y mensaje).
   */
  async previaCelular(id: bigint | string | number | null, celular: string, persona: { nombres?: string | null; apellidos?: string | null } | undefined, actor?: UsuarioAutenticado) {
    this.exigirAdmin(actor);
    let partyId: bigint | null = null;
    let quien: { nombres?: string | null; apellidos?: string | null } | undefined = persona;
    if (id !== null) {
      const u = await this.usuario(id);
      partyId = u.party_id;
      const p = await this.prisma.person.findUnique({ where: { party_id: u.party_id }, select: { nombres: true, apellidos: true } });
      quien = { nombres: persona?.nombres ?? p?.nombres, apellidos: persona?.apellidos ?? p?.apellidos };
    }
    const r = await resolverCelular(this.prisma, partyId, celular, quien);
    if (r.estado === 'VINCULARA_CUENTA') {
      return { estado: r.estado, cuenta: { nombre: r.nombre, celularEnmascarado: r.celularEnmascarado }, mismoNombre: r.mismoNombre };
    }
    if (r.estado === 'CREARA_CUENTA') return { estado: r.estado, cuenta: { nombre: r.nombre, celularEnmascarado: r.celularEnmascarado } };
    if (r.estado === 'OTRA_PERSONA') return { estado: r.estado, motivo: r.motivo, mensaje: r.mensaje };
    return { estado: 'LIBRE' as const, ...(r.estado === 'YA_VINCULADA' ? { yaVinculada: true } : {}) };
  }

  async vincular(id: bigint | string | number, celular: string, actor?: UsuarioAutenticado, ip?: string) {
    this.exigirAdmin(actor);
    const { u, cuenta, crea } = await this.validar(id, celular);
    if (crea) {
      await this.prisma.$transaction((tx) =>
        crearCuentaDeInvitado(tx, this.auditoria, { invitadoPartyId: crea.partyGuestId, celular9: celular, usuarioId: u.id, usuarioPartyId: u.party_id, actor, ip, origen: 'SECCION_CUENTA' }),
      );
      return { ok: true, vinculada: { nombre: crea.nombre, celular: crea.celularEnmascarado }, creada: true };
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        // Condicionado: si otra petición la vinculó entre tanto, no se pisa
        const { count } = await tx.customerAccount.updateMany({ where: { id: cuenta!.id, usuario_party_id: null, activo: true }, data: { usuario_party_id: u.party_id } });
        if (count === 0) throw new ConflictException({ codigo: 'CUENTA_YA_VINCULADA', mensaje: 'Esa cuenta de cliente ya está vinculada a un usuario' });
        await this.auditoria.registrar(
          { categoria: 'CAMBIO', modulo: 'usuarios', accion: 'USUARIO_VINCULAR_CUENTA_CLIENTE', resultado: 'OK', entidad: 'customer_account', entidadId: cuenta!.id, despues: { usuarioId: String(u.id), usuarioPartyId: String(u.party_id), cuentaPartyId: String(cuenta!.party_id) }, partyId: actor?.partyId, ip },
          tx,
        );
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException({ codigo: 'USUARIO_YA_VINCULADO', mensaje: 'Este usuario ya tiene una cuenta de cliente vinculada. Desvincúlala primero' });
      throw e;
    }
    return { ok: true, vinculada: await this.resumen(cuenta!) };
  }

  async desvincular(id: bigint | string | number, actor?: UsuarioAutenticado, ip?: string) {
    this.exigirAdmin(actor);
    const u = await this.usuario(id);
    const cuenta = await this.prisma.customerAccount.findFirst({ where: { usuario_party_id: u.party_id }, select: { id: true, party_id: true } });
    if (!cuenta) throw new NotFoundException({ codigo: 'SIN_CUENTA_VINCULADA', mensaje: 'Este usuario no tiene una cuenta de cliente vinculada' });
    await this.prisma.$transaction(async (tx) => {
      await tx.customerAccount.update({ where: { id: cuenta.id }, data: { usuario_party_id: null } });
      await this.auditoria.registrar(
        { categoria: 'CAMBIO', modulo: 'usuarios', accion: 'USUARIO_DESVINCULAR_CUENTA_CLIENTE', resultado: 'OK', entidad: 'customer_account', entidadId: cuenta.id, antes: { usuarioId: String(u.id), usuarioPartyId: String(u.party_id), cuentaPartyId: String(cuenta.party_id) }, partyId: actor?.partyId, ip },
        tx,
      );
    });
    return { ok: true };
  }
}

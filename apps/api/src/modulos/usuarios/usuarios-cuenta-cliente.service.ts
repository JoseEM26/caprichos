import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ROLES } from '../acceso/permisos';
import { TIPOS_DOCUMENTO, documentoValido } from '../acceso/roles-usuario';
import { resolverCelular, excepcionCelular, crearCuentaDeInvitado, mismoNombre, CONFIRMAR_MISMA_PERSONA } from './usuarios-celular-vinculo';

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

  /** Tipo y número normalizados (mismas reglas que al guardar el usuario). */
  private documento(tipoRaw: string, numeroRaw: string) {
    const tipo = (tipoRaw || 'DNI').trim().toUpperCase();
    if (!(TIPOS_DOCUMENTO as readonly string[]).includes(tipo)) throw new BadRequestException({ codigo: 'TIPO_DOCUMENTO_INVALIDO', mensaje: 'El tipo de documento no es válido' });
    const numero = tipo === 'DNI' ? (numeroRaw ?? '').trim() : (numeroRaw ?? '').trim().toUpperCase();
    if (!documentoValido(tipo, numero)) throw new BadRequestException({ codigo: 'DOCUMENTO_INVALIDO', mensaje: tipo === 'DNI' ? 'El DNI debe tener exactamente 8 dígitos' : `El ${tipo} debe tener de 7 a 12 letras o números` });
    return { tipo, numero };
  }

  private nombreDe(p: { nombres?: string | null; apellidos?: string | null } | null | undefined) {
    return [p?.nombres, p?.apellidos].filter(Boolean).join(' ').trim() || 'Sin nombre';
  }

  /** Dueño del documento distinto de este usuario (null si libre o ya es suyo). */
  private async resolverDocumento(u: { id: bigint; party_id: bigint }, tipoRaw: string, numeroRaw: string) {
    const { tipo, numero } = this.documento(tipoRaw, numeroRaw);
    const ids = await this.prisma.partyIdentifier.findMany({ where: { numero, tipo: { in: [...TIPOS_DOCUMENTO] } }, select: { party_id: true } });
    const pareceCelular = tipo !== 'DNI' && /^9\d{8}$/.test(numero);
    const dueno = ids.find((i) => i.party_id !== u.party_id)?.party_id ?? null;
    return { dueno, pareceCelular, propio: dueno === null && ids.length > 0 };
  }

  /**
   * Vista previa de solo lectura del documento que se quiere poner a este usuario: LIBRE | ES_EL_MISMO | OTRO_USUARIO |
   * CLIENTE | PERSONA_SIN_CUENTA, más `pareceCelular`. No escribe nada ni devuelve documentos, celulares completos o correos.
   */
  async previaDocumento(id: bigint | string | number, tipoDocumento: string, documento: string, actor?: UsuarioAutenticado) {
    this.exigirAdmin(actor);
    const u = await this.usuario(id);
    const { dueno: partyId, pareceCelular, propio } = await this.resolverDocumento(u, tipoDocumento, documento);
    if (partyId === null) return { estado: propio ? ('ES_EL_MISMO' as const) : ('LIBRE' as const), pareceCelular };
    const persona = await this.prisma.person.findUnique({ where: { party_id: partyId }, select: { nombres: true, apellidos: true } });
    const nombre = this.nombreDe(persona);
    const otroUsuario = await this.prisma.userAccount.findFirst({ where: { party_id: partyId }, select: { rol: true } });
    if (otroUsuario) {
      const primero = (persona?.nombres ?? '').trim().split(/\s+/)[0] || 'Una persona';
      return { estado: 'OTRO_USUARIO' as const, pareceCelular, usuario: { nombre: primero, rol: ROLES.find((x) => x.codigo === otroUsuario.rol)?.nombre ?? otroUsuario.rol } };
    }
    const cuenta = await this.prisma.customerAccount.findFirst({ where: { party_id: partyId }, select: { id: true, activo: true, telefono: true, usuario_party_id: true, creado_en: true } });
    const detalle = await this.prisma.customerDetail.findFirst({ where: { party_role: { party_id: partyId, rol: 'CLIENTE' } }, select: { puntos: true } });
    const pedidosWhere = { party_id: partyId, pago_estado: 'PAGADO', anulado_en: null };
    const pedidos = await this.prisma.pedido.count({ where: pedidosWhere });
    const ultimo = pedidos ? await this.prisma.pedido.findFirst({ where: pedidosWhere, orderBy: { creado_en: 'desc' }, select: { creado_en: true } }) : null;
    const ficha = { nombre, puntos: detalle ? Number(detalle.puntos) : 0, pedidos, ultimoPedido: ultimo?.creado_en ?? null };
    if (!cuenta) return { estado: 'PERSONA_SIN_CUENTA' as const, pareceCelular, cliente: { ...ficha, tieneCuenta: false }, puedeVincular: false, motivo: 'Es una persona sin cuenta de cliente: no se puede vincular ni fusionar.' };
    const yaVinculadoA = cuenta.usuario_party_id === null ? null : cuenta.usuario_party_id === u.party_id ? ('ESTE_USUARIO' as const) : ('OTRO_USUARIO' as const);
    const propia = yaVinculadoA === null ? await this.prisma.customerAccount.findFirst({ where: { usuario_party_id: u.party_id }, select: { id: true } }) : null;
    const motivo = !cuenta.activo ? 'La cuenta de cliente está desactivada.'
      : yaVinculadoA === 'ESTE_USUARIO' ? 'Esa cuenta ya está vinculada a este usuario.'
      : yaVinculadoA ? 'Esa cuenta ya está vinculada a otro usuario del equipo.'
      : propia ? 'Este usuario ya tiene otra cuenta de cliente vinculada. Desvincúlala primero.' : null;
    const miPersona = await this.prisma.person.findUnique({ where: { party_id: u.party_id }, select: { nombres: true, apellidos: true } });
    return {
      estado: 'CLIENTE' as const,
      pareceCelular,
      cliente: {
        ...ficha, tieneCuenta: true, cuentaActiva: cuenta.activo, yaVinculadoA, registradoEn: cuenta.creado_en,
        celularEnmascarado: cuenta.telefono ? `···${cuenta.telefono.slice(-3)}` : '···',
        mismoNombre: mismoNombre(miPersona ?? {}, persona ?? {}),
      },
      puedeVincular: motivo === null,
      ...(motivo ? { motivo } : {}),
    };
  }

  /** Vincula la cuenta de cliente dueña de ese documento a este usuario (no cambia su documento ni fusiona personas). */
  async vincularPorDocumento(id: bigint | string | number, tipoDocumento: string, documento: string, confirmaMismaPersona: boolean | undefined, actor?: UsuarioAutenticado, ip?: string) {
    this.exigirAdmin(actor);
    const u = await this.usuario(id);
    if (!u.activo) throw new ConflictException({ codigo: 'USUARIO_DESACTIVADO', mensaje: 'Reactiva al usuario antes de vincular su cuenta de cliente' });
    const { dueno } = await this.resolverDocumento(u, tipoDocumento, documento);
    if (dueno === null) throw new NotFoundException({ codigo: 'CUENTA_CLIENTE_NO_ENCONTRADA', mensaje: 'Ese documento no es de ninguna cuenta de cliente' });
    if (await this.prisma.userAccount.findFirst({ where: { party_id: dueno }, select: { id: true } })) {
      throw new ConflictException({ codigo: 'CUENTA_ES_USUARIO', mensaje: 'Ese documento es de un usuario del panel: no hace falta vincularlo' });
    }
    const cuenta = await this.prisma.customerAccount.findFirst({ where: { party_id: dueno }, select: { id: true, party_id: true, telefono: true, usuario_party_id: true, activo: true } });
    if (!cuenta) throw new NotFoundException({ codigo: 'CUENTA_CLIENTE_NO_ENCONTRADA', mensaje: 'Ese documento es de una persona sin cuenta de cliente' });
    if (!cuenta.activo) throw new ConflictException({ codigo: 'CUENTA_DESACTIVADA', mensaje: 'La cuenta de cliente está desactivada. Reactívala primero en Clientes' });
    if (cuenta.usuario_party_id) throw new ConflictException({ codigo: 'CUENTA_YA_VINCULADA', mensaje: 'Esa cuenta de cliente ya está vinculada a un usuario' });
    if (await this.prisma.customerAccount.findFirst({ where: { usuario_party_id: u.party_id }, select: { id: true } })) {
      throw new ConflictException({ codigo: 'USUARIO_YA_VINCULADO', mensaje: 'Este usuario ya tiene una cuenta de cliente vinculada. Desvincúlala primero' });
    }
    const [mia, suya] = await Promise.all([
      this.prisma.person.findUnique({ where: { party_id: u.party_id }, select: { nombres: true, apellidos: true } }),
      this.prisma.person.findUnique({ where: { party_id: cuenta.party_id }, select: { nombres: true, apellidos: true } }),
    ]);
    const coincide = mismoNombre(mia ?? {}, suya ?? {});
    if (!coincide && !confirmaMismaPersona) throw new ConflictException(CONFIRMAR_MISMA_PERSONA);
    try {
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.customerAccount.updateMany({ where: { id: cuenta.id, usuario_party_id: null, activo: true }, data: { usuario_party_id: u.party_id } });
        if (count === 0) throw new ConflictException({ codigo: 'CUENTA_YA_VINCULADA', mensaje: 'Esa cuenta de cliente ya está vinculada a un usuario' });
        await this.auditoria.registrar(
          { categoria: 'CAMBIO', modulo: 'usuarios', accion: 'USUARIO_VINCULAR_CUENTA_CLIENTE', resultado: 'OK', entidad: 'customer_account', entidadId: cuenta.id, despues: { usuarioId: String(u.id), usuarioPartyId: String(u.party_id), cuentaPartyId: String(cuenta.party_id), origen: 'DOCUMENTO', nombreCoincide: coincide }, partyId: actor?.partyId, ip },
          tx,
        );
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException({ codigo: 'USUARIO_YA_VINCULADO', mensaje: 'Este usuario ya tiene una cuenta de cliente vinculada. Desvincúlala primero' });
      throw e;
    }
    return { ok: true, vinculada: await this.resumen(cuenta) };
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

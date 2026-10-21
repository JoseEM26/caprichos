import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { EditarUsuarioDto } from './dto/editar-usuario.dto';
import { FiltrarUsuariosDto } from './dto/filtrar-usuarios.dto';
import { AsignarPinDto } from './dto/asignar-pin.dto';
import { enmascararDni, generarClaveAleatoria } from './usuarios.util';

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private parsearId(id: bigint | string | number): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'El identificador del usuario no es válido',
      });
    }
  }

  /**
   * Lista usuarios paginados con filtros de rol, estado activo y búsqueda por nombre o DNI.
   * El DNI siempre se devuelve enmascarado.
   */
  async listar(filtros: FiltrarUsuariosDto) {
    const { rol, activo, busqueda } = filtros;
    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const limite = Math.max(1, Math.min(100, Number(filtros.limite) || 20));
    const skip = (pagina - 1) * limite;

    const where: any = {};

    if (rol) {
      where.rol = rol;
    }

    if (activo !== undefined) {
      where.activo = activo;
    }

    if (busqueda && busqueda.trim()) {
      const q = busqueda.trim();
      where.party = {
        OR: [
          {
            persona: {
              OR: [
                { nombres: { contains: q, mode: 'insensitive' } },
                { apellidos: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
          {
            documentos: {
              some: {
                tipo: 'DNI',
                numero: { contains: q },
              },
            },
          },
        ],
      };
    }

    const [total, usuarios] = await Promise.all([
      this.prisma.userAccount.count({ where }),
      this.prisma.userAccount.findMany({
        where,
        skip,
        take: limite,
        include: {
          party: {
            include: {
              persona: true,
              documentos: {
                where: { tipo: 'DNI' },
              },
            },
          },
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    const elementos = usuarios.map((u) => {
      const dniDoc = u.party?.documentos?.[0]?.numero ?? '';
      return {
        id: u.id.toString(),
        partyId: u.party_id.toString(),
        nombres: u.party?.persona?.nombres ?? '',
        apellidos: u.party?.persona?.apellidos ?? '',
        dni: enmascararDni(dniDoc),
        rol: u.rol,
        activo: u.activo,
        debeCambiar: u.debe_cambiar,
        altaEn: u.alta_en,
      };
    });

    return {
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
      elementos,
    };
  }

  /**
   * Obtiene el DNI sin enmascarar. Solo permitido si el usuario autenticado tiene rol ADMIN.
   * Audita como LECTURA_SENSIBLE VER_DNI.
   */
  async obtenerDni(id: bigint | string | number, usuarioActual?: UsuarioAutenticado, ip?: string) {
    if (usuarioActual?.rol !== 'ADMIN') {
      throw new ForbiddenException({
        codigo: 'SIN_PERMISO',
        mensaje: 'Solo los administradores pueden consultar el DNI completo',
      });
    }

    const accountId = this.parsearId(id);
    const usuario = await this.prisma.userAccount.findUnique({
      where: { id: accountId },
      include: {
        party: {
          include: {
            documentos: { where: { tipo: 'DNI' } },
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException({
        codigo: 'USUARIO_NO_ENCONTRADO',
        mensaje: 'Usuario no encontrado',
      });
    }

    const dniDoc = usuario.party?.documentos?.[0]?.numero;
    if (!dniDoc) {
      throw new NotFoundException({
        codigo: 'DNI_NO_ENCONTRADO',
        mensaje: 'El usuario no cuenta con un documento DNI registrado',
      });
    }

    await this.auditoria.registrar({
      categoria: 'LECTURA_SENSIBLE',
      modulo: 'usuarios',
      accion: 'VER_DNI',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: usuario.id,
      partyId: usuarioActual.partyId,
      ip,
    });

    return {
      id: usuario.id.toString(),
      dni: dniDoc,
    };
  }

  /**
   * Crea un nuevo usuario en una sola transacción: Party (PERSONA) + Person + PartyIdentifier (DNI) + UserAccount.
   * Genera contraseña aleatoria de 12 caracteres con hash argon2id y la devuelve una única vez como claveInicial.
   */
  async crear(dto: CrearUsuarioDto, usuarioActual?: UsuarioAutenticado, ip?: string) {
    const dniLimpio = dto.dni.trim();

    // Validar DNI duplicado
    const dniExistente = await this.prisma.partyIdentifier.findUnique({
      where: {
        tipo_numero: {
          tipo: 'DNI',
          numero: dniLimpio,
        },
      },
    });

    if (dniExistente) {
      throw new ConflictException({
        codigo: 'DNI_DUPLICADO',
        mensaje: 'El DNI ya se encuentra registrado en el sistema',
      });
    }

    const claveInicial = generarClaveAleatoria(12);
    const hash = await argon2.hash(claveInicial, { type: argon2.argon2id });

    let nuevo;
    try {
      nuevo = await this.prisma.$transaction(async (tx) => {
        const party = await tx.party.create({
          data: {
            tipo: 'PERSONA',
            estado: 'ACTIVO',
          },
        });

        const person = await tx.person.create({
          data: {
            party_id: party.id,
            nombres: dto.nombres.trim(),
            apellidos: dto.apellidos.trim(),
          },
        });

        const partyIdentifier = await tx.partyIdentifier.create({
          data: {
            party_id: party.id,
            tipo: 'DNI',
            numero: dniLimpio,
          },
        });

        const userAccount = await tx.userAccount.create({
          data: {
            party_id: party.id,
            rol: dto.rol,
            hash,
            debe_cambiar: true,
            activo: true,
          },
        });

        return { party, person, partyIdentifier, userAccount };
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException({
          codigo: 'DNI_DUPLICADO',
          mensaje: 'El DNI ya se encuentra registrado en el sistema',
        });
      }
      throw error;
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'CREAR',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: nuevo.userAccount.id,
      antes: null,
      despues: {
        nombres: dto.nombres.trim(),
        apellidos: dto.apellidos.trim(),
        dni: enmascararDni(dniLimpio),
        rol: dto.rol,
        activo: true,
        debeCambiar: true,
      },
      partyId: usuarioActual?.partyId,
      ip,
    });

    return {
      id: nuevo.userAccount.id.toString(),
      partyId: nuevo.party.id.toString(),
      nombres: nuevo.person.nombres,
      apellidos: nuevo.person.apellidos,
      dni: enmascararDni(dniLimpio),
      rol: nuevo.userAccount.rol,
      activo: nuevo.userAccount.activo,
      debeCambiar: nuevo.userAccount.debe_cambiar,
      claveInicial,
    };
  }

  /**
   * Edita nombres, apellidos o rol. No permite quitar el rol al último ADMIN activo.
   */
  async editar(id: bigint | string | number, dto: EditarUsuarioDto, usuarioActual?: UsuarioAutenticado, ip?: string) {
    const accountId = this.parsearId(id);
    const usuario = await this.prisma.userAccount.findUnique({
      where: { id: accountId },
      include: {
        party: {
          include: {
            persona: true,
            documentos: { where: { tipo: 'DNI' } },
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException({
        codigo: 'USUARIO_NO_ENCONTRADO',
        mensaje: 'Usuario no encontrado',
      });
    }

    // Proteger último ADMIN activo si se intenta cambiar de rol
    if (usuario.rol === 'ADMIN' && usuario.activo && dto.rol && dto.rol !== 'ADMIN') {
      const adminActivos = await this.prisma.userAccount.count({
        where: { rol: 'ADMIN', activo: true },
      });
      if (adminActivos <= 1) {
        throw new ForbiddenException({
          codigo: 'ULTIMO_ADMIN',
          mensaje: 'No se puede quitar el rol al último administrador activo',
        });
      }
    }

    const dniDoc = usuario.party?.documentos?.[0]?.numero ?? '';
    const antes = {
      nombres: usuario.party?.persona?.nombres ?? '',
      apellidos: usuario.party?.persona?.apellidos ?? '',
      rol: usuario.rol,
      dni: enmascararDni(dniDoc),
    };

    const despues = {
      nombres: dto.nombres !== undefined ? dto.nombres.trim() : antes.nombres,
      apellidos: dto.apellidos !== undefined ? dto.apellidos.trim() : antes.apellidos,
      rol: dto.rol !== undefined ? dto.rol : antes.rol,
      dni: enmascararDni(dniDoc),
    };

    await this.prisma.$transaction(async (tx) => {
      if (dto.nombres !== undefined || dto.apellidos !== undefined) {
        await tx.person.update({
          where: { party_id: usuario.party_id },
          data: {
            ...(dto.nombres !== undefined ? { nombres: dto.nombres.trim() } : {}),
            ...(dto.apellidos !== undefined ? { apellidos: dto.apellidos.trim() } : {}),
          },
        });
      }

      if (dto.rol !== undefined) {
        await tx.userAccount.update({
          where: { id: usuario.id },
          data: { rol: dto.rol },
        });
      }
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'EDITAR',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: usuario.id,
      antes,
      despues,
      partyId: usuarioActual?.partyId,
      ip,
    });

    return {
      id: usuario.id.toString(),
      partyId: usuario.party_id.toString(),
      nombres: despues.nombres,
      apellidos: despues.apellidos,
      dni: despues.dni,
      rol: despues.rol,
      activo: usuario.activo,
      debeCambiar: usuario.debe_cambiar,
    };
  }

  /**
   * Desactiva un usuario y revoca todas sus sesiones activas.
   * No permite auto-desactivación ni desactivar al último ADMIN activo.
   */
  async desactivar(id: bigint | string | number, usuarioActual?: UsuarioAutenticado, ip?: string) {
    const accountId = this.parsearId(id);
    const usuario = await this.prisma.userAccount.findUnique({
      where: { id: accountId },
      include: {
        party: {
          include: {
            documentos: { where: { tipo: 'DNI' } },
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException({
        codigo: 'USUARIO_NO_ENCONTRADO',
        mensaje: 'Usuario no encontrado',
      });
    }

    // No auto-desactivación
    if (usuarioActual && usuario.party_id === usuarioActual.partyId) {
      throw new ForbiddenException({
        codigo: 'AUTO_DESACTIVACION',
        mensaje: 'No puede desactivar su propia cuenta',
      });
    }

    // Proteger último ADMIN activo
    if (usuario.rol === 'ADMIN' && usuario.activo) {
      const adminActivos = await this.prisma.userAccount.count({
        where: { rol: 'ADMIN', activo: true },
      });
      if (adminActivos <= 1) {
        throw new ForbiddenException({
          codigo: 'ULTIMO_ADMIN',
          mensaje: 'No se puede desactivar al último administrador activo',
        });
      }
    }

    const dniDoc = usuario.party?.documentos?.[0]?.numero ?? '';

    await this.prisma.$transaction(async (tx) => {
      await tx.userAccount.update({
        where: { id: usuario.id },
        data: { activo: false },
      });

      await tx.sesion.updateMany({
        where: { party_id: usuario.party_id, revocada_en: null },
        data: { revocada_en: new Date() },
      });
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'DESACTIVAR',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: usuario.id,
      antes: { activo: true, rol: usuario.rol, dni: enmascararDni(dniDoc) },
      despues: { activo: false, rol: usuario.rol, dni: enmascararDni(dniDoc) },
      partyId: usuarioActual?.partyId,
      ip,
    });

    return {
      mensaje: 'Usuario desactivado exitosamente',
      activo: false,
    };
  }

  /**
   * Reactiva un usuario previamente desactivado.
   */
  async reactivar(id: bigint | string | number, usuarioActual?: UsuarioAutenticado, ip?: string) {
    const accountId = this.parsearId(id);
    const usuario = await this.prisma.userAccount.findUnique({
      where: { id: accountId },
      include: {
        party: {
          include: {
            documentos: { where: { tipo: 'DNI' } },
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException({
        codigo: 'USUARIO_NO_ENCONTRADO',
        mensaje: 'Usuario no encontrado',
      });
    }

    const dniDoc = usuario.party?.documentos?.[0]?.numero ?? '';

    await this.prisma.userAccount.update({
      where: { id: usuario.id },
      data: { activo: true },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'REACTIVAR',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: usuario.id,
      antes: { activo: false, rol: usuario.rol, dni: enmascararDni(dniDoc) },
      despues: { activo: true, rol: usuario.rol, dni: enmascararDni(dniDoc) },
      partyId: usuarioActual?.partyId,
      ip,
    });

    return {
      mensaje: 'Usuario reactivado exitosamente',
      activo: true,
    };
  }

  /**
   * Restablece la contraseña de un usuario con una nueva contraseña aleatoria de 12 caracteres,
   * marca debe_cambiar=true y revoca todas sus sesiones activas.
   */
  async restablecerClave(id: bigint | string | number, usuarioActual?: UsuarioAutenticado, ip?: string) {
    const accountId = this.parsearId(id);
    const usuario = await this.prisma.userAccount.findUnique({
      where: { id: accountId },
      include: {
        party: {
          include: {
            documentos: { where: { tipo: 'DNI' } },
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException({
        codigo: 'USUARIO_NO_ENCONTRADO',
        mensaje: 'Usuario no encontrado',
      });
    }

    const claveInicial = generarClaveAleatoria(12);
    const hash = await argon2.hash(claveInicial, { type: argon2.argon2id });
    const dniDoc = usuario.party?.documentos?.[0]?.numero ?? '';

    await this.prisma.$transaction(async (tx) => {
      await tx.userAccount.update({
        where: { id: usuario.id },
        data: { hash, debe_cambiar: true },
      });

      await tx.sesion.updateMany({
        where: { party_id: usuario.party_id, revocada_en: null },
        data: { revocada_en: new Date() },
      });
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'RESTABLECER_CLAVE',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: usuario.id,
      antes: { debeCambiar: usuario.debe_cambiar, dni: enmascararDni(dniDoc) },
      despues: { debeCambiar: true, dni: enmascararDni(dniDoc) },
      partyId: usuarioActual?.partyId,
      ip,
    });

    return {
      claveInicial,
      mensaje: 'Contraseña restablecida exitosamente',
    };
  }

  /**
   * Asigna un PIN de 6 dígitos a un usuario con rol ADMIN.
   * Guarda el hash con argon2id.
   */
  async asignarPin(id: bigint | string | number, dto: AsignarPinDto, usuarioActual?: UsuarioAutenticado, ip?: string) {
    const accountId = this.parsearId(id);
    const usuario = await this.prisma.userAccount.findUnique({
      where: { id: accountId },
      include: {
        party: {
          include: {
            documentos: { where: { tipo: 'DNI' } },
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException({
        codigo: 'USUARIO_NO_ENCONTRADO',
        mensaje: 'Usuario no encontrado',
      });
    }

    if (usuario.rol !== 'ADMIN') {
      throw new BadRequestException({
        codigo: 'ROL_INVALIDO',
        mensaje: 'Solo los administradores pueden tener un PIN asignado',
      });
    }

    const pinHash = await argon2.hash(dto.pin, { type: argon2.argon2id });
    const dniDoc = usuario.party?.documentos?.[0]?.numero ?? '';

    await this.prisma.userAccount.update({
      where: { id: usuario.id },
      data: { pin_hash: pinHash },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'ASIGNAR_PIN',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: usuario.id,
      antes: { tienePin: !!usuario.pin_hash, dni: enmascararDni(dniDoc) },
      despues: { tienePin: true, dni: enmascararDni(dniDoc) },
      partyId: usuarioActual?.partyId,
      ip,
    });

    return {
      mensaje: 'PIN de administrador asignado exitosamente',
    };
  }
}

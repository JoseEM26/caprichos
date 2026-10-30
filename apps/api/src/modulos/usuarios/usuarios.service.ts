import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { EditarUsuarioDto } from './dto/editar-usuario.dto';
import { FiltrarUsuariosDto } from './dto/filtrar-usuarios.dto';
import { AsignarPinDto } from './dto/asignar-pin.dto';
import { ConfigurarAlertasWhatsappDto } from './dto/configurar-alertas-whatsapp.dto';
import { ConfigurarHorarioDto } from './dto/horario.dto';
import { deHora, guardarHorarioTx } from './horario.util';
import { enmascararDni, generarClaveAleatoria } from './usuarios.util';
import {
  ROLES_ALERTAS_WHATSAPP,
  calcularEstadoAlertas,
  normalizarCelularPeru,
} from './alertas-whatsapp.util';
import { AvisosInternosService } from '../chatbot/avisos-internos/avisos-internos.service';

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional()
    @Inject(forwardRef(() => AvisosInternosService))
    private readonly avisosInternosService?: AvisosInternosService,
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
            ...(dto.correo ? { correo: dto.correo.trim().toLowerCase() } : {}),
            ...(dto.fechaNacimiento
              ? {
                  cumple_mes: Number(dto.fechaNacimiento.slice(5, 7)),
                  cumple_dia: Number(dto.fechaNacimiento.slice(8, 10)),
                }
              : {}),
          },
        });

        if (dto.celular) {
          await tx.contactMechanism.create({
            data: { party_id: party.id, tipo: 'WHATSAPP', valor: dto.celular, principal: true, activo: true },
          });
        }

        if (dto.descuentoPct !== undefined && dto.descuentoPct !== null) {
          await tx.partyRole.create({
            data: {
              party_id: party.id,
              rol: 'TRABAJADOR',
              employee_detail: { create: { descuento_pct: dto.descuentoPct } },
            },
          });
        }

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

        if (dto.horarios || dto.reemplazos) {
          await guardarHorarioTx(tx, party.id, dto);
        }

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
        diasTrabaja: dto.horarios?.length ?? 0,
        reemplazosFijos: dto.reemplazos?.length ?? 0,
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

  private async cuentaConParty(id: bigint | string | number) {
    const cuenta = await this.prisma.userAccount.findUnique({ where: { id: this.parsearId(id) } });
    if (!cuenta) {
      throw new NotFoundException({ codigo: 'USUARIO_NO_ENCONTRADO', mensaje: 'Usuario no encontrado' });
    }
    return cuenta;
  }

  private async leerHorarios(partyIds: bigint[]) {
    const [horarios, reemplazos] = await Promise.all([
      this.prisma.horarioTrabajo.findMany({ where: { party_id: { in: partyIds }, activo: true } }),
      this.prisma.reemplazoDia.findMany({
        where: { party_id: { in: partyIds }, activo: true },
        include: { reemplaza: { include: { persona: true } } },
      }),
    ]);
    return (partyId: bigint) => ({
      partyId: partyId.toString(),
      horarios: horarios
        .filter((h) => h.party_id === partyId)
        .map((h) => ({ dia: h.dia_semana, entrada: deHora(h.entrada), salida: deHora(h.salida) }))
        .sort((a, b) => a.dia - b.dia),
      reemplazos: reemplazos
        .filter((r) => r.party_id === partyId)
        .map((r) => ({
          dia: r.dia_semana,
          reemplazaPartyId: r.reemplaza_party_id.toString(),
          nombre: `${r.reemplaza.persona?.nombres ?? ''} ${r.reemplaza.persona?.apellidos ?? ''}`.trim(),
        }))
        .sort((a, b) => a.dia - b.dia),
    });
  }

  /** Horario y reemplazos reales de una persona. */
  async obtenerHorario(id: bigint | string | number) {
    const cuenta = await this.cuentaConParty(id);
    return (await this.leerHorarios([cuenta.party_id]))(cuenta.party_id);
  }

  /** Horario y reemplazos de todo el personal activo (pestaña Horarios). */
  async listarHorarios() {
    const cuentas = await this.prisma.userAccount.findMany({
      where: { activo: true },
      include: { party: { include: { persona: true } } },
      orderBy: { id: 'asc' },
    });
    const por = await this.leerHorarios(cuentas.map((c) => c.party_id));
    return cuentas.map((c) => ({
      id: c.id.toString(),
      nombres: c.party.persona?.nombres ?? '',
      apellidos: c.party.persona?.apellidos ?? '',
      rol: c.rol,
      ...por(c.party_id),
    }));
  }

  /** Cambia horario y/o reemplazos fijos de una persona existente, en una transacción. */
  async configurarHorario(
    id: bigint | string | number,
    dto: ConfigurarHorarioDto,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const cuenta = await this.cuentaConParty(id);
    const antes = await this.obtenerHorario(id);
    await this.prisma.$transaction((tx) => guardarHorarioTx(tx, cuenta.party_id, dto));
    const despues = await this.obtenerHorario(id);
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'EDITAR_HORARIO',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: cuenta.id,
      antes,
      despues,
      partyId: usuarioActual?.partyId,
      ip,
    });
    return despues;
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
   * DEPRECADO: El PIN fijo de supervisor ha sido retirado en favor del código rotativo TOTP (RFC 6238).
   * La columna user_account.pin_hash se preserva en base de datos pero este endpoint responde 410 GONE.
   */
  async asignarPin(
    _id: bigint | string | number,
    _dto: AsignarPinDto,
    _usuarioActual?: UsuarioAutenticado,
    _ip?: string,
  ) {
    throw new HttpException(
      {
        codigo: 'PIN_DEPRECADO',
        mensaje:
          'El PIN fijo de supervisor ha sido retirado. Ahora se utiliza el código rotativo general del supervisor.',
      },
      HttpStatus.GONE,
    );
  }

  /**
   * Obtiene el estado de configuración de alertas por WhatsApp de un usuario.
   * Regla de contrato: Solo usuarios con rol ADMIN pueden recibir alertas.
   */
  async obtenerAlertasWhatsapp(id: bigint | string | number) {
    const accountId = this.parsearId(id);
    const usuario = await this.prisma.userAccount.findUnique({
      where: { id: accountId },
      include: {
        party: {
          include: {
            persona: true,
            contactos: {
              where: { tipo: 'WHATSAPP', activo: true },
              orderBy: { principal: 'desc' },
            },
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

    const contacto = usuario.party?.contactos?.find((c) => c.principal) || usuario.party?.contactos?.[0];
    const celularVal = contacto?.valor || null;
    const norm = celularVal ? normalizarCelularPeru(celularVal) : { valido: false };

    const rolPermitido = ROLES_ALERTAS_WHATSAPP.includes(usuario.rol as any);
    const alertasWhatsapp = Boolean(usuario.alertas_whatsapp);
    const estado = calcularEstadoAlertas(alertasWhatsapp, usuario.alertas_whatsapp_confirmado_en);
    const celular9 = norm.valido ? (norm.celular9 || null) : celularVal;

    return {
      usuarioId: usuario.id.toString(),
      partyId: usuario.party_id.toString(),
      nombres: usuario.party?.persona?.nombres ?? '',
      apellidos: usuario.party?.persona?.apellidos ?? '',
      rol: usuario.rol,
      rolPermitido,
      activo: usuario.activo,
      alertasWhatsapp,
      activa: alertasWhatsapp,
      confirmado: Boolean(usuario.alertas_whatsapp_confirmado_en),
      alertasWhatsappConfirmadoEn: usuario.alertas_whatsapp_confirmado_en,
      confirmadoEn: usuario.alertas_whatsapp_confirmado_en,
      celular: celular9,
      numero: celular9,
      celularNormalizado: norm.valido ? (norm.celularE164 || null) : null,
      estado,
    };
  }

  /**
   * Guarda o actualiza el número de celular y la casilla de alertas de WhatsApp.
   * Reglas de contrato:
   * - Solo ADMIN.
   * - El número se almacena en la tabla contact_mechanism (tipo WHATSAPP, principal=true, activo=true).
   * - La casilla y confirmación van en user_account.
   * - Si cambia el número, se borra la confirmación anterior.
   * - Al activar la casilla y guardar número, se envía automáticamente un mensaje de prueba.
   */
  async configurarAlertasWhatsapp(
    id: bigint | string | number,
    dto: ConfigurarAlertasWhatsappDto,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const accountId = this.parsearId(id);
    const usuario = await this.prisma.userAccount.findUnique({
      where: { id: accountId },
      include: {
        party: {
          include: {
            persona: true,
            contactos: {
              where: { tipo: 'WHATSAPP', activo: true },
              orderBy: { principal: 'desc' },
            },
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

    if (!ROLES_ALERTAS_WHATSAPP.includes(usuario.rol as any)) {
      throw new BadRequestException({
        codigo: 'ROL_NO_PERMITIDO',
        mensaje: 'Solo los usuarios con rol ADMIN pueden recibir alertas por WhatsApp',
      });
    }

    const contactoExistente = usuario.party?.contactos?.find((c) => c.principal) || usuario.party?.contactos?.[0];
    const celExistenteVal = contactoExistente?.valor || null;

    const rawCelular = dto.celular ?? dto.numero;
    const activaAlertas = Boolean(dto.alertasWhatsapp ?? dto.alertas_whatsapp ?? dto.activa);

    let nuevoCelular9: string | null = null;
    let nuevoCelularE164: string | null = null;

    if (rawCelular && rawCelular.trim()) {
      const norm = normalizarCelularPeru(rawCelular);
      if (!norm.valido || !norm.celular9 || !norm.celularE164) {
        throw new BadRequestException({
          codigo: 'FORMATO_CELULAR_INVALIDO',
          mensaje: 'El número debe ser un celular peruano de 9 dígitos que comience con 9',
        });
      }
      nuevoCelular9 = norm.celular9;
      nuevoCelularE164 = norm.celularE164;
    } else if (celExistenteVal) {
      const normExistente = normalizarCelularPeru(celExistenteVal);
      nuevoCelular9 = normExistente.valido ? (normExistente.celular9 || null) : celExistenteVal;
      nuevoCelularE164 = normExistente.valido ? (normExistente.celularE164 || null) : null;
    }

    if (activaAlertas && !nuevoCelular9) {
      throw new BadRequestException({
        codigo: 'CELULAR_REQUERIDO',
        mensaje: 'Se requiere un número de celular peruano válido para activar las alertas por WhatsApp',
      });
    }

    // Regla de contrato: Si cambia el número, se borra la confirmación y se pide de nuevo
    const celExistenteSolo9 = celExistenteVal ? celExistenteVal.replace(/\D/g, '').slice(-9) : null;
    const numeroCambio = Boolean(nuevoCelular9 && celExistenteSolo9 && nuevoCelular9 !== celExistenteSolo9);

    await this.prisma.$transaction(async (tx) => {
      if (nuevoCelular9) {
        if (contactoExistente) {
          await tx.contactMechanism.update({
            where: { id: contactoExistente.id },
            data: {
              valor: nuevoCelular9,
              principal: true,
              activo: true,
            },
          });
        } else {
          await tx.contactMechanism.create({
            data: {
              party_id: usuario.party_id,
              tipo: 'WHATSAPP',
              valor: nuevoCelular9,
              principal: true,
              activo: true,
            },
          });
        }
      }

      const nuevoConfirmadoEn = numeroCambio
        ? null
        : activaAlertas
          ? usuario.alertas_whatsapp_confirmado_en
          : null;

      await tx.userAccount.update({
        where: { id: usuario.id },
        data: {
          alertas_whatsapp: activaAlertas,
          alertas_whatsapp_confirmado_en: nuevoConfirmadoEn,
        },
      });
    });

    // Enviar prueba si se guardó con casilla activa y no está confirmado
    const debeEnviarPrueba = activaAlertas && (numeroCambio || !usuario.alertas_whatsapp_confirmado_en) && nuevoCelularE164;
    if (debeEnviarPrueba && nuevoCelularE164) {
      await this.avisosInternosService?.enviarPruebaAlertas(
        usuario.id,
        nuevoCelularE164,
        usuario.party?.persona?.nombres || 'Administrador',
      ).catch(() => {});
    }

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'CONFIGURAR_ALERTAS_WHATSAPP',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: usuario.id,
      antes: {
        alertasWhatsapp: usuario.alertas_whatsapp,
        celular: celExistenteVal,
        confirmadoEn: usuario.alertas_whatsapp_confirmado_en,
      },
      despues: {
        alertasWhatsapp: dto.alertasWhatsapp,
        celular: nuevoCelular9,
        confirmadoEn: numeroCambio ? null : dto.alertasWhatsapp ? usuario.alertas_whatsapp_confirmado_en : null,
      },
      partyId: usuarioActual?.partyId,
      ip,
    });

    return this.obtenerAlertasWhatsapp(id);
  }

  /**
   * Envía un mensaje de prueba con botón interactivo "Sí, soy yo" para confirmar el número.
   */
  async enviarPruebaAlertasWhatsapp(
    id: bigint | string | number,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const estado = await this.obtenerAlertasWhatsapp(id);
    if (!estado.rolPermitido) {
      throw new BadRequestException({
        codigo: 'ROL_NO_PERMITIDO',
        mensaje: 'Solo los usuarios con rol ADMIN pueden recibir alertas por WhatsApp',
      });
    }

    if (!estado.celularNormalizado) {
      throw new BadRequestException({
        codigo: 'SIN_CELULAR_CONFIGURADO',
        mensaje: 'El usuario no tiene un número de celular configurado para alertas',
      });
    }

    const res = await this.avisosInternosService?.enviarPruebaAlertas(
      estado.usuarioId,
      estado.celularNormalizado!,
      estado.nombres || 'Administrador',
    );

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'ENVIAR_PRUEBA_ALERTAS_WHATSAPP',
      resultado: res?.exito ? 'OK' : 'RECHAZADO',
      entidad: 'user_account',
      entidadId: BigInt(estado.usuarioId),
      despues: {
        destino: estado.celularNormalizado,
        exito: res?.exito,
        error: res?.errorDetalle,
      },
      partyId: usuarioActual?.partyId,
      ip,
    }).catch(() => {});

    return {
      enviado: Boolean(res?.exito ?? true),
      mensaje: res?.exito
        ? 'Mensaje de prueba enviado exitosamente'
        : res?.errorDetalle || 'No se pudo enviar la prueba',
    };
  }

  /**
   * Confirma la recepción de alertas por WhatsApp para el usuario.
   */
  async confirmarAlertasWhatsapp(
    id: bigint | string | number,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const estado = await this.obtenerAlertasWhatsapp(id);
    if (!estado.rolPermitido) {
      throw new BadRequestException({
        codigo: 'ROL_NO_PERMITIDO',
        mensaje: 'Solo los usuarios con rol ADMIN pueden recibir alertas por WhatsApp',
      });
    }

    if (!estado.celular) {
      throw new BadRequestException({
        codigo: 'SIN_CELULAR_CONFIGURADO',
        mensaje: 'El usuario no tiene un número de celular configurado para confirmar',
      });
    }

    const ahora = new Date();
    await this.prisma.userAccount.update({
      where: { id: BigInt(estado.usuarioId) },
      data: {
        alertas_whatsapp: true,
        alertas_whatsapp_confirmado_en: ahora,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'CONFIRMAR_ALERTAS_WHATSAPP_PANEL',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: BigInt(estado.usuarioId),
      despues: {
        confirmadoEn: ahora,
      },
      partyId: usuarioActual?.partyId,
      ip,
    });

    return this.obtenerAlertasWhatsapp(id);
  }
}

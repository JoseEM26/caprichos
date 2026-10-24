import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { Request } from 'express';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ArchivosService } from '../archivos/archivos.service';
import { PuntosService } from './puntos.service';
import {
  AjustarPuntosDto,
  ClienteAdminListItem,
  ClienteSesion,
  EditarClienteAdminDto,
  IngresoClienteDto,
  NotificacionCliente,
  PerfilClienteDto,
  RegistrarMostradorDto,
  RegistroClienteDto,
} from './clientes.tipos';

const TELEFONO_CELULAR = /^9\d{8}$/;
const FOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Tipo real de la imagen según sus primeros bytes (no la extensión ni el Content-Type que manda el cliente). */
export function tipoImagenPorBytes(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export function enmascararDoc(doc: string): string {
  const s = String(doc || '').trim();
  if (s.length === 8) {
    return `${s.slice(0, 4)}****`;
  }
  if (s.length === 11) {
    return `${s.slice(0, 4)}******${s.slice(-1)}`;
  }
  return s.length > 4 ? `${s.slice(0, 2)}****${s.slice(-2)}` : '****';
}

export function parsearCumpleanos(fechaStr: string): { dia: number; mes: number } | null {
  if (!fechaStr) return null;
  const s = String(fechaStr).trim();
  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [, m, d] = s.split('-').map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { dia: d, mes: m };
    }
  }
  // Formato DD/MM
  if (/^\d{1,2}\/\d{1,2}$/.test(s)) {
    const [d, m] = s.split('/').map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { dia: d, mes: m };
    }
  }
  return null;
}

export function formatearCumpleanos(dia?: number | null, mes?: number | null): string {
  if (!dia || !mes) return '—';
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

export function telefonoDeContactos(contactos: { tipo: string; valor: string }[] = []): string | null {
  const telefono = contactos.find((c) => c.tipo === 'TELEFONO') ?? contactos.find((c) => c.tipo === 'WHATSAPP');
  return telefono?.valor ?? null;
}

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditoria: AuditoriaService,
    private readonly puntosService: PuntosService,
    private readonly archivos: ArchivosService,
  ) {}

  /**
   * Genera el JWT de sesión del cliente con audiencia 'cliente' (30 días).
   */
  async generarTokenCliente(partyId: bigint, dni: string): Promise<string> {
    const jwtSecret = this.configService.get<string>('JWT_SECRET', 'desarrollo_jwt_secret_caprichos_2026_muy_seguro');
    return this.jwtService.signAsync(
      {
        sub: partyId.toString(),
        partyId: partyId.toString(),
        dni,
      },
      {
        secret: jwtSecret,
        expiresIn: '30d',
        audience: 'cliente',
      },
    );
  }

  /**
   * Extrae y valida la sesión del cliente desde la request (cookie 'cp_cliente' o cabecera Authorization).
   * Expuesto para integración pública.
   */
  async clienteDesdeRequest(req: Request): Promise<ClienteSesion | null> {
    try {
      let token = req.cookies?.['cp_cliente'];
      if (!token && req.headers?.authorization) {
        const [tipo, t] = req.headers.authorization.split(' ');
        if (tipo === 'Bearer' && t) {
          token = t;
        }
      }
      if (!token) return null;

      const jwtSecret = this.configService.get<string>('JWT_SECRET', 'desarrollo_jwt_secret_caprichos_2026_muy_seguro');
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtSecret,
        audience: 'cliente',
      });

      if (!payload?.partyId) return null;
      return this.yo(payload.partyId);
    } catch {
      return null;
    }
  }

  /**
   * Registro de cliente desde la carta (POST /carta/cuenta/registro).
   */
  async registro(dto: RegistroClienteDto, ip?: string): Promise<{ cliente: ClienteSesion; token: string }> {
    const dni = String(dto.dni || '').trim().replace(/\D/g, '');
    if (dni.length !== 8) {
      throw new BadRequestException({
        codigo: 'DNI_INVALIDO',
        mensaje: 'El DNI debe tener 8 dígitos.',
      });
    }

    if (!dto.nombre || dto.nombre.trim().length < 3) {
      throw new BadRequestException({
        codigo: 'NOMBRE_REQUERIDO',
        mensaje: 'Escribe tu nombre.',
      });
    }

    if (!TELEFONO_CELULAR.test(String(dto.telefono || '').trim())) {
      throw new BadRequestException({
        codigo: 'TELEFONO_INVALIDO',
        mensaje: 'El teléfono celular debe tener 9 dígitos y empezar con 9.',
      });
    }

    if (!dto.contrasena || dto.contrasena.length < 8) {
      throw new BadRequestException({
        codigo: 'CONTRASENA_CORTA',
        mensaje: 'La contraseña debe tener al menos 8 caracteres.',
      });
    }

    if (!dto.aceptaDatos) {
      throw new BadRequestException({
        codigo: 'CONSENTIMIENTO_REQUERIDO',
        mensaje: 'Debes aceptar el uso de tus datos para crear la cuenta.',
      });
    }

    const cumple = parsearCumpleanos(dto.cumpleanos);
    if (!cumple) {
      throw new BadRequestException({
        codigo: 'CUMPLEANOS_REQUERIDO',
        mensaje: 'El cumpleaños es obligatorio para enviarte tu cupón.',
      });
    }

    if (dto.correo && !/^\S+@\S+\.\S+$/.test(dto.correo.trim())) {
      throw new BadRequestException({
        codigo: 'CORREO_INVALIDO',
        mensaje: 'El correo no es válido.',
      });
    }

    // Verificar si ya existe documento
    const docExistente = await this.prisma.partyIdentifier.findFirst({
      where: { tipo: 'DNI', numero: dni },
      include: {
        party: {
          include: {
            cuentaCliente: true,
            persona: true,
            roles: { where: { rol: 'CLIENTE', hasta: null }, include: { customer_detail: true } },
          },
        },
      },
    });

    const hashPw = await argon2.hash(dto.contrasena);
    let partyId: bigint;

    if (docExistente) {
      const p = docExistente.party;
      if (p.cuentaCliente?.hash) {
        // Ya tiene cuenta activa con clave
        throw new BadRequestException({
          codigo: 'DNI_REGISTRADO',
          mensaje: 'Ese DNI ya tiene cuenta.',
        });
      }

      // Fue registrado en mostrador sin clave: completar datos
      partyId = p.id;
      await this.prisma.$transaction(async (tx) => {
        // Actualizar datos de persona
        await tx.person.update({
          where: { party_id: partyId },
          data: {
            nombres: dto.nombre.trim(),
            correo: dto.correo?.trim() || p.persona?.correo || null,
            cumple_dia: cumple.dia,
            cumple_mes: cumple.mes,
          },
        });

        await this.guardarTelefono(tx, partyId, dto.telefono.trim());

        // Asegurar cuenta de cliente con hash
        await tx.customerAccount.upsert({
          where: { party_id: partyId },
          create: { party_id: partyId, hash: hashPw, activo: true },
          update: { hash: hashPw, activo: true },
        });

        // Registrar consentimiento
        await tx.consent.create({
          data: {
            party_id: partyId,
            version_texto: '1.0',
            canal: 'CARTA',
          },
        });
      });
    } else {
      // Crear nuevo Party completo
      const nuevoParty = await this.prisma.$transaction(async (tx) => {
        const party = await tx.party.create({
          data: {
            tipo: 'PERSONA',
            estado: 'ACTIVO',
          },
        });

        await tx.partyIdentifier.create({
          data: {
            party_id: party.id,
            tipo: 'DNI',
            numero: dni,
          },
        });

        await tx.person.create({
          data: {
            party_id: party.id,
            nombres: dto.nombre.trim(),
            correo: dto.correo?.trim() || null,
            cumple_dia: cumple.dia,
            cumple_mes: cumple.mes,
          },
        });

        const role = await tx.partyRole.create({
          data: {
            party_id: party.id,
            rol: 'CLIENTE',
          },
        });

        await tx.customerDetail.create({
          data: {
            party_role_id: role.id,
            puntos: 0,
          },
        });

        await tx.customerAccount.create({
          data: {
            party_id: party.id,
            hash: hashPw,
            activo: true,
          },
        });

        await this.guardarTelefono(tx, party.id, dto.telefono.trim());

        if (dto.correo?.trim()) {
          await tx.contactMechanism.create({
            data: {
              party_id: party.id,
              tipo: 'CORREO',
              valor: dto.correo.trim(),
              principal: true,
            },
          });
        }

        await tx.consent.create({
          data: {
            party_id: party.id,
            version_texto: '1.0',
            canal: 'CARTA',
          },
        });

        return party;
      });
      partyId = nuevoParty.id;
    }

    const token = await this.generarTokenCliente(partyId, dni);
    const cliente = await this.yo(partyId);

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'clientes',
      accion: 'CLIENTE_REGISTRADO',
      entidad: 'party',
      entidadId: partyId,
      despues: { dniMascara: enmascararDoc(dni) },
      ip,
    });

    return { cliente: cliente!, token };
  }

  /**
   * Ingreso de cliente desde la carta (POST /carta/cuenta/ingresar).
   */
  async ingresar(dto: IngresoClienteDto, ip?: string): Promise<{ cliente: ClienteSesion; token: string }> {
    const dni = String(dto.dni || '').trim().replace(/\D/g, '');
    if (dni.length !== 8) {
      throw new BadRequestException({
        codigo: 'CREDENCIALES_INVALIDAS',
        mensaje: 'El DNI debe tener 8 dígitos.',
      });
    }

    if (!dto.contrasena) {
      throw new BadRequestException({
        codigo: 'CREDENCIALES_INVALIDAS',
        mensaje: 'Escribe tu contraseña.',
      });
    }

    // 1. Revisar bloqueo por intentos fallidos (Redis DT-17 / D-17)
    const redis = this.redisService.obtenerCliente();
    const claveRedis = `bloqueo:cliente:${dni}`;
    let intentos: string | null = null;
    try {
      intentos = await redis.get(claveRedis);
    } catch {
      // Si redis no responde, continuamos
    }
    if (intentos && Number(intentos) >= 5) {
      throw new BadRequestException({
        codigo: 'CREDENCIALES_INVALIDAS',
        mensaje: 'Has superado el límite de intentos permitidos. Intenta más tarde.',
      });
    }

    // 2. Buscar cliente por DNI
    const doc = await this.prisma.partyIdentifier.findFirst({
      where: { tipo: 'DNI', numero: dni },
      include: {
        party: {
          include: {
            cuentaCliente: true,
            persona: true,
            roles: { where: { rol: 'CLIENTE', hasta: null } },
          },
        },
      },
    });

    if (!doc || !doc.party) {
      try {
        await redis.incr(claveRedis);
        await redis.expire(claveRedis, 300); // 5 min
      } catch {}
      throw new BadRequestException({
        codigo: 'CREDENCIALES_INVALIDAS',
        mensaje: 'DNI o contraseña incorrectos.',
      });
    }

    const party = doc.party;
    const cuenta = party.cuentaCliente;

    // Caso: cliente registrado en mostrador sin clave
    // "Un DNI registrado en mostrador sin contraseña crea la contraseña al ingresar la primera vez."
    if (!cuenta || !cuenta.hash) {
      if (dto.contrasena.length < 8) {
        throw new BadRequestException({
          codigo: 'CREDENCIALES_INVALIDAS',
          mensaje: 'Crea una contraseña de al menos 8 caracteres.',
        });
      }

      const nuevoHash = await argon2.hash(dto.contrasena);
      await this.prisma.customerAccount.upsert({
        where: { party_id: party.id },
        create: { party_id: party.id, hash: nuevoHash, activo: true },
        update: { hash: nuevoHash, activo: true },
      });

      try {
        await redis.del(claveRedis);
      } catch {}
      const token = await this.generarTokenCliente(party.id, dni);
      const cliente = await this.yo(party.id);
      return { cliente: cliente!, token };
    }

    if (!cuenta.activo) {
      throw new BadRequestException({
        codigo: 'CREDENCIALES_INVALIDAS',
        mensaje: 'Tu cuenta está desactivada.',
      });
    }

    // Verificar contraseña con argon2
    const claveValida = await argon2.verify(cuenta.hash, dto.contrasena);
    if (!claveValida) {
      try {
        await redis.incr(claveRedis);
        await redis.expire(claveRedis, 300);
      } catch {}
      throw new BadRequestException({
        codigo: 'CREDENCIALES_INVALIDAS',
        mensaje: 'DNI o contraseña incorrectos.',
      });
    }

    // Éxito: limpiar intentos en Redis
    try {
      await redis.del(claveRedis);
    } catch {}
    const token = await this.generarTokenCliente(party.id, dni);
    const cliente = await this.yo(party.id);

    return { cliente: cliente!, token };
  }

  /**
   * Consulta datos de la cuenta activa (GET /carta/cuenta/yo).
   */
  async yo(partyId: bigint | string): Promise<ClienteSesion | null> {
    const id = BigInt(partyId);
    const party = await this.prisma.party.findUnique({
      where: { id },
      include: {
        persona: true,
        documentos: true,
        contactos: true,
        roles: {
          where: { rol: 'CLIENTE', hasta: null },
          include: { customer_detail: true },
        },
      },
    });

    if (!party) return null;

    const dniDoc = party.documentos.find((d) => d.tipo === 'DNI');
    const dni = dniDoc ? dniDoc.numero : '';
    const puntos = await this.puntosService.obtenerSaldo(id);
    const fotoId = party.persona?.foto_archivo_id;
    const foto = fotoId ? await this.prisma.archivo.findUnique({ where: { id: fotoId } }) : null;

    return {
      partyId: id.toString(),
      nombre: party.persona?.nombres || 'Cliente',
      dniMascara: enmascararDoc(dni),
      correo: party.persona?.correo || null,
      telefono: telefonoDeContactos(party.contactos),
      fotoUrl: foto ? `/archivos/${foto.ruta}` : null,
      cumpleanos: formatearCumpleanos(party.persona?.cumple_dia, party.persona?.cumple_mes),
      puntos,
    };
  }

  /**
   * Edición del perfil desde la cuenta del cliente (PUT /carta/cuenta/perfil).
   * Solo toca nombre, teléfono, correo y cumpleaños: nunca el DNI ni la contraseña.
   */
  async actualizarPerfil(partyId: bigint | string, dto: PerfilClienteDto, ip?: string): Promise<ClienteSesion | null> {
    const id = BigInt(partyId);

    if (dto.nombre !== undefined && String(dto.nombre).trim().length < 3) {
      throw new BadRequestException({
        codigo: 'NOMBRE_REQUERIDO',
        mensaje: 'Escribe tu nombre.',
      });
    }

    if (dto.telefono !== undefined && !TELEFONO_CELULAR.test(String(dto.telefono).trim())) {
      throw new BadRequestException({
        codigo: 'TELEFONO_INVALIDO',
        mensaje: 'El teléfono celular debe tener 9 dígitos y empezar con 9.',
      });
    }

    const correo = dto.correo !== undefined ? String(dto.correo).trim() : undefined;
    if (correo && !/^\S+@\S+\.\S+$/.test(correo)) {
      throw new BadRequestException({
        codigo: 'CORREO_INVALIDO',
        mensaje: 'El correo no es válido.',
      });
    }

    const cumple = dto.cumpleanos !== undefined ? parsearCumpleanos(dto.cumpleanos) : null;
    if (dto.cumpleanos !== undefined && !cumple) {
      throw new BadRequestException({
        codigo: 'FECHA_INVALIDA',
        mensaje: 'La fecha de cumpleaños no es válida.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.nombre !== undefined || correo !== undefined || cumple) {
        await tx.person.update({
          where: { party_id: id },
          data: {
            ...(dto.nombre !== undefined ? { nombres: dto.nombre.trim() } : {}),
            ...(correo !== undefined ? { correo: correo || null } : {}),
            ...(cumple ? { cumple_dia: cumple.dia, cumple_mes: cumple.mes } : {}),
          },
        });
      }

      if (dto.telefono !== undefined) {
        await this.guardarTelefono(tx, id, dto.telefono.trim());
      }
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'clientes',
      accion: 'CLIENTE_PERFIL_EDITADO',
      entidad: 'party',
      entidadId: id,
      despues: { camposEditados: Object.keys(dto).filter((k) => dto[k as keyof PerfilClienteDto] !== undefined) },
      partyId: id,
      ip,
    });

    return this.yo(id);
  }

  /**
   * Foto de perfil opcional (POST /carta/cuenta/foto). Solo JPEG, PNG o WebP de máximo 2 MB,
   * verificados por bytes. El archivo lo guarda ArchivosService; aquí solo se enlaza a la persona.
   */
  async subirFoto(partyId: bigint | string, file: Express.Multer.File, ip?: string): Promise<ClienteSesion | null> {
    const id = BigInt(partyId);

    if (!file?.buffer) {
      throw new BadRequestException({
        codigo: 'ARCHIVO_REQUERIDO',
        mensaje: 'Elige una foto para tu perfil.',
      });
    }

    if (file.buffer.length > FOTO_MAX_BYTES) {
      throw new PayloadTooLargeException({
        codigo: 'FOTO_GRANDE',
        mensaje: 'La foto no puede pasar de 2 MB.',
      });
    }

    const tipo = tipoImagenPorBytes(file.buffer);
    if (!tipo) {
      throw new BadRequestException({
        codigo: 'FOTO_TIPO_NO_PERMITIDO',
        mensaje: 'Solo se aceptan fotos JPEG, PNG o WebP.',
      });
    }

    let archivo: { id: string };
    try {
      archivo = await this.archivos.subirArchivo(
        { ...file, mimetype: tipo } as Express.Multer.File,
        false,
        { partyId: id, rol: 'CLIENTE', debeCambiar: false },
        ip,
      );
    } catch {
      throw new BadRequestException({
        codigo: 'FOTO_NO_VALIDA',
        mensaje: 'No pudimos leer esa imagen. Prueba con otra foto.',
      });
    }

    await this.prisma.person.update({
      where: { party_id: id },
      data: { foto_archivo_id: BigInt(archivo.id) },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'clientes',
      accion: 'CLIENTE_FOTO_SUBIDA',
      entidad: 'party',
      entidadId: id,
      partyId: id,
      ip,
    });

    return this.yo(id);
  }

  /**
   * Quita la foto del perfil (DELETE /carta/cuenta/foto). Solo desvincula: el archivo queda en disco.
   */
  async quitarFoto(partyId: bigint | string, ip?: string): Promise<ClienteSesion | null> {
    const id = BigInt(partyId);

    await this.prisma.person.update({
      where: { party_id: id },
      data: { foto_archivo_id: null },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'clientes',
      accion: 'CLIENTE_FOTO_QUITADA',
      entidad: 'party',
      entidadId: id,
      partyId: id,
      ip,
    });

    return this.yo(id);
  }

  /**
   * Deja el celular como contacto TELEFONO principal (el mismo que lee y edita el admin de Clientes).
   */
  private async guardarTelefono(tx: Prisma.TransactionClient, partyId: bigint, telefono: string) {
    const existente = await tx.contactMechanism.findFirst({
      where: { party_id: partyId, tipo: 'TELEFONO' },
    });
    if (existente) {
      await tx.contactMechanism.update({
        where: { id: existente.id },
        data: { valor: telefono },
      });
    } else {
      await tx.contactMechanism.create({
        data: { party_id: partyId, tipo: 'TELEFONO', valor: telefono, principal: true },
      });
    }
  }

  /**
   * Notificaciones para la campanita del cliente en la carta (cupón de cumpleaños y avisos).
   */
  async notificaciones(partyId: bigint | string): Promise<NotificacionCliente[]> {
    const id = BigInt(partyId);
    const party = await this.prisma.party.findUnique({
      where: { id },
      include: {
        persona: true,
        movimientosPuntos: { take: 5, orderBy: { en: 'desc' } },
      },
    });

    if (!party) return [];

    const notifs: NotificacionCliente[] = [];
    const diaCumple = party.persona?.cumple_dia;
    const mesCumple = party.persona?.cumple_mes;

    const hoy = new Date();
    const hoyMes = hoy.getMonth() + 1;
    const hoyDia = hoy.getDate();

    // 1. Si no tiene cumpleaños registrado, pedirlo
    if (!diaCumple || !mesCumple) {
      notifs.push({
        id: 'n-ask-bday',
        t: '¿Cuándo es tu cumpleaños?',
        x: 'Dinos tu fecha de cumpleaños para enviarte tu cupón de regalo.',
        askBday: true,
      });
    } else {
      // 2. Si estamos en el mes o semana de su cumpleaños -> cupón de cumpleaños
      const esMesCumple = hoyMes === mesCumple;
      const diasDif = Math.abs(hoyDia - diaCumple);
      if (esMesCumple || diasDif <= 7) {
        notifs.push({
          id: `n-bday-${hoy.getFullYear()}`,
          t: '¡Feliz cumpleaños de parte de Caprichos!',
          x: 'Disfruta de tu beneficio especial de cumpleaños en tu compra.',
          fresh: true,
          hasTicket: true,
          tCode: 'CUMPLE2026',
          tNote: 'Válido para tu consumo de cumpleaños',
          tVence: 'fin de mes',
          hasCode: true,
          code: 'CUMPLE2026',
        });
      }
    }

    // 3. Notificación de puntos acumulados reciente si la hay
    const ultimoMov = party.movimientosPuntos?.[0];
    if (ultimoMov && ultimoMov.tipo === 'SUMA') {
      notifs.push({
        id: `n-mov-${ultimoMov.id}`,
        t: 'Puntos acumulados',
        x: `Ganaste ${Number(ultimoMov.puntos).toFixed(2)} puntos en tu última compra.`,
      });
    }

    return notifs;
  }

  /**
   * Guarda o actualiza la fecha de cumpleaños del cliente desde la carta.
   */
  async guardarCumpleanos(partyId: bigint | string, fechaStr: string) {
    const id = BigInt(partyId);
    const c = parsearCumpleanos(fechaStr);
    if (!c) {
      throw new BadRequestException({
        codigo: 'FECHA_INVALIDA',
        mensaje: 'La fecha de cumpleaños no es válida.',
      });
    }

    await this.prisma.person.update({
      where: { party_id: id },
      data: {
        cumple_dia: c.dia,
        cumple_mes: c.mes,
      },
    });

    return { ok: true, cumpleanos: formatearCumpleanos(c.dia, c.mes) };
  }

  // ========================================================
  // SECCIÓN ADMINISTRATIVA (Admin ▸ Clientes)
  // ========================================================

  /**
   * Lista de clientes para el administrativo con filtros y búsqueda.
   */
  async listarAdmin(
    filtros: {
      q?: string;
      tipo?: string;
      estado?: string;
      creditoPersonal?: string;
      pagina?: number;
      limite?: number;
    },
    usuarioAutenticado: any,
    ip?: string,
  ): Promise<{ items: ClienteAdminListItem[]; total: number; pagina: number; paginas: number }> {
    const q = filtros.q?.trim().toLowerCase();
    const esAdmin = usuarioAutenticado?.rol === 'ADMIN' || usuarioAutenticado?.rol === 'admin';

    // Obtener todas las partes que tienen rol CLIENTE
    const roles = await this.prisma.partyRole.findMany({
      where: {
        rol: 'CLIENTE',
        ...(filtros.estado === 'Desactivados'
          ? { hasta: { not: null } }
          : filtros.estado === 'Activos'
          ? { hasta: null }
          : {}),
      },
      include: {
        party: {
          include: {
            persona: true,
            documentos: true,
            contactos: true,
            pedidos: {
              where: { pago_estado: 'COBRADO' },
              select: { id: true },
            },
            usuario: {
              select: { rol: true },
            },
          },
        },
        customer_detail: true,
      },
      orderBy: { id: 'desc' },
    });

    let items: ClienteAdminListItem[] = roles.map((r) => {
      const p = r.party;
      const dniDoc = p.documentos.find((d: any) => d.tipo === 'DNI' || d.tipo === 'RUC');
      const docNum = dniDoc?.numero || '';

      // Tipo de cliente
      let tipo: 'Persona' | 'Empresa' | 'Personal' = 'Persona';
      if (p.usuario) {
        tipo = 'Personal';
      } else if (docNum.length === 11 || p.tipo === 'ORGANIZACION') {
        tipo = 'Empresa';
      }

      const tel = p.contactos.find((c: any) => c.tipo === 'TELEFONO' || c.tipo === 'WHATSAPP')?.valor || '—';
      const correo = p.persona?.correo || p.contactos.find((c: any) => c.tipo === 'CORREO')?.valor || 'sin correo';
      const cumple = formatearCumpleanos(p.persona?.cumple_dia, p.persona?.cumple_mes);

      const detalle = r.customer_detail;
      const puntos = Number(detalle?.puntos || 0);

      const envioFijo = detalle?.envio_tipo === 'FIJO' && detalle.envio_valor ? Number(detalle.envio_valor) : null;
      const descEnvio = detalle?.envio_tipo === 'PORCENTAJE' && detalle.envio_valor ? Number(detalle.envio_valor) : null;

      // DNI: si es admin y se solicita, se puede ver completo, pero por defecto en listas enmascarado
      const dniMascara = esAdmin ? docNum : enmascararDoc(docNum);

      return {
        id: p.id.toString(),
        nombre: p.persona?.nombres || 'Sin nombre',
        tipo,
        dni: dniMascara,
        telefono: tel,
        correo,
        cumpleanos: cumple,
        pedidos: p.pedidos.length,
        puntos,
        creditoPersonal: tipo === 'Personal',
        envioFijo,
        descuentoEnvio: descEnvio,
        activo: r.hasta === null && p.estado === 'ACTIVO',
      };
    });

    // Filtros de memoria (rápidos y homogéneos con la maqueta)
    if (filtros.tipo && filtros.tipo !== 'Todos') {
      items = items.filter((it) => it.tipo === filtros.tipo);
    }
    if (filtros.creditoPersonal && filtros.creditoPersonal !== 'Todos') {
      const quiereCred = filtros.creditoPersonal === 'Sí';
      items = items.filter((it) => it.creditoPersonal === quiereCred);
    }
    if (q) {
      items = items.filter(
        (it) =>
          it.nombre.toLowerCase().includes(q) ||
          it.dni.toLowerCase().includes(q) ||
          it.telefono.includes(q) ||
          it.correo.toLowerCase().includes(q),
      );
    }

    const total = items.length;
    const limite = Math.max(1, filtros.limite || 6);
    const pagina = Math.max(1, filtros.pagina || 1);
    const paginas = Math.max(1, Math.ceil(total / limite));
    const inicio = (pagina - 1) * limite;
    const itemsPaginados = items.slice(inicio, inicio + limite);

    return {
      items: itemsPaginados,
      total,
      pagina,
      paginas,
    };
  }

  /**
   * Ficha de un cliente: datos, saldo e historial de pedidos.
   */
  async obtenerFichaAdmin(partyId: string, usuarioAutenticado: any, ip?: string) {
    const id = BigInt(partyId);
    const party = await this.prisma.party.findUnique({
      where: { id },
      include: {
        persona: true,
        documentos: true,
        contactos: true,
        roles: { where: { rol: 'CLIENTE' }, include: { customer_detail: true } },
        pedidos: {
          orderBy: { creado_en: 'desc' },
          take: 20,
          select: {
            id: true,
            codigo: true,
            modalidad: true,
            estado: true,
            total: true,
            pago_estado: true,
            creado_en: true,
          },
        },
      },
    });

    if (!party) {
      throw new NotFoundException({
        codigo: 'CLIENTE_NO_ENCONTRADO',
        mensaje: `No se encontró el cliente con ID ${partyId}`,
      });
    }

    const esAdmin = usuarioAutenticado?.rol === 'ADMIN' || usuarioAutenticado?.rol === 'admin';
    const doc = party.documentos[0]?.numero || '';

    // Si un admin solicita ver el documento completo, se audita como LECTURA_SENSIBLE (RQ-CLI-01-10)
    if (esAdmin) {
      await this.auditoria.registrar({
        categoria: 'LECTURA_SENSIBLE',
        modulo: 'clientes',
        accion: 'CLIENTE_VER_COMPLETO',
        entidad: 'party',
        entidadId: id,
        despues: { dniConsultado: doc },
        partyId: usuarioAutenticado?.partyId ? BigInt(usuarioAutenticado.partyId) : undefined,
        ip,
      });
    }

    const puntos = await this.puntosService.obtenerSaldo(id);
    const tel = party.contactos.find((c) => c.tipo === 'TELEFONO' || c.tipo === 'WHATSAPP')?.valor || '—';
    const correo = party.persona?.correo || party.contactos.find((c) => c.tipo === 'CORREO')?.valor || 'sin correo';

    return {
      id: party.id.toString(),
      nombre: party.persona?.nombres || 'Sin nombre',
      dni: doc,
      dniMascara: enmascararDoc(doc),
      telefono: tel,
      correo,
      cumpleanos: formatearCumpleanos(party.persona?.cumple_dia, party.persona?.cumple_mes),
      cumpleDia: party.persona?.cumple_dia,
      cumpleMes: party.persona?.cumple_mes,
      puntos,
      pedidos: party.pedidos.map((p) => ({
        id: p.codigo || p.id.toString(),
        modalidad: p.modalidad === 'DELIVERY' ? 'Delivery' : p.modalidad === 'LLEVAR' ? 'Para llevar' : 'En el local',
        estado: p.estado,
        total: `s/ ${Number(p.total).toFixed(2)}`,
        pago: p.pago_estado === 'COBRADO' ? 'Cobrado' : 'Sin cobrar',
        fecha: p.creado_en.toISOString(),
      })),
    };
  }

  /**
   * Registro en mostrador (RQ-CLI-01-06):
   * Quien atiende crea el cliente sin contraseña.
   */
  async crearEnMostrador(dto: RegistrarMostradorDto, usuarioId?: string, ip?: string) {
    const dni = String(dto.dni || '').trim().replace(/\D/g, '');
    const esEmpresa = dni.length === 11;

    if (!(dni.length === 8 || esEmpresa)) {
      throw new BadRequestException({
        codigo: 'DOCUMENTO_INVALIDO',
        mensaje: 'El DNI tiene 8 dígitos (o el RUC de una empresa, 11).',
      });
    }

    if (!dto.nombre || dto.nombre.trim().length < 2) {
      throw new BadRequestException({
        codigo: 'NOMBRE_REQUERIDO',
        mensaje: 'Escribe el nombre.',
      });
    }

    const cumple = parsearCumpleanos(dto.cumpleanos || '');
    if (!esEmpresa && !cumple) {
      throw new BadRequestException({
        codigo: 'CUMPLEANOS_REQUERIDO',
        mensaje: 'Elige el cumpleaños del cliente en el calendario.',
      });
    }

    if (!dto.aceptaDatos) {
      throw new BadRequestException({
        codigo: 'CONSENTIMIENTO_REQUERIDO',
        mensaje: 'El cliente debe aceptar que se guarden sus datos.',
      });
    }

    const docExistente = await this.prisma.partyIdentifier.findFirst({
      where: { tipo: esEmpresa ? 'RUC' : 'DNI', numero: dni },
    });

    if (docExistente) {
      throw new BadRequestException({
        codigo: 'CLIENTE_YA_EXISTE',
        mensaje: 'Ya existe un cliente con ese documento.',
      });
    }

    const nuevoParty = await this.prisma.$transaction(async (tx) => {
      const party = await tx.party.create({
        data: {
          tipo: esEmpresa ? 'ORGANIZACION' : 'PERSONA',
          estado: 'ACTIVO',
        },
      });

      await tx.partyIdentifier.create({
        data: {
          party_id: party.id,
          tipo: esEmpresa ? 'RUC' : 'DNI',
          numero: dni,
        },
      });

      await tx.person.create({
        data: {
          party_id: party.id,
          nombres: dto.nombre.trim(),
          correo: dto.correo?.trim() || null,
          cumple_dia: cumple?.dia || null,
          cumple_mes: cumple?.mes || null,
        },
      });

      const role = await tx.partyRole.create({
        data: {
          party_id: party.id,
          rol: 'CLIENTE',
        },
      });

      await tx.customerDetail.create({
        data: {
          party_role_id: role.id,
          puntos: 0,
        },
      });

      // CustomerAccount con hash=null (sin contraseña, la crea después en la carta)
      await tx.customerAccount.create({
        data: {
          party_id: party.id,
          hash: null,
          activo: true,
        },
      });

      if (dto.telefono?.trim()) {
        await tx.contactMechanism.create({
          data: {
            party_id: party.id,
            tipo: 'TELEFONO',
            valor: dto.telefono.trim(),
            principal: true,
          },
        });
      }

      if (dto.correo?.trim()) {
        await tx.contactMechanism.create({
          data: {
            party_id: party.id,
            tipo: 'CORREO',
            valor: dto.correo.trim(),
            principal: false,
          },
        });
      }

      await tx.consent.create({
        data: {
          party_id: party.id,
          version_texto: '1.0',
          canal: 'CAJA',
        },
      });

      return party;
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'clientes',
      accion: 'CLIENTE_CREADO_MOSTRADOR',
      entidad: 'party',
      entidadId: nuevoParty.id,
      despues: { dniMascara: enmascararDoc(dni), nombre: dto.nombre.trim() },
      partyId: usuarioId ? BigInt(usuarioId) : undefined,
      ip,
    });

    return {
      id: nuevoParty.id.toString(),
      nombre: dto.nombre.trim(),
      dni: enmascararDoc(dni),
    };
  }

  /**
   * Editar cliente desde el administrativo (el DNI NO se cambia - RN-CAP-083).
   */
  async editarCliente(partyId: string, dto: EditarClienteAdminDto, usuarioId?: string, ip?: string) {
    const id = BigInt(partyId);

    const party = await this.prisma.party.findUnique({
      where: { id },
      include: {
        persona: true,
        roles: { where: { rol: 'CLIENTE', hasta: null }, include: { customer_detail: true } },
      },
    });

    if (!party) {
      throw new NotFoundException({
        codigo: 'CLIENTE_NO_ENCONTRADO',
        mensaje: 'No se encontró el cliente',
      });
    }

    const cumple = dto.cumpleanos ? parsearCumpleanos(dto.cumpleanos) : undefined;

    await this.prisma.$transaction(async (tx) => {
      // 1. Actualizar persona
      if (dto.nombre || dto.correo !== undefined || cumple) {
        await tx.person.update({
          where: { party_id: id },
          data: {
            ...(dto.nombre ? { nombres: dto.nombre.trim() } : {}),
            ...(dto.correo !== undefined ? { correo: dto.correo?.trim() || null } : {}),
            ...(cumple ? { cumple_dia: cumple.dia, cumple_mes: cumple.mes } : {}),
          },
        });
      }

      // 2. Teléfono
      if (dto.telefono !== undefined) {
        const telExistente = await tx.contactMechanism.findFirst({
          where: { party_id: id, tipo: 'TELEFONO' },
        });
        if (telExistente) {
          await tx.contactMechanism.update({
            where: { id: telExistente.id },
            data: { valor: dto.telefono.trim() },
          });
        } else if (dto.telefono.trim()) {
          await tx.contactMechanism.create({
            data: {
              party_id: id,
              tipo: 'TELEFONO',
              valor: dto.telefono.trim(),
              principal: true,
            },
          });
        }
      }

      // 3. Tarifas preferenciales de envío (customer_detail)
      const rolCliente = party.roles[0];
      if (rolCliente && (dto.envioFijo !== undefined || dto.descuentoEnvio !== undefined)) {
        let envioTipo: string | null = null;
        let envioValor: number | null = null;

        if (dto.envioFijo !== undefined && dto.envioFijo !== null) {
          envioTipo = 'FIJO';
          envioValor = Number(dto.envioFijo);
        } else if (dto.descuentoEnvio !== undefined && dto.descuentoEnvio !== null) {
          envioTipo = 'PORCENTAJE';
          envioValor = Number(dto.descuentoEnvio);
        }

        if (rolCliente.customer_detail) {
          await tx.customerDetail.update({
            where: { party_role_id: rolCliente.id },
            data: {
              envio_tipo: envioTipo,
              envio_valor: envioValor,
            },
          });
        }
      }
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'clientes',
      accion: 'CLIENTE_EDITADO',
      entidad: 'party',
      entidadId: id,
      despues: dto as any,
      partyId: usuarioId ? BigInt(usuarioId) : undefined,
      ip,
    });

    return { ok: true };
  }

  /**
   * Activa o desactiva a un cliente (no se elimina, RN-CAP-066 / regla general).
   */
  async cambiarEstado(partyId: string, activo: boolean, usuarioId?: string, ip?: string) {
    const id = BigInt(partyId);

    await this.prisma.$transaction(async (tx) => {
      await tx.party.update({
        where: { id },
        data: { estado: activo ? 'ACTIVO' : 'INACTIVO' },
      });

      await tx.partyRole.updateMany({
        where: { party_id: id, rol: 'CLIENTE' },
        data: { hasta: activo ? null : new Date() },
      });

      await tx.customerAccount.updateMany({
        where: { party_id: id },
        data: { activo },
      });
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'clientes',
      accion: activo ? 'CLIENTE_ACTIVADO' : 'CLIENTE_DESACTIVADO',
      entidad: 'party',
      entidadId: id,
      despues: { activo },
      partyId: usuarioId ? BigInt(usuarioId) : undefined,
      ip,
    });

    return { ok: true, activo };
  }
}

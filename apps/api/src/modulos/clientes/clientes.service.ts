import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { CANALES_CLIENTE_EN_PARTY } from './cliente-del-pedido';
import * as argon2 from 'argon2';
import { Request } from 'express';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ArchivosService } from '../archivos/archivos.service';
import { PuntosService } from './puntos.service';
import { CodigoRegistroService } from './codigo-registro.service';
import { AvisoCuentaService } from './aviso-cuenta.service';
import { enmascararDni, validarDni } from '../comprobantes/comprobantes.util';
import { versionConsentimiento, versionesLegales } from '../reclamos/textos-legales';
import { normalizarCelularPeru } from '../usuarios/alertas-whatsapp.util';
import { CELULAR_OTRA_PERSONA, partyDeCelular } from './celular-party.util';
import { enmascararTelefono } from '../chatbot/utilidades/enmascarar.util';
import { exigirCumpleanos, formatearCumpleanos, parsearCumpleanos } from './cumpleanos.util';
import { explicarPedidosPorId } from './explicar-puntos-pedidos';
import type { ExplicacionPuntos } from './explicar-puntos-pedido';
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

/** DNI opcional: vacío o ausente = null; si viene, debe tener exactamente 8 dígitos. */
export function dniOpcional(raw?: string | null): string | null {
  const limpio = String(raw ?? '').trim();
  if (!limpio) return null;
  if (!validarDni(limpio)) {
    throw new BadRequestException({
      codigo: 'DNI_INVALIDO',
      mensaje: 'El DNI debe tener 8 dígitos. Déjalo vacío si no quieres darlo.',
    });
  }
  return limpio;
}

/** Celular de 9 dígitos que empieza en 9 (acepta 51 delante, espacios o guiones), o null. */
export function celular9De(raw?: string | null): string | null {
  const n = normalizarCelularPeru(raw);
  return n.valido ? n.celular9! : null;
}

/** Contraseña de cuenta de cliente: 8 a 128 caracteres. */
export function validarContrasena(c: unknown): void {
  if (typeof c !== 'string' || c.length < 8) {
    throw new BadRequestException({
      codigo: 'CONTRASENA_CORTA',
      mensaje: 'La contraseña debe tener al menos 8 caracteres.',
    });
  }
  if (c.length > 128) {
    throw new BadRequestException({
      codigo: 'CONTRASENA_LARGA',
      mensaje: 'La contraseña no puede pasar de 128 caracteres.',
    });
  }
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

export { parsearCumpleanos, formatearCumpleanos } from './cumpleanos.util';

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
    private readonly codigoRegistro: CodigoRegistroService,
    private readonly avisoCuenta: AvisoCuentaService,
  ) {}

  /**
   * Genera el JWT de sesión del cliente con audiencia 'cliente' (30 días).
   */
  async generarTokenCliente(partyId: bigint): Promise<string> {
    const jwtSecret = this.configService.get<string>('JWT_SECRET', 'desarrollo_jwt_secret_caprichos_2026_muy_seguro');
    return this.jwtService.signAsync(
      {
        sub: partyId.toString(),
        partyId: partyId.toString(),
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
   * Una sesión emitida antes del último cambio de contraseña, o de una cuenta desactivada, no vale.
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
      const cuenta = await this.prisma.customerAccount.findUnique({
        where: { party_id: BigInt(payload.partyId) },
        select: { activo: true, clave_cambiada_en: true },
      });
      if (!cuenta?.activo) return null;
      if (cuenta.clave_cambiada_en && Number(payload.iat ?? 0) < Math.floor(cuenta.clave_cambiada_en.getTime() / 1000)) {
        return null;
      }
      return this.yo(payload.partyId);
    } catch {
      return null;
    }
  }

  /**
   * Cuenta de cliente de un celular de 9 dígitos: la que lo guarda como identidad o, si es una cuenta de
   * mostrador anterior, la del party (no personal) que lo tiene como contacto.
   */
  async cuentaPorCelular(celular9: string) {
    const porColumna = await this.prisma.customerAccount.findFirst({ where: { telefono: celular9, activo: true } });
    if (porColumna) return porColumna;
    const contacto = await this.prisma.contactMechanism.findFirst({
      where: {
        tipo: { in: ['TELEFONO', 'WHATSAPP'] },
        valor: { in: [celular9, `51${celular9}`] },
        activo: true,
        party: { usuario: { is: null }, cuentaCliente: { is: { activo: true, telefono: null } } },
      },
      select: { party: { select: { cuentaCliente: true } } },
    });
    return contacto?.party.cuentaCliente ?? null;
  }

  /**
   * Registro de cliente desde la carta (POST /carta/cuenta/registro). La cuenta es teléfono + contraseña, sin DNI.
   * Si el teléfono ya es de un cliente sin contraseña (mostrador) o de un party sin cuenta, se vincula en vez de duplicar.
   */
  async registro(dto: RegistroClienteDto, ip?: string): Promise<{ cliente: ClienteSesion; token: string }> {
    const tel = celular9De(dto.telefono);
    if (!tel) {
      throw new BadRequestException({
        codigo: 'TELEFONO_INVALIDO',
        mensaje: 'El celular debe tener 9 dígitos y empezar con 9.',
      });
    }

    if (!dto.nombre || dto.nombre.trim().length < 2) {
      throw new BadRequestException({
        codigo: 'NOMBRE_REQUERIDO',
        mensaje: 'Escribe tu nombre.',
      });
    }

    validarContrasena(dto.contrasena);

    // DNI opcional: vacío = no se guarda; si viene, exactamente 8 dígitos
    const dni = dniOpcional(dto.dni);

    if (dto.aceptaDatos !== true) {
      throw new BadRequestException({
        codigo: 'CONSENTIMIENTO_REQUERIDO',
        mensaje: 'Debes aceptar el uso de tus datos para crear la cuenta.',
      });
    }

    // Cumpleaños obligatorio: día y mes (año opcional), fecha real, no futura
    const cumple = exigirCumpleanos(dto.cumpleanos);

    const correo = dto.correo?.trim() || null;
    if (correo && !/^\S+@\S+\.\S+$/.test(correo)) {
      throw new BadRequestException({
        codigo: 'CORREO_INVALIDO',
        mensaje: 'El correo no es válido.',
      });
    }

    // El celular solo es de quien tiene el código que llega por WhatsApp: antes de revelar nada de la cuenta
    await this.codigoRegistro.exigirVerificado(tel);

    const desactivada = await this.prisma.customerAccount.findFirst({ where: { telefono: tel, activo: false }, select: { id: true } });
    if (desactivada) {
      throw new BadRequestException({
        codigo: 'TELEFONO_NO_DISPONIBLE',
        mensaje: 'No pudimos crear la cuenta con ese celular. Escríbenos por WhatsApp.',
      });
    }

    const registrado = new ConflictException({
      codigo: 'TELEFONO_REGISTRADO',
      mensaje: 'Ese celular ya tiene cuenta. Ingresa o recupera tu contraseña.',
    });

    const cuenta = await this.cuentaPorCelular(tel);
    if (cuenta?.hash) throw registrado;

    // Party sin cuenta que ya tiene ese celular (p. ej. identificado antes por WhatsApp): se vincula
    let partyId: bigint | null = cuenta?.party_id ?? null;
    if (!partyId) {
      const suelto = await this.prisma.contactMechanism.findFirst({
        where: {
          tipo: { in: ['TELEFONO', 'WHATSAPP'] },
          valor: { in: [tel, `51${tel}`] },
          activo: true,
          party: { tipo: 'PERSONA', estado: 'ACTIVO', usuario: { is: null }, cuentaCliente: { is: null } },
        },
        select: { party_id: true },
      });
      partyId = suelto?.party_id ?? null;
    }

    const hashPw = await argon2.hash(dto.contrasena);
    const versionTexto = versionConsentimiento(await versionesLegales(this.prisma));
    try {
      partyId = await this.prisma.$transaction(async (tx) => {
        let id = partyId;
        if (id) {
          const persona = await tx.person.findUnique({ where: { party_id: id } });
          if (persona) {
            await tx.person.update({
              where: { party_id: id },
              data: {
                nombres: dto.nombre.trim(),
                correo: correo ?? persona.correo,
                ...(cumple ? { cumple_dia: cumple.dia, cumple_mes: cumple.mes } : {}),
              },
            });
          } else {
            await tx.person.create({
              data: { party_id: id, nombres: dto.nombre.trim(), correo, cumple_dia: cumple?.dia ?? null, cumple_mes: cumple?.mes ?? null },
            });
          }
          const rol = await tx.partyRole.findFirst({ where: { party_id: id, rol: 'CLIENTE', hasta: null }, include: { customer_detail: true } });
          if (!rol) {
            const nuevo = await tx.partyRole.create({ data: { party_id: id, rol: 'CLIENTE' } });
            await tx.customerDetail.create({ data: { party_role_id: nuevo.id, puntos: 0 } });
          } else if (!rol.customer_detail) {
            await tx.customerDetail.create({ data: { party_role_id: rol.id, puntos: 0 } });
          }
        } else {
          const party = await tx.party.create({ data: { tipo: 'PERSONA', estado: 'ACTIVO' } });
          id = party.id;
          await tx.person.create({
            data: { party_id: id, nombres: dto.nombre.trim(), correo, cumple_dia: cumple?.dia ?? null, cumple_mes: cumple?.mes ?? null },
          });
          const rol = await tx.partyRole.create({ data: { party_id: id, rol: 'CLIENTE' } });
          await tx.customerDetail.create({ data: { party_role_id: rol.id, puntos: 0 } });
        }

        await tx.customerAccount.upsert({
          where: { party_id: id },
          create: { party_id: id, hash: hashPw, telefono: tel, activo: true },
          update: { hash: hashPw, telefono: tel, activo: true },
        });
        await this.guardarTelefono(tx, id, tel);
        if (dni) await this.guardarDni(tx, id, dni);
        if (correo && !(await tx.contactMechanism.findFirst({ where: { party_id: id, tipo: 'CORREO', valor: correo } }))) {
          await tx.contactMechanism.create({ data: { party_id: id, tipo: 'CORREO', valor: correo, principal: false } });
        }
        await tx.consent.create({ data: { party_id: id, version_texto: versionTexto, canal: 'CARTA' } });
        return id;
      });
    } catch (err: any) {
      // Dos registros a la vez con el mismo celular: gana uno solo (índice único parcial)
      if (err?.code === 'P2002') throw registrado;
      throw err;
    }

    const token = await this.generarTokenCliente(partyId!);
    const cliente = await this.yo(partyId!);
    await this.avisoCuenta.avisar(partyId!, tel, 'CREADA');

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'clientes',
      accion: 'CLIENTE_REGISTRADO',
      entidad: 'party',
      entidadId: partyId!,
      despues: { telefono: enmascararTelefono(tel), vinculado: Boolean(cuenta || partyId) },
      ip,
    });

    return { cliente: cliente!, token };
  }

  /**
   * Cuenta creada desde el bot de WhatsApp: solo celular y nombre, SIN contraseña (hash null). La persona define su
   * contraseña luego en la carta con «¿Olvidaste tu contraseña?». El consentimiento se guarda (canal BOT) con la
   * versión vigente de términos y privacidad. Si el celular ya tiene cuenta lanza TELEFONO_REGISTRADO.
   */
  async crearCuentaDesdeBot(telefono: string, nombre: string): Promise<{ partyId: string; primerNombre: string }> {
    const tel = celular9De(telefono);
    if (!tel) throw new BadRequestException({ codigo: 'TELEFONO_INVALIDO', mensaje: 'El celular debe tener 9 dígitos y empezar con 9.' });
    const limpio = (nombre ?? '').trim().replace(/\s+/g, ' ');
    if (limpio.length < 2) throw new BadRequestException({ codigo: 'NOMBRE_REQUERIDO', mensaje: 'Escribe tu nombre.' });
    if ((await this.cuentaPorCelular(tel)) || (await this.prisma.customerAccount.findFirst({ where: { telefono: tel }, select: { id: true } }))) {
      throw new ConflictException({ codigo: 'TELEFONO_REGISTRADO', mensaje: 'Ese celular ya tiene cuenta.' });
    }
    const versionTexto = versionConsentimiento(await versionesLegales(this.prisma));
    let partyId: bigint;
    try {
      partyId = await this.prisma.$transaction(async (tx) => {
        const party = await tx.party.create({ data: { tipo: 'PERSONA', estado: 'ACTIVO' } });
        await tx.person.create({ data: { party_id: party.id, nombres: limpio } });
        const rol = await tx.partyRole.create({ data: { party_id: party.id, rol: 'CLIENTE' } });
        await tx.customerDetail.create({ data: { party_role_id: rol.id, puntos: 0 } });
        await tx.customerAccount.create({ data: { party_id: party.id, hash: null, telefono: tel, activo: true } });
        await tx.contactMechanism.create({ data: { party_id: party.id, tipo: 'TELEFONO', valor: tel, principal: true } });
        await tx.consent.create({ data: { party_id: party.id, version_texto: versionTexto, canal: 'BOT' } });
        return party.id;
      });
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException({ codigo: 'TELEFONO_REGISTRADO', mensaje: 'Ese celular ya tiene cuenta.' });
      throw err;
    }
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'clientes',
      accion: 'CLIENTE_CREADO_BOT',
      entidad: 'party',
      entidadId: partyId,
      despues: { telefono: enmascararTelefono(tel), consentimiento: versionTexto },
    });
    return { partyId: partyId.toString(), primerNombre: limpio.split(' ')[0] };
  }

  /**
   * Ingreso de cliente desde la carta (POST /carta/cuenta/ingresar): celular + contraseña.
   * Todo fallo responde igual: no revela si el celular tiene cuenta.
   */
  async ingresar(dto: IngresoClienteDto, ip?: string): Promise<{ cliente: ClienteSesion; token: string }> {
    const generico = () =>
      new BadRequestException({
        codigo: 'CREDENCIALES_INVALIDAS',
        mensaje: 'Celular o contraseña incorrectos.',
      });
    const tel = celular9De(dto.telefono);
    if (!tel || !dto.contrasena || typeof dto.contrasena !== 'string') throw generico();

    // 1. Bloqueo por intentos fallidos (Redis): 5 en 5 minutos
    const redis = this.redisService.obtenerCliente();
    const claveRedis = `bloqueo:cliente:${tel}`;
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

    const fallo = async () => {
      try {
        const n = await redis.incr(claveRedis);
        await redis.expire(claveRedis, 300); // 5 min
        if (n === 5) {
          await this.auditoria.registrar({
            categoria: 'ACCESO',
            modulo: 'clientes',
            accion: 'CLIENTE_INGRESO_BLOQUEADO',
            entidad: 'customer_account',
            despues: { telefono: enmascararTelefono(tel) },
            ip,
          });
        }
      } catch { /* aviso de auditoria opcional; no debe cortar el flujo */ }
      throw generico();
    };

    // 2. Cuenta por celular, activa y con contraseña
    const cuenta = await this.prisma.customerAccount.findFirst({ where: { telefono: tel, activo: true } });
    if (!cuenta?.hash) return fallo();
    if (!(await argon2.verify(cuenta.hash, dto.contrasena))) return fallo();

    try {
      await redis.del(claveRedis);
    } catch { /* limpiar el codigo en Redis es best-effort; expira por TTL */ }
    const token = await this.generarTokenCliente(cuenta.party_id);
    const cliente = await this.yo(cuenta.party_id);
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
        contactos: true,
        cuentaCliente: { select: { telefono: true } },
        roles: {
          where: { rol: 'CLIENTE', hasta: null },
          include: { customer_detail: true },
        },
        documentos: { where: { tipo: 'DNI' }, select: { numero: true } },
      },
    });

    if (!party) return null;
    const dni = party.documentos?.[0]?.numero;

    const puntos = await this.puntosService.obtenerSaldo(id);
    const fotoId = party.persona?.foto_archivo_id;
    const foto = fotoId ? await this.prisma.archivo.findUnique({ where: { id: fotoId } }) : null;

    return {
      partyId: id.toString(),
      nombre: party.persona?.nombres || 'Cliente',
      correo: party.persona?.correo || null,
      telefono: party.cuentaCliente?.telefono ?? telefonoDeContactos(party.contactos),
      fotoUrl: foto ? `/archivos/${foto.ruta}` : null,
      cumpleanos: formatearCumpleanos(party.persona?.cumple_dia, party.persona?.cumple_mes),
      puntos,
      // El DNI es opcional: solo se muestra enmascarado y solo si la cuenta lo tiene
      ...(dni ? { dniMascara: enmascararDni(dni) } : {}),
    };
  }

  /**
   * Edición del perfil desde la cuenta del cliente (PUT /carta/cuenta/perfil).
   * Solo toca nombre, correo y cumpleaños. El celular es la identidad de la cuenta y no se cambia aquí.
   */
  async actualizarPerfil(partyId: bigint | string, dto: PerfilClienteDto, ip?: string): Promise<ClienteSesion | null> {
    const id = BigInt(partyId);

    if (dto.nombre !== undefined && String(dto.nombre).trim().length < 3) {
      throw new BadRequestException({
        codigo: 'NOMBRE_REQUERIDO',
        mensaje: 'Escribe tu nombre.',
      });
    }

    if (dto.telefono !== undefined) {
      const actual = (await this.yo(id))?.telefono;
      if (celular9De(dto.telefono) !== celular9De(actual)) {
        throw new BadRequestException({
          codigo: 'TELEFONO_NO_EDITABLE',
          mensaje: 'Tu celular es tu usuario y no se puede cambiar desde aquí.',
        });
      }
    }

    const dni = dniOpcional(dto.dni);

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
      if (dni) await this.guardarDni(tx, id, dni);
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
  /**
   * Guarda el DNI opcional como identificador del party. Si ese DNI ya es de otra persona (o el party ya tiene uno),
   * no se guarda y no se revela nada: el registro sigue igual.
   */
  private async guardarDni(tx: Prisma.TransactionClient, partyId: bigint, dni: string) {
    const usado = await tx.partyIdentifier.findFirst({ where: { tipo: 'DNI', numero: dni }, select: { id: true } });
    if (usado) return;
    const propio = await tx.partyIdentifier.findFirst({ where: { party_id: partyId, tipo: 'DNI' }, select: { id: true } });
    if (propio) return;
    await tx.partyIdentifier.create({ data: { party_id: partyId, tipo: 'DNI', numero: dni } });
  }

  private async guardarTelefono(tx: Prisma.TransactionClient, partyId: bigint, telefono: string) {
    // Si el party ya tiene ese celular activo (p. ej. como WHATSAPP), no se duplica: el índice único no lo admite
    const mismo = await tx.contactMechanism.findFirst({
      where: { party_id: partyId, tipo: { in: ['TELEFONO', 'WHATSAPP'] }, valor: { in: [telefono, `51${telefono}`] }, activo: true },
      select: { id: true },
    });
    if (mismo) return;
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
   * Completa la fecha de cumpleaños desde la carta. Solo la guarda si la cuenta aún no la tiene:
   * cambiarla es una edición de perfil (actualizarPerfil), no este paso.
   */
  async guardarCumpleanos(partyId: bigint | string, fechaStr: string) {
    const id = BigInt(partyId);
    const c = exigirCumpleanos(fechaStr);

    await this.prisma.person.updateMany({
      where: { party_id: id, cumple_dia: null },
      data: { cumple_dia: c.dia, cumple_mes: c.mes },
    });

    const persona = await this.prisma.person.findUnique({ where: { party_id: id }, select: { cumple_dia: true, cumple_mes: true } });
    return { ok: true, cumpleanos: formatearCumpleanos(persona?.cumple_dia, persona?.cumple_mes) };
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
            documentos: { where: { tipo: 'RUC' } },
            contactos: true,
            // Pedidos pagados del cliente: los que lo tienen en cliente_party_id, y los de carta/WhatsApp/bot
            // sin ese campo (su party_id es el cliente). En MOZO/CAJA party_id es el personal: no cuenta.
            pedidosComoCliente: {
              where: { pago_estado: 'PAGADO' },
              select: { id: true },
            },
            pedidos: {
              where: { pago_estado: 'PAGADO', canal: { in: CANALES_CLIENTE_EN_PARTY }, cliente_party_id: null },
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
      // Solo el RUC sirve para reconocer una empresa; el DNI de un cliente no se lee ni se devuelve
      const docNum = p.documentos.find((d: any) => d.tipo === 'RUC')?.numero || '';

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

      return {
        id: p.id.toString(),
        nombre: p.persona?.nombres || 'Sin nombre',
        tipo,
        telefono: tel,
        correo,
        cumpleanos: cumple,
        pedidos: p.pedidosComoCliente.length + p.pedidos.length,
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
      const digitos = q.replace(/\D/g, '');
      items = items.filter(
        (it) => it.nombre.toLowerCase().includes(q) || (digitos.length >= 3 && it.telefono.includes(digitos)),
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
        documentos: { where: { tipo: 'RUC' } },
        contactos: true,
        roles: { where: { rol: 'CLIENTE' }, include: { customer_detail: true } },
      },
    });

    if (!party) {
      throw new NotFoundException({
        codigo: 'CLIENTE_NO_ENCONTRADO',
        mensaje: `No se encontró el cliente con ID ${partyId}`,
      });
    }

    // Pedidos del cliente con la misma regla que el listado: cliente_party_id, o carta/WhatsApp/bot sin ese campo.
    // En MOZO/CAJA party_id es el personal que tomó el pedido, nunca el cliente.
    const delCliente = {
      OR: [
        { cliente_party_id: id },
        { party_id: id, canal: { in: CANALES_CLIENTE_EN_PARTY }, cliente_party_id: null },
      ],
    };
    const [pedidos, pagados] = await Promise.all([
      this.prisma.pedido.findMany({
        where: delCliente,
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
      }),
      this.prisma.pedido.aggregate({
        where: { ...delCliente, pago_estado: 'PAGADO' },
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);

    // Solo una empresa tiene documento (RUC); un cliente persona no tiene DNI guardado
    const esAdmin = usuarioAutenticado?.rol === 'ADMIN' || usuarioAutenticado?.rol === 'admin';
    const ruc = party.documentos[0]?.numero || null;

    const puntos = await this.puntosService.obtenerSaldo(id);
    const puntosPedidos = await explicarPedidosPorId(this.prisma, pedidos.map((p) => p.id)).catch(() => new Map<string, ExplicacionPuntos>());
    const tel = party.contactos.find((c) => c.tipo === 'TELEFONO' || c.tipo === 'WHATSAPP')?.valor || '—';
    const correo = party.persona?.correo || party.contactos.find((c) => c.tipo === 'CORREO')?.valor || 'sin correo';

    return {
      id: party.id.toString(),
      nombre: party.persona?.nombres || 'Sin nombre',
      ruc: ruc ? (esAdmin ? ruc : enmascararDoc(ruc)) : null,
      telefono: tel,
      correo,
      cumpleanos: formatearCumpleanos(party.persona?.cumple_dia, party.persona?.cumple_mes),
      cumpleDia: party.persona?.cumple_dia,
      cumpleMes: party.persona?.cumple_mes,
      puntos,
      // Cuenta y total gastado: solo pedidos pagados (todos, no solo los 20 de la lista)
      pedidosPagados: pagados._count._all,
      totalGastado: Math.round(Number(pagados._sum.total ?? 0) * 100) / 100,
      pedidos: pedidos.map((p) => ({
        puntos: puntosPedidos.get(String(p.id)) ?? null,
        id: p.codigo || p.id.toString(),
        modalidad: p.modalidad === 'DELIVERY' ? 'Delivery' : p.modalidad === 'LLEVAR' ? 'Para llevar' : 'En el local',
        estado: p.estado,
        total: `s/ ${Number(p.total).toFixed(2)}`,
        pago: p.pago_estado === 'PAGADO' ? 'Cobrado' : 'Sin cobrar',
        fecha: p.creado_en.toISOString(),
      })),
    };
  }

  /**
   * Registro en mostrador (RQ-CLI-01-06): quien atiende crea el cliente sin contraseña.
   * Una persona se identifica por su celular (sin DNI); solo una empresa lleva RUC.
   * Después se registra en la carta con ese mismo celular y la cuenta se vincula.
   */
  async crearEnMostrador(dto: RegistrarMostradorDto, usuarioId?: string, ip?: string) {
    const ruc = String(dto.ruc || '').trim().replace(/\D/g, '');
    const esEmpresa = ruc.length > 0;
    const tel = celular9De(dto.telefono);

    if (esEmpresa && ruc.length !== 11) {
      throw new BadRequestException({
        codigo: 'DOCUMENTO_INVALIDO',
        mensaje: 'El RUC de una empresa tiene 11 dígitos.',
      });
    }
    if (!esEmpresa && !tel) {
      throw new BadRequestException({
        codigo: 'TELEFONO_INVALIDO',
        mensaje: 'El celular debe tener 9 dígitos y empezar con 9.',
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

    const yaExiste = esEmpresa
      ? await this.prisma.partyIdentifier.findFirst({ where: { tipo: 'RUC', numero: ruc } })
      : await this.cuentaPorCelular(tel!);
    if (yaExiste) {
      throw new BadRequestException({
        codigo: 'CLIENTE_YA_EXISTE',
        mensaje: esEmpresa ? 'Ya existe un cliente con ese RUC.' : 'Ya existe un cliente con ese celular.',
      });
    }
    // Una persona = un party: el celular no puede estar activo en otro party (aunque no tenga cuenta)
    if (!esEmpresa && (await partyDeCelular(this.prisma, tel!))) {
      throw new ConflictException(CELULAR_OTRA_PERSONA);
    }

    const versionTexto = versionConsentimiento(await versionesLegales(this.prisma));
    const nuevoParty = await this.prisma.$transaction(async (tx) => {
      const party = await tx.party.create({
        data: {
          tipo: esEmpresa ? 'ORGANIZACION' : 'PERSONA',
          estado: 'ACTIVO',
        },
      });

      if (esEmpresa) {
        await tx.partyIdentifier.create({ data: { party_id: party.id, tipo: 'RUC', numero: ruc } });
      }

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

      // CustomerAccount con hash=null (sin contraseña: la crea al registrarse en la carta con este celular)
      await tx.customerAccount.create({
        data: {
          party_id: party.id,
          hash: null,
          telefono: esEmpresa ? null : tel,
          activo: true,
        },
      });

      if (tel) {
        await tx.contactMechanism.create({
          data: {
            party_id: party.id,
            tipo: 'TELEFONO',
            valor: tel,
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
          version_texto: versionTexto,
          canal: 'CAJA',
        },
      });

      return party;
    }).catch((err: any) => {
      // Celular que otro party ya tiene (carrera): 409 claro, nunca 500
      if (err?.code === 'P2002') throw new ConflictException(CELULAR_OTRA_PERSONA);
      throw err;
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'clientes',
      accion: 'CLIENTE_CREADO_MOSTRADOR',
      entidad: 'party',
      entidadId: nuevoParty.id,
      despues: { nombre: dto.nombre.trim(), telefono: tel ? enmascararTelefono(tel) : null, ruc: esEmpresa ? enmascararDoc(ruc) : null },
      partyId: usuarioId ? BigInt(usuarioId) : undefined,
      ip,
    });

    return {
      id: nuevoParty.id.toString(),
      nombre: dto.nombre.trim(),
      telefono: tel,
    };
  }

  /**
   * Editar cliente desde el administrativo (si cambia el celular, cambia también el usuario de su cuenta).
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

      // 2. Teléfono (también es el usuario de su cuenta: único entre cuentas activas)
      if (dto.telefono !== undefined) {
        const tel = celular9De(dto.telefono);
        if (!tel) {
          throw new BadRequestException({
            codigo: 'TELEFONO_INVALIDO',
            mensaje: 'El celular debe tener 9 dígitos y empezar con 9.',
          });
        }
        const otra = await tx.customerAccount.findFirst({ where: { telefono: tel, activo: true, party_id: { not: id } }, select: { id: true } });
        if (otra) {
          throw new BadRequestException({
            codigo: 'TELEFONO_REGISTRADO',
            mensaje: 'Ese celular ya es de otra cuenta.',
          });
        }
        await this.guardarTelefono(tx, id, tel);
        await tx.customerAccount.updateMany({ where: { party_id: id }, data: { telefono: tel } });
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

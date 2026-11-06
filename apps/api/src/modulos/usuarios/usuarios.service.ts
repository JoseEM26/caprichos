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
  PayloadTooLargeException,
  forwardRef,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FilaImportarPersonalDto } from './dto/fila-importar-personal.dto';
import {
  aTexto,
  diaAnterior,
  duracion,
  errorPeriodo,
  formatoDuracion,
  formatoTotal,
  hoyLima,
  tiempoTotal,
  vecesQueSalio,
  type Periodo,
} from './periodos-laborales';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ArchivosService } from '../archivos/archivos.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ROLES } from '../acceso/permisos';
import {
  TIPOS_DOCUMENTO,
  documentoValido,
  errorCombinacionRoles,
  rolesDeCuenta,
} from '../acceso/roles-usuario';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { EditarUsuarioDto } from './dto/editar-usuario.dto';
import { CambiarClaveUsuarioDto } from './dto/cambiar-clave-usuario.dto';
import { FiltrarUsuariosDto } from './dto/filtrar-usuarios.dto';
import { AsignarPinDto } from './dto/asignar-pin.dto';
import { ConfigurarAlertasWhatsappDto } from './dto/configurar-alertas-whatsapp.dto';
import { ConfigurarHorarioDto } from './dto/horario.dto';
import { deHora, guardarHorarioTx } from './horario.util';
import { rolRecibeAvisosPorDefecto } from '../correo/roles-avisos';
import { CORREO_REQUERIDO_AVISOS } from '../correo/avisos-mensajes';
import { enmascararDni, generarClaveAleatoria } from './usuarios.util';
import {
  ROLES_ALERTAS_WHATSAPP,
  calcularEstadoAlertas,
  normalizarCelularPeru,
} from './alertas-whatsapp.util';
import { AvisosInternosService } from '../chatbot/avisos-internos/avisos-internos.service';
import {
  CELULAR_OTRA_PERSONA,
  asegurarContactoCelular,
  celularDeOtraPersona,
  partyDeCelular,
} from '../clientes/celular-party.util';

/** Mismo límite que la foto de Mi perfil (acceso/mi-perfil.service.ts). */
const FOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Mensaje de un error de Nest (ErrorBase con codigo/mensaje) o uno genérico. */
function mensajeDeError(err: unknown): string {
  const r: any = (err as any)?.getResponse?.();
  if (r && typeof r === 'object' && typeof r.mensaje === 'string') return r.mensaje;
  return 'No se pudo crear esta fila';
}

/** AAAA-MM-DD a fecha (solo día). Vacío = null; una fecha inexistente (p. ej. 2026-02-30) = 400. */
function fechaDe(valor: string | undefined | null, etiqueta: string): Date | null {
  if (!valor) return null;
  const d = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) {
    throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: `La fecha ${etiqueta} no es válida` });
  }
  return d;
}

const iguales = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly archivos: ArchivosService,
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
      // Cuenta por su principal o por cualquiera de sus roles extra
      where.OR = [{ rol }, { rolesExtra: { some: { rol } } }];
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
                tipo: { in: [...TIPOS_DOCUMENTO] },
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
                where: { tipo: { in: [...TIPOS_DOCUMENTO] } },
              },
            },
          },
          rolesExtra: true,
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    const ahora = new Date();
    const elementos = usuarios.map((u) => {
      const dniDoc = u.party?.documentos?.[0]?.numero ?? '';
      return {
        id: u.id.toString(),
        partyId: u.party_id.toString(),
        nombres: u.party?.persona?.nombres ?? '',
        apellidos: u.party?.persona?.apellidos ?? '',
        dni: enmascararDni(dniDoc),
        tipoDocumento: u.party?.documentos?.[0]?.tipo ?? 'DNI',
        rol: u.rol,
        roles: [u.rol, ...(u.rolesExtra ?? []).filter((r) => !r.vence_en || r.vence_en > ahora).map((r) => r.rol)],
        rolesTemporales: (u.rolesExtra ?? [])
          .filter((r) => r.vence_en && r.vence_en > ahora)
          .map((r) => ({
            rol: r.rol,
            nombre: ROLES.find((x) => x.codigo === r.rol)?.nombre ?? r.rol,
            venceEn: r.vence_en,
            motivo: r.motivo,
          })),
        paisNacimiento: u.party?.persona?.pais_nacimiento ?? null,
        avisosCorreo: Boolean(u.avisos_correo),
        horario24_7: Boolean(u.party?.persona?.horario_24_7),
        correo: u.party?.persona?.correo ?? null,
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
            documentos: { where: { tipo: { in: [...TIPOS_DOCUMENTO] } } },
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
   * Crea un nuevo usuario en una sola transacción: Party (PERSONA) + Person + PartyIdentifier (documento) + UserAccount.
   * Genera contraseña aleatoria de 12 caracteres con hash argon2id y la devuelve una única vez como claveInicial.
   */
  async crear(dto: CrearUsuarioDto, usuarioActual?: UsuarioAutenticado, ip?: string) {
    return this.crearUno(dto, usuarioActual, ip, true);
  }

  /** Alta de una cuenta. La importación la llama con auditar=false y audita una sola vez al final. */
  private async crearUno(
    dto: CrearUsuarioDto,
    usuarioActual: UsuarioAutenticado | undefined,
    ip: string | undefined,
    auditar: boolean,
    claveFija?: string,
  ) {
    const { tipo: tipoDoc, numero: dniLimpio } = this.documentoDeDto(dto.tipoDocumento, dto.documento ?? dto.dni);
    const extras = this.rolesExtraValidos(dto.rol, dto.otrosRoles);
    const fechaIngreso = fechaDe(dto.fechaIngreso, 'de ingreso');
    const fechaReingreso = fechaDe(dto.fechaReingreso, 'de reingreso');
    if (fechaReingreso && !fechaIngreso) {
      throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: 'Indica la fecha de ingreso para registrar el reingreso' });
    }
    if (fechaReingreso && fechaIngreso && fechaReingreso.getTime() <= fechaIngreso.getTime()) {
      throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: 'El reingreso debe ser posterior al ingreso' });
    }
    // Sin fecha de salida registrada: si hay reingreso, el primer periodo queda sin cerrar hasta corregirlo
    const avisos = fechaReingreso ? ['Fecha de salida no registrada: corregir en el historial laboral.'] : [];
    const celular9 = dto.celular ?? null;
    const activo = dto.activo ?? true;

    // Un documento (de cualquier tipo del personal) es único: si el número ya existe con otro tipo, es conflicto.
    // Si el documento (o el celular) ya es de un party SIN usuario, se reutiliza y se le suma el usuario del personal.
    // Si ya tiene usuario, es otra persona: error.
    const dniExistente = await this.prisma.partyIdentifier.findFirst({
      where: { numero: dniLimpio, tipo: { in: [...TIPOS_DOCUMENTO] } },
    });
    if (dniExistente && dniExistente.tipo !== tipoDoc) {
      throw new ConflictException({
        codigo: 'DNI_DUPLICADO',
        mensaje: 'El número de documento ya se encuentra registrado con otro tipo de documento',
      });
    }

    let reutilizarId: bigint | null = null;
    if (dniExistente) {
      if (await this.tienePartyUsuario(dniExistente.party_id)) {
        throw new ConflictException({
          codigo: 'DNI_DUPLICADO',
          mensaje: 'El DNI ya se encuentra registrado en el sistema',
        });
      }
      reutilizarId = dniExistente.party_id;
    } else if (celular9) {
      const dueno = await partyDeCelular(this.prisma, celular9);
      if (dueno) {
        if (await this.tienePartyUsuario(dueno)) {
          throw new ConflictException(CELULAR_OTRA_PERSONA);
        }
        reutilizarId = dueno;
      }
    }

    const claveInicial = claveFija ?? generarClaveAleatoria(12);
    const hash = await argon2.hash(claveInicial, { type: argon2.argon2id });

    let nuevo;
    try {
      nuevo = await this.prisma.$transaction(async (tx) => {
        const party = reutilizarId
          ? { id: reutilizarId }
          : await tx.party.create({
              data: {
                tipo: 'PERSONA',
                estado: 'ACTIVO',
              },
            });

        const nombres = dto.nombres.trim();
        const apellidos = dto.apellidos.trim();
        const correo = dto.correo ? dto.correo.trim().toLowerCase() : null;
        // Horario 24/7: por defecto, el ADMIN
        const horario247 = dto.horario24_7 ?? dto.rol === 'ADMIN';
        const pais = dto.paisNacimiento?.trim() || null;
        const cumple = dto.fechaNacimiento
          ? {
              cumple_mes: Number(dto.fechaNacimiento.slice(5, 7)),
              cumple_dia: Number(dto.fechaNacimiento.slice(8, 10)),
            }
          : null;

        const personaPrevia = reutilizarId ? await tx.person.findUnique({ where: { party_id: party.id } }) : null;
        const person = personaPrevia
          ? await tx.person.update({
              where: { party_id: party.id },
              data: {
                // El nombre del formulario reemplaza solo el placeholder «Cliente» (o uno vacío); lo demás, solo si falta
                nombres: !personaPrevia.nombres || personaPrevia.nombres === 'Cliente' ? nombres : personaPrevia.nombres,
                apellidos: personaPrevia.apellidos || apellidos,
                correo: personaPrevia.correo || correo,
                ...(cumple && personaPrevia.cumple_mes == null ? cumple : {}),
                ...(pais && !personaPrevia.pais_nacimiento ? { pais_nacimiento: pais } : {}),
                horario_24_7: horario247,
              },
            })
          : await tx.person.create({
              data: {
                party_id: party.id,
                nombres,
                apellidos,
                ...(correo ? { correo } : {}),
                ...(cumple ?? {}),
                ...(pais ? { pais_nacimiento: pais } : {}),
                horario_24_7: horario247,
              },
            });

        if (celular9) {
          await asegurarContactoCelular(tx, party.id, celular9, 'WHATSAPP');
        }

        const partyIdentifier =
          dniExistente ??
          (await tx.partyIdentifier.create({
            data: {
              party_id: party.id,
              tipo: tipoDoc,
              numero: dniLimpio,
            },
          }));

        // Avisos por correo: por defecto ADMIN y SUPERVISOR con correo. Pedirlos sin correo es error.
        const avisosCorreo = dto.avisosCorreo ?? (rolRecibeAvisosPorDefecto(dto.rol) && Boolean(person.correo));
        if (avisosCorreo && !person.correo) throw new BadRequestException(CORREO_REQUERIDO_AVISOS);
        const userAccount = await tx.userAccount.create({
          data: {
            party_id: party.id,
            rol: dto.rol,
            hash,
            debe_cambiar: true,
            activo,
            avisos_correo: avisosCorreo,
          },
        });

        if (extras.length) {
          await tx.userAccountRol.createMany({
            data: extras.map((rol) => ({ user_account_id: userAccount.id, rol, otorgado_por: usuarioActual?.partyId ?? null })),
          });
          for (const rol of extras) {
            await tx.userAccountRolHistorial.create({
              data: { user_account_id: userAccount.id, rol, accion: 'OTORGADO', quien_party_id: usuarioActual?.partyId ?? null, desde: new Date() },
            });
          }
        }

        // Historial laboral: cada periodo es un party_role TRABAJADOR. Con reingreso: ingreso → día antes; reingreso → abierto.
        const periodos: Periodo[] = fechaReingreso
          ? [
              { desde: fechaIngreso!, hasta: diaAnterior(fechaReingreso) },
              { desde: fechaReingreso, hasta: null },
            ]
          : [{ desde: fechaIngreso ?? hoyLima(), hasta: null }];
        const conDescuento = dto.descuentoPct !== undefined && dto.descuentoPct !== null;
        for (const [k, p] of periodos.entries()) {
          const ultimo = k === periodos.length - 1;
          await tx.partyRole.create({
            data: {
              party_id: party.id,
              rol: 'TRABAJADOR',
              desde: p.desde,
              hasta: p.hasta,
              ...(ultimo && conDescuento ? { employee_detail: { create: { descuento_pct: dto.descuentoPct } } } : {}),
            },
          });
        }

        if (dto.horarios || dto.reemplazos) {
          await guardarHorarioTx(tx, party.id, dto);
        }

        return { party, person, partyIdentifier, userAccount, avisosCorreo, horario247 };
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        // Choque de unicidad en la carrera: si el documento existe ya es el documento; si no, el celular de otra persona
        const dniAhora = await this.prisma.partyIdentifier.findFirst({
          where: { numero: dniLimpio, tipo: { in: [...TIPOS_DOCUMENTO] } },
        });
        if (dniAhora) {
          throw new ConflictException({
            codigo: 'DNI_DUPLICADO',
            mensaje: 'El DNI ya se encuentra registrado en el sistema',
          });
        }
        throw new ConflictException(CELULAR_OTRA_PERSONA);
      }
      throw error;
    }

    const roles = [dto.rol, ...extras];
    if (auditar) {
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
          tipoDocumento: tipoDoc,
          rol: dto.rol,
          roles,
          activo,
          debeCambiar: true,
          avisosCorreo: nuevo.avisosCorreo,
          horario24_7: nuevo.horario247,
          diasTrabaja: dto.horarios?.length ?? 0,
          reemplazosFijos: dto.reemplazos?.length ?? 0,
        },
        partyId: usuarioActual?.partyId,
        ip,
      });
    }

    return {
      id: nuevo.userAccount.id.toString(),
      partyId: nuevo.party.id.toString(),
      nombres: nuevo.person.nombres,
      apellidos: nuevo.person.apellidos,
      dni: enmascararDni(dniLimpio),
      tipoDocumento: tipoDoc,
      rol: nuevo.userAccount.rol,
      roles,
      activo: nuevo.userAccount.activo,
      debeCambiar: nuevo.userAccount.debe_cambiar,
      claveInicial,
      avisos,
    };
  }

  /** Tipo (por defecto DNI) y número validados. El número de documento no se repite entre tipos. */
  private documentoDeDto(tipoRaw: string | undefined, numeroRaw: string | undefined): { tipo: string; numero: string } {
    const tipo = (tipoRaw || 'DNI').trim().toUpperCase();
    if (!(TIPOS_DOCUMENTO as readonly string[]).includes(tipo)) {
      throw new BadRequestException({ codigo: 'TIPO_DOCUMENTO_INVALIDO', mensaje: 'El tipo de documento no es válido' });
    }
    const numero = tipo === 'DNI' ? (numeroRaw ?? '').trim() : (numeroRaw ?? '').trim().toUpperCase();
    if (!numero) {
      throw new BadRequestException({ codigo: 'DOCUMENTO_REQUERIDO', mensaje: 'El número de documento es requerido' });
    }
    if (!documentoValido(tipo, numero)) {
      throw new BadRequestException({
        codigo: 'DOCUMENTO_INVALIDO',
        mensaje: tipo === 'DNI' ? 'El DNI debe tener exactamente 8 dígitos' : `El ${tipo} debe tener de 7 a 12 letras o números`,
      });
    }
    return { tipo, numero };
  }

  /** Roles extra validados contra el catálogo y las reglas de combinación. Devuelve solo los extra. */
  private rolesExtraValidos(rol: string, otros: string[] | undefined): string[] {
    const extras = [...new Set((otros ?? []).map((r) => String(r).trim()).filter(Boolean))];
    const catalogo = ROLES.map((r) => r.codigo as string);
    const desconocido = [rol, ...extras].find((r) => !catalogo.includes(r));
    if (desconocido) {
      throw new BadRequestException({ codigo: 'ROL_INVALIDO', mensaje: `El rol ${desconocido} no existe` });
    }
    const error = errorCombinacionRoles(rol, extras);
    if (error) {
      throw new BadRequestException({ codigo: 'ROLES_INVALIDOS', mensaje: error });
    }
    return extras;
  }

  /** Revisa una fila sin escribir: documento, roles, fechas y si el documento ya existe. */
  private async revisarFilaImportacion(fila: unknown): Promise<{
    estado: 'OK' | 'YA_EXISTE' | 'ERROR';
    motivo?: string;
    tipo?: string;
    numero?: string;
    objeto?: FilaImportarPersonalDto;
  }> {
    const objeto = plainToInstance(FilaImportarPersonalDto, fila ?? {});
    const erroresFila = await validate(objeto);
    if (erroresFila.length) {
      return { estado: 'ERROR', motivo: Object.values(erroresFila[0].constraints ?? {})[0] ?? 'Fila no válida' };
    }
    try {
      const doc = this.documentoDeDto(objeto.tipoDocumento, objeto.documento);
      this.rolesExtraValidos(objeto.rol, objeto.otrosRoles);
      fechaDe(objeto.fechaIngreso, 'de ingreso');
      fechaDe(objeto.fechaReingreso, 'de reingreso');
      const existe = await this.prisma.partyIdentifier.findFirst({
        where: { numero: doc.numero, tipo: { in: [...TIPOS_DOCUMENTO] } },
        select: { id: true },
      });
      return { estado: existe ? 'YA_EXISTE' : 'OK', tipo: doc.tipo, numero: doc.numero, objeto };
    } catch (err) {
      return { estado: 'ERROR', motivo: mensajeDeError(err) };
    }
  }

  /**
   * Importa personal desde la consola (sin sesión: la auditoría queda como sistema).
   * simular: solo revisa y devuelve por fila OK / YA_EXISTE / ERROR / DUPLICADO_EN_ARCHIVO; no escribe ni audita.
   * Si no: crea cada fila en su propia transacción con la clave inicial = su documento (debe_cambiar = true);
   * omite los documentos que ya existen (sin tocarlos) y los repetidos en el archivo. Audita una vez con conteos.
   */
  async importarPersonal(
    filas: FilaImportarPersonalDto[],
    opciones: { simular: boolean },
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    if (!Array.isArray(filas)) {
      throw new BadRequestException({ codigo: 'FILAS_REQUERIDAS', mensaje: 'Envía la lista de filas a importar' });
    }
    if (filas.length > 200) {
      throw new BadRequestException({ codigo: 'DEMASIADAS_FILAS', mensaje: 'Se importan como máximo 200 filas por vez' });
    }

    const resultados: Array<{ indice: number; estado: string; motivo?: string; avisos?: string[] }> = [];
    const vistos = new Set<string>();
    let creadas = 0;

    for (const [indice, fila] of filas.entries()) {
      const r = await this.revisarFilaImportacion(fila);
      if (r.numero) {
        const clave = `${r.tipo}:${r.numero}`;
        if (vistos.has(clave)) {
          resultados.push({ indice, estado: 'DUPLICADO_EN_ARCHIVO' });
          continue;
        }
        vistos.add(clave);
      }
      if (r.estado !== 'OK') {
        resultados.push({ indice, estado: r.estado, motivo: r.motivo });
        continue;
      }
      if (opciones.simular) {
        resultados.push({ indice, estado: 'OK' });
        continue;
      }
      try {
        const alta = await this.crearUno(
          { ...r.objeto!, tipoDocumento: r.tipo, documento: r.numero } as CrearUsuarioDto,
          usuarioActual,
          ip,
          false,
          r.numero,
        );
        creadas++;
        resultados.push({ indice, estado: 'CREADA', avisos: alta.avisos });
      } catch (err) {
        resultados.push({ indice, estado: 'ERROR', motivo: mensajeDeError(err) });
      }
    }

    if (opciones.simular) return { filas: filas.length, simulacion: true, resultados };

    const omitidas = resultados.filter((x) => x.estado === 'YA_EXISTE' || x.estado === 'DUPLICADO_EN_ARCHIVO').length;
    const errores = resultados.filter((x) => x.estado === 'ERROR').length;
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'IMPORTAR_PERSONAL',
      resultado: 'OK',
      entidad: 'user_account',
      antes: null,
      despues: { filas: filas.length, creados: creadas, omitidos: omitidas, errores },
      partyId: usuarioActual?.partyId,
      ip,
    });

    return { filas: filas.length, simulacion: false, resultados };
  }

  /** Historial laboral: periodos (party_role TRABAJADOR), tiempo total, veces que salió y si está en licencia. */
  async historialLaboral(id: bigint | string | number) {
    const cuenta = await this.cuentaConParty(id);
    const filas = await this.prisma.partyRole.findMany({
      where: { party_id: cuenta.party_id, rol: 'TRABAJADOR' },
      orderBy: { desde: 'asc' },
    });
    const hoy = hoyLima();
    const periodos = filas.map((f) => ({
      id: f.id.toString(),
      desde: aTexto(f.desde),
      hasta: f.hasta ? aTexto(f.hasta) : null,
      abierto: f.hasta === null,
      duracion: formatoDuracion(duracion(f.desde, f.hasta ?? hoy)),
    }));
    const total = tiempoTotal(
      filas.map((f) => ({ desde: f.desde, hasta: f.hasta })),
      hoy,
    );
    return {
      activo: cuenta.activo,
      enLicencia: !cuenta.activo && filas.some((f) => f.hasta === null),
      periodos,
      tiempoTotal: formatoTotal(total),
      vecesSalio: vecesQueSalio(filas.map((f) => ({ desde: f.desde, hasta: f.hasta }))),
    };
  }

  /** Corrige un periodo (solo ADMIN): desde ≤ hasta y sin días compartidos con otro periodo de la misma persona. */
  async editarPeriodo(
    id: bigint | string | number,
    periodoId: bigint | string | number,
    dto: { desde: string; hasta?: string | null },
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    this.exigirAdmin(usuarioActual);
    const cuenta = await this.cuentaConParty(id);
    const periodo = await this.prisma.partyRole.findFirst({
      where: { id: this.parsearId(periodoId), party_id: cuenta.party_id, rol: 'TRABAJADOR' },
    });
    if (!periodo) {
      throw new NotFoundException({ codigo: 'PERIODO_NO_ENCONTRADO', mensaje: 'Periodo no encontrado' });
    }
    const desde = fechaDe(dto.desde, 'de ingreso');
    if (!desde) {
      throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: 'Indica la fecha de ingreso del periodo' });
    }
    const hasta = dto.hasta ? fechaDe(dto.hasta, 'de salida') : null;
    const otros = await this.prisma.partyRole.findMany({
      where: { party_id: cuenta.party_id, rol: 'TRABAJADOR', id: { not: periodo.id } },
      select: { desde: true, hasta: true },
    });
    const error = errorPeriodo({ desde, hasta }, otros);
    if (error) {
      throw new BadRequestException({ codigo: 'PERIODO_INVALIDO', mensaje: error });
    }

    await this.prisma.partyRole.update({ where: { id: periodo.id }, data: { desde, hasta } });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'PERIODO_EDITAR',
      resultado: 'OK',
      entidad: 'party_role',
      entidadId: periodo.id,
      antes: { desde: aTexto(periodo.desde), hasta: periodo.hasta ? aTexto(periodo.hasta) : null },
      despues: { desde: aTexto(desde), hasta: hasta ? aTexto(hasta) : null },
      partyId: usuarioActual?.partyId,
      ip,
    });
    return this.historialLaboral(id);
  }

  private async tienePartyUsuario(partyId: bigint): Promise<boolean> {
    const cuenta = await this.prisma.userAccount.findUnique({ where: { party_id: partyId }, select: { id: true } });
    return Boolean(cuenta);
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
        .map((h) => ({
          dia: h.dia_semana,
          entrada: deHora(h.entrada),
          salida: deHora(h.salida),
          almuerzoInicio: h.almuerzo_inicio ? deHora(h.almuerzo_inicio) : null,
          almuerzoFin: h.almuerzo_fin ? deHora(h.almuerzo_fin) : null,
        }))
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

  private exigirAdmin(usuarioActual?: UsuarioAutenticado) {
    if (usuarioActual?.rol !== 'ADMIN') {
      throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo un administrador puede hacer esto' });
    }
  }

  /**
   * Re-autenticación: la clave del ADMIN que opera debe coincidir con su hash. No cuenta intentos
   * ni revela nada más si falla.
   */
  private async exigirClaveAdmin(usuarioActual: UsuarioAutenticado | undefined, claveAdmin: string | undefined) {
    this.exigirAdmin(usuarioActual);
    if (!claveAdmin) {
      throw new BadRequestException({ codigo: 'CLAVE_ADMIN_REQUERIDA', mensaje: 'Escribe tu contraseña de administrador' });
    }
    const admin = await this.prisma.userAccount.findUnique({
      where: { party_id: usuarioActual!.partyId },
      select: { hash: true },
    });
    let coincide = false;
    if (admin) {
      try {
        coincide = await argon2.verify(admin.hash, claveAdmin);
      } catch {
        coincide = false;
      }
    }
    if (!coincide) {
      throw new ForbiddenException({
        codigo: 'CLAVE_ADMIN_INCORRECTA',
        mensaje: 'La contraseña de administrador no es correcta',
      });
    }
  }

  /**
   * Edita nombres, apellidos, correo, documento, roles, fechas o país. No permite quitar el rol al último ADMIN activo.
   * El documento solo lo cambia el ADMIN y exige su clave; si cambia la cuenta propia, se revocan sus sesiones
   * y la respuesta trae reingresar=true. Cambiar roles es solo ADMIN y queda auditado (CAMBIAR_ROLES).
   */
  async editar(id: bigint | string | number, dto: EditarUsuarioDto, usuarioActual?: UsuarioAutenticado, ip?: string) {
    const accountId = this.parsearId(id);
    const usuario = await this.prisma.userAccount.findUnique({
      where: { id: accountId },
      include: {
        party: {
          include: {
            persona: true,
            documentos: { where: { tipo: { in: [...TIPOS_DOCUMENTO] } } },
          },
        },
        rolesExtra: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException({
        codigo: 'USUARIO_NO_ENCONTRADO',
        mensaje: 'Usuario no encontrado',
      });
    }

    // Roles: el principal y los extra. Si cambia el principal y no llegan extras, se conservan los extra sin el nuevo principal.
    const rolNuevo = dto.rol !== undefined ? dto.rol : usuario.rol;
    // Los roles temporales (con fecha) no se tocan desde el editor: se dan y se quitan con su propia acción.
    const ahoraRoles = new Date();
    const vigentes = (usuario.rolesExtra ?? []).filter((r) => !r.vence_en || r.vence_en.getTime() > ahoraRoles.getTime());
    const temporalesAntes = vigentes.filter((r) => r.vence_en).map((r) => r.rol).sort();
    const rolesExtraAntes = vigentes.filter((r) => !r.vence_en).map((r) => r.rol).sort();
    const rolesAntes = [usuario.rol, ...rolesExtraAntes, ...temporalesAntes];
    const rolesPedidos = dto.rol !== undefined || dto.otrosRoles !== undefined;
    const otrosPedidos = (dto.otrosRoles !== undefined ? dto.otrosRoles : rolesExtraAntes.filter((r) => r !== rolNuevo)).filter(
      (r) => !temporalesAntes.includes(r),
    );
    const extrasNuevos = rolesPedidos
      ? this.rolesExtraValidos(rolNuevo, [...otrosPedidos, ...temporalesAntes])
      : [...rolesExtraAntes, ...temporalesAntes];
    const extrasPermanentesNuevos = extrasNuevos.filter((r) => !temporalesAntes.includes(r));
    const rolesDespues = [rolNuevo, ...extrasNuevos];
    const rolesCambian = !iguales(rolesAntes, rolesDespues);

    // Proteger último ADMIN activo si se intenta cambiar de rol
    if (usuario.rol === 'ADMIN' && usuario.activo && rolNuevo !== 'ADMIN') {
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

    // Documento: tipo y número. Si llega cualquiera de los dos, el par se valida completo.
    const esPropia = usuarioActual?.partyId === usuario.party_id;
    const docAnterior = usuario.party?.documentos?.[0];
    const tipoAnterior = docAnterior?.tipo ?? 'DNI';
    const numeroAnterior = docAnterior?.numero ?? '';
    const docEntrada = dto.documento ?? dto.dni;
    const docPedido = dto.tipoDocumento !== undefined || docEntrada !== undefined;
    const doc = docPedido
      ? this.documentoDeDto(dto.tipoDocumento ?? tipoAnterior, docEntrada ?? numeroAnterior)
      : { tipo: tipoAnterior, numero: numeroAnterior };
    const dniCambia = docPedido && (doc.numero !== numeroAnterior || doc.tipo !== tipoAnterior);

    const correoAnterior = usuario.party?.persona?.correo ?? null;
    const correoNuevo = dto.correo !== undefined ? dto.correo.trim().toLowerCase() || null : correoAnterior;
    const correoCambia = dto.correo !== undefined && correoNuevo !== correoAnterior;
    const paisNuevo = dto.paisNacimiento !== undefined ? dto.paisNacimiento.trim() || null : undefined;

    // Avisos por correo: con la casilla encendida hace falta correo (si se toca correo o casilla)
    const avisosNuevo = dto.avisosCorreo ?? usuario.avisos_correo;
    if (avisosNuevo && !correoNuevo && (dto.avisosCorreo !== undefined || dto.correo !== undefined)) {
      throw new BadRequestException(CORREO_REQUERIDO_AVISOS);
    }
    const avisosCambian = dto.avisosCorreo !== undefined && dto.avisosCorreo !== usuario.avisos_correo;
    const horarioPedido = dto.horario24_7 !== undefined;

    if (docPedido || dto.correo !== undefined || rolesCambian || avisosCambian || horarioPedido) this.exigirAdmin(usuarioActual);
    if (dniCambia) {
      await this.exigirClaveAdmin(usuarioActual, dto.claveAdmin);
      const otro = await this.prisma.partyIdentifier.findFirst({
        where: { numero: doc.numero, tipo: { in: [...TIPOS_DOCUMENTO] } },
      });
      if (otro && otro.id !== docAnterior?.id) {
        throw new ConflictException({ codigo: 'DNI_DUPLICADO', mensaje: 'El DNI ya se encuentra registrado en el sistema' });
      }
    }
    const reingresar = dniCambia && esPropia;

    const antes = {
      nombres: usuario.party?.persona?.nombres ?? '',
      apellidos: usuario.party?.persona?.apellidos ?? '',
      rol: usuario.rol,
      roles: rolesAntes,
      dni: enmascararDni(numeroAnterior),
      tipoDocumento: tipoAnterior,
      avisosCorreo: usuario.avisos_correo,
      horario24_7: Boolean(usuario.party?.persona?.horario_24_7),
    };

    const despues = {
      nombres: dto.nombres !== undefined ? dto.nombres.trim() : antes.nombres,
      apellidos: dto.apellidos !== undefined ? dto.apellidos.trim() : antes.apellidos,
      rol: rolNuevo,
      roles: rolesDespues,
      dni: enmascararDni(doc.numero),
      tipoDocumento: doc.tipo,
      avisosCorreo: avisosNuevo,
      horario24_7: dto.horario24_7 ?? antes.horario24_7,
    };

    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.nombres !== undefined || dto.apellidos !== undefined || correoCambia || paisNuevo !== undefined) {
          await tx.person.update({
            where: { party_id: usuario.party_id },
            data: {
              ...(dto.nombres !== undefined ? { nombres: dto.nombres.trim() } : {}),
              ...(dto.apellidos !== undefined ? { apellidos: dto.apellidos.trim() } : {}),
              ...(correoCambia ? { correo: correoNuevo } : {}),
              ...(paisNuevo !== undefined ? { pais_nacimiento: paisNuevo } : {}),
            },
          });
        }

        if (dniCambia) {
          if (docAnterior) {
            await tx.partyIdentifier.update({ where: { id: docAnterior.id }, data: { tipo: doc.tipo, numero: doc.numero } });
          } else {
            await tx.partyIdentifier.create({
              data: { party_id: usuario.party_id, tipo: doc.tipo, numero: doc.numero },
            });
          }
        }

        if (dto.horario24_7 !== undefined) {
          await tx.person.update({ where: { party_id: usuario.party_id }, data: { horario_24_7: dto.horario24_7 } });
        }

        const cuentaData: Record<string, unknown> = {};
        if (dto.rol !== undefined) cuentaData.rol = rolNuevo;
        if (avisosCambian) cuentaData.avisos_correo = dto.avisosCorreo;
        if (Object.keys(cuentaData).length) {
          await tx.userAccount.update({ where: { id: usuario.id }, data: cuentaData });
        }

        // Extras permanentes: se quitan los que sobran y se agregan los nuevos (con historial). Los temporales no cambian.
        if (rolesCambian) {
          const quitar = rolesExtraAntes.filter((r) => !extrasPermanentesNuevos.includes(r));
          const agregar = extrasPermanentesNuevos.filter((r) => !rolesExtraAntes.includes(r));
          if (quitar.length) {
            await tx.userAccountRol.deleteMany({ where: { user_account_id: usuario.id, rol: { in: quitar } } });
          }
          if (agregar.length) {
            await tx.userAccountRol.createMany({
              data: agregar.map((rol) => ({ user_account_id: usuario.id, rol, otorgado_por: usuarioActual?.partyId ?? null })),
            });
          }
          for (const rol of quitar) {
            await tx.userAccountRolHistorial.create({
              data: { user_account_id: usuario.id, rol, accion: 'RETIRADO', quien_party_id: usuarioActual?.partyId ?? null, desde: null, hasta: new Date() },
            });
          }
          for (const rol of agregar) {
            await tx.userAccountRolHistorial.create({
              data: { user_account_id: usuario.id, rol, accion: 'OTORGADO', quien_party_id: usuarioActual?.partyId ?? null, desde: new Date() },
            });
          }
        }

        if (reingresar) {
          await tx.sesion.updateMany({
            where: { party_id: usuario.party_id, revocada_en: null },
            data: { revocada_en: new Date() },
          });
        }
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException({ codigo: 'DNI_DUPLICADO', mensaje: 'El DNI ya se encuentra registrado en el sistema' });
      }
      throw err;
    }

    // Auditoría sin valores de correo (dato personal): solo si cambió.
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'EDITAR',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: usuario.id,
      antes,
      despues: { ...despues, correoCambiado: correoCambia, dniCambiado: dniCambia },
      partyId: usuarioActual?.partyId,
      ip,
    });

    if (rolesCambian) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'usuarios',
        accion: 'CAMBIAR_ROLES',
        resultado: 'OK',
        entidad: 'user_account',
        entidadId: usuario.id,
        antes: { rol: usuario.rol, roles: rolesAntes },
        despues: { rol: rolNuevo, roles: rolesDespues },
        partyId: usuarioActual?.partyId,
        ip,
      });
    }

    return {
      id: usuario.id.toString(),
      partyId: usuario.party_id.toString(),
      nombres: despues.nombres,
      apellidos: despues.apellidos,
      dni: despues.dni,
      tipoDocumento: doc.tipo,
      rol: despues.rol,
      roles: rolesDespues,
      activo: usuario.activo,
      debeCambiar: usuario.debe_cambiar,
      reingresar,
    };
  }

  /**
   * Cambia la contraseña de otra persona (o la propia) sin pedir la anterior. Solo ADMIN.
   * Exige la clave del ADMIN que opera, marca debe_cambiar y revoca todas las sesiones de la cuenta.
   */
  async cambiarClaveAdmin(
    id: bigint | string | number,
    dto: CambiarClaveUsuarioDto,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    this.exigirAdmin(usuarioActual);
    const claveNueva = dto.claveNueva ?? '';
    if (claveNueva.length < 8 || !/[a-zA-Z]/.test(claveNueva) || !/\d/.test(claveNueva)) {
      throw new BadRequestException({
        codigo: 'CLAVE_INVALIDA',
        mensaje: 'La contraseña debe tener mínimo 8 caracteres, con letras y números',
      });
    }
    await this.exigirClaveAdmin(usuarioActual, dto.claveAdmin);

    const cuenta = await this.cuentaConParty(id);
    const hash = await argon2.hash(claveNueva, { type: argon2.argon2id });
    const esPropia = usuarioActual?.partyId === cuenta.party_id;

    await this.prisma.$transaction(async (tx) => {
      await tx.userAccount.update({
        where: { id: cuenta.id },
        data: { hash, debe_cambiar: true },
      });
      await tx.sesion.updateMany({
        where: { party_id: cuenta.party_id, revocada_en: null },
        data: { revocada_en: new Date() },
      });
    });

    // Auditoría sin la clave en ningún campo.
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'CAMBIAR_CLAVE_ADMIN',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: cuenta.id,
      antes: { debeCambiar: cuenta.debe_cambiar },
      despues: { debeCambiar: true, sesionesRevocadas: true },
      partyId: usuarioActual?.partyId,
      ip,
    });

    return {
      mensaje: 'Contraseña cambiada. La persona deberá cambiarla al ingresar.',
      reingresar: esPropia,
    };
  }

  /**
   * Cambia la foto de perfil de otra persona. Solo ADMIN. Usa el mismo servicio de archivos que Mi perfil
   * (ArchivosService.subirArchivo) con el mismo límite de 2 MB.
   */
  async cambiarFotoUsuario(
    id: bigint | string | number,
    file: Express.Multer.File,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    this.exigirAdmin(usuarioActual);
    if (!file?.buffer) {
      throw new BadRequestException({ codigo: 'ARCHIVO_REQUERIDO', mensaje: 'Elige una foto para el perfil.' });
    }
    if (file.buffer.length > FOTO_MAX_BYTES) {
      throw new PayloadTooLargeException({ codigo: 'FOTO_GRANDE', mensaje: 'La foto no puede pasar de 2 MB.' });
    }
    const cuenta = await this.cuentaConParty(id);

    let archivo: { id: string; url: string };
    try {
      archivo = await this.archivos.subirArchivo(file, false, usuarioActual, ip);
    } catch {
      throw new BadRequestException({ codigo: 'FOTO_NO_VALIDA', mensaje: 'No pudimos leer esa imagen. Prueba con otra foto.' });
    }

    await this.prisma.person.update({
      where: { party_id: cuenta.party_id },
      data: { foto_archivo_id: BigInt(archivo.id) },
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'CAMBIAR_FOTO',
      resultado: 'OK',
      entidad: 'person',
      entidadId: cuenta.party_id,
      partyId: usuarioActual?.partyId,
      ip,
    });
    return { fotoUrl: archivo.url };
  }

  /** Solo desvincula la foto: el archivo queda en disco. Solo ADMIN. */
  async quitarFotoUsuario(id: bigint | string | number, usuarioActual?: UsuarioAutenticado, ip?: string) {
    this.exigirAdmin(usuarioActual);
    const cuenta = await this.cuentaConParty(id);
    await this.prisma.person.update({
      where: { party_id: cuenta.party_id },
      data: { foto_archivo_id: null },
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'QUITAR_FOTO',
      resultado: 'OK',
      entidad: 'person',
      entidadId: cuenta.party_id,
      partyId: usuarioActual?.partyId,
      ip,
    });
    return { fotoUrl: null };
  }

  /**
   * Desactiva un usuario y revoca todas sus sesiones activas.
   * No permite auto-desactivación ni desactivar al último ADMIN activo.
   */
  async desactivar(
    id: bigint | string | number,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
    datos: { fechaSalida?: string; motivo?: string } = {},
  ) {
    const accountId = this.parsearId(id);
    const usuario = await this.prisma.userAccount.findUnique({
      where: { id: accountId },
      include: {
        party: {
          include: {
            documentos: { where: { tipo: { in: [...TIPOS_DOCUMENTO] } } },
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

    // Salida: cierra el periodo abierto (si lo hay) con la fecha indicada; por defecto hoy.
    const fechaSalida = fechaDe(datos.fechaSalida, 'de salida') ?? hoyLima();
    const periodoAbierto = await this.prisma.partyRole.findFirst({
      where: { party_id: usuario.party_id, rol: 'TRABAJADOR', hasta: null },
    });
    if (periodoAbierto && fechaSalida.getTime() < periodoAbierto.desde.getTime()) {
      throw new BadRequestException({
        codigo: 'FECHA_INVALIDA',
        mensaje: 'La fecha de salida no puede ser anterior al ingreso del periodo abierto',
      });
    }
    const motivo = datos.motivo?.trim() || undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.userAccount.update({
        where: { id: usuario.id },
        data: { activo: false },
      });

      if (periodoAbierto) {
        await tx.partyRole.update({ where: { id: periodoAbierto.id }, data: { hasta: fechaSalida } });
      }

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
      despues: {
        activo: false,
        rol: usuario.rol,
        dni: enmascararDni(dniDoc),
        fechaSalida: aTexto(fechaSalida),
        periodoCerrado: Boolean(periodoAbierto),
      },
      motivo,
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
  async reactivar(
    id: bigint | string | number,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
    datos: { fechaReingreso?: string } = {},
  ) {
    const accountId = this.parsearId(id);
    const usuario = await this.prisma.userAccount.findUnique({
      where: { id: accountId },
      include: {
        party: {
          include: {
            documentos: { where: { tipo: { in: [...TIPOS_DOCUMENTO] } } },
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

    // Reingreso: abre un periodo nuevo, salvo que ya haya uno abierto (licencia: solo vuelve a activarse la cuenta)
    const fechaReingreso = fechaDe(datos.fechaReingreso, 'de reingreso') ?? hoyLima();
    const periodos = await this.prisma.partyRole.findMany({
      where: { party_id: usuario.party_id, rol: 'TRABAJADOR' },
      orderBy: { desde: 'asc' },
      include: { employee_detail: true },
    });
    const abierto = periodos.some((p) => p.hasta === null);
    if (!abierto) {
      const error = errorPeriodo(
        { desde: fechaReingreso, hasta: null },
        periodos.map((p) => ({ desde: p.desde, hasta: p.hasta })),
      );
      if (error) {
        throw new BadRequestException({ codigo: 'PERIODO_INVALIDO', mensaje: error });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userAccount.update({
        where: { id: usuario.id },
        data: { activo: true },
      });
      if (!abierto) {
        // El descuento de personal sigue al nuevo periodo
        const ultimo = periodos[periodos.length - 1];
        const descuento = ultimo?.employee_detail?.descuento_pct;
        await tx.partyRole.create({
          data: {
            party_id: usuario.party_id,
            rol: 'TRABAJADOR',
            desde: fechaReingreso,
            hasta: null,
            ...(descuento !== undefined && descuento !== null ? { employee_detail: { create: { descuento_pct: descuento } } } : {}),
          },
        });
      }
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'REACTIVAR',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: usuario.id,
      antes: { activo: false, rol: usuario.rol, dni: enmascararDni(dniDoc) },
      despues: {
        activo: true,
        rol: usuario.rol,
        dni: enmascararDni(dniDoc),
        fechaReingreso: aTexto(fechaReingreso),
        periodoNuevo: !abierto,
      },
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
            documentos: { where: { tipo: { in: [...TIPOS_DOCUMENTO] } } },
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

    try {
      await this.prisma.$transaction(async (tx) => {
        if (nuevoCelular9) {
          if (contactoExistente) {
            // Mismo criterio de unicidad que el alta: el celular no puede ser de otra persona
            if (await celularDeOtraPersona(tx, usuario.party_id, nuevoCelular9)) {
              throw new ConflictException(CELULAR_OTRA_PERSONA);
            }
            await tx.contactMechanism.update({
              where: { id: contactoExistente.id },
              data: {
                valor: nuevoCelular9,
                principal: true,
                activo: true,
              },
            });
          } else {
            await asegurarContactoCelular(tx, usuario.party_id, nuevoCelular9, 'WHATSAPP');
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
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException(CELULAR_OTRA_PERSONA);
      throw err;
    }

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

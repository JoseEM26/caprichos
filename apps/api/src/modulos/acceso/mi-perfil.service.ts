import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ArchivosService } from '../archivos/archivos.service';
import { enmascararDni } from '../usuarios/usuarios.util';
import { UsuarioAutenticado } from './acceso.tipos';
import { ActualizarMiPerfilDto } from './mi-perfil.dto';

const FOTO_MAX_BYTES = 2 * 1024 * 1024;

export interface MiPerfil {
  nombres: string;
  apellidos: string;
  correo: string;
  fotoUrl: string | null;
  rol: string;
  dniEnmascarado: string;
  activo: boolean;
}

/** Perfil propio del usuario de la sesión. Nunca recibe un id externo: solo partyId de la sesión. */
@Injectable()
export class MiPerfilService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly archivos: ArchivosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async obtener(partyId: bigint): Promise<MiPerfil> {
    return this.vista(await this.cargar(partyId));
  }

  async actualizarDatos(partyId: bigint, dto: ActualizarMiPerfilDto, ip?: string): Promise<MiPerfil> {
    const cuenta = await this.cargar(partyId);
    const persona = this.personaDe(cuenta);

    const datos: { nombres?: string; apellidos?: string | null; correo?: string | null } = {};
    const campos: string[] = [];

    if (dto.nombres !== undefined && dto.nombres.trim() !== persona.nombres) {
      datos.nombres = dto.nombres.trim();
      campos.push('nombres');
    }
    if (dto.apellidos !== undefined && dto.apellidos.trim() !== (persona.apellidos ?? '')) {
      datos.apellidos = dto.apellidos.trim() || null;
      campos.push('apellidos');
    }
    if (dto.correo !== undefined && (dto.correo.trim() || null) !== (persona.correo ?? null)) {
      datos.correo = dto.correo.trim() || null;
      campos.push('correo');
    }

    if (campos.length === 0) {
      return this.vista(cuenta);
    }

    await this.prisma.person.update({ where: { party_id: partyId }, data: datos });
    // Auditoría sin valores: solo qué campos cambiaron (el correo es dato personal).
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'perfil',
      accion: 'EDITAR_DATOS',
      resultado: 'OK',
      entidad: 'person',
      entidadId: partyId,
      despues: { campos },
      partyId,
      ip,
    });

    return this.obtener(partyId);
  }

  async cambiarFoto(usuario: UsuarioAutenticado, file: Express.Multer.File, ip?: string): Promise<MiPerfil> {
    if (!file?.buffer) {
      throw new BadRequestException({ codigo: 'ARCHIVO_REQUERIDO', mensaje: 'Elige una foto para tu perfil.' });
    }
    if (file.buffer.length > FOTO_MAX_BYTES) {
      throw new PayloadTooLargeException({ codigo: 'FOTO_GRANDE', mensaje: 'La foto no puede pasar de 2 MB.' });
    }

    await this.cargar(usuario.partyId);

    let archivo: { id: string };
    try {
      archivo = await this.archivos.subirArchivo(file, false, usuario, ip);
    } catch {
      throw new BadRequestException({ codigo: 'FOTO_NO_VALIDA', mensaje: 'No pudimos leer esa imagen. Prueba con otra foto.' });
    }

    await this.prisma.person.update({
      where: { party_id: usuario.partyId },
      data: { foto_archivo_id: BigInt(archivo.id) },
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'perfil',
      accion: 'CAMBIAR_FOTO',
      resultado: 'OK',
      entidad: 'person',
      entidadId: usuario.partyId,
      partyId: usuario.partyId,
      ip,
    });

    return this.obtener(usuario.partyId);
  }

  /** Solo desvincula la foto: el archivo queda en disco, así que nada se borra. */
  async quitarFoto(usuario: UsuarioAutenticado, ip?: string): Promise<MiPerfil> {
    await this.cargar(usuario.partyId);
    await this.prisma.person.update({
      where: { party_id: usuario.partyId },
      data: { foto_archivo_id: null },
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'perfil',
      accion: 'QUITAR_FOTO',
      resultado: 'OK',
      entidad: 'person',
      entidadId: usuario.partyId,
      partyId: usuario.partyId,
      ip,
    });
    return this.obtener(usuario.partyId);
  }

  private async cargar(partyId: bigint) {
    const cuenta = await this.prisma.userAccount.findUnique({
      where: { party_id: partyId },
      include: { party: { include: { persona: true, documentos: { where: { tipo: 'DNI' } } } } },
    });
    if (!cuenta) {
      throw new NotFoundException({ codigo: 'USUARIO_NO_ENCONTRADO', mensaje: 'La cuenta ya no existe' });
    }
    this.personaDe(cuenta);
    return cuenta;
  }

  private personaDe(cuenta: { party: { persona: any } }) {
    const persona = cuenta.party.persona;
    if (!persona) {
      throw new NotFoundException({ codigo: 'USUARIO_NO_ENCONTRADO', mensaje: 'La cuenta no tiene datos personales' });
    }
    return persona as { nombres: string; apellidos: string | null; correo: string | null; foto_archivo_id: bigint | null };
  }

  private async vista(cuenta: any): Promise<MiPerfil> {
    const persona = this.personaDe(cuenta);
    const foto = persona.foto_archivo_id
      ? await this.prisma.archivo.findUnique({ where: { id: persona.foto_archivo_id } })
      : null;
    return {
      nombres: persona.nombres,
      apellidos: persona.apellidos ?? '',
      correo: persona.correo ?? '',
      fotoUrl: foto ? `/archivos/${foto.ruta}` : null,
      rol: cuenta.rol,
      dniEnmascarado: enmascararDni(cuenta.party.documentos?.[0]?.numero ?? ''),
      activo: cuenta.activo,
    };
  }
}

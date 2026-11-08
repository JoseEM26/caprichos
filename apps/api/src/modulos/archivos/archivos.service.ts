import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

export interface ArchivoSubidoDto {
  id: string;
  url: string;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const TIPOS_PRIVADO = [...TIPOS_IMAGEN, 'application/pdf'];

/** Notas de voz y audios de WhatsApp (Meta entrega las notas de voz como audio/ogg con códec opus). */
export const MAX_AUDIO_BYTES = 16 * 1024 * 1024; // 16 MB
export const EXTENSION_AUDIO: Record<string, string> = {
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/amr': '.amr',
  'audio/aac': '.aac',
};

@Injectable()
export class ArchivosService {
  private readonly logger = new Logger(ArchivosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditoria: AuditoriaService,
  ) {}

  getUploadsDir(): string {
    return path.resolve(this.configService.get<string>('UPLOADS_DIR', './data/uploads'));
  }

  /**
   * Sube y procesa un archivo.
   * Si es público: se reduce a máx 1200 px de lado y se convierte a WebP con sharp.
   * Si es privado (ej. comprobante): se conserva el formato original.
   */
  async subirArchivo(
    file: Express.Multer.File,
    privado = false,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<ArchivoSubidoDto> {
    if (!file || !file.buffer) {
      throw new HttpException(
        { codigo: 'ARCHIVO_REQUERIDO', mensaje: 'No se ha proporcionado ningún archivo' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1. Tamaño máximo 5 MB (413 ARCHIVO_GRANDE)
    const tamanio = file.size || file.buffer.length;
    if (tamanio > MAX_BYTES) {
      throw new HttpException(
        { codigo: 'ARCHIVO_GRANDE', mensaje: 'El archivo excede el tamaño máximo permitido de 5 MB' },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    // 2. Tipo MIME (415 TIPO_NO_PERMITIDO)
    const tiposPermitidos = privado ? TIPOS_PRIVADO : TIPOS_IMAGEN;
    if (!tiposPermitidos.includes(file.mimetype)) {
      throw new HttpException(
        { codigo: 'TIPO_NO_PERMITIDO', mensaje: `Tipo de archivo no permitido: ${file.mimetype}` },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    const uploadsDir = this.getUploadsDir();
    const now = new Date();
    const anio = String(now.getFullYear());
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const uuid = crypto.randomUUID();

    let rutaRelativa: string;
    let tipoMimeFinal: string;
    let bytesFinal: number;
    let bufferAGuardar: Buffer;

    if (!privado) {
      // Foto pública: reducir a 1200 px de lado máximo y convertir a WebP con sharp
      bufferAGuardar = await sharp(file.buffer)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

      tipoMimeFinal = 'image/webp';
      bytesFinal = bufferAGuardar.length;
      rutaRelativa = `publico/${anio}/${mes}/${uuid}.webp`;
    } else {
      // Archivo privado: se guarda sin tocar su formato
      let ext = path.extname(file.originalname || '').toLowerCase();
      if (!ext) {
        if (file.mimetype === 'application/pdf') ext = '.pdf';
        else if (file.mimetype === 'image/jpeg') ext = '.jpg';
        else if (file.mimetype === 'image/png') ext = '.png';
        else if (file.mimetype === 'image/webp') ext = '.webp';
        else ext = '.bin';
      }
      bufferAGuardar = file.buffer;
      tipoMimeFinal = file.mimetype;
      bytesFinal = bufferAGuardar.length;
      rutaRelativa = `privado/${anio}/${mes}/${uuid}${ext}`;
    }

    // Guardar archivo físico en disco
    const rutaAbsoluta = path.resolve(uploadsDir, rutaRelativa);
    fs.mkdirSync(path.dirname(rutaAbsoluta), { recursive: true });
    fs.writeFileSync(rutaAbsoluta, bufferAGuardar);

    // Registrar en BD
    const archivo = await this.prisma.archivo.create({
      data: {
        ruta: rutaRelativa,
        tipo_mime: tipoMimeFinal,
        bytes: bytesFinal,
        privado,
      },
    });

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'archivos',
      accion: 'SUBIR',
      resultado: 'OK',
      entidad: 'archivo',
      entidadId: archivo.id,
      partyId: usuario?.partyId,
      ip,
    });

    const url = !privado
      ? `/archivos/${rutaRelativa}`
      : `/admin/archivos/${archivo.id.toString()}`;

    return {
      id: archivo.id.toString(),
      url,
    };
  }

  /**
   * Guarda un audio de WhatsApp en la carpeta privada (nunca se sirve sin permiso: ver GET admin/archivos/:id).
   * Valida tipo y tamaño; el MIME debe venir sin parámetros (audio/ogg, no «audio/ogg; codecs=opus»).
   */
  async subirAudio(buffer: Buffer, mimeType: string): Promise<ArchivoSubidoDto> {
    const ext = EXTENSION_AUDIO[mimeType];
    if (!ext) {
      throw new HttpException(
        { codigo: 'TIPO_NO_PERMITIDO', mensaje: `Tipo de audio no permitido: ${mimeType}` },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }
    if (!buffer?.length || buffer.length > MAX_AUDIO_BYTES) {
      throw new HttpException(
        { codigo: 'ARCHIVO_GRANDE', mensaje: 'El audio está vacío o excede 16 MB' },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
    const now = new Date();
    const rutaRelativa = `privado/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}${ext}`;
    const rutaAbsoluta = path.resolve(this.getUploadsDir(), rutaRelativa);
    fs.mkdirSync(path.dirname(rutaAbsoluta), { recursive: true });
    fs.writeFileSync(rutaAbsoluta, buffer);
    const archivo = await this.prisma.archivo.create({
      data: { ruta: rutaRelativa, tipo_mime: mimeType, bytes: buffer.length, privado: true },
    });
    return { id: archivo.id.toString(), url: `/admin/archivos/${archivo.id.toString()}` };
  }

  /** Borra el archivo físico y su fila (retención/baja Ley 29733). Nunca lanza: si la fila sigue referenciada, solo borra el archivo. */
  async eliminarArchivo(id: string | bigint): Promise<boolean> {
    try {
      const archivoId = typeof id === 'bigint' ? id : BigInt(id);
      const archivo = await this.prisma.archivo.findUnique({ where: { id: archivoId } });
      if (!archivo) return false;
      const rutaAbsoluta = path.resolve(this.getUploadsDir(), archivo.ruta);
      if (fs.existsSync(rutaAbsoluta)) fs.unlinkSync(rutaAbsoluta);
      await this.prisma.archivo.delete({ where: { id: archivoId } }).catch(() => undefined);
      return true;
    } catch (err: any) {
      this.logger.warn(`No se pudo eliminar el archivo ${String(id)}: ${err?.message}`);
      return false;
    }
  }

  /**
   * Valida la ruta pública contra path traversal y confirma que exista.
   */
  validarYSolucionarRutaPublica(rutaRelativa: string): string {
    if (
      !rutaRelativa ||
      rutaRelativa.includes('..') ||
      rutaRelativa.includes('\0') ||
      rutaRelativa.includes('\\')
    ) {
      throw new HttpException(
        { codigo: 'RUTA_INVALIDA', mensaje: 'Ruta no válida o intento de path traversal' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const uploadsDir = this.getUploadsDir();
    const publicBase = path.resolve(uploadsDir, 'publico');
    const rutaAbsoluta = path.resolve(publicBase, rutaRelativa);

    if (!rutaAbsoluta.startsWith(publicBase + path.sep) && rutaAbsoluta !== publicBase) {
      throw new HttpException(
        { codigo: 'RUTA_INVALIDA', mensaje: 'Ruta fuera del directorio público' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!fs.existsSync(rutaAbsoluta) || !fs.statSync(rutaAbsoluta).isFile()) {
      throw new HttpException(
        { codigo: 'ARCHIVO_NO_ENCONTRADO', mensaje: 'Archivo no encontrado' },
        HttpStatus.NOT_FOUND,
      );
    }

    return rutaAbsoluta;
  }

  /**
   * Obtiene un archivo privado para servirlo previa auditoría LECTURA_SENSIBLE.
   */
  async obtenerArchivoPrivado(
    id: string | bigint,
    usuario?: UsuarioAutenticado,
    ip?: string,
    dispositivo?: string,
  ): Promise<{ rutaAbsoluta: string; tipoMime: string; bytes: number }> {
    const archivoId = typeof id === 'bigint' ? id : BigInt(id);
    const archivo = await this.prisma.archivo.findUnique({
      where: { id: archivoId },
    });

    if (!archivo) {
      throw new HttpException(
        { codigo: 'ARCHIVO_NO_ENCONTRADO', mensaje: 'Archivo no encontrado' },
        HttpStatus.NOT_FOUND,
      );
    }

    // Auditoría LECTURA_SENSIBLE
    await this.auditoria.registrar({
      categoria: 'LECTURA_SENSIBLE',
      modulo: 'archivos',
      accion: 'VER',
      resultado: 'OK',
      entidad: 'archivo',
      entidadId: archivo.id,
      partyId: usuario?.partyId,
      ip,
      dispositivo,
    });

    const uploadsDir = this.getUploadsDir();
    const rutaAbsoluta = path.resolve(uploadsDir, archivo.ruta);

    if (!fs.existsSync(rutaAbsoluta) || !fs.statSync(rutaAbsoluta).isFile()) {
      throw new HttpException(
        { codigo: 'ARCHIVO_NO_ENCONTRADO', mensaje: 'Archivo físico no encontrado en el servidor' },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      rutaAbsoluta,
      tipoMime: archivo.tipo_mime,
      bytes: archivo.bytes,
    };
  }

  /**
   * Retorna la URL pública o privada de un archivo dado su ID.
   * Utilizado por otros módulos (ej. Catálogo).
   */
  async urlDeArchivo(id: bigint | string | number): Promise<string | null> {
    try {
      const archivoId = typeof id === 'bigint' ? id : BigInt(id);
      const archivo = await this.prisma.archivo.findUnique({
        where: { id: archivoId },
      });
      if (!archivo) return null;
      if (!archivo.privado) {
        return `/archivos/${archivo.ruta}`;
      }
      return `/admin/archivos/${archivo.id.toString()}`;
    } catch {
      return null;
    }
  }
}

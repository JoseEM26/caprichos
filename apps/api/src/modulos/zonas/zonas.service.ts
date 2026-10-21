import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import {
  Coordenada,
  RespuestaConsultaEnvio,
  ZonaAdminItem,
  ZonaDetectada,
} from './zonas.tipos';
import { puntoEnPoligono, validarPoligono } from './zonas.util';
import { EditarTarifaDto } from './dto/editar-tarifa.dto';
import { EditarActivaDto } from './dto/editar-activa.dto';
import { EditarPoligonoDto } from './dto/editar-poligono.dto';

interface ZonaCache {
  id: bigint;
  codigo: string;
  tarifa: number;
  poligono: Coordenada[];
}

@Injectable()
export class ZonasService {
  private cacheZonasActivas: ZonaCache[] | null = null;
  private cacheExpiracion: number = 0;
  private readonly TTL_CACHE_MS = 60 * 1000; // 60 segundos

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Invalida la caché en memoria cuando se modifica cualquier zona.
   */
  invalidarCache(): void {
    this.cacheZonasActivas = null;
    this.cacheExpiracion = 0;
  }

  /**
   * Obtiene las zonas activas en memoria con TTL de 60 segundos.
   * Ordenadas por código ascendente para resolver superposiciones.
   */
  private async obtenerZonasActivas(): Promise<ZonaCache[]> {
    const ahora = Date.now();
    if (this.cacheZonasActivas && ahora < this.cacheExpiracion) {
      return this.cacheZonasActivas;
    }

    const zonas = await this.prisma.zonaReparto.findMany({
      where: { activa: true },
      orderBy: { codigo: 'asc' },
    });

    this.cacheZonasActivas = zonas.map((z) => ({
      id: z.id,
      codigo: z.codigo,
      tarifa: Number(z.tarifa),
      poligono: (z.poligono as unknown as Coordenada[]) || [],
    }));

    this.cacheExpiracion = ahora + this.TTL_CACHE_MS;
    return this.cacheZonasActivas;
  }

  /**
   * Detecta en qué zona de reparto activa cae el punto (lat, lng).
   * Si cae en varias zonas gana la de menor código.
   * Si cae fuera o la zona está inactiva devuelve null.
   */
  async detectar(lat: number, lng: number): Promise<ZonaDetectada | null> {
    const zonas = await this.obtenerZonasActivas();

    for (const zona of zonas) {
      if (puntoEnPoligono(lat, lng, zona.poligono)) {
        return {
          zonaId: zona.id,
          codigo: zona.codigo,
          tarifa: zona.tarifa,
        };
      }
    }

    return null;
  }

  /**
   * Obtiene la tarifa actual de una zona por su ID.
   */
  async tarifaDe(zonaId: bigint | string | number): Promise<number> {
    const id = BigInt(zonaId);

    // Buscar en caché si está disponible
    if (this.cacheZonasActivas) {
      const enCache = this.cacheZonasActivas.find((z) => z.id === id);
      if (enCache) return enCache.tarifa;
    }

    const zona = await this.prisma.zonaReparto.findUnique({
      where: { id },
    });

    if (!zona) {
      throw new NotFoundException({
        codigo: 'ZONA_NO_ENCONTRADA',
        mensaje: 'La zona de reparto especificada no existe',
      });
    }

    return Number(zona.tarifa);
  }

  /**
   * Consulta pública de envío (GET /carta/envio?lat=&lng=).
   */
  async consultarEnvio(lat: number, lng: number): Promise<RespuestaConsultaEnvio> {
    if (
      lat === undefined ||
      lng === undefined ||
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      throw new BadRequestException({
        codigo: 'PUNTO_INVALIDO',
        mensaje: 'La latitud o longitud no es válida o está fuera de rango',
      });
    }

    const zona = await this.detectar(lat, lng);

    let gratisDesde = 70;
    try {
      const parametroEnvio = await this.prisma.parametro.findUnique({
        where: { clave: 'envio_gratis_monto' },
      });
      if (parametroEnvio && parametroEnvio.valor !== undefined && parametroEnvio.valor !== null) {
        const parsed = Number(parametroEnvio.valor);
        if (!isNaN(parsed) && parsed >= 0) {
          gratisDesde = parsed;
        }
      }
    } catch {
      gratisDesde = 70;
    }

    if (!zona) {
      return {
        cubierto: false,
        zona: null,
        tarifa: null,
        gratisDesde,
      };
    }

    return {
      cubierto: true,
      zona: zona.codigo,
      tarifa: zona.tarifa,
      gratisDesde,
    };
  }

  // =========================================================================
  // ADMINISTRACIÓN (AccesoGuard + @Permiso zonas/ver y zonas/editar)
  // =========================================================================

  /**
   * Lista todas las zonas de reparto registradas.
   */
  async listarZonasAdmin(): Promise<ZonaAdminItem[]> {
    const zonas = await this.prisma.zonaReparto.findMany({
      orderBy: { codigo: 'asc' },
    });

    return zonas.map((z) => ({
      id: z.id.toString(),
      codigo: z.codigo,
      tarifa: Number(z.tarifa),
      activa: z.activa,
      puntos: Array.isArray(z.poligono) ? z.poligono.length : 0,
      poligono: z.poligono as unknown as Coordenada[],
    }));
  }

  /**
   * Actualiza la tarifa de una zona de reparto.
   */
  async editarTarifa(
    codigo: string,
    dto: EditarTarifaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<ZonaAdminItem> {
    if (dto.tarifa === undefined || dto.tarifa < 0) {
      throw new BadRequestException({
        codigo: 'TARIFA_INVALIDA',
        mensaje: 'La tarifa debe ser un número mayor o igual a 0',
      });
    }

    const zona = await this.prisma.zonaReparto.findUnique({
      where: { codigo },
    });

    if (!zona) {
      throw new NotFoundException({
        codigo: 'ZONA_NO_ENCONTRADA',
        mensaje: `No existe la zona de reparto con código ${codigo}`,
      });
    }

    const tarifaAnterior = Number(zona.tarifa);
    const updated = await this.prisma.zonaReparto.update({
      where: { codigo },
      data: { tarifa: dto.tarifa },
    });

    this.invalidarCache();

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'zonas',
      accion: 'EDITAR_TARIFA',
      resultado: 'OK',
      entidad: 'zona_reparto',
      entidadId: zona.id,
      antes: { codigo, tarifa: tarifaAnterior },
      despues: { codigo, tarifa: dto.tarifa },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: updated.id.toString(),
      codigo: updated.codigo,
      tarifa: Number(updated.tarifa),
      activa: updated.activa,
      puntos: Array.isArray(updated.poligono) ? updated.poligono.length : 0,
      poligono: updated.poligono as unknown as Coordenada[],
    };
  }

  /**
   * Activa o desactiva una zona de reparto.
   */
  async editarActiva(
    codigo: string,
    dto: EditarActivaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<ZonaAdminItem> {
    const zona = await this.prisma.zonaReparto.findUnique({
      where: { codigo },
    });

    if (!zona) {
      throw new NotFoundException({
        codigo: 'ZONA_NO_ENCONTRADA',
        mensaje: `No existe la zona de reparto con código ${codigo}`,
      });
    }

    const activaAnterior = zona.activa;
    const updated = await this.prisma.zonaReparto.update({
      where: { codigo },
      data: { activa: dto.activa },
    });

    this.invalidarCache();

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'zonas',
      accion: 'EDITAR_ESTADO',
      resultado: 'OK',
      entidad: 'zona_reparto',
      entidadId: zona.id,
      antes: { codigo, activa: activaAnterior },
      despues: { codigo, activa: dto.activa },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: updated.id.toString(),
      codigo: updated.codigo,
      tarifa: Number(updated.tarifa),
      activa: updated.activa,
      puntos: Array.isArray(updated.poligono) ? updated.poligono.length : 0,
      poligono: updated.poligono as unknown as Coordenada[],
    };
  }

  /**
   * Actualiza el polígono de una zona de reparto con validación estricta.
   * Si no es válido, mantiene el polígono original y lanza 400 POLIGONO_INVALIDO.
   */
  async editarPoligono(
    codigo: string,
    dto: EditarPoligonoDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<ZonaAdminItem & { avisos?: string[] }> {
    const validacion = validarPoligono(dto.poligono);
    if (!validacion.valido) {
      throw new BadRequestException({
        codigo: 'POLIGONO_INVALIDO',
        mensaje: validacion.motivo || 'El polígono no es válido',
      });
    }

    const zona = await this.prisma.zonaReparto.findUnique({
      where: { codigo },
    });

    if (!zona) {
      throw new NotFoundException({
        codigo: 'ZONA_NO_ENCONTRADA',
        mensaje: `No existe la zona de reparto con código ${codigo}`,
      });
    }

    const puntosAnteriores = Array.isArray(zona.poligono) ? zona.poligono.length : 0;
    const updated = await this.prisma.zonaReparto.update({
      where: { codigo },
      data: { poligono: dto.poligono as any },
    });

    this.invalidarCache();

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'zonas',
      accion: 'EDITAR_POLIGONO',
      resultado: 'OK',
      entidad: 'zona_reparto',
      entidadId: zona.id,
      antes: { codigo, puntos: puntosAnteriores },
      despues: { codigo, puntos: dto.poligono.length },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      id: updated.id.toString(),
      codigo: updated.codigo,
      tarifa: Number(updated.tarifa),
      activa: updated.activa,
      puntos: dto.poligono.length,
      poligono: updated.poligono as unknown as Coordenada[],
      avisos: [],
    };
  }
}

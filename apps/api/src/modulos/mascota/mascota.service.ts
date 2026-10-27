import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import {
  CLAVE_PARAMETRO_MASCOTA,
  DEFAULT_MASCOTA_CONFIG,
} from './mascota.constantes';
import {
  AspectoResuelto,
  MascotaAdminResponse,
  MascotaConfig,
} from './mascota.tipos';
import { normalizarMascotaConfig, resolverAspecto } from './mascota.util';
import { ActualizarMascotaConfigDto } from './dto/actualizar-mascota.dto';

@Injectable()
export class MascotaService {
  private readonly logger = new Logger(MascotaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Obtiene la configuración almacenada en base de datos o los valores por defecto.
   */
  private async obtenerConfig(): Promise<MascotaConfig> {
    try {
      const registro = await this.prisma.parametro.findUnique({
        where: { clave: CLAVE_PARAMETRO_MASCOTA },
      });

      if (!registro || !registro.valor) {
        return DEFAULT_MASCOTA_CONFIG;
      }

      let parsed = registro.valor;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          return DEFAULT_MASCOTA_CONFIG;
        }
      }

      return normalizarMascotaConfig(parsed as Partial<MascotaConfig>);
    } catch (err: any) {
      this.logger.warn(`Error al consultar ${CLAVE_PARAMETRO_MASCOTA}: ${err?.message}`);
      return DEFAULT_MASCOTA_CONFIG;
    }
  }

  /**
   * Endpoint público (GET /carta/mascota):
   * Retorna el aspecto RESUELTO de hoy {tema, aspecto} ya fusionado base+tema.
   */
  async obtenerAspectoPublico(fecha?: Date | string): Promise<AspectoResuelto> {
    const config = await this.obtenerConfig();
    return resolverAspecto(config, fecha || new Date());
  }

  /**
   * Endpoint admin (GET /admin/mascota):
   * Retorna la config completa (base, temas, modo, temaManual) + aspecto resuelto de hoy.
   */
  async obtenerConfigAdmin(fecha?: Date | string): Promise<MascotaAdminResponse> {
    const config = await this.obtenerConfig();
    const resuelto = resolverAspecto(config, fecha || new Date());
    return {
      ...config,
      resuelto,
    };
  }

  /**
   * Endpoint admin (PUT /admin/mascota):
   * Guarda la configuración validada en parametro mascota_config y registra auditoría.
   */
  async actualizarConfig(
    dto: ActualizarMascotaConfigDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<MascotaAdminResponse> {
    const anterior = await this.prisma.parametro.findUnique({
      where: { clave: CLAVE_PARAMETRO_MASCOTA },
    });

    const guardado = await this.prisma.parametro.upsert({
      where: { clave: CLAVE_PARAMETRO_MASCOTA },
      update: { valor: dto as any },
      create: { clave: CLAVE_PARAMETRO_MASCOTA, valor: dto as any },
    });

    const valorNormalizado = normalizarMascotaConfig(guardado.valor as any);
    const resuelto = resolverAspecto(valorNormalizado, new Date());

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'mascota',
      accion: 'ACTUALIZAR_CONFIG',
      resultado: 'OK',
      entidad: 'mascota_config',
      antes: anterior?.valor ?? null,
      despues: dto,
      partyId: usuario?.partyId,
      ip,
    });

    return {
      ...valorNormalizado,
      resuelto,
    };
  }

  /**
   * Endpoint admin (POST /admin/mascota/restablecer):
   * Vuelve a los valores de fábrica y registra auditoría.
   */
  async restablecerConfig(
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<MascotaAdminResponse> {
    const anterior = await this.prisma.parametro.findUnique({
      where: { clave: CLAVE_PARAMETRO_MASCOTA },
    });

    await this.prisma.parametro.upsert({
      where: { clave: CLAVE_PARAMETRO_MASCOTA },
      update: { valor: DEFAULT_MASCOTA_CONFIG as any },
      create: { clave: CLAVE_PARAMETRO_MASCOTA, valor: DEFAULT_MASCOTA_CONFIG as any },
    });

    const resuelto = resolverAspecto(DEFAULT_MASCOTA_CONFIG, new Date());

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'mascota',
      accion: 'RESTABLECER_CONFIG',
      resultado: 'OK',
      entidad: 'mascota_config',
      antes: anterior?.valor ?? null,
      despues: DEFAULT_MASCOTA_CONFIG,
      partyId: usuario?.partyId,
      ip,
    });

    return {
      ...DEFAULT_MASCOTA_CONFIG,
      resuelto,
    };
  }
}

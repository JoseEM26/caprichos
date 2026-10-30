import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ActualizarPantallaIngresoDto } from './dto/actualizar-pantalla-ingreso.dto';
import {
  CLAVE_PARAMETRO_FRASE_INGRESO,
  CLAVE_PARAMETRO_IMAGENES_INGRESO,
  IMAGENES_FABRICA,
  REGEX_ARCHIVO_PUBLICO,
} from './pantalla-ingreso.constantes';
import { PantallaIngresoAdmin, PantallaIngresoConfig, PantallaIngresoPublica } from './pantalla-ingreso.tipos';
import {
  CONFIG_INGRESO_POR_DEFECTO,
  construirPantallaIngresoPublica,
  resolverFraseIngreso,
  resolverImagenesIngreso,
  validarPantallaIngreso,
} from './pantalla-ingreso.util';

@Injectable()
export class PantallaIngresoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private async leerConfig(): Promise<PantallaIngresoConfig> {
    const registros = await this.prisma.parametro.findMany({
      where: { clave: { in: [CLAVE_PARAMETRO_IMAGENES_INGRESO, CLAVE_PARAMETRO_FRASE_INGRESO] } },
    });
    const mapa = new Map(registros.map((r) => [r.clave, r.valor]));
    const imagenes = mapa.has(CLAVE_PARAMETRO_IMAGENES_INGRESO)
      ? resolverImagenesIngreso(mapa.get(CLAVE_PARAMETRO_IMAGENES_INGRESO))
      : CONFIG_INGRESO_POR_DEFECTO.imagenes;
    const frase = mapa.has(CLAVE_PARAMETRO_FRASE_INGRESO)
      ? resolverFraseIngreso(mapa.get(CLAVE_PARAMETRO_FRASE_INGRESO))
      : CONFIG_INGRESO_POR_DEFECTO.frase;
    return { imagenes, frase };
  }

  /** GET público /carta/ingreso: URLs resueltas y frase. Si la lectura falla, usa los valores por defecto. */
  async obtenerPublica(): Promise<PantallaIngresoPublica> {
    try {
      return construirPantallaIngresoPublica(await this.leerConfig());
    } catch {
      return construirPantallaIngresoPublica(CONFIG_INGRESO_POR_DEFECTO);
    }
  }

  async obtenerAdmin(): Promise<PantallaIngresoAdmin> {
    const config = await this.leerConfig();
    return { ...config, fabrica: [...IMAGENES_FABRICA] };
  }

  async actualizar(
    dto: ActualizarPantallaIngresoDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<PantallaIngresoAdmin> {
    const nuevo = validarPantallaIngreso(dto);

    // Las imágenes propias deben existir como archivos públicos del sistema.
    for (const img of nuevo.imagenes) {
      if (img.tipo !== 'archivo') continue;
      const ruta = img.valor.slice('/archivos/'.length);
      if (!REGEX_ARCHIVO_PUBLICO.test(img.valor)) {
        throw new BadRequestException('Solo se aceptan imágenes propias subidas al sistema');
      }
      const archivo = await this.prisma.archivo.findFirst({
        where: { ruta, privado: false },
      });
      if (!archivo) {
        throw new BadRequestException(`La imagen propia "${img.valor}" no existe en el sistema`);
      }
    }

    const anterior = await this.leerConfig();

    await this.prisma.$transaction([
      this.prisma.parametro.upsert({
        where: { clave: CLAVE_PARAMETRO_IMAGENES_INGRESO },
        update: { valor: nuevo.imagenes as any },
        create: { clave: CLAVE_PARAMETRO_IMAGENES_INGRESO, valor: nuevo.imagenes as any },
      }),
      this.prisma.parametro.upsert({
        where: { clave: CLAVE_PARAMETRO_FRASE_INGRESO },
        update: { valor: nuevo.frase },
        create: { clave: CLAVE_PARAMETRO_FRASE_INGRESO, valor: nuevo.frase },
      }),
    ]);

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'configuracion',
      accion: 'PANTALLA_INGRESO',
      resultado: 'OK',
      entidad: 'parametro',
      antes: anterior,
      despues: nuevo,
      partyId: usuario?.partyId,
      ip,
    });

    return { ...nuevo, fabrica: [...IMAGENES_FABRICA] };
  }
}

import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

export const CLAVES_PERMITIDAS = [
  'tiempo_prometido_min',
  'envio_gratis_monto',
  'pedido_minimo',
  'tolerancia_reserva_min',
  'puntos_porcentaje',
  'descuento_personal_pct',
] as const;

export type ClaveConfiguracion = (typeof CLAVES_PERMITIDAS)[number];

@Injectable()
export class ConfiguracionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Lista todos los parámetros de configuración del sistema.
   */
  async listar() {
    const parametros = await this.prisma.parametro.findMany({
      orderBy: { clave: 'asc' },
    });

    return parametros.map((p) => ({
      clave: p.clave,
      valor: p.valor,
    }));
  }

  /**
   * Actualiza o crea un parámetro permitido mediante upsert y registra la auditoría de cambio con antes y después (DT-20).
   */
  async actualizar(
    clave: string,
    valor: number,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    if (!CLAVES_PERMITIDAS.includes(clave as ClaveConfiguracion)) {
      throw new BadRequestException({
        codigo: 'CLAVE_DESCONOCIDA',
        mensaje: `La clave de configuración '${clave}' no es válida`,
      });
    }

    if (typeof valor !== 'number' || isNaN(valor) || valor < 0) {
      throw new BadRequestException({
        codigo: 'VALOR_INVALIDO',
        mensaje: 'El valor debe ser un número mayor o igual a 0',
      });
    }

    const anterior = await this.prisma.parametro.findUnique({
      where: { clave },
    });

    const parametro = await this.prisma.parametro.upsert({
      where: { clave },
      update: { valor },
      create: { clave, valor },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'configuracion',
      accion: 'PARAMETRO',
      resultado: 'OK',
      entidad: 'parametro',
      antes: anterior ? { clave, valor: anterior.valor } : null,
      despues: { clave, valor },
      partyId: usuarioActual?.partyId,
      ip,
    });

    return {
      clave: parametro.clave,
      valor: parametro.valor,
    };
  }
}

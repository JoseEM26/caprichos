import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { PausaAltaDemandaDto } from './dto/pausa-alta-demanda.dto';

export const CLAVES_NUMERICAS = [
  'tiempo_prometido_min',
  'tiempo_max_min',
  'envio_gratis_monto',
  'pedido_minimo',
  'tolerancia_reserva_min',
  'puntos_porcentaje',
  'descuento_personal_pct',
  'rep_naranja_min',
  'rep_rojo_min',
  'rep_max_pedidos',
] as const;

export const CLAVES_TEXTO = [
  'envio_gratis_modo',
] as const;

export const CLAVES_OBJETO = [
  'pausa_alta_demanda',
  'local_datos',
  'local_pagos',
] as const;

export const CLAVES_PERMITIDAS = [
  ...CLAVES_NUMERICAS,
  ...CLAVES_TEXTO,
  ...CLAVES_OBJETO,
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
   * Obtiene un parámetro por su clave.
   */
  async obtener(clave: string) {
    const parametro = await this.prisma.parametro.findUnique({
      where: { clave },
    });
    return parametro ? parametro.valor : null;
  }

  /**
   * Actualiza o crea un parámetro permitido mediante upsert y registra la auditoría de cambio con antes y después (DT-20).
   */
  async actualizar(
    clave: string,
    valor: any,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    if (!CLAVES_PERMITIDAS.includes(clave as ClaveConfiguracion)) {
      throw new BadRequestException({
        codigo: 'CLAVE_DESCONOCIDA',
        mensaje: `La clave de configuración '${clave}' no es válida`,
      });
    }

    // Validación según tipo de dato esperado
    if ((CLAVES_NUMERICAS as readonly string[]).includes(clave)) {
      if (typeof valor !== 'number' || isNaN(valor) || valor < 0) {
        throw new BadRequestException({
          codigo: 'VALOR_INVALIDO',
          mensaje: 'El valor debe ser un número mayor o igual a 0',
        });
      }
    } else if ((CLAVES_TEXTO as readonly string[]).includes(clave)) {
      if (typeof valor !== 'string' || valor.trim().length === 0) {
        throw new BadRequestException({
          codigo: 'VALOR_INVALIDO',
          mensaje: 'El valor debe ser una cadena de texto no vacía',
        });
      }
    } else if ((CLAVES_OBJETO as readonly string[]).includes(clave)) {
      if (typeof valor !== 'object' || valor === null) {
        throw new BadRequestException({
          codigo: 'VALOR_INVALIDO',
          mensaje: 'El valor debe ser un objeto o estructura válida',
        });
      }
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

  /**
   * Activa o desactiva la pausa por alta demanda (DT-58, RN-CAP-113).
   */
  async actualizarPausaAltaDemanda(
    dto: PausaAltaDemandaDto,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const clave = 'pausa_alta_demanda';
    const anterior = await this.prisma.parametro.findUnique({
      where: { clave },
    });

    const nuevoValor = {
      activa: Boolean(dto.activa),
      motivo: dto.motivo ?? (dto.activa ? 'Por ahora no estamos recibiendo pedidos' : null),
    };

    const parametro = await this.prisma.parametro.upsert({
      where: { clave },
      update: { valor: nuevoValor },
      create: { clave, valor: nuevoValor },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'configuracion',
      accion: 'PAUSA_ALTA_DEMANDA',
      resultado: 'OK',
      entidad: 'parametro',
      antes: anterior ? { clave, valor: anterior.valor } : null,
      despues: { clave, valor: nuevoValor },
      partyId: usuarioActual?.partyId,
      ip,
    });

    return {
      clave: parametro.clave,
      valor: parametro.valor,
    };
  }
}

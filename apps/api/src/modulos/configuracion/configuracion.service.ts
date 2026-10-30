import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { hoyLima } from '../reclamos/textos-legales';
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
  'reparto_retrasado_min',
  'reparto_tarde_min',
  'reparto_muy_tarde_min',
  'reparto_velocidad_kmh',
  'reparto_max_pedidos',
  'reparto_rutas_sugeridas_max',
  'reparto_insistencia_min',
  'reparto_espera_max_min',
  'reparto_recargo_reprogramacion',
  'reprog_respuesta_min',
  'reprog_max_intentos',
  'encuesta_espera_min',
  'encuesta_puntaje_queja',
  'encuesta_ventana_dias',
  'chatbot_pago_recordatorio_min',
  'chatbot_pago_expira_min',
  'chatbot_pago_reaviso_min',
  'chatbot_estado_vencido_horas',
  'vigilante_sin_respuesta_min',
  'chatbot_ia_tope_mensual_usd',
  'chatbot_ia_max_por_hora_telefono',
  'chatbot_antispam_max_minuto',
  'chatbot_antispam_max_hora',
  'chatbot_retencion_dias',
  'alerta_voucher_min_1',
  'alerta_voucher_min_2',
  'espera_cliente_aviso_min',
  'chat_tomado_liberar_min',
  'alerta_pedido_sin_confirmar_min',
  'asistido_espera_min',
  'impresion_alerta_min',
  'impresion_vence_min',
  'caja_aviso_apertura_min',
  'voucher_ia_corte_min',
  'zonas_snap_m',
  'spam_bloqueo_excesos',
  'spam_bloqueo_min',
  'spam_bloqueo_reincidente_min',
  'whatsapp_max_pedidos_sin_pagar',
  'eta_factor_urbano',
  'eta_productos_desde',
  'eta_extra_por_producto_min',
  'eta_parada_min',
  'eta_margen_min',
  'eta_paso_min',
  'eta_base_sin_zona_min',
  'reserva_tolerancia_min',
] as const;

/** Rangos de parámetros con lectura acotada: [mínimo, máximo, solo enteros, mensaje]. */
export const RANGOS_NUMERICOS: Record<string, [number, number, boolean, string]> = {
  eta_factor_urbano: [1, 3, false, 'El factor de calles debe estar entre 1 y 3'],
  eta_productos_desde: [1, 50, true, 'La cantidad de unidades debe ser un entero entre 1 y 50'],
  eta_extra_por_producto_min: [0.5, 30, false, 'Los minutos de empaque por unidad deben estar entre 0.5 y 30'],
  eta_parada_min: [0.5, 30, false, 'Los minutos por parada previa deben estar entre 0.5 y 30'],
  eta_margen_min: [1, 60, true, 'El ancho mínimo del rango debe ser un entero entre 1 y 60 minutos'],
  eta_paso_min: [1, 30, true, 'El redondeo debe ser un entero entre 1 y 30 minutos'],
  eta_base_sin_zona_min: [0.5, 60, false, 'Los minutos de puerta sin zona deben estar entre 0.5 y 60'],
  reserva_tolerancia_min: [1, 180, true, 'La tolerancia de reserva debe ser un entero entre 1 y 180 minutos'],
  chatbot_ia_tope_mensual_usd: [1, 500, false, 'El tope mensual debe estar entre 1 y 500 USD'],
  voucher_ia_corte_min: [1, 120, true, 'La pausa del corte automático debe ser un entero entre 1 y 120 minutos'],
};

/** Rangos válidos (enteros) de los parámetros de protección contra spam y pedidos falsos. */
export const RANGOS_PROTECCION_SPAM: Record<string, [number, number, string]> = {
  spam_bloqueo_excesos: [1, 20, 'Los excesos para bloquear deben estar entre 1 y 20'],
  spam_bloqueo_min: [5, 1440, 'El bloqueo debe durar entre 5 y 1440 minutos'],
  spam_bloqueo_reincidente_min: [60, 10080, 'El bloqueo por reincidencia debe durar entre 60 y 10080 minutos'],
  whatsapp_max_pedidos_sin_pagar: [1, 10, 'El tope de pedidos sin pagar debe estar entre 1 y 10'],
  chatbot_antispam_max_minuto: [3, 60, 'El límite por minuto debe estar entre 3 y 60'],
  chatbot_antispam_max_hora: [10, 600, 'El límite por hora debe estar entre 10 y 600'],
};

export const CLAVES_TEXTO = [
  'envio_gratis_modo',
  'reprog_recargo_modo',
  'carta_aviso_entrada',
  'ayuda_ia_activo',
  'stock_control_activo',
  'terminos_texto',
  'privacidad_texto',
  'chatbot_activo',
  'chatbot_ia_activo',
  'chatbot_pago_recordatorio_activo',
  'chatbot_avisos_equipo_activo',
  'chatbot_funcion_pedido',
  'chatbot_funcion_pago',
  'chatbot_funcion_reservas',
  'chatbot_funcion_cambios',
  'chatbot_funcion_promociones',
  'chatbot_texto_bienvenida',
  'chatbot_texto_despedida',
  'chatbot_texto_pase_persona',
  'chatbot_texto_fuera_horario',
  'chatbot_texto_no_entiendo',
  'chatbot_texto_no_entiendo_derivacion',
  'chatbot_texto_indicacion_pago',
  'whatsapp_aviso_salida_activo',
  'whatsapp_aviso_llegada_activo',
  'whatsapp_aviso_espera_activo',
  'whatsapp_aviso_recojo_activo',
  'whatsapp_aviso_pago_confirmado_activo',
  'whatsapp_aviso_listo_activo',
  'whatsapp_aviso_entregado_activo',
  'whatsapp_aviso_recibido_activo',
  'whatsapp_aviso_encuesta_activo',
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
      if (
        clave === 'carta_aviso_entrada' ||
        clave === 'ayuda_ia_activo' ||
        clave === 'stock_control_activo' ||
        clave === 'chatbot_activo' ||
        clave === 'chatbot_ia_activo' ||
        clave === 'chatbot_avisos_equipo_activo' ||
        clave.startsWith('chatbot_funcion_') ||
        clave.startsWith('whatsapp_aviso_')
      ) {
        const valNorm =
          typeof valor === 'boolean'
            ? valor
              ? 'si'
              : 'no'
            : typeof valor === 'string'
              ? valor.toLowerCase().trim()
              : '';
        if (valNorm !== 'si' && valNorm !== 'no') {
          throw new BadRequestException({
            codigo: 'VALOR_INVALIDO',
            mensaje: 'El valor debe ser "si" o "no"',
          });
        }
        valor = valNorm;
      } else if (clave === 'reprog_recargo_modo') {
        // Mismos valores que MODOS_RECARGO_REPROG (repartos/recargo-reprogramacion.ts)
        const modo = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
        if (!['IGUAL_ENVIO', 'FIJO', 'SIN_COSTO'].includes(modo)) {
          throw new BadRequestException({
            codigo: 'VALOR_INVALIDO',
            mensaje: 'El modo debe ser IGUAL_ENVIO, FIJO o SIN_COSTO',
          });
        }
        valor = modo;
      } else if (clave.startsWith('chatbot_texto_')) {
        if (typeof valor !== 'string' || valor.trim().length === 0) {
          throw new BadRequestException({
            codigo: 'VALOR_INVALIDO',
            mensaje: 'El texto no puede estar vacío',
          });
        }
        if (valor.trim().length > 1024) {
          throw new BadRequestException({
            codigo: 'TEXTO_EXCEDE_LIMITE_WHATSAPP',
            mensaje: 'El texto excede el límite de 1024 caracteres de WhatsApp',
          });
        }
        valor = valor.trim();
      } else if (typeof valor !== 'string' || valor.trim().length === 0) {
        throw new BadRequestException({
          codigo: 'VALOR_INVALIDO',
          mensaje: 'El valor debe ser una cadena de texto no vacía',
        });
      } else if (clave === 'terminos_texto' || clave === 'privacidad_texto') {
        if (valor.trim().length > 20000) {
          throw new BadRequestException({
            codigo: 'RANGO_INVALIDO',
            mensaje: 'El texto no puede pasar de 20000 caracteres',
          });
        }
        valor = valor.trim();
      }
    } else if ((CLAVES_OBJETO as readonly string[]).includes(clave)) {
      if (typeof valor !== 'object' || valor === null) {
        throw new BadRequestException({
          codigo: 'VALOR_INVALIDO',
          mensaje: 'El valor debe ser un objeto o estructura válida',
        });
      }
    }

    const rangoSpam = RANGOS_PROTECCION_SPAM[clave];
    if (rangoSpam && (!Number.isInteger(valor) || valor < rangoSpam[0] || valor > rangoSpam[1])) {
      throw new BadRequestException({ codigo: 'RANGO_INVALIDO', mensaje: rangoSpam[2] });
    }

    const rango = RANGOS_NUMERICOS[clave];
    if (rango && (valor < rango[0] || valor > rango[1] || (rango[2] && !Number.isInteger(valor)))) {
      throw new BadRequestException({ codigo: 'RANGO_INVALIDO', mensaje: rango[3] });
    }

    // Validaciones específicas para parámetros de reparto
    if (clave === 'reparto_retrasado_min' && (valor < 1 || valor > 180)) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'El umbral retrasado debe estar entre 1 y 180 minutos',
      });
    }
    if (clave === 'reparto_tarde_min' && (valor < 2 || valor > 240)) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'El umbral tarde debe estar entre 2 y 240 minutos',
      });
    }
    if (clave === 'reparto_muy_tarde_min' && (valor < 3 || valor > 360)) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'El umbral muy tarde debe estar entre 3 y 360 minutos',
      });
    }
    if (clave === 'reparto_velocidad_kmh' && (valor < 5 || valor > 100)) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'La velocidad media debe estar entre 5 y 100 km/h',
      });
    }
    if (clave === 'reparto_rutas_sugeridas_max' && (valor < 1 || valor > 5)) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'Las rutas sugeridas deben estar entre 1 y 5',
      });
    }
    if (clave === 'reparto_max_pedidos' && (valor < 1 || valor > 20)) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'El máximo de pedidos por repartidor debe estar entre 1 y 20',
      });
    }

    if (
      clave === 'reparto_retrasado_min' ||
      clave === 'reparto_tarde_min' ||
      clave === 'reparto_muy_tarde_min'
    ) {
      const params = await this.prisma.parametro.findMany({
        where: {
          clave: { in: ['reparto_retrasado_min', 'reparto_tarde_min', 'reparto_muy_tarde_min'] },
        },
      });
      let retrasado = 20;
      let tarde = 30;
      let muyTarde = 45;
      for (const p of params) {
        if (p.clave === 'reparto_retrasado_min' && p.valor != null) retrasado = Number(p.valor);
        if (p.clave === 'reparto_tarde_min' && p.valor != null) tarde = Number(p.valor);
        if (p.clave === 'reparto_muy_tarde_min' && p.valor != null) muyTarde = Number(p.valor);
      }
      if (clave === 'reparto_retrasado_min') retrasado = valor;
      if (clave === 'reparto_tarde_min') tarde = valor;
      if (clave === 'reparto_muy_tarde_min') muyTarde = valor;

      if (!(retrasado < tarde && tarde < muyTarde)) {
        throw new BadRequestException({
          codigo: 'ORDEN_UMBRALES_INVALIDO',
          mensaje: 'Los umbrales deben estar en orden ascendente (retrasado < tarde < muy tarde)',
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

    // Un cambio real de Términos o Privacidad sube su versión (la que se guarda con el consentimiento)
    if ((clave === 'terminos_texto' || clave === 'privacidad_texto') && anterior?.valor !== valor) {
      const claveVersion = clave === 'terminos_texto' ? 'terminos_version' : 'privacidad_version';
      const version = hoyLima();
      await this.prisma.parametro.upsert({
        where: { clave: claveVersion },
        update: { valor: version },
        create: { clave: claveVersion, valor: version },
      });
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'configuracion',
        accion: 'VERSION_TEXTO_LEGAL',
        resultado: 'OK',
        entidad: 'parametro',
        despues: { clave: claveVersion, valor: version },
        partyId: usuarioActual?.partyId,
        ip,
      });
    }

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

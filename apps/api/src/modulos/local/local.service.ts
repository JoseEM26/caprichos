import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import {
  DIAS_SEMANA_NOMBRES,
  formatearHora,
  horaToDate,
  obtenerFechaHoraLima,
} from './local.util';
import { ActualizarHorarioDiaDto } from './dto/actualizar-horario.dto';
import { CrearFechaEspecialDto } from './dto/crear-fecha-especial.dto';
import { ActualizarFechaEspecialDto } from './dto/actualizar-fecha-especial.dto';
import { ActualizarDatosLocalDto } from './dto/actualizar-datos-local.dto';
import { ActualizarPagosDto } from './dto/actualizar-pagos.dto';

export const PAGOS_DEFAULT = {
  efectivo: { activo: true },
  yape: { activo: true, numero: '123456789' },
  plin: { activo: true, numero: '123456789' },
  transferencia: { activo: true, cuenta: '123456789', banco: 'BCP' },
  tarjeta: { activo: true },
};

export const DATOS_LOCAL_DEFAULT = {
  nombre: 'Caprichos',
  direccion: 'Av. Principal 123',
  telefono: '999999999',
  whatsapp: '999999999',
  redes: { instagram: '', facebook: '', tiktok: '' },
};

@Injectable()
export class LocalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Obtiene el estado público de apertura de la carta virtual.
   * Permite inyectar «ahora» para pruebas deterministas sin depender del reloj real.
   */
  async obtenerEstadoCarta(ahora: Date = new Date()) {
    const { fechaIso, horaMinutos, diaSemana } = obtenerFechaHoraLima(ahora);

    // Consulta de parámetros relevantes
    const parametros = await this.prisma.parametro.findMany({
      where: {
        clave: { in: ['pausa_alta_demanda', 'tiempo_prometido_min'] },
      },
    });

    const pausaParam = parametros.find((p) => p.clave === 'pausa_alta_demanda')?.valor;
    const tiempoParam = parametros.find((p) => p.clave === 'tiempo_prometido_min')?.valor;
    const tiempoBaseMin =
      typeof tiempoParam === 'number' ? tiempoParam : Number(tiempoParam) || null;
    // alta demanda vigente (ola 5, cocina): suma sus minutos al tiempo prometido de la carta
    const altaDemanda = await this.prisma.altaDemanda.findFirst({
      where: { hasta: null },
      orderBy: { id: 'desc' },
    });
    const tiempoPrometidoMin =
      tiempoBaseMin !== null ? tiempoBaseMin + (altaDemanda?.minutos ?? 0) : null;

    const pausaAltaDemanda =
      typeof pausaParam === 'boolean'
        ? pausaParam
        : Boolean(
            pausaParam &&
              typeof pausaParam === 'object' &&
              (pausaParam as any).activa,
          );

    const pausaMotivo =
      pausaParam && typeof pausaParam === 'object' && (pausaParam as any).motivo
        ? (pausaParam as any).motivo
        : 'Por ahora no estamos recibiendo pedidos';

    // 1. Si la pausa por alta demanda está activa, manda sobre todo
    if (pausaAltaDemanda) {
      return {
        abierta: false,
        motivo: 'PAUSA' as const,
        texto: pausaMotivo,
        abre: null,
        cierra: null,
        pausaAltaDemanda: true,
        tiempoPrometidoMin,
        altaDemandaMin: altaDemanda?.minutos ?? 0,
      };
    }

    // 2. Fecha especial para el día de hoy (manda sobre el día de la semana)
    const fechaDate = new Date(`${fechaIso}T00:00:00.000Z`);
    const fechaEspecial = await this.prisma.fechaEspecial.findUnique({
      where: { fecha: fechaDate },
    });

    if (fechaEspecial) {
      if (fechaEspecial.cerrado) {
        return {
          abierta: false,
          motivo: 'FECHA_ESPECIAL' as const,
          texto: fechaEspecial.motivo || 'Cerrado por feriado',
          abre: null,
          cierra: null,
          pausaAltaDemanda: false,
          tiempoPrometidoMin,
          altaDemandaMin: altaDemanda?.minutos ?? 0,
        };
      }

      const abreEsp = formatearHora(fechaEspecial.abre);
      const cierraEsp = formatearHora(fechaEspecial.cierra);

      if (!abreEsp || !cierraEsp) {
        return {
          abierta: false,
          motivo: 'FECHA_ESPECIAL' as const,
          texto: fechaEspecial.motivo || 'Cerrado hoy',
          abre: null,
          cierra: null,
          pausaAltaDemanda: false,
          tiempoPrometidoMin,
          altaDemandaMin: altaDemanda?.minutos ?? 0,
        };
      }

      if (horaMinutos < abreEsp) {
        return {
          abierta: false,
          motivo: 'HORARIO' as const,
          texto: `Abrimos hoy a las ${abreEsp}`,
          abre: abreEsp,
          cierra: cierraEsp,
          pausaAltaDemanda: false,
          tiempoPrometidoMin,
          altaDemandaMin: altaDemanda?.minutos ?? 0,
        };
      }

      if (horaMinutos >= abreEsp && horaMinutos < cierraEsp) {
        return {
          abierta: true,
          motivo: 'OK' as const,
          texto: 'Abierto',
          abre: abreEsp,
          cierra: cierraEsp,
          pausaAltaDemanda: false,
          tiempoPrometidoMin,
          altaDemandaMin: altaDemanda?.minutos ?? 0,
        };
      }

      // horaMinutos >= cierraEsp
      return {
        abierta: false,
        motivo: 'HORARIO' as const,
        texto: 'Cerrado por hoy',
        abre: abreEsp,
        cierra: cierraEsp,
        pausaAltaDemanda: false,
        tiempoPrometidoMin,
        altaDemandaMin: altaDemanda?.minutos ?? 0,
      };
    }

    // 3. Horario normal del día de la semana
    const horario = await this.prisma.horarioDia.findUnique({
      where: { dia_semana: diaSemana },
    });

    if (!horario || horario.cerrado || !horario.abre || !horario.cierra) {
      return {
        abierta: false,
        motivo: 'HORARIO' as const,
        texto: 'Cerrado hoy',
        abre: null,
        cierra: null,
        pausaAltaDemanda: false,
        tiempoPrometidoMin,
        altaDemandaMin: altaDemanda?.minutos ?? 0,
      };
    }

    const abre = formatearHora(horario.abre);
    const cierra = formatearHora(horario.cierra);

    if (!abre || !cierra) {
      return {
        abierta: false,
        motivo: 'HORARIO' as const,
        texto: 'Cerrado hoy',
        abre: null,
        cierra: null,
        pausaAltaDemanda: false,
        tiempoPrometidoMin,
        altaDemandaMin: altaDemanda?.minutos ?? 0,
      };
    }

    if (horaMinutos < abre) {
      return {
        abierta: false,
        motivo: 'HORARIO' as const,
        texto: `Abrimos hoy a las ${abre}`,
        abre,
        cierra,
        pausaAltaDemanda: false,
        tiempoPrometidoMin,
        altaDemandaMin: altaDemanda?.minutos ?? 0,
      };
    }

    if (horaMinutos >= abre && horaMinutos < cierra) {
      return {
        abierta: true,
        motivo: 'OK' as const,
        texto: 'Abierto',
        abre,
        cierra,
        pausaAltaDemanda: false,
        tiempoPrometidoMin,
        altaDemandaMin: altaDemanda?.minutos ?? 0,
      };
    }

    // horaMinutos >= cierra
    return {
      abierta: false,
      motivo: 'HORARIO' as const,
      texto: 'Cerrado por hoy',
      abre,
      cierra,
      pausaAltaDemanda: false,
      tiempoPrometidoMin,
      altaDemandaMin: altaDemanda?.minutos ?? 0,
    };
  }

  /**
   * Obtiene los datos públicos del local para la carta virtual.
   */
  async obtenerDatosPublicosLocal() {
    const [parametros, horarios] = await Promise.all([
      this.prisma.parametro.findMany({
        where: {
          clave: {
            in: [
              'local_datos',
              'local_pagos',
              'envio_gratis_monto',
              'pedido_minimo',
              'puntos_porcentaje',
            ],
          },
        },
      }),
      this.prisma.horarioDia.findMany({
        orderBy: { dia_semana: 'asc' },
      }),
    ]);

    const datosParam = parametros.find((p) => p.clave === 'local_datos')?.valor as any;
    const pagosParam = parametros.find((p) => p.clave === 'local_pagos')?.valor as any;
    const envioGratis = parametros.find((p) => p.clave === 'envio_gratis_monto')?.valor;
    const pedidoMinimo = parametros.find((p) => p.clave === 'pedido_minimo')?.valor;
    const puntosPorcentaje = Number(parametros.find((p) => p.clave === 'puntos_porcentaje')?.valor);

    const datos = datosParam ?? DATOS_LOCAL_DEFAULT;
    const pagos = pagosParam ?? PAGOS_DEFAULT;

    // Medios de pago visibles/activos
    const mediosPagoVisibles: Record<string, any> = {};
    for (const [clave, config] of Object.entries(pagos)) {
      if ((config as any)?.activo) {
        mediosPagoVisibles[clave] = config;
      }
    }

    const horarioFormateado = horarios.map((h) => ({
      dia_semana: h.dia_semana,
      dia: DIAS_SEMANA_NOMBRES[h.dia_semana] || `Día ${h.dia_semana}`,
      abre: formatearHora(h.abre),
      cierra: formatearHora(h.cierra),
      cerrado: h.cerrado,
    }));

    return {
      nombre: datos.nombre ?? DATOS_LOCAL_DEFAULT.nombre,
      direccion: datos.direccion ?? DATOS_LOCAL_DEFAULT.direccion,
      telefono: datos.telefono ?? DATOS_LOCAL_DEFAULT.telefono,
      whatsapp: datos.whatsapp ?? DATOS_LOCAL_DEFAULT.whatsapp,
      redes: datos.redes ?? DATOS_LOCAL_DEFAULT.redes,
      horario: horarioFormateado,
      mediosPago: mediosPagoVisibles,
      envioGratisDesde: typeof envioGratis === 'number' ? envioGratis : null,
      pedidoMinimo: typeof pedidoMinimo === 'number' ? pedidoMinimo : null,
      puntosPorcentaje: puntosPorcentaje > 0 ? puntosPorcentaje : 5,
    };
  }

  // ================= ADMIN: HORARIO =================

  async obtenerHorarioAdmin() {
    const horarios = await this.prisma.horarioDia.findMany({
      orderBy: { dia_semana: 'asc' },
    });

    return horarios.map((h) => ({
      dia_semana: h.dia_semana,
      dia: DIAS_SEMANA_NOMBRES[h.dia_semana] || `Día ${h.dia_semana}`,
      abre: formatearHora(h.abre),
      cierra: formatearHora(h.cierra),
      cerrado: h.cerrado,
    }));
  }

  async actualizarHorarioAdmin(
    dias: ActualizarHorarioDiaDto[],
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    if (!Array.isArray(dias) || dias.length === 0) {
      throw new BadRequestException({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'Se requiere una lista de días para actualizar el horario',
      });
    }

    // Validar que cada día tenga abre < cierra si no está cerrado
    for (const d of dias) {
      if (!d.cerrado) {
        if (!d.abre || !d.cierra) {
          throw new BadRequestException({
            codigo: 'HORARIO_INVALIDO',
            mensaje: `El día ${d.dia_semana} debe especificar abre y cierra al estar abierto`,
          });
        }
        if (d.abre >= d.cierra) {
          throw new BadRequestException({
            codigo: 'HORARIO_INVALIDO',
            mensaje: `La hora de apertura (${d.abre}) debe ser menor a la hora de cierre (${d.cierra}) en el día ${d.dia_semana}`,
          });
        }
      }
    }

    const anterior = await this.prisma.horarioDia.findMany({
      orderBy: { dia_semana: 'asc' },
    });

    await this.prisma.$transaction(
      dias.map((d) =>
        this.prisma.horarioDia.upsert({
          where: { dia_semana: d.dia_semana },
          update: {
            cerrado: d.cerrado,
            abre: d.cerrado || !d.abre ? null : horaToDate(d.abre),
            cierra: d.cerrado || !d.cierra ? null : horaToDate(d.cierra),
          },
          create: {
            dia_semana: d.dia_semana,
            cerrado: d.cerrado,
            abre: d.cerrado || !d.abre ? null : horaToDate(d.abre),
            cierra: d.cerrado || !d.cierra ? null : horaToDate(d.cierra),
          },
        }),
      ),
    );

    const despues = dias.map((d) => ({
      dia_semana: d.dia_semana,
      cerrado: d.cerrado,
      abre: d.cerrado ? null : d.abre,
      cierra: d.cerrado ? null : d.cierra,
    }));

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'local',
      accion: 'ACTUALIZAR_HORARIO',
      resultado: 'OK',
      antes: anterior.map((h) => ({
        dia_semana: h.dia_semana,
        cerrado: h.cerrado,
        abre: formatearHora(h.abre),
        cierra: formatearHora(h.cierra),
      })),
      despues,
      partyId: usuarioActual?.partyId,
      ip,
    });

    return this.obtenerHorarioAdmin();
  }

  // ================= ADMIN: FECHAS ESPECIALES =================

  async listarFechasEspeciales() {
    const fechas = await this.prisma.fechaEspecial.findMany({
      orderBy: { fecha: 'asc' },
    });

    return fechas.map((f) => ({
      fecha: f.fecha.toISOString().slice(0, 10),
      cerrado: f.cerrado,
      abre: formatearHora(f.abre),
      cierra: formatearHora(f.cierra),
      motivo: f.motivo,
    }));
  }

  async crearFechaEspecial(
    dto: CrearFechaEspecialDto,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    if (!dto.cerrado) {
      if (!dto.abre || !dto.cierra) {
        throw new BadRequestException({
          codigo: 'HORARIO_INVALIDO',
          mensaje: 'Debe especificar abre y cierra si la fecha no está cerrada',
        });
      }
      if (dto.abre >= dto.cierra) {
        throw new BadRequestException({
          codigo: 'HORARIO_INVALIDO',
          mensaje: `La hora de apertura (${dto.abre}) debe ser menor a la hora de cierre (${dto.cierra})`,
        });
      }
    }

    const fechaDate = new Date(`${dto.fecha}T00:00:00.000Z`);

    const anterior = await this.prisma.fechaEspecial.findUnique({
      where: { fecha: fechaDate },
    });

    const creada = await this.prisma.fechaEspecial.upsert({
      where: { fecha: fechaDate },
      update: {
        cerrado: dto.cerrado,
        abre: dto.cerrado || !dto.abre ? null : horaToDate(dto.abre),
        cierra: dto.cerrado || !dto.cierra ? null : horaToDate(dto.cierra),
        motivo: dto.motivo ?? null,
      },
      create: {
        fecha: fechaDate,
        cerrado: dto.cerrado,
        abre: dto.cerrado || !dto.abre ? null : horaToDate(dto.abre),
        cierra: dto.cerrado || !dto.cierra ? null : horaToDate(dto.cierra),
        motivo: dto.motivo ?? null,
      },
    });

    const resultadoFormateado = {
      fecha: dto.fecha,
      cerrado: creada.cerrado,
      abre: formatearHora(creada.abre),
      cierra: formatearHora(creada.cierra),
      motivo: creada.motivo,
    };

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'local',
      accion: 'CREAR_FECHA_ESPECIAL',
      resultado: 'OK',
      antes: anterior
        ? {
            fecha: dto.fecha,
            cerrado: anterior.cerrado,
            abre: formatearHora(anterior.abre),
            cierra: formatearHora(anterior.cierra),
            motivo: anterior.motivo,
          }
        : null,
      despues: resultadoFormateado,
      partyId: usuarioActual?.partyId,
      ip,
    });

    return resultadoFormateado;
  }

  async actualizarFechaEspecial(
    fecha: string,
    dto: ActualizarFechaEspecialDto,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const fechaDate = new Date(`${fecha}T00:00:00.000Z`);
    const anterior = await this.prisma.fechaEspecial.findUnique({
      where: { fecha: fechaDate },
    });

    if (!anterior) {
      throw new NotFoundException({
        codigo: 'FECHA_ESPECIAL_NO_ENCONTRADA',
        mensaje: `No se encontró fecha especial para ${fecha}`,
      });
    }

    const cerradoFinal = dto.cerrado !== undefined ? dto.cerrado : anterior.cerrado;
    const abreFinal =
      dto.abre !== undefined ? dto.abre : formatearHora(anterior.abre);
    const cierraFinal =
      dto.cierra !== undefined ? dto.cierra : formatearHora(anterior.cierra);

    if (!cerradoFinal) {
      if (!abreFinal || !cierraFinal) {
        throw new BadRequestException({
          codigo: 'HORARIO_INVALIDO',
          mensaje: 'Debe especificar abre y cierra si la fecha no está cerrada',
        });
      }
      if (abreFinal >= cierraFinal) {
        throw new BadRequestException({
          codigo: 'HORARIO_INVALIDO',
          mensaje: `La hora de apertura (${abreFinal}) debe ser menor a la hora de cierre (${cierraFinal})`,
        });
      }
    }

    const actualizada = await this.prisma.fechaEspecial.update({
      where: { fecha: fechaDate },
      data: {
        cerrado: cerradoFinal,
        abre: cerradoFinal || !abreFinal ? null : horaToDate(abreFinal),
        cierra: cerradoFinal || !cierraFinal ? null : horaToDate(cierraFinal),
        ...(dto.motivo !== undefined ? { motivo: dto.motivo } : {}),
      },
    });

    const resultadoFormateado = {
      fecha,
      cerrado: actualizada.cerrado,
      abre: formatearHora(actualizada.abre),
      cierra: formatearHora(actualizada.cierra),
      motivo: actualizada.motivo,
    };

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'local',
      accion: 'ACTUALIZAR_FECHA_ESPECIAL',
      resultado: 'OK',
      antes: {
        fecha,
        cerrado: anterior.cerrado,
        abre: formatearHora(anterior.abre),
        cierra: formatearHora(anterior.cierra),
        motivo: anterior.motivo,
      },
      despues: resultadoFormateado,
      partyId: usuarioActual?.partyId,
      ip,
    });

    return resultadoFormateado;
  }

  async eliminarFechaEspecial(
    fecha: string,
    ahora: Date = new Date(),
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const { fechaIso: hoyLima } = obtenerFechaHoraLima(ahora);

    // RN-CAP-014: solo permite eliminar fechas futuras
    if (fecha <= hoyLima) {
      throw new BadRequestException({
        codigo: 'SOLO_FECHAS_FUTURAS',
        mensaje: 'Solo se pueden eliminar fechas especiales futuras; las pasadas o de hoy deben desactivarse o conservarse',
      });
    }

    const fechaDate = new Date(`${fecha}T00:00:00.000Z`);
    const anterior = await this.prisma.fechaEspecial.findUnique({
      where: { fecha: fechaDate },
    });

    if (!anterior) {
      throw new NotFoundException({
        codigo: 'FECHA_ESPECIAL_NO_ENCONTRADA',
        mensaje: `No se encontró fecha especial para ${fecha}`,
      });
    }

    await this.prisma.fechaEspecial.delete({
      where: { fecha: fechaDate },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'local',
      accion: 'ELIMINAR_FECHA_ESPECIAL',
      resultado: 'OK',
      antes: {
        fecha,
        cerrado: anterior.cerrado,
        abre: formatearHora(anterior.abre),
        cierra: formatearHora(anterior.cierra),
        motivo: anterior.motivo,
      },
      despues: null,
      partyId: usuarioActual?.partyId,
      ip,
    });

    return { mensaje: 'Fecha especial eliminada exitosamente' };
  }

  // ================= ADMIN: DATOS DEL LOCAL =================

  async obtenerDatosLocal() {
    const parametro = await this.prisma.parametro.findUnique({
      where: { clave: 'local_datos' },
    });
    return parametro?.valor ?? DATOS_LOCAL_DEFAULT;
  }

  async actualizarDatosLocal(
    dto: ActualizarDatosLocalDto,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const clave = 'local_datos';
    const anterior = await this.prisma.parametro.findUnique({
      where: { clave },
    });

    const valorJson = { ...dto };
    const parametro = await this.prisma.parametro.upsert({
      where: { clave },
      update: { valor: valorJson },
      create: { clave, valor: valorJson },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'local',
      accion: 'ACTUALIZAR_DATOS',
      resultado: 'OK',
      entidad: 'parametro',
      antes: anterior?.valor ?? null,
      despues: dto,
      partyId: usuarioActual?.partyId,
      ip,
    });

    return parametro.valor;
  }

  // ================= ADMIN: MEDIOS DE PAGO =================

  async obtenerPagosLocal() {
    const parametro = await this.prisma.parametro.findUnique({
      where: { clave: 'local_pagos' },
    });
    return parametro?.valor ?? PAGOS_DEFAULT;
  }

  async actualizarPagosLocal(
    dto: ActualizarPagosDto,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const clave = 'local_pagos';
    const anterior = await this.prisma.parametro.findUnique({
      where: { clave },
    });

    // Combinar con los valores previos o por defecto para preservar números
    const anteriorVal = (anterior?.valor as any) ?? PAGOS_DEFAULT;
    const nuevoValor = {
      ...anteriorVal,
      ...dto,
    };

    const parametro = await this.prisma.parametro.upsert({
      where: { clave },
      update: { valor: nuevoValor },
      create: { clave, valor: nuevoValor },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'local',
      accion: 'ACTUALIZAR_PAGOS',
      resultado: 'OK',
      entidad: 'parametro',
      antes: anterior?.valor ?? null,
      despues: nuevoValor,
      partyId: usuarioActual?.partyId,
      ip,
    });

    return parametro.valor;
  }
}

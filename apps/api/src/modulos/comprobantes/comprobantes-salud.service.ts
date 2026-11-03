import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { leerParametroNumerico } from '../impresion/estado-impresion';
import { CLAVES_FACTURACION, interpretarConfig } from './facturacion/facturacion.config';
import { SunatEmisor } from './sunat/sunat.emisor';
import {
  DIAS_BOLETA_SIN_REPORTAR,
  FALLOS_CIRCUITO_DEFECTO,
  HORAS_RESUMEN_SIN_RESPUESTA,
  PAUSA_CIRCUITO_MS,
  UMBRAL_PENDIENTE_MS,
  huecosDeNumeracion,
  umbralCertificado,
} from './comprobantes-politica';

/** Parámetro donde vive el circuito (estado durable: sobrevive reinicios y lo ve el monitoreo). */
export const CLAVE_CIRCUITO = 'facturacion_circuito';
/** Parámetro opcional con los fallos seguidos que abren el circuito (defecto 5). */
export const CLAVE_FALLOS_CIRCUITO = 'facturacion_circuito_fallos';

interface EstadoCircuito {
  /** Fallos seguidos de SUNAT desde el último éxito. */
  fallos: number;
  /** Hasta cuándo están pausados los envíos (ISO), o null. */
  abiertoHasta: string | null;
  /** Inicio del episodio de caída: el aviso se manda una sola vez por episodio. */
  aperturaDesde: string | null;
  /** Desde cuándo SUNAT rechaza las credenciales (ISO), o null. */
  credencialesDesde: string | null;
}

const CIRCUITO_VACIO: EstadoCircuito = { fallos: 0, abiertoHasta: null, aperturaDesde: null, credencialesDesde: null };

export interface AvisoFacturacion {
  /** Clave única: un aviso por problema (se deduplica por esta clave). */
  clave: string;
  titulo: string;
  mensaje: string;
  enlace?: string;
  prioridad?: 'alta' | 'media';
}

/** Condición de «con problemas»: rechazados, en revisión manual, o pendientes con más de 15 min. */
export function condicionProblemas(ahora: Date) {
  return {
    tipo: { in: ['BOLETA', 'FACTURA'] },
    OR: [
      { facturacion_estado: { in: ['RECHAZADO', 'REVISION_MANUAL'] } },
      { facturacion_estado: 'PENDIENTE_ENVIO', creado_en: { lt: new Date(ahora.getTime() - UMBRAL_PENDIENTE_MS) } },
    ],
  };
}

const DIA_MS = 86_400_000;

/**
 * Salud de la facturación: circuito (pausa de envíos ante caídas de SUNAT o credenciales inválidas),
 * avisos a ADMIN (uno por problema, sin repetir) y conteos de solo lectura para el monitoreo.
 * ponytail: el circuito vive en la tabla parametro; con varias réplicas el candado Redis del barrido evita el doble envío.
 */
@Injectable()
export class ComprobantesSaludService {
  private readonly logger = new Logger(ComprobantesSaludService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventos?: EventosGateway,
    @Optional() private readonly sunat?: SunatEmisor,
  ) {}

  private async leerCircuito(): Promise<EstadoCircuito> {
    try {
      const p = await this.prisma.parametro.findUnique({ where: { clave: CLAVE_CIRCUITO } });
      const v = (p?.valor ?? {}) as Partial<EstadoCircuito>;
      return {
        fallos: Number(v.fallos) || 0,
        abiertoHasta: v.abiertoHasta ?? null,
        aperturaDesde: v.aperturaDesde ?? null,
        credencialesDesde: v.credencialesDesde ?? null,
      };
    } catch {
      return { ...CIRCUITO_VACIO };
    }
  }

  private async guardarCircuito(e: EstadoCircuito): Promise<void> {
    await this.prisma.parametro.upsert({
      where: { clave: CLAVE_CIRCUITO },
      update: { valor: e as any },
      create: { clave: CLAVE_CIRCUITO, valor: e as any },
    });
  }

  /** true mientras los envíos automáticos están en pausa. */
  async circuitoAbierto(ahora = new Date()): Promise<boolean> {
    const e = await this.leerCircuito();
    return !!e.abiertoHasta && new Date(e.abiertoHasta).getTime() > ahora.getTime();
  }

  /** Un fallo de SUNAT (timeout, 5xx o fault de servidor). Al llegar al umbral, pausa 5 min y avisa una vez. */
  async registrarFallo(ahora = new Date()): Promise<void> {
    const e = await this.leerCircuito();
    const umbral = await leerParametroNumerico(this.prisma, CLAVE_FALLOS_CIRCUITO, FALLOS_CIRCUITO_DEFECTO);
    const fallos = e.fallos + 1;
    if (fallos < umbral) {
      await this.guardarCircuito({ ...e, fallos });
      return;
    }
    // Tras la pausa, el contador se queda en el umbral: un solo fallo de prueba vuelve a pausar (medio abierto)
    const aperturaDesde = e.aperturaDesde ?? ahora.toISOString();
    await this.guardarCircuito({
      ...e,
      fallos,
      aperturaDesde,
      abiertoHasta: new Date(ahora.getTime() + PAUSA_CIRCUITO_MS).toISOString(),
    });
    await this.avisar({
      clave: `circuito:${aperturaDesde}`,
      titulo: 'SUNAT no responde: envíos en pausa 5 minutos',
      mensaje: `Hubo ${fallos} fallos seguidos de SUNAT (tiempo agotado o error del servidor). Los envíos se pausan y se reanudan solos. Ningún comprobante se pierde: quedan pendientes.`,
      prioridad: 'alta',
    });
  }

  /** Una respuesta de SUNAT (aceptada o rechazada) cierra el circuito y borra el contador. */
  async registrarExito(): Promise<void> {
    const e = await this.leerCircuito();
    if (e.fallos === 0 && !e.abiertoHasta && !e.aperturaDesde && !e.credencialesDesde) return;
    await this.guardarCircuito({ ...CIRCUITO_VACIO });
  }

  /** SUNAT rechazó usuario o clave SOL: pausa los envíos y avisa una vez por episodio. */
  async registrarCredenciales(ahora = new Date()): Promise<void> {
    const e = await this.leerCircuito();
    const credencialesDesde = e.credencialesDesde ?? ahora.toISOString();
    await this.guardarCircuito({
      ...e,
      credencialesDesde,
      abiertoHasta: new Date(ahora.getTime() + PAUSA_CIRCUITO_MS).toISOString(),
    });
    await this.avisar({
      clave: `credenciales:${credencialesDesde}`,
      titulo: 'Credenciales SUNAT inválidas',
      mensaje: 'SUNAT rechazó el usuario o la clave SOL. Los envíos quedan en pausa hasta corregir las credenciales en el servidor. Ningún comprobante se pierde: quedan pendientes.',
      prioridad: 'alta',
    });
  }

  /** Aviso a ADMIN, una sola vez por clave. Devuelve false si ya existía. */
  async avisar(a: AvisoFacturacion): Promise<boolean> {
    const tipo = `FACTURACION:${a.clave}`;
    const previa = await this.prisma.notificacion.findFirst({ where: { tipo }, select: { id: true } });
    if (previa) return false;
    const titulo = a.prioridad === 'alta' ? `URGENTE: ${a.titulo}` : a.titulo;
    const notif = await this.prisma.notificacion.create({
      data: { tipo, rol_destino: 'ADMIN', titulo, mensaje: a.mensaje, enlace: a.enlace ?? '/admin/comprobantes' },
    });
    this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
    this.logger.warn(JSON.stringify({ evento: 'facturacion_alerta', clave: a.clave }));
    return true;
  }

  /**
   * Revisa los problemas que no dependen de un envío: certificado, pendientes viejos, boletas sin reportar,
   * resúmenes sin respuesta y huecos de numeración. Cada problema avisa una sola vez.
   */
  async revisarAlertas(ahora = new Date()): Promise<{ avisos: number }> {
    let avisos = 0;
    const aviso = async (a: AvisoFacturacion) => {
      if (await this.avisar(a)) avisos++;
    };

    const vence = this.sunat?.certificadoVence() ?? null;
    if (vence) {
      const dias = Math.floor((vence.getTime() - ahora.getTime()) / DIA_MS);
      const umbral = umbralCertificado(dias);
      if (umbral !== null) {
        await aviso({
          clave: `certificado:${umbral}:${vence.toISOString().slice(0, 10)}`,
          titulo: `Certificado SUNAT vence en ${Math.max(dias, 0)} días`,
          mensaje: `El certificado vence el ${vence.toISOString().slice(0, 10)}. Renuévalo antes para que la facturación no se corte.`,
          prioridad: umbral <= 7 ? 'alta' : undefined,
        });
      }
    }

    if (!(await this.circuitoAbierto(ahora))) {
      const viejos = await this.prisma.comprobante.findMany({
        where: { facturacion_estado: 'PENDIENTE_ENVIO', creado_en: { lt: new Date(ahora.getTime() - UMBRAL_PENDIENTE_MS) } },
        select: { id: true, numero_texto: true },
        take: 50,
      });
      for (const p of viejos) {
        await aviso({
          clave: `pendiente:${p.id}`,
          titulo: `${p.numero_texto} lleva más de 15 minutos sin enviarse`,
          mensaje: 'Está pendiente de envío a SUNAT. El sistema lo reintenta solo; si no sale, revísalo en Electrónicos SUNAT.',
          prioridad: 'alta',
          enlace: '/admin/comprobantes',
        });
      }
    }

    const boletas = await this.prisma.comprobante.findMany({
      where: {
        tipo: 'BOLETA',
        facturacion_estado: 'PENDIENTE_RESUMEN',
        baja_estado: null,
        creado_en: { lt: new Date(ahora.getTime() - DIAS_BOLETA_SIN_REPORTAR * DIA_MS) },
      },
      select: { id: true, numero_texto: true },
      take: 50,
    });
    for (const b of boletas) {
      await aviso({
        clave: `boleta:${b.id}`,
        titulo: `Boleta ${b.numero_texto} sin reportar hace más de ${DIAS_BOLETA_SIN_REPORTAR} días`,
        mensaje: 'SUNAT pide reportar las boletas dentro de 7 días. Revisa el resumen diario de boletas.',
        prioridad: 'alta',
      });
    }

    const resumenes = await this.prisma.sunatResumen.findMany({
      where: {
        estado: { in: ['ENVIADO', 'PENDIENTE_ENVIO'] },
        creado_en: { lt: new Date(ahora.getTime() - HORAS_RESUMEN_SIN_RESPUESTA * 3_600_000) },
      },
      select: { id: true, nombre: true },
      take: 50,
    });
    for (const r of resumenes) {
      await aviso({
        clave: `resumen:${r.id}`,
        titulo: `Resumen ${r.nombre} sin respuesta de SUNAT hace más de 1 día`,
        mensaje: 'SUNAT no respondió el resumen o la baja. El sistema consulta el ticket cada 2 minutos; si no cambia, avisa al soporte.',
        prioridad: 'alta',
      });
    }

    avisos += await this.avisarHuecos();
    return { avisos };
  }

  /** Huecos de numeración en la serie de boleta y de factura (un número reservado sin comprobante). */
  private async avisarHuecos(): Promise<number> {
    const filas = await this.prisma.parametro.findMany({
      where: { clave: { in: [CLAVES_FACTURACION.serieBoleta, CLAVES_FACTURACION.serieFactura] } },
    });
    const valores: Record<string, unknown> = {};
    for (const f of filas) valores[f.clave] = f.valor;
    const cfg = interpretarConfig(valores);
    let avisos = 0;
    // ponytail: se leen todos los números de la serie en cada revisión; pasar a SQL de ventana si pasa de ~100 mil
    for (const serie of [cfg.serieBoleta, cfg.serieFactura]) {
      const numeros = await this.prisma.comprobante.findMany({
        where: { serie, tipo: { in: ['BOLETA', 'FACTURA'] } },
        select: { numero: true },
      });
      for (const h of huecosDeNumeracion(numeros.map((n) => n.numero))) {
        const ok = await this.avisar({
          clave: `hueco:${serie}:${h.desde}-${h.hasta}`,
          titulo: `Hueco en la numeración ${serie}: faltan del ${h.desde} al ${h.hasta}`,
          mensaje: `Hay números de la serie ${serie} sin comprobante. Revisa si se perdió un comprobante antes de emitir más. No se borra nada.`,
          prioridad: 'alta',
        });
        if (ok) avisos++;
      }
    }
    return avisos;
  }

  /** Conteos de solo lectura para el monitoreo (sin datos personales). */
  async salud(ahora = new Date()) {
    const corteResumen = new Date(ahora.getTime() - HORAS_RESUMEN_SIN_RESPUESTA * 3_600_000);
    const [pendientes, pendientesViejos, masViejo, revisionManual, rechazados, boletasPorReportar, resumenesSinRespuesta] =
      await Promise.all([
        this.prisma.comprobante.count({ where: { facturacion_estado: 'PENDIENTE_ENVIO' } }),
        this.prisma.comprobante.count({
          where: { facturacion_estado: 'PENDIENTE_ENVIO', creado_en: { lt: new Date(ahora.getTime() - UMBRAL_PENDIENTE_MS) } },
        }),
        this.prisma.comprobante.findFirst({
          where: { facturacion_estado: 'PENDIENTE_ENVIO' },
          orderBy: { creado_en: 'asc' },
          select: { creado_en: true },
        }),
        this.prisma.comprobante.count({ where: { facturacion_estado: 'REVISION_MANUAL' } }),
        this.prisma.comprobante.count({ where: { facturacion_estado: 'RECHAZADO' } }),
        this.prisma.comprobante.count({ where: { tipo: 'BOLETA', facturacion_estado: 'PENDIENTE_RESUMEN', baja_estado: null } }),
        this.prisma.sunatResumen.count({ where: { estado: { in: ['ENVIADO', 'PENDIENTE_ENVIO'] }, creado_en: { lt: corteResumen } } }),
      ]);
    const circuito = await this.leerCircuito();
    const vence = this.sunat?.certificadoVence() ?? null;
    return {
      pendientes,
      con_problemas: revisionManual + rechazados + pendientesViejos,
      revision_manual: revisionManual,
      rechazados,
      pendientes_mas_15_min: pendientesViejos,
      edad_pendiente_min: masViejo ? Math.floor((ahora.getTime() - masViejo.creado_en.getTime()) / 60_000) : null,
      boletas_por_reportar: boletasPorReportar,
      resumenes_sin_respuesta: resumenesSinRespuesta,
      certificado_vence_en_dias: vence ? Math.floor((vence.getTime() - ahora.getTime()) / DIA_MS) : null,
      circuito_abierto: !!circuito.abiertoHasta && new Date(circuito.abiertoHasta).getTime() > ahora.getTime(),
      credenciales_invalidas: !!circuito.credencialesDesde,
      generado_en: ahora.toISOString(),
    };
  }
}

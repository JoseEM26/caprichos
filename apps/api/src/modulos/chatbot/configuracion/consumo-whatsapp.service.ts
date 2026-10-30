import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';

export const GRATIS_MES_DEFECTO = 1000;
export const AVISO_PCT_DEFECTO = 80;
const ESTADOS_ENVIADOS = ['ENVIADO', 'ENTREGADO', 'LEIDO'];
const OFFSET_LIMA_H = 5; // Lima es UTC-5 todo el año (sin horario de verano)

export interface ConsumoWhatsappMes {
  mes: string;
  servicio: number;
  plantillas: number;
  plantillasPorTipo: Record<string, number>;
  gratisMes: number;
  avisoPct: number;
  porcentaje: number;
  proyeccionFinDeMes: number;
}

/** Mes calendario de Lima: 'YYYY-MM' y sus límites en UTC [desde, hasta). */
export function mesLima(ahora: Date) {
  const l = new Date(ahora.getTime() - OFFSET_LIMA_H * 3600_000);
  const y = l.getUTCFullYear();
  const m = l.getUTCMonth();
  const desde = new Date(Date.UTC(y, m, 1, OFFSET_LIMA_H));
  const hasta = new Date(Date.UTC(y, m + 1, 1, OFFSET_LIMA_H));
  return { mes: `${y}-${String(m + 1).padStart(2, '0')}`, desde, hasta };
}

/**
 * Cuenta los mensajes SALIENTES realmente enviados a Meta (bot y personas): whatsapp_mensaje con direccion SALIENTE
 * y estado ENVIADO/ENTREGADO/LEIDO. Los SIMULADO, FALLIDO y ENCOLADO no cuentan. No hay contador propio: se cuenta la tabla.
 */
@Injectable()
export class ConsumoWhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsumoWhatsappService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.revisarAvisos().catch(() => undefined), 15 * 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async numero(clave: string, defecto: number, min: number, max: number): Promise<number> {
    const p = await this.prisma.parametro.findUnique({ where: { clave } });
    const n = Number(p?.valor);
    return p && Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : defecto;
  }

  async obtener(ahora = new Date()): Promise<ConsumoWhatsappMes> {
    const { mes, desde, hasta } = mesLima(ahora);
    const [gratisMes, avisoPct, filas] = await Promise.all([
      this.numero('wa_gratis_mes', GRATIS_MES_DEFECTO, 1, 10_000_000),
      this.numero('wa_aviso_pct', AVISO_PCT_DEFECTO, 1, 99),
      this.prisma.whatsappMensaje.groupBy({
        by: ['tipo', 'plantilla'],
        where: { direccion: 'SALIENTE', estado: { in: ESTADOS_ENVIADOS }, creado_en: { gte: desde, lt: hasta } },
        _count: { _all: true },
      }),
    ]);
    let servicio = 0;
    let plantillas = 0;
    const plantillasPorTipo: Record<string, number> = {};
    for (const f of filas as any[]) {
      const n = f._count._all as number;
      if (f.tipo === 'PLANTILLA') {
        plantillas += n;
        const k = f.plantilla || 'SIN_NOMBRE';
        plantillasPorTipo[k] = (plantillasPorTipo[k] || 0) + n;
      } else {
        servicio += n;
      }
    }
    const diasMes = (hasta.getTime() - desde.getTime()) / 86_400_000;
    const transcurridos = Math.max(1, (Math.min(ahora.getTime(), hasta.getTime()) - desde.getTime()) / 86_400_000);
    return {
      mes,
      servicio,
      plantillas,
      plantillasPorTipo,
      gratisMes,
      avisoPct,
      porcentaje: Math.round((servicio / gratisMes) * 1000) / 10,
      proyeccionFinDeMes: Math.round(((servicio + plantillas) / transcurridos) * diasMes),
    };
  }

  /** Guarda el tope y el umbral (solo los enviados). */
  async actualizarParametros(dto: { gratisMes?: number; avisoPct?: number }) {
    const guardar = (clave: string, valor: number) =>
      this.prisma.parametro.upsert({ where: { clave }, update: { valor }, create: { clave, valor } });
    if (dto.gratisMes !== undefined) await guardar('wa_gratis_mes', dto.gratisMes);
    if (dto.avisoPct !== undefined) await guardar('wa_aviso_pct', dto.avisoPct);
    await this.revisarAvisos();
    return this.obtener();
  }

  /** Crea UNA notificación para ADMIN por mes y umbral (80 % y 100 %). Idempotente: la marca es una fila única en parametro. */
  async revisarAvisos(ahora = new Date()): Promise<string[]> {
    const c = await this.obtener(ahora);
    const creados: string[] = [];
    const umbrales: Array<[number, string]> = [
      [c.avisoPct, 'AVISO'],
      [100, 'TOPE'],
    ];
    for (const [pct, nombre] of umbrales) {
      if (c.servicio < Math.ceil((c.gratisMes * pct) / 100)) continue;
      try {
        await this.prisma.parametro.create({ data: { clave: `wa_aviso_consumo:${c.mes}:${nombre}`, valor: true } });
      } catch {
        continue; // ya se avisó este mes
      }
      const fmt = (n: number) => n.toLocaleString('es-PE');
      const titulo = nombre === 'TOPE' ? 'Se agotaron los mensajes gratis de WhatsApp' : 'Mensajes gratis de WhatsApp casi agotados';
      const mensaje =
        `Ya se enviaron ${fmt(c.servicio)} de ${fmt(c.gratisMes)} mensajes gratis de WhatsApp este mes; ` +
        `desde el ${fmt(c.gratisMes + 1)} Meta cobra por mensaje. Revisa que el número tenga medio de pago en Meta.`;
      try {
        const n = await this.prisma.notificacion.create({
          data: { tipo: 'WHATSAPP_CONSUMO', rol_destino: 'ADMIN', titulo, mensaje, enlace: '/admin/configuracion' },
        });
        this.eventos?.emitirAdmin('notificaciones:nueva', { id: n.id.toString(), titulo });
        creados.push(nombre);
      } catch (err: any) {
        this.logger.error(`No se pudo crear el aviso de consumo de WhatsApp: ${err.message}`);
      }
    }
    return creados;
  }
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';

export const GRATIS_MES_DEFECTO = 1000;
export const AVISO_PCT_DEFECTO = 80;
/** Precio estimado por mensaje de servicio que pasa el tope (soles). Editable; el dato de Meta manda. */
export const PRECIO_MENSAJE_DEFECTO = 0.1;
const ESTADOS_ENVIADOS = ['ENVIADO', 'ENTREGADO', 'LEIDO'];
const OFFSET_LIMA_H = 5; // Lima es UTC-5 todo el año (sin horario de verano)

export interface ConsumoWhatsappMes {
  mes: string;
  servicio: number;
  plantillas: number;
  plantillasPorTipo: Record<string, number>;
  /** Servicio + plantillas: todo envío saliente cuenta contra el tope gratis. */
  total: number;
  gratisMes: number;
  avisoPct: number;
  /** Avance de `total` contra el tope. */
  porcentaje: number;
  proyeccionFinDeMes: number;
  precioMensaje: number;
  /** Estimado: (total - tope) x precio, sin ir por debajo de 0. Meta cobra lo suyo. */
  costoEstimadoPen: number;
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
    const [gratisMes, avisoPct, precioMensaje, filas] = await Promise.all([
      this.numero('wa_gratis_mes', GRATIS_MES_DEFECTO, 1, 10_000_000),
      this.numero('wa_aviso_pct', AVISO_PCT_DEFECTO, 1, 99),
      this.precio(),
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
    const total = servicio + plantillas;
    const diasMes = (hasta.getTime() - desde.getTime()) / 86_400_000;
    const transcurridos = Math.max(1, (Math.min(ahora.getTime(), hasta.getTime()) - desde.getTime()) / 86_400_000);
    return {
      mes,
      servicio,
      plantillas,
      plantillasPorTipo,
      total,
      gratisMes,
      avisoPct,
      porcentaje: Math.round((total / gratisMes) * 1000) / 10,
      proyeccionFinDeMes: Math.round((total / transcurridos) * diasMes),
      precioMensaje,
      costoEstimadoPen: Math.round(Math.max(0, total - gratisMes) * precioMensaje * 100) / 100,
    };
  }

  /** Precio por mensaje en soles (0 a 100, decimales). Sin valor válido, el defecto. */
  private async precio(): Promise<number> {
    const p = await this.prisma.parametro.findUnique({ where: { clave: 'wa_precio_mensaje' } });
    const n = Number(p?.valor);
    return p && Number.isFinite(n) && n >= 0 && n <= 100 ? n : PRECIO_MENSAJE_DEFECTO;
  }

  /** Guarda el tope, el umbral y el precio por mensaje estimado. */
  async actualizarParametros(dto: { gratisMes?: number; avisoPct?: number; precioMensaje?: number }) {
    const guardar = (clave: string, valor: number) =>
      this.prisma.parametro.upsert({ where: { clave }, update: { valor }, create: { clave, valor } });
    if (dto.gratisMes !== undefined) await guardar('wa_gratis_mes', dto.gratisMes);
    if (dto.avisoPct !== undefined) await guardar('wa_aviso_pct', dto.avisoPct);
    if (dto.precioMensaje !== undefined) await guardar('wa_precio_mensaje', dto.precioMensaje);
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
      if (c.total < Math.ceil((c.gratisMes * pct) / 100)) continue;
      try {
        await this.prisma.parametro.create({ data: { clave: `wa_aviso_consumo:${c.mes}:${nombre}`, valor: true } });
      } catch {
        continue; // ya se avisó este mes
      }
      const fmt = (n: number) => n.toLocaleString('es-PE');
      const titulo = nombre === 'TOPE' ? 'Se agotaron los mensajes gratis de WhatsApp' : 'Mensajes gratis de WhatsApp casi agotados';
      const mensaje =
        `Ya se enviaron ${fmt(c.total)} de ${fmt(c.gratisMes)} mensajes gratis de WhatsApp este mes; ` +
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

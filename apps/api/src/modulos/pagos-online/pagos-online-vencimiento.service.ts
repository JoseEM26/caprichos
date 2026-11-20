import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { OutboxWhatsappService } from '../chatbot/servicios/outbox-whatsapp.service';
import { telefonoEnviable } from '../chatbot/utilidades/enmascarar.util';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { adquirirCandado } from '../../comun/redis/candado.util';
import { usuarioSistema } from './usuario-sistema';
import { PedidosEstadoService } from '../pedidos-admin/pedidos-estado.service';

export const ESPERA_PAGO_DEFECTO_MIN = 15;
const INTERVALO_MS = 60_000;

/**
 * Anula solo los pedidos de «Tarjeta / Yape en línea» que no se pagaron a tiempo (parámetro pago_online_espera_min).
 * Idempotente: solo toca pedidos POR_PAGAR; no anula si hay un cargo en curso o aprobado (eso lo resuelve el cobro o el webhook).
 */
@Injectable()
export class PagosOnlineVencimientoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PagosOnlineVencimientoService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly pedidos: PedidosEstadoService,
    @Optional() private readonly outbox?: OutboxWhatsappService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.ciclo().catch((e) => this.logger.error(`Vencimiento de pagos en línea: ${e?.message}`));
    }, INTERVALO_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async ciclo(ahora = new Date()): Promise<number> {
    const candado = await adquirirCandado(this.redis.obtenerCliente(), 'lock:pagos-online:vencimiento', INTERVALO_MS - 5000);
    if (!candado.adquirido) return 0;
    return this.anularVencidos(ahora);
  }

  async minutosEspera(): Promise<number> {
    const p = await this.prisma.parametro.findUnique({ where: { clave: 'pago_online_espera_min' } }).catch(() => null);
    const n = Number(String(p?.valor ?? '').replace(/"/g, ''));
    return Number.isFinite(n) && n >= 1 && n <= 1440 ? Math.floor(n) : ESPERA_PAGO_DEFECTO_MIN;
  }

  async anularVencidos(ahora: Date): Promise<number> {
    const min = await this.minutosEspera();
    const corte = new Date(ahora.getTime() - min * 60_000);
    const vencidos = await this.prisma.pedido.findMany({
      where: {
        estado: 'POR_PAGAR',
        pago_estado: 'PENDIENTE_ONLINE',
        creado_en: { lte: corte },
        pagosOnline: { none: { estado: { in: ['PROCESANDO', 'PENDIENTE', 'APROBADO'] } } },
      },
      select: { id: true, codigo: true, cliente_telefono: true },
      take: 100,
    });
    if (!vencidos.length) return 0;
    let usuario: any;
    try {
      usuario = await usuarioSistema(this.prisma);
    } catch (e: any) {
      this.logger.error(e?.message);
      return 0;
    }
    let n = 0;
    for (const p of vencidos) {
      try {
        // Un cargo que se abra justo ahora ya no podrá cobrar: validarPedido rechaza pedidos anulados
        await this.pedidos.cambiarEstado(p.id, { estado: 'ANULADO', motivo: `Sin pago en línea en ${min} minutos` } as any, usuario);
        await this.prisma.pagoOnlineIntento.updateMany({ where: { pedido_id: p.id, estado: 'CREADO' }, data: { estado: 'FALLIDO', mensaje: 'Venció el tiempo para pagar' } });
        n += 1;
        await this.avisarCliente(p).catch((e: any) => this.logger.warn(`Aviso de pedido sin pago ${p.id} no encolado: ${e?.message}`));
      } catch (e: any) {
        this.logger.warn(`No se anuló el pedido ${p.id} sin pago: ${e?.message}`);
      }
    }
    return n;
  }

  /** El cliente ya recibió el código en la carta: se le dice que el pedido no quedó porque el pago no se completó. */
  private async avisarCliente(p: { id: bigint; codigo: string; cliente_telefono: string | null }): Promise<void> {
    const telefono = telefonoEnviable(p.cliente_telefono);
    if (!telefono || !this.outbox) return;
    const texto = `Hola 👋 Tu pedido ${p.codigo} no se registró porque el pago en línea no se completó a tiempo, así que no lo preparamos. 🙏\nSi aún lo quieres, puedes hacerlo de nuevo en la carta o escribirnos por aquí y te ayudamos 💛`;
    await this.outbox.encolar({
      telefono,
      tipo: 'TEXTO',
      clave: `pago-online-vencido-${p.id}`,
      origen: 'PAGO_ONLINE_VENCIDO',
      carga: { textoLibre: texto, autor: 'BOT', etapa: 'PAGO_ONLINE_VENCIDO' },
    });
    this.outbox.despertar();
  }
}

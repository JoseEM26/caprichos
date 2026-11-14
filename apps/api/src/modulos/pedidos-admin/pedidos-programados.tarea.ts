import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PedidosProgramadosService } from './pedidos-programados.service';

const INTERVALO_MS = 60_000;

/** Cada minuto pasa a cocina o a la cola de reparto los pedidos programados cuya hora de aviso ya llegó. */
@Injectable()
export class PedidosProgramadosTarea implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PedidosProgramadosTarea.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly programados: PedidosProgramadosService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.programados.pasarACola().catch((e) => this.logger.error(`Pedidos programados: ${e?.message}`, e?.stack));
    }, INTERVALO_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

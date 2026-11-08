import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CatalogoService } from './catalogo.service';

/**
 * Cada minuto limpia los agotados cuya hora de regreso ya pasó. La disponibilidad NO depende de esta tarea (se calcula
 * al leer con estaDisponible); solo deja los datos limpios, audita «REACTIVADO_AUTOMATICO» y avisa en vivo.
 * Es idempotente y segura con varias instancias (cada producto se limpia con una actualización condicionada).
 */
@Injectable()
export class AgotadosVencidosTarea implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgotadosVencidosTarea.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly catalogo: CatalogoService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.catalogo
        .reactivarVencidos()
        .catch((e) => this.logger.error(`Reactivar agotados vencidos: ${e?.message ?? e}`));
    }, 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}

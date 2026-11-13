import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { RedisService } from '../../comun/redis/redis.service';
import { adquirirCandado, liberarCandado } from '../../comun/redis/candado.util';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesSaludService } from './comprobantes-salud.service';
import { ComprobantesNocturnoService } from './comprobantes-nocturno.service';

/** Cada 5 minutos se reenvían las boletas/facturas pendientes (sin respuesta de SUNAT). */
export const REINTENTO_FACTURACION_MS = 5 * 60 * 1000;

/**
 * Tarea de reenvío de BOLETA/FACTURA pendientes (SUNAT). Con candado Redis (un solo contenedor a la vez);
 * sin Redis, el candado cae en modo fallback y corre igual. Las boletas SUNAT firmadas no se reenvían aquí: van en el resumen.
 * ponytail: un setInterval por proceso; con varias réplicas el candado Redis evita el doble envío.
 */
@Injectable()
export class ComprobantesReintentosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ComprobantesReintentosService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly comprobantes: ComprobantesService,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly salud?: ComprobantesSaludService,
    @Optional() private readonly nocturno?: ComprobantesNocturnoService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.ejecutar().catch((e) => this.logger.error(`Reintento facturación: ${e?.message ?? e}`));
    }, REINTENTO_FACTURACION_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Una pasada con candado. Devuelve cuántos pendientes revisó (0 si otro contenedor la tiene). */
  async ejecutar(): Promise<{ revisados: number; motivo?: string }> {
    const cliente = this.redis?.obtenerCliente() ?? null;
    const clave = 'lock:comprobantes:electronicos';
    const candado = await adquirirCandado(cliente, clave, 280000);
    if (!candado.adquirido) return { revisados: 0, motivo: 'OTRO_CONTENEDOR' };
    try {
      // 1) barrido de cobros sin comprobante (solo después del corte); 2) reenvío de pendientes; 3) avisos
      await this.comprobantes.barrerPedidosSinComprobante();
      // Lote de la noche: cambios pendientes y emisión con número (antes del resumen diario de las 22:30)
      await this.nocturno?.emitirLote().catch((e: any) => this.logger.error(`Lote nocturno: ${e?.message ?? e}`));
      const resultado = await this.comprobantes.reintentarPendientes();
      await this.salud?.revisarAlertas();
      return resultado;
    } finally {
      await liberarCandado(cliente, clave, candado.token).catch(() => {});
    }
  }
}

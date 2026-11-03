import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { OutboxWhatsappService } from '../chatbot/servicios/outbox-whatsapp.service';
import { enmascararTelefono } from '../chatbot/utilidades/enmascarar.util';
import { parametroActivoConDefecto, whatsappSimulado } from '../chatbot/utilidades/modo-whatsapp.util';

export type AvisoCuenta = 'CREADA' | 'CLAVE_CAMBIADA';

const DETALLE: Record<AvisoCuenta, string> = {
  CREADA: 'fue creada',
  CLAVE_CAMBIADA: 'cambió tu contraseña',
};

/**
 * Aviso de seguridad por WhatsApp al crear la cuenta o cambiar la contraseña (parámetro whatsapp_aviso_cuenta_activo).
 * Best effort: nunca lanza, para que un fallo de WhatsApp no frene la cuenta. La creación avisa una sola vez por cuenta.
 */
@Injectable()
export class AvisoCuentaService {
  private readonly logger = new Logger(AvisoCuentaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async avisar(partyId: bigint | string, telefono9: string, accion: AvisoCuenta): Promise<void> {
    try {
      const flag = await this.prisma.parametro.findUnique({ where: { clave: 'whatsapp_aviso_cuenta_activo' } });
      if (!parametroActivoConDefecto(flag?.valor, whatsappSimulado())) return;
      // El outbox es del módulo del chatbot (que importa a Clientes): se busca en tiempo de ejecución para no crear un ciclo
      const outbox = this.moduleRef.get(OutboxWhatsappService, { strict: false });
      if (!outbox) return;
      const sufijo = accion === 'CREADA' ? '' : `-${Date.now()}`;
      await outbox.encolar({
        telefono: `51${telefono9}`,
        tipo: 'TEXTO',
        clave: `cuenta-${accion.toLowerCase()}-${String(partyId)}${sufijo}`,
        origen: 'AVISO_CUENTA',
        carga: {
          textoLibre: `Tu cuenta de Caprichos ${DETALLE[accion]}. Si no fuiste tú, escríbenos por WhatsApp de inmediato.`,
          plantillaClave: 'CUENTA_AVISO_SEGURIDAD',
          variablesPlantilla: [DETALLE[accion]],
          autor: 'BOT',
        },
      });
      outbox.despertar();
    } catch (err: any) {
      this.logger.warn(`Aviso de cuenta (${accion}) no encolado a ${enmascararTelefono(`51${telefono9}`)}: ${err?.message}`);
    }
  }
}

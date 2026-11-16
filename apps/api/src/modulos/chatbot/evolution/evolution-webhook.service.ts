import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { ColaWebhookService } from '../servicios/cola-webhook.service';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';
import { EvolutionConfigService } from './evolution-config.service';
import { aRespuestaDeMenu, normalizarMensajeEvolution } from './evolution-mensaje.util';
import { MenuNumeradoStore } from './menu-numerado.store';
import { EvolutionApiCliente } from './evolution-api.cliente';
import { extraerAdjuntoEvolution } from './evolution-mensaje.util';

export interface ResultadoEvolutionWebhook {
  evento: string;
  procesados: number;
  ignorados: number;
}

/** Entrada de eventos de Evolution API: valida el token compartido y reutiliza el flujo del webhook de Meta. */
@Injectable()
export class EvolutionWebhookService {
  private readonly logger = new Logger(EvolutionWebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly estado: EvolutionConfigService,
    private readonly menus: MenuNumeradoStore,
    private readonly webhook: WhatsappWebhookService,
    @Optional() private readonly cola?: ColaWebhookService,
    @Optional() private readonly api?: EvolutionApiCliente,
  ) {}

  /** Comparación en tiempo constante. Sin EVOLUTION_WEBHOOK_TOKEN configurado se rechaza todo (falla cerrado). */
  validarToken(recibido?: string): boolean {
    const esperado = (this.configService.get<string>('EVOLUTION_WEBHOOK_TOKEN') || '').trim();
    if (!esperado || !recibido) return false;
    const h = (v: string) => createHash('sha256').update(v).digest();
    return timingSafeEqual(h(esperado), h(recibido.trim()));
  }

  async procesar(body: any): Promise<ResultadoEvolutionWebhook> {
    // Evolution manda «messages.upsert» o «MESSAGES_UPSERT» según cómo se configure el webhook
    const evento = String(body?.event ?? '').toLowerCase().replace(/_/g, '.');
    const res: ResultadoEvolutionWebhook = { evento, procesados: 0, ignorados: 0 };

    if (evento === 'connection.update') {
      const d = body?.data ?? {};
      const state = String(d.state ?? d.instance?.state ?? '');
      if (state) await this.estado.registrarConexion(state, d.statusReason ?? d.disconnectionReasonCode ?? null);
      return res;
    }
    if (evento !== 'messages.upsert') {
      res.ignorados++;
      return res;
    }

    const crudo = body?.data;
    const lista: any[] = Array.isArray(crudo) ? crudo : Array.isArray(crudo?.messages) ? crudo.messages : crudo ? [crudo] : [];
    for (const data of lista) {
      const adj = extraerAdjuntoEvolution(data);
      if (adj) this.api?.recordarAdjunto(adj.id, adj);
      const n = normalizarMensajeEvolution(data);
      if (!n.ok) {
        res.ignorados++;
        this.logger.debug(`Mensaje de Evolution ignorado (${n.razon})`);
        continue;
      }
      const msg = aRespuestaDeMenu(n.msg, await this.menus.obtener(n.msg.from));
      // Idempotencia: el flujo de Meta ya descarta un wa_message_id repetido (whatsapp_mensaje.wa_message_id es único)
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{ changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', contacts: [n.contacto], messages: [msg] } }] }],
      };
      if (msg !== n.msg) await this.menus.borrar(n.msg.from);
      if (this.cola) await this.cola.encolarOProcesar(Buffer.from(JSON.stringify(payload)), payload);
      else await this.webhook.procesarPayload(payload);
      res.procesados++;
    }
    return res;
  }
}

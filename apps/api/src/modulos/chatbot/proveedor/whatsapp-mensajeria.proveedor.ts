import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WHATSAPP_MENSAJERIA_PUERTO } from '../puerto/whatsapp-mensajeria.puerto';
import { WhatsAppMetaAdaptador } from '../adaptadores/whatsapp-meta.adaptador';
import { WhatsAppSimuladoAdaptador } from '../adaptadores/whatsapp-simulado.adaptador';
import { WhatsAppEvolutionAdaptador } from '../adaptadores/whatsapp-evolution.adaptador';
import { WhatsAppEnrutadorAdaptador } from '../adaptadores/whatsapp-enrutador.adaptador';
import { EvolutionConfigService } from '../evolution/evolution-config.service';
import { NumerosWhatsappService } from '../servicios/numeros-whatsapp.service';
import { conGuardiaSalida } from './guardia-salida';

/**
 * Puerto de mensajería: el enrutador elige Meta (o simulado sin credenciales) o Evolution en cada envío según el
 * parámetro whatsapp_proveedor (META por defecto), y el guardia de salida envuelve a los dos.
 */
export const WhatsAppMensajeriaProvider: Provider = {
  provide: WHATSAPP_MENSAJERIA_PUERTO,
  useFactory: (
    configService: ConfigService,
    metaAdaptador: WhatsAppMetaAdaptador,
    simuladoAdaptador: WhatsAppSimuladoAdaptador,
    evolution: WhatsAppEvolutionAdaptador,
    evolutionConfig: EvolutionConfigService,
    numeros: NumerosWhatsappService,
  ) => {
    const token = (configService.get<string>('WHATSAPP_TOKEN') || '').trim();
    const phoneId = (configService.get<string>('WHATSAPP_PHONE_ID') || '').trim();
    const base = token && phoneId ? metaAdaptador : simuladoAdaptador;
    return conGuardiaSalida(new WhatsAppEnrutadorAdaptador(base, evolution, evolutionConfig), numeros);
  },
  inject: [ConfigService, WhatsAppMetaAdaptador, WhatsAppSimuladoAdaptador, WhatsAppEvolutionAdaptador, EvolutionConfigService, NumerosWhatsappService],
};

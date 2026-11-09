import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WHATSAPP_MENSAJERIA_PUERTO } from '../puerto/whatsapp-mensajeria.puerto';
import { WhatsAppMetaAdaptador } from '../adaptadores/whatsapp-meta.adaptador';
import { WhatsAppSimuladoAdaptador } from '../adaptadores/whatsapp-simulado.adaptador';
import { NumerosWhatsappService } from '../servicios/numeros-whatsapp.service';
import { conGuardiaSalida } from './guardia-salida';

export const WhatsAppMensajeriaProvider: Provider = {
  provide: WHATSAPP_MENSAJERIA_PUERTO,
  useFactory: (
    configService: ConfigService,
    metaAdaptador: WhatsAppMetaAdaptador,
    simuladoAdaptador: WhatsAppSimuladoAdaptador,
    numeros: NumerosWhatsappService,
  ) => {
    const token = (configService.get<string>('WHATSAPP_TOKEN') || '').trim();
    const phoneId = (configService.get<string>('WHATSAPP_PHONE_ID') || '').trim();

    if (token && phoneId) {
      return conGuardiaSalida(metaAdaptador, numeros);
    }
    return conGuardiaSalida(simuladoAdaptador, numeros);
  },
  inject: [ConfigService, WhatsAppMetaAdaptador, WhatsAppSimuladoAdaptador, NumerosWhatsappService],
};

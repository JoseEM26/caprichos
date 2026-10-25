import { ConfigService } from '@nestjs/config';
import { WhatsAppMensajeriaProvider } from '../proveedor/whatsapp-mensajeria.proveedor';
import { WhatsAppMetaAdaptador } from '../adaptadores/whatsapp-meta.adaptador';
import { WhatsAppSimuladoAdaptador } from '../adaptadores/whatsapp-simulado.adaptador';

describe('WhatsAppMensajeriaProvider (Selección de Adaptador)', () => {
  const mockMeta = { tipo: 'meta' } as unknown as WhatsAppMetaAdaptador;
  const mockSimulado = { tipo: 'simulado' } as unknown as WhatsAppSimuladoAdaptador;

  it('selecciona el adaptador Meta si existen WHATSAPP_TOKEN y WHATSAPP_PHONE_ID', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'WHATSAPP_TOKEN') return 'token-meta-123';
        if (key === 'WHATSAPP_PHONE_ID') return 'phone-id-456';
        return undefined;
      }),
    } as unknown as ConfigService;

    const factory = (WhatsAppMensajeriaProvider as any).useFactory;
    const adaptador = factory(configService, mockMeta, mockSimulado);

    expect(adaptador).toBe(mockMeta);
  });

  it('selecciona el adaptador Simulado por defecto si falta WHATSAPP_TOKEN', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'WHATSAPP_TOKEN') return '';
        if (key === 'WHATSAPP_PHONE_ID') return 'phone-id-456';
        return undefined;
      }),
    } as unknown as ConfigService;

    const factory = (WhatsAppMensajeriaProvider as any).useFactory;
    const adaptador = factory(configService, mockMeta, mockSimulado);

    expect(adaptador).toBe(mockSimulado);
  });

  it('selecciona el adaptador Simulado por defecto si faltan ambas variables', () => {
    const configService = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    const factory = (WhatsAppMensajeriaProvider as any).useFactory;
    const adaptador = factory(configService, mockMeta, mockSimulado);

    expect(adaptador).toBe(mockSimulado);
  });
});

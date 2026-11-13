jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn() }));
jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ConfigService } from '@nestjs/config';
import { WhatsAppMensajeriaProvider } from '../proveedor/whatsapp-mensajeria.proveedor';
import { WhatsAppMetaAdaptador } from '../adaptadores/whatsapp-meta.adaptador';
import { WhatsAppSimuladoAdaptador } from '../adaptadores/whatsapp-simulado.adaptador';

describe('WhatsAppMensajeriaProvider (Selección de Adaptador)', () => {
  const mockMeta = { tipo: 'meta', enviarTexto: jest.fn().mockResolvedValue({ exito: true }) } as unknown as WhatsAppMetaAdaptador;
  const mockSimulado = { tipo: 'simulado', enviarTexto: jest.fn().mockResolvedValue({ exito: true }) } as unknown as WhatsAppSimuladoAdaptador;
  const mockEvolution = { tipo: 'evolution', enviarTexto: jest.fn().mockResolvedValue({ exito: true }) } as any;
  const evolutionConfig = (p: string) => ({ proveedor: jest.fn().mockResolvedValue(p), proveedorEnCache: () => p }) as any;
  // El proveedor devuelve el adaptador elegido envuelto por el guardia de salida: se comprueba a quién llama
  const numeros = { motivoOmision: jest.fn().mockResolvedValue(null), logOmitido: jest.fn() };
  const elegido = async (adaptador: any) => {
    (mockMeta as any).enviarTexto.mockClear();
    (mockSimulado as any).enviarTexto.mockClear();
    await adaptador.enviarTexto('51987654321', 'hola');
    return (mockMeta as any).enviarTexto.mock.calls.length ? mockMeta : mockSimulado;
  };

  it('selecciona el adaptador Meta si existen WHATSAPP_TOKEN y WHATSAPP_PHONE_ID', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'WHATSAPP_TOKEN') return 'token-meta-123';
        if (key === 'WHATSAPP_PHONE_ID') return 'phone-id-456';
        return undefined;
      }),
    } as unknown as ConfigService;

    const factory = (WhatsAppMensajeriaProvider as any).useFactory;
    const adaptador = factory(configService, mockMeta, mockSimulado, mockEvolution, evolutionConfig('META'), numeros);

    expect(await elegido(adaptador)).toBe(mockMeta);
  });

  it('selecciona el adaptador Simulado por defecto si falta WHATSAPP_TOKEN', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'WHATSAPP_TOKEN') return '';
        if (key === 'WHATSAPP_PHONE_ID') return 'phone-id-456';
        return undefined;
      }),
    } as unknown as ConfigService;

    const factory = (WhatsAppMensajeriaProvider as any).useFactory;
    const adaptador = factory(configService, mockMeta, mockSimulado, mockEvolution, evolutionConfig('META'), numeros);

    expect(await elegido(adaptador)).toBe(mockSimulado);
  });

  it('selecciona el adaptador Simulado por defecto si faltan ambas variables', async () => {
    const configService = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    const factory = (WhatsAppMensajeriaProvider as any).useFactory;
    const adaptador = factory(configService, mockMeta, mockSimulado, mockEvolution, evolutionConfig('META'), numeros);

    expect(await elegido(adaptador)).toBe(mockSimulado);
  });

  it('con whatsapp_proveedor = EVOLUTION el envío sale por Evolution aunque Meta tenga credenciales, y vuelve a Meta al conmutar', async () => {
    const configService = { get: jest.fn((k: string) => (k === 'WHATSAPP_TOKEN' ? 't' : k === 'WHATSAPP_PHONE_ID' ? 'p' : undefined)) } as unknown as ConfigService;
    const factory = (WhatsAppMensajeriaProvider as any).useFactory;
    const proveedor = { valor: 'EVOLUTION' };
    const cfg = { proveedor: jest.fn(async () => proveedor.valor), proveedorEnCache: () => proveedor.valor } as any;
    const adaptador = factory(configService, mockMeta, mockSimulado, mockEvolution, cfg, numeros);
    mockEvolution.enviarTexto.mockClear();
    await adaptador.enviarTexto('51987654321', 'hola');
    expect(mockEvolution.enviarTexto).toHaveBeenCalledTimes(1);
    proveedor.valor = 'META';
    (mockMeta as any).enviarTexto.mockClear();
    await adaptador.enviarTexto('51987654321', 'hola');
    expect((mockMeta as any).enviarTexto).toHaveBeenCalledTimes(1);
  });

  it('WhatsAppSimuladoAdaptador simula enviarImagen correctamente y persiste mensaje', async () => {
    const mockPrisma = {
      whatsappMensaje: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: BigInt(202), ...data }),
        ),
      },
    } as any;
    const simuladorReal = new WhatsAppSimuladoAdaptador(mockPrisma);
    const res = await simuladorReal.enviarImagen('51987654321', 'http://ejemplo.com/qr.png', 'Caption QR');

    expect(res.exito).toBe(true);
    expect(res.estado).toBe('SIMULADO');
    expect(mockPrisma.whatsappMensaje.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'IMAGEN',
          estado: 'SIMULADO',
        }),
      }),
    );
  });
});

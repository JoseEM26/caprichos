jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ChatbotConfiguracionService } from '../chatbot-configuracion.service';

// Audio y transcripción son datos personales (Ley 29733): al anonimizar por retención o por baja,
// también se borran los archivos de audio.
describe('Retención y baja: se borran los audios de las notas de voz', () => {
  let prisma: any;
  let archivos: any;
  let service: ChatbotConfiguracionService;

  beforeEach(() => {
    prisma = {
      parametro: { findMany: jest.fn().mockResolvedValue([{ clave: 'chatbot_retencion_dias', valor: 90 }]) },
      mensajeChat: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1n, contenido: { texto: 'Nota de voz', audio: { archivoId: '900' }, transcripcion: 'mi dirección es...' } },
          { id: 2n, contenido: { texto: 'hola' } },
        ]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      conversacion: { findFirst: jest.fn().mockResolvedValue({ id: 5n }), update: jest.fn() },
      clienteWhatsappConsentimiento: { upsert: jest.fn() },
    };
    archivos = { eliminarArchivo: jest.fn().mockResolvedValue(true) };
    service = new ChatbotConfiguracionService(prisma, {} as any, { registrar: jest.fn() } as any, undefined, archivos);
  });

  it('la retención borra el audio y deja el mensaje anonimizado sin transcripción', async () => {
    await service.ejecutarAnonimizacionRetencion();
    expect(archivos.eliminarArchivo).toHaveBeenCalledTimes(1);
    expect(archivos.eliminarArchivo).toHaveBeenCalledWith('900');
    const datos = prisma.mensajeChat.update.mock.calls[0][0].data.contenido;
    expect(datos.anonimizado).toBe(true);
    expect(datos.transcripcion).toBeUndefined();
    expect(datos.audio).toBeUndefined();
  });

  it('la baja de un cliente borra los audios de su conversación', async () => {
    await service.darDeBajaCliente('51987654321');
    expect(archivos.eliminarArchivo).toHaveBeenCalledWith('900');
    expect(prisma.mensajeChat.updateMany).toHaveBeenCalled();
  });
});

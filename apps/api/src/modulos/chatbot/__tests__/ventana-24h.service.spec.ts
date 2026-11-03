jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { Ventana24hService } from '../servicios/ventana-24h.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { WhatsAppMensajeriaPuerto } from '../puerto/whatsapp-mensajeria.puerto';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';

describe('Ventana24hService', () => {
  let servicio: Ventana24hService;
  let mockPrisma: any;
  let mockMensajeria: any;
  let mockEventos: any;

  beforeEach(() => {
    mockPrisma = {
      whatsappMensaje: {
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: BigInt(1), ...data })),
      },
      clienteWhatsappConsentimiento: {
        findUnique: jest.fn(),
      },
      notificacion: {
        create: jest.fn().mockResolvedValue({ id: BigInt(501) }),
      },
    };

    mockMensajeria = {
      enviarTexto: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO', waMessageId: 'wamid.txt' }),
      enviarPlantilla: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO', waMessageId: 'wamid.tmpl' }),
      enviarBotones: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO', waMessageId: 'wamid.btn' }),
      marcarLeido: jest.fn().mockResolvedValue(true),
      estaConectado: jest.fn().mockReturnValue({ conectado: true, modo: 'meta' }),
    };

    mockEventos = {
      emitirAdmin: jest.fn(),
    };

    servicio = new Ventana24hService(
      mockPrisma as PrismaService,
      mockMensajeria as WhatsAppMensajeriaPuerto,
      mockEventos as EventosGateway,
    );
  });

  it('determina que la ventana está abierta si hay mensaje entrante en las últimas 24h', async () => {
    mockPrisma.whatsappMensaje.findFirst.mockResolvedValue({
      id: BigInt(10),
      creado_en: new Date(),
    });

    const abierta = await servicio.esVentanaAbierta('987654321');
    expect(abierta).toBe(true);
  });

  it('determina que la ventana está cerrada si no hay mensaje entrante en las últimas 24h', async () => {
    mockPrisma.whatsappMensaje.findFirst.mockResolvedValue(null);

    const abierta = await servicio.esVentanaAbierta('987654321');
    expect(abierta).toBe(false);
  });

  it('si la ventana está abierta, envía texto libre o interactivo', async () => {
    mockPrisma.whatsappMensaje.findFirst.mockResolvedValue({
      id: BigInt(10),
      creado_en: new Date(),
    });
    mockPrisma.clienteWhatsappConsentimiento.findUnique.mockResolvedValue({ acepta: true });

    const resultado = await servicio.enviarMensajeNegocio('987654321', {
      textoLibre: 'Tu pedido CP-101 ya salio',
      plantillaClave: 'DELIVERY_SALIDA',
    });

    expect(resultado.exito).toBe(true);
    expect(mockMensajeria.enviarTexto).toHaveBeenCalledWith(
      '987654321',
      'Tu pedido CP-101 ya salio',
      undefined,
    );
    expect(mockMensajeria.enviarPlantilla).not.toHaveBeenCalled();
  });

  it('si la ventana está cerrada, envía obligatoriamente plantilla aprobada', async () => {
    mockPrisma.whatsappMensaje.findFirst.mockResolvedValue(null); // Ventana cerrada
    mockPrisma.clienteWhatsappConsentimiento.findUnique.mockResolvedValue({ acepta: true });

    const resultado = await servicio.enviarMensajeNegocio('987654321', {
      textoLibre: 'Texto libre que no debe usarse fuera de 24h',
      plantillaClave: 'DELIVERY_SALIDA',
      variablesPlantilla: ['Juan', 'CP-101', '25'],
    });

    expect(resultado.exito).toBe(true);
    expect(mockMensajeria.enviarPlantilla).toHaveBeenCalledWith(
      '987654321',
      'caprichos_delivery_en_camino',
      'es',
      ['Juan', 'CP-101', '25'],
      undefined,
    );
    expect(mockMensajeria.enviarTexto).not.toHaveBeenCalled();
  });

  it('CODIGO_CUENTA fuera de la ventana: pasa el código también como botonCodigo', async () => {
    mockPrisma.whatsappMensaje.findFirst.mockResolvedValue(null); // Ventana cerrada
    mockPrisma.clienteWhatsappConsentimiento.findUnique.mockResolvedValue({ acepta: true });

    await servicio.enviarMensajeNegocio('987654321', {
      textoLibre: 'Tu código es 482913',
      plantillaClave: 'CODIGO_CUENTA',
      variablesPlantilla: ['482913'],
    });

    expect(mockMensajeria.enviarPlantilla).toHaveBeenCalledWith(
      '987654321',
      'caprichos_codigo_cuenta',
      'es',
      ['482913'],
      { botonCodigo: '482913' },
    );
  });

  it('si la plantilla no existe en el catálogo, registra fallo y avisa a Caja por la campana', async () => {
    mockPrisma.whatsappMensaje.findFirst.mockResolvedValue(null); // Ventana cerrada
    mockPrisma.clienteWhatsappConsentimiento.findUnique.mockResolvedValue({ acepta: true });

    const resultado = await servicio.enviarMensajeNegocio('987654321', {
      textoLibre: 'Prueba',
      plantillaClave: 'PLANTILLA_INEXISTENTE' as any,
    });

    expect(resultado.exito).toBe(false);
    expect(resultado.errorCodigo).toBe('PLANTILLA_NO_CONFIGURADA');
    expect(mockPrisma.notificacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rol_destino: 'CAJERO',
          titulo: expect.stringContaining('plantilla'),
        }),
      }),
    );
    expect(mockEventos.emitirAdmin).toHaveBeenCalledWith(
      'notificaciones:nueva',
      expect.any(Object),
    );
  });

  it('si el cliente solicitó BAJA, bloquea el envío comercial/informativo', async () => {
    mockPrisma.clienteWhatsappConsentimiento.findUnique.mockResolvedValue({ acepta: false });

    const resultado = await servicio.enviarMensajeNegocio('987654321', {
      textoLibre: 'Oferta o aviso',
      plantillaClave: 'DELIVERY_SALIDA',
    });

    expect(resultado.exito).toBe(false);
    expect(resultado.errorCodigo).toBe('CLIENTE_BAJA');
    expect(mockMensajeria.enviarTexto).not.toHaveBeenCalled();
    expect(mockMensajeria.enviarPlantilla).not.toHaveBeenCalled();
  });
});

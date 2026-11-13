jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { Ventana24hService } from '../servicios/ventana-24h.service';
import { CATALOGO_PLANTILLAS } from '../catalogo/plantillas.catalogo';
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

  it('encuesta con la ventana abierta: sale la lista 1 a 5, no los 3 botones', async () => {
    mockPrisma.whatsappMensaje.findFirst.mockResolvedValue({ creado_en: new Date() }); // Ventana abierta
    mockPrisma.clienteWhatsappConsentimiento.findUnique.mockResolvedValue({ acepta: true });
    const filas = [1, 2, 3, 4, 5].map((n) => ({ id: `encuesta:${n}`, titulo: `${n}` }));
    mockMensajeria.enviarLista = jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO' });

    await servicio.enviarMensajeNegocio('987654321', {
      textoLibre: 'Califica',
      botones: [{ id: 'encuesta:1', titulo: '1' }],
      lista: { boton: 'Calificar', filas },
    });

    expect(mockMensajeria.enviarLista).toHaveBeenCalledWith('987654321', 'Califica', 'Calificar', filas, undefined);
    expect(mockMensajeria.enviarBotones).not.toHaveBeenCalled();
  });

  it('ENCUESTA_POSVENTA fuera de la ventana: la plantilla lleva los payloads de sus 3 botones 1/3/5', async () => {
    mockPrisma.whatsappMensaje.findFirst.mockResolvedValue(null); // Ventana cerrada
    mockPrisma.clienteWhatsappConsentimiento.findUnique.mockResolvedValue({ acepta: true });

    await servicio.enviarMensajeNegocio('987654321', {
      textoLibre: 'Hola Ana, gracias por tu compra',
      plantillaClave: 'ENCUESTA_POSVENTA',
      variablesPlantilla: ['Ana', 'CP-1'],
      botones: [
        { id: 'encuesta:1', titulo: '1 Malo' },
        { id: 'encuesta:3', titulo: '3 Regular' },
        { id: 'encuesta:5', titulo: '5 Excelente' },
      ],
    });

    expect(mockMensajeria.enviarPlantilla).toHaveBeenCalledWith(
      '987654321',
      'caprichos_encuesta_posventa',
      'es',
      ['Ana', 'CP-1'],
      { botonesRespuesta: ['encuesta:1', 'encuesta:3', 'encuesta:5'] },
    );
  });

  it('plantilla sin botones en el catálogo (DELIVERY_SALIDA): no se mandan payloads aunque llegue botones', async () => {
    mockPrisma.whatsappMensaje.findFirst.mockResolvedValue(null);
    mockPrisma.clienteWhatsappConsentimiento.findUnique.mockResolvedValue({ acepta: true });

    await servicio.enviarMensajeNegocio('987654321', {
      textoLibre: 'x',
      plantillaClave: 'DELIVERY_SALIDA',
      variablesPlantilla: ['Ana', 'CP-1', '25'],
      botones: [{ id: 'a', titulo: 'A' }],
    });

    expect(mockMensajeria.enviarPlantilla.mock.calls[0][4]).toBeUndefined();
  });

  it('botones de la encuesta en el catálogo: 3 botones, títulos ≤ 20 caracteres y los de la conversación', () => {
    const def = CATALOGO_PLANTILLAS.ENCUESTA_POSVENTA;
    expect(def.botones).toEqual(['1 Malo', '3 Regular', '5 Excelente']);
    for (const titulo of def.botones!) expect(titulo.length).toBeLessThanOrEqual(20);
    expect(def.nombre).toBe('caprichos_encuesta_posventa');
    expect(def.categoria).toBe('UTILITY');
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

  describe('plantilla de respaldo', () => {
    const payload = {
      textoLibre: 'x',
      plantillaClave: 'CARTA_DELIVERY_UBICACION_EFECTIVO' as const,
      variablesPlantilla: ['Ana', 'CP-1'],
      plantillaRespaldo: { plantillaClave: 'CARTA_RECIBIDO_EFECTIVO' as const, variablesPlantilla: ['Ana', 'CP-1'] },
    };
    beforeEach(() => {
      mockPrisma.clienteWhatsappConsentimiento.findUnique.mockResolvedValue(null);
      mockPrisma.whatsappMensaje.findFirst.mockResolvedValue(null);
    });

    it('plantilla no aprobada: envía la de respaldo una sola vez', async () => {
      mockMensajeria.enviarPlantilla
        .mockResolvedValueOnce({ exito: false, estado: 'FALLIDO', errorCodigo: 'PLANTILLA_NO_APROBADA', errorDetalle: 'no aprobada' })
        .mockResolvedValueOnce({ exito: true, estado: 'ENVIADO', waMessageId: 'wamid.resp' });
      const r = await servicio.enviarMensajeNegocio('51987654321', payload);
      expect(r.exito).toBe(true);
      expect(mockMensajeria.enviarPlantilla).toHaveBeenCalledTimes(2);
      expect(mockMensajeria.enviarPlantilla.mock.calls[0][1]).toBe('caprichos_pedido_delivery_ubicacion_efectivo');
      expect(mockMensajeria.enviarPlantilla.mock.calls[1][1]).toBe('caprichos_pedido_recibido_efectivo');
    });

    it('plantilla principal enviada: no se manda la de respaldo', async () => {
      await servicio.enviarMensajeNegocio('51987654321', payload);
      expect(mockMensajeria.enviarPlantilla).toHaveBeenCalledTimes(1);
    });

    it('error que no es de plantilla (p. ej. número inválido): no se manda el respaldo', async () => {
      mockMensajeria.enviarPlantilla.mockResolvedValue({ exito: false, estado: 'FALLIDO', errorCodigo: 'NUMERO_INVALIDO' });
      const r = await servicio.enviarMensajeNegocio('51987654321', payload);
      expect(r.exito).toBe(false);
      expect(mockMensajeria.enviarPlantilla).toHaveBeenCalledTimes(1);
    });

    it('con ventana abierta sale el texto libre y no se usa plantilla', async () => {
      mockPrisma.whatsappMensaje.findFirst.mockResolvedValue({ id: BigInt(1), creado_en: new Date() });
      await servicio.enviarMensajeNegocio('51987654321', payload);
      expect(mockMensajeria.enviarTexto).toHaveBeenCalledTimes(1);
      expect(mockMensajeria.enviarPlantilla).not.toHaveBeenCalled();
    });
  });
});

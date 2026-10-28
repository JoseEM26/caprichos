jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { AvisosPedidoService } from '../servicios/avisos-pedido.service';
import { Ventana24hService } from '../servicios/ventana-24h.service';

describe('AvisosPedidoService (avisos de reparto al cliente)', () => {
  let servicio: AvisosPedidoService;
  let prisma: any;
  let mensajeria: any;
  let pedido: any;

  beforeEach(() => {
    pedido = {
      id: BigInt(77),
      codigo: 'CP-077',
      cliente_nombre: 'Marta',
      cliente_telefono: '987654321',
      modalidad: 'DELIVERY',
    };

    prisma = {
      pedido: { findUnique: jest.fn(async () => pedido) },
      parametro: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.clave === 'tiempo_prometido_min') return { valor: 25 };
          return { valor: 'si' };
        }),
      },
      mensajeReparto: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      whatsappMensaje: { findFirst: jest.fn().mockResolvedValue(null) },
      clienteWhatsappConsentimiento: { findUnique: jest.fn().mockResolvedValue(null) },
      conversacion: { upsert: jest.fn().mockResolvedValue({ id: BigInt(5) }) },
      mensajeChat: { create: jest.fn().mockResolvedValue({}) },
    };

    mensajeria = {
      enviarTexto: jest.fn().mockResolvedValue({ exito: true, estado: 'SIMULADO', id: '900' }),
      enviarBotones: jest.fn(),
      enviarPlantilla: jest.fn().mockResolvedValue({ exito: true, estado: 'SIMULADO', id: '901' }),
    };

    const ventana = new Ventana24hService(prisma, mensajeria, undefined);
    servicio = new AvisosPedidoService(prisma, ventana);
  });

  it('envía el aviso, registra la etapa en mensaje_reparto y lo copia en mensaje_chat', async () => {
    // Ventana cerrada: se usa la plantilla aprobada
    const res = await servicio.avisar(77, 'LLEGADA');

    expect(res.estado).toBe('SIMULADO');
    expect(prisma.mensajeReparto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pedido_id: BigInt(77), numero: 2, estado: 'PENDIENTE' }),
    });
    expect(prisma.mensajeReparto.update).toHaveBeenCalledWith({
      where: { pedido_id_numero: { pedido_id: BigInt(77), numero: 2 } },
      data: { estado: 'ENVIADO' },
    });
    expect(prisma.mensajeChat.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversacion_id: BigInt(5),
        direccion: 'SALE',
        autor: 'BOT',
        tipo: 'TEXTO',
        whatsapp_mensaje_id: BigInt(901),
        contenido: expect.objectContaining({ etapa: 'LLEGADA', pedido: 'CP-077', estado: 'SIMULADO' }),
      }),
    });
  });

  it('no duplica: si la etapa ya existe en mensaje_reparto (P2002) no envía nada', async () => {
    prisma.mensajeReparto.create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));

    const res = await servicio.avisar(77, 'SALIDA');

    expect(res.estado).toBe('YA_ENVIADO');
    expect(mensajeria.enviarTexto).not.toHaveBeenCalled();
    expect(mensajeria.enviarPlantilla).not.toHaveBeenCalled();
    expect(prisma.mensajeChat.create).not.toHaveBeenCalled();
  });

  it('parámetro apagado: no envía y no registra la etapa', async () => {
    prisma.parametro.findUnique.mockResolvedValueOnce({ valor: 'no' });

    const res = await servicio.avisar(77, 'LLEGADA');

    expect(res).toEqual({ estado: 'OMITIDO', motivo: 'DESACTIVADO' });
    expect(prisma.mensajeReparto.create).not.toHaveBeenCalled();
    expect(mensajeria.enviarPlantilla).not.toHaveBeenCalled();
  });

  it('parámetro en true (booleano) también activa el aviso', async () => {
    prisma.parametro.findUnique.mockResolvedValueOnce({ valor: true });
    prisma.whatsappMensaje.findFirst.mockResolvedValueOnce({ id: BigInt(1) }); // ventana abierta

    const res = await servicio.avisar(77, 'ACEPTADO');

    expect(res.estado).toBe('SIMULADO');
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith('51987654321', expect.stringContaining('CP-077'), expect.anything());
  });

  it('ventana cerrada: usa la plantilla aprobada con el teléfono normalizado a 51XXXXXXXXX', async () => {
    await servicio.avisar(77, 'ENTREGADO');

    expect(mensajeria.enviarTexto).not.toHaveBeenCalled();
    expect(mensajeria.enviarPlantilla).toHaveBeenCalledWith(
      '51987654321',
      'caprichos_delivery_entregado',
      'es',
      ['Marta', 'CP-077'],
      { pedidoId: BigInt(77) },
    );
  });

  it('ventana abierta (ENTRANTE reciente): envía texto libre', async () => {
    prisma.whatsappMensaje.findFirst.mockResolvedValueOnce({ id: BigInt(1) });

    await servicio.avisar(77, 'LISTO');

    expect(mensajeria.enviarPlantilla).not.toHaveBeenCalled();
    expect(mensajeria.enviarTexto).toHaveBeenCalledWith('51987654321', expect.stringContaining('ya esta listo'), { pedidoId: BigInt(77) });
  });

  it('cliente con BAJA: no envía, deja el registro FALLIDO y no lanza error', async () => {
    prisma.clienteWhatsappConsentimiento.findUnique.mockResolvedValue({ acepta: false });

    const res = await servicio.avisar(77, 'SALIDA');

    expect(res.estado).toBe('FALLIDO');
    expect(mensajeria.enviarTexto).not.toHaveBeenCalled();
    expect(mensajeria.enviarPlantilla).not.toHaveBeenCalled();
    expect(prisma.mensajeReparto.update).toHaveBeenCalledWith(expect.objectContaining({ data: { estado: 'FALLIDO' } }));
  });

  it('pedidos que no son delivery o sin teléfono: se omiten sin registrar', async () => {
    pedido.modalidad = 'RECOJO';
    expect(await servicio.avisar(77, 'LISTO')).toEqual({ estado: 'OMITIDO', motivo: 'NO_ES_DELIVERY' });

    pedido.modalidad = 'DELIVERY';
    pedido.cliente_telefono = null;
    expect(await servicio.avisar(77, 'LISTO')).toEqual({ estado: 'OMITIDO', motivo: 'SIN_TELEFONO' });

    expect(prisma.mensajeReparto.create).not.toHaveBeenCalled();
  });

  it('un error inesperado no se propaga: el reparto sigue y el resultado es FALLIDO', async () => {
    prisma.pedido.findUnique.mockRejectedValueOnce(new Error('db caída'));

    const res = await servicio.avisar(77, 'LLEGADA');

    expect(res.estado).toBe('FALLIDO');
    expect(res.motivo).toBe('db caída');
  });

  it('retiro: la plantilla lleva el recargo en texto ("con un recargo de S/ 5.00" o "sin recargo")', async () => {
    await servicio.avisar(77, 'RETIRO', { recargo: 5 });
    expect(mensajeria.enviarPlantilla).toHaveBeenLastCalledWith(
      '51987654321',
      'caprichos_delivery_retiro',
      'es',
      ['Marta', 'CP-077', 'con un recargo de S/ 5.00'],
      { pedidoId: BigInt(77) },
    );

    await servicio.avisar(77, 'RETIRO', { recargo: 0 });
    expect(mensajeria.enviarPlantilla).toHaveBeenLastCalledWith(
      '51987654321',
      'caprichos_delivery_retiro',
      'es',
      ['Marta', 'CP-077', 'sin recargo'],
      { pedidoId: BigInt(77) },
    );
  });
});

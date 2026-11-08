jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn(),
  JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class MockJwtModule {} }) },
}));

import { MensajesService, estadoDe, tipoImagenReal } from './mensajes.service';
import { faltaProcesar, resolverPos, reabiertoTrasAtendido } from './utilidades/pos-chat.util';
import { WhatsAppMetaGateway } from './whatsapp-meta.gateway';

const ahora = Date.now();
const hace = (min: number) => new Date(ahora - min * 60000);
const base = (id: bigint, extra: any = {}) => ({
  id, telefono: `5199900000${id}`, party_id: null, duenio: 'BOT', urgente: false, estado: 'ABIERTA',
  tomado_por: null, ultima_actividad: hace(1), party: null, visto_en: null, marcado_no_visto: false,
  identificador_tipo: 'TELEFONO', atendido_en: null, atendido_por: null, flujo: null, mensajes: [], ...extra,
});
const msg = (autor: string, min: number) => ({
  autor, direccion: autor === 'CLIENTE' ? 'ENTRA' : 'SALE', tipo: 'TEXTO', contenido: { texto: 'x' }, en: hace(min),
});
const usuario = { partyId: 10n, rol: 'ADMIN', debeCambiar: false };
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

describe('Atendido: archivar y volver a Por atender', () => {
  it('estadoDe: archivado hasta que cliente o equipo escriben; el bot no lo reabre', () => {
    const c = { estado: 'ABIERTA', duenio: 'BOT', urgente: false, atendido_en: hace(10) };
    expect(estadoDe(c, false)).toBe('atendido');
    expect(estadoDe(c, true)).toBe('atencion');
    expect(estadoDe({ ...c, estado: 'VALIDAR_PAGO' }, true)).toBe('validar');
    const msgs = [msg('BOT', 5), msg('CLIENTE', 20)];
    expect(reabiertoTrasAtendido(c.atendido_en, msgs)).toBe(false);
    expect(reabiertoTrasAtendido(c.atendido_en, [msg('CLIENTE', 3)])).toBe(true);
    expect(reabiertoTrasAtendido(c.atendido_en, [msg('PERSONA', 3)])).toBe(true);
  });

  describe('servicio', () => {
    let prisma: any;
    let auditoria: any;
    let eventos: any;
    let service: MensajesService;
    let chats: any[];

    beforeEach(() => {
      chats = [
        base(1n, { mensajes: [msg('CLIENTE', 30)] }),
        base(2n, { atendido_en: hace(20), atendido_por: 7n, mensajes: [msg('CLIENTE', 60)] }),
        base(3n, { atendido_en: hace(20), atendido_por: 7n, mensajes: [msg('CLIENTE', 2)] }),
      ];
      prisma = {
        conversacion: {
          findMany: jest.fn().mockImplementation(() => Promise.resolve(chats)),
          findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(chats.find((c) => c.id === where.id) ?? null)),
          update: jest.fn().mockResolvedValue({}),
        },
        pedido: { findMany: jest.fn().mockResolvedValue([]) },
        userAccount: {
          findMany: jest.fn().mockResolvedValue([{ id: 7n, party: { persona: { nombres: 'Ana', apellidos: 'Ruiz' } } }]),
          findUnique: jest.fn().mockResolvedValue({ id: 7n }),
        },
      };
      auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
      eventos = { emitirAdmin: jest.fn() };
      service = new MensajesService(prisma, auditoria, { enviarTexto: jest.fn() } as any, eventos);
    });

    it('listar separa Por atender y Atendidos, con contadores y quién/cuándo; el reabierto vuelve solo', async () => {
      const r = await service.listar('atendidos');
      expect(r.chats.map((c) => c.id)).toEqual(['2']);
      expect(r.chats[0].atendidoPor).toBe('Ana Ruiz');
      expect(typeof r.chats[0].atendidoEn).toBe('string');
      expect(r.conteos.atendidos).toBe(1);
      // el 3 volvió porque el cliente escribió después: Por atender, sin ver
      expect(r.conteos.atender).toBe(1);
      const por = await service.listar('atender');
      expect(por.chats.map((c) => c.id)).toEqual(['3']);
      expect(por.chats[0].sinLeer).toBe(1);
      expect(por.chats[0].atendidoEn).toBeNull();
    });

    it('listar resuelve el punto de venta con UNA sola consulta de pedidos y filtra por faltan/procesados', async () => {
      prisma.pedido.findMany.mockResolvedValue([
        { id: 5n, codigo: 'CP-0005', estado: 'COLA', pago_estado: 'PAGADO', cliente_telefono: '999000001', creado_en: hace(5) },
      ]);
      const r = await service.listar('todos');
      expect(prisma.pedido.findMany).toHaveBeenCalledTimes(1);
      expect(r.chats.find((c) => c.id === '1')!.pos).toEqual({ estado: 'REGISTRADO', codigo: 'CP-0005', pedidoId: '5' });
      expect(r.chats.find((c) => c.id === '3')!.faltaProcesar).toBe(true);
      expect(r.conteos.faltanProcesar).toBe(2); // el archivado también: Atendido no es lo mismo que procesado en caja
      expect((await service.listar('todos', '', 'faltan')).chats.map((c) => c.id)).toEqual(['3']);
      expect((await service.listar('todos', '', 'procesados')).chats.map((c) => c.id)).toEqual(['1']);
    });

    it('marcarAtendido guarda atendido_en/por, deja visto y NO toca duenio ni tomado_por ni escribe al cliente', async () => {
      await expect(service.marcarAtendido('1', usuario)).resolves.toEqual({ ok: true });
      const data = prisma.conversacion.update.mock.calls[0][0].data;
      expect(data.atendido_en).toBeInstanceOf(Date);
      expect(data.atendido_por).toBe(7n);
      expect(data.marcado_no_visto).toBe(false);
      expect(data).not.toHaveProperty('duenio');
      expect(data).not.toHaveProperty('tomado_por');
      expect(eventos.emitirAdmin).toHaveBeenCalledWith('mensajes:actualizado', { id: '1' });
    });

    it('con pago por revisar o pedido sin cobrar pide confirmar; con confirmar archiva', async () => {
      chats[0].estado = 'VALIDAR_PAGO';
      await expect(service.marcarAtendido('1', usuario)).rejects.toMatchObject({ response: { codigo: 'ATENDIDO_REQUIERE_CONFIRMAR' } });
      expect(prisma.conversacion.update).not.toHaveBeenCalled();
      await service.marcarAtendido('1', usuario, undefined, true);
      expect(prisma.conversacion.update).toHaveBeenCalledTimes(1);

      chats[0].estado = 'ABIERTA';
      prisma.pedido.findMany.mockResolvedValue([
        { id: 6n, codigo: 'CP-0006', estado: 'COLA', pago_estado: 'PENDIENTE', cliente_telefono: '999000001', creado_en: hace(5) },
      ]);
      await expect(service.marcarAtendido('1', usuario)).rejects.toMatchObject({ response: { codigo: 'ATENDIDO_REQUIERE_CONFIRMAR' } });
    });

    it('volverPorAtender limpia atendido_* y lo deja en atención', async () => {
      await service.volverPorAtender('2', usuario);
      expect(prisma.conversacion.update.mock.calls[0][0].data).toMatchObject({ atendido_en: null, atendido_por: null, urgente: true });
    });
  });
});

describe('Procesado en el punto de venta (util)', () => {
  const pedido = (id: bigint, tel: string, extra: any = {}) => ({
    id, codigo: `CP-${id}`, estado: 'COLA', pago_estado: 'PENDIENTE', cliente_telefono: tel, creado_en: new Date(), ...extra,
  });
  it('liga por los últimos 9 dígitos, ignora anulados y distingue cobrado de sin cobrar', () => {
    const m = resolverPos(
      [{ id: 1n, telefono: '51999111222' }, { id: 2n, telefono: '51999333444' }, { id: 3n, telefono: '51999555666' }],
      [pedido(1n, '999111222', { pago_estado: 'PAGADO' }), pedido(2n, '999333444', { estado: 'ANULADO' }), pedido(3n, '999555666')],
    );
    expect(m.get(1n)!.estado).toBe('REGISTRADO');
    expect(m.get(2n)!.estado).toBe('SIN_PEDIDO');
    expect(m.get(3n)).toMatchObject({ estado: 'SIN_COBRAR', codigo: 'CP-3' });
  });
  it('el pedido ligado por el flujo del chat gana al del teléfono', () => {
    const m = resolverPos(
      [{ id: 1n, telefono: '51999111222', flujo: { pago: { pedidoId: '9' } } }],
      [pedido(1n, '999111222'), pedido(9n, '999000000')],
    );
    expect(m.get(1n)!.pedidoId).toBe('9');
  });
  it('falta procesar = sin pedido y el cliente escribió hoy', () => {
    expect(faltaProcesar({ estado: 'SIN_PEDIDO', codigo: null, pedidoId: null }, true)).toBe(true);
    expect(faltaProcesar({ estado: 'SIN_PEDIDO', codigo: null, pedidoId: null }, false)).toBe(false);
    expect(faltaProcesar({ estado: 'SIN_COBRAR', codigo: 'x', pedidoId: '1' }, true)).toBe(false);
  });
});

describe('Enviar imagen desde el admin', () => {
  let prisma: any;
  let gateway: any;
  let archivos: any;
  let service: MensajesService;
  const c = base(1n, { phone_number_id: 'PN1' });

  beforeEach(() => {
    prisma = {
      conversacion: { findUnique: jest.fn().mockResolvedValue(c), update: jest.fn().mockResolvedValue({}) },
      userAccount: { findUnique: jest.fn().mockResolvedValue({ id: 7n }) },
    };
    gateway = { enviarImagen: jest.fn().mockResolvedValue({ id: '88', estado: 'ENVIADO' }), enviarTexto: jest.fn() };
    archivos = { subirArchivo: jest.fn().mockResolvedValue({ id: 33 }) };
    service = new MensajesService(
      prisma,
      { registrar: jest.fn() } as any,
      gateway,
      { emitirAdmin: jest.fn() } as any,
      { esVentanaAbierta: jest.fn().mockResolvedValue(true) } as any,
      undefined,
      archivos,
    );
  });

  it('valida tipo real y tamaño en el servidor', async () => {
    const gif = Buffer.from('GIF89a....');
    await expect(service.enviarImagen('1', { buffer: gif, mimetype: 'image/jpeg' }, '', usuario)).rejects.toMatchObject({ response: { codigo: 'IMAGEN_TIPO' } });
    await expect(service.enviarImagen('1', { buffer: JPG, mimetype: 'image/png' }, '', usuario)).rejects.toMatchObject({ response: { codigo: 'IMAGEN_TIPO' } });
    const grande = Buffer.concat([JPG, Buffer.alloc(5 * 1024 * 1024)]);
    await expect(service.enviarImagen('1', { buffer: grande, mimetype: 'image/jpeg' }, '', usuario)).rejects.toMatchObject({ response: { codigo: 'IMAGEN_GRANDE' } });
    await expect(service.enviarImagen('1', undefined, '', usuario)).rejects.toMatchObject({ response: { codigo: 'IMAGEN_REQUERIDA' } });
    expect(gateway.enviarImagen).not.toHaveBeenCalled();
    expect(tipoImagenReal(JPG)).toBe('image/jpeg');
  });

  it('guarda la copia privada y envía por la pasarela con subtítulo y el número del chat', async () => {
    await expect(service.enviarImagen('1', { buffer: JPG, mimetype: 'image/jpeg' }, '  Así queda  ', usuario)).resolves.toEqual({ id: '88' });
    expect(archivos.subirArchivo).toHaveBeenCalledWith(expect.anything(), true);
    expect(gateway.enviarImagen).toHaveBeenCalledWith(1n, c.telefono, JPG, 'image/jpeg', 'Así queda', 'PERSONA', '33', 'PN1');
  });

  it('con la ventana de 24 h cerrada responde VENTANA_CERRADA (el front ofrece la plantilla)', async () => {
    (service as any).ventana24hService.esVentanaAbierta.mockResolvedValue(false);
    await expect(service.enviarImagen('1', { buffer: JPG, mimetype: 'image/jpeg' }, '', usuario)).rejects.toMatchObject({
      response: { codigo: 'VENTANA_CERRADA', plantillaReapertura: 'caprichos_reabrir_conversacion' },
    });
    expect(gateway.enviarImagen).not.toHaveBeenCalled();
  });
});

describe('WhatsAppMetaGateway.enviarImagen', () => {
  const armar = (modo: 'meta' | 'simulado', subir: any) => {
    const prisma: any = { mensajeChat: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 5n, en: new Date(), ...data })) } };
    const mensajeria: any = {
      estaConectado: () => ({ conectado: true, modo }),
      subirMedia: subir,
      enviarImagen: jest.fn().mockResolvedValue({ exito: true, id: '12', waMessageId: 'wamid.X', estado: 'ENVIADO' }),
    };
    return { prisma, mensajeria, gw: new WhatsAppMetaGateway(prisma, mensajeria) };
  };

  it('en Meta sube a la Media API y envía con el media id; guarda IMAGEN con el archivo', async () => {
    const { gw, prisma, mensajeria } = armar('meta', jest.fn().mockResolvedValue('MID1'));
    const r = await gw.enviarImagen(1n, '51999', JPG, 'image/jpeg', 'Hola', 'PERSONA', '33', 'PN1');
    expect(mensajeria.subirMedia).toHaveBeenCalledWith(JPG, 'image/jpeg', 'PN1');
    expect(mensajeria.enviarImagen).toHaveBeenCalledWith('51999', 'MID1', 'Hola', { conversacionId: 1n, phoneNumberId: 'PN1' });
    expect(prisma.mensajeChat.create.mock.calls[0][0].data).toMatchObject({ tipo: 'IMAGEN', contenido: { texto: 'Hola', archivoId: '33' }, meta_id: 'wamid.X' });
    expect(r.estado).toBe('ENVIADO');
  });

  it('si Meta no acepta la subida guarda FALLIDO sin enviar', async () => {
    const { gw, mensajeria } = armar('meta', jest.fn().mockResolvedValue(null));
    const r = await gw.enviarImagen(1n, '51999', JPG, 'image/jpeg', '', 'PERSONA', '33');
    expect(mensajeria.enviarImagen).not.toHaveBeenCalled();
    expect(r).toMatchObject({ estado: 'FALLIDO', errorCodigo: 'SUBIDA_MEDIA' });
  });
});

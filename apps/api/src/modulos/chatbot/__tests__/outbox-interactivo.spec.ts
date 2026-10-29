jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { OutboxWhatsappService } from '../servicios/outbox-whatsapp.service';
import { interactivoDesdeContenido, normalizarInteractivo, textoConVinetas } from '../servicios/interactivo.util';

const TEL = '51999111222';

describe('Outbox interactivo (botones y lista)', () => {
  let servicio: OutboxWhatsappService;
  let prisma: any;
  let ventana: any;
  let mensajeria: any;
  let filas: any[];

  const fila = (carga: any, extra: any = {}) => ({
    id: 1n, secuencia: 1n, telefono_destino: TEL, tipo: 'INTERACTIVO', carga,
    intentos: 0, max_intentos: 5, pedido_id: null, origen: 'TOPE_SIN_PAGAR', ...extra,
  });
  const botones = { textoLibre: 'Hola', autor: 'BOT', interactivo: { cuerpo: 'Hola', botones: [{ id: 'a', titulo: 'Uno' }, { id: 'b', titulo: 'Dos' }] } };
  const lista = { textoLibre: 'Elige', interactivo: { cuerpo: 'Elige', lista: { boton: 'Ver', secciones: [{ titulo: 'Menu', filas: [{ id: 'f1', titulo: 'Pollo', descripcion: 'Rico' }] }] } } };

  beforeEach(() => {
    filas = [];
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      $queryRaw: jest.fn(async () => { const f = filas; filas = []; prisma._lote = f; return f.map((x) => ({ id: x.id })); }),
      salienteWhatsapp: {
        createMany: jest.fn(async () => ({ count: 1 })),
        updateMany: jest.fn(async () => ({ count: 1 })),
        findMany: jest.fn(async () => prisma._lote),
        findFirst: jest.fn(async () => null),
      },
      parametro: { findUnique: jest.fn(async () => ({ valor: 5 })) },
      conversacion: { upsert: jest.fn(async () => ({ id: 5n })) },
      mensajeChat: { create: jest.fn(async () => ({})) },
      mensajeReparto: { updateMany: jest.fn() },
      notificacion: { create: jest.fn(async () => ({ id: 3n })) },
    };
    ventana = {
      tieneConsentimiento: jest.fn(async () => true),
      esVentanaAbierta: jest.fn(async () => true),
      enviarMensajeNegocio: jest.fn(async () => ({ exito: true, estado: 'SIMULADO', id: '9' })),
    };
    mensajeria = {
      enviarBotones: jest.fn(async () => ({ exito: true, estado: 'SIMULADO', waMessageId: 'wamid.b' })),
      enviarLista: jest.fn(async () => ({ exito: true, estado: 'SIMULADO', waMessageId: 'wamid.l' })),
    };
    servicio = new OutboxWhatsappService(prisma, ventana, mensajeria);
  });

  it('encola con tipo INTERACTIVO, clave de idempotencia y textoLibre = cuerpo', async () => {
    const ok = await servicio.encolar({ telefono: TEL, tipo: 'INTERACTIVO', clave: 'k1', origen: 'X', carga: botones as any });
    expect(ok).toBe(true);
    const data = prisma.salienteWhatsapp.createMany.mock.calls[0][0];
    expect(data.skipDuplicates).toBe(true);
    expect(data.data[0]).toMatchObject({ tipo: 'INTERACTIVO', clave_idempotencia: 'k1' });
    expect(data.data[0].carga.textoLibre).toBe('Hola');
  });

  it('duplicado (misma clave) no se encola dos veces', async () => {
    prisma.salienteWhatsapp.createMany.mockResolvedValueOnce({ count: 0 });
    expect(await servicio.encolar({ telefono: TEL, tipo: 'INTERACTIVO', clave: 'k1', origen: 'X', carga: botones as any })).toBe(false);
  });

  it('rechaza un interactivo sin botones ni filas', async () => {
    await expect(
      servicio.encolar({ telefono: TEL, tipo: 'INTERACTIVO', clave: 'k2', origen: 'X', carga: { textoLibre: 'x', interactivo: { cuerpo: 'x' } } as any }),
    ).rejects.toThrow();
  });

  it('con ventana abierta envía botones por el puerto y los registra en el chat como BOTON', async () => {
    filas = [fila(botones)];
    const r = await servicio.procesarLote();
    expect(r.enviados).toBe(1);
    expect(mensajeria.enviarBotones).toHaveBeenCalledWith(TEL, 'Hola', botones.interactivo.botones, expect.anything());
    const chat = prisma.mensajeChat.create.mock.calls[0][0].data;
    expect(chat.tipo).toBe('BOTON');
    expect(chat.contenido.botones).toEqual(botones.interactivo.botones);
    expect(chat.contenido.texto).toBe('Hola');
  });

  it('con ventana abierta envía la lista y la registra como LISTA con sus filas', async () => {
    filas = [fila(lista)];
    await servicio.procesarLote();
    expect(mensajeria.enviarLista).toHaveBeenCalledWith(
      TEL, 'Elige', 'Ver', [{ id: 'f1', titulo: 'Pollo', descripcion: 'Rico' }], expect.objectContaining({ tituloSeccion: 'Menu' }),
    );
    const chat = prisma.mensajeChat.create.mock.calls[0][0].data;
    expect(chat.tipo).toBe('LISTA');
    expect(chat.contenido.filas).toHaveLength(1);
    expect(chat.contenido.botonTexto).toBe('Ver');
  });

  it('fuera de la ventana de 24 h NO envía interactivo: degrada a texto con viñetas por el camino de TEXTO', async () => {
    ventana.esVentanaAbierta.mockResolvedValue(false);
    filas = [fila(botones)];
    await servicio.procesarLote();
    expect(mensajeria.enviarBotones).not.toHaveBeenCalled();
    expect(ventana.enviarMensajeNegocio).toHaveBeenCalledWith(
      TEL, expect.objectContaining({ textoLibre: 'Hola\n\n• Uno\n• Dos', botones: undefined }), expect.anything(),
    );
    expect(prisma.mensajeChat.create.mock.calls[0][0].data.tipo).toBe('TEXTO');
    expect(prisma.mensajeChat.create.mock.calls[0][0].data.contenido.degradado).toBe(true);
  });

  it('error temporal: vuelve a PENDIENTE con intento sumado; permanente: FALLIDO', async () => {
    mensajeria.enviarBotones.mockResolvedValueOnce({ exito: false, estado: 'FALLIDO', errorCodigo: 'TIMEOUT' });
    filas = [fila(botones)];
    const r1 = await servicio.procesarLote();
    expect(r1.reintentos).toBe(1);
    expect(prisma.salienteWhatsapp.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'PENDIENTE', intentos: 1 }) }),
    );

    mensajeria.enviarBotones.mockResolvedValueOnce({ exito: false, estado: 'FALLIDO', errorCodigo: 'NUMERO_INVALIDO' });
    filas = [fila(botones)];
    const r2 = await servicio.procesarLote();
    expect(r2.fallidos).toBe(1);
    expect(prisma.mensajeChat.create.mock.calls.pop()[0].data.tipo).toBe('SISTEMA');
  });

  it('cliente en BAJA: falla permanente sin enviar', async () => {
    ventana.tieneConsentimiento.mockResolvedValue(false);
    filas = [fila(botones)];
    const r = await servicio.procesarLote();
    expect(r.fallidos).toBe(1);
    expect(mensajeria.enviarBotones).not.toHaveBeenCalled();
  });

  it('el orden lo da la consulta por secuencia (misma que TEXTO): dos filas salen en el orden recibido', async () => {
    filas = [fila(botones, { id: 1n, secuencia: 1n }), fila(lista, { id: 2n, secuencia: 2n })];
    await servicio.procesarLote();
    expect(mensajeria.enviarBotones.mock.invocationCallOrder[0]).toBeLessThan(mensajeria.enviarLista.mock.invocationCallOrder[0]);
  });

  describe('normalizarInteractivo (truncado seguro)', () => {
    it('recorta botones a 3 y 20 caracteres, cuerpo a 1024', () => {
      const r = normalizarInteractivo({
        cuerpo: 'x'.repeat(2000),
        botones: [1, 2, 3, 4].map((n) => ({ id: `b${n}`, titulo: 'T'.repeat(30) })),
      });
      expect(r.cuerpo).toHaveLength(1024);
      expect(r.botones).toHaveLength(3);
      expect(r.botones![0].titulo).toHaveLength(20);
    });

    it('recorta lista: 10 filas, título 24, descripción 72, botón 20', () => {
      const r = normalizarInteractivo({
        cuerpo: 'c',
        lista: {
          boton: 'B'.repeat(40),
          secciones: [{ titulo: 'S', filas: Array.from({ length: 14 }, (_, i) => ({ id: `f${i}`, titulo: 'F'.repeat(40), descripcion: 'D'.repeat(100) })) }],
        },
      });
      const f = r.lista!.secciones[0].filas;
      expect(f).toHaveLength(10);
      expect(f[0].titulo).toHaveLength(24);
      expect(f[0].descripcion).toHaveLength(72);
      expect(r.lista!.boton).toHaveLength(20);
    });

    it('texto con viñetas para el degradado', () => {
      expect(textoConVinetas({ cuerpo: 'Hola', botones: [{ id: 'a', titulo: 'Uno' }] })).toBe('Hola\n\n• Uno');
    });
  });

  describe('interactivoDesdeContenido (repetir paso)', () => {
    it('reconstruye botones reales con el aviso delante', () => {
      const i = interactivoDesdeContenido({ texto: 'Elige', botones: [{ id: 'x', titulo: 'Si' }] }, 'Aviso');
      expect(i).toEqual({ cuerpo: 'Aviso\n\nElige', botones: [{ id: 'x', titulo: 'Si' }] });
    });
    it('reconstruye lista; sin botones ni filas devuelve null', () => {
      const i = interactivoDesdeContenido({ texto: 'Menu', botonTexto: 'Ver', filas: [{ id: 'f', titulo: 'Pollo' }] });
      expect(i?.lista?.secciones[0].filas).toEqual([{ id: 'f', titulo: 'Pollo' }]);
      expect(interactivoDesdeContenido({ texto: 'Solo texto' })).toBeNull();
    });
  });
});

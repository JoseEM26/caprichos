jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OutboxWhatsappService, clasificarFallo, esErrorPermanente } from '../servicios/outbox-whatsapp.service';

describe('OutboxWhatsappService (salientes de WhatsApp)', () => {
  let servicio: OutboxWhatsappService;
  let prisma: any;
  let ventana: any;
  let mensajeria: any;
  let auditoria: any;
  let parametros: Record<string, unknown>;
  let filasLote: any[];
  let enLote: any[];

  const fila = (extra: Partial<Record<string, unknown>> = {}) => ({
    id: BigInt(1),
    secuencia: BigInt(1),
    telefono_destino: '51999111222',
    tipo: 'TEXTO',
    carga: { textoLibre: 'Hola', plantillaClave: 'PEDIDO_LISTO_RECOJO', variablesPlantilla: ['Ana', 'CP-1'], autor: 'BOT' },
    intentos: 0,
    max_intentos: 5,
    pedido_id: BigInt(9),
    origen: 'AVISO_PEDIDO',
    creado_en: new Date(Date.now() - 60_000),
    ...extra,
  });

  beforeEach(() => {
    parametros = { outbox_max_intentos: 5, outbox_retencion_dias: 30, outbox_retencion_fallidos_dias: 90, outbox_alerta_fallidos: 'si', outbox_lag_alerta_min: 5 };
    filasLote = [fila()];
    enLote = [];
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      // Cada fila se entrega una sola vez (en la BD, al marcarse ENVIANDO deja de ser PENDIENTE)
      $queryRaw: jest.fn(async () => {
        enLote = filasLote;
        filasLote = [];
        return enLote.map((f) => ({ id: f.id }));
      }),
      $executeRaw: jest.fn(async () => 0),
      salienteWhatsapp: {
        createMany: jest.fn(async () => ({ count: 1 })),
        updateMany: jest.fn(async () => ({ count: 1 })),
        update: jest.fn(async () => ({})),
        findMany: jest.fn(async () => enLote),
        findUnique: jest.fn(async () => ({ estado: 'FALLIDO' })),
        findFirst: jest.fn(async () => null),
        count: jest.fn(async () => 0),
        groupBy: jest.fn(async () => []),
      },
      parametro: {
        findUnique: jest.fn(async ({ where }: any) => ({ valor: parametros[where.clave] })),
      },
      conversacion: { upsert: jest.fn(async () => ({ id: BigInt(5) })) },
      whatsappMensaje: { findMany: jest.fn(async () => []) },
      mensajeChat: { create: jest.fn(async () => ({})) },
      mensajeReparto: { updateMany: jest.fn(async () => ({ count: 1 })) },
      notificacion: { create: jest.fn(async () => ({ id: BigInt(3) })) },
    };
    ventana = {
      enviarMensajeNegocio: jest.fn(async () => ({ exito: true, estado: 'SIMULADO', id: '77', waMessageId: 'wamid.x' })),
      tieneConsentimiento: jest.fn(async () => true),
    };
    mensajeria = { enviarPlantilla: jest.fn() };
    auditoria = { registrar: jest.fn(async () => undefined) };
    servicio = new OutboxWhatsappService(prisma, ventana, mensajeria, undefined, auditoria);
  });

  const datos = {
    telefono: '51999111222',
    tipo: 'TEXTO' as const,
    clave: 'pedido-9-LISTO',
    origen: 'AVISO_PEDIDO',
    pedidoId: BigInt(9),
    carga: { textoLibre: 'Hola' },
  };

  describe('encolar', () => {
    it('inserta con la clave de idempotencia y el máximo de intentos del parámetro', async () => {
      const nuevo = await servicio.encolar(datos);
      expect(nuevo).toBe(true);
      expect(prisma.salienteWhatsapp.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ clave_idempotencia: 'pedido-9-LISTO', max_intentos: 5, origen: 'AVISO_PEDIDO', pedido_id: BigInt(9) })],
        skipDuplicates: true,
      });
    });

    it('idempotente: si la clave ya existe no duplica y devuelve false', async () => {
      prisma.salienteWhatsapp.createMany.mockResolvedValueOnce({ count: 0 });
      expect(await servicio.encolar(datos)).toBe(false);
    });

    it('con tx usa el cliente de la transacción (mismo commit que el cambio de estado)', async () => {
      const tx = { salienteWhatsapp: { createMany: jest.fn(async () => ({ count: 1 })) } };
      await servicio.encolar(datos, tx as any);
      expect(tx.salienteWhatsapp.createMany).toHaveBeenCalled();
      expect(prisma.salienteWhatsapp.createMany).not.toHaveBeenCalled();
    });
  });

  describe('procesarLote', () => {
    it('envío exitoso: una sola actualización a ENVIADO con wa_message_id, y registra en mensaje_chat', async () => {
      const r = await servicio.procesarLote();
      expect(r.enviados).toBe(1);
      expect(ventana.enviarMensajeNegocio).toHaveBeenCalledWith('51999111222', expect.any(Object), expect.any(Object));
      expect(prisma.salienteWhatsapp.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: BigInt(1), intento_token: expect.any(String) }),
          data: expect.objectContaining({ estado: 'ENVIADO', wa_message_id: 'wamid.x', intento_token: null }),
        }),
      );
      expect(prisma.mensajeChat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ direccion: 'SALE', autor: 'BOT', tipo: 'TEXTO' }),
      });
    });

    it('error temporal: vuelve a PENDIENTE con espera de 30 s y un intento', async () => {
      ventana.enviarMensajeNegocio.mockResolvedValueOnce({ exito: false, estado: 'FALLIDO', errorCodigo: 'LIMITE_TASA_EXCEDIDO', errorDetalle: '429' });
      const antes = Date.now();
      const r = await servicio.procesarLote();
      expect(r.reintentos).toBe(1);
      const data = prisma.salienteWhatsapp.updateMany.mock.calls.at(-1)[0].data;
      expect(data).toEqual(expect.objectContaining({ estado: 'PENDIENTE', intentos: 1 }));
      expect(data.proximo_intento_en.getTime() - antes).toBeGreaterThanOrEqual(30_000 - 50);
      expect(data.proximo_intento_en.getTime() - antes).toBeLessThan(30_000 + 5_000);
      expect(prisma.mensajeChat.create).not.toHaveBeenCalled();
    });

    it('error permanente (número inválido): FALLIDO sin reintentar y con aviso a Caja y Admin', async () => {
      ventana.enviarMensajeNegocio.mockResolvedValueOnce({ exito: false, estado: 'FALLIDO', errorCodigo: 'NUMERO_INVALIDO', errorDetalle: 'x' });
      const r = await servicio.procesarLote();
      expect(r.fallidos).toBe(1);
      expect(prisma.salienteWhatsapp.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: 'FALLIDO', ultimo_error: '[NUMERO_INVALIDO] x' }) }),
      );
      const roles = prisma.notificacion.create.mock.calls.map((c: any) => c[0].data.rol_destino);
      expect(roles).toEqual(['CAJERO', 'ADMIN']);
    });

    it('cliente en BAJA: FALLIDO pero sin aviso (es un resultado esperado)', async () => {
      ventana.enviarMensajeNegocio.mockResolvedValueOnce({ exito: false, estado: 'FALLIDO', errorCodigo: 'CLIENTE_BAJA', errorDetalle: 'BAJA' });
      await servicio.procesarLote();
      expect(prisma.notificacion.create).not.toHaveBeenCalled();
    });

    it('error temporal al agotar intentos: pasa a FALLIDO', async () => {
      filasLote = [fila({ intentos: 4 })];
      ventana.enviarMensajeNegocio.mockResolvedValueOnce({ exito: false, estado: 'FALLIDO', errorCodigo: 'ERROR_SERVIDOR_META' });
      const r = await servicio.procesarLote();
      expect(r.fallidos).toBe(1);
      expect(prisma.salienteWhatsapp.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: 'FALLIDO', intentos: 5 }) }),
      );
    });

    it('fila que ya agotó intentos (proceso caído en cada envío) no vuelve a salir', async () => {
      filasLote = [fila({ intentos: 5, max_intentos: 5 })];
      await servicio.procesarLote();
      expect(ventana.enviarMensajeNegocio).not.toHaveBeenCalled();
      expect(prisma.salienteWhatsapp.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: 'FALLIDO', ultimo_error: 'Intentos agotados' }) }),
      );
    });

    it('toma las filas con FOR UPDATE SKIP LOCKED dentro de una transacción y respeta el orden por secuencia', async () => {
      filasLote = [];
      await servicio.procesarLote();
      const sql = prisma.$queryRaw.mock.calls[0];
      const texto = sql[0].join(' ');
      expect(texto).toContain('FOR UPDATE SKIP LOCKED');
      expect(texto).toContain('ORDER BY s."secuencia"');
      // Un mensaje espera si un anterior del mismo destino y pedido sigue PENDIENTE o ENVIANDO
      expect(texto).toContain('NOT EXISTS');
      expect(texto).toContain("'PENDIENTE', 'ENVIANDO'");
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('no pisa el estado si otro proceso ya recuperó el intento (token distinto)', async () => {
      // ENVIADO llega con un token que ya no es el del intento: no cuenta
      prisma.salienteWhatsapp.updateMany.mockImplementation(async ({ data }: any) =>
        ({ count: data.estado === 'ENVIADO' ? 0 : 1 }),
      );
      const r = await servicio.procesarLote();
      expect(r.enviados).toBe(0);
      expect(prisma.mensajeChat.create).not.toHaveBeenCalled();
    });
  });

  describe('recuperación de huérfanos', () => {
    it('ENVIANDO con wa_message_id pasa a ENVIADO y no se reenvía; sin wa_message_id vuelve a PENDIENTE contando un intento', async () => {
      await servicio.procesarLote();
      const llamadas = prisma.salienteWhatsapp.updateMany.mock.calls.map((c: any) => c[0]);
      const conId = llamadas.find((c: any) => c.where.wa_message_id && c.where.wa_message_id.not === null);
      const sinId = llamadas.find((c: any) => c.where.wa_message_id === null);
      expect(conId.data.estado).toBe('ENVIADO');
      expect(sinId.data).toEqual(expect.objectContaining({ estado: 'PENDIENTE', intentos: { increment: 1 } }));
    });
  });

  describe('reenviar y descartar', () => {
    it('reenviar: FALLIDO vuelve a PENDIENTE con intentos en cero y queda auditado', async () => {
      await servicio.reenviar('1', { partyId: 7 });
      expect(prisma.salienteWhatsapp.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: expect.objectContaining({ estado: 'PENDIENTE', intentos: 0 }),
      });
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'reenviar', partyId: BigInt(7) }));
    });

    it('descartar: queda DESCARTADO con motivo y quién lo hizo, sin borrar', async () => {
      await servicio.descartar('1', 'Cliente ya recibió el aviso por llamada', { partyId: 7, nombre: 'Caja' });
      expect(prisma.salienteWhatsapp.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: expect.objectContaining({ estado: 'DESCARTADO', motivo_descarte: 'Cliente ya recibió el aviso por llamada', descartado_por: 'Caja' }),
      });
      expect(prisma.salienteWhatsapp.delete).toBeUndefined();
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'descartar' }));
    });

    it('solo se puede reenviar o descartar un FALLIDO', async () => {
      prisma.salienteWhatsapp.findUnique.mockResolvedValueOnce({ estado: 'ENVIADO' });
      await expect(servicio.reenviar('1')).rejects.toBeInstanceOf(ConflictException);
      prisma.salienteWhatsapp.findUnique.mockResolvedValueOnce(null);
      await expect(servicio.descartar('2', 'motivo válido')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('limpiar', () => {
    it('borra por lotes: ENVIADO viejos y DESCARTADO viejos con tope por corrida, nunca FALLIDO', async () => {
      await servicio.limpiar(new Date());
      const sqls = prisma.$executeRaw.mock.calls.map((c: any) => c[0].join(' '));
      expect(sqls).toHaveLength(2);
      expect(sqls[0]).toContain("'ENVIADO'");
      expect(sqls[0]).toContain('LIMIT');
      expect(sqls[1]).toContain("'DESCARTADO'");
      expect(sqls.join(' ')).not.toContain("'FALLIDO'");
    });
  });

  describe('resumen y lag', () => {
    it('el lag es la antigüedad del PENDIENTE más viejo y dispara la alerta sobre el umbral', async () => {
      const hace10min = new Date(Date.now() - 10 * 60_000);
      prisma.salienteWhatsapp.groupBy.mockResolvedValueOnce([{ estado: 'PENDIENTE', _count: { _all: 3 } }, { estado: 'FALLIDO', _count: { _all: 1 } }]);
      prisma.salienteWhatsapp.findFirst.mockResolvedValueOnce({ creado_en: hace10min });
      const r = await servicio.resumen();
      expect(r.pendientes).toBe(3);
      expect(r.fallidos).toBe(1);
      expect(r.lagSegundos).toBeGreaterThanOrEqual(600);
      expect(r.lagAlertaMin).toBe(5);
      expect(r.lagAlerta).toBe(true);
    });

    it('sin PENDIENTE el lag es cero y no hay alerta', async () => {
      const r = await servicio.resumen();
      expect(r.lagSegundos).toBe(0);
      expect(r.lagAlerta).toBe(false);
    });
  });

  describe('vista para el personal: códigos de cuenta', () => {
    const textoCodigo = 'Tu código para crear tu cuenta en Caprichos es 482913. Vence en 10 minutos. Si no lo pediste, ignora este mensaje.';
    const filaCodigo = (extra: Partial<Record<string, unknown>> = {}) =>
      fila({
        origen: 'CODIGO_CUENTA',
        tipo: 'TEXTO',
        carga: { textoLibre: textoCodigo, plantillaClave: 'CODIGO_CUENTA', variablesPlantilla: ['482913'], autor: 'BOT' },
        ...extra,
      });

    it('listar por origen: el texto va con los dígitos enmascarados y el canal sale de whatsapp_mensaje', async () => {
      prisma.salienteWhatsapp.findMany.mockResolvedValueOnce([filaCodigo({ estado: 'ENVIADO', wa_message_id: 'wamid.c', intentos: 1 })]);
      prisma.whatsappMensaje.findMany.mockResolvedValueOnce([{ wa_message_id: 'wamid.c', tipo: 'PLANTILLA', plantilla: 'codigo_cuenta' }]);
      const r = await servicio.listar('ENVIADO', 1, 20, 'CODIGO_CUENTA');

      expect(prisma.salienteWhatsapp.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { estado: 'ENVIADO', origen: 'CODIGO_CUENTA' } }));
      const f = r.filas[0];
      expect(f.texto).toBe('Tu código para crear tu cuenta en Caprichos es ••••••. Vence en 10 minutos. Si no lo pediste, ignora este mensaje.');
      expect(f.proposito).toBe('REGISTRO');
      expect(f.canal).toEqual({ tipo: 'PLANTILLA', plantilla: 'codigo_cuenta' });
      expect(JSON.stringify(r)).not.toContain('482913');
    });

    it('recuperar contraseña se distingue y sin canal registrado queda null', async () => {
      prisma.salienteWhatsapp.findMany.mockResolvedValueOnce([
        filaCodigo({ estado: 'FALLIDO', ultimo_error: '[NUMERO_INVALIDO] mal', carga: { textoLibre: 'Tu código de Caprichos es 111222. Vence en 10 minutos.', plantillaClave: 'CODIGO_RECUPERAR', variablesPlantilla: ['111222'] } }),
      ]);
      const r = await servicio.listar(undefined, 1, 20, 'CODIGO_CUENTA');
      expect(prisma.salienteWhatsapp.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { origen: 'CODIGO_CUENTA' } }));
      expect(r.filas[0].proposito).toBe('RECUPERAR');
      expect(r.filas[0].canal).toBeNull();
      expect(r.filas[0].texto).toBe('Tu código de Caprichos es ••••••. Vence en 10 minutos.');
    });

    it('un aviso normal no se enmascara', async () => {
      prisma.salienteWhatsapp.findMany.mockResolvedValueOnce([fila({ estado: 'FALLIDO', carga: { textoLibre: 'Tu pedido 123456 está listo' } })]);
      const r = await servicio.listar('FALLIDO');
      expect(r.filas[0].texto).toBe('Tu pedido 123456 está listo');
      expect(r.filas[0].proposito).toBeNull();
    });

    it('el chat del personal tampoco muestra el código al enviarlo', async () => {
      filasLote = [filaCodigo()];
      await servicio.procesarLote();
      expect(prisma.mensajeChat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ contenido: expect.objectContaining({ texto: expect.stringContaining('••••••') }) }),
      });
      expect(JSON.stringify(prisma.mensajeChat.create.mock.calls, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('482913');
    });
  });

  describe('clasificación de fallos', () => {
    it('permanente, agotado y temporal', () => {
      expect(esErrorPermanente('NUMERO_INVALIDO')).toBe(true);
      expect(esErrorPermanente('LIMITE_TASA_EXCEDIDO')).toBe(false);
      expect(clasificarFallo('PLANTILLA_NO_APROBADA', false)).toBe('PERMANENTE');
      expect(clasificarFallo('ERROR_SERVIDOR_META', true)).toBe('AGOTADO');
      expect(clasificarFallo('ERROR_RED_META', false)).toBe('TEMPORAL');
    });
  });
});

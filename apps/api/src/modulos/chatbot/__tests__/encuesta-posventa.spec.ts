jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

// Calificación de la encuesta posventa que llega por WhatsApp:
// webhook real -> procesarPosibleEncuesta -> (encuesta, queja, campana, outbox, chat) -> bot o no.
// Simulados: la base de datos (en memoria), el puerto de mensajería, el outbox y el aviso a administradores.

import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';

const TEL = '51987654321';
const DIA = 24 * 60 * 60 * 1000;

type EncuestaFila = {
  id: bigint;
  pedido_id: bigint;
  estado: string;
  enviada_en: Date;
  puntaje: number | null;
  motivo_codigo?: string | null;
  motivo_texto?: string | null;
  motivo_preguntado_en?: Date | null;
  pedido: { id: bigint; codigo: string; cliente_nombre: string; cliente_telefono: string };
};

const payloadTexto = (texto: string, from = TEL) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      changes: [
        {
          value: {
            contacts: [{ wa_id: from, profile: { name: 'José Ángel' } }],
            messages: [{ id: `wamid.${Math.random().toString(36).slice(2)}`, from, type: 'text', text: { body: texto } }],
          },
        },
      ],
    },
  ],
});

const payloadBoton = (payload: string, titulo: string, from = TEL) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      changes: [
        {
          value: {
            contacts: [{ wa_id: from, profile: { name: 'José Ángel' } }],
            messages: [
              {
                id: `wamid.${Math.random().toString(36).slice(2)}`,
                from,
                type: 'interactive',
                interactive: { type: 'button_reply', button_reply: { id: payload, title: titulo } },
              },
            ],
          },
        },
      ],
    },
  ],
});

// Botón de una plantilla de Meta (quick reply): type 'button'. Con payload (el que mandamos) o solo con el texto.
const payloadBotonPlantilla = (titulo: string, payload: string | null, from = TEL) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      changes: [
        {
          value: {
            contacts: [{ wa_id: from, profile: { name: 'José Ángel' } }],
            messages: [
              {
                id: `wamid.${Math.random().toString(36).slice(2)}`,
                from,
                type: 'button',
                button: payload === null ? { text: titulo } : { payload, text: titulo },
              },
            ],
          },
        },
      ],
    },
  ],
});

const flush = () => new Promise((r) => setTimeout(r, 10));

describe('Calificación de la encuesta posventa por WhatsApp', () => {
  let webhook: WhatsappWebhookService;
  let encuestas: EncuestaFila[];
  let pedidos: { id: bigint; codigo: string; cliente_telefono: string; cliente_nombre: string; creado_en: Date }[];
  let quejas: any[];
  let notificaciones: any[];
  let conversacion: any;
  let parametros: Record<string, unknown>;
  let mensajeria: any;
  let motor: any;
  let outbox: any;
  let avisos: any;
  let eventos: any;
  let prisma: any;

  const coincide = (valor: string | null | undefined, filtro: any) =>
    !filtro || (valor ?? '').includes(String(filtro.contains));

  const encuestaQueCumple = (e: EncuestaFila, where: any) => {
    if (!where) return true;
    if (where.estado && e.estado !== where.estado) return false;
    if (where.enviada_en?.gte && e.enviada_en < where.enviada_en.gte) return false;
    if (where.motivo_preguntado_en?.gte && !(e.motivo_preguntado_en && e.motivo_preguntado_en >= where.motivo_preguntado_en.gte)) return false;
    if (where.OR && !where.OR.some((o: any) => Object.entries(o).every(([k, v]) => ((e as any)[k] ?? null) === v))) return false;
    if (where.pedido?.cliente_telefono && !coincide(e.pedido.cliente_telefono, where.pedido.cliente_telefono)) return false;
    return true;
  };

  beforeEach(() => {
    const ahora = Date.now();
    pedidos = [
      { id: 10n, codigo: 'CP-W100', cliente_telefono: TEL, cliente_nombre: 'José Ángel', creado_en: new Date(ahora - 3 * DIA) },
      // Pedido más reciente del mismo teléfono, sin encuesta (el caso que rompía la búsqueda)
      { id: 20n, codigo: 'CP-W114', cliente_telefono: TEL, cliente_nombre: 'José Ángel', creado_en: new Date(ahora - 1 * 3600_000) },
    ];
    encuestas = [
      {
        id: 1n,
        pedido_id: 10n,
        estado: 'ENVIADA',
        enviada_en: new Date(ahora - 2 * DIA),
        puntaje: null,
        pedido: { id: 10n, codigo: 'CP-W100', cliente_nombre: 'José Ángel', cliente_telefono: TEL },
      },
    ];
    quejas = [];
    notificaciones = [];
    parametros = {};
    conversacion = {
      id: 42n,
      telefono: TEL,
      duenio: 'BOT',
      tomado_por: null,
      estado: 'ABIERTA',
      flujo: null,
      nombre_contacto: 'José Ángel',
      nombre_editado: false,
    };

    prisma = {
      whatsappMensaje: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      clienteWhatsappConsentimiento: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      pedido: {
        findFirst: jest.fn(async ({ where }: any) => {
          const lista = pedidos
            .filter((p) => coincide(p.cliente_telefono, where?.OR?.[0]?.cliente_telefono))
            .sort((a, b) => b.creado_en.getTime() - a.creado_en.getTime());
          return lista[0] ?? null;
        }),
        findUnique: jest.fn(async ({ where }: any) => pedidos.find((p) => p.id === where.id) ?? null),
      },
      conversacion: {
        findUnique: jest.fn(async () => conversacion),
        create: jest.fn(async ({ data }: any) => ({ id: 42n, ...data })),
        update: jest.fn(async ({ data }: any) => {
          conversacion = { ...conversacion, ...data };
          return conversacion;
        }),
      },
      mensajeChat: { create: jest.fn().mockResolvedValue({ id: 99n }) },
      encuestaPosventa: {
        findUnique: jest.fn(async ({ where }: any) => encuestas.find((e) => e.pedido_id === where.pedido_id) ?? null),
        findFirst: jest.fn(async ({ where }: any) => {
          const lista = encuestas
            .filter((e) => encuestaQueCumple(e, where))
            .sort((a, b) => b.enviada_en.getTime() - a.enviada_en.getTime());
          return lista[0] ?? null;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const e = encuestas.find(
            (x) =>
              x.id === where.id &&
              (!where.estado || x.estado === where.estado) &&
              (where.motivo_codigo === undefined || (x.motivo_codigo ?? null) === where.motivo_codigo) &&
              (!where.OR || where.OR.some((o: any) => Object.entries(o).every(([k, v]) => ((x as any)[k] ?? null) === v))),
          );
          if (!e) return { count: 0 };
          Object.assign(e, data);
          return { count: 1 };
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const e = encuestas.find((x) => x.id === where.id);
          Object.assign(e!, data);
          return e;
        }),
      },
      quejaWhatsapp: {
        create: jest.fn(async ({ data }: any) => {
          const fila = { id: BigInt(quejas.length + 1), ...data };
          quejas.push(fila);
          return fila;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const m = quejas.filter((q) => q.pedido_id === where.pedido_id && q.origen === where.origen);
          m.forEach((q) => Object.assign(q, data));
          return { count: m.length };
        }),
      },
      notificacion: {
        create: jest.fn(async ({ data }: any) => {
          const fila = { id: BigInt(notificaciones.length + 1), en: new Date(), ...data };
          notificaciones.push(fila);
          return fila;
        }),
      },
      parametro: {
        findUnique: jest.fn(async ({ where }: any) =>
          where.clave in parametros ? { clave: where.clave, valor: parametros[where.clave] } : null,
        ),
      },
    };
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));

    mensajeria = {
      enviarTexto: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO' }),
      enviarBotones: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO' }),
    };
    motor = { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) };
    outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    avisos = {
      avisarCalificacionBaja: jest.fn().mockResolvedValue(undefined),
      procesarAccionEquipo: jest.fn().mockResolvedValue({ procesado: false }),
    };
    eventos = { emitirAdmin: jest.fn() };

    const config = { get: (_c: string, def?: any) => def } as unknown as ConfigService;

    webhook = new WhatsappWebhookService(
      config,
      prisma,
      mensajeria as any,
      {} as any,
      eventos as any,
      motor as any,
      avisos as any,
      undefined,
      undefined,
      outbox as any,
    );
  });

  const recibir = async (payload: any) => {
    await webhook.procesarPayload(payload);
    await flush();
  };

  it('"1 Malo" con la encuesta del pedido anterior aunque haya un pedido más reciente: queda RESPONDIDA con puntaje 1', async () => {
    await recibir(payloadTexto('1 Malo'));

    expect(encuestas[0]).toMatchObject({ estado: 'RESPONDIDA', puntaje: 1 });
    expect(quejas).toHaveLength(1);
    expect(quejas[0]).toMatchObject({ pedido_id: 10n, puntaje: 1, origen: 'ENCUESTA' });
  });

  it('calificación baja: notifica a ADMIN y CAJERO con título, código, puntaje y enlace a Mensajes', async () => {
    await recibir(payloadTexto('1 Malo'));

    expect(notificaciones).toHaveLength(1);
    expect(notificaciones[0]).toMatchObject({
      tipo: 'QUEJA_WHATSAPP',
      rol_destino: 'CAJERO',
      titulo: 'Calificación baja: 1/5 · CP-W100 · José Ángel',
      enlace: `/admin/mensajes?telefono=${TEL.slice(-9)}`,
    });
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('notificaciones:nueva', expect.objectContaining({ titulo: notificaciones[0].titulo }));
  });

  it('calificación baja: el chat pasa a una persona y el bot no contesta "Ya avisé a una persona"', async () => {
    await recibir(payloadTexto('1 Malo'));

    expect(conversacion).toMatchObject({ duenio: 'PERSONA', urgente: true, motivo_derivacion: 'CALIFICACION_BAJA' });
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    expect(mensajeria.enviarTexto).not.toHaveBeenCalled();
  });

  it('calificación baja: primero va la pregunta del motivo (lista) por el outbox con clave idempotente', async () => {
    await recibir(payloadTexto('1 Malo'));

    expect(outbox.encolar).toHaveBeenCalledTimes(1);
    const [datos] = outbox.encolar.mock.calls[0];
    expect(datos).toMatchObject({ telefono: TEL, tipo: 'TEXTO', clave: 'encuesta-1-MOTIVO', origen: 'ENCUESTA', pedidoId: 10n });
    expect(datos.carga.textoLibre).toContain('José Ángel');
    expect(datos.carga.textoLibre).toContain('CP-W100');
    expect(datos.carga.lista.filas.map((f: any) => f.id)).toEqual([
      'motivo:DEMORA', 'motivo:MAL_ESTADO', 'motivo:INCOMPLETO', 'motivo:ATENCION', 'motivo:PRECIO', 'motivo:OTRO',
    ]);
    expect(datos.carga.lista.filas.every((f: any) => f.titulo.length <= 24)).toBe(true);
    expect(encuestas[0].motivo_preguntado_en).toBeInstanceOf(Date);
    expect(outbox.despertar).toHaveBeenCalled();
  });

  it('calificación baja: avisa a administradores una sola vez por calificación', async () => {
    await recibir(payloadTexto('1 Malo'));

    expect(avisos.avisarCalificacionBaja).toHaveBeenCalledTimes(1);
    expect(avisos.avisarCalificacionBaja).toHaveBeenCalledWith(
      expect.objectContaining({ encuestaId: 1n, codigo: 'CP-W100', puntaje: 1, cliente: 'José Ángel' }),
    );
  });

  it('la respuesta consumida no dispara el bot ni se repite si llega otra vez', async () => {
    await recibir(payloadTexto('1 Malo'));
    // La respuesta de la encuesta no pasa por el bot
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    // Si llega otra vez, ya es un mensaje normal: el chat derivado sin persona lo evalúa el modo asistido del motor
    // (responde o deja el silencio registrado), pero no repite la queja ni el aviso.
    await recibir(payloadTexto('1 Malo'));
    expect(quejas).toHaveLength(1);
    expect(notificaciones).toHaveLength(1);
    expect(avisos.avisarCalificacionBaja).toHaveBeenCalledTimes(1);
  });

  it('"encuesta:1" del botón se reconoce igual que el texto', async () => {
    await recibir(payloadBoton('encuesta:1', '1 Malo'));

    expect(encuestas[0]).toMatchObject({ estado: 'RESPONDIDA', puntaje: 1 });
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
  });

  it('botón de plantilla con payload "encuesta:1" cuenta 1 y abre queja', async () => {
    await recibir(payloadBotonPlantilla('1 Malo', 'encuesta:1'));

    expect(encuestas[0]).toMatchObject({ estado: 'RESPONDIDA', puntaje: 1 });
    expect(quejas).toHaveLength(1);
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
  });

  it('botón de plantilla sin payload: el texto "3 Regular" cuenta 3 (sin queja)', async () => {
    await recibir(payloadBotonPlantilla('3 Regular', null));

    expect(encuestas[0]).toMatchObject({ estado: 'RESPONDIDA', puntaje: 3 });
    expect(quejas).toHaveLength(0);
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
  });

  it('botón de plantilla con payload "encuesta:5" y texto "5 Excelente" cuenta 5', async () => {
    await recibir(payloadBotonPlantilla('5 Excelente', 'encuesta:5'));

    expect(encuestas[0]).toMatchObject({ estado: 'RESPONDIDA', puntaje: 5 });
    expect(outbox.encolar.mock.calls[0][0].clave).toBe('encuesta-1-GRACIAS');
  });

  it('"5 Excelente" es calificación 5: agradecimiento sin queja ni alerta a administradores', async () => {
    await recibir(payloadTexto('5 Excelente'));

    expect(encuestas[0]).toMatchObject({ estado: 'RESPONDIDA', puntaje: 5 });
    expect(quejas).toHaveLength(0);
    expect(notificaciones).toHaveLength(0);
    expect(avisos.avisarCalificacionBaja).not.toHaveBeenCalled();
    expect(outbox.encolar.mock.calls[0][0].clave).toBe('encuesta-1-GRACIAS');
    expect(outbox.encolar.mock.calls[0][0].carga.textoLibre).not.toMatch(/persona te escribir/);
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
  });

  it('"3" y "3 Regular" son calificación media: pregunta el motivo sin queja ni derivación', async () => {
    await recibir(payloadTexto('3'));
    expect(encuestas[0]).toMatchObject({ estado: 'RESPONDIDA', puntaje: 3 });
    expect(quejas).toHaveLength(0);
    expect(outbox.encolar.mock.calls[0][0].clave).toBe('encuesta-1-MOTIVO');
    expect(notificaciones).toHaveLength(0);
    expect(avisos.avisarCalificacionBaja).not.toHaveBeenCalled();
    expect(conversacion.duenio).toBe('BOT');
  });

  // La encuesta pendiente es del pedido más reciente: así el reconocimiento laxo se ve en acción
  const encuestaEnPedidoReciente = () => {
    encuestas[0].pedido_id = 20n;
    encuestas[0].pedido = { id: 20n, codigo: 'CP-W114', cliente_nombre: 'José Ángel', cliente_telefono: TEL };
  };

  it('"tengo 1 pregunta" con encuesta pendiente NO es una calificación: el bot responde y la encuesta sigue ENVIADA', async () => {
    encuestaEnPedidoReciente();
    await recibir(payloadTexto('tengo 1 pregunta'));

    expect(encuestas[0]).toMatchObject({ estado: 'ENVIADA', puntaje: null });
    expect(quejas).toHaveLength(0);
    expect(motor.procesarMensajeEntrante).toHaveBeenCalledTimes(1);
  });

  it('un número de teléfono no es una calificación', async () => {
    encuestaEnPedidoReciente();
    await recibir(payloadTexto('987654321 quiero mi pedido'));

    expect(encuestas[0].estado).toBe('ENVIADA');
    expect(motor.procesarMensajeEntrante).toHaveBeenCalledTimes(1);
  });

  it('"2 Regular" (número y palabra que no coinciden) no se acepta como calificación', async () => {
    encuestaEnPedidoReciente();
    await recibir(payloadTexto('2 Regular'));

    expect(encuestas[0].estado).toBe('ENVIADA');
    expect(motor.procesarMensajeEntrante).toHaveBeenCalledTimes(1);
  });

  it('"Muy bueno" y "bueno" con encuesta pendiente son calificación 4', async () => {
    encuestaEnPedidoReciente();
    await recibir(payloadTexto('Muy bueno'));

    expect(encuestas[0]).toMatchObject({ estado: 'RESPONDIDA', puntaje: 4 });
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
  });

  it('sin encuesta pendiente (la más reciente ya fue respondida o caducó) el mensaje va al bot', async () => {
    encuestas[0].enviada_en = new Date(Date.now() - 30 * DIA);

    await recibir(payloadTexto('1 Malo'));

    expect(encuestas[0].estado).toBe('ENVIADA');
    expect(quejas).toHaveLength(0);
    expect(motor.procesarMensajeEntrante).toHaveBeenCalledTimes(1);
  });

  it('con la ventana configurada en encuesta_ventana_dias se respeta el parámetro', async () => {
    parametros.encuesta_ventana_dias = 1;
    encuestas[0].enviada_en = new Date(Date.now() - 2 * DIA);

    await recibir(payloadTexto('1 Malo'));

    expect(encuestas[0].estado).toBe('ENVIADA');
    expect(motor.procesarMensajeEntrante).toHaveBeenCalledTimes(1);
  });

  it('chat en VALIDAR_PAGO con un pedido distinto: la calificación pendiente se registra y no se contesta "Ya avisé a una persona"', async () => {
    conversacion = { ...conversacion, estado: 'VALIDAR_PAGO', duenio: 'PERSONA', flujo: { pago: { pedidoCodigo: 'CP-W114' } } };
    encuestaEnPedidoReciente();
    await recibir(payloadTexto('1 Malo'));

    expect(encuestas[0]).toMatchObject({ estado: 'RESPONDIDA', puntaje: 1 });
    expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    expect(mensajeria.enviarTexto).not.toHaveBeenCalled();
    expect(conversacion.estado).toBe('VALIDAR_PAGO');
  });

  it('el mensaje de calificación queda en mensaje_chat del cliente', async () => {
    await recibir(payloadTexto('1 Malo'));

    expect(prisma.mensajeChat.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ direccion: 'ENTRA', autor: 'CLIENTE' }) }),
    );
  });

  describe('motivo de la calificación baja', () => {
    const responder = async (nota: string) => {
      await recibir(payloadTexto(nota));
      outbox.encolar.mockClear();
      motor.procesarMensajeEntrante.mockClear();
    };
    const lista = (id: string, titulo: string) => ({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: {
        contacts: [{ wa_id: TEL, profile: { name: 'José Ángel' } }],
        messages: [{ id: `wamid.${Math.random()}`, from: TEL, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id, title: titulo } } }],
      } }] }],
    });

    it('nota 3: el motivo se registra en la encuesta, sin queja, y luego se agradece', async () => {
      await responder('3');
      await recibir(lista('motivo:DEMORA', 'Demora'));

      expect(encuestas[0]).toMatchObject({ motivo_codigo: 'DEMORA', motivo_texto: null });
      expect(quejas).toHaveLength(0);
      expect(outbox.encolar.mock.calls[0][0].clave).toBe('encuesta-1-GRACIAS');
      expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    });

    it('nota 1: el motivo queda en la encuesta y en la queja, y el agradecimiento promete a una persona', async () => {
      await responder('1');
      await recibir(lista('motivo:MAL_ESTADO', 'Mal estado o frío'));

      expect(encuestas[0].motivo_codigo).toBe('MAL_ESTADO');
      expect(quejas[0].motivo).toBe('Producto en mal estado o frío');
      expect(quejas[0].texto).toContain('Motivo: Producto en mal estado o frío');
      expect(conversacion.motivo_derivacion).toBe('CALIFICACION_BAJA');
      expect(outbox.encolar.mock.calls[0][0].carga.textoLibre).toMatch(/persona te escribir/);
      expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();
    });

    it('«Otro» pide el texto y lo que escribe queda como motivo (máx. 300), sin pasar por el bot', async () => {
      await responder('2');
      await recibir(lista('motivo:OTRO', 'Otro (escríbelo)'));
      expect(encuestas[0].motivo_codigo).toBe('OTRO');
      expect(outbox.encolar.mock.calls[0][0].clave).toBe('encuesta-1-MOTIVO-LIBRE');
      outbox.encolar.mockClear();

      await recibir(payloadTexto('x'.repeat(400)));
      expect(encuestas[0].motivo_texto).toHaveLength(300);
      expect(quejas[0].motivo).toHaveLength(300);
      expect(outbox.encolar.mock.calls[0][0].clave).toBe('encuesta-1-GRACIAS');
      expect(motor.procesarMensajeEntrante).not.toHaveBeenCalled();

      // ya contestado: otro texto sigue su camino normal
      await recibir(payloadTexto('quiero una dona'));
      expect(encuestas[0].motivo_texto).toHaveLength(300);
    });

    it('un texto suelto sin haber elegido «Otro» no se toma como motivo: va al bot y no se insiste', async () => {
      await responder('3');
      await recibir(payloadTexto('quiero pedir una dona'));

      expect(encuestas[0].motivo_codigo ?? null).toBeNull();
      expect(motor.procesarMensajeEntrante).toHaveBeenCalledTimes(1);
      expect(outbox.encolar).not.toHaveBeenCalled();
    });

    it('la pregunta vence a las 24 h: la respuesta tardía ya no se registra', async () => {
      await responder('3');
      encuestas[0].motivo_preguntado_en = new Date(Date.now() - 25 * 3600_000);
      await recibir(lista('motivo:PRECIO', 'Precio'));

      expect(encuestas[0].motivo_codigo ?? null).toBeNull();
      expect(outbox.encolar).not.toHaveBeenCalled();
    });

    it('nota 4-5: sin pregunta de motivo, agradece como siempre', async () => {
      await recibir(payloadTexto('4'));
      expect(outbox.encolar.mock.calls[0][0].clave).toBe('encuesta-1-GRACIAS');
      expect(encuestas[0].motivo_preguntado_en ?? null).toBeNull();
    });
  });
});

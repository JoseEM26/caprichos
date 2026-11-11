jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({ signAsync: jest.fn(), verifyAsync: jest.fn() })),
  JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class MockJwtModule {} }) },
}));

import { MensajesService } from './mensajes.service';
import { MensajesController } from './mensajes.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';

/** Datos 100 % inventados. */
const usuario: any = { partyId: 10n, rol: 'ADMIN', debeCambiar: false };
const conversacionBase = {
  id: 1n, telefono: '999000111', estado: 'ABIERTA', duenio: 'PERSONA', urgente: false, tomado_por: null,
  nombre_contacto: null, nombre_editado: false, identificador_tipo: 'TELEFONO', flujo: {}, party: null, phone_number_id: null,
  tomadoPorUsuario: null, ultima_actividad: new Date(),
};

describe('Envío encolado: validaciones síncronas y respuesta inmediata', () => {
  let prisma: any;
  let cola: any;
  let gateway: any;
  let ventana: any;
  let svc: MensajesService;

  beforeEach(() => {
    prisma = {
      userAccount: { findUnique: jest.fn().mockResolvedValue({ id: 100n }) },
      conversacion: { findUnique: jest.fn().mockResolvedValue({ ...conversacionBase }), update: jest.fn().mockResolvedValue({}) },
      mensajeChat: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 900n, en: new Date() }),
        findUnique: jest.fn(),
      },
      whatsappMensaje: { findUnique: jest.fn().mockResolvedValue(null) },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    cola = { despertar: jest.fn() };
    // Meta «lento»: si el servidor lo esperara, cada llamada tardaría 2 s
    gateway = {
      enviarTexto: jest.fn().mockImplementation(() => new Promise((r) => setTimeout(() => r({ id: '1', estado: 'ENVIADO' }), 2000))),
      transmitirTexto: jest.fn(),
    };
    ventana = { esVentanaAbierta: jest.fn().mockResolvedValue(true) };
    svc = new MensajesService(prisma, { registrar: jest.fn() } as any, gateway, { emitirAdmin: jest.fn() } as any, ventana, undefined, undefined, undefined, undefined, undefined, cola);
  });

  it('responde YA con el mensaje guardado ENCOLADO y dispara el envío sin esperar a Meta', async () => {
    const t = Date.now();
    const r = await svc.enviar('1', '  Hola, ya casi está tu pedido  ', usuario, '10.0.0.5', 'tmp-1');
    expect(Date.now() - t).toBeLessThan(100);
    expect(r).toEqual({ id: '900', estado: 'ENCOLADO' });
    const datos = prisma.mensajeChat.create.mock.calls[0][0].data;
    expect(datos).toMatchObject({ conversacion_id: 1n, direccion: 'SALE', autor: 'PERSONA', tipo: 'TEXTO' });
    expect(datos.contenido).toMatchObject({ texto: 'Hola, ya casi está tu pedido', idCliente: 'tmp-1', estado: 'ENCOLADO' });
    expect(cola.despertar).toHaveBeenCalledWith(900n);
    expect(gateway.enviarTexto).not.toHaveBeenCalled();
    // el bot calla al instante, como antes
    expect(prisma.conversacion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ duenio: 'PERSONA', urgente: false }) }));
  });

  it('el mismo idCliente otra vez no crea ni envía otro mensaje: devuelve el ya guardado', async () => {
    prisma.mensajeChat.findMany.mockResolvedValue([{ id: 900n, contenido: { idCliente: 'tmp-1', texto: 'Hola' } }]);
    const r = await svc.enviar('1', 'Hola', usuario, undefined, 'tmp-1');
    expect(r).toEqual({ id: '900', duplicado: true });
    expect(prisma.mensajeChat.create).not.toHaveBeenCalled();
    expect(cola.despertar).not.toHaveBeenCalled();
  });

  it('ventana de 24 h cerrada: 409 VENTANA_CERRADA al instante y nada queda encolado', async () => {
    ventana.esVentanaAbierta.mockResolvedValue(false);
    await expect(svc.enviar('1', 'Hola', usuario)).rejects.toMatchObject({ status: 409, response: { codigo: 'VENTANA_CERRADA' } });
    expect(prisma.mensajeChat.create).not.toHaveBeenCalled();
    expect(cola.despertar).not.toHaveBeenCalled();
  });

  it('chat tomado por otra persona: 409 CHAT_TOMADO al instante', async () => {
    prisma.conversacion.findUnique.mockResolvedValue({ ...conversacionBase, tomado_por: 999n, tomadoPorUsuario: null });
    await expect(svc.enviar('1', 'Hola', usuario)).rejects.toMatchObject({ status: 409, response: { codigo: 'CHAT_TOMADO' } });
    expect(prisma.mensajeChat.create).not.toHaveBeenCalled();
  });

  it('mensaje vacío: 400; contacto sin identificador: 409; número bloqueado/propio: 400', async () => {
    await expect(svc.enviar('1', '   ', usuario)).rejects.toMatchObject({ status: 400, response: { codigo: 'MENSAJE_VACIO' } });
    prisma.conversacion.findUnique.mockResolvedValue({ ...conversacionBase, telefono: 'wa-user:' });
    await expect(svc.enviar('1', 'Hola', usuario)).rejects.toMatchObject({ status: 409, response: { codigo: 'CONTACTO_SIN_IDENTIFICADOR' } });
    prisma.conversacion.findUnique.mockResolvedValue({ ...conversacionBase });
    const numeros: any = { motivoOmision: jest.fn().mockResolvedValue('DESTINO_BLOQUEADO') };
    const conNumeros = new MensajesService(prisma, { registrar: jest.fn() } as any, gateway, undefined, ventana, undefined, undefined, undefined, undefined, numeros, cola);
    await expect(conNumeros.enviar('1', 'Hola', usuario)).rejects.toMatchObject({ status: 400, response: { codigo: 'NUMERO_BLOQUEADO' } });
    expect(prisma.mensajeChat.create).not.toHaveBeenCalled();
  });

  it('límite de 20 por minuto: 429 LIMITE_ENVIO antes de encolar', async () => {
    const redis: any = { obtenerCliente: () => ({ incr: jest.fn().mockResolvedValue(21), expire: jest.fn(), set: jest.fn() }) };
    const conRedis = new MensajesService(prisma, { registrar: jest.fn() } as any, gateway, undefined, ventana, redis, undefined, undefined, undefined, undefined, cola);
    await expect(conRedis.enviar('1', 'Hola', usuario)).rejects.toMatchObject({ status: 429, response: { codigo: 'LIMITE_ENVIO' } });
    expect(prisma.mensajeChat.create).not.toHaveBeenCalled();
  });

  describe('Reintentar manual', () => {
    const fallido = (extra: any = {}) => ({
      id: 500n, conversacion_id: 1n, direccion: 'SALE', autor: 'PERSONA', tipo: 'TEXTO', meta_id: null, whatsapp_mensaje_id: null,
      contenido: { texto: 'Hola', estado: 'FALLIDO', errorCodigo: 'ERROR_META', ...extra },
    });

    it('reusa el MISMO mensaje (no crea otro), lo vuelve a ENCOLADO y responde ya', async () => {
      prisma.mensajeChat.findUnique.mockResolvedValue(fallido());
      const r = await svc.reintentarMensaje('1', '500', usuario);
      expect(r).toEqual({ ok: true, id: '500', estado: 'ENCOLADO' });
      expect(prisma.mensajeChat.create).not.toHaveBeenCalled();
      expect(gateway.enviarTexto).not.toHaveBeenCalled();
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(cola.despertar).toHaveBeenCalledWith(500n);
    });

    it('respeta la ventana de 24 h: 409 y no se reencola', async () => {
      prisma.mensajeChat.findUnique.mockResolvedValue(fallido());
      ventana.esVentanaAbierta.mockResolvedValue(false);
      await expect(svc.reintentarMensaje('1', '500', usuario)).rejects.toMatchObject({ status: 409, response: { codigo: 'VENTANA_CERRADA' } });
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(cola.despertar).not.toHaveBeenCalled();
    });

    it('un mensaje que ya salió (o ya está en cola) no se reenvía: 409', async () => {
      prisma.mensajeChat.findUnique.mockResolvedValue(fallido({ estado: 'ENVIADO' }));
      await expect(svc.reintentarMensaje('1', '500', usuario)).rejects.toMatchObject({ status: 409, response: { codigo: 'REINTENTO_NO_APLICA' } });
      expect(cola.despertar).not.toHaveBeenCalled();
    });

    it('dos toques seguidos: el UPDATE atómico deja pasar solo al primero', async () => {
      prisma.mensajeChat.findUnique.mockResolvedValue(fallido());
      prisma.$executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      await svc.reintentarMensaje('1', '500', usuario);
      await expect(svc.reintentarMensaje('1', '500', usuario)).rejects.toMatchObject({ status: 409 });
      expect(cola.despertar).toHaveBeenCalledTimes(1);
    });

    it('un mensaje en REVISAR también se puede reintentar a conciencia', async () => {
      prisma.mensajeChat.findUnique.mockResolvedValue(fallido({ estado: 'REVISAR' }));
      const r = await svc.reintentarMensaje('1', '500', usuario);
      expect(r.estado).toBe('ENCOLADO');
    });
  });
});

describe('Lista de chats paginada por cursor', () => {
  let prisma: any;
  let svc: MensajesService;
  let filas: any[];
  const ahora = Date.now();

  const chat = (n: number, extra: any = {}) => {
    const ts = new Date(ahora - Math.floor(n / 3) * 60_000); // grupos de 3 con la MISMA hora: prueba el desempate por id
    return {
      ...conversacionBase,
      id: BigInt(n),
      telefono: `9${String(n).padStart(8, '0')}`,
      nombre_contacto: `Cliente ${n}`,
      nombre_editado: true,
      duenio: n % 2 ? 'BOT' : 'PERSONA',
      urgente: n % 10 === 0,
      ultima_actividad: ts,
      mensajes: [{ id: BigInt(n), autor: n % 4 ? 'CLIENTE' : 'BOT', direccion: n % 4 ? 'ENTRA' : 'SALE', tipo: 'TEXTO', contenido: { texto: `Mensaje ${n}` }, en: ts }],
      ...extra,
    };
  };
  const ordenEsperado = (lista: any[]) => [...lista].sort((a, b) => b.ultima_actividad.getTime() - a.ultima_actividad.getTime() || Number(b.id - a.id)).map((c) => c.id.toString());

  beforeEach(() => {
    filas = Array.from({ length: 95 }, (_, i) => chat(i + 1));
    prisma = {
      conversacion: {
        findMany: jest.fn().mockImplementation(() => Promise.resolve([...filas].sort(() => 0.5 - Math.random()))), // llegan desordenadas
        findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(filas.find((f) => f.id === where.id) ?? null)),
      },
      mensajeReparto: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findMany: jest.fn().mockResolvedValue([]) },
      userAccount: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    svc = new MensajesService(prisma, { registrar: jest.fn() } as any, { enviarTexto: jest.fn() } as any, undefined);
  });

  const recorrer = async (limite: number, filtro: any = 'todos', q = '') => {
    const ids: string[] = [];
    let cursor: string | undefined;
    const paginas: any[] = [];
    for (let i = 0; i < 20; i++) {
      const r = await svc.listar(filtro, q, undefined, { cursor, limite });
      paginas.push(r);
      ids.push(...r.chats.map((c) => c.id));
      if (!r.hayMas) break;
      cursor = r.siguienteCursor!;
    }
    return { ids, paginas };
  };

  it('recorrer todas las páginas da cada chat UNA vez, en el orden estable (última actividad desc, id desc)', async () => {
    const { ids, paginas } = await recorrer(30);
    expect(paginas).toHaveLength(4); // 30 + 30 + 30 + 5
    expect(paginas[0].chats).toHaveLength(30);
    expect(paginas[3].hayMas).toBe(false);
    expect(paginas[3].siguienteCursor).toBeNull();
    expect(new Set(ids).size).toBe(95);
    expect(ids).toEqual(ordenEsperado(filas));
  });

  it('la forma de siempre se conserva: mismos campos por chat y conteos; agrega hayMas, siguienteCursor y dias', async () => {
    const r = await svc.listar('todos', '');
    expect(r.chats).toHaveLength(40); // página por defecto
    expect(r.hayMas).toBe(true);
    expect(typeof r.siguienteCursor).toBe('string');
    expect(Object.keys(r.chats[0])).toEqual(expect.arrayContaining(['id', 'nombre', 'telefono', 'estado', 'urgente', 'ultimo', 'hora', 'fecha', 'sinLeer', 'sinRespuestaMin', 'bloqueoSpam', 'pos', 'faltaProcesar', 'porReprogramar', 'clave']));
    expect(r.conteos).toEqual(expect.objectContaining({ todos: 95, atender: 9, bot: 86, atendidos: 0, sinVer: 5 }));
  });

  it('los conteos de las pestañas son los de TODOS los chats, igual en cualquier página', async () => {
    const { paginas } = await recorrer(30);
    for (const p of paginas) expect(p.conteos).toEqual(paginas[0].conteos);
    const urgentes = filas.filter((f) => f.urgente).length;
    expect(paginas[0].conteos.atender).toBe(urgentes);
    expect(paginas[0].conteos.bot).toBe(95 - urgentes);
    // sin ver = «Por atender» con el último mensaje del cliente (10, 30, 50, 70, 90)
    expect(paginas[0].conteos.sinVer).toBe(filas.filter((f) => f.urgente && f.mensajes[0].autor === 'CLIENTE').length);
  });

  it('si entra un chat nuevo entre dos páginas, no se repite ni se salta ninguno de los que faltaban', async () => {
    const p1 = await svc.listar('todos', '', undefined, { limite: 30 });
    filas.push(chat(96, { ultima_actividad: new Date(ahora + 60_000) })); // el más reciente de todos
    const p2 = await svc.listar('todos', '', undefined, { limite: 30, cursor: p1.siguienteCursor! });
    const vistos = [...p1.chats, ...p2.chats].map((c) => c.id);
    expect(new Set(vistos).size).toBe(60);
    expect(vistos).not.toContain('96');
    expect(p2.chats[0].id).toBe(ordenEsperado(filas.filter((f) => f.id !== 96n))[30]);
  });

  it('«Por atender»: urgentes primero (día más reciente primero) y el que más espera antes', async () => {
    const { ids } = await recorrer(5, 'atender');
    const esperados = ordenEsperado(filas.filter((f) => f.urgente)); // los urgentes son 10, 20, ... 90
    expect(ids.sort()).toEqual([...esperados].sort());
    const r = await svc.listar('atender', '', undefined, { limite: 100 });
    const esperando = r.chats.filter((c) => c.sinRespuestaMin !== null).map((c) => new Date(c.fecha).getTime());
    // todos urgentes y del mismo día: primero los que esperan respuesta (el de mensaje más viejo antes); luego los demás por actividad reciente
    expect(r.chats.slice(0, esperando.length).every((c) => c.sinRespuestaMin !== null)).toBe(true);
    expect(esperando).toEqual([...esperando].sort((a, b) => a - b));
    const resto = r.chats.slice(esperando.length).map((c) => new Date(c.fecha).getTime());
    expect(resto.every((_, i) => i === 0 || resto[i - 1] >= resto[i])).toBe(true);
  });

  it('la búsqueda se hace en el servidor (nombre o dígitos del celular) y pagina sobre lo encontrado', async () => {
    const r = await svc.listar('todos', 'Cliente 79');
    expect(r.chats.map((c) => c.nombre).sort()).toEqual(filas.map((f) => f.nombre_contacto).filter((n) => n === 'Cliente 79').sort());
    const porNumero = await svc.listar('todos', '00000042');
    expect(porNumero.chats.map((c) => c.id)).toEqual(['42']);
    // los conteos de las pestañas NO cambian con la búsqueda
    expect(r.conteos.todos).toBe(95);
    expect(r.hayMas).toBe(false);
  });

  it('el filtro por día se aplica en el servidor y los contadores por día salen de la pestaña', async () => {
    filas = filas.map((f, i) => (i < 10 ? { ...f, ultima_actividad: new Date(ahora - 3 * 86_400_000), mensajes: [{ ...f.mensajes[0], en: new Date(ahora - 3 * 86_400_000) }] } : f));
    const hoy = await svc.listar('todos', '', undefined, { dia: 'hoy', limite: 100 });
    expect(hoy.chats).toHaveLength(85);
    expect(hoy.dias).toEqual({ hoy: 85, ayer: 0, manana: 0, anteriores: 10, total: 95 });
    const todos = await svc.listar('todos', '', undefined, { dia: 'todos', limite: 100 });
    expect(todos.chats).toHaveLength(95);
  });

  it('límite fuera de rango se acota (1 a 100)', async () => {
    expect((await svc.listar('todos', '', undefined, { limite: 500 })).chats).toHaveLength(95);
    expect((await svc.listar('todos', '', undefined, { limite: 0 })).chats.length).toBe(40); // 0 = valor inválido → página por defecto
  });

  it('solo la página lleva el trabajo caro: el estado del número se consulta solo para sus 30 chats', async () => {
    const numeros: any = { motivoOmision: jest.fn().mockResolvedValue(undefined) };
    svc = new MensajesService(prisma, { registrar: jest.fn() } as any, { enviarTexto: jest.fn() } as any, undefined, undefined, undefined, undefined, undefined, undefined, numeros);
    await svc.listar('todos', '', undefined, { limite: 30 });
    expect(numeros.motivoOmision).toHaveBeenCalledTimes(30);
  });

  describe('actualización en vivo de una fila y de los contadores', () => {
    it('fila: chat cargado devuelve su fila con la clave de orden; si dejó de cumplir el filtro, null', async () => {
      const r = await svc.fila('10', 'atender');
      expect(r.chat?.id).toBe('10');
      expect(r.dentro).toBe(true);
      const noEsta = await svc.fila('11', 'atender'); // 11 no es urgente: no está en «Por atender»
      expect(noEsta).toEqual({ chat: null, dentro: false });
      expect((await svc.fila('999', 'todos')).chat).toBeNull();
      expect((await svc.fila('abc', 'todos')).chat).toBeNull();
    });

    it('fila: `dentro` dice si el chat cae dentro de lo ya cargado (hasta la clave del último) o más adelante', async () => {
      const p1 = await svc.listar('todos', '', undefined, { limite: 30 });
      const ultimoCargado = p1.siguienteCursor!;
      const cargado = await svc.fila(p1.chats[3].id, 'todos', '', undefined, { hasta: ultimoCargado });
      expect(cargado.dentro).toBe(true);
      const sinCargar = await svc.fila('95', 'todos', '', undefined, { hasta: ultimoCargado }); // el más antiguo
      expect(sinCargar.chat?.id).toBe('95');
      expect(sinCargar.dentro).toBe(false);
    });

    it('conteos: solo los contadores, iguales a los de listar', async () => {
      const c = await svc.conteos();
      expect(c).toEqual((await svc.listar('todos', '')).conteos);
    });
  });
});

describe('Permisos de las rutas nuevas', () => {
  const permisoDe = (metodo: string) => Reflect.getMetadata(CLAVE_PERMISO, (MensajesController.prototype as any)[metodo]);
  it('ver para listar, conteos y fila; enviar para enviar y reintentar', () => {
    for (const m of ['listar', 'conteos', 'fila']) expect(permisoDe(m)).toEqual({ modulo: 'mensajes', accion: 'ver' });
    for (const m of ['enviar', 'reintentar']) expect(permisoDe(m)).toEqual({ modulo: 'mensajes', accion: 'enviar' });
  });
});

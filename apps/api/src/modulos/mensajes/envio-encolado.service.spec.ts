jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { EnvioEncoladoService, MAX_INTENTOS_ENVIO, MOTIVO_REVISAR } from './envio-encolado.service';

/** Datos inventados. El «reclamo» simula el UPDATE atómico: solo la primera llamada por mensaje devuelve la fila. */
describe('EnvioEncoladoService (envío en segundo plano)', () => {
  let prisma: any;
  let gateway: any;
  let eventos: any;
  let auditoria: any;
  let svc: EnvioEncoladoService;
  let reclamables: Map<string, any>;
  let cierres: any[];

  const fila = (id: bigint, extra: any = {}) => ({
    id,
    conversacion_id: 7n,
    contenido: { texto: 'Hola, tu pedido sale en 10 min', idCliente: 'tmp-abc', estado: 'ENCOLADO', intentos: 0, origen: { partyId: '10', ip: '10.0.0.1', accion: 'ENVIAR' }, ...extra },
  });

  beforeEach(() => {
    reclamables = new Map([['1', fila(1n)]]);
    cierres = [];
    prisma = {
      // UPDATE ... RETURNING (reclamo) y SELECT del barrido: se distinguen por el texto del SQL
      $queryRaw: jest.fn().mockImplementation((sql: TemplateStringsArray, ...vals: any[]) => {
        const texto = sql.join('?');
        if (texto.includes('UPDATE mensaje_chat')) {
          const f = reclamables.get(String(vals[1]));
          if (!f) return Promise.resolve([]);
          reclamables.delete(String(vals[1]));
          return Promise.resolve([{ ...f, contenido: { ...f.contenido, estado: 'ENVIANDO', intentos: (f.contenido.intentos ?? 0) + 1 } }]);
        }
        return Promise.resolve(prisma.__barrido ?? []);
      }),
      $executeRaw: jest.fn().mockImplementation((sql: TemplateStringsArray, ...vals: any[]) => {
        cierres.push({ sql: sql.join('?'), vals });
        return Promise.resolve(1);
      }),
      conversacion: { findUnique: jest.fn().mockResolvedValue({ id: 7n, telefono: '999000111' }) },
      whatsappMensaje: { findMany: jest.fn().mockResolvedValue([]) },
    };
    gateway = {
      transmitirTexto: jest.fn().mockResolvedValue({ id: '', estado: 'ENVIADO', metaId: 'wamid.X1', whatsappMensajeId: 55n }),
    };
    eventos = { emitirAdmin: jest.fn() };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    svc = new EnvioEncoladoService(prisma, auditoria, gateway, eventos);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const estadoCerrado = () => JSON.parse(cierres[cierres.length - 1].vals[0]).estado;

  it('envía UNA vez a Meta, deja ENVIADO, avisa por socket y audita con el resultado real', async () => {
    await svc.procesar(1n);
    expect(gateway.transmitirTexto).toHaveBeenCalledTimes(1);
    expect(gateway.transmitirTexto).toHaveBeenCalledWith(7n, '999000111', 'Hola, tu pedido sale en 10 min');
    expect(estadoCerrado()).toBe('ENVIADO');
    expect(cierres[0].vals).toEqual(expect.arrayContaining(['wamid.X1', 55n]));
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('mensajes:envio', expect.objectContaining({ id: '7', mensajeId: '1', idCliente: 'tmp-abc', estado: 'ENVIADO' }));
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'ENVIAR', entidadId: 7n, partyId: 10n, despues: { mensajeId: '1', estado: 'ENVIADO' } }));
  });

  it('reclamo atómico: dos disparos simultáneos del mismo mensaje hablan con Meta una sola vez', async () => {
    await Promise.all([svc.procesar(1n), svc.procesar(1n), svc.procesar(1n)]);
    expect(gateway.transmitirTexto).toHaveBeenCalledTimes(1);
  });

  it('un mensaje que ya no está ENCOLADO (otro proceso lo tomó o ya terminó) no se reenvía', async () => {
    await svc.procesar(99n);
    expect(gateway.transmitirTexto).not.toHaveBeenCalled();
    expect(cierres).toHaveLength(0);
  });

  it('error permanente de Meta: FALLIDO sin reintentos, con código y detalle', async () => {
    gateway.transmitirTexto.mockResolvedValue({ id: '', estado: 'FALLIDO', errorCodigo: 'ERROR_META', errorDetalle: 'detalle de Meta', whatsappMensajeId: 56n, metaId: null });
    await svc.procesar(1n);
    expect(gateway.transmitirTexto).toHaveBeenCalledTimes(1);
    expect(estadoCerrado()).toBe('FALLIDO');
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('mensajes:envio', expect.objectContaining({ estado: 'FALLIDO', puedeReintentar: true }));
  });

  it('timeout o red (pudo haber salido): NO se reenvía solo; queda FALLIDO para decidir a mano', async () => {
    gateway.transmitirTexto.mockResolvedValue({ id: '', estado: 'FALLIDO', errorCodigo: 'TIMEOUT_META', errorDetalle: 'Timeout' });
    await svc.procesar(1n);
    expect(gateway.transmitirTexto).toHaveBeenCalledTimes(1);
    expect(estadoCerrado()).toBe('FALLIDO');
  });

  it('Meta rechazó por límite: reintenta con espera creciente y, agotados los intentos, queda FALLIDO', async () => {
    jest.useFakeTimers();
    gateway.transmitirTexto.mockResolvedValue({ id: '', estado: 'FALLIDO', errorCodigo: 'LIMITE_TASA_EXCEDIDO', errorDetalle: 'x' });
    // cada reencolado vuelve a dejar la fila reclamable, como hace el UPDATE real (ENVIANDO → ENCOLADO)
    prisma.$executeRaw.mockImplementation((sql: TemplateStringsArray, ...vals: any[]) => {
      const cambios = JSON.parse(vals[0]);
      if (cambios.estado === 'ENCOLADO') reclamables.set('1', fila(1n, { intentos: gateway.transmitirTexto.mock.calls.length }));
      cierres.push({ vals });
      return Promise.resolve(1);
    });
    await svc.procesar(1n);
    expect(gateway.transmitirTexto).toHaveBeenCalledTimes(1);
    expect(JSON.parse(cierres[0].vals[0]).estado).toBe('ENCOLADO');
    await jest.advanceTimersByTimeAsync(5_000);
    await svc.esperarEnCurso();
    expect(gateway.transmitirTexto).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(20_000);
    await svc.esperarEnCurso();
    expect(gateway.transmitirTexto).toHaveBeenCalledTimes(MAX_INTENTOS_ENVIO);
    expect(JSON.parse(cierres[cierres.length - 1].vals[0]).estado).toBe('FALLIDO');
    await jest.advanceTimersByTimeAsync(120_000);
    expect(gateway.transmitirTexto).toHaveBeenCalledTimes(MAX_INTENTOS_ENVIO); // el tope se respeta
  });

  it('una excepción a mitad del envío no se reenvía: queda REVISAR con el aviso para revisar en WhatsApp', async () => {
    gateway.transmitirTexto.mockRejectedValue(new Error('se cayó la conexión'));
    await svc.procesar(1n);
    expect(gateway.transmitirTexto).toHaveBeenCalledTimes(1);
    expect(estadoCerrado()).toBe('REVISAR');
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('mensajes:envio', expect.objectContaining({ estado: 'REVISAR', motivoFallo: MOTIVO_REVISAR }));
  });

  it('si no se puede enlazar el id de Meta (ya lo tiene otra fila), igual anota ENVIADO: no queda ENVIANDO para siempre', async () => {
    prisma.$executeRaw.mockRejectedValueOnce(Object.assign(new Error('duplicado'), { code: '23505' })).mockResolvedValue(1);
    await svc.procesar(1n);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('mensajes:envio', expect.objectContaining({ estado: 'ENVIADO' }));
  });

  it('si la pasarela no sabe enviar en segundo plano, queda FALLIDO (no se pierde en silencio)', async () => {
    delete gateway.transmitirTexto;
    await svc.procesar(1n);
    expect(estadoCerrado()).toBe('FALLIDO');
  });

  it('si el cierre ya no encuentra el mensaje ENVIANDO, no avisa ni audita dos veces', async () => {
    prisma.$executeRaw.mockResolvedValue(0);
    await svc.procesar(1n);
    expect(eventos.emitirAdmin).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  describe('barrido tras un reinicio', () => {
    const viejo = Date.now() - 10 * 60_000;

    it('envía lo ENCOLADO que quedó sin disparar y no toca lo recién encolado', async () => {
      reclamables.set('2', fila(2n));
      prisma.__barrido = [fila(1n, { listoEn: viejo }), fila(2n, { listoEn: Date.now() + 60_000 })];
      await svc.barrer();
      expect(gateway.transmitirTexto).toHaveBeenCalledTimes(1);
    });

    it('ENVIANDO viejo sin rastro en whatsapp_mensaje: REVISAR, jamás reenvía', async () => {
      prisma.__barrido = [fila(3n, { estado: 'ENVIANDO', inicioEnvio: viejo })];
      await svc.barrer();
      expect(gateway.transmitirTexto).not.toHaveBeenCalled();
      expect(estadoCerrado()).toBe('REVISAR');
    });

    it('ENVIANDO viejo con UN registro aceptado por Meta: se da por ENVIADO sin reenviar', async () => {
      prisma.__barrido = [fila(3n, { estado: 'ENVIANDO', inicioEnvio: viejo })];
      prisma.whatsappMensaje.findMany.mockResolvedValue([{ id: 77n, estado: 'ENVIADO', wa_message_id: 'wamid.ZZ', error_codigo: null, error_detalle: null }]);
      await svc.barrer();
      expect(gateway.transmitirTexto).not.toHaveBeenCalled();
      expect(estadoCerrado()).toBe('ENVIADO');
      expect(cierres[0].vals).toEqual(expect.arrayContaining(['wamid.ZZ', 77n]));
    });

    it('ENVIANDO viejo con un registro FALLIDO del adaptador: FALLIDO con su error, sin reenviar', async () => {
      prisma.__barrido = [fila(3n, { estado: 'ENVIANDO', inicioEnvio: viejo })];
      prisma.whatsappMensaje.findMany.mockResolvedValue([{ id: 78n, estado: 'FALLIDO', wa_message_id: null, error_codigo: 'ERROR_META', error_detalle: 'rechazado' }]);
      await svc.barrer();
      expect(estadoCerrado()).toBe('FALLIDO');
      expect(gateway.transmitirTexto).not.toHaveBeenCalled();
    });

    it('ENVIANDO reciente (aún puede estar hablando con Meta): no se toca', async () => {
      prisma.__barrido = [fila(3n, { estado: 'ENVIANDO', inicioEnvio: Date.now() - 5_000 })];
      await svc.barrer();
      expect(cierres).toHaveLength(0);
      expect(gateway.transmitirTexto).not.toHaveBeenCalled();
    });

    it('con dudas (dos registros posibles): REVISAR', async () => {
      prisma.__barrido = [fila(3n, { estado: 'ENVIANDO', inicioEnvio: viejo })];
      prisma.whatsappMensaje.findMany.mockResolvedValue([
        { id: 1n, estado: 'ENVIADO', wa_message_id: 'a' },
        { id: 2n, estado: 'ENVIADO', wa_message_id: 'b' },
      ]);
      await svc.barrer();
      expect(estadoCerrado()).toBe('REVISAR');
    });
  });

  it('al cerrar el servidor no se empiezan envíos nuevos (quedan ENCOLADO en la BD)', async () => {
    await svc.onApplicationShutdown();
    await svc.procesar(1n);
    expect(gateway.transmitirTexto).not.toHaveBeenCalled();
  });
});

jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { register: jest.fn().mockReturnValue({ module: class {} }) } }));

import { HttpException } from '@nestjs/common';
import { CodigoRegistroService, REGISTRO_MAX_SOLICITUDES_HORA, VERIFICACION_MAX_CONSULTAS_IP_MIN } from './codigo-registro.service';
import { RecuperarClaveService } from './recuperar-clave.service';
import {
  MODO_CODIGO_PLANTILLA,
  MODO_WHATSAPP_ENTRANTE,
  RESPUESTA_NO_VERIFICADO,
  RESPUESTA_VERIFICADO,
  TOKEN_ALFABETO,
  atenderMensajeVerificacion,
  generarToken,
  iniciarVerificacion,
  estadoVerificacion,
  modoVerificacion,
  numeroVerificacion,
  secretoVerificacion,
} from './verificacion-whatsapp.util';

const SECRETO = 'secreto-de-prueba';
const TEL_CLIENTE = '51987654321'; // celular 987654321: el que pide el token
const TEL_OTRO = '51912345678';

/** Redis en memoria con incr/expire/set (NX y EX)/get/del/exists. Sin TTL real. */
function redisFalso() {
  const datos = new Map<string, string>();
  const contadores = new Map<string, number>();
  return {
    datos,
    incr: jest.fn(async (k: string) => {
      const n = (contadores.get(k) ?? 0) + 1;
      contadores.set(k, n);
      return n;
    }),
    expire: jest.fn().mockResolvedValue(1),
    set: jest.fn(async (k: string, v: string, ...resto: unknown[]) => {
      if (resto.includes('NX') && datos.has(k)) return null;
      datos.set(k, v);
      return 'OK';
    }),
    get: jest.fn(async (k: string) => datos.get(k) ?? null),
    del: jest.fn(async (...ks: string[]) => {
      ks.forEach((k) => {
        datos.delete(k);
        contadores.delete(k);
      });
      return ks.length;
    }),
    exists: jest.fn(async (k: string) => (datos.has(k) ? 1 : 0)),
  };
}

/** Parámetros de la tabla `parametro` (solo los que se pasan). */
function prismaConParametros(parametros: Record<string, unknown> = {}) {
  return {
    parametro: {
      findUnique: jest.fn(async ({ where }: any) =>
        Object.prototype.hasOwnProperty.call(parametros, where.clave) ? { valor: parametros[where.clave] } : null,
      ),
    },
    customerAccount: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
  };
}

const configFalsa = { get: (k: string, d: unknown) => (k === 'JWT_SECRET' ? SECRETO : d) } as any;

describe('Verificación por WhatsApp: token y mensaje', () => {
  let redis: ReturnType<typeof redisFalso>;

  beforeEach(() => {
    redis = redisFalso();
  });

  it('el token tiene 8 caracteres del alfabeto sin ambiguos (0, 1, I, L, O)', () => {
    for (let i = 0; i < 300; i++) {
      const t = generarToken();
      expect(t).toMatch(/^[A-Z2-9]{8}$/);
      for (const c of t) expect(TOKEN_ALFABETO).toContain(c);
      expect(t).not.toMatch(/[01ILO]/);
    }
  });

  it('el mismo celular que pidió el token lo verifica y deja la marca de registro', async () => {
    const token = await iniciarVerificacion(redis, SECRETO, '987654321', 'REGISTRO');
    expect(await estadoVerificacion(redis, SECRETO, token)).toBe('pendiente');

    const respuesta = await atenderMensajeVerificacion(redis, SECRETO, `Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`, TEL_CLIENTE);

    expect(respuesta).toBe(RESPUESTA_VERIFICADO);
    expect(redis.datos.get('cliente:reg:ok:987654321')).toBe('1');
    expect(await estadoVerificacion(redis, SECRETO, token)).toBe('verificado');
  });

  it('para recuperar, la marca es la de recuperación', async () => {
    const token = await iniciarVerificacion(redis, SECRETO, '987654321', 'RECUPERAR');
    await atenderMensajeVerificacion(redis, SECRETO, `Mi código: ${token}`, TEL_CLIENTE);
    expect(redis.datos.get('cliente:rec:ok:987654321')).toBe('1');
    expect(redis.datos.has('cliente:reg:ok:987654321')).toBe(false);
  });

  it('otro celular no verifica nada y el token sigue pendiente', async () => {
    const token = await iniciarVerificacion(redis, SECRETO, '987654321', 'REGISTRO');
    const respuesta = await atenderMensajeVerificacion(redis, SECRETO, `Mi código: ${token}`, TEL_OTRO);
    expect(respuesta).toBe(RESPUESTA_NO_VERIFICADO);
    expect(redis.datos.has('cliente:reg:ok:987654321')).toBe(false);
    expect(await estadoVerificacion(redis, SECRETO, token)).toBe('pendiente');
  });

  it('tras varios mensajes de otro celular el token se invalida, incluso para su dueño', async () => {
    const token = await iniciarVerificacion(redis, SECRETO, '987654321', 'REGISTRO');
    for (let i = 0; i < 5; i++) await atenderMensajeVerificacion(redis, SECRETO, `Mi código: ${token}`, TEL_OTRO);
    const respuesta = await atenderMensajeVerificacion(redis, SECRETO, `Mi código: ${token}`, TEL_CLIENTE);
    expect(respuesta).toBe(RESPUESTA_NO_VERIFICADO);
    expect(redis.datos.has('cliente:reg:ok:987654321')).toBe(false);
  });

  it('un token vencido (sin clave en Redis) no verifica y el estado es vencido', async () => {
    const token = await iniciarVerificacion(redis, SECRETO, '987654321', 'REGISTRO');
    redis.datos.clear(); // el TTL de 10 minutos ya pasó
    expect(await estadoVerificacion(redis, SECRETO, token)).toBe('vencido');
    expect(await atenderMensajeVerificacion(redis, SECRETO, `Mi código: ${token}`, TEL_CLIENTE)).toBe(RESPUESTA_NO_VERIFICADO);
    expect(redis.datos.has('cliente:reg:ok:987654321')).toBe(false);
  });

  it('un token ya usado no vuelve a marcar aunque se reenvíe el mensaje', async () => {
    const token = await iniciarVerificacion(redis, SECRETO, '987654321', 'REGISTRO');
    await atenderMensajeVerificacion(redis, SECRETO, `Mi código: ${token}`, TEL_CLIENTE);
    redis.datos.delete('cliente:reg:ok:987654321'); // el registro ya consumió la marca
    const otra = await atenderMensajeVerificacion(redis, SECRETO, `Mi código: ${token}`, TEL_CLIENTE);
    expect(otra).toBe(RESPUESTA_VERIFICADO);
    expect(redis.datos.has('cliente:reg:ok:987654321')).toBe(false);
  });

  it('un mensaje sin token no es de verificación (sigue al bot)', async () => {
    expect(await atenderMensajeVerificacion(redis, SECRETO, 'hola, quiero pedir una pizza', TEL_CLIENTE)).toBeNull();
    expect(await atenderMensajeVerificacion(redis, SECRETO, 'Mi código: ab', TEL_CLIENTE)).toBeNull();
  });

  it('el estado de un token mal formado es vencido y nunca revela celulares', async () => {
    expect(await estadoVerificacion(redis, SECRETO, 'x')).toBe('vencido');
    expect(await estadoVerificacion(redis, SECRETO, '')).toBe('vencido');
  });

  it('en Redis solo queda el HMAC del token, nunca el token en claro', async () => {
    const token = await iniciarVerificacion(redis, SECRETO, '987654321', 'REGISTRO');
    const todo = [...redis.datos.keys(), ...redis.datos.values()].join(' ');
    expect(todo).not.toContain(token);
  });
});

describe('Modo y número de verificación', () => {
  it('sin parámetro, el modo es WHATSAPP_ENTRANTE; CODIGO_PLANTILLA solo si se elige', async () => {
    expect(await modoVerificacion(prismaConParametros() as any)).toBe(MODO_WHATSAPP_ENTRANTE);
    expect(await modoVerificacion(prismaConParametros({ verificacion_celular_modo: 'CODIGO_PLANTILLA' }) as any)).toBe(MODO_CODIGO_PLANTILLA);
    expect(await modoVerificacion(prismaConParametros({ verificacion_celular_modo: 'LO_QUE_SEA' }) as any)).toBe(MODO_WHATSAPP_ENTRANTE);
  });

  it('usa el número propio; si está vacío, el WhatsApp de contacto del local; si no hay, null', async () => {
    expect(await numeroVerificacion(prismaConParametros({ verificacion_whatsapp_numero: '51914244077' }) as any)).toBe('51914244077');
    expect(await numeroVerificacion(prismaConParametros({ local_datos: { whatsapp: '914 244 077' } }) as any)).toBe('51914244077');
    expect(await numeroVerificacion(prismaConParametros({ verificacion_whatsapp_numero: '', local_datos: { whatsapp: '+51 914244077' } }) as any)).toBe('51914244077');
    expect(await numeroVerificacion(prismaConParametros({}) as any)).toBeNull();
  });

  it('prioridad: parámetro bien escrito > variable VERIFICACION_WHATSAPP_NUMERO > WhatsApp de contacto', async () => {
    const env = { VERIFICACION_WHATSAPP_NUMERO: '+51 999 000 111' } as NodeJS.ProcessEnv;
    const local = { local_datos: { whatsapp: '914 244 077' } };
    // Sin parámetro: gana la variable de entorno, no el número real del local
    expect(await numeroVerificacion(prismaConParametros(local) as any, env)).toBe('51999000111');
    // Parámetro bien escrito: gana sobre la variable
    expect(await numeroVerificacion(prismaConParametros({ ...local, verificacion_whatsapp_numero: '51988777666' }) as any, env)).toBe('51988777666');
    // Parámetro mal escrito: se ignora y sigue con la variable
    expect(await numeroVerificacion(prismaConParametros({ ...local, verificacion_whatsapp_numero: '12345' }) as any, env)).toBe('51999000111');
    // Variable mal escrita o vacía: cae al WhatsApp de contacto del local
    expect(await numeroVerificacion(prismaConParametros(local) as any, { VERIFICACION_WHATSAPP_NUMERO: '' } as any)).toBe('51914244077');
    expect(await numeroVerificacion(prismaConParametros(local) as any, { VERIFICACION_WHATSAPP_NUMERO: 'abc' } as any)).toBe('51914244077');
  });
});

describe('Registro en modo WHATSAPP_ENTRANTE', () => {
  let redis: ReturnType<typeof redisFalso>;
  let outbox: any;
  let prisma: any;
  let servicio: CodigoRegistroService;

  beforeEach(() => {
    redis = redisFalso();
    outbox = { encolar: jest.fn().mockResolvedValue(undefined), despertar: jest.fn() };
    prisma = prismaConParametros({ verificacion_whatsapp_numero: '51914244077' });
    servicio = new CodigoRegistroService(prisma, { obtenerCliente: () => redis } as any, configFalsa, { get: () => outbox } as any);
  });

  it('no envía nada desde el servidor: devuelve el token y el enlace wa.me con el mensaje ya escrito', async () => {
    const r: any = await servicio.solicitar('987654321', '10.0.0.1');
    expect(r.modo).toBe(MODO_WHATSAPP_ENTRANTE);
    expect(r.token).toMatch(/^[A-Z2-9]{8}$/);
    expect(r.enlace.startsWith('https://wa.me/51914244077?text=')).toBe(true);
    expect(decodeURIComponent(r.enlace)).toContain(`Hola Caprichos, quiero verificar mi celular. Mi código: ${r.token}`);
    expect(r.vence_seg).toBe(600);
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('sin número configurado responde «verificación no disponible» (503), sin fallar en silencio', async () => {
    servicio = new CodigoRegistroService(prismaConParametros({}) as any, { obtenerCliente: () => redis } as any, configFalsa, { get: () => outbox } as any);
    const err = await servicio.solicitar('987654321').catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(503);
    expect(err.getResponse().codigo).toBe('VERIFICACION_NO_DISPONIBLE');
  });

  it('sigue el límite por celular: el que pide más de lo permitido recibe 429 y no recibe token', async () => {
    for (let i = 0; i < REGISTRO_MAX_SOLICITUDES_HORA; i++) await servicio.solicitar('987654321');
    const err = await servicio.solicitar('987654321').catch((e) => e);
    expect(err.getStatus()).toBe(429);
    expect(err.getResponse().codigo).toBe('DEMASIADOS_CODIGOS');
  });

  it('CUENTA_EXISTENTE (409) se mantiene: el celular con contraseña no recibe token', async () => {
    prisma.customerAccount.findFirst.mockResolvedValue({ hash: 'x' });
    const err = await servicio.solicitar('987654321').catch((e) => e);
    expect(err.getStatus()).toBe(409);
    expect(err.getResponse().codigo).toBe('CUENTA_EXISTENTE');
  });

  it('la consulta de estado tiene límite por IP', async () => {
    for (let i = 0; i < VERIFICACION_MAX_CONSULTAS_IP_MIN; i++) await servicio.estadoVerificacion('ABCD2345', '10.0.0.2');
    const err = await servicio.estadoVerificacion('ABCD2345', '10.0.0.2').catch((e) => e);
    expect(err.getStatus()).toBe(429);
  });

  it('tras verificar por WhatsApp, el registro acepta el celular (la marca de registro) y la consume', async () => {
    const r: any = await servicio.solicitar('987654321');
    await atenderMensajeVerificacion(redis, SECRETO, `Mi código: ${r.token}`, TEL_CLIENTE);
    await expect(servicio.exigirVerificado('987654321')).resolves.toBeUndefined();
    await expect(servicio.exigirVerificado('987654321')).rejects.toThrow();
  });
});

describe('Recuperar contraseña en modo WHATSAPP_ENTRANTE', () => {
  let redis: ReturnType<typeof redisFalso>;
  let prisma: any;
  let clientes: any;
  let servicio: RecuperarClaveService;

  beforeEach(() => {
    redis = redisFalso();
    prisma = prismaConParametros({ verificacion_whatsapp_numero: '51914244077' });
    clientes = { cuentaPorCelular: jest.fn().mockResolvedValue(null) };
    servicio = new RecuperarClaveService(
      prisma,
      { obtenerCliente: () => redis } as any,
      configFalsa,
      { registrar: jest.fn() } as any,
      clientes,
      { get: () => ({ encolar: jest.fn(), despertar: jest.fn() }) } as any,
      { avisar: jest.fn() } as any,
    );
  });

  it('la respuesta tiene la misma forma tenga o no cuenta el celular (no revela la existencia)', async () => {
    const r: any = await servicio.solicitar('987654321');
    expect(r.token).toMatch(/^[A-Z2-9]{8}$/);
    expect(r.enlace).toContain('https://wa.me/51914244077?text=');
    expect(clientes.cuentaPorCelular).not.toHaveBeenCalled();
  });

  it('confirmar acepta la marca de recuperación en vez del código, y la marca se consume', async () => {
    clientes.cuentaPorCelular.mockResolvedValue({ id: 1n, party_id: 100n });
    const r: any = await servicio.solicitar('987654321');
    await atenderMensajeVerificacion(redis, SECRETO, `Mi código: ${r.token}`, TEL_CLIENTE);
    expect(redis.datos.get('cliente:rec:ok:987654321')).toBe('1');

    await expect(servicio.confirmar({ telefono: '987654321', contrasenaNueva: 'otra-clave-nueva-1' })).resolves.toEqual({ ok: true });
    expect(prisma.customerAccount.update).toHaveBeenCalledTimes(1);
    expect(redis.datos.has('cliente:rec:ok:987654321')).toBe(false);

    // Sin marca (ya consumida) no cambia la contraseña
    const otra = await servicio.confirmar({ telefono: '987654321', contrasenaNueva: 'otra-clave-nueva-2' }).catch((e) => e);
    expect(otra.getResponse().codigo).toBe('CODIGO_INVALIDO');
    expect(prisma.customerAccount.update).toHaveBeenCalledTimes(1);
  });

  it('confirmar sin marca falla con el mismo error de código inválido', async () => {
    const err = await servicio.confirmar({ telefono: '987654321', contrasenaNueva: 'otra-clave-nueva-1' }).catch((e) => e);
    expect(err.getResponse().codigo).toBe('CODIGO_INVALIDO');
  });
});

describe('Secreto de verificación', () => {
  it('usa JWT_SECRET cuando existe', () => {
    expect(secretoVerificacion({ get: (_k: string) => 'otro' } as any)).toBe('otro');
  });
});

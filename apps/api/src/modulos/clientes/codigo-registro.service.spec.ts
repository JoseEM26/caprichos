jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { register: jest.fn().mockReturnValue({ module: class {} }) } }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { CodigoRegistroService, MENSAJE_NO_ENVIADO, REGISTRO_MAX_SOLICITUDES_IP_HORA, RESPUESTA_CODIGO_REGISTRO } from './codigo-registro.service';
import { PoliticaEvolutionService } from '../chatbot/evolution/politica-evolution.service';
import { atenderMensajeVerificacion, claveMarcaVerificacion, iniciarVerificacion, RESPUESTA_NO_VERIFICADO, RESPUESTA_VERIFICADO } from './verificacion-whatsapp.util';

const respuestaDe = (err: any) => err?.getResponse?.();

/** Redis en memoria: lo justo para incr/expire/set/get/del (sin TTL real). */
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
    set: jest.fn(async (k: string, v: string) => {
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
  };
}

describe('CodigoRegistroService', () => {
  let service: CodigoRegistroService;
  let prisma: any;
  let redis: ReturnType<typeof redisFalso>;
  let outbox: any;
  let politica: any;

  beforeEach(() => {
    redis = redisFalso();
    // Política de Evolution: por defecto deja pasar el envío
    politica = { evaluar: jest.fn().mockResolvedValue({ accion: 'ENVIAR' }) };
    // Estos tests son del modo CODIGO_PLANTILLA (código de 6 dígitos); el modo por defecto es WHATSAPP_ENTRANTE
    prisma = {
      customerAccount: { findFirst: jest.fn().mockResolvedValue(null) },
      parametro: { findUnique: jest.fn().mockResolvedValue({ valor: 'CODIGO_PLANTILLA' }) },
    };
    outbox = { encolar: jest.fn().mockResolvedValue(undefined), despertar: jest.fn() };
    service = new CodigoRegistroService(
      prisma,
      { obtenerCliente: () => redis } as any,
      { get: () => 'secreto-de-prueba' } as any,
      { get: (clase: unknown) => (clase === PoliticaEvolutionService ? politica : outbox) } as any,
    );
  });

  /** Código que llegó por WhatsApp (el último que se encoló). */
  const codigoEnviado = (): string => {
    const texto: string = outbox.encolar.mock.calls.at(-1)[0].carga.textoLibre;
    return texto.match(/es (\d{6})\./)![1];
  };

  it('envía por WhatsApp un código de 6 dígitos con el texto de registro', async () => {
    const r = await service.solicitar('912345678');

    expect(r.ok).toBe(true);
    expect(outbox.encolar).toHaveBeenCalledTimes(1);
    const cargo = outbox.encolar.mock.calls[0][0];
    expect(cargo.telefono).toBe('51912345678');
    expect(cargo.carga.textoLibre).toMatch(/^Tu código para crear tu cuenta en Caprichos es \d{6}\./);
    expect(codigoEnviado()).toMatch(/^\d{6}$/);
    expect(outbox.despertar).toHaveBeenCalled();
  });

  it('no guarda el código en claro: en Redis solo queda el HMAC', async () => {
    await service.solicitar('912345678');
    const guardado = [...redis.datos.values()].join(' ');
    expect(guardado).not.toContain(codigoEnviado());
  });

  it('celular que ya tiene cuenta con contraseña: 409 CUENTA_EXISTENTE y no envía nada', async () => {
    prisma.customerAccount.findFirst.mockResolvedValue({ hash: '$argon2id$x' });
    const err = await service.solicitar('912345678').catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getStatus()).toBe(409);
    expect(respuestaDe(err)).toEqual({
      codigo: 'CUENTA_EXISTENTE',
      mensaje: 'Este celular ya tiene cuenta. Ingresa con tu contraseña o usa «¿Olvidaste tu contraseña?».',
    });
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('límite por IP: pasado el tope por hora responde 429 DEMASIADOS_CODIGOS y no envía', async () => {
    for (let i = 0; i < REGISTRO_MAX_SOLICITUDES_IP_HORA; i++) await service.solicitar(`9${String(i).padStart(8, '0')}`, '2.2.2.2');
    const enviadosAntes = outbox.encolar.mock.calls.length;
    const err = await service.solicitar('912000001', '2.2.2.2').catch((e) => e);
    expect(err.getStatus()).toBe(429);
    expect(respuestaDe(err)).toMatchObject({ codigo: 'DEMASIADOS_CODIGOS' });
    expect(outbox.encolar.mock.calls.length).toBe(enviadosAntes);
  });

  it('verificar: código correcto deja el celular verificado; exigirVerificado no lo gasta y consumirVerificado sí', async () => {
    await service.solicitar('912345678');
    await service.verificar('912345678', codigoEnviado());
    await expect(service.exigirVerificado('912345678')).resolves.toBeUndefined();
    await expect(service.exigirVerificado('+51 912 345 678')).resolves.toBeUndefined();
    await service.consumirVerificado('912345678');
    await expect(service.exigirVerificado('912345678')).rejects.toMatchObject({ response: { codigo: 'CELULAR_NO_VERIFICADO' } });
  });

  it('verificar dos veces seguidas (doble toque): la segunda no falla ni exige otro código', async () => {
    await service.solicitar('912345678');
    const cod = codigoEnviado();
    await expect(service.verificar('912345678', cod)).resolves.toEqual({ ok: true });
    await expect(service.verificar('912345678', cod)).resolves.toEqual({ ok: true });
  });

  it('un código usado no sirve para otro celular ni, ya gastado y sin verificación previa, de nuevo', async () => {
    await service.solicitar('912345678');
    const cod = codigoEnviado();
    await expect(service.verificar('987654321', cod)).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
    await service.verificar('912345678', cod);
    await service.consumirVerificado('912345678');
    await expect(service.verificar('912345678', cod)).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
  });

  it('verificar con código equivocado no deja el celular verificado', async () => {
    await service.solicitar('912345678');
    const malo = codigoEnviado() === '000000' ? '111111' : '000000';
    await expect(service.verificar('912345678', malo)).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
    await expect(service.exigirVerificado('912345678')).rejects.toMatchObject({ response: { codigo: 'CELULAR_NO_VERIFICADO' } });
  });

  it('celular inválido: TELEFONO_INVALIDO', async () => {
    await expect(service.solicitar('812345678')).rejects.toMatchObject({ response: { codigo: 'TELEFONO_INVALIDO' } });
  });

  it('reenvío: pasado el límite por hora responde 429 con el mensaje de espera y no envía', async () => {
    await service.solicitar('912345678');
    await service.solicitar('912345678');
    await service.solicitar('912345678');
    const err = await service.solicitar('912345678').catch((e) => e);
    expect(err.getStatus()).toBe(429);
    expect(respuestaDe(err)).toEqual({
      codigo: 'DEMASIADOS_CODIGOS',
      mensaje: 'Pediste varios códigos seguidos. Espera una hora e inténtalo de nuevo.',
    });
    expect(outbox.encolar).toHaveBeenCalledTimes(3);
  });

  it('consume el código correcto una sola vez', async () => {
    await service.solicitar('912345678');
    const codigo = codigoEnviado();

    await expect(service.consumir('912345678', codigo)).resolves.toBeUndefined();
    await expect(service.consumir('912345678', codigo)).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
  });

  it('código incorrecto: CODIGO_INVALIDO con mensaje genérico', async () => {
    await service.solicitar('912345678');
    const malo = codigoEnviado() === '000000' ? '111111' : '000000';

    const err = await service.consumir('912345678', malo).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse()).toEqual({ codigo: 'CODIGO_INVALIDO', mensaje: 'El código no es correcto o ya venció. Pide uno nuevo.' });
  });

  it('código vencido (ya no está en Redis): CODIGO_INVALIDO', async () => {
    await service.solicitar('912345678');
    const codigo = codigoEnviado();
    redis.datos.clear();
    await expect(service.consumir('912345678', codigo)).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
  });

  it('sin código o con formato malo: CODIGO_INVALIDO', async () => {
    await service.solicitar('912345678');
    await expect(service.consumir('912345678', undefined as any)).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
    await expect(service.consumir('912345678', '12345')).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
  });

  it('demasiados intentos: se invalida el código aunque sea el bueno', async () => {
    await service.solicitar('912345678');
    const codigo = codigoEnviado();
    for (let i = 0; i < 5; i++) {
      await expect(service.consumir('912345678', '000000')).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
    }
    await expect(service.consumir('912345678', codigo)).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
  });

  /** Error de solicitar(): debe ser HttpException 503 con CODIGO_NO_ENVIADO (nunca un «te enviamos»). */
  const noEnviado = async (promesa: Promise<unknown>) => {
    const error: any = await promesa.then(() => null, (e) => e);
    expect(error).not.toBeNull();
    expect(error.getStatus()).toBe(503);
    expect(respuestaDe(error).codigo).toBe('CODIGO_NO_ENVIADO');
    return error;
  };

  it('Redis caído: no responde «te enviamos» ni encola; responde 503 CODIGO_NO_ENVIADO', async () => {
    redis.incr.mockRejectedValueOnce(new Error('redis caído'));
    await noEnviado(service.solicitar('987654321'));
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('sin outbox (el chatbot no está cargado): 503, no finge el envío', async () => {
    const sinOutbox = new CodigoRegistroService(
      prisma,
      { obtenerCliente: () => redis } as any,
      { get: () => 'secreto-de-prueba' } as any,
      { get: (clase: unknown) => (clase === PoliticaEvolutionService ? politica : undefined) } as any,
    );
    await noEnviado(sinOutbox.solicitar('987654321'));
    expect(redis.datos.size).toBe(0);
  });

  it('Evolution fuera de horario: 503 con el aviso de horario, sin guardar código ni encolar', async () => {
    politica.evaluar.mockResolvedValueOnce({ accion: 'DESCARTAR', codigo: 'FUERA_DE_HORARIO', motivo: 'fuera de horario' });
    const error = await noEnviado(service.solicitar('987654321'));
    expect(respuestaDe(error).mensaje).toMatch(/horario/);
    expect(outbox.encolar).not.toHaveBeenCalled();
    expect(redis.datos.size).toBe(0);
  });

  it('Evolution en pausa o con tope (DIFERIR): 503 genérico y sin encolar', async () => {
    politica.evaluar.mockResolvedValueOnce({ accion: 'DIFERIR', esperaMs: 300000, motivo: 'pausa' });
    const error = await noEnviado(service.solicitar('987654321'));
    expect(respuestaDe(error).mensaje).toBe(MENSAJE_NO_ENVIADO);
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('si la cola falla al encolar: 503, no responde éxito', async () => {
    outbox.encolar.mockRejectedValueOnce(new Error('base caída'));
    const resultado = await service.solicitar('987654321').catch((e) => e);
    expect(resultado).not.toEqual(RESPUESTA_CODIGO_REGISTRO);
    expect(resultado.getStatus()).toBe(503);
  });

  it('el celular se normaliza (+51 y espacios) antes de la política y del envío', async () => {
    await service.solicitar('+51 987 654 321');
    expect(politica.evaluar).toHaveBeenCalledWith({ telefono_destino: '51987654321', origen: 'CODIGO_CUENTA' });
    expect(outbox.encolar.mock.calls[0][0].telefono).toBe('51987654321');
  });

  it('token de WhatsApp: el mismo celular (con +51 y espacios) verifica; un @lid no verifica nada', async () => {
    const secreto = 'secreto-de-prueba';
    const token = await iniciarVerificacion(redis as any, secreto, '987654321', 'REGISTRO');
    expect(await atenderMensajeVerificacion(redis as any, secreto, `Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`, '+51 987 654 321')).toBe(RESPUESTA_VERIFICADO);
    expect(redis.datos.get(claveMarcaVerificacion('REGISTRO', '987654321'))).toBe('1');

    const otro = await iniciarVerificacion(redis as any, secreto, '912345678', 'REGISTRO');
    expect(await atenderMensajeVerificacion(redis as any, secreto, `Mi código: ${otro}`, '123456789012345@lid')).toBe(RESPUESTA_NO_VERIFICADO);
    expect(redis.datos.get(claveMarcaVerificacion('REGISTRO', '912345678'))).toBeUndefined();
  });
});

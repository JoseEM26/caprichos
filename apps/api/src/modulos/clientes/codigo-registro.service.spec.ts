jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { register: jest.fn().mockReturnValue({ module: class {} }) } }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { CodigoRegistroService } from './codigo-registro.service';

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

  beforeEach(() => {
    redis = redisFalso();
    prisma = { customerAccount: { findFirst: jest.fn().mockResolvedValue(null) } };
    outbox = { encolar: jest.fn().mockResolvedValue(undefined), despertar: jest.fn() };
    service = new CodigoRegistroService(
      prisma,
      { obtenerCliente: () => redis } as any,
      { get: () => 'secreto-de-prueba' } as any,
      { get: () => outbox } as any,
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

  it('celular que ya tiene cuenta con contraseña: TELEFONO_REGISTRADO y no envía nada', async () => {
    prisma.customerAccount.findFirst.mockResolvedValue({ hash: '$argon2id$x' });
    await expect(service.solicitar('912345678')).rejects.toBeInstanceOf(ConflictException);
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('celular inválido: TELEFONO_INVALIDO', async () => {
    await expect(service.solicitar('812345678')).rejects.toMatchObject({ response: { codigo: 'TELEFONO_INVALIDO' } });
  });

  it('reenvío: pasado el límite por hora responde igual pero no envía', async () => {
    await service.solicitar('912345678');
    await service.solicitar('912345678');
    await service.solicitar('912345678');
    const r = await service.solicitar('912345678');
    expect(r.ok).toBe(true);
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
});

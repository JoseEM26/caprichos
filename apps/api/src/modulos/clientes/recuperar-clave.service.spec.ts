jest.mock('@nestjs/jwt', () => ({ JwtService: class {}, JwtModule: { register: jest.fn().mockReturnValue({ module: class {} }) } }));

import * as argon2 from 'argon2';
import { RECUPERAR_MAX_INTENTOS, RECUPERAR_MAX_SOLICITUDES_HORA, RECUPERAR_TTL_SEG, RecuperarClaveService, RESPUESTA_SOLICITUD } from './recuperar-clave.service';

/** Redis en memoria con TTL simulado (solo lo que usa el servicio). */
function redisFalso() {
  const datos = new Map<string, string>();
  const ttl = new Map<string, number>();
  return {
    datos,
    ttl,
    get: jest.fn(async (k: string) => datos.get(k) ?? null),
    set: jest.fn(async (k: string, v: string, _ex?: string, seg?: number) => {
      datos.set(k, v);
      if (seg) ttl.set(k, seg);
      return 'OK';
    }),
    incr: jest.fn(async (k: string) => {
      const n = Number(datos.get(k) ?? 0) + 1;
      datos.set(k, String(n));
      return n;
    }),
    expire: jest.fn(async (k: string, s: number) => {
      ttl.set(k, s);
      return 1;
    }),
    del: jest.fn(async (...ks: string[]) => {
      ks.forEach((k) => datos.delete(k));
      return 1;
    }),
  };
}

describe('RecuperarClaveService', () => {
  let redis: ReturnType<typeof redisFalso>;
  let prisma: any;
  let auditoria: any;
  let outbox: any;
  let clientes: any;
  let servicio: RecuperarClaveService;

  beforeEach(() => {
    redis = redisFalso();
    // Estos tests son del modo CODIGO_PLANTILLA (código de 6 dígitos); el modo por defecto es WHATSAPP_ENTRANTE
    prisma = {
      customerAccount: { update: jest.fn().mockResolvedValue({}) },
      parametro: { findUnique: jest.fn().mockResolvedValue({ valor: 'CODIGO_PLANTILLA' }) },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    clientes = { cuentaPorCelular: jest.fn().mockResolvedValue({ id: 1n, party_id: 100n, hash: 'x' }) };
    servicio = new RecuperarClaveService(
      prisma,
      { obtenerCliente: () => redis } as any,
      { get: (_k: string, d: string) => d } as any,
      auditoria,
      clientes,
      { get: () => outbox } as any,
      { avisar: jest.fn().mockResolvedValue(undefined) } as any,
    );
  });

  const codigoEnviado = (): string => /es (\d{6})\./.exec(outbox.encolar.mock.calls.at(-1)[0].carga.textoLibre)![1];

  describe('solicitar', () => {
    it('con cuenta: guarda solo el hash con TTL de 10 min y encola el WhatsApp con el texto acordado', async () => {
      const r = await servicio.solicitar('912345678', '1.1.1.1');

      expect(r).toEqual(RESPUESTA_SOLICITUD);
      const dato = outbox.encolar.mock.calls[0][0];
      expect(dato).toMatchObject({ telefono: '51912345678', tipo: 'TEXTO', origen: 'CODIGO_CUENTA' });
      expect(dato.clave).toContain('codigo-cuenta-100');
      expect(dato.carga.textoLibre).toMatch(/^Tu código de Caprichos es \d{6}\. Vence en 10 minutos\. Si no lo pediste, ignora este mensaje\.$/);
      const codigo = codigoEnviado();
      expect(redis.datos.get('cliente:rec:cod:912345678')).toBeDefined();
      expect(redis.datos.get('cliente:rec:cod:912345678')).not.toContain(codigo);
      expect(redis.ttl.get('cliente:rec:cod:912345678')).toBe(RECUPERAR_TTL_SEG);
      expect(outbox.despertar).toHaveBeenCalled();
      // la auditoría no lleva el código ni el celular completo
      const aud = JSON.stringify(auditoria.registrar.mock.calls, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
      expect(aud).not.toContain(codigo);
      expect(aud).not.toContain('912345678');
    });

    it('responde EXACTAMENTE lo mismo exista o no la cuenta, y sin cuenta no envía nada', async () => {
      const conCuenta = await servicio.solicitar('912345678');
      outbox.encolar.mockClear();
      clientes.cuentaPorCelular.mockResolvedValue(null);
      const sinCuenta = await servicio.solicitar('955555555');

      expect(sinCuenta).toEqual(conCuenta);
      expect(outbox.encolar).not.toHaveBeenCalled();
    });

    it('máximo 3 solicitudes por hora por celular: la 4.ª responde igual pero no envía', async () => {
      for (let i = 0; i < RECUPERAR_MAX_SOLICITUDES_HORA; i++) await servicio.solicitar('912345678');
      expect(outbox.encolar).toHaveBeenCalledTimes(3);
      expect(redis.ttl.get('cliente:rec:sol:912345678')).toBe(3600);

      const cuarta = await servicio.solicitar('912345678');
      expect(cuarta).toEqual(RESPUESTA_SOLICITUD);
      expect(outbox.encolar).toHaveBeenCalledTimes(3);
    });

    it('celular con formato inválido: 400 TELEFONO_INVALIDO', async () => {
      await expect(servicio.solicitar('12345')).rejects.toMatchObject({ response: { codigo: 'TELEFONO_INVALIDO' } });
    });

    it('si el outbox falla igual responde lo mismo', async () => {
      outbox.encolar.mockRejectedValue(new Error('boom'));
      expect(await servicio.solicitar('912345678')).toEqual(RESPUESTA_SOLICITUD);
    });
  });

  describe('confirmar', () => {
    const dto = (codigo: string) => ({ telefono: '912345678', codigo, contrasenaNueva: 'NuevaClave2026' });

    it('código correcto: cambia la contraseña (argon2), invalida sesiones, consume el código y audita sin secretos', async () => {
      await servicio.solicitar('912345678');
      const codigo = codigoEnviado();

      const r = await servicio.confirmar(dto(codigo), '1.1.1.1');

      expect(r).toEqual({ ok: true });
      const data = prisma.customerAccount.update.mock.calls[0][0].data;
      expect(await argon2.verify(data.hash, 'NuevaClave2026')).toBe(true);
      expect(data.clave_cambiada_en).toBeInstanceOf(Date);
      expect(data.telefono).toBe('912345678');
      expect(redis.datos.has('cliente:rec:cod:912345678')).toBe(false);
      expect(auditoria.registrar).toHaveBeenLastCalledWith(expect.objectContaining({ accion: 'CLIENTE_CLAVE_CAMBIADA' }));
      const aud = JSON.stringify(auditoria.registrar.mock.calls, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
      expect(aud).not.toContain(codigo);
      expect(aud).not.toContain('NuevaClave2026');

      // el código ya no sirve una segunda vez
      await expect(servicio.confirmar(dto(codigo))).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
    });

    it('código incorrecto, vencido o inexistente: mismo error CODIGO_INVALIDO y no cambia nada', async () => {
      await servicio.solicitar('912345678');
      const malo = codigoEnviado() === '000000' ? '111111' : '000000';
      await expect(servicio.confirmar(dto(malo))).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });

      redis.datos.delete('cliente:rec:cod:912345678'); // venció (TTL)
      await expect(servicio.confirmar(dto('123456'))).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });

      await expect(servicio.confirmar(dto('12ab56'))).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
      expect(prisma.customerAccount.update).not.toHaveBeenCalled();
    });

    it('a los 5 intentos fallidos el código se invalida aunque el 6.º sea el correcto', async () => {
      await servicio.solicitar('912345678');
      const bueno = codigoEnviado();
      const malo = bueno === '000000' ? '111111' : '000000';
      for (let i = 0; i < RECUPERAR_MAX_INTENTOS; i++) {
        await expect(servicio.confirmar(dto(malo))).rejects.toBeDefined();
      }
      await expect(servicio.confirmar(dto(bueno))).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
      expect(prisma.customerAccount.update).not.toHaveBeenCalled();
      expect(redis.datos.has('cliente:rec:cod:912345678')).toBe(false);
    });

    it('contraseña nueva corta: CONTRASENA_CORTA', async () => {
      await servicio.solicitar('912345678');
      await expect(servicio.confirmar({ ...dto(codigoEnviado()), contrasenaNueva: 'corta' })).rejects.toMatchObject({
        response: { codigo: 'CONTRASENA_CORTA' },
      });
    });

    it('pedir un código nuevo reinicia los intentos', async () => {
      await servicio.solicitar('912345678');
      await expect(servicio.confirmar(dto('000001'))).rejects.toBeDefined();
      await servicio.solicitar('912345678');
      expect(redis.datos.has('cliente:rec:int:912345678')).toBe(false);
    });
  });
});

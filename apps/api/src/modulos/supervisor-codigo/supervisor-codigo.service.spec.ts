import { HttpException, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import { SupervisorCodigoService } from './supervisor-codigo.service';
import {
  cifrarSecreto,
  descifrarSecreto,
  derivarClaveCifrado,
  generarTotp,
  calcularSegundosRestantes,
  compararEnTiempoConstante,
} from './totp.util';

describe('SupervisorCodigoService & TOTP Utils', () => {
  describe('Cifrado y descifrado ida y vuelta (AES-256-GCM con HKDF)', () => {
    it('cifra y descifra correctamente un secreto de 20 bytes aleatorios', () => {
      const claveDerivada = derivarClaveCifrado('secreto-prueba-hkdf');
      const secretoOriginal = crypto.randomBytes(20);

      const { secretoCifrado, iv, tag } = cifrarSecreto(secretoOriginal, claveDerivada);
      expect(secretoCifrado).toBeDefined();
      expect(iv).toBeDefined();
      expect(tag).toBeDefined();

      const descifrado = descifrarSecreto(secretoCifrado, iv, tag, claveDerivada);
      expect(descifrado.equals(secretoOriginal)).toBe(true);
    });

    it('falla el descifrado si el auth tag o el texto cifrado son alterados', () => {
      const claveDerivada = derivarClaveCifrado('secreto-prueba-hkdf');
      const secretoOriginal = crypto.randomBytes(20);
      const { secretoCifrado, iv, tag } = cifrarSecreto(secretoOriginal, claveDerivada);

      // Alterar el tag
      const tagInvalido = Buffer.from(tag, 'base64');
      tagInvalido[0] ^= 0xff;
      expect(() =>
        descifrarSecreto(secretoCifrado, iv, tagInvalido.toString('base64'), claveDerivada),
      ).toThrow();
    });
  });

  describe('Vectores de prueba RFC 6238 (HMAC-SHA1, 30 s, 6 dígitos)', () => {
    const secretoRfc = Buffer.from('12345678901234567890', 'ascii');

    it('coincide con los vectores oficiales de RFC 6238 para 6 dígitos', () => {
      expect(generarTotp(secretoRfc, 59)).toBe('287082');
      expect(generarTotp(secretoRfc, 1111111109)).toBe('081804');
      expect(generarTotp(secretoRfc, 1111111111)).toBe('050471');
      expect(generarTotp(secretoRfc, 1234567890)).toBe('005924');
      expect(generarTotp(secretoRfc, 2000000000)).toBe('279037');
    });

    it('calcula los segundos restantes correctamente', () => {
      expect(calcularSegundosRestantes(59)).toBe(1);
      expect(calcularSegundosRestantes(60)).toBe(30);
      expect(calcularSegundosRestantes(75)).toBe(15);
    });

    it('compara códigos en tiempo constante de manera estricta', () => {
      expect(compararEnTiempoConstante('123456', '123456')).toBe(true);
      expect(compararEnTiempoConstante('123456', '123457')).toBe(false);
      expect(compararEnTiempoConstante('12345', '123456')).toBe(false);
      expect(compararEnTiempoConstante('', '123456')).toBe(false);
    });
  });

  describe('SupervisorCodigoService - Reglas de negocio', () => {
    let service: SupervisorCodigoService;
    let prismaMock: any;
    let redisMock: any;
    let auditoriaMock: any;
    let almacenamientoRedis: Map<string, string>;
    let expiraEn: Map<string, number>;

    const secretoFijo20Bytes = Buffer.from('12345678901234567890', 'ascii');
    const claveDerivada = derivarClaveCifrado();
    const datosCifrados = cifrarSecreto(secretoFijo20Bytes, claveDerivada);
    const mockDbRow = {
      local_codigo: 'CAPRICHOS',
      secreto_cifrado: datosCifrados.secretoCifrado,
      iv: datosCifrados.iv,
      tag: datosCifrados.tag,
    };

    beforeEach(() => {
      almacenamientoRedis = new Map();
      expiraEn = new Map();

      redisMock = {
        get: jest.fn(async (key: string) => {
          const vence = expiraEn.get(key);
          if (vence !== undefined && Date.now() >= vence) almacenamientoRedis.delete(key);
          return almacenamientoRedis.get(key) || null;
        }),
        set: jest.fn(async (key: string, val: string, ...args: any[]) => {
          if (args.includes('NX') && (await redisMock.get(key)) !== null) {
            return null; // SET NX falla si la clave ya existe
          }
          almacenamientoRedis.set(key, val);
          if (args[0] === 'EX') expiraEn.set(key, Date.now() + args[1] * 1000);
          return 'OK';
        }),
        ttl: jest.fn(async () => 40),
        scan: jest.fn(async () => ['0', [...almacenamientoRedis.keys()].filter((k) => k.startsWith('pin:supervisor:intentos:'))]),
        del: jest.fn(async (key: string) => {
          almacenamientoRedis.delete(key);
          return 1;
        }),
        incr: jest.fn(async (key: string) => {
          const act = parseInt(almacenamientoRedis.get(key) || '0', 10) + 1;
          almacenamientoRedis.set(key, String(act));
          return act;
        }),
        expire: jest.fn(async () => 1),
      };

      prismaMock = {
        supervisorSecreto: {
          findUnique: jest.fn(),
          upsert: jest.fn(),
        },
        person: { findUnique: jest.fn().mockResolvedValue(null) },
        userAccount: {
          findFirst: jest.fn().mockResolvedValue({ party_id: 1n, id: 10n }),
        },
      };

      auditoriaMock = {
        registrar: jest.fn().mockResolvedValue({}),
      };

      service = new SupervisorCodigoService(
        prismaMock as any,
        { obtenerCliente: () => redisMock } as any,
        auditoriaMock as any,
      );
    });

    it('sin configurar: lanza 409 SUPERVISOR_SIN_CONFIGURAR al consultar o verificar', async () => {
      prismaMock.supervisorSecreto.findUnique.mockResolvedValue(null);

      await expect(service.obtenerCodigoActual(1n)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { codigo: 'SUPERVISOR_SIN_CONFIGURAR' },
      });

      await expect(
        service.verificarYConsumirCodigo('123456', 2n, 'anular_pedido'),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { codigo: 'SUPERVISOR_SIN_CONFIGURAR' },
      });
    });

    it('generar y rotar secreto: persiste cifrado y audita la acción', async () => {
      prismaMock.supervisorSecreto.upsert.mockResolvedValue({});

      const resGen = await service.generarSecreto(1n, '127.0.0.1');
      expect(resGen.ok).toBe(true);
      expect(prismaMock.supervisorSecreto.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { local_codigo: 'CAPRICHOS' },
          create: expect.objectContaining({
            secreto_cifrado: expect.any(String),
            iv: expect.any(String),
            tag: expect.any(String),
          }),
        }),
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'GENERAR_SECRETO' }),
      );

      const resRot = await service.rotarSecreto(1n, '127.0.0.1');
      expect(resRot.ok).toBe(true);
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'ROTAR_SECRETO' }),
      );
    });

    it('obtenerCodigoActual: calcula el TOTP vigente y audita la consulta en pantalla', async () => {
      prismaMock.supervisorSecreto.findUnique.mockResolvedValue(mockDbRow);

      const res = await service.obtenerCodigoActual(1n);
      expect(res.codigo).toMatch(/^\d{6}$/);
      expect(res.segundosRestantes).toBeGreaterThanOrEqual(1);
      expect(res.segundosRestantes).toBeLessThanOrEqual(30);

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'VER_CODIGO',
          categoria: 'ACCESO',
        }),
      );
    });

    it('acepta el código de la ventana actual y lo consume exitosamente', async () => {
      prismaMock.supervisorSecreto.findUnique.mockResolvedValue(mockDbRow);

      const ahora = Math.floor(Date.now() / 1000);
      const codigoValido = generarTotp(secretoFijo20Bytes, ahora);

      const res = await service.verificarYConsumirCodigo(
        codigoValido,
        2n,
        'caja/anular_cobro',
      );
      expect(res.supervisorPartyId).toBe(1n);
      expect(redisMock.del).toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'AUTORIZACION_SUPERVISOR',
          resultado: 'OK',
        }),
      );
    });

    it('acepta el código de la ventana anterior (tolerancia de reloj y cambio de segundo)', async () => {
      prismaMock.supervisorSecreto.findUnique.mockResolvedValue(mockDbRow);

      const ahora = Math.floor(Date.now() / 1000);
      const pasoAnteriorSegundos = (Math.floor(ahora / 30) - 1) * 30;
      const codigoVentanaAnterior = generarTotp(secretoFijo20Bytes, pasoAnteriorSegundos);

      const res = await service.verificarYConsumirCodigo(
        codigoVentanaAnterior,
        2n,
        'caja/anular_cobro',
      );
      expect(res.supervisorPartyId).toBe(1n);
    });

    it('rechaza un código de dos ventanas atrás', async () => {
      prismaMock.supervisorSecreto.findUnique.mockResolvedValue(mockDbRow);

      const ahora = Math.floor(Date.now() / 1000);
      const dosVentanasAtras = (Math.floor(ahora / 30) - 2) * 30;
      const codigoViejo = generarTotp(secretoFijo20Bytes, dosVentanasAtras);

      await expect(
        service.verificarYConsumirCodigo(codigoViejo, 2n, 'caja/anular_cobro'),
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { codigo: 'CODIGO_INVALIDO' },
      });
    });

    it('anti-repetición: un código ya consumido es rechazado en un segundo uso', async () => {
      prismaMock.supervisorSecreto.findUnique.mockResolvedValue(mockDbRow);

      const ahora = Math.floor(Date.now() / 1000);
      const codigoValido = generarTotp(secretoFijo20Bytes, ahora);

      // Primer uso: éxito
      await service.verificarYConsumirCodigo(codigoValido, 2n, 'caja/anular_cobro');

      // Otro operador con el mismo código: rechazado por anti-repetición
      await expect(
        service.verificarYConsumirCodigo(codigoValido, 3n, 'caja/anular_cobro'),
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { codigo: 'CODIGO_INVALIDO' },
      });
    });

    it('bloqueo: 3 intentos fallidos bloquean 5 minutos en Redis (CODIGO_BLOQUEADO 403)', async () => {
      prismaMock.supervisorSecreto.findUnique.mockResolvedValue(mockDbRow);

      const codigoErroneo = '999999';

      // Fallo 1
      await expect(
        service.verificarYConsumirCodigo(codigoErroneo, 2n, 'test'),
      ).rejects.toMatchObject({ status: 403, response: { codigo: 'CODIGO_INVALIDO' } });

      // Fallo 2
      await expect(
        service.verificarYConsumirCodigo(codigoErroneo, 2n, 'test'),
      ).rejects.toMatchObject({ status: 403, response: { codigo: 'CODIGO_INVALIDO' } });

      // Fallo 3
      await expect(
        service.verificarYConsumirCodigo(codigoErroneo, 2n, 'test'),
      ).rejects.toMatchObject({ status: 403, response: { codigo: 'CODIGO_INVALIDO' } });

      // Intento 4: Bloqueado
      await expect(
        service.verificarYConsumirCodigo(codigoErroneo, 2n, 'test'),
      ).rejects.toMatchObject({
        status: 403,
        response: { codigo: 'CODIGO_BLOQUEADO' },
      });
    });

    describe('autorización temporal del operador', () => {
      const codigoDeAhora = () => generarTotp(secretoFijo20Bytes, Math.floor(Date.now() / 1000));

      beforeEach(() => prismaMock.supervisorSecreto.findUnique.mockResolvedValue(mockDbRow));

      it('el mismo código dos veces del mismo operador: la 2.ª pasa y no suma fallo', async () => {
        const c = codigoDeAhora();
        await service.verificarYConsumirCodigo(c, 2n, 'pedidos/anular');
        await service.verificarYConsumirCodigo(c, 2n, 'pedidos/anular');
        await service.verificarYConsumirCodigo(undefined, 2n, 'cierre');
        expect(almacenamientoRedis.get('pin:supervisor:intentos:2')).toBeUndefined();
        expect(auditoriaMock.registrar.mock.calls.filter(([a]: any) => a.accion === 'AUTORIZACION_SUPERVISOR')).toHaveLength(3);
      });

      it('acepta ventana -1 y +1, rechaza ±2 y audita el desfase', async () => {
        const paso = Math.floor(Date.now() / 1000 / 30);
        await service.verificarYConsumirCodigo(generarTotp(secretoFijo20Bytes, (paso + 1) * 30), 4n, 'cierre');
        expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ motivo: expect.stringContaining('+1 paso') }));
        await service.verificarYConsumirCodigo(generarTotp(secretoFijo20Bytes, (paso - 1) * 30), 5n, 'cierre');
        await expect(
          service.verificarYConsumirCodigo(generarTotp(secretoFijo20Bytes, (paso + 2) * 30), 6n, 'cierre'),
        ).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO', mensaje: expect.stringContaining('incorrecto') } });
      });

      it('normaliza espacios, guiones y dígitos de ancho completo', async () => {
        const c = codigoDeAhora();
        const ancho = c.replace(/\d/g, (d) => String.fromCharCode(0xff10 + Number(d)));
        await service.verificarYConsumirCodigo(` ${c.slice(0, 3)} - ${c.slice(3)} `, 7n, 'cierre');
        await service.verificarYConsumirCodigo(ancho, 8n, 'cierre').catch((e) => {
          // mismo código de otro operador: debe ser "ya usado", no "incorrecto"
          expect(e.response.mensaje).toContain('ya fue usado');
        });
      });

      it('la autorización de otro operador no sirve', async () => {
        await service.verificarYConsumirCodigo(codigoDeAhora(), 2n, 'cierre');
        await expect(service.verificarYConsumirCodigo(undefined, 3n, 'cierre')).rejects.toMatchObject({
          response: { codigo: 'CODIGO_INVALIDO' },
        });
      });

      it('vence a los 5 minutos', async () => {
        const t0 = Date.now();
        await service.verificarYConsumirCodigo(codigoDeAhora(), 2n, 'cierre');
        const spy = jest.spyOn(Date, 'now').mockReturnValue(t0 + 5 * 60 * 1000 + 1000);
        await expect(service.verificarYConsumirCodigo(undefined, 2n, 'cierre')).rejects.toMatchObject({
          response: { codigo: 'CODIGO_INVALIDO' },
        });
        spy.mockRestore();
      });

      it('3 códigos incorrectos bloquean con el tiempo restante y el ADMIN desbloquea', async () => {
        for (let i = 0; i < 3; i++) {
          await expect(service.verificarYConsumirCodigo('999999', 2n, 'cierre')).rejects.toMatchObject({ status: 403 });
        }
        await expect(service.verificarYConsumirCodigo('999999', 2n, 'cierre')).rejects.toMatchObject({
          response: {
            codigo: 'CODIGO_BLOQUEADO',
            segundosRestantes: 40,
            mensaje: expect.stringContaining('Espera 1 min'),
          },
        });
        expect(await service.listarBloqueados()).toEqual([
          { partyId: '2', nombre: 'Usuario 2', segundosRestantes: 40 },
        ]);
        await service.desbloquearOperador('2', 1n, '127.0.0.1');
        expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CODIGO_DESBLOQUEADO' }));
        await service.verificarYConsumirCodigo(codigoDeAhora(), 2n, 'cierre');
      });
    });
  });
});

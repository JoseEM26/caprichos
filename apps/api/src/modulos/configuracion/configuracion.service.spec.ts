import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

describe('ConfiguracionService', () => {
  let service: ConfiguracionService;
  let prismaMock: any;
  let auditoriaMock: any;

  const adminAuth: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prismaMock = {
      parametro: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfiguracionService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
      ],
    }).compile();

    service = module.get<ConfiguracionService>(ConfiguracionService);
  });

  describe('listar', () => {
    it('lista los parámetros existentes', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([
        { clave: 'tiempo_prometido_min', valor: 35 },
        { clave: 'pedido_minimo', valor: 25 },
      ]);

      const res = await service.listar();

      expect(res).toHaveLength(2);
      expect(res[0]).toEqual({ clave: 'tiempo_prometido_min', valor: 35 });
      expect(res[1]).toEqual({ clave: 'pedido_minimo', valor: 25 });
    });
  });

  describe('actualizar', () => {
    it('actualiza un parámetro válido con upsert y audita CAMBIO/PARAMETRO con antes y después', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue({
        clave: 'envio_gratis_monto',
        valor: 50,
      });

      prismaMock.parametro.upsert.mockResolvedValue({
        clave: 'envio_gratis_monto',
        valor: 60,
      });

      const res = await service.actualizar(
        'envio_gratis_monto',
        60,
        adminAuth,
        '10.0.0.5',
      );

      expect(res).toEqual({ clave: 'envio_gratis_monto', valor: 60 });
      expect(prismaMock.parametro.upsert).toHaveBeenCalledWith({
        where: { clave: 'envio_gratis_monto' },
        update: { valor: 60 },
        create: { clave: 'envio_gratis_monto', valor: 60 },
      });

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'configuracion',
          accion: 'PARAMETRO',
          resultado: 'OK',
          entidad: 'parametro',
          antes: { clave: 'envio_gratis_monto', valor: 50 },
          despues: { clave: 'envio_gratis_monto', valor: 60 },
          partyId: 1n,
          ip: '10.0.0.5',
        }),
      );
    });

    it('parámetro desconocido → rechaza con 400 CLAVE_DESCONOCIDA', async () => {
      await expect(
        service.actualizar('clave_inexistente_random', 10, adminAuth),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.actualizar('clave_inexistente_random', 10, adminAuth);
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'CLAVE_DESCONOCIDA',
          }),
        );
      }
    });

    it('valor no numérico o negativo para clave numérica → rechaza con 400 VALOR_INVALIDO', async () => {
      await expect(
        service.actualizar('pedido_minimo', -10, adminAuth),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.actualizar('pedido_minimo', -10, adminAuth);
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'VALOR_INVALIDO',
          }),
        );
      }

      await expect(
        service.actualizar('pedido_minimo', NaN, adminAuth),
      ).rejects.toThrow(BadRequestException);
    });

    it('valor no texto para clave de texto → rechaza con 400 VALOR_INVALIDO', async () => {
      await expect(
        service.actualizar('envio_gratis_modo', 123, adminAuth),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.actualizar('envio_gratis_modo', '   ', adminAuth),
      ).rejects.toThrow(BadRequestException);
    });

    it('valida que chatbot_activo acepte solo "si" o "no"', async () => {
      prismaMock.parametro.findUnique.mockResolvedValueOnce({ clave: 'chatbot_activo', valor: 'no' });
      prismaMock.parametro.upsert.mockResolvedValueOnce({ clave: 'chatbot_activo', valor: 'si' });

      const res = await service.actualizar('chatbot_activo', 'si', adminAuth);
      expect(res.valor).toBe('si');

      await expect(
        service.actualizar('chatbot_activo', 'invalido', adminAuth),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite todas las claves válidas especificadas', async () => {
      const clavesNumericas = [
        'tiempo_prometido_min',
        'tiempo_max_min',
        'envio_gratis_monto',
        'pedido_minimo',
        'tolerancia_reserva_min',
        'puntos_porcentaje',
        'descuento_personal_pct',
        'rep_naranja_min',
        'rep_rojo_min',
        'rep_max_pedidos',
      ];

      for (const clave of clavesNumericas) {
        prismaMock.parametro.findUnique.mockResolvedValue(null);
        prismaMock.parametro.upsert.mockResolvedValue({ clave, valor: 5 });

        const res = await service.actualizar(clave, 5, adminAuth);
        expect(res.clave).toBe(clave);
      }

      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({
        clave: 'envio_gratis_modo',
        valor: 'MONTO',
      });
      const resModo = await service.actualizar('envio_gratis_modo', 'MONTO', adminAuth);
      expect(resModo.valor).toBe('MONTO');

      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({
        clave: 'carta_aviso_entrada',
        valor: 'si',
      });
      const resAviso = await service.actualizar('carta_aviso_entrada', true, adminAuth);
      expect(resAviso.valor).toBe('si');

      await expect(
        service.actualizar('carta_aviso_entrada', 'quizas', adminAuth),
      ).rejects.toThrow(BadRequestException);
    });

    it('protección contra spam: acepta valores en rango y rechaza con 400 los de fuera', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockImplementation(async ({ create }: any) => create);
      const casos: Array<[string, number, number, number]> = [
        ['spam_bloqueo_excesos', 1, 20, 3],
        ['spam_bloqueo_min', 5, 1440, 60],
        ['spam_bloqueo_reincidente_min', 60, 10080, 1440],
        ['whatsapp_max_pedidos_sin_pagar', 1, 10, 3],
        ['chatbot_antispam_max_minuto', 3, 60, 10],
        ['chatbot_antispam_max_hora', 10, 600, 60],
      ];
      for (const [clave, min, max, ok] of casos) {
        await expect(service.actualizar(clave, ok, adminAuth)).resolves.toMatchObject({ clave });
        await expect(service.actualizar(clave, min, adminAuth)).resolves.toMatchObject({ clave });
        await expect(service.actualizar(clave, max, adminAuth)).resolves.toMatchObject({ clave });
        await expect(service.actualizar(clave, min - 1, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
        await expect(service.actualizar(clave, max + 1, adminAuth)).rejects.toThrow(BadRequestException);
        await expect(service.actualizar(clave, ok + 0.5, adminAuth)).rejects.toThrow(BadRequestException);
      }
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'PARAMETRO' }));
    });

    it('valida rangos y orden ascendente en parámetros de reparto', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([
        { clave: 'reparto_retrasado_min', valor: 20 },
        { clave: 'reparto_tarde_min', valor: 30 },
        { clave: 'reparto_muy_tarde_min', valor: 45 },
      ]);
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({ clave: 'reparto_retrasado_min', valor: 22 });

      const res = await service.actualizar('reparto_retrasado_min', 22, adminAuth);
      expect(res.clave).toBe('reparto_retrasado_min');

      // Violación de orden ascendente (retrasado >= tarde)
      await expect(
        service.actualizar('reparto_retrasado_min', 35, adminAuth),
      ).rejects.toThrow(BadRequestException);

      // Violación de rango
      await expect(
        service.actualizar('reparto_velocidad_kmh', 2, adminAuth),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('actualizarPausaAltaDemanda', () => {
    it('activa la pausa por alta demanda y audita', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue({
        clave: 'pausa_alta_demanda',
        valor: { activa: false, motivo: null },
      });

      prismaMock.parametro.upsert.mockResolvedValue({
        clave: 'pausa_alta_demanda',
        valor: { activa: true, motivo: 'Demasiados pedidos en cola' },
      });

      const res = await service.actualizarPausaAltaDemanda(
        { activa: true, motivo: 'Demasiados pedidos en cola' },
        adminAuth,
        '127.0.0.1',
      );

      expect(res.clave).toBe('pausa_alta_demanda');
      expect((res.valor as any)?.activa).toBe(true);
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'configuracion',
          accion: 'PAUSA_ALTA_DEMANDA',
          despues: {
            clave: 'pausa_alta_demanda',
            valor: { activa: true, motivo: 'Demasiados pedidos en cola' },
          },
        }),
      );
    });
  });
});

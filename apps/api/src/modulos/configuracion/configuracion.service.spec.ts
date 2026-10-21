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

    it('valor no numérico o negativo → rechaza con 400 VALOR_INVALIDO', async () => {
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

    it('permite todas las claves válidas especificadas', async () => {
      const clavesValidas = [
        'tiempo_prometido_min',
        'envio_gratis_monto',
        'pedido_minimo',
        'tolerancia_reserva_min',
        'puntos_porcentaje',
        'descuento_personal_pct',
      ];

      for (const clave of clavesValidas) {
        prismaMock.parametro.findUnique.mockResolvedValue(null);
        prismaMock.parametro.upsert.mockResolvedValue({ clave, valor: 5 });

        const res = await service.actualizar(clave, 5, adminAuth);
        expect(res.clave).toBe(clave);
      }
    });
  });
});

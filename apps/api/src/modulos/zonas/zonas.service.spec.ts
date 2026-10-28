import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ZonasService } from './zonas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { puntoEnPoligono, tieneAutoIntersecciones, validarPoligono } from './zonas.util';
import { Coordenada } from './zonas.tipos';

describe('ZonasService', () => {
  let service: ZonasService;
  let prisma: any;
  let auditoria: any;

  // Polígono cuadrado centrado: lat [-12.10 a -12.00], lng [-77.05 a -76.95]
  const poligonoZ4: Coordenada[] = [
    [-12.10, -77.05],
    [-12.00, -77.05],
    [-12.00, -76.95],
    [-12.10, -76.95],
  ];

  // Polígono más pequeño que se superpone parcialmente: lat [-12.05 a -12.00], lng [-77.05 a -77.00]
  const poligonoZ2: Coordenada[] = [
    [-12.05, -77.05],
    [-12.00, -77.05],
    [-12.00, -77.00],
    [-12.05, -77.00],
  ];

  beforeEach(async () => {
    prisma = {
      zonaReparto: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      parametro: {
        findUnique: jest.fn(),
      },
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZonasService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
      ],
    }).compile();

    service = module.get<ZonasService>(ZonasService);
  });

  describe('Utilidades geométricas (Ray Casting y Polígonos)', () => {
    it('puntoEnPoligono detecta correctamente puntos interiores y exteriores', () => {
      // Punto interior
      expect(puntoEnPoligono(-12.05, -77.00, poligonoZ4)).toBe(true);

      // Punto exterior
      expect(puntoEnPoligono(-11.50, -76.00, poligonoZ4)).toBe(false);
      expect(puntoEnPoligono(-12.15, -77.00, poligonoZ4)).toBe(false);
    });

    it('tieneAutoIntersecciones detecta polígonos simples y complejos', () => {
      // Polígono cuadrado simple: sin autointersecciones
      expect(tieneAutoIntersecciones(poligonoZ4)).toBe(false);

      // Polígono en forma de moño / pajarita (aristas cruzadas)
      const cruzado: Coordenada[] = [
        [0, 0],
        [10, 10],
        [0, 10],
        [10, 0],
      ];
      expect(tieneAutoIntersecciones(cruzado)).toBe(true);
    });

    it('validarPoligono rechaza menos de 3 puntos y coordenadas inválidas', () => {
      expect(validarPoligono([[0, 0], [1, 1]]).valido).toBe(false);
      expect(validarPoligono([[0, 0], [1, 1], [95, 0]]).valido).toBe(false); // lat > 90
      expect(validarPoligono([[0, 0], [1, 1], [0, 200]]).valido).toBe(false); // lng > 180
      expect(validarPoligono(poligonoZ4).valido).toBe(true);
    });
  });

  describe('1. Punto dentro y fuera de zona de reparto', () => {
    it('debe detectar la zona y devolver tarifa cuando el punto está dentro', async () => {
      prisma.zonaReparto.findMany.mockResolvedValue([
        {
          id: BigInt(4),
          codigo: 'Z4',
          tarifa: 4.5,
          activa: true,
          poligono: poligonoZ4,
        },
      ]);

      const resultado = await service.detectar(-12.05, -77.00);

      expect(resultado).not.toBeNull();
      expect(resultado?.codigo).toBe('Z4');
      expect(resultado?.tarifa).toBe(4.5);
      expect(resultado?.zonaId).toBe(BigInt(4));
    });

    it('debe devolver null cuando el punto está fuera de todas las zonas', async () => {
      prisma.zonaReparto.findMany.mockResolvedValue([
        {
          id: BigInt(4),
          codigo: 'Z4',
          tarifa: 4.5,
          activa: true,
          poligono: poligonoZ4,
        },
      ]);

      const resultado = await service.detectar(-15.00, -75.00);
      expect(resultado).toBeNull();
    });

    it('si cae en dos zonas superpuestas gana la de menor código', async () => {
      // Z2 y Z4 se superponen en [-12.02, -77.02]
      prisma.zonaReparto.findMany.mockResolvedValue([
        {
          id: BigInt(2),
          codigo: 'Z2',
          tarifa: 2.0,
          activa: true,
          poligono: poligonoZ2,
        },
        {
          id: BigInt(4),
          codigo: 'Z4',
          tarifa: 4.0,
          activa: true,
          poligono: poligonoZ4,
        },
      ]);

      const resultado = await service.detectar(-12.02, -77.02);

      expect(resultado?.codigo).toBe('Z2');
      expect(resultado?.tarifa).toBe(2.0);
    });
  });

  describe('2. Zona apagada no cubre', () => {
    it('una zona apagada (activa=false) es tratada como fuera de cobertura', async () => {
      // findMany filtra activa: true
      prisma.zonaReparto.findMany.mockResolvedValue([]);

      const resultado = await service.detectar(-12.05, -77.00);
      expect(resultado).toBeNull();

      expect(prisma.zonaReparto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { activa: true },
        }),
      );
    });
  });

  describe('3. Validación de polígono: polígono con 2 puntos -> 400 POLIGONO_INVALIDO', () => {
    it('debe lanzar 400 POLIGONO_INVALIDO si el polígono tiene menos de 3 puntos', async () => {
      await expect(
        service.editarPoligono('Z4', {
          poligono: [
            [-12.05, -77.05],
            [-12.00, -77.00],
          ],
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'POLIGONO_INVALIDO',
          }),
        }),
      );

      // No debe actualizar BD si la validación falla
      expect(prisma.zonaReparto.update).not.toHaveBeenCalled();
    });

    it('debe lanzar 400 POLIGONO_INVALIDO si el polígono tiene autointersecciones', async () => {
      await expect(
        service.editarPoligono('Z4', {
          poligono: [
            [0, 0],
            [10, 10],
            [0, 10],
            [10, 0],
          ],
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'POLIGONO_INVALIDO',
          }),
        }),
      );
    });
  });

  describe('4. Cambio de tarifa audita', () => {
    it('debe actualizar la tarifa y registrar auditoría con acción EDITAR_TARIFA', async () => {
      prisma.zonaReparto.findUnique.mockResolvedValue({
        id: BigInt(4),
        codigo: 'Z4',
        tarifa: 4.0,
        activa: true,
        poligono: poligonoZ4,
      });

      prisma.zonaReparto.update.mockResolvedValue({
        id: BigInt(4),
        codigo: 'Z4',
        tarifa: 5.5,
        activa: true,
        poligono: poligonoZ4,
      });

      const usuarioMock: any = { partyId: BigInt(10), rol: 'ADMIN' };
      const res = await service.editarTarifa('Z4', { tarifa: 5.5 }, usuarioMock, '192.168.1.10');

      expect(res.tarifa).toBe(5.5);
      expect(prisma.zonaReparto.update).toHaveBeenCalledWith({
        where: { codigo: 'Z4' },
        data: { tarifa: 5.5 },
      });

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'zonas',
          accion: 'EDITAR_TARIFA',
          resultado: 'OK',
          entidad: 'zona_reparto',
          entidadId: BigInt(4),
          antes: { codigo: 'Z4', tarifa: 4.0 },
          despues: { codigo: 'Z4', tarifa: 5.5 },
          partyId: BigInt(10),
          ip: '192.168.1.10',
        }),
      );
    });

    it('debe rechazar tarifa negativa con 400 TARIFA_INVALIDA', async () => {
      await expect(service.editarTarifa('Z4', { tarifa: -2.0 })).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'TARIFA_INVALIDA',
          }),
        }),
      );
    });
  });

  describe('5. Latitud o longitud fuera de rango -> 400 PUNTO_INVALIDO', () => {
    it('debe lanzar 400 PUNTO_INVALIDO si lat > 90 o lat < -90', async () => {
      await expect(service.consultarEnvio(95, -77.00)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'PUNTO_INVALIDO',
          }),
        }),
      );

      await expect(service.consultarEnvio(-95, -77.00)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'PUNTO_INVALIDO',
          }),
        }),
      );
    });

    it('debe lanzar 400 PUNTO_INVALIDO si lng > 180 o lng < -180', async () => {
      await expect(service.consultarEnvio(-12.00, 185)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'PUNTO_INVALIDO',
          }),
        }),
      );
    });

    it('GET /carta/envio devuelve estructura correcta con gratisDesde', async () => {
      prisma.zonaReparto.findMany.mockResolvedValue([
        {
          id: BigInt(4),
          codigo: 'Z4',
          tarifa: 4.0,
          activa: true,
          poligono: poligonoZ4,
        },
      ]);
      prisma.parametro.findUnique.mockResolvedValue({
        clave: 'envio_gratis_monto',
        valor: 80,
      });

      const res = await service.consultarEnvio(-12.05, -77.00);

      expect(res).toEqual({
        cubierto: true,
        zona: 'Z4',
        tarifa: 4.0,
        tarifaZona: 4.0,
        gratisDesde: 80,
        modoGratis: 'mas_de',
      });
    });

    it('GET /carta/envio lee envio_gratis_modo "desde" y acepta el monto como texto', async () => {
      prisma.zonaReparto.findMany.mockResolvedValue([
        { id: 4n, codigo: 'Z4', tarifa: 4, activa: true, poligono: poligonoZ4 },
      ]);
      prisma.parametro.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.clave === 'envio_gratis_monto'
            ? { clave: where.clave, valor: '70' }
            : { clave: where.clave, valor: 'desde' },
        ),
      );

      const res = await service.consultarEnvio(-12.05, -77.00);

      expect(res).toMatchObject({ cubierto: true, gratisDesde: 70, modoGratis: 'desde', tarifaZona: 4 });
    });

    it('GET /carta/envio fuera de cobertura devuelve cubierto: false y gratisDesde por defecto 70', async () => {
      prisma.zonaReparto.findMany.mockResolvedValue([]);
      prisma.parametro.findUnique.mockResolvedValue(null);

      const res = await service.consultarEnvio(-12.05, -77.00);

      expect(res).toEqual({
        cubierto: false,
        zona: null,
        tarifa: null,
        tarifaZona: null,
        modoGratis: 'mas_de',
        gratisDesde: 70,
      });
    });
  });

  describe('tarifaDe y edición de estado activa', () => {
    it('tarifaDe retorna la tarifa de la zona por id', async () => {
      prisma.zonaReparto.findUnique.mockResolvedValue({
        id: BigInt(4),
        tarifa: 4.5,
      });

      const tarifa = await service.tarifaDe(BigInt(4));
      expect(tarifa).toBe(4.5);
    });

    it('editarActiva actualiza estado y audita', async () => {
      prisma.zonaReparto.findUnique.mockResolvedValue({
        id: BigInt(7),
        codigo: 'Z7',
        activa: true,
        tarifa: 7.0,
        poligono: [],
      });
      prisma.zonaReparto.update.mockResolvedValue({
        id: BigInt(7),
        codigo: 'Z7',
        activa: false,
        tarifa: 7.0,
        poligono: [],
      });

      const res = await service.editarActiva('Z7', { activa: false });
      expect(res.activa).toBe(false);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'EDITAR_ESTADO',
          entidad: 'zona_reparto',
          antes: { codigo: 'Z7', activa: true },
          despues: { codigo: 'Z7', activa: false },
        }),
      );
    });
  });
});

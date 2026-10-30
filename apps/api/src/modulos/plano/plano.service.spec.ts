jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PlanoService } from './plano.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { obtenerRangoHoyLima } from './plano.util';

describe('PlanoService', () => {
  let service: PlanoService;
  let prisma: any;
  let auditoria: any;
  let eventosGateway: any;

  beforeEach(async () => {
    prisma = {
      piso: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      elementoPlano: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      pedidoMesa: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      reservaMesa: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    eventosGateway = {
      emitirAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanoService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: eventosGateway },
      ],
    }).compile();

    service = module.get<PlanoService>(PlanoService);
  });

  // =========================================================================
  // 1. OBTENER PLANO Y MESAS ACTIVAS
  // =========================================================================
  describe('obtenerPlano y obtenerMesasActivas', () => {
    it('debe devolver pisos con sus elementos y los totales por piso (RQ-SAL-01-08)', async () => {
      prisma.piso.findMany.mockResolvedValue([
        {
          id: 1n,
          nombre: 'Piso 1',
          activo: true,
          cuadricula_ancho: 20,
          cuadricula_alto: 12,
          elementos: [
            {
              id: 101n,
              piso_id: 1n,
              tipo: 'MESA',
              nombre: 'Mesa 1',
              x: 2,
              y: 5,
              ancho: 2,
              alto: 2,
              numero: 1,
              asientos: 4,
              activo: true,
            },
            {
              id: 102n,
              piso_id: 1n,
              tipo: 'MESA',
              nombre: 'Mesa 2',
              x: 5,
              y: 5,
              ancho: 2,
              alto: 2,
              numero: 2,
              asientos: 2,
              activo: false,
            },
            {
              id: 103n,
              piso_id: 1n,
              tipo: 'PARED',
              nombre: 'Pared',
              x: 0,
              y: 0,
              ancho: 20,
              alto: 1,
              numero: null,
              asientos: null,
              activo: true,
            },
          ],
        },
      ]);

      const resultado = await service.obtenerPlano();

      expect(resultado).toHaveLength(1);
      const piso = resultado[0];
      expect(piso.id).toBe('1');
      expect(piso.nombre).toBe('Piso 1');
      expect(piso.mesas).toBe(2);
      expect(piso.mesasActivas).toBe(1);
      expect(piso.asientosTotales).toBe(6);
      expect(piso.totales).toEqual({
        mesas: 2,
        asientosTotales: 6,
        mesasActivas: 1,
      });
      expect(piso.elementos).toHaveLength(3);
      expect(piso.elementos[0].id).toBe('101');
    });

    it('debe listar mesas activas en formato plano', async () => {
      prisma.elementoPlano.findMany.mockResolvedValue([
        {
          id: 101n,
          piso_id: 1n,
          tipo: 'MESA',
          nombre: 'Mesa 1',
          x: 2,
          y: 5,
          ancho: 2,
          alto: 2,
          numero: 1,
          asientos: 4,
          activo: true,
          piso: { id: 1n, nombre: 'Piso 1' },
        },
      ]);

      const mesas = await service.obtenerMesasActivas();
      expect(mesas).toHaveLength(1);
      expect(mesas[0]).toEqual({
        id: '101',
        numero: 1,
        nombre: 'Mesa 1',
        asientos: 4,
        pisoId: '1',
        pisoNombre: 'Piso 1',
        piso: 'Piso 1',
        x: 2,
        y: 5,
        ancho: 2,
        alto: 2,
        activo: true,
      });
    });
  });

  // =========================================================================
  // 2. PISO 1 NO DESACTIVABLE Y CAMBIO DE CUADRÍCULA
  // =========================================================================
  describe('actualizarPiso', () => {
    it('rechaza desactivar el piso 1 con 409 PISO_PRINCIPAL', async () => {
      prisma.piso.findUnique.mockResolvedValue({
        id: 1n,
        nombre: 'Piso 1',
        activo: true,
        cuadricula_ancho: 20,
        cuadricula_alto: 12,
        elementos: [],
      });

      await expect(
        service.actualizarPiso('1', { activo: false }),
      ).rejects.toThrow(ConflictException);

      try {
        await service.actualizarPiso('1', { activo: false });
      } catch (e: any) {
        expect(e.response.codigo).toBe('PISO_PRINCIPAL');
      }
    });

    it('permite desactivar el piso 2 u otros pisos', async () => {
      prisma.piso.findUnique.mockResolvedValue({
        id: 2n,
        nombre: 'Piso 2',
        activo: true,
        cuadricula_ancho: 20,
        cuadricula_alto: 12,
        elementos: [],
      });

      prisma.piso.update.mockResolvedValue({
        id: 2n,
        nombre: 'Piso 2',
        activo: false,
        cuadricula_ancho: 20,
        cuadricula_alto: 12,
        elementos: [],
      });

      const res = await service.actualizarPiso('2', { activo: false });
      expect(res.activo).toBe(false);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'ACTUALIZAR_PISO' }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith(
        'plano:cambio',
        expect.objectContaining({ tipo: 'PISO_ACTUALIZADO', pisoId: '2' }),
      );
    });

    it('al cambiar cuadrícula rechaza con 409 ELEMENTOS_FUERA si algún elemento queda fuera', async () => {
      prisma.piso.findUnique.mockResolvedValue({
        id: 2n,
        nombre: 'Piso 2',
        activo: false,
        cuadricula_ancho: 20,
        cuadricula_alto: 12,
        elementos: [
          {
            id: 201n,
            tipo: 'MESA',
            nombre: 'Mesa 11',
            x: 15,
            y: 8,
            ancho: 2,
            alto: 2,
            numero: 11,
          },
        ],
      });

      // Reducir cuadrícula a 14 x 10 dejaría x + ancho (15 + 2 = 17) fuera de 14
      await expect(
        service.actualizarPiso('2', { cuadriculaAncho: 14 }),
      ).rejects.toThrow(ConflictException);

      try {
        await service.actualizarPiso('2', { cuadriculaAncho: 14 });
      } catch (e: any) {
        expect(e.response.codigo).toBe('ELEMENTOS_FUERA');
        expect(e.response.elementos).toHaveLength(1);
        expect(e.response.elementos[0].id).toBe('201');
      }
    });

    it('crea un nuevo piso desactivado por defecto', async () => {
      prisma.piso.create.mockResolvedValue({
        id: 3n,
        nombre: 'Terraza',
        activo: false,
        cuadricula_ancho: 15,
        cuadricula_alto: 10,
        elementos: [],
      });

      const creado = await service.crearPiso({
        nombre: 'Terraza',
        cuadriculaAncho: 15,
        cuadriculaAlto: 10,
      });

      expect(creado.activo).toBe(false);
      expect(creado.id).toBe('3');
      expect(prisma.piso.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nombre: 'Terraza',
          activo: false,
          cuadricula_ancho: 15,
          cuadricula_alto: 10,
        }),
        include: { elementos: true },
      });
    });
  });

  // =========================================================================
  // 3. NÚMERO SIGUIENTE DE MESA Y VALIDACIÓN DE ASIENTOS
  // =========================================================================
  describe('crearElemento: número siguiente de mesa', () => {
    it('una mesa nueva toma el número siguiente al mayor que exista entre todos los pisos', async () => {
      prisma.piso.findUnique.mockResolvedValue({
        id: 2n,
        cuadricula_ancho: 20,
        cuadricula_alto: 12,
      });
      prisma.elementoPlano.findMany.mockResolvedValue([]);
      // Supongamos que la mesa con mayor número actual es la 14
      prisma.elementoPlano.findFirst.mockResolvedValue({
        id: 114n,
        tipo: 'MESA',
        numero: 14,
      });

      prisma.elementoPlano.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 115n,
          ...data,
        }),
      );

      const nuevaMesa = await service.crearElemento({
        pisoId: '2',
        tipo: 'MESA',
        x: 4,
        y: 4,
        ancho: 2,
        alto: 2,
        asientos: 4,
      });

      expect(nuevaMesa.numero).toBe(15);
      expect(nuevaMesa.asientos).toBe(4);
      expect(nuevaMesa.nombre).toBe('Mesa 15');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'CREAR_ELEMENTO' }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith(
        'plano:cambio',
        expect.objectContaining({ tipo: 'ELEMENTO_CREADO' }),
      );
    });

    it('asigna número 1 si aún no existen mesas registradas', async () => {
      prisma.piso.findUnique.mockResolvedValue({
        id: 1n,
        cuadricula_ancho: 20,
        cuadricula_alto: 12,
      });
      prisma.elementoPlano.findMany.mockResolvedValue([]);
      prisma.elementoPlano.findFirst.mockResolvedValue(null);

      prisma.elementoPlano.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 101n,
          ...data,
        }),
      );

      const nuevaMesa = await service.crearElemento({
        pisoId: '1',
        tipo: 'MESA',
        x: 1,
        y: 1,
        ancho: 2,
        alto: 2,
        asientos: 2,
      });

      expect(nuevaMesa.numero).toBe(1);
    });

    it('exige asientos >= 1 para crear una mesa', async () => {
      prisma.piso.findUnique.mockResolvedValue({
        id: 1n,
        cuadricula_ancho: 20,
        cuadricula_alto: 12,
      });

      await expect(
        service.crearElemento({
          pisoId: '1',
          tipo: 'MESA',
          x: 1,
          y: 1,
          ancho: 2,
          alto: 2,
          asientos: 0,
        }),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.crearElemento({
          pisoId: '1',
          tipo: 'MESA',
          x: 1,
          y: 1,
          ancho: 2,
          alto: 2,
        });
      } catch (e: any) {
        expect(e.response.codigo).toBe('ASIENTOS_REQUERIDOS');
      }
    });
  });

  // =========================================================================
  // 4. SUPERPOSICIÓN DE ELEMENTOS
  // =========================================================================
  describe('crearElemento y actualizarElemento: superposición', () => {
    it('rechaza con 409 SUPERPUESTO si se superpone con otro elemento ACTIVO del piso', async () => {
      prisma.piso.findUnique.mockResolvedValue({
        id: 1n,
        cuadricula_ancho: 20,
        cuadricula_alto: 12,
      });

      // Elemento activo en (2, 5) con 2x2 (abarca x: 2..3, y: 5..6)
      prisma.elementoPlano.findMany.mockResolvedValue([
        {
          id: 1n,
          piso_id: 1n,
          tipo: 'MESA',
          x: 2,
          y: 5,
          ancho: 2,
          alto: 2,
          activo: true,
        },
      ]);

      // Intento colocar otro elemento en (3, 5) con 2x2 -> solapa en x=3
      await expect(
        service.crearElemento({
          pisoId: '1',
          tipo: 'MESA',
          x: 3,
          y: 5,
          ancho: 2,
          alto: 2,
          asientos: 4,
        }),
      ).rejects.toThrow(ConflictException);

      try {
        await service.crearElemento({
          pisoId: '1',
          tipo: 'MESA',
          x: 3,
          y: 5,
          ancho: 2,
          alto: 2,
          asientos: 4,
        });
      } catch (e: any) {
        expect(e.response.codigo).toBe('SUPERPUESTO');
      }
    });

    it('permite elementos adyacentes que comparten borde sin solaparse', async () => {
      prisma.piso.findUnique.mockResolvedValue({
        id: 1n,
        cuadricula_ancho: 20,
        cuadricula_alto: 12,
      });

      // Elemento existente en (0, 0) con 2x2 (x: 0..1, y: 0..1)
      prisma.elementoPlano.findMany.mockResolvedValue([
        {
          id: 1n,
          piso_id: 1n,
          tipo: 'MESA',
          x: 0,
          y: 0,
          ancho: 2,
          alto: 2,
          activo: true,
        },
      ]);

      prisma.elementoPlano.findFirst.mockResolvedValue(null);
      prisma.elementoPlano.create.mockResolvedValue({
        id: 2n,
        piso_id: 1n,
        tipo: 'MESA',
        nombre: 'Mesa 1',
        x: 2,
        y: 0,
        ancho: 2,
        alto: 2,
        numero: 1,
        asientos: 4,
        activo: true,
      });

      // Colocar en (2, 0) con 2x2 toca el borde x=2 pero no se solapa
      const creado = await service.crearElemento({
        pisoId: '1',
        tipo: 'MESA',
        x: 2,
        y: 0,
        ancho: 2,
        alto: 2,
        asientos: 4,
      });

      expect(creado.id).toBe('2');
    });

    it('no genera conflicto si el elemento existente está DESACTIVADO', async () => {
      prisma.piso.findUnique.mockResolvedValue({
        id: 1n,
        cuadricula_ancho: 20,
        cuadricula_alto: 12,
      });

      // Solo busca activos
      prisma.elementoPlano.findMany.mockResolvedValue([]);
      prisma.elementoPlano.findFirst.mockResolvedValue(null);
      prisma.elementoPlano.create.mockResolvedValue({
        id: 3n,
        piso_id: 1n,
        tipo: 'MESA',
        nombre: 'Mesa 1',
        x: 2,
        y: 5,
        ancho: 2,
        alto: 2,
        numero: 1,
        asientos: 4,
        activo: true,
      });

      const res = await service.crearElemento({
        pisoId: '1',
        tipo: 'MESA',
        x: 2,
        y: 5,
        ancho: 2,
        alto: 2,
        asientos: 4,
      });

      expect(res.id).toBe('3');
    });
  });

  // =========================================================================
  // 5. GIRAR QUE CABE Y QUE NO CABE
  // =========================================================================
  describe('girarElemento', () => {
    it('gira elemento intercambiando ancho y alto si cabe', async () => {
      // Entrada de 4x1 en (8, 5) dentro de piso 20x12 -> al girar queda 1x4 en (8, 5)
      prisma.elementoPlano.findUnique.mockResolvedValue({
        id: 6n,
        piso_id: 1n,
        tipo: 'ENTRADA',
        x: 8,
        y: 5,
        ancho: 4,
        alto: 1,
        activo: true,
        piso: { id: 1n, cuadricula_ancho: 20, cuadricula_alto: 12 },
      });

      prisma.elementoPlano.findMany.mockResolvedValue([]);
      prisma.elementoPlano.update.mockResolvedValue({
        id: 6n,
        piso_id: 1n,
        tipo: 'ENTRADA',
        x: 8,
        y: 5,
        ancho: 1,
        alto: 4,
        activo: true,
      });

      const girado = await service.girarElemento('6');
      expect(girado.ancho).toBe(1);
      expect(girado.alto).toBe(4);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'GIRAR_ELEMENTO' }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith(
        'plano:cambio',
        expect.objectContaining({ tipo: 'ELEMENTO_GIRADO', elementoId: '6' }),
      );
    });

    it('rechaza con 409 NO_CABE si al girar excede los límites de la cuadrícula', async () => {
      // Elemento de 4x1 en (8, 11) en piso 20x12 -> al girar requeriría y + alto = 11 + 4 = 15 > 12
      prisma.elementoPlano.findUnique.mockResolvedValue({
        id: 6n,
        piso_id: 1n,
        tipo: 'ENTRADA',
        x: 8,
        y: 11,
        ancho: 4,
        alto: 1,
        activo: true,
        piso: { id: 1n, cuadricula_ancho: 20, cuadricula_alto: 12 },
      });

      await expect(service.girarElemento('6')).rejects.toThrow(
        ConflictException,
      );

      try {
        await service.girarElemento('6');
      } catch (e: any) {
        expect(e.response.codigo).toBe('NO_CABE');
      }
    });

    it('rechaza con 409 NO_CABE si al girar se superpone con otro elemento activo', async () => {
      // Elemento de 4x1 en (8, 5) -> al girar 1x4 abarcaría x: 8, y: 5..8
      prisma.elementoPlano.findUnique.mockResolvedValue({
        id: 6n,
        piso_id: 1n,
        tipo: 'ENTRADA',
        x: 8,
        y: 5,
        ancho: 4,
        alto: 1,
        activo: true,
        piso: { id: 1n, cuadricula_ancho: 20, cuadricula_alto: 12 },
      });

      // Hay una mesa activa en (8, 7) con 2x2
      prisma.elementoPlano.findMany.mockResolvedValue([
        {
          id: 8n,
          piso_id: 1n,
          tipo: 'MESA',
          x: 8,
          y: 7,
          ancho: 2,
          alto: 2,
          activo: true,
        },
      ]);

      await expect(service.girarElemento('6')).rejects.toThrow(
        ConflictException,
      );

      try {
        await service.girarElemento('6');
      } catch (e: any) {
        expect(e.response.codigo).toBe('NO_CABE');
      }
    });
  });

  // =========================================================================
  // 6. ELIMINAR PARED Y ELEMENTOS NO-MESA
  // =========================================================================
  describe('eliminarElemento: no-mesas', () => {
    it('elimina una pared sin restricción y realiza borrado real', async () => {
      prisma.elementoPlano.findUnique.mockResolvedValue({
        id: 10n,
        piso_id: 1n,
        tipo: 'PARED',
        nombre: 'Pared norte',
        x: 0,
        y: 0,
        ancho: 20,
        alto: 1,
        activo: true,
      });

      prisma.elementoPlano.delete.mockResolvedValue({ id: 10n });

      const res = await service.eliminarElemento('10');
      expect(res.eliminado).toBe(true);
      expect(prisma.elementoPlano.delete).toHaveBeenCalledWith({
        where: { id: 10n },
      });
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'ELIMINAR_ELEMENTO' }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith(
        'plano:cambio',
        expect.objectContaining({ tipo: 'ELEMENTO_ELIMINADO', elementoId: '10' }),
      );
    });
  });

  // =========================================================================
  // 7. NO ELIMINAR MESA CON PEDIDO ABIERTO O RESERVA ACTIVA HOY
  // =========================================================================
  describe('eliminarElemento: mesas protegidas', () => {
    it('rechaza eliminar mesa con pedido abierto con 409 MESA_EN_USO', async () => {
      prisma.elementoPlano.findUnique.mockResolvedValue({
        id: 4n,
        piso_id: 1n,
        tipo: 'MESA',
        numero: 4,
        nombre: 'Mesa 4',
        x: 11,
        y: 5,
        ancho: 2,
        alto: 2,
        asientos: 4,
        activo: true,
      });

      prisma.pedidoMesa.findFirst.mockResolvedValue({
        id: 501n,
        pedido_id: 1001n,
        mesa_id: 4n,
        abierta: true,
      });

      await expect(service.eliminarElemento('4')).rejects.toThrow(
        ConflictException,
      );

      try {
        await service.eliminarElemento('4');
      } catch (e: any) {
        expect(e.response.codigo).toBe('MESA_EN_USO');
        expect(e.response.motivo).toBe('PEDIDO_ABIERTO');
        expect(e.response.sugerencia).toBe('desactivar');
      }
    });

    it('rechaza eliminar mesa con reserva ACTIVA para hoy con 409 MESA_EN_USO', async () => {
      prisma.elementoPlano.findUnique.mockResolvedValue({
        id: 7n,
        piso_id: 1n,
        tipo: 'MESA',
        numero: 7,
        nombre: 'Mesa 7',
        x: 5,
        y: 8,
        ancho: 2,
        alto: 2,
        asientos: 4,
        activo: true,
      });

      prisma.pedidoMesa.findFirst.mockResolvedValue(null);

      const { inicio } = obtenerRangoHoyLima();
      prisma.reservaMesa.findFirst.mockResolvedValue({
        id: 601n,
        mesa_id: 7n,
        reserva: {
          id: 701n,
          estado: 'ACTIVA',
          hora: new Date(inicio.getTime() + 14 * 3600 * 1000), // Hoy 14:00 Lima
        },
      });

      await expect(service.eliminarElemento('7')).rejects.toThrow(
        ConflictException,
      );

      try {
        await service.eliminarElemento('7');
      } catch (e: any) {
        expect(e.response.codigo).toBe('MESA_EN_USO');
        expect(e.response.motivo).toBe('RESERVA_ACTIVA_HOY');
        expect(e.response.sugerencia).toBe('desactivar');
      }
    });
  });

  // =========================================================================
  // 8. ELIMINAR MESA YA USADA
  // =========================================================================
  describe('eliminarElemento: mesa ya usada (pedidos cerrados)', () => {
    it('elimina mesa ya usada conservando mesa_nombre en pedidos históricos', async () => {
      prisma.elementoPlano.findUnique.mockResolvedValue({
        id: 9n,
        piso_id: 1n,
        tipo: 'MESA',
        numero: 9,
        nombre: 'Mesa 9 VIP',
        x: 11,
        y: 8,
        ancho: 2,
        alto: 2,
        asientos: 6,
        activo: true,
      });

      // Sin pedido abierto ni reserva activa hoy
      prisma.pedidoMesa.findFirst.mockResolvedValue(null);
      prisma.reservaMesa.findFirst.mockResolvedValue(null);

      prisma.pedidoMesa.updateMany.mockResolvedValue({ count: 2 });
      prisma.elementoPlano.delete.mockResolvedValue({ id: 9n });

      const res = await service.eliminarElemento('9');
      expect(res.eliminado).toBe(true);

      // Respalda el nombre histórico antes del borrado real
      expect(prisma.pedidoMesa.updateMany).toHaveBeenCalledWith({
        where: {
          mesa_id: 9n,
          mesa_nombre: null,
        },
        data: {
          mesa_nombre: 'Mesa 9 VIP',
        },
      });

      expect(prisma.elementoPlano.delete).toHaveBeenCalledWith({
        where: { id: 9n },
      });
    });
  });

  // =========================================================================
  // 9. DISEÑO PEGADO INVÁLIDO NO CAMBIA NADA
  // =========================================================================
  describe('aplicarDiseno', () => {
    it('rechaza texto malformado con 400 DISENO_INVALIDO sin tocar BD ni transacción', async () => {
      await expect(service.aplicarDiseno('{ texto corrupto')).rejects.toThrow(
        BadRequestException,
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza diseño con elementos que se superponen con 400 DISENO_INVALIDO', async () => {
      const disenoInvalido = {
        floors: [{ id: 'p1', n: 'Piso 1', on: true }],
        dims: { p1: { w: 20, h: 12 } },
        plan: {
          p1: [
            {
              id: 'm1',
              t: 'mesa',
              x: 2,
              y: 5,
              w: 2,
              h: 2,
              label: 'Mesa 1',
              seats: 4,
              on: true,
            },
            {
              id: 'm2',
              t: 'mesa',
              x: 3,
              y: 5,
              w: 2,
              h: 2,
              label: 'Mesa 2',
              seats: 4,
              on: true,
            },
          ],
        },
      };

      try {
        await service.aplicarDiseno(disenoInvalido);
        fail('Debió lanzar BadRequestException');
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.response.codigo).toBe('DISENO_INVALIDO');
        expect(e.response.detalle.some((d: string) => d.includes('Superposición'))).toBe(true);
      }

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza diseño si quitaría una mesa con pedido abierto o reserva activa hoy con 409 MESA_EN_USO', async () => {
      // El diseño nuevo solo tiene Mesa 1, pero omite Mesa 4
      const nuevoDiseno = {
        floors: [{ id: 'p1', n: 'Piso 1', on: true }],
        dims: { p1: { w: 20, h: 12 } },
        plan: {
          p1: [
            {
              id: 'm1',
              t: 'mesa',
              x: 2,
              y: 5,
              w: 2,
              h: 2,
              label: 'Mesa 1',
              seats: 4,
              on: true,
            },
          ],
        },
      };

      // En BD existe Mesa 4
      prisma.elementoPlano.findMany.mockResolvedValue([
        { id: 4n, tipo: 'MESA', numero: 4, nombre: 'Mesa 4' },
      ]);

      // Mesa 4 tiene un pedido abierto
      prisma.pedidoMesa.findFirst.mockResolvedValue({
        id: 501n,
        abierta: true,
      });

      await expect(service.aplicarDiseno(nuevoDiseno)).rejects.toThrow(
        ConflictException,
      );

      try {
        await service.aplicarDiseno(nuevoDiseno);
      } catch (e: any) {
        expect(e.response.codigo).toBe('MESA_EN_USO');
      }

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('aplica diseño válido en una transacción y emite evento plano:cambio', async () => {
      const disenoValido = {
        floors: [
          { id: 'p1', n: 'Piso 1', on: true },
          { id: 'p2', n: 'Piso 2', on: false },
        ],
        dims: {
          p1: { w: 20, h: 12 },
          p2: { w: 20, h: 12 },
        },
        plan: {
          p1: [
            {
              id: 'm1',
              t: 'mesa',
              x: 2,
              y: 5,
              w: 2,
              h: 2,
              label: 'Mesa 1',
              seats: 4,
              on: true,
            },
          ],
          p2: [],
        },
      };

      prisma.elementoPlano.findMany.mockResolvedValue([]);
      prisma.piso.findFirst.mockResolvedValue(null);
      prisma.piso.create.mockResolvedValue({ id: 1n, nombre: 'Piso 1' });
      prisma.elementoPlano.create.mockResolvedValue({ id: 101n });

      const res = await service.aplicarDiseno(disenoValido);
      expect(res.ok).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'APLICAR_DISENO' }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith(
        'plano:cambio',
        expect.objectContaining({ tipo: 'DISENO_APLICADO' }),
      );
    });
  });
});

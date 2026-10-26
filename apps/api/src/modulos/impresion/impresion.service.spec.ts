import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ImpresionService } from './impresion.service';

describe('ImpresionService', () => {
  let service: ImpresionService;
  let prismaMock: any;
  let auditoriaMock: any;

  beforeEach(() => {
    prismaMock = {
      printJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn(),
      },
      deviceKey: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      pedido: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    service = new ImpresionService(prismaMock, auditoriaMock);
  });

  describe('tomarTrabajos', () => {
    it('recupera trabajos IMPRIMIENDO con más de 2 minutos sin resultado', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);
      await service.tomarTrabajos(5, 1n);

      expect(prismaMock.printJob.updateMany).toHaveBeenCalledWith({
        where: {
          estado: 'IMPRIMIENDO',
          tomado_en: { lt: expect.any(Date) },
        },
        data: {
          estado: 'PENDIENTE',
        },
      });
    });

    it('toma trabajos atómicamente con SKIP LOCKED y los pasa a IMPRIMIENDO', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ id: 10n }, { id: 11n }]);
      const mockActualizados = [
        {
          id: 10n,
          tipo: 'ETIQUETA_GENERAL',
          payload: { codigo: 'CP-1' },
          copia: false,
          intentos: 0,
        },
        {
          id: 11n,
          tipo: 'ETIQUETA_AREA',
          payload: { areaNombre: 'COCINA' },
          copia: false,
          intentos: 0,
        },
      ];
      prismaMock.printJob.findMany.mockResolvedValue(mockActualizados);

      const res = await service.tomarTrabajos(2, 5n);

      expect(res.trabajos).toHaveLength(2);
      expect(res.trabajos[0].id).toBe('10');
      expect(res.trabajos[0].tipo).toBe('ETIQUETA_GENERAL');
      expect(prismaMock.printJob.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [10n, 11n] } },
        data: {
          estado: 'IMPRIMIENDO',
          tomado_en: expect.any(Date),
          device_key_id: 5n,
        },
      });
    });

    it('limita el maximo de trabajos a 10 aunque se pida mas', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);
      await service.tomarTrabajos(50, 1n);
      // Debe haber llamado con limit 10
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('registrarResultado', () => {
    it('marca IMPRESO cuando ok es true', async () => {
      prismaMock.printJob.findUnique.mockResolvedValue({
        id: 10n,
        estado: 'IMPRIMIENDO',
        intentos: 0,
      });

      await service.registrarResultado({ id: '10', ok: true });

      expect(prismaMock.printJob.update).toHaveBeenCalledWith({
        where: { id: 10n },
        data: {
          estado: 'IMPRESO',
          impreso_en: expect.any(Date),
          error: null,
        },
      });
    });

    it('incrementa intentos y regresa a PENDIENTE si ok es false y tiene menos de 5 intentos', async () => {
      prismaMock.printJob.findUnique.mockResolvedValue({
        id: 10n,
        estado: 'IMPRIMIENDO',
        intentos: 2,
      });

      await service.registrarResultado({
        id: '10',
        ok: false,
        error: 'Atasco de papel',
      });

      expect(prismaMock.printJob.update).toHaveBeenCalledWith({
        where: { id: 10n },
        data: {
          intentos: 3,
          estado: 'PENDIENTE',
          error: 'Atasco de papel',
        },
      });
    });

    it('pasa a FALLIDO cuando se llega al 5to intento fallido', async () => {
      prismaMock.printJob.findUnique.mockResolvedValue({
        id: 10n,
        estado: 'IMPRIMIENDO',
        intentos: 4,
      });

      await service.registrarResultado({
        id: '10',
        ok: false,
        error: 'Cabezal desconectado',
      });

      expect(prismaMock.printJob.update).toHaveBeenCalledWith({
        where: { id: 10n },
        data: {
          intentos: 5,
          estado: 'FALLIDO',
          error: 'Cabezal desconectado',
        },
      });
    });

    it('lanza NotFoundException si el trabajo no existe', async () => {
      prismaMock.printJob.findUnique.mockResolvedValue(null);
      await expect(service.registrarResultado({ id: '999', ok: true })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('registrarLatido', () => {
    it('actualiza el ultimo latido y estado de la impresora en la DeviceKey', async () => {
      await service.registrarLatido(
        { version: '1.0.0', impresora: 'sin_papel', detalle: 'Bandeja vacía' },
        2n,
      );

      expect(prismaMock.deviceKey.update).toHaveBeenCalledWith({
        where: { id: 2n },
        data: {
          ultimo_latido: expect.any(Date),
          latido_version: '1.0.0',
          latido_impresora: 'sin_papel',
          latido_detalle: 'Bandeja vacía',
          ultima_conexion: expect.any(Date),
        },
      });
    });
  });

  describe('obtenerEstadoAdmin', () => {
    it('reporta conectado si el latido tiene 60s o menos', async () => {
      const ahora = new Date();
      prismaMock.deviceKey.findFirst.mockResolvedValue({
        id: 1n,
        ultimo_latido: new Date(ahora.getTime() - 20 * 1000), // hace 20 seg
        latido_impresora: 'lista',
      });
      prismaMock.printJob.count
        .mockResolvedValueOnce(3) // pendientes
        .mockResolvedValueOnce(1); // fallidos

      const estado = await service.obtenerEstadoAdmin();

      expect(estado.agente).toBe('conectado');
      expect(estado.impresora).toBe('lista');
      expect(estado.pendientes).toBe(3);
      expect(estado.fallidos).toBe(1);
    });

    it('reporta sin_conexion si el latido tiene mas de 60s o no existe', async () => {
      const ahora = new Date();
      prismaMock.deviceKey.findFirst.mockResolvedValue({
        id: 1n,
        ultimo_latido: new Date(ahora.getTime() - 85 * 1000), // hace 85 seg
        latido_impresora: 'lista',
      });
      prismaMock.printJob.count.mockResolvedValue(0);

      const estado = await service.obtenerEstadoAdmin();

      expect(estado.agente).toBe('sin_conexion');
    });
  });

  describe('reintentarTrabajo', () => {
    it('restablece un trabajo FALLIDO a PENDIENTE con intentos en 0', async () => {
      prismaMock.printJob.findUnique.mockResolvedValue({
        id: 15n,
        estado: 'FALLIDO',
        intentos: 5,
      });
      prismaMock.printJob.update.mockResolvedValue({
        id: 15n,
        estado: 'PENDIENTE',
      });

      const res = await service.reintentarTrabajo('15');

      expect(res.ok).toBe(true);
      expect(prismaMock.printJob.update).toHaveBeenCalledWith({
        where: { id: 15n },
        data: {
          estado: 'PENDIENTE',
          intentos: 0,
          error: null,
          tomado_en: null,
        },
      });
    });
  });

  describe('encolarEtiquetasPedido e idempotencia', () => {
    const pedidoMock = {
      id: 50n,
      codigo: 'CP-050',
      modalidad: 'LLEVAR',
      cliente_nombre: 'Carlos',
      canal: 'CAJA',
      creado_en: new Date(),
      lineas: [
        {
          id: 1n,
          cantidad: 1,
          nombre: 'Jugo de Fresa',
          area: { nombre: 'Barra' },
          opciones: [],
        },
      ],
    };

    it('encola etiquetas con upsert usando clave_idempotencia única', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.printJob.upsert.mockResolvedValue({});

      await service.encolarEtiquetasPedido(50n);

      // Debe haber intentado encolar al menos la General y la Bebida
      expect(prismaMock.printJob.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clave_idempotencia: '50-ETIQUETA_GENERAL' },
        }),
      );
      expect(prismaMock.printJob.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clave_idempotencia: '50-ETIQUETA_BEBIDA-1' },
        }),
      );
    });

    it('no lanza error si el pedido falla o no existe (no bloqueante)', async () => {
      prismaMock.pedido.findUnique.mockRejectedValue(new Error('DB disconnect'));
      await expect(service.encolarEtiquetasPedido(99n)).resolves.not.toThrow();
    });
  });

  describe('reimprimirEtiqueta', () => {
    const pedidoMock = {
      id: 70n,
      codigo: 'CP-070',
      modalidad: 'MESA',
      lineas: [
        {
          id: 1n,
          cantidad: 1,
          nombre: 'Frappe Mocha',
          area: { nombre: 'Barra' },
          opciones: [],
        },
      ],
    };

    it('crea trabajo con copia=true para reimpresión general', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.printJob.create.mockResolvedValue({ id: 100n });

      const res = await service.reimprimirEtiqueta('70', { tipo: 'general' });

      expect(res.ok).toBe(true);
      expect(prismaMock.printJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pedido_id: 70n,
          tipo: 'ETIQUETA_GENERAL',
          copia: true,
          estado: 'PENDIENTE',
        }),
      });
    });
  });

  describe('gestión de llaves de agente', () => {
    it('crea una llave segura, almacena sólo su hash y registra auditoría', async () => {
      prismaMock.deviceKey.create.mockImplementation(({ data }: any) => ({
        id: 8n,
        nombre: data.nombre,
        creado_en: new Date(),
      }));

      const res = await service.crearLlaveAgente(
        { nombre: 'PC Caja Principal' },
        { partyId: 1n, rol: 'ADMIN', username: 'admin' } as any,
        '127.0.0.1',
      );

      expect(res.nombre).toBe('PC Caja Principal');
      expect(res.llave).toMatch(/^agk_[0-9a-f]{48}$/);
      expect(prismaMock.deviceKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'AGENTE',
          nombre: 'PC Caja Principal',
          llave_hash: expect.any(String),
          activo: true,
        }),
      });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'CREAR_LLAVE_AGENTE',
        }),
      );
    });

    it('desactiva una llave sin eliminar el registro', async () => {
      prismaMock.deviceKey.findUnique.mockResolvedValue({
        id: 8n,
        tipo: 'AGENTE',
        activo: true,
      });

      const res = await service.desactivarLlaveAgente(
        '8',
        { partyId: 1n, rol: 'ADMIN' } as any,
      );

      expect(res.ok).toBe(true);
      expect(prismaMock.deviceKey.update).toHaveBeenCalledWith({
        where: { id: 8n },
        data: { activo: false },
      });
    });
  });
});

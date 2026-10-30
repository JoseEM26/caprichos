import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ImpresionService } from './impresion.service';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

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
      prismaMock.printJob.findMany.mockResolvedValue([]);

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

  describe('impresión sin agente, vencimiento y estado por etiqueta', () => {
    const pedidoBase = {
      id: 80n,
      codigo: 'CP-080',
      modalidad: 'LLEVAR',
      cliente_nombre: 'Ana',
      canal: 'CAJA',
      creado_en: new Date(),
      lineas: [
        { id: 1n, cantidad: 1, nombre: 'Jugo de Fresa', area: { nombre: 'Barra' }, opciones: [] },
      ],
    };
    let eventosMock: any;

    beforeEach(() => {
      eventosMock = { emitirAdmin: jest.fn() };
      prismaMock.notificacion = { create: jest.fn().mockResolvedValue({}) };
      prismaMock.printJob.count.mockResolvedValue(0);
      prismaMock.printJob.upsert.mockResolvedValue({});
      prismaMock.printJob.findMany.mockResolvedValue([]);
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoBase);
      service = new ImpresionService(prismaMock, auditoriaMock, eventosMock);
    });

    it('al encolar un pedido nuevo sin agente avisa a CAJERO y ADMIN y en vivo', async () => {
      prismaMock.deviceKey.findFirst.mockResolvedValue(null);

      await service.encolarEtiquetasPedido(80n);

      const llamadas = prismaMock.notificacion.create.mock.calls.map((c: any) => c[0].data);
      expect(llamadas.map((d: any) => d.rol_destino)).toEqual(['CAJERO', 'ADMIN']);
      expect(llamadas[0].tipo).toBe('IMPRESORA_SIN_CONEXION');
      expect(llamadas[0].mensaje).toContain('CP-080');
      expect(llamadas[0].mensaje).toContain('no está conectada');
      expect(eventosMock.emitirAdmin).toHaveBeenCalledWith(
        'impresion:sin_conexion',
        expect.objectContaining({ pedidoId: '80', conectado: false }),
      );
    });

    it('con agente conectado e impresora lista no avisa', async () => {
      prismaMock.deviceKey.findFirst.mockResolvedValue({ ultimo_latido: new Date(), latido_impresora: 'lista' });

      await service.encolarEtiquetasPedido(80n);

      expect(prismaMock.notificacion.create).not.toHaveBeenCalled();
    });

    it('con agente conectado pero impresora sin papel sí avisa', async () => {
      prismaMock.deviceKey.findFirst.mockResolvedValue({ ultimo_latido: new Date(), latido_impresora: 'sin_papel' });

      await service.encolarEtiquetasPedido(80n);

      expect(prismaMock.notificacion.create).toHaveBeenCalledTimes(2);
    });

    it('un nuevo encolado del mismo pedido no vuelve a avisar', async () => {
      prismaMock.printJob.count.mockResolvedValue(3);
      prismaMock.deviceKey.findFirst.mockResolvedValue(null);

      await service.encolarEtiquetasPedido(80n);

      expect(prismaMock.notificacion.create).not.toHaveBeenCalled();
    });

    it('reimprimir TODAS no duplica las etiquetas que ya están en cola', async () => {
      prismaMock.printJob.findMany.mockResolvedValue([{ tipo: 'ETIQUETA_GENERAL', payload: {} }]);
      prismaMock.printJob.create.mockResolvedValue({ id: 900n });

      const res = await service.reimprimirEtiqueta('80', { tipo: 'TODAS' });

      const tipos = prismaMock.printJob.create.mock.calls.map((c: any) => c[0].data.tipo);
      expect(tipos).toEqual(['ETIQUETA_AREA', 'ETIQUETA_BEBIDA']);
      expect(res.cantidad).toBe(2);
      expect(res.omitidas).toBe(1);
    });

    it('reimprimir una sola etiqueta por clave solo encola esa', async () => {
      prismaMock.printJob.create.mockResolvedValue({ id: 901n });

      const res = await service.reimprimirEtiqueta('80', { tipo: 'general', clave: 'GENERAL' });

      expect(prismaMock.printJob.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.printJob.create.mock.calls[0][0].data.tipo).toBe('ETIQUETA_GENERAL');
      expect(res.cantidad).toBe(1);
    });

    it('reimprimir una etiqueta que ya está en cola devuelve aviso sin duplicar', async () => {
      prismaMock.printJob.findMany.mockResolvedValue([{ tipo: 'ETIQUETA_GENERAL', payload: {} }]);

      const res = await service.reimprimirEtiqueta('80', { tipo: 'general', clave: 'GENERAL' });

      expect(prismaMock.printJob.create).not.toHaveBeenCalled();
      expect(res.cantidad).toBe(0);
      expect(res.mensaje).toContain('ya están en cola');
    });

    it('estadoEtiquetasPedido muestra el estado real de cada etiqueta y el resumen', async () => {
      prismaMock.printJob.findMany.mockResolvedValue([
        {
          id: 12n, tipo: 'ETIQUETA_AREA', payload: { areaNombre: 'BARRA' }, estado: 'PENDIENTE',
          intentos: 0, error: null, copia: false, en: new Date('2026-01-01T10:00:00Z'), impreso_en: null,
        },
        {
          id: 11n, tipo: 'ETIQUETA_GENERAL', payload: {}, estado: 'IMPRESO',
          intentos: 1, error: null, copia: false, en: new Date('2026-01-01T09:59:00Z'),
          impreso_en: new Date('2026-01-01T10:01:00Z'),
        },
      ]);

      const res = await service.estadoEtiquetasPedido('80');

      const porClave = Object.fromEntries(res.etiquetas.map((e) => [e.clave, e.estado]));
      expect(porClave).toEqual({
        GENERAL: 'IMPRESA',
        'AREA:BARRA': 'EN_COLA',
        'BEBIDA:1': 'SIN_TRABAJO',
      });
      expect(res.resumen).toEqual({
        total: 3, impresas: 1, enCola: 1, fallidas: 0, vencidas: 0, sinTrabajo: 1,
      });
      expect(res.etiquetas.find((e) => e.clave === 'GENERAL')?.impresoEn).toBe('2026-01-01T10:01:00.000Z');
    });

    it('vencerTrabajosObsoletos no toca las reimpresiones pedidas a mano (copia=true)', async () => {
      prismaMock.parametro = { findUnique: jest.fn().mockResolvedValue(null) };
      await service.vencerTrabajosObsoletos(Date.parse('2026-01-01T12:00:00Z'));
      for (const llamada of prismaMock.printJob.updateMany.mock.calls) {
        expect(llamada[0].where.copia).toBe(false);
      }
    });

    it('vencerTrabajosObsoletos marca VENCIDO lo de pedidos anulados y lo viejo, con el umbral del parametro', async () => {
      const ahora = Date.parse('2026-01-01T12:00:00Z');
      prismaMock.parametro = {
        findUnique: jest.fn().mockResolvedValue({ clave: 'impresion_vence_min', valor: 60 }),
      };
      prismaMock.printJob.updateMany
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 3 });

      const total = await service.vencerTrabajosObsoletos(ahora);

      expect(total).toBe(5);
      const anulados = prismaMock.printJob.updateMany.mock.calls[0][0];
      expect(anulados.where).toEqual({ estado: 'PENDIENTE', copia: false, pedido: { is: { estado: 'ANULADO' } } });
      expect(anulados.data.estado).toBe('VENCIDO');
      const viejos = prismaMock.printJob.updateMany.mock.calls[1][0];
      expect(viejos.where.en.lt).toEqual(new Date(ahora - 60 * 60 * 1000));
      expect(viejos.data.estado).toBe('VENCIDO');
    });
  });

  describe('cola: vaciar y descartar', () => {
    const caja: any = { rol: 'CAJERO', partyId: 7n };
    const motivo = 'Impresora apagada todo el dia';

    it('vacía solo las pendientes antiguas (no las IMPRIMIENDO) y audita el conteo', async () => {
      prismaMock.printJob.updateMany.mockResolvedValue({ count: 12 });
      const res = await service.vaciarCola({ alcance: 'ANTIGUAS', minutos: 30, motivo }, caja, '1.1.1.1');
      const arg = prismaMock.printJob.updateMany.mock.calls[0][0];
      expect(arg.where.estado).toBe('PENDIENTE');
      expect(arg.where.en.lt).toBeInstanceOf(Date);
      expect(arg.data.estado).toBe('DESCARTADO');
      expect(res.descartadas).toBe(12);
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'VACIAR_COLA', motivo, despues: expect.objectContaining({ descartadas: 12 }) }),
      );
    });

    it('TODAS no filtra por antigüedad y acepta un pedido', async () => {
      prismaMock.printJob.updateMany.mockResolvedValue({ count: 3 });
      await service.vaciarCola({ alcance: 'TODAS', pedido_id: '55', motivo }, { rol: 'ADMIN', partyId: 1n } as any);
      const { where } = prismaMock.printJob.updateMany.mock.calls[0][0];
      expect(where).toEqual({ estado: 'PENDIENTE', pedido_id: 55n });
    });

    it('exige motivo de al menos 5 caracteres', async () => {
      await expect(service.vaciarCola({ alcance: 'TODAS', motivo: ' ab ' }, caja)).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.printJob.updateMany).not.toHaveBeenCalled();
    });

    it('COCINA no puede descartar', async () => {
      await expect(service.vaciarCola({ alcance: 'TODAS', motivo }, { rol: 'COCINA', partyId: 1n } as any)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.descartarPedido('1', {}, { rol: 'MOZO', partyId: 1n } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('descartar un trabajo y un pedido marca DESCARTADO solo PENDIENTE/FALLIDO', async () => {
      prismaMock.printJob.updateMany.mockResolvedValue({ count: 1 });
      await service.descartarTrabajo('9', {}, caja);
      expect(prismaMock.printJob.updateMany.mock.calls[0][0].where).toEqual({ id: 9n, estado: { in: ['PENDIENTE', 'FALLIDO'] } });
      await service.descartarPedido('4', { motivo: 'Pedido ya entregado' }, caja);
      expect(prismaMock.printJob.updateMany.mock.calls[1][0].where.pedido_id).toBe(4n);
      expect(prismaMock.printJob.updateMany.mock.calls[1][0].data.error).toContain('Pedido ya entregado');
    });

    it('el agente nunca toma un descartado: tomarTrabajos solo pide PENDIENTE', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);
      await service.tomarTrabajos(5, 1n);
      const sql = String((prismaMock.$queryRaw.mock.calls[0][0] as string[]).join(' '));
      expect(sql).toContain("estado = 'PENDIENTE'");
    });

    it('un resultado fallido de un trabajo descartado no lo devuelve a la cola', async () => {
      prismaMock.printJob.findUnique.mockResolvedValue({ id: 3n, estado: 'DESCARTADO', intentos: 0 });
      await service.registrarResultado({ id: '3', ok: false, error: 'x' } as any);
      expect(prismaMock.printJob.update).not.toHaveBeenCalled();
    });

    it('listarCola agrupa por pedido con resumen', async () => {
      const t = (id: bigint, pedido: bigint, min: number) => ({
        id, pedido_id: pedido, estado: 'PENDIENTE', error: null,
        en: new Date(Date.now() - min * 60000), pedido: { codigo: `P-${pedido}`, cliente_nombre: 'Ana' },
      });
      prismaMock.printJob.findMany.mockResolvedValue([t(3n, 2n, 5), t(2n, 1n, 90), t(1n, 1n, 100)]);
      prismaMock.printJob.groupBy = jest.fn().mockResolvedValue([{ estado: 'PENDIENTE', _count: { _all: 3 } }]);
      prismaMock.printJob.count.mockResolvedValue(2);
      const res = await service.listarCola('pendientes');
      expect(res.items.map((g: any) => [g.pedidoCodigo, g.cantidad])).toEqual([['P-1', 2], ['P-2', 1]]);
      expect(res.resumen.pendientes).toBe(3);
      expect(res.resumen.pendientesAntiguas).toBe(2);
    });
  });
});

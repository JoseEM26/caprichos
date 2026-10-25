import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LocalService } from './local.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { horaToDate } from './local.util';

describe('LocalService', () => {
  let service: LocalService;
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
      altaDemanda: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      horarioDia: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      fechaEspecial: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
      ],
    }).compile();

    service = module.get<LocalService>(LocalService);
  });

  describe('obtenerEstadoCarta', () => {
    it('alta demanda vigente suma sus minutos al tiempo prometido', async () => {
      const ahora = new Date('2026-10-20T20:00:00.000Z');
      prismaMock.parametro.findMany.mockResolvedValue([{ clave: 'tiempo_prometido_min', valor: 35 }]);
      prismaMock.altaDemanda.findFirst.mockResolvedValue({ minutos: 30 });
      prismaMock.fechaEspecial.findUnique.mockResolvedValue(null);
      prismaMock.horarioDia.findUnique.mockResolvedValue(null);

      const r = await service.obtenerEstadoCarta(ahora);

      expect(r.tiempoPrometidoMin).toBe(65);
      expect(r.altaDemandaMin).toBe(30);
    });

    it('sin tiempo base, la alta demanda igual se informa en altaDemandaMin', async () => {
      const ahora = new Date('2026-10-20T20:00:00.000Z');
      prismaMock.parametro.findMany.mockResolvedValue([]);
      prismaMock.altaDemanda.findFirst.mockResolvedValue({ minutos: 30 });
      prismaMock.fechaEspecial.findUnique.mockResolvedValue(null);
      prismaMock.horarioDia.findUnique.mockResolvedValue(null);

      const r = await service.obtenerEstadoCarta(ahora);

      expect(r.tiempoPrometidoMin).toBeNull();
      expect(r.altaDemandaMin).toBe(30);
    });

    it('sin alta demanda el tiempo prometido no cambia', async () => {
      const ahora = new Date('2026-10-20T20:00:00.000Z');
      prismaMock.parametro.findMany.mockResolvedValue([{ clave: 'tiempo_prometido_min', valor: 35 }]);
      prismaMock.fechaEspecial.findUnique.mockResolvedValue(null);
      prismaMock.horarioDia.findUnique.mockResolvedValue(null);

      const r = await service.obtenerEstadoCarta(ahora);

      expect(r.tiempoPrometidoMin).toBe(35);
      expect(r.altaDemandaMin).toBe(0);
    });

    it('estado cerrado por horario (antes de abrir)', async () => {
      // Martes 2026-10-20 a las 10:00 Lima (15:00 UTC)
      const ahora = new Date('2026-10-20T15:00:00.000Z');

      prismaMock.parametro.findMany.mockResolvedValue([
        { clave: 'pausa_alta_demanda', valor: { activa: false } },
        { clave: 'tiempo_prometido_min', valor: 30 },
      ]);
      prismaMock.fechaEspecial.findUnique.mockResolvedValue(null);
      prismaMock.horarioDia.findUnique.mockResolvedValue({
        dia_semana: 2,
        cerrado: false,
        abre: horaToDate('14:00'),
        cierra: horaToDate('22:00'),
      });

      const res = await service.obtenerEstadoCarta(ahora);

      expect(res.abierta).toBe(false);
      expect(res.motivo).toBe('HORARIO');
      expect(res.texto).toBe('Abrimos hoy a las 14:00');
      expect(res.abre).toBe('14:00');
      expect(res.cierra).toBe('22:00');
      expect(res.pausaAltaDemanda).toBe(false);
      expect(res.tiempoPrometidoMin).toBe(30);
    });

    it('estado cerrado por horario (día cerrado)', async () => {
      // Lunes 2026-10-19 a las 15:00 Lima (20:00 UTC)
      const ahora = new Date('2026-10-19T20:00:00.000Z');

      prismaMock.parametro.findMany.mockResolvedValue([]);
      prismaMock.fechaEspecial.findUnique.mockResolvedValue(null);
      prismaMock.horarioDia.findUnique.mockResolvedValue({
        dia_semana: 1,
        cerrado: true,
        abre: null,
        cierra: null,
      });

      const res = await service.obtenerEstadoCarta(ahora);

      expect(res.abierta).toBe(false);
      expect(res.motivo).toBe('HORARIO');
      expect(res.texto).toBe('Cerrado hoy');
    });

    it('estado cerrado por horario (después de cerrar)', async () => {
      // Martes 2026-10-20 a las 23:00 Lima (04:00 UTC del día siguiente)
      const ahora = new Date('2026-10-21T04:00:00.000Z');

      prismaMock.parametro.findMany.mockResolvedValue([]);
      prismaMock.fechaEspecial.findUnique.mockResolvedValue(null);
      prismaMock.horarioDia.findUnique.mockResolvedValue({
        dia_semana: 2,
        cerrado: false,
        abre: horaToDate('14:00'),
        cierra: horaToDate('22:00'),
      });

      const res = await service.obtenerEstadoCarta(ahora);

      expect(res.abierta).toBe(false);
      expect(res.motivo).toBe('HORARIO');
      expect(res.texto).toBe('Cerrado por hoy');
    });

    it('estado abierto dentro del horario', async () => {
      // Martes 2026-10-20 a las 16:30 Lima (21:30 UTC)
      const ahora = new Date('2026-10-20T21:30:00.000Z');

      prismaMock.parametro.findMany.mockResolvedValue([
        { clave: 'pausa_alta_demanda', valor: false },
        { clave: 'tiempo_prometido_min', valor: 25 },
      ]);
      prismaMock.fechaEspecial.findUnique.mockResolvedValue(null);
      prismaMock.horarioDia.findUnique.mockResolvedValue({
        dia_semana: 2,
        cerrado: false,
        abre: horaToDate('14:00'),
        cierra: horaToDate('22:00'),
      });

      const res = await service.obtenerEstadoCarta(ahora);

      expect(res.abierta).toBe(true);
      expect(res.motivo).toBe('OK');
      expect(res.texto).toBe('Abierto');
      expect(res.abre).toBe('14:00');
      expect(res.cierra).toBe('22:00');
      expect(res.tiempoPrometidoMin).toBe(25);
    });

    it('fecha especial cerrada que gana al horario', async () => {
      // Martes 2026-10-20 a las 16:30 Lima (hora en que normalmente estaría abierto)
      const ahora = new Date('2026-10-20T21:30:00.000Z');

      prismaMock.parametro.findMany.mockResolvedValue([]);
      prismaMock.fechaEspecial.findUnique.mockResolvedValue({
        fecha: new Date('2026-10-20T00:00:00.000Z'),
        cerrado: true,
        motivo: 'Cerrado por mantenimiento general',
      });
      // Aunque horarioDia esté abierto, fechaEspecial manda
      prismaMock.horarioDia.findUnique.mockResolvedValue({
        dia_semana: 2,
        cerrado: false,
        abre: horaToDate('14:00'),
        cierra: horaToDate('22:00'),
      });

      const res = await service.obtenerEstadoCarta(ahora);

      expect(res.abierta).toBe(false);
      expect(res.motivo).toBe('FECHA_ESPECIAL');
      expect(res.texto).toBe('Cerrado por mantenimiento general');
      expect(res.abre).toBeNull();
      expect(res.cierra).toBeNull();
    });

    it('pausa por alta demanda que bloquea pedidos aunque esté en horario', async () => {
      // Martes 2026-10-20 a las 18:00 Lima (abierto según horario)
      const ahora = new Date('2026-10-20T23:00:00.000Z');

      prismaMock.parametro.findMany.mockResolvedValue([
        {
          clave: 'pausa_alta_demanda',
          valor: { activa: true, motivo: 'Cocina temporalmente saturada' },
        },
      ]);

      const res = await service.obtenerEstadoCarta(ahora);

      expect(res.abierta).toBe(false);
      expect(res.motivo).toBe('PAUSA');
      expect(res.texto).toBe('Cocina temporalmente saturada');
      expect(res.pausaAltaDemanda).toBe(true);
    });

    it('informa cartaAvisoEntrada activado o desactivado', async () => {
      const ahora = new Date('2026-10-20T18:00:00.000Z');
      prismaMock.parametro.findMany.mockResolvedValue([
        { clave: 'carta_aviso_entrada', valor: 'si' },
      ]);
      prismaMock.fechaEspecial.findUnique.mockResolvedValue(null);
      prismaMock.horarioDia.findUnique.mockResolvedValue({
        dia_semana: 2,
        cerrado: false,
        abre: horaToDate('14:00'),
        cierra: horaToDate('22:00'),
      });

      const resActivo = await service.obtenerEstadoCarta(ahora);
      expect(resActivo.cartaAvisoEntrada).toBe(true);

      prismaMock.parametro.findMany.mockResolvedValue([
        { clave: 'carta_aviso_entrada', valor: 'no' },
      ]);
      const resInactivo = await service.obtenerEstadoCarta(ahora);
      expect(resInactivo.cartaAvisoEntrada).toBe(false);
    });
  });

  describe('actualizarHorarioAdmin', () => {
    it('horario con abre >= cierra -> 400', async () => {
      await expect(
        service.actualizarHorarioAdmin(
          [
            {
              dia_semana: 1,
              cerrado: false,
              abre: '22:00',
              cierra: '14:00',
            },
          ],
          adminAuth,
        ),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.actualizarHorarioAdmin(
          [
            {
              dia_semana: 1,
              cerrado: false,
              abre: '14:00',
              cierra: '14:00',
            },
          ],
          adminAuth,
        );
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'HORARIO_INVALIDO',
          }),
        );
      }
    });

    it('actualiza horario válido de la semana y audita', async () => {
      prismaMock.horarioDia.findMany.mockResolvedValue([]);
      prismaMock.horarioDia.upsert.mockResolvedValue({});

      const diasValidos = [
        { dia_semana: 1, cerrado: true, abre: null, cierra: null },
        { dia_semana: 2, cerrado: false, abre: '14:00', cierra: '22:00' },
      ];

      await service.actualizarHorarioAdmin(diasValidos, adminAuth, '127.0.0.1');

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'local',
          accion: 'ACTUALIZAR_HORARIO',
          resultado: 'OK',
        }),
      );
    });
  });

  describe('fechas especiales', () => {
    it('crear fecha especial con abre >= cierra -> 400', async () => {
      await expect(
        service.crearFechaEspecial(
          {
            fecha: '2026-12-25',
            cerrado: false,
            abre: '20:00',
            cierra: '10:00',
          },
          adminAuth,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('eliminar fecha especial del día actual o pasada -> 400 SOLO_FECHAS_FUTURAS', async () => {
      // Ahora es 2026-10-21 en Lima
      const ahora = new Date('2026-10-21T18:00:00.000Z');

      await expect(
        service.eliminarFechaEspecial('2026-10-21', ahora, adminAuth),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.eliminarFechaEspecial('2026-10-15', ahora, adminAuth),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.eliminarFechaEspecial('2026-10-21', ahora, adminAuth);
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'SOLO_FECHAS_FUTURAS',
          }),
        );
      }
    });

    it('eliminar fecha especial futura -> permite y audita', async () => {
      const ahora = new Date('2026-10-21T18:00:00.000Z');
      const fechaFutura = '2026-12-25';

      prismaMock.fechaEspecial.findUnique.mockResolvedValue({
        fecha: new Date('2026-12-25T00:00:00.000Z'),
        cerrado: true,
        motivo: 'Navidad',
      });
      prismaMock.fechaEspecial.delete.mockResolvedValue({});

      const res = await service.eliminarFechaEspecial(
        fechaFutura,
        ahora,
        adminAuth,
        '127.0.0.1',
      );

      expect(res.mensaje).toContain('eliminada exitosamente');
      expect(prismaMock.fechaEspecial.delete).toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'local',
          accion: 'ELIMINAR_FECHA_ESPECIAL',
        }),
      );
    });
  });

  describe('datos del local y medios de pago', () => {
    it('obtenerDatosPublicosLocal devuelve datos completos con medios de pago activos', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([
        {
          clave: 'local_datos',
          valor: {
            nombre: 'Caprichos Café',
            direccion: 'Calle Los Pinos 100',
            telefono: '987654321',
            whatsapp: '987654321',
            redes: { instagram: '@caprichos' },
          },
        },
        {
          clave: 'local_pagos',
          valor: {
            efectivo: { activo: true },
            yape: { activo: true, numero: '987654321' },
            plin: { activo: false, numero: '(pendiente)' },
          },
        },
        { clave: 'envio_gratis_monto', valor: 60 },
        { clave: 'pedido_minimo', valor: 20 },
      ]);

      prismaMock.horarioDia.findMany.mockResolvedValue([
        {
          dia_semana: 1,
          cerrado: true,
          abre: null,
          cierra: null,
        },
        {
          dia_semana: 2,
          cerrado: false,
          abre: horaToDate('14:00'),
          cierra: horaToDate('22:00'),
        },
      ]);

      const res = await service.obtenerDatosPublicosLocal();

      expect(res.nombre).toBe('Caprichos Café');
      expect(res.direccion).toBe('Calle Los Pinos 100');
      expect(res.lat).toBe(-12.0196436);
      expect(res.lng).toBe(-76.963255);
      expect(res.envioGratisDesde).toBe(60);
      expect(res.envioGratisModo).toBe('mas_de');
      expect(res.pedidoMinimo).toBe(20);
      expect(res.mediosPago.efectivo).toBeDefined();
      expect(res.mediosPago.yape).toBeDefined();
      expect(res.mediosPago.plin).toBeUndefined(); // Inactivo
      expect(res.horario[0].dia).toBe('Lunes');
      expect(res.horario[1].dia).toBe('Martes');
    });

    it('obtenerDatosPublicosLocal devuelve lat y lng personalizados cuando existen en local_datos', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([
        {
          clave: 'local_datos',
          valor: {
            nombre: 'Caprichos Sucursal',
            direccion: 'Av. Las Palmas 500',
            telefono: '911222333',
            lat: -12.1005,
            lng: -77.0305,
          },
        },
      ]);
      prismaMock.horarioDia.findMany.mockResolvedValue([]);

      const res = await service.obtenerDatosPublicosLocal();

      expect(res.lat).toBe(-12.1005);
      expect(res.lng).toBe(-77.0305);
      expect(res.direccion).toBe('Av. Las Palmas 500');
    });

    it('actualizarDatosLocal guarda en parámetro y audita', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({
        clave: 'local_datos',
        valor: {
          nombre: 'Caprichos Actualizado',
          direccion: 'Nueva Dir',
          telefono: '999888777',
        },
      });

      const res = await service.actualizarDatosLocal(
        {
          nombre: 'Caprichos Actualizado',
          direccion: 'Nueva Dir',
          telefono: '999888777',
        },
        adminAuth,
      );

      expect((res as any)?.nombre).toBe('Caprichos Actualizado');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'local',
          accion: 'ACTUALIZAR_DATOS',
        }),
      );
    });

    it('actualizarPagosLocal combina y preserva valores por defecto', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue({
        clave: 'local_pagos',
        valor: {
          efectivo: { activo: true },
          yape: { activo: true, numero: '999111222' },
        },
      });
      prismaMock.parametro.upsert.mockImplementation(({ update }: any) => ({
        clave: 'local_pagos',
        valor: update.valor,
      }));

      const res = await service.actualizarPagosLocal(
        {
          yape: { activo: true, numero: '999333444' },
        },
        adminAuth,
      );

      expect((res as any)?.yape?.numero).toBe('999333444');
      expect((res as any)?.efectivo?.activo).toBe(true);
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'local',
          accion: 'ACTUALIZAR_PAGOS',
        }),
      );
    });
  });
});

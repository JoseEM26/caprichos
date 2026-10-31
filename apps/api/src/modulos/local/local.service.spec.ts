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
      fotoLocal: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
      },
      archivo: {
        findUnique: jest.fn().mockResolvedValue(null),
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

    it('obtenerDatosPublicosLocal indica si pedir como invitado está permitido (false si no existe el parámetro)', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([{ clave: 'carta_invitado_activo', valor: 'si' }]);
      prismaMock.horarioDia.findMany.mockResolvedValue([]);
      expect((await service.obtenerDatosPublicosLocal()).invitadoPermitido).toBe(true);

      prismaMock.parametro.findMany.mockResolvedValue([]);
      expect((await service.obtenerDatosPublicosLocal()).invitadoPermitido).toBe(false);
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

    it('actualizarDatosLocal conserva lo ya guardado (lat, RUC) y audita el valor final', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue({
        clave: 'local_datos',
        valor: { nombre: 'Caprichos', direccion: 'Dir', telefono: '1', lat: -12.01, lng: -76.97, ruc: '20601234567' },
      });
      prismaMock.parametro.upsert.mockImplementation(async ({ update }: any) => ({ clave: 'local_datos', valor: update.valor }));

      const res: any = await service.actualizarDatosLocal(
        { nombre: 'Caprichos', direccion: 'Dir 2', telefono: '1', lema: 'Café de barrio', razon_social: 'Caprichos SAC' },
        adminAuth,
      );

      expect(res).toMatchObject({ direccion: 'Dir 2', lat: -12.01, lng: -76.97, ruc: '20601234567', lema: 'Café de barrio', razon_social: 'Caprichos SAC' });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'ACTUALIZAR_DATOS', despues: expect.objectContaining({ lat: -12.01, lema: 'Café de barrio' }) }),
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

  describe('fotos del local', () => {
    const fotoFila = (slot: string, archivoId: bigint, orden: number) => ({
      archivo_id: archivoId,
      slot,
      orden,
      activo: true,
      archivo: { ruta: `publico/2026/10/${archivoId}.webp` },
    });

    it('listarFotosLocal devuelve solo las activas con slot, en orden, con url pública', async () => {
      prismaMock.fotoLocal.findMany.mockResolvedValue([fotoFila('Fachada', 7n, 0), fotoFila('Terraza', 9n, 3)]);

      const res = await service.listarFotosLocal();

      expect(prismaMock.fotoLocal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { activo: true, slot: { not: null } }, orderBy: { orden: 'asc' } }),
      );
      expect(res).toEqual([
        { slot: 'Fachada', orden: 0, archivoId: '7', url: '/archivos/publico/2026/10/7.webp' },
        { slot: 'Terraza', orden: 3, archivoId: '9', url: '/archivos/publico/2026/10/9.webp' },
      ]);
    });

    it('obtenerDatosPublicosLocal incluye las fotos activas en "fotos"', async () => {
      prismaMock.fotoLocal.findMany.mockResolvedValue([fotoFila('Fachada', 7n, 0)]);
      prismaMock.parametro.findMany.mockResolvedValue([]);
      prismaMock.horarioDia.findMany.mockResolvedValue([]);

      const res = await service.obtenerDatosPublicosLocal();

      expect(res.fotos).toEqual([{ slot: 'Fachada', orden: 0, archivoId: '7', url: '/archivos/publico/2026/10/7.webp' }]);
    });

    it('subirFotoLocal guarda el archivo en el slot y retira la foto anterior sin borrarla', async () => {
      prismaMock.archivo.findUnique.mockResolvedValue({ id: 20n, ruta: 'publico/2026/10/20.webp', privado: false, tipo_mime: 'image/webp' });
      prismaMock.fotoLocal.findUnique.mockResolvedValue({ archivo_id: 7n, slot: 'Fachada', activo: true });
      const tx = { fotoLocal: { update: jest.fn().mockResolvedValue({}), upsert: jest.fn().mockResolvedValue({}) } };
      prismaMock.$transaction.mockImplementation(async (fn: any) => fn(tx));

      const res = await service.subirFotoLocal('Fachada', { archivoId: '20' }, adminAuth, '1.1.1.1');

      expect(tx.fotoLocal.update).toHaveBeenCalledWith({ where: { archivo_id: 7n }, data: { slot: null, activo: false } });
      expect(tx.fotoLocal.upsert).toHaveBeenCalledWith({
        where: { archivo_id: 20n },
        update: { slot: 'Fachada', orden: 0, activo: true },
        create: { archivo_id: 20n, slot: 'Fachada', orden: 0, activo: true },
      });
      expect(res).toEqual({ slot: 'Fachada', orden: 0, archivoId: '20', url: '/archivos/publico/2026/10/20.webp' });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'SUBIR_FOTO_LOCAL' }));
    });

    it('subirFotoLocal rechaza un slot que no existe', async () => {
      await expect(service.subirFotoLocal('Cocina', { archivoId: '20' }, adminAuth)).rejects.toThrow(BadRequestException);
      expect(prismaMock.archivo.findUnique).not.toHaveBeenCalled();
    });

    it('subirFotoLocal rechaza archivos privados (comprobantes)', async () => {
      prismaMock.archivo.findUnique.mockResolvedValue({ id: 21n, ruta: 'privado/x.pdf', privado: true, tipo_mime: 'application/pdf' });

      await expect(service.subirFotoLocal('Fachada', { archivoId: '21' }, adminAuth)).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('subirFotoLocal responde 404 si el archivo no existe', async () => {
      await expect(service.subirFotoLocal('Fachada', { archivoId: '99' }, adminAuth)).rejects.toThrow(NotFoundException);
    });

    it('desactivarFotoLocal marca inactiva la foto del slot (no la borra)', async () => {
      prismaMock.fotoLocal.findUnique.mockResolvedValue({ archivo_id: 7n, slot: 'Fachada', activo: true });

      await service.desactivarFotoLocal('Fachada', adminAuth);

      expect(prismaMock.fotoLocal.update).toHaveBeenCalledWith({ where: { archivo_id: 7n }, data: { activo: false } });
      expect(prismaMock.fotoLocal.delete).toBeUndefined();
    });

    it('desactivarFotoLocal responde 404 si no hay foto activa en el slot', async () => {
      prismaMock.fotoLocal.findUnique.mockResolvedValue({ archivo_id: 7n, slot: 'Fachada', activo: false });

      await expect(service.desactivarFotoLocal('Fachada', adminAuth)).rejects.toThrow(NotFoundException);
      expect(prismaMock.fotoLocal.update).not.toHaveBeenCalled();
    });
  });
});

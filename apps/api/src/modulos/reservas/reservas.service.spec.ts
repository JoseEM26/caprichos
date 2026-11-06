jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReservasService } from './reservas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { horaToDate } from '../local/local.util';

describe('ReservasService', () => {
  let service: ReservasService;
  let prisma: any;
  let auditoria: any;
  let eventosGateway: any;

  const mockUsuario: UsuarioAutenticado = {
    partyId: 10n,
    rol: 'MOZO',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prisma = {
      reserva: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      pedidoMesa: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      reservaMesa: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      elementoPlano: {
        findMany: jest.fn(),
      },
      parametro: {
        findUnique: jest.fn(),
      },
      fechaEspecial: {
        findUnique: jest.fn(),
      },
      horarioDia: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(true),
    };

    eventosGateway = {
      emitirAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservasService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: eventosGateway },
      ],
    }).compile();

    service = module.get<ReservasService>(ReservasService);
  });

  describe('crear reserva', () => {
    it('hora fuera de horario -> 400 FUERA_DE_HORARIO (después de hora de cierre)', async () => {
      // Martes 2026-10-27 a las 15:00 Lima como tiempo actual
      const ahora = new Date('2026-10-27T20:00:00.000Z');
      // Reserva para ese mismo martes a las 22:30 Lima (cierre es 22:00)
      const horaReserva = '2026-10-27T22:30:00-05:00';

      prisma.fechaEspecial.findUnique.mockResolvedValue(null);
      prisma.horarioDia.findUnique.mockResolvedValue({
        dia_semana: 2,
        cerrado: false,
        abre: horaToDate('14:00'),
        cierra: horaToDate('22:00'),
      });

      await expect(
        service.crear(
          {
            nombre: 'Juan Perez',
            telefono: '999888777',
            personas: 4,
            hora: horaReserva,
            mesas: [1],
          },
          mockUsuario,
          '127.0.0.1',
          ahora,
        ),
      ).rejects.toMatchObject({
        response: {
          codigo: 'FUERA_DE_HORARIO',
        },
      });
    });

    it('hora fuera de horario -> 400 FUERA_DE_HORARIO (día cerrado por fecha especial)', async () => {
      const ahora = new Date('2026-10-27T15:00:00.000Z');
      const horaReserva = '2026-10-28T18:00:00-05:00';

      prisma.fechaEspecial.findUnique.mockResolvedValue({
        fecha: new Date('2026-10-28T00:00:00.000Z'),
        cerrado: true,
        motivo: 'Feriado regional',
      });

      await expect(
        service.crear(
          {
            nombre: 'Carlos',
            telefono: '987654321',
            personas: 2,
            hora: horaReserva,
            mesas: [1],
          },
          mockUsuario,
          '127.0.0.1',
          ahora,
        ),
      ).rejects.toMatchObject({
        response: {
          codigo: 'FUERA_DE_HORARIO',
        },
      });
    });

    it('hora pasada -> 400 HORA_PASADA', async () => {
      // Ahora es 2026-10-27 a las 19:00 Lima
      const ahora = new Date('2026-10-28T00:00:00.000Z');
      // Intento de reservar para las 18:30 Lima (ya pasó)
      const horaPasada = '2026-10-27T18:30:00-05:00';

      await expect(
        service.crear(
          {
            nombre: 'Ana Gomez',
            telefono: '912345678',
            personas: 2,
            hora: horaPasada,
            mesas: [1],
          },
          mockUsuario,
          '127.0.0.1',
          ahora,
        ),
      ).rejects.toMatchObject({
        response: {
          codigo: 'HORA_PASADA',
          mensaje: 'La hora de la reserva ya pasó',
        },
      });
    });

    it('asientos insuficientes («Faltan 2 asientos» y con una mesa más sí)', async () => {
      const ahora = new Date('2026-10-27T15:00:00.000Z');
      const horaValida = '2026-10-27T19:00:00-05:00';

      prisma.fechaEspecial.findUnique.mockResolvedValue(null);
      prisma.horarioDia.findUnique.mockResolvedValue({
        dia_semana: 2,
        cerrado: false,
        abre: horaToDate('14:00'),
        cierra: horaToDate('22:00'),
      });

      // Mesa 1 tiene 4 asientos, Mesa 2 tiene 2 asientos -> Total 6 asientos
      // Para 8 personas: faltan 2 asientos
      prisma.elementoPlano.findMany.mockImplementation(({ where }: any) => {
        const ids: bigint[] = where.id.in;
        const catalogo = [
          { id: 1n, numero: 1, tipo: 'MESA', activo: true, asientos: 4 },
          { id: 2n, numero: 2, tipo: 'MESA', activo: true, asientos: 2 },
          { id: 3n, numero: 3, tipo: 'MESA', activo: true, asientos: 2 },
        ];
        return catalogo.filter((m) => ids.includes(m.id));
      });

      // 1) Con mesas 1 y 2 (total 6) para 8 personas -> Falla con «Faltan 2 asientos»
      await expect(
        service.crear(
          {
            nombre: 'Familia Perez',
            telefono: '999111222',
            personas: 8,
            hora: horaValida,
            mesas: [1, 2],
          },
          mockUsuario,
          '127.0.0.1',
          ahora,
        ),
      ).rejects.toMatchObject({
        response: {
          codigo: 'ASIENTOS_INSUFICIENTES',
          mensaje: 'Faltan 2 asientos',
        },
      });

      // 2) Con una mesa más (mesa 3 con 2 asientos, total 8) -> Sí guarda
      prisma.parametro.findUnique.mockResolvedValue({
        clave: 'reserva_tolerancia_min',
        valor: 15,
      });

      const reservaCreada = {
        id: 101n,
        nombre: 'Familia Perez',
        telefono: '999111222',
        personas: 8,
        hora: new Date(horaValida),
        tolerancia_min: 15,
        estado: 'ACTIVA',
        pedido_id: null,
        motivo_cancelacion: null,
        mesas: [
          { id: 1n, mesa_id: 1n, mesa: { id: 1n, numero: 1, asientos: 4, nombre: 'Mesa 1' } },
          { id: 2n, mesa_id: 2n, mesa: { id: 2n, numero: 2, asientos: 2, nombre: 'Mesa 2' } },
          { id: 3n, mesa_id: 3n, mesa: { id: 3n, numero: 3, asientos: 2, nombre: 'Mesa 3' } },
        ],
      };
      prisma.reserva.create.mockResolvedValue(reservaCreada);

      const res = await service.crear(
        {
          nombre: 'Familia Perez',
          telefono: '999111222',
          personas: 8,
          hora: horaValida,
          mesas: [1, 2, 3],
        },
        mockUsuario,
        '127.0.0.1',
        ahora,
      );

      expect(res.id).toBe('101');
      expect(res.personas).toBe(8);
      expect(res.mesas).toHaveLength(3);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'reservas',
          accion: 'CREAR_RESERVA',
          partyId: 10n,
        }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('reserva:cambio', {
        tipo: 'CREADA',
        reserva: expect.objectContaining({ id: '101' }),
      });
    });

    it('reserva que no bloquea (se crea con éxito sin verificar mesas ocupadas ni pedidos)', async () => {
      const ahora = new Date('2026-10-27T15:00:00.000Z');
      const horaValida = '2026-10-27T19:00:00-05:00';

      prisma.fechaEspecial.findUnique.mockResolvedValue(null);
      prisma.horarioDia.findUnique.mockResolvedValue({
        dia_semana: 2,
        cerrado: false,
        abre: horaToDate('14:00'),
        cierra: horaToDate('22:00'),
      });

      prisma.elementoPlano.findMany.mockResolvedValue([
        { id: 5n, numero: 5, tipo: 'MESA', activo: true, asientos: 4 },
      ]);
      prisma.parametro.findUnique.mockResolvedValue(null); // default 15

      prisma.reserva.create.mockResolvedValue({
        id: 202n,
        nombre: 'Reserva No Bloqueante',
        telefono: '988777666',
        personas: 2,
        hora: new Date(horaValida),
        tolerancia_min: 15,
        estado: 'ACTIVA',
        pedido_id: null,
        mesas: [{ id: 5n, mesa_id: 5n, mesa: { id: 5n, numero: 5, asientos: 4 } }],
      });

      // Crear la reserva no hace ningún chequeo de pedidos abiertos ni bloqueos
      const res = await service.crear(
        {
          nombre: 'Reserva No Bloqueante',
          telefono: '988777666',
          personas: 2,
          hora: horaValida,
          mesas: [5],
        },
        mockUsuario,
        '127.0.0.1',
        ahora,
      );

      expect(res.id).toBe('202');
      expect(res.estado).toBe('ACTIVA');
    });
  });

  describe('tolerancia y actualización a NO_ASISTIO', () => {
    it('tolerancia: a las 19:14 sigue ACTIVA y a las 19:15 pasa a NO_ASISTIO, con fechas fijas', async () => {
      // Reserva fijada para las 19:00 (hora de Lima: UTC-5)
      // 19:00 Lima = 2026-10-20T19:00:00-05:00
      const horaReserva = new Date('2026-10-20T19:00:00-05:00');
      const toleranciaMin = 15;

      const mockReservaActiva = {
        id: 303n,
        nombre: 'Cliente Puntual',
        telefono: '912912912',
        personas: 2,
        hora: horaReserva,
        tolerancia_min: toleranciaMin,
        estado: 'ACTIVA',
        mesas: [],
      };

      prisma.reserva.findMany.mockResolvedValue([mockReservaActiva]);

      // 1) A las 19:14 Lima (2026-10-20T19:14:00-05:00): sigue ACTIVA
      const tiempo1914 = new Date('2026-10-20T19:14:00-05:00');
      const vencidas1914 = await service.pasarNoAsistioVencidas(tiempo1914);

      expect(vencidas1914).toBe(0);
      expect(prisma.reserva.updateMany).not.toHaveBeenCalled();

      // 2) A las 19:15 Lima (2026-10-20T19:15:00-05:00): pasa a NO_ASISTIO
      const tiempo1915 = new Date('2026-10-20T19:15:00-05:00');
      const vencidas1915 = await service.pasarNoAsistioVencidas(tiempo1915);

      expect(vencidas1915).toBe(1);
      expect(prisma.reserva.updateMany).toHaveBeenCalledWith({
        where: { id: 303n, estado: 'ACTIVA' },
        data: { estado: 'NO_ASISTIO' },
      });
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ motivo: 'Sin llegada: pasaron 15 min de tolerancia' }),
      );
      // Verifica auditoría con actor «sistema»
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'reservas',
          accion: 'EXPIRAR_TOLERANCIA',
          entidadId: 303n,
          despues: expect.objectContaining({
            estado: 'NO_ASISTIO',
            actor: 'sistema',
          }),
        }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('reserva:cambio', {
        tipo: 'NO_ASISTIO',
        reservaId: '303',
        actor: 'sistema',
      });
    });
  });

  describe('consultas: listar, calendario, agenda y mesa hoy', () => {
    it('calendario por mes: cuenta cantidad de reservas ACTIVAS por día', async () => {
      // Mock de pasarNoAsistioVencidas
      prisma.reserva.findMany
        .mockResolvedValueOnce([]) // llamada interna de pasarNoAsistioVencidas
        .mockResolvedValueOnce([
          // 2 reservas activas el 5 de octubre de 2026 en Lima (UTC-5)
          {
            id: 1n,
            estado: 'ACTIVA',
            hora: new Date('2026-10-05T14:30:00-05:00'),
          },
          {
            id: 2n,
            estado: 'ACTIVA',
            hora: new Date('2026-10-05T20:00:00-05:00'),
          },
          // 1 reserva activa el 12 de octubre de 2026 en Lima
          {
            id: 3n,
            estado: 'ACTIVA',
            hora: new Date('2026-10-12T19:15:00-05:00'),
          },
        ]);

      const res = await service.calendario('2026-10');

      expect(res).toBeInstanceOf(Array);
      // Octubre tiene 31 días
      expect(res).toHaveLength(31);

      const dia5 = res.find((d) => d.fecha === '2026-10-05');
      const dia12 = res.find((d) => d.fecha === '2026-10-12');
      const dia1 = res.find((d) => d.fecha === '2026-10-01');

      expect(dia5?.cantidad).toBe(2);
      expect(dia12?.cantidad).toBe(1);
      expect(dia1?.cantidad).toBe(0);
    });

    it('agenda: devuelve reservas del día ordenadas por hora', async () => {
      prisma.reserva.findMany
        .mockResolvedValueOnce([]) // pasarNoAsistioVencidas
        .mockResolvedValueOnce([
          {
            id: 10n,
            nombre: 'Almuerzo 1',
            telefono: '999',
            personas: 2,
            hora: new Date('2026-10-12T14:00:00-05:00'),
            tolerancia_min: 15,
            estado: 'ACTIVA',
            pedido_id: null,
            mesas: [],
          },
          {
            id: 11n,
            nombre: 'Cena 2',
            telefono: '888',
            personas: 4,
            hora: new Date('2026-10-12T20:00:00-05:00'),
            tolerancia_min: 15,
            estado: 'ACTIVA',
            pedido_id: null,
            mesas: [],
          },
        ]);

      const res = await service.agenda('2026-10-12');

      expect(res).toHaveLength(2);
      expect(res[0].id).toBe('10');
      expect(res[1].id).toBe('11');
    });

    it('reservasMesaHoy: devuelve reservas activas de hoy para una mesa', async () => {
      const ahora = new Date('2026-10-21T18:00:00-05:00');

      prisma.reserva.findMany
        .mockResolvedValueOnce([]) // pasarNoAsistioVencidas
        .mockResolvedValueOnce([
          {
            id: 20n,
            nombre: 'Marca en plano',
            telefono: '777',
            personas: 3,
            hora: new Date('2026-10-21T19:30:00-05:00'),
            tolerancia_min: 15,
            estado: 'ACTIVA',
            pedido_id: null,
            mesas: [{ id: 1n, mesa_id: 5n }],
          },
        ]);

      const res = await service.reservasMesaHoy(5n, ahora);

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('20');
      expect(res[0].nombre).toBe('Marca en plano');
    });
  });

  describe('editar, cancelar y sentar', () => {
    it('actualizar solo si está ACTIVA', async () => {
      prisma.reserva.findUnique.mockResolvedValue({
        id: 404n,
        estado: 'CANCELADA',
        mesas: [],
      });

      await expect(
        service.actualizar(404n, { nombre: 'Cambio' }, mockUsuario),
      ).rejects.toMatchObject({
        response: {
          codigo: 'RESERVA_NO_ACTIVA',
        },
      });
    });

    it('cancelar sin motivo 400 y con motivo CANCELADA', async () => {
      // 1) Sin motivo o con motivo menor a 5 caracteres -> 400
      await expect(
        service.cancelar(505n, { motivo: '' } as any, mockUsuario),
      ).rejects.toMatchObject({
        response: {
          codigo: 'MOTIVO_REQUERIDO',
        },
      });

      await expect(
        service.cancelar(505n, { motivo: 'chau' }, mockUsuario),
      ).rejects.toMatchObject({
        response: {
          codigo: 'MOTIVO_REQUERIDO',
        },
      });

      // 2) Con motivo válido -> Pasa a CANCELADA y nunca se elimina de BD
      prisma.reserva.findUnique.mockResolvedValue({
        id: 505n,
        nombre: 'Cliente',
        telefono: '999',
        personas: 2,
        hora: new Date(),
        tolerancia_min: 15,
        estado: 'ACTIVA',
        mesas: [],
      });

      prisma.reserva.update.mockResolvedValue({
        id: 505n,
        nombre: 'Cliente',
        telefono: '999',
        personas: 2,
        hora: new Date(),
        tolerancia_min: 15,
        estado: 'CANCELADA',
        motivo_cancelacion: 'Cliente avisa que no podrá llegar',
        pedido_id: null,
        mesas: [],
      });

      const res = await service.cancelar(
        505n,
        { motivo: 'Cliente avisa que no podrá llegar' },
        mockUsuario,
        '127.0.0.1',
      );

      expect(res.estado).toBe('CANCELADA');
      expect(res.motivo_cancelacion).toBe('Cliente avisa que no podrá llegar');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'reservas',
          accion: 'CANCELAR_RESERVA',
          motivo: 'Cliente avisa que no podrá llegar',
        }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('reserva:cambio', {
        tipo: 'CANCELADA',
        reservaId: '505',
        motivo: 'Cliente avisa que no podrá llegar',
      });
    });

    it('sentar: marca SENTADA y devuelve { mesas: [ids], personas, nombre }', async () => {
      prisma.reserva.findUnique.mockResolvedValue({
        id: 606n,
        nombre: 'Cena Romántica',
        personas: 2,
        estado: 'ACTIVA',
        mesas: [{ id: 10n, mesa_id: 8n }],
      });

      prisma.reserva.update.mockResolvedValue({
        id: 606n,
        nombre: 'Cena Romántica',
        personas: 2,
        estado: 'SENTADA',
        mesas: [{ id: 10n, mesa_id: 8n }],
      });

      const res = await service.sentar(606n, mockUsuario, '127.0.0.1');

      expect(res).toEqual({
        mesas: ['8'],
        personas: 2,
        nombre: 'Cena Romántica',
      });
      expect(prisma.reserva.update).toHaveBeenCalledWith({
        where: { id: 606n },
        data: { estado: 'SENTADA' },
        include: { mesas: true },
      });
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'reservas',
          accion: 'SENTAR_RESERVA',
          partyId: 10n,
        }),
      );
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('reserva:cambio', {
        tipo: 'SENTADA',
        reservaId: '606',
      });
    });

    it('marcarPedidoDeReserva: asocia pedido_id y estado SENTADA', async () => {
      prisma.reserva.update.mockResolvedValue({
        id: 707n,
        nombre: 'Mozo abre pedido',
        telefono: '999',
        personas: 4,
        hora: new Date(),
        tolerancia_min: 15,
        estado: 'SENTADA',
        pedido_id: 888n,
        motivo_cancelacion: null,
        mesas: [],
      });

      const res = await service.marcarPedidoDeReserva(707n, 888n);

      expect(res.id).toBe('707');
      expect(res.pedido_id).toBe('888');
      expect(res.estado).toBe('SENTADA');
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('reserva:cambio', {
        tipo: 'ASOCIADA_A_PEDIDO',
        reservaId: '707',
        pedidoId: '888',
      });
    });
  });

  describe('ventana de tolerancia, choques, aviso suave y reactivar', () => {
    const hoy = new Date('2026-10-20T12:00:00-05:00');
    const reservaA = (hora: string, id = 1n, estado = 'ACTIVA', mesaId = 1n) => ({
      id,
      nombre: 'Otra',
      telefono: '999',
      personas: 2,
      hora: new Date(`2026-10-20T${hora}:00-05:00`),
      tolerancia_min: 15,
      estado,
      mesas: [{ mesa_id: mesaId, mesa: { nombre: null, numero: 1 } }],
    });

    it('mesa ocupada solo dentro de la ventana [hora, hora + 15 min] (sin duración fija de 60)', async () => {
      prisma.reserva.findMany.mockResolvedValue([reservaA('19:00')]);

      const ocupada = async (h: string) =>
        (await service.mesasOcupadasEn(new Date(`2026-10-20T${h}:00-05:00`), null, hoy)).length > 0;

      expect(await ocupada('18:50')).toBe(true); // [18:50, 19:05) se cruza con [19:00, 19:15)
      expect(await ocupada('19:10')).toBe(true);
      expect(await ocupada('19:15')).toBe(false); // la ventana termina justo al empezar la otra
      expect(await ocupada('18:45')).toBe(false);
      expect(await ocupada('20:00')).toBe(false); // antes la duración de 60 min bloqueaba esto
    });

    it('la consulta de reservas solo mira ACTIVA: SENTADA y NO_ASISTIO no bloquean por reserva', async () => {
      await service.mesasOcupadasEn(new Date('2026-10-20T19:10:00-05:00'), null, hoy);
      expect(prisma.reserva.findMany.mock.calls[0][0].where.estado).toBe('ACTIVA');
    });

    it('pedido abierto en la mesa bloquea reservas de hoy, no las de otro día', async () => {
      prisma.reserva.findMany.mockResolvedValue([]);
      prisma.pedidoMesa.findMany.mockResolvedValue([{ mesa_id: 1n, mesa: { nombre: null, numero: 1 } }]);

      const deHoy = await service.mesasOcupadasEn(new Date('2026-10-20T21:00:00-05:00'), null, hoy);
      expect(deHoy).toEqual([expect.objectContaining({ mesa_id: '1', motivo: 'PEDIDO_ABIERTO' })]);

      prisma.pedidoMesa.findMany.mockClear();
      const otroDia = await service.mesasOcupadasEn(new Date('2026-10-21T21:00:00-05:00'), null, hoy);
      expect(otroDia).toEqual([]);
      expect(prisma.pedidoMesa.findMany).not.toHaveBeenCalled();
    });

    it('validarMesasLibres rechaza con MESA_OCUPADA y mensaje de pedido abierto', async () => {
      prisma.reserva.findMany.mockResolvedValue([]);
      prisma.pedidoMesa.findMany.mockResolvedValue([{ mesa_id: 1n, mesa: { nombre: 'Mesa 1', numero: 1 } }]);

      await expect(
        service.validarMesasLibres(new Date('2026-10-20T21:00:00-05:00'), [1n], null, hoy),
      ).rejects.toMatchObject({ response: { codigo: 'MESA_OCUPADA', mensaje: 'Mesa 1 tiene un pedido abierto. Elige otra mesa.' } });
    });

    it('aviso suave: otra reserva de la mesa menos de 2 horas antes, sin bloquear', async () => {
      prisma.reserva.findMany.mockResolvedValue([reservaA('18:30')]);

      const avisos = await service.avisosMesasReserva(new Date('2026-10-20T19:30:00-05:00'), [1n], null, hoy);
      expect(avisos).toEqual(['Esa mesa tiene otra reserva a las 18:30; puede seguir ocupada.']);

      // 2 horas o más antes: no hay aviso
      prisma.reserva.findMany.mockResolvedValue([reservaA('17:00')]);
      expect(await service.avisosMesasReserva(new Date('2026-10-20T19:30:00-05:00'), [1n], null, hoy)).toEqual([]);
    });

    it('reactivar: NO_ASISTIO de hoy vuelve a ACTIVA y extiende la tolerancia desde la llegada; queda auditada', async () => {
      const ahora = new Date('2026-10-20T19:30:00-05:00');
      prisma.reserva.findUnique.mockResolvedValue({ ...reservaA('19:00', 9n, 'NO_ASISTIO'), mesas: [{ mesa_id: 1n, mesa: null }] });
      prisma.reserva.findMany.mockResolvedValue([]);
      prisma.reserva.update.mockResolvedValue({
        ...reservaA('19:00', 9n, 'ACTIVA'),
        tolerancia_min: 45,
        mesas: [],
      });

      const res = await service.reactivar('9', mockUsuario, '127.0.0.1', ahora);

      // 30 min tarde + 15 de tolerancia = 45
      expect(prisma.reserva.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 9n }, data: { estado: 'ACTIVA', tolerancia_min: 45 } }),
      );
      expect(res.estado).toBe('ACTIVA');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'REACTIVAR_RESERVA', entidadId: 9n, antes: { estado: 'NO_ASISTIO', tolerancia_min: 15 } }),
      );
    });

    it('reactivar: rechaza una reserva que no está en No llegó, o que no es de hoy', async () => {
      const ahora = new Date('2026-10-20T19:30:00-05:00');
      prisma.reserva.findUnique.mockResolvedValue(reservaA('19:00', 9n, 'ACTIVA'));
      await expect(service.reactivar('9', mockUsuario, undefined, ahora)).rejects.toMatchObject({
        response: { codigo: 'RESERVA_NO_REACTIVABLE' },
      });

      prisma.reserva.findUnique.mockResolvedValue(reservaA('19:00', 9n, 'NO_ASISTIO'));
      await expect(
        service.reactivar('9', mockUsuario, undefined, new Date('2026-10-21T19:30:00-05:00')),
      ).rejects.toMatchObject({ response: { codigo: 'RESERVA_NO_REACTIVABLE' } });
      expect(prisma.reserva.update).not.toHaveBeenCalled();
    });

    it('reactivar: no se reactiva si otra reserva o un pedido abierto ya tomó la mesa', async () => {
      const ahora = new Date('2026-10-20T19:30:00-05:00');
      prisma.reserva.findUnique.mockResolvedValue({ ...reservaA('19:00', 9n, 'NO_ASISTIO'), mesas: [{ mesa_id: 1n, mesa: null }] });
      prisma.reserva.findMany.mockResolvedValue([]);
      prisma.pedidoMesa.findMany.mockResolvedValue([{ mesa_id: 1n, mesa: { nombre: null, numero: 1 } }]);

      await expect(service.reactivar('9', mockUsuario, undefined, ahora)).rejects.toMatchObject({
        response: { codigo: 'MESA_OCUPADA' },
      });
      expect(prisma.reserva.update).not.toHaveBeenCalled();
    });
  });
});

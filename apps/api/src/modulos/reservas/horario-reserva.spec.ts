import { BadRequestException } from '@nestjs/common';
import {
  franjasReserva,
  horaEnVentanaReserva,
  reservasSeCruzan,
  ultimoInicioReserva,
} from './horario-reserva';

describe('horario-reserva (reglas compartidas)', () => {
  it('la última reserva empieza una hora antes del cierre (cierre 22:00 -> 21:00)', () => {
    expect(ultimoInicioReserva('14:00', '22:00')).toBe(21 * 60);
    expect(horaEnVentanaReserva('21:00', '14:00', '22:00')).toBe(true);
    expect(horaEnVentanaReserva('21:01', '14:00', '22:00')).toBe(false);
    expect(horaEnVentanaReserva('22:00', '14:00', '22:00')).toBe(false);
    expect(horaEnVentanaReserva('13:59', '14:00', '22:00')).toBe(false);
  });

  it('las franjas sugeridas son exactamente las horas aceptadas (de apertura a último inicio)', () => {
    const franjas = franjasReserva('14:00', '22:00');
    expect(franjas[0]).toBe('14:00');
    expect(franjas[franjas.length - 1]).toBe('21:00');
    expect(franjas).toContain('14:30');
    expect(franjas).not.toContain('21:30');
    expect(franjas.every((h) => horaEnVentanaReserva(h, '14:00', '22:00'))).toBe(true);
  });

  it('sin horario, día cerrado o cierre antes de una hora desde la apertura: no hay reservas', () => {
    expect(franjasReserva(null, null)).toEqual([]);
    expect(franjasReserva('18:00', '02:00')).toEqual([]); // medianoche no permitida
    expect(franjasReserva('14:00', '14:30')).toEqual([]); // no alcanza una reserva completa
    expect(horaEnVentanaReserva('19:00', '18:00', '02:00')).toBe(false);
  });

  it('dos reservas en la misma mesa se cruzan si empiezan a menos de una hora una de otra', () => {
    const a = Date.parse('2026-10-27T19:00:00-05:00');
    expect(reservasSeCruzan(a, Date.parse('2026-10-27T19:59:00-05:00'))).toBe(true);
    expect(reservasSeCruzan(a, Date.parse('2026-10-27T20:00:00-05:00'))).toBe(false);
    expect(reservasSeCruzan(a, Date.parse('2026-10-27T18:00:00-05:00'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Servicio: horario por día, cierre, día cerrado, medianoche, mesas, choques, capacidad
// ---------------------------------------------------------------------------
jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ReservasService } from './reservas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { horaToDate } from '../local/local.util';

// 2026-10-27 es martes (dia_semana 2). Lunes 26, martes 27 y domingo 1 de noviembre a distintas horas.
const AHORA = new Date('2026-10-26T15:00:00.000Z'); // lunes 10:00 Lima

describe('ReservasService: horario de atención y mesas', () => {
  let service: ReservasService;
  let prisma: any;
  let horarios: Record<number, { dia_semana: number; cerrado: boolean; abre: Date | null; cierra: Date | null }>;
  let fechasEspeciales: Record<string, any>;
  let mesas: any[];
  let reservasOcupando: any[];

  const dia = (n: number, abre: string | null, cierra: string | null, cerrado = false) => ({
    dia_semana: n,
    cerrado,
    abre: abre ? horaToDate(abre) : null,
    cierra: cierra ? horaToDate(cierra) : null,
  });

  beforeEach(async () => {
    horarios = {
      1: dia(1, '09:00', '21:00'), // lunes: horario propio
      2: dia(2, '14:00', '22:00'), // martes
      3: dia(3, null, null, true), // miércoles cerrado
      7: dia(7, '12:00', '15:00'), // domingo: cierra pronto
    };
    fechasEspeciales = {};
    mesas = [
      { id: 1n, numero: 1, tipo: 'MESA', activo: true, asientos: 4, nombre: null },
      { id: 2n, numero: 2, tipo: 'MESA', activo: true, asientos: 2, nombre: null },
      { id: 3n, numero: 3, tipo: 'MESA', activo: true, asientos: 4, nombre: null },
    ];
    reservasOcupando = [];

    prisma = {
      reserva: {
        create: jest.fn(),
        findMany: jest.fn(async () => reservasOcupando),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      reservaMesa: { createMany: jest.fn(), deleteMany: jest.fn() },
      elementoPlano: {
        findMany: jest.fn(async ({ where }: any) => {
          const ids: bigint[] | undefined = where?.id?.in;
          return ids ? mesas.filter((m) => ids.includes(m.id)) : mesas;
        }),
      },
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      fechaEspecial: {
        findUnique: jest.fn(async ({ where }: any) => fechasEspeciales[where.fecha.toISOString().slice(0, 10)] ?? null),
      },
      horarioDia: { findUnique: jest.fn(async ({ where }: any) => horarios[where.dia_semana] ?? null) },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservasService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: { registrar: jest.fn().mockResolvedValue(true) } },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();
    service = module.get(ReservasService);

    prisma.reserva.create.mockImplementation(async ({ data }: any) => ({
      id: 500n,
      nombre: data.nombre,
      telefono: data.telefono,
      personas: data.personas,
      hora: data.hora,
      tolerancia_min: 15,
      estado: 'ACTIVA',
      pedido_id: null,
      mesas: data.mesas.create.map((m: any) => ({ id: 1n, mesa_id: m.mesa_id, mesa: mesas.find((x) => x.id === m.mesa_id) })),
    }));
  });

  const crear = (hora: string, mesaIds: number[], personas = 2, extra: Record<string, unknown> = {}) =>
    service.crear(
      { nombre: 'Ana', telefono: '999111222', personas, hora, mesas: mesaIds, ...extra } as any,
      undefined,
      '127.0.0.1',
      AHORA,
    );

  const errorDe = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return (e as BadRequestException).getResponse() as any;
    }
    throw new Error('se esperaba un error');
  };

  describe('horario por día y cierre', () => {
    it('cada día usa su horario: el lunes (cierra 21:00) acepta 20:00', async () => {
      await expect(crear('2026-10-26T20:00:00-05:00', [1])).resolves.toMatchObject({ id: '500' });
    });

    it('el mismo día rechaza una hora que el lunes sí tendría: 9:30 de la mañana del martes no aplica (martes abre 14:00)', async () => {
      const r = await errorDe(crear('2026-10-27T10:00:00-05:00', [1]));
      expect(r.codigo).toBe('FUERA_DE_HORARIO');
      expect(r.mensaje).toContain('Atendemos de 14:00 a 22:00.');
    });

    it('cierre exacto: cierra 22:00 no acepta 22:00 y la última reserva empieza 21:00', async () => {
      await expect(crear('2026-10-27T21:00:00-05:00', [1])).resolves.toBeDefined();
      const r = await errorDe(crear('2026-10-27T22:00:00-05:00', [1]));
      expect(r.codigo).toBe('FUERA_DE_HORARIO');
      expect(r.mensaje).toContain('La última reserva empieza a las 21:00.');
      const r2 = await errorDe(crear('2026-10-27T21:30:00-05:00', [1]));
      expect(r2.mensaje).toContain('Atendemos de 14:00 a 22:00.');
    });

    it('día cerrado (miércoles) se rechaza con mensaje propio', async () => {
      const r = await errorDe(crear('2026-10-28T19:00:00-05:00', [1]));
      expect(r.codigo).toBe('FUERA_DE_HORARIO');
      expect(r.mensaje).toContain('no atiende ese día');
    });

    it('fecha especial abierta manda sobre el día de la semana (domingo 1 nov abre 12:00 a 13:00)', async () => {
      fechasEspeciales['2026-11-01'] = { fecha: new Date('2026-11-01T00:00:00Z'), cerrado: false, abre: horaToDate('10:00'), cierra: horaToDate('13:00'), motivo: 'Especial' };
      await expect(crear('2026-11-01T12:00:00-05:00', [1])).resolves.toBeDefined();
      const r = await errorDe(crear('2026-11-01T12:30:00-05:00', [1]));
      expect(r.mensaje).toContain('Atendemos de 10:00 a 13:00.');
    });

    it('fecha especial cerrada rechaza con el motivo', async () => {
      fechasEspeciales['2026-11-02'] = { fecha: new Date('2026-11-02T00:00:00Z'), cerrado: true, abre: null, cierra: null, motivo: 'Feriado' };
      const r = await errorDe(crear('2026-11-02T19:00:00-05:00', [1]));
      expect(r.mensaje).toContain('(Feriado)');
    });

    it('cruce de medianoche no se acepta: abre 18:00 y cierra 02:00 no deja reservar', async () => {
      horarios[2] = dia(2, '18:00', '02:00');
      const r = await errorDe(crear('2026-10-27T19:00:00-05:00', [1]));
      expect(r.codigo).toBe('FUERA_DE_HORARIO');
    });

    it('las franjas que ofrece la carta son justo las horas que la reserva acepta', async () => {
      const franjas = await service.obtenerFranjasDisponibles('2026-10-27', 2, AHORA);
      expect(franjas[0]).toBe('14:00');
      expect(franjas[franjas.length - 1]).toBe('21:00');
      for (const h of franjas) {
        await expect(service.validarHorarioAtencion(new Date(`2026-10-27T${h}:00-05:00`))).resolves.toBeUndefined();
      }
      await expect(service.validarHorarioAtencion(new Date('2026-10-27T21:30:00-05:00'))).rejects.toBeDefined();
    });
  });

  describe('varias mesas, choques y capacidad', () => {
    it('crea la reserva con varias mesas', async () => {
      const res = await crear('2026-10-27T20:00:00-05:00', [1, 3], 6);
      expect(res.mesas.map((m: any) => m.mesa_id)).toEqual(['1', '3']);
    });

    it('rechaza una mesa repetida en la misma reserva', async () => {
      const r = await errorDe(crear('2026-10-27T20:00:00-05:00', [1, 1]));
      expect(r.codigo).toBe('MESA_REPETIDA');
    });

    it('choque: la mesa 2 ya tiene otra reserva a las 19:30 y la nueva es a las 20:00', async () => {
      reservasOcupando = [
        { id: 9n, hora: new Date('2026-10-27T19:30:00-05:00'), estado: 'ACTIVA', mesas: [{ mesa_id: 2n, mesa: mesas[1] }] },
      ];
      const r = await errorDe(crear('2026-10-27T20:00:00-05:00', [1, 2]));
      expect(r.codigo).toBe('MESA_OCUPADA');
      expect(r.mensaje).toContain('Mesa 2 ya tiene otra reserva a las 19:30');
    });

    it('sin choque: otra reserva a las 18:00 en la misma mesa no impide reservar a las 20:00', async () => {
      reservasOcupando = [
        { id: 9n, hora: new Date('2026-10-27T18:00:00-05:00'), estado: 'ACTIVA', mesas: [{ mesa_id: 2n, mesa: mesas[1] }] },
      ];
      await expect(crear('2026-10-27T20:00:00-05:00', [2])).resolves.toBeDefined();
    });

    it('capacidad: mesas que suman menos asientos se rechazan sin confirmación', async () => {
      const r = await errorDe(crear('2026-10-27T20:00:00-05:00', [2], 6));
      expect(r.codigo).toBe('ASIENTOS_INSUFICIENTES');
      expect(r.mensaje).toContain('Faltan 4 asientos');
    });

    it('capacidad: con la confirmación del local sí se crea', async () => {
      await expect(crear('2026-10-27T20:00:00-05:00', [2], 6, { confirmarCapacidad: true })).resolves.toBeDefined();
    });

    it('la consulta de mesas ocupadas excluye la reserva que se edita', async () => {
      await service.mesasOcupadasEn(new Date('2026-10-27T20:00:00-05:00'), 77n);
      const args = prisma.reserva.findMany.mock.calls.at(-1)[0];
      expect(args.where.id).toEqual({ not: 77n });
    });
  });
});

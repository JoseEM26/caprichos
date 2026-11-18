import { LocalService } from './local.service';
import { horaToDate } from './local.util';

/** Horario para programar pedidos con el local cerrado (carta y bot): validación y horas que se ofrecen. */
describe('LocalService: programar fuera de horario', () => {
  // Lunes a sábado 10:00 a 12:00; domingo (7) cerrado. Lima = UTC-5.
  const dia = (abre: string, cierra: string) => ({ cerrado: false, abre: horaToDate(abre), cierra: horaToDate(cierra) });
  const horarios: Record<number, any> = { 1: dia('10:00', '12:00'), 2: dia('10:00', '12:00'), 3: dia('10:00', '12:00'), 4: dia('10:00', '12:00'), 5: dia('10:00', '12:00'), 6: dia('10:00', '12:00'), 7: { cerrado: true, abre: null, cierra: null } };
  let especiales: Record<string, any>;
  let parametros: any[];
  let service: LocalService;

  beforeEach(() => {
    especiales = {};
    parametros = [];
    const prisma: any = {
      parametro: { findMany: jest.fn().mockImplementation(async () => parametros) },
      horarioDia: { findUnique: jest.fn().mockImplementation(async ({ where }: any) => horarios[where.dia_semana] ?? null) },
      fechaEspecial: { findUnique: jest.fn().mockImplementation(async ({ where }: any) => especiales[where.fecha.toISOString().slice(0, 10)] ?? null) },
    };
    service = new LocalService(prisma, {} as any);
  });

  // 2027-03-01 es lunes. 23:00 Lima del domingo 28/02 = 04:00Z del 01/03.
  const domingoNoche = new Date('2027-03-01T04:00:00.000Z');
  const limaIso = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00.000-05:00`);

  describe('exigirAbiertoEn', () => {
    it('acepta una hora dentro del horario', async () => {
      await expect(service.exigirAbiertoEn(limaIso('2027-03-01', '10:30'))).resolves.toBeUndefined();
      await expect(service.exigirAbiertoEn(limaIso('2027-03-01', '10:00'))).resolves.toBeUndefined();
    });

    it.each(['09:30', '12:00', '15:00'])('rechaza %s (fuera de 10:00 a 12:00) con el horario del día en el mensaje', async (hora) => {
      await expect(service.exigirAbiertoEn(limaIso('2027-03-01', hora))).rejects.toMatchObject({
        response: { codigo: 'PROGRAMADO_FUERA_DE_HORARIO', mensaje: expect.stringContaining('10:00 a 12:00') },
      });
    });

    it('rechaza un día cerrado (domingo)', async () => {
      await expect(service.exigirAbiertoEn(limaIso('2027-03-07', '10:30'))).rejects.toMatchObject({
        response: { codigo: 'PROGRAMADO_FUERA_DE_HORARIO', mensaje: 'Ese día no atendemos. Elige otro día.' },
      });
    });

    it('una fecha especial manda sobre el día de la semana (feriado cerrado y horario especial)', async () => {
      especiales['2027-03-02'] = { cerrado: true, abre: null, cierra: null };
      especiales['2027-03-03'] = { cerrado: false, abre: horaToDate('15:00'), cierra: horaToDate('18:00') };
      await expect(service.exigirAbiertoEn(limaIso('2027-03-02', '10:30'))).rejects.toMatchObject({ response: { codigo: 'PROGRAMADO_FUERA_DE_HORARIO' } });
      await expect(service.exigirAbiertoEn(limaIso('2027-03-03', '10:30'))).rejects.toMatchObject({ response: { codigo: 'PROGRAMADO_FUERA_DE_HORARIO' } });
      await expect(service.exigirAbiertoEn(limaIso('2027-03-03', '16:00'))).resolves.toBeUndefined();
    });
  });

  describe('horasProgramables', () => {
    it('ofrece cada 30 minutos desde que abrimos hasta media hora antes de cerrar y omite los días cerrados', async () => {
      const { diasMax, dias } = await service.horasProgramables(domingoNoche);
      expect(diasMax).toBe(7);
      // Hoy en Lima es el domingo 28/02 (cerrado): empieza el lunes 01/03
      expect(dias[0].fecha).toBe('2027-03-01');
      expect(dias[0].horas.map((h) => h.hora)).toEqual(['10:00', '10:30', '11:00', '11:30']);
      expect(dias[0].horas[0].iso).toBe(limaIso('2027-03-01', '10:00').toISOString());
      expect(dias.map((d) => d.fecha)).not.toContain('2027-03-07'); // domingo cerrado
    });

    it('llega hasta los días máximos de programados (hoy + N días)', async () => {
      parametros = [{ clave: 'programado_dias_max', valor: 2 }];
      const { dias } = await service.horasProgramables(domingoNoche);
      expect(dias.map((d) => d.fecha)).toEqual(['2027-03-01', '2027-03-02']);
    });

    it('hoy solo ofrece horas que aún no pasaron', async () => {
      // 10:40 Lima del lunes 01/03: solo quedan 11:00 y 11:30
      const { dias } = await service.horasProgramables(limaIso('2027-03-01', '10:40'));
      expect(dias[0].fecha).toBe('2027-03-01');
      expect(dias[0].horas.map((h) => h.hora)).toEqual(['11:00', '11:30']);
    });

    it('un día sin horas futuras no aparece', async () => {
      const { dias } = await service.horasProgramables(limaIso('2027-03-01', '11:45'));
      expect(dias[0].fecha).toBe('2027-03-02');
    });

    it('cada hora ofrecida pasa la validación del servidor', async () => {
      const { dias } = await service.horasProgramables(domingoNoche);
      for (const d of dias) for (const h of d.horas) await expect(service.exigirAbiertoEn(new Date(h.iso))).resolves.toBeUndefined();
    });
  });
});

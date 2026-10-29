import { CajaAvisoAperturaService } from './caja-aviso-apertura.service';

// El horario sale de LocalService (arrastra @nestjs/jwt, ESM): aquí solo importa su tipo.
jest.mock('../local/local.service', () => ({ LocalService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

// 2026-10-27 10:20 Lima (UTC-5) = 15:20 UTC
const ahora = new Date('2026-10-27T15:20:00.000Z');
const abierto = (abre = '10:00', cierra = '22:00') => ({ abierta: true, motivo: 'OK', abre, cierra });

describe('CajaAvisoAperturaService', () => {
  let prisma: any;
  let local: any;
  let service: CajaAvisoAperturaService;

  beforeEach(() => {
    prisma = {
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      caja: { findUnique: jest.fn().mockResolvedValue(null) },
      notificacion: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 1n, titulo: 'Caja sin abrir' }),
      },
    };
    local = { obtenerEstadoCarta: jest.fn().mockResolvedValue(abierto()) };
    service = new CajaAvisoAperturaService(prisma, {} as any, local);
  });

  it('local abierto hace más de 15 min y sin caja de hoy -> crea la notificación para CAJERO', async () => {
    await expect(service.avisarSiSinAbrir(ahora)).resolves.toBe(true);
    expect(prisma.notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'CAJA_CERRADA_APERTURA',
        rol_destino: 'CAJERO',
        titulo: 'Caja sin abrir',
        enlace: '/admin/caja',
      }),
    });
  });

  it('una sola vez por día: si ya existe el aviso de hoy, no crea otro', async () => {
    prisma.notificacion.findFirst.mockResolvedValue({ id: 1n });
    await expect(service.avisarSiSinAbrir(ahora)).resolves.toBe(false);
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });

  it('la búsqueda de duplicados va por el día de Lima (desde 00:00 -05:00)', async () => {
    await service.avisarSiSinAbrir(ahora);
    expect(prisma.notificacion.findFirst).toHaveBeenCalledWith({
      where: { tipo: 'CAJA_CERRADA_APERTURA', en: { gte: new Date('2026-10-27T05:00:00.000Z') } },
      select: { id: true },
    });
  });

  it('antes de abre + 15 min no avisa', async () => {
    await expect(service.avisarSiSinAbrir(new Date('2026-10-27T15:05:00.000Z'))).resolves.toBe(false); // 10:05
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });

  it('usa el parámetro caja_aviso_apertura_min cuando existe', async () => {
    prisma.parametro.findUnique.mockResolvedValue({ valor: 30 });
    await expect(service.avisarSiSinAbrir(ahora)).resolves.toBe(false); // 10:20 < 10:30
  });

  it('día cerrado, feriado o pausa (sin hora de apertura) no avisa', async () => {
    local.obtenerEstadoCarta.mockResolvedValue({ abierta: false, motivo: 'HORARIO', abre: null, cierra: null });
    await expect(service.avisarSiSinAbrir(ahora)).resolves.toBe(false);
  });

  it('ya cerrado el local (después de la hora de cierre) no avisa', async () => {
    local.obtenerEstadoCarta.mockResolvedValue(abierto('08:00', '10:00'));
    await expect(service.avisarSiSinAbrir(ahora)).resolves.toBe(false);
  });

  it('si la caja de hoy ya existe (abierta o cerrada) no avisa', async () => {
    prisma.caja.findUnique.mockResolvedValue({ id: 3n });
    await expect(service.avisarSiSinAbrir(ahora)).resolves.toBe(false);
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });
});

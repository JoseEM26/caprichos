import { NumerosWhatsappService } from '../servicios/numeros-whatsapp.service';

describe('NumerosWhatsappService: caché fría con llamadas simultáneas', () => {
  it('100 consultas a la vez comparten UNA lectura (antes cada una leía por su lado: la bandeja hacía ~250 consultas)', async () => {
    const prisma: any = {
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      numeroBloqueado: { findMany: jest.fn().mockResolvedValue([{ celular: '987654321' }]) },
    };
    const svc = new NumerosWhatsappService(prisma, { registrar: jest.fn() } as any);
    const r = await Promise.all(Array.from({ length: 100 }, (_, i) => svc.motivoOmision(i === 0 ? '987654321' : `91111${String(i).padStart(4, '0')}`)));
    expect(r[0]).toBe('DESTINO_BLOQUEADO');
    expect(r.slice(1).every((x) => x === null)).toBe(true);
    expect(prisma.numeroBloqueado.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.parametro.findUnique).toHaveBeenCalledTimes(3);
    // ya en caché: no vuelve a leer
    await svc.motivoOmision('900000000');
    expect(prisma.numeroBloqueado.findMany).toHaveBeenCalledTimes(1);
  });
});

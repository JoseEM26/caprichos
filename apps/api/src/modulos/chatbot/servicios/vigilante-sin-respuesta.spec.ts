jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../../../comun/redis/candado.util', () => ({
  adquirirCandado: jest.fn().mockResolvedValue({ adquirido: true, token: 't', fallback: false }),
  liberarCandado: jest.fn().mockResolvedValue(true),
}));
import { VigilanteSinRespuestaService } from './vigilante-sin-respuesta.service';

describe('VigilanteSinRespuestaService', () => {
  const ahora = new Date('2026-10-29T22:45:00Z');
  const crear = (mensajes: any[], vistos = new Set<string>()) => {
    const prisma: any = {
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      conversacion: {
        findMany: jest.fn().mockResolvedValue([{ id: 7n, telefono: '51987654321', nombre_contacto: 'Dueño', mensajes }]),
      },
      notificacion: { create: jest.fn().mockResolvedValue({ id: 1n }) },
    };
    const redis = { set: jest.fn(async (k: string) => (vistos.has(k) ? null : (vistos.add(k), 'OK'))) };
    const motor: any = { procesarMensajeEntrante: jest.fn().mockResolvedValue(true) };
    const svc = new VigilanteSinRespuestaService(prisma, { obtenerCliente: () => redis } as any, motor);
    return { svc, prisma, motor };
  };
  const entra = (minAtras: number) => ({ id: 5n, direccion: 'ENTRA', tipo: 'TEXTO', contenido: { texto: 'hola' }, en: new Date(ahora.getTime() - minAtras * 60000) });

  it('avisa a Admin y Caja una sola vez y reintenta con el bot', async () => {
    const vistos = new Set<string>();
    const a = crear([entra(5)], vistos);
    expect(await a.svc.ejecutarCiclo(ahora)).toEqual({ avisos: 1, reintentos: 1 });
    expect(a.prisma.notificacion.create).toHaveBeenCalledTimes(2);
    expect(a.prisma.notificacion.create.mock.calls[0][0].data.titulo).toBe('Chat sin respuesta: Dueño');
    expect(a.motor.procesarMensajeEntrante).toHaveBeenCalledWith(7n, { texto: 'hola' });
    const b = crear([entra(6)], vistos); // segundo ciclo: mismo mensaje
    expect(await b.svc.ejecutarCiclo(ahora)).toEqual({ avisos: 0, reintentos: 0 });
  });

  it('ignora mensaje reciente, chat ya respondido o con silencio registrado', async () => {
    expect((await crear([entra(1)]).svc.ejecutarCiclo(ahora)).avisos).toBe(0);
    expect((await crear([{ ...entra(9), direccion: 'SALE' }]).svc.ejecutarCiclo(ahora)).avisos).toBe(0);
  });
});

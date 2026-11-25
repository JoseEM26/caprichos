jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../../../comun/redis/candado.util', () => ({
  adquirirCandado: jest.fn().mockResolvedValue({ adquirido: true, token: 't', fallback: false }),
  liberarCandado: jest.fn().mockResolvedValue(true),
}));
import { VigiaEntradaWhatsappService } from './vigia-entrada-whatsapp.service';

describe('VigiaEntradaWhatsappService (WhatsApp conectado pero sin recibir)', () => {
  const ahora = new Date('2026-11-25T22:30:00Z'); // 17:30 Lima
  const crear = (o: { minAtras: number; proveedor?: string; abierta?: boolean; pausado?: string }, vistos = new Set<string>()) => {
    const params: Record<string, string> = { whatsapp_proveedor: o.proveedor ?? '"EVOLUTION"', evolution_pausado: o.pausado ?? '"no"' };
    const prisma: any = {
      parametro: { findUnique: jest.fn(async ({ where }: any) => (params[where.clave] ? { valor: params[where.clave] } : null)) },
      whatsappMensaje: { findFirst: jest.fn().mockResolvedValue({ id: 81n, creado_en: new Date(ahora.getTime() - o.minAtras * 60000) }) },
      notificacion: { create: jest.fn().mockResolvedValue({ id: 1n }) },
    };
    const redis = { set: jest.fn(async (k: string) => (vistos.has(k) ? null : (vistos.add(k), 'OK'))) };
    const local: any = { obtenerEstadoCarta: jest.fn().mockResolvedValue({ abierta: o.abierta ?? true }) };
    return { svc: new VigiaEntradaWhatsappService(prisma, { obtenerCliente: () => redis } as any, local), prisma };
  };

  it('con el local abierto y 35 min sin mensajes entrantes avisa una sola vez al ADMIN con la hora del último', async () => {
    const vistos = new Set<string>();
    const a = crear({ minAtras: 35 }, vistos);
    expect(await a.svc.ejecutarCiclo(ahora)).toBe(true);
    const data = a.prisma.notificacion.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ tipo: 'WHATSAPP_SIN_ENTRADA', rol_destino: 'ADMIN', titulo: 'WhatsApp no recibe mensajes hace 35 min' });
    expect(data.mensaje).toContain('desde las 16:55');
    expect(await crear({ minAtras: 40 }, vistos).svc.ejecutarCiclo(ahora)).toBe(false); // mismo silencio: no repite
  });

  it('no avisa con poco silencio, local cerrado, Meta como proveedor o Evolution en pausa', async () => {
    expect(await crear({ minAtras: 10 }).svc.ejecutarCiclo(ahora)).toBe(false);
    expect(await crear({ minAtras: 60, abierta: false }).svc.ejecutarCiclo(ahora)).toBe(false);
    expect(await crear({ minAtras: 60, proveedor: '"META"' }).svc.ejecutarCiclo(ahora)).toBe(false);
    expect(await crear({ minAtras: 60, pausado: '"si"' }).svc.ejecutarCiclo(ahora)).toBe(false);
  });
});

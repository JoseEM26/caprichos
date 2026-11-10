jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { EventosGateway } from '../eventos.gateway';

const clienteCon = (token: string) => ({
  id: 'sock1',
  handshake: { auth: { token } },
  join: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
});

describe('EventosGateway: salas y señal de notificaciones', () => {
  const ahora = Math.floor(Date.now() / 1000);
  let jwt: any;
  let prisma: any;
  let gateway: EventosGateway;

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn().mockResolvedValue({ partyId: '7', rol: 'CAJERO', roles: ['CAJERO'], iat: ahora }) };
    prisma = {
      userAccount: {
        findUnique: jest.fn().mockResolvedValue({ id: 70n, party_id: 7n, rol: 'CAJERO', activo: true, sesiones_cerradas_en: null }),
      },
      userAccountRol: { findMany: jest.fn().mockResolvedValue([{ rol: 'MOZO' }]) },
    };
    gateway = new EventosGateway(jwt, prisma);
  });

  it('une al socket a admin, a su party y a cada rol que la BASE le da (principal y extra), no los del token', async () => {
    const c = clienteCon('t');
    await gateway.handleConnection(c as any);
    expect(c.join).toHaveBeenCalledWith(['admin', 'party:7', 'rol:CAJERO', 'rol:MOZO']);
    expect(c.disconnect).not.toHaveBeenCalled();
  });

  it('rechaza token inválido, cuenta desactivada y sesión cerrada después de emitir el token', async () => {
    jwt.verifyAsync.mockRejectedValueOnce(new Error('malo'));
    const a = clienteCon('x');
    await gateway.handleConnection(a as any);
    expect(a.disconnect).toHaveBeenCalledWith(true);

    prisma.userAccount.findUnique.mockResolvedValueOnce({ id: 70n, party_id: 7n, rol: 'CAJERO', activo: false, sesiones_cerradas_en: null });
    const b = clienteCon('t');
    await gateway.handleConnection(b as any);
    expect(b.disconnect).toHaveBeenCalledWith(true);

    prisma.userAccount.findUnique.mockResolvedValueOnce({
      id: 70n,
      party_id: 7n,
      rol: 'CAJERO',
      activo: true,
      sesiones_cerradas_en: new Date((ahora + 60) * 1000),
    });
    const c = clienteCon('t');
    await gateway.handleConnection(c as any);
    expect(c.disconnect).toHaveBeenCalledWith(true);
    expect(c.join).not.toHaveBeenCalled();
  });

  it('notificaciones:nueva viaja solo como señal con id: nunca el título ni el texto del aviso', () => {
    const emit = jest.fn();
    (gateway as any).server = { to: jest.fn().mockReturnValue({ emit }) };
    gateway.emitirAdmin('notificaciones:nueva', { id: 5n, titulo: 'Pago de Ana Pérez', mensaje: 'S/ 40', enlace: '/admin/caja' });
    expect(emit).toHaveBeenCalledWith('notificaciones:nueva', { id: '5' });
    gateway.emitirAdmin('pedido:nuevo', { id: 1, codigo: 'CP-1' });
    expect(emit).toHaveBeenLastCalledWith('pedido:nuevo', { id: 1, codigo: 'CP-1' });
  });

  it('emitirAParty llega solo a la sala de esa persona', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    (gateway as any).server = { to };
    gateway.emitirAParty(7n, 'notificaciones:actualizada', {});
    expect(to).toHaveBeenCalledWith('party:7');
  });
});

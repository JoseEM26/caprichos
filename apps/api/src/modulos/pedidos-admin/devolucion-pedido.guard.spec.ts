jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Reflector } from '@nestjs/core';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SupervisorCodigoGuard } from '../supervisor-codigo/supervisor-codigo.guard';
import { PedidosAdminController } from './pedidos-admin.controller';

describe('Devolución de pedido: autorización por código de supervisor', () => {
  const verificar = jest.fn(async (codigo: string | undefined) => {
    if (codigo !== '123456') {
      throw new HttpException({ codigo: 'CODIGO_INVALIDO', mensaje: 'Código de supervisor inválido o no proporcionado' }, HttpStatus.FORBIDDEN);
    }
    return { party_id: 4n, id: 4n, supervisorPartyId: 4n, supervisorId: 4n };
  });
  const guard = new SupervisorCodigoGuard(new Reflector(), { verificarYConsumirCodigo: verificar } as any);
  const ctx = (req: any) =>
    ({
      getHandler: () => PedidosAdminController.prototype.registrarDevolucion,
      switchToHttp: () => ({ getRequest: () => req }),
    }) as any;

  it('un cajero sin código de supervisor no puede registrar la devolución', async () => {
    const req = { headers: {}, body: { montoDevuelto: 45, medio: 'EFECTIVO' }, usuario: { partyId: '9', rol: 'CAJERO' } };
    await expect(guard.canActivate(ctx(req))).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: { codigo: 'CODIGO_INVALIDO' },
    });
  });

  it('con el código de la supervisora pasa y deja quién autorizó', async () => {
    const req: any = { headers: { 'x-codigo-supervisor': '123456' }, body: {}, usuario: { partyId: '9', rol: 'CAJERO' } };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.supervisor).toMatchObject({ party_id: 4n });
  });
});

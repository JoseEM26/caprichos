jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Reflector } from '@nestjs/core';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SupervisorCodigoGuard } from './supervisor-codigo.guard';
import { SupervisorCodigoService } from './supervisor-codigo.service';
import { AlmacenController } from '../almacen/almacen.controller';
import { CajaController } from '../caja/caja.controller';
import { LocalController } from '../local/local.controller';
import { ConfiguracionController } from '../configuracion/configuracion.controller';
import { CocinaController } from '../cocina/cocina.controller';
import { UsuariosController } from '../usuarios/usuarios.controller';
import { PedidosAdminController } from '../pedidos-admin/pedidos-admin.controller';

describe('Acciones Protegidas por Código de Supervisor (DT-61 / RFC 6238)', () => {
  let reflector: Reflector;
  let supervisorServiceMock: any;
  let guard: SupervisorCodigoGuard;

  const mockContext = (handler: Function, req: any) => ({
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as any);

  beforeEach(() => {
    reflector = new Reflector();
    supervisorServiceMock = {
      verificarYConsumirCodigo: jest.fn().mockImplementation(async (codigo: string | undefined) => {
        if (!codigo || codigo !== '123456') {
          throw new HttpException(
            {
              codigo: 'CODIGO_INVALIDO',
              mensaje: 'Código de supervisor inválido o no proporcionado',
            },
            HttpStatus.FORBIDDEN,
          );
        }
        return { party_id: 1n, id: 1n, valido: true };
      }),
    };
    guard = new SupervisorCodigoGuard(reflector, supervisorServiceMock);
  });

  describe('Acciones existentes protegidas', () => {
    it('Anular cobro (CajaController.anularCobro) sin código responde 403 CODIGO_INVALIDO', async () => {
      const ctx = mockContext(CajaController.prototype.anularCobro, {
        headers: {},
        body: { motivo: 'Error cobro' },
      });

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { codigo: 'CODIGO_INVALIDO' },
      });
    });

    it('Anular pedido (PedidosAdminController.cambiarEstado ANULADO) sin código responde 403 CODIGO_INVALIDO', async () => {
      const ctx = mockContext(PedidosAdminController.prototype.cambiarEstado, {
        headers: {},
        body: { estado: 'ANULADO', motivo: 'Cliente canceló' },
      });

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { codigo: 'CODIGO_INVALIDO' },
      });
    });

    it('Cambiar estado no ANULADO no requiere código', async () => {
      const ctx = mockContext(PedidosAdminController.prototype.cambiarEstado, {
        headers: {},
        body: { estado: 'PREPARANDO' },
      });

      const res = await guard.canActivate(ctx);
      expect(res).toBe(true);
      expect(supervisorServiceMock.verificarYConsumirCodigo).not.toHaveBeenCalled();
    });
  });

  describe('Nuevas acciones protegidas: Almacén y Stock', () => {
    it('Anular movimiento de almacén sin código responde 403 CODIGO_INVALIDO', async () => {
      const ctx = mockContext(AlmacenController.prototype.anularMovimiento, {
        headers: {},
        body: { motivo: 'Movimiento duplicado' },
      });

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { codigo: 'CODIGO_INVALIDO' },
      });
    });

    it('Anular producción de almacén sin código responde 403 CODIGO_INVALIDO', async () => {
      const ctx = mockContext(AlmacenController.prototype.anularProduccion, {
        headers: {},
        body: { motivo: 'Error en receta' },
      });

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { codigo: 'CODIGO_INVALIDO' },
      });
    });

    // La merma grande (>= 10) se valida en AlmacenService (después de comprobar el stock); su prueba está en almacen.service.spec.ts

    it('Movimiento de almacén pequeño (MERMA < 10) no requiere código', async () => {
      const ctx = mockContext(AlmacenController.prototype.registrarMovimiento, {
        headers: {},
        body: { tipo: 'MERMA', cantidad: 2 },
      });

      const res = await guard.canActivate(ctx);
      expect(res).toBe(true);
      expect(supervisorServiceMock.verificarYConsumirCodigo).not.toHaveBeenCalled();
    });

    it('Merma múltiple grande (suma >= 10) sin código responde 403 CODIGO_INVALIDO', async () => {
      const ctx = mockContext(AlmacenController.prototype.mermaMultiple, {
        headers: {},
        body: { items: [{ cantidad: 6 }, { cantidad: 5 }] },
      });

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { codigo: 'CODIGO_INVALIDO' },
      });
    });

    it('Anular movimiento de caja sin código responde 403 CODIGO_INVALIDO', async () => {
      const ctx = mockContext(CajaController.prototype.anularMovimiento, {
        headers: {},
        body: { motivo: 'Error de tipeo' },
      });

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { codigo: 'CODIGO_INVALIDO' },
      });
    });
  });

  describe('Nuevas acciones protegidas: Configuración y Administración', () => {
    it('Horarios del local (LocalController.actualizarHorario) sin código responde 403 CODIGO_INVALIDO', async () => {
      const ctx = mockContext(LocalController.prototype.actualizarHorario, {
        headers: {},
        body: [],
      });

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { codigo: 'CODIGO_INVALIDO' },
      });
    });

    it('Pausa Alta Demanda (ConfiguracionController.actualizarPausaAltaDemanda) sin código responde 403 CODIGO_INVALIDO', async () => {
      const ctx = mockContext(ConfiguracionController.prototype.actualizarPausaAltaDemanda, {
        headers: {},
        body: { pausa: true, mensaje: 'Local saturado' },
      });

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { codigo: 'CODIGO_INVALIDO' },
      });
    });

    it('Alta Demanda con pausa en cocina (CocinaController.configurarAltaDemanda) sin código responde 403 CODIGO_INVALIDO', async () => {
      const ctx = mockContext(CocinaController.prototype.configurarAltaDemanda, {
        headers: {},
        body: { pausa: true, minutos: 30 },
      });

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { codigo: 'CODIGO_INVALIDO' },
      });
    });

    it('Alta Demanda sin pausa en cocina no requiere código de supervisor', async () => {
      const ctx = mockContext(CocinaController.prototype.configurarAltaDemanda, {
        headers: {},
        body: { pausa: false, minutos: 15 },
      });

      const res = await guard.canActivate(ctx);
      expect(res).toBe(true);
      expect(supervisorServiceMock.verificarYConsumirCodigo).not.toHaveBeenCalled();
    });

    it('Desactivar usuario (UsuariosController.desactivar) sin código responde 403 CODIGO_INVALIDO', async () => {
      const ctx = mockContext(UsuariosController.prototype.desactivar, {
        headers: {},
        params: { id: '5' },
      });

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { codigo: 'CODIGO_INVALIDO' },
      });
    });

    it('Cambiar rol de usuario (UsuariosController.editar) sin código responde 403 CODIGO_INVALIDO', async () => {
      const ctx = mockContext(UsuariosController.prototype.editar, {
        headers: {},
        body: { rol: 'ADMIN' },
      });

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { codigo: 'CODIGO_INVALIDO' },
      });
    });

    it('Editar nombre de usuario sin cambiar rol no requiere código de supervisor', async () => {
      const ctx = mockContext(UsuariosController.prototype.editar, {
        headers: {},
        body: { nombres: 'Juan Carlos' },
      });

      const res = await guard.canActivate(ctx);
      expect(res).toBe(true);
      expect(supervisorServiceMock.verificarYConsumirCodigo).not.toHaveBeenCalled();
    });

    it('Cualquier acción protegida permite el paso con código rotativo válido en cabecera', async () => {
      const ctx = mockContext(LocalController.prototype.actualizarHorario, {
        headers: { 'x-codigo-supervisor': '123456' },
        body: [],
      });

      const res = await guard.canActivate(ctx);
      expect(res).toBe(true);
      expect(supervisorServiceMock.verificarYConsumirCodigo).toHaveBeenCalledWith(
        '123456',
        undefined,
        'local/horario',
        undefined,
      );
    });
  });
});

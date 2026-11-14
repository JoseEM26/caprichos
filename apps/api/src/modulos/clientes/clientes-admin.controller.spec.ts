jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    signAsync = jest.fn();
    verifyAsync = jest.fn();
  },
  JwtModule: {
    register: jest.fn().mockReturnValue({ module: class {} }),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FiltrosClientesDto } from './clientes-filtros';
import { ClientesAdminController } from './clientes-admin.controller';
import { ClientesService } from './clientes.service';
import { PuntosService } from './puntos.service';
import { FacturacionClienteService } from './facturacion-cliente.service';
import { DireccionesClienteService } from './direcciones-cliente.service';
import { AccesoGuard } from '../acceso/acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';

describe('ClientesAdminController', () => {
  let controller: ClientesAdminController;
  let clientesServiceMock: any;
  let puntosServiceMock: any;

  beforeEach(async () => {
    clientesServiceMock = {
      detallePedidoCliente: jest.fn().mockResolvedValue({ lineas: [] }),
      listarPedidosCliente: jest.fn().mockResolvedValue({ pedidos: [], hayMas: false }),
      listarAdmin: jest.fn().mockResolvedValue({ items: [], total: 0, pagina: 1, paginas: 1 }),
      obtenerFichaAdmin: jest.fn().mockResolvedValue({ id: '100', nombre: 'Ana' }),
      crearEnMostrador: jest.fn().mockResolvedValue({ id: '100', nombre: 'Ana' }),
      editarCliente: jest.fn().mockResolvedValue({ ok: true }),
      cambiarEstado: jest.fn().mockResolvedValue({ ok: true, activo: false }),
    };

    puntosServiceMock = {
      ajustarManual: jest.fn().mockResolvedValue({ puntos: 10, nuevoSaldo: 20 }),
      listarMovimientos: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientesAdminController],
      providers: [
        { provide: ClientesService, useValue: clientesServiceMock },
        { provide: PuntosService, useValue: puntosServiceMock },
        { provide: DireccionesClienteService, useValue: { buscarPorTelefono: jest.fn() } },
        { provide: FacturacionClienteService, useValue: { obtener: jest.fn() } },
        { provide: PrismaService, useValue: {} },
        { provide: Reflector, useValue: {} },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ClientesAdminController>(ClientesAdminController);
  });

  it('listar delega a clientesService.listarAdmin con los filtros y la IP', async () => {
    const req: any = { usuario: { rol: 'ADMIN' }, ip: '127.0.0.1' };
    const filtros: any = { q: 'ana', tipo: 'Persona', estado: 'Activos', pedidosMin: 2 };
    await controller.listar(filtros, req);
    expect(clientesServiceMock.listarAdmin).toHaveBeenCalledWith(filtros, req.usuario, '127.0.0.1');
  });

  it('exportar: manda el .xlsx con su cabecera de descarga', async () => {
    clientesServiceMock.exportarAdmin = jest.fn().mockResolvedValue({ archivo: new Uint8Array([80, 75]), nombre: 'clientes-2026-11-13.xlsx', filas: 2 });
    const res: any = { setHeader: jest.fn(), send: jest.fn() };
    const req: any = { usuario: { rol: 'ADMIN', partyId: 1n }, ip: '9.9.9.9' };
    await controller.exportar({ pedidosMin: 2 } as any, req, res);
    expect(clientesServiceMock.exportarAdmin).toHaveBeenCalledWith({ pedidosMin: 2 }, req.usuario, '9.9.9.9');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="clientes-2026-11-13.xlsx"');
    expect(Buffer.isBuffer(res.send.mock.calls[0][0])).toBe(true);
  });

  it('exportar: si no es ADMIN el servicio lo rechaza y no se envía nada', async () => {
    clientesServiceMock.exportarAdmin = jest.fn().mockRejectedValue(new ForbiddenException({ codigo: 'SOLO_ADMIN' }));
    const res: any = { setHeader: jest.fn(), send: jest.fn() };
    await expect(controller.exportar({} as any, { usuario: { rol: 'CAJERO' } } as any, res)).rejects.toThrow();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('participantes delega con los mismos filtros', async () => {
    clientesServiceMock.participantesSorteo = jest.fn().mockResolvedValue({ total: 1, participantes: [{ id: '1', nombre: 'Ana G.', detalle: '···123' }] });
    expect(await controller.participantes({ cumpleMes: 'si' } as any)).toMatchObject({ total: 1 });
    expect(clientesServiceMock.participantesSorteo).toHaveBeenCalledWith({ cumpleMes: 'si' });
  });

  describe('FiltrosClientesDto (validación en el borde)', () => {
    const validar = (o: any) => validateSync(plainToInstance(FiltrosClientesDto, o));
    it('convierte números y acepta combinaciones válidas', () => {
      const dto = plainToInstance(FiltrosClientesDto, { pedidosMin: '2', consumoMin: '50.5', desde: '2026-11-01', periodo: 'mes', orden: 'consumo', limite: '48' });
      expect(dto).toMatchObject({ pedidosMin: 2, consumoMin: 50.5, limite: 48 });
      expect(validateSync(dto)).toEqual([]);
    });
    it('rechaza valores raros', () => {
      for (const malo of [{ pedidosMin: 'x' }, { pedidosMin: '-1' }, { desde: '01/11/2026' }, { periodo: 'ayer' }, { orden: 'raro' }, { canal: 'TV' }, { limite: '5000' }, { sinCompraDias: '0' }]) {
        expect(validar(malo).length).toBeGreaterThan(0);
      }
    });
  });

  it('ajustarPuntos delega a puntosService.ajustarManual', async () => {
    const req: any = { usuario: { partyId: 1n, rol: 'ADMIN' }, ip: '127.0.0.1' };
    await controller.ajustarPuntos('100', { puntos: 10, motivo: 'Premio por fidelidad' }, req);

    expect(puntosServiceMock.ajustarManual).toHaveBeenCalledWith(
      '100',
      { puntos: 10, motivo: 'Premio por fidelidad' },
      1n,
      '127.0.0.1',
    );
  });

  it('ajustarPuntos: quien no es ADMIN recibe 403 y no se ajusta nada', async () => {
    puntosServiceMock.ajustarManual.mockClear();
    for (const rol of ['CAJERO', 'SUPERVISOR', undefined]) {
      await expect(
        controller.ajustarPuntos('100', { puntos: 10, motivo: 'Premio por fidelidad' }, { usuario: { partyId: 2n, rol } } as any),
      ).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
    }
    expect(puntosServiceMock.ajustarManual).not.toHaveBeenCalled();
  });

  it('historial de compras: detalle y página delegan al servicio (permiso clientes/ver)', async () => {
    await controller.detallePedido('9', '55');
    expect(clientesServiceMock.detallePedidoCliente).toHaveBeenCalledWith('9', '55');
    await controller.pedidosDelCliente('9', '2', '20');
    expect(clientesServiceMock.listarPedidosCliente).toHaveBeenCalledWith('9', 2, 20);
  });

  describe('GET por-telefono/:telefono', () => {
    const direccionesDe = () => (controller as any).direcciones;

    it('celular que no tiene 9 dígitos exactos y empieza en 9: 400 TELEFONO_INVALIDO y no busca', async () => {
      for (const t of ['91234567', '812345678', '91234567a', '9123456789', '45217890']) {
        await expect(controller.buscarPorTelefono(t, { usuario: { partyId: 55n } } as any)).rejects.toMatchObject({
          response: { codigo: 'TELEFONO_INVALIDO' },
        });
      }
      expect(direccionesDe().buscarPorTelefono).not.toHaveBeenCalled();
    });

    it('encontrado: devuelve solo los datos del contrato, sin DNI ni correo', async () => {
      const datos = { encontrado: true, party: '100', nombre: 'Ana', telefono: '987654321', puntos: 12, direcciones: [] };
      direccionesDe().buscarPorTelefono.mockResolvedValue(datos);

      const r: any = await controller.buscarPorTelefono('987654321', { usuario: { partyId: 55n } } as any);

      expect(direccionesDe().buscarPorTelefono).toHaveBeenCalledWith('987654321', 55n);
      expect(r).toEqual({ ...datos, facturacion: undefined });
      for (const k of ['dniMascara', 'dni', 'correo', 'cumpleanos']) expect(r).not.toHaveProperty(k);
    });

    it('encontrado con RUC guardado: lo trae para rellenar la factura (personal con permiso)', async () => {
      const f = { ruc: '20000000015', razonSocial: 'Empresa de Prueba SAC', direccion: null };
      direccionesDe().buscarPorTelefono.mockResolvedValue({ encontrado: true, party: '100', nombre: 'Ana', telefono: '987654321', puntos: 0, direcciones: [] });
      (controller as any).facturacion.obtener.mockResolvedValue(f);
      const r: any = await controller.buscarPorTelefono('987654321', { usuario: { partyId: 55n } } as any);
      expect((controller as any).facturacion.obtener).toHaveBeenCalledWith('100');
      expect(r.facturacion).toEqual(f);
    });

    it('no encontrado: { encontrado: false } sin datos', async () => {
      direccionesDe().buscarPorTelefono.mockResolvedValue({ encontrado: false });
      expect(await controller.buscarPorTelefono('987654321', { usuario: { partyId: 55n } } as any)).toEqual({ encontrado: false });
    });
  });

  describe('GET por-dni/:dni (retirado)', () => {
    it('responde 410 BUSQUEDA_DNI_RETIRADA', () => {
      let error: any;
      try {
        controller.buscarPorDniRetirado();
      } catch (e) {
        error = e;
      }
      expect(error.getStatus()).toBe(410);
      expect(error.getResponse()).toMatchObject({ codigo: 'BUSQUEDA_DNI_RETIRADA' });
    });
  });
});

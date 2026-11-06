jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  })),
  JwtModule: {
    registerAsync: jest.fn().mockReturnValue({
      module: class MockJwtModule {},
    }),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

const hace = (minutos: number) => new Date(Date.now() - minutos * 60000);

/** Pedido tal como lo devuelve prisma para listarTodos (incluye repartidor con persona). */
function pedido(over: Record<string, any>) {
  return {
    id: 1n,
    codigo: 'CP-0001',
    modalidad: 'DELIVERY',
    estado: 'LISTO',
    cliente_nombre: 'Lucía Rojas',
    cliente_telefono: null,
    entrega_direccion: 'Av. Siempre Viva 123',
    entrega_referencia: null,
    entrega_lat: null,
    entrega_lng: null,
    zona: { codigo: 'Norte' },
    zona_id: 1n,
    total: 30,
    pago_estado: 'PENDIENTE',
    pago_metodo: 'EFECTIVO',
    paga_con: null,
    repartidor_party_id: null,
    repartidor: null,
    creado_en: hace(10),
    tomado_en: null,
    salio_en: null,
    llego_en: null,
    entregado_en: null,
    motivo_falla: null,
    anulado_en: null,
    lineas: [],
    mensajesReparto: [],
    incidentes: [],
    ...over,
  };
}

const repartidorAna = { id: 11n, persona: { nombres: 'Ana', apellidos: 'Pérez' } };

describe('Panel de repartidores (GET /admin/repartos/panel)', () => {
  let service: RepartosService;
  let prismaMock: any;

  const caja: UsuarioAutenticado = { partyId: 1n, rol: 'CAJERO', debeCambiar: false };
  const repartidorLogueado: UsuarioAutenticado = { partyId: 1001n, rol: 'REPARTIDOR', debeCambiar: false };

  beforeEach(async () => {
    prismaMock = {
      parametro: {
        findMany: jest.fn().mockResolvedValue([{ clave: 'rep_max_pedidos', valor: 3 }]),
      },
      userAccount: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      pedido: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepartosService,
        RutaService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();

    service = module.get<RepartosService>(RepartosService);
  });

  it('REPARTIDOR recibe 403 y no se consulta nada', async () => {
    await expect(service.obtenerPanelRepartidores(repartidorLogueado)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prismaMock.userAccount.findMany).not.toHaveBeenCalled();
    expect(prismaMock.pedido.findMany).not.toHaveBeenCalled();
  });

  it('marca libre a quien no lleva pedidos y ocupado a quien sí, con sus pedidos agrupados', async () => {
    prismaMock.userAccount.findMany.mockResolvedValue([
      { party_id: 1001n, activo: true, party: { persona: { nombres: 'Ana', apellidos: 'Pérez' } } },
      { party_id: 1002n, activo: true, party: { persona: { nombres: 'Beto', apellidos: 'Soto' } } },
    ]);
    prismaMock.pedido.findMany.mockResolvedValue([
      pedido({
        id: 1n,
        codigo: 'CP-0001',
        estado: 'LISTO',
        repartidor_party_id: 1001n,
        repartidor: { id: 1001n, persona: { nombres: 'Ana', apellidos: 'Pérez' } },
        creado_en: hace(25),
        tomado_en: hace(20),
        total: 40,
        pago_estado: 'PENDIENTE',
        pago_metodo: 'EFECTIVO',
      }),
      pedido({
        id: 2n,
        codigo: 'CP-0002',
        estado: 'EN_CAMINO',
        repartidor_party_id: 1001n,
        repartidor: { id: 1001n, persona: { nombres: 'Ana', apellidos: 'Pérez' } },
        creado_en: hace(15),
        tomado_en: hace(12),
        salio_en: hace(8),
        total: 30,
        pago_estado: 'PENDIENTE',
        pago_metodo: 'EFECTIVO',
      }),
      pedido({
        id: 3n,
        codigo: 'CP-0003',
        estado: 'LISTO',
        repartidor_party_id: 1001n,
        repartidor: { id: 1001n, persona: { nombres: 'Ana', apellidos: 'Pérez' } },
        creado_en: hace(5),
        tomado_en: hace(4),
        salio_en: hace(2),
        llego_en: hace(1),
        total: 20,
        pago_estado: 'PAGADO',
        pago_metodo: 'TARJETA',
      }),
      pedido({ id: 4n, codigo: 'CP-0004', estado: 'LISTO', creado_en: hace(40) }),
    ]);

    const panel = await service.obtenerPanelRepartidores(caja);

    expect(panel.max_pedidos).toBe(3);
    const ana: any = panel.repartidores.find((r: any) => r.party_id === '1001');
    const beto: any = panel.repartidores.find((r: any) => r.party_id === '1002');
    expect(ana).toMatchObject({ nombre: 'Ana Pérez', libre: false, efectivo_por_rendir: 70 });
    expect(ana.pedidos.map((p: any) => p.codigo)).toEqual(['CP-0001', 'CP-0002', 'CP-0003']);
    expect(ana.pedidos.map((p: any) => p.etapa)).toEqual(['TOMADO', 'EN_CAMINO', 'LLEGADO']);
    expect(beto).toMatchObject({ nombre: 'Beto Soto', libre: true, pedidos: [], efectivo_por_rendir: 0 });
    expect(panel.resumen).toEqual({
      repartidores_libres: 1,
      repartidores_ocupados: 1,
      pedidos_sin_tomar: 1,
    });
  });

  it('lista los pedidos sin tomar (LISTO, sin repartidor, sin falla) ordenados por espera, más antiguo primero', async () => {
    prismaMock.pedido.findMany.mockResolvedValue([
      pedido({ id: 10n, codigo: 'CP-NUEVO', creado_en: hace(5) }),
      pedido({ id: 11n, codigo: 'CP-VIEJO', creado_en: hace(50) }),
      pedido({ id: 12n, codigo: 'CP-FALLA', creado_en: hace(60), motivo_falla: 'Cliente no sale' }),
    ]);

    const panel = await service.obtenerPanelRepartidores(caja);

    expect(panel.sin_tomar.map((p: any) => p.codigo)).toEqual(['CP-VIEJO', 'CP-NUEVO']);
    expect(panel.resumen.pedidos_sin_tomar).toBe(2);
    expect(panel.repartidores).toEqual([]);
    expect(panel.resumen.repartidores_libres).toBe(0);
  });

  it('muestra un repartidor inactivo que aún lleva pedidos, para no perderlos de vista', async () => {
    prismaMock.pedido.findMany.mockResolvedValue([
      pedido({
        id: 20n,
        codigo: 'CP-HUERFANO',
        estado: 'EN_CAMINO',
        repartidor_party_id: 1009n,
        repartidor: { id: 1009n, persona: { nombres: 'Dani', apellidos: 'Ruiz' } },
        salio_en: hace(3),
      }),
    ]);

    const panel = await service.obtenerPanelRepartidores(caja);

    expect(panel.repartidores).toHaveLength(1);
    expect(panel.repartidores[0]).toMatchObject({ party_id: '1009', nombre: 'Dani Ruiz', libre: false });
    expect(panel.repartidores[0].pedidos[0].etapa).toBe('EN_CAMINO');
  });
});

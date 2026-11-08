import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ComandasService, distribucionSabores } from './comandas.service';
import { SalonService } from '../salon/salon.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { calcularColor } from './cocina.util';

jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

describe('ComandasService', () => {
  let service: ComandasService;
  let prisma: any;
  let auditoria: any;
  let eventosGateway: any;
  let descuentoServiceMock: any;
  let salonMock: any;

  const mockUsuario: UsuarioAutenticado = {
    partyId: 100n,
    rol: 'COCINA',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      parametro: {
        findMany: jest.fn().mockResolvedValue([
          { clave: 'rep_naranja_min', valor: 35 },
          { clave: 'rep_rojo_min', valor: 50 },
        ]),
      },
      // Número del día al llegar a cocina (numero-dia.ts): contador y pedido atómicos
      $queryRaw: jest.fn().mockResolvedValue([{ ultimo: 1 }]),
      pedido: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      comandaArea: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      pedidoEstadoHistorial: {
        create: jest.fn(),
      },
      pedidoLinea: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      areaCocina: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(true),
    };

    eventosGateway = {
      emitirAdmin: jest.fn(),
    };

    salonMock = { avisarListo: jest.fn().mockResolvedValue(undefined) };
    descuentoServiceMock = {
      descontarPedido: jest.fn().mockResolvedValue({ ok: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComandasService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: eventosGateway },
        { provide: 'DESCUENTO_PEDIDO', useValue: descuentoServiceMock },
        { provide: SalonService, useValue: salonMock },
      ],
    }).compile();

    service = module.get<ComandasService>(ComandasService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sincronizarPedido e idempotencia', () => {
    it('combo: la madre (sin producto ni área) no genera comanda; cada parte va a la comanda de su área', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: 3n,
        codigo: 'CP-0103',
        estado: 'COLA',
        lineas: [
          { id: 30n, nombre: 'COMBO CAJITA CAPRIKIDS', area_id: null, producto_id: null, producto: null },
          { id: 31n, nombre: 'FRAPPE OREO', area_id: 1n, producto_id: 5n, linea_combo_id: 30n, producto: null },
          { id: 32n, nombre: 'Burbujas', area_id: 2n, producto_id: 6n, linea_combo_id: 30n, producto: null },
        ],
        comandas: [],
      });
      prisma.comandaArea.create.mockResolvedValue({ id: 1 });

      const creadas = await service.sincronizarPedido(3n);
      expect(creadas).toBe(2);
      const areas = prisma.comandaArea.create.mock.calls.map((c: any) => c[0].data.area_id);
      expect(areas).toEqual([1n, 2n]);
    });

    it('la primera llegada a cocina asigna el número del día; una segunda sincronización no lo cambia', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: 4n,
        codigo: 'CP-0104',
        estado: 'COLA',
        numero_dia: null,
        lineas: [{ id: 40n, nombre: 'Americano', area_id: 1n, producto: null }],
        comandas: [],
      });
      prisma.comandaArea.create.mockResolvedValue({ id: 1 });

      await service.sincronizarPedido(4n);
      expect(prisma.pedido.updateMany).toHaveBeenCalledWith({
        where: { id: 4n, numero_dia: null },
        data: expect.objectContaining({ numero_dia: 1 }),
      });

      // Ya tiene comandas: no vuelve a numerar
      prisma.pedido.findUnique.mockResolvedValue({
        id: 4n,
        codigo: 'CP-0104',
        estado: 'COLA',
        numero_dia: 1,
        lineas: [{ id: 40n, nombre: 'Americano', area_id: 1n, producto: null }],
        comandas: [{ area_id: 1n }],
      });
      prisma.pedido.updateMany.mockClear();
      await service.sincronizarPedido(4n);
      expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
    });

    it('crea filas de comanda_area por cada área involucrada y llama a descuentoService por primera vez', async () => {
      const mockPedido = {
        id: 1n,
        codigo: 'CP-0101',
        estado: 'COLA',
        lineas: [
          {
            id: 10n,
            nombre: 'Americano',
            area_id: 1n, // Barra
            producto: null,
          },
          {
            id: 11n,
            nombre: 'Waffle de fresa',
            area_id: null,
            producto: {
              categoria: { area_id: 2n }, // Cocina
            },
          },
        ],
        comandas: [],
      };

      prisma.pedido.findUnique.mockResolvedValue(mockPedido);
      prisma.comandaArea.create.mockResolvedValue({ id: 1 });

      const creadas = await service.sincronizarPedido(1n);

      expect(creadas).toBe(2);
      expect(prisma.comandaArea.create).toHaveBeenCalledTimes(2);
      expect(prisma.comandaArea.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pedido_id: 1n,
          area_id: 1n,
          estado: 'EN_COCINA',
        }),
      });
      expect(prisma.comandaArea.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pedido_id: 1n,
          area_id: 2n,
          estado: 'EN_COCINA',
        }),
      });
      // Verifica que llamó a descontarPedido
      expect(descuentoServiceMock.descontarPedido).toHaveBeenCalledWith(1n);
    });

    it('sincronizar es idempotente: no vuelve a crear comandas ni a llamar a descuento si ya existen', async () => {
      const mockPedidoConComandas = {
        id: 1n,
        codigo: 'CP-0101',
        estado: 'COLA',
        lineas: [
          { id: 10n, nombre: 'Americano', area_id: 1n },
          { id: 11n, nombre: 'Waffle', area_id: 2n },
        ],
        comandas: [
          { pedido_id: 1n, area_id: 1n, estado: 'EN_COCINA' },
          { pedido_id: 1n, area_id: 2n, estado: 'EN_COCINA' },
        ],
      };

      prisma.pedido.findUnique.mockResolvedValue(mockPedidoConComandas);

      const creadas = await service.sincronizarPedido(1n);

      expect(creadas).toBe(0);
      expect(prisma.comandaArea.create).not.toHaveBeenCalled();
      expect(descuentoServiceMock.descontarPedido).not.toHaveBeenCalled();
    });

    it('no falla si el hook de descuento no está presente o falla', async () => {
      descuentoServiceMock.descontarPedido.mockRejectedValue(new Error('Fallo simulado en stock'));

      const mockPedido = {
        id: 2n,
        codigo: 'CP-0102',
        estado: 'COLA',
        lineas: [{ id: 20n, nombre: 'Café', area_id: 1n }],
        comandas: [],
      };

      prisma.pedido.findUnique.mockResolvedValue(mockPedido);
      prisma.comandaArea.create.mockResolvedValue({ id: 2 });

      await expect(service.sincronizarPedido(2n)).resolves.toBe(1);
    });
  });

  describe('combo repartido por área', () => {
    it('reparte las líneas del combo a sus áreas y muestra el nombre del combo en cada comanda', async () => {
      // Mock de pedido con combo repartido en Bebidas (área 1) y Postres (área 3)
      const mockPedidoCombo = {
        id: 5n,
        codigo: 'CP-COMBO-1',
        canal: 'CARTA',
        modalidad: 'LLEVAR',
        estado: 'COLA',
        creado_en: new Date(),
        lineas: [
          {
            id: 50n,
            nombre: 'Frappé de Fresa',
            cantidad: 1,
            tamano: 'Regular',
            sabor: null,
            area_id: 1n, // Barra
            combo_nombre: 'Dúo Caprichos',
            opciones: [{ nombre: 'Sin azúcar', grupo: 'Endulzante' }],
            nombres_persona: ['Carla'],
            nota: 'Con poco hielo',
          },
          {
            id: 51n,
            nombre: 'Cheesecake de Frutos Rojos',
            cantidad: 1,
            tamano: 'Porción',
            sabor: null,
            area_id: 3n, // Postres
            combo_nombre: 'Dúo Caprichos',
            opciones: [],
            nombres_persona: ['Carla'],
            nota: 'Para llevar en caja',
          },
        ],
      };

      prisma.pedido.findMany.mockResolvedValue([]); // Para sincronizarPendientes
      prisma.areaCocina.findFirst.mockResolvedValue({ id: 1n, nombre: 'Barra' });
      prisma.comandaArea.findMany.mockResolvedValue([
        {
          pedido_id: 5n,
          area_id: 1n,
          estado: 'EN_COCINA',
          llego_en: new Date(),
          pedido: mockPedidoCombo,
        },
      ]);

      const comandasBarra = await service.listarComandas('Barra');

      expect(comandasBarra).toHaveLength(1);
      const comanda = comandasBarra[0];
      expect(comanda.ticket).toBe('CP-COMBO-1');
      expect(comanda.lineas).toHaveLength(1);
      expect(comanda.lineas[0].nombre).toBe('Frappé de Fresa');
      expect(comanda.lineas[0].combo).toBe('Dúo Caprichos');
      expect(comanda.lineas[0].personas).toEqual(['Carla']);
      expect(comanda.lineas[0].nota).toBe('Con poco hielo');

      // NUNCA devuelve teléfono ni dirección
      expect((comanda as any).cliente_telefono).toBeUndefined();
      expect((comanda as any).entrega_direccion).toBeUndefined();
    });
  });

  describe('vista general sin área', () => {
    it('devuelve las comandas de todas las áreas activas, las más antiguas primero, sincronizando una sola vez', async () => {
      const ahora = Date.now();
      const pedido = (id: bigint, codigo: string, minAtras: number, areaId: bigint) => ({
        id,
        codigo,
        creado_en: new Date(ahora - minAtras * 60000),
        modalidad: 'DELIVERY',
        lineas: [{ id: id * 10n, nombre: 'Producto', cantidad: 1, area_id: areaId, opciones: [], nombres_persona: [], producto: { categoria: { area_id: areaId } }, opcionesElegidas: [] }],
      });
      prisma.pedido.findMany.mockResolvedValue([]);
      prisma.areaCocina.findMany.mockResolvedValue([{ id: 1n, nombre: 'Barra' }, { id: 3n, nombre: 'Postres' }]);
      prisma.areaCocina.findFirst.mockImplementation(async ({ where }: any) => ({ id: where.OR ? 1n : 1n, nombre: 'Barra' }));
      prisma.comandaArea.findMany
        .mockResolvedValueOnce([{ pedido_id: 1n, area_id: 1n, estado: 'EN_COCINA', llego_en: new Date(), pedido: pedido(1n, 'CP-1', 10, 1n) }])
        .mockResolvedValueOnce([{ pedido_id: 2n, area_id: 3n, estado: 'EN_COCINA', llego_en: new Date(), pedido: pedido(2n, 'CP-2', 40, 3n) }]);

      const todas = await service.listarComandas();

      expect(prisma.pedido.findMany).toHaveBeenCalledTimes(1); // una sola sincronización
      expect(todas.map((c: any) => c.ticket)).toEqual(['CP-2', 'CP-1']);
    });
  });

  describe('delivery sin ubicación', () => {
    it('despejar un delivery sin ubicación: 409 DELIVERY_SIN_UBICACION', async () => {
      prisma.pedido.findUnique.mockResolvedValue({ id: 9n, codigo: 'CP-0009', estado: 'COLA', modalidad: 'DELIVERY', entrega_lat: null, entrega_lng: null, zona_id: null, comandas: [] });
      await expect(service.despejar(9n, 1n, mockUsuario)).rejects.toMatchObject({ response: { codigo: 'DELIVERY_SIN_UBICACION' } });
    });

    it('sincronizar pendientes excluye los delivery sin ubicación', async () => {
      prisma.pedido.findMany.mockResolvedValue([]);
      await service.sincronizarPendientes();
      expect(prisma.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ NOT: expect.objectContaining({ modalidad: 'DELIVERY' }) }) }),
      );
    });
  });

  describe('pedido de dos áreas: al terminar todas queda En despacho (NO pasa solo a LISTO)', () => {
    it('al despejar la última área no avisa al mozo ni cambia el estado: espera a Despacho', async () => {
      const probar = async (modalidad: string) => {
        const pedido = { id: 8n, codigo: 'CP-0008', estado: 'COLA', modalidad, pasa_cocina_en: new Date(), entrega_lat: -12.1, entrega_lng: -77, zona_id: 1n };
        prisma.pedido.findUnique.mockResolvedValue(pedido);
        prisma.comandaArea.findUnique.mockResolvedValue({ pedido_id: 8n, area_id: 1n, estado: 'EN_COCINA' });
        prisma.comandaArea.findMany.mockResolvedValue([{ pedido_id: 8n, area_id: 1n, estado: 'DESPEJADA' }]);
        prisma.pedido.update.mockResolvedValue({ ...pedido, estado: 'LISTO' });
        await service.despejar(8n, 1n, mockUsuario);
      };
      await probar('MESA');
      expect(salonMock.avisarListo).not.toHaveBeenCalled();
      expect(prisma.pedido.update).not.toHaveBeenCalled();
      await probar('DELIVERY');
      expect(salonMock.avisarListo).not.toHaveBeenCalled();
    });

    it('al despejar la primera área sigue en COLA; al despejar la segunda queda completo pero sigue en COLA (Despacho lo pasa a LISTO)', async () => {
      const pedidoMock = {
        id: 7n,
        codigo: 'CP-0007',
        estado: 'COLA',
        pasa_cocina_en: new Date(),
      };

      // 1. Despeje de Área 1
      prisma.pedido.findUnique.mockResolvedValue(pedidoMock);
      prisma.comandaArea.findUnique.mockResolvedValue({
        pedido_id: 7n,
        area_id: 1n,
        estado: 'EN_COCINA',
      });
      // Simular que comanda 1 quedó DESPEJADA pero comanda 2 sigue EN_COCINA
      prisma.comandaArea.findMany.mockResolvedValue([
        { pedido_id: 7n, area_id: 1n, estado: 'DESPEJADA' },
        { pedido_id: 7n, area_id: 2n, estado: 'EN_COCINA' },
      ]);

      const res1 = await service.despejar(7n, 1n, mockUsuario);

      expect(res1.completo).toBe(false);
      expect(prisma.pedido.update).not.toHaveBeenCalled();
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('cocina:comanda', {
        pedidoId: 7,
        areaId: 1,
        completo: false,
      });

      // 2. Despeje de Área 2
      prisma.pedido.findUnique.mockResolvedValue(pedidoMock);
      prisma.comandaArea.findUnique.mockResolvedValue({
        pedido_id: 7n,
        area_id: 2n,
        estado: 'EN_COCINA',
      });
      // Simular que ambas están DESPEJADAS
      prisma.comandaArea.findMany.mockResolvedValue([
        { pedido_id: 7n, area_id: 1n, estado: 'DESPEJADA' },
        { pedido_id: 7n, area_id: 2n, estado: 'DESPEJADA' },
      ]);
      prisma.pedido.update.mockResolvedValue({ ...pedidoMock, estado: 'LISTO' });

      const res2 = await service.despejar(7n, 2n, mockUsuario);

      expect(res2.completo).toBe(true);
      expect(prisma.pedido.update).not.toHaveBeenCalled();
      expect(prisma.pedidoEstadoHistorial.create).not.toHaveBeenCalled();
      expect(eventosGateway.emitirAdmin).not.toHaveBeenCalledWith('pedido:estado', expect.anything());
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('cocina:comanda', {
        pedidoId: 7,
        areaId: 2,
        completo: true,
      });
    });

    it('da 409 ConflictException si el pedido está ANULADO o no está en COLA/PREPARANDO', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: 8n,
        codigo: 'CP-0008',
        estado: 'ANULADO',
      });

      await expect(service.despejar(8n, 1n, mockUsuario)).rejects.toThrow(ConflictException);
    });

    it('da 409 ConflictException si la comanda ya está DESPEJADA', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: 8n,
        codigo: 'CP-0008',
        estado: 'COLA',
      });
      prisma.comandaArea.findUnique.mockResolvedValue({
        pedido_id: 8n,
        area_id: 1n,
        estado: 'DESPEJADA',
      });

      await expect(service.despejar(8n, 1n, mockUsuario)).rejects.toThrow(ConflictException);
    });
  });

  describe('devolver comanda', () => {
    it('vuelve la comanda a pendiente y si el pedido estaba LISTO regresa a COLA con historial y auditoría', async () => {
      const pedidoListo = {
        id: 9n,
        codigo: 'CP-0009',
        estado: 'LISTO',
      };

      prisma.pedido.findUnique.mockResolvedValue(pedidoListo);
      prisma.comandaArea.findUnique.mockResolvedValue({
        pedido_id: 9n,
        area_id: 1n,
        estado: 'DESPEJADA',
      });
      prisma.comandaArea.update.mockResolvedValue({
        pedido_id: 9n,
        area_id: 1n,
        estado: 'EN_COCINA',
      });
      prisma.pedido.update.mockResolvedValue({ ...pedidoListo, estado: 'COLA' });

      const res = await service.devolver(9n, 1n, mockUsuario);

      expect(res.ok).toBe(true);
      expect(res.estado).toBe('EN_COCINA');
      expect(prisma.pedido.update).toHaveBeenCalledWith({
        where: { id: 9n },
        data: { estado: 'COLA' },
      });
      expect(prisma.pedidoEstadoHistorial.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pedido_id: 9n,
          estado_anterior: 'LISTO',
          estado_nuevo: 'COLA',
        }),
      });
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('pedido:estado', {
        id: 9,
        codigo: 'CP-0009',
        estado: 'COLA',
      });
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith('cocina:comanda', {
        pedidoId: 9,
        areaId: 1,
        completo: false,
      });
    });

    it('da 409 ConflictException si el pedido ya salió (EN_CAMINO o ENTREGADO)', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: 10n,
        codigo: 'CP-0010',
        estado: 'EN_CAMINO',
      });

      await expect(service.devolver(10n, 1n, mockUsuario)).rejects.toThrow(ConflictException);
    });

    it('no permite devolver si el pedido ya se entregó (ENTREGADO) o anuló', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: 11n,
        codigo: 'CP-0011',
        estado: 'ENTREGADO',
      });
      await expect(service.devolver(11n, 1n, mockUsuario)).rejects.toThrow(ConflictException);

      prisma.pedido.findUnique.mockResolvedValue({
        id: 12n,
        codigo: 'CP-0012',
        estado: 'ANULADO',
      });
      await expect(service.devolver(12n, 1n, mockUsuario)).rejects.toThrow(ConflictException);
    });

    it('rechaza devolver si la comanda no está en estado DESPEJADA', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: 13n,
        codigo: 'CP-0013',
        estado: 'COLA',
      });
      prisma.comandaArea.findUnique.mockResolvedValue({
        pedido_id: 13n,
        area_id: 1n,
        estado: 'EN_COCINA',
      });

      await expect(service.devolver(13n, 1n, mockUsuario)).rejects.toThrow(ConflictException);
    });
  });

  describe('color por tiempo (DT-69)', () => {
    it('evalúa verde, naranja a partir de 35 min y rojo a partir de 50 min', () => {
      expect(calcularColor(10, 35, 50)).toBe('verde');
      expect(calcularColor(34, 35, 50)).toBe('verde');
      expect(calcularColor(35, 35, 50)).toBe('naranja');
      expect(calcularColor(49, 35, 50)).toBe('naranja');
      expect(calcularColor(50, 35, 50)).toBe('rojo');
      expect(calcularColor(75, 35, 50)).toBe('rojo');
    });
  });

  describe('pedido de tres áreas: seguimiento de áreas despejadas', () => {
    const AREAS = [
      { id: 1n, nombre: 'Barra' },
      { id: 2n, nombre: 'Cocina' },
      { id: 3n, nombre: 'Postres' },
    ];

    // Pedido con una línea por área. Incluye teléfono y dirección para comprobar que no salen.
    const pedidoTresAreas = (id: bigint, estadoPorArea: Record<string, string>) => ({
      id,
      codigo: 'CP-3A',
      canal: 'CARTA',
      modalidad: 'DELIVERY',
      estado: 'COLA',
      cliente_nombre: 'Ana',
      cliente_telefono: '999000111',
      entrega_direccion: 'Av. Secreta 123',
      creado_en: new Date(Date.now() - 5 * 60000),
      lineas: [
        { id: 1n, nombre: 'Americano', cantidad: 1, area_id: 1n, opciones: [], nombres_persona: [] },
        { id: 2n, nombre: 'Waffle', cantidad: 1, area_id: 2n, opciones: [], nombres_persona: [] },
        { id: 3n, nombre: 'Cheesecake', cantidad: 1, area_id: 3n, opciones: [], nombres_persona: [] },
      ],
      comandas: AREAS.map((a) => ({
        pedido_id: id,
        area_id: a.id,
        estado: estadoPorArea[a.nombre] ?? 'EN_COCINA',
        area: { nombre: a.nombre },
      })),
    });

    it('la pantalla de Barra sigue mostrando el pedido despejado por Barra, con el estado de cada área', async () => {
      const pedido = pedidoTresAreas(7n, { Barra: 'DESPEJADA' });
      prisma.pedido.findMany.mockResolvedValue([]);
      prisma.areaCocina.findFirst.mockResolvedValue({ id: 1n, nombre: 'Barra' });
      prisma.comandaArea.findMany.mockResolvedValue([
        { pedido_id: 7n, area_id: 1n, estado: 'DESPEJADA', llego_en: new Date(), pedido },
      ]);

      const [comanda] = await service.listarComandas('Barra');

      // La consulta incluye el seguimiento: despejada aquí, pero el pedido sigue en otra área
      const where = prisma.comandaArea.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual(
        expect.arrayContaining([
          { estado: 'EN_COCINA' },
          { estado: 'DESPEJADA', pedido: { comandas: { some: { estado: 'EN_COCINA' } } } },
        ]),
      );
      expect(comanda.despejada).toBe(true);
      expect(comanda.lineas.map((l: any) => l.nombre)).toEqual(['Americano']);
      expect(comanda.areas.map((a: any) => [a.areaNombre, a.despejada])).toEqual([
        ['Barra', true],
        ['Cocina', false],
        ['Postres', false],
      ]);
      expect(comanda.areas[1].lineas.map((l: any) => l.nombre)).toEqual(['Waffle']);
    });

    it('en la pantalla de Cocina el pedido aparece pendiente, y Barra figura como despejada', async () => {
      const pedido = pedidoTresAreas(7n, { Barra: 'DESPEJADA' });
      prisma.pedido.findMany.mockResolvedValue([]);
      prisma.areaCocina.findFirst.mockResolvedValue({ id: 2n, nombre: 'Cocina' });
      prisma.comandaArea.findMany.mockResolvedValue([
        { pedido_id: 7n, area_id: 2n, estado: 'EN_COCINA', llego_en: new Date(), pedido },
      ]);

      const [comanda] = await service.listarComandas('Cocina');

      expect(comanda.despejada).toBe(false);
      expect(comanda.areas.find((a: any) => a.areaNombre === 'Barra').despejada).toBe(true);
    });

    it('cuando las tres áreas despejan el pedido no sale de ninguna pantalla', async () => {
      const pedido = pedidoTresAreas(7n, { Barra: 'DESPEJADA', Cocina: 'DESPEJADA', Postres: 'DESPEJADA' });
      prisma.pedido.findMany.mockResolvedValue([]);
      prisma.areaCocina.findFirst.mockResolvedValue({ id: 3n, nombre: 'Postres' });
      // La consulta ya filtra por seguimiento: sin área pendiente en el pedido, no devuelve nada
      prisma.comandaArea.findMany.mockResolvedValue([]);

      const lista = await service.listarComandas('Postres');

      expect(lista).toEqual([]);
      const where = prisma.comandaArea.findMany.mock.calls[0][0].where;
      expect(where.pedido.estado).toEqual({ notIn: ['ANULADO', 'RECHAZADO'] });
      expect(pedido.comandas.every((c: any) => c.estado === 'DESPEJADA')).toBe(true);
    });

    it('en la vista general, las comandas pendientes van antes que las de solo seguimiento', async () => {
      const ahora = Date.now();
      const pedidoSeguimiento = pedidoTresAreas(8n, { Barra: 'DESPEJADA' });
      pedidoSeguimiento.creado_en = new Date(ahora - 50 * 60000); // más antigua
      const pedidoPendiente = pedidoTresAreas(9n, {});
      pedidoPendiente.codigo = 'CP-PEND';
      pedidoPendiente.creado_en = new Date(ahora - 2 * 60000);

      prisma.pedido.findMany.mockResolvedValue([]);
      prisma.areaCocina.findMany.mockResolvedValue([{ id: 1n, nombre: 'Barra' }]);
      prisma.areaCocina.findFirst.mockResolvedValue({ id: 1n, nombre: 'Barra' });
      prisma.comandaArea.findMany.mockResolvedValue([
        { pedido_id: 8n, area_id: 1n, estado: 'DESPEJADA', llego_en: new Date(ahora - 50 * 60000), pedido: pedidoSeguimiento },
        { pedido_id: 9n, area_id: 1n, estado: 'EN_COCINA', llego_en: new Date(ahora - 2 * 60000), pedido: pedidoPendiente },
      ]);

      const lista = await service.listarComandas();

      expect(lista.map((c: any) => c.ticket)).toEqual(['CP-PEND', 'CP-3A']);
      expect(lista.map((c: any) => c.despejada)).toEqual([false, true]);
    });

    it('el contador de pendientes de cada área no cuenta las comandas ya despejadas', async () => {
      prisma.areaCocina.findMany.mockResolvedValue([{ id: 1n, nombre: 'Barra', propia: true }]);
      prisma.comandaArea.count.mockResolvedValue(2);

      const [area] = await service.listarAreas();

      expect(area.comandasPendientes).toBe(2);
      expect(prisma.comandaArea.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ area_id: 1n, estado: 'EN_COCINA' }),
      });
    });

    it('la vista general trae una fila por área pendiente del pedido, todas con el mismo estado de áreas', async () => {
      const pedido = pedidoTresAreas(7n, { Barra: 'DESPEJADA' });
      prisma.pedido.findMany.mockResolvedValue([]);
      prisma.areaCocina.findMany.mockResolvedValue(AREAS);
      prisma.areaCocina.findFirst.mockImplementation(async ({ where }: any) =>
        AREAS.find((a) => a.id === BigInt(where.OR[0].id)),
      );
      prisma.comandaArea.findMany.mockImplementation(async ({ where }: any) => {
        const fila = pedido.comandas.find((c: any) => c.area_id === where.area_id);
        return [{ pedido_id: 7n, area_id: where.area_id, estado: fila!.estado, llego_en: new Date(), pedido }];
      });

      const lista = await service.listarComandas();

      // La pantalla TV cuenta las filas por área; la boleta única por pedido se arma en el admin
      expect(lista.map((c: any) => c.areaNombre)).toEqual(['Cocina', 'Postres', 'Barra']);
      expect(lista.every((c: any) => c.pedidoId === '7')).toBe(true);
      expect(lista.every((c: any) => c.areas.map((a: any) => a.areaNombre).join() === 'Barra,Cocina,Postres')).toBe(true);
    });

    it('la respuesta nunca trae teléfono ni dirección del cliente', async () => {
      const pedido = pedidoTresAreas(7n, { Barra: 'DESPEJADA' });
      prisma.pedido.findMany.mockResolvedValue([]);
      prisma.areaCocina.findFirst.mockResolvedValue({ id: 1n, nombre: 'Barra' });
      prisma.comandaArea.findMany.mockResolvedValue([
        { pedido_id: 7n, area_id: 1n, estado: 'DESPEJADA', llego_en: new Date(), pedido },
      ]);

      const lista = await service.listarComandas('Barra');
      const texto = JSON.stringify(lista);

      expect(texto).not.toContain('999000111');
      expect(texto).not.toContain('Av. Secreta');
      expect(texto).not.toContain('cliente_telefono');
      expect(texto).not.toContain('entrega_direccion');
      expect(texto).toContain('Ana');
    });
  });
});

describe('distribucionSabores (cocina: reparto por sabor de la línea)', () => {
  it('muestra cada sabor con sus unidades; sin reparto no hay texto', () => {
    expect(
      distribucionSabores({
        sabores: [
          { sabor_nombre: 'Fresa', cantidad: 2 },
          { sabor_nombre: 'Oreo', cantidad: 3 },
          { sabor_nombre: 'Manjar', cantidad: 1 },
        ],
      }),
    ).toBe('2 Fresa · 3 Oreo · 1 Manjar');
    expect(distribucionSabores({ sabores: [] })).toBeNull();
    expect(distribucionSabores({})).toBeNull();
  });
});

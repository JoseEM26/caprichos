jest.mock('@nestjs/jwt', () => {
  return {
    JwtService: jest.fn().mockImplementation(() => ({
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    })),
    JwtModule: {
      registerAsync: jest.fn().mockReturnValue({
        module: class MockJwtModule {},
      }),
    },
  };
});
jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { QuejasWhatsappService } from '../servicios/quejas-whatsapp.service';
import { QuejasWhatsappController } from '../controladores/quejas-whatsapp.controller';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { WhatsAppMensajeriaPuerto } from '../puerto/whatsapp-mensajeria.puerto';

describe('QuejasWhatsappService y Controller', () => {
  let service: QuejasWhatsappService;
  let controller: QuejasWhatsappController;
  let mockPrisma: any;
  let mockAuditoria: any;
  let mockMensajeria: any;

  beforeEach(() => {
    mockPrisma = {
      quejaWhatsapp: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: BigInt(1),
            origen: 'ENCUESTA',
            pedido_id: BigInt(10),
            cliente: 'Ana Lopez',
            telefono_hash: 'hash123',
            puntaje: 1,
            texto: 'El pedido llego frio y demoro mucho',
            estado: 'NUEVA',
            atendida_por: null,
            resolucion: null,
            creada_en: new Date('2026-10-25T01:00:00Z'),
            actualizada_en: new Date('2026-10-25T01:00:00Z'),
            pedido: {
              codigo: 'CP-1010',
              cliente_nombre: 'Ana Lopez',
              cliente_telefono: '51987654321',
              total: 45.0,
            },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue({
          id: BigInt(1),
          origen: 'ENCUESTA',
          pedido_id: BigInt(10),
          cliente: 'Ana Lopez',
          telefono_hash: 'hash123',
          puntaje: 1,
          texto: 'El pedido llego frio',
          estado: 'NUEVA',
          atendida_por: null,
          resolucion: null,
          creada_en: new Date('2026-10-25T01:00:00Z'),
          actualizada_en: new Date('2026-10-25T01:00:00Z'),
          pedido: {
            id: BigInt(10),
            codigo: 'CP-1010',
            cliente_nombre: 'Ana Lopez',
            cliente_telefono: '51987654321',
            modalidad: 'DELIVERY',
            total: 45.0,
            creado_en: new Date('2026-10-25T00:30:00Z'),
          },
        }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: BigInt(1),
            estado: data.estado,
            atendida_por: data.atendida_por,
            resolucion: data.resolucion,
            actualizada_en: new Date(),
          }),
        ),
      },
      encuestaPosventa: {
        findMany: jest.fn().mockResolvedValue([
          { puntaje: 5 },
          { puntaje: 4 },
          { puntaje: 1 },
        ]),
      },
      whatsappMensaje: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    mockAuditoria = {
      registrar: jest.fn().mockResolvedValue({ id: BigInt(1) }),
    };

    mockMensajeria = {
      estaConectado: jest.fn().mockReturnValue({
        conectado: false,
        modo: 'simulado',
        razon: 'Modo simulado activo',
      }),
    };

    service = new QuejasWhatsappService(
      mockPrisma as PrismaService,
      mockAuditoria as AuditoriaService,
    );

    controller = new QuejasWhatsappController(service, mockMensajeria as WhatsAppMensajeriaPuerto);
  });

  it('lista quejas y calcula promedio de satisfacción y conteos por estado', async () => {
    const res = await controller.listar('todos', 1, 20);

    expect(res.quejas).toHaveLength(1);
    expect(res.quejas[0].cliente).toBe('Ana Lopez');
    expect(res.quejas[0].telefonoEnmascarado).toBe('+51 9*** ***21');
    expect(res.resumen.totalEncuestas).toBe(3);
    // (5 + 4 + 1) / 3 = 3.3
    expect(res.resumen.promedio).toBe(3.3);
  });

  it('obtiene el detalle de una queja específica', async () => {
    const detalle = await controller.obtenerDetalle('1');

    expect(detalle.id).toBe('1');
    expect(detalle.pedidoCodigo).toBe('CP-1010');
    expect(detalle.texto).toBe('El pedido llego frio');
  });

  it('cambia el estado a EN_REVISION y registra auditoría', async () => {
    const req = {
      usuario: { rol: 'CAJERO', partyId: BigInt(5) },
      ip: '127.0.0.1',
    };

    const res = await controller.cambiarEstado(
      '1',
      { estado: 'EN_REVISION', nota: 'Tomando contacto con el cliente' },
      req,
    );

    expect(res.ok).toBe(true);
    expect(res.estado).toBe('EN_REVISION');
    expect(mockPrisma.quejaWhatsapp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(1) },
        data: expect.objectContaining({
          estado: 'EN_REVISION',
          resolucion: 'Tomando contacto con el cliente',
        }),
      }),
    );
    expect(mockAuditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'CAMBIAR_ESTADO_QUEJA_WHATSAPP',
      }),
    );
  });

  it('cambia el estado a RESUELTA con nota final', async () => {
    const req = {
      usuario: { rol: 'ADMIN', partyId: BigInt(1) },
      ip: '127.0.0.1',
    };

    const res = await controller.cambiarEstado(
      '1',
      { estado: 'RESUELTA', nota: 'Se coordino reposicion del producto con el cliente' },
      req,
    );

    expect(res.ok).toBe(true);
    expect(res.estado).toBe('RESUELTA');
  });

  it('el indicador solo-lectura no expone credenciales ni secretos', () => {
    const estado = controller.obtenerEstadoConexion();

    expect(estado.modo).toBe('simulado');
    expect(estado.conectado).toBe(false);
    expect(JSON.stringify(estado)).not.toContain('token');
    expect(JSON.stringify(estado)).not.toContain('secret');
  });
});

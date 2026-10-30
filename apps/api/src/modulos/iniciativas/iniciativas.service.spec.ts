import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IniciativasService } from './iniciativas.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ArchivosService } from '../archivos/archivos.service';
import { TipoIniciativa, AreaIniciativa } from './dto/crear-iniciativa.dto';
import { EstadoIniciativa } from './dto/cambiar-estado.dto';

describe('IniciativasService', () => {
  let service: IniciativasService;
  let prisma: {
    iniciativa: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    iniciativaComentario: {
      create: jest.Mock;
    };
    userAccount: {
      findUnique: jest.Mock;
    };
  };
  let auditoria: {
    registrar: jest.Mock;
  };

  const usuarioAdmin = {
    partyId: BigInt(1),
    rol: 'ADMIN',
    debeCambiar: false,
  } as any;

  const usuarioMozo = {
    partyId: BigInt(2),
    rol: 'MOZO',
    debeCambiar: false,
  } as any;

  beforeEach(async () => {
    prisma = {
      iniciativa: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      iniciativaComentario: {
        create: jest.fn(),
      },
      userAccount: {
        findUnique: jest.fn(),
      },
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IniciativasService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: ArchivosService, useValue: {} },
      ],
    }).compile();

    service = module.get<IniciativasService>(IniciativasService);
  });

  describe('generarCodigo', () => {
    it('genera IN-0001 si no hay iniciativas', async () => {
      prisma.iniciativa.findMany.mockResolvedValue([]);
      const codigo = await service.generarCodigo();
      expect(codigo).toBe('IN-0001');
    });

    it('genera el código siguiente secuencialmente', async () => {
      prisma.iniciativa.findMany.mockResolvedValue([{ codigo: 'IN-0007' }]);
      const codigo = await service.generarCodigo();
      expect(codigo).toBe('IN-0008');
    });

    it('usa el mayor código aunque los ids estén desordenados', async () => {
      prisma.iniciativa.findMany.mockResolvedValue([
        { codigo: 'IN-0009' },
        { codigo: 'IN-0002' },
        { codigo: 'IN-0004' },
      ]);
      const codigo = await service.generarCodigo();
      expect(codigo).toBe('IN-0010');
    });
  });

  describe('listar', () => {
    it('retorna conteos dinámicos y elementos mapeados', async () => {
      prisma.iniciativa.count.mockImplementation(({ where }: any = {}) => {
        if (!where) return Promise.resolve(3);
        if (where.estado === 'NUEVA') return Promise.resolve(1);
        if (where.estado === 'EN_REVISION') return Promise.resolve(1);
        if (where.estado === 'HECHA') return Promise.resolve(1);
        if (where.estado === 'NO_POR_AHORA') return Promise.resolve(0);
        if (where.tipo === 'QUEJA') return Promise.resolve(1);
        if (where.tipo === 'MEJORA') return Promise.resolve(1);
        if (where.tipo === 'IDEA') return Promise.resolve(1);
        return Promise.resolve(0);
      });

      prisma.iniciativa.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          codigo: 'IN-0001',
          tipo: 'QUEJA',
          area: 'PEDIDOS_CAJA',
          titulo: 'Tablet sin batería',
          detalle: 'Se apaga a media tarde',
          archivo_id: BigInt(10),
          estado: 'NUEVA',
          creado_en: new Date('2026-10-22T10:00:00Z'),
          creado_por: BigInt(2),
          autor: {
            rol: 'MOZO',
            party: { persona: { nombres: 'Mozo', apellidos: 'Prueba' } },
          },
          comentarios: [
            {
              id: BigInt(1),
              iniciativa_id: BigInt(1),
              texto: 'Revisando cargador',
              creado_en: new Date('2026-10-22T10:15:00Z'),
              creado_por: BigInt(1),
              autor: {
                rol: 'ADMIN',
                party: { persona: { nombres: 'Admin', apellidos: 'Prueba' } },
              },
            },
          ],
        },
      ]);

      const res = await service.listar({}, usuarioAdmin);

      expect(res.conteos.total).toBe(3);
      expect(res.conteos.nuevas).toBe(1);
      expect(res.elementos).toHaveLength(1);
      expect(res.elementos[0].codigo).toBe('IN-0001');
      expect(res.elementos[0].tipoTexto).toBe('Queja');
      expect(res.elementos[0].areaTexto).toBe('Pedidos y caja');
      expect(res.elementos[0].fotoUrl).toBe('/admin/archivos/10');
      expect(res.elementos[0].totalComentarios).toBe(1);
      expect(res.elementos[0].comentarios[0].autor.nombre).toBe('Admin Prueba');
    });

    it('filtra por soloMias usando el partyId del usuario', async () => {
      prisma.iniciativa.count.mockResolvedValue(0);
      prisma.iniciativa.findMany.mockResolvedValue([]);

      await service.listar({ soloMias: true }, usuarioMozo);

      expect(prisma.iniciativa.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            autor: { party_id: BigInt(2) },
          }),
        }),
      );
    });
  });

  describe('crear', () => {
    const dtoIdea = {
      tipo: TipoIniciativa.IDEA,
      area: AreaIniciativa.CARTA_WEB,
      titulo: 'Nuevo combo',
      detalle: 'Vender waffle + café',
    };

    const filaCreada = (codigo: string) => ({
      id: BigInt(5),
      codigo,
      tipo: 'IDEA',
      area: 'CARTA_WEB',
      titulo: 'Nuevo combo',
      detalle: 'Vender waffle + café',
      archivo_id: null,
      estado: 'NUEVA',
      creado_en: new Date(),
      creado_por: BigInt(2),
    });

    const errorP2002 = (target: unknown) =>
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target },
      });

    it('crea iniciativa, asigna código y registra auditoría', async () => {
      prisma.userAccount.findUnique.mockResolvedValue({ id: BigInt(2) });
      prisma.iniciativa.findMany.mockResolvedValue([]);
      prisma.iniciativa.create.mockResolvedValue(filaCreada('IN-0001'));

      const res = await service.crear(dtoIdea, usuarioMozo, '192.168.1.50');

      expect(res.codigo).toBe('IN-0001');
      expect(res.estado).toBe('NUEVA');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'iniciativas',
          accion: 'INICIATIVA_NUEVA',
          ip: '192.168.1.50',
          partyId: BigInt(2),
        }),
      );
    });

    it('reintenta con el siguiente código si hay P2002 sobre codigo', async () => {
      prisma.userAccount.findUnique.mockResolvedValue({ id: BigInt(2) });
      prisma.iniciativa.findMany.mockResolvedValue([{ codigo: 'IN-0003' }]);
      prisma.iniciativa.create
        .mockRejectedValueOnce(errorP2002(['codigo']))
        .mockResolvedValueOnce(filaCreada('IN-0005'));

      const res = await service.crear(dtoIdea, usuarioMozo);

      expect(prisma.iniciativa.create).toHaveBeenCalledTimes(2);
      expect(prisma.iniciativa.create.mock.calls[0][0].data.codigo).toBe('IN-0004');
      expect(prisma.iniciativa.create.mock.calls[1][0].data.codigo).toBe('IN-0005');
      expect(res.codigo).toBe('IN-0005');
    });

    it('relanza un error que no es P2002 sobre codigo', async () => {
      prisma.userAccount.findUnique.mockResolvedValue({ id: BigInt(2) });
      prisma.iniciativa.findMany.mockResolvedValue([]);
      const fallo = new Error('conexión perdida');
      prisma.iniciativa.create.mockRejectedValue(fallo);

      await expect(service.crear(dtoIdea, usuarioMozo)).rejects.toBe(fallo);
      expect(prisma.iniciativa.create).toHaveBeenCalledTimes(1);
    });

    it('relanza un P2002 de otro campo sin reintentar', async () => {
      prisma.userAccount.findUnique.mockResolvedValue({ id: BigInt(2) });
      prisma.iniciativa.findMany.mockResolvedValue([]);
      const otro = errorP2002(['creado_por']);
      prisma.iniciativa.create.mockRejectedValue(otro);

      await expect(service.crear(dtoIdea, usuarioMozo)).rejects.toBe(otro);
      expect(prisma.iniciativa.create).toHaveBeenCalledTimes(1);
    });

    it('tras 5 intentos fallidos responde 409 con CODIGO_DUPLICADO', async () => {
      prisma.userAccount.findUnique.mockResolvedValue({ id: BigInt(2) });
      prisma.iniciativa.findMany.mockResolvedValue([]);
      prisma.iniciativa.create.mockRejectedValue(errorP2002(['codigo']));

      const error = await service.crear(dtoIdea, usuarioMozo).catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual({
        codigo: 'CODIGO_DUPLICADO',
        mensaje: 'No se pudo generar el código de la iniciativa. Inténtalo de nuevo.',
      });
      expect(prisma.iniciativa.create).toHaveBeenCalledTimes(5);
      expect(auditoria.registrar).not.toHaveBeenCalled();
    });
  });

  describe('comentar', () => {
    it('agrega un comentario y lo audita', async () => {
      prisma.userAccount.findUnique.mockResolvedValue({ id: BigInt(1) });
      prisma.iniciativa.findUnique.mockResolvedValue({ id: BigInt(5) });
      prisma.iniciativaComentario.create.mockResolvedValue({
        id: BigInt(12),
        iniciativa_id: BigInt(5),
        texto: 'Buen aporte',
        creado_en: new Date(),
        creado_por: BigInt(1),
        autor: {
          rol: 'ADMIN',
          party: { persona: { nombres: 'Kevin', apellidos: 'Rosales' } },
        },
      });

      const res = await service.comentar(
        5,
        { texto: 'Buen aporte' },
        usuarioAdmin,
        '127.0.0.1',
      );

      expect(res.id).toBe('12');
      expect(res.texto).toBe('Buen aporte');
      expect(res.autor.nombre).toBe('Kevin Rosales');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'iniciativas',
          accion: 'INICIATIVA_COMENTARIO',
        }),
      );
    });

    it('falla con 404 si la iniciativa no existe', async () => {
      prisma.iniciativa.findUnique.mockResolvedValue(null);

      await expect(
        service.comentar(999, { texto: 'Test' }, usuarioAdmin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cambiarEstado', () => {
    it('solo permite al administrador cambiar de estado y audita el cambio', async () => {
      prisma.userAccount.findUnique.mockResolvedValue({ id: BigInt(1) });
      prisma.iniciativa.findUnique.mockResolvedValue({
        id: BigInt(5),
        estado: 'NUEVA',
      });
      prisma.iniciativa.update.mockResolvedValue({
        id: BigInt(5),
        codigo: 'IN-0001',
        estado: 'EN_REVISION',
      });

      const res = await service.cambiarEstado(
        5,
        { estado: EstadoIniciativa.EN_REVISION },
        usuarioAdmin,
        '10.0.0.1',
      );

      expect(res.estado).toBe('EN_REVISION');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'iniciativas',
          accion: 'INICIATIVA_ESTADO',
          antes: { estado: 'NUEVA' },
          despues: { estado: 'EN_REVISION' },
        }),
      );
    });

    it('rechaza con ForbiddenException a un usuario no admin', async () => {
      await expect(
        service.cambiarEstado(
          5,
          { estado: EstadoIniciativa.EN_REVISION },
          usuarioMozo,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

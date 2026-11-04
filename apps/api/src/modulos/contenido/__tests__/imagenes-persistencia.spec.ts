jest.mock('../../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
    emitirPublico = jest.fn();
  },
}));

import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ContenidoService } from '../contenido.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { OfertasService } from '../../ofertas/ofertas.service';

/**
 * Las imágenes del diseñador, novedades y destacadas deben quedar como archivos subidos:
 * el borrador guarda solo URLs (nunca data URLs) y al publicar se busca el archivo por su ruta.
 */
describe('Imágenes de contenido: borrador y publicación', () => {
  let service: ContenidoService;
  let prisma: any;
  const usuario = { partyId: BigInt(10), rol: 'ADMIN', debeCambiar: false };
  const DATA = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

  beforeEach(async () => {
    prisma = {
      versionCarta: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }) => ({ id: BigInt(1), ...data })),
        update: jest.fn(),
      },
      parametro: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      archivo: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }) => ({ id: BigInt(77), ...data })),
      },
      destacada: {
        aggregate: jest.fn().mockResolvedValue({ _max: { orden: 2 } }),
        create: jest.fn(async ({ data }) => ({ id: BigInt(9), titulo: data.titulo, ...data })),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        ContenidoService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn(), emitirPublico: jest.fn() } },
        { provide: OfertasService, useValue: { actualizarOferta: jest.fn() } },
      ],
    }).compile();
    service = module.get(ContenidoService);
  });

  it('el borrador del diseñador no guarda data URLs (banner, productos ni momentos)', async () => {
    await service.guardarBorradorDiseno(
      {
        contenido: {
          banner: { foto: DATA },
          productos: [{ id: 'p1', fotoUrl: DATA }, { id: 'p2', fotoUrl: '/archivos/publico/2026/10/a.webp' }],
          momentos: { orden: ['nuevo-1'], nuevos: [{ id: 'nuevo-1', titulo: 'x', foto: DATA }] },
        },
      } as any,
      usuario,
    );
    const guardado = prisma.versionCarta.create.mock.calls[0][0].data.contenido;
    expect(JSON.stringify(guardado)).not.toContain('data:');
    expect(guardado.banner.foto).toBeUndefined();
    expect(guardado.productos.map((p: any) => p.fotoUrl)).toEqual([undefined, '/archivos/publico/2026/10/a.webp']);
    expect(guardado.momentos.nuevos).toEqual([{ id: 'nuevo-1', titulo: 'x' }]);
  });

  it('el borrador de novedades guarda solo las URLs de fotos subidas', async () => {
    await service.guardarNovedadesBorrador(
      [{ id: 'n1', titulo: 'Evento', fotos: [DATA, '/archivos/publico/2026/10/b.webp'] }],
      usuario,
    );
    const valor = prisma.parametro.upsert.mock.calls[0][0].update.valor;
    expect(valor.items[0].fotos).toEqual(['/archivos/publico/2026/10/b.webp']);
    expect(JSON.stringify(valor)).not.toContain('data:');
  });

  it('el borrador de Conócenos no guarda data URLs', async () => {
    await service.guardarBorradorConocenos({ bloques: [{ id: 'x', foto: DATA, titulo: 'T' }] }, usuario);
    const valor = prisma.parametro.upsert.mock.calls[0][0].update.valor;
    expect(JSON.stringify(valor)).not.toContain('data:');
  });

  it('al publicar una destacada, la portada /archivos/<ruta> apunta al archivo subido y no crea otro', async () => {
    prisma.archivo.findFirst.mockResolvedValue({ id: BigInt(5), ruta: 'publico/2026/10/a.webp' });

    await service.crearDestacada({ titulo: 'Momento', portada_url: '/archivos/publico/2026/10/a.webp' } as any, usuario);

    expect(prisma.archivo.findFirst).toHaveBeenCalledWith({ where: { ruta: 'publico/2026/10/a.webp' } });
    expect(prisma.archivo.create).not.toHaveBeenCalled();
    expect(prisma.destacada.create.mock.calls[0][0].data.portada_archivo_id).toBe(BigInt(5));
  });

  it('una data URL nunca llega a la tabla archivo: se rechaza con IMAGEN_NO_SUBIDA', async () => {
    await expect(service.crearDestacada({ titulo: 'X', portada_url: DATA } as any, usuario)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.archivo.create).not.toHaveBeenCalled();
    expect(prisma.destacada.create).not.toHaveBeenCalled();
  });
});

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
import { BOTONES_BANNER_DEFECTO } from '../banner-botones';
import { DISPOSICION_CARTA_DEFECTO } from '../disposicion-carta';

describe('Diseño de la carta: disposición en borrador y carta pública', () => {
  let service: ContenidoService;
  let prisma: any;
  const usuario = { partyId: BigInt(10), rol: 'ADMIN', debeCambiar: false };

  beforeEach(async () => {
    prisma = {
      versionCarta: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }) => ({ id: BigInt(1), ...data })), update: jest.fn(), updateMany: jest.fn() },
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      rankingMes: { findMany: jest.fn().mockResolvedValue([]) },
      novedad: { findMany: jest.fn().mockResolvedValue([]) },
      destacada: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const module = await Test.createTestingModule({
      providers: [
        ContenidoService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
        { provide: OfertasService, useValue: { actualizarOferta: jest.fn() } },
      ],
    }).compile();
    service = module.get(ContenidoService);
  });

  it('guarda la disposición validada dentro del contenido del borrador', async () => {
    const disposicion = {
      ...DISPOSICION_CARTA_DEFECTO,
      banner: { tamanoPc: 'grande', tamanoCelular: 'compacto', ajusteFoto: 'contener', focoFoto: 'abajo' },
      carta: { columnasPc: '3' },
    };
    await service.guardarBorradorDiseno({ contenido: { banner: { activo: true }, disposicion } } as any, usuario);
    const data = prisma.versionCarta.create.mock.calls[0][0].data;
    expect(data.contenido.disposicion.banner.tamanoPc).toBe('grande');
    expect(data.contenido.disposicion.carta.columnasPc).toBe('3');
    expect(data.contenido.banner).toEqual({ activo: true, ...BOTONES_BANNER_DEFECTO, modo: 'MES', intervaloSeg: 5, imagenes: [] });
  });

  it('rechaza con 400 un valor fuera de catálogo y no guarda nada', async () => {
    await expect(
      service.guardarBorradorDiseno({ contenido: { disposicion: { banner: { tamanoPc: 'enorme' } } } } as any, usuario),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.versionCarta.create).not.toHaveBeenCalled();
  });

  it('si el cliente no manda disposición, conserva la que ya estaba en el borrador', async () => {
    const previa = { ...DISPOSICION_CARTA_DEFECTO, momentos: { tamano: 'grande' } };
    prisma.versionCarta.findFirst.mockResolvedValue({ id: BigInt(4), contenido: { disposicion: previa } });
    prisma.versionCarta.update.mockResolvedValue({ id: BigInt(4) });
    await service.guardarBorradorDiseno({ contenido: { banner: {} } } as any, usuario);
    const data = prisma.versionCarta.update.mock.calls[0][0].data;
    expect(data.contenido.disposicion.momentos.tamano).toBe('grande');
  });

  it('la carta pública expone la disposición con valores por defecto iguales al diseño anterior', async () => {
    prisma.versionCarta.findFirst.mockResolvedValue({ id: BigInt(2), decoracion: 'NINGUNO', organizacion: 'SECCIONES', contenido: { banner: { activo: true } }, publicada_en: null });
    const res: any = await service.obtenerContenidoPublicoCarta();
    expect(res.disposicion).toEqual(DISPOSICION_CARTA_DEFECTO);
    expect(res.banner).toEqual({ activo: true, ...BOTONES_BANNER_DEFECTO, modo: 'MES', intervaloSeg: 5, imagenes: [] });
  });

  it('la carta pública usa la disposición publicada aunque tenga datos viejos', async () => {
    prisma.versionCarta.findFirst.mockResolvedValue({
      id: BigInt(3), decoracion: 'NINGUNO', organizacion: 'LISTA', publicada_en: null,
      contenido: { disposicion: { banner: { tamanoPc: 'grande' }, secciones: 'roto' } },
    });
    const res: any = await service.obtenerContenidoPublicoCarta();
    expect(res.disposicion.banner.tamanoPc).toBe('grande');
    expect(res.disposicion.secciones).toEqual(DISPOSICION_CARTA_DEFECTO.secciones);
  });
});

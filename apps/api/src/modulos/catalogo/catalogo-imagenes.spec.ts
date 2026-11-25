jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Test } from '@nestjs/testing';
import { CatalogoService } from './catalogo.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

/** Fotos opcionales de tamaños, sabores y opciones + interruptores «Mostrar imágenes» en la carta. */
describe('Carta: imágenes de tamaños, sabores y opciones', () => {
  let service: CatalogoService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      stockSabor: { findMany: jest.fn().mockResolvedValue([]) },
      conteoApertura: { findMany: jest.fn().mockResolvedValue([]) },
      agotado: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      opcionRequiere: { findMany: jest.fn().mockResolvedValue([]) },
      categoria: { findMany: jest.fn() },
      producto: { findMany: jest.fn().mockResolvedValue([]) },
      oferta: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const mod = await Test.createTestingModule({
      providers: [CatalogoService, { provide: PrismaService, useValue: prisma }, { provide: AuditoriaService, useValue: { registrar: jest.fn() } }],
    }).compile();
    service = mod.get(CatalogoService);
    prisma.categoria.findMany.mockResolvedValue([
      {
        id: 1n, nombre: 'Bebidas', orden: 1, oculta: false,
        productos: [{
          id: 10n, nombre: 'Latte', descripcion: null, precio: 8, oculto: false, agotado_hasta: null, no_suma_beneficios: false,
          controla_stock: false, foto_archivo: { ruta: 'latte.jpg' },
          mostrar_imagenes_sabores: true, mostrar_imagenes_tamanos: false,
          tamanos: [
            { id: 1n, tamano_valor_id: 5n, tamano_valor: { nombre: 'Grande' }, precio: 10, unidades: 1, foto_archivo: { ruta: 'grande.jpg' } },
            { id: 2n, tamano_valor_id: 6n, tamano_valor: { nombre: 'Chico' }, precio: 8, unidades: 1, foto_archivo: null },
          ],
          sabores: [
            { id: 3n, nombre: 'Vainilla', activo: true, agotado_hasta: null, foto_archivo: { ruta: 'vainilla.jpg' } },
            { id: 4n, nombre: 'Moka', activo: true, agotado_hasta: null, foto_archivo: null },
          ],
          grupos: [{
            orden: 1,
            grupo: {
              id: 7n, nombre: 'Leche', activo: true, obligatorio: false, minimo: 0, maximo: 1, mostrar_imagenes: true,
              opciones: [
                { id: 70n, activo: true, valor: { nombre: 'Almendra' }, precio_extra: 2, agotado_hasta: null, foto_archivo: { ruta: 'almendra.jpg' } },
                { id: 71n, activo: true, valor: { nombre: 'Entera' }, precio_extra: 0, agotado_hasta: null, foto_archivo: null },
              ],
            },
          }],
        }],
      },
    ]);
  });

  it('expone fotoUrl de tamaño, sabor y opción, y los interruptores', async () => {
    const [p] = (await service.obtenerCarta())[0].productos;
    expect(p.mostrarImagenesSabores).toBe(true);
    expect(p.mostrarImagenesTamanos).toBe(false);
    expect(p.tamanos.map((t) => t.fotoUrl)).toEqual(['/archivos/grande.jpg', null]);
    expect(p.sabores.map((s) => s.fotoUrl)).toEqual(['/archivos/vainilla.jpg', null]);
    expect(p.grupos[0].mostrarImagenes).toBe(true);
    expect(p.grupos[0].opciones.map((o) => o.fotoUrl)).toEqual(['/archivos/almendra.jpg', null]);
  });

  it('respaldo: lo que no tiene foto propia queda en null y el producto conserva la suya', async () => {
    const [p] = (await service.obtenerCarta())[0].productos;
    expect(p.fotoUrl).toBe('/archivos/latte.jpg');
    expect(p.tamanos[1].fotoUrl).toBeNull();
    expect(p.sabores[1].fotoUrl).toBeNull();
  });
});

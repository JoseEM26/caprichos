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

import { Test, TestingModule } from '@nestjs/testing';
import { CartaController, CatalogoController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';
import { AccesoGuard } from '../acceso/acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ConfigService } from '@nestjs/config';

describe('CatalogoControllers', () => {
  let cartaController: CartaController;
  let catalogoController: CatalogoController;
  let service: any;

  beforeEach(async () => {
    service = {
      obtenerCarta: jest.fn(),
      obtenerDisponibilidad: jest.fn(),
      listarProductosAdmin: jest.fn(),
      obtenerProductoPorId: jest.fn(),
      crearProducto: jest.fn(),
      editarProducto: jest.fn(),
      agotarProducto: jest.fn(),
      disponibilizarProducto: jest.fn(),
      ocultarProducto: jest.fn(),
      mostrarProducto: jest.fn(),
      ordenarGruposProducto: jest.fn(),
      asociarFotoProducto: jest.fn(),
      agotarOpcion: jest.fn(),
      disponibilizarOpcion: jest.fn(),
      ocultarOpcion: jest.fn(),
      mostrarOpcion: jest.fn(),
      listarCategoriasAdmin: jest.fn(),
      actualizarCategoria: jest.fn(),
      ocultarCategoria: jest.fn(),
      mostrarCategoria: jest.fn(),
      crearCategoria: jest.fn(),
      listarListasAdmin: jest.fn(),
      crearLista: jest.fn(),
      actualizarLista: jest.fn(),
      agregarValorLista: jest.fn(),
      actualizarValorLista: jest.fn(),
      alternarValorLista: jest.fn(),
      listarGruposAdmin: jest.fn(),
      crearGrupo: jest.fn(),
      actualizarGrupo: jest.fn(),
      editarOpcion: jest.fn(),
      crearOpcionGrupo: jest.fn(),
      asignarGrupoCategorias: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartaController, CatalogoController],
      providers: [
        { provide: CatalogoService, useValue: service },
        { provide: PrismaService, useValue: {} },
        { provide: AuditoriaService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => 'secret' } },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    cartaController = module.get<CartaController>(CartaController);
    catalogoController = module.get<CatalogoController>(CatalogoController);
  });

  describe('CartaController (Público)', () => {
    it('debe responder GET /carta/disponibilidad desde el servicio', async () => {
      service.obtenerDisponibilidad.mockResolvedValue({ productos: [], generadoEn: 'x' });
      expect(await cartaController.obtenerDisponibilidad()).toEqual({ productos: [], generadoEn: 'x' });
    });

    it('debe responder GET /carta invocando catalogoService.obtenerCarta', async () => {
      service.obtenerCarta.mockResolvedValue([
        {
          id: '1',
          nombre: 'Bebidas Calientes',
          orden: 1,
          productos: [],
        },
      ]);

      const res = await cartaController.obtenerCarta('cafe');

      expect(service.obtenerCarta).toHaveBeenCalledWith('cafe');
      expect(res).toHaveLength(1);
      expect(res[0].nombre).toBe('Bebidas Calientes');
    });
  });

  describe('CatalogoController (Admin)', () => {
    it('debe listar productos con filtros', async () => {
      service.listarProductosAdmin.mockResolvedValue([{ id: '10', nombre: 'Capuchino' }]);

      const res = await catalogoController.listarProductos({ busqueda: 'capuchino' });

      expect(service.listarProductosAdmin).toHaveBeenCalledWith({ busqueda: 'capuchino' });
      expect(res).toHaveLength(1);
    });

    it('debe crear producto pasando usuario e IP', async () => {
      service.crearProducto.mockResolvedValue({ id: '15', nombre: 'Mocaccino' });

      const reqMock: any = {
        usuario: { partyId: BigInt(1), rol: 'ADMIN' },
        ip: '127.0.0.1',
      };

      const res = await catalogoController.crearProducto(
        { nombre: 'Mocaccino', categoriaId: '1', precio: 11.5 },
        reqMock,
      );

      expect(service.crearProducto).toHaveBeenCalledWith(
        { nombre: 'Mocaccino', categoriaId: '1', precio: 11.5 },
        reqMock.usuario,
        '127.0.0.1',
      );
      expect(res.id).toBe('15');
    });

    it('debe agotar y disponibilizar producto', async () => {
      service.agotarProducto.mockResolvedValue({ ok: true, disponible: false });
      service.disponibilizarProducto.mockResolvedValue({ ok: true, disponible: true });

      const reqMock: any = { usuario: { partyId: BigInt(1) }, ip: '127.0.0.1' };

      const resAgotar = await catalogoController.agotarProducto('10', {}, reqMock);
      expect(resAgotar.disponible).toBe(false);

      const resDisp = await catalogoController.disponibilizarProducto('10', reqMock);
      expect(resDisp.disponible).toBe(true);
    });

    it('debe ocultar y mostrar producto', async () => {
      service.ocultarProducto.mockResolvedValue({ ok: true, oculto: true });
      service.mostrarProducto.mockResolvedValue({ ok: true, oculto: false });

      const reqMock: any = { usuario: { partyId: BigInt(1) }, ip: '127.0.0.1' };

      const resOcultar = await catalogoController.ocultarProducto('10', reqMock);
      expect(resOcultar.oculto).toBe(true);

      const resMostrar = await catalogoController.mostrarProducto('10', reqMock);
      expect(resMostrar.oculto).toBe(false);
    });

    it('orden-grupos: exige catalogo/editar y delega al servicio', async () => {
      service.ordenarGruposProducto.mockResolvedValue({ ok: true });
      expect(Reflect.getMetadata('permiso', CatalogoController.prototype.ordenarGrupos)).toEqual({ modulo: 'catalogo', accion: 'editar' });
      const req: any = { usuario: { partyId: BigInt(1) }, ip: '127.0.0.1' };
      await catalogoController.ordenarGrupos('10', { grupoIds: ['2', '1'] }, req);
      expect(service.ordenarGruposProducto).toHaveBeenCalledWith('10', ['2', '1'], req.usuario, '127.0.0.1');
    });

    it('debe actualizar categoría', async () => {
      service.actualizarCategoria.mockResolvedValue({ id: '1', nombre: 'Bebidas Especiales' });

      const reqMock: any = { usuario: { partyId: BigInt(1) }, ip: '127.0.0.1' };

      const res = await catalogoController.actualizarCategoria(
        '1',
        { nombre: 'Bebidas Especiales' },
        reqMock,
      );

      expect(service.actualizarCategoria).toHaveBeenCalledWith(
        '1',
        { nombre: 'Bebidas Especiales' },
        reqMock.usuario,
        '127.0.0.1',
      );
      expect(res.nombre).toBe('Bebidas Especiales');
    });

    it('debe crear categoría vía POST /categorias', async () => {
      service.crearCategoria.mockResolvedValue({ id: '5', nombre: 'PIZZAS' });
      const reqMock: any = { usuario: { partyId: BigInt(1) }, ip: '127.0.0.1' };
      const res = await catalogoController.crearCategoria(
        { nombre: 'PIZZAS', areaId: '2' },
        reqMock,
      );
      expect(service.crearCategoria).toHaveBeenCalled();
      expect(res.nombre).toBe('PIZZAS');
    });

    it('debe listar listas y agregar valor vía controller', async () => {
      service.listarListasAdmin.mockResolvedValue([{ id: '1', nombre: 'Tamaños' }]);
      service.agregarValorLista.mockResolvedValue({ id: '10', nombre: '20 oz' });

      const reqMock: any = { usuario: { partyId: BigInt(1) }, ip: '127.0.0.1' };
      const listas = await catalogoController.listarListas();
      expect(listas).toHaveLength(1);

      const nuevoValor = await catalogoController.agregarValor('1', { nombre: '20 oz' }, reqMock);
      expect(nuevoValor.nombre).toBe('20 oz');
    });
  });
});

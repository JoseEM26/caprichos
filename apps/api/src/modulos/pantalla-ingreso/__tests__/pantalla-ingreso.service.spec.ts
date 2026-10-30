import { BadRequestException } from '@nestjs/common';
import { PantallaIngresoService } from '../pantalla-ingreso.service';
import { CLAVE_PARAMETRO_FRASE_INGRESO, CLAVE_PARAMETRO_IMAGENES_INGRESO } from '../pantalla-ingreso.constantes';

describe('PantallaIngresoService', () => {
  let prismaMock: any;
  let auditoriaMock: any;
  let service: PantallaIngresoService;

  beforeEach(() => {
    prismaMock = {
      parametro: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      archivo: {
        findFirst: jest.fn().mockResolvedValue({ id: 1n }),
      },
      $transaction: jest.fn((promesas: unknown[]) => Promise.all(promesas)),
    };
    auditoriaMock = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new PantallaIngresoService(prismaMock, auditoriaMock);
  });

  it('obtenerPublica devuelve los valores por defecto cuando no hay parámetros', async () => {
    const res = await service.obtenerPublica();
    expect(res).toEqual({
      imagenes: ['/imagenes/caprichos/fantasma-cafe.webp'],
      frase: 'Hecho a mano, servido con cariño',
    });
  });

  it('obtenerPublica usa lo guardado y solo expone imágenes y frase', async () => {
    prismaMock.parametro.findMany.mockResolvedValue([
      {
        clave: CLAVE_PARAMETRO_IMAGENES_INGRESO,
        valor: [
          { tipo: 'defecto', valor: 'donuts-halloween.webp' },
          { tipo: 'archivo', valor: '/archivos/publico/2026/10/foto.webp' },
        ],
      },
      { clave: CLAVE_PARAMETRO_FRASE_INGRESO, valor: 'Bienvenida' },
    ]);
    const res = await service.obtenerPublica();
    expect(res).toEqual({
      imagenes: ['/imagenes/caprichos/donuts-halloween.webp', '/archivos/publico/2026/10/foto.webp'],
      frase: 'Bienvenida',
    });
    expect(Object.keys(res).sort()).toEqual(['frase', 'imagenes']);
  });

  it('obtenerPublica cae a los valores por defecto si la base falla', async () => {
    prismaMock.parametro.findMany.mockRejectedValue(new Error('db caída'));
    const res = await service.obtenerPublica();
    expect(res.imagenes).toEqual(['/imagenes/caprichos/fantasma-cafe.webp']);
  });

  it('actualizar guarda ambos parámetros y registra auditoría con antes y después', async () => {
    const usuario = { partyId: 7n, rol: 'ADMIN', debeCambiar: false } as any;
    const res = await service.actualizar(
      {
        imagenes: [{ tipo: 'defecto', valor: 'hechizo-pumpkin.webp' }],
        frase: 'Hola equipo',
      },
      usuario,
      '10.0.0.1',
    );

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.parametro.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clave: CLAVE_PARAMETRO_IMAGENES_INGRESO },
      }),
    );
    expect(prismaMock.parametro.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clave: CLAVE_PARAMETRO_FRASE_INGRESO },
        update: { valor: 'Hola equipo' },
      }),
    );
    expect(auditoriaMock.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        modulo: 'configuracion',
        accion: 'PANTALLA_INGRESO',
        partyId: 7n,
        ip: '10.0.0.1',
      }),
    );
    expect(res.fabrica).toHaveLength(5);
    expect(res.frase).toBe('Hola equipo');
  });

  it('actualizar rechaza una imagen propia que no existe en la tabla de archivos', async () => {
    prismaMock.archivo.findFirst.mockResolvedValue(null);
    await expect(
      service.actualizar({
        imagenes: [{ tipo: 'archivo', valor: '/archivos/publico/2026/10/no.webp' }],
        frase: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.parametro.upsert).not.toHaveBeenCalled();
    expect(auditoriaMock.registrar).not.toHaveBeenCalled();
  });

  it('actualizar consulta solo archivos públicos por la ruta relativa', async () => {
    await service.actualizar({
      imagenes: [{ tipo: 'archivo', valor: '/archivos/publico/2026/10/foto.webp' }],
      frase: 'x',
    });
    expect(prismaMock.archivo.findFirst).toHaveBeenCalledWith({
      where: { ruta: 'publico/2026/10/foto.webp', privado: false },
    });
  });

  it('actualizar no escribe nada si la validación falla', async () => {
    await expect(
      service.actualizar({
        imagenes: [{ tipo: 'defecto', valor: 'no-existe.webp' }],
        frase: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

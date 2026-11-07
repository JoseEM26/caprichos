import { sincronizarAnfitrionCombo } from './combo-anfitrion';

const nuevoTx = (over: any = {}) => ({
  categoria: { findFirst: jest.fn().mockResolvedValue({ id: 50n }), create: jest.fn().mockResolvedValue({ id: 51n }) },
  areaCocina: { findFirst: jest.fn().mockResolvedValue({ id: 1n }) },
  producto: { create: jest.fn().mockResolvedValue({ id: 900n }), update: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
  oferta: { update: jest.fn() },
  productoTamano: { upsert: jest.fn(), updateMany: jest.fn() },
  ...over,
});
const combo = { id: 9n, alcanceProductoId: null, nombre: 'Dúo Compartir', descripcion: '2 bebidas y 4 dulces', imagenArchivoId: 7n };

describe('anfitrión automático del combo', () => {
  it('sin anfitrión: lo crea en la categoría Combos con nombre, foto, precio mínimo y tamaños, y lo enlaza al combo', async () => {
    const tx = nuevoTx();
    const id = await sincronizarAnfitrionCombo(tx as any, combo, [
      { tamanoValorId: 1n, precio: 45 },
      { tamanoValorId: 2n, precio: 30 },
    ]);
    expect(id).toBe(900n);
    expect(tx.producto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ categoria_id: 50n, nombre: 'Dúo Compartir', descripcion: '2 bebidas y 4 dulces', foto_archivo_id: 7n }),
    });
    expect(Number(tx.producto.create.mock.calls[0][0].data.precio)).toBe(30);
    expect(tx.oferta.update).toHaveBeenCalledWith({ where: { id: 9n }, data: { producto: { connect: { id: 900n } } } });
    expect(tx.productoTamano.upsert).toHaveBeenCalledTimes(2);
    expect(tx.productoTamano.updateMany).toHaveBeenCalledWith({
      where: { producto_id: 900n, tamano_valor_id: { notIn: [1n, 2n] } },
      data: { activo: false },
    });
  });

  it('crea la categoría Combos solo si no existe', async () => {
    const tx = nuevoTx({ categoria: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 51n }) } });
    await sincronizarAnfitrionCombo(tx as any, combo, []);
    expect(tx.categoria.create).toHaveBeenCalledWith({ data: expect.objectContaining({ nombre: 'Combos', area_id: 1n }) });
    expect(tx.producto.create).toHaveBeenCalledWith({ data: expect.objectContaining({ categoria_id: 51n }) });
  });

  it('con anfitrión: solo actualiza lo que se pidió y no borra foto ni descripción si el combo no las trae', async () => {
    const tx = nuevoTx();
    await sincronizarAnfitrionCombo(tx as any, { ...combo, alcanceProductoId: 5n, descripcion: null, imagenArchivoId: null }, [{ tamanoValorId: 1n, precio: 40 }], {
      nombre: true,
      descripcion: true,
      foto: true,
    });
    const data = tx.producto.update.mock.calls[0][0].data;
    expect(data.nombre).toBe('Dúo Compartir');
    expect(data).not.toHaveProperty('descripcion');
    expect(data).not.toHaveProperty('foto_archivo');
    expect(tx.producto.create).not.toHaveBeenCalled();
  });

  it('con anfitrión y otro producto con ese nombre: no lo renombra', async () => {
    const tx = nuevoTx({ producto: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn().mockResolvedValue({ id: 77n }) } });
    await sincronizarAnfitrionCombo(tx as any, { ...combo, alcanceProductoId: 5n }, undefined, { nombre: true });
    expect(tx.producto.update).not.toHaveBeenCalled();
  });
});

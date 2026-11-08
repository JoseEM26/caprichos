import { resolverTamanoValorId } from './combo-tamanos';

describe('resolverTamanoValorId', () => {
  const tx = (valores: { id: bigint; nombre: string }[]) => {
    const t: any = {
      lista: { upsert: jest.fn().mockResolvedValue({ id: 9n }) },
      listaValor: {
        findFirst: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(where.nombre ? valores.find((v) => v.nombre.toLowerCase() === where.nombre.equals.toLowerCase()) ?? null : null),
        ),
        create: jest.fn().mockResolvedValue({ id: 77n }),
      },
    };
    return t;
  };

  it('con id real lo usa sin buscar por nombre', async () => {
    const t = tx([]);
    expect(await resolverTamanoValorId(t, { tamanoValorId: '3', tamanoNombre: 'Extra 20 oz' })).toBe(3n);
    expect(t.listaValor.findFirst).not.toHaveBeenCalled();
  });

  it('por nombre busca el valor exacto en la lista TAMANO; «Extra 20 oz» no cae en «Extra 21 oz»', async () => {
    const t = tx([{ id: 3n, nombre: 'Extra 21 oz' }, { id: 1n, nombre: 'Regular 12 oz' }]);
    expect(await resolverTamanoValorId(t, { tamanoNombre: 'regular 12 oz' })).toBe(1n);
    expect(await resolverTamanoValorId(t, { tamanoNombre: 'Extra 20 oz' })).toBe(77n);
    expect(t.listaValor.create).toHaveBeenCalledWith({ data: expect.objectContaining({ lista_id: 9n, nombre: 'Extra 20 oz' }) });
  });
});

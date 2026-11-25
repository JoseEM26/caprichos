jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { IaHerramientasService } from '../ia-herramientas.service';

/** «Mándame la foto de X»: la herramienta solo devuelve fotos que existen en la carta o en los combos. */
describe('IA herramienta fotoDe', () => {
  const carta = [
    {
      id: 'c1',
      nombre: 'Donas',
      productos: [
        {
          id: 'p1',
          nombre: 'Dona Glaseada',
          fotoUrl: '/archivos/dona.jpg',
          tamanos: [{ nombre: 'Docena', fotoUrl: '/archivos/docena.jpg' }],
          sabores: [{ nombre: 'Fresa', fotoUrl: '/archivos/fresa.jpg' }, { nombre: 'Limón', fotoUrl: null }],
          grupos: [],
        },
      ],
    },
  ];
  const combos = [
    {
      nombre: 'Cajita Caprikids',
      imagenUrl: '/archivos/cajita.jpg',
      combosPrecio: [],
      combosParte: [{ opcionesDetalle: [{ nombre: 'Sirena', fotoUrl: '/archivos/sirena.jpg' }, { nombre: 'Pelota' }] }],
    },
  ];
  const servicio = () =>
    new IaHerramientasService(
      {} as any,
      { obtenerCarta: jest.fn().mockResolvedValue(carta) } as any,
      { listarOfertas: jest.fn().mockResolvedValue(combos) } as any,
    );

  it('devuelve la foto de un producto, de un sabor y de un juguete de combo', async () => {
    const s = servicio();
    expect((await s.fotoDe('dona glaseada')).fotos).toEqual([{ nombre: 'Dona Glaseada', fotoUrl: '/archivos/dona.jpg' }, { nombre: 'Dona Glaseada Docena', fotoUrl: '/archivos/docena.jpg' }]);
    expect((await s.fotoDe('Fresa')).fotos).toEqual([{ nombre: 'Fresa', fotoUrl: '/archivos/fresa.jpg' }]);
    expect((await s.fotoDe('sirena')).fotos).toEqual([{ nombre: 'Sirena', fotoUrl: '/archivos/sirena.jpg' }]);
  });

  it('sin foto o sin coincidencia no inventa: dice que no hay', async () => {
    const s = servicio();
    for (const n of ['Limón', 'Pelota', 'unicornio', 'ab']) {
      const r = await s.fotoDe(n);
      expect(r.ok).toBe(false);
      expect(r.fotos).toBeUndefined();
    }
  });

  it('manda como máximo 6 fotos y la herramienta está declarada y ejecutable', async () => {
    const muchos = Array.from({ length: 9 }, (_, i) => ({ nombre: `Juguete ${i}`, fotoUrl: `/archivos/j${i}.jpg` }));
    const s = new IaHerramientasService({} as any, { obtenerCarta: jest.fn().mockResolvedValue([]) } as any, {
      listarOfertas: jest.fn().mockResolvedValue([{ nombre: 'Caja', combosPrecio: [], combosParte: [{ opcionesDetalle: muchos }] }]),
    } as any);
    expect((await s.fotoDe('juguete')).fotos).toHaveLength(6);
    expect(s.obtenerDefinicionesHerramientas().some((h) => h.function.name === 'fotoDe')).toBe(true);
    const r = await servicio().ejecutarHerramienta('fotoDe', { nombre: 'Fresa' }, {});
    expect(r.resultado.ok).toBe(true);
  });
});

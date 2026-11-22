import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';

const config = (categoriaNombre: string): any => ({
  productoId: '1', productoNombre: 'FROZEN STRAWBERRY', categoriaId: '9', categoriaNombre,
  precioBase: 14.5, opciones: [], grupoIndexActual: 0, cantidad: 1, noSumaBeneficios: false,
});
const flujoCantidad = (categoriaNombre: string): any => ({
  estado: 'PEDIDO_CANTIDAD',
  pedido: { estadoInterno: 'PEDIDO_CANTIDAD', items: [], itemEnConfiguracion: config(categoriaNombre) },
});
const paso = (flujo: any, e: any) => transicionarEstado(flujo, normalizarEntrada(e), {});

describe('nombres por envase en bebidas', () => {
  it('3 frappés piden 3 nombres y los guardan en la línea (sin pregunta de confirmación)', () => {
    let r = paso(flujoCantidad('FROZEN'), { buttonPayload: 'ped_cant_3' });
    expect(r.nuevoEstado).toBe('PEDIDO_NOMBRES_ENVASE');
    r = paso(r.nuevoFlujo, { texto: 'Ana', textoOriginal: 'Ana' });
    r = paso(r.nuevoFlujo, { texto: 'Luis', textoOriginal: 'Luis' });
    expect(r.nuevoEstado).toBe('PEDIDO_NOMBRES_ENVASE');
    r = paso(r.nuevoFlujo, { texto: 'Rosa', textoOriginal: 'Rosa' });
    // Lo escrito es la confirmación: sin «¿está correcto?»
    expect(r.nuevoEstado).toBe('PEDIDO_ACCION_CARRITO');
    expect(r.nuevoFlujo.pedido?.items[0].personas).toEqual(['Ana', 'Luis', 'Rosa']);
  });

  it('«Ana, Luis» (todos los nombres juntos) completa los envases de una vez', () => {
    let r = paso(flujoCantidad('FRAPPES'), { buttonPayload: 'ped_cant_2' });
    r = paso(r.nuevoFlujo, { texto: 'Ana, Luis', textoOriginal: 'Ana, Luis' });
    expect(r.nuevoEstado).toBe('PEDIDO_ACCION_CARRITO');
    expect(r.nuevoFlujo.pedido?.items[0].personas).toEqual(['Ana', 'Luis']);
  });

  it('con un solo envase y el nombre del cliente conocido no lo pregunta: usa su primer nombre', () => {
    const r = transicionarEstado(flujoCantidad('FROZEN'), normalizarEntrada({ buttonPayload: 'ped_cant_1' }), { nombreCliente: 'Ana Torres' });
    expect(r.nuevoEstado).toBe('PEDIDO_ACCION_CARRITO');
    expect(r.nuevoFlujo.pedido?.items[0].personas).toEqual(['Ana']);
  });

  it('con 2 envases ofrece «Todos: Ana» en un botón', () => {
    const r = transicionarEstado(flujoCantidad('FROZEN'), normalizarEntrada({ buttonPayload: 'ped_cant_2' }), { nombreCliente: 'Ana Torres' });
    expect(r.nuevoEstado).toBe('PEDIDO_NOMBRES_ENVASE');
    expect((r.acciones[0] as any).botones[0]).toMatchObject({ id: 'ped_nom_todos', titulo: 'Todos: Ana' });
    const t = transicionarEstado(r.nuevoFlujo, normalizarEntrada({ buttonPayload: 'ped_nom_todos' }), { nombreCliente: 'Ana Torres' });
    expect(t.nuevoFlujo.pedido?.items[0].personas).toEqual(['Ana', 'Ana']);
  });

  it('el nombre del vaso es obligatorio: un mensaje vacío o un botón no avanzan, vuelve a preguntar', () => {
    let r = paso(flujoCantidad('FROZEN'), { buttonPayload: 'ped_cant_2' });
    expect(r.nuevoEstado).toBe('PEDIDO_NOMBRES_ENVASE');
    for (const e of [{ texto: '', textoOriginal: '   ' }, { buttonPayload: 'ped_nom_si' }]) {
      r = paso(r.nuevoFlujo, e);
      expect(r.nuevoEstado).toBe('PEDIDO_NOMBRES_ENVASE');
      expect((r.acciones[0] as any).texto).toContain('escribe el nombre para el envase 1 de 2');
    }
    expect(r.nuevoFlujo.pedido?.itemEnConfiguracion?.nombresEnvase ?? []).toEqual([]);
  });

  it('un producto que no es bebida no pide nombres', () => {
    const r = paso(flujoCantidad('Hamburguesas'), { buttonPayload: 'ped_cant_2' });
    expect(r.nuevoEstado).toBe('PEDIDO_ACCION_CARRITO');
  });

  it('un combo con 2 bebidas pide un nombre por bebida y los guarda en orden', () => {
    const f = flujoCantidad('COMBOS');
    f.pedido.itemEnConfiguracion.opciones = [
      { id: '1', nombre: 'Frappe Moca', precioExtra: 0, grupoNombre: 'Bebida 1 · Bebida' },
      { id: '2', nombre: 'Café Latte', precioExtra: 0, grupoNombre: 'Bebida 2 · Bebida' },
    ];
    let r = paso(f, { buttonPayload: 'ped_cant_1' });
    expect(r.nuevoEstado).toBe('PEDIDO_NOMBRES_ENVASE');
    expect((r.acciones[0] as any).texto).toContain('Tu Frappe Moca: escribe el nombre para el envase 1 de 2');
    r = paso(r.nuevoFlujo, { texto: 'Ana', textoOriginal: 'Ana' });
    expect((r.acciones[0] as any).texto).toContain('Tu Café Latte: escribe el nombre para el envase 2 de 2');
    r = paso(r.nuevoFlujo, { texto: 'Luis', textoOriginal: 'Luis' });
    expect(r.nuevoFlujo.pedido?.items[0].personas).toEqual(['Ana', 'Luis']);
  });
});

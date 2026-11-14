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
  it('3 frappés piden 3 nombres, confirman con Sí/No y los guardan en la línea', () => {
    let r = paso(flujoCantidad('FROZEN'), { buttonPayload: 'ped_cant_3' });
    expect(r.nuevoEstado).toBe('PEDIDO_NOMBRES_ENVASE');
    r = paso(r.nuevoFlujo, { texto: 'Ana', textoOriginal: 'Ana' });
    r = paso(r.nuevoFlujo, { texto: 'Luis', textoOriginal: 'Luis' });
    expect(r.nuevoEstado).toBe('PEDIDO_NOMBRES_ENVASE');
    r = paso(r.nuevoFlujo, { texto: 'Rosa', textoOriginal: 'Rosa' });
    expect(r.nuevoEstado).toBe('PEDIDO_NOMBRES_CONFIRMAR');
    const textoConfirm = (r.acciones[0] as any).texto;
    expect(textoConfirm).toContain('1. Ana');
    expect(textoConfirm).toContain('3. Rosa');
    r = paso(r.nuevoFlujo, { buttonPayload: 'ped_nom_si' });
    expect(r.nuevoEstado).toBe('PEDIDO_ACCION_CARRITO');
    expect(r.nuevoFlujo.pedido?.items[0].personas).toEqual(['Ana', 'Luis', 'Rosa']);
  });

  it('No vuelve a pedir los nombres desde el primero', () => {
    let r = paso(flujoCantidad('FRAPPES'), { buttonPayload: 'ped_cant_2' });
    r = paso(r.nuevoFlujo, { texto: 'Ana, Luis', textoOriginal: 'Ana, Luis' });
    expect(r.nuevoEstado).toBe('PEDIDO_NOMBRES_CONFIRMAR');
    r = paso(r.nuevoFlujo, { buttonPayload: 'ped_nom_no' });
    expect(r.nuevoEstado).toBe('PEDIDO_NOMBRES_ENVASE');
    expect(r.nuevoFlujo.pedido?.itemEnConfiguracion?.nombresEnvase).toEqual([]);
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
    r = paso(r.nuevoFlujo, { buttonPayload: 'ped_nom_si' });
    expect(r.nuevoFlujo.pedido?.items[0].personas).toEqual(['Ana', 'Luis']);
  });
});

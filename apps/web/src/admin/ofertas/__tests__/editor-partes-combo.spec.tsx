import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { EditorPartesCombo, ResumenPartesCombo } from '../EditorPartesCombo';
import { ModalCombo } from '../ModalCombo';
import {
  CategoriaEditor, Parte, ProductoEditor, bloquesDe, errorDePartes, normalizarPartes, opcionesDeGrupo, partesParaGuardar, resumenParaCliente, retitular,
} from '../partesComboModelo';
import type { OfertaItem } from '../ofertasApi';

const categorias: CategoriaEditor[] = [
  { id: '2', nombre: 'Frappes' }, { id: '3', nombre: 'Iced' }, { id: '4', nombre: 'Frozen' }, { id: '5', nombre: 'Calientes' },
  { id: '8', nombre: 'Donas' }, { id: '9', nombre: 'Galletas' }, { id: '10', nombre: 'Postres' },
];
const galletas = Array.from({ length: 12 }, (_, i): ProductoEditor => ({ id: `${100 + i}`, nombre: `Galleta ${i + 1}`, categoriaId: '9', sabores: i === 0 ? [{ id: '31', nombre: 'Chispas' }] : [] }));
const productos: ProductoEditor[] = [
  { id: '40', nombre: 'Dona', categoriaId: '8', sabores: [{ id: '21', nombre: 'Oreo' }, { id: '22', nombre: 'Fresa' }, { id: '23', nombre: 'Manjar' }] },
  ...galletas,
  { id: '50', nombre: 'Carrot cake', categoriaId: '10' },
  { id: '51', nombre: 'Keke marmoleado', categoriaId: '10' },
  { id: '60', nombre: 'Frappe Oreo', categoriaId: '2', precio: 12 },
  { id: '61', nombre: 'Iced Latte', categoriaId: '3', precio: 10 },
];

function Contenedor({ inicial = [] as Parte[], alCambiar }: { inicial?: Parte[]; alCambiar?: (p: Parte[]) => void }) {
  const [partes, setPartes] = useState<Parte[]>(inicial);
  return (
    <EditorPartesCombo
      partes={partes}
      productos={productos}
      categorias={categorias}
      onCambiar={(p) => { setPartes(p); alCambiar?.(p); }}
    />
  );
}

const toque = (nombre: string | RegExp) => fireEvent.click(screen.getByRole('button', { name: nombre }));
const guardado = (partes: Parte[]) => partesParaGuardar(partes, categorias, productos);

describe('Editor de partes del combo: todo por toques', () => {
  it('arma el Dúo completo (2 bebidas + complemento con 3 opciones por plantillas) sin escribir nada', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    expect(screen.getByText('¿Qué lleva el combo?')).toBeInTheDocument();

    // Bebidas: tipo, categorías (varias) y listo; 2 por defecto
    toque('+ Agregar');
    toque('Agregar bebidas');
    for (const c of ['Frappes', 'Iced', 'Calientes']) toque(c);

    // Complemento: la primera opción ya viene como «2 de la misma categoría»; se elige Donas
    toque('+ Agregar');
    toque('Agregar complemento a elegir');
    fireEvent.click(within(screen.getByRole('group', { name: 'Categoría de la pieza' })).getByRole('button', { name: 'Donas' }));
    expect(screen.getByText('2 donas')).toBeInTheDocument();

    // «1 + 1 de dos categorías»: dona + galleta
    toque('1 + 1 de dos categorías');
    const cats = screen.getAllByRole('group', { name: 'Categoría de la pieza' });
    fireEvent.click(within(cats[0]).getByRole('button', { name: 'Donas' }));
    fireEvent.click(within(cats[1]).getByRole('button', { name: 'Galletas' }));
    expect(screen.getByText('1 dona + 1 galleta')).toBeInTheDocument();

    // «1 producto fijo»: carrot cake
    toque('1 producto fijo');
    toque('Carrot cake');
    expect(screen.getByText('1 carrot cake')).toBeInTheDocument();

    const g = guardado(ultimo);
    expect(g[0]).toMatchObject({ tipo: 'A_ELECCION', cantidad: 2, categorias: ['2', '3', '5'], paqueteGrupo: null, paqueteNombre: null });
    const comp = g.slice(1);
    expect(new Set(comp.map((p) => p.paqueteGrupo))).toEqual(new Set(['Complemento']));
    expect(comp.map((p) => [p.paqueteNombre, p.tipo, p.cantidad, p.categorias, p.productos])).toEqual([
      ['2 donas', 'A_ELECCION', 2, ['8'], []],
      ['1 dona + 1 galleta', 'A_ELECCION', 1, ['8'], []],
      ['1 dona + 1 galleta', 'A_ELECCION', 1, ['9'], []],
      ['1 carrot cake', 'FIJO', 1, [], ['50']],
    ]);
    // Cada parte lleva su nombre puesto solo y no hay campos del editor en lo que se envía
    expect(comp.every((p) => p.nombre && !('uid' in p) && !('pieza' in p))).toBe(true);
    expect(errorDePartes(ultimo, categorias)).toBeNull();
  });

  it('el título automático se puede cambiar con el lápiz y volver a automático', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar');
    toque('Agregar complemento a elegir');
    fireEvent.click(within(screen.getByRole('group', { name: 'Categoría de la pieza' })).getByRole('button', { name: 'Donas' }));
    toque('Cambiar el nombre de 2 donas');
    fireEvent.change(screen.getByLabelText('Nombre de la opción'), { target: { value: 'Dúo de donas' } });
    toque('Listo');
    expect(screen.getByText('Dúo de donas')).toBeInTheDocument();
    // Con nombre propio, cambiar la cantidad no lo pisa
    fireEvent.click(screen.getByRole('button', { name: 'Más: Cantidad de esta pieza' }));
    expect(guardado(ultimo)[0]).toMatchObject({ paqueteNombre: 'Dúo de donas', cantidad: 3 });
    toque('Cambiar el nombre de Dúo de donas');
    toque('Nombre automático');
    expect(screen.getByText('3 donas')).toBeInTheDocument();
  });

  it('sabores específicos: Todos o elegir específicos con chips que se apagan y encienden', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar');
    toque('Agregar complemento a elegir');
    fireEvent.click(within(screen.getByRole('group', { name: 'Categoría de la pieza' })).getByRole('button', { name: 'Donas' }));
    expect(guardado(ultimo)[0].saboresIds).toEqual([]);

    toque('Elegir específicos');
    toque(/Fresa/); // se apaga
    expect(guardado(ultimo)[0].saboresIds).toEqual(['21', '23']);
    toque(/Manjar/); // se apaga; queda solo Oreo
    expect(screen.getByRole('button', { name: /Oreo/ })).toBeDisabled(); // siempre queda uno
    toque(/Fresa/);
    expect(guardado(ultimo)[0].saboresIds).toEqual(['21', '22']);
    toque('Todos los sabores');
    expect(guardado(ultimo)[0].saboresIds).toEqual([]);
  });

  it('productos concretos: sin tope de 8, y con productos marcados la pieza guarda la categoría y solo esos', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar');
    toque('Agregar complemento a elegir');
    fireEvent.click(within(screen.getByRole('group', { name: 'Categoría de la pieza' })).getByRole('button', { name: 'Galletas' }));
    const lista = screen.getByRole('list', { name: 'Productos concretos' });
    expect(within(lista).getAllByRole('button')).toHaveLength(12);
    fireEvent.change(screen.getByLabelText('Buscar: Productos concretos'), { target: { value: 'galleta 12' } });
    toque('Galleta 12');
    const p = guardado(ultimo)[0];
    expect(p).toMatchObject({ categorias: ['9'], productos: ['111'], paqueteNombre: '2 galleta 12' });
  });

  it('quitar productos de las bebidas: los marcados se guardan como excluidos', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar');
    toque('Agregar bebidas');
    toque('Frappes');
    toque('Iced');
    const quitar = screen.getByRole('list', { name: 'Productos a quitar' });
    fireEvent.click(within(quitar).getByRole('button', { name: 'Iced Latte' }));
    expect(guardado(ultimo)[0]).toMatchObject({ categorias: ['2', '3'], productosExcluidos: ['61'], productos: [] });
  });

  it('avisa en palabras simples cuando falta algo y no deja un complemento con una sola opción', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar');
    toque('Agregar bebidas');
    expect(errorDePartes(ultimo, categorias)).toBe('A «Bebidas» le falta elegir al menos una categoría o un producto.');
    toque('Frappes');
    toque('+ Agregar');
    toque('Agregar complemento a elegir');
    expect(errorDePartes(ultimo, categorias)).toMatch(/hay una pieza sin completar/);
    fireEvent.click(within(screen.getByRole('group', { name: 'Categoría de la pieza' })).getByRole('button', { name: 'Donas' }));
    expect(errorDePartes(ultimo, categorias)).toMatch(/le falta al menos una opción más/);
  });

  it('dos opciones con el mismo título automático no se funden: la segunda lleva (2)', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar');
    toque('Agregar complemento a elegir');
    fireEvent.click(within(screen.getByRole('group', { name: 'Categoría de la pieza' })).getByRole('button', { name: 'Donas' }));
    toque('2 de la misma categoría');
    fireEvent.click(within(screen.getByRole('group', { name: 'Categoría de la pieza' })).getByRole('button', { name: 'Donas' }));
    expect(opcionesDeGrupo(ultimo, 'Complemento').map((o) => o.nombre)).toEqual(['2 donas', '2 donas (2)']);
  });
});

/** Los 8 complementos del Dúo tal como los devuelve el servidor (lista plana con paquete_grupo / paquete_nombre). */
const parteServidor = (id: string, tipo: string, cantidad: number, categorias: string[], productos: string[], paquete: string | null, extra: Record<string, unknown> = {}): Parte => ({
  id, tipo: tipo as Parte['tipo'], cantidad, categorias, productos, alternativas: [],
  paqueteGrupo: paquete ? 'Complemento' : null, paqueteNombre: paquete, ...extra,
});
const duoServidor: Parte[] = [
  parteServidor('1', 'A_ELECCION', 2, ['2', '3', '5'], [], null),
  parteServidor('2', 'A_ELECCION', 2, ['8'], [], '2 donas'),
  parteServidor('3', 'A_ELECCION', 2, [], ['100'], '2 galletas choco chips'),
  parteServidor('4', 'A_ELECCION', 1, ['8'], [], '1 dona + 1 galleta'),
  parteServidor('5', 'A_ELECCION', 1, [], ['100'], '1 dona + 1 galleta'),
  parteServidor('6', 'FIJO', 1, [], ['50'], '1 carrot cake', { disponible: false }),
  parteServidor('7', 'FIJO', 1, [], ['51'], '1 keke marmoleado'),
];

describe('Combos que ya existen', () => {
  it('el Dúo guardado se carga agrupado por opción, sin perder nada, y se vuelve a guardar igual', () => {
    const normales = normalizarPartes(duoServidor, categorias, productos);
    expect(bloquesDe(normales).map((b) => b.tipo)).toEqual(['ELECCION', 'COMPLEMENTO']);
    expect(opcionesDeGrupo(normales, 'Complemento').map((o) => [o.nombre, o.idxs.length])).toEqual([
      ['2 donas', 1], ['2 galletas choco chips', 1], ['1 dona + 1 galleta', 2], ['1 carrot cake', 1], ['1 keke marmoleado', 1],
    ]);
    render(<Contenedor inicial={normales} />);
    expect(screen.getByText('Elige 2 · Frappes, Iced, Calientes')).toBeInTheDocument();
    expect(screen.getByText('El cliente elige UNA de 5 opciones')).toBeInTheDocument();
    expect(screen.getByText('Hoy no hay stock')).toBeInTheDocument();
    const g = guardado(normales);
    expect(g.map((p) => [p.tipo, p.cantidad, p.categorias, p.productos, p.paqueteGrupo, p.paqueteNombre, p.saboresIds, p.productosExcluidos])).toEqual(
      duoServidor.map((p) => [p.tipo, p.cantidad, p.categorias, p.productos, p.paqueteGrupo ?? null, p.paqueteNombre ?? null, [], []]),
    );
    // Sin tocar nada, los nombres guardados de las opciones se respetan aunque no sean los automáticos
    expect(retitular(normales, categorias, productos).map((p) => p.paqueteNombre)).toEqual(normales.map((p) => p.paqueteNombre));
  });

  it('una categoría guardada por nombre se reconoce; tipos antiguos (UNA_DE) siguen como elección', () => {
    const [p] = normalizarPartes([{ tipo: 'UNA_DE', cantidad: 1, categorias: ['frappes'], productos: [] }], categorias, productos);
    expect(p.categorias).toEqual(['2']);
    expect(guardado([p])[0].tipo).toBe('A_ELECCION');
  });

  it('abrir el combo en el editor y guardarlo conserva el formato (ModalCombo)', async () => {
    let enviado: any = null;
    const combo = {
      id: '9', tipo: 'COMBO', nombre: 'Dúo compartir', descripcion: '', lleva: null, paga: null, alcanceCategoriaId: null, alcanceProductoId: null,
      descuentoTipo: null, descuentoValor: null, compraMinima: null, dias: [], horaDesde: null, horaHasta: null, fechaDesde: null, fechaHasta: null,
      canales: ['CARTA'], limiteUsos: null, usosActuales: 0, noSumaBeneficios: false, orden: 1, activo: true, creadoEn: '',
      combosPrecio: [{ tamanoNombre: 'Regular', precio: 30 }], combosParte: duoServidor,
    } as unknown as OfertaItem;
    render(<ModalCombo abierto comboAEditar={combo} onCerrar={() => {}} onGuardar={async (d) => { enviado = d; }} productosDisponibles={productos} categorias={categorias.map((c) => ({ ...c, productos: [] }))} />);
    fireEvent.click(screen.getByRole('tab', { name: /Partes y alternativas/ }));
    expect(screen.getByText('El cliente elige UNA de 5 opciones')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-guardar-combo'));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect(enviado.partes).toHaveLength(7);
    expect(enviado.partes[5]).toMatchObject({ tipo: 'FIJO', productos: ['50'], paqueteGrupo: 'Complemento', paqueteNombre: '1 carrot cake' });
    expect(enviado.combosPartes).toEqual(enviado.partes);
  });
});

describe('Resumen para el cliente', () => {
  it('dice en lenguaje claro lo que verá el cliente, con avisos de stock y sabores', () => {
    const normales = normalizarPartes(duoServidor, categorias, productos);
    normales[1] = { ...normales[1], saboresIds: ['21', '22'] };
    const lineas = resumenParaCliente(normales, categorias, productos);
    expect(lineas[0].titulo).toBe('Elige 2 bebidas (Frappes, Iced, Calientes)');
    expect(lineas[1].titulo).toBe('Elige tu complemento');
    expect(lineas[1].opciones.map((o) => o.texto)).toEqual([
      '2 donas (solo Oreo, Fresa)', '2 galletas choco chips (cualquier sabor)', '1 dona + 1 galleta (cualquier sabor)', '1 carrot cake', '1 keke marmoleado',
    ]);
    expect(lineas[1].opciones[3].avisos).toEqual(['Hoy no hay stock']);

    render(<ResumenPartesCombo partes={normales} productos={productos} categorias={categorias} />);
    expect(screen.getByText('Elige tu complemento')).toBeInTheDocument();
    expect(screen.getByText('Hoy no hay stock')).toBeInTheDocument();
  });

  it('avisa de una pieza que quedó vacía', () => {
    const vacia: Parte[] = [{ tipo: 'A_ELECCION', cantidad: 1, categorias: [], productos: [] }];
    expect(resumenParaCliente(vacia, categorias, productos)[0].avisos).toEqual(['Falta completar']);
  });
});

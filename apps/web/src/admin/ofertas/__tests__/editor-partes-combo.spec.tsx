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
const marcar = (nombre: string | RegExp, en: HTMLElement | null = null) => fireEvent.click((en ? within(en) : screen).getByRole('checkbox', { name: nombre }));
const guardado = (partes: Parte[]) => partesParaGuardar(partes, categorias, productos);
/** Las listas «Qué puede elegir» de lo que lleva la combinación abierta (una por cada cosa que lleva). */
const selectoresDe = (titulo: string | RegExp) => within(screen.getByRole('list', { name: titulo })).getAllByRole('list', { name: /Qué puede elegir/ });
const nueva = /Lo que lleva Combinación sin completar/;

describe('Editor de partes del combo: todo por toques', () => {
  it('arma el Dúo completo (2 bebidas + una combinación con 4 opciones por plantillas) sin escribir nada', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    expect(screen.getByText('¿Qué lleva el combo?')).toBeInTheDocument();

    // Bebidas: tipo, categorías completas (varias) y listo; 2 por defecto
    toque('+ Agregar');
    toque('El cliente elige entre varias cosas');
    for (const c of ['Frappes', 'Iced', 'Calientes']) marcar(`${c} — todos`);
    expect(screen.getByText('Elige 2: Frappes, Iced o Calientes')).toBeInTheDocument();

    // «El cliente elige UNA combinación»: la primera ya viene como «2 de lo mismo»; se elige Donas
    toque('+ Agregar');
    toque('El cliente elige UNA combinación');
    marcar('Donas — todos', selectoresDe(nueva)[0]);
    expect(screen.getByText('2 donas')).toBeInTheDocument();

    // «1 de cada una de 2 cosas»: dona + galleta
    toque('1 de cada una de 2 cosas');
    const [uno, dos] = selectoresDe(nueva);
    marcar('Donas — todos', uno);
    marcar('Galletas — todos', dos);
    expect(screen.getByText('1 dona + 1 galleta')).toBeInTheDocument();

    // «1 solo producto»: carrot cake
    toque('1 solo producto');
    marcar('Carrot cake', selectoresDe(nueva)[0]);
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

  it('«2 de donas o galleta» se arma en 4 toques y el título sale solo, legible', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar'); // 1
    toque('El cliente elige entre varias cosas'); // 2
    marcar('Dona'); // 3
    marcar('Galleta 1'); // 4
    expect(screen.getByText('Elige 2: Dona o Galleta 1')).toBeInTheDocument();
    expect(screen.getByText('Podrá elegir cualquiera de: Dona, Galleta 1')).toBeInTheDocument();
    expect(guardado(ultimo)[0]).toMatchObject({ tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: ['40', '100'] });
    expect(errorDePartes(ultimo, categorias)).toBeNull();
  });

  it('el título de la tarjeta se cambia con el lápiz (nunca es obligatorio) y vuelve a automático', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar');
    toque('El cliente elige entre varias cosas');
    marcar('Dona');
    toque('Cambiar el título de la tarjeta 1');
    fireEvent.change(screen.getByLabelText('Título de la tarjeta'), { target: { value: 'Dulce a elegir' } });
    toque('Listo');
    expect(screen.getByText('Dulce a elegir')).toBeInTheDocument();
    expect(guardado(ultimo)[0].nombre).toBe('Dulce a elegir');
    toque('Cambiar el título de la tarjeta 1');
    toque('Título automático');
    expect(screen.getByText('Elige 2: Dona')).toBeInTheDocument();
  });

  it('el título de una combinación se puede cambiar con el lápiz y volver a automático', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar');
    toque('El cliente elige UNA combinación');
    marcar('Donas — todos');
    toque('Cambiar el título de 2 donas');
    fireEvent.change(screen.getByLabelText('Título de la combinación'), { target: { value: 'Dúo de donas' } });
    toque('Listo');
    expect(screen.getByText('Dúo de donas')).toBeInTheDocument();
    // Con nombre propio, cambiar la cantidad no lo pisa
    fireEvent.click(screen.getByRole('button', { name: 'Más: Cantidad que lleva' }));
    expect(guardado(ultimo)[0]).toMatchObject({ paqueteNombre: 'Dúo de donas', cantidad: 3 });
    toque('Cambiar el título de Dúo de donas');
    toque('Título automático');
    expect(screen.getByText('3 donas')).toBeInTheDocument();
  });

  it('combinaciones: «Combinación 1», «Combinación 2», «+ Combinación» y «+ Añadir otra cosa a esta combinación»', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar');
    toque('El cliente elige UNA combinación');
    expect(screen.getByText('Combinación 1')).toBeInTheDocument();
    expect(screen.getByText(/Agrega al menos otra combinación/)).toBeInTheDocument();
    marcar('Donas — todos');
    toque('+ Combinación');
    expect(screen.getByText('Combinación 2')).toBeInTheDocument();
    marcar('Donas — todos', selectoresDe(nueva)[0]);
    // En la segunda: «+ Añadir otra cosa» para «1 dona + 1 galleta»
    toque('+ Añadir otra cosa a esta combinación');
    const [a, b] = selectoresDe(/Lo que lleva 1 dona/);
    marcar('Galletas — todos', b);
    expect(a).toBeTruthy();
    expect(opcionesDeGrupo(ultimo, 'Complemento').map((o) => o.nombre)).toEqual(['2 donas', '1 dona + 1 galleta']);
  });

  it('sabores específicos: casilla «Elegir sabores específicos» con chips que se apagan y encienden', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar');
    toque('El cliente elige UNA combinación');
    expect(screen.queryByRole('checkbox', { name: 'Elegir sabores específicos' })).toBeNull(); // sin producto con sabores aún
    marcar('Donas — todos');
    expect(guardado(ultimo)[0].saboresIds).toEqual([]);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Elegir sabores específicos' }));
    toque(/Fresa/); // se apaga
    expect(guardado(ultimo)[0].saboresIds).toEqual(['21', '23']);
    toque(/Manjar/); // se apaga; queda solo Oreo
    expect(screen.getByRole('button', { name: /Oreo/ })).toBeDisabled(); // siempre queda uno
    toque(/Fresa/);
    expect(guardado(ultimo)[0].saboresIds).toEqual(['21', '22']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Elegir sabores específicos' }));
    expect(guardado(ultimo)[0].saboresIds).toEqual([]);
  });

  it('productos sueltos: sin tope de 8, buscables, y una categoría completa no se mezcla con productos', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar');
    toque('El cliente elige entre varias cosas');
    const lista = screen.getByRole('list', { name: /Qué puede elegir/ });
    expect(within(lista).getAllByRole('checkbox').length).toBeGreaterThanOrEqual(12 + 7);
    marcar('Galletas — todos');
    expect(guardado(ultimo)[0]).toMatchObject({ categorias: ['9'], productos: [] });
    fireEvent.change(screen.getByLabelText(/Buscar categoría o producto/), { target: { value: 'galleta 12' } });
    marcar('Galleta 12');
    // Marcar un producto desmarca la categoría completa: valen solo los productos
    expect(guardado(ultimo)[0]).toMatchObject({ categorias: [], productos: ['111'], nombre: '2 galleta 12' });
    expect(screen.getByRole('button', { name: 'Quitar Galleta 12' })).toBeInTheDocument();
  });

  it('«Excluir alguno»: los productos marcados se guardan como excluidos', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar');
    toque('El cliente elige entre varias cosas');
    expect(screen.queryByText('Excluir alguno (ej. sin Frozen)')).toBeNull();
    marcar('Frappes — todos');
    marcar('Iced — todos');
    fireEvent.click(screen.getByText('Excluir alguno (ej. sin Frozen)'));
    const quitar = screen.getByRole('list', { name: 'Productos a excluir' });
    fireEvent.click(within(quitar).getByRole('button', { name: 'Iced Latte' }));
    expect(guardado(ultimo)[0]).toMatchObject({ categorias: ['2', '3'], productosExcluidos: ['61'], productos: [] });
  });

  it('el reemplazo si se agota queda escondido en «Más opciones» y no se confunde con elegir', () => {
    render(<Contenedor />);
    toque('+ Agregar');
    toque('El cliente elige entre varias cosas');
    const mas = screen.getByText(/Más opciones/).closest('details')!;
    expect(mas).not.toHaveAttribute('open');
    expect(within(mas).getByText('Reemplazo si se agota')).toBeInTheDocument();
    expect(within(mas).getByText(/Solo se ofrece cuando no queda stock de lo de arriba/)).toBeInTheDocument();
    expect(screen.queryByText(/Si no hay stock, el cliente podrá elegir/)).toBeNull();
  });

  it('avisa en palabras simples cuando falta algo y no deja una combinación con una sola opción', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar');
    toque('El cliente elige entre varias cosas');
    expect(errorDePartes(ultimo, categorias)).toBe('Te falta elegir qué puede escoger el cliente en la tarjeta 1.');
    marcar('Frappes — todos');
    toque('+ Agregar');
    toque('El cliente elige UNA combinación');
    expect(errorDePartes(ultimo, categorias)).toMatch(/Te falta elegir qué lleva la combinación .* en la tarjeta 2/);
    marcar('Donas — todos', selectoresDe(nueva)[0]);
    expect(errorDePartes(ultimo, categorias)).toBe('A la tarjeta 2 le falta al menos una combinación más, para que el cliente pueda elegir.');
  });

  it('con «mostrarErrores» marca en rojo la tarjeta incompleta, dice qué falta y lleva el foco ahí', () => {
    const vacia: Parte[] = normalizarPartes([{ tipo: 'A_ELECCION', cantidad: 2, categorias: ['2'], productos: [] }, { tipo: 'A_ELECCION', cantidad: 1, categorias: [], productos: [] }], categorias, productos);
    render(<EditorPartesCombo partes={vacia} productos={productos} categorias={categorias} onCambiar={() => {}} mostrarErrores />);
    expect(screen.getByTestId('bloque-0')).not.toHaveAttribute('data-incompleta');
    const roja = screen.getByTestId('bloque-1');
    expect(roja).toHaveAttribute('data-incompleta', 'true');
    expect(within(roja).getByRole('alert')).toHaveTextContent('Te falta elegir qué puede escoger el cliente en la tarjeta 2.');
    expect(within(roja).getByRole('button', { name: /Elige 1/ })).toHaveFocus();
  });

  it('«Ver ejemplo: Dúo Compartir» carga 2 bebidas + 2 de donas o galletas, editable', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('Ver ejemplo: Dúo Compartir');
    expect(screen.queryByText('Ver ejemplo: Dúo Compartir')).toBeNull();
    expect(guardado(ultimo).map((p) => [p.cantidad, p.categorias])).toEqual([[2, ['2', '3', '4', '5']], [2, ['8', '9']]]);
    expect(errorDePartes(ultimo, categorias)).toBeNull();
    expect(screen.getByText('Elige 2: Donas o Galletas')).toBeInTheDocument();
  });

  it('cada tarjeta tiene un «?» con una ayuda corta', () => {
    render(<Contenedor />);
    toque('+ Agregar');
    toque('Siempre incluido');
    toque(/Ayuda/);
    expect(screen.getByRole('note')).toHaveTextContent(/siempre viene incluido/);
  });

  it('dos combinaciones con el mismo título automático no se funden: la segunda lleva (2)', () => {
    let ultimo: Parte[] = [];
    render(<Contenedor alCambiar={(p) => (ultimo = p)} />);
    toque('+ Agregar');
    toque('El cliente elige UNA combinación');
    marcar('Donas — todos');
    toque('2 de lo mismo');
    marcar('Donas — todos', selectoresDe(nueva)[0]);
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
    expect(screen.getByText('Elige 2: Frappes, Iced o Calientes')).toBeInTheDocument();
    expect(screen.getByText('5 combinaciones para elegir')).toBeInTheDocument();
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
    expect(screen.getByText('5 combinaciones para elegir')).toBeInTheDocument();
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
    expect(lineas[1].titulo).toBe('Elige una combinación');
    expect(lineas[1].opciones.map((o) => o.texto)).toEqual([
      '2 donas (solo Oreo, Fresa)', '2 galletas choco chips (cualquier sabor)', '1 dona + 1 galleta (cualquier sabor)', '1 carrot cake', '1 keke marmoleado',
    ]);
    expect(lineas[1].opciones[3].avisos).toEqual(['Hoy no hay stock']);

    render(<ResumenPartesCombo partes={normales} productos={productos} categorias={categorias} />);
    expect(screen.getByText('1) Elige 2 bebidas (Frappes, Iced, Calientes)')).toBeInTheDocument();
    expect(screen.getByText('2) Elige una combinación')).toBeInTheDocument();
    expect(screen.getByText('Hoy no hay stock')).toBeInTheDocument();
  });

  it('elegir entre productos sueltos se dice en lenguaje claro, con «cualquier combinación»', () => {
    const p: Parte[] = [{ tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: ['40', '100'] }];
    expect(resumenParaCliente(p, categorias, productos)[0].titulo).toBe('Elige 2: dona o galleta 1 (cualquier combinación) · cualquier sabor');
  });

  it('avisa de una pieza que quedó vacía', () => {
    const vacia: Parte[] = [{ tipo: 'A_ELECCION', cantidad: 1, categorias: [], productos: [] }];
    expect(resumenParaCliente(vacia, categorias, productos)[0].avisos).toEqual(['Falta completar']);
  });
});

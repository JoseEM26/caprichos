import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { PanelPendientes, pendientesDe } from '../PanelPendientes';
import { pedido, salonEjemplo } from './datosEjemplo';

const PEND = [{ nombre: 'Bebidas', estado: 'PENDIENTE' as const }];

describe('Pedidos pendientes del salón en vivo', () => {
  it('solo pendientes: caja, cocina y listos; lo despachado (en reparto) no sale', () => {
    const d = salonEjemplo();
    d.caja = [pedido('CP-W905', { modalidad: 'LLEVAR', mesas: [], mesaIds: [], areas: PEND })];
    const l = pendientesDe(d);
    expect(l.map((p) => [p.codigo, p.etapa])).toEqual([
      ['CP-W903', 'LISTO'],
      ['CP-W902', 'COCINA'],
      ['CP-W901', 'COCINA'],
      ['CP-W905', 'CAJA'],
    ]);
    expect(l.find((p) => p.codigo === 'CP-W904')).toBeUndefined();
    expect(l[0].porcentaje).toBe(100);
    expect(l.find((p) => p.codigo === 'CP-W905')!.porcentaje).toBe(12);
    // en cocina con una de dos áreas lista: 25 + 55/2
    expect(l.find((p) => p.codigo === 'CP-W901')!.porcentaje).toBe(53);
  });

  it('un pedido que está en caja y en cocina sale una sola vez, en cocina', () => {
    const d = salonEjemplo();
    d.caja = [pedido('CP-W901', { areas: PEND })];
    d.cocina = [pedido('CP-W901', { areas: PEND })];
    d.despacho = [];
    expect(pendientesDe(d)).toHaveLength(1);
    expect(pendientesDe(d)[0].etapa).toBe('COCINA');
  });

  it('dibuja cada pedido con su barra de avance y su estado', () => {
    render(<PanelPendientes datos={salonEjemplo()} reloj="19:05" />);
    const barra = screen.getByRole('progressbar', { name: /CP-W903/ });
    expect(barra).toHaveAttribute('aria-valuenow', '100');
    const lista = screen.getByRole('list');
    expect(within(lista).getAllByText('En cocina')).toHaveLength(2);
    expect(within(lista).getByText('¡Listo!')).toBeTruthy();
    expect(screen.queryByText(/Meseros|En reparto|Últimos movimientos/)).toBeNull();
  });

  it('sin pendientes lo dice', () => {
    const d = salonEjemplo();
    d.caja = []; d.cocina = []; d.despacho = [];
    render(<PanelPendientes datos={d} reloj="19:05" />);
    expect(screen.getByText(/No hay pedidos pendientes/)).toBeTruthy();
  });

  it('muestra el retrato circular a la izquierda del código y cae a un círculo vacío si la imagen falla', () => {
    const d = salonEjemplo();
    d.despacho = [pedido('CP-W903', { estado: 'LISTO', avatar: { url: '/archivos/avatar-1.png', config: null } })];
    d.caja = []; d.cocina = [pedido('CP-W902')];
    const { container } = render(<PanelPendientes datos={d} reloj="19:05" />);
    const img = container.querySelector('img.sv-pend-retrato') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('src')).toBe('/archivos/avatar-1.png');
    expect(container.querySelectorAll('img.sv-pend-retrato')).toHaveLength(1);
    expect(img.nextElementSibling?.classList.contains('sv-pend-cod')).toBe(true);
    fireEvent.error(img);
    expect(container.querySelector('img.sv-pend-retrato')).toBeNull();
    expect(container.querySelector('.sv-pend-retrato.vacio')).toBeTruthy();
  });
});

describe('tarjeta: nombre grande y código chico', () => {
  it('con nombre, el nombre va primero y el código después; sin nombre, el código queda grande', () => {
    const d = salonEjemplo();
    d.caja = []; d.despacho = [];
    d.cocina = [pedido('CP-W902', { cliente: 'Lucía Fernández' }), pedido('CP-W901', { cliente: null })];
    const { container } = render(<PanelPendientes datos={d} reloj="19:05" />);
    const cods = container.querySelectorAll('.sv-pend-cod');
    const conNombre = Array.from(cods).find((c) => c.classList.contains('con-nombre'))!;
    expect(conNombre.children[0].textContent).toBe('Lucía Fernández');
    expect(conNombre.children[1].textContent).toBe('CP-W902');
    const sin = Array.from(cods).find((c) => !c.classList.contains('con-nombre'))!;
    expect(sin.textContent).toBe('CP-W901');
    expect(container.querySelectorAll('.con-nombre')).toHaveLength(1);
  });
});

describe('pedidos en la franja de la TV', () => {
  it('los pedidos de delivery no salen (ni en caja, ni en cocina, ni listos); los de para llevar sí', () => {
    const d = salonEjemplo();
    d.caja = [pedido('CP-W905', { modalidad: 'LLEVAR', mesas: [], mesaIds: [], areas: PEND }), pedido('CP-D1', { modalidad: 'DELIVERY', mesas: [], mesaIds: [], areas: PEND })];
    d.cocina = [...d.cocina, pedido('CP-D2', { modalidad: 'DELIVERY', mesas: [], mesaIds: [] })];
    d.despacho = [...d.despacho, pedido('CP-D3', { modalidad: 'DELIVERY', estado: 'LISTO', mesas: [], mesaIds: [] })];
    const codigos = pendientesDe(d).map((p) => p.codigo);
    expect(codigos).toContain('CP-W905');
    expect(codigos.filter((c) => c.startsWith('CP-D'))).toEqual([]);
  });
});

describe('franja de la TV: hora y carrusel', () => {
  const mucho = () => { const d = salonEjemplo(); d.cocina = Array.from({ length: 12 }, (_, i) => pedido(`CP-X${i}`, { id: `x${i}` })); return d; };
  const medidas = (scroll: number, cli: number) => {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => scroll });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => cli });
  };
  afterEach(() => { vi.useRealTimers(); delete (HTMLElement.prototype as any).scrollWidth; delete (HTMLElement.prototype as any).clientWidth; });

  it('solo queda la hora y el carrusel: sin el bloque «Pedidos en curso» ni los KPI', () => {
    render(<PanelPendientes datos={salonEjemplo()} reloj="19:05" tv />);
    expect(screen.getByText('19:05')).toBeTruthy();
    expect(screen.queryByText('Pedidos en curso')).toBeNull();
    expect(screen.queryByLabelText('Resumen')).toBeNull();
    expect(screen.getByRole('list')).toHaveAttribute('aria-live', 'polite');
  });

  it('si no caben todas, la lista se duplica (para que el bucle no salte) y la copia no la leen los lectores de pantalla', () => {
    medidas(4000, 900);
    const { container } = render(<PanelPendientes datos={mucho()} reloj="19:05" tv />);
    expect(container.querySelector('.sv-pista.anima')).toBeTruthy();
    const listas = container.querySelectorAll('ol.sv-pend-lista');
    expect(listas).toHaveLength(2);
    expect(listas[1]).toHaveAttribute('aria-hidden', 'true');
    expect(listas[1].children).toHaveLength(listas[0].children.length);
  });

  it('si todas entran, está quieta y sin copia', () => {
    medidas(500, 900);
    const { container } = render(<PanelPendientes datos={salonEjemplo()} reloj="19:05" tv />);
    expect(container.querySelector('.sv-pista.anima')).toBeNull();
    expect(container.querySelectorAll('ol.sv-pend-lista')).toHaveLength(1);
  });

  it('con movimiento reducido no hay animación: pasa de página cada 4 s y vuelve al inicio', () => {
    vi.useFakeTimers();
    medidas(4000, 900);
    const scrollTo = vi.fn(function (this: HTMLElement, o: ScrollToOptions) { (this as any).scrollLeft = o.left; });
    HTMLElement.prototype.scrollTo = scrollTo as any;
    const { container } = render(<PanelPendientes datos={mucho()} reloj="19:05" tv reducir />);
    expect(container.querySelector('.sv-pista.anima')).toBeNull();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 900, behavior: 'auto' });
    (container.querySelector('.sv-carrusel') as any).scrollLeft = 3100;
    act(() => { vi.advanceTimersByTime(4000); });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'auto' });
  });

  it('fuera de la TV (panel del admin) no hay carrusel: lista vertical con resumen', () => {
    medidas(4000, 900);
    const { container } = render(<PanelPendientes datos={mucho()} reloj="19:05" />);
    expect(container.querySelector('.sv-carrusel')).toBeNull();
    expect(screen.getByText('Pedidos en curso')).toBeTruthy();
  });
});

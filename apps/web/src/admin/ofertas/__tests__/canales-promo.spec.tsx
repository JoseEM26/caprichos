import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { canalesDesdeSelector, selectorDesdeCanales } from '../canalesPromo';
import { ModalDescuento } from '../ModalDescuento';

describe('canales de las promociones (selector + casilla WhatsApp)', () => {
  it('la casilla agrega BOT solo cuando está marcada', () => {
    expect(canalesDesdeSelector('todos', false)).toEqual(['CARTA', 'ADMIN']);
    expect(canalesDesdeSelector('todos', true)).toEqual(['CARTA', 'ADMIN', 'BOT']);
    expect(canalesDesdeSelector('carta', true)).toEqual(['CARTA', 'BOT']);
    expect(canalesDesdeSelector('local', false)).toEqual(['ADMIN']);
  });

  it('lee el estado real de una promo guardada, incluidos los datos viejos de «Solo WhatsApp»', () => {
    expect(selectorDesdeCanales(['CARTA', 'ADMIN'])).toEqual({ canal: 'todos', valeBot: false });
    expect(selectorDesdeCanales(['CARTA', 'ADMIN', 'BOT'])).toEqual({ canal: 'todos', valeBot: true });
    expect(selectorDesdeCanales(['CARTA'])).toEqual({ canal: 'carta', valeBot: false });
    expect(selectorDesdeCanales(['WHATSAPP'])).toEqual({ canal: 'solo-bot', valeBot: true });
    expect(selectorDesdeCanales(['TODOS'])).toEqual({ canal: 'todos', valeBot: false });
  });
});

const descuentoBase = {
  id: '5',
  tipo: 'DESCUENTO',
  nombre: '10% en toda la carta',
  descuentoTipo: 'PORCENTAJE',
  descuentoValor: 10,
  activo: true,
  dias: [],
  horaDesde: null,
  horaHasta: null,
  fechaDesde: null,
  fechaHasta: null,
  compraMinima: 0,
  orden: 0,
  canales: ['CARTA', 'ADMIN'],
} as any;

async function irAlPasoDeCanales(props: Record<string, unknown>) {
  render(<ModalDescuento abierto onCerrar={() => {}} onGuardar={vi.fn()} productosDisponibles={[]} categorias={[]} {...props} />);
  // El paso 1 exige el nombre (en alta no viene precargado)
  fireEvent.change(document.getElementById('desc-nombre')!, { target: { value: '10% de prueba' } });
  fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
  await waitFor(() => expect(document.getElementById('desc-canal-bot')).not.toBeNull());
  return document.getElementById('desc-canal-bot') as HTMLInputElement;
}

describe('ModalDescuento: casilla «Vale también por WhatsApp (bot)»', () => {
  it('en alta viene desmarcada', async () => {
    const casilla = await irAlPasoDeCanales({ descuentoAEditar: null });
    expect(casilla.checked).toBe(false);
  });

  it('al editar refleja el estado real: marcada si la promo incluye BOT', async () => {
    const casilla = await irAlPasoDeCanales({ descuentoAEditar: { ...descuentoBase, canales: ['CARTA', 'ADMIN', 'BOT'] } });
    expect(casilla.checked).toBe(true);
  });

  it('al editar una promo sin BOT la casilla queda desmarcada', async () => {
    const casilla = await irAlPasoDeCanales({ descuentoAEditar: descuentoBase });
    expect(casilla.checked).toBe(false);
  });
});

const llevaPagaBase = {
  id: '9',
  tipo: 'LLEVA_PAGA',
  nombre: '2x1 en Frappes',
  activo: true,
  lleva: 2,
  paga: 1,
  dias: [],
  fechaDesde: null,
  fechaHasta: null,
  horaDesde: null,
  horaHasta: null,
  productoNombre: 'Iced Coffee',
  orden: 0,
  canales: ['CARTA', 'ADMIN'],
} as any;

describe('ModalLlevaPaga: casilla «Vale también por WhatsApp (bot)»', () => {
  async function abrirCanales(oferta: unknown) {
    const { ModalLlevaPaga } = await import('../ModalLlevaPaga');
    render(<ModalLlevaPaga abierto ofertaAEditar={oferta as any} onCerrar={() => {}} onGuardar={vi.fn()} productosDisponibles={[]} categorias={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(document.getElementById('lp-canal-bot')).not.toBeNull());
    return document.getElementById('lp-canal-bot') as HTMLInputElement;
  }

  it('al editar refleja BOT: marcada con BOT, desmarcada sin BOT', async () => {
    expect((await abrirCanales({ ...llevaPagaBase, canales: ['CARTA', 'ADMIN', 'BOT'] })).checked).toBe(true);
  });

  it('una promo sin BOT queda desmarcada; un dato viejo «Solo WhatsApp» muestra la opción fija', async () => {
    expect((await abrirCanales(llevaPagaBase)).checked).toBe(false);
  });

  it('dato viejo «Solo WhatsApp»: casilla fija marcada y opción «Solo WhatsApp (dato anterior)»', async () => {
    const casilla = await abrirCanales({ ...llevaPagaBase, canales: ['WHATSAPP'] });
    expect(casilla.checked).toBe(true);
    expect(casilla.disabled).toBe(true);
    expect(screen.getByRole('option', { name: /Solo WhatsApp \(dato anterior\)/ })).toBeTruthy();
  });
});

const comboBase = {
  id: '4',
  tipo: 'COMBO',
  nombre: 'Dúo especial',
  activo: true,
  orden: 0,
  dias: [],
  fechaDesde: null,
  fechaHasta: null,
  horaDesde: null,
  horaHasta: null,
  combosPrecio: [{ tamanoValorId: '1', tamanoNombre: 'Regular', precio: 30 }],
  combosParte: [{ id: '1', tipo: 'A_ELECCION', cantidad: 2, categorias: ['2'], productos: [] }],
  canales: ['CARTA', 'ADMIN'],
} as any;

describe('ModalCombo: casilla «Vale también por WhatsApp (bot)»', () => {
  it('al editar un combo con BOT la casilla queda marcada; sin BOT, desmarcada', async () => {
    const { ModalCombo } = await import('../ModalCombo');
    const { unmount } = render(<ModalCombo abierto comboAEditar={{ ...comboBase, canales: ['CARTA', 'ADMIN', 'BOT'] }} onCerrar={() => {}} onGuardar={vi.fn()} productosDisponibles={[]} categorias={[]} />);
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(document.getElementById('canal-combo-bot')).not.toBeNull());
    expect((document.getElementById('canal-combo-bot') as HTMLInputElement).checked).toBe(true);
    unmount();

    render(<ModalCombo abierto comboAEditar={comboBase} onCerrar={() => {}} onGuardar={vi.fn()} productosDisponibles={[]} categorias={[]} />);
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(document.getElementById('canal-combo-bot')).not.toBeNull());
    expect((document.getElementById('canal-combo-bot') as HTMLInputElement).checked).toBe(false);
  });
});

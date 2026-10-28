import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DisenadorView } from '../DisenadorView';
import { api } from '../../../comun/api';

const disenadorMock = {
  tieneBorrador: false,
  organizacionActual: 'SECCIONES',
  decoracionActual: 'NINGUNO',
  contenidoActual: {},
  disposicionActual: undefined,
  categorias: [{ id: 'c1', nombre: 'BEBIDAS', orden: 1, oculto: false }],
  productos: [
    { id: 'pr1', categoriaId: 'c1', nombre: 'Frappe Fresa', descripcion: 'Fresa', precio: 15, orden: 1, oculto: false, fotoUrl: null },
  ],
};

async function abrirDisenador() {
  await waitFor(() => expect(screen.getByText('Abrir el diseñador en pantalla completa')).toBeTruthy());
  fireEvent.click(screen.getByText('Abrir el diseñador en pantalla completa'));
}

async function irAVistaPrevia() {
  fireEvent.click(screen.getByText('Vista previa carta'));
  await waitFor(() => expect(screen.getByRole('region', { name: 'Caprichos del mes' })).toBeTruthy());
}

describe('Diseñador: orden y tamaños de la carta', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue(disenadorMock);
    vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    vi.spyOn(api, 'post').mockResolvedValue({ ok: true });
  });

  it('la vista previa muestra la portada y la franja de datos reales de la carta', async () => {
    render(<MemoryRouter><DisenadorView /></MemoryRouter>);
    await abrirDisenador();
    await irAVistaPrevia();
    expect(screen.getByLabelText('Datos útiles')).toBeTruthy();
  });

  it('bajar el banner lo pone después de la franja en la vista previa y guarda el orden como borrador', async () => {
    render(<MemoryRouter><DisenadorView /></MemoryRouter>);
    await abrirDisenador();
    fireEvent.click(screen.getByLabelText('Bajar Caprichos del mes (banner)'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());

    await irAVistaPrevia();
    const banner = screen.getByRole('region', { name: 'Caprichos del mes' });
    const franja = screen.getByLabelText('Datos útiles');
    expect(banner.compareDocumentPosition(franja) & Node.DOCUMENT_POSITION_FOLLOWING).toBeFalsy();

    const cuerpo = (api.put as any).mock.calls.at(-1)[1];
    expect(cuerpo.contenido.disposicion.secciones[0].id).toBe('franja');
    expect(cuerpo.contenido.disposicion.secciones[1].id).toBe('mes');
  });

  it('ocultar la franja de datos la quita de la vista previa y se guarda', async () => {
    render(<MemoryRouter><DisenadorView /></MemoryRouter>);
    await abrirDisenador();
    fireEvent.click(screen.getByRole('checkbox', { name: /Franja de datos/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());

    await irAVistaPrevia();
    expect(screen.queryByLabelText('Datos útiles')).toBeNull();
    const cuerpo = (api.put as any).mock.calls.at(-1)[1];
    expect(cuerpo.contenido.disposicion.secciones.find((s: any) => s.id === 'franja').visible).toBe(false);
  });

  it('la vista previa es solo lectura: pedir desde el banner no envía nada', async () => {
    render(<MemoryRouter><DisenadorView /></MemoryRouter>);
    await abrirDisenador();
    await irAVistaPrevia();
    await waitFor(() => expect(screen.getByText('Pedir ahora')).toBeTruthy());
    fireEvent.click(screen.getByText('Pedir ahora'));
    expect(api.post).not.toHaveBeenCalled();
  });
});

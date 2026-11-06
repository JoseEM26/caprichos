import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EnlacesStockOpciones } from '../EnlacesStockOpciones';
import { catalogoApi } from '../catalogoApi';

const datos = {
  opcionId: '11',
  nombre: '2 Donas',
  requisitos: [{ productoId: '57', productoNombre: 'DONAS ARTESANALES', saborId: null, saborNombre: null, cantidad: 2 }],
  productos: [
    { id: '57', nombre: 'DONAS ARTESANALES', sabores: [{ id: '101', nombre: 'Chocolate' }] },
    { id: '58', nombre: 'GALLETA CHOCO CHIPS', sabores: [] },
  ],
};

describe('EnlacesStockOpciones (admin)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('carga el requisito actual y guarda el sabor y la cantidad elegidos', async () => {
    vi.spyOn(catalogoApi, 'requisitosOpcion').mockResolvedValue(datos as any);
    const guardar = vi.spyOn(catalogoApi, 'guardarRequisitosOpcion').mockResolvedValue(datos as any);
    render(<EnlacesStockOpciones opciones={[{ id: '11', nombre: 'Complemento 1 · 2 Donas' }]} />);

    await waitFor(() => expect((screen.getByLabelText('Cantidad del requisito 1') as HTMLInputElement).value).toBe('2'));
    fireEvent.change(screen.getByLabelText('Sabor del requisito 1'), { target: { value: '101' } });
    fireEvent.change(screen.getByLabelText('Cantidad del requisito 1'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar stock de la opción' }));

    await waitFor(() => expect(guardar).toHaveBeenCalledWith('11', [{ productoId: '57', saborId: '101', cantidad: 3 }]));
    expect(await screen.findByText('Enlace de stock guardado.')).toBeTruthy();
  });

  it('no muestra nada si no hay opciones', () => {
    const { container } = render(<EnlacesStockOpciones opciones={[]} />);
    expect(container.innerHTML).toBe('');
  });
});

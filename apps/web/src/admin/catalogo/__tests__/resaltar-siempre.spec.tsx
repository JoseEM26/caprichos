import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GrupoCard } from '../GruposPregunta';
import { catalogoApi } from '../catalogoApi';

const grupo: any = {
  id: '1', nombre: 'Leche', activo: true, obligatorio: false, minimo: 0, maximo: 1, productosCount: 3,
  opciones: [
    { id: '10', nombre: 'Entera', precioExtra: 0, activo: true, resaltarSiempre: false },
    { id: '11', nombre: 'Sin lactosa', precioExtra: 2, activo: true, resaltarSiempre: true },
  ],
};

describe('Opción «⭐ Resaltar siempre en cocina»', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('muestra el interruptor por opción con su estado y guarda solo lo que cambió', async () => {
    const editar = vi.spyOn(catalogoApi, 'editarOpcion').mockResolvedValue({} as any);
    vi.spyOn(catalogoApi, 'actualizarGrupo').mockResolvedValue({} as any);
    render(<GrupoCard g={grupo} enProducto onToggle={() => {}} puedeEditar alCambiar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const entera = await screen.findByLabelText('⭐ Resaltar siempre en cocina: Entera');
    const sinLactosa = screen.getByLabelText('⭐ Resaltar siempre en cocina: Sin lactosa');
    expect(entera).not.toBeChecked();
    expect(sinLactosa).toBeChecked();
    fireEvent.click(entera);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios del grupo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(editar).toHaveBeenCalledTimes(1));
    expect(editar).toHaveBeenCalledWith('10', expect.objectContaining({ resaltarSiempre: true }));
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConocenosView } from '../ConocenosView';
import { PaginaConocenos } from '../../../carta/PaginaConocenos';
import { CONOCENOS_DEFAULT } from '../../../carta/conocenosContenido';
import { api } from '../../../comun/api';

const respuesta = { contenido: CONOCENOS_DEFAULT, publicado: CONOCENOS_DEFAULT, tieneBorrador: false };

function montar() {
  return render(<MemoryRouter><ConocenosView /></MemoryRouter>);
}

describe('PaginaConocenos', () => {
  it('sin contenido muestra los textos de siempre', () => {
    render(<PaginaConocenos datosLocal={null} estadoLocal={null} />);
    expect(screen.getByText('CONÓCENOS')).toBeTruthy();
    expect(screen.getByText('Cafetería artesanal en San Juan de Lurigancho')).toBeTruthy();
    expect(screen.getByText('Dónde estamos')).toBeTruthy();
    expect(screen.getByText('Momentos Caprichos')).toBeTruthy();
  });

  it('con contenido usa los textos y oculta bloques', () => {
    const bloques = CONOCENOS_DEFAULT.bloques.map((b) => (b.id === 'donde' ? { ...b, visible: false } : b.id === 'horario' ? { ...b, titulo: 'Cuándo abrimos' } : b));
    render(<PaginaConocenos datosLocal={null} estadoLocal={null} contenido={{ titulo: 'Hola', parrafos: ['Uno', 'Dos'], bloques }} />);
    expect(screen.getByText('Hola')).toBeTruthy();
    expect(screen.getByText('Dos')).toBeTruthy();
    expect(screen.getByText('Cuándo abrimos')).toBeTruthy();
    expect(screen.queryByText('Dónde estamos')).toBeNull();
  });
});

describe('ConocenosView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => (url === '/admin/contenido/conocenos' ? respuesta : null) as any);
  });

  it('cambiar el título se ve en la vista previa', async () => {
    montar();
    const input = await screen.findByDisplayValue('Cafetería artesanal en San Juan de Lurigancho');
    fireEvent.change(input, { target: { value: 'Título nuevo' } });
    expect(screen.getByTestId('preview-conocenos-pc').textContent).toContain('Título nuevo');
  });

  it('ocultar un bloque lo quita de la vista previa', async () => {
    montar();
    await screen.findByText('Bloques');
    fireEvent.click(screen.getByText('Bloques'));
    expect(screen.getByTestId('preview-conocenos-pc').textContent).toContain('Dónde estamos');
    fireEvent.click(screen.getByLabelText(/Mostrar Dónde estamos/));
    expect(screen.getByTestId('preview-conocenos-pc').textContent).not.toContain('Dónde estamos');
  });

  it('publicar pide Sí/No y No no llama al servidor', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue(respuesta as any);
    const post = vi.spyOn(api, 'post').mockResolvedValue(respuesta as any);
    montar();
    fireEvent.click(await screen.findByText('Publicar'));
    fireEvent.click(screen.getByText('No'));
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Publicar'));
    fireEvent.click(screen.getByText('Sí, publicar'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/contenido/conocenos/publicar', {}));
    expect(put).toHaveBeenCalled();
  });

  it('restablecer guarda los textos originales como borrador tras el Sí', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue(respuesta as any);
    montar();
    const input = await screen.findByDisplayValue('Cafetería artesanal en San Juan de Lurigancho');
    fireEvent.change(input, { target: { value: 'Otro' } });
    fireEvent.click(screen.getByText('Restablecer a los textos originales'));
    fireEvent.click(screen.getByText('Sí, restablecer'));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/contenido/conocenos', CONOCENOS_DEFAULT));
    await waitFor(() => expect(screen.getByDisplayValue('Cafetería artesanal en San Juan de Lurigancho')).toBeTruthy());
  });
});

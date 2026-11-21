import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import { AnunciosView } from '../AnunciosView';
import type { AnuncioAdmin } from '../anunciosApi';

const fila = (o: Partial<AnuncioAdmin> = {}): AnuncioAdmin => ({
  id: '1', publico: 'CARTA', roles: [], plantilla: 'NOVEDAD', titulo: 'Promo de verano', texto: null, imagen_url: null, boton_texto: null,
  boton_enlace: null, detalle: null, color: 'CREMA', desde: null, hasta: null, franja_desde: null, franja_hasta: null, dias_semana: [],
  frecuencia: 'UNA_VEZ', veces_por_dia: 1, cada_horas: null, cierre_segundos: 8, puede_cerrar: true, prioridad: 0, activo: true,
  estado: 'AL_AIRE', estadisticas: { vistas: 5, cierres: 2, clics: 1, entendidos: 0 }, ...o,
});

const sesion = (permisos: string[]) =>
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { rol: 'ADMIN' }, tiene: (p: string) => permisos.includes(p) } as any);

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('AnunciosView', () => {
  it('lista con estado y números, y filtra por estado', async () => {
    sesion(['anuncios/ver']);
    vi.spyOn(api, 'get').mockResolvedValue([fila(), fila({ id: '2', titulo: 'Vieja', estado: 'VENCIDO', activo: true })]);
    render(<AnunciosView />);
    expect(await screen.findByText('Promo de verano')).toBeTruthy();
    expect(screen.getByText('Vieja')).toBeTruthy();
    expect(screen.getAllByText(/5 vistas · 2 cierres · 1 clics/)).toHaveLength(2);
    // sin permisos de escritura no hay botones de gestión
    expect(screen.queryByText('Nuevo anuncio')).toBeNull();
    expect(screen.queryByText('Eliminar')).toBeNull();
  });

  it('con permisos se puede crear, duplicar y apagar', async () => {
    sesion(['anuncios/ver', 'anuncios/crear', 'anuncios/editar', 'anuncios/eliminar']);
    vi.spyOn(api, 'get').mockResolvedValue([fila()]);
    const post = vi.spyOn(api, 'post').mockResolvedValue({});
    render(<AnunciosView />);
    await screen.findByText('Promo de verano');
    fireEvent.click(screen.getByText('Duplicar'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/anuncios/1/duplicar'));
    fireEvent.click(screen.getByLabelText('Activo'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/anuncios/1/activo', { activo: false }));
  });

  it('el editor tiene las cuatro pestañas y guarda con el cuerpo esperado', async () => {
    sesion(['anuncios/ver', 'anuncios/crear']);
    vi.spyOn(api, 'get').mockResolvedValue([]);
    const post = vi.spyOn(api, 'post').mockResolvedValue({});
    render(<AnunciosView />);
    fireEvent.click(await screen.findByText('Nuevo anuncio'));
    for (const t of ['Contenido', 'Público', 'Cuándo sale', 'Cierre']) expect(screen.getByRole('tab', { name: t })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Hola' } });
    // la vista previa en vivo refleja el título
    expect(screen.getByTestId('anuncio-previa-viva').textContent).toContain('Hola');
    fireEvent.click(screen.getByRole('tab', { name: 'Cuándo sale' }));
    fireEvent.click(screen.getByText('Solo hoy'));
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() => expect(post).toHaveBeenCalled());
    const [ruta, cuerpo] = post.mock.calls[0] as [string, any];
    expect(ruta).toBe('/admin/anuncios');
    expect(cuerpo).toMatchObject({ titulo: 'Hola', publico: 'CARTA', frecuencia: 'UNA_VEZ', puede_cerrar: true });
    expect(cuerpo.desde).toMatch(/Z$/);
    expect(cuerpo.hasta).toMatch(/T04:59:00\.000Z$/); // 23:59 Lima
  });

  it('no guarda sin título', async () => {
    sesion(['anuncios/ver', 'anuncios/crear']);
    vi.spyOn(api, 'get').mockResolvedValue([]);
    const post = vi.spyOn(api, 'post').mockResolvedValue({});
    render(<AnunciosView />);
    fireEvent.click(await screen.findByText('Nuevo anuncio'));
    fireEvent.click(screen.getByText('Guardar'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });
});

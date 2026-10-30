import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { FotosLocalSeccion } from '../FotosLocalSeccion';
import { CLAVE_FOTOS_NAVEGADOR, dataUrlABlob, migrarFotosDelNavegador } from '../fotosLocalApi';
import { clienteFetch } from '../../../comun/api';
import { subirImagenAlServidor } from '../../../comun/subidaImagen';

vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  clienteFetch: vi.fn(),
  ErrorApi: class extends Error {},
}));
vi.mock('../../../comun/subidaImagen', () => ({
  subirImagenAlServidor: vi.fn(),
}));

const DATA = 'data:image/jpeg;base64,/9j/4AAQ';
const fotoServidor = (slot: string, archivoId = '7') => ({
  slot,
  orden: 0,
  archivoId,
  url: `/archivos/publico/2026/10/${archivoId}.webp`,
});

describe('Fotos del local: servidor, migración y Quitar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(clienteFetch).mockImplementation(async (_ruta: string, opciones?: any) => {
      if (opciones?.method === 'PUT') return fotoServidor('Fachada', JSON.parse(opciones.body).archivoId);
      if (opciones?.method === 'DELETE') return { mensaje: 'ok' };
      return [];
    });
  });

  it('dice que se guardan en el servidor y se ven en Conócenos', async () => {
    render(<FotosLocalSeccion puedeEditar />);
    expect(await screen.findByText(/Se guardan en el servidor y se ven en Conócenos/)).toBeTruthy();
  });

  it('sube al servidor, muestra «Subiendo imagen…» y solo después «Foto guardada»', async () => {
    let resolverSubida!: (v: { id: string; url: string }) => void;
    vi.mocked(subirImagenAlServidor).mockImplementation(() => new Promise((r) => (resolverSubida = r)));
    render(<FotosLocalSeccion puedeEditar />);
    const input = await screen.findByLabelText('Subir foto de Fachada');

    fireEvent.change(input, { target: { files: [new File(['x'], 'fachada.jpg', { type: 'image/jpeg' })] } });
    expect(await screen.findByText('Subiendo imagen…')).toBeTruthy();
    expect(screen.queryByText('Foto guardada')).toBeNull();

    resolverSubida({ id: '55', url: '/archivos/publico/2026/10/55.webp' });
    expect(await screen.findByText('Foto guardada')).toBeTruthy();
    expect(clienteFetch).toHaveBeenCalledWith(
      '/admin/local/fotos/Fachada',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ archivoId: '55' }) }),
    );
  });

  it('si falla la subida muestra el error con Reintentar y no dice «Foto guardada»', async () => {
    vi.mocked(subirImagenAlServidor).mockRejectedValueOnce(new Error('Sin conexión'));
    render(<FotosLocalSeccion puedeEditar />);
    const input = await screen.findByLabelText('Subir foto de Terraza');

    fireEvent.change(input, { target: { files: [new File(['x'], 't.jpg', { type: 'image/jpeg' })] } });
    expect((await screen.findByRole('alert')).textContent).toMatch(/No se pudo subir la imagen/);
    expect(screen.queryByText('Foto guardada')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('Quitar pide confirmación Sí/No: No no quita, Sí desactiva en el servidor', async () => {
    vi.mocked(clienteFetch).mockImplementation(async (_ruta: string, opciones?: any) => {
      if (opciones?.method === 'DELETE') return { mensaje: 'ok' };
      return [fotoServidor('Fachada')];
    });
    render(<FotosLocalSeccion puedeEditar />);
    await screen.findByAltText('Fachada');

    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    const dialogo = await screen.findByText('¿Quitar esta foto de la galería?');
    const contenedor = dialogo.closest('div')!.parentElement!;
    fireEvent.click(within(contenedor).getByRole('button', { name: 'No' }));
    expect(clienteFetch).not.toHaveBeenCalledWith('/admin/local/fotos/Fachada', expect.objectContaining({ method: 'DELETE' }));
    expect(screen.getByAltText('Fachada')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, quitar' }));
    await waitFor(() =>
      expect(clienteFetch).toHaveBeenCalledWith('/admin/local/fotos/Fachada', expect.objectContaining({ method: 'DELETE' })),
    );
    await waitFor(() => expect(screen.queryByAltText('Fachada')).toBeNull());
  });
});

describe('migración de fotos guardadas solo en el navegador', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('convierte el base64 en Blob con su tipo', async () => {
    const blob = dataUrlABlob(DATA);
    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('sube las fotos que el servidor no tiene, avisa cuántas y limpia la clave', async () => {
    localStorage.setItem(CLAVE_FOTOS_NAVEGADOR, JSON.stringify({ Fachada: DATA, Terraza: DATA }));
    vi.mocked(subirImagenAlServidor).mockResolvedValue({ id: '90', url: '/archivos/publico/2026/10/90.webp' });
    vi.mocked(clienteFetch).mockResolvedValue(fotoServidor('Fachada', '90'));

    const res = await migrarFotosDelNavegador([fotoServidor('Fachada')]);

    expect(res).toEqual({ recuperadas: 1, fallidas: 0 });
    expect(subirImagenAlServidor).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(CLAVE_FOTOS_NAVEGADOR)).toBeNull();
  });

  it('si alguna falla conserva la clave para reintentar después', async () => {
    localStorage.setItem(CLAVE_FOTOS_NAVEGADOR, JSON.stringify({ Fachada: DATA, Terraza: DATA }));
    vi.mocked(subirImagenAlServidor)
      .mockResolvedValueOnce({ id: '91', url: '/archivos/publico/2026/10/91.webp' })
      .mockRejectedValueOnce(new Error('Sin conexión'));
    vi.mocked(clienteFetch).mockResolvedValue(fotoServidor('Fachada', '91'));

    const res = await migrarFotosDelNavegador([]);

    expect(res).toEqual({ recuperadas: 1, fallidas: 1 });
    expect(localStorage.getItem(CLAVE_FOTOS_NAVEGADOR)).not.toBeNull();
  });

  it('al abrir la pantalla avisa «Recuperamos N fotos que estaban solo en este navegador»', async () => {
    localStorage.setItem(CLAVE_FOTOS_NAVEGADOR, JSON.stringify({ Fachada: DATA, Terraza: DATA }));
    vi.mocked(clienteFetch).mockImplementation(async (_ruta: string, opciones?: any) => {
      if (opciones?.method === 'PUT') return fotoServidor('X');
      return [];
    });
    vi.mocked(subirImagenAlServidor).mockResolvedValue({ id: '92', url: '/archivos/publico/2026/10/92.webp' });

    render(<FotosLocalSeccion puedeEditar />);

    expect(await screen.findByText('Recuperamos 2 fotos que estaban solo en este navegador.')).toBeTruthy();
    await waitFor(() => expect(localStorage.getItem(CLAVE_FOTOS_NAVEGADOR)).toBeNull());
  });
});

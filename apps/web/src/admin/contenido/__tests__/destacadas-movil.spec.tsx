import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../comun/api';
import { DestacadasView } from '../DestacadasView';

if (typeof window.PointerEvent === 'undefined') {
  (window as any).PointerEvent = class extends MouseEvent {
    pointerType: string;
    constructor(tipo: string, init: any = {}) {
      super(tipo, init);
      this.pointerType = init.pointerType ?? 'touch';
    }
  };
}

const datos = [
  {
    id: 'd1', titulo: 'Clientes felices', portada_url: null, orden: 1, activo: true, archivada: false,
    fotos: [
      { id: 'i1', url: '/archivos/publico/seed/a.webp', pie: 'Tarde con amigos', orden: 1 },
      { id: 'i2', url: '/archivos/publico/seed/b.webp', pie: '', orden: 2 },
    ],
  },
];

async function montar() {
  vi.spyOn(api, 'get').mockResolvedValue(JSON.parse(JSON.stringify(datos)));
  const put = vi.spyOn(api, 'put').mockResolvedValue({});
  vi.spyOn(api, 'post').mockResolvedValue({});
  render(<DestacadasView />);
  await waitFor(() => expect(screen.getByText(/1 visibles en la carta/)).toBeTruthy());
  return put;
}

describe('Destacadas en celular: hojas de acciones', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.useRealTimers());

  it('la pulsación larga sobre un círculo abre la hoja y no lo trata como toque corto', async () => {
    const put = await montar();
    vi.useFakeTimers();
    const circulo = screen.getByRole('button', { name: /^Clientes felices/ });
    fireEvent.pointerDown(circulo, { clientX: 5, clientY: 5, pointerType: 'touch', button: 0 });
    act(() => { vi.advanceTimersByTime(800); });
    fireEvent.pointerUp(circulo);
    fireEvent.click(circulo);
    vi.useRealTimers();
    const hoja = screen.getByRole('dialog', { name: 'Opciones del círculo' });
    for (const t of ['Configurar', 'Cambiar portada|Subir portada', 'Activar|Desactivar', 'Duplicar', 'Archivar', 'Eliminar']) {
      expect(within(hoja).getAllByRole('button').some((b) => new RegExp(t).test(b.textContent || ''))).toBe(true);
    }
    expect(put).not.toHaveBeenCalled();
  });

  it('el botón «⋯ Más opciones» abre la misma hoja y Eliminar pide Sí/No', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: /Más opciones de Clientes felices/ }));
    const hoja = screen.getByRole('dialog', { name: 'Opciones del círculo' });
    fireEvent.click(within(hoja).getByText('Eliminar'));
    expect(screen.queryByRole('dialog', { name: 'Opciones del círculo' })).toBeNull();
    expect(screen.getByText(/¿Eliminar «Clientes felices» para siempre\?/)).toBeTruthy();
    fireEvent.click(screen.getByText('No, cancelar'));
    expect(screen.getByRole('button', { name: /^Clientes felices/ })).toBeTruthy();
    // ahora sí
    fireEvent.click(screen.getByRole('button', { name: /Más opciones de Clientes felices/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Opciones del círculo' })).getByText('Eliminar'));
    fireEvent.click(screen.getByText('Sí, continuar'));
    await waitFor(() => expect(screen.getByText('Eliminada.')).toBeTruthy());
  });

  it('editar el texto de una foto se hace en un modal, con la hoja de la foto', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: /^Clientes felices/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Más opciones de la imagen 2' }));
    const hoja = screen.getByRole('dialog', { name: 'Opciones de la imagen 2' });
    expect(within(hoja).getByText('Hacer portada')).toBeTruthy();
    expect(within(hoja).getByText('Reemplazar la foto')).toBeTruthy();
    expect((within(hoja).getByText('Mover a la derecha').closest('button') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(hoja).getByText('Editar el texto'));
    const campo = screen.getByRole('textbox', { name: 'Texto de la imagen 2' }) as HTMLInputElement;
    fireEvent.change(campo, { target: { value: 'Cumple de Ana' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(screen.getByText('Cumple de Ana')).toBeTruthy();
    expect(screen.getByText('Cambios sin publicar')).toBeTruthy();
  });

  it('la pulsación larga sobre una foto abre sus acciones', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: /^Clientes felices/ }));
    vi.useFakeTimers();
    const foto = screen.getByRole('button', { name: 'Ver la imagen 1' });
    fireEvent.pointerDown(foto, { clientX: 1, clientY: 1, pointerType: 'touch', button: 0 });
    act(() => { vi.advanceTimersByTime(800); });
    vi.useRealTimers();
    expect(screen.getByRole('dialog', { name: 'Opciones de la imagen 1' })).toBeTruthy();
  });
});

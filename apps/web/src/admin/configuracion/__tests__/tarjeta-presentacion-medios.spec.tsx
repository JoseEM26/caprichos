import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { api } from '../../../comun/api';
import { TarjetaPresentacionMediosPago } from '../TarjetaPresentacionMediosPago';

const nombresDeLaLista = () =>
  Array.from(document.querySelectorAll('[data-testid^="fila-medio-"]')).map((li) => li.querySelector('span')?.textContent ?? '');

describe('Cómo se muestran los medios de pago (Configuración)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('por defecto: Culqi al final, todos normales, sin insignia, y la vista previa lo refleja', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ canales: undefined });
    render(<TarjetaPresentacionMediosPago esAdmin />);
    await screen.findByTestId('tarjeta-presentacion-medios');
    expect(nombresDeLaLista()).toEqual(['1. Yape', '2. Plin', '3. Efectivo', '4. Tarjeta', '5. Transferencia', '6. Tarjeta / Yape en línea']);
    const previa = screen.getByTestId('vista-previa-medios');
    const botones = within(previa).getAllByRole('button', { hidden: true });
    expect(botones[5].textContent).toContain('Tarjeta / Yape en línea');
    expect(within(previa).queryByTestId('insignia-opcion')).toBeNull();
    expect(screen.getByRole('button', { name: 'Guardar presentación' })).toBeDisabled();
  });

  it('subir y bajar con los botones cambia el orden y la vista previa; el primero no sube ni el último baja', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ presentacion: undefined });
    render(<TarjetaPresentacionMediosPago esAdmin />);
    await screen.findByTestId('tarjeta-presentacion-medios');
    expect(screen.getByRole('button', { name: 'Subir Yape' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bajar Tarjeta / Yape en línea' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Subir Tarjeta / Yape en línea' }));
    expect(nombresDeLaLista()[4]).toBe('5. Tarjeta / Yape en línea');
    fireEvent.click(screen.getByRole('button', { name: 'Bajar Yape' }));
    expect(nombresDeLaLista().slice(0, 2)).toEqual(['1. Plin', '2. Yape']);
    const previa = within(screen.getByTestId('vista-previa-medios')).getAllByRole('button', { hidden: true });
    expect(previa[0].textContent).toContain('Plin');
    expect(screen.getByText('Tienes cambios sin guardar.')).toBeInTheDocument();
  });

  it('tamaño grande e insignia (sugerida y texto libre) se ven en la vista previa; guarda con confirmación Sí/No', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ presentacion: undefined });
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    render(<TarjetaPresentacionMediosPago esAdmin />);
    await screen.findByTestId('tarjeta-presentacion-medios');
    fireEvent.change(screen.getByLabelText('Tamaño de Yape'), { target: { value: 'grande' } });
    fireEvent.change(screen.getByLabelText('Insignia de Yape'), { target: { value: 'Nuevo' } });
    fireEvent.change(screen.getByLabelText('Insignia de Plin'), { target: { value: '__otro' } });
    fireEvent.change(screen.getByLabelText('Texto de la insignia de Plin'), { target: { value: 'Pruébalo' } });
    const previa = screen.getByTestId('vista-previa-medios');
    expect(within(previa).getAllByTestId('insignia-opcion').map((x) => x.textContent)).toEqual(['Nuevo', 'Pruébalo']);
    expect((within(previa).getAllByRole('button', { hidden: true })[0]).style.gridColumn).toBe('1 / -1');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar presentación' }));
    expect(put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    const [ruta, cuerpo] = put.mock.calls[0] as [string, { valor: any }];
    expect(ruta).toBe('/admin/configuracion/medios_pago_presentacion');
    expect(cuerpo.valor.YAPE).toEqual({ orden: 1, tamano: 'grande', insignia: 'Nuevo' });
    expect(cuerpo.valor.PLIN.insignia).toBe('Pruébalo');
    expect(cuerpo.valor.CULQI).toEqual({ orden: 6, tamano: 'normal', insignia: null });
  });

  it('«Restablecer valores» vuelve a Culqi al final, normal y sin insignia', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      presentacion: { CULQI: { orden: 1, tamano: 'grande', insignia: 'Nuevo' }, YAPE: { orden: 2, tamano: 'normal', insignia: null } },
    });
    render(<TarjetaPresentacionMediosPago esAdmin />);
    await screen.findByTestId('tarjeta-presentacion-medios');
    expect(nombresDeLaLista()[0]).toBe('1. Tarjeta / Yape en línea');
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer valores' }));
    expect(nombresDeLaLista()[5]).toBe('6. Tarjeta / Yape en línea');
    expect((screen.getByLabelText('Tamaño de Tarjeta / Yape en línea') as HTMLSelectElement).value).toBe('normal');
    expect(screen.getByRole('button', { name: 'Guardar presentación' })).not.toBeDisabled();
  });

  it('sin ser ADMIN todo queda bloqueado', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ presentacion: undefined });
    render(<TarjetaPresentacionMediosPago esAdmin={false} />);
    await screen.findByTestId('tarjeta-presentacion-medios');
    expect(screen.getByRole('button', { name: 'Bajar Yape' })).toBeDisabled();
    expect(screen.getByLabelText('Tamaño de Yape')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Guardar presentación' })).toBeNull();
  });
});

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const blob = vi.fn();
vi.mock('../../../comun/api', async (orig) => ({ ...(await orig<any>()), obtenerBlobAutenticado: (...a: any[]) => blob(...a) }));

import { ModalConPestanas } from '../../../comun/ModalConPestanas';
import { SelfieMarca } from '../SelfieMarca';

// IntersectionObserver controlable: la miniatura no pide nada hasta ser visible
let observadores: Array<(v: boolean) => void> = [];
class IO {
  cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) { this.cb = cb; observadores.push((v) => this.cb([{ isIntersecting: v } as IntersectionObserverEntry], this as any)); }
  observe() {} unobserve() {} disconnect() {}
}
beforeEach(() => { observadores = []; blob.mockReset(); vi.stubGlobal('IntersectionObserver', IO); });
afterEach(() => vi.unstubAllGlobals());

const err = (statusCode: number) => Object.assign(new Error('x'), { statusCode });

describe('SelfieMarca', () => {
  it('carga perezosa: no pide el blob hasta que entra en pantalla y lo pide por la ruta autenticada', async () => {
    blob.mockResolvedValue('blob:sintetico-1');
    render(<SelfieMarca marcaId={7} hora="09:00" tieneSelfie />);
    expect(blob).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: 'Cargando selfie' })).toBeInTheDocument();
    act(() => observadores.forEach((f) => f(true)));
    expect(await screen.findByRole('button', { name: 'Ver selfie de las 09:00' })).toBeInTheDocument();
    expect(blob).toHaveBeenCalledTimes(1);
    expect(blob).toHaveBeenCalledWith('/admin/asistencia/marcas/7/selfie');
  });

  it('el visor se abre dentro del modal con su título y Esc cierra solo el visor, no el modal', async () => {
    blob.mockResolvedValue('blob:sintetico-2');
    const cerrar = vi.fn();
    render(<ModalConPestanas titulo="Detalle" alCerrar={cerrar} pestanas={[{ id: 'a', etiqueta: 'Marcas', contenido: <SelfieMarca marcaId={8} hora="13:05" tieneSelfie /> }]} />);
    act(() => observadores.forEach((f) => f(true)));
    const dlg = screen.getByRole('dialog');
    fireEvent.click(await screen.findByRole('button', { name: 'Ver selfie de las 13:05' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1); // no es otro modal
    const visor = within(dlg).getByRole('region', { name: 'Selfie de las 13:05' });
    expect(within(visor).getByRole('heading', { name: 'Selfie de las 13:05' })).toBeInTheDocument();
    expect(within(visor).getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    fireEvent.keyDown(within(visor).getByRole('button', { name: 'Cerrar' }), { key: 'Escape' });
    expect(within(dlg).queryByRole('region', { name: 'Selfie de las 13:05' })).toBeNull();
    expect(cerrar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Ver selfie de las 13:05' })).toHaveFocus();
  });

  it('sin selfie muestra «Sin selfie» y no pide nada', () => {
    render(<SelfieMarca marcaId={9} hora="10:00" tieneSelfie={false} />);
    expect(screen.getByText('Sin selfie')).toBeInTheDocument();
    expect(blob).not.toHaveBeenCalled();
  });

  it('403: no muestra miniatura ni errores', async () => {
    blob.mockRejectedValue(err(403));
    const { container } = render(<SelfieMarca marcaId={10} hora="10:00" tieneSelfie />);
    act(() => observadores.forEach((f) => f(true)));
    await waitFor(() => expect(blob).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('404: avisa que la selfie ya se borró (con los días si se conocen)', async () => {
    blob.mockRejectedValue(err(404));
    render(<SelfieMarca marcaId={11} hora="10:00" tieneSelfie retencionDias={90} />);
    act(() => observadores.forEach((f) => f(true)));
    expect(await screen.findByText('La selfie ya se borró: se guardan 90 días.')).toBeInTheDocument();
  });

  it('otro error: ofrece Reintentar y vuelve a pedirla', async () => {
    blob.mockRejectedValueOnce(err(500)).mockResolvedValueOnce('blob:sintetico-3');
    render(<SelfieMarca marcaId={12} hora="10:00" tieneSelfie />);
    act(() => observadores.forEach((f) => f(true)));
    fireEvent.click(await screen.findByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByRole('button', { name: 'Ver selfie de las 10:00' })).toBeInTheDocument();
    expect(blob).toHaveBeenCalledTimes(2);
  });
});

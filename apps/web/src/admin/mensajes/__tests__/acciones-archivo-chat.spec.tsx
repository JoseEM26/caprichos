import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BurbujaMensaje } from '../BurbujaMensaje';

const obtenerBlob = vi.fn();
const get = vi.fn();
const post = vi.fn();
vi.mock('../../../comun/api', async (orig) => ({
  ...(await orig<any>()),
  obtenerBlobAutenticado: (r: string) => obtenerBlob(r),
  api: { get: (...a: any[]) => get(...a), post: (...a: any[]) => post(...a) },
}));

const foto = (extra: any = {}): any => ({
  id: '7', autor: 'CLIENTE', saliente: false, imagen: true, imagenId: '55', texto: 'pago', hora: '10:00', ...extra,
});
const ver = (m: any) => render(<BurbujaMensaje mensaje={m} onReintentar={vi.fn()} />);

describe('Archivos del cliente en el chat', () => {
  beforeEach(() => {
    obtenerBlob.mockReset().mockResolvedValue('blob:foto');
    get.mockReset();
    post.mockReset();
  });

  it('la foto sale en miniatura y se amplía en el visor de la misma página', async () => {
    ver(foto());
    const mini = await screen.findByAltText('Foto enviada por el cliente');
    expect(obtenerBlob).toHaveBeenCalledWith('/admin/archivos/55');
    fireEvent.click(mini.closest('button')!);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('Descargar baja la foto con la sesión', async () => {
    ver(foto());
    obtenerBlob.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    await waitFor(() => expect(obtenerBlob).toHaveBeenCalledWith('/admin/archivos/55'));
  });

  it('Asignar como voucher: elige un pedido del cliente y lo envía', async () => {
    get.mockResolvedValue([{ id: '9', codigo: 'P-9', total: 35, estado: 'NUEVO', pagoEstado: 'PENDIENTE', fecha: '2026-11-15T10:00:00Z' }]);
    post.mockResolvedValue({ ok: true, codigo: 'P-9' });
    ver(foto());
    fireEvent.click(screen.getByRole('button', { name: /Asignar como voucher del pedido/ }));
    fireEvent.click(await screen.findByRole('button', { name: /P-9/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/mensajes/mensajes/7/asignar-voucher', { pedidoId: '9' }));
    expect(await screen.findByText(/voucher del pedido P-9/)).toBeTruthy();
  });

  it('mensaje sin archivo guardado: «Recuperar archivo» lo pide de nuevo', async () => {
    post.mockResolvedValue({ ok: true });
    ver(foto({ imagenId: null, recuperable: true }));
    expect(screen.queryByRole('button', { name: 'Descargar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar archivo' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/mensajes/mensajes/7/recuperar-archivo', {}));
  });

  it('el documento muestra nombre y Descargar', () => {
    ver({ id: '8', autor: 'CLIENTE', saliente: false, imagen: false, texto: '', hora: '10:00', documento: { nombre: 'pago.pdf', bytes: 2048, mime: 'application/pdf', url: '/admin/mensajes/documentos/8' } });
    expect(screen.getByText('pago.pdf')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Descargar pago.pdf' })).toBeTruthy();
  });
});

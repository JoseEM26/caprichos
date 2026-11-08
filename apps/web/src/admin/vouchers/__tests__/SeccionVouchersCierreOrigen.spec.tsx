import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SeccionVouchersCierre, etiquetaCanal } from '../SeccionVouchersCierre';
import { vouchersApi } from '../vouchersApi';
import * as apiModulo from '../../../comun/api';
import type { VoucherPagoItem } from '../tipos';

const permisos = vi.hoisted(() => ({ lista: ['mensajes/ver', 'vouchers/ver', 'caja/ver'] as string[] }));
vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ tiene: (p: string) => permisos.lista.includes(p), usuario: { rol: 'CAJERO' } }),
}));

const base = {
  archivoId: 'a',
  semaforo: 'CONFIABLE' as const,
  motivos: [],
  revisadoEn: null,
  creadoEn: '2026-10-27T19:52:00Z', // 14:52 Lima
};
const conPedido: VoucherPagoItem = {
  ...base,
  id: 'v1',
  origen: 'WHATSAPP',
  medio: 'YAPE',
  pedidoId: '95',
  pedidoCodigo: 'CP-W095',
  pedidoTotal: '31.75',
  clienteNombre: 'Gerardo',
  clienteTelefono: '987654321',
  conversacionId: '7',
};
const huerfano: VoucherPagoItem = {
  ...base,
  id: 'v2',
  origen: 'WHATSAPP',
  pedidoId: null,
  conversacionId: '8',
  clienteTelefono: '912345678',
};

function montar(lista: VoucherPagoItem[]) {
  vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue(lista);
  vi.spyOn(apiModulo, 'obtenerBlobAutenticado').mockResolvedValue('blob:x');
  render(<SeccionVouchersCierre fecha="2026-10-27" />);
}

describe('SeccionVouchersCierre: origen del voucher', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    permisos.lista = ['mensajes/ver', 'vouchers/ver', 'caja/ver'];
  });

  it('muestra pedido, cliente, total y enlace a Caja', async () => {
    montar([conPedido]);
    const linea = await screen.findByTestId('origen-pedido-v1');
    expect(linea.textContent).toContain('Pedido CP-W095');
    expect(linea.textContent).toContain('Gerardo');
    expect(linea.textContent).toContain('Total S/ 31.75');
    expect(linea.querySelector('strong')?.textContent).toBe('CP-W095');
    const enlace = screen.getByRole('link', { name: 'Abrir pedido CP-W095' });
    expect(enlace.getAttribute('href')).toBe('/admin/caja?pedido=95');
  });

  it('botón Ver chat con el teléfono del cliente', async () => {
    montar([conPedido]);
    const chat = await screen.findByRole('link', { name: /Ver chat de WhatsApp de Gerardo/ });
    expect(chat.getAttribute('href')).toBe('/admin/mensajes?telefono=987654321');
  });

  it('sin permiso mensajes/ver no muestra Ver chat', async () => {
    permisos.lista = ['vouchers/ver'];
    montar([conPedido]);
    await screen.findByTestId('origen-pedido-v1');
    expect(screen.queryByText(/Ver chat/)).toBeNull();
  });

  it('voucher huérfano: Sin pedido asignado, Ver chat y Asignar a un pedido', async () => {
    montar([huerfano]);
    expect(await screen.findByTestId('sin-pedido-v2')).toBeDefined();
    expect(screen.getByRole('link', { name: /Ver chat/ }).getAttribute('href')).toBe('/admin/mensajes?telefono=912345678');
    expect(screen.queryByText('Abrir pedido')).toBeNull();
  });

  it('etiqueta el canal de llegada', () => {
    expect(etiquetaCanal({ ...base, id: '1', origen: 'WHATSAPP' })).toBe('Llegó por WhatsApp 14:52');
    expect(etiquetaCanal({ ...base, id: '1', origen: 'CARTA' })).toBe('Subido en la carta 14:52');
    expect(etiquetaCanal({ ...base, id: '1', origen: 'MOZO', subidoPorNombre: 'Juan M.' })).toBe('Subido por Juan M. 14:52');
    expect(etiquetaCanal({ ...base, id: '1', origen: 'CAJA', subidoPorNombre: 'Ana P.' })).toBe('Subido en Caja por Ana P. 14:52');
  });

  it('pago dividido: agrupa los vouchers del mismo pedido', async () => {
    montar([conPedido, { ...conPedido, id: 'v3', origen: 'CARTA', medio: 'PLIN' }, huerfano]);
    const grupo = await screen.findByTestId('grupo-pedido-95');
    expect(grupo.textContent).toContain('CP-W095 · 2 vouchers');
    expect(screen.getByTestId('voucher-item-v1')).toBeDefined();
    expect(screen.getByTestId('voucher-item-v3')).toBeDefined();
  });

  it('filtro Sin pedido asignado y búsqueda por código o nombre', async () => {
    montar([conPedido, huerfano, { ...conPedido, id: 'v4', pedidoId: '96', pedidoCodigo: 'CP-W096', clienteNombre: 'Lucía' }]);
    await screen.findByTestId('voucher-item-v1');
    fireEvent.click(screen.getByRole('button', { name: /Sin pedido asignado \(1\)/ }));
    expect(screen.queryByTestId('voucher-item-v1')).toBeNull();
    expect(screen.getByTestId('voucher-item-v2')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Todos \(3\)/ }));
    fireEvent.change(screen.getByLabelText(/Buscar voucher/), { target: { value: 'lucía' } });
    await waitFor(() => expect(screen.queryByTestId('voucher-item-v1')).toBeNull());
    expect(screen.getByTestId('voucher-item-v4')).toBeDefined();
    fireEvent.change(screen.getByLabelText(/Buscar voucher/), { target: { value: 'w095' } });
    await waitFor(() => expect(screen.getByTestId('voucher-item-v1')).toBeDefined());
    // el contador de pendientes no cambia con el filtro
    expect(screen.getByTestId('contador-pendientes-vouchers').textContent).toContain('3 vouchers');
  });
});

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelDatosPago } from '../PanelDatosPago';
import * as apiModulo from '../../../comun/api';

const sesionMock = vi.hoisted(() => ({ permisos: ['mensajes/enviar'] as string[] }));
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ tiene: (p: string) => sesionMock.permisos.includes(p), usuario: { rol: 'MOZO' } }),
}));

const local = { mediosPago: { transferencia: { activo: true, banco: 'BCP', titular: 'Ana Prueba', cuenta: '191-00000000-0-00', cci: '002-191-000000000000-00' } } };
const TEXTO = 'Hola Lucía 💛 pedido C-007\nS/ 35.00\n• CCI: 002-191-000000000000-00';

const conEnvio = (envio: unknown) =>
  vi.spyOn(apiModulo.api, 'get').mockImplementation((async (ruta: string) => (ruta === '/carta/local' ? local : envio)) as any);

describe('Datos de pago en Caja y mozo', () => {
  beforeEach(() => {
    sesionMock.permisos = ['mensajes/enviar'];
  });
  afterEach(() => vi.restoreAllMocks());

  it('muestra banco, titular, cuenta y CCI con Copiar, y el botón abre Mensajes con el texto ya escrito', async () => {
    conEnvio({ telefono: '912345678', texto: TEXTO, medio: 'TRANSFERENCIA' });
    const escribir = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: escribir } });
    render(<PanelDatosPago pedidoId="7" medio="TRANSFERENCIA" />);
    await screen.findByText('002-191-000000000000-00');
    expect(screen.getByText('BCP')).toBeTruthy();
    expect(screen.getByText('Ana Prueba')).toBeTruthy();
    expect(screen.getByText('191-00000000-0-00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar CCI' }));
    await waitFor(() => expect(escribir).toHaveBeenCalledWith('002-191-000000000000-00'));
    const enlace = await screen.findByRole('link', { name: 'Enviar datos de pago por WhatsApp' });
    const href = enlace.getAttribute('href')!;
    expect(href.startsWith('/admin/mensajes?telefono=912345678&texto=')).toBe(true);
    expect(decodeURIComponent(href.split('texto=')[1])).toBe(TEXTO);
  });

  it('sin celular en el pedido explica qué falta', async () => {
    conEnvio({ telefono: null, texto: TEXTO, medio: 'TRANSFERENCIA' });
    render(<PanelDatosPago pedidoId="7" medio="TRANSFERENCIA" />);
    expect(await screen.findByText(/Falta el celular del cliente/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Enviar datos de pago/ })).toBeNull();
  });

  it('sin permiso mensajes/enviar no hay botón (los datos con Copiar sí)', async () => {
    sesionMock.permisos = [];
    const get = conEnvio(null);
    render(<PanelDatosPago pedidoId="7" medio="TRANSFERENCIA" />);
    await screen.findByText('002-191-000000000000-00');
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining('datos-pago-pedido'));
    expect(screen.queryByRole('link', { name: /Enviar datos de pago/ })).toBeNull();
  });
});

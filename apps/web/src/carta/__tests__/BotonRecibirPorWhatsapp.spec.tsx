import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BotonRecibirPorWhatsapp } from '../BotonRecibirPorWhatsapp';

const get = vi.fn();
vi.mock('../../comun/api', () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

describe('Botón «Recibir mi pedido por WhatsApp»', () => {
  beforeEach(() => get.mockReset());

  it('si el bot no puede escribir primero: enlace wa.me con «Hola, mi pedido CP-XXXX»', async () => {
    get.mockImplementation(async (url?: string) => (String(url ?? '').includes('/whatsapp') ? { requiereBoton: true, clave: '7K4Q2' } : { whatsapp: '987654321' }));
    render(<BotonRecibirPorWhatsapp codigo="CP-0123" token="t" />);
    const a = await screen.findByTestId('recibir-por-whatsapp');
    expect(a).toHaveAttribute('href', 'https://wa.me/51987654321?text=Hola%2C%20mi%20pedido%20CP-0123%20(clave%207K4Q2)');
    expect(a).toHaveTextContent('Recibir mi pedido por WhatsApp');
  });

  it('si el resumen le llega directo: no hay botón', async () => {
    get.mockResolvedValue({ requiereBoton: false });
    render(<BotonRecibirPorWhatsapp codigo="CP-0123" token="t" />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.queryByTestId('recibir-por-whatsapp')).toBeNull();
  });
});

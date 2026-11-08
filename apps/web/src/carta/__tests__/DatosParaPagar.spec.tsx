import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdjuntarCapturaPago } from '../AdjuntarCapturaPago';

const local = {
  whatsapp: '987654321',
  mediosPago: { yape: { activo: true, numero: '977503006', titular: 'Maria Perez' } },
};

describe('AdjuntarCapturaPago: a quién yapear', () => {
  const original = globalThis.fetch;
  afterEach(() => { globalThis.fetch = original; });

  it('muestra número, titular, monto, copia el número y enlaza a WhatsApp con el pedido', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(local), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ) as unknown as typeof fetch;
    const escribir = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: escribir } });

    render(<AdjuntarCapturaPago codigo="CP-W040" token="t" pagoDigital medio="YAPE" total={27} />);

    expect(await screen.findByText('977503006')).toBeDefined();
    expect(screen.getByText('Maria Perez')).toBeDefined();
    expect(screen.getByText('S/ 27.00')).toBeDefined();
    fireEvent.click(screen.getByText('Copiar número'));
    await waitFor(() => expect(escribir).toHaveBeenCalledWith('977503006'));
    const enlace = screen.getByText('Enviar captura por WhatsApp') as HTMLAnchorElement;
    expect(enlace.href).toContain('https://wa.me/51987654321?text=');
    expect(decodeURIComponent(enlace.href)).toContain('mi pedido CP-W040');
  });
});

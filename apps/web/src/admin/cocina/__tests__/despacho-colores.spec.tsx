import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DespachoView, MODALIDAD, FONDO_TARJETA, FONDO_TARJETA_DESPACHADO } from '../DespachoView';
import { TONO } from '../ResumenPagoDespacho';
import * as cocinaApi from '../cocinaApi';

vi.mock('../audioAlerta', () => ({ reproducirCampanaCocina: vi.fn(), estaSilenciado: vi.fn().mockReturnValue(false), setSilenciado: vi.fn() }));

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const NAVY = '#0B2C3E';

describe('contraste WCAG AA en Despacho', () => {
  it.each(Object.entries(MODALIDAD))('insignia %s', (_k, m) => expect(contraste(m.color, m.fondo)).toBeGreaterThanOrEqual(4.5));
  it.each(Object.entries(TONO))('pago %s: insignia y caja', (_k, t) => {
    expect(contraste(t.color, t.fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(NAVY, t.caja)).toBeGreaterThanOrEqual(4.5);
  });
  it('código y nombre (navy) sobre la tarjeta y la tarjeta despachada', () => {
    expect(contraste(NAVY, FONDO_TARJETA)).toBeGreaterThanOrEqual(7);
    expect(contraste(NAVY, FONDO_TARJETA_DESPACHADO)).toBeGreaterThanOrEqual(7);
  });
  it('textos secundarios, estados y vuelto', () => {
    for (const [fg, bg] of [['#2C4C5D', FONDO_TARJETA], ['#2C4C5D', '#E3D6C6'], [NAVY, '#E67929'], [NAVY, '#D9CBB5'], ['#FFFFFF', '#2F7A45'], [NAVY, '#FFE08A'], [NAVY, '#F3E9DB'], ['#1F5C32', '#EAF6EC'], ['#B2500F', FONDO_TARJETA], ['#8A3D0B', FONDO_TARJETA]])
      expect(contraste(fg, bg), `${fg} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
});

describe('tarjeta de Despacho', () => {
  it('nombre largo: clamp a 2 líneas, title completo, texto navy fijo y código oscuro', async () => {
    const largo = 'María Fernanda de los Ángeles Rodríguez-Villanueva y Santa Cruz de la Vega Montalbán';
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue({
      pedidos: [{ pedidoId: '9', codigo: 'CP-W095', modalidad: 'DELIVERY', cliente: largo, mesa: null, nota: null, creado_en: new Date().toISOString(), minutos: 3, direccion: null, referencia: null, telefono: null, areas: [], completo: false, estado: 'PREPARANDO', despachado: false } as any],
      umbrales: undefined,
    } as any);
    render(<DespachoView />);
    const nombre = await waitFor(() => screen.getByTestId('nombre-9'));
    expect(nombre.getAttribute('title')).toBe(largo);
    expect(nombre.getAttribute('style')).toMatch(/line-clamp:\s*2/);
    expect(nombre.style.overflow).toBe('hidden');
    expect(nombre.style.color).toBe('rgb(11, 44, 62)');
    expect(screen.getByTestId('codigo-9').style.color).toBe('rgb(11, 44, 62)');
    expect(screen.getByTestId('pedido-despacho-9').style.color).toBe('rgb(11, 44, 62)');
  });
});

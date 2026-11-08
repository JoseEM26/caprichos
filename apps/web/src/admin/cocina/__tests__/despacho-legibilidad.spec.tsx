import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { DespachoView, FONDO_TARJETA, OXIDO, SUAVE, AVISO_FONDO } from '../DespachoView';
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
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

describe('legibilidad de las líneas de Despacho', () => {
  it('pares texto/fondo ≥ 4.5:1', () => {
    for (const [fg, bg] of [[NAVY, FONDO_TARJETA], [OXIDO, FONDO_TARJETA], [SUAVE, FONDO_TARJETA], [NAVY, AVISO_FONDO]])
      expect(contraste(fg, bg), `${fg} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it('cada texto lleva color explícito (no hereda el claro del contenedor oscuro)', async () => {
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue({
      pedidos: [{
        pedidoId: '7', codigo: 'CP-W100', modalidad: 'DELIVERY', cliente: 'Lourdes leon', mesa: null, nota: null, creado_en: new Date().toISOString(), minutos: 3, direccion: null, referencia: null, telefono: null,
        areas: [{ areaId: 'b', areaNombre: 'Bebidas', listo: false, despachada: false, lineas: [{ id: 1, cantidad: 2, nombre: 'Frappe Chocolúcuma', tamano: 'Extra 21 oz', opciones: [], personas: ['Royer'], nota: 'sin hielo' }] }],
        completo: false, estado: 'PREPARANDO', despachado: false,
      } as any],
      umbrales: undefined,
    } as any);
    const { container } = render(<div style={{ color: '#FBF4EC', background: '#14405A' }}><DespachoView /></div>);
    const area = await waitFor(() => screen.getByTestId('area-7-b'));
    const titulo = within(area).getByText('Bebidas');
    expect(titulo.style.color).toBe(rgb(NAVY));
    expect(Number(titulo.style.fontWeight)).toBe(900);
    expect(within(area).getByTestId('linea-cantidad').style.color).toBe(rgb(OXIDO));
    expect(within(area).getByTestId('linea-nombre').style.color).toBe(rgb(NAVY));
    expect(within(area).getByTestId('linea-detalle').style.color).toBe(rgb(SUAVE));
    const nota = within(area).getByTestId('linea-nota');
    expect(nota.style.color).toBe(rgb(NAVY));
    expect(nota.style.background).toBe(rgb(AVISO_FONDO));
    expect(within(area).getByTestId('linea-despacho').style.fontVariantNumeric).toBe('tabular-nums');
    expect(container.querySelector('[style*="opacity"]')).toBeNull();
  });
});

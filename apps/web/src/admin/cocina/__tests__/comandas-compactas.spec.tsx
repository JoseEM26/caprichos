import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComandaTarjeta } from '../ComandaTarjeta';
import { RejillaComandas } from '../RejillaComandas';
import { ordenarComandasPorHoraLlegada } from '../CocinaAdminView';
import type { Comanda } from '../cocinaTipos';

const mk = (id: string, n: number, over: Partial<Comanda> = {}): Comanda => ({
  id,
  pedidoId: id,
  areaId: '1',
  areaNombre: 'Barra',
  ticket: `CP-${id}`,
  codigo: `CP-${id}`,
  canal: 'WEB',
  modalidad: 'RECOGER',
  minutos: 5,
  color: 'VERDE',
  creado_en: new Date().toISOString(),
  lineas: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, nombre: `Producto ${id}-${i}`, cantidad: 1, opciones: [], personas: [], nota: null })),
  despejada: false,
  ...over,
});

describe('Comandas compactas', () => {
  it('la tarjeta no fija alto ni proporción y muestra todas sus líneas (1 vs 8)', () => {
    render(
      <>
        <ComandaTarjeta comanda={mk('1', 1)} onDespejar={() => {}} />
        <ComandaTarjeta comanda={mk('2', 8, { nota: 'Sin hielo', extraDe: 'CP-9' })} onDespejar={() => {}} />
      </>,
    );
    for (let i = 0; i < 8; i++) expect(screen.getByText(`Producto 2-${i}`)).toBeInTheDocument();
    expect(screen.getByText('Producto 1-0')).toBeInTheDocument();
    expect(screen.getByTestId('comanda-nota')).toHaveTextContent('Sin hielo');
    expect(screen.getByTestId('comanda-extra')).toHaveTextContent('EXTRA de CP-9');
    for (const id of ['comanda-CP-1', 'comanda-CP-2']) {
      const t = screen.getByTestId(id);
      expect(t.style.minHeight).toBe('');
      expect(t.style.height).toBe('');
      expect(t.style.aspectRatio).toBe('');
    }
  });

  it('la rejilla empaqueta en columnas (sin grid de filas iguales) y conserva el orden FIFO', () => {
    const lista = ordenarComandasPorHoraLlegada([
      mk('3', 1, { creado_en: '2026-01-01T10:20:00Z' }),
      mk('1', 2, { creado_en: '2026-01-01T10:00:00Z' }),
      mk('2', 1, { creado_en: '2026-01-01T10:10:00Z' }),
    ]);
    render(
      <RejillaComandas>
        {lista.map((c) => (
          <ComandaTarjeta key={c.id} comanda={c} onDespejar={() => {}} />
        ))}
      </RejillaComandas>,
    );
    const r = screen.getByTestId('rejilla-comandas');
    expect(r.style.columnWidth).toBeTruthy();
    expect(r.style.display).not.toBe('grid');
    const orden = [...r.querySelectorAll('[data-testid^="comanda-CP-"]')].map((e) => e.getAttribute('data-testid'));
    expect(orden).toEqual(['comanda-CP-1', 'comanda-CP-2', 'comanda-CP-3']);
  });
});

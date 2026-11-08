import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistorialAuditoria, InsigniaCortesia, agruparEventos, EVENTOS_VISIBLES } from '../HistorialAuditoria';
import type { EventoPedido } from '../pedidosApi';

const ev = (id: string, tipo: EventoPedido['tipo'], titulo: string, en: string, por: string | null, detalle: string | null = null): EventoPedido => ({
  id, tipo, titulo, detalle, en, por,
});

describe('insignia de cortesía por línea', () => {
  it('muestra solo «🎁 Cortesía» y el ⓘ revela quién, cuándo y por qué al tocar', () => {
    render(
      <InsigniaCortesia
        cortesia={{ valor_lista: 12, dada_por: 'Ana Pérez', creado_en: '2026-11-08T19:32:00.000Z', motivo_etiqueta: 'Error de cocina', nota: 'se quemó' }}
      />,
    );
    expect(screen.getByTestId('insignia-cortesia').textContent).toContain('Cortesía');
    expect(screen.queryByText(/Dada por/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /quién dio la cortesía/i }));
    expect(screen.getByText(/Dada por Ana Pérez/)).toBeTruthy();
    expect(screen.getByText(/Error de cocina \(se quemó\)/)).toBeTruthy();
    expect(screen.getByText(/S\/ 12\.00/)).toBeTruthy();
  });
});

describe('agrupar eventos', () => {
  it('junta las cortesías de la misma persona y minuto sin perder el detalle de cada una', () => {
    const g = agruparEventos([
      ev('c1', 'cortesia', 'Cortesía: 1× Frappe', '2026-11-08T19:32:05.000Z', 'Ana', 'Prueba'),
      ev('c2', 'cortesia', 'Cortesía: 1× Waffle', '2026-11-08T19:32:40.000Z', 'Ana', 'Cumpleaños'),
      ev('c3', 'cortesia', 'Cortesía: 1× Té', '2026-11-08T19:40:00.000Z', 'Ana', 'Prueba'),
      ev('c4', 'cortesia', 'Cortesía: 1× Té', '2026-11-08T19:40:10.000Z', 'Luis', 'Prueba'),
    ]);
    expect(g).toHaveLength(3);
    expect(g[0].cantidad).toBe(2);
    expect(g[0].items.map((i) => i.detalle)).toEqual(['Prueba', 'Cumpleaños']);
  });
});

describe('sección «Historial y auditoría»', () => {
  const eventos = [
    ev('e1', 'estado', 'Estado: COLA', '2026-11-08T19:00:00.000Z', 'Ana'),
    ev('e2', 'cortesia', 'Cortesía: 1× Frappe', '2026-11-08T19:32:05.000Z', 'Ana', 'Prueba'),
    ev('e3', 'cortesia', 'Cortesía: 1× Waffle', '2026-11-08T19:32:40.000Z', 'Ana', 'Cumpleaños'),
    ev('e4', 'edicion', 'Pedido editado', '2026-11-08T19:50:00.000Z', 'Luis'),
    ev('e5', 'cobro', 'Cobro registrado', '2026-11-08T20:00:00.000Z', 'Luis'),
    ev('e6', 'anulacion', 'Comprobante anulado', '2026-11-08T20:05:00.000Z', 'Luis'),
    ev('e7', 'estado', 'Estado: ENTREGADO', '2026-11-08T20:10:00.000Z', 'Luis'),
  ];

  it('viene cerrada, se abre con un toque y agrupa las cortesías en una línea', () => {
    render(<HistorialAuditoria eventos={eventos} />);
    expect(screen.queryByText('Pedido editado')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Historial y auditoría/ }));
    expect(screen.getByText(/Cortesía · 2 productos/)).toBeTruthy();
    expect(screen.getByText('Pedido editado')).toBeTruthy();
  });

  it('«Ver todo» muestra el resto de los eventos', () => {
    render(<HistorialAuditoria eventos={eventos} />);
    fireEvent.click(screen.getByRole('button', { name: /Historial y auditoría/ }));
    expect(EVENTOS_VISIBLES).toBe(5);
    expect(screen.queryByText('Estado: ENTREGADO')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Ver todo/ }));
    expect(screen.getByText('Estado: ENTREGADO')).toBeTruthy();
  });

  it('sin eventos no ocupa lugar', () => {
    const { container } = render(<HistorialAuditoria eventos={[]} />);
    expect(container.innerHTML).toBe('');
  });
});

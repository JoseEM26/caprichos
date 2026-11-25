import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { api } from '../../../comun/api';
import { RepartoPropinas } from '../RepartoPropinas';

const vista = {
  anio: 2026,
  mes: 10,
  mesTerminado: true,
  reparto: null,
  previa: {
    totalPropinas: 150,
    totalHoras: 120,
    filas: [
      { partyId: 1, nombre: 'Luis', horas: 24, porcentaje: 20, monto: 30 },
      { partyId: 2, nombre: 'Ana', horas: 40, porcentaje: 33.33, monto: 50 },
      { partyId: 3, nombre: 'Rosa', horas: 56, porcentaje: 46.67, monto: 70 },
    ],
    excluidos: [{ partyId: 9, nombre: 'Jefe', motivo: 'ADMIN', participa: null }],
    avisos: ['3 jornadas de Luis están INCOMPLETO'],
    error: null,
    firma: 'x',
  },
};

describe('Reparto del mes (admin)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra la vista previa por persona, los avisos y el ADMIN fuera del reparto', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (/\/admin\/propinas\/reparto\/\d+\/\d+$/.test(url)) return vista as any;
      if (url === '/admin/propinas/reparto/historial') return [] as any;
      throw new Error(`ruta inesperada ${url}`);
    });
    render(<RepartoPropinas />);

    expect(await screen.findByText('S/ 150.00')).toBeInTheDocument();
    expect(screen.getByText('Luis')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('3 jornadas de Luis están INCOMPLETO')).toBeInTheDocument();
    expect(screen.getByText(/Jefe \(ADMIN\)/)).toBeInTheDocument();
    expect(screen.getByText(/período abierto al 25\/11\/2026/)).toBeInTheDocument();
  });

  it('no hay botones del reparto mensual antiguo: calcular, aprobar, anular ni exportar CSV', async () => {
    const borrador = {
      ...vista,
      reparto: {
        id: 5, estado: 'BORRADOR', totalPropinas: 150, totalHoras: 120, calculadoEn: '2026-11-02T10:00:00Z', aprobadoEn: null, pagadoEn: null,
        filas: [{ partyId: 1, nombre: 'Luis', horas: 120, porcentaje: 100, monto: 150, pagadoEn: null, pagadoMedio: null }],
      },
    };
    const post = vi.spyOn(api, 'post');
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (/\/admin\/propinas\/reparto\/\d+\/\d+$/.test(url)) return borrador as any;
      return [{ id: 5, anio: 2026, mes: 10, estado: 'BORRADOR', totalPropinas: 150, totalHoras: 120, pagadoEn: null, motivoAnulacion: null }] as any;
    });
    render(<RepartoPropinas />);
    await screen.findByText('S/ 150.00');
    for (const n of [/Calcular|Recalcular/, /Aprobar/, /^Anular$/, /Exportar CSV/]) expect(screen.queryByRole('button', { name: n })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('region', { name: 'Historial de repartos' })).toHaveTextContent('Borrador · S/ 150.00');
    expect(post).not.toHaveBeenCalled();
  });
});

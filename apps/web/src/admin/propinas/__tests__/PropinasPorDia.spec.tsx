import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { api } from '../../../comun/api';
import { PropinasPorDia } from '../PropinasPorDia';
import { RepartoPropinas } from '../RepartoPropinas';

const vista = {
  anio: 2026,
  mes: 11,
  sinRepartir: 7,
  dias: [
    {
      fecha: '2026-11-02',
      total: 10,
      sinRepartir: false,
      personas: [
        { partyId: 1, nombre: 'Ana', horas: 8, porcentaje: 66.67, monto: 6.67, pagadoPlanilla: 6.67, periodo: { desde: '2026-11-02', hasta: '2026-11-08' }, pagadoReparto: false },
        { partyId: 2, nombre: 'Luis', horas: 4, porcentaje: 33.33, monto: 3.33, pagadoPlanilla: 0, periodo: null, pagadoReparto: false },
        { partyId: 3, nombre: 'Rosa', horas: 4, porcentaje: 0, monto: 0, pagadoPlanilla: 0, periodo: null, pagadoReparto: true },
      ],
    },
    { fecha: '2026-11-03', total: 7, sinRepartir: true, personas: [] },
  ],
};

describe('Propinas por día (solo para ver)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('muestra por día y persona lo que le tocó, si se pagó en planilla (con el período) y lo sin repartir', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(vista as any);
    render(<PropinasPorDia anio={2026} mes={11} />);
    expect(await screen.findByTestId('sin-repartir')).toHaveTextContent('Sin repartir: S/ 7.00');
    expect(screen.getByText('Pagado en planilla 02/11 al 08/11')).toBeInTheDocument();
    expect(screen.getByText('Pendiente de planilla')).toBeInTheDocument();
    expect(screen.getByText('Pagado (reparto mensual)')).toBeInTheDocument();
    expect(screen.getByText(/03\/11/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pagar/i })).toBeNull();
  });

  it('la pantalla de Propinas ya no tiene botones de pago aparte', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/dias/')) return vista as any;
      if (/\/admin\/propinas\/reparto\/\d+\/\d+$/.test(url)) {
        return {
          anio: 2026, mes: 10, mesTerminado: true,
          reparto: { id: 1, estado: 'APROBADO', totalPropinas: 150, totalHoras: 120, calculadoEn: '2026-11-02T10:00:00Z', aprobadoEn: '2026-11-03T10:00:00Z', pagadoEn: null, filas: [{ partyId: 1, nombre: 'Luis', horas: 120, porcentaje: 100, monto: 150, pagadoEn: null, pagadoMedio: null }] },
          previa: { totalPropinas: 150, totalHoras: 120, filas: [], excluidos: [], avisos: [], error: null },
        } as any;
      }
      return [] as any;
    });
    render(<RepartoPropinas />);
    await screen.findByText('S/ 150.00');
    expect(screen.queryByRole('button', { name: /^Pagar$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Marcar todo pagado/ })).toBeNull();
  });
});

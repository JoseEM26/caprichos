import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import { RepartoPropinas, csvDeReparto } from '../RepartoPropinas';

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
    expect(screen.getByRole('button', { name: 'Calcular reparto' })).toBeEnabled();
  });

  it('calcular pide confirmación y luego llama al servidor', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (/\/admin\/propinas\/reparto\/\d+\/\d+$/.test(url)) return vista as any;
      return [] as any;
    });
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ok: true } as any);
    render(<RepartoPropinas />);

    fireEvent.click(await screen.findByRole('button', { name: 'Calcular reparto' }));
    expect(screen.getByRole('dialog', { name: 'Confirmación' })).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringMatching(/\/admin\/propinas\/reparto\/\d+\/\d+\/calcular$/), undefined));
  });

  it('anular exige motivo de al menos 5 caracteres', async () => {
    const aprobado = {
      ...vista,
      reparto: {
        id: 5,
        estado: 'BORRADOR',
        totalPropinas: 150,
        totalHoras: 120,
        calculadoEn: '2026-11-02T10:00:00Z',
        aprobadoEn: null,
        pagadoEn: null,
        filas: [{ partyId: 1, nombre: 'Luis', horas: 120, porcentaje: 100, monto: 150, pagadoEn: null, pagadoMedio: null }],
      },
    };
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (/\/admin\/propinas\/reparto\/\d+\/\d+$/.test(url)) return aprobado as any;
      return [] as any;
    });
    render(<RepartoPropinas />);
    fireEvent.click(await screen.findByRole('button', { name: 'Anular' }));
    const confirmar = screen.getByRole('button', { name: 'Sí, confirmar' });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Motivo de la anulación/), { target: { value: 'horas mal cargadas' } });
    expect(confirmar).toBeEnabled();
  });

  it('CSV del reparto: campos con coma y comillas se escapan', () => {
    const csv = csvDeReparto([{ nombre: 'Ana, "la" jefa', horas: 10, porcentaje: 50, monto: 12.5 }]);
    expect(csv.split('\n')[1]).toBe('"Ana, ""la"" jefa",10,50,12.5,,');
  });
});

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const miGanado = vi.fn();
vi.mock('../planillaApi', async (orig) => ({ ...(await orig<any>()), miGanado: (...a: any[]) => miGanado(...a) }));

import { TarjetaGanado } from '../TarjetaGanado';

describe('TarjetaGanado', () => {
  beforeEach(() => miGanado.mockReset());

  it('estimado: lista por día, marca de feriado, acumulado y aviso', async () => {
    miGanado.mockResolvedValue({
      conSueldo: true, modalidad: 'SEMANAL', periodo: { desde: '2026-11-09', hasta: '2026-11-15' }, estado: 'ESTIMADO',
      dias: [{ jornada: '2026-11-09', trabajadaH: 8, ganado: 320, feriado: 'Prueba', recargo: 2 }, { jornada: '2026-11-10', trabajadaH: 8, ganado: 160, feriado: null, recargo: 1 }],
      acumulado: 480, neto: null,
    });
    render(<TarjetaGanado />);
    expect(await screen.findByText('Feriado ×2')).toBeInTheDocument();
    expect(screen.getByText('S/ 480.00')).toBeInTheDocument();
    expect(screen.getByText(/puede cambiar hasta que el administrador cierre el período/)).toBeInTheDocument();
    expect(screen.getByText('Estimado')).toBeInTheDocument();
  });

  it('pagado: muestra el neto congelado', async () => {
    miGanado.mockResolvedValue({ conSueldo: true, modalidad: 'MENSUAL', periodo: { desde: '2026-11-01', hasta: '2026-11-30' }, estado: 'PAGADO', dias: [], acumulado: 600, neto: 534.5 });
    render(<TarjetaGanado />);
    expect(await screen.findByText('S/ 534.50')).toBeInTheDocument();
    expect(screen.getByText('Pagado')).toBeInTheDocument();
  });

  it('sin sueldo: mensaje neutro', async () => {
    miGanado.mockResolvedValue({ conSueldo: false });
    render(<TarjetaGanado />);
    expect(await screen.findByTestId('ganado-sin-sueldo')).toBeInTheDocument();
  });
});

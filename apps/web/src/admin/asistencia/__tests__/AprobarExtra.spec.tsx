import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const aprobar = vi.fn();
vi.mock('../planillaApi', async (orig) => ({ ...(await orig<any>()), aprobarExtra: (...a: any[]) => aprobar(...a) }));

import { PestanaAsistencia } from '../PlanillaPersonaAsistencia';

const dia = { jornada: '2026-11-10', estado: 'SALIO_DESPUES', programadaMin: 540, trabajadaMin: 540, tardanzaMin: 0, salidaAnticipadaMin: 0, extraMin: 33, extraAprobada: false, extraAprobadaEn: null, extraPendiente: true, marcas: [], ganado: 60 };
const montar = (ejecutar: any) => {
  const c: any = { d: { partyId: 15, dias: [dia] }, r: { ganado: 60, extraMin: 33, extraAprobadaMin: 0, pagoExtra: 0 }, pagado: false, ocupado: false, faltan: 0, penal: 0, detallePenal: [], ejecutar };
  return render(<PestanaAsistencia c={c} />);
};

describe('Aprobar horas extra desde la tabla', () => {
  it('pide confirmación, aprueba y muestra el aviso de éxito', async () => {
    aprobar.mockResolvedValue({ ok: true });
    const ejecutar = vi.fn(async (fn: () => Promise<unknown>) => { await fn(); });
    montar(ejecutar);
    fireEvent.click(screen.getByLabelText('Aprobar las horas extra del 2026-11-10'));
    expect(aprobar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, aprobar' }));
    await waitFor(() => expect(aprobar).toHaveBeenCalledWith(15, '2026-11-10', true));
    expect(await screen.findByText(/aprobadas correctamente/)).toBeTruthy();
  });

  it('cancelar no aprueba nada', () => {
    const ejecutar = vi.fn();
    montar(ejecutar);
    fireEvent.click(screen.getByLabelText('Aprobar las horas extra del 2026-11-10'));
    fireEvent.click(screen.getByRole('button', { name: 'No, cancelar' }));
    expect(ejecutar).not.toHaveBeenCalled();
  });

  it('muestra también los días de descanso sin marcas, en gris', () => {
    const descanso = { ...dia, jornada: '2026-11-12', estado: 'DESCANSO', programadaMin: 0, trabajadaMin: 0, extraMin: 0, extraPendiente: false, ganado: 0 };
    const c: any = { d: { partyId: 15, dias: [dia, descanso] }, r: { ganado: 60, extraMin: 33, extraAprobadaMin: 0, pagoExtra: 0 }, pagado: false, ocupado: false, faltan: 0, penal: 0, detallePenal: [], ejecutar: vi.fn() };
    const { container } = render(<PestanaAsistencia c={c} />);
    expect(container.querySelector('#dia-2026-11-12.pp-fila-descanso')).toBeTruthy();
    expect(container.querySelector('#dia-2026-11-10.pp-fila-descanso')).toBeNull();
  });
});

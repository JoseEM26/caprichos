import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnularCortesia } from '../AnularCortesia';
import { cortesiasApi } from '../cortesiasApi';
import { filasInformeCortesias } from '../informeCortesias';

afterEach(() => vi.restoreAllMocks());

describe('AnularCortesia', () => {
  it('una cortesía anulada muestra «Anulada» y no ofrece el botón', () => {
    render(<AnularCortesia id="7" anulada anulable={false} alAnular={() => {}} />);
    expect(screen.getByText('Anulada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull();
  });

  it('una cortesía en línea (no anulable) no muestra el botón', () => {
    render(<AnularCortesia id="7" anulada={false} anulable={false} alAnular={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull();
  });

  it('pide confirmación y motivo de 5 letras como mínimo antes de anular', async () => {
    const anular = vi.spyOn(cortesiasApi, 'anular').mockResolvedValue({});
    const alAnular = vi.fn();
    render(<AnularCortesia id="7" anulada={false} anulable alAnular={alAnular} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anular' }));
    const si = screen.getByRole('button', { name: 'Sí, anular' }) as HTMLButtonElement;
    expect(si.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'ups' } });
    expect(si.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: '  Se registró por error ' } });
    expect(si.disabled).toBe(false);
    fireEvent.click(si);
    await waitFor(() => expect(anular).toHaveBeenCalledWith('7', 'Se registró por error'));
    await waitFor(() => expect(alAnular).toHaveBeenCalled());
  });

  it('«No» cierra sin llamar al servidor', () => {
    const anular = vi.spyOn(cortesiasApi, 'anular').mockResolvedValue({});
    render(<AnularCortesia id="7" anulada={false} anulable alAnular={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anular' }));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(anular).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('muestra el error del servidor (p. ej. cortesía vieja sin liga) y no avisa éxito', async () => {
    vi.spyOn(cortesiasApi, 'anular').mockRejectedValue({ mensaje: 'No podemos ligar esta cortesía' });
    const alAnular = vi.fn();
    render(<AnularCortesia id="7" anulada={false} anulable alAnular={alAnular} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anular' }));
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Error de caja' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, anular' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No podemos ligar');
    expect(alAnular).not.toHaveBeenCalled();
  });
});

describe('filasInformeCortesias con anuladas', () => {
  it('marca la fila como ANULADA con su motivo y expone la acción por fila', () => {
    const f = filasInformeCortesias({
      desde: null,
      hasta: null,
      resumen: { registros: 0, unidades: 0, valorLista: 0 },
      porMotivo: [],
      porProducto: [],
      porQuien: [],
      detalle: [
        {
          id: '9', creadoEn: '2026-11-05T15:00:00.000Z', producto: 'Dona', sabor: 'Oreo', cantidad: 1, valorLista: 5,
          motivo: 'PRUEBA', motivoEtiqueta: 'Prueba', nota: null, pedido: null, pedidoReferencia: 'CP-W001',
          dadaPor: 'Caja Uno', autorizadaPor: null, anulada: true, motivoAnulacion: 'Error de caja', anulable: false,
        },
      ],
    });
    const i = f.rows.findIndex((r) => String(r[0]).includes('Dona (Oreo)'));
    expect(String(f.rows[i][3])).toContain('ANULADA');
    expect(String(f.rows[i][3])).toContain('Error de caja');
    expect(f.accionesFila[i]).toEqual({ id: '9', anulada: true, anulable: false });
  });
});

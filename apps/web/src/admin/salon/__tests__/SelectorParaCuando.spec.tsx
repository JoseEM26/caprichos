import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { SelectorParaCuando, type MedioAdelanto } from '../componentes/SelectorParaCuando';
import { PARA_CUANDO_AHORA, type ParaCuando } from '../componentes/paraCuando';

afterEach(cleanup);

function Arnes({ alCambiar }: { alCambiar: (v: ParaCuando, adelanto: string, medio: MedioAdelanto) => void }) {
  const [v, setV] = useState<ParaCuando>(PARA_CUANDO_AHORA);
  const [ad, setAd] = useState('');
  const [medio, setMedio] = useState<MedioAdelanto>('EFECTIVO');
  alCambiar(v, ad, medio);
  return <SelectorParaCuando valor={v} onChange={setV} adelanto={ad} onAdelanto={setAd} medioAdelanto={medio} onMedioAdelanto={setMedio} mostrarErrores />;
}

describe('SelectorParaCuando', () => {
  it('arranca en Ahora, sin hora ni adelanto', () => {
    render(<Arnes alCambiar={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Ahora' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByLabelText('Hora del pedido')).toBeNull();
    expect(screen.queryByLabelText('Adelanto de hoy')).toBeNull();
  });

  it('Mañana pide hora y ofrece el adelanto; sin hora muestra el error', () => {
    const visto = vi.fn();
    render(<Arnes alCambiar={visto} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Mañana' }));
    expect(screen.getByLabelText('Hora del pedido')).toBeInTheDocument();
    expect(screen.getByLabelText('Adelanto de hoy')).toBeInTheDocument();
    expect(screen.getByRole('alert').textContent).toMatch(/hora/i);
    fireEvent.change(screen.getByLabelText('Hora del pedido'), { target: { value: '08:00' } });
    fireEvent.change(screen.getByLabelText('Adelanto de hoy'), { target: { value: '10' } });
    expect(visto).toHaveBeenLastCalledWith({ modo: 'MANANA', fecha: '', hora: '08:00' }, '10', 'EFECTIVO');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Otra fecha muestra el calendario con tope de 7 días', () => {
    render(<Arnes alCambiar={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Otra fecha' }));
    const fecha = screen.getByLabelText('Fecha del pedido') as HTMLInputElement;
    expect(fecha.min).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fecha.max > fecha.min).toBe(true);
  });
});

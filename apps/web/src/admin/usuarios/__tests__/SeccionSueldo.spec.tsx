import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SeccionSueldo } from '../SeccionSueldo';

const m = vi.hoisted(() => ({ obtener: vi.fn(), guardar: vi.fn() }));
vi.mock('../../asistencia/planillaApi', async (orig) => ({ ...(await orig<any>()), obtenerSueldo: m.obtener, guardarSueldo: m.guardar }));

const BOTON = { name: 'Usar el celular del usuario como celular de pago' };
const campo = () => screen.getByLabelText(/Celular de pago/) as HTMLInputElement;

describe('SeccionSueldo: sugerencia del celular de pago', () => {
  beforeEach(() => { m.obtener.mockReset(); m.guardar.mockReset().mockResolvedValue({}); });

  it('ofrece el celular del usuario enmascarado y lo copia al campo solo al pulsar', async () => {
    m.obtener.mockResolvedValue({ sueldo: null, celularUsuario: '987654123' });
    render(<SeccionSueldo partyId="7" />);
    const b = await screen.findByRole('button', BOTON);
    expect(b).toHaveTextContent('Usar el celular del usuario (···123)');
    expect(b.textContent).not.toContain('987654');
    expect(campo().value).toBe('');
    fireEvent.click(b);
    expect(campo().value).toBe('987654123');
    expect(screen.queryByRole('button', BOTON)).toBeNull();
    fireEvent.change(campo(), { target: { value: '911111111' } });
    expect(campo().value).toBe('911111111');
    expect(screen.getByRole('button', BOTON)).toBeInTheDocument();
  });

  it('sin celular no muestra nada', async () => {
    m.obtener.mockResolvedValue({ sueldo: null });
    render(<SeccionSueldo partyId="7" />);
    await waitFor(() => expect(m.obtener).toHaveBeenCalled());
    expect(screen.queryByRole('button', BOTON)).toBeNull();
  });

  it('prefiere el celular escrito sin guardar en el modal', async () => {
    m.obtener.mockResolvedValue({ sueldo: null, celularUsuario: '987654123' });
    render(<SeccionSueldo partyId="7" celularSugerido="955555999" />);
    expect(await screen.findByRole('button', BOTON)).toHaveTextContent('···999');
  });

  it('no se fuerza al guardar: sin pulsar, pagoCelular va vacío', async () => {
    m.obtener.mockResolvedValue({ sueldo: null, celularUsuario: '987654123' });
    render(<SeccionSueldo partyId="7" />);
    await screen.findByRole('button', BOTON);
    fireEvent.change(screen.getByLabelText(/Monto/), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sueldo' }));
    await waitFor(() => expect(m.guardar).toHaveBeenCalled());
    expect(m.guardar.mock.calls[0][3].pagoCelular).toBe('');
  });

  it('muestra el historial con «Vigente desde» y manda la fecha elegida al guardar', async () => {
    m.obtener.mockResolvedValue({
      sueldo: { modalidad: 'MENSUAL', semanal: 346.15, mensual: 1500, metodo: 'DIAS_HORAS', diasMes: null, horasDia: null, tarifaHora: null },
      historial: [
        { modalidad: 'MENSUAL', semanal: 346.15, mensual: 1500, metodo: 'DIAS_HORAS', vigenteDesde: '2026-11-10', creadoEn: '2026-11-10T10:00:00Z' },
        { modalidad: 'MENSUAL', semanal: 230.77, mensual: 1000, metodo: 'DIAS_HORAS', vigenteDesde: null, creadoEn: '2026-10-01T10:00:00Z' },
      ],
    });
    render(<SeccionSueldo partyId="7" />);
    expect(await screen.findByText(/Vigente desde 10\/11\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Desde siempre/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Vigente desde \(vacío/), { target: { value: '2026-11-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sueldo' }));
    await waitFor(() => expect(m.guardar).toHaveBeenCalled());
    expect(m.guardar.mock.calls[0][3].vigenteDesde).toBe('2026-11-05');
  });
});

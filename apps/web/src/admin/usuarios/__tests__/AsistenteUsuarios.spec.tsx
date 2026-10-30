import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CrearUsuarioModal } from '../CrearUsuarioModal';
import { EditarUsuarioModal } from '../EditarUsuarioModal';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() },
  ErrorApi: class extends Error {
    codigo = '';
  },
}));

const PERSONAL = [
  { id: '7', partyId: '70', nombres: 'Luis', apellidos: 'Mozo', rol: 'MOZO', horarios: [{ dia: 1, entrada: '09:00', salida: '17:00' }], reemplazos: [] },
  { id: '8', partyId: '80', nombres: 'Rosa', apellidos: 'Cajera', rol: 'CAJERO', horarios: [], reemplazos: [] },
];

function setup() {
  const alUsuarioCreado = vi.fn();
  render(<CrearUsuarioModal abierto alCerrar={vi.fn()} alUsuarioCreado={alUsuarioCreado} />);
  return { alUsuarioCreado };
}
const siguiente = () => fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
const llenarPaso1 = () => {
  fireEvent.change(screen.getByLabelText(/DNI/), { target: { value: '12345678' } });
  fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Paz' } });
};

describe('Asistente Nuevo usuario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue(PERSONAL);
  });

  it('no avanza con DNI inválido', () => {
    setup();
    expect(screen.getByText(/Paso 1 de 4/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/DNI/), { target: { value: '123' } });
    siguiente();
    expect(screen.getByText(/exactamente 8 dígitos/)).toBeInTheDocument();
    expect(screen.getByText(/Paso 1 de 4/)).toBeInTheDocument();
  });

  it('horario copia a todos los días y suma horas por semana', () => {
    setup();
    llenarPaso1();
    siguiente();
    siguiente();
    expect(screen.getByText(/Paso 3 de 4/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Trabaja el lunes'));
    fireEvent.change(screen.getByLabelText('Entrada del lunes'), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText('Salida del lunes'), { target: { value: '18:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Copiar a todos los días' }));
    expect((screen.getByLabelText('Entrada del domingo') as HTMLInputElement).value).toBe('10:00');
    expect(screen.getByText('Total por semana: 56 h')).toBeInTheDocument();
  });

  it('paso 4 se omite y el resumen crea enviando todo tras confirmar Sí', async () => {
    vi.mocked(api.post).mockResolvedValue({
      id: '9', partyId: '90', nombres: 'Ana', apellidos: 'Paz', dni: '12****78', rol: 'CAJERO', activo: true, debeCambiar: true, claveInicial: 'abc',
    });
    const { alUsuarioCreado } = setup();
    llenarPaso1();
    fireEvent.change(screen.getByLabelText(/Celular/), { target: { value: '987654321' } });
    siguiente();
    siguiente();
    fireEvent.click(screen.getByLabelText('Trabaja el martes'));
    siguiente();
    expect(screen.getByText(/Paso 4 de 4/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Omitir' }));
    expect(screen.getByText('Resumen final')).toBeInTheDocument();
    expect(screen.getByText(/Total por semana: 8 h/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, crear' }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [ruta, cuerpo] = vi.mocked(api.post).mock.calls[0] as [string, any];
    expect(ruta).toBe('/admin/usuarios');
    expect(cuerpo).toMatchObject({
      dni: '12345678',
      celular: '987654321',
      horarios: [{ dia: 2, entrada: '09:00', salida: '17:00' }],
      reemplazos: [],
    });
    await waitFor(() => expect(alUsuarioCreado).toHaveBeenCalled());
  });

  it('paso 4 ofrece personal con su disponibilidad y envía el reemplazo elegido', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: '9', partyId: '90', nombres: 'A', apellidos: 'B', dni: 'x', rol: 'CAJERO', activo: true, debeCambiar: true, claveInicial: 'c' });
    setup();
    llenarPaso1();
    siguiente();
    siguiente();
    fireEvent.click(screen.getByLabelText('Trabaja el lunes'));
    siguiente();
    await screen.findByText(/Martes: ¿quién lo reemplaza\?/);
    expect(screen.queryByText(/Lunes: ¿quién/)).not.toBeInTheDocument();
    const combo = within(screen.getByTestId('reemplazo-2')).getByRole('button', { name: /Sin reemplazo/ });
    fireEvent.click(combo);
    expect(screen.getAllByText(/Descansa ese día/).length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByText('Rosa Cajera'));
    siguiente();
    expect(screen.getByText(/Martes: Rosa Cajera/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, crear' }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect((vi.mocked(api.post).mock.calls[0][1] as any).reemplazos).toEqual([{ dia: 2, reemplazaPartyId: '80' }]);
  });

  it('Editar usuario carga y guarda horario y reemplazos reales', async () => {
    vi.mocked(api.get).mockImplementation(async (ruta: string) =>
      ruta.endsWith('/horario')
        ? { horarios: [{ dia: 1, entrada: '08:00', salida: '16:00' }], reemplazos: [] }
        : PERSONAL,
    );
    vi.mocked(api.put).mockResolvedValue({});
    render(
      <EditarUsuarioModal
        abierto
        alCerrar={vi.fn()}
        alUsuarioEditado={vi.fn()}
        usuario={{ id: '5', partyId: '50', nombres: 'Ana', apellidos: 'Paz', dni: '12****78', rol: 'CAJERO', activo: true, debeCambiar: false }}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Horario' }));
    await waitFor(() => expect((screen.getByLabelText('Entrada del lunes') as HTMLInputElement).value).toBe('08:00'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horario y reemplazos' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/usuarios/5/horario', {
      horarios: [{ dia: 1, entrada: '08:00', salida: '16:00' }],
      reemplazos: [],
    }));
  });
});

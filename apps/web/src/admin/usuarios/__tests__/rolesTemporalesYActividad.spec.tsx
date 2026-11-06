import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import { ActividadUsuario } from '../ActividadUsuario';
import { DarRolTemporalModal } from '../DarRolTemporalModal';
import { fechaLimaAIso, fechaLimaCorta } from '../rolesTemporalesApi';

vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ErrorApi: class extends Error {
    codigo = '';
  },
}));

const ACTIVIDAD = {
  total: 2,
  pagina: 1,
  limite: 15,
  paginas: 1,
  tipos: [
    { id: 'roles', nombre: 'Roles' },
    { id: 'datos', nombre: 'Datos' },
  ],
  datos: [
    {
      id: 'h-5',
      en: '2026-11-06T15:00:00.000Z',
      enTexto: '6 nov 10:00',
      tipo: 'roles',
      texto: 'Juan Pérez le dio el rol Supervisor a Ana Ruiz hasta el 7 nov 18:00',
      quien: 'Juan Pérez',
      motivo: 'Cubre al titular',
    },
    {
      id: 'a-9',
      en: '2026-11-05T15:00:00.000Z',
      enTexto: '5 nov 10:00',
      tipo: 'datos',
      texto: 'Juan Pérez editó los datos de Ana Ruiz (nombre)',
      quien: 'Juan Pérez',
      motivo: null,
    },
  ],
};

describe('ActividadUsuario', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra la línea de tiempo en español con su motivo', async () => {
    vi.mocked(api.get).mockResolvedValue(ACTIVIDAD);
    render(<ActividadUsuario usuarioId="10" />);
    expect(await screen.findByText('Juan Pérez le dio el rol Supervisor a Ana Ruiz hasta el 7 nov 18:00')).toBeInTheDocument();
    expect(screen.getByText('Motivo: Cubre al titular')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/admin/usuarios/10/actividad?pagina=1&limite=15'));
  });

  it('el filtro por tipo y el rango de fechas van al servidor (hora de Lima)', async () => {
    vi.mocked(api.get).mockResolvedValue(ACTIVIDAD);
    render(<ActividadUsuario usuarioId="10" />);
    await screen.findByText(/le dio el rol Supervisor/);
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'roles' } });
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('tipo=roles')));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-01' } });
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('desde=2026-11-01T00%3A00%3A00-05%3A00')));
  });
});

describe('DarRolTemporalModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('da el rol con motivo y fin, en hora de Lima', async () => {
    vi.mocked(api.post).mockResolvedValue({ ok: true });
    const alDarRol = vi.fn();
    render(
      <DarRolTemporalModal usuarioId="10" rolesActuales={['CAJERO']} abierto alCerrar={() => {}} alDarRol={alDarRol} />,
    );
    fireEvent.change(screen.getByLabelText(/^Rol$/), { target: { value: 'SUPERVISOR' } });
    fireEvent.change(screen.getByLabelText('Motivo (opcional)'), { target: { value: 'El titular no viene' } });
    fireEvent.change(screen.getByLabelText(/Hasta cuándo/), { target: { value: '2099-11-07T18:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dar rol' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/usuarios/10/roles-extra', {
        rol: 'SUPERVISOR',
        motivo: 'El titular no viene',
        hasta: '2099-11-07T18:00:00-05:00',
      }),
    );
    await waitFor(() => expect(alDarRol).toHaveBeenCalledWith(expect.objectContaining({ rol: 'SUPERVISOR' }), expect.any(String)));
  });

  it('no deja dar un rol que la persona ya tiene y rechaza una fecha pasada', () => {
    render(<DarRolTemporalModal usuarioId="10" rolesActuales={['CAJERO', 'SUPERVISOR']} abierto alCerrar={() => {}} alDarRol={() => {}} />);
    const opciones = Array.from(screen.getByLabelText(/^Rol$/).querySelectorAll('option')).map((o) => o.value);
    expect(opciones).not.toContain('SUPERVISOR');
    expect(opciones).not.toContain('CAJERO');
    fireEvent.change(screen.getByLabelText(/^Rol$/), { target: { value: 'MOZO' } });
    fireEvent.change(screen.getByLabelText(/Hasta cuándo/), { target: { value: '2020-01-01T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dar rol' }));
    expect(screen.getByRole('alert')).toHaveTextContent('La fecha de fin ya pasó.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('convierte la fecha local a hora de Lima y la muestra en español', () => {
    expect(fechaLimaAIso('2026-11-07T18:00')).toBe('2026-11-07T18:00:00-05:00');
    expect(fechaLimaCorta('2026-11-07T23:00:00.000Z')).toBe('7 nov 18:00');
  });
});

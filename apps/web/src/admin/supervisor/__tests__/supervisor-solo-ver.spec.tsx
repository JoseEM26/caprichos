import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CodigoSupervisorView } from '../CodigoSupervisorView';
import { api } from '../../../comun/api';

// Sesión del SUPERVISOR: ve el código, pero no lo genera, rota ni desbloquea
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ tiene: (permiso: string) => permiso === 'supervisor/ver_codigo' }),
}));

describe('Código del supervisor para el SUPERVISOR (solo ver)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el código y Copiar, pero no Rotar ni Desbloquear', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      codigo: '482910',
      segundosRestantes: 25,
      bloqueados: [{ partyId: '9', nombre: 'Ana Mozo', segundosRestantes: 40 }],
    });

    render(<CodigoSupervisorView />);

    expect(await screen.findByTestId('codigo-grande')).toHaveTextContent('482 910');
    expect(screen.getByTestId('btn-copiar-codigo')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-rotar-secreto')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desbloquear' })).not.toBeInTheDocument();
    expect(screen.getByText(/Ana Mozo/)).toBeInTheDocument();
  });

  it('sin secreto configurado, no ofrece generarlo', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(Object.assign(new Error('x'), { status: 409 }));

    render(<CodigoSupervisorView />);

    expect(await screen.findByTestId('panel-sin-configurar')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-generar-secreto')).not.toBeInTheDocument();
    expect(screen.getByTestId('aviso-solo-admin-secreto')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PanelInstalarPrograma } from '../PanelInstalarPrograma';

vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ usuario: { rol: 'ADMIN' } }) }));
vi.mock('../impresionApi', () => ({ impresionApi: { generarCodigoVinculo: vi.fn() } }));

describe('PanelInstalarPrograma', () => {
  it('pestaña Linux: comandos con el origen y botón Copiar', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<PanelInstalarPrograma alCerrar={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Linux' }));
    const origen = window.location.origin;
    const esperado = `curl -fL ${origen}/api/agente-impresion/descargar/linux -o ~/caprichos-impresion && chmod +x ~/caprichos-impresion`;
    expect(screen.getAllByTestId('comando')[0]).toHaveTextContent(esperado);
    expect(screen.getByText('sudo usermod -aG lp $USER')).toBeInTheDocument();
    expect(screen.getByText('~/caprichos-impresion configurar')).toBeInTheDocument();
    expect(screen.getByText('journalctl --user -u caprichos-impresion -f')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Copiar' })[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(esperado));
  });

  it('pestaña Windows conserva el enlace de descarga', () => {
    render(<PanelInstalarPrograma alCerrar={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Windows' }));
    expect(screen.getByRole('link')).toHaveAttribute('href', '/api/agente-impresion/descargar/windows');
  });
});

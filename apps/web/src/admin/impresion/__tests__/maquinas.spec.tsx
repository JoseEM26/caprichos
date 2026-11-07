import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { impresionApi } from '../impresionApi';
import { IndicadoresMaquinas } from '../IndicadoresMaquinas';
import { useConfirmarImpresion } from '../useConfirmarImpresion';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));
vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ usuario: { rol: 'ADMIN' } }) }));
vi.mock('../impresionApi', () => ({
  impresionApi: { obtenerEstado: vi.fn(), generarCodigoVinculo: vi.fn() },
}));

const ok = { conectada: true, estado: 'lista', motivo: null };
const caida = { conectada: false, estado: 'sin_programa', motivo: 'El programa del local no está corriendo' };
const estado = (impresoras: any) => ({ agente: 'conectado', impresora: 'lista', pendientes: 0, fallidos: 0, impresoras }) as any;

function Boton({ alContinuar }: { alContinuar: () => void }) {
  const { pedir, dialogo } = useConfirmarImpresion();
  return (
    <>
      <button onClick={() => void pedir(alContinuar)}>Aprobar</button>
      {dialogo}
    </>
  );
}

describe('indicadores de máquinas', () => {
  it('muestra estado y motivo de cada máquina y ofrece instalar si el programa no corre', () => {
    render(<MemoryRouter><IndicadoresMaquinas maquinas={{ ETIQUETERA: caida, TICKETERA: caida } as any} /></MemoryRouter>);
    expect(screen.getByTestId('indicador-etiquetera')).toHaveTextContent('Etiquetera');
    expect(screen.getByTestId('indicador-ticketera')).toHaveTextContent('Ticketera');
    // El detalle (motivo e instalar) se ve al pulsar el chip
    expect(screen.queryByRole('button', { name: 'Instalar programa de impresión' })).toBeNull();
    fireEvent.click(screen.getByTestId('indicador-etiquetera'));
    const detalle = screen.getByRole('region', { name: 'Estado de Etiquetera' });
    expect(detalle).toHaveTextContent('Etiquetera: no conectada');
    expect(detalle).toHaveTextContent('El programa del local no está corriendo');
    expect(screen.getByRole('button', { name: 'Instalar programa de impresión' })).toBeInTheDocument();
  });

  it('con ambas conectadas sigue ofreciendo instalar/descargar el programa', () => {
    render(<MemoryRouter><IndicadoresMaquinas maquinas={{ ETIQUETERA: ok, TICKETERA: ok } as any} /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('indicador-etiquetera'));
    expect(screen.getByRole('region', { name: 'Estado de Etiquetera' })).toHaveTextContent('Etiquetera: conectada');
    expect(screen.getByRole('button', { name: 'Instalar programa de impresión' })).toBeInTheDocument();
  });

  it('el panel de instalación muestra descarga, pasos y el código de un solo uso', async () => {
    vi.mocked(impresionApi.generarCodigoVinculo).mockResolvedValue({ codigo: 'ABCD2345@demo.caprichos.pe', expiraEn: '' });
    render(<MemoryRouter><IndicadoresMaquinas maquinas={{ ETIQUETERA: caida, TICKETERA: caida } as any} /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('indicador-etiquetera'));
    fireEvent.click(screen.getByRole('button', { name: 'Instalar programa de impresión' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Windows' }));
    expect(screen.getByRole('link', { name: /Descargar el programa de impresión para Windows/ })).toHaveAttribute('href', '/api/agente-impresion/descargar/windows');
    fireEvent.click(screen.getByRole('button', { name: 'Generar código de vinculación' }));
    expect(await screen.findByTestId('codigo-vinculo')).toHaveTextContent('ABCD2345@demo.caprichos.pe');
  });
});

describe('confirmación antes de aprobar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('con ambas máquinas bien sigue sin preguntar', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue(estado({ ETIQUETERA: ok, TICKETERA: ok }));
    const seguir = vi.fn();
    render(<Boton alContinuar={seguir} />);
    fireEvent.click(screen.getByText('Aprobar'));
    await waitFor(() => expect(seguir).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('si falta la etiquetera pregunta Sí/No; con No no aprueba, con Sí aprueba', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue(
      estado({ ETIQUETERA: { conectada: false, estado: 'desconectada', motivo: 'Impresora no encontrada' }, TICKETERA: ok }),
    );
    const seguir = vi.fn();
    render(<Boton alContinuar={seguir} />);
    fireEvent.click(screen.getByText('Aprobar'));
    const dlg = await screen.findByRole('dialog');
    expect(dlg).toHaveTextContent('La etiquetera no está conectada. Si continúas, las etiquetas quedarán en cola y se imprimirán cuando se conecte. ¿Continuar?');
    expect(dlg).not.toHaveTextContent('ticketera');
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(seguir).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Aprobar'));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Sí, continuar' }));
    await waitFor(() => expect(seguir).toHaveBeenCalledTimes(1));
  });

  it('programa apagado: avisa de ambas y ofrece instalar', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue(estado({ ETIQUETERA: caida, TICKETERA: caida }));
    render(<Boton alContinuar={vi.fn()} />);
    fireEvent.click(screen.getByText('Aprobar'));
    const dlg = await screen.findByRole('dialog');
    expect(dlg).toHaveTextContent('La etiquetera no está conectada');
    expect(dlg).toHaveTextContent('La ticketera no está conectada');
    expect(screen.getByRole('button', { name: 'Instalar programa de impresión' })).toBeInTheDocument();
  });

  it('si no se puede consultar el estado no bloquea la aprobación', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockRejectedValue(new Error('sin red'));
    const seguir = vi.fn();
    render(<Boton alContinuar={seguir} />);
    fireEvent.click(screen.getByText('Aprobar'));
    await waitFor(() => expect(seguir).toHaveBeenCalled());
  });
});

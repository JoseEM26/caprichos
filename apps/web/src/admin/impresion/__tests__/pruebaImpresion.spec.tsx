import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { impresionApi } from '../impresionApi';
import { PruebaImpresion } from '../PruebaImpresion';

vi.mock('../impresionApi', () => ({
  impresionApi: {
    pruebaImpresion: vi.fn(),
    estadoPrueba: vi.fn(),
  },
}));

const conectada = { conectada: true, estado: 'lista', motivo: null } as any;
const caida = { conectada: false, estado: 'sin_programa', motivo: 'El programa del local no está corriendo' } as any;

describe('botón de prueba de impresión', () => {
  beforeEach(() => {
    vi.mocked(impresionApi.pruebaImpresion).mockReset();
    vi.mocked(impresionApi.estadoPrueba).mockReset();
  });

  it('está deshabilitado y explica qué hacer si la máquina no está conectada', () => {
    render(<PruebaImpresion rol="ETIQUETERA" maquina={caida} />);
    expect(screen.getByRole('button', { name: 'Imprimir etiqueta de prueba' })).toBeDisabled();
    expect(screen.getByText('Etiquetera desconectada: abre el programa de impresión')).toBeInTheDocument();
  });

  it('pide confirmación Sí/No y, si no, no envía nada', () => {
    render(<PruebaImpresion rol="TICKETERA" maquina={conectada} />);
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir ticket de prueba' }));
    expect(screen.getByText('¿Imprimir un ticket de prueba?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(impresionApi.pruebaImpresion).not.toHaveBeenCalled();
  });

  it('envía la prueba del rol pedido y muestra Impresa cuando sale', async () => {
    vi.mocked(impresionApi.pruebaImpresion).mockResolvedValue({ ok: true, trabajoId: '77', mensaje: '' });
    vi.mocked(impresionApi.estadoPrueba).mockResolvedValue({ id: '77', rol: 'ETIQUETERA', estado: 'IMPRESO', intentos: 1, error: null });
    render(<PruebaImpresion rol="ETIQUETERA" maquina={conectada} />);
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir etiqueta de prueba' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, imprimir' }));
    expect(impresionApi.pruebaImpresion).toHaveBeenCalledWith('ETIQUETERA');
    expect(await screen.findByText('Impresa: la prueba salió bien.', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('muestra el motivo del agente cuando la prueba falla', async () => {
    vi.mocked(impresionApi.pruebaImpresion).mockResolvedValue({ ok: true, trabajoId: '78', mensaje: '' });
    vi.mocked(impresionApi.estadoPrueba).mockResolvedValue({ id: '78', rol: 'TICKETERA', estado: 'FALLIDO', intentos: 5, error: 'Sin papel' });
    render(<PruebaImpresion rol="TICKETERA" maquina={conectada} />);
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir ticket de prueba' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, imprimir' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Error: Sin papel'), { timeout: 4000 });
  });

  it('muestra el error si el servidor rechaza la prueba (límite de frecuencia)', async () => {
    vi.mocked(impresionApi.pruebaImpresion).mockRejectedValue(new Error('Espera unos segundos antes de otra prueba de esta máquina'));
    render(<PruebaImpresion rol="ETIQUETERA" maquina={conectada} />);
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir etiqueta de prueba' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, imprimir' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Espera unos segundos');
  });
});

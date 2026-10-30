import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SalientesWhatsApp } from '../SalientesWhatsApp';
import * as api from '../salientesApi';

const resumenBase = {
  pendientes: 2,
  enviando: 0,
  enviados: 10,
  fallidos: 1,
  descartados: 0,
  lagSegundos: 30,
  lagAlertaMin: 5,
  lagAlerta: false,
};

const fallido: api.SalienteAdmin = {
  id: '41',
  telefono: '*** *** 222',
  origen: 'AVISO_PEDIDO',
  tipo: 'TEXTO',
  estado: 'FALLIDO',
  intentos: 1,
  maxIntentos: 5,
  ultimoError: '[NUMERO_INVALIDO] número no existe',
  clasificacion: 'PERMANENTE',
  texto: 'Tu pedido está en camino',
  pedidoCodigo: 'CP-204',
  motivoDescarte: null,
  creadoEn: '2026-10-28T10:00:00Z',
  actualizadoEn: '2026-10-28T10:01:00Z',
  enviadoEn: null,
};

describe('Pestaña Salientes de WhatsApp', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api.salientesApi, 'resumen').mockResolvedValue({ ...resumenBase });
    vi.spyOn(api.salientesApi, 'listar').mockResolvedValue({ pagina: 1, limite: 20, total: 1, filas: [fallido] });
  });

  it('muestra los indicadores y la tarjeta del fallido con su motivo, sin franja cuando el lag es normal', async () => {
    render(<SalientesWhatsApp />);
    await waitFor(() => expect(screen.getByText('Origen: AVISO_PEDIDO · Pedido CP-204 · Intentos 1/5')).toBeTruthy());
    expect(screen.getByText(/número no existe/)).toBeTruthy();
    expect(screen.getByTestId('indicador-fallidos').textContent).toBe('1');
    expect(screen.queryByTestId('franja-lag-salientes')).toBeNull();
  });

  it('muestra la franja fija cuando el lag supera el umbral', async () => {
    vi.spyOn(api.salientesApi, 'resumen').mockResolvedValue({ ...resumenBase, lagAlerta: true, lagSegundos: 720 });
    render(<SalientesWhatsApp />);
    await waitFor(() => expect(screen.getByTestId('franja-lag-salientes')).toBeTruthy());
    expect(screen.getByTestId('indicador-retraso').textContent).toBe('12 min');
  });

  it('Reenviar abre un Sí/No de confirmación y solo al confirmar llama a la API (sin window.confirm)', async () => {
    const confirmNativo = vi.spyOn(window, 'confirm');
    const reenviar = vi.spyOn(api.salientesApi, 'reenviar').mockResolvedValue({});
    render(<SalientesWhatsApp />);
    await waitFor(() => screen.getByText('Reenviar'));

    fireEvent.click(screen.getByText('Reenviar'));
    expect(screen.getByText('¿Reenviar este mensaje?')).toBeTruthy();
    expect(reenviar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Sí, reenviar'));
    await waitFor(() => expect(reenviar).toHaveBeenCalledWith('41'));
    expect(confirmNativo).not.toHaveBeenCalled();
  });

  it('Descartar exige un motivo y lo envía con la confirmación', async () => {
    const descartar = vi.spyOn(api.salientesApi, 'descartar').mockResolvedValue({});
    render(<SalientesWhatsApp />);
    await waitFor(() => screen.getByText('Descartar'));

    fireEvent.click(screen.getByText('Descartar'));
    fireEvent.click(screen.getByText('Sí, descartar'));
    expect(descartar).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Motivo del descarte'), { target: { value: 'Ya lo atendieron por llamada' } });
    fireEvent.click(screen.getByText('Sí, descartar'));
    await waitFor(() => expect(descartar).toHaveBeenCalledWith('41', 'Ya lo atendieron por llamada'));
  });
});

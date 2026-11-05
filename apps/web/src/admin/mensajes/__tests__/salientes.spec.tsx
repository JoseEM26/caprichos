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
  proposito: null,
  canal: null,
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
    await waitFor(() => expect(screen.getByText(/Origen: AVISO_PEDIDO · Pedido CP-204 · Intentos 1\/5/)).toBeTruthy());
    expect(screen.getByText(/Estado: Fallido/)).toBeTruthy();
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

  it('«Códigos de cuenta» pide el origen CODIGO_CUENTA en todos los estados y muestra el código enmascarado con su canal', async () => {
    const codigo: api.SalienteAdmin = {
      ...fallido,
      id: '77',
      origen: 'CODIGO_CUENTA',
      estado: 'ENVIADO',
      proposito: 'REGISTRO',
      canal: { tipo: 'PLANTILLA', plantilla: 'CODIGO_CUENTA' },
      texto: 'Tu código para crear tu cuenta en Caprichos es ••••••. Vence en 10 minutos.',
      ultimoError: null,
    };
    const listar = vi.spyOn(api.salientesApi, 'listar').mockResolvedValue({ pagina: 1, limite: 20, total: 1, filas: [codigo] });
    render(<SalientesWhatsApp />);
    await waitFor(() => screen.getByText('Códigos de cuenta'));

    fireEvent.click(screen.getByText('Códigos de cuenta'));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith('', 1, 'CODIGO_CUENTA'));
    expect(await screen.findByText(/Estado: Enviado · Origen: CODIGO_CUENTA \(registro de cuenta\)/)).toBeTruthy();
    expect(screen.getByText('Salió como: plantilla CODIGO_CUENTA')).toBeTruthy();
    expect(screen.getByText(/es ••••••\. Vence/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d{6}/);
  });

  it('con más de una página, Siguiente pide la página 2 y cambiar de filtro vuelve a la 1', async () => {
    const listar = vi.spyOn(api.salientesApi, 'listar').mockResolvedValue({ pagina: 1, limite: 20, total: 45, filas: [fallido] });
    render(<SalientesWhatsApp />);
    await waitFor(() => screen.getByText('Página 1 de 3'));

    fireEvent.click(screen.getByText('Siguiente'));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith('FALLIDO', 2));
    fireEvent.click(screen.getByText('Enviados'));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith('ENVIADO', 1));
  });

  it('muestra la causa en español y, en el detalle técnico, el código de Meta con el texto original', async () => {
    const conDetalle: api.SalienteAdmin = {
      ...fallido,
      causa: 'Una variable tiene un formato que Meta no admite.',
      detalleTecnico: { codigoMeta: '132012', original: 'Parameter format does not match format in the created template' },
    };
    vi.spyOn(api.salientesApi, 'listar').mockResolvedValue({ pagina: 1, limite: 20, total: 1, filas: [conDetalle] });
    render(<SalientesWhatsApp />);
    await waitFor(() => expect(screen.getByText(/Una variable tiene un formato/)).toBeTruthy());
    expect(screen.getByText('Detalle técnico')).toBeTruthy();
    expect(screen.getByText(/Código de Meta: 132012 · Parameter format does not match/)).toBeTruthy();
  });
});

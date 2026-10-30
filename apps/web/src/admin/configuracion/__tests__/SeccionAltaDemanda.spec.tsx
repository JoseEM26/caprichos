import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import * as cocinaApi from '../../cocina/cocinaApi';
import { SeccionAltaDemanda } from '../SeccionAltaDemanda';
import { ConfiguracionLocalView } from '../ConfiguracionLocalView';
import { api } from '../../../comun/api';

describe('Sección Alta Demanda y Pausa de Pedidos en Configuración', () => {
  let callbacksSocket: Record<string, ((...args: any[]) => any)[]> = {};

  beforeEach(() => {
    vi.restoreAllMocks();
    callbacksSocket = {};

    vi.spyOn(socketModulo, 'useEventos').mockImplementation((evento, cb) => {
      if (!callbacksSocket[evento]) callbacksSocket[evento] = [];
      callbacksSocket[evento].push(cb);
    });

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
      permisos: ['local/ver', 'local/editar', 'cocina/demanda', 'configuracion/editar'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: () => true,
    });
  });

  it('1. Renderiza el estado inicial apagado con los pasos guiados y controles', async () => {
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValueOnce({
      activa: false,
      minutos: 0,
      pausa: false,
    });

    render(<SeccionAltaDemanda />);

    await waitFor(() => {
      expect(screen.getByTestId('insignia-estado')).toHaveTextContent(/Apagada/i);
    });

    // Pasos guiados
    expect(screen.getByText(/Paso 1: Minutos adicionales de espera/i)).toBeInTheDocument();
    expect(screen.getByText(/Paso 2: Recepción de pedidos/i)).toBeInTheDocument();
    expect(screen.getByText(/Paso 3: Confirmar y guardar/i)).toBeInTheDocument();

    // Atajos
    expect(screen.getByRole('button', { name: /^\+5 min$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^\+30 min$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^\+60 min$/i })).toBeInTheDocument();

    // Campo numérico personalizado
    expect(screen.getByLabelText(/Otro \(min\)/i)).toBeInTheDocument();

    // Botones de recepción
    expect(screen.getByRole('button', { name: /Seguir recibiendo pedidos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pausar pedidos/i })).toBeInTheDocument();
  });

  it('2. Permite seleccionar atajos y actualiza la vista previa del tiempo en la carta', async () => {
    render(
      <SeccionAltaDemanda
        estadoInicial={{
          activa: false,
          minutos: 0,
          pausa: false,
        }}
      />,
    );

    const atajo45 = screen.getByRole('button', { name: /^\+45 min$/i });
    fireEvent.click(atajo45);

    // Debe marcarse como seleccionado
    expect(atajo45).toHaveAttribute('aria-pressed', 'true');

    // Debe reflejarse en el input numérico
    const inputOtro = screen.getByLabelText(/Otro \(min\)/i) as HTMLInputElement;
    expect(inputOtro.value).toBe('45');

    // Debe mostrar el cálculo sumando al rango 25 a 35 min -> 70 a 80 min
    expect(
      screen.getByText(/de 70 a 80 minutos/i),
    ).toBeInTheDocument();
  });

  it('3. Valida que el campo "Otro (min)" acepte entre 5 y 180 y muestre error si está fuera de rango', async () => {
    render(
      <SeccionAltaDemanda
        estadoInicial={{
          activa: false,
          minutos: 0,
          pausa: false,
        }}
      />,
    );

    const inputOtro = screen.getByLabelText(/Otro \(min\)/i);

    // Menor a 5
    fireEvent.change(inputOtro, { target: { value: '4' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/Los minutos deben estar entre 5 y 180/i);

    // Mayor a 180
    fireEvent.change(inputOtro, { target: { value: '181' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/Los minutos deben estar entre 5 y 180/i);

    // Valor válido: 120
    fireEvent.change(inputOtro, { target: { value: '120' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/de 145 a 155 minutos/i)).toBeInTheDocument();
  });

  it('4. Cumple RQ-COC-03-09: La pausa de pedidos solo se puede activar con alta demanda activa', async () => {
    render(
      <SeccionAltaDemanda
        estadoInicial={{
          activa: false,
          minutos: 0,
          pausa: false,
        }}
      />,
    );

    const botonPausa = screen.getByRole('button', { name: /Pausar pedidos/i });

    // Si se intenta pulsar cuando está apagada
    fireEvent.click(botonPausa);
    expect(screen.getByRole('alert')).toHaveTextContent(
      /La pausa de pedidos solo se puede activar cuando la alta demanda está activa/i,
    );
  });

  it('5. Despliega ayudas accesibles con «?» que explican el impacto en la carta y el chatbot', async () => {
    render(
      <SeccionAltaDemanda
        estadoInicial={{
          activa: false,
          minutos: 0,
          pausa: false,
        }}
      />,
    );

    const botonAyudaMinutos = screen.getByRole('button', {
      name: /Ayuda sobre los minutos adicionales de espera/i,
    });
    expect(botonAyudaMinutos).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(botonAyudaMinutos);
    expect(botonAyudaMinutos).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText(/¿Cómo afecta a la carta y al chatbot\?/i),
    ).toBeInTheDocument();

    const botonAyudaPausa = screen.getByRole('button', {
      name: /Ayuda sobre la pausa de pedidos/i,
    });
    fireEvent.click(botonAyudaPausa);
    expect(
      screen.getByText(/¿Qué pasa con la pausa de pedidos\?/i),
    ).toBeInTheDocument();
  });

  it('6. Activar alta demanda pide confirmación Sí/No y llama al endpoint PUT', async () => {
    const mockPut = vi.spyOn(cocinaApi, 'configurarAltaDemanda').mockResolvedValueOnce({
      activa: true,
      minutos: 30,
      pausa: false,
      mensaje: 'activó Admin Test',
      activado_por: 'Admin Test',
    });

    render(
      <SeccionAltaDemanda
        estadoInicial={{
          activa: false,
          minutos: 0,
          pausa: false,
        }}
      />,
    );

    const botonActivar = screen.getByRole('button', {
      name: /Activar alta demanda \(\+30 min\)/i,
    });
    fireEvent.click(botonActivar);

    // Debe abrir el diálogo Confirmar
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('¿Activar la alta demanda?')).toBeInTheDocument();

    // Confirmar con Sí
    const botonSi = screen.getByRole('button', { name: /Sí, activar/i });
    fireEvent.click(botonSi);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith({
        activa: true,
        minutos: 30,
        pausa: false,
      });
    });

    expect(
      screen.getByText(/Alta demanda activada con \+30 min/i),
    ).toBeInTheDocument();
  });

  it('7. Apagar alta demanda quita minutos y pausa pidiendo confirmación Sí/No', async () => {
    const mockPut = vi.spyOn(cocinaApi, 'configurarAltaDemanda').mockResolvedValueOnce({
      activa: false,
      minutos: 0,
      pausa: false,
      mensaje: 'desactivó Admin Test',
      activado_por: 'Admin Test',
    });

    render(
      <SeccionAltaDemanda
        estadoInicial={{
          activa: true,
          minutos: 45,
          pausa: true,
          activado_por: 'Bebidas',
          desde: '2026-10-24T12:00:00.000Z',
        }}
      />,
    );

    expect(screen.getByTestId('insignia-estado')).toHaveTextContent(/ACTIVADA \(\+45 min, pedidos en pausa\)/i);

    const botonesApagar = screen.getAllByRole('button', { name: /Apagar alta demanda/i });
    fireEvent.click(botonesApagar[0]);

    // Modal de confirmación Sí/No
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('¿Apagar la alta demanda?')).toBeInTheDocument();
    expect(
      screen.getByText(/volverán al tiempo de entrega normal.*se eliminará cualquier pausa/i),
    ).toBeInTheDocument();

    // Cancelar primero con No
    const botonNo = screen.getByRole('button', { name: /No, cancelar/i });
    fireEvent.click(botonNo);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockPut).not.toHaveBeenCalled();

    // Abrir de nuevo y confirmar
    fireEvent.click(botonesApagar[0]);
    const botonSi = screen.getByRole('button', { name: /Sí, apagar/i });
    fireEvent.click(botonSi);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith({
        activa: false,
        minutos: 0,
        pausa: false,
      });
    });
  });

  it('8. Muestra quién lo cambió y cuándo con hora de Lima', async () => {
    render(
      <SeccionAltaDemanda
        estadoInicial={{
          activa: true,
          minutos: 20,
          pausa: false,
          activado_por: 'Kevin Rosales',
          desde: '2026-10-24T15:30:00.000Z',
        }}
      />,
    );

    const auditoria = screen.getByTestId('registro-auditoria');
    expect(auditoria).toHaveTextContent(/Kevin Rosales/i);
    expect(auditoria).toHaveTextContent(/24\/10\/2026/);
  });

  it('9. Se actualiza en tiempo real al recibir evento de Socket.IO cocina:alta-demanda', async () => {
    render(
      <SeccionAltaDemanda
        estadoInicial={{
          activa: false,
          minutos: 0,
          pausa: false,
        }}
      />,
    );

    expect(screen.getByTestId('insignia-estado')).toHaveTextContent(/Apagada/i);

    // Simular evento en vivo emitido por otra estación (ej. Cocina)
    expect(callbacksSocket['cocina:alta-demanda']).toBeDefined();
    const handler = callbacksSocket['cocina:alta-demanda'][0];

    handler({
      activa: true,
      minutos: 60,
      pausa: true,
      activado_por: 'Salados',
      desde: '2026-10-24T16:00:00.000Z',
    });

    await waitFor(() => {
      expect(screen.getByTestId('insignia-estado')).toHaveTextContent(/ACTIVADA \(\+60 min, pedidos en pausa\)/i);
    });
  });

  it('10. Muestra aviso de solo lectura y deshabilita botones cuando no tiene permisos', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '3', nombres: 'Mozo', rol: 'MOZO' },
      permisos: ['local/ver'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: (p: string) => p === 'local/ver',
    });

    render(
      <SeccionAltaDemanda
        puedeEditar={false}
        estadoInicial={{
          activa: false,
          minutos: 0,
          pausa: false,
        }}
      />,
    );

    expect(
      screen.getByText(/Modo de sólo lectura\. No tienes permisos para modificar/i),
    ).toBeInTheDocument();

    const botonActivar = screen.getByRole('button', { name: /Activar alta demanda/i });
    expect(botonActivar).toBeDisabled();
  });

  it('11. Integración en ConfiguracionLocalView: pestaña «Alta demanda y pausa de pedidos»', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/admin/local/datos') {
        return {
          nombre: 'Caprichos',
          direccion: 'Av. Principal 123',
          telefono: '999888777',
          whatsapp: '999888777',
          redes: { instagram: '', facebook: '', tiktok: '' },
        };
      }
      if (url === '/admin/cocina/alta-demanda') {
        return {
          activa: false,
          minutos: 0,
          pausa: false,
        };
      }
      return {};
    });

    render(
      <MemoryRouter initialEntries={['/admin/mirest']}>
        <ConfiguracionLocalView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Datos del local/i })).toBeInTheDocument();
    });

    const tabDemanda = screen.getByRole('tab', {
      name: /Alta demanda y pausa de pedidos/i,
    });
    fireEvent.click(tabDemanda);

    await waitFor(() => {
      expect(screen.getByText(/Paso 1: Minutos adicionales de espera/i)).toBeInTheDocument();
    });
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MensajesView } from '../MensajesView';
import * as api from '../mensajesApi';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));

const sesionMock = vi.hoisted(() => ({ permisos: [] as string[] }));
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ tiene: (p: string) => sesionMock.permisos.includes(p), usuario: { rol: 'SUPERVISOR' } }),
}));

const chat = (id: string, nombre: string, bloqueado: boolean) => ({
  id, nombre, telefono: `5199911${id}22`, identificador_tipo: 'TELEFONO' as const,
  estado: 'bot' as const, urgente: false, ultimo: 'Hola', hora: '10:00', sinLeer: 0, numeroBloqueado: bloqueado,
});

describe('Bloquear número en Mensajes', () => {
  let bloqueado = false;
  beforeEach(() => {
    bloqueado = false;
    sesionMock.permisos = ['mensajes/ver', 'mensajes/enviar', 'mensajes/bloquear_numeros'];
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([]);
    vi.spyOn(api, 'listarConversaciones').mockImplementation(async () => ({
      conteos: { todos: 1, atender: 0, bot: 1, atendidos: 0 },
      chats: [chat('1', 'Ana Pérez', bloqueado)],
    }) as any);
    vi.spyOn(api, 'obtenerDetalleConversacion').mockImplementation(async () => ({
      id: '1', nombre: 'Ana Pérez', telefono: '51999111122', estado: 'bot', urgente: false, mensajes: [], numeroBloqueado: bloqueado,
    }) as any);
  });
  afterEach(() => vi.restoreAllMocks());

  it('Bloquear: pide confirmación Sí/No con motivo opcional y llama al endpoint', async () => {
    const llamada = vi.spyOn(api, 'bloquearNumero').mockImplementation(async () => {
      bloqueado = true;
      return { ok: true };
    });
    render(<MensajesView />);
    const btn = await screen.findByTestId('btn-bloquear-numero');
    expect(btn.textContent).toContain('Bloquear este número');
    fireEvent.click(btn);
    fireEvent.click(screen.getByRole('button', { name: 'No, cancelar' }));
    expect(llamada).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('btn-bloquear-numero'));
    fireEvent.change(screen.getByLabelText('Motivo del bloqueo (opcional)'), { target: { value: 'Molesta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, bloquear' }));
    await waitFor(() => expect(llamada).toHaveBeenCalledWith('51999111122', 'Molesta'));
    // tras refrescar: insignia con texto en el chat y en la lista, y botón Desbloquear
    expect((await screen.findByTestId('numero-bloqueado-detalle-1')).textContent).toBe('Número bloqueado');
    expect(screen.getByTestId('numero-bloqueado-1')).toBeTruthy();
    expect((await screen.findByTestId('btn-bloquear-numero')).textContent).toBe('Desbloquear número');
  });

  it('Desbloquear llama al endpoint tras confirmar', async () => {
    bloqueado = true;
    const llamada = vi.spyOn(api, 'desbloquearNumero').mockResolvedValue({ ok: true });
    render(<MensajesView />);
    fireEvent.click(await screen.findByTestId('btn-bloquear-numero'));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, desbloquear' }));
    await waitFor(() => expect(llamada).toHaveBeenCalledWith('51999111122'));
  });

  it('sin el permiso no aparece el botón', async () => {
    sesionMock.permisos = ['mensajes/ver', 'mensajes/enviar'];
    render(<MensajesView />);
    await screen.findAllByText('Ana Pérez');
    await waitFor(() => expect(api.obtenerDetalleConversacion).toHaveBeenCalled());
    expect(screen.queryByTestId('btn-bloquear-numero')).toBeNull();
  });
});

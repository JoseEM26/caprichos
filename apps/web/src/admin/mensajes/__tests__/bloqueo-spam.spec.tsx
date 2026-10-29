import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MensajesView } from '../MensajesView';
import { InsigniaBloqueoSpam, horaHasta } from '../BloqueoSpam';
import * as api from '../mensajesApi';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));

const sesionMock = vi.hoisted(() => ({ permisos: ['mensajes/ver', 'mensajes/enviar'] as string[] }));
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ tiene: (p: string) => sesionMock.permisos.includes(p), usuario: { rol: 'CAJERO' } }),
}));

const enUnaHora = new Date(Date.now() + 3600_000).toISOString();
const chat = (id: string, nombre: string, bloqueo: any) => ({
  id, nombre, telefono: `5199911${id}22`, identificador_tipo: 'TELEFONO' as const,
  estado: 'bot' as const, urgente: false, ultimo: 'Hola', hora: '10:00', sinLeer: 0, bloqueoSpam: bloqueo,
});
const bloqueado = { activo: true, hastaEn: enUnaHora, reincidente: false };

describe('Bloqueo por spam en Mensajes', () => {
  beforeEach(() => {
    sesionMock.permisos = ['mensajes/ver', 'mensajes/enviar'];
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([]);
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue({
      conteos: { todos: 2, atender: 0, bot: 2, atendidos: 0, bloqueadosSpam: 1 },
      chats: [chat('1', 'Ana Pérez', bloqueado), chat('2', 'Luis Rojas', { activo: false, hastaEn: null, reincidente: false })],
    });
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue({
      id: '1', nombre: 'Ana Pérez', telefono: '51999111122', estado: 'bot', urgente: false, mensajes: [], bloqueoSpam: bloqueado,
    } as any);
  });
  afterEach(() => vi.restoreAllMocks());

  it('insignia ámbar con la hora en la fila y en el encabezado; solo en el chat bloqueado', async () => {
    render(<MensajesView />);
    const insignia = await screen.findByTestId('bloqueo-spam-1');
    expect(insignia.textContent).toMatch(/Bloqueado por spam · hasta \d{2}:\d{2}/);
    expect(await screen.findByTestId('bloqueo-spam-detalle-1')).toBeTruthy();
    expect(screen.queryByTestId('bloqueo-spam-2')).toBeNull();
  });

  it('chip «Bloqueados por spam (1)» deja solo los bloqueados', async () => {
    render(<MensajesView />);
    const chip = await screen.findByTestId('filtro-bloqueados-spam');
    expect(chip.textContent).toContain('Bloqueados por spam (1)');
    fireEvent.click(chip);
    await waitFor(() => expect(screen.queryByText('Luis Rojas')).toBeNull());
    expect(screen.getAllByText('Ana Pérez').length).toBeGreaterThan(0);
  });

  it('Desbloquear exige motivo de 5+ caracteres, confirma Sí/No, llama al endpoint y refresca', async () => {
    const llamada = vi.spyOn(api, 'desbloquearSpam').mockResolvedValue({ ok: true });
    render(<MensajesView />);
    fireEvent.click(await screen.findByTestId('btn-desbloquear-spam'));
    const si = screen.getByRole('button', { name: 'Sí, desbloquear' }) as HTMLButtonElement;
    expect(si.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Motivo del desbloqueo'), { target: { value: 'ok' } });
    expect(si.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Motivo del desbloqueo'), { target: { value: 'Es un cliente real' } });
    expect(si.disabled).toBe(false);
    const antes = vi.mocked(api.listarConversaciones).mock.calls.length;
    fireEvent.click(si);
    await waitFor(() => expect(llamada).toHaveBeenCalledWith('1', 'Es un cliente real'));
    await waitFor(() => expect(vi.mocked(api.listarConversaciones).mock.calls.length).toBeGreaterThan(antes));
  });

  it('«No, cancelar» cierra la ventana sin llamar', async () => {
    const llamada = vi.spyOn(api, 'desbloquearSpam');
    render(<MensajesView />);
    fireEvent.click(await screen.findByTestId('btn-desbloquear-spam'));
    fireEvent.click(screen.getByRole('button', { name: 'No, cancelar' }));
    expect(screen.queryByRole('dialog', { name: 'Desbloquear chat' })).toBeNull();
    expect(llamada).not.toHaveBeenCalled();
  });

  it('sin permiso mensajes/enviar no se ofrece Desbloquear', async () => {
    sesionMock.permisos = ['mensajes/ver'];
    render(<MensajesView />);
    await screen.findByTestId('bloqueo-spam-detalle-1');
    expect(screen.queryByTestId('btn-desbloquear-spam')).toBeNull();
  });

  it('una marca vencida o inactiva no se muestra', () => {
    const { container, rerender } = render(<InsigniaBloqueoSpam id="9" bloqueo={{ activo: true, hastaEn: new Date(Date.now() - 1000).toISOString(), reincidente: false }} />);
    expect(container.firstChild).toBeNull();
    rerender(<InsigniaBloqueoSpam id="9" bloqueo={null} />);
    expect(container.firstChild).toBeNull();
    expect(horaHasta(null)).toBe('');
  });
});

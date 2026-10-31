import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import { TarjetaNotificacionesConfiguracion } from '../TarjetaNotificacionesConfiguracion';

const ajustes = { sonidoActivo: true, sonidoIntervaloSeg: 15, sonidoAlcance: 'TODOS_NO_LEIDOS', marcarTodasActivo: true };

function sesionCon(rol: string) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Admin', rol },
    permisos: [],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: vi.fn().mockReturnValue(true),
  } as any);
}

function montar(rol = 'ADMIN') {
  sesionCon(rol);
  vi.spyOn(api, 'get').mockResolvedValue({ conteos: {}, notificaciones: [], ajustes });
  return render(
    <MemoryRouter>
      <TarjetaNotificacionesConfiguracion />
    </MemoryRouter>,
  );
}

describe('Configuración › Notificaciones', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el intervalo configurado (15 s) con sugerencias 15, 30 y 60', async () => {
    montar();
    const intervalo = (await screen.findByLabelText('Cada cuántos segundos suena')) as HTMLInputElement;
    expect(intervalo.value).toBe('15');
    expect(screen.getByRole('button', { name: '30 s' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '60 s' })).toBeInTheDocument();
  });

  it('cambiar el intervalo pide confirmación y guarda el valor numérico', async () => {
    montar();
    await screen.findByLabelText('Cada cuántos segundos suena');
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    fireEvent.click(screen.getByRole('button', { name: '30 s' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar notificaciones' }));
    expect(put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/admin/configuracion/notif_sonido_intervalo_seg', { valor: 30 }),
    );
  });

  it('un intervalo fuera de 5..600 no se puede guardar y lo dice', async () => {
    montar();
    const intervalo = await screen.findByLabelText('Cada cuántos segundos suena');
    fireEvent.change(intervalo, { target: { value: '3' } });
    expect(screen.getByText(/entero entre 5 y 600 segundos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar notificaciones' })).toBeDisabled();
  });

  it('el alcance y el botón «Marcar todas» se guardan con su clave', async () => {
    montar();
    await screen.findByLabelText('Cada cuántos segundos suena');
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    fireEvent.change(screen.getByLabelText('Qué avisos hacen sonar'), { target: { value: 'SOLO_URGENTES' } });
    fireEvent.change(screen.getByLabelText('Botón «Marcar todas leídas»'), { target: { value: 'no' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar notificaciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => {
      expect(put).toHaveBeenCalledWith('/admin/configuracion/notif_sonido_alcance', { valor: 'SOLO_URGENTES' });
      expect(put).toHaveBeenCalledWith('/admin/configuracion/notif_marcar_todas_activo', { valor: false });
    });
  });

  it('quien no es ADMIN ve los ajustes sin poder cambiarlos', async () => {
    montar('CAJERO');
    const intervalo = await screen.findByLabelText('Cada cuántos segundos suena');
    expect(intervalo).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Guardar notificaciones' })).toBeNull();
  });
});

import { render, screen, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { AdminShell } from '../AdminShell';

const rol = vi.hoisted(() => ({ valor: 'ADMIN' as string }));

vi.mock('../../comun/sesion', () => ({
  useSesion: () => ({
    usuario: { id: 'u1', nombres: 'Admin Caprichos', rol: rol.valor },
    salir: vi.fn(),
    tiene: () => true,
    cargando: false,
    autenticado: true,
  }),
}));

const resumenPrueba = vi.hoisted(() => ({
  valor: {
    notificaciones: [] as any[],
    conteos: {} as Record<string, number>,
    cargado: true,
    refrescar: vi.fn(async () => {}),
    marcar: vi.fn(async () => true),
    ajustes: undefined as any,
  },
}));

vi.mock('../useNotificaciones', () => ({
  useNotificaciones: () => resumenPrueba.valor,
}));

vi.mock('../notificaciones/notificacionesApi', () => ({
  marcarNotificacion: vi.fn(async () => ({ ok: true })),
  marcarTodasNotificacionesLeidas: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../ayuda/ayudaApi', () => ({
  obtenerContextoAyuda: vi.fn(async () => ({ activo: false, sugerencias: [], enlaces: [] })),
  enviarPreguntaAyuda: vi.fn(),
}));

const avisoReservas = (leida: boolean) => ({
  id: 'reservas',
  clave: 'c:reservas:abc123abc123',
  titulo: '2 solicitudes de reserva por revisar',
  detalle: 'Reservas pedidas por WhatsApp que esperan aprobación.',
  prioridad: 'ALTA',
  desde: new Date().toISOString(),
  modulo: 'reservas',
  accion: 'Ir a Reservas',
  leida,
  leidaEn: leida ? new Date().toISOString() : null,
});

function montar() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <AdminShell />
    </MemoryRouter>,
  );
}

/** La entrada «Reservas» del menú lateral (su botón contiene el nombre y la insignia). */
const entradaReservas = () => screen.getAllByRole('button', { name: /^Reservas( \d+)?$/ })[0];

describe('Reservas que parpadean en el menú', () => {
  beforeEach(() => {
    rol.valor = 'ADMIN';
    resumenPrueba.valor = {
      notificaciones: [],
      conteos: {},
      cargado: true,
      refrescar: vi.fn(async () => {}),
      marcar: vi.fn(async () => true),
      ajustes: undefined,
    };
  });

  it('con reservas sin atender, la insignia de Reservas parpadea con su número', async () => {
    resumenPrueba.valor.conteos = { reservas: 2 };
    resumenPrueba.valor.notificaciones = [avisoReservas(false)];
    await act(async () => {
      montar();
    });
    const insignia = within(entradaReservas()).getByText('2');
    expect(insignia).toHaveClass('cp-parpadea-insignia');
  });

  it('con cero reservas pendientes no hay insignia ni parpadeo', async () => {
    resumenPrueba.valor.conteos = { reservas: 0 };
    await act(async () => {
      montar();
    });
    expect(within(entradaReservas()).queryByText(/^\d+$/)).toBeNull();
    expect(document.querySelector('.cp-parpadea-insignia')).toBeNull();
  });

  it('si alguien ya marcó el aviso de reservas como leído, deja de parpadear', async () => {
    resumenPrueba.valor.conteos = { reservas: 2 };
    resumenPrueba.valor.notificaciones = [avisoReservas(true)];
    await act(async () => {
      montar();
    });
    expect(document.querySelector('.cp-parpadea-insignia')).toBeNull();
  });

  it('la fila de reservas de la campanita también parpadea mientras no esté leída', async () => {
    resumenPrueba.valor.conteos = { reservas: 2 };
    resumenPrueba.valor.notificaciones = [avisoReservas(false)];
    await act(async () => {
      montar();
    });
    await act(async () => {
      screen.getByRole('button', { name: /Notificaciones: 1 sin leer/ }).click();
    });
    const dialogo = screen.getByRole('dialog', { name: 'Notificaciones' });
    const fila = within(dialogo).getByText('2 solicitudes de reserva por revisar').closest('.cp-parpadea-fila');
    expect(fila).not.toBeNull();
  });

  it('con «Marcar todas» apagado, la campanita no muestra el botón', async () => {
    resumenPrueba.valor.conteos = { caja: 1 };
    resumenPrueba.valor.notificaciones = [{ ...avisoReservas(false), id: '9', clave: 'n:9', modulo: 'caja', titulo: 'Pedido por cobrar' }];
    resumenPrueba.valor.ajustes = { sonidoActivo: true, sonidoIntervaloSeg: 15, sonidoAlcance: 'TODOS_NO_LEIDOS', marcarTodasActivo: false };
    await act(async () => {
      montar();
    });
    await act(async () => {
      screen.getByRole('button', { name: /Notificaciones: 1 sin leer/ }).click();
    });
    expect(screen.queryByRole('button', { name: 'Marcar todas leídas' })).toBeNull();
  });

  it('el parpadeo queda sin animación con prefers-reduced-motion (solo contorno fuerte)', () => {
    const css = readFileSync(resolve(__dirname, '../notificaciones/parpadeo-reservas.css'), 'utf8');
    const bloque = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(bloque).toMatch(/animation:\s*none/);
    expect(bloque).toMatch(/outline:\s*2px solid var\(--cp-orange\)/);
  });
});

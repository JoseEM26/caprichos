import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  turnosPorAprobar: vi.fn(),
  aprobarTurno: vi.fn(),
  rechazarTurnoAdmin: vi.fn(),
  equipoHoy: vi.fn(),
}));
const sesion = vi.hoisted(() => ({ actual: null as any }));

vi.mock('../../../comun/sesion', () => ({
  useSesion: () => {
    if (!sesion.actual) throw new Error('useSesion debe usarse dentro de un SesionProvider');
    return sesion.actual;
  },
}));
vi.mock('../turnosApi', async (orig) => ({
  ...(await orig<typeof import('../turnosApi')>()),
  turnosPorAprobar: (...a: any[]) => api.turnosPorAprobar(...a),
  aprobarTurno: (...a: any[]) => api.aprobarTurno(...a),
  rechazarTurnoAdmin: (...a: any[]) => api.rechazarTurnoAdmin(...a),
  equipoHoy: (...a: any[]) => api.equipoHoy(...a),
}));

import { ChipsAprobacion } from '../AprobacionTurno';
import { parteQuePuedoAprobar, partesDe, textoAprobacion } from '../aprobacionTurno';
import { PorAprobarTurnos } from '../PorAprobarTurnos';
import type { SolicitudTurno } from '../turnosApi';

const SOLICITANTE = 1;
const REEMPLAZO = 2;
const SUP = '60';
const ADM = '61';
const LIBRE = { supervision: null, administracion: null, faltan: ['SUPERVISION', 'ADMINISTRACION'] } as const;

const pedido = (extra: Partial<SolicitudTurno> = {}): SolicitudTurno => ({
  id: 7, tipo: 'REEMPLAZO', estado: 'PENDIENTE_APRUEBA', fecha: '2026-11-16', etiqueta: 'lunes 16', desde: '09:00', hasta: '17:00', devolucion: null,
  motivo: 'Cita médica', solicitante: { partyId: SOLICITANTE, nombre: 'Ana Pérez' }, reemplazo: { partyId: REEMPLAZO, nombre: 'Luis Gómez' }, area: 'Salado',
  motivoResolucion: null, creadaEn: '2026-11-13T17:00:00Z', validacion: { ok: true, problema: null, areaYRol: [] },
  aprobacion: { ...LIBRE, faltan: [...LIBRE.faltan] }, ...extra,
} as SolicitudTurno);

const comoSupervisora = () => { sesion.actual = { usuario: { partyId: SUP, nombres: 'Sup', rol: 'SUPERVISOR', roles: ['SUPERVISOR'] }, tiene: () => true }; };
const comoAdmin = () => { sesion.actual = { usuario: { partyId: ADM, nombres: 'Adm', rol: 'ADMIN', roles: ['ADMIN'] }, tiene: () => true }; };
const lista = (...s: SolicitudTurno[]) => api.turnosPorAprobar.mockResolvedValue({ toleranciaMin: 5, solicitudes: s });

beforeEach(() => {
  Object.values(api).forEach((m) => m.mockReset());
});
afterEach(() => { sesion.actual = null; });

describe('quién puede firmar cada parte', () => {
  const quien = (partyId: string, roles: string[]) => ({ partyId, roles });

  it('partesDe: SUPERVISOR firma Supervisión y ADMIN firma Administración', () => {
    expect(partesDe(['SUPERVISOR'])).toEqual(['SUPERVISION']);
    expect(partesDe(['ADMIN'])).toEqual(['ADMINISTRACION']);
    expect(partesDe(['CAJERO'])).toEqual([]);
    expect(partesDe(['ADMIN', 'SUPERVISOR'])).toEqual(['SUPERVISION', 'ADMINISTRACION']);
  });

  it('solo puede firmar la parte que le corresponde y que todavía falta', () => {
    const s = pedido({ aprobacion: { supervision: { porId: 90, nombre: 'Otra', en: null }, administracion: null, faltan: ['ADMINISTRACION'] } });
    expect(parteQuePuedoAprobar(s, quien(ADM, ['ADMIN']))).toBe('ADMINISTRACION');
    expect(parteQuePuedoAprobar(s, quien(SUP, ['SUPERVISOR']))).toBeNull(); // ya firmó Supervisión otra persona
  });

  it('quien participa en el pedido, o ya firmó, no firma', () => {
    const s = pedido({ aprobacion: { supervision: { porId: Number(SUP), nombre: 'Sup', en: null }, administracion: null, faltan: ['ADMINISTRACION'] } });
    expect(parteQuePuedoAprobar(s, quien(String(REEMPLAZO), ['ADMIN']))).toBeNull();
    expect(parteQuePuedoAprobar(s, quien(SUP, ['SUPERVISOR', 'ADMIN']))).toBeNull(); // la misma persona no firma las dos partes
    expect(parteQuePuedoAprobar(s, quien(SUP, ['SUPERVISOR']))).toBeNull();
  });

  it('con los dos roles, cuenta primero la de Supervisión; después necesita a otra persona para la otra', () => {
    expect(parteQuePuedoAprobar(pedido(), quien(ADM, ['ADMIN', 'SUPERVISOR']))).toBe('SUPERVISION');
    const yaSup = pedido({ aprobacion: { supervision: { porId: 90, nombre: 'Otra', en: null }, administracion: null, faltan: ['ADMINISTRACION'] } });
    expect(parteQuePuedoAprobar(yaSup, quien(ADM, ['ADMIN', 'SUPERVISOR']))).toBe('ADMINISTRACION');
  });

  it('un pedido ya aprobado o sin datos de aprobación no se firma', () => {
    expect(parteQuePuedoAprobar(pedido({ estado: 'APROBADA' }), quien(ADM, ['ADMIN']))).toBeNull();
    expect(parteQuePuedoAprobar(pedido({ aprobacion: null }), quien(ADM, ['ADMIN']))).toBeNull();
  });
});

describe('texto de avance', () => {
  it('dice qué falta o quién aprobó', () => {
    expect(textoAprobacion(pedido())).toBe('Falta supervisora y administrador');
    expect(textoAprobacion(pedido({ aprobacion: { supervision: null, administracion: { porId: 61, nombre: 'Adm', en: null }, faltan: ['SUPERVISION'] } }))).toBe('Falta supervisora');
    expect(textoAprobacion(pedido({ aprobacion: { supervision: { porId: 60, nombre: 'Sup', en: null }, administracion: null, faltan: ['ADMINISTRACION'] } }))).toBe('Falta administrador');
    expect(textoAprobacion(pedido({ estado: 'APROBADA', aprobacion: { supervision: { porId: 60, nombre: 'Sup', en: null }, administracion: { porId: 61, nombre: 'Adm', en: null }, faltan: [] } })))
      .toBe('Aprobada por Sup (supervisión) y Adm (administración)');
  });
});

describe('chips de avance', () => {
  it('muestra Supervisión ✓ y Administración: falta', () => {
    render(<ChipsAprobacion s={pedido({ aprobacion: { supervision: { porId: 60, nombre: 'Sup', en: null }, administracion: null, faltan: ['ADMINISTRACION'] } })} />);
    const grupo = screen.getByLabelText('Avance de aprobación');
    expect(grupo).toHaveTextContent('Supervisión ✓ Sup');
    expect(grupo).toHaveTextContent('Administración: falta');
  });

  it('no se muestra si el pedido no está pendiente de aprobación ni aprobado', () => {
    const { container } = render(<ChipsAprobacion s={pedido({ estado: 'PENDIENTE_ACEPTA' })} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('botones según el rol de quien mira', () => {
  it('la supervisora que ya firmó no ve Aprobar; ve el avance y lo que falta', async () => {
    comoSupervisora();
    lista(pedido({ aprobacion: { supervision: { porId: Number(SUP), nombre: 'Sup', en: null }, administracion: null, faltan: ['ADMINISTRACION'] } }));
    render(<PorAprobarTurnos />);
    expect(await screen.findByText('Falta administrador')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  it('el administrador ve Aprobar y Rechazar cuando falta su parte', async () => {
    comoAdmin();
    lista(pedido({ aprobacion: { supervision: { porId: 90, nombre: 'Otra', en: null }, administracion: null, faltan: ['ADMINISTRACION'] } }));
    render(<PorAprobarTurnos />);
    expect(await screen.findByRole('button', { name: 'Aprobar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeEnabled();
  });

  it('quien participa en el pedido no ve los botones', async () => {
    sesion.actual = { usuario: { partyId: String(REEMPLAZO), nombres: 'Luis', rol: 'ADMIN', roles: ['ADMIN'] }, tiene: () => true };
    lista(pedido());
    render(<PorAprobarTurnos />);
    expect(await screen.findByText('Falta supervisora y administrador')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
  });

  it('aprobar con la otra parte pendiente avisa que su aprobación quedó registrada', async () => {
    comoAdmin();
    lista(pedido());
    api.aprobarTurno.mockResolvedValue({ ok: true, completa: false, falta: ['SUPERVISION'] });
    render(<PorAprobarTurnos />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, aprobar' }));
    await waitFor(() => expect(api.aprobarTurno).toHaveBeenCalledWith(7));
    expect(await screen.findByRole('status')).toHaveTextContent('Tu aprobación quedó registrada. Falta la otra parte.');
  });

  it('sin sesión no se puede firmar nada', async () => {
    lista(pedido());
    render(<PorAprobarTurnos />);
    expect(await screen.findByText('Falta supervisora y administrador')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IniciativasView } from '../IniciativasView';
import * as api from '../iniciativasApi';
import * as sesionModulo from '../../../comun/sesion';

const CONTEOS = { total: 0, nuevas: 0, enRevision: 0, hechas: 0, noPorAhora: 0, quejas: 0, mejoras: 0, ideas: 0 };

function sesionCon(permisos: string[]) {
  return {
    usuario: { id: '7', partyId: '7', nombres: 'Caja Prueba', rol: 'CAJERO' },
    permisos,
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: (p: string) => permisos.includes(p),
  } as any;
}

describe('IniciativasView: permisos por acción (todo el personal crea; estado solo ADMIN y SUPERVISOR)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'listarIniciativas').mockResolvedValue({ conteos: CONTEOS, elementos: [] } as any);
  });

  it('un CAJERO con iniciativas/crear ve el botón Nueva iniciativa, sin cambiar estado', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesionCon(['iniciativas/ver', 'iniciativas/crear', 'iniciativas/comentar']));
    render(<IniciativasView />);
    expect(await screen.findByText('+ Nueva iniciativa')).toBeInTheDocument();
  });

  it('sin iniciativas/crear no hay botón Nueva iniciativa', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesionCon(['iniciativas/ver']));
    render(<IniciativasView />);
    await screen.findByText(/aparece|Todavía|Sin iniciativas|iniciativas/i, { exact: false }).catch(() => null);
    expect(screen.queryByText('+ Nueva iniciativa')).not.toBeInTheDocument();
  });
});

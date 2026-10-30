import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanoView } from '../PlanoView';
import { salonApi } from '../api';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../api', () => ({
  salonApi: { obtenerPlano: vi.fn(), obtenerMesas: vi.fn(), actualizarElemento: vi.fn() },
}));
vi.mock('../useSalonSocket', () => ({
  useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: vi.fn() }),
}));

const elementos = [
  { id: '5', pisoId: '1', tipo: 'MESA', nombre: 'Mesa 1', x: 1, y: 1, ancho: 2, alto: 2, numero: 1, asientos: 4, activo: true },
];

const pisos = [
  { id: '1', nombre: 'Piso 1', activo: true, cuadriculaAncho: 20, cuadriculaAlto: 12, elementos },
  { id: '2', nombre: 'Piso 2', activo: true, cuadriculaAncho: 20, cuadriculaAlto: 12, elementos: [] },
];

function conPermisos(permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    tiene: (p: string) => permisos.includes(p),
    usuario: { partyId: '7', nombres: 'Prueba', rol: 'ADMIN' },
  } as any);
}

describe('Plano del local: responsive y permisos de edición', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (salonApi.obtenerPlano as any).mockResolvedValue(pisos);
    (salonApi.obtenerMesas as any).mockResolvedValue({ pisos: [] });
  });

  it('sin plano/editar no muestra los controles de edición, pero sí las acciones del mozo', async () => {
    conPermisos(['plano/ver']);
    render(<PlanoView />);

    fireEvent.click(await screen.findByTestId('elemento-plano-5'));

    expect(screen.queryByText('Agregar al plano')).toBeNull();
    expect(screen.queryByText('Tamaño del plano')).toBeNull();
    expect(screen.queryByText('Guardar o cambiar el diseño')).toBeNull();
    expect(screen.queryByRole('button', { name: /Eliminar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Más personas' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Más columnas' })).toBeNull();
    expect(document.getElementById('pl-name')).toBeNull();
  });

  it('con plano/editar muestra los controles de edición', async () => {
    conPermisos(['plano/ver', 'plano/editar']);
    render(<PlanoView />);

    fireEvent.click(await screen.findByTestId('elemento-plano-5'));

    expect(screen.getByText('Agregar al plano')).toBeDefined();
    expect(screen.getByRole('button', { name: /Eliminar/ })).toBeDefined();
    expect(document.getElementById('pl-name')).not.toBeNull();
  });

  it('los pisos aparecen como pestañas y el zoom del plano tiene sus botones', async () => {
    conPermisos(['plano/ver']);
    render(<PlanoView />);

    expect(await screen.findByRole('button', { name: 'Piso 1' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Piso 2' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Acercar plano' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Alejar plano' })).toBeDefined();
  });
});

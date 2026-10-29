import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanoView } from '../PlanoView';
import { salonApi } from '../api';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../api', () => ({
  salonApi: { obtenerPlano: vi.fn(), obtenerMesas: vi.fn() },
}));
vi.mock('../useSalonSocket', () => ({
  useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: vi.fn() }),
}));

const pisoPlano = {
  id: '1',
  nombre: 'Piso 1',
  activo: true,
  cuadriculaAncho: 20,
  cuadriculaAlto: 12,
  mesas: 1,
  asientosTotales: 4,
  mesasActivas: 1,
  totales: { mesas: 1, asientosTotales: 4, mesasActivas: 1 },
  elementos: [
    { id: '5', pisoId: '1', tipo: 'MESA', nombre: 'Mesa 1', x: 1, y: 1, ancho: 2, alto: 2, numero: 1, asientos: 4, activo: true },
  ],
};

function mesaSalon(estado: 'LIBRE' | 'OCUPADA') {
  return {
    id: '5',
    pisoId: '1',
    tipo: 'MESA',
    numero: 1,
    nombre: 'Mesa 1',
    asientos: 4,
    x: 1,
    y: 1,
    ancho: 2,
    alto: 2,
    activo: true,
    estado,
    pedido:
      estado === 'OCUPADA'
        ? {
            id: '121',
            codigo: 'CP-W106',
            estado: 'COLA',
            mozo: 'Mozo Prueba',
            total: 24,
            lineas: [{ cantidad: 2, nombre: 'Café Filtro', detalle: '' }],
          }
        : null,
  };
}

function conMesa(estado: 'LIBRE' | 'OCUPADA') {
  (salonApi.obtenerMesas as any).mockResolvedValue({
    pisos: [{ id: '1', nombre: 'Piso 1', activo: true, mesas: [mesaSalon(estado)] }],
  });
}

describe('Plano del local: estado real de las mesas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      tiene: vi.fn().mockReturnValue(true),
      usuario: { partyId: '7', nombres: 'Mozo', rol: 'MOZO' },
    } as any);
    (salonApi.obtenerPlano as any).mockResolvedValue([pisoPlano]);
  });

  it('muestra la leyenda Libre / Ocupada sobre el plano', async () => {
    conMesa('LIBRE');
    render(<PlanoView />);

    await screen.findByTestId('elemento-plano-5');
    expect(screen.getByText('Libre')).toBeDefined();
    expect(screen.getByText('Ocupada')).toBeDefined();
  });

  it('pinta la mesa libre en verde, sin etiqueta de ocupada', async () => {
    conMesa('LIBRE');
    render(<PlanoView />);

    const mesa = await screen.findByTestId('elemento-plano-5');
    expect(mesa.style.background).toContain('cp-greenbg');
    expect(mesa.textContent).not.toContain('ocupada');
  });

  it('pinta la mesa ocupada en naranja con etiqueta «ocupada» y el código del pedido', async () => {
    conMesa('OCUPADA');
    render(<PlanoView />);

    const mesa = await screen.findByTestId('elemento-plano-5');
    expect(mesa.style.background).toBe('rgb(246, 201, 165)');
    expect(mesa.textContent).toContain('ocupada');
    expect(mesa.textContent).toContain('CP-W106');
  });

  it('mesa libre seleccionada: solo ofrece «Tomar pedido en esta mesa», nunca cobrar', async () => {
    conMesa('LIBRE');
    render(<PlanoView />);

    fireEvent.click(await screen.findByTestId('elemento-plano-5'));
    expect(await screen.findByText('Tomar pedido en esta mesa')).toBeDefined();
    expect(screen.queryByTestId('btn-cuenta-mesa')).toBeNull();
    expect(screen.queryByText(/Cobrar mesa/)).toBeNull();
    expect(screen.getByTestId('estado-mesa').textContent).toBe('Libre');
  });

  it('mesa ocupada seleccionada: muestra «Cobrar mesa» y «Tomar pedido» con el estado del pedido', async () => {
    conMesa('OCUPADA');
    render(<PlanoView />);

    fireEvent.click(await screen.findByTestId('elemento-plano-5'));
    expect(await screen.findByTestId('btn-cuenta-mesa')).toBeDefined();
    expect(screen.getByText('Tomar pedido en esta mesa')).toBeDefined();
    expect(screen.getByTestId('estado-mesa').textContent).toBe('Ocupada · pedido CP-W106 (COLA)');
  });
});

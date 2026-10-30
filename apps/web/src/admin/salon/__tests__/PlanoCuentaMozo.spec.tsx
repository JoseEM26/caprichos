import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlanoView } from '../PlanoView';
import { salonApi } from '../api';
import { vouchersApi } from '../../vouchers/vouchersApi';
import * as sesionModulo from '../../../comun/sesion';

// El mozo ve la cuenta de una mesa ocupada en el plano y la envía a Caja (no la cobra)
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

const pisosSalon = [
  {
    id: '1',
    nombre: 'Piso 1',
    activo: true,
    mesas: [
      {
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
        estado: 'OCUPADA',
        pedido: {
          id: '121',
          codigo: 'CP-W106',
          mozo: 'Mozo Prueba',
          total: 24,
          lineas: [{ cantidad: 2, nombre: 'Café Filtro', detalle: '' }],
        },
      },
    ],
  },
];

describe('Plano del mozo: cuenta de la mesa ocupada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      tiene: vi.fn().mockReturnValue(true),
      usuario: { partyId: '7', nombres: 'Mozo', rol: 'MOZO' },
    } as any);
    (salonApi.obtenerPlano as any).mockResolvedValue([pisoPlano]);
    (salonApi.obtenerMesas as any).mockResolvedValue({ pisos: pisosSalon });
  });

  it('mesa ocupada: el mozo envía la cuenta a Caja con Sí/No y sin cobrar', async () => {
    const enviar = vi.spyOn(vouchersApi, 'enviarACaja').mockResolvedValue({ ok: true });
    render(<PlanoView />);

    const mesa = await screen.findByTestId('elemento-plano-5');
    fireEvent.click(mesa);
    fireEvent.click(await screen.findByTestId('btn-cuenta-mesa'));

    expect(screen.getByRole('dialog', { name: 'Precuenta' })).toBeDefined();
    expect(screen.queryByTestId('btn-confirmar-cobro-mozo')).toBeNull();

    fireEvent.click(screen.getByTestId('btn-enviar-caja'));
    fireEvent.click(screen.getByText('Sí, enviar a Caja'));

    await waitFor(() => {
      expect(enviar).toHaveBeenCalledWith('121', 'EFECTIVO', [{ medio: 'EFECTIVO', monto: 24 }]);
    });
    expect(await screen.findByTestId('aviso-enviado-caja')).toBeDefined();
  });

  it('mesa libre: no ofrece cobrar la cuenta', async () => {
    (salonApi.obtenerMesas as any).mockResolvedValue({
      pisos: [{ ...pisosSalon[0], mesas: [{ ...pisosSalon[0].mesas[0], estado: 'LIBRE', pedido: null }] }],
    });
    render(<PlanoView />);

    fireEvent.click(await screen.findByTestId('elemento-plano-5'));
    await screen.findByText('Tomar pedido en esta mesa');
    expect(screen.queryByTestId('btn-cuenta-mesa')).toBeNull();
  });
});

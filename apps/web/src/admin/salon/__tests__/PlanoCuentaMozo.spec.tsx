import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PlanoView } from '../PlanoView';
import { salonApi } from '../api';
import { vouchersApi } from '../../vouchers/vouchersApi';
import * as sesionModulo from '../../../comun/sesion';

/** Con efectivo en el plan, «¿Con cuánto paga?» es obligatorio: lo escribe el mozo antes de enviar. */
const llenarPagaCon = () => {
  const campo = screen.queryByPlaceholderText(/^Mínimo S\/|^Obligatorio$/);
  if (campo) fireEvent.change(campo, { target: { value: '100' } });
};


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

    fireEvent.click(screen.getByTestId('comprobante-BOLETA'));
    llenarPagaCon();
    fireEvent.click(screen.getByTestId('btn-enviar-caja'));
    fireEvent.click(screen.getByText('Sí, enviar a Caja'));

    await waitFor(() => {
      expect(enviar).toHaveBeenCalledWith('121', 'EFECTIVO', [{ medio: 'EFECTIVO', monto: 24 }], expect.anything());
    });
    expect(await screen.findByTestId('aviso-enviado-caja')).toBeDefined();
  });

  it('mesa ocupada: en la mesa se ven el cliente (o el mozo si no hay) y la cantidad de productos', async () => {
    render(<PlanoView />);
    const resumen = await screen.findByTestId('resumen-mesa-5');
    expect(resumen.textContent).toBe('Mozo Prueba · 2 prod.');
  });

  it('mesa ocupada: con cliente, la mesa muestra su nombre y al tocarla la tarjeta con líneas y total', async () => {
    const mesa = pisosSalon[0].mesas[0];
    (salonApi.obtenerMesas as any).mockResolvedValue({
      pisos: [
        {
          ...pisosSalon[0],
          mesas: [
            {
              ...mesa,
              pedido: {
                ...mesa.pedido,
                cliente: 'Ana',
                total: 24,
                estado: 'COLA',
                lineas: [
                  { cantidad: 2, nombre: 'Café Filtro', detalle: '' },
                  { cantidad: 1, nombre: 'Limonada', detalle: 'Sin azúcar' },
                ],
              },
            },
          ],
        },
      ],
    });
    render(<PlanoView />);

    expect((await screen.findByTestId('resumen-mesa-5')).textContent).toBe('Ana · 3 prod.');

    fireEvent.click(await screen.findByTestId('elemento-plano-5'));
    const tarjeta = await screen.findByTestId('tarjeta-pedido-mesa');
    expect(within(tarjeta).getByText('Ana')).toBeDefined();
    expect(within(tarjeta).getByText('Mozo: Mozo Prueba · CP-W106 · COLA')).toBeDefined();
    expect(within(tarjeta).getByText('2 × Café Filtro')).toBeDefined();
    expect(within(tarjeta).getByText('1 × Limonada')).toBeDefined();
    expect(within(tarjeta).getByText('Sin azúcar')).toBeDefined();
    expect(within(tarjeta).getByText('Total: S/ 24.00')).toBeDefined();
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { api } from '../../../comun/api';
import { listarPersonalActivo } from '../../creditos/creditosApi';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../useSalonSocket', () => ({
  useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: () => {} }),
}));
vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() },
}));
vi.mock('../../../comun/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../creditos/creditosApi', () => ({ listarPersonalActivo: vi.fn() }));

async function abrirPersonal() {
  render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" />);
  fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
  fireEvent.change(screen.getByPlaceholderText('Ej.: María López'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('9 dígitos'), { target: { value: '987654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cambiar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Personal' }));
}

describe('Pedido del personal: carga de la lista de trabajadores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: () => true, usuario: { rol: 'CAJERO' } } as any);
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue({ categorias: [] } as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(api.get).mockResolvedValue({ items: [] } as any);
  });

  it('carga y lista a los trabajadores al elegir Personal', async () => {
    vi.mocked(listarPersonalActivo).mockResolvedValue([{ partyId: '2', nombre: 'María Soto', rol: 'MOZO', descuentoPct: 25 }]);
    await abrirPersonal();
    expect(await screen.findByRole('button', { name: /María Soto/ })).toBeInTheDocument();
    expect(screen.queryByTestId('personal-error')).toBeNull();
  });

  it('si falla muestra el aviso con Reintentar y al reintentar carga la lista', async () => {
    vi.mocked(listarPersonalActivo)
      .mockRejectedValueOnce(new Error('403'))
      .mockResolvedValue([{ partyId: '2', nombre: 'María Soto', rol: 'MOZO', descuentoPct: 25 }]);
    await abrirPersonal();
    expect(await screen.findByText('No se pudo cargar la lista del personal.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: /María Soto/ })).toBeInTheDocument();
    expect(screen.queryByTestId('personal-error')).toBeNull();
  });
});

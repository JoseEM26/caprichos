import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalFichaCliente } from '../ModalFichaCliente';
import { ModalAjustarPuntos } from '../ModalAjustarPuntos';
import * as clientesApi from '../clientesApi';
import type { ClienteItem } from '../tipos';

let rol = 'ADMIN';
vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ usuario: { rol } }) }));

const cliente: ClienteItem = {
  id: '9', nombre: 'Ana Prueba', tipo: 'Persona', telefono: '999000111', correo: 'sin correo', cumpleanos: '—', pedidos: 1, puntos: 10,
  creditoPersonal: false, envioFijo: null, descuentoEnvio: null, activo: true,
};

const montar = () => render(<ModalFichaCliente abierto cliente={cliente} alCerrar={() => {}} alPuntosActualizados={() => {}} />);

describe('Ficha del cliente ▸ ajuste de puntos e historial', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    rol = 'ADMIN';
    vi.spyOn(clientesApi, 'obtenerFichaCliente').mockResolvedValue({
      id: '9', nombre: 'Ana Prueba', telefono: '999000111', correo: '', cumpleanos: '—', puntos: 10,
      pedidos: [{ pedidoId: '55', id: 'CP-55', modalidad: 'Delivery', estado: 'ENTREGADO', total: 's/ 30.00', pago: 'Cobrado', fecha: '2026-11-10T10:00:00Z' }],
    } as any);
    vi.spyOn(clientesApi, 'listarHistorialPuntos').mockResolvedValue([]);
  });

  it('el botón Ajustar puntos solo lo ve el ADMIN', async () => {
    montar();
    expect(await screen.findByText('Ajustar puntos')).toBeInTheDocument();
  });

  it('un cajero no ve el botón', async () => {
    rol = 'CAJERO';
    montar();
    await screen.findByText('CP-55');
    expect(screen.queryByText('Ajustar puntos')).not.toBeInTheDocument();
  });

  it('Ver detalle muestra qué pidió: cantidad, producto, opciones, vasos, envío, propina y pago', async () => {
    vi.spyOn(clientesApi, 'obtenerDetalleCompra').mockResolvedValue({
      id: '55', codigo: 'CP-55', fecha: '', modalidad: 'DELIVERY', estado: 'ENTREGADO',
      lineas: [{ id: '1', cantidad: 2, nombre: 'Frappé', tamano: 'Grande', opciones: ['Leche de almendra'], sabores: [], nombresPersona: ['Ana', 'Luis'], nota: null, cortesia: false, precioUnit: 12, subtotal: 24 }],
      subtotal: 24, descuento: 4, descuentos: [{ tipo: 'OFERTA', nombre: 'Promo 2x', monto: 4 }], puntosCanjeados: 0, envio: 6, propina: 2, total: 28,
      pagoEstado: 'PAGADO', medioPago: 'YAPE', comprobante: 'BOLETA', nota: null,
    });
    montar();
    fireEvent.click(await screen.findByText('Ver detalle'));
    const d = await screen.findByTestId('detalle-compra');
    expect(d).toHaveTextContent('2× Frappé');
    expect(d).toHaveTextContent('Grande · Leche de almendra · Vasos: Ana, Luis');
    expect(d).toHaveTextContent('Descuento · Promo 2x');
    expect(d).toHaveTextContent('Envío');
    expect(d).toHaveTextContent('Propina');
    expect(d).toHaveTextContent('YAPE · Cobrado');
    expect(d).toHaveTextContent('BOLETA');
  });

  it('el modal muestra el error del servidor y exige motivo de 4 letras', async () => {
    vi.spyOn(clientesApi, 'ajustarPuntos').mockRejectedValue(new Error('No se pudo, saldo cambió'));
    render(<ModalAjustarPuntos abierto clienteId="9" clienteNombre="Ana" saldoActual={10} alCerrar={() => {}} alAjustarExitoso={() => {}} />);
    fireEvent.change(screen.getByLabelText('Cantidad de puntos'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Motivo del ajuste/), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar puntos' }));
    expect(screen.getByRole('alert')).toHaveTextContent('mínimo 4');
    fireEvent.change(screen.getByLabelText(/Motivo del ajuste/), { target: { value: 'abcd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar puntos' }));
    fireEvent.click(screen.getByText('Sí'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('saldo cambió'));
  });
});

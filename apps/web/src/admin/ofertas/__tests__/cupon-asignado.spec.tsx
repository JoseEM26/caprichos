import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModalCupon } from '../ModalCupon';
import { ModalDarCupon } from '../ModalDarCupon';
import { ModalUsosCupon } from '../ModalUsosCupon';
import { ModalVistaPreviaCupon } from '../ModalVistaPreviaCupon';
import { ofertasApi, type CuponItem, type UsosCupon } from '../ofertasApi';

const cupon = (extra: Partial<CuponItem> = {}): CuponItem => ({
  id: '3',
  codigoBase: 'AMIGO15',
  descripcion: '15% para ti',
  modo: 'ASIGNADO_PERSONAL',
  descuentoTipo: 'PORCENTAJE',
  descuentoValor: 15,
  usosActuales: 0,
  orden: 1,
  activo: true,
  creadoEn: '2027-03-01T00:00:00Z',
  ...extra,
});

describe('ModalCupon: modo «Lo da el mozo o cajero»', () => {
  it('muestra el tercer modo y un consejo corto por modo', () => {
    render(<ModalCupon abierto cuponAEditar={null} onCerrar={() => {}} onGuardar={vi.fn()} productosDisponibles={[]} categorias={[]} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByTestId('consejo-modo').textContent).toMatch(/Premia la siguiente compra/);
    fireEvent.click(radios[1]);
    expect(screen.getByTestId('consejo-modo').textContent).toMatch(/No lo uses para descuentos a criterio del personal/);
    fireEvent.click(radios[2]);
    expect(screen.getByTestId('consejo-modo').textContent).toBe('Para clientes que el mozo o cajero elige: sale impreso en su voucher, con un código distinto cada vez.');
    fireEvent.click(screen.getByRole('tab', { name: /Cuándo y dónde/ }));
    expect(screen.getByText('Cuántos se pueden dar (en total)')).toBeTruthy();
    expect(screen.queryByText('Por cliente (con cuenta)')).toBeNull();
  });

  it('guarda con modo ASIGNADO_PERSONAL, días de validez y su tope de cupones a dar', async () => {
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<ModalCupon abierto cuponAEditar={null} onCerrar={() => {}} onGuardar={onGuardar} productosDisponibles={[]} categorias={[]} />);
    fireEvent.change(document.getElementById('cp-c')!, { target: { value: 'amigo15' } });
    fireEvent.change(document.getElementById('cp-d')!, { target: { value: '15% para ti' } });
    fireEvent.change(document.getElementById('cp-v')!, { target: { value: '15' } });
    fireEvent.click(screen.getAllByRole('radio')[2]);
    fireEvent.click(screen.getByRole('tab', { name: /Cuándo y dónde/ }));
    fireEvent.change(document.getElementById('cp-x')!, { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cupón' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));
    expect(onGuardar.mock.calls[0][0]).toMatchObject({ modo: 'ASIGNADO_PERSONAL', codigoBase: 'AMIGO15', topeUsos: 200, maxPorCliente: undefined });
    expect(onGuardar.mock.calls[0][0].diasValidez).toBeGreaterThan(0);
  });
});

describe('ModalDarCupon', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lista los cupones con cupos, da uno y muestra el código; luego permite quitarlo', async () => {
    vi.spyOn(ofertasApi, 'cuponesParaDar').mockResolvedValue({
      cupones: [{ id: '3', codigoBase: 'AMIGO15', descripcion: '15% para ti', descuentoTipo: 'PORCENTAJE', descuentoValor: 15, diasValidez: 10, quedan: 4, alcance: 'Toda la carta' }],
      dado: null,
    });
    const dar = vi.spyOn(ofertasApi, 'darCupon').mockResolvedValue({ id: '50', cuponId: '3', codigo: 'AMIGO15-K7M2PQ', codigoBase: 'AMIGO15', descripcion: null, venceEn: '2027-03-29T20:00:00Z', estado: 'VIGENTE', yaExistia: false });
    const quitar = vi.spyOn(ofertasApi, 'quitarCuponDado').mockResolvedValue({});
    render(<ModalDarCupon pedidoId="9" alCerrar={() => {}} />);

    expect(await screen.findByText(/AMIGO15 · 15 %/)).toBeTruthy();
    expect(screen.getByText(/quedan 4/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dar' }));
    expect((await screen.findByTestId('cupon-dado')).textContent).toContain('AMIGO15-K7M2PQ');
    expect(dar).toHaveBeenCalledWith('3', '9');

    fireEvent.click(screen.getByRole('button', { name: /Quitar/ }));
    await waitFor(() => expect(quitar).toHaveBeenCalledWith('50'));
    expect(screen.queryByTestId('cupon-dado')).toBeNull();
  });

  it('si el pedido ya tiene un cupón dado lo muestra de entrada', async () => {
    vi.spyOn(ofertasApi, 'cuponesParaDar').mockResolvedValue({ cupones: [], dado: { id: '8', cuponId: '3', codigo: 'AMIGO15-ZZZZZZ', descripcion: null, venceEn: null, estado: 'VIGENTE' } });
    render(<ModalDarCupon pedidoId="9" alCerrar={() => {}} />);
    expect((await screen.findByTestId('cupon-dado')).textContent).toContain('AMIGO15-ZZZZZZ');
  });

  it('muestra el error del servidor al dar', async () => {
    vi.spyOn(ofertasApi, 'cuponesParaDar').mockResolvedValue({ cupones: [{ id: '3', codigoBase: 'AMIGO15', descripcion: null, descuentoTipo: 'MONTO', descuentoValor: 5, diasValidez: 10, quedan: null, alcance: 'Toda la carta' }], dado: null });
    vi.spyOn(ofertasApi, 'darCupon').mockRejectedValue(new Error('Ya se dieron todos los cupones de este tipo'));
    render(<ModalDarCupon pedidoId="9" alCerrar={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Ya se dieron todos/);
  });
});

describe('Ver usos y vista previa de ASIGNADO_PERSONAL', () => {
  const usos: UsosCupon = {
    cuponId: '3',
    modo: 'ASIGNADO_PERSONAL',
    resumen: { usos: 2, tope: 200, quedan: 198, descuentoTotal: 6, clientesDistintos: 1, anulados: 0, emitidos: 2, canjeados: 1, vencidos: 0 },
    porTrabajador: [{ partyId: '77', nombre: 'Rosa Prueba', usos: 2, dados: 2, canjeados: 1, soles: 6 }],
    porDia: Array.from({ length: 30 }, (_, i) => ({ dia: `2027-03-${String(i + 1).padStart(2, '0')}`, usos: 0, soles: 0 })),
    historial: {
      items: [{ fecha: '2027-03-18T20:00:00Z', codigo: 'AMIGO15-AAAAAA', estado: 'CANJEADO', pedidoOrigenCodigo: 'CP-1', otorgadoPor: 'Rosa Prueba', cliente: { nombre: 'Lucía Ejemplo', celular: '9•••••321' }, pedidoCanjeCodigo: 'CP-2', canjeadoEn: '2027-03-19T20:00:00Z', canjeadoCanal: 'MOZO', descuento: 6 }],
      total: 1, pagina: 1, tamano: 10, totalPaginas: 1,
    },
  };

  it('dados frente a canjeados, por trabajador e historial con código, estado y pedido de canje', async () => {
    vi.spyOn(ofertasApi, 'usosDeCupon').mockResolvedValue(usos);
    render(<ModalUsosCupon cupon={cupon()} onCerrar={() => {}} />);
    expect(await screen.findByText('2 de 200')).toBeTruthy();
    expect(screen.getByText('Canjeados')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Por trabajador' }));
    expect(screen.getByText('Rosa Prueba')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Historial/ }));
    expect(screen.getByText('AMIGO15-AAAAAA')).toBeTruthy();
    expect(screen.getByText('Canjeado')).toBeTruthy();
    expect(screen.getByText('CP-2')).toBeTruthy();
    expect(screen.getByText(/Lucía Ejemplo · 9•••••321/)).toBeTruthy();
  });

  it('vista previa: bloque al pie con código de ejemplo y su nota', () => {
    render(<ModalVistaPreviaCupon cupon={cupon()} onCerrar={() => {}} />);
    expect(screen.getByTestId('nota-cupon-voucher').textContent).toMatch(/lo da el mozo o cajero/);
    const ticket = screen.getByTestId('pv-ticket').textContent ?? '';
    expect(ticket).toContain('CUPÓN DE COLECCIÓN');
    expect(ticket).toContain('AMIGO15-A1B2C3');
  });
});

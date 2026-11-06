import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AperturaDiaView } from '../AperturaDiaView';
import { ModalCerrarDia } from '../ModalCerrarDia';
import { almacenApi } from '../almacenApi';
import { errorMerma } from '../MermaProductoBoton';

/** Galleta sin sabores: ayer quedaron 4, hoy se produjeron 6 (saldo 10). */
const GALLETA = {
  productoId: 'g1',
  nombre: 'GALLETA',
  areaNombre: null,
  saldo: 10,
  aperturaHoy: true,
  aperturaCantidad: 10,
  producidoHoy: 6,
  quedaronAyer: 4,
};

describe('Apertura con arrastre: quedaron de ayer y produje hoy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra quedaron de ayer ya cargado, suma lo producido y envía cantidad y produccion', async () => {
    vi.spyOn(almacenApi, 'obtenerApertura').mockResolvedValue({ fecha: '2026-11-05', productos: [GALLETA] });
    const registrar = vi.spyOn(almacenApi, 'registrarApertura').mockResolvedValue({ ok: true, registrados: 1 });
    render(<AperturaDiaView />);
    await screen.findByText('GALLETA');

    expect(screen.getByLabelText('Quedaron de ayer GALLETA')).toHaveValue(4);
    expect(screen.getByLabelText('Produje hoy GALLETA')).toHaveValue(0);

    fireEvent.change(screen.getByLabelText('Produje hoy GALLETA'), { target: { value: '3' } });
    expect(screen.getByText('Total: 4 + 3 = 7')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar apertura (1)' }));
    await waitFor(() => expect(registrar).toHaveBeenCalledWith([{ productoId: 'g1', cantidad: 4, produccion: 3 }]));
  });
});

describe('Merma de producto terminado', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('valida la cantidad (entero de 1 hasta el saldo) y la nota del motivo Otro', () => {
    expect(errorMerma('0', 5, 'VENCIDO', '')).toMatch(/entero de 1 o más/);
    expect(errorMerma('6', 5, 'VENCIDO', '')).toBe('Solo hay 5. No puedes botar más de lo que hay.');
    expect(errorMerma('2', 5, 'OTRO', '  ')).toBe('Si el motivo es Otro, escribe una nota.');
    expect(errorMerma('2', 5, 'OTRO', 'Cayó al piso')).toBeNull();
    expect(errorMerma('5', 5, 'DANADO', '')).toBeNull();
  });

  it('botar a merma: cantidad y motivo, sin código de supervisor, y recarga la pantalla', async () => {
    vi.spyOn(almacenApi, 'obtenerApertura').mockResolvedValue({ fecha: '2026-11-05', productos: [GALLETA] });
    const merma = vi.spyOn(almacenApi, 'mermaProducto').mockResolvedValue({ ok: true, id: '9', saldo: 8 });
    render(<AperturaDiaView />);
    await screen.findByText('GALLETA');

    fireEvent.click(screen.getByRole('button', { name: 'Botar a merma GALLETA' }));
    fireEvent.change(screen.getByLabelText('Cantidad a botar de GALLETA'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Motivo de la merma de GALLETA'), { target: { value: 'SE_CAYO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar merma' }));

    await waitFor(() => expect(merma).toHaveBeenCalledWith({ productoId: 'g1', cantidad: 2, motivo: 'SE_CAYO' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Botado a merma: 2. Quedan 8.');
  });

  it('el motivo Otro pide nota antes de enviar y la manda', async () => {
    vi.spyOn(almacenApi, 'obtenerApertura').mockResolvedValue({ fecha: '2026-11-05', productos: [GALLETA] });
    const merma = vi.spyOn(almacenApi, 'mermaProducto').mockResolvedValue({ ok: true, id: '9', saldo: 9 });
    render(<AperturaDiaView />);
    await screen.findByText('GALLETA');

    fireEvent.click(screen.getByRole('button', { name: 'Botar a merma GALLETA' }));
    fireEvent.change(screen.getByLabelText('Cantidad a botar de GALLETA'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Motivo de la merma de GALLETA'), { target: { value: 'OTRO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar merma' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Si el motivo es Otro, escribe una nota.');
    expect(merma).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Nota de la merma de GALLETA'), { target: { value: 'Se cayó la bandeja' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar merma' }));
    await waitFor(() =>
      expect(merma).toHaveBeenCalledWith({ productoId: 'g1', cantidad: 1, motivo: 'OTRO', nota: 'Se cayó la bandeja' }),
    );
  });

  it('el cierre del día muestra el desglose por sabor y bota por sabor; los sabores no van al conteo por producto', async () => {
    vi.spyOn(almacenApi, 'obtenerProductosCierreDia').mockResolvedValue([
      {
        productoId: 'd1',
        nombre: 'DONA',
        sistema: 10,
        unidad: 'unidades',
        sabores: [
          { saborId: 's1', nombre: 'Fresa', sistema: 6 },
          { saborId: 's2', nombre: 'Oreo', sistema: 4 },
        ],
      },
      { insumoId: 'i1', nombre: 'Pan de molde', sistema: 3, unidad: 'u' },
    ]);
    const cerrar = vi.spyOn(almacenApi, 'cerrarDia').mockResolvedValue({ ok: true });
    render(<ModalCerrarDia abierto alCerrar={() => {}} alGuardar={() => {}} />);

    expect(await screen.findAllByTestId('cierre-sabor')).toHaveLength(2);
    expect(screen.getByText('Fresa:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Botar a merma DONA · Oreo' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre del día' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, confirmar cierre' }));
    await waitFor(() => expect(cerrar).toHaveBeenCalled());
    const filas = cerrar.mock.calls[0][0].filas;
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ insumoId: 'i1', nombre: 'Pan de molde' });
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  chipsModalidades, errorModalidades, estadoDesdeModalidades, incluyeModalidadFiltro, modalidadesDesdeEstado, resumenAplica,
} from '../canalesPromo';
import { ModalDescuento } from '../ModalDescuento';
import { ModalEnvioGratis } from '../ModalEnvioGratis';

const base = { carta: true, local: false, bot: true };

describe('modalidades de la oferta (modelo)', () => {
  it('vacío = todas, y todas marcadas se guarda vacío', () => {
    expect(estadoDesdeModalidades([])).toEqual({ local: true, llevar: true, recoger: true, delivery: true });
    expect(estadoDesdeModalidades(undefined).delivery).toBe(true);
    expect(modalidadesDesdeEstado({ local: true, llevar: true, recoger: true, delivery: true })).toEqual([]);
    expect(modalidadesDesdeEstado({ local: false, llevar: true, recoger: true, delivery: false })).toEqual(['LLEVAR', 'RECOGER']);
  });

  it('resumen vivo en lenguaje llano', () => {
    expect(resumenAplica({ ...base, modalidades: { local: false, llevar: true, recoger: true, delivery: false } })).toBe('Aplica en: Carta web y WhatsApp, solo para llevar y recoger');
    expect(resumenAplica(base)).toBe('Aplica en: Carta web y WhatsApp, para todos los tipos de pedido');
  });

  it('chips solo cuando hay restricción', () => {
    expect(chipsModalidades([])).toEqual([]);
    expect(chipsModalidades(['COMER_LOCAL', 'DELIVERY'])).toEqual(['Comer aquí', 'Delivery']);
  });

  it('validación: ninguna marcada, y envío gratis sin delivery', () => {
    const ninguna = { local: false, llevar: false, recoger: false, delivery: false };
    expect(errorModalidades('DESCUENTO', { ...base, modalidades: ninguna })).toMatch(/al menos un tipo de pedido/);
    expect(errorModalidades('ENVIO_GRATIS', { ...base, modalidades: { ...ninguna, local: true } })).toMatch(/solo vale en delivery/);
    expect(errorModalidades('ENVIO_GRATIS', { ...base, modalidades: { ...ninguna, delivery: true } })).toBeNull();
    expect(errorModalidades('DESCUENTO', base)).toBeNull();
  });

  it('filtro de la lista: sin restricción sale siempre', () => {
    expect(incluyeModalidadFiltro([], 'DELIVERY')).toBe(true);
    expect(incluyeModalidadFiltro(['COMER_LOCAL'], 'DELIVERY')).toBe(false);
    expect(incluyeModalidadFiltro(['COMER_LOCAL'], 'COMER_LOCAL')).toBe(true);
    expect(incluyeModalidadFiltro(['COMER_LOCAL'], 'Todos')).toBe(true);
  });
});

async function abrirDescuento(onGuardar = vi.fn().mockResolvedValue(undefined), editar: any = null) {
  render(<ModalDescuento abierto onCerrar={() => {}} onGuardar={onGuardar} productosDisponibles={[]} categorias={[]} descuentoAEditar={editar} />);
  fireEvent.change(document.getElementById('desc-nombre')!, { target: { value: '10% de prueba' } });
  fireEvent.click(screen.getByRole('tab', { name: /Cuándo y dónde/ }));
  await waitFor(() => expect(screen.getByTestId('desc-canal-modalidades')).toBeTruthy());
  return onGuardar;
}

describe('editor: ¿Para qué tipo de pedido?', () => {
  it('muestra el bloque con las cuatro casillas marcadas y el resumen vivo', async () => {
    await abrirDescuento();
    expect(screen.getByText('¿Para qué tipo de pedido?')).toBeTruthy();
    for (const n of ['Comer en el local', 'Para llevar', 'Recoger', 'Delivery']) expect((screen.getByLabelText(new RegExp(n)) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByTestId('desc-canal-resumen-aplica').textContent).toMatch(/para todos los tipos de pedido/);
  });

  it('los atajos cambian las casillas y el resumen, y se guarda la restricción', async () => {
    const onGuardar = await abrirDescuento();
    fireEvent.click(screen.getByTestId('desc-canal-atajo-llevar'));
    expect(screen.getByTestId('desc-canal-resumen-aplica').textContent).toMatch(/solo para llevar y recoger/);
    expect((screen.getByLabelText(/Delivery/) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByTestId('desc-canal-atajo-salon'));
    expect(screen.getByTestId('desc-canal-resumen-aplica').textContent).toMatch(/solo comer en el local/);
    fireEvent.click(screen.getByTestId('btn-guardar-descuento'));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalled());
    expect(onGuardar.mock.calls[0][0].modalidades).toEqual(['COMER_LOCAL']);
    fireEvent.click(screen.getByTestId('desc-canal-atajo-todas'));
  });

  it('todas marcadas guarda modalidades vacías (retrocompatible)', async () => {
    const onGuardar = await abrirDescuento();
    fireEvent.click(screen.getByTestId('btn-guardar-descuento'));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalled());
    expect(onGuardar.mock.calls[0][0].modalidades).toEqual([]);
  });

  it('al editar una oferta con modalidades las refleja', async () => {
    await abrirDescuento(vi.fn(), {
      id: '5', tipo: 'DESCUENTO', nombre: 'X', descuentoTipo: 'PORCENTAJE', descuentoValor: 10, activo: true, dias: [], compraMinima: 0, orden: 0,
      canales: ['CARTA', 'ADMIN'], modalidades: ['DELIVERY'],
    });
    expect((screen.getByLabelText(/Delivery/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/Comer en el local/) as HTMLInputElement).checked).toBe(false);
  });

  it('no se puede guardar sin ningún tipo de pedido', async () => {
    const onGuardar = await abrirDescuento();
    for (const n of ['Comer en el local', 'Para llevar', 'Recoger', 'Delivery']) fireEvent.click(screen.getByLabelText(new RegExp(n)));
    expect(screen.getByTestId('desc-canal-error-modalidades')).toBeTruthy();
    fireEvent.click(screen.getByTestId('btn-guardar-descuento'));
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull();
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('envío gratis sin Delivery avisa y no guarda', async () => {
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<ModalEnvioGratis abierto ofertaAEditar={null} onCerrar={() => {}} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText(/Nombre de la promoción/), { target: { value: 'Envío gratis' } });
    fireEvent.click(screen.getByRole('tab', { name: /Cuándo y dónde/ }));
    fireEvent.click(screen.getByTestId('envio-canal-atajo-salon'));
    expect(screen.getByTestId('envio-canal-error-modalidades').textContent).toMatch(/solo vale en delivery/);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onGuardar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('envio-canal-atajo-delivery'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalled());
    expect(onGuardar.mock.calls[0][0].modalidades).toEqual(['DELIVERY']);
  });
});

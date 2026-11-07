import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModalCombo } from '../ModalCombo';
import { ModalDescuento } from '../ModalDescuento';
import { ModalLlevaPaga } from '../ModalLlevaPaga';
import { ModalCupon } from '../ModalCupon';
import { ModalEnvioGratis } from '../ModalEnvioGratis';

const nombresPestanas = () => screen.getAllByRole('tab').map((t) => t.textContent?.replace('!', '').trim());
const ir = (n: RegExp) => fireEvent.click(screen.getByRole('tab', { name: n }));
const esperarBase = () => act(async () => { await new Promise((r) => setTimeout(r, 120)); });

describe('Modales de Ofertas: pestañas', () => {
  it('cada modal muestra sus pestañas', () => {
    const base = { abierto: true, onCerrar: () => {}, onGuardar: vi.fn() };
    const a = render(<ModalCombo {...base} />);
    expect(nombresPestanas()).toEqual(['Datos', 'Partes y alternativas', 'Cuándo y dónde', 'Resumen']);
    a.unmount();
    const b = render(<ModalDescuento {...base} />);
    expect(nombresPestanas()).toEqual(['Qué descuenta', 'Cuándo y dónde', 'Condiciones', 'Vista previa']);
    b.unmount();
    const c = render(<ModalLlevaPaga {...base} />);
    expect(nombresPestanas()).toEqual(['Qué lleva y paga', 'Cuándo y dónde', 'Vista previa']);
    c.unmount();
    const d = render(<ModalCupon {...base} />);
    expect(nombresPestanas()).toEqual(['Datos del cupón', 'Cuándo y dónde', 'Condiciones']);
    d.unmount();
    render(<ModalEnvioGratis {...base} />);
    expect(nombresPestanas()).toEqual(['Datos', 'Cuándo y dónde']);
  });

  it('Descuento: un error en otra pestaña marca la insignia y Guardar salta a esa pestaña', async () => {
    const onGuardar = vi.fn();
    render(<ModalDescuento abierto onCerrar={() => {}} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText(/Nombre del descuento \*/i), { target: { value: 'Descuento' } });
    fireEvent.change(screen.getByLabelText(/Valor del descuento \*/i), { target: { value: '10' } });
    ir(/Cuándo y dónde/);
    fireEvent.change(screen.getByLabelText(/Hora desde/), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText(/Hora hasta/), { target: { value: '14:00' } });
    ir(/Vista previa/);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar descuento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La hora de inicio debe ser antes de la hora final.');
    const pestana = screen.getByRole('tab', { name: /Cuándo y dónde/ });
    expect(pestana).toHaveTextContent('!');
    expect(pestana).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Qué descuenta/ })).not.toHaveTextContent('!');
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('Descuento: sin errores pide confirmar y envía el mismo payload de siempre', async () => {
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<ModalDescuento abierto onCerrar={() => {}} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText(/Nombre del descuento \*/i), { target: { value: 'Happy hour' } });
    fireEvent.change(screen.getByLabelText(/Valor del descuento \*/i), { target: { value: '15' } });
    ir(/Condiciones/);
    fireEvent.change(screen.getByLabelText(/Compra mínima \(S\/\):/i), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar descuento' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));
    expect(onGuardar.mock.calls[0][0]).toMatchObject({
      nombre: 'Happy hour', tipo: 'DESCUENTO', aplicaA: 'TODA_LA_CARTA', descuentoTipo: 'PORCENTAJE', descuentoValor: 15,
      compraMinima: 30, canales: ['CARTA', 'ADMIN', 'BOT'], soloPrimeraCompra: false, mostrarEnSaludoBot: false,
    });
  });

  it('Lleva y paga: el error de «Cuándo y dónde» salta a su pestaña desde la primera', async () => {
    render(<ModalLlevaPaga abierto onCerrar={() => {}} onGuardar={vi.fn()} />);
    // Cuando falta lo de la primera pestaña, el error de esa pestaña manda
    fireEvent.click(screen.getByRole('button', { name: 'Guardar promoción' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe el nombre de la promoción.');
    expect(screen.getByRole('tab', { name: /Qué lleva y paga/ })).toHaveTextContent('!');
  });

  it('Cupón: error de «Condiciones» salta a esa pestaña y se marca', async () => {
    render(<ModalCupon abierto onCerrar={() => {}} onGuardar={vi.fn()} categorias={[{ id: '1', nombre: 'Frappes' }]} />);
    fireEvent.change(document.getElementById('cp-c')!, { target: { value: 'x' } });
    fireEvent.change(document.getElementById('cp-d')!, { target: { value: 'y' } });
    fireEvent.change(document.getElementById('cp-v')!, { target: { value: '10' } });
    ir(/Condiciones/);
    fireEvent.click(screen.getByRole('button', { name: 'Una categoría' }));
    ir(/Datos del cupón/);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cupón' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Elige la categoría.');
    expect(screen.getByRole('tab', { name: /Condiciones/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Condiciones/ })).toHaveTextContent('!');
  });

  it('Envío gratis: un error de «Cuándo y dónde» desde Datos salta a esa pestaña', async () => {
    render(<ModalEnvioGratis abierto onCerrar={() => {}} onGuardar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Nombre de la promoción/), { target: { value: 'Envío' } });
    ir(/Cuándo y dónde/);
    fireEvent.change(screen.getByLabelText(/Desde las/), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText(/Hasta las/), { target: { value: '14:00' } });
    ir(/^Datos/);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/después de la hora de inicio/);
    expect(screen.getByRole('tab', { name: /Cuándo y dónde/ })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Modales de Ofertas: cambios sin guardar', () => {
  it('Descuento: sin cambios cierra directo; con cambios avisa y pide Sí/No', async () => {
    const onCerrar = vi.fn();
    render(<ModalDescuento abierto onCerrar={onCerrar} onGuardar={vi.fn()} />);
    await esperarBase();
    expect(screen.queryByText('● Hay cambios sin guardar')).toBeNull();

    fireEvent.change(screen.getByLabelText(/Nombre del descuento \*/i), { target: { value: 'Algo' } });
    expect(await screen.findByText('● Hay cambios sin guardar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCerrar).not.toHaveBeenCalled();
    expect(await screen.findByText('¿Salir sin guardar?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(onCerrar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, salir' }));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('Cupón y Combo: sin cambios, Cancelar cierra sin preguntar', async () => {
    const onCerrar = vi.fn();
    const a = render(<ModalCupon abierto onCerrar={onCerrar} onGuardar={vi.fn()} />);
    await esperarBase();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCerrar).toHaveBeenCalledTimes(1);
    a.unmount();
    render(<ModalCombo abierto onCerrar={onCerrar} onGuardar={vi.fn()} />);
    await esperarBase();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });

  it('Esc con cambios también pide confirmación', async () => {
    const onCerrar = vi.fn();
    render(<ModalEnvioGratis abierto onCerrar={onCerrar} onGuardar={vi.fn()} />);
    await esperarBase();
    fireEvent.change(screen.getByLabelText(/Nombre de la promoción/), { target: { value: 'Envío' } });
    await screen.findByText('● Hay cambios sin guardar');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(await screen.findByText('¿Salir sin guardar?')).toBeInTheDocument();
    expect(onCerrar).not.toHaveBeenCalled();
  });
});

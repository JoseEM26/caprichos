import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalCortesia } from '../ModalCortesia';
import { errorDatosCortesia } from '../cortesiasApi';
import { filasInformeCortesias } from '../informeCortesias';
import type { ResumenInformeCortesias } from '../cortesiasApi';

describe('errorDatosCortesia', () => {
  it('exige motivo de la lista', () => {
    expect(errorDatosCortesia('', '')).toMatch(/motivo/);
    expect(errorDatosCortesia('INVENTADO', '')).toMatch(/motivo/);
    expect(errorDatosCortesia('RECLAMO_CLIENTE', '')).toBeNull();
  });

  it('con «Otro» la nota es obligatoria', () => {
    expect(errorDatosCortesia('OTRO', '   ')).toMatch(/nota/);
    expect(errorDatosCortesia('OTRO', 'pidió reponer')).toBeNull();
  });
});

describe('ModalCortesia', () => {
  it('no deja confirmar sin motivo y no llama al guardado', () => {
    const alConfirmar = vi.fn(async () => {});
    render(<ModalCortesia titulo="Dar como cortesía: Frappe" alConfirmar={alConfirmar} alCerrar={() => {}} />);
    const boton = screen.getByRole('button', { name: 'Dar cortesía' }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    expect(alConfirmar).not.toHaveBeenCalled();
  });

  it('con «Otro» y sin nota, el botón queda bloqueado; con nota, envía motivo y nota', async () => {
    const alConfirmar = vi.fn(async () => {});
    render(<ModalCortesia titulo="Dar como cortesía: Frappe" alConfirmar={alConfirmar} alCerrar={() => {}} />);
    fireEvent.click(screen.getByLabelText('Otro'));
    const boton = screen.getByRole('button', { name: 'Dar cortesía' }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Nota de la cortesía'), { target: { value: 'Cliente de la esquina' } });
    expect(boton.disabled).toBe(false);
    fireEvent.click(boton);
    await waitFor(() =>
      expect(alConfirmar).toHaveBeenCalledWith({ motivo: 'OTRO', nota: 'Cliente de la esquina' }),
    );
  });

  it('no pide ningún código de supervisor: con el motivo basta y se confirma', async () => {
    const alConfirmar = vi.fn(async () => {});
    render(<ModalCortesia titulo="Dar como cortesía: Waffle" alConfirmar={alConfirmar} alCerrar={() => {}} />);
    fireEvent.click(screen.getByLabelText('Reclamo del cliente'));
    expect(screen.queryByLabelText('Código del supervisor (6 dígitos)')).toBeNull();
    const boton = screen.getByRole('button', { name: 'Dar cortesía' }) as HTMLButtonElement;
    expect(boton.disabled).toBe(false);
    fireEvent.click(boton);
    await waitFor(() => expect(alConfirmar).toHaveBeenCalledWith({ motivo: 'RECLAMO_CLIENTE', nota: undefined }));
  });

  it('muestra el mensaje del servidor si el guardado falla (p. ej. pedido cobrado)', async () => {
    const alConfirmar = vi.fn(async () => {
      throw Object.assign(new Error('x'), { codigo: 'PEDIDO_YA_COBRADO', mensaje: 'El pedido ya está cobrado: registra la cortesía por separado' });
    });
    render(<ModalCortesia titulo="Dar como cortesía: Frappe" alConfirmar={alConfirmar} alCerrar={() => {}} />);
    fireEvent.click(screen.getByLabelText('Degustación o promoción'));
    fireEvent.click(screen.getByRole('button', { name: 'Dar cortesía' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El pedido ya está cobrado');
  });
});

describe('filasInformeCortesias', () => {
  const res: ResumenInformeCortesias = {
    desde: '2026-11-01',
    hasta: '2026-11-05',
    resumen: { registros: 1, unidades: 2, valorLista: 24 },
    porMotivo: [{ codigo: 'RECLAMO_CLIENTE', motivo: 'Reclamo del cliente', registros: 1, unidades: 2, valorLista: 24 }],
    porProducto: [{ productoId: '10', producto: 'Frappe Oreo', registros: 1, unidades: 2, valorLista: 24 }],
    porQuien: [{ partyId: '5', nombre: 'Caja Uno', registros: 1, unidades: 2, valorLista: 24 }],
    detalle: [
      {
        id: '1',
        creadoEn: '2026-11-05T15:00:00.000Z',
        producto: 'Frappe Oreo',
        sabor: null,
        cantidad: 2,
        valorLista: 24,
        motivo: 'RECLAMO_CLIENTE',
        motivoEtiqueta: 'Reclamo del cliente',
        nota: null,
        pedido: 'CP-W001',
        pedidoReferencia: null,
        dadaPor: 'Caja Uno',
        autorizadaPor: null,
      },
    ],
  };

  it('arma KPIs con el valor de lista y secciones de motivo, producto, quién y detalle', () => {
    const f = filasInformeCortesias(res);
    expect(f.kpis).toEqual([
      { n: 'Cortesías', v: '1' },
      { n: 'Unidades regaladas', v: '2' },
      { n: 'Valor de lista regalado', v: 'S/ 24.00' },
    ]);
    const primera = f.rows.map((r) => String(r[0]));
    expect(primera).toEqual(
      expect.arrayContaining(['▸ Por motivo', 'Reclamo del cliente', '▸ Por producto', '▸ Por quién la dio', '▸ Detalle']),
    );
    expect(f.rows.some((r) => r[4] === 'CP-W001')).toBe(true);
  });
});

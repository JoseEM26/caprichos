import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { requiereCodigo } from '../../../comun/autorizacionSupervisor';

// El rol de la sesión decide si la vista pide el código del supervisor (ADMIN no lo escribe nunca).
const sesion = { rol: 'ADMIN' as string };
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ usuario: { rol: sesion.rol }, tiene: () => true }),
}));

import { ModalAnular } from '../ModalAnular';
import { ExcepcionSinVoucher } from '../CapturasPlanDigital';
import { PendientesCobroCierre } from '../../cierre/PendientesCobroCierre';
import type { PendienteCobro } from '../../cierre/cierreApi';

describe('requiereCodigo', () => {
  it('ADMIN y SUPERVISOR no piden código; los demás roles sí', () => {
    expect(requiereCodigo({ rol: 'ADMIN' })).toBe(false);
    expect(requiereCodigo({ rol: 'admin' })).toBe(false);
    expect(requiereCodigo({ rol: 'SUPERVISOR' })).toBe(false);
    expect(requiereCodigo({ rol: 'CAJERO' })).toBe(true);
    expect(requiereCodigo({ rol: 'MOZO' })).toBe(true);
    expect(requiereCodigo(null)).toBe(true);
  });
});

describe('anular pedido: COCINA y MOZO no escriben código (regla de su rol)', () => {
  const botonConfirmar = () => screen.getByRole('button', { name: 'Confirmar anulación' });
  const motivo = () => fireEvent.change(screen.getByLabelText(/Motivo detallado/), { target: { value: 'Cliente se fue' } });

  for (const rol of ['COCINA', 'MOZO']) {
    it(`${rol}: sin campo de código y se habilita solo con motivo`, () => {
      sesion.rol = rol;
      render(<ModalAnular pedidoId="1" codigoPedido="CP-1" alCerrar={() => {}} alAnularExitoso={() => {}} />);
      expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
      expect(screen.getByText(/Se anula el pedido COMPLETO/)).toBeTruthy();
      motivo();
      expect(botonConfirmar()).not.toBeDisabled();
    });
  }

  it('COCINA sí pide código al anular un COBRO (no cambia)', () => {
    sesion.rol = 'COCINA';
    render(<ModalAnular pedidoId="1" codigoPedido="CP-1" esCobro cobroId="9" alCerrar={() => {}} alAnularExitoso={() => {}} />);
    expect(screen.getByTestId('input-codigo-supervisor')).toBeTruthy();
  });
});

describe('vistas según el rol', () => {
  beforeEach(() => {
    sesion.rol = 'ADMIN';
  });

  it('ADMIN no ve el campo de código al anular un pedido', () => {
    render(<ModalAnular pedidoId="1" codigoPedido="CP-1" alCerrar={() => {}} alAnularExitoso={() => {}} />);
    expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
    expect(screen.queryByText(/Código del supervisor/)).toBeNull();
  });

  it('ADMIN no ve el código en la excepción sin voucher (solo motivo)', () => {
    render(<ExcepcionSinVoucher motivo="" onMotivo={() => {}} pin="" onPin={() => {}} alVolver={() => {}} />);
    expect(screen.getByTestId('motivo-sin-voucher')).toBeTruthy();
    expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
  });

  it('CAJERO sí ve el campo de código al anular y en la excepción sin voucher', () => {
    sesion.rol = 'CAJERO';
    const { unmount } = render(
      <ModalAnular pedidoId="1" codigoPedido="CP-1" alCerrar={() => {}} alAnularExitoso={() => {}} />,
    );
    expect(screen.getByTestId('input-codigo-supervisor')).toBeTruthy();
    unmount();
    render(<ExcepcionSinVoucher motivo="" onMotivo={() => {}} pin="" onPin={() => {}} alVolver={() => {}} />);
    expect(screen.getByTestId('input-codigo-supervisor')).toBeTruthy();
  });
});

describe('anular cobro y anular pedido: el botón se habilita según el rol', () => {
  const botonConfirmar = () => screen.getByRole('button', { name: 'Confirmar anulación' });
  const escribirMotivo = (texto: string) =>
    fireEvent.change(screen.getByLabelText(/Motivo detallado/), { target: { value: texto } });
  const escribirCodigo = (valor: string) =>
    fireEvent.change(screen.getByTestId('input-codigo-supervisor'), { target: { value: valor } });
  const renderAnular = (esCobro: boolean) =>
    render(
      <ModalAnular
        pedidoId="1"
        codigoPedido="CP-1"
        esCobro={esCobro}
        cobroId="9"
        alCerrar={() => {}}
        alAnularExitoso={() => {}}
      />,
    );

  for (const rol of ['ADMIN', 'SUPERVISOR']) {
    for (const esCobro of [true, false]) {
      const etiqueta = esCobro ? 'anular cobro' : 'anular pedido';

      it(`${rol} (${etiqueta}): con motivo de 5 caracteres se habilita sin código`, () => {
        sesion.rol = rol;
        renderAnular(esCobro);
        expect(botonConfirmar()).toBeDisabled();
        escribirMotivo('Error al digitar');
        expect(botonConfirmar()).toBeEnabled();
        expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
      });
    }
  }

  it('ADMIN: la confirmación no menciona el PIN del supervisor', () => {
    sesion.rol = 'ADMIN';
    renderAnular(true);
    escribirMotivo('Error al digitar');
    fireEvent.click(botonConfirmar());
    expect(screen.getByText(/Motivo: Error al digitar\./)).toBeInTheDocument();
    expect(screen.queryByText(/requiere el PIN del supervisor/)).toBeNull();
  });

  for (const esCobro of [true, false]) {
    const etiqueta = esCobro ? 'anular cobro' : 'anular pedido';

    it(`CAJERO (${etiqueta}): sigue deshabilitado hasta escribir 6 dígitos`, () => {
      sesion.rol = 'CAJERO';
      const { unmount } = renderAnular(esCobro);
      escribirMotivo('Error al digitar');
      expect(botonConfirmar()).toBeDisabled();
      escribirCodigo('12345');
      expect(botonConfirmar()).toBeDisabled();
      escribirCodigo('123456');
      expect(botonConfirmar()).toBeEnabled();
      unmount();
    });
  }
});

describe('pedidos sin cobrar del cierre: el SUPERVISOR los ve sin código', () => {
  const pendiente: PendienteCobro = {
    id: 74,
    codigo: 'CP-W062',
    canal: 'CARTA',
    modalidad: 'RECOGER',
    estado: 'ENTREGADO',
    total: 42,
    fecha: '2026-10-23T20:21:00.000Z',
  };

  it('SUPERVISOR: la lista aparece de entrada, sin campo de código', () => {
    sesion.rol = 'SUPERVISOR';
    render(
      <PendientesCobroCierre esAdmin={false} pendientes={[pendiente]} setPendientes={() => {}} alCambiarTurno={() => {}} />,
    );
    expect(screen.getByText('CP-W062', { exact: false })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Código del supervisor/i)).toBeNull();
  });

  it('CAJERO: sigue pidiendo el código antes de mostrar la lista', () => {
    sesion.rol = 'CAJERO';
    render(
      <PendientesCobroCierre esAdmin={false} pendientes={[pendiente]} setPendientes={() => {}} alCambiarTurno={() => {}} />,
    );
    expect(screen.queryByText('CP-W062', { exact: false })).toBeNull();
    expect(screen.getByLabelText(/Código del supervisor/i)).toBeInTheDocument();
  });
});

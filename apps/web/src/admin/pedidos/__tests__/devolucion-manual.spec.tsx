import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PanelNoEntregados } from '../PanelNoEntregados';
import { ModalDevolucion } from '../ModalDevolucion';
import type { NoEntregado, RespuestaNoEntregados, SugerenciaDevolucion } from '../pedidosApi';
import { pedidosApi } from '../pedidosApi';

const pideCodigo = vi.fn(() => false);
vi.mock('../../../comun/usePideCodigo', () => ({ usePideCodigo: () => pideCodigo() }));

vi.mock('../pedidosApi', async (importOriginal) => {
  const real: any = await importOriginal();
  return {
    ...real,
    pedidosApi: { ...real.pedidosApi, sugerenciaDevolucion: vi.fn(), registrarDevolucion: vi.fn() },
  };
});

const sugerencia = (extra: Partial<SugerenciaDevolucion> = {}): SugerenciaDevolucion => ({
  pedidoId: '3',
  codigo: 'CP-NO',
  montoPagado: 50,
  montoEnvio: 5,
  montoSugerido: 45,
  medioOriginal: 'EFECTIVO',
  comprobante: null,
  ...extra,
});

const pedido: NoEntregado = {
  id: '3',
  codigo: 'CP-NO',
  cliente_nombre: 'Marta',
  cliente_telefono: '987654321',
  total: 50,
  motivo: 'Cliente no quiso reprogramar la entrega tras la espera agotada',
  retirado_en: '2026-10-28T10:00:00Z',
  pregunta: 'NO',
  pago_estado: 'PAGADO',
  revisar_devolucion: true,
};

const registro = {
  id: '9',
  pedidoId: '3',
  montoDevuelto: 45,
  medio: 'EFECTIVO',
  motivo: null,
  porNombre: 'Ana',
  autorizadoPorNombre: 'Ana',
  comprobanteBajaEstado: null,
  creadoEn: '2026-11-04T15:00:00Z',
  avisoComprobante: null,
};

const campo = (texto: RegExp | string) => screen.getByLabelText(texto) as HTMLInputElement;

describe('ModalDevolucion', () => {
  beforeEach(() => {
    pideCodigo.mockReturnValue(false);
    vi.mocked(pedidosApi.sugerenciaDevolucion).mockReset().mockResolvedValue(sugerencia());
    vi.mocked(pedidosApi.registrarDevolucion).mockReset().mockResolvedValue(registro as any);
  });

  it('muestra el resumen del pago y prellena el monto sugerido', async () => {
    render(<ModalDevolucion pedido={pedido} alCerrar={() => {}} alRegistrar={() => {}} />);

    const dialogo = screen.getByRole('dialog', { name: /Devolver pedido CP-NO/ });
    expect(await within(dialogo).findByText('S/ 50.00')).toBeInTheDocument();
    expect(within(dialogo).getByText('S/ 5.00')).toBeInTheDocument();
    expect(campo(/Monto a devolver/).value).toBe('45.00');
  });

  it('rechaza un monto mayor a lo pagado y no llama a la API', async () => {
    render(<ModalDevolucion pedido={pedido} alCerrar={() => {}} alRegistrar={() => {}} />);
    await screen.findByText('S/ 50.00');

    fireEvent.change(campo(/Monto a devolver/), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar devolución/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe un monto entre S/ 0.01 y S/ 50.00');
    expect(pedidosApi.registrarDevolucion).not.toHaveBeenCalled();
  });

  it('pide código de operación en un medio digital', async () => {
    render(<ModalDevolucion pedido={pedido} alCerrar={() => {}} alRegistrar={() => {}} />);
    await screen.findByText('S/ 50.00');

    fireEvent.change(screen.getByLabelText('Cómo se devuelve'), { target: { value: 'YAPE' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar devolución/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe el código de operación');
    expect(pedidosApi.registrarDevolucion).not.toHaveBeenCalled();
  });

  it('pide motivo cuando el monto cambia y lo envía al registrar', async () => {
    const alRegistrar = vi.fn();
    render(<ModalDevolucion pedido={pedido} alCerrar={() => {}} alRegistrar={alRegistrar} />);
    await screen.findByText('S/ 50.00');

    fireEvent.change(campo(/Monto a devolver/), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar devolución/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Explica por qué devuelves otro monto');

    fireEvent.change(screen.getByLabelText(/¿Por qué cambia el monto/), { target: { value: 'Volvió a pedir, solo delivery' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar devolución/ }));

    await waitFor(() => expect(alRegistrar).toHaveBeenCalledWith(registro));
    expect(pedidosApi.registrarDevolucion).toHaveBeenCalledWith(
      '3',
      { montoDevuelto: 40, medio: 'EFECTIVO', motivo: 'Volvió a pedir, solo delivery' },
      undefined,
    );
  });

  it('a quien no es admin ni supervisor le pide el código de 6 dígitos y lo envía', async () => {
    pideCodigo.mockReturnValue(true);
    render(<ModalDevolucion pedido={pedido} alCerrar={() => {}} alRegistrar={() => {}} />);
    await screen.findByText('S/ 50.00');

    fireEvent.click(screen.getByRole('button', { name: /Registrar devolución/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('6 dígitos');
    expect(pedidosApi.registrarDevolucion).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('input-codigo-supervisor'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar devolución/ }));
    await waitFor(() =>
      expect(pedidosApi.registrarDevolucion).toHaveBeenCalledWith('3', { montoDevuelto: 45, medio: 'EFECTIVO' }, '123456'),
    );
  });

  it('avisa que se dará de baja el comprobante vigente', async () => {
    vi.mocked(pedidosApi.sugerenciaDevolucion).mockResolvedValue(
      sugerencia({ comprobante: { tipo: 'BOLETA', numero: 'B002-15', bajaEstado: null } }),
    );
    render(<ModalDevolucion pedido={pedido} alCerrar={() => {}} alRegistrar={() => {}} />);

    expect(await screen.findByTestId('aviso-comprobante')).toHaveTextContent('Al devolver se dará de baja el comprobante B002-15');
  });
});

describe('PanelNoEntregados: devolución', () => {
  const datos = (extra: Partial<NoEntregado>): RespuestaNoEntregados => ({
    reprogramar: [],
    cancelados: [{ ...pedido, ...extra }],
    total: 1,
  });

  beforeEach(() => {
    vi.mocked(pedidosApi.sugerenciaDevolucion).mockReset().mockResolvedValue(sugerencia());
    vi.mocked(pedidosApi.registrarDevolucion).mockReset().mockResolvedValue(registro as any);
  });

  it('un pagado sin devolución muestra «Gestionar devolución» que abre el diálogo', async () => {
    render(<PanelNoEntregados datos={datos({})} cargando={false} error="" puedeLiquidar={false} puedeDevolver alActualizar={() => {}} />);

    fireEvent.click(screen.getByTestId('devolver-CP-NO'));

    expect(await screen.findByRole('dialog', { name: /Devolver pedido CP-NO/ })).toBeInTheDocument();
  });

  it('sin permiso de cambiar pedidos solo queda la etiqueta, sin botón', () => {
    render(<PanelNoEntregados datos={datos({})} cargando={false} error="" puedeLiquidar={false} alActualizar={() => {}} />);

    expect(screen.getByTestId('revisar-devolucion-CP-NO')).toBeInTheDocument();
    expect(screen.queryByTestId('devolver-CP-NO')).not.toBeInTheDocument();
  });

  it('con devolución registrada muestra «Devuelto» con monto, medio y quién, sin la etiqueta ni el botón', () => {
    render(
      <PanelNoEntregados
        datos={datos({
          revisar_devolucion: false,
          devolucion: {
            id: '9',
            montoDevuelto: 25,
            medio: 'YAPE',
            motivo: 'Solo se cobró delivery',
            porNombre: 'Marta',
            autorizadoPorNombre: 'Marta',
            comprobanteBajaEstado: null,
            creadoEn: '2026-11-04T15:00:00Z',
          },
        })}
        cargando={false}
        error=""
        puedeLiquidar={false}
        puedeDevolver
        alActualizar={() => {}}
      />,
    );

    expect(screen.getByTestId('devuelto-CP-NO')).toHaveTextContent('Devuelto S/ 25.00 · Yape · Marta');
    expect(screen.queryByTestId('revisar-devolucion-CP-NO')).not.toBeInTheDocument();
    expect(screen.queryByTestId('devolver-CP-NO')).not.toBeInTheDocument();
  });
});

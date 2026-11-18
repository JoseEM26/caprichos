import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook } from '@testing-library/react';
import { api, ErrorApi } from '../../comun/api';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { FormularioCheckout } from '../FormularioCheckout';
import { CabeceraCarta } from '../CabeceraCarta';
import { CajonCarrito } from '../CajonCarrito';
import { PantallaConfirmacion } from '../PantallaConfirmacion';
import {
  AvisoProgramar,
  ConfirmacionProgramado,
  SelectorCaminoPago,
  SelectorCuando,
  textoDiaHora,
  useProgramarFueraHorario,
  type ProgramarCarta,
} from '../ProgramarPedido';
import type { DatosLocalCarta, EstadoLocalCarta } from '../tipos';
import * as cuentaModulo from '../cuenta/CuentaContext';

vi.mock('../../comun/api', async () => {
  const real = await vi.importActual<typeof import('../../comun/api')>('../../comun/api');
  return { ...real, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

const iso = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00.000-05:00`).toISOString();
const PROGRAMAR: ProgramarCarta = {
  diasMax: 7,
  dias: [
    { fecha: '2027-03-01', horas: [{ hora: '10:00', iso: iso('2027-03-01', '10:00') }, { hora: '10:30', iso: iso('2027-03-01', '10:30') }] },
    { fecha: '2027-03-02', horas: [{ hora: '11:00', iso: iso('2027-03-02', '11:00') }] },
  ],
};
const abierto: EstadoLocalCarta = { abierta: true, motivo: 'OK', texto: 'Abierto', abre: '10:00', cierra: '12:00', pausaAltaDemanda: false, tiempoPrometidoMin: 25, altaDemandaMin: 0 };
const cerrado: EstadoLocalCarta = { ...abierto, abierta: false, motivo: 'HORARIO', texto: 'Abrimos mañana a las 10:00' };
const pausa: EstadoLocalCarta = { ...cerrado, motivo: 'PAUSA', pausaAltaDemanda: true };
const datos = {
  nombre: 'Caprichos', direccion: 'Av. Las Delicias 123', telefono: '999888777', whatsapp: '999888777', redes: {}, horario: [],
  mediosPago: { efectivo: { activo: true }, yape: { activo: true }, plin: { activo: true }, tarjeta: { activo: true }, transferencia: { activo: true, banco: 'BCP', titular: 'Ana Prueba', cuenta: '191-00000000-0-00', cci: '002-191-000000000000-00' } },
  envioGratisDesde: 70, pedidoMinimo: 0, invitadoPermitido: false, propina: { carta: false, bot: false, tope: 50 },
} as unknown as DatosLocalCarta;

describe('ProgramarPedido: componentes', () => {
  it('el aviso es amable y explica que se puede programar para llevar o delivery', () => {
    render(<AvisoProgramar />);
    expect(screen.getByTestId('aviso-programar')).toHaveTextContent('Estamos cerrados ahora, pero puedes programar tu pedido para llevar o delivery y lo atendemos en nuestro horario');
  });

  it('SelectorCuando: lista los días, solo las horas del día elegido y devuelve el instante ISO', () => {
    const cambios: string[] = [];
    render(<SelectorCuando programar={PROGRAMAR} valor="" alCambiar={(v) => cambios.push(v)} />);
    const dias = screen.getByTestId('select-dia-programado') as HTMLSelectElement;
    expect(Array.from(dias.options).map((o) => o.text)).toEqual(['Lunes 1 de marzo', 'Martes 2 de marzo']);
    expect(screen.getByTestId('hora-programada-10:00')).toBeInTheDocument();
    expect(screen.queryByTestId('hora-programada-11:00')).toBeNull(); // es de otro día
    expect(screen.getByTestId('resumen-cuando')).toHaveTextContent('Elige una hora');

    fireEvent.click(screen.getByTestId('hora-programada-10:30'));
    expect(cambios.at(-1)).toBe(iso('2027-03-01', '10:30'));

    fireEvent.change(dias, { target: { value: '2027-03-02' } });
    expect(cambios.at(-1)).toBe(''); // al cambiar de día se vuelve a elegir la hora
    expect(screen.getByTestId('hora-programada-11:00')).toBeInTheDocument();
    expect(screen.queryByTestId('hora-programada-10:00')).toBeNull();
  });

  it('SelectorCuando: la hora elegida queda marcada y el resumen dice el día y la hora', () => {
    render(<SelectorCuando programar={PROGRAMAR} valor={iso('2027-03-01', '10:30')} alCambiar={() => undefined} />);
    expect(screen.getByTestId('hora-programada-10:30')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('resumen-cuando')).toHaveTextContent('Tu pedido será el lunes 1 de marzo a las 10:30.');
  });

  it('SelectorCaminoPago: dos caminos claros y el aviso del pago en línea', () => {
    const elegidos: string[] = [];
    render(<SelectorCaminoPago valor={null} alCambiar={(c) => elegidos.push(c)} />);
    expect(screen.getByRole('radio', { name: /Pagar al recibir/ })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId('camino-pago-pagado'));
    expect(elegidos).toEqual(['PAGADO']);
    expect(screen.getByTestId('aviso-pago-en-linea-horario')).toHaveTextContent('El pago en línea con tarjeta está disponible dentro del horario; puedes pagar al recibir o dejar tu Yape con captura.');
  });

  it('la confirmación dice el día y la hora y que se avisa por WhatsApp', () => {
    render(<ConfirmacionProgramado iso={iso('2027-03-01', '10:30')} />);
    expect(screen.getByTestId('confirmacion-programado')).toHaveTextContent('Tu pedido quedó programado para el lunes 1 de marzo a las 10:30. Te avisaremos por WhatsApp.');
    expect(textoDiaHora(iso('2027-03-01', '10:30'))).toBe('lunes 1 de marzo a las 10:30');
  });
});

describe('useProgramarFueraHorario', () => {
  beforeEach(() => vi.clearAllMocks());

  it('local abierto: no consulta y no se programa', async () => {
    const { result } = renderHook(() => useProgramarFueraHorario(abierto));
    expect(result.current).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('cerrado y encendido: trae los días y horas', async () => {
    vi.mocked(api.get).mockResolvedValue({ habilitado: true, ...PROGRAMAR });
    const { result } = renderHook(() => useProgramarFueraHorario(cerrado));
    await waitFor(() => expect(result.current?.dias).toHaveLength(2));
    expect(api.get).toHaveBeenCalledWith('/carta/programar-horas');
  });

  it('parámetro apagado (habilitado:false), sin días o sin red: queda como siempre (null)', async () => {
    vi.mocked(api.get).mockResolvedValue({ habilitado: false, diasMax: 0, dias: [] });
    const apagado = renderHook(() => useProgramarFueraHorario(cerrado));
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(apagado.result.current).toBeNull();
    vi.mocked(api.get).mockRejectedValue(new Error('sin red'));
    const sinRed = renderHook(() => useProgramarFueraHorario(cerrado));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(sinRed.result.current).toBeNull();
  });

  it('pausa por alta demanda: no se programa aunque esté encendido', () => {
    const { result } = renderHook(() => useProgramarFueraHorario(pausa));
    expect(result.current).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('Carta cerrada: banner y carrito', () => {
  const cabecera = (e: EstadoLocalCarta, programar: ProgramarCarta | null) => (
    <CarritoProvider>
      <CabeceraCarta busqueda="" onCambioBusqueda={() => undefined} estadoLocal={e} datosLocal={datos} pagina="carta" onPagina={() => undefined} categorias={[]} categoriaActivaId="todo" onCategoria={() => undefined} mostrarInstalar={false} mostrarReservar={false} programar={programar} />
    </CarritoProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({ cliente: null, abrirPanel: vi.fn() } as any);
  });

  it('con programar: banner amable arriba, sin el aviso de «no se pueden enviar pedidos»', () => {
    render(cabecera(cerrado, PROGRAMAR));
    expect(screen.getByTestId('banner-programar')).toHaveTextContent('puedes programar tu pedido para llevar o delivery');
    expect(screen.queryByText(/no se pueden enviar pedidos/)).toBeNull();
  });

  it('sin programar (parámetro apagado): el aviso de cerrado de siempre', () => {
    render(cabecera(cerrado, null));
    expect(screen.queryByTestId('banner-programar')).toBeNull();
    expect(screen.getByText(/Local cerrado \(Abrimos mañana a las 10:00\): puedes mirar la carta pero no se pueden enviar pedidos/)).toBeInTheDocument();
  });

  it('pausa por alta demanda con programar: sigue el aviso de pausa', () => {
    render(cabecera(pausa, PROGRAMAR));
    expect(screen.queryByTestId('banner-programar')).toBeNull();
    expect(screen.getByText(/Pausa por alta demanda/)).toBeInTheDocument();
  });

  function Cajon({ programar }: { programar: ProgramarCarta | null }) {
    const { agregarLinea, abrirCajon } = useCarrito();
    return (
      <div>
        <button onClick={() => { agregarLinea({ productoId: 'p', nombre: 'Frappé', precioBase: 14.5, cantidad: 1, opciones: [], precioUnitario: 14.5, subtotal: 14.5 }); abrirCajon(); }}>Abrir carrito</button>
        <CajonCarrito estadoLocal={cerrado} datosLocal={datos} programar={programar} />
      </div>
    );
  }

  it('el carrito deja continuar si se puede programar; si no, queda bloqueado como siempre', () => {
    const { unmount } = render(<CarritoProvider><Cajon programar={PROGRAMAR} /></CarritoProvider>);
    fireEvent.click(screen.getByText('Abrir carrito'));
    expect(screen.getByTestId('aviso-programar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar · S\/ 14.50/ })).toBeEnabled();
    unmount();
    localStorage.clear();
    render(<CarritoProvider><Cajon programar={null} /></CarritoProvider>);
    fireEvent.click(screen.getByText('Abrir carrito'));
    expect(screen.getByRole('button', { name: /Carta cerrada para pedidos/ })).toBeDisabled();
  });
});

describe('Checkout con el local cerrado y programar', () => {
  function Pagina({ estado, programar }: { estado: EstadoLocalCarta; programar: ProgramarCarta | null }) {
    const { agregarLinea, abrirCheckout } = useCarrito();
    return (
      <div>
        <button onClick={() => { agregarLinea({ productoId: 'prod-1', nombre: 'Combo', precioBase: 40, cantidad: 1, opciones: [], precioUnitario: 40, subtotal: 40 }); abrirCheckout(); }}>Abrir pedido</button>
        <FormularioCheckout estadoLocal={estado} datosLocal={datos} programar={programar} />
      </div>
    );
  }
  const abrir = (estado = cerrado, programar: ProgramarCarta | null = PROGRAMAR) => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(null);
    render(<CarritoProvider><Pagina estado={estado} programar={programar} /></CarritoProvider>);
    fireEvent.click(screen.getByText('Abrir pedido'));
  };
  const llenarDatos = () => {
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async () => ({}));
    vi.mocked(api.post).mockRejectedValue(new ErrorApi('TEST', 'cortado a propósito', 400));
  });

  it('muestra el aviso amable (no el de «ya cerramos»), «comer en el local» desactivado con su explicación y el bloque ¿Para cuándo?', () => {
    abrir();
    expect(screen.getByTestId('aviso-programar')).toBeInTheDocument();
    expect(screen.queryByTestId('aviso-local-cerrado')).toBeNull();
    expect(screen.getByTestId('modalidad-comer-local')).toBeDisabled();
    expect(screen.getByTestId('explicacion-comer-local-cerrado')).toHaveTextContent('Comer en el local no se puede programar');
    expect(screen.getByText('¿Para cuándo lo quieres?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delivery/ })).toBeEnabled();
  });

  it('parámetro apagado (sin programar): el aviso de «ya cerramos» de siempre y nada de programar', () => {
    abrir(cerrado, null);
    expect(screen.getByTestId('aviso-local-cerrado')).toHaveTextContent('Ya cerramos por hoy');
    expect(screen.queryByTestId('bloque-cuando')).toBeNull();
    expect(screen.queryByTestId('aviso-programar')).toBeNull();
    expect(screen.getByTestId('modalidad-comer-local')).toBeEnabled();
  });

  it('local abierto: el checkout no cambia aunque se pase «programar»', () => {
    abrir(abierto, PROGRAMAR);
    expect(screen.queryByTestId('bloque-cuando')).toBeNull();
    expect(screen.queryByTestId('aviso-programar')).toBeNull();
  });

  it('sin elegir la hora no deja continuar y lo dice con amabilidad', async () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
    llenarDatos();
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByText('Elige el día y la hora para tu pedido')).toBeInTheDocument();
  });

  async function hastaPago() {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
    llenarDatos();
    fireEvent.click(screen.getByTestId('hora-programada-10:30'));
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByLabelText(/Paso 2: Ubicación/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByTestId('bloque-camino-pago')).toBeInTheDocument();
  }

  it('pago: primero los dos caminos; sin elegir uno no se ofrecen los medios y Culqi no aparece', async () => {
    vi.mocked(api.get).mockImplementation(async (ruta: string) => (ruta.includes('culqi/config') ? { activo: true, modo: 'SIMULADO' } : {}));
    await hastaPago();
    expect(screen.getByTestId('resumen-programado-pago')).toHaveTextContent('lunes 1 de marzo a las 10:30');
    expect(screen.queryByTestId('tarjetas-medio-pago')).toBeNull();
    expect(screen.getByTestId('aviso-pago-en-linea-horario')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('camino-pago-recibir'));
    expect(await screen.findByTestId('tarjetas-medio-pago')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tarjeta \/ Yape en línea/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Pagar con 2 o 3 medios/ })).toBeNull();
    for (const m of ['Yape', 'Plin', 'Efectivo', 'Tarjeta', 'Transferencia']) expect(screen.getByRole('button', { name: new RegExp(`^${m}$`) })).toBeInTheDocument();
  });

  it('«Dejarlo pagado» solo ofrece Yape, Plin y transferencia', async () => {
    await hastaPago();
    fireEvent.click(screen.getByTestId('camino-pago-pagado'));
    expect(await screen.findByTestId('tarjetas-medio-pago')).toBeInTheDocument();
    for (const m of ['Yape', 'Plin', 'Transferencia']) expect(screen.getByRole('button', { name: new RegExp(`^${m}$`) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Efectivo$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Tarjeta$/ })).toBeNull();
  });

  it('al enviar manda programadoPara (la hora elegida) y la confirmación dice el día y la hora', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: '9', codigo: 'CP-9', estado: 'PROGRAMADO', subtotal: 40, envio: null, total: 40, mensaje: 'Pedido programado', seguimientoToken: 't', programadoPara: iso('2027-03-01', '10:30') });
    await hastaPago();
    fireEvent.click(screen.getByTestId('camino-pago-pagado'));
    fireEvent.click(await screen.findByRole('button', { name: /^Yape$/ }));
    const enviar = await screen.findByRole('button', { name: /Programar pedido/ });
    fireEvent.click(enviar);
    await waitFor(() => expect(vi.mocked(api.post).mock.calls.some((c) => c[0] === '/pedidos')).toBe(true));
    const payload = vi.mocked(api.post).mock.calls.find((c) => c[0] === '/pedidos')![1] as any;
    expect(payload.programadoPara).toBe(iso('2027-03-01', '10:30'));
    expect(payload.modalidad).toBe('RECOGER');
    expect(payload.pago.metodo).toBe('YAPE');
  });

  it('el servidor rechaza la hora (PROGRAMADO_FUERA_DE_HORARIO): vuelve al paso 1 con su mensaje', async () => {
    vi.mocked(api.post).mockRejectedValue(new ErrorApi('PROGRAMADO_FUERA_DE_HORARIO', 'Ese día atendemos de 10:00 a 12:00. Elige una hora dentro de ese horario.', 400));
    await hastaPago();
    fireEvent.click(screen.getByTestId('camino-pago-recibir'));
    fireEvent.click(await screen.findByRole('button', { name: /^Yape$/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Programar pedido/ }));
    expect(await screen.findByText(/Ese día atendemos de 10:00 a 12:00/)).toBeInTheDocument();
    expect(screen.getByTestId('bloque-cuando')).toBeInTheDocument();
  });
});

describe('Pantalla de confirmación de un pedido programado', () => {
  it('dice para cuándo quedó programado y que se avisa por WhatsApp', () => {
    vi.mocked(api.get).mockRejectedValue(new Error('sin red'));
    function Montar() {
      const { setPedidoConfirmado } = useCarrito();
      return (
        <div>
          <button onClick={() => setPedidoConfirmado({ id: '9', codigo: 'CP-9', estado: 'PROGRAMADO', subtotal: 40, envio: null, total: 40, mensaje: 'Pedido programado', clienteNombre: 'Luis', modalidad: 'RECOGER', seguimientoToken: 't', programadoPara: iso('2027-03-01', '10:30') })}>Confirmar</button>
          <PantallaConfirmacion />
        </div>
      );
    }
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(null);
    render(<CarritoProvider><Montar /></CarritoProvider>);
    fireEvent.click(screen.getByText('Confirmar'));
    expect(screen.getByTestId('confirmacion-programado')).toHaveTextContent('Tu pedido quedó programado para el lunes 1 de marzo a las 10:30. Te avisaremos por WhatsApp.');
  });
});

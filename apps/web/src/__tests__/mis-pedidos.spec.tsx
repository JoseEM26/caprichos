import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';
import { CarritoProvider, useCarrito } from '../carta/CarritoContext';
import { CabeceraCarta } from '../carta/CabeceraCarta';
import { MisPedidos } from '../carta/MisPedidos';
import { EstadoLocalCarta, DatosLocalCarta } from '../carta/tipos';
import { guardarPedido, leerPedidosGuardados, PedidoGuardado, EstadoSeguimiento } from '../carta/seguimiento';
import { api } from '../comun/api';
import * as cuentaModulo from '../carta/cuenta/CuentaContext';

const estadoAbierto: EstadoLocalCarta = {
  abierta: true,
  motivo: 'OK',
  texto: 'Abierto',
  abre: '14:00',
  cierra: '22:00',
  pausaAltaDemanda: false,
  tiempoPrometidoMin: 25,
  altaDemandaMin: 0,
};

const datosLocal = { nombre: 'Caprichos', direccion: '', telefono: '', whatsapp: '', redes: {}, horario: [] } as unknown as DatosLocalCarta;

const horasAtras = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

const pedido = (codigo: string, extra: Partial<PedidoGuardado> = {}): PedidoGuardado => ({
  codigo,
  token: `tok-${codigo}`,
  modalidad: 'DELIVERY',
  nombre: 'Carlos',
  creadoEn: horasAtras(1),
  ...extra,
});

const estado = (codigo: string, extra: Partial<EstadoSeguimiento> = {}): EstadoSeguimiento => ({
  codigo,
  estado: 'EN_CAMINO',
  estadoEtiqueta: 'En camino',
  modalidad: 'DELIVERY',
  total: 29.5,
  terminado: false,
  anulado: false,
  pasos: [
    { clave: 'RECIBIDO', etiqueta: 'Pedido recibido', hecho: true, actual: false, hora: null },
    { clave: 'CAMINO', etiqueta: 'En camino', hecho: false, actual: true, hora: null },
  ],
  ...extra,
});

// Ventana «Mis pedidos» abierta, como la deja el botón de la cabecera
function AbrirLista() {
  const { setListaPedidosAbierta } = useCarrito();
  useEffect(() => setListaPedidosAbierta(true), [setListaPedidosAbierta]);
  return null;
}

function pantallaLista() {
  return (
    <CarritoProvider>
      <AbrirLista />
      <MisPedidos />
    </CarritoProvider>
  );
}

function cabecera() {
  return (
    <CarritoProvider>
      <CabeceraCarta
        busqueda=""
        onCambioBusqueda={() => {}}
        estadoLocal={estadoAbierto}
        datosLocal={datosLocal}
        pagina="carta"
        onPagina={() => {}}
        categorias={[]}
        categoriaActivaId="todo"
        onCategoria={() => {}}
      />
    </CarritoProvider>
  );
}

const tarjetas = () => screen.queryAllByRole('button', { name: /^#PED-/ });
const codigosEnPantalla = () => tarjetas().map((t) => t.textContent?.match(/#(PED-\d+)/)?.[1]);

function sinSesion() {
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue({ cliente: null } as unknown as ReturnType<typeof cuentaModulo.useCuentaOpcional>);
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({
    cliente: null,
    panelAbierto: false,
    abrirPanel: vi.fn(),
    cerrarPanel: vi.fn(),
  } as unknown as ReturnType<typeof cuentaModulo.useCuenta>);
}

function conSesion() {
  const cliente = { partyId: '9', nombre: 'Ana', puntos: 0 };
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue({ cliente } as unknown as ReturnType<typeof cuentaModulo.useCuentaOpcional>);
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({
    cliente,
    panelAbierto: false,
    abrirPanel: vi.fn(),
    cerrarPanel: vi.fn(),
  } as unknown as ReturnType<typeof cuentaModulo.useCuenta>);
}

// Cada pedido consultado en lote responde con su estado (o noEncontrado si se indica)
function lotePorDefecto(noEncontrados: string[] = []) {
  return vi.spyOn(api, 'post').mockImplementation(async (_ruta: string, cuerpo: any) => ({
    resultados: cuerpo.pedidos.map((p: { codigo: string }) =>
      noEncontrados.includes(p.codigo) ? { codigo: p.codigo, noEncontrado: true } : estado(p.codigo),
    ),
  }));
}

beforeEach(() => {
  localStorage.clear();
  sinSesion();
  lotePorDefecto();
  vi.spyOn(api, 'get').mockRejectedValue(new Error('sin red'));
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Mis pedidos: lista', () => {
  it('muestra activos primero y, en cada grupo, del más nuevo al más viejo', async () => {
    guardarPedido(pedido('PED-101', { creadoEn: horasAtras(3) }));
    guardarPedido(pedido('PED-102', { creadoEn: horasAtras(1) }));
    guardarPedido(pedido('PED-201', { creadoEn: horasAtras(2), terminado: true, estado: 'ENTREGADO', estadoEtiqueta: 'Entregado' }));
    guardarPedido(pedido('PED-202', { creadoEn: horasAtras(5), terminado: true, estado: 'ENTREGADO', estadoEtiqueta: 'Entregado' }));

    render(pantallaLista());

    await waitFor(() => expect(codigosEnPantalla()).toHaveLength(4));
    expect(codigosEnPantalla()).toEqual(['PED-102', 'PED-101', 'PED-201', 'PED-202']);
    expect(screen.getByText('Mis pedidos', { selector: 'h2' })).toBeInTheDocument();
  });

  it('abre el detalle con los pasos reales y vuelve a la lista', async () => {
    guardarPedido(pedido('PED-102'));
    vi.spyOn(api, 'get').mockResolvedValue(estado('PED-102'));

    render(pantallaLista());
    fireEvent.click(await screen.findByRole('button', { name: /^#PED-102/ }));

    expect(await screen.findByText('Pedido #PED-102')).toBeInTheDocument();
    expect(await screen.findByText('En camino', { selector: 'span' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mis pedidos/ }));

    expect(screen.getByText('Mis pedidos', { selector: 'h2' })).toBeInTheDocument();
    expect(codigosEnPantalla()).toEqual(['PED-102']);
  });

  it('solo consulta en lote los pedidos que no han terminado', async () => {
    guardarPedido(pedido('PED-101'));
    guardarPedido(pedido('PED-201', { terminado: true, estado: 'ENTREGADO', estadoEtiqueta: 'Entregado' }));

    render(pantallaLista());

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const enviados = (api.post as any).mock.calls[0][1].pedidos.map((p: { codigo: string }) => p.codigo);
    expect(enviados).toEqual(['PED-101']);
    expect(await screen.findByText('Entregado')).toBeInTheDocument();
  });

  it('un pedido que la API no encuentra se quita de la lista y del navegador', async () => {
    guardarPedido(pedido('PED-101'));
    guardarPedido(pedido('PED-102'));
    lotePorDefecto(['PED-101']);

    render(pantallaLista());

    await waitFor(() => expect(codigosEnPantalla()).toEqual(['PED-102']));
    expect(leerPedidosGuardados().map((p) => p.codigo)).toEqual(['PED-102']);
  });

  it('sin pedidos muestra el estado vacío con «Ver la carta»', async () => {
    render(pantallaLista());

    expect(await screen.findByText('Aún no tienes pedidos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver la carta' })).toBeInTheDocument();
  });

  it('si la consulta falla muestra el error y Reintentar vuelve a consultar', async () => {
    guardarPedido(pedido('PED-102'));
    vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('sin red'));

    render(pantallaLista());

    expect(await screen.findByText('No pudimos cargar tus pedidos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));

    expect(await screen.findByRole('button', { name: /^#PED-102/ })).toBeInTheDocument();
    expect(screen.getByText('En camino', { selector: 'span' })).toBeInTheDocument();
  });
});

describe('Mis pedidos: historial con sesión', () => {
  const pedidoCuenta = (n: number) => ({
    codigo: `PED-${n}`,
    estado: 'ENTREGADO',
    estadoEtiqueta: 'Entregado',
    modalidad: 'RECOGER',
    total: 10,
    terminado: true,
    anulado: false,
    creadoEn: horasAtras(n),
    resumen: '1 x Frappe Oreo',
    seguimientoToken: `tok-${n}`,
    pasos: [],
  });

  it('muestra 10 pedidos de la cuenta y «Ver más» trae el resto', async () => {
    conSesion();
    const primera = Array.from({ length: 10 }, (_, i) => pedidoCuenta(i + 1));
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) =>
      ruta.includes('pagina=2')
        ? { pedidos: [pedidoCuenta(11)], pagina: 2, hayMas: false }
        : { pedidos: primera, pagina: 1, hayMas: true },
    );

    render(pantallaLista());

    await waitFor(() => expect(tarjetas()).toHaveLength(10));
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));

    await waitFor(() => expect(tarjetas()).toHaveLength(11));
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/carta/cuenta/pedidos?pagina=2');
  });

  it('un pedido del navegador que ya está en el historial de la cuenta no se repite', async () => {
    conSesion();
    guardarPedido(pedido('PED-1', { terminado: true, estado: 'ENTREGADO', estadoEtiqueta: 'Entregado' }));
    guardarPedido(pedido('PED-9', { terminado: true, estado: 'ENTREGADO', estadoEtiqueta: 'Entregado' }));
    vi.spyOn(api, 'get').mockResolvedValue({ pedidos: [pedidoCuenta(1)], pagina: 1, hayMas: false });

    render(pantallaLista());

    await waitFor(() => expect(codigosEnPantalla()).toEqual(['PED-1', 'PED-9']));
    expect(tarjetas().filter((t) => t.textContent?.includes('PED-1')).length).toBe(1);
    expect(tarjetas()[0].textContent).toContain('1 x Frappe Oreo');
  });
});

describe('Mis pedidos: conservación en el navegador', () => {
  it('un pedido terminado de menos de 30 días se conserva', () => {
    guardarPedido(pedido('PED-401', { creadoEn: horasAtras(24 * 29), terminado: true }));
    expect(leerPedidosGuardados().map((p) => p.codigo)).toEqual(['PED-401']);
  });

  it('un pedido de más de 30 días se poda al leer', () => {
    guardarPedido(pedido('PED-402', { creadoEn: horasAtras(24 * 31), terminado: true }));
    expect(leerPedidosGuardados()).toEqual([]);
  });

  it('guarda como máximo 20 pedidos', () => {
    for (let i = 0; i < 21; i++) guardarPedido(pedido(`PED-${500 + i}`));
    expect(leerPedidosGuardados()).toHaveLength(20);
  });
});

describe('Mis pedidos: botón de la cabecera', () => {
  it('dice «Mi pedido» con uno, «Mis pedidos» con varios y muestra cuántos están activos', () => {
    render(cabecera());
    expect(screen.queryByRole('button', { name: /Mis? pedidos?/ })).not.toBeInTheDocument();

    act(() => guardarPedido(pedido('PED-601')));
    const boton = screen.getByRole('button', { name: 'Mi pedido' });
    expect(within(boton).getByText('1')).toBeInTheDocument();

    act(() => guardarPedido(pedido('PED-602', { terminado: true })));
    expect(screen.getByRole('button', { name: 'Mis pedidos' })).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Mis pedidos' })).getByText('1')).toBeInTheDocument();

    act(() => guardarPedido(pedido('PED-603')));
    expect(within(screen.getByRole('button', { name: 'Mis pedidos' })).getByText('2')).toBeInTheDocument();
  });

  it('con sesión iniciada aparece aunque no haya pedidos guardados en el navegador', () => {
    conSesion();
    render(cabecera());
    expect(screen.getByRole('button', { name: 'Mis pedidos' })).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('al pulsarlo abre la lista', async () => {
    guardarPedido(pedido('PED-701', { terminado: true, estado: 'ENTREGADO', estadoEtiqueta: 'Entregado' }));
    render(
      <CarritoProvider>
        <CabeceraCarta
          busqueda=""
          onCambioBusqueda={() => {}}
          estadoLocal={estadoAbierto}
          datosLocal={datosLocal}
          pagina="carta"
          onPagina={() => {}}
          categorias={[]}
          categoriaActivaId="todo"
          onCategoria={() => {}}
        />
        <MisPedidos />
      </CarritoProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mi pedido' }));
    expect(await screen.findByRole('dialog', { name: 'Mis pedidos' })).toBeInTheDocument();
  });
});

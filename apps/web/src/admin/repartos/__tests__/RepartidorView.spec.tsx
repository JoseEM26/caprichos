import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RepartosView } from '../RepartosView';
import { repartosApi, PedidoReparto, PedidoProximo, ResumenRepartidor } from '../repartosApi';
import { ErrorApi } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

// Leaflet simulado: los marcadores son botones de React, así que el mapa solo necesita proyectar puntos
const leaflet = vi.hoisted(() => {
  const m: any = {};
  for (const k of ['setView', 'fitBounds', 'setMaxBounds', 'on', 'remove', 'invalidateSize']) m[k] = vi.fn(() => m);
  m.latLngToContainerPoint = vi.fn(() => ({ x: 120, y: 200 }));
  // El contenedor va dentro del documento para que screen alcance los marcadores que se montan en él
  m.getContainer = vi.fn(() => {
    const d = document.createElement('div');
    document.body.appendChild(d);
    return d;
  });
  const polilinea = vi.fn((_coords: unknown) => ({ addTo() { return this; }, remove: () => {} }));
  return { m, polilinea };
});

vi.mock('../../../comun/mapa/leaflet', () => {
  const capa = (): any => {
    const o: any = {};
    o.addTo = () => o;
    return o;
  };
  return {
    ATRIBUCION: '',
    URL_TESELAS: '',
    L: {
      map: () => leaflet.m,
      control: { zoom: capa, attribution: capa },
      tileLayer: capa,
      polyline: leaflet.polilinea,
      latLngBounds: (coords: unknown) => ({ coords, pad: () => coords }),
    },
  };
});

describe('RepartidorView: pantalla toda mapa del repartidor', () => {
  function crearMockPedido(parcial: Partial<PedidoReparto> & { id: string; codigo: string }): PedidoReparto {
    return {
      modalidad: 'DELIVERY',
      estado: 'LISTO',
      cliente_nombre: 'Cliente',
      cliente_telefono: null,
      direccion: 'Direccion',
      referencia: null,
      lat: -12.06,
      lng: -77.04,
      zona: 'Breña',
      zona_id: '1',
      minutosEspera: 10,
      color: 'verde',
      total: 30,
      pago_estado: 'PAGADO',
      pago_metodo: 'EFECTIVO',
      cobro_pendiente_efectivo: false,
      paga_con: null,
      repartidor_party_id: null,
      tomado_en: null,
      salio_en: null,
      llego_en: null,
      entregado_en: null,
      motivo_falla: null,
      creado_en: '2026-10-27T14:00:00Z',
      cantidad_productos: 1,
      ...parcial,
    };
  }

  const mio1 = crearMockPedido({ id: '101', codigo: 'CP-0101', cliente_nombre: 'Rosa Sanchez', cliente_telefono: '987654321', direccion: 'Av. Brasil 1234', minutosEspera: 15, repartidor_party_id: '10', ordenRuta: 2 });
  const mio2 = crearMockPedido({ id: '102', codigo: 'CP-0102', cliente_nombre: 'Carlos Ramos', estado: 'EN_CAMINO', pago_estado: 'PENDIENTE', cobro_pendiente_efectivo: true, minutosEspera: 25, lat: -12.07, lng: -77.05, repartidor_party_id: '10', ordenRuta: 1 });
  const disp1 = crearMockPedido({ id: '201', codigo: 'CP-0201', cliente_nombre: 'Ana Belen', minutosEspera: 10, lat: -12.065, lng: -77.045 });
  const disp2 = crearMockPedido({ id: '202', codigo: 'CP-0202', cliente_nombre: 'Jorge Mendoza', minutosEspera: 50, lat: -12.068, lng: -77.048 });
  const disp3 = crearMockPedido({ id: '203', codigo: 'CP-0203', cliente_nombre: 'Lucia Paz', minutosEspera: 25, lat: -12.07, lng: -77.01 });
  const entregado = crearMockPedido({ id: '301', codigo: 'CP-0301', estado: 'ENTREGADO', cliente_nombre: 'Lucia Diaz', total: 50, repartidor_party_id: '10' });
  const proximo: PedidoProximo = {
    id: '401', codigo: 'CP-0401', clienteNombre: 'Pedro Gris', lat: -12.03, lng: -77.0, zona: 'Breña',
    estado: 'EN_COCINA', estadoTexto: 'En cocina', minutosEspera: 5, creadoEn: '2026-10-27T14:30:00Z', cantidadProductos: 2,
  };

  const resumenDe = (id: string, extra: Partial<ResumenRepartidor> = {}): ResumenRepartidor => ({
    id, codigo: `CP-${id}`, clienteNombre: 'Cliente', estado: 'LISTO', estadoTexto: 'Listo en tienda', minutosEspera: 10,
    productos: [{ cantidad: 2, nombre: 'Pollo a la brasa' }], nota: 'Sin ají', zona: 'Breña', puedeTomar: true, motivoNoTomar: null, ...extra,
  });

  const montar = () =>
    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

  const configCon = (max: number) => ({ umbralRetrasadoMin: 20, umbralTardeMin: 30, umbralMuyTardeMin: 45, velocidadMediaKmH: 20, maxPedidosPorRepartidor: max });

  let salirSesion: ReturnType<typeof vi.fn>;
  let alEstado: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    salirSesion = vi.fn().mockResolvedValue(undefined);
    alEstado = undefined;

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '10', nombres: 'Repartidor 1', rol: 'REPARTIDOR' },
      permisos: ['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: salirSesion,
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn((permiso: string) => ['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar'].includes(permiso)),
    } as any);
    vi.spyOn(socketModulo, 'useEventos').mockImplementation((evento: string, cb: any) => {
      if (evento === 'pedido:estado') alEstado = cb;
    });

    vi.spyOn(socketModulo, 'useTiempoReal').mockImplementation(() => {});
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: [mio1, mio2], orden: ['102', '101'], paso: [], ruta: [] });
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([disp1, disp2, disp3]);
    vi.spyOn(repartosApi, 'listarProximos').mockResolvedValue([proximo]);
    vi.spyOn(repartosApi, 'listarTodos').mockResolvedValue([entregado]);
    vi.spyOn(repartosApi, 'listarRutasSugeridas').mockResolvedValue({ opciones: [], sinUbicacion: [], cupo: 3 });
    vi.spyOn(repartosApi, 'obtenerConfig').mockResolvedValue(configCon(5));
    vi.spyOn(repartosApi, 'obtenerResumenRepartidor').mockImplementation(async (id: string) => resumenDe(id));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const esperarMapa = async () => {
    await screen.findByTestId('marcador-201');
    await waitFor(() => expect(screen.queryByText(/Cargando información de reparto/)).toBeNull());
  };

  const sinMios = () => {
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: [], orden: [], paso: [], ruta: [] });
  };

  const presionarLargo = (el: HTMLElement) => {
    vi.useFakeTimers();
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    vi.useRealTimers();
  };

  it('0. la barra muestra «por tomar» y «mis pedidos» con lo que ya ve este repartidor', async () => {
    montar();
    await esperarMapa();
    expect(screen.getByTestId('cuenta-por-tomar').textContent).toBe('3');
    expect(screen.getByTestId('cuentas-repartidor').textContent).toBe('3 por tomar, 2 en mis pedidos');
    expect(screen.getByTestId('cuenta-mis-pedidos').textContent).toBe('2');
  });

  it('1. barra inferior con tres botones grandes y sin vista de tarjetas ni pestañas', async () => {
    montar();
    await esperarMapa();

    const barra = screen.getByRole('navigation', { name: 'Navegación del repartidor' });
    const botones = within(barra).getAllByRole('button');
    expect(botones.map((b) => b.textContent)).toEqual(['Pedidos3', 'Mis pedidos2', 'Más']);
    botones.forEach((b) => expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(44));

    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByTestId('tarjeta-pedido-101')).toBeNull();
    expect(screen.queryByTestId('candidato-pedido-201')).toBeNull();
    expect(screen.queryByTestId('cabecera-repartidor')).toBeNull();
    expect(screen.getByTestId('mapa-repartidor')).toBeInTheDocument();
    expect(screen.getByTestId('marcador-sede')).toBeInTheDocument();
  });

  it('2. marcadores con nombre y código, color por espera y próximos en gris', async () => {
    montar();
    await esperarMapa();

    expect(screen.getByTestId('marcador-201')).toHaveAttribute('data-color', 'verde');
    expect(screen.getByTestId('marcador-203')).toHaveAttribute('data-color', 'amarillo');
    expect(screen.getByTestId('marcador-202')).toHaveAttribute('data-color', 'rojo');
    expect(screen.getByTestId('marcador-201')).toHaveTextContent('Ana Belen');
    expect(screen.getByTestId('marcador-201')).toHaveTextContent('CP-0201');

    const gris = screen.getByTestId('marcador-401');
    expect(gris).toHaveAttribute('data-color', 'gris');
    expect(gris).toHaveTextContent('Pedro Gris');
    expect(gris).toHaveTextContent('En cocina');
    expect(gris).toHaveAccessibleName(/no disponible/);
  });

  it('3. en Mis pedidos los puntos van numerados en el orden de la ruta del servidor y con su línea', async () => {
    montar();
    await esperarMapa();
    fireEvent.click(screen.getByRole('button', { name: 'Mis pedidos' }));

    await waitFor(() => expect(screen.getByTestId('marcador-102')).toHaveAttribute('data-numero', '1'));
    expect(screen.getByTestId('marcador-101')).toHaveAttribute('data-numero', '2');
    expect(screen.queryByTestId('marcador-201')).toBeNull();
    expect(screen.queryByTestId('marcador-401')).toBeNull();
    const ultima = leaflet.polilinea.mock.calls.at(-1)![0] as number[][];
    expect(ultima).toHaveLength(3); // sede + 2 paradas
    expect(ultima[1]).toEqual([-12.07, -77.05]);
  });

  it('4. armar la ruta tocando puntos: orden, línea, quitar y chip', async () => {
    montar();
    await esperarMapa();
    expect(screen.getByTestId('chip-ruta')).toHaveTextContent('Mi ruta: 0 de 3');

    fireEvent.click(screen.getByTestId('marcador-202'));
    fireEvent.click(screen.getByTestId('marcador-201'));

    expect(screen.getByTestId('chip-ruta')).toHaveTextContent('Mi ruta: 2 de 3');
    expect(screen.getByTestId('marcador-202')).toHaveAttribute('data-numero', '1');
    expect(screen.getByTestId('marcador-201')).toHaveAttribute('data-numero', '2');
    const linea = leaflet.polilinea.mock.calls.at(-1)![0] as number[][];
    expect(linea.slice(1)).toEqual([[-12.068, -77.048], [-12.065, -77.045]]);

    // tocar de nuevo lo quita y el otro sube al 1
    fireEvent.click(screen.getByTestId('marcador-202'));
    expect(screen.getByTestId('chip-ruta')).toHaveTextContent('Mi ruta: 1 de 3');
    expect(screen.getByTestId('marcador-201')).toHaveAttribute('data-numero', '1');

    fireEvent.click(screen.getByTestId('btn-limpiar-ruta'));
    expect(screen.getByTestId('chip-ruta')).toHaveTextContent('Mi ruta: 0 de 3');
  });

  it('5. el límite sale de la configuración y no deja agregar más', async () => {
    sinMios();
    vi.spyOn(repartosApi, 'obtenerConfig').mockResolvedValue(configCon(2));
    montar();
    await esperarMapa();
    await waitFor(() => expect(screen.getByTestId('chip-ruta')).toHaveTextContent('de 2'));

    fireEvent.click(screen.getByTestId('marcador-201'));
    fireEvent.click(screen.getByTestId('marcador-202'));
    fireEvent.click(screen.getByTestId('marcador-203'));

    expect(screen.getByTestId('chip-ruta')).toHaveTextContent('Mi ruta: 2 de 2');
    expect(screen.getByTestId('marcador-203')).toHaveAttribute('data-numero', '');
    expect(screen.getByRole('alert')).toHaveTextContent('máximo de 2');
  });

  it('6. un pedido gris no se puede agregar a la ruta', async () => {
    montar();
    await esperarMapa();

    fireEvent.click(screen.getByTestId('marcador-401'));

    expect(screen.getByTestId('chip-ruta')).toHaveTextContent('Mi ruta: 0 de 3');
    expect(screen.getByTestId('marcador-401')).toHaveAttribute('data-numero', '');
    expect(screen.getByRole('alert')).toHaveTextContent('CP-0401 aún no está disponible');
    expect(screen.getByTestId('marcador-401')).not.toHaveAttribute('aria-pressed');
  });

  it('7. Tomar ruta pide confirmar Sí/No y envía los ids en el orden elegido', async () => {
    const tomar = vi.spyOn(repartosApi, 'tomarRuta').mockResolvedValue({});
    montar();
    await esperarMapa();
    fireEvent.click(screen.getByTestId('marcador-202'));
    fireEvent.click(screen.getByTestId('marcador-201'));

    fireEvent.click(screen.getByTestId('btn-tomar-ruta'));
    expect(screen.getByText('¿Tomar esta ruta?')).toBeInTheDocument();
    expect(tomar).not.toHaveBeenCalled();

    // No: no llama
    fireEvent.click(screen.getByText('No, cancelar'));
    expect(tomar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('btn-tomar-ruta'));
    fireEvent.click(screen.getByText('Sí, confirmar'));
    await waitFor(() => expect(tomar).toHaveBeenCalledWith(['202', '201']));
    // pasa a Mis pedidos y la ruta armada se limpia
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mis pedidos' })).toHaveAttribute('aria-current', 'page'));
  });

  it('8. si el servidor responde 409 muestra su mensaje y refresca los pedidos', async () => {
    vi.spyOn(repartosApi, 'tomarRuta').mockRejectedValue(new ErrorApi('CONFLICTO', 'Otro repartidor ya tomó CP-0202', 409));
    const disponibles = vi.spyOn(repartosApi, 'listarDisponibles');
    montar();
    await esperarMapa();
    const llamadas = disponibles.mock.calls.length;
    fireEvent.click(screen.getByTestId('marcador-202'));
    fireEvent.click(screen.getByTestId('btn-tomar-ruta'));
    fireEvent.click(screen.getByText('Sí, confirmar'));

    await waitFor(() => expect(screen.getByText('Otro repartidor ya tomó CP-0202')).toBeInTheDocument());
    expect(disponibles.mock.calls.length).toBeGreaterThan(llamadas);
    expect(screen.getByRole('button', { name: 'Pedidos' })).toHaveAttribute('aria-current', 'page');
  });

  it('9. mantener presionado abre las opciones y Ver detalles abre la hoja con el detalle', async () => {
    montar();
    await esperarMapa();

    // un toque corto no abre el menú
    vi.useFakeTimers();
    fireEvent.pointerDown(screen.getByTestId('marcador-201'), { pointerId: 1, clientX: 5, clientY: 5 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.pointerUp(screen.getByTestId('marcador-201'), { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    vi.useRealTimers();
    expect(screen.queryByRole('menu')).toBeNull();

    presionarLargo(screen.getByTestId('marcador-201'));
    const menu = screen.getByRole('menu', { name: 'Opciones del pedido CP-0201' });
    expect(within(menu).getByRole('menuitem', { name: 'Agregar a mi ruta' })).toBeInTheDocument();
    // soltar tras la presión larga no cuenta como toque: no entra a la ruta
    fireEvent.click(screen.getByTestId('marcador-201'));
    expect(screen.getByTestId('chip-ruta')).toHaveTextContent('Mi ruta: 0 de 3');

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Ver detalles' }));
    const hoja = await screen.findByRole('dialog', { name: 'Pedido CP-0201' });
    await within(hoja).findByTestId('detalle-pedido');
    expect(hoja).toHaveTextContent('Sin ají');
    expect(hoja).toHaveTextContent('2 x Pollo a la brasa');
    expect(hoja).toHaveTextContent('Listo en tienda');
    expect(hoja).toHaveTextContent('Breña');
    // el mapa sigue en pantalla y la hoja no es modal
    expect(screen.getByTestId('mapa-repartidor')).toBeInTheDocument();
    expect(hoja).toHaveAttribute('aria-modal', 'false');
    expect(repartosApi.obtenerResumenRepartidor).toHaveBeenCalledWith('201');
  });

  it('10. por teclado: Enter toca y Shift+Enter abre las opciones', async () => {
    montar();
    await esperarMapa();
    fireEvent.keyDown(screen.getByTestId('marcador-201'), { key: 'Enter', shiftKey: true });
    expect(screen.getByRole('menu', { name: 'Opciones del pedido CP-0201' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('11. un pedido gris mantenido presionado muestra su estado, solo lectura y «Aún no disponible»', async () => {
    vi.spyOn(repartosApi, 'obtenerResumenRepartidor').mockResolvedValue(
      resumenDe('401', { estado: 'EN_COCINA', estadoTexto: 'En cocina', puedeTomar: false, motivoNoTomar: 'Aún en cocina' }),
    );
    montar();
    await esperarMapa();

    presionarLargo(screen.getByTestId('marcador-401'));
    const menu = screen.getByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: /ruta/ })).toBeNull();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Ver detalles' }));

    const aviso = await screen.findByTestId('aviso-no-disponible');
    expect(aviso).toHaveTextContent('Aún no disponible: En cocina');
    expect(screen.queryByTestId('btn-tomar-401')).toBeNull();
    expect(screen.queryByTestId('btn-ruta-401')).toBeNull();
  });

  describe('hoja inferior', () => {
    const abrirDetalleMio = async () => {
      montar();
      await esperarMapa();
      fireEvent.click(screen.getByRole('button', { name: 'Mis pedidos' }));
      await waitFor(() => expect(screen.getByTestId('marcador-101')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('marcador-101'));
      await screen.findByTestId('detalle-pedido');
    };

    it('12. de un pedido mío muestra dirección y teléfono, y se cierra con Cerrar y con Escape', async () => {
      await abrirDetalleMio();
      const hoja = screen.getByRole('dialog', { name: 'Pedido CP-0101' });
      expect(hoja).toHaveTextContent('Av. Brasil 1234');
      expect(hoja).toHaveTextContent('987654321');

      fireEvent.click(within(hoja).getByRole('button', { name: 'Cerrar' }));
      expect(screen.queryByTestId('hoja-inferior')).toBeNull();

      fireEvent.click(screen.getByTestId('marcador-101'));
      await screen.findByTestId('detalle-pedido');
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('hoja-inferior')).toBeNull();
    });

    it('12b. Chatear por WhatsApp en mi pedido vigente abre el chat de ese pedido dentro de la pantalla', async () => {
      const spyChat = vi.spyOn(repartosApi, 'obtenerChat').mockResolvedValue({ disponible: true, cliente: { nombre: 'Rosa Sanchez', telefono: '***4321' }, ventanaAbierta: true, atendidoPorLocal: false, mensajes: [] });
      await abrirDetalleMio();
      fireEvent.click(screen.getByTestId('btn-chatear-101'));
      const chat = await screen.findByRole('dialog', { name: 'Chat de WhatsApp del pedido CP-0101' });
      expect(spyChat).toHaveBeenCalledWith('101');
      expect(within(chat).getByText('Aún no hay mensajes desde que se creó el pedido.')).toBeInTheDocument();
      expect(screen.queryByTestId('hoja-inferior')).toBeNull();
    });

    it('12d. mi pedido en curso trae «Proponer ubicación real» (la pantalla del repartidor llega a la propuesta)', async () => {
      await abrirDetalleMio();
      expect(within(screen.getByTestId('detalle-pedido')).getByRole('button', { name: /Proponer ubicación real del pedido CP-0101/ })).toBeInTheDocument();
    });

    it('12c. el enlace viejo wa.me ya no sale: queda «Llamar» y el chat de WhatsApp de la app', async () => {
      await abrirDetalleMio();
      const detalle = screen.getByTestId('detalle-pedido');
      expect(within(detalle).getByRole('link', { name: 'Llamar' })).toBeInTheDocument();
      expect(detalle.querySelector('a[href*="wa.me"]')).toBeNull();
      expect(screen.getByTestId('btn-chatear-101')).toBeInTheDocument();
    });

    it('13. se cierra deslizando el asa hacia abajo; un deslizamiento corto no la cierra', async () => {
      await abrirDetalleMio();
      const asa = screen.getByTestId('hoja-asa');

      fireEvent.pointerDown(asa, { pointerId: 1, clientY: 300 });
      fireEvent.pointerMove(asa, { pointerId: 1, clientY: 330 });
      fireEvent.pointerUp(asa, { pointerId: 1, clientY: 330 });
      expect(screen.getByTestId('hoja-inferior')).toBeInTheDocument();

      fireEvent.pointerDown(asa, { pointerId: 1, clientY: 300 });
      fireEvent.pointerMove(asa, { pointerId: 1, clientY: 420 });
      fireEvent.pointerUp(asa, { pointerId: 1, clientY: 420 });
      expect(screen.queryByTestId('hoja-inferior')).toBeNull();
    });

    it('14. acciones de mi pedido según su estado, con Confirmar Sí/No', async () => {
      const spySalir = vi.spyOn(repartosApi, 'salir').mockResolvedValue({} as any);
      // 101 es el que le toca (orden 1): con el orden obligatorio solo ese puede salir
      vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: [{ ...mio1, ordenRuta: 1 }, { ...mio2, ordenRuta: 2 }], orden: ['101', '102'], paso: [], ruta: [] });
      await abrirDetalleMio();

      const btn = screen.getByTestId('btn-salir-101');
      expect(btn).toHaveTextContent('Ya salió');
      fireEvent.click(btn);
      expect(spySalir).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Sí, confirmar'));
      await waitFor(() => expect(spySalir).toHaveBeenCalledWith('101'));
    });

    it('15. Reportar problema abre el modal de falla', async () => {
      await abrirDetalleMio();
      fireEvent.click(screen.getByTestId('btn-reportar-101'));
      expect(await screen.findByRole('heading', { name: /Reportar entrega fallida/i })).toBeInTheDocument();
    });

    it('16. aislamiento: de un pedido disponible no se ve teléfono ni dirección y se puede agregar a la ruta', async () => {
      montar();
      await esperarMapa();
      presionarLargo(screen.getByTestId('marcador-201'));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Ver detalles' }));
      await screen.findByTestId('detalle-pedido');

      expect(screen.getByTestId('detalle-pedido')).not.toHaveTextContent('Av. Arica');
      expect(screen.queryByRole('link', { name: 'Llamar' })).toBeNull();
      expect(screen.queryByTestId('btn-salir-201')).toBeNull();

      fireEvent.click(screen.getByTestId('btn-ruta-201'));
      expect(screen.getByTestId('chip-ruta')).toHaveTextContent('Mi ruta: 1 de 3');
      expect(screen.getByTestId('btn-ruta-201')).toHaveTextContent('Quitar de mi ruta');
    });

    it('17. Tomar solo este pedido usa la acción de siempre con confirmación', async () => {
      const spyTomar = vi.spyOn(repartosApi, 'tomarPedido').mockResolvedValue({} as any);
      montar();
      await esperarMapa();
      presionarLargo(screen.getByTestId('marcador-201'));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Ver detalles' }));
      fireEvent.click(await screen.findByTestId('btn-tomar-201'));
      fireEvent.click(screen.getByText('Sí, confirmar'));
      await waitFor(() => expect(spyTomar).toHaveBeenCalledWith('201'));
    });
  });

  it('18. menú Más: perfil, hechos hoy con el efectivo a liquidar, reportar falla y cerrar sesión', async () => {
    montar();
    await esperarMapa();

    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    const menu = screen.getByRole('menu', { name: 'Más opciones' });
    expect(within(menu).getByRole('menuitem', { name: /Mi perfil/ })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /Reportar falla/ })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: /Rutas sugeridas/ })).toBeNull();

    fireEvent.click(within(menu).getByRole('menuitem', { name: /Hechos hoy/ }));
    const hoja = await screen.findByRole('dialog', { name: 'Hechos hoy' });
    expect(within(hoja).getByTestId('total-efectivo-liquidar')).toHaveTextContent('S/ 50.00');
    expect(within(hoja).getByTestId('hecho-pedido-301')).toBeInTheDocument();
    fireEvent.click(within(hoja).getByRole('button', { name: 'Cerrar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Cerrar sesión/ }));
    fireEvent.click(screen.getByText('Sí, cerrar sesión'));
    await waitFor(() => expect(salirSesion).toHaveBeenCalled());
  });

  it('19. Reportar falla desde Más elige el pedido y abre el modal', async () => {
    montar();
    await esperarMapa();
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Reportar falla/ }));
    fireEvent.click(await screen.findByTestId('btn-falla-102'));
    expect(await screen.findByRole('heading', { name: /Reportar entrega fallida/i })).toBeInTheDocument();
  });

  it('20. Rutas sugeridas aparece en Más solo si hoy existen', async () => {
    vi.spyOn(repartosApi, 'listarRutasSugeridas').mockResolvedValue({
      opciones: [{ id: 'o1', sector: 'Norte', rumbo: 0, pedidos: [], distanciaKm: 1, tiempoMin: 5, retrasoTotalMin: 0, yaTarde: 0, urgente: false, razon: 'x', puntaje: 1, ruta: [] }],
      sinUbicacion: [],
      cupo: 3,
    });
    montar();
    await esperarMapa();
    await waitFor(() => expect(repartosApi.listarRutasSugeridas).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /Rutas sugeridas/ })).toBeInTheDocument());
  });

  it('21. en vivo: un pedido de la ruta que deja de estar disponible se quita y se avisa', async () => {
    montar();
    await esperarMapa();
    fireEvent.click(screen.getByTestId('marcador-201'));
    fireEvent.click(screen.getByTestId('marcador-202'));
    expect(screen.getByTestId('chip-ruta')).toHaveTextContent('Mi ruta: 2 de 3');

    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([disp2, disp3]);
    act(() => alEstado?.());

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('CP-0201 ya no está disponible y se quitó de tu ruta'));
    expect(screen.getByTestId('chip-ruta')).toHaveTextContent('Mi ruta: 1 de 3');
    // la ruta que sigue en pie conserva su orden: 202 pasa a ser la parada 1
    expect(screen.getByTestId('marcador-202')).toHaveAttribute('data-numero', '1');
    expect(screen.queryByTestId('marcador-201')).toBeNull();
  });

  it('22. en vivo: un pedido en cocina que pasa a LISTO se vuelve elegible sin recargar', async () => {
    montar();
    await esperarMapa();
    expect(screen.getByTestId('marcador-401')).toHaveAttribute('data-color', 'gris');

    vi.spyOn(repartosApi, 'listarProximos').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([disp1, disp2, disp3, crearMockPedido({ id: '401', codigo: 'CP-0401', cliente_nombre: 'Pedro Gris', lat: -12.03, lng: -77.0 })]);
    act(() => alEstado?.());

    await waitFor(() => expect(screen.getByTestId('marcador-401')).toHaveAttribute('data-color', 'verde'));
    fireEvent.click(screen.getByTestId('marcador-401'));
    expect(screen.getByTestId('chip-ruta')).toHaveTextContent('Mi ruta: 1 de 3');
  });

  it('23. si no cargan los pedidos avisa en pantalla en vez de dejar el mapa vacío en silencio', async () => {
    vi.spyOn(repartosApi, 'listarDisponibles').mockRejectedValue(new Error('Sin conexión con el servidor'));
    montar();
    await waitFor(() => expect(screen.getByText('Sin conexión con el servidor')).toBeInTheDocument());
  });

  it('24. encuadra la sede y los pedidos visibles al cargar y limita el paneo', async () => {
    montar();
    await esperarMapa();
    expect(leaflet.m.fitBounds).toHaveBeenCalled();
    const [, opciones] = leaflet.m.fitBounds.mock.calls.at(-1)!;
    expect(opciones).toMatchObject({ maxZoom: 17 });
    expect(leaflet.m.setMaxBounds).toHaveBeenCalled();

    leaflet.m.fitBounds.mockClear();
    fireEvent.click(screen.getByTestId('btn-centrar'));
    expect(leaflet.m.fitBounds).toHaveBeenCalledTimes(1);
  });
});

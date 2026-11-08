import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ModalAgotados } from '../ModalAgotados';
import { ModalMerma } from '../ModalMerma';
import { ModalPedirAlmacen } from '../ModalPedirAlmacen';
import { CocinaAdminView } from '../CocinaAdminView';
import * as cocinaApi from '../cocinaApi';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import type { InsumoExistenciaCocina } from '../cocinaTipos';


// Estas pruebas se hacen como CAJERO.
const comoCajero = () => {
  const actual = vi.mocked(sesionModulo.useSesion)();
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ ...actual, usuario: { partyId: '3', nombres: 'Cajera', rol: 'CAJERO' } } as any);
};

describe('Pantalla de Cocina Simple e Intuitiva - Componentes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Jefe de Cocina', rol: 'ADMIN' },
      permisos: ['*'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    });
  });

  describe('1) ModalAgotados: lista agrupada, sin buscar, duraciones y confirmación', () => {
    const cartaMock = [
      {
        tipo: 'PRODUCTO' as const,
        id: '10',
        nombre: 'Waffle de Lúcuma',
        subtitulo: 'Producto · Waffles',
        categoriaNombre: 'Waffles',
        categoriaId: '1',
        precio: 15,
        sabores: [
          { id: '101', nombre: 'Con manjar blanco', disponible: true },
          { id: '102', nombre: 'Con chocolate', disponible: true },
        ],
        opciones: [
          { id: '201', nombre: 'Helado extra', disponible: true, grupoNombre: 'Adicionales' },
        ],
      },
      {
        tipo: 'PRODUCTO' as const,
        id: '20',
        nombre: 'Café Americano',
        subtitulo: 'Producto · Cafetería',
        categoriaNombre: 'Cafetería',
        categoriaId: '2',
        precio: 10,
        sabores: [],
        opciones: [],
      },
    ];

    it('al abrir muestra directamente la lista de productos agrupada por categoría con texto de ayuda', async () => {
      vi.spyOn(cocinaApi, 'buscarItemsDeCarta').mockResolvedValue(cartaMock);
      vi.spyOn(cocinaApi, 'listarAgotados').mockResolvedValue([]);

      render(<ModalAgotados abierto={true} alCerrar={vi.fn()} />);

      // Texto de ayuda reescrito
      expect(
        screen.getByText(
          'El cliente ya no podrá pedirlo en la carta ni en el chatbot. Puedes reactivarlo antes desde esta lista.',
        ),
      ).toBeInTheDocument();

      // Categorías visibles sin escribir nada
      await waitFor(() => {
        expect(screen.getAllByText('Waffles').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Cafetería').length).toBeGreaterThan(0);
        expect(screen.getByText('Waffle de Lúcuma')).toBeInTheDocument();
        expect(screen.getByText('Café Americano')).toBeInTheDocument();
      });
    });

    it('permite filtrar por categoría y por buscador opcional', async () => {
      vi.spyOn(cocinaApi, 'buscarItemsDeCarta').mockResolvedValue(cartaMock);
      vi.spyOn(cocinaApi, 'listarAgotados').mockResolvedValue([]);

      render(<ModalAgotados abierto={true} alCerrar={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Waffle de Lúcuma')).toBeInTheDocument();
      });

      // Combo de categoría: elegir "Cafetería"
      fireEvent.click(screen.getByRole('button', { name: 'Categoría: Todas' }));
      fireEvent.click(screen.getByRole('option', { name: 'Cafetería' }));

      expect(screen.queryByText('Waffle de Lúcuma')).not.toBeInTheDocument();
      expect(screen.getByText('Café Americano')).toBeInTheDocument();

      // Volver a "Todas"
      fireEvent.click(screen.getByRole('button', { name: 'Categoría: Cafetería' }));
      fireEvent.click(screen.getByRole('option', { name: 'Todas' }));
      expect(screen.getByText('Waffle de Lúcuma')).toBeInTheDocument();

      // Buscador opcional
      const input = screen.getByLabelText(/Buscar producto/i);
      fireEvent.change(input, { target: { value: 'Lúcuma' } });

      expect(screen.getByText('Waffle de Lúcuma')).toBeInTheDocument();
      expect(screen.queryByText('Café Americano')).not.toBeInTheDocument();
    });

    it('expande sabores y opciones dentro del producto', async () => {
      vi.spyOn(cocinaApi, 'buscarItemsDeCarta').mockResolvedValue(cartaMock);
      vi.spyOn(cocinaApi, 'listarAgotados').mockResolvedValue([]);

      render(<ModalAgotados abierto={true} alCerrar={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Waffle de Lúcuma')).toBeInTheDocument();
      });

      const btnExpandir = screen.getByRole('button', { name: /Sabores y opciones/i });
      fireEvent.click(btnExpandir);

      expect(screen.getByText('Con manjar blanco')).toBeInTheDocument();
      expect(screen.getByText('Con chocolate')).toBeInTheDocument();
      expect(screen.getByText(/Helado extra/)).toBeInTheDocument();
    });

    it('muestra lo que ya está agotado con hora de regreso y botón Reactivar', async () => {
      vi.spyOn(cocinaApi, 'buscarItemsDeCarta').mockResolvedValue(cartaMock);
      vi.spyOn(cocinaApi, 'listarAgotados').mockResolvedValue([
        {
          id: 'ag-1',
          tipo: 'PRODUCTO',
          alcance: 'HOY',
          duracion: 'HOY',
          productoId: '20',
          productoNombre: 'Café Americano',
          desde: '2026-10-25T01:00:00Z',
          hasta: '2026-10-25T05:00:00Z',
          por: '1',
        },
      ]);

      render(<ModalAgotados abierto={true} alCerrar={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Agotado · Vuelve mañana/i)).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /Reactivar/i }).length).toBeGreaterThan(0);
      });
    });

    it('al pulsar Agotar hoy pide confirmación Sí/No antes de llamar a la API', async () => {
      vi.spyOn(cocinaApi, 'buscarItemsDeCarta').mockResolvedValue(cartaMock);
      vi.spyOn(cocinaApi, 'listarAgotados').mockResolvedValue([]);
      const spyAgotar = vi.spyOn(cocinaApi, 'agotarElemento').mockResolvedValue({ ok: true });

      render(<ModalAgotados abierto={true} alCerrar={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Café Americano')).toBeInTheDocument();
      });

      const btnAgotar = screen.getByLabelText(/Agotar hoy Café Americano/i);
      fireEvent.click(btnAgotar);

      // Confirmar visible
      const btnConfirmar = screen.getByRole('button', { name: /Sí, marcar agotado/i });
      expect(btnConfirmar).toBeInTheDocument();

      fireEvent.click(btnConfirmar);

      await waitFor(() => {
        expect(spyAgotar).toHaveBeenCalledWith({
          tipo: 'PRODUCTO',
          id: '20',
          duracion: 'HOY',
        });
      });
    });
  });

  describe('2) Interruptor de sonido simplificado', () => {
    it('muestra un solo switch pequeño de sonido y recuerda la elección en localStorage', async () => {
      vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([]);
      vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([]);
      vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({
        activa: false,
        minutos: 0,
        pausa: false,
      });

      render(
        <BrowserRouter>
          <CocinaAdminView />
        </BrowserRouter>,
      );

      await waitFor(() => {
        expect(screen.queryByText(/Cargando pantalla/i)).not.toBeInTheDocument();
      });

      // No debe existir "Probar sonido" ni textos largos "Sonido: activado"
      expect(screen.queryByRole('button', { name: /Probar sonido/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/Sonido: activado/i)).not.toBeInTheDocument();

      // Debe existir el switch accesible de sonido
      const switchSonido = screen.getByRole('switch', { name: /Sonido/i });
      expect(switchSonido).toBeInTheDocument();

      // Al alternar cambia el estado y guarda en localStorage
      fireEvent.click(switchSonido);
      expect(localStorage.getItem('caprichos_cocina_silenciado')).toBe('true');

      fireEvent.click(switchSonido);
      expect(localStorage.getItem('caprichos_cocina_silenciado')).toBe('false');
    });
  });

  describe('3) ModalMerma: modal único de mermas con varias líneas y motivos rápidos', () => {
    it('permite agregar múltiples líneas, seleccionar motivos rápidos y confirmar', async () => {
      const insumosMock = [
        { id: '1', nombre: 'Leche entera', unidad: 'lt', stockActual: 10 },
        { id: '2', nombre: 'Café en grano', unidad: 'kg', stockActual: 5 },
      ];
      vi.spyOn(api, 'get').mockResolvedValue(insumosMock);
      const alGuardarSpy = vi.fn();

      render(<ModalMerma abierto={true} alCerrar={vi.fn()} alGuardar={alGuardarSpy} />);

      await waitFor(() => {
        expect(screen.getAllByText('Registrar mermas').length).toBeGreaterThan(0);
        expect(screen.getByText('Línea 1')).toBeInTheDocument();
      });

      // Motivos rápidos visibles
      expect(screen.getByRole('button', { name: 'Se cayó' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Vencido' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mal preparado' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Otro' })).toBeInTheDocument();

      // Llenar cantidad línea 1
      const inputCant1 = screen.getByLabelText(/Cantidad \(lt\)/i);
      fireEvent.change(inputCant1, { target: { value: '2' } });

      // Agregar otra línea
      const btnAgregarLinea = screen.getByRole('button', { name: /\+ Agregar otra línea/i });
      fireEvent.click(btnAgregarLinea);

      expect(screen.getByText('Línea 2')).toBeInTheDocument();
      expect(screen.getByText('Total: 2 líneas para mermar')).toBeInTheDocument();

      // Llenar cantidad línea 2
      const inputsCant = screen.getAllByPlaceholderText('Ej. 1.5');
      fireEvent.change(inputsCant[1], { target: { value: '1' } });

      // Cambiar motivo en línea 2 a 'Vencido'
      const btnsVencido = screen.getAllByRole('button', { name: 'Vencido' });
      fireEvent.click(btnsVencido[1]);

      // Click en Registrar mermas abre diálogo de confirmación
      const btnRegistrar = screen.getByRole('button', { name: /^Registrar mermas$/i });
      fireEvent.click(btnRegistrar);

      const btnSi = screen.getByRole('button', { name: /Sí, registrar mermas/i });
      expect(btnSi).toBeInTheDocument();
      fireEvent.click(btnSi);

      await waitFor(() => {
        expect(alGuardarSpy).toHaveBeenCalledTimes(1);
        const lineasGuardadas = alGuardarSpy.mock.calls[0][0];
        expect(lineasGuardadas).toHaveLength(2);
        expect(lineasGuardadas[0].cantidad).toBe(2);
        expect(lineasGuardadas[1].cantidad).toBe(1);
        expect(lineasGuardadas[1].motivo).toBe('Vencido');
      });
    });

    it('una merma grande (50) se guarda sin pedir ningún código de supervisor', async () => {
      comoCajero();
      vi.spyOn(api, 'get').mockResolvedValue([{ id: '1', nombre: 'Leche entera', unidad: 'lt', stockActual: 10 }]);
      const alGuardarSpy = vi.fn().mockResolvedValue(undefined);

      render(<ModalMerma abierto={true} alCerrar={vi.fn()} alGuardar={alGuardarSpy} />);
      await waitFor(() => {
        expect(screen.getByText('Línea 1')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Ej. 1.5'), { target: { value: '50' } });
      fireEvent.click(screen.getByRole('button', { name: /^Registrar mermas$/i }));
      fireEvent.click(screen.getByRole('button', { name: /Sí, registrar mermas/i }));

      await waitFor(() => expect(alGuardarSpy).toHaveBeenCalledTimes(1));
      expect(screen.queryByText(/autorización del supervisor/i)).toBeNull();
      expect(screen.queryByLabelText(/Código del supervisor/i)).toBeNull();
    });
  });

  describe('4) ModalPedirAlmacen: barras de stock, almacén sin stock y seguimiento en 3 estados', () => {
    const existenciasMock: InsumoExistenciaCocina[] = [
      {
        insumoId: '1',
        nombre: 'Harina de trigo',
        unidad: 'kg',
        stockCocina: 2, // bajo el mínimo (min 5) -> rojo
        stockMinimo: 5,
        stockAlmacen: 20, // tiene almacén
      },
      {
        insumoId: '2',
        nombre: 'Café en grano',
        unidad: 'kg',
        stockCocina: 10, // de sobra (min 3)
        stockMinimo: 3,
        stockAlmacen: 15,
      },
      {
        insumoId: '3',
        nombre: 'Mantequilla artesanal',
        unidad: 'kg',
        stockCocina: 1,
        stockMinimo: 4,
        stockAlmacen: 0, // sin stock en almacén -> atenuado y deshabilitado
      },
    ];

    it('muestra texto obligatorio, ordena primero lo que más falta y muestra barras de stock', async () => {
      vi.spyOn(cocinaApi, 'obtenerExistenciasParaPedir').mockResolvedValue(existenciasMock);
      vi.spyOn(cocinaApi, 'listarPedidosInternos').mockResolvedValue([]);
      vi.spyOn(cocinaApi, 'listarTraslados').mockResolvedValue([]);

      render(<ModalPedirAlmacen abierto={true} alCerrar={vi.fn()} />);

      // Aclaración obligatoria
      expect(
        screen.getByText('Cocina pide, Almacén entrega, Cocina confirma que recibió.'),
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Harina de trigo')).toBeInTheDocument();
        expect(screen.getByText('Café en grano')).toBeInTheDocument();
        expect(screen.getByText('Mantequilla artesanal')).toBeInTheDocument();
      });

      // Stock bajo muestra advertencia
      expect(screen.getByText(/Cocina: 2 kg \(Bajo el mínimo\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Almacén tiene 20 kg/i)).toBeInTheDocument();

      // Cocina con stock suficiente
      expect(screen.getByText(/Aún tienes suficiente/i)).toBeInTheDocument();

      // Almacén sin stock muestra aviso y deshabilita botones
      expect(
        screen.getByText(/Sin stock en almacén · Pídelo a Compras/i),
      ).toBeInTheDocument();
      const btnAumentarSinStock = screen.getByLabelText(/Aumentar Mantequilla artesanal/i);
      expect(btnAumentarSinStock).toBeDisabled();
    });

    it('permite escoger cantidad con botones - y +, y pide confirmación Sí/No', async () => {
      vi.spyOn(cocinaApi, 'obtenerExistenciasParaPedir').mockResolvedValue(existenciasMock);
      vi.spyOn(cocinaApi, 'listarPedidosInternos').mockResolvedValue([]);
      vi.spyOn(cocinaApi, 'listarTraslados').mockResolvedValue([]);
      const alEnviarSpy = vi.fn().mockResolvedValue({ ok: true });

      render(<ModalPedirAlmacen abierto={true} alCerrar={vi.fn()} alEnviar={alEnviarSpy} />);

      await waitFor(() => {
        expect(screen.getByText('Harina de trigo')).toBeInTheDocument();
      });

      const btnMas = screen.getByLabelText(/Aumentar Harina de trigo/i);
      fireEvent.click(btnMas); // 1
      fireEvent.click(btnMas); // 2

      expect(screen.getByText('Total a pedir: 1 insumo')).toBeInTheDocument();

      const btnEnviar = screen.getByRole('button', { name: /Enviar pedido a almacén/i });
      fireEvent.click(btnEnviar);

      const btnSi = screen.getByRole('button', { name: /Sí, enviar pedido/i });
      expect(btnSi).toBeInTheDocument();
      fireEvent.click(btnSi);

      await waitFor(() => {
        expect(alEnviarSpy).toHaveBeenCalledWith({
          items: [
            {
              insumoId: '1',
              insumo: 'Harina de trigo',
              cantidad: 2,
              unidad: 'kg',
            },
          ],
          nota: '',
        });
      });
    });

    it('seguimiento muestra los 3 estados claros y permite confirmar recepción parcial con diferencia', async () => {
      vi.spyOn(cocinaApi, 'obtenerExistenciasParaPedir').mockResolvedValue(existenciasMock);
      vi.spyOn(cocinaApi, 'listarPedidosInternos').mockResolvedValue([
        {
          id: '100',
          area: 'Cocina',
          detalle: {
            items: [{ insumo: 'Azúcar', cantidad: 3, unidad: 'kg' }],
          },
          estado: 'PENDIENTE',
          en: '2026-10-25T02:00:00Z',
        },
      ]);
      vi.spyOn(cocinaApi, 'listarTraslados').mockResolvedValue([
        {
          id: '200',
          insumoId: '1',
          insumoNombre: 'Harina de trigo',
          destino: 'Cocina',
          enviado: 5,
          recibido: null,
          diferencia: null,
          estado: 'POR_RECIBIR',
          enviadoEn: '2026-10-25T02:10:00Z',
        },
      ]);
      const spyConfirmarRecepcion = vi
        .spyOn(cocinaApi, 'confirmarRecepcionTraslado')
        .mockResolvedValue({ ok: true });

      render(<ModalPedirAlmacen abierto={true} alCerrar={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Seguimiento de pedidos/i)).toBeInTheDocument();
      });

      // Ir a la pestaña de seguimiento
      const tabSeguimiento = screen.getByRole('button', { name: /Seguimiento de pedidos/i });
      fireEvent.click(tabSeguimiento);

      // Estados visibles
      await waitFor(() => {
        expect(screen.getByText('Enviado al almacén')).toBeInTheDocument();
        expect(screen.getByText('Almacén ya lo entregó')).toBeInTheDocument();
      });

      // Botón Confirmar recibido en el traslado entregado
      const btnRecibido = screen.getByRole('button', { name: /Confirmar recibido/i });
      fireEvent.click(btnRecibido);

      // Modal de cantidad recibida con recepción parcial (enviaron 5, recibo 4)
      const inputReal = screen.getByLabelText(/Cantidad que realmente llegó a Cocina/i);
      fireEvent.change(inputReal, { target: { value: '4' } });

      // Ver que calcule la diferencia
      expect(screen.getByText(/Diferencia: 1.00 faltante/i)).toBeInTheDocument();

      const btnConfirmarRecibido = screen.getByRole('button', { name: /^Recibido$/i });
      fireEvent.click(btnConfirmarRecibido);

      // Diálogo Sí/No
      const btnSi = screen.getByRole('button', { name: /Sí, confirmar recibido/i });
      fireEvent.click(btnSi);

      await waitFor(() => {
        expect(spyConfirmarRecepcion).toHaveBeenCalledWith('200', 4);
      });
    });
  });
});

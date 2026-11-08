import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ListaEsperaMesa, useListaEspera, colorEspera, minutosEspera } from '../componentes/ListaEsperaMesa';
import { salonApi } from '../api';

vi.mock('../api', () => ({ salonApi: { listarEspera: vi.fn(), asignarEspera: vi.fn() } }));

let alMesa: ((d: any) => void) | undefined;
vi.mock('../../../comun/socket', () => ({
  useEventos: (evento: string, cb: (d: any) => void) => {
    if (evento === 'salon:mesa') alMesa = cb;
  },
}));

const hace = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const pedido = (id: string, nombre: string, min: number) => ({
  pedidoId: id, codigo: `CP-${id}`, estado: 'COLA', nombre, celular: '***321', personas: 2, productos: 3, total: 45, desde: hace(min), minutos: min,
});
const pisos = [
  {
    id: '1', nombre: 'Piso 1', activo: true, cuadriculaAncho: 20, cuadriculaAlto: 12,
    mesas: [
      { id: 'm4', pisoId: '1', tipo: 'MESA', numero: 4, nombre: null, asientos: 4, x: 1, y: 1, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' },
      { id: 'm5', pisoId: '1', tipo: 'MESA', numero: 5, nombre: null, asientos: 4, x: 5, y: 1, ancho: 2, alto: 2, activo: true, estado: 'OCUPADA', pedido: { id: '9', codigo: 'CP-9', mozo: null } },
    ],
  },
] as any;

function Panel({ alAsignado, mesaOfrecida }: { alAsignado?: () => void; mesaOfrecida?: string | null }) {
  const espera = useListaEspera();
  return <ListaEsperaMesa espera={espera} pisos={pisos} alAsignado={alAsignado} mesaOfrecida={mesaOfrecida} />;
}

describe('Lista de espera de mesa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    alMesa = undefined;
  });

  it('colores y minutos: verde <10, óxido 10-19, rojo >=20', () => {
    expect([colorEspera(9), colorEspera(10), colorEspera(19), colorEspera(20)]).toEqual(['verde', 'oxido', 'oxido', 'rojo']);
    expect(minutosEspera(hace(7))).toBe(7);
  });

  it('muestra contador y el orden que manda el servidor (el primero es «Sigue»)', async () => {
    vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 2, items: [pedido('1', 'Miguel', 12), pedido('2', 'Lucía', 3)] } as any);
    render(<Panel />);
    expect(await screen.findByText('Miguel')).toBeInTheDocument();
    expect(screen.getByLabelText('2 en la lista')).toBeInTheDocument();
    const nombres = screen.getAllByText(/Miguel|Lucía/).map((n) => n.textContent);
    expect(nombres[0]).toContain('Miguel');
    expect(screen.getByText('Sigue')).toBeInTheDocument();
    expect(screen.getByLabelText('Espera 12 minutos')).toHaveClass('le-min--oxido');
    expect(screen.getByLabelText('Espera 3 minutos')).toHaveClass('le-min--verde');
  });

  it('estado vacío y estado de error con reintento', async () => {
    vi.mocked(salonApi.listarEspera).mockResolvedValueOnce({ total: 0, items: [] } as any);
    const { unmount } = render(<Panel />);
    expect(await screen.findByText('Nadie espera mesa por ahora.')).toBeInTheDocument();
    unmount();
    vi.mocked(salonApi.listarEspera).mockRejectedValueOnce(new Error('x'));
    render(<Panel />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar la lista de espera');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('banner «Mesa 4 libre» al liberarse una mesa; Asignar pide confirmación y manda la asignación', async () => {
    vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 1, items: [pedido('1', 'Miguel', 9)] } as any);
    vi.mocked(salonApi.asignarEspera).mockResolvedValue({ ok: true } as any);
    const alAsignado = vi.fn();
    render(<Panel alAsignado={alAsignado} />);
    await screen.findByText('Miguel');
    alMesa?.({ mesaId: 'm4', estado: 'LIBRE' });
    expect(await screen.findByText('Mesa 4 libre')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Asignar Mesa 4 a Miguel' }));
    expect(await screen.findByText('¿Asignar esta mesa?')).toBeInTheDocument();
    expect(salonApi.asignarEspera).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, asignar' }));
    await waitFor(() => expect(salonApi.asignarEspera).toHaveBeenCalledWith('1', 'm4'));
    await waitFor(() => expect(alAsignado).toHaveBeenCalled());
  });

  it('«Después» descarta el banner y «No» no asigna', async () => {
    vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 1, items: [pedido('1', 'Miguel', 9)] } as any);
    render(<Panel />);
    await screen.findByText('Miguel');
    alMesa?.({ mesaId: 'm4', estado: 'LIBRE' });
    fireEvent.click(await screen.findByRole('button', { name: 'Después' }));
    expect(screen.queryByText('Mesa 4 libre')).not.toBeInTheDocument();
  });

  it('desde una mesa libre del plano ofrece los pedidos de la lista y confirma', async () => {
    vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 1, items: [pedido('1', 'Miguel', 9)] } as any);
    vi.mocked(salonApi.asignarEspera).mockResolvedValue({ ok: true } as any);
    render(<Panel mesaOfrecida="m4" />);
    expect(await screen.findByText('Sentar en Mesa 4')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Miguel')[1].closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, asignar' }));
    await waitFor(() => expect(salonApi.asignarEspera).toHaveBeenCalledWith('1', 'm4'));
  });

  it('si la mesa ya se ocupó (409) muestra el error y no cierra en falso', async () => {
    vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 1, items: [pedido('1', 'Miguel', 9)] } as any);
    vi.mocked(salonApi.asignarEspera).mockRejectedValue(new Error('La mesa 4 ya está ocupada'));
    render(<Panel />);
    await screen.findByText('Miguel');
    alMesa?.({ mesaId: 'm4', estado: 'LIBRE' });
    fireEvent.click(await screen.findByRole('button', { name: 'Asignar Mesa 4 a Miguel' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, asignar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La mesa 4 ya está ocupada');
  });

  describe('mesa ocupada: confirmación fuerte', () => {
    const ocupada = {
      id: 'm5', pisoId: '1', tipo: 'MESA', numero: 5, nombre: null, asientos: 4, x: 5, y: 1, ancho: 2, alto: 2, activo: true, estado: 'OCUPADA',
      pedido: { id: '9', codigo: 'CP-9', mozo: null, cliente: 'Rosa' },
    };
    const pisosOc = [{ ...pisos[0], mesas: [pisos[0].mesas[0], ocupada] }] as any;
    function PanelOc() {
      const espera = useListaEspera();
      return <ListaEsperaMesa espera={espera} pisos={pisosOc} mesaOfrecida="m5" />;
    }

    it('muestra nombres y código, Enter no confirma, No cancela y no llama al API', async () => {
      vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 1, items: [pedido('1', 'Miguel', 9)] } as any);
      render(<PanelOc />);
      await screen.findByText('Sentar en Mesa 5');
      fireEvent.click(screen.getAllByText('Miguel')[1].closest('button')!);
      const dlg = await screen.findByTestId('le-confirmar-ocupada');
      expect(screen.getByText('Esta mesa está ocupada')).toBeInTheDocument();
      expect(dlg).toHaveTextContent('el pedido de Rosa (CP-9) pasará a la LISTA DE ESPERA y Miguel ocupará la mesa');
      expect(dlg).toHaveTextContent('No se pierde ningún pedido, solo cambia la mesa.');
      expect(screen.getByRole('button', { name: 'No' })).toHaveFocus();
      fireEvent.keyDown(dlg, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(salonApi.asignarEspera).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'No' }));
      expect(screen.queryByTestId('le-confirmar-ocupada')).not.toBeInTheDocument();
      expect(salonApi.asignarEspera).not.toHaveBeenCalled();
    });

    it('«Sí, mover a la lista de espera y asignar» envía forzarOcupada', async () => {
      vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 1, items: [pedido('1', 'Miguel', 9)] } as any);
      vi.mocked(salonApi.asignarEspera).mockResolvedValue({ ok: true } as any);
      render(<PanelOc />);
      await screen.findByText('Sentar en Mesa 5');
      fireEvent.click(screen.getAllByText('Miguel')[1].closest('button')!);
      fireEvent.click(await screen.findByRole('button', { name: 'Sí, mover a la lista de espera y asignar' }));
      await waitFor(() => expect(salonApi.asignarEspera).toHaveBeenCalledWith('1', 'm5', true));
    });

    it('error 409 (pedido cobrado) muestra el mensaje y cierra la confirmación', async () => {
      vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 1, items: [pedido('1', 'Miguel', 9)] } as any);
      vi.mocked(salonApi.asignarEspera).mockRejectedValue(new Error('El pedido CP-9 ya está cobrado o finalizado'));
      render(<PanelOc />);
      await screen.findByText('Sentar en Mesa 5');
      fireEvent.click(screen.getAllByText('Miguel')[1].closest('button')!);
      fireEvent.click(await screen.findByRole('button', { name: 'Sí, mover a la lista de espera y asignar' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('ya está cobrado o finalizado');
      expect(screen.queryByTestId('le-confirmar-ocupada')).not.toBeInTheDocument();
    });

    it('desde el selector «Asignar mesa» se puede tocar una mesa ocupada', async () => {
      vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 1, items: [pedido('1', 'Miguel', 9)] } as any);
      function PanelSel() {
        const espera = useListaEspera();
        return <ListaEsperaMesa espera={espera} pisos={pisosOc} />;
      }
      render(<PanelSel />);
      fireEvent.click(await screen.findByRole('button', { name: 'Asignar mesa a Miguel' }));
      expect(await screen.findByTestId('selector-mesas-croquis')).toBeInTheDocument();
    });
  });

  it('marca «Movido desde Mesa N» en el pedido desplazado', async () => {
    vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 1, items: [{ ...pedido('1', 'Rosa', 9), movidoDesde: 'Mesa 4' }] } as any);
    render(<Panel />);
    expect(await screen.findByText('Movido desde Mesa 4')).toBeInTheDocument();
  });
});

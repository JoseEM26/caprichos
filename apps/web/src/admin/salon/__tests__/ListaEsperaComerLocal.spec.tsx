import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ListaEsperaMesa, useListaEspera } from '../componentes/ListaEsperaMesa';
import { salonApi } from '../api';

vi.mock('../api', () => ({ salonApi: { listarEspera: vi.fn(), asignarEspera: vi.fn(), asignarComerLocal: vi.fn() } }));
vi.mock('../../../comun/socket', () => ({ useEventos: () => undefined }));

const hace = (min: number) => new Date(Date.now() - min * 60000).toISOString();
// «Comer en el local» de la carta: 1 para llevar y 1 aquí (la API solo lo lista si hay una unidad aquí)
const comerLocal = {
  pedidoId: '5',
  codigo: 'CP-W005',
  estado: 'COLA',
  nombre: 'Rosa',
  celular: '***321',
  personas: null,
  productos: 2,
  total: 20,
  desde: hace(6),
  minutos: 6,
  movidoDesde: null,
  pedidoDesde: hace(6),
  origen: 'CARTA_COMER_LOCAL',
  paraLlevar: 1,
  aqui: 1,
  lineas: [
    { nombre: 'Donut', cantidad: 1, paraLlevar: true },
    { nombre: 'Café', cantidad: 1, paraLlevar: false },
  ],
};
const pisos = [
  {
    id: '1', nombre: 'Piso 1', activo: true, cuadriculaAncho: 20, cuadriculaAlto: 12,
    mesas: [
      { id: 'm4', pisoId: '1', tipo: 'MESA', numero: 4, nombre: null, asientos: 4, x: 1, y: 1, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' },
    ],
  },
] as any;

function Panel({ mesaOfrecida }: { mesaOfrecida?: string | null }) {
  const espera = useListaEspera();
  return <ListaEsperaMesa espera={espera} pisos={pisos} mesaOfrecida={mesaOfrecida} />;
}

describe('Comer en el local de la carta en la lista de espera (mozo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tarjeta compacta: nombre, hora, resumen para llevar · aquí y botones Ver pedido y Asignar mesa', async () => {
    vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 1, items: [comerLocal] } as any);
    render(<Panel />);
    expect(await screen.findByText('Rosa')).toBeInTheDocument();
    expect(screen.getByText('Comer en el local', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/🥡 1 para llevar · 1 aquí · CP-W005/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver pedido' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Asignar mesa a Rosa' })).toBeInTheDocument();
  });

  it('«Ver pedido» muestra cada línea con su marca para llevar o aquí', async () => {
    vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 1, items: [comerLocal] } as any);
    render(<Panel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver pedido' }));
    expect(screen.getByText('1 × Donut · para llevar')).toBeInTheDocument();
    expect(screen.getByText('1 × Café · aquí')).toBeInTheDocument();
  });

  it('desde una mesa libre: confirma y llama a comer-local/asignar; el pedido sale de la lista', async () => {
    vi.mocked(salonApi.listarEspera)
      .mockResolvedValueOnce({ total: 1, items: [comerLocal] } as any)
      .mockResolvedValue({ total: 0, items: [] } as any);
    vi.mocked(salonApi.asignarComerLocal).mockResolvedValue({ ok: true } as any);
    render(<Panel mesaOfrecida="m4" />);
    expect(await screen.findByText('Sentar en Mesa 4')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Rosa')[1].closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, asignar' }));
    await waitFor(() => expect(salonApi.asignarComerLocal).toHaveBeenCalledWith('5', 'm4'));
    expect(salonApi.asignarEspera).not.toHaveBeenCalled();
    expect(await screen.findByText('Nadie espera mesa por ahora.')).toBeInTheDocument();
  });

  it('«Asignar mesa» abre el selector de mesas libres', async () => {
    vi.mocked(salonApi.listarEspera).mockResolvedValue({ total: 1, items: [comerLocal] } as any);
    render(<Panel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Asignar mesa a Rosa' }));
    expect(await screen.findByRole('dialog', { name: 'Elige la mesa para Rosa' })).toBeInTheDocument();
  });
});

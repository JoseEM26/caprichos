import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FranjaImpresion } from '../FranjaImpresion';
import { impresionApi } from '../../impresion/impresionApi';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));
vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ usuario: { rol: 'ADMIN' }, tiene: () => true }) }));
vi.mock('../../impresion/impresionApi', () => ({
  impresionApi: {
    obtenerEstado: vi.fn(), listarCola: vi.fn(), listarTrabajos: vi.fn(), vaciarCola: vi.fn(),
    descartarPedido: vi.fn(), descartarTrabajo: vi.fn(), reimprimirTodas: vi.fn(), generarCodigoVinculo: vi.fn(),
  },
}));

const base = { agente: 'conectado', impresora: 'lista', ultimoLatido: null, conteos: {} };
const ok = { conectada: true, estado: 'lista', motivo: null };
const caida = { conectada: false, estado: 'sin_programa', motivo: 'El programa del local no está corriendo' };
const resumenCola = { pendientes: 4, fallidos: 0, vencidos: 0, pendientesAntiguas: 0, minutosAntiguas: 30 };

function montar() {
  return render(
    <MemoryRouter>
      <FranjaImpresion />
    </MemoryRouter>,
  );
}

async function abrir() {
  const chip = await screen.findByTestId('chip-impresion');
  fireEvent.click(chip);
  return chip;
}

describe('chip de impresión de Caja', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(impresionApi.listarCola).mockResolvedValue({ resumen: resumenCola, grupos: [], pagina: 1, paginas: 1 } as any);
    vi.mocked(impresionApi.listarTrabajos).mockResolvedValue({ items: [] } as any);
  });

  it('conectadas y sin cola: chip en verde, sin número y sin aviso', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({ ...base, pendientes: 0, fallidos: 0, impresoras: { ETIQUETERA: ok, TICKETERA: ok } } as any);
    montar();
    const chip = await screen.findByTestId('chip-impresion');
    expect(chip).toHaveAttribute('data-tono', 'ok');
    expect(chip).toHaveAccessibleName('Impresión: Etiquetera conectada, Ticketera conectada');
    expect(screen.queryByTestId('chip-cola')).toBeNull();
    fireEvent.click(chip);
    expect(screen.queryByTestId('franja-impresion')).toBeNull();
  });

  it('falta una máquina sin cola: chip de falla, el panel dice «sin conexión» y el motivo', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({
      ...base, pendientes: 0, fallidos: 0,
      impresoras: { ETIQUETERA: { conectada: false, estado: 'desconectada', motivo: 'Impresora no encontrada' }, TICKETERA: ok },
    } as any);
    montar();
    const chip = await abrir();
    expect(chip).toHaveAttribute('data-tono', 'falla');
    expect(screen.getByTestId('maquina-etiquetera')).toHaveTextContent('Etiquetera: sin conexión');
    expect(screen.getByTestId('maquina-etiquetera')).toHaveTextContent('Impresora no encontrada');
    expect(screen.getByTestId('maquina-ticketera')).toHaveTextContent('Ticketera: conectada');
    expect(screen.queryByTestId('franja-impresion')).toBeNull();
  });

  it('programa apagado: ambas sin conexión y «Instalar programa» resaltado', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({ ...base, agente: 'sin_conexion', pendientes: 0, fallidos: 0, impresoras: { ETIQUETERA: caida, TICKETERA: caida } } as any);
    montar();
    await abrir();
    expect(screen.getByTestId('maquina-etiquetera')).toHaveTextContent('El programa del local no está corriendo');
    expect(screen.getByRole('button', { name: 'Instalar programa de impresión' })).toHaveClass('ci-btn-fuerte');
    expect(screen.getByTestId('estado-programa')).toHaveTextContent('Programa sin conexión');
  });

  it('con cola y una máquina caída: chip ámbar con el número y el panel abre en Estado con el aviso', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({
      ...base, agente: 'sin_conexion', impresora: 'desconectada', pendientes: 4, fallidos: 0,
      impresoras: { ETIQUETERA: caida, TICKETERA: caida },
    } as any);
    montar();
    const chip = await screen.findByTestId('chip-impresion');
    expect(chip).toHaveAttribute('data-tono', 'alerta');
    expect(screen.getByTestId('chip-cola')).toHaveTextContent('4 en cola');
    fireEvent.click(chip);
    expect(screen.getByRole('tab', { name: 'Estado' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('franja-impresion')).toHaveTextContent('Impresora sin conexión: 4 etiqueta(s) en cola');
    expect(screen.getByRole('button', { name: 'Gestionar cola' })).toBeInTheDocument();
  });

  it('con cola y todo conectado: muestra el número pero sin aviso', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({ ...base, pendientes: 3, fallidos: 0, impresoras: { ETIQUETERA: ok, TICKETERA: ok } } as any);
    montar();
    const chip = await abrir();
    expect(chip).toHaveAttribute('data-tono', 'ok');
    expect(screen.getByTestId('chip-cola')).toHaveTextContent('3 en cola');
    expect(screen.queryByTestId('franja-impresion')).toBeNull();
  });

  it('sin detalle por máquina deduce el estado del programa (compatibilidad)', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({ ...base, impresora: 'sin_papel', pendientes: 2, fallidos: 0 } as any);
    montar();
    await abrir();
    expect(screen.getByTestId('franja-impresion')).toBeInTheDocument();
  });

  it('si no se puede consultar el estado no muestra nada', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockRejectedValue(new Error('sin permiso'));
    montar();
    await waitFor(() => expect(impresionApi.obtenerEstado).toHaveBeenCalled());
    expect(screen.queryByTestId('chip-impresion')).toBeNull();
  });

  it('el panel tiene las tres vistas y cada acción sigue disponible', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({
      ...base, agente: 'sin_conexion', impresora: 'desconectada', pendientes: 4, fallidos: 0, ultimoLatido: new Date().toISOString(),
      impresoras: { ETIQUETERA: caida, TICKETERA: caida },
    } as any);
    vi.mocked(impresionApi.generarCodigoVinculo).mockResolvedValue({ codigo: 'ABCD2345@demo.caprichos.pe', expiraEn: '' });
    montar();
    const chip = await abrir();
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Impresión' })).toBeInTheDocument();

    // Estado: prueba por máquina, latido, enlace a Configuración
    expect(screen.getByRole('button', { name: 'Imprimir etiqueta de prueba' })).toBeInTheDocument();
    expect(screen.getByTestId('estado-programa')).toHaveTextContent(/último latido/);
    expect(screen.getByRole('link', { name: 'Ver impresión' })).toHaveAttribute('href', '/admin/configuracion?tab=impresion&seccion=equipos');

    // Cola: resumen, filtros, vaciar con motivo >= 5 letras
    fireEvent.click(screen.getByRole('button', { name: /^Ver cola/ }));
    expect(screen.getByRole('tab', { name: 'Cola' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByTestId('cola-resumen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver: Pendientes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vaciar cola/ })).toBeInTheDocument();

    // Instalar: Windows / Linux, descarga y código de vinculación
    fireEvent.click(screen.getByRole('tab', { name: 'Instalar' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Windows' }));
    expect(screen.getByRole('link', { name: /Descargar el programa de impresión para Windows/ })).toHaveAttribute('href', '/api/agente-impresion/descargar/windows');
    expect(screen.getByRole('tab', { name: 'Linux' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generar código de vinculación' }));
    expect(await screen.findByTestId('codigo-vinculo')).toHaveTextContent('ABCD2345@demo.caprichos.pe');
  });

  it('Gestionar cola del aviso lleva a la vista Cola', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({ ...base, agente: 'sin_conexion', pendientes: 4, fallidos: 0, impresoras: { ETIQUETERA: caida, TICKETERA: caida } } as any);
    montar();
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Gestionar cola' }));
    expect(await screen.findByTestId('vista-cola')).toBeInTheDocument();
  });

  it('se cierra con Escape, con la X y al hacer clic fuera', async () => {
    vi.mocked(impresionApi.obtenerEstado).mockResolvedValue({ ...base, pendientes: 0, fallidos: 0, impresoras: { ETIQUETERA: ok, TICKETERA: ok } } as any);
    montar();
    const chip = await abrir();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('panel-impresion')).toBeNull();
    expect(chip).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(chip);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar impresión' }));
    expect(screen.queryByTestId('panel-impresion')).toBeNull();

    fireEvent.click(chip);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('panel-impresion')).toBeNull();

    // un clic dentro del panel no lo cierra
    fireEvent.click(chip);
    fireEvent.mouseDown(screen.getByTestId('panel-impresion'));
    expect(screen.getByTestId('panel-impresion')).toBeInTheDocument();
  });
});

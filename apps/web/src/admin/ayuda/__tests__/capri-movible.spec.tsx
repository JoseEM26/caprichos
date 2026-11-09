import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AyudaCapri } from '../AyudaCapri';

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<object>('react-router-dom')),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/admin/caja', search: '' }),
}));
vi.mock('../ayudaApi', () => ({
  obtenerContextoAyuda: vi.fn().mockResolvedValue({ activo: true, modulo: 'caja', titulo: 'Caja', rolUsuario: 'Admin', sugerencias: [], enlaces: [] }),
  enviarPreguntaAyuda: vi.fn(),
}));

const CLAVE = 'capri.posicion';
// El contenedor mide 100x100 y arranca en (800,600); se agarra en (850,650)
const bajar = (el: Element) => fireEvent.pointerDown(el, { clientX: 850, clientY: 650, pointerId: 1, pointerType: 'touch', button: 0 });
const mover = (el: Element, x: number, y: number) => fireEvent.pointerMove(el, { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch' });
const subir = (el: Element) => fireEvent.pointerUp(el, { pointerId: 1, pointerType: 'touch' });
const pasar = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

async function montar() {
  await act(async () => {
    render(
      <MemoryRouter>
        <AyudaCapri />
      </MemoryRouter>,
    );
  });
}
const fab = () => screen.getByRole('button', { name: /abrir la ayuda de capri/i });
const caja = () => fab().parentElement as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 800, top: 600, width: 100, height: 100, right: 900, bottom: 700, x: 800, y: 600, toJSON() {},
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Capri movible', () => {
  it('el botón sigue accesible y dice cómo moverlo', async () => {
    await montar();
    expect(fab().getAttribute('aria-label')).toMatch(/mantén presionado para mover/i);
  });

  it('un toque corto abre la ayuda', async () => {
    await montar();
    bajar(fab());
    subir(fab());
    fireEvent.click(fab());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('mantener 450 ms y arrastrar mueve, muestra el aviso, guarda y NO abre la ayuda', async () => {
    await montar();
    bajar(fab());
    pasar(460);
    expect(screen.getByText('Suelta donde quieras')).toBeInTheDocument();
    mover(fab(), 300, 200);
    expect(caja().style.left).toBe('250px');
    expect(caja().style.top).toBe('150px');
    subir(fab());
    fireEvent.click(fab()); // el clic que sigue a soltar
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(CLAVE)!).x).toBeCloseTo(242 / 884, 3);
    expect(screen.queryByText('Suelta donde quieras')).not.toBeInTheDocument();
  });

  it('moverse antes de cumplirse el tiempo cancela el modo mover (era scroll)', async () => {
    await montar();
    bajar(fab());
    pasar(200);
    mover(fab(), 850, 700);
    pasar(400);
    expect(screen.queryByText('Suelta donde quieras')).not.toBeInTheDocument();
    mover(fab(), 300, 200);
    expect(caja().style.left).toBe('');
  });

  it('no sale de la pantalla (margen 8 px)', async () => {
    await montar();
    bajar(fab());
    pasar(460);
    mover(fab(), -500, -500);
    expect(caja().style.left).toBe('8px');
    expect(caja().style.top).toBe('8px');
    mover(fab(), 5000, 5000);
    expect(caja().style.left).toBe('892px');
    expect(caja().style.top).toBe('692px');
  });

  it('no se rompe si localStorage falla al leer o al guardar', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sin storage');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sin storage');
    });
    await montar();
    bajar(fab());
    pasar(460);
    mover(fab(), 300, 200);
    subir(fab());
    expect(caja().style.left).toBe('250px');
  });

  it('teclado: M + flechas mueve de a 20 px, Enter deja, Esc cancela', async () => {
    await montar();
    fireEvent.keyDown(fab(), { key: 'm' });
    expect(screen.getByText('Suelta donde quieras')).toBeInTheDocument();
    fireEvent.keyDown(fab(), { key: 'ArrowLeft' });
    fireEvent.keyDown(fab(), { key: 'ArrowUp' });
    expect(caja().style.left).toBe('780px');
    expect(caja().style.top).toBe('580px');
    fireEvent.keyDown(fab(), { key: 'Escape' });
    expect(caja().style.left).toBe('');

    fireEvent.keyDown(fab(), { key: 'm' });
    fireEvent.keyDown(fab(), { key: 'ArrowLeft' });
    fireEvent.keyDown(fab(), { key: 'Enter' });
    expect(caja().style.left).toBe('780px');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(CLAVE)).not.toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/movida/i);
  });

  it('teclado: Alt+flecha mueve sin entrar al modo', async () => {
    await montar();
    fireEvent.keyDown(fab(), { key: 'ArrowLeft', altKey: true });
    expect(caja().style.left).toBe('780px');
  });

  it('al cambiar el tamaño de la ventana se reajusta dentro de la pantalla', async () => {
    localStorage.setItem(CLAVE, JSON.stringify({ x: 1, y: 1 }));
    await montar();
    expect(caja().style.left).toBe('892px');
    Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true });
    act(() => void window.dispatchEvent(new Event('resize')));
    expect(caja().style.left).toBe('492px');
  });

  it('el panel se abre hacia el lado contrario al botón movido', async () => {
    localStorage.setItem(CLAVE, JSON.stringify({ x: 0, y: 0 }));
    await montar();
    fireEvent.click(fab());
    expect(screen.getByRole('dialog').className).toContain('ayuda-panel--izq');
  });

  it('con el botón a la derecha el panel queda a la derecha', async () => {
    localStorage.setItem(CLAVE, JSON.stringify({ x: 1, y: 1 }));
    await montar();
    fireEvent.click(fab());
    expect(screen.getByRole('dialog').className).not.toContain('ayuda-panel--izq');
  });

  it('«Volver a la esquina original» borra la posición guardada', async () => {
    localStorage.setItem(CLAVE, JSON.stringify({ x: 0, y: 0 }));
    await montar();
    fireEvent.click(fab());
    fireEvent.click(screen.getByRole('button', { name: /volver a la esquina original/i }));
    expect(localStorage.getItem(CLAVE)).toBeNull();
    expect(screen.queryByRole('button', { name: /volver a la esquina original/i })).not.toBeInTheDocument();
  });

  it('«Ocultar por ahora» cierra el panel y deja solo el puntito', async () => {
    await montar();
    fireEvent.click(fab());
    fireEvent.click(screen.getByRole('button', { name: /ocultar por ahora/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agrandar a capri/i })).toBeInTheDocument();
  });
});

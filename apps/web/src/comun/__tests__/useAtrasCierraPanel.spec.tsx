import { describe, it, expect, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { useAtrasCierraPanel } from '../useAtrasCierraPanel';

let abrir: () => void;
let cerrar: () => void;
function Prueba({ activo }: { activo: boolean }) {
  const [a, setA] = useState(false);
  abrir = () => setA(true);
  cerrar = () => setA(false);
  useAtrasCierraPanel(a, () => setA(false), { activo, param: ['chat', '7'], limpiar: ['telefono'] });
  return <div data-testid="p">{a ? 'abierto' : 'lista'}</div>;
}
const atras = () =>
  new Promise<void>((res) => {
    window.addEventListener('popstate', () => setTimeout(res, 0), { once: true });
    window.history.back();
  });

describe('useAtrasCierraPanel', () => {
  beforeEach(() => window.history.replaceState(null, '', '/admin/mensajes'));

  it('móvil: abrir apila, Atrás cierra y se queda en la ruta', async () => {
    const n = window.history.length;
    const { getByTestId } = render(<Prueba activo />);
    act(() => abrir());
    expect(window.history.length).toBe(n + 1);
    expect(window.location.search).toBe('?chat=7');
    await act(atras);
    expect(getByTestId('p').textContent).toBe('lista');
    expect(window.location.pathname).toBe('/admin/mensajes');
    expect(window.location.search).toBe('');
  });

  it('botón ←: cierra deshaciendo la entrada, sin apilar de más al repetir', async () => {
    const { getByTestId } = render(<Prueba activo />);
    const n = window.history.length;
    for (let i = 0; i < 3; i++) {
      act(() => abrir());
      act(() => cerrar());
      await new Promise((r) => setTimeout(r, 20));
      expect(getByTestId('p').textContent).toBe('lista');
    }
    expect(window.location.search).toBe('');
    expect(window.history.length).toBeLessThanOrEqual(n + 1);
  });

  it('entrada directa ?telefono=: limpia el parámetro y Atrás lleva a la lista', async () => {
    window.history.replaceState(null, '', '/admin/mensajes?telefono=999111222');
    const { getByTestId } = render(<Prueba activo />);
    act(() => abrir());
    expect(window.location.search).toBe('?chat=7');
    await act(atras);
    expect(getByTestId('p').textContent).toBe('lista');
    expect(window.location.search).toBe('');
  });

  it('recarga con la entrada ya marcada: no apila otra', () => {
    window.history.replaceState({ atrasPanel: true }, '', '/admin/mensajes?chat=7');
    const n = window.history.length;
    render(<Prueba activo />);
    act(() => abrir());
    expect(window.history.length).toBe(n);
  });

  it('escritorio: no toca el historial', () => {
    const n = window.history.length;
    render(<Prueba activo={false} />);
    act(() => abrir());
    expect(window.history.length).toBe(n);
    expect(window.location.search).toBe('');
  });
});

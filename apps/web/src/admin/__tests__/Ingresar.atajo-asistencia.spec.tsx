import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Ingresar } from '../Ingresar';

const ingresar = vi.fn(async () => ({ debeCambiar: false }));
vi.mock('../../comun/sesion', () => ({
  useSesion: () => ({ ingresar, usuario: null, debeCambiar: false, cargando: false }),
}));
vi.mock('../configuracion/pantallaIngresoApi', async (orig) => ({
  ...(await orig<any>()),
  pantallaIngresoApi: { obtenerPublica: vi.fn(async () => null) },
}));

function Donde() {
  const l = useLocation();
  return <p data-testid="donde">{l.pathname}</p>;
}

function montar(entrada: string) {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/admin/ingresar" element={<Ingresar />} />
        <Route path="*" element={<Donde />} />
      </Routes>
    </MemoryRouter>,
  );
}

const entrar = async () => {
  fireEvent.change(screen.getByLabelText('DNI'), { target: { value: '12345678' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
};

describe('Ingreso: atajo «Marcar mi asistencia»', () => {
  it('muestra el botón, cambia el título y al ingresar lleva a Mi asistencia', async () => {
    montar('/admin/ingresar');
    fireEvent.click(screen.getByRole('button', { name: 'Marcar mi asistencia' }));
    expect(screen.getByText('Ingresa para marcar tu asistencia')).toBeInTheDocument();
    expect(screen.getByTestId('destino-asistencia')).toBeInTheDocument();
    await entrar();
    await waitFor(() => expect(screen.getByTestId('donde')).toHaveTextContent('/admin/mi-asistencia'));
  });

  it('con ?siguiente=/admin/mi-asistencia ya trae el título', () => {
    montar('/admin/ingresar?siguiente=/admin/mi-asistencia');
    expect(screen.getByText('Ingresa para marcar tu asistencia')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar mi asistencia' })).toBeNull();
  });

  it('ignora destinos externos', async () => {
    montar('/admin/ingresar?siguiente=https://evil.example');
    expect(screen.queryByText('Ingresa para marcar tu asistencia')).toBeNull();
    await entrar();
    await waitFor(() => expect(screen.getByTestId('donde')).toHaveTextContent('/admin'));
  });
});

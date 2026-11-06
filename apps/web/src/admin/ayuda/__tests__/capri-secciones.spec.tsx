import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import * as fs from 'fs';
import * as path from 'path';
import { AyudaCapri, rutaConSeccion } from '../AyudaCapri';
import * as ayudaApi from '../ayudaApi';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import { ConfiguracionLocalView } from '../../configuracion/ConfiguracionLocalView';

vi.mock('../ayudaApi', () => ({
  obtenerContextoAyuda: vi.fn(),
  enviarPreguntaAyuda: vi.fn(),
}));

const MANUALES = path.resolve(__dirname, '../../../../../api/src/modulos/ayuda-admin/manuales');

describe('rutaConSeccion', () => {
  it('conserva solo los parámetros que eligen sección (tab, pestana, seccion)', () => {
    expect(rutaConSeccion('/admin/mirest', '?tab=horario&campo=horario-dia-martes')).toBe('/admin/mirest?tab=horario');
    expect(rutaConSeccion('/admin/asistencia', '?pestana=config')).toBe('/admin/asistencia?pestana=config');
    expect(rutaConSeccion('/admin/mirest', '?tab=impresion&seccion=cola&x=1')).toBe('/admin/mirest?tab=impresion&seccion=cola');
    expect(rutaConSeccion('/admin/caja', '')).toBe('/admin/caja');
    expect(rutaConSeccion('/admin/caja', '?pedido=5')).toBe('/admin/caja');
  });
});

function Ubicacion() {
  const l = useLocation();
  return <div data-testid="ubicacion">{l.pathname + l.search}</div>;
}

describe('Capri dentro de una sección de Configuración', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ayudaApi.obtenerContextoAyuda).mockImplementation(async (ruta: string) =>
      ruta.includes('tab=horario')
        ? { activo: true, modulo: 'mirest', titulo: 'Configuración del local', sugerencias: ['¿Cómo cambio el horario de un día?'], enlaces: [] }
        : { activo: true, modulo: 'mirest', titulo: 'Configuración del local', sugerencias: ['¿Dónde se configura cada cosa del sistema?'], enlaces: [] },
    );
  });

  it('manda a la API la ruta con la sección (sin el campo) y muestra las sugerencias de esa sección', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/admin/mirest?tab=horario&campo=horario-dia-martes']}>
          <AyudaCapri />
        </MemoryRouter>,
      );
    });
    expect(ayudaApi.obtenerContextoAyuda).toHaveBeenCalledWith('/admin/mirest?tab=horario');
    fireEvent.click(screen.getByRole('button', { name: /abrir la ayuda de capri/i }));
    expect(await screen.findByText('¿Cómo cambio el horario de un día?')).toBeInTheDocument();
  });

  it('sin sección en la URL muestra las sugerencias generales de Configuración', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/admin/mirest']}>
          <AyudaCapri />
        </MemoryRouter>,
      );
    });
    expect(ayudaApi.obtenerContextoAyuda).toHaveBeenCalledWith('/admin/mirest');
    fireEvent.click(screen.getByRole('button', { name: /abrir la ayuda de capri/i }));
    expect(await screen.findByText('¿Dónde se configura cada cosa del sistema?')).toBeInTheDocument();
  });

  it('el botón de un enlace profundo redirige a la sección y el campo', async () => {
    vi.mocked(ayudaApi.enviarPreguntaAyuda).mockResolvedValue({
      respuesta: 'Se configura en Pagos.',
      enlaces: [{ texto: 'Número de Yape', ruta: '/admin/mirest?tab=pagos&campo=pagos-yape' }],
      estado: 'ok',
    });
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/admin/caja']}>
          <AyudaCapri />
          <Routes><Route path="*" element={<Ubicacion />} /></Routes>
        </MemoryRouter>,
      );
    });
    fireEvent.click(screen.getByRole('button', { name: /abrir la ayuda de capri/i }));
    const entrada = await screen.findByRole('textbox');
    fireEvent.change(entrada, { target: { value: '¿dónde cambio el número de Yape?' } });
    fireEvent.submit(entrada.closest('form')!);
    fireEvent.click(await screen.findByRole('button', { name: /Número de Yape/ }));
    await waitFor(() => expect(screen.getByTestId('ubicacion')).toHaveTextContent('/admin/mirest?tab=pagos&campo=pagos-yape'));
  });
});

describe('Los enlaces de los manuales abren y resaltan el ajuste en la pantalla real', () => {
  const DIAS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ dia_semana: n, dia: ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][n], abre: '14:00', cierra: '22:00', cerrado: false }));

  function montar(url: string) {
    const permisos = ['configuracion/ver', 'configuracion/editar', 'local/ver', 'local/editar'];
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Prueba', rol: 'ADMIN' }, permisos,
      debeCambiar: false, cargando: false, autenticado: true,
      ingresar: vi.fn(), salir: vi.fn(), renovar: vi.fn(), refrescarYo: vi.fn(), marcarClaveCambiada: vi.fn(),
      tiene: (p: string) => permisos.includes(p) || p === 'ADMIN',
    } as any);
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta.includes('/horario')) return DIAS as any;
      if (ruta.includes('/pagos')) return { efectivo: { activo: true }, yape: { activo: true, numero: '' }, plin: { activo: true, numero: '' }, transferencia: { activo: true }, tarjeta: { activo: true } } as any;
      return [] as any;
    });
    return render(<MemoryRouter initialEntries={[url]}><ConfiguracionLocalView /></MemoryRouter>);
  }

  function enlaceDelManual(archivo: string, campo: string): string {
    const texto = fs.readFileSync(path.join(MANUALES, archivo), 'utf-8');
    const m = texto.match(new RegExp(`\\]\\((/admin/mirest\\?[^)\\s]*campo=${campo})\\)`));
    expect(m, `${archivo} debe enlazar ${campo}`).not.toBeNull();
    return m![1];
  }

  beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); (window as any).innerWidth = 1024; });

  it.each([
    ['config-horario.md', 'horario-dia-martes'],
    ['config-pagos.md', 'pagos-yape'],
    ['config-local-datos.md', 'ubicacion-direccion'],
  ])('%s → %s', async (archivo, campo) => {
    montar(enlaceDelManual(archivo, campo));
    await waitFor(() => expect(document.querySelector(`[data-cfg-id="${campo}"]`)).toHaveClass('cfg-resaltado'));
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EscritorioView } from '../EscritorioView';
import * as sesionModulo from '../../../comun/sesion';
import { api } from '../../../comun/api';
import { MATRIZ_PARA_PRUEBA } from './matrizPrueba';

const mio = {
  generadoEn: '2026-10-31T19:00:00.000Z',
  pedidos: {
    porConfirmar: 2,
    enPreparacion: 4,
    enCola: 5,
    listos: 1,
    enReparto: 3,
    noEntregados: 15,
    atrasados: 2,
    tiempoCocinaMin: 11,
    metaCocinaMin: 13,
    porHora: [
      { hora: 14, pedidos: 2 },
      { hora: 15, pedidos: 0 },
      { hora: 16, pedidos: 1 },
    ],
  },
  reservas: { cantidadHoy: 3, proximas: [{ nombre: 'Ana', personas: 4, hora: '20:30' }] },
  mesas: { cantidad: 10, ocupadas: 3, libres: 7 },
  caja: { estado: 'ABIERTA' },
};

function sesionCon(roles: string[], permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '7', nombres: 'Rosa Prueba', rol: roles[0], roles },
    permisos,
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: (p: string) => permisos.some((x) => x === p || x.startsWith(`${p}/`)),
  } as any);
}

function servidor(respuesta: unknown) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/admin/escritorio/mio') return respuesta;
    if (url.startsWith('/admin/escritorio/cumpleanos')) return { ventanaDias: 60, sinFecha: 0, proximos: [{ nombre: 'Luis Paz', rol: 'Mozo', fecha: 'sáb 15 nov', enDias: 7, etiqueta: 'en 7 días' }] };
    return { conteos: {}, notificaciones: [] };
  });
}

const ver = () =>
  render(
    <MemoryRouter>
      <EscritorioView />
    </MemoryRouter>,
  );

describe('Escritorio del personal que no es ADMIN', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('supervisor: cola por estado, pedidos por hora, reservas, mesas y caja, con enlaces y cumpleaños, sin dinero', async () => {
    sesionCon(['SUPERVISOR'], MATRIZ_PARA_PRUEBA.SUPERVISOR);
    const espia = servidor(mio);
    ver();
    expect(await screen.findByRole('button', { name: /Por confirmar: 2/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cola por estado' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pedidos por hora de hoy' })).toBeInTheDocument();
    expect(screen.getByText(/En cocina tardan 11 min en promedio/)).toBeInTheDocument();
    expect(screen.getByText(/Ana · 4 personas/)).toBeInTheDocument();
    expect(screen.getByText('Abierta')).toBeInTheDocument();
    expect(await screen.findByText('Luis Paz', { exact: false })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/s\/\s|VENTAS|TICKET|Yape|POR COBRAR/i);
    // nunca pide el resumen con ventas
    expect(espia.mock.calls.some((c) => String(c[0]).includes('informes/resumen'))).toBe(false);
  });

  it.each(['CAJERO', 'MOZO', 'COCINA', 'ALMACEN', 'REPARTIDOR'])('%s: no pide ventas ni cumpleaños', async (rol) => {
    sesionCon([rol], MATRIZ_PARA_PRUEBA[rol]);
    const espia = servidor({ generadoEn: mio.generadoEn, pedidos: rol === 'ALMACEN' || rol === 'REPARTIDOR' ? undefined : mio.pedidos });
    ver();
    await waitFor(() => expect(espia).toHaveBeenCalledWith('/admin/escritorio/mio'));
    const urls = espia.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('informes/resumen') || u.includes('cumpleanos'))).toBe(false);
    expect(document.body.textContent).not.toMatch(/VENTAS|TICKET|Yape|POR COBRAR|cumpleaños/i);
  });

  it('el mozo ve la cola pero sus cifras no son enlaces a módulos que no tiene', async () => {
    sesionCon(['MOZO'], MATRIZ_PARA_PRUEBA.MOZO);
    servidor({ generadoEn: mio.generadoEn, pedidos: mio.pedidos });
    ver();
    await screen.findByText('Atrasados (más de 13 min)');
    expect(screen.queryByRole('button', { name: /En cola: 5/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('En cola').length).toBeGreaterThan(0);
  });

  it('almacén: solo el stock bajo, con el botón al módulo que tiene', async () => {
    sesionCon(['ALMACEN'], MATRIZ_PARA_PRUEBA.ALMACEN);
    servidor({ generadoEn: mio.generadoEn, stockBajo: { cantidad: 2, insumos: ['Leche', 'Azúcar'] } });
    ver();
    expect(await screen.findByText('Leche')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pedir al proveedor' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pedidos' })).not.toBeInTheDocument();
  });

  it('repartidor: sus repartos, sin pedidos de todo el local', async () => {
    sesionCon(['REPARTIDOR'], MATRIZ_PARA_PRUEBA.REPARTIDOR);
    servidor({ generadoEn: mio.generadoEn, reparto: { propio: true, disponibles: 2, enCamino: 1, entregadosHoy: 4 } });
    ver();
    expect(await screen.findByText('Mis repartos')).toBeInTheDocument();
    expect(screen.getByText('Entregados por mí hoy')).toBeInTheDocument();
    expect(screen.queryByText('Cola por estado')).not.toBeInTheDocument();
  });

  it('marketing: sin cifras, mensaje claro y accesos a sus módulos', async () => {
    sesionCon(['MARKETING'], MATRIZ_PARA_PRUEBA.MARKETING);
    servidor({ generadoEn: mio.generadoEn });
    ver();
    expect(await screen.findByText('Tu escritorio no tiene cifras')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novedades y publicidad' })).toBeInTheDocument();
  });

  it('roles combinados sin ADMIN: escritorio del personal, nunca el de ventas', async () => {
    sesionCon(['CAJERO', 'COCINA'], [...MATRIZ_PARA_PRUEBA.CAJERO, ...MATRIZ_PARA_PRUEBA.COCINA]);
    const espia = servidor({ generadoEn: mio.generadoEn, pedidos: mio.pedidos });
    ver();
    await screen.findByRole('heading', { name: 'Cola por estado' });
    expect(espia.mock.calls.some((c) => String(c[0]).includes('informes/resumen'))).toBe(false);
  });

  it('si falla el servidor muestra un aviso y no cifras en cero', async () => {
    sesionCon(['CAJERO'], MATRIZ_PARA_PRUEBA.CAJERO);
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/admin/escritorio/mio') throw new Error('caído');
      return { conteos: {}, notificaciones: [] };
    });
    ver();
    expect(await screen.findByText(/No se pudo cargar el escritorio/)).toBeInTheDocument();
    expect(screen.queryByText('Por confirmar')).not.toBeInTheDocument();
  });
});

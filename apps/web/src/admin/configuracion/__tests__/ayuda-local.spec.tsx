import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import { ConfiguracionLocalView, CATEGORIAS_CONFIG, idCampoGenerico } from '../ConfiguracionLocalView';
import { CATALOGO } from '../catalogo';

const DIAS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ dia_semana: n, dia: ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][n], abre: '14:00', cierra: '22:00', cerrado: false }));

function montar(url: string) {
  const permisos = ['configuracion/ver', 'configuracion/editar', 'local/ver', 'local/editar', 'zonas/ver', 'zonas/editar'];
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Prueba', rol: 'ADMIN' }, permisos,
    debeCambiar: false, cargando: false, autenticado: true,
    ingresar: vi.fn(), salir: vi.fn(), renovar: vi.fn(), refrescarYo: vi.fn(), marcarClaveCambiada: vi.fn(),
    tiene: (p: string) => permisos.includes(p) || p === 'ADMIN',
  } as any);
  vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
    if (ruta.includes('/horario')) return DIAS as any;
    if (ruta.includes('/pagos')) return { efectivo: { activo: true }, yape: { activo: true, numero: '' }, plin: { activo: true, numero: '' }, transferencia: { activo: true }, tarjeta: { activo: true } } as any;
    if (ruta.includes('/zonas') || ruta.includes('fechas')) return [] as any;
    return {} as any;
  });
  return render(<MemoryRouter initialEntries={[url]}><ConfiguracionLocalView /></MemoryRouter>);
}

describe('Ayuda por campo: pestañas del local, horario, pagos y zonas', () => {
  beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); (window as any).innerWidth = 1024; });

  it('todo campo del formulario genérico (las pestañas con componente propio van aparte) tiene su entrada de catálogo con descripción', () => {
    const ids = new Set(CATALOGO.map((e) => e.id));
    const propias = ['horario', 'pagos', 'zonas', 'demanda', 'reparto', 'parametros', 'chatbot', 'impresion', 'ayuda', 'vouchers', 'ingreso'];
    for (const c of CATEGORIAS_CONFIG.filter((x) => !propias.includes(x.id))) {
      for (const f of c.fields) expect(ids.has(idCampoGenerico(c.id, String(f.k))), `${c.id}.${String(f.k)}`).toBe(true);
    }
  });

  it('los ids de fila de horario y de ayuda de pagos, fechas y zonas existen en el catálogo', () => {
    const ids = new Set(CATALOGO.map((e) => e.id));
    for (const d of ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']) expect(ids.has(`horario-dia-${d}`)).toBe(true);
    for (const i of ['pagos-pg-tarj', 'pagos-pg-yape', 'pagos-pg-plin', 'pagos-pg-transf', 'pagos-banco', 'fechas-fecha', 'fechas-quitar', 'zonas-snap-m', 'zonas-tarifa', 'zonas-minutos']) expect(ids.has(i), i).toBe(true);
  });

  it('un campo genérico muestra su ayuda visible con unidad y aviso de copia local', async () => {
    montar('/admin/configuracion?tab=operacion');
    await waitFor(() => expect(screen.getByRole('textbox', { name: /^Entrega que se le dice al cliente: desde \(minutos\)$/ })).toBeInTheDocument());
    expect(screen.getAllByText(/Es una copia: hoy solo se guarda en este navegador/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unidad: minutos/).length).toBeGreaterThan(0);
  });

  it('?tab=textos&campo=… abre la sección plegada y resalta el campo genérico', async () => {
    montar('/admin/configuracion?tab=textos&campo=textos-enc-link');
    await waitFor(() => {
      const el = document.querySelector('[data-cfg-id="textos-enc-link"]')!;
      expect(el).toHaveClass('cfg-resaltado');
      expect(el.closest('details')!.open).toBe(true);
    });
  });

  it('?tab=horario&campo=horario-dia-martes salta a la fila del martes y la ayuda del horario es visible', async () => {
    montar('/admin/configuracion?tab=horario&campo=horario-dia-martes');
    await waitFor(() => expect(document.querySelector('[data-cfg-id="horario-dia-martes"]')).toHaveClass('cfg-resaltado'));
    expect(screen.getByText(/a que hora|Hora de apertura y cierre de cada día/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Qué pasa si lo cambias/).length).toBeGreaterThan(0);
  });

  it('?tab=pagos monta los medios de pago reales y salta al número de Yape', async () => {
    montar('/admin/configuracion?tab=pagos&campo=pagos-yape');
    await waitFor(() => expect(document.querySelector('[data-cfg-id="pagos-yape"]')).toHaveClass('cfg-resaltado'));
    expect(screen.getByRole('button', { name: /Guardar medios de pago/ })).toBeInTheDocument();
    expect(screen.getByText(/Número al que el cliente envía su pago por Yape/)).toBeInTheDocument();
  });

  it('zonas: ya no existe el bloque legado de polígonos y la ayuda se abre al saltar a la tolerancia de pegado', async () => {
    montar('/admin/configuracion?tab=zonas&campo=zonas-snap-m');
    await waitFor(() => {
      const el = document.querySelector('[data-cfg-id="zonas-snap-m"]')!;
      expect(el).toHaveClass('cfg-resaltado');
      expect(el.closest('details')!.open).toBe(true);
    });
    expect(screen.queryByText(/Polígonos de zonas/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Coordenadas del polígono/)).not.toBeInTheDocument();
  });
});

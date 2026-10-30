import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import { ParametrosOperacionTab, META_PARAMETROS } from '../ParametrosOperacionTab';
import { ConfiguracionLocalView } from '../ConfiguracionLocalView';
import { CATALOGO } from '../catalogo';
import { AYUDA_PARAMETROS, GRUPOS_PARAMETROS, idParametro } from '../catalogo/parametros';
import { AYUDA_REPARTO } from '../catalogo/reparto';
import { SeccionRepartoConfig } from '../SeccionRepartoConfig';

const todas = Object.keys(META_PARAMETROS);

function usarSesion() {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Prueba', rol: 'ADMIN' },
    permisos: ['configuracion/ver', 'configuracion/editar', 'local/ver', 'local/editar'],
    debeCambiar: false, cargando: false, autenticado: true,
    ingresar: vi.fn(), salir: vi.fn(), renovar: vi.fn(), refrescarYo: vi.fn(), marcarClaveCambiada: vi.fn(),
    tiene: () => true,
  } as any);
}

describe('Parámetros: catálogo y ayuda por campo', () => {
  it('cada clave visible de la pestaña tiene ayuda, grupo y entrada de catálogo con su id', () => {
    const ids = new Set(CATALOGO.map((e) => e.id));
    const enGrupos = new Set(GRUPOS_PARAMETROS.flatMap((g) => g.claves));
    for (const clave of todas) {
      expect(AYUDA_PARAMETROS[clave], `ayuda de ${clave}`).toBeTruthy();
      expect(ids.has(idParametro(clave)), `catálogo de ${clave}`).toBe(true);
      expect(enGrupos.has(clave), `grupo de ${clave}`).toBe(true);
    }
    for (const clave of Object.keys(AYUDA_PARAMETROS)) expect(META_PARAMETROS[clave], `META de ${clave}`).toBeTruthy();
  });

  it('cada campo de Reparto tiene entrada de catálogo', () => {
    const ids = new Set(CATALOGO.map((e) => e.id));
    for (const a of Object.values(AYUDA_REPARTO)) expect(ids.has(a.id), a.id).toBe(true);
  });

  it('las filas llevan su data-cfg-id, ayuda visible y «Qué pasa si lo cambias»; los grupos se pliegan', async () => {
    vi.restoreAllMocks();
    usarSesion();
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/configuracion') return [{ clave: 'envio_gratis_monto', valor: 70 }, { clave: 'clave_rara', valor: 1 }];
      return {} as any;
    });
    render(<ParametrosOperacionTab puedeVer puedeEditar />);
    await waitFor(() => expect(document.querySelector('[data-cfg-id="parametros-envio-gratis-monto"]')).toBeTruthy());
    const fila = document.querySelector('[data-cfg-id="parametros-envio-gratis-monto"]') as HTMLElement;
    expect(within(fila).getByText(/Total de productos desde el cual el delivery no cobra envío/)).toBeVisible();
    expect(within(fila).getByText(/Unidad: soles \(S\/\) · Rango: 0 o más · Por defecto: 70/)).toBeInTheDocument();
    fireEvent.click(within(fila).getByRole('button', { name: /Qué pasa si cambias/ }));
    expect(within(fila).getByText('Qué pasa si lo cambias')).toBeInTheDocument();
    expect(within(fila).getByText(/Con 70 en modo/)).toBeInTheDocument();
    // grupos plegables y claves desconocidas en «Otros»
    expect(screen.getByTestId('grupo-parametros-envio').tagName).toBe('DETAILS');
    expect(screen.getByTestId('grupo-parametros-otros')).toHaveTextContent('clave rara');
  });

  it('el modal de edición muestra la ayuda y conserva la etiqueta «Nuevo valor»', async () => {
    vi.restoreAllMocks();
    usarSesion();
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) =>
      (ruta === '/admin/configuracion' ? [{ clave: 'pedido_minimo', valor: 25 }] : {}) as any);
    render(<ParametrosOperacionTab puedeVer puedeEditar />);
    fireEvent.click(await screen.findByRole('button', { name: /^Editar$/ }));
    expect(screen.getByLabelText(/Nuevo valor/i)).toHaveAttribute('aria-describedby', 'ayuda-edicion-parametro-ayuda');
    expect(document.getElementById('ayuda-edicion-parametro-ayuda')).toHaveTextContent(/Con 25/);
  });

  it('Reparto muestra la ayuda de cada campo y la enlaza al input', async () => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue({ retrasadoMin: 20, tardeMin: 30, muyTardeMin: 45, velocidadKmh: 25, maxPedidos: 5 } as any);
    render(<SeccionRepartoConfig puedeEditar />);
    const input = await screen.findByRole('spinbutton', { name: /Máximo de pedidos por repartidor/ });
    expect(input).toHaveAttribute('aria-describedby', 'reparto-max-pedidos-ayuda');
    expect(screen.getByText(/Unidad: pedidos · Rango: 1 a 20 · Por defecto: 5/)).toBeVisible();
    expect(document.querySelector('[data-cfg-id="reparto-max-pedidos"]')).toBeTruthy();
    expect(document.querySelector('[data-cfg-id="reparto-alertas-color"]')).toBeTruthy();
  });
});

describe('Salto a un parámetro con ?tab=parametros&campo=', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    usarSesion();
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) =>
      (ruta === '/admin/configuracion'
        ? [{ clave: 'tiempo_prometido_min', valor: 30 }, { clave: 'envio_gratis_monto', valor: 70 }, { clave: 'impresion_vence_min', valor: 180 }]
        : {}) as any);
  });
  const montar = (url: string) => render(<MemoryRouter initialEntries={[url]}><ConfiguracionLocalView /></MemoryRouter>);

  it('abre el grupo plegado y resalta el parámetro', async () => {
    montar('/admin/configuracion?tab=parametros&campo=parametros-impresion-vence-min');
    await waitFor(() => expect(document.querySelector('[data-cfg-id="parametros-impresion-vence-min"]')).toHaveClass('cfg-resaltado'));
    expect((screen.getByTestId('grupo-parametros-impresion') as HTMLDetailsElement).open).toBe(true);
  });

  it('salta al monto de envío gratis', async () => {
    montar('/admin/configuracion?tab=parametros&campo=parametros-envio-gratis-monto');
    await waitFor(() => expect(document.querySelector('[data-cfg-id="parametros-envio-gratis-monto"]')).toHaveClass('cfg-resaltado'));
  });

  it('salta a un campo de Alta demanda', async () => {
    montar('/admin/configuracion?tab=demanda&campo=demanda-pausa-pedidos');
    await waitFor(() => expect(document.querySelector('[data-cfg-id="demanda-pausa-pedidos"]')).toHaveClass('cfg-resaltado'));
  });
});

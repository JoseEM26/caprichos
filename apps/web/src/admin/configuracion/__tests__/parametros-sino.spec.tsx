import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { api } from '../../../comun/api';
import { ParametrosOperacionTab, META_PARAMETROS } from '../ParametrosOperacionTab';
import { AYUDA_PARAMETROS, GRUPOS_PARAMETROS } from '../catalogo/parametros';

const datos = [
  { clave: 'pago_online_activo', valor: 'no' },
  { clave: 'pago_online_espera_min', valor: 15 },
  { clave: 'clave_nueva_rara', valor: 'si' },
  { clave: 'voucher_mozo_obligatorio', valor: true },
  { clave: 'wa_precio_mensaje', valor: 0.1 },
  { clave: 'evolution_limite_minuto', valor: 3 },
];

function montar() {
  vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => (ruta === '/admin/configuracion' ? datos : ({} as any)));
  return render(<ParametrosOperacionTab puedeVer puedeEditar />);
}

describe('Parámetros: todo sí/no es un interruptor', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('un booleano catalogado (pago_online_activo) se muestra como interruptor y no hay cuadro de texto', async () => {
    montar();
    const interruptor = await screen.findByRole('switch', { name: /Pago en línea encendido/ });
    expect(interruptor).not.toBeChecked();
    const fila = document.querySelector('[data-cfg-id="parametros-pago-online-activo"]') as HTMLElement;
    expect(within(fila).queryByRole('button', { name: /^Editar$/ })).toBeNull();
    expect(within(fila).queryByRole('textbox')).toBeNull();
  });

  it('un toque en un parámetro de riesgo pide confirmar Sí/No y guarda «si»', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({ clave: 'pago_online_activo', valor: 'si' } as any);
    montar();
    fireEvent.click(await screen.findByRole('switch', { name: /Pago en línea encendido/ }));
    expect(put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Sí, cambiar/ }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/configuracion/pago_online_activo', { valor: 'si' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: /Pago en línea encendido/ })).toBeChecked());
  });

  it('una clave no catalogada con valor «si» o true también es interruptor', async () => {
    montar();
    expect(await screen.findByRole('switch', { name: /clave nueva rara/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: /voucher|Mozo obligatorio/i })).toBeChecked();
  });

  it('los números siguen con su campo numérico y unidad', async () => {
    montar();
    await screen.findByRole('switch', { name: /Pago en línea encendido/ });
    const fila = document.querySelector('[data-cfg-id="parametros-pago-online-espera-min"]') as HTMLElement;
    expect(within(fila).getByText('15 minutos')).toBeInTheDocument();
    fireEvent.click(within(fila).getByRole('button', { name: /^Editar$/ }));
    expect(screen.getByLabelText(/Nuevo valor \(minutos\)/)).toHaveAttribute('type', 'number');
  });

  it('las claves con su propia pantalla (wa_*) se ven sin poder editarse', async () => {
    montar();
    const fila = (await waitFor(() => screen.getByText('wa precio mensaje').closest('.cfg-campo'))) as HTMLElement;
    expect(within(fila).queryByRole('button', { name: /^Editar$/ })).toBeNull();
    expect(within(fila).getByText(/Se cambia en su propia pantalla/)).toBeInTheDocument();
  });

  it('el grupo de Evolution y el de pago en línea existen en el catálogo y toda clave sí/no del catálogo es interruptor', () => {
    const titulos = GRUPOS_PARAMETROS.map((g) => g.titulo);
    expect(titulos).toContain('Pago en línea (tarjeta y Yape por Culqi)');
    expect(titulos).toContain('WhatsApp por Evolution');
    for (const [clave, a] of Object.entries(AYUDA_PARAMETROS)) {
      if (a.rango === 'Sí o No') expect(META_PARAMETROS[clave].tipo, clave).toBe('sino');
    }
  });
});

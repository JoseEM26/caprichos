import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartaPublica } from '../CartaPublica';
import { api } from '../../comun/api';

const dest = (id: string, titulo: string, urls: string[]) => ({
  id, titulo, portada_url: urls[0], activo: true, fotos: urls.map((url, i) => ({ id: `${id}-${i}`, url, pie: `${titulo} ${i + 1}` })),
});
const base = {
  decoracion: 'NINGUNO', organizacion: 'SECCIONES', paleta: {}, novedades: [], rankingMes: [],
  destacadas: [
    dest('1', 'Caprichos del mes', ['/archivos/publico/seed/frappe_oreo.webp', '/archivos/publico/seed/waffle_oreo.webp']),
    dest('2', 'Momentos Caprichos', ['/imagenes/caprichos/fantasma-cafe.webp', '/imagenes/caprichos/donuts-halloween.webp']),
  ],
};
function montar(contenido: any) {
  vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => (ruta === '/carta' ? [] : ruta === '/carta/contenido' ? contenido : null));
  render(<MemoryRouter><CartaPublica /></MemoryRouter>);
}

describe('Carta: círculos «Caprichos del mes» y «Momentos Caprichos»', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('muestra los dos círculos y el visor pasa de foto', async () => {
    montar(base);
    await waitFor(() => expect(screen.getByLabelText('Ver fotos: Caprichos del mes')).toBeTruthy());
    expect(screen.getByLabelText('Ver fotos: Momentos Caprichos')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Ver fotos: Caprichos del mes'));
    expect(screen.getByText('Caprichos del mes 1')).toBeTruthy();
  });

  it('respeta la disposición que oculta Momentos', async () => {
    const ids = ['mes', 'franja', 'momentos', 'novedades', 'categorias'];
    montar({ ...base, disposicion: { secciones: ids.map((id) => ({ id, visible: id !== 'momentos' })) } });
    await waitFor(() => expect(screen.getByText('Cargando', { exact: false })).toBeTruthy()).catch(() => {});
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByLabelText('Ver fotos: Caprichos del mes')).toBeNull();
  });
});

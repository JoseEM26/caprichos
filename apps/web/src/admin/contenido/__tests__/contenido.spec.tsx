import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PortadaCarta } from '../../../carta/PortadaCarta';
import { PaginaNovedades } from '../../../carta/PaginaNovedades';
import { VisorHistoriasModal } from '../../../carta/contenido/VisorHistoriasModal';
import { DestacadasView } from '../DestacadasView';
import { CartaPublica } from '../../../carta/CartaPublica';
import { api } from '../../../comun/api';

vi.mock('../../../carta/useEsMovil', () => ({ useEsMovil: () => false }));

describe('Carta pública: contenido administrable', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('la portada muestra el banner que viene del administrativo', () => {
    render(<PortadaCarta datosLocal={null} estadoLocal={null} fotoDestacada={null}
      banner={{ activo: true, tag: 'ETQ', title: 'Título X', sub: 'Sub X' }} onPedir={() => {}} onVerCarta={() => {}} />);
    expect(screen.getByText('Título X')).toBeTruthy();
  });

  it('la portada oculta el banner si está desactivado o vacío', () => {
    render(<PortadaCarta datosLocal={null} estadoLocal={null} fotoDestacada={null}
      banner={{ activo: false, title: 'Oculto' }} onPedir={() => {}} onVerCarta={() => {}} />);
    expect(screen.queryByText('Oculto')).toBeNull();
  });

  it('novedades: estado vacío real y filtro por tipo', () => {
    const base = { orden: 0, activo: true, fotos: [] };
    const { rerender } = render(<PaginaNovedades novedades={[]} onVerCarta={() => {}} />);
    expect(screen.getByText('Aún no hay novedades')).toBeTruthy();
    rerender(<PaginaNovedades onVerCarta={() => {}} novedades={[
      { ...base, id: '1', tipo: 'AVISO', titulo: 'Aviso uno' },
      { ...base, id: '2', tipo: 'VIDEO', titulo: 'Video dos' },
    ]} />);
    fireEvent.click(screen.getByText('Videos'));
    expect(screen.queryByText('Aviso uno')).toBeNull();
    expect(screen.getByText('Video dos')).toBeTruthy();
  });

  it('visor de historias muestra leyenda, avanza entre fotos y cierra con ×', () => {
    const onCerrar = vi.fn();
    render(
      <VisorHistoriasModal
        destacadaIdxInicial={0}
        onCerrar={onCerrar}
        historias={[
          {
            id: 'h1',
            titulo: 'Clientes felices',
            portada_url: '/archivos/publico/seed/frappe_oreo.webp',
            fotos: [
              { id: 'f1', url: '/archivos/publico/seed/frappe_oreo.webp#idx=0&pie=Tarde+con+amigos' },
              { id: 'f2', url: '/archivos/publico/seed/waffle_oreo.webp', pie: 'Celebrando en Caprichos' },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText('Clientes felices')).toBeTruthy();
    expect(screen.getByText('Tarde con amigos')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Siguiente'));
    expect(screen.getByText('Celebrando en Caprichos')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('módulo administrativo Destacadas de la carta edita círculos, abre el visor y publica con confirmación', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([
      {
        id: 'd1',
        titulo: 'Clientes felices',
        portada_url: '/archivos/publico/seed/frappe_oreo.webp',
        orden: 0,
        activo: true,
        archivada: false,
        fotos: [
          { id: 'i1', url: '/archivos/publico/seed/frappe_oreo.webp#idx=0&pie=Tarde+con+amigos', orden: 0 },
        ],
      },
    ]);
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({});
    vi.spyOn(api, 'post').mockResolvedValue({});

    render(<DestacadasView />);

    await waitFor(() => {
      expect(screen.getByText(/1 visibles en la carta/)).toBeTruthy();
    });

    // Abrir vista previa del visor 9:16
    fireEvent.click(screen.getByText('▶ Ver como cliente'));
    expect(screen.getByRole('dialog', { name: 'Vista de la destacada Clientes felices' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Cerrar'));

    // Publicar con confirmación Sí / No
    fireEvent.click(screen.getByText('Publicar en la carta'));
    expect(screen.getByText('¿Publicar las destacadas en la carta?')).toBeTruthy();
    fireEvent.click(screen.getByText('Sí, continuar'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        '/admin/contenido/destacadas/d1',
        expect.objectContaining({ titulo: 'Clientes felices', activo: true }),
      );
      expect(screen.getByText('Publicado en la carta.')).toBeTruthy();
    });
  });

  it('CartaPublica no muestra las 2 tarjetas grandes de promoción y muestra Momentos Caprichos con su visor', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/carta') {
        return [
          {
            id: 'cat-combos',
            nombre: 'COMBOS',
            orden: 0,
            productos: [
              {
                id: 'p1',
                nombre: 'DÚO PARA COMPARTIR',
                descripcion: '2 bebidas frías o calientes + 1 complemento',
                fotoUrl: '/archivos/publico/seed/duo_compartir.webp',
                precio: 33,
                tamanos: [{ id: 't1', nombre: 'Regular 12 oz', precio: 33 }],
                grupos: [],
                sabores: [],
                noSumaBeneficios: false,
                disponible: true,
                agotadoHasta: null,
              },
              {
                id: 'p2',
                nombre: 'DÚO IRRESISTIBLE',
                descripcion: 'Club Sándwich + papas + 2 bebidas',
                fotoUrl: '/archivos/publico/seed/duo_irresistible.webp',
                precio: 37,
                tamanos: [{ id: 't2', nombre: 'Regular 12 oz', precio: 37 }],
                grupos: [],
                sabores: [],
                noSumaBeneficios: false,
                disponible: true,
                agotadoHasta: null,
              },
            ],
          },
        ];
      }
      if (ruta === '/carta/contenido') {
        return {
          decoracion: 'NINGUNO',
          organizacion: 'SECCIONES',
          paleta: {},
          novedades: [],
          destacadas: [
            {
              id: 'dest-1',
              titulo: 'Clientes felices',
              portada_url: '/archivos/publico/seed/frappe_oreo.webp',
              activo: true,
              fotos: [
                { id: 'f1', url: '/archivos/publico/seed/frappe_oreo.webp', pie: 'Tarde con amigos' },
              ],
            },
          ],
          rankingMes: [],
          banner: { activo: true, tag: 'NOVEDAD DEL MES', title: 'Frappe Maracuyá Tropical', sub: 'Con pulpa natural' },
        };
      }
      return null;
    });

    render(
      <MemoryRouter>
        <CartaPublica />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Momentos Caprichos')).toBeTruthy();
    });

    // No existe el bloque de tarjetas grandes de promoción ("PROMOCIÓN" / "Pedir combo")
    expect(screen.queryByText('Pedir combo')).toBeNull();
    // Los dos dúos aparecen únicamente dentro de la sección Combos Dúo
    expect(screen.getByText('Combos Dúo')).toBeTruthy();
    expect(screen.getAllByText('DÚO PARA COMPARTIR')).toHaveLength(1);
    expect(screen.getAllByText('DÚO IRRESISTIBLE')).toHaveLength(1);

    // Al tocar el círculo de Momentos Caprichos se abre el visor con la leyenda
    fireEvent.click(screen.getByLabelText('Ver fotos: Clientes felices'));
    expect(screen.getByText('Tarde con amigos')).toBeTruthy();
  });
});

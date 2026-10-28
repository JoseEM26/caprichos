import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PortadaCarta } from '../../../carta/PortadaCarta';
import { PaginaNovedades } from '../../../carta/PaginaNovedades';
import { VisorHistoriasModal } from '../../../carta/contenido/VisorHistoriasModal';
import { DestacadasView } from '../DestacadasView';
import { NovedadesView } from '../NovedadesView';
import { DisenadorView } from '../DisenadorView';
import { CartaPublica } from '../../../carta/CartaPublica';
import { api } from '../../../comun/api';


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
    expect(screen.getByText('Pronto tendremos novedades para ti')).toBeTruthy();
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

describe('Administrativo: novedades (agregar, editar, eliminar y tamaño)', () => {
  const novedadBase = {
    id: '5',
    tipo: 'PROMOCION',
    titulo: 'Dos por uno',
    texto: 'Solo esta semana',
    tema: null,
    video_url: null,
    evento_fecha: null,
    evento_lugar: null,
    desde: null,
    hasta: null,
    orden: 1,
    activo: true,
    tamano: 'MEDIANO',
    fotos: [],
  };

  async function abrirDisenador() {
    render(<NovedadesView />);
    await waitFor(() => expect(screen.getByText('Abrir el diseñador en pantalla completa')).toBeTruthy());
    fireEvent.click(screen.getByText('Abrir el diseñador en pantalla completa'));
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue([novedadBase]);
  });

  it('agregar: «+ Nueva novedad» abre el formulario y guarda con tamaño por defecto MEDIANO', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ ok: true });
    await abrirDisenador();

    fireEvent.click(screen.getByText('+ Nueva novedad'));
    const dialogo = screen.getByRole('dialog', { name: 'Editar novedad' });
    fireEvent.change(within(dialogo).getByLabelText('Título'), { target: { value: 'Llegó el verano' } });
    fireEvent.click(within(dialogo).getByText('Listo'));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        '/admin/contenido/novedades',
        expect.objectContaining({ titulo: 'Llegó el verano', tamano: 'MEDIANO' }),
      );
    });
  });

  it('eliminar: «No» conserva la novedad; «Sí» la elimina con su id', async () => {
    const delSpy = vi.spyOn(api, 'delete').mockResolvedValue({ ok: true });
    await abrirDisenador();

    fireEvent.click(screen.getByText('Editar'));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Editar novedad' })).getByText('Eliminar'));
    expect(screen.getByText('¿Eliminar esta novedad?')).toBeTruthy();
    expect(screen.getByText('Se quita de la carta y no se puede deshacer.')).toBeTruthy();

    fireEvent.click(screen.getByText('No, conservarla'));
    expect(delSpy).not.toHaveBeenCalled();
    expect(screen.queryByText('¿Eliminar esta novedad?')).toBeNull();

    fireEvent.click(screen.getByText('Eliminar', { selector: 'button' }));
    fireEvent.click(screen.getByText('Sí, eliminar'));

    await waitFor(() => {
      expect(delSpy).toHaveBeenCalledWith('/admin/contenido/novedades/5');
    });
  });

  it('selector de tamaño: elegir Grande envía tamano GRANDE al guardar', async () => {
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    await abrirDisenador();

    fireEvent.click(screen.getByText('Editar'));
    const dialogo = screen.getByRole('dialog', { name: 'Editar novedad' });
    fireEvent.click(within(dialogo).getByRole('radio', { name: 'Grande' }));
    expect(within(dialogo).getByRole('radio', { name: 'Grande' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(dialogo).getByText('Listo'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        '/admin/contenido/novedades/5',
        expect.objectContaining({ titulo: 'Dos por uno', tamano: 'GRANDE' }),
      );
    });
  });

  it('encabezado editable: permite editar etiqueta, título y subtítulo con confirmación y vista previa inmediata', async () => {
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/contenido/novedades/encabezado') {
        return {
          encabezado: {
            etiqueta: 'NOVEDADES',
            titulo: 'Lo nuevo en Caprichos',
            subtitulo: 'Promociones, lanzamientos, datos útiles y lo que pasa en nuestras redes.',
          },
          publicado: {
            etiqueta: 'NOVEDADES',
            titulo: 'Lo nuevo en Caprichos',
            subtitulo: 'Promociones, lanzamientos, datos útiles y lo que pasa en nuestras redes.',
          },
          tieneBorrador: false,
        };
      }
      return [novedadBase];
    });

    await abrirDisenador();

    // Ver que el encabezado inicial está en pantalla
    expect(screen.getByTestId('encabezado-etiqueta').textContent).toBe('NOVEDADES');
    expect(screen.getByTestId('encabezado-titulo').textContent).toBe('Lo nuevo en Caprichos');

    // Abrir edición del encabezado
    fireEvent.click(screen.getByTestId('btn-editar-encabezado'));
    const modalEnc = screen.getByRole('dialog', { name: 'Editar encabezado de Novedades' });

    // Cambiar título y etiqueta
    fireEvent.change(within(modalEnc).getByTestId('input-encabezado-etiqueta'), {
      target: { value: 'ESPECIALES' },
    });
    fireEvent.change(within(modalEnc).getByTestId('input-encabezado-titulo'), {
      target: { value: 'Temporada de Dulzura' },
    });
    fireEvent.change(within(modalEnc).getByTestId('input-encabezado-subtitulo'), {
      target: { value: 'Nuevos sabores para disfrutar hoy.' },
    });

    // Guardar con diálogo Confirmar
    fireEvent.click(within(modalEnc).getByTestId('btn-guardar-encabezado'));
    expect(screen.getByText('¿Guardar cambios en el encabezado?')).toBeTruthy();
    fireEvent.click(screen.getByText('Sí, guardar'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        '/admin/contenido/novedades/encabezado',
        {
          etiqueta: 'ESPECIALES',
          titulo: 'Temporada de Dulzura',
          subtitulo: 'Nuevos sabores para disfrutar hoy.',
        },
      );
      // Vista previa inmediata reflejada
      expect(screen.getByTestId('encabezado-etiqueta').textContent).toBe('ESPECIALES');
      expect(screen.getByTestId('encabezado-titulo').textContent).toBe('Temporada de Dulzura');
    });
  });

  it('conmutador PC / Celular y vista previa fiel en NovedadesView', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([novedadBase]);
    await abrirDisenador();

    // Conmutar a celular
    const btnCel = screen.getByTestId('btn-novedades-disp-celular');
    fireEvent.click(btnCel);

    // Conmutar a vista previa fiel
    fireEvent.click(screen.getByText('Vista previa carta'));
    expect(screen.getByTestId('preview-novedades-celular')).toBeTruthy();

    // Conmutar a PC en vista previa
    const btnPc = screen.getByTestId('btn-novedades-disp-pc');
    fireEvent.click(btnPc);
    expect(screen.getByTestId('preview-novedades-pc')).toBeTruthy();
  });
});

describe('Administrativo: Diseñador de la carta', () => {
  const disenadorMock = {
    tieneBorrador: false,
    organizacionActual: 'SECCIONES',
    decoracionActual: 'NINGUNO',
    contenidoActual: {
      banner: { activo: true, tag: 'BANNER VERANO', title: 'Frappe Frutas', sub: 'Refrescante' },
      promos: [],
      productosConfig: {},
    },
    categorias: [
      { id: 'c1', nombre: 'BEBIDAS', orden: 1, oculto: false },
    ],
    productos: [
      { id: 'pr1', categoriaId: 'c1', nombre: 'Frappe Fresa', descripcion: 'Fresa natural', precio: 15, orden: 1, oculto: false, fotoUrl: null },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue(disenadorMock);
  });

  it('permite conmutar PC / Celular y cambiar a vista previa fiel de la carta', async () => {
    render(
      <MemoryRouter>
        <DisenadorView />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Abrir el diseñador en pantalla completa')).toBeTruthy());
    fireEvent.click(screen.getByText('Abrir el diseñador en pantalla completa'));

    // Conmutar a celular
    const btnCel = screen.getByTestId('btn-disenador-disp-celular');
    fireEvent.click(btnCel);

    // Cambiar a vista previa carta
    fireEvent.click(screen.getByText('Vista previa carta'));
    expect(screen.getByTestId('preview-disenador-celular')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('region', { name: 'Caprichos del mes' })).toBeTruthy());
    expect(screen.getAllByText('BEBIDAS').length).toBeGreaterThan(0);
    expect(screen.getByText('Frappe Fresa')).toBeTruthy();

    // Conmutar a PC
    const btnPc = screen.getByTestId('btn-disenador-disp-pc');
    fireEvent.click(btnPc);
    expect(screen.getByTestId('preview-disenador-pc')).toBeTruthy();
  });
});

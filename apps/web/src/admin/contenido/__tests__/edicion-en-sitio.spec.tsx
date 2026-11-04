import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DisenadorView, aplicarBorradorAPromos } from '../DisenadorView';
import { NovedadesView } from '../NovedadesView';
import { ConocenosView } from '../ConocenosView';
import { CartaVistaPrevia } from '../../../carta/CartaPublica';
import type { VistaPreviaCarta } from '../../../carta/CartaPublica';
import { CONOCENOS_DEFAULT } from '../../../carta/conocenosContenido';
import { api } from '../../../comun/api';

// La subida de fotos no toca el servidor en estas pruebas: devuelve siempre la misma imagen nueva.
vi.mock('../../../comun/subidaImagen', () => ({
  subirImagenAlServidor: vi.fn(async () => ({ id: '9', url: '/archivos/nueva.webp' })),
}));

function rutas(mapa: Record<string, unknown>) {
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => (url in mapa ? mapa[url] : null) as any);
  vi.spyOn(api, 'put').mockResolvedValue({ ok: true } as any);
  vi.spyOn(api, 'post').mockResolvedValue({ ok: true } as any);
}

const ultimaPut = (url: string) => {
  const llamadas = (api.put as any).mock.calls.filter((c: any[]) => c[0] === url);
  return llamadas.at(-1)?.[1];
};

/** Escribe encima de un texto editable y confirma (clic fuera). */
function escribir(nombre: string, texto: string) {
  const caja = screen.getAllByRole('textbox', { name: nombre })[0];
  caja.textContent = texto;
  fireEvent.blur(caja);
}

const categorias = [
  { id: 'c1', nombre: 'BEBIDAS', orden: 1, productos: [] },
];

describe('Diseñador: la carta real en edición', () => {
  const disenador = {
    tieneBorrador: false,
    organizacionActual: 'SECCIONES',
    decoracionActual: 'NINGUNO',
    contenidoActual: { banner: { activo: true, tag: 'NOVEDAD', title: 'Frappe Frutas', sub: 'Refrescante' } },
    disposicionActual: undefined,
    categorias: [{ id: 'c1', nombre: 'BEBIDAS', orden: 1, oculto: false }],
    productos: [
      { id: 'pr1', categoriaId: 'c1', nombre: 'Frappe Fresa', descripcion: 'Fresa', precio: 15, orden: 1, oculto: false, fotoUrl: null },
      { id: 'pr2', categoriaId: 'c1', nombre: 'Frappe Moka', descripcion: 'Moka', precio: 16, orden: 2, oculto: false, fotoUrl: null },
    ],
  };
  const destacadas = [
    { id: '4', titulo: 'Clientes felices', activo: true, archivada: false, portada_url: '/a.webp', fotos: [{ id: 'f1', url: '/a.webp' }] },
    { id: '5', titulo: 'Nuestro local', activo: true, archivada: false, portada_url: '/b.webp', fotos: [{ id: 'f2', url: '/b.webp' }] },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    rutas({ '/admin/contenido/disenador': disenador, '/admin/contenido/destacadas': destacadas });
  });

  const abrir = async () => {
    render(<MemoryRouter><DisenadorView /></MemoryRouter>);
    // la carta primero se pinta con los datos base y enseguida con los del borrador
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Caprichos del mes' }).textContent).toContain('Frappe Frutas');
      expect(screen.getByText('Clientes felices')).toBeTruthy();
    }, { timeout: 5000 });
  };
  const posicion = (a: HTMLElement, b: HTMLElement) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('muestra la carta con los mismos componentes: banner, franja, momentos y productos, sin formularios', async () => {
    await abrir();
    expect(screen.getByLabelText('Datos útiles')).toBeTruthy();
    expect(screen.getByText('Momentos Caprichos')).toBeTruthy();
    expect(screen.getByText('Clientes felices')).toBeTruthy();
    expect(screen.getByText('Frappe Fresa')).toBeTruthy();
    // el banner es el mismo componente de la carta (misma región y texto)
    expect(within(screen.getByRole('region', { name: 'Caprichos del mes' })).getByText('Frappe Frutas')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Etiqueta \(ej/)).toBeNull();
    expect(screen.queryByText('Abrir el diseñador en pantalla completa')).toBeNull();
  });

  it('pantalla completa: entra y sale con el botón y con Esc, la barra sigue visible y el marco no se escala', async () => {
    await abrir();
    const barra = () => screen.getByRole('toolbar', { name: 'Barra del editor' });
    const marco = () => screen.getByTestId('preview-container-pc');
    expect(screen.getByTestId('editor-pantalla').dataset.completa).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' }));
    expect(screen.getByTestId('editor-pantalla').dataset.completa).toBe('1');
    expect(screen.getByTestId('editor-pantalla').parentElement).toBe(document.body);
    expect(barra()).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeTruthy();
    expect(marco().dataset.completa).toBe('1');
    expect(marco().dataset.escala).toBe('1.000');
    expect(marco().style.zoom).toBe('');
    expect(screen.getByText('Frappe Fresa')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Salir de pantalla completa' }));
    expect(screen.getByTestId('editor-pantalla').dataset.completa).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('editor-pantalla').dataset.completa).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Pantalla completa' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('sin modo edición la misma carta se pinta igual y sin barras', () => {
    const datos: VistaPreviaCarta = {
      categorias: [], ofertas: [], estadoLocal: null, datosLocal: null,
      contenido: { decoracion: 'NINGUNO', organizacion: 'SECCIONES', paleta: {}, novedades: [], destacadas: [], rankingMes: [], banner: { activo: true, title: 'Hola banner' } },
    };
    render(<CartaVistaPrevia datos={datos} movil={false} />);
    expect(screen.getByRole('region', { name: 'Caprichos del mes' })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Banner del mes' })).toBeNull();
  });

  it('editar el título del banner en el lugar actualiza el borrador', async () => {
    await abrir();
    escribir('Título del banner', 'Frappe de Temporada');
    await waitFor(() => expect(ultimaPut('/admin/contenido/disenador/borrador')?.contenido.banner.title).toBe('Frappe de Temporada'), { timeout: 3000 });
    await waitFor(() => expect(screen.getByText('Guardado')).toBeTruthy());
    expect(screen.getByText(/Cambios sin publicar: 1/)).toBeTruthy();
  });

  it('Escape cancela lo escrito y Enter confirma', async () => {
    await abrir();
    const caja = screen.getByRole('textbox', { name: 'Título del banner' });
    caja.focus();
    caja.textContent = 'No debe quedar';
    fireEvent.keyDown(caja, { key: 'Escape' });
    expect(caja.textContent).toBe('Frappe Frutas');
    caja.textContent = 'Con Enter';
    fireEvent.keyDown(caja, { key: 'Enter' });
    fireEvent.blur(caja);
    await waitFor(() => expect(ultimaPut('/admin/contenido/disenador/borrador')?.contenido.banner.title).toBe('Con Enter'), { timeout: 3000 });
  });

  it('Momentos Caprichos puede ir primero y el banner después: Subir cambia el orden y se guarda', async () => {
    await abrir();
    const banner = screen.getByRole('region', { name: 'Caprichos del mes' });
    const momentos = screen.getByRole('group', { name: 'Momentos Caprichos' });
    expect(posicion(banner, momentos)).toBe(true);

    fireEvent.click(screen.getByText('Momentos Caprichos'));
    fireEvent.click(screen.getByLabelText('Subir Momentos Caprichos'));
    fireEvent.click(screen.getByLabelText('Subir Momentos Caprichos'));
    expect(posicion(screen.getByRole('group', { name: 'Momentos Caprichos' }), screen.getByRole('region', { name: 'Caprichos del mes' }))).toBe(true);

    await waitFor(() => expect(ultimaPut('/admin/contenido/disenador/borrador')?.contenido.disposicion.secciones[0].id).toBe('momentos'), { timeout: 3000 });
    expect(ultimaPut('/admin/contenido/disenador/borrador').contenido.disposicion.secciones[1].id).toBe('mes');
  });

  it('arrastrar el banner sobre Momentos los intercambia de lugar (arrastre simulado)', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('region', { name: 'Caprichos del mes' }));
    fireEvent.dragStart(screen.getByLabelText('Arrastrar Banner del mes'));
    const destino = screen.getByRole('group', { name: 'Momentos Caprichos' });
    fireEvent.dragOver(destino);
    fireEvent.drop(destino);
    await waitFor(() => {
      const orden = ultimaPut('/admin/contenido/disenador/borrador')?.contenido.disposicion.secciones.map((s: any) => s.id);
      expect(orden.indexOf('mes')).toBeGreaterThan(orden.indexOf('momentos'));
    }, { timeout: 3000 });
  });

  it('ocultar una sección la deja atenuada con la etiqueta «Oculta» y se guarda', async () => {
    await abrir();
    fireEvent.click(screen.getByLabelText('Datos útiles'));
    fireEvent.click(screen.getByLabelText('Ocultar Franja de datos'));
    expect(screen.getByText('Oculta')).toBeTruthy();
    expect(screen.getByLabelText('Datos útiles')).toBeTruthy(); // sigue en su lugar
    expect(screen.getByLabelText('Mostrar Franja de datos')).toBeTruthy();
    await waitFor(() => expect(ultimaPut('/admin/contenido/disenador/borrador')?.contenido.disposicion.secciones.find((s: any) => s.id === 'franja').visible).toBe(false), { timeout: 3000 });
  });

  it('cambiar el producto del banner: clic en su foto abre la lista anclada', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar producto y foto del banner' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Frappe Moka' }));
    await waitFor(() => expect(ultimaPut('/admin/contenido/disenador/borrador')?.contenido.banner.target).toBe('FRAPPE MOKA'), { timeout: 3000 });
  });

  it('los textos de los productos (combos y frappés) se editan en la tarjeta y se reordenan', async () => {
    await abrir();
    escribir('Nombre del producto', 'Frappe Fresa Premium');
    await waitFor(() => expect(ultimaPut('/admin/contenido/disenador/borrador')?.contenido.productosConfig.pr1.nombre).toBe('Frappe Fresa Premium'), { timeout: 3000 });
    fireEvent.click(screen.getAllByRole('group', { name: 'Frappe Fresa Premium' })[0]);
    fireEvent.click(screen.getByLabelText('Bajar Frappe Fresa Premium'));
    await waitFor(() => expect(ultimaPut('/admin/contenido/disenador/borrador')?.contenido.productosConfig.pr1.orden).toBe(2), { timeout: 3000 });
  });

  it('Deshacer vuelve el último cambio', async () => {
    await abrir();
    escribir('Título del banner', 'Otro');
    await waitFor(() => expect(screen.getByRole('region', { name: 'Caprichos del mes' }).textContent).toContain('Otro'));
    fireEvent.click(screen.getByText('Deshacer'));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Caprichos del mes' }).textContent).toContain('Frappe Frutas'));
  });

  it('Publicar pide Sí/No: No no envía nada; Sí publica', async () => {
    await abrir();
    escribir('Título del banner', 'Nuevo');
    await waitFor(() => expect(screen.getByText(/Cambios sin publicar: 1/)).toBeTruthy());
    fireEvent.click(screen.getByText('Publicar'));
    fireEvent.click(screen.getByText('No, seguir editando'));
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Publicar'));
    fireEvent.click(screen.getByText('Sí, publicar'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/contenido/disenador/publicar', {}), { timeout: 3000 });
  });

  it('la edición no ejecuta la carta: pedir desde el banner no envía nada', async () => {
    await abrir();
    fireEvent.click(screen.getByText('Pedir ahora'));
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('Novedades: la página real en edición', () => {
  const lista = [
    { id: '1', tipo: 'PROMOCION', titulo: 'Martes de 2x1', texto: 'Solo martes', tema: null, video_url: null, evento_fecha: null, evento_lugar: null, desde: null, hasta: null, orden: 1, activo: true, tamano: 'GRANDE', fotos: [] },
    { id: '2', tipo: 'AVISO', titulo: 'Nuevo: Waffle', texto: 'Con helado', tema: null, video_url: null, evento_fecha: null, evento_lugar: null, desde: null, hasta: null, orden: 2, activo: true, tamano: 'MEDIANO', fotos: [] },
    { id: '3', tipo: 'FOTOS', titulo: 'Clientes', texto: null, tema: null, video_url: null, evento_fecha: null, evento_lugar: null, desde: null, hasta: null, orden: 3, activo: true, tamano: 'CHICO', fotos: [] },
  ];
  const enc = { encabezado: { etiqueta: 'NOVEDADES', titulo: 'Lo nuevo', subtitulo: 'Subtítulo' }, publicado: {}, tieneBorrador: false };

  beforeEach(() => {
    vi.restoreAllMocks();
    rutas({
      '/admin/contenido/novedades': lista,
      '/admin/contenido/novedades/borrador': { items: null, tieneBorrador: false },
      '/admin/contenido/novedades/encabezado': enc,
      '/carta': categorias,
    });
  });

  const abrir = async () => {
    render(<MemoryRouter><NovedadesView /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Lo nuevo')).toBeTruthy());
  };

  it('es la página de la carta: encabezado y mosaico juntos, sin pestañas ni listas', async () => {
    await abrir();
    expect(screen.getByTestId('encabezado-titulo')).toBeTruthy();
    expect(document.querySelector('article[data-tamano="MEDIANO"]')).toBeTruthy();
    expect(screen.queryByText('+ Nueva novedad')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('el título del encabezado y el de una tarjeta se editan en el lugar', async () => {
    await abrir();
    escribir('Título del encabezado', 'Lo último');
    await waitFor(() => expect(ultimaPut('/admin/contenido/novedades/encabezado')?.titulo).toBe('Lo último'), { timeout: 3000 });
    escribir('Título de la novedad', 'Clientes felices');
    await waitFor(() => expect(ultimaPut('/admin/contenido/novedades/borrador')?.items.some((n: any) => n.titulo === 'Clientes felices')).toBe(true), { timeout: 3000 });
  });

  it('«+ Agregar novedad» es una tarjeta fantasma que crea la tarjeta en el borrador', async () => {
    await abrir();
    fireEvent.click(screen.getByText('+ Agregar novedad'));
    await waitFor(() => expect(ultimaPut('/admin/contenido/novedades/borrador')?.items).toHaveLength(4), { timeout: 3000 });
    expect(ultimaPut('/admin/contenido/novedades/borrador').items[3]).toMatchObject({ titulo: 'Nueva novedad', tamano: 'MEDIANO', activo: true });
  });

  it('eliminar pide Sí/No: No conserva la tarjeta y Sí la quita del borrador', async () => {
    await abrir();
    fireEvent.click(screen.getByLabelText('Ver detalle de Clientes'));
    fireEvent.click(screen.getByText('Eliminar'));
    fireEvent.click(screen.getByText('No, conservarla'));
    expect(api.put).not.toHaveBeenCalledWith('/admin/contenido/novedades/borrador', expect.anything());
    fireEvent.click(screen.getByLabelText('Ver detalle de Clientes'));
    fireEvent.click(screen.getByText('Eliminar'));
    fireEvent.click(screen.getByText('Sí, eliminar'));
    await waitFor(() => expect(ultimaPut('/admin/contenido/novedades/borrador')?.items.map((n: any) => n.id)).toEqual(['1', '2']), { timeout: 3000 });
  });

  it('el botón de tamaño cicla los tamaños y Ocultar deja la tarjeta atenuada con «Oculta»', async () => {
    await abrir();
    fireEvent.click(screen.getByLabelText('Ver detalle de Nuevo: Waffle'));
    fireEvent.click(screen.getByText(/Tamaño: Mediano/));
    await waitFor(() => expect(ultimaPut('/admin/contenido/novedades/borrador')?.items.find((n: any) => n.id === '2').tamano).toBe('GRANDE'), { timeout: 3000 });
    fireEvent.click(screen.getByLabelText('Ocultar Nuevo: Waffle'));
    expect(screen.getByText('Oculta')).toBeTruthy();
  });

  it('las fechas y el enlace del video salen en una ventana anclada', async () => {
    await abrir();
    fireEvent.click(screen.getByLabelText('Ver detalle de Nuevo: Waffle'));
    fireEvent.click(screen.getByText('Más opciones'));
    expect(screen.getByLabelText('Se muestra desde')).toBeTruthy();
    expect(screen.getByLabelText(/Enlace del video/)).toBeTruthy();
  });

  it('Publicar pide Sí/No y publica las novedades', async () => {
    await abrir();
    fireEvent.click(screen.getByText('+ Agregar novedad'));
    await waitFor(() => expect(screen.getByText(/Cambios sin publicar: 1/)).toBeTruthy());
    fireEvent.click(screen.getByText('Publicar'));
    fireEvent.click(screen.getByText('No, seguir editando'));
    expect(api.post).not.toHaveBeenCalledWith('/admin/contenido/novedades/publicar', {});
    fireEvent.click(screen.getByText('Publicar'));
    fireEvent.click(screen.getByText('Sí, publicar'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/contenido/novedades/publicar', {}), { timeout: 3000 });
  });
});

describe('Conócenos: la página real en edición', () => {
  const respuesta = { contenido: CONOCENOS_DEFAULT, publicado: CONOCENOS_DEFAULT, tieneBorrador: false };
  const local = { nombre: 'Caprichos', direccion: 'Av. Campoy 123', telefono: '999 111 222', whatsapp: '999111222', horario: [], redes: {} };

  beforeEach(() => {
    vi.restoreAllMocks();
    rutas({ '/admin/contenido/conocenos': respuesta, '/carta': categorias, '/carta/local': local });
  });

  const abrir = async () => {
    render(<MemoryRouter><ConocenosView /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText('Av. Campoy 123').length).toBeGreaterThan(0));
  };

  it('escribir sobre el título cambia el borrador', async () => {
    await abrir();
    escribir('Título', 'Nuestra historia');
    await waitFor(() => expect(ultimaPut('/admin/contenido/conocenos')?.titulo).toBe('Nuestra historia'), { timeout: 3000 });
  });

  it('un bloque se baja con la barra y se oculta marcando «Oculta»', async () => {
    await abrir();
    fireEvent.click(screen.getAllByRole('textbox', { name: 'Título del bloque' })[0].parentElement!);
    fireEvent.click(screen.getByLabelText('Bajar Dónde estamos'));
    await waitFor(() => expect(ultimaPut('/admin/contenido/conocenos')?.bloques.map((b: any) => b.id).slice(0, 2)).toEqual(['horario', 'donde']), { timeout: 3000 });
    fireEvent.click(screen.getByLabelText('Ocultar Dónde estamos'));
    expect(screen.getByText('Oculta')).toBeTruthy();
    await waitFor(() => expect(ultimaPut('/admin/contenido/conocenos')?.bloques.find((b: any) => b.id === 'donde').visible).toBe(false), { timeout: 3000 });
  });

  it('el mosaico ya no tiene contador de fotos de fábrica: las fotos son las que se suben', async () => {
    await abrir();
    expect(screen.queryByLabelText('Más fotos')).toBeNull();
    expect(screen.queryByLabelText('Menos fotos')).toBeNull();
  });

  it('tocar la dirección avisa «Se edita en Configuración del local» y no deja editarla', async () => {
    await abrir();
    fireEvent.click(within(screen.getByRole('group', { name: 'Dónde estamos' })).getByText('Av. Campoy 123'));
    expect(await screen.findByText('Se edita en Configuración del local')).toBeTruthy();
    expect(screen.getByText('Ir a Configuración del local')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /direcci/i })).toBeNull();
  });

  it('Publicar pide Sí/No: No no llama; Sí guarda y publica', async () => {
    await abrir();
    escribir('Etiqueta', 'NOSOTROS');
    await waitFor(() => expect(screen.getByText(/Cambios sin publicar: 1/)).toBeTruthy());
    fireEvent.click(screen.getByText('Publicar'));
    fireEvent.click(screen.getByText('No, seguir editando'));
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Publicar'));
    fireEvent.click(screen.getByText('Sí, publicar'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/contenido/conocenos/publicar', {}), { timeout: 3000 });
    expect(ultimaPut('/admin/contenido/conocenos')?.etiqueta).toBe('NOSOTROS');
  });
});

describe('Conócenos: cada foto se edita sola', () => {
  const local = { nombre: 'Caprichos', direccion: 'Av. Campoy 123', telefono: '999 111 222', whatsapp: '999111222', horario: [], redes: {} };
  const fotosPrueba = [
    { id: 'a', url: '/archivos/a.webp', activo: true },
    { id: 'b', url: '/archivos/b.webp', activo: true },
    { id: 'c', url: '/archivos/c.webp', activo: true },
    { id: 'd', url: '/archivos/d.webp', activo: true },
  ];
  const conGaleria = { ...CONOCENOS_DEFAULT, galeria: fotosPrueba };

  beforeEach(() => {
    vi.restoreAllMocks();
    rutas({ '/admin/contenido/conocenos': { contenido: conGaleria, publicado: conGaleria, tieneBorrador: false }, '/carta': categorias, '/carta/local': local });
  });

  const abrir = async () => {
    render(<MemoryRouter><ConocenosView /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText('Av. Campoy 123').length).toBeGreaterThan(0));
  };
  const seleccionarFoto = (nombre: string) => fireEvent.click(screen.getByRole('group', { name: nombre }));
  const galeriaGuardada = () => ultimaPut('/admin/contenido/conocenos')?.galeria as { id: string; url: string; activo: boolean }[] | undefined;

  it('Bajar cambia el orden de la foto y se guarda en el borrador de Conócenos', async () => {
    await abrir();
    seleccionarFoto('Foto 1 (Nuestro lugar)');
    fireEvent.click(screen.getByLabelText('Bajar Foto 1 (Nuestro lugar)'));
    await waitFor(() => expect(galeriaGuardada()?.map((f) => f.id)).toEqual(['b', 'a', 'c', 'd']), { timeout: 3000 });
  });

  it('Quitar pide Sí/No: No no cambia nada; Sí la oculta y Mostrar la vuelve a poner', async () => {
    await abrir();
    seleccionarFoto('Foto 2 (Nuestro lugar)');
    fireEvent.click(screen.getByText('Quitar'));
    expect(screen.getByText('¿Quitar esta foto de Conócenos?')).toBeTruthy();
    fireEvent.click(screen.getByText('No, conservarla'));
    expect(api.put).not.toHaveBeenCalledWith('/admin/contenido/conocenos', expect.anything());

    fireEvent.click(screen.getByText('Quitar'));
    fireEvent.click(screen.getByText('Sí, quitar'));
    await waitFor(() => expect(galeriaGuardada()?.find((f) => f.id === 'b')?.activo).toBe(false), { timeout: 3000 });
    expect(galeriaGuardada()?.length).toBe(4); // nada se borra
    expect(screen.getByText('Oculta')).toBeTruthy();

    fireEvent.click(screen.getByText('Mostrar'));
    await waitFor(() => expect(galeriaGuardada()?.find((f) => f.id === 'b')?.activo).toBe(true), { timeout: 3000 });
  });

  it('Cambiar foto sube la imagen y la pone en el lugar de la anterior', async () => {
    await abrir();
    seleccionarFoto('Foto 1 (Nuestro lugar)');
    const entrada = screen.getByLabelText('Elegir foto para Foto 1 (Nuestro lugar)');
    fireEvent.change(entrada, { target: { files: [new File(['x'], 'x.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(galeriaGuardada()?.[0]).toEqual({ id: 'a', url: '/archivos/nueva.webp', activo: true }), { timeout: 3000 });
  });

  it('+ Agregar foto añade una foto al final de la galería', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: [new File(['x'], 'nueva.jpg', { type: 'image/jpeg' })] });
      (this as any).onchange?.(new Event('change'));
    });
    await abrir();
    fireEvent.click(screen.getByText('+ Agregar foto'));
    await waitFor(() => expect(galeriaGuardada()).toHaveLength(5), { timeout: 3000 });
    expect(galeriaGuardada()?.[4].url).toBe('/archivos/nueva.webp');
    expect(galeriaGuardada()?.[4].activo).toBe(true);
  });

  it('la cuarta foto queda en Momentos, sin la etiqueta de Nuestro lugar', async () => {
    await abrir();
    expect(screen.getByRole('group', { name: 'Foto 4' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Foto 4 (Nuestro lugar)' })).toBeNull();
  });
});

describe('Novedades: Momentos Caprichos propios', () => {
  const momentos = [
    { id: 'm1', url: '/archivos/m1.webp', activo: true },
    { id: 'm2', url: '/archivos/m2.webp', activo: true },
  ];
  const encabezado = { etiqueta: 'NOVEDADES', titulo: 'Lo nuevo', subtitulo: 'Sub' };
  const local = { nombre: 'Caprichos', direccion: 'Av. Campoy 123', telefono: '999', whatsapp: '999', horario: [], redes: {} };

  beforeEach(() => {
    vi.restoreAllMocks();
    rutas({
      '/admin/contenido/novedades': [],
      '/admin/contenido/novedades/borrador': { items: null, tieneBorrador: false },
      '/admin/contenido/novedades/encabezado': { encabezado, tieneBorrador: false },
      '/admin/contenido/novedades/momentos': { fotos: momentos, tieneBorrador: false },
      '/carta': categorias,
      '/carta/local': local,
    });
  });

  const abrir = async () => {
    render(<MemoryRouter><NovedadesView /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('group', { name: 'Momento 1' })).toBeTruthy());
  };
  const momentosGuardados = () => ultimaPut('/admin/contenido/novedades/momentos')?.fotos as { id: string; activo: boolean }[] | undefined;

  it('Quitar una foto de Momentos pide Sí/No y no la borra', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('group', { name: 'Momento 2' }));
    fireEvent.click(screen.getByText('Quitar'));
    fireEvent.click(screen.getByText('No, conservarla'));
    fireEvent.click(screen.getByText('Quitar'));
    fireEvent.click(screen.getByText('Sí, quitar'));
    await waitFor(() => expect(momentosGuardados()?.find((f) => f.id === 'm2')?.activo).toBe(false), { timeout: 3000 });
    expect(momentosGuardados()).toHaveLength(2);
  });

  it('+ Agregar foto en Momentos añade a Momentos y no toca las tarjetas', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: [new File(['x'], 'nueva.jpg', { type: 'image/jpeg' })] });
      (this as any).onchange?.(new Event('change'));
    });
    await abrir();
    fireEvent.click(screen.getByText('+ Agregar foto'));
    await waitFor(() => expect(momentosGuardados()).toHaveLength(3), { timeout: 3000 });
    expect(ultimaPut('/admin/contenido/novedades/borrador')?.items ?? []).toEqual([]);
  });
});

describe('Diseñador: promociones de la carta en edición (lugar, foto, ocultar; reglas fuera)', () => {
  const disenador = {
    tieneBorrador: false,
    organizacionActual: 'SECCIONES',
    decoracionActual: 'NINGUNO',
    contenidoActual: { banner: { activo: true, tag: 'NOVEDAD', title: 'Frappe Frutas', sub: 'Refrescante' } },
    disposicionActual: undefined,
    categorias: [{ id: 'c1', nombre: 'BEBIDAS', orden: 1, oculto: false }],
    productos: [{ id: 'pr1', categoriaId: 'c1', nombre: 'Frappe Fresa', descripcion: 'Fresa', precio: 15, orden: 1, oculto: false, fotoUrl: null }],
  };
  const oferta = (id: string, nombre: string, orden: number, extra: Record<string, unknown> = {}) => ({
    id, tipo: 'DESCUENTO', nombre, descripcion: `Desc ${nombre}`, descuentoTipo: 'PORCENTAJE', descuentoValor: 10,
    lleva: null, paga: null, alcanceCategoriaId: null, alcanceProductoId: null, compraMinima: null, dias: [],
    horaDesde: null, horaHasta: null, fechaDesde: null, fechaHasta: null, canales: ['CARTA'], limiteUsos: null,
    usosActuales: 0, noSumaBeneficios: false, orden, activo: true, creadoEn: '2026-10-01T00:00:00.000Z',
    vigenteAhora: true, imagenArchivoId: null, imagenUrl: null, combosPrecio: [], combosParte: [], visibleCarta: true,
    ...extra,
  });
  const ofertas = [oferta('31', 'Martes 2x1', 1), oferta('32', 'Jueves 15%', 2)];

  beforeEach(() => {
    vi.restoreAllMocks();
    rutas({ '/admin/contenido/disenador': disenador, '/admin/contenido/destacadas': [], '/carta/ofertas': ofertas });
  });

  const abrir = async () => {
    render(<MemoryRouter><DisenadorView /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('oferta-31')).toBeTruthy(), { timeout: 5000 });
  };
  const ultimasPromos = () => ultimaPut('/admin/contenido/disenador/borrador')?.contenido.promos;

  it('cada promoción es un bloque editable con Editar reglas que abre Ofertas en otra pestaña', async () => {
    await abrir();
    fireEvent.click(screen.getAllByRole('group', { name: 'Martes 2x1' })[0]);
    const enlace = screen.getByRole('link', { name: /Editar reglas de Martes 2x1/ });
    expect(enlace.getAttribute('href')).toBe('/admin/ofertas');
    expect(enlace.getAttribute('target')).toBe('_blank');
    expect(screen.getByLabelText('Cambiar foto de Martes 2x1')).toBeTruthy();
    expect(screen.getByLabelText('Ocultar Martes 2x1')).toBeTruthy();
  });

  it('el título y la descripción de una promoción se editan en el lugar y van al borrador por id', async () => {
    await abrir();
    escribir('Nombre de la promoción', 'Martes 2x1 renovado');
    await waitFor(() => expect(ultimasPromos()?.['31']?.nombre).toBe('Martes 2x1 renovado'), { timeout: 3000 });
    escribir('Descripción de la promoción', 'Solo los martes');
    await waitFor(() => expect(ultimasPromos()?.['31']?.descripcion).toBe('Solo los martes'), { timeout: 3000 });
    expect(screen.getByRole('group', { name: 'Martes 2x1 renovado' })).toBeTruthy();
  });

  it('Bajar mueve la promoción y guarda el orden de todas en el borrador', async () => {
    await abrir();
    fireEvent.click(screen.getAllByRole('group', { name: 'Martes 2x1' })[0]);
    fireEvent.click(screen.getByLabelText('Bajar Martes 2x1'));
    await waitFor(() => expect(ultimasPromos()?.['31']?.orden).toBe(2), { timeout: 3000 });
    expect(ultimasPromos()['32'].orden).toBe(1);
  });

  it('Ocultar deja la promoción atenuada con «Oculta» y la marca oculta en el borrador (el descuento no cambia)', async () => {
    await abrir();
    fireEvent.click(screen.getAllByRole('group', { name: 'Martes 2x1' })[0]);
    fireEvent.click(screen.getByLabelText('Ocultar Martes 2x1'));
    expect(screen.getByText('Oculta')).toBeTruthy();
    await waitFor(() => expect(ultimasPromos()?.['31']?.oculto).toBe(true), { timeout: 3000 });
    expect(Object.keys(ultimasPromos()['31']).sort()).toEqual(['oculto']);
  });

  it('Cambiar foto sube la imagen y la guarda como foto de la promoción', async () => {
    await abrir();
    fireEvent.click(screen.getAllByRole('group', { name: 'Martes 2x1' })[0]);
    const entrada = screen.getByLabelText('Elegir foto para Martes 2x1');
    fireEvent.change(entrada, { target: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } });
    await waitFor(() => expect(ultimasPromos()?.['31']?.fotoUrl).toContain('nueva.webp'), { timeout: 3000 });
  });

  it('Publicar envía las promociones del borrador; las reglas del descuento no viajan en el borrador', async () => {
    await abrir();
    fireEvent.click(screen.getAllByRole('group', { name: 'Martes 2x1' })[0]);
    fireEvent.click(screen.getByLabelText('Ocultar Martes 2x1'));
    await waitFor(() => expect(ultimasPromos()?.['31']?.oculto).toBe(true), { timeout: 3000 });
    fireEvent.click(screen.getByText('Publicar'));
    fireEvent.click(screen.getByText('Sí, publicar'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/contenido/disenador/publicar', {}), { timeout: 3000 });
    for (const [, valor] of Object.entries(ultimasPromos())) {
      expect(Object.keys(valor as object).filter((k) => ['tipo', 'activo', 'descuentoValor', 'descuentoTipo', 'compraMinima', 'fechaDesde', 'canales'].includes(k))).toEqual([]);
    }
  });
});

describe('Carta pública: promociones ocultas no se muestran y el orden de la lista se respeta', () => {
  it('una promoción con visibleCarta false no aparece fuera del diseñador', () => {
    const datos: VistaPreviaCarta = {
      categorias: [],
      ofertas: [
        { id: '1', tipo: 'DESCUENTO', nombre: 'Visible', descripcion: null, activo: true, orden: 1, creadoEn: '2026-10-01T00:00:00.000Z', visibleCarta: true, combosPrecio: [], combosParte: [] } as any,
        { id: '2', tipo: 'DESCUENTO', nombre: 'Oculta en carta', descripcion: null, activo: true, orden: 2, creadoEn: '2026-10-01T00:00:00.000Z', visibleCarta: false, combosPrecio: [], combosParte: [] } as any,
      ],
      estadoLocal: null,
      datosLocal: null,
      contenido: { decoracion: 'NINGUNO', organizacion: 'SECCIONES', paleta: {}, novedades: [], destacadas: [], rankingMes: [], banner: { activo: false } },
    };
    render(<MemoryRouter><CartaVistaPrevia datos={datos} movil={false} /></MemoryRouter>);
    expect(screen.getByTestId('oferta-1')).toBeTruthy();
    expect(screen.queryByTestId('oferta-2')).toBeNull();
  });

  it('aplicarBorradorAPromos: el borrador cambia nombre, foto, orden y visibilidad, y deja intacto lo demás', () => {
    const base = [
      { id: 'a', tipo: 'DESCUENTO', nombre: 'A', activo: true, orden: 2, visibleCarta: true, descuentoValor: 10 },
      { id: 'b', tipo: 'COMBO', nombre: 'B', activo: true, orden: 1, visibleCarta: false, descuentoValor: null },
    ] as any[];
    const r = aplicarBorradorAPromos(base, { a: { orden: 1, nombre: 'A nuevo', fotoUrl: '/f.webp', oculto: true }, b: { orden: 2, oculto: false } });
    expect(r.map((o) => o.id)).toEqual(['a', 'b']);
    expect(r[0]).toMatchObject({ nombre: 'A nuevo', imagenUrl: '/f.webp', visibleCarta: false, descuentoValor: 10, activo: true });
    expect(r[1]).toMatchObject({ visibleCarta: true, nombre: 'B', tipo: 'COMBO' });
  });
});

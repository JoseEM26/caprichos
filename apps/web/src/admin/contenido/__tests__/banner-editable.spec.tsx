import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DisenadorView } from '../DisenadorView';
import { BannerMesCarta } from '../../../carta/PortadaCarta';
import { CarruselBanners, estadoBanner, vigenteHoy, hoyLima } from '../../../carta/CarruselBanners';
import type { BannerImagen } from '../../../carta/CarruselBanners';
import { api } from '../../../comun/api';

vi.mock('../../../comun/subidaImagen', () => ({
  subirImagenAlServidor: vi.fn(async () => ({ id: '9', url: '/archivos/nueva.webp' })),
}));

const im = (id: string, extra: Partial<BannerImagen> = {}): BannerImagen => ({ id, url: `/archivos/${id}.webp`, alt: `Banner ${id}`, activo: true, ...extra });
const nada = () => {};

describe('Banner «Caprichos del mes»: botones en la carta pública', () => {
  const pintar = (banner: any) => render(<BannerMesCarta fotoDestacada={null} banner={banner} onPedir={nada} onVerCarta={nada} />);

  it('sin datos nuevos muestra ambos botones con los textos de siempre', () => {
    pintar({ activo: true, title: 'T' });
    expect(screen.getByRole('button', { name: 'Pedir ahora' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver la carta' })).toBeTruthy();
  });
  it('usa el texto configurado y no pinta el botón desactivado', () => {
    pintar({ activo: true, textoBotonPrincipal: 'Lo quiero', botonSecundarioActivo: false });
    expect(screen.getByRole('button', { name: 'Lo quiero' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver la carta' })).toBeNull();
  });
  it('con ambos desactivados no hay fila de botones', () => {
    const { container } = pintar({ activo: true, botonPrincipalActivo: false, botonSecundarioActivo: false });
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});

describe('Modo «Mis banners»', () => {
  it('muestra solo el carrusel (sin título, foto ni botones del mes)', () => {
    render(<BannerMesCarta fotoDestacada="/f.webp" banner={{ activo: true, title: 'Del mes', modo: 'IMAGENES', imagenes: [im('a')] }} onPedir={nada} onVerCarta={nada} />);
    expect(screen.getByRole('img', { name: 'Banner a' })).toBeTruthy();
    expect(screen.queryByText('Del mes')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pedir ahora' })).toBeNull();
  });
  it('sin banners vigentes cae a Caprichos del mes (nunca un hueco)', () => {
    render(<BannerMesCarta fotoDestacada={null} banner={{ activo: true, title: 'Del mes', modo: 'IMAGENES', imagenes: [im('a', { activo: false }), im('b', { hasta: '2000-01-01' }), im('c', { desde: '2999-01-01' })] }} onPedir={nada} onVerCarta={nada} />);
    expect(screen.getByText('Del mes')).toBeTruthy();
  });
  it('estados por fecha', () => {
    expect(estadoBanner(im('a'), '2026-12-01').id).toBe('ACTIVO');
    expect(estadoBanner(im('a', { activo: false })).texto).toBe('Oculto');
    expect(estadoBanner(im('a', { desde: '2026-12-10' }), '2026-12-01').texto).toBe('Programado (empieza el 10/12/2026)');
    expect(estadoBanner(im('a', { hasta: '2026-11-30' }), '2026-12-01').texto).toBe('Vencido (terminó el 30/11/2026)');
    expect(vigenteHoy({ desde: '2026-12-01', hasta: '2026-12-01' }, '2026-12-01')).toBe(true);
    expect(hoyLima()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Carrusel de banners', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  const activo = () => screen.getByRole('img').getAttribute('alt');

  it('avanza solo cada N segundos y vuelve al inicio', () => {
    render(<CarruselBanners imagenes={[im('a'), im('b')]} intervaloSeg={4} movil={false} />);
    expect(activo()).toBe('Banner a');
    act(() => { vi.advanceTimersByTime(3900); });
    expect(activo()).toBe('Banner a');
    act(() => { vi.advanceTimersByTime(200); });
    expect(activo()).toBe('Banner b');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(activo()).toBe('Banner a');
  });
  it('se pausa con el mouse encima y sigue al salir', () => {
    render(<CarruselBanners imagenes={[im('a'), im('b')]} intervaloSeg={3} movil={false} />);
    const c = screen.getByRole('group', { name: 'Banners' });
    fireEvent.mouseEnter(c);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(activo()).toBe('Banner a');
    fireEvent.mouseLeave(c);
    act(() => { vi.advanceTimersByTime(3100); });
    expect(activo()).toBe('Banner b');
  });
  it('flechas y puntos navegan', () => {
    render(<CarruselBanners imagenes={[im('a'), im('b'), im('c')]} intervaloSeg={5} movil={false} />);
    fireEvent.click(screen.getByLabelText('Banner siguiente'));
    expect(activo()).toBe('Banner b');
    fireEvent.click(screen.getByLabelText('Banner anterior'));
    fireEvent.click(screen.getByLabelText('Banner anterior'));
    expect(activo()).toBe('Banner c');
    fireEvent.click(screen.getByLabelText('Ir al banner 2'));
    expect(activo()).toBe('Banner b');
  });
  it('deslizar con el dedo cambia de banner', () => {
    render(<CarruselBanners imagenes={[im('a'), im('b')]} intervaloSeg={5} movil />);
    const c = screen.getByRole('group', { name: 'Banners' });
    fireEvent.touchStart(c, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(c, { changedTouches: [{ clientX: 100 }] });
    expect(activo()).toBe('Banner b');
  });
  it('un solo banner: sin flechas, puntos ni temporizador', () => {
    render(<CarruselBanners imagenes={[im('a')]} intervaloSeg={3} movil={false} />);
    expect(screen.queryByLabelText('Banner siguiente')).toBeNull();
    expect(screen.queryByLabelText('Ir al banner 1')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('respeta prefers-reduced-motion: no avanza solo', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: nada, removeEventListener: nada, addListener: nada, removeListener: nada }));
    render(<CarruselBanners imagenes={[im('a'), im('b')]} intervaloSeg={3} movil={false} />);
    act(() => { vi.advanceTimersByTime(20000); });
    expect(activo()).toBe('Banner a');
  });
  it('usa la imagen de celular solo en celular y la primera con carga prioritaria', () => {
    const { rerender } = render(<CarruselBanners imagenes={[im('a', { urlCelular: '/archivos/m.webp' })]} intervaloSeg={5} movil />);
    expect(screen.getByRole('img').getAttribute('src')).toBe('/archivos/m.webp');
    expect(screen.getByRole('img').getAttribute('fetchpriority')).toBe('high');
    rerender(<CarruselBanners imagenes={[im('a', { urlCelular: '/archivos/m.webp' })]} intervaloSeg={5} movil={false} />);
    expect(screen.getByRole('img').getAttribute('src')).toBe('/archivos/a.webp');
  });
  it('el enlace externo se abre en pestaña nueva con noopener noreferrer; uno interno llama a onEnlace', () => {
    const onEnlace = vi.fn();
    const { rerender } = render(<CarruselBanners imagenes={[im('a', { enlace: { tipo: 'URL', valor: 'https://caprichos.pe' } })]} intervaloSeg={5} movil={false} />);
    const a = screen.getByRole('link');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    rerender(<CarruselBanners imagenes={[im('a', { enlace: { tipo: 'PRODUCTO', valor: '7' } })]} intervaloSeg={5} movil={false} onEnlace={onEnlace} />);
    fireEvent.click(screen.getByRole('button', { name: 'Banner a' }));
    expect(onEnlace).toHaveBeenCalledWith({ tipo: 'PRODUCTO', valor: '7' });
  });
});

describe('Diseñador: editor del banner', () => {
  const disenador = (banner: any) => ({
    tieneBorrador: false, organizacionActual: 'SECCIONES', decoracionActual: 'NINGUNO',
    contenidoActual: { banner: { activo: true, tag: 'N', title: 'Frappe Frutas', sub: 'Refrescante', ...banner } },
    categorias: [{ id: '3', nombre: 'BEBIDAS', orden: 1, oculto: false }],
    productos: [{ id: '8', categoriaId: '3', nombre: 'Frappe Fresa', descripcion: '', precio: 15, orden: 1, oculto: false, fotoUrl: null }],
  });
  const ultimaPut = () => (api.put as any).mock.calls.filter((c: any[]) => c[0] === '/admin/contenido/disenador/borrador').at(-1)?.[1];
  const abrir = async (banner: any = {}) => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockImplementation(async (u: string) => (u === '/admin/contenido/disenador' ? disenador(banner) : u === '/admin/contenido/destacadas' ? [] : null) as any);
    vi.spyOn(api, 'put').mockResolvedValue({ ok: true } as any);
    vi.spyOn(api, 'post').mockResolvedValue({ ok: true } as any);
    render(<MemoryRouter><DisenadorView /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByRole('group', { name: 'Banner del mes' })[0]).toBeTruthy(), { timeout: 5000 });
    await waitFor(() => expect(screen.getAllByRole('group', { name: 'Banner del mes' })).toHaveLength(1));
  };
  const escribirTitulo = () => {
    const t = screen.getAllByRole('textbox', { name: 'Título del banner' })[0];
    t.textContent = 'Otro título';
    fireEvent.blur(t);
  };
  const elegirBanner = () => fireEvent.click(screen.getByRole('group', { name: 'Banner del mes' }));

  it('editar el texto de un botón desde un editor pequeño entra al borrador', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Editar botón Pedir ahora' }));
    const caja = await screen.findByLabelText('Texto del botón');
    fireEvent.change(caja, { target: { value: 'Lo quiero' } });
    fireEvent.blur(caja);
    await waitFor(() => expect(ultimaPut()?.contenido.banner.textoBotonPrincipal).toBe('Lo quiero'), { timeout: 3000 });
  });
  it('ocultar un botón lo deja atenuado con «Oculto» y un clic lo reactiva', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Editar botón Ver la carta' }));
    fireEvent.click(await screen.findByLabelText('Mostrar este botón'));
    const oculto = await screen.findByRole('button', { name: 'Mostrar botón Ver la carta (oculto)' });
    expect(oculto.textContent).toContain('Oculto');
    await waitFor(() => expect(ultimaPut()?.contenido.banner.botonSecundarioActivo).toBe(false), { timeout: 3000 });
    fireEvent.click(oculto);
    await waitFor(() => expect(ultimaPut()?.contenido.banner.botonSecundarioActivo).toBe(true), { timeout: 3000 });
  });
  it('modo «Mis banners» con la lista vacía muestra el estado vacío y el aviso de respaldo', async () => {
    await abrir();
    elegirBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Mis banners (imágenes)' }));
    await waitFor(() => expect(ultimaPut()?.contenido.banner.modo).toBe('IMAGENES'), { timeout: 3000 });
    expect(screen.getByText('No hay banners activos: se muestra Caprichos del mes')).toBeTruthy();
    elegirBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Administrar banners' }));
    expect(await screen.findByText('Subir mi primer banner')).toBeTruthy();
    expect(screen.getByText(/Medida ideal: 1600×500 px/)).toBeTruthy();
  });
  it('sube un banner, lo oculta, lo programa, valida fechas y enlace https, y lo elimina con Sí/No', async () => {
    await abrir({ modo: 'IMAGENES', imagenes: [im('a')] });
    elegirBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Administrar banners' }));
    const entrada = await screen.findByLabelText('Agregar banner');
    fireEvent.change(entrada, { target: { files: [new File(['x'], 'b.png', { type: 'image/png' })] } });
    await waitFor(() => expect(ultimaPut()?.contenido.banner.imagenes).toHaveLength(2), { timeout: 3000 });
    // ocultar el primero
    fireEvent.click(screen.getAllByRole('switch', { name: 'Mostrar este banner' })[0]);
    await waitFor(() => expect(ultimaPut()?.contenido.banner.imagenes[0].activo).toBe(false), { timeout: 3000 });
    expect(screen.getAllByText('Oculto').length).toBeGreaterThan(0);
    // fechas: hasta antes que desde se rechaza
    fireEvent.change(screen.getByLabelText('Mostrar desde del banner 1'), { target: { value: '2999-12-10' } });
    fireEvent.change(screen.getByLabelText('Mostrar hasta del banner 1'), { target: { value: '2999-12-01' } });
    expect(screen.getByText('La fecha final no puede ser antes de la fecha de inicio.')).toBeTruthy();
    // enlace externo: solo https
    fireEvent.change(screen.getByLabelText('Enlace del banner 1'), { target: { value: 'URL' } });
    const url = screen.getByLabelText('Dirección web del banner 1');
    fireEvent.change(url, { target: { value: 'http://malo.com' } });
    fireEvent.blur(url);
    expect(screen.getByText(/Esa dirección no sirve/)).toBeTruthy();
    fireEvent.change(url, { target: { value: 'https://caprichos.pe' } });
    fireEvent.blur(url);
    await waitFor(() => expect(ultimaPut()?.contenido.banner.imagenes[0].enlace).toEqual({ tipo: 'URL', valor: 'https://caprichos.pe' }), { timeout: 3000 });
    // categoría por id
    fireEvent.change(screen.getByLabelText('Enlace del banner 2'), { target: { value: 'CATEGORIA' } });
    await waitFor(() => expect(ultimaPut()?.contenido.banner.imagenes[1].enlace).toEqual({ tipo: 'CATEGORIA', valor: '3' }), { timeout: 3000 });
    // eliminar: No no borra, Sí borra
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar banner 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.getByLabelText('Eliminar banner 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar banner 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    await waitFor(() => expect(ultimaPut()?.contenido.banner.imagenes).toHaveLength(1), { timeout: 3000 });
  });
  it('avisa si el producto enlazado ya no existe y alterna Ver en PC / Ver en celular', async () => {
    await abrir({ modo: 'IMAGENES', imagenes: [im('a', { enlace: { tipo: 'PRODUCTO', valor: '999' }, urlCelular: '/archivos/m.webp' })] });
    elegirBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Administrar banners' }));
    expect(await screen.findByText(/ya no lleva a ningún lado/)).toBeTruthy();
    const mini = () => document.querySelector('[data-miniatura]') as HTMLImageElement;
    expect(mini().dataset.miniatura).toBe('pc');
    fireEvent.click(screen.getByRole('button', { name: 'Ver en celular' }));
    expect(mini().dataset.miniatura).toBe('celular');
    expect(mini().getAttribute('src')).toBe('/archivos/m.webp');
  });
  it('mide el tamaño del intervalo y deja reproducir la vista previa', async () => {
    await abrir({ modo: 'IMAGENES', imagenes: [im('a'), im('b')] });
    elegirBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Administrar banners' }));
    const n = await screen.findByLabelText('Cuánto dura cada imagen');
    fireEvent.change(n, { target: { value: '9' } });
    fireEvent.blur(n);
    await waitFor(() => expect(ultimaPut()?.contenido.banner.intervaloSeg).toBe(9), { timeout: 3000 });
    expect(screen.getByRole('button', { name: /Reproducir/ })).toBeTruthy();
    expect(within(document.querySelector('[data-vista-carrusel]') as HTMLElement).getByLabelText('Banner siguiente')).toBeTruthy();
  });
  it('publicar muestra el mensaje de éxito; descartar devuelve el banner publicado', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Editar botón Pedir ahora' }));
    const caja = await screen.findByLabelText('Texto del botón');
    fireEvent.change(caja, { target: { value: 'Quiero' } });
    fireEvent.blur(caja);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar botón Quiero' })).toBeTruthy());
    fireEvent.click(screen.getByText('Descartar'));
    const si = screen.queryByText(/^Sí, descartar/);
    if (si) fireEvent.click(si);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar botón Pedir ahora' })).toBeTruthy(), { timeout: 3000 });
    escribirTitulo();
    fireEvent.click(screen.getByText('Publicar'));
    fireEvent.click(screen.getByText('Sí, publicar'));
    expect(await screen.findByText(/¡Listo! Tus cambios ya se ven en la carta/, {}, { timeout: 3000 })).toBeTruthy();
  });
});

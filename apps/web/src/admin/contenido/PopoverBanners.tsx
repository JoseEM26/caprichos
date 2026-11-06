import { useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent } from 'react';
import { CarruselBanners, estadoBanner } from '../../carta/CarruselBanners';
import type { BannerImagen, EnlaceBanner } from '../../carta/CarruselBanners';
import { Boton } from '../../comun/Boton';
import { Insignia } from '../../comun/Insignia';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { subirFotoEdicion } from './edicion/subirFoto';

export const MAX_BANNERS = 8;
export const MEDIDA_IDEAL = 'Medida ideal: 1600×500 px. Si tu imagen es de otro tamaño, la ajustamos sola (se recorta al centro).';

export const urlHttpsValida = (v: string) => {
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' && u.hostname.includes('.') && !u.username && !u.password;
  } catch {
    return false;
  }
};

interface Opcion { id: string; nombre: string }
interface Props {
  imagenes: BannerImagen[];
  intervaloSeg: number;
  categorias: Opcion[];
  productos: Opcion[];
  movil?: boolean;
  onImagenes: (l: BannerImagen[]) => void;
  onIntervalo: (n: number) => void;
}

const nuevoId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const titulo = { margin: '8px 0 0', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 15 } as const;
const ayuda = { fontSize: 12, opacity: 0.8, fontWeight: 400 } as const;
const tactil = { minHeight: 44, minWidth: 44 } as const;

function Interruptor({ activo, onCambio, etiqueta }: { activo: boolean; onCambio: (v: boolean) => void; etiqueta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => onCambio(!activo)}
      style={{ ...tactil, display: 'inline-flex', alignItems: 'center', gap: 8, border: 0, background: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--cp-navy)', padding: 0 }}
    >
      <span aria-hidden="true" style={{ width: 46, height: 26, borderRadius: 13, background: activo ? 'var(--cp-orange)' : 'var(--cp-line)', position: 'relative', flex: 'none' }}>
        <span style={{ position: 'absolute', top: 3, left: activo ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--cp-white)', transition: 'left .15s' }} />
      </span>
      {etiqueta}
    </button>
  );
}

/** Editor amigable de «Mis banners»: se hace en cuatro pasos y todo queda en el borrador hasta publicar. */
export function PopoverBanners({ imagenes, intervaloSeg, categorias, productos, movil = false, onImagenes, onIntervalo }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [errFecha, setErrFecha] = useState<Record<string, string>>({});
  const [errUrl, setErrUrl] = useState<string | null>(null);
  const [vista, setVista] = useState<Record<string, 'pc' | 'celular'>>({});
  const [reproduciendo, setReproduciendo] = useState(false);
  const [buscar, setBuscar] = useState<Record<string, string>>({});
  const entrada = useRef<HTMLInputElement>(null);

  const cambiar = (id: string, p: Partial<BannerImagen>) => onImagenes(imagenes.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const mover = (i: number, d: number) => {
    const l = [...imagenes];
    [l[i], l[i + d]] = [l[i + d], l[i]];
    onImagenes(l);
  };
  const subir = async (f: File | undefined | null, aplicar: (url: string) => void) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('Ese archivo no es una imagen. Elige una foto en formato JPG, PNG o WebP.');
    setError(null);
    setSubiendo(true);
    try {
      aplicar(await subirFotoEdicion(f));
    } catch {
      setError('No pudimos subir tu imagen. Revisa que pese menos de 5 MB y que tengas internet; luego inténtalo otra vez.');
    } finally {
      setSubiendo(false);
    }
  };
  const agregar = (f: File | undefined | null) => {
    if (imagenes.length >= MAX_BANNERS) return setError(`Ya tienes ${MAX_BANNERS} banners, que es el máximo. Elimina uno para subir otro.`);
    return subir(f, (url) => onImagenes([...imagenes, { id: nuevoId(), url, alt: '', activo: true }]));
  };
  const alPegar = (ev: ClipboardEvent) => {
    const f = Array.from(ev.clipboardData?.files ?? []).find((x) => x.type.startsWith('image/'));
    if (f) { ev.preventDefault(); void agregar(f); }
  };
  const alSoltar = (ev: DragEvent) => {
    ev.preventDefault();
    void agregar(ev.dataTransfer?.files?.[0]);
  };
  const setEnlace = (id: string, enlace: EnlaceBanner | undefined) => cambiar(id, { enlace });
  const fecha = (b: BannerImagen, campo: 'desde' | 'hasta', v: string) => {
    const nuevo = { ...b, [campo]: v || undefined };
    if (nuevo.desde && nuevo.hasta && nuevo.hasta < nuevo.desde) return setErrFecha((x) => ({ ...x, [b.id]: 'La fecha final no puede ser antes de la fecha de inicio.' }));
    setErrFecha((x) => ({ ...x, [b.id]: '' }));
    cambiar(b.id, { [campo]: v || undefined });
  };

  const activas = imagenes.filter((x) => estadoBanner(x).id === 'ACTIVO');
  const selector = (
    <>
      <Boton tamano="grande" onClick={() => entrada.current?.click()} disabled={subiendo} aria-label="Subir mi banner">
        {subiendo ? 'Subiendo…' : imagenes.length ? '+ Subir otro banner' : 'Subir mi primer banner'}
      </Boton>
      <input ref={entrada} type="file" accept="image/*" aria-label="Agregar banner" style={{ display: 'none' }} onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ''; void agregar(f); }} />
    </>
  );

  return (
    <div data-editor-banners onPaste={alPegar} onDragOver={(ev) => ev.preventDefault()} onDrop={alSoltar} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 style={titulo}>1. Elige qué se ve</h3>
      <p style={ayuda}>Ahora estás usando <strong>Tus banners</strong>. Para volver al banner de siempre, elige «Caprichos del mes» arriba.</p>

      <h3 style={titulo}>2. Sube tus imágenes</h3>
      <p style={ayuda}>{MEDIDA_IDEAL} Puedes arrastrar la imagen aquí o pegarla (Ctrl+V). Hasta {MAX_BANNERS} banners, de máximo 5 MB cada uno.</p>
      {error && <p role="alert" style={{ color: 'var(--cp-rust)', fontWeight: 700 }}>{error}</p>}
      {activas.length === 0 && imagenes.length > 0 && <p role="status">No hay banners activos: se muestra Caprichos del mes</p>}

      {imagenes.length === 0 ? (
        <EstadoVacio
          titulo="Aún no tienes banners"
          descripcion="Sube una imagen y será lo primero que vean tus clientes al abrir la carta."
          icono={<span aria-hidden="true" style={{ fontSize: 36 }}>🖼️</span>}
          accion={selector}
        />
      ) : (
        <>
          {imagenes.map((b, i) => {
            const est = estadoBanner(b);
            const v = vista[b.id] ?? 'pc';
            const alMostrar = v === 'celular' && b.urlCelular ? b.urlCelular : b.url;
            const rota = (b.enlace?.tipo === 'CATEGORIA' && !categorias.some((c) => c.id === b.enlace!.valor)) || (b.enlace?.tipo === 'PRODUCTO' && !productos.some((p) => p.id === b.enlace!.valor));
            const lista = b.enlace?.tipo === 'CATEGORIA' ? categorias : productos.filter((p) => !buscar[b.id] || p.nombre.toLowerCase().includes(buscar[b.id].toLowerCase()));
            return (
              <div key={b.id} data-banner-fila style={{ border: '1.5px solid var(--cp-line)', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, opacity: b.activo ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>Banner {i + 1}</strong>
                  <Insignia variante={est.id === 'ACTIVO' ? 'exito' : est.id === 'VENCIDO' ? 'peligro' : est.id === 'PROGRAMADO' ? 'aviso' : 'neutro'}>{est.texto}</Insignia>
                </div>
                <div role="group" aria-label={`Cómo se ve el banner ${i + 1}`} style={{ display: 'flex', gap: 6 }}>
                  <Boton tamano="pequeno" variante={v === 'pc' ? 'oscuro' : 'secundario'} aria-pressed={v === 'pc'} onClick={() => setVista((x) => ({ ...x, [b.id]: 'pc' }))}>Ver en PC</Boton>
                  <Boton tamano="pequeno" variante={v === 'celular' ? 'oscuro' : 'secundario'} aria-pressed={v === 'celular'} onClick={() => setVista((x) => ({ ...x, [b.id]: 'celular' }))}>Ver en celular</Boton>
                </div>
                <img src={alMostrar} alt={b.alt || `Banner ${i + 1}`} data-miniatura={v} style={{ width: v === 'pc' ? '100%' : '60%', aspectRatio: v === 'pc' ? '16 / 5' : '4 / 3', objectFit: 'cover', borderRadius: 10, alignSelf: 'center', background: 'var(--cp-sand)' }} />
                <small style={ayuda}>{v === 'celular' && !b.urlCelular ? 'En celular usamos esta misma imagen, centrada.' : v === 'celular' ? 'Imagen que subiste para celular.' : 'Así se ve en computadora.'}</small>
                <Interruptor activo={b.activo} onCambio={(x) => cambiar(b.id, { activo: x })} etiqueta="Mostrar este banner" />
                <label>
                  ¿Qué dice tu imagen? (ayuda a quien no la puede ver)
                  <input type="text" maxLength={150} defaultValue={b.alt} aria-label={`Texto alternativo del banner ${i + 1}`} placeholder="Ej.: 2x1 en frappés este viernes" onBlur={(ev) => ev.target.value.trim() !== b.alt && cambiar(b.id, { alt: ev.target.value.trim() })} />
                </label>
                {!b.alt && <small role="status" style={ayuda}>Te recomendamos describirla con unas pocas palabras.</small>}
                <label>
                  Al tocar el banner, ¿a dónde lleva?
                  <select
                    aria-label={`Enlace del banner ${i + 1}`}
                    value={b.enlace?.tipo ?? (errUrl === b.id ? 'URL' : '')}
                    onChange={(ev) => {
                      const t = ev.target.value;
                      setErrUrl(t === 'URL' ? b.id : null);
                      if (t === 'CARTA') setEnlace(b.id, { tipo: 'CARTA' });
                      else if (t === 'CATEGORIA') setEnlace(b.id, categorias[0] ? { tipo: 'CATEGORIA', valor: categorias[0].id } : undefined);
                      else if (t === 'PRODUCTO') setEnlace(b.id, productos[0] ? { tipo: 'PRODUCTO', valor: productos[0].id } : undefined);
                      else setEnlace(b.id, undefined);
                    }}
                  >
                    <option value="">Sin enlace</option>
                    <option value="CARTA">La carta</option>
                    <option value="CATEGORIA">Una categoría</option>
                    <option value="PRODUCTO">Un producto</option>
                    <option value="URL">Enlace externo</option>
                  </select>
                </label>
                {rota && <small role="alert" style={{ color: 'var(--cp-rust)', fontWeight: 700 }}>Este banner ya no lleva a ningún lado: esa {b.enlace?.tipo === 'CATEGORIA' ? 'categoría' : 'producto'} ya no existe o está oculta. Elige otra.</small>}
                {b.enlace?.tipo === 'PRODUCTO' && (
                  <input type="search" placeholder="Buscar producto…" aria-label={`Buscar producto del banner ${i + 1}`} value={buscar[b.id] ?? ''} onChange={(ev) => setBuscar((x) => ({ ...x, [b.id]: ev.target.value }))} />
                )}
                {(b.enlace?.tipo === 'CATEGORIA' || b.enlace?.tipo === 'PRODUCTO') && (
                  <select aria-label={`Destino del banner ${i + 1}`} value={b.enlace.valor ?? ''} onChange={(ev) => setEnlace(b.id, { tipo: b.enlace!.tipo, valor: ev.target.value })}>
                    {rota && <option value={b.enlace.valor}>(ya no disponible)</option>}
                    {lista.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </select>
                )}
                {(b.enlace?.tipo === 'URL' || errUrl === b.id || errUrl === `bad:${b.id}`) && (
                  <>
                    <input
                      type="url"
                      placeholder="https://tusitio.com"
                      aria-label={`Dirección web del banner ${i + 1}`}
                      defaultValue={b.enlace?.valor ?? ''}
                      onBlur={(ev) => {
                        const x = ev.target.value.trim();
                        if (!x) { setErrUrl(null); return setEnlace(b.id, undefined); }
                        if (urlHttpsValida(x)) { setErrUrl(null); setEnlace(b.id, { tipo: 'URL', valor: x }); }
                        else setErrUrl(`bad:${b.id}`);
                      }}
                    />
                    <small style={ayuda}>Se abre en una pestaña nueva. Solo direcciones seguras que empiecen con https://</small>
                    {errUrl === `bad:${b.id}` && <small role="alert" style={{ color: 'var(--cp-rust)', fontWeight: 700 }}>Esa dirección no sirve. Debe empezar con https:// (por ejemplo https://caprichos.pe).</small>}
                  </>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label>Mostrar desde<input type="date" aria-label={`Mostrar desde del banner ${i + 1}`} defaultValue={b.desde ?? ''} onChange={(ev) => fecha(b, 'desde', ev.target.value)} /></label>
                  <label>Mostrar hasta<input type="date" aria-label={`Mostrar hasta del banner ${i + 1}`} defaultValue={b.hasta ?? ''} onChange={(ev) => fecha(b, 'hasta', ev.target.value)} /></label>
                </div>
                <small style={ayuda}>Opcional. Se muestra solo en esas fechas (hora de Lima), sin que tengas que apagarlo.</small>
                {errFecha[b.id] && <small role="alert" style={{ color: 'var(--cp-rust)', fontWeight: 700 }}>{errFecha[b.id]}</small>}
                <label>
                  {b.urlCelular ? 'Cambiar la imagen de celular' : 'Imagen distinta para celular (opcional)'}
                  <input type="file" accept="image/*" aria-label={`Imagen de celular del banner ${i + 1}`} onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ''; void subir(f, (url) => cambiar(b.id, { urlCelular: url })); }} />
                </label>
                <small style={ayuda}>Si no subes una, usamos la misma imagen recortada al centro. Medida ideal para celular: 1200×900 px.</small>
                {b.urlCelular && <Boton tamano="pequeno" variante="secundario" onClick={() => cambiar(b.id, { urlCelular: undefined })}>Usar la misma imagen en celular</Boton>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Boton tamano="pequeno" variante="secundario" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={`Subir banner ${i + 1}`}>▲ Subir</Boton>
                  <Boton tamano="pequeno" variante="secundario" disabled={i === imagenes.length - 1} onClick={() => mover(i, 1)} aria-label={`Bajar banner ${i + 1}`}>▼ Bajar</Boton>
                  {borrando === b.id ? (
                    <>
                      <span>¿Eliminar este banner?</span>
                      <Boton tamano="pequeno" variante="peligro" onClick={() => { onImagenes(imagenes.filter((x) => x.id !== b.id)); setBorrando(null); }}>Sí</Boton>
                      <Boton tamano="pequeno" variante="secundario" onClick={() => setBorrando(null)}>No</Boton>
                    </>
                  ) : (
                    <Boton tamano="pequeno" variante="texto" onClick={() => setBorrando(b.id)} aria-label={`Eliminar banner ${i + 1}`}>Eliminar</Boton>
                  )}
                </div>
              </div>
            );
          })}
          {imagenes.length < MAX_BANNERS ? selector : <small style={ayuda}>Llegaste al máximo de {MAX_BANNERS} banners.</small>}
        </>
      )}

      <h3 style={titulo}>3. Ajusta cómo se mueven</h3>
      <label>
        Cuánto dura cada imagen (segundos, de 3 a 15)
        <input
          type="number"
          min={3}
          max={15}
          defaultValue={intervaloSeg}
          aria-label="Cuánto dura cada imagen"
          onBlur={(ev) => {
            const n = Math.round(Number(ev.target.value));
            if (n >= 3 && n <= 15) onIntervalo(n);
            else ev.target.value = String(intervaloSeg);
          }}
        />
      </label>
      {activas.length > 1 ? (
        <>
          <Boton tamano="pequeno" variante="oscuro" onClick={() => setReproduciendo((x) => !x)}>{reproduciendo ? '⏸ Detener' : '▶ Reproducir'}</Boton>
          <div data-vista-carrusel>
            <CarruselBanners imagenes={activas} intervaloSeg={intervaloSeg} movil={movil} edicion={!reproduciendo} />
          </div>
        </>
      ) : (
        <small style={ayuda}>Con una sola imagen activa no hay movimiento: se queda fija.</small>
      )}

      <h3 style={titulo}>4. Publica</h3>
      <p style={ayuda}>Tus cambios quedan como borrador. Cuando estés conforme, pulsa «Publicar cambios» arriba y los verán tus clientes.</p>
    </div>
  );
}

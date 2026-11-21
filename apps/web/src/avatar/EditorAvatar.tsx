import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { tieneSoporteWebGL, prefiereMovimientoReducido } from '../mascota/soporteWebGL';
import { cargarAvatar } from './piezas';
import { EscenaAvatar } from './escena';
import type { AccionAvatar } from './escena';
import { crearMiniaturas } from './miniaturas';
import type { Miniaturas } from './miniaturas';
import { aplicarDisfraz, CATS, NOMBRE_COLOR, norm, normalizar, OJOS, PALETA, PELOS, PIELES, porDefecto, ZOOM } from './config';
import type { CategoriaEditor } from './config';
import type { CategoriaPieza, ConfigAvatar } from './tipos';
import './avatar.css';

export interface EditorAvatarProps {
  /** Configuración guardada en la cuenta (null = aún no tiene avatar) */
  inicial: unknown | null;
  /** Nombre de la cuenta: apodo sugerido si no hay avatar */
  nombreCuenta: string;
  /** Sube configuración + retrato PNG (data URL). Debe lanzar si falla. */
  guardar: (config: ConfigAvatar, retrato: string) => Promise<void>;
  cerrar: () => void;
}

const azar = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const PIEZAS_AZAR: CategoriaPieza[] = ['arriba', 'abajo', 'calzado'];

function Muestras({ lista, actual, alElegir, etiqueta }: { lista: string[]; actual: string; alElegir: (c: string) => void; etiqueta: string }) {
  return (
    <div className="av-muestras">
      {lista.map((col) => (
        <button key={col} type="button" className="av-muestra" aria-pressed={actual.toLowerCase() === col.toLowerCase()} aria-label={`${etiqueta} ${col}`} onClick={() => alElegir(col)}>
          <i style={{ background: col }} />
        </button>
      ))}
      <label className="av-libre">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(actual) ? actual : '#888888'} aria-label={`${etiqueta}: otro color`} onChange={(e) => alElegir(e.target.value)} />
        Otro color
      </label>
    </div>
  );
}

export default function EditorAvatar({ inicial, nombreCuenta, guardar, cerrar }: EditorAvatarProps) {
  const A = useMemo(() => cargarAvatar(), []);
  const [cfg, setCfg] = useState<ConfigAvatar>(() => normalizar(A, inicial, nombreCuenta));
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const [cat, setCat] = useState<CategoriaEditor>('cabello');
  const [grupo, setGrupo] = useState('Todos');
  const [busqueda, setBusqueda] = useState('');
  const [minis, setMinis] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [, setVersion] = useState(0);
  const hay3d = useMemo(() => tieneSoporteWebGL(), []);

  const lienzo = useRef<HTMLCanvasElement>(null);
  const escena = useRef<EscenaAvatar | null>(null);
  const mini = useRef<Miniaturas | null>(null);
  const pasado = useRef<string[]>([]);
  const futuro = useRef<string[]>([]);
  const ultimo = useRef({ clave: '', en: 0 });
  const titulo = useRef<HTMLHeadingElement>(null);

  // Escena y miniaturas: una vez por editor
  useEffect(() => {
    if (!hay3d || !lienzo.current) return;
    try {
      escena.current = new EscenaAvatar(lienzo.current, A, prefiereMovimientoReducido());
      mini.current = crearMiniaturas(A);
    } catch {
      escena.current = null;
      mini.current = null;
      return;
    }
    escena.current.reconstruir(cfgRef.current, false);
    escena.current.accion('saludando', 2.6);
    return () => {
      escena.current?.dispose();
      mini.current?.dispose();
      escena.current = null;
      mini.current = null;
    };
  }, [A, hay3d]);

  useEffect(() => { titulo.current?.focus(); }, []);

  const aplicar = useCallback((nueva: ConfigAvatar, opc: { sinPop?: boolean; anim?: AccionAvatar | null } = {}) => {
    cfgRef.current = nueva;
    setCfg(nueva);
    setSucio(true);
    setMensaje('');
    escena.current?.reconstruir(nueva, !opc.sinPop);
    if (opc.anim) escena.current?.accion(opc.anim, 1.6);
    setVersion((v) => v + 1);
  }, []);

  /** Un cambio con historial. `fusionar`: cambios seguidos de lo mismo (arrastrar el selector libre) valen un solo paso. */
  const cambiar = useCallback((fn: (c: ConfigAvatar) => void, opc: { sinPop?: boolean; anim?: AccionAvatar | null; fusionar?: string; minis?: boolean } = {}) => {
    const ahora = Date.now();
    const seguido = opc.fusionar && ultimo.current.clave === opc.fusionar && ahora - ultimo.current.en < 700;
    if (!seguido) {
      pasado.current.push(JSON.stringify(cfgRef.current));
      if (pasado.current.length > 60) pasado.current.shift();
    }
    ultimo.current = { clave: opc.fusionar ?? '', en: ahora };
    futuro.current = [];
    const nueva: ConfigAvatar = JSON.parse(JSON.stringify(cfgRef.current));
    fn(nueva);
    aplicar(nueva, opc);
    if (opc.minis) setTick((t) => t + 1);
  }, [aplicar]);

  const deshacer = useCallback(() => {
    const previo = pasado.current.pop();
    if (!previo) return;
    futuro.current.push(JSON.stringify(cfgRef.current));
    aplicar(JSON.parse(previo));
    setTick((t) => t + 1);
  }, [aplicar]);
  const rehacer = useCallback(() => {
    const sig = futuro.current.pop();
    if (!sig) return;
    pasado.current.push(JSON.stringify(cfgRef.current));
    aplicar(JSON.parse(sig));
    setTick((t) => t + 1);
  }, [aplicar]);

  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) { e.preventDefault(); deshacer(); }
      else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (e.shiftKey && k === 'z'))) { e.preventDefault(); rehacer(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [deshacer, rehacer]);

  useEffect(() => {
    if (!sucio) return;
    const antes = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, [sucio]);

  // Vista de la cámara según la pestaña
  useEffect(() => { escena.current?.irA(cat === 'cuerpo' ? 'cuerpo' : (ZOOM[cat] ?? 'cuerpo')); }, [cat]);

  // Piezas visibles de la pestaña
  const defs = cat === 'cuerpo' ? [] : A.REG[cat];
  const grupos = useMemo(() => ['Todos', ...Array.from(new Set(defs.map((d) => d.grupo || 'Otros')))], [defs]);
  const grupoOk = grupos.includes(grupo) ? grupo : 'Todos';
  const visibles = useMemo(
    () => defs.filter((d) => (grupoOk === 'Todos' || (d.grupo || 'Otros') === grupoOk) && (!busqueda || norm(d.nombre).includes(norm(busqueda)))),
    [defs, grupoOk, busqueda],
  );
  const actualId = cat === 'disfraz' ? cfg.disfrazId : cat === 'cuerpo' ? null : cfg[cat].id;

  // Miniaturas 3D: el avatar de hoy con cada pieza (se piden en cola para no trabar la pantalla)
  const claveMinis = visibles.map((d) => d.id).join(',');
  useEffect(() => {
    const m = mini.current;
    if (!m || cat === 'cuerpo') return;
    m.cancelar();
    setMinis({});
    const base = cfgRef.current;
    for (const d of visibles) {
      const c = cat === 'disfraz' ? aplicarDisfraz(A, base, d) : { ...base, [cat]: { id: d.id, colores: d.id === base[cat].id ? base[cat].colores : {} } };
      m.pedir(c as ConfigAvatar, cat === 'disfraz' ? 'cuerpo' : (ZOOM[cat] ?? 'cuerpo'), (url) => {
        if (url) setMinis((prev) => ({ ...prev, [d.id]: url }));
      });
    }
    return () => m.cancelar();
    // visibles cambia con cat/grupo/búsqueda; tick, tras cambios de color
  }, [cat, claveMinis, tick, A]);

  // Tras elegir un color, las miniaturas se refrescan sin saltos
  const refrescoT = useRef<ReturnType<typeof setTimeout>>();
  const refrescarMinis = () => { clearTimeout(refrescoT.current); refrescoT.current = setTimeout(() => setTick((t) => t + 1), 400); };
  useEffect(() => () => clearTimeout(refrescoT.current), []);

  const ponerColor = (clave: 'piel' | 'ojos' | 'pelo' | 'pieza', slot: string, color: string) => {
    cambiar((c) => {
      if (clave === 'piel') c.piel = color;
      else if (clave === 'ojos') c.ojos = color;
      else if (clave === 'pelo') c.colorPelo = color;
      else if (cat !== 'cuerpo' && cat !== 'disfraz') c[cat] = { ...c[cat], colores: { ...c[cat].colores, [slot]: color } };
    }, { sinPop: true, fusionar: `${clave}:${slot}:${cat}` });
    refrescarMinis();
  };

  const elegir = (id: string) => {
    if (cat === 'cuerpo') return;
    if (cat === 'disfraz') {
      const d = A.buscar('disfraz', id);
      if (!d) return;
      cambiar((c) => Object.assign(c, aplicarDisfraz(A, c, d)), { anim: 'celebrar', minis: true });
      setMensaje(`¡Disfraz «${d.nombre}» puesto! Cambia lo que quieras en cada pestaña.`);
      return;
    }
    if (cfg[cat].id === id) return;
    cambiar((c) => { c[cat] = { id, colores: {} }; }, { anim: cat === 'cabeza' || cat === 'cara' ? 'posar' : null });
  };

  const quitarDisfraz = () => cambiar((c) => { Object.assign(c, porDefecto(A, c.nombre), { nombre: c.nombre }); }, { minis: true });

  const alAzar = () => cambiar((c) => {
    const pick = (k: string) => { const l = A.REG[k]; return l.length ? azar(l).id : 'ninguno'; };
    Object.assign(c, { genero: azar(['mujer', 'hombre', 'neutro']), piel: azar(PIELES), ojos: azar(OJOS), expresion: azar(['feliz', 'sonrisa', 'guino']), colorPelo: azar(PELOS), disfraz: null, disfrazId: null });
    c.cabello = { id: pick('cabello'), colores: {} };
    for (const k of PIEZAS_AZAR) c[k] = { id: pick(k), colores: { principal: azar(PALETA) } };
    for (const k of ['cabeza', 'cara', 'accesorio'] as const) c[k] = { id: Math.random() < 0.4 ? pick(k) : 'ninguno', colores: {} };
  }, { anim: 'celebrar', minis: true });

  const restablecer = () => cambiar((c) => { Object.assign(c, porDefecto(A, c.nombre)); }, { anim: 'saludando', minis: true });

  const alGuardar = async () => {
    if (!mini.current) return;
    setGuardando(true);
    setError('');
    try {
      const retrato = mini.current.retrato(cfgRef.current);
      await guardar(cfgRef.current, retrato);
      setSucio(false);
      setMensaje('¡Listo! Tu avatar quedó guardado en tu cuenta.');
      escena.current?.accion('celebrar', 1.8);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No pudimos guardar tu avatar. Inténtalo otra vez.');
    } finally {
      setGuardando(false);
    }
  };

  const salir = () => {
    if (sucio && !window.confirm('Tienes cambios sin guardar. ¿Salir de todos modos?')) return;
    cerrar();
  };

  const teclasPestanas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = CATS.findIndex((c) => c.id === cat);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % CATS.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + CATS.length) % CATS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = CATS.length - 1;
    if (n < 0) return;
    e.preventDefault();
    cambiarCat(CATS[n].id);
    document.getElementById(`av-tab-${CATS[n].id}`)?.focus();
  };
  const cambiarCat = (id: CategoriaEditor) => { setCat(id); setGrupo('Todos'); setBusqueda(''); };

  const slots = cat !== 'cuerpo' && cat !== 'disfraz' && cat !== 'cabello' ? A.buscar(cat, cfg[cat].id) : undefined;
  const nombreCat = CATS.find((c) => c.id === cat)?.nombre ?? '';

  return (
    <div className="av-raiz" role="dialog" aria-modal="true" aria-label="Mi avatar" onKeyDown={(e) => { if (e.key === 'Escape') salir(); }}>
      <header className="av-cab">
        <h2 ref={titulo} tabIndex={-1}>Mi avatar</h2>
        <button type="button" className="av-btn" onClick={salir}>Cerrar</button>
      </header>
      <div className="av-main">
        <section className="av-tarjeta av-vista" aria-label="Vista de tu avatar">
          <div className="av-lienzo-caja">
            {hay3d ? (
              <canvas ref={lienzo} className="av-lienzo" role="img" aria-label="Tu avatar en 3D. Arrastra para girarlo." />
            ) : (
              <p className="av-sin3d" role="alert">Este equipo no puede mostrar 3D, así que no se puede crear el avatar aquí. Prueba desde otro celular o navegador.</p>
            )}
            <div className="av-placa"><span>{cfg.nombre || 'Tu nombre'}</span>{cfg.disfraz && <small>· {cfg.disfraz}</small>}</div>
            <div className="av-deshacer">
              <button type="button" className="av-redondo" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" disabled={!pasado.current.length} onClick={deshacer}>↶</button>
              <button type="button" className="av-redondo" title="Rehacer (Ctrl+Y)" aria-label="Rehacer" disabled={!futuro.current.length} onClick={rehacer}>↷</button>
            </div>
            <div className="av-pista">Arrastra para girar · tócalo para que salude</div>
          </div>
          <div className="av-acciones">
            {([['saludando', '👋 Saludar'], ['baile', '💃 Bailar'], ['celebrar', '🎉 Celebrar'], ['giro', '🔄 Girar'], ['posar', '📸 Posar']] as [AccionAvatar, string][]).map(([a, t]) => (
              <button key={a} type="button" className="av-btn" onClick={() => escena.current?.accion(a, 2.6)}>{t}</button>
            ))}
          </div>
        </section>

        <section className="av-tarjeta av-vestidor" aria-label="Vestidor">
          <div className="av-nombre">
            <label htmlFor="av-apodo">¿Cómo te llamamos?</label>
            <input id="av-apodo" maxLength={18} value={cfg.nombre} autoComplete="nickname" onChange={(e) => { const v = e.target.value; cambiar((c) => { c.nombre = v; }, { sinPop: true, fusionar: 'apodo' }); }} />
            <small>Así sale tu pedido en la pantalla del local: solo tu nombre o apodo, nunca tu celular.</small>
            {/* Saludo al entrar a la carta */}
            <label className="av-interruptor">
              <input type="checkbox" checked={cfg.mostrarAlEntrar !== false} onChange={(e) => { const v = e.target.checked; cambiar((c) => { c.mostrarAlEntrar = v; }, { sinPop: true }); }} />
              Mostrar mi avatar al entrar
            </label>
          </div>
          <div className="av-cats" role="tablist" aria-label="Partes del avatar" onKeyDown={teclasPestanas}>
            {CATS.map((c) => (
              <button key={c.id} id={`av-tab-${c.id}`} type="button" role="tab" className="av-cat" aria-selected={c.id === cat} aria-controls="av-panel" tabIndex={c.id === cat ? 0 : -1} onClick={() => cambiarCat(c.id)}>
                <span aria-hidden="true">{c.icono}</span>{c.nombre}
                {c.id !== 'cuerpo' && <em>{A.REG[c.id].filter((d) => d.id !== 'ninguno').length}</em>}
              </button>
            ))}
          </div>

          <div id="av-panel" role="tabpanel" aria-labelledby={`av-tab-${cat}`}>
            {cat === 'cuerpo' ? (
              <div className="av-op">
                <div className="av-slot"><b>Soy</b><div className="av-chips">{([['mujer', 'Mujer'], ['hombre', 'Hombre'], ['neutro', 'Prefiero no decir']] as const).map(([v, t]) => (
                  <button key={v} type="button" className="av-chip" aria-pressed={cfg.genero === v} onClick={() => cambiar((c) => { c.genero = v; }, { anim: 'saludando', minis: true })}>{t}</button>
                ))}</div></div>
                <div className="av-slot"><b>Tono de piel</b><Muestras lista={PIELES} actual={cfg.piel} etiqueta="Piel" alElegir={(c) => ponerColor('piel', '', c)} /></div>
                <div className="av-slot"><b>Color de ojos</b><Muestras lista={OJOS} actual={cfg.ojos} etiqueta="Ojos" alElegir={(c) => ponerColor('ojos', '', c)} /></div>
                <div className="av-slot"><b>Expresión</b><div className="av-chips">{([['feliz', '😄 Feliz'], ['sonrisa', '🙂 Sonrisa'], ['guino', '😉 Guiño'], ['sorpresa', '😮 Sorpresa']] as const).map(([v, t]) => (
                  <button key={v} type="button" className="av-chip" aria-pressed={cfg.expresion === v} onClick={() => cambiar((c) => { c.expresion = v; }, { anim: 'saludando', minis: true })}>{t}</button>
                ))}</div></div>
              </div>
            ) : (
              <>
                <div className="av-filtros">
                  <input className="av-buscar" type="search" placeholder={`Buscar ${nombreCat.toLowerCase()}…`} aria-label="Buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                  {cat === 'disfraz' && cfg.disfraz && <button type="button" className="av-btn" onClick={quitarDisfraz}>Quitar disfraz</button>}
                </div>
                <div className="av-chips" style={{ marginBottom: 10 }}>
                  {grupos.map((g) => <button key={g} type="button" className="av-chip" aria-pressed={g === grupoOk} onClick={() => setGrupo(g)}>{g}</button>)}
                </div>
                <div className="av-rejilla">
                  {visibles.length === 0 && <p className="av-sin-res">No hay piezas con ese nombre.</p>}
                  {visibles.map((d) => (
                    <button key={d.id} type="button" className="av-item" data-id={d.id} aria-pressed={d.id === actualId} onClick={() => elegir(d.id)}>
                      {minis[d.id] ? <img src={minis[d.id]} alt="" /> : <span className="av-vacio" aria-hidden="true">✦</span>}
                      {d.nombre}
                      <small>{d.grupo || ''}</small>
                    </button>
                  ))}
                </div>
                <div className="av-colores">
                  {cat === 'disfraz' && <p className="av-nota">Elige un disfraz y luego cambia los colores de cada prenda en su pestaña (Arriba, Gorros, Extras…).</p>}
                  {cat === 'cabello' && <><h3>Color del cabello</h3><div className="av-slot"><Muestras lista={PELOS} actual={cfg.colorPelo} etiqueta="Cabello" alElegir={(c) => ponerColor('pelo', '', c)} /></div></>}
                  {slots && slots.colores.length > 0 && (
                    <>
                      <h3>Colores de «{slots.nombre}»</h3>
                      {slots.colores.map((slot) => {
                        const actual = cat !== 'disfraz' ? (cfg[cat as CategoriaPieza].colores[slot] ?? slots.porDefecto?.[slot] ?? '#888888') : '#888888';
                        return <div className="av-slot" key={slot}><b>{NOMBRE_COLOR[slot] ?? slot}</b><Muestras lista={PALETA} actual={actual} etiqueta={NOMBRE_COLOR[slot] ?? slot} alElegir={(c) => ponerColor('pieza', slot, c)} /></div>;
                      })}
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="av-pie">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="av-btn" onClick={alAzar}>🎲 Al azar</button>
              <button type="button" className="av-btn" onClick={restablecer}>Restablecer</button>
            </div>
            <span className="av-estado" role="status" aria-live="polite" data-sucio={sucio}>{error ? '' : mensaje || (sucio ? 'Cambios sin guardar' : '')}</span>
            <button type="button" className="av-btn av-prim" disabled={guardando || !hay3d} onClick={() => void alGuardar()}>{guardando ? 'Guardando…' : 'Guardar avatar'}</button>
          </div>
          {error && <p className="av-error" role="alert">{error}</p>}
        </section>
      </div>
    </div>
  );
}

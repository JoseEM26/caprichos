import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSesion } from '../../comun/sesion';
import { CATALOGO } from './catalogo';
import type { EntradaConfig } from './catalogo';
import { buscar, rangosResaltado } from './catalogo/buscar';
import { grupoDe } from './NavegacionConfiguracion';
import './configuracion-nav.css';

const LLAVE_RECIENTES = 'cfg_busq_recientes';
const LLAVE_USOS = 'cfg_busq_usos';
const MAX_VISIBLES = 8;

const leer = <T,>(k: string, def: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : def; } catch { return def; }
};
const guardar = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

function Resaltado({ texto, consulta }: { texto: string; consulta: string }) {
  const partes: React.ReactNode[] = [];
  let pos = 0;
  rangosResaltado(texto, consulta).forEach(([a, b], i) => {
    if (a > pos) partes.push(texto.slice(pos, a));
    partes.push(<mark key={i} className="cfg-marca">{texto.slice(a, b)}</mark>);
    pos = b;
  });
  partes.push(texto.slice(pos));
  return <>{partes}</>;
}

const ETIQUETA_PELIGRO = { bajo: 'Impacto bajo', medio: 'Impacto medio', alto: 'Afecta dinero o clientes' } as const;

export function BuscadorConfiguracion({ categorias, onElegir, catalogo = CATALOGO }: {
  categorias: Array<{ id: string; n: string }>;
  onElegir: (e: EntradaConfig) => void;
  catalogo?: EntradaConfig[];
}) {
  const { tiene, usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN' || tiene('ADMIN');
  const puedeEditar = esAdmin || tiene('local/editar') || tiene('configuracion/editar');
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [todos, setTodos] = useState(false);
  const [recientes, setRecientes] = useState<string[]>(() => leer<string[]>(LLAVE_RECIENTES, []));
  const [usos, setUsos] = useState<Record<string, number>>(() => leer<Record<string, number>>(LLAVE_USOS, {}));
  const raiz = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const nombreTab = (t: string) => categorias.find((c) => c.id === t)?.n ?? t;
  const visible = (e: EntradaConfig) =>
    categorias.some((c) => c.id === e.tab) && (!e.permiso || esAdmin || tiene(e.permiso));

  const encontrados = useMemo(
    () => buscar(catalogo, q, { visible, nombreTab }).map((r) => r.entrada),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, catalogo, categorias, esAdmin, tiene],
  );
  const porId = (id: string) => catalogo.find((e) => e.id === id && visible(e));
  const sugeridos = useMemo(() => {
    if (q.trim()) return [];
    const rec = recientes.map(porId).filter(Boolean) as EntradaConfig[];
    const mas = Object.entries(usos).sort((a, b) => b[1] - a[1]).map(([id]) => porId(id)).filter((e): e is EntradaConfig => !!e && !rec.includes(e)).slice(0, 5);
    return [...rec.map((e) => ({ e, tipo: 'Reciente' })), ...mas.map((e) => ({ e, tipo: 'Más usado' }))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, recientes, usos, catalogo, categorias, esAdmin, tiene]);

  const lista = q.trim() ? (todos ? encontrados : encontrados.slice(0, MAX_VISIBLES)) : sugeridos.map((s) => s.e);

  useEffect(() => { setActivo(0); setTodos(false); }, [q]);

  // atajos globales: "/" y Ctrl/Cmd+K
  useEffect(() => {
    const f = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      const escribiendo = !!t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);
      if ((ev.key === 'k' || ev.key === 'K') && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); input.current?.focus(); setAbierto(true); }
      else if (ev.key === '/' && !escribiendo && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { ev.preventDefault(); input.current?.focus(); setAbierto(true); }
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, []);

  useEffect(() => {
    const f = (ev: MouseEvent) => { if (raiz.current && !raiz.current.contains(ev.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, []);

  const elegir = (e: EntradaConfig) => {
    const r = [e.id, ...recientes.filter((x) => x !== e.id)].slice(0, 5);
    const u = { ...usos, [e.id]: (usos[e.id] || 0) + 1 };
    setRecientes(r); setUsos(u); guardar(LLAVE_RECIENTES, r); guardar(LLAVE_USOS, u);
    setAbierto(false); setQ('');
    input.current?.blur();
    onElegir(e);
  };

  const teclas = (ev: React.KeyboardEvent) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setAbierto(true); setActivo((a) => Math.min(a + 1, lista.length - 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
    else if (ev.key === 'Enter') { if (abierto && lista[activo]) { ev.preventDefault(); elegir(lista[activo]); } }
    else if (ev.key === 'Escape') { if (abierto) { ev.preventDefault(); setAbierto(false); } else setQ(''); }
  };

  const hayConsulta = !!q.trim();
  return (
    <div className="cfg-buscador" ref={raiz} role="search">
      <div className="cfg-buscador-campo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-label="Buscar un ajuste"
          aria-expanded={abierto}
          aria-controls="cfg-buscador-lista"
          aria-autocomplete="list"
          aria-activedescendant={abierto && lista[activo] ? `cfg-res-${lista[activo].id}` : undefined}
          autoComplete="off"
          placeholder="Buscar un ajuste: horario, delivery gratis, spam, voucher, impresora…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setAbierto(true); }}
          onFocus={() => setAbierto(true)}
          onKeyDown={teclas}
        />
        <kbd className="cfg-kbd" aria-hidden="true">/</kbd>
      </div>

      {abierto && (
        <div className="cfg-buscador-panel">
          {hayConsulta && !encontrados.length ? (
            <div className="cfg-sin-resultados" role="status">
              <strong>Sin resultados para «{q.trim()}»</strong>
              <p>Prueba con una palabra más corta, sin tildes, o con un sinónimo (por ejemplo «envío» en vez de «delivery»).</p>
              <button type="button" className="cfg-boton-sec" onClick={() => { setQ(''); input.current?.focus(); }}>Limpiar</button>
            </div>
          ) : !hayConsulta && !lista.length ? (
            <div className="cfg-sin-resultados">Escribe lo que quieres cambiar. Atajo: «/» o Ctrl+K.</div>
          ) : (
            <>
              {!hayConsulta && <div className="cfg-panel-titulo">Recientes y más usados</div>}
              <ul id="cfg-buscador-lista" role="listbox" aria-label="Resultados">
                {lista.map((e, i) => (
                  <li
                    key={e.id}
                    id={`cfg-res-${e.id}`}
                    role="option"
                    aria-selected={i === activo}
                    className={`cfg-res ${i === activo ? 'cfg-res-activo' : ''}`}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onMouseEnter={() => setActivo(i)}
                    onClick={() => elegir(e)}
                  >
                    <span className="cfg-res-titulo"><Resaltado texto={e.titulo} consulta={q} /></span>
                    <span className="cfg-res-ruta">{grupoDe(e.tab)} › {nombreTab(e.tab)} › {e.seccion}</span>
                    <span className="cfg-res-desc">{e.descripcion}</span>
                    <span className="cfg-res-insignias">
                      {e.peligro && <span className={`cfg-peligro cfg-peligro-${e.peligro}`}>{ETIQUETA_PELIGRO[e.peligro]}</span>}
                      {!puedeEditar && <span className="cfg-solo-lectura">solo lectura</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {hayConsulta && !todos && encontrados.length > MAX_VISIBLES && (
                <button type="button" className="cfg-ver-todos" onMouseDown={(ev) => ev.preventDefault()} onClick={() => setTodos(true)}>
                  Ver todos ({encontrados.length})
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

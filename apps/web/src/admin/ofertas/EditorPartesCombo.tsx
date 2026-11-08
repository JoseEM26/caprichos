import { useEffect, useRef, useState } from 'react';
import { AlternativasParte } from './AlternativasParte';
import {
  CategoriaEditor, Parte, ProductoEditor, GRUPO_POR_DEFECTO, PlantillaOpcion, aplanar, bloquesDe, conSeleccion, faltaEnBloque, gruposDe, idsProductos,
  nombreDeBloque, nombresQueElige, nombreTemporal, nuevaEleccion, nuevoFijo, nuevoOpcional, opcionesDeGrupo, perteneceACategoria, piezaVacia, piezasDePlantilla,
  resumenParaCliente, retitular, saboresDeLaParte, tipoDe,
} from './partesComboModelo';
import './editor-partes-combo.css';

interface Props {
  partes: Parte[];
  onCambiar: (partes: Parte[]) => void;
  productos: ProductoEditor[];
  categorias: CategoriaEditor[];
  /** Tras intentar guardar: marca en rojo la tarjeta incompleta y lleva el foco a ella. */
  mostrarErrores?: boolean;
}

/** − 2 + : cantidad con botones grandes (sin escribir). */
function Cuantas({ valor, onCambio, etiqueta, max = 20 }: { valor: number; onCambio: (n: number) => void; etiqueta: string; max?: number }) {
  return (
    <div className="epc-cuantas" role="group" aria-label={etiqueta}>
      <button type="button" className="epc-redondo" aria-label={`Menos: ${etiqueta}`} disabled={valor <= 1} onClick={() => onCambio(valor - 1)}>−</button>
      <output aria-live="polite" aria-label={`${etiqueta}: ${valor}`}>{valor}</output>
      <button type="button" className="epc-redondo" aria-label={`Más: ${etiqueta}`} disabled={valor >= max} onClick={() => onCambio(valor + 1)}>+</button>
    </div>
  );
}

/** Botón de quitar que pregunta Sí / No antes de borrar. */
function Quitar({ etiqueta, alConfirmar }: { etiqueta: string; alConfirmar: () => void }) {
  const [preguntando, setPreguntando] = useState(false);
  if (!preguntando) {
    return <button type="button" className="epc-redondo epc-peligro" aria-label={etiqueta} title={etiqueta} onClick={() => setPreguntando(true)}>×</button>;
  }
  return (
    <span className="epc-confirmar" role="group" aria-label={`¿${etiqueta}?`}>
      <span>¿Quitar?</span>
      <button type="button" className="epc-chip" onClick={() => { setPreguntando(false); alConfirmar(); }}>Sí</button>
      <button type="button" className="epc-chip" onClick={() => setPreguntando(false)}>No</button>
    </span>
  );
}

/**
 * UN solo selector de «qué puede elegir»: categorías completas (carpeta) o productos sueltos, con buscador y chips.
 * Una categoría completa y productos sueltos no se mezclan (si hay productos, solo valen esos): marcar uno desmarca el otro.
 */
function Selector({ categorias, productos, cats, prods, onCambio, etiqueta }: {
  categorias: CategoriaEditor[]; productos: ProductoEditor[]; cats: string[]; prods: string[]; onCambio: (cats: string[], prods: string[]) => void; etiqueta: string;
}) {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const catsVis = categorias.filter((c) => !t || c.nombre.toLowerCase().includes(t));
  const prodsVis = productos.filter((p) => !t || p.nombre.toLowerCase().includes(t));
  const alternarCat = (id: string) => onCambio(cats.includes(id) ? cats.filter((x) => x !== id) : [...cats, id], []);
  const alternarProd = (id: string) => onCambio([], prods.includes(id) ? prods.filter((x) => x !== id) : [...prods, id]);
  const chips: { id: string; texto: string; nombre: string; quitar: () => void }[] = prods.length > 0
    ? prods.map((id) => { const n = productos.find((x) => x.id === id)?.nombre ?? ''; return { id, texto: n, nombre: n, quitar: () => alternarProd(id) }; })
    : cats.map((id) => { const n = categorias.find((c) => c.id === id)?.nombre ?? ''; return { id, texto: `📁 ${n} — todos`, nombre: n, quitar: () => alternarCat(id) }; });
  return (
    <div className="epc-productos">
      {chips.length > 0 && (
        <div className="epc-chips" role="group" aria-label={`Elegido: ${etiqueta}`}>
          {chips.filter((c) => c.nombre).map((c) => (
            <button key={c.id} type="button" className="epc-chip on" aria-label={`Quitar ${c.nombre}`} onClick={c.quitar}>{c.texto} ×</button>
          ))}
        </div>
      )}
      <input type="search" className="epc-buscar" aria-label={`Buscar categoría o producto: ${etiqueta}`} placeholder="Buscar categoría o producto…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="epc-lista-productos epc-selector" aria-label={`Qué puede elegir: ${etiqueta}`}>
        {catsVis.map((c) => {
          const on = prods.length === 0 && cats.includes(c.id);
          return (
            <li key={`c${c.id}`}>
              <button type="button" role="checkbox" aria-checked={on} aria-label={`${c.nombre} — todos`} className={`epc-producto epc-cat${on ? ' on' : ''}`} onClick={() => alternarCat(c.id)}>
                <span className="epc-sinfoto" aria-hidden="true">📁</span>
                <span>{on ? '✓ ' : ''}{c.nombre} — todos</span>
              </button>
            </li>
          );
        })}
        {prodsVis.map((p) => {
          const on = prods.includes(p.id);
          return (
            <li key={`p${p.id}`}>
              <button type="button" role="checkbox" aria-checked={on} aria-label={p.nombre} className={`epc-producto${on ? ' on' : ''}`} onClick={() => alternarProd(p.id)}>
                {p.fotoUrl ? <img src={p.fotoUrl} alt="" /> : <span className="epc-sinfoto" aria-hidden="true">🍽</span>}
                <span>{on ? '✓ ' : ''}{p.nombre}</span>
              </button>
            </li>
          );
        })}
        {catsVis.length + prodsVis.length === 0 && <li className="epc-nota">No hay nada con ese nombre.</li>}
      </ul>
      <p className="epc-nota">Marca categorías completas o productos sueltos (no se mezclan: al marcar uno se desmarca el otro).</p>
    </div>
  );
}

/** Una línea simple con lo que verá el cliente al elegir. */
function QueVera({ p, productos, categorias }: { p: Parte; productos: ProductoEditor[]; categorias: CategoriaEditor[] }) {
  const nombres = nombresQueElige(p, categorias, productos);
  const quitados = (p.productosExcluidos ?? []).length;
  if (nombres.length === 0) return <p className="epc-nota">Todavía no elegiste qué puede escoger el cliente.</p>;
  return <p className="epc-nota epc-queve">Podrá elegir cualquiera de: {nombres.join(', ')}{quitados ? ` (sin ${quitados} producto${quitados === 1 ? '' : 's'})` : ''}</p>;
}

/** Lista de productos con buscador (sin tope) y toque para marcar. `unico` = se marca uno solo. */
function ListaProductos({ productos, marcados, onCambio, unico, etiqueta, vacio }: {
  productos: ProductoEditor[]; marcados: string[]; onCambio: (ids: string[]) => void; unico?: boolean; etiqueta: string; vacio: string;
}) {
  const [q, setQ] = useState('');
  const texto = q.trim().toLowerCase();
  const lista = texto ? productos.filter((p) => p.nombre.toLowerCase().includes(texto)) : productos;
  return (
    <div className="epc-productos">
      <input type="search" className="epc-buscar" aria-label={`Buscar: ${etiqueta}`} placeholder="Buscar por nombre…" value={q} onChange={(e) => setQ(e.target.value)} />
      {productos.length === 0 ? <p className="epc-nota">{vacio}</p> : (
        <ul className="epc-lista-productos" aria-label={etiqueta}>
          {lista.map((p) => {
            const on = marcados.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={`epc-producto${on ? ' on' : ''}`}
                  aria-pressed={on}
                  onClick={() => onCambio(unico ? [p.id] : on ? marcados.filter((x) => x !== p.id) : [...marcados, p.id])}
                >
                  {p.fotoUrl ? <img src={p.fotoUrl} alt="" /> : <span className="epc-sinfoto" aria-hidden="true">🍽</span>}
                  <span>{on ? '✓ ' : ''}{p.nombre}</span>
                </button>
              </li>
            );
          })}
          {lista.length === 0 && <li className="epc-nota">No hay productos con ese nombre.</li>}
        </ul>
      )}
    </div>
  );
}

/** Sabores: casilla «Elegir sabores específicos» (vacío guardado = todos los sabores). Solo si el producto tiene sabores. */
function Sabores({ disponibles, elegidos, onCambio }: {
  disponibles: { id: string; nombre: string; producto: string }[]; elegidos: string[]; onCambio: (ids: string[]) => void;
}) {
  const [forzar, setForzar] = useState(false);
  if (disponibles.length === 0) return null;
  const especificos = forzar || elegidos.length > 0;
  const activos = elegidos.length > 0 ? elegidos : disponibles.map((s) => s.id);
  const poner = (ids: string[]) => onCambio(ids.length === disponibles.length ? [] : ids);
  return (
    <div className="epc-bloque-sabores" role="group" aria-label="Sabores">
      <label className="epc-check">
        <input type="checkbox" checked={especificos} onChange={(e) => { setForzar(e.target.checked); onCambio([]); }} />
        Elegir sabores específicos
      </label>
      {!especificos && <p className="epc-nota">Si no marcas nada, el cliente podrá escoger cualquier sabor.</p>}
      {especificos && (
        <>
          <div className="epc-chips">
            {disponibles.map((s) => {
              const on = activos.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`epc-chip${on ? ' on' : ''}`}
                  aria-pressed={on}
                  disabled={on && activos.length === 1}
                  onClick={() => poner(on ? activos.filter((x) => x !== s.id) : [...activos, s.id])}
                >
                  {on ? '✓ ' : ''}{s.nombre}{s.producto ? <small> · {s.producto}</small> : null}
                </button>
              );
            })}
          </div>
          <p className="epc-nota">Toca un sabor para apagarlo o encenderlo. Siempre debe quedar al menos uno.</p>
        </>
      )}
    </div>
  );
}

/** «?» con una ayuda corta que se abre y se cierra. */
function Ayuda({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button type="button" className="epc-redondo epc-ayuda-boton" aria-label={`Ayuda: ${etiqueta}`} aria-expanded={abierta} onClick={() => setAbierta(!abierta)}>?</button>
      {abierta && <p className="epc-ayuda" role="note">{texto}</p>}
    </>
  );
}

function Tarjeta({ numero, icono, titulo, tipo, abierta, onAbrir, alSubir, alBajar, alQuitar, etiquetaQuitar, ayuda, falta, manual, alTitular, hijos, testid }: {
  numero: number; icono: string; titulo: string; tipo: string; abierta: boolean; onAbrir: () => void; alSubir?: () => void; alBajar?: () => void;
  alQuitar: () => void; etiquetaQuitar: string; ayuda: string; falta: string | null; manual?: boolean; alTitular?: (nuevo: string | null) => void;
  hijos: React.ReactNode; testid: string;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const aplicar = () => { if (texto.trim()) alTitular?.(texto.trim()); setEditando(false); };
  return (
    <section className={`epc-tarjeta${falta ? ' epc-incompleta' : ''}`} data-testid={testid} data-incompleta={falta ? 'true' : undefined}>
      <header className="epc-tarjeta-cab">
        {editando ? (
          <span className="epc-fila epc-titulo-edicion">
            <input className="epc-buscar" aria-label="Título de la tarjeta" value={texto} autoFocus onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && aplicar()} />
            <button type="button" className="epc-chip on" onClick={aplicar}>Listo</button>
            {manual && <button type="button" className="epc-chip" onClick={() => { alTitular?.(null); setEditando(false); }}>Título automático</button>}
          </span>
        ) : (
          <>
            <button type="button" className="epc-tarjeta-titulo" aria-expanded={abierta} onClick={onAbrir}>
              <span className="epc-icono" aria-hidden="true">{icono}</span>
              <span>
                <strong><span className="epc-num">{numero}</span> {titulo}</strong>
                <small>{tipo}</small>
              </span>
              <span aria-hidden="true">{abierta ? '▲' : '▼'}</span>
            </button>
            {alTitular && <button type="button" className="epc-redondo" aria-label={`Cambiar el título de la tarjeta ${numero}`} title="Cambiar el título (opcional)" onClick={() => { setTexto(titulo); setEditando(true); }}>✎</button>}
            <Ayuda texto={ayuda} etiqueta={tipo} />
          </>
        )}
        <button type="button" className="epc-redondo" aria-label={`Subir la tarjeta ${numero}`} disabled={!alSubir} onClick={alSubir}>↑</button>
        <button type="button" className="epc-redondo" aria-label={`Bajar la tarjeta ${numero}`} disabled={!alBajar} onClick={alBajar}>↓</button>
        <Quitar etiqueta={etiquetaQuitar} alConfirmar={alQuitar} />
      </header>
      {falta && <p className="epc-error epc-falta" role="alert">{falta}</p>}
      {abierta && <div className="epc-tarjeta-cuerpo">{hijos}</div>}
    </section>
  );
}

const AYUDAS = {
  eleccion: 'El cliente escoge algunas cosas de una lista que tú armas. Por ejemplo «2 bebidas» o «2 donas o galletas». Puedes marcar categorías completas o productos sueltos.',
  fijo: 'Un producto que siempre viene incluido en el combo, sin que el cliente elija. Por ejemplo «1 papas nativas».',
  opcional: 'El cliente decide si la lleva o cuántas. Ej.: papas nativas: incluida 1, puede quitarla o pedir hasta 2 extra por S/ 6.00 cada una.',
  combinacion: 'El cliente escoge UNA combinación de las que armes. Por ejemplo «2 donas» o «1 carrot cake». Necesitas al menos dos combinaciones.',
};

export function EditorPartesCombo({ partes, onCambiar, productos, categorias, mostrarErrores }: Props) {
  const [agregando, setAgregando] = useState(false);
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set());
  const [opcionAbierta, setOpcionAbierta] = useState<string | null>(null);
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [textoNombre, setTextoNombre] = useState('');
  const [errorNombre, setErrorNombre] = useState('');
  const raiz = useRef<HTMLDivElement>(null);

  // Al intentar guardar con algo incompleto, el foco va a la primera tarjeta que falta
  useEffect(() => {
    if (!mostrarErrores) return;
    const cab = raiz.current?.querySelector<HTMLElement>('[data-incompleta="true"] .epc-tarjeta-titulo');
    cab?.focus();
    cab?.scrollIntoView?.({ block: 'center' });
  }, [mostrarErrores]);

  const poner = (sig: Parte[]) => onCambiar(retitular(sig, categorias, productos));
  const parche = (i: number, cambio: Partial<Parte>) => poner(partes.map((p, j) => (j === i ? { ...p, ...cambio } : p)));
  const bloques = bloquesDe(partes);

  const agregar = (que: 'ELECCION' | 'COMPLEMENTO' | 'FIJO' | 'OPCIONAL') => {
    setAgregando(false);
    if (que === 'ELECCION') poner([...partes, nuevaEleccion()]);
    else if (que === 'FIJO') poner([...partes, nuevoFijo()]);
    else if (que === 'OPCIONAL') poner([...partes, nuevoOpcional()]);
    else {
      const existentes = gruposDe(partes);
      let grupo = GRUPO_POR_DEFECTO;
      for (let n = 2; existentes.includes(grupo); n++) grupo = `${GRUPO_POR_DEFECTO} ${n}`;
      const nombre = nombreTemporal(partes, grupo);
      const nuevas = piezasDePlantilla('MISMA_CATEGORIA', grupo, nombre);
      poner([...partes, ...nuevas]);
      setOpcionAbierta(nuevas[0].uid!);
    }
  };

  /** Un ejemplo editable: 2 bebidas + 2 de donas o galletas (con las categorías que existan en la carta). */
  const cargarEjemplo = () => {
    const ids = (re: RegExp) => categorias.filter((c) => re.test(c.nombre)).map((c) => c.id);
    poner([
      { ...nuevaEleccion(2), categorias: ids(/^(frappes?|iced|calientes?|frozen|bebidas?)$/i) },
      { ...nuevaEleccion(2), categorias: ids(/^(donas?|galletas?)$/i) },
    ]);
  };

  const mover = (k: number, dir: -1 | 1) => {
    const sig = [...bloques];
    [sig[k], sig[k + dir]] = [sig[k + dir], sig[k]];
    setPlegadas(new Set());
    onCambiar(aplanar(partes, sig));
  };
  const quitarBloque = (k: number) => onCambiar(aplanar(partes, bloques.filter((_, j) => j !== k)));

  const alternar = (clave: string) => setPlegadas((s) => { const n = new Set(s); if (n.has(clave)) n.delete(clave); else n.add(clave); return n; });

  // ----- Lo que lleva una combinación: «Lleva: − 2 + de [selector]» -----
  const pieza = (i: number, unica: boolean) => {
    const p = partes[i];
    const prodId = idsProductos(p)[0];
    const prod = productos.find((x) => x.id === prodId);
    return (
      <li className="epc-pieza" key={p.uid ?? i}>
        <div className="epc-fila">
          <span className="epc-frase">Lleva:</span>
          <Cuantas valor={p.cantidad || 1} etiqueta="Cantidad que lleva" onCambio={(n) => parche(i, { cantidad: n })} />
          <span className="epc-frase">de:</span>
          {!unica && <Quitar etiqueta="Quitar esta cosa de la combinación" alConfirmar={() => { const resto = partes.filter((_, j) => j !== i); const hermana = resto.find((x) => (x.paqueteGrupo ?? '').trim() === (p.paqueteGrupo ?? '').trim() && x.paqueteNombre === p.paqueteNombre); if (opcionAbierta === p.uid && hermana?.uid) setOpcionAbierta(hermana.uid); poner(resto); }} />}
        </div>
        <Selector
          categorias={categorias} productos={productos} cats={p.categorias ?? []} prods={idsProductos(p)} etiqueta="esta combinación"
          onCambio={(c, pr) => poner(partes.map((x, j) => (j === i ? conSeleccion(x, c, pr, productos, true) : x)))}
        />
        <QueVera p={p} productos={productos} categorias={categorias} />
        {tipoDe(p) === 'FIJO' && (prod?.tamanos ?? []).length > 0 && (
          <label className="epc-etiqueta">Tamaño del producto
            <select aria-label="Tamaño del producto fijo" className="epc-select" value={p.tamanoId ?? ''} onChange={(e) => parche(i, { tamanoId: e.target.value || null })}>
              <option value="">Sin tamaño</option>
              {prod!.tamanos!.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </label>
        )}
        <Sabores disponibles={saboresDeLaParte(p, productos, categorias)} elegidos={p.saboresIds ?? []} onCambio={(ids) => parche(i, { saboresIds: ids })} />
      </li>
    );
  };

  // ----- Una combinación de «El cliente elige UNA combinación» -----
  const combinacion = (grupo: string, nombre: string, idxs: number[], numero: number) => {
    const clave = partes[idxs[0]].uid ?? `${grupo}|${nombre}`;
    const abierta = opcionAbierta === clave;
    const manual = !!partes[idxs[0]].nombreManual;
    const sinStock = idxs.some((i) => partes[i].disponible === false);
    const editando = renombrando === clave;
    const aplicarNombre = () => {
      const nuevo = textoNombre.trim();
      if (!nuevo) { setErrorNombre(''); setRenombrando(null); return; }
      if (opcionesDeGrupo(partes, grupo).some((o) => o.nombre === nuevo && o.nombre !== nombre)) {
        setErrorNombre('Ya hay otra combinación con ese nombre. Usa otro.');
        return;
      }
      setErrorNombre('');
      setRenombrando(null);
      poner(partes.map((p, j) => (idxs.includes(j) ? { ...p, paqueteNombre: nuevo, nombre: nuevo, nombreManual: true } : p)));
    };
    const automatico = () => {
      setRenombrando(null);
      poner(partes.map((p, j) => (idxs.includes(j) ? { ...p, nombreManual: false } : p)));
    };
    return (
      <li className="epc-opcion" data-testid="opcion-complemento" key={clave}>
        <div className="epc-opcion-cab">
          {editando ? (
            <span className="epc-fila">
              <input className="epc-buscar" aria-label="Título de la combinación" value={textoNombre} autoFocus onChange={(e) => setTextoNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && aplicarNombre()} />
              <button type="button" className="epc-chip on" onClick={aplicarNombre}>Listo</button>
              {manual && <button type="button" className="epc-chip" onClick={automatico}>Título automático</button>}
            </span>
          ) : (
            <>
              <button type="button" className="epc-opcion-titulo" aria-expanded={abierta} onClick={() => setOpcionAbierta(abierta ? null : clave)}>
                <span><span className="epc-etiqueta">Combinación {numero}</span><strong>{nombre}</strong></span>
                {sinStock && <span className="epc-aviso">Hoy no hay stock</span>}
                <span aria-hidden="true">{abierta ? '▲' : '▼'}</span>
              </button>
              <button type="button" className="epc-redondo" aria-label={`Cambiar el título de ${nombre}`} title="Cambiar el título (opcional)" onClick={() => { setRenombrando(clave); setTextoNombre(nombre); setErrorNombre(''); }}>✎</button>
              <Quitar etiqueta={`Quitar la combinación ${nombre}`} alConfirmar={() => poner(partes.filter((_, j) => !idxs.includes(j)))} />
            </>
          )}
        </div>
        {errorNombre && editando && <p className="epc-error" role="alert">{errorNombre}</p>}
        {abierta && (
          <div className="epc-opcion-cuerpo">
            <ul className="epc-piezas" aria-label={`Lo que lleva ${nombre}`}>
              {idxs.map((i) => pieza(i, idxs.length === 1))}
            </ul>
            <button
              type="button"
              className="epc-boton"
              onClick={() => {
                const sig = [...partes];
                sig.splice(idxs[idxs.length - 1] + 1, 0, piezaVacia(grupo, nombre, 'CATEGORIA'));
                poner(sig);
              }}
            >
              + Añadir otra cosa a esta combinación
            </button>
          </div>
        )}
      </li>
    );
  };

  const agregarCombinacion = (grupo: string, plantilla: PlantillaOpcion | null) => {
    const nombre = nombreTemporal(partes, grupo);
    const nuevas = piezasDePlantilla(plantilla ?? 'MISMA_CATEGORIA', grupo, nombre).map((p) => (plantilla ? p : { ...p, cantidad: 1 }));
    const sig = [...partes];
    // Las piezas nuevas van junto a las del complemento
    const ultimo = Math.max(...partes.map((p, j) => ((p.paqueteGrupo ?? '').trim() === grupo ? j : -1)));
    sig.splice(ultimo + 1, 0, ...nuevas);
    setOpcionAbierta(nuevas[0].uid!);
    poner(sig);
  };

  const PLANTILLAS: { id: PlantillaOpcion; texto: string }[] = [
    { id: 'MISMA_CATEGORIA', texto: '2 de lo mismo' },
    { id: 'DOS_CATEGORIAS', texto: '1 de cada una de 2 cosas' },
    { id: 'PRODUCTO_FIJO', texto: '1 solo producto' },
  ];

  /** Reemplazo de emergencia: escondido para no confundirlo con elegir productos normales. */
  const reemplazo = (i: number, principalId: string | undefined) => {
    const n = (partes[i].alternativas ?? []).length;
    return (
      <details className="epc-mas epc-reemplazo">
        <summary>Más opciones ▾{n > 0 ? ` (${n} reemplazo${n === 1 ? '' : 's'})` : ''}</summary>
        <AlternativasParte principalId={principalId} alternativas={partes[i].alternativas ?? []} productos={productos} onCambiar={(alts) => parche(i, { alternativas: alts })} />
      </details>
    );
  };

  return (
    <div className="epc" data-testid="editor-partes" ref={raiz}>
      <h3 className="epc-titulo">¿Qué lleva el combo?</h3>
      {partes.length === 0 && (
        <div className="epc-vacio">
          <p>Todavía no lleva nada. Toca «+ Agregar» y elige qué va a llevar.</p>
          <button type="button" className="epc-boton" onClick={cargarEjemplo}>Ver ejemplo: Dúo Compartir</button>
        </div>
      )}

      {bloques.map((b, k) => {
        const falta = mostrarErrores ? faltaEnBloque(partes, b, k + 1) : null;
        const comun = {
          numero: k + 1,
          falta,
          abierta: !plegadas.has(b.clave) || !!falta,
          onAbrir: () => alternar(b.clave),
          alSubir: k > 0 ? () => mover(k, -1) : undefined,
          alBajar: k < bloques.length - 1 ? () => mover(k, 1) : undefined,
          alQuitar: () => quitarBloque(k),
          testid: `bloque-${k}`,
        };
        if (b.tipo === 'COMPLEMENTO') {
          const opciones = opcionesDeGrupo(partes, b.grupo);
          return (
            <Tarjeta
              key={b.clave} {...comun} icono="🍩" titulo={`El cliente elige UNA: ${opciones.map((o) => o.nombre).join(' / ')}`} etiquetaQuitar={`Quitar la tarjeta ${k + 1}`}
              tipo={`${opciones.length} combinaci${opciones.length === 1 ? 'ón' : 'ones'} para elegir`} ayuda={AYUDAS.combinacion}
              hijos={(
                <>
                  <ul className="epc-opciones" aria-label={`Combinaciones de la tarjeta ${k + 1}`}>
                    {opciones.map((o, n) => combinacion(b.grupo, o.nombre, o.idxs, n + 1))}
                  </ul>
                  {opciones.length < 2 && <p className="epc-nota">Agrega al menos otra combinación para que el cliente pueda elegir.</p>}
                  <button type="button" className="epc-boton epc-grande" onClick={() => agregarCombinacion(b.grupo, null)}>+ Combinación</button>
                  <div className="epc-etiqueta">O empieza con una de estas:</div>
                  <div className="epc-chips">
                    {PLANTILLAS.map((t) => (
                      <button key={t.id} type="button" className="epc-chip" onClick={() => agregarCombinacion(b.grupo, t.id)}>{t.texto}</button>
                    ))}
                  </div>
                </>
              )}
            />
          );
        }
        const i = b.idxs[0];
        const p = partes[i];
        if (b.tipo === 'FIJO') {
          const prodId = idsProductos(p)[0];
          const prod = productos.find((x) => x.id === prodId);
          return (
            <Tarjeta
              key={b.clave} {...comun} icono="📌" titulo={`${p.opcional ? 'Opcional' : 'Siempre incluido'}: ${prod ? `${p.cantidad || 1} ${prod.nombre.toLowerCase()}` : 'falta elegir el producto'}`} etiquetaQuitar={`Quitar la tarjeta ${k + 1}`}
              tipo={p.opcional ? 'Opcional' : 'Siempre incluido'} ayuda={p.opcional ? AYUDAS.opcional : AYUDAS.fijo}
              hijos={(
                <>
                  <div className="epc-fila"><span className="epc-etiqueta">{p.opcional ? 'Incluidas en el precio' : '¿Cuántos lleva?'}</span><Cuantas valor={p.cantidad || 1} etiqueta="Cantidad del producto fijo" onCambio={(n) => parche(i, { cantidad: n })} /></div>
                  <label className="epc-etiqueta epc-fila">
                    <input type="checkbox" checked={!!p.opcional} onChange={(e) => parche(i, e.target.checked ? { opcional: true, cantidadMin: 0, cantidadMax: null, incluidaPorDefecto: true, precioExtra: null } : { opcional: false, cantidadMin: 0, cantidadMax: null, incluidaPorDefecto: true, precioExtra: null })} />
                    El cliente puede quitarla (opcional)
                  </label>
                  {p.opcional && (
                    <div className="epc-fila" style={{ flexWrap: 'wrap', gap: 12 }}>
                      <label className="epc-etiqueta">Máximo que puede llevar
                        <input type="number" min={1} step={1} className="epc-select" aria-label="Máximo que puede llevar" value={p.cantidadMax ?? p.cantidad ?? 1} onChange={(e) => parche(i, { cantidadMax: e.target.value === '' ? null : Math.floor(Number(e.target.value)) })} />
                      </label>
                      <label className="epc-etiqueta">Precio por cada extra: S/
                        <input type="number" min={0} step="0.01" className="epc-select" aria-label="Precio por cada extra" placeholder="sin cobro" value={p.precioExtra ?? ''} onChange={(e) => parche(i, { precioExtra: e.target.value === '' ? null : Number(e.target.value) })} />
                      </label>
                      <label className="epc-etiqueta epc-fila">
                        <input type="checkbox" checked={p.incluidaPorDefecto !== false} onChange={(e) => parche(i, { incluidaPorDefecto: e.target.checked })} />
                        Aparece marcada por defecto
                      </label>
                    </div>
                  )}
                  <div className="epc-etiqueta">{prod ? `Producto: ${prod.nombre}` : '¿Qué producto es? Siempre viene incluido.'}</div>
                  <ListaProductos
                    productos={productos} marcados={prodId ? [prodId] : []} unico etiqueta="Productos del catálogo" vacio="Todavía no hay productos en la carta."
                    onCambio={(ids) => parche(i, { productos: ids, tamanoId: null, alternativas: (p.alternativas ?? []).filter((a) => String(a.id) !== ids[0]) })}
                  />
                  {(prod?.tamanos ?? []).length > 0 && (
                    <label className="epc-etiqueta">Tamaño del producto
                      <select aria-label="Tamaño del producto fijo" className="epc-select" value={p.tamanoId ?? ''} onChange={(e) => parche(i, { tamanoId: e.target.value || null })}>
                        <option value="">Sin tamaño</option>
                        {prod!.tamanos!.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                      </select>
                    </label>
                  )}
                  {reemplazo(i, prodId)}
                </>
              )}
            />
          );
        }
        // El cliente elige entre varias cosas
        const delasCategorias = productos.filter((x) => categorias.some((c) => (p.categorias ?? []).includes(c.id) && perteneceACategoria(x, c)));
        const hayLista = idsProductos(p).length > 0;
        return (
          <Tarjeta
            key={b.clave} {...comun} icono="🥤" titulo={nombreDeBloque(p, categorias, productos)} etiquetaQuitar={`Quitar la tarjeta ${k + 1}`}
            tipo="El cliente elige entre varias cosas" ayuda={AYUDAS.eleccion}
            manual={!!p.nombreManual}
            alTitular={(nuevo) => (nuevo ? parche(i, { nombre: nuevo, nombreManual: true }) : parche(i, { nombreManual: false }))}
            hijos={(
              <>
                <div className="epc-fila"><span className="epc-frase">El cliente elige</span><Cuantas valor={p.cantidad || 1} etiqueta="Cantidad a elegir" onCambio={(n) => parche(i, { cantidad: n })} /><span className="epc-frase">de:</span></div>
                <Selector categorias={categorias} productos={productos} cats={p.categorias ?? []} prods={idsProductos(p)} etiqueta="esta tarjeta" onCambio={(c, pr) => poner(partes.map((x, j) => (j === i ? conSeleccion(x, c, pr, productos) : x)))} />
                <QueVera p={p} productos={productos} categorias={categorias} />
                {!hayLista && (p.categorias ?? []).length > 0 && (
                  <details className="epc-mas" open={(p.productosExcluidos ?? []).length > 0}>
                    <summary className="epc-enlace">Excluir alguno (ej. sin Frozen)</summary>
                    <p className="epc-nota">Los productos que marques aquí no se podrán elegir, aunque su categoría sí.</p>
                    <ListaProductos productos={delasCategorias} marcados={p.productosExcluidos ?? []} etiqueta="Productos a excluir" vacio="Primero elige una categoría." onCambio={(ids) => parche(i, { productosExcluidos: ids, saboresIds: [] })} />
                  </details>
                )}
                <Sabores disponibles={saboresDeLaParte(p, productos, categorias)} elegidos={p.saboresIds ?? []} onCambio={(ids) => parche(i, { saboresIds: ids })} />
                {reemplazo(i, undefined)}
              </>
            )}
          />
        );
      })}

      {agregando ? (
        <div className="epc-agregar" role="group" aria-label="¿Qué quieres agregar?">
          <button type="button" className="epc-tipo" aria-label="El cliente elige entre varias cosas" onClick={() => agregar('ELECCION')}>
            <span className="epc-icono" aria-hidden="true">🥤</span><strong>El cliente elige entre varias cosas</strong><small>Ej.: «2 bebidas» o «2 donas o galletas»</small>
          </button>
          <button type="button" className="epc-tipo" aria-label="Siempre incluido" onClick={() => agregar('FIJO')}>
            <span className="epc-icono" aria-hidden="true">📌</span><strong>Siempre incluido</strong><small>Ej.: «1 papas nativas», viene sin elegir</small>
          </button>
          <button type="button" className="epc-tipo" aria-label="Opcional" onClick={() => agregar('OPCIONAL')}>
            <span className="epc-icono" aria-hidden="true">➕</span><strong>Opcional</strong><small>Ej.: papas: las quita o pide extra</small>
          </button>
          <button type="button" className="epc-tipo" aria-label="El cliente elige UNA combinación" onClick={() => agregar('COMPLEMENTO')}>
            <span className="epc-icono" aria-hidden="true">🍩</span><strong>El cliente elige UNA combinación</strong><small>Ej.: «2 donas» o «1 carrot cake»</small>
          </button>
          <button type="button" className="epc-chip" onClick={() => setAgregando(false)}>Cancelar</button>
        </div>
      ) : (
        <button type="button" className="epc-boton epc-grande" onClick={() => setAgregando(true)}>+ Agregar</button>
      )}
    </div>
  );
}

const ICONOS = { bebida: '🥤', complemento: '🍩', fijo: '📌' } as const;

/** Resumen en palabras simples de lo que verá el cliente, numerado, con avisos de lo incompleto o sin stock hoy. */
export function ResumenPartesCombo({ partes, productos, categorias }: Omit<Props, 'onCambiar' | 'mostrarErrores'>) {
  const lineas = resumenParaCliente(partes, categorias, productos);
  if (lineas.length === 0) return <p className="epc-nota">Todavía no lleva nada.</p>;
  return (
    <div className="epc-resumen" data-testid="resumen-partes">
      {lineas.map((l, k) => (
        <div key={l.clave} className="epc-resumen-linea">
          <span className="epc-icono" aria-hidden="true">{ICONOS[l.icono]}</span>
          <div>
            <strong>{k + 1}) {l.titulo}</strong>
            {l.avisos.map((a) => <span key={a} className="epc-aviso" style={{ marginLeft: 8 }}>{a}</span>)}
            {l.opciones.length > 0 && (
              <ul>
                {l.opciones.map((o) => (
                  <li key={o.texto}>{o.texto}{o.avisos.map((a) => <span key={a} className="epc-aviso" style={{ marginLeft: 8 }}>{a}</span>)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

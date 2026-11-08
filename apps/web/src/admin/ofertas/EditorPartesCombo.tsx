import { useState } from 'react';
import { AlternativasParte } from './AlternativasParte';
import {
  CategoriaEditor, Parte, ProductoEditor, GRUPO_POR_DEFECTO, PlantillaOpcion, aplanar, bloquesDe, conProductoUnico, gruposDe, idsProductos,
  nombreDeBloque, nombreTemporal, nuevaEleccion, nuevoFijo, opcionesDeGrupo, perteneceACategoria, piezaVacia, piezasDePlantilla,
  productosDeLaParte, resumenParaCliente, retitular, saboresDeLaParte, tipoDe,
} from './partesComboModelo';
import './editor-partes-combo.css';

interface Props {
  partes: Parte[];
  onCambiar: (partes: Parte[]) => void;
  productos: ProductoEditor[];
  categorias: CategoriaEditor[];
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

function ChipsCategorias({ categorias, elegidas, onCambio, unica, etiqueta }: {
  categorias: CategoriaEditor[]; elegidas: string[]; onCambio: (ids: string[]) => void; unica?: boolean; etiqueta: string;
}) {
  return (
    <div className="epc-chips" role="group" aria-label={etiqueta}>
      {categorias.map((c) => {
        const activa = elegidas.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            className={`epc-chip${activa ? ' on' : ''}`}
            aria-pressed={activa}
            onClick={() => onCambio(unica ? (activa ? [] : [c.id]) : activa ? elegidas.filter((x) => x !== c.id) : [...elegidas, c.id])}
          >
            {activa ? '✓ ' : ''}{c.nombre}
          </button>
        );
      })}
    </div>
  );
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

/** Sabores: Todos, o Elegir específicos (chips que se apagan y se encienden; vacío guardado = todos). */
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
      <div className="epc-etiqueta">Sabores</div>
      <div className="epc-segmentos">
        <button type="button" className={`epc-chip${!especificos ? ' on' : ''}`} aria-pressed={!especificos} onClick={() => { setForzar(false); onCambio([]); }}>Todos los sabores</button>
        <button type="button" className={`epc-chip${especificos ? ' on' : ''}`} aria-pressed={especificos} onClick={() => { setForzar(true); onCambio([]); }}>Elegir específicos</button>
      </div>
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

function Tarjeta({ icono, titulo, resumen, abierta, onAbrir, alSubir, alBajar, alQuitar, etiquetaQuitar, hijos, testid }: {
  icono: string; titulo: string; resumen: string; abierta: boolean; onAbrir: () => void; alSubir?: () => void; alBajar?: () => void;
  alQuitar: () => void; etiquetaQuitar: string; hijos: React.ReactNode; testid: string;
}) {
  return (
    <section className="epc-tarjeta" data-testid={testid}>
      <header className="epc-tarjeta-cab">
        <button type="button" className="epc-tarjeta-titulo" aria-expanded={abierta} onClick={onAbrir}>
          <span className="epc-icono" aria-hidden="true">{icono}</span>
          <span>
            <strong>{titulo}</strong>
            <small>{resumen}</small>
          </span>
          <span aria-hidden="true">{abierta ? '▲' : '▼'}</span>
        </button>
        <button type="button" className="epc-redondo" aria-label={`Subir ${titulo}`} disabled={!alSubir} onClick={alSubir}>↑</button>
        <button type="button" className="epc-redondo" aria-label={`Bajar ${titulo}`} disabled={!alBajar} onClick={alBajar}>↓</button>
        <Quitar etiqueta={etiquetaQuitar} alConfirmar={alQuitar} />
      </header>
      {abierta && <div className="epc-tarjeta-cuerpo">{hijos}</div>}
    </section>
  );
}

export function EditorPartesCombo({ partes, onCambiar, productos, categorias }: Props) {
  const [agregando, setAgregando] = useState(false);
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set());
  const [opcionAbierta, setOpcionAbierta] = useState<string | null>(null);
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [textoNombre, setTextoNombre] = useState('');
  const [errorNombre, setErrorNombre] = useState('');
  const [piezaNueva, setPiezaNueva] = useState<string | null>(null);

  const poner = (sig: Parte[]) => onCambiar(retitular(sig, categorias, productos));
  const parche = (i: number, cambio: Partial<Parte>) => poner(partes.map((p, j) => (j === i ? { ...p, ...cambio } : p)));
  const bloques = bloquesDe(partes);

  const agregar = (que: 'ELECCION' | 'COMPLEMENTO' | 'FIJO') => {
    setAgregando(false);
    if (que === 'ELECCION') poner([...partes, nuevaEleccion()]);
    else if (que === 'FIJO') poner([...partes, nuevoFijo()]);
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

  const mover = (k: number, dir: -1 | 1) => {
    const sig = [...bloques];
    [sig[k], sig[k + dir]] = [sig[k + dir], sig[k]];
    setPlegadas(new Set());
    onCambiar(aplanar(partes, sig));
  };
  const quitarBloque = (k: number) => onCambiar(aplanar(partes, bloques.filter((_, j) => j !== k)));

  const alternar = (clave: string) => setPlegadas((s) => { const n = new Set(s); if (n.has(clave)) n.delete(clave); else n.add(clave); return n; });

  // ----- Pieza de un complemento -----
  const pieza = (i: number, unica: boolean) => {
    const p = partes[i];
    const esProducto = p.pieza === 'PRODUCTO';
    const prodId = idsProductos(p)[0];
    const prod = productos.find((x) => x.id === prodId);
    const delasCategorias = productos.filter((x) => categorias.some((c) => (p.categorias ?? []).includes(c.id) && perteneceACategoria(x, c)));
    const sabores = saboresDeLaParte(p, productos, categorias);
    const cambiarTipo = (t: 'CATEGORIA' | 'PRODUCTO') => {
      if (t === p.pieza) return;
      parche(i, { pieza: t, categorias: [], productos: [], tipoParte: 'A_ELECCION', tamanoId: null, saboresIds: [], productosExcluidos: [] });
    };
    return (
      <li className="epc-pieza" key={p.uid ?? i}>
        <div className="epc-fila">
          <Cuantas valor={p.cantidad || 1} etiqueta="Cantidad de esta pieza" onCambio={(n) => parche(i, { cantidad: n })} />
          <div className="epc-segmentos" role="group" aria-label="Tipo de pieza">
            <button type="button" className={`epc-chip${!esProducto ? ' on' : ''}`} aria-pressed={!esProducto} onClick={() => cambiarTipo('CATEGORIA')}>De una categoría</button>
            <button type="button" className={`epc-chip${esProducto ? ' on' : ''}`} aria-pressed={esProducto} onClick={() => cambiarTipo('PRODUCTO')}>Un producto</button>
          </div>
          {!unica && <Quitar etiqueta="Quitar esta pieza" alConfirmar={() => { const resto = partes.filter((_, j) => j !== i); const hermana = resto.find((x) => (x.paqueteGrupo ?? '').trim() === (p.paqueteGrupo ?? '').trim() && x.paqueteNombre === p.paqueteNombre); if (opcionAbierta === p.uid && hermana?.uid) setOpcionAbierta(hermana.uid); poner(resto); }} />}
        </div>
        {esProducto ? (
          <>
            <div className="epc-etiqueta">{prod ? `Producto: ${prod.nombre}` : '¿Qué producto es?'}</div>
            <ListaProductos
              productos={productos} marcados={prodId ? [prodId] : []} unico etiqueta="Productos de la pieza" vacio="Todavía no hay productos en la carta."
              onCambio={(ids) => poner(partes.map((x, j) => (j === i ? conProductoUnico(x, productos.find((y) => y.id === ids[0])) : x)))}
            />
            {tipoDe(p) === 'FIJO' && (prod?.tamanos ?? []).length > 0 && (
              <label className="epc-etiqueta">Tamaño del producto
                <select aria-label="Tamaño del producto fijo" className="epc-select" value={p.tamanoId ?? ''} onChange={(e) => parche(i, { tamanoId: e.target.value || null })}>
                  <option value="">Sin tamaño</option>
                  {prod!.tamanos!.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </label>
            )}
          </>
        ) : (
          <>
            <div className="epc-etiqueta">¿De qué categoría?</div>
            <ChipsCategorias categorias={categorias} elegidas={p.categorias ?? []} unica etiqueta="Categoría de la pieza" onCambio={(ids) => parche(i, { categorias: ids, productos: [], productosExcluidos: [], saboresIds: [] })} />
            <details className="epc-mas" open={idsProductos(p).length > 0}>
              <summary>Solo algunos productos (opcional)</summary>
              <p className="epc-nota">Si marcas productos, el cliente podrá elegir solo esos.</p>
              <ListaProductos
                productos={delasCategorias} marcados={idsProductos(p)} etiqueta="Productos concretos" vacio="Primero elige la categoría."
                onCambio={(ids) => parche(i, { productos: ids, saboresIds: [] })}
              />
            </details>
          </>
        )}
        <Sabores disponibles={sabores} elegidos={p.saboresIds ?? []} onCambio={(ids) => parche(i, { saboresIds: ids })} />
      </li>
    );
  };

  // ----- Opción de un complemento -----
  const opcion = (grupo: string, nombre: string, idxs: number[]) => {
    const clave = partes[idxs[0]].uid ?? `${grupo}|${nombre}`;
    const abierta = opcionAbierta === clave;
    const manual = !!partes[idxs[0]].nombreManual;
    const sinStock = idxs.some((i) => partes[i].disponible === false);
    const editando = renombrando === clave;
    const aplicarNombre = () => {
      const nuevo = textoNombre.trim();
      if (!nuevo) { setErrorNombre(''); setRenombrando(null); return; }
      if (opcionesDeGrupo(partes, grupo).some((o) => o.nombre === nuevo && o.nombre !== nombre)) {
        setErrorNombre('Ya hay otra opción con ese nombre. Usa otro.');
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
              <input className="epc-buscar" aria-label="Nombre de la opción" value={textoNombre} autoFocus onChange={(e) => setTextoNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && aplicarNombre()} />
              <button type="button" className="epc-chip on" onClick={aplicarNombre}>Listo</button>
              {manual && <button type="button" className="epc-chip" onClick={automatico}>Nombre automático</button>}
            </span>
          ) : (
            <>
              <button type="button" className="epc-opcion-titulo" aria-expanded={abierta} onClick={() => setOpcionAbierta(abierta ? null : clave)}>
                <strong>{nombre}</strong>
                {sinStock && <span className="epc-aviso">Hoy no hay stock</span>}
                <span aria-hidden="true">{abierta ? '▲' : '▼'}</span>
              </button>
              <button type="button" className="epc-redondo" aria-label={`Cambiar el nombre de ${nombre}`} title="Cambiar el nombre (opcional)" onClick={() => { setRenombrando(clave); setTextoNombre(nombre); setErrorNombre(''); }}>✎</button>
              <Quitar etiqueta={`Quitar la opción ${nombre}`} alConfirmar={() => poner(partes.filter((_, j) => !idxs.includes(j)))} />
            </>
          )}
        </div>
        {errorNombre && editando && <p className="epc-error" role="alert">{errorNombre}</p>}
        {abierta && (
          <div className="epc-opcion-cuerpo">
            <ul className="epc-piezas" aria-label={`Piezas de ${nombre}`}>
              {idxs.map((i) => pieza(i, idxs.length === 1))}
            </ul>
            {piezaNueva === clave ? (
              <div className="epc-fila" role="group" aria-label="Tipo de pieza nueva">
                {(['CATEGORIA', 'PRODUCTO'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="epc-boton"
                    onClick={() => {
                      setPiezaNueva(null);
                      const ultimo = idxs[idxs.length - 1];
                      const sig = [...partes];
                      sig.splice(ultimo + 1, 0, piezaVacia(grupo, nombre, t));
                      poner(sig);
                    }}
                  >
                    {t === 'CATEGORIA' ? 'De una categoría' : 'Un producto'}
                  </button>
                ))}
                <button type="button" className="epc-chip" onClick={() => setPiezaNueva(null)}>Cancelar</button>
              </div>
            ) : (
              <button type="button" className="epc-boton" onClick={() => setPiezaNueva(clave)}>+ Pieza</button>
            )}
          </div>
        )}
      </li>
    );
  };

  const agregarOpcion = (grupo: string, plantilla: PlantillaOpcion | null) => {
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
    { id: 'MISMA_CATEGORIA', texto: '2 de la misma categoría' },
    { id: 'DOS_CATEGORIAS', texto: '1 + 1 de dos categorías' },
    { id: 'PRODUCTO_FIJO', texto: '1 producto fijo' },
  ];

  return (
    <div className="epc" data-testid="editor-partes">
      <h3 className="epc-titulo">¿Qué lleva el combo?</h3>
      {partes.length === 0 && (
        <div className="epc-vacio">Todavía no lleva nada. Toca «+ Agregar» y elige qué va a llevar.</div>
      )}

      {bloques.map((b, k) => {
        const comun = {
          abierta: !plegadas.has(b.clave),
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
              key={b.clave} {...comun} icono="🍩" titulo={b.grupo} etiquetaQuitar={`Quitar el complemento ${b.grupo}`}
              resumen={`El cliente elige UNA de ${opciones.length} opciones`}
              hijos={(
                <>
                  <ul className="epc-opciones" aria-label={`Opciones de ${b.grupo}`}>
                    {opciones.map((o) => opcion(b.grupo, o.nombre, o.idxs))}
                  </ul>
                  <div className="epc-etiqueta">Plantillas rápidas</div>
                  <div className="epc-chips">
                    {PLANTILLAS.map((t) => (
                      <button key={t.id} type="button" className="epc-chip" onClick={() => agregarOpcion(b.grupo, t.id)}>{t.texto}</button>
                    ))}
                  </div>
                  <button type="button" className="epc-boton" onClick={() => agregarOpcion(b.grupo, null)}>+ Agregar opción</button>
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
              key={b.clave} {...comun} icono="📌" titulo="Producto fijo" etiquetaQuitar="Quitar el producto fijo"
              resumen={prod ? `${p.cantidad || 1} × ${prod.nombre}` : 'Falta elegir el producto'}
              hijos={(
                <>
                  <div className="epc-fila"><span className="epc-etiqueta">¿Cuántos?</span><Cuantas valor={p.cantidad || 1} etiqueta="Cantidad del producto fijo" onCambio={(n) => parche(i, { cantidad: n })} /></div>
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
                  <AlternativasParte principalId={prodId ?? ''} alternativas={p.alternativas ?? []} productos={productos} onCambiar={(alts) => parche(i, { alternativas: alts })} />
                </>
              )}
            />
          );
        }
        // A elección (bebidas u otra)
        const delasCategorias = productos.filter((x) => categorias.some((c) => (p.categorias ?? []).includes(c.id) && perteneceACategoria(x, c)));
        const hayLista = idsProductos(p).length > 0;
        const nombres = (p.categorias ?? []).map((id) => categorias.find((c) => c.id === id)?.nombre).filter(Boolean);
        return (
          <Tarjeta
            key={b.clave} {...comun} icono="🥤" titulo={nombreDeBloque(p, categorias)} etiquetaQuitar="Quitar las bebidas"
            resumen={`Elige ${p.cantidad || 1}${nombres.length ? ` · ${nombres.join(', ')}` : hayLista ? ` · ${productosDeLaParte(p, productos, categorias).length} productos` : ' · falta elegir categorías'}`}
            hijos={(
              <>
                <div className="epc-fila"><span className="epc-etiqueta">¿Cuántas elige el cliente?</span><Cuantas valor={p.cantidad || 1} etiqueta="Cantidad a elegir" onCambio={(n) => parche(i, { cantidad: n })} /></div>
                <div className="epc-etiqueta">¿De qué categorías?</div>
                <ChipsCategorias categorias={categorias} elegidas={p.categorias ?? []} etiqueta="Categorías de la elección" onCambio={(ids) => parche(i, { categorias: ids, saboresIds: [] })} />
                <details className="epc-mas" open={hayLista}>
                  <summary>Solo algunos productos (opcional)</summary>
                  <p className="epc-nota">Si marcas productos, el cliente podrá elegir solo esos.</p>
                  <ListaProductos productos={delasCategorias.length ? delasCategorias : productos} marcados={idsProductos(p)} etiqueta="Productos concretos" vacio="Todavía no hay productos." onCambio={(ids) => parche(i, { productos: ids, saboresIds: [] })} />
                </details>
                {!hayLista && (
                  <details className="epc-mas" open={(p.productosExcluidos ?? []).length > 0}>
                    <summary>Quitar productos (opcional)</summary>
                    <p className="epc-nota">Los productos que marques aquí no se podrán elegir, aunque su categoría sí.</p>
                    <ListaProductos productos={delasCategorias} marcados={p.productosExcluidos ?? []} etiqueta="Productos a quitar" vacio="Primero elige las categorías." onCambio={(ids) => parche(i, { productosExcluidos: ids, saboresIds: [] })} />
                  </details>
                )}
                <Sabores disponibles={saboresDeLaParte(p, productos, categorias)} elegidos={p.saboresIds ?? []} onCambio={(ids) => parche(i, { saboresIds: ids })} />
                <AlternativasParte alternativas={p.alternativas ?? []} productos={productos} onCambiar={(alts) => parche(i, { alternativas: alts })} />
              </>
            )}
          />
        );
      })}

      {agregando ? (
        <div className="epc-agregar" role="group" aria-label="¿Qué quieres agregar?">
          <button type="button" className="epc-tipo" aria-label="Agregar bebidas" onClick={() => agregar('ELECCION')}>
            <span className="epc-icono" aria-hidden="true">🥤</span><strong>Bebidas</strong><small>El cliente elige bebidas de las categorías que marques</small>
          </button>
          <button type="button" className="epc-tipo" aria-label="Agregar complemento a elegir" onClick={() => agregar('COMPLEMENTO')}>
            <span className="epc-icono" aria-hidden="true">🍩</span><strong>Complemento a elegir</strong><small>El cliente elige UNA opción: 2 donas, 1 carrot cake…</small>
          </button>
          <button type="button" className="epc-tipo" aria-label="Agregar producto fijo" onClick={() => agregar('FIJO')}>
            <span className="epc-icono" aria-hidden="true">📌</span><strong>Producto fijo</strong><small>Un producto que siempre viene incluido</small>
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

/** Resumen en palabras simples de lo que verá el cliente, con avisos de lo incompleto o sin stock hoy. */
export function ResumenPartesCombo({ partes, productos, categorias }: Omit<Props, 'onCambiar'>) {
  const lineas = resumenParaCliente(partes, categorias, productos);
  if (lineas.length === 0) return <p className="epc-nota">Todavía no lleva nada.</p>;
  return (
    <div className="epc-resumen" data-testid="resumen-partes">
      {lineas.map((l) => (
        <div key={l.clave} className="epc-resumen-linea">
          <span className="epc-icono" aria-hidden="true">{ICONOS[l.icono]}</span>
          <div>
            <strong>{l.titulo}</strong>
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

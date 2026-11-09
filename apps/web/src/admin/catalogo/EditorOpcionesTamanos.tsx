import { BotonVistaPrevia } from './VistaPreviaProducto';
import type { BorradorProducto } from './aProductoCarta';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { ModalConPestanas, Pestanas, PestanaModal } from '../../comun/ModalConPestanas';
import {
  catalogoApi,
  GrupoOpcionItem,
  ListaAdmin,
  ProductoAdmin,
  ValorListaAdmin,
} from './catalogoApi';
import {
  ESTADO_VACIO,
  EstadoOpciones,
  GrupoEstado,
  TamanoEstado,
  estadoDesdeProducto,
  validarTamanos,
} from './editorOpcionesTipos';
import './editor-opciones.css';
import { EnlacesStockOpciones } from './EnlacesStockOpciones';
import { GrupoCard, NuevoGrupo } from './GruposPregunta';
import { Tip } from './ayudaOpciones';
import { VistaCliente } from './VistaClienteOpciones';
import { OrdenPreguntas } from './OrdenPreguntas';
import { VistaPreviaEnVivo } from './VistaPreviaEnVivo';

export type { EstadoOpciones, GrupoEstado, TamanoEstado } from './editorOpcionesTipos';

/**
 * Editor de «Tamaños y opciones» de un producto.
 *
 * Modo `guardado`: edita un producto que ya existe (`producto`). Al tocar «Guardar cambios»
 * pide confirmación Sí/No y guarda con catalogoApi.editarProducto; luego llama `alGuardar`.
 *
 * Modo `borrador`: para un producto que aún no existe. Es CONTROLADO: recibe `valor` y emite
 * cada cambio por `onChange`; no guarda nada del producto (quien lo contiene manda
 * `tamanos` y `grupos` a catalogoApi.crearProducto: tamanos -> {tamanoValorId, precio, activo},
 * grupos -> {grupoId, orden: índice}). El orden del arreglo es el orden elegido.
 * Nota: crear un tamaño, grupo u opción nuevo, o renombrar un tamaño, SÍ escribe en el
 * catálogo general (son listas compartidas por todos los productos), en ambos modos.
 */
export interface EditorOpcionesTamanosProps {
  modo: 'guardado' | 'borrador';
  /** Obligatorio en modo guardado. */
  producto?: ProductoAdmin;
  /** Modo borrador: estado actual (controlado). */
  valor?: EstadoOpciones;
  /** Modo borrador: se llama con el estado nuevo ante cualquier cambio. */
  onChange?: (nuevo: EstadoOpciones) => void;
  /** Precio con el que nace un tamaño recién agregado (ej. el precio base del producto). */
  precioBase?: number;
  /** false = solo lectura. Por defecto true. */
  puedeEditar?: boolean;
  /** Modo guardado: se llama tras guardar con éxito. */
  alGuardar?: () => void;
  /** Modo guardado: se llama al tocar «Cancelar». Si no se pasa, no se muestra el botón. */
  alCancelar?: () => void;
  /** Datos del producto para la vista previa (nombre, precio…). En modo guardado se toma de `producto`. Sin ellos no hay botón. */
  borradorBase?: BorradorProducto;
}



export function EditorOpcionesTamanos({
  modo, producto, valor, onChange, precioBase = 0, puedeEditar = true, alGuardar, alCancelar, borradorBase,
}: EditorOpcionesTamanosProps) {
  const [local, setLocal] = useState<EstadoOpciones>(() => (producto ? estadoDesdeProducto(producto) : ESTADO_VACIO));
  const estado: EstadoOpciones = modo === 'borrador' ? valor ?? ESTADO_VACIO : local;
  const setEstado = (e: EstadoOpciones) => (modo === 'borrador' ? onChange?.(e) : setLocal(e));

  const [listas, setListas] = useState<ListaAdmin[]>([]);
  const [grupos, setGrupos] = useState<GrupoOpcionItem[]>([]);
  const [errorCarga, setErrorCarga] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmarGuardar, setConfirmarGuardar] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [elegido, setElegido] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [quitando, setQuitando] = useState<string | null>(null);
  const [ayudaAbierta, setAyudaAbierta] = useState<string | null>(null);
  const [ayudaGeneral, setAyudaGeneral] = useState(false);
  const [confirmarSalir, setConfirmarSalir] = useState(false);
  const [crearGrupoAbierto, setCrearGrupoAbierto] = useState(false);
  const [buscarGrupo, setBuscarGrupo] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState<'aqui' | 'no' | 'todos'>('todos');
  const inicial = useRef(JSON.stringify(producto ? estadoDesdeProducto(producto) : ESTADO_VACIO));
  const ordenInicial = useRef<string[]>((modo === 'borrador' ? valor ?? ESTADO_VACIO : producto ? estadoDesdeProducto(producto) : ESTADO_VACIO).grupos.map((g) => g.grupoId));
  const [movidoId, setMovidoId] = useState<string | null>(null);
  const [verVista, setVerVista] = useState(false);
  const [renombrando, setRenombrando] = useState<{ id: string; texto: string } | null>(null);
  const [confirmarRenombre, setConfirmarRenombre] = useState(false);

  const recargar = async () => {
    try {
      const [l, g] = await Promise.all([catalogoApi.listarListas(), catalogoApi.listarGrupos()]);
      setListas(l);
      setGrupos(g);
      setErrorCarga('');
    } catch (e: any) {
      setErrorCarga(e?.message || 'No se pudieron cargar las listas');
    }
  };
  useEffect(() => { recargar(); }, []);

  const listaTamano = listas.find((l) => l.codigo === 'TAMANO');
  const disponibles: ValorListaAdmin[] = useMemo(
    () => (listaTamano?.valores || []).filter((v) => v.activo && !estado.tamanos.some((t) => t.tamanoValorId === v.id)),
    [listaTamano, estado.tamanos],
  );

  const bloqueado = !puedeEditar;
  const setTamanos = (tamanos: TamanoEstado[]) => setEstado({ ...estado, tamanos });
  const setTam = (i: number, c: Partial<TamanoEstado>) => setTamanos(estado.tamanos.map((t, k) => (k === i ? { ...t, ...c } : t)));
  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= estado.tamanos.length) return;
    const c = [...estado.tamanos];
    [c[i], c[j]] = [c[j], c[i]];
    setTamanos(c);
  };
  const agregarTamano = (v: { id: string; nombre: string }) => {
    setTamanos([...estado.tamanos, { tamanoValorId: v.id, nombre: v.nombre, precio: precioBase, activo: true, unidades: 1 }]);
    setElegido(''); setNuevoNombre(''); setAgregando(false); setError('');
  };

  const crearTamano = async () => {
    const n = nuevoNombre.trim();
    if (!n) return setError('Escribe el nombre del tamaño nuevo.');
    if (estado.tamanos.some((t) => t.nombre.trim().toLowerCase() === n.toLowerCase())) {
      return setError(`El tamaño «${n}» ya está en este producto.`);
    }
    if (!listaTamano) return setError('No se encontró la lista de tamaños.');
    try {
      const v = await catalogoApi.agregarValor(listaTamano.id, { nombre: n });
      await recargar();
      agregarTamano({ id: v.id, nombre: v.nombre });
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear el tamaño');
    }
  };

  const pedirRenombre = () => {
    if (!renombrando) return;
    const n = renombrando.texto.trim();
    if (!n) return setError('Escribe el nuevo nombre del tamaño.');
    if (estado.tamanos.some((t) => t.tamanoValorId !== renombrando.id && t.nombre.trim().toLowerCase() === n.toLowerCase())) {
      return setError(`El tamaño «${n}» ya está en este producto.`);
    }
    setError('');
    setConfirmarRenombre(true);
  };
  const renombrar = async () => {
    setConfirmarRenombre(false);
    if (!renombrando) return;
    try {
      const n = renombrando.texto.trim();
      await catalogoApi.actualizarValor(renombrando.id, { nombre: n });
      setEstado({ ...estado, tamanos: estado.tamanos.map((t) => (t.tamanoValorId === renombrando.id ? { ...t, nombre: n } : t)) });
      setRenombrando(null);
      await recargar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo renombrar el tamaño');
    }
  };

  const moverGrupo = (desde: number, hasta: number) => {
    const c = [...estado.grupos];
    const [x] = c.splice(desde, 1);
    c.splice(hasta, 0, x);
    setEstado({ ...estado, grupos: c });
    setMovidoId(x.grupoId);
  };
  useEffect(() => {
    if (!movidoId) return;
    const t = setTimeout(() => setMovidoId(null), 1600);
    return () => clearTimeout(t);
  }, [movidoId]);
  // «Restablecer»: vuelve al orden con que se abrió el editor; las preguntas nuevas van al final
  const segunInicial = (gs: GrupoEstado[]) => {
    const rango = (id: string) => { const k = ordenInicial.current.indexOf(id); return k < 0 ? 1e6 : k; };
    return [...gs].sort((x, y) => rango(x.grupoId) - rango(y.grupoId));
  };
  const restablecerOrden = () => { setEstado({ ...estado, grupos: segunInicial(estado.grupos) }); setMovidoId(null); };
  const ordenCambiado = segunInicial(estado.grupos).some((g, i) => g.grupoId !== estado.grupos[i].grupoId);

  const toggleGrupo = (g: GrupoOpcionItem) => {
    const esta = estado.grupos.some((x) => x.grupoId === g.id);
    const grupos2: GrupoEstado[] = esta
      ? estado.grupos.filter((x) => x.grupoId !== g.id)
      : [...estado.grupos, { grupoId: g.id, nombre: g.nombre, requerido: g.obligatorio, minimo: g.minimo, maximo: g.maximo }];
    setEstado({ ...estado, grupos: grupos2 });
  };

  const pedirGuardar = () => {
    const v = validarTamanos(estado.tamanos);
    if (v) return setError(v);
    setError('');
    setConfirmarGuardar(true);
  };
  const guardar = async () => {
    setConfirmarGuardar(false);
    if (!producto) return;
    setGuardando(true);
    try {
      // Solo cambió el orden de las mismas preguntas: se guarda con su endpoint (queda en la auditoría)
      const ids = estado.grupos.map((g) => g.grupoId);
      const mismas = ids.length === ordenInicial.current.length && ids.every((id) => ordenInicial.current.includes(id));
      if (mismas && ids.some((id, i) => id !== ordenInicial.current[i])) await catalogoApi.ordenarGrupos(producto.id, ids);
      await catalogoApi.editarProducto(producto.id, {
        tamanos: estado.tamanos.map((t) => ({
          tamanoValorId: t.tamanoValorId,
          precio: Number(t.precio) || 0,
          activo: t.activo,
          unidades: t.unidades,
        })),
        grupos: estado.grupos.map((g, orden) => ({ grupoId: g.grupoId, orden })),
        sincronizarGrupos: true,
        resaltarOpcionMenosPedida: estado.resaltarMenosPedida === true,
      });
      // El orden de los tamaños vive en la lista (vale para todos): se reasigna entre los mismos huecos.
      const vals = listaTamano?.valores || [];
      const actuales = estado.tamanos.map((t) => vals.find((v) => v.id === t.tamanoValorId)).filter(Boolean) as ValorListaAdmin[];
      const huecos = actuales.map((v) => v.orden).sort((a, b) => a - b);
      for (let i = 0; i < actuales.length; i++) {
        if (actuales[i].orden !== huecos[i]) await catalogoApi.actualizarValor(actuales[i].id, { orden: huecos[i] });
      }
      ordenInicial.current = estado.grupos.map((g) => g.grupoId);
      alGuardar?.();
    } catch (e: any) {
      setError(e?.message || 'Error al guardar tamaños y opciones');
    } finally {
      setGuardando(false);
    }
  };


  const gruposActivos = grupos.filter((g) => estado.grupos.some((x) => x.grupoId === g.id));
  const esAqui = (g: GrupoOpcionItem) => estado.grupos.some((x) => x.grupoId === g.id);
  const nAqui = grupos.filter(esAqui).length;
  const gruposVisibles = grupos
    .filter((g) => g.nombre.toLowerCase().includes(buscarGrupo.trim().toLowerCase()))
    .filter((g) => (filtroGrupo === 'todos' ? true : filtroGrupo === 'aqui' ? esAqui(g) : !esAqui(g)))
    .sort((a, b) => Number(esAqui(b)) - Number(esAqui(a)));

  const borradorVivo: BorradorProducto = useMemo(() => ({
    ...(producto ?? {}),
    ...(borradorBase ?? {}),
    tamanos: estado.tamanos.map((t) => ({ id: t.tamanoValorId, nombre: t.nombre, precio: t.precio, activo: t.activo })),
    grupos: estado.grupos.map((x) => {
      const g = grupos.find((k) => k.id === x.grupoId);
      return {
        id: x.grupoId, nombre: g?.nombre ?? x.nombre, minimo: g?.minimo ?? x.minimo, maximo: g?.maximo ?? x.maximo,
        obligatorio: g?.obligatorio ?? x.requerido, opciones: g?.opciones, activo: g?.activo,
      };
    }),
  }), [producto, borradorBase, estado.tamanos, estado.grupos, grupos]);
  const preguntasOrden = estado.grupos.map((x) => ({ id: x.grupoId, nombre: grupos.find((g) => g.id === x.grupoId)?.nombre ?? x.nombre ?? `Grupo ${x.grupoId}` }));

  const sucio = modo === 'guardado' && JSON.stringify(estado) !== inicial.current;
  const cerrar = () => (sucio ? setConfirmarSalir(true) : alCancelar?.());
  const alternarAyuda = (k: string) => setAyudaAbierta((v) => (v === k ? null : k));

  const pestanaTamanos = (
    <fieldset className="eo-fs" disabled={bloqueado}>
      <div className="eo-tabla">
        <div className="eo-trow eo-thead" aria-hidden={false}>
          <div>Tamaño</div>
          <div>Precio S/ <Tip etiqueta="Precio (S/)" texto="Es el precio final de este tamaño, no un extra. Debe ser 0 o más."
            abierto={ayudaAbierta === 'precio'} alAlternar={() => alternarAyuda('precio')} /></div>
          <div>Unidades <Tip etiqueta="Unidades" texto="Unidad = 1, 1/2 docena = 6, Docena = 12. Cada venta de este tamaño descuenta esa cantidad del stock de cada sabor."
            abierto={ayudaAbierta === 'unidades'} alAlternar={() => alternarAyuda('unidades')} /></div>
          <div>Estado</div>
          <div>Acciones</div>
        </div>
        {estado.tamanos.map((t, i) => (
          <div className={`eo-trow ${t.activo ? '' : 'eo-oculto'}`} key={t.tamanoValorId}>
            <div className="eo-c-nombre">
              {renombrando?.id === t.tamanoValorId ? (
                <div className="eo-renombrar">
                  <input className="eo-input" aria-label={`Nuevo nombre de ${t.nombre}`} value={renombrando.texto}
                    title="El cambio vale para todos los productos que usan este tamaño."
                    onChange={(e) => setRenombrando({ id: t.tamanoValorId, texto: e.target.value })} />
                  <button type="button" className="eo-btn principal eo-mini" onClick={pedirRenombre}>Guardar nombre</button>
                  <button type="button" className="eo-btn eo-mini" onClick={() => setRenombrando(null)}>Cancelar</button>
                </div>
              ) : (
                <button type="button" className="eo-nombre-edit" aria-label={`Renombrar ${t.nombre}`} title="Clic para renombrar"
                  onClick={() => setRenombrando({ id: t.tamanoValorId, texto: t.nombre })}>
                  <span>{t.nombre}</span> <span aria-hidden="true">✎</span>
                </button>
              )}
            </div>
            <label className="eo-c-precio"><span className="eo-movil">Precio S/</span>
              <input className="eo-input" type="number" step="0.5" min={0} aria-label={`Precio de ${t.nombre}`} value={t.precio}
                onChange={(e) => setTam(i, { precio: parseFloat(e.target.value) })} />
            </label>
            <label className="eo-c-unid"><span className="eo-movil">Unidades</span>
              <input className="eo-input" type="number" step="1" min={1} aria-label={`Unidades de ${t.nombre}`} value={t.unidades}
                onChange={(e) => setTam(i, { unidades: Number(e.target.value) })} />
            </label>
            <div className="eo-c-estado">
              <button type="button" className={`eo-btn eo-mini ${t.activo ? 'lleno' : ''}`} aria-pressed={t.activo}
                aria-label={`${t.nombre}: ${t.activo ? 'activo, tocar para ocultar' : 'oculto, tocar para activar'}`}
                onClick={() => setTam(i, { activo: !t.activo })}>
                {t.activo ? 'Activo' : 'Oculto'}
              </button>
            </div>
            <div className="eo-c-acc">
              <button type="button" className="eo-btn eo-mini" aria-label={`Subir ${t.nombre}`} disabled={i === 0} onClick={() => mover(i, -1)}>▲</button>
              <button type="button" className="eo-btn eo-mini" aria-label={`Bajar ${t.nombre}`} disabled={i === estado.tamanos.length - 1} onClick={() => mover(i, 1)}>▼</button>
              <button type="button" className="eo-btn eo-mini" aria-label={`Quitar ${t.nombre}`} disabled={!t.activo} onClick={() => setQuitando(t.tamanoValorId)}>Quitar</button>
            </div>
          </div>
        ))}
      </div>
      {ayudaAbierta && (
        <div role="note" className="eo-nota">
          {ayudaAbierta === 'precio'
            ? 'Es el precio final de este tamaño, no un extra. Debe ser 0 o más.'
            : 'Unidad = 1, 1/2 docena = 6, Docena = 12. Cada venta de este tamaño descuenta esa cantidad del stock de cada sabor.'}
        </div>
      )}
      {estado.tamanos.length === 0 && <div className="eo-micro">Este producto no tiene tamaños: se vende a un precio único.</div>}
      <div className="eo-micro">
        «Quitar» solo lo oculta; los pedidos anteriores no cambian. <Tip etiqueta="Orden de los tamaños" texto="El orden (▲▼) es el de la lista de tamaños y vale para todos los productos." />
      </div>
      {!agregando ? (
        <div><button type="button" className="eo-btn" onClick={() => setAgregando(true)}>+ Agregar tamaño</button></div>
      ) : (
        <div className="eo-agregar">
          <select className="eo-input" aria-label="Elegir de la lista" value={elegido} onChange={(e) => setElegido(e.target.value)}>
            <option value="">Elegir tamaño…</option>
            {disponibles.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
          <button type="button" className="eo-btn lleno" disabled={!elegido}
            onClick={() => { const v = disponibles.find((x) => x.id === elegido); if (v) agregarTamano(v); }}>Agregar a este producto</button>
          <input className="eo-input" aria-label="O crear uno nuevo" placeholder="O crear uno nuevo, ej. Jarra 1 L" value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)} />
          <button type="button" className="eo-btn" onClick={crearTamano}>+ Crear</button>
          <button type="button" className="eo-btn" onClick={() => setAgregando(false)}>Cancelar</button>
        </div>
      )}
    </fieldset>
  );

  const chip = (k: 'aqui' | 'no' | 'todos', texto: string) => (
    <button type="button" className="eo-chip eo-chip-filtro" aria-pressed={filtroGrupo === k} onClick={() => setFiltroGrupo(k)}>{texto}</button>
  );
  const panelVivo = (
    <aside className={`eo-vivo${verVista ? ' eo-vivo--abierto' : ''}`} aria-label="Cómo lo ve el cliente">
      <button type="button" className="eo-btn eo-vivo-boton" aria-expanded={verVista} onClick={() => setVerVista((v) => !v)}>
        👁 Cómo lo ve el cliente
      </button>
      <div className="eo-vivo-panel">
        <div className="eo-micro">Vista previa en vivo: no envía nada ni toca el carrito.</div>
        <VistaPreviaEnVivo borrador={borradorVivo} gruposGenerales={grupos} destacarGrupoId={movidoId} />
      </div>
    </aside>
  );
  const pestanaPreguntas = (
    <div className="eo-preguntas-grid">
    <div className="eo-preguntas-izq">
      {estado.grupos.length > 0 && (
        <OrdenPreguntas preguntas={preguntasOrden} movidoId={movidoId} alMover={moverGrupo}
          alRestablecer={restablecerOrden} puedeRestablecer={ordenCambiado} deshabilitado={bloqueado} />
      )}
      <div className="eo-barra">
        <input className="eo-input eo-buscar" type="search" aria-label="Buscar grupo" placeholder="Buscar grupo…" value={buscarGrupo}
          onChange={(e) => setBuscarGrupo(e.target.value)} />
        {puedeEditar && !crearGrupoAbierto && (
          <button type="button" className="eo-btn" onClick={() => setCrearGrupoAbierto(true)}>+ Crear grupo nuevo</button>
        )}
      </div>
      <div className="eo-chips">
        {chip('aqui', `Se pregunta aquí (${nAqui})`)}
        {chip('no', `No se pregunta aquí (${grupos.length - nAqui})`)}
        {chip('todos', `Todos (${grupos.length})`)}
      </div>
      <div className="eo-ajuste">
        <label className="eo-interruptor">
          <input type="checkbox" checked={estado.resaltarMenosPedida === true} disabled={bloqueado}
            onChange={(e) => setEstado({ ...estado, resaltarMenosPedida: e.target.checked })} />
          <span className="eo-pista" aria-hidden="true" />
          <span className="eo-interruptor-texto">Resaltar en cocina la opción menos pedida</span>
        </label>
        <Tip etiqueta="Resaltar la opción menos pedida"
          texto="Por cada grupo de este producto, la cocina marca la opción que menos se eligió en los últimos 30 días (si nadie la eligió, cuenta 0). Apagado, la cocina no marca nada." />
      </div>
      {crearGrupoAbierto && (
        <NuevoGrupo cerrar={() => setCrearGrupoAbierto(false)} alCrear={async (g) => { await recargar(); toggleGrupo(g); }} />
      )}
      {gruposVisibles.length === 0 && <div className="eo-micro">Ningún grupo coincide.</div>}
      {gruposVisibles.map((g) => (
        <GrupoCard key={`${g.id}-${g.opciones.length}-${g.nombre}-${g.maximo}-${g.minimo}-${g.obligatorio}`} g={g}
          enProducto={esAqui(g)} puedeEditar={puedeEditar} onToggle={() => toggleGrupo(g)} alCambiar={recargar} />
      ))}
    </div>
    {panelVivo}
    </div>
  );

  const opcionesStock = grupos
    .filter(esAqui)
    .flatMap((g) => (g.opciones ?? []).map((o) => ({ id: o.id, nombre: `${g.nombre} · ${o.nombre}` })));
  const pestanaStock = producto && puedeEditar
    ? (opcionesStock.length > 0
      ? <EnlacesStockOpciones opciones={opcionesStock} />
      : <div className="eo-micro">Este producto aún no pregunta ninguna opción. Actívalas en «Preguntas al cliente».</div>)
    : <div className="eo-micro">El stock de las opciones se enlaza al editar un producto ya guardado.</div>;

  const pestanaVista = (
    <>
      <VistaCliente tamanos={estado.tamanos} grupos={gruposActivos} />
      {(producto || borradorBase) && (
        <BotonVistaPrevia
          bloque
          sinGuardar
          gruposGenerales={grupos}
          borrador={() => ({
            ...(producto ?? {}),
            ...(borradorBase ?? {}),
            tamanos: estado.tamanos.map((t) => ({ id: t.tamanoValorId, nombre: t.nombre, precio: t.precio, activo: t.activo })),
            grupos: estado.grupos.map((g) => ({ id: g.grupoId, nombre: g.nombre, minimo: g.minimo, maximo: g.maximo, obligatorio: g.requerido })),
          })}
        />
      )}
    </>
  );

  const pestanas: PestanaModal[] = [
    { id: 'tamanos', etiqueta: 'Tamaños', insignia: estado.tamanos.length, contenido: pestanaTamanos },
    { id: 'preguntas', etiqueta: 'Preguntas al cliente', insignia: estado.grupos.length, contenido: pestanaPreguntas },
    ...(modo === 'guardado' ? [{ id: 'stock', etiqueta: 'Stock de opciones', contenido: pestanaStock }] : []),
    { id: 'vista', etiqueta: 'Vista del cliente', contenido: pestanaVista, persistente: false },
  ];

  const botonAyuda = (
    <button type="button" className="eo-btn eo-mini eo-que" aria-expanded={ayudaGeneral} onClick={() => setAyudaGeneral((v) => !v)}>
      ¿Para qué sirve?
    </button>
  );
  const panelAyuda = ayudaGeneral && (
    <div className="eo-ayuda-general" role="region" aria-label="Para qué sirve">
      <p><b>Tamaños:</b> el cliente elige UN tamaño y cada uno tiene su precio (Regular 12 oz S/ 6, Grande 16 oz S/ 7). Si el producto no tiene tamaños, se vende a un precio único.</p>
      <p><b>Unidades:</b> cuántas unidades del producto incluye cada tamaño (Unidad 1, 1/2 docena 6, Docena 12). Así se descuenta el stock por sabor.</p>
      <p><b>Opciones que se le preguntan al cliente:</b> preguntas que aparecen al pedir (¿qué leche?, ¿extra shot?). Cada opción puede sumar un precio extra. <b>Obligatoria</b> = el cliente debe responder; <b>Varias</b> = puede marcar más de una; <b>Máximo</b> = cuántas a la vez.</p>
    </div>
  );
  const avisos = (
    <>
      {errorCarga && <div role="alert" className="eo-error">{errorCarga}</div>}
      {error && <div role="alert" className="eo-error">{error}</div>}
    </>
  );

  const confirmaciones = (
    <>
      <Confirmar abierto={confirmarGuardar} titulo="¿Guardar los cambios?"
        mensaje={`Se actualizarán los tamaños y opciones de «${producto?.nombre ?? ''}».`}
        textoSi="Sí, guardar" textoNo="No" alConfirmar={guardar} alCancelar={() => setConfirmarGuardar(false)} />
      <Confirmar abierto={confirmarRenombre} titulo="¿Renombrar el tamaño?"
        mensaje={`«${renombrando ? estado.tamanos.find((t) => t.tamanoValorId === renombrando.id)?.nombre : ''}» pasará a llamarse «${renombrando?.texto.trim() ?? ''}». El cambio vale para todos los productos que usan este tamaño.`}
        textoSi="Sí, renombrar" textoNo="No" alConfirmar={renombrar} alCancelar={() => setConfirmarRenombre(false)} />
      <Confirmar abierto={quitando !== null} titulo="¿Quitar el tamaño?"
        mensaje={`«${estado.tamanos.find((t) => t.tamanoValorId === quitando)?.nombre ?? ''}» se oculta de este producto. Nada se elimina y los pedidos anteriores no cambian.`}
        textoSi="Sí, quitar" textoNo="No"
        alConfirmar={() => { const i = estado.tamanos.findIndex((t) => t.tamanoValorId === quitando); if (i >= 0) setTam(i, { activo: false }); setQuitando(null); }}
        alCancelar={() => setQuitando(null)} />
      <Confirmar abierto={confirmarSalir} titulo="¿Salir sin guardar?"
        mensaje="Hiciste cambios en tamaños u opciones que aún no se guardaron."
        textoSi="Sí, salir" textoNo="No" peligro
        alConfirmar={() => { setConfirmarSalir(false); alCancelar?.(); }} alCancelar={() => setConfirmarSalir(false)} />
    </>
  );

  if (modo === 'borrador') {
    return (
      <div className="eo">
        <div>{botonAyuda}</div>
        {panelAyuda}
        {avisos}
        <Pestanas pestanas={pestanas} etiqueta="Tamaños y opciones" />
        {confirmaciones}
      </div>
    );
  }

  return (
    <>
      <ModalConPestanas
        titulo={`Tamaños y opciones: ${producto?.nombre ?? ''}`}
        pestanas={pestanas}
        alCerrar={cerrar}
        bloquearCierre={guardando}
        ancho={1180}
        accionesEncabezado={botonAyuda}
        bajoPestanas={panelAyuda || undefined}
        pie={(
          <>
            {(error || errorCarga) && <div className="eo-pie-avisos">{avisos}</div>}
            {sucio && <span role="status" className="eo-pendiente">● Hay cambios sin guardar</span>}
            <button type="button" className="eo-btn" onClick={cerrar}>Cerrar</button>
            {puedeEditar && sucio && (
              <button type="button" className="eo-btn principal" disabled={guardando} onClick={pedirGuardar}>Guardar cambios</button>
            )}
          </>
        )}
      />
      {confirmaciones}
    </>
  );
}

import { BotonVistaPrevia } from './VistaPreviaProducto';
import type { BorradorProducto } from './aProductoCarta';
import React, { useEffect, useMemo, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
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

const soles = (n: number) => `S/ ${Number(n || 0).toFixed(2)}`;

function Ayuda({ id, etiqueta, ayuda, detalle, children }: {
  id: string; etiqueta: string; ayuda: string; detalle?: string; children: React.ReactElement;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="eo-campo">
      <div className="eo-etiqueta">
        <label htmlFor={id}>{etiqueta}</label>
        {detalle && (
          <button type="button" className="eo-ayuda-boton" aria-expanded={abierto}
            aria-label={`Ayuda: ${etiqueta}`} onClick={() => setAbierto((v) => !v)}>?</button>
        )}
      </div>
      {React.cloneElement(children as React.ReactElement<any>, { id })}
      <div className="eo-micro">{ayuda}</div>
      {abierto && detalle && <div role="note" className="eo-nota">{detalle}</div>}
    </div>
  );
}

interface OpcionDraft { id?: string; nombre: string; precioExtra: number; activo: boolean }

function GrupoCard({ g, enProducto, onToggle, puedeEditar, alCambiar }: {
  g: GrupoOpcionItem; enProducto: boolean; onToggle: () => void; puedeEditar: boolean; alCambiar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(g.nombre);
  const [varias, setVarias] = useState((g.maximo ?? 1) > 1);
  const [obligatorio, setObligatorio] = useState(!!g.obligatorio);
  const [minimo, setMinimo] = useState(g.minimo ?? 0);
  const [maximo, setMaximo] = useState(g.maximo ?? 1);
  const [ops, setOps] = useState<OpcionDraft[]>(
    g.opciones.map((o) => ({ id: o.id, nombre: o.nombre, precioExtra: o.precioExtra, activo: o.activo !== false })),
  );
  const [error, setError] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const calc = () => {
    const min = obligatorio ? Math.max(1, varias ? minimo : 1) : varias ? minimo : 0;
    const max = varias ? maximo : 1;
    return { min, max };
  };

  const validar = (): string | null => {
    if (!nombre.trim()) return 'Escribe el nombre del grupo.';
    const { min, max } = calc();
    if (varias && max < 2) return 'Si el cliente puede elegir varias, el máximo debe ser 2 o más.';
    if (max < min) return 'El máximo no puede ser menor que el mínimo.';
    const vistos = new Set<string>();
    for (const o of ops) {
      if (!o.nombre.trim()) return 'Cada opción necesita un nombre.';
      if (!Number.isFinite(o.precioExtra) || o.precioExtra < 0) return `El precio extra de «${o.nombre}» debe ser 0 o más.`;
      const k = o.nombre.trim().toLowerCase();
      if (vistos.has(k)) return `La opción «${o.nombre}» está repetida.`;
      vistos.add(k);
    }
    return null;
  };

  const guardar = async () => {
    setConfirmar(false);
    setGuardando(true);
    try {
      const { min, max } = calc();
      await catalogoApi.actualizarGrupo(g.id, { nombre: nombre.trim(), obligatorio, minimo: min, maximo: max });
      for (const o of ops) {
        const orig = g.opciones.find((x) => x.id === o.id);
        if (!o.id) await catalogoApi.crearOpcion(g.id, { nombre: o.nombre.trim(), precioExtra: o.precioExtra });
        else if (orig && (orig.nombre !== o.nombre.trim() || orig.precioExtra !== o.precioExtra || (orig.activo !== false) !== o.activo)) {
          await catalogoApi.editarOpcion(o.id, { nombre: o.nombre.trim(), precioExtra: o.precioExtra, activo: o.activo });
        }
      }
      setError('');
      alCambiar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el grupo');
    } finally {
      setGuardando(false);
    }
  };

  const idb = `g${g.id}`;
  const setOp = (i: number, cambio: Partial<OpcionDraft>) => setOps(ops.map((o, k) => (k === i ? { ...o, ...cambio } : o)));

  return (
    <div className="eo-grupo">
      <div className="eo-grupo-cab">
        <button type="button" className="titulo" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{g.nombre} {abierto ? '▴' : '▾'}</div>
          <div className="eo-micro">
            {g.obligatorio ? 'Obligatorio' : 'Opcional'} · {(g.maximo ?? 1) > 1 ? `varias (máx. ${g.maximo})` : 'elige una'} ·{' '}
            {g.opciones.length} opciones · se usa en {g.productosCount ?? 0} producto(s)
          </div>
        </button>
        <button type="button" className={`eo-btn ${enProducto ? 'lleno' : ''}`} aria-pressed={enProducto}
          disabled={!puedeEditar} onClick={onToggle}>
          {enProducto ? 'Se pregunta aquí' : 'No se pregunta aquí'}
        </button>
      </div>
      {abierto && (
        <fieldset className="eo-grupo-cuerpo" disabled={!puedeEditar} style={{ border: 0, margin: 0 }}>
          <div className="eo-nota">Los cambios del grupo valen para todos los productos que lo usan ({g.productosCount ?? 0}).</div>
          <div className="eo-fila" style={{ borderBottom: 0, paddingBottom: 0 }}>
            <Ayuda id={`${idb}-nombre`} etiqueta="Nombre del grupo" ayuda="La pregunta que ve el cliente, por ejemplo «Tipo de leche»."
              detalle="Se muestra como título de la pregunta al pedir.">
              <input className="eo-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Ayuda>
            <Ayuda id={`${idb}-tipo`} etiqueta="El cliente elige" ayuda="Una = un solo valor. Varias = puede marcar más de una."
              detalle="Una se muestra como botones de elección única (radio). Varias, como casillas.">
              <select className="eo-input" value={varias ? 'varias' : 'una'} onChange={(e) => setVarias(e.target.value === 'varias')}>
                <option value="una">Una opción</option>
                <option value="varias">Varias opciones</option>
              </select>
            </Ayuda>
            <Ayuda id={`${idb}-obl`} etiqueta="¿Obligatoria?" ayuda="Si es obligatoria, el cliente debe responder para poder pedir."
              detalle="Obligatoria = el cliente no puede pedir sin elegir. Opcional = puede saltarla.">
              <select className="eo-input" value={obligatorio ? 'si' : 'no'} onChange={(e) => setObligatorio(e.target.value === 'si')}>
                <option value="no">Opcional</option>
                <option value="si">Obligatoria</option>
              </select>
            </Ayuda>
            {varias && (
              <>
                <Ayuda id={`${idb}-min`} etiqueta="Mínimo" ayuda="Cuántas debe marcar como mínimo." detalle="Si es obligatoria, el mínimo es al menos 1.">
                  <input className="eo-input" type="number" min={0} value={minimo} onChange={(e) => setMinimo(parseInt(e.target.value, 10) || 0)} />
                </Ayuda>
                <Ayuda id={`${idb}-max`} etiqueta="Máximo" ayuda="Cuántas puede marcar a la vez." detalle="Ejemplo: extras con máximo 3 permite hasta 3 extras por pedido.">
                  <input className="eo-input" type="number" min={2} value={maximo} onChange={(e) => setMaximo(parseInt(e.target.value, 10) || 0)} />
                </Ayuda>
              </>
            )}
          </div>
          <div className="eo-titulo" style={{ fontSize: 13 }}>Opciones y su precio extra</div>
          {ops.map((o, i) => (
            <div className="eo-fila" key={o.id ?? `n${i}`}>
              <Ayuda id={`${idb}-o${i}-n`} etiqueta="Opción" ayuda="Lo que puede elegir el cliente.">
                <input className="eo-input" value={o.nombre} onChange={(e) => setOp(i, { nombre: e.target.value })} />
              </Ayuda>
              <Ayuda id={`${idb}-o${i}-p`} etiqueta="Precio extra (S/)" ayuda="Lo que suma al precio. 0 = sin costo."
                detalle="Se suma al precio del producto cuando el cliente elige esta opción.">
                <input className="eo-input" type="number" step="0.5" min={0} value={o.precioExtra}
                  onChange={(e) => setOp(i, { precioExtra: parseFloat(e.target.value) || 0 })} />
              </Ayuda>
              <button type="button" className={`eo-btn ${o.activo ? 'lleno' : ''}`} aria-pressed={o.activo}
                aria-label={`${o.nombre || 'Opción'}: ${o.activo ? 'activa, tocar para ocultar' : 'oculta, tocar para activar'}`}
                onClick={() => setOp(i, { activo: !o.activo })}>
                {o.activo ? 'Activa' : 'Oculta'}
              </button>
            </div>
          ))}
          <button type="button" className="eo-btn" onClick={() => setOps([...ops, { nombre: '', precioExtra: 0, activo: true }])}>
            + Agregar opción
          </button>
          {error && <div role="alert" className="eo-error">{error}</div>}
          <button type="button" className="eo-btn principal" disabled={guardando}
            onClick={() => { const v = validar(); if (v) setError(v); else { setError(''); setConfirmar(true); } }}>
            Guardar cambios del grupo
          </button>
          <Confirmar abierto={confirmar} titulo="¿Guardar el grupo?"
            mensaje={`Los cambios de «${g.nombre}» valen para todos los productos que lo usan.`}
            textoSi="Sí, guardar" textoNo="No" alConfirmar={guardar} alCancelar={() => setConfirmar(false)} />
        </fieldset>
      )}
    </div>
  );
}

function NuevoGrupo({ alCrear, puedeEditar }: { alCrear: (g: GrupoOpcionItem) => void; puedeEditar: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [varias, setVarias] = useState(false);
  const [obligatorio, setObligatorio] = useState(false);
  const [minimo, setMinimo] = useState(0);
  const [maximo, setMaximo] = useState(2);
  const [ops, setOps] = useState<Array<{ nombre: string; precioExtra: number }>>([{ nombre: '', precioExtra: 0 }]);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);

  if (!puedeEditar) return null;
  if (!abierto) {
    return <button type="button" className="eo-btn" onClick={() => setAbierto(true)}>+ Crear grupo nuevo</button>;
  }

  const crear = async () => {
    const lista = ops.filter((o) => o.nombre.trim());
    const min = obligatorio ? Math.max(1, varias ? minimo : 1) : varias ? minimo : 0;
    const max = varias ? maximo : 1;
    if (!nombre.trim()) return setError('Escribe el nombre del grupo.');
    if (varias && max < 2) return setError('Si el cliente puede elegir varias, el máximo debe ser 2 o más.');
    if (max < min) return setError('El máximo no puede ser menor que el mínimo.');
    if (lista.some((o) => !Number.isFinite(o.precioExtra) || o.precioExtra < 0)) return setError('El precio extra debe ser 0 o más.');
    if (new Set(lista.map((o) => o.nombre.trim().toLowerCase())).size !== lista.length) return setError('Hay opciones repetidas.');
    setCreando(true);
    try {
      const nuevo = await catalogoApi.crearGrupo({ nombre: nombre.trim(), obligatorio, minimo: min, maximo: max });
      const creadas = [];
      for (const o of lista) creadas.push(await catalogoApi.crearOpcion(nuevo.id, { nombre: o.nombre.trim(), precioExtra: o.precioExtra }));
      alCrear({ ...nuevo, nombre: nuevo.nombre ?? nombre.trim(), obligatorio, minimo: min, maximo: max, opciones: creadas });
      setAbierto(false); setNombre(''); setOps([{ nombre: '', precioExtra: 0 }]); setError('');
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear el grupo');
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="eo-grupo"><div className="eo-grupo-cuerpo">
      <div className="eo-titulo">Grupo nuevo</div>
      <div className="eo-fila" style={{ borderBottom: 0, paddingBottom: 0 }}>
        <Ayuda id="ng-nombre" etiqueta="Nombre del grupo" ayuda="La pregunta al cliente, ej. «Tipo de leche» o «Extras»."
          detalle="Aparece como título de la pregunta al pedir.">
          <input className="eo-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Ayuda>
        <Ayuda id="ng-tipo" etiqueta="El cliente elige" ayuda="Una = un solo valor. Varias = puede marcar más de una."
          detalle="Una se muestra como botones (radio); Varias, como casillas.">
          <select className="eo-input" value={varias ? 'varias' : 'una'} onChange={(e) => setVarias(e.target.value === 'varias')}>
            <option value="una">Una opción</option>
            <option value="varias">Varias opciones</option>
          </select>
        </Ayuda>
        <Ayuda id="ng-obl" etiqueta="¿Obligatoria?" ayuda="Obligatoria = el cliente debe responder."
          detalle="Opcional = puede saltarla.">
          <select className="eo-input" value={obligatorio ? 'si' : 'no'} onChange={(e) => setObligatorio(e.target.value === 'si')}>
            <option value="no">Opcional</option>
            <option value="si">Obligatoria</option>
          </select>
        </Ayuda>
        {varias && (
          <>
            <Ayuda id="ng-min" etiqueta="Mínimo" ayuda="Cuántas debe marcar como mínimo.">
              <input className="eo-input" type="number" min={0} value={minimo} onChange={(e) => setMinimo(parseInt(e.target.value, 10) || 0)} />
            </Ayuda>
            <Ayuda id="ng-max" etiqueta="Máximo" ayuda="Cuántas puede marcar a la vez.">
              <input className="eo-input" type="number" min={2} value={maximo} onChange={(e) => setMaximo(parseInt(e.target.value, 10) || 0)} />
            </Ayuda>
          </>
        )}
      </div>
      {ops.map((o, i) => (
        <div className="eo-fila" key={i}>
          <Ayuda id={`ng-o${i}-n`} etiqueta="Opción" ayuda="Lo que puede elegir (ej. Almendra).">
            <input className="eo-input" value={o.nombre}
              onChange={(e) => setOps(ops.map((x, k) => (k === i ? { ...x, nombre: e.target.value } : x)))} />
          </Ayuda>
          <Ayuda id={`ng-o${i}-p`} etiqueta="Precio extra (S/)" ayuda="Lo que suma al precio. 0 = sin costo.">
            <input className="eo-input" type="number" step="0.5" min={0} value={o.precioExtra}
              onChange={(e) => setOps(ops.map((x, k) => (k === i ? { ...x, precioExtra: parseFloat(e.target.value) || 0 } : x)))} />
          </Ayuda>
        </div>
      ))}
      <button type="button" className="eo-btn" onClick={() => setOps([...ops, { nombre: '', precioExtra: 0 }])}>+ Agregar opción</button>
      {error && <div role="alert" className="eo-error">{error}</div>}
      <div className="eo-acciones">
        <button type="button" className="eo-btn principal" disabled={creando} onClick={crear}>Crear grupo</button>
        <button type="button" className="eo-btn" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </div></div>
  );
}

function VistaCliente({ tamanos, grupos }: { tamanos: TamanoEstado[]; grupos: GrupoOpcionItem[] }) {
  const act = tamanos.filter((t) => t.activo);
  return (
    <div className="eo-vista" aria-label="Así lo verá el cliente">
      <div className="eo-titulo">Así lo verá el cliente</div>
      {act.length === 0 ? (
        <div className="eo-micro">Sin tamaños: se vende a un precio único.</div>
      ) : (
        <div>
          <div className="pregunta">Elige el tamaño</div>
          {act.map((t, i) => (
            <label key={t.tamanoValorId}><input type="radio" name="vista-tamano" readOnly checked={i === 0} onChange={() => {}} /> {t.nombre} · {soles(t.precio)}</label>
          ))}
        </div>
      )}
      {grupos.map((g) => {
        const varias = (g.maximo ?? 1) > 1;
        return (
          <div key={g.id}>
            <div className="pregunta">
              {g.nombre} <span className="eo-micro">{g.obligatorio ? '(obligatoria)' : '(opcional)'}{varias ? ` · hasta ${g.maximo}` : ''}</span>
            </div>
            {g.opciones.filter((o) => o.activo !== false).map((o) => (
              <label key={o.id}>
                <input type={varias ? 'checkbox' : 'radio'} name={`vista-${g.id}`} readOnly checked={false} onChange={() => {}} />
                {o.nombre}{o.precioExtra > 0 ? ` (+${soles(o.precioExtra)})` : ''}
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
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
      alGuardar?.();
    } catch (e: any) {
      setError(e?.message || 'Error al guardar tamaños y opciones');
    } finally {
      setGuardando(false);
    }
  };

  const gruposActivos = grupos.filter((g) => estado.grupos.some((x) => x.grupoId === g.id));

  return (
    <div className="eo">
      <div className="eo-ayuda-general" aria-label="Para qué sirve">
        <div className="eo-titulo">Para qué sirve</div>
        <p><b>Tamaños:</b> el cliente elige UN tamaño y cada uno tiene su precio (Regular 12 oz S/ 6, Grande 16 oz S/ 7). Si el producto no tiene tamaños, se vende a un precio único.</p>
        <p><b>Unidades:</b> cuántas unidades del producto incluye cada tamaño (Unidad 1, 1/2 docena 6, Docena 12). Así se descuenta el stock por sabor.</p>
        <p><b>Opciones que se le preguntan al cliente:</b> preguntas que aparecen al pedir (¿qué leche?, ¿extra shot?). Cada opción puede sumar un precio extra. <b>Obligatoria</b> = el cliente debe responder; <b>Varias</b> = puede marcar más de una; <b>Máximo</b> = cuántas a la vez.</p>
      </div>
      {errorCarga && <div role="alert" className="eo-error">{errorCarga}</div>}

      <fieldset className="eo-seccion" disabled={bloqueado} style={{ margin: 0 }}>
        <div className="eo-titulo">Tamaños y precios</div>
        <div className="eo-micro">Cada tamaño tiene su propio precio. «Quitar» solo lo oculta: nada se elimina y los pedidos anteriores no cambian.</div>
        {estado.tamanos.length === 0 && <div className="eo-micro">Este producto no tiene tamaños: se vende a un precio único.</div>}
        {estado.tamanos.map((t, i) => (
          <div className="eo-fila" key={t.tamanoValorId}>
            <div className="eo-campo ancho">
              <div className="eo-etiqueta">Tamaño</div>
              {renombrando?.id === t.tamanoValorId ? (
                <>
                  <input className="eo-input" aria-label={`Nuevo nombre de ${t.nombre}`} value={renombrando.texto}
                    onChange={(e) => setRenombrando({ id: t.tamanoValorId, texto: e.target.value })} />
                  <div className="eo-micro">El cambio vale para todos los productos que usan este tamaño.</div>
                  <div className="eo-acciones">
                    <button type="button" className="eo-btn principal" onClick={pedirRenombre}>Guardar nombre</button>
                    <button type="button" className="eo-btn" onClick={() => setRenombrando(null)}>Cancelar</button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <strong style={{ fontSize: 14, flex: 1 }}>{t.nombre}</strong>
                  <button type="button" className="eo-btn" aria-label={`Renombrar ${t.nombre}`}
                    onClick={() => setRenombrando({ id: t.tamanoValorId, texto: t.nombre })}>Renombrar</button>
                </div>
              )}
            </div>
            <Ayuda id={`tam-p-${t.tamanoValorId}`} etiqueta="Precio (S/)" ayuda="Lo que paga el cliente por este tamaño."
              detalle="Es el precio final de este tamaño, no un extra. Debe ser 0 o más.">
              <input className="eo-input" type="number" step="0.5" min={0} aria-label={`Precio de ${t.nombre}`} value={t.precio}
                onChange={(e) => setTam(i, { precio: parseFloat(e.target.value) })} />
            </Ayuda>
            <Ayuda id={`tam-u-${t.tamanoValorId}`} etiqueta="Unidades" ayuda="Sirve para descontar el stock: una 1/2 docena descuenta 6 unidades."
              detalle="Unidad = 1. 1/2 docena = 6. Docena = 12. Cada venta de este tamaño descuenta esa cantidad del stock de cada sabor.">
              <input className="eo-input" type="number" step="1" min={1} aria-label={`Unidades de ${t.nombre}`} value={t.unidades}
                onChange={(e) => setTam(i, { unidades: Number(e.target.value) })} />
            </Ayuda>
            <div className="eo-campo" style={{ flex: '0 0 auto' }}>
              <div className="eo-etiqueta">Estado</div>
              <button type="button" className={`eo-btn ${t.activo ? 'lleno' : ''}`} aria-pressed={t.activo}
                aria-label={`${t.nombre}: ${t.activo ? 'activo, tocar para ocultar' : 'oculto, tocar para activar'}`}
                onClick={() => setTam(i, { activo: !t.activo })}>
                {t.activo ? 'Activo' : 'Oculto'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button type="button" className="eo-btn" aria-label={`Subir ${t.nombre}`} disabled={i === 0} onClick={() => mover(i, -1)}>▲</button>
              <button type="button" className="eo-btn" aria-label={`Bajar ${t.nombre}`} disabled={i === estado.tamanos.length - 1} onClick={() => mover(i, 1)}>▼</button>
              <button type="button" className="eo-btn" aria-label={`Quitar ${t.nombre}`} disabled={!t.activo} onClick={() => setTam(i, { activo: false })}>Quitar</button>
            </div>
          </div>
        ))}
        <div className="eo-micro">El orden (subir/bajar) es el de la lista de tamaños y vale para todos los productos.</div>
        {!agregando ? (
          <button type="button" className="eo-btn" onClick={() => setAgregando(true)}>Agregar tamaño</button>
        ) : (
          <div className="eo-fila" style={{ borderBottom: 0 }}>
            <Ayuda id="tam-elegir" etiqueta="Elegir de la lista" ayuda="Tamaños que ya existen en el catálogo.">
              <select className="eo-input" value={elegido} onChange={(e) => setElegido(e.target.value)}>
                <option value="">Elegir tamaño…</option>
                {disponibles.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </Ayuda>
            <button type="button" className="eo-btn lleno" disabled={!elegido}
              onClick={() => { const v = disponibles.find((x) => x.id === elegido); if (v) agregarTamano(v); }}>Agregar a este producto</button>
            <Ayuda id="tam-nuevo" etiqueta="O crear uno nuevo" ayuda="Si falta, escríbelo y toca «+ Crear»: queda en la lista para todos."
              detalle="Ejemplo: «Jarra 1 L». Se crea al instante y se agrega a este producto.">
              <input className="eo-input" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
            </Ayuda>
            <button type="button" className="eo-btn" onClick={crearTamano}>+ Crear</button>
            <button type="button" className="eo-btn" onClick={() => setAgregando(false)}>Cerrar</button>
          </div>
        )}
      </fieldset>

      <div className="eo-seccion">
        <div className="eo-titulo">Opciones que se le preguntan al cliente</div>
        <div className="eo-micro">
          Cada grupo (tipo de leche, endulzante, shots, extras…) se crea y se edita aquí. Elige en cuáles productos se pregunta. Los cambios del grupo valen para todos los que lo usan.
        </div>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, margin: '8px 0', cursor: bloqueado ? 'default' : 'pointer', fontWeight: 700, fontSize: 14, color: 'var(--cp-navy)' }}
        >
          <input
            type="checkbox"
            aria-describedby="resaltar-menos-pedida-ayuda"
            checked={estado.resaltarMenosPedida === true}
            disabled={bloqueado}
            onChange={(e) => setEstado({ ...estado, resaltarMenosPedida: e.target.checked })}
            style={{ width: 20, height: 20, flexShrink: 0 }}
          />
          Resaltar en cocina la opción menos pedida
        </label>
        <div id="resaltar-menos-pedida-ayuda" className="eo-micro">
          Por cada grupo de este producto, la cocina marca la opción que menos se eligió en los últimos 30 días (si nadie la eligió, cuenta 0). Apagado, la cocina no marca nada.
        </div>
        {grupos.map((g) => (
          <GrupoCard key={`${g.id}-${g.opciones.length}-${g.nombre}-${g.maximo}-${g.minimo}-${g.obligatorio}`} g={g}
            enProducto={estado.grupos.some((x) => x.grupoId === g.id)} puedeEditar={puedeEditar}
            onToggle={() => toggleGrupo(g)} alCambiar={recargar} />
        ))}
        <NuevoGrupo puedeEditar={puedeEditar} alCrear={async (g) => { await recargar(); toggleGrupo(g); }} />
      </div>

      <VistaCliente tamanos={estado.tamanos} grupos={gruposActivos} />

      {producto && puedeEditar && (
        <EnlacesStockOpciones
          opciones={grupos
            .filter((g) => estado.grupos.some((x) => x.grupoId === g.id))
            .flatMap((g) => (g.opciones ?? []).map((o) => ({ id: o.id, nombre: `${g.nombre} · ${o.nombre}` })))}
        />
      )}

      {error && <div role="alert" className="eo-error">{error}</div>}

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

      {modo === 'guardado' && puedeEditar && (
        <div className="eo-acciones">
          <button type="button" className="eo-btn principal" disabled={guardando} onClick={pedirGuardar}>Guardar cambios</button>
          {alCancelar && <button type="button" className="eo-btn" onClick={alCancelar}>Cancelar</button>}
        </div>
      )}

      <Confirmar abierto={confirmarGuardar} titulo="¿Guardar los cambios?"
        mensaje={`Se actualizarán los tamaños y opciones de «${producto?.nombre ?? ''}».`}
        textoSi="Sí, guardar" textoNo="No" alConfirmar={guardar} alCancelar={() => setConfirmarGuardar(false)} />
      <Confirmar abierto={confirmarRenombre} titulo="¿Renombrar el tamaño?"
        mensaje={`«${renombrando ? estado.tamanos.find((t) => t.tamanoValorId === renombrando.id)?.nombre : ''}» pasará a llamarse «${renombrando?.texto.trim() ?? ''}». El cambio vale para todos los productos que usan este tamaño.`}
        textoSi="Sí, renombrar" textoNo="No" alConfirmar={renombrar} alCancelar={() => setConfirmarRenombre(false)} />
    </div>
  );
}

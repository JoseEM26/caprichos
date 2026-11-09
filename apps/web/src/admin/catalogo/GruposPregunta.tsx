import { useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { catalogoApi, GrupoOpcionItem } from './catalogoApi';
import { Ayuda } from './ayudaOpciones';

interface OpcionDraft { id?: string; nombre: string; precioExtra: number; activo: boolean; resaltarSiempre: boolean }

export function resumenGrupo(g: GrupoOpcionItem): string {
  const n = g.opciones.length;
  const u = g.productosCount ?? 0;
  return `${g.obligatorio ? 'Obligatorio' : 'Opcional'} · ${(g.maximo ?? 1) > 1 ? `varias (máx. ${g.maximo})` : 'elige una'} · ${n} ${n === 1 ? 'opción' : 'opciones'} · usado en ${u} ${u === 1 ? 'producto' : 'productos'}`;
}

/** Un grupo de opciones: fila compacta con interruptor «Preguntar en este producto»; al abrir, edita el grupo y sus opciones. */
export function GrupoCard({ g, enProducto, onToggle, puedeEditar, alCambiar }: {
  g: GrupoOpcionItem; enProducto: boolean; onToggle: () => void; puedeEditar: boolean; alCambiar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(g.nombre);
  const [varias, setVarias] = useState((g.maximo ?? 1) > 1);
  const [obligatorio, setObligatorio] = useState(!!g.obligatorio);
  const [minimo, setMinimo] = useState(g.minimo ?? 0);
  const [maximo, setMaximo] = useState(g.maximo ?? 1);
  const [ops, setOps] = useState<OpcionDraft[]>(
    g.opciones.map((o) => ({ id: o.id, nombre: o.nombre, precioExtra: o.precioExtra, activo: o.activo !== false, resaltarSiempre: o.resaltarSiempre === true })),
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
        if (!o.id) await catalogoApi.crearOpcion(g.id, { nombre: o.nombre.trim(), precioExtra: o.precioExtra, ...(o.resaltarSiempre ? { resaltarSiempre: true } : {}) });
        else if (orig && (orig.nombre !== o.nombre.trim() || orig.precioExtra !== o.precioExtra || (orig.activo !== false) !== o.activo || (orig.resaltarSiempre === true) !== o.resaltarSiempre)) {
          await catalogoApi.editarOpcion(o.id, { nombre: o.nombre.trim(), precioExtra: o.precioExtra, activo: o.activo, resaltarSiempre: o.resaltarSiempre });
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
    <div className={`eo-grupo ${enProducto ? 'eo-grupo-aqui' : ''}`}>
      <div className="eo-grupo-cab">
        <button type="button" className="titulo" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
          <div className="eo-grupo-nombre">{g.nombre} {abierto ? '▴' : '▾'}</div>
          <div className="eo-micro">{resumenGrupo(g)}</div>
        </button>
        <label className="eo-interruptor" title="Si está encendido, el cliente ve este grupo al pedir este producto.">
          <input type="checkbox" checked={enProducto} disabled={!puedeEditar} onChange={onToggle}
            aria-label={`Preguntar «${g.nombre}» en este producto`} />
          <span className="eo-pista" aria-hidden="true" />
          <span className="eo-interruptor-texto">{enProducto ? 'Se pregunta aquí' : 'No se pregunta aquí'}</span>
        </label>
      </div>
      {abierto && (
        <fieldset className="eo-grupo-cuerpo" disabled={!puedeEditar} style={{ border: 0, margin: 0 }}>
          <div className="eo-micro">Los cambios del grupo valen para todos los productos que lo usan ({g.productosCount ?? 0}).</div>
          <div className="eo-rejilla">
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
              detalle="Opcional = puede saltarla.">
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
          <div className="eo-titulo-sec">Opciones y su precio extra (S/)</div>
          <div className="eo-opciones">
            {ops.map((o, i) => (
              <div className="eo-opcion" key={o.id ?? `n${i}`}>
                <input className="eo-input" aria-label={`Nombre de la opción ${i + 1}`} value={o.nombre} onChange={(e) => setOp(i, { nombre: e.target.value })} />
                <input className="eo-input eo-corto" type="number" step="0.5" min={0} aria-label={`Precio extra de la opción ${i + 1}`} value={o.precioExtra}
                  onChange={(e) => setOp(i, { precioExtra: parseFloat(e.target.value) || 0 })} />
                <button type="button" className={`eo-btn eo-mini ${o.activo ? 'lleno' : ''}`} aria-pressed={o.activo}
                  aria-label={`${o.nombre || 'Opción'}: ${o.activo ? 'activa, tocar para ocultar' : 'oculta, tocar para activar'}`}
                  onClick={() => setOp(i, { activo: !o.activo })}>
                  {o.activo ? 'Activa' : 'Oculta'}
                </button>
                <label className="eo-resaltar" title="Aparece destacada en la comanda cada vez que alguien la elige: útil para Leche sin lactosa, Leche de almendra, Stevia… Vale en todos los productos que usan este grupo.">
                  <input type="checkbox" checked={o.resaltarSiempre} onChange={(e) => setOp(i, { resaltarSiempre: e.target.checked })}
                    aria-label={`⭐ Resaltar siempre en cocina: ${o.nombre || 'opción ' + (i + 1)}`} />
                  <span>⭐ Resaltar siempre en cocina</span>
                </label>
              </div>
            ))}
          </div>
          <div className="eo-acciones-fila">
            <button type="button" className="eo-btn" onClick={() => setOps([...ops, { nombre: '', precioExtra: 0, activo: true, resaltarSiempre: false }])}>
              + Agregar opción
            </button>
            <button type="button" className="eo-btn principal" disabled={guardando}
              onClick={() => { const v = validar(); if (v) setError(v); else { setError(''); setConfirmar(true); } }}>
              Guardar cambios del grupo
            </button>
          </div>
          {error && <div role="alert" className="eo-error">{error}</div>}
          <Confirmar abierto={confirmar} titulo="¿Guardar el grupo?"
            mensaje={`Los cambios de «${g.nombre}» valen para todos los productos que lo usan.`}
            textoSi="Sí, guardar" textoNo="No" alConfirmar={guardar} alCancelar={() => setConfirmar(false)} />
        </fieldset>
      )}
    </div>
  );
}

/** Formulario de grupo nuevo. El botón «+ Crear grupo nuevo» vive en la barra de la pestaña; aquí solo el formulario. */
export function NuevoGrupo({ alCrear, cerrar }: { alCrear: (g: GrupoOpcionItem) => void; cerrar: () => void }) {
  const [nombre, setNombre] = useState('');
  const [varias, setVarias] = useState(false);
  const [obligatorio, setObligatorio] = useState(false);
  const [minimo, setMinimo] = useState(0);
  const [maximo, setMaximo] = useState(2);
  const [ops, setOps] = useState<Array<{ nombre: string; precioExtra: number }>>([{ nombre: '', precioExtra: 0 }]);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);

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
      cerrar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear el grupo');
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="eo-grupo"><div className="eo-grupo-cuerpo">
      <div className="eo-titulo">Grupo nuevo</div>
      <div className="eo-rejilla">
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
      <div className="eo-titulo-sec">Opciones y su precio extra (S/)</div>
      <div className="eo-opciones">
        {ops.map((o, i) => (
          <div className="eo-opcion eo-opcion-nueva" key={i}>
            <input className="eo-input" aria-label="Opción" placeholder="Ej. Almendra" value={o.nombre}
              onChange={(e) => setOps(ops.map((x, k) => (k === i ? { ...x, nombre: e.target.value } : x)))} />
            <input className="eo-input eo-corto" type="number" step="0.5" min={0} aria-label="Precio extra (S/)" value={o.precioExtra}
              onChange={(e) => setOps(ops.map((x, k) => (k === i ? { ...x, precioExtra: parseFloat(e.target.value) || 0 } : x)))} />
          </div>
        ))}
      </div>
      {error && <div role="alert" className="eo-error">{error}</div>}
      <div className="eo-acciones-fila">
        <button type="button" className="eo-btn" onClick={() => setOps([...ops, { nombre: '', precioExtra: 0 }])}>+ Agregar opción</button>
        <button type="button" className="eo-btn principal" disabled={creando} onClick={crear}>Crear grupo</button>
        <button type="button" className="eo-btn" onClick={cerrar}>Cancelar</button>
      </div>
    </div></div>
  );
}

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from 'react';
import type { EquipoMapa, MapaImpresionDatos, ReglasMapa } from '../impresionApi';
import { useEsMovil } from '../../configuracion/NavegacionConfiguracion';
import {
  COLOR_PIEZA,
  GRIS_APAGADO,
  GRUPOS_MODALIDAD,
  NOMBRE_ROL,
  TEXTO_ESTADO,
  alternarGrupo,
  luzDeEquipo,
  ordenarPiezas,
  textoLuz,
  type ClavePieza,
  type PiezaFlujo,
  type Salida,
} from './flujo';
import { IconoPieza } from './IconosMapa';
import { PanelDetalle, idDisparador, type DetalleAbierto } from './PanelDetalle';
import { RanuraArea } from './RanuraArea';
import { useMantenerPresionado } from './useMantenerPresionado';
import './mapa-impresion.css';

const CAJA = 'CAJA';

interface Trazo {
  id: string;
  d: string;
  clase: string;
  color: string;
}

/** Clase visual de una línea: sale (viva), no sale (gris discontinua), en espera (roja discontinua). */
function claseTrazo(p: PiezaFlujo, s: Salida): string {
  if (!p.reglaActiva) return 'apagada';
  if (!p.sale) return 'fuera';
  if (s.espera || s.cae || s.sinEquipo) return 'espera';
  return 'activa';
}

const prefiereSinMovimiento = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false);

const colorDe = (p: PiezaFlujo) => (p.reglaActiva ? COLOR_PIEZA[p.clave] : GRIS_APAGADO);

/** Lo que se lee en la tarjeta de una pieza: a dónde sale, o por qué no sale. */
function estadoPieza(p: PiezaFlujo): string {
  if (!p.sale) return p.reglaActiva ? p.motivo : 'Apagado';
  if (p.salidas.length === 0) return 'Sale, sin impresora asignada';
  return `Sale en: ${p.salidas.map((s) => (s.slot === null ? 'Caja' : s.nombreDestino)).join(', ')}`;
}

/** Anillo de progreso de la presión larga (3 s). */
function Anillo({ progreso }: { progreso: number }) {
  const r = 11;
  const largo = 2 * Math.PI * r;
  return (
    <svg className="mapa-anillo" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <circle cx="14" cy="14" r={r} className="mapa-anillo-base" />
      <circle
        cx="14"
        cy="14"
        r={r}
        className="mapa-anillo-marca"
        strokeDasharray={largo}
        strokeDashoffset={largo * (1 - progreso)}
        transform="rotate(-90 14 14)"
      />
    </svg>
  );
}

/** Botón «i Ver detalle»: la alternativa accesible a mantener presionado. */
function BotonVerDetalle({ id, nombre, onAbrir }: { id: string; nombre: string; onAbrir: () => void }) {
  return (
    <button type="button" className="mapa-ver" data-ver={id} aria-label={`Ver detalle de ${nombre}`} onClick={onAbrir}>
      <span className="mapa-ver-i" aria-hidden="true">i</span> Ver detalle
    </button>
  );
}

function Interruptor({
  id,
  titulo,
  ayuda,
  activo,
  deshabilitado,
  onCambiar,
}: {
  id: string;
  titulo: string;
  ayuda: string;
  activo: boolean;
  deshabilitado: boolean;
  onCambiar: (v: boolean) => void;
}) {
  return (
    <div className="mapa-regla">
      <div className="mapa-regla-texto">
        <span id={`${id}-titulo`} className="mapa-regla-titulo">{titulo}</span>
        <small id={`${id}-ayuda`}>{ayuda}</small>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-ayuda`}
        disabled={deshabilitado}
        data-cfg-id={id}
        className={`mapa-switch ${activo ? 'mapa-switch--on' : ''}`}
        onClick={() => onCambiar(!activo)}
      >
        {activo ? 'Encendido' : 'Apagado'}
      </button>
    </div>
  );
}

/** Nodo de «qué se imprime». Mantener presionado 3 s (o «Ver detalle») abre su hoja de detalle. */
function PiezaNodo({
  p,
  estilo,
  refNodo,
  onAbrir,
}: {
  p: PiezaFlujo;
  estilo?: CSSProperties;
  refNodo: (el: HTMLElement | null) => void;
  onAbrir: () => void;
}) {
  const { progreso, activa, gestos } = useMantenerPresionado(onAbrir);
  const sinMovimiento = prefiereSinMovimiento();
  const clase = p.sale ? 'mapa-pieza--sale' : p.reglaActiva ? 'mapa-pieza--fuera' : 'mapa-pieza--apagada';
  return (
    <article
      ref={refNodo}
      data-pieza={p.clave}
      className={`mapa-pieza ${clase} ${activa ? 'mapa-nodo--presion' : ''}`}
      style={{ ...estilo, ['--pieza' as string]: colorDe(p) } as CSSProperties}
      {...gestos}
    >
      {activa && !sinMovimiento && <Anillo progreso={progreso} />}
      <div className="mapa-nodo-cab">
        <span className="mapa-icono" aria-hidden="true"><IconoPieza clave={p.clave} /></span>
        <h4>{p.titulo}</h4>
      </div>
      <p className="mapa-nodo-desc">{p.que}</p>
      <p className="mapa-pieza-estado">{estadoPieza(p)}</p>
      <div className="mapa-nodo-pie">
        <BotonVerDetalle id={`pieza-${p.clave}`} nombre={p.titulo} onAbrir={onAbrir} />
      </div>
    </article>
  );
}

/** Nodo de impresora: luz, área que atiende, cola y el selector para cambiarla. */
function EquipoNodo({
  eq,
  cola,
  areas,
  puedeEditar,
  ocupado,
  enfocar,
  onMover,
  onAbrir,
}: {
  eq: EquipoMapa;
  cola: number;
  areas: Array<{ id: string; nombre: string }>;
  puedeEditar: boolean;
  ocupado: boolean;
  /** Tras mover por teclado el nodo se vuelve a montar en otra ranura: recupera el foco. */
  enfocar: boolean;
  onMover: (equipoId: string, areaId: string | null) => void;
  onAbrir: () => void;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (enfocar) selectRef.current?.focus();
  }, [enfocar]);
  const { progreso, activa, gestos } = useMantenerPresionado(onAbrir);
  const sinMovimiento = prefiereSinMovimiento();
  const luz = luzDeEquipo(eq);
  const detalle = eq.roles.map((r) => `${NOMBRE_ROL[r.rol] ?? r.rol}: ${TEXTO_ESTADO[r.estado] ?? r.estado}`).join(' · ');
  return (
    <div
      className={`mapa-equipo ${ocupado ? 'mapa-equipo--ocupado' : ''} ${activa ? 'mapa-nodo--presion' : ''}`}
      data-equipo={eq.deviceKeyId}
      draggable={puedeEditar && !ocupado}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', eq.deviceKeyId);
        e.dataTransfer.effectAllowed = 'move';
      }}
      {...gestos}
    >
      {activa && !sinMovimiento && <Anillo progreso={progreso} />}
      <div className="mapa-equipo-cab">
        <span className={`mapa-luz mapa-luz--${luz}`} aria-hidden="true" />
        <strong>{eq.nombre}</strong>
        <span className="mapa-equipo-estado-corto">{textoLuz(eq)}</span>
      </div>
      <p className="mapa-equipo-detalle">{detalle}</p>
      <p className="mapa-equipo-pie">{cola === 0 ? 'nada en cola' : `${cola} en cola`}</p>
      <div className="mapa-nodo-pie">
        <BotonVerDetalle id={`equipo-${eq.deviceKeyId}`} nombre={eq.nombre} onAbrir={onAbrir} />
      </div>
      <label className="mapa-equipo-select">
        Imprime lo de:
        <select
          ref={selectRef}
          value={eq.areaId ?? CAJA}
          disabled={!puedeEditar}
          onChange={(e) => onMover(eq.deviceKeyId, e.target.value === CAJA ? null : e.target.value)}
        >
          <option value={CAJA}>Caja</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Leyenda: qué significa cada línea y cada luz. Va arriba, siempre visible. */
export function LeyendaMapa() {
  return (
    <ul className="mapa-leyenda" aria-label="Leyenda del mapa">
      <li>
        <svg className="mapa-leyenda-linea" viewBox="0 0 44 10" aria-hidden="true" focusable="false">
          <path d="M2 5h40" className="mapa-linea mapa-linea--activa" />
        </svg>
        <span><strong>Línea viva</strong>: sale</span>
      </li>
      <li>
        <svg className="mapa-leyenda-linea" viewBox="0 0 44 10" aria-hidden="true" focusable="false">
          <path d="M2 5h40" className="mapa-linea mapa-linea--fuera" />
        </svg>
        <span><strong>Línea gris discontinua</strong>: no sale</span>
      </li>
      <li><span className="mapa-luz mapa-luz--verde" aria-hidden="true" /> <span>Impresora lista</span></li>
      <li><span className="mapa-luz mapa-luz--ambar" aria-hidden="true" /> <span>Atención (sin papel)</span></li>
      <li><span className="mapa-luz mapa-luz--rojo" aria-hidden="true" /> <span>No imprime</span></li>
      <li className="mapa-leyenda-pista">Mantén presionado una pieza o una impresora para ver su detalle.</li>
    </ul>
  );
}

/**
 * Mapa en tres columnas: ① qué se imprime · ② cuándo sale (reglas) · ③ en qué impresora sale.
 * Escritorio: cada pieza va en la misma fila que su regla. Celular: las tres columnas se apilan en ese orden.
 * Las líneas se miden desde el DOM (así los nodos siguen siendo botones con texto).
 */
export function LienzoMapa({
  mapa,
  flujo,
  puedeEditar,
  ocupado,
  enfocar,
  onCambiarRegla,
  onMover,
  onReemplazar,
}: {
  mapa: MapaImpresionDatos;
  flujo: PiezaFlujo[];
  puedeEditar: boolean;
  /** Clave de lo que se está guardando (equipo o regla); bloquea los controles. */
  ocupado: string | null;
  /** Equipo que debe recuperar el foco (el último movido). */
  enfocar: string | null;
  onCambiarRegla: (cambio: Partial<ReglasMapa>, clave: string) => void;
  onMover: (equipoId: string, areaId: string | null) => void;
  onReemplazar: (viejoId: string, nuevoId: string) => void;
}) {
  const vertical = useEsMovil();
  const raiz = useRef<HTMLDivElement>(null);
  const nodos = useRef(new Map<string, HTMLElement>());
  const [trazos, setTrazos] = useState<Trazo[]>([]);
  const [dim, setDim] = useState({ w: 0, h: 0 });
  const [sobre, setSobre] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<{ tipo: 'pieza' | 'equipo'; id: string } | null>(null);

  const slots: Array<{ id: string | null; nombre: string }> = useMemo(() => [{ id: null, nombre: 'Caja' }, ...mapa.areas], [mapa.areas]);
  const orden = useMemo(() => ordenarPiezas(flujo, slots.map((s) => s.id)), [flujo, slots]);

  const ref = (clave: string) => (el: HTMLElement | null) => {
    if (el) nodos.current.set(clave, el);
    else nodos.current.delete(clave);
  };

  const medir = useCallback(() => {
    const c = raiz.current;
    if (!c) return;
    if (vertical) {
      setTrazos([]);
      return;
    }
    const cr = c.getBoundingClientRect();
    const ancla = (el: HTMLElement, lado: 'der' | 'izq'): [number, number] => {
      const r = el.getBoundingClientRect();
      const x = r.left - cr.left;
      const y = r.top - cr.top;
      return lado === 'der' ? [x + r.width, y + r.height / 2] : [x, y + r.height / 2];
    };
    const nuevos: Trazo[] = [];
    for (const p of orden) {
      const origen = nodos.current.get(`pieza-${p.clave}`);
      if (!origen) continue;
      for (const s of p.salidas) {
        const destino = nodos.current.get(`slot-${s.slot ?? CAJA}`);
        if (!destino) continue;
        const [x1, y1] = ancla(origen, 'der');
        const [x2, y2] = ancla(destino, 'izq');
        const mx = (x1 + x2) / 2;
        nuevos.push({
          id: `${p.clave}-${s.slot ?? CAJA}`,
          d: `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`,
          clase: claseTrazo(p, s),
          color: colorDe(p),
        });
      }
    }
    setDim({ w: c.offsetWidth, h: c.offsetHeight });
    setTrazos(nuevos);
  }, [orden, vertical]);

  useLayoutEffect(() => {
    medir();
    const c = raiz.current;
    if (!c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => medir());
    ro.observe(c);
    return () => ro.disconnect();
  }, [medir]);

  const cola = (id: string) => mapa.colaPendientePorEquipo.find((c) => c.deviceKeyId === id)?.pendientes ?? 0;
  const r = mapa.reglas;
  const bloqueado = !puedeEditar || ocupado !== null;

  const abierto: DetalleAbierto | null = useMemo(() => {
    if (!detalle) return null;
    if (detalle.tipo === 'pieza') {
      const pieza = flujo.find((p) => p.clave === detalle.id);
      return pieza ? { tipo: 'pieza', pieza } : null;
    }
    const eq = mapa.equipos.find((e) => e.deviceKeyId === detalle.id);
    if (!eq) return null;
    return { tipo: 'equipo', eq, piezas: flujo.filter((p) => p.salidas.some((s) => s.equipoId === eq.deviceKeyId)) };
  }, [detalle, flujo, mapa.equipos]);

  const abrirPieza = (clave: ClavePieza) => setDetalle({ tipo: 'pieza', id: clave });
  const abrirEquipo = (id: string) => setDetalle({ tipo: 'equipo', id });

  // Celdas de una pieza (columna 1) y de su regla (columna 2). Van juntas para quedar en la misma fila.
  const piezaEl = (p: PiezaFlujo, estilo?: CSSProperties) => (
    <PiezaNodo
      key={`pieza-${p.clave}`}
      p={p}
      estilo={estilo}
      refNodo={ref(`pieza-${p.clave}`)}
      onAbrir={() => abrirPieza(p.clave)}
    />
  );

  const reglaEl = (p: PiezaFlujo, estilo?: CSSProperties): ReactNode => {
    const celda = (hijos: ReactNode) => (
      <div key={`regla-${p.clave}`} className="mapa-celda-regla" data-regla={p.clave} style={estilo}>
        {hijos}
      </div>
    );
    if (p.clave === 'RESUMEN') {
      return celda(
        <div className="mapa-regla mapa-regla--modos">
          <div className="mapa-regla-texto">
            <span id="mapa-resumen-titulo" className="mapa-regla-titulo">Sticker de resumen con el total</span>
            <small>Elige en qué tipo de pedido sale</small>
          </div>
          <div className="mapa-sale-en">
            <span className="mapa-sale-en-etiqueta">Sale en:</span>
            <div role="group" aria-labelledby="mapa-resumen-titulo" className="mapa-pildoras">
              {GRUPOS_MODALIDAD.map((g) => {
                const on = g.mods.every((m) => r.generalModalidades.includes(m));
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={on}
                    disabled={bloqueado}
                    className={`mapa-pildora ${on ? 'mapa-pildora--on' : ''}`}
                    onClick={() => onCambiarRegla({ generalModalidades: alternarGrupo(r.generalModalidades, g.mods) }, 'reglas')}
                  >
                    {g.titulo}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
      );
    }
    if (p.clave === 'PAGO') {
      return celda(
        <div className="mapa-regla mapa-regla--fija">
          <div className="mapa-regla-texto">
            <span className="mapa-regla-titulo">Ticket de pago</span>
            <small>Siempre sale en Caja. No tiene regla que cambiar.</small>
          </div>
        </div>,
      );
    }
    const pildoras = (id: string, campo: 'areaModalidades' | 'bebidaModalidades') => (
      <div className="mapa-sale-en">
        <span className="mapa-sale-en-etiqueta">Sale en:</span>
        <div role="group" aria-label={`Modalidades del ${id}`} className="mapa-pildoras">
          {GRUPOS_MODALIDAD.map((g) => {
            const on = g.mods.every((m) => r[campo].includes(m));
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={on}
                disabled={bloqueado}
                className={`mapa-pildora ${on ? 'mapa-pildora--on' : ''}`}
                onClick={() => onCambiarRegla({ [campo]: alternarGrupo(r[campo], g.mods) }, 'reglas')}
              >
                {g.titulo}
              </button>
            );
          })}
        </div>
      </div>
    );
    if (p.clave === 'BEBIDA') {
      return celda(
        <>
          <Interruptor
            id="mapa-impresion-bebida"
            titulo="Sticker de bebida"
            ayuda="Un vaso por bebida, en los tipos de pedido que elijas (la PC de bebidas)"
            activo={r.bebidaActivo}
            deshabilitado={bloqueado}
            onCambiar={(v) => onCambiarRegla({ bebidaActivo: v }, 'reglas')}
          />
          {pildoras('sticker de bebida', 'bebidaModalidades')}
        </>,
      );
    }
    if (p.clave === 'AREA') {
      return celda(
        <>
          <Interruptor
            id="mapa-impresion-area"
            titulo="Sticker por área"
            ayuda="Un sticker por área, salvo Bebidas, en los tipos de pedido que elijas"
            activo={r.areaActivo}
            deshabilitado={bloqueado}
            onCambiar={(v) => onCambiarRegla({ areaActivo: v }, 'reglas')}
          />
          {pildoras('sticker por área', 'areaModalidades')}
        </>,
      );
    }
    if (p.clave === 'COMANDA_AREA') {
      return celda(
        <Interruptor
          id="mapa-impresion-comanda-area"
          titulo="Comanda por área"
          ayuda="Una hoja por área para su cocina"
          activo={r.comandaAreaActivo}
          deshabilitado={bloqueado}
          onCambiar={(v) => onCambiarRegla({ comandaAreaActivo: v }, 'reglas')}
        />,
      );
    }
    return celda(
      <Interruptor
        id="mapa-impresion-comanda"
        titulo="Comanda de salón"
        ayuda="Solo en mesa y local, en la ticketera de Caja"
        activo={r.comandaSalonActivo}
        deshabilitado={bloqueado}
        onCambiar={(v) => onCambiarRegla({ comandaSalonActivo: v }, 'reglas')}
      />,
    );
  };

  const renderEquipo = (eq: EquipoMapa) => (
    <EquipoNodo
      key={eq.deviceKeyId}
      eq={eq}
      cola={cola(eq.deviceKeyId)}
      areas={mapa.areas}
      puedeEditar={puedeEditar}
      ocupado={ocupado === eq.deviceKeyId}
      enfocar={enfocar === eq.deviceKeyId}
      onMover={onMover}
      onAbrir={() => abrirEquipo(eq.deviceKeyId)}
    />
  );

  /** Arrastrar un equipo sobre una ranura lo asigna a esa área (o a Caja). */
  const arrastreDe = (clave: string, areaId: string | null) => ({
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!puedeEditar) return;
      e.preventDefault();
      setSobre(clave);
    },
    onDragLeave: () => setSobre((s) => (s === clave ? null : s)),
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      setSobre(null);
      const id = e.dataTransfer.getData('text/plain');
      if (id && puedeEditar) onMover(id, areaId);
    },
  });

  const destinosEl = (estilo?: CSSProperties) => (
    <div className="mapa-destinos" style={estilo}>
      {slots.map((slot) => {
        const clave = slot.id ?? CAJA;
        if (slot.id !== null) {
          const area = mapa.areas.find((a) => a.id === slot.id);
          if (!area) return null;
          return (
            <RanuraArea
              key={clave}
              area={area}
              mapa={mapa}
              puedeEditar={puedeEditar}
              sobre={sobre === clave}
              refNodo={ref(`slot-${clave}`)}
              arrastre={arrastreDe(clave, area.id)}
              onMover={onMover}
              onReemplazar={onReemplazar}
              renderEquipo={renderEquipo}
            />
          );
        }
        const equipos = mapa.equipos.filter((e) => e.areaId === null);
        return (
          <section
            key={clave}
            ref={ref(`slot-${clave}`)}
            aria-label={`Ranura ${slot.nombre}`}
            className={`mapa-ranura ${sobre === clave ? 'mapa-ranura--sobre' : ''}`}
            {...arrastreDe(clave, null)}
          >
            <h4 className="mapa-ranura-titulo">{slot.nombre}</h4>
            {equipos.map((eq) => renderEquipo(eq))}
            {equipos.length === 0 && <p className="mapa-ranura-vacia">Ningún equipo en Caja.</p>}
            <p className="mapa-ranura-nota">Los tickets de pago y las comandas de salón siempre salen aquí.</p>
          </section>
        );
      })}
    </div>
  );

  const titulos = (
    <>
      <h3 className="mapa-col-titulo" style={{ gridColumn: 1, gridRow: 1 }}>① Qué se imprime</h3>
      <h3 className="mapa-col-titulo" style={{ gridColumn: 2, gridRow: 1 }}>② Cuándo sale (reglas)</h3>
      <h3 className="mapa-col-titulo" style={{ gridColumn: 3, gridRow: 1 }}>③ En qué impresora sale</h3>
    </>
  );

  const panel = abierto && (
    <PanelDetalle key={idDisparador(abierto)} detalle={abierto} mapa={mapa} vertical={vertical} onCerrar={() => setDetalle(null)} />
  );

  if (vertical) {
    return (
      <>
        {panel}
        <div ref={raiz} className="mapa-lienzo mapa-lienzo--pila" data-testid="lienzo-mapa">
          <h3 className="mapa-col-titulo">① Qué se imprime</h3>
          {orden.map((p) => piezaEl(p))}
          <h3 className="mapa-col-titulo">② Cuándo sale (reglas)</h3>
          {orden.map((p) => reglaEl(p))}
          <h3 className="mapa-col-titulo">③ En qué impresora sale</h3>
          {destinosEl()}
        </div>
      </>
    );
  }

  const filas = orden.length;
  return (
    <>
      {panel}
      <div ref={raiz} className="mapa-lienzo" data-testid="lienzo-mapa">
        <svg className="mapa-lineas" aria-hidden="true" focusable="false" width={dim.w} height={dim.h}>
          {trazos.map((t) => (
            <path key={t.id} d={t.d} className={`mapa-linea mapa-linea--${t.clase}`} style={{ ['--pieza' as string]: t.color } as CSSProperties} />
          ))}
        </svg>
        {titulos}
        {orden.map((p, i) => [
          piezaEl(p, { gridColumn: 1, gridRow: i + 2 }),
          reglaEl(p, { gridColumn: 2, gridRow: i + 2 }),
        ])}
        {destinosEl({ gridColumn: 3, gridRow: `2 / span ${Math.max(filas, 1)}` })}
      </div>
    </>
  );
}

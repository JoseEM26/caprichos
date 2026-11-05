import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { EquipoMapa, MapaImpresionDatos, ReglasMapa } from '../impresionApi';
import { useEsMovil } from '../../configuracion/NavegacionConfiguracion';
import { GRUPOS_MODALIDAD, alternarGrupo, luzDeEquipo, type PiezaFlujo, type Salida } from './flujo';

const CAJA = 'CAJA';
const TEXTO_ESTADO: Record<string, string> = {
  lista: 'lista',
  sin_papel: 'sin papel',
  desconectada: 'desconectada',
  sin_permiso: 'sin permiso',
  error: 'con error',
  no_configurada: 'sin configurar',
  sin_programa: 'programa apagado',
};
const NOMBRE_ROL: Record<string, string> = { ETIQUETERA: 'Etiquetera', TICKETERA: 'Ticketera' };

interface Trazo {
  id: string;
  d: string;
  clase: string;
}

/** Clase visual de una línea: qué se ve de un vistazo entre pieza y columna de destino. */
function claseTrazo(p: PiezaFlujo, s: Salida): string {
  if (!p.reglaActiva) return 'apagada';
  if (!p.sale) return 'fuera';
  if (s.espera || s.cae || s.sinEquipo) return 'espera';
  return 'activa';
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function textoLuz(e: EquipoMapa): string {
  if (!e.conectado) return 'Sin conexión';
  const luz = luzDeEquipo(e);
  return luz === 'verde' ? 'Lista' : luz === 'ambar' ? 'Atención' : 'Revisar';
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

function EquipoNodo({
  eq,
  cola,
  areas,
  puedeEditar,
  ocupado,
  enfocar,
  onMover,
}: {
  eq: EquipoMapa;
  cola: number;
  areas: Array<{ id: string; nombre: string }>;
  puedeEditar: boolean;
  ocupado: boolean;
  /** Tras mover por teclado el nodo se vuelve a montar en otra ranura: recupera el foco. */
  enfocar: boolean;
  onMover: (equipoId: string, areaId: string | null) => void;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (enfocar) selectRef.current?.focus();
  }, [enfocar]);
  const luz = luzDeEquipo(eq);
  const detalle = eq.roles
    .map((r) => `${NOMBRE_ROL[r.rol] ?? r.rol}: ${TEXTO_ESTADO[r.estado] ?? r.estado}`)
    .join(' · ');
  return (
    <div
      className={`mapa-equipo ${ocupado ? 'mapa-equipo--ocupado' : ''}`}
      data-equipo={eq.deviceKeyId}
      draggable={puedeEditar && !ocupado}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', eq.deviceKeyId);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <div className="mapa-equipo-cab">
        <span className={`mapa-luz mapa-luz--${luz}`} aria-hidden="true" />
        <strong>{eq.nombre}</strong>
        <span className="mapa-equipo-estado-corto">{textoLuz(eq)}</span>
      </div>
      <p className="mapa-equipo-detalle">{detalle}</p>
      <p className="mapa-equipo-pie">
        {eq.ultimoLatido ? `Último latido ${hora(eq.ultimoLatido)}` : 'Sin latidos todavía'}
        {' · '}
        {cola === 0 ? 'nada en cola' : `${cola} en cola`}
      </p>
      <label className="mapa-equipo-select">
        Este equipo imprime lo de:
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

/**
 * Lienzo de tres columnas: qué se imprime · reglas · dónde sale. Las líneas se miden desde el DOM
 * (así los nodos siguen siendo botones con texto). En celular las columnas se apilan en ese orden.
 */
export function LienzoMapa({
  mapa,
  flujo,
  puedeEditar,
  ocupado,
  enfocar,
  onCambiarRegla,
  onMover,
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
}) {
  const vertical = useEsMovil();
  const raiz = useRef<HTMLDivElement>(null);
  const nodos = useRef(new Map<string, HTMLElement>());
  const [trazos, setTrazos] = useState<Trazo[]>([]);
  const [dim, setDim] = useState({ w: 0, h: 0 });
  const [sobre, setSobre] = useState<string | null>(null);

  const ref = (clave: string) => (el: HTMLElement | null) => {
    if (el) nodos.current.set(clave, el);
    else nodos.current.delete(clave);
  };

  const medir = useCallback(() => {
    const c = raiz.current;
    if (!c) return;
    const cr = c.getBoundingClientRect();
    const ancla = (el: HTMLElement, lado: 'der' | 'izq' | 'aba' | 'arr'): [number, number] => {
      const r = el.getBoundingClientRect();
      const x = r.left - cr.left;
      const y = r.top - cr.top;
      if (lado === 'der') return [x + r.width, y + r.height / 2];
      if (lado === 'izq') return [x, y + r.height / 2];
      if (lado === 'aba') return [x + r.width / 2, y + r.height];
      return [x + r.width / 2, y];
    };
    const nuevos: Trazo[] = [];
    for (const p of flujo) {
      const origen = nodos.current.get(`pieza-${p.clave}`);
      if (!origen) continue;
      for (const s of p.salidas) {
        const destino = nodos.current.get(`slot-${s.slot ?? CAJA}`);
        if (!destino) continue;
        const [x1, y1] = ancla(origen, vertical ? 'aba' : 'der');
        const [x2, y2] = ancla(destino, vertical ? 'arr' : 'izq');
        const d = vertical
          ? `M${x1} ${y1} C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`
          : `M${x1} ${y1} C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;
        nuevos.push({ id: `${p.clave}-${s.slot ?? CAJA}`, d, clase: claseTrazo(p, s) });
      }
    }
    setDim({ w: c.offsetWidth, h: c.offsetHeight });
    setTrazos(nuevos);
  }, [flujo, vertical]);

  useLayoutEffect(() => {
    medir();
    const c = raiz.current;
    if (!c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => medir());
    ro.observe(c);
    return () => ro.disconnect();
  }, [medir]);

  const slots: Array<{ id: string | null; nombre: string }> = [{ id: null, nombre: 'Caja' }, ...mapa.areas];
  const cola = (id: string) => mapa.colaPendientePorEquipo.find((c) => c.deviceKeyId === id)?.pendientes ?? 0;
  const r = mapa.reglas;
  const bloqueado = !puedeEditar || ocupado !== null;

  const estadoPieza = (p: PiezaFlujo) => (p.sale ? 'Sale con este pedido' : p.reglaActiva ? p.motivo : 'Apagado');

  return (
    <div ref={raiz} className="mapa-lienzo" data-testid="lienzo-mapa">
      <svg className="mapa-lineas" aria-hidden="true" focusable="false" width={dim.w} height={dim.h}>
        {trazos.map((t) => (
          <path key={t.id} d={t.d} className={`mapa-linea mapa-linea--${t.clase}`} />
        ))}
      </svg>

      <div className="mapa-col" aria-labelledby="col-piezas">
        <h3 id="col-piezas" className="mapa-col-titulo">Qué se imprime</h3>
        {flujo.map((p) => (
          <article
            key={p.clave}
            ref={ref(`pieza-${p.clave}`)}
            data-pieza={p.clave}
            className={`mapa-pieza ${p.sale ? 'mapa-pieza--sale' : p.reglaActiva ? 'mapa-pieza--fuera' : 'mapa-pieza--apagada'}`}
          >
            <h4>{p.titulo}</h4>
            <p>{p.que}</p>
            <p className="mapa-pieza-estado">{estadoPieza(p)}</p>
          </article>
        ))}
      </div>

      <div className="mapa-col" aria-labelledby="col-reglas">
        <h3 id="col-reglas" className="mapa-col-titulo">Reglas</h3>
        <Interruptor
          id="mapa-impresion-bebida"
          titulo="Sticker de bebida"
          ayuda="Un vaso por cada bebida, en todos los pedidos"
          activo={r.bebidaActivo}
          deshabilitado={bloqueado}
          onCambiar={(v) => onCambiarRegla({ bebidaActivo: v }, 'reglas')}
        />
        <div className="mapa-regla" data-regla="resumen">
          <div className="mapa-regla-texto">
            <span id="mapa-resumen-titulo" className="mapa-regla-titulo">Sticker de resumen con el total</span>
            <small>Marca en qué pedidos sale</small>
          </div>
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
                  onClick={() =>
                    onCambiarRegla({ generalModalidades: alternarGrupo(r.generalModalidades, g.mods) }, 'reglas')
                  }
                >
                  {g.titulo}: {on ? 'sí' : 'no'}
                </button>
              );
            })}
          </div>
        </div>
        <Interruptor
          id="mapa-impresion-area"
          titulo="Sticker por área"
          ayuda="Apagado hasta que lo confirmes: un sticker por cada área del pedido"
          activo={r.areaActivo}
          deshabilitado={bloqueado}
          onCambiar={(v) => onCambiarRegla({ areaActivo: v }, 'reglas')}
        />
        <Interruptor
          id="mapa-impresion-comanda"
          titulo="Comanda de salón"
          ayuda="Solo en mesa y local, en la ticketera de Caja"
          activo={r.comandaSalonActivo}
          deshabilitado={bloqueado}
          onCambiar={(v) => onCambiarRegla({ comandaSalonActivo: v }, 'reglas')}
        />
        <div className="mapa-regla mapa-regla--fija">
          <div className="mapa-regla-texto">
            <span className="mapa-regla-titulo">Ticket de pago</span>
            <small>Siempre sale en Caja. No tiene regla que cambiar.</small>
          </div>
        </div>
      </div>

      <div className="mapa-col" aria-labelledby="col-destinos">
        <h3 id="col-destinos" className="mapa-col-titulo">Dónde sale</h3>
        {slots.map((slot) => {
          const clave = slot.id ?? CAJA;
          const equipos = mapa.equipos.filter((e) => (e.areaId ?? null) === slot.id);
          return (
            <section
              key={clave}
              ref={ref(`slot-${clave}`)}
              aria-label={`Ranura ${slot.nombre}`}
              className={`mapa-ranura ${sobre === clave ? 'mapa-ranura--sobre' : ''}`}
              onDragOver={(e) => {
                if (!puedeEditar) return;
                e.preventDefault();
                setSobre(clave);
              }}
              onDragLeave={() => setSobre((s) => (s === clave ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                const id = e.dataTransfer.getData('text/plain');
                if (id && puedeEditar) onMover(id, slot.id);
              }}
            >
              <h4 className="mapa-ranura-titulo">{slot.nombre}</h4>
              {equipos.map((eq) => (
                <EquipoNodo
                  key={eq.deviceKeyId}
                  eq={eq}
                  cola={cola(eq.deviceKeyId)}
                  areas={mapa.areas}
                  puedeEditar={puedeEditar}
                  ocupado={ocupado === eq.deviceKeyId}
                  enfocar={enfocar === eq.deviceKeyId}
                  onMover={onMover}
                />
              ))}
              {equipos.length === 0 && (
                <p className="mapa-ranura-vacia">
                  {slot.id === null ? 'Ningún equipo en Caja.' : `Sin equipo: lo de ${slot.nombre} sale en Caja.`}
                </p>
              )}
              {slot.id === null && (
                <p className="mapa-ranura-nota">Los tickets de pago y las comandas de salón siempre salen aquí.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

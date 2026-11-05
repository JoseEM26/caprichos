import { useEffect, useRef } from 'react';
import type { EquipoMapa, MapaImpresionDatos } from '../impresionApi';
import { GRUPOS_MODALIDAD, NOMBRE_ROL, TEXTO_ESTADO, luzDeEquipo, motivoSalida, textoLuz, type PiezaFlujo } from './flujo';
import { IconoImpresora, IconoPieza } from './IconosMapa';
import { VistaPieza } from './VistaPiezaEjemplo';

export type DetalleAbierto = { tipo: 'pieza'; pieza: PiezaFlujo } | { tipo: 'equipo'; eq: EquipoMapa; piezas: PiezaFlujo[] };

/** Atributo data-ver del botón o nodo que abrió el detalle: a él vuelve el foco al cerrar con Esc o el botón. */
export const idDisparador = (d: DetalleAbierto) => (d.tipo === 'pieza' ? `pieza-${d.pieza.clave}` : `equipo-${d.eq.deviceKeyId}`);

/** Cuándo sale, con las reglas tal como están ahora (no el escenario del simulador). */
function reglaDe(p: PiezaFlujo, mapa: MapaImpresionDatos): string {
  if (p.clave === 'BEBIDA') return p.reglaActiva ? 'Regla encendida: sale en cada pedido que lleva bebidas.' : 'Regla apagada: no sale en ningún pedido.';
  if (p.clave === 'RESUMEN') {
    const modos = GRUPOS_MODALIDAD.filter((g) => g.mods.every((m) => mapa.reglas.generalModalidades.includes(m))).map((g) => g.titulo);
    return modos.length ? `Sale en: ${modos.join(' · ')}.` : 'Apagado: ninguna modalidad lo imprime.';
  }
  if (p.clave === 'AREA') return p.reglaActiva ? 'Regla encendida: un sticker por cada área del pedido.' : 'Regla apagada: actívala cuando lo confirmes.';
  if (p.clave === 'COMANDA') return p.reglaActiva ? 'Regla encendida: solo en pedidos de salón (mesa o local).' : 'Regla apagada.';
  if (p.clave === 'COMANDA_AREA') return p.reglaActiva ? 'Regla encendida: una hoja por cada área del pedido, en cualquier modalidad.' : 'Regla apagada: no sale en ningún pedido.';
  return 'Regla fija: siempre sale en Caja.';
}

function EstadoEquipo({ eq, cola }: { eq: EquipoMapa; cola: number }) {
  const luz = luzDeEquipo(eq);
  return (
    <>
      <p className="mapa-detalle-linea">
        <span className={`mapa-luz mapa-luz--${luz}`} aria-hidden="true" />
        {' '}Ahora: <strong>{textoLuz(eq)}</strong>
      </p>
      <ul className="mapa-detalle-lista">
        {eq.roles.map((r) => (
          <li key={r.rol}>{NOMBRE_ROL[r.rol] ?? r.rol}: {TEXTO_ESTADO[r.estado] ?? r.estado}</li>
        ))}
      </ul>
      <p className="mapa-detalle-linea">
        {eq.ultimoLatido ? `Último latido ${new Date(eq.ultimoLatido).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}` : 'Sin latidos todavía'}
        {' · '}
        <strong>{cola === 0 ? 'nada en cola' : `${cola} trabajo${cola === 1 ? '' : 's'} en cola`}</strong>
      </p>
    </>
  );
}

/**
 * Hoja de detalle de una pieza o una impresora. No es modal: no bloquea la pantalla ni las reglas.
 * Se cierra con Esc, con su botón Cerrar o tocando fuera; Esc y Cerrar devuelven el foco al disparador.
 */
export function PanelDetalle({
  detalle,
  mapa,
  vertical,
  onCerrar,
}: {
  detalle: DetalleAbierto;
  mapa: MapaImpresionDatos;
  vertical: boolean;
  onCerrar: () => void;
}) {
  const raiz = useRef<HTMLElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const devolverFoco = useRef(false);
  const id = idDisparador(detalle);
  const nombre = detalle.tipo === 'pieza' ? detalle.pieza.titulo : detalle.eq.nombre;

  const cerrarConFoco = () => {
    devolverFoco.current = true;
    onCerrar();
  };

  useEffect(() => {
    titulo.current?.focus();
    raiz.current?.scrollIntoView?.({ block: 'nearest' });
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrarConFoco();
    };
    const fuera = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || raiz.current?.contains(t)) return;
      // Los botones «Ver detalle» gestionan su propio clic: no cerrar aquí para no pelear con ellos.
      if (t.closest?.('[data-ver]')) return;
      onCerrar();
    };
    document.addEventListener('keydown', tecla);
    document.addEventListener('pointerdown', fuera);
    return () => {
      document.removeEventListener('keydown', tecla);
      document.removeEventListener('pointerdown', fuera);
      if (devolverFoco.current) {
        document.querySelector<HTMLElement>(`[data-ver="${id}"]`)?.focus();
      }
    };
    // Una sola instancia por detalle: el padre la monta con key=id.
  }, []);

  return (
    <section
      ref={raiz}
      role="dialog"
      aria-label={`Detalle: ${nombre}`}
      className={`mapa-detalle ${vertical ? 'mapa-detalle--hoja' : ''}`}
      data-detalle={id}
    >
      <div className="mapa-detalle-cab">
        <span className="mapa-icono" aria-hidden="true">
          {detalle.tipo === 'pieza' ? <IconoPieza clave={detalle.pieza.clave} /> : <IconoImpresora />}
        </span>
        <h3 ref={titulo} tabIndex={-1} className="mapa-detalle-titulo">{nombre}</h3>
        <button type="button" className="mapa-detalle-cerrar" onClick={cerrarConFoco}>Cerrar</button>
      </div>

      {detalle.tipo === 'pieza' ? (
        <PiezaDetalle pieza={detalle.pieza} mapa={mapa} />
      ) : (
        <EquipoDetalle eq={detalle.eq} piezas={detalle.piezas} mapa={mapa} />
      )}
    </section>
  );
}

function PiezaDetalle({ pieza: p, mapa }: { pieza: PiezaFlujo; mapa: MapaImpresionDatos }) {
  return (
    <>
      <p className="mapa-detalle-para">{p.paraQue}</p>
      <h4 className="mapa-detalle-h">Cuándo sale</h4>
      <p className="mapa-detalle-linea">{reglaDe(p, mapa)}</p>
      <p className="mapa-detalle-linea">Con el pedido del simulador: <strong>{p.sale ? 'sale' : 'no sale'}</strong>. {p.motivo}.</p>

      <h4 className="mapa-detalle-h">En qué impresora sale</h4>
      {p.salidas.length === 0 && <p className="mapa-detalle-linea">Ninguna impresora asignada.</p>}
      <ul className="mapa-detalle-lista">
        {p.salidas.map((s, i) => {
          const eq = s.equipoId ? mapa.equipos.find((e) => e.deviceKeyId === s.equipoId) : undefined;
          const cola = eq ? mapa.colaPendientePorEquipo.find((c) => c.deviceKeyId === eq.deviceKeyId)?.pendientes ?? 0 : 0;
          return (
            <li key={i}>
              <strong>{s.nombreDestino}</strong>: {motivoSalida(s)}
              {eq && (
                <span className="mapa-detalle-sub">
                  {' '}Estado: {textoLuz(eq).toLowerCase()} · {cola === 0 ? 'nada en cola' : `${cola} en cola`}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <h4 className="mapa-detalle-h">Así se ve</h4>
      <VistaPieza clave={p.clave} />
    </>
  );
}

function EquipoDetalle({ eq, piezas, mapa }: { eq: EquipoMapa; piezas: PiezaFlujo[]; mapa: MapaImpresionDatos }) {
  const cola = mapa.colaPendientePorEquipo.find((c) => c.deviceKeyId === eq.deviceKeyId)?.pendientes ?? 0;
  const area = eq.areaId === null ? 'Caja' : mapa.areas.find((a) => a.id === eq.areaId)?.nombre ?? 'el área';
  return (
    <>
      <p className="mapa-detalle-para">Imprime lo de <strong>{area}</strong>. Cambia el área desde su selector en el mapa.</p>
      <h4 className="mapa-detalle-h">Estado de la impresora</h4>
      <EstadoEquipo eq={eq} cola={cola} />
      <h4 className="mapa-detalle-h">Qué imprime</h4>
      {piezas.length === 0 && <p className="mapa-detalle-linea">Nada con el pedido de ahora.</p>}
      <ul className="mapa-detalle-lista">
        {piezas.map((p) => (
          <li key={p.clave}>
            <span className="mapa-icono" aria-hidden="true"><IconoPieza clave={p.clave} /></span> {p.titulo}
          </li>
        ))}
      </ul>
      {piezas.map((p) => (
        <VistaPieza key={p.clave} clave={p.clave} />
      ))}
    </>
  );
}

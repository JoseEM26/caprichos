import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import type { Pedido } from './pedidosApi';
import type { AccionCaja } from './accionesCaja';
import { PastillaEspera } from './PastillaEspera';
import { IconoModalidad, claveModalidad, textoMesa } from './InsigniaModalidad';
import { ReimprimirPedido } from './ReimprimirPedido';
import { CANAL, MOD, aHora, textoPago } from './columnasCaja';
import { esCerrado, estadoVisual } from './estadosCaja';
import { mediosDePedido, nombreMedio } from './mediosFila';
import { totalDe } from './resumenDia';
import { deliverySinUbicacion } from './ubicacionDelivery';
import './lista-caja.css';

const soles = (n: number) => `S/ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Una sola acción siguiente (la de Caja) cae en uno de tres botones: Pago, Finalizar o Estado. */
export function ranurasDeAccion(a: AccionCaja | null): { estado?: AccionCaja; pago?: AccionCaja; finalizar?: AccionCaja } {
  if (!a) return {};
  if (a.tipo === 'confirmar_pago' || a.tipo === 'cobrar') return { pago: a };
  if (a.tipo === 'mesa' || (a.tipo === 'estado' && a.nuevoEstado === 'ENTREGADO')) return { finalizar: a };
  return { estado: a };
}

const titulo = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

const IcoPuntos = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
);

/** Solo un menú «⋮» abierto a la vez: el que se abre cierra al anterior. */
let cerrarMenuAbierto: (() => void) | null = null;

/**
 * Menú «⋮»: lo que no cabe como botón rápido. Los cambios de pago, edición y demás viven en «Abrir el pedido».
 * Se dibuja en un portal a <body> con posición fija calculada desde el botón: así queda por encima de las otras filas y
 * no lo recorta el overflow de la fila ni el de la lista. Si no cabe abajo se abre hacia arriba; en horizontal se ajusta a la pantalla.
 */
export function MenuMas({ p, alVerDetalle, alAbrir }: { p: Pedido; alVerDetalle: (p: Pedido) => void; alAbrir: (p: Pedido) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const cerrar = useCallback((devolverFoco = false) => {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }, []);

  // Posición: debajo del botón, o encima si no cabe; alineado a su borde derecho sin salirse de la pantalla
  useLayoutEffect(() => {
    if (!abierto || !boton.current || !menu.current) return;
    const b = boton.current.getBoundingClientRect();
    const { offsetWidth: w, offsetHeight: h } = menu.current;
    const abajo = b.bottom + 4;
    const top = abajo + h <= window.innerHeight - 8 || b.top - 4 - h < 8 ? abajo : b.top - 4 - h;
    const left = Math.max(8, Math.min(b.right - w, window.innerWidth - w - 8));
    setPos({ top, left });
    menu.current.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    cerrarMenuAbierto?.();
    const yo = () => { setAbierto(false); setPos(null); };
    cerrarMenuAbierto = yo;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!boton.current?.contains(t) && !menu.current?.contains(t)) yo();
    };
    const alMover = (e: Event) => { if (!(e.target instanceof Node && menu.current?.contains(e.target))) yo(); };
    document.addEventListener('mousedown', fuera);
    window.addEventListener('scroll', alMover, true);
    window.addEventListener('resize', yo);
    return () => {
      document.removeEventListener('mousedown', fuera);
      window.removeEventListener('scroll', alMover, true);
      window.removeEventListener('resize', yo);
      if (cerrarMenuAbierto === yo) cerrarMenuAbierto = null;
    };
  }, [abierto]);

  const alTeclear = (e: KeyboardEvent) => {
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const ir = (j: number) => { e.preventDefault(); items[(j + items.length) % items.length]?.focus(); };
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(true); }
    else if (e.key === 'ArrowDown') ir(i + 1);
    else if (e.key === 'ArrowUp') ir(i - 1);
    else if (e.key === 'Home') ir(0);
    else if (e.key === 'End') ir(items.length - 1);
    else if (e.key === 'Tab') cerrar();
  };

  return (
    <div className="lc-mas">
      <button
        ref={boton}
        type="button"
        className="lc-btn lc-btn--ico"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Más acciones de ${p.codigo}`}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !abierto) { e.preventDefault(); setAbierto(true); } }}
      >
        <IcoPuntos />
      </button>
      {abierto &&
        createPortal(
          <div ref={menu} className="lc-menu" role="menu" aria-label={`Acciones de ${p.codigo}`} onKeyDown={alTeclear} style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => { cerrar(); alVerDetalle(p); }}>Ver detalle de la venta</button>
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => { cerrar(); alAbrir(p); }}>Abrir el pedido</button>
          </div>,
          document.body,
        )}
    </div>
  );
}

export interface FilaListaProps {
  pedido: Pedido;
  /** Acción siguiente según los permisos de quien mira (la misma de las tarjetas). */
  accion: AccionCaja | null;
  resaltado?: boolean;
  alAccion: (p: Pedido, a: AccionCaja) => void;
  alVerDetalle: (p: Pedido) => void;
  alAbrir: (p: Pedido) => void;
}

const FilaLista = memo(function FilaLista({ pedido: p, accion, resaltado, alAccion, alVerDetalle, alAbrir }: FilaListaProps) {
  const v = estadoVisual(p);
  const clave = claveModalidad(p.modalidad);
  const cerrado = esCerrado(p);
  const medios = mediosDePedido(p);
  const sinRepartidor = clave === 'DELIVERY' && !p.repartidor_party_id && !cerrado;
  const sinUbicar = clave === 'DELIVERY' && deliverySinUbicacion(p);
  const { estado, pago, finalizar } = ranurasDeAccion(accion);
  const quien = p.atendidoPorNombre || p.cobroMozo?.mozo || CANAL[String(p.canal || '').toUpperCase()] || p.canal || '';
  const fecha = p.creado_en
    ? new Date(p.creado_en).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Lima' })
    : '';
  const boton = (a: AccionCaja, etiqueta: string, texto: string, extra = '') => (
    <button key={etiqueta} type="button" className={`lc-btn ${extra}`} data-accion={a.tipo} aria-label={`${a.texto} ${p.codigo}`} onClick={() => alAccion(p, a)}>
      <span className="lc-btn-cap">{etiqueta}</span>
      <span className="lc-btn-txt">{texto}</span>
    </button>
  );
  return (
    <li className={`lc-fila${resaltado ? ' lc-fila--nuevo' : ''}`} data-testid="fila-lista" data-modalidad={clave} data-estado={v.clave} aria-label={`Pedido ${p.codigo}`}>
      <div className="lc-id">
        <span className="lc-cod">
          <strong>{p.codigo}</strong>
          <span className="lc-tipo"><IconoModalidad modalidad={clave} tamano={18} />{MOD[clave]}{clave === 'MESA' && p.mesa_nombre ? ` · ${textoMesa(p.mesa_nombre)}` : ''}</span>
        </span>
        <PastillaEspera creadoEn={p.creado_en} cerrado={cerrado} />
        <span className="lc-meta">{fecha} {aHora(p.creado_en)}{quien ? ` · ${quien}` : ''}</span>
      </div>

      <div className="lc-estado">
        <span className="lc-chip" data-testid="lista-estado" style={{ background: v.bg, color: v.fg, border: v.clave === 'anulado' ? '1.5px solid var(--cp-rust, #B2500F)' : undefined }}>{v.l}</span>
      </div>

      <div className="lc-total">
        <strong className={v.clave === 'anulado' ? 'lc-anulado' : undefined}>{soles(totalDe(p))}</strong>
        <span className="lc-pago" data-pago={textoPago(p)}>{textoPago(p)}</span>
        {medios.length > 0 && <span className="lc-medios">{medios.map(nombreMedio).join(' + ')}</span>}
      </div>

      <div className="lc-cliente">
        <span className="lc-nombre" title={p.cliente_nombre?.trim() || 'Cliente'}>{p.cliente_nombre?.trim() || 'Cliente'}</span>
        {sinUbicar && <span className="lc-aviso">Falta la ubicación</span>}
        {sinRepartidor && (
          <Link to="/admin/repartos" className="lc-repartidor" aria-label={`Elige un repartidor para ${p.codigo}`}>
            Elige un repartidor <span aria-hidden="true">›</span>
          </Link>
        )}
      </div>

      <div className="lc-acciones">
        <ReimprimirPedido pedido={p} variante="tarjeta" />
        {estado && boton(estado, 'Estado', titulo(estado.texto))}
        {pago && boton(pago, 'Pago', pago.tipo === 'cobrar' ? titulo(pago.texto).replace(/ s\/ /i, ' S/ ') : titulo(pago.texto), 'lc-btn--pago')}
        {finalizar && boton(finalizar, 'Finalizar', 'Finalizar', 'lc-btn--fin')}
        <MenuMas p={p} alVerDetalle={alVerDetalle} alAbrir={alAbrir} />
      </div>
    </li>
  );
});

export interface ListaCajaProps {
  /** Pedidos de la página actual, ya ordenados. */
  filas: Pedido[];
  accionDe: (p: Pedido) => AccionCaja | null;
  resaltados: Set<string>;
  alAccion: (p: Pedido, a: AccionCaja) => void;
  alVerDetalle: (p: Pedido) => void;
  alAbrir: (p: Pedido) => void;
}

/** Cola de pedidos: una fila por pedido, con franja de color por tipo de servicio y acciones rápidas. */
export function ListaCaja({ filas, accionDe, resaltados, alAccion, alVerDetalle, alAbrir }: ListaCajaProps) {
  // Que la lectura de pantalla anuncie el cambio de página o de filtros sin mover el foco
  const [anuncio, setAnuncio] = useState('');
  useEffect(() => setAnuncio(`${filas.length} ${filas.length === 1 ? 'pedido' : 'pedidos'} en esta página`), [filas.length]);
  return (
    <div className="lc-panel" data-testid="lista-caja">
      <ul className="lc-lista">
        {filas.map((p) => (
          <FilaLista key={p.id} pedido={p} accion={accionDe(p)} resaltado={resaltados.has(String(p.id))} alAccion={alAccion} alVerDetalle={alVerDetalle} alAbrir={alAbrir} />
        ))}
      </ul>
      <span className="lc-sr" role="status">{anuncio}</span>
    </div>
  );
}

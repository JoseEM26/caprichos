import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useCerrarFuera } from '../../comun/tabla/ControlesTabla';
import type { Pedido } from './pedidosApi';
import type { AccionCaja } from './accionesCaja';
import { PastillaEspera } from './PastillaEspera';
import { IconoModalidad, claveModalidad, textoMesa } from './InsigniaModalidad';
import { ReimprimirPedido } from './ReimprimirPedido';
import { CANAL, MOD, aHora, textoPago } from './columnasCaja';
import { esCerrado, estadoVisual } from './estadosCaja';
import { mediosDePedido, nombreMedio } from './mediosFila';
import { totalDe } from './resumenDia';
import { CAMPOS_ORDEN_LISTA, PESTANAS_LISTA, type CampoOrdenLista, type OrdenLista, type PestanaLista } from './listaCaja';
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

/** Pestañas por tipo de servicio (ARIA tablist, flechas, Inicio y Fin). */
export function PestanasLista({ activa, conteos, alCambiar }: { activa: PestanaLista; conteos: Record<PestanaLista, number>; alCambiar: (t: PestanaLista) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mover = (e: KeyboardEvent, i: number) => {
    const n = PESTANAS_LISTA.length;
    const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    const t = PESTANAS_LISTA[j].id;
    alCambiar(t);
    refs.current[t]?.focus();
  };
  return (
    <div className="lc-tabs" role="tablist" aria-label="Tipo de servicio">
      {PESTANAS_LISTA.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[t.id] = el; }}
          type="button"
          role="tab"
          id={`lc-tab-${t.id}`}
          aria-selected={activa === t.id}
          aria-controls="lc-panel"
          tabIndex={activa === t.id ? 0 : -1}
          className="lc-tab"
          onClick={() => alCambiar(t.id)}
          onKeyDown={(e) => mover(e, i)}
        >
          {t.n}
          <span className="lc-tab-n" data-testid={`lista-cuenta-${t.id}`}>{conteos[t.id]}</span>
        </button>
      ))}
    </div>
  );
}

/** «Ordenar por» sencillo: un campo y el sentido. */
export function OrdenarLista({ orden, alCambiar }: { orden: OrdenLista; alCambiar: (o: OrdenLista) => void }) {
  return (
    <div className="lc-orden">
      <label className="lc-orden-campo">
        <span>Ordenar por</span>
        <select value={orden.campo} onChange={(e) => alCambiar({ ...orden, campo: e.target.value as CampoOrdenLista })}>
          {CAMPOS_ORDEN_LISTA.map((c) => (
            <option key={c.id} value={c.id}>{c.n}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="lc-orden-dir"
        aria-label={orden.dir === 'asc' ? 'Orden ascendente, tocar para ordenar de mayor a menor' : 'Orden descendente, tocar para ordenar de menor a mayor'}
        onClick={() => alCambiar({ ...orden, dir: orden.dir === 'asc' ? 'desc' : 'asc' })}
      >
        <span aria-hidden="true">{orden.dir === 'asc' ? '↑' : '↓'}</span>
        {orden.dir === 'asc' ? 'Ascendente' : 'Descendente'}
      </button>
    </div>
  );
}

/** Menú «⋮»: lo que no cabe como botón rápido. Los cambios de pago, edición y demás viven en «Abrir el pedido». */
function MenuMas({ p, alVerDetalle, alAbrir }: { p: Pedido; alVerDetalle: (p: Pedido) => void; alAbrir: (p: Pedido) => void }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useCerrarFuera(abierto, () => setAbierto(false));
  return (
    <div className="lc-mas" ref={raiz}>
      <button type="button" className="lc-btn lc-btn--ico" aria-haspopup="menu" aria-expanded={abierto} aria-label={`Más acciones de ${p.codigo}`} onClick={() => setAbierto((a) => !a)}>
        <IcoPuntos />
      </button>
      {abierto && (
        <div className="lc-menu" role="menu" aria-label={`Acciones de ${p.codigo}`}>
          <button type="button" role="menuitem" onClick={() => { setAbierto(false); alVerDetalle(p); }}>Ver detalle de la venta</button>
          <button type="button" role="menuitem" onClick={() => { setAbierto(false); alAbrir(p); }}>Abrir el pedido</button>
        </div>
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
  pestana: PestanaLista;
}

/** Cola de pedidos: una fila por pedido, con franja de color por tipo de servicio y acciones rápidas. */
export function ListaCaja({ filas, accionDe, resaltados, alAccion, alVerDetalle, alAbrir, pestana }: ListaCajaProps) {
  // Que la lectura de pantalla anuncie el cambio de pestaña sin mover el foco
  const [anuncio, setAnuncio] = useState('');
  useEffect(() => setAnuncio(`${filas.length} ${filas.length === 1 ? 'pedido' : 'pedidos'} en esta página`), [filas.length, pestana]);
  return (
    <div id="lc-panel" role="tabpanel" aria-labelledby={`lc-tab-${pestana}`} className="lc-panel" data-testid="lista-caja">
      <ul className="lc-lista">
        {filas.map((p) => (
          <FilaLista key={p.id} pedido={p} accion={accionDe(p)} resaltado={resaltados.has(String(p.id))} alAccion={alAccion} alVerDetalle={alVerDetalle} alAbrir={alAbrir} />
        ))}
      </ul>
      <span className="lc-sr" role="status">{anuncio}</span>
    </div>
  );
}

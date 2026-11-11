import { useState } from 'react';
import type { Pedido } from './pedidosApi';
import { InsigniaMesa } from './InsigniaMesa';
import { PastillaEspera } from './PastillaEspera';
import { IconoModalidad, claveModalidad, textoMesa } from './InsigniaModalidad';
import { estadoVisual, esCerrado } from './estadosCaja';
import type { AccionCaja } from './accionesCaja';
import { ReimprimirPedido } from './ReimprimirPedido';
import { BotonCambiarPago } from './CambiarPago';
import { itemsCaja, textoDetalle, type ItemCaja } from './detalleCaja';
import { AccionesComerLocal } from '../salon/componentes/AccionesComerLocal';
import { NombreCliente } from './TarjetaPedidoCaja';
import { ChipCobroMozo } from './PedidosAdminView';
import { esPorCobrar, totalDe } from './resumenDia';
import { suma, type Cuenta } from './agruparCuentas';

/** Productos que se ven por pedido dentro de la cuenta antes del «+N más» (la tarjeta no crece sin límite). */
export const MAX_PRODUCTOS_SECCION = 3;
/** Pedidos de la cuenta visibles antes del «Ver N más». */
export const MAX_PEDIDOS_CUENTA = 4;

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/** Total de la cuenta (solo pedidos vigentes) y lo que falta cobrar de ellos. */
export function totalesCuenta(miembros: Pedido[]) {
  const vigentes = miembros.filter((m) => suma(m.estado));
  return {
    total: vigentes.reduce((a, m) => a + totalDe(m), 0),
    porCobrar: vigentes.filter(esPorCobrar).reduce((a, m) => a + totalDe(m), 0),
  };
}

function chipPago(o: Pedido): { texto: string; clase: string } {
  const pag = String(o.pago_estado || '').toUpperCase();
  if (o.es_personal) return { texto: 'Crédito del personal', clase: 'info' };
  if (pag === 'PAGADO') return { texto: 'Pagado', clase: 'ok' };
  if (pag === 'COORDINADO') return { texto: 'Pago coordinado', clase: 'info' };
  return { texto: 'Por cobrar', clase: 'pend' };
}

function Producto({ it }: { it: ItemCaja }) {
  const texto = textoDetalle(it);
  return (
    <span className="cj2-prod" data-testid="producto-tarjeta">
      <span className="cj2-prod-nombre">{it.cantidad}× {it.nombre}</span>
      {texto && <span className="cj2-prod-det" data-testid="producto-detalle">{texto}</span>}
      {it.nota && <span className="cj2-prod-nota">Nota: {it.nota}</span>}
      {it.partes.map((p) => (
        <span key={p.id} className="cj2-prod-parte">→ {p.nombre}{textoDetalle(p) ? ` · ${textoDetalle(p)}` : ''}</span>
      ))}
    </span>
  );
}

export interface TarjetaCuentaCajaProps {
  cuenta: Cuenta<Pedido>;
  seleccionadoId: string | null;
  resaltados: Set<string>;
  puedeCambiarPago?: boolean;
  cajaCerradaEspera?: (p: Pedido) => boolean;
  alSeleccionar: (id: Pedido['id']) => void;
  accionDe: (p: Pedido) => AccionCaja | null | undefined;
  alAccion?: (pedido: Pedido, accion: AccionCaja) => void;
  alComerLocal?: () => void;
  /** Para pruebas: instante actual en ms. */
  ahora?: number;
}

/**
 * Una sola tarjeta para el pedido ORIGINAL y sus EXTRAS (códigos distintos). El encabezado es el del original; debajo, una
 * sección por pedido con su código, estado, pago, productos y su propia acción; al pie, el total de la cuenta.
 * Tocar el encabezado abre el original; tocar una sección abre ese pedido. Las acciones secundarias van en «⋯» por sección.
 */
export function TarjetaCuentaCaja({ cuenta, seleccionadoId, resaltados, puedeCambiarPago, cajaCerradaEspera, alSeleccionar, accionDe, alAccion, alComerLocal, ahora }: TarjetaCuentaCajaProps) {
  const raiz = cuenta.miembros.find((m) => String(m.id) === cuenta.raizId) ?? cuenta.miembros[0];
  const clave = claveModalidad(raiz.modalidad);
  const conMesa = !!raiz.mesa_nombre?.trim() && (clave === 'MESA' || /^en espera/i.test(raiz.mesa_nombre));
  const nombre = raiz.cliente_nombre?.trim() || 'Cliente';
  const { total, porCobrar } = totalesCuenta(cuenta.miembros);
  const hayResaltado = cuenta.miembros.some((m) => resaltados.has(String(m.id)));
  const haySel = cuenta.miembros.some((m) => String(m.id) === seleccionadoId);
  const [verTodo, setVerTodo] = useState(false);
  // Un pedido seleccionado (o por ?pedido=) que cae fuera de los primeros se ve siempre
  const idxSel = cuenta.miembros.findIndex((m) => String(m.id) === seleccionadoId);
  const todo = verTodo || idxSel >= MAX_PEDIDOS_CUENTA;
  const lista = todo ? cuenta.miembros : cuenta.miembros.slice(0, MAX_PEDIDOS_CUENTA);
  // La barra toma el color del pedido que sigue vivo (el original si todo cerró)
  const vivo = cuenta.miembros.find((m) => !esCerrado(m)) ?? raiz;
  const visual = estadoVisual(vivo);
  const rotulo = clave === 'DELIVERY' ? 'DELIVERY' : clave === 'MESA' ? 'MESA' : clave === 'LLEVAR' ? 'PARA LLEVAR' : clave === 'COMER_LOCAL' ? 'COMER EN EL LOCAL' : 'EN EL LOCAL';
  const extras = cuenta.miembros.length - 1;

  return (
    <div
      className={`cj2-card cj2-cta ${hayResaltado ? 'cj-resaltado' : ''} ${haySel ? 'cj2-card--sel' : ''}`}
      data-testid="tarjeta-cuenta"
      data-raiz={cuenta.raizId}
      data-estado={visual.clave}
      style={{ position: 'relative' }}
    >
      <div className="cj2-barra" aria-hidden="true" style={{ background: visual.barra }} />
      <button
        type="button"
        className="cj2-cuenta-cab"
        data-testid="cuenta-cabecera"
        onClick={() => alSeleccionar(raiz.id)}
        aria-label={`Cuenta de ${nombre}, pedido ${raiz.codigo} y ${extras} ${extras === 1 ? 'extra' : 'extras'}${conMesa ? `, ${textoMesa(raiz.mesa_nombre)}` : ''}`}
      >
        <span className="cj2-top" style={{ paddingRight: 0 }}>
          <span className="cj2-ident">
            {conMesa && <InsigniaMesa mesaNombre={raiz.mesa_nombre} grande />}
            <NombreCliente pedido={raiz} />
          </span>
          <PastillaEspera creadoEn={raiz.creado_en} cerrado={esCerrado(raiz)} ahora={ahora} />
        </span>
        <span className="cj2-mod">
          <span className="cj2-mod-texto" data-modalidad={clave}>
            <span className="cj2-mod-ico"><IconoModalidad modalidad={clave} tamano={22} /></span>
            <span className="cj2-mod-txt">{rotulo}</span>
            {clave === 'DELIVERY' && raiz.zona?.nombre && <span className="cj2-mod-det">· {raiz.zona.nombre}</span>}
          </span>
          <span className="cj2-cta-cuenta">{cuenta.miembros.length} pedidos en la cuenta</span>
        </span>
        {clave === 'DELIVERY' && raiz.entrega_direccion && <span className="cj2-lugar">{raiz.entrega_direccion}</span>}
      </button>

      <div className="cj2-cta-secciones">
        {lista.map((m) => {
          const esRaiz = String(m.id) === String(raiz.id);
          const v = estadoVisual(m);
          const pago = chipPago(m);
          const items = itemsCaja(m.lineas || []);
          const noSuma = !suma(m.estado);
          const incluido = cuenta.coincide.has(String(m.id));
          const accion = accionDe(m);
          const sel = String(m.id) === seleccionadoId;
          return (
            <section
              key={m.id}
              className={`cj2-cta-sec${sel ? ' cj2-cta-sec--sel' : ''}${incluido ? '' : ' cj2-cta-sec--fuera'}`}
              data-testid="seccion-pedido"
              data-pedido={m.codigo}
              data-estado={v.clave}
            >
              <button type="button" className="cj2-cta-abrir" onClick={() => alSeleccionar(m.id)} aria-label={`Pedido ${m.codigo} ${esRaiz ? 'original' : 'extra'}, ${v.l}`}>
                <span className="cj2-cta-linea">
                  <span className="cj2-cta-cod">{m.codigo}</span>
                  <span className={`cj2-cta-rol ${esRaiz ? 'cj2-cta-rol--orig' : 'cj2-cta-rol--extra'}`} data-testid={esRaiz ? 'rotulo-original' : 'insignia-extra'}>
                    {esRaiz ? 'PEDIDO ORIGINAL' : 'EXTRA'}
                  </span>
                  <span className="cj2-cta-monto">{soles(Number(m.total || 0))}{noSuma && <span className="cj2-nosuma"> no suma</span>}</span>
                </span>
                <span className="cj2-chips">
                  <span className="cj-pc-chip" data-testid="chip-estado" style={{ background: v.bg, color: v.fg, border: v.clave === 'anulado' ? '1.5px solid var(--cp-rust, #B2500F)' : undefined }}>{v.clave === 'anulado' ? v.l.toUpperCase() : v.l}</span>
                  <span className={`cj-pc-chip cj-pc-pago-${pago.clase}`}>{pago.texto}</span>
                  <ChipCobroMozo cobro={m.cobroMozo} />
                  {cajaCerradaEspera?.(m) && <span className="cj-pc-chip" style={{ background: '#FFF4D6', color: '#0B2C3E' }}>Caja cerrada</span>}
                  {!incluido && <span className="cj2-cta-fuera" data-testid="fuera-filtro">no incluido en este filtro</span>}
                </span>
                <span className="cj2-cta-prods" data-testid="productos-tarjeta">
                  {items.length === 0 && <span className="cj2-prod-nombre">1 producto</span>}
                  {items.slice(0, MAX_PRODUCTOS_SECCION).map((it) => <Producto key={it.id} it={it} />)}
                  {items.length > MAX_PRODUCTOS_SECCION && <span className="cj2-mas">+{items.length - MAX_PRODUCTOS_SECCION} más · Ver detalle</span>}
                </span>
              </button>
              <div className="cj2-cta-acciones">
                {accion && (
                  <button
                    type="button"
                    className="cj2-accion cj2-cta-accion"
                    data-accion={accion.tipo}
                    aria-label={`${accion.texto} ${m.codigo}`}
                    style={{ background: accion.bg, color: accion.fg }}
                    onClick={() => alAccion?.(m, accion)}
                  >
                    {accion.texto}
                  </button>
                )}
                <details className="cj2-cta-mas">
                  <summary aria-label={`Más acciones de ${m.codigo}`}>⋯</summary>
                  <div className="cj2-cta-menu">
                    <ReimprimirPedido pedido={m} variante="tarjeta" />
                    {puedeCambiarPago && <BotonCambiarPago permitido pedido={m} variante="tarjeta" />}
                  </div>
                </details>
              </div>
              {String(m.modalidad).toUpperCase() === 'COMER_LOCAL' && <AccionesComerLocal pedido={m} alCambio={alComerLocal} compacto />}
            </section>
          );
        })}
        {cuenta.miembros.length > MAX_PEDIDOS_CUENTA && !(idxSel >= MAX_PEDIDOS_CUENTA) && (
          <button type="button" className="cj2-cta-vermas" aria-expanded={todo} onClick={() => setVerTodo((x) => !x)}>
            {todo ? 'Ver menos' : `Ver ${cuenta.miembros.length - MAX_PEDIDOS_CUENTA} más`}
          </button>
        )}
      </div>

      <div className="cj2-cta-pie" data-testid="total-cuenta">
        <span>Total de la cuenta: <strong>{soles(total)}</strong></span>
        <span className={porCobrar > 0 ? 'cj2-cta-pend' : 'cj2-cta-ok'}>{porCobrar > 0 ? `Por cobrar ${soles(porCobrar)}` : 'Todo cobrado'}</span>
      </div>
    </div>
  );
}

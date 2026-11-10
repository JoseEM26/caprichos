import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Confirmar } from '../../comun/Confirmar';
import { impresionApi, type DestinoReimpresion, type PeticionReimpresionPedido, type ResultadoReimpresionPedido } from '../impresion/impresionApi';
import { VistaPreviaReimpresion } from './VistaPreviaReimpresion';
import type { Pedido } from './pedidosApi';

const URL_COLA = '/admin/configuracion?tab=impresion&seccion=cola';

interface Opcion {
  id: DestinoReimpresion['tipo'];
  texto: string;
  peticion: PeticionReimpresionPedido;
}
const OPCIONES: Opcion[] = [
  { id: 'todo', texto: 'Todo (stickers + ticket)', peticion: { tipo: 'todo' } },
  { id: 'stickers_todos', texto: 'Solo stickers: todos', peticion: { tipo: 'stickers', sub: 'todos' } },
  { id: 'sticker_general', texto: 'Sticker general', peticion: { tipo: 'stickers', sub: 'general' } },
  { id: 'sticker_area', texto: 'Stickers de área', peticion: { tipo: 'stickers', sub: 'area' } },
  { id: 'sticker_bebida', texto: 'Stickers de bebida', peticion: { tipo: 'stickers', sub: 'bebida' } },
  { id: 'ticket_cocina', texto: 'Solo ticket de cocina (comanda)', peticion: { tipo: 'ticket_cocina' } },
  { id: 'ticket_pago', texto: 'Solo ticket de pago / boleta', peticion: { tipo: 'ticket_pago' } },
];

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** «Etiquetera de Caja: 3 stickers · Ticketera de Caja: 1 ticket» */
function resumenPorMaquina(r: ResultadoReimpresionPedido): string {
  return r.porMaquina
    .map((m) => {
      const base = m.rol === 'ETIQUETERA' ? 'Etiquetera' : 'Ticketera';
      const n = m.rol === 'ETIQUETERA' ? plural(m.stickers, 'sticker', 'stickers') : plural(m.tickets, 'ticket', 'tickets');
      return `${base} de ${m.equipo}: ${n}`;
    })
    .join(' · ');
}

/** «Caja / Etiquetera «TSC TTP-244» y Caja / Ticketera «EPSON TM-T20»» */
function dondeVa(r: ResultadoReimpresionPedido): string {
  return r.porMaquina.map((m) => `${m.equipo} / ${m.rol === 'ETIQUETERA' ? 'Etiquetera' : 'Ticketera'}${m.impresora ? ` «${m.impresora}»` : ''}`).join(' y ');
}

/** Línea bajo cada opción: a dónde va, o por qué hoy no se puede. */
function destinoTexto(d: DestinoReimpresion): string {
  if (!d.disponible) return d.motivo ?? 'No se puede imprimir ahora';
  return `${d.cantidad} ${d.cantidad === 1 ? 'papel' : 'papeles'} → ${d.equipo ?? 'computadora'}${d.impresora ? ` / ${d.impresora}` : ''} · conectada${d.motivo ? ` · ${d.motivo}` : ''}`;
}

export interface ReimprimirPedidoProps {
  pedido: Pick<Pedido, 'id' | 'codigo'>;
  /** `detalle`: botón con texto en PC; `tarjeta`: solo icono. */
  variante: 'detalle' | 'tarjeta';
  alTerminar?: () => void;
}

/**
 * Botón «Reimprimir» con su menú (todo, stickers, ticket de cocina, ticket de pago), confirmación Sí/No que dice
 * qué se imprime y dónde, y el aviso con el resultado. Un solo botón por pedido; sirve para pedidos cerrados.
 */
export function ReimprimirPedido({ pedido, variante, alTerminar }: ReimprimirPedidoProps) {
  const [menu, setMenu] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [pendiente, setPendiente] = useState<{ opcion: Opcion; vista: ResultadoReimpresionPedido } | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'mal'; resultado?: ResultadoReimpresionPedido; texto?: string; repetida?: { opcion: Opcion; vista: ResultadoReimpresionPedido } } | null>(null);
  const [destinos, setDestinos] = useState<DestinoReimpresion[] | null>(null);
  const [cargandoDestinos, setCargandoDestinos] = useState(false);
  const [verPrevia, setVerPrevia] = useState(false);
  // Un ref y no solo estado: dos clics en el mismo instante ven el mismo estado, el ref se marca al primero
  const enviando = useRef(false);

  const abrirMenu = () => {
    setMenu(true);
    setDestinos(null);
    setCargandoDestinos(true);
    // Si no se pueden consultar los destinos, las opciones quedan habilitadas y el servidor decide al enviar
    Promise.resolve()
      .then(() => impresionApi.destinosReimpresion(pedido.id))
      .then((r) => setDestinos(r.destinos))
      .catch(() => setDestinos(null))
      .finally(() => setCargandoDestinos(false));
  };

  const elegir = async (opcion: Opcion) => {
    if (cargando) return;
    setCargando(true);
    setAviso(null);
    try {
      const vista = await impresionApi.reimprimirPedido(pedido.id, { ...opcion.peticion, vista_previa: true });
      setMenu(false);
      // Nada que enviar (ya en cola / sin PC / sin regla): se muestra el motivo sin pedir confirmación
      if (vista.cantidad === 0) setAviso({ tono: 'mal', resultado: vista });
      else {
        setVerPrevia(false);
        setPendiente({ opcion, vista });
      }
    } catch (e) {
      setMenu(false);
      setAviso({ tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo reimprimir' });
    } finally {
      setCargando(false);
    }
  };

  const enviar = async (alt: { opcion: Opcion; vista: ResultadoReimpresionPedido }, otraCopia: boolean) => {
    if (enviando.current) return;
    enviando.current = true;
    setCargando(true);
    try {
      const r = await impresionApi.reimprimirPedido(pedido.id, {
        ...alt.opcion.peticion,
        confirmar_anulado: alt.vista.exigeConfirmacionAnulado,
        ...(otraCopia ? { otra_copia: true } : {}),
      });
      setPendiente(null);
      setAviso({ tono: r.cantidad > 0 ? 'ok' : 'mal', resultado: r });
      alTerminar?.();
    } catch (e) {
      setPendiente(null);
      const repetida = (e as { codigo?: string })?.codigo === 'REIMPRESION_REPETIDA';
      setAviso({ tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo reimprimir', ...(repetida ? { repetida: alt } : {}) });
    } finally {
      enviando.current = false;
      setCargando(false);
    }
  };

  const confirmar = async () => {
    if (!pendiente || cargando) return;
    await enviar(pendiente, false);
  };

  const v = pendiente?.vista;
  const mensajeConfirmar = v
    ? `¿Seguro? Se imprimirá ${plural(v.cantidad, 'papel', 'papeles')} (${plural(v.stickers, 'sticker', 'stickers')} y ${plural(v.tickets, 'ticket', 'tickets')}) en ${dondeVa(v)}.` +
      (v.exigeConfirmacionAnulado
        ? ` Este pedido está ${v.pedido.estado === 'ANULADO' ? 'ANULADO' : 'RECHAZADO'}: los tickets saldrán con la marca ANULADO; los stickers no llevan marca.`
        : '') +
      (v.marca && !v.exigeConfirmacionAnulado ? ` El ticket de pago saldrá como «${v.marca}».` : '') +
      (v.omitidos.length ? ` No saldrán: ${v.omitidos.map((o) => o.etiqueta).join(', ')}.` : '')
    : '';

  return (
    <>
      <button
        type="button"
        className={variante === 'detalle' ? 'dp-ico' : 'cj2-reimprimir'}
        aria-label={variante === 'detalle' ? 'Reimprimir stickers y ticket' : `Reimprimir pedido ${pedido.codigo}`}
        title="Reimprimir stickers y ticket"
        aria-haspopup="dialog"
        disabled={cargando}
        onClick={(e) => {
          e.stopPropagation();
          abrirMenu();
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z" />
        </svg>
        {variante === 'detalle' && <span className="dp-btxt">{cargando ? 'Enviando…' : 'Reimprimir'}</span>}
      </button>

      {menu &&
        createPortal(
          <div className="dp-velo" onClick={() => !cargando && setMenu(false)}>
            <div role="dialog" aria-modal="true" aria-label={`Reimprimir pedido ${pedido.codigo}`} className="rp-menu" onClick={(e) => e.stopPropagation()}>
              <div className="dp-impresion-cab">
                <strong>Reimprimir {pedido.codigo}</strong>
                <button type="button" className="dp-ico" aria-label="Cerrar el menú de reimpresión" onClick={() => setMenu(false)}>
                  ×
                </button>
              </div>
              <ul className="rp-lista">
                {OPCIONES.map((o) => {
                  const d = destinos?.find((x) => x.tipo === o.id);
                  const apagada = Boolean(d && !d.disponible);
                  return (
                    <li key={o.id} className={apagada ? 'rp-item rp-item--off' : 'rp-item'}>
                      <button type="button" className="rp-opcion" disabled={cargando || apagada} aria-describedby={d ? `rp-d-${o.id}` : undefined} onClick={() => void elegir(o)}>
                        {o.texto}
                      </button>
                      {d && (
                        <small id={`rp-d-${o.id}`} className={apagada ? 'rp-destino rp-destino--mal' : 'rp-destino'}>
                          {destinoTexto(d)}
                        </small>
                      )}
                    </li>
                  );
                })}
              </ul>
              {cargandoDestinos && <p className="rp-estado" role="status">Comprobando computadoras e impresoras…</p>}
              {!cargandoDestinos && !destinos && <p className="rp-estado">No se pudo comprobar las impresoras: el servidor avisará si algo no sale.</p>}
              {cargando && <p className="rp-estado" role="status">Preparando…</p>}
            </div>
          </div>,
          document.body,
        )}

      <Confirmar
        abierto={Boolean(pendiente)}
        titulo={v?.exigeConfirmacionAnulado ? 'Reimprimir un pedido anulado' : 'Reimprimir'}
        mensaje={mensajeConfirmar}
        textoConfirmar={cargando ? 'Enviando…' : 'Sí, reimprimir'}
        textoNo="No"
        peligro={Boolean(v?.exigeConfirmacionAnulado)}
        deshabilitarConfirmar={cargando}
        alConfirmar={confirmar}
        alCancelar={() => setPendiente(null)}
      >
        {v && v.papeles.length > 0 && (
          <>
            <button type="button" className="rp-previa-btn" aria-expanded={verPrevia} onClick={() => setVerPrevia((x) => !x)}>
              {verPrevia ? 'Ocultar vista previa' : 'Vista previa'}
            </button>
            {verPrevia && <VistaPreviaReimpresion papeles={v.papeles} />}
          </>
        )}
      </Confirmar>

      {aviso &&
        createPortal(
          <div className={`rp-aviso rp-aviso--${aviso.tono}`} role={aviso.tono === 'ok' ? 'status' : 'alert'}>
            <div>
              {aviso.texto && <strong>{aviso.texto}</strong>}
              {aviso.resultado && (
                <>
                  <strong>
                    {aviso.resultado.cantidad > 0
                      ? `Se enviaron ${aviso.resultado.cantidad} trabajos: ${resumenPorMaquina(aviso.resultado)}`
                      : aviso.resultado.yaEnCola.length && !aviso.resultado.omitidos.length
                        ? 'Ya está en cola'
                        : 'No se envió nada'}
                  </strong>
                  {aviso.resultado.yaEnCola.length > 0 && aviso.resultado.cantidad > 0 && (
                    <div>Ya estaban en cola: {aviso.resultado.yaEnCola.map((o) => o.etiqueta).join(', ')}</div>
                  )}
                  {aviso.resultado.omitidos.map((o, i) => (
                    <div key={i}>
                      No salió {o.etiqueta}: {o.motivo}
                    </div>
                  ))}
                  {aviso.resultado.porMaquina.some((m) => !m.conectado) && (
                    <div>Una máquina está sin conexión: saldrá cuando se conecte.</div>
                  )}
                </>
              )}
              {aviso.repetida && (
                <button type="button" className="rp-previa-btn" disabled={cargando} onClick={() => { const r = aviso.repetida!; setAviso(null); void enviar(r, true); }}>
                  {cargando ? 'Enviando…' : 'Imprimir otra copia igual'}
                </button>
              )}
              <a href={URL_COLA}>Ver cola</a>
            </div>
            <button type="button" className="dp-ico" aria-label="Cerrar el aviso de reimpresión" onClick={() => setAviso(null)}>
              ×
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Confirmar } from '../../comun/Confirmar';
import { impresionApi, type PeticionReimpresionPedido, type ResultadoReimpresionPedido } from '../impresion/impresionApi';
import type { Pedido } from './pedidosApi';

const URL_COLA = '/admin/configuracion?tab=impresion&seccion=cola';

interface Opcion {
  id: string;
  texto: string;
  peticion: PeticionReimpresionPedido;
}
const OPCIONES: Opcion[] = [
  { id: 'todo', texto: 'Todo (stickers + ticket)', peticion: { tipo: 'todo' } },
  { id: 'st-todos', texto: 'Solo stickers: todos', peticion: { tipo: 'stickers', sub: 'todos' } },
  { id: 'st-general', texto: 'Sticker general', peticion: { tipo: 'stickers', sub: 'general' } },
  { id: 'st-area', texto: 'Stickers de área', peticion: { tipo: 'stickers', sub: 'area' } },
  { id: 'st-bebida', texto: 'Stickers de bebida', peticion: { tipo: 'stickers', sub: 'bebida' } },
  { id: 'cocina', texto: 'Solo ticket de cocina (comanda)', peticion: { tipo: 'ticket_cocina' } },
  { id: 'pago', texto: 'Solo ticket de pago / boleta', peticion: { tipo: 'ticket_pago' } },
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

function dondeVa(r: ResultadoReimpresionPedido): string {
  return r.porMaquina.map((m) => `${m.equipo} / ${m.rol === 'ETIQUETERA' ? 'Etiquetera' : 'Ticketera'}`).join(' y ');
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
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'mal'; resultado?: ResultadoReimpresionPedido; texto?: string } | null>(null);

  const elegir = async (opcion: Opcion) => {
    if (cargando) return;
    setCargando(true);
    setAviso(null);
    try {
      const vista = await impresionApi.reimprimirPedido(pedido.id, { ...opcion.peticion, vista_previa: true });
      setMenu(false);
      // Nada que enviar (ya en cola / sin PC / sin regla): se muestra el motivo sin pedir confirmación
      if (vista.cantidad === 0) setAviso({ tono: 'mal', resultado: vista });
      else setPendiente({ opcion, vista });
    } catch (e) {
      setMenu(false);
      setAviso({ tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo reimprimir' });
    } finally {
      setCargando(false);
    }
  };

  const confirmar = async () => {
    if (!pendiente || cargando) return;
    setCargando(true);
    try {
      const r = await impresionApi.reimprimirPedido(pedido.id, { ...pendiente.opcion.peticion, confirmar_anulado: pendiente.vista.exigeConfirmacionAnulado });
      setPendiente(null);
      setAviso({ tono: r.cantidad > 0 ? 'ok' : 'mal', resultado: r });
      alTerminar?.();
    } catch (e) {
      setPendiente(null);
      setAviso({ tono: 'mal', texto: e instanceof Error ? e.message : 'No se pudo reimprimir' });
    } finally {
      setCargando(false);
    }
  };

  const v = pendiente?.vista;
  const mensajeConfirmar = v
    ? `Se reimprimirán ${plural(v.stickers, 'sticker', 'stickers')} y ${plural(v.tickets, 'ticket', 'tickets')} en ${dondeVa(v)}.` +
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
          setMenu(true);
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
                {OPCIONES.map((o) => (
                  <li key={o.id}>
                    <button type="button" className="rp-opcion" disabled={cargando} onClick={() => void elegir(o)}>
                      {o.texto}
                    </button>
                  </li>
                ))}
              </ul>
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
        cargando={cargando}
        alConfirmar={confirmar}
        alCancelar={() => setPendiente(null)}
      />

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
